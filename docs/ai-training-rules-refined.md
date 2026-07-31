# AI 訓練規則（精煉版）

> **版本**: v2.0 | **日期**: 2026-07-08（Phase 5 final）
> **來源**: 20+ 份 `docs/ai-training-bs2-*.md` 訓練紀錄提煉
> **狀態**: Lv.2–4 規則全部實作完成，R6c Deferred

---

## 規則總覽

| ID | 規則名稱 | Lv.2 | Lv.3 | Lv.4 | 優先度 | 主要實作位置 |
|---|---|:---:|:---:|:---:|---|---|
| R1 | Break Level 意識 | ✓ | ✓ | ✓ | CRITICAL | `bs2MatchupProfiles.ts` |
| R2 | 集中火力（不分散傷害） | ✓ | ✓ | ✓ | HIGH | `turn-handler.ts` |
| R3 | 早期侵略部署 | ✓ | ✓ | ✓ | MEDIUM | `turn-handler.ts` |
| R4 | 支援卡及早部署 | ✓ | ✓ | ✓ | MEDIUM | `turn-handler.ts` |
| R5 | 技能主動使用 | - | ✓ | ✓ | MEDIUM | `evaluated-turn-handler.ts` |
| R6a | 替補基礎品質篩選 | ✓ | ✓ | ✓ | HIGH | `ai.ts` (chooseReplacement) |
| R6b | 替補進階效果評分 | - | ✓ | ✓ | MEDIUM | `bs2MatchupProfiles.ts` |
| R6c | 替補風險前瞻 | - | - | ⏸ Deferred | MEDIUM | `evaluated-turn-handler.ts` |
| R7 | 陷阱防護高價值目標 | - | ✓ | ✓ | LOW | `battle-handler.ts` |
| R8 | 手牌數量管理 | - | ✓ | ✓ | LOW | `evaluated-turn-handler.ts` |
| R9 | 致命傷害偵測 | - | - | ✓ | CRITICAL | `bs2MatchupProfiles.ts` |
| R10 | 對手回應風險評估 | - | - | ✓ | HIGH | `evaluated-turn-handler.ts` |

**Lv.2 = 5 條（R1–R4, R6a）· Lv.3 = 9 條（+R5, R6b, R7, R8）· Lv.4 = 12 條（+R6c, R9, R10）**

---

## 規則定義

### R1: Break Level 意識

```
RULE: maximize-break-level-per-KO
PRIORITY: CRITICAL
CONDITION: Always
ACTION:
  - 優先攻擊能被擊倒的餅乾
  - 多個目標時，優先選高等級目標
  - 追蹤對手破壞區等級，接近 10 時計算是否能致勝
RATIONALE: 勝利條件是 break-level-limit (10)。每次擊倒都應貢獻最大破壞區等級。
MEASURED IMPACT: Red 牌組在勝利時平均 AI 破壞區 6.9，敗方 10.4。
```

**來源**: `bs2-matchup-training-rules.md` Rule 1, Rule 6, Rule 10
**適用等級**: Lv.2+
**實作位置**: `bs2MatchupProfiles.ts` (scoreAttackTarget), `evaluated-turn-handler.ts` (lv4RiskBonus)

---

### R2: 集中火力（不分散傷害）

```
RULE: concentrate-damage-on-weak-targets
PRIORITY: HIGH
CONDITION: Multiple enemy cookies in battle area
ACTION:
  - 將攻擊集中在最弱的敵方餅乾直到擊倒
  - 不要分散傷害到多個餅乾
  - 擊倒後立即轉向下一個目標
RATIONALE: 擊倒餅乾貢獻破壞區等級。分散傷害會浪費攻擊。
MEASURED IMPACT: 分散傷害導致玩家破壞區等級更高但仍輸掉比賽。
```

**來源**: `bs2-matchup-training-rules.md` Rule 2
**適用等級**: Lv.2+
**實作位置**: `turn-handler.ts` (chooseAttackTarget 優先選能一擊擊殺的)

---

### R3: 早期侵略部署

```
RULE: early-aggression-window
PRIORITY: MEDIUM
CONDITION: Turns 1-8
ACTION:
  - 立即部署最高等級餅乾
  - 每回合都嘗試攻擊
  - 放置能提升攻擊力的支援卡
RATIONALE: 早期建立場面壓力。75.9% 的敗局發生在 13-18 回合。
```

