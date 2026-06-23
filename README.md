# 薑餅人對戰卡牌 Braverse

以 React、TypeScript 與 Vite 建置的 CookieRun: Braverse 網頁遊戲原型。

## 開發背景

本專案以官方 Braverse 規則、官方起始牌組卡牌資料、卡背與能量圖示為基礎，將純函式規則引擎、AI 決策與 React UI 分離。規則引擎集中於 `src/game/`，官方卡牌資料轉接集中於 `src/cards/`，React 畫面只呼叫規則層公開 API，不另寫權威規則。三副起始牌組共 10 張物品卡與 2 張場景卡已完整支援，含費用支付、主階段動作、場景替換橫置啟動、複合效果暫停與 OnPlay/Refresh/補位銜接，AI 以 deterministic 策略使用。桌機 UI 採 16:9 桌墊聚焦 HUD，以窄型五階段列、中央操作指引、55/45 戰鬥／支援區與按需展開的資源牌堆降低周邊資訊干擾；FLIP、物品、陷阱、AI 效果棄牌公開資訊與補位選擇皆可縮小後再展開，不會因此推進待確認狀態。App.tsx 協調邏輯已拆至 useMatchController/usePendingEffect/useAiTurn/useMatchDialogs 自訂 hooks；大型 effects/battle/ai 測試已按領域拆檔；新增 src/game/commands.ts 的 typed GameCommand/PendingDecision pilot，涵蓋 faint、棄牌、看牌庫、補位、OnPlay 略過等九種決策，UI 與 AI 已接入。桌面 MatchToolbar 已移至 PhaseRail 上方；雙方手牌採支援區邊界內的扇形呈現，我方右側切齊、對手左側切齊，動態調整間距、弧度與 z-index；我方 hover 保留扇形位置與角度，僅提供輕微上移提示。

目前以《綜合規則》Ver.1.2、《CRB 遊戲指南》240812 更新版、《CRB 說明書 P1》及《裁判指南》作為規則文件基線；專案裁定與仍待新版官方資料覆核的項目記錄於 `docs/rule-clarifications.md`。

官方範例卡已匯入 `category_title` / `card_product_title` 為 `Starter Deck RED`、`Starter Deck YELLOW`、`Starter Deck GREEN`、`Starter Deck BLUE` 與 `Starter Deck PURPLE` 的五套起始牌組資料。五套資料都可建立 60 張牌組，並以官方 JSON 的卡號、名稱、類型、攻擊文字、效果文字與圖片 URL 轉成 runtime `GameCard`。

專案開發流程已整理為 `.agents/skills/develop-braverse` Skill，統一需求分析、規則查核、架構邊界、測試驗證、文件同步、派工與 Git 收尾步驟。

CI/CD 採 GitHub Actions + Vercel Git Integration。GitHub Actions 僅執行 `npm test`、`npm run lint`、`npm run build` 與手動 Playwright AI 瀏覽器驗證，不負責部署。Vercel 監聽 PR 與 push 後自動產生 Preview 部署與正式部署。GitHub Secrets 不保存 Vercel Token，所有 Vercel 連線設定在 Vercel Dashboard 完成。

## 目前進度

