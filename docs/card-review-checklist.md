# 卡牌技能／效果審核清單

此清單由 `getAllCardPoolEntries()` 自動產生，逐一列出目前卡池內所有卡牌的官方英文原文（技能／攻擊／FLIP）與程式碼轉換狀態，供人工比對正確性。

- 「技能/效果狀態」對應各卡牌類型實際使用的轉換函式：cookie 用 `convertOfficialCookieSkill()`、flip 用 `convertOfficialFlipAbility()`、trap 用 `convertOfficialTrapAbility()`、item 用 `convertOfficialItemAbility()`、stage 用 `convertOfficialStageAbility()`。
- 「攻擊後效果狀態」只在攻擊文字包含 `Then` 時才有值，對應 `convertOfficialAttackEffects()`（僅 cookie/flip 適用）。
- 確認無誤後請把「確認」欄位的 `[ ]` 改成 `[x]`；發現錯誤請在「備註」欄位記下問題，方便後續追蹤修正。

## ST1（Starter Deck RED / Sample）

| 確認 | 卡號 | 名稱 | 顏色 | Lv | 類型 | 技能／效果原文 | 技能/效果狀態 | 攻擊原文 | 攻擊後效果狀態 | 備註 |
|---|---|---|---|---|---|---|---|---|---|---|
| [x] | ST1-001 | Princess Cookie | RED | 2 | flip | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 已實作（1 個效果） | 《{R}{R}》 Deals 2 damage. |  | |
| [x] | ST1-002 | Ninja Cookie | RED | 2 | cookie | {ap} 《{R}》 If your break area is LV.6 or higher, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | 已實作（1 個效果） | 《{R}{R}》 Deals 2 damage. |  | |
| [x] | ST1-003 | Dino-Sour Cookie | RED | 2 | cookie | {mob} {t1} 《{R}{R}{N}{N}》 Select up to 2 of your opponent's Cookies. Those Cookies receive 2 damage each. | 已實作（1 個效果） | 《{R}{R}{N}》 Deals 2 damage. |  | |
| [x] | ST1-004 | Carrot Cookie | RED | 1 | flip | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 已實作（1 個效果） | 《{R}》 Deals 1 damage. |  | |
| [x] | ST1-005 | Leek Cookie | RED | 2 | cookie |  | 無技能文字 | 《{N}》 Deals 1 damage. |  | |
| [x] | ST1-006 | GingerBright | RED | 2 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 1 damage. |  | |
| [x] | ST1-007 | Mint Choco Cookie | RED | 3 | cookie | {ap} 《{R}》 Select up to 1 of your other Cookies. During this turn, that Cookie gains +1 attack damage. | 已實作（1 個效果） | 《{R}{R}》 Deals 2 damage. |  | |
| [x] | ST1-008 | Cherry Blossom Cookie | RED | 3 | cookie | {mob} {t1} 《{R}{R}》 《Rest this card.》 Select up to 2 of your opponent's Cookies. Those Cookies receive 1 damage each. | 已實作（1 個效果） | 《{R}》 Deals 1 damage. |  | |
| [x] | ST1-009 | Espresso Cookie | RED | 3 | cookie | {mt} If your break area is LV.6 or higher, this Cookie gains +1 attack damage. | 已實作（1 個效果） | 《{R}{R}{R}》 Deals 3 damage. |  | |
| [x] | ST1-010 | Alchemist Cookie | RED | 1 | cookie | {mob} 《{R}{R}{R}》 Select up to 2 of your opponent's Cookies. Those Cookies receive 1 damage each. | 已實作（1 個效果） | 《{R}{N}{N}》 Deals 2 damage. |  | |
| [x] | ST1-011 | GingerBrave | RED | 1 | cookie |  | 無技能文字 | 《{N}》 Deals 1 damage. |  | |
| [x] | ST1-012 | Zombie Cookie | RED | 1 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 1 damage. |  | |
| [x] | ST1-013 | Adventurer Cookie | RED | 1 | flip | Draw up to 1 card from your deck. | 已實作（1 個效果） | 《{R}》 Deals 1 damage. |  | |
| [x] | ST1-014 | Peperoncino Cookie | RED | 3 | cookie |  | 無技能文字 | 《{N}{N}{N}》 Deals 3 damage. |  | |
| [x] | ST1-015 | Pistachio Cookie | RED | 3 | flip | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 已實作（1 個效果） | 《{R}{R}{R}》 Deals 3 damage. |  | |
| [x] | ST1-016 | Icky Sticky Jelly | RED |  | item | 《{R}{R}》 Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | 已實作（1 個效果） |  |  | |
| [x] | ST1-017 | Exceptional Cake Knife | RED |  | item | 《{R}{R}》 Select up to 1 of your Cookies whose remaining HP is 1 and is LV.2 or higher. During this turn, that Cookie gains +2 attack damage. | 已實作（1 個效果） |  |  | |
| [x] | ST1-018 | Sugar-Coated Snail Shell | RED |  | item | 《{R}{R}{R}》 Select up to 1 of your Cookies whose remaining HP is 1. During your opponent's next turn, that Cookie receives -2 attack damage. | 已實作（1 個效果） |  |  | |
| [x] | ST1-019 | Fiery Jelly Clump | RED |  | item | 《{R}》 Select up to 1 of your Cookies. During this turn, that Cookie gains +1 attack damage. | 已實作（1 個效果） |  |  | |
| [x] | ST1-020 | Overhydrated Dough Swamp | RED |  | trap | 《{R}》 Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -2 attack damage. | 已實作（1 個效果） |  |  | |
| [x] | ST1-021 | Ouch-Inducing Star Jelly | RED |  | trap | 《{R}{R}》 Select up to 1 of your opponent's Cookies whose remaining HP is 1. That Cookie receives 1 damage. | 已實作（1 個效果） |  |  | |
| [x] | ST1-022 | Burning Jelly Volcano | RED |  | stage | 《{R}{R}》 Place in your stage area.  {mob} 《{R}》 《Rest this card.》 Select 1 of your Cookies. During this turn, that Cookie gains +1 attack damage. | 已實作（1 個效果） |  |  | |

## ST2（Starter Deck YELLOW）

| 確認 | 卡號 | 名稱 | 顏色 | Lv | 類型 | 技能／效果原文 | 技能/效果狀態 | 攻擊原文 | 攻擊後效果狀態 | 備註 |
|---|---|---|---|---|---|---|---|---|---|---|
| [x] | ST2-001 | Roguefort Cookie | YELLOW | 3 | cookie | {ap} 《{Y}》 Your opponent must place 1 card from their hand into the trash. | 已實作（1 個效果） | 《{Y}{Y}{Y}{N}》 Deals 3 damage. |  | |
| [x] | ST2-002 | Strawberry Cookie | YELLOW | 1 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 1 damage. |  | |
| [x] | ST2-003 | Wizard Cookie | YELLOW | 3 | cookie |  | 無技能文字 | 《{Y}{Y}{N}》 Deals 3 damage. Then, select up to 1 LV.1 card from your break area and place it in the trash. | 已實作（1 個效果） | |
| [x] | ST2-004 | Macaron Cookie | YELLOW | 2 | cookie | {ap} 《{Y}》 Select up to 1 of your other Cookies. That Cookie gains +1 HP. | 已實作（1 個效果） | 《{Y}》 Deals 1 damage. |  | |
| [x] | ST2-005 | Mustard Cookie | YELLOW | 1 | flip | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 已實作（1 個效果） | 《{Y}》 Deals 1 damage. |  | |
| [x] | ST2-006 | GingerBright | YELLOW | 2 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 1 damage. |  | |
| [x] | ST2-007 | Chestnut Cookie | YELLOW | 1 | flip | Draw up to 1 card from your deck. | 已實作（1 個效果） | 《{Y}》 Deals 1 damage. |  | |
| [x] | ST2-008 | Eclair Cookie | YELLOW | 3 | cookie | {ap} 《{Y}{Y}》 Select up to 1 LV.1 card from your break area and place it in the trash. | 已實作（1 個效果） | 《{Y}{Y}{Y}{Y}》 Deals 4 damage. |  | |
| [x] | ST2-009 | GingerBrave | YELLOW | 1 | cookie |  | 無技能文字 | 《{N}》 Deals 1 damage. |  | |
| [x] | ST2-010 | Purple Yam Cookie | YELLOW | 3 | cookie | {ap} 《{Y}》 If your break area is LV.6 or higher, select up to 1 LV.1 card from your break area and place it in the trash. | 已實作（1 個效果） | 《{Y}{Y}{N}{N}》 Deals 4 damage. |  | |
| [x] | ST2-011 | Cherry Cookie | YELLOW | 2 | cookie | When this Cookie faints, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | 已實作（1 個效果） | 《{Y}{Y}{N}》 Deals 2 damage. |  | |
| [x] | ST2-012 | Cheerleader Cookie | YELLOW | 2 | flip | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 已實作（1 個效果） | 《{Y}{Y}》 Deals 2 damage. |  | |
| [x] | ST2-013 | Cheesecake Cookie | YELLOW | 2 | cookie |  | 無技能文字 | 《{N}》 Deals 1 damage. |  | |
| [x] | ST2-014 | Custard Cookie III | YELLOW | 3 | flip | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 已實作（1 個效果） | 《{Y}{Y}{Y}》 Deals 3 damage. |  | |
| [x] | ST2-015 | Hero Cookie | YELLOW | 2 | cookie |  | 無技能文字 | 《{Y}{Y}{N}{N}》 Deals 3 damage. Then, select up to 1 of your opponent's LV.1 Cookies. That Cookie cannot attack during the next turn. | 已實作（2 個效果） | |
| [x] | ST2-016 | Flimsy Screwdriver | YELLOW |  | item | 《{Y}》 Select up to 1 of your opponent's Cookies. During this turn, that Cookie's HP-attached FLIP effect cannot be activated. | 已實作（1 個效果） |  |  | |
| [x] | ST2-018 | Time Travel Ticket | YELLOW |  | item | 《{Y}》 Draw 1 card from your deck. Then, select up to 1 of your Cookies and view all its HP cards. (You cannot switch the order of HP cards.) | 已實作（2 個效果） |  |  | |
| [x] | ST2-019 | Multi-Vitamin Honey Bomb | YELLOW |  | item | 《{Y}{Y}》 If your break area is LV.6 or higher, all Cookies currently in your battle area gain +1 attack damage during this turn. | 已實作（1 個效果） |  |  | |
| [x] | ST2-020 | Winding Key Shield | YELLOW |  | trap | 《{Y}{Y}》 If your break area is LV.5 or higher, select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -3 attack damage. | 已實作（1 個效果） |  |  | |
| [x] | ST2-021 | Pretzel Snare | YELLOW |  | trap | 《{Y}{Y}》 If 1 of your opponent's Cookies attacks more than 4 damage, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | 已實作（1 個效果） |  |  | |

