---
title: 插上電池後，飛機怎麼撥都解鎖不了
slug: betaflight-arming
published: true
order: 1
category: 飛控設定
level: beginner
applies: Betaflight 4.4、4.5、2025.12、2026.6
needs: 電腦、可傳資料的 USB 線
verified: 2026-10-27
summary: 飛控覺得「現在起飛不安全」時會拒絕解鎖，而且會告訴你原因。照著原因代碼逐一處理，大多數情況不用拆機。
keywords:
  - 解不了鎖
  - 無法解鎖
  - arm
  - arming disabled
  - 不能起飛
  - RXLOSS
  - THROTTLE
  - ANGLE
  - MSP
  - status
  - CLI
  - BAD_RX_RECOVERY
legacy_items:
  - 10
prepare:
  - 「設定」頁 Arming Disable Flags 欄位的截圖
  - 命令列 `status` 與 `diff all` 的完整文字
  - 飛控型號與 Betaflight 版本
sources:
  - Betaflight 官方原始碼（4.5 解鎖禁用原因名稱） | https://github.com/betaflight/betaflight/blob/4.5-maintenance/src/main/fc/runtime_config.c
  - Betaflight 官方原始碼（2026.6 解鎖禁用原因名稱） | https://github.com/betaflight/betaflight/blob/2026.6.2/src/main/fc/runtime_config.c
  - Betaflight 官方原始碼（各原因的觸發條件） | https://github.com/betaflight/betaflight/blob/4.5-maintenance/src/main/fc/core.c
  - Betaflight 官方原始碼（MSP 禁止解鎖的設定與清除） | https://github.com/betaflight/betaflight/blob/4.5-maintenance/src/main/msp/msp.c
  - Betaflight 官方原始碼（命令列 exit、status 與 CLI 原因） | https://github.com/betaflight/betaflight/blob/4.5-maintenance/src/main/cli/cli.c
  - Betaflight App 2026.6.2 原始碼（中斷連線時解除 MSP 禁止） | https://github.com/betaflight/betaflight-configurator/blob/2026.6.2/src/js/serial_backend.js
  - Oscar Liang：Quad Arming Issue Fix | https://oscarliang.com/quad-arming-issue-fix
---
:::safety 開始前
拆下全部螺旋槳。準備一台電腦，用 Chrome 或 Edge 打開 Betaflight App（app.betaflight.com；舊版軟體叫 Betaflight Configurator），以及可以傳資料的 USB 線（有些線只能充電，接上後電腦不會有反應）。
:::

## 建議檢查順序

1. **先看飛控在說什麼**：USB 連上電腦，打開 Betaflight App 的「設定」頁，找到 Arming Disable Flags 欄位，飛控會在這裡列出目前不能解鎖的原因。在戶外沒有電腦時，可以在 OSD 開啟「警告」項目，眼鏡畫面會直接顯示原因。
2. **記下列出來的字**：一次可能出現好幾個，從第一個開始處理。
3. **用下面的查詢工具一個一個處理**：處理完一個，就回到「設定」頁重看一次清單。
4. **MSP、CLI 是電腦連線造成的，最後再清除**：只要 Betaflight App 連著飛控，清單裡就一定有 MSP；進過命令列還會多一個 CLI。先把其他原因處理到消失，再照下表清除這兩個，然後試解鎖。

![Betaflight App 2026.6.2「設定」頁（左側選單 Setup）：① Arming Disable Flags 欄位，不能解鎖的原因會列在這裡。此圖是沒接飛控的虛擬模式，所以顯示 Arming Allowed（允許解鎖）；接上實機時這裡會列出實際原因，而且只要 App 連著，至少會有 MSP。](/assets/img/help/betaflight-arming/bf-setup-arming-flags.webp)

{{tool:arming-flags}}

## 看結果判斷：新手最常遇到的原因

