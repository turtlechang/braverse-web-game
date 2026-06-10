# opencode-go 派工

需要拆分研究、測試補強或獨立審查時，透過 `scripts/opencode-go.cmd` 派工，並以 `--model` 明確指定模型。先確認 `OPENCODE_GO_API_KEY` 已由環境變數提供，不讀取、輸出或提交密鑰。

OpenCode Go 會連線至外部 HTTPS API。在 Codex 的受限網路沙箱中執行時，第一次呼叫就必須使用 `sandbox_permissions: "require_escalated"`，並將 `["scripts\\opencode-go.cmd", "run"]` 作為核准前綴；不要先在受限沙箱內等待模型逾時。若日誌顯示 `ConnectionRefused` 且 Token 使用量為 0，代表請求尚未進入模型推理，應檢查執行權限與網路，而不是更換模型或延長提示詞逾時。

包裝腳本會檢查 `opencode.cmd` 與 `OPENCODE_GO_API_KEY`，保留既有 `HTTPS_PROXY`／`HTTP_PROXY`，並在未設定時加入 `NO_PROXY=localhost,127.0.0.1`，避免 OpenCode 本機服務流量誤入 Proxy。企業自訂 CA 可透過 `NODE_EXTRA_CA_CERTS` 傳入。

最小連線驗證：

```powershell
scripts\opencode-go.cmd run --model opencode-go/deepseek-v4-flash "只回覆 OK"
scripts\opencode-go.cmd run --model opencode-go/deepseek-v4-pro "只回覆 OK"
```

只讀審查使用 OpenCode 內建的 `plan` agent 並停用外部 plugin：

```powershell
scripts\opencode-go.cmd run --agent plan --pure --model opencode-go/deepseek-v4-flash "審查任務"
```

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
