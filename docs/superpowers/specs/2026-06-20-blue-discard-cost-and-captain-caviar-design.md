# BLUE Starter Deck 棄手牌代價與 Captain Caviar Cookie 設計

> 日期：2026-06-20
> 狀態：設計規格（待實作）
> 範圍：ST4-012 Werewolf Cookie、ST4-013 Captain Caviar Cookie

---

## 1. 目標

### 1.1 ST4-012 Werewolf Cookie — 啟動技能棄手牌

- ST4-012 Werewolf Cookie 的啟動技能（`trigger: 'activate'`）代價為 `cost: { energy: {}, discardHand: 1 }`，`oncePerTurn: true`，`restSource: false`。發動時必須棄掉自己 1 張手牌，無能量費用、不橫置來源。
- 手牌數量不足時（`hand.length < cost.discardHand`），`canActivateCookieSkill` 必須回傳 `false`，不可發動。
- 點啟動技能時，只在 React UI 建立**既有 PendingEffect 暫存**（`selectedPaymentIds`、`selectedDiscardHandIds`、`selectedCostSupportToTrashIds`、`selectedTargetIds`、`pendingEffect`），尚未呼叫規則層付款，`GameState` 完全不變。
- 在確認付款前，玩家可取消並**清除 UI 暫存**：`selectedPaymentIds`、`selectedDiscardHandIds`、`selectedCostSupportToTrashIds`、`selectedTargetIds` 與 `pendingEffect` 全部歸零，`GameState` 完全不變。
- 確認付款後，呼叫擴充後的 `activateCookieSkill`，傳入 `discardHandIds`，由規則層原子驗證與支付所有代價、一次性結算效果，**不可取消**。

### 1.2 ST4-013 Captain Caviar Cookie — 攻擊後續可選代價效果

- ST4-013 的 `attackEffects` 為**可選代價效果**：攻擊正常結算（傷害、FLIP、陷阱等）完成後，玩家可選擇：
  - **略過**：不支付代價，不造成額外效果，直接結束戰鬥。
  - **支付**：棄自己 2 張手牌（`discardHand: 2`），然後必須選 1 個對手餅乾造成 1 點傷害。
- 手牌不足 2 張時，只能略過，不可選擇支付。
- 支付後必須選 1 個對手戰鬥區餅乾為傷害目標；若對手戰鬥區無餅乾，則只能略過。

### 1.3 ST4-013 Captain Caviar Cookie — OnPlay 檢視牌庫頂

- ST4-013 登場時（`trigger: 'on-play'`）：查看牌庫頂 3 張牌。
- 玩家**必須**從中選 1 張加入手牌。
- 剩餘牌由玩家自行排序後放回牌庫底。
- 牌庫不足 3 張時：取完現有牌，觸發既有 `refreshDeck` 流程；Refresh 後繼續補足至 3 張，再重複上述選牌與排序流程。
- 牌庫原本為空時：同樣先觸發 Refresh，再補足至 3 張。
- Refresh 導致遊戲結束（棄牌區無 LV1+ 餅乾）則立即停止，不再繼續 OnPlay 流程。

### 1.4 通用規則模型

本設計採用通用抽象，不為特定卡號硬編碼邏輯：

| 通用機制 | 說明 |
|---|---|
| `AbilityCost.discardHand` | 既有欄位，已支援技能代價、FLIP 代價、陷阱代價。本次擴充至攻擊後續代價效果。 |
| 攻擊後續可選代價效果 | 新增 `OptionalCostAttackEffect` 型別，內含 `cost: AbilityCost`、`effects: CardEffect[]`、`optional: true` 標記。 |
| `inspect-deck` 效果 | 新增 `CardEffect` 成員 `{ kind: 'inspect-deck', lookCount: number, pickCount: number, restToBottom: true }`，搭配 typed pending decision/command。 |
| Typed pending decision/command | 擴充 `PendingDecision` union 與 `GameCommand` union，新增 `inspect-deck`、`optional-cost-attack` 等決策種類。`skill-payment` 不加入 typed decision/command，僅使用既有 React UI 暫存。 |
| AI 固定策略 | AI 對 `inspect-deck` 固定選第一張入手、其餘維持原始順序置底；對可選代價效果依既有策略判斷是否支付。 |

