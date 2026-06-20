# Vercel CI/CD 實作計畫

> 日期：2026-06-15
> 規格：`docs/superpowers/specs/2026-06-15-vercel-cicd-design.md`
> 狀態：待執行

---

## REQUIRED SUB-SKILL

`develop-braverse` — 依 Braverse 專案規範執行 Git 收尾與文件同步。

---

## 前置條件

- 工作區為 dirty worktree，存在未提交變更。
- 本計畫**不假設可直接 commit**；所有 commit 步驟僅在使用者明確要求時執行，且只 stage 本任務檔案。
- 本計畫僅新增兩個 workflow 檔案並修改 README.md，清單如下：
  1. `.github/workflows/ci.yml`
  2. `.github/workflows/ai-browser-validation.yml`
  3. `README.md`（更新開發背景、目前進度、下一步計畫三個段落）

---

## 步驟 1：建立 `.github/workflows/ci.yml`

### 動作

新增檔案 `.github/workflows/ci.yml`，完整內容如下：

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  ci:
    name: Test, Lint & Build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test

      - name: Run ESLint
        run: npm run lint

      - name: Build project
        run: npm run build
```

### 設計說明

| 項目 | 值 | 依據 |
|---|---|---|
| 觸發 | `pull_request`（所有 PR）+ `push` 至 `main` | 規格 §3.1 |
| 權限 | `contents: read` | 規格 §3.1、§8 安全邊界 |
| Node.js | 22（固定 major） | 規格 §3.1 |
| npm cache | `actions/setup-node@v4` 內建 `cache: npm` | 加速重複 CI |
| 安裝 | `npm ci`（lockfile 嚴格一致） | 規格 §3.1 |
| 建置產物 | 不保存（CI 不需要部署） | 規格 §2 不在 Actions 部署 |

### 本機驗證

```powershell
# 確認 YAML 關鍵結構存在；真正 GitHub workflow 語法需 push/PR 後由 GitHub 解析驗證
Get-Content .github/workflows/ci.yml | Select-String "^(name|on|permissions|jobs):"
```

預期輸出：

```
name: CI
on:
permissions:
jobs:
```

---

## 步驟 2：建立 `.github/workflows/ai-browser-validation.yml`

### 動作

新增檔案 `.github/workflows/ai-browser-validation.yml`，完整內容如下：

```yaml
name: AI Browser Validation

on:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  ai-browser-validation:
    name: Playwright AI Browser Validation
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build

      - name: Install Playwright Chromium
        run: npx playwright install chromium --with-deps

      - name: Run AI browser validation
        run: npm run test:ai:browser

      - name: Upload test results on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: test-results/
          retention-days: 7
