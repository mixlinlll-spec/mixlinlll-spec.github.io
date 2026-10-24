# CHANGELOG

## v2.15.0（2026-10-25，黑盒子資料募集頁）

- 新增 `/blackbox/`（免費提供黑盒子資料）：向 LINE 群客戶收集飛機規格（尺寸、飛塔、電機與 KV、電池、槳葉等）、Betaflight `diff all` 與黑盒子紀錄，內含 DIFF 與黑盒子（SD 卡／內建 Flash／SpeedyBee App）匯出教學。
- 檔案只在瀏覽器內檢查、不上傳：DIFF 判斷韌體版本、飛控、是否為 diff all；黑盒子讀檔頭判斷紀錄段數、韌體、記錄速率、是否含 GPS。
- 送出方式：產生資料單編號（`EWP-BB-YYMMDD-XXXX`）與資料檔（規格＋DIFF），由客戶在 LINE 官方帳號私訊傳送資料檔與黑盒子檔；手機支援直接分享。填寫中的規格暫存在客戶自己的瀏覽器。
- `blackbox/` 加入發布白名單並列入 sitemap。

## v2.14.0（2026-10-24，首頁經銷品牌）

- 首頁「型錄」區塊下方新增「經銷品牌」：GEPRC、KONKER 空氪、十安、MAD Components、FDI。Logo 統一為白色單色（`assets/img/brands/`），滑鼠移上去變亮；點選連到 `/products/?brand=…` 該品牌商品。
- 新增或移除品牌：修改 `scripts/build.mjs` 的 `BRANDS`，第三欄必須和商品的 `brand` 欄位完全相同。

## v2.13.1（2026-10-24，圖傳教學加入實物照片）

- 〈FPV 圖傳新手學堂〉VTX、鏡頭、天線章節加入實物照片（GEPRC RAD Mini、DJI O4 Air Unit、Foxeer Razer Nano、棒棒糖／信天翁／IPEX 天線），使用官網已上架商品的圖片，並連到對應商品頁。

## v2.13.0（2026-10-24，FPV 圖傳新手教學）

- 新增互動教學頁 `/learn/fpv-video/`（FPV 圖傳新手學堂）：類比與數位差異、訊號模擬器、規格與延遲比較、VTX／鏡頭／天線說明、圖傳系統選擇分支圖、常見錯誤與小測驗；列入 sitemap。
- EWP 專欄新增文章〈FPV 圖傳新手學堂〉。

## v2.12.0（2026-10-24，「最新消息」改名 EWP 專欄＋LiPo 新手教學）

- 「最新消息」改名為「EWP 專欄」，從「更多」選單移到上方導覽列（知識庫與關於之間）；手機選單、頁尾、麵包屑一併改名，網址維持 `/journal/` 不變。移除只剩一項的「更多」選單。
- 新增互動教學頁 `/learn/lipo-battery/`（FPV LiPo 電池新手學堂）：12 章內容、5 張示意圖、電壓換算／充電電流／電池健康檢查／瓦時登機判斷工具與小測驗。獨立靜態頁，`learn/` 加入發布白名單並列入 sitemap。
- EWP 專欄新增文章〈FPV LiPo 電池新手學堂〉，連到互動教學頁。

## v2.11.0（2026-10-24，商品後台可以新增商品）

- 商品後台開放「新增商品」：新商品先存成 `new-日期時間.json`，儲存後由 `cms-normalize` 產生正式商品 ID（`ewp-YYMMDD-xxxx`）並改檔名、產生網址代稱，存成草稿（`review.source = cms`），並在 GitHub 開通知。
- 自動分類與品牌（`scripts/lib/classify.mjs`）：名稱關鍵字規則＋相似商品比對；現有商品回測主分類約 89% 正確，判斷不出來就留空並提醒。品牌只認寫在名稱最前面、已存在的品牌。自己選的分類、品牌不會被覆蓋。
- 新欄位「新商品審核」：只對後台新增的商品有效，勾選後核准（記錄審核人與日期），可與「上架」同一次儲存。原有商品、蝦皮匯入草稿、退件商品勾選無效。勾選欄位不寫入商品資料。
- 主分類改為後台選填；公開商品仍必須有分類，原有商品清空分類會自動還原。沒有分類的草稿不產生任何頁面。
- 庫存後台 SKU：後台新增的商品為 `EWP-YYMMDD-XXXX-…`（原有商品不變）。
- 測試：後台工具單元測試新增 8 項、Pages CMS 往返測試新增 11 項（空白表單預設值、新檔名、自動分類、照片轉檔、通知、審核＋上架、原有商品勾審核無效）。

