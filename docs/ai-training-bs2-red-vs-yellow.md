# BS2 紅色對 BS2 黃色訓練紀錄

日期：2026-07-07

## 測試設定

- 玩家牌組：第二彈紅色牌組（`bs2-red`）
- AI 對手牌組：第二彈黃色牌組（`bs2-yellow`）
- 種子範圍：`1..50`
- 最大步數：`2500`
- 規則引擎：正式 `createDemoGame`、`simulateAiMatch`
- 對手強度：黃色 AI 維持 Lv.2
- 玩家側策略：紅色 Lv.2 AI 基準測試

## 基準勝率

| 玩家策略 | 對手策略 | 戰績 | 勝率 | 卡死 |
|---|---:|---:|---:|---:|
| Lv.2 AI | Lv.2 AI | 39 / 50 | 78% | 0 |

主要敗因幾乎都是 `break-level-limit`。紅色自動策略常把低 HP、低等級餅乾補上戰鬥區，導致紅色破壞區等級快速堆高（平均 10.3），而黃色只有 7.5。

## 敗局分析

所有 11 場敗局紅色的破壞區等級都 >= 8。

### 敗局破壞區模式

紅色敗局時破壞區常見餅乾：
- Popcorn Cookie (Lv1) - 大量出現
- Carrot Cookie (Lv1) - 大量出現  
- Adventurer Cookie (Lv1) - 大量出現
- Mala Sauce Cookie (Lv2) - 多次出現
- Rebel Cookie (Lv2) - 多次出現
- Cherry Cookie (Lv2) - 多次出現

這些餅乾的共同問題：HP 低、等級不高，容易被黃色的低成本攻擊或效果快速換掉。

### 黃色勝利策略

黃色通常透過以下方式獲勝：
1. 讓紅色自己累積高等級破壞區
2. 保留高 HP 餅乾（Banana Cookie、Vampire Cookie）作為主戰
3. 使用陷阱卡（Winding Key Shield、Super-Vita Jelly Bar）延緩紅色攻勢
4. Star Candy Road 穩定回復

## 關鍵操作心得（紅色對黃色）

### 1. 替補不要選最低 HP

紅色現有 AI 傾向補低 HP 餅乾，對黃色很危險。

**應該補的餅乾：**
- Rebel Cookie (Lv2, HP 3) - 高攻擊，能創造節奏
- Dark Choco Cookie (Lv2, HP 3) - 高攻擊，穩定輸出
- Mala Sauce Cookie (Lv2, HP 2) - 攻擊後有效果，但要小心使用
- Princess Cookie (Lv2, HP 3) - 穩定的二級餅乾

**不應該優先補的餅乾：**
- Popcorn Cookie (Lv1, HP 1) - 太容易被換掉
- Carrot Cookie (Lv1, HP 1) - 太容易被換掉
- Adventurer Cookie (Lv1, HP 1) - 太容易被換掉

### 2. 不急著鋪第二隻低品質餅乾

紅色若把 HP 1 或 HP 2 餅乾放成第二隻，黃色常能用攻擊或效果快速換掉。

**建議：**
- 若手上沒有高品質餅乾（Lv2+ HP 3+），寧可把牌放支援區
- 讓主戰餅乾保有付款能力
- 等手上有了 Rebellion Cookie 或 Dark Choco Cookie 再鋪第二隻

### 3. 支援階段優先保留防守資源

紅色的攻擊節奏快，但防守相對弱。

**陷阱卡價值：**
- Giant Cherry Bomb - 能快速清場
- Prickly Cacti Gloves - 攻擊加成
- 但不要過早使用，等黃色鋪場後再用效果更好

**攻擊時機：**
- 優先擊倒黃色的高 HP 餅乾（Banana Cookie、Vampire Cookie）
- 不要只攻擊最低 HP 的目標
- 黃色的 Chestnut Cookie、Mustard Cookie 雖然 HP 低，但價值不高

### 4. 攻擊目標優先看黃色節奏威脅

