# 故障排除中心：真實截圖計畫

只用真實軟體畫面或 EWP 實拍。不用論壇、搜尋引擎上他人的圖片，不用 AI 生成的軟體畫面。每張圖標示拍攝時的軟體版本。

| 優先 | 畫面 | 放在哪篇 | 標註重點 | 取得方式 |
| --- | --- | --- | --- | --- |
| 1 | Betaflight App「設定」頁 Arming Disable Flags | betaflight-arming | 紅框標出欄位位置；附一張有原因、一張沒有原因 | 接上飛控（虛擬飛控模式看不到真實原因） |
| 2 | Betaflight App「接收機」頁 | receiver-no-control | 通道條、接收機模式、協定 CRSF | 接上飛控＋ELRS 接收機 |
| 3 | Betaflight App「連接埠」頁 | receiver-no-control、gps-no-fix | Serial RX 開關、GPS 感測器輸入欄 | 可先用虛擬飛控模式截版面，再用實機確認 |
| 4 | Betaflight App「馬達」頁 | motors-after-arming | 拆槳確認勾選、馬達編號圖、單顆滑桿 | 接上飛控與電池（必須拆槳） |
| 5 | Windows 裝置管理員 | fc-usb-connect | 正常的 STM32 Virtual COM Port（COMx）、刷機模式的 STM32 BOOTLOADER、未知的裝置 | EWP 的 Windows 電腦 |
| 6 | DJI 眼鏡 OSD 正常／缺少 | dji-no-osd | Betaflight 電壓等資訊有沒有出現 | 手機對著眼鏡拍 |
| 7 | ELRS 接收機燈號 | receiver-no-control | 慢閃、連閃兩下、連閃三下、恆亮 | 短影片或連拍 |

## 取得方式

- Betaflight App 2026.6 起，「虛擬連線」選項要先在「選項」頁開啟 Expert Mode 才會出現（見 2026.6 Release Notes）。虛擬飛控只能拍版面，Arming Disable Flags、接收機通道條等真實狀態要接上實機。
- 需要 EWP 的電腦連上 Claude（Claude 桌面版或 Claude in Chrome），由 Claude 操作 Betaflight App 截圖；裝置管理員、眼鏡、燈號需要 EWP 協助拍攝。
- 圖片放 `/assets/img/help/<slug>/`，在文章內用 `![說明文字](/assets/img/help/<slug>/xx.webp)` 插入；說明文字要寫出版本，例如「Betaflight App 2026.6，設定頁」。
