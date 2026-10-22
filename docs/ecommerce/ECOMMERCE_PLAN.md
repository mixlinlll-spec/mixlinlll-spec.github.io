# EWP 官網線上購物與收款｜架構與實作計畫（規劃稿 v0.1）

**日期**：2026-10-22｜**狀態**：規劃，未寫任何收款程式、未建立資料庫、未申請或填入任何金鑰
**基礎**：`feature/ewp-site-v2`（commit `6910ae6`，238 件商品已上架）
**金流**：綠界 ECPay 全方位金流（AIO）— 第一階段只用**測試環境**（payment-stage）

> 所有綠界參數皆引用官方 Developers 文件（見文末「參考資料」），未自行推測。文件未寫明的事項標示「待確認」。

---

## 1. 現況盤點與結論

| 項目 | 現況 | 對電商的影響 |
|---|---|---|
| 網站 | GitHub Pages 純靜態（Actions 部署 `dist/`） | **不能執行伺服器程式**：無法驗證金流通知、無法存放金鑰、無法扣庫存 → 必須新增後端 |
| 商品資料 | `src/data/products/*.json`，238 件公開、844 個規格 | 可作為商品主檔，同步到資料庫 |
| 價格 | 已套用（蝦皮價 −4%），存在 JSON | 結帳時由**後端**重新計算，不信任前端 |
| 庫存 | 2026-10-22 蝦皮快照，只有「現貨／暫無供貨」 | 需要即時可扣減的庫存 → 資料庫 |
| SKU | **全部為空**（蝦皮「主商品貨號」「商品選項貨號」沒有填） | 需建立固定 SKU 規則（§4.2） |
| 網域 | `mixlinlll-spec.github.io` | 綠界通知網址需「合法網域、443 port」→ 建議自有網域 |
| 政策頁 | 隱私權、條款、售後退換皆「未核准」 | **正式收款前必須完成**（網路購物須告知退換貨規則） |

**結論**：保留現有靜態網站與設計，**另加一個小型後端（API＋資料庫＋排程）**。前端只新增購物車、結帳、訂單查詢頁與後台頁面。

---

## 2. 架構建議

### 2.1 首選：Cloudflare Workers＋D1（SQLite）

```
顧客瀏覽器 ──► GitHub Pages（現有靜態網站＋購物車／結帳頁）
     │                      │ fetch（JSON）
     │                      ▼
     │            api.<自有網域>  Cloudflare Worker
     │              ├─ /api/*        結帳、訂單查詢、報價付款
     │              ├─ /ecpay/*      綠界伺服器通知（ReturnURL／PaymentInfoURL）
     │              ├─ /admin/*      後台（Cloudflare Access 登入保護）
     │              ├─ Cron          逾時訂單釋放庫存、付款對帳
     │              └─ D1 資料庫     商品／SKU／庫存／訂單／付款紀錄
     │                      │ 伺服器對伺服器
     └── 表單 POST 導向 ───► 綠界 payment-stage.ecpay.com.tw（信用卡資料只在綠界頁面輸入）
```

| 理由 | 說明 |
|---|---|
| 成本低 | Workers Paid US$5／月，含 1,000 萬次請求、D1 5 GB（EWP 的訂單量遠低於上限） |
| 不用維護主機 | 無作業系統更新、無 SSH、自動 HTTPS |
| 金鑰管理 | `wrangler secret` 存在 Cloudflare，不進 GitHub、不進前端 |
| 後台登入 | Cloudflare Access（Zero Trust）以 email 一次性驗證碼保護 `/admin`，不需自寫帳密系統 |
| 排程 | Cron Triggers 做逾時處理與對帳 |

**需注意**：綠界「介接注意事項」建議 ReturnURL 使用伺服器本身網址、不要用 CDN 位址，且 CDN 可能擋掉含特殊字元的請求。Worker 本身就是執行程式的端點（不是轉送到其他主機的快取），但仍需在測試環境實測通知能否穩定送達；若有問題，備案改 VPS（§2.2）。

