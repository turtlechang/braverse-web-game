# BS2 藍色對 BS2 紫色訓練紀錄

日期：2026-07-08

## 測試設定

- 玩家牌組：第二彈藍色牌組（`bs2-blue`）
- AI 對手牌組：第二彈紫色牌組（`bs2-purple`）
- 種子範圍：`1..50`
- 最大步數：`2500`
- 規則引擎：正式 `createDemoGame`、`simulateAiMatch`
- 對手強度：紫色 AI 維持 Lv.2
- 玩家側策略：藍色 Lv.2 AI 基準測試

## 基準勝率

| 玩家策略 | 對手策略 | 戰績 | 勝率 | 卡死 |
|---|---|---:|---:|---:|
| Lv.2 AI | Lv.2 AI | 27 / 50 | 54% | 0 |

藍色對紫色略佔優勢。紫色的干擾效果對藍色的手牌優勢策略有一定威脅，但藍色的回手能力能有效抵銷。

## 敗局分析

23 場敗局中，22 場因 `break-level-limit` 敗北，1 場因 `no-cookie-available` 敗北。

### 紫色勝利策略

紫色通常透過以下方式獲勝：
1. 用風行弓箭手直接移除藍色的 Lv3 餅乾
2. 用毒蘑菇餅乾登場清場
3. 用凝脂奶油餅乾送藍色 Lv1 進破壞區
4. 讓藍色破壞區先滿

## 關鍵操作心得（藍色對紫色）

### 1. 藍色要保護高價值餅乾

- 藍色的 Sea Fairy Cookie 和 Black Raisin Cookie 是紫色風行弓箭手的首要目標
- 盡量不要讓高 Lv3 餅乾同時暴露在紫色的干擾效果下
- 使用陷阱卡保護關鍵餅乾

### 2. 攻擊目標看紫色威脅

紫色的威脅排序：
1. **Wind Archer Cookie** - HP 高，直接移除 Lv3
2. **Poison Mushroom Cookie** - HP 高，登場清場
3. **Cream Unicorn Cookie** - HP 高，破壞區回收
4. **Clotted Cream Cookie** - 有效果

### 3. 藍色要快速建立場面

- 早期用 Salt Cookie 穩住場面
- 中期用 Sea Fairy 回手效果控制節奏
- 後期用 Black Raisin AOE 收割

## 敗局觀察

- Seed 1：藍色破壞區 10、紫色 8。紫色風行弓箭手移除了藍色的 Sea Fairy。
- Seed 3：藍色破壞區 11、紫色 7。藍色的高 Lv3 餅乾被紫色效果清除。
- Seed 4：藍色破壞區 10、紫色 9。紫色的毒蘑菇餅乾清場效果太強。

## 可餵給 AI 的訓練規則

### 替補評分（藍色對紫色）

- 替補優先順序：Sea Fairy Cookie > Black Raisin Cookie > Sherbet Cookie > Salt Cookie > 其他 Lv2+
- 紫色有風行弓箭手，高 Lv3 餅乾要謹慎使用

### 攻擊目標評分

- 優先擊倒 Wind Archer Cookie > Poison Mushroom Cookie > Cream Unicorn Cookie
- 紫色的 Raspberry Mousse Cookie、Fig Cookie 等低 HP 餅乾價值低

### 抽牌與回手

- 藍色應優先使用抽牌效果維持手牌優勢
- Sea Fairy 回手效果保留到關鍵時刻
