---
title: 充電器報錯、電池充不進去
slug: battery-wont-charge
published: true
order: 2
category: 電池／充電
level: beginner
applies: LiPo、LiHV、Li-ion 電池組（平衡充）
checked: 依充電器與電池原廠說明撰寫
hw_verified: 尚未實機驗證
needs: 平衡線、充電器
verified: 2026-10-28
summary: 充不進去最常見是平衡頭沒插好或充電模式選錯。電壓過低時不要硬充。
keywords:
  - 充不進去
  - 充電器報錯
  - 電壓過低
  - Low voltage
  - 救電
  - 喚醒
  - 節數錯誤
  - 4.1V
legacy_items:
  - 13
  - 73
  - 90
prepare:
  - 充電器錯誤畫面照片
  - 電池標籤照片
sources:
  - Grepow：LiPo 與 LiHV 的差別（各種類滿電電壓） | https://www.grepow.com/blog/lipo-battery-vs-lihv-battery-what-is-the-difference.html
  - WISPR：LiHV 電池充電與存放（充電模式與溫度提醒） | https://wisprsystems.atlassian.net/wiki/spaces/CS/pages/176947203/Charging+Storing+LiHV+Batteries+-+Ranger+Pro
---
## 常見原因
- 平衡頭沒插好、針腳氧化
- 充電模式或節數選錯
- 電池放到電壓過低

## 檢查步驟
1. **重插平衡頭與主電源**：插到底，看針腳有沒有歪掉或發黑。
2. **確認模式與節數**：看[[battery-types-voltage]]。
3. **看充電器顯示的每節電壓**：有一節特別低，看[[battery-cell-imbalance]]。
4. **充電電流**：一般用 1C（例如 1500mAh 用 1.5A）以下充電，Li-ion 依原廠說明。

:::checks 怎樣算修好
- 充電器正常開始充電，不再報錯
- 充飽後每節電壓相近
:::

:::stop 什麼時候停手
充電器報「電壓過低」：不要用其他方式硬充。電池發燙、鼓包、有異味：馬上停止充電，移到不可燃的地方，看[[battery-swelling]]。
:::
