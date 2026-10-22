#!/usr/bin/env node
// 商品後台（Pages CMS）儲存後的校正：由 .github/workflows/cms-sync.yml 在每次後台儲存後執行。
//
//   node scripts/cms-normalize.mjs --base <推送前的 commit> [--summary 檔案] [--dry-run]
//
// 只處理 commit 訊息以「[後台]」開頭（Pages CMS 依 .pages.yml 的 commit 範本產生）的變更：
//   1. 以該次儲存前的版本為準，還原 Pages CMS 刪掉的空值、保護 id／slug／review／規格 ID
//   2. 上架守門（未核准不得公開）、價格規則（最低規格價、詢價清空價格）
//   3. 新上傳的照片：轉正、壓縮成 WebP（1000px＋480px 縮圖），搬到 assets/img/products/<商品 id>/
//   4. 被刪除的商品檔還原（後台不允許刪除商品）
// 輸出：修改後的檔案（由 workflow commit）、變更摘要（GitHub Actions 摘要頁）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ROOT, PRODUCTS_DIR, today } from './lib/data.mjs';
import { normalizeCmsProduct, serializeProduct } from './lib/cms.mjs';

const args = process.argv.slice(2);
const opt = k => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const base = opt('--base');
const head = opt('--head') || 'HEAD';
const summaryFile = opt('--summary');
const dryRun = args.includes('--dry-run');
const MARK = '[後台]';
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
const gitShow = (rev, file) => { try { return git('show', `${rev}:${file}`); } catch { return null; } };

if (!base) { console.error('用法：node scripts/cms-normalize.mjs --base <commit>'); process.exit(2); }

// 1. 找出範圍內的後台 commit 與它們改到的商品檔
const range = /^0+$/.test(base) ? head : `${base}..${head}`;
const commits = git('log', '--reverse', '--format=%H%x1f%P%x1f%cI%x1f%s', range).split('\n').filter(Boolean)
  .map(l => { const [sha, parents, date, subject] = l.split('\x1f'); return { sha, parent: parents.split(' ')[0], date, subject }; })
  .filter(c => c.subject.startsWith(MARK));
const touched = new Map(); // file -> { prevRev, commits: [] }
for (const c of commits) {
  const files = git('diff-tree', '--no-commit-id', '--name-only', '-r', c.sha).split('\n').filter(f => /^src\/data\/products\/[^/]+\.json$/.test(f));
  for (const f of files) {
    if (!touched.has(f)) touched.set(f, { prevRev: c.parent, commits: [] });
    touched.get(f).commits.push(c);
  }
}
console.log(`後台 commit：${commits.length} 個；受影響商品：${touched.size} 件`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `cms_commits=${commits.length}\n`);
if (!commits.length) { console.log('沒有後台 commit，不需要校正'); process.exit(0); }

// 2. 校正
let sharp = null;
async function getSharp() {
  if (!sharp) {
    try { sharp = (await import('sharp')).default; } catch { throw new Error('處理新照片需要 sharp（npm install）'); }
  }
  return sharp;
}
const report = [];
let failed = false;
const operatorOf = s => (s.match(/（([^（）]*)）\s*$/) || [])[1] || '';

for (const [file, info] of touched) {
  const abs = path.join(ROOT, file);
  const prevText = gitShow(info.prevRev, file);
  const entry = { file, operators: [...new Set(info.commits.map(c => operatorOf(c.subject)).filter(Boolean))], time: info.commits.at(-1).date, changes: [], warnings: [], errors: [] };
  report.push(entry);
  if (prevText == null) { entry.errors.push('後台不允許新增商品（請用匯入工具）；此檔未處理'); failed = true; continue; }
  const prev = JSON.parse(prevText);
  entry.name = prev.name_zh;
  if (!fs.existsSync(abs)) {
    entry.warnings.push('後台不允許刪除商品，已還原');
    if (!dryRun) fs.writeFileSync(abs, prevText);
    continue;
  }
  let next;
  try { next = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch (e) { entry.errors.push(`JSON 格式錯誤：${e.message}`); failed = true; continue; }
  const { product, changes, warnings } = normalizeCmsProduct(prev, next, { today: today() });
  entry.name = product.name_zh;
  entry.changes = changes; entry.warnings.push(...warnings);
  try {
    for (const im of product.images || []) if (im._needs_processing) await processImage(product, im, entry);
  } catch (e) { entry.errors.push(e.message); failed = true; continue; }
  const out = serializeProduct(product);
  if (!dryRun && out !== fs.readFileSync(abs, 'utf8')) fs.writeFileSync(abs, out);
}

async function processImage(product, im, entry) {
  const srcAbs = path.join(ROOT, decodeURI(im.src).replace(/^\//, ''));
  if (!im.src.startsWith('/assets/img/products/') || !fs.existsSync(srcAbs)) throw new Error(`找不到上傳的照片 ${im.src}`);
  const s = await getSharp();
  const buf = fs.readFileSync(srcAbs);
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
  const dirRel = `assets/img/products/${product.id}`;
  const name = `u-${hash}`;
  const bigRel = `${dirRel}/${name}.webp`, smallRel = `${dirRel}/${name}-480.webp`;
  if (!dryRun) {
    fs.mkdirSync(path.join(ROOT, dirRel), { recursive: true });
    const img = s(buf).rotate();
    const big = await img.clone().resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(ROOT, bigRel));
    await img.clone().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(ROOT, smallRel));
    im.width = big.width; im.height = big.height;
    // 原始上傳檔：轉檔後不再使用就刪除（避免大檔留在 repo 與網站）
    const oldRel = path.relative(ROOT, srcAbs).split(path.sep).join('/');
    if (oldRel !== bigRel && !isReferencedElsewhere('/' + oldRel, product.id)) fs.rmSync(srcAbs);
  }
  const old = im.src;
  im.src = '/' + bigRel; im.src_small = '/' + smallRel;
  delete im._needs_processing;
  entry.changes.push(`新照片已轉 WebP：${old} → ${im.src}${im.width ? `（${im.width}×${im.height}）` : ''}`);
}

function isReferencedElsewhere(src, exceptId) {
  for (const f of fs.readdirSync(PRODUCTS_DIR)) {
    if (!f.endsWith('.json') || f === `${exceptId}.json`) continue;
    if (fs.readFileSync(path.join(PRODUCTS_DIR, f), 'utf8').includes(`"${src}"`)) return true;
  }
  return false;
}

// 3. 摘要
const lines = [`## 商品後台儲存結果`, '', `後台儲存 ${commits.length} 次，影響 ${touched.size} 件商品。`, ''];
for (const r of report) {
  lines.push(`### ${r.errors.length ? '✖' : r.warnings.length ? '⚠️' : '✓'} ${r.name || r.file}`);
  lines.push(`\`${path.basename(r.file, '.json')}\`｜操作者：${r.operators.join('、') || '—'}｜時間：${r.time}`);
  for (const c of r.changes) lines.push(`- ${c}`);
  if (!r.changes.length && !r.errors.length) lines.push('- （沒有實際內容變更）');
  for (const w of r.warnings) lines.push(`- ⚠️ ${w}`);
  for (const e of r.errors) lines.push(`- ✖ ${e}`);
  lines.push('');
}
const md = lines.join('\n');
console.log(md);
if (summaryFile) fs.appendFileSync(summaryFile, md + '\n');
fs.writeFileSync(path.join(ROOT, '.cms-report.json'), JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
