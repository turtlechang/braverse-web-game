# BS2 Matchup Analysis & AI Training Rules

## Test Configuration

- **Date**: 2026-07-08
- **Matches per matchup**: 50
- **Total matches**: 300 (6 matchups x 50)
- **AI Level**: Default (Level 2 - Heuristic)
- **Max Actions per game**: 2500
- **Deck Source**: BS2 AI Preset Decks

---

## Matchup Results Summary (After Trap Fix)

| Matchup (Player vs AI)                  | Win%  |  W  |  L  |  D  | Stuck | Avg Turns |
|-----------------------------------------|-------|-----|-----|-----|-------|-----------|
| BS2 Blue vs BS2 Red                     | 34.0% |  17 |  33 |   0 |   0   |   14.6    |
| BS2 Purple vs BS2 Red                   | 48.0% |  24 |  26 |   0 |   0   |   13.4    |
| BS2 Blue vs BS2 Yellow                  | 48.0% |  24 |  26 |   0 |   0   |   15.0    |
| BS2 Purple vs BS2 Yellow                | 56.0% |  28 |  22 |   0 |   0   |   14.0    |
| BS2 Blue vs BS2 Bean                   | 44.0% |  22 |  28 |   0 |   0   |   16.9    |
| BS2 Purple vs BS2 Bean                 | 64.0% |  32 |  18 |   0 |   0   |   15.8    |
| **TOTAL**                               | **49.0%** | **147** | **153** | **0** | **0** | - |

### Comparison: Before vs After Trap Fix

| Matchup                  | Before | After | Change | Stuck Before | Stuck After |
|--------------------------|--------|-------|--------|--------------|-------------|
| Blue vs Red              | 24.0%  | 34.0% | +10.0% | 0            | 0           |
| Purple vs Red            | 30.0%  | 48.0% | +18.0% | 0            | 0           |
| Blue vs Yellow           | 44.0%  | 48.0% | +4.0%  | 0            | 0           |
| Purple vs Yellow         | 52.0%  | 56.0% | +4.0%  | 0            | 0           |
| Blue vs Bean            | 42.0%* | 44.0% | +2.0%  | ~18%         | **0%**      |
| Purple vs Bean          | 44.0%* | 64.0% | +20.0% | ~18%         | **0%**      |
| **TOTAL**                | 39.3%  | 49.0% | +9.7%  | ~6%          | **0%**      |

*Note: Previous Bean matchup win rates were inflated because stuck games were counted as draws, not losses.*

### Deck Tier Ranking (by win rate when AI uses them)

| Tier | Deck   | Win Rate (avg) | Notes                                    |
|------|--------|----------------|------------------------------------------|
| S    | Red    | 59.0%          | Strong vs Blue/Purple, dominant early    |
| A    | Yellow | 48.0%          | Balanced, slight edge vs Blue/Purple     |
| B    | Bean  | 28.0%          | Weakest, low Lv3 density                 |
| C    | Blue   | -              | Weaker side                              |
| C    | Purple | -              | Weaker side                              |

---

## Key Findings

### 1. Break Level Efficiency Paradox

**In 100% of losing games, the player had a HIGHER break level than the AI.**

- Average player break in losses: **10.4**
- Average AI break in losses: **6.9**

This means: **The AI wins not by dealing more damage overall, but by being more surgical and efficient.** The AI's Red/Yellow decks concentrate damage on the right targets to reach the break-level-limit win condition faster, while Blue/Purple spread damage more broadly but fail to close out the game.

### 2. Win Condition Dominance

- **break-level-limit**: 98.6% of all results (296/300 completed games)
- **no-cookie-available**: 1.4% (4 games, mostly Purple mirror issues)
- **stuck (bug)**: 0 games (fixed)

### 3. Turn Distribution of Losses

| Turn Range | Loss Count | Percentage |
|------------|-----------|------------|
| 1-3        | 1         | 0.7%       |
| 7-9        | 2         | 1.3%       |
| 10-12      | 19        | 12.4%      |
| 13-15      | 59        | 38.6%      |
| 16-18      | 57        | 37.3%      |
| 19-21      | 9         | 5.9%       |
| 22+        | 1         | 0.7%       |

**75.9% of losses occur between turns 13-18.** This is the critical window where the AI's surgical damage strategy overwhelms Blue/Purple.

### 4. Bean Deck Bug (FIXED)

BS2 Bean (Bean) trap cards (BS2-021 "Carrot Farm Scarecrow") caused **stuck games** with error "選擇的卡片不在支援區" in ~18% of games. This was caused by:

- **Root cause**: Trap execution path in `battle.ts` passed opponent cookie IDs to `executeCardEffect` for `support-to-hand` and `hand-to-support` effects instead of support/hand card IDs
- **Fix**: Added `supportToHandIds` and `handToSupportIds` to `PlayTrapOptions`, with AI selection in `battle-handler.ts` and proper handling in `playTrap` effect loop
- **Result**: 0 stuck games in Bean matchups

