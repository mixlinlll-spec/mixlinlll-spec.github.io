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

describe('Phase 3：營業登記地址、作品介紹模式、合規與圖片使用權', () => {
  const NOTICE = '此地址僅為營業登記地址，非實體門市，不提供現場購物或臨櫃服務，請勿直接前往。商品、維修及收送件事宜，請先透過 LINE 官方帳號聯繫確認。';
  test('營業登記地址提示文字與 EWP 指定內容完全一致', () => assert.equal(site.business.address_notice, NOTICE));
  test('不公開營業時間、電話，也不設門市地址', () => {
    assert.equal(site.contact.hours.enabled, false); assert.equal(site.contact.phone.enabled, false); assert.equal(site.contact.address.enabled, false);
  });
  test('服務頁文字不暗示可直接到場送修', () => {
    const txt = JSON.stringify(services);
    for (const w of ['送件', '交件', '到店', '來店', '現場', '自取', '取貨', '門市', '親送']) assert.ok(!txt.includes(w), w);
  });
  const drone = () => ({ ...base(), id: 'd1', slug: 'd1', primary_category_id: 'complete-drones', subcategory_id: '5in', images: [{ src: '/assets/img/builds/huan-600.webp', alt: 'x', rights: 'ewp_own' }] });
  test('整機公開時必須設定 listing_mode', () => assert.ok(errs(drone()).some(e => e.includes('listing_mode'))));
  test('整機以販售模式公開必須合規 cleared', () => {
    assert.ok(errs({ ...drone(), listing_mode: 'sale', compliance: { status: 'pending', items: [] } }).length);
    assert.ok(errs({ ...drone(), listing_mode: 'sale' }).some(e => e.includes('cleared')));
    assert.deepEqual(errs({ ...drone(), listing_mode: 'sale', compliance: { status: 'cleared', items: [] } }), []);
  });
  test('作品介紹（showcase）可在合規待確認時公開，但不構成販售', () => assert.deepEqual(errs({ ...drone(), listing_mode: 'showcase', compliance: { status: 'pending', items: [] } }), []));
  test('一般商品合規待確認時不得公開', () => assert.ok(errs({ ...base(), images: [{ src: '/assets/img/builds/huan-600.webp', alt: 'x', rights: 'ewp_own' }], compliance: { status: 'pending', items: [] } }).length));
  test('公開商品圖片必須標示使用權 rights', () => {
    assert.ok(errs({ ...base(), images: [{ src: '/assets/img/builds/huan-600.webp', alt: 'x' }] }).some(e => e.includes('rights')));
    assert.ok(errs({ ...base(), images: [{ src: '/assets/img/builds/huan-600.webp', alt: 'x', rights: 'shopee' }] }).some(e => e.includes('rights')));
    assert.deepEqual(errs({ ...base(), images: [{ src: '/assets/img/builds/huan-600.webp', alt: 'x', rights: 'licensed' }] }), []);
  });
  test('listing_mode 與 compliance.status 只接受定義值', () => {
    assert.ok(errs({ ...base(), listing_mode: 'display' }).length);
    assert.ok(errs({ ...base(), published: false, compliance: { status: 'ok' } }).length);
  });
  const batch = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/first-batch.json'), 'utf8')).items;
  test('首批名單 20 件、A 組 12、B 組 8，且都存在', () => {
    assert.equal(batch.length, 20);
    assert.deepEqual(batch.filter(b => b.group === 'A').map(b => b.no), [1, 2, 3, 7, 8, 9, 10, 11, 12, 13, 14, 17]);
    assert.deepEqual(batch.filter(b => b.group === 'B').map(b => b.no), [4, 5, 6, 15, 16, 18, 19, 20]);
    for (const b of batch) assert.ok(products.find(p => p.id === b.id), b.id);
  });
  test('首批商品全部未公開、未核准、價格與供貨未被推估填入', () => {
    for (const b of batch) {
      const p = products.find(x => x.id === b.id);
      assert.equal(p.published, false); assert.notEqual(p.review.status, 'approved');
      assert.equal(p.price_twd, null); assert.equal(p.price_display, 'inquiry'); assert.equal(p.availability, 'unknown');
      assert.equal(p.review.specs_confirmed, false); assert.equal(p.review.shopee_url_verified, false);
      assert.ok(Array.isArray(p.review.missing) && p.review.missing.length, `${b.id} 應列出待補資料`);
      for (const v of p.variants) { assert.equal(v.price_twd, null); assert.equal(v.availability, 'unknown'); }
      for (const s of p.specifications) assert.ok(s.source, `${b.id} 規格 ${s.key} 應標示來源`);
    }
  });
  test('三款整機為作品介紹模式且合規待確認', () => {
    for (const id of ['sp-50367700235', 'sp-29295757187', 'sp-44561107171']) {
      const p = products.find(x => x.id === id); assert.equal(p.listing_mode, 'showcase'); assert.equal(p.compliance.status, 'pending');
    }
  });
  test('電池與無線電相關商品列出合規確認項目', () => {
    for (const id of ['sp-46751039159', 'sp-52105308338', 'sp-57303672693', 'sp-49207375975', 'sp-48617760691']) {
      const p = products.find(x => x.id === id); assert.equal(p.compliance.status, 'pending'); assert.ok(p.compliance.items.length);
    }
  });
  test('商品描述不含未核准的保固承諾或蝦皮站內用語', () => {
    for (const b of batch) { const d = products.find(x => x.id === b.id).description; for (const w of ['保固', '私訊', '本賣場', '聊聊']) assert.ok(!d.includes(w), `${b.id} 含「${w}」`); }
  });
  test('所有商品 id 與檔名一致、slug 唯一（未被改動）', () => {
    const slugs = products.map(p => p.slug); assert.equal(new Set(slugs).size, slugs.length); assert.equal(products.length, 240);
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
  test('每件商品的主圖＋細節圖都已匯入、檔案存在、使用權為 unverified', () => {
    let total = 0;
    for (const p of withMedia) {
      const src = new Set([p.review.source_media.cover, ...p.review.source_media.gallery].filter(Boolean));
      const imported = p.images.filter(i => i.source_url);
      assert.equal(imported.length, src.size, p.id);
      for (const i of imported) { assert.equal(i.rights, 'unverified'); assert.equal(checkAssetPath(i.src), null); assert.equal(checkAssetPath(i.src_small), null); }
      assert.equal(imported[0]?.role, 'cover', `${p.id} 第一張應為主圖`);
      total += imported.length;
    }
    assert.equal(total, 1092);
  });
  test('規格選項圖全部對應到變體', () => {
    let linked = new Set();
    for (const p of withMedia) for (const v of p.variants || []) if (v.image) { assert.equal(checkAssetPath(v.image.src), null); linked.add(v.image.src); }
    assert.equal(linked.size, 303);
    assert.equal(products.filter(p => p.review.unmatched_option_images?.length).length, 0);
  });
  test('快照尚未套用：所有商品與變體的公開價格為空、供貨未知', () => {
    for (const p of products) {
      assert.equal(p.price_twd, null, p.id); assert.equal(p.availability, 'unknown', p.id);
      assert.notEqual(p.review.shopee_sales_snapshot.status, 'applied');
      for (const v of p.variants || []) { assert.equal(v.price_twd, null); assert.equal(v.availability, 'unknown'); }
    }
  });
  test('變體對應蝦皮規格 ID，且每個 ID 都在快照中', () => {
    for (const p of products) for (const v of (p.variants || []).filter(v => v.shopee_variation_id))
      assert.ok(p.review.shopee_sales_snapshot.rows.some(r => r.variation_id === v.shopee_variation_id), `${p.id} ${v.name}`);
  });
  test('approve-snapshot：dry-run 不寫入；正式執行才套用價格、庫存與圖片使用權（不公開）', () => {
    const id = 'sp-57918649179';
    const f = path.join(PRODUCTS_DIR, `${id}.json`);
    const orig = fs.readFileSync(f, 'utf8');
    try {
      execFileSync('node', ['scripts/approve-snapshot.mjs', id, '--prices', '--stock', '--image-rights', 'ewp_own', '--dry-run'], { cwd: ROOT });
      assert.equal(fs.readFileSync(f, 'utf8'), orig);
      execFileSync('node', ['scripts/approve-snapshot.mjs', id, '--prices', '--stock', '--image-rights', 'ewp_own'], { cwd: ROOT });
      const p = JSON.parse(fs.readFileSync(f, 'utf8'));
      const snap = p.review.shopee_sales_snapshot;
      assert.equal(p.price_twd, snap.price_min); assert.equal(p.price_display, snap.price_min === snap.price_max ? 'fixed' : 'from');
      assert.ok(p.variants.every(v => v.price_twd > 0));
      assert.ok(p.images.every(i => i.rights === 'ewp_own'));
      assert.equal(p.published, false); assert.notEqual(p.review.status, 'approved');
      assert.equal(snap.status, 'applied');
    } finally { fs.writeFileSync(f, orig); }
  });
  test('正式產物不含未公開商品圖片；預覽版含草稿圖片', () => {
    const out = path.join(ROOT, '_test');
    try {
      execFileSync('node', ['scripts/build.mjs', '--out', '_test'], { cwd: ROOT });
      assert.ok(!fs.existsSync(path.join(out, 'assets/img/products')) || fs.readdirSync(path.join(out, 'assets/img/products')).length === 0);
      fs.mkdirSync(path.join(out, 'assets/img/products/sp-42781322918'), { recursive: true });
      fs.copyFileSync(path.join(ROOT, 'assets/img/products/sp-42781322918/01.webp'), path.join(out, 'assets/img/products/sp-42781322918/01.webp'));
      const r = spawnSync('node', ['scripts/check-site.mjs', '_test'], { cwd: ROOT, encoding: 'utf8' });
      assert.notEqual(r.status, 0); assert.match(r.stderr, /未公開商品圖片/);
      fs.rmSync(out, { recursive: true, force: true });
      execFileSync('node', ['scripts/build.mjs', '--out', '_test', '--drafts'], { cwd: ROOT });
      assert.ok(fs.existsSync(path.join(out, 'assets/img/products/sp-42781322918/01.webp')));
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  });
});
