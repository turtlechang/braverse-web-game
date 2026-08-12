# BS6 效果轉接覆蓋盤點（promotion-ready）

> 由 `npm run cards:analyze:bs6-candidate` 產生，並於 2026-08-12 完成 localhost Browser 稽核；BS6 已完成 promote。正式資料來源是 `data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json`；逐卡 Browser 證據另見 [`docs/bs6-browser-audit-2026-08-12.md`](./bs6-browser-audit-2026-08-12.md)。

## 摘要

| 項目 | 數量 |
| --- | ---: |
| BS6 基礎卡 | 106 |
| 主效果已轉接 | 75 |
| 主效果沒有文字 | 31 |
| 主效果待轉接 | 0 |
| 額外能力已轉接 | 75 |
| 額外能力待轉接 | 0 |
| 攻擊 Then 已轉接 | 27 / 27 |

## 逐色稽核矩陣

| 顏色 | 基礎卡 | 主效果待轉接 | 額外能力待轉接 | 攻擊 Then 待轉接 |
| --- | ---: | ---: | ---: | ---: |
| BLUE | 22 | 0 | 0 | 0 |
| GREEN | 21 | 0 | 0 | 0 |
| PURPLE | 20 | 0 | 0 | 0 |
| RED | 21 | 0 | 0 | 0 |
| YELLOW | 22 | 0 | 0 | 0 |

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

## Browser 稽核結果

| 項目 | 結果 |
| --- | ---: |
| 候選記錄逐卡載入／效果入口 | 138 / 138 |
| RED | 27 / 27 |
| YELLOW | 29 / 29 |
| GREEN | 26 / 26 |
| BLUE | 29 / 29 |
| PURPLE | 27 / 27 |
| 餅乾／FLIP／物品／陷阱／場景 | 111 / 111、10 / 10、5 / 5、7 / 7、5 / 5 |
| 代表性支付、代價、目標、Then 與條件 A/B | 通過 |

BS6-041 的測試 fixture 已補足 3 張休息區餅乾，並實測「支付 → 對手目標 → 2 傷害 → Then 抽牌」；BS6-039 已實測條件成立與不成立兩條路徑；BS6-042 已實測條件不成立時不誤觸發且不會卡死。完整操作證據與範圍限制見 Browser 報告。

## Promotion gate

1. 逐色 Browser 入口與代表性互動路徑完成。
2. `official-effect-adapter-bs6.test.ts` 覆蓋 BS6 五色效果、FLIP、陷阱與攻擊 Then；官方資料遺漏的 6 筆 `{da}` 已由卡號限定的 normalization 補回並有回歸測試。
3. BS6 候選已由 `inventory` 轉為 `promotion-ready`，並已通過 `validate:candidate --require-promotion-ready` 及 `promote:candidate` 併入正式卡池。
