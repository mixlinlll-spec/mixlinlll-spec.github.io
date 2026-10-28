---
title: 新機第一次上電，要先檢查什麼
slug: first-power-up
published: true
order: 1
category: 新手檢查
level: beginner
applies: 所有穿越機
checked: 依官方文件與一般安全做法撰寫
hw_verified: 尚未實機驗證
needs: 限流器（Smoke Stopper）、電池
verified: 2026-10-28
summary: 第一次插電池前，先拆槳、接限流器。只要冒煙、有焦味或限流器一接就跳，就馬上拔電，不要重插。
keywords:
  - 新機
  - 開箱
  - 第一次通電
  - 冒煙
  - Smoke Stopper
  - 限流器
  - 首飛
  - first power up
legacy_items:
  - 44
  - 66
  - 67
  - 68
  - 69
prepare:
  - 上電時的狀況描述或影片
  - 飛控、電調、圖傳型號
sources:
  - Betaflight 官方文件：Motors 頁（拆槳與 Smoke Stopper 限流） | https://betaflight.com/docs/wiki/configurator/motors-tab
---
:::safety 一定要做
拆下全部螺旋槳。第一次上電要經過限流器（Smoke Stopper），短路時它會先跳掉，保護飛控和圖傳。
:::

## 常見問題
- 焊點短路、錫珠掉在板子上
- 電池正負極接反
- 螺絲或碳纖板壓到電路板

## 檢查步驟
1. **先看一遍**：電源線紅接正、黑接負；板子上沒有錫珠、線頭、金屬屑。
2. **接限流器再插電池**：飛控燈亮、電調發出開機音，就是正常。
3. **聞、看十秒**：有沒有冒煙、焦味、某個零件明顯發燙。
4. **數位圖傳例外**：DJI 等數位圖傳啟動電流大，經過限流器可能開不起來。前面三步都正常，才拿掉限流器直接接電池再試。

:::checks 怎樣算修好
- 經過限流器上電，沒有冒煙、焦味，限流器沒有跳
- 飛控燈亮、電調有開機音
:::

:::stop 什麼時候停手
冒煙、焦味、火花，或限流器一接就跳：馬上拔掉電池，不要再插一次試試看。可能已有零件燒毀或短路，請交給 EWP 檢測。
:::
