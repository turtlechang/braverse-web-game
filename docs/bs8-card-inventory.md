# BS8 Land of Fire & Ruin, Realm of Apathy 卡牌資料盤點（正式卡池）

> 本文件由 `npm run cards:import:bs8-candidate` 產生的來源快照更新而來；BS8 已於 2026-08-31 完成 promotion，正式資料位於 `data/cards/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json`。

## 來源與正式狀態

- 官方卡表：[CookieRun: Braverse Card List](https://cookierunbraverse.com/en/cardList)
- 官方 JSON：`https://cookierunbraverse.com/data/json/cardList_en.json`
- 抓取時間：`2026-08-27T16:07:30.127Z`
- 篩選規則：完整卡號以 `BS8-` 開頭，保留異圖／促銷變體。
- 正式狀態：已 promotion；來源 metadata `candidateStatus` 為 `promotion-ready`
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

## BS8 正式資料門檻

1. 執行 `npm run validate:cards` 與 `npm run check:card-pool`，確認正式資料、轉接與 registry 一致。
2. 執行 `npm run cards:analyze:bs8`，列出 runtime 對各類型的轉接缺口，並獨立標示 EXTRA 卡。
3. 15 筆 EXTRA 已保留在正式來源與 registry，但一般 `GameCard` adapter 仍拒絕把它們混入 60 張 Main Deck；EXTRA Deck 仍走獨立 staging／`ExtraDeckCard` 流程。
4. 後續官方更新仍須先寫入 `data/candidates/`，完成 strict contract 與 Browser A/B 後才可再次 promotion。
