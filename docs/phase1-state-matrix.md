# Phase 1 — 核心互動狀態矩陣

最後更新：2026-07-12

本文件盤點 5 個主要畫面的所有狀態路徑，給 UI 設計與測試案例使用。戰鬥區畫面因為規則持續演進，先不標成最終定案。

## 1. 主選單（`MainMenu`）

| 狀態 | 觸發條件 | 視覺/行為 | 進入下個狀態的觸發 |
|---|---|---|---|
| 空牌組（`empty`） | 首次進入、無自訂牌組 | 顯示「建立第一副牌組」CTA、停用「對戰入口」並顯示原因 | 點 CTA → 牌組編輯器空狀態 |
| 已選牌組（`ready`） | 有合法牌組且已選 | 顯示「對戰入口」主要 CTA、AI 對手選項啟用 | 點對戰入口 → AI 對局 |
| 牌組不合法（`invalid`） | 已選牌組但 `validateCustomDeck` 失敗 | 顯示錯誤清單、停用「對戰入口」並標示原因 | 編輯牌組 → 牌組編輯器已載入 |
| 載入中（`loading`） | `useDeckStorage` 讀取中 | 顯示 skeleton 或 spinner、停用所有動作 | 讀取完成 → `ready` 或 `empty` |
| 離線（`offline`） | localStorage 不可用 | 顯示警告橫幅、停用「建立牌組」以外的寫入 | 重新整理或用匯入建立 |
| 對戰入口錯誤（`battle-error`） | `battleError` 有值 | 顯示錯誤橫幅附原因、可重試 | 修正牌組或重試 |

## 2. 牌組編輯器（`DeckEditorModal`）

| 狀態 | 觸發條件 | 視覺/行為 | 進入下個狀態的觸發 |
|---|---|---|---|
| 開啟空（`empty`） | 新建牌組 | 卡池為主、牌組側顯示「尚未加入任何卡牌」 | 加入第一張卡 → 編輯中 |
| 編輯中（`editing`） | 已載入或加入卡 | 顯示統計、卡池可篩選、牌組側可調整 | 任一卡數改變 |
| 達上限（`at-max`） | 任一卡牌達 4 張限制 | 該卡加入按鈕停用、Tooltip 顯示「已達上限」 | 移除一張 → 編輯中 |
| 載入已儲存（`loaded`） | 從主選單帶入既有牌組 | 名稱與卡組載入、卡池標記已選 | 任何編輯動作 |
| 匯出成功（`exported`） | 點匯出且剪貼簿成功 | 顯示 status message「已複製到剪貼簿」2.5 秒 | 自動隱藏 |
| 匯入錯誤（`import-error`） | 貼上無效 JSON 或卡池無此卡 | 顯示 status message 紅字 | 修改文字再試或取消 |
| 匯入成功（`imported`） | 解析通過 | 載入牌組、顯示「已匯入牌組 XXX」 | 編輯或儲存 |
| 儲存中（`saving`） | 點儲存按鈕 | 按鈕顯示 spinner、停用其他寫入 | 寫入完成 → 關閉 |
| 儲存錯誤（`save-error`） | localStorage 寫入失敗 | 顯示錯誤橫幅 | 重試或取消 |
| 不合法（`invalid`） | 牌組未達 60 張或超 FLIP 上限 | 「儲存」按鈕停用、錯誤清單顯示 | 補完或修正 |
| 關閉中（`closing`） | 點關閉或 Escape | 顯示確認對話框（若有未儲存變更） | 確認放棄或取消 |

## 3. 測試設定（`TestScenarioModal`）

| 狀態 | 觸發條件 | 視覺/行為 | 進入下個狀態的觸發 |
|---|---|---|---|
| 開啟（`empty`） | 從主選單進入 | 雙方欄位為空、預設支援 4 張 | 開始輸入 |
| 輸入中（`inputting`） | 任一欄位有值 | 即時預覽破損等級、未知卡號提示 | 完成輸入 |
| 驗證錯誤（`invalid`） | `buildScenarioState` 回傳 errors | 顯示錯誤清單、「開始」按鈕停用 | 修正輸入 |
| 有效（`valid`） | 驗證通過 | 「開始」按鈕啟用 | 點開始 → AI 對局（用 scenario 起始狀態） |
| 取消（`cancelled`） | 點取消或關閉 | 關閉 modal | — |

## 4. AI 對局（`MenuScreen` / `OnlineBattleView`）

