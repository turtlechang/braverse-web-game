# 薑餅人對戰卡牌 Braverse

以 React、TypeScript 與 Vite 建置的 CookieRun: Braverse 網頁遊戲原型。

## 開發背景

本專案以官方 Braverse 規則、官方起始牌組卡牌資料、卡背與能量圖示為基礎，將純函式規則引擎、AI 決策與 React UI 分離。規則引擎集中於 `src/game/`，官方卡牌資料轉接集中於 `src/cards/`，React 畫面只呼叫規則層公開 API，不另寫權威規則。三副起始牌組共 10 張物品卡與 2 張場景卡已完整支援，含費用支付、主階段動作、場景替換橫置啟動、複合效果暫停與 OnPlay/Refresh/補位銜接，AI 以 deterministic 策略使用。

目前以《綜合規則》Ver.1.2、《CRB 遊戲指南》240812 更新版、《CRB 說明書 P1》及《裁判指南》作為規則文件基線；專案裁定與仍待新版官方資料覆核的項目記錄於 `docs/rule-clarifications.md`。

官方範例卡目前優先使用 `category_title` / `card_product_title` 為 `Starter Deck GREEN` 的綠色起始牌組資料；原有 `Starter Deck RED` 與 `Starter Deck YELLOW` 資料保留為紅色、黃色起始牌組。三套資料都可建立 60 張牌組，並以官方 JSON 的卡號、名稱、類型、攻擊文字、效果文字與圖片 URL 轉成 runtime `GameCard`。

專案開發流程已整理為 `.agents/skills/develop-braverse` Skill，統一需求分析、規則查核、架構邊界、測試驗證、文件同步、派工與 Git 收尾步驟。

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
- 新對局會隨機洗牌，並依序進行猜拳、先後攻、自由／強制調度、補償抽牌與起始餅乾配置。
- UI 已加入雙方正面棄牌卡堆與清單、戰鬥區 HP 卡展開、付款橫置預覽、FLIP 棄牌手牌分頁及 PhaseRail 內嵌 AI 狀態。
- 已加入 `scripts/opencode-go.cmd` 與專案模型設定，使用獨立 runtime 目錄及 `OPENCODE_GO_API_KEY` 環境變數進行派工，不提交認證資料。
- Codex 受限網路環境執行 OpenCode Go 時，需以核准的外部網路權限啟動派工；`ConnectionRefused` 且 Token 為 0 代表尚未進入模型推理。
- OpenCode Go 只讀審查改用 `scripts/opencode-go-review.cmd` 與受限步數的 `review-fast` agent，限制讀檔範圍與工具迭代，避免多檔案 `plan` 審查超過呼叫端 timeout。
- 已加入 `develop-braverse` 專案 Skill，提供漸進式載入的開發流程、架構規則、驗證與 Git、opencode-go 派工參考。
- 已整合四份繁中官方規則文件，確認可選再登場、同時效果順序、陷阱回應限制、FLIP 可略過、Refresh 插入時機與雙方敗北；另記錄 `doubleLoss`、非戰鬥離場再登場、強制重抽補償及賽事模組範圍等專案決議。
- UI 可分別設定玩家與 AI 使用紅色、黃色或綠色起始牌組，重新開始與 AI 種子驗證會沿用目前選擇。
- 目前共有 280 項單元測試，涵蓋官方範例卡轉換、三色起始牌組、FLIP／TRAP 官方文字轉換、官方標記、卡片詳情與結果提示排版、FLIP 手牌分頁、逐張 HP、雙方依回合順序逐張選擇補位或略過、補位 OnPlay／Refresh、陷阱傷害續行與延後條件、跨回合 OnPlay 登場窗口、調度、種子洗牌、AI（含 faint 效果選擇）、Refresh、能量付款、物品/場景效果（disable-flip、view-hp、modify-all-attack、battle-to-support、trash-to-battle、support-to-hand）、When this Cookie faints（pending faint queue、選特定對手、選 0 略過、候選為空、戰鬥與效果雙來源、AI deterministic）、ST2-021 Pretzel Snare（declaredDamage 4 不出現/5 出現、選 1 目標、選 0 略過、不合法 YY 支付）、通用化物品/場景解析、顏色匹配、回合結束效果引擎（endPhase 標記、雙方順序觸發、一次性防重複、Refresh 暫停與恢復）、ST2-001 Roguefort Cookie opponent-discard-hand（對手棄牌 pending decision、空手直接完成、合法選 1、錯誤玩家/卡/張數拒絕、AI deterministic 選擇、CardDetailModal 顯示技能、OnPlay 發動後對手選牌）、gain-hp 效果（技能與 FLIP 雙路徑、sourceOnly 目標、牌庫不足防護）、isEffectUntargeted 修正（support-to-trash/trash-to-battle/support-to-hand 不再錯誤標記為無目標）、UI 動畫回饋（攻擊抖動、抽牌滑入、傷害閃爍、昏厥縮小）與回合指示器。
- App.tsx 已分階段拆成卡牌展示、BattleRow、PhaseRail、MatchToolbar、狀態面板、效果面板與 modal 元件，規則協調仍留在 App。
- Playwright 種子 1-20 驗證用於確認 AI 對局可正常結束，並額外驗證 break-to-trash 的選 1 與選 0 路徑、合法陷阱顯示、不合法陷阱不顯示回應視窗、FLIP 棄牌手牌切頁與無水平卷軸、補位與略過補位兩條互動路徑、物品/場景合法與不合法使用路徑、ST2-011 Cherry Cookie faint 效果選擇與略過兩路徑，以及 ST2-021 Pretzel Snare 詳情文字、選 1 目標真實操作、選 0 略過真實操作、damage=4 不出現、damage=5 出現；完整瀏覽器驗證前需先執行 `npm run build`。

