// 庫存管理網頁（單一頁面，手機與電腦皆可用）。所有資料以 textContent 寫入，避免 XSS。
export function pageHtml({ pagesCmsBase = '' } = {}) {
  return `<!doctype html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>EWP 庫存管理</title>
<style>
:root{--red:#c8102e;--ink:#16181c;--muted:#5f6670;--line:#e3e5e8;--bg:#f6f7f8;--card:#fff;--ok:#1f7a3a;--warn:#b54708;--warnbg:#fff4e5;--info:#175cd3;--infobg:#eef4ff}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}[hidden]{display:none!important}
body{margin:0;font:16px/1.5 system-ui,-apple-system,"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;color:var(--ink);background:var(--bg)}
header{background:var(--ink);color:#fff;padding:12px 16px;position:sticky;top:0;z-index:5}
header .row{display:flex;align-items:center;justify-content:space-between;gap:8px;max-width:960px;margin:0 auto}
header h1{font-size:18px;margin:0;letter-spacing:.02em}header h1 b{color:var(--red)}
#me{font-size:12px;color:#c9ccd1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:50vw}
main{max-width:960px;margin:0 auto;padding:12px 16px 96px}
.notice{background:var(--warnbg);border:1px solid #f7c58a;border-radius:10px;padding:10px 12px;font-size:14px;margin-bottom:12px}
.stats{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.stat{flex:1 1 90px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 10px}
.stat b{display:block;font-size:20px}.stat span{font-size:12px;color:var(--muted)}
.search{display:flex;gap:8px;margin-bottom:8px}
input,select,textarea,button{font:inherit}
input[type=search],input[type=number],select,textarea{width:100%;padding:12px;border:1px solid #c9ccd1;border-radius:10px;background:#fff}
.chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:12px}
.chip{border:1px solid #c9ccd1;background:#fff;border-radius:999px;padding:6px 12px;white-space:nowrap;cursor:pointer;min-height:36px}
.chip[aria-pressed=true]{background:var(--ink);color:#fff;border-color:var(--ink)}
.product{background:var(--card);border:1px solid var(--line);border-radius:12px;margin-bottom:10px;overflow:hidden}
.product h2{font-size:15px;margin:0;padding:10px 12px;border-bottom:1px solid var(--line);display:flex;gap:8px;align-items:flex-start;justify-content:space-between}
.product h2 a{font-size:12px;font-weight:400;color:var(--info);white-space:nowrap}
.sku{display:grid;grid-template-columns:1fr auto;gap:4px 8px;padding:10px 12px;border-top:1px solid var(--line);width:100%;text-align:left;background:none;border-left:0;border-right:0;border-bottom:0;cursor:pointer;min-height:56px}
.sku:first-of-type{border-top:0}.sku:hover{background:#fafafa}
.sku .name{font-weight:600}.sku .nums{text-align:right;white-space:nowrap}
.sku .nums b{font-size:18px}.sku .meta{grid-column:1/-1;font-size:12px;color:var(--muted);display:flex;gap:8px;flex-wrap:wrap}
.badge{display:inline-block;font-size:12px;padding:1px 8px;border-radius:999px;background:#eef0f2;color:var(--ink)}
.badge.warn{background:var(--warnbg);color:var(--warn)}.badge.ok{background:#e7f6ec;color:var(--ok)}.badge.info{background:var(--infobg);color:var(--info)}
.alert{border-radius:10px;padding:10px 12px;font-size:14px;margin:8px 0}
.alert.warning{background:var(--warnbg);color:var(--warn);border:1px solid #f7c58a}.alert.info{background:var(--infobg);color:var(--info);border:1px solid #b2ccff}
dialog{border:0;padding:0;border-radius:16px 16px 0 0;width:100%;max-width:560px;margin:auto auto 0;max-height:92vh}
@media(min-width:700px){dialog{border-radius:16px;margin:auto}}
dialog::backdrop{background:rgba(0,0,0,.45)}
.sheet{padding:16px;overflow:auto;max-height:92vh}
.sheet h3{margin:0 0 4px;font-size:17px}.sheet .sub{color:var(--muted);font-size:13px;margin:0 0 12px}
.nums3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0 12px}
.nums3 div{background:var(--bg);border-radius:10px;padding:8px;text-align:center}.nums3 b{display:block;font-size:22px}.nums3 span{font-size:12px;color:var(--muted)}
.tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px}
.tabs button{border:1px solid #c9ccd1;background:#fff;border-radius:10px;padding:10px 4px;min-height:44px;cursor:pointer}
.tabs button[aria-pressed=true]{background:var(--red);border-color:var(--red);color:#fff}
label{display:block;font-size:14px;font-weight:600;margin:10px 0 4px}
.preview{font-size:14px;color:var(--muted);margin:8px 0}
.actions{display:flex;gap:8px;margin-top:12px}
.btn{flex:1;min-height:48px;border-radius:12px;border:1px solid #c9ccd1;background:#fff;cursor:pointer}
.btn.primary{background:var(--red);border-color:var(--red);color:#fff;font-weight:700}
.btn:disabled{opacity:.5}
.ledger{margin-top:16px}.ledger h4{margin:0 0 6px;font-size:14px}
.ledger li{font-size:13px;border-top:1px solid var(--line);padding:6px 0;list-style:none}.ledger ul{padding:0;margin:0}
#toast{position:fixed;left:16px;right:16px;bottom:16px;max-width:560px;margin:auto;background:var(--ink);color:#fff;border-radius:12px;padding:12px 14px;display:none;z-index:20}
.empty{text-align:center;color:var(--muted);padding:32px 0}
.count{font-size:13px;color:var(--muted);margin:0 0 8px}
.more{display:block;width:100%;margin:12px 0}
.inactive-note{background:#f2f4f7;border-radius:10px;padding:10px 12px;font-size:14px;margin:8px 0}
.tabs.t2{grid-template-columns:repeat(2,1fr)}
</style>
</head>
<body>
<header><div class="row"><h1><b>EWP</b> 庫存管理</h1><span id="me"></span></div></header>
<main>
  <p class="notice"><b>開始前請先盤點：</b>「蝦皮快照」是 2026-10-22 匯出的舊數字，只供參考，不是今天的庫存。每個規格請點開後用「盤點確認」輸入實際數量。庫存只存在這個私有後台，不會出現在官網或 GitHub。</p>
  <div class="stats"><div class="stat"><b id="st-skus">—</b><span>規格總數</span></div><div class="stat"><b id="st-uncounted">—</b><span>尚未盤點</span></div><div class="stat"><b id="st-alerts">—</b><span>官網現貨但可售 0</span></div></div>
  <div class="search"><input id="q" type="search" placeholder="搜尋商品名稱、規格、品牌、SKU、蝦皮商品 ID" autocomplete="off" enterkeyhint="search" aria-label="搜尋"></div>
  <div class="chips" role="group" aria-label="篩選">
    <button class="chip" data-filter="all" aria-pressed="true">全部</button>
    <button class="chip" data-filter="uncounted" aria-pressed="false">尚未盤點</button>
    <button class="chip" data-filter="zero" aria-pressed="false">可售 0</button>
    <button class="chip" data-filter="alert" aria-pressed="false">需注意</button>
    <button class="chip" data-filter="inactive" aria-pressed="false">已停用（仍有庫存）<span id="st-inactive"></span></button>
  </div>
  <p class="count" id="count"></p>
  <div id="list" aria-live="polite"></div>
  <button class="btn more" id="more" type="button" hidden>載入更多</button>
</main>
<dialog id="dlg" aria-labelledby="d-title"><div class="sheet">
  <h3 id="d-title"></h3><p class="sub" id="d-sub"></p>
  <div class="nums3"><div><b id="d-onhand"></b><span>實際庫存</span></div><div><b id="d-reserved"></b><span>已保留</span></div><div><b id="d-available"></b><span>可售</span></div></div>
  <div id="d-alert"></div>
  <p class="sub" id="d-snapshot"></p>
  <div id="d-inactive" class="inactive-note" hidden>這個規格已從商品資料移除（或商品已停用）。剩餘庫存可以「移轉」到同商品的其他規格，或「出庫」報廢；紀錄都會保留。</div>
  <div class="tabs" role="group" aria-label="操作" id="tabs-active">
    <button data-kind="count" aria-pressed="true">盤點確認</button>
    <button data-kind="receive" aria-pressed="false">入庫</button>
    <button data-kind="issue" aria-pressed="false">出庫</button>
    <button data-kind="set" aria-pressed="false">修改為</button>
  </div>
  <div class="tabs t2" role="group" aria-label="操作" id="tabs-inactive" hidden>
    <button data-kind="transfer" aria-pressed="false">移轉到其他規格</button>
    <button data-kind="issue" aria-pressed="false">出庫</button>
  </div>
  <div id="d-target-wrap" hidden><label for="d-target">移轉到</label><select id="d-target"></select></div>
  <label for="d-qty" id="d-qty-label">實際數量</label>
  <input id="d-qty" type="number" inputmode="numeric" min="0" step="1" pattern="[0-9]*">
  <label for="d-reason">原因</label>
  <select id="d-reason"></select>
  <input id="d-reason-other" type="text" placeholder="請輸入原因" maxlength="200" style="display:none;margin-top:6px;width:100%;padding:12px;border:1px solid #c9ccd1;border-radius:10px">
  <p class="preview" id="d-preview"></p>
  <div class="actions"><button class="btn" id="d-close" type="button">關閉</button><button class="btn primary" id="d-save" type="button">儲存</button></div>
  <div class="ledger"><h4>異動紀錄</h4><ul id="d-ledger"></ul></div>
</div></dialog>
<div id="toast" role="status"></div>
<script>
const PAGES_CMS_BASE = ${JSON.stringify(pagesCmsBase)};
const AV = { in_stock: '現貨', preorder: '預購', made_to_order: '接單製作', out_of_stock: '缺貨', unknown: '請洽詢' };
const KIND = { receive: '入庫', issue: '出庫', set: '修改為', count: '盤點確認', transfer: '移轉', transfer_out: '移出', transfer_in: '移入' };
const REASONS = {
  count: ['盤點確認', '其他'],
  receive: ['進貨入庫', '退貨回庫', '盤盈', '其他'],
  issue: ['蝦皮訂單出貨', '官網／LINE 訂單出貨', '組裝使用', '損壞報廢', '盤虧', '其他'],
  set: ['手動修正', '其他'],
  transfer: ['規格調整（舊規格庫存移到新規格）', '其他'],
};
const $ = s => document.querySelector(s);
const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v); } for (const c of kids) if (c != null) e.append(c); return e; };
let filter = 'all', current = null, kind = 'count', timer, nextOffset = null, loadSeq = 0;

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }, credentials: 'same-origin' });
  let data = {}; try { data = await res.json(); } catch {}
  if (!res.ok) { const err = new Error(data.error || ('錯誤 ' + res.status)); err.data = data; err.status = res.status; throw err; }
  return data;
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => (t.style.display = 'none'), 3500); }
function fmtTime(s) { if (!s) return ''; const d = new Date(s); return d.toLocaleString('zh-TW', { hour12: false, timeZone: 'Asia/Taipei' }); }
function cmsLink(productId) { return PAGES_CMS_BASE ? PAGES_CMS_BASE + encodeURIComponent('src/data/products/' + productId + '.json') : ''; }

async function loadStats() {
  try { const s = await api('/api/stats'); $('#st-skus').textContent = s.skus ?? 0; $('#st-uncounted').textContent = s.uncounted ?? 0; $('#st-alerts').textContent = s.alerts ?? 0; $('#st-inactive').textContent = s.inactive_with_stock ? ' ' + s.inactive_with_stock : ''; } catch {}
}
// 分頁載入：搜尋與篩選在伺服器端涵蓋全部規格，每次載入 100 筆，「載入更多」接續
let loadingMore = false;
async function load(append = false) {
  const list = $('#list');
  if (append && (loadingMore || nextOffset == null)) return; // 連點「載入更多」只載入一次
  if (append) { loadingMore = true; $('#more').disabled = true; }
  const seq = append ? loadSeq : ++loadSeq;
  const offset = append ? nextOffset || 0 : 0;
  try {
    const data = await api('/api/skus?q=' + encodeURIComponent($('#q').value) + '&filter=' + filter + '&offset=' + offset);
    if (seq !== loadSeq) return; // 已有較新的搜尋
    if (!append) list.replaceChildren();
    if (!data.total) { list.replaceChildren(el('p', { class: 'empty', text: '沒有符合的商品' })); }
    for (const it of data.items) {
      let card = list.querySelector('section.product[data-product="' + CSS.escape(it.product_id) + '"]');
      if (!card) {
        const head = el('h2', {}, el('span', { text: it.product_name }));
        const link = cmsLink(it.product_id); if (link) head.append(el('a', { href: link, target: '_blank', rel: 'noopener', text: '商品後台 ↗' }));
        card = el('section', { class: 'product', 'data-product': it.product_id }, head);
        list.append(card);
      }
      card.append(skuRow(it));
    }
    nextOffset = data.next_offset;
    const shown = list.querySelectorAll('.sku').length;
    $('#count').textContent = data.total ? '顯示 ' + shown + ' / 共 ' + data.total + ' 個規格' : '';
    const more = $('#more'); more.hidden = nextOffset == null; more.textContent = '載入更多（還有 ' + (data.total - shown) + ' 個）';
  } catch (e) { if (seq === loadSeq) list.replaceChildren(el('p', { class: 'empty', text: e.message })); }
  finally { if (append) { loadingMore = false; $('#more').disabled = false; } }
}
function skuRow(r) {
  const av = r.site_availability || r.product_availability;
  const meta = el('div', { class: 'meta' },
    el('span', { class: 'badge', text: '官網：' + (AV[av] || av || '—') }),
    r.counted_at ? el('span', { class: 'badge ok', text: '已盤點' }) : el('span', { class: 'badge warn', text: '尚未盤點' }),
    r.snapshot_qty != null && !r.counted_at ? el('span', { text: '10/22 蝦皮快照 ' + r.snapshot_qty + '（參考）' }) : null,
    r.alert ? el('span', { class: 'badge ' + (r.alert.level === 'warning' ? 'warn' : 'info'), text: r.alert.level === 'warning' ? '⚠ 官網現貨但可售 0' : '可售 0（' + (AV[av] || '') + '）' }) : null,
    el('span', { text: r.sku }));
  const b = el('button', { class: 'sku', type: 'button', 'data-sku': r.sku },
    el('span', { class: 'name', text: r.variant_name || '（單一規格）' }),
    el('span', { class: 'nums' }, el('b', { text: String(r.available) }), el('small', { text: ' 可售 ／ 實際 ' + r.stock_on_hand + (r.stock_reserved ? '、保留 ' + r.stock_reserved : '') })),
    meta);
  b.addEventListener('click', () => openSku(r.sku));
  return b;
}
function setKind(k) {
  kind = k;
  for (const b of document.querySelectorAll('.tabs button')) b.setAttribute('aria-pressed', String(b.dataset.kind === k));
  $('#d-qty-label').textContent = { count: '盤點後的實際數量', receive: '入庫數量', issue: '出庫數量', set: '修改後的實際數量', transfer: '移轉數量' }[k];
  $('#d-target-wrap').hidden = k !== 'transfer';
  const sel = $('#d-reason'); sel.replaceChildren(...REASONS[k].map(x => el('option', { value: x, text: x })));
  $('#d-reason-other').style.display = 'none'; $('#d-reason-other').value = '';
  $('#d-qty').value = k === 'count' && current && current.counted_at == null && current.snapshot_qty != null ? '' : '';
  preview();
}
function preview() {
  if (!current) return;
  const p = $('#d-preview');
  const q = Number($('#d-qty').value);
  const valid = $('#d-qty').value !== '' && Number.isInteger(q) && q >= 0;
  let after = current.stock_on_hand;
  if (valid) after = kind === 'receive' ? after + q : (kind === 'issue' || kind === 'transfer') ? after - q : q;
  if (kind === 'transfer' && !$('#d-target').value) { p.textContent = '這件商品沒有其他使用中的規格可以移轉'; $('#d-save').disabled = true; return; }
  if (!valid || (q === 0 && kind !== 'set' && kind !== 'count')) { p.textContent = valid ? '數量必須大於 0' : '請輸入數量'; $('#d-save').disabled = true; return; }
  if (after < current.stock_reserved) { p.textContent = '數量不足：不可少於已保留 ' + current.stock_reserved + '（也不可為負數）'; $('#d-save').disabled = true; return; }
  p.textContent = '儲存後：實際 ' + current.stock_on_hand + ' → ' + after + '，可售 ' + (after - current.stock_reserved);
  $('#d-save').disabled = false;
}
function fill(r) {
  current = r;
  $('#d-title').textContent = r.product_name; $('#d-sub').textContent = (r.variant_name || '單一規格') + '｜' + r.sku;
  $('#d-onhand').textContent = r.stock_on_hand; $('#d-reserved').textContent = r.stock_reserved; $('#d-available').textContent = r.available;
  const a = $('#d-alert'); a.replaceChildren();
  if (r.alert) { a.append(el('div', { class: 'alert ' + r.alert.level, text: r.alert.message })); const link = cmsLink(r.product_id); if (link && r.alert.level === 'warning') a.firstChild.append(' ', el('a', { href: link, target: '_blank', rel: 'noopener', text: '開啟商品後台 ↗' })); }
  const inactive = !r.active || !r.product_active;
  $('#d-inactive').hidden = !inactive; $('#tabs-active').hidden = inactive; $('#tabs-inactive').hidden = !inactive;
  $('#d-snapshot').textContent = (r.counted_at ? '最近盤點：' + fmtTime(r.counted_at) + '（' + (r.counted_by || '') + '）' : '尚未盤點') + (r.snapshot_qty != null ? '｜10/22 蝦皮快照：' + r.snapshot_qty + '（舊數字，僅供參考）' : '');
}
async function loadLedger(sku) {
  const ul = $('#d-ledger'); ul.replaceChildren(el('li', { text: '載入中…' }));
  try {
    const { items } = await api('/api/skus/' + encodeURIComponent(sku) + '/ledger');
    ul.replaceChildren(...(items.length ? items.map(x => el('li', { text: fmtTime(x.created_at) + '｜' + (KIND[x.kind] || x.kind) + '｜' + x.before_on_hand + ' → ' + x.after_on_hand + '（' + (x.delta_on_hand >= 0 ? '+' : '') + x.delta_on_hand + '）｜' + x.reason + '｜' + x.actor })) : [el('li', { text: '尚無紀錄' })]));
  } catch (e) { ul.replaceChildren(el('li', { text: e.message })); }
}
async function openSku(sku) {
  try {
    const r = await api('/api/skus/' + encodeURIComponent(sku));
    fill(r);
    if (!r.active || !r.product_active) {
      const { items } = await api('/api/skus?product=' + encodeURIComponent(r.product_id) + '&limit=200');
      $('#d-target').replaceChildren(...items.filter(x => x.sku !== r.sku).map(x => el('option', { value: x.sku, text: (x.variant_name || '單一規格') + '（實際 ' + x.stock_on_hand + '）' })));
      setKind('transfer');
    } else setKind(r.counted_at ? 'receive' : 'count');
    $('#dlg').showModal(); $('#d-qty').focus(); loadLedger(sku);
  } catch (e) { toast(e.message); }
}
async function save() {
  if (!current) return;
  const reason = $('#d-reason').value === '其他' ? $('#d-reason-other').value.trim() : $('#d-reason').value;
  if (!reason) { toast('請填寫原因'); return; }
  const btn = $('#d-save'); btn.disabled = true;
  const body = { kind, qty: Number($('#d-qty').value), reason, expected_version: current.version, op_id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)) };
  try {
    if (kind === 'transfer') body.to_sku = $('#d-target').value;
    const before = current.stock_on_hand;
    const res = await api('/api/skus/' + encodeURIComponent(current.sku) + (kind === 'transfer' ? '/transfer' : '/adjust'), { method: 'POST', body: JSON.stringify(body) });
    fill(res.sku); $('#d-qty').value = ''; preview(); loadLedger(current.sku); load(); loadStats();
    toast(KIND[kind] + '完成：實際 ' + before + ' → ' + res.sku.stock_on_hand + (res.sku.alert && res.sku.alert.level === 'warning' ? '｜⚠ 請到商品後台修改供貨狀態' : ''));
  } catch (e) {
    if (e.data && e.data.sku) fill(e.data.sku);
    toast(e.message); preview();
  } finally { btn.disabled = false; preview(); }
}
for (const c of document.querySelectorAll('.chip')) c.addEventListener('click', () => { filter = c.dataset.filter; for (const x of document.querySelectorAll('.chip')) x.setAttribute('aria-pressed', String(x === c)); load(); });
for (const b of document.querySelectorAll('.tabs button')) b.addEventListener('click', () => setKind(b.dataset.kind));
$('#q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 250); });
$('#d-qty').addEventListener('input', preview);
$('#d-target').addEventListener('change', preview);
$('#more').addEventListener('click', () => load(true));
$('#d-reason').addEventListener('change', () => { const o = $('#d-reason-other'); o.style.display = $('#d-reason').value === '其他' ? 'block' : 'none'; });
$('#d-close').addEventListener('click', () => $('#dlg').close());
$('#d-save').addEventListener('click', save);
api('/api/me').then(m => { $('#me').textContent = m.email + (m.dev ? '（本機測試）' : ''); }).catch(() => {});
loadStats(); load();
</script>
</body>
</html>`;
}
