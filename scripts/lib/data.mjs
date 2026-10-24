// 共用資料載入、CSV 解析與商品驗證。無外部套件，Node 18+ 可直接執行。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = path.join(ROOT, 'src', 'data');
export const PRODUCTS_DIR = path.join(DATA_DIR, 'products');

// 發布白名單：只有這些「手寫靜態檔」會被複製到發布產物（dist/）。
// src/、scripts/、tests/、docs/、_preview/ 等永遠不會進入發布產物。
export const STATIC_WHITELIST = ['assets', 'blackbox', 'fpv-help.html', 'huan.png', 'learn', 'legacy', '.nojekyll'];

export const SELLER_ROLES = {
  ewp_original: 'EWP 自製',
  ewp_assembled: 'EWP 組裝',
  retail: '其他品牌商品',
  collab: '聯名商品',
  service: '客製服務',
};
export const REVIEW_STATUS = ['draft', 'approved', 'rejected'];
// 圖片使用權：只有 EWP 自有或已取得授權的圖片可以用在公開商品
export const IMAGE_RIGHTS = { ewp_own: 'EWP 自有', licensed: '已取得授權' };
// 草稿可用的使用權狀態：unverified = 由蝦皮匯入、使用權待 EWP 確認（不可公開、不會複製到正式產物）
export const IMAGE_RIGHTS_ALL = { ...IMAGE_RIGHTS, unverified: '使用權待確認' };
// 上架模式：sale = 一般商品；showcase = 作品／機型介紹（不顯示價格與購買按鈕）
export const LISTING_MODES = ['sale', 'showcase'];
export const CTA_PRIMARY = ['line', 'shopee'];
export const AVAILABILITY = {
  in_stock: '現貨',
  preorder: '預購',
  made_to_order: '接單製作',
  out_of_stock: '暫無供貨',
  unknown: '供貨狀況請洽詢',
};
export const PRICE_DISPLAY = ['fixed', 'from', 'inquiry'];

// 規格識別碼：沒有蝦皮規格 ID 的規格用 key（建立後永不改變），庫存後台以它對應 SKU，改名或排序都不影響
export const VARIANT_KEY_RE = /^v-[0-9a-f]{8}$/;
export function newVariantKey(taken = new Set()) {
  let k;
  do { k = 'v-' + crypto.randomBytes(4).toString('hex'); } while (taken.has(k));
  return k;
}

export function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
export function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function loadAll() {
  const site = readJSON(path.join(DATA_DIR, 'site.json'));
  const { categories } = readJSON(path.join(DATA_DIR, 'categories.json'));
  const { builds } = readJSON(path.join(DATA_DIR, 'builds.json'));
  const { services } = readJSON(path.join(DATA_DIR, 'services.json'));
  const notices = fs.existsSync(path.join(DATA_DIR, 'notices.json')) ? readJSON(path.join(DATA_DIR, 'notices.json')) : null;
  const products = fs.existsSync(PRODUCTS_DIR)
    ? fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.json')).sort()
        .map(f => ({ ...readJSON(path.join(PRODUCTS_DIR, f)), _file: f }))
    : [];
  return { site, categories, builds, services, products, notices };
}

// ---------- CSV（RFC 4180，支援引號、換行、UTF-8 BOM） ----------
export function parseCSV(text) {
  const [header, ...body] = parseCSVRows(text);
  return body.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

export function parseCSVRows(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(v => v !== '')) rows.push(row);
  return rows;
}