## 下一步計畫

- 已達成：三色（RED / YELLOW / GREEN）起始牌組切換、App.tsx 元件拆分（卡牌展示、BattleRow、PhaseRail、MatchToolbar、狀態面板、效果面板、modal）；10 張物品與 2 張場景完整支援（disable-flip、view-hp、modify-all-attack、battle-to-support、trash-to-battle、support-to-hand、複合效果暫停與 OnPlay/Refresh/補位銜接、AI deterministic 使用）。
- 已達成：陷阱使攻擊者或目標離場後跳過攻擊傷害；HP 配置途中 Refresh 的登場允許；通用化物品/場景效果解析（disable-flip、view-hp、modify-all-attack、battle-to-support、trash-to-battle、support-to-hand）；When this Cookie faints 事件引擎（pending queue、玩家/AI 雙路徑選擇、選 0 略過、多餅乾同時昏厥依序處理）；顏色匹配與 Mix Cost 已實作；回合結束效果引擎（endPhase 標記、雙方順序觸發、一次性防重複、Refresh 暫停與恢復）。
- 已達成：修復 `isEffectUntargeted` 錯誤標記 `support-to-trash`、`trash-to-battle`、`support-to-hand` 為無目標，避免 AI 與 UI 在這些效果上出錯；擴充 `gain-hp` 效果支援非 FLIP 技能路徑（ST3-001 Muscle Cookie、ST2-004 Macaron Cookie）；新增 UI 動畫回饋（攻擊抖動、抽牌滑入、傷害閃爍、昏厥縮小）與 PhaseRail 回合指示器，提升真人玩家輪流操作體驗。
- 持續補齊官方效果文字到 `CardEffect`，並同步新增規則測試。
- 持續補齊起始牌組以外的複合效果與完整事件優先權。
- 專案指令、驗證範圍或派工策略調整時，同步維護 `develop-braverse` Skill。
- 若官方規則或卡牌資料更新，重新匯入樣本並同步更新文件與測試數字。

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
