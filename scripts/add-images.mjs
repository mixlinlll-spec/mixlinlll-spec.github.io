#!/usr/bin/env node
// 商品圖片整理：把 EWP 自有或已授權的照片壓縮成網站用 WebP，並寫入商品資料。
//
// 1. 照片放到 media-inbox/<商品 id>/（此資料夾不提交、不發布），例如 media-inbox/sp-42781322918/01.jpg
// 2. npm install（第一次）
// 3. node scripts/add-images.mjs sp-42781322918 --rights ewp_own --alt "SIRIUS 2306.5 馬達正面"
//    --rights：ewp_own（EWP 自己拍攝／製作）或 licensed（已取得授權）。沒有使用權的圖片不要放進來。
//    --alt：圖片說明（每張會自動加上序號）；建議之後在 JSON 中逐張改成更精確的描述。
//    --replace：取代該商品現有圖片（預設為附加）
// 輸出：assets/img/products/<id>/<n>.webp（長邊 1200px）與 <n>-600.webp（長邊 600px），品質 80。
// 不會更動商品的價格、供貨、published 等其他欄位。
//
// 自我測試（CI 使用）：node scripts/add-images.mjs --self-test
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, PRODUCTS_DIR, IMAGE_RIGHTS, readJSON, writeJSON } from './lib/data.mjs';

const IN_EXT = /\.(jpe?g|png|webp|avif|heic|tiff?)$/i;

export async function processFolder(sharp, inDir, outDir, publicPrefix, startIndex = 1) {
  const files = fs.readdirSync(inDir).filter(f => IN_EXT.test(f)).sort();
  if (!files.length) throw new Error(`${inDir} 沒有圖片檔`);
  fs.mkdirSync(outDir, { recursive: true });
  const out = [];
  for (const [i, f] of files.entries()) {
    const n = String(startIndex + i).padStart(2, '0');
    const src = sharp(path.join(inDir, f)).rotate(); // 依 EXIF 轉正
    const meta = await src.metadata();
    const big = await src.clone().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(outDir, `${n}.webp`));
    await src.clone().resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(outDir, `${n}-600.webp`));
    out.push({ file: f, n, width: big.width, height: big.height, square: Math.abs(big.width - big.height) <= 2, src: `${publicPrefix}/${n}.webp`, src_small: `${publicPrefix}/${n}-600.webp`, originalBytes: fs.statSync(path.join(inDir, f)).size, bytes: big.size, orig: `${meta.width}×${meta.height}` });
  }
  return out;
}

async function loadSharp() {
  try { return (await import('sharp')).default; }
  catch { console.error('✖ 需要 sharp 套件：請先在專案資料夾執行 npm install'); process.exit(1); }
}

const args = process.argv.slice(2);
const sharp = await loadSharp();

if (args.includes('--self-test')) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ewp-img-'));
  const inDir = path.join(tmp, 'in'); fs.mkdirSync(inDir);
  await sharp({ create: { width: 2400, height: 1800, channels: 3, background: '#ff4a3d' } }).jpeg().toFile(path.join(inDir, 'a.jpg'));
  await sharp({ create: { width: 800, height: 800, channels: 3, background: '#101113' } }).png().toFile(path.join(inDir, 'b.png'));
  const r = await processFolder(sharp, inDir, path.join(tmp, 'out'), '/assets/img/products/test');
  const ok = r.length === 2 && r[0].width === 1200 && r[0].height === 900 && r[1].width === 800 && r[1].square
    && fs.existsSync(path.join(tmp, 'out', '01-600.webp')) && fs.existsSync(path.join(tmp, 'out', '02.webp'));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(ok ? '✓ 圖片處理自我測試通過（縮圖、WebP、不放大小圖）' : '✖ 圖片處理自我測試失敗', JSON.stringify(r.map(x => [x.width, x.height])));
  process.exit(ok ? 0 : 1);
}

const id = args.find(a => !a.startsWith('--') && !['--rights', '--alt'].includes(args[args.indexOf(a) - 1]));
const opt = k => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const rights = opt('--rights');
const alt = opt('--alt');
if (!id || !rights || !alt) { console.error('用法：node scripts/add-images.mjs <商品 id> --rights ewp_own|licensed --alt "圖片說明" [--replace]'); process.exit(1); }
if (!IMAGE_RIGHTS[rights]) { console.error(`✖ --rights 只能是 ${Object.keys(IMAGE_RIGHTS).join(' 或 ')}`); process.exit(1); }
const file = path.join(PRODUCTS_DIR, `${id}.json`);
if (!fs.existsSync(file)) { console.error(`✖ 找不到商品 ${id}`); process.exit(1); }
const inDir = path.join(ROOT, 'media-inbox', id);
if (!fs.existsSync(inDir)) { console.error(`✖ 找不到 ${path.relative(ROOT, inDir)}，請先把照片放進去`); process.exit(1); }

const product = readJSON(file);
const replace = args.includes('--replace');
const outDir = path.join(ROOT, 'assets', 'img', 'products', id);
if (replace) fs.rmSync(outDir, { recursive: true, force: true });
const start = replace ? 1 : (product.images?.length || 0) + 1;
const res = await processFolder(sharp, inDir, outDir, `/assets/img/products/${id}`, start);
const entries = res.map((r, i) => ({ src: r.src, src_small: r.src_small, alt: res.length > 1 ? `${alt}（${start + i}）` : alt, width: r.width, height: r.height, rights }));
product.images = replace ? entries : [...(product.images || []), ...entries];
writeJSON(file, product);
for (const r of res) console.log(`✓ ${r.file} ${r.orig} ${(r.originalBytes / 1024).toFixed(0)}KB → ${r.src} ${r.width}×${r.height} ${(r.bytes / 1024).toFixed(0)}KB${r.square ? '' : '（非 1:1，列表會裁切顯示）'}`);
console.log(`完成：${id} 共 ${product.images.length} 張圖片。請檢查 alt 文字後執行 node scripts/build.mjs --drafts 預覽。`);
