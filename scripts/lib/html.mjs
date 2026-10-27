// 共用版型：Header、Footer、ProductCard、Breadcrumb、CTA。所有頁面都由這裡產生，避免重複硬編碼。
import { AVAILABILITY, SELLER_ROLES } from './data.mjs';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const attr = esc;

export const url = {
  products: () => '/products/',
  category: c => `/products/${c.id}/`,
  sub: (c, s) => `/products/${c.id}/?sub=${encodeURIComponent(s.id)}`,
  product: p => `/product/${p.slug}/`,
  builds: () => '/builds/',
  build: b => `/builds/${b.slug}/`,
  services: () => '/services/',
  service: s => `/services/${s.slug}/`,
};

const NT = n => `NT$ ${Number(n).toLocaleString('en-US')}`;
export const isShowcase = p => p.listing_mode === 'showcase';
export function priceText(p) {
  if (isShowcase(p)) return '作品介紹';
  if (p.price_display === 'fixed' && p.price_twd > 0) return NT(p.price_twd);
  if (p.price_display === 'from' && p.price_twd > 0) return `${NT(p.price_twd)} 起`;
  return '詢價';
}
export const availabilityText = a => AVAILABILITY[a] || AVAILABILITY.unknown;
export const roleText = r => SELLER_ROLES[r] || '';

export function shopeeUrlFor(p, site) {
  if (p.shopee_url) return p.shopee_url;
  const shop = site.contact.shopee;
  if (shop.enabled && shop.shop_id && p.shopee_item_id) return `https://shopee.tw/product/${shop.shop_id}/${p.shopee_item_id}`;
  return null;
}

// ---------- 聯絡按鈕：設定關閉或沒有網址時回傳空字串，不產生假連結 ----------
export function lineButton(site, label = 'LINE 詢價', cls = 'btn btn-line') {
  const l = site.contact.line;
  if (!l.enabled || !l.url) return '';
  return `<a class="${cls}" href="${attr(l.url)}" target="_blank" rel="noopener">${esc(label)} <span aria-hidden="true">↗</span></a>`;
}
export function shopeeButton(site, label = '前往蝦皮賣場', cls = 'btn', href) {
  const s = site.contact.shopee;
  const target = href || (s.enabled ? s.url : null);
  if (!target) return '';
  return `<a class="${cls}" href="${attr(target)}" target="_blank" rel="noopener">${esc(label)} <span aria-hidden="true">↗</span></a>`;
}

function picture(img, { sizes = '(max-width: 720px) 50vw, 300px', lazy = true, cls = '' } = {}) {
  if (!img) return `<div class="img-ph ${cls}" aria-hidden="true"><span>EWP</span></div>`;
  const smallW = (img.src_small && /-(\d+)\.\w+$/.exec(img.src_small)?.[1]) || 600;
  const srcset = img.src_small ? `${attr(img.src_small)} ${smallW}w, ${attr(img.src)} ${img.width || 1200}w` : '';
  const ext = img.fallback ? `<source type="image/webp" ${srcset ? `srcset="${srcset}" sizes="${sizes}"` : `srcset="${attr(img.src)}"`}>` : '';
  const src = img.fallback || img.src;
  return `<picture class="${cls}">${ext}<img src="${attr(src)}" ${!img.fallback && srcset ? `srcset="${srcset}" sizes="${sizes}"` : ''} alt="${attr(img.alt)}" width="${img.width || 1200}" height="${img.height || 1200}" ${lazy ? 'loading="lazy" decoding="async"' : 'fetchpriority="high"'}></picture>`;
}
export { picture };

