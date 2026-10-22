# EWP 商品管理後台（Pages CMS）

**使用方式**：打開 https://app.pagescms.org → 選 `mixlinlll-spec.github.io` → 商品 → 搜尋 → 修改 → **Save**。
儲存後約 1–3 分鐘，系統自動檢查並更新網站（上線後；測試期間見「測試方式」）。

---

## 一、第一次設定（只有 repo 擁有者能做）

1. 用 GitHub 帳號登入 https://app.pagescms.org 。
2. 依畫面安裝 **Pages CMS GitHub App**，選 **Only select repositories → `mixlinlll-spec.github.io`**（不要給全部 repo）。
   App 需要的權限：Contents 讀寫（儲存商品）、Actions 讀寫（批次修改、匯入、還原按鈕）、Metadata 讀取。
3. 進入 repo 後，左上角分支切到：
   - 測試期間：`feature/product-admin`
   - 上線後：`main`
4. 給員工使用：Pages CMS 的 **Collaborators** 用 Email 邀請，對方不需要 GitHub 帳號，只能編輯，不能改設定或刪除 repo。
   員工離職時在同一頁移除即可。

> 不需要、也不應該把任何密碼或金鑰放進 repo。登入與權限由 GitHub／Pages CMS 處理；
> GitHub Actions 只使用 GitHub 自動提供、每次執行後失效的 `GITHUB_TOKEN`。

## 二、後台能做什麼

| 需求 | 做法 |
|---|---|
| 搜尋商品 | 商品列表上方搜尋：名稱、品牌、型號、SKU、商品 ID、蝦皮商品 ID |
| 改名稱、說明、分類、品牌、規格表、標籤 | 打開商品直接改 → Save |
| 改價格 | 「官網售價」或各「規格」的售價。有規格時商品價自動取最低規格價（多價＝「起」） |
| 改為詢價 | 「價格顯示方式」選「詢價」→ 商品價與規格價都不顯示 |
| 上架／下架 | 「上架（公開在官網）」開關。**未核准（review 不是 approved）的商品無法上架**，勾了也會自動退回草稿 |
| 供貨狀態 | 現貨／預購／接單製作／缺貨／請洽詢（商品與各規格都可設） |
| 庫存數量 | 各規格「庫存數量」；沒有規格的商品用上方「庫存數量」。**僅後台記錄、不公開顯示、不是即時庫存**（第二階段 Cloudflare D1 才做即時扣庫存） |
| 照片 | 上傳、替換、拖曳排序、刪除；第一張是主圖。新照片儲存後自動轉 WebP（1000px＋480px 縮圖）並搬到商品資料夾 |
| 批次修改 | 商品列表右上「批次修改」：上架、下架、供貨狀態、價格 ±%、設定價格、改詢價。**先選「只預覽」**看結果，再選「套用」 |
| 蝦皮 CSV 匯入 | 先在「Media → 匯入檔」上傳 CSV，再按「匯入蝦皮 CSV」。預覽會列出變更與錯誤報告；套用後自動刪除匯入檔 |
| 查看紀錄 | 商品頁右側 **History**：每次儲存的時間與操作者；GitHub Actions 摘要頁列出改了哪些欄位 |
| 還原 | 商品頁「還原這件商品到指定版本」，填 History 裡的版本代碼（commit SHA） |

不能做（刻意限制）：新增商品、刪除商品、改商品 ID／網址代稱／蝦皮規格 ID、改審核狀態（review）。
新商品請用蝦皮匯入工具建立草稿，核准上架由 EWP 確認後執行。

## 三、儲存後發生什麼事

```
後台 Save ──► GitHub commit「[後台] 更新 sp-xxx.json（操作者）」
           └► .github/workflows/cms-sync.yml
                1. scripts/cms-normalize.mjs  校正（見下）
                2. 驗證資料＋單元測試＋建置＋發布白名單檢查
                3. 提交校正結果（chore(後台): …）
                4. 在 main 上觸發 pages.yml 部署 → 網站更新
              失敗：不部署（網站維持上一個正確版本）＋自動開 GitHub Issue 通知
```

`pages.yml` 與 `ci.yml` 會略過「[後台]」原始 commit，只部署校正並驗證過的內容。

## 四、為什麼需要「儲存後校正」（Pages CMS 的限制與補強）

