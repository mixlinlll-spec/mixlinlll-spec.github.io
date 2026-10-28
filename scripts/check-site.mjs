#!/usr/bin/env node
// 發布產物檢查（預設 dist/）：
//   1. 白名單：發布產物只能包含產生的頁面與 STATIC_WHITELIST 內的靜態檔，不得出現原始碼、資料檔、測試或預覽檔
//   2. 站內連結、圖片、srcset 皆存在；沒有 href="#" 假連結；沒有 NT$ 0
//   3. 正式版：草稿商品頁、草稿商品卡、sitemap 中的草稿網址都不得存在
// 用法：node scripts/check-site.mjs [輸出目錄，預設 dist] [--preview]
import fs from 'node:fs';
import path from 'node:path';
const RETIRED_HELP = JSON.parse(fs.readFileSync(new URL('../src/data/help-retired.json', import.meta.url), 'utf8')).map(r => r.slug);
import { ROOT, loadAll, STATIC_WHITELIST } from './lib/data.mjs';

const argDir = process.argv.slice(2).find(a => !a.startsWith('--'));
const OUT = path.resolve(ROOT, argDir || 'dist');
const isPreview = process.argv.includes('--preview') || path.basename(OUT) === '_preview';
if (!fs.existsSync(OUT)) { console.error(`✖ 找不到 ${OUT}，請先執行 node scripts/build.mjs`); process.exit(1); }

// 產生器輸出的頂層項目（頁面、資料夾與 SEO 檔）
const GENERATED_TOP = ['index.html', '404.html', 'robots.txt', 'sitemap.xml', 'products', 'product', 'builds', 'services', 'help', 'fpv-help.html',
  'batteries', 'journal', 'about', 'contact', 'privacy', 'terms', 'shipping-returns'];
const ALLOWED_TOP = new Set([...GENERATED_TOP, ...STATIC_WHITELIST]);
// 發布產物中禁止出現的副檔名與名稱
const FORBIDDEN_EXT = /\.(json|mjs|cjs|ts|md|csv|tsv|xlsx|yml|yaml|map|sh|py|lock|env)$/i;
const FORBIDDEN_NAME = /^(src|scripts|tests|docs|_preview|_test|dist|node_modules|\.github|\.git|package\.json|README\.md|CONTENT_GUIDE\.md|CHANGELOG\.md)$/;

const errors = [];
const all = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = path.relative(OUT, full).split(path.sep).join('/');
    if (FORBIDDEN_NAME.test(e.name)) errors.push(`白名單：不得發布 ${rel}`);
    if (e.isDirectory()) walk(full);
    else {
      all.push(full);
      if (FORBIDDEN_EXT.test(e.name)) errors.push(`白名單：不得發布原始碼／資料檔 ${rel}`);
    }
  }
})(OUT);
for (const top of fs.readdirSync(OUT)) if (!ALLOWED_TOP.has(top)) errors.push(`白名單：未允許的頂層項目 ${top}`);

const htmlFiles = all.filter(f => f.endsWith('.html'));
const resolve = (from, ref) => {
  const clean = decodeURI(ref.split('#')[0].split('?')[0]);
  if (!clean) return null;
  const abs = clean.startsWith('/') ? path.join(OUT, clean) : path.join(path.dirname(from), clean);
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) return path.join(abs, 'index.html');
  return abs;
};
let links = 0;
for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf8');
  const rel = path.relative(OUT, f);
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const ref = m[1];
    if (ref === '#' || ref === '') { errors.push(`${rel}: 空連結 "${ref}"`); continue; }
    if (/^(https?:|mailto:|tel:|data:|#)/.test(ref)) continue;
    links++;
    const target = resolve(f, ref);
    if (target && !fs.existsSync(target)) errors.push(`${rel}: 找不到 ${ref}`);
  }
  for (const m of html.matchAll(/srcset="([^"]*)"/g)) {
    for (const part of m[1].split(',')) {
      const ref = part.trim().split(/\s+/)[0];
      if (ref && !/^https?:/.test(ref) && !fs.existsSync(resolve(f, ref))) errors.push(`${rel}: 找不到 srcset ${ref}`);
    }
  }
  if (/NT\$\s*0(?![\d,])/.test(html)) errors.push(`${rel}: 出現 NT$ 0`);
  // 導向頁（舊網址轉到新位置）本來就是 noindex
  // 移出故障排除中心的主題（src/data/help-retired.json）：舊網址只留簡短說明，刻意 noindex
  const retiredHelp = RETIRED_HELP.some(r => rel.split(path.sep).join('/') === `help/${r}/index.html`);
  if (!isPreview && !retiredHelp && /noindex/.test(html) && !/http-equiv="refresh"/.test(html) && !/^(404\.html|legacy\/|fpv-help\.html$|privacy\/|terms\/|shipping-returns\/)/.test(rel.split(path.sep).join('/')))
    errors.push(`${rel}: 正式版頁面不應為 noindex`);
}

// 正式版不得包含草稿
const { products } = loadAll();
if (!isPreview) {
  const drafts = products.filter(p => !p.published);
  const sitemap = fs.existsSync(path.join(OUT, 'sitemap.xml')) ? fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8') : '';
  const allHtml = htmlFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');
  for (const d of drafts) {
    if (fs.existsSync(path.join(OUT, 'product', d.slug))) errors.push(`草稿外洩：/product/${d.slug}/`);
    if (sitemap.includes(`/product/${d.slug}/`)) errors.push(`草稿外洩：sitemap 含 ${d.slug}`);
    if (allHtml.includes(`data-id="${d.id}"`)) errors.push(`草稿外洩：頁面含商品卡 ${d.id}`);
  }
  if (!sitemap.includes('<urlset')) errors.push('缺少 sitemap.xml');
  // 未公開商品的圖片不得出現在正式產物
  const imgRoot = path.join(OUT, 'assets', 'img', 'products');
  if (fs.existsSync(imgRoot)) for (const d of fs.readdirSync(imgRoot)) {
    const p = products.find(x => x.id === d);
    if (!p || !p.published) errors.push(`草稿外洩：未公開商品圖片 assets/img/products/${d}/`);
  }
}

if (errors.length) { console.error(`✖ 檢查失敗 ${errors.length} 筆：\n  ` + errors.slice(0, 60).join('\n  ')); process.exit(1); }
console.log(`✓ ${path.relative(ROOT, OUT)}：${all.length} 個檔案符合發布白名單；${htmlFiles.length} 個 HTML、${links} 個站內連結與資源皆存在${isPreview ? '' : '；無草稿外洩'}`);