// ---------- ProductCard（唯一來源；列表、首頁、電池專區共用） ----------
export function productCard(p, ctx, { hidden = false, eager = false } = {}) {
  const cat = ctx.catMap.get(p.primary_category_id);
  const sub = cat?.subcategories.find(s => s.id === p.subcategory_id);
  const search = [p.name_zh, p.brand, p.sku, p.manufacturer_model, ...(p.aliases || []), ...(p.tags || []),
    ...(p.variants || []).flatMap(v => [v.name, v.sku]), ...(p.specifications || []).map(s => `${s.key} ${s.value}`),
    cat?.name, sub?.name, ...(p.compatible_sizes || [])].filter(Boolean).join(' ').toLowerCase();
  const data = {
    'data-id': p.id, 'data-cat': p.primary_category_id, 'data-sub': p.subcategory_id || '', 'data-brand': p.brand || '',
    'data-sizes': (p.compatible_sizes || []).join('|'), 'data-video': p.video_system || '', 'data-cells': (p.battery_cells || []).join('|'),
    'data-price': isShowcase(p) ? '' : (p.price_twd ?? ''), 'data-avail': p.availability, 'data-featured': p.featured ? '1' : '0',
    'data-updated': p.updated_at, 'data-name': p.name_zh, 'data-search': search,
  };
  const dataAttrs = Object.entries(data).map(([k, v]) => `${k}="${attr(v)}"`).join(' ');
  return `<li class="pcard" ${dataAttrs}${hidden ? ' hidden' : ''}>
  <a class="pcard-link" href="${url.product(p)}">
    <div class="pcard-media">${picture(p.images?.[0], { sizes: '(max-width: 720px) 50vw, 280px', lazy: !eager })}${p.published ? '' : '<span class="badge badge-draft">草稿</span>'}</div>
    <div class="pcard-body">
      <span class="pcard-meta">${esc(roleText(p.seller_role))}${p.brand ? ` · ${esc(p.brand)}` : ''}</span>
      <h3 class="pcard-title">${esc(p.name_zh)}</h3>
      <div class="pcard-foot"><span class="price${p.price_display === 'inquiry' ? ' price-inquiry' : ''}">${esc(priceText(p))}</span><span class="avail avail-${attr(p.availability)}">${esc(isShowcase(p) ? '未於官網販售' : availabilityText(p.availability))}</span></div>
    </div>
  </a>
</li>`;
}

export function breadcrumbs(items) {
  const li = items.map((it, i) => i === items.length - 1
    ? `<li aria-current="page">${esc(it.name)}</li>`
    : `<li><a href="${attr(it.href)}">${esc(it.name)}</a></li>`).join('');
  return `<nav class="crumbs" aria-label="麵包屑"><ol>${li}</ol></nav>`;
}
export function breadcrumbsJsonLd(items, base) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, ...(it.href ? { item: base + it.href } : {}) })),
  };
}

// ---------- Header / Footer ----------
const NAV = [
  { href: '/builds/', label: '自製機型', key: 'builds' },
  { href: '/batteries/', label: '電池專區', key: 'batteries' },
  { href: '/services/', label: '技術服務', key: 'services' },
  { href: '/tunelab/', label: 'TUNE LAB', key: 'tunelab', cls: 'nav-lab' },
  { href: '/journal/', label: '學習', key: 'journal' },
];
// 桌機主選單放不下的頁面：只出現在手機選單與頁尾
const NAV_MORE = [
  { href: '/fpv-help.html', label: 'FPV 知識庫' },
  { href: '/about/', label: '關於 EWP' },
  { href: '/contact/', label: '聯絡我們' },
];
// 官方 Logo（透明背景 PNG，626×226）。紅色為品牌識別色，不得以 CSS 改色。
const LOGO = (h = 46) => `<img class="brand-logo" src="/assets/img/brand/ewp-logo.png" alt="電翼動力 EWP" width="${Math.round(h * 626 / 226)}" height="${h}">`;

function megaMenu(ctx) {
  const cols = ctx.categories.map(c => `<div class="mega-col">
      <a class="mega-cat" href="${url.category(c)}">${esc(c.name)}</a>
      <ul>${c.subcategories.slice(0, 6).map(s => `<li><a href="${url.sub(c, s)}">${esc(s.name)}</a></li>`).join('')}</ul>
    </div>`).join('');
  return `<div class="mega" id="mega-products">
    <div class="wrap mega-inner">
      <form class="mega-search" action="/products/" method="get" role="search">
        <label for="mega-q" class="sr-only">搜尋商品</label>
        <input id="mega-q" type="search" name="q" placeholder="搜尋品名、品牌、型號、規格">
        <button class="btn btn-primary" type="submit">搜尋</button>
      </form>
      <div class="mega-grid">${cols}</div>
      <a class="mega-all" href="/products/">瀏覽所有商品 →</a>
    </div>
  </div>`;
}

