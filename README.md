# 薑餅人對戰卡牌 Braverse

以 React、TypeScript 與 Vite 建置的 CookieRun: Braverse 網頁遊戲原型。

## 開發背景

本專案以官方 Braverse 規則、官方起始牌組卡牌資料、卡背與能量圖示為基礎，將純函式規則引擎、AI 決策與 React UI 分離。規則引擎集中於 `src/game/`，官方卡牌資料轉接集中於 `src/cards/`，React 畫面只呼叫規則層公開 API，不另寫權威規則。三副起始牌組共 10 張物品卡與 2 張場景卡已完整支援，含費用支付、主階段動作、場景替換橫置啟動、複合效果暫停與 OnPlay/Refresh/補位銜接，AI 以 deterministic 策略使用。桌機 UI 採滿版桌墊聚焦 HUD，以窄型五階段列、中央操作指引、55/45 戰鬥／支援區與按需展開的資源牌堆降低周邊資訊干擾；FLIP、物品、陷阱、昏厥效果、抽牌決策與棄手牌決策會以可縮小的深色置中提示框暫停展示。App.tsx 協調邏輯已拆至 useMatchController/usePendingEffect/useAiTurn/useMatchDialogs 自訂 hooks；大型 effects/battle/ai 測試已按領域拆檔；src/game/commands.ts 的 typed GameCommand 已從 pilot 擴充為全覆蓋指令層（8 種決策指令 + 24 種玩家動作指令），applyGameCommand 會在 GameState.commandLog 記錄每筆指令，src/game/replay.ts 提供 replayCommands/replayCommandLog 重播能力。桌面 MatchToolbar 已移至 PhaseRail 上方；雙方手牌採支援區邊界內的扇形呈現，我方右側切齊、對手左側切齊，動態調整間距、弧度與 z-index；我方 hover 保留扇形位置與角度，僅提供輕微上移提示。

目前以《綜合規則》Ver.1.2、《CRB 遊戲指南》240812 更新版、《CRB 說明書 P1》及《裁判指南》作為規則文件基線；專案裁定與仍待新版官方資料覆核的項目記錄於 `docs/rule-clarifications.md`。

官方範例卡已匯入 `category_title` / `card_product_title` 為 `Starter Deck RED`、`Starter Deck YELLOW`、`Starter Deck GREEN`、`Starter Deck BLUE` 與 `Starter Deck PURPLE` 的五套起始牌組資料。五套資料都可建立 60 張牌組，並以官方 JSON 的卡號、名稱、類型、攻擊文字、效果文字與圖片 URL 轉成 runtime `GameCard`。

專案開發流程已整理為 `.agents/skills/develop-braverse` Skill，統一需求分析、規則查核、架構邊界、測試驗證、文件同步、派工與 Git 收尾步驟。工作流模板另拆為 `.agents/skills/braverse-workflow`，讓 `AGENTS.md` 保留硬規則，任務分類、驗證分級、派工提示與提交前檢查改由 Skill references 漸進式載入。

CI/CD 採 GitHub Actions + Vercel Git Integration。GitHub Actions 僅執行 `npm test`、`npm run lint`、`npm run build` 與手動 Playwright AI 瀏覽器驗證，不負責部署。Vercel 監聽 PR 與 push 後自動產生 Preview 部署與正式部署。GitHub Secrets 不保存 Vercel Token，所有 Vercel 連線設定在 Vercel Dashboard 完成。

