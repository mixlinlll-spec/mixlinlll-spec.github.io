---
title: 2.4G 遙控和 2.4G 圖傳互相干擾，或多台同場一起飛就斷訊
slug: radio-interference
published: true
order: 2
category: 遙控與圖傳訊號
level: beginner
applies: 2.4G 遙控系統＋2.4G 或 5.8G 圖傳；多人同場
checked: 依官方文件撰寫
hw_verified: 尚未實機驗證
verified: 2026-10-28
summary: 遙控和圖傳都用 2.4G 時容易互相干擾；多人同場要錯開頻道，天線也不要靠在一起。
keywords:
  - 干擾
  - interference
  - 2.4G
  - 頻道
  - channel
  - 多人飛行
  - 同場
  - 撞頻
legacy_items:
  - 42
  - 43
prepare:
  - 飛行錄影
  - 遙控與圖傳的頻段、型號
sources:
  - Unmanned Tech：圖傳、GPS、遙控天線安裝位置 | https://www.unmannedtechshop.co.uk/blogs/knowledge-base/fpv-drone-antenna-placement-guide-vtx-gps-rc-mounting
  - Betaflight 官方文件：圖傳設定 | https://betaflight.com/docs/wiki/guides/current/VTX
---
## 常見原因
- 遙控與圖傳都在 2.4G，天線靠得太近
- 多人同場使用相同或相鄰頻道
- 現場 Wi-Fi 等干擾

## 檢查步驟
1. **天線分開**：飛機上的遙控天線和圖傳天線盡量拉開距離。
2. **多人同場先協調**：大家錯開圖傳頻道，起飛前先確認彼此畫面不受影響。
3. **近距離測試**：開著所有人的設備，在近處懸停，看有沒有斷訊。
4. **換場地比較**：在干擾少的地方飛，確認是不是環境造成的。

:::checks 怎樣算修好
- 多人同場時，彼此畫面與控制都穩定
- 近距離懸停時，OSD 沒有出現訊號警告
:::

:::stop 什麼時候停手
OSD 出現訊號警告或畫面破碎就往回飛降落。干擾一直存在時，不要硬飛。
:::
