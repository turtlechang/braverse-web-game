# BS2 藍色對 BS2 紅色訓練紀錄

日期：2026-07-08

## 測試設定

- 玩家牌組：第二彈藍色牌組（`bs2-blue`）
- AI 對手牌組：第二彈紅色牌組（`bs2-red`）
- 種子範圍：`1..50`
- 最大步數：`2500`
- 規則引擎：正式 `createDemoGame`、`simulateAiMatch`
- 對手強度：紅色 AI 維持 Lv.2
- 玩家側策略：藍色 Lv.2 AI 基準測試

## 基準勝率

| 玩家策略 | 對手策略 | 戰績 | 勝率 | 卡死 |
|---|---|---:|---:|---:|
| Lv.2 AI | Lv.2 AI | 21 / 50 | 42% | 0 |

主要敗因幾乎都是 `break-level-limit`。藍色自動策略前期鋪場較慢，紅色能快速建立高等級餅乾並集中火力。

## 敗局分析

29 場敗局中，28 場因 `break-level-limit` 敗北，1 場因 `no-cookie-available` 敗北。

### 敗局破壞區模式

藍色敗局時破壞區常見餅乾：
- Milk Cookie (Lv1, HP1) - 大量出現
- Skating Queen Cookie (Lv1, HP1) - 大量出現
- Peppermint Cookie (Lv1, HP1) - 多次出現
- Salt Cookie (Lv1, HP4) - 多次出現
- Aloe Cookie (Lv1, HP2) - 多次出現

藍色的問題在於 Lv1 餅乾 HP 普遍較低（Milk、Skating Queen、Peppermint），容易被紅色快速換掉。

### 紅色勝利策略

紅色通常透過以下方式獲勝：
1. 早期用 Rebel Cookie、Dark Choco Cookie 建立攻擊壓力
2. 集中火力擊倒藍色的低 HP 餅乾
3. 快速堆高藍色破壞區等級
4. Princess Cookie 穩定後期

## 關鍵操作心得（藍色對紅色）

### 1. 替補不要選最低 HP

藍色現有 AI 傾向補低 HP 餅乾，對紅色很危險。

**應該補的餅乾：**
- Sea Fairy Cookie (Lv3, HP5) - 後期核心，高攻擊
- Black Raisin Cookie (Lv3, HP5) - AOE 傷害
- Sherbet Cookie (Lv2, HP5) - 回手效果
- Tiramisu Cookie (Lv2, HP3) - 對 Lv1 額外傷害

**不應該優先補的餅乾：**
- Milk Cookie (Lv1, HP1) - 太容易被換掉
- Skating Queen Cookie (Lv1, HP1) - 太容易被換掉
- Peppermint Cookie (Lv1, HP1) - 太容易被換掉

### 2. 不急著鋪第二隻低品質餅乾

藍色若把 HP 1 餅乾放成第二隻，紅色常能用攻擊或效果快速換掉。

**建議：**
- 若手上沒有高品質餅乾（Lv2+ HP 3+），寧可把牌放支援區
- 讓主戰餅乾保有付款能力
- 等手上有了 Sea Fairy Cookie 或 Black Raisin Cookie 再鋪第二隻

### 3. 支援階段優先保留防守資源

藍色的防禦依賴陷阱卡和回手效果。

**關鍵牌價值：**
- Salt Crystal Trident - 陷阱防禦
- Fallen Ice Statue - 降低攻擊力
- Octo-Ink Spray - 降低攻擊力

### 4. 攻擊目標優先看紅色節奏威脅

紅色的威脅排序：
1. **Rebel Cookie** - HP 高，攻擊力強
2. **Dark Choco Cookie** - HP 高，攻擊力強
3. **Princess Cookie** - HP 高，穩定
4. **Mala Sauce Cookie** - 有效果
5. **Cherry Cookie** - 有效果

### 5. 藍色要靠手牌優勢取勝

藍色的優勢是抽牌和回手能力。勝局通常是：
- 早期用 Salt Cookie 穩住場面
- 中期用 Sea Fairy Cookie 的回手效果控制節奏
- 後期用 Black Raisin Cookie 的 AOE 傷害收割

## 敗局觀察

- Seed 1：藍色破壞區 10、紅色 7。藍色鋪了太多 Lv1 餅乾（Milk、Skating Queen）。
- Seed 2：藍色破壞區 11、紅色 6。藍色的 Sea Fairy 沒有及時上場。
- Seed 4：藍色破壞區 10、紅色 8。藍色前期被紅色快速換掉低 HP 餅乾。

## 可餵給 AI 的訓練規則

### 替補評分（藍色對紅色）

- 對紅色時，替補評分應優先考量「剩餘 HP、卡片等級、對手可直接傷害量」
- 不可單純選最低 HP
- 替補優先順序：Sea Fairy Cookie > Black Raisin Cookie > Sherbet Cookie > Tiramisu Cookie > 其他 Lv2+
- Milk Cookie、Skating Queen Cookie、Peppermint Cookie 不應優先補上戰鬥區

### 主階段部署

- 主階段部署第二隻餅乾前，應檢查該餅乾是否會在下一個紅色回合被低成本擊倒
- 若風險高，改放支援或結束主階段
- 沒有高品質餅乾時，寧可不鋪第二隻

### 攻擊目標評分

- 攻擊目標評分應加入威脅值：Rebel、Dark Choco 類型的持續壓力要高於普通低 HP 目標
- 能擊倒高 HP 目標時也有價值，因為可以快速推高紅色破壞區

### 抽牌與回手

- 藍色應優先使用抽牌效果維持手牌優勢
- Sea Fairy Cookie 的回手效果應保留到關鍵時刻使用
- 不要過早消耗手牌資源
