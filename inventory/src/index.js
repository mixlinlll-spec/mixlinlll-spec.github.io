// EWP 私有庫存後台（Cloudflare Worker）
//   GET  /                         庫存管理網頁
//   GET  /api/me                   目前登入者
//   GET  /api/stats                總數、未盤點、需注意
//   GET  /api/skus?q=&filter=&offset=&product=  搜尋＋分頁（filter：all／uncounted／zero／alert／inactive）
//   GET  /api/skus/:sku            單一規格
//   GET  /api/skus/:sku/ledger     異動紀錄
//   POST /api/skus/:sku/adjust     入庫／出庫／修改為／盤點確認
//   POST /api/skus/:sku/transfer   移轉到同商品的另一個規格
import { authenticate } from './auth.js';
import { listSkus, getSku, getLedger, adjust, transfer, stats, InventoryError } from './inventory.js';
import { pageHtml } from './ui.js';

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow',
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS } });

export default {
  async fetch(request, env, ctx, deps = {}) {
    const url = new URL(request.url);
    const auth = await authenticate(request, env, deps.fetchImpl || fetch);
    if (auth.error) {
      if (url.pathname.startsWith('/api/')) return json({ error: auth.error }, auth.status);
      return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EWP 庫存管理</title><body style="font-family:system-ui;padding:24px"><h1>EWP 庫存管理</h1><p>${auth.error}</p></body>`, { status: auth.status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS } });
    }
    const actor = auth.email;
    try {
      if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        return new Response(pageHtml({ pagesCmsBase: env.PAGES_CMS_EDIT_BASE || '' }), {
          headers: {
            'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS,
            'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
          },
        });
      }
      if (!url.pathname.startsWith('/api/')) return json({ error: '找不到頁面' }, 404);
      if (request.method === 'GET' && url.pathname === '/api/me') return json({ email: actor, dev: !!auth.dev });
      if (request.method === 'GET' && url.pathname === '/api/stats') return json(await stats(env.DB));
      if (request.method === 'GET' && url.pathname === '/api/skus') {
        const sp = url.searchParams;
        return json(await listSkus(env.DB, { q: sp.get('q') || '', filter: sp.get('filter') || 'all', offset: sp.get('offset') || 0, limit: sp.get('limit') || undefined, product: sp.get('product') || '' }));
      }
      const m = url.pathname.match(/^\/api\/skus\/([A-Za-z0-9_-]{1,80})(\/ledger|\/adjust|\/transfer)?$/);
      if (m) {
        const sku = m[1];
        if (request.method === 'GET' && !m[2]) {
          const row = await getSku(env.DB, sku);
          return row ? json(row) : json({ error: '找不到這個 SKU' }, 404);
        }
        if (request.method === 'GET' && m[2] === '/ledger') return json({ items: await getLedger(env.DB, sku) });
        if (request.method === 'POST' && (m[2] === '/adjust' || m[2] === '/transfer')) {
          // 防 CSRF：只接受同網域、JSON 格式的請求
          const origin = request.headers.get('Origin');
          if (origin && origin !== url.origin) return json({ error: '來源不符' }, 403);
          if (!String(request.headers.get('Content-Type') || '').includes('application/json')) return json({ error: '格式錯誤' }, 415);
          let body;
          try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }
          return json(m[2] === '/adjust' ? await adjust(env.DB, sku, body, actor) : await transfer(env.DB, sku, body, actor));
        }
      }
      return json({ error: '找不到' }, 404);
    } catch (e) {
      if (e instanceof InventoryError) return json({ error: e.message, sku: e.sku }, e.status);
      console.error('inventory error', e && e.message); // 不輸出庫存數字
      return json({ error: '系統錯誤，請稍後再試' }, 500);
    }
  },
};
