# 驗證分級

依變更風險選擇最小但足夠的驗證。不要為小型文件變更跑完整 Playwright；也不要用 demo 狀態宣稱正式流程完成。

| 變更類型 | 必要驗證 |
|---|---|
| 文件、Skill、AGENTS、README | `git diff --check`、檢查 diff；新增或更新 Skill 時執行 skill validation（若工具可用） |
| 純 UI 樣式 | `npm run lint`、`npm run build`，並以瀏覽器或截圖檢查受影響畫面 |
| 一般 TypeScript / React | 相關測試、`npm run lint`、`npm run build` |
| 規則、卡牌效果、能量或時機 | 新增或更新回歸測試、`npm test`、`npm run lint`、`npm run build` |
| AI 或完整對戰 | 上述全部，加上對應 AI 種子驗證；必要時執行 `npm run test:ai:browser` |
| UI 互動或付款流程 | 相關單元測試、lint、build，並用瀏覽器驗證合法與不合法路徑 |
| Git review / pre-commit | `git status --short --branch`、`git diff --check`、完整 diff 檢查、確認無關檔案未 stage |

## Playwright 注意事項

- Playwright 前必須先執行 `npm run build`。
- 若 Playwright 安裝於外部目錄，以 `PLAYWRIGHT_NODE_MODULES` 指定其 `node_modules`。
- 完整 `npm run test:ai:browser` 目前有既有版面基線限制：1920x1080 玩家手牌覆蓋支援區斷言會失敗，且已在未修改基線重現。修正版面前不得宣稱完整 Playwright 全綠。
- 測試總數或瀏覽器驗證範圍改變時，同步更新 `AGENTS.md` 與 `README.md`。
