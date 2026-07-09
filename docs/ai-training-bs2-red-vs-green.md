# BS2 紅色對 BS2 豆子訓練紀錄

日期：2026-07-07

## 測試設定

- 玩家牌組：第二彈紅色牌組（`bs2-red`）
- AI 對手牌組：第二彈豆子牌組（`bs2-bean`）
- 種子範圍：`1..50`
- 最大步數：`2500`
- 規則引擎：正式 `createDemoGame`、`simulateAiMatch`
- 對手強度：豆子 AI 維持 Lv.2
- 玩家側策略：紅色 Lv.2 AI 基準測試

## 基準勝率

| 玩家策略 | 對手策略 | 戰績 | 勝率 | 卡死 |
|---|---:|---:|---:|---:|
| Lv.2 AI | Lv.2 AI | 34 / 50 | 68% | 0 |

主要敗因幾乎都是 `break-level-limit`。紅色自動策略常把低 HP、低等級餅乾補上戰鬥區，導致紅色破壞區等級快速堆高（平均 10.2），而豆子只有 7.4。

## 敗局分析

所有 16 場敗局紅色的破壞區等級都 >= 8。

### 敗局破壞區模式

紅色敗局時破壞區常見餅乾：

| 餅乾 | 出現次數 | 等級 | HP |
|---|---|---|---|
| Popcorn Cookie | 17 | Lv1 | 1 |
| Adventurer Cookie | 17 | Lv1 | 1 |
| Carrot Cookie | 16 | Lv1 | 1 |
| Mala Sauce Cookie | 10 | Lv2 | 2 |
| Princess Cookie | 9 | Lv2 | 3 |
| Cherry Cookie | 9 | Lv2 | 2 |
| Muscle Cookie | 7 | Lv2 | 3 |
| Rebel Cookie | 5 | Lv2 | 3 |
| Melon Bun Cookie | 3 | Lv1 | 1 |
| Whipped Cream Cookie | 3 | Lv2 | 2 |
| Dark Choco Cookie | 3 | Lv2 | 3 |
| Wildberry Cookie | 3 | Lv3 | 3 |
| Kumiho Cookie | 3 | Lv3 | 3 |

**關鍵發現：**
- 紅色有大量 HP 1 餅乾（Popcorn、Adventurer、Carrot）被送進破壞區
- Lv2 餅乾（Mala Sauce、Princess、Cherry）也被快速換掉
- 即使 Lv3 餅乾（Wildberry、Kumiho）也被送進破壞區

### 豆子勝利策略

豆子通常透過以下方式獲勝：
1. 讓紅色自己累積高等級破壞區
2. 保留高 HP 餅乾（Red Bean Cookie、Onion Cookie）作為主戰
3. 使用回復效果（Supreme Whipped Cream）維持餅乾存活
4. 讓紅色的低 HP 餅乾被快速換掉

## 深度敗局分析

### Seed 2（break-level-limit）

**最終狀態：** 紅色破壞區 10，豆子 9

**關鍵問題：**
- 紅色破壞區有 **7 張餅乾**：Rebel (Lv2)、Carrot (Lv1)、Popcorn (Lv1)、Melon Bun (Lv1)、Mala Sauce (Lv2)、Muscle (Lv2)、Adventurer (Lv1)
- 豆子破壞區有 8 張：Melon Bun (Lv1)、Red Bean (Lv2)、Ninja (Lv1)、Salt (Lv1)、Cookiemals (Lv1)、Spinach (Lv1)、Cookiemals (Lv1)、Banana (Lv1)
- 紅色棄牌 20 張，豆子 30 張

**教訓：** 紅色鋪了太多 Lv1 餅乾（Carrot、Popcorn、Melon Bun、Adventurer）

### Seed 5（break-level-limit）

**最終狀態：** 紅色破壞區 10，豆子 9

**關鍵問題：**
- 紅色破壞區有 **7 張餅乾**：Whipped Cream (Lv2)、Princess (Lv2)、Dark Choco (Lv2)、Carrot (Lv1)、2 個 Popcorn (Lv1)、Adventurer (Lv1)
- 豆子破壞區有 7 張：Red Bean (Lv2)、Spinach (Lv1)、Salt (Lv1)、Angel (Lv1)、Red Bean (Lv2)、Banana (Lv1)、Cookiemals (Lv1)
- 紅色棄牌 20 張，豆子 25 張