### 2.2 備案

| 方案 | 月費（約） | 優點 | 缺點 |
|---|---|---|---|
| VPS（Node.js＋PostgreSQL） | US$6–12 | 傳統伺服器、完全掌控、IP 固定 | 需自行更新系統、備份、監控 |
| Supabase（Postgres）＋Edge Functions | 免費版會因閒置暫停；Pro US$25 | 有現成後台與 Postgres | 金流通知不能接受暫停，實際需付費版 |

---

## 3. 綠界串接規格（官方文件）

### 3.1 環境與測試帳號

| 項目 | 測試 | 正式 |
|---|---|---|
| 產生訂單 | `https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5` | `https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5` |
| 查詢訂單 | `https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5` | `https://payment.ecpay.com.tw/Cashier/QueryTradeInfo/V5` |
| 信用卡請退款 | **無測試環境**（官方：無法提供實際授權） | `https://payment.ecpay.com.tw/CreditDetail/DoAction` |
| 測試特店 | MerchantID `3002607`（官方公開測試帳號，HashKey／HashIV 見官方頁） | EWP 申請後於廠商後台「系統設定 > 系統介接設定 > 介接資訊」取得 |
| 測試信用卡 | `4311-9522-2222-2222`；有效期限填未來月年；安全碼任意 3 碼；3D 驗證碼 `1234` | — |

> 官方公開的測試 HashKey／HashIV 也只放在 Cloudflare secret，不寫進程式碼，讓「切換正式」只需要換 secret，避免測試值混入正式設定。

### 3.2 產生訂單（AioCheckOut/V5）
- 由**前端表單 POST 導向**綠界（不可用 iframe）。後端產生全部參數與 CheckMacValue，前端只負責送出。
- 必填：`MerchantID`、`MerchantTradeNo`（String(20)、英數、不可重複）、`MerchantTradeDate`（`yyyy/MM/dd HH:mm:ss`）、`PaymentType=aio`、`TotalAmount`（整數）、`TradeDesc`、`ItemName`（以 `#` 分隔、≤400 字）、`ReturnURL`、`ChoosePayment`、`CheckMacValue`、`EncryptType=1`。
- 使用：`OrderResultURL`（瀏覽器導回頁，**只顯示「付款處理中」，不據此判定成功**）、`ClientBackURL`、`NeedExtraPaidInfo`、`CustomField1`（放內部 attempt id）。
- ATM：`ExpireDate` 1–60 天（預設 3）；CVS：`StoreExpireDate` 單位分鐘（預設 10080、上限 43200）；兩者都用 `PaymentInfoURL` 接收取號結果。
- 官方建議固定指定 `ChoosePayment`，不用 `ALL`，以免綠界新增付款方式造成通知處理失敗 → 結帳頁由顧客選「信用卡／ATM／超商代碼」，後端各自帶入對應值。
- 已知限制：iOS 的 LINE、Facebook App 內建瀏覽器可能無法完成 POST 導轉 → 結帳頁偵測後提示「用 Safari 開啟」。

### 3.3 CheckMacValue
1. 參數依名稱 A→Z 排序，以 `&` 串接
2. 前面加 `HashKey=…&`，後面加 `&HashIV=…`
3. 整串 URL encode
4. 轉小寫
5. SHA256
6. 轉大寫

PHP `urlencode` 需依官方 URLEncode 轉換表把 `%2d %5f %2e %21 %2a %28 %29` 還原為 `- _ . ! * ( )`。實作時以官方頁面的範例（MerchantID 3002607，結果 `6C51C9E6…B840`）做單元測試，與官方結果一致才上線。

