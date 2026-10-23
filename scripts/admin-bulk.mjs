#!/usr/bin/env node
// 商品批次修改（後台「批次修改」按鈕 → .github/workflows/admin-bulk.yml）
//
//   node scripts/admin-bulk.mjs --target "brand:SpeedyBee" --op price_percent --value -5 [--apply]
//   或由 workflow 以環境變數 PAYLOAD（Pages CMS 傳來的 JSON）執行
// 預設只預覽；--apply（或 mode=apply）才寫入。輸出 GitHub Actions 摘要。
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { PRODUCTS_DIR, readJSON, writeJSON, today } from './lib/data.mjs';
import { selectProducts, applyBulk } from './lib/admin.mjs';

const args = process.argv.slice(2);
const opt = k => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const payload = process.env.PAYLOAD ? JSON.parse(process.env.PAYLOAD) : null;
const inp = payload?.inputs || {};

// 只處理「在哪個分支按的按鈕，就改哪個分支」：Pages CMS 送來的分支必須與這次執行的分支相同
if (payload && process.env.GITHUB_REF_NAME && payload.repository?.ref && payload.repository.ref !== process.env.GITHUB_REF_NAME) {
  console.error(`✖ 分支不符：後台目前在 ${payload.repository.ref}，流程卻在 ${process.env.GITHUB_REF_NAME} 執行，已停止`);
  process.exit(1);
}
const target = opt('--target') ?? inp.target;
const operation = opt('--op') ?? inp.operation;
const value = String(opt('--value') ?? inp.value ?? '').trim();
const apply = args.includes('--apply') || inp.mode === 'apply';
const confirmCode = String(opt('--confirm') ?? inp.confirm_code ?? '').trim().toUpperCase();
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

// 確認碼：由操作、數值、對象商品與它們「目前的內容」計算。預覽與套用之間資料有任何變動，確認碼就不同。
const code = crypto.createHash('sha256').update(JSON.stringify([operation, value, selected.map(({ _file, ...p }) => p)])).digest('hex').slice(0, 6).toUpperCase();
if (apply && confirmCode !== code) {
  out.push(confirmCode ? '✖ 確認碼不符：預覽後商品資料已變動或操作參數不同，請重新「只預覽」取得新的確認碼。' : '✖ 套用需要確認碼：請先「只預覽」，再把結果中的 6 碼確認碼填入。', '', '沒有做任何修改。');
  finish(1);
}

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
if (!apply) out.push('', `### 確認碼：\`${code}\``, '', '確認無誤後，再按一次「批次修改」：相同的對象、操作與數值，模式選「套用」，並填入上面的確認碼。');
finish(0);
