---
title: 電池有一節電壓老是差很多、平衡充卡在最後
slug: battery-cell-imbalance
published: true
order: 3
category: 電池／充電
level: beginner
applies: 多串 LiPo、LiHV、Li-ion 電池組
checked: 依一般電池使用建議撰寫（門檻為本站保守建議）
hw_verified: 尚未實機驗證
needs: 充電器或電壓表
verified: 2026-10-28
summary: 每節電壓差很多，可能是平衡頭接觸不良，也可能是某一節變弱。排除量測問題後落差仍大，就先停用。
keywords:
  - 電芯不平衡
  - 壓差
  - 弱芯
  - 平衡充卡住
  - balance
  - 一節特別低
  - cell
legacy_items:
  - 39
  - 74
  - 75
prepare:
  - 充飽靜置後每節電壓的照片
  - 電池型號與使用時間
sources:
  - WISPR：LiHV 電池充電與存放（平衡充與電芯不平衡時停用） | https://wisprsystems.atlassian.net/wiki/spaces/CS/pages/176947203/Charging+Storing+LiHV+Batteries+-+Ranger+Pro
---
## 常見原因
- 平衡頭接觸不良，量到錯的電壓
- 電池老化，某一節變弱
- 曾經過放或摔過

## 檢查步驟
1. **充飽靜置**：平衡充飽後放約十分鐘，再看每一節電壓。
2. **排除量測問題**：重插平衡頭，或換一台充電器、電壓表再量一次。
3. **判斷**：排除量測問題後，最高和最低一節還差約 0.1V 以上，就先停用。
4. **差約 0.05V 時**：繼續用平衡充，之後每次充飽都看一下，落差變大就停用。

0.05V、0.1V 是本站為了安全訂得比較保守的參考，不是通用的故障標準；超過不代表一定壞，但建議先停用、交給有工具的人檢測。

:::checks 怎樣算修好
- 平衡充飽靜置後，每節電壓差在約 0.05V 以內
- 之後幾次充飽再量，落差沒有變大
:::

:::stop 什麼時候停手
落差約 0.1V 以上、放著也一直掉電、充電時局部發熱或鼓包：停止使用，不要關掉平衡功能硬充，交給 EWP 檢測或依[[battery-swelling]]處理。
:::