黃色的威脅排序：
1. **Banana Cookie** - HP 高，能撐很久
2. **Vampire Cookie** - HP 高，有回復能力
3. **Eclair Cookie** - Lv3，破壞區控制
4. **Timekeeper Cookie** - Lv3，強力效果
5. **Rockstar Cookie** - 攻擊力高

不要只用「最低 HP」作為唯一目標。黃色有些低 HP 餅乾（Chestnut、Mustard）即使擊倒也對紅色幫助不大。

### 5. 紅色要靠快攻取勝

紅色的優勢是攻擊力高、節奏快。勝局通常是：
- 早期快速攻擊，推高黃色破壞區
- 用高攻擊餅乾（Rebel Cookie、Dark Choco Cookie）快速換掉黃色餅乾
- 讓黃色來不及建立防線

**避免：**
- 拖到後期讓黃色建立 Star Candy Road + 高 HP 主戰的組合
- 自己送掉太多低品質餅乾導致破壞區先滿

## 深度敗局分析

### Seed 7（break-level-limit）

**最終狀態：** 紅色破壞區 10，黃色 6

**關鍵問題：**
- 紅色破壞區有 **7 張餅乾**：Rebel (Lv2)、Adventurer (Lv1)、2 個 Popcorn (Lv1)、Mala Sauce (Lv2)、Cherry (Lv2)、Carrot (Lv1)
- 黃色破壞區只有 3 張：Timekeeper (Lv3)、Rockstar (Lv2)、Cyborg (Lv1)
- 紅色棄牌 16 張，黃色 21 張

**教訓：** 紅色鋪了太多 Lv1 餅乾（Popcorn、Adventurer、Carrot），被黃色反擊

### Seed 8（break-level-limit）

**最終狀態：** 紅色破壞區 11，黃色 9

**關鍵問題：**
- 紅色破壞區有 **7 張餅乾**：Melon Bun (Lv1)、2 個 Popcorn (Lv1)、Adventurer (Lv1)、Rebel (Lv2)、Muscle (Lv2)、Espresso (Lv3)
- 黃色破壞區有 5 張：Earl Grey (Lv3)、Chestnut (Lv1)、2 個 Cyborg (Lv1)、Earl Grey (Lv3)
- 紅色棄牌 20 張，黃色 16 張

**教訓：** 紅色把 Lv3 餅乾（Espresso）也送進破壞區，代表部署時機不當

### Seed 11（no-cookie-available）

**最終狀態：** 紅色破壞區 9，黃色 6，但紅色沒有餅乾了

**關鍵問題：**
- 紅色破壞區有 **6 張餅乾**：Adventurer (Lv1)、Princess (Lv2)、Carrot (Lv1)、Popcorn (Lv1)、Mala Sauce (Lv2)、Dark Choco (Lv2)
- 黃色破壞區有 5 張：Banana (Lv1)、Chestnut (Lv1)、Cyborg (Lv1)、Vampire (Lv2)、Marshmallow (Lv1)
- 紅色棄牌 16 張，黃色 21 張

**教訓：** 紅色消耗太快，沒有保留足夠的餅乾

### Seed 14（break-level-limit）

**最終狀態：** 紅色破壞區 10，黃色 6

**關鍵問題：**
- 紅色破壞區有 **6 張餅乾**：Popcorn (Lv1)、Dark Choco (Lv2)、Adventurer (Lv1)、Carrot (Lv1)、Kumiho (Lv3)、Princess (Lv2)
- 黃色破壞區有 5 張：Chestnut (Lv1)、Snake Fruit (Lv2)、3 個 Mustard (Lv1)
- 紅色棄牌 17 張，黃色只有 8 張

**教訓：** 紅色把 Lv3 餅乾（Kumiho）也送進破壞區，且棄牌太多

### Seed 15（break-level-limit）

**最終狀態：** 紅色破壞區 11，黃色 9