- 已建立紅色起始牌組：22 種卡號，合計 60 張。
- 已建立黃色起始牌組：20 種卡號，合計 60 張；官方清單未包含 `ST2-017`。
- 已建立綠色起始牌組：22 種卡號，合計 60 張。
- 已建立藍色起始牌組：22 種卡號，合計 60 張。
- 已建立紫色起始牌組：22 種卡號，合計 60 張。
- 已加入黃色起始牌組官方樣本檔：`data/cards/official-starter-deck-yellow.en.json`。
- 已加入綠色起始牌組官方樣本檔：`data/cards/official-starter-deck-green.en.json`。
- 已加入藍色起始牌組官方樣本檔：`data/cards/official-starter-deck-blue.en.json`。
- 已加入紫色起始牌組官方樣本檔：`data/cards/official-starter-deck-purple.en.json`。
- 已新增明確 API：`createOfficialRedStarterDeck`、`createOfficialYellowStarterDeck`、`createOfficialGreenStarterDeck`、`createOfficialBlueStarterDeck`、`createOfficialPurpleStarterDeck`、`OFFICIAL_RED_STARTER_DECK`、`OFFICIAL_YELLOW_STARTER_DECK`、`OFFICIAL_GREEN_STARTER_DECK`、`OFFICIAL_BLUE_STARTER_DECK`、`OFFICIAL_PURPLE_STARTER_DECK`。
- `createOfficialStarterDeck` 與 `OFFICIAL_STARTER_DECK_RED` 仍保留為紅色起始牌組相容別名。
- `ST3-010 Aloe Cookie` 的 deck-to-support 效果已完整支援：從牌庫頂取牌直立放入支援區、牌庫歸零觸發 Refresh；無候選時由正在 Refresh 的玩家敗北，對手獲勝。
- FLIP 與 TRAP 以官方欄位驅動：`card_type=FLIP` 解析 `card_flip`，`card_type=TRAP` 解析 `card_attack_text`，不依卡號硬編碼。
- 紅、黃、綠、藍、紫五套起始牌組的 FLIP 已支援棄手牌增加 HP、抽牌與逐張傷害暫停；TRAP 已支援攻擊回應、能量支付、攻擊降低、條件傷害、HP 下限、支援棄置、牌庫頂放入休息支援及複合抽牌（ST4-021）。
- 餅乾因暈倒或效果離開戰鬥區後，會依各玩家離場張數逐張詢問是否補位；玩家可選擇補餅乾或略過，雙方同批離場時由回合玩家先完成，再由非回合玩家執行，並在每張實際補位間依序處理 Refresh 與 OnPlay。
- 新對局會隨機洗牌，並依序進行玩家選牌組、AI 隨機選牌組、猜拳、先後攻、自由／強制調度、補償抽牌與起始餅乾配置。
- 桌面 UI 已完成減法改版：左側為窄型五階段列，右上只保留重置、牌組與暫停資訊；雙方場地固定為戰鬥區 55%、支援區 45%，戰鬥卡向中央分隔列靠攏，我方支援卡由左向右、對手由右向左排列並維持可辨識尺寸；對手名稱與先後攻資訊位於戰鬥區左下角。牌庫／場景／休息區改為數字牌堆與鄰近浮層，棄牌與完整牌組維持大型視窗。手牌選取後才抬升並顯示單一合法動作，可用空白處或 `Escape` 取消；攻擊、付款與目標選擇提示集中在中央分隔列。低於 900px 的頂部階段列、中央牌桌、底部工具列維持既有模式，最低支援 600x338。
- 已加入 `scripts/opencode-go.cmd` 與專案模型設定，使用獨立 runtime 目錄及 `OPENCODE_GO_API_KEY` 環境變數進行派工，不提交認證資料。
- Codex 受限網路環境執行 OpenCode Go 時，需以核准的外部網路權限啟動派工；`ConnectionRefused` 且 Token 為 0 代表尚未進入模型推理。
- OpenCode Go 只讀審查改用 `scripts/opencode-go-review.cmd` 與受限步數的 `review-fast` agent，限制讀檔範圍與工具迭代，避免多檔案 `plan` 審查超過呼叫端 timeout。
- 目前模型路由：依任務分五級——微任務（Flash/MiMo/M3/Pro）、中型實作（Qwen Plus/M2.7/Pro/MiMo Pro）、複雜跨模組（Pro/MiMo Pro/GLM-5.1/Qwen Max）、大型 PR 審查（Kimi Code/Pro/GLM-5.1/Qwen Max）、UI 視覺分析（MiMo/Qwen Plus/K2.6/MiMo Pro）；Qwen3.6 Plus 與 GLM-5 僅備援、MiniMax M3 標 3x usage；含省 token 策略（小任務、不重複派工、reasoning low/medium、快取提示）；另提供沙箱網路阻擋繞過方案（`opencode-go-sandbox.md` 標準流程、`scripts/opencode-go-direct-review.mjs` Node.js 直接 API 呼叫）。
- 已加入 `develop-braverse` 專案 Skill，提供漸進式載入的開發流程、架構規則、驗證與 Git、opencode-go 派工參考。
- 已整合四份繁中官方規則文件，確認可選再登場、同時效果順序、陷阱回應限制、FLIP 可略過、Refresh 插入時機與雙方敗北；另記錄 `doubleLoss`、非戰鬥離場再登場、強制重抽補償及賽事模組範圍等專案決議。
- 玩家於開局選擇紅色、黃色、綠色、藍色或紫色起始牌組，AI 每局隨機選擇並立即公開；重新開始會回到牌組選擇。
- 手牌扇形配置完成：我方手牌右側切齊、對手手牌左側切齊，支援區邊界內動態調整間距、弧度與 z-index；我方卡片 hover 時以小比例突顯，對手卡片不回應 hover。對手手牌以上方中央為共同支點向下扇形展開；畫面由左至右依序覆蓋，右側卡牌位於較高層級；六張角度 -25/-15/-5/5/15/25 度；牌背 180 度；不越過支援區左界；1538×578 左界 0.96px，600×338 與 1920×1080 亦未越界且無捲軸、無 console error。
- 目前共有 614 項單元測試；ST5 紫色起始牌組效果已完整支援：ST5-003 可選抽 0～1 張、ST5-004 昏厥後會先完成對手強制棄牌再進入補位，並於同一公開視窗展示 AI 因效果棄置的全部卡牌；ST5-001/006/007 可移除符合條件的餅乾或場景、ST5-010/018/021 檢查剩餘 HP 上限、ST5-013/020 支付指定紫色 LV.1 戰鬥區餅乾、ST5-019 在對手棄牌區達 20 張後造成傷害並可選抽牌、ST5-022 僅在對手以效果將自己的戰鬥區餅乾送入棄牌區時觸發。非昏厥移除不會誤觸 faint；陷阱具必選目標但目前沒有足量合法目標時，會由共用規則層排除，避免 UI 與 AI 誤判 ST5-021 可發動。另以正式 ST5-010 補位 OnPlay 狀態驗證移除 AI 餅乾後，AI 會完成補位並繼續主要階段。隨機棄牌公開資訊確認期間會阻擋其他規則動作及 AI 自動推進。UI 與 AI 皆使用相同目標、Refresh、付款與補位流程。
- Playwright 種子 1-20 與十四種解析度版面驗證已全綠；1920×1080 玩家手牌改以 `bottom: 45%` 對齊支援區上緣並避開右側資源區。
- Playwright 種子 1-20 驗證用於確認 AI 對局可正常結束，並額外驗證十四種桌機與窄視窗解析度（含 1920x1080、1907x868、1536x864、1538x578、798x698，最低至 600x338）維持 16:9、無垂直捲軸；雙方場地維持 55/45 比例，窄版 HUD 上下排列，主要區域、場地、支援區、左右資源區與手牌未超出畫布且互不遮蔽。另覆蓋支援卡左右排列與尺寸、戰鬥卡靠中央、對手名稱牌位置、手牌選取與 `Escape` 取消、資源浮層、戰鬥卡橫置、確認式大卡縮小／返回、break-to-trash、ST2-003 攻擊後續效果、ST3-002 支援卡代價技能、陷阱、FLIP、補位、物品／場景、faint、Pretzel Snare 與 Roguefort Cookie 路徑、PhaseRail 明確 grid row 修正下一步按鈕誤佔 1fr、對手手牌牌背旋轉180度（1538×578 六張牌 faceTransform matrix(-1,0,0,-1,0,0)、外側角度 -25/+25deg、左界 0.96px，無 console error）；完整瀏覽器驗證前需先執行 `npm run build`。
- `npm run test:blue:browser` 已於 1366×768、900×506 通過 ST4-012／013 與 ST4-016～020 的使用、付款、目標與決策流程。
- 已建立 `.github/workflows/ci.yml`：於 PR 與 main push 觸發，Node 22、啟用 npm cache、僅 `contents: read`，執行 `npm test`、`npm run lint`、`npm run build`。
- 已建立 `.github/workflows/ai-browser-validation.yml`：手動觸發（`workflow_dispatch`），安裝 Chromium 含 `--with-deps`，失敗時上傳 `test-results` 保留 7 天。

