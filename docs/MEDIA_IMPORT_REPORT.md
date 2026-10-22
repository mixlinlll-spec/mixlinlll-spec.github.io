# 蝦皮商品圖片匯入報告

> 由 `scripts/import-shopee-media.mjs` 自動產生（GitHub Actions：import-media.yml）。
> 來源：蝦皮「媒體資訊」匯出檔 mass_update_media_info_4053258_20261022141110。

| 項目 | 數量 |
|---|---|
| 商品 | 240 件 |
| 主圖＋細節圖（不重複） | 成功 1092／1092 |
| 規格選項圖（不重複） | 成功 303／303 |
| 本次新下載 | 1395 張 |
| 已存在略過 | 0 張 |
| 失敗 | 0 張 |
| 寫入商品 images | 1092 筆 |
| 對應到規格變體的選項圖 | 296 筆 |
| 下載原始大小 → 輸出大小（本次） | 501.2 MB → 71.5 MB |

規格：主圖與細節圖輸出長邊 1000px 與 480px WebP；規格選項圖輸出 480px WebP。所有圖片 `rights: "unverified"`（使用權待 EWP 確認），在 EWP 標示為 `ewp_own` 或 `licensed` 前不能用於公開商品，也不會被複製到正式網站產物。

## 失敗清單

無。

完整清單（Excel 可開）：[media-import-failures.csv](media-import-failures.csv)。失敗的圖片可重新執行匯入，已成功的會自動跳過。
