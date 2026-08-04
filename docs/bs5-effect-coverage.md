# BS5 效果轉接覆蓋盤點

> 由 `npm run cards:analyze:bs5-candidate` 產生。資料來源仍是 `data/candidates/` 的 `inventory` 候選快照；此報告是 runtime 與 Chrome 稽核待辦，不代表可 promote。

## 摘要

| 項目 | 數量 |
| --- | ---: |
| BS5 基礎卡 | 111 |
| 主效果已轉接 | 17 |
| 主效果沒有文字 | 31 |
| 主效果待轉接 | 63 |
| 額外能力已轉接 | 28 |
| 額外能力待轉接 | 52 |
| 攻擊 Then 已轉接 | 0 / 26 |

## 逐色稽核矩陣

| 顏色 | 基礎卡 | 主效果待轉接 | 額外能力待轉接 | 攻擊 Then 待轉接 |
| --- | ---: | ---: | ---: | ---: |
| BLUE | 22 | 15 | 13 | 4 |
| GREEN | 22 | 11 | 9 | 3 |
| PURE | 1 | 1 | 1 | 0 |
| PURPLE | 22 | 12 | 9 | 6 |
| RED | 22 | 13 | 10 | 6 |
| YELLOW | 22 | 11 | 10 | 7 |

## 主效果待轉接

| 卡號 | 顏色 | 類型 | 卡名 | 卡面文字 |
| --- | --- | --- | --- | --- |
| BS5-004 | RED | flip | Lollipop Cookie | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. |
| BS5-005 | RED | cookie | Mala Sauce Cookie | 【Activate】 【Once Per Turn】 <{R}> <Place 1 card from the top of your {R} LV.2 or higher Cookie's HP into the trash.> Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. |
| BS5-009 | RED | flip | Butterbear Cookie | Draw up to 1 card from your deck. |
| BS5-010 | RED | cookie | Starch Noodle Cookie | 【On Play】 Select up to 1 of your opponent's rested LV.2 or lower Cookies. That Cookie receives 2 damage. |
| BS5-013 | RED | cookie | Pitaya Dragon Cookie | 【On Play】 <Discard 1 {R} Cookie from your hand.> Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. |
| BS5-014 | RED | cookie | Knight Cookie | 【Activate】 【Once Per Turn】 Select up to 1 of your opponent's [Pitaya Dragon Cookie]. That Cookie receives 2 damage. |
| BS5-015 | RED | cookie | Carol Cookie | 【On Play】 <Place 1 card from the top of your other Cookie's HP into the trash.> Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. |
| BS5-016 | RED | cookie | Tiramisu Cookie | 【Activate】 【Once Per Turn】 <Place 1 card from the top of this Cookie's HP into the trash.> If that card is a non-Cookie card, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. |
| BS5-018 | RED | cookie | Flat Tofu Cookie | 【On Play】 <Discard 1 {R} trap card from your hand.> Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. |
| BS5-019 | RED | cookie | Pudding Cookie | 【Activate】 【Once Per Turn】 <{R}> <Discard 1 {R} Cookie from your hand.> During this turn, this Cookie gains +1 attack damage. |
| BS5-020 | RED | item | Crimson Dragon Mask | <{R}{R}> If there are 2 Cookies whose remaining HP is 1 in your battle area, deals 2 damage to all of your opponent's Cookies. |
| BS5-021 | RED | trap | Draconic Aura | <{R}> If there is a LV.3 Cookie in your battle area, select up to 2 of your opponent's Cookies. During this turn, those Cookies deal -1 attack damage each. Then, return up to 1 card from the top of 1 of your Cookies' HP to your hand. |
| BS5-022 | RED | stage | Pitaya Dragon Cookie's Nest | <{R}> Place in your stage area.

