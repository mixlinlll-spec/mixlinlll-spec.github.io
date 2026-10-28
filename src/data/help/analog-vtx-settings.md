---
title: 類比圖傳不能換頻道、Betaflight 顯示未就緒，或只能近距離收到
slug: analog-vtx-settings
published: true
order: 3
category: 類比圖傳
level: beginner
applies: 類比圖傳（SmartAudio、IRC Tramp 控制）＋Betaflight 4.4、4.5、2025.12、2026.6
checked: 依官方文件與 Betaflight App 介面文字，未逐版核對韌體原始碼。
hw_verified: 尚未實機驗證
needs: 電腦、可傳資料的 USB 線、眼鏡、飛機電池；部分步驟需要三用電表
verified: 2026-10-28
summary: 有畫面、但 Betaflight 改不了頻道或顯示未就緒，問題多半在「控制線」或 Betaflight 的設定（連接埠、協定、頻道表），和影像是兩回事。只能近距離收到，先懷疑圖傳還在低功率模式（Pit mode）。
keywords:
  - Pit mode
  - 低功率
  - SmartAudio
  - Tramp
  - VTX Table
  - 換頻道
  - 未就緒
  - Device ready
  - vtx_low_power_disarm
legacy_items:
  - 9
  - 61
  - 62
prepare:
  - 圖傳型號與它使用的控制協定（SmartAudio 或 Tramp）
  - 控制線接到飛控哪個焊點的照片
  - Betaflight「連接埠」與「圖傳」兩頁的截圖
sources:
  - Betaflight 官方文件：VTX 設定（VTX Table、低功率與 Pit mode） | https://betaflight.com/docs/wiki/guides/current/VTX
  - Oscar Liang：SmartAudio／Tramp 與 VTX Table 設定 | https://oscarliang.com/smartaudio-tramp-vtx-control-vtxtables/
---
:::safety 開始前
圖傳沒接天線就不要通電。拆下螺旋槳，地面測試時用風扇幫圖傳散熱。退出低功率模式或調高功率後，圖傳發熱會明顯增加，地面不要長時間通電；發射功率請依當地法規設定。
:::

{{tool:case-picker}}

## 依狀況處理

:::case A Betaflight 改不了頻道、「圖傳」頁的 Device ready 顯示未就緒
1. **先用圖傳本體按鍵換一次頻道**：眼鏡跟著換得到，代表圖傳本身正常，問題在控制線或設定。
2. **「連接埠」頁選對 UART**：圖傳的控制線要接在某一組 UART 的 TX 焊點（有些飛控另外標示 SA 或 VTX 專用焊點，依飛控接線圖）。接在哪一組，就在那一組的周邊設備（Peripherals）選圖傳的控制協定：VTX (TBS SmartAudio) 或 VTX (IRC Tramp)，其他組不要選。
3. **選對協定**：依圖傳原廠說明選 SmartAudio 或 Tramp。介面上不用選 SmartAudio 的版本（1.0、2.0、2.1），由飛控自動偵測；版本不同，要載入的頻道表也不同，下一步依圖傳原廠提供的檔案載入。
4. **載入 VTX Table（頻道表）**：Betaflight 4.1 起頻道與功率不再內建，要依你的圖傳載入頻道表，建議用「預設集」或原廠提供的檔案，不要手動亂填。
5. **看控制線和地線**：線很細，摔機後容易斷；不要自行加電阻或改線，依原廠接線圖核對。
:::

:::case B 只能在很近的距離收到
1. **看是不是低功率模式（Pit mode）**：這個模式下發射功率極低，只有在旁邊才收得到。看圖傳燈號或 OSD 上的功率顯示。
2. **看遙控器開關**：有些設定會用遙控器上的開關切換低功率模式，看看那個開關是不是一直開著。
3. **依圖傳說明退出**：部分 SmartAudio 1.0、2.0 圖傳只能在通電當下進入 Pit mode，之後由 Betaflight 讓它離開。
4. **解鎖前低功率是設定出來的**：`vtx_low_power_disarm` 設成 ON 時，每次上鎖都會降到最低功率、解鎖後才恢復；設成 UNTIL_FIRST_ARM 時，開機後到第一次解鎖前維持最低功率。這不是故障。
5. **退出後還是很近才有畫面**：斷電後看天線接頭有沒有鬆、有沒有插錯 SMA／RP-SMA、天線線材有沒有被壓斷；再拆槳、接電池，電表切到直流電壓（V）檔，黑棒碰飛控的 GND 焊點，紅棒碰該零件的電源焊點，讀數要在圖傳規格的輸入電壓範圍內。都正常仍然一樣，看 [[analog-no-video]]。
:::

:::checks 怎樣算修好
- 在 Betaflight「圖傳」頁或 OSD 選單換頻道後，眼鏡重新自動搜台（或手動切到同一個頻道），在新頻道看得到畫面；眼鏡不會自己跟著換，要重新搜台
- 在 Betaflight「圖傳」頁改頻道或功率並儲存後，OSD 上的頻道／功率顯示跟著改變
- 退出低功率模式後拿著飛機慢慢走遠，能清楚收到畫面的距離明顯比原本遠（實際距離依功率設定、天線與環境而異）。`vtx_low_power_disarm` 是 ON 或 UNTIL_FIRST_ARM 時，上鎖狀態走遠測試不準，先在「圖傳」頁看這個設定
:::

:::stop 什麼時候停手
圖傳燙到無法觸碰，或沒接天線就通電過一段時間：能安全拔掉電池就立刻拔掉，看文末「還是不行？」。冒煙或有焦味時不要用手去碰，先遠離觀察，有起火就離開現場並打 119。
:::
