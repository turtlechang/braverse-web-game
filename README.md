# 薑餅人對戰卡牌 Braverse

以 React、TypeScript 與 Vite 建置的 CookieRun: Braverse 網頁遊戲原型。

> **非官方聲明**：本專案為 CookieRun: Braverse 的**非官方粉絲研究 / 學習型實作**，與 Devsisters Corporation 沒有任何合作、授權或背書關係。CookieRun: Braverse 及其卡牌、插畫、標誌之著作權與商標權均屬 Devsisters 及其授權方所有。本專案不商用、不收費；素材使用政策見 [docs/ip-and-asset-policy.md](docs/ip-and-asset-policy.md)。

## 開發背景

本專案以官方 Braverse 規則、官方起始牌組卡牌資料、卡背與能量圖示為基礎，將純函式規則引擎、AI 決策與 React UI 分離。規則引擎集中於 `src/game/`，官方卡牌資料轉接集中於 `src/cards/`，React 畫面只呼叫規則層公開 API，不另寫權威規則。

目前以《綜合規則》Ver.1.2、《CRB 遊戲指南》240812 更新版、《CRB 說明書 P1》及《裁判指南》作為規則文件基線；專案裁定與仍待新版官方資料覆核的項目記錄於 [docs/rule-clarifications.md](docs/rule-clarifications.md)。

專案開發流程已整理為 `.agents/skills/develop-braverse` 與 `.agents/skills/braverse-workflow` 兩個 Skill，統一需求分析、規則查核、架構邊界、測試驗證、文件同步、派工與 Git 收尾步驟；`AGENTS.md` 保留硬性規範入口。子代理協作與停滯交接流程見 [docs/subagent-stall-handoff-protocol.md](docs/subagent-stall-handoff-protocol.md)。

CI/CD 採 GitHub Actions + Vercel Git Integration：GitHub Actions 執行卡牌驗證、測試、lint、build；AI、牌組編輯器與好友房 Playwright 瀏覽器 smoke 在 main push 自動執行，也保留手動觸發，不負責部署；Vercel 監聽 PR 與 push 自動產生 Preview 與正式部署，連線設定在 Vercel Dashboard 完成，不存放於 GitHub Secrets。

好友房 V1 不做自動重連；前端只保留單一有效 WebSocket，容許 Render 最長 90 秒冷啟動，連線後 10 秒內未收到伺服器回應或中途斷線時會明確結束並顯示錯誤，不讓畫面永久停在「連線中」。

## 目前進度

完整技術細節見 [docs/architecture.md](docs/architecture.md)（分層架構、規則引擎模組、AI 分級）與 [docs/audit-report.md](docs/audit-report.md)（逐 Phase 完成度盤點）。摘要：

- **規則引擎**：`src/game/` 純函式引擎，五色 + 第二彈官方起始牌組、typed `GameCommand` 指令層（8 決策 + 24 動作）、`commandLog` + replay（含 AI 對局重播）；多段能力效果不得繞過中途決策，已有 8 類決策回歸。
- **牌組編輯器**：搜尋/篩選、合法性即時檢查（60 張／同卡 4 張／≥1 餅乾／FLIP ≤16）、匯入匯出、版本化 localStorage 儲存。`@1` 卡面變體（如 `BS2-031@1`）與其 base（`BS2-031`）視為同一張卡共用 4 張上限，輸入／匯入時自動正規化為 base；卡池列表僅顯示 base，原始變體資料保留在 `data/cards/*.json` 並可透過 `getCardPoolVariants` 取得。
- **AI**：Lv.1–4 已完成（隨機／啟發式／評估式／兩層前瞻），只讀 `PlayerView` 保證資訊邊界；Lv.5 為設計稿，見 [docs/ai-levels.md](docs/ai-levels.md)。
- **卡牌池**：BS1/BS2 官方卡池 + 五色起始牌組匯入；`npm run validate:cards` 接入 CI 做資料完整性驗證。
- **UI**：滿版桌墊 HUD、扇形手牌、統一效果 modal、響應式（最低支援 600×338）；`App.tsx` 協調邏輯已拆至多個自訂 hooks。
- **線上對戰**：WebSocket server（Render 部署）+ 房間碼 + 遮罩狀態，已完成雙視窗公網對局驗收；本機雙瀏覽器另自動驗證建房、加入、開局、階段同步、對手離線與伺服器無法連線的可恢復錯誤路徑。
- **CI/CD**：GitHub Actions（卡牌／候選／registry 驗證 → test → lint → build → bundle budget；main push 另跑 AI／牌組編輯器／好友房瀏覽器 smoke）+ Vercel Git Integration 自動部署。

