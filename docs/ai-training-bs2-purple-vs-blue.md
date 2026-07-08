# BS2 紫色對 BS2 藍色訓練紀錄

日期：2026-07-08

## 測試設定

- 玩家牌組：第二彈紫色牌組（`bs2-purple`）
- AI 對手牌組：第二彈藍色牌組（`bs2-blue`）
- 種子範圍：`1..50`
- 最大步數：`2500`
- 規則引擎：正式 `createDemoGame`、`simulateAiMatch`
- 對手強度：藍色 AI 維持 Lv.2
- 玩家側策略：紫色 Lv.2 AI 基準測試

## 基準勝率

| 玩家策略 | 對手策略 | 戰績 | 勝率 | 卡死 |
|---|---|---:|---:|---:|
| Lv.2 AI | Lv.2 AI | 36 / 50 | 72% | 0 |

紫色對藍色有明顯優勢。紫色的干擾效果能有效控制藍色的手牌優勢策略，藍色的回手能力也無法完全抵銷紫色的移除效果。

## 敗局分析

14 場敗局中，13 場因 `break-level-limit` 敗北，1 場因 `no-cookie-available` 敗北。

### 藍色勝利策略

藍色通常透過以下方式獲勝：
1. 保留 Sea Fairy Cookie 作為後期核心
2. 使用抽牌效果維持手牌優勢
3. 讓紫色自己累積高等級破壞區
4. 保留高 HP 餅乾拖到後期

## 關鍵操作心得（紫色對藍色）

### 1. 紫色對藍色有天然優勢

- 紫色的 Wind Archer Cookie 能直接移除藍色的 Sea Fairy Cookie 和 Black Raisin Cookie
- 紫色的 Poison Mushroom Cookie 登場清場效果對藍色威脅大
- 紫色的 Clotted Cream Cookie 能送藍色的低 HP 餅乾進破壞區
- 藍色的低 HP 餅乾（Milk、Skating Queen、Peppermint）非常容易被紫色清除

### 2. 攻擊目標看藍色威脅

藍色的威脅排序：
1. **Sea Fairy Cookie** - HP 高，回手效果
2. **Black Raisin Cookie** - HP 高，AOE 傷害
3. **Sherbet Cookie** - HP 高，回手效果
4. **Tiramisu Cookie** - 有效果

### 3. 紫色要快速建立場面

- 早期用凝脂奶油餅乾送藍色 Lv1 進破壞區
- 中期用風行弓箭手移除藍色的高 Lv3 餅乾
- 後期用毒蘑菇餅乾清場收割

## 敗局觀察

- Seed 4：紫色破壞區 10、藍色 7。紫色前期被藍色手牌優勢壓制。
- Seed 10：紫色破壞區 11、藍色 6。紫色的 Wind Archer 沒有及時上場。
- Seed 14：紫色破壞區 10、藍色 8。藍色的 Sea Fairy 回手效果太強。

## 可餵給 AI 的訓練規則

### 替補評分（紫色對藍色）

- 替補優先順序：Wind Archer Cookie > Poison Mushroom Cookie > Cream Unicorn Cookie > Clotted Cream Cookie > 其他 Lv2+
- 不要補 Raspberry Mousse Cookie、Fig Cookie 等 HP1 餅乾

### 攻擊目標評分

- 優先擊倒 Sea Fairy Cookie > Black Raisin Cookie > Sherbet Cookie
- 藍色的 Milk Cookie、Skating Queen Cookie 等低 HP 餅乾價值低

### 干擾效果使用

- 紫色應優先使用干擾效果控制藍色的場面
- 風行弓箭手的移除效果保留到關鍵時刻
- 毒蘑菇餅乾的清場效果要謹慎使用
