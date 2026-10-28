---
title: 更新飛控韌體：更新前準備、設定不見、刷完無法開機
slug: firmware-update
published: true
order: 1
category: 韌體更新
level: intermediate
applies: Betaflight 4.4、4.5、2025.12、2026.6；接收機與 DJI 裝置另見內文
needs: 電腦、可傳資料的 USB 線
verified: 2026-10-28
summary: 建議用 Full chip erase（完整清除晶片）刷韌體，原本的設定會被清掉，所以先備份、確認型號再刷。刷完設定不見是正常的；刷完找不到陀螺儀或無法開機，多半是型號選錯或刷機中斷。
keywords:
  - 刷韌體
  - 刷機
  - flash
  - 更新失敗
  - DFU
  - bootloader
  - 設定不見
  - 找不到陀螺儀
  - gyro
  - 2026.6
legacy_items:
  - 24
  - 47
  - 48
  - 72
prepare:
  - 飛控背面的完整型號照片
  - 更新前與更新後的版本號碼
  - 更新前的備份檔（有的話），以及 Betaflight「設定」頁截圖
sources:
  - Betaflight 官方文件：Firmware Flasher 頁 | https://betaflight.com/docs/wiki/app/firmware-flasher-tab
  - Betaflight 官方文件：2025.12 版本說明 | https://betaflight.com/docs/wiki/release/Betaflight-2025-12-Release-Notes
  - Oscar Liang：How to Backup & Restore Betaflight FC Configuration | https://oscarliang.com/?p=24330
---
:::safety 開始前
只接 USB，不用接電池，拆下螺旋槳。更新過程中不要拔線、不要讓電腦進入睡眠。
:::

## 要不要更新？

飛機現在飛得好好的，沒有一定要更新。需要新功能、修正某個已知問題，或新零件要求新版本時再更新。Betaflight 從 2025.12 起改用「年份.月份」命名（例如 2025.12、2026.6），大約每半年一版，電腦軟體也改成網頁版 Betaflight App。

## 更新前的準備

1. **記下目前版本與飛控型號**：在命令列輸入 `version` 可以看到韌體版本與板子名稱；飛控型號以板子背面的完整名稱為準，不要只看處理器名稱。
2. **備份設定**：在「預設集（Presets）」頁按儲存備份，或在命令列輸入 `diff all` 後存成檔案。另外截圖「連接埠」頁，記住每個 UART 接了什麼。
3. **確認新版支援你的飛控**：在韌體更新頁按自動偵測，畫面上的板子名稱要和你的飛控一樣。
4. **選對編譯選項**：韌體燒寫頁的 Build Configuration 裡，Radio Protocol 只能選一種，要選你用的接收方式（外接 ELRS 接收機選 CRSF、飛控內建 ELRS 選 ExpressLRS 或 SPI 相關選項、DJI 遙控器 3 選 SBUS；選項名稱依 App 版本可能略有不同），用 GPS 的話在 Other Options 勾選 GPS。沒選到的功能，刷完在設定畫面會找不到。
5. **準備好接線**：用一條確定能傳資料的 USB 線，直接插電腦。

{{tool:case-picker}}

## 依狀況處理

:::case A 更新後設定全部不見
這是正常的：打開 Full chip erase（完整清除晶片）刷機時，原本的設定會被清成新版本的預設值。

1. **同一個版本才直接載回備份**：備份檔裡的版本和現在一樣，才用「預設集（Presets）」頁載入備份或在命令列載入。
2. **版本不同就照畫面重新設定**：新版本可能增加、刪除或改了設定名稱，整份貼上舊設定可能出錯。依序重新設定接收機、解鎖開關、馬達、OSD 畫面資訊與電壓。
3. **設定完拆槳做完整地面測試**：接收機通道、解鎖、馬達順序與轉向都正常，「設定」頁的 3D 飛機傾斜方向也要和手上的飛機一致（飛控安裝方向，Betaflight 2025.12 版本說明特別提醒更新後要確認），才裝槳試飛。
:::

:::case B 更新中斷，飛控無法開機
1. **不要反覆插拔或重刷**：先停下來，照下面的方式恢復。
2. **進入刷機模式**：按住飛控上的 BOOT 按鍵再插 USB，電腦出現 STM32 BOOTLOADER 代表還能恢復。電腦完全沒反應時，先看 [[fc-usb-connect]]。
3. **重新刷入原本型號的韌體**：在韌體更新頁選擇和飛控完全相同的型號再刷。不確定型號就停止，請看文末「還是不行？」。
4. **不是飛控的裝置**：ELRS 接收機能進 Wi-Fi 更新頁時，用原本型號的韌體檔恢復；DJI 裝置接回官方 DJI Assistant 2，照畫面重新更新；天空端燈完全不亮時不要反覆重刷，看 [[dji-pairing-activation]] 的「什麼時候停手」。
:::

:::case C 刷完後找不到陀螺儀
1. **核對型號**：對照板子背面的完整型號，和刷入的型號是不是同一個。同一顆處理器可能有好幾種不同的板子。
2. **刷回該型號官方支援的版本**：重新刷入正確型號，再看「設定」頁是否偵測到陀螺儀。
3. **兩個相容版本都找不到陀螺儀**：停止反覆刷機，可能是硬體問題，請看文末「還是不行？」。
:::

:::advanced 進階：Full chip erase 與刷機模式
Full chip erase（完整清除晶片）會把設定區清成新版本的預設值。Betaflight App 2026.6 要先在左下角齒輪「Options」打開 Enable Expert Mode，韌體燒寫頁（Firmware Flasher）才會出現 Advanced 區塊裡的 Full chip erase 開關。App 每次啟動時會自動把它設回開啟，刷機前確認它是開著的即可（以 App 2026.6.2 原始碼為準）。官方文件建議只有在確定設定的資料結構沒有變過時才關閉。

進入刷機模式也可以在「設定」頁按 Activate Boot Loader / DFU，或在命令列輸入 `bl`。接收機、GPS 等周邊有時會干擾進入刷機模式。
:::

:::checks 怎樣算修好
- 「設定」頁顯示的版本是你剛刷入的版本；陀螺儀有偵測到（3D 飛機會跟著手轉）；這片飛控有加速度計的話，也要偵測得到（少數飛控或韌體建置沒有加速度計，以飛控規格為準）
- 刷機前用到的功能（接收機協定、GPS、OSD 等）在設定畫面都找得到；找不到就是 Build Configuration 沒選到
- 「接收機」頁撥搖桿，每支都動到正確的通道
- 拆槳在「馬達」頁測試，順序與轉向都和畫面圖一致
:::

:::stop 什麼時候停手
不確定飛控型號、同一塊板子刷了兩次以上還是異常，或飛控接 USB 就發燙：拔掉 USB、停止操作，不要再試別的型號韌體。
:::
