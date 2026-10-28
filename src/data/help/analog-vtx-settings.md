---
title: 類比圖傳不能換頻道，或只能近距離收到
slug: analog-vtx-settings
published: true
order: 2
category: 類比圖傳
level: beginner
applies: 類比圖傳（SmartAudio、Tramp 控制）＋Betaflight
checked: 依 Betaflight 官方文件撰寫
hw_verified: 尚未實機驗證
needs: 電腦、USB 線
verified: 2026-10-28
summary: Betaflight 改不了頻道，多半是控制線或連接埠設定沒開；只能近距離收到，常是圖傳停在低功率或 Pit mode。
keywords:
  - Pit mode
  - 低功率
  - SmartAudio
  - Tramp
  - VTX Table
  - 換頻道
  - 未就緒
  - Device ready
legacy_items:
  - 9
  - 61
  - 62
prepare:
  - 「連接埠」與「圖傳」頁截圖
  - 圖傳型號
sources:
  - Betaflight 官方文件：VTX 設定（VTX Table、低功率與 Pit mode） | https://betaflight.com/docs/wiki/guides/current/VTX
  - Oscar Liang：SmartAudio／Tramp 與 VTX Table 設定 | https://oscarliang.com/smartaudio-tramp-vtx-control-vtxtables/
---
## 常見原因
- 圖傳的控制線沒接到飛控，或連接埠沒有設定
- 沒有載入圖傳的頻道表（VTX Table）
- 圖傳停在低功率或 Pit mode

## 檢查步驟
1. **看「圖傳」頁**：顯示 Device ready 代表飛控能控制圖傳；顯示未就緒，看下一步。
2. **看「連接埠」頁**：圖傳控制線接的那個 UART，周邊設備要選 VTX (SmartAudio) 或 VTX (IRC Tramp)，存檔重開。
3. **載入頻道表**：到圖傳品牌官網下載該型號的 VTX Table，在「圖傳」頁載入後存檔。
4. **調功率**：在「圖傳」頁或 OSD 選單，把功率調到合法範圍內的正常值，並關閉 Pit mode。

:::checks 怎樣算修好
- 「圖傳」頁顯示 Device ready
- 改頻道後眼鏡跟著改到同一頻道，走遠也收得到
:::

:::stop 什麼時候停手
圖傳異常發燙或有焦味：停用並交給 EWP 檢測。發射功率請遵守當地法規。
:::
