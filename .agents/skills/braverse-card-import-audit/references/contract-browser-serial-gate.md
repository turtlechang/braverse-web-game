# 卡牌契約、test-state 與 Browser 逐卡驗收閘門

這份參考只處理「效果已轉接」之後如何證明每張卡可安全進入下一階段。候選匯入、矩陣欄位與基本 Chrome 檢查仍依 [card-audit-matrix.md](card-audit-matrix.md)；規則判定以 `docs/game-rules.md` 與 `docs/card-behavior-contract.md` 為準。

## 必須通過的路徑

```text
官方卡面／結構化資料
  -> parser／adapter shadow compile
  -> contract audit／selector binding
  -> runtime CardEffect／GameCommand／pending decision
  -> test-state 合法與阻擋案例
  -> Browser A/B 操作與公開 effect trace
  -> validate／promote
  -> 下一張卡（逐卡 gate）
```

每一段都要保留可追溯的 `card.id`、來源文字／hash、effect index、支付、代價、目標與 Then 順序。顯示卡面文字不能當作 runtime 已正確的證據；UI 也不能自行重新解析文字來補規則。

## Shadow compile 與契約檢查

盤點整批時可以先用較大的 `--limit` 產生唯讀報告；正式逐卡驗收時固定使用 `--limit 1`，同一張卡通過全部閘門後才把 `--offset` 加 1：

```powershell
npm.cmd run cards:migrate:batch -- --offset <CURRENT_OFFSET> --limit 1 --output .tmp-card-migration-one.json
npm.cmd run cards:audit:contracts -- --output .tmp-card-contract-audit.json
npm.cmd run cards:audit:contracts -- --strict
```

不要用卡名、彈數或牌組名稱繞過篩選。`cards:migrate:batch` 只編譯與報告，不會替正式 adapter、卡池 registry 或規則引擎寫入結果；`ready=false`、`needs-review` 或 `blocked` 都要停下來修正或標記，不可增加 offset 或直接 promote。

契約至少逐項確認：

- parser 正確保留官方文字、來源 hash、`Activate`／`OnPlay`／`Once per turn`／`Your Turn` 時機，以及 clause 的順序。
- `payment` 與效果 `cost` 分開；顏色、數量、活躍／橫置、區域及代價不足的行為有明確證據。
- target selector 綁定來源／對手、區域、顏色、LV／HP 上下限、數量上限、`up to` 可選 0、`sourceOnly`／`excludeSource`；多段效果以 effect index 對應各段目標，不能把所有段落壓成單一目標。
- `Then`、ordered targets、FLIP／陷阱／阻擋與來源離場的停止條件和 runtime resolution 順序一致。
- 無法從結構化資料安全辨識的句子列為 `needs-review` 或 `blocked`。不可用合理猜測填入 selector、支付或代價。

## test-state 的證據邊界

`test-state` 是快速、可重現的驗證入口；它應使用與正式離線／線上流程相同的 `GameState`、`GameCommand`、`applyGameCommand`、pending decision 與規則驗證。因此，修正 `src/game/` 規則核心後，正式命令路徑會共用該修正。

但 `test-state` 的 fixture 是刻意準備好的局面，不等於完整正式對戰：它不能單獨證明隨機牌序、完整牌庫組成、隱藏資訊、多人同步、線上協定、全回合勝負流程或所有卡牌互相作用。fixture／demo 專用的初始狀態與自動結算修改，也不能反推正式卡牌規則已通過。一般 `card:` fixture 從正式 generated card pool 載入；尚未 promote 的 candidate 若沒有隔離的 preview route，Browser 證據必須標為 blocker，不得為了取得畫面先 promote。

至少使用一條正向與一條負向 route（實際 route 依卡牌類型）：

```text
http://127.0.0.1:5173/?test-state=card:<CARD_ID>
http://127.0.0.1:5173/?test-state=card-negative:<CARD_ID>
http://127.0.0.1:5173/?test-state=attack-effect&contract-card=<CARD_ID>
```

