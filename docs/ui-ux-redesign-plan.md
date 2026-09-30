# UI / UX 改版計畫（Redesign Plan）

## 2026-09-15 攻擊付款預覽遮擋修復

- 使用者截圖：攻擊付款時，左側手牌快速預覽蓋住我方支援卡，妨礙辨識與選取能量。
- 本機／線上共用 `BattleTable` 在攻擊付款及選目標期間暫時不渲染快速預覽與其 dismiss 遮罩；取消攻擊後恢復正常預覽，不修改支付合法性或遊戲狀態。
- 回歸涵蓋付款不足與付款合法兩種狀態，即使仍有預覽卡與 dismiss callback 也不得遮住支援區。相關 2 檔／15 項測試通過，build 與修改檔 lint 通過；全域 lint 仍有原本 4 個無關錯誤，未重跑完整 Vitest。
- 好友房 Browser 加入付款時 hover 手牌、確認快速預覽與遮罩不存在，再以正常點擊選支援與目標的檢查。正式好友房完整對局 87 次操作／9 次攻擊、雙端 Host Player 勝利；付款不足與合法階段的 hover 檢查、實際點選及賽後結果保留通過，結束碼 0。結果見 `test-results/preview-payment-browser.log`。
## 2026-09-15 正式流程盤點與深藍介面精修

定位：實卡玩家練牌與新手入門；保留深藍桌墊、既有卡圖和正式規則，桌機與平板橫向優先。本批不新增排位、配對、觀戰、好友系統、雲端戰績或商城。

### 盤點結論與本批修改

| 流程 | 盤點分類 | 結論與處理 |
| --- | --- | --- |
| 大廳與第一場 | 需要精修／教學確認缺少 | AI 等級原僅 Lv.1～Lv.5，補上練習難度；無自訂牌組也能直接使用正式紅色起始牌組對 Lv.1 練習，不寫入或覆蓋收藏。非法牌組不再顯示「準備就緒」。 |
| 教學與情境規則 | 本批新增 | 可跳章、略過、重讀的五段操作說明，從大廳或戰場開啟，戰場另提供目前階段說明。採正常對局自由練習，不是固定牌序的闖關；閱讀進度不冒充操作完成，FLIP 不保證每場出現。 |
| 我的牌組與編輯 | 已具備／需要精修 | 保留草稿、匯入確認及禁限卡檢查；五色起始牌組補學習方向。FLIP 張數及合法性問題上移至牌組頂部，可展開閱讀；空結果可一鍵清除搜尋及全部篩選。卡文加大至 14px／1.7 行高，加減控制項加大。 |
| 猜拳、先後攻、調度 | 已具備 | 正式紅色對紅色開局沿用正常流程；實測非餅乾不能當起始餅乾。未重做開局介面。 |
| 支援、付款與目標 | 已具備／需要精修 | 沿用規則層的已選張數、合法性及取消操作；新增明文「你的回合／對手回合」，等待時不再顯示我方結束階段指令。保留工作樹原有 EffectPanel 選牌／代價改善。 |
| 動畫與音效 | 動畫已具備／音效新增 | 保留共用有序演出及標準／快速／減少動畫；新增預設關閉的短提示音，依實際演出批次播放，不發送或延遲命令。重新載入時需使用者手勢啟用，瀏覽器不支援時保留無聲對局。 |
| 日誌與回顧 | 已具備 | 既有可展開命令日誌及賽後回顧已可供玩家閱讀，保留 Replay 匯出，不再新增重複回顧頁。 |
| 對局結果 | 需要精修 | 補結束回合，本機顯示使用牌組；線上原「再來一局」實際離開房間，修為「返回大廳」，保留查看紀錄。 |
| 美術 | 本批精修 | 延續原卡圖、深藍與金色主操作。大廳面板降低光暈、補助文字對比、統一新增控制項與鍵盤焦點；五色卡牌辨識維持。未新增大型背景插畫或重畫卡圖。 |

### 實作契約

- 不更動 `GameState`、付款合法性、遊戲規則公開 API 或線上協定；練習入口沿用 `handleDeckSelection`、正式 RED 牌組與正常洗牌。
- 教學以 portal 開啟，避免回合列 transform 使視窗被裁切；沿用資訊視窗焦點管理、Escape 與還原焦點。收起教學不支付、不推進回合、不取消既有必要決策，也不暫停線上或 AI 對局。
- 音效僅為 Web Audio 合成提示，無第三方素材或依賴；設定鍵 `braverse.sound-enabled`。動畫設定與速度沿用既有儲存方式。
- 結果元件增加選用的 `restartLabel`、`deckSummary`、`turnNumber`；既有呼叫相容。
- 組牌 Browser 舊腳本清空收藏後仍找「編輯牌組」，已改走正式「建立第一副牌組 → 新增牌組」，保留原 assertion；桌機／平板模式加入 1920×1080。
- 平板編輯器的隱含網格欄會被內容撐寬，造成儲存按鈕裁切（P0）；明訂 `minmax(0, 1fr)` 欄寬並整理標頭，Browser 新增整顆儲存按鈕不得越界的檢查。正式 BS5 牌組於 1164px 畫面實測按鈕範圍為 x=1020～1148。

### 驗證與畫面證據

基底 HEAD `6d38bc9` 加未提交工作樹；啟動時即有 BS10、EffectPanel、README、AGENTS 等既有修改，沒有還原、提交或推送。測試屬當前整體工作樹，不把其他工作的變更歸為本批成果。

產物放在 `test-results/ui-ux-2026-09-15/`（不提交）：大廳與編輯器改前截圖、三尺寸大廳與正式戰場、教學、猜拳、調度、付款空選／合法選擇與攻擊日誌；完整命令結果收於同目錄的 `.log`。In-app 的 1164×777 覆寫實際回報 1164×778；精確 1164×777 另由既有 Browser 腳本驗證，不混寫尺寸。

- 已實際讀到正式遠端卡圖載入成功，包含紅色起始牌組及 BS5 卡圖；不沿用昨日網路受限的缺圖結論。完整卡池所有圖片未逐張驗收。
- 手動正式操作：猜拳平手／決勝、保留起手、禁止物品作起始餅乾、餅乾登場、放支援、付款未滿提示、取消攻擊、合法付款與目標、傷害後補位、展開日誌；教學跳章、關閉、Escape 焦點還原及音效開關。
- Build 通過；全域 lint 仍有 `.tmp-bs9-030-ui9.mjs`、`.tmp-probe-deploy.ts`、`scripts/diagnose-lv5-conservatism.ts` 的 4 個既有錯誤，本批檔案 lint 通過。
- 最後受影響回歸 3 檔／33 項通過；先前 6 檔／90 項中發現移動合法性提示後遺失 alert 語意，已恢復並重驗，未放寬測試。
- `test:ai:browser` 通過；`test:deck:browser` 桌機／平板模式 3 案通過（1920×1080、1366×768、1164×777）。
- `test:online:match:browser` 通過核心開局、預覽、支援付款、非法指令拒絕、連線失敗與中途斷線；不以此單獨證明完整對局。
- `test:animations:online` 通過 149 次命令、雙方同一勝方，使用 fast／reduced；此路徑由正常回合抽牌至 Refresh 決勝，攻擊 0 次，僅證明該結束路徑與賽後斷線結果保留。
- 完整 `npm.cmd test -- --maxWorkers=1`：332 檔／4,859 項通過，591.76 秒，結束碼 0；過程中的候選拒絕／rollback 訊息是測試的預期負向案例。執行期間最後的回合所有者標籤與教學按鈕文案微調，另以 3 檔／33 項最終回歸覆蓋；其餘來源未因本批再修改。
- `npm.cmd run test:animations:online -- --animation-battle`：99 次操作、11 次攻擊，雙端同為 Host Player 勝利，fast／reduced 模式與賽後斷線結果保留通過，結束碼 0。這是有支援付款、攻擊、決策與補位的完整對局，不等同全卡池效果矩陣。
- 好友房與有攻擊完整對局均在對應 build 後執行；最後僅補編輯器網格 CSS 與越界 assertion，再 build 並重跑三尺寸組牌 Browser。AI Browser 沿用本批通過結果，其後的回合所有者 HTML 標籤與教學按鈕用詞另由回歸與好友房覆蓋，編輯器 CSS 不影響對戰。