【Activate】 <{R}> <Rest this card.> <Place 1 card from the top of your LV.2 or higher Cookie's HP into the trash.> During this turn, that Cookie gains +1 attack damage. Then, if [Pitaya Dragon Cookie] is in your battle area, draw up to 1 card from your deck. |
| BS5-023 | YELLOW | cookie | Dino-Sour Cookie | 【Activate】 【Once Per Turn】 <Place 3 cards from the top of this Cookie's HP into the trash.> During this turn, this Cookie gains +2 attack damage. |
| BS5-026 | YELLOW | cookie | DJ Cookie | When this Cookie faints, <place 1 {Y} LV.2 or lower Cookie from your hand into your break area.> Return this Cookie to your hand. |
| BS5-028 | YELLOW | cookie | Mango Cookie | 【On Play】 <{Y}> If your break area is LV.3 or higher, select up to 1 of your opponent's rested LV.2 or lower Cookies. That Cookie receives 2 damage. |
| BS5-029 | YELLOW | cookie | Mustard Cookie | 【On Play】 If there is a {Y} LV.3 Cookie in your break area, draw up to 1 card from your deck. |
| BS5-031 | YELLOW | cookie | Peach Cookie | 【On Play】 If your break area LV. is higher than your opponent's break area LV., draw up to 1 card from your deck. |
| BS5-036 | YELLOW | cookie | Milk Cookie | 【Activate】 <{Y}> <Rest this card.> <Discard 1 card.> Select up to 1 LV.1 Cookie in your opponent's battle area that does not have 【Skill】. Make that Cookie faint. |
| BS5-039 | YELLOW | cookie | Cheesecake Cookie | 【On Play】 Select up to 1 of your opponent's LV.2 or lower Cookies whose remaining HP is 3 or more. That Cookie receives 1 damage. |
| BS5-040 | YELLOW | cookie | Ananas Dragon Cookie | 【Activate】 【Once Per Turn】 <Place 1 card from the top of this Cookie's HP into the trash.> Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. |
| BS5-041 | YELLOW | flip | Firecracker Cookie | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. |
| BS5-042 | YELLOW | item | Sniffly Cocoa Palm | <{Y}> <Place 1 of your Cookies' HP cards in the trash.> If your break area is LV.5 or higher, draw up to 2 cards from your deck. |
| BS5-044 | YELLOW | stage | Ananas Dragon Cookie's Nest | <{Y}> Place in your stage area.

【Activate】 <{Y}> <Rest this card.> During this turn, if any of your Cookies gained HP, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. Then, <can be used as {Y}.> 1 of your [Ananas Dragon Cookie] gains +1 HP. |
| BS5-045 | GREEN | cookie | Potato Cookie | 【On Play】 <Return 1 card from your support area to your hand.> Draw up to 1 card from your deck. |
| BS5-048 | GREEN | cookie | Bellflower Cookie | 【Activate】 <{G}> <Rest this card.> <Discard 1 card.> Select up to 1 LV.1 Cookie in your opponent's battle area that does not have 【Skill】. Make that Cookie faint. |
| BS5-049 | GREEN | flip | Melon Bun Cookie | Draw up to 1 card from your deck. |
| BS5-051 | GREEN | cookie | Beet Cookie | When your turn ends, if there are 2 active cards or more in your support area, <can be used as {G}.> Place this Cookie on the bottom of your deck. |
| BS5-053 | GREEN | cookie | Shine Muscat Cookie | 【On Play】 <{G}{G}> Place up to 1 card from the top of your deck into your support area as rested. |
| BS5-058 | GREEN | cookie | Ginseng Cookie | When your turn ends, if there are 3 cards or less in your support area, <can be used as {G}.> Draw up to 1 card from your deck. |
| BS5-059 | GREEN | cookie | Purple Yam Cookie | 【On Play】 Select up to 1 of your opponent's rested LV.2 or lower Cookies. That Cookie receives 2 damage. |
| BS5-063 | GREEN | cookie | Hero Cookie | When your turn ends, if there are 2 active cards or more in your support area, draw up to 2 cards from your deck. |
| BS5-064 | GREEN | item | Dragon Orb | <{G}{G}{G}> Place up to 1 card from the top of your deck into your support area as rested. Then, if there are 7 cards or more in your support area, draw up to 1 card from your deck. |
| BS5-065 | GREEN | trap | Petrification | <{G}{G}{G}> Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -2 attack damage. Then, if there are 7 cards or more in your support area, your opponent selects 1 active card from their support area. Rest that card. |
| BS5-066 | GREEN | stage | Longan Palace | <{G}> Place in your stage area.

