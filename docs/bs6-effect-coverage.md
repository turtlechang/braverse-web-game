# BS6 效果轉接覆蓋盤點（正式卡池）

> 由 `npm run cards:analyze:bs6` 產生。資料來源是 `data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json`；本報告只標示 runtime 轉接現況，Browser 證據另見 BS6 Browser 稽核報告。

## 摘要

| 項目 | 數量 |
| --- | ---: |
| BS6 基礎卡 | 107 |
| 主效果已轉接 | 76 |
| 主效果沒有文字 | 31 |
| 主效果待轉接 | 0 |
| 額外能力已轉接 | 76 |
| 額外能力待轉接 | 0 |
| 攻擊 Then 已轉接 | 27 / 27 |

## 逐色稽核矩陣

| 顏色 | 基礎卡 | 主效果待轉接 | 額外能力待轉接 | 攻擊 Then 待轉接 |
| --- | ---: | ---: | ---: | ---: |
| BLUE | 22 | 0 | 0 | 0 |
| GREEN | 21 | 0 | 0 | 0 |
| PURPLE | 21 | 0 | 0 | 0 |
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

## Chrome 實戰驗證（2026-08-15）

| 類別 | 範圍 | 驗證內容 |
| --- | --- | --- |
| 效果互動矩陣 | 97 張效果基礎卡代表（含 BS6-091@2/@3） | 實際 Chrome 逐卡進入正式 card-check test-state，依卡面文字驅動技能、登場、FLIP、陷阱、物品、場景、攻擊後 `Then` 的支付／代價／目標／結算 UI 並確認無 pending modal、無 console／runtime 錯誤：97／97 PASS |
| 條件／時機 A/B | BS6-039 | 專用 localhost-only fixture 跑條件成立／不成立路徑：A/B PASS |
| 負向路徑 | 全部 138 筆記錄 | `card-negative` fixture 將支援區卡設為疲勞，驗證非法能量支付不被接受、無支付攻擊不成立：138／138 PASS |
| 無效果攻擊 | BS6-005／015／026／040／049／054／070／075／088／100 | 部署、選攻擊者、合法支援支付、宣告攻擊、攻擊者橫置：10／10 PASS |
| 語意代價交叉驗證 | 全部 138 筆記錄 | `scripts/verify-bs5-bs6-semantics.ts` 逐張比對官方文字與 runtime 的攻擊能量代價／{da} 傷害／技能代價（能量、HP 進棄牌區、棄手牌）／Then 傷害／陷阱物品場景代價／FLIP 代價與抽牌數量：325 項檢查、0 問題 |

報告：`docs/bs6-effect-audit-2026-08-15.json`、`docs/bs6-negative-audit-2026-08-15.json`、`docs/bs6-vanilla-audit-2026-08-15.json`、`docs/bs6-semantic-cost-audit-2026-08-15.json`。

本輪修正：

- BS6-073「Schneeball Cookie」登場代價 `battleCookieToHand`（返回 1 張藍色 LV.1 戰鬥區餅乾回手）的候選群 `.effect-candidates-battle-to-hand` 未納入稽核驅動的候選清單，導致流程卡在代價選擇步驟；已補上正向／負向驅動並全數通過。

## 歷史 Chrome 實戰驗證（2026-08-12／13）

BS6 於 2026-08-12 完成逐色 Browser 入口矩陣與效果互動矩陣後 promote；2026-08-13 完成逐色 A/B 與負向路徑稽核，報告見 `docs/bs6-effect-audit-*.json`。

## 後續維護門檻

1. 官方資料更新時，先重新匯入候選資料並逐色檢查新增或變更的效果。
2. 對每個新增效果補齊 adapter、規則、UI 與合法／不合法路徑回歸測試。
3. 在正式對戰狀態以 Chrome 完成支付、代價、目標、Then、FLIP／TRAP 與錯誤路徑稽核後，才可再次 promote。
