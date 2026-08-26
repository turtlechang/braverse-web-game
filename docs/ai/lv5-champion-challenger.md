# Lv.5 AI champion–challenger 迭代契約

## 目標

Lv.5 的目標不是堆疊更多卡號特判，而是讓新增卡池後仍能透過結構化能力、
公開資訊、可重現搜尋與配對基準持續變強。Lv.4 在驗證期間保持 champion；
Lv.5 是 challenger，只有安全與強度證據同時成立才升格。

## 決策資料流

1. 規則層列出合法 `GameCommand`，AI 不自行發明合法性。
2. `PlayerView` 遮蔽對手手牌、牌庫順序與未翻 HP。
3. `AiStrategyMemory` 跨步保存合法 `KnowledgeState` 與上一個戰術意圖。
4. Lv.5 在 Lv.4 command search 上加入同一 `ComboPlan` 的根節點意圖延續、公開條件門檻、規則層下一步合法動作時機、payoff 付款預留與公開回應風險。
5. `forecastOpponentEndgame` 只以公開牌庫／手牌張數、公開棄牌與 Break 推估補位、Refresh 洗傷及空場敗北；不讀手牌種類或牌庫順序。
6. 公開回應 Min 只建立有限的 `no-response`、`unknown-hand-envelope`、`reserved-energy-threat` 與公開能力分支；對手活躍支援張數最多只轉成未知支付容量上限，不推導隱藏卡名。
7. 防守資源保留只從己方 `PlayerView` 找可支付 Trap、Blocker、OnPlay／Stage／Item 能量，並要求對手戰鬥區有公開攻擊威脅；攻擊若把活躍支援降到保留線以下會扣分，保留資源並結束主要階段會獲得 bounded bonus。
8. 決策仍由規則層套用；timeout 回退 Lv.4，不使用半截搜尋 frontier。

## 公開回應 Min 與保留活躍能量

這一層不是完整的 opponent tree，也不是 MCTS。每個 Lv.5 搜尋節點只用該節點的
`PlayerView` 建立可重現的有限分支：

- `activeSupportCount = opponent.supportArea.filter(!rested).length`；
- `hiddenHandEnergyCapacity = min(opponent.handCount, activeSupportCount)`，只代表最多可支付幾張未知回應卡，不代表卡面已知；
- 公開區若能辨識 Block、Trap 或 `opponent-attack` capability，另加對應的 visible branch；
- 以攻擊者等級、公開 HP 張數與攻擊力計算暴露價值，選最壞分支寫入 `ActionScoreBreakdown` 與 search telemetry。

攻擊後的資源保留評估同樣不讀對手隱藏資訊。手牌有可支付 Trap、戰鬥區有可支付
Blocker，或手牌存在可支付 OnPlay／Stage／Item 能量時，建立最小保留線；只有在對手
戰鬥區有未休息且可攻擊的公開威脅時，Trap／Blocker 才會轉成防守預留。這使 Lv.5
不再把「每一回合所有餅乾都攻擊、把支援區耗光」視為固定最優：公開可斬殺或高收益
攻擊仍會勝出，低收益攻擊則可能讓位給保留活躍支援並結束主要階段。

`AiDecisionReason.opponentResponse`、`publicEvaluation` 與 `lv4Search` telemetry
保留分支、活躍支援、未知支付容量、保留線與調整值，供 replay、benchmark 與下一輪
champion–challenger 校準使用。

## 新卡池 gate

```text
candidate import
  -> runtime / strict contract
  -> npm run ai:audit:capabilities
  -> targeted rules + Browser A/B
  -> promote
  -> champion–challenger holdout
```

`ai:audit:capabilities` 的狀態定義：

- `ready`：runtime 全部可轉接，策略 extractor 沒有 `unsupported`。
- `conservative`：規則可執行，但策略尚未理解某些結構化 effect kind。
- `blocked`：存在無法轉成 runtime `GameCard` 的卡。

strict 模式只接受 `ready`。目前正式 inventory 1,244 筆（含異圖／變體），
依 `poolId` 合併後為 967 種唯一 runtime 機制、2,371 筆 capability evidence，
狀態為 `ready`；這只代表能力分類完整，不代表逐卡操作或勝率驗收完成。

## Benchmark 契約

執行：

