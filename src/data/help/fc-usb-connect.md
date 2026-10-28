---
title: 電腦連不上 Betaflight
slug: fc-usb-connect
published: true
order: 1
category: 電腦連線
level: beginner
applies: Windows 電腦＋Betaflight 飛控（STM32 晶片）
needs: 電腦、可傳資料的 USB 線
verified: 2026-10-28
summary: 先看電腦有沒有「發現」飛控。完全沒反應、看得到但連不上、只出現 STM32 BOOTLOADER，是三種不同的問題，處理方式完全不同。
keywords:
  - 連不上
  - 認不到飛控
  - USB
  - 驅動
  - Zadig
  - DFU
  - STM32 BOOTLOADER
  - COM port
  - ImpulseRC
  - Driver Fixer
legacy_items:
  - 25
prepare:
  - 電腦「裝置管理員」畫面截圖（插上飛控後）
  - 飛控型號，以及最後一次成功刷入的 Betaflight 版本
  - USB 插座的清楚照片
sources:
  - Betaflight 官方文件：安裝與驅動程式 | https://betaflight.com/docs/wiki/guides/current/Installing-Betaflight
  - Oscar Liang：Can’t Connect to Betaflight or Flash Firmware | https://oscarliang.com/fc-driver-issues-flash-firmware
---
:::safety 開始前
只接 USB，不用接電池。先關掉其他可能佔用 USB 連線的軟體，例如 BLHeli Configurator、INAV Configurator、另一個開著的 Betaflight 視窗。2025.12 起電腦軟體改名為 Betaflight App，可以直接用 Chrome 或 Edge 打開 app.betaflight.com，舊版叫 Betaflight Configurator。
:::

## 建議檢查順序

1. **換一條確定能傳資料的線**：很多 USB 線只能充電，插上後電腦完全不會有反應。用一條確定能傳手機照片的線最保險。
2. **直接插電腦**：不要先接 USB 集線器或螢幕上的插孔，換電腦本身的另一個 USB 孔試試。
3. **打開「裝置管理員」**：在 Windows 開始按鈕上按右鍵，選「裝置管理員」，插拔飛控時看清單有什麼變化，再對照下面的狀況。

{{tool:case-picker}}

## 依電腦看到的狀況處理

:::case A 電腦完全沒反應
插上飛控後，裝置管理員沒有任何變化。先看飛控上的燈有沒有亮，再往下對照。

| 看到的現象 | 可能原因 | 下一步 |
| --- | --- | --- |
| 燈完全不亮 | 線沒插緊或斷線、電腦這個 USB 孔沒供電、飛控的 USB 插座接觸不良；也可能這片飛控只靠 USB 時本來就不亮燈（有些燈要韌體啟動或接電池才亮）；少數是飛控上的電源短路或 USB 保護元件損壞 | 照下面 1～4 步逐一排除，不要一開始就認定是線或插座壞了 |
| 燈有亮，但電腦沒反應 | 只能充電的線（有電、沒有資料線）、插座的資料接腳接觸不良、經過集線器或延長線 | 換確定能傳資料的線、直接插電腦本身的孔 |

1. **確認線與電腦的孔**：同一條線接手機，看手機能不能充電、電腦能不能讀到手機的照片；再換電腦本身另一個 USB 孔。
2. **查這片飛控的燈號說明**：看說明書或原廠頁面，確認只插 USB 時哪一顆燈應該亮。原本就不會亮的話，直接看裝置管理員有沒有變化。
3. **看插座**：插頭插進去會晃、摔機後才出現問題，常見是插座焊點裂開，請看文末「還是不行？」，不要硬撐插座。
4. **線、孔、電腦都換過還是一樣**：才考慮飛控本身的問題（電源短路、保護元件或處理器損壞），請看文末「還是不行？」。

Windows 跳出「USB 裝置電流過載」或類似警告、飛控插上就發燙：立刻拔掉，不要再插，這可能是飛控上有短路。
:::

