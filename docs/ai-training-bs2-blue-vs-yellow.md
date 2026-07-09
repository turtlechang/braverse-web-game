# BS2 藍色對 BS2 黃色訓練紀錄

日期：2026-07-08

## 測試設定

- 玩家牌組：第二彈藍色牌組（`bs2-blue`）
- AI 對手牌組：第二彈黃色牌組（`bs2-yellow`）
- 種子範圍：`1..50`
- 最大步數：`2500`
- 規則引擎：正式 `createDemoGame`、`simulateAiMatch`
- 對手強度：黃色 AI 維持 Lv.2
- 玩家側策略：藍色 Lv.2 AI 基準測試

## 基準勝率

| 玩家策略 | 對手策略 | 戰績 | 勝率 | 卡死 |
|---|---|---:|---:|---:|
| Lv.2 AI | Lv.2 AI | 24 / 50 | 48% | 0 |

主要敗因幾乎都是 `break-level-limit`。藍色與黃色接近五五開，但黃色的 Banana Cookie 和 Vampire Cookie 高 HP 餅乾較難處理。

## 敗局分析

26 場敗局中，25 場因 `break-level-limit` 敗北，1 場因 `no-cookie-available` 敗北。

### 黃色勝利策略

黃色通常透過以下方式獲勝：
1. 保留 Banana Cookie、Vampire Cookie 作為主戰
2. 使用 Star Candy Road 穩定回復
3. 讓藍色自己累積高等級破壞區
4. 保留高 HP 餅乾拖到後期

## 關鍵操作心得（藍色對黃色）

### 1. 替補優先高 HP 餅乾

**應該補的餅乾：**
- Sea Fairy Cookie (Lv3, HP5) - 後期核心
- Black Raisin Cookie (Lv3, HP5) - AOE 傷害
- Sherbet Cookie (Lv2, HP5) - 回手效果
- Salt Cookie (Lv1, HP4) - 穩定

**不應該優先補的餅乾：**
- Milk Cookie (Lv1, HP1)
- Skating Queen Cookie (Lv1, HP1)
- Peppermint Cookie (Lv1, HP1)

### 2. 攻擊目標看黃色威脅

黃色的威脅排序：
1. **Banana Cookie** - HP 高，能撐很久
2. **Vampire Cookie** - HP 高，有回復
3. **Rockstar Cookie** - 攻擊力高
4. **Eclair Cookie** - Lv3 但要小心

### 3. 藍色要靠手牌優勢取勝

- 早期用抽牌效果維持手牌
- 中期用 Sea Fairy 回手效果控制節奏
- 後期用 Black Raisin AOE 收割

## 敗局觀察

- Seed 1：藍色破壞區 10、黃色 7。藍色前期被黃色高 HP 餅乾壓制。
- Seed 2：藍色破壞區 11、黃色 6。藍色鋪了太多低 HP 餅乾。
- Seed 6：藍色破壞區 10、黃色 8。黃色 Banana Cookie 存活太久。

## 可餵給 AI 的訓練規則

### 替補評分（藍色對黃色）

- 替補優先順序：Sea Fairy Cookie > Black Raisin Cookie > Sherbet Cookie > Salt Cookie > 其他 Lv2+
- 不要補 Milk Cookie、Skating Queen Cookie 等 HP1 餅乾

### 攻擊目標評分

- 優先擊倒 Banana Cookie > Vampire Cookie > Rockstar Cookie
- 不要只用「最低 HP」作為唯一目標

### 抽牌與回手

- 藍色應優先使用抽牌效果維持手牌優勢
- Sea Fairy 回手效果保留到關鍵時刻
