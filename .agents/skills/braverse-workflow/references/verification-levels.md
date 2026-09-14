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
- 舊版文件（最後修改於 2026-07-14）記載 20 場完成、`stuck=0`，但未附對應 HEAD／完整執行證據；僅作歷史線索，不能當成本次驗證。根目錄 AGENTS 記載的 1920×1080 限制仍須以目前版本實測確認，不得以挑選種子掩蓋失敗。
- 好友房核心流程使用 `npm run test:online:match:browser`，以兩個隔離瀏覽器連接本機權威 WebSocket server，驗證建房、加入、開局手牌預覽與起始餅乾選擇、雙方對戰動態與完整紀錄、支援→主要→結束階段同步、卡牌詳情可關閉、伺服器拒絕不合法指令的戰場提示與斷線提示；它不等同於自動打完整場至勝負。
- 測試總數或瀏覽器驗證範圍改變時，同步更新 `AGENTS.md` 與 `README.md`。

## 證據與重跑

- 每批對最終修改狀態記錄命令、cwd／必要環境、HEAD 及未提交差異範圍、結束碼、實際摘要與報告位置。
- Bug 修復先取得失敗案例或可重現證據，再改實作並重跑；預期值依規格，不照抄實作。無法先取得失敗案例時說明原因及替代證據。
- 後續修改只重跑受影響檢查；沿用結果須指出檔案、依賴及測試環境為何仍適用，不能僅因曾經通過就沿用。
- 規則、AI、線上協議、隱藏資訊及跨模組契約要核對整合風險。上表沒有免除根目錄的強制門檻，提交前仍依根目錄最低測試／lint／build 要求。
- 不刪測試、不放寬 assertion、不隱藏錯誤或為通過直接更新 snapshot。區分產品缺陷、測試失敗、環境阻塞及未驗證。
- 工具成功不等於功能完成，靜態檢查不等於 Browser 驗收；demo／test-state 與正式資料、正式狀態、線上同步證據分開回報。
- 完成所需驗證後停止；新變更、失敗或未解風險才構成追加驗證理由。本文件沿用現有「變更類型」矩陣，不另設 L1／L2／L3。

## Skill 與工作流驗證

修改 Skill 時，在目前 Windows 環境使用既有 validator：

```powershell
python -B -X utf8 C:\Users\WH3FTURTLE\.codex\skills\.system\skill-creator\scripts\quick_validate.py <skill-directory>
```

先確認可用 Python 與 validator 路徑；若缺少 yaml 或工具，標示環境阻塞，不自行安裝或回報通過。這只驗證 frontmatter／名稱等結構；另檢查觸發邊界、必要規則未遺失、相對引用與命令路徑。

規則變更需要行為驗證時，在已核准的隔離環境與預算內實跑小任務、探索停止、失敗到通過及受阻誠實回報；全域規則另驗證非 Braverse 案例。新會話的實際載入證據與本會話手動讀檔分開，不能用口頭模擬或單純複述宣稱生效。沒有真實用量就標示成本未量測。
