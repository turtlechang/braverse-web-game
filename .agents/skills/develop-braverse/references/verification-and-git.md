# 驗證、文件與 Git

## 驗證矩陣

| 變更類型 | 必要驗證 |
|---|---|
| 文件或註解 | 檢查 diff；視影響執行 lint/build |
| 純 UI 樣式 | `npm run lint`、`npm run build`，並實際檢查畫面 |
| 一般 TypeScript／React | 相關測試、`npm run lint`、`npm run build` |
| 規則、卡牌效果、能量或時機 | 新增回歸測試、`npm test`、lint、build |
| AI 或完整對戰 | 上述全部，加上 `npm run test:ai:browser` |
| UI 互動或付款 | 上述相關測試，加上瀏覽器合法與不合法兩條路徑 |

Playwright 前必須先執行 `npm run build`。若 Playwright 在外部目錄，使用 `PLAYWRIGHT_NODE_MODULES` 指向其 `node_modules`。

## 測試原則

- 測試輸出狀態與公開行為，不綁定不必要的內部實作。
- 保留可重現種子範圍；失敗時修正根因，不挑選剛好通過的種子。
- 覆蓋成功、拒絕、邊界及跨回合／Refresh 中斷後續行路徑。
- 測試總數或瀏覽器覆蓋範圍變更時，同步更新 `AGENTS.md` 與 `README.md`。
- `test-results/` 僅供本機驗證，不得提交。

## 文件同步

- 規則確認：更新 `docs/game-rules.md` 與相關效果文件。
- 卡牌資料格式改變：更新 `docs/card-data-import.md`。
- UI 規格或主要操作改變：更新 `docs/official-ui-reference.md`。
- 完成功能或準備 commit：更新 README 的開發背景、目前進度、下一步計畫。

## Git 流程

1. 開始時執行 `git status --short --branch`。
2. 乾淨工作區執行 `git pull --ff-only`；有修改則用 `git fetch` 檢查遠端。
3. 收尾時執行 `git diff --check`、檢查完整 diff 與狀態。
4. 只 stage 本次任務檔案。
5. 不提交 `node_modules/`、`dist/`、`test-results/`、密鑰或認證資料。
6. commit 訊息使用英文；未獲要求時不自行 commit。
