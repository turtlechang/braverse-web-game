# BS2 黃色對 BS2 豆子訓練紀錄

日期：2026-07-07

## 測試設定

- 玩家牌組：第二彈黃色牌組（`bs2-yellow`）
- AI 對手牌組：第二彈豆子牌組（`bs2-bean`）
- 種子範圍：`1..50`
- 最大步數：`2500`
- 規則引擎：正式 `createDemoGame`、`simulateAiMatch`
- 對手強度：豆子 AI 維持 Lv.2
- 玩家側策略：黃色 Lv.2 AI 基準測試

## 基準勝率

| 玩家策略 | 對手策略 | 戰績 | 勝率 | 卡死 |
|---|---:|---:|---:|---:|
| Lv.2 AI | Lv.2 AI | 18 / 50 | 36% | 0 |

主要敗因幾乎都是 `break-level-limit`。黃色自動策略常把低 HP、低等級餅乾補上戰鬥區，導致黃色破壞區等級快速堆高（平均 10.5），而豆子只有 7.0。

## 敗局分析

所有 32 場敗局黃色的破壞區等級都 >= 8。

### 敗局破壞區模式

黃色敗局時破壞區常見餅乾：

| 餅乾 | 出現次數 | 等級 | HP |
|---|---|---|---|
| Chestnut Cookie | 35 | Lv1 | 1 |
| Mustard Cookie | 32 | Lv1 | 1 |
| Rockstar Cookie | 30 | Lv2 | 2 |
| Marshmallow Cookie | 23 | Lv1 | 3 |
| Blackberry Cookie | 21 | Lv3 | 3 |
| Earl Grey Cookie | 19 | Lv3 | 3 |
| Cyborg Cookie | 17 | Lv1 | 1 |
| Vampire Cookie | 12 | Lv2 | 3 |

**關鍵發現：**
- 黃色有大量 HP 1 餅乾（Chestnut、Mustard、Cyborg）被送進破壞區
- 即使 Lv3 餅乾（Blackberry、Earl Grey）也被快速換掉
- 黃色的問題比紅色更嚴重，因為黃色的低 HP 餅乾更多

### 豆子勝利策略

豆子通常透過以下方式獲勝：
1. 讓黃色自己累積高等級破壞區
2. 保留高 HP 餅乾（Red Bean Cookie、Onion Cookie）作為主戰
3. 使用回復效果（Supreme Whipped Cream）維持餅乾存活
4. 讓黃色的低 HP 餅乾被快速換掉

## 深度敗局分析

### Seed 1（break-level-limit）

**最終狀態：** 黃色破壞區 10，豆子 9

**關鍵問題：**
- 黃色破壞區有 **6 張餅乾**：2 個 Rockstar (Lv2)、Blackberry (Lv3)、Mustard (Lv1)、Cyborg (Lv1)、Marshmallow (Lv1)
- 豆子破壞區有 7 張：Onion (Lv2)、Red Bean (Lv2)、Candlelight (Lv1)、Melon Bun (Lv1)、2 個 Spinach (Lv1)、Angel (Lv1)
- 黃色棄牌 13 張，豆子 20 張

**教訓：** 黃色的 Lv2 餅乾（Rockstar）也被快速換掉，代表黃色的攻擊力不足

### Seed 2（break-level-limit）

**最終狀態：** 黃色破壞區 11，豆子 7

**關鍵問題：**
- 黃色破壞區有 **6 張餅乾**：Cyborg (Lv1)、2 個 Blackberry (Lv3)、Cyborg (Lv1)、Mustard (Lv1)、Rockstar (Lv2)
- 豆子破壞區有 5 張：Melon Bun (Lv1)、2 個 Red Bean (Lv2)、Angel (Lv1)、Ninja (Lv1)
- 黃色棄牌 17 張，豆子 25 張

**教訓：** 黃色把 Lv3 餅乾（Blackberry）也送進破壞區，代表部署時機不當

### Seed 5（break-level-limit）

**最終狀態：** 黃色破壞區 11，豆子 7

**關鍵問題：**
- 黃色破壞區有 **7 張餅乾**：2 個 Earl Grey (Lv3)、2 個 Mustard (Lv1)、Chestnut (Lv1)、Banana (Lv1)、Cyborg (Lv1)
- 豆子破壞區有 6 張：Red Bean (Lv2)、Candlelight (Lv1)、Angel (Lv1)、Salt (Lv1)、Angel (Lv1)、Cookiemals (Lv1)
- 黃色棄牌 16 張，豆子 18 張

