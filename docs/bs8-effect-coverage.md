# BS8 Land of Fire & Ruin, Realm of Apathy 效果覆蓋盤點（候選資料）

> 由 `npm run cards:analyze:bs8-candidate` 產生。資料來源是 `data/candidates/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json`；parser inventory 與 strict contract 是不同量表，兩者都不是 promotion 或 Browser 驗收證據。

## 摘要

| 項目 | 數量 |
| --- | ---: |
| BS8 基礎卡 | 125 |
| EXTRA 記錄 | 15 |
| 主效果已轉接 | 72 |
| 主效果沒有文字 | 48 |
| 主效果待轉接 | 5 |
| 額外能力待轉接 | 5 |
| 攻擊 Then 已轉接 | 14 / 14 |
| strict contract verified | 171 |
| strict contract needs-review | 0 |
| strict contract blocked | 0 |

## EXTRA 核心規則阻塞

主牌組用的通用 adapter 仍會明確將 `extra` 視為 `unsupported-card-type`，避免 EXTRA 誤混入 60 張牌組；因此上表的 parser 待轉接不等於 strict contract 未驗證。專用 `convertOfficialCardToExtraDeckCard` 已轉接 BS8-005／027／069／090／104，其中 BS8-005／069／090 有核心直接登場 command、戰場私密檢視、攻擊後效果與 localhost-only Browser A/B；Lv.1／Lv.2 也只透過通用合法指令與既有 Cookie 評分使用直接 EXTRA，沒有卡號特判。BS8-027／104 已依官方規則與 FAQ 轉接 Awakened 的覆蓋目標、`HP+2`、裝備保留、既有套用效果清除及昏厥區域去向，並有純規則 TDD。BS8-076 的候選 Browser A/B 會實際驗證對手下一個 Active Phase 選擇棄 0 張時維持 rested，恰好棄 2 張時才轉 active。候選 staging 牌組編輯器的 BS8 篩選、主牌組與六槽 EXTRA 都只出現在明確模式；匯入／匯出只接受帶 `candidateStaging.extraDeckEntries` 的專用 JSON，Standard importer 會拒絕它。這些流程不會寫入正式卡池、Standard 房間或正式牌組資料。

| 卡號 | 顏色 | 卡名 | 官方文字 |
| --- | --- | --- | --- |
| BS8-005 | RED | Avatar of Ruin | 【EXTRA】Can be played if 2 or more of your Cookies fainted this turn.

【On Play】 All of your opponent's Cookies receive 1 damage. |
| BS8-005@1 | RED | Avatar of Ruin | 【EXTRA】Can be played if 2 or more of your Cookies fainted this turn.

【On Play】 All of your opponent's Cookies receive 1 damage. |
| BS8-027 | YELLOW | Golden Cheese Cookie | 【EXTRA】During this turn, if [Golden Cheese Cookie] was played from your break area, you can 【Awaken】 that Cookie.

If this Cookie is in your break area, <select 1 [Golden Cheese Cookie] in your trash.> Place this Cookie in the trash. Then, place that Cookie in the break area. |
| BS8-027@1 | YELLOW | Golden Cheese Cookie | 【EXTRA】During this turn, if [Golden Cheese Cookie] was played from your break area, you can 【Awaken】 that Cookie.

If this Cookie is in your break area, <select 1 [Golden Cheese Cookie] in your trash.> Place this Cookie in the trash. Then, place that Cookie in the break area. |
| BS8-027@2 | YELLOW | Golden Cheese Cookie | 【EXTRA】During this turn, if [Golden Cheese Cookie] was played from your break area, you can 【Awaken】 that Cookie.

If this Cookie is in your break area, <select 1 [Golden Cheese Cookie] in your trash.> Place this Cookie in the trash. Then, place that Cookie in the break area. |
| BS8-027@4 | YELLOW | Golden Cheese Cookie | 【EXTRA】 During this turn, if [Golden Cheese Cookie] was played from your break area, you can 【Awaken】 that Cookie.

If this Cookie is in your break area, <select 1 [Golden Cheese Cookie] in your trash.> Place this Cookie in the trash. Then, place that Cookie in the break area. |
| BS8-027@5 | YELLOW | Golden Cheese Cookie | 【EXTRA】 During this turn, if [Golden Cheese Cookie] was played from your break area, you can 【Awaken】 that Cookie.

