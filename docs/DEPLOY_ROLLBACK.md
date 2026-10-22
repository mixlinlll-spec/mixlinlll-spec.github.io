# 部署與回滾

## 部署方式

GitHub Pages：Settings → Pages → Build and deployment → **Deploy from a branch**，Branch：`main`，資料夾：`/ (root)`。
本次改版沿用這個設定，**不需要修改 Pages 設定**。PR 合併到 main 後約 1–3 分鐘上線。

## 合併前驗收

1. 在 PR 頁確認 `EWP site checks` 綠燈。
2. 本機下載分支：
   ```bash
   git fetch origin feature/ewp-site-v2 && git switch feature/ewp-site-v2
   node scripts/build.mjs --check && node --test tests/data.test.mjs
   python3 -m http.server 8800        # 正式版預覽 http://localhost:8800
   node scripts/build.mjs --drafts && python3 -m http.server 8801 --directory _preview   # 含草稿
   ```
3. 對照 PR 說明中的驗收清單。

## 合併後檢查（約 3 分鐘內）

- `https://mixlinlll-spec.github.io/` 首頁正常
- `https://mixlinlll-spec.github.io/fpv-help.html` 仍為 91 則
- `/products/`、`/contact/`（LINE 按鈕與 QR）、`/huan.png`（舊圖片網址）
- 不存在的網址顯示自訂 404

## 回滾

**最快（GitHub 網頁）**：到已合併的 PR 頁 → 點「Revert」→ 建立並合併 revert PR。網站會回到合併前版本。

**指令列**：
```bash
git switch main && git pull
git revert -m 1 <合併 commit 的 SHA>
git push origin main
```

**只想暫時看舊首頁**：`/legacy/home-2026-09.html`（noindex 存檔）。

回滾不會影響 `fpv-help.html`，本次改版沒有修改該檔案。
