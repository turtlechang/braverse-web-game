# U0 風險登錄表（UI Risk Register）

> 建立日期：2026-07-12
> 基準 HEAD：`3d5d514`
> U0 原則：只登錄，不修正。後續負責領域與驗收條件為 U1+ 參考。

---

## ID 命名規則

| 前綴 | 領域 |
|---|---|
| RULE-* | 規則結算錯誤或歧義 |
| CMD-* | 命令層、驗證、付款狀態機 |
| ONLINE-* | 線上協議、重連、rejection |
| UX-* | UI 互動、資訊呈現、操作流程 |
| A11Y-* | 可及性（keyboard、screen reader、focus） |
| ASSET-* | 素材、授權、圖像 |
| DOC-* | 文件過期、不一致 |

## 嚴重度定義

| 等級 | 定義 |
|---|---|
| P0 | 規則結算錯誤、對局結果可能不正確；或線上安全性缺陷 |
| P1 | 資訊回饋不完整、操作困惑、可及性不足影響可用性 |
| P2 | 視覺或文件差距、不影響規則或基本操作 |

---

## RULE 風險登錄

### RULE-001：Break Level Sum 10 敗北時機錯誤

| 欄位 | 內容 |
|---|---|
| ID | RULE-001 |
| 嚴重度 | P0 |
| 觸發條件 | 多目標傷害導致 break level >= 10，但尚有 pending faint effect 或 after-damage effect |
| 玩家影響 | 對局可能在應結束後繼續處理無關效果，影響勝負判斷 |
| 目前緩解 | 無（`resolveBasicVictory()` 清除全部 pending，但呼叫時機在全部 blocking 結束後而非每張 HP 後） |
| 證據 | `src/game/victory.ts:18-37`；傷害流程中的 victory check 呼叫點 |
| 後續負責 | 規則引擎（`src/game/victory.ts` + `src/game/battle.ts`） |
| 驗收條件 | 在單張 HP 的 FLIP 回應後，若 break level >= 10，立即宣告敗北，不處理下一張 HP 或後續效果；有回歸測試 |

### RULE-002：效果傷害批次移除 HP

| 欄位 | 內容 |
|---|---|
| ID | RULE-002 |
| 嚴重度 | P0 |
| 觸發條件 | 非攻擊效果（如技能、道具）造成多點傷害 |
| 玩家影響 | 多張 HP 可能在同一次狀態轉換中移除，FLIP 檢查與逐張回應被繞過 |
| 目前緩解 | 無 |
| 證據 | `src/game/effects/execute.ts` 的傷害效果執行模式 |
| 後續負責 | 規則引擎 |
| 驗收條件 | 所有傷害效果強制逐張處理 HP，每張後檢查 FLIP；回歸測試含 FLIP 觸發案例 |

### RULE-003：多目標效果非逐目標結算

| 欄位 | 內容 |
|---|---|
| ID | RULE-003 |
| 嚴重度 | P0 |
| 觸發條件 | 效果宣告時選擇多個目標 |
| 玩家影響 | 目標結算順序不可控；一個目標的效果可能被另一個目標的非同步處理干擾 |
| 目前緩解 | 無（無 `orderedTargetIds` 機制） |
| 證據 | `src/game/types.ts` 中的 `PendingEffectOrder`；缺少 `orderedTargetIds` 欄位 |
| 後續負責 | 規則引擎 + UI |
| 驗收條件 | `orderedTargetIds` 型別、宣告 UI、逐目標結算引擎；回歸測試 |

### RULE-004：補位 0 張的程式與測試衝突

| 欄位 | 內容 |
|---|---|
| ID | RULE-004 |
| 嚴重度 | P1 |
| 觸發條件 | 戰鬥區清空且手牌有可登場餅乾，但玩家選擇不補位 |
| 玩家影響 | 可能被判定為 `no-cookie-available` 敗北（若補位邏輯未正確支援補 0） |
| 目前緩解 | `skipDefeatedCookieReplacement()` 允許跳過補位 |
| 證據 | `src/game/victory.ts:28-34`；需確認跳過補位後不會觸發 `no-cookie-available` |
| 後續負責 | 規則引擎 — 確認 `skipDefeatedCookieReplacement()` 後的正確敗北檢查 |
| 驗收條件 | 補 0 張後若手牌仍有可登場餅乾，不敗北；回歸測試 |

---

## CMD 風險登錄

### CMD-001：RuleValidator 非獨立公開 API

| 欄位 | 內容 |
|---|---|
| ID | CMD-001 |
| 嚴重度 | P1 |
| 觸發條件 | UI 需要在不可變 GameState 情況下驗證操作合法性 |
| 玩家影響 | UI 只能透過 `applyGameCommand()` 驗證，耦合驗證與狀態變更 |
| 目前緩解 | `getLegalTurnCommands()` 提供部分唯讀檢查 |
| 證據 | `src/game/commands.ts` 的 `applyGameCommand()` 設計 |
| 後續負責 | 規則引擎 — 提取 `RuleValidator` 公開介面 |
| 驗收條件 | 每種 GameCommand 有對應唯讀驗證函式，UI 可呼叫而不改變 GameState |