### 3.4 付款結果通知（ReturnURL）— 唯一可以把訂單改成「已付款」的地方
- 綠界以 Server POST（`application/x-www-form-urlencoded`）送出；回傳 `RtnCode=1` 才是成功；其他欄位：`MerchantTradeNo`、`TradeNo`、`TradeAmt`、`PaymentDate`、`PaymentType`、`PaymentTypeChargeFee`、`SimulatePaid`、`CustomField1–4`、`CheckMacValue`。
- 我方必須回應純文字 `1|OK`；未正確回應時綠界 5–15 分鐘後重送，同日最多 4 次。
- ReturnURL 只支援 443 port、需合法網域、TLS 1.2。
- `SimulatePaid=1` 是後台模擬付款，**不可出貨、不可改為已付款**。
- 超商條碼（BARCODE）通常付款後約 2 天才通知。

**我方處理流程（全部條件都通過才改為已付款）**
1. 原文寫入 `payment_notifications`（含驗證失敗的也記錄）
2. 重算 CheckMacValue，不符 → 不處理，仍回 `1|OK` 以停止重送，並觸發後台警示
3. `MerchantID` 等於設定值；`MerchantTradeNo` 存在且屬於該訂單
4. `TradeAmt` 等於訂單金額（防竄改）
5. `SimulatePaid=0`
6. 以 `dedupe_key` 唯一索引防重複：同一通知第二次到達只回 `1|OK`，不重複扣庫存
7. 單一資料庫交易（D1 batch）完成：attempt → paid、訂單 → paid、保留庫存轉為售出、寫入事件紀錄
8. 付款金額或狀態異常（例如訂單已逾期才收到付款）→ 標記「需人工處理」，不自動出貨

**補強**：信用卡訂單另由排程在付款後約 40 分鐘呼叫查詢訂單 API（`TradeStatus=1` 為已付款）交叉確認；查詢 API 有頻率限制（過快回 HTTP 403、需等 30 分鐘），所以只查「待確認」的少量訂單。

### 3.5 退款
- **信用卡**：`CreditDetail/DoAction`，`Action` = `C` 關帳、`R` 退刷（可部分）、`E` 取消關帳、`N` 放棄。依授權狀態選擇（已授權→N；要關帳→全額 E＋N、部分 R；已關帳→R）。分期與紅利必須全額退；每日自動關帳 20:15–20:30 不可呼叫；**只能在正式環境使用**。
- **ATM／超商代碼**：官方文件未說明可用此 API 退款 → 規劃為「後台登記退款、人工匯款」，保留紀錄。
- 退款一律由後台人工觸發並二次確認，不自動退款。

---

## 4. 資料庫設計

完整 DDL：[schema.sql](schema.sql)（已用 SQLite 實際載入驗證）。

### 4.1 資料表

| 資料表 | 用途 |
|---|---|
| `products` | 商品主檔（由 `src/data/products/*.json` 同步；以 `shopee_item_id` 唯一，避免重複） |
| `skus` | 可販售規格：價格、`stock_on_hand`（實際庫存）、`stock_reserved`（已保留） |
| `inventory_ledger` | 每一次庫存變動紀錄（同步、保留、釋放、售出、退貨入庫、人工調整） |
| `customers` | 預留會員制度；訪客結帳不建立帳號 |
| `orders`／`order_items` | 訂單與明細（品名、單價為下單當下快照） |
| `order_events` | 訂單狀態變更稽核 |
| `payment_attempts` | 每次導向綠界一筆；`merchant_trade_no` 唯一 |
| `payment_notifications` | 綠界通知原文與驗證結果；`dedupe_key` 唯一 → 防重複處理 |
| `refunds` | 退款（綠界信用卡 API 或人工匯款） |
| `quotes`／`quote_items` | 客製整機、維修報價與專屬付款連結 |
| `shipping_methods` | 配送方式與運費、免運門檻 |
| `admin_audit_log` | 後台操作紀錄 |

### 4.2 SKU 規則（與蝦皮匯入資料對應、不重複建立商品）
現有資料沒有任何 SKU，但每個規格都有蝦皮商品 ID＋規格 ID：

