---
title: 失聯保護怎麼確認真的有效
slug: failsafe-check
published: true
order: 3
category: GPS／返航
level: beginner
applies: Betaflight 4.4、4.5、2025.12、2026.6
needs: 電腦、USB 線、電池、遙控器
verified: 2026-10-28
summary: 遙控訊號斷掉時，飛機要照你的設定停機或返航。拆槳後在地面關掉遙控器測一次，就知道設定有沒有生效；換接收機或更新韌體後都要重測。
keywords:
  - Failsafe
  - RXLOSS
  - !FS!
  - 失控
  - 關遙控器
  - Drop
  - KILL
  - failsafe_switch_mode
legacy_items:
  - 16
prepare:
  - 「失聯保護」頁截圖
  - 地面測試時的眼鏡錄影（含 OSD）
  - 接收機型號與韌體版本
sources:
  - Betaflight 官方文件：Failsafe 失聯保護 | https://betaflight.com/docs/wiki/guides/current/Failsafe
  - Betaflight 官方原始碼（失聯保護預設值：failsafe_delay、failsafe_recovery_delay、failsafe_stick_threshold） | https://github.com/betaflight/betaflight/blob/4.5-maintenance/src/main/flight/failsafe.c
---
:::safety 開始前
拆下全部螺旋槳。所有失聯測試都先在地面做，確定行為正確後，才在空曠、沒有人車的軟地上，低高度、目視範圍內用開關做飛行測試。
:::

## 先了解失聯時會發生什麼

| 階段 | 什麼時候 | 飛機會怎樣 |
| --- | --- | --- |
| 偵測到失聯 | 飛控收不到遙控資料 | OSD 顯示 RXLOSS |
| 第一階段 | 失聯後一小段時間（`failsafe_delay`：4.5 起預設 1.5 秒，4.4 預設 1 秒） | 搖桿回中、油門依設定；這段時間內訊號恢復，立刻交還控制 |
| 第二階段 | 第一階段時間到 | OSD 顯示 !FS!，執行你選的處理：直接停機（預設）、降落或 GPS 救援。進入這個階段後，訊號恢復也不會馬上交還控制（見下方第 6 步） |

## 建議檢查順序

1. **看接收機的失聯行為**：接收機要設定成失聯時「不送資料」。接收機一直送最後的搖桿值，飛控就偵測不到失聯。
2. **看「失聯保護」頁的第二階段**：沒有 GPS 的飛機選直接停機；有 GPS 且已照 [[gps-rescue]] 測試過，才選 GPS 救援。官方文件不建議一般情況使用「降落」，因為飛機會邊降邊漂。
3. **拆槳、接電池、解鎖**：推一點油門讓馬達轉，然後關閉遙控器的發射模組（官方建議的做法；關掉整台遙控器也可以）。
4. **看 OSD 與馬達**：先出現 RXLOSS，第一階段結束後出現 !FS!，選直接停機的話馬達會停並上鎖。
5. **第一階段的「恢復控制」要另外測**：遙控器關機再開機、重新連上接收機，通常要好幾秒，已經超過 1.5 秒的第一階段，所以用「關機再開機」看不到第一階段的恢復，這是正常的。要測這一段，用「模式」頁的失聯保護開關，並把 `failsafe_switch_mode` 設成 STAGE1（見下方進階）：撥上時搖桿回中、油門依設定；撥回時要立刻恢復控制。
6. **第二階段之後的恢復**：遙控器重新連上後，飛機不會自己恢復：
   - 直接停機：飛機已經上鎖。先把解鎖開關撥回「關」，再重新解鎖（4.3 起不用重新上電）。開關還在「開」時，清單會出現 NOT_DISARMED（4.4 叫 BADRX；Betaflight App 2026.6 顯示為 BAD_RX_RECOVERY）。
   - 降落：訊號恢復超過 `failsafe_recovery_delay`（4.5 起預設 0.5 秒，4.4 預設 1 秒）才交還控制；降落時間結束時飛機會上鎖。
   - GPS 救援：訊號恢復後，還要把搖桿推離中間超過 30%（`failsafe_stick_threshold` 預設 30）才拿回控制，詳見 [[gps-rescue]]。

:::advanced 進階：失聯保護開關
「模式」頁可以設定失聯保護開關，用來在空中安全地測試。`failsafe_switch_mode` 有三種：STAGE1（先進第一階段）、STAGE2（直接執行第二階段處理）、KILL（立即上鎖）。官方文件提醒 KILL 只要通道一個雜訊就可能直接上鎖墜機。

官方的地面測試範例，也會暫時把第一階段拉長到 10 秒（`set failsafe_delay = 100`，單位是 0.1 秒），在這段時間內關閉再打開發射模組，確認 RXLOSS 出現、再消失並恢復控制。測完一定要改回原本的值（預設 `15`）再 `save`，不要帶著 10 秒的第一階段去飛。
:::

:::checks 怎樣算修好
- 關閉發射模組後，OSD 先顯示 RXLOSS，接著顯示 !FS!
- 第二階段的動作和你在「失聯保護」頁選的一致（例如直接停機時馬達停止並上鎖）
- 失聯保護開關（STAGE1）撥上再撥回，馬上恢復控制
- 第二階段後重新連上遙控器：選直接停機時，要先把解鎖開關撥回「關」才能再解鎖
:::

:::stop 什麼時候停手
關掉遙控器後馬達照樣依搖桿最後的位置轉、OSD 完全沒有 RXLOSS：代表飛控偵測不到失聯，修好之前不要飛。
:::
