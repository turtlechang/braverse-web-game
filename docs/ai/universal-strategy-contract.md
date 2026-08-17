# 通用型 Lv.3／Lv.4 AI 策略契約

> 狀態：G0～G5 已完成。Lv.4 已接入有限預算的多步合法 command 搜尋、R16 資源預留與搜尋 telemetry；G5 則將通用策略安全接入所有既有 pending 與防守決策。

## 目標與範圍

建立不依賴卡名、卡號前綴、彈數或牌組名稱的通用策略模型。Lv.3 與 Lv.4 必須僅從結構化卡牌效果、牌組組成、公開局面、合法已知資訊與規則層回傳的合法選項推導行動。

本計畫保留並逐步整合既有下列模組，而不是另建第二套規則或執行器：

- `src/game/ai/evaluated-turn-handler.ts`
- `src/game/ai/pending-handler.ts`
- `src/game/ai/battle-handler.ts`
- `src/game/ai/skill-value.ts`
- `src/game/ai/ability-effects.ts`
- `src/game/ai/rule-profiles.ts`
- 既有 Beam Search、R1～R11、AI benchmark 與 telemetry

本計畫不變更 Lv.1、Lv.2。除非後續設計先獲核准，亦不得修改正式卡牌規則、卡牌資料、UI 或線上協議。

## 不可違反的策略契約

| ID | 契約 | 驗證方式 |
| --- | --- | --- |
| C1 | 每一個 AI 行動必須由規則層列出的合法 `GameCommand` 表達，並以 `applyGameCommand` 或既有 command handler 套用。 | 以非法候選回歸測試與 detailed simulation 的 `invalidActionCount` 驗證。 |
| C2 | 策略層是讀取／評分層，不得直接改寫 `GameState`。 | 檢查候選模擬只透過 command；純函式測試保留輸入 state。 |
| C3 | 通用策略不得以卡名、卡號前綴、彈數或牌組名稱當策略或評分 key。 | 檢查策略目錄不出現上述判斷；同名但不同 `card.id` 的測試。 |
| C4 | 人工例外只能以完整 `card.id` 為 key，必須有原因、範圍、到期／替代計畫與 telemetry。 | 例外 registry schema 與 lint／測試稽核。 |
| C5 | 不得讀取未知牌庫頂／底、對手隱藏手牌或未翻開 HP。 | `PlayerView` 邊界、`KnowledgeState` 負向測試與 code review。 |
| C6 | 洗牌或規則宣告牌序失效後，先前的確定牌序必須立即失效。 | sequence version 回歸測試。 |
| C7 | 未支援效果一律回傳中性或保守估值，不得假定必定成功，並寫入 telemetry。 | unknown-effect fixture 與 telemetry assertion。 |
| C8 | 同局面、同 seed、同能力／知識輸入必須有相同指令序列與同分 tie-break。 | deterministic fixtures 與重跑比較。 |
| C9 | 規則、可見性或效果語意不明確時，列為 `Blocking Decision`，不得用猜測補行為。 | 文件登錄與實作 PR gate。 |
| C10 | Lv.4 的搜索預算可使搜尋提早停止，但必須使用同局面 Lv.3 最佳合法候選回退。 | timeout fixture、search telemetry 與 deterministic assertion。 |

## 規則設定擴充契約

G0 不修改 `RuleId` union 或 `LV*_PROFILE`。下表是 G1～G4 實作時必須加入 `rule-profiles.ts` 的規格。

| 規則 | 名稱 | 核心責任 | 啟用等級 |
| --- | --- | --- | --- |
| R12 | 結構化卡牌能力辨識 | 從 `CardEffect`、skill、cost、timing、target 產生能力描述；不得重新解析顯示卡文。 | Lv.3、Lv.4 |
| R13 | 動態牌組策略推導 | 由牌組能力分布與局面推導快攻、控制、引擎與耐久等權重。 | Lv.3、Lv.4 |
| R14 | 已知資訊安全記憶 | 只保存合法得知的資訊，並在洗牌後失效。 | Lv.3、Lv.4 |
| R15 | Setup／Payoff 計畫評分 | 以能力證據、可完成性、機會成本與不確定性評估短期計畫。 | Lv.3、Lv.4 |
| R16 | 指令順序與資源預留 | 在多步搜尋中保留後續付款／攻擊資源，並比較行動順序。 | Lv.4 |

