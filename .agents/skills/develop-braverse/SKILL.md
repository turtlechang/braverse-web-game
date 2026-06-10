---
name: develop-braverse
description: 依 Braverse 專案規範執行需求分析、規則查核、React/TypeScript 實作、卡牌資料轉接、AI 決策、測試、瀏覽器驗證、程式碼審查、文件更新與 Git 提交流程。處理此專案的功能開發、錯誤修正、重構、規則或卡牌效果調整、UI 互動、AI 對戰、測試補強、PR 審查或提交準備時使用。
---

# Braverse 開發流程

以專案根目錄的 `AGENTS.md` 為最高優先的本機工作規範。使用正體中文與台灣常用詞彙溝通，程式碼符號維持英文，commit 訊息使用英文。

## 1. 啟動工作

1. 執行 `git status --short --branch`。
2. 工作區乾淨時執行 `git pull --ff-only`；有既有修改時先執行 `git fetch` 確認遠端差異。
3. 保留所有非本次任務的修改，不得擅自還原、覆蓋或納入提交。
4. 讀取 `AGENTS.md`、相關原始碼、測試及文件，再決定改動範圍。
5. 使用 `rg` 或 `rg --files` 搜尋符號、測試與文件；先理解現有公開 API 與資料流。

## 2. 依任務載入依據

- 修改規則引擎、卡牌效果、費用、時機或勝負：先讀 `docs/game-rules.md`，再讀 [references/architecture-and-rules.md](references/architecture-and-rules.md)。
- 修改官方卡牌匯入或文字解析：另讀 `docs/card-data-import.md` 與 `docs/card-effects.md`。
- 修改 UI、版面或互動：另讀 `docs/official-ui-reference.md`，確認 UI 只呈現規則層結果。
- 修改 AI 或完整對戰流程：讀 `src/game/ai.ts`、相關規則模組與瀏覽器驗證腳本。
- 準備驗證、文件或提交：讀 [references/verification-and-git.md](references/verification-and-git.md)。
- 需要派工或獨立審查：讀 [references/delegation.md](references/delegation.md)。

## 3. 查核規則

1. 區分 `[已確認]`、`[暫定]` 與 `[待確認]`。
2. 不自行實作 `[待確認]` 項目。
3. 文件若與目前程式、測試或 README 衝突，檢查 Git 歷史與最新官方依據，不直接回退已完成行為。
4. 採用優先順序：最新官方規則更新 > 官方完整規則 > 卡牌文字 > Play Guide > 賽事規章。
5. 規則確認後同步更新相關 `docs/`，移除或改寫已過期的暫定說明。

## 4. 實作

1. 將規則判定與狀態轉換留在 `src/game/`，使用純函式、不可變資料與可注入外部變因。
2. 讓 React UI 呼叫規則層公開 API；不得直接修改 `GameState` 或另寫權威規則。
3. 將 AI 決策集中於 `src/game/ai.ts`，保持 deterministic 並回傳新狀態。
4. 將官方資料格式留在 `src/cards/types.ts`，執行期核心型別留在 `src/game/types.ts`。
5. 新增效果時先更新 `CardEffect` union，再調整轉接層、執行邏輯與測試。
6. 共用既有能量選擇、文字解析、洗牌及事件推進函式，不在 UI 或其他模組複製規則。
7. 修改規則邏輯時同步新增或更新對應 `.test.ts`；回歸測試要覆蓋真正根因。

## 5. 驗證

依 [references/verification-and-git.md](references/verification-and-git.md) 選擇測試層級。最低提交門檻為：

```powershell
npm test
npm run lint
npm run build
```

AI、完整對戰、付款或 UI 互動改變時，先建置，再執行 Playwright 驗證，並涵蓋合法與不合法路徑。修正所有由本次變更造成的失敗，不以特製種子或硬編碼資料掩蓋問題。

## 6. 收尾

1. 檢查完整 diff 與 `git status --short`。
2. 排除 `node_modules/`、`dist/`、`test-results/`、密鑰與無關檔案。
3. 功能完成或準備 commit 時，更新 `README.md` 的「開發背景」、「目前進度」與「下一步計畫」。
4. 測試數量或瀏覽器驗證範圍改變時，同步更新 `AGENTS.md` 與 `README.md`。
5. 僅在使用者要求時建立 commit；使用英文 commit 訊息，並只納入本次任務檔案。