## ST3（Starter Deck GREEN）

| 確認 | 卡號 | 名稱 | 顏色 | Lv | 類型 | 技能／效果原文 | 技能/效果狀態 | 攻擊原文 | 攻擊後效果狀態 | 備註 |
|---|---|---|---|---|---|---|---|---|---|---|
| [x] | ST3-001 | Muscle Cookie | GREEN | 2 | cookie | {mob} {t1} 《{G}{G}》 This Cookie gains +1 HP. | 已實作（1 個效果） | 《{G}{N}》 Deals 1 damage. |  | |
| [x] | ST3-002 | Strawberry Crepe Cookie | GREEN | 3 | cookie | {mob} {t1} 《Place 1 card from your support area into the trash.》 Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | 已實作（1 個效果） | 《{G}{G}{G}{G}》 Deals 3 damage. |  | |
| [x] | ST3-003 | GingerBright | GREEN | 2 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 1 damage. |  | |
| [x] | ST3-004 | Vampire Cookie | GREEN | 3 | cookie | {ap} 《{G}{G}{G}{N}》 Select up to 1 of your opponent's Cookies. That Cookie receives 2 damage. Then, this Cookie gains +1 HP. | 已實作（2 個效果） | 《{G}{G}{N}》 Deals 3 damage. |  | |
| [x] | ST3-005 | Blackberry Cookie | GREEN | 2 | cookie | {mob} {t1} 《Place 1 card from your support area into the trash.》 Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | 已實作（1 個效果） | 《{G}{G}》 Deals 2 damage. |  | |
| [x] | ST3-006 | Beet Cookie | GREEN | 2 | cookie |  | 無技能文字 | 《{N}》 Deals 1 damage. |  | |
| [x] | ST3-007 | Sparkling Cookie | GREEN | 3 | flip | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 已實作（1 個效果） | 《{G}{G}{G}》 Deals 3 damage. |  | |
| [x] | ST3-008 | Spinach Cookie | GREEN | 1 | flip | Draw up to 1 card from your deck. | 已實作（1 個效果） | 《{G}》 Deals 1 damage. |  | |
| [x] | ST3-009 | Avocado Cookie | GREEN | 2 | cookie | {mob} {t1} 《{G}》 During this turn, this Cookie gains +1 attack damage. | 已實作（1 個效果） | 《{G}{G}{G}》 Deals 3 damage. |  | |
| [x] | ST3-010 | Aloe Cookie | GREEN | 2 | cookie | {ap} 《{G}{G}》 Take 1 card from the top your deck and place it in your support area as active. | 已實作（1 個效果） | 《{G}》 Deals 1 damage. |  | |
| [x] | ST3-011 | Onion Cookie | GREEN | 2 | flip | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 已實作（1 個效果） | 《{G}{G}》 Deals 2 damage. |  | |
| [x] | ST3-012 | GingerBrave | GREEN | 1 | cookie |  | 無技能文字 | 《{N}》 Deals 1 damage. |  | |
| [x] | ST3-013 | Knight Cookie | GREEN | 1 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 1 damage. |  | |
| [x] | ST3-014 | Angel Cookie | GREEN | 1 | flip | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 已實作（1 個效果） | 《{G}》 Deals 1 damage. |  | |
| [x] | ST3-015 | Chili Pepper Cookie | GREEN | 3 | cookie | {mob} {t1} 《Place 1 card from your support area into the trash.》 During this turn, this Cookie gains +1 attack damage. | 已實作（1 個效果） | 《{G}{G}{G}》 Deals 3 damage. |  | |
| [x] | ST3-016 | Ancient Healer's Gaze | GREEN |  | item | 《{G}{G}{G}》 Select 1 Cookie from your battle area that is LV.2 or lower and place it in your support area as active. | 已實作（1 個效果） |  |  | |
| [x] | ST3-017 | Viney Vines | GREEN |  | item | 《{G}{G}》 Select up to 2 of your opponent's Cookies. Those Cookies receive 1 damage each. Then, place 1 card from your support area into the trash. | 已實作（2 個效果） |  |  | |
| [x] | ST3-018 | Parsley Tea of Invigoration | GREEN |  | item | 《{G}{G}》 Play 1 Cookie from your trash. | 已實作（1 個效果） |  |  | |
| [x] | ST3-019 | Supreme Whipped Cream | GREEN |  | trap | 《{G}》 Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -3 attack damage. Then, place 1 card from your support area into the trash. | 已實作（2 個效果） |  |  | |
| [x] | ST3-020 | Divine Light Crystal | GREEN |  | trap | 《{G}{G}》 Select up to 1 of your Cookies. That Cookie's HP cannot reach 0 during this battle. | 已實作（1 個效果） |  |  | |
| [x] | ST3-021 | Breath of the Flute | GREEN |  | trap | 《{G}》 If any of your {G} Cookies fainted during this battle, take the top card from your deck and place it in your support area as rested. | 已實作（1 個效果） |  |  | |
| [x] | ST3-022 | Guardian Tree's Blessing | GREEN |  | stage | 《{G}》 Place in your stage area.  {mob} 《Rest this card.》 Take 1 card from your support area to your hand. If you did, you can draw 1 card from your deck. | 已實作（2 個效果） |  |  | 已修正：官方文字為「you can draw」（可選），但轉換函式一律當成強制 draw，忽略了 isOptionalDraw 判斷。已修正 convertOfficialCardEffects 一般路徑與 convertOfficialTrapAbility 的 Then-draw 判斷，統一改用 draw-up-to，並補上轉換測試。 |

## ST4（Starter Deck BLUE）

| 確認 | 卡號 | 名稱 | 顏色 | Lv | 類型 | 技能／效果原文 | 技能/效果狀態 | 攻擊原文 | 攻擊後效果狀態 | 備註 |
|---|---|---|---|---|---|---|---|---|---|---|
| [x] | ST4-001 | Candy Diver Cookie | BLUE | 2 | cookie |  | 無技能文字 | 《{N}》 Deals 1 damage. |  | |
| [x] | ST4-002 | Snow Sugar Cookie | BLUE | 1 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 1 damage. |  | |
| [x] | ST4-003 | Dr. Wasabi Cookie | BLUE | 3 | flip | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 已實作（1 個效果） | 《{B}{B}{B}》 Deals 3 damage. |  | |
| [x] | ST4-004 | Lobster Cookie | BLUE | 3 | cookie | {mob} {t1} 《Discard 3 cards.》 Set this Cookie and 1 card in your support area as active. | 已實作（1 個效果） | 《{B}{B}{B}》 Deals 3 damage. |  | |
| [x] | ST4-005 | GingerBright | BLUE | 2 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 1 damage. |  | |
| [x] | ST4-006 | Peppermint Cookie | BLUE | 1 | flip | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 已實作（1 個效果） | 《{B}》 Deals 1 damage. |  | |
| [x] | ST4-007 | Sour Belt Cookie | BLUE | 1 | cookie | {mob} {t1} 《{B}》 If there are 6 cards or less in your hand, you can draw 1 card from your deck. | 已實作（1 個效果） | 《{B}{B}》 Deals 1 damage. |  | 已修正：官方文字為「you can draw」（可選），但轉換函式一律當成強制 draw，忽略了 isOptionalDraw 判斷。已修正 convertOfficialCardEffects 一般路徑與 convertOfficialTrapAbility 的 Then-draw 判斷，統一改用 draw-up-to，並補上轉換測試。 |
| [x] | ST4-008 | Soda Cookie | BLUE | 2 | cookie | {ap} You can draw 1 card from your deck. | 已實作（1 個效果） | 《{B}》 Deals 1 damage. |  | 已修正：官方文字為「you can draw」（可選），但轉換函式一律當成強制 draw，忽略了 isOptionalDraw 判斷。已修正 convertOfficialCardEffects 一般路徑與 convertOfficialTrapAbility 的 Then-draw 判斷，統一改用 draw-up-to，並補上轉換測試。 |
| [x] | ST4-009 | Ice Candy Cookie | BLUE | 2 | flip | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 已實作（1 個效果） | 《{B}{B}》 Deals 2 damage. |  | |
| [x] | ST4-010 | Squid Ink Cookie | BLUE | 1 | cookie | When this Cookie faints, you can draw 1 card from your deck. | 已實作（1 個效果） | 《{B}》 Deals 1 damage. |  | |
| [x] | ST4-011 | GingerBrave | BLUE | 1 | cookie |  | 無技能文字 | 《{N}》 Deals 1 damage. |  | |
| [x] | ST4-012 | Werewolf Cookie | BLUE | 3 | cookie | {mob} {t1} 《Discard 1 card.》 During this turn, this Cookie gains +1 attack damage. | 已實作（1 個效果） | 《{B}{B}》 Deals 2 damage. |  | |
| [x] | ST4-013 | Captain Caviar Cookie | BLUE | 2 | cookie | {ap} View the top 3 cards of your deck; you can draw 1 of them to your hand. Then, place the remaining cards at the bottom of your deck in any order. | 已實作（1 個效果） | 《{B}》 Deals 1 damage. Then, 《discard 2 cards.》 Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | 已實作（1 個效果） | |
| [x] | ST4-014 | Skating Queen Cookie | BLUE | 1 | flip | Draw up to 1 card from your deck. | 已實作（1 個效果） | 《{B}》 Deals 1 damage. |  | |
| [x] | ST4-015 | Pirate Cookie | BLUE | 2 | cookie |  | 無技能文字 | 《{B}{B}》 Deals 2 damage. Then, you can draw 1 card from your deck. | 已實作（1 個效果） | 已修正：官方文字為「you can draw」（可選），但轉換函式一律當成強制 draw，忽略了 isOptionalDraw 判斷。已修正 convertOfficialCardEffects 一般路徑與 convertOfficialTrapAbility 的 Then-draw 判斷，統一改用 draw-up-to，並補上轉換測試。 |
| [x] | ST4-016 | Bear Jelly Ice Cream | BLUE |  | item | 《{B}{B}》 Return 1 {B} Cookie whose remaining HP is 3 or more to your hand. | 已實作（1 個效果） |  |  | |
| [x] | ST4-017 | Emergency Lifebuoy | BLUE |  | item | 《{B}》 Return 1 LV.1 Cookie from your battle area to your hand. | 已實作（1 個效果） |  |  | |
| [x] | ST4-018 | Lucky Pearls | BLUE |  | item | 《{B}{B}》 You can draw up to 2 cards from your deck. | 已實作（1 個效果） |  |  | |
| [x] | ST4-019 | Sugar Crystal Lamp | BLUE |  | item | 《{B}》 Return all cards in your hand to your deck and shuffle it. Then, draw the same number of cards you returned to your deck. | 已實作（1 個效果） |  |  | |
| [x] | ST4-020 | Octo-Ink Spray | BLUE |  | trap | 《{B}》 《Discard 2 cards.》 Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -3 attack damage. | 已實作（1 個效果） |  |  | |
| [x] | ST4-021 | Fallen Ice Statue | BLUE |  | trap | 《{B}{B}》 Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -2 attack damage. Then, you can draw 1 card from your deck. | 已實作（2 個效果） |  |  | 已修正：官方文字為「you can draw」（可選），但轉換函式一律當成強制 draw，忽略了 isOptionalDraw 判斷。已修正 convertOfficialCardEffects 一般路徑與 convertOfficialTrapAbility 的 Then-draw 判斷，統一改用 draw-up-to，並補上轉換測試。 |
| [x] | ST4-022 | Sugar Glass Dome | BLUE |  | stage | 《{B}{B}》 Place in your stage area. {mob} 《{B}》 《Rest this card.》 You can draw 1 card from your deck. | 已實作（1 個效果） |  |  | 已修正：官方文字為「you can draw」（可選），但轉換函式一律當成強制 draw，忽略了 isOptionalDraw 判斷。已修正 convertOfficialCardEffects 一般路徑與 convertOfficialTrapAbility 的 Then-draw 判斷，統一改用 draw-up-to，並補上轉換測試。 |

