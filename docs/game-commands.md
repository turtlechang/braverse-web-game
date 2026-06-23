# Game Commands 統一決策介面（Pilot）

> **狀態：Pilot（持續擴充）**
>
> 本模組為多種玩家決策提供統一介面，**不是 event bus**。
> `pendingBattle`、純 `pendingRefresh` 與陷阱／FLIP 等戰鬥中斷仍走既有 battle API。

## 設計目標

- 提供單一純函式入口 `getPendingDecision(state)` 回傳目前待處理的決策資訊。
- 提供單一純函式入口 `applyGameCommand(state, command)` 執行決策結果。
- 不複製規則實作；內部委派至既有 `resolveFaintEffect`、`replaceDefeatedCookie` 等函式。
- 保留所有既有公開 API，舊呼叫路徑可逐步遷移。

## 已涵蓋決策

| kind | 說明 |
|------|------|
| `faint-effect` | When this Cookie faints 目標選擇 |
| `opponent-hand-discard` | 對手從手牌棄置指定張數 |
| `opponent-random-discard` | 隨機棄牌公開確認 |
| `inspect-deck` | 看牌庫頂並選取（Refresh 進行中暫不暴露） |
| `optional-cost-attack` | 攻擊前可選代價 |
| `draw-up-to` | 可選抽牌至上限（Refresh 進行中暫不暴露） |
| `stage-trigger` | 場景觸發啟動或略過 |
| `on-play` | OnPlay 窗口略過（啟動仍走技能流程） |
| `replacement` | 補位選餅乾或略過（Refresh 進行中暫不暴露） |

## 優先順序

`getPendingDecision` 依序檢查：

1. `pendingFaintEffects`
2. `pendingOpponentHandDiscard`
3. `pendingOpponentRandomDiscard`
4. `pendingInspectDeck`（且無 `pendingRefresh`）
5. `pendingOptionalCostAttack`
6. `pendingDrawUpTo`（且無 `pendingRefresh`）
7. `pendingStageTrigger`
8. `pendingOnPlay`（且無 `pendingRefresh`）
9. `pendingReplacement`（且無 `pendingRefresh`）

## 未涵蓋

- `pendingBattle` 的陷阱／傷害／FLIP（`resolveBattleAutomatically` 等）。
- 純 `pendingRefresh` 的牌庫重整（DecisionModal + `refreshDeck`）。
- OnPlay **啟動**（需 `beginCookieSkill` / 技能付款流程）。

## 整合範圍

- **App.tsx**：昏厥、棄牌、補位等決策改呼叫 `applyGameCommand`。
- **ai/pending-handler.ts**、**ai/turn-handler.ts**：AI 決策透過 `getPendingDecision` + `applyGameCommand`。
- **controller.ts**：`getActingPlayerId` 優先採用 `getPendingDecision` 的 `playerId`。

## 函式

### `getPendingDecision(state: GameState): PendingDecision | null`

回傳決策 metadata（min/max、count、remaining 等），**不複製候選卡物件**。
候選卡仍由 `getFaintEffectCandidates`、`getReplacementCandidates` 等既有函式取得。

### `applyGameCommand(state: GameState, command: GameCommand): GameState`

純函式；驗證 pending 存在、指令種類相符、`playerId` 正確後委派至對應 resolver。
