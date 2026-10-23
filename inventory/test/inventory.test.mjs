// 庫存後台測試：node --test inventory/test/
import test, { describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createD1 } from './d1-shim.mjs';
import { makeFixture as makeFixtureAt } from './fixture.mjs';
import worker from '../src/index.js';
import { resetJwksCache } from '../src/auth.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const MIGRATIONS = fs.readdirSync(path.join(HERE, '..', 'migrations')).sort().map(f => path.join(HERE, '..', 'migrations', f));
const makeFixture = mutate => makeFixtureAt(ROOT, mutate);
const FIXTURE = makeFixture();
const readP = (dir, id) => JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8'));
const writeP = (dir, p) => fs.writeFileSync(path.join(dir, `${p.id}.json`), JSON.stringify(p, null, 2) + '\n');
const PRODUCTS = fs.readdirSync(FIXTURE).map(f => JSON.parse(fs.readFileSync(path.join(FIXTURE, f), 'utf8')));
const ACTIVE = PRODUCTS.filter(p => p.review?.status !== 'rejected');
const EXPECTED_SKUS = ACTIVE.reduce((a, p) => a + Math.max(1, p.variants?.length || 0), 0);

function catalogSql(extra = [], dir = FIXTURE, env = {}) {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'inv-')), 'catalog.sql');
  execFileSync('node', ['scripts/inventory-catalog-sql.mjs', '--out', out, '--products-dir', dir, ...extra], { cwd: ROOT, stdio: 'pipe', env: { ...process.env, ...env } });
  return fs.readFileSync(out, 'utf8');
}
const hasSnapshotRev = (() => { try { execFileSync('git', ['cat-file', '-e', '3dc1916^{commit}'], { cwd: ROOT, stdio: 'pipe' }); return true; } catch { return false; } })();

function setup() {
  const db = createD1(MIGRATIONS);
  db.raw.exec(catalogSql(hasSnapshotRev ? ['--snapshot-rev', '3dc1916'] : []));
  const env = { DB: db, DEV_AUTH_EMAIL: 'owner@ewp.test' };
  const call = async (p, opts = {}) => {
    const res = await worker.fetch(new Request('http://localhost' + p, { ...opts, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...(opts.headers || {}) } }), env, {});
    const ct = res.headers.get('Content-Type') || '';
    return { status: res.status, headers: res.headers, body: ct.includes('json') ? await res.json() : await res.text() };
  };
  let n = 0;
  const op = () => `test-op-${Date.now()}-${++n}-${Math.random().toString(16).slice(2, 8)}`;
  const adjust = (sku, body) => call(`/api/skus/${sku}/adjust`, { method: 'POST', body: JSON.stringify({ op_id: op(), reason: '測試', ...body }) });
  return { db, env, call, adjust, op };
}
const first = (db, sql, ...p) => db.raw.prepare(sql).get(...p);

describe('商品清單同步（GitHub 商品資料 → D1，不碰庫存數字）', () => {
  test('商品與規格數量正確、庫存初始為 0、全部尚未盤點', () => {
    const { db } = setup();
    assert.equal(first(db, 'SELECT count(*) n FROM products WHERE active=1').n, ACTIVE.length);
    assert.equal(first(db, 'SELECT count(*) n FROM skus WHERE active=1').n, EXPECTED_SKUS);
    assert.equal(first(db, 'SELECT sum(stock_on_hand) s FROM skus').s, 0);
    assert.equal(first(db, 'SELECT count(*) n FROM skus WHERE counted_at IS NOT NULL').n, 0);
    assert.ok(!PRODUCTS.filter(p => p.review?.status === 'rejected').some(p => first(db, 'SELECT 1 x FROM products WHERE id=?', p.id)), '不上官網的商品不建立');
  });
  test('10/22 蝦皮快照只寫入「參考值」欄位，不當成庫存', { skip: !hasSnapshotRev && '沒有歷史版本' }, () => {
    const { db } = setup();
    const n = first(db, 'SELECT count(*) n FROM skus WHERE snapshot_qty IS NOT NULL').n;
    assert.ok(n > EXPECTED_SKUS * 0.9, `參考值 ${n} 筆`);
    assert.equal(first(db, 'SELECT sum(stock_on_hand) s FROM skus').s, 0);
  });
  test('重新同步不會改動庫存、盤點與參考值；商品不存在時停用而非刪除', async () => {
    const { db, adjust } = setup();
    const sku = first(db, 'SELECT sku, snapshot_qty FROM skus LIMIT 1');
    const r = await adjust(sku.sku, { kind: 'count', qty: 7, expected_version: 0 });
    assert.equal(r.status, 200);
    db.raw.exec("UPDATE skus SET snapshot_qty = 999 WHERE sku = '" + sku.sku + "'");
    db.raw.exec(catalogSql(hasSnapshotRev ? ['--snapshot-rev', '3dc1916'] : []));
    const after = first(db, 'SELECT * FROM skus WHERE sku=?', sku.sku);
    assert.equal(after.stock_on_hand, 7); assert.ok(after.counted_at); assert.equal(after.snapshot_qty, 999);
    db.raw.exec("INSERT INTO products (id, name) VALUES ('sp-gone', '已移除'); INSERT INTO skus (sku, product_id, stock_on_hand) VALUES ('EWP-SPgone-0', 'sp-gone', 3);");
    db.raw.exec(catalogSql());
    const gone = first(db, "SELECT active, stock_on_hand FROM skus WHERE sku='EWP-SPgone-0'");
    assert.equal(gone.active, 0); assert.equal(gone.stock_on_hand, 3);
  });
  test('同步 SQL 只能輸出到 repo 外', () => {
    assert.throws(() => execFileSync('node', ['scripts/inventory-catalog-sql.mjs', '--out', path.join(ROOT, 'x.sql')], { cwd: ROOT, stdio: 'pipe' }));
  });
});

