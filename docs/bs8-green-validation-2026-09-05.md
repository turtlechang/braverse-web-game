# BS8 綠色卡牌驗證紀錄 — 2026-09-05

## 範圍與結論

- 官方來源：`data/cards/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json`
- 範圍：BS8-051～075，共 25 個基礎卡號、34 筆卡牌／異圖記錄；包含 EXTRA `BS8-069`。
- 結論：卡面資料、轉接、付款、條件、目標、Then 與對局操作皆已在本機正式規則／UI 路徑覆核；本次發現的四項綠色規則缺口已修正。

## 修正的規則

| 卡號 | 修正後行為 | 成立／不成立驗證 |
| --- | --- | --- |
| BS8-059 `Mystic Flour Cookie` | 自己戰鬥區有另一張同名餅乾時，整個技能不可發動，不會支付 `{G}` 或回手兩張綠色支援卡；UI 會明示「存在另一張 Mystic Flour Cookie」。否則先完整支付，再對每張對手餅乾移除至多 2 張 HP。 | 同名卡存在／不存在 |
| BS8-065 `Spinach Cookie` | 登場時僅在己方支援區張數較少時，才可選擇自己至多 1 張支援卡改為活躍；保留選 0。 | 支援數較少／不較少 |
| BS8-073 `Noodle Cocoon` | 陷阱先使攻擊餅乾本回合 -1 攻擊；其 Then 的可選 `{G}` 必須由支援區支付。付款後僅在防守方支援數較少時，才由攻擊方選擇至多 1 張防守方活躍支援卡改為休息。 | 支援數較少／不較少 |
| BS8-074 `White Flour Fog` | 防守方支援數少至少 2 張時，陷阱費用由 `{G}` 減為 0；否則仍必須支付 `{G}`。UI、付款候選與規則層共用同一筆動態費用。 | 差至少 2／差不足 2 |

## 驗證證據

| 層級 | 結果 |
| --- | --- |
| 嚴格卡牌契約 | `npm.cmd run cards:audit:contracts -- --strict`：1,415 `verified`，0 `needs-review`，0 `blocked` |
| 正式資料與 registry | `npm.cmd run validate:cards`：1,400 張可轉接記錄通過；`npm.cmd run check:card-pool` 通過 |
| 針對性規則／adapter | `bs8-green-repairs`、adapter 與 strict-contract 相關測試共 291 項通過 |
| 完整單元測試 | `npm.cmd test -- --maxWorkers=1`：259 檔、4,142 項通過 |
| 建置 | `npm.cmd run build` 通過（僅有既有 chunk-size 警告） |
| 逐卡效果 Browser | 30 筆效果來源皆在正式 UI／`GameCommand` 流程完成；BS8-059／065／073／074 另有逐張成立／不成立 A/B。長跑掃描曾因 preview server 中斷停在 BS8-071，後以 071／072／075 與 073／074 的獨立報告補跑，全部通過；不是卡牌行為失敗。另以目前版本重跑 32 筆非 EXTRA 綠色記錄的負向矩陣：32 passed、0 blocked、0 failed。 |
| 無效果／EXTRA Browser | BS8-058、070 的登場與攻擊均通過；BS8-069 的 EXTRA 直接登場成立／不成立 A/B 與一般路由私密性通過。 |
| 卡圖 | 34/34 卡號與異圖的名稱、URL 與實際解碼圖片皆通過。首次受環境網路限制的 `BLOCKED_NETWORK` 結果未採用；重新以可連官方 CDN 的瀏覽器驗證後為 34/34。 |
| AI 瀏覽器回歸 | `npm.cmd run test:ai:browser`：20/20 完成、卡住 0。 |

報告檔位於 `test-results/`，為暫存驗證產物，不提交版本控制。

## 已知界線

本輪的卡牌操作驗證使用正式卡池、規則引擎、UI 與本機 Browser；`test-state` 只用來建立可重現的正反局面。它證明共享實作路徑，**不等同** 34 筆來源都已在完整雙瀏覽器好友房實戰中自然抽到並觸發。後續若要擴大線上覆蓋，須在不揭露隱藏資訊的前提下，為各卡補建房、同步、支付、對手選擇與對戰紀錄驗收。

## 非本輪失敗

`npm.cmd run lint` 仍報 3 項既有未使用變數：`.tmp-probe-deploy.ts` 1 項與 `scripts/diagnose-lv5-conservatism.ts` 2 項。這些檔案不屬於本輪綠色修正，未為了製造綠燈而修改。
