// EWP 故障排除中心（/help/）：src/data/help/<slug>.md，一篇一個檔案。
// 寫作格式見 docs/admin/HELP_CENTER.md。內文為精簡 Markdown，另外支援：
//   1. 編號步驟           | 表格 |            `程式碼`
//   :::safety 標題 … :::   開始前／安全提醒（黃框）
//   :::stop 標題 … :::     什麼時候停手（紅框）
//   :::advanced 標題 … :::  進階內容（預設收合）
//   :::case A 標題 … :::    分支（互動工具可只顯示其中一個；沒有 JavaScript 時全部顯示）
//   :::checks 標題 … :::    怎樣算修好（每一行「- 」是一個可打勾項目）
//   {{tool:arming-flags}}  {{tool:analog-screens}}   互動工具
// 內文不接受 HTML（一律轉義）。文末「還是不行？」由 frontmatter 的 prepare 自動產生，不在內文手寫。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './data.mjs';
import { esc, attr } from './html.mjs';
import { parseFrontmatter, imageSize } from './journal.mjs';

export const HELP_DIR = path.join(ROOT, 'src', 'data', 'help');
export const HELP_IMG = '/assets/img/help/';
export const HELP_CATEGORIES = ['新手檢查', '飛控設定', '接收機／對頻', '遙控器／EdgeTX', '類比圖傳', '數位圖傳', '遙控與圖傳訊號', '馬達／電調', '震動／飛行手感', '供電／接線', '電腦連線', '韌體更新', 'GPS／返航', '電池／充電'];
export const HELP_LEVELS = { beginner: '新手', intermediate: '中階' };
export const HELP_TOOLS = ['arming-flags', 'analog-screens', 'case-picker'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const helpUrl = a => `/help/${a.slug}/`;
// 台灣時間的今天（YYYY-MM-DD），用來擋未來的核對日期
export const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);

function inline(s) {
  // 先把 `程式碼` 抽出來，避免裡面的符號被當成粗體或連結
  const codes = [];
  let out = esc(s).replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  out = out.replace(/\[\[([a-z0-9-]+)\]\]/g, '\u0001$1\u0001');
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, text, href) => {
    const h = href.replace(/&amp;/g, '&');
    if (!/^(\/|https:\/\/|#)/.test(h)) return text;
    const ext = /^https:/.test(h) ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${attr(h)}"${ext}>${text}</a>`;
  });
  return out.replace(/\u0000(\d+)\u0000/g, (m, i) => `<code>${codes[i]}</code>`);
}

const caseId = k => `case-${k.toLowerCase()}`;

