# BS7 Arena of Glory 效果轉接覆蓋盤點（候選資料）

> 由 `npm run cards:analyze:bs7-candidate` 產生。資料來源是 `data/candidates/official-arena-of-glory-bs7.en.json`；本報告是候選資料的 runtime 轉接盤點，不代表卡牌可 promote 或已完成 Browser 驗收。

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

## 後續維護門檻

1. 依本報告從每色第一張待轉接卡開始，先完成 parser／contract shadow compile，再進入單卡 runtime 轉接。
2. 每張卡完成 adapter、規則、UI 與回歸測試後，才建立 test-state 正反案例與 Chrome Browser A/B 證據。
3. 所有基礎卡的 strict contract、逐色 Browser gate、正式 smoke 與人工覆核通過前，候選狀態必須維持 `inventory`。