Phase 5 線上對戰 MVP 分支新增 WebSocket 對局、遮罩版 GameState 與線上戰場 UI 重用流程；CI 修正以維持 `npm test`、`npm run lint`、`npm run build` 全通過為提交門檻。

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
- 已新增主選單與對戰入口流程：玩家需先選擇一副合法自訂牌組才能進入對戰；合法性檢查集中於 `src/game/custom-deck.ts`，規則為剛好 60 張、同卡號最多 4 張、至少 1 張餅乾卡、FLIP 不超過 16 張且不限制單一顏色。牌組編輯器即時顯示總張數、FLIP 張數、餅乾卡數量與錯誤原因；AI 對手仍在對戰開始前由五色起始牌組隨機決定。
- 主選單牌組卡片支援刪除（含確認）與複製；「需調整」標籤 hover 顯示不合法原因。牌組儲存改為含 `version` 欄位的格式並自動遷移舊陣列格式，損壞資料不會讓已存牌組消失整批。
- 牌組編輯器卡池單擊直接加入 1 張、右下角顯示已選張數徽章、右上角 info 鈕開啟詳細與加減控制；達 4 張上限的卡片保留在卡池並以禁用樣式呈現。
- 桌面 UI 已完成減法改版：左側為窄型五階段列，右上只保留重置、牌組與暫停資訊；雙方場地固定為戰鬥區 55%、支援區 45%，戰鬥卡向中央分隔列靠攏，我方支援卡由左向右、對手由右向左排列並維持可辨識尺寸；對手名稱與先後攻資訊位於戰鬥區左下角。牌庫／場景／休息區改為數字牌堆與鄰近浮層，棄牌與完整牌組維持大型視窗。手牌選取後才抬升並顯示單一合法動作，可用空白處或 `Escape` 取消；攻擊、付款與目標選擇提示集中在中央分隔列。低於 900px 的頂部階段列、中央牌桌、底部工具列維持既有模式，最低支援 600x338。
- 已加入 `scripts/opencode-go.cmd` 與專案模型設定，使用獨立 runtime 目錄及 `OPENCODE_GO_API_KEY` 環境變數進行派工，不提交認證資料。
- Codex 受限網路環境執行 OpenCode Go 時，需以核准的外部網路權限啟動派工；`ConnectionRefused` 且 Token 為 0 代表尚未進入模型推理。
- OpenCode Go 只讀審查改用 `scripts/opencode-go-review.cmd` 與受限步數的 `review-fast` agent，限制讀檔範圍與工具迭代，避免多檔案 `plan` 審查超過呼叫端 timeout。
- 已加入 `develop-braverse` 專案 Skill，提供漸進式載入的開發流程、架構規則、驗證與 Git、opencode-go 派工參考。
- 已加入 `braverse-workflow` 專案 Skill，提供 Braverse 任務分類、固定開場模板、OpenCode Go / subagent 派工模板、驗證分級與 pre-commit review 清單。
- `AGENTS.md` 已瘦身為硬性規範入口；模型路由長表、驗證矩陣、歷史回歸細節改由 `.agents/skills/braverse-workflow/references/` 與 `.agents/skills/develop-braverse/references/` 承接。
- 已整合四份繁中官方規則文件，確認可選再登場、同時效果順序、陷阱回應限制、FLIP 可略過、Refresh 插入時機與雙方敗北；另記錄 `doubleLoss`、非戰鬥離場再登場、強制重抽補償及賽事模組範圍等專案決議。
- 玩家於開局選擇紅色、黃色、綠色、藍色或紫色起始牌組，AI 每局隨機選擇並立即公開；重新開始會回到牌組選擇。
- 手牌扇形配置完成：我方手牌右側切齊、對手手牌左側切齊，支援區邊界內動態調整間距、弧度與 z-index；我方卡片 hover 時以小比例突顯，對手卡片不回應 hover。對手手牌以上方中央為共同支點向下扇形展開；畫面由左至右依序覆蓋，右側卡牌位於較高層級；六張角度 -25/-15/-5/5/15/25 度；牌背 180 度；不越過支援區左界；1538×578 左界 0.96px，600×338 亦未越界且無捲軸、無 console error。
  - 目前共有 851 項單元測試；ST5 紫色起始牌組效果已完整支援：ST5-003 可選抽 0～1 張、ST5-004 昏厥後會先完成對手強制棄牌再進入補位，並於同一公開視窗展示 AI 因效果棄置的全部卡牌；ST5-001/006/007 可移除符合條件的餅乾或場景、ST5-010/018/021 檢查剩餘 HP 上限、ST5-013/020 支付指定紫色 LV.1 戰鬥區餅乾、ST5-019 在對手棄牌區達 20 張後造成傷害並可選抽牌、ST5-022 僅在對手以效果將自己的戰鬥區餅乾送入棄牌區時觸發。非昏厥移除不會誤觸 faint；陷阱具必選目標但目前沒有足量合法目標時，會由共用規則層排除，避免 UI 與 AI 誤判 ST5-021 可發動。BS1-006 Mala Sauce Cookie 的 after-damage 觸發已支援戰鬥傷害與效果傷害、once-per-turn 登記、pending decision、UI 與 AI 結算。UI 與 AI 皆使用相同目標、Refresh、付款與補位流程。