```

### 設計說明

| 項目 | 值 | 依據 |
|---|---|---|
| 觸發 | `workflow_dispatch`（手動） | 規格 §3.2、§10 不自動觸發 |
| 權限 | `contents: read` | 規格 §3.2、§8 |
| Node.js | 22 | 規格 §3.2 |
| Playwright | `chromium --with-deps`（含系統相依套件） | 規格 §3.2 |
| Artifact | `actions/upload-artifact@v4`，`test-results/`，保留 7 天 | 規格 §3.2 |
| 條件上傳 | `if: failure()` — 僅失敗時上傳 | 規格 §3.2 |

### 本機驗證

```powershell
# 確認 YAML 關鍵結構存在；真正 GitHub workflow 語法需 push/PR 後由 GitHub 解析驗證
Get-Content .github/workflows/ai-browser-validation.yml | Select-String "^(name|on|permissions|jobs):"
```

預期輸出：

```
name: AI Browser Validation
on:
permissions:
jobs:
```

---

## 步驟 3：更新 `README.md`

### 動作

在 `README.md` 的三個段落追加內容，不改寫既有條目。

### 3a. 「開發背景」段落末尾追加

在「專案開發流程已整理為 `.agents/skills/develop-braverse` Skill，統一需求分析、規則查核、架構邊界、測試驗證、文件同步、派工與 Git 收尾步驟。」之後追加：

```
CI/CD 採 GitHub Actions + Vercel Git Integration 架構：GitHub Actions 僅負責 CI 驗證（單元測試、ESLint、Vite 建置）與手動 Playwright AI 瀏覽器驗證，不執行部署；Vercel 透過 Git Integration 自行監聽 push / PR 事件觸發 Preview 與正式部署，GitHub Secrets 不存放 Vercel Token。
```

### 3b. 「目前進度」段落末尾追加

在最後一條（Playwright 種子 1-20 驗證…）之後追加：

```
- 已新增 GitHub Actions CI workflow（`.github/workflows/ci.yml`）：PR 與 push main 自動執行 `npm test`、`npm run lint`、`npm run build`，使用 Node.js 22 與 npm cache，權限為 `contents: read`。
- 已新增 GitHub Actions AI 瀏覽器驗證 workflow（`.github/workflows/ai-browser-validation.yml`）：手動 `workflow_dispatch` 觸發，安裝 Playwright Chromium（`--with-deps`），失敗時以 `actions/upload-artifact@v4` 上傳 `test-results/` 保留 7 天。
```

### 3c. 「下一步計畫」段落末尾追加

在「若官方規則或卡牌資料更新，重新匯入樣本並同步更新文件與測試數字。」之後追加：

```
- 待執行：於 Vercel Dashboard 匯入 GitHub repo，設定 Framework Preset 為 Vite、Build Command 為 `npm run build`、Output Directory 為 `dist`、Install Command 為 `npm ci`、Node.js 版本為 22。
- 待執行：於 GitHub Repository Settings → Branches 為 `main` 分支設定 Required Status Checks，要求 `CI / Test, Lint & Build` 通過；要求至少 1 人 Review；禁止直接 push。
- 待執行：確認第一支 PR 建立時 Vercel bot 自動回覆 Preview 網址。
```

---

## 步驟 4：本機可驗證項目

以下命令可於本機立即執行，確認程式碼與 workflow 檔案本身無誤：

### 4a. 確認檔案存在

```powershell
Test-Path .github/workflows/ci.yml
Test-Path .github/workflows/ai-browser-validation.yml
```

預期結果：兩者皆輸出 `True`。

### 4b. 確認 YAML 關鍵結構

```powershell
Select-String -Path .github/workflows/ci.yml -Pattern "contents: read"
Select-String -Path .github/workflows/ai-browser-validation.yml -Pattern "contents: read"
Select-String -Path .github/workflows/ai-browser-validation.yml -Pattern "workflow_dispatch"
Select-String -Path .github/workflows/ai-browser-validation.yml -Pattern "upload-artifact@v4"
Select-String -Path .github/workflows/ai-browser-validation.yml -Pattern "retention-days: 7"
```

預期結果：每行皆找到至少一個匹配。

### 4c. 確認 workflow 不含 Vercel Token 或 CLI deploy

```powershell
Select-String -Path .github/workflows/ci.yml -Pattern "vercel" -CaseSensitive:$false
Select-String -Path .github/workflows/ai-browser-validation.yml -Pattern "vercel" -CaseSensitive:$false
```

預期結果：無匹配輸出（兩個 workflow 皆不含任何 `vercel` 相關字串）。

### 4d. 既有驗證指令

```powershell
npm test
npm run lint
npm run build
```

預期結果：三者皆通過（所有目前測試通過，以實際輸出為準；ESLint 無錯誤；Vite 建置產出 `dist/`）。這些指令驗證的是既有程式碼，不因新增 workflow 檔案而受影響。

### 4e. 確認未引入 workspace 變更

```powershell
git diff --check
```

預期結果：無 whitespace 錯誤輸出。ci.yml 與 ai-browser-validation.yml 為新檔案（untracked），README.md 為既有檔案（modified），出現在 `git diff` 中的僅有 README.md。

---

## 步驟 5：push / PR 後 GitHub Actions 驗證

以下項目必須在 push 至遠端或建立 PR 後，由 GitHub Actions 執行，本機無法驗證：

### 5a. CI workflow 自動觸發

1. 將 `.github/workflows/ci.yml`、`.github/workflows/ai-browser-validation.yml` 與 `README.md` 更新合併至 `main` 或建立 PR。
2. 至 GitHub repo → Actions 分頁，確認 `CI` workflow 已自動觸發。
3. 確認三個 step 皆通過：`Run unit tests`、`Run ESLint`、`Build project`。
4. 確認 Node.js 版本顯示為 22（展開 `Setup Node.js 22` step 檢視）。
5. 確認 npm cache 命中（展開 step 檢視 `Cache restored from` 訊息）。

### 5b. AI 瀏覽器驗證手動觸發

1. 至 GitHub repo → Actions → `AI Browser Validation`。
2. 點擊「Run workflow」→ 選擇分支 → 點擊「Run workflow」。
3. 確認五個 step 依序執行：`Install dependencies` → `Build project` → `Install Playwright Chromium` → `Run AI browser validation` → （失敗時）`Upload test results on failure`。
4. 若驗證失敗，至 Actions run 頁面底部「Artifacts」區塊確認 `test-results` artifact 可下載。
5. 確認 artifact 保留期限為 7 天。

### 5c. 權限驗證

展開任一 workflow job 的 `GITHUB_TOKEN` 相關日誌，確認權限為 `contents: read`，無 write 權限。

---

## 步驟 6：Vercel Dashboard Git Integration 設定

以下為 Vercel Dashboard 手動操作，非程式碼變更：

### 6a. 匯入專案

1. 登入 [Vercel Dashboard](https://vercel.com/dashboard)。
2. 點擊「Add New...」→「Project」。
3. 在「Import Git Repository」清單中找到本專案 repo，點擊「Import」。

### 6b. 設定建置參數

| 欄位 | 值 |
|---|---|
| Framework Preset | `Vite` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm ci` |
| Node.js Version | `22.x` |

