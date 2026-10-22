# Phase 0：現況盤點與風險（2026-10-22）

## 1. Repository 現況（main @ 318c58f）

| 檔案 | 大小 | 說明 |
|---|---|---|
| `index.html` | 16 KB | 單頁品牌站，內嵌 CSS／JS。區塊：Hero（幻 HUAN 海報）、代表機型 3 台、工作室服務 4 項、關於、FAQ 3 則、聯絡（「蝦皮搜尋：電翼動力」純文字）。錨點：`#builds` `#workshop` `#about` `#contact` |
| `fpv-help.html` | 112 KB | 知識庫，91 則，含搜尋、分類、電池速查（`#battery-knowledge`），連回 `/` |
| `huan.png` | 2.8 MB | 首頁主視覺，實際 1536×1536（HTML 標示 1254×1254） |
| `README.md` | 2 KB | 提到 `assets/huan.png` 與 `.github/workflows/pages.yml`，但 repo 內不存在 |
| `.nojekyll` | — | 關閉 Jekyll |

- 共 13 個 commit，全部為網頁上傳（Add files via upload），沒有分支、沒有 workflow。
- GitHub Pages：線上首頁與 `/fpv-help.html` 皆可讀取（標題與「共 91 則」相符），推斷為 Deploy from a branch：`main` / root。
- 無外部依賴、無追蹤程式、無表單。

## 2. 主要風險與處理

| 風險 | 影響 | 處理 |
|---|---|---|
| 沒有商品資料模型，新增商品需手改 HTML | 無法擴充到數百件 | 改為 `src/data/products/*.json` ＋產生器 |
| 首頁主圖 2.8 MB | 手機載入慢 | 產生 600／1200px WebP＋JPG（74–260 KB）；原 `huan.png` 保留舊網址 |
| 直接覆寫 main 會改壞正式站 | 正式站中斷 | 在 `feature/ewp-site-v2` 開發，PR 驗收後才合併；舊首頁另存 `legacy/home-2026-09.html` |
| 改用 GitHub Actions 部署需改 Pages 設定 | 合併後若未改設定，站會壞 | 產出直接放根目錄，**沿用現有 branch 部署，不需改設定** |
| repo 公開，草稿 JSON 可在 GitHub 上看到 | 草稿資訊可被看見（不會出現在網站） | 文件明確禁止放入成本、進價、個資 |
| 本工作階段無 GitHub 推送權限（push 403） | 無法直接開 PR | 交付完整分支（git bundle＋patch）與 PR 說明，見交付說明 |
| 蝦皮商品頁有機器人驗證，無法自動核對 shop ID 與商品網址 | 草稿無法自動附上蝦皮商品連結 | `shop_id` 暫設 null，草稿保存 `shopee_item_id`；EWP 確認 shop ID 後一鍵生效 |

## 3. 架構決策

- **首選（已實作）**：保留靜態 HTML，改為「JSON 資料＋零依賴 Node 產生器」。產出提交在 repo 根目錄，GitHub Pages 設定不變；CI 只做檢查。每個商品有獨立靜態詳情頁（利於 SEO），列表的篩選／搜尋在瀏覽器端對伺服器輸出的商品卡做顯示／隱藏，ProductCard 只有一份樣板。
  - 理由：不改部署方式、不引入 npm 套件、非工程人員可用 CSV 維護、數百～千件商品時單頁 HTML 仍在可接受大小（240 件約 300 KB 未壓縮，GitHub Pages 會 gzip）。
- **備案**：Astro 靜態站＋GitHub Actions 部署（`actions/deploy-pages`）。適合商品超過數千件或需要圖片自動轉檔時；代價是需要把 Pages Source 改為 GitHub Actions、引入 npm 依賴。現有資料格式（JSON）可直接沿用，遷移成本低。

## 4. 已知缺漏資訊（詳見 docs/TODO.md）

LINE（已提供並驗證）、蝦皮賣場首頁（已提供）、Email（已提供）、營業時間與地點（EWP 指示暫不公開）；商品照片、售價、供貨、規格、shop ID、政策頁內容仍待 EWP 提供。
