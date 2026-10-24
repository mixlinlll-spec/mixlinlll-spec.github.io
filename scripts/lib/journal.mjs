// EWP 專欄（原「最新消息」，EWP Journal）：src/data/journal/<slug>.md，一篇文章一個檔案。
// 檔案開頭為 frontmatter（--- 之間的 key: value），內文為精簡 Markdown：
//   ## 小標、段落、空行分段、- 項目清單、> 提醒框、**粗體**、[文字](連結)、![替代文字](/assets/img/journal/<slug>/xx.webp)
// 內文不接受 HTML（一律轉義），避免文章內容破壞版面或插入腳本。影片只放 YouTube（youtube_id），不把影片檔放進 repo。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './data.mjs';
import { esc, attr } from './html.mjs';

export const JOURNAL_DIR = path.join(ROOT, 'src', 'data', 'journal');
export const JOURNAL_IMG = '/assets/img/journal/';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const YT = /^[A-Za-z0-9_-]{11}$/;

export function parseFrontmatter(text) {
  const src = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  let listKey = null;
  for (const line of m[1].split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const item = line.match(/^\s+-\s*(.*)$/);
    if (item && listKey) { meta[listKey].push(unquote(item[1])); continue; }
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const [, k, v] = kv;
    if (v === '') { meta[k] = []; listKey = k; } else { meta[k] = unquote(v); listKey = null; }
  }
  for (const [k, v] of Object.entries(meta)) {
    if (v === 'true') meta[k] = true; else if (v === 'false') meta[k] = false;
    else if (Array.isArray(v) && !v.length) meta[k] = null;
  }
  return { meta, body: m[2] };
}
const unquote = s => s.trim().replace(/^(['"])(.*)\1$/, '$2');

// 讀取 WebP／PNG／JPEG 的寬高（無外部套件），讓文章圖片帶 width/height，避免載入時版面跳動
export function imageSize(webPath) {
  try {
    const b = fs.readFileSync(path.join(ROOT, webPath.replace(/^\//, '')));
    if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
      const t = b.toString('ascii', 12, 16);
      if (t === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
      if (t === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
      if (t === 'VP8L') { const n = b.readUInt32LE(21); return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 }; }
    }
    if (b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length) { const m = b[i + 1], len = b.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc3) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) }; i += 2 + len; }
    }
  } catch {}
  return null;
}
const dims = src => { const d = imageSize(src); return d ? ` width="${d.w}" height="${d.h}"` : ''; };

// 行內：先轉義，再處理粗體與連結（連結只接受站內路徑、https、mailto）
function inline(s) {
  let out = esc(s);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, text, href) => {
    const h = href.replace(/&amp;/g, '&');
    if (!/^(\/|https:\/\/|mailto:)/.test(h)) return text;
    const ext = /^https:/.test(h) ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${attr(h)}"${ext}>${text}</a>`;
  });
  return out;
}

export function renderMarkdown(body) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const images = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^(#{2,3})\s+(.+)$/))) { const n = m[1].length; out.push(`<h${n}>${inline(m[2])}</h${n}>`); i++; continue; }
    if ((m = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/))) {
      images.push({ src: m[2], alt: m[1] });
      out.push(`<figure class="journal-fig"><img src="${attr(m[2])}" alt="${attr(m[1])}"${dims(m[2])} loading="lazy" decoding="async"></figure>`);
      i++; continue;
    }
    if (/^\s*-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*-\s+/, ''));
      out.push(`<ul>${items.map(t => `<li>${inline(t)}</li>`).join('')}</ul>`); continue;
    }
    if (/^>\s?/.test(line)) {
      const parts = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) parts.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<aside class="callout" role="note"><p>${inline(parts.join(' '))}</p></aside>`); continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|!\[|\s*-\s+|>)/.test(lines[i])) para.push(lines[i++].trim());
    out.push(`<p>${inline(para.join(''))}</p>`);
  }
  return { html: out.join('\n'), images };
}

export function loadJournal() {
  if (!fs.existsSync(JOURNAL_DIR)) return [];
  return fs.readdirSync(JOURNAL_DIR).filter(f => f.endsWith('.md')).sort().map(f => {
    const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(JOURNAL_DIR, f), 'utf8'));
    const slug = meta.slug || f.replace(/\.md$/, '');
    return { ...meta, slug, _file: f, _body: body, ...renderMarkdown(body) };
  });
}

// 驗證：缺少必要欄位、網址格式、圖片不存在、內文殘留待辦標記都會擋下公開
export function validateJournal(posts) {
  const errors = [];
  const seen = new Set();
  const exists = p => fs.existsSync(path.join(ROOT, p.replace(/^\//, '')));
  for (const p of posts) {
    const where = `journal/${p._file}`;
    if (!SLUG.test(p.slug)) errors.push(`${where}: slug 只能是小寫英數與 -（${p.slug}）`);
    if (seen.has(p.slug)) errors.push(`${where}: slug 重複 ${p.slug}`);
    seen.add(p.slug);
    if (typeof p.published !== 'boolean') errors.push(`${where}: published 必須是 true 或 false`);
    if (!p.published) continue;
    for (const k of ['title', 'date', 'category', 'summary', 'cover', 'cover_alt']) if (!p[k]) errors.push(`${where}: 缺少 ${k}`);
    if (p.date && !DATE.test(p.date)) errors.push(`${where}: date 格式必須是 YYYY-MM-DD`);
    if (p.youtube_id && !YT.test(p.youtube_id)) errors.push(`${where}: youtube_id 格式不正確`);
    for (const img of [p.cover && { src: p.cover, alt: p.cover_alt }, ...p.images].filter(Boolean)) {
      if (!img.src.startsWith(JOURNAL_IMG) || img.src.includes('..')) errors.push(`${where}: 圖片必須放在 ${JOURNAL_IMG}（${img.src}）`);
      else if (!exists(img.src)) errors.push(`${where}: 圖片不存在 ${img.src}`);
      if (!img.alt) errors.push(`${where}: 圖片缺少替代文字 ${img.src}`);
    }
    if (/〔待|TODO|待確認/.test(p._body)) errors.push(`${where}: 內文還有待確認標記，請處理後再公開`);
  }
  return errors;
}

export const journalUrl = p => `/journal/${p.slug}/`;
export const formatDate = d => d ? d.replace(/-/g, '.') : '';
