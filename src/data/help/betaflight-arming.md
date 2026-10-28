---
title: 插上電池後，飛機怎麼撥都解鎖不了
slug: betaflight-arming
published: true
order: 1
category: 飛控設定
level: beginner
applies: Betaflight 飛控
checked: 依 Betaflight 官方文件撰寫
hw_verified: 尚未實機驗證
needs: 電腦、USB 線
verified: 2026-10-28
summary: 解鎖不了時，飛控會告訴你原因。先看眼鏡或 Betaflight「設定」頁的英文字，再照下面的查詢處理。
keywords:
  - 解不了鎖
  - 無法解鎖
  - arm
  - arming disabled
  - 不能起飛
  - RXLOSS
  - THROTTLE
  - ANGLE
legacy_items:
  - 10
prepare:
  - 眼鏡或「設定」頁顯示的解鎖原因截圖
  - Betaflight 版本
sources:
  - Betaflight 官方文件：解鎖流程與安全 | https://www.betaflight.com/docs/wiki/guides/current/Arming-Sequence-And-Safety
  - Oscar Liang：Quad Arming Issue Fix | https://oscarliang.com/quad-arming-issue-fix
---
## 常見原因
- 遙控器沒連上（RXLOSS）
- 油門不在最低（THROTTLE）
- 飛機放太斜（ANGLE），或電腦還連著（MSP）

## 檢查步驟
1. **看原因**：解鎖開關撥到「開」，眼鏡 OSD 會輪流顯示不能解鎖的原因；或接電腦到「設定」頁，看 Arming Disable Flags。
2. **查下面的表**：輸入看到的字，照建議處理。
3. **油門拉到最低、飛機放平**，解鎖開關先撥回「關」再撥「開」。
4. **拔掉 USB 再試**：電腦連著時通常不能解鎖。

{{tool:arming-flags}}

:::checks 怎樣算修好
- 拆槳後，解鎖開關撥「開」，馬達開始怠速轉動
- 撥回「關」，馬達立刻停止
:::

:::stop 什麼時候停手
解鎖測試都要先拆槳。看到不認得的原因、查不到，或解鎖後馬達自己加速，就不要再試，請聯絡 EWP。
:::
