// 共用資料載入、CSV 解析與商品驗證。無外部套件，Node 18+ 可直接執行。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = path.join(ROOT, 'src', 'data');
export const PRODUCTS_DIR = path.join(DATA_DIR, 'products');

export const SELLER_ROLES = {
  ewp_original: 'EWP 自製',
  ewp_assembled: 'EWP 組裝',
  retail: '其他品牌商品',
  service: '客製服務',
};
export const AVAILABILITY = {
  in_stock: '現貨',
  preorder: '預購',
  made_to_order: '接單製作',
  out_of_stock: '暫無供貨',
  unknown: '供貨狀況請洽詢',
};
export const PRICE_DISPLAY = ['fixed', 'from', 'inquiry'];

export function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
export function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function loadAll() {
  const site = readJSON(path.join(DATA_DIR, 'site.json'));
  const { categories } = readJSON(path.join(DATA_DIR, 'categories.json'));
  const { builds } = readJSON(path.join(DATA_DIR, 'builds.json'));
  const { services } = readJSON(path.join(DATA_DIR, 'services.json'));
  const products = fs.existsSync(PRODUCTS_DIR)
    ? fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.json')).sort()
        .map(f => ({ ...readJSON(path.join(PRODUCTS_DIR, f)), _file: f }))
    : [];
  return { site, categories, builds, services, products };
}

// ---------- CSV（RFC 4180，支援引號、換行、UTF-8 BOM） ----------
export function parseCSV(text) {
  const [header, ...body] = parseCSVRows(text);
  return body.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

export function parseCSVRows(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(v => v !== '')) rows.push(row);
  return rows;
}

// ---------- 驗證 ----------
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateProducts(products, categories) {
  const errors = [];
  const warnings = [];
  const ids = new Map(), slugs = new Map(), skus = new Map();
  const catMap = new Map(categories.map(c => [c.id, c]));
  for (const p of products) {
    const at = `${p._file || p.id}`;
    const err = m => errors.push(`${at}: ${m}`);
    const warn = m => warnings.push(`${at}: ${m}`);
    for (const k of ['id', 'slug', 'name_zh', 'seller_role', 'primary_category_id', 'price_display', 'availability', 'updated_at']) {
      if (p[k] === undefined || p[k] === null || p[k] === '') err(`缺少必要欄位 ${k}`);
    }
    for (const k of ['tags', 'compatible_sizes', 'specifications', 'images', 'variants']) {
      if (!Array.isArray(p[k])) err(`${k} 必須是陣列`);
    }
    for (const k of ['line_inquiry_enabled', 'featured', 'published']) {
      if (typeof p[k] !== 'boolean') err(`${k} 必須是 true/false`);
    }
    if (p.id) { if (ids.has(p.id)) err(`id 重複：${p.id}（另見 ${ids.get(p.id)}）`); ids.set(p.id, at); }
    if (p.slug) {
      if (!SLUG_RE.test(p.slug)) err(`slug 只能用小寫英數與連字號：${p.slug}`);
      if (slugs.has(p.slug)) err(`slug 重複：${p.slug}（另見 ${slugs.get(p.slug)}）`);
      slugs.set(p.slug, at);
    }
    if (p.sku) { if (skus.has(p.sku)) err(`SKU 重複：${p.sku}`); skus.set(p.sku, at); }
    if (p.seller_role && !SELLER_ROLES[p.seller_role]) err(`seller_role 不合法：${p.seller_role}`);
    if (p.availability && !AVAILABILITY[p.availability]) err(`availability 不合法：${p.availability}`);
    if (p.price_display && !PRICE_DISPLAY.includes(p.price_display)) err(`price_display 不合法：${p.price_display}`);
    const cat = catMap.get(p.primary_category_id);
    if (!cat) err(`找不到主分類：${p.primary_category_id}`);
    else if (p.subcategory_id && !cat.subcategories.some(s => s.id === p.subcategory_id)) err(`分類 ${cat.id} 沒有子分類 ${p.subcategory_id}`);
    if (p.updated_at && !DATE_RE.test(p.updated_at)) err(`updated_at 格式應為 YYYY-MM-DD`);
    // 價格規則：不得出現 0 元；fixed/from 需要價格；inquiry 不得帶價格
    if (p.price_twd !== null && p.price_twd !== undefined) {
      if (!Number.isFinite(p.price_twd) || p.price_twd <= 0) err(`price_twd 必須是大於 0 的數字或 null（不得為 0）`);
    }
    if (['fixed', 'from'].includes(p.price_display) && !(p.price_twd > 0)) err(`price_display=${p.price_display} 需要有效的 price_twd`);
    if (p.price_display === 'inquiry' && p.price_twd != null) err(`price_display=inquiry 時 price_twd 必須為 null`);
    if (p.shopee_url && !/^https:\/\/(shopee\.tw|tw\.shp\.ee)\//.test(p.shopee_url)) err(`shopee_url 必須是 https://shopee.tw/ 或 https://tw.shp.ee/ 網址`);
    for (const [i, v] of (p.variants || []).entries()) {
      if (!v.name) err(`variants[${i}] 缺少 name`);
      if (v.price_twd != null && !(v.price_twd > 0)) err(`variants[${i}].price_twd 不得為 0`);
      if (v.availability && !AVAILABILITY[v.availability]) err(`variants[${i}].availability 不合法`);
      if (v.sku) { if (skus.has(v.sku)) err(`SKU 重複：${v.sku}`); skus.set(v.sku, at); }
    }
    for (const [i, s] of (p.specifications || []).entries()) {
      if (!s.key || s.value === undefined || s.value === '') err(`specifications[${i}] 需要 key 與 value`);
    }
    for (const [i, img] of (p.images || []).entries()) {
      if (!img.src || !img.src.startsWith('/assets/')) err(`images[${i}].src 必須是 /assets/ 下的站內正式圖片`);
      else if (!fs.existsSync(path.join(ROOT, img.src))) err(`images[${i}] 檔案不存在：${img.src}`);
      if (!img.alt) err(`images[${i}] 缺少 alt 文字`);
    }
    // 公開條件：只有完整且通過審核的商品可以公開
    if (p.published) {
      if (!p.images?.length) err('published=true 需要至少一張正式圖片');
      if (!p.short_description) err('published=true 需要 short_description');
      if (!p.brand) err('published=true 需要 brand');
      if (!p.subcategory_id) err('published=true 需要 subcategory_id');
      if (p.review && p.review.status !== 'approved') err('published=true 需要 review.status = "approved"（EWP 已核對）');
    }
    if (p.availability === 'in_stock' && !p.published) warn('草稿標示為現貨，公開前請再次確認');
  }
  return { errors, warnings };
}

export function slugify(name, fallback) {
  const tokens = (name.match(/[A-Za-z0-9][A-Za-z0-9.]*/g) || [])
    .map(t => t.toLowerCase().replace(/\./g, '-').replace(/-+$/, ''))
    .filter(Boolean);
  const uniq = [...new Set(tokens)].slice(0, 6).join('-').slice(0, 60).replace(/-+$/, '');
  return uniq || fallback;
}

export function today() {
  const d = new Date(Date.now() + 8 * 3600e3); // 台灣時間
  return d.toISOString().slice(0, 10);
}
