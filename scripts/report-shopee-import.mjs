#!/usr/bin/env node
// 產生蝦皮匯入總表：docs/SHOPEE_IMPORT_REPORT.md 與 docs/shopee-import.csv（UTF-8 BOM，Excel 可開）。
// 依 src/data 自動計算，資料或圖片更新後重新執行；CI 會檢查與資料一致。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DATA_DIR, loadAll, readJSON, AVAILABILITY } from './lib/data.mjs';

const { products, categories } = loadAll();
const services = readJSON(path.join(DATA_DIR, 'shopee', 'service-listings.json'));
const catMap = new Map(categories.map(c => [c.id, c]));
const rows = products.map(p => {
  const rv = p.review || {}, sm = rv.source_media || {}, snap = rv.shopee_sales_snapshot || {};
  const srcImgs = new Set([sm.cover, ...(sm.gallery || [])].filter(Boolean)).size;
  const srcOpt = new Set((sm.options || []).map(o => o.url).filter(Boolean)).size;
  const imgs = (p.images || []).filter(i => i.source_url);
  const optImgs = new Set((p.variants || []).filter(v => v.image).map(v => v.image.src)).size;
  return {
    id: p.id, name: p.name_zh, cat: catMap.get(p.primary_category_id)?.name, status: rv.status === 'rejected' ? '不上官網' : p.published ? '已公開' : '草稿',
    srcImgs, imgs: imgs.length, srcOpt, optImgs,
    rights: imgs.length ? [...new Set(imgs.map(i => i.rights))].join('／') : '',
    variants: (p.variants || []).length, snapRows: (snap.rows || []).length,
    unmatched: (rv.unmatched_option_images || []).join('／'),
    price: snap.price_min == null ? '' : snap.price_min === snap.price_max ? `${snap.price_min}` : `${snap.price_min}–${snap.price_max}`,
    stock: snap.stock_total ?? '', snapStatus: snap.status === 'applied' ? '已套用' : snap.rows ? '僅快照' : '',
    public: p.price_display === 'inquiry' ? '詢價' : `NT$${p.price_twd}${p.price_display === 'from' ? ' 起' : ''}`, avail: AVAILABILITY[p.availability],
  };
});
const sum = k => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
const COLS = [['id', '商品ID'], ['name', '品名'], ['cat', '主分類'], ['status', '狀態'], ['srcImgs', '蝦皮主圖＋細節圖'], ['imgs', '已匯入圖片'], ['srcOpt', '蝦皮規格選項圖'], ['optImgs', '已對應選項圖'], ['rights', '圖片使用權'], ['snapRows', '蝦皮規格列'], ['variants', '網站變體'], ['unmatched', '未對應的選項圖'], ['price', '快照價格'], ['stock', '快照庫存'], ['snapStatus', '快照狀態'], ['public', '網站價格'], ['avail', '網站供貨']];
const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
fs.writeFileSync(path.join(ROOT, 'docs', 'shopee-import.csv'), '﻿' + [COLS.map(c => c[1]).join(','), ...rows.map(r => COLS.map(([k]) => q(r[k])).join(','))].join('\r\n') + '\r\n');
const missingImg = rows.filter(r => r.imgs < r.srcImgs);
const svcRows = Object.values(services.listings).reduce((a, l) => a + l.sales.length, 0);
const md = `# 蝦皮商品匯入總表

> 由 \`node scripts/report-shopee-import.mjs\` 依 \`src/data\` 自動產生；逐件明細（Excel）：[shopee-import.csv](shopee-import.csv)。圖片下載結果見 [MEDIA_IMPORT_REPORT.md](MEDIA_IMPORT_REPORT.md)。

| 項目 | 數量 |
|---|---|
| 蝦皮匯出商品 | ${rows.length + Object.keys(services.listings).length} 件（商品 ${rows.length}、服務型 ${Object.keys(services.listings).length}） |
| 主圖＋細節圖 | 蝦皮 ${sum('srcImgs')} 張（不重複）→ 已匯入 ${sum('imgs')} 張 |
| 規格選項圖 | 蝦皮 ${sum('srcOpt')} 張（不重複）→ 已對應變體 ${sum('optImgs')} 張 |
| 價格／庫存列 | 商品 ${sum('snapRows')} 列＋服務型 ${svcRows} 列＝${sum('snapRows') + svcRows} 列（全部保存為快照） |
| 網站變體 | ${sum('variants')} 筆（對應蝦皮規格 ID） |
| 快照已套用到公開欄位 | ${rows.filter(r => r.snapStatus === '已套用').length} 件 |
| 已公開商品 | ${rows.filter(r => r.status === '已公開').length} 件 |

- 價格與庫存只保存為 \`review.shopee_sales_snapshot\`，網站價格維持「詢價」、供貨維持「請洽詢」，直到 EWP 核對後執行 \`node scripts/approve-snapshot.mjs\`。
- 匯入的圖片皆為 \`rights: "unverified"\`，EWP 確認使用權後用 \`approve-snapshot.mjs --image-rights ewp_own\` 標示；未標示前不能公開，也不會複製到正式網站。
- 服務型商品（維修、代購、3D 列印）的原始資料保存在 \`src/data/shopee/service-listings.json\`。

## 圖片未完整匯入的商品（${missingImg.length} 件）

${missingImg.length ? ['| 商品 | 品名 | 蝦皮 | 已匯入 |', '|---|---|---|---|', ...missingImg.map(r => `| ${r.id} | ${r.name.slice(0, 30)} | ${r.srcImgs} | ${r.imgs} |`)].join('\n') : '無。'}

## 選項圖無法對應到規格的商品

${rows.filter(r => r.unmatched).length ? ['| 商品 | 未對應的選項 |', '|---|---|', ...rows.filter(r => r.unmatched).map(r => `| ${r.id} | ${r.unmatched} |`)].join('\n') : '無。'}
`;
fs.writeFileSync(path.join(ROOT, 'docs', 'SHOPEE_IMPORT_REPORT.md'), md);
console.log(`✓ docs/SHOPEE_IMPORT_REPORT.md、docs/shopee-import.csv（${rows.length} 件）`);