## v2.10.2（2026-10-24，商品後台介面整理）

- 編輯頁欄位改為常用順序：名稱、上架、供貨、價格 → 簡短介紹、詳細說明、規格表、標籤 → 規格選項 → 照片 → 品牌分類 → 顯示設定；商品 ID 等唯讀欄位移到最下面。
- 規格選項、照片、規格表改為可收合，收合時顯示摘要（規格名稱與價格、規格項目與內容）。
- 詳細說明加上寫法提示（【小標題】、・清單、空行分段；保固與七日鑑賞期由網站自動顯示）。
- 商品列表多顯示「品牌」欄，可依品牌排序。
- 編輯頁寬度由 Pages CMS 固定（約 768px），無法從設定檔調整。

## v2.10.1（2026-10-24，修正：後台儲存被自動測試擋下）

- v2.10.0 新增的「受保護欄位與 origin/main 相同」單元測試，在後台儲存後的檢查流程中也會執行，導致所有修改上下架、價格、供貨的正常儲存都被判定失敗、網站沒有更新。已移除這項自動測試，比對程式 `scripts/check-protected-fields.mjs` 改為大量修改文案時手動執行。

## v2.10.0（2026-10-24，商品文案、品牌分類與購買須知整理）

- 公開現貨／預購商品 214 件中改寫 212 件的標題、短說明、說明、規格表與標籤（2 件因內容矛盾保留原文待確認）；缺貨 24 件與退件 2 件依規則不改寫。
- 說明改成固定段落（【產品特色】【規格】【包裝內容】【注意事項】…），網站把 `【標題】` 顯示為小標題、`・` 開頭的行顯示為清單。
- 移除各商品內的「訂製商品無法退貨」「保固三個月」「恕不負責」「不在保固範圍」等字句，以及未附證明的 BSMI／UN38.3、防爆、100% 等宣稱；顏色選擇改為說明「從既有顏色挑選不屬客製，仍適用七日鑑賞期」。
- 新增 `src/data/notices.json`：每個商品頁（含缺貨）最下方顯示「購買與使用須知」＝分類用途提醒（整機、電池、電子、馬達槳葉、工具…）＋統一售後說明（保固、七日鑑賞期、客製定義、蝦皮平台規範、到貨檢查）。
- 品牌統一 16 件（EWP 自製→「電翼動力 EWP」、第三方配件不再標 DJI、補上 KONKER、T-MOTOR、TATTU、OVONIC、MGC、BETAFPV、MECHANIC 維修佬、靈雀 Spirit Sparrow 等）；分類修正 5 件（機架板件、COB 燈條、TPU 列印件、電源模組）。
- 未變動：商品 ID、網址、蝦皮商品與規格 ID、規格選項、SKU、價格、供貨狀態、發布與審核狀態、圖片與使用權、銷售身分。新增 `scripts/check-protected-fields.mjs` 比對檢查；D1 同步 SQL 前後比對規格身分 905 個、SKU 904 個完全相同。
- 單元測試新增 4 項：售後文字一字不差、分類提醒對應、禁用字詞、所有商品頁都有須知（受保護欄位檢查改為手動執行，見 v2.10.1）。人工確認清單見 `docs/admin/PRODUCT_CONTENT.md`。

## v2.9.0（2026-10-24，最新消息上線＋第一篇文章）

