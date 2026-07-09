# BS2 藍色對 BS2 豆子訓練紀錄

日期：2026-07-08

## 測試設定

- 玩家牌組：第二彈藍色牌組（`bs2-blue`）
- AI 對手牌組：第二彈豆子牌組（`bs2-bean`）
- 種子範圍：`1..50`
- 最大步數：`2500`
- 規則引擎：正式 `createDemoGame`、`simulateAiMatch`
- 對手強度：豆子 AI 維持 Lv.2
- 玩家側策略：藍色 Lv.2 AI 基準測試

## 基準勝率

| 玩家策略 | 對手策略 | 戰績 | 勝率 | 卡死 |
|---|---|---:|---:|---:|
| Lv.2 AI | Lv.2 AI | 37 / 50 | 74% | 0 |

藍色對豆子有明顯優勢。豆子的低 Lv3 密度和慢節奏讓藍色能輕鬆控制場面。

## 敗局分析

13 場敗局中，12 場因 `break-level-limit` 敗北，1 場因 `no-cookie-available` 敗北。

### 豆子勝利策略

豆子通常透過以下方式獲勝：
1. 早期鋪場建立數量優勢
2. 使用回復效果維持餅乾存活
3. 讓藍色破壞區先滿

## 關鍵操作心得（藍色對豆子）

### 1. 藍色對豆子有天然優勢

- 藍色的 Sea Fairy Cookie 回手效果能有效控制豆子的場面
- 藍色的抽牌能力讓手牌優勢明顯
- 豆子的低 HP 餅乾容易被藍色的效果清除

### 2. 攻擊目標看豆子威脅

豆子的威脅排序：
1. **Red Bean Cookie** - HP 高，攻擊力強
2. **Onion Cookie** - HP 高，穩定
3. **Blue Lily Cookie** - Lv3 但要小心
4. **Avocado Cookie** - HP 高，穩定

### 3. 藍色要快速建立場面

- 早期用 Salt Cookie 穩住場面
- 中期用 Sea Fairy 回手效果控制節奏
- 後期用 Black Raisin AOE 收割

## 敗局觀察

- Seed 1：藍色破壞區 10、豆子 8。藍色前期被豆子鋪場壓制。
- Seed 3：藍色破壞區 11、豆子 7。藍色的 Sea Fairy 沒有及時上場。
- Seed 9：藍色破壞區 10、豆子 9。豆子的回復效果讓餅乾存活太久。

## 可餵給 AI 的訓練規則

### 替補評分（藍色對豆子）

- 替補優先順序：Sea Fairy Cookie > Black Raisin Cookie > Sherbet Cookie > Salt Cookie > 其他 Lv2+
- 豆子的低 HP 餅乾可以優先擊倒

### 攻擊目標評分

- 優先擊倒 Red Bean Cookie > Onion Cookie > Blue Lily Cookie
- 豆子的 Angel Cookie、Spinach Cookie 等低 HP 餅乾價值低

### 抽牌與回手

- 藍色應優先使用抽牌效果維持手牌優勢
- Sea Fairy 回手效果保留到關鍵時刻
