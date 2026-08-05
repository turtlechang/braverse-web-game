# BS5 卡牌資料盤點（資料準備期）

> 本文件由 `npm run cards:import:bs5-candidate` 產生。BS5 目前只隔離在候選資料區，尚未接入 runtime、尚未完成效果稽核，也不應執行 promote。

## 來源與候選狀態

- 官方卡表：[CookieRun: Braverse Card List](https://cookierunbraverse.com/en/cardList)
- 官方 JSON：`https://cookierunbraverse.com/data/json/cardList_en.json`
- 抓取時間：`2026-08-04T17:32:55.114Z`
- 篩選規則：完整卡號以 `BS5-` 開頭，保留異圖／促銷變體。
- 候選狀態：`inventory`
- 圖片下載：否

## 數量摘要

| 項目 | 數量 |
| --- | ---: |
| 官方資料總數 | 2092 |
| BS5 匹配記錄 | 153 |
| 匯入候選記錄 | 153 |
| BS5 基礎卡號 | 111 |
| 變體記錄 | 42 |

## 卡片類型

| 類型 | 數量 |
| --- | ---: |
| cookie | 127 |
| flip | 9 |
| item | 7 |
| stage | 5 |
| trap | 5 |

## 顏色

| 顏色 | 數量 |
| --- | ---: |
| BLUE | 28 |
| GREEN | 33 |
| PURE | 2 |
| PURPLE | 30 |
| RED | 32 |
| YELLOW | 28 |

## 產品批次

| 官方產品 | 數量 |
| --- | ---: |
| 2026 Brave League Season 2 FINAL Champion | 1 |
| 2026 Brave League Season 2 FINAL Runner-Up | 1 |
| 2026 Brave League Season 2 FINAL Top 4 | 1 |
| BOOSTER PACK [Operation Timeguard] | 139 |
| NA Regionals I | 4 |
| promotion card | 1 |
| PROMOTION CARD | 6 |

## 後續稽核錨點

| 錨點 | 記錄數 | 基礎卡號 |
| --- | ---: | --- |
| `PURE` 顏色 | 2 | BS5-111 |
| `Ancient` 關鍵字 | 0 | 無 |
| `Soul Jam` 名稱 | 0 | 無 |
| `Equip` 文字 | 2 | BS5-111 |
| 特殊勝利文字 | 0 | 無 |

## BS5 門檻

1. 先執行 `npm run validate:candidate`，確認 schema、卡號唯一性與官方欄位結構。
2. 依紅、黃、綠、藍、紫逐色盤點卡面文字，建立效果覆蓋與條件路徑清單。
3. 完成 runtime adapter、規則引擎、UI 互動、單元測試與 Chrome 實戰驗證後，才可把候選狀態改為 `promotion-ready`。
4. 在上述工作完成前，不執行 `npm run promote:candidate`，也不修改 `data/cards/` 或 generated card pool。
