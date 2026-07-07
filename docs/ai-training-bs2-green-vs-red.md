# BS2 綠色對 BS2 紅色訓練紀錄

日期：2026-07-07

## 測試設定

- 玩家牌組：第二彈綠色牌組（`bs2-bean`）
- AI 對手牌組：第二彈紅色牌組（`bs2-red`）
- 種子範圍：`1..50`
- 最大步數：`2500`
- 規則引擎：正式 `createDemoGame`、`simulateAiMatch`
- 對手強度：紅色 AI 維持 Lv.2
- 玩家側策略：綠色 Lv.2 AI 基準測試

## 基準勝率

| 玩家策略 | 對手策略 | 戰績 | 勝率 | 卡死 |
|---|---:|---:|---:|---:|
| Lv.2 AI | Lv.2 AI | 27 / 50 | 54% | 0 |

主要敗因幾乎都是 `break-level-limit`。綠色自動策略常把低 HP、低等級餅乾補上戰鬥區，導致綠色破壞區等級快速堆高（平均 9.8），而紅色只有 6.9。

## 敗局分析

23 場敗局中，21 場綠色破壞區等級 >= 8。

### 敗局破壞區模式

綠色敗局時破壞區常見餅乾：

| 餅乾 | 出現次數 | 等級 | HP |
|---|---|---|---|
| Angel Cookie | 24 | Lv1 | 1 |
| Spinach Cookie | 21 | Lv1 | 1 |
| Lemon Thyme Cookie | 18 | Lv2 | 2 |
| Bellflower Cookie | 16 | Lv1 | 1 |
| Banana Cookie | 15 | Lv1 | 1 |
| Red Bean Cookie | 14 | Lv2 | 3 |
| Cookiemals | 13 | Lv1 | 1 |
| Onion Cookie | 13 | Lv2 | 3 |
| Melon Bun Cookie | 11 | Lv1 | 1 |
| Salt Cookie | 9 | Lv1 | 1 |
| Candlelight Cookie | 9 | Lv1 | 1 |
| Ninja Cookie | 8 | Lv1 | 1 |
| Blue Lily Cookie | 3 | Lv3 | 3 |

**關鍵發現：**
- 綠色有大量 HP 1 餅乾（Angel、Spinach、Bellflower、Cookiemals）被送進破壞區
- Lv2 餅乾（Lemon Thyme、Red Bean、Onion）也被快速換掉
- 即使 Lv3 餅乾（Blue Lily）也被送進破壞區

### 紅色勝利策略

紅色通常透過以下方式獲勝：
1. 讓綠色自己累積高等級破壞區
2. 保留高攻擊餅乾（Rebel Cookie、Dark Choco Cookie）作為主戰
3. 使用直接傷害效果快速換掉綠色餅乾
4. 讓綠色的低 HP 餅乾被快速換掉

## 深度敗局分析

### Seed 2（break-level-limit）

**最終狀態：** 綠色破壞區 10，紅色 7

**關鍵問題：**
- 綠色破壞區有 **9 張餅乾**：Cookiemals (Lv1)、2 個 Bellflower (Lv1)、Angel (Lv1)、Lemon Thyme (Lv2)、Melon Bun (Lv1)、Banana (Lv1)、Ninja (Lv1)、Cookiemals (Lv1)
- 紅色破壞區有 5 張：Mala Sauce (Lv2)、2 個 Carrot (Lv1)、Princess (Lv2)、Carrot (Lv1)
- 綠色棄牌 28 張，紅色只有 7 張

**教訓：** 綠色棄牌太多，資源管理有問題

### Seed 6（break-level-limit）

**最終狀態：** 綠色破壞區 10，紅色 7

**關鍵問題：**
- 綠色破壞區有 **9 張餅乾**：4 個 Angel (Lv1)、Banana (Lv1)、Salt (Lv1)、Bellflower (Lv1)、Cookiemals (Lv1)、Onion (Lv2)
- 紅色破壞區有 5 張：Mala Sauce (Lv2)、2 個 Popcorn (Lv1)、Melon Bun (Lv1)、Dark Choco (Lv2)
- 綠色棄牌 22 張，紅色 24 張

**教訓：** 綠色有 4 個 Angel Cookie 被送進破壞區

### Seed 7（break-level-limit）

