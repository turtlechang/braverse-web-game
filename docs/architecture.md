# 系統架構（Architecture）

最後更新：2026-07-10。本文件描述現行架構；硬性開發規範見根目錄 [AGENTS.md](../AGENTS.md)。

## 1. 分層總覽

```
┌────────────────────────────────────────────────────┐
│ UI 層  src/components/ + src/hooks/ + App.tsx      │  React 19
│   只呼叫規則層公開 API，不另寫權威規則               │
├────────────────────────────────────────────────────┤
│ 線上層  src/net/onlineProtocol.ts ←ws→ server/src/ │  ws 8
│   房間管理、訊息協定；狀態遮罩重用 masked-state     │
├────────────────────────────────────────────────────┤
│ 卡牌轉接層  src/cards/                              │
│   官方 JSON → GameCard；效果文字 → CardEffect       │
├────────────────────────────────────────────────────┤
│ 規則引擎  src/game/（純函式，不依賴 React）          │
│   單一真實來源：types.ts                            │
├────────────────────────────────────────────────────┤
│ 資料  data/cards/*.json（官方匯入樣本）              │
└────────────────────────────────────────────────────┘
```

依賴方向嚴格單向：UI → 規則引擎 → 型別；規則引擎不 import React、不 import UI。

## 2. 規則引擎（src/game/）

| 模組 | 職責 |
|---|---|
| `types.ts` | 所有核心型別單一來源（GameState、PlayerState、GameCard、Phase、PendingDecision…） |
| `setup.ts` / `opening.ts` | createGame、猜拳、先後攻、調度、起始餅乾配置 |
| `turn.ts` / `refresh.ts` | 階段推進（advancePhase）、牌庫 Refresh 流程 |
| `actions.ts` / `battle.ts` | 登場、放支援、攻擊宣告（beginAttack）、戰鬥結算、陷阱/Blocker/FLIP 回應 |
| `energy.ts` | 費用驗證與支付候選（含顏色匹配、Mix Cost） |
| `effects/` + `effects.ts` | 效果執行、目標選擇、pending 佇列（façade 保留相容出口） |
| `skills.ts` / `card-abilities.ts` | Activate / OnPlay / Passive 技能觸發 |
| `pending.ts` / `afterDamage.ts` / `replacement.ts` | 昏厥佇列、受傷後效果、補位流程 |
| `victory.ts` | 勝負判定（含 Refresh 敗北、doubleLoss） |
| `commands.ts` | typed `GameCommand`（8 決策 + 24 玩家動作）；`applyGameCommand` 驗證並寫入 `commandLog` |
| `command-log.ts` | `describeCommand` 產生正體中文對戰紀錄摘要 |
| `replay.ts` | `replayCommands` / `replayCommandLog` 重播 |
| `legal-actions.ts` | `getLegalTurnCommands` 列舉合法動作（AI 與驗證共用） |
| `custom-deck.ts` | 牌組合法性（60 張 / 同卡 4 張 / ≥1 餅乾 / FLIP ≤16）、localStorage 版本化儲存與遷移 |
| `player-view.ts` / `masked-state.ts` | 視角過濾：對手手牌、牌庫、HP 卡只留張數（AI 公平性與線上同步共用） |
| `ai/` | 分級 AI（見 §5） |
| `helpers.ts` | `createSeededShuffle`（Fisher-Yates 種子洗牌，全引擎唯一亂數入口） |

設計原則：

- **純函式**：所有規則函式 `(state, input) → newState`，可種子重現，測試不需 mock。
- **不合法操作回傳可讀錯誤**（`errors.ts`），UI 與 AI 共用同一驗證。
- **指令層現況**：玩家 UI、攻擊宣告、多段效果精靈與全部 AI battle／turn handler（`ai.ts`、`ai/battle-handler.ts`、`ai/turn-handler.ts`、`ai/random-turn-handler.ts`）皆透過 `applyGameCommand`；command 出口會在 blocking pending 全數結束後執行補位／勝負排程，再寫入 `commandLog`。AI 的 `play-item`／`activate-skill`／`activate-stage` 透過共用的 `simulateAbilityEffects`（`src/game/ai/ability-effects.ts`）先算出完整 `effectTargets` 才送入 `applyGameCommand`，確保 replay 對 AI 對局同樣忠實（`ai-replay-fidelity.test.ts`）。

## 3. 卡牌轉接層（src/cards/）

- `official-card-adapter.ts`：官方 JSON 欄位 → runtime `GameCard`（卡號 `@` 異圖正規化）。
- `official-effect-adapter.ts`：效果文字 → `CardEffect`；`exactStarterEffects` / `exactFlipEffects` 明確表優先，通用 parser 兜底；不支援者標記 `unsupported`。
- `official-text-parser.ts`：官方攻擊/效果文字解析。
- FLIP 由 `card_flip` 欄位驅動、TRAP 由 `card_attack_text` 驅動，不依卡號硬編碼。

