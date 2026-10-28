#!/usr/bin/env node
// 電翼動力 EWP 靜態網站產生器（無外部套件）。
//   node scripts/build.mjs              → 產生正式版到 dist/（只含 published=true 商品；GitHub Actions 部署此資料夾）
//   node scripts/build.mjs --drafts     → 產生「含草稿」預覽版到 _preview/（noindex，不提交、不部署）
//   node scripts/build.mjs --check      → 只驗證資料，不輸出
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadAll, validateProducts, AVAILABILITY, STATIC_WHITELIST, isRejected } from './lib/data.mjs';
import { loadJournal, validateJournal, journalUrl, formatDate } from './lib/journal.mjs';
import { loadHelp, validateHelp, helpUrl, HELP_CATEGORIES, HELP_LEVELS } from './lib/help.mjs';
import { isShowcase, esc, attr, url, layout, analyticsSnippet, productCard, breadcrumbs, breadcrumbsJsonLd, picture, priceText, availabilityText, roleText, lineButton, shopeeButton, shopeeUrlFor } from './lib/html.mjs';

const args = process.argv.slice(2);
const DRAFTS = args.includes('--drafts');
const CHECK = args.includes('--check');
// --preview：Cloudflare Pages 的合併前預覽網址（每個分支一個網址）。內容與正式版相同（不含草稿），
// 但全站 noindex、robots 全擋、每頁上方顯示「預覽版」提示，避免被搜尋引擎收錄或被誤認為正式網站。
const PREVIEW = args.includes('--preview');
const PREVIEW_BRANCH = (process.env.CF_PAGES_BRANCH || '').replace(/[^\w./-]/g, '').slice(0, 60);
const OUT = path.resolve(ROOT, args.includes('--out') ? args[args.indexOf('--out') + 1] : (DRAFTS ? '_preview' : 'dist'));
if (OUT === ROOT || !OUT.startsWith(ROOT + path.sep)) { console.error('✖ 輸出資料夾必須是 repo 內的子資料夾（例如 dist）'); process.exit(1); }

const data = loadAll();
const { site, categories, builds, services, products, notices } = data;

