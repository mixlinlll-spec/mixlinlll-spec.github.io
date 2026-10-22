#!/usr/bin/env node
// 把「已核對」的蝦皮快照套用到商品公開欄位。不會設定 published，也不會核准上架。
//
//   node scripts/approve-snapshot.mjs <商品 id…>|--batch first|--all [選項] [--dry-run]
//     --prices             以快照價格填入 variants[].price_twd 與商品 price_twd／price_display（單一價＝fixed，多價＝from 最低價）
//     --stock              以快照庫存填入 availability（>0 現貨、=0 暫無供貨）
//     --image-rights R     把 rights=unverified 的圖片改為 R（ewp_own＝EWP 自有／licensed＝已取得授權）
// 範例：node scripts/approve-snapshot.mjs --batch first --prices --stock --image-rights ewp_own --dry-run
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, PRODUCTS_DIR, IMAGE_RIGHTS, readJSON, writeJSON, today } from './lib/data.mjs';

const args = process.argv.slice(2);
const has = k => args.includes(k);
const val = k => (has(k) ? args[args.indexOf(k) + 1] : undefined);
const rights = val('--image-rights');
if (rights && !IMAGE_RIGHTS[rights]) { console.error(`✖ --image-rights 只能是 ${Object.keys(IMAGE_RIGHTS).join('／')}`); process.exit(1); }
if (!has('--prices') && !has('--stock') && !rights) { console.error('請至少指定 --prices、--stock 或 --image-rights 其中一項'); process.exit(1); }

let ids;
if (has('--all')) ids = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
else if (val('--batch') === 'first') ids = readJSON(path.join(DATA_DIR, 'first-batch.json')).items.map(i => i.id);
else ids = args.filter((a, i) => a.startsWith('sp-') || (!a.startsWith('--') && args[i - 1] !== '--image-rights' && args[i - 1] !== '--batch'));
if (!ids.length) { console.error('請指定商品 id、--batch first 或 --all'); process.exit(1); }

let changed = 0;
for (const id of ids) {
  const file = path.join(PRODUCTS_DIR, `${id}.json`);
  if (!fs.existsSync(file)) { console.error(`略過：找不到 ${id}`); continue; }
  const p = readJSON(file);
  const snap = p.review?.shopee_sales_snapshot;
  const log = [];
  if ((has('--prices') || has('--stock')) && !snap?.rows?.length) { console.error(`略過價格／庫存：${id} 沒有蝦皮快照`); }
  else {
    const rowFor = v => snap.rows.find(r => r.variation_id && r.variation_id === v.shopee_variation_id);
    if (has('--prices')) {
      for (const v of p.variants || []) { const r = rowFor(v); if (r?.price > 0) v.price_twd = r.price; }
      const prices = snap.rows.map(r => r.price).filter(x => x > 0);
      if (prices.length) {
        const min = Math.min(...prices), max = Math.max(...prices);
        p.price_twd = min; p.price_display = min === max ? 'fixed' : 'from';
        log.push(`價格 ${min === max ? `NT$${min}` : `NT$${min} 起`}`);
      }
    }
    if (has('--stock')) {
      for (const v of p.variants || []) { const r = rowFor(v); if (r && r.stock != null) v.availability = r.stock > 0 ? 'in_stock' : 'out_of_stock'; }
      p.availability = snap.stock_total > 0 ? 'in_stock' : 'out_of_stock';
      log.push(`庫存 ${snap.stock_total}`);
    }
    snap.status = 'applied';
    snap.applied_at = today();
    snap.applied = [has('--prices') && 'prices', has('--stock') && 'stock'].filter(Boolean);
  }
  if (rights) {
    let n = 0;
    for (const img of p.images || []) if (img.rights === 'unverified') { img.rights = rights; n++; }
    for (const v of p.variants || []) if (v.image?.rights === 'unverified') { v.image.rights = rights; n++; }
    if (n) log.push(`${n} 張圖片使用權 → ${rights}`);
  }
  if (log.length) {
    p.updated_at = today(); changed++;
    if (!has('--dry-run')) writeJSON(file, p);
    console.log(`${has('--dry-run') ? '（dry-run）' : '✓'} ${id}：${log.join('；')}`);
  }
}
console.log(`完成：${changed} 件${has('--dry-run') ? '（dry-run，未寫入）' : ''}。published 未變更，公開前仍需 review.status = "approved"。`);
