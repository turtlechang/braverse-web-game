# 薑餅人對戰卡牌 Braverse

以 React、TypeScript 與 Vite 建立的 Braverse 網頁遊戲原型。

## 開發背景

本專案以官方 Braverse 規則、Starter Deck RED 卡牌資料、官方套餐組合圖片、卡背與能量圖示為基礎，將純函式規則引擎、AI 決策與 React UI 分離。簡易 AI 用於驅動 `player-two` 回合，也可由同一套決策器控制雙方，執行完整對戰模擬與瀏覽器驗證；官方文字標記會先轉換成明確規則語意，再由 UI 顯示對應標籤與素材。

## 目前進度

- 已完成雙方戰場、回合階段、攻擊、Refresh、擊破補位與基本勝負判定。
- 範例對局已依官方圖片使用 22 種、合計 60 張的精確牌組配方，並提供圖片與清單展示。
- 已串接 Skill、Activate、OnPlay、Once per turn、Your Turn 與彩色能量支付。
- 已校正官方標記：`{mob}` 代表 Activate、`{ap}` 代表 OnPlay，並以官方圖片顯示 `{R}`、`{Y}`、`{G}`、`{B}`、`{P}`、`{N}` 能量。
- AI 會依序處理 Refresh、補位、推進階段、配置支援、餅乾登場、技能與攻擊。
- AI 目標選擇採固定策略，並設有單場 500 步與 UI 200 步安全上限。
- UI 會在 `player-two` 回合逐步自動操作，顯示最近一次 AI 行動並鎖定玩家操作。
- 隱藏卡牌已整合官方卡背：優先讀取本機 `card-back.png`，讀取失敗時改用官方網址，兩者皆失敗時顯示 CSS 卡背。
- Playwright 瀏覽器驗證已連續完成 20 場對戰，全部在第 14 回合、113 步正常結束，沒有卡住；每場觸發 1 次技能與 1 次擊破補位，尚未觸發 Refresh。
- 目前共有 72 項單元測試，涵蓋官方牌組張數、官方標記語意、AI 決策、技能支付、Refresh、補位與無限迴圈防護。

## 下一步計畫

- 將固定牌序改為可重現種子的洗牌，避免 20 場驗證得到完全相同結果。
- 建立較長局面的測試牌序，增加技能與 Refresh 在完整對戰中的觸發率。
- 讓玩家攻擊費用也能手動選擇並驗證能量顏色。
- 擴充尚未支援的 FLIP、道具、陷阱與場景效果。
- 增加 AI 難度設定、操作紀錄檢視與錯誤狀態下載。
- 為其他官方 UI 素材補齊本機快取、遠端備援與載入失敗的瀏覽器驗證。
- 補齊 `{K}` 黑色能量與其他官方文字標記的素材及顯示規則。

## 開發

```bash
npm install
npm run dev
```

## 驗證

```bash
npm test
npm run lint
npm run build
```

瀏覽器 AI 驗證：

```bash
npm run build
npm run test:ai:browser
```

若 Playwright 安裝在外部工具目錄，可用 `PLAYWRIGHT_NODE_MODULES` 指定其 `node_modules` 搜尋路徑。報告與截圖輸出至 `test-results/`。
