#!/usr/bin/env node
// 蝦皮銷售資訊（價格／庫存）CSV 匯入 —— 目前只供本機使用（後台上傳按鈕已停用）
//
//   node scripts/admin-import.mjs --file ~/Downloads/sales.csv [--discount 4] [--apply]
//
// ⚠️ 匯入檔不可放進 repo（公開，且 Git 歷史刪不乾淨）：本工具拒絕讀取 repo 內的檔案。
//    後台安全上傳（Cloudflare R2 私有暫存＋短效上傳網址）規劃見 docs/admin/PRODUCT_ADMIN.md。
//
// - 以 shopee_item_id／shopee_variation_id 對應商品與規格；找不到、格式錯誤的資料列列入錯誤報告。
// - 官網價＝蝦皮價 ×（1 − 折扣%）四捨五入，同時更新 review.shopee_sales_snapshot 的價格。
// - 庫存數量屬機密（EWP 決定）：CSV 的庫存欄一律忽略，不寫入 repo；第二階段改寫入私有 D1。
// - 不會改變上架狀態，也不會新增商品。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PRODUCTS_DIR, readJSON, writeJSON, parseCSVRows, today } from './lib/data.mjs';
import { parseShopeeSales, applyShopeeSales } from './lib/admin.mjs';

const args = process.argv.slice(2);
const opt = k => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const inp = {};
const file = opt('--file') ?? '';
if (opt('--fields') && opt('--fields') !== 'price') { console.error('✖ 庫存數量屬機密，不能匯入公開 repo（第二階段改用 D1）。只支援價格。'); process.exit(1); }
const fields = 'price';
const discount = Number(opt('--discount') ?? inp.discount ?? 4);
const apply = args.includes('--apply') || inp.mode === 'apply';
const operator = '本機';

const out = [];
const finish = code => {
  const md = out.join('\n');
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
  fs.writeFileSync('.admin-result.json', JSON.stringify({ operator, file, fields, apply, code }));
  process.exit(code);
};
out.push(`## 蝦皮 CSV 匯入${apply ? '（已套用）' : '（預覽，未修改）'}`, '', `操作者：${operator}｜檔案：${file}｜更新：價格（庫存欄忽略，不寫入公開資料）｜折扣：${discount}%`, '');

// 匯入檔必須在 repo 外（避免被提交到公開 Git 歷史）
const abs = path.resolve(String(file).replace(/^~(?=\/)/, process.env.HOME || '~'));
if (!file) { out.push('✖ 請用 --file 指定 CSV 檔'); finish(1); }
if (abs === ROOT || abs.startsWith(ROOT + path.sep)) { out.push('✖ 匯入檔不可放在 repo 資料夾內（會被提交到公開 GitHub）。請放在其他資料夾，例如 ~/Downloads'); finish(1); }
if (!/\.csv$/i.test(abs) || !fs.existsSync(abs)) { out.push(`✖ 找不到 CSV 檔：${file}`); finish(1); }
if (!(discount >= 0 && discount < 50)) { out.push('✖ 折扣必須是 0–50 之間'); finish(1); }

const parsed = parseShopeeSales(parseCSVRows(fs.readFileSync(abs, 'utf8')));
if (parsed.error) { out.push(`✖ ${parsed.error}`, '', '提示：請用蝦皮賣家中心「大量更新 → 銷售資訊」下載的檔案，以 Excel 另存為「CSV UTF-8」。'); finish(1); }

const files = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.json')).sort();
const products = files.map(f => readJSON(path.join(PRODUCTS_DIR, f)));
const { results, notFound } = applyShopeeSales(products, parsed.items, { discount, capturedAt: new Date().toISOString() });

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
} else out.push('確認無誤後加上 --apply 執行。');
finish(0);
