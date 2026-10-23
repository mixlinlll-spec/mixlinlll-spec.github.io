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
  // 先用蝦皮規格 ID 對應舊資料；對不到的（新增規格或 ID 被竄改）再用相同位置對應尚未使用的舊規格
  const used = new Set();
  const match = nextList.map(v => {
    const i = v.shopee_variation_id ? prevList.findIndex((p, j) => !used.has(j) && p.shopee_variation_id && String(p.shopee_variation_id) === String(v.shopee_variation_id)) : -1;
    if (i >= 0) used.add(i);
    return i;
  });
  nextList.forEach((v, n) => {
    if (match[n] < 0 && n < prevList.length && !used.has(n) && (v.shopee_variation_id || !prevList[n].shopee_variation_id)) { match[n] = n; used.add(n); }
  });
  return nextList.map((v, n) => {
    const prev = match[n] >= 0 ? prevList[match[n]] : undefined;
    const out = pickEditable(prev, v, EDITABLE_VARIANT_KEYS, VARIANT_DEFAULTS);
    if (prev?.shopee_variation_id) out.shopee_variation_id = prev.shopee_variation_id; // 規格 ID 不可改
    else delete out.shopee_variation_id; // 新增的規格不可自行填蝦皮規格 ID
    return out;
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
export function normalizeCmsProduct(prev, next, { today } = {}) {
  const warnings = [];
  const values = {};
  // 1. 不在後台的欄位與唯讀欄位：一律沿用舊版（review、id、slug…）
  for (const [k, v] of Object.entries(prev)) {
    if (!EDITABLE_PRODUCT_KEYS.includes(k)) values[k] = clone(v);
  }
  for (const k of Object.keys(next)) {
    if (!EDITABLE_PRODUCT_KEYS.includes(k) && !(k in prev)) warnings.push(`忽略後台新增的未知欄位 ${k}`);
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

  // 3. 價格規則
  applyPriceRule(p, warnings);

  // 4. 上架守門：只有 review.status = approved 才能公開
  if (p.published && p.review?.status !== 'approved') {
    p.published = false;
    warnings.push(`此商品尚未核准（review：${p.review?.status || '無'}），已自動退回草稿，不會公開`);
  }

  // 5. 庫存數量不可寫入公開 repo
  if ('stock_qty' in next || (next.variants || []).some(v => v && 'stock_qty' in v)) warnings.push('庫存數量屬機密，不會存到公開網站資料（第二階段改由私有資料庫管理），已忽略');

  const changes = diffProduct(prev, p);
  if (changes.length && today) p.updated_at = today;
  return { product: p, changes, warnings };
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
  const key = v => v.shopee_variation_id || v.name;
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
