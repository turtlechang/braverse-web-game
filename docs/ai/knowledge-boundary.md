# AI 已知資訊與隱私邊界（Phase G0 規格）

> 狀態：G3 已將 `KnowledgeState` 接入 Lv.3 的**評分輸入**。`src/game/ai/strategy/knowledge-state.ts` 仍只接收 `PlayerView` 與合法 knowledge events，不接收完整 `GameState`；G3 不建立 command log 投影器，也不讓知識狀態改寫規則或 `GameState`。

## 現況邊界

`src/game/player-view.ts` 的 `createPlayerView(state, viewerId)` 已提供策略評估所需的公開切面：

- `view.hand` 僅包含 viewer 自己的手牌內容。
- 雙方都有 `handCount` 與 `deckCount`，但沒有對手手牌或牌庫的身分／順序。
- 戰鬥區的 HP 只提供 `hpCount`；未翻開 HP 的卡面不外洩。
- 戰鬥區卡、支援區、break、棄牌區、場景、已公開 modifier 與階段屬公開資訊。

策略模型必須把 `PlayerView` 當作評估及長期記憶的輸入邊界。直接從 `GameState.players[opponent].hand`、`deck`、`hpCards` 讀取未公開卡，或利用 simulate state 的完整陣列間接推論，都是違反本契約。

## 可見性矩陣

| 資訊 | 可否讀取 | 允許保存 | 說明 |
| --- | --- | --- | --- |
| 自己手牌身分 | 是 | 是 | 自己的合法私有資訊。 |
| 自己牌庫頂／底 | 僅曾被合法展示、檢視或由已知移動建立時 | 是，附來源與 sequence version | 不得直接讀底層陣列。 |
| 自己未知牌庫中段 | 否 | 否 | 只能使用牌庫張數與機率／不確定性。 |
| 對手手牌張數 | 是 | 是 | 公開計數。 |
| 對手手牌身分 | 否，除非規則明確展示且尚有可追溯公開狀態 | 僅可保存展示事件，不能將其當作仍在手牌的確定事實 | 對手可出牌、棄牌、回收。 |
| 對手牌庫頂／底 | 否，除非效果向我方公開展示 | 僅保存公開展示的事件與有效範圍 | 不得從完整 state 或歷史陣列偷看。 |
| 未翻開 HP 身分 | 否 | 否 | 僅可讀 `hpCount`。 |
| 已翻開／公開移動的卡 | 是 | 是 | 仍要保留來源、區域與失效規則。 |
| 洗牌後的先前牌序 | 否 | 否 | 洗牌立即使確定位置失效。 |

## 預定 `KnowledgeState` 模型

G2 的知識資料要與完整 `GameState` 分離，最小概念如下：

```ts
type KnowledgeCertainty = 'confirmed' | 'publicly-revealed' | 'inferred'
type KnownPosition = 'deck-top' | 'deck-bottom' | 'deck-index' | 'public-zone'

interface KnowledgeSource {
  commandLogIndex?: number
  event: 'inspect' | 'reveal' | 'known-move' | 'public-play' | 'public-discard'
  observer: PlayerId
}

interface KnownCardFact {
  playerId: PlayerId
  cardId: string
  instanceId?: string
  position: KnownPosition
  deckSequenceVersion?: number
  indexFromBoundary?: number
  certainty: KnowledgeCertainty
  source: KnowledgeSource
}

interface KnowledgeState {
  observerId: PlayerId
  deckSequenceVersion: Partial<Record<PlayerId, number>>
  facts: KnownCardFact[]
}
```

`instanceId` 只在該資訊已合法公開且引擎可追溯時保留；不能以從真實 deck array 查回 instance id 補足未知資料。`inferred` 永遠不是卡牌身分的授權來源，且不得轉為必定成功的 payoff。

## 生命週期與失效規則

