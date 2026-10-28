---
title: LiPo、LiHV、Li-ion 怎麼分？滿電、存放、降落電壓一次看懂
slug: battery-types-voltage
published: true
order: 1
category: 電池／充電
level: beginner
applies: 一般 LiPo、LiHV、Li-ion 電池（每節電壓）
checked: 依電池原廠規格與一般使用建議撰寫
hw_verified: 尚未實機驗證
verified: 2026-10-28
summary: 先看電池標籤分出種類，再選對充電模式。充錯模式會過充或充不滿；降落時機以靜置電壓為準。
keywords:
  - 電池種類
  - HV
  - LiHV
  - 滿電幾伏
  - 存放電壓
  - 降落電壓
  - 截止電壓
  - 2.5V
legacy_items:
  - 82
  - 83
  - 84
  - 85
  - 86
  - 87
  - 88
  - 89
prepare:
  - 電池標籤照片
  - 充電器型號與設定畫面
sources:
  - Grepow：LiPo 與 LiHV 的差別（標稱、滿電與存放電壓） | https://www.grepow.com/blog/lipo-battery-vs-lihv-battery-what-is-the-difference.html
  - WISPR：LiHV 電池充電與存放 | https://wisprsystems.atlassian.net/wiki/spaces/CS/pages/176947203/Charging+Storing+LiHV+Batteries+-+Ranger+Pro
---
## 先看標籤
| 種類 | 標籤常見字樣 | 滿電（每節） | 存放（每節） |
| --- | --- | --- | --- |
| LiPo | LiPo、3.7V | 4.20V | 約 3.80V |
| LiHV | LiHV、HV、3.8V | 4.35V | 約 3.85V |
| Li-ion | 18650、21700、3.6V | 4.20V | 依商品頁說明（EWP 電池約 3.8V） |

## 檢查步驟
1. **看標籤**：分清楚是哪一種電池，不確定就不要充。
2. **充電器選對模式**：LiPo 選 LiPo，LiHV 選 LiHV，Li-ion 選 Li-ion（LiIon）。
3. **節數要對**：充電器顯示的節數要和電池標籤一樣（例如 4S、6S）。
4. **降落時機**：LiPo／LiHV 落地靜置後每節約 3.5～3.7V 就該停；Li-ion 依商品頁說明，不要飛到沒電。

:::checks 怎樣算修好
- 充電器的種類與節數，和電池標籤一致
- 充飽後每節電壓接近上表的滿電值
:::

:::stop 什麼時候停手
不確定電池種類、充電器節數判斷錯、電池充電時發燙或鼓起：馬上停止充電，看[[battery-swelling]]。
:::