// 把一段 Markdown（不含 ::: 容器）轉成 HTML
function blocks(lines, ctx) {
  const out = [];
  let i = 0;
  const isTable = l => /^\s*\|.*\|\s*$/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^(#{2,3})\s+(.+)$/))) {
      const n = m[1].length, text = m[2];
      const id = n === 2 ? `s-${ctx.sections.length + 1}` : '';
      if (n === 2) ctx.sections.push({ id, title: text });
      out.push(`<h${n}${id ? ` id="${id}"` : ''}>${inline(text)}</h${n}>`); i++; continue;
    }
    if ((m = line.match(/^\{\{tool:([a-z-]+)\}\}\s*$/))) { ctx.tools.push(m[1]); out.push(tool(m[1], ctx)); i++; continue; }
    if ((m = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/))) {
      ctx.images.push({ src: m[2], alt: m[1] });
      const d = imageSize(m[2]);
      const mob = m[2].replace(/\.(webp|png|jpe?g)$/, '-m.$1'), md = mob !== m[2] ? imageSize(mob) : null;
      const wh = x => (x ? ` width="${x.w}" height="${x.h}"` : '');
      out.push(`<figure class="help-fig"><a href="${attr(m[2])}" target="_blank" rel="noopener" aria-label="開啟原尺寸圖片"><picture>${md ? `<source media="(max-width: 700px)" srcset="${attr(mob)}"${wh(md)}>` : ''}<img src="${attr(m[2])}" alt="${attr(m[1])}"${wh(d)} loading="lazy" decoding="async"></picture></a>${figCaption(m[1], !!md)}</figure>`);
      i++; continue;
    }
    if (isTable(line)) {
      const rows = [];
      while (i < lines.length && isTable(lines[i])) rows.push(lines[i++]);
      const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const [head, , ...body] = rows;
      if (!rows[1] || !/^[\s|:-]+$/.test(rows[1])) { ctx.errors.push('表格第二行必須是 | --- | 分隔線'); continue; }
      out.push(`<div class="help-table"><table><thead><tr>${cells(head).map(c => `<th scope="col">${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${cells(r).map((c, k) => `<td data-label="${attr(cells(head)[k] || '')}">${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [], first = parseInt(line, 10);
      const subs = [];
      // 步驟底下縮排的「   - 」是這一步的子項目，放在同一步裡面
      while (i < lines.length && (/^\d+\.\s+/.test(lines[i]) || (items.length && /^\s{2,}-\s+/.test(lines[i])))) {
        if (/^\d+\.\s+/.test(lines[i])) { items.push(lines[i++].replace(/^\d+\.\s+/, '')); subs.push([]); }
        else subs[subs.length - 1].push(lines[i++].replace(/^\s+-\s+/, ''));
      }
      const subList = k => subs[k].length ? `<ul class="help-step-sub">${subs[k].map(t => `<li>${inline(t)}</li>`).join('')}</ul>` : '';
      // 清單中間插了圖片時，後半段從原本的號碼接著編（例如 4.），不要重新從 1 開始
      const start = first > 1 ? ` start="${first}" style="counter-reset:hs ${first - 1}"` : '';
      // 「**標題**：說明」拆成小標＋說明，讓步驟一眼看到重點
      out.push(`<ol class="help-steps"${start}>${items.map((t, k) => {
        const s = t.match(/^\*\*(.+?)\*\*[：:]?\s*(.*)$/);
        return s ? `<li><div><p class="help-step-t">${inline(s[1])}</p>${s[2] ? `<p>${inline(s[2])}</p>` : ''}${subList(k)}</div></li>` : `<li><div><p>${inline(t)}</p>${subList(k)}</div></li>`;
      }).join('')}</ol>`);
      continue;
    }
    if (/^\s*-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*-\s+/, ''));
      out.push(`<ul>${items.map(t => `<li>${inline(t)}</li>`).join('')}</ul>`); continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|!\[|\s*-\s+|\d+\.\s+|\s*\||\{\{tool:)/.test(lines[i])) para.push(lines[i++].trim());
    out.push(`<p>${inline(para.join(''))}</p>`);
  }
  return out.join('\n');
}

function container(kind, arg, inner, ctx) {
  const lines = inner;
  if (kind === 'safety') return `<aside class="help-box help-safety" role="note"><p class="help-box-t">${inline(arg || '開始前')}</p>${blocks(lines, ctx)}</aside>`;
  if (kind === 'stop') { ctx.hasStop = true; return `<aside class="help-box help-stop" role="note"><p class="help-box-t">${inline(arg || '什麼時候停手')}</p>${blocks(lines, ctx)}</aside>`; }
  if (kind === 'advanced') return `<details class="help-adv"><summary>${inline(arg || '進階')}</summary><div>${blocks(lines, ctx)}</div></details>`;
  if (kind === 'case') {
    const m = arg.match(/^([A-Z])\s+(.+)$/);
    if (!m) { ctx.errors.push(':::case 後面要接「代號 標題」，例如 :::case A 滿滿的雪花'); return ''; }
    ctx.cases.push(m[1]);
    ctx.caseTitles.push([m[1], m[2]]);
    return `<section class="help-case" id="${caseId(m[1])}" data-case="${m[1]}"><h3>${inline(m[1] + '. ' + m[2])}</h3>${blocks(lines, ctx)}</section>`;
  }
  if (kind === 'checks') {
    const items = lines.filter(l => /^\s*-\s+/.test(l)).map(l => l.replace(/^\s*-\s+/, ''));
    ctx.checks = items.length;
    const n = ctx.sections.length + 1;
    ctx.sections.push({ id: `s-${n}`, title: arg || '怎樣算修好' });
    // 「（A）」「（B、C）」開頭的項目只屬於那幾個狀況；選了狀況時只需要勾那個狀況的項目＋共通項目
    const li = (t, k) => {
      const m = t.match(/^（([A-Z](?:、[A-Z])*)）\s*(.*)$/);
      const cases = m ? m[1].split('、') : [];
      const label = m ? `<span class="help-check-case">${m[1]} 狀況</span>${inline(m[2])}` : inline(t);
      return `<li${cases.length ? ` data-for="${cases.join(' ')}"` : ''}><label><input type="checkbox" id="chk-${k + 1}"><span>${label}</span></label></li>`;
    };
    const hasCase = items.some(t => /^（[A-Z]/.test(t));
    return `<section class="help-checks" data-checks><h2 id="s-${n}">${inline(arg || '怎樣算修好')}</h2>${hasCase ? '<p class="help-check-note">標示狀況代號的項目，只要勾你遇到的那一種；上方「先選狀況」選好後，只會顯示那一種。</p>' : ''}<ul>${items.map(li).join('')}</ul><p class="help-done" data-done hidden>全部正常，問題已排除。</p></section>`;
  }
  ctx.errors.push(`不認得的區塊 :::${kind}`);
  return '';
}

// 圖說：「標題：① 說明；② 說明。補充」拆成標題、編號清單（對應圖上的紅色編號）與補充說明，手機上比一整段小字好讀
const MARKS = '①②③④⑤⑥⑦⑧⑨';
export function figCaption(alt, hasMobile) {
  const zoom = `<span class="help-fig-zoom">${hasMobile ? '手機版只顯示重點區域；' : ''}點圖片可看完整畫面</span>`;
  const first = [...alt].findIndex(c => MARKS.includes(c));
  if (first < 0) return `<figcaption>${esc(alt)}${zoom}</figcaption>`;
  const chars = [...alt], title = chars.slice(0, first).join('').replace(/[：:]\s*$/, '');
  const items = chars.slice(first).join('').split(new RegExp(`[${MARKS}]`)).map(x => x.trim()).filter(Boolean);
  let note = '';
  const last = items[items.length - 1], cut = last.indexOf('。');
  if (cut >= 0) { note = last.slice(cut + 1).trim(); items[items.length - 1] = last.slice(0, cut + 1); }
  const li = items.map((t, i) => `<li><span class="help-fig-n" aria-hidden="true">${i + 1}</span><span>${esc(t.replace(/[；;]$/, ''))}</span></li>`).join('');
  return `<figcaption><strong class="help-fig-title">${esc(title)}</strong><ol class="help-fig-marks">${li}</ol>${note ? `<p class="help-fig-note">${esc(note)}</p>` : ''}${zoom}</figcaption>`;
}

// Betaflight App 的分頁英文名稱（2026.6 介面實際文字）。每篇文章第一次提到時自動補上，
// 讓使用英文介面的人也找得到；中文介面的翻譯各版本不一致，以英文為準。
export const BF_TAB_NAMES = { 設定: 'Setup', 連接埠: 'Ports', 接收機: 'Receiver', 馬達: 'Motors', 模式: 'Modes', 圖傳: 'Video Transmitter', 失控保護: 'Failsafe', 配置: 'Configuration', 感測器: 'Sensors', 預設集: 'Presets' };
export function addTabNames(body) {
  const seen = new Set();
  return body.replace(/「([^」]{1,6})」頁(?!（)/g, (all, name) => {
    const en = BF_TAB_NAMES[name];
    if (!en || seen.has(name)) return all;
    seen.add(name);
    return `「${name}」頁（${en}）`;
  });
}

export function renderHelp(body) {
  body = addTabNames(body);
  const ctx = { sections: [], tools: [], images: [], cases: [], caseTitles: [], errors: [], checks: 0, hasStop: false };
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let buf = [];
  const flush = () => { if (buf.length) out.push(blocks(buf, ctx)); buf = []; };
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^:::([a-z]+)\s*(.*)$/);
    if (!m) { buf.push(lines[i]); continue; }
    flush();
    const inner = [];
    i++;
    while (i < lines.length && lines[i].trim() !== ':::') inner.push(lines[i++]);
    if (i >= lines.length) ctx.errors.push(`:::${m[1]} 沒有用 ::: 結束`);
    out.push(container(m[1], m[2].trim(), inner, ctx));
  }
  flush();
  // 通用分支選單：依內文的 :::case 標題自動產生按鈕
  let html = out.join('\n');
  if (ctx.tools.includes('case-picker')) {
    if (ctx.caseTitles.length < 2) ctx.errors.push('{{tool:case-picker}} 需要至少兩個 :::case 分支');
    html = html.replace('<!--case-picker-->', ctx.caseTitles.map(([k, t]) => `<a class="pick" href="#${caseId(k)}" data-pick="${k}"><span class="pick-k">${k}</span><span>${inline(t)}</span></a>`).join(''));
  }
  return { html, ...ctx };
}

function tool(name, ctx) {
  if (name === 'arming-flags') return `<section class="help-tool" data-tool="arming-flags" aria-labelledby="tool-flags-t">
  <p class="help-tool-k">互動查詢</p>
  <h3 id="tool-flags-t">你看到的是哪一個字？</h3>
  <div class="help-tool-row"><span class="help-tool-l" id="flag-ver-l">Betaflight 版本</span><span class="seg" role="group" aria-labelledby="flag-ver-l"><button type="button" data-ver="4.4" aria-pressed="false">4.4</button><button type="button" data-ver="4.5" aria-pressed="true">4.5</button><button type="button" data-ver="2025.12" aria-pressed="false">2025.12</button><button type="button" data-ver="2026.6" aria-pressed="false">2026.6</button></span></div>
  <label class="help-tool-l" for="flag-q">直接輸入，或點下面的字</label>
  <input id="flag-q" type="search" placeholder="例如 RXLOSS" autocomplete="off" autocapitalize="characters">
  <div class="flag-list" role="group" aria-label="解鎖禁用原因" data-flag-list></div>
  <div class="flag-answer" aria-live="polite" data-flag-answer><p class="muted">需要 JavaScript 才能使用查詢；上方表格與下方說明不受影響。</p></div>
</section>`;
  if (name === 'analog-screens') return `<section class="help-tool" data-tool="analog-screens" aria-labelledby="tool-screens-t">
  <p class="help-tool-k">先選畫面</p>
  <h3 id="tool-screens-t">你的眼鏡畫面像哪一張？</h3>
  <div class="screens" role="group" aria-label="選擇眼鏡畫面">
    <a class="screen" href="#case-a" data-pick="A"><span class="scr scr-snow" aria-hidden="true"><canvas width="160" height="120"></canvas></span><span class="cap">A. 滿滿的雪花<small>眼鏡沒收到這台圖傳</small></span></a>
    <a class="screen" href="#case-b" data-pick="B"><span class="scr" aria-hidden="true"><span class="osd"><span class="tl">16.4V</span><span class="tr">EWP</span><span>00:00</span><span>RSSI 99</span></span></span><span class="cap">B. 黑畫面，有 OSD 文字<small>鏡頭影像沒進到飛控</small></span></a>
    <a class="screen" href="#case-c" data-pick="C"><span class="scr" aria-hidden="true"></span><span class="cap">C. 黑畫面，沒有 OSD<small>圖傳沒收到影像，或眼鏡顯示黑幕</small></span></a>
  </div>
  <p class="muted help-note">示意圖，不是真實畫面。</p>
</section>`;
  if (name === 'case-picker') return `<section class="help-tool" data-tool="case-picker" aria-labelledby="tool-pick-t">
  <p class="help-tool-k">先選狀況</p>
  <h3 id="tool-pick-t">你現在看到的是哪一種？</h3>
  <div class="picks" role="group" aria-label="選擇狀況"><!--case-picker--></div>
</section>`;
  ctx.errors.push(`不認得的互動工具 {{tool:${name}}}`);
  return '';
}

export function loadHelp() {
  if (!fs.existsSync(HELP_DIR)) return [];
  const list = fs.readdirSync(HELP_DIR).filter(f => f.endsWith('.md')).sort().map(f => {
    const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(HELP_DIR, f), 'utf8'));
    const slug = meta.slug || f.replace(/\.md$/, '');
    const sources = (meta.sources || []).map(s => { const [t, u] = String(s).split(/\s+\|\s+/); return { title: t?.trim(), url: u?.trim() }; });
    const legacy = (meta.legacy_items || []).map(Number);
    const keywords = (meta.keywords || []).map(String);
    return { ...meta, slug, sources, keywords, legacy_items: legacy, prepare: meta.prepare || [], _file: f, _body: body, ...renderHelp(body) };
  });
  // 跨文章連結：內文寫 [[slug]]，建置時換成〈文章標題〉連結；找不到的 slug 記為錯誤
  const bySlug = new Map(list.map(a => [a.slug, a]));
  for (const a of list) {
    a.links = [];
    a.html = a.html.replace(/\u0001([a-z0-9-]+)\u0001/g, (m, slug) => {
      const t = bySlug.get(slug);
      a.links.push(slug);
      if (!t) { a.errors.push(`找不到連結的文章 [[${slug}]]`); return slug; }
      return `<a href="${helpUrl(t)}">〈${esc(t.title)}〉</a>`;
    });
    // 站內 /help/ 連結也要指到存在的文章
    for (const m of a.html.matchAll(/href="\/help\/([a-z0-9-]+)\/"/g)) if (!bySlug.has(m[1])) a.errors.push(`站內連結 /help/${m[1]}/ 不存在`);
    // 全文搜尋用的純文字（標題、摘要、分類、關鍵字、內文）
    a.searchText = [a.title, a.summary, a.category, ...a.keywords, a.html.replace(/<[^>]+>/g, ' ')].join(' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return list;
}

// 驗證：缺欄位、沒有「怎樣算修好」、沒有來源、待辦標記、圖片不存在都不能公開
export function validateHelp(list) {
  const errors = [];
  const seen = new Set(), legacySeen = new Map();
  for (const a of list) {
    const where = `help/${a._file}`;
    if (!SLUG.test(a.slug)) errors.push(`${where}: slug 只能是小寫英數與 -（${a.slug}）`);
    if (seen.has(a.slug)) errors.push(`${where}: slug 重複 ${a.slug}`);
    seen.add(a.slug);
    if (typeof a.published !== 'boolean') errors.push(`${where}: published 必須是 true 或 false`);
    for (const e of a.errors) errors.push(`${where}: ${e}`);
    if (!a.published) continue;
    for (const k of ['title', 'summary', 'category', 'level', 'applies', 'verified']) if (!a[k]) errors.push(`${where}: 缺少 ${k}`);
    // 版本與驗證：「宣稱適用」和「已核對／實機驗證」要分開寫，不能讓讀者以為每個版本都測過
    if (!a.checked) errors.push(`${where}: 缺少 checked（實際核對過哪些版本的原始碼或文件）`);
    if (!a.hw_verified) errors.push(`${where}: 缺少 hw_verified（沒有實機驗證就寫「尚未實機驗證」）`);
    if (a.hw_verified && !/^尚未實機驗證$/.test(a.hw_verified) && !/(照片|影片|錄影|紀錄)/.test(a.hw_verified)) errors.push(`${where}: hw_verified 只能寫「尚未實機驗證」，或寫明有哪些實機照片、影片或紀錄`);
    if (/Betaflight/.test(a.applies || '') && a.checked && !/(原始碼|官方文件)/.test(a.checked)) errors.push(`${where}: Betaflight 文章的 checked 要寫明核對了哪些版本的原始碼或官方文件`);
    if (a.category && !HELP_CATEGORIES.includes(a.category)) errors.push(`${where}: category 必須是 ${HELP_CATEGORIES.join('、')} 其中之一`);
    if (a.level && !HELP_LEVELS[a.level]) errors.push(`${where}: level 必須是 beginner 或 intermediate`);
    if (a.verified && !DATE.test(a.verified)) errors.push(`${where}: verified 格式必須是 YYYY-MM-DD`);
    if (a.verified && DATE.test(a.verified) && a.verified > today()) errors.push(`${where}: verified 不能是未來日期（${a.verified}）`);
    if (!a.keywords.length) errors.push(`${where}: 至少要有一個 keywords（玩家會搜尋的別名、英文或錯誤代碼）`);
    if (!a.checks) errors.push(`${where}: 必須有 :::checks「怎樣算修好」區塊`);
    if (!a.hasStop) errors.push(`${where}: 必須有 :::stop「什麼時候停手」區塊`);
    if (!a.prepare.length) errors.push(`${where}: 缺少 prepare（送修前要準備的資料）`);
    if (!a.sources.length) errors.push(`${where}: 至少要有一個 sources 來源`);
    for (const s of a.sources) if (!s.title || !/^https:\/\//.test(s.url || '')) errors.push(`${where}: 來源格式必須是「標題 | https://網址」`);
    for (const t of a.tools) if (!HELP_TOOLS.includes(t)) errors.push(`${where}: 不認得的互動工具 ${t}`);
    for (const n of a.legacy_items) {
      if (!Number.isInteger(n) || n < 0) errors.push(`${where}: legacy_items 必須是舊知識庫的題號數字`);
      if (legacySeen.has(n)) errors.push(`${where}: 舊題號 ${n} 已對應到 ${legacySeen.get(n)}`);
      legacySeen.set(n, a.slug);
    }
    for (const img of a.images) {
      if (!img.src.startsWith(HELP_IMG) || img.src.includes('..')) errors.push(`${where}: 圖片必須放在 ${HELP_IMG}（${img.src}）`);
      else if (!fs.existsSync(path.join(ROOT, img.src.replace(/^\//, '')))) errors.push(`${where}: 圖片不存在 ${img.src}`);
      if (!img.alt) errors.push(`${where}: 圖片缺少說明文字 ${img.src}`);
    }
    if (/〔待|TODO|待確認|待補/.test(a._body)) errors.push(`${where}: 內文還有待確認標記，請處理後再公開`);
    if (/確認[^。，\n]{0,12}正確/.test(a._body)) errors.push(`${where}: 不要寫「確認○○正確」，請改寫成「正確時畫面會是什麼樣子」`);
  }
  return errors;
}
