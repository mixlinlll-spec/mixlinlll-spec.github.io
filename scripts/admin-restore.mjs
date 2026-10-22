#!/usr/bin/env node
// 把一件商品還原到指定版本（後台商品頁「還原」按鈕 → .github/workflows/admin-restore.yml）
//   node scripts/admin-restore.mjs --file src/data/products/sp-123.json --sha abc1234
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib/data.mjs';
import { diffProduct } from './lib/cms.mjs';

const args = process.argv.slice(2);
const opt = k => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const payload = process.env.PAYLOAD ? JSON.parse(process.env.PAYLOAD) : null;
const file = String(opt('--file') ?? payload?.context?.path ?? '').replace(/^\/+/, '');
const sha = String(opt('--sha') ?? payload?.inputs?.sha ?? '').trim().toLowerCase();
const operator = payload?.triggeredBy?.name || '本機';
const out = [];
const fail = m => { out.push(`✖ ${m}`); done(1); };
function done(code) {
  const md = out.join('\n'); console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `file=${path.basename(file, '.json')}\nsha=${sha.slice(0, 7)}\n`);
  process.exit(code);
}
out.push('## 還原商品', '', `操作者：${operator}｜商品：${file}｜版本：${sha}`, '');
if (!/^src\/data\/products\/sp-[\w-]+\.json$/.test(file)) fail('只能還原商品檔（src/data/products/*.json）');
if (!/^[0-9a-f]{7,40}$/.test(sha)) fail('版本代碼格式不正確（7–40 碼英數 commit SHA）');
let old;
try { old = execFileSync('git', ['show', `${sha}:${file}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
catch { fail(`找不到版本 ${sha} 的 ${file}`); }
const cur = fs.readFileSync(path.join(ROOT, file), 'utf8');
const a = JSON.parse(cur); const b = JSON.parse(old);
if (a.id !== b.id) fail('版本中的商品 ID 不同，拒絕還原');
const changes = diffProduct(a, b);
fs.writeFileSync(path.join(ROOT, file), old.endsWith('\n') ? old : old + '\n');
out.push(changes.length ? '還原內容：' : '（與目前內容相同）', ...changes.map(c => `- ${c}`));
done(0);
