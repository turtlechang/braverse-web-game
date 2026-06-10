# 卡牌效果引擎

## 資料模型

`CardEffect` 目前包含：

- `damage`：對合法目標造成固定傷害
- `modify-attack`：增加或減少攻擊傷害
- `modify-damage-received`：增加或減少承受的攻擊傷害
- `draw`：從效果來源玩家的牌庫抽牌，不需選擇目標；牌庫耗盡時進入 pending Refresh
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

## 已支援效果

下列效果已完整實作，可經由 `CardEffect` union type 描述並由規則引擎執行：

| 效果 | 對應 CardEffect kind | 說明 |
|---|---|---|
| 傷害 | `damage` | 對合法目標造成固定傷害，含勝負與替補判定 |
| 攻擊修正 | `modify-attack` | 增加或減少攻擊傷害，回合結束移除 |
| 承受傷害修正 | `modify-damage-received` | 增加或減少承受的攻擊傷害，回合結束移除 |
| 純抽牌 | `draw` | 從牌庫抽 N 張，牌庫耗盡觸發 pending Refresh；僅接受等價於「Draw N card(s) from your deck」或「Draw up to N card(s) from your deck」的文字（須移除時機／費用標記），不接受含 Then、If you did、view HP、support area 等複合文字 |
| 牌庫頂→支援區 | `deck-to-support` | 從牌庫頂取 N 張直立放入支援區（例：ST3-010 Aloe Cookie）；牌庫耗盡觸發 pending Refresh（remainingDraws=0）。僅接受等價於「Take N card(s) from the top your deck and place it/them in your support area as active」的文字 |
| 休息區→棄牌區 | `break-to-trash` | 從效果來源玩家休息區選最多 N 張 LV.X 卡移至棄牌區；不需選擇目標時玩家可選 0 張確認。移動後以 resolveBasicVictory 檢查勝負。僅接受等價於「Select up to N LV.X card(s) from your break area and place it/them in the trash」的文字，不接受 Then/FLIP/額外子效果 |
| 增加 HP | `gain-hp` | 目前供起始牌組 FLIP 使用，從牌庫頂補入 HP 卡 |
| HP 下限保護 | `prevent-knockout` | 目前供 TRAP 使用，本次戰鬥保留至少 1 張 HP 卡 |
| 支援區→棄牌區 | `support-to-trash` | 支援 ST3-019 的後續處理 |
| 目標選擇 | `target` | 目標陣營、最少／最多數量與篩選條件 |
| 條件 | `condition` | 目前支援 Break Area 最低等級檢測 |
| 持續時間 | `duration` | 本回合、對手下回合或永久 |

無目標效果的判斷統一由 `isEffectUntargeted` 共用（目前涵蓋 `draw` 與 `deck-to-support`）。

## 未支援（unsupported）效果

下列效果**維持 unsupported**，不得部分轉換。其中 [待確認] 表示官方規則或時機細節尚未明朗，不得自行猜測實作；其餘項目是引擎能力尚未到位。

### 已實作：起始牌組 FLIP

- 規則已確認 FLIP 卡在 HP 卡因傷害翻開時立即逐張觸發，但多張 FLIP 同時觸發時，強制／可選效果的分類與玩家選擇順序屬 [待確認]。
- FLIP 卡翻開的瞬間若觸發 Deck-to-support 等需洗牌或移動的效果，是否影響其他尚未翻開的 FLIP 執行，目前無官方明確規範。
- `card_type=FLIP` 僅解析官方 `card_flip`，目前支援抽最多 1 張牌，以及棄 1 張手牌後增加 1 HP。
- 傷害逐張翻開 HP；每張 FLIP 完成發動或略過後才繼續下一張。

### 已實作：起始牌組 TRAP

- 規則已確認防守玩家可在對手宣告攻擊時支付費用使用陷阱，但同一次攻擊可使用的陷阱數量、雙方回應窗口與效果疊加順序屬 [待確認]。
- `card_type=TRAP` 僅解析官方 `card_attack_text`。
- 原型每次攻擊最多發動 1 張，支援三副起始牌組內的攻擊修正、條件傷害、HP 下限、支援棄置與牌庫頂放入休息支援。

### 尚未實作：When this Cookie faints

- 死亡觸發被動技能需要 faint 事件處理引擎，目前引擎無對應的事件系統。
- 任何含「When this Cookie faints」「When this Cookie is knocked out」等文字維持 unsupported。

### 已實作：If opponent Cookie attacks more than N

- TRAP 回應窗會以宣告時鎖定的攻擊傷害檢查門檻。

### 部分實作：Then / If you did 複合效果

- 官方效果文字以「Then」或「If you did」連接兩個以上子效果時，需要複合效果序列引擎（先執行 A，再依 A 的結果決定是否／如何執行 B）。
- 起始牌組 ST3-019 的攻擊修正後支援棄置已支援；其他任意效果鏈仍維持 unsupported。
- 純抽牌與 deck-to-support 的轉換保守原則：一旦文字包含 Then 或 If you did，即使前面部分等價於 draw 或 deck-to-support，整體仍維持 unsupported。

### 部分實作：特殊代價（非能量／非 Rest this card）

- 起始牌組 FLIP 的棄 1 張手牌，以及 ST3-019 的支援區卡牌移至棄牌區已支援；其他特殊代價仍維持 unsupported。

### 尚未實作：Stage 放置

- 「Place in your stage area」相關效果尚無 Stage 區域管理引擎。

### 尚未實作：一般移動與持續型條件效果

- 起始牌組 FLIP 的 HP 增加已支援；其他任意卡牌移動與持續型條件效果尚未支援。
