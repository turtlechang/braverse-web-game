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
5. 決策仍由規則層套用；timeout 回退 Lv.4，不使用半截搜尋 frontier。

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
