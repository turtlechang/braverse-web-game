# BS2 紫色對 BS2 紅色訓練紀錄

日期：2026-07-08

## 測試設定

- 玩家牌組：第二彈紫色牌組（`bs2-purple`）
- AI 對手牌組：第二彈紅色牌組（`bs2-red`）
- 種子範圍：`1..50`
- 最大步數：`2500`
- 規則引擎：正式 `createDemoGame`、`simulateAiMatch`
- 對手強度：紅色 AI 維持 Lv.2
- 玩家側策略：紫色 Lv.2 AI 基準測試

## 基準勝率

| 玩家策略 | 對手策略 | 戰績 | 勝率 | 卡死 |
|---|---|---:|---:|---:|
| Lv.2 AI | Lv.2 AI | 24 / 50 | 48% | 0 |

紫色對紅色接近五五開。紅色的早期攻擊壓力對紫色的慢節奏策略造成威脅。

## 敗局分析

26 場敗局中，24 場因 `break-level-limit` 敗北，2 場因 `no-cookie-available` 敗北。

### 紅色勝利策略

紅色通常透過以下方式獲勝：
1. 早期用 Rebel Cookie、Dark Choco Cookie 建立攻擊壓力
2. 集中火力擊倒紫色的低 HP 餅乾
3. 快速堆高紫色破壞區等級
4. Princess Cookie 穩定後期

## 關鍵操作心得（紫色對紅色）

### 1. 紫色要保護高價值餅乾

- 紫色的 Wind Archer Cookie 和 Poison Mushroom Cookie 是紅色的首要目標
- 盡量不要讓高 Lv3 餅乾同時暴露在紅色的攻擊下
- 使用陷阱卡保護關鍵餅乾

### 2. 攻擊目標看紅色威脅

紅色的威脅排序：
1. **Rebel Cookie** - HP 高，攻擊力強
2. **Dark Choco Cookie** - HP 高，攻擊力強
3. **Princess Cookie** - HP 高，穩定
4. **Mala Sauce Cookie** - 有效果

### 3. 紫色要靠干擾取勝

- 早期用凝脂奶油餅乾送紅色 Lv1 進破壞區
- 中期用風行弓箭手移除紅色的高 Lv3 餅乾
- 後期用毒蘑菇餅乾清場收割

## 敗局觀察

- Seed 2：紫色破壞區 10、紅色 7。紫色前期被紅色快速換掉低 HP 餅乾。
- Seed 5：紫色破壞區 11、紅色 6。紫色的 Wind Archer 沒有及時上場。
- Seed 7：紫色破壞區 10、紅色 8。紅色的 Rebel Cookie 存活太久。

## 可餵給 AI 的訓練規則

### 替補評分（紫色對紅色）

- 替補優先順序：Wind Archer Cookie > Poison Mushroom Cookie > Cream Unicorn Cookie > Clotted Cream Cookie > 其他 Lv2+
- 不要補 Raspberry Mousse Cookie、Fig Cookie 等 HP1 餅乾

### 攻擊目標評分

- 優先擊倒 Rebel Cookie > Dark Choco Cookie > Princess Cookie
- 紅色的 Popcorn Cookie、Carrot Cookie 等低 HP 餅乾價值低

### 干擾效果使用

- 紫色應優先使用干擾效果控制紅色的場面
- 風行弓箭手的移除效果保留到關鍵時刻
- 毒蘑菇餅乾的清場效果要謹慎使用