Lv.4 在加入 R12～R16 後，仍必須沿用 R9、R10、R11。現況 `docs/ai-levels.md` 將 R6c 標為 Deferred，但 `LV4_PROFILE` 已列入 R6c；此為 G0 發現的文件／程式不一致，後續實作前需先裁決是否修正文檔或實作，不能靜默假設。

## 分數型別與消費者契約

策略層的每一個數值輸出都必須宣告種類、單位、比較範圍與可用消費者。

### `RelativeActionScore`

僅用來在**同一局面、同一候選集合、同一評分版本**排序。它沒有跨局面絕對意義，不能直接與固定常數比較，也不能被用來宣告致勝／致命／可略過。

允許的消費者：候選排序、beam prune、同分 deterministic tie-break 前的比較、`ActionScoreBreakdown` 顯示。

禁止的消費者：`score >= N` 型的規則合法性、是否略過、是否為終局、跨牌組品質門檻。

### `CalibratedSignal`

具有可說明單位或明確布林語意，可安全被固定條件消費。例如：break level、HP 張數、牌庫張數、能量張數、規則層的 `state.status === 'finished'`、搜尋節點數、已耗時間。

若將數值作為固定門檻，必須在 producer 宣告：名稱、單位、範圍、校準來源、邊界測試與 telemetry 欄位。

### 強制設計規則

1. 終局與致命判定必須由明確 state／規則訊號表示，不得以綜合 heuristic 分數越過 sentinel 推論。
2. `ActionScoreBreakdown` 必須分開列出 calibrated facts 與 relative contributions，並記錄不支援效果／未知資訊的保守扣分。
3. 新增 score consumer 時，必須在測試中證明其讀的是相容型別；相對分數進固定門檻應使測試失敗。
4. 所有跨候選的比較必須定義 deterministic tie-break（command kind、來源 instance id、目標 instance id 的穩定順序），不得依陣列偶然順序。

## 分階段交付與停止點

| Phase | 交付物 | 實作邊界 | 進入條件 |
| --- | --- | --- | --- |
| G0 | 本契約、能力分類、知識邊界、現況基線與測試規格 | 僅文件；不改 AI 決策。 | 本階段完成後停止並等待核准。 |
| G1 | capability model／extractor、deck profile、synergy graph | shadow mode，只輸出能力與 profile。已完成；沒有接入 AI 行動。 | G0 核准。 |
| G2 | `KnowledgeState` 與安全測試 | 不得改變策略選擇。已完成；只接收 PlayerView／合法 knowledge event，未接入 AI 行動。 | G1 核准。 |
| G3 | Lv.3 action scoring／tactical plans | 已完成：一步合法 command 評估、公開資訊／已知資訊輸入與可解釋 breakdown。 | G2 核准。 |
| G4 | Lv.4 search／reservation／telemetry | 已完成：width 5、depth 5、240 nodes、150ms；只展開合法 command、攻擊進入 pending 即停止、逾時回退 Lv.3。 | G3 核准。 |
| G5 | pending 與防守選擇整合 | 已完成：replacement、付款、目標、順序、choose-one、discard、blocker、trap、FLIP、refresh、多階段效果。 | G4 核准。 |

每個 phase 使用獨立短期分支與 PR。現工作樹已有其他未提交工作時，不得混入、stage、覆寫或藉由切換分支破壞它；應先建立隔離 worktree／分支後再建立該 phase 的 PR。

## G0 驗收

- 四份 G0 文件存在，且不修改 `src/game/ai/` 的決策程式。
- 完成 candidate、評分、Beam、pending、fallback、override、PlayerView、隱藏資訊、benchmark 與所有分數消費者的盤點。
- 明確登錄已知的相對分數固定門檻風險與 Blocking Decisions。
- 記錄後續階段所需的能力、知識安全、Lv.3、Lv.4、pending、benchmark 測試規格。
- 完成後停止，等待使用者核准 G1；不得先建立 G1 的 source file 或影子輸出。