**最終狀態：** 綠色破壞區 10，紅色 8

**關鍵問題：**
- 綠色破壞區有 **7 張餅乾**：Red Bean (Lv2)、Lemon Thyme (Lv2)、Cookiemals (Lv1)、Bellflower (Lv1)、Onion (Lv2)、Melon Bun (Lv1)、Banana (Lv1)
- 紅色破壞區有 6 張：Popcorn (Lv1)、Carrot (Lv1)、Adventurer (Lv1)、Carrot (Lv1)、Princess (Lv2)、Mala Sauce (Lv2)
- 綠色棄牌 24 張，紅色 12 張

**教訓：** 綠色有 3 個 Lv2 餅乾（Red Bean、Lemon Thyme、Onion）被送進破壞區

### Seed 9（break-level-limit）

**最終狀態：** 綠色破壞區 10，紅色 9

**關鍵問題：**
- 綠色破壞區有 **8 張餅乾**：Candlelight (Lv1)、Red Bean (Lv2)、Spinach (Lv1)、Red Bean (Lv2)、2 個 Salt (Lv1)、Bellflower (Lv1)、Cookiemals (Lv1)
- 紅色破壞區有 8 張：3 個 Adventurer (Lv1)、2 個 Carrot (Lv1)、Princess (Lv2)、Popcorn (Lv1)、Melon Bun (Lv1)
- 綠色棄牌 34 張，紅色 17 張

**教訓：** 綠色棄牌 34 張，資源管理嚴重有問題

### Seed 14（break-level-limit）

**最終狀態：** 綠色破壞區 10，紅色 7

**關鍵問題：**
- 綠色破壞區有 **7 張餅乾**：Banana (Lv1)、Cookiemals (Lv1)、Ninja (Lv1)、Lemon Thyme (Lv2)、2 個 Red Bean (Lv2)、Salt (Lv1)
- 紅色破壞區有 6 張：Adventurer (Lv1)、Popcorn (Lv1)、Carrot (Lv1)、Popcorn (Lv1)、Adventurer (Lv1)、Mala Sauce (Lv2)
- 綠色棄牌 29 張，紅色 10 張

**教訓：** 綠色有 2 個 Red Bean Cookie 被送進破壞區

### Seed 15（break-level-limit）

**最終狀態：** 綠色破壞區 11，紅色 9

**關鍵問題：**
- 綠色破壞區有 **8 張餅乾**：Spinach (Lv1)、Cookiemals (Lv1)、2 個 Lemon Thyme (Lv2)、Onion (Lv2)、2 個 Ninja (Lv1)、Melon Bun (Lv1)
- 紅色破壞區有 7 張：3 個 Popcorn (Lv1)、2 個 Carrot (Lv1)、Cherry (Lv2)、Princess (Lv2)
- 綠色棄牌 24 張，紅色 12 張

**教訓：** 綠色破壞區等級 11，且有 2 個 Lemon Thyme Cookie 被送進破壞區

### Seed 20（no-cookie-available）

**最終狀態：** 綠色破壞區 5，紅色 0

**關鍵問題：**
- 綠色破壞區有 **4 張餅乾**：2 個 Spinach (Lv1)、Candlelight (Lv1)、Red Bean (Lv2)
- 紅色破壞區沒有餅乾
- 綠色棄牌 15 張，紅色只有 2 張
- 7 回合就結束，綠色沒有餅乾可用

**教訓：** 綠色消耗太快，沒有保留足夠的餅乾

### Seed 22（break-level-limit）

**最終狀態：** 綠色破壞區 10，紅色 7

**關鍵問題：**
- 綠色破壞區有 **8 張餅乾**：Bellflower (Lv1)、Angel (Lv1)、Spinach (Lv1)、2 個 Lemon Thyme (Lv2)、Bellflower (Lv1)、Cookiemals (Lv1)、Banana (Lv1)
- 紅色破壞區有 6 張：Popcorn (Lv1)、Adventurer (Lv1)、Carrot (Lv1)、Adventurer (Lv1)、Mala Sauce (Lv2)、Adventurer (Lv1)
- 綠色棄牌 28 張，紅色 14 張

**教訓：** 綠色有 2 個 Bellflower Cookie 和 2 個 Lemon Thyme Cookie 被送進破壞區

