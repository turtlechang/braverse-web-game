# BS5 效果轉接覆蓋盤點

> 由 `npm run cards:analyze:bs5-candidate` 產生。資料來源仍是 `data/candidates/` 的 `inventory` 候選快照；此報告是 runtime 與 Chrome 稽核待辦，不代表可 promote。

## 摘要

| 項目 | 數量 |
| --- | ---: |
| BS5 基礎卡 | 111 |
| 主效果已轉接 | 55 |
| 主效果沒有文字 | 31 |
| 主效果待轉接 | 25 |
| 額外能力已轉接 | 57 |
| 額外能力待轉接 | 23 |
| 攻擊 Then 已轉接 | 16 / 26 |

## 逐色稽核矩陣

| 顏色 | 基礎卡 | 主效果待轉接 | 額外能力待轉接 | 攻擊 Then 待轉接 |
| --- | ---: | ---: | ---: | ---: |
| BLUE | 22 | 14 | 13 | 4 |
| GREEN | 22 | 0 | 0 | 0 |
| PURE | 1 | 1 | 1 | 0 |
| PURPLE | 22 | 10 | 9 | 6 |
| RED | 22 | 0 | 0 | 0 |
| YELLOW | 22 | 0 | 0 | 0 |

## 主效果待轉接

| 卡號 | 顏色 | 類型 | 卡名 | 卡面文字 |
| --- | --- | --- | --- | --- |
| BS5-068 | BLUE | cookie | GingerBright | If this Cookie remains in the battle area after receiving damage, draw up to 1 card from your deck. |
| BS5-070 | BLUE | cookie | Peppermint Cookie | 【On Play】 Select up to 1 Cookie in your opponent's battle area. Return that Cookie to your opponent's hand. |
| BS5-071 | BLUE | cookie | Lotus Dragon Cookie | 【Activate】 【Once Per Turn】 <Discard 3 or more {B} cards.> If your break area is LV.2 or higher, select up to 1 of your opponent's Cookies. That Cookie receives 2 damage. |
| BS5-072 | BLUE | cookie | Gumball Cookie | When this Cookie faints and your break area is LV.6 or higher, draw up to 2 cards from your deck. |
| BS5-074 | BLUE | cookie | Sorbet Shark Cookie | 【On Play】 <{B}> Draw up to 2 cards from your deck. |
| BS5-075 | BLUE | cookie | Hydrangea Cookie | 【On Play】 If there are 5 cards or more in your hand, select up to 1 of your opponent's rested LV.2 or lower Cookies. That Cookie receives 2 damage. |
| BS5-076 | BLUE | cookie | Cream Puff Cookie | 【Activate】 <{B}> <Rest this card.> <Discard 1 card.> Select up to 1 LV.1 Cookie in your opponent's battle area that does not have 【Skill】. Make that Cookie faint. |
| BS5-078 | BLUE | cookie | Aloe Cookie | 【On Play】 <{B}> Draw up to 1 card from your deck. |
| BS5-081 | BLUE | cookie | Squid Ink Cookie | 【Once Per Turn】 When your opponent's Cookie attacks, <discard 4 cards.> During this battle, this Cookie's HP cannot reach 0. |
| BS5-083 | BLUE | cookie | Bell Pepper Cookie | 【On Play】 <Discard your entire hand.> This Cookie gains +2 HP. Draw up to 1 card from your deck. |
| BS5-084 | BLUE | cookie | Apple Cookie | 【Activate】 <Rest this card.> <Discard 1 card.> Select up to 1 of your other {B} Cookies. Set that Cookie as active. |
| BS5-086 | BLUE | item | Tales of the Lotus | <{B}{B}> If there is 1 Cookie in your battle area, view 3 cards from the top of your deck and select up to 1 {B} Cookie from the viewed cards. Play that Cookie with +1 HP. Then, place the remaining cards on the bottom of your deck in any order. |
| BS5-087 | BLUE | trap | Dino Greetings | <{B}{B}> Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -1 attack damage. Then, if your break area is LV.6 or higher, draw up to 2 cards from your deck. |
| BS5-088 | BLUE | stage | Lotus Palace | <{B}> Place in your stage area.

