// 資料、路徑、審核與發布產物測試：node --test tests/data.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { ROOT, PRODUCTS_DIR, loadAll, validateProducts, parseCSV, isApproved, checkAssetPath, STATIC_WHITELIST } from '../scripts/lib/data.mjs';

const { categories, site, services, products } = loadAll();
const base = () => ({
  id: 'test-1', slug: 'test-item', name_zh: '測試商品', sku: null, brand: 'EWP', manufacturer_model: null, seller_role: 'retail',
  primary_category_id: 'hardware-prints', subcategory_id: 'screws', tags: [], compatible_sizes: [], short_description: '短說明',
  description: '', specifications: [], images: [{ src: '/assets/img/builds/huan-600.webp', alt: '測試圖' }], variants: [],
  price_twd: null, price_display: 'inquiry', availability: 'unknown', shopee_url: null, line_inquiry_enabled: true,
  featured: false, published: true, updated_at: '2026-10-22', review: { status: 'approved' },
});
const errs = p => validateProducts([p], categories).errors;
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');

describe('審核條件：只有 review.status === "approved" 才能公開', () => {
  const pub = review => { const p = base(); if (review === undefined) delete p.review; else p.review = review; return errs(p); };
  test('review 缺失 → 擋下', () => assert.ok(pub(undefined).some(e => e.includes('approved'))));
  test('review = null → 擋下', () => assert.ok(pub(null).some(e => e.includes('approved'))));
  test('review = {} → 擋下', () => assert.ok(pub({}).some(e => e.includes('approved'))));
  test('review.status = draft → 擋下', () => assert.ok(pub({ status: 'draft' }).some(e => e.includes('approved'))));
  test('review.status = rejected → 擋下', () => assert.ok(pub({ status: 'rejected' }).some(e => e.includes('approved'))));
  test('review.status = "Approved"（大小寫不符）→ 擋下', () => assert.ok(pub({ status: 'Approved' }).length));
  test('review = "approved"（字串而非物件）→ 擋下', () => assert.ok(pub('approved').length));
  test('review.status = approved → 通過', () => assert.deepEqual(pub({ status: 'approved' }), []));
  test('isApproved 對各種輸入', () => {
    assert.equal(isApproved({}), false);
    assert.equal(isApproved({ review: null }), false);
    assert.equal(isApproved({ review: {} }), false);
    assert.equal(isApproved({ review: { status: 'approved' } }), true);
  });
  test('草稿沒有 review 仍可存在（不公開即可）', () => { const p = { ...base(), published: false }; delete p.review; assert.deepEqual(errs(p), []); });
});

describe('商品資料規則', () => {
  test('合法商品通過驗證', () => assert.deepEqual(errs(base()), []));
  test('價格不可為 0', () => assert.ok(errs({ ...base(), price_twd: 0, price_display: 'fixed' }).some(e => e.includes('不得為 0'))));
  test('詢價商品不可帶價格', () => assert.ok(errs({ ...base(), price_twd: 100 }).length));
  test('公開商品必須有正式圖片', () => assert.ok(errs({ ...base(), images: [] }).some(e => e.includes('至少一張'))));
  test('不存在的分類被擋下', () => assert.ok(errs({ ...base(), subcategory_id: 'nope' }).length));
  test('蝦皮網址必須是 shopee.tw', () => assert.ok(errs({ ...base(), shopee_url: 'https://evil.example/x' }).length));
  test('重複 slug 被擋下', () => assert.ok(validateProducts([base(), { ...base(), id: 'test-2' }], categories).errors.some(e => e.includes('slug 重複'))));
  test('cta_primary 只接受 line／shopee', () => { assert.ok(errs({ ...base(), cta_primary: 'phone' }).length); assert.deepEqual(errs({ ...base(), cta_primary: 'line' }), []); });
  test('聯名角色 collab 合法', () => assert.deepEqual(errs({ ...base(), seller_role: 'collab' }), []));
  test('CSV 解析支援引號、逗號與換行', () => assert.deepEqual(parseCSV('﻿a,b\n"x,1","line1\nline2"\n'), [{ a: 'x,1', b: 'line1\nline2' }]));
});

describe('檔案路徑驗證', () => {
  test('正常圖片路徑通過', () => assert.equal(checkAssetPath('/assets/img/builds/huan-600.webp'), null));
  test('外部網址被擋下', () => assert.ok(checkAssetPath('https://example.com/a.jpg')));
  test('../ 路徑穿越被擋下', () => assert.ok(checkAssetPath('/assets/../src/data/site.json')));
  test('反斜線被擋下', () => assert.ok(checkAssetPath('/assets\\..\\src\\data\\site.json')));
  test('非圖片副檔名被擋下', () => assert.ok(checkAssetPath('/assets/js/site.js')));
  test('不存在的檔案被擋下', () => assert.ok(checkAssetPath('/assets/img/nope.webp')));
  test('slug 不可含斜線或 ..', () => { assert.ok(errs({ ...base(), slug: '../x' }).length); assert.ok(errs({ ...base(), slug: 'a/b' }).length); });
  test('所有商品檔名與 id 一致', () => { for (const p of products) assert.equal(p._file, `${p.id}.json`); });
  test('聯絡設定的 QR 圖檔存在且為站內圖片', () => {
    for (const k of ['line', 'instagram']) if (site.contact[k].enabled && site.contact[k].qr_image) assert.equal(checkAssetPath(site.contact[k].qr_image), null);
  });
});