### Seed 25（break-level-limit）

**最終狀態：** 綠色破壞區 10，紅色 8

**關鍵問題：**
- 綠色破壞區有 **9 張餅乾**：Spinach (Lv1)、Angel (Lv1)、Red Bean (Lv2)、Bellflower (Lv1)、Banana (Lv1)、Candlelight (Lv1)、Angel (Lv1)、Melon Bun (Lv1)、Candlelight (Lv1)
- 紅色破壞區有 7 張：Princess (Lv2)、Popcorn (Lv1)、Carrot (Lv1)、Popcorn (Lv1)、Adventurer (Lv1)、Melon Bun (Lv1)、Popcorn (Lv1)
- 綠色棄牌 0 張，紅色 18 張

**教訓：** 綠色沒有棄牌，但破壞區等級很高

### Seed 26（break-level-limit）

**最終狀態：** 綠色破壞區 10，紅色 2

**關鍵問題：**
- 綠色破壞區有 **7 張餅乾**：Onion (Lv2)、Lemon Thyme (Lv2)、Red Bean (Lv2)、Bellflower (Lv1)、Banana (Lv1)、Angel (Lv1)、Spinach (Lv1)
- 紅色破壞區只有 1 張：Cherry (Lv2)
- 綠色棄牌 28 張，紅色只有 5 張

**教訓：** 綠色棄牌太多，資源管理有問題

### Seed 27（break-level-limit）

**最終狀態：** 綠色破壞區 11，紅色 9

**關鍵問題：**
- 綠色破壞區有 **9 張餅乾**：Melon Bun (Lv1)、Spinach (Lv1)、Angel (Lv1)、Lemon Thyme (Lv2)、Salt (Lv1)、Bellflower (Lv1)、Melon Bun (Lv1)、Angel (Lv1)、Onion (Lv2)
- 紅色破壞區有 6 張：Adventurer (Lv1)、Dark Choco (Lv2)、Popcorn (Lv1)、Princess (Lv2)、Whipped Cream (Lv2)、Carrot (Lv1)
- 綠色棄牌 29 張，紅色 24 張

**教訓：** 綠色破壞區等級 11，且有大量 Lv1 餅乾

### Seed 28（break-level-limit）

**最終狀態：** 綠色破壞區 11，紅色 9

**關鍵問題：**
- 綠色破壞區有 **8 張餅乾**：Candlelight (Lv1)、Spinach (Lv1)、Red Bean (Lv2)、Onion (Lv2)、Banana (Lv1)、Cookiemals (Lv1)、Spinach (Lv1)、Lemon Thyme (Lv2)
- 紅色破壞區有 7 張：Popcorn (Lv1)、Princess (Lv2)、Mala Sauce (Lv2)、4 個 Popcorn (Lv1)、Adventurer (Lv1)
- 綠色棄牌 18 張，紅色 15 張

**教訓：** 綠色破壞區等級 11，且有 2 個 Spinach Cookie 被送進破壞區

### Seed 31（no-cookie-available）

**最終狀態：** 綠色破壞區 9，紅色 8

**關鍵問題：**
- 綠色破壞區有 **8 張餅乾**：Cookiemals (Lv1)、Bellflower (Lv1)、Spinach (Lv1)、Red Bean (Lv2)、Bellflower (Lv1)、Melon Bun (Lv1)、Salt (Lv1)、Ninja (Lv1)
- 紅色破壞區有 5 張：Cherry (Lv2)、Princess (Lv2)、Popcorn (Lv1)、Carrot (Lv1)、Princess (Lv2)
- 綠色棄牌 27 張，紅色 15 張
- 14 回合就結束，綠色沒有餅乾可用

**教訓：** 綠色消耗太快，沒有保留足夠的餅乾

### Seed 33（break-level-limit）

**最終狀態：** 綠色破壞區 11，紅色 9

**關鍵問題：**
- 綠色破壞區有 **9 張餅乾**：Ninja (Lv1)、Candlelight (Lv1)、Angel (Lv1)、Banana (Lv1)、Ninja (Lv1)、Spinach (Lv1)、Salt (Lv1)、Red Bean (Lv2)、Lemon Thyme (Lv2)
- 紅色破壞區有 6 張：Carrot (Lv1)、Adventurer (Lv1)、Popcorn (Lv1)、Cherry (Lv2)、Princess (Lv2)、Rebel (Lv2)
- 綠色棄牌 0 張，紅色 19 張

