# 官網改由 Cloudflare Pages 發布（程式庫改私人）

原因：業主要求 GitHub 程式庫不公開。GitHub 免費方案的程式庫改成私人後，GitHub Pages 會停用，所以官網改由 Cloudflare Pages 發布。

## 流程
1. `pages.yml` 建置後，同一份 `dist/` 同時發布到 GitHub Pages 與 Cloudflare Pages 專案 `ewp-site`（過渡期）。
2. 在 Cloudflare Pages `ewp-site` 加上自訂網域 `www.ewpfpv.com`（DNS 已在 Cloudflare，會自動改指向）。
3. 確認官網由 Cloudflare 提供且正常。
4. 業主在 GitHub 把程式庫改為 Private（Settings → General → Danger Zone → Change visibility）。
5. 關閉 GitHub Pages 發布（移除 `pages.yml` 的 deploy 工作與 GitHub Pages 設定）。

## 密鑰
沿用 GitHub Environment `inventory-production` 的 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。權杖需要「Account → Cloudflare Pages → Edit」權限；不夠時由業主在 Cloudflare 編輯權杖權限，權杖值不經過 AI。

## Actions 時數
私人程式庫每月免費 2000 分鐘。`ci.yml` 改為只在 PR 與 main 執行一次（分支 push 不重複跑）。
