---
title: 遙控器開了，飛機卻沒反應（ELRS 接收機）
slug: receiver-no-control
published: true
order: 1
category: 接收機／對頻
level: beginner
applies: ExpressLRS 接收機＋Betaflight
checked: 依 ExpressLRS 與 Betaflight 官方文件撰寫
hw_verified: 尚未實機驗證
needs: 電腦、USB 線
verified: 2026-10-28
summary: 先看接收機燈號：恆亮代表已連上，問題在飛控設定；一直閃代表沒連上，要重新對頻。
keywords:
  - 對頻
  - 對不到頻
  - bind
  - 綁定
  - ELRS
  - CRSF
  - Serial Rx
  - UART
legacy_items:
  - 0
  - 1
  - 2
  - 20
  - 21
  - 22
  - 49
  - 51
  - 50
  - 52
prepare:
  - 接收機型號與燈號影片
  - 「連接埠」與「接收機」頁截圖
  - 遙控器與接收機的 ELRS 版本
sources:
  - ExpressLRS 官方：燈號說明 | https://expresslrs.org/quick-start/led-status
  - ExpressLRS 官方：對頻方式與版本相容 | https://expresslrs.org/quick-start/binding
---
## 常見原因
- 遙控器和接收機沒有對頻，或兩邊韌體大版本不同
- Betaflight 的接收機設定不對
- 接收機線材鬆脫，或一插電池就斷電重啟

## 檢查步驟
1. **拆槳、插電池，看接收機燈**：恆亮是已連上，直接看第 3 步；慢閃是沒連上。
2. **重新對頻**：照接收機說明書進入對頻模式（多數 ELRS 接收機是連續插拔電源三次），遙控器執行 Bind。兩邊韌體要同一個大版本（例如都是 3.x）。
3. **看 Betaflight 設定**：「連接埠」頁接收機那一排要開 Serial Rx；「接收機」頁的協定，一般外接 ELRS 選 CRSF，DJI 遙控器選 SBUS。存檔後重開。
4. **推搖桿看「接收機」頁**：推油門時 Throttle 那條要跟著動，方向要對。

:::checks 怎樣算修好
- 接收機燈恆亮
- 「接收機」頁每個搖桿、開關都會動，而且對到正確的名稱
:::

:::stop 什麼時候停手
接收機發燙、冒煙，或插 USB 正常、一插電池就一直重啟或斷線：可能是供電問題，不要飛，交給 EWP 檢測。
:::