## G4 完成記錄（2026-08-16）

`lv4-search.ts` 以 width 5、depth 5、240 個節點、150ms 的有限 beam 搜尋同一回合可合法執行的 `PlayerActionCommand`。每個節點只以 `PlayerView`、G2 `KnowledgeState`、結構化能力與公開資源評分；不自動結算攻擊，也不猜測 blocker、trap、FLIP、replacement 或未翻 HP 的結果。攻擊一建立 pending battle、控制權改變或出現其他 pending 決策便停止展開，交回既有規則／G5 流程。假想行動若帶來未知手牌，也只保留公開張數價值並停止後續 command 列舉。

R16 的 `resource-reservation.ts` 只讀取規則層已列出的攻擊付款，避免非攻擊 setup 耗盡已可支付的最小攻擊資源。`search-telemetry.ts` 與 detailed simulation／benchmark 記錄節點、時間、timeout／fallback、setup／payoff／combo 放棄、未知資訊停止、未支援效果與資源預留；timeout 一律回退同局面的 Lv.3 最佳候選。R9、R10、R11 與既有公開風險訊號仍在每個 command 過渡中使用。G5 才會將 TacticalPlan 接到 pending payment、target、blocker、trap、FLIP、refresh 與多段效果選擇。

## G5 完成記錄（2026-08-17）

`pending-selection.ts` 建立只吃 `PlayerView` 與 `KnowledgeState` 的選擇器；它只接收規則層已列出的候選 instance id，再輸出穩定排序、目標、模式、Refresh 與補位選擇。因此策略不會直接寫入 `GameState`，也不會自行擴張候選集合。Lv.3／Lv.4 已接入 replacement、Refresh、可選代價、effect target／order、choose-one、discard、rest support、faint／after-damage、FLIP、trap、blocker 與 attack response；Lv.1／Lv.2 保持原有分支。

每一筆實際 pending／防守決策會附 `PendingStrategyTelemetry`；`simulateAiMatchDetailed` 同時輸出逐筆明細與彙總，以稽核使用通用選擇、保守 fallback、未支援能力與 `publicViewOnly`。handler 已有精確 telemetry 時，`takeAiStep` 不會以入口分類覆寫它。

未翻開 HP 不得讀取其卡面或順序。對「最多 1 個目標」的 HP 重排，AI 以既有合法 `resolve-ability-effect` 空目標明確略過，而非讀取 HP instance id 組造重排 command；玩家 UI 仍可使用完整的既有重排流程。這是保守策略選擇，不改變任何正式卡牌規則、資料、UI 或線上協議。

本輪補強了三個實際候選邊界：多目標 faint／after-damage 不會在策略評分前切掉規則層候選；陷阱會以真正具有 target 的子效果評分；`inspect-deck` 僅傳入本次已合法揭露的卡面，因此不會讀取未知牌庫。費用付款與送支援區成本也會先排除同一張卡，避免產生規則層必然拒絕的雙重使用。

驗證：G5 定向回歸 33 項、lint、app／server typecheck、以 G5 原始碼執行的 AI Browser 20／20 均通過。六種官方 preset 各 60-seed Lv.4 mirror 已由 benchmark 回歸覆蓋；Lv.4 對 Lv.3 的 60／300 seed 比較分別為 38／60（63.3%）與 181／300（60.3%），兩組皆為 stuck／deadlock／invalid action／turn cap 0。300-seed 共 8,610 次 Lv.4 決策，平均／p95／最大耗時為 0.43／2／6ms，timeout 與 Lv.3 fallback 均為 0；資源預留 miss 1,211 次，未支援效果與未知資訊停止均為 0。完整 Vitest（排除會改寫 `generated-card-pool.ts` 且受 Windows 檔案鎖阻擋的 `validate-candidate-cards.test.ts`）為 196 個檔案／3,127 項全數通過。正式 Vite build 仍受隔離 worktree 的 Windows `EPERM`（`dist` 鎖定且無法建立替代輸出目錄）阻擋，並非 TypeScript 或 lint 錯誤。
