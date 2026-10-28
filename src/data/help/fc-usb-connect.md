---
title: 電腦連不上 Betaflight
slug: fc-usb-connect
published: true
order: 1
category: 電腦連線
level: beginner
applies: Windows 電腦＋Betaflight 飛控
checked: 依 Betaflight 官方文件撰寫
hw_verified: 尚未實機驗證
needs: 電腦、USB 線
verified: 2026-10-28
summary: 連不上最常見是 USB 線只能充電，其次是驅動程式。先換一條確定能傳資料的線。
keywords:
  - 連不上
  - 認不到飛控
  - USB
  - 驅動
  - Zadig
  - DFU
  - STM32 BOOTLOADER
  - COM port
legacy_items:
  - 25
  - 24
  - 47
  - 48
  - 72
prepare:
  - 電腦作業系統版本
  - 飛控型號
  - 連線失敗時的畫面截圖
sources:
  - Betaflight 官方文件：安裝與驅動程式 | https://betaflight.com/docs/wiki/guides/current/Installing-Betaflight
  - Oscar Liang：Can’t Connect to Betaflight or Flash Firmware | https://oscarliang.com/fc-driver-issues-flash-firmware
---
## 常見原因
- USB 線只能充電、不能傳資料
- 電腦缺驅動程式
- Betaflight 被其他程式佔用連線

## 檢查步驟
1. **換線、換孔**：用一條確定能傳資料的 USB 線，直接插電腦，不要經過集線器。
2. **關掉其他程式**：DJI Assistant、其他地面站或另一個 Betaflight 視窗都先關掉。
3. **重新整理連接埠**：插上後在 Betaflight 左上角選擇 COM 連接埠，再按連線。
4. **裝驅動**：照 Betaflight 官方安裝說明安裝驅動程式後重開電腦。

:::checks 怎樣算修好
- Betaflight 能連線，「設定」頁的 3D 飛機會跟著你移動飛機
- 拔掉再插一次，仍然連得上
:::

:::stop 什麼時候停手
飛控插 USB 完全沒燈、發燙，或需要重刷韌體才能救回：刷錯韌體可能讓飛控無法開機，請交給 EWP 處理。
:::
