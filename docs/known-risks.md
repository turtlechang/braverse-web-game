# 已知風險清單（Known Risks）

最後更新：2026-07-12。編號固定（R1…），供其他文件引用；解除後標記「已解除」而非刪除。

| # | 風險 | 等級 | 現況與緩解 |
|---|---|---|---|
| R1 | **官方素材公開部署**：卡圖熱連結 `cookierunbraverse.com`、卡背/能量圖示在 `public/`；專案已接上 Vercel，公開網址即公開展示官方 IP | 中（已決策接受） | README 與主選單 footer 已加非官方聲明（2026-07-10）；使用者決策：維持熱連結、不做 PUBLIC_MODE，收到異議再處理（ip-and-asset-policy §4）。熱連結另有官方改版失效風險（見 R8） |
| R2 | ~~無 LICENSE~~ **已解除**（2026-07-10）：已加 MIT + Devsisters 素材除外條款的 LICENSE | — | 見 [LICENSE](../LICENSE) 與 ip-and-asset-policy §5 |
| R3 | ~~部分 AI 路徑仍手動補記 commandLog~~ **已解決**（2026-07-12）：`ai.ts`、`ai/battle-handler.ts`、`ai/turn-handler.ts`、`ai/random-turn-handler.ts` 全面改走 `applyGameCommand` | — | `play-item`／`activate-skill`／`activate-stage` 使用共用 `simulateAbilityEffects` 補齊 `effectTargets`，AI `refresh-deck` 將種子寫入 command payload；`ai-replay-fidelity.test.ts` 與 Refresh 回歸測試驗證 commandLog 可重播相同終局與牌序。 |
| R4 | ~~卡牌資料無獨立驗證~~ **已解決**（2026-07-10）：`npm run validate:cards`（`scripts/validate-cards.ts`）已存在並接入 CI（`.github/workflows/ci.yml`），檢查必填欄位、同檔重複卡號、全卡池可轉換 `GameCard`、效果文字未轉出偵測；候選卡牌另有 `validate:candidate` | 低 | PR #17 曾以一次性稽核腳本找出 25 張 unsupported 卡，證明需要常態化工具，已建置為 CI 第一步 |
| R5 | **效果文字解析的規則裁定風險**：官方文字→CardEffect 轉換含專案自行裁定（記錄於 rule-clarifications.md）；官方新版規則可能推翻 | 中 | 裁定集中記錄；不得將待確認規則寫成已完成（AGENTS.md）。官方更新時重新匯入＋覆核 |
| R6 | **Vercel 不承載 ws server**：線上對戰伺服器（`server/`）需長連線，Vercel serverless 不適合 | 中（已部署但含免費層冷啟動風險） | 已於 2026-07-11 部署 Render 免費層（commit a679f03）並完成雙視窗公網對局驗收。免費層閒置 15 分鐘後休眠會切斷連線，首次連線冷啟動約需 50 秒以上；活躍對局期間 ws 訊息可維持喚醒 |
| R7 | **線上對戰無防作弊完整方案**：MVP 僅靠伺服器權威狀態＋`masked-state` 視角遮罩；斷線重連、逾時判負未完備 | 低（範圍內） | 主計畫明訂不做完整防作弊；規則驗證在伺服器端執行，非法操作擋下即符合驗收 |
| R8 | **官方資料來源脆弱**：匯入腳本依賴官方 API/網站結構；卡圖熱連結若官方改版即整站缺圖 | 中（部分緩解） | 匯入樣本已入 repo（資料不會消失）；缺圖 fallback **已存在**（`CardVisuals.tsx` 的 `.card-fallback`／`.card-back-fallback`，`onError` 時改顯示卡名/類型/等級/HP 文字卡），本輪確認；圖像快取策略仍待做（與 R1 的 PUBLIC_MODE 一併決策） |
| R9 | **主 bundle 大小**（~731 kB raw / ~152 kB gzip） | 低（已設 budget） | CI `check:bundle` 上限 raw 850 KiB / gzip 180 KiB；code-split 已完成（牌組編輯器、測試情境、線上對戰 modal、戰鬥資訊 modal 群組按需載入），主 bundle 已從 847 kB 降至 ~731 kB（2026-07-11） |
| R10 | **AI 自動結算繞過人類防守**（歷史回歸點）：AI 攻擊若用 `attack` 指令會自動結算、跳過陷阱/FLIP 回應 | 已緩解 | 2026-07-07 已修：Lv.1/3/4 改走 `applyChosenTurnCommand` → `beginAttack`。新增 AI 等級時必須遵守（architecture.md §5） |
| R11 | **單人維護 + 無 branch protection**：main 可直接 push；CI 綠燈非合併門檻 | 低（接受） | 使用者明確決策不啟用 branch protection；以 PR 工作流自律 + CI 通知 |
| R12 | ~~README 過載~~ **已解決**（2026-07-11）：README 由 182 行縮減至約 80 行 | — | 先前 P2「CHANGELOG 抽出」只建立了 CHANGELOG.md，但 README 自己的「📝 更新日誌」表格從未真正移除，且與 CHANGELOG.md 內容分岔（9 筆歷史紀錄只存在 README，從未同步）；本輪重新審視 known-risks 時發現此落差，已將分岔的紀錄併入 CHANGELOG.md、移除 README 重複表格，「目前進度」／「下一步計畫」改為短摘要 + 指向 docs/architecture.md／docs/roadmap.md／docs/known-risks.md 的連結 |
| R13 | **WebSocket 伺服器入站訊息只有型別 cast**：`ConnectionManager` 能忽略壞 JSON，但尚未驗證合法 JSON 的 envelope；例如 `null` 可能在讀取 `message.type` 時拋錯 | 高（待處理） | 用戶端已加入伺服器訊息 envelope 與 GameState 外框驗證；下一批須在共用協定層加入 ClientMessage 執行期驗證，讓所有畸形輸入安全拒絕且不影響程序 |
| R14 | **線上對戰指令拒絕尚未顯示於戰場**：hook 已收到 `command-rejected`，但 `OnlineBattleView` 未呈現該訊息 | 中（待處理） | 伺服器仍會拒絕非法指令，不會污染權威狀態；下一批將錯誤傳入戰場 UI，並補可見性與清除時機回歸 |
