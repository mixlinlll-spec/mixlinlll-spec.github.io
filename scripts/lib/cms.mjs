import crypto from 'node:crypto';
import { newVariantKey, slugify } from './data.mjs';
import { classify, detectBrand } from './classify.mjs';
// 商品後台（Pages CMS）儲存後的資料校正。純函式、無外部套件，方便單元測試。
//
// Pages CMS 儲存時（見 docs/admin/PRODUCT_ADMIN.md）：
//   - 未列在 .pages.yml 的欄位：由 merge 保留（但其中的 null／""／[]／{} 會被刪掉）
//   - 有列出的陣列（variants、images…）：整個覆蓋
//   - 全檔的 null、空字串、空陣列、空物件：一律刪除
// 本模組以「儲存前版本」為準，把被刪掉的空值放回、保護不可修改的欄位、套用上架與價格規則。

// 後台可以修改的商品欄位（必須與 .pages.yml 的非唯讀欄位一致；tests 會比對）
export const EDITABLE_PRODUCT_KEYS = [
  'name_zh', 'published', 'availability', 'price_display', 'price_twd', 'variants', 'images',
  'brand', 'manufacturer_model', 'sku', 'primary_category_id', 'subcategory_id',
  'short_description', 'description', 'specifications', 'tags', 'featured', 'line_inquiry_enabled', 'cta_primary',
];
// 唯讀顯示（後台看得到但不能改）：一律以儲存前版本為準
export const READONLY_PRODUCT_KEYS = ['id', 'slug', 'shopee_item_id'];
export const EDITABLE_VARIANT_KEYS = ['name', 'price_twd', 'availability', 'sku'];
// 庫存數量屬機密（EWP 決定，repo 公開）：不可經由後台寫入，送來的一律丟棄
export const SECRET_KEYS = ['stock_qty'];
// 後台的操作勾選（不是商品資料，不會存進商品檔）：新商品審核
export const CONTROL_KEYS = ['approve_publish'];
export const EDITABLE_IMAGE_KEYS = ['src', 'alt', 'rights'];
export const EDITABLE_SPEC_KEYS = ['key', 'value'];

// 欄位被清空（Pages CMS 會直接刪除鍵）時要寫回的值；DELETE＝不保留此鍵
const DELETE = Symbol('delete');
const PRODUCT_DEFAULTS = {
  brand: null, manufacturer_model: null, sku: null, subcategory_id: null, price_twd: null,
  short_description: '', description: '', variants: [], images: [], specifications: [], tags: [],
  published: false, featured: false, line_inquiry_enabled: false, cta_primary: DELETE,
};
const VARIANT_DEFAULTS = { sku: null, price_twd: null, availability: 'unknown' };

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const isEmptyish = v => v == null || v === '' || (Array.isArray(v) && v.length === 0) || (isObj(v) && Object.keys(v).length === 0);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 依「鍵順序＝舊版順序，新鍵放最後」組合物件
function ordered(prevObj, values) {
  const out = {};
  for (const k of Object.keys(prevObj || {})) if (k in values && values[k] !== DELETE) out[k] = values[k];
  for (const k of Object.keys(values)) if (!(k in out) && values[k] !== DELETE && values[k] !== undefined) out[k] = values[k];
  return out;
}

function pickEditable(prevItem, nextItem, editableKeys, defaults) {
  const values = {};
  // 不可修改的子欄位：沿用舊版
  for (const [k, v] of Object.entries(prevItem || {})) if (!editableKeys.includes(k)) values[k] = clone(v);
  for (const k of editableKeys) {
    if (nextItem && k in nextItem) values[k] = nextItem[k];
    else if (prevItem && k in prevItem && isEmptyish(prevItem[k])) values[k] = clone(prevItem[k]);
    else if (k in defaults) values[k] = defaults[k];
    else if (prevItem && k in prevItem) values[k] = DELETE; // 使用者清空
  }
  return ordered(prevItem, values);
}

