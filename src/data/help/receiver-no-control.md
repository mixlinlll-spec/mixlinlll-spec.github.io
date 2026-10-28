---
title: 遙控器開了，飛機卻沒反應（ELRS 接收機）
slug: receiver-no-control
published: true
order: 1
category: 接收機／對頻
level: beginner
applies: ExpressLRS 3.x 接收機＋Betaflight（4.4 以後各版本）
needs: 電腦、可傳資料的 USB 線、遙控器
verified: 2026-10-28
summary: 先看接收機的燈怎麼閃。燈號會直接告訴你卡在哪一關：沒供電、還沒連上、在 Wi-Fi 模式、模型不符，還是已經連上但飛控沒收到。
keywords:
  - 對頻
  - 對不到頻
  - bind
  - 綁定
  - ELRS
  - CRSF
  - Serial RX
  - UART
  - 搖桿沒反應
  - 接收機燈
  - model match
  - Wi-Fi
legacy_items:
  - 0
  - 1
  - 2
  - 20
  - 21
  - 22
  - 49
  - 51
prepare:
  - 接收機燈號的短影片（10 秒內即可）
  - 遙控器與接收機的 ELRS 版本、頻段（2.4G 或 900M）
  - Betaflight「連接埠」「接收機」兩頁的截圖，以及接收機接線處照片
sources:
  - ExpressLRS 官方：燈號說明 | https://expresslrs.org/quick-start/led-status
  - ExpressLRS 官方：對頻方式與版本相容 | https://expresslrs.org/quick-start/binding
  - ExpressLRS 官方：Betaflight 接收機設定 | https://www.expresslrs.org/quick-start/receivers/configuring-fc/
  - ExpressLRS 官方：模型配對（Model Match） | https://www.expresslrs.org/software/model-config-match/
  - ExpressLRS 官方：接收機接線（避開 SBUS 用 UART 的原因） | https://www.expresslrs.org/quick-start/receivers/wiring-up/
---
:::safety 開始前
拆下全部螺旋槳。打開遙控器，選好這台飛機的模型，再接上飛機電池。
:::

{{tool:case-picker}}

## 先看接收機的燈

用 DJI 遙控器 3 控制（沒有獨立的接收機）的話，這篇的燈號不適用，直接看 [[dji-o4-power-wiring]] 的「遙控器 3 不能控制飛機」。

以下是 ExpressLRS 單色燈接收機的燈號。彩色燈（RGB）接收機有兩個狀態完全不同：綠色像心跳一樣慢慢閃是 Wi-Fi 模式（看 C 段）；完全不亮也可能是 Bootloader（刷機）模式（看 E 段第 1 步）。其他狀態以官方燈號表為準。

| 接收機的燈 | 代表什麼 | 看哪一段 |
| --- | --- | --- |
| 不亮或很暗 | 接收機沒有正常供電（RGB 接收機不亮也可能是 Bootloader 模式） | A |
| 慢閃（約半秒亮、半秒暗） | 開好了，正在等遙控器 | B |
| 連閃兩下、停一下 | 正在對頻模式 | B |
| 很快地閃（像在抖）；RGB 接收機是綠色心跳閃 | 進入 Wi-Fi 更新模式，不會跟遙控器連線 | C |
| 連閃三下、停一下 | 已經跟遙控器連上，但「模型配對」不符，所以不送搖桿 | D |
| 恆亮 | 通常是已經連上遙控器；但單色燈接收機在 Bootloader（刷機）模式時也會恆亮 | E（先照 E 段第 1 步分辨） |
| 中等速度一直閃（約 0.1 秒） | 接收機偵測不到無線晶片，屬於硬體問題 | 看文末「還是不行？」 |

## 依燈號處理

:::case A 燈不亮或很暗
1. **拔電後看接線**：接收機的正負極有沒有接反、焊點有沒有鬆脫或碰在一起。
2. **看供電電壓**：對照接收機標示的輸入電壓，和飛控供電焊點是不是同一個電壓（多數接收機用 5V）。
3. **注意異常**：不要用手去摸接收機或飛控判斷溫度。聞到燒焦味、看到冒煙，或接收機上的元件變色，能安全拔掉電池就拔掉，然後遠離觀察，看文末「還是不行？」。
:::

:::case B 慢閃或連閃兩下（還沒連上）
1. **頻段要一樣**：2.4G 的遙控器只能連 2.4G 的接收機，900M 只能連 900M。
2. **大版本要一樣**：遙控器發射端與接收機的版本，第一個數字要相同，例如 3.x 配 3.x、4.x 配 4.x；2.x 配 3.x 無法連線。飛控內建的接收機，要看那一版 Betaflight 支援哪一版 ELRS（例如 2026.6 內建接收機用 ELRS 3.x，不能配 4.x 的發射端）。
3. **綁定密語要一樣**：兩邊設定的綁定密語（Binding Phrase）要是同一串文字。
4. **沒設密語就手動對頻**：遙控器先關機，接收機在約 2 秒內「插電、拔電」連續三次，燈變成連閃兩下後，在遙控器的 ExpressLRS 腳本按 [BIND]。飛控內建的接收機，可以在 Betaflight「接收機」頁按 Bind Receiver（對頻）。
:::