// ---------- 驗證 ----------
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateProducts(products, categories) {
  const errors = [];
  const warnings = [];
  const ids = new Map(), slugs = new Map(), skus = new Map();
  const catMap = new Map(categories.map(c => [c.id, c]));
  for (const p of products) {
    const at = `${p._file || p.id}`;
    const err = m => errors.push(`${at}: ${m}`);
    const warn = m => warnings.push(`${at}: ${m}`);
    for (const k of ['id', 'slug', 'name_zh', 'seller_role', 'price_display', 'availability', 'updated_at']) {
      if (p[k] === undefined || p[k] === null || p[k] === '') err(`缺少必要欄位 ${k}`);
    }
    // 主分類：公開商品一定要有；後台新增、還無法自動判斷分類的草稿可以暫時空白（不會出現在網站）
    const noCat = p.primary_category_id === undefined || p.primary_category_id === null || p.primary_category_id === '';
    if (noCat && (p.published || p.review?.source !== 'cms')) err('缺少必要欄位 primary_category_id');
    for (const k of ['tags', 'compatible_sizes', 'specifications', 'images', 'variants']) {
      if (!Array.isArray(p[k])) err(`${k} 必須是陣列`);
    }
    for (const k of ['line_inquiry_enabled', 'featured', 'published']) {
      if (typeof p[k] !== 'boolean') err(`${k} 必須是 true/false`);
    }
    if (p.id) { if (ids.has(p.id)) err(`id 重複：${p.id}（另見 ${ids.get(p.id)}）`); ids.set(p.id, at); }
    if (p.slug) {
      if (!SLUG_RE.test(p.slug)) err(`slug 只能用小寫英數與連字號：${p.slug}`);
      if (slugs.has(p.slug)) err(`slug 重複：${p.slug}（另見 ${slugs.get(p.slug)}）`);
      slugs.set(p.slug, at);
    }
    if (p.sku) { if (skus.has(p.sku)) err(`SKU 重複：${p.sku}`); skus.set(p.sku, at); }
    if (p.seller_role && !SELLER_ROLES[p.seller_role]) err(`seller_role 不合法：${p.seller_role}`);
    if (p.availability && !AVAILABILITY[p.availability]) err(`availability 不合法：${p.availability}`);
    if (p.price_display && !PRICE_DISPLAY.includes(p.price_display)) err(`price_display 不合法：${p.price_display}`);
    const cat = catMap.get(p.primary_category_id);
    if (noCat) { if (p.subcategory_id) err(`沒有主分類時不可只填子分類：${p.subcategory_id}`); }
    else if (!cat) err(`找不到主分類：${p.primary_category_id}`);
    else if (p.subcategory_id && !cat.subcategories.some(s => s.id === p.subcategory_id)) err(`分類 ${cat.id} 沒有子分類 ${p.subcategory_id}`);
    // 庫存數量屬機密（EWP 決定，repo 公開）：任何庫存數字都不可寫入商品資料
    if ('stock_qty' in p) err('不可存放庫存數量 stock_qty（庫存屬機密，第二階段改存 D1）');
    const snapStock = p.review?.shopee_sales_snapshot;
    if (snapStock && ('stock_total' in snapStock || (snapStock.rows || []).some(r => 'stock' in r))) err('蝦皮快照不可含庫存數量（stock、stock_total）');
    if (p.updated_at && !DATE_RE.test(p.updated_at)) err(`updated_at 格式應為 YYYY-MM-DD`);
    // 價格規則：不得出現 0 元；fixed/from 需要價格；inquiry 不得帶價格
    if (p.price_twd !== null && p.price_twd !== undefined) {
      if (!Number.isFinite(p.price_twd) || p.price_twd <= 0) err(`price_twd 必須是大於 0 的數字或 null（不得為 0）`);
    }
    if (['fixed', 'from'].includes(p.price_display) && !(p.price_twd > 0)) err(`price_display=${p.price_display} 需要有效的 price_twd`);
    if (p.price_display === 'inquiry' && p.price_twd != null) err(`price_display=inquiry 時 price_twd 必須為 null`);
    if (p.shopee_url && !/^https:\/\/(shopee\.tw|tw\.shp\.ee)\//.test(p.shopee_url)) err(`shopee_url 必須是 https://shopee.tw/ 或 https://tw.shp.ee/ 網址`);
    { const keys = (p.variants || []).map(v => v.key).filter(Boolean); if (new Set(keys).size !== keys.length) err('規格識別碼 key 重複'); }
    { const vids = (p.variants || []).map(v => v.shopee_variation_id).filter(Boolean); if (new Set(vids.map(String)).size !== vids.length) err('蝦皮規格 ID 重複'); }
    for (const [i, v] of (p.variants || []).entries()) {
      if (!v.name) err(`variants[${i}] 缺少 name`);
      if (v.price_twd != null && !(v.price_twd > 0)) err(`variants[${i}].price_twd 不得為 0`);
      if (v.availability && !AVAILABILITY[v.availability]) err(`variants[${i}].availability 不合法`);
      if ('stock_qty' in v) err(`variants[${i}] 不可存放庫存數量 stock_qty（庫存屬機密）`);
      if (!v.shopee_variation_id && !VARIANT_KEY_RE.test(v.key || '')) err(`variants[${i}]（${v.name}）缺少規格識別碼 key（沒有蝦皮規格 ID 的規格必須有固定的 key）`);
      if (v.key !== undefined && !VARIANT_KEY_RE.test(v.key)) err(`variants[${i}].key 格式錯誤`);
      if (v.sku) { if (skus.has(v.sku)) err(`SKU 重複：${v.sku}`); skus.set(v.sku, at); }
    }
    for (const [i, s] of (p.specifications || []).entries()) {
      if (!s.key || s.value === undefined || s.value === '') err(`specifications[${i}] 需要 key 與 value`);
    }
    for (const [i, img] of (p.images || []).entries()) {
      for (const key of ['src', 'src_small', 'fallback']) {
        const v = img[key];
        if (v === undefined || v === null) { if (key === 'src') err(`images[${i}] 缺少 src`); continue; }
        const r = checkAssetPath(v);
        if (r) err(`images[${i}].${key}：${r}`);
      }
      if (!img.alt) err(`images[${i}] 缺少 alt 文字`);
    }
    // 公開條件：只有完整且通過審核的商品可以公開
    if (p.published) {
      if (!p.images?.length) err('published=true 需要至少一張正式圖片');
      // review 必須存在、是物件，且 status 明確等於 approved；缺少、null、{}、draft 一律不得公開
      if (!isApproved(p)) err('published=true 需要 review.status = "approved"（EWP 已核對）');
    }
    if (p.review !== undefined && (p.review === null || typeof p.review !== 'object' || Array.isArray(p.review))) err('review 必須是物件');
    else if (p.review?.status !== undefined && !REVIEW_STATUS.includes(p.review.status)) err(`review.status 不合法：${p.review.status}`);
    if (p.listing_mode !== undefined && !LISTING_MODES.includes(p.listing_mode)) err(`listing_mode 只能是 sale 或 showcase`);
    if (p.published) {
      for (const [i, img] of (p.images || []).entries()) if (!IMAGE_RIGHTS[img.rights]) err(`images[${i}] 公開前必須標示使用權 rights（${Object.keys(IMAGE_RIGHTS).join('／')}）`);
    }
    for (const [i, img] of (p.images || []).entries()) if (img.rights !== undefined && !IMAGE_RIGHTS_ALL[img.rights]) err(`images[${i}].rights 不合法：${img.rights}`);
    for (const [i, v] of (p.variants || []).entries()) if (v.image) {
      const r = checkAssetPath(v.image.src); if (r) err(`variants[${i}].image：${r}`);
      if (p.published && !IMAGE_RIGHTS[v.image.rights]) err(`variants[${i}].image 公開前必須標示使用權 rights`);
    }
    if (p.cta_primary !== undefined && p.cta_primary !== null && !CTA_PRIMARY.includes(p.cta_primary)) err(`cta_primary 只能是 line 或 shopee`);
    if (p.availability === 'in_stock' && !p.published) warn('草稿標示為現貨，公開前請再次確認');
  }
  return { errors, warnings };
}

// 圖片路徑：必須是 /assets/ 底下、正規化後仍在 assets 內、副檔名為圖片、且檔案存在
const IMG_EXT = /\.(webp|jpe?g|png|avif|gif|svg)$/i;
export function checkAssetPath(src) {
  if (typeof src !== 'string' || !src.startsWith('/assets/')) return `必須是 /assets/ 下的站內正式圖片：${src}`;
  if (/[\\?#%]|\.\./.test(src)) return `路徑不得含 ..、反斜線、? # %：${src}`;
  const abs = path.resolve(ROOT, '.' + src);
  if (!abs.startsWith(path.join(ROOT, 'assets') + path.sep)) return `路徑超出 assets：${src}`;
  if (!IMG_EXT.test(src)) return `副檔名必須是圖片：${src}`;
  if (!fs.existsSync(abs)) return `檔案不存在：${src}`;
  return null;
}

export function isApproved(p) {
  return p != null && p.review != null && typeof p.review === 'object' && !Array.isArray(p.review) && p.review.status === 'approved';
}
// 排除：EWP 決定不放上官網的商品（review.status = rejected），正式版與預覽版都不產生
export const isRejected = p => p?.review?.status === 'rejected';

export function slugify(name, fallback) {
  const tokens = (name.match(/[A-Za-z0-9][A-Za-z0-9.]*/g) || [])
    .map(t => t.toLowerCase().replace(/\./g, '-').replace(/-+$/, ''))
    .filter(Boolean);
  const uniq = [...new Set(tokens)].slice(0, 6).join('-').slice(0, 60).replace(/-+$/, '');
  return uniq || fallback;
}

export function today() {
  const d = new Date(Date.now() + 8 * 3600e3); // 台灣時間
  return d.toISOString().slice(0, 10);
}
