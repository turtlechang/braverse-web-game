# opencode-go 派工

## Codex 指揮官職責（強制規範）

Codex App 在此專案中擔任**指揮官**角色，職責範圍僅限於：

- 需求規劃與問題分析
- 官方規則裁決與衝突判定
- 任務拆分與派工
- 唯讀差異審查與最終驗證

**所有程式碼、測試、設定、文件的新增、編輯、修改，一律優先且必須由 OpenCode Go 模型執行。** Codex 不得使用 `apply_patch`、`edit`、`write` 等工具或 shell 指令直接寫入或修改檔案內容。

只有在**同時滿足以下所有條件**時，Codex 才能例外親自編輯：

1. OpenCode Go 完全不可用（API 離線、授權失效等）
2. OpenCode Go 連續派工失敗且無法透過升級模型解決
3. **使用者已明確知悉並同意此例外**

平台安全核准與外部網路要求仍不可繞過；若工具要求使用者再次核准，仍須依平台流程正常處理。

## 預設優先策略

- 使用者已同意將本專案原始碼內容傳送至 OpenCode Go 外部 API。
- 可由 OpenCode Go 完成的唯讀審查、測試補強、文件更新、簡單重構、CRUD 與一般實作，預設優先派工，以降低 Codex GPT 額度消耗。
- Codex GPT 主線保留需求拆解、官方規則裁決、跨模組整合、高風險修改、衝突處理與最終驗證。
- 同一子任務原則上只派工一次；結果可用時直接整合，避免多模型重複分析。僅在結果不完整、測試失敗或有重大疑點時升級模型。
- 此專案偏好不取代 Codex 平台的外部網路與資料傳輸安全核准；工具要求核准時仍須正常提出，不得規避。

需要拆分研究、測試補強或獨立審查時，透過 `scripts/opencode-go.cmd` 派工，並以 `--model` 明確指定模型。先確認 `OPENCODE_GO_API_KEY` 已由環境變數提供，不讀取、輸出或提交密鑰。

OpenCode Go 會連線至外部 HTTPS API。在 Codex 的受限網路沙箱中執行時，第一次呼叫就必須使用 `sandbox_permissions: "require_escalated"`，並將 `["scripts\\opencode-go.cmd", "run"]` 作為核准前綴；不要先在受限沙箱內等待模型逾時。若日誌顯示 `ConnectionRefused` 且 Token 使用量為 0，代表請求尚未進入模型推理，應檢查執行權限與網路，而不是更換模型或延長提示詞逾時。

包裝腳本會檢查 `opencode.cmd` 與 `OPENCODE_GO_API_KEY`，保留既有 `HTTPS_PROXY`／`HTTP_PROXY`，並在未設定時加入 `NO_PROXY=localhost,127.0.0.1`，避免 OpenCode 本機服務流量誤入 Proxy。企業自訂 CA 可透過 `NODE_EXTRA_CA_CERTS` 傳入。

最小連線驗證：

```powershell
scripts\opencode-go.cmd run --model opencode-go/deepseek-v4-flash "只回覆 OK"
scripts\opencode-go.cmd run --model opencode-go/deepseek-v4-pro "只回覆 OK"
scripts\opencode-go.cmd run --model opencode-go/glm-5.1 "只回覆 OK"
```

一般只讀審查使用專案的 `review-fast` agent。此 agent 限制為一次工具迭代、最多讀取 4 個聚焦檔案區段，並禁止 bash、編輯、子代理與網路工具：

- 低風險且邊界明確的極聚焦唯讀審查可使用 `opencode-go/deepseek-v4-flash`。
- 跨模組、高風險或重大疑點的審查改用 `opencode-go/deepseek-v4-pro` 或既有大型 PR 模型。

```powershell
scripts\opencode-go-review.cmd --model opencode-go/deepseek-v4-pro "審查任務"
```

需要跨模組完整審查時，將任務拆成數個至多 4 個檔案的 `review-fast` 派工，再由主代理整合。只有明確需要長時間自主探索時才使用內建 `plan` agent，且呼叫端 timeout 應至少設為 300 秒。

若命令因 timeout 結束，先用 `scripts\opencode-go.cmd session list` 找到最新 session，再以 `scripts\opencode-go.cmd export <session-id> --sanitize` 檢查。Token 大於 0 且 session 後續出現 `finish: "stop"`，代表模型仍在背景完成，問題是工具迴圈超過呼叫端 timeout，而不是連線失敗。

## 模型路由

| 任務 | 模型 |
|---|---|
| 預設主要實作（多數程式碼、多檔案/跨模組、規則引擎、React UI、AI、整合、測試套件、複雜文件、完整驗證鏈） | `opencode-go/deepseek-v4-pro` |
| 極小微任務（單檔機械式變更、錯字、極短 docstring、單一 assertion、小型低風險唯讀聚焦審查） | `opencode-go/deepseek-v4-flash`（範圍擴大須立即停止並改派 Pro） |
| 輔助模型 | `opencode-go/qwen3.7-plus` |
| 試用模型（中小型實作或審查，評估勝任度） | `opencode-go/glm-5.1`（試用期間仍以 `opencode-go/deepseek-v4-pro` 擔任主要實作與終審備援） |
| 大型、多檔案、跨模組 PR 審查 | `opencode-go/kimi-k2.6` |
| `qwen3.7-plus` 不可用或不穩定 | `opencode-go/qwen3.6-plus` |
| Kimi 結果不完整或有重大疑點 | 暫以 `opencode-go/deepseek-v4-pro` 終審 |

使用者指定模型或模式時，優先遵循使用者要求。

## 派工邊界

- 提供最小但足夠的任務、檔案範圍、限制與預期輸出。
- 不讓子任務擅自還原既有修改或提交產物。
- 將派工結果視為建議；主代理仍需讀取 diff、驗證規則依據並執行測試。
- 大型審查要求依嚴重度列出具體檔案與行號，優先找行為錯誤、回歸與缺少測試。
- Flash 僅用於單檔機械式變更；若任務範圍可能擴大，直接派 Pro。

## 受限環境與沙箱網路問題

若在 Codex 受限環境中執行 `scripts\opencode-go-review.cmd` 或 `scripts\opencode-go.cmd run` 時出現：

```text
Error: Session not found
In a restricted Codex environment...
```

請參考 `opencode-go-sandbox.md` 的標準流程處理：判定為沙箱網路阻擋、使用 `sandbox_permissions: "require_escalated"` 請求核准；若無法使用，改用背景伺服器方案（`Start-Job` + `opencode serve` + `run --attach`）或 `scripts/opencode-go-direct-review.mjs` 直接呼叫 API。
