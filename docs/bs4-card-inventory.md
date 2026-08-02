# BS4 卡表盤點（候選資料）

> 本文件由 `npm run cards:import:bs4-candidate` 依官方英文卡表產生；其內容是來源資料快照與實作盤點，不代表卡牌已進入正式卡池。

## 來源與範圍

- 官方卡表：[CookieRun: Braverse Card List](https://cookierunbraverse.com/en/cardList)
- 官方 JSON：`https://cookierunbraverse.com/data/json/cardList_en.json`
- 擷取時間：`2026-08-02T16:28:58.695Z`
- 選取規則：完整卡號以 `BS4-` 開頭；保留異圖／促銷變體。
- 候選狀態：`inventory`。只通過來源與結構驗證，`promote:candidate` 會拒絕此狀態，直到各卡牌已完成 runtime 轉接與嚴格驗證。

## 數量

| 項目 | 數量 |
| --- | ---: |
| 官方資料總筆數 | 2092 |
| BS4 記錄數（含變體） | 170 |
| BS4 基礎卡號數 | 111 |
| 異圖／促銷變體數 | 59 |

## 類型分布

| 類型 | 記錄數 |
| --- | ---: |
| cookie | 119 |
| flip | 18 |
| item | 17 |
| stage | 7 |
| trap | 9 |

## 顏色分布

| 顏色 | 記錄數 |
| --- | ---: |
| BLUE | 31 |
| GREEN | 36 |
| null | 1 |
| PURE | 2 |
| PURPLE | 37 |
| RED | 31 |
| YELLOW | 32 |

## 產品標題分布

| 官方產品標題 | 記錄數 |
| --- | ---: |
| 2-ON-2 Event | 3 |
| 2025 NA Brave League S2 | 3 |
| BOOSTER PACK [Age of Heroes and Kingdoms] | 148 |
| promotion card | 5 |
| PROMOTION CARD | 11 |

## 跨彈機制錨點

| 項目 | 記錄數 | 基礎卡號 |
| --- | ---: | --- |
| `PURE` 顏色 | 2 | BS4-111 |
| `Ancient` 關鍵字 | 0 | — |
| `Soul Jam` 名稱 | 0 | — |
| `Equip` 文字標記 | 0 | — |
| 特殊勝利文字 | 0 | — |

上述錨點沿用 BS3 盤點時採用的同一組跨彈關鍵字掃描規則（詳見 [BS3 卡表盤點](bs3-card-inventory.md)），純粹是這批候選資料裡的文字比對結果，不代表 runtime 已經支援或需要支援對應機制。

## Runtime 進度

尚未開始 BS4 的 runtime 轉接；本檔案僅完成官方資料的擷取、結構標準化與盤點。既有引擎能力（PURE 費用、Ancient／Soul Jam 關鍵字、可用作費用的攻擊後補款等）沿用自 BS3 開發成果，若 BS4 卡牌用到相同機制可直接複用，但每張卡的專屬效果仍需逐一轉接與測試。

## 後續轉接門檻

1. 逐色（紅／黃／綠／藍／紫）盤點官方文字，將每張卡的技能／攻擊／FLIP 效果轉接為 runtime 結構化效果，並補齊回歸測試。
2. 將候選檔改為 `promotion-ready` 前，確認每筆資料均可轉換為 runtime 卡片，且沒有未裁決的規則文字。
3. 執行嚴格 `validate:candidate` 與 `promote:candidate`，再重新生成正式 card pool。
