# BS2 黃色對 BS2 紅色訓練紀錄

日期：2026-07-07

## 測試設定

- 玩家牌組：第二彈黃色牌組（`bs2-yellow`）
- AI 對手牌組：第二彈紅色牌組（`bs2-red`）
- 種子範圍：`1..50`
- 最大步數：`2500..3000`
- 規則引擎：正式 `createDemoGame`、`applyGameCommand`、`takeAiStep`
- 對手強度：紅色 AI 維持 Lv.2
- 玩家側策略：訓練用手動駕駛策略，不寫入正式 AI

## 基準勝率

| 玩家策略 | 對手策略 | 戰績 | 勝率 | 卡死 |
|---|---:|---:|---:|---:|
| Lv.2 AI | Lv.2 AI | 12 / 50 | 24% | 0 |
| Lv.3 AI | Lv.2 AI | 13 / 50 | 26% | 0 |
| Lv.3 AI | Lv.3 AI | 24 / 50 | 48% | 0 |

主要敗因幾乎都是 `break-level-limit`。黃色自動策略常把低 HP、低等級餅乾補上戰鬥區，讓紅色的直接傷害與高攻擊快速堆高黃色破壞區等級。

## 訓練用策略結果

訓練用黃色駕駛策略對紅色 Lv.2 AI：

- 戰績：48 勝 2 敗
- 勝率：96%
- 卡死：0
- 敗局：seed 1、seed 29
- 敗因：兩局皆為 `break-level-limit`

此結果已超過原本 90% 目標，因此不需要降到 60% 目標。這不是正式 AI 強度，僅代表玩家側若採用下列合法操作原則，可以大幅改善第二彈黃色對第二彈紅色的勝率。

## 關鍵操作心得

1. 替補不要選最低 HP。
   - 現有簡單 AI 會傾向補低 HP 餅乾，對紅色很危險。
   - 對紅色時，替補優先選 Banana Cookie、Marshmallow Cookie、Vampire Cookie、Snake Fruit Cookie 等較能撐住或能創造節奏的餅乾。
   - Chestnut Cookie、Mustard Cookie 這類 HP 1 餅乾若不是必要，不應優先補上戰鬥區。

2. 不急著鋪第二隻低品質餅乾。
   - 黃色若把 HP 1 或 HP 2 餅乾放成第二隻，紅色常能用攻擊、Giant Cherry Bomb、Prickly Cacti Gloves 或 Rebel Cookie 快速換掉。
   - 若手上沒有高品質餅乾，寧可把牌放支援區，讓主戰餅乾保有付款能力。

3. 支援階段優先保留防守資源。
   - 陷阱卡價值高，尤其 Super-Vita Jelly Bar 與 Winding Key Shield 能讓紅色的斬殺節奏延後。
   - Star Candy Road 在能放置時有明顯價值；後續啟動加 HP 可把紅色的攻擊傷害拆成更多回合。
   - Tropical Slushie 在黃色破壞區已有多張 LV2 以上餅乾時才會變強，早期可視情況當支援。

4. 攻擊目標優先看紅色節奏威脅。
   - 優先處理 Pomegranate Cookie、Dark Choco Cookie、Rebel Cookie。
   - 能擊倒低 HP 的 Cherry Cookie、Carrot Cookie、Adventurer Cookie、Popcorn Cookie 時也有價值，因為可以快速推高紅色破壞區。
   - 不要只用「最低 HP」作為唯一目標；紅色有些高價值目標即使多花一點傷害也值得先處理。

5. 黃色要靠耐久換時間。
   - 勝局通常不是黃色爆發碾壓，而是透過高 HP 主戰餅乾、陷阱、Star Candy Road 與穩定支援付款，讓紅色先累積到 10 級破壞區。
   - 若黃色自己過早送掉 LV2/LV3 餅乾，很容易從優勢變成破壞區被反超。

## 深度敗局分析

### Seed 1（break-level-limit）

**最終狀態：** 黃色破壞區 11，紅色 9