| 情況 | SKU |
|---|---|
| 有規格 | `EWP-SP<蝦皮商品ID>-<蝦皮規格ID>`，例：`EWP-SP57918649179-386566590953`（FDI 全套飛塔） |
| 單一規格（61 件） | 同上，使用該商品唯一一列的規格 ID |
| 網站自建、無蝦皮 ID（目前 2 個規格） | `EWP-W-<流水號>`（同步時會列出並等待 EWP 指定） |

- 同步程式以 `(shopee_item_id, shopee_variation_id)` 唯一鍵 upsert：已存在就更新，**不會新建重複商品**。
- 建議 EWP 之後把這組 SKU 回填到蝦皮「商品選項貨號」，未來兩邊的匯出檔就能直接以 SKU 對帳。

### 4.3 庫存流程（防超賣）

| 時機 | 動作 |
|---|---|
| 建立訂單 | 單一 SQL 條件更新 `stock_reserved += qty WHERE stock_on_hand - stock_reserved >= qty`；任一品項失敗就整筆取消（資料庫另有 `CHECK (stock_reserved <= stock_on_hand)`，已實測可擋超賣） |
| 付款成功 | `stock_on_hand -= qty`、`stock_reserved -= qty`，寫入 ledger |
| 逾期／付款失敗／取消 | `stock_reserved -= qty`（釋放） |
| 退款並退貨 | 視情況 `stock_on_hand += qty`（後台勾選是否回補） |

**保留時間（建議值，待 EWP 確認）**：信用卡 30 分鐘；ATM 依 `ExpireDate`（建議 2 天）；超商代碼依 `StoreExpireDate`（建議 1 天＝1440 分鐘）。排程每 5 分鐘處理逾期訂單。

**蝦皮與官網共用實體庫存**是最大的超賣風險（§8）。第一階段建議：官網庫存由後台維護；EWP 每天匯出蝦皮銷售資訊，用同步工具以 SKU 更新兩邊。

### 4.4 訂單狀態

```
pending_payment ─(信用卡成功)──────────────► paid ─► processing ─► shipped ─► completed
      │  └─(ATM／超商取號)─► awaiting_offline ─(繳費成功)─┘   │
      ├─(逾時)─► expired                                        ├─► refund_pending ─► refunded／partially_refunded
      ├─(付款失敗)─► payment_failed（可重新付款＝新 attempt）
      └─(顧客／後台取消)─► cancelled
```

---

## 5. API 設計（Worker）

### 5.1 公開（前端呼叫）

| Method | 路徑 | 說明 |
|---|---|---|
| GET | `/api/catalog/stock?skus=…` | 查詢即時可售數量（商品頁、購物車顯示） |
| POST | `/api/cart/quote` | 傳入 `[{sku, qty}]`，回傳後端計算的單價、小計、運費、總額（購物車與結帳頁顯示用） |
| GET | `/api/shipping-methods` | 配送方式與運費 |
| POST | `/api/orders` | 建立訂單：驗證欄位、重新計價、保留庫存，回傳 `order_no` 與一次性 `lookup_token` |
| POST | `/api/orders/{order_no}/pay` | 建立 payment attempt，回傳要 POST 到綠界的表單欄位（含 CheckMacValue） |
| POST | `/api/orders/lookup` | 訂單查詢：`order_no`＋email（或手機）＋`lookup_token`，回傳狀態（不回傳完整地址） |
| GET | `/api/quotes/{token}` | 報價付款頁讀取報價內容 |
| POST | `/api/quotes/{token}/pay` | 由報價產生訂單並導向綠界 |

### 5.2 綠界通知（只接受綠界伺服器）

| Method | 路徑 | 說明 |
|---|---|---|
| POST | `/ecpay/return` | ReturnURL：§3.4 流程，回 `1|OK` |
| POST | `/ecpay/payment-info` | PaymentInfoURL：ATM 帳號／超商代碼與繳費期限 → 訂單改 `awaiting_offline`、寄繳費資訊 |
| POST | `/ecpay/order-result` | OrderResultURL：瀏覽器導回 → 302 到「付款處理中／查詢」頁，**不改任何狀態** |