### 6c. 部署

1. 點擊「Deploy」完成首次正式部署。
2. 確認 Vercel 分配的 `.vercel.app` 網域可正常載入遊戲。

### 6d. Preview 部署驗證

1. 建立一支新 PR。
2. 等待 Vercel bot 在 PR 頁面自動留言，包含 Preview 網址。
3. 點擊 Preview 網址，確認遊戲可正常載入與操作。

### 6e. 確認 Secrets 乾淨

1. 至 GitHub repo → Settings → Secrets and variables → Actions。
2. 確認**不存在**任何名為 `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID` 的 secret。

---

## 步驟 7：GitHub main Branch Protection 設定

以下為 GitHub Repository Settings 手動操作：

### 7a. 建立 Branch Protection Rule

1. 至 GitHub repo → Settings → Branches。
2. 點擊「Add branch protection rule」。
3. Branch name pattern 輸入 `main`。

### 7b. 啟用保護選項

勾選以下選項：

- [x] **Require a pull request before merging**
  - [x] Require approvals：`1`
- [x] **Require status checks to pass before merging**
  - 搜尋並新增 `CI / Test, Lint & Build`（對應 `ci.yml` 的 job name）
- [x] **Do not allow bypassing the above settings**（可選，依團隊需求）

### 7c. 驗證

1. 嘗試直接 `git push origin main`，確認被 GitHub 拒絕。
2. 建立一支 PR，確認 CI status check 出現在 PR 頁面。
3. 確認在 CI 通過前，合併按鈕為禁用狀態。

---

## 步驟 8：Commit（僅在使用者要求時執行）

> **警告**：目前工作區為 dirty worktree。此步驟**不可自動執行**。

### 條件

- 使用者**明確要求** commit。
- 只 stage 本任務的檔案，不碰其他既有修改。

### 命令

```powershell
git add .github/workflows/ci.yml .github/workflows/ai-browser-validation.yml README.md
git status --short
```

預期 `git status --short` 輸出僅包含：

```
A  .github/workflows/ci.yml
A  .github/workflows/ai-browser-validation.yml
M  README.md
```

其餘既有 modified/untracked 檔案**不出現**在 staged 清單。

### Commit 訊息

```
feat: add GitHub Actions CI and AI browser validation workflows

- ci.yml: run test, lint, build on PR and push to main (Node 22, contents: read)
- ai-browser-validation.yml: manual workflow_dispatch with Playwright Chromium,
  upload test-results artifact on failure (7-day retention)
- update README with CI/CD architecture, progress, and next steps
```

---

## 驗收標準對照

| 規格 §9 項目 | 對應步驟 | 驗證方式 |
|---|---|---|
| PR 頁面可看到 Vercel Preview 網址 | 步驟 6d | 手動建立 PR 觀察 Vercel bot |
| `main` push 後 Vercel 自動更新正式網站 | 步驟 6c | 合併 PR 後檢視 Vercel Deployments |
| CI workflow 在 PR 與 push main 時自動執行 | 步驟 5a | GitHub Actions 分頁確認 |
| AI 瀏覽器驗證可手動觸發，失敗時可下載 artifact | 步驟 5b | workflow_dispatch + 檢查 Artifacts |
| GitHub Secrets 中無 Vercel Token | 步驟 6e | 手動檢查 Secrets 頁面 |
| Vercel 建置輸出為 `dist`，頁面正常載入 | 步驟 6c | 瀏覽 `.vercel.app` 網域 |

---

## 非目標確認

以下項目本計畫**明確不實作**：

- 不在 GitHub Actions 中執行 `vercel` CLI 或任何部署 Action。
- 不在 GitHub Secrets 存放 `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`。
- 不建立 `vercel.json` 設定檔。
- 不設定 Vercel 自訂網域。
- 不自動觸發 AI 瀏覽器驗證（僅 `workflow_dispatch`）。
- 不修改任何既有原始碼、測試或設定檔（僅新增兩個 workflow 檔 + 更新 README 三段）。