When your turn ends, <discard 1 card.> Set up to 1 card from your support area as active. Then, if [Longan Dragon Cookie] is in your battle area, draw up to 1 card from your deck. |
| BS5-068 | BLUE | cookie | GingerBright | If this Cookie remains in the battle area after receiving damage, draw up to 1 card from your deck. |
| BS5-070 | BLUE | cookie | Peppermint Cookie | 【On Play】 Select up to 1 Cookie in your opponent's battle area. Return that Cookie to your opponent's hand. |
| BS5-071 | BLUE | cookie | Lotus Dragon Cookie | 【Activate】 【Once Per Turn】 <Discard 3 or more {B} cards.> If your break area is LV.2 or higher, select up to 1 of your opponent's Cookies. That Cookie receives 2 damage. |
| BS5-072 | BLUE | cookie | Gumball Cookie | When this Cookie faints and your break area is LV.6 or higher, draw up to 2 cards from your deck. |
| BS5-074 | BLUE | cookie | Sorbet Shark Cookie | 【On Play】 <{B}> Draw up to 2 cards from your deck. |
| BS5-075 | BLUE | cookie | Hydrangea Cookie | 【On Play】 If there are 5 cards or more in your hand, select up to 1 of your opponent's rested LV.2 or lower Cookies. That Cookie receives 2 damage. |
| BS5-076 | BLUE | cookie | Cream Puff Cookie | 【Activate】 <{B}> <Rest this card.> <Discard 1 card.> Select up to 1 LV.1 Cookie in your opponent's battle area that does not have 【Skill】. Make that Cookie faint. |
| BS5-078 | BLUE | cookie | Aloe Cookie | 【On Play】 <{B}> Draw up to 1 card from your deck. |
| BS5-081 | BLUE | cookie | Squid Ink Cookie | 【Once Per Turn】 When your opponent's Cookie attacks, <discard 4 cards.> During this battle, this Cookie's HP cannot reach 0. |
| BS5-082 | BLUE | flip | Ion Cookie Robot | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. |
| BS5-083 | BLUE | cookie | Bell Pepper Cookie | 【On Play】 <Discard your entire hand.> This Cookie gains +2 HP. Draw up to 1 card from your deck. |
| BS5-084 | BLUE | cookie | Apple Cookie | 【Activate】 <Rest this card.> <Discard 1 card.> Select up to 1 of your other {B} Cookies. Set that Cookie as active. |
| BS5-086 | BLUE | item | Tales of the Lotus | <{B}{B}> If there is 1 Cookie in your battle area, view 3 cards from the top of your deck and select up to 1 {B} Cookie from the viewed cards. Play that Cookie with +1 HP. Then, place the remaining cards on the bottom of your deck in any order. |
| BS5-087 | BLUE | trap | Dino Greetings | <{B}{B}> Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -1 attack damage. Then, if your break area is LV.6 or higher, draw up to 2 cards from your deck. |
| BS5-088 | BLUE | stage | Lotus Palace | <{B}> Place in your stage area.

