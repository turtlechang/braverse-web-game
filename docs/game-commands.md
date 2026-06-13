# Game Commands 統一決策介面（Pilot）

> **狀態：Pilot（小範圍試行）**
>
> 本模組僅針對 `faint-effect` 與 `opponent-hand-discard` 兩種玩家決策提供統一介面，
> **不是 event bus**，也不代表 `pendingBattle`、`pendingReplacement`、`pendingRefresh`、
> `pendingOnPlay` 或其他 pending 狀態已統一。

## 設計目標

- 提供單一純函式入口 `getPendingDecision(state)` 回傳目前待處理的決策資訊。
- 提供單一純函式入口 `applyGameCommand(state, command)` 執行決策結果。
- 不複製規則實作；內部委派至既有的 `resolveFaintEffect` / `resolveOpponentHandDiscard`。
- 保留所有既有公開 API，舊呼叫路徑不受影響。

## 型別

### `PendingDecision`

Discriminated union，目前僅含兩種決策：

```ts
interface FaintEffectDecision {
  kind: 'faint-effect'
  playerId: PlayerId          // 需選擇目標的玩家（= sourcePlayerId）
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  min: number                 // 最少需選目標數
  max: number                 // 最多可選目標數
}

interface OpponentHandDiscardDecision {
  kind: 'opponent-hand-discard'
  playerId: PlayerId          // 需棄牌的玩家
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  sourceCardName: string
  effectText: string
  count: number               // 需棄置張數
}

type PendingDecision = FaintEffectDecision | OpponentHandDiscardDecision
```

### `GameCommand`

Discriminated union，目前僅含兩種指令：

```ts
interface ResolveFaintEffectCommand {
  kind: 'resolve-faint-effect'
  playerId: PlayerId
  targetIds: string[]         // 選擇的目標 instanceId（可為空陣列略過）
}

interface ResolveOpponentHandDiscardCommand {
  kind: 'resolve-opponent-hand-discard'
  playerId: PlayerId
  cardIds: string[]           // 選擇棄置的手牌 instanceId
}

type GameCommand = ResolveFaintEffectCommand | ResolveOpponentHandDiscardCommand
```

## 函式

### `getPendingDecision(state: GameState): PendingDecision | null`

- 優先檢查 `pendingFaintEffects` 佇列（非空時優先回傳 faint 決策）。
- 其次檢查 `pendingOpponentHandDiscard`。
- 兩者皆無時回傳 `null`（不包含 pendingBattle、pendingReplacement 等其他 pending）。
- 回傳的決策物件僅含來源資訊與限制（min/max、count），**不複製候選卡物件**。
  候選卡應透過既有的 `getFaintEffectCandidates` 或直接讀取 `state.players[playerId].hand` 取得。

### `applyGameCommand(state: GameState, command: GameCommand): GameState`

- 純函式，不修改輸入 state。
- 驗證：
  - 目前是否有 pending decision（否則丟 `GameRuleError`）。
  - command 種類是否與 pending decision 相符。
  - `command.playerId` 是否等於 decision 的 actor player。
- 通過驗證後委派至：
  - `resolveFaintEffect(state, command.targetIds)`（faint）
  - `resolveOpponentHandDiscard(state, command.playerId, command.cardIds)`（discard）

## 整合範圍

- **App.tsx**：玩家確認/略過 faint 效果與 opponent discard 改呼叫 `applyGameCommand`。
- **ai.ts**：AI 的 faint 與 opponent discard 決策改用 `getPendingDecision` 取得限制後，
  透過 `applyGameCommand` 執行。
- **useMatchController.ts**：`aiControlsCurrentState` 改用 `getPendingDecision` 判斷 faint/discard
  是否由 AI 控制；其餘 pending 判斷保持原樣。

## 未涵蓋

- `pendingBattle` 的陷阱／傷害／FLIP 自動結算（保持 `resolveBattleAutomatically` 等原介面）。
- `pendingReplacement` 的補位任務。
- `pendingRefresh` 的牌庫重整。
- `pendingOnPlay` 的登場技能窗口。
- `CardEffect` union type（未擴充）。
