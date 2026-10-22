// 商品後台工具單元測試：node --test tests/admin.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PRODUCTS_DIR, readJSON } from '../scripts/lib/data.mjs';
import { normalizeCmsProduct, serializeProduct, applyPriceRule } from '../scripts/lib/cms.mjs';
import { selectProducts, applyBulk, parseShopeeSales, applyShopeeSales } from '../scripts/lib/admin.mjs';

const products = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.json')).sort().map(f => readJSON(path.join(PRODUCTS_DIR, f)));
const multi = products.find(p => p.published && p.variants.length >= 2 && new Set(p.variants.map(v => v.price_twd)).size > 1);
const rejected = products.find(p => p.review?.status === 'rejected');
const clone = o => JSON.parse(JSON.stringify(o));

// 模擬 Pages CMS 的 sanitizeObject：刪除 null、""、空陣列、空物件
function sanitize(o) {
  if (Array.isArray(o)) return o.map(sanitize).filter(v => !(v == null || v === ''));
  if (o && typeof o === 'object') {
    const r = {};
    for (const [k, v] of Object.entries(o)) {
      const s = v && typeof v === 'object' ? sanitize(v) : v;
      if (s == null || s === '' || (Array.isArray(s) && !s.length) || (s && typeof s === 'object' && !Array.isArray(s) && !Object.keys(s).length)) continue;
      r[k] = s;
    }
    return r;
  }
  return o;
}

test('校正：Pages CMS 清掉的空值全部還原、檔案逐字相同（全部商品）', () => {
  for (const p of products) {
    const { product, changes } = normalizeCmsProduct(p, sanitize(clone(p)), { today: '2099-01-01' });
    assert.equal(serializeProduct(product), JSON.stringify(p, null, 2) + '\n', p.id);
    assert.deepEqual(changes, [], p.id);
  }
});

test('校正：review、id、slug 不可經由後台修改；未核准商品不能上架', () => {
  const next = sanitize(clone(multi));
  next.id = 'x'; next.slug = 'x'; next.review = { status: 'approved' };
  const { product } = normalizeCmsProduct(multi, next);
  assert.equal(product.id, multi.id); assert.equal(product.slug, multi.slug);
  assert.deepEqual(product.review, multi.review);
  const r = normalizeCmsProduct(rejected, { ...sanitize(clone(rejected)), published: true });
  assert.equal(r.product.published, false);
  assert.ok(r.warnings.some(w => w.includes('尚未核准')));
});

test('校正：刪除整個 review 或陣列子欄位也會還原', () => {
  const next = sanitize(clone(multi)); delete next.review;
  next.variants = next.variants.map(({ image, shopee_variation_id, ...v }) => ({ ...v, shopee_variation_id })); // 規格圖遺失
  const { product } = normalizeCmsProduct(multi, next);
  assert.deepEqual(product.review, multi.review);
  assert.deepEqual(product.variants.map(v => v.image), multi.variants.map(v => v.image));
});

test('價格規則：最低規格價、單一價＝定價、詢價清空價格、沒有價格改詢價', () => {
  assert.deepEqual(applyPriceRule({ price_display: 'fixed', price_twd: 9, variants: [{ price_twd: 30 }, { price_twd: 20 }] }), { price_display: 'from', price_twd: 20, variants: [{ price_twd: 30 }, { price_twd: 20 }] });
  assert.equal(applyPriceRule({ price_display: 'from', price_twd: 9, variants: [{ price_twd: 30 }, { price_twd: 30 }] }).price_display, 'fixed');
  assert.equal(applyPriceRule({ price_display: 'inquiry', price_twd: 50, variants: [] }).price_twd, null);
  const w = []; assert.equal(applyPriceRule({ price_display: 'fixed', price_twd: null, variants: [] }, w).price_display, 'inquiry'); assert.equal(w.length, 1);
});

