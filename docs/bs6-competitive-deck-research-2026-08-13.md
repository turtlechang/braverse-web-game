# BS6 競技環境 AI 牌組研究

更新日期：2026-08-13

## 研究結論

本次新增的五副 AI 牌組定位為 BS5+6 標準環境的競技環境 archetype，並與既有的 BS5 標準、BS6 標準牌組分開保留。公開賽事資料有色彩占比、Top 4 與牌組方向，但沒有足夠的逐牌組對局分母與勝率，因此本研究不把賽事名次推算成精確勝率。

外部競賽依據主要來自 [Operation Timeguard Winning Decks](https://cookierun.gg/operation-timeguard-winning-decks-cookierun-braverse-tcg/)：

- 印尼 Champion Cup 的 Top 4 由紅、綠、紫、黃各一副包辦，紅色奪冠。
- 新加坡 Champion Cup 由紅色包辦冠亞軍，黃色第三、藍色第四；文章將紅色描述為 aggressive beatdown，藍色則為 early-game rush 加上 effect damage。
- 馬來西亞 Champion Cup 由綠色奪冠，紫色佔兩個 Top 4 席位；文章特別指出 Longan Dragon 是綠色牌組的核心勝利組合。
- 文章同時指出三個賽區沒有單一永久支配環境的牌組，因此五色均保留，避免把單一賽區的結果誤當成全環境結論。

官方 [ASIA Banned & Restricted Policy（2026-02-13）](https://cookierunbraverse.com/asia/notice/detail?id=1380) 將 `BS6-064 Broken Central Clock` 列為禁卡。新增的競技環境綠色牌組不使用這張牌；既有 `BS6-*-standard` choice 依需求保留為標準基準牌組，並不在本文件中宣稱為目前官方賽事合法清單。

## 五色牌組定位

| AI choice | 競技方向 | 主要套牌來源 | 實作重點 |
| --- | --- | --- | --- |
| `bs6-red-competitive` | Aggressive beatdown | BS5 Pitaya／Marshmallow／Starch Noodle + BS6 damage pressure | 低血量增傷、直接傷害、攻擊壓力 |
| `bs6-yellow-competitive` | Consistency／break control | BS5 Break engine + BS6 Timekeeper／Mender／Timecraft Garage | 提高 Break 資源、抽牌與效果傷害 |
| `bs6-green-competitive` | Longan Dragon support engine | BS5 Longan Dragon／Dragon Orb／Longan Palace + BS6 support manipulation | 支援區資源、回手與回合結束價值 |
| `bs6-blue-competitive` | Early rush／effect damage | BS5 Lotus／Sorbet／Hydrangea 核心 | 登場抽牌、彈回與效果傷害；BS5 核心在 BS5+6 標準仍合法 |
| `bs6-purple-competitive` | Trash disruption | BS5 Lychee Dragon／Peppercorn + BS6 trash recursion | 墓地資源、對手牌庫破壞與 Trash 再利用 |

## 本機可重現驗證

`scripts/benchmark-bs6-decks.ts` 支援 `BS6_BENCHMARK_MODE=competitive`，以固定 seed `20260812`、Lv.4 AI、每個 directed matchup 4 場、共 100 場進行五色矩陣。最新報告位於 `data/decks/bs6-competitive-benchmark-report-100-standard.json`；這是規則引擎中的相對樣本，不是官方賽事勝率：

| 顏色 | 勝場／20 | 完成率 | 卡死 |
| --- | ---: | ---: | ---: |
| 紅 | 9 | 100% | 0 |
| 黃 | 8 | 100% | 0 |
| 綠 | 8 | 100% | 0 |
| 藍 | 10 | 100% | 0 |
| 紫 | 11 | 100% | 0 |

本機結果只用來排除 AI 無法完成對局與比較目前程式規則下的牌組表現；日後若取得含完整對局分母的官方 deck recipe／賽事資料，應重新校準牌組與報告。
