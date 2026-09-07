# Lv.5 公開宣告傷害與 telemetry 校正

日期：2026-08-27

範圍：Lv.5 `ActionScore`、搜尋評分、離線 replay／Arena telemetry

## 結論

本輪校正了可供後續 AI 覆盤與訓練使用的資料品質，而非用特定 seed 提高勝率：

- `public-attack` 評分與 replay reason 改用規則層計算的公開宣告傷害，會包含已公開的
  攻防修正與目標條件，不再只讀卡面基礎攻擊力。
- telemetry 會辨識「同一回合先發動技能、後續再宣告同一擊倒攻擊」的成功轉換，不會把它
  誤算成 missed lethal。
- AI 策略版本更新為 `lv5-defense-retention-endgame-v2`，匯出的 replay 可區分這批資料。

## 根因與邊界

在固定的 Blue 對 Blue replay 中，AI 有時先發動例如 Dark Choco Cookie 的技能，再於同一
回合宣告攻擊。原本 telemetry 只檢查「下一個決策」是否為攻擊，因此把這種合法且實際完成
的擊倒記成 missed lethal。

同時，`ActionScore` 的 replay reason 以 `attacker.card.attack` 判讀；像 The Sunblade 等公開
修正會使規則層可造成的傷害高於卡面基礎值，造成 reason 誤寫為非致命。Lv.5 的 R9 beam
本來已使用規則層傷害，本次讓 replay、分數說明和 metrics 對齊，而不加入隱藏資訊。

## 固定回歸

- `lv3-strategy.test.ts`：公開修正後的宣告傷害會標記為 public lethal。
- `lv4-search.test.ts`：搜尋 hook 傳入的公開宣告傷害會影響擊倒評分。
- `ai-g4-telemetry.test.ts`：固定 Blue 對 Blue 對局的 public lethal 機會全部在同回合轉換，
  不再列為 missed lethal。

## Arena 同 seed 回歸

方法：`BS7_AI_LEVEL=5`、每個參考牌組 10 場、seed `20260827`；修正前後皆為 250 場。

| 顏色 | 修正前 | 修正後 | 差異 |
| --- | ---: | ---: | ---: |
| Red | 23 / 50 | 23 / 50 | 0 |
| Yellow | 27 / 50 | 27 / 50 | 0 |
| Green | 23 / 50 | 23 / 50 | 0 |
| Blue | 17 / 50 | 17 / 50 | 0 |
| Purple | 23 / 50 | 23 / 50 | 0 |
| 合計 | 113 / 250 | 113 / 250 | 0 |

兩次基準的 `stuck`、`invalid`、`deadlock` 與 `turn cap` 均為 0。勝率不變符合預期：本次修正
沒有改動 R9 的既有搜尋選擇，只讓公開評分、replay reason 與遙測結果忠實反映已宣告的動作。

## Player-perspective telemetry

Arena 報表保留原本整局彙總的 `behavior`（供健康 gate 使用），並新增
`candidateBehavior`／`referenceBehavior`。兩者依每個 paired run 的實際控制玩家彙整，包含
public lethal 機會／轉換、合法攻擊跳過、低品質補位、終局預測與 Lv.4/5 search telemetry；
search 原始耗時也分開保存，讓跨對局 p95 仍可正確計算。

同一 `20260827` 矩陣中，候選方的 public lethal 轉換為 Red 233／233、Yellow 364／364、
Green 314／314、Blue 286／286、Purple 294／295。Blue 的低勝率因此不能歸咎於漏掉公開
擊倒；其 17／50 主要來自對 Yellow 1／10、Red 2／10 與 BS6 Blue 0／10。這是可重現的
診斷訊號，但每個 matchup 僅 10 場，尚不足以直接加入顏色或卡號特判。後續策略權重改動
必須以更大的獨立 holdout 驗證。

## 已驗證範圍與限制

- 目標單元測試 5 個檔案、26 個測試通過。
- 完整 Vitest 229 個檔案、3,612 個測試通過。
- TypeScript typecheck 通過。
- Production build 與 AI Browser 固定 20 場通過，`stuck=0`。
- 上述 matched Arena 500 場均正常結束。
- 尚未因此升格 Lv.5 強度；需先完成 player-perspective telemetry，再以獨立 holdout seed
  評估任何後續策略改動。