// ---------- 驗證 ----------
const { errors, warnings } = validateProducts(products, categories);
if (!notices?.after_sales?.items?.length) errors.push('notices.json：缺少 after_sales（每件商品頁都要顯示售後與鑑賞期說明）');
for (const k of Object.keys(notices?.usage || {})) {
  const [cid, sid] = k.split('/');
  const cat = categories.find(c => c.id === cid);
  if (!cat || (sid && !cat.subcategories.some(s => s.id === sid))) errors.push(`notices.json usage：分類 ${k} 不存在`);
}
for (const s of services) for (const k of ['id', 'slug', 'name', 'summary']) if (!s[k]) errors.push(`services.json ${s.id}: 缺少 ${k}`);
for (const b of builds) for (const k of ['id', 'name_zh', 'summary']) if (!b[k]) errors.push(`builds.json ${b.id}: 缺少 ${k}`);
{ // 自製機型：listed 機型必須對應到存在、未被拒絕的 EWP 原創商品，且不重複
  const seenP = new Set(), seenSlug = new Set();
  for (const b of builds) {
    for (const s of b.legacy_slugs || []) { if (seenSlug.has(s)) errors.push(`builds.json: legacy_slugs 重複 ${s}`); seenSlug.add(s); }
    if (!b.listed) continue;
    const p = products.find(x => x.id === b.product_id);
    if (!p) { errors.push(`builds.json ${b.id}: product_id ${b.product_id} 找不到商品`); continue; }
    if (seenP.has(p.id)) errors.push(`builds.json ${b.id}: product_id ${p.id} 重複對應`);
    seenP.add(p.id);
    if (p.seller_role !== 'ewp_original') errors.push(`builds.json ${b.id}: ${p.id} 不是 EWP 原創商品（seller_role=${p.seller_role}）`);
    if (isRejected(p)) errors.push(`builds.json ${b.id}: ${p.id} 已被拒絕上架`);
    if (!p.published) warnings.push(`builds.json ${b.id}: ${p.id} 未上架，正式網站的自製機型清單不會顯示`);
  }
}
for (const [k, c] of Object.entries(site.contact)) {
  if (typeof c !== 'object' || !c.enabled) continue;
  if (!c.url && !c.value) errors.push(`site.json contact.${k}: enabled=true 但沒有 url/value`);
  if (c.url && !/^https:\/\//.test(c.url)) errors.push(`site.json contact.${k}: 網址必須是 https://`);
}
for (const [k, key] of [['line', 'qr_image'], ['line_community', 'qr_image'], ['shopee', 'qr_image'], ['email', 'image'], ['instagram', 'qr_image']]) {
  const f = site.contact[k]?.enabled && site.contact[k][key];
  if (f && !fs.existsSync(path.join(ROOT, f))) errors.push(`site.json contact.${k}.${key}: 圖檔不存在 ${f}`);
}
const journal = loadJournal();
errors.push(...validateJournal(journal));
const helpArticles = loadHelp();
errors.push(...validateHelp(helpArticles));
if (warnings.length) console.warn(`⚠ 警告 ${warnings.length} 筆\n  ` + warnings.slice(0, 10).join('\n  ') + (warnings.length > 10 ? '\n  …' : ''));
if (errors.length) { console.error(`✖ 資料驗證失敗 ${errors.length} 筆：\n  ` + errors.join('\n  ')); process.exit(1); }
const pubCount = products.filter(p => p.published).length;
console.log(`✓ 資料驗證通過：商品 ${products.length} 筆（公開 ${pubCount}、草稿 ${products.length - pubCount}）`);
if (CHECK) process.exit(0);

// ---------- Context ----------
// rejected（EWP 決定不上官網）在正式版與預覽版都不產生
const catMap = new Map(categories.map(c => [c.id, c]));
// 還沒有分類的後台新增草稿不產生頁面（預覽版也略過）
const visible = products.filter(p => !isRejected(p) && (DRAFTS || p.published) && catMap.has(p.primary_category_id));
// 樣式與程式的版本號 = 內容雜湊：檔案一改，網址就變，瀏覽器不會用到舊的快取
const assetVersion = (() => {
  const h = crypto.createHash('sha256');
  for (const f of ['assets/css/site.css', 'assets/js/site.js', 'assets/js/catalog.js', 'assets/js/product.js']) {
    const p = path.join(ROOT, f); if (fs.existsSync(p)) h.update(fs.readFileSync(p));
  }
  return h.digest('hex').slice(0, 10);
})();
const ctx = { site, categories, catMap, drafts: DRAFTS, preview: PREVIEW ? { branch: PREVIEW_BRANCH } : null, version: process.env.EWP_VERSION || assetVersion };
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
// ---------- 組裝動畫（assets/js/pack-anim.js，WebGL） ----------
// 目前只有靈雀外場電包 4S3P。動畫裡的電芯數、電壓、容量寫在 pack-anim.js，商品規格改變時要一起改。
// 只在商品公開（visible 含此商品）時輸出，避免引用到未發布的商品圖片。
const PACK_ANIM = { productId: 'sp-26592256245', poster: '/assets/img/anim/spirit-sparrow-4s3p-poster.webp', front: '/assets/img/products/sp-26592256245/04.webp' };
const PACK_STEPS = [
  ['21700 電芯', '單顆 5000mAh／15A 鋰離子電芯。'],
  ['4S3P 排列', '12 顆電芯排成 4 串 3 並，正負極交錯。'],
  ['點焊連接', '紫銅＋鍍鎳鋼點焊，串並聯成組。'],
  ['熱縮封裝', '整組熱縮包覆，加上外出提把。'],
  ['完成', 'XT60 母頭輸出、電量顯示。標稱 14.8V、滿電 16.8V、15,000mAh、約 222Wh。'],
];
const packAnimProduct = () => visible.find(p => p.id === PACK_ANIM.productId);
const packAnimSection = ({ eyebrow, title, lead, note }) => `<section class="pa-section" aria-labelledby="pa-title">
  <div class="pa" data-pack-anim data-logo="/assets/img/brand/ewp-logo.png" data-front="${attr(PACK_ANIM.front)}">
    <div class="pa-stage">
      <img class="pa-poster" src="${attr(PACK_ANIM.poster)}" alt="靈雀外場電包 4S3P 成品：黑色熱縮、提把、正面貼標 15,000mAh、16.8V、222Wh" width="540" height="960" loading="lazy" decoding="async">
      <button type="button" class="pa-play" data-pa-play>▶ 播放組裝動畫</button>
    </div>
    <div class="pa-side">
      <p class="eyebrow">${esc(eyebrow)}</p>
      <h2 id="pa-title">${esc(title)}</h2>
      <p class="muted">${esc(lead)}</p>
      <ol class="pa-steps">${PACK_STEPS.map(([t, d], i) => `<li data-pa-step><button type="button"><span class="pa-n">0${i + 1}</span><span><strong>${esc(t)}</strong><span>${esc(d)}</span></span></button></li>`).join('')}</ol>
      <div class="pa-ctrl"><button type="button" class="btn" data-pa-toggle aria-pressed="false">暫停動畫</button></div>
      <p class="fine">${note}</p>
    </div>
  </div>
</section>`;
const pageHead = (eyebrow, title, lead, crumbs) => `<div class="page-head wrap">${crumbs || ''}<p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}</div>`;
const contactCta = (title = '還不確定怎麼選？', text = '告訴我們你的用途、預算與現有設備，一起把配置想清楚。') => `<section class="wrap cta-band"><div><h2>${esc(title)}</h2><p>${esc(text)}</p></div><div class="actions">${lineButton(site, 'LINE 詢價', 'btn btn-line')}${shopeeButton(site, '蝦皮賣場')}<a class="btn" href="/contact/">所有聯絡方式</a></div></section>`;

// ---------- 首頁 ----------
// 首頁「經銷品牌」：[圖檔名, 顯示名稱, 商品 brand 欄位值（用於 /products/?brand= 篩選）]；Logo 為白色單色 PNG，放在 assets/img/brands/
const BRANDS = [
  ['geprc', 'GEPRC', 'GEPRC'],
  ['konker', 'KONKER 空氪', 'KONKER 空氪'],
  ['shian', '十安 Shian mx', '十安 × 電翼動力'],
  ['mad', 'MAD Components', 'MAD'],
  ['fdi', 'FDI', 'FDI'],
];
function homePage() {
  const all = listedBuilds();
  // 主視覺用有品牌海報的機型；下方卡片列 featured=true 的其他機型
  const heroEntry = all.find(({ b }) => b.poster_image);
  const hero = heroEntry?.b;
  const cardBuilds = all.filter(({ b }) => b.featured && b !== hero).slice(0, 3);
  const otherBuilds = all.filter(x => x !== heroEntry && !cardBuilds.includes(x));
  // 首頁電池帶固定展示兩款自製電池（短名稱只用於首頁卡片；商品下架時自動不顯示）
  const BATTERY_PICKS = [['sp-53514957903', 'LR 遠航電池 6S2P 10000mAh'], ['sp-26592256245', '靈雀外場電包 15000mAh']];
  const batteries = BATTERY_PICKS.map(([id, label]) => ({ p: visible.find(p => p.id === id), label })).filter(x => x.p);
  const faq = [
    ['第一次接觸 FPV，要先準備什麼？', '先整理已有的遙控器、眼鏡與充電設備，再說明想練習花飛、長航或拍攝。這些資訊有助於確認接收機與圖傳相容性，縮小整機配置範圍。'],
    ['詢問維修時，需要提供哪些資訊？', '提供機型、飛控與電調型號、韌體版本、故障發生經過，以及清楚的接線照片。如果有設定備份、錯誤畫面或黑盒檔案，也可以一起準備。'],
    ['網頁上的機型可以調整配置嗎？', '可以依用途討論圖傳、接收機與配件選擇。頁面為代表配置介紹，實際零件、供貨狀況、價格與交期請於委託前確認。'],
  ];
  const v = site.home_video;
  const ytWatch = v?.enabled && v.youtube_id ? `https://www.youtube.com/watch?v=${encodeURIComponent(v.youtube_id)}` : '';
  const line = site.contact.line;
  const lineHref = line.enabled && line.url ? line.url : '';
  const arrow = '<span aria-hidden="true">→</span>';
  const doors = [
    ['/products/', 'SHOP', '商品商城', `${visible.length} 件商品，${categories.length} 大分類，可依品牌、尺寸篩選`, '逛商城', ''],
    ['/batteries/', 'BATTERY', '電池專區', '21700／18650 長航鋰電池與外場電包', '看電池', 'door-sand'],
    ['/services/', 'SERVICE', '技術服務', '客製組裝、維修檢測、Betaflight 調參與黑盒分析', '看服務', ''],
    ['/tunelab/', 'TUNE LAB · 封閉測試中', 'EWP Tune Lab', '依機體與黑盒資料做 PID／濾波分析的調參工具', '了解計畫', 'door-lab'],
  ];
  const work = [
    ['custom-build', '客製組裝', '依用途與預算挑機架、動力和圖傳，組好、設定好再交機'],
    ['repair', '維修與故障檢測', '從症狀開始查：供電、接線、飛控、電調與圖傳'],
    ['blackbox', 'Betaflight 調參與黑盒分析', '看黑盒資料再改 PID 與濾波，不靠猜'],
  ];
  const learnCards = [
    ['/learn/lipo-battery/', '/assets/img/home/learn-lipo.webp', 'FPV LiPo 電池新手學堂封面', 'LiPo 電池：從看懂標籤到安全報廢'],
    ['/learn/fpv-video/', '/assets/img/home/learn-video.webp', 'FPV 圖傳新手學堂封面', '圖傳：類比、DJI、Walksnail、HDZero 差在哪'],
  ];
  const img = p => { const i = p.images?.[0]; return i ? `<img src="${attr(i.src_small || i.src)}" alt="${attr(i.alt)}" width="480" height="480" loading="lazy" decoding="async">` : '<div class="img-ph" aria-hidden="true"><span>EWP</span></div>'; };

  const body = `<section id="about" class="wrap h2-hero">
  <div class="h2-hero-text">
    <h1 class="h2-slogan"><span class="sr-only">電翼動力 EWP：</span>Ready to Fly.<br>Built to <span class="red">Perform</span>.</h1>
    <p class="h2-lead">專注 FPV 穿越機的自製機型、客製組裝、維修檢測與 Betaflight 調參，並提供長航鋰離子電池。每一台機器都完成組裝、設定與測試後才交到你手上。</p>
    <div class="actions"><a class="btn btn-primary" href="/builds/">探索自製機型</a>${lineHref ? `<a class="btn h2-btn-line" href="${attr(lineHref)}" target="_blank" rel="noopener">LINE 詢問配置 <span aria-hidden="true">↗</span></a>` : ''}</div>
    <form class="h2-search" action="/products/" method="get" role="search">
      <label for="hero-q" class="sr-only">搜尋商品</label>
      <input id="hero-q" type="search" name="q" placeholder="找零件：型號或關鍵字，例如 2207、XT60">
      <button type="submit">搜尋</button>
    </form>
  </div>
  ${hero ? `<a class="h2-hero-pic" href="${url.product(heroEntry.p)}">
    ${picture(hero.poster_image, { lazy: false, sizes: '(max-width: 760px) 100vw, 560px' })}
    <span class="spec-tag"><span>${esc(hero.name_zh)} ${esc(hero.name_en || '')} · ${esc(hero.spec || hero.size)}</span></span>
  </a>` : ''}
</section>
<section class="wrap h2-doors-sec" aria-label="快速入口">
  <ul class="h2-doors">${doors.map(([h, k, t, d, c, cls]) => `<li><a class="h2-door ${cls}" href="${h}"><span class="h2-door-k">${k}</span><strong>${t}</strong><span class="h2-door-d">${d}</span><span class="h2-door-c">${c} ${arrow}</span></a></li>`).join('')}</ul>
</section>
<section id="builds" class="wrap h2-sec">
  <div class="h2-head"><div><p class="h2-eyebrow">EWP ORIGINAL BUILDS</p><h2>自製機型</h2></div><a class="h2-more" href="/builds/">全部 ${all.length} 款 ${arrow}</a></div>
  <ul class="h2-builds">${cardBuilds.map(({ b, p }) => `<li><a class="h2-build" href="${url.product(p)}">
    <span class="h2-build-img">${img(p)}</span>
    <span class="h2-build-body">
      <span class="h2-build-name"><strong>${esc(b.name_zh)}</strong>${b.name_en ? `<span>${esc(b.name_en)}</span>` : ''}</span>
      ${b.spec ? `<span class="h2-build-spec">${esc(b.spec)}</span>` : ''}
      <span class="h2-build-tag">${esc(b.tagline || b.use)}</span>
      <span class="h2-build-foot"><span class="h2-price">${esc(priceText(p))}</span><span class="h2-build-go">看規格 ${arrow}</span></span>
    </span>
  </a></li>`).join('')}</ul>
  ${otherBuilds.length ? `<p class="h2-others">其他機型：${otherBuilds.map(({ b, p }) => `<a href="${url.product(p)}">${esc(b.name_zh)}</a>`).join(' · ')}</p>` : ''}
</section>
<section id="battery" class="h2-sec">
  <div class="h2-batt-band"><div class="wrap h2-batt">
    <div class="h2-batt-text">
      <p class="h2-eyebrow">EWP BATTERY</p>
      <h2>EWP 長航鋰電池</h2>
      <p>21700、18650 鋰離子電池組與外場電包，適合長航飛行與外場供電。每組電池出廠前都完成內阻與電壓一致性檢查。</p>
      <div class="actions"><a class="btn h2-btn-sand" href="/batteries/">逛電池專區 ${arrow}</a><a class="btn h2-btn-sand-o" href="/learn/lipo-battery/">LiPo 新手學堂</a></div>
    </div>
    <ul class="h2-batt-pics">${batteries.map(({ p, label }) => `<li><a href="${url.product(p)}">${img(p)}<span>${esc(label)}</span></a></li>`).join('')}</ul>
  </div></div>
</section>
<section id="workshop" class="wrap h2-sec">
  <div class="h2-work">
    <img class="h2-work-img" src="/assets/img/home/workbench-solder.webp" alt="工作台上焊接飛控的實拍畫面" width="1280" height="720" loading="lazy" decoding="async">
    <div class="h2-work-text">
      <p class="h2-eyebrow">WORKBENCH</p>
      <h2>不只組好，也把細節調好。</h2>
      <ol class="h2-work-list">${work.map(([id, t, d], i) => `<li><span class="h2-num">0${i + 1}</span><div><a href="/services/${id}/">${t}</a><p>${d}</p></div></li>`).join('')}</ol>
      <a class="h2-more" href="/services/">全部 ${services.length} 項服務 ${arrow}</a>
    </div>
  </div>
  ${ytWatch ? `<a class="h2-video" href="${attr(ytWatch)}" target="_blank" rel="noopener">
    <span class="h2-video-thumb"><img src="/assets/img/home/kd7-assembly.webp" alt="" width="960" height="540" loading="lazy" decoding="async"><span class="h2-play" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1.5v11l9-5.5z" fill="#fff"/></svg></span></span>
    <span class="h2-video-text"><span class="h2-video-k">開發紀錄 · YouTube ↗</span><strong>${esc(v.title)}</strong>${v.caption ? `<span class="h2-video-d">${esc(v.caption)}</span>` : ''}</span>
  </a>` : ''}
</section>
<section id="learn" class="wrap h2-sec">
  <div class="h2-head"><div><p class="h2-eyebrow">LEARN</p><h2>新手從這裡開始</h2></div><a class="h2-more" href="/journal/">EWP 專欄 ${arrow}</a></div>
  <ul class="h2-learn">${learnCards.map(([h, src, alt, t]) => `<li><a class="h2-card" href="${h}"><img src="${src}" alt="${attr(alt)}" width="800" height="450" loading="lazy" decoding="async"><span class="h2-card-body"><span class="h2-card-k">新手學堂 · 互動教學</span><strong>${esc(t)}</strong></span></a></li>`).join('')}
    <li><a class="h2-card h2-card-kb" href="/help/"><span class="h2-card-body"><span class="h2-card-k">故障排除中心</span><strong>依症狀找答案</strong><span class="h2-card-d">不能解鎖、眼鏡沒畫面……每篇都有判斷表，告訴你下一步與怎樣算修好。</span></span><span class="h2-more">開始排除 ${arrow}</span></a></li>
  </ul>
</section>
<section class="wrap h2-sec" aria-labelledby="brand-wall-title">
  <div class="h2-brands"><h2 id="brand-wall-title">經銷品牌</h2><ul>${BRANDS.map(([file, name, brand]) => `<li><a href="/products/?brand=${encodeURIComponent(brand)}" aria-label="${attr(`查看 ${name} 商品`)}"><img class="b-${file}" src="/assets/img/brands/${file}.png" alt="${attr(name)}" loading="lazy" decoding="async"></a></li>`).join('')}</ul></div>
</section>
<section class="wrap h2-sec faq">
  ${sectionHead('BEFORE WE BUILD', '開始之前，你可能想知道。')}
  ${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
</section>
<section id="contact" class="wrap h2-sec">${contactCta('下一台機器，從你的想法開始。', '告訴我們用途、預算和現有設備，一起把配置想清楚。').replace('<section class="wrap cta-band">', '<div class="cta-band">').replace(/<\/section>$/, '</div>')}</section>`;

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
// 商品說明排版：空行分段；「【標題】」單獨一行為小標；以「・」「•」「-」開頭的連續行為清單（後台仍是純文字，方便編輯）
function richText(text) {
  const out = [];
  for (const block of text.split(/\n{2,}/)) {
    let list = [], para = [];
    const flushPara = () => { if (para.length) out.push(`<p>${para.map(esc).join('<br>')}</p>`); para = []; };
    const flushList = () => { if (list.length) out.push(`<ul>${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`); list = []; };
    for (const raw of block.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const h = line.match(/^【([^】]{1,30})】$/);
      const li = line.match(/^(?:[・•●▪]|-\s)\s*(.+)$/);
      if (h) { flushPara(); flushList(); out.push(`<h3>${esc(h[1])}</h3>`); }
      else if (li) { flushPara(); list.push(li[1]); }
      else { flushList(); para.push(line); }
    }
    flushPara(); flushList();
  }
  return out.join('');
}
// 購買與使用須知：全站共用的售後說明＋依分類／子分類的使用提醒（缺貨商品也顯示）
function noticeHtml(p) {
  const usage = notices?.usage?.[`${p.primary_category_id}/${p.subcategory_id}`] || notices?.usage?.[p.primary_category_id];
  const box = n => `<div class="notice-box"><h3>${esc(n.title)}</h3><ul class="notes">${n.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`;
  return `<section class="pd-block pd-notices" id="notices"><h2>購買與使用須知</h2>${usage ? box(usage) : ''}${notices?.after_sales ? box(notices.after_sales) : ''}</section>`;
}

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
    const descHtml = p.description ? `<section class="pd-block"><h2>商品說明</h2><div class="prose">${richText(p.description)}</div></section>` : '';
    const rv = p.review || {};
    const reviewItems = [...(rv.missing || []).map(m => `待補：${m}`), ...(rv.notes || [])];
    const snap = rv.shopee_sales_snapshot;
    const snapHtml = !p.published && snap?.rows?.length ? `<details class="snap"><summary>蝦皮價格快照（${esc(snap.captured_at.slice(0, 10))}，未公開、待核對）</summary><div class="table-wrap"><table class="table"><thead><tr><th scope="col">規格</th><th scope="col">價格</th></tr></thead><tbody>${snap.rows.map(r => `<tr><td>${esc(r.name || '（單一規格）')}</td><td>${r.price ?? '—'}</td></tr>`).join('')}</tbody></table></div></details>` : '';
    const reviewBox = !p.published && (reviewItems.length || snapHtml) ? `<aside class="review-box"><strong>草稿待核對（僅預覽版顯示）${rv.batch ? `｜首批 ${esc(rv.batch.replace('first-', ''))} 組` : ''}</strong><ul>${reviewItems.map(n => `<li>${esc(n)}</li>`).join('')}</ul>${(p.images || []).some(i => i.rights === 'unverified') ? '<p>圖片由蝦皮匯入，使用權待 EWP 確認（rights: unverified）。</p>' : ''}${snapHtml}</aside>` : '';
    const showcaseNote = showcase ? `<p class="callout" role="note"><strong>作品介紹：</strong>本頁為機型介紹，目前未於官網販售。需要相同或類似配置，請透過 LINE 洽詢客製組裝服務。</p>` : '';
    const anim = p.id === PACK_ANIM.productId ? packAnimSection({ eyebrow: 'ASSEMBLY', title: '從電芯到成品', lead: '靈雀外場電包 4S3P 的製作過程：電芯排列、點焊、熱縮封裝到完成。點下方步驟可以直接跳到該段。', note: '動畫為 4S3P 版本示意。6S3P 版本為 18 顆電芯，規格請見下方選項。' }) : '';
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
  ${anim}${variants}${descHtml}${specs}${compat}${notes}${noticeHtml(p)}
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
      ogImage: imgs[0] ? (imgs[0].fallback || imgs[0].src) : undefined, scripts: ['/assets/js/product.js', ...(anim ? ['/assets/js/pack-anim.js'] : [])], bodyClass: (shopeeBtn || line) ? 'has-sticky-cta' : '',
      // 作品介紹不輸出 Product 結構化資料，避免被視為販售商品
      jsonld: [showcase ? null : ld, breadcrumbsJsonLd(crumbs, BASE)], noindex: !p.published,
    });
  }
}

