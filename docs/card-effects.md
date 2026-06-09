# 卡牌效果引擎

## 資料模型

`CardEffect` 目前包含：

- `damage`：對合法目標造成固定傷害
- `modify-attack`：增加或減少攻擊傷害
- `modify-damage-received`：增加或減少承受的攻擊傷害
- `draw`：從效果來源玩家的牌庫抽牌，不需選擇目標；牌庫耗盡時進入 pending Refresh
- `deck-to-support`：從效果來源玩家牌庫頂取牌，直立即 rested=false 放入支援區，不需選擇目標；牌庫耗盡時進入 pending Refresh（remainingDraws=0）
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
| 目標選擇 | `target` | 目標陣營、最少／最多數量與篩選條件 |
| 條件 | `condition` | 目前支援 Break Area 最低等級檢測 |
| 持續時間 | `duration` | 本回合、對手下回合或永久 |

無目標效果的判斷統一由 `isEffectUntargeted` 共用（目前涵蓋 `draw` 與 `deck-to-support`）。

## 未支援（unsupported）效果

下列效果**維持 unsupported**，不得部分轉換。其中 [待確認] 表示官方規則或時機細節尚未明朗，不得自行猜測實作；其餘項目是引擎能力尚未到位。

### [待確認] FLIP 觸發／同時處理順序

- 規則已確認 FLIP 卡在 HP 卡因傷害翻開時立即逐張觸發，但多張 FLIP 同時觸發時，強制／可選效果的分類與玩家選擇順序屬 [待確認]。
- FLIP 卡翻開的瞬間若觸發 Deck-to-support 等需洗牌或移動的效果，是否影響其他尚未翻開的 FLIP 執行，目前無官方明確規範。
- **不接受來自 FLIP 文字的任何效果轉換**，即使文字本身等價於 draw 或 deck-to-support。

### [待確認] TRAP 回應視窗與每次攻擊可用張數

- 規則已確認防守玩家可在對手宣告攻擊時支付費用使用陷阱，但同一次攻擊可使用的陷阱數量、雙方回應窗口與效果疊加順序屬 [待確認]。
- TRAP 的完整事件攔截引擎尚未實作。

### 尚未實作：When this Cookie faints

- 死亡觸發被動技能需要 faint 事件處理引擎，目前引擎無對應的事件系統。
- 任何含「When this Cookie faints」「When this Cookie is knocked out」等文字維持 unsupported。

### 尚未實作：If opponent Cookie attacks more than N

- 條件式傷害或效果需要攻擊數值攔截引擎，在攻擊宣告階段與傷害計算階段之間計算條件。
- 任何含「If opponent Cookie attacks more than N…」等門檻條件文字維持 unsupported。

### 尚未實作：Then / If you did 複合效果

- 官方效果文字以「Then」或「If you did」連接兩個以上子效果時，需要複合效果序列引擎（先執行 A，再依 A 的結果決定是否／如何執行 B）。
- 目前引擎只處理單一效果，不支援效果鏈。
- 純抽牌與 deck-to-support 的轉換保守原則：一旦文字包含 Then 或 If you did，即使前面部分等價於 draw 或 deck-to-support，整體仍維持 unsupported。

### 尚未實作：特殊代價（非能量／非 Rest this card）

- 《Place／Take／Discard …》等括號內代價不屬於純能量支付或「Rest this card」，尚無對應的代價引擎。
- 例如《Place 1 card from your support area into the trash.》、《Discard 1 card.》

### 尚未實作：Stage 放置

- 「Place in your stage area」相關效果尚無 Stage 區域管理引擎。

### 尚未實作：移動、HP 增加、持續型條件效果

- 卡牌移動（從某區到某區）、HP 增加（非翻 HP 卡）、持續型條件效果（每回合檢查條件）尚未支援。
