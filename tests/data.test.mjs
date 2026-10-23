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
  description: '', specifications: [], images: [{ src: '/assets/img/builds/huan-600.webp', alt: '測試圖', rights: 'ewp_own' }], variants: [],
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
  // 以下為「後台修改後仍必須成立」的不變條件（上下架、價格、照片可由 EWP 在後台調整，不再檢查固定數量）
  test('公開商品都已核准；2 件非 FPV 玩具（rejected）不上官網', () => {
    for (const p of products.filter(p => p.published)) assert.equal(p.review.status, 'approved', p.id);
    for (const id of ['sp-56302849088', 'sp-58004035504']) assert.equal(products.find(p => p.id === id).published, false);
  });
  test('非 FPV 玩具已標記 rejected', () => {
    for (const id of ['sp-56302849088', 'sp-58004035504']) assert.equal(products.find(p => p.id === id).review.status, 'rejected');
  });
  test('十安聯名電池標示為聯名，不稱 EWP 自製', () => {
    for (const id of ['sp-57303672693', 'sp-55552267337']) { const p = products.find(x => x.id === id); assert.equal(p.seller_role, 'collab'); if (p.brand) assert.doesNotMatch(p.brand, /^電翼動力 EWP$/); }
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
      assert.equal(fs.readdirSync(path.join(out, 'product')).length, products.filter(p => p.published).length, '每件公開商品都有詳情頁');
      const sm = fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf8');
      assert.equal((sm.match(/\/product\//g) || []).length, products.filter(p => p.published).length);
      for (const p of products.filter(p => !p.published)) { assert.ok(!sm.includes(`/product/${p.slug}/`)); assert.ok(!fs.existsSync(path.join(out, 'product', p.slug))); }
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

describe('Phase 3：營業登記地址、圖片使用權、合規限制移除', () => {
  const NOTICE = '此地址僅為營業登記地址，非實體門市，不提供現場購物或臨櫃服務，請勿直接前往。商品、維修及收送件事宜，請先透過 LINE 官方帳號聯繫確認。';
  test('營業登記地址提示文字與 EWP 指定內容完全一致', () => assert.equal(site.business.address_notice, NOTICE));
  test('不公開營業時間、電話，也不設門市地址', () => {
    assert.equal(site.contact.hours.enabled, false); assert.equal(site.contact.phone.enabled, false); assert.equal(site.contact.address.enabled, false);
  });
  test('服務頁文字不暗示可直接到場送修', () => {
    const txt = JSON.stringify(services);
    for (const w of ['送件', '交件', '到店', '來店', '現場', '自取', '取貨', '門市', '親送']) assert.ok(!txt.includes(w), w);
  });
  test('公開商品圖片必須標示使用權 rights', () => {
    assert.ok(errs({ ...base(), images: [{ src: '/assets/img/builds/huan-600.webp', alt: 'x' }] }).some(e => e.includes('rights')));
    assert.ok(errs({ ...base(), images: [{ src: '/assets/img/builds/huan-600.webp', alt: 'x', rights: 'unverified' }] }).some(e => e.includes('rights')));
    assert.deepEqual(errs({ ...base(), images: [{ src: '/assets/img/builds/huan-600.webp', alt: 'x', rights: 'licensed' }] }), []);
  });
  test('listing_mode 只接受定義值', () => assert.ok(errs({ ...base(), listing_mode: 'display' }).length));
  test('EWP 決定移除合規限制：沒有任何商品帶 compliance 或 showcase 限制，整機可直接販售', () => {
    for (const p of products) { assert.equal(p.compliance, undefined, p.id); assert.notEqual(p.listing_mode, 'showcase', p.id); }
    const drone = { ...base(), id: 'd1', slug: 'd1', primary_category_id: 'complete-drones', subcategory_id: '5in' };
    assert.deepEqual(errs(drone), []);
  });
  // 描述文字由 EWP 在後台維護；這裡只確認匯入時保存的蝦皮原文仍在（review 不可由後台修改）
  test('公開商品保存蝦皮原始描述', () => {
    for (const p of products.filter(p => p.published)) assert.ok(p.review.source_description !== undefined, `${p.id} 應保存原始描述`);
  });
  test('所有商品 id 與檔名一致、slug 唯一（未被改動）', () => {
    const slugs = products.map(p => p.slug); assert.equal(new Set(slugs).size, slugs.length); assert.equal(products.length, 240);
  });
});

describe('庫存數量保密（EWP 決定：repo 公開，不存放真實庫存）', () => {
  test('商品資料、規格與蝦皮快照都沒有庫存數量', () => {
    for (const p of products) {
      assert.ok(!('stock_qty' in p), p.id);
      for (const v of p.variants || []) assert.ok(!('stock_qty' in v), p.id);
      const snap = p.review?.shopee_sales_snapshot || {};
      assert.ok(!('stock_total' in snap) && !(snap.rows || []).some(r => 'stock' in r), p.id);
    }
    const svc = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/shopee/service-listings.json'), 'utf8'));
    for (const l of Object.values(svc.listings)) assert.ok(!l.sales.some(r => 'stock' in r));
    assert.ok(!fs.readFileSync(path.join(ROOT, 'docs/shopee-import.csv'), 'utf8').includes('快照庫存'));
  });
  test('驗證會擋下任何寫回的庫存數量', () => {
    assert.ok(errs({ ...base(), stock_qty: 3 }).some(e => e.includes('stock_qty')));
    assert.ok(errs({ ...base(), variants: [{ name: 'A', price_twd: null, availability: 'unknown', stock_qty: 0 }] }).some(e => e.includes('stock_qty')));
    assert.ok(errs({ ...base(), review: { status: 'approved', shopee_sales_snapshot: { rows: [{ variation_id: '1', price: 10, stock: 5 }] } } }).some(e => e.includes('庫存')));
  });
});

describe('蝦皮媒體與價格庫存匯入', () => {
  const withMedia = products.filter(p => p.review?.source_media);
  test('240 件商品都有蝦皮媒體來源與價格庫存快照', () => {
    assert.equal(withMedia.length, 240);
    assert.equal(products.filter(p => p.review?.shopee_sales_snapshot?.rows?.length).length, 240);
  });
  test('價格／庫存列總數 912（商品＋服務型）', () => {
    const svc = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/shopee/service-listings.json'), 'utf8'));
    const n = products.reduce((a, p) => a + p.review.shopee_sales_snapshot.rows.length, 0) + Object.values(svc.listings).reduce((a, l) => a + l.sales.length, 0);
    assert.equal(n, 912);
    assert.equal(Object.keys(svc.listings).length, 4);
  });
  test('商品照片檔案存在；蝦皮匯入的照片來源可追溯；公開商品照片使用權為 EWP 自有或已授權', () => {
    for (const p of withMedia) {
      const src = new Set([p.review.source_media.cover, ...p.review.source_media.gallery].filter(Boolean));
      for (const i of p.images) {
        assert.equal(checkAssetPath(i.src), null, p.id); if (i.src_small) assert.equal(checkAssetPath(i.src_small), null, p.id);
        if (i.source_url) assert.ok(src.has(i.source_url), `${p.id} 照片來源不在蝦皮媒體清單`);
        if (p.published) assert.ok(['licensed', 'ewp_own'].includes(i.rights), `${p.id} ${i.src}`);
      }
    }
  });
  test('規格選項圖檔案存在；匯入時沒有未對應的選項圖', () => {
    let linked = new Set();
    for (const p of withMedia) for (const v of p.variants || []) if (v.image) { assert.equal(checkAssetPath(v.image.src), null); linked.add(v.image.src); }
    assert.ok(linked.size > 0);
    assert.equal(products.filter(p => p.review.unmatched_option_images?.length).length, 0);
  });
  // v2.4.0 時官網價＝蝦皮快照價 −4%；之後 EWP 可在後台改價格與供貨，所以這裡只檢查快照保留與價格規則一致
  test('蝦皮快照保留；官網價符合價格規則（最低規格價，單一價定價、多價起價）', () => {
    for (const p of products.filter(p => p.published)) {
      const snap = p.review.shopee_sales_snapshot;
      assert.equal(snap.status, 'applied', p.id); assert.equal(snap.discount_percent, 4, p.id);
      assert.ok(snap.rows.length > 0, p.id);
      const prices = p.variants.map(v => v.price_twd).filter(x => x > 0);
      if (p.price_display === 'inquiry') { assert.equal(p.price_twd, null, p.id); continue; }
      if (prices.length) {
        assert.equal(p.price_twd, Math.min(...prices), p.id);
        assert.equal(p.price_display, Math.min(...prices) === Math.max(...prices) ? 'fixed' : 'from', p.id);
      } else assert.ok(p.price_twd > 0, p.id);
    }
  });
  test('rejected 商品不公開、沒有套用蝦皮快照', () => {
    for (const p of products.filter(p => p.review.status === 'rejected')) { assert.equal(p.published, false); assert.notEqual(p.review.shopee_sales_snapshot.status, 'applied'); }
  });
  test('變體對應蝦皮規格 ID，且每個 ID 都在快照中', () => {
    for (const p of products) for (const v of (p.variants || []).filter(v => v.shopee_variation_id))
      assert.ok(p.review.shopee_sales_snapshot.rows.some(r => r.variation_id === v.shopee_variation_id), `${p.id} ${v.name}`);
  });
  test('approve-snapshot：dry-run 不寫入；正式執行才套用價格與圖片使用權（不公開）；--stock 已停用', () => {
    const id = 'sp-57918649179';
    const f = path.join(PRODUCTS_DIR, `${id}.json`);
    const orig = fs.readFileSync(f, 'utf8');
    try {
      const pre = JSON.parse(orig);
      pre.published = false; pre.review.status = 'draft'; pre.price_twd = null; pre.price_display = 'inquiry'; pre.availability = 'unknown';
      pre.images.forEach(i => { i.rights = 'unverified'; }); pre.variants.forEach(v => { v.price_twd = null; v.availability = 'unknown'; });
      pre.review.shopee_sales_snapshot.status = 'snapshot_only';
      const preText = JSON.stringify(pre, null, 2) + '\n';
      fs.writeFileSync(f, preText);
      execFileSync('node', ['scripts/approve-snapshot.mjs', id, '--prices', '--image-rights', 'ewp_own', '--discount', '4', '--dry-run'], { cwd: ROOT });
      assert.equal(fs.readFileSync(f, 'utf8'), preText);
      assert.throws(() => execFileSync('node', ['scripts/approve-snapshot.mjs', id, '--stock'], { cwd: ROOT, stdio: 'pipe' }), '--stock 已停用（庫存保密）');
      execFileSync('node', ['scripts/approve-snapshot.mjs', id, '--prices', '--image-rights', 'ewp_own', '--discount', '4'], { cwd: ROOT });
      let p = JSON.parse(fs.readFileSync(f, 'utf8'));
      const snap = p.review.shopee_sales_snapshot;
      assert.equal(p.price_twd, Math.round(snap.price_min * 0.96));
      assert.ok(p.variants.every(v => v.price_twd > 0));
      assert.ok(p.images.every(i => i.rights === 'ewp_own'));
      assert.equal(p.published, false, '沒有 --publish 不會上架');
      execFileSync('node', ['scripts/approve-snapshot.mjs', id, '--publish'], { cwd: ROOT });
      p = JSON.parse(fs.readFileSync(f, 'utf8'));
      assert.equal(p.published, true); assert.equal(p.review.status, 'approved');
    } finally { fs.writeFileSync(f, orig); }
  });
  test('正式產物只含公開商品圖片；混入未公開商品圖片會被擋下', () => {
    const out = path.join(ROOT, '_test');
    try {
      execFileSync('node', ['scripts/build.mjs', '--out', '_test'], { cwd: ROOT });
      const dirs = fs.readdirSync(path.join(out, 'assets/img/products'));
      assert.equal(dirs.length, products.filter(p => p.published).length); assert.ok(!dirs.includes('sp-56302849088') && !dirs.includes('sp-58004035504'));
      fs.mkdirSync(path.join(out, 'assets/img/products/sp-56302849088'), { recursive: true });
      fs.copyFileSync(path.join(ROOT, 'assets/img/products/sp-56302849088/01.webp'), path.join(out, 'assets/img/products/sp-56302849088/01.webp'));
      const r = spawnSync('node', ['scripts/check-site.mjs', '_test'], { cwd: ROOT, encoding: 'utf8' });
      assert.notEqual(r.status, 0); assert.match(r.stderr, /未公開商品圖片/);
      fs.rmSync(out, { recursive: true, force: true });
      execFileSync('node', ['scripts/build.mjs', '--out', '_test', '--drafts'], { cwd: ROOT });
      assert.ok(fs.existsSync(path.join(out, 'assets/img/products/sp-42781322918/01.webp')));
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  });
});
