# 蝦皮商品匯入總表

> 由 `node scripts/report-shopee-import.mjs` 依 `src/data` 自動產生；逐件明細（Excel）：[shopee-import.csv](shopee-import.csv)。圖片下載結果見 [MEDIA_IMPORT_REPORT.md](MEDIA_IMPORT_REPORT.md)。

| 項目 | 數量 |
|---|---|
| 蝦皮匯出商品 | 244 件（商品 240、服務型 4） |
| 主圖＋細節圖 | 蝦皮 1092 張（不重複）→ 已匯入 1092 張 |
| 規格選項圖 | 蝦皮 303 張（不重複）→ 已對應變體 303 張 |
| 價格／庫存列 | 商品 908 列＋服務型 4 列＝912 列（全部保存為快照） |
| 網站變體 | 847 筆（對應蝦皮規格 ID） |
| 快照已套用到公開欄位 | 238 件 |
| 已公開商品 | 238 件 |

- 價格與庫存：原始蝦皮快照保存在 `review.shopee_sales_snapshot`；已套用的商品，官網價格＝蝦皮價格 −4%（四捨五入到整數元），供貨依快照庫存（>0 現貨、0 暫無供貨）。
- 圖片使用權：EWP 已確認全部可使用（`rights: "licensed"`）。
- 服務型商品（維修、代購、3D 列印）的原始資料保存在 `src/data/shopee/service-listings.json`。

## 圖片未完整匯入的商品（0 件）

無。

## 選項圖無法對應到規格的商品

無。
