---
title: 類比畫面隨油門出現橫紋、文字亂跳，或顏色變怪
slug: analog-image-noise
published: true
order: 3
category: 類比圖傳
level: beginner
applies: 類比鏡頭＋類比圖傳
checked: 依官方文件撰寫
hw_verified: 尚未實機驗證
verified: 2026-10-28
summary: 畫面隨油門出現橫紋，通常是電源雜訊；顏色或文字怪怪的，多半是鏡頭、飛控、眼鏡的制式（PAL／NTSC）不一致。
keywords:
  - 橫紋
  - 雜訊
  - noise
  - PAL
  - NTSC
  - OSD 亂跳
  - LC 濾波
  - 電容
legacy_items:
  - 63
  - 64
  - 65
prepare:
  - 推油門時的眼鏡錄影
  - 鏡頭、圖傳、飛控型號
sources:
  - Betaflight 官方文件：OSD 頁（Video Format：PAL、NTSC 與鏡頭訊號要一致） | https://betaflight.com/docs/wiki/app/osd-tab
  - Oscar Liang：圖傳與鏡頭的電源濾波 | https://oscarliang.com/power-filter-video-transmitter-fpv-camera/
---
## 常見原因
- 馬達的電源雜訊干擾影像
- 鏡頭、飛控、眼鏡的制式（PAL／NTSC）不一致
- 鏡頭或圖傳的接地線鬆脫

## 檢查步驟
1. **拆槳推油門看畫面**：橫紋只在推油門時出現，就是電源雜訊。
2. **確認電調有大電容**：電池接頭附近要有低內阻電容（多數套件附贈）。沒有就請安裝，或交給 EWP 處理。
3. **統一制式**：鏡頭選單與 Betaflight「OSD」頁的制式設成一樣（都 PAL 或都 NTSC）。
4. **斷電檢查排線**：鏡頭、圖傳的線要插緊，沒有破皮。

:::checks 怎樣算修好
- 拆槳推油門時，畫面沒有明顯橫紋
- OSD 文字穩定、顏色正常
:::

:::stop 什麼時候停手
加了電容、統一制式後還是有雜訊：多半需要改電源線路，不建議自己改線，請交給 EWP 檢測。
:::