function normalizeVariants(prevList = [], nextList = []) {
  // 規格身分（庫存後台以它對應 SKU）：蝦皮規格 ID 或 key，建立後不可改變。
  // 1. 依蝦皮規格 ID 對應  2. 依 key 對應（排序、改名都不影響）
  // 3. 送來的 ID 是竄改的（舊資料沒有）→ 用相同位置對應舊規格；舊資料沒有任何身分（舊格式）→ 也用相同位置
  // 對不到的是新規格：不可自行填蝦皮規格 ID，給一個新的 key
  const used = new Set();
  const take = i => { if (i >= 0) used.add(i); return i; };
  const match = nextList.map(v => {
    if (v.shopee_variation_id) return take(prevList.findIndex((p, j) => !used.has(j) && p.shopee_variation_id && String(p.shopee_variation_id) === String(v.shopee_variation_id)));
    if (v.key) return take(prevList.findIndex((p, j) => !used.has(j) && !p.shopee_variation_id && p.key === v.key));
    return -1;
  });
  nextList.forEach((v, n) => {
    if (match[n] >= 0 || n >= prevList.length || used.has(n)) return;
    const p = prevList[n];
    const tamperedId = v.shopee_variation_id && p.shopee_variation_id;
    const tamperedKey = v.key && !p.shopee_variation_id && p.key; // 隱藏欄位被竄改：沿用同位置舊規格的身分
    const legacy = !p.shopee_variation_id && !p.key && !v.key && !v.shopee_variation_id;
    if (tamperedId || tamperedKey || legacy) { match[n] = n; used.add(n); }
  });
  const taken = new Set(prevList.map(p => p.key).filter(Boolean));
  return nextList.map((v, n) => {
    const prev = match[n] >= 0 ? prevList[match[n]] : undefined;
    const out = pickEditable(prev, v, EDITABLE_VARIANT_KEYS, VARIANT_DEFAULTS);
    delete out.shopee_variation_id; delete out.key;
    if (prev?.shopee_variation_id) out.shopee_variation_id = prev.shopee_variation_id;
    else if (prev?.key) out.key = prev.key;
    else { out.key = newVariantKey(taken); taken.add(out.key); }
    return ordered(prev, out);
  });
}

function normalizeImages(prevList = [], nextList = [], productName) {
  const bySrc = new Map(prevList.map(im => [im.src, im]));
  return nextList.map((im, i) => {
    const prev = bySrc.get(im.src);
    const out = prev ? pickEditable(prev, im, EDITABLE_IMAGE_KEYS, {}) : { ...im };
    if (!prev) { // 新上傳的照片：其餘欄位由圖片處理補上
      for (const k of ['src_small', 'width', 'height', 'source_url']) delete out[k];
      out.role = out.role || 'gallery';
      out._needs_processing = true;
    }
    if (!out.alt) out.alt = `${productName}（照片 ${i + 1}）`;
    if (!out.rights) out.rights = 'ewp_own';
    return out;
  });
}

function normalizeSpecs(prevList = [], nextList = []) {
  return nextList.map((s, i) => {
    const prev = prevList.find(p => p.key === s.key) || prevList[i];
    const out = pickEditable(prev && prev.key === s.key ? prev : undefined, s, EDITABLE_SPEC_KEYS, {});
    return out;
  });
}

