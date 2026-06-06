# 卡牌效果引擎

## 資料模型

`CardEffect` 目前包含：

- `damage`：對合法目標造成固定傷害
- `modify-attack`：增加或減少攻擊傷害
- `modify-damage-received`：增加或減少承受的攻擊傷害
- `target`：目標陣營、最少／最多數量與篩選條件
- `condition`：目前支援 Break Area 最低等級
- `duration`：本回合、對手下回合或永久

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

## 目前限制

- 尚未處理發動時支付能源、棄牌或休息來源卡。
- 尚未支援抽牌、移動、HP 增加及持續型條件效果。
- 官方文字無法完整辨識時必須保留為 `unsupported`。