1. **建立**：合法 inspect、reveal、公開移動，或由 AI 自己已知卡執行的牌庫頂／底移動，才可建立 fact。
2. **消耗／移動**：若已知位置被合法抽走、放入 HP、移到公開區或被另一效果改變，更新或移除受影響 fact。
3. **洗牌**：任一影響該玩家牌庫順序的 shuffle／refresh shuffle／重抽 shuffle 必須遞增該玩家 `deckSequenceVersion`，並清除該牌庫所有 position fact。
4. **不確定操作**：未知抽牌、未知隨機移動、未向 observer 展示的牌庫重排，必須清除無法繼續證明的 fact；不能保留樂觀猜測。
5. **跨回合**：未被洗牌或移動破壞的已知底／頂資訊可跨回合保留；每次讀取都需匹配 sequence version。
6. **回放**：knowledge 更新必須由 command／公開效果事件可重播，以維持同 seed deterministic。

## G2 實作邊界

`KnowledgeState` 以 `observe-known-deck-card`、`observe-public-card`、`forget-known-card` 與 `invalidate-deck-sequence` 作為唯一寫入入口：

- `self-private` 觀察只允許 observer 自己的牌庫；若要記錄對手牌庫，必須是 `public` reveal。
- `synchronizeKnowledgeWithPlayerView` 只投影戰鬥、支援、Break、棄牌與場景等公開區；不讀取手牌身分、牌庫陣列或 HP 卡面。
- shuffle、Refresh shuffle、mulligan shuffle 與無法證明安全的牌庫變動，都會遞增該玩家的 `deckSequenceVersion` 並移除所有 deck position facts。
- query 只回傳目前 sequence 的 confirmed／publicly-revealed deck facts；`inferred` 永遠不是 payoff 的授權來源。

目前尚未建立 command log → knowledge event 的投影器。G3 的 `takeAiStep(..., { knowledgeState })` 僅接受外部已合法建立的 snapshot；未提供時，Lv.3 會從目前 `PlayerView` 建立只有公開區的空白 snapshot。每次評分前只同步公開區，讀取牌庫事實時只採用當前 sequence 的 `confirmed`／`publicly-revealed` fact；因此無法從完整 `GameState` 補看未知牌庫、對手手牌或未翻 HP。Lv.4 的跨步記憶與 command log 投影仍屬 G4／G5 範圍。

## 明確禁止事項

- 不得在 `KnowledgeState` 初始化時複製 `state.players[*].deck` 或 `hpCards`。
- 不得以自己的 seed、shuffle 函式、候選模擬或測試 fixture 的完整牌序回推未知牌。
- 不得讀取對手未公開手牌，亦不得將先前展示卡持續宣告「仍在手牌」。
- 不得因未翻開 HP 的真實卡面含 FLIP 而增減風險分數；可依公開張數及已公開規則以保守範圍處理。
- 不得把 unknown top／bottom 在 payoff 評估時當成最有利或最不利的確定結果。

## G2 負向與回歸測試規格

| 案例 | 期望 |
| --- | --- |
| AI 自己把已知卡放到牌庫底 | 建立 `confirmed deck-bottom` fact，可被之後的合法 bottom payoff 使用。 |
| 底牌原本未知 | 不得因真實 `GameState` 底牌內容改變行動或 breakdown；兩個只差未知底牌身分的 state 應有相同行動。 |
| 牌庫洗牌 | sequence version 改變，所有受影響 top／bottom／index fact 清除。 |
| 對手手牌身分不同但張數、公開區一致 | AI 行動與 score breakdown 不得因隱藏身分改變。 |
| 未翻開 HP 身分不同但 HP 張數、公開區一致 | AI 行動不得因隱藏 HP 卡面／FLIP 改變。 |
| 已公開 inspect/reveal | 只保存實際向 observer 公開的牌及其位置；未展示的鄰近牌不得出現在 facts。 |

任何無法從現有 command log／公開效果事件辨識「牌序是否已被破壞」的效果，是 G2 的 `Blocking Decision`；在裁決前不得寫入可能沿用過期位置的策略。
