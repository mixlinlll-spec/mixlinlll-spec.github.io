---
title: DJI O4 眼鏡沒有飛行資訊（OSD），或文字被切掉、太大
slug: dji-no-osd
published: true
order: 4
category: 數位圖傳
level: beginner
applies: DJI O4／O4 Pro＋Betaflight
checked: 依 Betaflight 官方文件撰寫
hw_verified: 尚未實機驗證
needs: 電腦、USB 線
verified: 2026-10-28
summary: DJI 沒有 OSD，多半是 Betaflight 的連接埠沒開 MSP，或眼鏡的 OSD 設定沒打開。
keywords:
  - OSD
  - Displayport
  - MSP
  - HD OSD
  - 沒有電壓
  - 文字被切
  - canvas
  - UART
legacy_items:
  - 4
  - 60
prepare:
  - 「連接埠」頁截圖
  - 眼鏡畫面照片
sources:
  - Betaflight 官方文件：OSD 頁（Video Format 的 HD 選項） | https://betaflight.com/docs/wiki/app/osd-tab
  - Oscar Liang：DJI O4 Pro 設定（OSD 預設集、接線） | https://oscarliang.com/how-to-setup-dji-o4-pro/
---
## 常見原因
- 天空端接的 UART 沒有開 MSP
- 周邊設備沒選 DJI 用的 OSD 輸出
- 眼鏡沒開啟顯示 OSD，或解析度設定不同

## 檢查步驟
1. **「連接埠」頁**：天空端接的那個 UART，打開 MSP，周邊設備選 VTX (MSP + Displayport)，存檔重開。
2. **「OSD」頁**：勾選要顯示的項目，例如電壓、飛行時間。
3. **眼鏡設定**：眼鏡顯示設定裡和 OSD 有關的選項要開啟（名稱依眼鏡型號不同）。
4. **文字被切掉或太大**：在「OSD」頁把影像格式選 HD，再把項目拖到畫面中間。

:::checks 怎樣算修好
- 眼鏡看得到電壓、時間等文字
- 文字完整，沒有被切掉
:::

:::stop 什麼時候停手
接線方式不確定（TX、RX 接到哪裡）時，不要自己改焊，請聯絡 EWP。
:::
