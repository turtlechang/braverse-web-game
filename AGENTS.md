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

## 目錄結構

```
src/
  game/          # 純函式規則引擎（不依賴 React）
    types.ts       ← 所有核心型別，單一真實來源
    actions.ts     ← 攻擊、登場、放支援等動作
    effects.ts     ← 效果執行與目標選擇
    energy.ts      ← 費用驗證與選擇
    skills.ts      ← 技能觸發（Activate / OnPlay / Passive）
    ai.ts          ← AI 決策（simulateAiMatch、takeAiStep）
    setup.ts       ← 開局流程（createGame、mulligan）
    turn.ts        ← 回合推進（advancePhase）
    refresh.ts     ← 牌庫 Refresh 流程
    victory.ts     ← 勝負判定
    starter-deck.ts← 官方 Starter Deck RED／YELLOW／GREEN／BLUE／PURPLE 牌組定義
    helpers.ts     ← createSeededShuffle（Fisher-Yates 種子洗牌）
    commands.ts    ← typed GameCommand/PendingDecision pilot
    index.ts       ← 公開 API 匯出入口
    *.test.ts      ← 對應模組的單元測試

  cards/         # 官方卡牌資料轉接層
    official-card-adapter.ts    ← 官方 JSON → GameCard
    official-effect-adapter.ts  ← 官方文字標記 → CardEffect[]
    official-text-parser.ts     ← 解析 {R}/{Y}/{mob}/{ap} 等標記
    types.ts                    ← 官方資料格式型別

  App.tsx        # React UI（唯一畫面元件入口）
  App.css        # 全域樣式

docs/            # 規則文件（AI 修改規則前必讀）
  game-rules.md            ← 官方規則整理，含 [已確認]/[暫定]/[待確認] 標記
  card-effects.md          ← 效果型別清單
  card-data-import.md      ← 卡牌資料匯入流程
  official-ui-reference.md ← 官方 UI 規格參考

scripts/         # Node.js 工具腳本
data/            # 官方卡牌原始 JSON 資料
  candidates/    # 候選卡牌隔離區（promote 前暫存）
test-results/    # Playwright 截圖與報告（勿提交）
public/          # 本機 UI 素材（卡背、能量圖示、參考圖片）
```

---

## 開發指令

