#!/usr/bin/env node
// 產生「商品清單 → 私有庫存資料庫（D1）」的同步 SQL。只更新商品名稱、規格、官網供貨狀態等公開資訊，
// 絕不修改庫存數字（stock_on_hand／stock_reserved）或異動紀錄。由 .github/workflows/inventory.yml 部署時執行。
//
//   node scripts/inventory-catalog-sql.mjs --out <檔案> [--snapshot-rev 3dc1916] [--products-dir <資料夾>] [--require-normalized]
//
// 規格身分（variant_ref）不因改名、排序改變：
//   sv:<蝦皮規格ID>  有蝦皮規格 ID 的規格
//   k:<key>          沒有蝦皮規格 ID 的規格（商品資料 variants[].key，由商品後台產生、永不改變）
//   single           沒有規格的商品
// SKU 代碼在第一次建立後不再改變；舊版（以規格名稱雜湊產生）的 SKU 會被「認領」到對應的規格，庫存與紀錄原封不動。
// 商品資料中消失的規格只會停用（庫存與紀錄保留，可在庫存後台「已停用」移轉或出庫）。
//
// 安全檢查（任何一項失敗就不輸出 SQL，D1 完全不變）：
//   - 商品資料必須通過驗證（scripts/lib/data.mjs）
//   - 每個沒有蝦皮規格 ID 的規格都必須有 key
//   - --require-normalized：不可有尚未校正的商品後台儲存（scripts/cms-normalize.mjs --pending-count）
// 輸出檔含舊快照參考值，只能寫到 repo 外（例如 $RUNNER_TEMP），不可提交。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ROOT, PRODUCTS_DIR, DATA_DIR, readJSON, validateProducts } from './lib/data.mjs';

const args = process.argv.slice(2);
const opt = k => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const out = opt('--out') && path.resolve(opt('--out'));
const snapRev = opt('--snapshot-rev');
const productsDir = path.resolve(opt('--products-dir') || PRODUCTS_DIR);
const fail = (msg, code = 1) => { console.error(`✖ ${msg}`); process.exit(code); };
if (!out) fail('用法：node scripts/inventory-catalog-sql.mjs --out <repo 以外的檔案> [--snapshot-rev <commit>] [--products-dir <資料夾>] [--require-normalized]', 2);
if (out.startsWith(ROOT + path.sep)) fail('輸出檔不可在 repo 內');

const itemOf = p => p.shopee_item_id || p.id.replace(/^sp-/, '');
export function refFor(v) {
  if (!v) return 'single';
  if (v.shopee_variation_id) return `sv:${v.shopee_variation_id}`;
  if (v.key) return `k:${v.key}`;
  return null;
}
// 蝦皮匯入的商品：EWP-SP<蝦皮商品 ID>-…；後台新增的商品（ewp-日期-亂碼）：EWP-<日期>-<亂碼>-…
const skuBase = p => (p.shopee_item_id || /^sp-/.test(p.id) ? `EWP-SP${itemOf(p)}` : `EWP-${p.id.replace(/^ewp-/, '').toUpperCase()}`);
export function skuFor(p, v) {
  if (!v) return `${skuBase(p)}-0`;
  if (v.shopee_variation_id) return `${skuBase(p)}-${v.shopee_variation_id}`;
  return `${skuBase(p)}-${v.key}`;
}
// 舊版 SKU 代碼（只用來認領既有資料列，不再產生）
const legacyHashSku = (p, v) => `EWP-SP${itemOf(p)}-V${crypto.createHash('sha1').update(v.name || '').digest('hex').slice(0, 8)}`;

// 1. 商品資料必須完整、通過驗證
const files = fs.readdirSync(productsDir).filter(f => f.endsWith('.json')).sort();
const all = files.map(f => ({ ...readJSON(path.join(productsDir, f)), _file: f }));
const { categories } = readJSON(path.join(DATA_DIR, 'categories.json'));
const { errors } = validateProducts(all, categories);
if (errors.length) fail(`商品資料未通過驗證，不同步：\n  ${errors.slice(0, 10).join('\n  ')}`);
const missing = all.flatMap(p => (p.variants || []).filter(v => !refFor(v)).map(v => `${p.id}「${v.name}」`));
if (missing.length) fail(`以下規格沒有蝦皮規格 ID 也沒有識別碼 key（請先合併商品後台 PR #4），不同步：\n  ${missing.join('\n  ')}`);

// 2. 不可同步尚未校正的商品後台儲存
if (args.includes('--require-normalized')) {
  const script = process.env.EWP_PENDING_SCRIPT || path.join(ROOT, 'scripts', 'cms-normalize.mjs'); // 測試可替換
  if (fs.existsSync(script)) {
    const pending = Number(execFileSync('node', [script, '--pending-count'], { cwd: ROOT, encoding: 'utf8' }).trim());
    if (pending !== 0) fail(`有 ${pending} 筆商品後台儲存尚未校正，暫不同步（校正完成後會自動再同步）`, 3);
  }
}

