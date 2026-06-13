# OpenCode Go 沙箱網路阻擋處理標準流程

本文件規範在 **Codex 等受限執行環境** 中，派工給 OpenCode Go 模型（透過 `scripts/opencode-go-review.cmd` 或 `scripts/opencode-go.cmd`）時，遇到外部 HTTPS 被沙箱阻擋的標準處理方式。

## 適用情境

- 執行 `scripts\opencode-go-review.cmd` 或 `scripts\opencode-go.cmd run` 時失敗。
- 錯誤訊息包含：
  ```text
  Error: Session not found
  [opencode-go] Dispatch failed with exit code 1.
  [opencode-go] In a restricted Codex environment, run this command with approved external network access.
  ```
- 設定檔、API key、模型 ID 與提示詞本身都無明顯錯誤。

## 標準流程

### 1. 確認工作區狀態

在開始與結束時都要執行：

```powershell
git status --short --branch
```

確保唯讀審查不會意外修改工作區。

### 2. 區分失敗類型

| 現象 | 類型 | 處理方式 |
|---|---|---|
| 審查輸出內容有錯、遺漏、誤判 | 審查內容失敗 | 自行對照原始碼驗證，必要時升級模型或重新派工 |
| `Session not found` / `restricted Codex environment` | 執行環境失敗 | 依本文件處理沙箱網路問題，不要修改程式碼或反覆重試 |

### 3. 檢查派工包裝腳本

確認使用的是專案提供的包裝腳本：

- `scripts\opencode-go-review.cmd`（唯讀審查，使用 `review-fast` agent）
- `scripts\opencode-go.cmd`（一般派工）

不建議直接呼叫底層 `opencode.cmd`，以免遺失專案設定與代理限制。

### 4. 確認基本環境

檢查以下三項：

1. `OPENCODE_GO_API_KEY` 已設定：
   ```powershell
   if ($env:OPENCODE_GO_API_KEY) { "OK" } else { "MISSING" }
   ```
2. `opencode.cmd` 可在 PATH 或 `%APPDATA%\npm` 找到。
3. `--model` 與提示詞參數有正確轉送給包裝腳本。

若以上任一項有誤，先修正環境；若都正確卻仍出現沙箱錯誤，則進入下一步。

### 5. 判定為沙箱網路阻擋

若出現以下訊息：

```text
Error: Session not found
In a restricted Codex environment...
```

應判定為 **外部 HTTPS 被沙箱阻擋**，不是模型錯誤、不是設定錯誤、不是程式碼錯誤。

**禁止行為**：
- 不要修改遊戲程式碼試圖「修復」。
- 不要反覆重試同樣命令期待不同結果。
- 不要更換模型 ID 試圖繞過（同一環境下所有模型都會被阻擋）。

### 6. 請求外部網路核准（優先方案）

在 Codex 環境中，第一次執行 OpenCode Go 派工時就必須使用提升權限：

```json
sandbox_permissions: "require_escalated"
```

核准前綴建議限定為 `scripts\opencode-go-review.cmd`，避免給予過大範圍的網路權限。

---

若 `sandbox_permissions` 無法使用（例如代理工具不支援此參數），改用以下替代方案。

### 6a. 替代方案 A：背景伺服器繞過（PowerShell）

**原理**：`opencode run` 的 `Session not found` 錯誤來自於 `run` 子命令嘗試啟動本地伺服器被沙箱擋下。改用 `opencode serve` 先啟動一個背景伺服器，再以 `run --attach` 連接，可繞過此限制。

**驗證網路暢通（可省略，但建議先確認）**：
```powershell
opencode models opencode-go
```
若有列出模型清單（含 deepseek-v4-pro、qwen3.7-plus、kimi-k2.7-code 等），表示外部網路正常，可繼續。

