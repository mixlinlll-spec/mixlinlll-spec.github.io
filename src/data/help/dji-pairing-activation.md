---
title: DJI 天空端和眼鏡配對不上，或 DJI Assistant 2 找不到裝置
slug: dji-pairing-activation
published: true
order: 2
category: 數位圖傳
level: beginner
applies: DJI O4 Air Unit／O4 Air Unit Pro＋DJI Goggles 3、Goggles 2、Integra（N3 與其他型號的配對步驟依原廠說明）
needs: 眼鏡、飛機電池；更新或啟用需要電腦與可傳資料的 USB 線
verified: 2026-10-28
summary: 天空端紅燈、眼鏡沒畫面，代表兩邊還沒連上。先把兩邊更新到相容版本、在眼鏡選對裝置，再進入配對；電腦找不到裝置，多半是線材、插孔或軟體版本；能連上卻無法啟用，最常見是啟用時沒有接電池。
keywords:
  - 配對
  - 對頻
  - bind
  - pairing
  - 紅燈
  - 啟用
  - activation
  - DJI Assistant 2
  - 韌體更新
legacy_items:
  - 6
  - 32
prepare:
  - 天空端與眼鏡的正式型號、韌體版本
  - 配對時天空端指示燈的短影片
  - DJI Assistant 2 畫面截圖（如果有錯誤訊息）
sources:
  - Oscar Liang：DJI O4 Pro 設定（啟用、配對、接線） | https://oscarliang.com/how-to-setup-dji-o4-pro/
  - Oscar Liang：DJI O4 Lite 設定（供電、啟用、配對） | https://oscarliang.com/how-to-setup-dji-o4-lite/
  - DJI 官方：O4 Air Unit 系列規格 | https://dji.com/o4-air-unit/specs
---
:::safety 開始前
拆下螺旋槳。天空端通電就會發熱，配對與更新時旁邊放一台風扇吹，不要讓它長時間在無風狀態下待機。
:::

{{tool:case-picker}}

## 看結果判斷

| 看到的情況 | 代表什麼 | 下一步 |
| --- | --- | --- |
| 天空端紅燈，眼鏡沒畫面 | 天空端有電，但還沒和眼鏡連上 | A |
| 按了配對鍵，燈號沒有變化 | 沒有進入配對，或天空端沒供電 | A 第 3 步；燈不亮看 [[dji-no-video]] |
| 電腦接上後 DJI Assistant 2 沒有出現裝置 | 線材、插孔或軟體版本問題 | B |
| 可以連電腦，但無法啟用 | 最常見是啟用時沒有接電池供電；也可能是沒登入 DJI 帳號、網路或軟體版本 | B 第 2、3 步 |

## 依狀況處理

:::case A 紅燈，和眼鏡連不上
1. **兩邊都更新到相容版本**：版本差太多時會配不上，用 DJI Assistant 2 把眼鏡和天空端都更新。新的天空端第一次接 DJI Assistant 2 要先完成啟用（看 B 段第 2、3 步），啟用後再更新。
2. **眼鏡選對裝置**：Goggles 3 要在眼鏡選單裡切換到你用的天空端型號（例如 O4 Air Unit 或 O4 Air Unit Pro），選單位置依眼鏡韌體版本而異。
3. **進入配對**：Goggles 3 按住電源鍵到發出嗶聲；Goggles 2／Integra 按鏡片中間的配對鍵。接著用塑膠牙籤或其他不導電的細工具按一下天空端的配對鍵（不要用金屬鑷子，避免碰到通電中的電路），紅燈會變成慢閃。
4. **正常結果**：天空端變成綠燈恆亮，眼鏡出現畫面。配對時兩邊放近一點，附近不要有其他人同時在配對。
:::

:::case B DJI Assistant 2 找不到裝置或無法啟用
1. **換一條能傳資料的 USB 線**，直接插電腦本身的 USB 孔，不要經過集線器。
2. **用支援 O4 的版本**：使用 DJI Assistant 2（Consumer Drones Series）並登入 DJI 帳號。
3. **啟用要接電池**：O4 系列啟用時要用電池或規格內的電源供電，只插 USB-C 線無法啟用；啟用也不能在 DJI Fly App 完成。
4. **更新過程不要拔線**，並保持散熱。
:::

:::checks 怎樣算修好
- 天空端綠燈恆亮，眼鏡出現畫面
- 眼鏡和天空端都關機再開機，不用重新配對就能自動連上
- DJI Assistant 2 能看到裝置並顯示韌體版本
:::

:::stop 什麼時候停手
更新中斷後天空端燈完全不亮，或天空端冒煙、有焦味：不要反覆重刷或通電；冒煙時不要用手碰，能安全拔掉電池就拔掉並遠離，有起火就離開現場並打 119。
:::
