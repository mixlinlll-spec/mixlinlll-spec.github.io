// Cloudflare Access 身分驗證：驗證 Cf-Access-Jwt-Assertion（RS256 簽章、issuer、audience、有效期）。
// 沒有設定 ACCESS_AUD／ACCESS_TEAM_DOMAIN 時一律拒絕（fail closed）。
// 本機開發：只有 DEV_AUTH_EMAIL 有設定「且」連線來自 localhost 時才略過（正式環境不會設定這個變數）。

const b64urlToBytes = s => {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};
const decodeJson = s => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

let jwksCache = { url: '', at: 0, keys: [] };

async function getKeys(teamDomain, fetchImpl) {
  const url = `${teamDomain.replace(/\/$/, '')}/cdn-cgi/access/certs`;
  if (jwksCache.url === url && Date.now() - jwksCache.at < 10 * 60 * 1000) return jwksCache.keys;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`無法取得 Access 公鑰（${res.status}）`);
  const { keys = [] } = await res.json();
  jwksCache = { url, at: Date.now(), keys };
  return keys;
}

export function resetJwksCache() { jwksCache = { url: '', at: 0, keys: [] }; }

export async function verifyAccessJwt(token, { teamDomain, aud, fetchImpl = fetch, now = Date.now() }) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('缺少或格式錯誤的 Access 憑證');
  const header = decodeJson(parts[0]);
  const payload = decodeJson(parts[1]);
  if (header.alg !== 'RS256') throw new Error('不支援的簽章演算法');
  const keys = await getKeys(teamDomain, fetchImpl);
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error('找不到對應的 Access 公鑰');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new Error('Access 憑證簽章錯誤');
  const iss = teamDomain.replace(/\/$/, '');
  if (payload.iss !== iss) throw new Error('Access 憑證來源不符');
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) throw new Error('Access 憑證不屬於這個應用程式');
  const sec = Math.floor(now / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < sec) throw new Error('Access 憑證已過期');
  if (typeof payload.nbf === 'number' && payload.nbf > sec + 60) throw new Error('Access 憑證尚未生效');
  return { email: payload.email || payload.common_name || payload.sub };
}

// 回傳 { email } 或 { error, status }
export async function authenticate(request, env, fetchImpl = fetch) {
  const url = new URL(request.url);
  if (env.DEV_AUTH_EMAIL && ['localhost', '127.0.0.1'].includes(url.hostname)) return { email: env.DEV_AUTH_EMAIL, dev: true };
  if (!env.ACCESS_AUD || !env.ACCESS_TEAM_DOMAIN) return { status: 503, error: '尚未設定 Cloudflare Access（ACCESS_AUD、ACCESS_TEAM_DOMAIN），為了安全暫不開放' };
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return { status: 403, error: '請透過 Cloudflare Access 登入' };
  try {
    return await verifyAccessJwt(token, { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD, fetchImpl });
  } catch (e) {
    return { status: 403, error: e.message };
  }
}