### 5.3 後台（Cloudflare Access 保護＋Worker 再驗證 Access JWT）

| Method | 路徑 | 說明 |
|---|---|---|
| GET | `/admin/orders?status=&q=&from=&to=` | 訂單列表與搜尋 |
| GET | `/admin/orders/{id}` | 明細、付款紀錄、綠界通知原文、事件紀錄 |
| POST | `/admin/orders/{id}/ship` | 填物流單號 → shipped |
| POST | `/admin/orders/{id}/cancel` | 取消未付款訂單、釋放庫存 |
| POST | `/admin/orders/{id}/refund` | 退款（信用卡呼叫 DoAction；ATM／超商登記人工退款） |
| POST | `/admin/orders/{id}/query-ecpay` | 手動呼叫查詢訂單 API 對帳 |
| GET／POST | `/admin/inventory` | 查看與調整庫存（寫 ledger） |
| POST | `/admin/quotes` | 建立報價、產生專屬付款連結 |
| GET | `/admin/export/orders.csv` | 匯出 |

### 5.4 預留擴充介面

```ts
interface PaymentProvider {   // ecpay 先實作；LINE Pay、街口等之後加
  createCheckout(order, attempt): { action: string; fields: Record<string, string> };
  verifyNotification(form): { valid: boolean; paid: boolean; amount: number; tradeNo: string; raw: object };
  query(attempt): Promise<ProviderStatus>;
  refund(attempt, amount, mode): Promise<RefundResult>;
}
interface ShippingProvider { quote(cart, method); createShipment(order); track(order) }   // 手動 → 綠界物流
interface InvoiceProvider  { issue(order); void(order); allowance(refund) }               // 綠界 B2C 電子發票
interface AuthProvider     { /* 會員：LINE Login／Email OTP；目前不啟用 */ }
```

---

## 6. 前端頁面（沿用現有設計 token 與版型）

| 頁面 | 說明 |
|---|---|
| 商品頁 | 規格選擇＋數量＋「加入購物車」；庫存不足時停用 |
| `/cart/` | 購物車（存在瀏覽器 localStorage，只存 SKU 與數量；價格每次向後端取） |
| `/checkout/` | 訪客結帳：聯絡資訊、收件資訊、配送方式、付款方式、同意條款勾選 |
| `/checkout/pay/` | 自動送出表單到綠界（加「若未自動跳轉請按此」按鈕） |
| `/order/result/` | 付款處理中 → 輪詢訂單狀態，以後端結果顯示成功／待繳費／失敗 |
| `/order/lookup/` | 訂單查詢 |
| `/pay/q/{token}` | 報價專屬付款頁 |
| `/admin/` | 後台（由 Worker 提供，不放在 GitHub Pages） |

客製整機與維修（`cta_primary=line`）維持 LINE 詢價；報價確定後由後台產生付款連結。

---

## 7. 費用

### 7.1 綠界金流（官方「服務費率表」）

| 付款方式 | 一般賣家 | 特約賣家 |
|---|---|---|
| 國內信用卡一次付清 | 2.75%（每筆最低 5 元）＋信用卡訂單處理費 1 元（含稅） | 1.85%–2.75%＋1 元處理費 |
| Apple Pay | 2.75%（最低 5 元）＋1 元 | 國內卡 1.85%–2.75%＋1 元 |
| ATM 虛擬帳號 | 1%（每筆最低 15 元） | 同 |
| 超商代碼 | 每筆 31 元 | 同 |
| 超商條碼 | 每筆 16 元 | 同 |
| 國外信用卡 | 僅特約 | 3.5%–3.8%＋1 元 |
| 開辦／年費 | 費率表未列 | 系統設定費 5,000 元（一次）；服務費 1 年 13,000／2 年 22,100／3 年 27,300 元（未稅） |
| 撥款 | 付款後 10 日內 | 依合約 |