**教訓：** 綠色沒有棄牌，但破壞區等級很高

### Seed 34（break-level-limit）

**最終狀態：** 綠色破壞區 10，紅色 8

**關鍵問題：**
- 綠色破壞區有 **6 張餅乾**：Spinach (Lv1)、Lemon Thyme (Lv2)、Red Bean (Lv2)、Banana (Lv1)、Angel (Lv1)、Blue Lily (Lv3)
- 紅色破壞區有 5 張：Carrot (Lv1)、Adventurer (Lv1)、Muscle (Lv2)、2 個 Cherry (Lv2)
- 綠色棄牌 17 張，紅色 12 張

**教訓：** 綠色把 Lv3 餅乾（Blue Lily）也送進破壞區

### Seed 35（break-level-limit）

**最終狀態：** 綠色破壞區 10，紅色 4

**關鍵問題：**
- 綠色破壞區有 **7 張餅乾**：Spinach (Lv1)、2 個 Lemon Thyme (Lv2)、Angel (Lv1)、Melon Bun (Lv1)、Onion (Lv2)、Candlelight (Lv1)
- 紅色破壞區有 4 張：Melon Bun (Lv1)、Popcorn (Lv1)、Adventurer (Lv1)、Carrot (Lv1)
- 綠色棄牌 17 張，紅色 17 張

**教訓：** 綠色有 2 個 Lemon Thyme Cookie 被送進破壞區

### Seed 36（break-level-limit）

**最終狀態：** 綠色破壞區 10，紅色 6

**關鍵問題：**
- 綠色破壞區有 **9 張餅乾**：3 個 Angel (Lv1)、Bellflower (Lv1)、Onion (Lv2)、2 個 Melon Bun (Lv1)、Salt (Lv1)、Banana (Lv1)
- 紅色破壞區有 4 張：Mala Sauce (Lv2)、Adventurer (Lv1)、Carrot (Lv1)、Muscle (Lv2)
- 綠色棄牌 37 張，紅色 13 張

**教訓：** 綠色棄牌 37 張，資源管理嚴重有問題

### Seed 39（break-level-limit）

**最終狀態：** 綠色破壞區 10，紅色 9

**關鍵問題：**
- 綠色破壞區有 **8 張餅乾**：Spinach (Lv1)、2 個 Angel (Lv1)、Cookiemals (Lv1)、2 個 Lemon Thyme (Lv2)、Ninja (Lv1)、Candlelight (Lv1)
- 紅色破壞區有 8 張：Dark Choco (Lv2)、3 個 Adventurer (Lv1)、Popcorn (Lv1)、Carrot (Lv1)、Popcorn (Lv1)、Melon Bun (Lv1)
- 綠色棄牌 17 張，紅色 22 張

**教訓：** 綠色有 2 個 Angel Cookie 和 2 個 Lemon Thyme Cookie 被送進破壞區

### Seed 40（break-level-limit）

**最終狀態：** 綠色破壞區 12，紅色 7

**關鍵問題：**
- 綠色破壞區有 **8 張餅乾**：Red Bean (Lv2)、Onion (Lv2)、Salt (Lv1)、Bellflower (Lv1)、Angel (Lv1)、Spinach (Lv1)、Banana (Lv1)、Blue Lily (Lv3)
- 紅色破壞區有 6 張：2 個 Adventurer (Lv1)、Carrot (Lv1)、Mala Sauce (Lv2)、Adventurer (Lv1)、Carrot (Lv1)
- 綠色棄牌 0 張，紅色 10 張

**教訓：** 綠色破壞區等級 12，且把 Lv3 餅乾（Blue Lily）也送進破壞區

### Seed 43（break-level-limit）

**最終狀態：** 綠色破壞區 10，紅色 8

**關鍵問題：**
- 綠色破壞區有 **7 張餅乾**：Melon Bun (Lv1)、Lemon Thyme (Lv2)、Spinach (Lv1)、2 個 Angel (Lv1)、Onion (Lv2)、Red Bean (Lv2)
- 紅色破壞區有 5 張：Cherry (Lv2)、Popcorn (Lv1)、Princess (Lv2)、Adventurer (Lv1)、Cherry (Lv2)
- 綠色棄牌 18 張，紅色 19 張

