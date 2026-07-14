# Codex 主線與 OpenCode Go 備援

只有確定要使用 OpenCode Go 時才讀本文件。一般 Braverse 開發由 Codex 主線直接完成；任務分級先依 `../../braverse-workflow/references/delegation-template.md`。

## 適用情境

OpenCode Go 僅用於：

- Codex 額度不足，需要獨立額度池。
- 可清楚限定檔案與驗收的低風險平行工作。
- 大量測試補強、文件盤點、靜態搜尋或機械式整理。
- 唯讀 PR review、反方意見或跨模型交叉驗證。
- 使用者明確指定。

下列工作預設留在 Codex 主線：核心規則、FSM、AI 決策、安全與權限、資料遷移、不明根因 bug、跨模組整合及發布判斷。

## 派工邊界

- 每批 2–3 個檔案、一個主題、明確不可修改範圍與驗收標準。
- 不與 Codex 或其他代理同時修改相同檔案或同一責任區。
- 不允許外部代理自行 stage、commit、push、再派代理或改變架構決策。
- 同一子任務原則上只派一次；結果可用就整合，不用另一模型重做。
- Codex 必須自行讀取 diff、核對規則依據並執行必要測試，不把代理自述視為完成證據。

## 執行與安全

使用專案包裝腳本，不直接呼叫底層 provider：

```powershell
scripts\opencode-go.cmd run --model <model> "<task>"
scripts\opencode-go-review.cmd --model <model> "<review-task>"
```

- API key 只能由 `OPENCODE_GO_API_KEY` 環境變數提供，不讀取、輸出或提交。
- OpenCode Go 使用外部 HTTPS API。第一次呼叫就依平台流程請求最小必要的外部網路核准。
- 核准不可用、被拒絕或工具不支援時，停止外部派工；由 Codex 本機繼續或回報限制。
- 不得使用背景服務、直接 API、`--dangerously-skip-permissions` 或其他方式繞過平台安全核准。
- 受限環境錯誤依 [opencode-go-sandbox.md](opencode-go-sandbox.md) 處理。

## OpenCode Go 模型路由

以下只在已決定使用 OpenCode Go 時適用；供應商模型與計費可能變動，執行前以當期可用清單為準。

| 工作 | 優先 | 備援 |
|---|---|---|
| 微任務、機械式整理、極聚焦唯讀審查 | `opencode-go/mimo-v2.5` | `opencode-go/minimax-m3` |
| 一般低風險實作、測試、文件 | `opencode-go/deepseek-v4-pro` | `opencode-go/qwen3.7-plus` |
| 大型唯讀 PR review | `opencode-go/kimi-k2.7-code` | `opencode-go/deepseek-v4-pro` |
| UI 截圖第二意見 | `opencode-go/mimo-v2.5` | `opencode-go/qwen3.7-plus` |

若任務意外擴大、漏改、驗證失敗或涉及核心決策，停止外部實作並交回 Codex 主線，不以連續重抽模型取代根因分析。

## Observability 與停滯交接

- `token=0` 且出現 `ConnectionRefused`／`Session not found`：優先判定為沙箱、網路或 session 問題。
- `token>0` 且呼叫端 timeout：先用 `scripts\opencode-go.cmd session list` 找最新 session，再以 `export <session-id> --sanitize` 檢查是否仍在背景完成。
- 只有結構化 provider code 或 HTTP 402 才標記 `quota_exhausted`／`billing_limit`；單純 stderr 關鍵字只標記 `unknown`。
- 同一子任務連續兩次停滯後由 Codex 接手，不無限重試。
- 完整停滯交接流程見 `docs/subagent-stall-handoff-protocol.md`。

## 唯讀審查

使用 `review-fast` agent，單次最多指定 4 個聚焦檔案。要求依嚴重度列出具體檔案與行號，優先找行為錯誤、回歸、缺少測試與無法證明的假設。
