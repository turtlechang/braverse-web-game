# Braverse Project Guidance

## 專案概述

**薑餅人對戰卡牌 Braverse** 的網頁遊戲原型，以 React、TypeScript 與 Vite 建置。
以官方 Braverse 規則、Starter Deck RED／YELLOW／GREEN／BLUE／PURPLE 卡牌資料為基礎，將純函式規則引擎、AI 決策與 React UI 嚴格分離。

---

## 語言

- 預設使用**正體中文**與台灣常用詞彙。
- 程式碼符號（型別、函式名）使用英文；開發討論與文件使用正體中文。
- Commit 訊息使用英文。

---

## 工作入口與導航

日常使用 `$braverse-workflow`；遊戲功能、規則、UI 或 AI 實作另依 `develop-braverse`。這些是專項流程，不取代使用者授權或平台限制。

| 範圍 | 可信入口 |
|---|---|
| 純函式規則與公開 API | `src/game/types.ts`、`src/game/index.ts`；動作／效果／費用分別見 `actions.ts`、`effects.ts`、`energy.ts` |
| AI、開局、回合 | `src/game/ai.ts`、`setup.ts`、`turn.ts`、`refresh.ts`、`victory.ts` |
| 官方資料與文字轉接 | `src/cards/types.ts`、`official-card-adapter.ts`、`official-effect-adapter.ts`、`official-text-parser.ts` |
| React 畫面 | `src/App.tsx`、`src/components/`；樣式入口 `src/App.css` |
| 官方規格 | `docs/game-rules.md`、`docs/card-effects.md`、`docs/card-data-import.md`、`docs/official-ui-reference.md` |
| 原始資料與產物 | `data/`、`data/candidates/`、`public/`；測試產物不得提交 |

按任務查相關章節，不預讀整個卡池或全部歷史報告。卡牌匯入沿用候選隔離 → 驗證／逐卡稽核 → promote；不得將未驗收候選提前放入正式卡池。

## 開發指令

以 `package.json` 為命令定義來源；Windows PowerShell 使用 `npm.cmd` 避免 `npm.ps1` 執行政策問題。

| 指令 | 用途 |
|---|---|
| `npm.cmd run dev` | Vite 開發伺服器 |
| `npm.cmd test -- --maxWorkers=1` | 完整 Vitest 測試；必須等待最終結果 |
| `npm.cmd run lint` | ESLint |
| `npm.cmd run build` | TypeScript 型別檢查與正式建置 |
| `npm.cmd run test:ai:browser` | 完整 AI Browser 驗證 |
| `npm.cmd run test:online:browser` | 線上 modal RWD／可用性 |
| `npm.cmd run test:online:match:browser` | 雙瀏覽器好友房核心同步流程；不等於完整對局至勝負 |
| `npm.cmd run validate:candidate` | 候選資料驗證 |
| `npm.cmd run promote:candidate` | 驗證後 promote 到正式卡池 |
| `npm.cmd run generate:card-pool` / `npm.cmd run check:card-pool` | 生成／核對 runtime registry |

特定系列匯入、分色 Browser、watch 等命令，只在需要時查 `package.json` 的 `scripts`，確認實際名稱後執行。Playwright 前必須先 build；外部 Playwright 使用 `PLAYWRIGHT_NODE_MODULES` 指向其 `node_modules`。

---

## 工程原則

### 架構分離（嚴格執行）

- **規則引擎**（`src/game/`）與 **React UI**（`App.tsx`）完全分離。
- 規則判定與狀態轉換以**純函式**及不可變資料實作；亂數、時間等外部變因須透過參數或工廠函式注入。
- React 元件不得直接修改 `GameState`，也不得另寫一套權威規則；所有狀態變更與合法性判定應呼叫 `src/game/` 的公開函式。
- AI 決策必須回傳新狀態與動作資訊，不可直接修改輸入的 `GameState`。

### 型別系統

- 執行期遊戲核心型別定義於 `src/game/types.ts`；官方匯入資料型別定義於 `src/cards/types.ts`。
- 新增效果種類時，必須同步更新 `types.ts` 的 `CardEffect` union type。
- 新增官方來源欄位時，先更新 `src/cards/types.ts`；新增執行期欄位時，先更新 `src/game/types.ts`，再調整轉接層與測試。

### 測試

- 修改任何規則邏輯時，**同步新增或更新對應的 `.test.ts`**。
- 驗證決策時必讀 [驗證分級](.agents/skills/braverse-workflow/references/verification-levels.md)；目前進度及歷史測試結果依 `README.md` 所連結的任務報告核對，不預讀完整歷史清單。
- AI 完整對戰驗證仍以固定種子範圍確認可正常結束，不得用特製種子或硬編碼起始卡掩蓋規則或 AI 問題。
- 完整 `npm run test:ai:browser` 目前有既有 1920×1080 版面基線限制；修正版面前不得宣稱完整 Playwright 全綠。
- UI 互動或付款流程有變更時，除單元測試外，必須以瀏覽器實際操作至少驗證合法與不合法兩條路徑。
- demo／`test-state` 僅能作為局部驗證；回報時必須明確標示「僅 demo，尚未證明正式狀態已修改」。只有真實牌組資料、正式狀態流程與瀏覽器操作均通過後，才能宣稱正式功能完成。
- 測試總數或瀏覽器驗證結果改變時，同步更新本文件與 `README.md`，不可保留過期數字。

### AI 決策邊界

- AI 邏輯集中在 `src/game/ai.ts`，不得散落至 UI 元件。
- AI 決策使用固定策略（deterministic），以確保測試可重現。
- 安全上限：單場對局最多 **500 步**；UI 單一連續控制區段自動操作最多 **200 步**，控制權回到玩家後重新計數，超過視為異常。

