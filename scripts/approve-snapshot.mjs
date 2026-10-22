#!/usr/bin/env node
// 把「已核對」的蝦皮快照套用到商品公開欄位。只有加上 --publish 才會核准上架。
//
//   node scripts/approve-snapshot.mjs <商品 id…>|--all [選項] [--dry-run]
//     --prices             以快照價格填入 variants[].price_twd 與商品 price_twd／price_display（單一價＝fixed，多價＝from 最低價）
//     --stock              以快照庫存填入 availability（>0 現貨、=0 暫無供貨）
//     --image-rights R     把 rights=unverified 的圖片改為 R（ewp_own＝EWP 自有／licensed＝已取得授權）
//     --discount N         官網價 = 蝦皮快照價 ×（1 − N%），四捨五入到整數元（例：--discount 4）
//     --publish            同時設定 review.status = "approved"、published = true（EWP 明確核准上架時才使用）
// review.status = rejected 的商品一律略過。
// 範例：node scripts/approve-snapshot.mjs --all --prices --stock --discount 4 --image-rights licensed --publish --dry-run
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, PRODUCTS_DIR, IMAGE_RIGHTS, readJSON, writeJSON, today } from './lib/data.mjs';

const args = process.argv.slice(2);
const has = k => args.includes(k);
const val = k => (has(k) ? args[args.indexOf(k) + 1] : undefined);
const rights = val('--image-rights');
if (rights && !IMAGE_RIGHTS[rights]) { console.error(`✖ --image-rights 只能是 ${Object.keys(IMAGE_RIGHTS).join('／')}`); process.exit(1); }
if (!has('--prices') && !has('--stock') && !rights && !has('--publish')) { console.error('請至少指定 --prices、--stock、--image-rights 或 --publish 其中一項'); process.exit(1); }
const discount = Number(val('--discount') || 0);
if (!(discount >= 0 && discount < 50)) { console.error('✖ --discount 必須是 0–50 之間的百分比'); process.exit(1); }
const sitePrice = x => Math.round(x * (1 - discount / 100));

let ids;
if (has('--all')) ids = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));

else ids = args.filter((a, i) => a.startsWith('sp-') || (!a.startsWith('--') && args[i - 1] !== '--image-rights' && args[i - 1] !== '--discount'));
if (!ids.length) { console.error('請指定商品 id 或 --all'); process.exit(1); }

let changed = 0;
for (const id of ids) {
  const file = path.join(PRODUCTS_DIR, `${id}.json`);
  if (!fs.existsSync(file)) { console.error(`略過：找不到 ${id}`); continue; }
  const p = readJSON(file);
  if (p.review?.status === 'rejected') { console.log(`略過：${id} 為 rejected（不上官網）`); continue; }
  const snap = p.review?.shopee_sales_snapshot;
  const log = [];
  if ((has('--prices') || has('--stock')) && !snap?.rows?.length) { console.error(`略過價格／庫存：${id} 沒有蝦皮快照`); }
  else {
    const rowFor = v => snap.rows.find(r => r.variation_id && r.variation_id === v.shopee_variation_id);
    if (has('--prices')) {
      for (const v of p.variants || []) { const r = rowFor(v); if (r?.price > 0) v.price_twd = sitePrice(r.price); }
      const prices = snap.rows.map(r => r.price).filter(x => x > 0).map(sitePrice);
      if (prices.length) {
        const min = Math.min(...prices), max = Math.max(...prices);
        p.price_twd = min; p.price_display = min === max ? 'fixed' : 'from';
        log.push(`價格 ${min === max ? `NT$${min}` : `NT$${min} 起`}${discount ? `（蝦皮價 −${discount}%）` : ''}`);
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
    if (has('--prices')) snap.discount_percent = discount;
  }
  if (rights) {
    let n = 0;
    for (const img of p.images || []) if (img.rights === 'unverified') { img.rights = rights; n++; }
    for (const v of p.variants || []) if (v.image?.rights === 'unverified') { v.image.rights = rights; n++; }
    if (n) log.push(`${n} 張圖片使用權 → ${rights}`);
  }
  if (has('--publish')) {
    p.review.status = 'approved'; p.review.approved_at = today(); p.published = true;
    log.push('已核准上架');
  }
  if (log.length) {
    p.updated_at = today(); changed++;
    if (!has('--dry-run')) writeJSON(file, p);
    console.log(`${has('--dry-run') ? '（dry-run）' : '✓'} ${id}：${log.join('；')}`);
  }
}
console.log(`完成：${changed} 件${has('--dry-run') ? '（dry-run，未寫入）' : ''}。${has('--publish') ? '已設定上架。' : 'published 未變更，公開前仍需 review.status = "approved"。'}`);