// ---------- 自製機型 ----------
// 七款 EWP 原創機型的精選目錄：圖片、價格、供貨狀態、連結都在建置時從商城商品資料讀取（builds.json 只存機型名稱與簡介），
// 商品未上架（正式版 visible 不含）就不顯示，不會留下失效連結。
function listedBuilds() {
  return builds.filter(b => b.listed).sort((a, b) => a.order - b.order)
    .map(b => ({ b, p: visible.find(p => p.id === b.product_id) })).filter(x => x.p);
}
function buildPages() {
  const list = listedBuilds();
  const crumbs = [{ name: '首頁', href: '/' }, { name: 'EWP 自製機型' }];
  const card = ({ b, p }, i) => {
    const img = p.images?.[0];
    const name = `${b.name_zh}${b.name_en ? ` ${b.name_en}` : ''}`;
    return `<li class="build-card" data-build="${attr(b.id)}" data-product="${attr(p.id)}"><a href="${url.product(p)}" aria-label="${attr(`${name}｜${b.size}｜查看機型詳情`)}">
  <div class="build-media">${img ? picture({ ...img, alt: img.alt || name }, { lazy: i >= 3, sizes: '(max-width: 599px) 100vw, (max-width: 1099px) 50vw, 340px' }) : `<div class="img-ph"><span>${esc(b.name_zh)}</span></div>`}</div>
  <div class="build-body">
    <p class="build-size"><span>${esc(b.size)}</span>${b.use ? `<span>${esc(b.use)}</span>` : ''}</p>
    <h2>${esc(b.name_zh)}${b.name_en ? ` <small>${esc(b.name_en)}</small>` : ''}</h2>
    <p class="build-sum">${esc(b.summary)}</p>
    <div class="build-meta"><strong class="build-price">${esc(priceText(p))}</strong><span class="build-avail avail-${attr(p.availability)}">${esc(availabilityText(p.availability))}</span></div>
    <span class="build-more">查看機型詳情 <span aria-hidden="true">→</span></span>
  </div>
</a></li>`;
  };
  const body = `${pageHead('EWP BUILDS', 'EWP 自製機型', '由電翼動力設計、組裝與調校的原創機型。點選機型即可查看商品詳情、規格與購買方式。', breadcrumbs(crumbs))}
<section class="wrap"><ul class="build-grid">${list.map(card).join('')}</ul></section>
${contactCta('想要一台自己的配置？', '說明用途、預算與現有設備，我們依需求建議機架、動力與圖傳。')}`;
  page('builds/index.html', { title: 'EWP 自製機型', description: `電翼動力自製 FPV 機型：${list.map(({ b }) => b.name_zh).join('、')}。`, path: '/builds/', body, active: 'builds', jsonld: [breadcrumbsJsonLd(crumbs, BASE)] });

  // 舊的 /builds/<slug>/ 詳情頁：改為導向商城商品頁（機型未上架或規劃中則導回自製機型列表），避免外部連結與搜尋結果變成 404
  for (const b of builds) for (const slug of b.legacy_slugs || []) {
    const hit = list.find(x => x.b.id === b.id);
    const to = hit ? url.product(hit.p) : '/builds/';
    const label = hit ? `${b.name_zh} 商品頁` : 'EWP 自製機型';
    write(`builds/${slug}/index.html`, `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>${esc(b.name_zh)}｜已移至${esc(label)}</title><meta name="robots" content="noindex"><link rel="canonical" href="${attr(BASE + to)}"><meta http-equiv="refresh" content="0; url=${attr(to)}"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><p>此頁已移至 <a href="${attr(to)}">${esc(label)}</a>。</p><script>location.replace(${JSON.stringify(to)})</script></body></html>\n`);
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
    const animProduct = s.id === 'battery-pack' ? packAnimProduct() : null;
    const packAnim = animProduct ? packAnimSection({ eyebrow: 'HOW WE BUILD', title: '一組電池怎麼做', lead: '以靈雀外場電包 4S3P 為例，看 21700 電芯從排列、點焊到熱縮封裝的完整流程。', note: `動畫為示意，客製電池組的電芯與串並聯依需求評估。<a href="${url.product(animProduct)}">看靈雀外場電包商品 →</a>` }) : '';
    const body = `${pageHead(s.name_en.toUpperCase(), s.name, s.summary, breadcrumbs(bc))}
<div class="wrap svc">
  ${s.safety ? `<p class="callout" role="note"><strong>安全提醒：</strong>${esc(s.safety)}</p>` : ''}
  <div class="svc-grid">
    ${list('適用情境', s.situations)}
    ${list('需要提供的資料', s.provide)}
    ${list('服務範圍', s.scope)}
    <section class="svc-block"><h2>流程</h2><ol class="steps">${s.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol></section>
  </div>
  ${packAnim}
  <section class="svc-block"><h2>報價方式</h2><p>${esc(s.pricing)}</p></section>
  <div class="actions">${lineButton(site, `LINE 詢問${s.name}`, 'btn btn-line')}${shopeeButton(site, '蝦皮賣場聊聊')}</div>
  <p class="fine">請勿在訊息中提供身分證字號、銀行帳號等與服務無關的個人資料。</p>
</div>
<section class="wrap other-services"><h2 class="h3">其他服務</h2><ul class="chips">${sorted.filter(x => x.id !== s.id).map(x => `<li><a class="chip" href="${url.service(x)}">${esc(x.name)}</a></li>`).join('')}</ul></section>`;
    page(`services/${s.slug}/index.html`, { title: s.name, description: s.summary, path: url.service(s), body, active: 'services', scripts: packAnim ? ['/assets/js/pack-anim.js'] : [], jsonld: [breadcrumbsJsonLd(bc, BASE), { '@context': 'https://schema.org', '@type': 'Service', name: s.name, description: s.summary, provider: { '@type': 'Organization', name: '電翼動力 EWP' }, areaServed: 'TW' }] });
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
  <p class="callout" role="note"><strong>重要：</strong>不同電池系統與電芯型號的滿電電壓、存放電壓與截止電壓都不同。請依商品標示與電芯規格書使用，不要用同一組數字套用所有電池。詳細觀念可參考 <a href="${(a => a ? helpUrl(a) : '/help/')(helpArticles.find(a => a.published && a.legacy_items.includes(82)))}">故障排除中心的電池電壓說明</a>。</p>
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
  journalPages();
  helpPages();

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
      ['故障排除中心', '依症狀找答案：判斷表、下一步與怎樣算修好。', '/help/'],
    ].map(([t, d, h]) => `<li><a href="${h}"><h3>${t}</h3><p>${d}</p><span class="more">前往 →</span></a></li>`).join('')}</ul></section>
