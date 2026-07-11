# 測試計畫（Test Plan）

最後更新：2026-07-12。現況為 97 個測試檔、1545 項 vitest 測試（非永久門檻） + 5 套 Playwright 瀏覽器驗證；本輪 AI 瀏覽器 20/20、stuck=0。

> 2026-07-12 更新：AI、牌組編輯器與好友房 Playwright smoke 已綁定 main push 自動執行，但不在每次 PR 執行以控制成本；好友房已自動驗證建房至主階段同步、斷線與伺服器無法連線提示，尚未自動打到勝負。

## 1. 測試層級

| 層級 | 工具 | 範圍 | 執行 |
|---|---|---|---|
| 單元/整合 | vitest 4（jsdom） | 規則引擎、卡牌轉接、hooks、元件、server | `npm test`（CI 每次 PR/push） |
| AI 回歸模擬 | vitest 內嵌 | 多回合 AI 對局矩陣、勝率門檻、卡死偵測 | 同上 |
| 瀏覽器 E2E | Playwright（自製腳本） | 12 種解析度 AI 對局、牌組編輯器、藍牌效果、線上 modal RWD、雙瀏覽器好友房 | `npm run test:ai:browser` / `test:deck:browser` / `test:blue:browser` / `test:online:browser` / `test:online:match:browser` |
| 靜態 | eslint / `tsc -b` / bundle budget | 全 repo | `npm run lint` / `npm run build` / `npm run check:bundle`（CI） |

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
- `validate:cards`、`validate:candidate` 與 `check:card-pool` 已接入 CI；候選 promote 失敗不覆蓋正式卡池，成功後會重新產生 runtime registry。

### UI ✅／⚠️

- 元件測試：BattleRow（含互動）、MainMenu、gameUiLabels、各 hooks。
- Playwright：滿版畫布無捲軸、扇形手牌幾何、modal 縮小/返回、陷阱/FLIP/補位/物品/場景路徑、12 種解析度（1600×900～600×338）；`npm run test:deck:browser` 驗證牌組編輯器錯誤 JSON、合法牌組匯入／儲存與 1366×768／280×720 RWD；`npm run test:online:browser` 驗證線上 modal RWD；`npm run test:online:match:browser` 以兩個隔離瀏覽器連接本機權威 server，驗證建房、加入、開局、合法階段指令同步與斷線通知，並關閉 server 驗證連線失敗提示與返回操作。
- ⚠️ 缺口：Playwright 不在每次 PR 的 CI；好友房尚未自動打到勝負，完整一局仍以既有公網人工驗收與規則／server 整合測試共同覆蓋。

### 線上對戰 ⚠️

- `server/src/rooms.test.ts`、`connection.test.ts`、`commands-online-mvp.test.ts`。
- `src/hooks/useOnlineMatch.test.tsx` 以 10 項回歸覆蓋 timeout、error/close、舊連線競態、主動離開、unmount 與錯誤伺服器 envelope。
- ✅ 兩個隔離瀏覽器已自動完成建房、加入、開局、主階段同步、斷線與連線失敗提示；完整打到勝負仍保留為人工驗收項。
- ⚠️ 待補：伺服器端 ClientMessage 執行期 envelope 驗證，以及戰場內 `command-rejected` 可見性。

## 3. 慣例與門檻

1. 測試與原始碼同目錄（`*.test.ts(x)`）；引擎測試不 mock，直接以種子建局。
2. 提交門檻：`npm test`、`npm run lint`、`npm run build` 三綠（CI 強制執行；本地提交前先跑）。
3. 型別檢查必須用 `tsc -b`（`tsc --noEmit` 會漏報 exhaustive switch 的 never 分支——PR #15 教訓）。
4. 瀏覽器驗證前必須先 `npm run build`；報告輸出 `test-results/`，不得提交。
5. 修 bug 先寫重現測試；歷史回歸點（known-risks R10 等）測試不得刪除。
6. AI 行為變更需重跑等級門檻測試與 5×5 矩陣模擬，確認勝率門檻與「對局可結束」不退化。

## 4. 待補（優先序）

1. ~~`validate:cards` 資料驗證 + CI 接入~~ ✅ 2026-07-10 完成（`npm run validate:cards`，CI 第一步執行）。
2. ~~線上對戰雙視窗核心流程腳本化。~~ ✅ 2026-07-12 完成（本機權威 server；建房→加入→開局→狀態同步→斷線）。
3. ~~牌組編輯器 Playwright 流程（匯入錯誤 JSON 不 crash 的瀏覽器級驗證）。~~ ✅ 2026-07-12 完成，並納入 main push workflow。
4. ~~手動 playtest checklist 正式文件化。~~ ✅ 2026-07-12 完成；實際試玩回報仍依人工測試進度持續累積。
