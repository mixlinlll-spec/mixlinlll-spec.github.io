// 商品後台批次工具共用函式（批次修改、蝦皮匯入）。純函式、無外部套件。
import { AVAILABILITY, isApproved } from './data.mjs';
import { applyPriceRule } from './cms.mjs';

// 對象語法（逗號、空白或換行分隔，可混用）：
//   all                    全部商品
//   sp-123 / 123           商品 ID 或蝦皮商品 ID；也可用 slug
//   brand:SpeedyBee        品牌包含（不分大小寫）
//   category:motors-props  主分類或子分類 ID
//   search:O4              名稱／品牌／型號包含關鍵字
//   published / draft      已上架／草稿
export function selectProducts(products, target) {
  const tokens = String(target || '').split(/[\n,，]+/).map(t => t.trim()).filter(Boolean);
  if (!tokens.length) return { selected: [], unknown: ['（沒有指定對象）'] };
  const picked = new Set(); const unknown = [];
  const low = s => String(s || '').toLowerCase();
  for (const t of tokens) {
    const [k, ...rest] = t.split(':'); const v = rest.join(':').trim();
    let hit = [];
    if (t === 'all') hit = products;
    else if (t === 'published') hit = products.filter(p => p.published);
    else if (t === 'draft') hit = products.filter(p => !p.published);
    else if (v && k === 'brand') hit = products.filter(p => low(p.brand).includes(low(v)));
    else if (v && k === 'category') hit = products.filter(p => p.primary_category_id === v || p.subcategory_id === v);
    else if (v && k === 'search') hit = products.filter(p => [p.name_zh, p.brand, p.manufacturer_model, p.sku, p.id].some(x => low(x).includes(low(v))));
    else {
      // 單一商品：可用空白分隔多個 ID
      for (const id of t.split(/\s+/)) {
        const m = products.filter(p => p.id === id || p.shopee_item_id === id || p.slug === id || `sp-${id}` === p.id);
        if (m.length) hit.push(...m); else unknown.push(id);
      }
    }
    if (!hit.length && t.includes(':')) unknown.push(`${t}（沒有符合的商品）`);
    hit.forEach(p => picked.add(p));
  }
  return { selected: products.filter(p => picked.has(p)), unknown };
}

const fmtPrice = p => (p.price_display === 'inquiry' || p.price_twd == null ? '詢價' : `NT$${p.price_twd}${p.price_display === 'from' ? ' 起' : ''}`);

// 對單一商品套用批次操作；回傳 { changed, before, after, skip }
export function applyBulk(p, operation, value) {
  const before = summary(p);
  const clone = JSON.parse(JSON.stringify(p));
  switch (operation) {
    case 'publish':
      if (clone.review?.status === 'rejected') return { skip: '不上官網（rejected）' };
      if (!isApproved(clone)) return { skip: '尚未核准（review 不是 approved），不可上架' };
      clone.published = true; break;
    case 'unpublish':
      clone.published = false; break;
    case 'availability':
      if (!AVAILABILITY[value]) throw new Error(`供貨狀態只能是 ${Object.keys(AVAILABILITY).join('／')}`);
      clone.availability = value;
      for (const v of clone.variants || []) v.availability = value;
      break;
    case 'price_percent': {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= -90 || n > 300 || n === 0) throw new Error('百分比必須是 -90 到 300 之間、不為 0 的數字（例：-5、10）');
      if (clone.price_display === 'inquiry') return { skip: '詢價商品不調整' };
      const adj = x => Math.max(1, Math.round(x * (1 + n / 100)));
      let any = false;
      for (const v of clone.variants || []) if (v.price_twd > 0) { v.price_twd = adj(v.price_twd); any = true; }
      if (!any && clone.price_twd > 0) clone.price_twd = adj(clone.price_twd);
      break;
    }
    case 'price_set': {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1) throw new Error('價格必須是 1 以上的整數');
      const distinct = new Set((clone.variants || []).map(v => v.price_twd).filter(x => x > 0));
      if (distinct.size > 1) return { skip: '多規格且價格不同，請在單一商品頁逐一修改' };
      for (const v of clone.variants || []) v.price_twd = n;
      clone.price_twd = n;
      if (clone.price_display === 'inquiry') clone.price_display = 'fixed';
      break;
    }
    case 'price_inquiry':
      clone.price_display = 'inquiry'; break;
    default:
      throw new Error(`未知的操作：${operation}`);
  }
  applyPriceRule(clone);
  const after = summary(clone);
  const changed = JSON.stringify(clone) !== JSON.stringify(p);
  return { changed, before, after, product: clone };
}

export function summary(p) {
  return `${p.published ? '上架' : '草稿'}｜${fmtPrice(p)}｜${AVAILABILITY[p.availability] || p.availability}`;
}

// ---------- 蝦皮銷售資訊 CSV ----------
// 欄位名稱容許中英文與蝦皮範本的機器欄位名稱；找不到時錯誤報告會列出實際的欄位。
const COLS = {
  item: ['et_title_product_id', '商品id', '商品編號', 'product id', 'product_id', 'item id', 'item_id'],
  variation: ['et_title_variation_id', '商品選項id', '規格id', '選項id', 'variation id', 'variation_id', 'model id', 'model_id'],
  name: ['et_title_product_name', '商品名稱', 'product name'],
  vname: ['et_title_variation_name', '商品選項名稱', '規格名稱', 'variation name', 'variation_name'],
  price: ['et_title_variation_price', '價格', '商品價格', '售價', 'price'],
  stock: ['et_title_variation_stock', '庫存', '商品數量', 'stock'],
};
const norm = s => String(s || '').replace(/^﻿/, '').trim().toLowerCase();

