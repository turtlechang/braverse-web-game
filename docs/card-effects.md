# 卡牌效果引擎

## 資料模型

`CardEffect` 目前包含：

- `damage`：對合法目標造成固定傷害
- `modify-attack`：增加或減少攻擊傷害
- `modify-damage-received`：增加或減少承受的攻擊傷害
- `draw`：從效果來源玩家的牌庫抽牌，不需選擇目標；牌庫耗盡時進入 pending Refresh
- `draw-up-to`：由玩家選擇抽 0～N 張，逐張沿用 Refresh 流程
- `field-to-trash`：將符合等級或剩餘 HP 上限的餅乾移至棄牌區；卡牌文字允許時也可選場景
- `opponent-battle-to-trash`：將符合條件的對手戰鬥區餅乾移至棄牌區
- `opponent-random-discard`：隨機選擇對手手牌棄置，但保留其餘手牌原順序
- `deck-to-support`：從效果來源玩家牌庫頂取牌，直立即 rested=false 放入支援區，不需選擇目標；牌庫耗盡時進入 pending Refresh（remainingDraws=0）
- `gain-hp`：FLIP 結算時從牌庫頂增加實體 HP 卡
- `prevent-knockout`：本次戰鬥中使指定餅乾 HP 不會降至 0
- `support-to-trash`：將指定數量的支援區卡牌移至棄牌區
- `target`：目標陣營、最少／最多數量與篩選條件
- `condition`：目前支援 Break Area 最低等級
- `duration`：本回合、對手下回合或永久

無目標效果的判斷統一由 `isEffectUntargeted` 共用（目前涵蓋 `draw` 與 `deck-to-support`）。

效果定義不直接保存玩家選擇。執行時由 UI 傳入卡牌 instance ID，
`selectEffectTargets` 會先驗證數量、陣營及條件，再交給執行器套用。

## 執行流程

1. `convertOfficialCardEffects` 將已知官方文字轉為 `CardEffect`。
2. UI 使用 `getEffectTargetCandidates` 顯示可選目標。
3. 玩家送出選擇後呼叫 `executeCardEffect`。
4. 直接傷害沿用基本勝負與替補判定。
5. 攻擊修正保存在 `GameState.attackModifiers`。
6. `getEffectiveAttack` 提供基本攻擊與 UI 顯示目前攻擊力。
7. 暫時修正在指定回合結束時移除。
8. 抽牌效果使用既有的 `drawCards` 純函式與 `pendingRefresh` 流程，
   牌庫耗盡時自動進入 Refresh 等待。

## 語意驗證防線

`npm run validate:cards` 除了確認卡牌可轉換，還會驗證 ability 不是空殼、技能標記、可選抽牌與來源橫置語意。對容易發生「已有 payload 但語意不完整」的卡牌，`scripts/lib/card-effect-validation.ts` 維護人工覆核的高風險契約，鎖定效果 kind、代價、條件、目標與複合效果數量。契約是回歸防線，不取代官方文字與完整流程測試。

## 已支援效果

下列效果已完整實作，可經由 `CardEffect` union type 描述並由規則引擎執行：