function mobileMenu(ctx) {
  const cats = ctx.categories.map(c => `<li><details>
      <summary>${esc(c.name)}</summary>
      <ul><li><a href="${url.category(c)}">全部${esc(c.name)}</a></li>${c.subcategories.map(s => `<li><a href="${url.sub(c, s)}">${esc(s.name)}</a></li>`).join('')}</ul>
    </details></li>`).join('');
  return `<div class="drawer" id="drawer" hidden>
    <form class="drawer-search" action="/products/" method="get" role="search">
      <label for="drawer-q" class="sr-only">搜尋商品</label>
      <input id="drawer-q" type="search" name="q" placeholder="搜尋商品">
      <button class="btn btn-primary" type="submit">搜尋</button>
    </form>
    <ul class="drawer-list">
      <li><details><summary>商品商城</summary><ul class="drawer-cats"><li><a href="/products/">所有商品</a></li>${cats}</ul></details></li>
      ${NAV.map(n => `<li><a href="${n.href}"${n.cls ? ` class="${n.cls}"` : ''}>${n.label}</a></li>`).join('')}
      ${NAV_MORE.map(n => `<li><a href="${n.href}">${n.label}</a></li>`).join('')}
    </ul>
    <div class="drawer-cta">${lineButton(ctx.site, 'LINE 詢價', 'btn btn-line btn-block')}</div>
  </div>`;
}

export function header(ctx, active) {
  const items = NAV.map(n => `<li><a href="${n.href}"${n.cls ? ` class="${n.cls}"` : ''}${active === n.key ? ' aria-current="page"' : ''}>${n.label}</a></li>`).join('');
  return `<header class="site-header">
  <div class="wrap nav">
    <a class="brand" href="/" aria-label="電翼動力 EWP 首頁">${LOGO(46)}</a>
    <nav class="nav-desktop" aria-label="主要導覽">
      <ul class="nav-list">
        <li class="has-mega"><a href="/products/"${active === 'products' ? ' aria-current="page"' : ''}>商品商城</a><button class="mega-toggle" type="button" aria-expanded="false" aria-controls="mega-products"><span class="sr-only">展開商品分類</span><span aria-hidden="true">▾</span></button></li>
        ${items}
      </ul>
    </nav>
    <div class="nav-actions">
      ${lineButton(ctx.site, 'LINE 詢問', 'btn btn-line nav-line')}
      <a class="icon-btn" href="/products/#catalog-q" aria-label="搜尋商品"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></a>
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="drawer"><span class="menu-label">選單</span></button>
    </div>
  </div>
  ${megaMenu(ctx)}
  ${mobileMenu(ctx)}
</header>`;
}

export function footer(ctx) {
  const c = ctx.site.contact;
  const contactLinks = [
    c.line.enabled && c.line.url ? `<li><a href="${attr(c.line.url)}" target="_blank" rel="noopener">${esc(c.line.label)}</a></li>` : '',
    c.line_community?.enabled && c.line_community.url ? `<li><a href="${attr(c.line_community.url)}" target="_blank" rel="noopener">${esc(c.line_community.label)}</a></li>` : '',
    c.shopee.enabled && c.shopee.url ? `<li><a href="${attr(c.shopee.url)}" target="_blank" rel="noopener">${esc(c.shopee.label)}</a></li>` : '',
    c.instagram.enabled && c.instagram.url ? `<li><a href="${attr(c.instagram.url)}" target="_blank" rel="noopener">${esc(c.instagram.label)}</a></li>` : '',
    c.facebook.enabled && c.facebook.url ? `<li><a href="${attr(c.facebook.url)}" target="_blank" rel="noopener">${esc(c.facebook.label)}</a></li>` : '',
    c.youtube.enabled && c.youtube.url ? `<li><a href="${attr(c.youtube.url)}" target="_blank" rel="noopener">${esc(c.youtube.label)}</a></li>` : '',
    c.email.enabled && c.email.value ? `<li><a href="mailto:${attr(c.email.value)}">${esc(c.email.value)}</a></li>` : '',
  ].join('');
  const pol = ctx.site.policies;
  return `<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand">
      <a class="brand" href="/" aria-label="電翼動力 EWP 首頁">${LOGO(52)}</a>
      <p>${esc(ctx.site.brand.motto)} ${esc(ctx.site.brand.tagline)}.</p>
    </div>
    <div><h2 class="footer-h">商品</h2><ul>${ctx.categories.slice(0, 6).map(c => `<li><a href="${url.category(c)}">${esc(c.name)}</a></li>`).join('')}<li><a href="/products/">所有商品</a></li></ul></div>
    <div><h2 class="footer-h">EWP</h2><ul><li><a href="/builds/">自製機型</a></li><li><a href="/batteries/">電池專區</a></li><li><a href="/services/">技術服務</a></li><li><a href="/tunelab/">Tune Lab</a></li><li><a href="/fpv-help.html">FPV 知識庫</a></li><li><a href="/journal/">EWP 專欄</a></li><li><a href="/about/">關於 EWP</a></li></ul></div>
    <div><h2 class="footer-h">聯絡</h2><ul>${contactLinks}<li><a href="/contact/">聯絡我們</a></li></ul></div>
  </div>
  <div class="wrap footer-row">
    <span>© ${ctx.site.copyright_since} 電翼動力 EWP${ctx.site.business ? `｜${esc(ctx.site.business.legal_name)}｜統一編號 ${esc(ctx.site.business.tax_id)}` : ''}</span>
    <span class="footer-legal">${pol.privacy.approved ? '<a href="/privacy/">隱私權說明</a>' : ''}${pol.terms.approved ? '<a href="/terms/">網站條款</a>' : ''}${pol['shipping-returns'].approved ? '<a href="/shipping-returns/">售後與退換</a>' : ''}</span>
    <span class="footer-note">商品頁出現的品牌名稱僅用於標示商品，不代表原廠代理或授權。</span>
  </div>
</footer>`;
}

