---
title: ELRS 腳本卡在載入中、開關只有兩段，或插電池就重啟
slug: elrs-setup-issues
published: true
order: 2
category: 接收機／對頻
level: beginner
applies: ExpressLRS 3.x 遙控器發射端與接收機
needs: 遙控器（EdgeTX）、電池
verified: 2026-10-27
summary: 這三個是 ELRS 常見的設定問題：遙控器端的腳本連不到發射模組、開關模式本來就有段數限制、接收機在電池供電時不穩。三者原因不同，先找出是哪一個。
legacy_items:
  - 19
  - 50
  - 52
prepare:
  - 遙控器「模型設定」中發射模組設定的照片
  - 遙控器與接收機的 ELRS 版本
  - 接收機接線處的清楚照片
sources:
  - ExpressLRS 官方：遙控器腳本（Lua）使用方式 | https://expresslrs.org/quick-start/transmitters/lua-howto/
  - ExpressLRS 官方：開關模式（Switch Configs） | https://expresslrs.org/software/switch-config/
  - ExpressLRS 官方：首飛前檢查 | https://expresslrs.org/quick-start/pre-1stflight/
  - ExpressLRS 官方：接收機接線 | https://expresslrs.org/quick-start/receivers/wiring-up/
---
:::safety 開始前
拆下螺旋槳。修改遙控器模型設定前，先備份模型。
:::

{{tool:case-picker}}

## 依狀況處理

:::case A 遙控器的 ExpressLRS 腳本一直顯示「載入中」
1. **看腳本放的位置**：`elrs.lua` 要放在遙控器記憶卡的 `SCRIPTS/TOOLS` 資料夾，從系統選單的「工具」打開。
2. **看發射模組有沒有開**：目前這個模型要設定使用 ELRS 發射模組（內建或外接），模組沒有啟用時腳本無法載入。
3. **看外接模組的鮑率（Baud rate）**：官方說明從 3.3.0 起，封包率 333Hz 以上需要高於 400K 的鮑率。改鮑率後要重新開機才生效；或先把封包率降低測試。
4. **看腳本版本**：發射模組是 3.x 韌體就用 3.x 的腳本，2.x 用 2.x 的腳本，版本不對會一直載入。
5. **還是卡住**：先建一個新的模型設定檔測試，不要急著重刷整台遙控器。
:::

:::case B 開關只有兩段，不能三段或連續調整
1. **這通常不是故障**：ELRS 的 AUX1（第 5 通道）本來就只有兩段，設計給解鎖開關使用，最穩定。
2. **看開關模式**：Hybrid 模式下 AUX2～AUX7 可當 2 段、3 段或 6 段開關，AUX8 有 16 段；Wide 模式下 AUX2～AUX8 有更多段數（官方說明 3.x 依遙測比例為 64 或 128 段）。
3. **需要多段時**：把多段開關或旋鈕放到 AUX2 以後的通道，不要放在 AUX1。
4. **在飛控確認**：拆槳後到 Betaflight「接收機」頁撥開關，看通道數值有幾種變化，再到「模式」頁設定範圍。
:::

:::case C USB 接著正常，插上電池後接收機重啟或掉線
1. **比較兩種供電**：拆槳，只接 USB 時看接收機燈號；再接上電池，看燈號是否開始重新閃。
2. **看接收機供電接在哪**：官方接線說明是接收機的 5V 接飛控的 5V（或 4.5V）焊點、地線接地線焊點。焊點鬆動或地線接觸不良，插電池時容易重啟。
3. **拔掉圖傳測試**：接上圖傳時更容易重啟，代表圖傳啟動時拉低了供電，分開測試找出原因。
4. **不要自己把兩路供電接在一起**：仍然會重啟就看文末「還是不行？」。
:::

:::checks 怎樣算修好
- 遙控器打開 ExpressLRS 腳本，可以看到發射模組的設定選單
- 開關在 Betaflight「接收機」頁的數值段數，和你在「模式」頁要用的一致
- 接上電池後接收機燈號維持恆亮，推油門時不會重新閃
:::

:::stop 什麼時候停手
接收機在飛行中重啟或掉線過：立刻停飛。插電池時接收機或飛控變燙、冒煙：馬上拔掉電池。
:::
