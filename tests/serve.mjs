// 測試用靜態伺服器：行為貼近 GitHub Pages（文字檔 gzip、目錄回傳 index.html、找不到時回傳 404.html 並帶 404 狀態）。
//   node tests/serve.mjs <資料夾> <port>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [, , dirArg = 'dist', portArg = '8800'] = process.argv;
const ROOT = path.resolve(dirArg);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon' };
const COMPRESS = /\.(html|css|js|json|xml|txt|svg)$/;

http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
  let file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!rel.endsWith('/')) { res.writeHead(301, { Location: rel + '/' }).end(); return; }
    file = path.join(file, 'index.html');
  }
  let status = 200;
  if (!fs.existsSync(file)) { status = 404; file = path.join(ROOT, '404.html'); }
  const ext = path.extname(file).toLowerCase();
  const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'max-age=600' };
  let body = fs.readFileSync(file);
  if (COMPRESS.test(file) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) { body = zlib.gzipSync(body); headers['Content-Encoding'] = 'gzip'; headers.Vary = 'Accept-Encoding'; }
  headers['Content-Length'] = body.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}).listen(Number(portArg), () => console.log(`serving ${ROOT} on :${portArg}`));
