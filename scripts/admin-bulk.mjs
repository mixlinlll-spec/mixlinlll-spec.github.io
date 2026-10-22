#!/usr/bin/env node
// 商品批次修改（後台「批次修改」按鈕 → .github/workflows/admin-bulk.yml）
//
//   node scripts/admin-bulk.mjs --target "brand:SpeedyBee" --op price_percent --value -5 [--apply]
//   或由 workflow 以環境變數 PAYLOAD（Pages CMS 傳來的 JSON）執行
// 預設只預覽；--apply（或 mode=apply）才寫入。輸出 GitHub Actions 摘要。
import fs from 'node:fs';
import path from 'node:path';
import { PRODUCTS_DIR, readJSON, writeJSON, today } from './lib/data.mjs';
import { selectProducts, applyBulk } from './lib/admin.mjs';

const args = process.argv.slice(2);
const opt = k => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const payload = process.env.PAYLOAD ? JSON.parse(process.env.PAYLOAD) : null;
const inp = payload?.inputs || {};
const target = opt('--target') ?? inp.target;
const operation = opt('--op') ?? inp.operation;
const value = String(opt('--value') ?? inp.value ?? '').trim();
const apply = args.includes('--apply') || inp.mode === 'apply';
const operator = payload?.triggeredBy?.name || payload?.triggeredBy?.githubUsername || '本機';
const OPS = { publish: '上架', unpublish: '下架', availability: '設定供貨狀態', price_percent: '價格調整百分比', price_set: '價格設定為', price_inquiry: '改為詢價' };

const out = [];
const summaryFile = process.env.GITHUB_STEP_SUMMARY;
const finish = code => {
  const md = out.join('\n');
  console.log(md);
  if (summaryFile) fs.appendFileSync(summaryFile, md + '\n');
  fs.writeFileSync('.admin-result.json', JSON.stringify({ operator, operation, value, apply, code }));
  process.exit(code);
};

out.push(`## 批次修改${apply ? '（已套用）' : '（預覽，未修改）'}`, '', `操作者：${operator}｜操作：${OPS[operation] || operation}${value ? ` ${value}` : ''}｜對象：${String(target || '').replace(/\n/g, ' ')}`, '');
if (!OPS[operation]) { out.push(`✖ 未知的操作：${operation}`); finish(1); }

const files = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.json')).sort();
const products = files.map(f => ({ ...readJSON(path.join(PRODUCTS_DIR, f)), _file: f }));
const { selected, unknown } = selectProducts(products, target);
if (unknown.length) out.push(`⚠️ 找不到：${unknown.join('、')}`, '');
if (!selected.length) { out.push('✖ 沒有符合的商品，未做任何修改'); finish(1); }
if (selected.length > 50 && !apply) out.push(`⚠️ 共 ${selected.length} 件商品，請確認範圍正確再套用`, '');

const rows = []; let changed = 0, skipped = 0;
try {
  for (const p of selected) {
    const { _file, ...prod } = p;
    const r = applyBulk(prod, operation, value);
    if (r.skip) { skipped++; rows.push(`| ${prod.name_zh} | ${prod.id} | — | 略過：${r.skip} |`); continue; }
    if (!r.changed) { rows.push(`| ${prod.name_zh} | ${prod.id} | ${r.before} | 不變 |`); continue; }
    changed++;
    rows.push(`| ${prod.name_zh} | ${prod.id} | ${r.before} | ${r.after} |`);
    if (apply) { r.product.updated_at = today(); writeJSON(path.join(PRODUCTS_DIR, _file), r.product); }
  }
} catch (e) { out.push(`✖ ${e.message}`); finish(1); }

out.push(`符合 ${selected.length} 件；${apply ? '已修改' : '將修改'} ${changed} 件；略過 ${skipped} 件。`, '');
out.push('| 商品 | ID | 修改前 | 修改後 |', '|---|---|---|---|', ...rows.slice(0, 400));
if (rows.length > 400) out.push(`…另 ${rows.length - 400} 件未列出`);
if (!apply) out.push('', '確認無誤後，再按一次「批次修改」並把模式改為「套用」。');
finish(0);