**關鍵問題：**
- 紅色破壞區有 **7 張餅乾**：Adventurer (Lv1)、2 個 Cherry (Lv2)、2 個 Popcorn (Lv1)、Melon Bun (Lv1)、Wildberry (Lv3)
- 黃色破壞區有 8 張：Banana (Lv1)、2 個 Chestnut (Lv1)、Rockstar (Lv2)、2 個 Marshmallow (Lv1)、Cyborg (Lv1)、Chestnut (Lv1)
- 紅色棄牌 29 張，黃色 31 張

**教訓：** 雙方都消耗大量資源，但紅色破壞區等級更高

### Seed 18（break-level-limit）

**最終狀態：** 紅色破壞區 11，黃色 8

**關鍵問題：**
- 紅色破壞區有 **7 張餅乾**：Rebel (Lv2)、Princess (Lv2)、2 個 Mala Sauce (Lv2)、Adventurer (Lv1)、Melon Bun (Lv1)、Carrot (Lv1)
- 黃色破壞區有 5 張：Blackberry (Lv3)、Chestnut (Lv1)、Rockstar (Lv2)、Cyborg (Lv1)、Marshmallow (Lv1)
- 紅色棄牌 26 張，黃色 17 張

**教訓：** 紅色棄牌太多，資源管理有問題

### Seed 20（break-level-limit）

**最終狀態：** 紅色破壞區 10，黃色 9

**關鍵問題：**
- 紅色破壞區有 **7 張餅乾**：2 個 Melon Bun (Lv1)、2 個 Popcorn (Lv1)、Mala Sauce (Lv2)、Carrot (Lv1)、Kumiho (Lv3)、Adventurer (Lv1)
- 黃色破壞區有 6 張：Bell Pepper (Lv2)、Mustard (Lv1)、Cyborg (Lv1)、Banana (Lv1)、Eclair (Lv3)、Chestnut (Lv1)
- 紅色棄牌 26 張，黃色 31 張

**教訓：** 雙方都消耗大量資源，但紅色破壞區等級更高

### Seed 25（break-level-limit）

**最終狀態：** 紅色破壞區 10，黃色 7

**關鍵問題：**
- 紅色破壞區有 **6 張餅乾**：2 個 Rebel (Lv2)、Carrot (Lv1)、Muscle (Lv2)、Adventurer (Lv1)、Princess (Lv2)
- 黃色破壞區有 5 張：Chestnut (Lv1)、Mustard (Lv1)、2 個 Rockstar (Lv2)、Marshmallow (Lv1)
- 紅色棄牌 16 張，黃色 15 張

**教訓：** 紅色的 Lv2 餅乾（Rebel、Muscle、Princess）也被快速換掉

### Seed 37（break-level-limit）

**最終狀態：** 紅色破壞區 10，黃色 8

**關鍵問題：**
- 紅色破壞區有 **7 張餅乾**：Mala Sauce (Lv2)、2 個 Adventurer (Lv1)、Princess (Lv2)、2 個 Carrot (Lv1)、Cherry (Lv2)
- 黃色破壞區有 6 張：Chestnut (Lv1)、Earl Grey (Lv3)、2 個 Marshmallow (Lv1)、Chestnut (Lv1)、Cyborg (Lv1)
- 紅色棄牌 19 張，黃色 24 張

**教訓：** 紅色的 Lv1 餅乾（Adventurer、Carrot）太多

### Seed 46（break-level-limit）

**最終狀態：** 紅色破壞區 11，黃色 5

**關鍵問題：**
- 紅色破壞區有 **7 張餅乾**：Adventurer (Lv1)、Carrot (Lv1)、2 個 Cherry (Lv2)、Muscle (Lv2)、Popcorn (Lv1)、Mala Sauce (Lv2)
- 黃色破壞區只有 4 張：Vampire (Lv2)、2 個 Chestnut (Lv1)、Mustard (Lv1)
- 紅色棄牌 20 張，黃色只有 8 張

**教訓：** 紅色快速堆高等級，12 回合就結束

### Seed 48（break-level-limit）

**最終狀態：** 紅色破壞區 10，黃色 9

