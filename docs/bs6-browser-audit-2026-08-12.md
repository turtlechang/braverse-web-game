# BS6 Browser 逐色稽核報告

日期：2026-08-12
環境：本機 Vite (`http://127.0.0.1:5173`)；Codex in-app Browser；1440×960 入口矩陣
資料：`data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json`，138 筆正式卡池記錄（106 張基礎卡與異圖／變體）

## 逐卡入口矩陣

每筆資料均以 `?test-state=card:<cardNumber>` 開啟，檢查卡面名稱、錯誤邊界、效果入口或正確的時機提示；陷阱額外檢查攻擊宣告回應，條件不成立時允許正常 no-op，但不能出現 runtime error 或卡死。

| 顏色 | 通過 | 總數 |
| --- | ---: | ---: |
| RED | 27 | 27 |
| YELLOW | 29 | 29 |
| GREEN | 26 | 26 |
| BLUE | 29 | 29 |
| PURPLE | 27 | 27 |
| **合計** | **138** | **138** |

| 類型 | 通過 | 總數 |
| --- | ---: | ---: |
| COOKIE | 111 | 111 |
| FLIP | 10 | 10 |
| ITEM | 5 | 5 |
| TRAP | 7 | 7 |
| STAGE | 5 | 5 |

逐卡入口矩陣沒有發現錯誤邊界、空白卡面或未處理的 Browser console error。BS6-042 的預設 fixture 是條件不成立路徑，因此不顯示陷阱發動視窗，並正常進入補餅乾提示；這是預期 no-op，不列為失敗。

## 代表性互動與 A/B

| 卡號／路徑 | 驗證內容 | 結果 |
| --- | --- | --- |
| BS6-001 | Activate；支付 HP；選擇自己的餅乾；確認技能；效果紀錄與攻擊加成 | 通過，無 pending modal、無 console error |
| BS6-004 | OnPlay；支付 HP；選擇抽牌數；完成抽牌 | 通過，無 pending modal、無 console error |
| BS6-041 | 條件成立；3 張休息區餅乾；支付 3 張能量；選對手；造成 2 傷害；Then 抽 1 張 | 通過，對手 HP 由 6 降至 4、牌庫抽出 1 張 |
| BS6-039 `met` | 對手休息區 LV.2；支付；先選休息區餅乾，再選高 1 LV 戰鬥區餅乾 | 通過，兩段目標依序完成 |
| BS6-039 `unmet` | 對手休息區 LV.7；發動登場效果 | 通過，效果視窗不開啟、流程正常結束 |
| BS6-042 `unmet` | 對手休息區條件不足的陷阱回應 | 通過，不誤觸發；回到正常補餅乾提示 |
| BS6-003 | 攻擊後 Then 入口與逐段提示 | 通過，顯示攻擊後續效果視窗 |

## Runtime 修正

官方 BS6 API 有 6 筆資料遺漏普通攻擊 `{da}` 標記，造成 Browser 入口雖可顯示卡面，轉接後卻缺少攻擊傷害。已在 `src/cards/official-card-adapter.ts` 以明確卡號補回 BS6-018、BS6-040、BS6-061（含變體）、BS6-083、BS6-104，並在 `src/cards/official-effect-adapter-bs6.test.ts` 加入回歸測試。

BS6-041 的 demo fixture 另補足第三張休息區餅乾，避免合法物品技能被錯誤渲染成只有「詳情」而沒有「使用」。

## 範圍與限制

- 本報告是候選卡牌的本機 Browser／test-state 稽核；它證明 UI 入口、支付、目標、Then、條件 A/B 與錯誤收束，不取代正式多人伺服器對戰或賽事平衡測試。
- BS6 已完成 `npm run promote:candidate`；promote 後已重新通過正式卡池的 `validate:cards` 與 `check:card-pool` gate。這份報告仍是本機 Browser／test-state 證據，不取代正式多人伺服器對戰或賽事平衡測試。
