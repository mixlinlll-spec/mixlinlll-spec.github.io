# 電翼動力 EWP 品牌官網

繁體中文、黑紅視覺的靜態品牌網站，支援桌機與手機。無套件安裝、無後端或第三方追蹤程式。包含品牌介紹、代表機型、工作室服務與常見問題。

## 發布到 GitHub Pages

1. 使用 GitHub 帳號 `mixlinlll-spec` 建立 Public 儲存庫 `mixlinlll-spec.github.io`。若已存在，請先檢查內容，避免覆蓋其他網站。
2. 解壓縮交付檔，把 `index.html`、`assets` 資料夾與 `.nojekyll` 上傳到儲存庫最外層，不要多包一層資料夾。若選擇下方 GitHub Actions 模式，一併提交 `.github/workflows/pages.yml`。
3. 簡單模式：Settings → Pages → Build and deployment，Source 選 Deploy from a branch，Branch 選 main，目錄選 / (root)，Save。
4. 或選 GitHub Actions 模式：Source 選 GitHub Actions，於 Actions 執行 Deploy EWP to GitHub Pages 工作流程。
5. 等部署成功，使用 Settings → Pages 顯示的網址開啟。

## 日後更新

- 文字與配色：修改 `index.html`。
- 商品海報：替換 `assets/huan.png` 並同步更新圖片 alt 文字。
- 聯絡資訊：目前使用「蝦皮搜尋：電翼動力」。取得確定的賣場或 LINE 網址後，再改成可點擊連結。
- 頁首 EWP 是文字品牌識別；尚未替換為正式透明 Logo 圖檔。
- 公開版本沒有放入個人電話、私人地址、售價、庫存或未確認的聯絡網址。
- 海報為使用者現有品牌素材；請保留對該素材的使用權限。機型規格以委託前確認為準。

此交付檔已準備好發布，但製作時尚未建立 GitHub 儲存庫，也尚未取得 Pages 上線結果。

## GitHub 官方設定參考

- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
