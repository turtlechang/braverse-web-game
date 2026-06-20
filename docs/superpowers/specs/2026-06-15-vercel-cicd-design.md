# Vercel CI/CD 規格設計

> 日期：2026-06-15
> 狀態：已確認

---

## 1. 目標

- GitHub Pull Request 可自動產生 Vercel Preview 網址，讓 reviewer 直接檢視網頁成品。
- `main` 分支更新時，Vercel 自動部署正式網站。
- GitHub Actions 僅負責 CI 驗證（測試、Linter、建置），**不負責部署**。

## 2. 架構決策

| 決策 | 說明 |
|---|---|
| Vercel Git Integration | 在 Vercel Dashboard 連結 GitHub repo，由 Vercel 自行監聽 push / PR 事件觸發部署 |
| 不在 GitHub Actions 部署 | 不透過 `vercel` CLI 或第三方 Action 執行部署 |
| 不保存 Vercel Token | GitHub Secrets 不存放 Vercel Token，部署憑證完全由 Vercel Git Integration 管理 |
| Vite 建置 | Vercel Framework Preset 選 Vite，Build Output 設為 `dist` |

## 3. GitHub Actions Workflows

### 3.1 `.github/workflows/ci.yml`

**觸發條件：**
- `pull_request`（所有 PR）
- `push` 至 `main`

**權限：** 最小 `read`（`contents: read`）

**步驟：**
1. `actions/checkout@v4`
2. 固定 Node.js 22 版本
3. `npm ci`（確保 lockfile 一致）
4. `npm test`（Vitest 單元測試）
5. `npm run lint`（ESLint）
6. `npm run build`（TypeScript 型別檢查 + Vite 建置）

### 3.2 `.github/workflows/ai-browser-validation.yml`

**觸發條件：** `workflow_dispatch`（手動執行）

**權限：** 最小 `read`（`contents: read`）

**步驟：**
1. `actions/checkout@v4`
2. 固定 Node.js 22 版本
3. `npm ci`
4. `npm run build`（Playwright 驗證前必須先建置）
5. 安裝 Playwright Chromium（`npx playwright install chromium --with-deps`）
6. `npm run test:ai:browser`
7. **失敗時**：上傳 `test-results/` 為 artifact，保留 7 天

## 4. Vercel 設定

| 項目 | 值 |
|---|---|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm ci` |
| Node.js 版本 | Node.js 22 |

## 5. Branch Protection 建議

- `main` 分支設定 Required Status Checks，要求 `ci` workflow 通過。
- 要求 PR 至少 1 人 Review。
- 禁止直接 push 至 `main`。

## 6. 失敗處理

### CI 失敗
- PR 頁面顯示 CI 失敗狀態，合併按鈕被 block。
- 開發者修正後重新 push，CI 自動重跑。

### Vercel Preview 部署失敗
- PR 頁面顯示 Vercel bot 回報的部署失敗訊息。
- 可於 Vercel Dashboard 檢視建置日誌。

### Vercel 正式部署失敗
- Vercel 自動保留上一版成功部署，正式網站不中斷。
- 於 Vercel Dashboard → Deployments 可手動「Promote」上一版回復。

### AI 瀏覽器驗證失敗
- GitHub Actions 保留 `test-results/` artifact 7 天，可下載截圖與報告檢視。
- 此為手動觸發，不 block 任何自動化流程。

## 7. 回復上一部署

- **Vercel 正式網站**：Vercel Dashboard → Deployments → 選取上一版 → Promote to Production。
- **GitHub Actions**：CI 本身無狀態，re-run 即可；若需回復程式碼，使用 `git revert`。

## 8. 安全邊界

| 邊界 | 說明 |
|---|---|
| GitHub Actions 權限 | `contents: read`，不寫入 repo、不發布 |
| Vercel Token | 不出現在 GitHub Secrets 或 Actions 日誌中 |
| Artifact 保留 | test-results 最多 7 天自動清除 |
| 部署憑證 | 僅 Vercel Git Integration 持有，不外洩至 CI |
| 環境變數 | 若未來需 API Key，使用 Vercel Environment Variables，不寫入程式碼 |

## 9. 驗收標準

- [ ] PR 頁面可看到 Vercel Preview 網址，點入可瀏覽遊戲。
- [ ] `main` push 後 Vercel 自動更新正式網站。
- [ ] CI workflow 在 PR 與 push main 時自動執行，通過後才可合併。
- [ ] AI 瀏覽器驗證可手動觸發，失敗時可下載 artifact。
- [ ] GitHub Secrets 中無 Vercel Token。
- [ ] Vercel 建置輸出為 `dist`，頁面正常載入。

## 10. 非目標

- 不在 GitHub Actions 中執行 Vercel 部署。
- 不在 GitHub Secrets 存放 Vercel Token。
- 不設定 Vercel 自訂網域（後續另議）。
- 不實作 Vercel Preview 的環境變數隔離（遊戲目前無後端 API）。
- 不自動觸發 AI 瀏覽器驗證（僅手動 `workflow_dispatch`）。