**教訓：** 綠色有 2 個 Angel Cookie 被送進破壞區

### Seed 45（no-cookie-available）

**最終狀態：** 綠色破壞區 4，紅色 1

**關鍵問題：**
- 綠色破壞區有 **4 張餅乾**：2 個 Angel (Lv1)、Banana (Lv1)、Cookiemals (Lv1)
- 紅色破壞區只有 1 張：Carrot (Lv1)
- 綠色棄牌 9 張，紅色只有 1 張
- 6 回合就結束，綠色沒有餅乾可用

**教訓：** 綠色消耗太快，沒有保留足夠的餅乾

### Seed 46（break-level-limit）

**最終狀態：** 綠色破壞區 11，紅色 9

**關鍵問題：**
- 綠色破壞區有 **7 張餅乾**：Cookiemals (Lv1)、2 個 Onion (Lv2)、2 個 Spinach (Lv1)、Banana (Lv1)、Blue Lily (Lv3)
- 紅色破壞區有 6 張：Adventurer (Lv1)、Popcorn (Lv1)、Mala Sauce (Lv2)、Rebel (Lv2)、Dark Choco (Lv2)、Carrot (Lv1)
- 綠色棄牌 19 張，紅色 22 張

**教訓：** 綠色破壞區等級 11，且把 Lv3 餅乾（Blue Lily）也送進破壞區

### Seed 48（break-level-limit）

**最終狀態：** 綠色破壞區 10，紅色 7

**關鍵問題：**
- 綠色破壞區有 **8 張餅乾**：Banana (Lv1)、Spinach (Lv1)、Lemon Thyme (Lv2)、Candlelight (Lv1)、Bellflower (Lv1)、Spinach (Lv1)、Onion (Lv2)、Bellflower (Lv1)
- 紅色破壞區有 5 張：2 個 Popcorn (Lv1)、Adventurer (Lv1)、2 個 Princess (Lv2)
- 綠色棄牌 26 張，紅色 13 張

**教訓：** 綠色有 2 個 Spinach Cookie 和 2 個 Bellflower Cookie 被送進破壞區

## 統計摘要

**綠色破壞區餅乾出現頻率（23 場敗局）：**

| 餅乾 | 出現次數 | 等級 | HP |
|---|---|---|---|
| Angel Cookie | 24 | Lv1 | 1 |
| Spinach Cookie | 21 | Lv1 | 1 |
| Lemon Thyme Cookie | 18 | Lv2 | 2 |
| Bellflower Cookie | 16 | Lv1 | 1 |
| Banana Cookie | 15 | Lv1 | 1 |
| Red Bean Cookie | 14 | Lv2 | 3 |
| Cookiemals | 13 | Lv1 | 1 |
| Onion Cookie | 13 | Lv2 | 3 |
| Melon Bun Cookie | 11 | Lv1 | 1 |

**平均破壞區等級：** 綠色 9.8，紅色 6.9

## 關鍵操作心得（綠色對紅色）

### 1. 替補不要選最低 HP

綠色現有 AI 傾向補低 HP 餅乾，對紅色很危險。

**應該補的餅乾：**
- Red Bean Cookie (Lv2, HP 3) - 高攻擊，能創造節奏
- Onion Cookie (Lv2, HP 3) - 穩定的二級餅乾
- Avocado Cookie (Lv2, HP 3) - 穩定
- Blue Lily Cookie (Lv3, HP 3) - 高等級但要小心使用

**不應該優先補的餅乾：**
- Angel Cookie (Lv1, HP 1) - 太容易被換掉
- Spinach Cookie (Lv1, HP 1) - 太容易被換掉
- Bellflower Cookie (Lv1, HP 1) - 太容易被換掉
- Cookiemals (Lv1, HP 1) - 太容易被換掉
- Banana Cookie (Lv1, HP 1) - 太容易被換掉

### 2. 不急著鋪第二隻低品質餅乾

綠色若把 HP 1 餅乾放成第二隻，紅色常能用攻擊或效果快速換掉。

