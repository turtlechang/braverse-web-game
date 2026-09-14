# 驗證、文件與 Git

驗證決策時讀 [驗證分級](../../braverse-workflow/references/verification-levels.md)，本文件只補充測試設計及文件同步，不維護第二份矩陣或 Git 流程。

## 測試設計

- 測試輸出狀態與公開行為，不綁定不必要的內部實作。
- 保留可重現種子範圍；修正根因，不挑選剛好通過的種子。
- 覆蓋成功、拒絕、邊界及跨回合／Refresh 中斷後續行路徑。
- 測試數量或 Browser 覆蓋變更時，依根目錄 AGENTS 同步文件；歷史結果要能辨識日期及適用狀態。

## 文件同步

- 規則確認：更新 `docs/game-rules.md` 與相關效果文件。
- 卡牌資料格式改變：更新 `docs/card-data-import.md`。
- UI 規格或主要操作改變：更新 `docs/official-ui-reference.md`。
- 功能完成或準備 commit：依根目錄 AGENTS 更新 README 指定章節。
- 長任務沿用現行報告，保留完成／未完成範圍、證據及下一步，不把逐步日誌加到規則文件。

## Git 收尾

以根目錄 `AGENTS.md` 的「Git 與提交流程」為唯一規則來源；需要 stage／commit 時讀 [提交前檢查](../../braverse-workflow/references/pre-commit-review.md)。檢查最終 diff 與狀態，保留無關修改；不自行提交。