測試基線、bundle 大小等會隨每次 PR 變動的數字，一律以 [CHANGELOG.md](CHANGELOG.md) 最新項目為準（非永久門檻，只要求不低於前次基線）。

## 下一步計畫

待辦事項與優先序統一維護於 [docs/roadmap.md](docs/roadmap.md)（依 P0–P3 分類，含每項的完成狀態與前置條件）；近期先補伺服器端 WebSocket 入站訊息的執行期驗證與對戰中指令拒絕提示，再完成 1–2 場真人試玩回報，以及 main push 後的 GitHub Actions／Vercel／Render 健康稽核。已知風險與緩解狀態見 [docs/known-risks.md](docs/known-risks.md)。

## 開發指令

| 指令 | 用途 |
|---|---|
| `npm install` | 安裝相依套件 |
| `npm run dev` | 啟動開發伺服器（Vite HMR） |
| `npm run check:bundle` | 檢查 dist/assets/index-*.js 的 raw/gzip bundle budget，預設上限 850/180 KiB，執行前需先 `npm run build` |

## 驗證指令

```bash
npm run validate:cards
npm run validate:candidate
npm run generate:card-pool
npm run check:card-pool
npm test
npm run lint
npm run typecheck
npm run build
```

`validate:cards` 檢查 `data/cards/*.json` 的必填欄位、同檔重複卡號、全卡池可轉換為 `GameCard` 與效果文字未轉出偵測；CI 會在測試前先執行。`validate:candidate` 檢查 `data/candidates/*.json` 的候選卡牌資料，包含 schemaVersion、source 結構、欄位型別、卡牌轉換與正式卡池跨檔重複檢查。`generate:card-pool` 重新生成 `src/game/generated-card-pool.ts`（promote 後會自動執行）。`typecheck` 對 app 與 server 做全量型別檢查（`tsc -b` + server tsconfig）。

瀏覽器驗證（皆需先 `npm run build`）：

```bash
npm run test:ai:browser      # AI 對局多解析度 smoke test
npm run test:deck:browser    # 牌組編輯器匯入／儲存與 RWD smoke test
npm run test:blue:browser    # 藍牌效果使用/付款/目標/決策流程
npm run test:online:browser  # 線上對戰 modal 桌機／窄視窗驗證
npm run test:online:match:browser # 本機雙瀏覽器好友房同步、斷線與連線失敗驗證
```

若 Playwright 安裝於外部目錄，可用 `PLAYWRIGHT_NODE_MODULES` 指定其 `node_modules` 路徑。測試報告與截圖會輸出到 `test-results/`，不得提交。詳細驗證分級（L1/L2/L3）見 [docs/loop-engineering.md](docs/loop-engineering.md)。

## 卡牌資料匯入

```bash
npm run cards:import:sample
npm run cards:import:red-sample
npm run cards:import:yellow-sample
npm run cards:import:green-sample
npm run cards:import:blue-sample
npm run cards:import:purple-sample
```

`cards:import:sample` 目前預設匯入綠色起始牌組；紅色、黃色、綠色、藍色與紫色也可使用明確腳本重新產生。新卡牌／新彈的完整匯入流程見 [docs/card-update-process.md](docs/card-update-process.md)。

## 變更記錄

完整變更記錄見 [CHANGELOG.md](CHANGELOG.md)；發布與 PR 流程見 [docs/release-process.md](docs/release-process.md)。
