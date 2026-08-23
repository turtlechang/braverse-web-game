# AI 等級分級設計

> **狀態：Lv.1–Lv.4 已實作完成；Lv.5 challenger 已進入實驗驗證，尚未通過對 Lv.4 的升格勝率門檻。**
> **最後更新：2026-08-23（Lv.5 Combo／終局預測迭代）。**

## Lv.5 投入前觀察（2026-07-11）

7 場 Lv.3/Lv.4 對局逐字紀錄讀過＋儀器化驗證，結論：結構健康、無急迫缺陷，建議暫緩 Lv.5 開發、先由使用者跑真人對局確認。完整方法與細節見 [ai-lv3-lv4-observation-2026-07-11.md](ai-lv3-lv4-observation-2026-07-11.md)。

## 等級總覽

| 等級 | 名稱 | 決策邏輯 | 規則 | 狀態 |
|---|---|---|---|---|
| Lv.1 | 隨機出招 | 從合法動作中隨機挑選；不主動使用技能 | 無 | ✅ 完成 |
| Lv.2 | 基礎戰術 | 啟發式：能出牌就出牌、攻擊最低 HP 目標、斬殺優先 | R1–R4, R6a | ✅ 完成 |
| Lv.3 | 評估式 | 對每個合法候選輸出 `ActionScoreBreakdown`，以結構化能力、牌組 profile、已知資訊與公開局面一步評分 | +R5, R6b, R7, R8, R12–R15 | ✅ 完成 |
| Lv.4 | 多步規劃 | 有限 beam command search（w=5, d=5, 240 nodes, 150ms）、R16 資源預留；timeout 回退 Lv.3 | +R9, R10, R11, R12–R16, lv4RiskBonus | ✅ 完成 |
| Lv.5 | 高手對抗（實驗） | Lv.4 搜尋（w=6, d=6, 360 nodes, 180ms）＋公開記憶／回應期望＋通用 ComboPlan＋終局洗傷與空場預測；timeout 回退 Lv.4 | +R17–R20 | 🧪 challenger；尚未升格 |

Lv.5 的「對手回應／終局預測」只使用公開手牌與牌庫張數、公開卡牌能力、
棄牌區、Break 與戰鬥區 HP，不是讀取實際隱藏手牌，也不是完整 opponent
tree。2026-08-23 全 corpus untouched holdout（46 副牌組、mirror＋輪替跨
牌組、seeds 401–402、先後攻換位）為 186／368（50.54%，Wilson 95% CI
45.46%–55.62%），`stuck`、invalid action、deadlock、turn cap 均為 0；
因此目前證明安全與架構落地，**仍未證明勝率優於 Lv.4**。

## 勝率驗收（seeds 1–30）

| Matchup | 目標 | 實際 | 狀態 |
|---|---|---|---|
| Lv.2 vs Lv.1 | ≥ 60% | 83.3% | ✅ PASS |
| Lv.3 vs Lv.2 | ≥ 58% | 66.7% | ✅ PASS |
| Lv.4 vs Lv.3 | 60%–75% | 73.3% | ✅ PASS |
| Lv.3 vs Lv.1 | ≥ 65% | 100.0% | ✅ PASS（ceiling effect） |
| Lv.4 vs Lv.1 | ≥ 70% | 93.3% | ✅ PASS |

### 上限警戒

- Lv.4 vs Lv.3 > 75%：需審核是否過強
- Lv.4 vs Lv.3 > 80%：暫停，必須降權或回滾

## 規則系統（R1–R20）