【Activate】 <{B}> <Rest this card.> If there are 3 cards or less in your hand, select up to 1 of your Cookies. During this turn, that Cookie gains +1 attack damage. Then, if [Lotus Dragon Cookie] is in your battle area, draw up to 2 cards from your deck. |
| BS5-091 | PURPLE | cookie | Lilac Cookie | 【On Play】 If there are 15 cards or more in your trash, select up to 1 of your opponent's rested LV.2 or lower Cookies. That Cookie receives 2 damage. |
| BS5-098 | PURPLE | cookie | Centipede Cookie | When your turn ends, place 1 card from the top of this Cookie's HP into the trash. |
| BS5-100 | PURPLE | cookie | Yogurt Cream Cookie | When this Cookie is placed from the battle area into the trash, view 3 cards from the top of your deck, reveal up to 1 {P} card from the viewed cards, and add it to your hand. Then, place the remaining cards in the trash. |
| BS5-101 | PURPLE | cookie | GingerBrave | 【On Play】 If there are 10 cards or more in your trash, select up to 1 of your opponent's Cookies. Place 1 card from the top of that Cookie's HP into the trash. |
| BS5-102 | PURPLE | cookie | Purple Yam Cookie | 【On Play】 Place up to 3 cards from the top of your deck into the trash. |
| BS5-104 | PURPLE | cookie | Chili Pepper Cookie | 【On Play】 Both players place 2 cards from the top of their decks into the trash. |
| BS5-107 | PURPLE | cookie | Red Pepper Cookie | When this Cookie faints, both players place 2 cards from the top of their decks into the trash. |
| BS5-108 | PURPLE | item | Rambirdtan Handler Glove | <{P}> View 3 cards from the top of your deck, reveal up to 1 {P} Cookie from the viewed cards, and add it to your hand. Then, place the remaining cards in the trash. |
| BS5-109 | PURPLE | trap | Charmed Miners | <{P}> Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -1 attack damage. Then, if there are 15 cards or more in your trash, select up to 1 of your opponent's LV.1 Cookies. During this turn, that Cookie deals -1 attack damage. |
| BS5-110 | PURPLE | stage | Lychee Dragon Cookie's Cave | <{P}> Place in your stage area.

【Activate】 <{P}> <Rest this card.> Place up to 2 cards from the top of your deck into the trash. Then, if [Lychee Dragon Cookie] is in your battle area, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. |
| BS5-111 | PURE | item | Wrath of the Dragons | <{N}> 【Equip】 this card to one of your 【Dragon】 Cookies. If that Cookie's remaining HP is 3 or less, that Cookie gains +1 attack damage and receives -1 attack damage. |

## 額外能力待轉接

| 卡號 | 顏色 | 類型 | 卡名 | 卡面文字 |
| --- | --- | --- | --- | --- |
| BS5-068 | BLUE | cookie | GingerBright | If this Cookie remains in the battle area after receiving damage, draw up to 1 card from your deck. |
| BS5-070 | BLUE | cookie | Peppermint Cookie | 【On Play】 Select up to 1 Cookie in your opponent's battle area. Return that Cookie to your opponent's hand. |
| BS5-071 | BLUE | cookie | Lotus Dragon Cookie | 【Activate】 【Once Per Turn】 <Discard 3 or more {B} cards.> If your break area is LV.2 or higher, select up to 1 of your opponent's Cookies. That Cookie receives 2 damage. |
| BS5-072 | BLUE | cookie | Gumball Cookie | When this Cookie faints and your break area is LV.6 or higher, draw up to 2 cards from your deck. |
| BS5-074 | BLUE | cookie | Sorbet Shark Cookie | 【On Play】 <{B}> Draw up to 2 cards from your deck. |
| BS5-075 | BLUE | cookie | Hydrangea Cookie | 【On Play】 If there are 5 cards or more in your hand, select up to 1 of your opponent's rested LV.2 or lower Cookies. That Cookie receives 2 damage. |
| BS5-076 | BLUE | cookie | Cream Puff Cookie | 【Activate】 <{B}> <Rest this card.> <Discard 1 card.> Select up to 1 LV.1 Cookie in your opponent's battle area that does not have 【Skill】. Make that Cookie faint. |
| BS5-078 | BLUE | cookie | Aloe Cookie | 【On Play】 <{B}> Draw up to 1 card from your deck. |
| BS5-081 | BLUE | cookie | Squid Ink Cookie | 【Once Per Turn】 When your opponent's Cookie attacks, <discard 4 cards.> During this battle, this Cookie's HP cannot reach 0. |
| BS5-083 | BLUE | cookie | Bell Pepper Cookie | 【On Play】 <Discard your entire hand.> This Cookie gains +2 HP. Draw up to 1 card from your deck. |
| BS5-084 | BLUE | cookie | Apple Cookie | 【Activate】 <Rest this card.> <Discard 1 card.> Select up to 1 of your other {B} Cookies. Set that Cookie as active. |
| BS5-086 | BLUE | item | Tales of the Lotus | <{B}{B}> If there is 1 Cookie in your battle area, view 3 cards from the top of your deck and select up to 1 {B} Cookie from the viewed cards. Play that Cookie with +1 HP. Then, place the remaining cards on the bottom of your deck in any order. |
| BS5-088 | BLUE | stage | Lotus Palace | <{B}> Place in your stage area.

