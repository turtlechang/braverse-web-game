# BS9 Lv.5 AI 1024 人瑞士制實戰報告

> 產生時間：2026-09-13T17:20:31.545Z；這是專案 runtime 的可重現模擬，不是官方賽事結果。

## 結論

- 1024 副 BS9 五色牌組完成 10 輪 Swiss：5084/5120 場完成，狀態 **FAIL**。
- 每副主牌組都載入 4 張同色 BS9 EXTRA Deck；對局開局與 AI 決策使用同一份正式 EXTRA runtime 卡片。
- Top cut：PASS；冠軍：**BS9 blue bs9-blue-deceit #005**；亞軍：**BS9 blue bs9-blue-deceit #183**。
- 四強：BS9 blue bs9-blue-deceit #005、BS9 blue bs9-blue-deceit #183、BS9 blue bs9-blue-deceit #040、BS9 blue bs9-blue-deceit #201。
- 經驗 profile 已由 1024 副、5084 場完成 Swiss 的公開 Lv.5 決策樣本產生；啟用 109 張 BS9 卡片的卡片／動作權重。
- 32 副、2 輪固定 pairing holdout 交叉對戰：訓練策略勝出 35 場、baseline 勝出 29 場、卡住／超限失敗 0 場。

## 賽事設定

| 項目 | 值 |
|---|---|
| 參賽副數 | 1024（紅／黃／綠／藍／紫各約 204–205） |
| Swiss 輪數／場數 | 10／5120 |
| Top cut | 8 → 四強 → 冠軍（7 場淘汰賽） |
| AI | Lv.5；strategy lv5-bs9-tournament-experience-v1 |
| maxActions | 500 |
| seed | 20260913 |
| 賽制 | standard；正式 BS9 卡池 |
| EXTRA Deck | 每副 4 張同色 BS9 核心 EXTRA Cookie；不佔主牌組 60 張 |

## 五色統計

| 顏色 | 副數 | 平均積分 | 平均勝率 |
|---|---:|---:|---:|
| red | 205 | 13.71 | 45.73% |
| yellow | 205 | 15.03 | 50.17% |
| green | 205 | 10.00 | 32.53% |
| blue | 205 | 20.22 | 67.53% |
| purple | 204 | 15.87 | 52.92% |

## Top 8／四強／冠軍

### 1. BS9 blue bs9-blue-deceit #005（blue，27 分）

主牌組：
  - 4x BS9-071 Candy Diver Cookie
  - 4x BS9-072 Clown Faerie Cookie 1
  - 4x BS9-073 Clown Faerie Cookie 2
  - 4x BS9-074 Clown Faerie Cookie 3
  - 4x BS9-075 Ice Juggler Cookie
  - 1x BS9-076 Banana Cookie
  - 4x BS9-077 Black Raisin Cookie
  - 4x BS9-078 White Lily Cookie
  - 3x BS9-080 Cinnamon Cookie
  - 2x BS9-081 Grapefruit Cookie
  - 3x BS9-082 Animatronic of Deceit
  - 4x BS9-083 Choco Cup Cookie
  - 3x BS9-084 Capsaicin Cookie
  - 4x BS9-085 Captain Caviar Cookie
  - 4x BS9-086 Towerkeeper Cookie
  - 4x BS9-087 Popcorn Cookie
  - 4x BS9-089 Pure Vanilla Cookie

EXTRA Deck：
  - 4x BS9-088 Pure Vanilla Cookie

### 2. BS9 blue bs9-blue-deceit #183（blue，27 分）

主牌組：
  - 3x BS9-071 Candy Diver Cookie
  - 3x BS9-072 Clown Faerie Cookie 1
  - 4x BS9-073 Clown Faerie Cookie 2
  - 4x BS9-074 Clown Faerie Cookie 3
  - 4x BS9-075 Ice Juggler Cookie
  - 4x BS9-077 Black Raisin Cookie
  - 4x BS9-078 White Lily Cookie
  - 4x BS9-080 Cinnamon Cookie
  - 4x BS9-082 Animatronic of Deceit
  - 4x BS9-083 Choco Cup Cookie
  - 4x BS9-084 Capsaicin Cookie
  - 4x BS9-085 Captain Caviar Cookie
  - 4x BS9-086 Towerkeeper Cookie
  - 4x BS9-087 Popcorn Cookie
  - 4x BS9-089 Pure Vanilla Cookie
  - 1x BS9-090 Storybook of Lies
  - 1x BS9-095 Spire of Deceit

