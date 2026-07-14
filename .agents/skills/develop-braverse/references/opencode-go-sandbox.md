# OpenCode Go 受限環境處理

本文件只在已決定使用 OpenCode Go，且 `scripts\opencode-go-review.cmd` 或 `scripts\opencode-go.cmd` 遇到外部 HTTPS／session 錯誤時使用。

## 1. 保護工作區

開始與結束都執行：

```powershell
git status --short --branch
```

確認外部唯讀審查沒有意外修改工作區；實作派工不得覆蓋既有修改。

## 2. 區分失敗類型

| 現象 | 類型 | 處理 |
|---|---|---|
| 輸出內容錯誤、遺漏或誤判 | 模型內容失敗 | Codex 對照原始碼；必要時停止派工或升級一次 |
| `Session not found`／`restricted Codex environment` | 沙箱或 session 失敗 | 請求核准或停止外部派工 |
| `token=0`／`ConnectionRefused` | 請求未進入模型 | 檢查權限、網路與 wrapper |
| `token>0`／呼叫端 timeout | 可能仍在背景執行 | 查詢並匯出 session |
| 結構化 HTTP 402／provider billing code | 帳務限制 | 標記已驗證的 quota／billing 狀態 |

不要把網路、權限或 session 問題誤判成模型推理失敗。

## 3. 檢查基本環境

- 使用專案 wrapper：`scripts\opencode-go-review.cmd` 或 `scripts\opencode-go.cmd`。
- 確認 `OPENCODE_GO_API_KEY` 已設定，但不得輸出值。
- 確認 `opencode.cmd` 可用，且 `--model` 與提示詞有正確傳入。
- 保留既有 `HTTPS_PROXY`／`HTTP_PROXY`；企業 CA 使用 `NODE_EXTRA_CA_CERTS`。

## 4. 正常請求平台核准

OpenCode Go 需要外部 HTTPS。第一次執行就依 Codex 平台流程請求最小必要的 `require_escalated` 權限，核准前綴限定為實際使用的 wrapper。

若核准不可用、被拒絕或目前工具無法提出：

1. 停止外部派工，不重試相同命令。
2. 由 Codex 本機主線繼續可完成的工作。
3. 若外部第二意見是必要驗收條件，向使用者回報限制並等待指示。

## 5. 禁止繞過

不得使用以下方式規避平台安全核准：

- `--dangerously-skip-permissions`。
- 在背景啟動 `opencode serve` 再 attach。
- 直接呼叫 provider API 取代受控 wrapper。
- 更換模型、代理或命令包裝來規避相同的網路限制。

即使任務是唯讀審查，也不能自動核准工具權限或繞過外部資料傳輸審查。

## 6. Session 診斷

呼叫端 timeout 後，不立即重派相同任務：

```powershell
scripts\opencode-go.cmd session list
scripts\opencode-go.cmd export <session-id> --sanitize
```

- `token>0` 且後續出現 `finish: "stop"`：模型已完成，屬於呼叫端 timeout。
- `token=0`：請求未進入模型，回到權限、網路與 session 檢查。
- 同一子任務連續兩次停滯後交回 Codex，不無限重試。

## 7. 取得結果後驗證

Codex 必須自行核對原始碼、測試、呼叫位置、行號與推論依據。將結果分為已確認 bug、測試缺口、維護性建議與未證實風險；不得直接採信模型結論。
