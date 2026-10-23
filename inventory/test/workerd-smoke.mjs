// 在 Cloudflare 的執行環境（wrangler dev：workerd＋本機 D1）實際呼叫 API，確認與 Node 測試結果一致。
//   node inventory/test/workerd-smoke.mjs http://localhost:8787
const BASE = process.argv[2] || 'http://localhost:8787';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✖', m); } };
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
const page = await fetch(BASE + '/'); const html = await page.text();
ok(page.status === 200 && html.includes('EWP</b> 庫存管理') && /frame-ancestors 'none'/.test(page.headers.get('content-security-policy') || ''), '管理網頁與安全標頭');
console.log(`\nworkerd 實跑：通過 ${pass}，失敗 ${fail}`);
process.exit(fail ? 1 : 0);
