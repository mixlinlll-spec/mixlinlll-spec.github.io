# 電翼動力 EWP 官方網站

官方品牌網站＋可搜尋的商品型錄＋LINE／蝦皮詢價導購＋FPV 技術知識庫。
**商品管理後台**：Pages CMS（https://app.pagescms.org），使用說明與限制見 [docs/admin/PRODUCT_ADMIN.md](docs/admin/PRODUCT_ADMIN.md)。
部署在 GitHub Pages，正式網址 **https://www.ewpfpv.com**（自訂網域；舊網址 `https://mixlinlll-spec.github.io/` 由 GitHub 自動轉址），純靜態網站：沒有後端、資料庫、會員、購物車、金流或追蹤程式。
**由 GitHub Actions 建置並只發布 `dist/`**（產生的頁面＋白名單靜態檔）；原始資料、程式與測試不會出現在網站上。

## 架構

```
src/data/            ← 唯一資料來源（人改這裡）
  site.json          全站設定：品牌、聯絡方式（LINE／蝦皮／Email…）、政策頁是否公開
  categories.json    10 個主分類與子分類（id 永久不變）
  products/*.json    商品，一個商品一個檔案（預設 published=false 草稿）
  builds.json        EWP 自製機型
  services.json      服務頁內容
src/templates/       CSV 匯入範本
scripts/
  build.mjs          產生網站（驗證資料 → 輸出 HTML、sitemap、robots）
  check-site.mjs     檢查站內連結、資源、假連結、草稿外洩
  import-csv.mjs     由 CSV 新增／更新商品
  import-shopee.mjs  由蝦皮匯出檔建立商品草稿
  add-images.mjs     商品照片壓縮成 WebP 並寫入資料（需 npm install）
  import-shopee-media.mjs  批次下載蝦皮商品圖片（GitHub Actions：import-media.yml）
  approve-snapshot.mjs     核對後套用蝦皮價格／庫存快照與圖片使用權（不會公開）
  report-shopee-import.mjs 產生蝦皮匯入總表（docs/SHOPEE_IMPORT_REPORT.md、CSV）
  cms-normalize.mjs  後台（Pages CMS）儲存後校正：還原空值、保護 id／review、上架守門、新照片轉 WebP
  admin-bulk.mjs     後台批次修改（價格／上下架／供貨）
  admin-import.mjs   蝦皮 CSV 匯入（價格／庫存＋錯誤報告；只在本機執行，匯入檔不可放進 repo）
  admin-restore.mjs  後台還原單一商品到指定版本
  lib/               共用資料驗證與版型（Header／Footer／ProductCard…）
assets/              CSS、JS、圖片、QR；assets/img/products/ 為蝦皮匯入的商品圖片（只有已公開商品會進入 dist/）
fpv-help.html        舊知識庫（91 則），原網址保留、內容未改動
huan.png             舊主圖，原網址保留
legacy/              2026-09 舊版首頁存檔（noindex，僅供比對）
tests/               資料／路徑／審核單元測試、Playwright 端對端測試、Lighthouse
.pages.yml           商品管理後台（Pages CMS）設定
.github/workflows/   ci.yml（每次 push／PR 檢查）、pages.yml（main 更新時部署）、
                     cms-sync.yml（後台儲存後校正與發布）、admin-*.yml（後台按鈕：批次、還原）
dist/                正式發布產物（建置產生，不提交，由 Actions 部署）
_preview/            含草稿預覽（建置產生，不提交、不部署）
```

- **發布白名單**：`dist/` 只會有產生的頁面與 `assets/`、`fpv-help.html`、`huan.png`、`legacy/`、`.nojekyll`（定義在 `scripts/lib/data.mjs` 的 `STATIC_WHITELIST`）。`scripts/check-site.mjs` 會在任何 `.json`、`.mjs`、`.md`、`src/`、`scripts/` 等出現在產物時失敗。
- **repo 是公開的**：草稿不會出現在網站上，但 `src/data/` 在 GitHub 上看得到。不要把進貨價、成本、客戶個資、稅籍編號、庫存數量等機密放進 repo（資料驗證會擋下庫存欄位）。

## 常用指令（需要 Node.js 18 以上，不需安裝套件）

| 指令 | 用途 |
|---|---|
| `node scripts/build.mjs` | 產生正式版（只含 `published=true` 商品）到 `dist/` |
| `node scripts/build.mjs --drafts` | 產生含草稿的預覽版到 `_preview/`（noindex，不提交） |
| `node scripts/build.mjs --check` | 只驗證資料 |
| `node scripts/check-site.mjs` | 檢查 `dist/` 發布白名單、連結、資源與草稿外洩 |
| `node --test tests/data.test.mjs` | 資料／審核／路徑／發布產物測試 |
| `node tests/e2e.mjs` | 端對端測試（需 `npm install`，見檔案開頭說明） |
| `node tests/lighthouse.mjs` | 手機版 Lighthouse（需 `npm install` 與 Chrome） |

本機預覽：

```bash
node scripts/build.mjs && python3 -m http.server 8800 --directory dist   # 正式版
node scripts/build.mjs --drafts
python3 -m http.server 8801 --directory _preview   # 開 http://localhost:8801
```

## 修改資料後的固定流程

1. 改 `src/data/` 內的 JSON，或用 CSV 匯入（見 [CONTENT_GUIDE.md](CONTENT_GUIDE.md)）。
2. `node scripts/build.mjs`，再 `node scripts/check-site.mjs`。
3. 只 commit 資料與程式（`dist/`、`_preview/` 已在 .gitignore）。合併到 main 後由 Actions 自動建置部署。

## 部署與回滾

見 [docs/DEPLOY_ROLLBACK.md](docs/DEPLOY_ROLLBACK.md)。