### 後續功能取捨

- 排位／配對需先確立身分、配對規則與伺服器權威流程；觀戰需另做隱藏資訊投影；好友與雲端戰績需帳號、儲存與存取邊界。本批不新增這些服務。
- 教學下一階段可做逐步判定的練習關卡，但需獨立設計固定教材與規則證據，不能以一般自由練習或讀完文字宣稱已會操作。
- 逐卡攻擊／FLIP／多目標矩陣、全部遠端卡圖及真實觸控裝置仍須獨立驗收；桌機尺寸測試不等同真機觸控完成。

最後更新：2026-09-15。**定位**：UI 已歷經多輪重製（滿版桌墊、PhaseRail、扇形手牌、統一效果 modal——見 CHANGELOG），本文件不是砍掉重練計畫，而是「記錄現行設計的定案 + 對標分析（[tcg-comparison.md](tcg-comparison.md)）＋[UI 審查](ui-audit-2026-07-11.md)萃取的下一步改進」，與 UI 迭代並行維護。

**優先次序方針**（2026-07-18 校正）：**先修已存在的錯誤文案（P0），再堵資料遺失風險（牌組編輯器草稿，P1），再付一次性工程稅收斂本機/線上戰場雙重實作（P1，讓後續戰場改動不必改兩次），然後才是既有的戰場資訊密度與牌組編輯器資訊層級（P1/P2），主選單資訊架構整理次之（P2），最後才是視覺定稿（P3）。**

> 2026-07-18 覆核新增：本次覆核（見下方 P0-3、P1-3、P1-4、P2-4、P3-0）由程式碼走讀 + 本機瀏覽器實測（1366×768）產出，非僅文件比對。已修復項目標記 ✅，其餘為待辦。

## 1. 現行設計定案（不重開的決策）

| 決策 | 內容 |
|---|---|
| 滿版桌墊 | 100vw×100vh 無捲軸畫布，深藍漸層底；桌機優先 |
| PhaseRail | 左側窄型五階段列 + 精確 CTA；<900px 改頂部階段列 + 底部工具列 |
| 場地比例 | 雙方固定 戰鬥區 55% / 支援區 45%，戰鬥卡靠中央分隔列 |
| 手牌 | 扇形；我方右切齊、對手左切齊（牌背 180°）；選取後才抬升顯示合法動作，`Escape` 取消 |
| 資源區 | 牌庫/場景/休息區為數字牌堆 + hover 浮層；棄牌與牌組清單用大型視窗 |
| 效果回應 | 深色置中提示框 + 可縮小 dock（陷阱/FLIP/物品/昏厥/抽牌/棄牌統一） |
| 中央分隔列 | 攻擊、付款與目標選擇提示集中於此 |
| 動畫 | 共用有序演出：卡牌移動、支援橫置、攻擊軌跡、HP／FLIP 揭示、實際昏厥與勝負；支援標準／快速／減少動畫 |
| 拖放 | 暫不實作；未來只作輸入層、仍走規則 API |

## 2. 改進項（依優先序，2026-07-18 校正）

### P0-1 線上對戰彈窗修復（最高）實作與正式瀏覽器驗收完成

