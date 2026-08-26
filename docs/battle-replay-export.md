# 對戰紀錄 AI 覆盤匯出

最後更新：2026-08-26。

本專案提供版本化的 `braverse-battle-replay` JSON，讓後續 AI 訓練、失敗案例分類與策略迭代可以使用同一份對戰證據。匯出資料不是另一套規則狀態；所有重播仍由 `src/game/commands.ts` 的 `applyGameCommand` 與 `src/game/replay.ts` 驅動。

## 使用方式

對戰中可從本機「對戰紀錄」側欄下載；結算畫面開啟「對戰紀錄回顧」後也可下載。線上對戰則從「完整紀錄」或回顧視窗下載。檔名格式為：

```text
braverse-replay-<offline|online>-<UTC timestamp>.json
```

規則層也可直接建立或解析匯出檔：

```ts
import {
  buildBattleReplayExport,
  parseBattleReplayExport,
  replayBattleExport,
} from './src/game'

const artifact = buildBattleReplayExport({
  state: finalState,
  mode: 'offline',
  viewerId: 'player-one',
  source: 'production',
  decks: { playerOne: 'starter-red', playerTwo: 'starter-blue' },
  initialState,
})

const restored = parseBattleReplayExport(json)
const replayed = replayBattleExport(restored)
```

當 `artifact.replay.exact` 為 `true` 時，可將 `replayed` 與 `artifact.finalState` 做 JSON／結構比對。若只需要規則引擎產生的完整新 `commandLog`，可直接使用既有的 `replayCommands`；`replayBattleExport` 會移除重播過程重新產生的重複 log，方便與匯出的終局快照比對。

## V1 欄位

| 欄位 | 用途 |
| --- | --- |
| `format` / `version` | 固定為 `braverse-battle-replay` / `1`，供未來 schema 演進與拒絕未知版本。 |
| `mode` / `visibility` | `offline` + `full`，或 `online` + `public`。 |
| `viewerId` / `decks` / `seed` | 對局視角、牌組識別與可用的開局 seed metadata。線上牌組目前為 `unknown`。 |
| `source` | 資料來源：`production`（正式對局）、`test-state`（測試局面）、`benchmark`（基準對戰）或 `unknown`（舊檔／未標記）。 |
| `sampleQuality` | `snapshot` 代表沒有任何 action；`behavioral` 代表 `commands` 與 `commandLog` 都有且數量一致；`invalid` 代表兩條 action stream 不一致。 |
| `training` | AI 資料集門檻結果。只有 `eligible: true` 才能直接加入訓練／benchmark corpus；`exclusionReasons` 會列出拒絕原因。 |
| `commands` | 離線為從 `commandLog.payload` 還原的扁平 `GameCommand[]`，供 AI 或 replay runner 使用；線上保留 action shape，但卡牌／目標 ID 會替換成 placeholder。 |
| `commandLog` | 包含摘要、分類、步驟與公開卡面 metadata 的人類可讀紀錄。 |
| `initialState` | 離線覆盤根狀態；線上固定為 `null`，避免輸出雙方完整隱藏資訊。 |
| `finalState` | 不含重複 `commandLog` 的終局快照。線上為 viewer 的遮罩狀態。 |
| `outcome` | `status`、`result`、回合與階段摘要。 |
| `replay` | `available`、`exact` 與限制原因，讓訓練流程不會把 best-effort 當成精確標籤。 |
| `ai` | 離線完整匯出的 AI agent／決策 trace；包含 `aiLevel`、`strategyVersion`、`strategyCommit`、對應 `commandLogId`、動作、描述與公開決策理由。線上匯出永遠省略。 |

## 精確度與隱私邊界

離線匯出若有 `initialState`，通常可用 `initialState + commands` 重播。開局調度、強制調度或 Refresh 指令若沒有可序列化的 `shuffleSeed`，會標示 `replay.exact: false` 與 `limitation: "unseeded-shuffle"`；這類檔案仍可供行動序列與策略決策分析，但不得直接當作完全相同牌序的 ground truth。`replay.exact: true` 只代表狀態可精確重播，不代表資料一定包含行為；零指令 snapshot 也可能是 exact。

線上匯出一律是 `visibility: "public"`、`initialState: null`、`limitation: "online-public-view"`。對手手牌、牌庫順序與隱藏 HP 卡經 `maskGameStateForViewer` 遮罩；`commands` 與 `commandLog.payload` 的卡牌／目標 ID 會被替換成 placeholder，log 內卡牌物件也不輸出，只保留可公開的摘要與步驟文字。因此線上檔案可做公開行動覆盤，不能用來推導對手私有手牌，也不能宣稱完整重播。

## AI 決策追蹤

離線正式對戰可在匯出頂層帶入 `ai`：

```json
{
  "ai": {
    "agents": {
      "player-two": {
        "aiLevel": 5,
        "strategyVersion": "lv5-defense-retention-endgame-v1",
        "strategyCommit": "<git commit or null>"
      }
    },
    "decisions": [
      {
        "commandLogId": 123,
        "playerId": "player-two",
        "action": "attack",
        "description": "...",
        "reason": { "level": 5, "chosenCommandKind": "attack" }
      }
    ]
  }
}
```

`decisions[].reason` 只保存可由公開 `PlayerView` 解釋的分數、原因與評估摘要，不保存 `strategyMemory`、對手隱藏手牌或其他私有推測。`commandLogId` 讓決策與實際 command 對齊；尚未產生對應 log 的決策會是 `null`。正式建置若未注入 `VITE_GIT_COMMIT`，`strategyCommit` 會是 `null`，但仍會記錄固定的 `AI_STRATEGY_VERSION`。這些欄位是 V1 的向後相容附加欄位；舊檔沒有 `ai` 時仍可正常解析。

`buildBattleReplayExport` 即使收到線上呼叫端傳入的 `ai`，也不會寫入 `artifact.ai`；線上資料只允許公開 action trace，避免把 AI 內部資訊或完整決策上下文帶出。

## AI 使用建議

1. 先檢查 `format`、`version`、`replay` 與 `training` metadata。
2. 只有 `training.eligible === true` 的檔案才直接加入 AI 行為訓練／benchmark corpus；其他檔案保留作診斷或規則回歸資料。
3. 可訓練樣本必須是 `source: "production"` 或 `"benchmark"`、離線完整視角、`sampleQuality: "behavioral"`、精確 replay，且 `outcome.status: "finished"` 且有 `result`。
4. 離線檔將 `commands` 作為模型決策／合法性分析的輸入，不要從中文 `summary` 反解析指令；線上檔則視為已遮罩的 action trace。
5. 離線且 `exact: true` 的檔案可比較 `replayed` 與 `finalState`，找出第一個狀態差異。
6. 舊版 v1 若沒有 `source`、`sampleQuality` 或 `training`，`parseBattleReplayExport` 會以 `source: "unknown"` 保守補值並重新計算品質，不信任檔案自行填入的訓練資格。
7. 任何訓練報告仍須保留 seed、牌組識別與安全指標；匯出檔不能取代 benchmark 的固定 seed／holdout 邊界。

匯出內容不包含 API key、token 或其他本機認證資料。
