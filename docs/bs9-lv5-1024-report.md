# BS9 Lv.5 AI 1024 人瑞士制實戰報告

> 產生時間：2026-09-13T13:04:31.326Z；這是專案 runtime 的可重現模擬，不是官方賽事結果。

## 結論

- 1024 副 BS9 五色牌組完成 10 輪 Swiss：5120/undefined 場完成，狀態 **PASS**。
- 每副主牌組都載入 4 張同色 BS9 EXTRA Deck；對局開局與 AI 決策使用同一份正式 EXTRA runtime 卡片。
- Top cut：PASS；冠軍：**BS9 blue bs9-blue-deceit #201**；亞軍：**BS9 blue bs9-blue-deceit #157**。
- 四強：BS9 blue bs9-blue-deceit #201、BS9 blue bs9-blue-deceit #157、BS9 blue bs9-blue-deceit #163、BS9 blue bs9-blue-deceit #170。
- 經驗 profile 已由 1024 副、5120 場 Swiss 的公開 Lv.5 決策樣本產生；啟用 108 張 BS9 卡片的卡片／動作權重。
- 256 副、8 輪固定 pairing holdout：訓練後勝出 365 場、baseline 勝出 0 場、同勝者 659 場。

## 賽事設定

| 項目 | 值 |
|---|---|
| 參賽副數 | 1024（紅／黃／綠／藍／紫各約 204–205） |
| Swiss 輪數／場數 | 10／5120 |
| Top cut | 8 → 四強 → 冠軍（7 場淘汰賽） |
| AI | Lv.5；strategy lv5-bs9-tournament-experience-v1 |
| maxActions | 2500 |
| seed | 20260913 |
| 賽制 | standard；正式 BS9 卡池 |
| EXTRA Deck | 每副 4 張同色 BS9 核心 EXTRA Cookie；不佔主牌組 60 張 |

## 五色統計

| 顏色 | 副數 | 平均積分 | 平均勝率 |
|---|---:|---:|---:|
| red | 205 | 13.70 | 45.81% |
| yellow | 205 | 15.51 | 51.73% |
| green | 205 | 9.63 | 32.29% |
| blue | 205 | 20.28 | 67.84% |
| purple | 204 | 15.88 | 52.97% |

## Top 8／四強／冠軍

### 1. BS9 blue bs9-blue-deceit #201（blue，27 分）

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

### 2. BS9 blue bs9-blue-deceit #157（blue，27 分）

主牌組：
  - 4x BS9-071 Candy Diver Cookie
  - 4x BS9-072 Clown Faerie Cookie 1
  - 4x BS9-073 Clown Faerie Cookie 2
  - 4x BS9-074 Clown Faerie Cookie 3
  - 4x BS9-075 Ice Juggler Cookie
  - 4x BS9-077 Black Raisin Cookie
  - 4x BS9-078 White Lily Cookie
  - 4x BS9-080 Cinnamon Cookie
  - 2x BS9-081 Grapefruit Cookie
  - 2x BS9-082 Animatronic of Deceit
  - 4x BS9-083 Choco Cup Cookie
  - 4x BS9-084 Capsaicin Cookie
  - 4x BS9-085 Captain Caviar Cookie
  - 2x BS9-086 Towerkeeper Cookie
  - 4x BS9-087 Popcorn Cookie
  - 4x BS9-089 Pure Vanilla Cookie
  - 1x BS9-090 Storybook of Lies
  - 1x BS9-094 Shadow Milk Cookie's Tarot Card

EXTRA Deck：
  - 4x BS9-088 Pure Vanilla Cookie

### 3. BS9 blue bs9-blue-deceit #163（blue，27 分）

主牌組：
  - 4x BS9-071 Candy Diver Cookie
  - 4x BS9-072 Clown Faerie Cookie 1
  - 4x BS9-073 Clown Faerie Cookie 2
  - 3x BS9-074 Clown Faerie Cookie 3
  - 4x BS9-075 Ice Juggler Cookie
  - 4x BS9-077 Black Raisin Cookie
  - 4x BS9-078 White Lily Cookie
  - 3x BS9-080 Cinnamon Cookie
  - 1x BS9-081 Grapefruit Cookie
  - 4x BS9-082 Animatronic of Deceit
  - 4x BS9-083 Choco Cup Cookie
  - 4x BS9-084 Capsaicin Cookie
  - 4x BS9-085 Captain Caviar Cookie
  - 4x BS9-086 Towerkeeper Cookie
  - 4x BS9-087 Popcorn Cookie
  - 4x BS9-089 Pure Vanilla Cookie
  - 1x BS9-091 Light of Deceit

EXTRA Deck：
  - 4x BS9-088 Pure Vanilla Cookie

### 4. BS9 blue bs9-blue-deceit #170（blue，27 分）

