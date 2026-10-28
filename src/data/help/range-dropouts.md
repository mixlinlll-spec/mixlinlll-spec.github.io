---
title: 飛不遠就斷圖或斷控，距離比以前短
slug: range-dropouts
published: true
order: 1
category: 遙控與圖傳訊號
level: beginner
applies: ELRS、Crossfire 等遙控系統＋類比或數位圖傳
checked: 依官方文件撰寫
hw_verified: 尚未實機驗證
verified: 2026-10-28
summary: 距離突然變短，最常見是天線損壞或擺放不好；其次是功率設定被改低。
keywords:
  - 斷訊
  - 斷圖
  - 斷控
  - RXLOSS
  - Failsafe
  - 距離短
  - 天線
  - range
legacy_items:
  - 3
  - 17
  - 18
prepare:
  - 飛行錄影（含 OSD 訊號值）
  - 天線與接收機型號
sources:
  - Unmanned Tech：圖傳、GPS、遙控天線安裝位置 | https://www.unmannedtechshop.co.uk/blogs/knowledge-base/fpv-drone-antenna-placement-guide-vtx-gps-rc-mounting
  - Betaflight 官方文件：Failsafe 失聯保護 | https://betaflight.com/docs/wiki/guides/current/Failsafe
---
## 常見原因
- 接收機或圖傳天線斷裂、接頭鬆脫
- 天線被機架或電池擋住
- 遙控器或圖傳功率被設定得太低

## 檢查步驟
1. **看天線**：外皮完整、接頭插緊；有兩支天線時盡量互成約 90 度。
2. **天線尾端露出機身**，不要被碳纖板擋住，彎折不要折成死角。
3. **看功率設定**：遙控器高頻頭與圖傳的功率是不是被改低（在合法範圍內調整）。
4. **近距離慢慢拉遠測試**，留意 OSD 的訊號值（例如 LQ、RSSI）在哪裡開始下降。

:::checks 怎樣算修好
- 在同一個場地，飛到以前的距離時訊號仍穩定
- 天線外觀完整、擺放方向正確
:::

:::stop 什麼時候停手
OSD 出現訊號警告、畫面開始破碎時，馬上往回飛，不要硬飛。天線換過還是一樣，請交給 EWP 檢測。
:::