<section class="wrap"><div class="about-band"><div class="motto" aria-label="Build. Tune. Fly."><span>BUILD.</span><span>TUNE.</span><span>FLY.</span></div></div></section>
${bizBlock()}
${contactCta()}` });

  // 聯絡：卡片結構一致（標題 → 說明 → 1:1 圖片＋說明文字 → 按鈕），以 CSS subgrid 讓同一列的圖片與按鈕對齊
  const card = ({ cls, title, desc, img, alt, caption, button }) => `<li class="contact-card ${cls}"><h2>${esc(title)}</h2><p>${esc(desc)}</p>${img ? `<figure class="contact-media"><div class="contact-img"><img src="${attr(img)}" width="720" height="720" alt="${attr(alt)}" loading="lazy" decoding="async"></div><figcaption>${caption}</figcaption></figure>` : '<div></div>'}${button}</li>`;
  const scanHint = '電腦版請用手機掃描 QR Code';
  const mailHref = c.email.value ? `mailto:${c.email.value}${c.email.subject ? `?subject=${encodeURIComponent(c.email.subject)}` : ''}` : '';
  const rows = [
    c.line.enabled && c.line.url ? card({ cls: 'contact-line', title: 'LINE 官方帳號', desc: '整機、零件、維修與電池詢價，建議優先使用 LINE。', img: c.line.qr_image, alt: `電翼動力 LINE 官方帳號 QR Code（${c.line.url}）`, caption: scanHint, button: lineButton(site, '加入 LINE 好友', 'btn btn-line btn-block') }) : '',
    c.line_community?.enabled && c.line_community.url ? card({ cls: 'contact-community', title: c.line_community.name || 'LINE 社群', desc: '電翼動力的 LINE 社群，和 FPV 玩家交流飛行、組裝與調參心得。', img: c.line_community.qr_image, alt: `電翼動力 LINE 社群 ${c.line_community.name || ''} QR Code（${c.line_community.url}）`, caption: scanHint, button: `<a class="btn btn-line btn-block" href="${attr(c.line_community.url)}" target="_blank" rel="noopener">加入 LINE 社群 <span aria-hidden="true">↗</span></a>` }) : '',
    c.shopee.enabled && c.shopee.url ? card({ cls: 'contact-shopee', title: '蝦皮賣場', desc: '已上架商品可直接在蝦皮下單，或透過賣場聊聊詢問。', img: c.shopee.qr_image, alt: `電翼動力蝦皮賣場 QR Code（${c.shopee.url}）`, caption: scanHint, button: shopeeButton(site, '前往蝦皮賣場', 'btn btn-primary btn-block') }) : '',
    c.email.enabled && c.email.value ? card({ cls: 'contact-email', title: 'Email', desc: '商務合作、技術詢問，或寄送較長的需求說明與檔案。', img: c.email.image, alt: `EWP 聯絡 Email：${c.email.value}`, caption: `<span class="contact-addr">${esc(c.email.value)}</span>`, button: `<a class="btn btn-mail btn-block" href="${attr(mailHref)}">寄信給 EWP</a>` }) : '',
    c.instagram.enabled && c.instagram.url ? card({ cls: 'contact-ig', title: 'Instagram', desc: `追蹤 @${c.instagram.handle || ''}，掌握電翼動力最新動態。`, img: c.instagram.qr_image, alt: `電翼動力 Instagram @${c.instagram.handle || ''} QR Code（${c.instagram.url}）`, caption: scanHint, button: `<a class="btn btn-ig btn-block" href="${attr(c.instagram.url)}" target="_blank" rel="noopener">開啟 Instagram <span aria-hidden="true">↗</span></a>` }) : '',
    c.facebook.enabled && c.facebook.url ? card({ cls: 'contact-fb', title: 'Facebook', desc: '', button: `<a class="btn btn-block" href="${attr(c.facebook.url)}" target="_blank" rel="noopener">開啟 Facebook</a>` }) : '',
    c.phone.enabled && c.phone.value ? card({ cls: 'contact-phone', title: '電話', desc: '', button: `<a class="btn btn-block" href="tel:${attr(c.phone.value)}">${esc(c.phone.value)}</a>` }) : '',
  ].join('');
  page('contact/index.html', { title: '聯絡我們', description: '透過 LINE 官方帳號、LINE 社群 EWP FPV Club、蝦皮賣場、Email 或 Instagram 聯絡電翼動力 EWP。', path: '/contact/', active: 'contact',
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
  pol('privacy', '隱私權說明', site.policies.privacy.approved, `${site.policies.privacy.approved ? '' : '<div class="callout" role="note"><strong>草案，待 EWP 正式核對：</strong>以下內容依本網站目前的技術實況撰寫，尚未經電翼動力確認為正式版本。</div>'}<p>最後更新：2026-10-26</p>
