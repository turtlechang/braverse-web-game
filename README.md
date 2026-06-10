# 薑餅人對戰卡牌 Braverse

以 React、TypeScript 與 Vite 建置的 CookieRun: Braverse 網頁遊戲原型。

## 開發背景

本專案以官方 Braverse 規則、官方起始牌組卡牌資料、卡背與能量圖示為基礎，將純函式規則引擎、AI 決策與 React UI 分離。規則引擎集中於 `src/game/`，官方卡牌資料轉接集中於 `src/cards/`，React 畫面只呼叫規則層公開 API，不另寫權威規則。

官方範例卡目前優先使用 `category_title` / `card_product_title` 為 `Starter Deck GREEN` 的綠色起始牌組資料；原有 `Starter Deck RED` 與 `Starter Deck YELLOW` 資料保留為紅色、黃色起始牌組。三套資料都可建立 60 張牌組，並以官方 JSON 的卡號、名稱、類型、攻擊文字、效果文字與圖片 URL 轉成 runtime `GameCard`。

## 目前進度

- 已建立紅色起始牌組：22 種卡號，合計 60 張。
- 已建立黃色起始牌組：20 種卡號，合計 60 張；官方清單未包含 `ST2-017`。
- 已建立綠色起始牌組：22 種卡號，合計 60 張。
- 已加入黃色起始牌組官方樣本檔：`data/cards/official-starter-deck-yellow.en.json`。
- 已加入綠色起始牌組官方樣本檔：`data/cards/official-starter-deck-green.en.json`。
- 已新增明確 API：`createOfficialRedStarterDeck`、`createOfficialYellowStarterDeck`、`createOfficialGreenStarterDeck`、`OFFICIAL_RED_STARTER_DECK`、`OFFICIAL_YELLOW_STARTER_DECK`、`OFFICIAL_GREEN_STARTER_DECK`。
- `createOfficialStarterDeck` 與 `OFFICIAL_STARTER_DECK_RED` 仍保留為紅色起始牌組相容別名。
- `ST3-010 Aloe Cookie` 的 deck-to-support 效果已完整支援：從牌庫頂取牌直立放入支援區、牌庫歸零觸發 Refresh、無候選敗北。
- FLIP 與 TRAP 以官方欄位驅動：`card_type=FLIP` 解析 `card_flip`，`card_type=TRAP` 解析 `card_attack_text`，不依卡號硬編碼。
- 紅、黃、綠起始牌組的 FLIP 已支援棄手牌增加 HP、抽牌與逐張傷害暫停；TRAP 已支援攻擊回應、能量支付、攻擊降低、條件傷害、HP 下限、支援棄置及牌庫頂放入休息支援。
- 新對局會隨機洗牌，並依序進行猜拳、先後攻、自由／強制調度、補償抽牌與起始餅乾配置。
- UI 已加入雙方正面棄牌卡堆與清單、戰鬥區 HP 卡展開、付款橫置預覽及 PhaseRail 內嵌 AI 狀態。
- 已加入 `scripts/opencode-go.cmd` 與專案模型設定，使用獨立 runtime 目錄及 `OPENCODE_GO_API_KEY` 環境變數進行派工，不提交認證資料。
- UI 可分別設定玩家與 AI 使用紅色、黃色或綠色起始牌組，重新開始與 AI 種子驗證會沿用目前選擇。
- 目前共有 204 項單元測試，涵蓋官方範例卡轉換、三色起始牌組、FLIP／TRAP 官方文字轉換、官方標記與卡片詳情排版、逐張 HP、陷阱傷害續行與延後條件、跨回合 OnPlay 登場窗口、調度、種子洗牌、AI、Refresh、能量付款及既有效果回歸。
- App.tsx 已分階段拆成卡牌展示、BattleRow、PhaseRail、MatchToolbar、狀態面板、效果面板與 modal 元件，規則協調仍留在 App。
- Playwright 種子 1-20 驗證用於確認 AI 對局可正常結束，並額外驗證 break-to-trash 的選 1 與選 0 路徑，以及合法陷阱顯示、不合法陷阱不顯示回應視窗；完整瀏覽器驗證前需先執行 `npm run build`。

## 下一步計畫

- 已達成：三色（RED / YELLOW / GREEN）起始牌組切換、App.tsx 元件拆分（卡牌展示、BattleRow、PhaseRail、MatchToolbar、狀態面板、效果面板、modal）。
- 持續補齊官方效果文字到 `CardEffect`，並同步新增規則測試。
- 持續補齊起始牌組以外的複合效果、When this Cookie faints、Stage 放置與完整事件優先權。
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
