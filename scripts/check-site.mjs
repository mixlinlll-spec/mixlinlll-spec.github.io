#!/usr/bin/env node
// 產出檢查：站內連結／資源是否存在、是否有 href="#" 假連結、草稿是否外洩到正式版。
// 用法：node scripts/check-site.mjs [輸出目錄，預設 repo 根目錄]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadAll } from './lib/data.mjs';

const OUT = path.resolve(ROOT, process.argv[2] || '.');
const isPreview = OUT !== ROOT;
const SKIP_DIRS = new Set(['.git', 'node_modules', 'src', 'scripts', '_preview', 'docs']);
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name)); }
    else if (e.name.endsWith('.html')) files.push(path.join(dir, e.name));
  }
})(OUT);

const errors = [];
const resolve = (from, ref) => {
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean) return null;
  const abs = clean.startsWith('/') ? path.join(OUT, clean) : path.join(path.dirname(from), clean);
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) return path.join(abs, 'index.html');
  return abs;
};
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  const rel = path.relative(OUT, f);
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const ref = m[1];
    if (ref === '#' || ref === '') { errors.push(`${rel}: 空連結 "${ref}"`); continue; }
    if (/^(https?:|mailto:|tel:|data:|#)/.test(ref)) continue;
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
}

// 正式版不得包含草稿
if (!isPreview) {
  const { products } = loadAll();
  const drafts = products.filter(p => !p.published);
  const sitemap = fs.existsSync(path.join(OUT, 'sitemap.xml')) ? fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8') : '';
  const allHtml = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
  for (const d of drafts) {
    if (fs.existsSync(path.join(OUT, 'product', d.slug))) errors.push(`草稿外洩：/product/${d.slug}/ 存在於正式版`);
    if (sitemap.includes(`/product/${d.slug}/`)) errors.push(`草稿外洩：sitemap 含 ${d.slug}`);
    if (allHtml.includes(`data-id="${d.id}"`)) errors.push(`草稿外洩：頁面含商品卡 ${d.id}`);
  }
}
if (errors.length) { console.error(`✖ 檢查失敗 ${errors.length} 筆：\n  ` + errors.slice(0, 50).join('\n  ')); process.exit(1); }
console.log(`✓ 檢查通過：${files.length} 個 HTML 檔，站內連結與資源皆存在${isPreview ? '' : '，正式版沒有草稿外洩'}`);