## ST5（Starter Deck PURPLE）

| 確認 | 卡號 | 名稱 | 顏色 | Lv | 類型 | 技能／效果原文 | 技能/效果狀態 | 攻擊原文 | 攻擊後效果狀態 | 備註 |
|---|---|---|---|---|---|---|---|---|---|---|
| [x] | ST5-001 | Madeleine Cookie | PURPLE | 3 | cookie | {ap} 《{P}》 Place 1 of your opponent's LV.1 Cookies from their battle area or 1 stage card from their stage area into the trash. | 已實作（1 個效果） | 《{P}{P}{P}》 Deals 3 damage. |  | |
| [x] | ST5-002 | GingerBright | PURPLE | 2 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 1 damage. |  | |
| [x] | ST5-003 | Fig Cookie | PURPLE | 1 | flip | Draw up to 1 card from your deck. | 已實作（1 個效果） | 《{P}》 Deals 1 damage. |  | |
| [x] | ST5-004 | Skater Cookie | PURPLE | 1 | cookie | When this Cookie faints, your opponent must place 1 card from their hand into the trash. | 已實作（1 個效果） | 《{P}》 Deals 1 damage. |  | |
| [x] | ST5-005 | Cream Puff Cookie | PURPLE | 1 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 1 damage. |  | |
| [x] | ST5-006 | String Gummy Cookie | PURPLE | 2 | cookie | {ap} 《{P}{P}》 Place 1 of your opponent's LV.2 or lower Cookies from their battle area or 1 stage card from their stage area into the trash. | 已實作（1 個效果） | 《{P}》 Deals 1 damage. |  | |
| [x] | ST5-007 | Yoga Cookie | PURPLE | 1 | cookie | {mob} {t1} 《{P}》 《Discard 1 card.》  Place 1 of your opponent's LV.1 Cookies from their battle area or 1 stage card from their stage area into the trash. | 已實作（1 個效果） | 《{P}{P}》 Deals 1 damage. |  | |
| [x] | ST5-008 | Fairy Cookie | PURPLE | 1 | flip | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 已實作（1 個效果） | 《{P}》 Deals 1 damage. |  | |
| [x] | ST5-009 | GingerBrave | PURPLE | 1 | cookie |  | 無技能文字 | 《{N}》 Deals 1 damage. |  | |
| [x] | ST5-010 | Carol Cookie | PURPLE | 2 | cookie | {ap} 《{P}》 Place 1 of your opponent's Cookies whose remaining HP is 2 or less into the trash. | 已實作（1 個效果） | 《{P}{P}》 Deals 1 damage. |  | |
| [x] | ST5-011 | Tiger Lily Cookie | PURPLE | 2 | cookie |  | 無技能文字 | 《{N}》 Deals 1 damage. |  | |
| [x] | ST5-012 | Clover Cookie | PURPLE | 2 | flip | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 已實作（1 個效果） | 《{P}{P}》 Deals 2 damage. |  | |
| [x] | ST5-013 | Pilot Cookie | PURPLE | 2 | cookie | {mob} {t1} 《{P}》 《Place 1 {P} LV.1 Cookie from your battle area into the trash.》 During this turn, this Cookie gains +1 attack damage. | 已實作（1 個效果） | 《{P}{P}{P}》 Deals 3 damage. |  | |
| [x] | ST5-014 | Pancake Cookie | PURPLE | 3 | flip | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 已實作（1 個效果） | 《{P}{P}{P}》 Deals 3 damage. |  | |
| [x] | ST5-015 | Rye Cookie | PURPLE | 3 | cookie | {ap} 《{P}{P}》 Place 1 of your opponent's Cookies from their battle area into the trash. | 已實作（1 個效果） | 《{P}{P}{P}》 Deals 3 damage. |  | |
| [x] | ST5-016 | BONUS Coin | PURPLE |  | item | 《{P}》 If your opponent has 30 cards or more in their trash, you can draw up to 2 cards from your deck. | 已實作（1 個效果） |  |  | |
| [x] | ST5-017 | Violet Dragonspout | PURPLE |  | item | 《{P}{P}》 Place 1 random card from your opponent's hand into the trash. | 已實作（1 個效果） |  |  | |
| [x] | ST5-018 | Dragonfly Candy Brooch | PURPLE |  | item | 《{P}{P}{P}》 Place 1 of your opponent's Cookies whose remaining HP is 4 or less into the trash. | 已實作（1 個效果） |  |  | |
| [x] | ST5-019 | Pastry Boomerang | PURPLE |  | item | 《{P}{P}》 If your opponent has 20 cards or more in their trash, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. Then, you can draw 1 card from your deck. | 已實作（2 個效果） |  |  | |
| [x] | ST5-020 | Forbidden Grimoire | PURPLE |  | trap | 《{P}》 《Place 1 {P} LV.1 Cookie from your battle area into the trash.》 Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -3 attack damage. | 已實作（1 個效果） |  |  | |
| [x] | ST5-021 | Hidden Warpgate | PURPLE |  | trap | 《{P}{P}》 Place 1 of your opponent's Cookies whose remaining HP is 2 or less into the trash. | 已實作（1 個效果） |  |  | |
| [x] | ST5-022 | Windswept Valley | PURPLE |  | stage | 《{P}{P}》 Place in your stage area. When your opponent places a Cookie from their battle area into the trash by effect, 《rest this card.》 You can draw 1 card from your deck. | 已實作（1 個效果） |  |  | 已修正：官方文字為「you can draw」（可選），但轉換函式一律當成強制 draw，忽略了 isOptionalDraw 判斷。已修正 convertOfficialCardEffects 一般路徑與 convertOfficialTrapAbility 的 Then-draw 判斷，統一改用 draw-up-to，並補上轉換測試。 |

## BS1（Brave Beginning 第一彈）

