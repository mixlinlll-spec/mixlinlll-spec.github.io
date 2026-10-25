// EWP 飛行數據寄送服務。
// 瀏覽器負責壓縮黑盒子並組好 MIME 內容（multipart 的各段），這裡只加上固定的寄件／收件標頭後直接轉寄，
// 不解析附件，所以不會吃掉 Worker 的 CPU 時間。收件人固定為 EWP 信箱（send_email 綁定也鎖定同一個地址）。
import { EmailMessage } from 'cloudflare:email';

export const MAX_BYTES = 24 * 1024 * 1024; // 寄到已驗證信箱的上限是 25 MiB（含標頭）
const CODE_RE = /^EWP-BB-\d{6}-[A-Z0-9]{4}$/;
const BOUNDARY_RE = /^[A-Za-z0-9_-]{16,60}$/;
const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,180}\.[A-Za-z]{2,24}$/;

// 簡單的同一來源頻率限制（每個 Worker 執行個體各自計算；搭配大小上限與來源檢查使用）
const hits = new Map();
export function rateLimited(ip, now = Date.now(), limit = 6, windowMs = 10 * 60 * 1000) {
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (list.length >= limit) { hits.set(ip, list); return true; }
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}

const b64 = (s) => { const bytes = new TextEncoder().encode(s); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin); };
const encodeWord = (s) => `=?UTF-8?B?${b64(s)}?=`;

export function buildHeaders({ from, to, code, boundary, replyTo, now = new Date(), id = crypto.randomUUID() }) {
  const lines = [
    `From: ${encodeWord('EWP 飛行數據')} <${from}>`,
    `To: <${to}>`,
    ...(replyTo ? [`Reply-To: <${replyTo}>`] : []),
    `Subject: ${encodeWord(`【飛行數據】${code}`)}`,
    `Date: ${now.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${id}@ewpfpv.com>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    'X-EWP-Code: ' + code,
    '', '',
  ];
  return lines.join('\r\n');
}

function cors(origin, allowed) {
  const ok = allowed.includes(origin);
  return {
    'access-control-allow-origin': ok ? origin : allowed[0] || '',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-ewp-code, x-ewp-boundary, x-ewp-reply',
    'access-control-max-age': '600',
    vary: 'origin',
  };
}
const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

export default {
  async fetch(req, env, _ctx, deps = {}) {
    const url = new URL(req.url);
    const origin = req.headers.get('origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const h = cors(origin, allowed);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (url.pathname === '/health') return json({ ok: true, mail: !!env.MAILER }, 200, h);
    if (url.pathname !== '/submit' || req.method !== 'POST') return json({ error: 'not_found' }, 404, h);
    if (!allowed.includes(origin)) return json({ error: 'forbidden' }, 403, h);
    if (!env.MAILER || !env.FROM_ADDRESS || !env.TO_ADDRESS) return json({ error: 'mail_unavailable' }, 503, h);

    const code = req.headers.get('x-ewp-code') || '';
    const boundary = req.headers.get('x-ewp-boundary') || '';
    const reply = (req.headers.get('x-ewp-reply') || '').trim();
    if (!CODE_RE.test(code)) return json({ error: 'bad_code' }, 400, h);
    if (!BOUNDARY_RE.test(boundary)) return json({ error: 'bad_boundary' }, 400, h);
    if (reply && !EMAIL_RE.test(reply)) return json({ error: 'bad_email' }, 400, h);
    const len = Number(req.headers.get('content-length') || 0);
    if (!len) return json({ error: 'length_required' }, 411, h);
    if (len > MAX_BYTES) return json({ error: 'too_large', max: MAX_BYTES }, 413, h);
    const ip = req.headers.get('cf-connecting-ip') || 'unknown';
    if ((deps.rateLimited || rateLimited)(ip)) return json({ error: 'rate_limited' }, 429, h);

    // 固定的標頭＋瀏覽器送來的 multipart 內容（最多 len 位元組，超過就截斷並失敗）
    const head = new TextEncoder().encode(buildHeaders({ from: env.FROM_ADDRESS, to: env.TO_ADDRESS, code, boundary, replyTo: reply || null }));
    let seen = 0, tooBig = false;
    const limiter = new TransformStream({
      transform(chunk, ctl) { seen += chunk.byteLength; if (seen > len || seen > MAX_BYTES) { tooBig = true; ctl.error(new Error('too_large')); return; } ctl.enqueue(chunk); },
    });
    const body = req.body.pipeThrough(limiter);
    const raw = new ReadableStream({
      async start(ctl) {
        ctl.enqueue(head);
        const r = body.getReader();
        try { for (;;) { const { value, done } = await r.read(); if (done) break; ctl.enqueue(value); } ctl.close(); }
        catch (e) { ctl.error(e); }
      },
    });
    try {
      const Msg = deps.EmailMessage || EmailMessage;
      await env.MAILER.send(new Msg(env.FROM_ADDRESS, env.TO_ADDRESS, raw));
    } catch (e) {
      return json(tooBig ? { error: 'too_large' } : { error: 'send_failed', detail: String((e && e.message) || e).slice(0, 200) }, tooBig ? 413 : 502, h);
    }
    return json({ ok: true, code }, 200, h);
  },
};
