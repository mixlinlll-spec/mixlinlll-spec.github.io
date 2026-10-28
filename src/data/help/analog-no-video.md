---
title: 類比圖傳：眼鏡看不到畫面
slug: analog-no-video
published: true
order: 1
category: 類比圖傳
level: beginner
applies: 類比圖傳與類比眼鏡
checked: 依官方文件撰寫
hw_verified: 尚未實機驗證
verified: 2026-10-28
summary: 先看眼鏡畫面：滿滿雪花是頻道不同；黑畫面但有文字是鏡頭沒影像；全黑沒文字是圖傳或線材問題。
keywords:
  - 沒畫面
  - 黑屏
  - 雪花
  - no video
  - VTX
  - OSD
  - 鏡頭沒畫面
  - 頻道
legacy_items:
  - 8
prepare:
  - 眼鏡畫面照片或錄影
  - 圖傳、鏡頭、眼鏡型號
sources:
  - BETAFPV 官方支援：黑畫面（有／無 OSD）排查 | https://support.betafpv.com/hc/en-us/articles/900003657086
  - Betaflight 官方文件：圖傳設定 | https://betaflight.com/docs/wiki/guides/current/VTX
---
:::safety 一定要先裝天線
圖傳沒接天線就通電，可能燒壞圖傳。
:::

## 常見原因
- 眼鏡和圖傳不在同一個頻道
- 鏡頭排線鬆脫
- 圖傳天線沒接好或損壞

## 檢查步驟
1. **滿滿雪花**：眼鏡和圖傳頻道不同。把眼鏡改成自動搜台，或照圖傳燈號、OSD 上的頻道手動對齊。
2. **黑畫面，但有電壓等文字**：鏡頭沒有影像。斷電後把鏡頭排線兩端重新插好，看線有沒有破損。
3. **全黑、沒有文字**：斷電後檢查圖傳天線與排線接頭，再換一支好的天線試試。
4. **只有近距離看得到**：天線可能壞了，或圖傳還在低功率／Pit mode，看[[analog-vtx-settings]]。

:::checks 怎樣算修好
- 眼鏡畫面清楚，看得到 OSD 文字
- 走遠約 10～20 公尺，畫面仍穩定
:::

:::stop 什麼時候停手
圖傳燙到不敢摸、有焦味，或沒接天線時已經通電過：先停用，交給 EWP 檢測。
:::
