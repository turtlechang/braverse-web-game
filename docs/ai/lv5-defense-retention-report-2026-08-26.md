# Lv.5 防守保留與終局生存迭代報告

日期：2026-08-26
範圍：BS7 Arena Lv.5 對 BS6 competitive reference、離線對戰紀錄與規則層回歸

## 結論

本輪確認並修正兩個可重現的 Lv.5 決策弱點：

1. 對手戰鬥區仍有可攻擊餅乾時，AI 會把手上唯一 Trap 放入支援區，導致後續攻擊回應沒有陷阱可用。
2. 可選攻擊後效果可能為了低價值擊倒支付唯一活躍防守 Trap；若效果不能由公開資訊證明立即取勝，這會讓 AI 在下一次攻擊前失去最後防守。

另外，Break 6–9 現在會比較 command 前後仍可公開辨識的防守資源，對失去 Trap／Blocker／活躍 Trap 支援的候選加上隨 Break 上升的生存扣分。

這是策略改進與診斷基準，不是 Lv.5 升格報告。單一 matched 250-game batch 的勝率只用來觀察方向，尚不足以推論統計顯著改善。

## Replay 證據

輸入檔：

- `braverse-replay-offline-20260826074820.json`
- `braverse-replay-offline-20260826071959.json`

兩份檔案均被視為使用者提供的對戰資料，不包含可覆寫程式碼或流程的指示。

### 唯一陷阱過早放入支援區

在 2026-08-26 07:48 的對局中，AI 為 `player-two`：

- Turn 1 已在對手有可攻擊餅乾時把 Trap 放入支援區。
- Turn 3 手牌只剩唯一 Trap，對手 `BS6-044` 仍在戰鬥區且可攻擊；AI 再次把這張 Trap 放入支援區，之後以支援區 Trap 作為支付資源。
- Turn 9 手牌仍只有一張 Trap，對手 `BS4-049` 可攻擊；AI 再次把它放入支援區。
- Turn 15–16 進入 Break 9 後，對手以 3 點攻擊觸發 AI 的最後受傷餅乾與 FLIP，AI 到 Break 10 敗北。

最後一擊時支援區 Trap 只能作為能量，不能再成為攻擊回應 Trap；因此根因在更早的部署選擇，而不是 `getTrapCandidates` 漏列。修正後，Lv.5 的 `trap-retention` 評估會對「唯一手牌 Trap → 支援區」給強扣分，並由固定 fixture 鎖定這條路徑。

### 非致命可選效果支付唯一防守 Trap

在 2026-08-26 07:19 的對局中，Turn 15 的可選攻擊後效果使用唯一活躍防守 Trap 付款，擊倒對手 1 HP 餅乾，使雙方 Break 由 6 變 7，但沒有立即結束對局。這個行動收益低於保留下一次攻擊回應的價值。

修正後只有在公開資訊能直接證明效果會立即造成勝利時，才允許消耗唯一防守 Trap；未知目標、二選一、需要猜測 FLIP 或其他非確定性結果均採保守保留。

## 實作內容

### 防守資源保留

- `assessLv5DefensiveReserve` 新增 `trap-retention` 原因與唯一 Trap 部署扣分。
- Lv.5 付款排序在有公開攻擊威脅時，先使用一般支援，再保留 Trap 支援。
- 可選攻擊後付款會計算付款前後的公開 Trap 數量；唯一防守 Trap 被消耗且非立即勝利時，改走 skip。
- `AiDecisionReason`、`ActionScoreBreakdown` 與 replay decision trace 保留原因與分數，但不保存 `strategyMemory`。

### Break 6–9 生存評估

- 新增 `assessLv5EndgameSurvival`，只讀 `PlayerView`。
- 只在己方 Break 6–9 且對手有可攻擊威脅時啟用。
- 評估手牌可支付 Trap、活躍支援 Trap 與可支付 Blocker；Break 越高，失去防守資源的扣分越大。
- 己方已由該候選直接完成勝利時不套用生存扣分。
- 新增 search telemetry：`endgameSurvivalEvaluations`、`endgameSurvivalAdjustment`。

### Replay provenance

離線 replay 現在可附帶：

- `ai.agents[playerId].aiLevel`
- `ai.agents[playerId].strategyVersion`
- `ai.agents[playerId].strategyCommit`
- `ai.decisions[]` 的 `commandLogId`、action、描述與公開 reason