| 確認 | 卡號 | 名稱 | 顏色 | Lv | 類型 | 技能／效果原文 | 技能/效果狀態 | 攻擊原文 | 攻擊後效果狀態 | 備註 |
|---|---|---|---|---|---|---|---|---|---|---|
| [x] | BS1-001 | Goblin Cookie | RED | 1 | cookie | {ap} 《Discard 1 card.》 Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | 已實作（1 個效果） | 《{R}{N}》 Deals 1 damage. |  | |
| [x] | BS1-002 | Kumiho Cookie | RED | 3 | flip | 《Discard 1 card.》 Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | 已實作（1 個效果） | 《{R}{R}{R}》 Deals 3 damage. |  | |
| [x] | BS1-002@1 | Kumiho Cookie | RED | 3 | flip | 《Discard 1 card.》 Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | 已實作（1 個效果） | 《{R}{R}{R}》 Deals 3 damage. |  | |
| [x] | BS1-003 | Dark Choco Cookie | RED | 2 | cookie | {mob} {t1} 《{R}》 《Discard 1 card.》 Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | 已實作（1 個效果） | 《{R}{R}{R}》 Deals 3 damage. |  | |
| [x] | BS1-003@1 | Dark Choco Cookie | RED | 2 | cookie | {mob} {t1} 《{R}》 《Discard 1 card.》 Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | 已實作（1 個效果） | 《{R}{R}{R}》 Deals 3 damage. |  | |
| [x] | BS1-004 | Lilac Cookie | RED | 1 | cookie | {mob} 《{R}{R}》 Return this Cookie to your hand. | 已實作（1 個效果） | 《{R}》 Deals 1 damage. |  | |
| [x] | BS1-005 | Roll Cake Cookie | RED | 2 | cookie |  | 無技能文字 | 《{R}{R}》 Deals 1 damage. Then, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | 已實作（1 個效果） | |
| [x] | BS1-006 | Mala Sauce Cookie | RED | 2 | cookie | If this Cookie remains in the battle area after receiving damage, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | 已實作（1 個效果） | 《{R}{R}》 Deals 3 damage. |  | |
| [x] | BS1-007 | Melon Bun Cookie | RED | 1 | cookie |  | 無技能文字 | 《{N}{N}{N}》 Deals 2 damage. |  | |
| [x] | BS1-008 | Pomegranate Cookie | RED | 2 | cookie | {mob} {t1} 《{R}》 Select up to 1 of your other Cookies. During this turn, that Cookie gains +1 attack damage. | 已實作（1 個效果） | 《{R}{R}{R}》 Deals 2 damage. |  | |
| [x] | BS1-008@1 | Pomegranate Cookie | RED | 2 | cookie | {mob} {t1} 《{R}》 Select up to 1 of your other Cookies. During this turn, that Cookie gains +1 attack damage. | 已實作（1 個效果） | 《{R}{R}{R}》 Deals 2 damage. |  | |
| [x] | BS1-009 | Affogato Cookie | RED | 1 | cookie | {bl} 《{R}》 (When one of your opponent's Cookies attacks, you can redirect the attack to this Cookie.) | 已實作（1 個效果） | 《{R}{N}》 Deals 1 damage. |  | |
| [x] | BS1-009@1 | Affogato Cookie | RED | 1 | cookie | {bl} 《{R}》 (When one of your opponent's Cookies attacks, you can redirect the attack to this Cookie.) | 已實作（1 個效果） | 《{R}{N}》 Deals 1 damage. |  | |
| [x] | BS1-010 | Devil Cookie | RED | 2 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 3 damage. |  | |
| [x] | BS1-011 | Cherry Ball Cookie | RED | 1 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 2 damage. |  | |
| [x] | BS1-012 | Wildberry Cookie | RED | 3 | cookie | If your break area is LV.9, this Cookie gains +2 attack damage. | 已實作（1 個效果） | 《{R}{R}{R}{R}》 Deals 4 damage. |  | |
| [x] | BS1-012@1 | Wildberry Cookie | RED | 3 | cookie | If your break area is LV.9, this Cookie gains +2 attack damage. | 已實作（1 個效果） | 《{R}{R}{R}{R}》 Deals 4 damage. |  | |
| [x] | BS1-013 | GingerBrave | RED | 1 | cookie |  | 無技能文字 | 《{R}》 Deals 2 damage. Then, discard 1 card. | 已實作（1 個效果） | |
| [x] | BS1-014 | GingerBrave | RED | 1 | cookie | {mob} {t1} 《{R}{R}》 During this turn, this Cookie gains +1 attack damage. | 已實作（1 個效果） | 《{R}{R}》 Deals 2 damage. |  | |
| [x] | BS1-014@1 | GingerBrave | RED | 1 | cookie | {mob} {t1} 《{R}{R}》 During this turn, this Cookie gains +1 attack damage. | 已實作（1 個效果） | 《{R}{R}》 Deals 2 damage. |  | |
| [x] | BS1-015 | Rose Cookie | RED | 3 | flip | Draw up to 1 card from your deck. | 已實作（1 個效果） | 《{R}{R}{R}》 Deals 3 damage. |  | |
| [x] | BS1-016 | Choco Ball Cookie | RED | 2 | cookie | When this Cookie faints and you have 4 cards or less in your hand, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | 已實作（1 個效果） | 《{R}{R}》 Deals 2 damage. |  | |
| [x] | BS1-017 | Croissant Cookie | RED | 1 | cookie | {ap} 《{R}{R}》 Select up to 1 of your other Cookies. During this turn, that Cookie gains +2 attack damage. | 已實作（1 個效果） | 《{R}》 Deals 1 damage. |  | |
| [x] | BS1-017@1 | Croissant Cookie | RED | 1 | cookie | {ap} 《{R}{R}》 Select up to 1 of your other Cookies. During this turn, that Cookie gains +2 attack damage. | 已實作（1 個效果） | 《{R}》 Deals 1 damage. |  | |
| [x] | BS1-018 | Popcorn Cookie | RED | 1 | flip | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 已實作（1 個效果） | 《{R}》 Deals 1 damage. |  | |
| [x] | BS1-019 | Walnut Cookie | RED | 3 | cookie |  | 無技能文字 | 《{N}{N}{N}》 Deals 4 damage. |  | |
| [x] | BS1-020 | Red Pepper Cookie | RED | 3 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 2 damage. |  | |
| [x] | BS1-021 | Whipped Cream Cookie | RED | 2 | cookie |  | 無技能文字 | 《{N}{N}{N}》 Deals 3 damage. |  | |
| [x] | BS1-022 | Giant Cherry Bomb | RED |  | item | 《{R}{R}{R}》 《Discard 1 card.》 Select up to 1 of your opponent's Cookies. That Cookie receives 3 damage. | 已實作（1 個效果） |  |  | |
| [x] | BS1-023 | Spicy Power Juice | RED |  | item | 《{R}》 《Place 1 of your Cookies' HP cards in the trash until the Cookie's HP reaches 1.》 Select up to 1 of your Cookies. During this turn, that Cookie gains +2 attack damage. | 已實作（1 個效果） |  |  | |
| [x] | BS1-024 | Pasta Spring Shoes | RED |  | trap | 《{R}{R}》 If 1 of your Cookies has 1 HP, select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -4 attack damage. | 已實作（1 個效果） |  |  | |
| [x] | BS1-025 | Pineapple Helmet | RED |  | trap | 《{R}》 If 1 of your Cookies has 1 HP, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | 已實作（1 個效果） |  |  | |
| [x] | BS1-026 | Desert Oasis | RED |  | stage | 《{R}{R}》 Place in your stage area. {mob} 《Rest this card.》 《Place 1 of your Cookies' HP cards in the trash.》 Select up to 1 of your Cookies. During this turn, that Cookie gains +1 attack damage. | 已實作（1 個效果） |  |  | |
| [x] | BS1-027 | Ice Juggler Cookie | YELLOW | 2 | cookie |  | 無技能文字 | 《{N}{N}{N}》 Deals 3 damage. |  | |
| [x] | BS1-028 | Latte Cookie | YELLOW | 3 | cookie | {ap} 《{Y}》 Select up to 1 of your other Cookies. That Cookie gains +1 HP. | 已實作（1 個效果） | 《{Y}{Y}{Y}》 Deals 2 damage. Then, if your break area is LV.5 or higher, deals 1 damage to all of your opponent's Cookies. | 已實作（1 個效果） | |
| [x] | BS1-028@1 | Latte Cookie | YELLOW | 3 | cookie | {ap} 《{Y}》 Select up to 1 of your other Cookies. That Cookie gains +1 HP. | 已實作（1 個效果） | 《{Y}{Y}{Y}》 Deals 2 damage. Then, if your break area is LV.5 or higher, deals 1 damage to all of your opponent's Cookies. | 已實作（1 個效果） | |
| [x] | BS1-029 | Lime Cookie | YELLOW | 1 | cookie | {ap} If your break area is LV.3 or higher, draw 1 card from your deck and discard 1 card. | 已實作（2 個效果） | 《{Y}》 Deals 1 damage. |  | |
| [x] | BS1-030 | Rockstar Cookie | YELLOW | 2 | flip | Draw up to 1 card from your deck. | 已實作（1 個效果） | 《{Y}{Y}》 Deals 2 damage. |  | |
| [x] | BS1-031 | Marshmallow Cookie | YELLOW | 1 | cookie | {bl} 《{Y}》 (When one of your opponent's Cookies attacks, you can redirect the attack to this Cookie.) | 已實作（1 個效果） | 《{Y}{N}》 Deals 1 damage. |  | |
| [x] | BS1-031@1 | Marshmallow Cookie | YELLOW | 1 | cookie | {bl} 《{Y}》 (When one of your opponent's Cookies attacks, you can redirect the attack to this Cookie.) | 已實作（1 個效果） | 《{Y}{N}》 Deals 1 damage. |  | |
| [x] | BS1-032 | Banana Cookie | YELLOW | 1 | cookie |  | 無技能文字 | 《{N}{N}{N}》 Deals 2 damage. |  | |
| [x] | BS1-033 | Cyborg Cookie | YELLOW | 1 | cookie |  | 無技能文字 | 《{Y}{Y}》 Deals 1 damage. Then, 《can be used as {Y}.》 Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage for each Cookie that is LV.2 or higher in your break area. | 已實作（1 個效果） | |
| [x] | BS1-033@1 | Cyborg Cookie | YELLOW | 1 | cookie |  | 無技能文字 | 《{Y}{Y}》 Deals 1 damage. Then, 《can be used as {Y}.》 Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage for each Cookie that is LV.2 or higher in your break area. | 已實作（1 個效果） | |
| [x] | BS1-034 | Sandwich Cookie | YELLOW | 1 | cookie | {ap} 《{Y}》 Select up to 1 of your other Cookies. That Cookie gains +1 HP. | 已實作（1 個效果） | 《{Y}》 Deals 1 damage. |  | |
| [x] | BS1-035 | Cotton Candy Cookie | YELLOW | 2 | cookie | When this Cookie faints, 《can be used as {Y}.》 Select up to 1 LV.1 Cookie in your break area. Place that Cookie in the trash. | 已實作（1 個效果） | 《{Y}{Y}》 Deals 2 damage. |  | |
| [x] | BS1-036 | Snake Fruit Cookie | YELLOW | 2 | cookie | {ap} 《{Y}{Y}》 Select up to 1 {Y} LV.1 Cookie from your break area and play it. | 已實作（1 個效果） | 《{Y}{Y}{Y}》 Deals 3 damage. |  | |
| [x] | BS1-036@1 | Snake Fruit Cookie | YELLOW | 2 | cookie | {ap} 《{Y}{Y}》 Select up to 1 {Y} LV.1 Cookie from your break area and play it. | 已實作（1 個效果） | 《{Y}{Y}{Y}》 Deals 3 damage. |  | |
| [x] | BS1-037 | Timekeeper Cookie | YELLOW | 3 | cookie | {ap} 《Discard 1 card.》 《{Y}{Y}》 Select up to 1 LV.2 or lower Cookie from your break area. Place that Cookie in the trash. | 已實作（1 個效果） | 《{Y}{Y}{Y}》 Deals 3 damage. Then, 《can be used as {Y}.》 Select up to 1 of your opponent's LV.1 Cookies. Place that Cookie in the break area. | 已實作（1 個效果） | |
| [x] | BS1-037@1 | Timekeeper Cookie | YELLOW | 3 | cookie | {ap} 《Discard 1 card.》 《{Y}{Y}》 Select up to 1 LV.2 or lower Cookie from your break area. Place that Cookie in the trash. | 已實作（1 個效果） | 《{Y}{Y}{Y}》 Deals 3 damage. Then, 《can be used as {Y}.》 Select up to 1 of your opponent's LV.1 Cookies. Place that Cookie in the break area. | 已實作（1 個效果） | |
| [x] | BS1-038 | Cinnamon Cookie | YELLOW | 1 | cookie | {mob} 《{Y}{Y}》 《Place this Cookie in your break area.》 Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | 已實作（1 個效果） | 《{Y}》 Deals 1 damage. |  | |
| [x] | BS1-039 | Almond Cookie | YELLOW | 2 | cookie |  | 無技能文字 | 《{Y}{Y}》 Deals 1 damage. Then, select up to 2 of your opponent's Cookies. Those Cookies deal -1 attack damage each during your opponent's next turn. | 已實作（1 個效果） | |
| [x] | BS1-040 | Earl Grey Cookie | YELLOW | 3 | flip | 《Discard 1 card.》 If your break area is LV.6 or higher, the Cookie with this card attached for HP gains +2 HP. | 已實作（1 個效果） | 《{Y}{Y}{Y}》 Deals 3 damage. |  | |
| [x] | BS1-040@1 | Earl Grey Cookie | YELLOW | 3 | flip | 《Discard 1 card.》 If your break area is LV.6 or higher, the Cookie with this card attached for HP gains +2 HP. | 已實作（1 個效果） | 《{Y}{Y}{Y}》 Deals 3 damage. |  | |
| [x] | BS1-041 | Orange Cookie | YELLOW | 1 | flip | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 已實作（1 個效果） | 《{Y}》 Deals 1 damage. |  | |
| [x] | BS1-042 | Grapefruit Cookie | YELLOW | 2 | cookie | When your opponent attacks this Cookie, 《can be used as {Y}.》 This Cookie receives -1 attack damage during this battle. | 已實作（1 個效果） | 《{Y}{Y}》 Deals 2 damage. |  | |
| [x] | BS1-043 | Cheesecake Cookie | YELLOW | 2 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 3 damage. |  | |
| [x] | BS1-044 | Bell Pepper Cookie | YELLOW | 2 | cookie | {mob} {t1} 《{Y}》 《Discard 1 card.》 If this Cookie's HP is less than 3, gain +1 HP. | 已實作（1 個效果） | 《{Y}{Y}{Y}》 Deals 2 damage. Then, 《can be used as {Y}{Y}.》 Deals 3 damage. | 已實作（1 個效果） | |
| [x] | BS1-044@1 | Bell Pepper Cookie | YELLOW | 2 | cookie | {mob} {t1} 《{Y}》 《Discard 1 card.》 If this Cookie's HP is less than 3, gain +1 HP. | 已實作（1 個效果） | 《{Y}{Y}{Y}》 Deals 2 damage. Then, 《can be used as {Y}{Y}.》 Deals 3 damage. | 已實作（1 個效果） | |
| [x] | BS1-045 | Firecracker Cookie | YELLOW | 3 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 2 damage. |  | |
| [x] | BS1-046 | Apple Cookie | YELLOW | 3 | cookie |  | 無技能文字 | 《{N}》 Deals 2 damage. |  | |
| [x] | BS1-047 | Pizza Cookie | YELLOW | 3 | cookie |  | 無技能文字 | 《{N}{N}{N}》 Deals 4 damage. |  | |
| [x] | BS1-048 | Jelly Pom-Poms | YELLOW |  | item | 《{Y}{Y}{Y}》 Select up to 1 of your Cookies. During this turn, that Cookie gains +1 attack damage for every 2 {Y} LV.1 Cookies in your break area. | 已實作（1 個效果） |  |  | 已修正：`ModifyAttackByBreakCountEffect` 新增 `groupSize` 欄位，BS1-048 設為 2，`execute.ts` 改用 `Math.floor(count / groupSize) * perCount` 計算，新增 bs1-048-jelly-pom-poms.test.ts 驗證 0~5 張的加成 |
| [x] | BS1-049 | Tropical Slushie | YELLOW |  | item | 《{Y}{Y}》 Deals 1 damage for each 1 {Y} LV.2 or higher Cookie in your break area to 1 of your opponent's Cookies. | 已實作（1 個效果） |  |  | |
| [x] | BS1-050 | Broken Signpost | YELLOW |  | trap | 《{Y}》 Redirect your opponent's attack to a different Cookie of your own. | 已實作（1 個效果） |  |  | |
| [x] | BS1-051 | Super-Vita Jelly Bar | YELLOW |  | trap | 《{Y}》 Select up to 1 of your Cookies. That Cookie gains +1 HP. | 已實作（1 個效果） |  |  | |
| [x] | BS1-052 | Star Candy Road | YELLOW |  | stage | 《{Y}》 Place in your stage area. {mob} 《{Y}{Y}》 《Rest this card.》 Select 1 of your Cookies. That Cookie gains +1 HP. | 已實作（1 個效果） |  |  | |
| [x] | BS1-053 | Roguefort Cookie | GREEN | 1 | cookie | {mob} {t1} 《{G}》 If there are 6 cards or less in your hand, return 1 card from your support area to your hand. Then, take 1 card from the top of your deck and place it in your support area as rested. | 已實作（2 個效果） | 《{G}》 Deals 1 damage. |  | |
| [x] | BS1-053@1 | Roguefort Cookie | GREEN | 1 | cookie | {mob} {t1} 《{G}》 If there are 6 cards or less in your hand, return 1 card from your support area to your hand. Then, take 1 card from the top of your deck and place it in your support area as rested. | 已實作（2 個效果） | 《{G}》 Deals 1 damage. |  | |
| [x] | BS1-054 | Blue Lily Cookie | GREEN | 3 | cookie | {mt} {ap} 《Place 1 card from your support area in the trash.》 Deals 1 damage to all of your opponent's Cookies. | 已實作（1 個效果） | 《{G}{G}{G}{G}》 Deals 4 damage. |  | |
| [x] | BS1-054@1 | Blue Lily Cookie | GREEN | 3 | cookie | {mt} {ap} 《Place 1 card from your support area in the trash.》 Deals 1 damage to all of your opponent's Cookies. | 已實作（1 個效果） | 《{G}{G}{G}{G}》 Deals 4 damage. |  | |
| [x] | BS1-055 | Red Bean Cookie | GREEN | 2 | flip | Draw up to 1 card from your deck. | 已實作（1 個效果） | 《{G}{G}》 Deals 2 damage. |  | |
| [x] | BS1-056 | Moon Rabbit Cookie | GREEN | 2 | cookie | {ap} 《{G}{G}》 Select up to 1 of your other LV.2 or lower Cookies from your battle area. Place them in your support area as active. | 已實作（1 個效果） | 《{G}》 Deals 1 damage. |  | |
| [x] | BS1-056@1 | Moon Rabbit Cookie | GREEN | 2 | cookie | {ap} 《{G}{G}》 Select up to 1 of your other LV.2 or lower Cookies from your battle area. Place them in your support area as active. | 已實作（1 個效果） | 《{G}》 Deals 1 damage. |  | |
| [x] | BS1-057 | Bellflower Cookie | GREEN | 1 | cookie |  | 無技能文字 | 《{N}{N}{N}》 Deals 2 damage. |  | |
| [x] | BS1-058 | Poison Mushroom Cookie | GREEN | 2 | cookie | When this Cookie faints, 《place 1 card from your support area into the trash.》 Deals 1 damage to all Cookies. | 已實作（3 個效果） | 《{G}{G}》 Deals 2 damage. |  | |
| [x] | BS1-059 | Fig Cookie | GREEN | 3 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 2 damage. |  | |
| [x] | BS1-060 | Butterbear Cookie | GREEN | 2 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 3 damage. |  | |
| [x] | BS1-061 | Peach Cookie | GREEN | 2 | cookie |  | 無技能文字 | 《{N}{N}{N}》 Deals 3 damage. |  | |
| [x] | BS1-062 | Tea Knight Cookie | GREEN | 1 | cookie | {bl} 《{G}》 (When one of your opponent's Cookies attacks, you can redirect the attack to this Cookie.) | 已實作（1 個效果） | 《{G}{N}》 Deals 1 damage. |  | |
| [x] | BS1-062@1 | Tea Knight Cookie | GREEN | 1 | cookie | {bl} 《{G}》 (When one of your opponent's Cookies attacks, you can redirect the attack to this Cookie.) | 已實作（1 個效果） | 《{G}{N}》 Deals 1 damage. |  | |
| [x] | BS1-063 | Prophet Cookie | GREEN | 1 | cookie | {ap} 《Place 1 card from your support area into the trash.》 Take 1 card from the top of your deck and place it in your support area as active. | 已實作（1 個效果） | 《{G}{N}》 Deals 1 damage. |  | |
| [x] | BS1-064 | Ginseng Cookie | GREEN | 2 | cookie |  | 無技能文字 | 《{G}{G}》 Deals 2 damage. Then, 《can be used as {G}.》 If your support area contains 7 or more cards, 1 of your other Cookies gains +1 HP. | 已實作（1 個效果） | |
| [x] | BS1-065 | Plum Cookie | GREEN | 1 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 2 damage. |  | |
| [x] | BS1-066 | Lillybell Cookie | GREEN | 2 | cookie | When your turn ends, set 1 card from your support area as active. | 已實作（1 個效果） | 《{G}{G}{G}》 Deals 3 damage. |  | |
| [x] | BS1-066@1 | Lillybell Cookie | GREEN | 2 | cookie | When your turn ends, set 1 card from your support area as active. | 已實作（1 個效果） | 《{G}{G}{G}》 Deals 3 damage. |  | |
| [x] | BS1-067 | Churro Cookie | GREEN | 3 | flip | 《Discard 1 card.》 If your support area contains 4 or more cards, place this card in your support area as rested. | 已實作（1 個效果） | 《{G}{G}{G}》 Deals 3 damage. |  | |
| [x] | BS1-067@1 | Churro Cookie | GREEN | 3 | flip | 《Discard 1 card.》 If your support area contains 4 or more cards, place this card in your support area as rested. | 已實作（1 個效果） | 《{G}{G}{G}》 Deals 3 damage. |  | |
| [x] | BS1-068 | Cauliflower Cookie | GREEN | 2 | cookie | {ap} 《Place 1 card from your support area into the trash.》 Draw 1 card from your deck. | 已實作（1 個效果） | 《{G}{N}》 Deals 1 damage. |  | |
| [x] | BS1-069 | Cookiemals | GREEN | 1 | flip | Draw up to 1 card from your deck. | 已實作（1 個效果） | 《{G}》 Deals 1 damage. |  | |
| [x] | BS1-070 | Kiwi Cookie | GREEN | 2 | cookie |  | 無技能文字 | 《{G}{N}》 Deals 1 damage. Then, return 1 LV.1 Cookie from your support area to your hand. | 已實作（1 個效果） | |
| [x] | BS1-071 | Pumpkin Pie Cookie | GREEN | 3 | cookie | {ap} 《{G}{G}》 Place 1 Cookie from your trash into your support area as active. | 已實作（1 個效果） | 《{G}{G}{N}》 Deals 3 damage. |  | |
| [x] | BS1-071@1 | Pumpkin Pie Cookie | GREEN | 3 | cookie | {ap} 《{G}{G}》 Place 1 Cookie from your trash into your support area as active. | 已實作（1 個效果） | 《{G}{G}{N}》 Deals 3 damage. |  | |
| [x] | BS1-072 | Pudding Cookie | GREEN | 3 | cookie |  | 無技能文字 | 《{N}{N}{N}》 Deals 4 damage. |  | |
| [x] | BS1-073 | Herb Cookie | GREEN | 2 | cookie | {ap} 《Place 1 card from your support area into the trash.》 Set 1 card from your support area as active. | 已實作（1 個效果） | 《{G}》 Deals 1 damage. |  | |
| [x] | BS1-074 | Ancient Forest Luckstone | GREEN |  | item | 《{G}》 《Return 1 card from your support area to your hand.》 You can draw 1 card from your deck. | 已實作（1 個效果） |  |  | 已修正：官方文字為「you can draw」（可選），但轉換函式一律當成強制 draw，忽略了 isOptionalDraw 判斷。已修正 convertOfficialCardEffects 一般路徑與 convertOfficialTrapAbility 的 Then-draw 判斷，統一改用 draw-up-to，並補上轉換測試。 |
| [x] | BS1-075 | Wanderer's Apple Pie | GREEN |  | item | 《{G}{G}》 Place this card in your support area as rested. | 已實作（1 個效果） |  |  | |
| [x] | BS1-076 | Stinging Nettle | GREEN |  | trap | 《{G}》 Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. Then, place 1 card from your support area into the trash. | 已實作（2 個效果） |  |  | |
| [x] | BS1-077 | Tasty First Aid Kit | GREEN |  | trap | 《{G}{G}{G}》 Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -3 attack damage. Then, set up to 1 of card from your support area as active. | 已實作（2 個效果） |  |  | |
| [x] | BS1-078 | Awakening Ancient Forest | GREEN |  | stage | 《{G}》 Place in your stage area. {mob} 《Rest this card.》 If the number of cards in your support area has decreased during this turn, set 1 card from your support area as active. | 已實作（1 個效果） |  |  | |

## BS2（Brave Beginning 第二彈）

| 確認 | 卡號 | 名稱 | 顏色 | Lv | 類型 | 技能／效果原文 | 技能/效果狀態 | 攻擊原文 | 攻擊後效果狀態 | 備註 |
|---|---|---|---|---|---|---|---|---|---|---|
| [x] | BS2-001 | Muscle Cookie | RED | 2 | flip | Draw up to 1 card from your deck. | 已實作（1 個效果） | 《{R}{R}》 Deals 2 damage. |  | |
| [x] | BS2-002 | Macaron Cookie | RED | 1 | cookie | {ap} 《{R}》 Place up to 1 of your opponent's stage cards in the trash. | 已實作（1 個效果） | 《{R}{R}》 Deals 1 damage. |  | |
| [x] | BS2-003 | Rebel Cookie | RED | 2 | cookie | {ap} 《{R}{R}》 Select up to 1 of your opponent's Cookies. That Cookie receives 2 damage. | 已實作（1 個效果） | 《{R}{R}{R}》 Deals 3 damage. |  | |
| [x] | BS2-003@1 | Rebel Cookie | RED | 2 | cookie | {ap} 《{R}{R}》 Select up to 1 of your opponent's Cookies. That Cookie receives 2 damage. | 已實作（1 個效果） | 《{R}{R}{R}》 Deals 3 damage. |  | |
| [x] | BS2-004 | Cherry Cookie | RED | 2 | cookie |  | 無技能文字 | 《{R}》 Deals 1 damage. Then, 《can be used as {R}.》 If one of your opponent's Cookies is LV.1, deals 3 damage. | 已實作（1 個效果） | |
| [x] | BS2-005 | Chili Pepper Cookie | RED | 3 | cookie |  | 無技能文字 | 《{N}》 Deals 2 damage. |  | |
| [x] | BS2-006 | Prickly Cacti Gloves | RED |  | item | 《{R}{R}》 Select up to 1 of your opponent's Cookies. That Cookie receives 2 damage. Then, select 1 of your Cookies and place 2 of their HP cards in the trash. | 已實作（2 個效果） |  |  | |
| [x] | BS2-007 | Prickly Cactus Bat | RED |  | trap | 《{R}》 《Discard 1 {R} card.》 Select up to 1 of your opponent's LV.1 Cookies. That Cookie receives 2 damage. | 已實作（1 個效果） |  |  | |
| [x] | BS2-008 | Princess Cookie | YELLOW | 1 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 2 damage. |  | |
| [x] | BS2-009 | Carrot Cookie | YELLOW | 2 | flip | Draw up to 1 card from your deck. | 已實作（1 個效果） | 《{Y}{Y}》 Deals 2 damage. |  | |
| [x] | BS2-010 | Vampire Cookie | YELLOW | 2 | cookie |  | 無技能文字 | 《{Y}》 Deals 1 damage. Then, 《can be used as {Y}.》 If one of your opponent's Cookies is LV.1, deals 3 damage. | 已實作（1 個效果） | |
| [x] | BS2-011 | Blackberry Cookie | YELLOW | 3 | cookie | {mob} 《{Y}{Y}》 Select {Y} Cookies from your break area until their total LV. sum reaches LV.3. Return those Cookies to your hand and place this Cookie into your break area. | 已實作（1 個效果） | 《{Y}{Y}{N}》 Deals 2 damage. |  | |
| [x] | BS2-011@1 | Blackberry Cookie | YELLOW | 3 | cookie | {mob} 《{Y}{Y}》 Select {Y} Cookies from your break area until their total LV. sum reaches LV.3. Return those Cookies to your hand and place this Cookie into your break area. | 已實作（1 個效果） | 《{Y}{Y}{N}》 Deals 2 damage. |  | |
| [x] | BS2-012 | Onion Cookie | YELLOW | 1 | cookie | {ap} 《{Y}》 Place up to 1 of your opponent's stage cards in the trash. | 已實作（1 個效果） | 《{Y}{Y}》 Deals 1 damage. |  | |
| [x] | BS2-013 | Wind-Up Pocket Watch | YELLOW |  | item | 《{Y}{Y}》 Place 1 Cookie from your battle area into your break area, then play up to 1 LV.1 Cookie from your break area. | 已實作（2 個效果） |  |  | |
| [x] | BS2-014 | Erratic Yakgwa Robot | YELLOW |  | trap | 《{Y}》 Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -1 attack damage. Then, you can return 1 LV.1 Cookie from your break area to your hand. If you did, place 1 Cookie from your hand into your break area. | 已實作（1 個效果） |  |  | |
| [x] | BS2-015 | Lemon Thyme Cookie | GREEN | 2 | cookie | {mob} 《{G}{G}{G}{G}》 《Place this Cookie in the trash.》 Select up to 1 of your opponent's Cookies. That Cookie receives 2 damage. Then, take 1 card from the top of your deck and place it in your support area as rested. | 已實作（2 個效果） | 《{G}{G}》 Deals 2 damage. |  | |
| [x] | BS2-015@1 | Lemon Thyme Cookie | GREEN | 2 | cookie | {mob} 《{G}{G}{G}{G}》 《Place this Cookie in the trash.》 Select up to 1 of your opponent's Cookies. That Cookie receives 2 damage. Then, take 1 card from the top of your deck and place it in your support area as rested. | 已實作（2 個效果） | 《{G}{G}》 Deals 2 damage. |  | |
| [x] | BS2-016 | Mustard Cookie | GREEN | 3 | cookie |  | 無技能文字 | 《{N}》 Deals 2 damage. |  | |
| [x] | BS2-017 | Mint Choco Cookie | GREEN | 2 | cookie |  | 無技能文字 | 《{G}》 Deals 1 damage. Then, 《can be used as {G}.》 If one of your opponent's Cookies is LV.1, deals 3 damage. | 已實作（1 個效果） | |
| [x] | BS2-018 | Candlelight Cookie | GREEN | 1 | cookie | {ap} 《{G}》 Place up to 1 of your opponent's stage cards in the trash. | 已實作（1 個效果） | 《{G}{G}》 Deals 1 damage. |  | |
| [x] | BS2-019 | Cheesecake Cookie | GREEN | 2 | flip | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 已實作（1 個效果） | 《{G}{G}》 Deals 2 damage. |  | |
| [x] | BS2-020 | Carrot Jelly Stew | GREEN |  | item | 《{G}{G}》 Select up to 1 of your {G} Cookies. Place 1 of their attached HP cards in your support area as rested. | 已實作（1 個效果） |  |  | |
| [x] | BS2-021 | Carrot Farm Scarecrow | GREEN |  | trap | 《{G}》 Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -1 attack damage. Then, return 1 card from your support area to your hand. If you did, place 1 card from your hand into your support area as rested. | 已實作（1 個效果） |  |  | |
| [x] | BS2-022 | Licorice Cookie | BLUE | 3 | cookie | {ap} This Cookie takes no damage from effects until the start of the player's next turn. | 已實作（1 個效果） | 《{B}{B}{B}》 Deals 3 damage. |  | |
| [x] | BS2-022@1 | Licorice Cookie | BLUE | 3 | cookie | {ap} This Cookie takes no damage from effects until the start of the player's next turn. | 已實作（1 個效果） | 《{B}{B}{B}》 Deals 3 damage. |  | |
| [x] | BS2-023 | DJ Cookie | BLUE | 3 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 2 damage. |  | |
| [x] | BS2-024 | Strawberry Cookie | BLUE | 3 | cookie |  | 無技能文字 | 《{N}》 Deals 2 damage. |  | |
| [x] | BS2-025 | Mango Cookie | BLUE | 1 | cookie | When this Cookie faints, you can draw 1 card from your deck. If you did, discard 1 card from your hand. | 已實作（1 個效果） | 《{B}{B}》 Deals 1 damage. |  | |
| [x] | BS2-026 | Mocha Ray Cookie | BLUE | 1 | cookie | {bl} 《{B}》 (When one of your opponent's Cookies attacks, you can redirect the attack to this Cookie.) | 已實作（1 個效果） | 《{B}{N}》 Deals 1 damage. |  | |
| [x] | BS2-026@1 | Mocha Ray Cookie | BLUE | 1 | cookie | {bl} 《{B}》 (When one of your opponent's Cookies attacks, you can redirect the attack to this Cookie.) | 已實作（1 個效果） | 《{B}{N}》 Deals 1 damage. |  | |
| [x] | BS2-027 | Cotton Cookie | BLUE | 2 | cookie | {ap} 《Discard 2 cards.》 Select up to 2 of your Cookies. Those Cookies gain +1 HP. | 已實作（1 個效果） | 《{B}{B}{N}》 Deals 2 damage. |  | |
| [x] | BS2-027@1 | Cotton Cookie | BLUE | 2 | cookie | {ap} 《Discard 2 cards.》 Select up to 2 of your Cookies. Those Cookies gain +1 HP. | 已實作（1 個效果） | 《{B}{B}{N}》 Deals 2 damage. |  | |
| [x] | BS2-028 | Pond Dino Cookie | BLUE | 2 | cookie | {mob} {t1} 《Discard 1 card.》 During this turn, your opponent cannot activate {bl}. | 已實作（1 個效果） | 《{B}{B}{B}》 Deals 3 damage. |  | |
| [x] | BS2-028@1 | Pond Dino Cookie | BLUE | 2 | cookie | {mob} {t1} 《Discard 1 card.》 During this turn, your opponent cannot activate {bl}. | 已實作（1 個效果） | 《{B}{B}{B}》 Deals 3 damage. |  | |
| [x] | BS2-029 | Sea Fairy Cookie | BLUE | 3 | cookie | {mob} {t1} 《Discard 1 card.》 Select up to 1 Cookie that is LV.2 or lower from your battle area and return them to your hand. | 已實作（1 個效果） | 《{B}{B}{B}{B}》 Deals 4 damage. |  | |
| [x] | BS2-029@1 | Sea Fairy Cookie | BLUE | 3 | cookie | {mob} {t1} 《Discard 1 card.》 Select up to 1 Cookie that is LV.2 or lower from your battle area and return them to your hand. | 已實作（1 個效果） | 《{B}{B}{B}{B}》 Deals 4 damage. |  | |
| [x] | BS2-030 | Gumball Cookie | BLUE | 3 | cookie |  | 無技能文字 | 《{N}{N}{N}》 Deals 4 damage. |  | |
| [x] | BS2-031 | Black Raisin Cookie | BLUE | 3 | cookie | {mt} {ap} 《Discard 3 cards.》 Select up to 2 of your opponent's Cookies. Deals 2 damage to 1 of the Cookies and 1 damage to the other. | 已實作（1 個效果） | 《{B}{B}{B}》 Deals 3 damage. |  | |
| [x] | BS2-031@1 | Black Raisin Cookie | BLUE | 3 | cookie | {mt} {ap} 《Discard 3 cards.》 Select up to 2 of your opponent's Cookies. Deals 2 damage to 1 of the Cookies and 1 damage to the other. | 已實作（1 個效果） | 《{B}{B}{B}》 Deals 3 damage. |  | |
| [x] | BS2-032 | Blueberry Pie Cookie | BLUE | 1 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 2 damage. |  | |
| [x] | BS2-033 | Sorbet Shark Cookie | BLUE | 2 | cookie | {mob} {t1} 《Discard 1 card.》 Set this Cookie as active. | 已實作（1 個效果） | 《{B}{B}{N}》 Deals 2 damage. |  | |
| [x] | BS2-034 | Frost Queen Cookie | BLUE | 3 | flip | If your break area is LV.4 or higher, you can draw up to 2 cards from your deck. | 已實作（1 個效果） | 《{B}{B}{B}》 Deals 3 damage. |  | |
| [x] | BS2-034@1 | Frost Queen Cookie | BLUE | 3 | flip | If your break area is LV.4 or higher, you can draw up to 2 cards from your deck. | 已實作（1 個效果） | 《{B}{B}{B}》 Deals 3 damage. |  | |
| [x] | BS2-035 | Salt Cookie | BLUE | 1 | cookie |  | 無技能文字 | 《{N}{N}{N}》 Deals 2 damage. |  | |
| [x] | BS2-036 | Sherbet Cookie | BLUE | 2 | cookie | {ap} 《Select 1 LV.1 Cookie from your battle area and return them to the bottom of your deck.》 You can draw 1 card from your deck. | 已實作（2 個效果） | 《{B}{B}{N}》 Deals 2 damage. |  | 已修正：官方文字為「you can draw」（可選），但轉換函式一律當成強制 draw，忽略了 isOptionalDraw 判斷。已修正 convertOfficialCardEffects 一般路徑與 convertOfficialTrapAbility 的 Then-draw 判斷，統一改用 draw-up-to，並補上轉換測試。 |
| [x] | BS2-036@1 | Sherbet Cookie | BLUE | 2 | cookie | {ap} 《Select 1 LV.1 Cookie from your battle area and return them to the bottom of your deck.》 You can draw 1 card from your deck. | 已實作（2 個效果） | 《{B}{B}{N}》 Deals 2 damage. |  | |
| [x] | BS2-037 | Chocolate Bonbon Cookie | BLUE | 3 | flip | Draw up to 1 card from your deck. | 已實作（1 個效果） | 《{B}{B}{B}》 Deals 3 damage. |  | |
| [x] | BS2-038 | Sparkling Cookie | BLUE | 2 | cookie |  | 無技能文字 | 《{N}{N}{N}》 Deals 3 damage. |  | |
| [x] | BS2-039 | Avocado Cookie | BLUE | 2 | cookie | {mob} {t1} 《{B}》 《Discard 2 cards.》 Select up to 2 of your Cookies. During this turn, those Cookies deal +1 attack damage. | 已實作（1 個效果） | 《{B}{B}{N}》 Deals 3 damage. |  | |
| [x] | BS2-040 | Aloe Cookie | BLUE | 1 | cookie | When this Cookie faints, view the top 3 cards of your deck. Out of the 3 cards, select 1 {B} card, show it to your opponent, and place that card in your hand. Then, return the remaining cards to the bottom of your deck in any order. | 已實作（1 個效果） | 《{B}{B}》 Deals 2 damage. |  | |
| [x] | BS2-040@1 | Aloe Cookie | BLUE | 1 | cookie | When this Cookie faints, view the top 3 cards of your deck. Out of the 3 cards, select 1 {B} card, show it to your opponent, and place that card in your hand. Then, return the remaining cards to the bottom of your deck in any order. | 已實作（1 個效果） | 《{B}{B}》 Deals 2 damage. |  | |
| [x] | BS2-041 | Eggnog Cookie | BLUE | 2 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 3 damage. |  | |
| [x] | BS2-042 | Milk Cookie | BLUE | 1 | flip |  | 無效果文字 | 《{B}》 Deals 1 damage. |  | |
| [x] | BS2-043 | Captain Ice Cookie | BLUE | 2 | cookie | When this Cookie faints, 《discard 2 cards.》 Select up to 2 of your opponent's Cookies. Deals 1 damage to each of those Cookies. | 已實作（1 個效果） | 《{B}{B}》 Deals 2 damage. |  | |
| [x] | BS2-044 | Tiramisu Cookie | BLUE | 2 | cookie |  | 無技能文字 | 《{B}》 Deals 1 damage. Then, 《can be used as {B}.》 If one of your opponent's Cookies is LV.1, deals 3 damage. | 已實作（1 個效果） | |
| [x] | BS2-045 | Parfait Cookie | BLUE | 1 | cookie |  | 無技能文字 | 《{B}》 Deals 1 damage. Then, if there are 6 cards or less in your hand, you can draw 1 card from your deck. | 已實作（1 個效果） | 已修正：官方文字為「you can draw」（可選），但轉換函式一律當成強制 draw，忽略了 isOptionalDraw 判斷。已修正 convertOfficialCardEffects 一般路徑與 convertOfficialTrapAbility 的 Then-draw 判斷，統一改用 draw-up-to，並補上轉換測試。 |
| [x] | BS2-045@1 | Parfait Cookie | BLUE | 1 | cookie |  | 無技能文字 | 《{B}》 Deals 1 damage. Then, if there are 6 cards or less in your hand, you can draw 1 card from your deck. | 已實作（1 個效果） | |
| [x] | BS2-046 | Caramel Arrow Cookie | BLUE | 1 | cookie | {ap} 《{B}》 Place up to 1 of your opponent's stage cards in the trash. | 已實作（1 個效果） | 《{B}{B}》 Deals 1 damage. |  | |
| [x] | BS2-047 | Diving Goggles | BLUE |  | item | 《{B}{B}{B}》 《Discard 3 cards.》 Select up to 2 of your opponent's Cookies. Deals 2 damage to each of those Cookies. | 已實作（1 個效果） |  |  | |
| [x] | BS2-048 | Jellied Jellyfish Potion | BLUE |  | item | 《{B}》 Draw up to 1 card for each of your opponent's Cookies that fainted during this turn. | 已實作（1 個效果） |  |  | |
| [x] | BS2-049 | Salt Crystal Trident | BLUE |  | trap | 《{B}》 During this battle, if 1 of your {B} Cookies faints, you can draw up to 3 cards from your deck and discard 1 card from your hand. | 已實作（2 個效果） |  |  | |
| [x] | BS2-050 | Hermit Crab's Shell | BLUE |  | trap | 《{B}{B}{B}》 《Discard 1 card.》 Select up to 1 of your opponent's Cookies whose remaining HP is 3 or less and place them at the bottom of the deck. | 已實作（1 個效果） |  |  | |
| [x] | BS2-051 | Whipped Snowcream Village | BLUE |  | stage | 《{B}{B}》 Place in your stage area. {mob} 《Card Rests.》 《Discard 1 card.》 Select up to 1 of your Cookies. During this turn, that Cookie deals +1 damage. | 已實作（1 個效果） |  |  | 已修正：官方文字用「Card Rests.」而非通用的「Rest this card.」，convertOfficialStageAbility 的 restSource 判斷正則式沒吃到，導致場景卡發動技能後不會橫置，可無限重複使用。已在 official-effect-adapter.ts 新增共用 RESTS_THIS_CARD_PATTERN（同時比對兩種措辭）修正，並補上轉換測試。 |
| [x] | BS2-052 | Kumiho Cookie | PURPLE | 2 | cookie |  | 無技能文字 | 《{N}{N}{N}》 Deals 3 damage. |  | |
| [x] | BS2-053 | Ninja Cookie | PURPLE | 1 | cookie |  | 無技能文字 | 《{N}{N}{N}》 Deals 2 damage. |  | |
| [x] | BS2-054 | Dino-Sour Cookie | PURPLE | 3 | cookie |  | 無技能文字 | 《{N}》 Deals 2 damage. |  | |
| [x] | BS2-055 | Poison Mushroom Cookie | PURPLE | 3 | cookie | {ap} 《{P}》 Place all LV.2 or lower Cookies from both battle areas into the trash. | 已實作（1 個效果） | 《{P}{P}{P}》 Deals 3 damage. |  | |
| [x] | BS2-055@1 | Poison Mushroom Cookie | PURPLE | 3 | cookie | {ap} 《{P}》 Place all LV.2 or lower Cookies from both battle areas into the trash. | 已實作（1 個效果） | 《{P}{P}{P}》 Deals 3 damage. |  | |
| [x] | BS2-056 | Raspberry Mousse Cookie | PURPLE | 1 | flip | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 已實作（1 個效果） | 《{P}》 Deals 1 damage. |  | |
| [x] | BS2-057 | Wizard Cookie | PURPLE | 1 | cookie | {ap} 《{P}》 Place up to 1 of your opponent's stage cards in the trash. | 已實作（1 個效果） | 《{P}{P}》 Deals 1 damage. |  | |
| [x] | BS2-058 | Wind Archer Cookie | PURPLE | 3 | cookie | {ap} 《{P}》 Place up to 1 of your opponent's LV.3 Cookies from their battle area into the trash. | 已實作（1 個效果） | 《{P}{P}{P}{P}》 Deals 4 damage. Then, if there are 15 cards or more in your trash, deals 1 damage. | 已實作（1 個效果） | 已修正：官方文字「if there are 15 cards or more in your trash」指的是攻擊方自己的棄牌堆，但攻擊追加效果的 exact table 誤用 opponent-trash-count-at-least（透過 targeting.ts 會檢查對手的棄牌堆），改成 trash-count-at-least（檢查來源玩家自己的棄牌堆），並補上轉換測試。 |
| [x] | BS2-058@1 | Wind Archer Cookie | PURPLE | 3 | cookie | {ap} 《{P}》 Place up to 1 of your opponent's LV.3 Cookies from their battle area into the trash. | 已實作（1 個效果） | 《{P}{P}{P}{P}》 Deals 4 damage. Then, if there are 15 cards or more in your trash, deals 1 damage. | 已實作（1 個效果） | 已修正：官方文字「if there are 15 cards or more in your trash」指的是攻擊方自己的棄牌堆，但攻擊追加效果的 exact table 誤用 opponent-trash-count-at-least（透過 targeting.ts 會檢查對手的棄牌堆），改成 trash-count-at-least（檢查來源玩家自己的棄牌堆），並補上轉換測試。 |
| [x] | BS2-059 | Cherry Blossom Cookie | PURPLE | 3 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 2 damage. |  | |
| [x] | BS2-060 | Beet Cookie | PURPLE | 1 | cookie | When this Cookie faints and your opponent has 20 cards or more in their trash, you can draw 1 card from your deck. | 已實作（1 個效果） | 《{P}{P}》 Deals 1 damage. |  | 已修正：官方文字為「you can draw」（可選），但轉換函式一律當成強制 draw，忽略了 isOptionalDraw 判斷。已修正 convertOfficialCardEffects 一般路徑與 convertOfficialTrapAbility 的 Then-draw 判斷，統一改用 draw-up-to，並補上轉換測試。 |
| [x] | BS2-061 | Hydrangea Cookie | PURPLE | 1 | cookie | {ap} Select up to 3 cards from your trash that do not have FLIP. Return those cards to your deck and shuffle it. | 已實作（1 個效果） | 《{P}{P}》 Deals 2 damage. |  | |
| [x] | BS2-061@1 | Hydrangea Cookie | PURPLE |  | cookie | {ap} Select up to 3 cards from your trash that do not have FLIP. Return those cards to your deck and shuffle it. | 已實作（1 個效果） | 《{P}{P}》 Deals 2 damage. |  | |
| [x] | BS2-062 | Starfruit Cookie | PURPLE | 1 | cookie | {ap} 《{P}》 Other than this Cookie, you can place 1 {P} Cookie that is LV.2 or lower from your battle area into the trash. If you did, place up to 1 of your opponent's Cookies that is LV.2 or lower from their battle area into the trash. | 已實作（2 個效果） | 《{P}{P}》 Deals 1 damage. |  | |
| [x] | BS2-062@1 | Starfruit Cookie | PURPLE | 1 | cookie | {ap} 《{P}》 Other than this Cookie, you can place 1 {P} Cookie that is LV.2 or lower from your battle area into the trash. If you did, place up to 1 of your opponent's Cookies that is LV.2 or lower from their battle area into the trash. | 已實作（2 個效果） | 《{P}{P}》 Deals 1 damage. |  | |
| [x] | BS2-063 | Space Doughnut | PURPLE | 3 | flip | 《Discard 1 card.》 If your break area is LV.3 or higher, place either 1 of your opponent's Cookies that is LV.2 or lower from their battle area or 1 stage card from their stage area into the trash. | 已實作（1 個效果） | 《{P}{P}{P}》 Deals 3 damage. |  | |
| [x] | BS2-063@1 | Space Doughnut | PURPLE | 1 | flip | 《Discard 1 card.》 If your break area is LV.3 or higher, place either 1 of your opponent's Cookies that is LV.2 or lower from their battle area or 1 stage card from their stage area into the trash. | 已實作（1 個效果） | 《{P}{P}{P}》 Deals 3 damage. |  | |
| [x] | BS2-064 | Alchemist Cookie | PURPLE | 2 | cookie | {ap} Place up to 1 of your opponent's Cookies whose remaining HP is 2 or less from their battle area into the trash. | 已實作（1 個效果） | 《{P}{P}》 Deals 2 damage. |  | |
| [x] | BS2-065 | Purple Yam Cookie | PURPLE | 3 | cookie | {ap} 《{P}》 Place up to 1 of your opponent's stage cards in the trash. | 已實作（1 個效果） | 《{P}{P}{P}{P}》 Deals 4 damage. |  | |
| [x] | BS2-066 | Rose Cookie | PURPLE | 1 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 2 damage. |  | |
| [x] | BS2-067 | Angel Cookie | PURPLE | 1 | cookie | {bl} 《{P}》 (When one of your opponent's Cookies attacks, you can redirect the attack to this Cookie.) | 已實作（1 個效果） | 《{P}{N}》 Deals 1 damage. |  | |
| [x] | BS2-067@1 | Angel Cookie | PURPLE | 1 | cookie | {bl} 《{P}》 (When one of your opponent's Cookies attacks, you can redirect the attack to this Cookie.) | 已實作（1 個效果） | 《{P}{N}》 Deals 1 damage. |  | |
| [x] | BS2-068 | Cream Unicorn Cookie | PURPLE | 2 | cookie | {ap} 《Discard 1 card.》 Return up to 1 {P} card from your trash to your hand. | 已實作（1 個效果） | 《{P}{P}{N}》 Deals 2 damage. |  | |
| [x] | BS2-068@1 | Cream Unicorn Cookie | PURPLE | 2 | cookie | {ap} 《Discard 1 card.》 Return up to 1 {P} card from your trash to your hand. | 已實作（1 個效果） | 《{P}{P}{N}》 Deals 2 damage. |  | |
| [x] | BS2-069 | Clotted Cream Cookie | PURPLE | 2 | cookie | {ap} 《Discard 1 card.》 Place up to 1 of your opponent's LV.1 Cookies from their battle area into the trash. | 已實作（1 個效果） | 《{P}{P}{P}》 Deals 3 damage. |  | |
| [x] | BS2-069@1 | Clotted Cream Cookie | PURPLE | 2 | cookie | {ap} 《Discard 1 card.》 Place up to 1 of your opponent's LV.1 Cookies from their battle area into the trash. | 已實作（1 個效果） | 《{P}{P}{P}》 Deals 3 damage. |  | |
| [x] | BS2-070 | Kiwi Cookie | PURPLE | 2 | cookie |  | 無技能文字 | 《{N}{N}》 Deals 3 damage. |  | |
| [x] | BS2-071 | Twizzly Gummy Cookie | PURPLE | 1 | cookie | {mob} 《{P}》 《Place this Cookie in the trash.》 Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | 已實作（1 個效果） | 《{P}{P}》 Deals 1 damage. |  | |
| [x] | BS2-071@1 | Twizzly Gummy Cookie | PURPLE | 1 | cookie | {mob} 《{P}》 《Place this Cookie in the trash.》 Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | 已實作（1 個效果） | 《{P}{P}》 Deals 1 damage. |  | |
| [x] | BS2-072 | Pastry Cookie | PURPLE | 3 | flip | Draw up to 1 card from your deck. | 已實作（1 個效果） | 《{P}{P}{P}》 Deals 3 damage. |  | |
| [x] | BS2-073 | Peperoncino Cookie | PURPLE | 2 | cookie | If there are 15 cards or more in your trash, this Cookie deals +2 attack damage. | 已實作（1 個效果） | 《{P}{P}》 Deals 1 damage. |  | |
| [x] | BS2-073@1 | Peperoncino Cookie | PURPLE | 2 | cookie | If there are 15 cards or more in your trash, this Cookie deals +2 attack damage. | 已實作（1 個效果） | 《{P}{P}》 Deals 1 damage. |  | |
| [x] | BS2-074 | Pink Choco Cookie | PURPLE | 2 | cookie | When this Cookie faints, place up to 1 of your opponent's LV.1 Cookies from their battle area into the trash. | 已實作（1 個效果） | 《{P}{P}》 Deals 2 damage. |  | |
| [x] | BS2-075 | White Choco Cookie | PURPLE | 2 | cookie |  | 無技能文字 | 《{P}》 Deals 1 damage. Then, 《can be used as {P}.》 If one of your opponent's Cookies is LV.1, deals 3 damage. | 已實作（1 個效果） | |
| [x] | BS2-076 | Hero Cookie | PURPLE | 3 | cookie |  | 無技能文字 | 《{N}{N}{N}》 Deals 4 damage. |  | |
| [x] | BS2-077 | Forbidden Incantation | PURPLE |  | item | 《{P}{P}》 《Place 1 of your {P} LV.1 Cookies from your battle area into the trash.》 Select up to 1 of your opponent's Cookies. That Cookie receives 2 damage. | 已實作（1 個效果） |  |  | |
| [x] | BS2-078 | Dragon's Breath | PURPLE |  | item | 《{P}{P}{P}》 Place 1 Cookie that is LV.2 or lower from your battle area into the trash. | 已實作（1 個效果） |  |  | |
| [x] | BS2-079 | Yew Village Scroll | PURPLE |  | trap | 《{P}》 Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -1 attack damage. Then, select up to 5 cards from your trash that do not have FLIP. Return those cards to your deck and shuffle it. | 已實作（1 個效果） |  |  | |
| [x] | BS2-080 | Abandoned Cloud Nest | PURPLE |  | trap | 《{P}{P}》 If there are 15 cards or more in your trash, select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -3 attack damage. | 已實作（1 個效果） |  |  | |
| [x] | BS2-081 | Blue Dragon's Eye | PURPLE |  | stage | 《{P}》 Place in your stage area. {mob} 《{P}》 《Place this card in the trash.》 Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | 已實作（1 個效果） |  |  | |

---

共 311 張卡牌，其中 0 張技能/效果轉換狀態為 unsupported（代表對應的 `convertOfficialXxx` 函式回傳 undefined，遊戲內該卡沒有可互動的技能/效果，僅剩基礎攻擊傷害，仍需人工確認是否為預期中的簡化卡）。

## 人工逐張核對進度（2026-07-05）

全部 311 張（159 張 BS1/BS2 + 108 張 ST1-ST5 基本卡，含變體共 421 筆）已逐張比對官方原文與實際轉換函式，全數勾選完成。過程中發現並修正 4 個真實邏輯錯誤：

1. **BS1-048** Jelly Pom-Poms：「for every 2」除數未實作，`modify-attack-by-break-count` 新增 `groupSize` 欄位修正。
2. **BS2-051** Whipped Snowcream Village：官方文字用「Card Rests.」而非「Rest this card.」，`restSource` 判斷正則式沒吃到，場景卡可無限重複使用。已改用共用的 `RESTS_THIS_CARD_PATTERN`。
3. **BS2-058** Wind Archer Cookie：攻擊追加效果的觸發條件誤用 `opponent-trash-count-at-least`（檢查對手棄牌堆），實際應為 `trash-count-at-least`（檢查自己棄牌堆）。
4. **「you can draw」系統性誤判為強制抽牌**：共 11 張卡（BS1-074、BS2-036、BS2-045、BS2-060、ST3-022、ST4-007、ST4-008、ST4-015、ST4-021、ST4-022、ST5-022）因 `convertOfficialCardEffects` 一般路徑與 `convertOfficialTrapAbility` 的 Then-draw 判斷沒有比對 `isOptionalDraw`，一律轉成強制 `draw` 而非 `draw-up-to`。已修正共用解析邏輯並補上對應轉換測試。

824 項測試全數通過，build/lint 皆乾淨。
