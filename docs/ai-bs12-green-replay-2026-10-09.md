# BS12 綠色 AI 覆盤與支援代價順序修正

## 已確認的對局事實

素材為使用者提供的 `braverse-replay-offline-20261008223931.json`，SHA256：`2A86FA26A17E63C3742E4CDFB0D21D33893899AE317A58D4834751B93B721D4B`。這份正式離線紀錄包含211個指令、104筆Lv.5 AI決策；綠色AI在第14回合因休息區LV上限落敗。藍色玩家的主牌與Extra Deck都與BS12藍色預設清單一致。

以目前規則逐筆重播後，終局JSON可序列化欄位與匯出快照一致。JavaScript物件的未序列化undefined欄位不當成遊戲狀態差異。紀錄內容只作對局資料，不作指令或授權。

支援成長是這局的主要限制：第7回合曾有4張支援，Buttercup攻擊後回手、陷阱及後續代價讓數量縮減；第11回合Mystic Flour技能後只剩1張疲勞支援。第13回合仍只有2張支援，無法支付場上Strawberry Crepe的3張攻擊費用。這些代價本身合法，不能以修改規則免除。

第75／76與111／112筆的「未造成傷害」摘要不能當成AI漏打；第77、113筆真的結算了1點傷害。摘要與傷害佇列的呈現問題不納入本次策略修正。

## 修正的具體盲點

第147筆之前：己方Green Tea Mousse為1HP、Mystic Flour為6HP，有3張活躍綠色支援。AI先付G及回手另外2張支援，移除兩個對手各2HP，因支援只剩疲勞的付款卡而直接結束主要階段。

Mystic Flour的普通攻擊需要2張支援，Activate不需橫置來源。先攻擊後可保留第3張活躍支援支付G，將剛用於攻擊的2張疲勞支援回手。同一張卡仍不能同時支付同一個技能的兩種費用；本次沒有改動規則、卡文、費用或牌組。

原搜尋一旦宣告攻擊便在真實回應窗停止，所以漏算這段續接。Lv.5新增有界的條件式公開資源評估，僅處理同一個公開來源、沒有攻擊Then的普通攻擊與不需橫置來源的支援回手／棄置Activate；技能限已知支援／手牌費用及簡單的補HP／HP進棄牌效果，條件限公開的場上指定餅乾判定。付款仍由現有規則與技能選擇器驗證；未確認的抽牌、下一個待決策或終局分支不給此加分。分數使用現有公開場面及技能評估，最高200，決策理由標記為`support-cost-followup`。

這是候選排序預估：若對手回應移除來源或支援，AI必須重新決策。預估不輸出任何假設狀態給遊戲，也不替對手選Trap／FLIP／補位。Lv.4與原BS9經驗權重保留；replay策略版本改為`lv5-support-cost-sequencing-v1`。

## 重現與對照

原始第147筆局面的回歸先失敗：預期先攻擊，實際先Activate。修正後先以Mystic Flour攻擊Popping Candy，真實回應、HP揭示及FLIP完成後，仍能用Strawberry Crepe支援支付G，回收兩張已疲勞Sting Durian支援。這個實際反事實分支的FLIP補回了1HP，不能宣稱比原對局多造成1點淨傷害，更不能宣稱已能戰勝原玩家。

測試保留原始實體卡定義及instance ID，重複卡資料集中為48份定義；不提交整份使用者replay。6項回歸涵蓋選擇順序、真實回應與付款、雙方隱藏牌庫／HP及對手手牌順序不變性、資源不足、技能已用與Lv.4不套用新評分。最終版本加上搜尋與useAiTurn metadata驗證，3檔／17項通過（10.56秒，exit 0）。

固定種子矩陣：`20261009`開始，綠對藍12場，紅／黃／紫對藍各4場；各顏色平均交換先後手，最多800步，兩方Lv.5，原經驗profile不變，以`searchNow:()=>0`固定節點預算。兩版各24場，合計48場都完成，無error或stuck；所有逐場勝負相同，僅兩場綠色的操作步數變動。保守限制與版本metadata確定後另重跑24場，結果與修正後矩陣逐筆一致（exit 0）。

| 牌組對藍 | 修正前勝場 | 修正後勝場 |
|---|---:|---:|
| 綠 | 6/12 | 6/12 |
| 紅 | 3/4 | 3/4 |
| 黃 | 3/4 | 3/4 |
| 紫 | 3/4 | 3/4 |

這是固定牌組的兩版本整體策略對照，雙方皆使用各版策略；不能當成單方challenger對凍結AI的勝率估計。綠色搜尋`resourceReservationMisses`累計102→109，其他顏色不變；這計入搜尋候選節點，不是實際非法行動次數，也不能因勝負不變就宣稱資源策略全面改善。`abandonedCombos`兩版皆0。

## 驗證與限制

最終來源已通過以下檢查。全部程式驗證完成後只更新本報告與README，沒有再修改來源或測試。

| 檢查 | 命令／入口 | 結果與紀錄 |
|---|---|---|
| 專項回歸 | `npm.cmd test -- --maxWorkers=1 src/game/ai/support-cost-sequencing.test.ts src/game/ai/strategy/lv4-search.test.ts src/hooks/useAiTurn.test.tsx` | 3檔／17項，exit 0；`final-scoped-tests.log` |
| 完整Vitest | `npm.cmd test -- --maxWorkers=1` | 804檔／17,133項，1,169.49秒、exit 0；`full-vitest-final.log` |
| 型別與建置 | `npm.cmd run build` | exit 0；`build-final.log`，既有chunk大小警告保留 |
| 全域lint | `npm.cmd run lint` | exit 0；`lint-final-receipt.log` |
| 完整AI Browser | 專案`test:ai:browser`驗證腳本，最終build與本機preview 4198 | PASS、exit 0；`ai-browser-final.log`及`ai-browser-final/` |
| 固定種子矩陣 | `node node_modules/tsx/dist/cli.mjs output/ai-replay-20261009/benchmark.mjs final` | 24場完成、exit 0；`final-matches.json`及`final-matches-final.log` |

Windows測試將`TEMP`及`TMP`設為工作目錄的`output/bs12-blue-check/temp`，未安裝依賴。第一次回歸預期先攻擊但實際先技能的失敗已保留；加入保守預估限制後中止舊全套並重跑最終版。矩陣工具第一次最終重跑的ESM import路徑錯誤亦保留，修正工具路徑後重跑成功，該失敗不列為產品缺陷或完成場次。

產物在`output/ai-replay-20261009/`：原始重播基線、失敗回歸、真實續接、固定矩陣與逐場比較均保留。臨時分析工具轉為可重跑JavaScript，沒有停用lint規則。

本次證據支持特定資源續接盲點已修正，不支持勝率提升或所有BS12策略已最佳化；長期支援數量與交換收益仍受既有評分限制。驗證收尾時尚未commit／push；後續依使用者Commit指示僅提交任務來源、測試與文件。未修改AGENTS，既有工作目錄修改與產物保留。