## 下一步計畫

- 已達成：三色（RED / YELLOW / GREEN）起始牌組切換、App.tsx 元件拆分（卡牌展示、BattleRow、PhaseRail、MatchToolbar、狀態面板、效果面板、modal）；10 張物品與 2 張場景完整支援（disable-flip、view-hp、modify-all-attack、battle-to-support、trash-to-battle、support-to-hand、複合效果暫停與 OnPlay/Refresh/補位銜接、AI deterministic 使用）。
- 已達成：陷阱使攻擊者或目標離場後跳過攻擊傷害；HP 配置途中 Refresh 的登場允許；通用化物品/場景效果解析（disable-flip、view-hp、modify-all-attack、battle-to-support、trash-to-battle、support-to-hand）；When this Cookie faints 事件引擎（pending queue、玩家/AI 雙路徑選擇、選 0 略過、多餅乾同時昏厥依序處理）；顏色匹配與 Mix Cost 已實作；回合結束效果引擎（endPhase 標記、雙方順序觸發、一次性防重複、Refresh 暫停與恢復）。
- 已達成：修復 `isEffectUntargeted` 錯誤標記 `support-to-trash`、`trash-to-battle`、`support-to-hand` 為無目標，避免 AI 與 UI 在這些效果上出錯；擴充 `gain-hp` 效果支援非 FLIP 技能路徑（ST3-001 Muscle Cookie、ST2-004 Macaron Cookie）；新增 UI 動畫回饋（攻擊抖動、抽牌滑入、傷害閃爍、昏厥縮小）與 PhaseRail 回合指示器，提升真人玩家輪流操作體驗。
- 已達成：修正 ST3-004 Vampire Cookie 複合 OnPlay 效果（{ap} cost GGGN，Select up to 1 opponent Cookie receives 2 damage, Then this Cookie gains +1 HP），於 official-effect-adapter 的 exactStarterEffects 新增 damage + gain-hp 明確轉換；修正 ST3-017 Viney Vines 攻擊效果第二段 support-to-trash 支援卡候選無法選取問題，於 usePendingEffect 新增 supportEffectTargetIds 供 toggleEffectTarget 接受支援卡目標。
- 已達成：開局牌組選擇與 AI 隨機牌組、猜拳先後攻、玩家活躍／抽牌自動推進、支援放置後自動進主要階段、頂部 HUD、16:9 無捲軸桌機畫布、公開卡牌詳情，以及可縮小的 FLIP／物品／陷阱確認式大卡。
- 已達成：最大化桌面版桌墊聚焦改版，移除固定右側 HUD，採窄型階段列、55/45 場地、資源牌堆浮層、中央操作指引與選取後才顯示的手牌合法動作；窄版同步維持 55/45 比例並調整卡牌排列。
- 已達成：ST3-002／ST3-005／ST3-015 可從我方支援區直接選擇卡牌作為送入棄牌區的技能代價；同一張支援卡不可同時支付能量與特殊代價。
- 已達成：ST2-003 Wizard Cookie 在攻擊傷害完成後、替補開始前，可選最多 1 張己方 LV.1 休息區卡牌移至棄牌區；玩家與 AI 均可完成結算。
- 已達成：導入 `category_title` 為 `Starter Deck BLUE` 與 `Starter Deck PURPLE` 的官方範例牌組，補齊 22 種卡號×60 張牌組食譜，並新增對應官方樣本檔、建立函式與張數驗證測試。
- 已達成：玩家手牌 hover 保留原扇形位置與角度，僅上移 8px、縮放至 1.02；ST5-021 無合法必選目標時不再列入陷阱候選，並以紫色對紫色固定種子 6、19、29、33 鎖定 AI 不再卡住。
- 已達成：AI 效果棄牌公開資訊與非 Refresh 補位提示框可縮小至右下 dock 並再次展開，縮小不會確認、略過或推進狀態；正式 ST5-010 補位 OnPlay 流程與 798×698 瀏覽器操作均確認 AI 能繼續行動。
- 拖移卡牌暫不實作；未來若加入，拖放只負責輸入，仍須呼叫既有規則 API，且在 pending decision、確認式大卡與 AI 行動期間停用，並保留按鈕與鍵盤操作。
- 待官方規則確認後才擴充 `CardEffect`；不得將待確認規則寫成已完成項目。
- 持續補齊起始牌組以外的複合效果與完整事件優先權。
- 專案指令、驗證範圍或派工策略調整時，同步維護 `develop-braverse` Skill。
- 若官方規則或卡牌資料更新，重新匯入樣本並同步更新文件與測試數字。
- 已完成 Vercel Dashboard 匯入 GitHub repo：Framework Preset Vite、Build Command `npm run build`、Output Directory `dist`、Install Command `npm ci`、Node.js Version 22。
- 不啟用 main branch protection（個人開發者，不要求 CI 通過 + review）。
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
npm run cards:import:blue-sample
npm run cards:import:purple-sample
```

`cards:import:sample` 目前預設匯入綠色起始牌組；紅色、黃色、綠色、藍色與紫色也可使用明確腳本重新產生。
