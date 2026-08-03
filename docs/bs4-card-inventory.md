# BS4 卡表盤點（正式卡池）

> 本文件由 `npm run cards:import:bs4-candidate` 依官方英文卡表產生；其內容是來源資料快照與實作盤點。BS4 已於 2026-08-03 完成 promote，正式資料位於 `data/cards/official-age-of-heroes-and-kingdoms-bs4.en.json`。

## 來源與範圍

- 官方卡表：[CookieRun: Braverse Card List](https://cookierunbraverse.com/en/cardList)
- 官方 JSON：`https://cookierunbraverse.com/data/json/cardList_en.json`
- 擷取時間：`2026-08-02T16:28:58.695Z`
- 選取規則：完整卡號以 `BS4-` 開頭；保留異圖／促銷變體。
- 正式狀態：原 `promotion-ready` 候選已通過嚴格驗證，170 筆資料已 promote 至 `data/cards/`。

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

上述錨點沿用 BS3 盤點時採用的同一組跨彈關鍵字掃描規則（詳見 [BS3 卡表盤點](bs3-card-inventory.md)），純粹是這批資料裡的文字比對結果，不代表 runtime 已經支援或需要支援對應機制。

## Runtime 進度

BS4 已完成 runtime 轉接與正式卡池驗證：111 張基礎卡的攻擊 `Then` 23／23 已轉接，額外能力來源 87 張已轉接，原先 14 張待補效果已降為 0。既有引擎能力（PURE 費用、Ancient／Soul Jam 關鍵字、可用作費用的攻擊後補款等）沿用自 BS3 開發成果；逐卡覆蓋狀態見 [BS4 效果轉接覆蓋盤點](bs4-effect-coverage.md)。

## 後續維護

1. 官方資料有更新時，重新以 `cards:import:bs4-candidate` 建立隔離的 `inventory` 候選快照。
2. 逐色複核新增或變更的技能／攻擊／FLIP 效果，補齊 runtime 轉接與回歸測試。
3. 候選資料完成嚴格 `validate:candidate` 後，再執行 `promote:candidate` 並重新生成正式 card pool。