If this Cookie is in your break area, <select 1 [Golden Cheese Cookie] in your trash.> Place this Cookie in the trash. Then, place that Cookie in the break area. |
| BS8-027@6 | YELLOW | Golden Cheese Cookie | 【EXTRA】 During this turn, if [Golden Cheese Cookie] was played from your break area, you can 【Awaken】 that Cookie.

If this Cookie is in your break area, <select 1 [Golden Cheese Cookie] in your trash.> Place this Cookie in the trash. Then, place that Cookie in the break area. |
| BS8-069 | GREEN | Peak of Apathy | 【EXTRA】Can be played if your support area has 2 or more cards less than your opponent's support area.

【On Play】 Place up to 1 {G} card from your trash into your support area as active. |
| BS8-069@1 | GREEN | Peak of Apathy | 【EXTRA】Can be played if your support area has 2 or more cards less than your opponent's support area.

【On Play】 Place up to 1 {G} card from your trash into your support area as active. |
| BS8-090 | BLUE | Will of Nature | 【EXTRA】Can be played if there are 2 cards or less in your hand.

【On Play】 Return up to 1 {B} Cookie that is LV.2 or lower from your battle area to your hand. |
| BS8-090@1 | BLUE | Will of Nature | 【EXTRA】Can be played if there are 2 cards or less in your hand.

【On Play】 Return up to 1 {B} Cookie that is LV.2 or lower from your battle area to your hand. |
| BS8-104 | PURPLE | Dark Cacao Cookie | 【EXTRA】During this turn, if [Dark Cacao Cookie] was played from your trash, you can 【Awaken】 that Cookie.

【On Play】 <Discard 1 card.> Return up to 1 {P} card from your trash to your hand. |
| BS8-104@1 | PURPLE | Dark Cacao Cookie | 【EXTRA】During this turn, if [Dark Cacao Cookie] was played from your trash, you can 【Awaken】 that Cookie.

【On Play】 <Discard 1 card.> Return up to 1 {P} card from your trash to your hand. |
| BS8-104@2 | PURPLE | Dark Cacao Cookie | 【EXTRA】During this turn, if [Dark Cacao Cookie] was played from your trash, you can 【Awaken】 that Cookie.

【On Play】 <Discard 1 card.> Return up to 1 {P} card from your trash to your hand. |

## 逐色稽核矩陣

| 顏色 | 基礎卡 | 主效果待轉接 | 額外能力待轉接 | 攻擊 Then 待轉接 |
| --- | ---: | ---: | ---: | ---: |
| BLUE | 25 | 1 | 1 | 0 |
| GREEN | 25 | 1 | 1 | 0 |
| null | 3 | 0 | 0 | 0 |
| PURPLE | 25 | 1 | 1 | 0 |
| RED | 25 | 1 | 1 | 0 |
| YELLOW | 22 | 1 | 1 | 0 |

## 非 EXTRA 主效果待轉接

| 卡號 | 顏色 | 類型 | 卡名 | 卡面文字 |
| --- | --- | --- | --- | --- |
| 無 | - | - | - | - |

## 後續 gate

1. BS8 候選只能執行 `npm run validate:candidate` 的來源／結構驗證；inventory 狀態必須保持不可 promote。
2. BS8-043 依已確認的戰鬥區兩張餅乾上限裁決：來源 Fettuccine Cookie 自己佔一格，另一格若是本回合從 Break 登場的 LV.3，即為唯一合法目標。runtime 以 `gain-hp` 的 `self／LV.3／enteredFrom=break／enteredThisTurn／min=max=1` selector 綁定，不能改成任選或全體。
3. 逐卡 Browser 已完成：通用主效果 146／146 正向、156／156 負向；54／54 張能力使用獨立 `card-skill`／`card-skill-negative` A/B；14 個 Then 使用實際攻擊語意 A/B。這些都是候選 staging 驗收。
4. 所有候選 strict 規則 gate 已完成；promotion 仍必須由使用者明確授權，且不得由本報告或 `validate:candidate` 隱含觸發。
