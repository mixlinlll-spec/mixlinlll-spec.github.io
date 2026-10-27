// 端對端測試（CI 會自動執行；本機執行方式）：
//   npm install && npx playwright install chromium
//   node scripts/build.mjs && node scripts/build.mjs --drafts
//   node tests/serve.mjs dist 8800 &  node tests/serve.mjs _preview 8801 &
//   node tests/e2e.mjs
// 8800 = 正式發布產物 dist/；8801 = 含草稿預覽 _preview/
import { chromium } from 'playwright';
import { loadAll } from '../scripts/lib/data.mjs';
import { priceText, availabilityText } from '../scripts/lib/html.mjs';
// 預期值由目前資料計算（EWP 會在後台修改價格、上下架），不寫死數量或價格
const { products: PRODUCTS } = loadAll();
const PUBLISHED = PRODUCTS.filter(p => p.published).length;
const bySlug = slug => PRODUCTS.find(p => p.slug === slug) || {};
const byId = id => PRODUCTS.find(p => p.id === id) || {};
const ntd = n => `NT$ ${Number(n).toLocaleString('en-US')}`;
const PUB = process.env.PUB || 'http://localhost:8800';
const PRE = process.env.PRE || 'http://localhost:8801';
let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) { passes++; console.log('  ✓', msg); } else { fails++; console.log('  ✖', msg); } };

const browser = await chromium.launch();
const errors = [];
async function newPage(width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`${page.url()} ${e}`));
  page.on('console', m => { if (m.type() === 'error' && !/status of 404/.test(m.text()) && !/ytimg|youtube/.test(m.location()?.url || '')) errors.push(`${page.url()} ${m.text()}`); });
  return page;
}

console.log('1. 版面寬度（320/390/768/1280）無非預期橫捲');
const PAGES = ['/', '/products/', '/products/complete-drones/', '/builds/', '/services/', '/services/repair/', '/batteries/', '/journal/', '/about/', '/contact/', '/privacy/', '/404.html', '/fpv-help.html', '/help/', '/help/betaflight-arming/', '/help/analog-no-video/', '/help/receiver-no-control/', '/help/fc-usb-connect/', '/help/motors-after-arming/'];
for (const w of [320, 390, 768, 1280]) {
  const page = await newPage(w);
  for (const [base, extra] of [[PUB, []], [PRE, ['/product/geprc-moz7-v2-o4-pro-7/', '/products/hardware-prints/?sub=screws']]]) {
    for (const p of [...PAGES, ...extra]) {
      const res = await page.goto(base + p, { waitUntil: 'load' });
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      if (sw > w || (res && res.status() >= 400 && p !== '/404.html')) ok(false, `${w}px ${base === PRE ? '預覽' : '正式'} ${p} scrollWidth=${sw} status=${res?.status()}`);
    }
  }
  ok(true, `${w}px 全部頁面檢查完成`);
  await page.context().close();
}

console.log('2. 桌機導覽與 mega menu');
{
  const page = await newPage(1280);
  await page.goto(PUB + '/');
  ok(await page.isVisible('.nav-desktop'), '桌機顯示主選單');
  await page.click('.mega-toggle');
  ok(await page.isVisible('#mega-products'), '點擊後展開商品分類 mega menu');
  ok(await page.locator('#mega-products .mega-cat').count() === 10, 'mega menu 列出 10 個主分類');
  await page.keyboard.press('Escape');
  ok(!(await page.isVisible('#mega-products')), 'Esc 關閉 mega menu');
  ok(await page.isVisible('.nav-list a[href="/journal/"]'), '上方導覽列直接顯示 EWP 專欄');
  await page.context().close();
}

console.log('3. 手機導覽：漢堡選單與可收合分類');
{
  const page = await newPage(390);
  await page.goto(PUB + '/');
  ok(!(await page.isVisible('.nav-desktop')), '手機隱藏桌機選單');
  await page.click('.menu-btn');
  ok(await page.isVisible('#drawer'), '漢堡選單開啟');
  await page.click('#drawer summary:has-text("商品商城")');
  await page.click('#drawer summary:has-text("螺絲五金與列印件")');
  ok(await page.isVisible('#drawer a[href="/products/hardware-prints/?sub=screws"]'), '展開後可看到「螺絲套裝」子分類');
  await page.click('#drawer summary:has-text("螺絲五金與列印件")');
  ok(!(await page.isVisible('#drawer a[href="/products/hardware-prints/?sub=screws"]')), '可再收起子分類');
  await page.keyboard.press('Escape');
  ok(!(await page.isVisible('#drawer')), 'Esc 關閉選單');
  const h = await page.$$eval('.menu-btn, .icon-btn', els => els.map(e => e.getBoundingClientRect().height));
  ok(h.every(x => x >= 44), '頁首按鈕點擊區 ≥ 44px');
  await page.context().close();
}

