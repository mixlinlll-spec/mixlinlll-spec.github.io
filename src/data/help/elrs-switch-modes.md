---
title: ELRS 開關只有兩段，不能三段或連續調整
slug: elrs-switch-modes
published: true
order: 3
category: 接收機／對頻
level: beginner
applies: ExpressLRS 3.x
checked: 依本頁參考資料的官方文件或原廠規格撰寫，不涉及韌體原始碼
hw_verified: 尚未實機驗證
needs: 遙控器、電腦、USB 線
verified: 2026-10-28
summary: ELRS 的第一個輔助通道（AUX1）本來就只有兩段，是設計給解鎖開關用的；需要三段或旋鈕，要放到 AUX2 以後的通道，並看開關模式的設定。
keywords:
  - AUX1
  - Switch mode
  - Hybrid
  - Wide
  - 三段開關
  - 旋鈕沒反應
  - 通道段數
legacy_items:
  - 50
prepare:
  - 遙控器混控（Mixer）頁的截圖
  - ELRS 腳本中開關模式（Switch Mode）的設定
  - Betaflight「接收機」頁撥動開關時的截圖
sources:
  - ExpressLRS 官方：開關模式（Switch Configs） | https://expresslrs.org/software/switch-config/
  - ExpressLRS 官方：首飛前檢查 | https://expresslrs.org/quick-start/pre-1stflight/
---
:::safety 開始前
拆下螺旋槳。調整開關與通道時，飛機可能被意外解鎖。
:::

## 建議檢查順序

1. **先分清楚是哪一個通道**：AUX1 是第 5 通道（CH5）、AUX2 是 CH6、AUX3 是 CH7，依此類推；Betaflight「模式」頁顯示的是 AUX 編號，遙控器混控頁顯示的是 CH 編號。AUX1 只有兩段是 ELRS 的設計，留給解鎖開關使用，最穩定，不是故障。
2. **看開關模式**：開關模式只能在接收機沒連上時更改；先拔掉飛機電池，等遙控器顯示遙測中斷（Telemetry Lost）後，再到 ExpressLRS 腳本改。Hybrid 模式下，AUX2～AUX7 可當 2 段、3 段或 6 段開關，AUX8 有 16 段；Wide 模式下 AUX2～AUX8 有更多段數（官方說明 3.x 依遙測比例為 64 或 128 段）。
3. **把多段開關或旋鈕放到 AUX2 以後**：在遙控器的混控頁，把三段開關或旋鈕指定到第 6 通道以後。
4. **到飛控看數值**：拆槳後到 Betaflight「接收機」頁撥開關，看通道數值有幾種變化，再到「模式」頁設定範圍。

## 看結果判斷

| 看到的情況 | 代表什麼 | 下一步 |
| --- | --- | --- |
| 三段開關放在 AUX1，只有兩種數值 | AUX1 只有兩段 | 改放到 AUX2 以後 |
| 放在 AUX2 以後，數值變化很少 | 開關模式的段數不夠 | 依需求選 Hybrid 或 Wide 模式 |
| 旋鈕轉動時數值一格一格跳 | 開關模式的段數有限 | Wide 模式段數較多；精細控制不要用 AUX1 |
| 「接收機」頁數值完全不動 | 通道沒有送出或混控沒設定 | 看遙控器混控頁的通道指定 |

:::checks 怎樣算修好
- 撥動三段開關時，Betaflight「接收機」頁對應通道出現三種明顯不同的數值
- 解鎖開關仍在 AUX1，撥動時數值只在兩段之間切換
- 「模式」頁設定的範圍，撥到對應位置時會亮起
:::

:::stop 什麼時候停手
調整過程中飛機有任何解鎖或馬達轉動的跡象：立刻撥回解鎖開關，確認全部螺旋槳已拆下再繼續。
:::
