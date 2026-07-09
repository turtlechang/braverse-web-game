# BS2 豆子對 BS2 黃色訓練紀錄

日期：2026-07-07

## 測試設定

- 玩家牌組：第二彈豆子牌組（`bs2-bean`）
- AI 對手牌組：第二彈黃色牌組（`bs2-yellow`）
- 種子範圍：`1..50`
- 最大步數：`2500`
- 規則引擎：正式 `createDemoGame`、`simulateAiMatch`
- 對手強度：黃色 AI 維持 Lv.2
- 玩家側策略：豆子 Lv.2 AI 基準測試

## 基準勝率

| 玩家策略 | 對手策略 | 戰績 | 勝率 | 卡死 |
|---|---:|---:|---:|---:|
| Lv.2 AI | Lv.2 AI | 36 / 50 | 72% | 0 |

主要敗因幾乎都是 `break-level-limit`。豆子自動策略常把低 HP、低等級餅乾補上戰鬥區，導致豆子破壞區等級快速堆高（平均 9.5），而黃色只有 7.4。

## 敗局分析

14 場敗局中，11 場豆子破壞區等級 >= 8。

### 敗局破壞區模式

豆子敗局時破壞區常見餅乾：
- Angel Cookie (Lv1) - 大量出現（HP 1）
- Spinach Cookie (Lv1) - 大量出現（HP 1）
- Bellflower Cookie (Lv1) - 大量出現（HP 1）
- Cookiemals (Lv1) - 多次出現（HP 1）
- Onion Cookie (Lv2) - 多次出現
- Red Bean Cookie (Lv2) - 多次出現
- Lemon Thyme Cookie (Lv2) - 多次出現

豆子的問題比紅色更嚴重，因為豆子有更多 HP 1 的餅乾（Angel、Spinach、Bellflower、Cookiemals）。

### 黃色勝利策略

黃色通常透過以下方式獲勝：
1. 讓豆子自己累積高等級破壞區
2. 保留高 HP 餅乾（Banana Cookie、Vampire Cookie）作為主戰
3. 使用陷阱卡延緩豆子攻勢
4. Star Candy Road 穩定回復

## 關鍵操作心得（豆子對黃色）

### 1. 替補不要選最低 HP

豆子現有 AI 傾向補低 HP 餅乾，對黃色很危險。

**應該補的餅乾：**
- Red Bean Cookie (Lv2, HP 3) - 高攻擊，能創造節奏
- Onion Cookie (Lv2, HP 3) - 穩定的二級餅乾
- Lemon Thyme Cookie (Lv2, HP 2) - 有特殊效果
- Avocado Cookie (Lv2, HP 3) - 穩定的二級餅乾

**不應該優先補的餅乾：**
- Angel Cookie (Lv1, HP 1) - 太容易被換掉
- Spinach Cookie (Lv1, HP 1) - 太容易被換掉
- Bellflower Cookie (Lv1, HP 1) - 太容易被換掉
- Cookiemals (Lv1, HP 1) - 太容易被換掉

### 2. 不急著鋪第二隻低品質餅乾

豆子若把 HP 1 餅乾放成第二隻，黃色常能用攻擊或效果快速換掉。

**建議：**
- 若手上沒有高品質餅乾（Lv2+ HP 3+），寧可把牌放支援區
- 讓主戰餅乾保有付款能力
- 等手上有了 Red Bean Cookie 或 Onion Cookie 再鋪第二隻

### 3. 支援階段優先保留防守資源

豆子的防守相對弱，但有回復能力。

**回復牌價值：**
- Supreme Whipped Cream - 回復 HP
- Ancient Healer's Gaze - 回復效果
- 但不要過早使用，等豆子建立優勢後再用效果更好

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

不要只用「最低 HP」作為唯一目標。黃色有些低 HP 餅乾即使擊倒也對豆子幫助不大。

### 5. 豆子要靠回復與耐久取勝

豆子的優勢是回復能力強。勝局通常是：
- 早期用高 HP 餅乾建立防線
- 中期用回復效果維持餅乾存活
- 後期讓黃色破壞區先滿

**避免：**
- 送掉太多低品質餅乾導致破壞區先滿
- 急著攻擊而犧牲防守
- 讓黃色建立 Star Candy Road + 高 HP 主戰的組合

## 敗局觀察

- Seed 5：豆子破壞區 11、黃色破壞區 6。豆子鋪了太多 Lv1 餅乾（Angel、Candlelight、Onion、Salt、Spinach）。
- Seed 10：豆子破壞區 10、黃色破壞區 4。豆子的 Lemon Thyme、Angel、Cookiemals 被快速換掉。
- Seed 36：豆子破壞區 11、黃色破壞區 8。豆子有 3 個 Angel Cookie 在破壞區。

