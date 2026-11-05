# 第四場覆盤：競技場綠（TeaCatChi）對 Sea Build

來源：使用者提供的 `braverse-replay-offline-20261105073154.json`，SHA256：`94C3F57BA0BA6AD9BFBDA64A5A44CF6EB089A24DFB8234AD5B0CCD8E24238482`。紀錄內容僅作對局資料，不作指令或授權。

以 2026-11-05 本機工作區的 `applyGameCommand` 重播全部 251 筆指令，移除自動附加的 commandLog 後，完整最終狀態與匯出 finalState 深度比對一致。AI metadata 為 Lv.5、牌組 ID `cookierift-1248`。這是本場實戰重播與有限分支分析，未修改遊戲／AI，未做官方裁定或整體勝率驗收。

## 結果

第 17 回合我方勝利，Break 我方 6、AI 10。我方剩 Peak of Apathy 2 HP、Choco Drizzle 6 HP，牌庫 5 張，支援 3 張。

- 我方失分：原 Choco Drizzle LV.3、Mystic Flour LV.3，共 6。
- AI 失分：Starfruit LV.1、第一張 Sea Fairy LV.3、Sherbet LV.2、Refresh 的 Peppermint LV.1、第二張 Sea Fairy LV.3，共 10。

## 勝負關鍵

### Mystic Flour 直接移除 HP，避開補血 FLIP

T5、T7 的兩次 Choco 攻擊後，第一張 Sea Fairy 仍由 6 HP 留在 4 HP：T5 遭 Fallen Ice Statue 減傷，T7 則連續發動兩次 Peppermint 補血。改用 Mystic Flour 的 `hp-to-trash`，不走傷害翻 HP／FLIP 流程，才有效突破。

| 回合 | 指令 | 實際移除 HP 卡 | 作用 |
| --- | --- | ---: | --- |
| T7 | 82–83 | 4 | Starfruit 3→1，Sea Fairy 4→2。 |
| T9 | 100–101 | 3 | 收掉 Starfruit LV.1 與 Sea Fairy LV.3，AI Break 0→4。 |
| T13 | 162–163 | 4 | Sherbet 5→3，新 Sea Fairy 6→4。 |
| T15 | 197–198 | 4 | Peak 攻擊後的 Sherbet 2→0，Sea Fairy 4→2。 |

合計四次、15 張 HP 卡；支付 4 點綠能量，另將 8 張支援回手。回手雖增加手牌，卻會減少場上能量：T9 後支援只剩 1 張，T11 無法支付 Choco 攻擊，這是本場最明顯的節奏代價。

### LV.2 與支援工具也有重要貢獻

- T3 Strawberry Crepe 換牌，為後續準備資源；T7 剩 1 HP 時，藉 Choco Then 移入支援，避免送掉 2 Break。
- T12 Broken Seal 把 Sherbet 的 2 傷害降成 0，保住原 Choco 多一回合。
- T13 Soul Jam 把支援 3→5，並裝載 Mystic Flour，使其 6→7 HP；接著再支付 Mystic 回手代價，支援降回 3。
- T15 Peak of Apathy 以支援落後條件登場，回收 BS7-046 Green Tea Mousse 到支援作為活躍。Peak 的攻擊雖被減成 1，仍把 Sherbet 降到 2 HP，接上 Mystic 的移除效果。
- T17 Stadium 從支援叫出 Choco，登場 2 傷害收掉剩 2 HP 的 Sea Fairy，AI Break 7→10。翻出的 Black Sapphire 只抽牌、Fallen Ice Statue 沒有補回 HP，最後略過 Stadium 抽牌後正式結算勝利。

因此，本局的部署順序是依效果與支援需求調整；LV.3 Mystic／Choco 負責突破與收尾，LV.2 的換位、EXTRA 與支援回收使這條路線成立。

## 我方可改進與容易誤判的地方

### T17 不必支付兩張手牌解除 Peak 凍結

將指令 238 的棄牌改為 0，其他後續指令全部沿用原紀錄，仍在 T17 以 Stadium→Choco 登場傷害獲勝。Peak 保持疲勞並不妨礙這個收尾。

