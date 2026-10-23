# EWP 庫存管理（私有庫存後台）

**入口**：`https://ewp-inventory.<你的 Cloudflare 子網域>.workers.dev`（第一次部署後顯示在 GitHub Actions 摘要頁，也可在 Cloudflare 後台 Workers & Pages → ewp-inventory 看到）。
用手機或電腦瀏覽器打開，以 Cloudflare Access 寄到 Email 的驗證碼登入。

- **商品資料**（名稱、價格、上下架、現貨／預購）→ Pages CMS 商品後台（公開資料，GitHub）
- **庫存數量** → 這個庫存後台（私有，Cloudflare D1）。庫存數字**不會**出現在 GitHub、官網、Actions 紀錄。

---

## 一、可以做什麼

| 功能 | 說明 |
|---|---|
| 搜尋 | 商品名稱、規格名稱、品牌、SKU、蝦皮商品 ID；篩選「尚未盤點」「可售 0」「需注意」 |
| 每個規格獨立管理 | SKU＝`EWP-SP<蝦皮商品ID>-<蝦皮規格ID>`（單一規格為 `-0`），與商品後台的規格一一對應 |
| 三種數量 | **實際庫存**（倉庫裡有的）、**已保留**（未來官網訂單付款前保留，目前為 0）、**可售**＝實際−保留 |
| 盤點確認 | 輸入實際數量並標記「已盤點」（第一次使用請逐一盤點） |
| 入庫 | 進貨、退貨回庫、盤盈… |
| 出庫／扣庫 | 蝦皮訂單出貨、官網／LINE 訂單出貨、組裝使用、損壞報廢、盤虧… |
| 修改為 | 直接改成某個數量（手動修正） |
| 異動紀錄 | 每次修改記錄：操作者 Email、時間、修改前→後、增減、原因 |
| 完整清單 | 每次載入 100 個規格，「載入更多」可看完全部；搜尋與篩選在資料庫完成，涵蓋全部規格 |
| 已停用（仍有庫存） | 規格從商品資料刪除後，SKU 停用但庫存與紀錄保留；可「移轉」到同商品的其他規格或「出庫」 |
| 歸零提醒 | 已盤點的規格可售為 0、但官網顯示「現貨」→ 黃色警告並附「開啟商品後台」連結，提醒改成缺貨或預購；官網是「預購／接單製作」時只顯示提示（可繼續接單） |
| 回到商品後台 | 每件商品旁有「商品後台 ↗」連結，直接開啟 Pages CMS 的該商品 |

### 10/22 蝦皮庫存只是參考
匯入時的蝦皮庫存（2026-10-22）只顯示為「10/22 蝦皮快照（參考）」，**不會**當成庫存。
所有規格一開始的實際庫存都是 0、狀態「尚未盤點」；請用「盤點確認」輸入今天的實際數量。尚未盤點的規格不會出現歸零警告（數量未知）。

## 二、安全與正確性

- **登入**：整個網址由 Cloudflare Access 保護，只有你加入的 Email 能登入；Worker 另外驗證 Access 憑證（簽章、發行者、應用程式 AUD、有效期）。
  尚未設定 Access 時，網頁一律顯示「尚未設定 Cloudflare Access」並拒絕所有人（不會意外公開）。
- **不允許負數**：資料庫限制實際庫存 ≥ 0、已保留 ≤ 實際；出庫只在「扣完 ≥ 已保留」時才成功。
- **多人同時修改**：「修改為」「盤點確認」帶著打開時的版本號，期間有人改過就拒絕並顯示最新數量；入庫／出庫為原子增減，同時 20 筆出庫也不會超扣（已測試）。
- **重複送出**：每次操作有唯一編號，網路重試不會重複扣庫存。
- **紀錄與修改同一交易**：不會出現「數量變了但沒有紀錄」。
- **移轉是原子的**：來源扣庫、目標入庫、兩筆紀錄與完整性檢查在同一個交易；任何一步不成立（目標被停用、來源不足、保留量不夠）整筆回復，兩邊數量、版本與紀錄都不變。
- 防跨站請求（只接受同網域 JSON）、禁止被嵌入、不被搜尋引擎收錄、不快取。

## 三、資料怎麼同步

```
GitHub 商品資料（Pages CMS 修改）──► 部署流程 inventory.yml ──► D1：商品名稱／規格／官網供貨狀態
                                            （只同步公開資訊，絕不修改庫存數字）
庫存後台（你操作）──────────────────────────► D1：庫存數量、異動紀錄
```

