# 飛行數據寄送（/blackbox/ 的「寄出資料」按鈕）

客戶在 `/blackbox/` 填好資料、放入黑盒子檔後，按「寄出資料」：

1. 瀏覽器在客戶自己的手機／電腦上把黑盒子檔壓縮成 `.gz`（通常剩 1/3～1/5），連同提交單組成一封信。
2. 信件交給 Cloudflare Worker `ewp-submit`（`submit/`），由 Cloudflare Email 寄到 `mixlin.lll@gmail.com`。
3. 信件主旨：`【飛行數據】EWP-BB-YYMMDD-XXXX`；回覆這封信會直接寄給客戶（Reply-To 為客戶填的 Email）。

附件：

- `EWP-BB-…-sheet.txt`：提交單（飛機規格、檢查結果，有 DIFF 時附在最後）
- `EWP-BB-…-原檔名.gz`：壓縮後的黑盒子。用 7-Zip／WinRAR／macOS 直接雙擊解壓即可得到原本的 `.BBL`／`.BFL`。

## 限制

- 一封信最大 25 MB（Cloudflare 限制）；網頁端壓縮後超過約 17 MB 的黑盒子會請客戶只匯出一段飛行。
- 同一個網路位址 10 分鐘內最多寄 6 次。
- 只接受來自 `https://www.ewpfpv.com` 的寄送。
- 寄送失敗時，網頁會顯示「用自己的信箱寄」按鈕（開啟客戶的郵件 App，主旨與提交單已填好，客戶自行附加黑盒子檔）。

## 第一次設定（只要做一次）

1. Cloudflare 後台 → 選 `ewpfpv.com` → 左側 **Email** → **Email Routing** → **開始使用／Enable**，照提示讓 Cloudflare 自動加入 MX／TXT 記錄。
   - 注意：如果 `ewpfpv.com` 目前已經有別家的收信服務（MX 記錄），開啟後收信會改由 Cloudflare 處理，請先確認。
2. 同一頁 **Destination addresses（目的地地址）** → 新增 `mixlin.lll@gmail.com` → 到 Gmail 收驗證信並點連結。狀態要顯示 **Verified**。
3. GitHub → Actions → 「飛行數據寄送（Cloudflare Worker）」→ Run workflow（或改一次 `submit/` 讓它自動部署）。
4. 打開 `https://ewp-submit.mixlin-lll.workers.dev/health`，看到 `{"ok":true,"mail":true}` 就完成。

## 測試

```
node --import ./submit/test/register.mjs --test submit/test/submit.test.mjs
```