正向 fixture 必須真的提供支付、代價、合法目標、觸發時機與後續區域所需的卡牌；負向 fixture 至少阻擋一個與卡面相符的邊界，例如支付不足／顏色不符、條件不成立、非法 LV／HP／區域目標、來源不在合法區域、不能略過的代價或已達每回合限制。`up to` 效果另測選 0；無技能／無 FLIP 的卡才可只靠零 trace 記錄合法 no-op。沒有主動按鈕的被動卡必須以實際攻擊／狀態差異或規則回歸證明生效，不能把「初始 trace 為零」當成通過。

## Browser A/B 與公開 trace

Browser 驗收要操作真實 UI，而不是只讀 DOM 或直接呼叫規則函式：

1. 確認卡面圖、卡號、文字與 timing badge 正確。
2. 操作能量支付、代價確認／取消／略過、目標選擇、數量顯示、Then／逐段選擇，以及 FLIP／陷阱／阻擋流程。
3. A（合法）路徑必須產生與卡面一致、順序正確的公開 effect trace；trace 要能指出 `commandKind` 與支付／目標／結算步驟。
4. B（不合法／阻擋）路徑必須停在正確的 pending／錯誤提示、不能偷執行效果；合法 no-op 必須明確記錄原因且保持零 effect trace，不得虛構 command。
5. 檢查 console、React error、network error、pending 是否卡死，以及結算後回合／區域／勝負狀態。

目前批次 Browser 工具為：

```powershell
npm.cmd run cards:attest:browser
npm.cmd run cards:attest:browser -- --batch-report .tmp-card-migration-one.json
```

無參數命令會跑固定的完整 baseline；帶 `--batch-report` 時只跑報告中的目前 cursor，不先讓無關錨點卡阻塞單卡驗收，並在第一張失敗時停止。逐卡報告必須是 `ready=true` 且只包含目前預期的 `cardIds`（同文字／效果的異圖可同列；文字或效果不同的變體分開驗收）。每張卡的正向結果只能是 `effect-trace` 或有明確原因的 `legal-no-op`；只有來源／攻擊宣告／支付、沒有目標或結算證據的 trace 不算通過。現有 batch driver 主要負責 A 路徑與公開 trace，不能取代卡牌專屬的 `card-negative:`／阻擋操作；B 路徑必須另留 command 拒絕、未生效理由或狀態未變的證據，兩者都通過才可增加 offset。通用 attestation 亦可用既有命令檢查公開 trace：

```powershell
npm.cmd run cards:attest -- --input browser-trace.json --commands activate-skill,resolve-ability-effect --steps "支付,選擇目標,結算"
```

公開 trace 不得包含對手手牌、未翻開 HP、未知牌庫順序或其他私密 `payload`／`hand`／`deck` 內容。需要私密資訊才能判斷的情況，應改成安全的未知／阻擋證據，而不是把 fixture 內部資料寫進 trace。

## 逐卡 serial gate

批次不是「全部跑完再看結果」，而是以下序列：

1. 固定一張 `card.id`（文字或效果不同的 `@` 變體另列）。
2. 通過 shadow compile／contract selector binding。
3. 通過 test-state 正向與負向案例。
4. 通過 Browser A/B，並取得 effect trace 或合法 no-op 證據。
5. 保存矩陣列、trace／截圖／console 摘要與回歸測試後，才進入下一張。

任一步驟失敗就停止該批次：標記 `needs-review`／`blocked`，不要執行下一個 offset、不要 promote，也不要以另一張相似卡的結果代替。修正後先重跑失敗卡，再重跑同一批受影響卡；只有整批逐卡通過，才可執行 `validate:cards`、`check:card-pool` 與明確要求的 `promote:candidate`。

## 回報最小內容

每張卡至少回報：`card.id`／變體、來源與 contract 狀態、正向 trace、負向／no-op 原因、支付、代價、目標、Then／FLIP／陷阱證據、test-state 邊界、Browser console／同步限制，以及回歸命令。批次回報另列已完成的 cardIds、第一個失敗卡（若有）與是否因 serial gate 停止。
