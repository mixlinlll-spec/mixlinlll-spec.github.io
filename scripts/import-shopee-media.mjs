#!/usr/bin/env node
// 批次下載蝦皮商品圖片 → 壓縮成網站用 WebP → 寫入商品資料。
//
// 來源：每件商品 review.source_media（由蝦皮「媒體資訊」匯出檔建立）：主圖、細節圖、規格選項圖。
// 輸出：assets/img/products/<id>/
//         01.webp／01-480.webp      主圖（長邊 1000px／480px）
//         02.webp … 細節圖（依蝦皮順序）
//         opt-01-480.webp …         規格選項圖（只需小圖）
//       商品 images[]（rights: "unverified" 使用權待 EWP 確認，不可公開）、variants[].image
//       docs/MEDIA_IMPORT_REPORT.md、docs/media-import-failures.csv
// 特性：同一網址只下載一次；已下載的檔案會跳過（可重複執行、失敗可重跑）；不更動價格、供貨、published、id、slug。
//
// 執行環境需要能連到蝦皮圖片 CDN（GitHub Actions：.github/workflows/import-media.yml）。
//   npm install && node scripts/import-shopee-media.mjs [--only sp-123,sp-456] [--concurrency 8]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PRODUCTS_DIR, readJSON, writeJSON } from './lib/data.mjs';

const sharp = (await import('sharp')).default;
const args = process.argv.slice(2);
const opt = k => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const ONLY = opt('--only') ? new Set(opt('--only').split(',')) : null;
const CONC = Number(opt('--concurrency') || 8);
const BIG = 1000, SMALL = 480;