EXTRA Deck：
  - 4x BS9-088 Pure Vanilla Cookie

### 3. BS9 blue bs9-blue-deceit #040（blue，30 分）

主牌組：
  - 4x BS9-071 Candy Diver Cookie
  - 3x BS9-072 Clown Faerie Cookie 1
  - 4x BS9-073 Clown Faerie Cookie 2
  - 4x BS9-074 Clown Faerie Cookie 3
  - 4x BS9-075 Ice Juggler Cookie
  - 4x BS9-077 Black Raisin Cookie
  - 4x BS9-078 White Lily Cookie
  - 4x BS9-080 Cinnamon Cookie
  - 4x BS9-082 Animatronic of Deceit
  - 4x BS9-083 Choco Cup Cookie
  - 4x BS9-084 Capsaicin Cookie
  - 4x BS9-085 Captain Caviar Cookie
  - 4x BS9-086 Towerkeeper Cookie
  - 4x BS9-087 Popcorn Cookie
  - 4x BS9-089 Pure Vanilla Cookie
  - 1x BS9-090 Storybook of Lies

EXTRA Deck：
  - 4x BS9-088 Pure Vanilla Cookie

### 4. BS9 blue bs9-blue-deceit #201（blue，27 分）

主牌組：
  - 4x BS9-071 Candy Diver Cookie
  - 4x BS9-072 Clown Faerie Cookie 1
  - 4x BS9-073 Clown Faerie Cookie 2
  - 4x BS9-074 Clown Faerie Cookie 3
  - 4x BS9-075 Ice Juggler Cookie
  - 4x BS9-077 Black Raisin Cookie
  - 3x BS9-078 White Lily Cookie
  - 4x BS9-080 Cinnamon Cookie
  - 1x BS9-081 Grapefruit Cookie
  - 4x BS9-082 Animatronic of Deceit
  - 4x BS9-083 Choco Cup Cookie
  - 4x BS9-084 Capsaicin Cookie
  - 4x BS9-085 Captain Caviar Cookie
  - 4x BS9-086 Towerkeeper Cookie
  - 4x BS9-087 Popcorn Cookie
  - 4x BS9-089 Pure Vanilla Cookie

EXTRA Deck：
  - 4x BS9-088 Pure Vanilla Cookie

### 5. BS9 blue bs9-blue-deceit #107（blue，27 分）

主牌組：
  - 4x BS9-071 Candy Diver Cookie
  - 3x BS9-072 Clown Faerie Cookie 1
  - 4x BS9-073 Clown Faerie Cookie 2
  - 4x BS9-074 Clown Faerie Cookie 3
  - 4x BS9-075 Ice Juggler Cookie
  - 4x BS9-077 Black Raisin Cookie
  - 3x BS9-078 White Lily Cookie
  - 4x BS9-080 Cinnamon Cookie
  - 4x BS9-082 Animatronic of Deceit
  - 4x BS9-083 Choco Cup Cookie
  - 4x BS9-084 Capsaicin Cookie
  - 4x BS9-085 Captain Caviar Cookie
  - 4x BS9-086 Towerkeeper Cookie
  - 4x BS9-087 Popcorn Cookie
  - 4x BS9-089 Pure Vanilla Cookie
  - 1x BS9-094 Shadow Milk Cookie's Tarot Card
  - 1x BS9-095 Spire of Deceit

EXTRA Deck：
  - 4x BS9-088 Pure Vanilla Cookie

### 6. BS9 purple bs9-purple-mill #156（purple，27 分）

主牌組：
  - 4x BS9-097 Dark Cacao Cookie
  - 4x BS9-098 Latte Cookie
  - 4x BS9-099 Wizard Cookie
  - 4x BS9-100 Black Sapphire Cookie
  - 4x BS9-101 Blueberry Pie Cookie
  - 4x BS9-103 Baby Cream Sheep
  - 4x BS9-104 Prophet Cookie
  - 4x BS9-105 Young Shepherd Cookie
  - 3x BS9-109 Candy Corn Cookie
  - 4x BS9-110 Crunchy Chip Cookie
  - 4x BS9-112 Pumpkin Pie Cookie
  - 4x BS9-113 Prune Juice Cookie
  - 4x BS9-114 Flipped Coin
  - 4x BS9-115 Wolf in Sheep's Clothing
  - 3x BS9-116 Light of False Truths
  - 1x BS9-117 Truth Stained With Lies
  - 1x BS9-118 Endless Game of Chess