**教訓：** 黃色把 Lv3 餅乾（Earl Grey）也送進破壞區，且有大量 HP 1 餅乾

### Seed 8（break-level-limit）

**最終狀態：** 黃色破壞區 12，豆子 7

**關鍵問題：**
- 黃色破壞區有 **5 張餅乾**：Blackberry (Lv3)、Chestnut (Lv1)、Rockstar (Lv2)、2 個 Earl Grey (Lv3)
- 豆子破壞區有 5 張：Cookiemals (Lv1)、Angel (Lv1)、Red Bean (Lv2)、Spinach (Lv1)、Red Bean (Lv2)
- 黃色棄牌 17 張，豆子 20 張

**教訓：** 黃色破壞區等級 12，代表黃色把高等級餅乾也送進破壞區

### Seed 17（break-level-limit）

**最終狀態：** 黃色破壞區 12，豆子 9

**關鍵問題：**
- 黃色破壞區有 **8 張餅乾**：2 個 Earl Grey (Lv3)、Marshmallow (Lv1)、3 個 Mustard (Lv1)、2 個 Cyborg (Lv1)
- 豆子破壞區有 6 張：Red Bean (Lv2)、Bellflower (Lv1)、Angel (Lv1)、2 個 Onion (Lv2)、Ninja (Lv1)
- 黃色棄牌 16 張，豆子 26 張

**教訓：** 黃色有大量 HP 1 餅乾（Mustard、Cyborg）被送進破壞區

### Seed 24（break-level-limit）

**最終狀態：** 黃色破壞區 11，豆子 6

**關鍵問題：**
- 黃色破壞區有 **4 張餅乾**：Eclair (Lv3)、Rockstar (Lv2)、Earl Grey (Lv3)、Blackberry (Lv3)
- 豆子破壞區有 5 張：Banana (Lv1)、Cookiemals (Lv1)、Spinach (Lv1)、Red Bean (Lv2)、Cookiemals (Lv1)
- 黃色棄牌 17 張，豆子 11 張

**教訓：** 黃色把 3 個 Lv3 餅乾都送進破壞區，代表高等級餅乾的使用有問題

### Seed 30（break-level-limit）

**最終狀態：** 黃色破壞區 10，豆子 3

**關鍵問題：**
- 黃色破壞區有 **5 張餅乾**：Snake Fruit (Lv2)、Chestnut (Lv1)、2 個 Rockstar (Lv2)、Blackberry (Lv3)
- 豆子破壞區只有 3 張：Angel (Lv1)、2 個 Cookiemals (Lv1)
- 黃色棄牌 13 張，豆子 7 張

**教訓：** 11 回合就結束，黃色快速堆高等級

### Seed 33（break-level-limit）

**最終狀態：** 黃色破壞區 10，豆子 3

**關鍵問題：**
- 黃色破壞區有 **4 張餅乾**：Mustard (Lv1)、2 個 Earl Grey (Lv3)、Blackberry (Lv3)
- 豆子破壞區只有 3 張：Angel (Lv1)、Cookiemals (Lv1)、Angel (Lv1)
- 黃色棄牌 10 張，豆子 8 張

**教訓：** 11 回合就結束，黃色把 Lv3 餅乾快速送進破壞區

### Seed 43（break-level-limit）

**最終狀態：** 黃色破壞區 11，豆子 2

**關鍵問題：**
- 黃色破壞區有 **5 張餅乾**：Rockstar (Lv2)、Vampire (Lv2)、Cyborg (Lv1)、2 個 Blackberry (Lv3)
- 豆子破壞區只有 2 張：Bellflower (Lv1)、Spinach (Lv1)
- 黃色棄牌 14 張，豆子 8 張

**教訓：** 11 回合就結束，黃色快速堆高等級

## 統計摘要

**黃色破壞區餅乾出現頻率（32 場敗局）：**