### 1.5 UI 互動

- **手牌代價選擇**：玩家點擊手牌高亮選取，滿足以後可確認或取消。
- **攻擊後支付或略過**：出現「支付」與「略過」兩個按鈕；支付需先選手牌再確認。
- **登場選牌與排序**：展示檢視中的牌（正面朝上），玩家可點選 1 張入手；剩餘牌可透過「上移」「下移」按鈕調整順序，最後「確認放回」。

---

## 2. 非目標

- **不硬編碼卡號於規則引擎或 UI**：所有邏輯以通用 `CardEffect`、`AbilityCost`、`PendingDecision` 驅動。`official-effect-adapter.ts` 負責將 ST4-012／ST4-013 的官方文字轉為通用效果，規則層與 UI 層不感知特定卡號。
- **不允許 React 直接修改 GameState**：所有狀態變更仍須透過 `src/game/` 純函式。UI 只能讀取 `getPendingDecision` 回傳的決策並發送 `GameCommand`。
- **不擴充其他未要求卡牌**：本次僅處理 ST4-012 與 ST4-013 的效果。其他 BLUE 卡牌或未來 Starter Deck 卡牌的效果另案處理。
- **不修改既有 Refresh 核心邏輯**：`refreshDeck` 函式保持不變，`inspect-deck` 效果在牌庫不足時呼叫既有 `refreshDeck` 並接續流程。
- **不新增拖曳排序**：排序以按鈕（上移／下移）完成，不實作 drag-and-drop。

---

## 3. 型別設計

### 3.1 新增 `CardEffect` 成員

```typescript
// src/game/types.ts

export interface InspectDeckEffect {
  kind: 'inspect-deck'
  lookCount: number    // 查看張數（ST4-013 = 3）
  pickCount: number    // 必須選取加入手牌的張數（ST4-013 = 1）
  restToBottom: true   // 剩餘牌放回牌庫底
}

export interface OptionalCostAttackEffect {
  kind: 'optional-cost-attack'
  cost: AbilityCost           // 代價（ST4-013 = { energy: {}, discardHand: 2 }）
  effects: CardEffect[]       // 支付後執行的效果（ST4-013 = [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } }]）
  effectText: string          // 官方效果文字
}
```

將兩者加入 `CardEffect` union type。

### 3.2 新增 `PendingDecision` 與 `GameCommand`

```typescript
// src/game/commands.ts

// --- inspect-deck ---
export interface InspectDeckDecision {
  kind: 'inspect-deck'
  playerId: PlayerId
  sourceInstanceId: string
  sourceCardName: string
  lookCount: number
  pickCount: number
  revealedCardIds: string[]   // 檢視中的卡牌 instanceId 列表
}

export interface ResolveInspectDeckCommand {
  kind: 'resolve-inspect-deck'
  playerId: PlayerId
  pickedCardId: string        // 選取加入手牌的 instanceId
  restOrder: string[]         // 剩餘牌放回牌庫底的 instanceId 排序
}

// --- optional-cost-attack ---
export interface OptionalCostAttackDecision {
  kind: 'optional-cost-attack'
  playerId: PlayerId
  sourceInstanceId: string
  sourceCardName: string
  cost: AbilityCost
  effects: CardEffect[]
  effectText: string
}

export interface ResolveOptionalCostAttackCommand {
  kind: 'resolve-optional-cost-attack'
  playerId: PlayerId
  action: 'skip' | 'pay'
  discardCardIds?: string[]   // action = 'pay' 時必填
  targetIds?: string[]        // action = 'pay' 時，effects 的目標選取
}

```

擴充 `PendingDecision` 與 `GameCommand` union type。

> 注意：技能啟動的取消流程不使用 typed decision/command，僅在 React UI 層以既有 `pendingEffect` 暫存管理。確認時直接呼叫擴充後的 `activateCookieSkill`，傳入 `discardHandIds` 等付款資訊。