### CMD-002：付款生命週期無正式型別

| 欄位 | 內容 |
|---|---|
| ID | CMD-002 |
| 嚴重度 | P1 |
| 觸發條件 | 付款操作中的任何步驟（選擇、確認、取消） |
| 玩家影響 | 選擇能量支付的 UI 狀態管理依賴 React local state，無可追溯的 `PaymentDraft` 結構 |
| 目前緩解 | `AttackPaymentPanel` 和 `selectEnergyPayment()` 提供基本付款功能 |
| 證據 | `src/game/energy.ts`；`App.tsx` 的 `AttackPaymentPanel` |
| 後續負責 | 規則引擎 + UI — 建立 `PaymentDraft`、`PaymentState` 型別 |
| 驗收條件 | 付款可透過 `PaymentDraft` 序列化；確認前可取消與重選；確認後不可撤銷 |

---

## ONLINE 風險登錄

### ONLINE-001：線上命令缺少樂觀更新協議

| 欄位 | 內容 |
|---|---|
| ID | ONLINE-001 |
| 嚴重度 | P1 |
| 觸發條件 | 玩家在線上對局中送出 GameCommand |
| 玩家影響 | 無法確認命令是否被 server 接受；rejection 時無復原機制；無重送與去重保證 |
| 目前緩解 | 無（目前樂觀送出後不追蹤狀態） |
| 證據 | `src/hooks/useOnlineMatch.tsx` 的命令送出邏輯 |
| 後續負責 | 網路層 — 加入 commandId、stateRevision、ack/reject 流程 |
| 驗收條件 | 每個命令有唯一 commandId；server ack 後更新 UI；rejection 時復原 UI 並通知玩家 |

### ONLINE-002：協議無版本號

| 欄位 | 內容 |
|---|---|
| ID | ONLINE-002 |
| 嚴重度 | P1 |
| 觸發條件 | 不同版本的 client/server 通訊時 |
| 玩家影響 | 版本不一致可能造成無法追蹤的同步錯誤 |
| 目前緩解 | 無 |
| 證據 | WebSocket 訊息格式未含版本欄位 |
| 後續負責 | 網路層 — 為所有訊息加入協議版本 |
| 驗收條件 | 所有線上訊息含 `protocolVersion` 欄位；伺服器可拒絕不相容版本 |

### ONLINE-003：斷線即結束對局（非風險，記錄用）

| 欄位 | 內容 |
|---|---|
| ID | ONLINE-003 |
| 嚴重度 | N/A（V1 範圍外） |
| 觸發條件 | WebSocket 連線中斷 |
| 玩家影響 | 對局立即結束（V1 確認範圍） |
| 目前緩解 | 已實作斷線結束（`useOnlineMatch`） |
| 證據 | `src/hooks/useOnlineMatch.tsx` |
| 後續負責 | Post-V1 — 重連狀態機 |
| 驗收條件 | N/A（V1 範圍內功能已完整） |

---

## UX 風險登錄

### UX-001：UI 硬編碼正體中文

| 欄位 | 內容 |
|---|---|
| ID | UX-001 |
| 嚴重度 | P2（目前目標受眾為華語使用者，但契約要求英文預設） |
| 觸發條件 | 任何玩家可見文字（模態框、按鈕、效果說明、回合階段標籤等） |
| 玩家影響 | 非正體中文使用者無法理解 UI |
| 目前緩解 | 無（所有文字為硬編碼中文） |
| 證據 | `App.tsx:68` 的 `載入畫面中…`；`src/components/gameUiLabels.ts`；`src/components/effects/effectUiUtils.ts:206` |
| 後續負責 | UI — 建立 i18n 架構及英文預設 |
| 驗收條件 | 所有玩家可見文字可切換 en / zh-Hant；英文預設 |

### UX-002：HP 逐張翻開 UI 不穩定

| 欄位 | 內容 |
|---|---|
| ID | UX-002 |
| 嚴重度 | P1 |
| 觸發條件 | 任何傷害處理過程中 |
| 玩家影響 | 無法從 UI 確定每張 HP 翻開的結果、順序與 FLIP 狀態 |
| 目前緩解 | 戰鬥紀錄（commandLog）記錄個別事件 |
| 證據 | 截圖觀察：HP 翻開過程在 UI 層無法穩定跟踪 |
| 後續負責 | UI — HP Flip Chain 視覺化（UI Lab B07） |
| 驗收條件 | 每張 HP 翻開、FLIP 判定、進棄牌區的瞬間各有一個可觀察的 UI 狀態 |

### UX-003：拖曳未實作