**來源**: `bs2-matchup-training-rules.md` Rule 3
**適用等級**: Lv.2+
**實作位置**: `turn-handler.ts` (support phase 部署邏輯)

---

### R4: 支援卡及早部署

```
RULE: support-card-deployment
PRIORITY: MEDIUM
CONDITION: Support phase
ACTION:
  - 進入主要階段前先部署攻擊提升物品/場景
  - 優先影響多個餅乾的卡牌
  - 不要囤積支援卡，儘早部署以累積效益
RATIONALE: 支援效果跨多回合累積。延遲部署浪費價值。
```

**來源**: `bs2-matchup-training-rules.md` Rule 4
**適用等級**: Lv.2+
**實作位置**: `turn-handler.ts` (support phase)

---

### R5: 技能主動使用

```
RULE: activate-skills-proactively
PRIORITY: MEDIUM
CONDITION: Activate phase with valid skill available
ACTION:
  - 發動造成傷害或移除敵方餅乾的技能
  - 發動抽牌/搜尋效果維持手牌優勢
  - 不要為了「完美時機」而保留技能
RATIONALE: 技能是免費價值。延遲發動會失去節奏。
```

**來源**: `bs2-matchup-training-rules.md` Rule 5
**適用等級**: Lv.3+
**實作位置**: `evaluated-turn-handler.ts` (candidate enumeration 中技能候選評分)

---

### R6a: 替補基礎品質篩選

```
RULE: replacement-basic-quality
PRIORITY: HIGH
CONDITION: Cookie knocked out, replacement needed
ACTION:
  - 使用公式 (Level × 3) + (HP × 2) 計算基礎分數
  - 選擇分數最高的餅乾替補
  - 永遠不要用 Lv.1 HP-1 餅乾替補（除非沒有其他選擇）
RATIONALE: 替補 AI 是目前最大漏洞。Lv.2 統一部署最低 HP 餅乾，導致破壞區等級飆升。
MEASURED IMPACT: 訓練紀錄反覆指出此問題是敗因 #1。
```

**來源**: 20+ 份訓練紀錄共同指出
**適用等級**: Lv.2+
**實作位置**: `ai.ts` (chooseReplacement) + `bs2MatchupProfiles.ts` (scoreReplacement)

---

### R6b: 替補進階效果評分

```
RULE: replacement-advanced-evaluation
PRIORITY: MEDIUM
CONDITION: Cookie knocked out, replacement needed
ACTION:
  - 在 R6a 基礎分上疊加 Effect_Value（技能/登場效果價值）
  - 考慮場面需求（需要攻擊手還是防禦手）
  - 考慮後續風險（替補後是否容易被移除）
RATIONALE: 基礎分數不夠，需要根據當前局面動態調整。
```

**來源**: `bs2-matchup-training-rules.md` Rule 7 + 訓練分析
**適用等級**: Lv.3+
**實作位置**: `bs2MatchupProfiles.ts` (scoreReplacement 增強)

---

### R6c: 替補風險前瞻（Deferred）

```
RULE: replacement-risk-lookahead
PRIORITY: MEDIUM
STATUS: DEFERRED — 審查後決定不實作
CONDITION: Cookie knocked out, replacement needed
ACTION:
  - 模擬替補後對手下一回合可能的行動
  - 評估替補餅乾被反殺的風險
  - 在高風險時選擇更安全的替補（或不替補）
RATIONALE: 替補不是獨立決策，必須考慮對手回應。
DEFERRED REASON: Lv.4 替補風險審查結果：
  - 99 次替補中僅 6 次低品質（6.1%）
  - 其中 4 次為 forced choice（候選 ≤2）
  - 非強制低品質僅 2 次
  - 替補後 break 惡化次數 = 0
  - 當前不需要額外風險前瞻
REVISIT WHEN:
  - 新增高強度牌組
  - Lv.5 實作
  - 非強制低品質替補數增加
  - 替補造成 break 惡化或敗局
```

**來源**: 訓練分析中「對手反擊風險」觀察
**適用等級**: Lv.4+
**實作位置**: `evaluated-turn-handler.ts` (兩層前瞻中替補候選評分)
**狀態**: ⏸ Deferred — 2026-07-08 審查後決定不實作

---

### R7: 陷阱防護高價值目標

