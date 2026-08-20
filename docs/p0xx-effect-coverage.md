# P-0XX 特典卡效果稽核

更新日期：2026-08-20

本次稽核涵蓋正式卡池中的全部 153 筆 P-0XX 官方記錄（含異圖變體）。原先後續匯入的 127 筆已於 2026-08-11 promote 至 `data/cards/official-p-0xx-remaining.en.json`；目前 `data/candidates/` 沒有待驗證 P 卡。完整匯入狀態見 [P-0XX 匯入盤點](p0xx-card-inventory.md)。

## 早期 26 張高風險清單

下表保留最初 26 張正式卡的人工稽核重點；全量 153 筆另以正式卡路由、效果互動、負向與無效果攻擊四個 Browser 矩陣驗證，不以這份早期清單代替全量結果。

| 卡號 | 卡名 | 效果範圍 | 稽核重點 |
|---|---|---|---|
| P-001 | GingerBright | 餅乾技能、攻擊 | 手牌不超過 3 張時增加攻擊傷害 |
| P-002 | GingerBright | 餅乾技能、攻擊 | 同上；黃色攻擊費用 |
| P-003 | GingerBright | 餅乾技能、攻擊 | 同上；綠色攻擊費用 |
| P-007 | Chestnut Cookie | 登場技能、攻擊 | 對手餅乾 1 傷害 |
| P-008 | Macaron Hammer | 物品 | 只選剩餘 HP 至少 4 的對手餅乾並造成傷害 |
| P-009 | Stardust Cookie | 攻擊後效果 | 只有我方休息區等級較高時才追加目標與傷害 |
| P-010 | Adventurer Cookie | 登場技能、攻擊 | 只選對手 LV.1，並暫停其攻擊至下回合開始 |
| P-011 | Strawberry Cookie | 餅乾技能 | 昏厥後支援區取回，再將手牌橫置放回支援區 |
| P-012 | Mischievous Ladybug | 物品 | 3 能量、傷害後將物品橫置放入支援區 |
| P-013 | GingerBright | 餅乾技能、攻擊 | 手牌不超過 3 張時增加攻擊傷害；藍色攻擊費用 |
| P-014 | GingerBright | 餅乾技能、攻擊 | 手牌不超過 3 張時增加攻擊傷害；紫色攻擊費用 |
| P-015 | Muscle Cookie | 攻擊後效果 | 對手傷害、我方 HP 卡移至棄牌區的多段流程 |
| P-016 | Gumball Cookie | 登場技能、攻擊 | 黃色 LV.2 棄牌區餅乾移至休息區，再處理最多兩張 LV.1 |
| P-017 | Purple Yam Cookie | 餅乾技能、支援事件 | 支援卡進棄牌區時觸發；支援卡回手不得誤觸發 |
| P-018 | Mustard Cookie | 登場技能、攻擊 | 棄置 1 張後對除自身外所有餅乾造成傷害 |
| P-019 | Hero Cookie | 攻擊後效果 | 最多 3 張不含 FLIP 的餅乾回牌庫並洗牌 |
| P-022 | Milky Way Cookie | FLIP | 從牌庫抽最多 1 張 |
| P-024 | Caramel Choux Cookie | FLIP | 棄置 1 張手牌，附著餅乾增加 1 張 HP 卡 |
| P-025 | Marzipan Cookie 2 | FLIP、被動技能 | 抽牌；符合 Marzipan 不同名稱條件時傷害 ×2 |
| P-026 | Marzipan Cookie 3 | FLIP、被動技能 | 同上 |
| P-027 | Marzipan Cookie 4 | FLIP、被動技能 | 同上 |
| P-028 | Golden Cheese Warehouse | 場景 | 黃色 LV.2 以上手牌餅乾進休息區，再選黃色 LV.1 回手 |
| P-029 | Ritual of Life | 陷阱、延遲效果 | 本次戰鬥我方餅乾昏厥後，從棄牌區登場綠色餅乾 |
| P-030 | Sherbet Cookie | 登場技能、攻擊後效果 | 登場全體傷害；攻擊後可棄牌再選對手造成傷害 |
| P-031 | The Heir's Betrayal | 陷阱 | 棄牌區至少 15 張、對手 LV.3 目標、減攻並移除頂端 HP 卡 |
| P-032 | Hall of Ancient Heroes | 場景 | 支付任意能量，選我方戰鬥區 Ancient 餅乾，本回合攻擊費用改為任意色 |

## 本次修正與原因

