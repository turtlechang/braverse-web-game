# UI / UX 改版計畫（Redesign Plan）

最後更新：2026-07-18。**定位**：UI 已歷經多輪重製（滿版桌墊、PhaseRail、扇形手牌、統一效果 modal——見 CHANGELOG），本文件不是砍掉重練計畫，而是「記錄現行設計的定案 + 對標分析（[tcg-comparison.md](tcg-comparison.md)）＋[UI 審查](ui-audit-2026-07-11.md)萃取的下一步改進」，與 UI 迭代並行維護。

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
| 動畫 | 短促功能性（攻擊抖動、抽牌滑入、傷害閃爍、昏厥縮小） |
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

### P2-2 動畫可跳過（中，原 W2）

- 方案：設定項「減少動畫」（同時尊重 `prefers-reduced-motion`），動畫時長歸零但保留結果狀態。
- 驗收：開啟後對局流程無等待感；Playwright 驗證不受影響。

### P2-3 數值變化微回饋（低，原 W4）

- 方案：HP/ATK 徽章數值變動時 200ms 縮放脈衝 + 顏色閃爍（增益綠/傷害紅）。

### P2-4 主選單資訊架構整理（中，新發現）

- 來源：2026-07-18 本機瀏覽器實測（1366×768）+ 程式碼走讀（`src/components/MainMenu.tsx`）。
- 問題：
  - 主選單同時扮演牌組管理器、AI 對手設定、對局發起三種角色，實測時左欄已需捲動，「目前玩家牌組」區塊被截到視窗外。
  - 開發者工具與玩家主要動線混在一起：「重新讀取」（手動 reload localStorage，玩家幾乎不需要）與「測試對局設定」（QA 工具）與「對戰入口」平列同級。
  - 「線上對戰」按鈕在無牌組時 disabled，但沒有像「對戰入口」一樣附上原因文字（`MainMenu.tsx:137-145`），與既有 P0-2 的 disabled 說明模式不一致。
- 方案：先決定主選單的角色分工再談排版——開發者工具收進次級選單或獨立 debug 入口；「線上對戰」disabled 時補上與「對戰入口」一致的原因文字；視情況為「目前玩家牌組」等關鍵狀態區塊固定可視範圍或改用分頁。
- 驗收：1366×768 下左欄不需捲動即可看到牌組狀態與主要 CTA；開發者工具與玩家對局動線視覺分離；所有 disabled 按鈕都有一致風格的原因文字。

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
