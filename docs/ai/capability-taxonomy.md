# AI 能力分類法（Phase G0 規格）

> 狀態：G0 設計文件。G1 才建立 `src/game/ai/strategy/capability-model.ts` 與 `capability-extractor.ts`；本文件不重新解析卡面顯示文字。

## 唯一資料來源

能力擷取只能讀取既有結構化資料：

- `GameCard` 的類型、level、HP、attack、energy color。
- skill／attack／trap／stage 的 `CardEffect[]`。
- effect 的 cost、timing、target、次數與條件欄位。
- 規則層已提供的合法候選、公開區域與階段狀態。

不得以 `name`、`id` 前綴、系列、牌組名稱或畫面文字推測能力。完整 `card.id` 僅可進入受稽核的人工例外 registry，不能成為一般能力分類捷徑。

## 預定模型

G1 的模型應以如下概念表達；名稱可隨既有型別慣例微調，但資料意義不可縮減。

```ts
type CapabilityKind =
  | 'damage'
  | 'draw'
  | 'discard'
  | 'gain-hp'
  | 'attack-modification'
  | 'deploy'
  | 'move-zone'
  | 'inspect-deck'
  | 'rest'
  | 'set-active'
  | 'block'
  | 'trap'
  | 'flip'
  | 'conditional-setup'
  | 'conditional-payoff'

interface CapabilityEvidence {
  kind: CapabilityKind
  source: 'skill' | 'attack' | 'trap' | 'stage' | 'card-effect'
  effectKinds: CardEffect['kind'][]
  timing: 'activate' | 'on-play' | 'attack' | 'faint' | 'after-damage' | 'passive' | 'flip' | 'other'
  costPresent: boolean
  targetScope: 'self' | 'opponent' | 'any' | 'none'
  zone?: 'hand' | 'support' | 'trash' | 'break' | 'deck-top' | 'deck-bottom' | 'deck' | 'hp'
  certainty: 'confirmed' | 'conditional' | 'unsupported'
}
```

`conditional` 表示卡牌結構包含可檢驗條件，不代表條件在目前局面已成立；`unsupported` 不可被當成 combo 保證，必須交給保守 fallback 與 telemetry。

## 必備能力矩陣

| 能力 | 從結構化效果辨識的證據 | 策略訊號 | 不可做的推論 |
| --- | --- | --- | --- |
| `damage` | 對餅乾／玩家造成傷害、追加傷害、範圍傷害。 | 收尾、移除、效果傷害計畫。 | 不可假定未選目標或未知條件一定命中。 |
| `draw` | 從牌庫加入手牌、draw-up-to。 | 手牌門檻、資源補充。 | 不可把未知抽到的卡當成 payoff。 |
| `discard` | 自己或對手手牌／支援／區域移至棄牌區。 | 干擾、棄牌循環的成本或收益。 | 不可知道對手被隨機棄置的隱藏卡。 |
| `gain-hp` | 新增、回復或放回 HP。 | 耐久與防守。 | 不可讀取未翻開 HP 身分。 |
| `attack-modification` | 改攻擊力、傷害、攻擊可否、傷害接收。 | 快攻、補刀、風險比較。 | 不可忽略結算順序與 modifier 範圍。 |
| `deploy` | 從手牌、支援、棄牌區或牌庫放入戰鬥／支援區。 | 展開、重建、支援區引擎。 | 牌庫來源若未展示，不能指定未知卡。 |
| `move-zone` | 移至手牌、支援、棄牌、break、牌庫頂、牌庫底或牌庫。 | 回收、牌序、犧牲與循環。 | 移到未知牌庫後不得仍保持確定身分，除非規則允許且未洗牌。 |
| `inspect-deck` | inspect／reveal top／bottom 或指定展示。 | 已知牌序 setup、合法挑選。 | 不可把未揭示部分視為已知。 |
| `rest` | 使目標休息／橫置。 | Active／Rest 接力、延緩攻擊或支援。 | 不可假定下回合一定有解除休息效果。 |
| `set-active` | 使目標 active／直立。 | 續攻、支援資源恢復、防守。 | 不可跨回合假定尚未支付的費用。 |
| `block` | redirect attack／blocker 選擇。 | 保護高價值目標、break race。 | 不可由相對 heuristic 門檻直接判定「必須／必不 block」。 |
| `trap` | attack response／trap 及其 cost。 | 防守、反制、攻擊風險。 | 不可假定對手隱藏手牌有或沒有 trap。 |
| `flip` | HP 翻開後的 flip trigger。 | 風險評估、後續傷害。 | 僅傷害翻開可觸發；移動、丟棄等非傷害不可視為 FLIP。 |
| `conditional-setup` | 建立可觀察的前置條件，例如支援數、active/rest、特定區域、手牌門檻、已知牌序。 | setup 方向、資源預留。 | 不可將尚未成立或需未知資訊的條件視為完成。 |
| `conditional-payoff` | 消耗／檢查已成立條件以取得傷害、部署、抽牌、回收等收益。 | payoff 優先、短期 TacticalPlan。 | 不可為低收益且無完成路徑的 setup 放棄確定擊暈。 |

## DeckStrategyProfile 推導規格

`DeckStrategyProfile` 只能由牌組中已知卡的 capability 集合、數量、時機、費用曲線與可觀察區域供給推導，至少提供下列**連續權重**而非命名式 profile：

- 直接傷害／快攻
- 控制／干擾
- 效果傷害
- 支援區引擎
- 牌庫頂／底引擎
- 棄牌區循環
- Active／Rest 接力
- 手牌門檻
- HP／耐久
- Setup／Payoff combo

每項權重必須附 `evidence[]`、confidence 與 unsupported count；無法辨識時採中性值，而不是預設成某個舊牌組策略。profile 只改變相對偏好，不能覆寫規則合法性或可見性。

## Synergy graph 規格

圖的節點是 `CapabilityEvidence` 與可觀察的局面條件；邊表示「某能力能建立／消耗某條件」。每條邊必須可解釋：來源卡實體、結構化效果、所需資源、有效時機、可觀察性與不確定性。

範例：將已知卡放到牌庫底的效果只能產生「已知 deck-bottom」setup 邊；若 payoff 只從牌庫底拿牌且洗牌前仍可合法發動，才可形成 confirmed payoff 邊。未知牌庫底只可形成 potential 邊，不能給必定成功分數。

## G1 shadow mode 與測試規格

G1 僅輸出 `CapabilityModel`、`DeckStrategyProfile`、synergy evidence 及 unsupported telemetry，不得改變 `takeAiStep` 的選擇。

最低測試集：

1. 牌庫底 setup → payoff、支援區登場、棄牌區回收、Active／Rest 接力、手牌門檻各有結構化 fixture。
2. 不支援 effect 產生 `unsupported` evidence、保守值與 telemetry，不丟例外。
3. 同名但不同 `card.id` 只依結構化效果得到能力，不互相污染。
4. 測試與正式程式不得以牌組名稱、彈數或卡號前綴作判斷條件。
5. profile 每項權重都可回溯到 capability evidence；空牌組／未支援集合的權重保持中性且 deterministic。
