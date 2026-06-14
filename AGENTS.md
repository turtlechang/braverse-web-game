# Braverse Project Guidance

## 專案概述

**薑餅人對戰卡牌 Braverse** 的網頁遊戲原型，以 React、TypeScript 與 Vite 建置。
以官方 Braverse 規則、Starter Deck RED 卡牌資料為基礎，將純函式規則引擎、AI 決策與 React UI 嚴格分離。

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
    starter-deck.ts← 官方 Starter Deck RED 牌組定義
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
| `npm run cards:import:sample` | 匯入官方 Starter Deck RED 卡牌資料範例 |

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
- 目前共有 312 項單元測試，涵蓋：牌組張數驗證、Fisher-Yates 種子重現性、開局牌組選擇與 AI 隨機牌組、開局調度、攻擊與技能能量支付、FLIP／TRAP 官方欄位轉換與戰鬥流程、ST2-003 Wizard Cookie 攻擊後續效果、官方標記、卡片詳情與結果提示排版、FLIP 手牌分頁、雙方依回合順序逐張選擇補位或略過、補位 OnPlay／Refresh、跨回合 OnPlay 登場窗口、AI 決策（含 faint 效果選擇）、Refresh、抽牌效果、deck-to-support、break-to-trash、物品/場景效果與完整場景合法性、When this Cookie faints、ST2-021 Pretzel Snare、ST2-001 Roguefort Cookie opponent-discard-hand、gain-hp 明確目標與 FLIP、typed GameCommand/PendingDecision pilot，以及 AI 昏厥與補位優先順序。
- Playwright 種子 1–20 驗證：AI 必須在種子 1–20 皆能正常結束對局，不出現卡住或無限迴圈；瀏覽器另驗證 1920x1080、1907x868、1600x900、1440x960、1366x768 維持 16:9、無垂直捲軸且玩家場地／手牌未超出畫布，戰鬥卡橫置不改變容器高度、確認式大卡縮小／返回，以及既有 break-to-trash、ST2-003 攻擊後續效果、陷阱、FLIP、補位、物品／場景、faint、Pretzel Snare 與 Roguefort Cookie 路徑。
- UI 互動或付款流程有變更時，除單元測試外，必須以瀏覽器實際操作至少驗證合法與不合法兩條路徑。
- 測試總數或瀏覽器驗證結果改變時，同步更新本文件與 `README.md`，不可保留過期數字。

### AI 決策邊界

- AI 邏輯集中在 `src/game/ai.ts`，不得散落至 UI 元件。
- AI 決策使用固定策略（deterministic），以確保測試可重現。
- 安全上限：單場對局最多 **500 步**，UI 自動操作最多 **200 步**；超過視為異常。

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
- 提交前至少執行 `npm test`、`npm run lint`、`npm run build`；AI 或完整對戰行為有變更時，另執行 `npm run test:ai:browser`。
- 不得自行還原不屬於目前任務的既有修改；若與目前任務無關，保留在工作區並從 commit 排除。

---

## Codex 指揮官職責（強制規範）

Codex App 在此專案中擔任**指揮官**角色，職責範圍僅限於：

- 需求規劃與問題分析
- 官方規則裁決與衝突判定
- 任務拆分與派工
- 唯讀差異審查與最終驗證

**所有程式碼、測試、設定、文件的新增、編輯、修改，一律優先且必須由 OpenCode Go 模型執行。** Codex 不得使用 `apply_patch`、`edit`、`write` 等工具或 shell 指令直接寫入或修改檔案內容。

只有在**同時滿足以下所有條件**時，Codex 才能例外親自編輯：

1. OpenCode Go 完全不可用（API 離線、授權失效等）
2. OpenCode Go 連續派工失敗且無法透過升級模型解決
3. **使用者已明確知悉並同意此例外**

平台安全核准與外部網路要求仍不可繞過；若工具要求使用者再次核准，仍須依平台流程正常處理。

---

## opencode-go 派工策略

由 Codex 派工時依本節規則透過 `--model` 選擇：