```
RULE: defensive-trap-usage
PRIORITY: LOW
CONDITION: Enemy attacking a high-value cookie
ACTION:
  - 使用陷阱/防護者保護 Lv.3 餅乾
  - 不要浪費防禦資源在 Lv.1 餅乾上
  - 考慮每次防禦決策對破壞區等級的影響
RATIONALE: 保護高價值餅乾能阻止對手破壞區等級進展。
```

**來源**: `bs2-matchup-training-rules.md` Rule 8
**適用等級**: Lv.3+
**實作位置**: `battle-handler.ts`

---

### R8: 手牌數量管理

```
RULE: maintain-hand-size
PRIORITY: LOW
CONDITION: Hand size below 3
ACTION:
  - 優先使用抽牌效果
  - 除非成本要求，否則不棄牌
  - 保持至少 2 張手牌以維持靈活性
RATIONALE: 手牌過少限制選擇。手牌是未來的潛在行動。
```

**來源**: `bs2-matchup-training-rules.md` Rule 9
**適用等級**: Lv.3+
**實作位置**: `evaluated-turn-handler.ts` (evaluatePlayerView 中 handCount 權重)

---

### R9: 致命傷害偵測

```
RULE: lethal-calculation
PRIORITY: CRITICAL
CONDITION: Enemy break level >= 8
ACTION:
  - 計算所有可用傷害總和
  - 如果總傷害 >= (10 - enemy_break_level)，發動致勝攻擊
  - 優先選擇能推過 10 的攻擊組合
  - 如果致勝可用，不要浪費攻擊在非致勝目標上
RATIONALE: 比賽由 break level limit (10) 決定。錯過致勝機會是敗因 #1。
```

**來源**: `bs2-matchup-training-rules.md` Rule 10 重寫
**適用等級**: Lv.4+
**實作位置**: `evaluated-turn-handler.ts` (lethalDetectionBonus)

---

### R10: 對手回應風險評估

```
RULE: opponent-response-risk
PRIORITY: HIGH
CONDITION: Always during evaluation
ACTION:
  - 評估每個動作後對手的反擊能力
  - 考慮 FLIP、陷阱、昏厥效果的觸發機率
  - 避免短期賺分但長期崩盤的動作
  - 使用公開資訊推估對手手牌張數與威脅
RATIONALE: AI 不是單人遊戲，必須考慮對手回應。
```

**來源**: 訓練分析中「對手反擊風險」觀察 + Lv.5 設計稿簡化
**適用等級**: Lv.4+
**實作位置**: `evaluated-turn-handler.ts` (`responseRiskPenalty`，疊加於 `lv4RiskBonus` 之上)

**實作細節（完整版，2026-07-31）**:

`responseRiskPenalty` 純函式只讀取**公開資訊**（自我/對手戰鬥區、break area、對手 `hand.length`），回傳非正值（負 = 風險）。caller 以 `+= responseRiskPenalty(...)` 疊加做扣分（修正了先前 caller 用 `-= responseRiskPenalty(...)` 導致「負 × 負 = 加分」的方向 bug）。

兩個 factor：

1. **F0 Break race risk**（保留既有 guardrail）
   - 觸發：`preMyBreak >= 8` 且 `postMyBreak > preMyBreak`（我方行動後 break 惡化）
   - 罰分：`-breakWorsened * 12`
   - 計數：`r10BreakRaceRiskCount`
2. **F1 Attacker 反擊暴露**（完整版新增，補 `lv4RiskBonus` 不讀對手手牌與未休息攻擊力的缺口）
   - 觸發（全部用公開資訊）：
     - `command.kind === 'attack'`
     - `post` attacker 仍存活、休息中（`rested === true`）、`level >= 2`
     - 我方 `preMyBreak >= 6`（被反擊破會擴大 break race）
     - 對手未休息戰鬥區總攻擊力 `>= attacker.hpCards.length`（可擊倒 attacker）
     - `oppHandCount >= 3`（FLIP／陷阱反擊加碼的 proxy）
   - 罰分：`-(12 + (level - 2) * 6 + min(oppHandCount - 3, 3) * 2)`，封頂約 -24
   - 計數：`r10ExposureRiskCount`

**設計取捨**: 純把罰分組合疊在 score，不做 condition gate（門檻式開關）。case 3 lesson 已驗證「門檻式 gating 會在 600 seeds 顯現真實 regression」，組合式 penalty 才安全。

