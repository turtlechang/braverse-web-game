# 回歸測試清單（Regression Test Checklist）

最後更新：2026-07-10。合併任何影響規則引擎、AI 或卡牌資料的 PR 前逐項確認。

## 1. 自動化（每次 PR 必跑，CI 強制）

- [ ] `npm run validate:cards` — 卡池全數可轉換，無資料缺陷
- [ ] `npm test` — 全數通過，目前基線 89 個測試檔、1455 項測試（測試總數不應下降，刪測試需說明）
- [ ] `npm run lint`
- [ ] `npm run typecheck`（含 server）
- [ ] `npm run build` — 必須用 `tsc -b`（`tsc --noEmit` 會漏報 exhaustive switch 的 never 分支）

## 2. AI 行為（AI 或效果變更時）

- [ ] `ai-level-benchmark.test.ts` — Lv.3 對 Lv.1 勝率門檻未退化
- [ ] `ai-training-batch.test.ts` — 5×5 牌組矩陣 × 多種子模擬全數正常結束（無限迴圈守門）
- [ ] **AI 攻擊必須停在 trap 階段**等人類防守方回應（歷史回歸點 R10：Lv.1/3/4 曾自動結算導致無法防守；新 AI 等級必須用 `applyChosenTurnCommand`/`beginAttack`）
- [ ] AI 支援階段有手牌時會放支援（曾回歸）

## 3. 歷史回歸熱點（碰到相關模組時重點檢查）

| 熱點 | 對應測試 / 檢查 |
|---|---|
| BS1-006 after-damage 僅戰鬥傷害觸發 | `effects-bs1-after-damage.test.ts` |
| BS1-037 目標選擇與 battle area cap | `battle-area-cap-and-trap-targeting.test.ts` 等 |
| ST5-021 無合法必選目標不得列入陷阱候選 | 紫對紫種子 6/19/29/33 |
| 陷阱 support-to-hand / hand-to-support 傳錯 ID 卡死 | `battle-trap.test.ts`；Bean 牌組觸發路徑 |
| 陷阱付款候選需過濾能量顏色 | PR #20 修正；`energy.test.ts` |
| resolveFlip 必須先檢查 condition | PR #17 修正；`battle-pending-flip.test.ts` |
| 異圖卡號 `@` 正規化（exact 表查詢） | `official-effect-adapter.test.ts` |
| 補位途中 Refresh / faint 佇列順序 | `battle-faint-queue.test.ts`、`replacement.test.ts` |
| 牌組儲存版本遷移、損壞資料不整批消失 | `custom-deck-storage.test.ts` |
| commandLog 補記：新增互動式流程必須補記 | `commands*.test.ts`、`replay.test.ts` |

## 4. 瀏覽器級（UI 變更時；先 `npm run build`）

- [ ] `npm run test:ai:browser` — 12 種解析度（1600×900～600×338）AI 對局 smoke、滿版無捲軸
- [ ] `npm run test:blue:browser` — 藍牌效果使用/付款/目標/決策流程
- [ ] 主選單 footer 非官方聲明仍存在且不與面板重疊（1366×768、600×338）

## 5. 資料與部署

- [ ] 卡牌資料變更後：張數／測試數字同步更新於相關文件
- [ ] `vercel.json` rewrite 未被移除（deep link 重新整理不 404）
- [ ] CI workflow 步驟未被削減（validate → test → lint → build）
