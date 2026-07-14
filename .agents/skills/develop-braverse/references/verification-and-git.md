# 驗證、文件與 Git

驗證層級以 `../../braverse-workflow/references/verification-levels.md` 為單一真實來源。本文件只補充測試設計、文件同步與 Git 收尾，不再維護第二份驗證矩陣。

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
