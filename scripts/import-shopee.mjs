#!/usr/bin/env node
// 把蝦皮「大量更新 基本資訊」匯出檔（另存為 CSV UTF-8）轉成商品草稿。
// 用法：node scripts/import-shopee.mjs <shopee.csv> [--dry-run]
//
// 規則：
// - 只建立「新」草稿；src/data/products/ 已存在的商品一律不覆寫。
// - 所有草稿 published=false、price_twd=null、availability=unknown。
// - 分類、品牌、尺寸為自動判斷，寫在 review.notes 提醒 EWP 逐項核對。
// - 描述中的蝦皮圖片網址只保存在 review.source_image_urls，不會在網站上顯示。
import fs from 'node:fs';
import path from 'node:path';
import { PRODUCTS_DIR, parseCSVRows, readJSON, writeJSON, slugify, today } from './lib/data.mjs';

const [, , input, ...flags] = process.argv;
const DRY = flags.includes('--dry-run');
if (!input) { console.error('用法：node scripts/import-shopee.mjs <shopee.csv> [--dry-run]'); process.exit(1); }

const rows = parseCSVRows(fs.readFileSync(input, 'utf8'));
const hi = rows.findIndex(r => r[0]?.trim() === '商品ID');
if (hi < 0) { console.error('找不到「商品ID」標題列，請確認是蝦皮大量更新基本資訊匯出檔'); process.exit(1); }
const H = rows[hi].map(h => h.trim());
const col = name => H.indexOf(name);
const items = rows.slice(hi + 1).map(r => ({
  id: r[col('商品ID')]?.trim(), sku: r[col('主商品貨號')]?.trim(), name: r[col('商品名稱')]?.trim(), desc: r[col('商品描述')] ?? '',
})).filter(x => /^\d+$/.test(x.id || ''));

// 服務型蝦皮商品：不建立成實體商品，改由 /services/ 呈現
const SERVICE_LISTINGS = {
  '40032653084': 'repair', '47064080689': 'procurement', '55217887849': '3d-printing', '48004026388': '3d-printing',
};

// 整機與特例：依商品 ID 指定（自動規則難以判斷的項目）
const OVERRIDES = {
  '50367700235': ['complete-drones', '5in', 'ewp_original'],
  '51565415644': ['complete-drones', '2-5in', 'retail', '標題同時出現「2.5吋」與「五吋」，尺寸需核對'],
  '44957562248': ['complete-drones', 'micro', 'retail'],
  '55815784615': ['complete-drones', '5in', 'retail'],
  '44383452523': ['complete-drones', '5in', 'retail'],
  '50117409646': ['complete-drones', 'micro', 'retail'],
  '46059782425': ['complete-drones', '2-5in', 'ewp_original'],
  '55767409373': ['complete-drones', 'micro', 'retail'],
  '45967997179': ['complete-drones', 'other-sizes', 'retail', '6 吋遠航機，是否歸入「7 吋長航」請 EWP 決定'],
  '29295757187': ['complete-drones', '3-3-5in', 'ewp_original'],
  '45755083180': ['complete-drones', '2-5in', 'retail'],
  '50608240693': ['complete-drones', '5in', 'ewp_original'],
  '44561107171': ['complete-drones', '7in-long-range', 'retail'],
  '49561691341': ['complete-drones', '5in', 'ewp_original'],
  '50857844998': ['complete-drones', '5in', 'ewp_original'],
  '49657325933': ['complete-drones', '3-3-5in', 'retail'],
  '48709596818': ['complete-drones', '5in', 'ewp_original'],
  '43033394158': ['complete-drones', 'micro', 'retail'],
  '56302849088': ['hardware-prints', 'tpu-prints', 'ewp_original', '玩具類商品，是否放入官網型錄請 EWP 決定'],
  '58004035504': ['hardware-prints', 'tpu-prints', 'retail', 'RC 車模型配件，是否放入官網型錄請 EWP 決定'],
  '47815059422': ['frames-parts', 'frames', 'ewp_original'],
  '52105308338': ['power-battery', '18650', 'ewp_original'],
  '46751039159': ['power-battery', '6s', 'ewp_original'],
  '26592256245': ['power-battery', 'field-packs', 'ewp_original'],
  '42313648024': ['power-battery', '6s', 'ewp_original'],
  '41864801899': ['power-battery', 'field-packs', 'ewp_original', '標題為電池外殼／供電模組，自製或零售需核對'],
  '53514957903': ['power-battery', '21700', 'ewp_original', '是否為 EWP 自製電池組需核對；「180A」為標示用語，需電芯數據與測試條件佐證'],
  '57303672693': ['power-battery', '1s-micro', 'retail', '十安 × 電翼動力聯名，seller_role 需核對'],
  '55552267337': ['power-battery', '6s', 'retail', '十安 × 電翼動力聯名，seller_role 需核對；標題含「特價／現貨免運」，官網不沿用促銷字樣'],
  '43321578541': ['power-battery', 'chargers', 'retail'],
  '47356765035': ['electronics', 'wires', 'retail'],
  '26244191157': ['power-battery', 'chargers', 'retail'],
  '26192359811': ['electronics', 'modules', 'retail'],
  '55115191356': ['video', null, 'retail', '數位圖傳，非 DJI，子分類待 EWP 決定'],
  '55805767249': ['video', 'video-cables', 'retail'],
  '56065791023': ['radio-gps', 'radios', 'retail'],
  '49753524978': ['radio-gps', 'radios', 'retail', '遙控器搖桿頭配件'],
  '54262021308': ['frames-parts', 'frames', 'retail', 'JeNo 開源機架，自製或零售需核對'],
  '44021640333': ['tools', 'organizers', 'retail'],
  '42922076789': ['tools', 'soldering', 'retail'],
  '56906701420': ['power-battery', null, 'retail', '電池安全配件，子分類待定'],
  '26544249317': ['hardware-prints', 'tpu-prints', 'ewp_original'],
  '54454832512': ['hardware-prints', 'cases', 'retail'],
  '42685311993': ['frames-parts', 'frames', 'retail', '標題含「電翼動力」，自製或零售需核對'],
  '56953562796': ['video', 'dji-o4', 'retail'],
  '51603136116': ['video', 'dji-o4', 'retail', '可能為 EWP 列印件，seller_role 需核對'],
  '46852892700': ['hardware-prints', 'tpu-prints', 'retail', 'GPS 機臂座，seller_role 需核對'],
  '47268009795': ['radio-gps', 'elrs', 'retail'],
  '42384494569': ['video', 'dji-o4', 'retail'],
  '53965800714': ['radio-gps', 'gps', 'retail', '標題含「電翼動力」，品牌需核對'],
};

