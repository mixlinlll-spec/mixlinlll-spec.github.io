#!/usr/bin/env node
// 內容修改保護檢查：比對目前商品資料與基準版本（預設 origin/main），
// 確認商品 ID、網址、蝦皮對應、規格選項、價格、供貨、發布與審核狀態、圖片來源與權利、銷售身分都沒有被改動。
// 用法：node scripts/check-protected-fields.mjs [--base origin/main]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, PRODUCTS_DIR } from './lib/data.mjs';

const argv = process.argv.slice(2);
const base = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : 'origin/main';

const TOP = ['id', 'slug', 'shopee_item_id', 'shopee_url', 'sku', 'seller_role', 'price_twd', 'price_display', 'availability', 'published', 'line_inquiry_enabled', 'cta_primary'];
const pick = (o, ks) => Object.fromEntries(ks.map(k => [k, o?.[k] ?? null]));
const protectedView = p => ({
  ...pick(p, TOP),
  review_status: p.review?.status ?? null,
  variants: (p.variants || []).map(v => ({ ...v })),
  images: (p.images || []).map(i => pick(i, ['src', 'fallback', 'rights', 'source_url'])),
});

const rel = path.relative(ROOT, PRODUCTS_DIR);
const listed = execFileSync('git', ['ls-tree', '--name-only', `${base}:${rel}`], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(f => f.endsWith('.json'));
const current = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.json'));
const problems = [];
for (const f of new Set([...listed, ...current])) {
  if (!listed.includes(f)) { problems.push(`${f}：基準版本沒有這個檔案（新增商品）`); continue; }
  if (!current.includes(f)) { problems.push(`${f}：商品檔案被刪除`); continue; }
  const before = protectedView(JSON.parse(execFileSync('git', ['show', `${base}:${rel}/${f}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 })));
  const after = protectedView(JSON.parse(fs.readFileSync(path.join(PRODUCTS_DIR, f), 'utf8')));
  for (const k of Object.keys(before)) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) problems.push(`${f}：受保護欄位 ${k} 被修改`);
  }
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`✓ 受保護欄位未變動（${current.length} 件，比對 ${base}）`);
