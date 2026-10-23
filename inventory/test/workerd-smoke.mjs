// 在 Cloudflare 的執行環境（wrangler dev：workerd＋本機 D1）實際呼叫 API，確認與 Node 測試結果一致。
//   node inventory/test/workerd-smoke.mjs http://localhost:8787
import { execSync } from 'node:child_process';
const BASE = process.argv[2] || 'http://localhost:8787';
// 直接修改本機 D1（與 wrangler dev 共用同一個本機資料庫），用來模擬「目標規格被停用」
const WRANGLER = process.env.WRANGLER_CMD || 'npx --prefix .. wrangler';
const d1 = sql => execSync(`${WRANGLER} d1 execute ewp-inventory --local --command "${sql}"`, { stdio: 'pipe' });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✖', m); if (process.env.GITHUB_ACTIONS) console.log(`::error title=workerd 實跑::${m}`); } };
const api = async (p, opts = {}) => {
  const r = await fetch(BASE + p, { ...opts, headers: { 'Content-Type': 'application/json', Origin: BASE, ...(opts.headers || {}) } });
  return { status: r.status, body: await r.json().catch(() => ({})), headers: r.headers };
};
let n = 0;
const adjust = (sku, b) => api(`/api/skus/${sku}/adjust`, { method: 'POST', body: JSON.stringify({ op_id: `smoke-${Date.now()}-${++n}-${Math.random().toString(16).slice(2, 8)}`, reason: '執行環境測試', ...b }) });

console.log('workerd＋D1 實跑');
const me = await api('/api/me'); ok(me.status === 200 && me.body.email === 'ci@ewp.test', '登入者（本機測試帳號）');
const st = await api('/api/stats'); ok(st.status === 200 && st.body.skus > 800 && st.body.uncounted === st.body.skus, `規格 ${st.body.skus} 個、全部尚未盤點`);
const list = await api('/api/skus?q=T15'); ok(list.body.items?.length > 0, `搜尋 T15：${list.body.items?.length} 個規格`);
const sku = list.body.items[0].sku;
let r = await adjust(sku, { kind: 'count', qty: 10, expected_version: 0 }); ok(r.status === 200 && r.body.sku.stock_on_hand === 10, '盤點確認 10');
r = await adjust(sku, { kind: 'count', qty: 99, expected_version: 0 }); ok(r.status === 409, '舊版本號被拒絕（不覆蓋別人的修改）');
r = await adjust(sku, { kind: 'receive', qty: 5 }); ok(r.body.sku?.stock_on_hand === 15, '入庫 5 → 15');
r = await adjust(sku, { kind: 'issue', qty: 16 }); ok(r.status === 409, '出庫超過庫存被拒絕');
const rs = await Promise.all(Array.from({ length: 20 }, () => adjust(sku, { kind: 'issue', qty: 1 })));
ok(rs.filter(x => x.status === 200).length === 15 && rs.filter(x => x.status === 409).length === 5, '同時 20 筆出庫（庫存 15）：15 成功、5 拒絕');
const one = await api(`/api/skus/${sku}`); ok(one.body.stock_on_hand === 0 && one.body.available === 0, '庫存 0、沒有負數');
ok(one.body.alert && ['warning', 'info'].includes(one.body.alert.level), `歸零提醒：${one.body.alert?.level}`);
const led = await api(`/api/skus/${sku}/ledger`); ok(led.body.items.length === 17 && led.body.items.every(x => x.actor === 'ci@ewp.test'), '17 筆異動紀錄（盤點1＋入庫1＋出庫15）、都有操作者');
console.log('移轉的原子性（真實 D1 batch）');
{
  const pid = list.body.items.find(x => x.sku !== sku).product_id;
  const rows = (await api('/api/skus?product=' + pid)).body.items;
  const [src, dst] = rows.filter(x => x.sku !== sku).slice(0, 2).map(x => x.sku);
  if (src && dst) {
    await adjust(src, { kind: 'count', qty: 5, expected_version: (await api('/api/skus/' + src)).body.version });
    const state = async () => JSON.stringify(await Promise.all([src, dst].map(async s => { const r = (await api('/api/skus/' + s)).body; return [r.stock_on_hand, r.version, (await api(`/api/skus/${s}/ledger`)).body.items.length]; })));
    d1(`UPDATE skus SET active = 0 WHERE sku = '${dst}'`);
    const before = await state();
    const tr = (qty, op) => api(`/api/skus/${src}/transfer`, { method: 'POST', body: JSON.stringify({ to_sku: dst, qty, reason: '執行環境測試', op_id: op || `smoke-tr-${Date.now()}-${Math.random().toString(16).slice(2, 8)}` }) });
    let r = await tr(2);
    ok(r.status === 409 && /已停用/.test(r.body.error), '目標已停用：拒絕');
    ok(await state() === before, '真實 D1：交易整筆回復，兩邊數量、版本、紀錄不變');
    d1(`UPDATE skus SET active = 1 WHERE sku = '${dst}'`);
    r = await tr(9); ok(r.status === 409 && (await state()) === before, '來源不足：整筆回復');
    const same = 'smoke-dup-transfer-01';
    const rs = await Promise.all([tr(2, same), tr(2, same), tr(1), tr(1), tr(1), tr(1)]);
    const s = (await api('/api/skus/' + src)).body.stock_on_hand, t = (await api('/api/skus/' + dst)).body.stock_on_hand;
    ok(s + t === 5 && s >= 0 && rs.filter(x => x.status === 200).length >= 2, `並行與重複移轉：來源 ${s}＋目標 ${t}＝5（總數守恆、不為負）`);
    const lo = (await api(`/api/skus/${src}/ledger`)).body.items.filter(x => x.kind === 'transfer_out').length;
    const li = (await api(`/api/skus/${dst}/ledger`)).body.items.filter(x => x.kind === 'transfer_in').length;
    ok(lo === li && lo >= 1, `移出 ${lo} 筆、移入 ${li} 筆紀錄成對`);
  } else ok(false, '找不到可測試的規格');
}
const page = await fetch(BASE + '/'); const html = await page.text();
ok(page.status === 200 && html.includes('EWP</b> 庫存管理') && /frame-ancestors 'none'/.test(page.headers.get('content-security-policy') || ''), '管理網頁與安全標頭');
console.log(`\nworkerd 實跑：通過 ${pass}，失敗 ${fail}`);
process.exit(fail ? 1 : 0);
