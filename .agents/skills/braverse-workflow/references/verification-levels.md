# 驗證分級

依變更風險選擇最小但足夠的驗證。不要為小型文件變更跑完整 Playwright；也不要用 demo 狀態宣稱正式流程完成。本文件是 Braverse 驗證層級的單一真實來源。

| 變更類型 | 必要驗證 |
|---|---|
| 文件、Skill、AGENTS、README | `git diff --check`、檢查完整 diff；新增或更新 Skill 時執行 `quick_validate.py` |
| 純 UI 樣式 | `npm run lint`、`npm run build`，並以瀏覽器或截圖檢查受影響畫面 |
| 一般 TypeScript / React | 相關測試、`npm run lint`、`npm run build` |
| 規則、卡牌效果、能量或時機 | 新增或更新回歸測試、`npm test`、`npm run lint`、`npm run build` |
| AI 或完整對戰 | 上述全部，加上對應 AI 種子驗證與 `npm run test:ai:browser` |
| UI 互動或付款流程 | 相關單元測試、lint、build，並用瀏覽器驗證合法與不合法路徑 |
| Git review / pre-commit | `git status --short --branch`、`git diff --check`、完整 diff 檢查、確認無關檔案未 stage |

## Playwright 注意事項

- Playwright 前必須先執行 `npm run build`。
- 若 Playwright 安裝於外部目錄，以 `PLAYWRIGHT_NODE_MODULES` 指定其 `node_modules`。
- `npm run test:ai:browser` 目前基線為 20 場完成、`stuck=0`；不得以挑選種子掩蓋失敗。
- 好友房核心流程使用 `npm run test:online:match:browser`，以兩個隔離瀏覽器連接本機權威 WebSocket server，驗證建房、加入、開局手牌預覽與起始餅乾選擇、雙方對戰動態與完整紀錄、支援→主要→結束階段同步、卡牌詳情可關閉、伺服器拒絕不合法指令的戰場提示與斷線提示；它不等同於自動打完整場至勝負。
- 測試總數或瀏覽器驗證範圍改變時，同步更新 `AGENTS.md` 與 `README.md`。
