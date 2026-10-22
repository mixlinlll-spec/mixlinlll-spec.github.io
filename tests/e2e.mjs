// 端對端測試（CI 會自動執行；本機執行方式）：
//   npm install && npx playwright install chromium
//   node scripts/build.mjs && node scripts/build.mjs --drafts
//   python3 -m http.server 8800 --directory dist &  python3 -m http.server 8801 --directory _preview &
//   node tests/e2e.mjs
// 8800 = 正式發布產物 dist/；8801 = 含草稿預覽 _preview/
import { chromium } from 'playwright';
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
  page.on('console', m => { if (m.type() === 'error' && !/status of 404/.test(m.text())) errors.push(`${page.url()} ${m.text()}`); });
  return page;
}

console.log('1. 版面寬度（320/390/768/1280）無非預期橫捲');
const PAGES = ['/', '/products/', '/products/complete-drones/', '/builds/', '/builds/huan/', '/services/', '/services/repair/', '/batteries/', '/journal/', '/about/', '/contact/', '/privacy/', '/404.html', '/fpv-help.html'];
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
  await page.click('.more-toggle');
  ok(await page.isVisible('#more-menu a[href="/journal/"]'), '「更多」選單含最新消息');
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

console.log('5. 商品詳情（草稿預覽）');
{
  const page = await newPage(390);
  await page.goto(PRE + '/product/fdi-f722-v5-60a-8-blheli32/');
  ok(await page.locator('h1').textContent().then(t => /F722 V5/.test(t)), '詳情頁標題');
  ok(await page.locator('.pd-price').textContent() === '詢價', '無價格顯示「詢價」，不顯示 0 元');
  ok(await page.locator('.pd-avail').textContent() === '供貨狀況請洽詢', '無庫存資料顯示「供貨狀況請洽詢」');
  ok(await page.isVisible('.sticky-cta'), '手機底部固定 CTA');
  ok(await page.$eval('meta[name=robots]', m => m.content).then(c => c.includes('noindex')), '預覽頁 noindex');
  await page.context().close();
}

