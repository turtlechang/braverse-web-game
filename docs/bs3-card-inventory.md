# BS3 卡表盤點（候選資料）

> 本文件由 `npm run cards:import:bs3-candidate` 依官方英文卡表產生；其內容是來源資料快照與實作盤點，不代表卡牌已進入正式卡池。

## 來源與範圍

- 官方卡表：[CookieRun: Braverse Card List](https://cookierunbraverse.com/en/cardList)
- 官方 JSON：`https://cookierunbraverse.com/data/json/cardList_en.json`
- 擷取時間：`2026-07-24T17:20:01.054Z`
- 選取規則：完整卡號以 `BS3-` 開頭；保留異圖／促銷變體。
- 候選狀態：`inventory`。只通過來源與結構驗證，`promote:candidate` 會拒絕此狀態，直到各卡牌已完成 runtime 轉接與嚴格驗證。

## 數量

| 項目 | 數量 |
| --- | ---: |
| 官方資料總筆數 | 2092 |
| BS3 記錄數（含變體） | 176 |
| BS3 基礎卡號數 | 121 |
| 異圖／促銷變體數 | 55 |

## 類型分布

| 類型 | 記錄數 |
| --- | ---: |
| cookie | 115 |
| flip | 11 |
| item | 20 |
| stage | 19 |
| trap | 11 |

## 顏色分布

| 顏色 | 記錄數 |
| --- | ---: |
| BLUE | 35 |
| GREEN | 33 |
| PURE | 7 |
| PURPLE | 33 |
| RED | 34 |
| YELLOW | 34 |

## 產品標題分布

| 官方產品標題 | 記錄數 |
| --- | ---: |
| 2025 NA Champion Cup | 1 |
| 2025 언박싱런 우승 | 1 |
| 2026 Summer Champion Cup | 1 |
| BOOSTER PACK [Age of Heroes and Kingdoms] | 158 |
| Judge promotion | 1 |
| promotion card | 1 |
| PROMOTION CARD | 6 |
| promotion-card | 7 |

## BS3 基礎機制錨點

| 項目 | 記錄數 | 基礎卡號 |
| --- | ---: | --- |
| `PURE` 顏色 | 7 | BS3-121 |
| `Ancient` 關鍵字 | 15 | BS3-017, BS3-025, BS3-055, BS3-088, BS3-100 |
| `Soul Jam` 名稱 | 10 | BS3-019, BS3-043, BS3-066, BS3-091, BS3-115 |
| `Equip` 文字標記 | 0 | — |
| 特殊勝利文字 | 7 | BS3-121 |

目前官方 BS3 英文來源沒有含獨立 `Equip` 文字標記的記錄；`Equip` 仍屬目前官方卡表可篩選的機制，但不應在 BS3 候選資料盤點中誤報為已出現或已實作。

## Runtime 基礎進度

- 已將 `PURE` 保存為通用卡牌分類與特殊能量；PURE 支援卡可支付 `pure` 或 Mix Cost（runtime 的 `neutral`），但不能支付紅、黃、綠、藍、紫等指定色費用。
- 已將 `Ancient`／`Soul Jam` 保存為可判定的 runtime 關鍵字。
- 已實作 `BS3-121` 的 Activate 特殊勝利：戰鬥區與支援區各合計 5 種不同名稱的 Ancient Cookie 與 Soul Jam 卡，只有主動發動能力後才結束對局。
- 已支援攻擊後「can be used as」的來源能量付款；來源餅乾先提供印刷的指定能量，只有剩餘費用才由支援區支付。
- 效果轉接覆蓋與尚未支援的來源文字，另見 [BS3 效果轉接覆蓋盤點](bs3-effect-coverage.md)。

## 後續轉接門檻

1. 依效果覆蓋盤點逐卡完成效果與其他專屬機制轉接，並補齊回歸測試。
2. 將候選檔改為 `promotion-ready` 前，確認每筆資料均可轉換為 runtime 卡片，且沒有未裁決的規則文字。
3. 執行嚴格 `validate:candidate` 與 `promote:candidate`，再重新生成正式 card pool。
