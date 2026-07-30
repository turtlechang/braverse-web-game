# P-0XX 特典卡效果稽核

更新日期：2026-07-30

本次稽核以正式卡池中的 26 張 P-0XX 卡為範圍。官方資料目前沒有 P-004～P-006、P-020～P-021、P-023、P-033 以後的卡，因此缺號不是匯入遺漏。候選檔已完成 `promotion-ready` 驗證並 promote 至 `data/cards/`，runtime registry 也已重新生成。

## 逐卡清單

所有 26 張卡都通過官方資料轉接、效果 payload 存在性回歸，以及 `?test-state=card:P-0XX` 路由載入／卡名掃描。複雜效果另以規則引擎測試與瀏覽器代表性流程驗證。

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

## 驗證證據

- P-0XX 聚焦測試：54/54 通過；包含 26 張轉接 fixture，以及 P-016、P-017、P-018、P-024～P-029、P-032 的高風險規則回歸。
- 全套 Vitest：148 個 test files、2277 tests 通過。
- `npm run typecheck`、`npm run lint`、`npm run build` 通過；lint 僅保留既有 `useBattleActions.ts` hook dependency warning，build 僅有既有 chunk size warning。
- 卡池流程：候選驗證、promote、`validate:cards`（10 個資料檔／513 張卡號）、`check:card-pool` 通過。
- in-app Browser：26/26 P-0XX 路由可載入且卡名可見，未出現遊戲錯誤、找不到卡片或 `Invalid battle action.`；另實際操作 P-008、P-012、P-022、P-024～P-029、P-030～P-032 的物品、FLIP、攻擊後、陷阱、場景與技能分支。
- 專案既有 `npm run test:ai:browser` 在 `break-to-trash-lv1` fixture 的 `.effect-panel` 等待有間歇性競速；同一建置路由以 in-app Browser 逐步操作可正常顯示並完成效果面板，因此未將此測試工具競速誤列為 P-0XX 卡牌邏輯錯誤。完整 AI browser regression 不宣稱全綠。

`test-state` 是本機 demo fixture，只用於局部流程驗證；正式卡池是否可用仍以真實 `data/cards/`、規則測試、正式狀態流程與瀏覽器結果交叉確認。
