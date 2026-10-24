#!/usr/bin/env node
// 驗證「Pages CMS 後台開啟商品 → 儲存 → scripts/cms-normalize」不會遺失或改壞商品資料。
// 使用 Pages CMS 原始碼（固定版本）的實際讀取／驗證／merge／清理程式，而不是自己模擬。
//
// 用法（CI 見 .github/workflows/ci.yml）：
//   PAGES_CMS_DIR=<pages-cms 原始碼> CMS_DEPS_DIR=<含 zod、lodash.mergewith… 的資料夾> node tests/pages-cms-roundtrip.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { ROOT, PRODUCTS_DIR, loadAll, validateProducts } from '../scripts/lib/data.mjs';
import { normalizeCmsProduct, serializeProduct, CONTROL_KEYS, EDITABLE_PRODUCT_KEYS, READONLY_PRODUCT_KEYS, EDITABLE_VARIANT_KEYS, EDITABLE_IMAGE_KEYS, EDITABLE_SPEC_KEYS } from '../scripts/lib/cms.mjs';

const CMS = process.env.PAGES_CMS_DIR;
const DEPS = process.env.CMS_DEPS_DIR;
if (!CMS || !DEPS) { console.error('需要 PAGES_CMS_DIR 與 CMS_DEPS_DIR'); process.exit(2); }

// ---------- 打包 Pages CMS 程式（UI 元件換成空模組）----------
const req = createRequire(path.join(DEPS, 'node_modules', 'x.js'));
const esbuild = req('esbuild');
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pcms-')), 'harness.mjs');
const STUB = /(edit-component|view-component)$|^@\/lib\/api-client$|^@\/components\/|^react|^next\//;
await esbuild.build({
  entryPoints: [path.join(ROOT, 'tests', 'pages-cms', 'harness.ts')],
  bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  nodePaths: [path.join(DEPS, 'node_modules')],
  plugins: [{
    name: 'pages-cms',
    setup(b) {
      b.onResolve({ filter: STUB }, a => ({ path: a.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'module.exports = new Proxy({}, { get: () => function Stub() { return null; } });', loader: 'js' }));
      b.onResolve({ filter: /^@\// }, async a => {
        const base = path.join(CMS, a.path.slice(2));
        for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return { path: base + ext };
        return undefined;
      });
    },
  }],
});
const H = await import(pathToFileURL(out).href);

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; console.log('  ✓ ' + msg); };

// ---------- 1. .pages.yml 設定 ----------
const yml = fs.readFileSync(path.join(ROOT, '.pages.yml'), 'utf8');
const { config, parseErrors, validationErrors, issues } = H.loadConfig(yml);
console.log('1. .pages.yml');
ok(parseErrors.length === 0 && issues.length === 0 && validationErrors.filter(e => e.severity === 'error').length === 0,
  `設定檔通過 Pages CMS 驗證${issues.length ? '：' + issues.join('; ') : ''}${validationErrors.length ? '：' + JSON.stringify(validationErrors.map(e => e.message)) : ''}`);
ok(config.object.settings?.content?.merge === true, 'settings.content.merge = true（保留未列出的欄位）');
const products = config.object.content.find(c => c.name === 'products');
const fieldsOf = list => ({
  editable: list.filter(f => !f.readonly && !f.hidden).map(f => f.name).sort(),
  readonly: list.filter(f => f.readonly).map(f => f.name).sort(),
});
const top = fieldsOf(products.fields);
ok(JSON.stringify(top.editable) === JSON.stringify([...EDITABLE_PRODUCT_KEYS, ...CONTROL_KEYS].sort()), '後台可修改欄位與 scripts/lib/cms.mjs 一致（含「新商品審核」勾選）');
ok(JSON.stringify(top.readonly) === JSON.stringify([...READONLY_PRODUCT_KEYS].sort()), '唯讀欄位：id、slug、蝦皮商品 ID');
const sub = n => products.fields.find(f => f.name === n).fields;
ok(JSON.stringify(fieldsOf(sub('variants')).editable) === JSON.stringify([...EDITABLE_VARIANT_KEYS].sort()), '規格可修改欄位一致');
ok(JSON.stringify(fieldsOf(sub('images')).editable) === JSON.stringify([...EDITABLE_IMAGE_KEYS].sort()), '照片可修改欄位一致');
ok(JSON.stringify(fieldsOf(sub('specifications')).editable) === JSON.stringify([...EDITABLE_SPEC_KEYS].sort()), '規格表可修改欄位一致');
ok(products.operations?.create === true && products.operations?.delete === false && products.operations?.rename === false, '後台可以新增商品；不能刪除、改檔名（商品 ID 不變）');
ok(!products.fields.some(f => f.name === 'review'), 'review（審核）不在後台，無法一鍵核准');