<h2>本網站蒐集的資料</h2><p>本網站為靜態網站，沒有會員登入、線上表單或站內購物功能，也沒有安裝廣告追蹤程式。網站本身不會要求你輸入或儲存個人資料。</p>
<h2>流量統計</h2><p>本網站使用 Cloudflare Web Analytics 統計瀏覽次數、熱門頁面、來源網站與載入速度等彙總資料，用來改善網站內容。這項服務不使用 Cookie、不建立個人瀏覽紀錄，也不用於廣告；相關處理依 Cloudflare 的隱私權政策。</p>
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
<div class="actions"><a class="btn" href="/">回到首頁</a><a class="btn" href="/products/">商品商城</a><a class="btn" href="/help/">故障排除中心</a></div></section>` }));
}

// ---------- EWP 專欄（原「最新消息」，網址維持 /journal/） ----------
// src/data/journal/*.md；正式版只產生 published=true 的文章，預覽版含草稿。依日期新到舊排列。
const RELATED_LABEL = { '/products/': '商品商城', '/builds/': 'EWP 自製機型', '/services/': '技術與客製服務', '/batteries/': '電池專區', '/contact/': '聯絡我們', '/about/': '關於 EWP', '/fpv-help.html': '故障排除中心', '/help/': '故障排除中心' };
function visibleJournal() {
  return journal.filter(p => DRAFTS || p.published === true)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.slug.localeCompare(b.slug));
}
function journalPages() {
  const posts = visibleJournal();
  const crumbs = [{ name: '首頁', href: '/' }, { name: 'EWP 專欄' }];
  const card = (p, i) => `<li class="journal-card${i === 0 ? ' is-lead' : ''}"><a href="${journalUrl(p)}">
  <div class="journal-media"><img src="${attr(p.cover)}" alt="${attr(p.cover_alt)}" ${i ? 'loading="lazy" ' : ''}decoding="async" width="1600" height="900"></div>
  <div class="journal-body"><p class="journal-meta"><span class="journal-cat">${esc(p.category)}</span><time datetime="${attr(p.date)}">${esc(formatDate(p.date))}</time></p>
  <h2>${esc(p.title)}</h2><p class="journal-sum">${esc(p.summary)}</p><span class="build-more">閱讀全文 <span aria-hidden="true">→</span></span></div>
