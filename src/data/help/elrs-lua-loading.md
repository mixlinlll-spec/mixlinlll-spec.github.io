---
title: 遙控器的 ExpressLRS 腳本一直停在「載入中」
slug: elrs-lua-loading
published: true
order: 2
category: 接收機／對頻
level: beginner
applies: ExpressLRS 發射模組＋EdgeTX 遙控器
checked: 依 ExpressLRS 官方文件撰寫
hw_verified: 尚未實機驗證
verified: 2026-10-28
summary: 腳本卡在載入中，多半是遙控器沒有在跟高頻頭溝通。先確認模型設定的外接模組是 CRSF，再更新腳本。
keywords:
  - Lua
  - elrs.lua
  - Loading
  - 腳本打不開
  - Baud rate
  - 鮑率
  - TX module
  - 發射模組
legacy_items:
  - 19
prepare:
  - 遙控器型號、EdgeTX 版本
  - 模型設定頁照片
  - 高頻頭型號
sources:
  - ExpressLRS 官方：遙控器腳本（Lua）使用方式 | https://expresslrs.org/quick-start/transmitters/lua-howto/
---
## 常見原因
- 模型設定裡沒開啟模組，或類型不是 CRSF
- 腳本太舊，和高頻頭韌體版本不合
- 外接高頻頭沒插好

## 檢查步驟
1. **看模型設定**：內建 ELRS 開「內部」模組；外接高頻頭開「外部」模組，類型選 CRSF。另一個不用的模組關掉。
2. **重新插好高頻頭**：關機後拔下再插緊。
3. **更新腳本**：從 ExpressLRS 官網下載對應版本的 elrs.lua，放到 SD 卡 SCRIPTS/TOOLS 資料夾，覆蓋舊的。
4. **重開遙控器**，再從「工具」選單打開腳本。

:::checks 怎樣算修好
- 腳本能打開，看得到高頻頭的型號與設定選單
- 重開遙控器後再打開，一樣正常
:::

:::stop 什麼時候停手
高頻頭發燙、有焦味，或換過腳本、重插都一樣：先不要更新韌體，請聯絡 EWP。
:::