- App.tsx 協調邏輯已拆至 useMatchController/useMatchSetup/useMatchAnimations/useBattleActions/usePendingEffect/useAiTurn/useMatchDialogs 自訂 hooks；useMatchController 由 710 行降至 440 行。AI 已拆為 pending、battle、turn handlers，effects.ts 保留 14 行相容 façade並依 targeting、combat、execute、pending 分組；typed GameCommand 已全覆蓋（8 種決策 + 24 種玩家動作指令），附 commandLog 指令紀錄與 replay 重播模組。
- Playwright 種子 1-20 驗證用於確認 AI 對局可正常結束，並額外驗證十二種桌機與窄視窗解析度（含 1600x900、1536x864、1538x578、798x698，最低至 600x338）使用滿版遊戲容器、無垂直捲軸；雙方場地維持 55/45 比例，窄版 HUD 上下排列，主要區域、場地、支援區與手牌未超出畫布。另覆蓋支援卡左右排列與尺寸、戰鬥卡靠中央、對手名稱牌位置、手牌選取與 `Escape` 取消、資源浮層、戰鬥卡橫置、確認式大卡縮小／返回、break-to-trash、ST2-003 攻擊後續效果、ST3-002 支援卡代價技能、陷阱、FLIP、補位、物品／場景、faint、Pretzel Snare 與 Roguefort Cookie 路徑、PhaseRail 明確 grid row 修正下一步按鈕誤佔 1fr、對手手牌牌背旋轉180度（1538×578 六張牌 faceTransform matrix(-1,0,0,-1,0,0)、外側角度 -25/+25deg、左界 0.96px，無 console error）；完整瀏覽器驗證前需先執行 `npm run build`。
- `npm run test:ai:browser` 已於十二種解析度全綠（1600x900 至 600x338），支援卡維持扇形重疊視覺，點擊以 `page.evaluate(el => el.click())` 直接在目標元素觸發。`npm run test:blue:browser` 已於 1366×768、900×506 通過 ST4-012／013 與 ST4-016～020 的使用、付款、目標與決策流程；ST5 新增效果未影響既有藍牌瀏覽器驗證。
- 昏厥效果、`draw-up-to` 抽牌決策與後續棄手牌決策已改用與攻擊宣告回應一致的深色置中提示框與可縮小 dock。BS2-040 Aloe Cookie 的強制昏厥效果以「確認結算」進入檢視牌庫流程，不再呈現略過語意；BS2-049 Salt Crystal Trident 會先在同一套提示框選擇抽牌數，抽牌後再切到棄置手牌選擇 UI。
- 已建立 `.github/workflows/ci.yml`：於 PR 與 main push 觸發，Node 22、啟用 npm cache、僅 `contents: read`，執行 `npm test`、`npm run lint`、`npm run build`。
- 已建立 `.github/workflows/ai-browser-validation.yml`：手動觸發（`workflow_dispatch`），安裝 Chromium 含 `--with-deps`，失敗時上傳 `test-results` 保留 7 天。
- Phase 5 線上對戰 MVP 的 lint 修正已完成：線上效果目標選取改為 keyed state，避免 React hooks `set-state-in-effect`；移除未使用型別與空 handler 參數。本分支目前 `npm test` 為 851 項通過，`npm run lint` 與 `npm run build` 亦通過。

## 下一步計畫

