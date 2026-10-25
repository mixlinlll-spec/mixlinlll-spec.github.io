// node --import ./submit/test/register.mjs --test submit/test/submit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { buildHeaders, MAX_BYTES } from '../src/index.js';

const ORIGIN = 'https://www.ewpfpv.com';
const sent = [];
const env = (over = {}) => ({
  ALLOWED_ORIGINS: 'https://www.ewpfpv.com,https://ewpfpv.com', FROM_ADDRESS: 'data@ewpfpv.com', TO_ADDRESS: 'owner@example.com',
  MAILER: { send: async (m) => { const text = await new Response(m.raw).text(); sent.push({ from: m.from, to: m.to, text }); } }, ...over,
});
const B = 'ewpBoundary0123456789';
const body = `--${B}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\nhello\r\n--${B}--\r\n`;
function req(over = {}) {
  const headers = { origin: ORIGIN, 'content-type': 'text/plain', 'x-ewp-code': 'EWP-BB-261026-AB12', 'x-ewp-boundary': B, 'x-ewp-reply': 'pilot@example.com', 'content-length': String(new TextEncoder().encode(over.body ?? body).length), ...(over.headers || {}) };
  for (const k of Object.keys(headers)) if (headers[k] === null) delete headers[k];
  return new Request('https://ewp-submit.example.workers.dev' + (over.path || '/submit'), { method: over.method || 'POST', headers, body: over.method === 'OPTIONS' || over.method === 'GET' ? undefined : (over.body ?? body), duplex: 'half' });
}
const deps = { rateLimited: () => false };

test('sends one email with fixed headers and the browser body', async () => {
  sent.length = 0;
  const r = await worker.fetch(req(), env(), null, deps);
  assert.equal(r.status, 200);
  assert.equal(sent.length, 1);
  const m = sent[0];
  assert.equal(m.to, 'owner@example.com');
  assert.match(m.text, /^From: =\?UTF-8\?B\?[^?]+\?= <data@ewpfpv\.com>\r\nTo: <owner@example\.com>\r\nReply-To: <pilot@example\.com>\r\nSubject: =\?UTF-8\?B\?/);
  assert.ok(m.text.includes(`Content-Type: multipart/mixed; boundary="${B}"`));
  assert.ok(m.text.endsWith(body));
  assert.ok(m.text.includes('\r\n\r\n--' + B));
});
test('CORS preflight and origin check', async () => {
  const p = await worker.fetch(req({ method: 'OPTIONS' }), env(), null, deps);
  assert.equal(p.status, 204);
  assert.equal(p.headers.get('access-control-allow-origin'), ORIGIN);
  const bad = await worker.fetch(req({ headers: { origin: 'https://evil.example' } }), env(), null, deps);
  assert.equal(bad.status, 403);
});
test('rejects bad code, boundary, reply address (no header injection)', async () => {
  assert.equal((await worker.fetch(req({ headers: { 'x-ewp-code': 'X' } }), env(), null, deps)).status, 400);
  assert.equal((await worker.fetch(req({ headers: { 'x-ewp-boundary': 'a"b' } }), env(), null, deps)).status, 400);
  // CR/LF cannot even be put into a header value; the angle bracket form is refused by the address check
  assert.throws(() => req({ headers: { 'x-ewp-reply': 'a@b.com\r\nBcc: x@y.z' } }));
  assert.equal((await worker.fetch(req({ headers: { 'x-ewp-reply': 'a@b.com> Bcc: x@y.z' } }), env(), null, deps)).status, 400);
  assert.equal((await worker.fetch(req({ headers: { 'x-ewp-reply': 'not-an-email' } }), env(), null, deps)).status, 400);
});
test('size limit and missing mail binding', async () => {
  assert.equal((await worker.fetch(req({ headers: { 'content-length': String(MAX_BYTES + 1) } }), env(), null, deps)).status, 413);
  assert.equal((await worker.fetch(req(), env({ MAILER: undefined }), null, deps)).status, 503);
});
test('rate limit and send failure', async () => {
  assert.equal((await worker.fetch(req(), env(), null, { rateLimited: () => true })).status, 429);
  const r = await worker.fetch(req(), env({ MAILER: { send: async () => { throw new Error('x'); } } }), null, deps);
  assert.equal(r.status, 502);
});
test('health endpoint', async () => {
  const r = await worker.fetch(req({ method: 'GET', path: '/health' }), env(), null, deps);
  assert.deepEqual(await r.json(), { ok: true, mail: true });
});
test('header builder: subject encoded, no raw CR/LF from inputs', () => {
  const h = buildHeaders({ from: 'data@ewpfpv.com', to: 'o@e.com', code: 'EWP-BB-261026-AB12', boundary: B, replyTo: null, now: new Date(0), id: 'x' });
  assert.ok(!h.includes('Reply-To'));
  assert.ok(h.endsWith('\r\n\r\n'));
  assert.equal(h.split('\r\n').filter((l) => l.startsWith('Subject:')).length, 1);
});
