# 測試計畫（Test Plan）

最後更新：2026-07-10。現況為目前測試快照 90 個測試檔、1457 項 vitest 測試（此為觀測值，非固定門檻）+ 2 套 Playwright 瀏覽器驗證，全數綠燈。

## 1. 測試層級

| 層級 | 工具 | 範圍 | 執行 |
|---|---|---|---|
| 單元/整合 | vitest 4（jsdom） | 規則引擎、卡牌轉接、hooks、元件、server | `npm test`（CI 每次 PR/push） |
| AI 回歸模擬 | vitest 內嵌 | 多回合 AI 對局矩陣、勝率門檻、卡死偵測 | 同上 |
| 瀏覽器 E2E | Playwright（自製腳本） | 12 種解析度 AI 對局 smoke、藍牌效果流程 | `npm run test:ai:browser` / `test:blue:browser`（手動 + workflow_dispatch） |
| 靜態 | eslint / `tsc -b` | 全 repo | `npm run lint` / `npm run build`（CI） |

## 2. 覆蓋現況（依主計畫驗收項對照）

### 核心流程（主計畫 Phase 1 驗收）✅

- 起手：`opening.test.ts`、`setup`／猜拳／調度／起始餅乾配置。
- 抽牌：`turn.test.ts`、`refresh` 牌庫歸零 Refresh 與敗北。
- 出牌：`actions`、`energy.test.ts`（費用/顏色/Mix）、`skills`、`effects-*.test.ts` 系列。
- 攻擊：`battle*.test.ts`（陷阱、Blocker、FLIP、昏厥佇列、補位、attack-effect 控制權）。
- 結束回合：`turn.test.ts` 回合結束效果引擎。
- 勝負判定：`victory`、Refresh 敗北、doubleLoss。
- 指令層與重播：`commands*.test.ts`、`replay.test.ts`。

### 卡牌效果 ✅（持續擴充）

- 逐卡測試：`bs1-*.test.ts`、`skills-*.test.ts`、`effects-new-mechanics.test.ts`（14 種新機制）＋ 24 則官方轉換驗證。
- 原則：每張新支援卡牌至少一則效果結算測試；歷史回歸卡（BS1-006/037、ST5-021、Pretzel Snare 等）保留固定測試。

### AI ✅

- 各級 handler：`ai-level1/3/4.test.ts`、`ai-dispatcher`、`ai-turn-decision`。
- 強度門檻：`ai-level-benchmark.test.ts`（Lv.3 對 Lv.1 勝率下限、多種子）。
- 回歸場景：`ai-r6a/r6b/r7/r9/r10` 補位/陷阱/斬殺/風險系列、`ai-training-batch`（5×5 牌組矩陣 × 20 種子模擬，確認對局可正常結束、無無限迴圈）。
- 視角公平：`player-view.test.ts`、`masked-state.test.ts`。

### 牌組與資料 ✅／⚠️

- `custom-deck*.test.ts`：60 張/4 張上限/餅乾/FLIP 驗證、儲存版本遷移、損壞資料不整批消失。
- `starter-deck.test.ts`、`scripts/import-official-cards.test.js`：牌組食譜張數與匯入。
- ⚠️ 缺口：無獨立 `validate:cards`（資料完整性、重複 id、effectId↔resolver 對應）——roadmap P1。

### UI ✅／⚠️

- 元件測試：BattleRow（含互動）、MainMenu、gameUiLabels、各 hooks。
- Playwright：滿版畫布無捲軸、扇形手牌幾何、modal 縮小/返回、陷阱/FLIP/補位/物品/場景路徑、12 種解析度（1600×900～600×338）。
- ⚠️ 缺口：Playwright 屬手動觸發，不在每次 PR 的 CI；牌組編輯器與線上對戰無瀏覽器級測試。

### 線上對戰 ⚠️

- `server/src/rooms.test.ts`、`connection.test.ts`、`commands-online-mvp.test.ts`。
- ⚠️ 缺口：缺「兩個真實瀏覽器視窗完整一局」的驗收紀錄與斷線提示測試——roadmap P1。

## 3. 慣例與門檻

1. 測試與原始碼同目錄（`*.test.ts(x)`）；引擎測試不 mock，直接以種子建局。
2. 提交門檻：`npm test`、`npm run lint`、`npm run build` 三綠（CI 強制執行；本地提交前先跑）。
3. 型別檢查必須用 `tsc -b`（`tsc --noEmit` 會漏報 exhaustive switch 的 never 分支——PR #15 教訓）。
4. 瀏覽器驗證前必須先 `npm run build`；報告輸出 `test-results/`，不得提交。
5. 修 bug 先寫重現測試；歷史回歸點（known-risks R10 等）測試不得刪除。
6. AI 行為變更需重跑等級門檻測試與 5×5 矩陣模擬，確認勝率門檻與「對局可結束」不退化。

## 4. 待補（優先序）

1. ~~`validate:cards` 資料驗證 + CI 接入~~ ✅ 2026-07-10 完成（`npm run validate:cards`，CI 第一步執行）。
2. 線上對戰雙視窗手動驗收腳本化（roadmap P1；Render 部署後在公網執行）。
3. 牌組編輯器 Playwright 流程（匯入錯誤 JSON 不 crash 的瀏覽器級驗證）。
4. 手動 playtest checklist 正式文件化（roadmap P2，與 card-review-checklist 整併）。
