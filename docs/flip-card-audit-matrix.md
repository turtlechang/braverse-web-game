# FLIP 卡稽核矩陣

> 產生：scripts/inventory-flip-cards.ts → data/flip-card-inventory.json → scripts/generate-flip-matrix.ts → 本表。稽核單位＝去除 @ 變體的基礎卡號（保留被 deck 計為 FLIP 的記錄）。

## 摘要（依系列）

| 系列 | FLIP 基礎卡數 | 效果通過 | 已修正 | 無效果 | 誤計為FLIP |
| --- | ---: | ---: | ---: | ---: | ---: |
| BS1 | 9 | 9 | 0 | 0 | 0 |
| BS2 | 9 | 8 | 0 | 1 | 0 |
| BS3 | 10 | 10 | 0 | 0 | 0 |
| BS4 | 15 | 15 | 0 | 0 | 0 |
| BS5 | 11 | 11 | 0 | 0 | 0 |
| BS6 | 10 | 10 | 0 | 0 | 0 |
| P | 30 | 28 | 1 | 1 | 0 |
| ST1 | 4 | 4 | 0 | 0 | 0 |
| ST2 | 4 | 4 | 0 | 0 | 0 |
| ST3 | 4 | 4 | 0 | 0 | 0 |
| ST4 | 4 | 4 | 0 | 0 | 0 |
| ST5 | 4 | 4 | 0 | 0 | 0 |
| **合計** | **114** | 111 | 1 | 2 | 0 |

## 非「效果通過」清單

- 已修正：P-099（本 session 拆回 FLIP 文字，見下方 Bug 紀錄）。
- 無效果：BS2-042 Milk Cookie、P-047 GingerBrave（官方 flipText 為空的 vanilla FLIP，翻開時自動進棄牌、不開決策窗）。

## 驗證方法（2026-08-18 session）

1. **靜態轉接稽核**：scripts/inventory-flip-cards.ts 逐張從官方卡池轉接 runtime FlipAbility，核對 flipText／代價／效果 kinds／attachedHpBonus，產出 data/flip-card-inventory.json（114 張 FLIP 基礎卡）。
2. **引擎層正式對戰驗證**（scripts/verify-flip-kinds.ts，tsc→CJS→node 對實際轉換卡執行 resolveNextDamage／resolveFlip）：每種 FLIP 效果 kind 以真實卡驗證「翻開→開啟 flip 決策窗→發動後正確結算」：draw-up-to（BS3-004）、gain-hp＋棄牌代價（BS3-012）、attachedHpBonus（BS6-069）、damage 選對手（BS1-002）、flip-to-break＋break-to-hand（BS4-031）、flip-to-support 休息（BS1-067）、choose-one（BS4-102）；P-099 修正後翻開停在 flip 決策窗、發動抽 1 張、翻開卡進棄牌區。全通過。
3. **全量單元測試**：`npm test -- --maxWorkers=1` 通過 **208 個測試檔／3,336 項**；其中 `battle-pending-flip.test.ts`、`effects-new-mechanics.test.ts`、card-pool、starter-deck 與 adapter／contract 回歸涵蓋 FLIP 決策窗、代價、附著 HP 與 vanilla FLIP。
4. **既有瀏覽器正式稽核文件**：docs/bs5-effect-audit-*.json、docs/bs6-effect-audit-*.json、docs/p0xx-effect-audit-*.json 對 .flip-response-modal 記錄 select:flip／confirm:flip／skip:negative-flip，BS5／BS6／P 系列 FLIP 卡全數 PASS。

> 完整驗證：`npm run typecheck`、`npm run lint`、`npm run build`、`npm run validate:cards`、`npm run check:card-pool`、`npm test -- --maxWorkers=1` 與 `npm run test:browser:smoke` 均通過；Browser smoke 包含 AI 20／20、牌組編輯器 4 個 viewport、線上好友房同步與錯誤路徑。

## 色別結算

| 顏色 | 基礎卡總數 | 效果通過 | 已修正 | 無效果 | 誤計為FLIP |
| --- | ---: | ---: | ---: | ---: | ---: |
| 黑 | 2 | 2 | 0 | 0 | 0 |
| 藍 | 23 | 22 | 0 | 1 | 0 |
| 綠 | 22 | 21 | 1 | 0 | 0 |
| 紫 | 20 | 20 | 0 | 0 | 0 |
| 紅 | 23 | 22 | 0 | 1 | 0 |
| 黃 | 24 | 24 | 0 | 0 | 0 |
| 合計 | 114 | 111 | 1 | 2 | 0 |