// 商品列表：Pages CMS 以 filename 推算副檔名並過濾檔案。未設定 filename 時預設 .md，240 件 .json 會全部被濾掉（No entries）
{
  const files = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.json')).sort();
  const items = files.map(f => ({ name: f, path: `src/data/products/${f}`, content: fs.readFileSync(path.join(PRODUCTS_DIR, f), 'utf8') }));
  const list = H.listCollection(config, 'products', items);
  ok(list.schema.extension === 'json' && list.schema.format === 'json', `商品集合副檔名為 json（filename: ${list.schema.filename}）`);
  ok(list.contents.length === files.length && list.errors.length === 0, `商品列表顯示 ${list.contents.length} / ${files.length} 件、解析錯誤 0`);
  ok(list.contents.every(c => typeof c.fields.name_zh === 'string' && c.fields.name_zh), '每件商品都有名稱（列表主欄位）');
  const searchFields = (products.view.search || []).map(f => `fields.${f}`);
  const sample = JSON.parse(items.find(i => i.name === 'sp-25447731916.json').content);
  const hit = H.listCollection(config, 'products', items, { query: 'T15', fields: searchFields });
  ok(hit.contents.some(c => c.fields.id === 'sp-25447731916') && hit.contents.length < files.length, `搜尋「T15」找到 ${hit.contents.length} 件（含 ${sample.name_zh.slice(0, 12)}…）`);
  ok(H.listCollection(config, 'products', items, { query: sample.shopee_item_id, fields: searchFields }).contents.length === 1, '以蝦皮商品 ID 搜尋找到 1 件');
  ok(H.listCollection(config, 'products', items, { query: 'sp-25447731916', fields: searchFields }).contents.length === 1, '以商品 ID 搜尋找到 1 件');
  ok(H.checkSavePath(config, 'products', 'src/data/products/sp-25447731916.json') === null, '儲存路徑與副檔名檢查通過（.json）');
  const noFilename = H.loadConfig(yml.replace(/\n\s*filename: "new-[^"]*\.json"/, '')).config;
  ok(noFilename.object.content.find(c => c.name === 'products').filename !== products.filename, '對照組設定已移除 filename');
  const bad = H.listCollection(noFilename, 'products', items);
  ok(bad.contents.length === 0 && H.checkSavePath(noFilename, 'products', 'src/data/products/sp-25447731916.json'), '對照組：未設定 filename 時列表為 0 件（No entries）且儲存被拒');
}

// 實際資料中的每個陣列子欄位都必須在設定中（否則儲存時會被整個陣列覆蓋掉）
const files = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.json')).sort();
const all = files.map(f => [f, fs.readFileSync(path.join(PRODUCTS_DIR, f), 'utf8')]);
for (const arr of ['variants', 'images', 'specifications']) {
  const declared = new Set(sub(arr).map(f => f.name));
  const seen = new Set();
  for (const [, t] of all) for (const it of JSON.parse(t)[arr] || []) Object.keys(it).forEach(k => seen.add(k));
  const missing = [...seen].filter(k => !declared.has(k));
  ok(missing.length === 0, `${arr} 的所有子欄位都有在設定中宣告${missing.length ? '（缺 ' + missing.join(', ') + '）' : ''}`);
}

// ---------- 2. 不修改直接儲存：全部商品 ----------
console.log(`2. 全部 ${all.length} 件商品：開啟後不修改直接儲存`);
let rawDiff = 0, reviewLost = 0, finalDiff = 0; const finalDiffFiles = [];
for (const [f, text] of all) {
  const prev = JSON.parse(text);
  const form = H.readEntry(config, 'products', text);
  const saved = H.saveEntry(config, 'products', form, text);
  assert.ok(saved.ok, `${f} Pages CMS 驗證失敗：${saved.error}`);
  const raw = JSON.parse(saved.text);
  if (saved.text.trimEnd() !== text.trimEnd()) rawDiff++;
  if (prev.review && (!raw.review || raw.review.status !== prev.review.status || (prev.review.shopee_sales_snapshot && !raw.review.shopee_sales_snapshot))) reviewLost++;
  const { product, changes } = normalizeCmsProduct(prev, raw, { today: '2099-01-01' });
  if (serializeProduct(product) !== text || changes.length) { finalDiff++; if (finalDiffFiles.length < 5) finalDiffFiles.push(`${f}: ${changes.join('；') || '格式差異'}`); }
}
console.log(`  · 只用 Pages CMS（未校正）：${rawDiff} 件的檔案內容會改變（刪除 null／空陣列等）`);
ok(reviewLost === 0, 'merge 模式下 review（審核、蝦皮快照）不會被刪除');
ok(finalDiff === 0, `經 cms-normalize 校正後，${all.length} 件商品與原檔逐字相同${finalDiffFiles.length ? '\n    ' + finalDiffFiles.join('\n    ') : ''}`);

// 對照：若沒有開 merge，review 會整個消失（證明 merge 設定是必要的）
{
  const noMerge = H.loadConfig(yml.replace('merge: true', 'merge: false')).config;
  const [, text] = all[0];
  const s = H.saveEntry(noMerge, 'products', H.readEntry(noMerge, 'products', text), text);
  ok(!('review' in JSON.parse(s.text)), '對照組：關閉 merge 時 review 會被刪除（所以 merge 必須開啟）');
}

// ---------- 3. 實際操作情境 ----------
console.log('3. 操作情境');
const { categories } = loadAll();
const pick = fn => { const e = all.find(([, t]) => fn(JSON.parse(t))); assert.ok(e, '找不到測試用商品'); return e; };
const MULTI = pick(p => p.published && p.variants.length >= 3 && p.variants.some(v => v.image) && p.images.length >= 3 && new Set(p.variants.map(v => v.price_twd)).size > 1);
const REJECTED = pick(p => p.review?.status === 'rejected');
function edit([f, text], mutate) {
  const prev = JSON.parse(text);
  const form = H.readEntry(config, 'products', text);
  mutate(form);
  const saved = H.saveEntry(config, 'products', JSON.parse(JSON.stringify(form)), text);
  if (!saved.ok) return { error: saved.error };
  const r = normalizeCmsProduct(prev, JSON.parse(saved.text), { today: '2099-01-01' });
  const errs = validateProducts([{ ...r.product, _file: f }], categories).errors;
  return { prev, ...r, errs };
}
const without = (o, keys) => { const c = JSON.parse(JSON.stringify(o)); for (const k of keys) delete c[k]; return c; };
const sameExcept = (a, b, keys) => JSON.stringify(without(a, keys)) === JSON.stringify(without(b, keys));

{
  const r = edit(MULTI, f => { f.name_zh = f.name_zh + '（測試）'; });
  ok(r.product.name_zh.endsWith('（測試）') && sameExcept(r.prev, r.product, ['name_zh', 'updated_at']) && r.product.updated_at === '2099-01-01' && !r.errs.length, '修改名稱：只改名稱與更新日期，其餘（含 review、規格圖）完全不變');
}
{
  const r = edit(MULTI, f => { f.variants[0].price_twd = 1; });
  ok(r.product.variants[0].price_twd === 1 && r.product.price_twd === 1 && r.product.price_display === 'from' && sameExcept(r.prev.variants[1], r.product.variants[1], []) && !r.errs.length, '修改規格價格：該規格變更，商品價自動改為最低規格價「起」');
  ok(r.product.variants[0].shopee_variation_id === r.prev.variants[0].shopee_variation_id && JSON.stringify(r.product.variants[0].image) === JSON.stringify(r.prev.variants[0].image), '規格 ID 與規格圖保留');
}
{
  const r = edit(MULTI, f => { f.variants[1].stock_qty = 7; f.stock_qty = 3; f.variants[1].availability = 'out_of_stock'; f.availability = 'preorder'; });
  ok(r.product.variants[1].availability === 'out_of_stock' && r.product.availability === 'preorder' && !r.errs.length, '修改供貨狀態（現貨／預購／缺貨）');
  ok(!('stock_qty' in r.product) && !r.product.variants.some(v => 'stock_qty' in v), '竄改送出庫存數量：不會寫入公開資料（庫存保密）');
}
{
  const r = edit(MULTI, f => { f.price_display = 'inquiry'; });
  ok(r.product.price_display === 'inquiry' && r.product.price_twd === null && !r.errs.length, '改為詢價：商品價清為 null（不殘留舊價格）');
}
{
  const r = edit(MULTI, f => { f.published = false; });
  ok(r.product.published === false && !r.errs.length, '下架');
}
{
  const r = edit(REJECTED, f => { f.published = true; });
  ok(r.product.published === false && r.warnings.some(w => w.includes('尚未核准')) && !r.errs.length, '未核准商品勾選上架：自動退回草稿並提醒（無法繞過審核）');
}
{
  const r = edit(MULTI, f => { f.images.reverse(); });
  const a = JSON.stringify([...r.prev.images].reverse()); const b = JSON.stringify(r.product.images);
  ok(a === b && !r.errs.length, '照片拖曳排序：順序改變、每張照片的尺寸／使用權／縮圖完整保留');
}
{
  const r = edit(MULTI, f => { f.images.splice(1, 1); });
  ok(r.product.images.length === r.prev.images.length - 1 && !r.errs.length, '刪除一張照片');
}
{
  const r = edit(MULTI, f => { f.brand = ''; f.short_description = '一句話介紹'; });
  ok(r.product.brand === null && r.product.short_description === '一句話介紹' && !r.errs.length, '清空品牌（寫回 null）、填寫簡介');
}
{
  const r = edit(MULTI, f => { f.id = 'hacked'; f.slug = 'hacked'; f.review = { status: 'approved' }; f.variants[0].shopee_variation_id = '1'; });
  ok(r.product.id === r.prev.id && r.product.slug === r.prev.slug && JSON.stringify(r.product.review) === JSON.stringify(r.prev.review) && r.product.variants[0].shopee_variation_id === r.prev.variants[0].shopee_variation_id, '竄改送出的 id／slug／review／規格 ID：一律還原');
}
{
  const r = edit(MULTI, f => { f.variants.push({ name: '新規格', price_twd: 999, availability: 'preorder', stock_qty: 2 }); });
  const v = r.product.variants.at(-1);
  ok(v.name === '新規格' && v.price_twd === 999 && v.sku === null && !('shopee_variation_id' in v) && !r.errs.length, '新增規格');
}
// 規格識別碼（庫存後台以它對應 SKU）：改名、排序、刪除、新增都不能讓既有規格換身分
{
  const KEYED = pick(p => p.variants.length >= 2 && p.variants.every(v => !v.shopee_variation_id && v.key));
  const orig = JSON.parse(KEYED[1]).variants;
  let r = edit(KEYED, f => { f.variants[0].name = f.variants[0].name + '（改名）'; });
  ok(r.product.variants[0].key === orig[0].key && r.product.variants[0].name.endsWith('（改名）') && !r.errs.length, '規格改名：識別碼不變');
  r = edit(KEYED, f => { f.variants.reverse(); });
  ok(JSON.stringify(r.product.variants.map(v => [v.name, v.key])) === JSON.stringify([...orig].reverse().map(v => [v.name, v.key])) && !r.errs.length, '規格排序：識別碼跟著規格走');
  r = edit(KEYED, f => { f.variants.splice(0, 1); f.variants.push({ name: '新增規格', price_twd: 100, availability: 'preorder' }); });
  const keys = r.product.variants.map(v => v.key);
  ok(keys[0] === orig[1].key && /^v-[0-9a-f]{8}$/.test(keys[1]) && !orig.some(o => o.key === keys[1]) && !r.errs.length, '刪除一個、新增一個：保留的規格識別碼不變，新規格得到新的識別碼');
  r = edit(KEYED, f => { f.variants[1].key = f.variants[0].key; });
  ok(JSON.stringify(r.product.variants.map(v => v.key)) === JSON.stringify(orig.map(v => v.key)) && !r.errs.length, '竄改成重複的識別碼：還原為原本的識別碼，不會兩個規格共用');
}
{
  const r = edit(MULTI, f => { f.price_twd = 0; f.variants = []; f.price_display = 'fixed'; });
  ok(r.error || r.product.price_display === 'inquiry', '價格 0：後台擋下（最小值 1）或改為詢價，不會出現 0 元');
}

// 新增商品（Pages CMS 空白表單 → 儲存，沒有既有檔案）
const NEW_NAME = 'GNB 6S 1100mAh 120C LiPo 電池｜XT60｜5 吋花飛';
{
  const form = H.newEntry(config, 'products');
  ok(form.availability === 'in_stock' && form.price_display === 'fixed' && form.line_inquiry_enabled === true && form.approve_publish === false, '新增商品表單預設：現貨、定價、顯示 LINE 按鈕、未審核');
  form.name_zh = NEW_NAME; form.price_twd = 890;
  const fname = H.newFilename(config, 'products', form);
  ok(/^new-\d{8}-\d{6}\.json$/.test(fname) && H.checkSavePath(config, 'products', `src/data/products/${fname}`) === null, `新增商品檔名 ${fname}：副檔名與路徑檢查通過`);
  const saved = H.saveEntry(config, 'products', form, '', false);
  ok(saved.ok, `新增商品通過 Pages CMS 驗證（不選分類也可以儲存）${saved.ok ? '' : '：' + saved.error}`);
}

// ---------- 4. 端對端：Pages CMS commit → scripts/cms-normalize.mjs ----------
console.log('4. 端對端：後台 commit → cms-normalize（暫存 git 工作區）');
{
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'ewp-cms-'));
  const g = (...a) => execFileSync('git', a, { cwd: wt, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  // 只複製需要的檔案，建立獨立 repo（不動到目前的 repo）
  for (const d of ['scripts', 'src', '.pages.yml', 'package.json', 'assets/contact', 'assets/img/journal']) if (fs.existsSync(path.join(ROOT, d))) fs.cpSync(path.join(ROOT, d), path.join(wt, d), { recursive: true });
  const [mf] = MULTI; const [rf] = REJECTED;
  for (const f of [mf, rf]) { const id = f.replace('.json', ''); const d = path.join(ROOT, 'assets/img/products', id); if (fs.existsSync(d)) fs.cpSync(d, path.join(wt, 'assets/img/products', id), { recursive: true }); }
  if (fs.existsSync(path.join(ROOT, 'node_modules'))) fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(wt, 'node_modules'));
  g('init', '-q'); g('config', 'user.email', 't@example.com'); g('config', 'user.name', 'test');
  g('add', '-A'); g('commit', '-qm', 'base');
  const baseSha = g('rev-parse', 'HEAD').trim();
  const P = f => path.join(wt, 'src/data/products', f);
  const cmsSave = (f, mutate) => {
    const text = fs.readFileSync(P(f), 'utf8');
    const form = H.readEntry(config, 'products', text); mutate(form);
    const saved = H.saveEntry(config, 'products', JSON.parse(JSON.stringify(form)), text);
    assert.ok(saved.ok, saved.error);
    fs.writeFileSync(P(f), saved.text); // Pages CMS 寫出的檔案（沒有結尾換行、刪掉空值）
  };
  // (a) 上傳新照片（Pages CMS 上傳到媒體根目錄）＋改價格，(b) 一般 commit，(c) 未核准商品勾上架
  let sharpOk = true; try { await import('sharp'); } catch { sharpOk = false; }
  if (sharpOk) {
    const sharp = (await import('sharp')).default;
    await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#c8102e' } }).jpeg().toFile(path.join(wt, 'assets/img/products/IMG_0001.jpg'));
    g('add', '-A'); g('commit', '-qm', '[後台] 新增 IMG_0001.jpg（林志騰）');
  }
  cmsSave(mf, f => { f.variants[0].price_twd = 5; if (sharpOk) f.images.push({ src: 'assets/img/products/IMG_0001.jpg', alt: '', rights: 'ewp_own' }); });
  g('add', '-A'); g('commit', '-qm', `[後台] 更新 ${mf}（林志騰）`);
  cmsSave(rf, f => { f.published = true; });
  g('add', '-A'); g('commit', '-qm', `[後台] 更新 ${rf}（員工A）`);
  // 非後台 commit 不應被處理
  const other = files.find(f => f !== mf && f !== rf);
  fs.writeFileSync(P(other), fs.readFileSync(P(other), 'utf8').replace('"featured": false', '"featured": true'));
  g('add', '-A'); g('commit', '-qm', 'chore: 手動修改');
  // 一件改壞的商品（子分類不屬於主分類）：應被退回，不影響其他商品
  const bad = files.find(f => ![mf, rf, other].includes(f) && JSON.parse(fs.readFileSync(P(f), 'utf8')).primary_category_id !== 'fc-esc');
  const badOrig = fs.readFileSync(P(bad), 'utf8');
  cmsSave(bad, f => { f.subcategory_id = 'fc'; f.name_zh = '改壞的名稱'; });
  g('add', '-A'); g('commit', '-qm', `[後台] 更新 ${bad}（員工B）`);
  // 其他商品的圖片資料夾用連結補上，再以正式的資料驗證（build --check）檢查整個工作區
  for (const d of fs.readdirSync(path.join(ROOT, 'assets/img/products'))) {
    const t = path.join(wt, 'assets/img/products', d);
    if (!fs.existsSync(t)) fs.symlinkSync(path.join(ROOT, 'assets/img/products', d), t);
  }
  // (d) 後台新增商品（含上傳照片），不選分類
  let newFile;
  {
    const form = H.newEntry(config, 'products');
    form.name_zh = NEW_NAME; form.price_twd = 890;
    if (sharpOk) {
      const sharp = (await import('sharp')).default;
      await sharp({ create: { width: 800, height: 800, channels: 3, background: '#222' } }).jpeg().toFile(path.join(wt, 'assets/img/products/IMG_0002.jpg'));
      g('add', '-A'); g('commit', '-qm', '[後台] 新增 IMG_0002.jpg（林志騰）');
      form.images = [{ src: 'assets/img/products/IMG_0002.jpg', alt: '', rights: 'ewp_own' }];
    }
    newFile = H.newFilename(config, 'products', form);
    const saved = H.saveEntry(config, 'products', form, '', false);
    fs.writeFileSync(P(newFile), saved.text);
    g('add', '-A'); g('commit', '-qm', `[後台] 新增 ${newFile}（林志騰）`);
  }
  const sum = path.join(wt, 'summary.md');
  execFileSync('node', ['scripts/cms-normalize.mjs', '--summary', sum], { cwd: wt, encoding: 'utf8' });
  {
    const created = fs.readdirSync(path.join(wt, 'src/data/products')).filter(f => /^ewp-\d{6}-[0-9a-f]{4}\.json$/.test(f));
    ok(!fs.existsSync(P(newFile)) && created.length === 1, `新增商品：檔名改為正式商品 ID（${created[0]}），原本的 ${newFile} 已移除`);
    const n = JSON.parse(fs.readFileSync(P(created[0]), 'utf8'));
    ok(n.id === created[0].replace('.json', '') && n.slug && n.published === false && n.review.status === 'draft' && n.review.source === 'cms' && n.review.created_by === '林志騰', '新增商品：存成草稿、待審核，記錄建立者');
    ok(n.primary_category_id === 'power-battery' && n.subcategory_id === '6s', `新增商品：自動分類為 電池與電源／6S（${n.primary_category_id}/${n.subcategory_id}）`);
    ok(n.brand === null && n.price_twd === 890 && n.price_display === 'fixed' && Array.isArray(n.compatible_sizes) && n.seller_role === 'retail', '新增商品：價格、必要欄位齊全；品牌名稱不在現有清單時不亂填');
    if (sharpOk) ok(n.images[0].src.startsWith(`/assets/img/products/${n.id}/u-`) && !fs.existsSync(path.join(wt, 'assets/img/products/IMG_0002.jpg')), '新增商品：上傳照片轉 WebP 並搬到新商品資料夾');
    const notice = fs.readFileSync(path.join(wt, '.cms-notice.md'), 'utf8');
    ok(notice.includes(n.id) && notice.includes('自動分類') && notice.includes('新商品審核'), '新增商品：產生通知（自動分類結果與審核步驟）');
    // 第二次儲存：勾選「新商品審核」＋上架 → 核准並公開
    g('add', '-A'); g('commit', '-qm', 'chore(後台): 校正');
    cmsSave(created[0], f => { f.approve_publish = true; if (sharpOk) f.published = true; });
    g('add', '-A'); g('commit', '-qm', `[後台] 更新 ${created[0]}（林志騰）`);
    execFileSync('node', ['scripts/cms-normalize.mjs'], { cwd: wt, encoding: 'utf8' });
    const a = JSON.parse(fs.readFileSync(P(created[0]), 'utf8'));
    if (sharpOk) ok(a.review.status === 'approved' && a.review.approved_by === '林志騰' && a.published === true && !('approve_publish' in a), '勾選「新商品審核」＋上架：核准並公開；勾選欄位不寫入商品資料');
    else ok(a.review.status === 'approved' && !('approve_publish' in a), '勾選「新商品審核」：核准；勾選欄位不寫入商品資料');
    // 原有商品（蝦皮匯入）勾選審核：無效
    cmsSave(rf, f => { f.approve_publish = true; f.published = true; });
    g('add', '-A'); g('commit', '-qm', `[後台] 更新 ${rf}（員工E）`);
    execFileSync('node', ['scripts/cms-normalize.mjs'], { cwd: wt, encoding: 'utf8' });
    const rr = JSON.parse(fs.readFileSync(P(rf), 'utf8'));
    ok(rr.review.status === 'rejected' && rr.published === false, '原有未核准商品勾選「新商品審核」：無效，仍不能上架');
  }
  const m = JSON.parse(fs.readFileSync(P(mf), 'utf8'));
  const mPrev = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/products', mf), 'utf8'));
  ok(m.variants[0].price_twd === 5 && m.price_twd === 5 && JSON.stringify(m.review) === JSON.stringify(mPrev.review) && fs.readFileSync(P(mf), 'utf8').endsWith('}\n'), '後台改價格：校正後價格生效、review 完整、檔案格式還原');
  if (sharpOk) {
    const im = m.images.at(-1);
    ok(/^\/assets\/img\/products\/sp-\d+\/u-[0-9a-f]{10}\.webp$/.test(im.src) && im.src_small.endsWith('-480.webp') && im.width === 1000 && im.height === 750
      && fs.existsSync(path.join(wt, im.src)) && fs.existsSync(path.join(wt, im.src_small)) && !fs.existsSync(path.join(wt, 'assets/img/products/IMG_0001.jpg')) && im.alt.includes(m.name_zh),
      '新上傳照片：轉 WebP 1000px＋480px、搬到商品資料夾、刪除原始大檔、自動帶入說明');
  } else console.log('  · （本機沒有 sharp，略過照片轉檔檢查；CI 會執行）');
  const r = JSON.parse(fs.readFileSync(P(rf), 'utf8'));
  ok(r.published === false, '未核准商品從後台勾上架：校正後仍為草稿');
  ok(fs.readFileSync(P(other), 'utf8').includes('"featured": true'), '非後台 commit 不被校正程式更動');
  ok(fs.readFileSync(P(bad), 'utf8') === badOrig && fs.existsSync(path.join(wt, '.cms-quarantine', bad)) && fs.readFileSync(path.join(wt, '.cms-quarantine.md'), 'utf8').includes('員工B'),
    '改壞的商品被隔離：退回上一個正確版本、原始修改另存、通知列出原因與操作者；其他商品照常');
  const md = fs.readFileSync(sum, 'utf8');
  ok(md.includes('林志騰') && md.includes('員工A') && md.includes('尚未核准') && md.includes('→ 5'), '變更摘要列出操作者、時間、修改內容與警告');
  let checkOut = ''; let checkOk = true;
  try { checkOut = execFileSync('node', ['scripts/build.mjs', '--check'], { cwd: wt, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { checkOk = false; checkOut = (e.stdout || '') + (e.stderr || ''); }
  ok(checkOk, `校正後全部商品通過正式資料驗證${checkOk ? '' : '：' + checkOut.slice(-600)}`);
  // 競態：後台儲存後「立刻」有另一筆非後台 commit（最後一筆不是 [後台]），部署檢查仍必須發現尚未校正的儲存
  g('add', '-A'); g('commit', '-qm', 'chore(後台): 校正');
  const pend = () => Number(execFileSync('node', ['scripts/cms-normalize.mjs', '--pending-count'], { cwd: wt, encoding: 'utf8' }).trim());
  ok(pend() === 0, '部署檢查：全部校正後沒有待處理的後台儲存');
  cmsSave(rf, f => { f.name_zh = f.name_zh + '（競態測試）'; });
  g('add', '-A'); g('commit', '-qm', `[後台] 更新 ${rf}（員工D）`);
  fs.writeFileSync(path.join(wt, 'README.md'), 'race\n'); g('add', '-A'); g('commit', '-qm', 'docs: 同時間的一般修改');
  ok(g('log', '-1', '--format=%s').startsWith('docs:') && pend() === 1, '競態：最後一筆是非後台 commit，部署檢查仍發現 1 筆未校正的後台儲存 → 不部署');
  execFileSync('node', ['scripts/cms-normalize.mjs'], { cwd: wt, encoding: 'utf8' });
  g('add', '-A'); g('commit', '-qm', 'chore(後台): 校正');
  ok(pend() === 0 && JSON.parse(fs.readFileSync(P(rf), 'utf8')).name_zh.endsWith('（競態測試）'), '競態：校正提交後才可部署，修改內容保留');
  // 整批退回（驗證仍失敗時的後備程序）：commit 校正結果後，再做一次後台儲存並整批退回
  const before2 = fs.readFileSync(P(mf), 'utf8');
  cmsSave(mf, f => { f.name_zh = '整批退回測試'; });
  g('add', '-A'); g('commit', '-qm', `[後台] 更新 ${mf}（員工C）`);
  execFileSync('node', ['scripts/cms-normalize.mjs', '--quarantine-all'], { cwd: wt, encoding: 'utf8' });
  ok(fs.readFileSync(P(mf), 'utf8') === before2, '後備程序：整批退回到最後一個正確版本');
  fs.rmSync(wt, { recursive: true, force: true });
}

console.log(`\n✓ Pages CMS 往返測試全部通過（${passed} 項）`);
