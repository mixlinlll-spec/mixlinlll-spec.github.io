---
title: 電腦連不上 Betaflight
slug: fc-usb-connect
published: true
order: 1
category: 電腦連線
level: beginner
applies: Windows 電腦＋Betaflight 飛控（STM32 晶片）
needs: 電腦、可傳資料的 USB 線
verified: 2026-10-27
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
插上飛控後，裝置管理員沒有任何變化。

1. **看飛控燈**：飛控上的燈不亮，代表 USB 沒有供電到飛控，問題在線或 USB 插座。
2. **換線、換孔、換電腦**：三樣都換過還是沒反應，才考慮是飛控本身。
3. **看 USB 插座**：摔機後插座鬆動、焊點裂開很常見，插頭插進去會晃就是這個原因，請看文末「還是不行？」。
:::

:::case B 看得到裝置，但 Betaflight 連不上
1. **看裝置名稱**：正常會在「連接埠（COM 和 LPT）」看到「STM32 Virtual COM Port（COM3）」這類名稱。顯示「未知的裝置」，代表缺少驅動程式。
2. **安裝驅動程式**：最簡單的方法是使用 ImpulseRC Driver Fixer，它會自動安裝需要的驅動。
3. **Driver Fixer 說裝置數量不對**：先拔掉飛控上接的接收機、GPS 等周邊，只留 USB 再試一次。
4. **Betaflight 裡選對連接埠**：在 Betaflight App（或 Configurator）上方選擇剛剛看到的 COM 編號再按連線。
:::

:::case C 只出現 STM32 BOOTLOADER
這代表飛控在「刷機模式」（DFU）。有兩種可能：插 USB 時剛好按到 BOOT 按鍵，或是韌體不見了（例如刷機中斷）。

1. **先拔掉重插，不要按任何按鍵**：恢復成 B 段的正常裝置，代表剛剛只是誤入刷機模式。
2. **重插後還是 STM32 BOOTLOADER**：代表飛控目前沒有可用的韌體，需要重新刷入。
3. **刷機前要知道正確的韌體型號（Target）**：選錯型號可能讓飛控無法使用。不確定型號時不要自己刷，請看文末「還是不行？」。
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
