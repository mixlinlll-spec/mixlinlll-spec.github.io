# 合併前預覽網址（Cloudflare Pages）

每個分支（PR）會自動產生一個預覽網址，可以在合併前用手機或電腦逛完整網站。正式網站仍然只由 GitHub Pages 從 `main` 發布，預覽網址不影響正式網站、蝦皮、庫存或商品後台。

## Cloudflare Pages 專案設定

| 項目 | 值 |
|---|---|
| 專案名稱 | `ewp-preview` |
| 連接的 repo | `mixlinlll-spec/mixlinlll-spec.github.io` |
| 正式分支（Production branch） | `main` |
| 框架（Framework preset） | None |
| 建置指令（Build command） | `node scripts/build.mjs --preview` |
| 輸出資料夾（Build output directory） | `dist` |
| 環境變數 | `NODE_VERSION` = `22` |

## 網址

- 每個分支：`https://<分支名稱>.ewp-preview.pages.dev`（分支名稱中的 `/` 會變成 `-`，例如 `feature/home-v2` → `feature-home-v2.ewp-preview.pages.dev`）
- `main` 的預覽：`https://ewp-preview.pages.dev`
- Cloudflare 也會在 PR 頁面留言附上網址。

## 預覽版和正式版的差別（`--preview`）

- 內容與正式版相同，**不含草稿商品**。
- 全站 `noindex`：每頁 `<meta name="robots">`、`X-Robots-Tag` 標頭（`_headers`）、`robots.txt` 全擋、不產生 sitemap，不會被搜尋引擎收錄。
- 每頁上方顯示「預覽版（分支名稱）：尚未上線」提示條。
- 流量統計只在 `www.ewpfpv.com` 載入，預覽網址不會計入。
- 預覽網址是公開的（知道網址的人都能看），不要放不能公開的內容。