- 「最新消息」由空白頁改為文章列表與文章頁：`/journal/` 列表（最新一篇以大卡片呈現）、`/journal/<slug>/` 文章頁（封面、分類、日期、內文、相關頁面按鈕、BlogPosting 結構化資料、OG 圖片用封面），文章加入 sitemap。
- 文章來源 `src/data/journal/<slug>.md`（frontmatter＋精簡 Markdown），圖片放 `assets/img/journal/<slug>/`；影片只用 `youtube_id` 嵌入，不放影片檔。內文 HTML 一律轉義，連結只接受站內、https、mailto。
- 驗證：公開文章必須有標題、日期、分類、摘要、封面與替代文字，圖片必須存在，內文不得殘留「待確認」標記；`published: false` 為草稿，只出現在預覽版。
- 第一篇文章「電翼動力官網正式上線｜新網域 www.ewpfpv.com」：圖片為官網實際畫面截圖（WebP，每張 60–90 KB）；說明官網標價比蝦皮低約 4%，透過 LINE 以官網標價下單（EWP 2026-10-24 確認可公開）。
- 文章圖片自動帶入寬高，避免載入時版面跳動。單元測試新增 6 項（共 71 項）。

## v2.8.1（2026-10-23，首頁影片自動播放）

- 首頁影片改為頁面載入完成後自動播放（靜音，瀏覽器規定；觀眾可在播放器開聲音）。先顯示封面，`load` 後才換成 youtube-nocookie 播放器，不影響首頁首次顯示速度。
- 開啟省流量模式（Save-Data）的裝置不自動播放，維持點擊播放；`site.json` `home_video.autoplay` 可切換。

## v2.8.0（2026-10-23，首頁最上方加入 KD7 X8 組裝影片）

- 首頁最上方新增 YouTube 影片區塊（KD7 X8 影視機組裝紀錄，標示為開發紀錄）；原本「從親手組裝，到自由飛翔」與幻海報整段移到影片下方，內容不變。
- 影片設定集中在 `site.json` 的 `home_video`（換影片只需改 `youtube_id`，`enabled: false` 可關閉）。
- 點擊前只顯示封面與播放鍵，不載入 YouTube 播放器；點擊後以 youtube-nocookie 在原位播放（`rel=0`）。沒有 JavaScript 時封面連到 YouTube。電腦版影片依螢幕高度縮放，影片與標題在第一屏內。
- e2e 新增 16 項：區塊順序、h1 不變、點擊前不載入、16:9、第一屏、連結與點擊播放。

## v2.7.0（2026-10-23，自製機型目錄改用商城商品資料）

- 「EWP 自製機型」改為七款原創機型目錄：幻、毒牙、裂顎、迅矢、一閃、戈布（2.5 吋）、哨兵（3.5 吋），以商品 ID 對應商城商品。
- 卡片圖片、價格、供貨狀態與連結在建置時從 `src/data/products/<id>.json` 讀取（主圖為商品第一張圖，不另存副本）；整張卡片點擊直接進入商城商品頁。商品下架時該機型自動不顯示。
- `builds.json` 只保留機型名稱、尺寸、用途、簡介與 `product_id`，不再存商品圖片或規格；長航系列、X8 影視機設為 `listed: false`（保留資料、不顯示）。
- 舊的 `/builds/<slug>/` 詳情頁改為導向頁（noindex＋canonical）：已上架機型導向商城商品頁，其他導回 `/builds/`；sitemap 移除舊詳情頁。首頁精選機型連結改為商品頁。
- 版面：手機 1 欄、平板 2 欄、電腦 3～4 欄，卡片等高，1:1 圖片完整顯示（不裁切機身與槳葉）。
- 建置驗證：上架清單中的機型必須對應存在、EWP 原創、不重複的商品。新增單元測試（七款對應、連結與主圖、換圖同步、下架隱藏）與 e2e（四種寬度排版、點擊、舊網址導向）。

## v2.6.0（2026-10-23，聯絡頁四卡片、Instagram 改為 @ewp.fpvlab）

- 聯絡頁改為四張結構一致的卡片：LINE、蝦皮賣場、Email、Instagram。每張依序為標題、說明、1:1 圖片（同尺寸）、說明文字、按鈕；同列以 CSS subgrid 對齊，按鈕位置與高度一致。手機 1 欄、平板 2 欄、電腦 4 欄。
- 蝦皮新增 EWP 提供的 QR 圖（解碼為 https://shopee.tw/mixlin）；Email 新增 EWP 聯絡圖與「寄信給 EWP」按鈕（mailto，預填主旨）；LINE 沿用原 QR。
- Instagram 全站改為 EWP 主帳號 @ewp.fpvlab（聯絡頁、頁尾、結構化資料 sameAs），新 QR 解碼為 instagram.com/ewp.fpvlab；移除舊的靈雀電池 QR 圖檔。
- 建置驗證四張聯絡圖檔都存在；e2e 測試檢查四個按鈕連結、圖片載入與尺寸、平板／電腦同列對齊。