- 手續費標示為未稅，結算另加 5% 營業稅；1 元處理費已含稅。整筆退刷會退還處理費。
- 試算（一般賣家、信用卡）：NT$2,669 的訂單 → 2.75% ≈ 73.4 元，加 5% 稅約 77.1 元，再加 1 元處理費 ≈ **78 元**（約 2.9%）。官網價已比蝦皮低 4%，定價時請把這筆信用卡成本一併考量。
- 月營業額不高時一般賣家較划算；特約賣家要月刷卡額夠大，費率差才抵得過年費。

### 7.2 系統與其他

| 項目 | 費用 |
|---|---|
| Cloudflare Workers Paid（含 D1 5 GB、Cron） | US$5／月（約 NT$160） |
| Cloudflare Access（後台登入） | Zero Trust 免費方案即可（人數上限以官方為準，EWP 只需少數帳號） |
| 自有網域 | 依網域商與網域類型而定（.com／.tw 價格不同，購買時確認） |
| 電子發票（綠界 B2C） | 待確認：先確認營業登記是否需開立統一發票（§9） |
| 超商物流（綠界物流） | 依綠界物流費率，第二階段前另行查核 |
| GitHub Pages、Actions | 現有免費額度 |

---

## 8. 安全與營運風險

| 風險 | 對策 |
|---|---|
| 金鑰外洩 | HashKey／HashIV 只放 `wrangler secret`；不進 repo、前端、log；CI 不放正式金鑰；repo 加 secret 掃描；測試與正式金鑰分開設定 |
| 偽造付款通知 | 驗 CheckMacValue＋MerchantID＋金額＋訂單存在；`SimulatePaid=1` 不出貨；不依前端導回頁判定 |
| 重複通知／重複扣庫存 | `dedupe_key` 唯一索引＋單一交易更新；狀態轉移只允許合法方向 |
| 金額竄改 | 價格只由後端依 SKU 計算；建立訂單後總額鎖定；通知金額必須一致 |
| 超賣（官網＋蝦皮共用庫存） | 保留機制＋資料庫 CHECK；每日 SKU 對帳；庫存少於安全量（建議 2）時官網顯示「請先詢問」 |
| 訂單查詢被猜號（IDOR） | 查詢需訂單編號＋email／手機＋隨機 token；token 只存雜湊；查詢 API 限流 |
| 後台入侵 | Cloudflare Access（email OTP，可加 Google 登入）＋Worker 驗證 Access JWT；所有後台操作寫 audit log；退款二次確認 |
| 個資外洩 | 只收出貨必要欄位；不收身分證、生日；資料庫匯出不得放進 GitHub；訂單查詢不回傳完整地址；依個資法提供隱私權政策（目前未核准） |
| XSS（後台顯示顧客輸入） | 所有輸出 escape；後台加 CSP |
| 濫用與刷單 | 建立訂單 API 限流；未付款訂單自動逾期釋放庫存 |
| 信用卡資料 | 不經過 EWP 系統：卡號只在綠界付款頁輸入 |
| 綠界通知被 CDN／防火牆擋下 | 測試環境實測；排程查詢 API 補位；後台顯示「付款待確認」清單 |
| App 內建瀏覽器無法導轉 | 偵測 LINE／FB in-app browser 時提示用外部瀏覽器開啟 |
| 正式環境誤啟用 | `ECPAY_ENV=stage` 為預設；切換正式需 EWP 書面確認＋手動設定 secret；正式網址寫死白名單 |

---

## 9. 需要 EWP 決定的事項