| 規則 | 名稱 | 適用等級 | 狀態 |
|---|---|---|---|
| R1 | Break Level 意識 | Lv.2+ | ✅ Done |
| R2 | 集中火力 | Lv.2+ | ✅ Done |
| R3 | 早期侵略部署 | Lv.2+ | ✅ Done（已有戰鬥區時優先非 FLIP；僅在無替代或可補刀時部署 FLIP） |
| R4 | 支援卡及早部署 | Lv.2+ | ✅ Done |
| R5 | 技能主動使用 | Lv.3+ | ✅ Done |
| R6a | 替補基礎品質篩選 | Lv.2+ | ✅ Done |
| R6b | 替補進階效果評分 | Lv.3+ | ✅ Done |
| R6c | 替補風險前瞻 | Lv.4+ | ⏸ Deferred |
| R7 | 陷阱防護高價值目標 | Lv.3+ | ✅ Done |
| R8 | 手牌數量管理 | Lv.3+ | ✅ Done |
| R9 | 致命傷害偵測 | Lv.4 | ✅ Done |
| R10 | 對手回應風險評估 | Lv.4 | ✅ 完整版（F0 + F1） |
| R11 | 不浪費已合法攻擊機會 | Lv.4 | ✅ Done |
| R12 | 結構化卡牌能力辨識 | Lv.3+ | ✅ Done |
| R13 | 動態牌組策略推導 | Lv.3+ | ✅ Done |
| R14 | 已知資訊安全記憶 | Lv.3+ | ✅ Done |
| R15 | Setup／Payoff 計畫評分 | Lv.3+ | ✅ Done |
| R16 | 指令順序與資源預留 | Lv.4 | ✅ Done |
| R17 | 公開資訊對手回應期望 | Lv.5 | 🧪 已接入；待 champion–challenger 校準 |
| R18 | 同一 ComboPlan 前置／收益配對與生命週期 | Lv.5 | 🧪 已接入；不同 plan 不得誤完成 |
| R19 | Combo payoff 能量張數與顏色預留 | Lv.5 | 🧪 已接入；只採規則層與公開支援資訊 |
| R20 | 對手牌庫耗盡、Refresh 洗傷與空場敗北預測 | Lv.5 | 🧪 已接入；隱藏手牌只做公開機率估計 |

### R6c Deferred 理由

Lv.4 替補風險審查結果（30 games, 99 replacements）：
- Low Quality: 6（6.1%）
- Forced (≤2 candidates): 4/6 — 手牌 RNG，AI 無法改善
- Non-forced LQ: 2 — 極低
- Break Worsened: 0

Revisit 條件：新高強度牌組、Lv.5 實作、非強制 LQ 增加、break worsening。

## 資訊邊界（防作弊）

所有等級一律只能讀取：
- **可讀**：雙方戰鬥區、支援區、棄牌區、Break 區、雙方手牌張數、牌庫張數、自己的手牌內容、已公開的卡牌
- **不可讀**：對手手牌內容、牌庫順序、face-down HP 卡內容

`PlayerView` 是過濾器：把 `GameState` 過濾成單一玩家可見資訊後才交給評分函式。

### Lv.4 特殊組件

| 組件 | 位置 | 說明 |
|---|---|---|---|
| `searchLv4Commands` | `ai/strategy/lv4-search.ts` | width 5、depth 5、240 nodes、150ms 的合法 command 搜尋；timeout 不採半截 frontier，直接回退 Lv.3 |
| `resource-reservation` | `ai/strategy/resource-reservation.ts` | 從規則層列出的 attack payment 保留最小付款資源（R16） |
| `search-telemetry` | `ai/strategy/search-telemetry.ts` | 搜尋時間、節點、timeout／fallback、setup/payoff、未知／未支援與資源預留 telemetry |
| `beamStepBonus` | evaluated-turn-handler.ts | 每一步公開風險修正（attackBonus/R9/R10/R8/R11/cookieSupportPenalty）；攻擊進入 pending 後不自動結算 |
| `lv4RiskBonus` | evaluated-turn-handler.ts | 核心風險評分（不可刪除） |
| `lethalDetectionBonus` | evaluated-turn-handler.ts | R9 致命偵測 |
| `responseRiskPenalty` | evaluated-turn-handler.ts | R10 完整版：F0 break race risk guardrail + F1 attacker 反擊暴露 |

### Lv.5 challenger 組件

| 組件 | 位置 | 說明 |
|---|---|---|
| `AiStrategyMemory` | `ai/strategy/session.ts` | 每場持久保存合法 `KnowledgeState`、上一個 command 與 setup/payoff/tempo 意圖；forced pending 不覆蓋意圖 |
| `estimateOpponentResponse` | `ai/strategy/opponent-response.ts` | 只從 `PlayerView` 的公開手牌張數與公開卡牌 capability 估計攻擊回應曝險 |
| `ComboPlan` | `ai/strategy/combo-plan.ts` | 由 capability synergy edge 自動建立穩定 plan ID、前置／收益、付款與有效期；不使用系列或卡號特判 |
| Combo lifecycle | `ai/strategy/session.ts` | 只讓相同 plan 的 confirmed setup 完成 payoff，跨步記錄 started／completed／abandoned |
| `forecastOpponentEndgame` | `ai/strategy/endgame-forecast.ts` | 由公開牌庫／手牌張數、棄牌區最低 LV、Break 與最後一隻餅乾 HP 預判補位、Refresh 洗傷及無餅乾敗北 |
| Lv.5 search budget | `ai/strategy/lv4-search.ts` | 重用隱藏資訊安全搜尋器，擴為 width 6、depth 6、360 nodes、180ms；未知抽牌仍停止展開 |
| capability audit | `scripts/audit-ai-capabilities.ts` | 對 1,244 筆正式 inventory／967 種唯一 runtime 機制輸出 ready/conservative/blocked；`--strict` 阻擋不支援效果 |
| challenger gate | `scripts/benchmark-ai-challenger.ts` | 支援 BS7 快速矩陣及 `--corpus=full --matchups=both` 的 46 副全代表牌組 mirror／輪替跨牌組、先後攻換位 |