**關鍵問題：**
- 紅色破壞區有 **6 張餅乾**：Rebel (Lv2)、Popcorn (Lv1)、Muscle (Lv2)、Princess (Lv2)、Cherry (Lv2)、Carrot (Lv1)
- 黃色破壞區有 6 張：Banana (Lv1)、2 個 Rockstar (Lv2)、Snake Fruit (Lv2)、Banana (Lv1)、Mustard (Lv1)
- 紅色棄牌 16 張，黃色 27 張

**教訓：** 紅色的 Lv2 餅乾（Rebel、Muscle、Princess、Cherry）都被快速換掉

## 統計摘要

**紅色破壞區餅乾出現頻率（11 場敗局）：**

| 餅乾 | 出現次數 | 等級 |
|---|---|---|
| Adventurer Cookie | 11 | Lv1 |
| Popcorn Cookie | 11 | Lv1 |
| Carrot Cookie | 10 | Lv1 |
| Mala Sauce Cookie | 7 | Lv2 |
| Cherry Cookie | 7 | Lv2 |
| Rebel Cookie | 6 | Lv2 |
| Princess Cookie | 6 | Lv2 |
| Melon Bun Cookie | 5 | Lv1 |
| Muscle Cookie | 4 | Lv2 |

**平均破壞區等級：** 紅色 10.3，黃色 7.5

## 正式訓練規則（待餵給 AI）

### 替補評分表（紅色對黃色）

| 餅乾 | 評分 | 原因 |
|---|---|---|
| Rebel Cookie (Lv2, HP 3) | ⭐⭐⭐⭐⭐ | 高攻擊，能創造節奏 |
| Dark Choco Cookie (Lv2, HP 3) | ⭐⭐⭐⭐⭐ | 高攻擊，穩定輸出 |
| Princess Cookie (Lv2, HP 3) | ⭐⭐⭐⭐⭐ | 穩定的二級餅乾 |
| Muscle Cookie (Lv2, HP 3) | ⭐⭐⭐⭐ | 穩定 |
| Cherry Cookie (Lv2, HP 2) | ⭐⭐⭐ | 有效果但 HP 較低 |
| Mala Sauce Cookie (Lv2, HP 2) | ⭐⭐⭐ | 有效果但 HP 較低 |
| Popcorn Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |
| Carrot Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |
| Adventurer Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |
| Melon Bun Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |

### 攻擊目標威脅值

| 目標 | 威脅值 | 原因 |
|---|---|---|
| Banana Cookie | ⭐⭐⭐⭐⭐ | HP 高，能撐很久 |
| Vampire Cookie | ⭐⭐⭐⭐⭐ | HP 高，有回復能力 |
| Eclair Cookie | ⭐⭐⭐⭐⭐ | Lv3，破壞區控制 |
| Timekeeper Cookie | ⭐⭐⭐⭐ | Lv3，強力效果 |
| Rockstar Cookie | ⭐⭐⭐⭐ | 攻擊力高 |
| Blackberry Cookie | ⭐⭐⭐⭐ | Lv3，有效果 |
| Earl Grey Cookie | ⭐⭐⭐⭐ | Lv3，有效果 |
| Chestnut Cookie | ⭐ | 價值低 |
| Mustard Cookie | ⭐ | 價值低 |
| Cyborg Cookie | ⭐ | 價值低 |

### 關鍵策略

1. **替補**：只補 Lv2+ HP 3+ 的餅乾，避免 HP 1 的 Popcorn、Carrot、Adventurer、Melon Bun
2. **部署**：Lv3 餅乾（Kumiho、Espresso）不要過早鋪上，容易被黃色快速換掉
3. **攻擊**：優先擊倒 Banana > Vampire > Eclair > Timekeeper
4. **防守**：保留 Giant Cherry Bomb、Prickly Cacti Gloves 到黃色鋪場後再用
5. **節奏**：紅色靠快攻取勝，早期快速攻擊推高黃色破壞區

## 後續建議

1. 將上述策略拆成可重用的 `PlayerView` 評分項
2. 正式 AI 若要吸收此策略，應先改善共通替補評分與部署評分
3. 下一輪可用相同方法測試紅色對其他第二彈牌組