1. **後端方案**：Cloudflare Workers＋D1（建議）或 VPS。
2. **自有網域**：建議購買（例：`ewp.com.tw`、`ewpfpv.com`），供 API 與綠界通知使用，日後網站也可改用。
3. **付款方式**：建議第一階段「信用卡＋ATM 虛擬帳號＋超商代碼」，暫不開超商條碼（通知較慢）。
4. **賣家類型**：先用一般賣家，月刷卡額穩定後再評估特約。
5. **配送方式與運費**：宅配、超商取貨（第一階段可先人工寄送、手動填單號）、運費金額、免運門檻。
6. **發票**：「電翼動力航模企業社」是否需開立統一發票？需要 → 第二階段串綠界 B2C 電子發票；免用統一發票 → 不需要。
7. **庫存主控**：官網與蝦皮誰為準、多久同步一次；是否設安全庫存。
8. **保留時間**：信用卡 30 分鐘、ATM 2 天、超商 1 天是否可以。
9. **政策頁**：退換貨、運送、隱私權正式內容（開放收款前必須公開）。
10. **後台使用者**：哪些 email 可登入後台。
11. **SKU**：是否採用 §4.2 規則，並回填到蝦皮商品選項貨號。

---

## 10. 分階段實作計畫

| 階段 | 內容 | 驗收 | 環境 |
|---|---|---|---|
| **P0 規劃**（本文件） | 架構、資料庫、API、費用、風險 | EWP／ChatGPT 確認 §9 | — |
| **P1 後端基礎＋測試金流** | Worker 專案、D1 schema、商品／SKU 同步（防重複）、`/api/cart/quote`、建立訂單＋保留庫存、綠界 stage 產生訂單、ReturnURL／PaymentInfoURL 驗證、逾期排程 | CheckMacValue 與官方範例一致；測試卡 `4311-9522-2222-2222` 完成付款並由 ReturnURL 改為已付款；重送同一通知不重複扣庫存；竄改金額／檢查碼被拒；逾期自動釋放庫存；併發下單不超賣 | **stage only** |
| **P2 前台購物流程** | 商品頁加入購物車、購物車、結帳、付款中、訂單查詢頁 | 手機與桌機 e2e：下單 → 綠界測試付款 → 結果頁顯示後端狀態；ATM／超商取號流程 | stage |
| **P3 後台** | Cloudflare Access、訂單列表與明細、出貨、取消、退款登記、庫存調整、CSV 匯出、對帳 | 角色限制、audit log、退款二次確認 | stage |
| **P4 報價付款連結** | 後台建立報價 → 專屬連結 → 顧客付款 → 後台通知 | 連結到期失效、金額不可被改、付款後報價鎖定 | stage |
| **P5 正式上線準備** | EWP 申請／確認正式特店、網域、政策頁核准、正式金鑰（**由 EWP 自行輸入 secret**）、小額真實交易測試與退款測試 | **需 EWP 書面確認後才切換** | production |
| **P6 擴充** | 綠界物流（超商取貨）、電子發票、會員（LINE Login）、其他金流、蝦皮庫存自動同步 | 各自另立規格 | — |

**原則**：P1–P4 全部在 `payment-stage` 測試環境；不建立正式金鑰欄位以外的任何正式設定；任何 PR 不合併 main，直到 EWP 確認。

---

## 參考資料（官方）

- 綠界全方位金流：[產生訂單](https://developers.ecpay.com.tw/2862/)、[全方位金流付款參數](https://developers.ecpay.com.tw/2864/)、[測試介接資訊](https://developers.ecpay.com.tw/2856/)、[介接注意事項](https://developers.ecpay.com.tw/2858/)、[付款結果通知](https://developers.ecpay.com.tw/2878/)、[檢查碼機制](https://developers.ecpay.com.tw/2902/)、[查詢訂單](https://developers.ecpay.com.tw/2890/)、[信用卡請退款](https://developers.ecpay.com.tw/2885/)、[ATM 虛擬帳號](https://developers.ecpay.com.tw/2872/)、[CVS 超商代碼](https://developers.ecpay.com.tw/2874/)
- 綠界費用：[服務費率表](https://www.ecpay.com.tw/Business/payment_fees)、[2025/4/1 金流收費調整公告](https://www.ecpay.com.tw/announcement/DetailAnnouncement?nID=5603)
- Cloudflare：[Workers 計價](https://developers.cloudflare.com/workers/platform/pricing/)、[D1 計價](https://developers.cloudflare.com/d1/platform/pricing/)