// 歷史快照：{ 商品ID: { 規格ID或'': 數量 } }（只作「參考值」）
function loadSnapshot(rev) {
  const map = new Map();
  if (!rev) return { map, at: null };
  let at = null;
  const names = execFileSync('git', ['ls-tree', '--name-only', `${rev}:src/data/products`], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(f => f.endsWith('.json'));
  for (const f of names) {
    const p = JSON.parse(execFileSync('git', ['show', `${rev}:src/data/products/${f}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }));
    const snap = p.review?.shopee_sales_snapshot;
    if (!snap?.rows) continue;
    at = at || snap.captured_at || null;
    const m = new Map();
    for (const r of snap.rows) if (Number.isInteger(r.stock)) m.set(String(r.variation_id || ''), r.stock);
    map.set(p.id, m);
  }
  return { map, at };
}

const q = v => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const now = new Date().toISOString();
const { map: snap, at: snapAt } = loadSnapshot(snapRev);
const products = all.filter(p => p.review?.status !== 'rejected');

const sql = ['-- 由 scripts/inventory-catalog-sql.mjs 產生：只同步商品清單，不修改庫存數字與異動紀錄'];
const refKeys = [];
let skuCount = 0, snapCount = 0;
for (const p of products) {
  sql.push(`INSERT INTO products (id, name, slug, brand, shopee_item_id, availability, published, active, synced_at) VALUES (${[p.id, p.name_zh, p.slug, p.brand, p.shopee_item_id, p.availability, p.published ? 1 : 0, 1, now].map(q).join(', ')})
  ON CONFLICT(id) DO UPDATE SET name = excluded.name, slug = excluded.slug, brand = excluded.brand, shopee_item_id = excluded.shopee_item_id, availability = excluded.availability, published = excluded.published, active = 1, synced_at = excluded.synced_at;`);
  const variants = p.variants?.length ? p.variants : [null];
  variants.forEach((v, i) => {
    const ref = refFor(v);
    const sku = skuFor(p, v);
    refKeys.push(`${p.id}|${ref}`);
    skuCount++;
    // 認領沒有身分的舊資料列（舊版 SKU 代碼），庫存與紀錄原封不動
    const candidates = [sku];
    if (v && !v.shopee_variation_id) candidates.push(legacyHashSku(p, v));
    sql.push(`UPDATE skus SET variant_ref = ${q(ref)} WHERE variant_ref IS NULL AND product_id = ${q(p.id)} AND sku IN (${candidates.map(q).join(', ')})
  AND NOT EXISTS (SELECT 1 FROM skus x WHERE x.product_id = ${q(p.id)} AND x.variant_ref = ${q(ref)});`);
    const ps = snap.get(p.id);
    const sq = ps ? (v ? ps.get(String(v.shopee_variation_id || '')) : (ps.get('') ?? (ps.size === 1 ? [...ps.values()][0] : undefined))) : undefined;
    if (sq != null) snapCount++;
    sql.push(`INSERT INTO skus (sku, product_id, variant_ref, variant_name, position, shopee_item_id, shopee_variation_id, site_availability, active, snapshot_qty, snapshot_at, updated_at) VALUES (${[sku, p.id, ref, v ? v.name : null, i, p.shopee_item_id, v?.shopee_variation_id || null, v?.availability || p.availability, 1, sq ?? null, sq != null ? snapAt : null, now].map(q).join(', ')})
  ON CONFLICT(product_id, variant_ref) DO UPDATE SET variant_name = excluded.variant_name, position = excluded.position, shopee_item_id = excluded.shopee_item_id, shopee_variation_id = excluded.shopee_variation_id, site_availability = excluded.site_availability, active = 1,
    snapshot_qty = coalesce(skus.snapshot_qty, excluded.snapshot_qty), snapshot_at = coalesce(skus.snapshot_at, excluded.snapshot_at);`);
  });
}
// 商品資料中已不存在的商品／規格：停用（保留庫存與紀錄，不刪除）
sql.push(`UPDATE skus SET active = 0 WHERE (product_id || '|' || coalesce(variant_ref, '')) NOT IN (${refKeys.map(q).join(', ')});`);
sql.push(`UPDATE products SET active = 0 WHERE id NOT IN (${products.map(p => q(p.id)).join(', ')});`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, sql.join('\n') + '\n');
fs.writeFileSync(out + '.count', String(products.length)); // 給部署流程做「商品數驟減」檢查
// 只輸出筆數，不輸出任何數量
console.log(`✓ 商品 ${products.length} 件、規格 ${skuCount} 個${snapRev ? `（舊快照參考值 ${snapCount} 筆）` : ''} → ${out}`);
