# BS6 卡牌資料盤點（資料準備期）

> 本文件由 `npm run cards:import:bs6-candidate` 產生，記錄當次的候選資料準備快照。完成 promote 後，正式卡池以 `data/cards/` 與 BS6 效果覆蓋盤點為準。

## 來源與候選狀態

- 官方卡表：[CookieRun: Braverse Card List](https://cookierunbraverse.com/en/cardList)
- 官方 JSON：`https://cookierunbraverse.com/data/json/cardList_en.json`
- 抓取時間：`2026-08-11T06:00:39.434Z`
- 篩選規則：完整卡號以 `BS6-` 開頭，保留異圖／促銷變體。
- 候選狀態：`inventory`
- 圖片下載：否

## 數量摘要

| 項目 | 數量 |
| --- | ---: |
| 官方資料總數 | 2093 |
| BS6 匹配記錄 | 138 |
| 匯入候選記錄 | 138 |
| 不同基礎卡號 | 107 |
| 基礎記錄（無 `@` 變體尾碼） | 106 |
| 變體記錄（含 `@` 變體尾碼） | 32 |
| 僅有變體的基礎卡號 | 1（BS6-091） |

「不同基礎卡號」依 `baseCardNumber` 去重；「基礎記錄」只計完整卡號未附 `@` 尾碼的記錄。故 BS6-091 雖是 1 個基礎卡號，因官方資料僅提供 `BS6-091@2`、`BS6-091@3`，不會計入基礎記錄，而是計入 2 筆變體。

## 卡片類型

| 類型 | 數量 |
| --- | ---: |
| cookie | 108 |
| flip | 10 |
| item | 5 |
| stage | 5 |
| trap | 7 |
| unknown | 3 |

## 顏色

| 顏色 | 數量 |
| --- | ---: |
| BLUE | 29 |
| GREEN | 26 |
| PURPLE | 27 |
| RED | 27 |
| YELLOW | 29 |

## 產品批次

| 官方產品 | 數量 |
| --- | ---: |
| 2-ON-2 Event | 1 |
| BOOSTER PACK [Operation Timeguard] | 135 |
| PROMOTION CARD | 2 |

## 後續稽核錨點

| 錨點 | 記錄數 | 基礎卡號 |
| --- | ---: | --- |
| `PURE` 顏色 | 0 | 無 |
| `Ancient` 關鍵字 | 0 | 無 |
| `Soul Jam` 名稱 | 0 | 無 |
| `Equip` 文字 | 0 | 無 |
| 特殊勝利文字 | 0 | 無 |

## BS6 門檻

1. 執行 `npm run validate:candidate`，確認 schema、卡號唯一性與官方欄位結構。
2. 執行 `npm run cards:analyze:bs6-candidate`，以紅、黃、綠、藍、紫與特殊色分類主效果、能力、攻擊 `Then` 的待轉接項目。
3. 逐批完成 runtime adapter、規則引擎、UI、回歸測試與 Chrome 合法／不合法路徑驗證。
4. 所有未支援與待裁決項目清零前，保持 `inventory`，不執行 `npm run promote:candidate`。