| 階段 / 狀態 | 觸發條件 | 視覺/行為 |
|---|---|---|
| 起始（Mulligan） | 對局建立後 | 顯示兩方起始手牌、選 keep / mulligan |
| 起始餅乾選擇 | 兩方都完成 mulligan | 從手牌選 1 張當起始餅乾 |
| 抽牌階段 | 自動 | 顯示「等待抽牌」淡入動畫 |
| 支援階段 | 玩家回合 | 可從手牌放支援到支援區；PhaseRail 高亮支援段 |
| 主要階段 | 玩家回合 | 戰鬥區可攻擊、出餅乾、放物品 / 場景；可啟動技能 |
| 結束階段 | 玩家主動結束或自動 | 切換控制權給對手 |
| AI 思考中 | 對手回合 | 顯示 AI 提示與等級、停用所有玩家動作 |
| 等回應窗 | 玩家需要回應（陷阱、阻擋、補位、昏厥、技能） | 顯示對應 modal、可選目標 |
| 結束（Mulligan 之後） | 一方 HP 歸 0 | 顯示勝負畫面、可返回主選單 |
| 錯誤中（`error`） | 規則層拋出未預期例外 | 顯示錯誤橫幅、GameErrorBoundary 啟動 |

> 戰鬥區畫面與回應窗的細節在 Phase 4 完整 UI 定案階段處理。

## 5. 線上房間（`OnlineMatchPanel` + `OnlineBattleView`）

| 狀態 | 觸發條件 | 視覺/行為 |
|---|---|---|
| 閒置（`idle`） | 從主選單進入 | 顯示選擇牌組、建立房間 / 加入房號欄位 |
| 牌組不合法 | 選了不合法牌組 | 顯示「目前牌組不合法」、停用建立 / 加入按鈕 |
| 連線中（`connecting`） | 點建立或加入 | 顯示「正在連線」、停用其他動作 |
| 建立後等待（`waiting-for-opponent`） | server 回 `room-created` | 顯示房號、提示分享給對手 |
| 已加入等待開始（`in-progress` 等待中） | 雙方都已加入、server 還未送 `match-start` | 顯示「準備中」 |
| 對局中（`in-progress`） | 收到 `match-start` 與後續 `state-update` | 切到 `OnlineBattleView` 與戰鬥互動 |
| 對局結束（`ended`） | 收到 `match-ended` | 顯示結束原因與返回按鈕 |
| 連線中斷（`error` / `opponent-disconnected`） | socket close 或 `match-ended` 帶 disconnected | 顯示中斷原因、提供重新進入入口 |
| 伺服器拒絕指令（`command-rejected`） | server 回 `command-rejected` | 顯示錯誤訊息、保持原狀態（R14 後實作） |

## 共通元件狀態（按鈕 / 輸入 / 卡牌 / 徽章 / 提示框 / 錯誤 / loading）

| 元件 | 狀態 | 視覺規範 |
|---|---|---|
| 按鈕 | `default` / `hover` / `active` / `focus-visible` / `disabled` / `loading` | 主要、次要、危險三色；focus-visible 顯示青色高亮環 |
| 輸入 | `default` / `focus` / `error` / `disabled` | 邊框 1px、focus 加 1px 全息高亮、error 加琥珀色 |
| 卡牌 | `default` / `hover` / `selected` / `disabled` / `face-down` | hover 抬升 4px + 青色陰影、selected 加外環 |
| 徽章 | `default` / `success` / `warning` / `danger` / `info` | 4 色 token + 對比文字 |
| PhaseRail 階段 | `past` / `current` / `upcoming` | past 灰、current 青色高亮 + 微動畫、upcoming 半透明 |
| 提示框 | `info` / `success` / `warning` / `error` | 對應徽章色，左側 4px 強調條 |
| Dock | `collapsed` / `expanded` | 桌機橫向、平板可切換 |
| 錯誤橫幅 | `warning` / `error` | 琥珀 / 紅色，可關閉 |
| Loading | `skeleton` / `spinner` / `progress` | 縮短 1.5s 以上才顯示；尊重 `prefers-reduced-motion` |

## 退出條件檢查

- [x] 5 個畫面都有狀態矩陣
- [x] 9 類核心元件狀態已定義
- [ ] tokens 與視覺方向需由使用者確認
- [ ] 戰鬥區畫面尚未標成最終定案（符合 Phase 1 退出條件）
