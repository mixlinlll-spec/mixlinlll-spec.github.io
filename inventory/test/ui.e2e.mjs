// 庫存管理網頁端對端測試（手機 390px 與電腦 1280px）：搜尋 → 開啟規格 → 盤點確認 → 入庫 → 出庫 → 歸零警告 → 紀錄
//   node inventory/test/ui.e2e.mjs   （需要 playwright；會自行啟動本機預覽伺服器）
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const port = 8790 + Math.floor(Math.random() * 100);
const server = spawn('node', [path.join(HERE, 'dev-server.mjs'), String(port)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok, fail) => { server.stdout.on('data', d => String(d).includes('本機預覽') && ok()); setTimeout(() => fail(new Error('伺服器未啟動')), 20000); });
const BASE = `http://localhost:${port}`;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✖', m); } };
const browser = await chromium.launch();
try {
  for (const [round, width] of [390, 1280].entries()) {
    console.log(`— 寬度 ${width}px`);
    const page = await (await browser.newContext({ viewport: { width, height: 860 } })).newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
    await page.goto(BASE + '/');
    await page.waitForSelector('.sku');
    ok(await page.textContent('#me') === 'owner@ewp.test（本機測試）', '顯示登入者');
    ok(Number(await page.textContent('#st-uncounted')) > 0, '顯示尚未盤點數量');
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), '沒有橫向捲動');
    await page.fill('#q', 'T15');
    await page.waitForFunction(() => [...document.querySelectorAll('.product h2')].every(h => /T15/i.test(h.textContent)));
    const skus = page.locator('.sku');
    ok(await skus.count() > 1, `搜尋「T15」顯示 ${await skus.count()} 個規格`);
    ok(await page.locator('.product h2 a').first().getAttribute('href').then(h => h.includes('collection/products/edit/src%2Fdata%2Fproducts%2Fsp-')), '每件商品有「商品後台」連結');
    const target = skus.nth(round); // 每一輪用不同（尚未盤點）的規格
    const sku = await target.getAttribute('data-sku');
    await target.click();
    await page.waitForSelector('dialog[open]');
    ok(await page.getAttribute('.tabs [data-kind=count]', 'aria-pressed') === 'true', '尚未盤點的規格預設「盤點確認」');
    ok(/10\/22 蝦皮快照：3（舊數字，僅供參考）/.test(await page.textContent('#d-snapshot')), '舊快照只顯示為參考');
    const box = await page.locator('#d-save').boundingBox();
    ok(box && box.height >= 44, '儲存按鈕高度適合手指點按');
    await page.fill('#d-qty', '2');
    ok(/實際 0 → 2/.test(await page.textContent('#d-preview')), '儲存前預覽變化');
    await page.click('#d-save');
    await page.waitForFunction(() => document.querySelector('#d-onhand').textContent === '2');
    ok(/盤點確認完成：實際 0 → 2/.test(await page.textContent('#toast')), '盤點確認成功');
    await page.waitForFunction(() => /盤點確認｜0 → 2/.test(document.querySelector('#d-ledger').textContent));
    ok(/owner@ewp\.test/.test(await page.textContent('#d-ledger')), '紀錄顯示操作者');
    await page.click('.tabs [data-kind=receive]'); await page.fill('#d-qty', '3'); await page.click('#d-save');
    await page.waitForFunction(() => document.querySelector('#d-onhand').textContent === '5');
    ok(true, '入庫 3 → 實際 5');
    await page.click('.tabs [data-kind=issue]'); await page.fill('#d-qty', '9');
    ok(await page.isDisabled('#d-save') && /數量不足/.test(await page.textContent('#d-preview')), '出庫超過庫存：無法送出');
    await page.fill('#d-qty', '5'); await page.click('#d-save');
    await page.waitForFunction(() => document.querySelector('#d-onhand').textContent === '0');
    const alert = await page.textContent('#d-alert');
    ok(/官網顯示「現貨」/.test(alert) || /可售數量為 0/.test(alert), `歸零後顯示提醒：${alert.slice(0, 30)}…`);
    await page.click('#d-close');
    await page.click('.chip[data-filter=zero]');
    await page.waitForFunction(s => !!document.querySelector(`.sku[data-sku="${s}"]`), sku);
    ok(true, '「可售 0」篩選出剛歸零的規格');
    ok(!errors.length, `沒有 JavaScript 錯誤${errors.length ? '：' + errors.join('; ') : ''}`);
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `inventory-ui-${width}.png`) });
    await page.context().close();
  }
  console.log('— 完整清單（分頁）與已停用規格移轉（390px）');
  {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 860 } })).newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(BASE + '/');
    await page.waitForSelector('.sku');
    const total = Number((await page.textContent('#st-skus')).trim());
    ok(/顯示 100 \/ 共 \d+ 個規格/.test(await page.textContent('#count')), `首頁顯示「${await page.textContent('#count')}」`);
    let clicks = 0;
    while (await page.isVisible('#more') && clicks < 20) {
      const before = await page.locator('.sku').count();
      await page.click('#more'); await page.click('#more', { force: true }).catch(() => {}); clicks++; // 連點兩下：只能載入一次
      await page.waitForFunction(n => document.querySelectorAll('.sku').length > n && !document.querySelector('#more').disabled, before);
    }
    const shown = await page.locator('.sku').count();
    ok(shown === total && !(await page.isVisible('#more')), `按「載入更多」${clicks} 次後顯示全部 ${shown} / ${total} 個規格`);
    ok(await page.evaluate(() => new Set([...document.querySelectorAll('.sku')].map(b => b.dataset.sku)).size) === shown, '沒有重複的規格');
    await page.click('.chip[data-filter=inactive]');
    await page.waitForSelector('.sku');
    ok(/已停用（仍有庫存） 1/.test(await page.textContent('.chip[data-filter=inactive]')), '「已停用（仍有庫存）」顯示數量');
    await page.locator('.sku').first().click();
    await page.waitForSelector('dialog[open]');
    ok(await page.isVisible('#d-inactive') && await page.isVisible('#tabs-inactive') && !(await page.isVisible('#tabs-active')), '已停用規格只提供「移轉」「出庫」');
    ok(await page.locator('#d-target option').count() >= 2, '可選擇移轉到同商品的其他規格');
    await page.fill('#d-qty', '4');
    await page.click('#d-save');
    await page.waitForFunction(() => document.querySelector('#d-onhand').textContent === '0');
    ok(/移轉完成：實際 4 → 0/.test(await page.textContent('#toast')), '移轉 4 件完成');
    await page.waitForFunction(() => /移出/.test(document.querySelector('#d-ledger').textContent));
    ok(true, '紀錄顯示「移出」');
    ok(!errors.length, `沒有 JavaScript 錯誤${errors.length ? '：' + errors.join('; ') : ''}`);
    await page.context().close();
  }
} finally {
  await browser.close(); server.kill();
}
console.log(`\n庫存管理網頁測試：通過 ${pass}，失敗 ${fail}`);
process.exit(fail ? 1 : 0);
