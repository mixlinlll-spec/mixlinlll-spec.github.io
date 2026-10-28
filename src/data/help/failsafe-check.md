---
title: 失聯保護怎麼確認真的有效
slug: failsafe-check
published: true
order: 2
category: GPS／返航
level: beginner
applies: Betaflight 飛控
checked: 依 Betaflight 官方文件撰寫
hw_verified: 尚未實機驗證
needs: 電池、遙控器、眼鏡
verified: 2026-10-28
summary: 拆槳後在地面關掉遙控器測一次：飛機要在約一兩秒後停機上鎖。換接收機或更新韌體後都要重測。
keywords:
  - Failsafe
  - RXLOSS
  - !FS!
  - RESC
  - 失控
  - 關遙控器
  - Drop
  - KILL
legacy_items:
  - 16
  - 15
  - 40
  - 41
  - 77
  - 78
prepare:
  - 地面測試時的眼鏡錄影
  - 接收機型號
sources:
  - Betaflight 官方文件：Failsafe 失聯保護 | https://betaflight.com/docs/wiki/guides/current/Failsafe
---
:::safety 只在地面、拆槳測試
拆下全部螺旋槳，飛機放在地上。一般玩家只需要做這個地面測試，不需要也不建議在空中測試。
:::

## 常見原因
- 接收機失聯時還一直送訊號，飛控以為沒斷
- 「失聯保護」頁的設定被改過
- 換過接收機或更新韌體後沒有重測

## 檢查步驟
1. **準備**：拆槳、插電池、拔掉 USB，戴上眼鏡。
2. **解鎖**：推一點油門，讓馬達轉起來。
3. **關掉遙控器**：或只關掉高頻頭。
4. **看馬達**：原廠設定下，約一兩秒後馬達停止、飛機上鎖，OSD 出現 FAIL SAFE 等失聯警告。如果你的飛機設定成 GPS 返航或降落，結果會不同，請交給 EWP 確認。
5. **恢復**：重新開遙控器，把解鎖開關撥回「關」，才能再次解鎖。

:::checks 怎樣算修好
- 關掉遙控器後，馬達在約一兩秒內停止並上鎖（原廠設定）
- 遙控器重新開機後，要先把解鎖開關撥回「關」才能再解鎖
:::

:::stop 什麼時候停手
關掉遙控器後馬達還繼續轉，或一直沒有上鎖：飛控偵測不到失聯，修好之前絕對不要飛，請交給 EWP 檢查。GPS 返航的設定與測試需要專業驗證，也請交給 EWP。
:::
