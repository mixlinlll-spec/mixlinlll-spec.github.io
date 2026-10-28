---
title: GPS 找不到衛星，或位置一直飄
slug: gps-no-fix
published: true
order: 1
category: GPS／返航
level: beginner
applies: Betaflight 飛控＋GPS 模組
checked: 依 Betaflight 官方文件撰寫
hw_verified: 尚未實機驗證
verified: 2026-10-28
summary: GPS 要在戶外、天空開闊處等幾分鐘才找得到衛星。一直找不到，多半是被圖傳干擾、天線被擋或接線問題。
keywords:
  - 0 顆衛星
  - No fix
  - 3D Fix
  - UBLOX
  - M10
  - 收不到星
  - GPS 飄
  - PDOP
legacy_items:
  - 14
  - 76
prepare:
  - OSD 或 Betaflight 的 GPS 畫面截圖
  - GPS 模組型號
sources:
  - Betaflight 官方文件：GPS 頁 | https://betaflight.com/docs/wiki/app/gps-tab
  - Betaflight 官方文件：GPS Rescue（4.4 以後） | https://betaflight.com/docs/wiki/guides/current/GPS-Rescue
---
## 常見原因
- 在室內或旁邊有高樓、樹木
- 圖傳或其他電子設備干擾
- GPS 模組被碳纖板擋住，或接線鬆脫

## 檢查步驟
1. **到空曠戶外**：飛機放平，天空沒有遮擋，等 3～5 分鐘。
2. **GPS 朝天**：模組陶瓷天線朝上，不要被碳纖板或電池蓋住。
3. **離圖傳遠一點**：GPS 盡量遠離圖傳和天線。
4. **看 OSD 衛星數**：數字有慢慢增加，就是在正常定位。

:::checks 怎樣算修好
- 戶外等待後衛星數穩定在 8 顆以上
- 地圖上的位置不會亂飄
:::

:::stop 什麼時候停手
等了 10 分鐘以上仍然是 0 顆，或模組發燙：可能是接線或模組問題，請交給 EWP 檢測。GPS 返航的設定與測試，也請交給 EWP。
:::
