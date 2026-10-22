// 資料規則測試：node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, PRODUCTS_DIR, loadAll, validateProducts, parseCSV } from '../scripts/lib/data.mjs';

const { categories } = loadAll();
const base = () => ({
  id: 'test-1', slug: 'test-item', name_zh: '測試商品', sku: null, brand: 'EWP', manufacturer_model: null, seller_role: 'retail',
  primary_category_id: 'hardware-prints', subcategory_id: 'screws', tags: [], compatible_sizes: [], short_description: '短說明',
  description: '', specifications: [], images: [{ src: '/assets/img/builds/huan-600.webp', alt: '測試圖' }], variants: [],
  price_twd: null, price_display: 'inquiry', availability: 'unknown', shopee_url: null, line_inquiry_enabled: true,
  featured: false, published: true, updated_at: '2026-10-22', review: { status: 'approved' },
});
const errs = p => validateProducts([p], categories).errors;

test('合法商品通過驗證', () => assert.deepEqual(errs(base()), []));
test('價格不可為 0', () => assert.ok(errs({ ...base(), price_twd: 0, price_display: 'fixed' }).some(e => e.includes('不得為 0'))));
test('詢價商品不可帶價格', () => assert.ok(errs({ ...base(), price_twd: 100 }).length));
test('公開商品必須有正式圖片', () => assert.ok(errs({ ...base(), images: [] }).some(e => e.includes('至少一張'))));
test('公開商品必須經 EWP 核對', () => assert.ok(errs({ ...base(), review: { status: 'draft' } }).some(e => e.includes('approved'))));
test('不存在的分類被擋下', () => assert.ok(errs({ ...base(), subcategory_id: 'nope' }).length));
test('外部圖片網址被擋下', () => assert.ok(errs({ ...base(), images: [{ src: 'https://example.com/a.jpg', alt: 'x' }] }).length));
test('蝦皮網址必須是 shopee.tw', () => assert.ok(errs({ ...base(), shopee_url: 'https://evil.example/x' }).length));
test('重複 slug 被擋下', () => assert.ok(validateProducts([base(), { ...base(), id: 'test-2' }], categories).errors.some(e => e.includes('slug 重複'))));
test('CSV 解析支援引號、逗號與換行', () => {
  const rows = parseCSV('﻿a,b\n"x,1","line1\nline2"\n');
  assert.deepEqual(rows, [{ a: 'x,1', b: 'line1\nline2' }]);
});
test('新增一個資料檔即自動產生詳情頁與 sitemap，不需手寫 HTML', () => {
  const f = path.join(PRODUCTS_DIR, 'zz-test-1.json');
  const out = path.join(ROOT, '_test');
  fs.writeFileSync(f, JSON.stringify(base()));
  try {
    execFileSync('node', ['scripts/build.mjs', '--out', '_test'], { cwd: ROOT });
    assert.ok(fs.existsSync(path.join(out, 'product/test-item/index.html')));
    assert.ok(fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf8').includes('/product/test-item/'));
    assert.ok(fs.readFileSync(path.join(out, 'products/hardware-prints/index.html'), 'utf8').includes('data-id="test-1"'));
  } finally {
    fs.rmSync(f); fs.rmSync(out, { recursive: true, force: true });
  }
});
