# U0 狀態矩陣（State Matrix）

> 建立日期：2026-07-12
> 基準 HEAD：`3d5d514`
>
> 每一列固定包含：畫面／互動節點、Current Implemented、Contract Target、Decision Class、進入條件、可用命令、取消／回退、成功／失敗回饋、本機／線上差異、實作缺口與證據。

---

## 決策等級定義

| 等級 | 定義 |
|---|---|
| Confirmed | 使用者已確認，可實作（或已實作） |
| Provisional | 合理推導，但需補強依據或標記暫定 |
| Blocking | 缺少答案會改變規則或線上安全，停止相關模組 |

---

## 1. 全域狀態

### 1.1 應用程式生命週期

| 欄位 | 內容 |
|---|---|
| Current Implemented | React `useState` 管理畫面切換（menu / deck-editor / battlefield / mockup），無路由庫 |
| Contract Target | Route lazy loading (U7)；各畫面獨立 Suspense 邊界 |
| Decision Class | Confirmed（簡潔狀態機已符合 MVP） |
| 進入條件 | App mount → LocalStorage 載入牌組 → 卡池初始化 |
| 可用命令 | 畫面切換（無 GameCommand） |
| 取消／回退 | 畫面切換無取消機制（用戶直接導航） |
| 成功／失敗回饋 | 初始化失敗顯示錯誤邊界 |
| 本機／線上差異 | 無 |
| 實作缺口 | 無路由庫（`react-router` 未使用）；部分共享 modal 的 Suspense 邊界不完整 |

---

## 2. 付款流程

### 2.1 能量支付選擇

| 欄位 | 內容 |
|---|---|
| Current Implemented | `AttackPaymentPanel` 選擇支援卡支付攻擊能量；`selectEnergyPayment()` 驗證但不建立 `PaymentDraft` 型別 |
| Contract Target | `Idle → SelectingPayment → PaymentReady → ConfirmingCommand → ServerAccepted → ResourcesRested → Resolving` |
| Decision Class | Provisional（付款狀態機尚未正式型別化，但功能可用） |
| 進入條件 | 宣告攻擊或發動需費用的技能時 |
| 可用命令 | `AttackCommand`（含 `energyPayment` 欄位）、`ActivateSkillCommand` |
| 取消／回退 | 確認前可取消與重選（依賴 React 本機狀態，無正式 `PaymentDraft` 可回溯） |
| 成功／失敗回饋 | 支付合法：資源橫置（Active→Rest）；支付不合法：顯示錯誤訊息 |
| 本機／線上差異 | 本機即時驗證；線上無 server acknowledgement（樂觀送出） |
| 實作缺口 | 1) 無 `PaymentDraft` / `PaymentState` 正式型別；2) 無 `ServerAccepted` ／ `ServerRejected` 狀態；3) 線上拒絕後資源復原未實作 |

### 2.2 攻擊宣告與回應

| 欄位 | 內容 |
|---|---|
| Current Implemented | `beginAttack()` 建立 `PendingBattle` → `PendingBattleStage`（trap → block → attack → damage → faint）；`resolveBattleAutomatically()` 處理無回應的流程 |
| Contract Target | 明確回應節點：攻擊宣告後有 Trap／Blocker 回應窗；自動化解決不可跳過回應 |
| Decision Class | Confirmed（基本流程已實作，但缺少線上 Priority Pause 呈現） |
| 進入條件 | 玩家宣告 AttackCommand，目標合法且費用支付完畢 |
| 可用命令 | `PlayTrapCommand`、`SkipTrapCommand`、`PlayBlockerCommand`、`ResolveBattleCommand` |
| 取消／回退 | 攻擊宣告前可取消（不送出 AttackCommand）；送出後不可取消 |
| 成功／失敗回饋 | Trap 發動成功顯示效果；Block 成功顯示阻擋者；攻擊傷害逐張處理（部分） |
| 本機／線上差異 | 本機：AI 自動處理 Trap/Blocker 回應；線上：等待遠端玩家操作 |
| 實作缺口 | 線上模式缺少回應倒數計時與 Priority Pause UI |