console.log('4. 商品搜尋、篩選與網址狀態（草稿預覽資料）');
{
  const page = await newPage(1280);
  await page.goto(PRE + '/products/hardware-prints/?sub=screws');
  const screws = await page.locator('.catalog-grid .pcard:visible').allTextContents();
  ok(screws.length >= 1 && screws.some(t => /螺絲/.test(t)), `「螺絲五金 > 螺絲套裝」找得到螺絲套組（${screws.length} 件）`);
  ok(await page.locator('.crumbs li[aria-current]').textContent() === '螺絲套裝', '麵包屑顯示子分類');
  await page.click('.crumbs a:has-text("螺絲五金與列印件")');
  ok(new URL(page.url()).pathname === '/products/hardware-prints/', '麵包屑可返回上層分類');

  await page.goto(PRE + '/products/complete-drones/?sub=7in-long-range');
  const lr = await page.locator('.catalog-grid .pcard:visible').allTextContents();
  ok(lr.some(t => /GEPRC MOZ7/.test(t)), '「整機 > 7 吋長航」找得到 GEPRC MOZ7');

  await page.goto(PRE + '/products/');
  ok(await page.locator('.catalog-grid .pcard:visible').count() === 24, '第一頁顯示 24 件');
  await page.click('#load-more');
  ok(await page.locator('.catalog-grid .pcard:visible').count() === 48, '載入更多後顯示 48 件');
  await page.fill('#catalog-q', 'moz7');
  await page.waitForTimeout(300);
  ok(new URL(page.url()).searchParams.get('q') === 'moz7', '關鍵字寫入網址 ?q=');
  ok(await page.locator('.catalog-grid .pcard:visible').count() >= 1, '關鍵字 moz7 有結果');
  await page.fill('#catalog-q', '');
  await page.selectOption('#f-brand', 'GEPRC');
  await page.waitForTimeout(100);
  const brands = await page.$$eval('.catalog-grid .pcard:not([hidden])', els => els.map(e => e.dataset.brand));
  ok(brands.length > 0 && brands.every(b => b === 'GEPRC'), `品牌篩選 GEPRC（${brands.length} 件）`);
  ok(new URL(page.url()).searchParams.get('brand') === 'GEPRC', '品牌寫入網址 ?brand=');
  await page.selectOption('#f-size', '7 吋');
  await page.waitForTimeout(100);
  ok(await page.locator('.catalog-grid .pcard:visible').count() >= 1, '品牌＋尺寸（GEPRC／7 吋）組合篩選有結果');
  // 重新開啟分享網址，狀態應還原
  const shared = page.url();
  await page.goto(shared);
  ok(await page.inputValue('#f-brand') === 'GEPRC' && await page.inputValue('#f-size') === '7 吋', '分享網址可還原篩選狀態');
  await page.fill('#catalog-q', 'zzzz不存在的商品');
  await page.waitForTimeout(300);
  ok(await page.isVisible('#catalog-empty'), '無結果時顯示空狀態');
  ok(await page.isVisible('#catalog-empty [data-reset]') && await page.isVisible('#catalog-empty a[href^="https://lin.ee/"]'), '空狀態提供「清除篩選」與 LINE 詢問');
  await page.click('#catalog-empty [data-reset]');
  ok(await page.locator('.catalog-grid .pcard:visible').count() === 24, '清除篩選後恢復列表');
  await page.goto(PRE + '/products/?q=寸');
  ok(await page.locator('.catalog-grid .pcard:visible').count() > 0, '「寸」與「吋」視為相同');
  await page.context().close();
}

console.log('5. 商品詳情（正式版）：價格、供貨、變體');
{
  const page = await newPage(390);
  const fdi = bySlug('fdi-f722-v5-60a-8-blheli32');
  await page.goto(PUB + '/product/fdi-f722-v5-60a-8-blheli32/');
  ok(await page.locator('h1').textContent().then(t => t.trim() === fdi.name_zh), '詳情頁標題');
  ok(await page.locator('.pd-price').textContent() === priceText(fdi), `價格顯示符合資料：${await page.locator('.pd-price').textContent()}`);
  ok(await page.locator('.pd-avail').textContent() === availabilityText(fdi.availability), '供貨狀態符合資料');
  const rows = await page.$$eval('.pd-block table.table:not(.spec) tbody tr', trs => trs.map(t => [...t.children].map(c => c.textContent.trim())));
  ok(rows.length === fdi.variants.length && fdi.variants.every(v => rows.some(r => r[0].includes(v.name) && r[2] === (v.price_twd && fdi.price_display !== 'inquiry' ? ntd(v.price_twd) : '詢價'))), '各規格價格逐一顯示');
  ok(!/NT\$\s*0(?![\d,])/.test(await page.textContent('main')), '沒有 0 元');
  ok(await page.isVisible('.sticky-cta'), '手機底部固定 CTA');
  ok(!(await page.$eval('meta[name=robots]', m => m.content).catch(() => '')).includes('noindex'), '公開商品頁可被索引');
  const lds = await page.$$eval('script[type="application/ld+json"]', s => s.map(x => JSON.parse(x.textContent)));
  ok(lds.some(x => x['@type'] === 'Product' && x.brand), '輸出 Product 結構化資料');
  await page.context().close();
}