:::case B 看得到裝置，但 Betaflight 連不上
1. **看裝置在哪一類、叫什麼名稱**：正常會在「連接埠（COM 和 LPT）」看到「STM32 Virtual COM Port（COM3）」這類名稱，有 COM 編號就直接跳到第 5 步。
2. **出現「未知的裝置」或「未知的 USB 裝置」時，先看詳細說明**：在它上面按右鍵 →「內容」，看「裝置狀態」或名稱括號裡的字。不一定是缺驅動，對照下面的表格判斷。
3. **安裝驅動程式**：Windows 10、11 通常已內建 STM32 Virtual COM Port 的驅動。確定是驅動問題時，可以用 ImpulseRC Driver Fixer 自動安裝；使用 CP210x 晶片的舊款飛控，要安裝 Silicon Labs 的 CP210x 驅動。
4. **Driver Fixer 說裝置數量不對**：先拔掉飛控上接的接收機、GPS 等周邊，只留 USB 再試一次。
5. **Betaflight 裡選對連接埠**：在 Betaflight App（或 Configurator）上方選擇剛剛看到的 COM 編號再按連線。

| 看到的說明 | 比較可能的原因 | 下一步 |
| --- | --- | --- |
| 「裝置描述元要求失敗」（Device Descriptor Request Failed）之類 | 電腦和飛控之間的資料傳輸不穩：線、插座接觸不良，或飛控開機異常 | 換線、換孔，拔掉飛控上的周邊再試；仍然一樣請看文末「還是不行？」 |
| 有正確的名稱（例如 STM32 Virtual COM Port、CP210x），但旁邊有黃色驚嘆號 | 驅動沒裝好或裝錯 | 照第 3 步安裝驅動 |
| 每次插拔名稱都不一樣，或一下出現一下消失 | 接觸不良或供電不穩 | 先處理線與插座，不要先裝驅動 |
:::

:::case C 只出現 STM32 BOOTLOADER
這代表飛控正在「刷機模式」（DFU），不一定是韌體不見了。常見的原因有：

| 可能原因 | 怎麼分辨 |
| --- | --- |
| 插 USB 時按到 BOOT 按鍵 | 拔掉重插、手不碰按鍵，就恢復成 B 段的正常裝置 |
| BOOT 按鍵卡住 | 按鍵按下去不會彈回，或外殼、綁帶壓著按鍵 |
| BOOT 焊盤被短路 | 飛控上標示 BOOT（或 BL）的兩個小焊盤之間有錫渣、碎屑、殘留的防水漆或助焊劑 |
| 剛從 Betaflight 執行「進入刷機模式」 | 刷機頁按過重新開機到刷機模式，或命令列輸入過 `dfu`，重新插拔就會離開 |
| 韌體真的不見了（例如刷機中斷） | 排除以上幾項後，每次插上仍然只出現 STM32 BOOTLOADER |

1. **先拔掉重插，手不要碰任何按鍵**：恢復成 B 段的正常裝置，就只是剛好進了刷機模式。
2. **斷電後看 BOOT 按鍵與焊盤**：按鍵能正常彈回，焊盤之間沒有異物。看不清楚或需要清理焊盤時，請看文末「還是不行？」，不要用金屬工具刮。
3. **都排除了才考慮重新刷韌體**：刷機前要知道正確的韌體型號（Target），選錯可能讓飛控無法使用。不確定型號時不要自己刷，作法見 [[firmware-update]]。
:::

:::advanced 進階：刷機模式的驅動與注意事項
刷機模式的裝置需要 WinUSB 驅動，可以用 ImpulseRC Driver Fixer 或 Zadig 安裝（在 Zadig 選擇 STM32 BOOTLOADER，安裝 WinUSB）。如果它出現在「音效、視訊及遊戲控制器」底下、名稱是 Guillemot STM DFU Device，代表裝到錯誤的驅動，需要移除後重新安裝。

刷機時建議勾選「Full Chip Erase」（完整清除晶片），原因與注意事項見 [[firmware-update]]。
:::

:::checks 怎樣算修好
- 裝置管理員的「連接埠」出現 STM32 Virtual COM Port 和 COM 編號
- Betaflight 按連線後進入「設定」頁，畫面上的 3D 飛機跟著你手上的飛控轉動
- 拔掉重插也能每次都連上
:::

:::stop 什麼時候停手
飛控插上 USB 就變燙、有燒焦味，或 USB 插座已經鬆脫：立刻拔掉，不要反覆插拔或硬撐插座。
:::