</a></li>`;
  const list = posts.length
    ? `<section class="wrap"><ul class="journal-grid">${posts.map(card).join('')}</ul></section>`
    : `<section class="wrap"><div class="empty"><h2>目前還沒有文章</h2><p>第一篇內容準備中。想先看看作品，可以瀏覽自製機型或故障排除中心。</p><div class="actions"><a class="btn" href="/builds/">EWP 自製機型</a><a class="btn" href="/help/">故障排除中心</a></div></div></section>`;
  page('journal/index.html', { title: 'EWP 專欄', description: '電翼動力 EWP 新品公告、FPV 教學、實機展示與製作紀錄。', path: '/journal/', active: 'journal',
    body: `${pageHead('JOURNAL', 'EWP 專欄', '新品公告、FPV 教學、實機展示與製作紀錄。', breadcrumbs(crumbs))}\n${list}`, jsonld: [breadcrumbsJsonLd(crumbs, BASE)] });

  for (const p of posts) {
    const c = [{ name: '首頁', href: '/' }, { name: 'EWP 專欄', href: '/journal/' }, { name: p.title }];
    const video = p.youtube_id ? `<div class="journal-video"><iframe src="https://www.youtube-nocookie.com/embed/${attr(p.youtube_id)}?rel=0" title="${attr(p.title)}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></div>` : '';
    const related = (p.related || []).filter(r => RELATED_LABEL[r]);
    const ld = { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.summary, datePublished: p.date, image: BASE + p.cover,
      mainEntityOfPage: BASE + journalUrl(p), author: { '@type': 'Organization', name: '電翼動力 EWP' }, publisher: { '@type': 'Organization', name: '電翼動力 EWP' } };
    page(`journal/${p.slug}/index.html`, { title: p.title, description: p.summary, path: journalUrl(p), active: 'journal', ogImage: p.cover, noindex: !p.published,
      jsonld: [breadcrumbsJsonLd(c, BASE), ld],
      body: `<article class="wrap journal-article">${breadcrumbs(c)}
<header class="journal-head"><p class="journal-meta"><span class="journal-cat">${esc(p.category)}</span><time datetime="${attr(p.date)}">${esc(formatDate(p.date))}</time></p><h1>${esc(p.title)}</h1></header>
<figure class="journal-fig journal-cover"><img src="${attr(p.cover)}" alt="${attr(p.cover_alt)}" decoding="async" width="1600" height="900"></figure>
${video}
<div class="journal-prose">${p.html}</div>
${related.length ? `<nav class="journal-related" aria-label="相關頁面"><p class="eyebrow">RELATED</p><div class="actions">${related.map(r => `<a class="btn" href="${r}">${esc(RELATED_LABEL[r])}</a>`).join('')}</div></nav>` : ''}
<p class="journal-back"><a href="/journal/">← 回到 EWP 專欄</a></p>
</article>
${contactCta()}` });
  }
}