## 可餵給 AI 的訓練規則

### 替補評分（豆子對黃色）

- 對黃色時，替補評分應優先考量「剩餘 HP、卡片等級、對手可直接傷害量」
- 不可單純選最低 HP
- 替補優先順序：Red Bean Cookie > Onion Cookie > Lemon Thyme Cookie > Avocado Cookie > 其他 Lv2+
- Angel Cookie、Spinach Cookie、Bellflower Cookie、Cookiemals 不應優先補上戰鬥區

### 主階段部署

- 主階段部署第二隻餅乾前，應檢查該餅乾是否會在下一個黃色回合被低成本擊倒
- 若風險高，改放支援或結束主階段
- 沒有高品質餅乾時，寧可不鋪第二隻

### 攻擊目標評分

- 攻擊目標評分應加入威脅值：Banana、Vampire、Eclair 類型的持續壓力要高於普通低 HP 目標
- 能擊倒高 HP 目標時也有價值，因為可以快速推高黃色破壞區

### 回復牌使用

- 回復牌不應被過早當作支援
- Supreme Whipped Cream 應保留到豆子有優勢時再使用
- Ancient Healer's Gaze 在能回復關鍵餅乾時才使用

## 深度敗局分析

### Seed 5（break-level-limit）

**最終狀態：** 豆子破壞區 11，黃色 6

**關鍵問題：**
- 豆子破壞區有 **8 張餅乾**：3 個 Angel Cookie、2 個 Onion Cookie、Candlelight、Salt、Spinach、Lemon Thyme
- 戰鬥區只剩 1 個 Ninja Cookie，手牌只有 Bellflower 和 Red Bean
- AI 一直補低 HP 餅乾（Angel、Spinach）上戰鬥區，被黃色快速換掉

**教訓：** 豆子不應該鋪 Angel Cookie 這種 HP 1 的餅乾

### Seed 9（no-cookie-available）

**最終狀態：** 豆子破壞區 7，黃色 7，但豆子沒有餅乾了

**關鍵問題：**
- 豆子把大量餅乾送進棄牌區（26 張！）
- 支援區有 11 張卡，但戰鬥區和手牌都空了
- 豆子消耗太快，沒有保留足夠的餅乾

**教訓：** 豆子需要更保守的資源管理

### Seed 10（break-level-limit）

**最終狀態：** 豆子破壞區 10，黃色 4

**關鍵問題：**
- 豆子破壞區有 **7 張餅乾**：2 個 Angel Cookie、2 個 Cookiemals、Lemon Thyme、Onion、Red Bean
- 12 回合就結束，豆子快速堆高等級
- 低 HP 餅乾（Angel、Cookiemals）被黃色輕鬆換掉

**教訓：** Cookiemals 也是 HP 1，不應該優先補上

### Seed 37（no-cookie-available）

**最終狀態：** 豆子破壞區 7，黃色 9，但豆子沒有餅乾了

**關鍵問題：**
- 豆子把大量餅乾送進棄牌區（27 張！）
- 支援區有 8 張卡，但戰鬥區和手牌都空了
- 黃色反而有更多餅乾在場上

**教訓：** 豆子的回復牌（Supreme Whipped Cream）沒有有效使用

## 正式訓練規則（待餵給 AI）

### 替補評分表（豆子對黃色）

| 餅乾 | 評分 | 原因 |
|---|---|---|
| Red Bean Cookie (Lv2, HP 3) | ⭐⭐⭐⭐⭐ | 高攻擊，穩定 |
| Onion Cookie (Lv2, HP 3) | ⭐⭐⭐⭐⭐ | 穩定的二級餅乾 |
| Avocado Cookie (Lv2, HP 3) | ⭐⭐⭐⭐ | 穩定 |
| Lemon Thyme Cookie (Lv2, HP 2) | ⭐⭐⭐ | 有效果但 HP 較低 |
| Blue Lily Cookie (Lv3, HP 3) | ⭐⭐⭐⭐ | 高等級但要小心使用 |
| Angel Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |
| Spinach Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |
| Bellflower Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |
| Cookiemals (Lv1, HP 1) | ⭐ | **絕對不要補** |

### 關鍵策略

1. **替補**：只補 Lv2+ HP 3+ 的餅乾
2. **部署**：沒有高品質餅乾時寧可不鋪第二隻
3. **攻擊**：優先擊倒 Banana > Vampire > Eclair
4. **資源**：保留回復牌，不要浪費在低價值目標

## 後續建議

1. 將上述策略拆成可重用的 `PlayerView` 評分項
2. 正式 AI 若要吸收此策略，應先改善共通替補評分與部署評分
3. 下一輪可用相同方法測試豆子對其他第二彈牌組