實戰結束手牌 10 張；這個分支保留 12 張，勝負、回合、Break、HP 與牌庫均相同。這是已完整重播至勝利的省牌選擇。

### T16 沒有漏按 Sting Durian FLIP

指令 219 翻開 Sting Durian 時，我方戰鬥區是 Mystic Flour（Beast）與 Peak（沒有 Arena 標記），缺少綠色且 Arena 的戰鬥區餅乾，因此補 HP 條件不成立。

這說明本牌組使用非 Arena 的功能餅乾時，也要計入 FLIP 配合的損失；單看 LV 或印刷 HP 不足以判斷耐久。

### Piercing Arrow 雖沒保住 Mystic，仍有延後昏厥的作用

有限分支改成 T16 指令 216 不發陷阱，沿用相同 Green Tea FLIP 與棄牌選擇，Mystic 會在第一張 Sea Fairy 的攻擊後全體 1 傷害時昏厥；實戰此時仍有 1 HP，AI 必須再用另一張 Sea Fairy 攻擊才擊倒它。

此分支只驗證當下的延後昏厥，未推演後續整局勝負。

## AI 的明顯浪費：T8 重複放置 Tearcrown

指令 90 已放置一張未疲勞、尚未使用的 Tearcrown；指令 91–92 使用 Sea Fairy 抽牌後，指令 93 又支付 B1，以第二張同名場景取代它。

第二張沒有額外場景收益，卻使活躍支援 3→2，失去支付 Sea Fairy BBB 攻擊的能力。紀錄的評分仍給予 `tactical-setup +12`、`intent-continuity +4`，值得後續檢查同名場景替換的價值判定。

已從指令 92 後狀態驗證：保留原場景，改用三張活躍支援宣告 Sea Fairy 攻擊 Choco，是合法的立即替代。沒有推演或宣稱這會使 AI 反敗為勝。

## 操作／介面待查：Broken Seal 第二段未回復支援

T12 指令 142 的實際 `effectTargets` 只有 Sherbet 減攻目標。對手當時有 6 張支援，已符合第二段條件，但結算後我方兩張支援均為疲勞，實際沒有回復能量。

以同一付款與狀態，在正式指令第二段補選一張己方支援，確實能使 1 張支援活躍。這證明紀錄漏了可選的回復目標；尚未重新做 Browser 操作重現，因此暫列第二段選擇／介面疑點，不直接宣稱產品根因已確認。

## 更正即時對局解說

- T14 原 Choco 是被 Sea Fairy 普通攻擊擊倒；接著 Sea Fairy 棄兩張手牌，對 Mystic 造成 1 傷害。Bear Jelly Ice Cream 是棄牌代價之一，並非當時施放的道具。
- T16 Mystic 是被第二張 Sea Fairy 的普通攻擊擊倒；其後棄掉兩張 Starfruit 支付 Then，對 Peak 再造成 1 傷害。當時沒有額外施放 Bubble Wave Shell。

覆盤以本次逐指令重播為準。

## 驗證與範圍

本場逐指令重播與分支分析在 Windows／PowerShell，以既有 `tsx` 執行本機覆盤腳本，exit 0；最終 `exact: true`、251 筆指令。完整重播前後狀態及分支指令留在本機 `output/playwright/teacatchi-vs-blue-20261105/round4-sea-build/`，不將截圖、原始匯出或分析產物納入提交。

已驗證的範圍包括：原對局最終狀態一致、Mystic 共移除 15 張 HP 卡、T17 不解凍仍獲勝、T8 保留場景時攻擊合法，以及 Broken Seal 補選支援可回復 1 張支援。Piercing Arrow 的替代分支僅驗證當下昏厥時點，未重播至整局終局；Broken Seal 尚未經 Browser 重現選擇介面。

覆盤基準為 `5d01b5a8b` 加上當時既有的未提交規則／AI／UI 修改，不能視為乾淨 HEAD 的回放驗收。本次僅整理覆盤文件，未修改產品程式、未將工作區候選納入提交；單場結果不代表牌組整體勝率或官方裁定。