| 指令 | 用途 |
|---|---|
| `npm run dev` | 啟動開發伺服器（Vite HMR） |
| `npm run build` | TypeScript 型別檢查 + 正式建置 |
| `npm run lint` | ESLint 程式碼品質檢查 |
| `npm test` | 執行所有單元測試（Vitest） |
| `npm run test:watch` | 監聽模式執行測試 |
| `npm run test:ai:browser` | Playwright 瀏覽器 AI 驗證（需先 `npm run build`） |
| `npm run test:online:browser` | Playwright 線上對戰 modal RWD／可用性驗證（需先 `npm run build`） |
| `npm run test:online:match:browser` | Playwright 本機雙瀏覽器好友房建房／加入／私密猜拳／勝者選順位／依序調度與補償／起始餅乾同步揭示／先後攻與階段狀態／雙方對戰動態與完整紀錄／支援→主要→結束同步／卡牌詳情關閉／伺服器拒絕提示／斷線驗證（需先 `npm run build`） |
| `npm run cards:import:sample` | 匯入官方 Starter Deck 卡牌資料範例（預設 GREEN） |
| `npm run cards:import:red-sample` | 匯入官方 Starter Deck RED 卡牌資料 |
| `npm run cards:import:yellow-sample` | 匯入官方 Starter Deck YELLOW 卡牌資料 |
| `npm run cards:import:green-sample` | 匯入官方 Starter Deck GREEN 卡牌資料 |
| `npm run cards:import:blue-sample` | 匯入官方 Starter Deck BLUE 卡牌資料 |
| `npm run cards:import:purple-sample` | 匯入官方 Starter Deck PURPLE 卡牌資料 |
| `npm run validate:candidate` | 驗證候選卡牌資料（data/candidates/） |
| `npm run promote:candidate` | 驗證並 promote 候選卡牌到正式卡池 |
| `npm run generate:card-pool` | 依 data/cards/*.json 重新生成 runtime card pool registry |
| `npm run check:card-pool` | 檢查 data/cards/*.json 與 runtime registry 是否一致（CI gate） |

> Playwright 驗證前必須先執行 `npm run build`。
> 若 Playwright 安裝於外部目錄，以 `PLAYWRIGHT_NODE_MODULES` 指定其 `node_modules` 路徑。

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
- 目前單元測試數、ST5 紫色起始牌組回歸範圍、Playwright 解析度矩陣與已知瀏覽器限制，維護於 `README.md` 與 `.agents/skills/braverse-workflow/references/verification-levels.md`；避免在每次任務中重複載入完整歷史清單。
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

- 每次開始工作前先執行 `git status --short --branch`。
- 工作區乾淨時執行 `git pull --ff-only`；若有未提交變更，先以 `git fetch` 確認遠端差異，不可直接覆蓋或還原其他工具／使用者的修改。
- 提交前分析完整差異，排除無關檔案、建置產物、測試報告與密鑰。
- 每當完成一項功能或使用者要求 commit 時，先更新 `README.md` 的「開發背景」、「目前進度」與「下一步計畫」。
- `README.md` 的「更新日誌」固定使用「日期 / 概要」Markdown 表格；同日期可合併為一列，概要保持精簡，不寫詳細實作清單。
- 提交前至少執行 `npm test`、`npm run lint`、`npm run build`；AI 或完整對戰行為有變更時，另執行 `npm run test:ai:browser`。
- 不得自行還原不屬於目前任務的既有修改；若與目前任務無關，保留在工作區並從 commit 排除。

---

## Codex 主線開發與模型路由

Codex 是本專案的預設主線開發者，負責需求分析、規則裁決、實作、測試、文件同步、整合與最終驗證。除非使用者明確限制為唯讀或規劃階段，Codex 可直接完成任務範圍內的檔案修改，不必先派給 OpenCode Go。

依目前 Codex 可用模型與任務風險選擇層級：

- **GPT-5.6 Sol**：核心規則、狀態機、AI、線上同步、資料結構、高風險跨模組修改、疑難除錯與最終整合。
- **GPT-5.6 Terra**：一般功能、單一模組實作、中等複雜度 bug、測試、React 元件、型別整理與文件同步。
- **GPT-5.6 Luna**：快速搜尋、清單整理、錯字與命名、小型低風險修改、執行既定驗證與簡單文件更新。
- 若指定層級在目前帳號、工作區或 Codex surface 不可用，使用當前可用且足以完成任務的 Codex 模型，不因模型標籤阻塞工作。

模型選擇不改變專案的規則、安全、測試與 Git 邊界；高風險工作仍須由主線代理掌握完整上下文並完成最終驗證。

---

## OpenCode Go 與平行代理策略

OpenCode Go 保留為**溢出、備援、低風險平行工與獨立第二意見**，不是每個任務的預設實作者。只有下列情境才優先考慮：

- Codex 額度不足，需要獨立額度池處理可清楚驗收的工作。
- 有互不重疊的低風險工作可平行執行，例如大量測試補強、文件盤點、靜態搜尋或格式統一。
- 需要不同模型做唯讀 PR review、反方意見或交叉驗證。
- 使用者明確指定 OpenCode Go。

核心規則、FSM、AI 決策、安全／權限、資料遷移、不明根因 bug、跨模組整合與發布判斷，預設由 Codex 主線處理，不派給 OpenCode Go 自主決策。

使用任何外部或平行代理時：

- 先讀 `.agents/skills/braverse-workflow/references/delegation-template.md`；確定使用 OpenCode Go 後，才讀 `.agents/skills/develop-braverse/references/delegation.md`。
- 一個子任務只交給一個執行者；不得平行修改相同檔案或同一責任區。
- 每批限定 2–3 個檔案、一個主題、明確驗收與不可修改範圍；結果由 Codex 以 diff、原始碼與測試自行驗證。
- 子代理連續兩次停滯後由 Codex 接手，不無限重試。完整流程見 [`docs/subagent-stall-handoff-protocol.md`](docs/subagent-stall-handoff-protocol.md)。
- 平台安全核准與外部網路要求不得繞過；核准不可用或被拒絕時，停止外部派工並由 Codex 本機繼續或回報限制。

## 禁止提交

- `node_modules/`
- 建置產物（`dist/`）
- 測試報告與截圖（`test-results/`）
- 任何密鑰、API Token 或個人認證資料