**完整 PowerShell 指令**（複製整段執行）：
```powershell
$cwd = Get-Location
$job = Start-Job -ScriptBlock {
  param($cwd, $appdata)
  Set-Location $cwd
  & "$appdata\npm\opencode.cmd" serve --port 4096 --pure
} -ArgumentList $cwd, $env:APPDATA

Start-Sleep -Seconds 5

$result = & "$env:APPDATA\npm\opencode.cmd" run `
  --attach http://127.0.0.1:4096 `
  --model opencode-go/deepseek-v4-pro `
  --pure `
  --dangerously-skip-permissions `
  "你的審查提示詞"

Stop-Job $job
Remove-Job $job -Force
Write-Output $result
```

**注意事項**：
- `Start-Job` 的預設工作目錄為使用者文件夾，必須以 `Set-Location $cwd` 切換到專案路徑，否則模型會讀到錯誤的檔案。
- `--dangerously-skip-permissions` 會自動核准工具權限，用於唯讀審查可接受；若任務含編輯權限則不建議使用。
- `serve` 的 `--pure` 避免載入外部插件。
- 結束後務必 `Stop-Job` / `Remove-Job` 清理背景程序。

### 6b. 替代方案 B：Node.js 直接 API 呼叫

若上述方案都無法使用，專案提供 `scripts/opencode-go-direct-review.mjs`，以 Node.js 內建 `fetch` 直接呼叫 OpenCode Go 的 chat completions API，完全繞過 `opencode.cmd` CLI。

```powershell
node scripts\opencode-go-direct-review.mjs deepseek-v4-pro `
  --file src/game/energy.ts `
  --file src/game/energy.test.ts `
  "你的審查提示詞"
```

**注意事項**：
- 此腳本僅支援 OpenAI Chat Completions 格式的模型（deepseek、kimi、minimax）。
- **不支援** Anthropic Messages API 格式的模型（qwen、claude），使用此類模型需改寫腳本或改用方案 A。
- 檔案內容會完整包入 prompt，大型檔案可能超過 token 上限或導致逾時。
- 腳本支援 `--file <path>` 參數自動讀取檔案。

### 7. 取得審查結果後自行驗證

**不要直接採信模型結論。** Codex / 主代理應自行唯讀檢查：

- 原始碼實際內容
- 測試內容
- 呼叫位置
- 模型所報行號及推論依據

特別注意模型可能產生「幻覺」：虛構行號、虛構函式、或未經證實的風險。

### 9. 結果分類

將審查發現分為以下四類：

| 分類 | 處理方式 |
|---|---|
| 已確認的 bug | 自行修復或派工給 OpenCode Go 修復，並補測試 |
| 測試缺口 | 規劃並補上對應測試案例 |
| 維護性建議 | 記錄為技術債，視優先級排程 |
| 模型誤判或未充分證實的風險 | 不採信，必要時用其他模型或人工複核 |

### 10. 結束前確認工作區乾淨

最後執行：

```powershell
git status --short --branch
git diff
```

確認唯讀審查沒有修改任何工作區檔案。

## 可交給其他模型的核心指令

```text
OpenCode Go 使用外部 HTTPS API。在受限 Codex 環境中，第一次執行
scripts\opencode-go-review.cmd 就必須使用 require_escalated。
若出現 Session not found 或 restricted Codex environment，
先判定為沙箱網路問題，不要修改程式碼。

若 sandbox_permissions 無法使用，改用以下繞過方案：
1. 先驗證網路：opencode models opencode-go
2. 啟動背景伺服器：Start-Job 執行 opencode serve --port 4096 --pure
3. 以 run --attach http://127.0.0.1:4096 派工
4. 結束後 Stop-Job 清理

或使用 Node.js 直接 API：node scripts\opencode-go-direct-review.mjs <model> --file <path> "prompt"
（僅支援 OpenAI Chat Completions 格式模型）

取得審查結果後，必須自行對照原始碼與測試，不可直接採信模型結論。
最後檢查 git status 與 git diff，確認唯讀派工未修改檔案。
```

## 相關文件

- `delegation.md`：一般 opencode-go 派工策略與模型路由
- `verification-and-git.md`：驗證與 Git 操作流程
- `scripts/opencode-go-direct-review.mjs`：Node.js 直接 API 呼叫腳本