**教訓：** 紅色有 3 個 Lv2 餅乾（Whipped Cream、Princess、Dark Choco）也被送進破壞區

### Seed 14（break-level-limit）

**最終狀態：** 紅色破壞區 10，豆子 6

**關鍵問題：**
- 紅色破壞區有 **7 張餅乾**：Popcorn (Lv1)、Dark Choco (Lv2)、Adventurer (Lv1)、2 個 Carrot (Lv1)、Princess (Lv2)、Mala Sauce (Lv2)
- 豆子破壞區有 5 張：Salt (Lv1)、Angel (Lv1)、Candlelight (Lv1)、Red Bean (Lv2)、Ninja (Lv1)
- 紅色棄牌 16 張，豆子 18 張

**教訓：** 紅色有 2 個 Carrot Cookie 被送進破壞區

### Seed 15（break-level-limit）

**最終狀態：** 紅色破壞區 10，豆子 8

**關鍵問題：**
- 紅色破壞區有 **6 張餅乾**：Adventurer (Lv1)、Muscle (Lv2)、2 個 Popcorn (Lv1)、Cherry (Lv2)、Wildberry (Lv3)
- 豆子破壞區有 7 張：Angel (Lv1)、2 個 Ninja (Lv1)、2 個 Spinach (Lv1)、Onion (Lv2)、Angel (Lv1)
- 紅色棄牌 20 張，豆子 15 張

**教訓：** 紅色把 Lv3 餅乾（Wildberry）也送進破壞區

### Seed 18（break-level-limit）

**最終狀態：** 紅色破壞區 10，豆子 8

**關鍵問題：**
- 紅色破壞區有 **7 張餅乾**：Rebel (Lv2)、Popcorn (Lv1)、Princess (Lv2)、Cherry (Lv2)、2 個 Adventurer (Lv1)、Melon Bun (Lv1)
- 豆子破壞區有 7 張：Candlelight (Lv1)、Cookiemals (Lv1)、Angel (Lv1)、Spinach (Lv1)、Angel (Lv1)、Red Bean (Lv2)、Salt (Lv1)
- 紅色棄牌 27 張，豆子 22 張

**教訓：** 紅色棄牌太多，資源管理有問題

### Seed 19（break-level-limit）

**最終狀態：** 紅色破壞區 10，豆子 5

**關鍵問題：**
- 紅色破壞區有 **5 張餅乾**：Princess (Lv2)、2 個 Cherry (Lv2)、Kumiho (Lv3)、Popcorn (Lv1)
- 豆子破壞區有 5 張：Banana (Lv1)、4 個 Angel (Lv1)
- 紅色棄牌 19 張，豆子 18 張

**教訓：** 紅色把 Lv3 餅乾（Kumiho）也送進破壞區

### Seed 23（break-level-limit）

**最終狀態：** 紅色破壞區 10，豆子 6

**關鍵問題：**
- 紅色破壞區有 **5 張餅乾**：Adventurer (Lv1)、Carrot (Lv1)、Rebel (Lv2)、Kumiho (Lv3)、Wildberry (Lv3)
- 豆子破壞區有 6 張：Spinach (Lv1)、4 個 Angel (Lv1)、Banana (Lv1)、Bellflower (Lv1)
- 紅色棄牌 22 張，豆子 18 張

**教訓：** 紅色把 2 個 Lv3 餅乾（Kumiho、Wildberry）都送進破壞區

### Seed 31（break-level-limit）

**最終狀態：** 紅色破壞區 11，豆子 9

**關鍵問題：**
- 紅色破壞區有 **7 張餅乾**：Carrot (Lv1)、Rebel (Lv2)、2 個 Adventurer (Lv1)、Mala Sauce (Lv2)、Muscle (Lv2)、Princess (Lv2)
- 豆子破壞區有 7 張：Onion (Lv2)、2 個 Spinach (Lv1)、Red Bean (Lv2)、Candlelight (Lv1)、Bellflower (Lv1)、Salt (Lv1)
- 紅色棄牌 15 張，豆子 25 張

