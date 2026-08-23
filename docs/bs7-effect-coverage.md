# BS7 Arena of Glory 效果轉接覆蓋盤點（正式卡池）

> 由 `npm run cards:analyze:bs7` 產生。資料來源是 `data/cards/official-arena-of-glory-bs7.en.json`；本報告只標示 runtime 轉接現況，Browser 證據另見 BS7 Browser 稽核報告。

## 摘要

| 項目 | 數量 |
| --- | ---: |
| BS7 基礎卡 | 108 |
| 主效果已轉接 | 79 |
| 主效果沒有文字 | 29 |
| 主效果待轉接 | 0 |
| 額外能力已轉接 | 79 |
| 額外能力待轉接 | 0 |
| 攻擊 Then 已轉接 | 23 / 23 |

## 逐色稽核矩陣

| 顏色 | 基礎卡 | 主效果待轉接 | 額外能力待轉接 | 攻擊 Then 待轉接 |
| --- | ---: | ---: | ---: | ---: |
| BLUE | 20 | 0 | 0 | 0 |
| COLORLESS | 7 | 0 | 0 | 0 |
| GREEN | 21 | 0 | 0 | 0 |
| PURE | 1 | 0 | 0 | 0 |
| PURPLE | 19 | 0 | 0 | 0 |
| RED | 20 | 0 | 0 | 0 |
| YELLOW | 20 | 0 | 0 | 0 |

## 主效果待轉接

| 卡號 | 顏色 | 類型 | 卡名 | 卡面文字 |
| --- | --- | --- | --- | --- |
| 無 | - | - | - | - |

## 額外能力待轉接

| 卡號 | 顏色 | 類型 | 卡名 | 卡面文字 |
| --- | --- | --- | --- | --- |
| 無 | - | - | - | - |

## 攻擊 Then 待轉接

| 卡號 | 顏色 | 類型 | 卡名 | 卡面文字 |
| --- | --- | --- | --- | --- |
| - | - | - | - | - |

## 全體傷害順序門檻

BS7-039 與 BS7-082 的「對手全體餅乾受傷」均必須使用 `damage-all` 的 `sequential: true` 與完整對手目標 selector。Browser 結算依玩家點選順序逐張處理 HP、FLIP 與昏厥；這項順序要求不是一般無目標全體傷害的同義替代。

## 官方卡文校正

- BS7-097 依官方英文勘誤公告，攻擊後效果應為來源餅乾在對手下個回合「受到的攻擊傷害 -1」，runtime 使用 `modify-damage-received`，不可誤轉成降低來源餅乾的攻擊傷害。官方韓文卡表目前只列出攻擊名稱與傷害，未提供英文資料中的攻擊後條款，因此不以韓文缺漏覆蓋英文勘誤。（查閱日期：2026-08-22；英文勘誤：https://cookierunbraverse.com/asia/notice/detail?id=1199；韓文卡表：https://cookierunbraverse.com/ko/cardList/?type=COOKIE）

## 後續維護門檻

1. 官方更新時先匯入 candidate，完成逐卡 strict contract 與 Browser gate 後，才再次 promote 到正式卡池。
2. 每張卡完成 adapter、規則、UI 與回歸測試後，才建立 test-state 正反案例與 Chrome Browser A/B 證據。
3. 所有基礎卡的 strict contract、逐色 Browser gate、正式 smoke 與人工覆核通過後，才可再次 promote。