```powershell
npm.cmd run benchmark:ai:challenger -- --seeds=10 --seed-start=401
npm.cmd run benchmark:ai:challenger -- --corpus=full --matchups=both --seeds=2 --seed-start=401
```

每個 seed、每副牌都跑兩場：challenger 先攻與後攻各一場，雙方使用同一副
牌組。報告分離 completion、stuck、invalid action、deadlock、turn cap、
逐牌組／逐 matchup 勝率、Combo started／completed／abandoned、終局預測次數與 Wilson 95% CI。

`--corpus=full` 使用 46 副 Starter／BS2–BS7 正式代表牌組；`--matchups=both`
同時包含 mirror 與輪替跨牌組。能力訓練母體仍是全部 1,244 筆正式 inventory，
未被代表牌組收錄的卡也必須先通過 capability strict gate。

升格門檻：

- 所有安全指標為 0、完成率 100%。
- 初篩 challenger 勝率至少 52%。
- 正式升格時 Wilson 95% CI 下界大於 50%。
- seed 與牌組不得參與同一輪調權；看過的 holdout 不可再稱 untouched。

## 目前證據與下一輪

本輪以看過的 calibration seeds 503–504 跑 46 副牌組、mirror＋輪替跨牌組、
先後攻換位共 368 場：179 勝（48.64%），安全指標全為 0；Combo started 3、
completed 3、abandoned 0。這證明嚴格公開門檻、合法時機與同一 plan 回填能
修正連段生命週期，但 calibration 不可作為升格證據。

隨後以新的 untouched seeds 601–602 跑相同全 corpus 共 368 場：Lv.5 186 勝
（50.54%），Wilson 95% CI 45.46%–55.62%；完成率 100%，stuck、invalid action、
deadlock、turn cap 全為 0。holdout 沒有自然發生 Combo 或 Refresh，記錄 7 次
空場無補位風險預測；Refresh 洗傷與 Combo 對齊改由 deterministic corpus 覆蓋。
結論是通用 Combo、付款預留與終局預測仍安全，但沒有升格證據；Lv.4 仍是
champion。後續只能使用新的 training seeds 與新的 holdout，不得針對弱勢牌組
或卡號寫例外。

2026-08-25 的第一輪泛化迭代將補位 HP 從單一公開平均值改為 PlayerView 可見餅乾
HP 的平滑分布，Refresh 風險以各 HP 路徑加權，不讀對手隱藏手牌或牌庫順序；同時
只對規則層已列出的、可支付且時機正確的 same-turn payoff setup 給有限機會分數，
Lv.4 對照組不套用。這些變更已補 deterministic regression，但尚未以新 holdout
重新估計正式升格勝率。新 seeds 701–702 的 368 場 diagnostic 完成率 100%、安全
指標全 0、Lv.5 186 勝（50.54%，Wilson 95% CI 45.46%–55.62%），Combo 8 啟動／
8 完成／0 放棄、終局預判 3 次且自然 Refresh 0；這批 seeds 已看過，不再作為後續
untouched holdout，因此不改變 champion–challenger 升格結論。

同日的部署節奏迭代針對真人對戰常見的「先下一張餅乾」原則：當我方戰鬥區已有一張
餅乾時，Lv.5 對一般第二張餅乾套用保守相對分數；只有 PlayerView 已確認的同回合
Combo、公開可斬殺、具有可辨識 OnPlay 效果，或對手至少兩張餅乾且我方有明確補防需求
時放寬。這是排序修正，不是合法性 gate；Lv.4 不套用，timeout fallback 也保留
同一規則的 Lv.5 保守部署。已看過的 matched seeds 801–802 從原本 174／368（47.28%）
變為 181／368（49.18%），Combo 4／4 完成、安全指標全 0；新的 holdout seeds
803–804 為 180／368（48.91%，Wilson 95% CI 43.84%–54.01%），完成率 100%、
stuck／invalid action／deadlock／turn cap 全 0，但 Combo 0、Refresh 0；最終 holdout
805–806 為 178／368（48.37%，Wilson 95% CI 43.31%–53.47%），Combo 5 啟動／5 完成、
Refresh 0，安全指標同樣全 0，仍不能升格。701–702、801–806 已看過，不再作為後續
untouched holdout；勝率改善是方向性證據，不代表已達 52% 或 Wilson 下界大於 50% 的
正式門檻。