---

## 3. 選擇目標

### 3.1 多目標效果

| 欄位 | 內容 |
|---|---|
| Current Implemented | `PendingEffectOrder` 型別存在（`kind: 'on-play'`），由 `PendingDecision` 機制處理；效果目標透過 `selectEffectTargets()` 選取 |
| Contract Target | `OrderedTargetSelection` 含 `orderedTargetIds`；宣告時一次選定；逐目標結算；每個目標後檢查 FLIP 與敗北 |
| Decision Class | Provisional / Blocking（多目標順序的正式權威待官方確認） |
| 進入條件 | 效果宣告時，由 `selectEffectTargets()` 或 UI modal 收集目標 |
| 可用命令 | `ResolveEffectOrderCommand` |
| 取消／回退 | 目標選擇階段可取消（不送出命令） |
| 成功／失敗回饋 | 目標選擇完成後進入效果結算；目標不合法時回傳錯誤 |
| 本機／線上差異 | 本機：AI 自動選擇目標；線上：等待玩家選擇 |
| 實作缺口 | 1) 無正式 `orderedTargetIds` 型別與欄位；2) 逐目標結算流程不完整；3) 目標順序權威為 Blocking（待官方來源） |

### 3.2 效果目標選擇

| 欄位 | 內容 |
|---|---|
| Current Implemented | EffectPanel 顯示可選目標；`selectEffectTargets()` 驗證合法性；各效果型別有對應 `getXxxCandidates()` |
| Contract Target | 合法目標高亮、非法目標灰底；選取確認前顯示完整效果資訊 |
| Decision Class | Confirmed（基本功能已實作） |
| 進入條件 | PendingDecision modal 開啟時 |
| 可用命令 | 依效果種類而定（如 `ResolveFaintEffectCommand`） |
| 取消／回退 | Modal 關閉時取消 |
| 成功／失敗回饋 | 目標選取後顯示確認；非法目標不回應點擊 |
| 本機／線上差異 | 無（AI 不參與目標選擇的 visual 呈現） |
| 實作缺口 | 非法目標缺少明確的文字回饋（為什麼不可選） |

---

## 4. HP 處理

### 4.1 HP 逐張翻開

| 欄位 | 內容 |
|---|---|
| Current Implemented | `resolveNextDamage()` 逐張處理攻擊傷害；`resolveFlip()` 處理 FLIP 翻開 |
| Contract Target | 每張 HP 翻開後顯示內容、檢查 FLIP、處理回應、檢查敗北；不可批次合併 |
| Decision Class | Blocking（效果傷害尚未逐張處理；FLIP 處理後的敗北檢查時機不符契約） |
| 進入條件 | 攻擊傷害階段或效果傷害執行 |
| 可用命令 | `ResolveNextDamageCommand`、`ResolveFlipCommand` |
| 取消／回退 | 不可取消（傷害已發生） |
| 成功／失敗回饋 | 攻擊傷害有逐張處理流程（但 UI 無法穩定呈現）；效果傷害可能批次移除 |
| 本機／線上差異 | 無 |
| 實作缺口 | 1) 效果傷害不強制逐張翻開；2) 每張 HP 後的敗北檢查時機錯誤（等全部 blocking pending 結束而非立即）；3) UI 無法穩定呈現逐張翻開過程 |

### 4.2 FLIP 插入處理

| 欄位 | 內容 |
|---|---|
| Current Implemented | `resolveFlip()` 處理 FLIP 卡翻開；`battle-pending-flip.test.ts` 有 9 個測試 |
| Contract Target | FLIP 在傷害處理中立即觸發並暫停原結算；必要回應完成後才繼續 |
| Decision Class | Confirmed（FLIP 觸發機制已實作，但需與改正後的敗北時機整合） |
| 進入條件 | HP 卡翻開後檢查 FLIP 屬性 |
| 可用命令 | `ResolveFlipCommand` |
| 取消／回退 | 不可取消 |
| 成功／失敗回饋 | FLIP 效果執行後顯示結果；非 FLIP 卡立即進棄牌區 |
| 本機／線上差異 | 無 |
| 實作缺口 | FLIP 插入後的敗北檢查時機需修正（見 4.1） |