### 3.3 `GameState` 擴充

```typescript
// src/game/types.ts — GameState 新增欄位

export interface GameState {
  // ... 既有欄位 ...

  // inspect-deck pending
  pendingInspectDeck?: {
    playerId: PlayerId
    sourceInstanceId: string
    sourceCardName: string
    revealedCards: GameCard[]   // 檢視中的牌（正面）
    pickCount: number
  } | null

  // 攻擊後續可選代價 pending
  pendingOptionalCostAttack?: {
    playerId: PlayerId
    sourceInstanceId: string
    sourceCardName: string
    cost: AbilityCost
    effects: CardEffect[]
    effectText: string
  } | null
}
```

---

## 4. 規則層實作

### 4.1 ST4-012 啟動技能 — 棄手牌代價

#### 4.1.1 `canActivateCookieSkill` 擴充

在 `src/game/skills.ts` 的 `canActivateCookieSkill` 中新增手牌數量檢查：

```
if (skill.cost.discardHand > 0 && player.hand.length < skill.cost.discardHand) {
  return false
}
```

此檢查位於能量支付與支援代價檢查之後，確保所有代價皆可支付才可發動。

#### 4.1.2 UI 暫存與確認流程

技能啟動的取消流程完全不涉及 `GameState` 變更，也不新增 `startSkillPayment` 或 `resolveSkillPayment` 函式。

**點技能時（UI 層）**

- React UI 建立既有 `pendingEffect` 暫存，記錄 `sourceInstanceId`、`cost`、`effects`。
- 玩家可選取能量支付（`selectedPaymentIds`）、棄手牌（`selectedDiscardHandIds`）、支援代價（`selectedCostSupportToTrashIds`）、效果目標（`selectedTargetIds`）。
- `GameState` 完全不變。

**取消（UI 層）**

- 清除 `selectedPaymentIds`、`selectedDiscardHandIds`、`selectedCostSupportToTrashIds`、`selectedTargetIds` 與 `pendingEffect`。
- `GameState` 完全不變。

**確認（呼叫規則層）**

- 呼叫擴充後的 `activateCookieSkill`，傳入 `playerId`、`sourceInstanceId`、`energyPaymentIds`、`discardHandIds`、`costSupportToTrashIds`、`effectTargetIds`。
- 規則層原子驗證與支付：
  1. 驗證 `canActivateCookieSkill`（含手牌數量檢查）。
  2. 驗證 `energyPaymentIds` 合法（`validateEnergyPayment`）。
  3. 驗證 `discardHandIds` 數量與所有權（`player.hand` 內、無重複、數量 = `cost.discardHand`）。
  4. 驗證 `costSupportToTrashIds` 合法。
  5. 一次性扣除所有代價（能量休息、手牌棄置、支援送棄牌區）。
  6. 執行技能效果。
- 確認後不可取消。

### 4.2 ST4-013 攻擊後續 — 可選代價效果

#### 4.2.1 攻擊流程整合

在 `src/game/battle.ts` 的 `resolveAttackEffect` 中，當遇到 `kind: 'optional-cost-attack'` 效果時：

1. 檢查玩家手牌是否足夠支付 `cost.discardHand`。
2. 若不足：自動略過，進入下一個 attack effect 或 `finishBattle`。
3. 若足夠：建立 `pendingOptionalCostAttack`，等待玩家決策。

#### 4.2.2 玩家決策

- **略過**（`action: 'skip'`）：清除 pending，進入下一個 attack effect 或 `finishBattle`。
- **支付**（`action: 'pay'`）：
  1. 驗證 `discardCardIds` 數量與所有權。
  2. 一次性棄手牌。
  3. 驗證 `targetIds` 為對手戰鬥區餅乾（合法目標）。
  4. 執行 `effects`（造成 1 傷害）。
  5. 清除 pending，進入下一個 attack effect 或 `finishBattle`。

### 4.3 ST4-013 OnPlay — 檢視牌庫頂

#### 4.3.1 效果執行