**教訓：** 紅色破壞區等級 11，代表紅色把高等級餅乾也送進破壞區

### Seed 35（break-level-limit）

**最終狀態：** 紅色破壞區 10，豆子 8

**關鍵問題：**
- 紅色破壞區有 **7 張餅乾**：Cherry (Lv2)、Popcorn (Lv1)、2 個 Carrot (Lv1)、Mala Sauce (Lv2)、Adventurer (Lv1)、Princess (Lv2)
- 豆子破壞區有 8 張：Melon Bun (Lv1)、Angel (Lv1)、Cookiemals (Lv1)、2 個 Spinach (Lv1)、Banana (Lv1)、2 個 Bellflower (Lv1)
- 紅色棄牌 15 張，豆子 29 張

**教訓：** 紅色有 2 個 Carrot Cookie 被送進破壞區

### Seed 37（break-level-limit）

**最終狀態：** 紅色破壞區 10，豆子 9

**關鍵問題：**
- 紅色破壞區有 **7 張餅乾**：Mala Sauce (Lv2)、Adventurer (Lv1)、Princess (Lv2)、Carrot (Lv1)、2 個 Popcorn (Lv1)、Muscle (Lv2)
- 豆子破壞區有 7 張：Ninja (Lv1)、Angel (Lv1)、Melon Bun (Lv1)、Spinach (Lv1)、Cookiemals (Lv1)、Red Bean (Lv2)、Lemon Thyme (Lv2)
- 紅色棄牌 13 張，豆子 26 張

**教訓：** 紅色有 2 個 Popcorn Cookie 被送進破壞區

### Seed 39（break-level-limit）

**最終狀態：** 紅色破壞區 10，豆子 7

**關鍵問題：**
- 紅色破壞區有 **6 張餅乾**：2 個 Adventurer (Lv1)、Carrot (Lv1)、Muscle (Lv2)、Dark Choco (Lv2)、Wildberry (Lv3)
- 豆子破壞區有 6 張：Salt (Lv1)、Onion (Lv2)、Melon Bun (Lv1)、Banana (Lv1)、Candlelight (Lv1)、Angel (Lv1)
- 紅色棄牌 22 張，豆子 22 張

**教訓：** 紅色把 Lv3 餅乾（Wildberry）也送進破壞區

### Seed 40（break-level-limit）

**最終狀態：** 紅色破壞區 10，豆子 6

**關鍵問題：**
- 紅色破壞區有 **7 張餅乾**：Whipped Cream (Lv2)、Carrot (Lv1)、2 個 Popcorn (Lv1)、Adventurer (Lv1)、Mala Sauce (Lv2)、Cherry (Lv2)
- 豆子破壞區有 6 張：3 個 Angel (Lv1)、Spinach (Lv1)、Banana (Lv1)、Ninja (Lv1)
- 紅色棄牌 16 張，豆子 23 張

**教訓：** 紅色有 2 個 Popcorn Cookie 被送進破壞區

### Seed 46（break-level-limit）

**最終狀態：** 紅色破壞區 11，豆子 6

**關鍵問題：**
- 紅色破壞區有 **7 張餅乾**：Adventurer (Lv1)、Carrot (Lv1)、Cherry (Lv2)、Muscle (Lv2)、2 個 Carrot (Lv1)、2 個 Mala Sauce (Lv2)
- 豆子破壞區有 5 張：Cookiemals (Lv1)、Ninja (Lv1)、Red Bean (Lv2)、Melon Bun (Lv1)、Banana (Lv1)
- 紅色棄牌 17 張，豆子 27 張

**教訓：** 紅色有 2 個 Carrot Cookie 和 2 個 Mala Sauce Cookie 被送進破壞區

### Seed 47（break-level-limit）

**最終狀態：** 紅色破壞區 11，豆子 8

