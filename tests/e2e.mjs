// 端對端冒煙測試（本機執行）。需要 Playwright：
//   npm i -D playwright && npx playwright install chromium
//   node scripts/build.mjs && node scripts/build.mjs --drafts
//   python3 -m http.server 8800 &  python3 -m http.server 8801 --directory _preview &
//   node tests/e2e.mjs
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
  await page.goto(PRE + '/product/geprc-moz7-v2-o4-pro-7/');
  ok(await page.locator('h1').textContent().then(t => /MOZ7/.test(t)), '詳情頁標題');
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

console.log('7. 鍵盤操作');
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
process.exit(fails ? 1 : 0);
