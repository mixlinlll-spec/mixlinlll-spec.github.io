---
title: 長期不飛，電池要怎麼存放
slug: battery-storage
published: true
order: 6
category: 電池／充電
level: beginner
applies: LiPo、LiHV、Li-ion 電池
checked: 依一般電池使用建議撰寫
hw_verified: 尚未實機驗證
needs: 充電器
verified: 2026-10-28
summary: 長期不飛時，用充電器的 Storage 功能把電池充放到存放電壓，放在陰涼乾燥處，每個月檢查一次。
keywords:
  - 存放電壓
  - storage
  - 保存
  - 放很久
  - 冬天不飛
  - 3.8V
  - 自放電
legacy_items:
  - 37
prepare:
  - 存放前後的電壓紀錄
  - 電池型號
sources:
  - Grepow：LiPo 與 LiHV 的差別（存放電壓） | https://www.grepow.com/blog/lipo-battery-vs-lihv-battery-what-is-the-difference.html
  - WISPR：LiHV 電池充電與存放（存放電壓） | https://wisprsystems.atlassian.net/wiki/spaces/CS/pages/176947203/Charging+Storing+LiHV+Batteries+-+Ranger+Pro
---
## 常見錯誤
- 滿電放著好幾天
- 電量很低時放著，越放越低
- 放在車上、陽光下等高溫處

## 檢查步驟
1. **用 Storage 功能**：充電器選 Storage，把每節調到存放電壓（看[[battery-types-voltage]]）。
2. **拔掉所有接頭**：電池不要接著飛機或電壓警報器。
3. **安全存放**：放進防火袋或不可燃的盒子，陰涼乾燥，遠離熱源。
4. **每個月檢查**：看外觀、量電壓，記錄下來比較。

:::checks 怎樣算修好
- 存放前每節都在存放電壓附近
- 一個月後再量，沒有某一節明顯掉得比較多，外觀也沒有膨脹
:::

:::stop 什麼時候停手
沒接任何東西卻一直掉電、某一節掉得特別多，或外觀膨脹：先停用，不要充電，交給 EWP 檢測或依[[battery-swelling]]處理。
:::
