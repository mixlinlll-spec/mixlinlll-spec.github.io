# 商品上架與內容維護指南

給 EWP 日常維護用。原則：**只有核對過的資料才公開**；不確定的價格寫「詢價」、不確定的庫存寫「供貨狀況請洽詢」。

## 一、上架流程（新增 → 圖片 → 匯入 → 檢查 → 發布）

### 1. 新增商品資料

兩種方式擇一：

**A. CSV（適合一次多筆）**
1. 複製 `src/templates/products-template.csv`，用 Excel／Google 試算表編輯，存成「CSV UTF-8」。
2. 執行 `node scripts/import-csv.mjs 你的檔案.csv --dry-run` 先檢查，沒錯再拿掉 `--dry-run`。
3. 同一個 `id` 再匯入一次 = 更新；CSV 留空的欄位不會覆蓋原本資料。

**B. 直接改 JSON（適合單筆修改）**
複製 `src/data/products/` 裡一個檔案，改檔名與內容即可。

### 2. 整理圖片

**建議用工具處理**：照片放到 `media-inbox/<商品 id>/`（不提交、不發布），執行

```bash
npm install            # 第一次
node scripts/add-images.mjs sp-42781322918 --rights ewp_own --alt "SIRIUS 2306.5 馬達正面"
```

會自動轉正、壓縮成 `assets/img/products/<id>/01.webp`（1200px）與 `01-600.webp`，並寫入商品 `images`。`--rights` 只能是 `ewp_own`（EWP 自有）或 `licensed`（已取得授權）；沒有使用權的圖片（例如未授權的原廠圖）不要放進來。網站不外連蝦皮圖片。

手動整理時：
- 放在 `assets/img/products/<商品 id>/`，檔名用英數，例如 `assets/img/products/sp-44561107171/main.webp`。
- 每張圖片都要有 `rights`，未標示使用權的圖片無法公開。
- 建議 1:1 正方形、1200×1200、WebP 或 JPG、單張 300KB 以下；不要放 20MB 原圖。
- 只用 EWP 自己拍攝或有授權的照片；每張都要寫 `alt`（描述畫面內容，例如「MOZ7 七吋長航機正面，搭載 O4 Pro」）。
- 圖片欄位格式：`{"src": "/assets/img/products/xxx/main.webp", "alt": "…"}`；可選 `src_small`（600px 版）。

### 3. 產生與檢查

```bash
node scripts/build.mjs --drafts      # 預覽（含草稿），開 _preview/ 檢查
node scripts/build.mjs               # 正式版 → dist/
node scripts/check-site.mjs          # 白名單／連結／草稿外洩檢查
```

### 4. 發布

把該商品改成：

```json
"published": true,
"review": { "status": "approved" }
```

驗證程式會擋下不完整的公開商品：沒有正式圖片、沒有 `short_description`、沒有 `brand`、沒有子分類都無法公開；`review` 必須存在且 `status` 明確為 `"approved"`（缺少、`null`、`{}`、`draft` 都會被擋下）。

**不上官網的商品**：設定 `"review": { "status": "rejected" }`，正式版與預覽版都不會產生。

## 二、欄位說明

| 欄位 | 必填 | 說明 |
|---|---|---|
| `id` | ✔ | 永久唯一，改名稱不要改 id。蝦皮匯入的草稿為 `sp-<蝦皮商品ID>` |
| `slug` | ✔ | 網址 `/product/<slug>/`，只能小寫英數與 `-`，**發布後不要改** |
| `name_zh` | ✔ | 繁體中文品名 |
| `sku` |  | 自家貨號；不可重複 |
| `brand` | 公開時 ✔ | 商品品牌。EWP 自製填「電翼動力 EWP」 |
| `manufacturer_model` |  | 原廠型號 |
| `seller_role` | ✔ | `ewp_original` EWP 自製／`ewp_assembled` EWP 組裝／`retail` 其他品牌商品／`collab` 聯名商品（例：十安 × 電翼動力）／`service` 客製服務 |
| `cta_primary` |  | `line` 或 `shopee`，指定商品頁第一個按鈕。不填時：EWP 自製的整機與電池、EWP 組裝、服務 → LINE 優先；其餘一般現貨 → 蝦皮優先 |
| `primary_category_id`、`subcategory_id` | ✔ | 見 `src/data/categories.json`。一個商品只有一個主分類 |
| `tags`、`compatible_sizes` |  | 標籤、相容尺寸（例 `5 吋`、`75mm`），會出現在篩選與搜尋 |
| `video_system` |  | 例 `DJI O4`、`類比`、`Walksnail`，供「圖傳系統」篩選 |
| `battery_cells` |  | 例 `["4S","6S"]`，供「電壓」篩選 |
| `aliases` |  | 搜尋別名，例 `["摩斯7","MOZ 7"]` |
| `short_description` | 公開時 ✔ | 1–2 句重點 |
| `description` |  | 詳細說明（空一行分段） |
| `specifications` |  | `[{"key":"重量","value":"32g"}]` |
| `images` | 公開時 ✔ | 見上方 |
| `variants` |  | `[{"name":"O4 Pro 版","sku":"…","price_twd":null,"availability":"unknown"}]`；不同圖傳不同價格就用變體 |
| `price_twd` |  | 數字或 `null`。**不得為 0** |
| `price_display` | ✔ | `fixed` 定價／`from` 起價／`inquiry` 詢價（此時 `price_twd` 必須為 null） |
| `availability` | ✔ | `in_stock` 現貨／`preorder` 預購／`made_to_order` 接單製作／`out_of_stock` 暫無供貨／`unknown` 供貨狀況請洽詢 |
| `shopee_url` |  | 蝦皮商品網址（`https://shopee.tw/…`）。空白時會嘗試用 `shopee_item_id`＋ site.json 的 `shop_id` 組網址 |
| `line_inquiry_enabled` | ✔ | 是否顯示 LINE 詢價按鈕 |
| `featured` | ✔ | 精選：在列表預設排序中排前面 |
| `published` | ✔ | 預設 false |
| `updated_at` | ✔ | `YYYY-MM-DD` |
| `listing_mode` | 整機公開時 ✔ | `sale` 一般商品（預設）／`showcase` 作品介紹：不顯示價格、供貨、蝦皮按鈕，只提供 LINE 客製組裝諮詢 |
| `compliance` |  | `{ "status": "pending／cleared／not_required", "items": [{ "type": "NCC", "reason": "…" }] }`。pending 時不得以販售模式公開；整機以 sale 公開必須 cleared |
| `review` | 公開時 ✔ | `status`（draft／approved／rejected）、`notes`（待核對事項，只在預覽版顯示） |

