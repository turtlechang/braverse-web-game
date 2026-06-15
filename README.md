# 薑餅人對戰卡牌 Braverse

以 React、TypeScript 與 Vite 建置的 CookieRun: Braverse 網頁遊戲原型。

## 開發背景

本專案以官方 Braverse 規則、官方起始牌組卡牌資料、卡背與能量圖示為基礎，將純函式規則引擎、AI 決策與 React UI 分離。規則引擎集中於 `src/game/`，官方卡牌資料轉接集中於 `src/cards/`，React 畫面只呼叫規則層公開 API，不另寫權威規則。三副起始牌組共 10 張物品卡與 2 張場景卡已完整支援，含費用支付、主階段動作、場景替換橫置啟動、複合效果暫停與 OnPlay/Refresh/補位銜接，AI 以 deterministic 策略使用。桌機 UI 採 16:9 桌墊聚焦 HUD，以窄型五階段列、中央操作指引、55/45 戰鬥／支援區與按需展開的資源牌堆降低周邊資訊干擾；FLIP、物品與陷阱會以可縮小的確認式大卡暫停展示。App.tsx 協調邏輯已拆至 useMatchController/usePendingEffect/useAiTurn/useMatchDialogs 自訂 hooks；大型 effects/battle/ai 測試已按領域拆檔；新增 src/game/commands.ts 的 typed GameCommand/PendingDecision pilot，涵蓋 faint-effect 與 opponent-hand-discard，UI 與 AI 已接入。

目前以《綜合規則》Ver.1.2、《CRB 遊戲指南》240812 更新版、《CRB 說明書 P1》及《裁判指南》作為規則文件基線；專案裁定與仍待新版官方資料覆核的項目記錄於 `docs/rule-clarifications.md`。

官方範例卡目前優先使用 `category_title` / `card_product_title` 為 `Starter Deck GREEN` 的綠色起始牌組資料；原有 `Starter Deck RED` 與 `Starter Deck YELLOW` 資料保留為紅色、黃色起始牌組。三套資料都可建立 60 張牌組，並以官方 JSON 的卡號、名稱、類型、攻擊文字、效果文字與圖片 URL 轉成 runtime `GameCard`。

專案開發流程已整理為 `.agents/skills/develop-braverse` Skill，統一需求分析、規則查核、架構邊界、測試驗證、文件同步、派工與 Git 收尾步驟。

CI/CD 採 GitHub Actions + Vercel Git Integration。GitHub Actions 僅執行 `npm test`、`npm run lint`、`npm run build` 與手動 Playwright AI 瀏覽器驗證，不負責部署。Vercel 監聽 PR 與 push 後自動產生 Preview 部署與正式部署。GitHub Secrets 不保存 Vercel Token，所有 Vercel 連線設定在 Vercel Dashboard 完成。

## 目前進度