【Activate】 <{B}> <Rest this card.> If there are 3 cards or less in your hand, select up to 1 of your Cookies. During this turn, that Cookie gains +1 attack damage. Then, if [Lotus Dragon Cookie] is in your battle area, draw up to 2 cards from your deck. |
| BS5-091 | PURPLE | cookie | Lilac Cookie | 【On Play】 If there are 15 cards or more in your trash, select up to 1 of your opponent's rested LV.2 or lower Cookies. That Cookie receives 2 damage. |
| BS5-098 | PURPLE | cookie | Centipede Cookie | When your turn ends, place 1 card from the top of this Cookie's HP into the trash. |
| BS5-100 | PURPLE | cookie | Yogurt Cream Cookie | When this Cookie is placed from the battle area into the trash, view 3 cards from the top of your deck, reveal up to 1 {P} card from the viewed cards, and add it to your hand. Then, place the remaining cards in the trash. |
| BS5-101 | PURPLE | cookie | GingerBrave | 【On Play】 If there are 10 cards or more in your trash, select up to 1 of your opponent's Cookies. Place 1 card from the top of that Cookie's HP into the trash. |
| BS5-102 | PURPLE | cookie | Purple Yam Cookie | 【On Play】 Place up to 3 cards from the top of your deck into the trash. |
| BS5-104 | PURPLE | cookie | Chili Pepper Cookie | 【On Play】 Both players place 2 cards from the top of their decks into the trash. |
| BS5-107 | PURPLE | cookie | Red Pepper Cookie | When this Cookie faints, both players place 2 cards from the top of their decks into the trash. |
| BS5-108 | PURPLE | item | Rambirdtan Handler Glove | <{P}> View 3 cards from the top of your deck, reveal up to 1 {P} Cookie from the viewed cards, and add it to your hand. Then, place the remaining cards in the trash. |
| BS5-110 | PURPLE | stage | Lychee Dragon Cookie's Cave | <{P}> Place in your stage area.

【Activate】 <{P}> <Rest this card.> Place up to 2 cards from the top of your deck into the trash. Then, if [Lychee Dragon Cookie] is in your battle area, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. |
| BS5-111 | PURE | item | Wrath of the Dragons | <{N}> 【Equip】 this card to one of your 【Dragon】 Cookies. If that Cookie's remaining HP is 3 or less, that Cookie gains +1 attack damage and receives -1 attack damage. |

## 攻擊 Then 待轉接

| 卡號 | 顏色 | 類型 | 卡名 | 卡面文字 |
| --- | --- | --- | --- | --- |
| BS5-067 | BLUE | cookie | Snow Sugar Cookie | 無效果文字 |
| BS5-071 | BLUE | cookie | Lotus Dragon Cookie | 【Activate】 【Once Per Turn】 <Discard 3 or more {B} cards.> If your break area is LV.2 or higher, select up to 1 of your opponent's Cookies. That Cookie receives 2 damage. |
| BS5-080 | BLUE | cookie | Alchemist Cookie | 無效果文字 |
| BS5-085 | BLUE | cookie | Pirate Cookie | 無效果文字 |
| BS5-089 | PURPLE | cookie | Muscle Cookie | 無效果文字 |
| BS5-094 | PURPLE | cookie | Mangosteen Cookie | 無效果文字 |
| BS5-097 | PURPLE | cookie | Peppercorn Cookie | 無效果文字 |
| BS5-098 | PURPLE | cookie | Centipede Cookie | When your turn ends, place 1 card from the top of this Cookie's HP into the trash. |
| BS5-099 | PURPLE | cookie | Avocado Cookie | 無效果文字 |
| BS5-106 | PURPLE | cookie | Plain Yogurt Cookie | 無效果文字 |

## Promotion 門檻

1. 本表的三個待轉接區塊皆為 0，且每張卡都有對應單元測試或專用 test-state。
2. 每色均完成 Chrome 的合法與不合法互動路徑，包含支付、代價、目標、選擇、可略過與 Then。
3. 候選仍保持 `candidateStatus: inventory`；未完成上述門檻前不得執行 `promote:candidate`。
