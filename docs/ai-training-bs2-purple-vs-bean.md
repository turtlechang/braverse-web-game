# BS2 紫色對 BS2 豆子訓練紀錄

日期：2026-07-08

## 測試設定

- 玩家牌組：第二彈紫色牌組（`bs2-purple`）
- AI 對手牌組：第二彈豆子牌組（`bs2-bean`）
- 種子範圍：`1..50`
- 最大步數：`2500`
- 規則引擎：正式 `createDemoGame`、`simulateAiMatch`
- 對手強度：豆子 AI 維持 Lv.2
- 玩家側策略：紫色 Lv.2 AI 基準測試

## 基準勝率

| 玩家策略 | 對手策略 | 戰績 | 勝率 | 卡死 |
|---|---|---:|---:|---:|
| Lv.2 AI | Lv.2 AI | 40 / 50 | 80% | 0 |

紫色對豆子有壓倒性優勢。豆子的低 Lv3 密度和慢節奏讓紫色能輕鬆控制場面並用干擾效果清除豆子的餅乾。

## 敗局分析

10 場敗局中，9 場因 `break-level-limit` 敗北，1 場因 `no-cookie-available` 敗北。

### 豆子勝利策略

豆子通常透過以下方式獲勝：
1. 早期鋪場建立數量優勢
2. 使用回復效果維持餅乾存活
3. 讓紫色破壞區先滿

## 關鍵操作心得（紫色對豆子）

### 1. 紫色對豆子有壓倒性優勢

- 紫色的 Wind Archer Cookie 能直接移除豆子的高 Lv3 餅乾
- 紫色的 Poison Mushroom Cookie 登場清場效果對豆子威脅巨大
- 紫色的 Clotted Cream Cookie 能送豆子的低 HP 餅乾進破壞區
- 豆子的低 HP 餅乾（Angel、Spinach、Bellflower、Cookiemals）非常容易被紫色清除

### 2. 攻擊目標看豆子威脅

豆子的威脅排序：
1. **Red Bean Cookie** - HP 高，攻擊力強
2. **Onion Cookie** - HP 高，穩定
3. **Blue Lily Cookie** - Lv3 但要小心
4. **Avocado Cookie** - HP 高，穩定

### 3. 紫色要快速建立場面

- 早期用凝脂奶油餅乾送豆子 Lv1 進破壞區
- 中期用風行弓箭手移除豆子的高 Lv3 餅乾
- 後期用毒蘑菇餅乾清場收割

## 敗局觀察

- Seed 14：紫色破壞區 10、豆子 8。紫色前期被豆子鋪場壓制。
- Seed 18：紫色破壞區 11、豆子 7。紫色的 Wind Archer 沒有及時上場。
- Seed 30：紫色破壞區 10、豆子 9。豆子的回復效果讓餅乾存活太久。

## 可餵給 AI 的訓練規則

### 替補評分（紫色對豆子）

- 替補優先順序：Wind Archer Cookie > Poison Mushroom Cookie > Cream Unicorn Cookie > Clotted Cream Cookie > 其他 Lv2+
- 豆子的低 HP 餅乾可以優先擊倒

### 攻擊目標評分

- 優先擊倒 Red Bean Cookie > Onion Cookie > Blue Lily Cookie
- 豆子的 Angel Cookie、Spinach Cookie 等低 HP 餅乾價值低

### 干擾效果使用

- 紫色應優先使用干擾效果控制豆子的場面
- 風行弓箭手的移除效果保留到關鍵時刻
- 毒蘑菇餅乾的清場效果要謹慎使用
