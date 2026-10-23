# 部署與回滾

## ⚠ 本 PR 必須修改 GitHub Pages 設定

改版後網站由 GitHub Actions 建置，**只上傳 `dist/`**（產生的頁面＋白名單靜態檔），`src/`、`scripts/`、`tests/`、`docs/`、`_preview/` 都不會發布，因此草稿 JSON 無法從網站讀取。

但 repo 根目錄已不再放產生的 `index.html`。**若 Pages 仍是「Deploy from a branch」就合併，正式站首頁會變成 404。** 請照以下順序操作。

### 合併步驟（依序）

1. **確認 PR 的 `EWP site checks` 為綠燈。**
2. **修改 Pages 來源**（需 repo 管理員）：
   GitHub repo → **Settings** → 左側 **Pages** → **Build and deployment** → **Source** 下拉選單從「Deploy from a branch」改為 **「GitHub Actions」**。
   - 這個下拉選單會立即儲存，不需按 Save。
   - 改完後到合併完成前，GitHub 通常會繼續提供上一次部署的內容；若此時看到 404，完成第 3 步後 1–3 分鐘會恢復。
3. **合併 PR** 到 main。合併會觸發 `Deploy EWP to GitHub Pages`（`.github/workflows/pages.yml`）。
4. 到 **Actions** 分頁確認 `Deploy EWP to GitHub Pages` 的 `build` 與 `deploy` 兩個 job 都成功（約 1–2 分鐘）。
5. 做「合併後檢查」。

> 第一次部署若出現「Branch "main" is not allowed to deploy to github-pages」：Settings → Environments → `github-pages` → Deployment branches，確認允許 `main`。

### 合併後檢查（約 3 分鐘內）

- `https://www.ewpfpv.com/` 首頁正常（`https://mixlinlll-spec.github.io/`、`https://ewpfpv.com/` 都轉到這裡）
- `https://mixlinlll-spec.github.io/fpv-help.html` 仍為 91 則
- `/products/`、`/contact/`（LINE 與 Instagram QR）、`/huan.png`（舊圖片網址）
- `https://www.ewpfpv.com/src/data/site.json` 應為 **404**（原始資料不再對外提供）
- 不存在的網址顯示自訂 404

## 日常更新

修改 `src/data/` 或程式 → 開 PR → CI 綠燈 → 合併 → Actions 自動部署。不需手動上傳檔案，也不需要提交 `dist/`。
需要重新部署（例如 Actions 暫時失敗）：Actions → `Deploy EWP to GitHub Pages` → **Run workflow**。

## 回滾

**情況 A：新版有問題，要回到舊站**
1. 到已合併的 PR 頁 → **Revert** → 建立並合併 revert PR（舊的根目錄 `index.html` 會回來）。
2. Settings → Pages → Source 改回 **Deploy from a branch**，Branch：`main`，資料夾：`/ (root)` → **Save**。
3. 約 1–3 分鐘後確認首頁與 `/fpv-help.html`。

**情況 B：只想退回上一個網站版本（保留 Actions 部署）**
`git revert <有問題的 commit>` → push 到 main，Actions 會重新部署前一版內容。

**臨時查看舊首頁**：`/legacy/home-2026-09.html`（noindex 存檔）。

回滾不會影響 `fpv-help.html` 與 `huan.png`，本次改版沒有修改這兩個檔案（單元測試以 SHA-256 驗證）。

## 自訂網域 www.ewpfpv.com（2026-10-23）

- DNS 在 Cloudflare：`www` CNAME → `mixlinlll-spec.github.io`（Proxy status：DNS only／灰色雲朵）；根網域 `ewpfpv.com` 用 4 筆 A 記錄指向 GitHub Pages（185.199.108.153、185.199.109.153、185.199.110.153、185.199.111.153，DNS only），GitHub 會自動轉到 www。
- GitHub → Settings → Pages → Custom domain 填 `www.ewpfpv.com` → Save → DNS 檢查通過後勾選 **Enforce HTTPS**。
- 網站的正式網址設定在 `src/data/site.json` 的 `base_url`（canonical、sitemap、結構化資料都用它）。
- 回滾網域：Pages 的 Custom domain 清空即可恢復 `mixlinlll-spec.github.io`，並把 `base_url` 改回。