以 Pages CMS 2.1.8 原始碼確認（`app/api/[owner]/[repo]/[branch]/files/[path]/route.ts`、`lib/schema.ts`）：

| Pages CMS 行為 | 不處理的後果 | 補強 |
|---|---|---|
| 只保留 `.pages.yml` 有定義的欄位 | `review`（審核、蝦皮快照）、`source_media` 整個消失 | `settings.content.merge: true` |
| merge 時陣列（variants、images、specifications）整個覆蓋 | 規格 ID、規格圖、圖片使用權／尺寸消失 | 陣列每個子欄位都在 `.pages.yml` 宣告（不給改的設 hidden／readonly） |
| 儲存時刪除全檔所有 `null`、`""`、`[]`、`{}` | `sku:null`、`tags:[]`、`price_twd:null`… 不見，原本的驗證會失敗 | `cms-normalize` 以儲存前版本為準放回空值，保持原鍵順序與格式 |
| 前端送出的資料可被竄改 | 可改 id／slug／review | `cms-normalize` 一律以儲存前版本的 id、slug、review、規格 ID 為準 |
| 沒有批次、匯入、還原 | — | Pages CMS Actions 按鈕觸發 `admin-bulk.yml`、`admin-import.yml`、`admin-restore.yml` |

**驗證**：`tests/pages-cms-roundtrip.mjs` 直接打包 Pages CMS 原始碼（固定 commit `6f4e860`，2.1.8），對全部商品模擬「開啟 → 不修改 → 儲存 → 校正」，結果必須與原檔逐字相同；
並測試改名、改價、改庫存、詢價、上下架、未核准上架、照片排序／刪除／上傳、竄改唯讀欄位、新增規格與端對端 git 流程。CI 每次都會跑。

### 修改 `.pages.yml` 的規則
1. `settings.content.merge` 必須是 `true`。
2. 在 `variants`、`images`、`specifications` 加欄位時，商品資料裡出現的每個子欄位都要宣告（測試會檢查）。
3. 新增可修改的商品欄位時，同步更新 `scripts/lib/cms.mjs` 的 `EDITABLE_PRODUCT_KEYS`（測試會比對）。
4. commit 範本必須以 `[後台]` 開頭，校正流程靠它辨識後台儲存。
5. Pages CMS 升級時，先更新 `ci.yml` 裡固定的 commit，讓往返測試用新版本跑過再使用。

## 五、測試方式（上線前）

目前正式網站仍是舊版 `main`，`feature/product-admin` 不會更新正式網站。

1. 依「一、第一次設定」登入並安裝 App，分支切到 `feature/product-admin`。
2. 商品 → 搜尋「T15」→ 打開 → 改名稱或某個規格價格 → Save。
3. GitHub → Actions → 「商品後台儲存後校正與發布」：Summary 會列出操作者、時間、修改前後內容；應該是綠色。
4. 試著把一件草稿商品（例如搜尋「僱傭兵」）勾「上架」→ Save → Summary 顯示「尚未核准，已自動退回草稿」。
5. 上傳一張照片到某商品 → Save → 確認商品資料夾出現 `u-xxxx.webp` 與 `-480.webp`。
6. 「批次修改」「匯入蝦皮 CSV」「還原」按鈕在測試分支也可使用（流程已在 GitHub 登記）。按下後可在 Pages CMS 的 Actions 頁或 GitHub Actions 看到結果與報表。
7. 測試完成後可以用「還原」或告訴 Claude 還原測試修改。

## 六、上線（需要 EWP 同意）

1. GitHub → Settings → Pages → Source 改為 **GitHub Actions**（見 `docs/DEPLOY_ROLLBACK.md`）。
2. 合併 PR #1（新網站）與本 PR 到 `main`。
3. Pages CMS 分支切到 `main`。之後「後台 Save → 網站自動更新」，不需要處理 PR。

## 七、第二階段（規劃，與本階段相容）

即時庫存、下單保留／扣庫存改由 Cloudflare Workers＋D1 處理（`docs/ecommerce/`）。屆時：
- 網站可售庫存以 D1 為準；後台的 `stock_qty` 改為 D1 的初始值／對帳參考。
- 蝦皮匯出的庫存只作為「蝦皮快照」，不當成即時庫存；蝦皮官方 API 只預留介面，不假設已取得權限。
- 管理員登入改用 Cloudflare Access 權限控管；所有金鑰只放 Cloudflare Secrets，不進前端與 GitHub。
