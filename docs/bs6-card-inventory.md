# BS6 卡牌資料盤點（資料準備期）

> 本文件由 `npm run cards:import:bs6-candidate` 產生。BS6 僅隔離在候選資料區，尚未完成 runtime 轉接、效果稽核或 promote。

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
| BS6 基礎卡號 | 107 |
| 變體記錄 | 31 |

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
