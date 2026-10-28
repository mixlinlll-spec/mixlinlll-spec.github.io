---
title: 解鎖後馬達不轉、只有幾顆轉，或一起飛就翻
slug: motors-after-arming
published: true
order: 1
category: 馬達／電調
level: beginner
applies: Betaflight 四軸穿越機
checked: 依 Betaflight 官方文件撰寫
hw_verified: 尚未實機驗證
needs: 電腦、USB 線
verified: 2026-10-28
summary: 一起飛就翻，幾乎都是馬達順序、轉向或槳裝反。拆槳後在 Betaflight「馬達」頁逐顆確認。
keywords:
  - 馬達不轉
  - 翻機
  - flip
  - 起飛就翻
  - 馬達順序
  - 馬達方向
  - props out
  - Motor Stop
legacy_items:
  - 11
  - 23
  - 70
prepare:
  - 「馬達」頁測試影片
  - 電調與飛控型號
sources:
  - Betaflight 官方文件：Motors 頁 | https://betaflight.com/docs/wiki/configurator/motors-tab
---
:::safety 一定要拆槳
在「馬達」頁測試前，拆下全部螺旋槳，並勾選「我了解風險」才能轉動馬達。
:::

## 常見原因
- 槳裝反，或正反槳位置錯
- 馬達順序或轉向設定錯
- 某顆馬達或電調故障

## 檢查步驟
1. **看槳的方向**：槳的前緣要朝轉動方向；對照「配置」頁的機型圖，確認每顆槳的轉向。
2. **「馬達」頁逐顆轉**：只推 1 號滑桿，看是不是機型圖上 1 號位置在轉，依序到 4 號。
3. **看轉向**：每顆馬達的轉向要和機型圖一致。
4. **只有幾顆轉**：轉不動的那顆，斷電後檢查焊點有沒有斷。

:::checks 怎樣算修好
- 「馬達」頁每顆馬達的位置與轉向都和機型圖一致
- 裝槳後，低油門起飛不會翻
:::

:::stop 什麼時候停手
順序或轉向不對時，不要裝槳試飛。馬達冒煙、轉不動或電調發燙：停用，交給 EWP 調整或檢測。
:::
