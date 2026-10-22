# CHANGELOG

## v2.2.0（2026-10-22，Phase 3 首批商品資料整理）

### 營業登記地址
- 關於、聯絡頁登記地址下方緊貼 EWP 指定的「非實體門市」提示（`site.json → business.address_notice`）；頁尾維持名稱＋統編；不公開營業時間、電話；無地圖導航。
- 結構化資料維持 Organization（非 LocalBusiness／Store），地址標示「營業登記地址（非實體門市，不提供現場服務）」，客服聯絡改以 LINE ContactPoint 表示。
- 服務頁流程移除「送件／交件」等可能被理解為到場送修的字眼，改為寄送或先以 LINE 確認。

### 首批 20 件
- `src/data/first-batch.json`：A 組 12 件、B 組 8 件。
- 依 EWP 蝦皮商品說明／標題整理品牌、型號、short_description（草稿）、規格（每項標示 source）、規格變體名稱、注意事項；移除保固與蝦皮站內用語，原文保存於 `review.source_description`。
- 每件新增 `review.missing`（待補清單）、`review.specs_confirmed:false`、`review.shopee_url_verified:false`、`review.batch`。
- 價格、供貨、published、id、slug 皆未變更；其餘 220 件未更動。
- 電池與無線電相關 5 件、整機 3 件新增 `compliance`（status: pending）。
- 三款整機設為 `listing_mode: showcase`（作品介紹）：不顯示價格、供貨與蝦皮按鈕、不輸出 Product 結構化資料。

### 資料規則
- 新欄位 `listing_mode`（sale／showcase）、`compliance`（pending／cleared／not_required）、圖片 `rights`（ewp_own／licensed）。
- 公開條件：圖片必須標示使用權；合規 pending 不得以販售模式公開；整機必須設定 listing_mode，以 sale 公開須合規 cleared。

### 工具與文件
- `scripts/add-images.mjs`：把 EWP 自有／授權照片壓縮為 1200／600px WebP 並寫入商品資料（sharp；CI 自我測試）。
- `scripts/report-first-batch.mjs` → `docs/FIRST_BATCH_REVIEW.md` 與 `docs/first-batch-review.csv`（Excel 可開；CI 檢查與資料一致）。

### 測試
- 單元測試 42 → 57 項；端對端測試 80 → 114 項（地址提示文字、手機可讀性與對比、結構化資料、服務頁用語、作品介紹模式、規格與變體）。

## v2.1.0（2026-10-22，ChatGPT 第一輪審查修正）

### 安全／部署
- 改由 GitHub Actions 建置並只發布 `dist/`（`.github/workflows/pages.yml`）。`src/`、`scripts/`、`tests/`、`docs/`、`_preview/` 不再發布，草稿 JSON 無法從網站讀取。**需把 Pages Source 改為 GitHub Actions**（見 docs/DEPLOY_ROLLBACK.md）。
- 移除 repo 根目錄的產生檔（index.html、products/ 等）與 `.generated.json`；建置每次清空輸出資料夾，拒絕輸出到 repo 根目錄。
- 新增發布白名單檢查：產物出現 `.json`、`.mjs`、`.md`、`src/`、`scripts/` 等即失敗。
- 審核條件修正：`review` 必須存在且 `status === "approved"` 才能公開（原本 review 缺失時可能通過）。
- 圖片路徑驗證強化：禁止 `..`、反斜線、非圖片副檔名、超出 `assets/`。

### 內容
- 聯絡頁加入 Instagram QR（EWP 原檔，以 CSS 裁切中央卡片，與 LINE QR 同尺寸；兩組 QR 於手機版畫面截圖解碼驗證）。
- 營業登記資訊：電翼動力航模企業社、統一編號、登記地址（頁尾、關於、聯絡；Organization 結構化資料）。稅籍編號不公開。
- 隱私權說明改為未核准草案（noindex、標示待核對、不在頁尾與 sitemap）。
- 新增「淘寶／中國平台代購」服務頁。
- 十安聯名電池標示為聯名商品；2 件非 FPV 玩具標記 rejected 不產生。
- 商品頁 CTA 優先序：一般現貨蝦皮優先，EWP 自製整機／電池、組裝、服務 LINE 優先；新增 `cta_primary` 欄位。
- docs/FIRST_BATCH.md：首批 20 件公開建議名單。

### 測試
- CI 加入 Playwright 端對端測試與手機版 Lighthouse（報告上傳為 artifact）。
- 單元測試由 11 項增至 42 項（審核 5＋情境、路徑、白名單、預覽隔離、舊檔 SHA-256）。
- 端對端測試由 49 項增至 80 項（含原始碼／草稿 JSON 404、IG／LINE QR、營業登記、CTA 優先序、手機 CLS）。
- 效能：商品列表篩選面板改由 CSS 收合、伺服器端決定可用篩選器，手機 CLS 0.31 → 0；Lighthouse 手機 7 頁 Performance 0.90–1.00，其餘三項皆 1.00。

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