describe('現有資料狀態', () => {
  test('目前沒有任何商品被公開（等待 EWP 提供首批資料）', () => assert.equal(products.filter(p => p.published).length, 0));
  test('非 FPV 玩具已標記 rejected', () => {
    for (const id of ['sp-56302849088', 'sp-58004035504']) assert.equal(products.find(p => p.id === id).review.status, 'rejected');
  });
  test('十安聯名電池標示為聯名，不稱 EWP 自製', () => {
    for (const id of ['sp-57303672693', 'sp-55552267337']) { const p = products.find(x => x.id === id); assert.equal(p.seller_role, 'collab'); assert.match(p.brand, /十安 × 電翼動力/); }
  });
  test('三份政策頁皆未核准', () => { for (const k of ['privacy', 'terms', 'shipping-returns']) assert.equal(site.policies[k].approved, false); });
  test('蝦皮 shop ID 未經核實前保持 null', () => assert.equal(site.contact.shopee.shop_id, null));
  test('代購服務頁存在', () => assert.ok(services.some(s => s.id === 'procurement')));
  test('稅籍編號不得存入公開 repo 資料', () => assert.ok(!JSON.stringify(site).includes('720322720')));
  test('舊知識庫與舊主圖內容未被修改', () => {
    assert.equal(sha('fpv-help.html'), '11a1d566353f743458d5efba064cd82c17ec6a2367f6e73a6af404dbadaf57c8');
    assert.equal(sha('huan.png'), '1bf2358c82238d51bfee4fab7fb0442b1fd370de4994dfa647be63377df94bfc');
  });
});

describe('發布產物（建置到暫存資料夾）', () => {
  const OUT = '_test';
  const out = path.join(ROOT, OUT);
  const build = (...a) => execFileSync('node', ['scripts/build.mjs', '--out', OUT, ...a], { cwd: ROOT, stdio: 'pipe' });
  test('新增一個資料檔即自動產生詳情頁與 sitemap，不需手寫 HTML', () => {
    const f = path.join(PRODUCTS_DIR, 'zz-test-1.json');
    fs.writeFileSync(f, JSON.stringify(base()));
    try {
      build();
      assert.ok(fs.existsSync(path.join(out, 'product/test-item/index.html')));
      assert.ok(fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf8').includes('/product/test-item/'));
      assert.ok(fs.readFileSync(path.join(out, 'products/hardware-prints/index.html'), 'utf8').includes('data-id="test-1"'));
    } finally { fs.rmSync(f); fs.rmSync(out, { recursive: true, force: true }); }
  });
  test('正式產物只含白名單：沒有 src、scripts、tests、JSON、草稿頁', () => {
    try {
      build();
      const tops = fs.readdirSync(out);
      for (const bad of ['src', 'scripts', 'tests', 'docs', '_preview', 'package.json', 'README.md', '.github']) assert.ok(!tops.includes(bad), bad);
      for (const s of STATIC_WHITELIST) assert.ok(tops.includes(s), s);
      const files = fs.readdirSync(out, { recursive: true }).map(String);
      assert.equal(files.filter(f => f.endsWith('.json')).length, 0, '不得有任何 .json');
      assert.ok(!fs.existsSync(path.join(out, 'product')), '沒有公開商品時不應有 /product/');
      assert.ok(!fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf8').includes('/product/'));
      const r = spawnSync('node', ['scripts/check-site.mjs', OUT], { cwd: ROOT, encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  });
  test('白名單檢查會擋下混入的原始碼', () => {
    try {
      build();
      fs.mkdirSync(path.join(out, 'src/data'), { recursive: true });
      fs.writeFileSync(path.join(out, 'src/data/leak.json'), '{}');
      const r = spawnSync('node', ['scripts/check-site.mjs', OUT], { cwd: ROOT, encoding: 'utf8' });
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /白名單/);
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  });
  test('預覽版含草稿但不含 rejected，且全部 noindex', () => {
    try {
      build('--drafts');
      assert.ok(fs.existsSync(path.join(out, 'product/geprc-moz7-v2-o4-pro-7/index.html')));
      const rejected = products.filter(p => p.review?.status === 'rejected');
      for (const p of rejected) assert.ok(!fs.existsSync(path.join(out, 'product', p.slug)), p.slug);
      assert.match(fs.readFileSync(path.join(out, 'index.html'), 'utf8'), /noindex/);
      assert.match(fs.readFileSync(path.join(out, 'robots.txt'), 'utf8'), /Disallow: \//);
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  });
  test('建置拒絕輸出到 repo 根目錄', () => {
    const r = spawnSync('node', ['scripts/build.mjs', '--out', '.'], { cwd: ROOT, encoding: 'utf8' });
    assert.notEqual(r.status, 0);
  });
});