---

## 5. 戰鬥區補位

### 5.1 補位決策

| 欄位 | 內容 |
|---|---|
| Current Implemented | `recordCookieDepartures()` 記錄離場數量；`replaceDefeatedCookie()` 補位單張；`skipDefeatedCookieReplacement()` 跳過補位 |
| Contract Target | 可補 0 至離場數量；只有手牌無可登場餅乾時才敗北 |
| Decision Class | Confirmed（補位流程已實作，21 個測試 `battle-optional-cost-attack.test.ts` 覆蓋） |
| 進入條件 | 餅乾離場（昏厥）後，`departedCookieCounts[playerId] > 0` |
| 可用命令 | `ReplaceCookieCommand`、`SkipReplacementCommand` |
| 取消／回退 | 補位選擇可變更（在確認前） |
| 成功／失敗回饋 | 餅乾登場顯示 On-Play 效果提示；跳過補位顯示跳過動畫 |
| 本機／線上差異 | 線上：需等待遠端玩家選擇；無回應逾時規則 |
| 實作缺口 | 線上模式補位逾時規則為 Blocking（見 `product-decisions.md`） |

---

## 6. Refresh 流程

### 6.1 Refresh 懲罰選擇

| 欄位 | 內容 |
|---|---|
| Current Implemented | `getRefreshCandidates()` 取得可放入休息區的餅乾；`refreshDeck()` 執行刷新 |
| Contract Target | 刷新時需選擇休息區餅乾（公開資訊）；懲罰後重建牌組；Break Level Sum 常駐更新 |
| Decision Class | Confirmed（Refresh 流程已實作，`refresh.test.ts` 覆蓋） |
| 進入條件 | `pendingRefresh` 不為 null（牌庫歸零時觸發） |
| 可用命令 | `RefreshDeckCommand`（含 `shuffleSeed`） |
| 取消／回退 | 不可取消（規則強制性） |
| 成功／失敗回饋 | 休息區 Level Sum 更新；牌庫重建；UI 顯示 Refresh 動畫 |
| 本機／線上差異 | 無 |
| 實作缺口 | UI 呈現 Refresh 過程的視覺化可加強（目前以 Toast 通知為主） |

---

## 7. 支援區與場景

### 7.1 支援卡放置

| 欄位 | 內容 |
|---|---|
| Current Implemented | `placeSupportCard()` 於主要階段放置支援卡；每回合限制 1 張（由階段管理） |
| Contract Target | 每回合僅限制一般放置 1 張；卡牌效果不消耗一般放置次數 |
| Decision Class | Confirmed（已實作且測試覆蓋） |
| 進入條件 | 主要階段，手牌有可放置的支援卡 |
| 可用命令 | `PlaceSupportCommand` |
| 取消／回退 | 不可取消（放置後即生效） |
| 成功／失敗回饋 | 支援卡進入支援區後 Active；超出回合限制時顯示錯誤 |
| 本機／線上差異 | 無 |
| 實作缺口 | 大量支援卡的 UI 呈現（壓縮顯示）未實作 |

### 7.2 場景替換

| 欄位 | 內容 |
|---|---|
| Current Implemented | `playStage()` 支付費用後放置場景；`activateStage()` 發動場景效果；替換時舊場景進棄牌區 |
| Contract Target | 支付新場景費用後，舊場景進棄牌區，再放置新場景 |
| Decision Class | Confirmed（已實作） |
| 進入條件 | 主要階段，手牌有可放置的場景卡 |
| 可用命令 | `PlayStageCommand`、`ActivateStageCommand` |
| 取消／回退 | 不可取消 |
| 成功／失敗回饋 | 舊場景送棄牌區；新場景顯示於場景區 |
| 本機／線上差異 | 無 |
| 實作缺口 | 雙方場景同時存在時的來源區分可加強（如 hover 顯示所有者） |