在 `src/game/effects.ts` 中新增 `inspect-deck` 效果處理：

1. 從 `player.deck` 頂端取 `lookCount` 張（或全部，若不足）。
2. 若牌庫原本為空或取牌後牌庫為空且仍有待補足：
   - 觸發 `refreshDeck`（既有流程）。
   - Refresh 導致遊戲結束 → 立即回傳，停止 OnPlay 流程。
   - Refresh 完成後，從新牌庫頂補足至 `lookCount` 張。
3. 建立 `pendingInspectDeck`，展示 `revealedCards`。

#### 4.3.2 Refresh 續接

```
牌庫頂取牌 → 不足 → refreshDeck → 補足 → 建立 pendingInspectDeck
                                    ↓ 遊戲結束
                                  停止
```

- `pendingInspectDeck` 建立時，已檢視的牌記錄在 `revealedCards` 中，不回到牌庫。
- 玩家選 1 張入手後，剩餘牌依 `restOrder` 排序放回牌庫底。

#### 4.3.3 規則層驗證

`resolveInspectDeck` 函式必須驗證：

1. **重複 ID**：`pickedCardId` 與 `restOrder` 無重複。
2. **所有權**：所有 ID 必須在 `revealedCards` 中。
3. **張數**：`restOrder.length + 1 === revealedCards.length`（必須選 1 張）。
4. **遺漏**：`pickedCardId` 與 `restOrder` 的聯集必須等於 `revealedCards` 的全部 ID。
5. **夾帶**：`restOrder` 不得包含非檢視牌的 ID。
6. **排序完整性**：`restOrder` 必須包含除 `pickedCardId` 外的所有檢視牌。

---

## 5. 轉接層

### 5.1 `official-effect-adapter.ts`

更新 ST4-013 的 OnPlay 效果映射：

```typescript
// 取代既有 'ST4-013': [{ kind: 'draw', amount: 1 }]
'ST4-013': [
  { kind: 'inspect-deck', lookCount: 3, pickCount: 1, restToBottom: true },
],
```

ST4-013 的攻擊後續效果需在 `official-card-adapter.ts` 中映射 `attackEffects`：

```typescript
// ST4-013 attackEffects
attackEffects: [
  {
    kind: 'optional-cost-attack',
    cost: { energy: {}, discardHand: 2 },
    effects: [
      { kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } },
    ],
    effectText: 'Discard 2 cards from your hand to deal 1 damage to 1 opponent cookie.',
  },
],
```

ST4-012 的技能在 `official-card-adapter.ts` 中映射：

```typescript
// ST4-012 skill
// 官方文字：{mob} {t1} 🂠Discard 1 card.🂡During this turn, this Cookie gains +1 attack damage.
skill: {
  trigger: 'activate',
  oncePerTurn: true,
  yourTurn: false,
  restSource: false,
  cost: { energy: {}, discardHand: 1 },
  effects: [
    { kind: 'gain-attack-damage', amount: 1, duration: 'this-turn', target: 'self' },
  ],
  text: 'Discard 1 card. During this turn, this Cookie gains +1 attack damage.',
},
```

### 5.2 `official-text-parser.ts`

若官方文字包含棄手牌代價標記，確認解析邏輯正確映射至 `discardHand` 欄位。目前 `discardHand` 已在 `AbilityCost` 中定義，轉接層已有處理先例（如 ST4-020 Octo-Ink Spray 的 `discardHand: 2`）。

---

## 6. AI 決策

### 6.1 `inspect-deck` AI 策略

在 `src/game/ai.ts` 中：

- 固定選 `revealedCards[0]`（第一張）加入手牌。
- 剩餘牌維持原始順序（`revealedCards[1], revealedCards[2], ...`）放回牌庫底。
- 此策略為 deterministic，確保測試可重現。

### 6.2 `optional-cost-attack` AI 策略

- 若手牌 >= 2 且對手戰鬥區有餅乾：支付（棄前 2 張手牌），選對手第一隻餅乾為目標。
- 否則：略過。

### 6.3 技能啟動 AI 策略