**建議：**
- 若手上沒有高品質餅乾（Lv2+ HP 3+），寧可把牌放支援區
- 讓主戰餅乾保有付款能力
- 等手上有了 Red Bean Cookie 或 Onion Cookie 再鋪第二隻

### 3. 支援階段優先保留防守資源

綠色的防守相對弱，但有回復能力。

**回復牌價值：**
- Supreme Whipped Cream - 回復 HP
- Ancient Healer's Gaze - 回復效果
- 但不要過早使用，等綠色建立優勢後再用效果更好

**攻擊時機：**
- 優先擊倒紅色的高攻擊餅乾（Rebel Cookie、Dark Choco Cookie）
- 不要只攻擊最低 HP 的目標
- 紅色的 Popcorn Cookie、Carrot Cookie、Adventurer Cookie 雖然 HP 低，但價值不高

### 4. 攻擊目標優先看紅色節奏威脅

紅色的威脅排序：
1. **Rebel Cookie** - HP 高，攻擊力強
2. **Dark Choco Cookie** - HP 高，攻擊力強
3. **Princess Cookie** - HP 高，穩定
4. **Mala Sauce Cookie** - 有效果
5. **Cherry Cookie** - 有效果

不要只用「最低 HP」作為唯一目標。紅色有些低 HP 餅乾（Popcorn、Carrot、Adventurer）即使擊倒也對綠色幫助不大。

### 5. 綠色要靠回復與耐久取勝

綠色的優勢是回復能力強。勝局通常是：
- 早期用高 HP 餅乾建立防線
- 中期用回復效果維持餅乾存活
- 後期讓紅色破壞區先滿

**避免：**
- 送掉太多低品質餅乾導致破壞區先滿
- 急著攻擊而犧牲防守
- 讓紅色建立攻擊組合

## 正式訓練規則（待餵給 AI）

### 替補評分表（綠色對紅色）

| 餅乾 | 評分 | 原因 |
|---|---|---|
| Red Bean Cookie (Lv2, HP 3) | ⭐⭐⭐⭐⭐ | 高攻擊，穩定 |
| Onion Cookie (Lv2, HP 3) | ⭐⭐⭐⭐⭐ | 穩定的二級餅乾 |
| Avocado Cookie (Lv2, HP 3) | ⭐⭐⭐⭐ | 穩定 |
| Blue Lily Cookie (Lv3, HP 3) | ⭐⭐⭐⭐ | 高等級但要小心 |
| Lemon Thyme Cookie (Lv2, HP 2) | ⭐⭐⭐ | 有效果但 HP 較低 |
| Angel Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |
| Spinach Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |
| Bellflower Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |
| Cookiemals (Lv1, HP 1) | ⭐ | **絕對不要補** |
| Banana Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |

### 攻擊目標威脅值

| 目標 | 威脅值 | 原因 |
|---|---|---|
| Rebel Cookie | ⭐⭐⭐⭐⭐ | HP 高，攻擊力強 |
| Dark Choco Cookie | ⭐⭐⭐⭐⭐ | HP 高，攻擊力強 |
| Princess Cookie | ⭐⭐⭐⭐ | HP 高，穩定 |
| Mala Sauce Cookie | ⭐⭐⭐⭐ | 有效果 |
| Cherry Cookie | ⭐⭐⭐ | 有效果 |
| Popcorn Cookie | ⭐ | 價值低 |
| Carrot Cookie | ⭐ | 價值低 |
| Adventurer Cookie | ⭐ | 價值低 |

### 關鍵策略

1. **替補**：只補 Lv2+ HP 3+ 的餅乾，避免 HP 1 的 Angel、Spinach、Bellflower、Cookiemals、Banana
2. **部署**：Lv3 餅乾（Blue Lily）不要過早鋪上，容易被紅色快速換掉
3. **攻擊**：優先擊倒 Rebel > Dark Choco > Princess
4. **防守**：保留 Supreme Whipped Cream、Ancient Healer's Gaze 到有優勢時再用
5. **節奏**：綠色靠回復與耐久取勝，早期建立防線，後期讓紅色破壞區先滿

## 後續建議

1. 將上述策略拆成可重用的 `PlayerView` 評分項
2. 正式 AI 若要吸收此策略，應先改善共通替補評分與部署評分
3. 下一輪可用相同方法測試綠色對其他第二彈牌組