---

## 8. 線上命令

### 8.1 Command Rejection 呈現

| 欄位 | 內容 |
|---|---|
| Current Implemented | 樂觀送出（`useOnlineMatch`）；無命令 ID、無狀態 revision、無 server acknowledgement |
| Contract Target | 命令 ID、狀態 revision、server 接受確認、rejection 原因與復原 |
| Decision Class | Provisional（線上協議尚未完整版） |
| 進入條件 | 玩家在線上對局中送出 GameCommand |
| 可用命令 | 所有 GameCommand type（透過 WebSocket JSON） |
| 取消／回退 | 無（樂觀送出後無撤回機制） |
| 成功／失敗回饋 | 成功：畫面更新（來自 server 廣播）；失敗：無特定 rejection UI |
| 本機／線上差異 | 僅線上模式有此需求 |
| 實作缺口 | 1) 無命令 ID；2) 無狀態 revision；3) 無 server acknowledgement；4) 無 rejection 復原邏輯 |

### 8.2 斷線結束

| 欄位 | 內容 |
|---|---|
| Current Implemented | V1 斷線即結束對局；`useOnlineMatch` 有 disconnect 處理 |
| Contract Target | V1 不提供自動重連；斷線結束對局 |
| Decision Class | Confirmed（V1 範圍內） |
| 進入條件 | WebSocket close/error 事件 |
| 可用命令 | 無（對局已結束） |
| 取消／回退 | 不可取消 |
| 成功／失敗回饋 | 顯示斷線畫面 |
| 本機／線上差異 | 僅線上模式 |
| 實作缺口 | Post-V1：重連狀態機（Provisioned 但非 V1 阻塞） |

---

## 9. 錯誤復原

### 9.1 全域錯誤邊界

| 欄位 | 內容 |
|---|---|
| Current Implemented | `GameErrorBoundary`（`src/components/errors/GameErrorBoundary.test.tsx` 有 4 個測試） |
| Contract Target | 錯誤發生時顯示可理解的錯誤訊息，提供重試或回主選單 |
| Decision Class | Confirmed（基本錯誤邊界已實作） |
| 進入條件 | 任何未捕捉的 React 錯誤 |
| 可用命令 | 無（UI 層錯誤） |
| 取消／回退 | 返回主選單 |
| 成功／失敗回饋 | 顯示錯誤訊息與復原按鈕 |
| 本機／線上差異 | 無 |
| 實作缺口 | 部分 lazy loaded modal 的 Suspense 邊界不完整 |

---

## 10. 特殊註記

### 10.1 自由優先權系統

目前只有多種具名 pending state（`pendingReplacement`、`pendingOnPlay`、`pendingRefresh`、`pendingBattle`、`pendingFaintEffects` 等），並非一般化自由優先權系統（priority system）。這是目前設計的**實作選擇**而非缺陷——每種 pending 對應一個特定規則時機，而非通用的 priority pass。

### 10.2 Pending 狀態列表

`src/game/pending.ts` 定義的 blocking pending 類型：

| Pending 欄位 | 觸發時機 |
|---|---|
| `pendingReplacement` | 戰鬥區餅乾離場後需補位 |
| `pendingOnPlay` | On-Play 效果排隊（`PendingEffectOrder`） |
| `pendingRefresh` | 牌庫歸零需刷新 |
| `pendingBattle` | 攻擊進行中（`PendingBattle`） |
| `pendingAbilityEffect` | 卡牌能力效果進行中 |
| `pendingFaintEffects` | 昏厥效果排隊 |
| `pendingAfterDamageEffects` | 攻擊後效果排隊 |
| `pendingOpponentHandDiscard` | 對手棄牌效果 |
| `pendingInspectDeck` | 查看牌庫效果 |
| `pendingOptionalCostAttack` | 可選費用的攻擊 |
| `pendingDrawUpTo` | 抽牌至特定張數效果 |
| `pendingStageTrigger` | 場景觸發效果 |