- 來源：[UI 審查 §5](ui-audit-2026-07-11.md#5-線上對戰彈窗控制項重疊--未樣式化p0)
- 問題：
  - 控制項重疊與未樣式化：既有 modal 使用未定義的 `modal-panel`/`modal-header` 類別，控制項排列擁擠無樣式節奏。
  - 關閉按鈕（X）尺寸過小（~20×20px），hover 區域不足。
  - 內容區無捲軸管理，高度不足時可能溢出。
- 方案：以專屬 `.online-match-panel` 深藍電競科幻 modal 取代未樣式化面板；關閉按鈕加大至 32×32px 以上；內容區 `overflow-y: auto` 支援捲動；不含房間列表功能（現有協定僅支援建立房間與依房號加入）。
- 實作：`OnlineMatchPanel.tsx` 使用專屬 `.online-match-*` 類別；`GameModals.css` 加入完整樣式（panel、header、body、form control、按鈕 primary/secondary、狀態色 badge、hover/focus-visible/active/disabled、pulse 動畫、高度媒體查詢）。
- 已驗收（Vitest）：建立房間、輸入／加入房號、等待房號、錯誤訊息與返回按鈕、關閉/leave 行為；`OnlineMatchPanel.test.tsx`（15 項 mock hook 測試，含 idle/waiting/error/close/dialog/label/connecting 路徑）。
- **驗收**：`npm run test:online:browser` 以合法本機自訂牌組驗證 1366×768 與 280×720；確認 modal、表單控制項、關閉流程、水平邊界與 console/page error 均通過。窄版改為欄式加入房間列，並移除全域 body 最小寬度造成的 320px 溢出。

### P0-2 主選單空狀態引導（最高）✅ 已完成

- 來源：[UI 審查 §1](ui-audit-2026-07-11.md#1-主選單無自訂牌組時主-cta-與下一步可理解性)
- 問題：無自訂牌組時尚無明確引導玩家前往「建立牌組」的視覺線索，主 CTA 分散。
- 方案：無自訂牌組時將「牌組編輯器」入口提升為視覺主 CTA（放大/置中/輔助文案），並保留快速開始的預設牌組作為次要選項。
- 實作：`MainMenu.tsx` 依 `decks.length` 條件切換按鈕配置；空狀態時「建立第一副牌組」為 primary CTA、「對戰入口」disabled + 解釋文字、「線上對戰」disabled；有牌組時還原以「對戰入口」為 primary CTA。`App.css` 加入 `.main-menu-create-first`、`.main-menu-disabled-cta`、`.main-menu-disabled-reason` 樣式。
- 驗收依據：已通過 4 項 MainMenu Vitest；已在目前 734×698 本機瀏覽器確認無自訂牌組空狀態，1280×720、1366×768 與有牌組實機驗證仍待補。

### P0-3 攻擊後續效果 toast 文案亂碼（最高）✅ 已完成（2026-07-18）

- 來源：2026-07-18 程式碼走讀（非 UI 審查既有項目，屬新發現）。
- 問題：`optionalCostAttack`（可選費用攻擊後續效果）的 `onSkip`/`onPay` 回呼傳給 `match.dispatch()` 的 toast 訊息是編碼損毀的亂碼字串（如 `'撌脩??訾誨?寞????'`），玩家在觸發任何選擇性費用攻擊效果（略過或支付）時會直接看到。因 `src/App.tsx`（本機對戰）與 `src/components/battle/OnlineBattleView.tsx`（線上對戰）為平行實作，同一段亂碼各出現一次，共 4 處。
- 方案：比對既有同義措辭（`useOnlinePendingEffect.ts` 的「已略過攻擊後續效果。」）統一文案，略過／支付分別給出可讀訊息。
- 實作：`src/App.tsx:638,651`、`src/components/battle/OnlineBattleView.tsx:675,688` 改為「已略過攻擊後續效果。」／「已支付攻擊後續效果費用。」。
- 驗收：`npx tsc -b --noEmit` 通過；`grep` 全 `src/` 確認無殘留亂碼樣式字串。

---

### P1-1 牌組編輯器資料安全（高，新發現）✅ 已完成（2026-07-18）

- 來源：2026-07-18 程式碼走讀（`src/components/modals/DeckEditorModal.tsx`）。
- 問題：
  - 儲存按鈕在牌組未滿 60 張／不合法前為 disabled（`DeckEditorModal.tsx:509`），玩家組到一半想中斷就會遺失全部進度——主選單已有「需調整」標籤機制顯示不合法牌組，允許儲存不合法草稿的技術成本很低。
  - 關閉（X）沒有未儲存變更確認，一鍵即丟失所有編輯內容。
  - 「清空」與「匯入」（覆蓋目前牌組）都沒有確認對話框，但「刪除牌組」有——三個破壞性操作待遇不一致。
- 方案：允許儲存不合法草稿（標記為草稿/需調整狀態）；關閉、清空、匯入前若有未儲存變更則彈出確認。
- 實作：`DeckEditorModal.tsx` 以 `savedSnapshot`（存檔快照）與目前 `deckName`/`deckEntries` 的 JSON 比較推導 `hasUnsavedChanges`；儲存按鈕改為僅在牌組空白時 disabled，不合法時仍可存檔並顯示為「儲存草稿」（`is-draft` 樣式，`GameModals.css`）；關閉／清空／匯入三個動作在 `hasUnsavedChanges` 為真時透過 `window.confirm()`（沿用刪除牌組既有的確認模式）詢問，取消則保留現況。
- 驗收：組牌到一半可隨時儲存草稿並在下次進入編輯器時繼續；關閉/清空/匯入三個破壞性操作在有未儲存變更時都需要二次確認。已通過 6 項新增 Vitest（`DeckEditorModal.data-safety.test.tsx`：空牌組禁止儲存、草稿可儲存、無變更關閉不詢問、有變更關閉/清空/匯入覆蓋皆詢問且取消可復原）與本機瀏覽器實測（新增卡片→草稿存檔按鈕可用、關閉/清空/匯入三動作的取消與確認路徑、匯入合法牌組後草稿樣式自動清除）。

### P1-2 本機／線上戰場元件收斂（高，新發現，工程前置項）✅ 已完成（2026-07-18）

- 來源：2026-07-18 程式碼走讀，由 P0-3 亂碼在兩檔案各出現一次觸發的觀察。
- 問題：`src/App.tsx`（本機對戰，711 行）與 `src/components/battle/OnlineBattleView.tsx`（線上對戰，730 行）是兩份平行的畫面編排實作——modal 掛載、`interactionLocked` 判斷邏輯、dispatch 文案幾乎逐行重複，僅共用 `BattleRow` 等子元件。兩邊已出現行為漂移（同一個 bug 各修一次的風險、局部文案不同步）。
- 深入研究後修正原先的理解：`BattleResponseModals`／`DamageEffectModals`／`PendingDecisionModals` 三個 modal 群組其實**已經共用**（透過 `src/hooks/battleUiContracts.ts` 的 `BattleUiMatchLike`／`BattleUiPendingEffectLike` 結構化介面）；本機 `usePendingEffect` 與線上 `useOnlinePendingEffect` 是**刻意縮小範圍的獨立實作**（線上不支援 break-to-* 等多類型 target candidate，`beginCookieSkill` 簽章也不同），不在本次收斂範圍內。額外發現線上版 `interactionLocked` 只檢查 4 個條件、本機檢查 13 個，其中 `pendingOptionalCostAttack` 在線上模式確實有實作但未鎖定戰場其他互動——經使用者確認後一併修正。
- 實作：
  - 新增 `src/hooks/useHandSelectionDismissal.ts`：收斂手牌選取狀態、點擊外部／Escape 解除選取、`activeSelectedHandCardId` 推導。
  - 新增 `src/hooks/deriveInteractionLocked.ts`：共用的互動鎖定判斷函式，核心欄位（`pendingEffect`、`faintActive`、六個 viewer-scoped pending-*）兩邊都檢查，本機/線上各自的 AI 旗標／`viewerControlsState` 以 `extras` 參數傳入。
  - 新增 `src/components/battle/BattleTable.tsx`：承接 PhaseRail、雙方 BattleRow（含分隔列、攻擊預覽箭頭）、卡牌快速預覽、攻擊付款面板的共用版面骨架，僅搬運 JSX、不統一背後邏輯——每個 prop 由呼叫端組好傳入。`.board-texture` 桌墊背景經評估後**刻意不搬入**（它是無 z-index 的 `position: absolute` 裝飾層，搬進去會排到 StatusToast/活動列後面蓋住它們，兩邊呼叫端各自保留）。`BattleUiMatchLike` 介面實際上不需要擴充（原計畫誤判；改用「呼叫端組好整個 `BattleRowProps` 物件傳入」的設計，比直接消費 `match`/`pending` 更安全，也不需要改介面）。
  - `App.tsx`／`OnlineBattleView.tsx` 改用上述三者；App.tsx 711→632 行、OnlineBattleView.tsx 731→683 行（實際減少的行數比原估計少，因為 prop 組裝邏輯是搬移到具名物件而非刪除——真正的重複 JSX 骨架與判斷邏輯已收斂到只有一份）。
- 驗收：`npx tsc -b --noEmit`、`npx eslint` 皆通過；新增 33 項 Vitest（`useHandSelectionDismissal` 8 項、`deriveInteractionLocked` 16 項、`BattleTable` 9 項），全專案套件 123 檔／1733 測試全數通過。本機瀏覽器實機操作確認：開局流程、PhaseRail 推進、hover 快速預覽、手牌選取、點擊外部與 Escape 解除選取皆正常，無 console error。線上模式以 `npm run test:online:match:browser`（真實雙瀏覽器 context + 真實 WebSocket）跑 3 次，2 次全綠（含直接驗證新 hook 的 `handSelectionDismissed` 欄位），1 次在開局調度階段（本次完全未觸碰的程式碼路徑）失敗；改動前的基準版本於同一腳本亦曾在該不相關路徑穩定通過，判斷為既有 E2E 時序性 flaky，非本次改動造成的回歸。`pendingOptionalCostAttack` 鎖定生效這個具體情境本身已由 `deriveInteractionLocked` 的單元測試逐一覆蓋（含 viewer-scoping 正確性），但需要特定卡牌觸發的真實雙人對局情境未逐一實機驗證——誠實記錄為理論修正＋單元測試覆蓋，未做該情境的端到端人工驗證。
- 注意：此項屬工程重構，已排在 P1-3（資訊密度）之前完成，作為後續戰場改版的乘數效益前置工作。

### P1-3 戰場資訊密度與空白區利用（高）✅ 已完成（2026-07-18）

- 來源：[UI 審查 §4](ui-audit-2026-07-11.md#4-對局桌面資訊密度與空白區) + W1；併入 [UX-002](ui-ux/ui-risk-register.md)（HP 逐張翻開 UI 不穩定，risk register P1）。
- 問題：
  - 中央分隔列在無攻擊/效果進行時為大片空白（~15-20% 高度）。
  - 對手場地卡牌尺寸小且無快速放大途徑（原 W1）。
  - ~~支援區卡牌缺乏放大預覽（原 W1）~~ → **訂正**：程式碼走讀確認支援區其實已接 hover 放大預覽（`BattleRow.tsx` 本機/線上、雙方場地共用同一段邏輯），此條為過時描述，並非實際落差。
  - UX-002：傷害處理過程中，玩家無法從 UI 穩定追蹤每張 HP 翻開的結果、順序與 FLIP 狀態，僅能事後查戰鬥紀錄。
- 深入研究後修正範圍：
  - 全域長按（行動裝置）目前完全沒有基礎建設，且 RWD 觸控深度優化本來就已排在改版計畫後續項目——**經使用者確認排除**，不重複投入。
  - HP 翻牌鏈視覺化有關鍵分岔：一般攻擊傷害已有完整逐張中繼狀態（`PendingBattle.stage`／`resolveNextDamage`，`src/game/battle.ts`），是純 UI 工作；但效果傷害（技能/道具/陷阱造成的傷害）在規則引擎層級整批一次移除 HP、完全跳過逐張 FLIP 判定——這其實是風險登錄表 **RULE-002** 的 P0 規則正確性 bug（FLIP 效果被靜默跳過，不只是沒顯示）。**經使用者確認**：本次只做攻擊傷害的翻牌鏈視覺化；RULE-002 的規則引擎修正不在範圍內，維持現狀記錄在風險登錄表。
- 實作：
  - `src/components/battle/BattleRow.tsx`：戰鬥區 cookie 迴圈內新增衍生渲染（不需新增任何 prop，`game.pendingBattle` 早已是既有的 `BattleRowProps.game`）——當 `pendingBattle.stage` 為 `damage`／`flip` 且目標 id（沿用既有 `damageTargetInstanceId ?? targetInstanceId` 判定，與傷害閃爍動畫同一套邏輯）符合時，顯示該張 `revealedHpCard` 正面＋FLIP 徽章（若有）。`PendingBattle.revealedHpCard` 不受線上遮罩處理影響，雙方模式行為一致。
  - 新增 `src/components/battle/CenterCardPreview.tsx`：`.table-area` 內以 `position: absolute` 覆蓋層呈現在 `.table-divider` 附近（比照既有 `AttackPreviewArrow` 定位手法），顯示卡面放大＋效果文字（沿用 `CardPreviewPanel` 既有欄位優先序）＋簡短動作標籤。`BattleTable.tsx` 新增 `centerPreview` prop；`App.tsx`／`OnlineBattleView.tsx` 各自用 `actionStatus.sourceCard` + 既有的 `findCardInGame` 組出完整卡牌資料傳入，觸發時機為 `opponent-thinking`／`resolving`／`awaiting-opponent-decision` 且有可解析來源卡時。
- 驗收：`npx tsc -b --noEmit`、`npx eslint .` 皆通過；新增 7 項 Vitest（`BattleRow.test.tsx` HP 翻牌鏈 5 項、`BattleTable.test.tsx` 中央預覽 2 項），全專案套件 123 檔／1740 測試全數通過。本機瀏覽器實機驗證：以 `?test-state=flip-response` 直接確認 HP 翻牌區塊正確顯示卡面與 FLIP 徽章；實際對局中宣告攻擊後，AI 決定是否發陷阱期間中央區正確顯示攻擊卡「GingerBrave」卡面與攻擊文字，全程無 console error。
- 注意：已排在 P1-2（戰場元件收斂）完成後執行，佈局改動只需改共用的 `BattleTable.tsx` 一份。

### P1-3b 戰場版面線稿圖重新設計（高，新發現，2026-07-19）✅ 已完成

- 來源：使用者提供新戰場線稿圖，確認全面取代 P1-3 完成時沿用的舊版 [01 戰場 wireframe](ui-reference/01-battlefield-wireframe.md) 版面方向（`PhaseRail` 佔左欄、支援區 45%／戰鬥區 55% 上下疊、`CardPreviewPanel` 為角落小面板）。
- 問題：左欄未善用大面積做卡片放大預覽；每側戰場支援/戰鬥區上下堆疊、休息區與牌庫/場景/棄牌分散在版面兩側、左右鏡射規則不一致；手牌貼右非置中；行動按鈕（結束回合/選單/戰鬥紀錄）分散在畫面四個角落。
- 深入研究後的範圍決定：
  - 線稿圖戰鬥區的「HP／IP」兩排堆疊經使用者確認是既有 HP 堆疊被截圖切斷造成的誤讀，非新資源機制；支援區「+1/回」為純版面佔位，本次不實作對應規則。
  - `PhaseRail` 的 5 階段進度列表、逐階段提示文字、品牌 logo 經使用者確認直接簡化拿掉，只保留「目前階段＋回合數」（我方回合底色藍、對手回合底色紅）與既有動態「下一步」按鈕。
  - 行動裝置（<900px）版面刻意維持本次改版前的既有版面不變，未套用新版面（RWD 深度優化為獨立後續項目）。
  - 使用者確認拆成四個階段式 PR 逐步落地，降低單次改動風險。
- 實作（依 PR 順序）：
  - **PR-1**：`InteractionOverlays.tsx`/`.css` 的 `CardPreviewPanel` 從兩個角落小面板整併為單一左欄常駐面板（優先顯示 hover 中的卡，無 hover 時退回對手行動預覽，皆無時顯示「Hover Preview」提示）；`PhaseRail.tsx`/`.css` 簡化並搬到右欄；`App.css` 新增 `--phase-rail-width`，`.table-area` 同時扣除左右兩欄寬度。
  - **PR-2**：`BattleRow.tsx`/`.css` 的 `.field-stack` 從支援/戰鬥上下堆疊改為橫向並列；休息區數量徽章改為「×N」樣式；行動裝置維持改版前的上下堆疊（`grid-row` 覆寫確保戰鬥區仍緊鄰中央分隔列）。
  - **PR-3**：`.utility-zones`（牌庫/場景/棄牌）與 `.break-zone`（休息）不再依對手/我方左右鏡射，統一為休息在左、牌庫等在右（雙方垂直鏡射）；移除 `row-meta` 角落卡片中與牌庫/棄牌/休息重複的數字。
  - **PR-4**：`.hand-fan.bottom-hand` 改為戰場區內置中對齊；`MatchToolbar`、`BattleLogSidebar` 開關從左上/右上角移到右下角，與結束回合按鈕群聚；行動裝置維持改版前定位。
  - 收尾：改寫 `docs/ui-reference/01-battlefield-wireframe.md` 與 `src/ui-reference/BattlefieldMockup.tsx`（`/?mockup=battlefield`）反映新版面。
- 驗收：四個 PR 各自通過 `npx tsc -b --noEmit`、`npx eslint .`、`npx vitest run`（123 檔／1739 測試全過，含更新的 `BattleTable.test.tsx`／`BattleRow.test.tsx`／`PhaseRail.test.ts`／`InteractionOverlays.test.tsx` 斷言）；本機瀏覽器逐項實測確認左欄 hover 放大預覽、右欄階段藍/紅底色切換、支援/戰鬥/休息橫向並列、牌庫等統一右欄、彈出視窗開啟方向、手牌置中、行動按鈕群集中右下角且互不重疊，桌機（1280×800）與行動裝置斷點（820×500）皆驗證正確；修正過程中發現並修好一個行動裝置手牌 `transform` 未重設導致的位置偏移 bug。
- 注意：與 P2-1（牌組編輯器）互不影響，各自獨立 PR；P1-3 完成時的舊版面描述已被本項取代。
- **2026-07-19 依實機預覽回饋校正**：使用者檢視 PR #72 部署預覽後對照原始線稿圖提出 4 項修正——
  - PR-2 誤解為橫向並列，**還原**為支援/戰鬥區上下堆疊。
  - PR-3 誤統一為雙方右欄，**還原**為依對手/我方左右鏡射（休息區/牌庫欄位鏡射規則不變）。
  - PR-1 的 `PhaseRail` **重做**：從全高右欄改為垂直置中的小區塊，定位在對手休息區（右上）與我方牌庫/場景/棄牌欄（右下）之間、貼近中央分隔列；`.table-area` 不再為它保留獨立欄寬。實測確認此區塊與相鄰欄位外緣留白有部分重疊，但兩欄位置中的實際可視內容都在重疊範圍外，不影響點擊。
  - PR-4 **加做**手牌部分高度顯示：`overflow:hidden` 開窗，對手手牌露出上方 1/3、我方手牌露出上方 1/2；因玩家手牌沿用 `bottom:0` 定位，額外加上等量負值 `bottom` 補償量才能露出卡片上半部而非下半部，並依各既有響應式斷點的手牌尺寸個別換算開窗高度。
  - 驗證：`npx tsc -b --noEmit`／`npx eslint .`／`npx vitest run`（123 檔／1739 測試全過，`PhaseRail.test.ts` 斷言同步更新）；本機瀏覽器複驗支援/戰鬥上下堆疊、牌庫等左右鏡射、`PhaseRail` 置中定位與點擊可用性、手牌部分高度顯示，桌機與行動裝置斷點皆確認正確。

### P1-4 動態匯入效能（高）✅ 已完成

- 來源：[UI 審查 §6](ui-audit-2026-07-11.md#6-總結與優先順序建議)
- 問題：目前 mockup 與部分重型元件非動態載入，可能影響初始載入時間與 code splitting 效果。
- 方案：將 `src/ui-reference/` mockup 改為 `React.lazy()` + `Suspense` 動態匯入；審查既有 bundle 結構。
- 驗收：mockup 頁面以獨立 chunk 載入；正常遊戲主流程不受影響。
- 實作：`src/main.tsx` 移除 `MockupGallery` 靜態 import，改為 `lazy(() => import('./ui-reference/MockupGallery'))` 條件載入；正常遊戲路徑不包含 `src/ui-reference/` 任何元件；loading fallback 以深藍背景 + 旋轉指示器呈現。

---

### P2-1 牌組編輯器資訊層級（中）

- 來源：[UI 審查 §2](ui-audit-2026-07-11.md#2-牌組編輯器卡池與右側摘要資訊層級)；擴充自 2026-07-18 程式碼走讀 + 本機瀏覽器實測。
- 問題：
  - 右側摘要扁平，無「儲存/測試/分享」明確出口；卡池搜尋/過濾樣式化未完成。
  - 同一張卡的不同印刷版本在卡池以多個獨立格子重複出現（如 BS1-002 Kumiho Cookie 出現兩次），上限計算雖已按基礎卡號合併，但視覺上易讓玩家誤解為兩張不同卡。
  - 卡池為全量 DOM 渲染（數百張卡＋熱連結圖片全部掛載），本機瀏覽器測試時觀察到渲染明顯吃緊；低階裝置或圖片載入緩慢時體驗會更差。
  - 只有篩選、沒有排序，也沒有「只看已加入牌組的卡」切換。
  - 缺等級/顏色分佈曲線圖——右側摘要目前只有數字，沒有組牌決策所需的視覺化資訊。
  - 匯出按鈕使用 Download 圖示但實際行為是複製到剪貼簿，圖意與行為不符。
- 方案：
  - 右側摘要區增加「儲存牌組」（主 CTA）、「測試對戰」（次 CTA）；卡池搜尋/過濾完成樣式化。
  - 同基礎卡號的不同印刷版本聚合為單一卡池格子，印刷版本選擇收進既有的詳細/數量調整浮層。
  - 卡池改為虛擬捲動或分頁載入。
  - 卡池加入排序（如依卡號、稀有度）與「只看已加入牌組」篩選開關。
  - 右側摘要加入等級/顏色分佈曲線圖。
  - 匯出按鈕圖示與行為對齊（改用複製圖示，或同時提供下載檔案選項）。
- 驗收：完成牌組編輯後有明確的下一步行動按鈕，且以視覺層級區分優先級；卡池捲動在完整卡池下無明顯掉幀；同卡不同印刷版本不再佔用多個格子；可依卡號/稀有度排序並篩選已加入卡牌。

### P2-2 動畫可跳過（2026-09-14 已實作）

- 已提供左上角「標準／快速／減少動畫」與「略過目前演出」。設定儲存於 `braverse.animation-speed`；系統減少動態優先，略過只影響呈現，不代替任何規則決策。
- 驗收：開啟後對局流程無等待感；Playwright 驗證不受影響。

### P2-3 數值變化微回饋（低，原 W4）

- 方案：HP/ATK 徽章數值變動時 200ms 縮放脈衝 + 顏色閃爍（增益綠/傷害紅）。

### P2-4 主選單資訊架構整理（中，新發現）✅ 已完成（2026-08-01）

- 來源：2026-07-18 本機瀏覽器實測（1366×768）+ 程式碼走讀（`src/components/MainMenu.tsx`）。
- 問題：
  - 主選單同時扮演牌組管理器、AI 對手設定、對局發起三種角色，實測時左欄已需捲動，「目前玩家牌組」區塊被截到視窗外。
  - 開發者工具與玩家主要動線混在一起：「重新讀取」（手動 reload localStorage，玩家幾乎不需要）與「測試對局設定」（QA 工具）與「對戰入口」平列同級。
  - 「線上對戰」按鈕在無牌組時 disabled，但沒有像「對戰入口」一樣附上原因文字（`MainMenu.tsx:137-145`），與既有 P0-2 的 disabled 說明模式不一致。
- 方案：先決定主選單的角色分工再談排版——開發者工具收進次級選單或獨立 debug 入口；「線上對戰」disabled 時補上與「對戰入口」一致的原因文字；視情況為「目前玩家牌組」等關鍵狀態區塊固定可視範圍或改用分頁。
- 驗收：1366×768 下左欄不需捲動即可看到牌組狀態與主要 CTA；開發者工具與玩家對局動線視覺分離；所有 disabled 按鈕都有一致風格的原因文字。
- 實作：依既有 `src/ui-reference/MainMenuRedesignMockup.tsx`（`/?mockup=main-menu-redesign` 可渲染，計畫內文件標為 P2-5 但內容就是這項的解法）落地：
  - 「測試對局設定」「重新讀取」從 `.main-menu-actions` 移到 `<footer>` 內獨立的 `.main-menu-dev-tools` utility bar（`<nav aria-label="開發者工具">`），與「對戰入口」「線上對戰」「牌組編輯器」三個玩家動線按鈕視覺分離。
  - 「線上對戰」disabled 時比照「對戰入口」補上 `.main-menu-disabled-reason`（「尚無自訂牌組，請先建立牌組後再開始線上對戰。」）。
  - 錯誤區從獨立的 `grid-area: errors`（會推高整個左欄）併入「目前玩家牌組」卡片內，改成卡片內部的分隔線區塊，並加 `max-height: 92px` + `overflow: auto` 上限，不再無界推高卡片高度。
  - `.main-menu-panel` 從 `overflow: auto`（整頁一起捲）改成 `overflow: hidden` + 明確 `height: 100%`，只有「已儲存牌組」清單（`.main-menu-decks` → `.main-menu-deck-list`）會內部捲動；`.main-menu-status-grid` 保留 `overflow: auto` 作為極端內容量下的保險，不會裁切內容。
  - 新增 `@media (min-width: 681px) and (max-height: 780px)` 緊湊高度斷點（原本 680px 與桌機之間完全沒有高度感知斷點），縮小品牌字標、按鈕間距與卡片內距。
  - `<680px` 既有單欄手機版行為維持不變（`overflow: auto` 還原、grid-template-areas 移除已合併的 `errors`）。
- 驗證：`npx tsc -b`、`npx eslint`、`npx vitest run`（161 檔／2413 測試全過，含 `MainMenu.test.tsx` 新增的 2 項斷言：兩個 disabled 按鈕都有原因文字、開發者工具確實搬到 footer）、`npm run build` 皆通過。本機瀏覽器在 1366×768（空狀態／已選牌組／牌組不合法三種情境）與 1280×720 皆以 `getBoundingClientRect`/`scrollHeight` 直接量測確認左欄與整頁都不需捲動；600×338 手機斷點確認單欄版面與原有的面板內捲動行為未受影響。

---

### P3-0 Theme variant 收斂（低，新發現，P3 視覺定稿前置項）

- 來源：[UX-004](ui-ux/ui-risk-register.md#ux-004五套-theme-variant-收斂方向不明)（risk register P2，U0 僅盤點未處理）。
- 問題：目前存在五套獨立 theme variant（見 `docs/phase1-theme-variants.md`），但 UI/UX 計畫僅規畫三方向（清楚優先、沉浸優先、平衡型）；若直接進行 P3-1/P3-2 視覺定稿，等於要在最多五套變體上各做一次裝飾性改動。
- 方案：評估五套 variant 使用數據/回饋，收斂至不超過三套，並設定一套正式預設。
- 驗收：正式版本保留不超過三套 variant，其中一套為預設；`themeStorage.test.ts` 等既有測試更新以反映收斂後的清單。
- 注意：此項必須在 P3-1、P3-2 開工前完成，否則視覺定稿工作量隨 variant 數量倍增。

### P3-1 甜點戰場質感（低，原 W3）

- 方案：桌墊加低對比甜點紋理/暈影、卡牌兩層陰影（環境+接觸）、區域圓角統一 12px；accent 以糖果色點綴（見 style guide），僅裝飾不承載資訊。
- 驗收：1366×768 截圖對比前後；可讀性不下降（文字對比維持 AA）。
- 注意：此項僅為視覺定稿，必須在 P0/P1 功能面穩固後、且 P3-0 完成後才投入。

### P3-2 主選單氛圍（低，原 W5）

- 方案：主選單加 logo 字標、牌組卡片縮圖化；維持現有 grid 資訊結構。
- 注意：此項僅為視覺定稿，必須在 P0-2 空狀態引導、P2-4 主選單資訊架構整理（功能面）完成後再做裝飾性改進。

## 3. 驗收基準（全案通用，延續主計畫）

- 桌機 16:9 完整遊玩；1366×768 不爆版；最低 600×338 可操作。
- 手機/平板可瀏覽與簡化操作（現況：<900px 窄版模式；觸控深度優化列為後續，見 [ui-reference/05-mobile-rwd-wireframe.md](ui-reference/05-mobile-rwd-wireframe.md)）。
- 玩家不需要猜現在可以做什麼（含主選單空狀態 P0-2、主選單資訊架構 P2-4、牌組編輯器出口 P2-1）。
- 每個可點擊區域都有 hover / active / disabled 狀態（含線上對戰彈窗修復 P0-1）；disabled 狀態需附原因文字。
- 破壞性操作（清空、匯入覆蓋、關閉未儲存變更）一律有確認流程（P1-1）。
- 玩家可見文字不得出現亂碼或未在既有措辭表中出現的臨時字串（P0-3 為此類問題的回歸基準）。
- 每個 modal 有 `role="dialog"`、`aria-label`，開啟時焦點移入、關閉時焦點歸還觸發元素（對應 [A11Y-001](ui-ux/ui-risk-register.md#a11y-001modal-accessible-name-與標籤不足)、[A11Y-002](ui-ux/ui-risk-register.md#a11y-002焦點管理不完整)；隨每項改動順手補齊，不獨立排期）。
- 戰鬥紀錄可收合；動畫可跳過（P2-2 完成後）。

## 4. 參考畫面與相關文件

- 風險登錄：[UI 風險登錄表](ui-ux/ui-risk-register.md)（UX-002、UX-004、A11Y-001/002 等既有風險項的來源）
- 審查報告：[UI 審查 2026-07-11](ui-audit-2026-07-11.md)（優先次序校正依據）
- Wireframe：[01 戰場](ui-reference/01-battlefield-wireframe.md)、[02 主選單](ui-reference/02-main-menu-wireframe.md)、[03 牌組編輯器](ui-reference/03-deck-editor-wireframe.md)、[04 卡牌 modal](ui-reference/04-card-modal-wireframe.md)、[05 行動裝置 RWD](ui-reference/05-mobile-rwd-wireframe.md)
- 可渲染 mockup（dev server 下以網址開啟，像 Figma 一樣審查）：
  - `/?mockup=battlefield` → `src/ui-reference/BattlefieldMockup.tsx`
  - `/?mockup=main-menu` → `src/ui-reference/MainMenuMockup.tsx`
  - `/?mockup=deck-editor` → `src/ui-reference/DeckEditorMockup.tsx`
  - mockup 呈現的是現行版面供審查比對。


## 2026-09-14 全流程動畫

### 設計與範圍

採用既有卡圖、牌背及 CSS／Web Animations API。參考爐石的來源／目標辨識、Master Duel 的重點演出及 MARVEL SNAP 的快速節奏，沒有引入其他遊戲的素材或動畫套件。第一版無音效、無逐卡專屬演出。

- 猜拳顯示雙方選擇及勝方；起手卡交錯進場，起始餅乾同時揭示，接續對戰開始橫幅。
- 區域移動共用視覺替身與卡槽定位；來源位置保留到移動開始，正式卡已掛載目的地時仍從舊位置出發。
- 支援確認後橫置及能量軌跡；攻擊宣告與實際命中分開，HP、ATK 數字取規則狀態。
- 一般階段切換只更新階段列；FLIP 與已發動陷阱使用公開卡面中央特寫，必要選擇等特寫完成後開啟。
- HP／FLIP 顯示公開卡面；效果結算、多張 HP、昏厥、Refresh、回合與結果使用有序事件。只有實際昏厥位置可以發出昏厥事件。
- 180–300ms 的日常操作、350–600ms 的揭示與戰鬥、700–1,000ms 的開場／結果；快速模式為 50%，積壓超過 2 秒自動縮短播放，保留事件順序。

### 契約與相容性

`CommandLogEntry.presentation` 是可選的具型別呈現紀錄；`GameState.presentationSteps` 僅供指令內部收集中間效果，接受指令回傳前移除，不是線上遊戲狀態。規則 API、AI 策略與 GameCommand 格式未改變。舊紀錄沒有 presentation 時，以可觀察狀態差異補足，無法還原的歷史中間動畫不猜測。

`maskGameStateForViewer` 會遮罩事件卡面及私密實體 ID，牌庫與背面 HP 對擁有者仍不公開；線上匯出另移除呈現紀錄。前端不讀中文日誌猜結果，也不為播放重跑規則。玩家輸入於演出期間停用，規則自動推進不依賴動畫完成回呼；詳情、速度與略過仍可使用。重連／同步、切換分頁、重設、卸載或縮放會清理演出並回到目前狀態。

### 驗證命令與證據

- `npm.cmd test -- --maxWorkers=1`：完整規則與 React 回歸。
- `npm.cmd run build`、`npm.cmd run lint`：建置與全域 lint；全域 lint 的既有未追蹤檔錯誤分開回報。
- `npm.cmd run test:ai:browser`：既有版面／互動矩陣；開局入口已更新為正式首頁「AI 對戰」。
- `npm.cmd run test:online:match:browser`：雙端開局、支援／階段、預覽、非法指令及斷線。
- `npm.cmd run test:animations:browser`：從正式自訂 RED 牌組入口，以可見按鈕完成開局、放置支援、決策與 AI 對局至勝負，保留錄影與報告；`BRAVERSE_ANIMATION_VIEWPORT=1164x777`、`BRAVERSE_ANIMATION_SPEED=fast` 可驗平板快速模式。
- `npm.cmd run test:animations:online`：擴充好友房腳本，桌機快速／平板減少動畫以正常階段、抽牌直到 Refresh 判定勝負，確認雙端勝者一致及結束後斷線保留結果。這條完整結束路徑不等同逐卡線上攻擊／FLIP 全覆蓋；戰鬥特殊路徑由規則測試及既有 Browser 測試補足。
- `npm.cmd run test:animations:online -- --animation-battle`：透過可見 UI 放置支援、選付款與攻擊目標、回應與替補，直到雙端勝負。此腳本使用 Vite 開發伺服器；執行期間不要改動原始碼，以免熱更新重設對局。

產物留在 `test-results/animation-*`，不提交影片、截圖與日誌。正式卡圖目前遭環境網路拒絕，因此可確認缺圖替代畫面、操作與定位，尚未完成全部正式卡面載入下的視覺驗收。`test:online:browser` 亦會因圖片請求 `ERR_NETWORK_ACCESS_DENIED` 停在環境檢查，不標為通過。

2026-09-14 實測結果（Windows、Chrome；日誌與影片不提交）：

| 驗證 | 結果與邊界 |
|---|---|
| 完整 Vitest | 提交前重跑 327 個檔案、4,802 項通過（510.05 秒）；後續主選單樣式／載圖替代調整，另跑既有 MainMenu 16 項及正式大廳 Browser |
| 工程 | build、server:typecheck、本次修改檔案 ESLint 通過；全域 lint 被原有未追蹤檔 `.tmp-bs9-030-ui9.mjs`、`.tmp-probe-deploy.ts`、`scripts/diagnose-lv5-conservatism.ts` 的 4 個錯誤阻擋 |
| AI 規則對局 | 固定種子 1–20 全數正常結束，最多 231 步，未挑選種子 |
| AI Browser | 既有腳本通過，本次未重現舊 1920×1080 基線失敗；不代表遠端卡圖已載入 |
| 正式 AI 整場 | 1920×1080 標準及 1164×777 快速模式均由開局至勝負，包含支援、決策及 AI 攻擊，無 JavaScript pageerror；兩尺寸均保留錄影 |
| 好友房核心 | 雙端開局、階段與支援同步、攻擊預覽、非法指令拒絕、斷線與連線失敗處理通過 |
| 好友房完整 Refresh 路徑 | 桌機快速／平板減少動畫，149 次 UI 階段操作至勝負，雙端結果一致，結束後斷線結果保留 |
| 好友房完整攻擊路徑 | 最終原始碼版本通過，134 次 UI 操作、15 次付款攻擊至勝負；桌機快速／平板減少動畫，雙端均顯示 Guest Player 勝利，結束後斷線保留結果及連線失敗檢查通過 |
| 線上 UI／正式卡圖 | `test:online:browser` 因圖片網路拒絕失敗；正式卡面視覺驗收未完成，缺圖替代畫面及操作已驗證 |

特殊效果的規則案例與既有 Browser 覆蓋可作補充，但尚不能宣稱所有 FLIP、陷阱、特殊勝利在兩端、三種速度下的完整視覺矩陣均已驗收。

以上「通過」命令結束碼均為 0。基底為 `f95bde0` 加本次未提交差異；提交前完整 Vitest 已包含開局與暫停互動；後續只改主選單樣式與載圖替代，規則轉換與 AI 策略未再變更，因此沿用全套及固定種子證據，另重跑 MainMenu 回歸、build、範圍 lint 與正式大廳 Browser。AI Browser 修正發牌期間面板隱藏的錯誤完成判定後重跑通過。全域 lint 與線上 UI 圖片環境檢查仍為失敗，不宣稱工程與視覺全面全綠。


### 開局發牌時序優化（2026-09-14）

- 猜拳與選擇先後攻期間，桌面不顯示雙方手牌，手牌數顯示 0、牌庫包含尚未呈現的起手牌；僅調整呈現，不改動規則資料。
- 先後攻確認後，雙方起手牌交錯從各自牌庫發出；每張抵達後立即顯示於手牌區。對手用匿名手牌位置與牌背，沒有加入私密卡牌識別碼。
- AI 與線上開局都等發牌完成後才開啟調度；略過及減少動畫仍能直接銜接決策。補上 StrictMode 重複掛載測試，避免清理計時器後卡在發牌狀態。
- 本次驗證：9 個測試檔案／106 項、build、本次檔案 ESLint 均通過。桌機 1920×1080、平板 1164×777 瀏覽器驗證確認前無手牌、逐張抵達、發完才調度；好友房核心回歸與桌機 AI 正式對局至勝負均通過，命令結束碼 0。
- 證據保留於 `test-results/opening-deal-*` 與 `animation-*-before-order.png`／`during-deal.png`／`after-deal.png`。本次未重跑完整 Vitest；未修改規則轉換與 AI 策略，原完整回歸僅作前一版基線。AI 整場仍記錄到圖片網路拒絕，不能宣稱正式卡圖視覺全部驗收。


### 猜拳、先後攻與調度面板整理（2026-09-14）

- 本機開局面板統一四步進度與深色卡桌視覺；猜拳改為手勢圖示，牌組資訊收進可展開摘要，先後攻選項補上回合順序說明。
- 調度移除已完成的猜拳結果；六張手牌使用深色展示區與卡名，取消無作用的逐卡按鈕，明示保留或全部更換。起始餅乾仍保持可選／不可選判定。
- 對話框具備標題關聯、步驟標記及鍵盤焦點樣式；步驟切換將焦點移至標題。沿用先後攻確認後發牌、發完才調度的順序。
- 驗證：3 個檔案／60 項測試、本次 TSX ESLint、build、diff check 通過；1920×1080 與 1164×777 實際操作三個面板、選擇後攻及保留手牌至起始餅乾均通過，無 pageerror。牌面請求仍有環境網路拒絕，因此卡圖載入不列為全部通過。
- 截圖與日誌：`test-results/opening-panels-*`。本次只調整本機面板與呈現，未修改規則或線上協議，未重跑完整 Vitest 或整場對戰。


### 暫停面板與對局工具整理（2026-09-14）

- 暫停面板統一為深色卡片，集中顯示回合、階段與牌組；繼續對戰改為全寬主要按鈕。AI 動作數與複製問題包移至可展開的問題回報區，收合時不進入鍵盤焦點序列。
- 對局工具加大點擊區、補充操作說明，暫停放前、重新開始分隔呈現。支援方向鍵、Home／End、Esc 還原觸發鈕焦點，以及點擊外部收合；重開對局的既有處理不變。
- 驗證：3 個檔案／58 項測試、本次檔案 ESLint、build、diff check 通過；正式 AI 開局後在 1920×1080 與 1164×777 操作選單鍵盤、暫停／繼續、Esc 返回與問題回報區展開，均通過且無 pageerror。問題包複製以單元測試確認回呼與成功回饋，瀏覽器未覆寫使用者剪貼簿。
- 產物位於 `test-results/pause-polish-*`；本次為 UI／鍵盤互動調整，未修改規則，未重跑完整 Vitest 或整場對戰。


### 對戰大廳整理與提交驗證（2026-09-14）

- 參考 [MARVEL SNAP 官方 PC 寬螢幕介紹](https://marvelsnap.com/marvel-snap-is-better-than-ever-on-pc/) 與 [Master Duel 官方 DUEL 入口說明](https://ja-support1.konami.com/hc/ja/articles/4415136312345)。採用寬螢幕分區與明確對戰入口的原則，排版與數值由 Braverse 自身需求制定，未複製其他遊戲素材。
- 正式主選單保留原版金色雙行字樣與棕色 BRAVERSE 膠囊 LOGO；以左側牌組／對手準備區與金色 AI 對戰按鈕、右側限寬代表卡呈現。牌組管理與好友房是次要入口；牌組統計減少膠囊框線，編輯與複製／刪除分開。開發工具預設收合，單副牌組時停用左右切換。
- 代表卡使用完整比例；遠端圖片下載中先顯示本機牌背，下載失敗保留牌背。桌機／平板保留並列，900px 以下改為單欄，避免展示卡壓縮操作空間。
- 正式 60 張 RED 牌組在 1920×1080、1164×777、390×844 實際選擇 AI 等級及開始開局通過；雙欄不重疊，無水平溢出，桌機／平板主要操作在首屏。空牌組禁止對戰且可建立新牌組，不合法牌組呈現原因並阻擋開始，無 pageerror。這是正式主選單／開局驗證，手機未驗完整對戰。
- 提交前完整 Vitest 327 檔／4,802 項、MainMenu 16 項、build、本次檔案 ESLint、AI Browser 均通過，結束碼 0。全域 lint 仍是前述 3 個無關未追蹤檔的 4 個錯誤；遠端卡圖仍受網路限制，不能宣稱正式卡面全部載入驗收。
- 本節提交前結果取代前面各小批次「未重跑完整 Vitest」的當時狀態；未變動的線上／規則層沿用前述完整對局證據。產物：`test-results/animation-commit-*`、`test-results/lobby-*`，不納入提交。


### 對戰桌視覺整理（2026-09-14）

- 延續前述 MARVEL SNAP 寬螢幕分區與 Master Duel 重點演出的參考方向；以 Braverse 自身的上下對戰／支援區配置、既有卡圖及深藍／金色完成正式樣式，沒有增加其他遊戲素材。
- 桌墊菱格紋、區域邊框與中央標籤降低對比，讓卡牌與合法目標高亮成為重點；可用的下一步操作使用金色。來源／目標及規則指令、付款與動畫事件不變。
- tactical-clean 桌機（寬度 >1280、高度 >620）為手牌保留獨立區域；玩家卡不再從螢幕外探出，選取／懸停只短距離抬升。牌桌使用上下約 34% 支援／66% 戰鬥配置，名稱牌收在側邊且不壓到 EXTRA。支援張數回到區域內。平板與窄螢幕沿用既有獨立手牌 dock。
- 本機／線上與 mockup 共用 `battle-presentation.css`，在既有 RWD 樣式後載入；其他主題未改版。
- Windows / Chrome：相關 BattleRow、MatchAnimationLayer、useMatchAnimations 共 3 檔／75 項通過；build、AI Browser、好友房核心同步與非法指令拒絕通過。全域 lint 仍是 3 個既有未追蹤檔的 4 個錯誤，本次修改未新增錯誤。
- 正式 RED 牌組開局於 1920×1080、1915×866、1164×777 檢查手牌未選／選取的邊界與支援區不重疊，另實際放置支援確認卡牌在區域內，均通過且無 pageerror。影片、截圖與日誌位於 `test-results/battle-polish-*`；正式卡圖仍受環境網路限制，僅確認缺圖替代與操作。此次只修改樣式與匯入，未重跑完整 Vitest／完整對局至勝負，不把核心同步等同整場驗收。


### 卡牌快速預覽放大（2026-09-14）

- 寬度 >900px 的快速預覽面板調為 320–380px，完整卡圖最大寬度 300px；卡名 18px、卡號／類型 12px、效果文字 14px 與 1.6 行高。面板上移，卡圖依可用高度縮小；長文維持最多五行的快速摘要，完整內容沿用卡牌詳情。
- 4 項 InteractionOverlays 測試、build、diff check 通過；正式 RED 開局於 1920×1080、1915×866、1164×777 實際選牌，驗證面板未越界、卡圖寬至少 260px、效果字級至少 14px，均通過。既有純樣式調整不重跑完整 Vitest；全域 lint 沿用本批 4 個無關錯誤紀錄，遠端卡圖網路限制不變。
- 截圖與日誌：`test-results/preview-size-*`，不提交。

- 提交前整批重驗（基底 `4dd9fdb` 加本次 6 個檔案差異）：完整 Vitest 327 檔／4,802 項通過（501.94 秒）、build、本次 src/main.tsx ESLint 與 diff check 通過，結束碼 0；此結果更新上述小批次尚未重跑全套的當時紀錄。全域 lint 結束碼 1，仍為既有 3 個無關未追蹤檔的 4 個錯誤。未更動的 Browser 驗證沿用上述正式操作證據。日誌 `test-results/battle-ui-commit-*` 不提交。