// 依標題自動分類（第一個符合的規則生效）
const RULES = [
  [/收納盒|收納箱|保護盒|旅行箱|三防箱|機庫|外出箱|充電站硬殼/, 'hardware-prints', 'cases'],
  [/工作台墊|磁吸墊/, 'tools', 'organizers'],
  [/3D\s*列印|3D\s*打印|打印件|列印件|打印配件|打印套件|印件|TPU|碳纖\s*8%|PETG|展示架|壁掛|彈射底座|支架套件|安裝座|掛勾|救援|改裝配件|改裝|配件套組|配件合集|固定件|保護套|保護罩|防撞|外殼|搖桿|撥桿|平板支架|升級零件/, 'hardware-prints', 'tpu-prints'],
  [/綁帶|扎帶|束帶/, 'hardware-prints', 'straps'],
  [/螺絲/, 'hardware-prints', 'screws'],
  [/清潔|海綿|清洗/, 'tools', 'cleaning'],
  [/扳手|板手|起子/, 'tools', 'drivers-wrenches'],
  [/螺母|螺帽|墊片/, 'hardware-prints', 'nuts-washers'],
  [/烙鐵|焊錫|助焊|吸錫|焊接|松香|鑷子/, 'tools', 'soldering'],
  [/碳板|補強板|底板|加強件/, 'frames-parts', 'plates'],
  [/頂罩|上蓋|機罩|Canopy/i, 'frames-parts', 'protection'],
  [/排線|同軸|連接線/, 'video', 'video-cables'],
  [/攝像頭|鏡頭|攝影機|Camera/i, 'video', 'cameras'],
  [/機架/, 'frames-parts', 'frames'],
  [/轉接板/, 'fc-esc', 'mounting'],
  [/電容/, 'electronics', 'capacitors'],
  [/AIO/, 'fc-esc', 'aio'],
  [/堆疊|飛塔|飛控.*電調/, 'fc-esc', 'stacks'],
  [/電調/, 'fc-esc', 'esc'],
  [/調參模組|調參板|燈控板|蜂鳴器|BB響/, 'electronics', 'modules'],
  [/飛控/, 'fc-esc', 'fc'],
  [/(三葉槳|螺旋槳|槳葉)/, 'motors-props', 'props'],
  [/馬達|電機/, 'motors-props', 'motors'],
  [/COB|LED|燈條/, 'electronics', 'led-cob'],
  [/串充板|充電器|充電線|快充/, 'power-battery', 'chargers'],
  [/降壓模組|BEC|電源模組/, 'power-battery', 'power-modules'],
  [/外場電包|行動電源/, 'power-battery', 'field-packs'],
  [/GPS/, 'radio-gps', 'gps'],
  [/接收機/, 'radio-gps', 'receivers'],
  [/Crossfire.*高頻頭|TBS Crossfire/i, 'radio-gps', 'crossfire'],
  [/高頻頭|ELRS/, 'radio-gps', 'elrs'],
  [/遙控器/, 'radio-gps', 'radios'],
  [/天線/, 'video', 'antennas'],
  [/眼鏡|Goggles/i, 'video', 'goggles'],
  [/O4|O3|Air Unit/i, 'video', 'dji-o4'],
  [/模擬圖傳|VTX|圖傳/, 'video', 'analog-vtx'],
  [/電池|鋰電|LiPo|LiHV|Li-?ion/i, 'power-battery', null],
];