【Activate】 <{B}> <Rest this card.> If there are 3 cards or less in your hand, select up to 1 of your Cookies. During this turn, that Cookie gains +1 attack damage. Then, if [Lotus Dragon Cookie] is in your battle area, draw up to 2 cards from your deck. |
| BS5-090 | PURPLE | flip | Strawberry Stick Cookie | Draw up to 1 card from your deck. |
| BS5-091 | PURPLE | cookie | Lilac Cookie | 【On Play】 If there are 15 cards or more in your trash, select up to 1 of your opponent's rested LV.2 or lower Cookies. That Cookie receives 2 damage. |
| BS5-095 | PURPLE | flip | Mint Wafer Cookie | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. |
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
| BS5-005 | RED | cookie | Mala Sauce Cookie | 【Activate】 【Once Per Turn】 <{R}> <Place 1 card from the top of your {R} LV.2 or higher Cookie's HP into the trash.> Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. |
| BS5-010 | RED | cookie | Starch Noodle Cookie | 【On Play】 Select up to 1 of your opponent's rested LV.2 or lower Cookies. That Cookie receives 2 damage. |
| BS5-013 | RED | cookie | Pitaya Dragon Cookie | 【On Play】 <Discard 1 {R} Cookie from your hand.> Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. |
| BS5-014 | RED | cookie | Knight Cookie | 【Activate】 【Once Per Turn】 Select up to 1 of your opponent's [Pitaya Dragon Cookie]. That Cookie receives 2 damage. |
| BS5-015 | RED | cookie | Carol Cookie | 【On Play】 <Place 1 card from the top of your other Cookie's HP into the trash.> Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. |
| BS5-016 | RED | cookie | Tiramisu Cookie | 【Activate】 【Once Per Turn】 <Place 1 card from the top of this Cookie's HP into the trash.> If that card is a non-Cookie card, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. |
| BS5-018 | RED | cookie | Flat Tofu Cookie | 【On Play】 <Discard 1 {R} trap card from your hand.> Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. |
| BS5-019 | RED | cookie | Pudding Cookie | 【Activate】 【Once Per Turn】 <{R}> <Discard 1 {R} Cookie from your hand.> During this turn, this Cookie gains +1 attack damage. |
| BS5-020 | RED | item | Crimson Dragon Mask | <{R}{R}> If there are 2 Cookies whose remaining HP is 1 in your battle area, deals 2 damage to all of your opponent's Cookies. |
| BS5-022 | RED | stage | Pitaya Dragon Cookie's Nest | <{R}> Place in your stage area.

【Activate】 <{R}> <Rest this card.> <Place 1 card from the top of your LV.2 or higher Cookie's HP into the trash.> During this turn, that Cookie gains +1 attack damage. Then, if [Pitaya Dragon Cookie] is in your battle area, draw up to 1 card from your deck. |
| BS5-023 | YELLOW | cookie | Dino-Sour Cookie | 【Activate】 【Once Per Turn】 <Place 3 cards from the top of this Cookie's HP into the trash.> During this turn, this Cookie gains +2 attack damage. |
| BS5-026 | YELLOW | cookie | DJ Cookie | When this Cookie faints, <place 1 {Y} LV.2 or lower Cookie from your hand into your break area.> Return this Cookie to your hand. |
| BS5-028 | YELLOW | cookie | Mango Cookie | 【On Play】 <{Y}> If your break area is LV.3 or higher, select up to 1 of your opponent's rested LV.2 or lower Cookies. That Cookie receives 2 damage. |
| BS5-029 | YELLOW | cookie | Mustard Cookie | 【On Play】 If there is a {Y} LV.3 Cookie in your break area, draw up to 1 card from your deck. |
| BS5-031 | YELLOW | cookie | Peach Cookie | 【On Play】 If your break area LV. is higher than your opponent's break area LV., draw up to 1 card from your deck. |
| BS5-036 | YELLOW | cookie | Milk Cookie | 【Activate】 <{Y}> <Rest this card.> <Discard 1 card.> Select up to 1 LV.1 Cookie in your opponent's battle area that does not have 【Skill】. Make that Cookie faint. |
| BS5-039 | YELLOW | cookie | Cheesecake Cookie | 【On Play】 Select up to 1 of your opponent's LV.2 or lower Cookies whose remaining HP is 3 or more. That Cookie receives 1 damage. |
| BS5-040 | YELLOW | cookie | Ananas Dragon Cookie | 【Activate】 【Once Per Turn】 <Place 1 card from the top of this Cookie's HP into the trash.> Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. |
| BS5-042 | YELLOW | item | Sniffly Cocoa Palm | <{Y}> <Place 1 of your Cookies' HP cards in the trash.> If your break area is LV.5 or higher, draw up to 2 cards from your deck. |
| BS5-044 | YELLOW | stage | Ananas Dragon Cookie's Nest | <{Y}> Place in your stage area.