**關鍵問題：**
- 紅色破壞區有 **8 張餅乾**：Melon Bun (Lv1)、2 個 Popcorn (Lv1)、Adventurer (Lv1)、Mala Sauce (Lv2)、Cherry (Lv2)、Carrot (Lv1)、Whipped Cream (Lv2)
- 豆子破壞區有 7 張：Cookiemals (Lv1)、Angel (Lv1)、Ninja (Lv1)、Red Bean (Lv2)、Banana (Lv1)、Melon Bun (Lv1)、Salt (Lv1)
- 紅色棄牌 23 張，豆子 32 張

**教訓：** 紅色破壞區等級 11，且有大量 Lv1 餅乾

### Seed 48（break-level-limit）

**最終狀態：** 紅色破壞區 10，豆子 7

**關鍵問題：**
- 紅色破壞區有 **6 張餅乾**：Rebel (Lv2)、Popcorn (Lv1)、Muscle (Lv2)、Princess (Lv2)、Cherry (Lv2)、Carrot (Lv1)
- 豆子破壞區有 6 張：Angel (Lv1)、2 個 Spinach (Lv1)、Onion (Lv2)、Ninja (Lv1)、Cookiemals (Lv1)
- 紅色棄牌 14 張，豆子 17 張

**教訓：** 紅色有 4 個 Lv2 餅乾（Rebel、Muscle、Princess、Cherry）都被送進破壞區

### Seed 50（break-level-limit）

**最終狀態：** 紅色破壞區 10，豆子 7

**關鍵問題：**
- 紅色破壞區有 **6 張餅乾**：Carrot (Lv1)、Princess (Lv2)、Popcorn (Lv1)、Mala Sauce (Lv2)、Kumiho (Lv3)、Adventurer (Lv1)
- 豆子破壞區有 5 張：Onion (Lv2)、Lemon Thyme (Lv2)、Banana (Lv1)、Ninja (Lv1)、Melon Bun (Lv1)
- 紅色棄牌 14 張，豆子 20 張

**教訓：** 紅色把 Lv3 餅乾（Kumiho）也送進破壞區

## 統計摘要

**紅色破壞區餅乾出現頻率（16 場敗局）：**

| 餅乾 | 出現次數 | 等級 | HP |
|---|---|---|---|
| Popcorn Cookie | 17 | Lv1 | 1 |
| Adventurer Cookie | 17 | Lv1 | 1 |
| Carrot Cookie | 16 | Lv1 | 1 |
| Mala Sauce Cookie | 10 | Lv2 | 2 |
| Princess Cookie | 9 | Lv2 | 3 |
| Cherry Cookie | 9 | Lv2 | 2 |
| Muscle Cookie | 7 | Lv2 | 3 |
| Rebel Cookie | 5 | Lv2 | 3 |

**平均破壞區等級：** 紅色 10.2，豆子 7.4

## 關鍵操作心得（紅色對豆子）

### 1. 替補不要選最低 HP

紅色現有 AI 傾向補低 HP 餅乾，對豆子很危險。

**應該補的餅乾：**
- Rebel Cookie (Lv2, HP 3) - 高攻擊，能創造節奏
- Dark Choco Cookie (Lv2, HP 3) - 高攻擊，穩定輸出
- Princess Cookie (Lv2, HP 3) - 穩定的二級餅乾
- Muscle Cookie (Lv2, HP 3) - 穩定

**不應該優先補的餅乾：**
- Popcorn Cookie (Lv1, HP 1) - 太容易被換掉
- Adventurer Cookie (Lv1, HP 1) - 太容易被換掉
- Carrot Cookie (Lv1, HP 1) - 太容易被換掉
- Melon Bun Cookie (Lv1, HP 1) - 太容易被換掉

### 2. 不急著鋪第二隻低品質餅乾

紅色若把 HP 1 餅乾放成第二隻，豆子常能用攻擊或效果快速換掉。

**建議：**
- 若手上沒有高品質餅乾（Lv2+ HP 3+），寧可把牌放支援區
- 讓主戰餅乾保有付款能力
- 等手上有了 Rebel Cookie 或 Dark Choco Cookie 再鋪第二隻

### 3. 支援階段優先保留防守資源

紅色的攻擊節奏快，但防守相對弱。