- 已建立紅色起始牌組：22 種卡號，合計 60 張。
- 已建立黃色起始牌組：20 種卡號，合計 60 張；官方清單未包含 `ST2-017`。
- 已建立綠色起始牌組：22 種卡號，合計 60 張。
- 已加入黃色起始牌組官方樣本檔：`data/cards/official-starter-deck-yellow.en.json`。
- 已加入綠色起始牌組官方樣本檔：`data/cards/official-starter-deck-green.en.json`。
- 已新增明確 API：`createOfficialRedStarterDeck`、`createOfficialYellowStarterDeck`、`createOfficialGreenStarterDeck`、`OFFICIAL_RED_STARTER_DECK`、`OFFICIAL_YELLOW_STARTER_DECK`、`OFFICIAL_GREEN_STARTER_DECK`。
- `createOfficialStarterDeck` 與 `OFFICIAL_STARTER_DECK_RED` 仍保留為紅色起始牌組相容別名。
- `ST3-010 Aloe Cookie` 的 deck-to-support 效果已完整支援：從牌庫頂取牌直立放入支援區、牌庫歸零觸發 Refresh；無候選時由正在 Refresh 的玩家敗北，對手獲勝。
- FLIP 與 TRAP 以官方欄位驅動：`card_type=FLIP` 解析 `card_flip`，`card_type=TRAP` 解析 `card_attack_text`，不依卡號硬編碼。
- 紅、黃、綠起始牌組的 FLIP 已支援棄手牌增加 HP、抽牌與逐張傷害暫停；TRAP 已支援攻擊回應、能量支付、攻擊降低、條件傷害、HP 下限、支援棄置及牌庫頂放入休息支援。
- 餅乾因暈倒或效果離開戰鬥區後，會依各玩家離場張數逐張詢問是否補位；玩家可選擇補餅乾或略過，雙方同批離場時由回合玩家先完成，再由非回合玩家執行，並在每張實際補位間依序處理 Refresh 與 OnPlay。
- 新對局會隨機洗牌，並依序進行玩家選牌組、AI 隨機選牌組、猜拳、先後攻、自由／強制調度、補償抽牌與起始餅乾配置。
- 桌面 UI 已完成減法改版：左側為窄型五階段列，右上只保留重置、牌組與暫停資訊；雙方場地固定為戰鬥區 55%、支援區 45%，戰鬥卡向中央分隔列靠攏，我方支援卡由左向右、對手由右向左排列並維持可辨識尺寸；對手名稱與先後攻資訊位於戰鬥區左下角。牌庫／場景／休息區改為數字牌堆與鄰近浮層，棄牌與完整牌組維持大型視窗。手牌選取後才抬升並顯示單一合法動作，可用空白處或 `Escape` 取消；攻擊、付款與目標選擇提示集中在中央分隔列。低於 900px 的頂部階段列、中央牌桌、底部工具列維持既有模式，最低支援 600x338。
- 已加入 `scripts/opencode-go.cmd` 與專案模型設定，使用獨立 runtime 目錄及 `OPENCODE_GO_API_KEY` 環境變數進行派工，不提交認證資料。
- Codex 受限網路環境執行 OpenCode Go 時，需以核准的外部網路權限啟動派工；`ConnectionRefused` 且 Token 為 0 代表尚未進入模型推理。
- OpenCode Go 只讀審查改用 `scripts/opencode-go-review.cmd` 與受限步數的 `review-fast` agent，限制讀檔範圍與工具迭代，避免多檔案 `plan` 審查超過呼叫端 timeout。
- 目前模型路由：依任務分五級——微任務（Flash/MiMo/M3/Pro）、中型實作（Qwen Plus/M2.7/Pro/MiMo Pro）、複雜跨模組（Pro/MiMo Pro/GLM-5.1/Qwen Max）、大型 PR 審查（Kimi Code/Pro/GLM-5.1/Qwen Max）、UI 視覺分析（MiMo/Qwen Plus/K2.6/MiMo Pro）；Qwen3.6 Plus 與 GLM-5 僅備援、MiniMax M3 標 3x usage；含省 token 策略（小任務、不重複派工、reasoning low/medium、快取提示）；另提供沙箱網路阻擋繞過方案（`opencode-go-sandbox.md` 標準流程、`scripts/opencode-go-direct-review.mjs` Node.js 直接 API 呼叫）。
- 已加入 `develop-braverse` 專案 Skill，提供漸進式載入的開發流程、架構規則、驗證與 Git、opencode-go 派工參考。
- 已整合四份繁中官方規則文件，確認可選再登場、同時效果順序、陷阱回應限制、FLIP 可略過、Refresh 插入時機與雙方敗北；另記錄 `doubleLoss`、非戰鬥離場再登場、強制重抽補償及賽事模組範圍等專案決議。
- 玩家於開局選擇紅色、黃色或綠色起始牌組，AI 每局隨機選擇並立即公開；重新開始會回到牌組選擇。
- 目前共有 332 項單元測試，涵蓋官方範例卡轉換、三色起始牌組、開局隨機牌組、FLIP／TRAP 官方文字轉換、ST3-002／ST3-005／ST3-015 支援卡送棄牌區技能代價、ST2-003 Wizard Cookie 傷害後的 break-to-trash 攻擊效果、官方標記、卡片詳情與結果提示排版、桌面 HUD 減法配置、手牌選取動作、付款不足時隱藏非法動作與資源浮層、FLIP 手牌分頁、逐張 HP、雙方依回合順序逐張選擇補位或略過、補位 OnPlay／Refresh、陷阱傷害續行與延後條件、跨回合 OnPlay 登場窗口、調度、種子洗牌、AI（含 faint 效果選擇）、Refresh、能量付款、物品/場景效果（disable-flip、view-hp、modify-all-attack、battle-to-support、trash-to-battle、support-to-hand）、場景完整合法性、When this Cookie faints、ST2-021 Pretzel Snare、ST2-001 Roguefort Cookie opponent-discard-hand、gain-hp 明確目標與 FLIP、typed GameCommand/PendingDecision pilot，以及 AI 昏厥與補位優先順序。
- App.tsx 協調邏輯已拆至 useMatchController/usePendingEffect/useAiTurn/useMatchDialogs 自訂 hooks；大型 effects/battle/ai 測試已按領域拆檔；新增 src/game/commands.ts 的 typed GameCommand/PendingDecision pilot，涵蓋 faint-effect 與 opponent-hand-discard，UI 與 AI 已接入。
- Playwright 種子 1-20 驗證用於確認 AI 對局可正常結束，並額外驗證十四種桌機與窄視窗解析度（含 1920x1080、1907x868、1536x864、798x698，最低至 600x338）維持 16:9、無垂直捲軸；雙方場地維持 55/45 比例，窄版 HUD 上下排列，主要區域、場地、支援區、左右資源區與手牌未超出畫布且互不遮蔽。另覆蓋支援卡左右排列與尺寸、戰鬥卡靠中央、對手名稱牌位置、手牌選取與 `Escape` 取消、資源浮層、戰鬥卡橫置、確認式大卡縮小／返回、break-to-trash、ST2-003 攻擊後續效果、ST3-002 支援卡代價技能、陷阱、FLIP、補位、物品／場景、faint、Pretzel Snare 與 Roguefort Cookie 路徑；完整瀏覽器驗證前需先執行 `npm run build`。
- 已建立 `.github/workflows/ci.yml`：於 PR 與 main push 觸發，Node 22、啟用 npm cache、僅 `contents: read`，執行 `npm test`、`npm run lint`、`npm run build`。
- 已建立 `.github/workflows/ai-browser-validation.yml`：手動觸發（`workflow_dispatch`），安裝 Chromium 含 `--with-deps`，失敗時上傳 `test-results` 保留 7 天。