- AI 直接以擴充後的 `activateCookieSkill` 一次性完成（既有路徑），傳入 `discardHandIds` 等付款資訊。
- 若 `canActivateCookieSkill` 回傳 `false`（含手牌不足），AI 不嘗試發動。

---

## 7. TDD 測試計畫

### 7.1 轉接層測試

| 測試 | 檔案 |
|---|---|
| ST4-012 技能包含 `cost.discardHand: 1`、`trigger: 'activate'` | `starter-deck.test.ts` |
| ST4-013 OnPlay 為 `inspect-deck` 效果 | `starter-deck.test.ts` |
| ST4-013 `attackEffects` 包含 `optional-cost-attack` | `starter-deck.test.ts` |
| BLUE Starter Deck 仍為 22 卡號、60 張 | `starter-deck.test.ts` |

### 7.2 規則層測試

| 測試 | 檔案 |
|---|---|
| `canActivateCookieSkill` 手牌不足時回傳 `false` | `skills.test.ts` |
| `activateCookieSkill` 傳入 `discardHandIds` 扣除代價、執行效果 | `skills.test.ts` |
| `activateCookieSkill` 棄手牌數量不足時拋出 `GameRuleError` | `skills.test.ts` |
| `optional-cost-attack` 略過路徑 | `battle-attack-effect.test.ts` |
| `optional-cost-attack` 支付路徑（棄 2 張 + 傷害 1） | `battle-attack-effect.test.ts` |
| `optional-cost-attack` 手牌不足只能略過 | `battle-attack-effect.test.ts` |
| `optional-cost-attack` 對手無餅乾只能略過 | `battle-attack-effect.test.ts` |
| `inspect-deck` 正常 3 張：選 1 張入手、2 張排序置底 | `effects-inspect-deck.test.ts`（新檔） |
| `inspect-deck` 牌庫不足 3 張：取完 → Refresh → 補足 | `effects-inspect-deck.test.ts` |
| `inspect-deck` 牌庫為空：Refresh → 補足 | `effects-inspect-deck.test.ts` |
| `inspect-deck` Refresh 導致遊戲結束：停止 | `effects-inspect-deck.test.ts` |
| 驗證重複 ID 拒絕 | `effects-inspect-deck.test.ts` |
| 驗證所有權（非檢視牌 ID）拒絕 | `effects-inspect-deck.test.ts` |
| 驗證張數不符拒絕 | `effects-inspect-deck.test.ts` |
| 驗證排序遺漏／夾帶拒絕 | `effects-inspect-deck.test.ts` |

### 7.3 `commands.ts` 測試

| 測試 | 檔案 |
|---|---|
| `getPendingDecision` 正確辨識 `inspect-deck`、`optional-cost-attack` | `commands.test.ts` |
| `applyGameCommand` 正確分派至對應 resolve 函式 | `commands.test.ts` |
| 指令種類與 pending 不匹配時拋出 `GameRuleError` | `commands.test.ts` |
| 非決策玩家發送指令時拋出 `GameRuleError` | `commands.test.ts` |
| 輸入 state 不可變 | `commands.test.ts` |

### 7.4 AI deterministic 測試

| 測試 | 檔案 |
|---|---|
| AI 對 `inspect-deck` 固定選第一張 | `ai.test.ts` |
| AI 對 `optional-cost-attack` 手牌足夠時支付 | `ai.test.ts` |
| AI 對 `optional-cost-attack` 手牌不足時略過 | `ai.test.ts` |
| AI 不嘗試發動手牌不足的 activate 技能 | `ai-turn-decision.test.ts` |

### 7.5 UI 測試（Playwright）