| 效果 | 對應 CardEffect kind | 說明 |
|---|---|---|
| 傷害 | `damage` | 對合法目標造成固定傷害，含勝負與替補判定 |
| 攻擊修正 | `modify-attack` | 增加或減少攻擊傷害，回合結束移除 |
| 全體攻擊修正 | `modify-all-attack` | 增加或減少己方所有餅乾攻擊傷害，回合結束移除 |
| 承受傷害修正 | `modify-damage-received` | 增加或減少承受的攻擊傷害，回合結束移除 |
| 純抽牌 | `draw` | 從牌庫抽固定 N 張，牌庫耗盡觸發 pending Refresh |
| 可選抽牌 | `draw-up-to` | 玩家選擇抽 0～N 張；選擇大於 0 時沿用逐張抽牌與 Refresh 流程 |
| 場上卡→棄牌區 | `field-to-trash` | 依陣營、等級與剩餘 HP 上限篩選餅乾，文字允許時也可選場景；餅乾屬非昏厥離場，仍會清理修正並建立補位 |
| 對手戰鬥區→棄牌區 | `opponent-battle-to-trash` | 移除符合條件的對手戰鬥區餅乾，屬非昏厥離場 |
| 對手隨機棄牌 | `opponent-random-discard` | 透過注入式洗牌決定棄置卡，剩餘手牌維持原順序 |
| 牌庫頂→支援區 | `deck-to-support` | 從牌庫頂取 N 張直立放入支援區（例：ST3-010 Aloe Cookie）；牌庫耗盡觸發 pending Refresh（remainingDraws=0）。僅接受等價於「Take N card(s) from the top your deck and place it/them in your support area as active」的文字 |
| 休息區→棄牌區 | `break-to-trash` | 從效果來源玩家休息區選最多 N 張 LV.X 卡移至棄牌區；不需選擇目標時玩家可選 0 張確認。移動後以 resolveBasicVictory 檢查勝負。僅接受等價於「Select up to N LV.X card(s) from your break area and place it/them in the trash」的文字，不接受 Then/FLIP/額外子效果 |
| 增加 HP | `gain-hp` | 目前供起始牌組 FLIP 使用，從牌庫頂補入 HP 卡 |
| HP 下限保護 | `prevent-knockout` | 目前供 TRAP 使用，本次戰鬥保留至少 1 張 HP 卡 |
| 禁止 FLIP | `disable-flip` | 被影響玩家本回合不能發動 FLIP 效果 |
| 檢視 HP | `view-hp` | 查看目標餅乾的 HP 卡內容（可選） |
| 戰鬥區→支援區 | `battle-to-support` | 將目標餅乾從戰鬥區移至支援區 |
| 棄牌區→戰鬥區 | `trash-to-battle` | 從棄牌區將指定餅乾移至戰鬥區 |
| 支援區→手牌 | `support-to-hand` | 將支援區卡牌移回手牌 |
| 對手手牌→棄牌區 | `opponent-discard-hand` | 對手必須選擇指定數量的手牌放入棄牌區；對手無手牌時效果直接完成 |
| 支援區→棄牌區 | `support-to-trash` | 指定數量的支援區卡牌移至棄牌區 |
| 目標選擇 | `target` | 目標陣營、最少／最多數量與篩選條件 |
| 條件 | `condition` | 目前支援 Break Area 最低等級檢測 |
| 持續時間 | `duration` | 本回合、對手下回合或永久 |
| HP 送棄牌區 | `hp-to-trash` | 選擇己方 1 隻餅乾，將指定數量的 HP 卡送入棄牌區；非傷害不觸發 FLIP/afterDamage，HP 歸 0 時餅乾進入休息區並沿用離場/補位/勝負流程 |

無目標效果的判斷統一由 `isEffectUntargeted` 共用（目前涵蓋 `draw`、`deck-to-support`、`modify-all-attack`、`trash-to-battle`、`support-to-hand` 與 `opponent-discard-hand`）。

### 已實作：攻擊後續效果

- `CookieCard.attackEffects` 保存攻擊傷害文字後的效果序列，戰鬥以 `attack-effect` 待決階段在傷害完成後、替補前結算。
- ST2-003 Wizard Cookie 已支援「造成 3 點傷害，之後可選最多 1 張己方 LV.1 休息區卡牌移至棄牌區」。
- 玩家沿用效果目標面板選擇 0 或 1 張；AI 與自動戰鬥採 deterministic 合法選擇。
- 通用 `convertOfficialCardEffects` 仍不接受任意含 `Then` 的複合文字；目前僅對已確認的 ST2-003 攻擊文字建立明確轉接。

## 未支援（unsupported）效果

下列效果**維持 unsupported**，不得部分轉換。其中 [待確認] 表示官方規則或時機細節尚未明朗，不得自行猜測實作；其餘項目是引擎能力尚未到位。

### 已實作：起始牌組 FLIP

- 規則已確認 FLIP 卡在 HP 卡因傷害翻開時立即逐張處理；玩家可以選擇不發動，完成發動或略過後才翻下一張 HP 卡，因此不會形成多張 FLIP 同時等待處理的情況。
- FLIP 卡翻開的瞬間若觸發 Deck-to-support 等需洗牌或移動的效果，是否影響其他尚未翻開的 FLIP 執行，目前無官方明確規範。
- `card_type=FLIP` 僅解析官方 `card_flip`，目前支援抽最多 1 張牌，以及棄 1 張手牌後增加 1 HP。
- 傷害逐張翻開 HP；每張 FLIP 完成發動或略過後才繼續下一張。

### 已實作：起始牌組 TRAP

- 規則已確認每次攻擊的陷阱步驟只能回應一次：使用 1 張陷阱，或發動 1 個「當對手的餅乾攻擊時」效果，兩者擇一。
- `card_type=TRAP` 僅解析官方 `card_attack_text`。
- 原型每次攻擊最多發動 1 張，支援五副起始牌組內的攻擊修正、條件傷害、HP 下限、支援／戰鬥區餅乾代價、場上卡移除與牌庫頂放入休息支援。

### 已實作：起始牌組物品與場景