主牌組：
  - 4x BS9-071 Candy Diver Cookie
  - 4x BS9-072 Clown Faerie Cookie 1
  - 4x BS9-073 Clown Faerie Cookie 2
  - 4x BS9-074 Clown Faerie Cookie 3
  - 4x BS9-075 Ice Juggler Cookie
  - 4x BS9-077 Black Raisin Cookie
  - 4x BS9-078 White Lily Cookie
  - 3x BS9-080 Cinnamon Cookie
  - 4x BS9-082 Animatronic of Deceit
  - 4x BS9-083 Choco Cup Cookie
  - 3x BS9-084 Capsaicin Cookie
  - 4x BS9-085 Captain Caviar Cookie
  - 4x BS9-086 Towerkeeper Cookie
  - 4x BS9-087 Popcorn Cookie
  - 4x BS9-089 Pure Vanilla Cookie
  - 2x BS9-095 Spire of Deceit

EXTRA Deck：
  - 4x BS9-088 Pure Vanilla Cookie

### 5. BS9 blue bs9-blue-deceit #036（blue，30 分）

主牌組：
  - 4x BS9-071 Candy Diver Cookie
  - 4x BS9-072 Clown Faerie Cookie 1
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
  - 1x BS9-093 Reversed Prophecy

EXTRA Deck：
  - 4x BS9-088 Pure Vanilla Cookie

### 6. BS9 blue bs9-blue-deceit #106（blue，27 分）

主牌組：
  - 4x BS9-071 Candy Diver Cookie
  - 3x BS9-072 Clown Faerie Cookie 1
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
  - 3x BS9-085 Captain Caviar Cookie
  - 4x BS9-086 Towerkeeper Cookie
  - 4x BS9-087 Popcorn Cookie
  - 3x BS9-089 Pure Vanilla Cookie
  - 2x BS9-090 Storybook of Lies

EXTRA Deck：
  - 4x BS9-088 Pure Vanilla Cookie

### 7. BS9 blue bs9-blue-deceit #110（blue，27 分）

主牌組：
  - 4x BS9-071 Candy Diver Cookie
  - 4x BS9-072 Clown Faerie Cookie 1
  - 4x BS9-073 Clown Faerie Cookie 2
  - 4x BS9-074 Clown Faerie Cookie 3
  - 3x BS9-075 Ice Juggler Cookie
  - 2x BS9-076 Banana Cookie
  - 4x BS9-077 Black Raisin Cookie
  - 4x BS9-078 White Lily Cookie
  - 4x BS9-080 Cinnamon Cookie
  - 4x BS9-082 Animatronic of Deceit
  - 3x BS9-083 Choco Cup Cookie
  - 3x BS9-084 Capsaicin Cookie
  - 4x BS9-085 Captain Caviar Cookie
  - 3x BS9-086 Towerkeeper Cookie
  - 4x BS9-087 Popcorn Cookie
  - 4x BS9-089 Pure Vanilla Cookie
  - 1x BS9-091 Light of Deceit
  - 1x BS9-095 Spire of Deceit

EXTRA Deck：
  - 4x BS9-088 Pure Vanilla Cookie

### 8. BS9 blue bs9-blue-deceit #096（blue，27 分）

主牌組：
  - 4x BS9-071 Candy Diver Cookie
  - 3x BS9-072 Clown Faerie Cookie 1
  - 4x BS9-073 Clown Faerie Cookie 2
  - 3x BS9-074 Clown Faerie Cookie 3
  - 3x BS9-075 Ice Juggler Cookie
  - 1x BS9-076 Banana Cookie
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
  - 1x BS9-091 Light of Deceit
  - 1x BS9-092 Soul Jam: Light of Deceit

EXTRA Deck：
  - 4x BS9-088 Pure Vanilla Cookie

## Lv.5 經驗注入

經驗只在候選動作的來源卡片仍位於自己的公開手牌／戰鬥區／支援區／棄牌區／破壞區／場景時套用；每筆權重限制在 -24～+24，終局結果與規則合法性仍由原有核心決定。

- profile id：bs9-lv5-1024-swiss
- public action weights：18
- card/action weights：108
- strategy version：lv5-bs9-tournament-experience-v1

## Holdout 對照

| 指標 | 無經驗 baseline | 注入 BS9 經驗 |
|---|---:|---:|
| 完成場數 | 1024/1024 | 1024/1024 |
| 卡住場數 | 0 | 0 |
| player-one 勝場 | 504 | 505 |
| 平均行動 | 179.15 | 176.14 |

「訓練後勝出」是同一 fixed schedule 下逐場比較 winner，不將同一場兩次 replay 當成獨立樣本；此結果是本輪 holdout 的證據，仍需更多 seed 與真人盲評。

## 限制

1. 牌組是 BS9 正式卡池內的五色 60 張同色變異，另附 4 張同色 BS9 EXTRA；為維持 Lv.5 訓練安全，排除目前尚未有安全 AI decision model 的 BS9 主牌卡片，EXTRA 卡則由正式 EXTRA runtime 載入。
2. Swiss／淘汰賽由純規則 runtime 模擬，不能把排名直接宣稱為真人競技強度。
3. 經驗是有界的公開資訊先驗，不會跨局保存隱藏牌資訊；若官方規則、禁限卡表或 BS9 runtime 改變，必須重新產生 roster、報告與 profile。