// prev：儲存前的商品資料；next：Pages CMS 寫入的資料。回傳校正後資料、變更清單與提醒。
export function normalizeCmsProduct(prev, next, { today, ...ctx } = {}) {
  const warnings = [];
  const values = {};
  // 1. 不在後台的欄位與唯讀欄位：一律沿用舊版（review、id、slug…）
  for (const [k, v] of Object.entries(prev)) {
    if (!EDITABLE_PRODUCT_KEYS.includes(k)) values[k] = clone(v);
  }
  for (const k of Object.keys(next)) {
    if (!EDITABLE_PRODUCT_KEYS.includes(k) && !CONTROL_KEYS.includes(k) && !(k in prev)) warnings.push(`忽略後台新增的未知欄位 ${k}`);
  }
  // 2. 可修改欄位
  for (const k of EDITABLE_PRODUCT_KEYS) {
    if (k in next) values[k] = next[k];
    else if (k in prev && isEmptyish(prev[k])) values[k] = clone(prev[k]);
    else if (k in PRODUCT_DEFAULTS) values[k] = PRODUCT_DEFAULTS[k];
    else if (k in prev) values[k] = DELETE;
  }
  values.variants = normalizeVariants(prev.variants || [], values.variants || []);
  values.images = normalizeImages(prev.images || [], values.images || [], values.name_zh || prev.name_zh);
  values.specifications = normalizeSpecs(prev.specifications || [], values.specifications || []);
  if (Array.isArray(values.tags)) values.tags = values.tags.filter(t => typeof t === 'string' && t.trim());

  const p = ordered(prev, values);
  const extra = [];

  // 3. 分類與品牌：後台新增的商品（review.source = cms）沒有選分類時自動判斷；原有商品清空分類時還原
  if (!p.primary_category_id) {
    if (isCmsCreated(p)) autoFill(p, extra, warnings, ctx);
    else if (prev.primary_category_id) { p.primary_category_id = prev.primary_category_id; p.subcategory_id = prev.subcategory_id ?? null; warnings.push('主分類不可清空，已還原'); }
  } else if (p.subcategory_id && ctx.categories && !ctx.categories.find(c => c.id === p.primary_category_id)?.subcategories.some(s => s.id === p.subcategory_id)) {
    // 子分類與主分類不符：後台新增的商品以子分類為準修正主分類
    const owner = ctx.categories.find(c => c.subcategories.some(s => s.id === p.subcategory_id));
    if (isCmsCreated(p) && owner) { extra.push(`主分類依子分類修正：${p.primary_category_id} → ${owner.id}`); p.primary_category_id = owner.id; }
  }
  if (isCmsCreated(p) && !p.brand && ctx.products) {
    const b = detectBrand(p.name_zh, ctx.products.map(x => x.brand));
    if (b) { p.brand = b; extra.push(`自動判斷品牌：${b}`); }
  }

  // 4. 價格規則
  applyPriceRule(p, warnings);

  // 5. 新商品審核：只有後台新增的草稿可以在後台勾選審核（蝦皮匯入、退件商品仍需另外核對）
  if (next.approve_publish === true && p.review?.status !== 'approved') {
    if (!isCmsCreated(p) || p.review?.status !== 'draft') warnings.push('「新商品審核」只適用於從後台新增的商品，此商品未變更審核狀態');
    else if (!p.primary_category_id) warnings.push('尚未選擇主分類，無法審核；請先選分類再勾選審核');
    else {
      p.review = { ...p.review, status: 'approved', approved_at: today || p.review.approved_at, approved_by: ctx.operator || p.review.created_by || null };
      extra.push('新商品審核通過（可以上架）');
    }
  }

  // 6. 上架守門：只有 review.status = approved 才能公開
  if (p.published && p.review?.status !== 'approved') {
    p.published = false;
    warnings.push(`此商品尚未核准（review：${p.review?.status || '無'}），已自動退回草稿，不會公開`);
  }

  // 7. 庫存數量不可寫入公開 repo
  if ('stock_qty' in next || (next.variants || []).some(v => v && 'stock_qty' in v)) warnings.push('庫存數量屬機密，不會存到公開網站資料（第二階段改由私有資料庫管理），已忽略');

  const changes = [...diffProduct(prev, p).filter(c => !extra.some(e => e.startsWith('自動判斷品牌') && c.startsWith('品牌：'))), ...extra];
  if (changes.length && today) p.updated_at = today;
  return { product: p, changes, warnings };
}

export const isCmsCreated = p => p?.review?.source === 'cms';

// 分類自動判斷（以現有已上架商品為範例）
function autoFill(p, extra, warnings, ctx) {
  if (!ctx.categories) return;
  if (p.subcategory_id) {
    const owner = ctx.categories.find(c => c.subcategories.some(s => s.id === p.subcategory_id));
    if (owner) { p.primary_category_id = owner.id; extra.push(`主分類依子分類自動填入：${owner.name}`); return; }
  }
  const examples = (ctx.products || []).filter(x => x.id !== p.id && x.primary_category_id && x.review?.status === 'approved');
  const r = classify(p, examples, ctx.categories);
  if (!r) { p.primary_category_id = null; p.subcategory_id = null; warnings.push('無法自動判斷分類，請在後台選擇主分類與子分類'); return; }
  const c = ctx.categories.find(x => x.id === r.primary_category_id);
  const sub = c.subcategories.find(x => x.id === r.subcategory_id);
  p.primary_category_id = c.id; p.subcategory_id = sub ? sub.id : null;
  extra.push(`自動分類：${c.name}${sub ? '／' + sub.name : ''}（依${r.method}判斷，請確認）`);
}

