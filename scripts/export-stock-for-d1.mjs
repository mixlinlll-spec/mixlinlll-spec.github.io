#!/usr/bin/env node
// 第二階段用：把公開 repo「歷史版本」中的蝦皮庫存快照匯出成 Cloudflare D1 的初始庫存資料。
// 輸出檔必須放在 repo 外（例如 ~/ewp-private/），不可提交到 GitHub。
//
//   node scripts/export-stock-for-d1.mjs --out ~/ewp-private/stock-seed [--rev 3dc1916]
//     → stock-seed.csv（sku、商品、規格、庫存、快照時間）
//     → stock-seed.sql（UPDATE skus SET stock_on_hand…＋inventory_ledger 紀錄，對應 docs/ecommerce/schema.sql）
//
// 注意：快照是 2026-10-22 蝦皮匯出當下的數字，不是即時庫存；匯入 D1 前請與實際盤點核對。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib/data.mjs';

const args = process.argv.slice(2);
const opt = k => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const rev = opt('--rev') || '3dc1916'; // 移除庫存前最後一個含快照庫存的 main 版本
const outArg = opt('--out');
if (!outArg) { console.error('用法：node scripts/export-stock-for-d1.mjs --out <repo 以外的路徑前綴> [--rev <commit>]'); process.exit(2); }
const out = path.resolve(outArg.replace(/^~(?=\/)/, process.env.HOME || '~'));
if (out === ROOT || out.startsWith(ROOT + path.sep)) { console.error('✖ 輸出位置不可在 repo 內（庫存屬機密，repo 公開）'); process.exit(1); }

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 << 20 });
const files = git('ls-tree', '--name-only', `${rev}:src/data/products`).split('\n').filter(f => f.endsWith('.json'));
const rows = [];
for (const f of files) {
  const p = JSON.parse(git('show', `${rev}:src/data/products/${f}`));
  const snap = p.review?.shopee_sales_snapshot;
  for (const r of snap?.rows || []) {
    if (r.stock == null) continue;
    const vid = r.variation_id || '0';
    rows.push({ sku: `EWP-SP${p.shopee_item_id}-${vid}`, product_id: p.id, item: p.shopee_item_id, variation: r.variation_id || '', name: r.name || '', stock: r.stock, captured_at: snap.captured_at || '' });
  }
}
const q = s => `'${String(s).replace(/'/g, "''")}'`;
const csv = ['sku,product_id,shopee_item_id,shopee_variation_id,variant_name,stock_on_hand,captured_at',
  ...rows.map(r => [r.sku, r.product_id, r.item, r.variation, `"${r.name.replace(/"/g, '""')}"`, r.stock, r.captured_at].join(','))].join('\n') + '\n';
const now = new Date().toISOString();
const sql = ['-- 由 export-stock-for-d1.mjs 產生；蝦皮快照庫存（非即時），匯入前請核對實際盤點', 'BEGIN TRANSACTION;',
  ...rows.flatMap(r => [
    `UPDATE skus SET stock_on_hand = ${Number(r.stock)}, updated_at = ${q(now)} WHERE sku = ${q(r.sku)};`,
    `INSERT INTO inventory_ledger (sku, delta_on_hand, reason, actor, note, created_at) SELECT ${q(r.sku)}, ${Number(r.stock)}, 'sync', 'seed', ${q('蝦皮快照 ' + r.captured_at)}, ${q(now)} WHERE EXISTS (SELECT 1 FROM skus WHERE sku = ${q(r.sku)});`,
  ]), 'COMMIT;'].join('\n') + '\n';
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out + '.csv', csv); fs.writeFileSync(out + '.sql', sql);
console.log(`✓ ${rows.length} 筆庫存（版本 ${rev}）→ ${out}.csv、${out}.sql（請勿提交到 GitHub）`);
