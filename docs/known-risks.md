# 已知風險清單（Known Risks）

最後更新：2026-07-11。編號固定（R1…），供其他文件引用；解除後標記「已解除」而非刪除。

| # | 風險 | 等級 | 現況與緩解 |
|---|---|---|---|
| R1 | **官方素材公開部署**：卡圖熱連結 `cookierunbraverse.com`、卡背/能量圖示在 `public/`；專案已接上 Vercel，公開網址即公開展示官方 IP | 中（已決策接受） | README 與主選單 footer 已加非官方聲明（2026-07-10）；使用者決策：維持熱連結、不做 PUBLIC_MODE，收到異議再處理（ip-and-asset-policy §4）。熱連結另有官方改版失效風險（見 R8） |
| R2 | ~~無 LICENSE~~ **已解除**（2026-07-10）：已加 MIT + Devsisters 素材除外條款的 LICENSE | — | 見 [LICENSE](../LICENSE) 與 ip-and-asset-policy §5 |
| R3 | **部分 AI 路徑仍手動補記 commandLog**：玩家 UI 與 `usePendingEffect` 已走 `applyGameCommand`，但 `ai.ts` 與部分 battle／turn handler 仍直接呼叫規則函式後使用 `appendCommandLogEntry` | 中（部分緩解） | 2026-07-11 已完成 UI 補位排程：`applyGameCommand` 在 blocking pending 結束後執行 `finalizePendingReplacements`，多段效果與 replay 回歸測試已補齊。後續將 AI 手動補記路徑逐步改為 typed command |
| R4 | **卡牌資料無獨立驗證**：缺 `validate:cards`；資料錯誤（缺欄位、重複 id、effectId 無 resolver）只能靠轉接層測試與人工發現 | 中 | PR #17 曾以一次性稽核腳本找出 25 張 unsupported 卡，證明需要常態化工具。列 roadmap P1 |
| R5 | **效果文字解析的規則裁定風險**：官方文字→CardEffect 轉換含專案自行裁定（記錄於 rule-clarifications.md）；官方新版規則可能推翻 | 中 | 裁定集中記錄；不得將待確認規則寫成已完成（AGENTS.md）。官方更新時重新匯入＋覆核 |
| R6 | **Vercel 不承載 ws server**：線上對戰伺服器（`server/`）需長連線，Vercel serverless 不適合 | 中（已部署但含免費層冷啟動風險） | 已於 2026-07-11 部署 Render 免費層（commit a679f03）並完成雙視窗公網對局驗收。免費層閒置 15 分鐘後休眠會切斷連線，首次連線冷啟動約需 50 秒以上；活躍對局期間 ws 訊息可維持喚醒 |
| R7 | **線上對戰無防作弊完整方案**：MVP 僅靠伺服器權威狀態＋`masked-state` 視角遮罩；斷線重連、逾時判負未完備 | 低（範圍內） | 主計畫明訂不做完整防作弊；規則驗證在伺服器端執行，非法操作擋下即符合驗收 |
| R8 | **官方資料來源脆弱**：匯入腳本依賴官方 API/網站結構；卡圖熱連結若官方改版即整站缺圖 | 中 | 匯入樣本已入 repo（資料不會消失）；缺圖 fallback 與圖像快取策略待做（與 R1 的 PUBLIC_MODE 一併決策） |
| R9 | **主 bundle 大小**（~807 kB raw / ~167 kB gzip） | 低（已設 budget） | CI `check:bundle` 上限 raw 850 KiB / gzip 180 KiB；code-split 已完成（牌組編輯器、測試情境、線上對戰 modal 按需載入），主 bundle 已從 847 kB 降至 ~807 kB |
| R10 | **AI 自動結算繞過人類防守**（歷史回歸點）：AI 攻擊若用 `attack` 指令會自動結算、跳過陷阱/FLIP 回應 | 已緩解 | 2026-07-07 已修：Lv.1/3/4 改走 `applyChosenTurnCommand` → `beginAttack`。新增 AI 等級時必須遵守（architecture.md §5） |
| R11 | **單人維護 + 無 branch protection**：main 可直接 push；CI 綠燈非合併門檻 | 低（接受） | 使用者明確決策不啟用 branch protection；以 PR 工作流自律 + CI 通知 |
| R12 | **README 過載**：進度、驗證數字、歷史決策全堆在 README（150+ 行），數字（如測試數）易過時 | 低 | 本輪已建 docs/ 分流（audit / architecture / roadmap）；後續更新日誌抽 CHANGELOG（roadmap P2） |