| 欄位 | 內容 |
|---|---|
| ID | UX-003 |
| 嚴重度 | P2（點擊已為主要操作，拖曳為輔助） |
| 觸發條件 | 嘗試拖放卡牌 |
| 玩家影響 | 無拖放快捷操作，但不影響基本可用性 |
| 目前緩解 | 點擊為主要操作方式 |
| 證據 | `App.tsx` 無拖曳事件處理 |
| 後續負責 | UI — Post-V1 拖曳輔助輸入 |
| 驗收條件 | 拖放至合法區域等同開始同一個點擊流程；拖放失敗時卡牌回到原位 |

### UX-004：五套 Theme Variant 收斂方向不明

| 欄位 | 內容 |
|---|---|
| ID | UX-004 |
| 嚴重度 | P2（U0 只盤點，不刪除） |
| 觸發條件 | 未來決定正式視覺方向時 |
| 玩家影響 | 目前使用者可選擇五套，但 UI/UX 計畫僅規畫三方向（清楚優先、沉浸優先、平衡型） |
| 目前緩解 | 五套 variant 均可獨立使用 |
| 證據 | `docs/phase1-theme-variants.md`；`src/styles/themeStorage.test.ts` |
| 後續負責 | UI — 評估收斂至三方向並設定正式預設 |
| 驗收條件 | 正式版本保留不超過三套 variant；其中一套為預設 |

---

## A11Y 風險登錄

### A11Y-001：Modal accessible name 與標籤不足

| 欄位 | 內容 |
|---|---|
| ID | A11Y-001 |
| 嚴重度 | P1 |
| 觸發條件 | 任何 modal 開啟時（Deck Editor、Test Setup、Online Room、Game Modals） |
| 玩家影響 | Screen reader 使用者無法辨識 modal 內容與角色 |
| 目前緩解 | 部分 modal 有關閉按鈕（可 Tab 導覽） |
| 證據 | `DeckEditorModal`、`TestScenarioModal` 等缺少 `aria-label`、`role="dialog"` |
| 後續負責 | UI — 為所有 modal 加入完整 ARIA 屬性 |
| 驗收條件 | 每個 modal 有 `role="dialog"`、`aria-label`；焦點在開啟時移至 modal 內、關閉時返回觸發元素 |

### A11Y-002：焦點管理不完整

| 欄位 | 內容 |
|---|---|
| ID | A11Y-002 |
| 嚴重度 | P2 |
| 觸發條件 | Modal 開啟／關閉、動態內容更新時 |
| 玩家影響 | 鍵盤使用者可能失去焦點位置 |
| 目前緩解 | 基本 Tab 導覽可用 |
| 證據 | 多數 modal 無 focus trap；關閉 modal 後焦點不返回觸發按鈕 |
| 後續負責 | UI — 加入 focus trap 與焦點歸還 |
| 驗收條件 | Modal 內焦點循環；關閉時焦點返回開啟前的元素 |

---

## ASSET 風險登錄

### ASSET-001：公共素材來源與授權

| 欄位 | 內容 |
|---|---|
| ID | ASSET-001 |
| 嚴重度 | P2（既有圖像為熱連結官方 CDN，具非商業粉絲研究例外） |
| 觸發條件 | 專案轉為公開部署或商用 |
| 玩家影響 | 法律風險 |
| 目前緩解 | `docs/ip-and-asset-policy.md` 規範非商業粉絲研究例外；footer 已加非官方聲明 |
| 證據 | `docs/ip-and-asset-policy.md` |
| 後續負責 | 素材管理 — 建立 `assets/credits.json`；公開版本使用原創或已授權圖 |
| 驗收條件 | `npm run validate:assets` 通過；所有公開圖有完整 credit metadata |

---

## DOC 風險登錄

### DOC-001：Roadmap bundle 數值已過期

| 欄位 | 內容 |
|---|---|
| ID | DOC-001 |
| 嚴重度 | P2 |
| 觸發條件 | 讀取 `docs/roadmap.md` 的 bundle 基準 |
| 玩家影響 | 無直接影響（文件參考誤差） |
| 目前緩解 | U0 已在 `current-state-audit.md` 記錄正確數值 |
| 證據 | `docs/roadmap.md:5,62` 的舊 bundle 數值 vs. 目前 736.61 / 154.03 KiB |
| 後續負責 | 文件維護 — 下次更新 roadmap 時同步修正 |
| 驗收條件 | Roadmap 的 bundle 數值與當前 build 一致 |

---

## 風險摘要

| 嚴重度 | 計數 | ID |
|---|---|---|
| P0 | 3 | RULE-001, RULE-002, RULE-003 |
| P1 | 7 | RULE-004, CMD-001, CMD-002, ONLINE-001, ONLINE-002, UX-002, A11Y-001 |
| P2 | 6 | UX-001, UX-003, UX-004, A11Y-002, ASSET-001, DOC-001 |
| N/A | 1 | ONLINE-003（V1 範圍外） |