- 已達成：UI P0 操作體驗改版——PhaseRail 精確 CTA（略過支援階段／結束主要階段／結束回合）與操作指引、頂部短暫 Toast 取代中央戰場常駐訊息、手牌可操作/不可操作視覺狀態（降權顯示）、戰鬥卡 hover/focus 快速預覽面板（窄版自動隱藏）、`BattleRowProps` 增加預覽事件。
- 待確認：推送 Phase 5 線上對戰 MVP lint 修正後，確認 GitHub Actions 的 Test, Lint & Build 工作重新回到綠燈。
- 已達成：UI P1 資訊密度改版——桌機戰鬥卡放大約 16%～20%、HP/ATK 圖示徽章、敵我摘要集中顯示牌庫手牌棄牌與休息等級、支援區橫置/付款狀態視覺區別、資源區 hover 提示（休息等級、場景橫置狀態等）；`phaseAdvanceLabels` 匯出供元件測試使用。
- 已達成：三色（RED / YELLOW / GREEN）起始牌組切換、App.tsx 元件拆分（卡牌展示、BattleRow、PhaseRail、MatchToolbar、狀態面板、效果面板、modal）；10 張物品與 2 張場景完整支援（disable-flip、view-hp、modify-all-attack、battle-to-support、trash-to-battle、support-to-hand、複合效果暫停與 OnPlay/Refresh/補位銜接、AI deterministic 使用）。
- 已達成：陷阱使攻擊者或目標離場後跳過攻擊傷害；HP 配置途中 Refresh 的登場允許；通用化物品/場景效果解析（disable-flip、view-hp、modify-all-attack、battle-to-support、trash-to-battle、support-to-hand）；When this Cookie faints 事件引擎（pending queue、玩家/AI 雙路徑選擇、選 0 略過、多餅乾同時昏厥依序處理），且同一玩家的 BS2-040/BS2-049 類同時觸發效果會先交由玩家決定順序；顏色匹配與 Mix Cost 已實作；回合結束效果引擎（endPhase 標記、雙方順序觸發、一次性防重複、Refresh 暫停與恢復）。
- 已達成：修復 `isEffectUntargeted` 錯誤標記 `support-to-trash`、`trash-to-battle`、`support-to-hand` 為無目標，避免 AI 與 UI 在這些效果上出錯；擴充 `gain-hp` 效果支援非 FLIP 技能路徑（ST3-001 Muscle Cookie、ST2-004 Macaron Cookie）；新增 UI 動畫回饋（攻擊抖動、抽牌滑入、傷害閃爍、昏厥縮小）與 PhaseRail 回合指示器，提升真人玩家輪流操作體驗。
- 已達成：修正 ST3-004 Vampire Cookie 複合 OnPlay 效果（{ap} cost GGGN，Select up to 1 opponent Cookie receives 2 damage, Then this Cookie gains +1 HP），於 official-effect-adapter 的 exactStarterEffects 新增 damage + gain-hp 明確轉換；修正 ST3-017 Viney Vines 攻擊效果第二段 support-to-trash 支援卡候選無法選取問題，於 usePendingEffect 新增 supportEffectTargetIds 供 toggleEffectTarget 接受支援卡目標。
- 已達成：開局牌組選擇與 AI 隨機牌組、猜拳先後攻、玩家活躍／抽牌自動推進、支援放置後自動進主要階段、頂部 HUD、滿版無捲軸桌機畫布、公開卡牌詳情，以及可縮小的 FLIP／物品／陷阱確認式大卡。
- 已達成：效果決策提示框統一化，Aloe Cookie 昏厥強制效果、BS2-049 抽牌與後續棄手牌選擇皆使用深色置中可縮小 modal，避免淺色浮窗遮擋牌桌與「略過」語意誤導。
- 已達成：主選單、對戰入口與牌組編輯器整合；玩家自訂牌組需通過 60 張、同卡 4 張、至少 1 張餅乾、FLIP 不超過 16 張檢查後才能開始對戰，AI 牌組在進入對戰前從五色起始牌組隨機決定。
- 已達成：最大化桌面版桌墊聚焦改版，移除固定右側 HUD，採窄型階段列、55/45 場地、資源牌堆浮層、中央操作指引與選取後才顯示的手牌合法動作；窄版同步維持 55/45 比例並調整卡牌排列。
- 已達成：ST3-002／ST3-005／ST3-015 可從我方支援區直接選擇卡牌作為送入棄牌區的技能代價；同一張支援卡不可同時支付能量與特殊代價。
- 已達成：ST2-003 Wizard Cookie 在攻擊傷害完成後、替補開始前，可選最多 1 張己方 LV.1 休息區卡牌移至棄牌區；玩家與 AI 均可完成結算。
- 已達成：導入 `category_title` 為 `Starter Deck BLUE` 與 `Starter Deck PURPLE` 的官方範例牌組，補齊 22 種卡號×60 張牌組食譜，並新增對應官方樣本檔、建立函式與張數驗證測試。
- 已達成：BS1-006 Mala Sauce Cookie 受傷後效果，新增 `src/game/afterDamage.ts` 共用收集模組與 `src/game/effects-bs1-after-damage.test.ts`；戰鬥傷害與效果傷害都會在餅乾仍留在戰鬥區時觸發後續傷害，並支援 once-per-turn 登記、玩家／AI pending decision 與 UI 目標選擇。
- 已達成：修復 `pendingBattle.stage === "attack-effect"` 控制權判定，攻擊後續效果現在由攻擊方處理；AI 作為攻擊方時會自動結算 attack-effect，不再停在 AI 主要階段等待玩家無法操作的 pending battle。同步補上玩家確認棄手牌傷害技能後排入補位的 hook 回歸測試。
- 已達成：玩家手牌 hover 保留原扇形位置與角度，僅上移 8px、縮放至 1.02；ST5-021 無合法必選目標時不再列入陷阱候選，並以紫色對紫色固定種子 6、19、29、33 鎖定 AI 不再卡住。
- 待實作：App.tsx（1575 行）容器元件拆分。已分析候選：`BattleScreen`（~1235 行 battle shell）、`FaintEffectModal`、`AfterDamageEffectModal`、`OpponentHandDiscardModal`、`DrawUpToModal`、`StageTriggerModal` 等 inline JSX modal，以及 PlayerBattleRow 的 ~150 行 callback handlers。
- 待實作：UI 與 AI 逐步改走 `applyGameCommand` 指令層（目前 UI 主要動作與 `usePendingEffect` 多段效果流程仍直接呼叫規則函式），完成後實際對局的 `commandLog` 才是完整重播來源；對局種子統一注入後可支援「複製對局紀錄」回報格式。
- 已達成：AI 等級分級第一版（Lv.1 隨機／Lv.2 現行啟發式掛名）與主選單 AI 牌組、等級選擇；設計文件見 `docs/ai-levels.md`。
- 已達成：`PlayerView` 視角過濾器（`src/game/player-view.ts`，對手手牌／雙方牌庫／雙方 HP 卡皆只留張數）與 Lv.3 評估式 AI（`src/game/ai/evaluated-turn-handler.ts`，對候選動作套用 `evaluatePlayerView` 打分取最高分，攻擊採預期傷害加成，其餘強制流程委派 Lv.2）；主選單等級選擇加入 Lv.3。20 場種子模擬中 Lv.3 對 Lv.1 勝率 ≥ 65%。
- 待實作：Lv.4／Lv.5（回合規劃與對抗性 AI），觀察 Lv.3 上線後的實際對戰體感再決定是否投入；`PlayerView` 未來預計重用於線上對戰 state snapshot。
- 拖移卡牌暫不實作；未來若加入，拖放只負責輸入，仍須呼叫既有規則 API，且在 pending decision、確認式大卡與 AI 行動期間停用，並保留按鈕與鍵盤操作。
- 待官方規則確認後才擴充 `CardEffect`；不得將待確認規則寫成已完成項目。
- 持續補齊起始牌組以外的複合效果與完整事件優先權。
- 專案指令、驗證範圍或派工策略調整時，同步維護 `develop-braverse` Skill。
- 若官方規則或卡牌資料更新，重新匯入樣本並同步更新文件與測試數字。
- 已完成 Vercel Dashboard 匯入 GitHub repo：Framework Preset Vite、Build Command `npm run build`、Output Directory `dist`、Install Command `npm ci`、Node.js Version 22。
- 不啟用 main branch protection（個人開發者，不要求 CI 通過 + review）。
- 待用第一支 PR 驗證 Vercel Preview 網址可正常載入並操作對局。
- 後續新 Braverse 任務優先用 `braverse-workflow` 模板開短 thread，依任務類型選擇驗證層級，再視需要載入 `develop-braverse` 的規則、派工或 Git 參考。

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

