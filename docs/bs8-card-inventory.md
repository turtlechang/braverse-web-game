# BS8 Land of Fire & Ruin, Realm of Apathy 卡牌資料盤點（候選資料）

> 本文件由 `npm run cards:import:bs8-candidate` 產生。BS8 只隔離於候選資料區，不會進入 runtime 或正式卡池。

## 來源與候選狀態

- 官方卡表：[CookieRun: Braverse Card List](https://cookierunbraverse.com/en/cardList)
- 官方 JSON：`https://cookierunbraverse.com/data/json/cardList_en.json`
- 抓取時間：`2026-08-27T16:07:30.127Z`
- 篩選規則：完整卡號以 `BS8-` 開頭，保留異圖／促銷變體。
- 候選狀態：`inventory`
- 圖片下載：否

## 數量摘要

| 項目 | 數量 |
| --- | ---: |
| 官方資料總數 | 2093 |
| BS8 匹配記錄 | 171 |
| 匯入候選記錄 | 171 |
| 不同基礎卡號 | 125 |
| 基礎記錄（無 `@` 變體尾碼） | 120 |
| 變體記錄（含 `@` 變體尾碼） | 51 |
| 僅有變體的基礎卡號 | 5（BS8-019, BS8-028, BS8-029, BS8-033, BS8-103） |
| EXTRA 記錄 | 15 |

## 卡片類型

| 類型 | 數量 |
| --- | ---: |
| cookie | 111 |
| extra | 15 |
| flip | 13 |
| item | 12 |
| stage | 13 |
| trap | 7 |

## 顏色

| 顏色 | 數量 |
| --- | ---: |
| BLUE | 31 |
| GREEN | 34 |
| null | 5 |
| PURPLE | 35 |
| RED | 35 |
| YELLOW | 31 |

## 產品批次

| 官方產品 | 數量 |
| --- | ---: |
| BOOSTER PACK [Land of Fire & Ruin, Realm of Apathy] | 156 |
| Kingdom Battle | 3 |
| promotion card | 4 |
| PROMOTION CARD | 5 |
| promotion-card | 2 |
| 폭군의 분노 프로모션 팩 | 1 |

## BS8 稽核錨點

| 錨點 | 記錄數 | 基礎卡號 |
| --- | ---: | --- |
| `EXTRA` 類型／旗標 | 15 | BS8-005, BS8-027, BS8-069, BS8-090, BS8-104 |
| `Arena` 關鍵字或文字 | 0 | 無 |
| `PURE` 顏色 | 0 | 無 |
| `Ancient` 關鍵字 | 11 | BS8-026, BS8-027, BS8-104 |

## BS8 候選資料門檻

1. 執行 `npm run validate:candidate`，確認 schema、卡號唯一性與官方欄位結構。
2. 執行 `npm run cards:analyze:bs8-candidate`，列出既有 runtime 對各類型的轉接缺口，並獨立標示 EXTRA 卡。
3. EXTRA Deck、覆蓋與進入戰鬥區的規則仍屬核心模型擴充；在官方規則與逐卡 Browser A/B 驗證完成前，EXTRA 卡必須維持候選／不可 promote。
4. 不執行 `npm run promote:candidate`，也不修改 60 張 Main Deck 計數或正式卡池 registry。