const BRANDS = [
  ['GEPRC', /GEPRC|GEPRRC|格普/i], ['BETAFPV', /BETA\s?FPV|BETA Meteor|Meteor\d|Air65|Air75|Pavo20/i], ['SpeedyBee', /SpeedyBee/i],
  ['Axisflying', /Axisflying|酷飛/i], ['iFlight', /iFlight|翼飛/i], ['DJI', /\bDJI\b|大疆/i], ['TBS', /\bTBS\b/i], ['RadioMaster', /RadioMaster/i],
  ['Jumper', /Jumper/i], ['HelloRadio', /HelloRadio/i], ['RUIYI 芮翼', /RUIYI|芮翼/i], ['GEMFAN 乾豐', /GEMFAN|乾豐/i], ['T-MOTOR', /T-?MOTOR/i],
  ['YIFEI 易飛', /YIFEI|易飛/i], ['Sbang', /Sbang/i], ['OVONIC', /OVONIC|歐牌/i], ['MAD', /\bMAD\b/], ['KONKER 空氪', /KONKER|空氪/i],
  ['SIRIUS 天狼星', /SIRIUS|天狼星/i], ['MGC', /\bMGC\b/], ['FDI', /\bFDI\b/], ['DAKE 大科', /DAKE|大科/i], ['RATE 瑞速', /RATE|瑞速/], ['Foxeer', /Foxeer/i],
  ['HSKRC', /HSKRC|HSRC/i], ['AstroRC', /AstroRC/i], ['TJRC 天劍', /TJRC|天劍/i], ['Boslipo 博氏', /Boslipo|博氏/i], ['中航雷波', /中航雷波/],
  ['OrangFPV', /OrangFPV/i], ['HGLRC', /HGLRC/i], ['GREENER 綠林', /綠林|GREENER/i], ['MECHANIC 維修佬', /MECHANIC|維修佬/i], ['HDZERO', /HDZERO/i],
  ['Walksnail', /Walksnail/i], ['北征', /北征/], ['格氏', /格氏/], ['靈雀 Spirit Sparrow', /靈雀|Spirit Sparrow/i], ['十安', /十安/], ['JHE', /JHE42B/],
];

function classify(id, name) {
  if (OVERRIDES[id]) { const [c, s, role, note] = OVERRIDES[id]; return { c, s, role, note, auto: false }; }
  for (const [re, c, s] of RULES) if (re.test(name)) return { c, s, auto: true };
  return { c: 'hardware-prints', s: 'tpu-prints', auto: true, note: '無法自動判斷分類，暫放列印件' };
}

function detectSizes(name) {
  const out = new Set();
  for (const m of name.matchAll(/(\d+(?:\.\d)?)\s*(?:吋|寸)/g)) out.add(`${m[1]} 吋`);
  for (const m of name.matchAll(/五吋/g)) out.add('5 吋');
  for (const m of name.matchAll(/\b(65|75|80|85)\s?mm/gi)) out.add(`${m[1]}mm`);
  return [...out];
}
function detectCells(name) {
  const out = new Set();
  for (const m of name.matchAll(/(?<![0-9A-Za-z])([1-8])S(?![a-zA-Z])/g)) out.add(`${m[1]}S`);
  return [...out].sort();
}
function detectVideo(name) {
  if (/O4/i.test(name)) return 'DJI O4';
  if (/O3/i.test(name)) return 'DJI O3';
  if (/Walksnail/i.test(name)) return 'Walksnail';
  if (/HDZERO/i.test(name)) return 'HDZero';
  if (/類比|模擬|TVL|VR04/.test(name)) return '類比';
  return null;
}
function cleanDescription(desc) {
  const urls = [];
  const lines = desc.replace(/\r/g, '').split('\n').filter(l => {
    const t = l.trim();
    if (/^https?:\/\/\S+$/.test(t)) { urls.push(t); return false; }
    return true;
  });
  return { text: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(), urls };
}

