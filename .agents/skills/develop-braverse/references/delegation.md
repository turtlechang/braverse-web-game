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
scripts\opencode-go.cmd run --model opencode-go/mimo-v2.5 "只回覆 OK"
scripts\opencode-go.cmd run --model opencode-go/deepseek-v4-pro "只回覆 OK"
scripts\opencode-go.cmd run --model opencode-go/qwen3.7-plus "只回覆 OK"
```

一般只讀審查使用專案的 `review-fast` agent。此 agent 限制為一次工具迭代、最多讀取 4 個聚焦檔案區段，並禁止 bash、編輯、子代理與網路工具：

- 低風險且邊界明確的極聚焦唯讀審查使用 `opencode-go/mimo-v2.5`。
- 跨模組、高風險或重大疑點的審查改用 `opencode-go/deepseek-v4-pro` 或既有大型 PR 模型。

```powershell
scripts\opencode-go-review.cmd --model opencode-go/deepseek-v4-pro "審查任務"
```

需要跨模組完整審查時，將任務拆成數個至多 4 個檔案的 `review-fast` 派工，再由主代理整合。只有明確需要長時間自主探索時才使用內建 `plan` agent，且呼叫端 timeout 應至少設為 300 秒。

若命令因 timeout 結束，先用 `scripts\opencode-go.cmd session list` 找到最新 session，再以 `scripts\opencode-go.cmd export <session-id> --sanitize` 檢查。Token 大於 0 且 session 後續出現 `finish: "stop"`，代表模型仍在背景完成，問題是工具迴圈超過呼叫端 timeout，而不是連線失敗。

## Codex ↔ OpenCode Go 協作協定

- OpenCode Go 派工與 Codex 子代理採相同的小批次規則：每批 2–3 個檔案、一個主題、明確不可修改範圍；不得自行 stage、commit、push 或再派代理。
- 每批先跑最小驗證，再回報修改檔案、指令輸出、風險與未確認事項。Codex 以 `git status`、diff 與測試結果核對，不把代理自述視為完成證據。
- 逾時先判斷來源：`token=0` 且 `ConnectionRefused`／`Session not found` 是沙箱、網路或 session 問題，不是額度不足；`token>0` 則先查 session 是否仍在背景完成。相同子任務連續兩次停滯後由 Codex 接手，不無限重試。
- 額度／帳務只有在結構化 provider code 或 HTTP 402 有證據時才標記 `quota_exhausted`／`billing_limit`；單純 stderr 出現 quota、credit 或 billing 只標記未驗證的 `unknown`，避免誤報。
- wrapper 會先解析 OpenCode JSONL／結構化錯誤，再交給 classifier；因此模型不存在、權限、rate limit、網路與帳務不會混成同一種訊息。

## 模型路由

### 分級路由表（依優先順序）

| 任務分級 | 優先 | 備援一 | 備援二 | 備援三 |
|---|---|---|---|---|
| 微任務（單檔機械式變更、錯字、極短 docstring、單一 assertion、小型低風險唯讀審查） | `opencode-go/mimo-v2.5` | `opencode-go/minimax-m3` | `opencode-go/deepseek-v4-pro` | — |
| 中型一般實作（多數 CRUD、一般功能、中等測試、文件更新） | `opencode-go/deepseek-v4-pro` | `opencode-go/minimax-m3` | `opencode-go/qwen3.7-plus` | `opencode-go/mimo-v2.5-pro` |
| 複雜跨模組實作（規則引擎、React UI、AI 決策、整合、測試套件、完整驗證鏈） | `opencode-go/deepseek-v4-pro` | `opencode-go/mimo-v2.5-pro` | `opencode-go/glm-5.1` | `opencode-go/qwen3.7-max` |
| 大型 PR 審查（多檔案跨模組） | `opencode-go/kimi-k2.7-code` | `opencode-go/deepseek-v4-pro` | `opencode-go/glm-5.1` | `opencode-go/qwen3.7-max` |
| UI 截圖／視覺分析 | `opencode-go/mimo-v2.5` | `opencode-go/qwen3.7-plus` | `opencode-go/kimi-k2.6` | `opencode-go/mimo-v2.5-pro` |

### 模型使用限制

- **Qwen3.6 Plus**：僅作為 Qwen3.7 Plus 服務異常時的降級備援，不作一般程式碼首選。
- **GLM-5**：僅作為 GLM-5.1 服務異常時的降級備援。
- **Kimi K2.6**：不作一般程式碼首選；僅用於 UI 截圖／視覺分析備援鏈。
- **Qwen3.7 Max**：僅在前級模型（DeepSeek V4 Pro、MiMo V2.5 Pro、GLM-5.1）皆失敗或任務極高複雜度時使用。
- **MiniMax M3**：OpenCode Go 中繼資料名稱標示 **3x usage**，代表用量計算可能有倍率，實際成本應依 OpenCode Go 當期帳務規則確認，不可只看每百萬 token 標價；僅用於微任務備援鏈。
- 使用者指定模型或模式時，優先遵循使用者要求。

## 派工邊界

- 提供最小但足夠的任務、檔案範圍、限制與預期輸出。
- 不讓子任務擅自還原既有修改或提交產物。
- 將派工結果視為建議；主代理仍需讀取 diff、驗證規則依據並執行測試。
- 大型審查要求依嚴重度列出具體檔案與行號，優先找行為錯誤、回歸與缺少測試。

## 省 token 策略

1. **任務拆分**：先拆成小任務，提供明確檔案清單與驗收條件，避免一次性龐大提示。
2. **不重複派工**：同一子任務不平行重複派工；結果可用直接整合。
3. **Flash 升級條件**：Flash 失敗一次、任務範圍意外擴大、漏改、或測試失敗時，直接升級至 Pro，不得連續重抽 Flash。
4. **逾時判斷**：先分辨逾時原因——token=0 代表網路／連線問題（檢查權限與沙箱），token>0 代表模型已在背景執行（用 `session list` 檢查）。
5. **Reasoning effort**：支援 reasoning effort 的模型一般使用 `low` 或 `medium`；僅在複雜規則推理、架構設計或疑難除錯時使用 `high`。
6. **限制輸出**：提示詞中明確要求簡潔回答，限制不必要的長篇說明。
7. **快取命中**：利用固定提示模板與檔案順序，提高 API 端快取命中率，降低重複 token 消耗。

## 受限環境與沙箱網路問題

若在 Codex 受限環境中執行 `scripts\opencode-go-review.cmd` 或 `scripts\opencode-go.cmd run` 時出現：

```text
Error: Session not found
In a restricted Codex environment...
```

請參考 `opencode-go-sandbox.md` 的標準流程處理：判定為沙箱網路阻擋、使用 `sandbox_permissions: "require_escalated"` 請求核准；若無法使用，改用背景伺服器方案（`Start-Job` + `opencode serve` + `run --attach`）或 `scripts/opencode-go-direct-review.mjs` 直接呼叫 API。
