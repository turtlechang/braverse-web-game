# BS1–BS6 五色 512 副牌組 Browser 瑞士輪報告

## 結論

以 BS1–BS6 正式卡池的既有牌組配方作為種子，建立 512 副合法 60 張牌組（紅 103、黃 103、綠 102、藍 102、紫 102），在瀏覽器內以 Lv.4 AI 進行 9 輪 Swiss，共 2,304 場。初代與第一輪 BS6 加權迭代均完成 2,304／2,304 場，卡住 0 場；Chromium console、HTTP、request failure 與 page error 皆為 0。

這是本專案規則引擎與 AI 的固定 seed 觀察，不是官方賽事勝率，也不代表真實玩家環境強度。

完整原始報告：

- [初代 Browser 報告 JSON](bs1-bs6-512-swiss-report.json)
- [第一輪迭代 Browser 報告 JSON](bs1-bs6-512-swiss-iteration-1-report.json)
- [初代 512 副牌組清單](../data/decks/bs1-bs6-512-swiss-roster.json)
- [第一輪迭代 512 副牌組清單](../data/decks/bs1-bs6-512-swiss-roster-iteration-1.json)

## Browser 驗證基線

| 項目 | 初代 | 第一輪迭代 |
| --- | ---: | ---: |
| 牌組數 | 512 | 512 |
| Swiss 輪數 | 9 | 9 |
| 對局數 | 2,304 | 2,304 |
| 正常完成 | 2,304 | 2,304 |
| 卡住／技術和局 | 0 | 0 |
| 平均 actions | 154.12 | 149.31 |
| 平均 turns | 12.51 | 11.55 |
| Browser errors | 0 | 0 |

初代牌組配置為每副 36 張 BS6、12 張 BS5、12 張 BS1–BS4；第一輪迭代提高至 40 張 BS6、16 張 BS5、4 張 BS1–BS4。所有牌組均通過 `standard` 牌組驗證、60 張與單卡最多 4 張限制。

## 五色結果與迭代變化

勝率是該顏色牌組在這個固定 Swiss 樣本中的 AI 勝場／對局數。

| 顏色 | 初代平均積分 | 初代勝率 | 迭代平均積分 | 迭代勝率 | 變化 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 紅 | 12.728 | 47.24% | 15.000 | 55.74% | +8.50pp |
| 黃 | 14.388 | 53.75% | 15.291 | 57.13% | +3.38pp |
| 綠 | 13.853 | 51.48% | 12.382 | 46.01% | -5.47pp |
| 藍 | 12.059 | 44.91% | 12.441 | 46.33% | +1.42pp |
| 紫 | 14.471 | 53.71% | 12.353 | 45.80% | -7.91pp |

第一輪迭代後，紅／黃改善最明顯；綠／紫下降，表示只提高 BS6 牌張比例並不保證在此 AI matchup 環境變強，後續應採用 matchup-aware 的局部替換，而不是繼續無差別增加 BS6 比例。

## 第一輪迭代上位牌表

以下卡表是各色前 8 副牌組的卡牌出現率彙總；括號為「出現在前 8 副中的副數／8」，每副目前使用 4 張。完整前 20 名見迭代報告 JSON。

### 紅色

| 卡號 | 卡名 | 出現 |
| --- | --- | ---: |
| BS6-001 | Blue Lily Cookie | 8/8 |
| BS6-005 | Buttercream Choco Cookie | 8/8 |
| BS6-021 | TBD Hallway | 8/8 |
| BS6-019 | Squishy Jelly Watch | 8/8 |
| BS6-020 | Tonic Spray | 8/8 |
| BS5-020 | Crimson Dragon Mask | 8/8 |
| BS6-009 | Cotton Candy Cookie | 7/8 |
| BS5-022 | Pitaya Dragon Cookie's Nest | 7/8 |

上位牌組：`bs1-bs6-swiss-g1-286`，9–0、27 分，種子 `bs6-red-standard`。

### 黃色

| 卡號 | 卡名 | 出現 |
| --- | --- | ---: |
| BS6-043 | Timecraft Garage | 8/8 |
| BS6-041 | Hourglass of Aeternus Tempora | 8/8 |
| BS6-042 | Clever Advice | 8/8 |
| BS6-032 | Spinach Cookie | 7/8 |
| BS6-026 | Skater Cookie | 7/8 |
| BS5-043 | Seasick Canoeing | 6/8 |
| BS6-022 | Ninja Cookie | 6/8 |
| BS5-042 | Sniffly Cocoa Palm | 6/8 |

上位牌組：`bs1-bs6-swiss-g1-392`，8–1、24 分，種子 `bs5-yellow-open`。

### 綠色

| 卡號 | 卡名 | 出現 |
| --- | --- | ---: |
| BS6-064 | Broken Central Clock | 8/8 |
| BS6-063 | Into a Time Pocket... | 8/8 |
| BS6-062 | Time Rend Scissors | 8/8 |
| BS5-064 | Dragon Orb | 7/8 |
| BS6-046 | Langue de Chat Cookie | 6/8 |
| BS6-049 | Banana Cookie | 6/8 |
| BS5-065 | Petrification | 6/8 |
| BS6-054 | Orange Cookie | 5/8 |

上位牌組：`bs1-bs6-swiss-g1-243`，8–1、24 分，種子 `bs6-green-competitive`。

### 藍色

| 卡號 | 卡名 | 出現 |
| --- | --- | ---: |
| BS6-084 | Time Manipulator | 8/8 |
| BS6-086 | Messy TBD Director's Office | 8/8 |
| BS6-085 | Destruction of a Pastless Future | 8/8 |
| BS5-088 | Lotus Palace | 8/8 |
| BS6-083 | Skating Queen Cookie | 7/8 |
| BS6-065 | Marble Bread Cookie | 6/8 |
| BS6-077 | Cheerleader Cookie | 6/8 |
| BS6-080 | Adventurer Cookie | 5/8 |

上位牌組：`bs1-bs6-swiss-g1-074`，7–2、21 分，種子 `bs3-blue-sorbet`。

### 紫色

| 卡號 | 卡名 | 出現 |
| --- | --- | ---: |
| BS6-107 | TBD Machine Room | 8/8 |
| BS6-105 | Butterfly Key Relic | 8/8 |
| BS6-106 | Peak Engineer Performance | 8/8 |
| BS5-109 | Charmed Miners | 8/8 |
| BS5-108 | Rambirdtan Handler Glove | 8/8 |
| BS5-093 | Lychee Dragon Cookie | 7/8 |
| BS6-088 | Dr. Wasabi Cookie | 6/8 |
| BS6-096 | Cherry Cookie | 6/8 |

上位牌組：`bs1-bs6-swiss-g1-420`，8–1、24 分，種子 `bs5-purple-open`。

## 迭代方式與限制

- 先從既有 BS1–BS6 官方牌組配方抽取每色種子卡。
- 初代牌組使用 BS6 36 張、BS5 12 張、舊系列 12 張；第一輪依初代各色前 8 副牌組的 top-card 出現率加權抽樣。
- 第一輪每副使用 BS6 40 張、BS5 16 張、BS1–BS4 4 張；因部分顏色合法 BS6 支援卡只有 3 種，沒有重複卡號，第四個支援槽改由 BS5 補足。
- Swiss 配對依積分分組，奇數組跨組浮動，優先避免重賽；固定 seed `20260813`、Lv.4、單場最多 2,500 actions。
- 本次未把「AI 勝率」解讀為真實賽事勝率；若要校準正式環境，下一輪應加入真實賽事牌表、不同先後手／seed 矩陣與 matchup 分層。