全 corpus holdout 實際記錄 36 次 Combo 啟動、6 次完成、19 次放棄，以及
5 次打空戰鬥區的無補位風險預測；該樣本未自然遇到 Refresh 終局，洗傷
路徑另以專門 fixture 驗證。這些 telemetry 是後續改善完成率的依據，不能
單獨當成勝率提升證據。

## 已知問題

1. `opencode-go-benchmark.test.js has no test suite`（pre-existing；2026-07-11 隨 deepseek-v4-flash 退出派工清單重排後，suite 仍未載入，需另案處理）
2. Lv.4 vs Lv.3 = 73.3%，接近 75% 警戒線
3. Lv.3 vs Lv.1 = 100%（ceiling effect，擴大牌組池後需重新驗證）
4. 勝利條件為 `break >= 10`（非 12），所有規則已修正為正確閾值

### 2026-07-31：beam search 上線曾讓 R8/R9/R10 變成死碼（已修正）

> 此節保留舊版問題的歷史背景；目前正式路徑已由 G4 `searchLv4Commands` 取代，不再自動結算攻擊來推演未知防守回應。

R10 完整版（F1 attacker 反擊暴露）與回合層 beam search 是同一天先後兩個 commit。
beam search 把 `handleAiTwoPlyTurnState` 的主要評分路徑換成
`beamSearchBestFirstCommand`（只用 `stateScore` = `evaluatePlayerView` +
`lv4RiskBonus`），而 `attackBonus`／`lethalDetectionBonus`（R9）／
`responseRiskPenalty`（R10）／`handManagementBonus`（R8）／
`cookieSupportPenalty` 全部只存在於 `twoPlyCandidateScore` 這條
fallback 路徑。由於 `getLegalTurnCommands` 一律含 `advance-phase`
（見 legal-actions.ts），beam 幾乎不可能回傳 `null`，fallback 在真實
對局中打不到——實測 60 局 Lv.4 vs Lv.3，`r10ExposureRiskCount` /
`r10BreakRaceRiskCount` / `r10PenaltyAppliedCount` 全部是 0。

修正：新增 `beamStepBonus`，在 beam 展開每一步（`preState → postState`
套用 `command`）都疊加同一套單步修正，沿路徑累加進 `BeamEntry.pathBonus`，
最終分數為 `stateScore(終局) + pathBonus`。已補上整合層回歸測試
（`ai-beam-search.test.ts`：直接呼叫 `handleAiTwoPlyTurnState`，驗證
`getR10Counters()` 真的會變化，而不是只測 `responseRiskPenalty`
純函式）。300 seeds 驗證：Lv.4 vs Lv.3 從（死碼狀態下）59.3% 降為
56.7%——R10 開始真的抑制某些會暴露反擊風險的攻擊，屬預期內的保守化，
未觸發任何上限或下限警戒。

## Lv.5 升格條件

1. 全部配對對局完成，`stuck`、invalid action、deadlock、turn cap 必須為 0。
2. training／validation／holdout seed 不可混用；調權後必須換一組 untouched holdout。
3. 五色與先後攻都要雙邊換位，不以單一有利牌組或單一 seed 宣稱提升。
4. 初篩勝率至少 52%；正式取代 Lv.4 champion 前，Wilson 95% CI 下界需大於 50%。
5. 新卡池先通過 `npm run ai:audit:capabilities`，不支援能力不得靜默當作已理解。
6. 「全卡池訓練」包含全部正式 inventory 印刷記錄；異圖以同 `poolId` 合併為唯一機制學習，對局 gate 則使用 46 副 Starter／BS2–BS7 正式代表牌組。