# 2026-07-06 Phase 5 online battle CI lint fix

- 修正 `useOnlinePendingEffect` 於 effect 變更時同步 `setState` 造成的 React hooks lint 錯誤，改以 keyed state 在效果切換時自然清空目標選取。
- 移除 `useMatchController` 未使用的 `GameCommand` type import，並讓線上 no-op `handleOnPlayTrigger` 保持介面相容但不宣告未使用參數。
- 已執行 `npm test`（851 項）、`npm run lint`、`npm run build`；build 仍只有 Vite chunk size 警告。

# 2026-06-30 BS1 Phase 1/2 update

- 已完成 Brave Beginning BS1 Phase 1/2：`data/cards/official-brave-beginning-bs1.en.json` 建立 adapter 盤點測試，覆蓋 99 筆資料、78 個 base card number、cookie/flip/item/trap/stage 類型分布。
- BS1 Phase 2 先支援可映射到既有規則引擎的效果文字：棄手牌代價傷害、FLIP 傷害、`return-to-hand`、faint 後 `break-to-trash`、支援區送棄牌區代價、`deck-to-support`、`set-active` 與 `When your turn ends` endPhase 判定；變體卡號如 `BS1-002@1` 會用 `baseCardNumber` 套用共用轉接。
- 目前共有 692 項單元測試通過。BS1 Phase 3/4/5 已補上攻擊後續效果、非餅乾卡費用與 pending flow 基礎：`damage-all`、`damage-by-break-count`、`modify-attack-by-break-count`、`discard-hand`、`redirect-attack`、`place-source-to-support`、HP 送垃圾桶費用、支援區回手費用，以及「本回合支援區減少」狀態追蹤。

# 2026-07-01 BS1 non-cookie effect verification

- 已再次確認並實作 BS1 物品卡、陷阱卡、場景卡：BS1-022/023/048/049/074/075、BS1-024/025/050/051/076/077、BS1-026/052/078 均有 adapter coverage；新增 `src/game/effects-bs1-non-cookie.test.ts` 驗證支援區回手費用、來源物品進支援區、BS1-078 支援區減少條件與 BS1-050 redirect 陷阱。
- `CardAbility.cost` 向後相容舊 EnergyCost 形狀，同時支援 AbilityCost 的非能量費用；UI pending flow 會把物品／場景的棄手牌、支援區費用與 HP 費用送入規則層。
- 已執行 `npm test`、`npm run lint`、`npm run build`；build 仍只有 Vite chunk size 警告。

# 2026-07-01 BS1 after-damage verification

