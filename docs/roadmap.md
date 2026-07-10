# Roadmap

最後更新：2026-07-10。歷史完成項見 [CHANGELOG.md](../CHANGELOG.md) 與 [audit-report.md](audit-report.md) §4 的 Phase 對照。

## 已完成里程碑（摘要）

- **規則引擎**：純函式引擎、GameCommand 指令層（8 決策 + 24 動作）、commandLog、replay，具完整遊戲邏輯測試（非永久門檻，待 npm test 確認）。（PR #11 等）
- **牌組編輯器**：搜尋/篩選/合法性檢查/匯入匯出/版本化儲存。（PR #11）
- **AI Lv.1–4**：隨機 / 啟發式 / 評估式 / 兩層前瞻 + matchup 資料驅動評估；20 份 BS2 訓練文件。（PR #12/#13、commit `076e7a5`）
- **卡牌池**：BS1/BS2 + 五色起始牌組匯入；25 張未支援卡效果補齊。（PR #17）
- **UI 多輪重製**：滿版桌墊 HUD、扇形手牌、統一效果 modal、EffectPanel/陷阱/攻擊 modal 改版。（PR #16/#20/#21）
- **線上對戰 MVP**：ws server、房間、遮罩狀態、OnlineBattleView。（Phase 5 分支已進 main）
- **CI**：GitHub Actions test/lint/build + 手動 Playwright 驗證；Vercel Dashboard 已匯入。

## 待辦（依優先序）

### P0 — 授權與公開部署安全 ✅（2026-07-10 完成）

| 項目 | 結果 |
|---|---|
| 網站 footer 非官方聲明 | ✅ 主選單 footer 已加（README 同日補上） |
| PUBLIC_MODE 素材策略 | ✅ 決策：維持官方卡圖熱連結、不做 PUBLIC_MODE，收到異議再處理（[ip-and-asset-policy.md](ip-and-asset-policy.md) §4） |
| LICENSE | ✅ MIT + Devsisters 素材除外條款 |

### P1 — 補齊工程管線（2026-07-10 大部分完成）

| 項目 | 狀態 |
|---|---|
| `validate:cards` | ✅ `scripts/validate-cards.ts`（必填欄位、同檔重複卡號、卡池 311 種全數可轉換 GameCard、效果文字未轉出偵測）；已接入 CI 第一步。首跑即抓到 BS2-061@1 缺 level 的資料缺陷（已修＋匯入腳本加異圖回填） |
| `vercel.json` | ✅ SPA rewrite（assets 除外）；preview URL 可玩性驗收待本支 PR |
| `npm run typecheck` | ✅ `tsc -b && server:typecheck`（app + server 全量型別檢查） |
| Render 部署準備 | ✅ 程式面就緒（`PORT` 支援、`server:start`、冷啟動提示文案）；Dashboard 操作與雙視窗公網驗收待執行（需開 Render 帳號，見 [online-server-hosting.md](online-server-hosting.md) §4） |

### P2 — 維護流程正式化

| 項目 | 內容 | 規模 |
|---|---|---|
| CHANGELOG.md | 從 README 更新日誌表格抽出，建立獨立版本紀錄 | 小 |
| release-process / card-update-process | 新卡牌 11 步流程（匯入→validate→effectId→resolver→測試→AI smoke→UI 檢查→changelog→PR→preview→合併）文件化 | 小 |
| regression / manual-playtest checklist | 併同現有 card-review-checklist 整理 | 小 |

### P3 — 產品深化（觀察後再投入）

| 項目 | 內容 | 前置 |
|---|---|---|
| UI 走指令層 | 攻擊宣告與多段效果精靈改走 `applyGameCommand`，commandLog 成為完整重播來源；支援「複製對局紀錄」回報 | 無，但工程量大 |
| AI Lv.5 | 牌組理解與策略傾向（設計稿見 [ai-levels.md](ai-levels.md)） | 觀察 Lv.3/4 實際體感 |
| Bundle code-split | 主 bundle 847 kB，牌組編輯器/線上對戰為天然切點 | 無，非急迫 |
| UI reference wireframe 文件 | 主計畫 Phase 5 要求的對標分析與 wireframe 文件；2026-07-10 決策：**要做**，以「記錄現行 UI ＋ 標注下一步改進」的混合形式撰寫，與 UI 迭代並行 | 已決策 |
| 拖移卡牌 | 拖放只做輸入層，仍走規則 API（AGENTS.md 已有約束） | UI 穩定後 |
