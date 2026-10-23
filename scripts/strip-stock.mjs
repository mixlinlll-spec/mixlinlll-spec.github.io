#!/usr/bin/env node
// 把「真實庫存數量」從公開 repo 的資料中移除（EWP 決定庫存保密，2026-10-23）。
// 移除：商品／規格的 stock_qty、review.shopee_sales_snapshot 的 rows[].stock 與 stock_total、
//       src/data/shopee/service-listings.json 的 sales[].stock。
// 保留：供貨狀態（現貨／預購／缺貨／接單製作）、價格、規格對應等公開資訊。
// 過去 commit 中的數字仍在 Git 歷史；第二階段匯入 D1 時用 scripts/export-stock-for-d1.mjs 從歷史版本取出。
//   node scripts/strip-stock.mjs [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, PRODUCTS_DIR, readJSON, writeJSON } from './lib/data.mjs';

const dry = process.argv.includes('--dry-run');
let files = 0, fields = 0;
export function stripStock(p) {
  let n = 0;
  if ('stock_qty' in p) { delete p.stock_qty; n++; }
  for (const v of p.variants || []) if ('stock_qty' in v) { delete v.stock_qty; n++; }
  const snap = p.review?.shopee_sales_snapshot;
  if (snap) {
    if ('stock_total' in snap) { delete snap.stock_total; n++; }
    for (const r of snap.rows || []) if ('stock' in r) { delete r.stock; n++; }
  }
  return n;
}
for (const f of fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.json'))) {
  const file = path.join(PRODUCTS_DIR, f);
  const p = readJSON(file);
  const n = stripStock(p);
  if (n) { files++; fields += n; if (!dry) writeJSON(file, p); }
}
const svcFile = path.join(DATA_DIR, 'shopee', 'service-listings.json');
if (fs.existsSync(svcFile)) {
  const svc = readJSON(svcFile); let n = 0;
  for (const l of Object.values(svc.listings || {})) for (const r of l.sales || []) if ('stock' in r) { delete r.stock; n++; }
  if (n) { files++; fields += n; if (!dry) writeJSON(svcFile, svc); }
}
console.log(`${dry ? '（dry-run）' : '✓'} 移除庫存數量：${files} 個檔案、${fields} 個欄位`);