- 已完成 BS1-006 Mala Sauce Cookie 的 after-damage 流程：新增 `src/game/afterDamage.ts` 收集受傷後效果，戰鬥傷害與 `executeCardEffect` 的效果傷害都會在來源餅乾仍留在戰鬥區時建立 pending after-damage effect。
- `resolveNextAfterDamageEffect`、typed `GameCommand/PendingDecision`、AI pending handler、`useMatchController` 與 `usePendingEffect` 已接入 after-damage 目標選擇；once-per-turn 使用紀錄會在效果收集或結算時登記，避免同一場上實體重複觸發。
- 新增 `src/game/effects-bs1-after-damage.test.ts` 覆蓋戰鬥傷害、效果傷害、昏厥不觸發、once-per-turn 登記與官方文字 `afterDamage` 解析；已執行 `npm test`、`npm run lint`、`npm run build`，目前 692 項單元測試通過，build 仍只有 Vite chunk size 警告。

# 2026-07-01 attack-effect control verification

- 修正 `getActingPlayerId` 在 `pendingBattle.stage === "attack-effect"` 時改回傳攻擊方，避免 AI 攻擊後續效果被錯誤指派給防守方，造成前端停在無法操作的 AI 主要階段。
- 新增 AI 回歸測試確認 AI 作為攻擊方時會結算 attack-effect，並新增 `usePendingEffect` hook 測試確認玩家確認需棄手牌的傷害技能後會清除效果面板並排入對手補位。

# 2026-07-01 BS1/BS2 red card skills/effects implementation

- 已完成 BS1/BS2 系列所有紅色卡牌的技能與攻擊後效果實作：
  - BS1-001 Goblin Cookie: OnPlay 棄 1 張手牌，選擇對手 1 隻餅乾造成 1 點傷害
  - BS1-003 Dark Choco Cookie: Activate Once per turn 支付 {R}，棄 1 張手牌，選擇對手 1 隻餅乾造成 1 點傷害
  - BS1-004 Lilac Cookie: Activate 支付 {R}{R}，將此餅乾回手
  - BS1-005 Roll Cake Cookie: 攻擊後效果選擇對手 1 隻餅乾造成 1 點傷害（已有）
  - BS1-006 Mala Sauce Cookie: after-damage 效果（已有）
  - BS1-008 Pomegranate Cookie: Activate Once per turn 支付 {R}，選擇己方 1 隻餅乾，本回合 +1 攻擊傷害
  - BS1-012 Wildberry Cookie: 被動效果若休息區有 LV.9，+2 攻擊傷害
  - BS1-013 GingerBrave: 攻擊後效果棄 1 張手牌（已有）
  - BS1-014 GingerBrave: Activate Once per turn 支付 {R}{R}，本回合 +1 攻擊傷害
  - BS1-016 Choco Ball Cookie: When Faint 若手牌 ≤ 4 張，選擇對手 1 隻餅乾造成 1 點傷害
  - BS1-017 Croissant Cookie: OnPlay 支付 {R}{R}，選擇己方 1 隻餅乾，本回合 +2 攻擊傷害
  - BS2-002 Macaron Cookie: OnPlay 支付 {R}，將對手場景卡送入棄牌區（stageOnly 限制）
  - BS2-003 Rebel Cookie: OnPlay 支付 {R}{R}，選擇對手 0～1 隻餅乾造成 2 點傷害
  - BS2-004 Cherry Cookie: 攻擊後效果若對手有 LV.1 餅乾，造成 3 點傷害（條件觸發）
  - BS2-006 Prickly Cacti Gloves: ITEM 支付 {R}{R}，選擇對手 0～1 隻餅乾造成 2 點傷害，再選擇己方 1 隻餅乾將 2 張 HP 卡送入棄牌區（hp-to-trash 非傷害，不觸發 FLIP/afterDamage，HP 歸 0 進入休息區）
  - BS2-007 Prickly Cactus Bat: TRAP 支付 {R} 並棄 1 張紅色手牌，選擇對手 LV.1 餅乾造成 2 點傷害（discardHandColor 限制紅色手牌）
- 新增 `FieldToTrashEffect.stageOnly` 選項，限制只能選擇場景卡；新增 `OpponentHasCookieWithLevelCondition` 條件類型。
- 已執行 `npm test`、`npm run lint`、`npm run build`，目前 692 項單元測試通過，build 仍只有 Vite chunk size 警告。

# 2026-07-01 BS1/BS2 adapter UI/AI/attack-effect integration

- 修正 UI `usePendingEffect.ts` 處理 `stageOnly`，場景卡現在會正確加入可選目標。
- 修正 AI `ai.ts` 的 `field-to-trash` 目標選擇，`stageOnly` 時只選場景卡，不再先挑戰鬥區餅乾。
- 修正 `battle.ts` 的 attack-effect 流程，條件不成立時自然跳過效果而非丟錯。
- 新增 `battle-attack-effect.test.ts` 回歸測試確認條件觸發效果在條件不成立時正確跳過。
- 已執行 `npm test`、`npm run lint`、`npm run build`，目前 692 項單元測試通過。

# 2026-07-02 BS2 red non-cookie effects implementation