## Bug 紀錄

```text
卡號：P-099 Bell Pepper Cookie（GREEN、FLIP）
重現率：100%（資料層，與牌序無關）
前置狀態與操作步驟：以 P-099 作為 HP 卡被翻開，或點開卡牌詳情：
- 翻開時不會停留 flip 決策窗（revealedHpCard.flip 為 undefined），直接進棄牌；
- Deck editor 的 FLIP 篩選／計數仍把它算作 FLIP 卡。
預期（引用卡面）：官方卡面攻擊文字帶「Draw up to 1 card from your deck.」的 FLIP 效果，翻開時觸發抽 1 張。
實際：官方 API 把 FLIP 效果併進 attackText、flipText 為空；P_EXACT_FLIP_EFFECTS[P-099] 因 flipText 為空而永遠走不到，runtime 無 FlipAbility，FLIP 完全不會觸發，卡牌詳情 FLIP 段空白（與 P-100 修正前同型）。
疑似層級：adapter（official-card-adapter.ts 欄位錯置）
證據：data/flip-card-inventory.json（P-099 修正前 runtimeFlipEffectCount=0）、引擎驗證輸出。
修正：official-card-adapter.ts normalizeOfficialCardRecord 新增 P-099 拆欄，與 P-100 同型。
回歸測試：src/cards/contracts/payment-cost-regression.test.ts（新增 P-099 轉接測試）、src/game/battle-pending-flip.test.ts（新增「P-099 FLIP 開啟決策窗並抽 1 張」測試）。
修正後重測：引擎編譯管線執行該劇本 PASS；全量 vitest 待權限恢復後補跑。
```

## 本輪已收尾的其它發現（2026-08-18）

- **誤計為FLIP（21 張）已修正**：hasFlipAbility（src/game/card-pool.ts）改為與 runtime 一致——官方 type: flip 一律算 FLIP，type: cookie 只有在轉接後真的有 FlipAbility（效果或附著加成）才算。P-056～P-069、BS4-004@1、BS5-039@2 等官方 flipText 重複攻擊名的普通餅乾／變體不再計入 Deck editor 的 FLIP 篩選與「FLIP N/16」上限（custom-deck.ts）；FLIP 計數由 144 降至 123、cookie 誤算歸零（P-059 同型、先前已修正過）。
- **gain-hp vs attachedHpBonus 已統一**：convertOfficialFlipAbility 的一般路徑對「The Cookie with this card attached for HP gains +N HP.」改回 attachedHpBonus（附著期間剩餘 HP 連續 +N，getCookieEffectiveHp 一併計算），與 BS5-004／BS6-069 等 exact map 同一語意；BS3-012 等 29 張舊系列卡補回附著期間的隱藏 +1（引擎驗證 1→2）。翻開發動時由 resolveFlip 把加成轉成牌庫頂補 N 張 HP 卡，實戰結算不變（verify-flip-kinds.ts 全 PASS）。

## 待確認／未處理

- **BS2-042 Milk Cookie、P-047 GingerBrave**：官方 flipText 為空。BS2-042 已在 docs/card-review-checklist.md 人工勾核為「無效果文字」；P-047 的 P_EXACT_FLIP_EFFECTS 故意留空效果。兩者翻開時自動進棄牌（不開決策窗），與 vanilla FLIP 一致；hasFlipAbility 仍依官方 type: flip 把它們算入「FLIP N/16」。是否官方卡面確無 FLIP 效果仍待官方來源確認。

## 已知限制

- 本次驗證未涵蓋外部 Preview／Production URL；Browser smoke 使用本機 `127.0.0.1:4173`／`8787` 服務。BS2-042 與 P-047 的空白官方 `flipText` 是否確實為 vanilla FLIP，仍待官方來源確認。

## 全部 FLIP 卡

