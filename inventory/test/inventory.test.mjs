// 庫存後台測試：node --test inventory/test/
import test, { describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createD1 } from './d1-shim.mjs';
import worker from '../src/index.js';
import { resetJwksCache } from '../src/auth.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const MIGRATIONS = fs.readdirSync(path.join(HERE, '..', 'migrations')).sort().map(f => path.join(HERE, '..', 'migrations', f));
const PRODUCTS = fs.readdirSync(path.join(ROOT, 'src/data/products')).map(f => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/products', f), 'utf8')));
const ACTIVE = PRODUCTS.filter(p => p.review?.status !== 'rejected');
const EXPECTED_SKUS = ACTIVE.reduce((a, p) => a + Math.max(1, p.variants?.length || 0), 0);

function catalogSql(extra = []) {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'inv-')), 'catalog.sql');
  execFileSync('node', ['scripts/inventory-catalog-sql.mjs', '--out', out, ...extra], { cwd: ROOT, stdio: 'pipe' });
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
    assert.equal((await call('/api/skus?filter=uncounted')).body.items.length, Math.min(EXPECTED_SKUS, 500));
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