:::case C 很快地閃（Wi-Fi 模式）
1. **先開遙控器再接電池**：接收機開機後一段時間收不到遙控器，會自動切到 Wi-Fi 更新模式。先確認遙控器已開機、選對模型，再重新插拔飛機電池。
2. **還是進 Wi-Fi**：回到 B 段，檢查頻段、版本、綁定密語。
3. **要用 Wi-Fi 更新韌體時**：只用該接收機型號對應的韌體，不要從 Wi-Fi 名稱猜型號。
:::

:::case D 連閃三下（模型配對不符）
1. **切回原本能用的模型**：模型配對（Model Match）不是在對頻時記住的，而是在連線狀態下打開 Model Match 時，接收機記住當時那個模型的 Receiver 編號。換回那個模型（EdgeTX「模型設定 → 內建／外接 RF」的 Receiver 編號相同的那個），燈變恆亮、搖桿恢復控制，就是這個原因。
2. **多台飛機各用一個模型**：每台飛機在遙控器各建一個模型，每個模型設不同的 Receiver 編號；複製模型時編號會一起被複製，記得改掉。
3. **建議打開模型配對**：模型配對預設是關的，打開後可以避免選錯模型時控制到另一台飛機。
:::

:::case E 燈恆亮，但 Betaflight 搖桿不動
1. **先分辨是真的連上，還是在 Bootloader 模式**：看遙控器有沒有收到接收機的遙測資料（例如遙控器的遙測畫面出現 RSSI、LQ 等數值）。有，代表真的連上，繼續第 2 步。沒有，接收機可能停在 Bootloader（刷機）模式：拔掉電池重新插電，插電時不要按接收機上的按鍵；剛透過飛控刷過接收機的話，重新上電一次。重新插電仍然恆亮、遙控器也收不到遙測：接收機可能接在飛控標示 SBUS 的那組 UART 上（那組的 RX 常有下拉電阻，會讓接收機卡在 Bootloader），改接到另一組 UART；不確定就看文末「還是不行？」。
2. **看「接收機」頁的通道條（下圖 ①）**：USB 接上電腦、接上電池，到 Betaflight「接收機」頁撥搖桿。通道條會跟著動，代表一切正常；完全不動，繼續下一步。
3. **看「接收機」頁的協定（下圖 ②）**：協定是看飛機上的接收方式，不是看遙控器品牌：
   - 外接的 ExpressLRS（ELRS）接收機：Receiver Mode 選 Serial (via UART)，Serial Receiver Provider 選 CRSF。
   - 飛控內建的 ELRS 接收機：Receiver Mode 選 SPI Rx (e.g. built-in Rx)，Provider 選 ExpressLRS；不用做第 4、5 步。
   - DJI 遙控器 3（透過 O4 天空端的 SBUS 線）：Receiver Mode 選 Serial (via UART)，Provider 選 SBUS，接線看 [[dji-o4-power-wiring]]。
   - 下拉選單裡沒有你要的協定（畫面會出現 Some Receiver Providers are not supported by current Build Configuration）：代表刷韌體時 Radio Protocol 沒選它，要重新刷韌體並在 Build Configuration 選對協定，看 [[firmware-update]]。
   - 改完按右下角 Save。

![Betaflight App 2026.6.2「接收機」頁（左側選單 Receiver）：① 通道條，撥搖桿時要跟著動；② Receiver Mode 選 Serial (via UART)；Serial Receiver Provider：ELRS 選 CRSF，DJI 遙控器 3（經 O4 天空端 SBUS 線）選 SBUS。此圖是沒接飛控的虛擬模式，通道固定停在 1500，不是實機數值。](/assets/img/help/receiver-no-control/bf-receiver.webp)

4. **看「連接埠」頁（下圖 ②）**：接收機接在哪一組 UART（下圖 ①），就在那一組打開 Serial Rx，其他組不要開。改完按右下角 Save and Reboot。

![Betaflight App 2026.6.2「連接埠」頁（左側選單 Ports）：① 每一組 UART 一列；② Serial Rx 欄，只在接收機實際接的那一組打開。此圖是虛擬模式，全部都還沒打開。](/assets/img/help/receiver-no-control/bf-ports.webp)

5. **看接線方向**（外接 ELRS）：接收機的 TX 要接飛控的 RX，接收機的 RX 接飛控的 TX（交叉接）。DJI 的 SBUS 只有一條線，接飛控的 RX。
6. **通道會動但順序不對**：例如推油門卻動到別的通道，調整「接收機」頁的通道順序（Channel Map），讓每支搖桿動到對應的通道。
:::

:::advanced 進階：命令列檢查
在命令列輸入 `get serialrx`，ExpressLRS 建議 `serialrx_inverted` 與 `serialrx_halfduplex` 都是 `off`。需要修改時輸入 `set serialrx_inverted = off`、`set serialrx_halfduplex = off`，最後輸入 `save`。
:::

:::checks 怎樣算修好
- ELRS：接收機燈恆亮，遙控器收得到遙測
- Betaflight「接收機」頁：每支搖桿都動到對應的通道，油門拉到底與推到頂時數值跟著從最低變到最高
- 拆槳狀態下關掉遙控器，飛控有進入失聯保護（「接收機」頁或 OSD 顯示失聯）
:::

:::stop 什麼時候停手
接收機或飛控插電後變燙、冒煙，或燈號是「中等速度一直閃」：立刻拔掉電池，不要反覆重刷韌體。
:::