## v2.5.4（2026-10-23，規格識別碼）

- 沒有蝦皮規格 ID 的規格新增固定識別碼 `variants[].key`（`v-` 加 8 碼），庫存後台以它對應 SKU：改名、排序、刪除其他規格都不會換身分。
- 後台（Pages CMS）隱藏欄位保存 key；校正程式依蝦皮規格 ID → key 對應，新規格自動產生 key，竄改或重複的 key 會還原。CSV 匯入同名規格沿用原 key。
- 驗證：沒有蝦皮規格 ID 的規格必須有 key、不可重複；既有 2 個規格（sp-51454902343）已補上。
- `export-stock-for-d1.mjs` 移除 D1 不接受的交易語句。

## v2.5.3（2026-10-23，修正後台商品列表 No entries）

- `.pages.yml` 商品集合加上 `filename: "{id}.json"`：Pages CMS 未設定時預設副檔名為 `.md`，240 件 `.json` 全被過濾。
- 往返測試新增列表／搜尋／儲存路徑檢查（以 Pages CMS 程式碼的過濾規則重現 No entries 與修正後 240 件），共 48 項。
- 新增 `cms-graphql-probe.yml`：以 Pages CMS 相同 GraphQL 查詢實測讀取商品資料夾（4 次皆成功，2,098 KB、1.0–4.1 秒）；CI 加入資料容量警告。

## v2.5.2（2026-10-23，部署前獨立檢查、庫存保密）

- 部署：`pages.yml` 新增獨立檢查 `cms-normalize --pending-count`（依商品檔歷史，不看最後一筆 commit 訊息），有尚未校正的後台儲存就不部署；新增「後台儲存後立刻有一般 commit」競態測試。
- 庫存保密（EWP 決定）：移除後台庫存欄位、`stock_qty`、蝦皮快照庫存（241 檔、1,152 欄位）與匯入總表庫存欄；驗證擋下任何庫存數字；匯入只處理價格；`approve-snapshot --stock` 停用。供貨狀態與網站顯示不變。
- 新增 `scripts/export-stock-for-d1.mjs`：從歷史版本匯出 D1 初始庫存（只能輸出到 repo 外）；`scripts/strip-stock.mjs`。
- 往返測試 40 項；單元測試新增庫存保密測試。

## v2.5.1（2026-10-22，商品後台：ChatGPT 審查修正）

- 分支：同步最新 `main`（PR #1 已合併、Pages 已改為 GitHub Actions 部署），PR #4 目標改為 `main`。
- 保密：停用後台 CSV 上傳與 `admin-import.yml`，移除 `admin/imports/`；`admin-import.mjs` 只在本機執行且拒絕讀取 repo 內檔案。安全匯入（R2 私有暫存＋短效上傳網址＋預覽確認）列入第二階段。
- 同時寫入：所有寫入流程共用樂觀鎖提交協定（取得最新 → 套用 → 完整驗證 → 只 fast-forward 推送；衝突就丟棄並從最新版本重做與重新驗證，不 rebase）；部署指定剛驗證的 commit，`pages.yml` 略過非 main 最新的版本。
- 失敗隔離：未通過檢查的商品退回上一個正確版本（其他商品照常發布），原始修改存 artifact 並開 Issue；仍失敗則整批退回；校正不依賴推送範圍，中斷後下次自動補做。
- 權限：按鈕設 `ref: current`，流程檢查分支一致；批次套用需要預覽產生的確認碼（含對象商品內容，資料變動即失效）。文件核對 Pages CMS 協作者實際權限。
- 測試：資料測試改為後台修改後仍成立的不變條件（不再固定上架數量、照片數量）；往返測試新增隔離與整批退回情境（36 項）。

## v2.5.0（2026-10-22，商品管理後台 MVP）

