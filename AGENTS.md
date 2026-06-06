# Braverse Project Guidance

## Language

- 預設使用正體中文與台灣常用詞彙。

## Development

- 使用 React、TypeScript 與 Vite。
- 執行 `npm run dev` 啟動開發伺服器。
- 執行 `npm run build` 進行型別檢查與正式建置。
- 執行 `npm run lint` 檢查程式碼品質。

## Engineering

- 將遊戲規則引擎與 React UI 分離。
- 規則判定應以純函式與明確型別實作，避免由畫面元件直接修改遊戲狀態。
- 修改規則時同步新增或更新測試。
- 不要提交 `node_modules`、建置產物或密鑰。

