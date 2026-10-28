---
title: EdgeTX 遙控器：腳本看不到、搖桿置中卻偏離、模擬器抓不到
slug: edgetx-issues
published: true
order: 1
category: 遙控器／EdgeTX
level: beginner
applies: EdgeTX 遙控器
checked: 依 EdgeTX 官方文件撰寫
hw_verified: 尚未實機驗證
verified: 2026-10-28
summary: 腳本看不到多半是 SD 卡檔案位置不對；搖桿偏離要重新校正；模擬器抓不到要用 USB 搖桿模式連線。
keywords:
  - EdgeTX
  - Lua
  - Widget
  - 校正
  - calibration
  - 1500
  - 模擬器
  - joystick
legacy_items:
  - 79
  - 80
  - 81
prepare:
  - 遙控器型號與 EdgeTX 版本
  - 問題畫面的照片
sources:
  - EdgeTX 官方手冊：記憶卡資料夾 | https://manual.edgetx.org/color-radios/radio-settings/sd-card
  - EdgeTX 官方手冊：硬體與搖桿校正 | https://manual.edgetx.org/bw-radios/radio-settings/hardware
---
## 常見原因
- 腳本沒有放在 SD 卡正確的資料夾
- 搖桿沒有校正
- 接電腦時選錯 USB 模式

## 檢查步驟
1. **腳本看不到**：檔案要放在 SD 卡的 SCRIPTS/TOOLS 資料夾，放好後重開遙控器。
2. **搖桿置中卻偏離**：到系統設定的「硬體」做搖桿校正，照畫面指示把每支搖桿轉到底、再放回中間。
3. **模擬器抓不到**：USB 線接電腦時，遙控器跳出選項選「USB 搖桿（Joystick）」，再到模擬器裡校正一次。
4. **換一條可傳輸資料的 USB 線**：有些線只能充電。

:::checks 怎樣算修好
- 「工具」選單看得到腳本
- 搖桿放手時，Betaflight「接收機」頁各通道回到約 1500
- 模擬器能讀到搖桿動作
:::

:::stop 什麼時候停手
遙控器開不了機、螢幕異常，或校正後還是亂跳：不要飛，請聯絡 EWP。
:::
