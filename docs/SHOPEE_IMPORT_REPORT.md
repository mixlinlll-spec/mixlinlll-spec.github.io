# 蝦皮商品匯入總表

> 由 `node scripts/report-shopee-import.mjs` 依 `src/data` 自動產生；逐件明細（Excel）：[shopee-import.csv](shopee-import.csv)。圖片下載結果見 [MEDIA_IMPORT_REPORT.md](MEDIA_IMPORT_REPORT.md)。

| 項目 | 數量 |
|---|---|
| 蝦皮匯出商品 | 244 件（商品 240、服務型 4） |
| 主圖＋細節圖 | 蝦皮 1092 張（不重複）→ 已匯入 1092 張 |
| 規格選項圖 | 蝦皮 303 張（不重複）→ 已對應變體 303 張 |
| 價格／庫存列 | 商品 908 列＋服務型 4 列＝912 列（全部保存為快照） |
| 網站變體 | 847 筆（對應蝦皮規格 ID） |
| 快照已套用到公開欄位 | 0 件 |
| 已公開商品 | 0 件 |

- 價格與庫存只保存為 `review.shopee_sales_snapshot`，網站價格維持「詢價」、供貨維持「請洽詢」，直到 EWP 核對後執行 `node scripts/approve-snapshot.mjs`。
- 匯入的圖片皆為 `rights: "unverified"`，EWP 確認使用權後用 `approve-snapshot.mjs --image-rights ewp_own` 標示；未標示前不能公開，也不會複製到正式網站。
- 服務型商品（維修、代購、3D 列印）的原始資料保存在 `src/data/shopee/service-listings.json`。

## 圖片未完整匯入的商品（0 件）

無。

## 選項圖無法對應到規格的商品

無。
