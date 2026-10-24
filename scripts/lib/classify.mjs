// 新商品自動分類與品牌判斷：以現有已整理好的商品為範例（相似度投票），再以少數明確規則補強。
// 純函式、無外部套件。判斷不夠有把握時回傳 null，由 EWP 在後台手動選擇。

// ---------- 斷詞：英數字詞＋中文雙字詞 ----------
const NORMALIZE = [
  [/(\d+(?:\.\d+)?)\s*mah\b/gi, ' $1mah mah '],
  [/(\d)\s*s(\d)?p\b/gi, ' $1s '],
  [/\b(\d)\s*s\b/gi, ' $1s '],
  [/(\d+)\s*kv\b/gi, ' kv '],
  [/(\d+)\s*c\b/gi, ' c-rate '],
  [/(\d+)\s*mm\b/gi, ' mm '],
  [/(\d+)\s*tvl\b/gi, ' tvl '],
  [/(\d+(?:\.\d+)?)\s*g\b/gi, ' '],
];
export function tokens(text) {
  let t = String(text || '').toLowerCase();
  for (const [re, rep] of NORMALIZE) t = t.replace(re, rep);
  const out = [];
  for (const m of t.matchAll(/[a-z][a-z0-9.+-]*|\d+[a-z][a-z0-9]*/g)) {
    const w = m[0].replace(/[.+-]+$/, '');
    if (w.length >= 2 || /^\ds$/.test(w)) out.push(w);
  }
  for (const run of t.match(/[一-鿿]+/g) || []) {
    if (run.length === 1) out.push(run);
    for (let i = 0; i < run.length - 1; i++) out.push(run.slice(i, i + 2));
  }
  return out;
}

const textOf = p => [p.name_zh, p.name_zh, p.manufacturer_model, (p.tags || []).join(' '), p.short_description].filter(Boolean).join(' ');