- **預設優先派工**：使用者已同意將本專案原始碼內容傳送至 OpenCode Go 外部 API。凡 OpenCode Go 可可靠完成的唯讀審查、測試補強、文件更新、簡單重構、CRUD 與一般實作，預設先派給 OpenCode Go，以降低 Codex GPT 額度消耗；Codex 主線負責需求拆解、規則裁決、跨模組整合、高風險修改與最終驗證。
- **平台核准仍優先**：上述同意是專案偏好，不取代 Codex 執行環境的安全審查或外部網路核准；若工具要求再次核准，仍須依平台流程處理，不得繞過。
- **避免重複耗用**：同一子任務原則上只派工一次；結果完整即可直接整合，不再用另一個 GPT／OpenCode 模型重做。只有結果不完整、測試失敗或重大疑點時才依升級機制追加派工。
- **受限網路環境**：OpenCode Go 使用外部 HTTPS API；透過 Codex 執行 `scripts\opencode-go.cmd run` 時，第一次呼叫即使用 `sandbox_permissions: "require_escalated"`，避免 `ConnectionRefused` 被 CLI 重試放大成假性模型逾時。若出現 `Error: Session not found` / `In a restricted Codex environment`，參考 `develop-braverse/references/opencode-go-sandbox.md` 的標準流程處理。
- **只讀審查**：使用 `scripts\opencode-go-review.cmd` 的 `review-fast` agent；單次最多指定 4 個檔案。跨模組審查拆成多個派工，避免內建 `plan` agent 無步數上限造成假性逾時。

### 分級路由表

| 任務分級 | 優先 | 備援一 | 備援二 | 備援三 |
|---|---|---|---|---|
| 微任務（單檔機械式變更、錯字、極短 docstring、單一 assertion、小型低風險唯讀審查） | `opencode-go/deepseek-v4-flash` | `opencode-go/mimo-v2.5` | `opencode-go/minimax-m3` | `opencode-go/deepseek-v4-pro` |
| 中型一般實作（多數 CRUD、一般功能、中等測試、文件更新） | `opencode-go/qwen3.7-plus` | `opencode-go/minimax-m2.7` | `opencode-go/deepseek-v4-pro` | `opencode-go/mimo-v2.5-pro` |
| 複雜跨模組實作（規則引擎、React UI、AI 決策、整合、測試套件、完整驗證鏈） | `opencode-go/deepseek-v4-pro` | `opencode-go/mimo-v2.5-pro` | `opencode-go/glm-5.1` | `opencode-go/qwen3.7-max` |
| 大型 PR 審查（多檔案跨模組） | `opencode-go/kimi-k2.7-code` | `opencode-go/deepseek-v4-pro` | `opencode-go/glm-5.1` | `opencode-go/qwen3.7-max` |
| UI 截圖／視覺分析 | `opencode-go/mimo-v2.5` | `opencode-go/qwen3.7-plus` | `opencode-go/kimi-k2.6` | `opencode-go/mimo-v2.5-pro` |

### 模型使用限制

- **Qwen3.6 Plus**：僅作為 Qwen3.7 Plus 服務異常時的降級備援，不作一般程式碼首選。
- **GLM-5**：僅作為 GLM-5.1 服務異常時的降級備援。
- **Kimi K2.6**：不作一般程式碼首選；僅用於 UI 截圖／視覺分析備援鏈。
- **Qwen3.7 Max**：僅在前級模型（DeepSeek V4 Pro、MiMo V2.5 Pro、GLM-5.1）皆失敗或任務極高複雜度時使用。
- **MiniMax M3**：OpenCode Go 中繼資料名稱標示 **3x usage**，代表用量計算可能有倍率，實際成本應依 OpenCode Go 當期帳務規則確認，不可只看每百萬 token 標價；僅用於微任務備援鏈。
- **使用者明確指定模式或模型** → 優先採用使用者指定。

### 省 token 規則

1. **任務拆分**：先拆成小任務，提供明確檔案清單與驗收條件，避免一次性龐大提示。
2. **不重複派工**：同一子任務不平行重複派工；結果可用直接整合。
3. **Flash 升級條件**：Flash 失敗一次、任務範圍意外擴大、漏改、或測試失敗時，直接升級至 Pro，不得連續重抽 Flash。
4. **逾時判斷**：先分辨逾時原因——token=0 代表網路／連線問題（檢查權限與沙箱），token>0 代表模型已在背景執行（用 `session list` 檢查）。
5. **Reasoning effort**：支援 reasoning effort 的模型一般使用 `low` 或 `medium`；僅在複雜規則推理、架構設計或疑難除錯時使用 `high`。
6. **限制輸出**：提示詞中明確要求簡潔回答，限制不必要的長篇說明。
7. **快取命中**：利用固定提示模板與檔案順序，提高 API 端快取命中率，降低重複 token 消耗。

## 禁止提交

- `node_modules/`
- 建置產物（`dist/`）
- 測試報告與截圖（`test-results/`）
- 任何密鑰、API Token 或個人認證資料
