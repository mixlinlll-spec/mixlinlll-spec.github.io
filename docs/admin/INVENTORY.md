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
- 防跨站請求（只接受同網域 JSON）、禁止被嵌入、不被搜尋引擎收錄、不快取。

## 三、資料怎麼同步

```
GitHub 商品資料（Pages CMS 修改）──► 部署流程 inventory.yml ──► D1：商品名稱／規格／官網供貨狀態
                                            （只同步公開資訊，絕不修改庫存數字）
庫存後台（你操作）──────────────────────────► D1：庫存數量、異動紀錄
```

- `main` 的商品資料有變動時自動同步（新增規格會出現、刪除的規格會停用但保留紀錄）。
- 也可在 GitHub → Actions →「庫存後台（Cloudflare Worker＋D1）」→ Run workflow 手動同步。

## 四、第一次設定（只需做一次）

1. **Cloudflare 帳號**：到 https://dash.cloudflare.com 註冊（免費方案即可）。
2. **建立 API Token**：My Profile → API Tokens → Create Token → Create Custom Token：
   - Account → **Workers Scripts：Edit**
   - Account → **D1：Edit**
   - Account → **Account Settings：Read**
   - Account Resources：只選你的帳號
3. **複製 Account ID**：Cloudflare 後台首頁右側（或 Workers & Pages 頁面）的 Account ID。
4. **GitHub Secrets**：repo → Settings → Secrets and variables → Actions → New repository secret：
   - `CLOUDFLARE_API_TOKEN`＝步驟 2 的 Token
   - `CLOUDFLARE_ACCOUNT_ID`＝步驟 3 的 ID
   （Secrets 加密保存，不會出現在公開 repo 或紀錄中。）
5. **部署**：GitHub → Actions →「庫存後台（Cloudflare Worker＋D1）」→ Run workflow（選本 PR 的分支或 main）。完成後摘要頁顯示入口網址。
6. **啟用登入保護**：Cloudflare 後台 → Workers & Pages → **ewp-inventory** → Settings → Domains & Routes → workers.dev 那一列 → **Enable Cloudflare Access**。
   - 在「Manage Cloudflare Access」加入可以登入的 Email（你自己、需要的員工）。
   - 視窗會顯示 `POLICY_AUD` 與 `TEAM_DOMAIN`：到 ewp-inventory → Settings → Variables and Secrets 新增兩個變數
     `ACCESS_AUD`＝POLICY_AUD、`ACCESS_TEAM_DOMAIN`＝TEAM_DOMAIN（例如 `https://xxx.cloudflareaccess.com`）。
   - Cloudflare Zero Trust 第一次使用時需要選一個團隊名稱並選免費方案（50 人以內免費；Cloudflare 可能要求綁定付款方式，免費方案不會扣款）。
7. 打開入口網址 → 輸入 Email → 收驗證碼 → 登入 → 開始盤點。

> 步驟 6 的兩個值不是密碼，也可以交給 Claude 設成 GitHub Variables（`INVENTORY_ACCESS_AUD`、`INVENTORY_ACCESS_TEAM_DOMAIN`）。

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