describe('登入（Cloudflare Access）', () => {
  let keys;
  before(async () => {
    keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  });
  const TEAM = 'https://ewp.cloudflareaccess.com';
  const AUD = 'aud-123';
  const b64 = b => Buffer.from(b).toString('base64url');
  async function jwt(payload, { kid = 'k1', key } = {}) {
    const h = b64(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
    const p = b64(JSON.stringify(payload));
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key || keys.privateKey, new TextEncoder().encode(`${h}.${p}`));
    return `${h}.${p}.${b64(sig)}`;
  }
  async function req(token, env) {
    resetJwksCache();
    const jwk = { ...(await crypto.subtle.exportKey('jwk', keys.publicKey)), kid: 'k1' };
    const fetchImpl = async url => { assert.equal(url, `${TEAM}/cdn-cgi/access/certs`); return new Response(JSON.stringify({ keys: [jwk] })); };
    const headers = token ? { 'Cf-Access-Jwt-Assertion': token } : {};
    return worker.fetch(new Request('https://ewp-inventory.example.workers.dev/api/me', { headers }), { DB: createD1(MIGRATIONS), ...env }, {}, { fetchImpl });
  }
  const ENV = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };
  const exp = () => Math.floor(Date.now() / 1000) + 600;
  test('未設定 Access 時全部拒絕（fail closed）', async () => assert.equal((await req(null, {})).status, 503));
  test('沒有登入憑證 → 403', async () => assert.equal((await req(null, ENV)).status, 403));
  test('正確憑證 → 取得登入 Email', async () => {
    const r = await req(await jwt({ iss: TEAM, aud: [AUD], email: 'owner@ewp.tw', exp: exp() }), ENV);
    assert.equal(r.status, 200); assert.equal((await r.json()).email, 'owner@ewp.tw');
  });
  test('錯誤的 audience／issuer／過期／竄改／他人金鑰 → 403', async () => {
    assert.equal((await req(await jwt({ iss: TEAM, aud: ['other'], email: 'a', exp: exp() }), ENV)).status, 403);
    assert.equal((await req(await jwt({ iss: 'https://evil.cloudflareaccess.com', aud: [AUD], email: 'a', exp: exp() }), ENV)).status, 403);
    assert.equal((await req(await jwt({ iss: TEAM, aud: [AUD], email: 'a', exp: Math.floor(Date.now() / 1000) - 5 }), ENV)).status, 403);
    const good = await jwt({ iss: TEAM, aud: [AUD], email: 'a', exp: exp() });
    const [h, , s] = good.split('.');
    assert.equal((await req(`${h}.${b64(JSON.stringify({ iss: TEAM, aud: [AUD], email: 'boss', exp: exp() }))}.${s}`, ENV)).status, 403);
    const other = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
    assert.equal((await req(await jwt({ iss: TEAM, aud: [AUD], email: 'a', exp: exp() }, { key: other.privateKey }), ENV)).status, 403);
  });
  test('本機測試帳號只在 localhost 有效', async () => {
    const r = await worker.fetch(new Request('https://ewp-inventory.example.workers.dev/api/me'), { DB: createD1(MIGRATIONS), DEV_AUTH_EMAIL: 'dev@x' }, {});
    assert.equal(r.status, 503);
  });
});

