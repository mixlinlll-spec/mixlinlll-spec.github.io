---
title: DJI O4 眼鏡沒有飛行資訊（OSD），或文字被切掉、太大
slug: dji-no-osd
published: true
order: 2
category: 數位圖傳
level: beginner
applies: DJI O4 Air Unit／O4 Air Unit Pro＋Betaflight 4.4、4.5、2025.12、2026.6
needs: 電腦、可傳資料的 USB 線
verified: 2026-10-28
summary: DJI 的飛行文字不是類比那種疊在影像上的晶片，而是飛控透過一條序列線（MSP DisplayPort）把文字傳給圖傳。沒有文字時，依序查：接線、Betaflight 設定、眼鏡顯示設定。
keywords:
  - OSD
  - Displayport
  - MSP
  - HD OSD
  - 沒有電壓
  - 文字被切
  - canvas
  - UART
legacy_items:
  - 4
  - 60
prepare:
  - 天空端到飛控接線處的照片（看得到 TX、RX 接在哪裡）
  - Betaflight「連接埠」「OSD」兩頁的截圖
  - 命令列 `diff all` 的完整文字
sources:
  - Betaflight 官方文件：OSD 頁（Video Format 的 HD 選項） | https://betaflight.com/docs/wiki/app/osd-tab
  - Oscar Liang：DJI O4 Pro 設定（OSD 預設集、接線） | https://oscarliang.com/how-to-setup-dji-o4-pro/
  - Oscar Liang：DJI O4 Lite 設定（OSD 預設集） | https://oscarliang.com/how-to-setup-dji-o4-lite/
  - Betaflight 官方原始碼（OSD 文字送往同時開了 MSP 與 VTX (MSP + Displayport) 的 UART） | https://github.com/betaflight/betaflight/blob/4.5-maintenance/src/main/config/config.c
---
:::safety 開始前
拆下螺旋槳。DJI 和類比的 OSD 設定方式不同：類比是飛控上的 OSD 晶片把文字疊在影像上，DJI 是飛控把文字資料傳給圖傳，不要照類比的教學改設定。
:::

## 建議檢查順序

1. **看接線**：天空端 6 針排線裡的 RX、TX 兩條線，要接到飛控同一組 UART（例如 UART1），而且交叉接：天空端的 TX 接飛控 RX，天空端的 RX 接飛控 TX。
2. **看「連接埠」頁**：找到天空端 TX／RX 實際接的那一組 UART（例如 UART1），把那一列的 Configuration/MSP 開關打開；同一列的 Peripherals（周邊設備）要選 VTX (MSP + Displayport)（Betaflight App 2026.6 的名稱，舊版可能略有不同）；沒選的話，飛控不會把文字送到這組 UART（以 4.5 原始碼為準，飛控只把文字送到第一組同時開了 MSP 和這個周邊設備的 UART）。其他 UART 不要再選 VTX (MSP + Displayport)。改完按 Save and Reboot。欄位位置可對照 [[receiver-no-control]] 的連接埠截圖。
3. **套用 OSD 預設集（選用）**：Betaflight 的「預設集」（Presets）頁搜尋「osd for dji」，依畫面上的選項，選擇 DJI 天空端接線的那一組 UART，並啟用 HD 畫面格式，套用後儲存。預設集的名稱與內容會隨版本更新，找不到時不用套用，照第 2、4 步手動設定即可。
4. **OSD 頁選 HD**：「OSD」頁的 Video Format（影像格式）選 HD。這個選項就是給透過 MSP Displayport 接收文字的數位圖傳用的。
5. **勾選要顯示的項目**：「OSD」頁勾選電壓、飛行時間等項目，拖到想要的位置。
6. **看眼鏡設定**：眼鏡裡的飛行資訊顯示要打開。

## 看結果判斷

| 看到什麼 | 代表什麼 | 下一步 |
| --- | --- | --- |
| 完全沒有任何文字 | 圖傳沒收到飛控的文字資料 | 回到第 1、2 步，查接線與「連接埠」頁的 UART 是否一致 |
| 只有 DJI 自己的文字，沒有 Betaflight 的電壓等項目 | 飛控那端沒有輸出 OSD | 第 2、3、4 步：周邊設備選 VTX (MSP + Displayport)、預設集、HD 格式 |
| 有文字，但被切掉、太大或位置跑掉 | 文字格子與眼鏡顯示範圍不一致 | 先把電壓、飛行模式移到畫面中央，看能否完整顯示，再逐一往邊緣調整 |
| 只有少數字元異常或偶爾閃掉 | 線材接觸或版本相容問題 | 把飛控與眼鏡、天空端都更新到相容版本，換一條正常的排線比較 |

:::advanced 進階：格子大小
選 HD 時，Betaflight 預設用 53 × 20 的文字格子；圖傳連上後，Betaflight 會向圖傳詢問並調整成它支援的格子大小。所以 OSD 頁的預覽位置，可能和眼鏡裡看到的略有差異，以眼鏡實際畫面為準。
:::

:::checks 怎樣算修好
- 眼鏡畫面看得到 Betaflight 的電壓、飛行時間等項目
- 四個角落的項目都完整顯示，沒有被切掉
- 拆槳解鎖時，畫面上的解鎖狀態或計時跟著改變
:::

:::stop 什麼時候停手
接線時發現天空端的電源線和 TX／RX 線接錯位置、接上電後有異常發熱：能安全拔掉電池就立刻拔掉，不要用手去碰發燙的零件；先核對接線圖，不要再通電。冒煙或起火時先遠離，有火勢就離開現場並打 119。
:::