### 洗牌機制

- 一般洗牌與種子洗牌共用 Fisher-Yates 演算法。
- 可重現驗證使用 `createSeededShuffle(seed)`；亂數產生器透過閉包注入 Fisher-Yates 核心。
- 相同種子必產生相同牌序；**不得修改原牌組陣列**（純函式，回傳新陣列）。
- 種子驗證不得挑選「剛好會通過」的牌序；預設種子範圍內發現規則或 AI 問題時，應修正根因並保留回歸測試。
- 正式開局若起手沒有餅乾，應依規則執行強制重抽流程；不得用固定種子或硬編碼起始卡掩蓋此情況。

### 技能標記與時機

- `Skill`：除卡片另有註明（例如 Flip 或支援區數量檢測），餅乾技能通常只有來源卡仍在戰鬥區時有效。
- `Activate`：只能在來源玩家自己的主要階段主動宣告並支付代價。
- `Once per turn`：同一張場上卡牌實體每回合只能發動一次；離場後重新登場會取得新的登場身分並重置次數。
- `Your Turn`：只有來源玩家自己的回合具備活性；進入對手回合立即失效。
- `OnPlay`：卡牌從手牌放到戰鬥區時可選擇是否發動的一次性效果，不受當前是誰的回合限制。

官方時機標記：

| 標記 | 意義 |
|---|---|
| `{mob}` | Activate（啟動） |
| `{ap}` | OnPlay（登場） |
| `{t1}` | Once per turn（每回合一次） |
| `{mt}` | Your Turn（你的回合） |

時機標記的解析集中於 `src/cards/official-text-parser.ts` 與 `src/cards/official-effect-adapter.ts`。

### 能量標記與支付

官方文字標記對照：

| 標記 | 意義 |
|---|---|
| `{R}` | 紅色能量 |
| `{Y}` | 黃色能量 |
| `{G}` | 綠色能量 |
| `{B}` | 藍色能量 |
| `{P}` | 紫色能量 |
| `{N}` | 任意能量 |
| `{K}` | 黑色能量 |

- 指定顏色費用必須由相同顏色或萬用能量支付；任意能量可由任何活躍支援卡支付。
- 技能、攻擊、AI 與 UI 必須共用 `src/game/energy.ts` 的付款選擇與驗證規則。
- UI 只能呈現規則層回傳的合法性與原因，不得自行推導另一套付款規則。
- 文字解析邏輯位於 `src/cards/official-text-parser.ts`，請勿在其他地方重新硬編碼解析規則。

---

## 規則文件參考

**修改規則引擎前，必須先閱讀 `docs/game-rules.md`。**

- 文件內每條規則標有 **[已確認]** / **[暫定]** / **[待確認]**。
- `[暫定]` 的實作為第一版原型折衷，後續可能調整。
- `[待確認]` 的項目不得自行猜測實作，需等待官方文件確認後再加入。
- 規則優先順序：最新官方規則更新 > 官方完整規則 > 卡牌文字 > Play Guide > 賽事規章。
- `docs/game-rules.md` 可能含有落後於目前程式的「第一版原型」描述；若與已提交程式、測試或 `README.md` 的目前進度衝突，先查閱 Git 歷史與最新官方依據，不得直接將已完成行為退回舊暫定版本。
- 規則實作確認後，必須同步更新相關 `docs/` 文件，移除或改寫已過期的 `[暫定]` 說明。

---

## Git 與提交流程

- 開始時讀取 `git status --short --branch`。唯讀稽核不執行 fetch／pull；任務需要遠端同步且已授權時才 fetch，工作樹乾淨才可 `git pull --ff-only`。
- 保留使用者既有修改與未追蹤檔案；不得擅自還原、覆蓋或納入提交。未明確要求不 commit、push、建立或合併 PR。
- 提交前分析完整差異，排除無關檔案、建置產物、測試報告與密鑰。
- 每當完成一項功能或使用者要求 commit 時，先更新 `README.md` 的「開發背景」、「目前進度」與「下一步計畫」。
- `README.md` 的「更新日誌」固定使用「日期 / 概要」Markdown 表格；同日期可合併為一列，概要保持精簡，不寫詳細實作清單。
- 提交前至少執行 `npm test`、`npm run lint`、`npm run build`；AI 或完整對戰行為有變更時，另執行 `npm run test:ai:browser`。Windows 可使用相同 npm scripts 的 `npm.cmd` 形式。
- 準備 stage／commit 時必讀 [提交前檢查](.agents/skills/braverse-workflow/references/pre-commit-review.md)。

## Codex 主線與協作

Codex 是預設主線，負責需求分析、實作、驗證、修正與交付。已授權範圍內直接完成；使用者限定唯讀、規劃或批准清單時，遵守該門檻。

日常預設單一主代理；需要獨立並行工作時，先讀 [派工契約](.agents/skills/braverse-workflow/references/delegation-template.md)。使用者、平台與執行設定的限制均須遵守；不因模型標籤停工，也不由文件自動切換模型、供應商或推理設定。核心規則、FSM、AI、線上同步與高風險整合仍由主代理掌握上下文及最終驗證。

**OpenCode Go 備援已取消**：不再派工、呼叫 wrapper、做服務 preflight 或向其傳送專案資料。舊 `.agents/skills/develop-braverse/references/delegation.md`、`.agents/skills/develop-braverse/references/opencode-go-sandbox.md` 與既有 wrapper 僅為保留的歷史材料，不構成啟用入口；本次不修改供應商、帳號或認證設定。

## 禁止提交

- `node_modules/`
- 建置產物（`dist/`）
- 測試報告與截圖（`test-results/`）
- 任何密鑰、API Token 或個人認證資料
