#!/usr/bin/env node
// 產生首批商品確認表：docs/FIRST_BATCH_REVIEW.md 與 docs/first-batch-review.csv（UTF-8 BOM，可直接用 Excel 開啟）。
// 內容全部由 src/data 自動計算；資料更新後重新執行即可。CI 會檢查兩份檔案是否與資料一致。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DATA_DIR, loadAll, readJSON, AVAILABILITY, SELLER_ROLES, IMAGE_RIGHTS, isApproved } from './lib/data.mjs';

const { products, categories } = loadAll();
const { items } = readJSON(path.join(DATA_DIR, 'first-batch.json'));
const catMap = new Map(categories.map(c => [c.id, c]));
const PRICE = { fixed: '定價', from: '起價', inquiry: '詢價' };
const CSTAT = { pending: '待確認', cleared: '已確認可販售', not_required: '經確認不需審驗' };

const rows = items.map(it => {
  const p = products.find(x => x.id === it.id);
  if (!p) throw new Error(`首批名單中的 ${it.id} 不存在`);
  const c = catMap.get(p.primary_category_id);
  const sub = c.subcategories.find(s => s.id === p.subcategory_id);
  const rv = p.review || {};
  const imgs = p.images || [];
  const imgRights = imgs.length && imgs.every(i => IMAGE_RIGHTS[i.rights]);
  const blockers = [];
  if (!imgs.length) blockers.push('沒有正式圖片');
  else if (!imgRights) blockers.push('圖片未標示使用權');
  if (!rv.specs_confirmed) blockers.push('規格未經 EWP 核對');
  if (p.compliance?.status === 'pending') blockers.push('合規待確認');
  if (!isApproved(p)) blockers.push('未核准上架');
  return {
    no: it.no, group: it.group, id: p.id, name: p.name_zh,
    cat: c.name, sub: sub?.name || '（未分）',
    role: SELLER_ROLES[p.seller_role] || p.seller_role,
    brand: p.brand || '（待補）', model: p.manufacturer_model || '（待補）',
    mode: p.listing_mode === 'showcase' ? '作品介紹（不販售）' : '一般商品',
    images: imgs.length ? `${imgs.length} 張${imgRights ? '' : '（缺使用權標示）'}` : '缺（0 張）',
    srcImgs: (rv.source_image_urls || []).length,
    specs: `${rv.specs_confirmed ? '已確認' : '未確認'}（已整理 ${(p.specifications || []).length} 項）`,
    price: PRICE[p.price_display] + (p.price_twd ? ` NT$${p.price_twd}` : ''),
    avail: AVAILABILITY[p.availability],
    variants: (p.variants || []).length ? p.variants.map(v => v.name).join('／') : '（無或待補）',
    shopeeId: p.shopee_item_id || '',
    shopee: p.shopee_url ? (rv.shopee_url_verified ? '已核實' : '有網址，未核實') : '未核實（缺網址／shop ID）',
    compliance: p.compliance ? (p.compliance.items || []).map(x => x.type).join('、') : '無已知特別項目（請 EWP 確認）',
    cstat: p.compliance ? CSTAT[p.compliance.status] : '—',
    review: p.published ? '已公開' : isApproved(p) ? '已核准（未公開）' : '草稿待審',
    blockers: blockers.join('；'),
    missing: (rv.missing || []).join('；'),
    complianceDetail: p.compliance ? (p.compliance.items || []).map(x => `${x.type}：${x.reason}`) : [],
    missingList: rv.missing || [],
  };
});

// ---------- CSV ----------
const COLS = [
  ['no', '編號'], ['group', '組別'], ['id', '商品ID'], ['name', '品名'], ['cat', '主分類'], ['sub', '子分類'], ['role', '標示'],
  ['brand', '品牌'], ['model', '型號'], ['mode', '上架模式'], ['images', '圖片'], ['srcImgs', '蝦皮原始圖片參考數'], ['specs', '規格'],
  ['price', '售價模式'], ['avail', '供貨狀態'], ['variants', '規格變體'], ['shopeeId', '蝦皮商品ID'], ['shopee', '蝦皮連結'],
  ['compliance', '合規確認項目'], ['cstat', '合規狀態'], ['review', '上架審核狀態'], ['blockers', '公開前阻擋項目'], ['missing', '缺漏資料與待 EWP 決定'],
];
const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = '﻿' + [COLS.map(c => c[1]).join(','), ...rows.map(r => COLS.map(([k]) => q(r[k])).join(','))].join('\r\n') + '\r\n';

// ---------- Markdown ----------
const count = f => rows.filter(f).length;
const esc = s => String(s).replace(/\|/g, '｜');
const table = list => ['| # | 組 | 品名 | 品牌／型號 | 圖片 | 規格 | 售價 | 供貨 | 蝦皮連結 | 合規 | 審核 |', '|---|---|---|---|---|---|---|---|---|---|---|',
  ...list.map(r => `| ${r.no} | ${r.group} | ${esc(r.name.slice(0, 28))}${r.name.length > 28 ? '…' : ''}<br><sub>${r.id}</sub> | ${esc(r.brand)}／${esc(r.model)} | ${r.images} | ${r.specs} | ${r.price} | ${r.avail} | ${r.shopee.startsWith('已') ? '✅' : '未核實'} | ${r.cstat === '—' ? '—' : `${r.cstat}：${r.compliance}`} | ${r.review} |`)].join('\n');