// ---------- 故障排除中心 /help/ ----------
function visibleHelp() {
  return helpArticles.filter(a => DRAFTS || a.published === true)
    .sort((a, b) => HELP_CATEGORIES.indexOf(a.category) - HELP_CATEGORIES.indexOf(b.category) || (Number(a.order) || 99) - (Number(b.order) || 99) || a.slug.localeCompare(b.slug));
}
function helpPages() {
  const list = visibleHelp();
  const crumbs = [{ name: '首頁', href: '/' }, { name: '故障排除中心' }];
  const level = a => `<span class="help-pill${a.level === 'beginner' ? ' is-new' : ''}">${esc(HELP_LEVELS[a.level] || '')}</span>`;
  const groups = HELP_CATEGORIES.map(c => [c, list.filter(a => a.category === c)]).filter(([, l]) => l.length);
  // 首頁先列一般玩家看得懂的常見症狀，再列全部文章
  const SYMPTOMS = [
    ['插上電池後解鎖不了', 'betaflight-arming'], ['遙控器開了，飛機沒反應', 'receiver-no-control'],
    ['類比眼鏡沒畫面、全是雪花', 'analog-no-video'], ['DJI 眼鏡沒畫面', 'dji-no-video'],
    ['電腦連不上 Betaflight', 'fc-usb-connect'], ['一起飛就翻、馬達不轉', 'motors-after-arming'],
    ['飛不遠就斷圖、斷控', 'range-dropouts'], ['錄影有果凍、飛起來抖', 'vibration-jello'],
    ['電池充不進去、充電器報錯', 'battery-wont-charge'], ['電池鼓包了', 'battery-swelling'],
    ['GPS 收不到衛星', 'gps-no-fix'], ['新機第一次通電', 'first-power-up'],
  ].map(([t, slug]) => [t, list.find(a => a.slug === slug)]).filter(([, a]) => a);
  const index = `<div class="page-head wrap help-index-head">${breadcrumbs(crumbs)}<h1>故障排除中心</h1><p class="lead">選一個最像你遇到的狀況，照步驟檢查；每篇都會告訴你下一步，以及怎樣才算修好。</p>
  <form class="help-search" role="search" onsubmit="return false"><label for="help-q" class="sr-only">搜尋症狀、零件或錯誤代碼</label><input id="help-q" type="search" placeholder="搜尋症狀、零件或錯誤代碼，例如：解鎖、雪花、RXLOSS、Zadig" autocomplete="off" data-help-search></form></div>
<section class="wrap help-index">
  <div class="help-symptoms" data-help-symptoms><h2>常見狀況</h2><ul>${SYMPTOMS.map(([t, a]) => `<li><a href="${helpUrl(a)}">${esc(t)}<span aria-hidden="true">→</span></a></li>`).join('')}</ul></div>
  <div class="help-results" data-help-results hidden><h2>搜尋結果</h2><ul class="help-list" data-help-result-list></ul></div>
  <div class="help-all" data-help-all><h2>全部文章</h2>
  ${groups.map(([c, l]) => `<div class="help-group"><h3>${esc(c)}</h3><ul class="help-list">${l.map(a => `<li data-help-item data-text="${attr(a.searchText)}"><a href="${helpUrl(a)}"><strong>${esc(a.title)}</strong><span>${esc(a.summary)}</span></a></li>`).join('')}</ul></div>`).join('')}</div>
  <p class="help-empty" data-help-empty hidden>找不到符合的文章，可以換個說法，例如用零件名稱或畫面上看到的英文字再搜尋一次。</p>
</section>`;
  page('help/index.html', { title: '故障排除中心', description: 'FPV 穿越機常見故障排除：不能解鎖、圖傳沒畫面等問題，依症狀一步步檢查，附判斷表與完成標準。', path: '/help/', active: 'journal', body: index, scripts: ['/assets/js/help.js'], jsonld: [breadcrumbsJsonLd(crumbs, BASE)] });

  // 舊網址 /fpv-help.html：整個舊知識庫已改寫進故障排除中心。#item-XX 轉到對應文章，其他轉到 /help/；沒有 JavaScript 時列出全部文章。
  // GitHub Pages 不能做伺服器端 301，而且 #錨點不會送到伺服器，所以只能用 JavaScript 依錨點轉址。
  // SEO：canonical 指向 /help/、不加 noindex（Google 建議 noindex 與 canonical 不要混用），讓舊網址累積的連結權重合併到故障排除中心；
  // 備援清單的連結可被追蹤。不加 meta refresh，避免它搶在 JavaScript 之前把 #item-XX 一律帶到 /help/。
  const legacyMap = Object.fromEntries(list.filter(a => a.published).flatMap(a => a.legacy_items.map(n => [`item-${n}`, helpUrl(a)])));
  const batteryArticle = list.find(a => a.published && a.legacy_items.includes(82));
  if (batteryArticle) legacyMap['battery-knowledge'] = helpUrl(batteryArticle);
  page('fpv-help.html', { title: 'FPV 知識庫已改版為故障排除中心', description: '原 FPV 知識庫已全部改寫為故障排除中心。', path: '/fpv-help.html', canonicalPath: '/help/', active: 'journal',
    body: `${pageHead('MOVED', 'FPV 知識庫已改版', '原本的 91 則問題已全部改寫進故障排除中心，正在帶你前往對應的文章。', breadcrumbs([{ name: '首頁', href: '/' }, { name: 'FPV 知識庫' }]))}
<section class="wrap help-index"><p><a class="btn btn-primary" href="/help/">前往故障排除中心</a></p>
${groups.map(([c, l]) => `<div class="help-group"><h2>${esc(c)}</h2><ul>${l.map(a => `<li><a href="${helpUrl(a)}">${esc(a.title)}</a></li>`).join('')}</ul></div>`).join('')}</section>
<script>(function(){var m=${JSON.stringify(legacyMap)};var h=location.hash.slice(1);location.replace(m[h]||'/help/');})();</script>` });

  const repair = services.find(s => s.id === 'repair');
  for (const a of list) {
    const c = [{ name: '首頁', href: '/' }, { name: '故障排除中心', href: '/help/' }, { name: a.category }];
    const toc = [...a.sections, { id: 'more', title: '還是不行？' }];
    const body = `<article class="wrap help-article">${breadcrumbs(c)}
<header class="help-head"><h1>${esc(a.title)}</h1><p class="lead">${esc(a.summary)}</p><a class="btn btn-primary help-start" href="#start">開始檢查 <span aria-hidden="true">↓</span></a></header>
<div class="help-layout">
  <div class="help-main" id="start">
${a.html}
    <section class="help-more" id="more">
      <h2>還是不行？</h2>
      <p>先準備這些資料，送修時可以更快找到問題：</p>
      <ul>${a.prepare.map(p => `<li>${esc(p).replace(/`([^`]+)`/g, '<code>$1</code>')}</li>`).join('')}</ul>
      <a class="help-repair" href="${repair ? url.service(repair) : '/services/'}"><strong>送修檢測</strong><span>寄送實機，由 EWP 檢測與報價</span></a>
    </section>
    <details class="help-scope"><summary>這篇適用的設備與版本</summary><dl class="help-meta"><dt>適用</dt><dd>${esc(a.applies)}</dd><dt>難度</dt><dd>${level(a)}</dd>${a.needs ? `<dt>需要</dt><dd>${esc(a.needs)}</dd>` : ''}<dt>分類</dt><dd>${esc(a.category)}</dd></dl></details>
    <section class="help-sources"><h2>參考資料</h2><ul>${a.sources.map(s => `<li><a href="${attr(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('')}</ul></section>
  </div>
  <aside class="help-aside">
    <nav class="help-toc" aria-label="本頁段落"><p>本頁段落</p><ol>${toc.map(t => `<li><a href="#${t.id}">${esc(t.title)}</a></li>`).join('')}</ol></nav>
  </aside>
</div>
<p class="journal-back"><a href="/help/">← 回到故障排除中心</a></p>
</article>`;
    const ld = { '@context': 'https://schema.org', '@type': 'TechArticle', headline: a.title, description: a.summary,
      mainEntityOfPage: BASE + helpUrl(a), author: { '@type': 'Organization', name: '電翼動力 EWP' }, publisher: { '@type': 'Organization', name: '電翼動力 EWP' } };
    page(`help/${a.slug}/index.html`, { title: a.title, description: a.summary, path: helpUrl(a), active: 'journal', noindex: !a.published, body, scripts: ['/assets/js/help.js'], bodyClass: 'help-page', jsonld: [breadcrumbsJsonLd(c, BASE), ld] });
  }
}