- 三副起始牌組共 10 張物品卡與 2 張場景卡已完整支援。
- 物品卡費用支付後執行效果，結算後放入棄牌區；場景卡於主要階段使用，已有場景時可替換。
- 已支援效果種類：`disable-flip`、`view-hp`、`modify-all-attack`、`battle-to-support`、`trash-to-battle`、`support-to-hand`。
- 複合效果序列引擎支援子效果之間暫停、等待玩家選擇（如 ST2-018 的 view-hp 為可選）、Refresh 插入與補位銜接。
- AI 以 deterministic 策略決定物品/場景使用時機、費用支付與目標選擇。

### 已實作：When this Cookie faints

- 餅乾因傷害或效果離開戰鬥區時，會觸發 `card.skill.faint` 標記的被動技能。
- `convertOfficialCardEffects` 已解析「When this Cookie faints」開頭的效果文字（目前支援 damage 與 draw）。
- 戰鬥傷害與效果傷害均會在餅乾離場後觸發 faint 效果。
- 具有有效目標（如 `min: 0, max: 1` 的 opponent damage）的 faint 效果會進入 `pendingFaintEffects` 佇列，等待玩家或 AI 選擇目標後結算；無目標效果（如 draw）直接結算。
- 多個餅乾同時昏厥時，faint 效果依序進入佇列，逐個等待選擇。
- 玩家可選擇 1 個合法目標或選 0 確認（up to 1）；AI 以 deterministic 策略選擇（優先血量最低的對手餅乾）。

### 已實作：If opponent Cookie attacks more than N

- TRAP 回應窗會以宣告時鎖定的攻擊傷害檢查門檻。
- 非 Cookie 卡（陷阱、物品、場景）如 `convertOfficialCardEffects` 回傳 unsupported 但已由專屬解析器（`convertOfficialTrapAbility` 等）正確解析，執行期卡牌會自動代入 ability text 作為 `effectText`，供 CardDetailModal 顯示詳情。

### 已實作：複合效果序列（起始牌組範圍）

- 官方效果文字以「Then」或「If you did」或連續多個效果連接時，複合效果序列引擎支援依序執行子效果，並在子效果之間暫停等待玩家或 AI 選擇。
- 已支援：ST2-018（draw + optional view-hp）、ST3-017（damage + support-to-trash）、ST3-022（support-to-hand + draw）及其他起始牌組物品/場景的複合效果。
- 複合效果執行途中可插入 Refresh（牌庫耗盡時）與補位（餅乾離場時），完成後回到序列中尚未執行的子效果。
- 起始牌組以外包含 Then/If you did 且無法以現有效果組合安全描述的文字，仍維持 unsupported。

### 部分實作：特殊代價（非能量／非 Rest this card）

- 起始牌組 FLIP 的棄 1 張手牌、ST3-002／ST3-005／ST3-015 的支援區卡牌送棄牌區技能代價，以及 ST3-019 的支援區卡牌移至棄牌區已支援；其他特殊代價仍維持 unsupported。
- BS1/BS2 紅色非角色卡（BS2-006 hp-to-trash、BS2-007 discardHandColor）已完整支援；UI 的陷阱手牌候選清單現在會依 `discardHandColor` 過濾，僅顯示符合顏色限制的手牌。

### 尚未實作：一般移動與持續型條件效果

- 起始牌組 FLIP 的 HP 增加已支援；其他任意卡牌移動與持續型條件效果尚未支援。
## BS1 Brave Beginning Phase 1/2 effect adapter notes

- Phase 1 已建立 `official-brave-beginning-bs1.en.json` 的轉接盤點測試：99 筆資料、78 個 base card number，類型分布為 cookie 72、flip 12、item 6、trap 6、stage 3。
- Phase 2 先支援可直接映射到既有規則引擎的 BS1 文字：OnPlay/Activate/FLIP 的棄手牌代價傷害、`Return this Cookie to your hand`、faint 後 `break-to-trash`、支援區送棄牌區代價、`deck-to-support`、`set-active`，以及 `When your turn ends` 的 endPhase 判定。
- `convertOfficialCardEffects` 現在可用 `baseCardNumber` 處理 BS1 變體卡號，例如 `BS1-002@1`，但一般卡號仍優先使用 `cardNumber`，避免測試用假卡或舊資料被 base 欄位誤覆蓋。
- Phase 3 仍需另行處理高風險 BS1 效果：攻擊重新指定、全場/全對手傷害、依休息區或支援區數量變動的效果、從休息區登場、以及「本回合支援區減少」等需要新增狀態追蹤的條件。HP 送棄牌區代價（`hp-to-trash`）已支援。
