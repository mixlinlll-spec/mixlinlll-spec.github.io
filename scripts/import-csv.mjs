#!/usr/bin/env node
// 由 CSV 新增或更新商品資料（給非工程人員使用，範本：src/templates/products-template.csv）。
// 用法：node scripts/import-csv.mjs <檔案.csv> [--dry-run]
//
// 欄位格式：
//   多值欄位用「|」分隔：tags、compatible_sizes、battery_cells
//   specifications：鍵=值|鍵=值        例：重量=32g|尺寸=20x20mm
//   images：路徑::ALT 文字|路徑::ALT     例：/assets/img/products/m3-kit-1.webp::M3 螺絲套組全套內容
//   variants：名稱;SKU;價格;供貨|...     例：黑色;M3-BK;120;in_stock|紅色;M3-RD;;unknown
//   price_twd 留空 = 不公開價格；published 留空 = false
// 規則：id 已存在時只更新 CSV 有填的欄位；空白欄位不會清除原資料（要清除請直接改 JSON）。
import fs from 'node:fs';
import path from 'node:path';
import { PRODUCTS_DIR, parseCSV, readJSON, writeJSON, loadAll, validateProducts, today } from './lib/data.mjs';

const [, , input, ...flags] = process.argv;
const DRY = flags.includes('--dry-run');
if (!input) { console.error('用法：node scripts/import-csv.mjs <檔案.csv> [--dry-run]'); process.exit(1); }
const rows = parseCSV(fs.readFileSync(input, 'utf8'));
const split = v => v.split('|').map(s => s.trim()).filter(Boolean);
const bool = v => /^(true|1|yes|是|y)$/i.test(v);

const PARSERS = {
  tags: split, compatible_sizes: split, battery_cells: split, aliases: split,
  specifications: v => split(v).map(x => { const i = x.indexOf('='); return { key: x.slice(0, i).trim(), value: x.slice(i + 1).trim() }; }),
  images: v => split(v).map(x => { const [src, alt] = x.split('::'); return { src: src.trim(), alt: (alt || '').trim() }; }),
  variants: v => split(v).map(x => { const [name, sku, price, availability] = x.split(';').map(s => (s || '').trim()); return { name, sku: sku || null, price_twd: price ? Number(price) : null, availability: availability || 'unknown' }; }),
  price_twd: v => (v === '' ? null : Number(v)),
  line_inquiry_enabled: bool, featured: bool, published: bool,
};
const DEFAULTS = {
  sku: null, brand: null, manufacturer_model: null, seller_role: 'retail', subcategory_id: null, tags: [], compatible_sizes: [],
  video_system: null, battery_cells: [], short_description: '', description: '', specifications: [], images: [], variants: [],
  price_twd: null, price_display: 'inquiry', availability: 'unknown', shopee_url: null, line_inquiry_enabled: true,
  featured: false, published: false, review: { status: 'draft', notes: [] },
};

const changed = [];
for (const [i, row] of rows.entries()) {
  if (!row.id) { console.error(`第 ${i + 2} 列缺少 id，略過`); continue; }
  const file = path.join(PRODUCTS_DIR, `${row.id}.json`);
  const existing = fs.existsSync(file) ? readJSON(file) : { id: row.id, ...structuredClone(DEFAULTS) };
  const next = { ...existing };
  for (const [k, v] of Object.entries(row)) {
    if (k === 'id' || v === '') continue;
    if (k === 'review_status') { next.review = { ...(next.review || {}), status: v }; continue; }
    next[k] = PARSERS[k] ? PARSERS[k](v) : v;
  }
  if (row.published === '') next.published = existing.published ?? false;
  next.updated_at = today();
  changed.push({ ...next, _file: `${row.id}.json` });
}

// 先整體驗證（含既有商品），通過才寫入
const all = loadAll();
const merged = [...all.products.filter(p => !changed.some(c => c.id === p.id)), ...changed];
const { errors } = validateProducts(merged, all.categories);
if (errors.length) { console.error('✖ 驗證失敗，沒有寫入任何檔案：\n  ' + errors.join('\n  ')); process.exit(1); }
if (!DRY) for (const p of changed) { const { _file, ...data } = p; writeJSON(path.join(PRODUCTS_DIR, _file), data); }
console.log(`✓ ${DRY ? '（dry-run）' : ''}已處理 ${changed.length} 筆：${changed.map(p => p.id).join(', ')}`);
