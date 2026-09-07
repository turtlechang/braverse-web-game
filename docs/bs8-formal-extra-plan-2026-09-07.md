# BS8 正式 EXTRA 開放方案

狀態：使用者已於2026-09-07確認開放；實作與正式入口驗證完成。BS8 156筆非EXTRA已在正式主牌卡池；本方案開放其餘15筆EXTRA（5個基礎卡號），不重新promote資料。

## 相容方案

- `CustomDeck`／匯出JSON新增選填 `extraDeckEntries`，缺省視為空，既有60張主牌JSON保持相容。
- 以正式卡池及獨立EXTRA adapter建構 `PlayerSetup.extraDeck`，共用全牌組validator與setup factory；不使用一般GameCard factory。
- 主牌仍為60張；EXTRA最多6張、同號最多4張，按canonical卡號合併異圖計數。Standard另外沿用現有ASIA禁限表（目前BS8-069限1），Open沿用現有規則。
- 保留候選模式與其房間隔離，拒絕同時指定正式EXTRA及candidate EXTRA，不靜默轉換既有候選牌組。

## 修改範圍

| 責任 | 檔案 |
|---|---|
| 型別、保存、複製、JSON、全牌組驗證及建構 | `src/game/custom-deck.ts`、新增 `src/game/custom-extra-deck.ts`、`src/game/index.ts` |
| candidate相容與雙欄位拒絕 | `src/game/bs8-candidate-staging.ts` |
| 正式編輯器EXTRA卡池、六槽與未儲存狀態 | `src/components/DeckEditorPage.tsx` |
| 入口合法性與本機開局 | `MainMenu.tsx`、`battle/MenuScreen.tsx`、`OnlineMatchPanel.tsx`、`src/game/demo.ts` |
| 網路輸入shape guard與伺服器建構 | `src/net/onlineProtocol.ts`、`server/src/rooms.ts` |

沿用已接受EXTRA的核心setup，不重設遊戲狀態機。主要風險是入口仍只驗證主牌，造成伺服器拒絕或開局遺失EXTRA；共用驗證／建構可避免多套判定。

## 驗收

1. 舊JSON相容、儲存／複製／匯出匯入往返；非法型別、卡號、張數、同號上限與禁限卡均拒絕。
2. 正式編輯器加入／移除EXTRA、儲存重開與未儲存提示；candidate流程保持隔離。
3. 本機正常60張開局含EXTRA、instanceId唯一，合法／不合法登場及後續效果可操作。
4. 桌機／平板standard雙瀏覽器建房加入、EXTRA同步及私密遮罩；非法payload被伺服器拒絕。
5. 全套單元測試、lint、build與最終diff，更新README與稽查文件；不commit或push。

## 最終驗證

- 全套 Vitest：292檔、4498項通過；build、修改範圍ESLint及diff檢查通過。全域lint仍有既有兩個未追蹤診斷檔3項unused錯誤，未修改。
- 正式本機Browser：1907×863／1164×777各通過首頁JSON匯入、6槽、同號／069禁限、保存重開匯出、正常隨機開局、真圖與069實際登場正負向。
- 正式好友房Browser：兩尺寸雙方各6張，完整開局、unique instanceId、自己6張真圖及對手6張伺服器／UI遮罩通過。
- 原有牌組編輯器Browser：1366×768／1164×777正式EXTRA與候選隔離通過；AI固定種子1–20均正常結束、0卡死。
- 證據：[本機](../test-results/bs8-formal-extra/report.json)、[好友房](../test-results/bs8-formal-extra-online/report.json)、[全套測試](../test-results/bs8-formal-extra-2026-09-07/full-suite.log)。
- 重現：建置後執行 `node scripts/bs8-formal-extra-browser.mjs` 及 `node scripts/bs8-formal-extra-online-browser.mjs`。官方圖片需可連線的執行環境；不能把fallback當真圖通過。

手機本輪未測；本輪證明正式入口與共用流程，未擴張為125張全效果逐張完整線上對局。未commit或push。