const md = `# 首批商品資料確認表

> 本檔由 \`node scripts/report-first-batch.mjs\` 依 \`src/data\` 自動產生，請勿手改；同一份資料的 Excel 版為 [first-batch-review.csv](first-batch-review.csv)。
> 名單來源：[FIRST_BATCH.md](FIRST_BATCH.md)／\`src/data/first-batch.json\`。所有商品目前皆為 **published:false**。

## 總覽

| 項目 | 數量 |
|---|---|
| 首批商品 | ${rows.length} 件（A 組 ${count(r => r.group === 'A')}、B 組 ${count(r => r.group === 'B')}） |
| 已有正式圖片 | ${count(r => !r.images.startsWith('缺'))} 件 |
| 規格已由 EWP 確認 | ${count(r => r.specs.startsWith('已確認'))} 件 |
| 已有售價（非詢價） | ${count(r => !r.price.startsWith('詢價'))} 件 |
| 供貨狀態已確認 | ${count(r => r.avail !== AVAILABILITY.unknown)} 件 |
| 蝦皮連結已核實 | ${count(r => r.shopee === '已核實')} 件 |
| 需要合規確認 | ${count(r => r.cstat === '待確認')} 件 |
| 可以公開（無阻擋項目） | ${count(r => !r.blockers)} 件 |

**目前沒有任何一件可以公開。** 共同缺少：正式圖片（含使用權標示）、EWP 規格核對、售價模式、供貨狀態、蝦皮商品網址。

## A 組：一般零件（${count(r => r.group === 'A')} 件）

${table(rows.filter(r => r.group === 'A'))}

## B 組：電池、無線電相關與整機（${count(r => r.group === 'B')} 件）

整機（#18–20）目前設為 **作品介紹（listing_mode: showcase）**：不顯示價格、供貨與蝦皮按鈕，只提供 LINE 客製組裝諮詢，也不輸出 Product 結構化資料。合規確認完成前不得改為販售模式（建置驗證會擋下）。

${table(rows.filter(r => r.group === 'B'))}

## EWP 需要補充的資料（逐件）

${rows.map(r => `### #${r.no} ${r.name.slice(0, 40)}（${r.id}）\n\n${r.missingList.map(m => `- ${m}`).join('\n')}${r.complianceDetail.length ? `\n- **合規確認**：\n${r.complianceDetail.map(c => `  - ${c}`).join('\n')}` : ''}`).join('\n\n')}

## 待 EWP 決定事項

1. **#12 FDI AIO**：標題同時寫 F405 與 F722，是兩個變體還是只有 F722？
2. **#17 GPS**：標示「電翼動力」品牌——是自製、貼牌（OEM）還是零售？決定網站標示為「EWP 自製」或「其他品牌商品」。
3. **#16 ELRS 接收機**：品牌「HSRC」與 HSKRC 是否同一家？
4. **#3 M5 螺母**：標題「CW」指正牙或反牙？
5. **#18–20 整機**：維持作品介紹，或在合規確認後改為販售？
6. **#4 靈雀電池**：說明中的「140A（47C）／36A（12C）」是單顆電芯還是整組數據？
7. **#6、#15**：「純鈷電芯、循環約 500 次」「遠距穿牆」等宣傳用語，公開前保留（需佐證）或刪除？
8. **圖片**：蝦皮上的照片哪些是 EWP 自己拍的、哪些是原廠圖？原廠圖需取得授權後才能用於官網。

## 合規確認說明

- 鋰電池：經濟部標準檢驗局公告的應施檢驗二次鋰電池品目包括「3C 二次鋰行動電源」與「3C 二次鋰單電池／組」（CNS 15364）等；FPV／航模電池是否落在範圍內，請 EWP 以標準檢驗局最新公告或向檢驗機構確認（參考：[標準檢驗局應施檢驗 3C 二次鋰行動電源等五項商品規定](https://www.bsmi.gov.tw/wSite/public/Data/f1519187111973.pdf)）。
- 無線電發射設備（圖傳、ELRS 接收機的遙測回傳、整機）：請以 NCC 公告或代辦機構確認審驗需求。被動天線是否需審驗亦請確認。
- 以上為待確認清單，不是法規結論；網站在 \`compliance.status\` 改為 \`cleared\` 或 \`not_required\` 前不會公開這些商品。

## 圖片整理流程

1. 只使用 EWP 自有或已取得授權的照片；蝦皮原始圖片網址（每件的「蝦皮原始圖片參考數」）僅供 EWP 找回原檔，網站不外連蝦皮圖片。
2. 照片放到 \`media-inbox/<商品 id>/\`（不提交、不發布）。
3. \`npm install\` 後執行 \`node scripts/add-images.mjs <商品 id> --rights ewp_own --alt "圖片說明"\`，自動壓縮成 1200px／600px WebP 並寫入商品資料。
4. \`node scripts/build.mjs --drafts\` 預覽確認。
`;

fs.writeFileSync(path.join(ROOT, 'docs', 'first-batch-review.csv'), csv);
fs.writeFileSync(path.join(ROOT, 'docs', 'FIRST_BATCH_REVIEW.md'), md);
console.log(`✓ 已產生 docs/FIRST_BATCH_REVIEW.md 與 docs/first-batch-review.csv（${rows.length} 筆）`);