EXTRA Deck：
  - 4x BS9-102 Shadow Milk Cookie

### 7. BS9 blue bs9-blue-deceit #111（blue，27 分）

主牌組：
  - 4x BS9-071 Candy Diver Cookie
  - 4x BS9-072 Clown Faerie Cookie 1
  - 4x BS9-073 Clown Faerie Cookie 2
  - 4x BS9-074 Clown Faerie Cookie 3
  - 4x BS9-075 Ice Juggler Cookie
  - 1x BS9-076 Banana Cookie
  - 4x BS9-077 Black Raisin Cookie
  - 4x BS9-078 White Lily Cookie
  - 4x BS9-080 Cinnamon Cookie
  - 4x BS9-082 Animatronic of Deceit
  - 4x BS9-083 Choco Cup Cookie
  - 4x BS9-084 Capsaicin Cookie
  - 4x BS9-085 Captain Caviar Cookie
  - 4x BS9-086 Towerkeeper Cookie
  - 3x BS9-087 Popcorn Cookie
  - 4x BS9-089 Pure Vanilla Cookie

EXTRA Deck：
  - 4x BS9-088 Pure Vanilla Cookie

### 8. BS9 blue bs9-blue-deceit #166（blue，27 分）

主牌組：
  - 3x BS9-071 Candy Diver Cookie
  - 4x BS9-072 Clown Faerie Cookie 1
  - 4x BS9-073 Clown Faerie Cookie 2
  - 4x BS9-074 Clown Faerie Cookie 3
  - 4x BS9-075 Ice Juggler Cookie
  - 1x BS9-076 Banana Cookie
  - 4x BS9-077 Black Raisin Cookie
  - 4x BS9-078 White Lily Cookie
  - 4x BS9-080 Cinnamon Cookie
  - 4x BS9-082 Animatronic of Deceit
  - 4x BS9-083 Choco Cup Cookie
  - 3x BS9-084 Capsaicin Cookie
  - 2x BS9-085 Captain Caviar Cookie
  - 4x BS9-086 Towerkeeper Cookie
  - 4x BS9-087 Popcorn Cookie
  - 4x BS9-089 Pure Vanilla Cookie
  - 1x BS9-091 Light of Deceit
  - 1x BS9-094 Shadow Milk Cookie's Tarot Card
  - 1x BS9-095 Spire of Deceit

EXTRA Deck：
  - 4x BS9-088 Pure Vanilla Cookie

## Lv.5 經驗注入

經驗只在候選動作的來源卡片仍位於自己的公開手牌／戰鬥區／支援區／棄牌區／破壞區／場景時套用；每筆權重限制在 -24～+24，終局結果與規則合法性仍由原有核心決定。

- profile id：bs9-lv5-1024-swiss
- public action weights：16
- card/action weights：109
- strategy version：lv5-bs9-tournament-experience-v1

## Holdout 交叉對戰

| 指標 | 結果 |
|---|---:|
| 固定 pairing 場數 | 32 |
| 交叉對戰場數（兩種策略座位） | 64 |
| 完成場數 | 64/64 |
| 訓練策略勝場 | 35 |
| baseline 勝場 | 29 |
| 卡住／超限失敗 | 0 |
| 平均行動 | 169.36 |

每個 fixed pairing 會以相同牌組做兩次交叉對戰，交換 baseline／訓練策略所在座位；勝負依實際 winner player 歸屬，不以牌組勝者變更推定訓練優勢。卡住或超過 500 步的場次不計入任何策略勝場；此結果仍需更多 seed 與真人盲評。

## 限制

1. 牌組是 BS9 正式卡池內的五色 60 張同色變異，另附 4 張同色 BS9 EXTRA；為維持 Lv.5 訓練安全，排除目前尚未有安全 AI decision model 的 BS9 主牌卡片，EXTRA 卡則由正式 EXTRA runtime 載入。
2. Swiss／淘汰賽由純規則 runtime 模擬，不能把排名直接宣稱為真人競技強度。
3. 經驗是有界的公開資訊先驗，不會跨局保存隱藏牌資訊；若官方規則、禁限卡表或 BS9 runtime 改變，必須重新產生 roster、報告與 profile。
