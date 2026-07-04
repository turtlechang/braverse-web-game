# AI 等級分級設計

> **狀態：Lv.1 / Lv.2 已實作；Lv.3–5 為設計稿，未實作。**

## 等級總覽

| 等級 | 名稱 | 決策邏輯 | 狀態 |
|---|---|---|---|
| Lv.1 | 隨機出招 | 從 `getLegalTurnCommands` 枚舉的合法動作指令中，以種子亂數均勻挑選一個執行；不主動使用技能、物品與 OnPlay | ✅ 已實作 |
| Lv.2 | 基礎戰術 | 現行啟發式：能出牌就出牌、能用技能就用、攻擊剩餘 HP 最低的目標、斬殺優先 | ✅ 已實作（原有 AI 掛名） |
| Lv.3 | 評估式 | 對每個合法動作做一步模擬並打分（斬殺 > 換血效率 > 資源保留 > Break 風險），取最高分 | ⬜ 設計稿 |
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

UI 由主選單「AI 對手」區塊選擇牌組（隨機／五色起始）與等級（Lv.1／Lv.2），
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

Lv.3+ 實作前應先建立 `PlayerView` 視角過濾器（把 `GameState` 過濾成單一玩家
可見資訊後才交給策略函式），用型別而非紀律保證不作弊；該過濾器未來直接
重用於線上對戰的 state snapshot。

## 測試策略

- `legal-actions.test.ts`：枚舉正確性——每個枚舉指令都必須能被
  `applyGameCommand` 接受；非行動玩家、待處理決策時回傳空清單。
- `ai-level1.test.ts`：相同種子決策序列可重現、不同種子產生分歧、
  reason 標註、Lv.1 對 Lv.2 與 Lv.1 對 Lv.1 模擬完賽（種子鎖定）。
- 既有 `ai-simulation.test.ts` 的 20 種子 Lv.2 對局回歸不受影響（預設等級不變）。
- Lv.3 落地時新增勝率矩陣回歸：Lv.3 對 Lv.1 應穩定勝出（例如 100 場種子
  模擬勝率 > 70%），作為「等級有感」的驗收標準。

## 不建議一開始做的

- Lv.4 / Lv.5：搜尋空間與評分函式的調校成本高，玩家感知差異低於
  Lv.1→Lv.3 的跳躍；等 Lv.3 驗證評分框架後再擴充。
- Lv.1 的技能／物品隨機使用：需要對每個效果枚舉目標組合，複雜度高且
  容易產生非法組合；Lv.1 定位是「最弱的合法玩家」，略過技能是合法且
  符合定位的簡化。