const files = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.json')).sort();
const jobs = [];      // 每張圖片一個工作
const products = new Map();
const cleanName = s => s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}️]/gu, '').replace(/[【】]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

for (const f of files) {
  const p = readJSON(path.join(PRODUCTS_DIR, f));
  if (ONLY && !ONLY.has(p.id)) continue;
  const sm = p.review?.source_media;
  if (!sm) continue;
  products.set(p.id, { p, file: f });
  const dir = `assets/img/products/${p.id}`;
  const name = cleanName(p.name_zh);
  const seen = new Map(); // url → 已排定的輸出，避免同商品重複下載
  const list = [];
  if (sm.cover) list.push({ role: 'cover', url: sm.cover, alt: `${name}（主圖）` });
  sm.gallery.forEach((u, i) => list.push({ role: 'gallery', url: u, alt: `${name}（細節圖 ${i + 1}）` }));
  let n = 0;
  for (const it of list) {
    if (seen.has(it.url)) continue;
    n++;
    const base = String(n).padStart(2, '0');
    const job = { id: p.id, kind: 'image', role: it.role, url: it.url, alt: it.alt, big: `${dir}/${base}.webp`, small: `${dir}/${base}-${SMALL}.webp` };
    seen.set(it.url, job); jobs.push(job);
  }
  let o = 0;
  for (const op of sm.options || []) {
    if (!op.url) continue;
    o++;
    if (seen.has(op.url + '#opt')) { seen.get(op.url + '#opt').options.push(op.option); continue; }
    const job = { id: p.id, kind: 'option', url: op.url, options: [op.option], alt: `${name}（規格：${op.option || o}）`, small: `${dir}/opt-${String(o).padStart(2, '0')}-${SMALL}.webp` };
    seen.set(op.url + '#opt', job); jobs.push(job);
  }
}

async function download(url) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 30000);
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (EWP site media import)', Accept: 'image/*' } });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 200) throw new Error(`檔案過小（${buf.length} bytes）`);
      return buf;
    } catch (e) { last = e; await new Promise(r => setTimeout(r, 800 * attempt)); }
  }
  throw last;
}

const stats = { ok: 0, skipped: 0, failed: 0, bytesIn: 0, bytesOut: 0 };
const failures = [];
async function run(job) {
  const bigAbs = job.big && path.join(ROOT, job.big);
  const smallAbs = path.join(ROOT, job.small);
  if ((!bigAbs || fs.existsSync(bigAbs)) && fs.existsSync(smallAbs)) {
    const m = await sharp(bigAbs || smallAbs).metadata();
    job.width = m.width; job.height = m.height; job.done = true; stats.skipped++; return;
  }
  try {
    const buf = await download(job.url);
    stats.bytesIn += buf.length;
    const img = sharp(buf, { failOn: 'error' }).rotate();
    const meta = await img.metadata();
    if (!meta.width || !meta.height) throw new Error('不是有效圖片');
    fs.mkdirSync(path.dirname(smallAbs), { recursive: true });
    if (bigAbs) {
      const r = await img.clone().resize({ width: BIG, height: BIG, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76 }).toFile(bigAbs);
      job.width = r.width; job.height = r.height; stats.bytesOut += r.size;
    }
    const s = await img.clone().resize({ width: SMALL, height: SMALL, fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toFile(smallAbs);
    if (!bigAbs) { job.width = s.width; job.height = s.height; }
    stats.bytesOut += s.size;
    job.done = true; stats.ok++;
  } catch (e) {
    stats.failed++;
    failures.push({ id: job.id, kind: job.kind === 'option' ? `規格選項圖（${job.options.join('／')}）` : job.role === 'cover' ? '主圖' : '細節圖', url: job.url, error: String(e.message || e) });
  }
}

// 併發下載
let idx = 0;
await Promise.all(Array.from({ length: CONC }, async () => { while (idx < jobs.length) { const j = jobs[idx++]; await run(j); } }));

// 寫回商品資料（只更動 images 與 variants[].image）
let imagesWritten = 0, optionLinked = 0;
for (const [id, { p, file }] of products) {
  const mine = jobs.filter(j => j.id === id && j.done);
  const imgs = mine.filter(j => j.kind === 'image').map(j => ({
    src: '/' + j.big, src_small: '/' + j.small, alt: j.alt, width: j.width, height: j.height, rights: 'unverified', role: j.role, source_url: j.url,
  }));
  // 保留 EWP 已手動加入且非蝦皮來源的圖片
  const manual = (p.images || []).filter(i => !i.source_url);
  p.images = [...manual, ...imgs];
  imagesWritten += imgs.length;
  for (const j of mine.filter(j => j.kind === 'option')) {
    for (const optName of j.options) {
      const v = (p.variants || []).find(v => v.name === optName);
      if (v) { v.image = { src: '/' + j.small, alt: j.alt, rights: 'unverified', source_url: j.url }; optionLinked++; }
      else {
        p.review.unmatched_option_images = [...new Set([...(p.review.unmatched_option_images || []), optName || '(未命名選項)'])];
      }
    }
  }
  writeJSON(path.join(PRODUCTS_DIR, file), p);
}

// 報告
const byId = new Map();
for (const j of jobs) { const r = byId.get(j.id) || { total: 0, ok: 0, fail: 0 }; r.total++; j.done ? r.ok++ : r.fail++; byId.set(j.id, r); }
const totalImages = jobs.filter(j => j.kind === 'image').length, okImages = jobs.filter(j => j.kind === 'image' && j.done).length;
const totalOpt = jobs.filter(j => j.kind === 'option').length, okOpt = jobs.filter(j => j.kind === 'option' && j.done).length;
const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
fs.writeFileSync(path.join(ROOT, 'docs', 'media-import-failures.csv'), '﻿' + ['商品ID,圖片類型,原始網址,錯誤', ...failures.map(f => [f.id, f.kind, f.url, f.error].map(q).join(','))].join('\r\n') + '\r\n');
const md = `# 蝦皮商品圖片匯入報告

> 由 \`scripts/import-shopee-media.mjs\` 自動產生（GitHub Actions：import-media.yml）。
> 來源：蝦皮「媒體資訊」匯出檔 ${[...products.values()][0]?.p.review.source_media.media_export || ''}。

| 項目 | 數量 |
|---|---|
| 商品 | ${products.size} 件 |
| 主圖＋細節圖（不重複） | 成功 ${okImages}／${totalImages} |
| 規格選項圖（不重複） | 成功 ${okOpt}／${totalOpt} |
| 本次新下載 | ${stats.ok} 張 |
| 已存在略過 | ${stats.skipped} 張 |
| 失敗 | ${stats.failed} 張 |
| 寫入商品 images | ${imagesWritten} 筆 |
| 對應到規格變體的選項圖 | ${optionLinked} 筆 |
| 下載原始大小 → 輸出大小（本次） | ${(stats.bytesIn / 1048576).toFixed(1)} MB → ${(stats.bytesOut / 1048576).toFixed(1)} MB |

規格：主圖與細節圖輸出長邊 ${BIG}px 與 ${SMALL}px WebP；規格選項圖輸出 ${SMALL}px WebP。所有圖片 \`rights: "unverified"\`（使用權待 EWP 確認），在 EWP 標示為 \`ewp_own\` 或 \`licensed\` 前不能用於公開商品，也不會被複製到正式網站產物。

## 失敗清單

${failures.length ? ['| 商品 | 類型 | 錯誤 | 原始網址 |', '|---|---|---|---|', ...failures.map(f => `| ${f.id} | ${f.kind} | ${f.error} | ${f.url} |`)].join('\n') : '無。'}

完整清單（Excel 可開）：[media-import-failures.csv](media-import-failures.csv)。失敗的圖片可重新執行匯入，已成功的會自動跳過。
`;
fs.writeFileSync(path.join(ROOT, 'docs', 'MEDIA_IMPORT_REPORT.md'), md);
console.log(`主圖＋細節圖 ${okImages}/${totalImages}、規格選項圖 ${okOpt}/${totalOpt}、新下載 ${stats.ok}、略過 ${stats.skipped}、失敗 ${stats.failed}`);
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=蝦皮圖片匯入::主圖＋細節圖 ${okImages}/${totalImages}、規格選項圖 ${okOpt}/${totalOpt}、失敗 ${stats.failed}`);