## 三之一、蝦皮圖片、價格與庫存（已全量匯入）

- **圖片**：`src/data/products/*.json` 的 `review.source_media` 保存蝦皮主圖／細節圖／規格選項圖網址；由 GitHub Actions（`import-media.yml`）下載並壓縮到 `assets/img/products/<id>/`，寫入 `images`（`rights: "unverified"`）與 `variants[].image`。
  - 重新匯入或補失敗：修改 `src/data/shopee/media-import-request.json` 的 `requested_at` 後推送，或在 Actions 頁手動 Run workflow。已存在的圖片會略過。
  - 新的蝦皮媒體匯出檔：交給 Claude 更新 `source_media` 後再觸發。
- **價格與庫存**：`review.shopee_sales_snapshot` 保存匯出時的每個規格價格、庫存；`variants[].shopee_variation_id` 對應蝦皮規格。網站公開欄位維持「詢價／供貨請洽詢」，直到核對後套用：

```bash
node scripts/approve-snapshot.mjs --all --prices --stock --discount 4 --dry-run          # 先看結果
node scripts/approve-snapshot.mjs --all --prices --stock --discount 4 --image-rights licensed --publish
```

  官網價＝蝦皮價 ×（1 − 折扣%），四捨五入到整數元。加上 `--publish` 才會核准上架；`rejected` 商品一律略過。
- 總表：[docs/SHOPEE_IMPORT_REPORT.md](docs/SHOPEE_IMPORT_REPORT.md)（Excel：`docs/shopee-import.csv`）、下載結果：[docs/MEDIA_IMPORT_REPORT.md](docs/MEDIA_IMPORT_REPORT.md)。

## 三、蝦皮資料匯入

1. 蝦皮賣家中心 → 大量工具 → 下載「基本資訊」→ 用 Excel 開啟 → 另存「CSV UTF-8」。
2. `node scripts/import-shopee.mjs 檔案.csv --dry-run`，確認後拿掉 `--dry-run`。
3. 只會建立新草稿，已存在的商品不會被覆蓋。分類、品牌、尺寸為自動判斷，每筆都附 `review.notes` 提醒核對。
4. 蝦皮描述裡的圖片網址只保存在 `review.source_image_urls` 供參考，網站不會直接引用蝦皮圖片。

## 四、其他內容

| 要改的東西 | 檔案 |
|---|---|
| LINE、蝦皮、Email、Instagram、Facebook、電話、地址、服務時間 | `src/data/site.json` → `contact`（`enabled:false` 就不會顯示） |
| 蝦皮 shop ID（讓草稿自動帶商品連結） | `site.json` → `contact.shopee.shop_id` |
| 隱私權、網站條款、售後退換頁公開 | 三頁目前皆未核准（noindex、不在頁尾與 sitemap）。EWP 提供正式內容後改 `scripts/build.mjs` 內文字，再把 `site.json` → `policies` 設為 `approved: true` |
| 營業登記資訊（名稱、統一編號、登記地址） | `site.json` → `business`（顯示於頁尾、關於、聯絡頁）。稅籍編號不放入 repo |
| 自製機型 | `src/data/builds.json`（`specs` 只放核對過的規格） |
| 服務頁 | `src/data/services.json` |
| 分類名稱 | `src/data/categories.json`（**不要改 id**，網址會變） |
| 顏色、字級 | `assets/css/site.css` 開頭的 `:root` |

## 五、不要做的事

- 不要在資料中寫 0 元、假庫存、假評價、假折扣倒數。
- 不要用其他賣家或原廠未授權的圖片。
- 不要放成本、進價、客戶個資、稅籍編號等機密（repo 是公開的）。
- 已發布商品不要改 `slug`；真的要改，請保留舊網址的轉址頁。
