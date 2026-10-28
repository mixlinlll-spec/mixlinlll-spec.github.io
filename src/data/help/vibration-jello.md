---
title: 錄影果凍、下降急停抖動、懸停晃動
slug: vibration-jello
published: true
order: 1
category: 震動／飛行手感
level: beginner
applies: 穿越機
checked: 依一般維修做法撰寫
hw_verified: 尚未實機驗證
verified: 2026-10-28
summary: 果凍和抖動多半來自震動：先換槳、檢查螺絲和馬達，再看相機固定。仍然抖，再交給 EWP 調參。
keywords:
  - 果凍
  - jello
  - 抖動
  - 震動
  - propwash
  - 懸停不穩
  - 晃
  - 共振
legacy_items:
  - 29
  - 30
  - 31
prepare:
  - 有果凍的錄影
  - 飛機的槳與馬達型號
sources:
  - Unmanned Tech：FPV Drone Jello Fix — The Vibration Checklist | https://www.unmannedtechshop.co.uk/blogs/knowledge-base/fpv-drone-jello-fix-vibration-checklist-every-build
  - Oscar Liang：Check if motor screws are touching motor winding | https://oscarliang.com/check-motor-screws-touching-winding
---
## 常見原因
- 槳葉損壞或不平衡
- 螺絲鬆脫、機架或馬達受損
- 相機固定太硬或鬆動

## 檢查步驟
1. **換新槳**：這是最常見也最便宜的解法。
2. **鎖緊螺絲**：馬達、機臂、上板、相機固定座都檢查一遍。
3. **檢查馬達**：拆槳用手轉，有卡沙聲就看[[motor-heat-noise]]。
4. **相機固定**：用減震座或 TPU 固定，不要讓相機直接頂在機架上。

:::checks 怎樣算修好
- 錄影畫面沒有明顯果凍
- 懸停穩定，下降急停時抖動明顯減少
:::

:::stop 什麼時候停手
飛行時有異音、馬達發燙，或越飛越抖：馬上降落。硬體都正常仍然抖，需要調整 PID 或濾波，請交給 EWP 調參服務。
:::