console.log('6. 正式版：草稿不外洩、聯絡資訊正確');
{
  const page = await newPage(1280);
  await page.goto(PUB + '/products/');
  ok(await page.locator('.pcard').count() === 0, '正式版商品列表沒有任何草稿');
  ok(await page.isVisible('#catalog-empty'), '正式版顯示「商品資料整理中」空狀態');
  const r = await page.goto(PUB + '/product/geprc-moz7-v2-o4-pro-7/');
  ok(r.status() === 404, '草稿詳情頁在正式版為 404');
  await page.goto(PUB + '/contact/');
  ok(await page.getAttribute('.contact-line a.btn-line', 'href') === 'https://lin.ee/WIUCkWP', 'LINE 按鈕連到 https://lin.ee/WIUCkWP');
  ok(await page.isVisible('.qr img'), 'LINE QR Code 顯示');
  ok(await page.locator('a[href="https://shopee.tw/mixlin"]').count() > 0, '蝦皮賣場連結');
  ok(await page.locator('a[href="#"]').count() === 0, '沒有 href="#" 假連結');
  const sm = await (await page.request.get(PUB + '/sitemap.xml')).text();
  ok(!sm.includes('/product/'), 'sitemap 不含草稿商品');
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

console.log('8. 聯絡頁：LINE／Instagram QR、營業登記（手機版）');
{
  const page = await newPage(390);
  await page.goto(PUB + '/contact/');
  const ig = page.locator('.contact-ig a.btn-ig');
  ok(await ig.getAttribute('href') === 'https://www.instagram.com/spiritsparrow.battery/', 'Instagram 按鈕連到 @spiritsparrow.battery');
  const igBox = await ig.boundingBox();
  ok(igBox && igBox.height >= 44 && igBox.width >= 200, `Instagram 按鈕在手機上容易點擊（${Math.round(igBox?.width)}×${Math.round(igBox?.height)}）`);
  const lineBox = await page.locator('.contact-line a.btn-line').boundingBox();
  ok(lineBox && lineBox.height >= 44, 'LINE 按鈕在手機上容易點擊');
  for (const sel of ['.contact-line .qr img', '.contact-ig .qr img']) {
    await page.locator(sel).scrollIntoViewIfNeeded();
    const loaded = await page.$eval(sel, img => img.complete && img.naturalWidth > 0);
    const w = await page.$eval(sel, img => img.getBoundingClientRect().width);
    ok(loaded && w >= 180, `${sel} 已載入且顯示寬度 ${Math.round(w)}px（可掃描）`);
  }
  const alt = await page.getAttribute('.contact-ig .qr img', 'alt');
  ok(/spiritsparrow\.battery/.test(alt), 'Instagram QR 有可辨識的 alt 文字');
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

console.log('11. 首批商品草稿頁（預覽）：作品介紹模式與待補資訊');
{
  const page = await newPage(390);
  for (const slug of ['huan-5-fpv-freestyle-f722-2207', 'gobu-3-5-fpv-f722-aio-40a', 'geprc-moz7-v2-o4-pro-7']) {
    await page.goto(PRE + `/product/${slug}/`);
    const info = await page.textContent('.pd-info');
    ok(/作品介紹/.test(info) && !/到蝦皮購買/.test(info) && !(await page.locator('.pd-price').count()), `${slug} 為作品介紹：無價格、無購買按鈕`);
    const lds = await page.$$eval('script[type="application/ld+json"]', s => s.map(x => JSON.parse(x.textContent)));
    ok(!lds.some(x => x['@type'] === 'Product'), `${slug} 不輸出 Product 結構化資料`);
    ok(/合規待確認：NCC/.test(await page.textContent('.review-box')), `${slug} 預覽顯示合規待確認`);
  }
  await page.goto(PRE + '/product/fdi-f722-v5-60a-8-blheli32/');
  ok((await page.locator('.spec tr').count()) >= 15, 'FDI 堆疊：規格表已由商品說明整理');
  ok((await page.locator('.pd-block h2', { hasText: '規格選項' }).count()) === 1 && /堆疊組/.test(await page.textContent('main')), 'FDI 堆疊：列出 3 種規格變體');
  ok(/待補：/.test(await page.textContent('.review-box')), '預覽頁列出待補資料');
  ok(!/保固|私訊|本賣場/.test(await page.textContent('main .prose')), '商品說明已移除保固與蝦皮站內用語');
  await page.goto(PRE + '/products/complete-drones/');
  ok(/作品介紹/.test(await page.textContent('.pcard[data-id="sp-50367700235"]')), '列表商品卡顯示「作品介紹」而非價格');
  await page.context().close();
}

console.log('12. 蝦皮匯入圖片與快照（預覽）／正式版不外洩');
{
  const page = await newPage(390);
  await page.goto(PRE + '/product/sirius-2306-5-1860kv-5-fpv-freestyle/');
  const main = page.locator('.gallery-main img');
  ok(await main.evaluate(i => i.complete && i.naturalWidth > 0), '商品主圖已載入');
  ok(await page.locator('.gallery-thumbs button').count() >= 2, '細節圖縮圖可切換');
  await page.locator('.gallery-thumbs button').nth(1).click();
  ok(await page.getAttribute('.gallery-thumbs button >> nth=1', 'aria-pressed') === 'true', '點擊縮圖切換主圖');
  ok(/使用權待 EWP 確認/.test(await page.textContent('.review-box')), '預覽標示圖片使用權待確認');
  ok(/蝦皮價格／庫存快照/.test(await page.textContent('.review-box')), '預覽顯示價格庫存快照（收合）');
  ok(await page.locator('.pd-price').textContent() === '詢價', '快照未套用：公開價格仍為「詢價」');
  await page.goto(PRE + '/product/' + 'talon-stick-fpv-8k-abs' + '/');
  ok(await page.locator('.var-thumb').count() > 0, '規格選項圖顯示於變體表');
  await page.goto(PRE + '/products/motors-props/');
  const firstImg = page.locator('.catalog-grid .pcard:visible img').first();
  ok(await firstImg.evaluate(i => i.complete && i.naturalWidth > 0), '列表商品卡顯示主圖');
  for (const u of ['/assets/img/products/sp-42781322918/01.webp', '/assets/img/products/sp-42781322918/01-480.webp']) {
    const r = await page.request.get(PUB + u);
    ok(r.status() === 404, `正式網站不提供未公開商品圖片 ${u} → ${r.status()}`);
  }
  await page.context().close();
}

console.log('13. 手機版面穩定（CLS < 0.1）');
for (const u of [PUB + '/', PUB + '/products/', PUB + '/products/complete-drones/', PRE + '/products/', PRE + '/product/geprc-moz7-v2-o4-pro-7/', PUB + '/contact/']) {
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

ok(errors.length === 0, `瀏覽器 console 無錯誤${errors.length ? '：' + errors.slice(0, 5).join(' | ') : ''}`);
await browser.close();
console.log(`\n結果：通過 ${passes}，失敗 ${fails}`);
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=Playwright 端對端測試::通過 ${passes}，失敗 ${fails}`);
process.exit(fails ? 1 : 0);