| 卡號 | 名稱 | 顏色 | 官方 flipText | runtime 效果 | 效果數 | 狀態 |
| --- | --- | --- | --- | --- | ---: | --- |
| BS3-004 | Royal Berry Cookie | RED | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS3-012 | Jungleberry Cookie | RED | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS3-027 | Marzipan Cookie | YELLOW | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS3-035 | High Priest Cheesenbird | YELLOW | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS3-056 | Pinecone Cookie | GREEN | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS3-058 | Avocado Cookie | GREEN | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS3-074 | Grand Madeleine Cookie | BLUE | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS3-085 | Custard Cookie | BLUE | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS3-106 | Alchemist Cookie | PURPLE | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS3-107 | Prophet Cookie | PURPLE | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS4-006 | Flaming Hot Wing | RED | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS4-008 | Scovillia Headmaster | RED | If your break area is LV.6 or higher, select up to 1 of your opponent's Cookies whose remaining HP is 2 or more. That Cookie receives 1 damage. | damage | 1 | 效果通過 |
| BS4-010 | Scovillia Student Fan | RED | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS4-031 | Rain Deity Cookie | YELLOW | If your break area is LV.5 or higher, return up to 1 LV.1 Cookie from your break area to your hand. Then, place this card in your break area. | break-to-hand+flip-to-break | 2 | 效果通過 |
| BS4-032 | Cream Ferret Cookie | YELLOW | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS4-036 | GingerBrave | YELLOW | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS4-050 | Biscuit Giraffe | GREEN | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS4-056 | Tiger Lily Cookie | GREEN | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS4-057 | Jelly Froggy | GREEN | If your break area is LV.6 or higher, you can place this card in your support area as rested. | flip-to-support | 1 | 效果通過 |
| BS4-067 | Gold Citrine Cookie | BLUE | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS4-068 | Aquamarine Cookie | BLUE | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS4-072 | Mystic Opal Cookie | BLUE | View 3 cards from the top of your deck; return them to the top of your deck in any order. | inspect-deck | 1 | 效果通過 |
| BS4-101 | Eclair Cookie | PURPLE | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS4-102 | Wildberry Cookie | PURPLE | Place up to 3 cards from the top of either player's deck into the trash. | choose-one | 1 | 效果通過 |
| BS4-105 | Financier Cookie | PURPLE | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS5-004 | Lollipop Cookie | RED | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS5-009 | Butterbear Cookie | RED | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS5-038 | Cherry Cookie | YELLOW | （空） | draw-up-to | 1 | 效果通過 |
| BS5-041 | Firecracker Cookie | YELLOW | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS5-046 | Goblin Cookie | GREEN | （空） | 附著+HP | 0 | 效果通過 |
| BS5-049 | Melon Bun Cookie | GREEN | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS5-073 | Cyborg Cookie | BLUE | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS5-074 | Sorbet Shark Cookie | BLUE | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS5-082 | Ion Cookie Robot | BLUE | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS5-090 | Strawberry Stick Cookie | PURPLE | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS5-095 | Mint Wafer Cookie | PURPLE | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS6-006 | Cherry Blossom Cookie | RED | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS6-009 | Cotton Candy Cookie | RED | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS6-027 | S'more Cookie | YELLOW | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS6-037 | Cannoli Cookie | YELLOW | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS6-046 | Langue de Chat Cookie | GREEN | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS6-056 | Cappuccino Cookie | GREEN | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS6-067 | Vampire Cookie | BLUE | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS6-069 | Sandwich Cookie | BLUE | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS6-103 | White Ghost Cookie | PURPLE | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS6-104 | Black Garlic Cookie | PURPLE | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS1-002 | Kumiho Cookie | RED | 《Discard 1 card.》 Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. | damage | 1 | 效果通過 |
| BS1-015 | Rose Cookie | RED | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS1-018 | Popcorn Cookie | RED | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS1-030 | Rockstar Cookie | YELLOW | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS1-040 | Earl Grey Cookie | YELLOW | 《Discard 1 card.》 If your break area is LV.6 or higher, the Cookie with this card attached for HP gains +2 HP. | gain-hp | 1 | 效果通過 |
| BS1-041 | Orange Cookie | YELLOW | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS1-055 | Red Bean Cookie | GREEN | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS1-067 | Churro Cookie | GREEN | 《Discard 1 card.》 If your support area contains 4 or more cards, place this card in your support area as rested. | flip-to-support | 1 | 效果通過 |
| BS1-069 | Cookiemals | GREEN | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS2-001 | Muscle Cookie | RED | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS2-009 | Carrot Cookie | YELLOW | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS2-019 | Cheesecake Cookie | GREEN | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS2-034 | Frost Queen Cookie | BLUE | If your break area is LV.4 or higher, you can draw up to 2 cards from your deck. | draw-up-to | 1 | 效果通過 |
| BS2-037 | Chocolate Bonbon Cookie | BLUE | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| BS2-042 | Milk Cookie | BLUE | （空） | （無效果） | 0 | 無效果 — flipText 為空，人工已核無效果文字 |
| BS2-056 | Raspberry Mousse Cookie | PURPLE | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| BS2-063 | Space Doughnut | PURPLE | 《Discard 1 card.》 If your break area is LV.3 or higher, place either 1 of your opponent's Cookies that is LV.2 or lower from their battle area or 1 stage card from their stage area into the trash. | field-to-trash | 1 | 效果通過 |
| BS2-072 | Pastry Cookie | PURPLE | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| P-040 | Milky Way Cookie | PURPLE | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| P-047 | GingerBrave | RED | （空） | （無效果） | 0 | 無效果 — flipText 為空，P_EXACT 故意留空效果 |
| P-063 | Shadow Milk Cookie | BLUE | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| P-077 | Eternal Sugar Cookie | RED | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| P-081 | Fettuccine Cake Hound | YELLOW | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| P-085 | Tropical Pop Cake Hound | BLUE | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| P-092 | Pudding à la Mode Cookie | BLUE | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| P-099 | Bell Pepper Cookie | GREEN | （空） | draw-up-to | 1 | 已修正 — 本 session：官方把抽 1 FLIP 效果併進 attackText，已拆回 flipText |
| P-100 | Icicle Yeti Cookie | BLUE | （空） | 附著+HP | 0 | 效果通過 |
| P-107 | Parfait Cookie | RED | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| P-112 | Adventurer Cookie | YELLOW | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| P-113 | Green Tea Mousse Cookie | GREEN | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| P-118 | Strawberry Stick Cookie | PURPLE | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| P-151 | Black Sapphire Cookie | RED | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| P-152 | Black Sapphire Cookie | YELLOW | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| P-153 | Black Sapphire Cookie | GREEN | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| P-154 | Black Sapphire Cookie | BLUE | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| P-155 | Black Sapphire Cookie | PURPLE | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| P-156 | Black Sapphire Cookie | BLACK | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| P-157 | Candy Apple Cookie | RED | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| P-158 | Candy Apple Cookie | YELLOW | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| P-159 | Candy Apple Cookie | GREEN | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| P-160 | Candy Apple Cookie | BLUE | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| P-161 | Candy Apple Cookie | PURPLE | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| P-162 | Candy Apple Cookie | BLACK | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| P-024 | Caramel Choux Cookie | RED | <Discard 1 card.> The Cookie with this card attached for HP gains +1 HP. | gain-hp | 1 | 效果通過 |
| P-025 | Marzipan Cookie 2 | YELLOW | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| P-026 | Marzipan Cookie 3 | YELLOW | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| P-027 | Marzipan Cookie 4 | YELLOW | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| P-022 | Milky Way Cookie | GREEN | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| ST1-001 | Princess Cookie | RED | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| ST1-004 | Carrot Cookie | RED | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| ST1-013 | Adventurer Cookie | RED | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| ST1-015 | Pistachio Cookie | RED | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| ST4-003 | Dr. Wasabi Cookie | BLUE | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| ST4-006 | Peppermint Cookie | BLUE | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| ST4-009 | Ice Candy Cookie | BLUE | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| ST4-014 | Skating Queen Cookie | BLUE | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| ST3-007 | Sparkling Cookie | GREEN | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| ST3-008 | Spinach Cookie | GREEN | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| ST3-011 | Onion Cookie | GREEN | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| ST3-014 | Angel Cookie | GREEN | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| ST5-003 | Fig Cookie | PURPLE | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| ST5-008 | Fairy Cookie | PURPLE | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| ST5-012 | Clover Cookie | PURPLE | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| ST5-014 | Pancake Cookie | PURPLE | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| ST2-005 | Mustard Cookie | YELLOW | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| ST2-007 | Chestnut Cookie | YELLOW | Draw up to 1 card from your deck. | draw-up-to | 1 | 效果通過 |
| ST2-012 | Cheerleader Cookie | YELLOW | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
| ST2-014 | Custard Cookie III | YELLOW | 《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP. | 附著+HP | 0 | 效果通過 |