describe('庫存操作', () => {
  const pick = db => first(db, "SELECT s.sku FROM skus s JOIN products p ON p.id=s.product_id WHERE coalesce(s.site_availability,p.availability)='in_stock' LIMIT 1").sku;
  test('搜尋：商品名稱、規格名稱、SKU、蝦皮商品 ID；篩選尚未盤點', async () => {
    const { call } = setup();
    const t15 = (await call('/api/skus?q=T15')).body.items;
    assert.ok(t15.length > 0 && t15.every(x => /t15/i.test(x.product_name + x.variant_name + x.sku)));
    const p = ACTIVE.find(x => x.variants?.length > 1);
    const byItem = (await call('/api/skus?q=' + p.shopee_item_id)).body.items;
    assert.equal(byItem.length, p.variants.length, '每個規格一列');
    const v = p.variants[1];
    assert.ok((await call('/api/skus?q=' + encodeURIComponent(v.name))).body.items.some(x => x.variant_name === v.name));
    assert.equal((await call('/api/skus?filter=uncounted')).body.total, EXPECTED_SKUS);
    const pct = (await call('/api/skus?q=%25')).body.items;
    assert.ok(pct.every(x => (x.product_name + (x.variant_name || '') + x.sku + (x.brand || '')).includes('%')), '% 只比對字面上的 %，不是萬用字元');
  });
  test('盤點確認 → 入庫 → 出庫 → 修改為；每次都有紀錄（操作者、時間、前後數量、原因）', async () => {
    const { call, adjust, db } = setup();
    const sku = pick(db);
    let r = await adjust(sku, { kind: 'count', qty: 5, expected_version: 0, reason: '10/23 盤點' });
    assert.equal(r.status, 200); assert.equal(r.body.sku.stock_on_hand, 5); assert.ok(r.body.sku.counted_at); assert.equal(r.body.sku.counted_by, 'owner@ewp.test');
    r = await adjust(sku, { kind: 'receive', qty: 3 }); assert.equal(r.body.sku.stock_on_hand, 8);
    r = await adjust(sku, { kind: 'issue', qty: 2 }); assert.equal(r.body.sku.stock_on_hand, 6); assert.equal(r.body.sku.available, 6);
    r = await adjust(sku, { kind: 'set', qty: 4, expected_version: r.body.sku.version }); assert.equal(r.body.sku.stock_on_hand, 4);
    const led = (await call(`/api/skus/${sku}/ledger`)).body.items;
    assert.deepEqual(led.map(x => [x.kind, x.before_on_hand, x.after_on_hand, x.delta_on_hand]), [['set', 6, 4, -2], ['issue', 8, 6, -2], ['receive', 5, 8, 3], ['count', 0, 5, 5]]);
    assert.ok(led.every(x => x.actor === 'owner@ewp.test' && x.created_at && x.reason));
    assert.equal(led.at(-1).reason, '10/23 盤點');
  });
  test('不允許負數：出庫超過可售、負數、小數、缺原因都被拒絕，且不留紀錄', async () => {
    const { adjust, db } = setup();
    const sku = pick(db);
    await adjust(sku, { kind: 'count', qty: 2, expected_version: 0 });
    let r = await adjust(sku, { kind: 'issue', qty: 3 });
    assert.equal(r.status, 409); assert.match(r.body.error, /庫存不足/);
    for (const bad of [{ kind: 'receive', qty: -1 }, { kind: 'receive', qty: 1.5 }, { kind: 'receive', qty: 'a' }, { kind: 'receive', qty: 1, reason: ' ' }, { kind: 'nope', qty: 1 }]) {
      r = await adjust(sku, bad); assert.equal(r.status, 400, JSON.stringify(bad));
    }
    assert.equal(first(db, 'SELECT stock_on_hand s FROM skus WHERE sku=?', sku).s, 2);
    assert.equal(first(db, 'SELECT count(*) n FROM inventory_ledger WHERE sku=?', sku).n, 1);
    assert.throws(() => db.raw.exec(`UPDATE skus SET stock_on_hand = -1 WHERE sku='${sku}'`), /CHECK/, '資料庫層也禁止負數');
  });
  test('已保留數量：可售＝實際−保留；不可扣到低於保留', async () => {
    const { adjust, db, call } = setup();
    const sku = pick(db);
    await adjust(sku, { kind: 'count', qty: 5, expected_version: 0 });
    db.raw.exec(`UPDATE skus SET stock_reserved = 3 WHERE sku='${sku}'`);
    const row = (await call(`/api/skus/${sku}`)).body;
    assert.equal(row.available, 2);
    assert.equal((await adjust(sku, { kind: 'issue', qty: 3 })).status, 409);
    assert.equal((await adjust(sku, { kind: 'set', qty: 2, expected_version: row.version })).status, 409);
    assert.equal((await adjust(sku, { kind: 'issue', qty: 2 })).status, 200);
  });
  test('多人同時修改：舊版本的「修改為／盤點」被拒絕，不會覆蓋別人的修改', async () => {
    const { adjust, db, call } = setup();
    const sku = pick(db);
    const [a, b] = await Promise.all([adjust(sku, { kind: 'count', qty: 10, expected_version: 0 }), adjust(sku, { kind: 'count', qty: 20, expected_version: 0 })]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    const loser = a.status === 409 ? a : b;
    assert.match(loser.body.error, /其他人修改/); assert.ok(loser.body.sku, '回傳最新數量');
    assert.equal(first(db, 'SELECT count(*) n FROM inventory_ledger WHERE sku=?', sku).n, 1);
    const row = (await call(`/api/skus/${sku}`)).body;
    assert.equal(row.stock_on_hand, a.status === 200 ? 10 : 20);
  });
  test('同時 20 筆出庫（庫存 10）：剛好 10 筆成功、庫存 0、不會變負數', async () => {
    const { adjust, db } = setup();
    const sku = pick(db);
    await adjust(sku, { kind: 'count', qty: 10, expected_version: 0 });
    const rs = await Promise.all(Array.from({ length: 20 }, () => adjust(sku, { kind: 'issue', qty: 1 })));
    assert.equal(rs.filter(r => r.status === 200).length, 10);
    assert.equal(rs.filter(r => r.status === 409).length, 10);
    assert.equal(first(db, 'SELECT stock_on_hand s FROM skus WHERE sku=?', sku).s, 0);
    assert.equal(first(db, "SELECT count(*) n FROM inventory_ledger WHERE sku=? AND kind='issue'", sku).n, 10);
  });
  test('重複送出同一操作（網路重試）只生效一次', async () => {
    const { call, db } = setup();
    const sku = pick(db);
    const body = JSON.stringify({ kind: 'receive', qty: 4, reason: '進貨', op_id: 'retry-op-12345678' });
    const [r1, r2] = await Promise.all([call(`/api/skus/${sku}/adjust`, { method: 'POST', body }), call(`/api/skus/${sku}/adjust`, { method: 'POST', body })]);
    assert.equal(r1.status, 200); assert.equal(r2.status, 200);
    assert.equal(first(db, 'SELECT stock_on_hand s FROM skus WHERE sku=?', sku).s, 4);
    assert.equal(first(db, 'SELECT count(*) n FROM inventory_ledger WHERE sku=?', sku).n, 1);
  });
  test('庫存歸零提醒：官網「現貨」→ 警告；「預購／接單製作」→ 正常提示', async () => {
    const { adjust, db, call } = setup();
    const sku = pick(db);
    await adjust(sku, { kind: 'count', qty: 1, expected_version: 0 });
    const r = await adjust(sku, { kind: 'issue', qty: 1 });
    assert.equal(r.body.sku.alert.level, 'warning'); assert.match(r.body.sku.alert.message, /缺貨.*預購|預購/);
    assert.ok((await call('/api/skus?filter=alert')).body.items.some(x => x.sku === sku));
    db.raw.exec(`UPDATE skus SET site_availability='preorder' WHERE sku='${sku}'`);
    const pre = (await call(`/api/skus/${sku}`)).body;
    assert.equal(pre.alert.level, 'info');
    assert.ok(!(await call('/api/skus?filter=alert')).body.items.some(x => x.sku === sku), '預購不列入需注意');
  });
  test('尚未盤點的規格（數量未知）不顯示歸零警告，也不列入需注意', async () => {
    const { call } = setup();
    const rows = (await call('/api/skus')).body.items;
    assert.ok(rows.every(r => r.alert === null));
    assert.equal((await call('/api/stats')).body.alerts, 0);
    assert.equal((await call('/api/skus?filter=alert')).body.items.length, 0);
  });
  test('防跨站請求：來源不符或非 JSON 一律拒絕', async () => {
    const { call, db } = setup();
    const sku = pick(db);
    assert.equal((await call(`/api/skus/${sku}/adjust`, { method: 'POST', headers: { Origin: 'https://evil.example' }, body: JSON.stringify({ kind: 'receive', qty: 1, reason: 'x', op_id: 'csrf-op-1234567' }) })).status, 403);
    assert.equal((await call(`/api/skus/${sku}/adjust`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' })).status, 415);
    assert.equal(first(db, 'SELECT stock_on_hand s FROM skus WHERE sku=?', sku).s, 0);
  });
  test('管理網頁：中文、手機版面、不被搜尋引擎收錄、有安全標頭', async () => {
    const { call } = setup();
    const r = await call('/');
    assert.equal(r.status, 200);
    assert.match(r.body, /EWP<\/b> 庫存管理/); assert.match(r.body, /width=device-width/); assert.match(r.body, /盤點確認/);
    assert.match(r.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
    assert.equal(r.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    assert.equal(r.headers.get('Cache-Control'), 'no-store');
  });
});

describe('完整清單：分頁涵蓋全部規格，搜尋與篩選不限前幾筆', () => {
  test(`逐頁載入可以看到全部 ${EXPECTED_SKUS} 個規格、沒有重複`, async () => {
    const { call } = setup();
    const seen = new Set(); let offset = 0; let pages = 0; let total;
    while (offset != null) {
      const r = (await call(`/api/skus?offset=${offset}`)).body;
      total = r.total; pages++;
      for (const it of r.items) seen.add(it.sku);
      assert.ok(r.items.length <= 100);
      offset = r.next_offset;
    }
    assert.equal(total, EXPECTED_SKUS); assert.equal(seen.size, EXPECTED_SKUS); assert.ok(pages >= 9, `${pages} 頁`);
  });
  test('搜尋找得到排序在最後面的商品；篩選的總數涵蓋全部資料', async () => {
    const { call, db } = setup();
    const last = first(db, 'SELECT s.sku, p.name FROM skus s JOIN products p ON p.id=s.product_id ORDER BY p.name DESC, s.product_id DESC, s.position DESC LIMIT 1');
    const r = (await call('/api/skus?q=' + encodeURIComponent(last.sku))).body;
    assert.equal(r.total, 1); assert.equal(r.items[0].sku, last.sku);
    // 把排序最後面的 3 個規格盤點成 0（官網現貨）→「需注意」要找得到
    const tail = db.raw.prepare("SELECT s.sku FROM skus s JOIN products p ON p.id=s.product_id WHERE coalesce(s.site_availability,p.availability)='in_stock' ORDER BY p.name DESC LIMIT 3").all().map(x => x.sku);
    for (const sku of tail) db.raw.exec(`UPDATE skus SET counted_at='2026-10-23T00:00:00Z' WHERE sku='${sku}'`);
    const alerts = (await call('/api/skus?filter=alert')).body;
    assert.equal(alerts.total, 3); assert.deepEqual(new Set(alerts.items.map(x => x.sku)), new Set(tail));
    assert.equal((await call('/api/skus?filter=uncounted')).body.total, EXPECTED_SKUS - 3);
  });
});

describe('規格身分穩定：改名、排序、增刪規格，庫存與紀錄不遺失、不轉錯', () => {
  const KEYED_ID = PRODUCTS.find(p => p.variants?.length >= 2 && p.variants.every(v => !v.shopee_variation_id))?.id;
  const VID_ID = PRODUCTS.find(p => p.variants?.length >= 3 && p.variants.every(v => v.shopee_variation_id) && p.review?.status !== 'rejected').id;
  const skuOf = (db, pid, name) => first(db, 'SELECT * FROM skus WHERE product_id=? AND variant_name=?', pid, name);
  async function counted(env, pid, qtys) {
    const { db, adjust } = env;
    const rows = db.raw.prepare('SELECT sku FROM skus WHERE product_id=? ORDER BY position').all(pid);
    for (const [i, r] of rows.entries()) assert.equal((await adjust(r.sku, { kind: 'count', qty: qtys[i], expected_version: 0 })).status, 200);
    return rows.map(r => r.sku);
  }
  test('沒有蝦皮規格 ID 的規格（用 key）：改名、排序後 SKU 與庫存不變', { skip: !KEYED_ID && '沒有這類商品' }, async () => {
    const env = setup(); const { db } = env;
    const p0 = readP(FIXTURE, KEYED_ID);
    const skus = await counted(env, KEYED_ID, [4, 6]);
    const dir = makeFixture(d => { const p = readP(d, KEYED_ID); p.variants[0].name += '（改名）'; p.variants.reverse(); writeP(d, p); });
    db.raw.exec(catalogSql([], dir));
    const a = skuOf(db, KEYED_ID, p0.variants[0].name + '（改名）'); const b = skuOf(db, KEYED_ID, p0.variants[1].name);
    assert.equal(a.sku, skus[0]); assert.equal(a.stock_on_hand, 4); assert.equal(a.position, 1);
    assert.equal(b.sku, skus[1]); assert.equal(b.stock_on_hand, 6); assert.equal(b.position, 0);
    assert.equal(first(db, 'SELECT count(*) n FROM skus WHERE product_id=?', KEYED_ID).n, 2, '沒有多出新的 SKU');
  });
  test('有蝦皮規格 ID 的規格：排序、改名後庫存跟著原規格', async () => {
    const env = setup(); const { db } = env;
    const p0 = readP(FIXTURE, VID_ID);
    const skus = await counted(env, VID_ID, p0.variants.map((_, i) => i + 1));
    const dir = makeFixture(d => { const p = readP(d, VID_ID); p.variants.reverse(); p.variants[0].name = '改名後'; writeP(d, p); });
    db.raw.exec(catalogSql([], dir));
    for (const [i, v] of p0.variants.entries()) {
      const row = first(db, 'SELECT * FROM skus WHERE sku=?', skus[i]);
      assert.equal(row.stock_on_hand, i + 1, v.name); assert.equal(row.shopee_variation_id, v.shopee_variation_id);
    }
  });
  test('刪除規格：SKU 停用但庫存與紀錄保留，出現在「已停用」；可移轉到同商品其他規格', async () => {
    const env = setup(); const { db, call, op } = env;
    const p0 = readP(FIXTURE, VID_ID);
    const skus = await counted(env, VID_ID, p0.variants.map(() => 5));
    const dir = makeFixture(d => { const p = readP(d, VID_ID); p.variants.splice(1, 1); writeP(d, p); });
    db.raw.exec(catalogSql([], dir));
    const gone = first(db, 'SELECT * FROM skus WHERE sku=?', skus[1]);
    assert.equal(gone.active, 0); assert.equal(gone.stock_on_hand, 5);
    assert.equal(first(db, 'SELECT count(*) n FROM inventory_ledger WHERE sku=?', skus[1]).n, 1);
    assert.ok((await call('/api/skus?filter=inactive')).body.items.some(x => x.sku === skus[1]));
    assert.equal((await call('/api/stats')).body.inactive_with_stock, 1);
    // 已停用的規格不能入庫／盤點，但可以移轉或出庫
    const rcv = await env.adjust(skus[1], { kind: 'receive', qty: 1 });
    assert.equal(rcv.status, 400); assert.match(rcv.body.error, /已停用/);
    const t = await call(`/api/skus/${skus[1]}/transfer`, { method: 'POST', body: JSON.stringify({ to_sku: skus[0], qty: 5, reason: '規格調整', op_id: op() }) });
    assert.equal(t.status, 200, JSON.stringify(t.body));
    assert.equal(first(db, 'SELECT stock_on_hand s FROM skus WHERE sku=?', skus[1]).s, 0);
    assert.equal(first(db, 'SELECT stock_on_hand s FROM skus WHERE sku=?', skus[0]).s, 10);
    const kinds = db.raw.prepare('SELECT kind, sku, delta_on_hand FROM inventory_ledger WHERE kind LIKE ? ORDER BY id').all('transfer%').map(x => ({ ...x }));
    assert.deepEqual(kinds, [{ kind: 'transfer_out', sku: skus[1], delta_on_hand: -5 }, { kind: 'transfer_in', sku: skus[0], delta_on_hand: 5 }]);
    assert.equal((await call('/api/stats')).body.inactive_with_stock, 0);
    // 移轉超過庫存、跨商品、到已停用規格 → 拒絕，數量不變
    assert.equal((await call(`/api/skus/${skus[0]}/transfer`, { method: 'POST', body: JSON.stringify({ to_sku: skus[2], qty: 99, reason: 'x', op_id: op() }) })).status, 409);
    const other = first(db, 'SELECT sku FROM skus WHERE product_id<>? AND active=1 LIMIT 1', VID_ID).sku;
    assert.equal((await call(`/api/skus/${skus[0]}/transfer`, { method: 'POST', body: JSON.stringify({ to_sku: other, qty: 1, reason: 'x', op_id: op() }) })).status, 400);
    assert.equal((await call(`/api/skus/${skus[0]}/transfer`, { method: 'POST', body: JSON.stringify({ to_sku: skus[1], qty: 1, reason: 'x', op_id: op() }) })).status, 409, '目標已停用：交易內判斷並整筆回復');
    assert.equal(first(db, 'SELECT sum(stock_on_hand) s FROM skus WHERE product_id=?', VID_ID).s, 5 * p0.variants.length);
  });
  test('規格被刪後又加回（同一個蝦皮規格 ID）：重新啟用原 SKU，庫存仍在', async () => {
    const env = setup(); const { db } = env;
    const p0 = readP(FIXTURE, VID_ID);
    const skus = await counted(env, VID_ID, p0.variants.map(() => 3));
    db.raw.exec(catalogSql([], makeFixture(d => { const p = readP(d, VID_ID); p.variants.splice(1, 1); writeP(d, p); })));
    assert.equal(first(db, 'SELECT active FROM skus WHERE sku=?', skus[1]).active, 0);
    db.raw.exec(catalogSql());
    const back = first(db, 'SELECT * FROM skus WHERE sku=?', skus[1]);
    assert.equal(back.active, 1); assert.equal(back.stock_on_hand, 3);
  });
  test('新增規格：新的 SKU、庫存 0、尚未盤點；其他規格不受影響', async () => {
    const env = setup(); const { db } = env;
    const p0 = readP(FIXTURE, VID_ID);
    await counted(env, VID_ID, p0.variants.map(() => 2));
    db.raw.exec(catalogSql([], makeFixture(d => { const p = readP(d, VID_ID); p.variants.push({ name: '新規格', sku: null, price_twd: 100, availability: 'preorder', key: 'v-0badc0de' }); writeP(d, p); })));
    const n = skuOf(db, VID_ID, '新規格');
    assert.equal(n.stock_on_hand, 0); assert.equal(n.counted_at, null); assert.equal(n.variant_ref, 'k:v-0badc0de');
    assert.equal(first(db, 'SELECT sum(stock_on_hand) s FROM skus WHERE product_id=? AND active=1', VID_ID).s, 2 * p0.variants.length);
  });
  test('舊版 SKU（以規格名稱雜湊、沒有身分）會被認領：庫存與紀錄原封不動，不產生重複 SKU', { skip: !KEYED_ID && '沒有這類商品' }, async () => {
    const db = createD1(MIGRATIONS);
    const p = readP(FIXTURE, KEYED_ID);
    const crypto2 = await import('node:crypto');
    const legacy = `EWP-SP${p.shopee_item_id}-V${crypto2.createHash('sha1').update(p.variants[0].name).digest('hex').slice(0, 8)}`;
    db.raw.exec(`INSERT INTO products (id, name) VALUES ('${p.id}', 'x');
      INSERT INTO skus (sku, product_id, variant_name, stock_on_hand, version, counted_at) VALUES ('${legacy}', '${p.id}', 'x', 9, 1, '2026-10-23');
      INSERT INTO inventory_ledger (op_id, sku, kind, before_on_hand, after_on_hand, delta_on_hand, reason, actor, created_at) VALUES ('legacy-op-1', '${legacy}', 'count', 0, 9, 9, '盤點', 'a@b', '2026-10-23');`);
    db.raw.exec(catalogSql());
    const row = first(db, 'SELECT * FROM skus WHERE sku=?', legacy);
    assert.equal(row.variant_ref, `k:${p.variants[0].key}`); assert.equal(row.active, 1); assert.equal(row.stock_on_hand, 9); assert.equal(row.variant_name, p.variants[0].name);
    assert.equal(first(db, 'SELECT count(*) n FROM skus WHERE product_id=?', p.id).n, p.variants.length);
    assert.equal(first(db, 'SELECT count(*) n FROM inventory_ledger WHERE sku=?', legacy).n, 1);
  });
});

describe('商品同步的安全檢查：失敗時庫存與紀錄不變', () => {
  test('同步 SQL 不含任何寫入庫存數字或異動紀錄的語句', () => {
    const sql = catalogSql(hasSnapshotRev ? ['--snapshot-rev', '3dc1916'] : []);
    assert.ok(!/stock_on_hand|stock_reserved|inventory_ledger|DELETE\s/i.test(sql));
    assert.ok(!/BEGIN|COMMIT/i.test(sql), 'D1 不接受交易語句');
  });
  test('同步中途失敗：既有庫存與紀錄完全不變', async () => {
    const env = setup(); const { db, adjust } = env;
    const sku = first(db, 'SELECT sku FROM skus LIMIT 1').sku;
    await adjust(sku, { kind: 'count', qty: 12, expected_version: 0 });
    const before = JSON.stringify([db.raw.prepare('SELECT sku, stock_on_hand, stock_reserved, version, counted_at FROM skus ORDER BY sku').all(), db.raw.prepare('SELECT * FROM inventory_ledger ORDER BY id').all()]);
    const stmts = catalogSql().split(/;\n/).filter(x => x.trim() && !x.trim().startsWith('--'));
    stmts.splice(Math.floor(stmts.length / 2), 0, 'INSERT INTO no_such_table VALUES (1)');
    assert.throws(() => { for (const st of stmts) db.raw.exec(st + ';'); });
    const after = JSON.stringify([db.raw.prepare('SELECT sku, stock_on_hand, stock_reserved, version, counted_at FROM skus ORDER BY sku').all(), db.raw.prepare('SELECT * FROM inventory_ledger ORDER BY id').all()]);
    assert.equal(after, before);
  });
  test('商品資料未通過驗證 → 不產生同步檔', () => {
    const dir = makeFixture(d => { const p = readP(d, PRODUCTS[0].id); p.price_twd = 0; p.price_display = 'fixed'; writeP(d, p); });
    assert.throws(() => catalogSql([], dir), /未通過驗證/);
  });
  test('有規格缺少身分（沒有蝦皮規格 ID 也沒有 key）→ 不同步（不再用名稱雜湊）', () => {
    const dir = makeFixture(d => { const p = readP(d, PRODUCTS.find(x => x.variants?.length).id); p.variants.push({ name: '沒有身分', sku: null, price_twd: null, availability: 'unknown' }); writeP(d, p); });
    try { catalogSql([], dir); assert.fail('應該失敗'); } catch (e) { assert.match(String(e.stderr), /識別碼/); // 由商品資料驗證或同步程式擋下 }
  });
  test('有尚未校正的商品後台儲存 → 不同步（結束碼 3）', () => {
    const stub = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'inv-')), 'pending.mjs');
    fs.writeFileSync(stub, "console.log(process.argv.includes('--pending-count') ? '2' : '');");
    try { catalogSql(['--require-normalized'], FIXTURE, { EWP_PENDING_SCRIPT: stub }); assert.fail('應該失敗'); }
    catch (e) { assert.equal(e.status, 3); assert.match(String(e.stderr), /尚未校正/); }
    fs.writeFileSync(stub, "console.log('0');");
    assert.ok(catalogSql(['--require-normalized'], FIXTURE, { EWP_PENDING_SCRIPT: stub }).includes('INSERT INTO skus'));
  });
});

describe('部署流程（.github/workflows/inventory.yml）', () => {
  const yml = fs.readFileSync(path.join(ROOT, '.github/workflows/inventory.yml'), 'utf8');
  const deploy = yml.slice(yml.indexOf('  deploy:'));
  test('只有 main 可以部署；金鑰放在只限 main 的 Environment', () => {
    assert.match(deploy, /environment: inventory-production/);
    assert.match(deploy, /github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
    assert.match(deploy, /github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/);
    assert.match(deploy, /workflow_run\.head_branch == 'main'/);
    assert.match(deploy, /ref: main/);
    assert.ok(!/secrets\./.test(yml.slice(0, yml.indexOf('  deploy:'))), '測試工作不使用任何金鑰');
  });
  test('同步前檢查：資料已校正（--require-normalized）、驗證通過、商品數未驟減；商品後台流程完成後再同步', () => {
    assert.match(deploy, /--require-normalized/);
    assert.match(deploy, /CODE" = "3"/);
    assert.match(deploy, /驟減/);
    assert.match(yml, /workflow_run:[\s\S]*商品後台儲存後校正與發布/);
  });
  test('部署紀錄不輸出庫存數字：同步 SQL 不印出、用完即刪', () => {
    assert.match(deploy, /--file "\$RUNNER_TEMP\/catalog\.sql" > \/dev\/null/);
    assert.match(deploy, /rm -f "\$RUNNER_TEMP\/catalog\.sql"/);
  });
});

describe('移轉的原子性：全部成功或全部回復（同一個交易，不靠事後補償）', () => {
  const PID = PRODUCTS.find(p => p.variants?.length >= 3 && p.review?.status !== 'rejected').id;
  async function prep(qtys = [5, 2, 0]) {
    const env = setup(); const { db, adjust } = env;
    const skus = db.raw.prepare('SELECT sku FROM skus WHERE product_id=? ORDER BY position').all(PID).map(r => r.sku);
    for (const [i, q] of qtys.entries()) assert.equal((await adjust(skus[i], { kind: 'count', qty: q, expected_version: 0 })).status, 200);
    return { ...env, skus };
  }
  const snapshot = (db, skus) => JSON.stringify({
    rows: skus.map(s => ({ ...db.raw.prepare('SELECT sku, stock_on_hand, stock_reserved, version, last_op, prev_on_hand, active FROM skus WHERE sku=?').get(s) })),
    ledger: db.raw.prepare('SELECT * FROM inventory_ledger ORDER BY id').all().map(r => ({ ...r })),
    guard: db.raw.prepare('SELECT count(*) n FROM transfer_guard').get().n,
  });
  const tr = (env, from, to, qty, op_id = env.op()) => env.call(`/api/skus/${from}/transfer`, { method: 'POST', body: JSON.stringify({ to_sku: to, qty, reason: '測試移轉', op_id }) });

  test('成功：來源 −、目標 ＋、兩筆紀錄、版本各 +1', async () => {
    const env = await prep(); const { db, skus } = env;
    const r = await tr(env, skus[0], skus[1], 3);
    assert.equal(r.status, 200);
    const [a, b] = skus.slice(0, 2).map(s => db.raw.prepare('SELECT stock_on_hand, version FROM skus WHERE sku=?').get(s));
    assert.deepEqual([a.stock_on_hand, b.stock_on_hand], [2, 5]);
    assert.deepEqual([a.version, b.version], [2, 2]);
    assert.deepEqual(db.raw.prepare("SELECT kind, delta_on_hand FROM inventory_ledger WHERE kind LIKE 'transfer%' ORDER BY id").all().map(x => [x.kind, x.delta_on_hand]), [['transfer_out', -3], ['transfer_in', 3]]);
  });
  test('目標在移轉前被停用 → 整筆回復，兩邊數量、版本、紀錄完全不變', async () => {
    const env = await prep(); const { db, skus } = env;
    db.raw.exec(`UPDATE skus SET active = 0 WHERE sku = '${skus[1]}'`);
    const before = snapshot(db, skus);
    const r = await tr(env, skus[0], skus[1], 2);
    assert.equal(r.status, 409); assert.match(r.body.error, /目標規格已停用/);
    assert.equal(snapshot(db, skus), before);
  });
  test('目標更新 0 筆（檢查通過後、寫入前目標被停用）→ 同一交易內回復，沒有提交後補償', async () => {
    const env = await prep(); const { db, skus } = env;
    const before = snapshot(db, skus);
    // 在 batch 執行的那一刻停用目標：模擬「讀取檢查之後、寫入之前」被別人改掉
    const realBatch = db.batch;
    let batches = 0;
    db.batch = stmts => { batches++; db.raw.exec(`UPDATE skus SET active = 0 WHERE sku = '${skus[1]}'`); return realBatch(stmts); };
    const r = await tr(env, skus[0], skus[1], 2);
    db.batch = realBatch;
    assert.equal(r.status, 409);
    assert.equal(batches, 1, '只執行一次交易，沒有第二次補償交易');
    db.raw.exec(`UPDATE skus SET active = 1 WHERE sku = '${skus[1]}'`);
    assert.equal(snapshot(db, skus), before, '數量、版本、last_op、紀錄都與移轉前相同');
  });
  test('來源庫存不足（含已保留）→ 整筆回復', async () => {
    const env = await prep(); const { db, skus } = env;
    db.raw.exec(`UPDATE skus SET stock_reserved = 2 WHERE sku = '${skus[0]}'`);
    const before = snapshot(db, skus);
    const r = await tr(env, skus[0], skus[1], 4); // 實際 5、保留 2 → 只能移 3
    assert.equal(r.status, 409); assert.match(r.body.error, /庫存不足：可移轉 3/);
    assert.equal(snapshot(db, skus), before);
    assert.equal((await tr(env, skus[2], skus[1], 1)).status, 409, '來源為 0 → 不可移轉');
    assert.equal(snapshot(db, skus), before);
  });
  test('重複請求（依序與同時）只生效一次', async () => {
    const env = await prep(); const { db, skus } = env;
    const id = 'dup-transfer-0001';
    const r1 = await tr(env, skus[0], skus[1], 1, id);
    const r2 = await tr(env, skus[0], skus[1], 1, id);
    assert.equal(r1.status, 200); assert.equal(r2.status, 200); assert.equal(r2.body.duplicate, true);
    const id2 = 'dup-transfer-0002';
    const rs = await Promise.all([1, 2, 3].map(() => tr(env, skus[0], skus[1], 1, id2)));
    assert.ok(rs.every(r => r.status === 200));
    const [a, b] = skus.slice(0, 2).map(s => db.raw.prepare('SELECT stock_on_hand FROM skus WHERE sku=?').get(s).stock_on_hand);
    assert.deepEqual([a, b], [3, 4]);
    assert.equal(db.raw.prepare("SELECT count(*) n FROM inventory_ledger WHERE kind LIKE 'transfer%'").get().n, 4);
  });
  test('並行移轉：來源 5、同時 10 筆各移 1 → 剛好 5 筆成功，總數守恆、紀錄成對', async () => {
    const env = await prep(); const { db, skus } = env;
    const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => tr(env, skus[0], skus[1 + (i % 2)], 1)));
    assert.equal(rs.filter(r => r.status === 200).length, 5);
    assert.equal(rs.filter(r => r.status === 409).length, 5);
    const total = db.raw.prepare('SELECT sum(stock_on_hand) s FROM skus WHERE sku IN (?, ?, ?)').get(...skus.slice(0, 3)).s;
    assert.equal(total, 7, '5＋2＋0 總數不變');
    assert.equal(db.raw.prepare('SELECT stock_on_hand s FROM skus WHERE sku=?').get(skus[0]).s, 0);
    const out = db.raw.prepare("SELECT count(*) n FROM inventory_ledger WHERE kind='transfer_out'").get().n;
    const inn = db.raw.prepare("SELECT count(*) n FROM inventory_ledger WHERE kind='transfer_in'").get().n;
    assert.deepEqual([out, inn], [5, 5]);
    assert.equal(db.raw.prepare('SELECT count(*) n FROM transfer_guard').get().n, 5, '失敗的移轉沒有留下任何資料');
  });
});
