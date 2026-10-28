---
title: GPS 找不到衛星，或位置一直飄
slug: gps-no-fix
published: true
order: 1
category: GPS／返航
level: beginner
applies: Betaflight 4.4、4.5、2025.12、2026.6＋UBLOX 類 GPS 模組
needs: 電腦、USB 線、電池、戶外空曠場地
verified: 2026-10-27
summary: 先分清楚是「飛控根本沒讀到 GPS」，還是「讀到了但收不到衛星或定位不穩」。前者是接線或設定，後者是收星環境與安裝位置。
keywords:
  - 0 顆衛星
  - No fix
  - 3D Fix
  - UBLOX
  - M10
  - 收不到星
  - GPS 飄
  - PDOP
legacy_items:
  - 14
  - 76
prepare:
  - Betaflight「GPS」頁截圖（在戶外等待幾分鐘後）
  - GPS 模組型號，以及模組在機身上的安裝位置照片
  - 「連接埠」頁截圖
sources:
  - Betaflight App 原始碼：感測器列 GPS 圖示的顏色規則 | https://github.com/betaflight/betaflight-configurator/blob/master/src/components/sensor-status/SensorStatus.vue
  - Betaflight 官方文件：GPS 頁 | https://betaflight.com/docs/wiki/app/gps-tab
  - Betaflight 官方文件：GPS Rescue（4.4 以後） | https://betaflight.com/docs/wiki/guides/current/GPS-Rescue
  - Unmanned Tech：天線與 GPS 安裝位置 | https://www.unmannedtechshop.co.uk/blogs/knowledge-base/fpv-drone-antenna-placement-guide-vtx-gps-rc-mounting
---
:::safety 開始前
拆下螺旋槳。收星測試一定要在戶外空曠處，室內、車內、鐵皮屋簷下都收不到或收得很差。
:::

{{tool:case-picker}}

## 先分清楚是哪一種狀況

接上電池、USB 連上電腦，打開 Betaflight App（舊稱 Configurator）。畫面上方的感測器列有一個衛星圖示：灰色是沒有偵測到 GPS，紅色是偵測到 GPS 但還沒定位，亮起是已經定位（以 Betaflight App 的顯示為例，舊版軟體顏色可能不同）。

衛星數是 0 不一定是接線問題：在室內、或剛通電還在搜星時，接線正常也會是 0。所以要先看「飛控有沒有收到 GPS 的資料」，再看衛星數。

| 你看到的 | 代表什麼 | 看哪一段 |
| --- | --- | --- |
| 衛星圖示是灰色，GPS 頁的資料也完全不動 | 飛控沒有收到 GPS 的資料 | A |
| 衛星圖示是紅色，在戶外等了幾分鐘，衛星數仍很少或是 0、一直沒有 3D Fix | GPS 有連上，但還沒定位（收星環境、天線朝向或干擾） | B |
| 有 3D Fix 和足夠的衛星數，但地圖位置一直跳動 | 已經定位，但位置不穩 | C |

同樣是衛星數 0：在室內是正常的；在戶外空曠處等了幾分鐘還是 0，而且衛星圖示是紅色，比較可能是天線被遮住或受干擾，先看 B 段，不要直接重新焊線。

## 依狀況處理

:::case A 飛控沒有收到 GPS 的資料
1. **看 GPS 有沒有亮燈**：多數 GPS 模組通電後會亮燈。完全不亮，代表沒有供電，檢查供電與地線焊點。
2. **看接線方向**：GPS 的 TX 接飛控的 RX，GPS 的 RX 接飛控的 TX（交叉接），兩條都要接在同一組 UART。
3. **看「連接埠」頁**：GPS 接在哪一組 UART，就在那一組的感測器輸入選 GPS，同一組不要再開其他功能。
4. **看「GPS」頁的協定**：多數模組選 UBLOX，並保持自動設定（Auto Config）開啟。官方文件註明 M10 系列模組需要 Betaflight 4.5 或更新版本。
:::

:::case B GPS 有連上，但一直沒有定位
1. **換到空曠處多等幾分鐘**：遠離建築、鐵皮與車子。第一次定位可能要等好幾分鐘，等待期間不要移動飛機。
2. **看模組的朝向**：GPS 陶瓷天線那面要朝上，上方不能被碳纖板、電池綁帶、相機座擋住。裝在電池下方會擋掉大部分天空。
3. **看模組離干擾源多遠**：GPS 要遠離圖傳與電調，參考做法是至少間隔約 3 公分。
4. **開關圖傳比較**：關掉圖傳時衛星數明顯變多，代表圖傳干擾 GPS，需要調整安裝位置。
:::

:::case C 有定位，但位置一直飄
1. **再等久一點**：有衛星數不代表位置已穩定。放在地上不動，看 GPS 頁的 PDOP（定位精度因子，數字越小越好）有沒有慢慢下降、地圖位置有沒有穩定下來。
2. **重複 B 段的第 2～4 步**：天線朝向、遮蔽與干擾，都會讓位置不穩。
3. **位置仍然一直跳**：先不要使用 GPS 救援，看文末「還是不行？」。
:::

:::checks 怎樣算修好
- 「GPS」頁顯示 3D Fix，衛星數在戶外等待後穩定
- 飛機放在地上不動時，地圖上的位置不會一直跳
- 打開與關閉圖傳時，衛星數沒有明顯差異
:::

:::stop 什麼時候停手
GPS 模組或飛控插電後變燙、冒煙：不要用手去碰；能安全拔掉電池就拔掉，然後遠離觀察，有起火就離開現場並打 119。位置一直飄卻打算靠 GPS 救援遠飛：先停下來，位置不穩定時救援可能飛錯方向。
:::