| 餅乾 | 出現次數 | 等級 | HP |
|---|---|---|---|
| Chestnut Cookie | 35 | Lv1 | 1 |
| Mustard Cookie | 32 | Lv1 | 1 |
| Rockstar Cookie | 30 | Lv2 | 2 |
| Marshmallow Cookie | 23 | Lv1 | 3 |
| Blackberry Cookie | 21 | Lv3 | 3 |
| Earl Grey Cookie | 19 | Lv3 | 3 |
| Cyborg Cookie | 17 | Lv1 | 1 |
| Vampire Cookie | 12 | Lv2 | 3 |

**平均破壞區等級：** 黃色 10.5，豆子 7.0

## 關鍵操作心得（黃色對豆子）

### 1. 替補不要選最低 HP

黃色現有 AI 傾向補低 HP 餅乾，對豆子很危險。

**應該補的餅乾：**
- Vampire Cookie (Lv2, HP 3) - HP 高，有回復能力
- Snake Fruit Cookie (Lv2, HP 2) - 有效果
- Rockstar Cookie (Lv2, HP 2) - 攻擊力高
- Eclair Cookie (Lv3, HP 3) - 高等級但要小心使用

**不應該優先補的餅乾：**
- Chestnut Cookie (Lv1, HP 1) - 太容易被換掉
- Mustard Cookie (Lv1, HP 1) - 太容易被換掉
- Cyborg Cookie (Lv1, HP 1) - 太容易被換掉
- Marshmallow Cookie (Lv1, HP 3) - HP 高但等級低

### 2. 不急著鋪第二隻低品質餅乾

黃色若把 HP 1 餅乾放成第二隻，豆子常能用攻擊或效果快速換掉。

**建議：**
- 若手上沒有高品質餅乾（Lv2+ HP 3+），寧可把牌放支援區
- 讓主戰餅乾保有付款能力
- 等手上有了 Vampire Cookie 或 Snake Fruit Cookie 再鋪第二隻

### 3. 支援階段優先保留防守資源

黃色的防守相對弱，但有陷阱卡。

**陷阱卡價值：**
- Super-Vita Jelly Bar - 回復 HP
- Winding Key Shield - 防禦
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

不要只用「最低 HP」作為唯一目標。豆子有些低 HP 餅乾（Angel、Spinach）即使擊倒也對黃色幫助不大。

### 5. 黃色要靠耐久換時間

黃色的優勢是陷阱卡和回復能力。勝局通常是：
- 早期用高 HP 餅乾建立防線
- 中期用陷阱卡延緩豆子攻勢
- 後期讓豆子破壞區先滿

**避免：**
- 送掉太多低品質餅乾導致破壞區先滿
- 急著攻擊而犧牲防守
- 讓豆子建立回復組合

## 正式訓練規則（待餵給 AI）

### 替補評分表（黃色對豆子）

| 餅乾 | 評分 | 原因 |
|---|---|---|
| Vampire Cookie (Lv2, HP 3) | ⭐⭐⭐⭐⭐ | HP 高，有回復能力 |
| Snake Fruit Cookie (Lv2, HP 2) | ⭐⭐⭐⭐ | 有效果 |
| Rockstar Cookie (Lv2, HP 2) | ⭐⭐⭐⭐ | 攻擊力高 |
| Eclair Cookie (Lv3, HP 3) | ⭐⭐⭐⭐ | 高等級但要小心 |
| Earl Grey Cookie (Lv3, HP 3) | ⭐⭐⭐⭐ | 高等級但要小心 |
| Blackberry Cookie (Lv3, HP 3) | ⭐⭐⭐⭐ | 高等級但要小心 |
| Chestnut Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |
| Mustard Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |
| Cyborg Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |
| Marshmallow Cookie (Lv1, HP 3) | ⭐⭐ | HP 高但等級低 |

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

1. **替補**：只補 Lv2+ HP 3+ 的餅乾，避免 HP 1 的 Chestnut、Mustard、Cyborg
2. **部署**：Lv3 餅乾（Blackberry、Earl Grey）不要過早鋪上，容易被豆子快速換掉
3. **攻擊**：優先擊倒 Red Bean > Onion > Blue Lily
4. **防守**：保留 Super-Vita Jelly Bar、Winding Key Shield 到豆子鋪場後再用
5. **節奏**：黃色靠耐久換時間，早期建立防線，後期讓豆子破壞區先滿

## 後續建議

1. 將上述策略拆成可重用的 `PlayerView` 評分項
2. 正式 AI 若要吸收此策略，應先改善共通替補評分與部署評分
3. 下一輪可用相同方法測試黃色對其他第二彈牌組
