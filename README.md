# 薑餅人對戰卡牌 Braverse

以 React、TypeScript 與 Vite 建置的 CookieRun: Braverse 網頁遊戲原型。

## 開發背景

本專案以官方 Braverse 規則、官方起始牌組卡牌資料、卡背與能量圖示為基礎，將純函式規則引擎、AI 決策與 React UI 分離。規則引擎集中於 `src/game/`，官方卡牌資料轉接集中於 `src/cards/`，React 畫面只呼叫規則層公開 API，不另寫權威規則。

官方範例卡目前優先使用 `category_title` / `card_product_title` 為 `Starter Deck YELLOW` 的黃色起始牌組資料；原有 `Starter Deck RED` 資料保留為紅色起始牌組。兩套資料都可建立 60 張牌組，並以官方 JSON 的卡號、名稱、類型、攻擊文字、效果文字與圖片 URL 轉成 runtime `GameCard`。

## 目前進度

- 已建立紅色起始牌組：22 種卡號，合計 60 張。
- 已建立黃色起始牌組：20 種卡號，合計 60 張；官方清單未包含 `ST2-017`。
- 已加入黃色起始牌組官方樣本檔：`data/cards/official-starter-deck-yellow.en.json`。
- 已新增明確 API：`createOfficialRedStarterDeck`、`createOfficialYellowStarterDeck`、`OFFICIAL_RED_STARTER_DECK`、`OFFICIAL_YELLOW_STARTER_DECK`。
- `createOfficialStarterDeck` 與 `OFFICIAL_STARTER_DECK_RED` 仍保留為紅色起始牌組相容別名。
- 單元測試涵蓋官方範例卡轉換、紅色與黃色起始牌組張數、配方數量、種子洗牌重現性、AI 決策、Refresh 與能量付款等流程。
- Playwright 種子 1-20 驗證用於確認 AI 對局可正常結束，完整瀏覽器驗證前需先執行 `npm run build`。

## 下一步計畫

- 將 UI 的牌組清單切換擴充為紅色／黃色起始牌組可選。
- 持續補齊官方效果文字到 `CardEffect`，並同步新增規則測試。
- 釐清尚未完全支援的 FLIP、陷阱與條件式效果時機。
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
```

`cards:import:sample` 目前預設匯入黃色起始牌組；紅色與黃色也可使用明確腳本重新產生。
