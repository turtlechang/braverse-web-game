# BS5+6 競技環境 AI 牌組 Browser 驗證

驗證日期：2026-08-13

## 執行方式

```powershell
npm.cmd run build
npm.cmd run test:bs6:competitive:decks:browser
```

腳本使用正式根路徑 `http://127.0.0.1:4173`，不使用 `test-state`：先將五份競技環境 JSON 載入自訂牌組，從主選單選擇對應 AI preset，完成開局猜拳／調度／起始餅乾，再執行每色 20 場 Browser AI simulation。

## 結果

| 顏色 | AI choice | 開局 | 完成場數 | 卡住 | Browser 錯誤／頁面例外 |
| --- | --- | --- | ---: | ---: | ---: |
| 紅 | `bs6-red-competitive` | PASS | 20/20 | 0 | 0 |
| 黃 | `bs6-yellow-competitive` | PASS | 20/20 | 0 | 0 |
| 綠 | `bs6-green-competitive` | PASS | 20/20 | 0 | 0 |
| 藍 | `bs6-blue-competitive` | PASS | 20/20 | 0 | 0 |
| 紫 | `bs6-purple-competitive` | PASS | 20/20 | 0 | 0 |

完整逐場 JSON 由腳本輸出至 `test-results/bs6-deck-browser-validation.json`；`test-results/` 為本機產物，不提交至 Git。
