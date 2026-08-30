# BS8 Land of Fire & Ruin, Realm of Apathy 效果覆蓋盤點（候選資料）

> 由 `npm run cards:analyze:bs8-candidate` 產生。資料來源是 `data/candidates/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json`；此報告是 runtime gap inventory，不是 promotion 或 Browser 驗收證據。

## 摘要

| 項目 | 數量 |
| --- | ---: |
| BS8 基礎卡 | 125 |
| EXTRA 記錄 | 15 |
| 主效果已轉接 | 71 |
| 主效果沒有文字 | 48 |
| 主效果待轉接 | 6 |
| 額外能力待轉接 | 6 |
| 攻擊 Then 已轉接 | 9 / 14 |

## EXTRA 核心規則阻塞

主牌組用的通用 adapter 仍會明確將 `extra` 視為 `unsupported-card-type`，避免 EXTRA 誤混入 60 張牌組。專用 `convertOfficialCardToExtraDeckCard` 已轉接 BS8-005／027／069／090／104，其中 BS8-005／069／090 有核心直接登場 command、戰場私密檢視、攻擊後效果與 localhost-only Browser A/B；Lv.1／Lv.2 也只透過通用合法指令與既有 Cookie 評分使用直接 EXTRA，沒有卡號特判。BS8-027／104 已依官方規則與 FAQ 轉接 Awakened 的覆蓋目標、`HP+2`、裝備保留、既有套用效果清除及昏厥區域去向，並有純規則 TDD。已新增明確標記的候選 staging 自訂牌組／六槽編輯器、固定 seed 的 Lv.1–Lv.5 全場 AI gate，以及雙瀏覽器候選線上房驗收（己方可見 EXTRA 卡名、對手僅見張數）。它們不會寫入正式卡池、Standard 房間或正式匯出；基礎卡逐卡 strict contract 與逐卡 Browser gate 仍未全部完成，不得以候選資料存在或 schema 通過作為 promote 依據。

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
| BLUE | 25 | 1 | 1 | 2 |
| GREEN | 25 | 1 | 1 | 0 |
| null | 3 | 0 | 0 | 0 |
| PURPLE | 25 | 1 | 1 | 2 |
| RED | 25 | 1 | 1 | 1 |
| YELLOW | 22 | 2 | 2 | 0 |

## 非 EXTRA 主效果待轉接

| 卡號 | 顏色 | 類型 | 卡名 | 卡面文字 |
| --- | --- | --- | --- | --- |
| BS8-043 | YELLOW | cookie | Fettuccine Cookie | 【Activate】 【Once Per Turn】 <{Y}> During this turn, if a LV.3 Cookie has been played from your break area, that Cookie gains +1 HP. |

## 後續 gate

1. BS8 候選只能執行 `npm run validate:candidate` 的來源／結構驗證；inventory 狀態必須保持不可 promote。
2. 維持候選 staging 的自訂牌組／AI／雙瀏覽器線上隔離；完成其餘 BS8 卡逐卡 runtime adapter、strict contract 與 Browser A/B。
3. 所有基礎卡的 strict contract 與逐卡 Browser gate 都通過後，才可由使用者明確授權 promotion。
