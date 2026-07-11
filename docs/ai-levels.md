# AI 等級分級設計

> **狀態：Lv.1–Lv.4 已實作完成；Lv.5 為設計稿，未實作。**
> **最後更新：2026-07-08（Phase 5）；2026-07-11 補充體感觀察結論。**

## Lv.5 投入前觀察（2026-07-11）

7 場 Lv.3/Lv.4 對局逐字紀錄讀過＋儀器化驗證，結論：結構健康、無急迫缺陷，建議暫緩 Lv.5 開發、先由使用者跑真人對局確認。完整方法與細節見 [ai-lv3-lv4-observation-2026-07-11.md](ai-lv3-lv4-observation-2026-07-11.md)。

## 等級總覽

| 等級 | 名稱 | 決策邏輯 | 規則 | 狀態 |
|---|---|---|---|---|
| Lv.1 | 隨機出招 | 從合法動作中隨機挑選；不主動使用技能 | 無 | ✅ 完成 |
| Lv.2 | 基礎戰術 | 啟發式：能出牌就出牌、攻擊最低 HP 目標、斬殺優先 | R1–R4, R6a | ✅ 完成 |
| Lv.3 | 評估式 | 對候選動作套用後以 PlayerView 評分，取最高分 | +R5, R6b, R7, R8 | ✅ 完成 |
| Lv.4 | 兩層前瞻 | 枚舉動作序列，對回合終局狀態評分 + 風險管理 | +R9, R10, lv4RiskBonus | ✅ 完成 |
| Lv.5 | 對抗性 | 在 Lv.4 之上加入對手回應期望值 | 未實作 | ⬜ 設計稿 |

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

## 規則系統（R1–R10）

| 規則 | 名稱 | 適用等級 | 狀態 |
|---|---|---|---|
| R1 | Break Level 意識 | Lv.2+ | ✅ Done |
| R2 | 集中火力 | Lv.2+ | ✅ Done |
| R3 | 早期侵略部署 | Lv.2+ | ✅ Done |
| R4 | 支援卡及早部署 | Lv.2+ | ✅ Done |
| R5 | 技能主動使用 | Lv.3+ | ✅ Done |
| R6a | 替補基礎品質篩選 | Lv.2+ | ✅ Done |
| R6b | 替補進階效果評分 | Lv.3+ | ✅ Done |
| R6c | 替補風險前瞻 | Lv.4+ | ⏸ Deferred |
| R7 | 陷阱防護高價值目標 | Lv.3+ | ✅ Done |
| R8 | 手牌數量管理 | Lv.3+ | ✅ Done |
| R9 | 致命傷害偵測 | Lv.4 | ✅ Done |
| R10 | 對手回應風險評估 | Lv.4 | ✅ Guardrail |

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
|---|---|---|
| `lv4RiskBonus` | evaluated-turn-handler.ts | 核心風險評分（不可刪除） |
| `lethalDetectionBonus` | evaluated-turn-handler.ts | R9 致命偵測 |
| `responseRiskPenalty` | evaluated-turn-handler.ts | R10 break 惡化 guardrail |

## 已知問題

1. `opencode-go-benchmark.test.js has no test suite`（pre-existing；2026-07-11 隨 deepseek-v4-flash 退出派工清單重排後，suite 仍未載入，需另案處理）
2. Lv.4 vs Lv.3 = 73.3%，接近 75% 警戒線
3. Lv.3 vs Lv.1 = 100%（ceiling effect，擴大牌組池後需重新驗證）
4. 勝利條件為 `break >= 10`（非 12），所有規則已修正為正確閾值

## 測試狀態

```text
1435 passed, 1 suite failed
pre-existing issue: opencode-go-benchmark.test.js has no test suite
Invalid Actions: 0
Deadlocks: 0
Hidden Info Access: 0
```