export function parseShopeeSales(rows) {
  // 找表頭列：同時有商品 ID 與（價格或庫存）欄位的第一列
  let hi = -1; let idx = {};
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i].map(norm);
    const find = keys => r.findIndex(c => keys.includes(c));
    const m = Object.fromEntries(Object.entries(COLS).map(([k, keys]) => [k, find(keys)]));
    if (m.item >= 0 && (m.price >= 0 || m.stock >= 0)) { hi = i; idx = m; break; }
  }
  if (hi < 0) return { error: `找不到表頭（需要「商品ID」與「價格」或「庫存」欄位）。檔案前兩列：${rows.slice(0, 2).map(r => r.join(' | ')).join(' ／ ')}` };
  const items = []; const bad = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i]; const line = i + 1;
    const item = String(r[idx.item] ?? '').trim();
    if (!/^\d{5,}$/.test(item)) { if (r.some(c => String(c).trim())) bad.push({ line, reason: '略過：非資料列（說明列或空白商品 ID）' }); continue; }
    const variation = idx.variation >= 0 ? String(r[idx.variation] ?? '').trim() : '';
    const num = c => { const s = String(r[c] ?? '').replace(/[,\s$NT]/g, ''); return s === '' ? null : Number(s); };
    const price = idx.price >= 0 ? num(idx.price) : null;
    const stock = idx.stock >= 0 ? num(idx.stock) : null;
    const rec = { line, item, variation: /^\d+$/.test(variation) && variation !== '0' ? variation : '', name: idx.name >= 0 ? r[idx.name] : '', vname: idx.vname >= 0 ? r[idx.vname] : '', price, stock };
    if (price !== null && !(Number.isFinite(price) && price > 0)) { bad.push({ line, reason: `價格不正確：${r[idx.price]}` }); rec.price = null; }
    if (stock !== null && !(Number.isInteger(stock) && stock >= 0)) { bad.push({ line, reason: `庫存不正確：${r[idx.stock]}` }); rec.stock = null; }
    items.push(rec);
  }
  return { items, bad, header: rows[hi], columns: idx };
}

// 把蝦皮資料的「價格」套用到商品。庫存數量屬機密（EWP 決定）：CSV 裡的庫存欄一律忽略、不寫入 repo，
// 第二階段改寫入私有的 Cloudflare D1。回傳每件商品的變更與找不到的資料列。
export function applyShopeeSales(products, items, { discount = 4, capturedAt } = {}) {
  const sitePrice = x => Math.round(x * (1 - discount / 100));
  const byItem = new Map();
  for (const it of items) { if (!byItem.has(it.item)) byItem.set(it.item, []); byItem.get(it.item).push(it); }
  const results = []; const notFound = [];
  for (const [item, rows] of byItem) {
    const p = products.find(x => x.shopee_item_id === item);
    if (!p) { notFound.push(...rows.map(r => ({ line: r.line, reason: `官網沒有蝦皮商品 ${item}（${r.name || ''}）` }))); continue; }
    const before = JSON.stringify(p);
    const clone = JSON.parse(before);
    const log = []; const rowErrors = [];
    const hasVariants = (clone.variants || []).some(v => v.shopee_variation_id);
    for (const r of rows) {
      if (hasVariants) {
        const v = clone.variants.find(x => String(x.shopee_variation_id) === r.variation);
        if (!v) { rowErrors.push({ line: r.line, reason: `${clone.id} 找不到規格 ${r.variation || '（無規格 ID）'} ${r.vname || ''}` }); continue; }
        if (r.price) { const np = sitePrice(r.price); if (v.price_twd !== np) { log.push(`規格「${v.name}」售價 ${v.price_twd ?? '—'} → ${np}`); v.price_twd = np; } }
      } else if (r.price) {
        const np = sitePrice(r.price);
        for (const v of clone.variants || []) v.price_twd = np;
        if (clone.price_twd !== np) { log.push(`售價 ${clone.price_twd ?? '—'} → ${np}`); clone.price_twd = np; if (clone.price_display === 'inquiry') clone.price_display = 'fixed'; }
      }
    }
    applyPriceRule(clone);
    // 蝦皮價格快照（僅供核對）：只在價格與上次快照不同時更新；不含庫存
    if (clone.review) {
      const snap = clone.review.shopee_sales_snapshot || {};
      const oldRows = snap.rows || [];
      const newRows = rows.map(r => {
        const { stock, ...o } = oldRows.find(x => String(x.variation_id || '') === r.variation) || {}; // eslint-disable-line no-unused-vars
        return { ...o, variation_id: r.variation || o.variation_id || null, name: r.vname || o.name || '', price: r.price ?? o.price ?? null };
      });
      if (JSON.stringify(newRows) !== JSON.stringify(oldRows)) {
        const prices = newRows.map(r => r.price).filter(x => x > 0);
        const { stock_total, ...rest } = snap; // eslint-disable-line no-unused-vars
        clone.review.shopee_sales_snapshot = {
          ...rest, rows: newRows,
          ...(prices.length ? { price_min: Math.min(...prices), price_max: Math.max(...prices) } : {}),
          captured_at: capturedAt, status: 'applied', applied_at: capturedAt.slice(0, 10), applied: ['prices'], discount_percent: discount,
        };
        log.push('更新蝦皮價格快照');
      }
    }
    results.push({ id: clone.id, name: clone.name_zh, log, rowErrors, product: clone, changed: JSON.stringify(clone) !== before });
  }
  return { results, notFound };
}
