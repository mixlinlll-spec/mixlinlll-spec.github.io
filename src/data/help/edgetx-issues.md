---
title: EdgeTX 遙控器：腳本看不到、搖桿置中卻偏離、模擬器抓不到
slug: edgetx-issues
published: true
order: 1
category: 遙控器／EdgeTX
level: beginner
applies: EdgeTX 遙控器（彩色與黑白螢幕）
needs: 遙控器、可傳資料的 USB 線、電腦
verified: 2026-10-27
summary: 三個 EdgeTX 常見問題：腳本放錯資料夾或種類不對、搖桿沒校正或加了微調、USB 選錯模式或用了充電線。照狀況處理，大多不用刷遙控器韌體。
keywords:
  - EdgeTX
  - Lua
  - Widget
  - 校正
  - calibration
  - 1500
  - 模擬器
  - joystick
  - USB 只有充電
legacy_items:
  - 79
  - 80
  - 81
prepare:
  - 遙控器型號與 EdgeTX 版本
  - 通道監看頁的照片（搖桿放中間時）
  - 記憶卡資料夾結構的截圖
sources:
  - EdgeTX 官方手冊：記憶卡資料夾 | https://manual.edgetx.org/color-radios/radio-settings/sd-card
  - EdgeTX 官方手冊：硬體與搖桿校正 | https://manual.edgetx.org/bw-radios/radio-settings/hardware
  - EdgeTX 官方手冊：USB 搖桿模式 | https://manual.edgetx.org/v2.9/edgetx-user-manual/user-manual-for-color-screen-radios/model-settings/model-setup/usb-joystick
---
:::safety 開始前
修改遙控器設定前先備份模型。檢查飛控通道時拆下螺旋槳；用模擬器時，關閉該模型的無線發射，避免誤控實機。
:::

{{tool:case-picker}}

## 依狀況處理

:::case A 複製腳本到記憶卡後，選單裡看不到
1. **先看腳本是哪一種**：作者說明會寫它是「工具」（在工具選單打開）、「小工具」（Widget，放在畫面上）還是其他種類。種類不同，放的位置和打開方式都不同。
2. **放對資料夾**：工具放在 `SCRIPTS/TOOLS`，小工具放在 `WIDGETS`。解壓縮後才放進去，不要多包一層下載資料夾，也不要直接放壓縮檔。
3. **小工具要手動加到畫面**：彩色螢幕的小工具不會出現在工具選單，要在畫面設定裡手動加入。
4. **看相容性**：腳本要支援你的 EdgeTX 版本與螢幕類型（彩色或黑白）。放好後安全退出 USB、重新開機再找。
:::

:::case B 搖桿放中間，飛控通道卻不是 1500
1. **先校正搖桿**：在遙控器系統設定的硬體頁執行校正（Calibration）。搖桿要上下、左右推到底，不要畫圈，推到底時用一般力道就好。
2. **看通道監看頁**：校正後搖桿放中間，方向通道應該在中間值附近。
3. **看微調與混控**：模型裡有沒有誤加微調（Trim）、偏移或多餘的混控。先備份模型，再逐項歸零。
4. **再看飛控**：拆槳後到 Betaflight「接收機」頁，方向通道放中間時常見是 1500 附近；油門另依設定。遙控器正常但飛控數值不對，看文末「還是不行？」。
:::

:::case C 電腦模擬器抓不到遙控器，只有充電
1. **換一條能傳資料的 USB 線**：只能充電的線，電腦只會看到充電。
2. **選 USB 搖桿模式**：在遙控器選擇 USB 搖桿（Joystick）模式，而不是記憶卡（儲存）模式。
3. **先在電腦確認**：到電腦的「遊戲控制器」設定，看搖桿軸有沒有跟著動，再到模擬器設定。
4. **模擬器用的模型**：關閉無線發射，避免同時控制到實機。
:::

:::checks 怎樣算修好
- 工具腳本出現在工具選單，小工具可以加到畫面上
- 搖桿放中間時，遙控器通道監看與 Betaflight「接收機」頁的方向通道都在中間值附近
- 電腦的遊戲控制器頁看得到搖桿軸跟著動，模擬器可以操作
:::

:::stop 什麼時候停手
遙控器韌體更新到一半當機、無法開機，或搖桿校正後仍然大幅偏移：先停止操作，不要反覆重刷；搖桿偏移沒解決前不要用這台遙控器飛行。
:::