// Cloudflare Web Analytics：只在正式網域載入（本機測試、草稿預覽都不載入、不送資料）
export function analyticsSnippet(site, { drafts = false } = {}) {
  const a = site?.analytics;
  if (drafts || !a?.cloudflare_token || !/^[0-9a-f]{32}$/.test(a.cloudflare_token)) return '';
  const host = JSON.stringify(a.hostname || '');
  const beacon = JSON.stringify(JSON.stringify({ token: a.cloudflare_token }));
  return `<!-- Cloudflare Web Analytics --><script>if(location.hostname===${host}){var s=document.createElement('script');s.defer=true;s.src='https://static.cloudflareinsights.com/beacon.min.js';s.setAttribute('data-cf-beacon',${beacon});document.head.appendChild(s)}</script><!-- End Cloudflare Web Analytics -->`;
}

export function layout(ctx, { title, description, path, body, active, noindex = false, ogImage, jsonld = [], scripts = [], bodyClass = '' }) {
  const site = ctx.site;
  const fullTitle = title ? `${title}｜電翼動力 EWP` : `電翼動力 EWP｜${site.brand.motto}`;
  const desc = description || site.default_description;
  const canonical = site.base_url + path;
  const og = site.base_url + (ogImage || site.default_og_image);
  const robots = noindex || ctx.drafts || ctx.preview ? '<meta name="robots" content="noindex,nofollow">' : '';
  const ld = jsonld.filter(Boolean).map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n');
  const draftBanner = ctx.drafts ? '<div class="draft-banner" role="status">草稿預覽：此版本包含未發布商品，僅供 EWP 內部檢查，請勿對外分享。</div>' : '';
  const previewBanner = ctx.preview ? `<div class="draft-banner preview-banner" role="status">預覽版${ctx.preview.branch ? `（${esc(ctx.preview.branch)}）` : ''}：尚未上線，正式網站是 <a href="${attr(site.base_url)}">www.ewpfpv.com</a></div>` : '';
  return `<!doctype html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#101113">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${attr(desc)}">
${robots}
<link rel="canonical" href="${attr(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="電翼動力 EWP">
<meta property="og:locale" content="zh_TW">
<meta property="og:title" content="${attr(fullTitle)}">
<meta property="og:description" content="${attr(desc)}">
<meta property="og:url" content="${attr(canonical)}">
<meta property="og:image" content="${attr(og)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/site.css?v=${ctx.version}">
${ld}
</head>
<body class="${attr(bodyClass)}">
<a class="skip" href="#main">跳至主要內容</a>
${draftBanner}${previewBanner}
${header(ctx, active)}
<main id="main">
${body}
</main>
${footer(ctx)}
<script src="/assets/js/site.js?v=${ctx.version}" defer></script>
${scripts.map(s => `<script src="${s}?v=${ctx.version}" defer></script>`).join('\n')}
${analyticsSnippet(ctx.site, { drafts: ctx.drafts })}
</body>
</html>
`;
}