**陷阱卡價值：**
- Giant Cherry Bomb - 能快速清場
- Prickly Cacti Gloves - 攻擊加成
- 但不要過早使用，等豆子鋪場後再用效果更好

**攻擊時機：**
- 優先擊倒豆子的高 HP 餅乾（Red Bean Cookie、Onion Cookie）
- 不要只攻擊最低 HP 的目標
- 豆子的 Angel Cookie、Spinach Cookie 雖然 HP 低，但價值不高

### 4. 攻擊目標優先看豆子節奏威脅

豆子的威脅排序：
1. **Red Bean Cookie** - HP 高，攻擊力強
2. **Onion Cookie** - HP 高，穩定
3. **Blue Lily Cookie** - Lv3，強力效果
4. **Lemon Thyme Cookie** - 有效果
5. **Avocado Cookie** - HP 高，穩定

不要只用「最低 HP」作為唯一目標。豆子有些低 HP 餅乾（Angel、Spinach）即使擊倒也對紅色幫助不大。

### 5. 紅色要靠快攻取勝

紅色的優勢是攻擊力高、節奏快。勝局通常是：
- 早期快速攻擊，推高豆子破壞區
- 用高攻擊餅乾（Rebel Cookie、Dark Choco Cookie）快速換掉豆子餅乾
- 讓豆子來不及建立防線

**避免：**
- 拖到後期讓豆子建立回復組合
- 自己送掉太多低品質餅乾導致破壞區先滿
- 把 Lv3 餅乾（Kumiho、Wildberry）過早鋪上

## 正式訓練規則（待餵給 AI）

### 替補評分表（紅色對豆子）

| 餅乾 | 評分 | 原因 |
|---|---|---|
| Rebel Cookie (Lv2, HP 3) | ⭐⭐⭐⭐⭐ | 高攻擊，能創造節奏 |
| Dark Choco Cookie (Lv2, HP 3) | ⭐⭐⭐⭐⭐ | 高攻擊，穩定輸出 |
| Princess Cookie (Lv2, HP 3) | ⭐⭐⭐⭐⭐ | 穩定的二級餅乾 |
| Muscle Cookie (Lv2, HP 3) | ⭐⭐⭐⭐ | 穩定 |
| Cherry Cookie (Lv2, HP 2) | ⭐⭐⭐ | 有效果但 HP 較低 |
| Mala Sauce Cookie (Lv2, HP 2) | ⭐⭐⭐ | 有效果但 HP 較低 |
| Popcorn Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |
| Adventurer Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |
| Carrot Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |
| Melon Bun Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |

### 攻擊目標威脅值

| 目標 | 威脅值 | 原因 |
|---|---|---|
| Red Bean Cookie | ⭐⭐⭐⭐⭐ | HP 高，攻擊力強 |
| Onion Cookie | ⭐⭐⭐⭐⭐ | HP 高，穩定 |
| Blue Lily Cookie | ⭐⭐⭐⭐ | Lv3，強力效果 |
| Lemon Thyme Cookie | ⭐⭐⭐⭐ | 有效果 |
| Avocado Cookie | ⭐⭐⭐ | HP 高，穩定 |
| Angel Cookie | ⭐ | 價值低 |
| Spinach Cookie | ⭐ | 價值低 |
| Bellflower Cookie | ⭐ | 價值低 |
| Cookiemals | ⭐ | 價值低 |

### 關鍵策略

1. **替補**：只補 Lv2+ HP 3+ 的餅乾，避免 HP 1 的 Popcorn、Adventurer、Carrot、Melon Bun
2. **部署**：Lv3 餅乾（Kumiho、Wildberry）不要過早鋪上，容易被豆子快速換掉
3. **攻擊**：優先擊倒 Red Bean > Onion > Blue Lily
4. **防守**：保留 Giant Cherry Bomb、Prickly Cacti Gloves 到豆子鋪場後再用
5. **節奏**：紅色靠快攻取勝，早期快速攻擊推高豆子破壞區

## 後續建議

1. 將上述策略拆成可重用的 `PlayerView` 評分項
2. 正式 AI 若要吸收此策略，應先改善共通替補評分與部署評分
3. 下一輪可用相同方法測試紅色對其他第二彈牌組