- 已完成 BS2-006 Prickly Cacti Gloves（ITEM）與 BS2-007 Prickly Cactus Bat（TRAP）的效果實作。
- BS2-006：支付 {R}{R}，先對對手最多 1 隻餅乾造成 2 點傷害，再選擇己方 1 隻餅乾將 2 張 HP 卡送入棄牌區（`hp-to-trash` 效果）。HP-to-trash 非傷害，不觸發 FLIP/afterDamage；HP 歸 0 時餅乾進入休息區並沿用離場/補位/勝負流程。
- BS2-007：支付 {R} 並棄 1 張紅色手牌（`discardHandColor: 'red'`），對對手 LV.1 餅乾造成 2 點傷害。規則層與 UI 均會拒絕非紅色手牌支付。
- 新增 `HpToTrashEffect`（`kind: 'hp-to-trash'`）與 `AbilityCost.discardHandColor`，分別處理 HP-to-trash 效果與手牌顏色限制。
- `parseTarget` 正規表達式擴充支援 `LV.X` 級等篩選（如 `your opponent's LV.1 Cookies`）。
- 新增 adapter tests 與規則層 tests：BS2-006/007 轉換、hp-to-trash 移除 HP 卡、HP 歸 0 進休息區、紅色手牌驗證與 getTrapCandidates 顏色過濾。
- 修正 UI `useMatchController.ts` 的 `selectedTrapDiscardCandidates`，依陷阱的 `discardHandColor` 過濾手牌候選，僅顯示符合顏色限制的卡牌，避免玩家選到規則層會拒絕的手牌。
- 已執行 `npm test`、`npm run lint`、`npm run build`，目前 692 項單元測試通過，build 仍只有 Vite chunk size 警告。

# 2026-07-04 Phase 4b：PlayerView 視角過濾器 + Lv.3 評估式 AI

- **PlayerView 視角過濾器**：新增 `src/game/player-view.ts` 的 `createPlayerView(state, playerId)`，把 `GameState` 過濾成單一玩家可見資訊——對手手牌只留張數、雙方牌庫只留張數、雙方戰鬥區餅乾的 HP 卡只留張數（連持有者自己都看不到內容），支援區／Break 區／棄牌區／場景等公開資訊原樣保留。用型別而非紀律保證 AI 不作弊，未來線上對戰的 state snapshot 可直接重用。
- **Lv.3 評估式 AI**：新增 `src/game/ai/evaluated-turn-handler.ts`。支援／主要階段對 `getLegalTurnCommands` 枚舉的候選指令逐一套用後以 `evaluatePlayerView`（只吃 `PlayerView`）打分，另枚舉技能與物品候選，取最高分執行；攻擊指令因套用後戰局停在待回應階段，改用「預期傷害／斬殺」期望值加成計分而非套用後評分。非自由選擇的局面（Refresh、補位、OnPlay、戰鬥回應、非行動回合）委派給 Lv.2 的 handler，不重複實作。
- **等級分派擴充**：`AiLevel` 由 `1 | 2` 擴充為 `1 | 2 | 3`；`takeAiStep`／`simulateAiMatch` 對 Lv.3 的分派與既有 Lv.1/Lv.2 路徑並存，不影響預設行為。
- **主選單**：AI 等級下拉新增「Lv.3 評估戰局」選項。
- **測試**：新增 `player-view.test.ts`（3 項，驗證隱藏資訊已過濾、公開資訊保留）、`ai-level3.test.ts`（6 項，含評分方向正確性、結束對局勝負極值、Lv.3 對局可正常結束、**Lv.3 對 Lv.1 的 20 場種子模擬勝率 ≥ 65%**、同局面決策可重現）、MainMenu 新增 Lv.3 選項測試（1 項）；共 742 項單元測試通過。
- `docs/ai-levels.md` 更新為 Lv.1–3 已實作、Lv.4–5 設計稿，補上 Lv.3 實作細節與測試策略。
- 已執行 `npm test`（742 項）、`npm run lint`、`npm run build`。

# 2026-07-04 Phase 4：AI 等級分級第一版（Lv.1／Lv.2）