【Activate】 <{Y}> <Rest this card.> During this turn, if any of your Cookies gained HP, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. Then, <can be used as {Y}.> 1 of your [Ananas Dragon Cookie] gains +1 HP. |
| BS5-045 | GREEN | cookie | Potato Cookie | 【On Play】 <Return 1 card from your support area to your hand.> Draw up to 1 card from your deck. |
| BS5-048 | GREEN | cookie | Bellflower Cookie | 【Activate】 <{G}> <Rest this card.> <Discard 1 card.> Select up to 1 LV.1 Cookie in your opponent's battle area that does not have 【Skill】. Make that Cookie faint. |
| BS5-051 | GREEN | cookie | Beet Cookie | When your turn ends, if there are 2 active cards or more in your support area, <can be used as {G}.> Place this Cookie on the bottom of your deck. |
| BS5-053 | GREEN | cookie | Shine Muscat Cookie | 【On Play】 <{G}{G}> Place up to 1 card from the top of your deck into your support area as rested. |
| BS5-058 | GREEN | cookie | Ginseng Cookie | When your turn ends, if there are 3 cards or less in your support area, <can be used as {G}.> Draw up to 1 card from your deck. |
| BS5-059 | GREEN | cookie | Purple Yam Cookie | 【On Play】 Select up to 1 of your opponent's rested LV.2 or lower Cookies. That Cookie receives 2 damage. |
| BS5-063 | GREEN | cookie | Hero Cookie | When your turn ends, if there are 2 active cards or more in your support area, draw up to 2 cards from your deck. |
| BS5-064 | GREEN | item | Dragon Orb | <{G}{G}{G}> Place up to 1 card from the top of your deck into your support area as rested. Then, if there are 7 cards or more in your support area, draw up to 1 card from your deck. |
| BS5-066 | GREEN | stage | Longan Palace | <{G}> Place in your stage area.

When your turn ends, <discard 1 card.> Set up to 1 card from your support area as active. Then, if [Longan Dragon Cookie] is in your battle area, draw up to 1 card from your deck. |
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
| BS5-003 | RED | cookie | Strawberry Cream Cookie | 無效果文字 |
| BS5-006 | RED | cookie | Marshmallow Cookie | 無效果文字 |
| BS5-008 | RED | cookie | Chestnut Cookie | 無效果文字 |
| BS5-010 | RED | cookie | Starch Noodle Cookie | 【On Play】 Select up to 1 of your opponent's rested LV.2 or lower Cookies. That Cookie receives 2 damage. |
| BS5-012 | RED | cookie | Eggnog Cookie | 無效果文字 |
| BS5-013 | RED | cookie | Pitaya Dragon Cookie | 【On Play】 <Discard 1 {R} Cookie from your hand.> Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. |
| BS5-023 | YELLOW | cookie | Dino-Sour Cookie | 【Activate】 【Once Per Turn】 <Place 3 cards from the top of this Cookie's HP into the trash.> During this turn, this Cookie gains +2 attack damage. |
| BS5-024 | YELLOW | cookie | Dr. Wasabi Cookie | 無效果文字 |
| BS5-025 | YELLOW | cookie | Leek Cookie | 無效果文字 |
| BS5-030 | YELLOW | cookie | Buttercream Choco Cookie | 無效果文字 |
| BS5-032 | YELLOW | cookie | Birthday Cake Cookie | 無效果文字 |
| BS5-035 | YELLOW | cookie | Artichoke Cookie | 無效果文字 |
| BS5-040 | YELLOW | cookie | Ananas Dragon Cookie | 【Activate】 【Once Per Turn】 <Place 1 card from the top of this Cookie's HP into the trash.> Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. |
| BS5-056 | GREEN | cookie | Longan Dragon Cookie | When your turn ends, if there are 3 active cards or more in your support area, <can be used as {G}.> Select up to 1 of your opponent's Cookies. That Cookie receives 2 damage. |
| BS5-059 | GREEN | cookie | Purple Yam Cookie | 【On Play】 Select up to 1 of your opponent's rested LV.2 or lower Cookies. That Cookie receives 2 damage. |
| BS5-060 | GREEN | cookie | Croissant Cookie | 無效果文字 |
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