## 下一步計畫

- 已達成：三色（RED / YELLOW / GREEN）起始牌組切換、App.tsx 元件拆分（卡牌展示、BattleRow、PhaseRail、MatchToolbar、狀態面板、效果面板、modal）；10 張物品與 2 張場景完整支援（disable-flip、view-hp、modify-all-attack、battle-to-support、trash-to-battle、support-to-hand、複合效果暫停與 OnPlay/Refresh/補位銜接、AI deterministic 使用）。
- 已達成：陷阱使攻擊者或目標離場後跳過攻擊傷害；HP 配置途中 Refresh 的登場允許；通用化物品/場景效果解析（disable-flip、view-hp、modify-all-attack、battle-to-support、trash-to-battle、support-to-hand）；When this Cookie faints 事件引擎（pending queue、玩家/AI 雙路徑選擇、選 0 略過、多餅乾同時昏厥依序處理）；顏色匹配與 Mix Cost 已實作；回合結束效果引擎（endPhase 標記、雙方順序觸發、一次性防重複、Refresh 暫停與恢復）。
- 已達成：修復 `isEffectUntargeted` 錯誤標記 `support-to-trash`、`trash-to-battle`、`support-to-hand` 為無目標，避免 AI 與 UI 在這些效果上出錯；擴充 `gain-hp` 效果支援非 FLIP 技能路徑（ST3-001 Muscle Cookie、ST2-004 Macaron Cookie）；新增 UI 動畫回饋（攻擊抖動、抽牌滑入、傷害閃爍、昏厥縮小）與 PhaseRail 回合指示器，提升真人玩家輪流操作體驗。
- 已達成：開局牌組選擇與 AI 隨機牌組、猜拳先後攻、玩家活躍／抽牌自動推進、支援放置後自動進主要階段、頂部 HUD、16:9 無捲軸桌機畫布、公開卡牌詳情，以及可縮小的 FLIP／物品／陷阱確認式大卡。
- 已達成：最大化桌面版桌墊聚焦改版，移除固定右側 HUD，採窄型階段列、55/45 場地、資源牌堆浮層、中央操作指引與選取後才顯示的手牌合法動作；窄版同步維持 55/45 比例並調整卡牌排列。
- 已達成：ST3-002／ST3-005／ST3-015 可從我方支援區直接選擇卡牌作為送入棄牌區的技能代價；同一張支援卡不可同時支付能量與特殊代價。
- 已達成：ST2-003 Wizard Cookie 在攻擊傷害完成後、替補開始前，可選最多 1 張己方 LV.1 休息區卡牌移至棄牌區；玩家與 AI 均可完成結算。
- 拖移卡牌暫不實作；未來若加入，拖放只負責輸入，仍須呼叫既有規則 API，且在 pending decision、確認式大卡與 AI 行動期間停用，並保留按鈕與鍵盤操作。
- 待官方規則確認後才擴充 `CardEffect`；不得將待確認規則寫成已完成項目。
- 持續補齊起始牌組以外的複合效果與完整事件優先權。
- 專案指令、驗證範圍或派工策略調整時，同步維護 `develop-braverse` Skill。
- 若官方規則或卡牌資料更新，重新匯入樣本並同步更新文件與測試數字。
- 待於 Vercel Dashboard 匯入 GitHub repo，設定 Framework Preset 為 Vite、Build Command 為 `npm run build`、Output Directory 為 `dist`、Install Command 為 `npm ci`、Node.js Version 為 22。
- 待於 GitHub 啟用 main branch protection：要求 `CI / Test, Lint & Build` 通過、至少 1 人 review、禁止直接 push。
- 待用第一支 PR 驗證 Vercel Preview 網址可正常載入並操作對局。

## 開發指令

```bash
npm install
npm run dev
```

## 驗證指令

```bash
npm test
npm run lint
npm run build
```

AI 瀏覽器驗證：

```bash
npm run build
npm run test:ai:browser
```

若 Playwright 安裝於外部目錄，可用 `PLAYWRIGHT_NODE_MODULES` 指定其 `node_modules` 路徑。測試報告與截圖會輸出到 `test-results/`，不得提交。

## 卡牌資料匯入

```bash
npm run cards:import:sample
npm run cards:import:red-sample
npm run cards:import:yellow-sample
npm run cards:import:green-sample
```

`cards:import:sample` 目前預設匯入綠色起始牌組；紅色、黃色與綠色也可使用明確腳本重新產生。
