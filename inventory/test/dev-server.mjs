// 本機預覽／UI 測試用：以 Node 內建 SQLite 模擬 D1，登入者固定為 DEV_AUTH_EMAIL（只接受 localhost）。
//   node inventory/test/dev-server.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createD1 } from './d1-shim.mjs';
import worker from '../src/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const port = Number(process.argv[2] || 8790);
const db = createD1(fs.readdirSync(path.join(HERE, '..', 'migrations')).sort().map(f => path.join(HERE, '..', 'migrations', f)));
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'inv-')), 'catalog.sql');
execFileSync('node', ['scripts/inventory-catalog-sql.mjs', '--out', out], { cwd: ROOT, stdio: 'inherit' });
db.raw.exec(fs.readFileSync(out, 'utf8'));
// 測試用參考值（假資料，不是真實庫存）
db.raw.exec('UPDATE skus SET snapshot_qty = 3, snapshot_at = \'2026-10-22T14:11:52+08:00\'');
const env = { DB: db, DEV_AUTH_EMAIL: 'owner@ewp.test', PAGES_CMS_EDIT_BASE: 'https://app.pagescms.org/mixlinlll-spec/mixlinlll-spec.github.io/main/collection/products/edit/' };
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const r = await worker.fetch(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }), env, {});
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log(`庫存後台本機預覽：http://localhost:${port}`));
