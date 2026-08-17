# 卡牌行為契約與轉接稽核

## 目的

官方卡面文字不是可以直接當成 UI 操作流程的格式。支付、代價、目標、順序與
`Then` 必須先被拆成可稽核的 clause，再與規則層的 `GameCard/CardEffect` 交叉
比對，否則「有轉出效果」不代表「支付與目標一定正確」。

目前採用 shadow mode：既有 `official-effect-adapter.ts` 仍是正式 runtime 來源，
契約 ledger 只讀取來源資料並產生差異報告，不會自行修改 `GameState` 或改變遊戲
決策。這讓轉接錯誤可以先被看見，再逐卡完成正式契約，而不是一次重寫整個轉接器。

## 契約內容

`src/cards/contracts/types.ts` 定義以下欄位：

- `sourceHash`：卡號、類型與原始 skill／attack／FLIP 文字的雜湊；來源改變時必須
  重新稽核。
- `timing`：`{mob}`／`{ap}`／`{t1}`／`{mt}` 與 runtime trigger、回合及一次
  性旗標的對照；`{bl}` 是 Blocker 關鍵字，不會被誤判為時機標記。
- `clauses`：每個來源片段的角色（timing、condition、payment、cost、target、
  effect、then、order 或 unsupported）、位置、token 與信心等級。
- `payments`：能量支付、來源能量或替代支付的來源 clause。
- `costs`：手牌、支援區、HP、戰鬥區移動等代價；不能把代價誤當成效果。
- `targets`：side、min/max 與後續可擴充的 selector binding。
- `steps`：效果順序與 `Then` 關係，保留 runtime effect kind 證據。
- `status`／`blockers`：`verified`、`needs-review`、`blocked`；不確定項目不得被
  標成已驗證。

實際稽核入口是 `analyzeOfficialCardBehavior`。它會保留 runtime 的 effect kinds、
selector、energy cost 與 ability cost keys，並驗證來源與 runtime 是否都有證據。

## 指令

```text
npm run cards:audit:contracts
npm run cards:audit:contracts -- --file official-age-of-heroes-and-kingdoms-bs6.en.json
npm run cards:audit:contracts -- --output docs/card-contract-audit.json
npm run cards:audit:contracts -- --strict
npm run cards:attest -- --input browser-trace.json --commands activate-skill,resolve-ability-effect --steps "支付,選擇目標,結算"
npm run cards:attest:browser
npm run cards:migrate:batch -- --offset 0 --limit 25
npm run cards:migrate:batch -- --offset 50 --limit 25
```

不帶 `--strict` 時是報告模式，適合盤點現況；`--strict` 會在仍有
`needs-review`／`blocked` 卡片時回傳失敗，供後續 candidate promotion gate 使用。
第一版會保守地將無法獨立辨識的文字標成 `needs-review`，這是刻意的安全行為，
不是將不確定轉換硬標成正確。

## 轉換與 UI 的接法

目前已提供唯讀 `compiler.ts` bridge 與規則層 `DecisionDescriptor`：前者把契約拆成
支付 → 代價 → 目標 → 結算步驟，後者把既有 pending decision 正規化成可供 UI／AI
消費的步驟與 command kind。`compileContractDecisionSteps` 只投影契約 metadata，
不填入候選；`compileEffectDecisionDescriptor` 與 `compilePendingDecisionDescriptor`
才可在合法 `GameState`／`PlayerView` 下呼叫 targeting、skills、energy helper 產生
候選。descriptor 不自行產生狀態變更或讀取私有牌面，最後仍由 `applyGameCommand`
驗證。

本輪已把本機 pending modal 的效果順序、手牌／支援區回應，以及線上效果候選接到同一
descriptor bridge；尚未接入的舊精靈仍可保留自己的暫態選取，但送出的 command 不得
繞過規則層。P5 的 `migration.ts` 與 `cards:migrate:batch` 只做 deterministic shadow
批次（依 `card.id` 排序），來源記錄則以 `cardNumber` 綁定以保留 `@1` 異圖變體；不修改正式 adapter、卡牌資料或 runtime registry。

稽核報告會同步列出 `needs-review` 的原因計數，將 parser、payment、cost、target、
Then、timing 與 resolution-order 證據分開；目前的主要缺口仍是來源目標語句與未分類
條款，不會因為 runtime 有相似效果就自動升格。`scripts/card-contract-browser-attestation.ts`
以 `?test-state=attack-effect&contract-card=...` 啟動公開 trace，先驗證未操作的負向
pending，再透過 modal 內的 selector candidate 完成正向支付／目標／結算；trace 僅保留
command kind、摘要與步驟文字，不含手牌、牌庫或未公開 HP 識別資訊。

每張卡進入 promotion-ready 或下一個 shadow migration 批次前至少需要：

1. 來源 hash 與 clause ledger 通過。
2. 支付、代價、目標與順序各有 runtime 證據。
3. 正向、無合法目標、條件不成立與錯誤付款測試。
4. Browser 實際操作合法與不合法路徑，並以 `cards:attest` 驗證公開 command trace。
5. 批次中的每張卡以 `compileCardBehaviorContract` 產生 executable 結果；任何一張
   blocker 都讓整批停止，不得只跳過失敗卡片。

任何未支援效果、歧義文字或規則文件標成 `[待確認]` 的項目都必須停在
`needs-review`／`blocked`，不可用卡名、彈數或牌組名稱繞過稽核。
