# OpenCode Go 錯誤觀察報告

## 執行環境

| 項目 | 值 |
|---|---|
| OS | Windows (win32) |
| Node.js | v24.16.0 |
| OpenCode CLI | v1.16.2 |
| 安裝路徑 | `%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe` |
| Global config | `%USERPROFILE%\.config\opencode\opencode.json`（僅含 schema ref） |
| Session DB | `%USERPROFILE%\.local\share\opencode\opencode.db`（1.6GB） |

## 關鍵環境發現

### 1. `opencode run` 直接執行在此環境必定失敗

所有 `opencode run` 呼叫（不論 model、API key、參數）都會回傳：

```
Error: Session not found
EXIT_CODE: 1
```

**唯一可行路徑**：`opencode serve` + `opencode run --attach`

```powershell
$job = Start-Job -ScriptBlock { opencode serve --port 4096 --pure }
Start-Sleep -Seconds 5
opencode run --attach http://127.0.0.1:4096 --model opencode-go/deepseek-v4-flash --pure "prompt"
Stop-Job $job; Remove-Job $job -Force
```

此路徑下 `opencode-go/deepseek-v4-flash` 可正常回應。

### 2. CLI 錯誤訊息高度重複

| 測試情境 | stderr 訊息 | exit code |
|---|---|---|
| API Key 缺失 | `Session not found` | 1 |
| Model ID 不存在 | `Session not found` | 1 |
| Session 不存在（有效 prefix） | `Session not found: ses_xxx` | 1 |
| Session 不存在（無效 prefix） | `Expected a string starting with "ses"` | 1 |
| 不合法 CLI 參數 | 顯示 help text | 1 |
| CLI 不在 PATH | Windows command not found | 1 |
| Model 不存在（serve+attach） | `UnknownError: Unexpected server error` | 1 |

**結論**：CLI 的 stderr 訊息不足以可靠分類錯誤。必須結合：
- exit code
- stdout 內容
- stderr 關鍵字
- HTTP response body（如果有的話）
- 環境狀態（API key、PATH、config）

### 3. `serve + attach` 路徑的 API Key 行為

透過 `serve` 啟動的 server 會載入啟動時的環境變數（含 `OPENCODE_GO_API_KEY`）。`run --attach` 的 client 不需要 API key，因為所有 API 呼叫都由 server 端處理。

**觀察**：在 `serve` 後用 `cmd.exe /c "set OPENCODE_GO_API_KEY= && opencode run --attach ..."` 仍可成功執行。

### 4. Config 載入路徑

CLI 載入 config 的優先序：
1. `%USERPROFILE%\.config\opencode\config.json`
2. `%USERPROFILE%\.config\opencode\opencode.json`
3. `%USERPROFILE%\.config\opencode\opencode.jsonc`

專案級 `scripts/opencode-go.config.json` 只有透過 `OPENCODE_CONFIG` 環境變數才會被載入（由 `opencode-go.cmd` 設定）。

### 5. Session ID 格式

- 必須以 `ses_` 開頭
- 格式：`ses_{timestamp_hex}{random_hex}`
- 範例：`ses_0afe1793cffenPjep7yuTwSo6T`

## Fixture 統計

| 類型 | 數量 | 路徑 |
|---|---|---|
| Observed | 8 | `tests/fixtures/opencode-errors/observed/` |
| Synthetic | 8 | `tests/fixtures/opencode-errors/synthetic/` |
| **Total** | **16** | |

## 對後續 Task 的影響

1. **Task 2（分類器）**：分類器不能僅依賴 stderr 訊息，必須設計為多訊號綜合判斷。`Session not found` 在不同情境下可能代表完全不同錯誤。

2. **Task 3（健康檢查）**：Level 2 connectivity check 應透過 `serve + attach` 路徑測試，而非 `opencode run`。直接 `opencode run` 在此環境不可靠。

3. **Task 4（Wrapper）**：Wrapper 必須使用 `serve + attach` 路徑，而非直接呼叫 `opencode run`。這影響架構設計。

## 成功執行鏈（本環境限定）

在本專案目前使用的 Windows、OpenCode CLI v1.16.2 及設定組合中，可靠的成功呼叫鏈為：

```
scripts/opencode-go.cmd (薄啟動器，設定 env vars)
  → scripts/opencode-go-wrapper.mjs (參數解析、preflight、日誌)
  → cmd.exe /d /s /c %APPDATA%\npm\opencode.cmd (底層 CLI)
  → opencode serve --port <N> --pure (背景伺服器)
  → opencode run --attach http://127.0.0.1:<N> --model opencode-go/<model> --pure "<prompt>"
  → OpenCode Go API (https://opencode.ai/zen/go/v1/chat/completions)
  → 模型推論 → 回應
```

**注意**：此結論不宣稱適用於其他作業系統、CLI 版本或 provider 設定。直接 `opencode run` 在此環境可重現 `Session not found`；若 CLI 未來修正此問題，呼叫鏈可能簡化。

## `Session not found` 歧義處理原則

`Session not found` 是歧義訊號，分類器應依以下優先序判斷：

| 可取得的證據 | 建議分類 |
|---|---|
| 只有 `Session not found` 字串，無執行語境 | `unknown` 或低信心 `session_not_found` |
| 執行 resume/attach，且 Session ID 明確不存在 | `session_not_found` (high) |
| API Key 在子程序環境中不存在 | `auth_missing` |
| 使用明確不存在的模型 ID | `model_unavailable` |
| 同時存在 provider 結構化錯誤碼 | 依 provider code 分類 |