1. **P-017 支援區事件**：原本只有支援卡進棄牌區的移動，沒有把事件轉成來源餅乾的待處理技能；新增共用支援區減少事件、`Your Turn`／橫置／每回合一次判定與 `cookie-skill` 導引流程。支援卡回到手牌只記錄支援區變動，不觸發 P-017。
2. **P-024 HP-only FLIP**：官方沒有攻擊文字，原轉接會把卡視為不可用或允許錯誤攻擊；現在保留 FLIP 轉接、補上 0 攻擊與 `nonAttackable`，並讓規則層、UI、AI 共用不可攻擊判定。
3. **P-025～P-027 Marzipan 技能**：補上 FLIP 技能轉接、`[Marzipan Cookie]` 關鍵字目標，以及只計算不同「正式卡名」的戰鬥區／支援區條件；攻擊傷害倍增在戰鬥結算層套用，避免把同一張卡重複計數。
4. **P-028 場景**：補上登場時的黃色費用、啟動時橫置來源卡、LV.2 以上手牌餅乾進休息區，以及最多一張黃色 LV.1 從休息區回手的兩段目標導引。
5. **P-029 陷阱**：補上「本次戰鬥我方餅乾昏厥」的延遲條件與綠色餅乾棄牌區目標；條件未成立時不建立錯誤的復活決策。
6. **P-032 場景**：補上 Ancient 關鍵字目標與本回合任意攻擊費用修正，並在回合結束或來源／目標離場時清理修正，避免效果跨回合殘留。
7. **卡池資料**：候選 8 張 P-017、P-024～P-029、P-032 已通過 `--require-promotion-ready`，正式 promote 並重新生成 `src/game/generated-card-pool.ts`。

## 全量特殊流程驗證

後續 promote 的 127 筆正式資料已全部通過 adapter conversion；其中三個需要額外 runtime／UI 支援的流程以專用 `test-state` 完成正反與多段操作驗證：

- **P-082 Sugar Gnome Cake Shop**：`p082-trap:energy` 驗證 `{Y}{N}` 主支付、兩張支援卡橫置、對手與我方各一個目標、雙方各增加 2 HP；`p082-trap:cookie` 驗證棄牌區 1 HP 且無 FLIP 的餅乾移至休息區替代支付。兩條路徑都能繼續戰鬥，沒有卡死。
- **P-084 Magic Lettering Pens**：`p084-item:met` 驗證昏厥後啟動費用改為 `{N}`，完成「我方餅乾橫置 → 對手目標 → 1 傷害」；`p084-item:unmet` 驗證條件未成立時不提供發動流程。
- **P-147 Licorice Cookie**：`p147-special-play` 驗證支付黑色 LV.1 餅乾的 Special Play、進入戰鬥區後接續 On Play，以及對手有 4 張手牌時的棄牌提示；完成後可回到主要階段。

上述專用 `test-state` 與全量 Browser 矩陣均使用正式卡池、正式 adapter、規則引擎與 UI command path；127 筆資料已完成 promote。fixture 只用來快速建立可重現局面，正式整合另由 AI、牌組編輯器與本機雙瀏覽器好友房 smoke 覆核。

## 驗證證據

- 正式卡牌路由：153／153 載入成功，卡名與卡面資料可見。
- 效果互動矩陣：138／138 通過，含 26 張條件／時機卡的 met／unmet A/B；0 blocked、0 failed。證據見 [P 卡效果報告](p0xx-effect-audit-2026-08-20.json)。
- 全記錄負向矩陣：153／153 通過；無效果普通攻擊矩陣：15／15 通過。證據見 [負向報告](p0xx-negative-audit-2026-08-20.json) 與 [無效果攻擊報告](p0xx-vanilla-attack-audit-2026-08-20.json)。
- P-015 攻擊後可選代價的多段效果、P-016 棄牌區移至 break 候選、P-053／P-130 條件與 P-099／P-100 FLIP 正規化皆有回歸或 Browser 證據。
- 全套 Vitest：211 個 test files、3,401 tests 通過；`npm run lint` 與 `npm run build` 通過，build 只有既有 chunk size warning。
- 卡池流程：`validate:cards`（14 個資料檔／1,101 筆記錄）、`check:card-pool` 與嚴格契約稽核（1,101 verified／0 needs-review／0 blocked）通過；`validate:candidate` 確認沒有待驗證 JSON。
- 正式整合 smoke：AI 20／20、牌組編輯器 4 個 viewport、本機雙瀏覽器好友房的開局、同步、對戰、拒絕、斷線與連線失敗路徑均通過。

`test-state` 是本機 demo fixture，只用於局部流程驗證；正式卡池是否可用仍以真實 `data/cards/`、規則測試、正式狀態流程與瀏覽器結果交叉確認。
