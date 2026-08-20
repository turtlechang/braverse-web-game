# BS6 卡牌 `test-state` 正反向驗證路徑

這些網址只在 `localhost` 啟用，使用正式 `GameState`／`GameCommand`／效果條件判定；夾具只負責快速建立可重現的局面，不取代正式牌組對戰與線上同步驗收。

## BS6-013 Chess Choco Cookie

- 正向：`/?test-state=card:BS6-013`
  - 我方戰鬥區放入兩個不同 `instanceId`、同名且都是真實 BS6-013 的餅乾。
  - 攻擊後條件「戰鬥區有另一張 Chess Choco Cookie」成立，應看見 1 點追加傷害目標。
- 反向：`/?test-state=card-negative:BS6-013`
  - 只保留攻擊者，沒有同名夥伴；攻擊後條件不成立，效果應合法略過且不建立追加傷害目標。

## BS6-007 Blue Slushy Cookie

- 正向：`/?test-state=card:BS6-007`
  - 待處理戰鬥已記錄對手餅乾昏厥，對手支援區有 2 張啟動卡；支付 `<R><R><R>` 後可選擇最多 2 張支援卡橫置。
- 反向：`/?test-state=card-negative:BS6-007`
  - 保留相同攻擊與兩張對手支援卡，但清除本次戰鬥的昏厥證據；攻擊後條件不成立，不應出現休息支援卡目標。

## BS6-010 Timekeeper Cookie

BS6-010 是被動的戰鬥區移動阻擋，不是可直接按下的 Activate 技能。用同一個正式 BS6-079 OnPlay 移動指令做 A/B：

- 放行（正向）：`/?test-state=bs6-010-open`
  - 不放置 Timekeeper，選擇 BS6-079 的合法藍色 LV.1 目標後，目標可移到牌庫底。
- 阻擋（反向）：`/?test-state=bs6-010-blocked`
  - 對手戰鬥區放置真實 BS6-010；同一移動指令應被阻擋，目標留在原區域並產生阻擋紀錄。

既有相容網址 `bs6-079-on-play-clear`／`bs6-079-on-play-blocked` 保留不變。

## BS6-008 Sugar Swan Cookie

BS6-008 的被動條件是在「這張餅乾攻擊時，剩餘 HP ≤4」時鎖住本次戰鬥的陷阱：

- 正向（阻擋陷阱）：`/?test-state=bs6-008-trap-blocked`
  - BS6-008 以 4 張 HP 卡宣告攻擊；對手手牌有可支付的 BS6-020 Tonic Spray，但不得進入陷阱回應。
- 反向（允許陷阱）：`/?test-state=bs6-008-trap-open`
  - BS6-008 以 5 張 HP 卡宣告攻擊；同一張 Tonic Spray 應可進入回應視窗。

這兩條路徑都呼叫正式 `beginAttack`，不是直接手工寫入 `trapsDisabled`。

## 證據界線

每張卡都應收集：

1. 正向 Browser trace：合法支付／條件／目標／結算指令。
2. 反向 Browser trace：條件阻擋、不可支付或合法 no-op 的證據。
3. 對應 `src/game/demo.test.ts` 回歸，確認 fixture 沒有靠卡名以外的規則特例偷改正式卡牌資料。

通過 `test-state` 只代表離線局部流程可重現；正式多人對戰、線上同步與完整牌組仍需另外跑 Browser／server 驗收。