| 測試 | 說明 |
|---|---|
| 合法路徑：點 ST4-012 技能 → 選 1 張手牌 → 確認 → 效果結算 | 手牌減少、能量支付正確 |
| 不合法路徑：ST4-012 手牌不足 → 技能按鈕不可點 | 無 pending 建立 |
| 取消路徑：點 ST4-012 技能 → 選能量與手牌 → 取消 → 狀態完全不變 | 手牌、能量、支援區不變 |
| 合法路徑：ST4-013 攻擊 → 支付 2 張手牌 → 選對手餅乾 → 傷害 1 | 手牌減少、對手 HP 減少 |
| 略過路徑：ST4-013 攻擊 → 略過 → 無效果 | 手牌不變 |
| 手牌不足路徑：ST4-013 攻擊 → 只有「略過」可選 | 支付按鈕不可點或隱藏 |
| OnPlay 合法路徑：ST4-013 登場 → 檢視 3 張 → 選 1 張 → 排序剩餘 → 確認 | 手牌 +1、牌庫底排序正確 |
| OnPlay Refresh 路徑：牌庫不足 → Refresh → 補足 → 繼續選牌 | 無中斷、無錯誤 |

### 7.6 驗證指令

完成實作後依序執行：

```
npm test
npm run lint
npm run build
npm run test:ai:browser
```

全部通過後，同步更新 `AGENTS.md` 的測試總數與 `README.md` 的目前進度。

---

## 8. 實作順序

1. **型別定義**：`types.ts` 新增 `InspectDeckEffect`、`OptionalCostAttackEffect`；`GameState` 新增 2 個 pending 欄位（`pendingInspectDeck`、`pendingOptionalCostAttack`）。
2. **轉接層**：`official-effect-adapter.ts`、`official-card-adapter.ts` 更新 ST4-012／ST4-013 映射。
3. **規則層 — 技能棄手牌**：`skills.ts` 擴充 `canActivateCookieSkill`（含手牌數量檢查）、擴充 `activateCookieSkill` 接受 `discardHandIds` 參數並原子驗證與支付。
4. **規則層 — 攻擊後續可選代價**：`battle.ts` 擴充 `resolveAttackEffect`、新增 `resolveOptionalCostAttack`。
5. **規則層 — inspect-deck**：`effects.ts` 新增 `inspect-deck` 處理、`resolveInspectDeck`。
6. **commands.ts**：擴充 `PendingDecision`、`GameCommand`、`getPendingDecision`、`applyGameCommand`（僅 `inspect-deck`、`optional-cost-attack`）。
7. **AI**：`ai.ts` 新增 2 種決策處理（`inspect-deck`、`optional-cost-attack`）；技能啟動以擴充後的 `activateCookieSkill` 直接處理。
8. **UI**：`App.tsx` 新增手牌代價選擇（既有 `pendingEffect` 暫存）、攻擊後支付/略過、登場選牌排序。
9. **測試**：依第 7 節測試計畫逐步實作。
10. **文件**：更新 `docs/game-rules.md`、`docs/card-effects.md`、`AGENTS.md`、`README.md`。

---

## 9. 風險與待確認

| 項目 | 狀態 | 說明 |
|---|---|---|
| ST4-012 技能效果 | [已確認] | 官方文字（`official-starter-deck-blue.en.json`）：`{mob} {t1} 🂠Discard 1 card.🂡During this turn, this Cookie gains +1 attack damage.`。`cost: { energy: {}, discardHand: 1 }`、`oncePerTurn: true`、`restSource: false`。無能量費用、不橫置來源。 |
| ST4-013 攻擊後續效果 | [已確認] | 官方文字（`official-starter-deck-blue.en.json`）：`🂠{B}🂡Deals 1 damage. Then, 🂠discard 2 cards.🂡Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage.`。`optional-cost-attack` 的 `cost: { energy: {}, discardHand: 2 }`（`{B}` 為攻擊費用，非可選代價效果費用）+ 1 傷害。 |
| ST4-013 OnPlay 檢視張數 | [已確認] | 官方文字（`official-starter-deck-blue.en.json`）：`{ap} View the top 3 cards of your deck; you can draw 1 of them to your hand. Then, place the remaining cards at the bottom of your deck in any order.` |
| inspect-deck 是否為通用效果 | [暫定] | 本設計定義為通用 `inspect-deck` 效果，未來其他卡牌可共用。若官方規則對不同卡牌有不同檢視規則（如可選多張），需再擴充。 |
