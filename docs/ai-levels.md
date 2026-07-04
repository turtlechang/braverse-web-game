# AI 等級分級設計

> **狀態：Lv.1 / Lv.2 / Lv.3 已實作；Lv.4–5 為設計稿，未實作。**

## 等級總覽

| 等級 | 名稱 | 決策邏輯 | 狀態 |
|---|---|---|---|
| Lv.1 | 隨機出招 | 從 `getLegalTurnCommands` 枚舉的合法動作指令中，以種子亂數均勻挑選一個執行；不主動使用技能、物品與 OnPlay | ✅ 已實作 |
| Lv.2 | 基礎戰術 | 現行啟發式：能出牌就出牌、能用技能就用、攻擊剩餘 HP 最低的目標、斬殺優先 | ✅ 已實作（原有 AI 掛名） |
| Lv.3 | 評估式 | 對支援／主要階段每個候選動作（含技能、物品、攻擊組合）套用後以 `PlayerView` 評分，取最高分；其餘強制流程委派 Lv.2 | ✅ 已實作 |
| Lv.4 | 回合規劃 | 枚舉本回合的動作序列組合（出牌順序 × 攻擊分配），對回合終局狀態評分後執行最佳序列；依賴指令層序列化 | ⬜ 設計稿 |
| Lv.5 | 對抗性 | 在 Lv.4 之上加入對手回應期望值（FLIP／陷阱觸發機率、手牌張數推估），僅使用公開資訊與機率 | ⬜ 設計稿 |

## 使用方式

```ts
import { takeAiStep, simulateAiMatch } from '../game'

// 單步：預設 Lv.2；Lv.1 需要種子以確保可重現
takeAiStep(state, 'player-two', { level: 1, seed: 42 })

// 模擬：可對兩位玩家分別指定等級
simulateAiMatch(createDemoGame(seed), 1500, {
  levels: { 'player-two': 1 },
  seed,
})
```

UI 由主選單「AI 對手」區塊選擇牌組（隨機／五色起始）與等級（Lv.1／Lv.2／Lv.3），
經 `App.tsx` 傳入 `useAiTurn` 與 `useMatchSetup.handleDeckSelection`。

## Lv.1 實作細節

- 合法動作來源：`src/game/legal-actions.ts` 的 `getLegalTurnCommands(state, playerId)`，
  回傳 `PlayerActionCommand[]`（Refresh、補位／略過、略過 OnPlay、支援放置、
  餅乾登場、場景放置、攻擊組合含自動能量支付、階段推進）。
- 執行路徑：選中的指令經 `applyGameCommand` 執行——Lv.1 是指令層的第一個
  AI 消費者，其行動會完整寫入 `commandLog`。
- 隨機性：`createSeededRandom(seed ^ 局面熵)`，局面熵由 commandLog 長度、
  回合數、雙方手牌與牌庫張數混合而成；**相同種子 + 相同局面 = 相同決策**，
  對局可重現（見 `ai-level1.test.ts`）。
- 待處理決策與戰鬥回應（陷阱／FLIP／傷害結算）沿用與 Lv.2 共用的
  pending／battle handler——這些屬於強制回應，不參與隨機挑選。
- 決策標註：每個 `AiDecision` 附 `reason: { level, consideredCommands, chosenCommandKind }`，
  供除錯與測試斷言。

## 資訊邊界（防作弊）

所有等級一律只能讀取：

- **可讀**：雙方戰鬥區／支援區／棄牌區／Break 區、雙方手牌**張數**、
  牌庫**張數**、自己的手牌內容、已公開的卡牌。
- **不可讀**：對手手牌內容、雙方牌庫順序、face-down HP 卡內容
  （現行程式僅使用 `hpCards.length`）。

`src/game/player-view.ts` 的 `createPlayerView(state, playerId)` 是這個過濾器：
把 `GameState` 過濾成單一玩家可見資訊（對手手牌只留張數、雙方 HP 卡只留張數，
持有者自己也看不到 HP 卡內容）後才交給評分函式，用型別而非紀律保證不作弊；
該過濾器未來直接重用於線上對戰的 state snapshot。

## Lv.3 實作細節

- 評分函式 `evaluatePlayerView(view: PlayerView): number`（`src/game/ai/evaluated-turn-handler.ts`）
  只吃 `PlayerView`，型別上不可能讀到隱藏資訊。對局結束回傳極值
  （勝 +100000／敗 -100000）；進行中對局依戰鬥區數量與剩餘 HP、手牌張數、
  可用支援卡、Break 區等級、牌庫張數加權計分。
- 候選動作來源：`getLegalTurnCommands` 枚舉的指令（支援放置、登場、場景、
  攻擊組合）逐一套用後評分；主要階段另外用 `AiTurnStrategy.resolveSkill` /
  `resolveCardAbility` 枚舉技能與物品候選（沿用 Lv.2 的目標選擇邏輯）。
- 攻擊候選採期望值加成而非套用後評分：套用攻擊指令後戰局停在待回應階段
  （傷害尚未結算），直接評分會低估攻擊價值，因此用「預期傷害／斬殺」
  額外加分（斬殺 > 部分傷害，並依付出的能量支付數量小幅扣分）。
- 非自由選擇的局面（Refresh、補位、OnPlay、戰鬥回應、非行動回合）直接
  委派給 Lv.2 的 `handleAiTurnState`，不重複實作。
- 決策標註：`reason: { level: 3, consideredCommands, chosenCommandKind }`。

## 測試策略

- `legal-actions.test.ts`：枚舉正確性——每個枚舉指令都必須能被
  `applyGameCommand` 接受；非行動玩家、待處理決策時回傳空清單。
- `player-view.test.ts`：視角過濾正確性——對手手牌與雙方牌庫只留張數、
  雙方 HP 卡只留張數、公開區域（支援區／Break 區／棄牌區／場景）原樣保留。
- `ai-level1.test.ts`：相同種子決策序列可重現、不同種子產生分歧、
  reason 標註、Lv.1 對 Lv.2 與 Lv.1 對 Lv.1 模擬完賽（種子鎖定）。
- `ai-level3.test.ts`：`evaluatePlayerView` 對場面優劣打分方向正確、
  結束對局回傳勝負極值、Lv.3 對局可正常結束（種子 1–5）、
  **Lv.3 對 Lv.1 的 20 場種子模擬勝率 ≥ 65%**（作為「等級有感」的驗收標準）、
  同一局面 Lv.3 決策可重現。
- 既有 `ai-simulation.test.ts` 的 20 種子 Lv.2 對局回歸不受影響（預設等級不變）。

## 不建議一開始做的

- Lv.4 / Lv.5：搜尋空間與評分函式的調校成本高，玩家感知差異低於
  Lv.1→Lv.3 的跳躍；建議先觀察 Lv.3 上線後的實際對戰體感再決定是否投入。
- Lv.1 的技能／物品隨機使用：需要對每個效果枚舉目標組合，複雜度高且
  容易產生非法組合；Lv.1 定位是「最弱的合法玩家」，略過技能是合法且
  符合定位的簡化。
