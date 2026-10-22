#!/usr/bin/env node
// 電翼動力 EWP 靜態網站產生器（無外部套件）。
//   node scripts/build.mjs              → 產生正式版到 dist/（只含 published=true 商品；GitHub Actions 部署此資料夾）
//   node scripts/build.mjs --drafts     → 產生「含草稿」預覽版到 _preview/（noindex，不提交、不部署）
//   node scripts/build.mjs --check      → 只驗證資料，不輸出
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadAll, validateProducts, AVAILABILITY, STATIC_WHITELIST, isRejected } from './lib/data.mjs';
import { isShowcase, esc, attr, url, layout, productCard, breadcrumbs, breadcrumbsJsonLd, picture, priceText, availabilityText, roleText, lineButton, shopeeButton, shopeeUrlFor } from './lib/html.mjs';

const args = process.argv.slice(2);
const DRAFTS = args.includes('--drafts');
const CHECK = args.includes('--check');
const OUT = path.resolve(ROOT, args.includes('--out') ? args[args.indexOf('--out') + 1] : (DRAFTS ? '_preview' : 'dist'));
if (OUT === ROOT || !OUT.startsWith(ROOT + path.sep)) { console.error('✖ 輸出資料夾必須是 repo 內的子資料夾（例如 dist）'); process.exit(1); }

const data = loadAll();
const { site, categories, builds, services, products } = data;

// ---------- 驗證 ----------
const { errors, warnings } = validateProducts(products, categories);
for (const s of services) for (const k of ['id', 'slug', 'name', 'summary']) if (!s[k]) errors.push(`services.json ${s.id}: 缺少 ${k}`);
for (const b of builds) for (const k of ['id', 'slug', 'name_zh', 'summary']) if (!b[k]) errors.push(`builds.json ${b.id}: 缺少 ${k}`);
for (const [k, c] of Object.entries(site.contact)) {
  if (typeof c !== 'object' || !c.enabled) continue;
  if (!c.url && !c.value) errors.push(`site.json contact.${k}: enabled=true 但沒有 url/value`);
  if (c.url && !/^https:\/\//.test(c.url)) errors.push(`site.json contact.${k}: 網址必須是 https://`);
}
if (site.contact.line.enabled && site.contact.line.qr_image && !fs.existsSync(path.join(ROOT, site.contact.line.qr_image))) errors.push('LINE QR 圖檔不存在');
if (warnings.length) console.warn(`⚠ 警告 ${warnings.length} 筆\n  ` + warnings.slice(0, 10).join('\n  ') + (warnings.length > 10 ? '\n  …' : ''));
if (errors.length) { console.error(`✖ 資料驗證失敗 ${errors.length} 筆：\n  ` + errors.join('\n  ')); process.exit(1); }
const pubCount = products.filter(p => p.published).length;
console.log(`✓ 資料驗證通過：商品 ${products.length} 筆（公開 ${pubCount}、草稿 ${products.length - pubCount}）`);
if (CHECK) process.exit(0);

// ---------- Context ----------
// rejected（EWP 決定不上官網）在正式版與預覽版都不產生
const visible = products.filter(p => !isRejected(p) && (DRAFTS || p.published));
const catMap = new Map(categories.map(c => [c.id, c]));
const ctx = { site, categories, catMap, drafts: DRAFTS, version: process.env.EWP_VERSION || '2' };
const BASE = site.base_url;
const generated = [];
function write(rel, html) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  generated.push(rel);
}
const page = (rel, opts) => write(rel, layout(ctx, opts));
function ctaPrimary(p) {
  if (p.cta_primary) return p.cta_primary;
  if (p.seller_role === 'service' || p.seller_role === 'ewp_assembled') return 'line';
  if (['complete-drones', 'power-battery'].includes(p.primary_category_id) && p.seller_role === 'ewp_original') return 'line';
  return 'shopee';
}
const biz = site.business;
const bizBlock = (title = '營業登記資訊') => biz ? `<section class="wrap biz"><h2 class="h3">${esc(title)}</h2><dl class="biz-dl">
  <div><dt>登記名稱</dt><dd>${esc(biz.legal_name)}</dd></div>
  <div><dt>統一編號</dt><dd>${esc(biz.tax_id)}</dd></div>
  <div><dt>登記地址</dt><dd>${esc(biz.registered_address)}<p class="biz-notice" role="note">${esc(biz.address_notice)}</p></dd></div>
</dl></section>` : '';
const sortProducts = list => [...list].sort((a, b) => (b.featured - a.featured) || b.updated_at.localeCompare(a.updated_at) || a.name_zh.localeCompare(b.name_zh, 'zh-Hant'));
const cardList = (list, cls = 'pgrid') => `<ul class="${cls}">${list.map(p => productCard(p, ctx)).join('')}</ul>`;
// 商品列表：首屏只顯示前 24 件（其餘先 hidden，由 catalog.js 依篩選與「載入更多」顯示），前 4 張圖片不延遲載入以加快 LCP
const CATALOG_PAGE = 24;
const catalogList = list => `<ul class="pgrid catalog-grid">${list.map((p, i) => productCard(p, ctx, { hidden: i >= CATALOG_PAGE, eager: i < 4 })).join('')}</ul><noscript><style>.catalog-grid .pcard[hidden]{display:flex!important}</style></noscript>`;
const sectionHead = (eyebrow, title, extra = '') => `<div class="section-head"><div><p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2></div>${extra}</div>`;
const pageHead = (eyebrow, title, lead, crumbs) => `<div class="page-head wrap">${crumbs || ''}<p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}</div>`;
const contactCta = (title = '還不確定怎麼選？', text = '告訴我們你的用途、預算與現有設備，一起把配置想清楚。') => `<section class="wrap cta-band"><div><h2>${esc(title)}</h2><p>${esc(text)}</p></div><div class="actions">${lineButton(site, 'LINE 詢價', 'btn btn-line')}${shopeeButton(site, '蝦皮賣場')}<a class="btn" href="/contact/">所有聯絡方式</a></div></section>`;

