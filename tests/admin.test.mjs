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

test('校正：後台送來的庫存數量一律丟棄並提醒（庫存保密）', () => {
  const next = sanitize(clone(multi)); next.stock_qty = 9; next.variants[0].stock_qty = 0;
  const r = normalizeCmsProduct(multi, next);
  assert.ok(!('stock_qty' in r.product) && !r.product.variants.some(v => 'stock_qty' in v));
  assert.ok(r.warnings.some(w => w.includes('庫存數量屬機密')));
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

test('蝦皮 CSV：解析表頭、錯誤列、對應規格、折扣價與快照；庫存欄忽略不寫入', () => {
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
  assert.ok(!('stock_qty' in r.product.variants[0]), '庫存不寫入（保密）');
  assert.ok(!r.product.review.shopee_sales_snapshot.rows.some(x => 'stock' in x) && !('stock_total' in r.product.review.shopee_sales_snapshot), '快照不含庫存');
  assert.equal(r.rowErrors.length, 1);
  assert.equal(r.product.review.shopee_sales_snapshot.captured_at, '2099-01-01T00:00:00Z');
  assert.equal(r.product.published, multi.published, '匯入不改上架狀態');
  assert.ok(parseShopeeSales([['a', 'b'], ['1', '2']]).error);
});

// ---------- 後台新增商品：自動分類、品牌、草稿與審核 ----------
import { createCmsProduct, CONTROL_KEYS } from '../scripts/lib/cms.mjs';
import { ruleCategory, detectBrand, classify } from '../scripts/lib/classify.mjs';
import { loadAll, validateProducts } from '../scripts/lib/data.mjs';

const { categories, products: allProducts } = loadAll();
const create = next => createCmsProduct(next, { today: '2026-10-24', operator: '林志騰', products: allProducts, categories });

test('自動分類：常見商品名稱判斷正確', () => {
  const cases = [
    ['GNB 6S 1100mAh 120C LiPo 電池｜XT60', 'power-battery', '6s'],
    ['OVONIC 4S 850mAh 100C 電池', 'power-battery', '4s'],
    ['BETAFPV 1S 300mAh HV 電池 BT2.0', 'power-battery', '1s-micro'],
    ['T-MOTOR F60 PRO V 2207.5 1950KV 無刷馬達', 'motors-props', 'motors'],
    ['GEMFAN 51433 三葉槳 5 吋', 'motors-props', 'props'],
    ['Foxeer Lollipop 4 5.8G 圖傳天線 RHCP', 'video', 'antennas'],
    ['RadioMaster RP1 ELRS 2.4G 接收機', 'radio-gps', 'receivers'],
    ['SpeedyBee F405 V4 飛塔 55A', 'fc-esc', 'stacks'],
    ['GEPRC MARK5 5 吋 FPV 穿越機 DJI O4 Pro 到手飛', 'complete-drones', '5in'],
    ['DJI Goggles 3 天線支架｜3D 列印', 'hardware-prints', 'tpu-prints'],
    ['Meteor75 收納盒｜3D 列印', 'hardware-prints', 'cases'],
    ['ISDT 608AC 充電器', 'power-battery', 'chargers'],
    ['焊錫絲 0.8mm 含松香', 'tools', 'soldering'],
  ];
  for (const [name, c, s] of cases) {
    const r = classify({ name_zh: name }, allProducts.filter(p => p.review?.status === 'approved'), categories);
    assert.deepEqual(r && [r.primary_category_id, r.subcategory_id], [c, s], name);
  }
});

test('自動品牌：只認寫在名稱最前面、已存在的品牌；配件、DJI、電翼動力不自動填', () => {
  const brands = allProducts.map(p => p.brand);
  assert.equal(detectBrand('GEPRC LINKFLOW 高頻頭', brands), 'GEPRC');
  assert.equal(detectBrand('ovonic 4S 850mAh 電池', brands), 'OVONIC');
  assert.equal(detectBrand('6S 電池｜適用 GEPRC', brands), null);
  assert.equal(detectBrand('BETAFPV Air65 頂罩｜TPU 3D 列印', brands), null);
  assert.equal(detectBrand('DJI O4 散熱片', brands), null);
  assert.equal(detectBrand('電翼動力 長航電池', brands), null);
  assert.equal(detectBrand('不知名品牌 電池', brands), null);
});

test('新增商品：產生商品 ID、網址、草稿；自動分類與品牌寫入變更紀錄', () => {
  const r = create({ name_zh: 'OVONIC 6S 1300mAh 150C LiPo 電池｜XT60', price_twd: 950, availability: 'in_stock', price_display: 'fixed', approve_publish: false });
  const p = r.product;
  assert.match(p.id, /^ewp-261024-[0-9a-f]{4}$/);
  assert.ok(!allProducts.some(x => x.id === p.id || x.slug === p.slug));
  assert.equal(p.published, false);
  assert.deepEqual([p.review.status, p.review.source, p.review.created_by], ['draft', 'cms', '林志騰']);
  assert.deepEqual([p.primary_category_id, p.subcategory_id, p.brand, p.seller_role], ['power-battery', '6s', 'OVONIC', 'retail']);
  assert.ok(!('approve_publish' in p));
  assert.ok(r.changes.some(c => c.includes('自動分類')) && r.changes.some(c => c.includes('自動判斷品牌')));
  assert.deepEqual(validateProducts([{ ...p, _file: `${p.id}.json` }], categories).errors, []);
});

test('新增商品：自己選的分類不會被覆蓋；只選子分類時自動帶入主分類', () => {
  let p = create({ name_zh: 'GNB 6S 1100mAh 電池', primary_category_id: 'tools', subcategory_id: 'cleaning', price_twd: 1 }).product;
  assert.deepEqual([p.primary_category_id, p.subcategory_id], ['tools', 'cleaning']);
  p = create({ name_zh: '某商品', subcategory_id: 'straps', price_twd: 1 }).product;
  assert.deepEqual([p.primary_category_id, p.subcategory_id], ['hardware-prints', 'straps']);
});

test('新增商品：判斷不出分類時留空（草稿可存、不產生頁面），提醒 EWP 選擇；未選分類不能審核', () => {
  const r = create({ name_zh: 'XYZ-9000', price_twd: 100, approve_publish: true, published: true });
  const p = r.product;
  assert.equal(p.primary_category_id, null);
  assert.ok(r.warnings.some(w => w.includes('無法自動判斷分類')));
  assert.ok(r.warnings.some(w => w.includes('無法審核')));
  assert.equal(p.review.status, 'draft');
  assert.equal(p.published, false);
  assert.deepEqual(validateProducts([{ ...p, _file: `${p.id}.json` }], categories).errors, []);
  // 公開商品一定要有分類
  assert.ok(validateProducts([{ ...p, published: true, _file: 'x.json' }], categories).errors.some(e => e.includes('primary_category_id')));
});

test('新增商品：同一次儲存勾選審核＋上架 → 核准並公開（需要照片）', () => {
  const img = allProducts.find(p => p.published && p.images.length).images[0];
  const r = create({ name_zh: 'GEMFAN 51433 三葉槳', price_twd: 120, images: [{ src: img.src, alt: 'x', rights: 'ewp_own' }], approve_publish: true, published: true });
  assert.equal(r.product.review.status, 'approved');
  assert.equal(r.product.review.approved_by, '林志騰');
  assert.equal(r.product.published, true);
  assert.ok(r.changes.includes('新商品審核通過（可以上架）'));
});

test('原有商品勾選「新商品審核」無效；後台勾選欄位只有 approve_publish', () => {
  assert.deepEqual(CONTROL_KEYS, ['approve_publish']);
  const rejected = allProducts.find(p => p.review?.status === 'rejected');
  const r = normalizeCmsProduct(rejected, { ...clone(rejected), approve_publish: true, published: true });
  assert.equal(r.product.review.status, 'rejected');
  assert.equal(r.product.published, false);
  assert.ok(!('approve_publish' in r.product));
  const shopeeDraft = allProducts.find(p => p.review?.status === 'draft' && p.review?.source !== 'cms');
  if (shopeeDraft) assert.equal(normalizeCmsProduct(shopeeDraft, { ...clone(shopeeDraft), approve_publish: true }).product.review.status, 'draft');
});

test('原有商品清空主分類：還原原本的分類', () => {
  const p = allProducts.find(x => x.published);
  const next = clone(p); delete next.primary_category_id; delete next.subcategory_id;
  const r = normalizeCmsProduct(p, next, { categories, products: allProducts });
  assert.equal(r.product.primary_category_id, p.primary_category_id);
  assert.ok(r.warnings.some(w => w.includes('不可清空')));
});