// ---------- 明確規則（只在非常確定時使用；依序比對，先命中者優先）----------
// 商品名稱第一段（第一個「｜」之前，h）通常就是商品種類；配件、列印件的判斷看整個名稱（f），
// 因為「3D 列印」「TPU」常寫在後段。順序很重要：整機 → 機架 → 配件／列印件 → 各種零件。
const ACCESSORY = /3D\s*列印|列印件|列印配件|列印機架|(?<![A-Za-z])(TPU|PETG|PLA)(?![A-Za-z])|收納盒|收納包|硬殼|保護罩|保護殼|保護套|保護框|保護蓋|支架|固定座|安裝座|機臂座|天線座|機罩|腳墊|改裝件|改裝配件|撥桿套|搖桿套|換色外殼|展示架|彈射底座|固定夾/i;
function droneSize(name) {
  const m = name.match(/(\d+(?:\.\d)?)\s*(吋|寸|inch|")/i);
  if (m) {
    const n = Number(m[1]);
    if (n < 2.5) return 'micro';
    if (n < 3) return '2-5in';
    if (n < 4) return '3-3-5in';
    if (n >= 4.5 && n < 6) return '5in';
    if (n >= 7 && n < 8) return '7in-long-range';
    return 'other-sizes';
  }
  if (/whoop|牙籤機|tiny|(?<![0-9])(65|75)\s*mm|(?<![0-9])1s(?![0-9a-z])/i.test(name)) return 'micro';
  return null;
}
// 名稱中代表「零件、工具」的字：出現時就不是整機
const PART = /機架|機臂|零件|配件|列印|收納|保護|外殼|腳墊|頂罩|電池|鋰電|馬達|電機|槳|充電|攝影機|攝像頭|圖傳|天線|螺絲|螺母|扳手|線|接收機|遙控器|眼鏡|飛控|電調|(?<![a-z])(aio|gps)(?![a-z])|模組|工具|鑷子|夾|架|座|盒/i;
const RULES = [
  // 整機：名稱第一段寫穿越機、而且有尺寸（或到手飛、BNF），且不含零件字
  [(h) => /穿越機|到手飛|BNF|PNP|套機|cinewhoop|航拍機|遠航機/i.test(h) && !PART.test(h) && (droneSize(h) || /到手飛|BNF|PNP|套機/i.test(h)), (h) => ['complete-drones', droneSize(h) || 'other-sizes']],
  [(h) => /機架/.test(h) && !ACCESSORY.test(h), () => ['frames-parts', 'frames']],
  [(h, f) => /綁帶|魔鬼氈/.test(h) || (/綁帶/.test(f) && !ACCESSORY.test(f)), () => ['hardware-prints', 'straps']],
  [(h, f) => ACCESSORY.test(f), (h, f) => ['hardware-prints', /收納盒|收納包|硬殼|(?<![a-z])盒/i.test(f) ? 'cases' : 'tpu-prints']],
  [(h) => /機臂/.test(h), () => ['frames-parts', 'arms']],
  [(h) => /起子|扳手|套筒/.test(h), () => ['tools', 'drivers-wrenches']],
  [(h) => /螺母|螺帽|墊片|華司/.test(h), () => ['hardware-prints', 'nuts-washers']],
  [(h) => /工作台|收納板|零件盒/.test(h), () => ['tools', 'organizers']],
  [(h) => /螺絲(?!起子)/.test(h), () => ['hardware-prints', 'screws']],
  [(h) => /海綿|清潔|銅絲球/.test(h), () => ['tools', 'cleaning']],
  [(h) => /焊錫|烙鐵|助焊|吸錫|焊台|焊接|鑷子/.test(h), () => ['tools', 'soldering']],
  [(h) => /排線|同軸線/.test(h), () => ['video', 'video-cables']],
  [(h) => /充電器|charger|平衡充|充電站/i.test(h), () => ['power-battery', 'chargers']],
  [(h) => /電源線|連接線|延長線|轉接線|充電線|矽膠線|線束/.test(h), () => ['electronics', 'wires']],
  [(h) => /熱縮/.test(h), () => ['electronics', 'heat-shrink']],
  [(h) => /電容/.test(h), () => ['electronics', 'capacitors']],
  [(h) => /電量顯示|蜂鳴|警報器|BB響/i.test(h), () => ['electronics', 'modules']],
  [(h) => /降壓|快充模組|(?<![a-z])bec(?![a-z])|電源模組/i.test(h), () => ['power-battery', 'power-modules']],
  [(h) => /外場電包|行動電源/.test(h), () => ['power-battery', 'field-packs']],
  [(h) => /(lipo|li-?ion|鋰電|鋰聚|電池)/i.test(h), (h, f) => {
    const s = (f.match(/(?<![0-9])([1-6])\s*s(?:\d+p)?(?![0-9a-z])/i) || [])[1];
    if (/21700/.test(f) && !s) return ['power-battery', '21700'];
    if (/18650/.test(f) && !s) return ['power-battery', '18650'];
    return s === '6' ? ['power-battery', '6s'] : s === '4' ? ['power-battery', '4s'] : s && Number(s) <= 3 ? ['power-battery', '1s-micro'] : null;
  }],
  [(h) => /螺旋槳|槳葉|三葉槳|雙葉槳|(?<![a-z])props?(?![a-z])/i.test(h), () => ['motors-props', 'props']],
  [(h) => /無刷馬達|無刷電機|(?<![0-9])\d{4}(?:\.\d)?\s*[\s\S]{0,20}?\d{3,5}\s*kv/i.test(h), () => ['motors-props', 'motors']],
  [(h) => /遙控器/.test(h), () => ['radio-gps', 'radios']],
  [(h) => /接收機|(?<![a-z])rx(?![a-z])/i.test(h), () => ['radio-gps', 'receivers']],
  [(h) => /crossfire/i.test(h) && /高頻頭|(?<![a-z])tx(?![a-z])/i.test(h), () => ['radio-gps', 'crossfire']],
  [(h) => /高頻頭/.test(h), () => ['radio-gps', 'elrs']],
  [(h) => /(?<![a-z])gps(?![a-z])/i.test(h), () => ['radio-gps', 'gps']],
  [(h) => /(915|868|2\.4g?)[\s\S]*天線/i.test(h), () => ['radio-gps', 'rc-antennas']],
  [(h) => /天線/.test(h), () => ['video', 'antennas']],
  [(h) => /眼鏡|goggles/i.test(h), () => ['video', 'goggles']],
  [(h) => /飛塔|堆疊|stack/i.test(h), () => ['fc-esc', 'stacks']],
  [(h) => /(?<![a-z])aio(?![a-z])/i.test(h), () => ['fc-esc', 'aio']],
  [(h) => /電調|(?<![a-z])esc(?![a-z])/i.test(h), () => ['fc-esc', 'esc']],
  [(h) => /飛控|flight controller/i.test(h), () => ['fc-esc', 'fc']],
  [(h) => /類比圖傳|模擬圖傳/i.test(h), () => ['video', 'analog-vtx']],
  [(h) => /攝影機|攝像頭/.test(h), () => ['video', 'cameras']],
  [(h) => /(?<![a-z])(xt30|xt60|xt90)(?![a-z])[\s\S]*(接頭|插頭)|接頭|插頭/i.test(h), () => ['electronics', 'connectors']],
];
export function ruleCategory(name) {
  const f = String(name || '');
  const h = f.split(/[｜|]/)[0];
  for (const [test, pick] of RULES) {
    if (!test(h, f)) continue;
    const r = pick(h, f);
    if (r) return { primary_category_id: r[0], subcategory_id: r[1] || null };
  }
  return null;
}

// ---------- 相似度投票 ----------
export function buildIndex(examples) {
  const docs = examples.filter(p => p.primary_category_id).map(p => ({ cat: p.primary_category_id, sub: p.subcategory_id || null, tf: count(tokens(textOf(p))) }));
  const df = new Map();
  for (const d of docs) for (const w of d.tf.keys()) df.set(w, (df.get(w) || 0) + 1);
  const idf = w => Math.log((docs.length + 1) / ((df.get(w) || 0) + 1)) + 1;
  for (const d of docs) d.vec = weigh(d.tf, idf);
  return { docs, idf };
}
function count(ts) { const m = new Map(); for (const t of ts) m.set(t, (m.get(t) || 0) + 1); return m; }
function weigh(tf, idf) {
  const v = new Map(); let n = 0;
  for (const [w, c] of tf) { const x = (1 + Math.log(c)) * idf(w); v.set(w, x); n += x * x; }
  n = Math.sqrt(n) || 1;
  for (const [w, x] of v) v.set(w, x / n);
  return v;
}
function cosine(a, b) { let s = 0; for (const [w, x] of a) { const y = b.get(w); if (y) s += x * y; } return s; }

export function similarCategory(index, text, { k = 5, minScore = 0.25, minShare = 0.6 } = {}) {
  const q = weigh(count(tokens(text)), index.idf);
  if (!q.size) return null;
  const top = index.docs.map(d => ({ d, s: cosine(q, d.vec) })).sort((a, b) => b.s - a.s).slice(0, k).filter(x => x.s > 0);
  if (!top.length || top[0].s < minScore) return null;
  const vote = (key) => {
    const m = new Map();
    for (const { d, s } of top) { const v = key(d); if (v) m.set(v, (m.get(v) || 0) + s); }
    const total = top.reduce((a, x) => a + x.s, 0);
    const [best, w] = [...m].sort((a, b) => b[1] - a[1])[0] || [];
    return best && w / total >= minShare ? best : null;
  };
  const cat = vote(d => d.cat);
  if (!cat) return null;
  const sub = vote(d => (d.cat === cat ? `${d.cat}/${d.sub}` : null));
  return { primary_category_id: cat, subcategory_id: sub && !sub.endsWith('/null') ? sub.split('/')[1] : null, score: Number(top[0].s.toFixed(2)) };
}

// 規則優先；規則沒有命中時用相似商品投票。都沒有把握就回傳 null。
export function classify(product, examples, categories) {
  const valid = (c, s) => { const cat = categories.find(x => x.id === c); return cat && (!s || cat.subcategories.some(x => x.id === s)); };
  const r = ruleCategory(product.name_zh);
  if (r && valid(r.primary_category_id, r.subcategory_id)) return { ...r, method: '名稱關鍵字' };
  const s = similarCategory(buildIndex(examples), textOf(product));
  if (s && valid(s.primary_category_id, s.subcategory_id)) return { ...s, method: '相似商品' };
  return null;
}

// ---------- 品牌 ----------
// 以現有商品使用過的品牌為清單，而且品牌名稱必須寫在商品名稱「最前面」才填入。
// 配件名稱常寫「適用 BETAFPV／DJI」，寫在後面的品牌是相容對象，不是製造商，所以不判斷。
// 「電翼動力」常出現在其他品牌商品的標題（賣場名稱），不自動判定為 EWP 品牌。
const NOT_AUTO = /電翼動力|EWP|^DJI$/; // DJI 名稱多半是「適用 DJI」的副廠配件
export function brandAliases(brand) {
  const parts = String(brand).split(/[\s×]+/).filter(Boolean);
  const out = new Set();
  const en = parts.filter(x => /[A-Za-z]/.test(x)).join(' ');
  if (en) out.add(en.toLowerCase());
  for (const x of parts) if (/[一-鿿]{2,}/.test(x)) out.add(x);
  for (const x of parts) if (/[A-Za-z]{3,}/.test(x)) out.add(x.toLowerCase());
  return [...out];
}
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function detectBrand(name, knownBrands) {
  const n = String(name || '').trim().replace(/^[【\[]\s*/, '').toLowerCase();
  if (ACCESSORY.test(name || '')) return null;
  const hits = new Set();
  for (const b of new Set(knownBrands.filter(Boolean))) {
    if (NOT_AUTO.test(b)) continue;
    for (const a of brandAliases(b)) {
      const re = new RegExp(`^${esc(a).replace(/\s+/g, '[\\s-]*')}(?![a-z0-9])`, 'i');
      if (re.test(n)) { hits.add(b); break; }
    }
  }
  return hits.size === 1 ? [...hits][0] : null;
}