fs.mkdirSync(PRODUCTS_DIR, { recursive: true });
const existing = new Set(fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')));
const usedSlugs = new Set([...existing].map(id => readJSON(path.join(PRODUCTS_DIR, id + '.json')).slug));
let created = 0, skipped = 0, services = 0;

for (const it of items) {
  const pid = `sp-${it.id}`;
  if (SERVICE_LISTINGS[it.id]) { services++; console.log(`服務型商品略過 → /services/ (${SERVICE_LISTINGS[it.id]})：${it.name}`); continue; }
  if (existing.has(pid)) { skipped++; continue; }
  const k = classify(it.id, it.name);
  const isPrint = k.c === 'hardware-prints' && ['tpu-prints', 'cases'].includes(k.s) && !k.role;
  const role = k.role || (isPrint ? 'ewp_original' : (/電翼動力/.test(it.name) && /列印|打印|TPU/.test(it.name) ? 'ewp_original' : 'retail'));
  // 標題含「適用／專用」時，提到的品牌多半是「適用機型」而非商品品牌，不自動帶入
  const forOther = /適用|專用/.test(it.name);
  const brandHit = forOther ? null : BRANDS.find(([, re]) => re.test(it.name));
  const brand = role === 'ewp_original' && !/靈雀|Spirit Sparrow/i.test(it.name) ? '電翼動力 EWP' : (brandHit ? brandHit[0] : null);
  let slug = slugify(it.name, `item-${it.id}`);
  if (usedSlugs.has(slug)) slug = `${slug}-${it.id.slice(-5)}`;
  usedSlugs.add(slug);
  const { text, urls } = cleanDescription(it.desc);
  const notes = ['由蝦皮匯出資料自動建立的草稿：分類、品牌、尺寸皆為自動判斷，公開前請逐項核對'];
  if (k.note) notes.push(k.note);
  if (isPrint || role === 'ewp_original') notes.push('seller_role 自動判為 EWP 自製，請確認');
  if (forOther) notes.push('標題含「適用／專用」：提到的品牌僅表示適用機型，不代表原廠授權；品牌欄位需人工填寫');
  let sub = k.s;
  if (k.c === 'power-battery' && !sub) {
    const cells = detectCells(it.name);
    if (cells.length && cells.every(c => ['1S', '2S', '3S'].includes(c))) sub = '1s-micro';
    else if (cells.length === 1 && cells[0] === '6S') sub = '6s';
    else if (cells.length === 1 && cells[0] === '4S') sub = '4s';
  }
  notes.push('需補：正式商品照片、short_description、規格表、售價策略、供貨狀態');
  const product = {
    id: pid,
    slug,
    name_zh: it.name.replace(/\s{2,}/g, ' '),
    sku: it.sku || null,
    brand,
    manufacturer_model: null,
    seller_role: role,
    primary_category_id: k.c,
    subcategory_id: sub,
    tags: [],
    compatible_sizes: detectSizes(it.name),
    video_system: ['complete-drones', 'video'].includes(k.c) ? detectVideo(it.name) : null,
    battery_cells: ['complete-drones', 'power-battery', 'motors-props'].includes(k.c) ? detectCells(it.name) : [],
    short_description: '',
    description: text,
    specifications: [],
    images: [],
    variants: [],
    price_twd: null,
    price_display: 'inquiry',
    availability: 'unknown',
    shopee_url: null,
    shopee_item_id: it.id,
    line_inquiry_enabled: true,
    featured: false,
    published: false,
    updated_at: today(),
    review: { status: 'draft', source: `shopee-export:${path.basename(input)}`, notes, source_image_urls: urls },
  };
  if (!DRY) writeJSON(path.join(PRODUCTS_DIR, `${pid}.json`), product);
  created++;
}
console.log(`\n完成：新增草稿 ${created}，已存在略過 ${skipped}，服務型略過 ${services}${DRY ? '（dry-run，未寫入）' : ''}`);