| 看到的字 | 代表什麼 | 下一步 |
| --- | --- | --- |
| MSP | Betaflight App（或舊版 Configurator）正連著飛控，連線時會主動禁止解鎖 | 在 App 按 Disconnect（中斷連線）就會清除。沒按就直接拔 USB、飛控又同時接著電池時，這個原因會留著：拔掉電池重新上電 |
| CLI | 飛控進過命令列（CLI），離開前都不讓解鎖 | 在命令列輸入 `exit`，飛控會重新開機並清除這個原因；沒有 `save` 的修改會丟掉，要保留就改輸入 `save`（同樣會重新開機）。`exit noreboot` 不會清除；直接拔 USB 而電池還接著，也要拔掉電池重新上電 |
| RXLOSS | 飛控沒有收到有效的遙控訊號 | 先看接收機的燈：還沒連上遙控器，或燈恆亮但飛控的連接埠、接收機協定、接線沒設好，都會出現這個字。照 [[receiver-no-control]] 依燈號處理 |
| THROTTLE | 油門沒有在最低 | 油門拉到底。拉到底仍出現：「接收機」頁的油門數值應低於 1050（預設門檻），不是的話要調整遙控器的油門行程 |
| ANGLE | 機身太斜 | 放平再試（預設傾斜超過 25° 就不讓解鎖）。放平了還是出現：飛機放在平面上做加速度計校正（Betaflight App 2026.6 在「感測器」頁按 Calibrate，舊版 Configurator 在「設定」頁） |
| ARM_SWITCH（4.4、4.5 的韌體叫 ARMSWITCH，但 Betaflight App 2026.6 畫面一律顯示 ARM_SWITCH） | 不能解鎖的時候，解鎖開關已經在「開」 | 先處理其他原因，再把開關撥回「關」、再撥「開」 |
| NOT_DISARMED（4.4 叫 BADRX；Betaflight App 2026.6 的「設定」頁顯示為 BAD_RX_RECOVERY） | 遙控訊號斷掉又恢復時，解鎖開關是開著的 | 把解鎖開關撥回「關」 |
| NOPREARM | 有設定「預解鎖」開關，但沒有先打開 | 先打開預解鎖、再解鎖。這是保護功能，不要為了省事取消 |
| CALIB | 感測器正在校正 | 插上電池後不要動飛機，等幾秒 |
| NO_ACC_CAL | 加速度計需要校正 | 飛機放在平面上做加速度計校正（Betaflight App 2026.6 在「感測器」頁按 Calibrate，舊版 Configurator 在「設定」頁） |
| BOXFAILSAFE | 「失聯保護」開關是開著的 | 把失聯保護開關撥回「關」 |
| ALT_HOLD_SW、POS_HOLD_SW（2025.12 起）；AUTOPILOT_SW（2026.6 起） | 定高、定點或自動駕駛模式的開關是開著的 | 把那個模式的開關撥回「關」再解鎖 |
| FLIP_SWITCH（2025.12 起） | 用過翻正（Turtle）功能後，需要先手動上鎖一次 | 把解鎖開關撥回「關」，再重新解鎖 |

清單裡出現 RUNAWAY、CRASH、DSHOT_TELEM（4.4 叫 RPMFILTER）、MOTOR_PROTO、LOAD、NOGYRO、GPS 或 RESCUE_SW，就不屬於新手自行處理的範圍。其中 RUNAWAY 代表上次解鎖時飛控偵測到「失控衝飛」，常見原因是馬達順序、旋轉方向或槳裝錯，很危險，先不要再試。

:::advanced 進階：命令列與版本差異
在命令列輸入 `status`，最後一行 `Arming disable flags:` 會列出目前所有禁止解鎖的原因。這時一定會看到 MSP 和 CLI（你正連著電腦、在命令列裡），判斷時看其餘的原因。

版本之間的名稱變化：4.5 起 `BADRX` 改為 `NOT_DISARMED`、`RPMFILTER` 改為 `DSHOT_TELEM`；2025.12 起 `ARMSWITCH` 改為 `ARM_SWITCH`，並新增 `FLIP_SWITCH`、`ALT_HOLD_SW`、`POS_HOLD_SW`；2026.6 再新增 `AUTOPILOT_SW`。上面的查詢工具可以切換版本對照。

傾斜角度上限是 `small_angle`（預設 25），油門門檻是 `min_check`（預設 1050）。不建議為了能解鎖而修改這兩個值，尤其不要把 `small_angle` 設成 180：那等於關掉傾斜保護。
:::

:::checks 怎樣算修好
- 連著 App 時，「設定」頁的 Arming Disable Flags 只剩 MSP（進過命令列的話再加 CLI），其他原因都消失
- 在 App 按 Disconnect 再拔 USB；剛進過命令列、或沒按 Disconnect 就拔線的話，先拔掉電池重新上電
- 拆槳狀態下撥解鎖開關：眼鏡畫面的計時開始跳，或馬達開始怠速轉動
- 撥回「關」時，馬達立刻停止
:::

:::stop 什麼時候停手
解鎖瞬間馬達狂轉、飛機翻滾，或清單出現 RUNAWAY：立刻撥回「關」並拔掉電池，不要再試。
:::