- 新增 Pages CMS 後台設定 `.pages.yml`：商品搜尋（名稱／品牌／型號／SKU／ID／蝦皮 ID）、名稱、價格、詢價、上下架、供貨狀態、各規格價格與庫存數量、照片上傳／排序、分類、品牌、說明、規格表。id、slug、蝦皮 ID、蝦皮規格 ID 唯讀；不能新增／刪除商品；review 不在後台。
- 以 Pages CMS 原始碼驗證：未開 merge 會刪除 `review`；陣列整個覆蓋；全檔 null／空值被刪。新增 `scripts/cms-normalize.mjs` 儲存後校正，全部 240 件「開啟→儲存→校正」與原檔逐字相同（`tests/pages-cms-roundtrip.mjs`，CI 用 Pages CMS 2.1.8 實際程式碼執行）。
- 上架守門：未核准商品從後台勾上架會自動退回草稿並提醒。價格規則：商品價＝最低規格價（單一價定價、多價起價），詢價清空價格（商品頁規格價也改顯示「詢價」）。
- 新照片自動轉 WebP 1000px＋480px、搬到商品資料夾、刪除原始大檔。
- 新增 `stock_qty`（商品／規格）：網站可售庫存的後台記錄，不公開顯示、不是即時庫存。
- GitHub Actions：`cms-sync.yml`（後台儲存後校正、驗證、提交、在 main 觸發部署；失敗開 Issue、不部署）；後台按鈕 `admin-bulk.yml`（批次上下架／供貨／調價／詢價，先預覽再套用）、`admin-import.yml`（蝦皮 CSV 價格／庫存＋錯誤報告）、`admin-restore.yml`（單一商品還原到指定版本）。
- `pages.yml`、`ci.yml` 略過後台原始 commit，只部署校正並驗證過的內容。
- 文件：`docs/admin/PRODUCT_ADMIN.md`（使用、權限、測試、上線、Pages CMS 限制與補強）。

## v2.4.0（2026-10-22，EWP 核准全部上架）

- 依 EWP 指示：圖片使用權確認全部可使用（`rights: "licensed"`）；套用全部蝦皮價格與庫存；**官網價 = 蝦皮價 −4%**（不經蝦皮平台抽成，四捨五入到整數元）；238 件商品 `published: true`、`review.status: "approved"`。
- 2 件非 FPV 玩具（EWP 先前決定不公開）維持 rejected，不上官網。
- 依 EWP 指示移除合規限制：刪除 `compliance` 欄位與相關驗證、整機不再強制作品介紹模式，HUAN、GOBU 哨兵、MOZ7 直接以販售模式上架。
- 驗證規則：brand、short_description、subcategory 改為選填（缺少時頁面省略該欄位，不自動編造）。
- 全部 240 件描述清理 hashtag 行、店家保固條款與蝦皮站內用語，原文保存於 `review.source_description`。
- `approve-snapshot.mjs` 新增 `--discount`、`--publish`，略過 rejected。
- 移除首批 20 件的確認表與相關工具（已由全量上架取代）。
- 結果：238 件上架（現貨 213、暫無供貨 25；單一價 137、起價 101），正式產物含 238 件商品圖片。

## v2.3.0（2026-10-22，蝦皮全量圖片與價格庫存匯入）

- 240 件商品寫入 `review.source_media`（蝦皮主圖、細節圖、規格選項圖網址）與 `review.shopee_sales_snapshot`（價格、庫存、最低購買量、規格 ID；912 列含 4 件服務型）。
- 變體改以蝦皮規格為準（`shopee_variation_id`），公開價格與供貨維持空白，待核對。
- GitHub Actions 批次匯入圖片：主圖＋細節圖 1,092／1,092、規格選項圖 303／303，失敗 0；原始 501 MB → WebP 71.5 MB。
- 雙層規格（例：顏色,型號）的選項圖以第一層對應，303 張選項圖全部對應到變體。
- 圖片 `rights: "unverified"` 只能用於草稿；正式產物只複製已公開商品的圖片。
- 新工具：`import-shopee-media.mjs`、`approve-snapshot.mjs`、`report-shopee-import.mjs`；新報告：`docs/SHOPEE_IMPORT_REPORT.md`、`docs/shopee-import.csv`、`docs/MEDIA_IMPORT_REPORT.md`、`docs/media-import-failures.csv`。
- 單元測試 57 → 65 項；端對端測試 114 → 124 項。

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
