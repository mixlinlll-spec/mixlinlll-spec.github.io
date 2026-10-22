# CHANGELOG

## v2.0.0-phase2（2026-10-22，分支 feature/ewp-site-v2）

### 新增
- 全站共用 Header／Footer、設計 Token、ProductCard、Breadcrumb、CTA（`scripts/lib/html.mjs`、`assets/css/site.css`）。
- 九大入口：首頁、商品商城、EWP 自製機型、技術與客製服務、電池專區、FPV 知識庫（原網址）、最新消息、關於、聯絡；另有隱私權、條款、售後退換、404。
- 桌機 mega menu（10 個主分類＋熱門子分類＋搜尋）、手機漢堡選單（分類可多層展開／收合）。
- 資料驅動商品型錄：10 主分類／子分類頁、關鍵字搜尋、品牌／尺寸／圖傳／電壓／供貨／價格篩選、排序、載入更多、篩選狀態寫入網址、無結果空狀態。
- 商品詳情頁：圖片與縮圖、品牌、SKU、供貨、價格或詢價、規格表、變體、相容標籤、注意事項、相關商品、手機底部固定 CTA、Product／Breadcrumb 結構化資料（只輸出真實欄位）。
- 商品資料 schema 驗證（不得 0 元、公開需正式圖片與 EWP 核對等）、CSV 匯入、蝦皮匯出檔轉草稿。
- 由蝦皮匯出檔建立 240 筆商品草稿（全部 `published:false`）。
- 7 個服務頁、6 個自製機型頁。
- LINE 官方帳號按鈕與 QR、蝦皮賣場、Email、Instagram，由 `site.json` 集中設定。
- sitemap.xml、robots.txt、canonical、OG、favicon。
- CI（`.github/workflows/ci.yml`）：資料驗證、單元測試、產出一致性、連結與草稿外洩檢查。
- 文件：README、CONTENT_GUIDE、docs/PHASE0_AUDIT、docs/DEPLOY_ROLLBACK、docs/TODO。

### 變更
- `index.html` 改為由產生器輸出；原首頁文字、三台代表機型、工作室服務、關於、FAQ 全部保留，並保留 `#builds` `#workshop` `#about` `#contact` 錨點。
- 首頁主圖改用 600／1200px WebP（原 2.8 MB → 74–182 KB）。
- README 改寫為新架構說明。

### 保留
- `fpv-help.html`（91 則）未修改，原網址可用。
- `huan.png` 原網址保留。
- 舊首頁存檔於 `legacy/home-2026-09.html`（noindex）。