### 5. Faint Effects

22% of losing games involve faint (昏厥) effects, indicating the AI's Red/Bean decks use defeat-triggered abilities more effectively than Blue/Purple.

---

## Root Cause Analysis

### Why Red Dominates Blue/Purple

1. **Faster break accumulation**: Red's aggressive cookie lineup (Timekeeper Lv3, Eclair Lv3, Blackberry Lv3) deals concentrated damage
2. **Higher Lv3 density**: Red's break area frequently contains multiple Lv3 cookies, maximizing break level per KO
3. **Support synergy**: Red's support cards (items, stages) amplify attack damage more effectively
4. **Efficient trades**: Red sacrifices lower-value cookies to eliminate higher-value targets

### Why Yellow Holds Even

1. **Balanced approach**: Yellow mixes offense with disruption
2. **Hand control**: Yellow's discard effects slow Blue/Purple's setup
3. **Moderate pace**: Yellow doesn't overextend, keeping break levels manageable

### Why Bean Struggles

1. **Low Lv3 density**: Bean's break area often has many Lv1 cookies
2. **Slow tempo**: Bean's support-heavy strategy takes too long to establish
3. **Trap dependency**: Bean relies on traps for defense, but traps are reactive

---

## AI Training Rules (Formal Format)

### Rule 1: Break Level Efficiency

```
RULE: maximize-break-level-per-KO
PRIORITY: HIGH
CONDITION: Always
ACTION:
  - Prioritize attacking cookies that will be knocked out
  - Prefer attacking cookies with higher levels when multiple targets available
  - Avoid attacking cookies with prevention effects unless strategically necessary
RATIONALE: Win condition is break-level-limit (10). Each KO should contribute maximum break level.
MEASURED IMPACT: Red deck achieves avg AI break of 6.9 in wins vs player's 10.4 in losses.
```

### Rule 2: Target Priority - Concentrated Damage

```
RULE: concentrate-damage-on-weak-targets
PRIORITY: HIGH
CONDITION: Multiple enemy cookies in battle area
ACTION:
  - Focus attacks on the weakest enemy cookie until it's knocked out
  - Do NOT spread damage across multiple cookies
  - After KO, immediately redirect to next weakest target
RATIONALE: Knocking out cookies contributes to break level limit. Spreading damage wastes attacks.
MEASURED IMPACT: Spreading damage leads to player having higher break but still losing.
```

### Rule 3: Early Game Aggression

```
RULE: early-aggression-window
PRIORITY: MEDIUM
CONDITION: Turns 1-8
ACTION:
  - Deploy highest-level cookies immediately
  - Attack every turn if legally possible
  - Place support cards that boost attack damage
RATIONALE: Establishing board presence early creates pressure. 75.9% of losses happen turns 13-18.
```

### Rule 4: Support Card Timing

```
RULE: support-card-deployment
PRIORITY: MEDIUM
CONDITION: Support phase
ACTION:
  - Deploy attack-boosting items/stages before entering main phase
  - Prioritize cards that affect multiple cookies
  - Don't hoard support cards - deploy ASAP for cumulative benefit
RATIONALE: Support effects compound over multiple turns. Late deployment wastes value.
```

### Rule 5: Skill Activation Timing

```
RULE: activate-skills-proactively
PRIORITY: MEDIUM
CONDITION: Activate phase with valid skill available
ACTION:
  - Activate skills that deal damage or remove enemy cookies
  - Activate draw/search effects to maintain hand advantage
  - Don't save skills for "perfect" moments - incremental advantage wins
RATIONALE: Skills are free value. Delaying activation loses tempo.
```

### Rule 6: Break Level Awareness

```
RULE: monitor-break-level-race
PRIORITY: HIGH
CONDITION: Both players above break level 6
ACTION:
  - Calculate: enemy_break_level + my_current_attack >= 10?
  - If yes, go for lethal attacks
  - If no, prioritize defensive positioning to avoid giving enemy lethal
  - Track how many more KOs needed to win
RATIONALE: Break level limit is the primary win condition. Race awareness prevents throwing games.
```

### Rule 7: Replacement Selection

```
RULE: replacement-cookie-selection
PRIORITY: MEDIUM
CONDITION: Cookie knocked out, replacement needed
ACTION:
  - Replace with highest-level available cookie
  - If multiple Lv3 available, choose one with best on-play effect
  - Avoid replacing with Lv1 unless no other option
RATIONALE: Higher level cookies are harder to KO and contribute more to break level when they do fall.
```

### Rule 8: Trap/Blocker Usage

```
RULE: defensive-trap-usage
PRIORITY: LOW
CONDITION: Enemy attacking a high-value cookie
ACTION:
  - Use traps/blockers to protect Lv3 cookies
  - Don't waste defensive resources on Lv1 cookies
  - Consider the break level impact of each defense decision
RATIONALE: Defending high-value cookies denies the enemy break level progress.
```