- **合法動作枚舉**：新增 `src/game/legal-actions.ts` 的 `getLegalTurnCommands(state, playerId)`，以 `PlayerActionCommand[]` 回傳目前保證合法的動作（Refresh、補位／略過、略過 OnPlay、支援放置、登場、場景放置、攻擊組合含自動能量支付、階段推進）；測試逐一驗證枚舉指令都能被 `applyGameCommand` 接受。
- **Lv.1 隨機 AI**：`src/game/ai/random-turn-handler.ts` 以 `createSeededRandom(seed ^ 局面熵)` 從合法指令均勻挑選並經指令層執行——Lv.1 是 `applyGameCommand` 的第一個 AI 消費者，行動完整寫入 `commandLog`。不主動使用技能／物品／OnPlay；待處理決策與戰鬥回應沿用共用 handler。
- **等級分派**：`takeAiStep(state, playerId, { level, seed })` 支援 Lv.1／Lv.2（預設 Lv.2，行為與既有完全一致）；`simulateAiMatch` 第三參數可對雙方分別指定等級；每個 `AiDecision` 附結構化 `reason`（等級、考慮指令數、選中指令種類）供除錯。
- **主選單 AI 對手選項**：可指定 AI 牌組（隨機／五色起始）與等級（Lv.1 隨機出招／Lv.2 基礎戰術），`handleDeckSelection` 接受指定 AI 牌組並更新開局訊息；`useAiTurn` 依所選等級執行。
- **測試**：`legal-actions.test.ts`（7 項）、`ai-level1.test.ts`（5 項，含相同種子決策序列重現、Lv.1 對 Lv.2 與 Lv.1 對 Lv.1 完賽）、MainMenu AI 選項元件測試（2 項）；共 732 項單元測試通過。
- 新增 `docs/ai-levels.md`：Lv.1–5 設計、資訊邊界（防作弊）、測試策略與不建議先做項目；Lv.3 前置為 `PlayerView` 視角過濾器。
- 已執行 `npm test`（732 項）、`npm run lint`、`npm run build`。

# 2026-07-04 Phase 1/3 收尾：指令層全覆蓋 + 牌組管理補完

- **Phase 3 牌組管理**：`custom-deck.ts` 儲存格式加入 `version: 1` 欄位（`parseCustomDeckStorage` 自動遷移舊陣列格式、過濾損壞紀錄）；新增 `deleteCustomDeck`、`duplicateCustomDeck`、`createCustomDeckId`。主選單牌組卡片新增「複製」與「刪除」（含 confirm）按鈕；「需調整」標籤 hover 顯示完整不合法原因。
- **牌組編輯器操作簡化**：卡池單擊直接 +1（原需點卡→tooltip→按加號三步）；新增張數徽章與 info 鈕（開啟原 tooltip 詳細/加減控制）；達 4 張上限的卡不再從卡池消失，改為禁用樣式。
- **Phase 1 指令層全覆蓋**：`GameCommand` 由 8 種決策指令擴充為 8 決策 + 24 玩家動作指令（開局調度／選起始餅乾、advance-phase、place-support、deploy-cookie、attack、activate-skill、play-item、play-stage、activate-stage、skip-on-play、replace-cookie、skip-replacement、refresh-deck、play-trap、skip-trap、play-blocker、resolve-flip、resolve-attack-effect、resolve-next-damage、resolve-battle）。內部僅委派既有規則函式，規則實作零修改；`applyGameCommand` 增加行動者驗證（回合玩家／補位玩家／受傷方）與「有待處理決策時拒絕動作指令」守門。
- **指令紀錄與重播**：`GameState.commandLog` 記錄每筆指令（流水號、回合、階段、玩家、payload）；新增 `src/game/replay.ts`（`replayCommands`／`replayCommandLog`／`commandFromLogEntry`）。`ApplyGameCommandOptions.shuffle` 支援注入種子洗牌以確保調度／Refresh 重播一致。
- **黃金重播測試**：`src/game/replay.test.ts` 以固定種子 + 指令序列驅動含調度、支援、登場、攻擊的三回合腳本對局，驗證重播終局 JSON 完全一致；`commands-actions.test.ts` 覆蓋行動者驗證、階段限制、決策阻擋與種子調度重現。
- `docs/game-commands.md` 已從 pilot 說明改寫為全覆蓋指令層文件（含 24 種動作指令對照表與驗證順序）。
- 已執行 `npm test`（718 項，新增 26 項）、`npm run lint`、`npm run build`；build 仍只有 Vite chunk size 警告。UI 遷移指令層與 AI 分級列入下一步計畫。

# 2026-07-03 Playwright support card click fix

- 修正支援卡維持扇形重疊視覺（`position: absolute` + `--support-index`），Playwright 支援卡點擊改用 `page.evaluate(el => el.click())` 直接在目標元素觸發，跳過座標重疊判定。
- 移除 `ai-browser-validation.mjs` 中 7 處 `dispatchEvent` 繞行，改用 `page.evaluate(el => el.click())` 直接在目標元素觸發點擊。
- 修正 `blue-card-validation.mjs` ST4-013 HP 斷言：從 `HP 2/` 放寬為 `2/`，符合 badge 實際渲染格式（Heart SVG 為 `aria-hidden`，不含 "HP" 文字前綴）。
- 已執行 `npm test`（692 tests）、`npm run lint`、`npm run build`、`npm run test:ai:browser`（20 seeds, 0 stuck）、`npm run test:blue:browser`（1366×768 + 900×506 全通過）。