**驗證**:
- 11 條 `ai-r10-risk.test.ts` 純函式行為測試覆蓋 F0 / F1 全部分支與邊界（觸發、level < 2、opp 攻擊不足、oppHand < 3、preMyBreak < 6、post attacker 已破、F0 累積、F0+F1 合計、手牌加成封頂）
- 2370 套全綠（2359 + 11）
- 300 seeds 對稱／非對稱 benchmark 五場全 PASS：Lv.4 vs Lv.3 = 59.3%（與 case 3 baseline 完全一致），Lv.4 vs Lv.1 = 96.7%。R10 完整版在 300 seeds 下 F1 於 Lv.4 vs Lv.3 對局觸發 108 次（case 3 baseline 同場觸發 0 次），但勝率不變——因 penalty 純疊加 design 確保只做小幅度 refine，不致改變策略選擇。

---

## 等級行為差異矩陣

| 行為面向 | Lv.2 | Lv.3 | Lv.4 |
|---|---|---|---|
| **思考深度** | 看當下局面 | 評估一步結果 | 兩層前瞻 |
| **替補策略** | R6a 基礎公式 | R6a + R6b 效果評分 | R6a + R6b（R6c Deferred） |
| **攻擊目標** | R2 集中火力 + R1 Break Level | 同 Lv.2 + 評估式打分 | 同 Lv.3 + R9 致命偵測 |
| **技能使用** | 不主動使用 | R5 主動使用 | 同 Lv.3 |
| **風險管理** | 無 | 基本（evaluatePlayerView） | R10 對手回應評估 |
| **手牌管理** | 無 | R8 基本管理 | 同 Lv.3 |
| **陷阱使用** | 被動觸發 | R7 保護高價值目標 | 同 Lv.3 |

---

## 牌組平衡觀察（本次不修改）

| 牌組 | 強度 | 主要問題 |
|---|---|---|
| Red | S (59%) | 過強，Lv3 密度高，攻擊集中 |
| Yellow | A (48%) | 平衡，手牌干擾有效 |
| Bean | B (28%) | 過弱，Lv3 密度低，節奏慢 |
| Blue | C | 弱，依賴抽牌，早期脆弱 |
| Purple | C | 弱，控制風格需要時間 |

> 牌組平衡應獨立開後續任務處理，本次只改 AI 邏輯。

---

## 實作進度

| Phase | 內容 | 狀態 |
|---|---|---|
| Phase 1 | 產出本文件 | ✅ 完成 |
| Phase 2 | 建立 rule-profiles.ts | ✅ 完成 |
| Phase 3a-1 | R6a 替補基礎品質篩選 | ✅ 完成 |
| Phase 3a-2 | R2 集中火力 | ✅ 完成 |
| Phase 3a-3 | R1 Break Level 意識 | ✅ 完成 |
| Phase 3b | Lv.3 規則補強（R5/R6b/R7/R8） | ✅ 完成 |
| Phase 3c-0 | Lv.4 baseline 鎖定與上限警戒 | ✅ 完成 |
| Phase 3c-1 | R9 致命傷害偵測 | ✅ 完成 |
| Phase 3c-1.5 | R9 行為指標補齊 | ✅ 完成 |
| Phase 3c-2 | R10 對手回應風險評估 | ✅ 完成 |
| Phase 3c-2.5 | R10 行為指標補齊 | ✅ 完成 |
| Phase 3c-2.6 | R10 完整版（F1 attacker 反擊暴露 + 方向 bug 修正 + 行為測試） | ✅ 完成（2026-07-31） |
| Phase 3c-3a | R6c 必要性審查 → 決定不實作 | ✅ 完成（Deferred） |
| Phase 4 | 完整驗收測試 | ⬜ 待執行 |
| Phase 5 | 報告與文件更新 | ⬜ 待執行 |

### Phase 3c 基準線（R9 修正後，seeds 1–30）

| 對戰組合 | 目標 | 實際 | 狀態 |
|---|---|---|:---:|
| Lv.2 vs Lv.1 | ≥ 60% | 83.3% | ✅ |
| Lv.3 vs Lv.2 | ≥ 58% | 66.7% | ✅ |
| Lv.4 vs Lv.3 | 60%–75% | 73.3% | ✅ |
| Lv.3 vs Lv.1 | ≥ 65% | 100.0% | ✅ |
| Lv.4 vs Lv.1 | ≥ 70% | 100.0% | ✅ |

### 已知問題

- `opencode-go-benchmark.test.js` has no test suite（pre-existing，非 AI 修改造成）
- 勝利條件為 `break >= 10`（非 12），R1/R9 已修正為正確閾值