// 後台新增的商品：產生商品 ID、網址代稱與初始資料（草稿、待審核）
export function newProductId(today, taken = new Set()) {
  const d = String(today || '').replace(/-/g, '').slice(2, 8) || '000000';
  let id;
  do { id = `ewp-${d}-${crypto.randomBytes(2).toString('hex')}`; } while (taken.has(id));
  return id;
}
export function uniqueSlug(name, id, takenSlugs = new Set()) {
  const base = slugify(name || '', id);
  let slug = base, n = 2;
  while (takenSlugs.has(slug)) slug = `${base}-${n++}`;
  return slug;
}
export function blankProduct({ id, slug, today, operator }) {
  return {
    id, slug, name_zh: '', sku: null, brand: null, manufacturer_model: null, seller_role: 'retail',
    primary_category_id: null, subcategory_id: null, tags: [], compatible_sizes: [], video_system: null, battery_cells: [],
    short_description: '', description: '', specifications: [], images: [], variants: [],
    price_twd: null, price_display: 'fixed', availability: 'unknown', shopee_url: null, shopee_item_id: null,
    line_inquiry_enabled: true, featured: false, published: false, updated_at: today,
    review: { status: 'draft', source: 'cms', created_at: today, created_by: operator || null },
  };
}
export function createCmsProduct(next, { today, operator, products = [], categories } = {}) {
  const id = newProductId(today, new Set(products.map(p => p.id)));
  const slug = uniqueSlug(next?.name_zh, id, new Set(products.map(p => p.slug)));
  const prev = blankProduct({ id, slug, today, operator });
  // 必填欄位沒有送來時（正常情況 Pages CMS 會帶預設值）使用安全的預設值
  const r = normalizeCmsProduct(prev, { availability: 'unknown', price_display: 'fixed', ...(next || {}) }, { today, operator, products, categories });
  r.changes.unshift(`後台新增商品（草稿，待審核）：${id}`);
  return r;
}

// 價格規則（與 approve-snapshot.mjs 一致）：有規格價格時，商品價＝最低規格價；單一價＝定價、多價＝起價；
// 詢價時清空商品價；沒有任何有效價格時改為詢價。
export function applyPriceRule(p, warnings = []) {
  if (p.price_display === 'inquiry') { p.price_twd = null; return p; }
  const prices = (p.variants || []).map(v => v.price_twd).filter(n => typeof n === 'number' && n > 0);
  if (prices.length) {
    const min = Math.min(...prices); const max = Math.max(...prices);
    p.price_twd = min;
    p.price_display = min === max ? 'fixed' : 'from';
  } else if (!(typeof p.price_twd === 'number' && p.price_twd > 0)) {
    p.price_twd = null;
    p.price_display = 'inquiry';
    warnings.push('沒有填售價，已改為「詢價」');
  }
  return p;
}

// 給報表用的變更摘要（只列後台可改欄位）
export function diffProduct(prev, next) {
  const out = [];
  const label = { name_zh: '名稱', published: '上架', availability: '供貨', price_display: '價格顯示', price_twd: '售價', brand: '品牌', manufacturer_model: '型號', sku: 'SKU', primary_category_id: '主分類', subcategory_id: '子分類', short_description: '簡介', description: '說明', specifications: '規格表', tags: '標籤', featured: '精選', line_inquiry_enabled: 'LINE 按鈕', cta_primary: '第一按鈕' };
  const show = v => (v === undefined ? '（無）' : typeof v === 'string' ? (v.length > 30 ? v.slice(0, 30) + '…' : v) : JSON.stringify(v));
  for (const k of EDITABLE_PRODUCT_KEYS) {
    if (k === 'variants' || k === 'images') continue;
    if (!same(prev[k], next[k])) out.push(['specifications', 'description'].includes(k) ? `${label[k]}已修改` : `${label[k] || k}：${show(prev[k])} → ${show(next[k])}`);
  }
  const pv = prev.variants || []; const nv = next.variants || [];
  const key = v => v.shopee_variation_id || v.key || v.name;
  for (const v of nv) {
    const o = pv.find(x => key(x) === key(v));
    if (!o) { out.push(`新增規格「${v.name}」`); continue; }
    for (const k of EDITABLE_VARIANT_KEYS) if (!same(o[k], v[k])) out.push(`規格「${v.name}」${({ name: '名稱', price_twd: '售價', availability: '供貨', sku: 'SKU' })[k]}：${show(o[k])} → ${show(v[k])}`);
  }
  for (const o of pv) if (!nv.find(x => key(x) === key(o))) out.push(`刪除規格「${o.name}」`);
  const pi = (prev.images || []).map(i => i.src); const ni = (next.images || []).map(i => i.src);
  if (!same(pi, ni)) out.push(`照片：${pi.length} 張 → ${ni.length} 張${pi.length === ni.length ? '（順序或內容變更）' : ''}`);
  else if (!same(prev.images, (next.images || []).map(({ _needs_processing, ...r }) => r))) out.push('照片說明或使用權已修改');
  return out;
}

// 與 writeJSON 相同的格式（2 空白縮排＋結尾換行），讓 git diff 只顯示真正的變更
export function serializeProduct(p) {
  const { _needs_processing, ...rest } = p; // eslint-disable-line no-unused-vars
  return JSON.stringify(stripInternal(rest), null, 2) + '\n';
}
function stripInternal(p) {
  return { ...p, images: (p.images || []).map(({ _needs_processing, ...r }) => r) }; // eslint-disable-line no-unused-vars
}
