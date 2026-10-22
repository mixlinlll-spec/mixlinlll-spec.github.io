#!/usr/bin/env node
// 蝦皮銷售資訊（價格／庫存）CSV 匯入（後台「匯入蝦皮 CSV」按鈕 → .github/workflows/admin-import.yml）
//
//   node scripts/admin-import.mjs --file admin/imports/sales.csv [--fields price_stock|price|stock] [--discount 4] [--apply]
//
// - 以 shopee_item_id／shopee_variation_id 對應商品與規格；找不到、格式錯誤的資料列列入錯誤報告。
// - 官網價＝蝦皮價 ×（1 − 折扣%）四捨五入。庫存寫入 stock_qty（官網可售庫存的「匯入值」），
//   同時更新 review.shopee_sales_snapshot。蝦皮匯出檔是某個時間點的快照，不是即時庫存。
// - 不會改變上架狀態，也不會新增商品。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PRODUCTS_DIR, readJSON, writeJSON, parseCSVRows, today } from './lib/data.mjs';
import { parseShopeeSales, applyShopeeSales } from './lib/admin.mjs';

const args = process.argv.slice(2);
const opt = k => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const payload = process.env.PAYLOAD ? JSON.parse(process.env.PAYLOAD) : null;
const inp = payload?.inputs || {};
let file = opt('--file') ?? inp.file ?? '';
const fields = opt('--fields') ?? inp.fields ?? 'price_stock';
const discount = Number(opt('--discount') ?? inp.discount ?? 4);
const apply = args.includes('--apply') || inp.mode === 'apply';
const operator = payload?.triggeredBy?.name || payload?.triggeredBy?.githubUsername || '本機';

const out = [];
const finish = code => {
  const md = out.join('\n');
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
  fs.writeFileSync('.admin-result.json', JSON.stringify({ operator, file, fields, apply, code }));
  process.exit(code);
};
out.push(`## 蝦皮 CSV 匯入${apply ? '（已套用）' : '（預覽，未修改）'}`, '', `操作者：${operator}｜檔案：${file}｜更新：${({ price_stock: '價格與庫存', price: '價格', stock: '庫存' })[fields] || fields}｜折扣：${discount}%`, '');

// 只允許 admin/imports/ 底下的 .csv
file = String(file).trim().replace(/^\/+/, '');
if (!file.startsWith('admin/imports/')) file = `admin/imports/${file}`;
const abs = path.resolve(ROOT, file);
if (!abs.startsWith(path.join(ROOT, 'admin', 'imports') + path.sep) || !/\.csv$/i.test(abs)) { out.push('✖ 只能匯入 admin/imports/ 底下的 .csv 檔'); finish(1); }
if (!fs.existsSync(abs)) { out.push(`✖ 找不到 ${file}，請先在後台「匯入檔」上傳`); finish(1); }
if (!['price_stock', 'price', 'stock'].includes(fields)) { out.push(`✖ 不支援的欄位設定 ${fields}`); finish(1); }
if (!(discount >= 0 && discount < 50)) { out.push('✖ 折扣必須是 0–50 之間'); finish(1); }

const parsed = parseShopeeSales(parseCSVRows(fs.readFileSync(abs, 'utf8')));
if (parsed.error) { out.push(`✖ ${parsed.error}`, '', '提示：請用蝦皮賣家中心「大量更新 → 銷售資訊」下載的檔案，以 Excel 另存為「CSV UTF-8」。'); finish(1); }

const files = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.json')).sort();
const products = files.map(f => readJSON(path.join(PRODUCTS_DIR, f)));
const { results, notFound } = applyShopeeSales(products, parsed.items, { fields, discount, capturedAt: new Date().toISOString() });

const changed = results.filter(r => r.changed);
const errors = [...parsed.bad.filter(b => !b.reason.startsWith('略過')), ...notFound, ...results.flatMap(r => r.rowErrors)];
out.push(`資料列 ${parsed.items.length} 筆；對應到 ${results.length} 件商品；${apply ? '已更新' : '將更新'} ${changed.length} 件；錯誤／找不到 ${errors.length} 筆。`, '');
if (changed.length) {
  out.push('### 變更', '', '| 商品 | ID | 內容 |', '|---|---|---|');
  for (const r of changed.slice(0, 300)) out.push(`| ${r.name} | ${r.id} | ${r.log.join('；') || '更新快照'} |`);
  if (changed.length > 300) out.push(`…另 ${changed.length - 300} 件`);
  out.push('');
}
if (errors.length) {
  out.push('### 錯誤報告', '', '| CSV 列 | 原因 |', '|---|---|');
  for (const e of errors.slice(0, 300)) out.push(`| ${e.line} | ${e.reason} |`);
  out.push('');
}
if (apply) {
  for (const r of changed) { r.product.updated_at = today(); writeJSON(path.join(PRODUCTS_DIR, `${r.id}.json`), r.product); }
  fs.rmSync(abs); // 匯入檔處理完就刪除，不留在公開 repo
  out.push(`已刪除匯入檔 ${file}。`);
} else out.push('確認無誤後，再按一次「匯入蝦皮 CSV」並把模式改為「套用」。');
finish(0);
