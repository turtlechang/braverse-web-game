# opencode-go 派工

需要拆分研究、測試補強或獨立審查時，透過 `scripts/opencode-go.cmd` 派工，並以 `--model` 明確指定模型。先確認 `OPENCODE_GO_API_KEY` 已由環境變數提供，不讀取、輸出或提交密鑰。

OpenCode Go 會連線至外部 HTTPS API。在 Codex 的受限網路沙箱中執行時，第一次呼叫就必須使用 `sandbox_permissions: "require_escalated"`，並將 `["scripts\\opencode-go.cmd", "run"]` 作為核准前綴；不要先在受限沙箱內等待模型逾時。若日誌顯示 `ConnectionRefused` 且 Token 使用量為 0，代表請求尚未進入模型推理，應檢查執行權限與網路，而不是更換模型或延長提示詞逾時。

包裝腳本會檢查 `opencode.cmd` 與 `OPENCODE_GO_API_KEY`，保留既有 `HTTPS_PROXY`／`HTTP_PROXY`，並在未設定時加入 `NO_PROXY=localhost,127.0.0.1`，避免 OpenCode 本機服務流量誤入 Proxy。企業自訂 CA 可透過 `NODE_EXTRA_CA_CERTS` 傳入。

最小連線驗證：

```powershell
scripts\opencode-go.cmd run --model opencode-go/deepseek-v4-flash "只回覆 OK"
scripts\opencode-go.cmd run --model opencode-go/deepseek-v4-pro "只回覆 OK"
```

一般只讀審查使用專案的 `review-fast` agent。此 agent 限制為一次工具迭代、最多讀取 4 個聚焦檔案區段，並禁止 bash、編輯、子代理與網路工具，避免多檔案審查在工具迴圈中超過外部等待時間：

```powershell
scripts\opencode-go-review.cmd --model opencode-go/deepseek-v4-flash "審查任務"
```

需要跨模組完整審查時，將任務拆成數個至多 4 個檔案的 `review-fast` 派工，再由主代理整合。只有明確需要長時間自主探索時才使用內建 `plan` agent，且呼叫端 timeout 應至少設為 300 秒。

若命令因 timeout 結束，先用 `scripts\opencode-go.cmd session list` 找到最新 session，再以 `scripts\opencode-go.cmd export <session-id> --sanitize` 檢查。Token 大於 0 且 session 後續出現 `finish: "stop"`，代表模型仍在背景完成，問題是工具迴圈超過呼叫端 timeout，而不是連線失敗。

## 模型路由

| 任務 | 模型 |
|---|---|
| CRUD、單元測試、Docstring、簡單重構、一般審查 | `opencode-go/deepseek-v4-flash` |
| 一般複雜工作 | 優先 `deepseek-v4-flash`，必要時使用 `deepseek-v4-pro` 或 `qwen3.7-plus` |
| 大型、多檔案、跨模組 PR 審查 | `opencode-go/kimi-k2.6` |
| `qwen3.7-plus` 不可用或不穩定 | `opencode-go/qwen3.6-plus` |
| Kimi 結果不完整或有重大疑點 | 暫以 `opencode-go/deepseek-v4-pro` 終審 |

使用者指定模型或模式時，優先遵循使用者要求。

## 派工邊界

- 提供最小但足夠的任務、檔案範圍、限制與預期輸出。
- 不讓子任務擅自還原既有修改或提交產物。
- 將派工結果視為建議；主代理仍需讀取 diff、驗證規則依據並執行測試。
- 大型審查要求依嚴重度列出具體檔案與行號，優先找行為錯誤、回歸與缺少測試。
