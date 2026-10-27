# 故障排除中心（/help/）寫作與維護

一篇文章一個檔案：`src/data/help/<網址代碼>.md`。網址會是 `/help/<網址代碼>/`。

## 檔案開頭（必填）

```
---
title: 用玩家會說的話寫症狀
slug: betaflight-arming
published: true          # false = 草稿，不會出現在正式網站
order: 1                 # 同分類內的排序
category: 飛控設定        # 飛控設定／類比圖傳／數位圖傳／接收機／對頻／電腦連線／馬達／電調／電池／充電／GPS／返航
level: beginner          # beginner 新手、intermediate 中階
applies: Betaflight 4.4、4.5
needs: 電腦、USB 線       # 選填
verified: 2026-10-27     # 最後一次核對官方資料的日期
summary: 一句話答案（也是搜尋結果摘要）
legacy_items:            # 對應舊知識庫題號；舊連結 /fpv-help.html#item-10 會自動轉到新版
  - 10
prepare:                 # 文末「還是不行？」要準備的資料
  - 飛控型號與 Betaflight 版本
sources:                 # 至少一個，格式「標題 | https://網址」
  - Betaflight 官方原始碼 | https://github.com/betaflight/betaflight
---
```

## 每篇固定順序

1. `:::safety 開始前` 拆槳、要準備什麼
2. `## 建議檢查順序` 編號步驟，免拆、免工具、風險低的排前面（不寫「最常見」）
3. `## 看結果判斷` 表格：看到什麼 → 代表什麼 → 下一步（每一列都要有下一步）
4. `:::advanced 進階` 命令列、參數、版本差異（預設收合）
5. `:::checks 怎樣算修好` 每行一個可驗證的正常結果
6. `:::stop 什麼時候停手`
7. 「還是不行？」由 `prepare` 自動產生，只連到「送修檢測」（寄送實機，由 EWP 檢測與報價）

## 寫作規則（建置時會自動檢查）

- 不寫「確認○○正確」，改寫成「正確時畫面會是什麼樣子」。
- 不寫 PID 數值，不教關閉安全保護（例如 `small_angle 180`、取消 PREARM）。
- 沒有 `:::checks`、`:::stop`、`sources`、`prepare` 的文章不能公開。
- 內文有「待補」「待確認」「TODO」不能公開。
- 圖片放 `/assets/img/help/`，只用 Betaflight 等官方軟體的實際截圖或 EWP 實拍，不用論壇或搜尋到的別人圖片，不用 AI 生成的軟體畫面。

## 互動工具

- `{{tool:arming-flags}}`：解鎖原因查詢，資料在 `assets/js/help.js`（名稱對照 Betaflight 4.4／4.5 原始碼）。
- `{{tool:analog-screens}}`：類比畫面三選一（附示意圖），搭配 `:::case A 標題` … `:::case C 標題` 分支。
- `{{tool:case-picker}}`：通用的「先選狀況」選單，依內文的 `:::case` 標題自動產生按鈕（至少兩個分支）。

只有「選一個答案就能縮小一半範圍」的題目才做互動工具，其他維持圖文。