// ---------- sitemap / robots ----------
function seoFiles() {
  if (DRAFTS || PREVIEW) {
    write('robots.txt', 'User-agent: *\nDisallow: /\n');
    // Cloudflare Pages 讀取 _headers：預覽網址每個檔案都加上 noindex（含圖片、教學頁等非版型頁面）
    if (PREVIEW) write('_headers', '/*\n  X-Robots-Tag: noindex, nofollow\n');
    return;
  }
  const urls = ['/', '/products/', ...categories.map(url.category), ...visible.map(url.product), '/builds/',
    '/services/', ...services.map(url.service), '/batteries/', '/journal/', ...visibleJournal().map(journalUrl), '/help/', ...visibleHelp().map(helpUrl), '/learn/lipo-battery/', '/learn/fpv-video/', '/blackbox/', '/tunelab/', '/about/', '/contact/',
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
// 白名單中的手寫 HTML（知識庫、教學頁、飛行數據計畫…）也加上流量統計（legacy 舊版首頁不加）
{
  const snippet = analyticsSnippet(site, { drafts: DRAFTS });
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  if (snippet) for (const f of walk(OUT).filter(f => f.endsWith('.html') && !f.includes(`${path.sep}legacy${path.sep}`))) {
    const html = fs.readFileSync(f, 'utf8');
    if (html.includes('cloudflareinsights') || !html.includes('</body>')) continue;
    fs.writeFileSync(f, html.replace(/<\/body>(?![\s\S]*<\/body>)/, `${snippet}\n</body>`));
  }
}
// 預覽版：手寫 HTML（教學頁、知識庫…）也加上 noindex 與「預覽版」提示條
if (PREVIEW) {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const bar = `<div class="preview-banner" role="status" style="background:#6cc4ff;color:#0b1620;text-align:center;font:700 14px/1.5 system-ui,sans-serif;padding:8px 16px">預覽版${PREVIEW_BRANCH ? `（${PREVIEW_BRANCH}）` : ''}：尚未上線，正式網站是 <a href="${site.base_url}" style="color:#0b1620">www.ewpfpv.com</a></div>`;
  for (const f of walk(OUT).filter(f => f.endsWith('.html'))) {
    let html = fs.readFileSync(f, 'utf8');
    if (html.includes('preview-banner') || !/<body[^>]*>/.test(html)) continue;
    if (!/<meta name="robots"/.test(html)) html = html.replace(/<head>/, '<head>\n<meta name="robots" content="noindex,nofollow">');
    fs.writeFileSync(f, html.replace(/<body[^>]*>/, m => `${m}\n${bar}`));
  }
}
let copiedProductImgDirs = 0;
for (const p of visible) {
  const dir = path.join(PRODUCT_IMG, p.id);
  if (fs.existsSync(dir)) { fs.cpSync(dir, path.join(OUT, 'assets', 'img', 'products', p.id), { recursive: true }); copiedProductImgDirs++; }
}
console.log(`✓ 已產生 ${generated.length} 個頁面＋${STATIC_WHITELIST.length} 項靜態資源＋${copiedProductImgDirs} 件商品圖片 → ${path.relative(ROOT, OUT)}${DRAFTS ? '（含草稿預覽，noindex）' : ''}`);