- 同步時機：`main` 的商品資料更新，或商品後台的「校正／批次修改／還原」流程**完成之後**（同步的是校正完成的資料）。
- 同步前檢查：商品資料通過驗證、沒有尚未校正的後台儲存、每個規格都有固定身分、商品數沒有驟減一半以上；任一項不符就不同步。
- 同步只更新名稱、規格、官網供貨狀態；**不寫入庫存數字與紀錄**，同步失敗時庫存與紀錄完全不變（已測試）。
- 規格身分：有蝦皮規格 ID 用它，沒有的用商品後台產生的固定識別碼 `key`。改名、排序不影響；刪除的規格停用（庫存保留）、加回時重新啟用原 SKU。

## 四、第一次設定（只需做一次）

**順序：先合併商品後台 PR #4，再合併本 PR #7。**（PR #7 需要 PR #4 為規格加上的固定識別碼；順序反了，商品同步會安全地停下、不改任何資料。）
部署只會由 `main`（審查合併後的版本）執行；其他分支拿不到 Cloudflare 金鑰。

1. **Cloudflare 帳號**：到 https://dash.cloudflare.com 註冊（免費方案即可），並打開一次 **Workers & Pages** 頁面，讓 Cloudflare 建立你的 `workers.dev` 子網域。
2. **建立 API Token**（My Profile → API Tokens → Create Token → **Create Custom Token**），只給這個帳號、以下權限：
   - Account → **Workers Scripts：Edit**（部署 Worker）
   - Account → **D1：Edit**（建立資料庫、套用結構、同步商品清單）
   - Account → **Account Settings：Read**（部署工具讀取帳號資訊）
   - Account Resources：**Include → 你的帳號**；不需要任何 Zone 權限、不需要 Access／Zero Trust 權限
   - 建議設定到期日（例如一年），到期前更新 GitHub 裡的值即可
   > 如果第一次部署出現權限不足的訊息，改用 Cloudflare 官方的「Edit Cloudflare Workers」範本再加上 D1：Edit（範本權限較多）。
3. **GitHub 受保護環境**：repo → Settings → **Environments** → New environment，名稱 **`inventory-production`**：
   - Deployment branches and tags → **Selected branches and tags** → 新增規則 **`main`**
   - 在這個環境裡新增兩個 **Environment secrets**：`CLOUDFLARE_API_TOKEN`（步驟 2 的 Token）、`CLOUDFLARE_ACCOUNT_ID`（Cloudflare 後台首頁右側的 Account ID）
   - 請放在環境裡、**不要**放在 repo 層級的 Secrets，這樣只有 main 能用。**Token 不要貼到聊天或任何訊息裡。**
4. **部署**：PR #4、PR #7 依序合併到 main 後會自動部署。若合併時還沒設定好步驟 3，設定完成後到 GitHub → Actions →「庫存後台（Cloudflare Worker＋D1）」→ **Run workflow**（分支選 main）。
   （這個按鈕要等本 PR 合併到 main 後才會出現；GitHub 規定手動執行的流程必須先存在預設分支。）完成後摘要頁顯示入口網址。
5. **啟用登入保護**：Cloudflare 後台 → Workers & Pages → **ewp-inventory** → Settings → Domains & Routes → workers.dev 那一列 → **Enable Cloudflare Access**。
   - 「Manage Cloudflare Access」加入可以登入的 Email（你自己、需要的員工）。
   - 視窗顯示的 `POLICY_AUD` 與 `TEAM_DOMAIN`：到 ewp-inventory → Settings → Variables and Secrets 新增 `ACCESS_AUD`、`ACCESS_TEAM_DOMAIN`（`https://xxx.cloudflareaccess.com`）。這兩個不是密碼。
   - 第一次使用 Cloudflare Zero Trust 需要選團隊名稱與免費方案（50 人以內免費；可能要求綁定付款方式，免費方案不扣款）。
6. 打開入口網址 → 輸入 Email → 收驗證碼 → 登入 → 用「尚未盤點」篩選開始盤點。

## 五、本機預覽與測試

```bash
node inventory/test/dev-server.mjs          # http://localhost:8790（假登入、記憶體資料庫）
node --test inventory/test/inventory.test.mjs
node inventory/test/ui.e2e.mjs              # 需要 playwright
```

## 六、第二階段（之後）

- 官網下單：付款前保留（`stock_reserved`）、付款後扣庫、取消釋放（資料表已預留 reserve／release／sale／cancel 紀錄類型）。
- 蝦皮：蝦皮訂單同步扣庫（需要蝦皮開放平台權限，不假設已取得）；蝦皮匯出檔只做「比對」不直接覆蓋。
- 綠界付款、可售數量自動連動官網供貨狀態。
- 細分權限（例如員工只能入庫、不能修改為）。