test('批次對象：ID、蝦皮 ID、品牌、分類、關鍵字、找不到的會列出', () => {
  assert.equal(selectProducts(products, multi.id).selected.length, 1);
  assert.equal(selectProducts(products, multi.shopee_item_id).selected[0].id, multi.id);
  assert.equal(selectProducts(products, 'all').selected.length, products.length);
  assert.ok(selectProducts(products, `category:${multi.primary_category_id}`).selected.includes(multi));
  assert.deepEqual(selectProducts(products, 'sp-000, nope').unknown, ['sp-000', 'nope']);
  assert.equal(selectProducts(products, '').selected.length, 0);
});

test('批次操作：調價、上下架、供貨、詢價；未核准不可上架', () => {
  const r = applyBulk(multi, 'price_percent', '-10');
  assert.ok(r.changed);
  assert.deepEqual(r.product.variants.map(v => v.price_twd), multi.variants.map(v => Math.max(1, Math.round(v.price_twd * 0.9))));
  assert.equal(r.product.price_twd, Math.min(...r.product.variants.map(v => v.price_twd)));
  assert.equal(applyBulk(multi, 'unpublish').product.published, false);
  assert.ok(applyBulk(rejected, 'publish').skip);
  const a = applyBulk(multi, 'availability', 'preorder').product;
  assert.ok(a.availability === 'preorder' && a.variants.every(v => v.availability === 'preorder'));
  assert.throws(() => applyBulk(multi, 'availability', 'soon'));
  assert.throws(() => applyBulk(multi, 'price_percent', '0'));
  assert.ok(applyBulk(multi, 'price_set', '100').skip, '多規格不同價不可一次設定');
  const q = applyBulk(multi, 'price_inquiry').product;
  assert.ok(q.price_display === 'inquiry' && q.price_twd === null);
  assert.equal(multi.published, true, '原物件不被修改');
});

test('蝦皮 CSV：解析表頭、錯誤列、對應規格、折扣價與快照', () => {
  const v0 = multi.variants[0];
  const rows = [
    ['et_title_product_id', 'et_title_product_name', 'et_title_variation_id', 'et_title_variation_name', 'et_title_variation_price', 'et_title_variation_stock'],
    ['商品ID', '商品名稱', '商品選項ID', '商品選項名稱', '價格', '庫存'],
    [multi.shopee_item_id, multi.name_zh, v0.shopee_variation_id, v0.name, '1000', '5'],
    [multi.shopee_item_id, multi.name_zh, '1', '不存在', '100', '1'],
    ['12345678', 'X', '', '', '100', '1'],
    [multi.shopee_item_id, multi.name_zh, v0.shopee_variation_id, v0.name, 'abc', '-2'],
  ];
  const parsed = parseShopeeSales(rows);
  assert.equal(parsed.items.length, 4);
  assert.equal(parsed.bad.filter(b => !b.reason.startsWith('略過')).length, 2);
  const { results, notFound } = applyShopeeSales(products, parsed.items, { discount: 4, capturedAt: '2099-01-01T00:00:00Z' });
  assert.equal(notFound.length, 1);
  const r = results.find(x => x.id === multi.id);
  assert.equal(r.product.variants[0].price_twd, 960);
  assert.equal(r.product.variants[0].stock_qty, 5);
  assert.equal(r.rowErrors.length, 1);
  assert.equal(r.product.review.shopee_sales_snapshot.captured_at, '2099-01-01T00:00:00Z');
  assert.equal(r.product.published, multi.published, '匯入不改上架狀態');
  const onlyStock = applyShopeeSales(products, parsed.items, { fields: 'stock', capturedAt: '2099-01-01T00:00:00Z' }).results.find(x => x.id === multi.id);
  assert.equal(onlyStock.product.variants[0].price_twd, v0.price_twd, '只更新庫存時不改價格');
  assert.ok(parseShopeeSales([['a', 'b'], ['1', '2']]).error);
});
