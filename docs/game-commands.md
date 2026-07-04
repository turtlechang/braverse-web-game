# Game Commands 統一指令層

> **狀態：全覆蓋（決策 + 玩家動作）**
>
> `GameCommand` 現在涵蓋兩大類：
> 1. **PendingDecisionCommand**（8 種）：回應 `getPendingDecision(state)` 回傳的待處理決策。
> 2. **PlayerActionCommand**（24 種）：開局、回合推進、主要階段動作、補位／Refresh 與戰鬥回應。
>
> 每次 `applyGameCommand` 成功執行都會在 `GameState.commandLog` 附加一筆
> `CommandLogEntry`，「初始狀態（含種子）＋指令序列」即可完整重播一場對局。

## 設計目標

- 單一純函式入口 `getPendingDecision(state)` 回傳目前待處理的決策資訊。
- 單一純函式入口 `applyGameCommand(state, command, options?)` 執行所有玩家輸入。
- **不複製規則實作**；內部委派至既有規則函式（`deployCookie`、`attackCookie`、
  `activateCookieSkill`、`playTrap`⋯），規則函式本體不變。
- 保留所有既有公開 API，舊呼叫路徑不受影響（UI/AI 可逐步遷移）。
- 為對戰紀錄、重播、AI 分級與未來線上同步提供可序列化的統一協定。

## 型別總覽

### `PendingDecisionCommand`（8 種）

| kind | 對應決策 | 委派函式 |
|---|---|---|
| `resolve-faint-effect` | faint-effect | `resolveFaintEffect` |
| `resolve-opponent-hand-discard` | opponent-hand-discard | `resolveOpponentHandDiscard` |
| `resolve-inspect-deck` | inspect-deck | `resolveInspectDeck` |
| `resolve-optional-cost-attack` | optional-cost-attack | `resolveOptionalCostAttack` |
| `resolve-draw-up-to` | draw-up-to | `resolveDrawUpTo` |
| `resolve-stage-trigger` | stage-trigger | （內建處理） |
| `resolve-after-damage-effect` | after-damage-effect | `resolveNextAfterDamageEffect` |
| `resolve-effect-order` | effect-order | （內建處理） |

### `PlayerActionCommand`（24 種）

| 分類 | kind | 委派函式 |
|---|---|---|
| 開局 | `keep-opening-hand` | `keepOpeningHand` |
| 開局 | `mulligan-opening-hand` | `mulliganOpeningHand`（可注入 shuffle） |
| 開局 | `force-mulligan-opening-hand` | `forceMulliganOpeningHand`（可注入 shuffle） |
| 開局 | `draw-mulligan-compensation` | `drawMulliganCompensation` |
| 開局 | `select-starting-cookie` | `selectStartingCookie` |
| 回合 | `advance-phase` | `advancePhase`（驗證回合玩家） |
| 主階段 | `place-support` | `placeSupportCard`（驗證回合玩家） |
| 主階段 | `deploy-cookie` | `deployCookie`（驗證回合玩家） |
| 主階段 | `attack` | `attackCookie`（驗證回合玩家） |
| 主階段 | `activate-skill` | `activateCookieSkill` + 依 `effectTargets` 執行效果 |
| 主階段 | `skip-on-play` | `skipCookieOnPlay` |
| 主階段 | `play-item` | `playItem` + 依 `effectTargets` 執行效果 |
| 主階段 | `play-stage` | `playStage` |
| 主階段 | `activate-stage` | `activateStage` + 依 `effectTargets` 執行效果 |
| 補位 | `replace-cookie` | `replaceDefeatedCookie`（驗證補位玩家） |
| 補位 | `skip-replacement` | `skipDefeatedCookieReplacement`（驗證補位玩家） |
| Refresh | `refresh-deck` | `refreshDeck`（可注入 shuffle） |
| 戰鬥 | `play-trap` | `playTrap` |
| 戰鬥 | `skip-trap` | `skipTrap` |
| 戰鬥 | `play-blocker` | `playBlocker` |
| 戰鬥 | `resolve-flip` | `resolveFlip` |
| 戰鬥 | `resolve-attack-effect` | `resolveAttackEffect` |
| 戰鬥 | `resolve-next-damage` | `resolveNextDamage`（驗證受傷方） |
| 戰鬥 | `resolve-battle` | `resolveBattleAutomatically`（驗證戰鬥參與者） |

### 複合效果指令（`effectTargets`）

`activate-skill`、`play-item`、`activate-stage` 接受選填的 `effectTargets: string[][]`，
第 `i` 個陣列對應能力 `effects[i]` 的目標選擇：

- 執行前逐一以 `isEffectConditionMet` 檢查條件，不成立的效果跳過（不消耗對應索引）。
- 效果執行後若出現 `pendingRefresh` / `pendingOnPlay` 或對局結束，中止後續效果
  （與 AI 既有語意一致）。

### `ApplyGameCommandOptions`

```ts
interface ApplyGameCommandOptions {
  shuffle?: Shuffle // 重播時必須傳入與原對局相同種子的 createSeededShuffle
}
```

## 指令紀錄與重播

- `GameState.commandLog?: CommandLogEntry[]`：每筆含
  `id`（流水號）、`turnNumber` / `phase`（指令發出當下）、`playerId`、
  `commandKind` 與完整 `payload`。
- `src/game/replay.ts`：
  - `replayCommands(initialState, commands, options)`：依序重放指令。
  - `replayCommandLog(initialState, log, options)`：直接從 commandLog 重播。
  - `commandFromLogEntry(entry)`：由紀錄還原 `GameCommand`。
- 黃金重播測試位於 `src/game/replay.test.ts`：固定種子＋指令序列
  必須重播出 JSON 完全相同的終局狀態。

## 驗證順序

`applyGameCommand` 對玩家動作指令的驗證：

1. 若 `getPendingDecision(state)` 非空 → 丟出「必須先處理待處理的決策。」
2. 依指令類別做行動者驗證（回合玩家／補位玩家／受傷方／戰鬥參與者）。
3. 委派至規則函式，由規則函式執行既有的階段、費用與狀態驗證。

決策指令維持原有驗證：決策存在、種類相符、玩家相符。

## 未涵蓋（後續任務）

- UI 與 AI 尚未全面改走指令層：App.tsx 與 hooks 仍直接呼叫規則函式，
  UI 的多段效果流程（`usePendingEffect`）遷移到 `effectTargets` 形式列為後續任務。
  在遷移完成前，實際對局的 `commandLog` 不完整，重播僅保證「透過指令層執行的對局」。
- 開局前流程（選牌組、猜拳、決定先後攻）發生在 `createGame` 之前，不在指令層內。