**關鍵問題：**
- 黃色破壞區有 **6 張餅乾**：2 個 Blackberry Cookie (Lv3)、Rockstar (Lv2)、Mustard (Lv1)、Cyborg (Lv1)、Chestnut (Lv1)
- 紅色破壞區也有 6 張：Pomegranate (Lv2)、2 個 Carrot (Lv1)、Princess (Lv2)、Mala Sauce (Lv2)、Popcorn (Lv1)
- 黃色棄牌 16 張，紅色 14 張

**教訓：** 黃色的高階餅乾（Blackberry Lv3）也被送進破壞區，代表替補策略有問題

### Seed 29（break-level-limit）

**最終狀態：** 黃色破壞區 11，紅色 8

**關鍵問題：**
- 黃色破壞區有 **6 張餅乾**：Eclair (Lv3)、2 個 Chestnut (Lv1)、Rockstar (Lv2)、Cyborg (Lv1)、Earl Grey (Lv3)
- 紅色破壞區有 6 張：2 個 Carrot (Lv1)、Adventurer (Lv1)、Popcorn (Lv1)、Muscle (Lv2)、Cherry (Lv2)
- 黃色棄牌 18 張，紅色 18 張

**教訓：** 黃色把 Lv3 餅乾（Eclair、Earl Grey）也送進破壞區，代表部署時機不當

## 正式訓練規則（待餵給 AI）

### 替補評分表（黃色對紅色）

| 餅乾 | 評分 | 原因 |
|---|---|---|
| Banana Cookie (Lv1, HP 3) | ⭐⭐⭐⭐⭐ | HP 高，能撐很久 |
| Vampire Cookie (Lv2, HP 3) | ⭐⭐⭐⭐⭐ | HP 高，有回復能力 |
| Marshmallow Cookie (Lv1, HP 3) | ⭐⭐⭐⭐ | HP 高，穩定 |
| Snake Fruit Cookie (Lv2, HP 2) | ⭐⭐⭐ | 有效果但 HP 較低 |
| Rockstar Cookie (Lv2, HP 2) | ⭐⭐⭐ | 攻擊力高但 HP 較低 |
| Eclair Cookie (Lv3, HP 3) | ⭐⭐⭐⭐ | 高等級但要小心使用 |
| Earl Grey Cookie (Lv3, HP 3) | ⭐⭐⭐⭐ | 高等級但要小心使用 |
| Chestnut Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |
| Mustard Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |
| Cyborg Cookie (Lv1, HP 1) | ⭐ | **絕對不要補** |

### 攻擊目標威脅值

| 目標 | 威脅值 | 原因 |
|---|---|---|
| Pomegranate Cookie | ⭐⭐⭐⭐⭐ | 持續壓力，回復能力 |
| Dark Choco Cookie | ⭐⭐⭐⭐⭐ | 高攻擊，穩定輸出 |
| Rebel Cookie | ⭐⭐⭐⭐⭐ | 高攻擊，能快速換掉 |
| Cherry Cookie | ⭐⭐⭐⭐ | 攻擊後有效果 |
| Mala Sauce Cookie | ⭐⭐⭐ | 攻擊後有效果 |
| Popcorn Cookie | ⭐⭐ | 價值低 |
| Carrot Cookie | ⭐⭐ | 價值低 |
| Adventurer Cookie | ⭐⭐ | 價值低 |

### 關鍵策略

1. **替補**：只補 HP 3+ 的餅乾，避免 HP 1 的 Chestnut、Mustard、Cyborg
2. **部署**：Lv3 餅乾（Eclair、Earl Grey）不要過早鋪上，容易被紅色快速換掉
3. **攻擊**：優先擊倒 Pomegranate > Dark Choco > Rebel
4. **防守**：保留 Super-Vita Jelly Bar、Winding Key Shield 到對手攻擊宣告
5. **節奏**：Star Candy Road 優先放置，Tropical Slushie 中後期再用

## 後續建議

- 將上述策略拆成可重用的 `PlayerView` 評分項，避免只為黃色對紅色寫死卡名。
- 正式 AI 若要吸收此策略，應先改善共通替補評分與部署評分，再處理卡名特化威脅表。
- 下一輪可用相同方法測試紅色對其他第二彈牌組，建立「對局相性」與「替補/部署/攻擊」三類訓練資料。