// ---------- 首頁 ----------
function homePage() {
  const featuredBuilds = builds.filter(b => b.featured).sort((a, b) => a.order - b.order);
  const huan = builds.find(b => b.id === 'huan');
  const newest = sortProducts(visible).slice(0, 8);
  const quick = [
    ['穿越機整機', '/products/complete-drones/', '自製機型與其他品牌整機'],
    ['零件', '/products/frames-parts/', '機架、馬達、飛控、圖傳'],
    ['電池', '/batteries/', '18650／21700 電池組與 LiPo'],
    ['客製服務', '/services/custom-build/', '依用途討論配置'],
    ['維修調校', '/services/repair/', '故障排查與設定'],
    ['知識庫', '/fpv-help.html', '91 則玩家常見問題'],
  ];
  const faq = [
    ['第一次接觸 FPV，要先準備什麼？', '先整理已有的遙控器、眼鏡與充電設備，再說明想練習花飛、長航或拍攝。這些資訊有助於確認接收機與圖傳相容性，縮小整機配置範圍。'],
    ['詢問維修時，需要提供哪些資訊？', '提供機型、飛控與電調型號、韌體版本、故障發生經過，以及清楚的接線照片。如果有設定備份、錯誤畫面或黑盒檔案，也可以一起準備。'],
    ['網頁上的機型可以調整配置嗎？', '可以依用途討論圖傳、接收機與配件選擇。頁面為代表配置介紹，實際零件、供貨狀況、價格與交期請於委託前確認。'],
  ];
  const body = `
<section class="hero wrap">
  <div class="hero-top eyebrow"><span><span class="red">EWP /</span> FPV WORKSHOP</span><span class="hide-sm">TAIWAN · BUILD / TUNE / FLY</span></div>
  <div class="hero-grid">
    <div>
      <h1><span>從親手組裝，</span><span>到自由<span class="red">飛翔。</span></span></h1>
      <p class="lead">每一個焊點、每一次調校，都為了手感對的那一刻。電翼動力，讓熱愛飛行的人，找到屬於自己的 FPV。</p>
      <form class="hero-search" action="/products/" method="get" role="search">
        <label for="hero-q" class="sr-only">搜尋商品</label>
        <input id="hero-q" type="search" name="q" placeholder="搜尋整機、馬達、電池、螺絲…">
        <button class="btn btn-primary" type="submit">搜尋</button>
      </form>
      <div class="actions"><a class="btn btn-primary" href="/products/">瀏覽所有商品 <span aria-hidden="true">→</span></a>${lineButton(site, 'LINE 詢價', 'btn btn-line')}</div>
      <div class="hero-note">BUILT WITH PURPOSE.<br>READY TO FLY.</div>
    </div>
    <figure class="feature">
      ${picture(huan.images[0], { lazy: false, sizes: '(max-width: 900px) 100vw, 600px' })}
      <figcaption><strong>幻 / HUAN</strong><span>5” FREESTYLE · 6S</span></figcaption>
    </figure>
  </div>
</section>
<section class="wrap quick" aria-label="快速入口">
  <ul class="quick-grid">${quick.map(([t, h, d], i) => `<li><a href="${h}"><span class="quick-num">0${i + 1}</span><strong>${t}</strong><span>${d}</span></a></li>`).join('')}</ul>
</section>
<section id="builds" class="wrap">
  ${sectionHead('01 / SELECTED BUILDS', '不同尺寸，同一份飛行熱情。', '<p>從小型花飛到五吋主力，用飛行用途決定配置，讓每一台機器有自己的個性。</p>')}
  <div class="projects">${featuredBuilds.map((b, i) => `<article class="project">
    <div class="project-num">BUILD 0${i + 1} / ${esc(b.size.replace(' 吋', ' INCH'))}</div>
    <h3><a href="${url.build(b)}">${esc(b.name_zh)}</a></h3>
    <div class="english">${esc(b.name_en)} · ${esc(b.use)}</div>
    <p>${esc(b.summary)}</p>
    <div class="tags">${b.highlights.map(h => `<span>${esc(h)}</span>`).join('')}</div>
    <a class="more" href="${url.build(b)}">查看機型 →</a>
  </article>`).join('')}</div>
  <p class="section-more"><a href="/builds/">所有 EWP 自製機型 →</a></p>
</section>
<section class="wrap">
  ${sectionHead('02 / CATALOG', '依你要買的東西找。', '<p>從 M2／M3 螺絲到七吋長航整機，依分類、品牌、尺寸與關鍵字快速篩選。</p>')}
  <ul class="cat-grid">${categories.map(c => `<li><a href="${url.category(c)}"><strong>${esc(c.name)}</strong><span>${esc(c.summary)}</span></a></li>`).join('')}</ul>
</section>
${newest.length ? `<section class="wrap">${sectionHead('NEW', '新上架', '<p><a href="/products/">查看全部 →</a></p>')}${cardList(newest)}</section>` : ''}
<section id="workshop" class="wrap workshop">
  <div class="services-split">
    <div><p class="eyebrow">03 / THE WORKSHOP</p><h2>不只組好，<br>也把細節調好。</h2><p class="muted">FPV 的樂趣來自飛行，也來自理解機器。從需求討論、零件搭配到故障排查，把每一個環節串在一起。</p><p><a class="btn" href="/services/">所有服務 →</a></p></div>
    <div>${[
      ['custom-build', '客製整機與組裝', '花飛、長航與影視機，依拍攝需求、圖傳系統與既有設備，討論適合的機架與動力配置。'],
      ['battery-pack', '動力電池與外場電包', '18650、21700 鋰電池組，依設備電壓、電流需求與攜帶方式評估配置，涵蓋飛行與外場供電。'],
      ['repair', '維修、調參與黑盒分析', '飛控、電調、接收機、圖傳與 OSD 問題排查，搭配設定檢查與飛行紀錄分析，找出症狀背後的原因。'],
      ['3d-printing', '3D 列印與機體配件', 'TPU 保護件、天線座與機體配件，讓安裝、走線與落地保護更貼近實際使用需求。'],
    ].map(([id, t, d], i) => `<article class="service-row"><span class="num">0${i + 1}</span><div><h3><a href="/services/${id}/">${t}</a></h3><p>${d}</p></div></article>`).join('')}</div>
  </div>
</section>
<section id="about" class="wrap">
  <div class="about-band">
    <div class="about-grid"><div><p class="eyebrow">04 / ABOUT EWP</p><h2>電翼動力<br>把熱愛，做成能飛的作品。</h2></div>
    <p>從一台穿越機開始，把組裝、焊接、調校與維修，變成日常的一部分。電翼動力專注 FPV 整機與動力系統，也持續探索小型花飛、長航與影視機的可能。<br><br>我們相信，了解自己的機器，是享受飛行的一部分。</p></div>
    <div class="motto" aria-label="Build. Tune. Fly."><span>BUILD.</span><span>TUNE.</span><span>FLY.</span></div>
  </div>
</section>
<section class="wrap faq">
  ${sectionHead('05 / BEFORE WE BUILD', '開始之前，你可能想知道。')}
  ${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
</section>
<section id="contact" class="wrap">${contactCta('下一台機器，從你的想法開始。', '整機、電池或維修需求，先告訴我們你的設備與用途，一起把配置想清楚。').replace('<section class="wrap cta-band">', '<div class="cta-band">').replace(/<\/section>$/, '</div>')}</section>`;
  page('index.html', {
    path: '/', body, active: 'home', bodyClass: 'home',
    jsonld: [{ '@context': 'https://schema.org', '@type': 'Organization', name: '電翼動力 EWP', // 使用 Organization（非 LocalBusiness／Store）：登記地址僅作為公司登記資訊，不宣稱為對外營業據點
      ...(biz ? { legalName: biz.legal_name, taxID: biz.tax_id, address: { '@type': 'PostalAddress', name: '營業登記地址（非實體門市，不提供現場服務）', streetAddress: biz.registered_address, addressCountry: 'TW' } } : {}),
      ...(site.contact.line.enabled ? { contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', url: site.contact.line.url, areaServed: 'TW', availableLanguage: 'zh-Hant' } } : {}), url: BASE + '/', logo: BASE + '/assets/img/favicon.svg',
      sameAs: [site.contact.line, site.contact.shopee, site.contact.instagram, site.contact.facebook, site.contact.youtube].filter(c => c.enabled && c.url).map(c => c.url) },
      { '@context': 'https://schema.org', '@type': 'WebSite', name: '電翼動力 EWP', url: BASE + '/', potentialAction: { '@type': 'SearchAction', target: BASE + '/products/?q={search_term_string}', 'query-input': 'required name=search_term_string' } }],
  });
}

// ---------- 商品列表（全部／分類）----------
function catalogSection(list, { category } = {}) {
  const sorted = sortProducts(list);
  const subChips = category ? `<div class="chips" role="group" aria-label="子分類">
      <button type="button" class="chip" data-sub-chip="" aria-pressed="true">全部</button>
      ${category.subcategories.map(s => `<button type="button" class="chip" data-sub-chip="${attr(s.id)}" aria-pressed="false">${esc(s.name)}</button>`).join('')}
    </div>` : '';
  // 伺服器端先決定哪些篩選器有資料，避免 JS 載入後才隱藏造成版面位移（CLS）
  const has = {
    brand: list.some(p => p.brand), size: list.some(p => p.compatible_sizes?.length),
    video: list.some(p => p.video_system), cells: list.some(p => p.battery_cells?.length),
  };
  const select = (name, label, opts = null) => `<div class="field" data-field="${name}"${!opts && has[name] === false ? ' hidden' : ''}><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}" ${opts ? 'data-static' : `data-facet="${name}"`}><option value="">全部</option>${(opts || []).map(([v, t]) => `<option value="${attr(v)}">${esc(t)}</option>`).join('')}</select></div>`;
  return `<section class="wrap catalog" id="catalog" data-scope="${category ? attr(category.id) : ''}">
  ${subChips}
  <div class="catalog-layout">
    <aside class="filters">
      <div class="filters-box" id="filters-box">
        <p class="filters-title" aria-hidden="true">搜尋與篩選</p>
        <button type="button" class="filters-toggle" aria-expanded="false" aria-controls="catalog-form">搜尋與篩選 <span aria-hidden="true">＋</span></button>
        <form id="catalog-form" class="filters-form" role="search" onsubmit="return false">
          <div class="field"><label for="catalog-q">關鍵字</label><input id="catalog-q" type="search" name="q" placeholder="品名、品牌、型號、規格" autocomplete="off"></div>
          ${category ? `<input type="hidden" name="sub" id="f-sub">` : select('cat', '分類', categories.map(c => [c.id, c.name]))}
          ${select('brand', '品牌')}
          ${select('size', '尺寸')}
          ${select('video', '圖傳系統')}
          ${select('cells', '電壓（S 數）')}
          ${select('avail', '供貨狀態', Object.entries(AVAILABILITY))}
          <fieldset class="field price-range"><legend>價格（NT$）</legend><div class="price-inputs"><label class="sr-only" for="f-pmin">最低價</label><input id="f-pmin" type="number" inputmode="numeric" min="0" name="pmin" placeholder="最低"><span aria-hidden="true">–</span><label class="sr-only" for="f-pmax">最高價</label><input id="f-pmax" type="number" inputmode="numeric" min="0" name="pmax" placeholder="最高"></div><small>設定價格後，詢價商品不會顯示。</small></fieldset>
          <button type="button" class="btn btn-block" data-reset>清除篩選</button>
        </form>
      </div>
    </aside>
    <div class="results">
      <h2 class="sr-only">商品列表</h2>
      <div class="results-bar">
        <p class="results-count" id="results-count" aria-live="polite">${sorted.length ? `共 ${sorted.length} 件商品` : '目前沒有公開商品'}</p>
        <div class="field field-inline"><label for="f-sort">排序</label><select id="f-sort" name="sort"><option value="">推薦</option><option value="new">最新上架</option><option value="price-asc">價格低→高</option><option value="price-desc">價格高→低</option><option value="name">名稱</option></select></div>
      </div>
      ${catalogList(sorted)}
      <div class="empty" id="catalog-empty" ${sorted.length ? 'hidden' : ''}>
        <h2>${sorted.length ? '沒有符合條件的商品' : '商品資料整理中'}</h2>
        <p>${sorted.length ? '試試其他關鍵字，或清除篩選條件。也可以直接透過 LINE 詢問，我們協助找料。' : '此分類的商品正在整理上架。需要的零件或整機，歡迎直接透過 LINE 或蝦皮賣場詢問。'}</p>
        <div class="actions">${sorted.length ? '<button type="button" class="btn" data-reset>清除篩選</button>' : ''}${lineButton(site, 'LINE 詢問', 'btn btn-line')}${shopeeButton(site, '蝦皮賣場')}</div>
      </div>
      <div class="load-more"><button type="button" class="btn" id="load-more" hidden>載入更多</button></div>
    </div>
  </div>
</section>`;
}

function productsIndex() {
  const crumbs = [{ name: '首頁', href: '/' }, { name: '商品商城' }];
  const body = `${pageHead('PRODUCTS', '商品商城', '依分類、品牌、尺寸與關鍵字搜尋。所有價格與供貨以頁面標示為準；標示「詢價」的商品請透過 LINE 或蝦皮聊聊確認。', breadcrumbs(crumbs))}
<nav class="wrap cat-strip" aria-label="商品分類"><ul>${categories.map(c => `<li><a href="${url.category(c)}">${esc(c.name)}</a></li>`).join('')}</ul></nav>
${catalogSection(visible)}
${contactCta('找不到需要的零件？', '提供型號或照片，我們協助確認相容性與找料。')}`;
  page('products/index.html', { title: '商品商城', description: 'FPV 穿越機整機、機架、馬達、飛控、圖傳、電池、螺絲五金與工具，依分類、品牌與尺寸搜尋。', path: '/products/', body, active: 'products', scripts: ['/assets/js/catalog.js'], jsonld: [breadcrumbsJsonLd(crumbs, BASE)] });
}

function categoryPages() {
  for (const c of categories) {
    const list = visible.filter(p => p.primary_category_id === c.id);
    const crumbs = [{ name: '首頁', href: '/' }, { name: '商品商城', href: '/products/' }, { name: c.name, href: url.category(c) }];
    const body = `${pageHead(c.name_en.toUpperCase(), c.name, c.summary, breadcrumbs(crumbs))}
${catalogSection(list, { category: c })}
${contactCta()}`;
    page(`products/${c.id}/index.html`, { title: c.name, description: `${c.name}：${c.summary}`, path: url.category(c), body, active: 'products', scripts: ['/assets/js/catalog.js'], jsonld: [breadcrumbsJsonLd(crumbs, BASE)] });
  }
}

// ---------- 商品詳情 ----------
function productPages() {
  for (const p of visible) {
    const c = catMap.get(p.primary_category_id);
    const sub = c.subcategories.find(s => s.id === p.subcategory_id);
    const crumbs = [{ name: '首頁', href: '/' }, { name: '商品商城', href: '/products/' }, { name: c.name, href: url.category(c) }, ...(sub ? [{ name: sub.name, href: url.sub(c, sub) }] : []), { name: p.name_zh }];
    const shopee = shopeeUrlFor(p, site);
    // CTA 優先序（EWP 2026-10-22 決定）：一般現貨商品蝦皮優先；客製整機、自製電池、組裝與服務 LINE 優先。商品可用 cta_primary 個別指定。
    // showcase（作品／機型介紹）：不顯示價格、供貨與購買按鈕，只提供客製組裝諮詢
    const showcase = isShowcase(p);
    const linePrimary = showcase || ctaPrimary(p) === 'line';
    const line = p.line_inquiry_enabled || showcase ? lineButton(site, showcase ? 'LINE 洽詢客製組裝' : linePrimary ? 'LINE 詢價／客製諮詢' : 'LINE 詢價', 'btn btn-line') : '';
    const shopeeBtn = shopee && !showcase ? shopeeButton(site, '到蝦皮購買', linePrimary ? 'btn' : 'btn btn-primary', shopee) : '';
    const ctas = showcase ? line + '<a class="btn" href="/services/custom-build/">客製組裝服務</a>' : linePrimary ? line + shopeeBtn : shopeeBtn + line;
    const imgs = p.images || [];
    const gallery = imgs.length ? `<div class="gallery" data-gallery>
        <div class="gallery-main">${picture(imgs[0], { lazy: false, sizes: '(max-width: 900px) 100vw, 640px' })}</div>
        ${imgs.length > 1 ? `<ul class="gallery-thumbs">${imgs.map((im, i) => `<li><button type="button" data-index="${i}" aria-label="顯示第 ${i + 1} 張圖片" aria-pressed="${i === 0}" data-src="${attr(im.src)}" data-alt="${attr(im.alt)}">${picture({ ...im, fallback: undefined, src: im.src_small || im.src, src_small: undefined }, { sizes: '96px' })}</button></li>`).join('')}</ul>` : ''}
      </div>` : `<div class="gallery gallery-empty"><div class="img-ph"><span>EWP</span></div><p class="muted">商品照片準備中</p></div>`;
    const related = sortProducts(visible.filter(x => x.id !== p.id && x.primary_category_id === p.primary_category_id))
      .sort((a, b) => (b.subcategory_id === p.subcategory_id) - (a.subcategory_id === p.subcategory_id)).slice(0, 4);
    const variants = p.variants?.length ? (showcase
      ? `<section class="pd-block"><h2>可選配置</h2><ul class="tags">${p.variants.map(v => `<li>${esc(v.name)}</li>`).join('')}</ul></section>`
      : `<section class="pd-block"><h2>規格選項</h2><div class="table-wrap"><table class="table"><thead><tr><th scope="col">選項</th><th scope="col">SKU</th><th scope="col">價格</th><th scope="col">供貨</th></tr></thead><tbody>${p.variants.map(v => `<tr><td>${v.image ? `<img class="var-thumb" src="${attr(v.image.src)}" alt="" width="40" height="40" loading="lazy">` : ''}${esc(v.name)}</td><td>${esc(v.sku || '—')}</td><td>${v.price_twd && p.price_display !== 'inquiry' ? `NT$ ${Number(v.price_twd).toLocaleString('en-US')}` : '詢價'}</td><td>${esc(availabilityText(v.availability || p.availability))}</td></tr>`).join('')}</tbody></table></div></section>`) : '';
    const specs = p.specifications?.length ? `<section class="pd-block"><h2>規格</h2><div class="table-wrap"><table class="table spec"><tbody>${p.specifications.map(s => `<tr><th scope="row">${esc(s.key)}</th><td>${esc(s.value)}</td></tr>`).join('')}</tbody></table></div></section>` : '';
    const compat = (p.compatible_sizes?.length || p.tags?.length || p.video_system || p.battery_cells?.length) ? `<section class="pd-block"><h2>相容與標籤</h2><ul class="tags">${[...(p.compatible_sizes || []), p.video_system, ...(p.battery_cells || []), ...(p.tags || [])].filter(Boolean).map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>` : '';
    const notes = p.notes?.length ? `<section class="pd-block"><h2>注意事項</h2><ul class="notes">${p.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></section>` : '';
    const descHtml = p.description ? `<section class="pd-block"><h2>商品說明</h2><div class="prose">${p.description.split(/\n{2,}/).map(par => `<p>${esc(par).replace(/\n/g, '<br>')}</p>`).join('')}</div></section>` : '';
    const rv = p.review || {};
    const reviewItems = [...(rv.missing || []).map(m => `待補：${m}`), ...(rv.notes || [])];
    const snap = rv.shopee_sales_snapshot;
    const snapHtml = !p.published && snap?.rows?.length ? `<details class="snap"><summary>蝦皮價格／庫存快照（${esc(snap.captured_at.slice(0, 10))}，未公開、待核對）</summary><div class="table-wrap"><table class="table"><thead><tr><th scope="col">規格</th><th scope="col">價格</th><th scope="col">庫存</th></tr></thead><tbody>${snap.rows.map(r => `<tr><td>${esc(r.name || '（單一規格）')}</td><td>${r.price ?? '—'}</td><td>${r.stock ?? '—'}</td></tr>`).join('')}</tbody></table></div></details>` : '';
    const reviewBox = !p.published && (reviewItems.length || snapHtml) ? `<aside class="review-box"><strong>草稿待核對（僅預覽版顯示）${rv.batch ? `｜首批 ${esc(rv.batch.replace('first-', ''))} 組` : ''}</strong><ul>${reviewItems.map(n => `<li>${esc(n)}</li>`).join('')}</ul>${(p.images || []).some(i => i.rights === 'unverified') ? '<p>圖片由蝦皮匯入，使用權待 EWP 確認（rights: unverified）。</p>' : ''}${snapHtml}</aside>` : '';
    const showcaseNote = showcase ? `<p class="callout" role="note"><strong>作品介紹：</strong>本頁為機型介紹，目前未於官網販售。需要相同或類似配置，請透過 LINE 洽詢客製組裝服務。</p>` : '';
    const body = `<div class="wrap">${breadcrumbs(crumbs.map((x, i) => i === crumbs.length - 1 ? x : x))}</div>
<article class="wrap pd" itemscope>
  <div class="pd-top">
    ${gallery}
    <div class="pd-info">
      <p class="pd-role"><span class="badge badge-role badge-${attr(p.seller_role)}">${esc(roleText(p.seller_role))}</span>${p.published ? '' : '<span class="badge badge-draft">草稿</span>'}</p>
      <h1>${esc(p.name_zh)}</h1>
      <dl class="pd-meta">
        ${p.brand ? `<div><dt>品牌</dt><dd>${esc(p.brand)}</dd></div>` : ''}
        ${p.manufacturer_model ? `<div><dt>型號</dt><dd>${esc(p.manufacturer_model)}</dd></div>` : ''}
        ${p.sku ? `<div><dt>SKU</dt><dd>${esc(p.sku)}</dd></div>` : ''}
        <div><dt>分類</dt><dd><a href="${url.category(c)}">${esc(c.name)}</a>${sub ? ` / <a href="${url.sub(c, sub)}">${esc(sub.name)}</a>` : ''}</dd></div>
      </dl>
      ${showcase ? showcaseNote : `<p class="pd-price${p.price_display === 'inquiry' ? ' price-inquiry' : ''}">${esc(priceText(p))}</p>
      <p class="pd-avail avail-${attr(p.availability)}">${esc(availabilityText(p.availability))}</p>`}
      ${p.short_description ? `<p class="pd-short">${esc(p.short_description)}</p>` : ''}
      <div class="actions pd-actions">${ctas}${!shopeeBtn && !line ? '<a class="btn" href="/contact/">聯絡我們</a>' : ''}</div>
      <p class="fine">${showcase ? '' : p.price_display === 'inquiry' ? '價格依配置與供貨狀況報價。' : '網站標示為官網售價（已反映不經平台的價差），訂購前請透過 LINE 確認規格、庫存與金額。'}商品頁出現的品牌名稱僅用於標示商品，不代表原廠代理或授權。</p>
      ${reviewBox}
    </div>
  </div>
  ${variants}${specs}${compat}${descHtml}${notes}
</article>
${related.length ? `<section class="wrap">${sectionHead('RELATED', '相關商品')}${cardList(related)}</section>` : ''}
${(shopeeBtn || line) ? `<div class="sticky-cta" aria-label="購買與詢價">${ctas}</div>` : ''}`;
    const ld = {
      '@context': 'https://schema.org', '@type': 'Product', name: p.name_zh, url: BASE + url.product(p),
      ...(p.short_description ? { description: p.short_description } : {}),
      ...(imgs.length ? { image: imgs.map(i => BASE + (i.fallback || i.src)) } : {}),
      ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
      ...(p.sku ? { sku: p.sku } : {}),
      ...(p.manufacturer_model ? { mpn: p.manufacturer_model } : {}),
      ...(p.price_twd > 0 && p.price_display === 'fixed' && p.availability !== 'unknown' ? { offers: { '@type': 'Offer', priceCurrency: 'TWD', price: p.price_twd, availability: { in_stock: 'https://schema.org/InStock', preorder: 'https://schema.org/PreOrder', made_to_order: 'https://schema.org/PreOrder', out_of_stock: 'https://schema.org/OutOfStock' }[p.availability], url: BASE + url.product(p) } } : {}),
    };
    page(`product/${p.slug}/index.html`, {
      title: p.name_zh, description: p.short_description || `${p.name_zh}｜${c.name}｜電翼動力 EWP`, path: url.product(p), body, active: 'products',
      ogImage: imgs[0] ? (imgs[0].fallback || imgs[0].src) : undefined, scripts: ['/assets/js/product.js'], bodyClass: (shopeeBtn || line) ? 'has-sticky-cta' : '',
      // 作品介紹不輸出 Product 結構化資料，避免被視為販售商品
      jsonld: [showcase ? null : ld, breadcrumbsJsonLd(crumbs, BASE)], noindex: !p.published,
    });
  }
}

// ---------- 自製機型 ----------
const BUILD_STATUS = { showcase: '代表作品', preparing: '資料整理中', planned: '規劃中' };
function buildPages() {
  const sorted = [...builds].sort((a, b) => a.order - b.order);
  const crumbs = [{ name: '首頁', href: '/' }, { name: 'EWP 自製機型' }];
  const body = `${pageHead('EWP BUILDS', 'EWP 自製機型', '由電翼動力設計、組裝與調校的機型。與其他品牌整機分開標示；每台機器都可依用途討論配置。', breadcrumbs(crumbs))}
<section class="wrap"><ul class="build-grid">${sorted.map(b => `<li class="build-card"><a href="${url.build(b)}">
  <div class="build-media">${b.images[0] ? picture(b.images[0], { sizes: '(max-width: 720px) 100vw, 400px' }) : `<div class="img-ph"><span>${esc(b.name_en)}</span></div>`}</div>
  <div class="build-body"><span class="badge">${esc(BUILD_STATUS[b.status] || '')}</span><h2>${esc(b.name_zh)} <small>${esc(b.name_en)}</small></h2><p class="muted">${esc(b.size)} · ${esc(b.use)}</p><p>${esc(b.summary)}</p></div>
</a></li>`).join('')}</ul></section>
${contactCta('想要一台自己的配置？', '說明用途、預算與現有設備，我們依需求建議機架、動力與圖傳。')}`;
  page('builds/index.html', { title: 'EWP 自製機型', description: '電翼動力自製 FPV 機型：HUAN 幻、FANG V 毒牙、GOBU SENTINEL、GOBU POCKET、長航系列與 X8 影視機。', path: '/builds/', body, active: 'builds', jsonld: [breadcrumbsJsonLd(crumbs, BASE)] });

  for (const b of sorted) {
    const bc = [{ name: '首頁', href: '/' }, { name: 'EWP 自製機型', href: '/builds/' }, { name: `${b.name_zh} ${b.name_en}` }];
    const rel = (b.related_product_ids || []).map(id => visible.find(p => p.id === id)).filter(Boolean);
    const body = `<div class="wrap">${breadcrumbs(bc)}</div>
<article class="wrap build-detail">
  <div class="pd-top">
    <div class="gallery">${b.images[0] ? `<div class="gallery-main">${picture(b.images[0], { lazy: false, sizes: '(max-width: 900px) 100vw, 640px' })}</div>` : `<div class="img-ph"><span>${esc(b.name_en)}</span></div><p class="muted">實機照片準備中</p>`}</div>
    <div class="pd-info">
      <p class="pd-role"><span class="badge badge-role badge-ewp_original">EWP 自製</span><span class="badge">${esc(BUILD_STATUS[b.status] || '')}</span></p>
      <h1>${esc(b.name_zh)} <small>${esc(b.name_en)}</small></h1>
      <p class="muted">${esc(b.size)} · ${esc(b.use)}</p>
      <p class="pd-short">${esc(b.summary)}</p>
      <ul class="tags">${b.highlights.map(h => `<li>${esc(h)}</li>`).join('')}</ul>
      <div class="actions pd-actions">${lineButton(site, '諮詢客製', 'btn btn-line')}<a class="btn" href="/services/custom-build/">客製組裝流程</a></div>
    </div>
  </div>
  ${b.specs.length ? `<section class="pd-block"><h2>代表配置</h2><div class="table-wrap"><table class="table spec"><tbody>${b.specs.map(s => `<tr><th scope="row">${esc(s.key)}</th><td>${esc(s.value)}</td></tr>`).join('')}</tbody></table></div>${b.spec_status !== 'verified' ? '<p class="fine">頁面為代表配置介紹，實際零件、供貨狀況、價格與交期請於委託前確認。</p>' : ''}</section>` : `<section class="pd-block"><h2>配置</h2><p class="muted">正式配置整理中。需要這台機型的資訊，請直接透過 LINE 詢問。</p></section>`}
  ${rel.length ? `<section class="pd-block"><h2>可購買的版本</h2>${cardList(rel)}</section>` : ''}
</article>
${contactCta()}`;
    page(`builds/${b.slug}/index.html`, { title: `${b.name_zh} ${b.name_en}`, description: `${b.name_zh} ${b.name_en}｜${b.size} ${b.use}。${b.summary}`, path: url.build(b), body, active: 'builds', ogImage: b.images[0]?.fallback, jsonld: [breadcrumbsJsonLd(bc, BASE)] });
  }
}

// ---------- 服務 ----------
function servicePages() {
  const sorted = [...services].sort((a, b) => a.order - b.order);
  const crumbs = [{ name: '首頁', href: '/' }, { name: '技術與客製服務' }];
  const body = `${pageHead('SERVICES', '技術與客製服務', '客製組裝、維修檢測、調參、黑盒分析、3D 列印與電池組客製。每項服務都先了解需求與現況，再個別報價。', breadcrumbs(crumbs))}
<section class="wrap"><ul class="service-grid">${sorted.map((s, i) => `<li><a href="${url.service(s)}"><span class="num">0${i + 1}</span><h2>${esc(s.name)}</h2><p>${esc(s.summary)}</p><span class="more">了解服務 →</span></a></li>`).join('')}</ul></section>
${contactCta('先聊聊你的需求', '提供機型、用途與目前狀況，我們會說明可行的做法與報價方式。')}`;
  page('services/index.html', { title: '技術與客製服務', description: '電翼動力 FPV 客製組裝、維修檢測、Betaflight／INAV 調參、黑盒分析、3D 列印與電池組客製服務。', path: '/services/', body, active: 'services', jsonld: [breadcrumbsJsonLd(crumbs, BASE)] });

  for (const s of sorted) {
    const bc = [{ name: '首頁', href: '/' }, { name: '技術與客製服務', href: '/services/' }, { name: s.name }];
    const list = (title, items, cls = 'checks') => items?.length ? `<section class="svc-block"><h2>${title}</h2><ul class="${cls}">${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : '';
    const body = `${pageHead(s.name_en.toUpperCase(), s.name, s.summary, breadcrumbs(bc))}
<div class="wrap svc">
  ${s.safety ? `<p class="callout" role="note"><strong>安全提醒：</strong>${esc(s.safety)}</p>` : ''}
  <div class="svc-grid">
    ${list('適用情境', s.situations)}
    ${list('需要提供的資料', s.provide)}
    ${list('服務範圍', s.scope)}
    <section class="svc-block"><h2>流程</h2><ol class="steps">${s.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol></section>
  </div>
  <section class="svc-block"><h2>報價方式</h2><p>${esc(s.pricing)}</p></section>
  <div class="actions">${lineButton(site, `LINE 詢問${s.name}`, 'btn btn-line')}${shopeeButton(site, '蝦皮賣場聊聊')}</div>
  <p class="fine">請勿在訊息中提供身分證字號、銀行帳號等與服務無關的個人資料。</p>
</div>
<section class="wrap other-services"><h2 class="h3">其他服務</h2><ul class="chips">${sorted.filter(x => x.id !== s.id).map(x => `<li><a class="chip" href="${url.service(x)}">${esc(x.name)}</a></li>`).join('')}</ul></section>`;
    page(`services/${s.slug}/index.html`, { title: s.name, description: s.summary, path: url.service(s), body, active: 'services', jsonld: [breadcrumbsJsonLd(bc, BASE), { '@context': 'https://schema.org', '@type': 'Service', name: s.name, description: s.summary, provider: { '@type': 'Organization', name: '電翼動力 EWP' }, areaServed: 'TW' }] });
  }
}

// ---------- 電池專區 ----------
function batteryPage() {
  const cat = catMap.get('power-battery');
  const list = sortProducts(visible.filter(p => p.primary_category_id === 'power-battery'));
  const crumbs = [{ name: '首頁', href: '/' }, { name: 'EWP 電池專區' }];
  const body = `${pageHead('BATTERIES', 'EWP 電池專區', '長航用 18650／21700 鋰離子電池組、外場電包，以及花飛與微型機用 LiPo／LiHV。依用途選電池，也可客製串並聯配置。', breadcrumbs(crumbs))}
<section class="wrap">
  <h2 class="h3">先分清楚電池系統</h2>
  <ul class="chem-grid">
    <li><h3>Li-ion 鋰離子（18650／21700）</h3><p>能量密度高、適合長航與外場供電；持續放電能力依電芯型號而定，不適合直接拿來取代高倍率花飛電池。</p></li>
    <li><h3>LiPo 鋰聚合物</h3><p>放電能力高，常用於花飛與競速。重量與容量的取捨依機型決定。</p></li>
    <li><h3>LiHV 高壓鋰聚合物</h3><p>滿電電壓比一般 LiPo 高，充電器必須選對 LiHV 模式；與一般 LiPo 不可混用同一充電設定。</p></li>
  </ul>
  <p class="callout" role="note"><strong>重要：</strong>不同電池系統與電芯型號的滿電電壓、存放電壓與截止電壓都不同。請依商品標示與電芯規格書使用，不要用同一組數字套用所有電池。詳細觀念可參考 <a href="/fpv-help.html#battery-knowledge">知識庫電池速查</a>。</p>
</section>
<section class="wrap">
  ${sectionHead('LINEUP', '電池與電源商品', `<p><a href="${url.category(cat)}">完整篩選 →</a></p>`)}
  ${list.length ? cardList(list) : `<div class="empty"><h2>電池商品整理中</h2><p>正式規格與測試資料核對完成後上架。需要長航電池或客製電池組，歡迎直接詢問。</p><div class="actions">${lineButton(site, 'LINE 詢問', 'btn btn-line')}${shopeeButton(site, '蝦皮賣場')}</div></div>`}
  <ul class="chips sub-links">${cat.subcategories.map(s => `<li><a class="chip" href="${url.sub(cat, s)}">${esc(s.name)}</a></li>`).join('')}</ul>
</section>
<section class="wrap">
  <div class="split-card">
    <div><p class="eyebrow">CUSTOM PACKS</p><h2>電池組客製</h2><p>依設備電壓、電流需求與攜帶方式評估電芯與串並聯配置。製作前會確認用途、接頭與尺寸限制。</p></div>
    <div class="actions"><a class="btn btn-primary" href="/services/battery-pack/">電池組客製服務 →</a>${lineButton(site, 'LINE 詢問', 'btn btn-line')}</div>
  </div>
</section>
<section class="wrap">
  <h2 class="h3">使用與存放安全</h2>
  <ul class="checks">
    <li>充電時請在旁看管，使用防火袋或防爆箱，遠離易燃物。</li>
    <li>不要過充、過放、短路或拆解電池；外觀膨脹、破損、異常發熱時停止使用。</li>
    <li>不同容量、不同狀態或不同批次的電芯不可混用於同一電池組。</li>
    <li>長時間不使用時，請依商品標示調整至存放電壓，存放於陰涼乾燥處。</li>
    <li>鋰電池運送與搭機有容量與包裝限制，寄送或出國前請先確認物流與航空公司規定。</li>
  </ul>
</section>`;
  page('batteries/index.html', { title: '電池專區', description: '電翼動力 EWP 電池專區：18650／21700 鋰離子電池組、外場電包、LiPo／LiHV 與電池安全說明。', path: '/batteries/', body, active: 'batteries', jsonld: [breadcrumbsJsonLd(crumbs, BASE)] });
}

// ---------- 其他頁面 ----------
function simplePages() {
  const c = site.contact;
  // 最新消息
  page('journal/index.html', { title: '最新消息', description: '電翼動力 EWP 新品、實機展示、製作紀錄與官方公告。', path: '/journal/', active: 'journal',
    body: `${pageHead('JOURNAL', '最新消息', '新品、實機展示、製作紀錄與官方公告。', breadcrumbs([{ name: '首頁', href: '/' }, { name: '最新消息' }]))}
<section class="wrap"><div class="empty"><h2>目前還沒有文章</h2><p>第一篇內容準備中。想先看看作品，可以瀏覽自製機型或 FPV 知識庫。</p><div class="actions"><a class="btn" href="/builds/">EWP 自製機型</a><a class="btn" href="/fpv-help.html">FPV 知識庫</a></div></div></section>` });

  // 關於
  page('about/index.html', { title: '關於 EWP', description: '電翼動力 EWP：FPV 整機、動力電池、客製組裝、維修調校與 3D 列印。', path: '/about/', active: 'about',
    body: `${pageHead('ABOUT EWP', '關於電翼動力', '把熱愛，做成能飛的作品。', breadcrumbs([{ name: '首頁', href: '/' }, { name: '關於 EWP' }]))}
<section class="wrap prose-wide"><p>從一台穿越機開始，把組裝、焊接、調校與維修，變成日常的一部分。電翼動力專注 FPV 整機與動力系統，也持續探索小型花飛、長航與影視機的可能。</p><p>我們相信，了解自己的機器，是享受飛行的一部分。</p></section>
<section class="wrap">${sectionHead('CAPABILITIES', '我們在做的事')}
<ul class="service-grid">${[
      ['FPV 整機', '自製機型與其他品牌整機，交機前完成設定與功能檢查。', '/builds/'],
      ['零件與相容性', '機架、動力、飛控、圖傳與接收系統的選配與相容性確認。', '/products/'],
      ['動力電池', '18650、21700 鋰離子電池組與外場電包。', '/batteries/'],
      ['維修與調參', '故障排查、Betaflight／INAV 設定與黑盒分析。', '/services/repair/'],
      ['3D 列印', 'TPU 保護件、固定座與機體配件。', '/services/3d-printing/'],
      ['技術知識', '整理玩家常見問題，用白話說明排查方向。', '/fpv-help.html'],
    ].map(([t, d, h]) => `<li><a href="${h}"><h3>${t}</h3><p>${d}</p><span class="more">前往 →</span></a></li>`).join('')}</ul></section>
<section class="wrap"><div class="about-band"><div class="motto" aria-label="Build. Tune. Fly."><span>BUILD.</span><span>TUNE.</span><span>FLY.</span></div></div></section>
${bizBlock()}
${contactCta()}` });

  // 聯絡
  const rows = [
    c.line.enabled && c.line.url ? `<li class="contact-card contact-line"><h2>LINE 官方帳號</h2><p>整機、零件、維修與電池詢價，建議優先使用 LINE。</p>${lineButton(site, '加入 LINE 好友', 'btn btn-line btn-block')}${c.line.qr_image ? `<figure class="qr"><img src="${attr(c.line.qr_image)}" width="240" height="240" alt="電翼動力 LINE 官方帳號 QR Code（${attr(c.line.url)}）" loading="lazy"><figcaption>電腦版請用手機掃描 QR Code</figcaption></figure>` : ''}</li>` : '',
    c.shopee.enabled && c.shopee.url ? `<li class="contact-card"><h2>蝦皮賣場</h2><p>已上架商品可直接在蝦皮下單，或透過賣場聊聊詢問。</p>${shopeeButton(site, '前往蝦皮賣場', 'btn btn-primary btn-block')}</li>` : '',
    c.email.enabled && c.email.value ? `<li class="contact-card"><h2>Email</h2><p>適合寄送較長的需求說明或檔案。</p><a class="btn btn-block" href="mailto:${attr(c.email.value)}">${esc(c.email.value)}</a></li>` : '',
    c.instagram.enabled && c.instagram.url ? `<li class="contact-card contact-ig"><h2>Instagram</h2><p>${esc(c.instagram.label)}</p><a class="btn btn-ig btn-block" href="${attr(c.instagram.url)}" target="_blank" rel="noopener">開啟 Instagram <span aria-hidden="true">↗</span></a>${c.instagram.qr_image ? `<figure class="qr qr-ig"><div class="qr-crop"><img src="${attr(c.instagram.qr_image)}" width="1070" height="1530" alt="Instagram @spiritsparrow.battery QR Code（${attr(c.instagram.url)}）" loading="lazy"></div><figcaption>電腦版請用手機掃描 QR Code</figcaption></figure>` : ''}</li>` : '',
    c.facebook.enabled && c.facebook.url ? `<li class="contact-card"><h2>Facebook</h2><a class="btn btn-block" href="${attr(c.facebook.url)}" target="_blank" rel="noopener">開啟 Facebook</a></li>` : '',
    c.phone.enabled && c.phone.value ? `<li class="contact-card"><h2>電話</h2><a class="btn btn-block" href="tel:${attr(c.phone.value)}">${esc(c.phone.value)}</a></li>` : '',
  ].join('');
  page('contact/index.html', { title: '聯絡我們', description: '透過 LINE 官方帳號、蝦皮賣場或 Email 聯絡電翼動力 EWP。', path: '/contact/', active: 'contact',
    body: `${pageHead('CONTACT', '聯絡我們', '先告訴我們你的設備與用途，一起把配置想清楚。', breadcrumbs([{ name: '首頁', href: '/' }, { name: '聯絡我們' }]))}
<section class="wrap"><ul class="contact-grid">${rows}</ul>
${(!c.hours.enabled || !c.address.enabled) ? `<p class="muted contact-note">${esc(c.online_only_note)}</p>` : ''}
${c.hours.enabled && c.hours.value ? `<p>服務時間：${esc(c.hours.value)}</p>` : ''}${c.address.enabled && c.address.value ? `<p>地址：${esc(c.address.value)}</p>` : ''}
</section>
${bizBlock()}
<section class="wrap"><h2 class="h3">詢問前可以先準備</h2><ul class="checks"><li>整機：用途、預算、已有的遙控器與眼鏡</li><li>零件：型號、照片或購買連結，以及要裝在哪台機器上</li><li>維修：故障經過、飛控與電調型號、韌體版本、接線照片</li><li>電池：使用設備、需要的電壓與容量、接頭規格</li></ul></section>` });

  // 政策頁
  const pol = (slug, title, approved, inner) => page(`${slug}/index.html`, { title, path: `/${slug}/`, noindex: !approved,
    body: `${pageHead('POLICY', title, '', breadcrumbs([{ name: '首頁', href: '/' }, { name: title }]))}<section class="wrap prose-wide">${inner}</section>` });
  pol('privacy', '隱私權說明', site.policies.privacy.approved, `${site.policies.privacy.approved ? '' : '<div class="callout" role="note"><strong>草案，待 EWP 正式核對：</strong>以下內容依本網站目前的技術實況撰寫，尚未經電翼動力確認為正式版本。</div>'}<p>最後更新：2026-10-22</p>
<h2>本網站蒐集的資料</h2><p>本網站為靜態網站，沒有會員登入、線上表單或站內購物功能，也沒有安裝第三方分析或廣告追蹤程式。網站本身不會要求你輸入或儲存個人資料。</p>
<h2>主機服務</h2><p>本網站由 GitHub Pages 提供主機服務。GitHub 可能為了安全與維運目的記錄造訪者的 IP 位址等技術資訊，相關處理依 GitHub 的隱私權政策。</p>
<h2>外部連結</h2><p>當你點選 LINE、蝦皮、Instagram 或 Email 等外部連結後，資料的處理適用該服務的隱私權政策。透過這些管道聯絡時，請只提供處理需求所需的資訊。</p>
<h2>變更</h2><p>若日後加入表單、分析工具或其他會處理個人資料的功能，本頁將同步更新。</p>`);
  const pending = `<div class="callout" role="note"><strong>內容待確認：</strong>本頁正式內容由電翼動力核對後公開。</div><p>在此之前，透過蝦皮賣場下單的交易，適用蝦皮購物平台的相關規範；其他問題請透過 <a href="/contact/">聯絡我們</a> 詢問。</p>`;
  pol('terms', '網站條款', site.policies.terms.approved, pending);
  pol('shipping-returns', '售後、運送與退換', site.policies['shipping-returns'].approved, pending);

  // 404
  write('404.html', layout(ctx, { title: '找不到頁面', path: '/404.html', noindex: true,
    body: `<section class="wrap notfound"><p class="eyebrow">404</p><h1>找不到這個頁面</h1><p class="lead">網址可能已變更。可以搜尋商品，或回到首頁。</p>
<form class="hero-search" action="/products/" method="get" role="search"><label for="nf-q" class="sr-only">搜尋商品</label><input id="nf-q" type="search" name="q" placeholder="搜尋商品"><button class="btn btn-primary" type="submit">搜尋</button></form>
<div class="actions"><a class="btn" href="/">回到首頁</a><a class="btn" href="/products/">商品商城</a><a class="btn" href="/fpv-help.html">FPV 知識庫</a></div></section>` }));
}

// ---------- sitemap / robots ----------
function seoFiles() {
  if (DRAFTS) { write('robots.txt', 'User-agent: *\nDisallow: /\n'); return; }
  const urls = ['/', '/products/', ...categories.map(url.category), ...visible.map(url.product), '/builds/', ...builds.map(url.build),
    '/services/', ...services.map(url.service), '/batteries/', '/journal/', '/about/', '/contact/', '/fpv-help.html',
    ...Object.entries(site.policies).filter(([, v]) => v.approved).map(([k]) => `/${k}/`)];
  const lastmod = p => p?.updated_at;
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => {
    const p = visible.find(x => url.product(x) === u);
    return `  <url><loc>${BASE}${u}</loc>${lastmod(p) ? `<lastmod>${lastmod(p)}</lastmod>` : ''}</url>`;
  }).join('\n')}\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /legacy/\nSitemap: ${BASE}/sitemap.xml\n`);
}

// ---------- 執行 ----------
// 每次都從空資料夾開始，確保發布產物只包含本次產生的頁面與白名單靜態檔
if (!CHECK) { fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true }); }
homePage(); productsIndex(); categoryPages(); productPages(); buildPages(); servicePages(); batteryPage(); simplePages(); seoFiles();
// 商品圖片只複製「本次有產生頁面的商品」：正式版＝已公開商品；預覽版＝含草稿。未公開商品的圖片不會進入正式產物。
const PRODUCT_IMG = path.join(ROOT, 'assets', 'img', 'products');
for (const item of STATIC_WHITELIST) {
  const src = path.join(ROOT, item);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(OUT, item), { recursive: true, filter: f => !(f === PRODUCT_IMG || f.startsWith(PRODUCT_IMG + path.sep)) });
}
let copiedProductImgDirs = 0;
for (const p of visible) {
  const dir = path.join(PRODUCT_IMG, p.id);
  if (fs.existsSync(dir)) { fs.cpSync(dir, path.join(OUT, 'assets', 'img', 'products', p.id), { recursive: true }); copiedProductImgDirs++; }
}
console.log(`✓ 已產生 ${generated.length} 個頁面＋${STATIC_WHITELIST.length} 項靜態資源＋${copiedProductImgDirs} 件商品圖片 → ${path.relative(ROOT, OUT)}${DRAFTS ? '（含草稿預覽，noindex）' : ''}`);