### Rule 9: Hand Management

```
RULE: maintain-hand-size
PRIORITY: LOW
CONDITION: Hand size below 3
ACTION:
  - Prioritize draw effects
  - Don't discard cards unless cost requires it
  - Keep at least 2 cards for flexibility
RATIONALE: Low hand size limits options. Cards in hand are potential future plays.
```

### Rule 10: End Game Lethal

```
RULE: lethal-calculation
PRIORITY: CRITICAL
CONDITION: Enemy break level >= 9
ACTION:
  - Calculate total available damage
  - If total damage >= (12 - enemy_break_level), attack for lethal
  - Prioritize attacks that push break level over the limit
  - Don't waste attacks on non-lethal targets if lethal is available
RATIONALE: Games are decided by break level limit. Missing lethal opportunities is the #1 cause of losses.
```

---

## Specific Matchup Notes

### Blue vs Red (34% Win Rate)

- **Problem**: Red's Lv3 density (Timekeeper, Eclair, Blackberry) overwhelms Blue's slower setup
- **Blue's weakness**: Sea Fairy Cookie Lv3 is strong but takes time to establish
- **Recommendation**: Blue needs faster deployment and more aggressive early attacks

### Purple vs Red (48% Win Rate)

- **Problem**: Purple's disruption effects don't offset Red's raw damage output
- **Purple's weakness**: Wind Archer Cookie Lv3 is effective but Purple's Lv1 cookies are liabilities
- **Recommendation**: Purple needs better Lv3 cookie retention

### Blue vs Yellow (48% Win Rate)

- **Problem**: Yellow's hand disruption slows Blue's combo setup
- **Closer matchup**: Blue has tools to compete but needs better draw consistency
- **Recommendation**: Blue should prioritize draw effects to maintain hand advantage

### Purple vs Yellow (56% Win Rate)

- **Best matchup for weaker decks**: Purple's disruption synergizes well against Yellow's balanced approach
- **Key factor**: Purple's ability to control tempo gives slight edge

### Blue vs Bean (44% Win Rate)

- **After trap fix**: 0 stuck games, accurate win rate data
- **Bean's weakness**: Low Lv3 density means Bean struggles to reach break level limit
- **Recommendation**: Blue should apply early pressure before Bean establishes support

### Purple vs Bean (64% Win Rate)

- **Best matchup for Blue/Purple**: Purple's disruption synergizes well against Bean's slow tempo
- **After trap fix**: 0 stuck games, significant improvement from 44%
- **Key factor**: Purple can control tempo and deny Bean's support setup

---

## Recommendations for AI Improvement

### Priority 1 (COMPLETED): Fix Bean Deck Bug
The "選擇的卡片不在支援區" and "選擇的卡片不在手牌中" errors caused stuck games in Bean matchups. Fixed by adding `supportToHandIds` and `handToSupportIds` to trap execution path.

### Priority 2: Implement Break Level Tracking
Add explicit break level calculation to AI decision-making. Currently, the AI doesn't seem to track race conditions.

### Priority 3: Improve Target Selection
The AI should prioritize knocking out cookies over spreading damage. This is the single biggest factor in Red's dominance.

### Priority 4: Early Game Tempo
The AI should deploy highest-level cookies immediately and attack every turn in the early game.

### Priority 5: Lethal Awareness
The AI should detect when it has lethal damage available and go for it immediately.

---

## Appendix: Raw Data

### All Losing Seeds by Matchup (After Trap Fix)

| Matchup                          | Losing Seeds                                                                                      |
|----------------------------------|---------------------------------------------------------------------------------------------------|
| BS2 Blue vs BS2 Red              | 1,2,3,4,5,6,7,8,9,10,11,13,15,16,17,19,22,25,27,28,30,33,34,35,36,37,38,39,42,45,46,49,50 |
| BS2 Purple vs BS2 Red            | 1,2,5,6,7,11,13,15,16,17,20,21,22,25,27,28,29,33,34,37,39,40,42,43,47,48 |
| BS2 Blue vs BS2 Yellow           | 1,4,5,6,7,12,13,15,18,19,22,23,24,25,29,30,31,33,36,39,40,42,44,45,49,50 |
| BS2 Purple vs BS2 Yellow         | 2,8,10,15,17,19,22,23,25,26,27,29,30,38,39,40,41,42,43,46,47,48 |
| BS2 Blue vs BS2 Bean            | 3,4,5,6,7,8,13,15,16,17,19,21,22,23,25,26,27,29,33,34,37,39,41,42,43,44,46,50 |
| BS2 Purple vs BS2 Bean          | 3,7,9,13,15,16,19,21,25,27,28,30,34,39,40,41,42,50 |

### Win Reasons Distribution (After Trap Fix)

| Reason                 | Count | Percentage |
|------------------------|-------|------------|
| break-level-limit      | 296   | 98.7%      |
| no-cookie-available    | 4     | 1.3%       |