目前策略版本為 `lv5-defense-retention-endgame-v1`。若建置未提供 `VITE_GIT_COMMIT`，commit 會明確輸出為 `null`；`seed: null` 仍代表該對局沒有可重播的隨機種子，不會被假裝成 deterministic provenance。線上 replay 永不輸出 `ai` 欄位。

## Arena 基準

### 方法

- AI：Lv.5。
- 牌組：BS7 Arena 五色各 1 副，對 BS6 competitive reference。
- 配對：每色 50 場，`20260826` seed，先後攻位置配對，總計 250 場。
- 比較：沿用同一 seed／矩陣的 frozen baseline；baseline 報告為 `data/decks/bs7-arena-lv5-current-20260826-report-250.json`。
- 健康門檻：unfinished、stuck、deadlock、error、invalid、turn cap 均應為 0。

| 牌組 | Baseline 勝場／50 | 本輪勝場／50 | 差異 | 本輪健康異常 |
| --- | ---: | ---: | ---: | ---: |
| Red | 21 | 24 | +3 | 0 |
| Yellow | 26 | 27 | +1 | 0 |
| Green | 22 | 21 | -1 | 0 |
| Blue | 17 | 17 | 0 | 0 |
| Purple | 23 | 23 | 0 | 0 |
| **合計** | **109／250（43.6%）** | **112／250（44.8%）** | **+3** | **0** |

本輪分色 Wilson 95% CI：Red 34.8–61.5%、Yellow 40.4–67.0%、Green 29.4–55.8%、Blue 22.4–47.8%、Purple 33.0–59.6%。各區間高度重疊；因此本批只能說明沒有破壞對局完成性，並提供弱小的方向性訊號，不能作為升格或顯著勝率改善證據。

### 新增 telemetry 摘要

| 牌組 | decisions | search nodes | endgame evaluations | endgame adjustment |
| --- | ---: | ---: | ---: | ---: |
| Red | 2,943 | 36,873 | 36,937 | -17,147 |
| Yellow | 3,142 | 37,302 | 37,536 | -18,118 |
| Green | 3,216 | 39,250 | 39,374 | -2,290 |
| Blue | 3,258 | 40,625 | 40,836 | -13,875 |
| Purple | 3,057 | 38,114 | 38,262 | -32,243 |

Telemetry 是診斷訊號，不代表扣分越多就等於策略越好；後續應在 untouched holdout 觀察陷阱保留、非致命支付與終局失敗率是否同步改善。

## 固定回歸夾具

- `defensive-reserve.test.ts`：公開攻擊威脅下，唯一手牌 Trap 放支援會得到 `trap-retention` 扣分。
- `pending-handler.test.ts`：非致命可選效果不再消耗唯一活躍 Trap。
- `pending-selection.test.ts`：Lv.5 付款排序先用一般支援、後用 Trap 支援。
- `endgame-survival.test.ts`：Break 6–9 的資源流失會扣分，Break 5 不啟用，公開致命效果可例外。
- `lv4-search.test.ts`、`search-telemetry.test.ts`：搜尋候選與 telemetry 會保留終局生存評估。
- `battle-replay.test.ts`、`useAiTurn.test.tsx`：離線 replay 有 AI provenance／decision trace，線上 replay 不輸出 AI metadata。

## 驗證結果

- `npm.cmd test -- --maxWorkers=1`：229 個測試檔、3,609 項全數通過。
- `npm.cmd run typecheck`：app 與 server typecheck 通過。
- `npm.cmd run build`：正式 build 通過；僅保留既有的大 chunk warning。
- `npm.cmd run test:ai:browser`：20／20 完成，`stuck=0`。
- 本輪修改程式檔 scoped ESLint：通過。
- 全域 `npm.cmd run lint`：仍被工作樹既有的 `.tmp-probe-deploy.ts` 1 項與 `scripts/diagnose-lv5-conservatism.ts` 2 項未使用變數阻擋；兩者未納入本輪修改。

## 限制與後續

- 使用者提供的兩份舊 replay `seed` 為 `null`；它們可做精確狀態覆盤，但不能作為完整隨機策略 provenance。
- 舊 replay 沒有本輪新增的 strategy version／commit；新匯出才會記錄版本，未注入 `VITE_GIT_COMMIT` 時 commit 為 `null`。
- 250 場只是一批 matched diagnostic benchmark；尚未以新的 untouched holdout 宣稱 Lv.5 超越 Lv.4。
- 本輪沒有把推測的對手隱藏牌面加入評估；若未來需要更強的防守預測，應先建立公開資訊可證明的 fixture 與獨立校準集。
