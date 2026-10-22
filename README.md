# 電翼動力 EWP 官方網站

官方品牌網站＋可搜尋的商品型錄＋LINE／蝦皮詢價導購＋FPV 技術知識庫。
部署在 GitHub Pages（`https://mixlinlll-spec.github.io/`），純靜態網站：沒有後端、資料庫、會員、購物車、金流或追蹤程式。

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
  lib/               共用資料驗證與版型（Header／Footer／ProductCard…）
assets/              CSS、JS、圖片、LINE QR（手寫，非產生）
fpv-help.html        舊知識庫（91 則），原網址保留、內容未改動
legacy/              2026-09 舊版首頁存檔（noindex，僅供比對）
tests/               資料規則測試、端對端測試
（其餘 index.html、products/、product/、builds/、services/… 都是 build 產出）
```

- 產出檔案直接放在 repo 根目錄，所以 Pages 維持「Deploy from a branch → main → / (root)」，不用改任何設定。
- `.generated.json` 記錄由程式產生的檔案；重新產生時只會刪除清單內、這次不再需要的檔案，不會動到手寫檔案。
- **repo 是公開的**：草稿雖然不會出現在網站上，但 `src/data/products/` 在 GitHub 上看得到。不要把進貨價、成本、客戶資料放進資料檔。

## 常用指令（需要 Node.js 18 以上，不需安裝套件）

| 指令 | 用途 |
|---|---|
| `node scripts/build.mjs` | 產生正式版（只含 `published=true` 商品）到根目錄 |
| `node scripts/build.mjs --drafts` | 產生含草稿的預覽版到 `_preview/`（noindex，不提交） |
| `node scripts/build.mjs --check` | 只驗證資料 |
| `node scripts/check-site.mjs` | 檢查連結、資源與草稿外洩 |
| `node --test tests/data.test.mjs` | 資料規則測試 |
| `node tests/e2e.mjs` | 端對端測試（需 Playwright，見檔案開頭說明） |

本機預覽：

```bash
node scripts/build.mjs --drafts
python3 -m http.server 8801 --directory _preview   # 開 http://localhost:8801
```

## 修改資料後的固定流程

1. 改 `src/data/` 內的 JSON，或用 CSV 匯入（見 [CONTENT_GUIDE.md](CONTENT_GUIDE.md)）。
2. `node scripts/build.mjs`，再 `node scripts/check-site.mjs`。
3. 把資料檔與產出檔一起 commit。CI 會檢查兩者是否一致。

## 部署與回滾

見 [docs/DEPLOY_ROLLBACK.md](docs/DEPLOY_ROLLBACK.md)。