console.log(`6. 正式版：${PUBLISHED} 件上架、rejected 不外洩、聯絡資訊正確`);
{
  const page = await newPage(1280);
  await page.goto(PUB + '/products/');
  ok(await page.locator('.pcard').count() === PUBLISHED, `正式版商品列表 ${PUBLISHED} 件`);
  ok(await page.locator('.pcard[data-id="sp-56302849088"], .pcard[data-id="sp-58004035504"]').count() === 0, '非 FPV 玩具（rejected）不出現');
  ok(await page.locator('.pcard .badge-draft').count() === 0, '沒有「草稿」標籤');
  const r = await page.goto(PUB + '/product/fpv-v1/');
  ok(r.status() === 404, 'rejected 商品頁在正式版為 404');
  await page.goto(PUB + '/contact/');
  ok(await page.getAttribute('.contact-line a.btn-line', 'href') === 'https://lin.ee/WIUCkWP', 'LINE 按鈕連到 https://lin.ee/WIUCkWP');
  ok(await page.isVisible('.contact-line .contact-img img'), 'LINE QR Code 顯示');
  ok(await page.locator('a[href="https://shopee.tw/mixlin"]').count() > 0, '蝦皮賣場連結');
  ok(await page.locator('a[href="#"]').count() === 0, '沒有 href="#" 假連結');
  const sm = await (await page.request.get(PUB + '/sitemap.xml')).text();
  ok((sm.match(/\/product\//g) || []).length === PUBLISHED && !sm.includes('/product/fpv-v1/'), `sitemap 含 ${PUBLISHED} 件公開商品、不含 rejected`);
  await page.goto(PUB + '/fpv-help.html');
  ok(/共\s*91\s*則/.test(await page.textContent('body')), '舊網址 /fpv-help.html 正常，仍為 91 則');
  await page.goto(PUB + '/');
  ok(await page.locator('#builds, #workshop, #about, #contact').count() === 4, '首頁保留舊錨點 #builds #workshop #about #contact');
  ok(await page.locator('a[href="/fpv-help.html"]').count() >= 1, '首頁可進入知識庫');
  await page.context().close();
}

console.log('7. 發布隔離：原始碼與草稿 JSON 不在正式網站上');
{
  const page = await newPage(1280);
  for (const p of ['/src/data/products/sp-44561107171.json', '/src/data/site.json', '/scripts/build.mjs', '/tests/e2e.mjs', '/package.json', '/README.md', '/_preview/index.html', '/.generated.json']) {
    const r = await page.request.get(PUB + p);
    ok(r.status() === 404, `正式網站 ${p} → ${r.status()}`);
  }
  await page.context().close();
}

console.log('8. 聯絡頁：五張聯絡卡片（LINE／LINE 社群／蝦皮／Email／Instagram）、營業登記（手機版）');
{
  const page = await newPage(390);
  await page.goto(PUB + '/contact/');
  ok(await page.locator('.contact-grid > .contact-card').count() === 5, '聯絡頁有 5 張卡片');
  const links = {
    '.contact-line a.btn': 'https://lin.ee/WIUCkWP',
    '.contact-community a.btn': 'https://line.me/ti/g2/2pEZoKjUO8ktTiVr5zQagRwDAceZ7S6-8qXhdw',
    '.contact-shopee a.btn': 'https://shopee.tw/mixlin',
    '.contact-email a.btn': 'mailto:mixlin.lll@gmail.com?subject=EWP%20%E5%AE%98%E7%B6%B2%E8%A9%A2%E5%95%8F',
    '.contact-ig a.btn': 'https://www.instagram.com/ewp.fpvlab/',
  };
  for (const [sel, href] of Object.entries(links)) ok(await page.getAttribute(sel, 'href') === href, `${sel} → ${href}`);
  ok(!(await page.content()).includes('spiritsparrow'), '聯絡頁不再出現舊的 @spiritsparrow.battery');
  for (const sel of ['.contact-line', '.contact-community', '.contact-shopee', '.contact-email', '.contact-ig']) {
    await page.locator(`${sel} img`).scrollIntoViewIfNeeded();
    const loaded = await page.$eval(`${sel} img`, img => img.complete && img.naturalWidth > 0);
    const r = await page.$eval(`${sel} .contact-img`, el => el.getBoundingClientRect().toJSON());
    ok(loaded && r.width >= 240 && Math.abs(r.width - r.height) < 2, `${sel} 圖片已載入、1:1、顯示寬度 ${Math.round(r.width)}px（可掃描）`);
    const b = await page.locator(`${sel} a.btn`).boundingBox();
    ok(b && b.height >= 44 && b.width >= 200, `${sel} 按鈕在手機上容易點擊（${Math.round(b?.width)}×${Math.round(b?.height)}）`);
  }
  ok(/ewp\.fpvlab/.test(await page.getAttribute('.contact-ig img', 'alt')), 'Instagram QR 有可辨識的 alt 文字');
  ok((await page.textContent('.site-footer')).includes('@ewp.fpvlab'), '頁尾 Instagram 已改為 @ewp.fpvlab');
  // 電腦與平板：同一列的卡片圖片大小一致、按鈕上緣對齊（不再出現大片空白）
  for (const w of [820, 1366]) {
    const pg = await newPage(w);
    await pg.goto(PUB + '/contact/');
    const m = await pg.$$eval('.contact-card', cs => cs.map(c => ({ top: Math.round(c.getBoundingClientRect().top), img: c.querySelector('.contact-img').getBoundingClientRect().toJSON(), btn: c.querySelector('a.btn').getBoundingClientRect().toJSON() })));
    const rows = Object.values(m.reduce((a, x) => ((a[x.top] ||= []).push(x), a), {}));
    ok(rows.every(r => r.length >= 2), `${w}px：每列至少 2 張卡片（${rows.map(r => r.length).join('+')}）`);
    for (const r of rows) {
      ok(new Set(r.map(x => Math.round(x.btn.top))).size === 1 && new Set(r.map(x => Math.round(x.btn.height))).size === 1, `${w}px：同列按鈕位置與高度一致`);
      ok(new Set(r.map(x => Math.round(x.img.top))).size === 1 && new Set(r.map(x => Math.round(x.img.width))).size === 1, `${w}px：同列圖片位置與尺寸一致`);
    }
    await pg.context().close();
  }
  const body = await page.textContent('main');
  ok(body.includes('電翼動力航模企業社') && body.includes('00693689') && body.includes('台北市內湖區內湖路一段115號4樓'), '聯絡頁顯示營業登記名稱、統一編號、登記地址');
  ok(!body.includes('720322720'), '稅籍編號不公開');
  ok((await page.textContent('.site-footer')).includes('統一編號 00693689'), '頁尾顯示登記名稱與統一編號');
  await page.goto(PUB + '/about/');
  ok((await page.textContent('main')).includes('電翼動力航模企業社'), '關於頁顯示營業登記資訊');
  await page.goto(PUB + '/privacy/');
  ok((await page.textContent('main')).includes('草案，待 EWP 正式核對'), '隱私權頁標示為草案');
  ok((await page.getAttribute('meta[name=robots]', 'content'))?.includes('noindex'), '未核准的隱私權頁為 noindex');
  await page.goto(PUB + '/services/procurement/');
  ok(/淘寶／中國平台代購/.test(await page.textContent('h1')), '代購服務頁存在');
  await page.context().close();
}

console.log('9. 商品頁 CTA 優先序（草稿預覽）');
{
  const page = await newPage(390);
  await page.goto(PRE + '/product/huan-5-fpv-freestyle-f722-2207/');
  ok(await page.$eval('.pd-actions a', a => a.classList.contains('btn-line')), 'EWP 自製整機：LINE 為第一個按鈕');
  await page.goto(PRE + '/product/fdi-f722-v5-60a-8-blheli32/');
  ok(await page.locator('.pd-actions a').count() >= 1, '一般零件：有詢價／購買按鈕');
  const r = await page.goto(PRE + '/product/fpv-v1/');
  ok(r.status() === 404, '非 FPV 玩具（rejected）在預覽版也不產生');
  await page.goto(PRE + '/product/x-1s-2s-450mah-100c-tinywhoop/');
  ok((await page.textContent('.pd-info')).includes('聯名商品') && (await page.textContent('.pd-meta')).includes('十安 × 電翼動力'), '十安聯名電池標示「聯名商品／十安 × 電翼動力」');
  await page.context().close();
}

console.log('10. 營業登記地址：非實體門市提示（手機版）與結構化資料');
{
  const NOTICE = '此地址僅為營業登記地址，非實體門市，不提供現場購物或臨櫃服務，請勿直接前往。商品、維修及收送件事宜，請先透過 LINE 官方帳號聯繫確認。';
  const page = await newPage(390);
  for (const p of ['/about/', '/contact/']) {
    await page.goto(PUB + p);
    const dd = page.locator('.biz-dl dd', { hasText: '台北市內湖區內湖路一段115號4樓' });
    ok(await dd.count() === 1, `${p} 顯示登記地址`);
    const notice = dd.locator('.biz-notice');
    ok((await notice.textContent()).trim() === NOTICE, `${p} 提示文字緊貼地址且內容完全一致`);
    await notice.scrollIntoViewIfNeeded();
    const st = await notice.evaluate(el => { const c = getComputedStyle(el); const r = el.getBoundingClientRect(); return { fs: parseFloat(c.fontSize), color: c.color, bg: getComputedStyle(el).backgroundColor, w: r.width, right: r.right }; });
    ok(st.fs >= 14 && st.w > 200 && st.right <= 390, `${p} 手機版提示可讀（字級 ${st.fs}px、寬 ${Math.round(st.w)}px、未超出畫面）`);
    const lum = rgb => { const [r, g, b] = rgb.match(/\d+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const [L1, L2] = [lum(st.color), lum(st.bg)].sort((a, b) => b - a);
    const ratio = (L1 + 0.05) / (L2 + 0.05);
    ok(ratio >= 4.5, `${p} 提示文字對比 ${ratio.toFixed(1)}:1（≥ 4.5）`);
    const html = await page.content();
    ok(!/google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/.test(html), `${p} 沒有地圖導航連結`);
    ok(!/營業時間：|服務時間：|電話：|tel:/.test(await page.textContent('main')), `${p} 不顯示營業時間與電話`);
  }
  await page.goto(PUB + '/');
  const lds = await page.$$eval('script[type="application/ld+json"]', s => s.map(x => JSON.parse(x.textContent)));
  const org = lds.find(x => x['@type'] === 'Organization');
  ok(org && org.legalName === '電翼動力航模企業社' && org.taxID === '00693689', '結構化資料為 Organization，含登記名稱與統編');
  ok(/非實體門市/.test(org.address?.name || ''), '結構化資料地址標示為營業登記地址（非實體門市）');
  ok(!lds.some(x => /LocalBusiness|Store|Shop/.test(x['@type'])) && !org.openingHours && !org.geo && !org.hasMap, '沒有宣稱 LocalBusiness／門市、營業時間、座標或地圖');
  ok(/統一編號 00693689/.test(await page.textContent('.site-footer')) && !/內湖路/.test(await page.textContent('.site-footer')), '頁尾只顯示名稱與統編');
  for (const sp of ['/services/repair/', '/services/upgrades/', '/services/procurement/', '/services/custom-build/']) {
    await page.goto(PUB + sp);
    ok(!/送件|交件|到店|來店|現場|自取|取貨|親送/.test(await page.textContent('main')), `${sp} 沒有暗示到場送修的文字`);
  }
  await page.context().close();
}

console.log('11. 合規限制移除：整機直接販售');
{
  const page = await newPage(390);
  for (const slug of ['huan-5-fpv-freestyle-f722-2207', 'gobu-3-5-fpv-f722-aio-40a', 'geprc-moz7-v2-o4-pro-7'].filter(s => bySlug(s).published)) {
    await page.goto(PUB + `/product/${slug}/`);
    const info = await page.textContent('.pd-info');
    ok(await page.locator('.pd-price').textContent() === priceText(bySlug(slug)) && !/作品介紹/.test(info), `${slug} 顯示價格，非作品介紹`);
    ok(!/合規|NCC|BSMI/.test(await page.textContent('main')), `${slug} 沒有合規限制文字`);
  }
  if (byId('sp-50367700235').published && byId('sp-50367700235').price_display !== 'inquiry') {
    await page.goto(PUB + '/products/complete-drones/');
    ok(/NT\$/.test(await page.textContent('.pcard[data-id="sp-50367700235"]')), '列表商品卡顯示價格');
  }
  await page.goto(PUB + '/product/fdi-f722-v5-60a-8-blheli32/');
  ok((await page.locator('.spec tr').count()) >= 15, 'FDI 堆疊：規格表');
  ok(!(await page.locator('.review-box').count()), '公開頁不顯示內部審核資訊');
  await page.context().close();
}

console.log('12. 蝦皮匯入圖片（正式版）／rejected 圖片不外洩');
{
  const page = await newPage(390);
  await page.goto(PUB + '/product/sirius-2306-5-1860kv-5-fpv-freestyle/');
  const main = page.locator('.gallery-main img');
  ok(await main.evaluate(i => i.complete && i.naturalWidth > 0), '商品主圖已載入');
  ok(await page.locator('.gallery-thumbs button').count() >= 2, '細節圖縮圖可切換');
  await page.locator('.gallery-thumbs button').nth(1).click();
  ok(await page.getAttribute('.gallery-thumbs button >> nth=1', 'aria-pressed') === 'true', '點擊縮圖切換主圖');
  ok(await page.locator('.pd-price').textContent() === priceText(bySlug('sirius-2306-5-1860kv-5-fpv-freestyle')), '顯示官網價格');
  await page.goto(PUB + '/product/talon-stick-fpv-8k-abs/');
  ok(await page.locator('.var-thumb').count() > 0, '規格選項圖顯示於變體表');
  await page.goto(PUB + '/products/motors-props/');
  const firstImg = page.locator('.catalog-grid .pcard:visible img').first();
  ok(await firstImg.evaluate(i => i.complete && i.naturalWidth > 0), '列表商品卡顯示主圖');
  ok((await page.request.get(PUB + '/assets/img/products/sp-42781322918/01.webp')).status() === 200, '公開商品圖片可存取');
  for (const u of ['/assets/img/products/sp-56302849088/01.webp', '/assets/img/products/sp-58004035504/01-480.webp']) {
    const r = await page.request.get(PUB + u);
    ok(r.status() === 404, `正式網站不提供 rejected 商品圖片 ${u} → ${r.status()}`);
  }
  await page.context().close();
}

console.log('13. 手機版面穩定（CLS < 0.1）');
for (const u of [PUB + '/', PUB + '/products/', PUB + '/products/complete-drones/', PRE + '/products/', PUB + '/product/geprc-moz7-v2-o4-pro-7/', PUB + '/contact/']) {
  const page = await newPage(390);
  await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
  await page.goto(u, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const cls = await page.evaluate(() => window.__cls);
  ok(cls < 0.1, `${u.replace(PUB, '正式').replace(PRE, '預覽')} CLS ${cls.toFixed(3)}`);
  await page.context().close();
}

console.log('14. 鍵盤操作');
{
  const page = await newPage(1280);
  await page.goto(PUB + '/');
  await page.keyboard.press('Tab');
  ok(await page.evaluate(() => document.activeElement.className) === 'skip', '第一個 Tab 為「跳至主要內容」');
  await page.context().close();
}

console.log('15. 自製機型目錄：七款、連到商城商品、手機／平板／電腦排版');
{
  const { builds: BUILDS } = loadAll();
  const listed = BUILDS.filter(b => b.listed).sort((a, b) => a.order - b.order).map(b => byId(b.product_id)).filter(p => p.published);
  for (const [w, cols] of [[390, 1], [820, 2], [1100, 3], [1366, 4]]) {
    const page = await newPage(w);
    await page.goto(PUB + '/builds/');
    const m = await page.$$eval('.build-card', cs => cs.map(c => ({ href: c.querySelector('a').getAttribute('href'), r: c.getBoundingClientRect().toJSON(), media: c.querySelector('.build-media').getBoundingClientRect().toJSON(), fit: getComputedStyle(c.querySelector('.build-media img')).objectFit })));
    ok(m.length === listed.length && listed.length === 7, `${w}px：${m.length} 張機型卡片`);
    if (w === 390) ok(m.every((c, i) => c.href === `/product/${listed[i].slug}/`), '每張卡片連到對應的商城商品頁');
    const rows = Object.values(m.reduce((a, c) => ((a[Math.round(c.r.top)] ||= []).push(c), a), {}));
    ok(rows[0].length === cols, `${w}px：每排 ${rows[0].length} 台（預期 ${cols}）`);
    ok(rows.every(r => new Set(r.map(c => Math.round(c.r.height))).size === 1), `${w}px：同排卡片等高`);
    ok(m.every(c => Math.abs(c.media.width - c.media.height) < 2 && c.fit === 'contain'), `${w}px：圖片 1:1、完整顯示不裁切`);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    ok(sw <= w, `${w}px：無橫向捲動`);
    if (w === 1366) {
      await page.click('.build-card a');
      await page.waitForURL(`**/product/${listed[0].slug}/`);
      ok(true, '點選整張卡片進入商城商品頁');
      await page.goto(PUB + '/builds/huan/');
      await page.waitForURL(`**/product/${listed[0].slug}/`);
      ok(true, '舊網址 /builds/huan/ 導向商城商品頁');
    }
    await page.context().close();
  }
}

console.log('16. 首頁 V2：主視覺、四個入口、自製機型、電池帶、工作台、學習');
{
  const { site: SITE, builds: BUILDS } = loadAll();
  const id = SITE.home_video.youtube_id;
  for (const w of [390, 1366]) {
    const page = await newPage(w);
    await page.goto(PUB + '/', { waitUntil: 'load' });
    const html = await page.content();
    ok(!/<iframe/.test(html), `${w}px：首頁不直接嵌入 YouTube 播放器（不拖慢載入）`);
    ok(await page.$eval('main > section', s => s.className.includes('h2-hero')), `${w}px：主視覺是首頁第一個區塊`);
    ok(await page.locator('h1').count() === 1 && (await page.textContent('h1')).includes('Built to Perform'), `${w}px：首頁只有一個 h1（品牌標語）`);
    ok(!(await page.textContent('.h2-hero')).includes('台灣 FPV 工作室') && !(await page.textContent('.spec-tag')).includes('EWP 自製'), `${w}px：主視覺不顯示小標與「EWP 自製」字樣`);
    ok(await page.locator('.h2-hero-pic img[fetchpriority="high"]').count() === 1, `${w}px：主視覺海報優先載入`);
    ok((await page.textContent('.spec-tag')).includes('HUAN'), `${w}px：海報規格標籤`);
    const doors = await page.$$eval('.h2-doors a', as => as.map(a => a.getAttribute('href')));
    ok(JSON.stringify(doors) === JSON.stringify(['/products/', '/batteries/', '/services/', '/tunelab/']), `${w}px：四個入口連結正確`);
    const cards = await page.$$eval('.h2-build', as => as.map(a => a.getAttribute('href')));
    ok(cards.length === 3 && cards.every(h => h.startsWith('/product/')), `${w}px：三張自製機型卡片連到商城商品`);
    ok((await page.textContent('#builds .h2-more')).includes(`全部 ${BUILDS.filter(b => b.listed).length} 款`), `${w}px：機型總數由資料計算`);
    ok(await page.locator('.h2-batt-pics a').count() === 2, `${w}px：電池帶兩款自製電池`);
    ok(await page.getAttribute('.h2-video', 'href') === `https://www.youtube.com/watch?v=${id}`, `${w}px：KD7 影片連到 YouTube`);
    ok(await page.locator('.h2-learn a[href="/learn/lipo-battery/"], .h2-learn a[href="/learn/fpv-video/"], .h2-learn a[href="/help/"]').count() === 3, `${w}px：學習區三個入口`);
    if (w === 1366) ok(await page.isVisible('.nav-line'), '電腦版：導覽列有 LINE 詢問按鈕');
    else ok(!(await page.isVisible('.nav-line')), '手機版：導覽列不擠 LINE 按鈕（在選單內）');
    await page.context().close();
  }
}

console.log('17. 故障排除中心：搜尋、解鎖原因查詢、類比三選一、怎樣算修好、舊連結導向');
{
  const page = await newPage(390);
  await page.goto(PUB + '/help/', { waitUntil: 'load' });
  await page.fill('[data-help-search]', '雪花');
  ok(await page.locator('[data-help-item]:visible').count() === 1, '總覽：搜尋「雪花」只剩類比圖傳那篇');
  await page.fill('[data-help-search]', '不存在的症狀');
  ok(await page.isVisible('[data-help-empty]'), '總覽：找不到時顯示提示');

  await page.goto(PUB + '/help/betaflight-arming/', { waitUntil: 'load' });
  ok((await page.textContent('[data-flag-answer]')).includes('RXLOSS'), '解鎖：預設顯示 RXLOSS 的說明');
  await page.fill('#flag-q', 'badrx');
  ok((await page.textContent('[data-flag-answer]')).includes('NOT_DISARMED'), '解鎖：輸入 4.4 舊名稱 BADRX 也能查到 4.5 的 NOT_DISARMED');
  await page.click('[data-ver="4.4"]');
  ok((await page.textContent('.flag-name')).startsWith('BADRX'), '解鎖：切到 4.4 顯示舊名稱');
  await page.fill('#flag-q', '');
  await page.click('.flag-list button:has-text("RUNAWAY")');
  ok((await page.textContent('[data-flag-answer]')).includes('先停手'), '解鎖：RUNAWAY 標示先停手');
  for (const b of await page.$$('[data-checks] input')) await b.check();
  ok(await page.isVisible('[data-done]'), '怎樣算修好：全部打勾後顯示完成');
  ok(!(await page.textContent('.help-more')).includes('需額外付費') && await page.locator('.help-more a[href="/services/repair/"]').count() === 1, '還是不行：只有送修檢測（檢測與報價），不另外標示付費');

  await page.goto(PUB + '/help/analog-no-video/', { waitUntil: 'load' });
  ok(await page.locator('.help-case:visible').count() === 3, '類比：一開始三種狀況都看得到');
  await page.click('[data-pick="B"]');
  ok(await page.locator('.help-case:visible').count() === 1 && await page.isVisible('#case-b'), '類比：選 B 只顯示 B');
  await page.click('.help-showall');
  ok(await page.locator('.help-case:visible').count() === 3, '類比：可以再顯示全部');

  await page.goto(PUB + '/help/receiver-no-control/', { waitUntil: 'load' });
  ok(await page.locator('.pick').count() === 5, '對頻：依燈號的五個分支選單');
  await page.click('[data-pick="E"]');
  ok(await page.locator('.help-case:visible').count() === 1 && await page.isVisible('#case-e'), '對頻：選 E 只顯示燈恆亮那一段');

  await page.goto(PUB + '/fpv-help.html#item-10', { waitUntil: 'load' });
  await page.waitForURL('**/help/betaflight-arming/', { timeout: 5000 }).catch(() => {});
  ok(page.url().endsWith('/help/betaflight-arming/'), '舊連結 /fpv-help.html#item-10 導向新版教學');
  await page.goto(PUB + '/fpv-help.html#item-9', { waitUntil: 'load' });
  ok(page.url().endsWith('/fpv-help.html#item-9'), '沒改寫的舊題目不導向');
  await page.context().close();
}

// 教學頁：章節標籤跟著捲動移動時，不可以把整個頁面拉回去（手機上會「滑不下去、一直彈上來」）
console.log('教學頁捲動');
for (const path of ['/learn/fpv-video/', '/learn/lipo-battery/']) {
  const page = await newPage(390);
  await page.route(u => !u.href.startsWith(PUB), rt => rt.fulfill({ body: '', contentType: 'text/css' })); // 外部字型：測試環境不連網
  await page.goto(PUB + path, { waitUntil: 'load' });
  const H = await page.evaluate(() => document.body.scrollHeight);
  const jumps = [];
  for (let y = 300; y < H - 1500; y += 900) {
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y);
    await page.waitForTimeout(500);
    const now = await page.evaluate(() => window.scrollY);
    if (Math.abs(now - y) > 2) jumps.push(`${y}→${Math.round(now)}`);
  }
  const tab = await page.evaluate(() => { const a = document.querySelector('#toc a.on'); const r = a.getBoundingClientRect(), t = a.parentElement.getBoundingClientRect(); return r.left >= t.left - 1 && r.right <= t.right + 1; });
  ok(jumps.length === 0 && tab, `${path}：捲動時頁面不會被拉回${jumps.length ? '（' + jumps.slice(0, 3).join('、') + '）' : ''}，目前章節標籤在畫面內`);
  await page.context().close();
}

// 教學頁互動功能：小工具、測驗、選擇分支圖；入門必學／進階補充標示
console.log('教學頁互動功能');
{
  const page = await newPage(390);
  await page.route(u => !u.href.startsWith(PUB), rt => rt.fulfill({ body: '', contentType: 'text/css' }));
  await page.goto(PUB + '/learn/lipo-battery/', { waitUntil: 'load' });
  await page.click('#labelChips .chip[data-k="c"]');
  ok((await page.textContent('#labelOut')).includes('156A'), 'LiPo：標籤說明可切換');
  await page.click('#sSeg button:has-text("4S")');
  ok((await page.textContent('#vbody')).includes('16.80V'), 'LiPo：電壓換算表切換 S 數');
  await page.check('#checks input >> nth=0');
  ok((await page.textContent('#verdict')).includes('立即停用'), 'LiPo：電池健康檢查判斷');
  await page.fill('#whMah', '6000');
  ok((await page.textContent('#whVerdict')).includes('需航空公司同意'), 'LiPo：瓦時計算與登機判斷');
  ok(await page.evaluate(() => document.querySelectorAll('#toc .lv.core').length === 7 && [...document.querySelectorAll('details.adv')].every(d => !d.open)), 'LiPo：7 章標示必學，進階補充預設收合');
  await page.context().close();
}
{
  const page = await newPage(390);
  await page.route(u => !u.href.startsWith(PUB), rt => rt.fulfill({ body: '', contentType: 'text/css' }));
  await page.goto(PUB + '/learn/fpv-video/', { waitUntil: 'load' });
  await page.fill('#sig', '20'); await page.dispatchEvent('#sig', 'input');
  ok((await page.textContent('#dSt')).includes('馬賽克'), '圖傳：訊號模擬器');
  await page.click('#q1 button:has-text("還沒有")'); await page.click('#q3 button:has-text("延遲最低")');
  ok((await page.textContent('#rec')).includes('HDZero'), '圖傳：選擇分支圖');
  ok(await page.evaluate(() => document.querySelectorAll('#toc .lv.core').length === 5 && document.querySelectorAll('#toc .lv:not(.core)').length === 3), '圖傳：5 章必學、3 章進階');
  await page.context().close();
}

ok(errors.length === 0, `瀏覽器 console 無錯誤${errors.length ? '：' + errors.slice(0, 5).join(' | ') : ''}`);
await browser.close();
console.log(`\n結果：通過 ${passes}，失敗 ${fails}`);
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=Playwright 端對端測試::通過 ${passes}，失敗 ${fails}`);
process.exit(fails ? 1 : 0);