資料來源：`data/cards/*.json`（由 `scripts/import-official-cards.mjs` / `import-brave-beginning.mjs` 自官方 API 匯入，schema 驗證見 `data/schemas/official-card-import.schema.json`）。

## 4. UI 層（src/components/ + src/hooks/）

- `App.tsx`（約 630 行）只做協調：組合 hooks、切換畫面（主選單 / 牌組編輯器 / 對戰 / 線上對戰）；戰鬥資訊 modal 群組與 `ResultModal`／`OpeningSetupModal` 以 `React.lazy` 按需載入。
- 協調邏輯在 hooks：`useMatchController`（對局主控）、`useMatchSetup`、`useBattleActions`、`usePendingEffect`（多段效果精靈）、`useAiTurn`、`useMatchAnimations`、`useMatchDialogs`、`useDeckEditor`；線上為 `useOnlineMatch*` 三件組。
- 容器元件在 `components/battle/`：MenuScreen、BattleRow、各類 Modals（Information / BattleResponse / DamageEffect / PendingDecision）、OnlineBattleView、OnlineMatchPanel。
- 版面：滿版桌墊、左側窄型五階段列（PhaseRail）、55/45 戰鬥/支援區、扇形手牌、可縮小深色置中效果提示框；最低支援 600×338。

## 5. AI（src/game/ai/）

| 等級 | 實作 | 策略 |
|---|---|---|
| Lv.1 | `random-turn-handler.ts` | 從 `getLegalTurnCommands` 隨機挑選 |
| Lv.2 | `turn-handler.ts` | 固定優先序啟發式 |
| Lv.3 | `evaluated-turn-handler.ts` | 對候選動作以 `evaluatePlayerView` 打分取最高 |
| Lv.4 | （Lv.3 擴充） | 兩層前瞻（模擬我方行動後對手回應），附 matchup 資料驅動評估 |
| Lv.5 | 設計文件 | 見 [ai-levels.md](ai-levels.md)，未實作 |

- AI 只讀 `PlayerView`（型別保證不讀隱藏資訊）。
- **關鍵約束**：AI 攻擊必須用 `applyChosenTurnCommand` → `beginAttack` 停在 trap 階段等人類防守方回應；`attack` 指令的自動結算只用於 AI 對 AI 模擬。所有 AI 等級以 `declare-attack` 記入 commandLog，replay 重播可保留陷阱/FLIP 回應窗口。Lv.1 隨機決策不受 `commandLog` 長度影響（deterministic）。
- 訓練與勝率紀錄：docs/ai-training-*.md（20 份 BS2 對局矩陣）。

## 6. 線上對戰（server/ + src/net/）

- `server/src/index.ts`：ws WebSocket 伺服器；`rooms.ts` 房間碼建立/加入；`connection.ts` 連線生命週期。
- 權威狀態在伺服器；廣播前以 `masked-state` 依玩家視角遮罩，客戶端拿不到對手隱藏資訊。
- 客戶端 `src/net/onlineProtocol.ts` 定義訊息協定；`useOnlineMatch*` hooks 驅動 `OnlineBattleView`。
- 本機開發：`npm run dev:online`（concurrently 起 vite + tsx watch server）。
- **部署注意**：Vercel 不承載長連線，server 需獨立宿主（見 known-risks R6）。

## 7. 建置與測試

> 2026-07-12 更新：AI、牌組編輯器與好友房 smoke workflow 於 main push 自動執行，並保留 `workflow_dispatch` 手動觸發。

- Vite 8 + TypeScript 6（`tsc -b` 複合建置：app + node 兩個 tsconfig；server 獨立 `server:typecheck`）。
- vitest 4：測試數與原始碼同目錄放置（`*.test.ts(x)`）；目前基線見 [CHANGELOG.md](../CHANGELOG.md) 最新項目（非永久門檻，只要求不低於前次基線）。
- Playwright 瀏覽器驗證：`npm run test:ai:browser`（12 種解析度、20 場 AI 對局）、`npm run test:deck:browser`（牌組編輯器匯入／儲存與桌機／窄版）、`npm run test:blue:browser`（藍牌效果流程）、`npm run test:online:browser`（線上 modal 桌機／窄版）、`npm run test:online:match:browser`（本機雙瀏覽器建房／加入／開局／同步／斷線）；AI、牌組編輯器與好友房驗證另由 main push／手動 GitHub Actions workflow 執行。
- CI：`.github/workflows/ci.yml`（PR + main push：卡牌／候選／registry 驗證 → test → lint → build → bundle budget）。
