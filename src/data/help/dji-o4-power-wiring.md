---
title: DJI O4 供電與接線：4S／6S 能不能直接接、DJI 遙控器 3 不能控制
slug: dji-o4-power-wiring
published: true
order: 5
category: 數位圖傳
level: beginner
applies: DJI O4 Air Unit／O4 Air Unit Pro＋Betaflight 4.4、4.5、2025.12、2026.6
needs: 電腦、可傳資料的 USB 線
verified: 2026-10-28
summary: O4 和 O4 Pro 能接受的電壓不同，不能只看電池幾串就接上。賣場名稱不一定是正式型號，接線一律以機身標籤與原廠接線圖為準。DJI 遙控器 3 要控制飛機，飛控還要設定 SBUS 接收。
legacy_items:
  - 53
  - 54
  - 55
prepare:
  - 天空端機身標籤與板號的照片
  - 天空端接到飛控每一條線的照片（兩面都拍）
  - Betaflight「連接埠」「接收機」兩頁的截圖
sources:
  - DJI 官方：O4 Air Unit 系列規格（輸入電壓、相容眼鏡與遙控器） | https://dji.com/o4-air-unit/specs
  - Oscar Liang：DJI O4 Pro 設定（供電、接線、SBUS） | https://oscarliang.com/how-to-setup-dji-o4-pro/
  - Oscar Liang：DJI O4 Lite 設定（供電建議） | https://oscarliang.com/how-to-setup-dji-o4-lite/
---
:::safety 開始前
資料不完整時先不要接電池。接錯電壓可能直接燒壞天空端，而且燒壞後通常無法自行修復。
:::

## 先看型號，再決定怎麼供電

| 型號（看機身標籤） | 官方輸入電壓 | 可以直接接哪些電池 |
| --- | --- | --- |
| O4 Air Unit | 3.7–13.2V | 2S～3S 可直接接；1S 電壓下降時可能不穩，不建議直接接 1S；不能直接接 4S 或 6S |
| O4 Air Unit Pro | 7.4–26.4V | 2S～6S |

一般 LiPo 4S 滿電約 16.8V、6S 滿電約 25.2V，所以一般 O4 不能直接接 4S 或 6S 的電池電壓，要接飛控上的穩壓供電焊點。Oscar Liang 建議：O4 用至少 5V 2A 或 9V 1A 的穩壓供電；O4 Pro 即使可以直接接電池，也建議接 9V 穩壓、至少能供應 1.5A。

## 建議檢查順序

1. **以機身標籤為準**：賣場名稱可能不是正式型號，同一個接頭也不保證線序相同。
2. **逐條對照接線圖**：電源、地線、TX、RX、SBUS 一條一條對照原廠接線圖，不要只看線的顏色。
3. **有轉接板或降壓板時**：先分清楚它的輸入端和輸出端，再量輸出電壓。
4. **要用 DJI 遙控器 3 控制**：看下面的「遙控器 3 不能控制」。

## 遙控器 3 不能控制飛機

依 DJI 官方規格，DJI FPV 遙控器 3 搭配 Goggles 3 或 Goggles N3 使用；Goggles 2／Integra 要搭配遙控器 2。有畫面不代表控制線已經接好。

1. **看相容組合**：眼鏡、天空端、遙控器要是官方列出的組合，並完成配對。
2. **飛控設定 SBUS**：天空端的 SBUS 線接到飛控某一組 UART 的 RX，在「連接埠」頁那一組打開 Serial RX，「接收機」頁的協定選 SBUS。DJI 規格註明需要 Betaflight 4.3.0 以上。
3. **看「接收機」頁**：撥動搖桿，通道條會跟著動才算接好。
4. **改用 ELRS 等其他接收機時**：把天空端的 SBUS 線拔掉，只保留一套接收方式。

:::advanced 進階：使用遙控器 3 的失聯行為
用 DJI 遙控器 3 時，影像和遙控走同一條無線連線，所以影像斷訊時，飛控也會進入失聯保護。設定失聯保護時要把這點考慮進去。
:::

:::checks 怎樣算修好
- 接上電池前，用電表量到天空端供電處的電壓在該型號官方範圍內
- 天空端正常開機、綠燈恆亮，眼鏡有畫面
- 使用遙控器 3 時：Betaflight「接收機」頁每支搖桿都動到對應的通道
:::

:::stop 什麼時候停手
天空端曾經接到超過規格的電壓、通電後冒煙或有燒焦味：立刻拔掉電池，不要再測試。接線圖和實物對不起來時，先停下來找供應商確認。
:::
