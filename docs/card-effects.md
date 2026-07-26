# 卡牌效果引擎

## 資料模型

`CardEffect` 目前包含：

- `damage`：對合法目標造成固定傷害
- `modify-attack`：增加或減少攻擊傷害
- `modify-damage-received`：增加或減少承受的攻擊傷害；可在指定門檻達成時固定為特定傷害
- `draw`：從效果來源玩家的牌庫抽牌，不需選擇目標；牌庫耗盡時進入 pending Refresh
- `draw-up-to`：由玩家選擇抽 0～N 張，逐張沿用 Refresh 流程
- `field-to-trash`：將符合等級或剩餘 HP 上限的餅乾移至棄牌區；卡牌文字允許時也可選場景
- `opponent-battle-to-trash`：將符合條件的對手戰鬥區餅乾移至棄牌區
- `opponent-random-discard`：隨機選擇對手手牌棄置，但保留其餘手牌原順序
- `deck-to-support`：從效果來源玩家牌庫頂取牌，直立即 rested=false 放入支援區，不需選擇目標；牌庫耗盡時進入 pending Refresh（remainingDraws=0）
- `deck-to-trash`：將指定玩家牌庫頂的可用卡牌直接放入棄牌區；不是抽牌，因此不建立 Refresh
- `gain-hp`：FLIP 結算時從牌庫頂增加實體 HP 卡
- `prevent-knockout`：本次戰鬥中使指定餅乾 HP 不會降至 0
- `support-to-trash`：將指定數量的支援區卡牌移至棄牌區
- `optional-cost-attack`：攻擊傷害後可略過的追加效果；來源餅乾可先提供 `sourceEnergy`，其餘費用才由支援區支付
- `target`：目標陣營、最少／最多數量與篩選條件
- `condition`：目前支援 Break Area 最低等級、來源 HP、牌庫／棄牌區／支援區 keyword 等條件
- `duration`：本回合、對手下回合或永久

無目標效果的判斷統一由 `isEffectUntargeted` 共用（目前涵蓋 `draw` 與 `deck-to-support`）。

效果定義不直接保存玩家選擇。執行時由 UI 傳入卡牌 instance ID，
`selectEffectTargets` 會先驗證數量、陣營及條件，再交給執行器套用。

## 執行流程

1. `convertOfficialCardEffects` 將已知官方文字轉為 `CardEffect`。
2. UI 使用 `getEffectTargetCandidates` 顯示可選目標。
3. 玩家送出選擇後呼叫 `executeCardEffect`。
4. 直接傷害沿用基本勝負與替補判定。
5. 攻擊修正保存在 `GameState.attackModifiers`。
6. `getEffectiveAttack` 提供基本攻擊與 UI 顯示目前攻擊力。
7. 暫時修正在指定回合結束時移除。
8. 抽牌效果使用既有的 `drawCards` 純函式與 `pendingRefresh` 流程，
   牌庫耗盡時自動進入 Refresh 等待。

## 語意驗證防線

`npm run validate:cards` 除了確認卡牌可轉換，還會驗證 ability 不是空殼、技能標記、可選抽牌與來源橫置語意。對容易發生「已有 payload 但語意不完整」的卡牌，`scripts/lib/card-effect-validation.ts` 維護人工覆核的高風險契約，鎖定效果 kind、代價、條件、目標與複合效果數量。契約是回歸防線，不取代官方文字與完整流程測試。

## 已支援效果

下列效果已完整實作，可經由 `CardEffect` union type 描述並由規則引擎執行：

| 效果 | 對應 CardEffect kind | 說明 |
|---|---|---|
| 傷害 | `damage` | 對合法目標造成固定傷害，含勝負與替補判定 |
| 攻擊修正 | `modify-attack` | 增加或減少攻擊傷害，回合結束移除 |
| 全體攻擊修正 | `modify-all-attack` | 增加或減少己方所有餅乾攻擊傷害，回合結束移除 |
| 承受傷害修正 | `modify-damage-received` | 增加或減少承受的攻擊傷害；可在指定門檻達成時固定為特定傷害，回合結束移除 |
| 純抽牌 | `draw` | 從牌庫抽固定 N 張，牌庫耗盡觸發 pending Refresh |
| 可選抽牌 | `draw-up-to` | 玩家選擇抽 0～N 張；選擇大於 0 時沿用逐張抽牌與 Refresh 流程 |
| 場上卡→棄牌區 | `field-to-trash` | 依陣營、等級與剩餘 HP 上限篩選餅乾，文字允許時也可選場景；餅乾屬非昏厥離場，仍會清理修正並建立補位 |
| 對手戰鬥區→棄牌區 | `opponent-battle-to-trash` | 移除符合條件的對手戰鬥區餅乾，屬非昏厥離場；可用 `min: 0` 表示「最多選 1 個」 |
| 對手隨機棄牌 | `opponent-random-discard` | 透過注入式洗牌決定棄置卡，剩餘手牌維持原順序 |
| 牌庫頂→支援區 | `deck-to-support` | 從牌庫頂取 N 張直立放入支援區（例：ST3-010 Aloe Cookie）；牌庫耗盡觸發 pending Refresh（remainingDraws=0）。僅接受等價於「Take N card(s) from the top your deck and place it/them in your support area as active」的文字 |
| 牌庫頂→棄牌區 | `deck-to-trash` | 將己方或對手牌庫頂最多 N 張可用卡牌直接放入其棄牌區；此移動不是抽牌，不觸發 Refresh |
| 休息區→棄牌區 | `break-to-trash` | 從效果來源玩家休息區選最多 N 張 LV.X 卡移至棄牌區；不需選擇目標時玩家可選 0 張確認。移動後以 resolveBasicVictory 檢查勝負。僅接受等價於「Select up to N LV.X card(s) from your break area and place it/them in the trash」的文字，不接受 Then/FLIP/額外子效果 |
| 增加 HP | `gain-hp` | 目前供起始牌組 FLIP 使用，從牌庫頂補入 HP 卡 |
| HP 下限保護 | `prevent-knockout` | 目前供 TRAP 使用，本次戰鬥保留至少 1 張 HP 卡。官方裁定（BS3-100 vs ST3-020）：這個保護擋的是「這次戰鬥中 HP 不會變 0」，不是只擋一般傷害——只要 `state.pendingBattle` 還在（戰鬥尚未結束）且目標在 `preventKnockoutTargetIds` 內，任何會讓 HP 卡歸零的移除都要擋下，包括攻擊後續效果的 `hp-to-trash`。`hp-to-trash` 執行器已對此加上檢查：保護生效且剩餘 HP 卡數 ≤ 欲移除數時直接不執行，回傳原狀態；不能算出 `removeCount=0` 後照舊呼叫 `slice(-removeCount)`——JS 的 `slice(-0)` 等同 `slice(0)`，會把整疊 HP 卡誤判成「被移除」，導致同一張卡同時留在 `hpCards` 又被複製進棄牌區 |
| 禁止 FLIP | `disable-flip` | 被影響玩家本回合不能發動 FLIP 效果 |
| 檢視 HP | `view-hp` | 查看目標餅乾的 HP 卡內容（可選） |
| 戰鬥區→支援區 | `battle-to-support` | 將目標餅乾從戰鬥區移至支援區 |
| 棄牌區→戰鬥區 | `trash-to-battle` | 從棄牌區將指定餅乾移至戰鬥區 |
| 支援區→手牌 | `support-to-hand` | 將支援區卡牌移回手牌 |
| 對手手牌→棄牌區 | `opponent-discard-hand` | 對手必須選擇指定數量的手牌放入棄牌區；對手無手牌時效果直接完成 |
| 支援區→棄牌區 | `support-to-trash` | 指定數量的支援區卡牌移至棄牌區 |
| 目標選擇 | `target` | 目標陣營、最少／最多數量與篩選條件 |
| 條件 | `condition` | 目前支援 Break Area 最低等級檢測 |
| 支援區 keyword 條件 | `support-keyword-at-least` | 檢查來源玩家支援區是否至少有指定數量的 keyword 卡，例如 `[Soul Jam]` |
| 持續時間 | `duration` | 本回合、對手下回合或永久 |
| HP 送棄牌區 | `hp-to-trash` | 選擇己方 1 隻餅乾，將指定數量的 HP 卡送入棄牌區；非傷害不觸發 FLIP/afterDamage，HP 歸 0 時餅乾進入休息區並沿用離場/補位/勝負流程 |
| 可選攻擊後續費用 | `optional-cost-attack` | 玩家可略過；來源餅乾先提供 `sourceEnergy` 中列出的指定能量，只有剩餘費用由支援區支付。目標步驟依子效果的對象與 `min` 呈現，支援己方／對手與「最多選 1 個」 |
| HP 卡搬移 | `transfer-hp` | 在來源餅乾與選定的己方餅乾之間搬移 HP 頂端卡；`direction: 'to-source'` 由目標供牌（BS3-031），`'from-source'` 由來源供牌（BS3-089）。供牌方 HP 歸 0 時照常昏厥並沿用離場／補位／勝負流程。HP 卡屬卡主牌組，不支援跨玩家搬移 |
| 餅乾設為活躍 | `set-cookie-active` | 解除選定餅乾的休息狀態；與只處理支援區的 `set-active` 不同。可用 `restedOnly` 目標篩選只列出休息中的餅乾（BS3-053） |
| 依戰鬥區餅乾數抽牌 | `draw-up-to-battle-cookie-count` | 依雙方戰鬥區指定等級的餅乾數量計算抽牌上限，再沿用 `draw-up-to` 的可選抽牌流程；上限為 0 時直接略過（BS3-092） |
| 棄牌區全部→牌庫 | `trash-to-deck-all` | 不需選擇，將棄牌區整批洗回牌庫。後續的「Then」必須放在 `thenEffects` 內嵌執行——本效果會清空棄牌區，同層的下一個效果若重掛同一個棄牌區條件，重新判定時必定失敗而被跳過（BS3-113） |
| 揭示牌庫底 | `reveal-bottom-deck` | 揭示牌庫底 1 張，依是否為 Cookie 分別送往牌庫頂或手牌；牌庫為空時直接略過，對應官方文字的「up to 1」（BS3-073） |
| 手牌→戰鬥區 | `hand-to-battle` | 從手牌選餅乾登場，HP 卡照常自牌庫頂補入；`gainHp` 對應「Then, that Cookie gains +N HP」。登場後照常觸發 OnPlay 與牌庫耗盡的 Refresh 判定（BS3-029） |
| 對手棄牌區→對手休息區 | `opponent-trash-to-break` | 從對手棄牌區選餅乾放進**對手**休息區；會推進對手 break 等級，因此走與其他休息區移動相同的勝負判定（BS3-028） |
| 牌庫檢視 | `inspect-deck` | 查看牌庫頂 N 張。`restDestination` 決定未選走的卡去 `bottom`／`top`／`trash`（前兩者由玩家排序），`pickDestination` 決定選走的卡加入手牌或直接登場，`filterColor`／`filterType`／`optionalPick` 控制可選範圍（BS1/BS2 既有卡、BS3-095、BS3-083、BS3-114） |

| 選擇一項 | `choose-one` | 官方文字的「Select 1 of the following.」（BS3-068）。這個效果本身永遠不會被執行——玩家或 AI 選定模式後由 `expandChooseOne` 就地換成該模式的效果，`effectIndex` 不動，之後每個子效果照常各自走目標選取流程。本機 UI、線上 UI、指令層（`resolve-choose-one`／`begin-*` 的 `chooseOneModes`）與 AI 必須共用同一份展開邏輯，否則四邊對「接下來處理哪個效果」會分歧；執行器遇到未展開的 `choose-one` 會直接丟錯而不是默默略過 |
| 休息區→戰鬥區（來源自己） | `break-source-to-battle` | 讓技能來源自己從休息區登場，HP 卡數固定為 `hpCount`（不是卡面 HP），照常觸發 OnPlay 與牌庫耗盡的 Refresh 判定；戰鬥區已滿（2 隻）時執行器直接丟錯，`canActivateCookieSkill` 會提前擋下（BS3-025） |

代價方面，`AbilityCost.trashToDeckBottom` 表示「從棄牌區選 N 張卡放到牌庫底」（BS3-112），選取順序即為放入牌庫底的順序。目前只有餅乾技能路徑（`activate-skill`／`begin-activate-skill`）實作，item／stage 的 `payAbilityCost` 會直接丟錯，避免被靜默忽略。`AbilityCost.handToBreakArea` 表示「將手牌餅乾放入自己休息區」，與棄到棄牌區的 `discardHand` 不同，會推進自己的 break 等級並立刻走 `resolveBreakLevelVictory`；目前只有陷阱路徑（`playTrap`）實作（BS3-046）。

`CardSkill.oncePerGame` 搭配 `GameState.skillUsesThisGame` 表示整局只能發動一次。官方 Q&A 明確釋疑：這個限制是**每位玩家**限定一次，即使同一玩家休息區同時有多張同名卡（例如兩張 BS3-025），也只共用這一次額度——因此 key 是 `playerId:card.id`（同名卡共用、跨玩家互不影響），不是 `card.instanceId`（每張實體卡各自不同，會讓同玩家的第二張複本被誤判成尚未使用）。`getOncePerGameKey`（`skills.ts`）是唯一組 key 的入口。BS3-025 的另一條 Q&A 釋疑——戰鬥區與手牌都沒有餅乾時必須從手牌執行「再登場」，不能用休息區的這個技能頂替——由既有的 `pendingReplacement` 一律擋下 `activate` 觸發自然滿足，不需要額外邏輯。`CardSkill.fromBreakArea` 表示技能來源允許在休息區而非戰鬥區發動。這兩個標記靠明確的文字比對設定，不是靠 `{mob}`／`{ap}` 標記推斷——BS3-025 的原文只有 `{mt}`，一般解析會誤判成 `passive`，需要在 `exactCookieSkillTriggers` 明確覆寫成 `activate`。`findSkillSource`（`skills.ts`）是唯一的來源查找入口：先查戰鬥區，找不到才查休息區（且只在該卡技能有 `fromBreakArea` 時才算數），`canActivateCookieSkill`／`activateCookieSkill`／`commands.ts` 的 `activate-skill`／`begin-activate-skill`、`App.tsx`／`OnlineBattleView.tsx` 的點擊處理都必須走這個函式，任何一處各自查 `battleArea` 都會讓休息區技能失效。AI 主動發動技能的三個決策迴圈（`turn-handler.ts`、`evaluated-turn-handler.ts` 兩處）改用 `getActivatableSkillSources` 取得候選來源，把符合 `fromBreakArea` 的休息區餅乾一併收進來，否則 AI 永遠不會用到這類技能。

`TrapCondition.friendly-color-fainted-this-battle` 新增可選的 `minLevel`：未指定時沿用舊行為（本次戰鬥有沒有該顏色餅乾昏厥，不分擁有者與等級），指定時改用 `PendingBattle.faintedCookies`（含擁有者與等級的完整紀錄，`faintedColors` 只留顏色不夠用）判定「己方指定顏色且等級達標的餅乾昏厥」（BS3-046 的「your {Y} LV.2 or higher」）。延遲觸發成立、且效果需要玩家選卡時，`finishBattle` 不會直接執行，而是把效果轉存進 `pendingAbilityEffect`（`sourceKind: 'trap'`）交給既有的逐步結算流程；本機 UI 原本沒有「規則層主動建佇列、UI 被動接手」這種方向的處理，新增了一個 `useEffect` 專門偵測 `sourceKind === 'trap'` 的 `pendingAbilityEffect` 並補建本機的 `pendingEffect`（透過 `window.setTimeout(...,0)` 延後呼叫，避免在 effect body 內同步 `setState`）。

跨玩家戰鬥區目標由 `EffectTargetSelector.side: 'either'` 表示（官方文字的「either player's battle area」）。這種選擇沒有單一擁有者，`getTargetPlayerId` 會直接丟出錯誤，效果必須改用 `getCookieOwnerId` 逐一判定並依擁有者分組結算離場；目前只有 `battle-to-break`（BS3-040）與 `battle-to-deck-top`（BS3-076）處理過。

無目標效果的判斷統一由 `isEffectUntargeted` 共用（目前涵蓋 `draw`、`deck-to-support`、`modify-all-attack`、`trash-to-battle`、`support-to-hand`、`opponent-discard-hand`、`draw-up-to-battle-cookie-count`、`trash-to-deck-all` 與 `reveal-bottom-deck`）。

### 已實作：攻擊後續效果

- `CookieCard.attackEffects` 保存攻擊傷害文字後的效果序列，戰鬥以 `attack-effect` 待決階段在傷害完成後、替補前結算。
- ST2-003 Wizard Cookie 已支援「造成 3 點傷害，之後可選最多 1 張己方 LV.1 休息區卡牌移至棄牌區」。
- BS3-002、BS3-010、BS3-011 已支援「can be used as」來源能量，分別以來源餅乾支付 {R}、{R}、{R}{R} 的可選攻擊後續費用。
- BS3-009、BS3-087、BS3-111 已支援「支援區有 `[Soul Jam]`」的攻擊後條件；僅檢查支援區現存卡的 keyword，`{mou}` 附著本身仍待專屬狀態模型。
- 另一種「{mou} this card to your [指定 Cookie 名稱]」是把道具卡直接附著到特定 Cookie（不進支援區），走 `equip-source` 效果，附著後放進 `CookieInBattle.equippedCards`（見 `docs/game-rules.md` 或 `equip-source` 執行器）。已依官方 Q&A 逐張核對 BS3-019／043／066／091／115 五張「靈魂果醬」的裝載後效果，全數已正確：BS3-019 是持續攻擊加成（`attackBonus`，寫入 `attackModifiers`）；BS3-043 是裝載當下的一次性 +2 HP（只有 `gainHp`，不建立任何持續修正，官方 Q&A 已確認）；BS3-066／091 是「該餅乾攻擊時」的自動觸發效果，由 `battle.ts` 的 `getEquipAttackEffects` 依裝備卡 id 查表，`beginAttack` 建立 `pendingBattle.attackEffects` 時附加在來源餅乾自身攻擊後效果之後；BS3-115 是「不能被對手效果選為目標／不能被送入棄牌區」的保護，由 `targeting.ts` 的 `matchesSelector` 在來源不是擁有者本人時直接排除候選。
- BS3-033、BS3-101 已支援「can be used as」後選最多 1 個符合剩餘 HP 的對手餅乾，分別移至休息區與棄牌區；BS3-088 已支援棄 1 張手牌後選最多 1 個己方戰鬥區餅乾增加 1 HP。
- BS3-086 已支援己方戰鬥區存在 LV.3 餅乾時，棄 1 張手牌對被攻擊餅乾追加 1 點傷害；BS3-102 已支援雙方各將牌庫頂 2 張卡直接送入棄牌區；BS3-105／BS3-113 分別將對手／己方牌庫頂最多 1 張卡直接送入棄牌區。
- 玩家沿用效果目標面板選擇 0 或 1 張；AI 與自動戰鬥採 deterministic 合法選擇。
- 通用 `convertOfficialCardEffects` 仍不接受任意含 `Then` 的複合文字；目前僅對已確認的 ST2-003 攻擊文字建立明確轉接。

## 未支援（unsupported）效果

下列效果**維持 unsupported**，不得部分轉換。其中 [待確認] 表示官方規則或時機細節尚未明朗，不得自行猜測實作；其餘項目是引擎能力尚未到位。

### 已實作：起始牌組 FLIP

- 規則已確認 FLIP 卡在 HP 卡因傷害翻開時立即逐張處理；玩家可以選擇不發動，完成發動或略過後才翻下一張 HP 卡，因此不會形成多張 FLIP 同時等待處理的情況。
- FLIP 卡翻開的瞬間若觸發 Deck-to-support 等需洗牌或移動的效果，是否影響其他尚未翻開的 FLIP 執行，目前無官方明確規範。
- `card_type=FLIP` 僅解析官方 `card_flip`，目前支援抽最多 1 張牌，以及棄 1 張手牌後增加 1 HP。
- 傷害逐張翻開 HP；每張 FLIP 完成發動或略過後才繼續下一張。

### 已實作：起始牌組 TRAP

- 規則已確認每次攻擊的陷阱步驟只能回應一次：使用 1 張陷阱，或發動 1 個「當對手的餅乾攻擊時」效果，兩者擇一。
- `card_type=TRAP` 僅解析官方 `card_attack_text`。
- 原型每次攻擊最多發動 1 張，支援五副起始牌組內的攻擊修正、條件傷害、HP 下限、支援／戰鬥區餅乾代價、場上卡移除與牌庫頂放入休息支援。

### 已實作：起始牌組物品與場景

- 三副起始牌組共 10 張物品卡與 2 張場景卡已完整支援。
- 物品卡費用支付後執行效果，結算後放入棄牌區；場景卡於主要階段使用，已有場景時可替換。
- 已支援效果種類：`disable-flip`、`view-hp`、`modify-all-attack`、`battle-to-support`、`trash-to-battle`、`support-to-hand`。
- 複合效果序列引擎支援子效果之間暫停、等待玩家選擇（如 ST2-018 的 view-hp 為可選）、Refresh 插入與補位銜接。
- AI 以 deterministic 策略決定物品/場景使用時機、費用支付與目標選擇。

### 已實作：When this Cookie faints

- 餅乾因傷害或效果離開戰鬥區時，會觸發 `card.skill.faint` 標記的被動技能。
- `convertOfficialCardEffects` 已解析「When this Cookie faints」開頭的效果文字（目前支援 damage 與 draw）。
- 戰鬥傷害與效果傷害均會在餅乾離場後觸發 faint 效果。
- 具有有效目標（如 `min: 0, max: 1` 的 opponent damage）的 faint 效果會進入 `pendingFaintEffects` 佇列，等待玩家或 AI 選擇目標後結算；無目標效果（如 draw）直接結算。
- 多個餅乾同時昏厥時，faint 效果依序進入佇列，逐個等待選擇。
- 玩家可選擇 1 個合法目標或選 0 確認（up to 1）；AI 以 deterministic 策略選擇（優先血量最低的對手餅乾）。

### 已實作：If opponent Cookie attacks more than N

- TRAP 回應窗會以宣告時鎖定的攻擊傷害檢查門檻。
- 非 Cookie 卡（陷阱、物品、場景）如 `convertOfficialCardEffects` 回傳 unsupported 但已由專屬解析器（`convertOfficialTrapAbility` 等）正確解析，執行期卡牌會自動代入 ability text 作為 `effectText`，供 CardDetailModal 顯示詳情。

### 已實作：複合效果序列（起始牌組範圍）

- 官方效果文字以「Then」或「If you did」或連續多個效果連接時，複合效果序列引擎支援依序執行子效果，並在子效果之間暫停等待玩家或 AI 選擇。
- 已支援：ST2-018（draw + optional view-hp）、ST3-017（damage + support-to-trash）、ST3-022（support-to-hand + draw）及其他起始牌組物品/場景的複合效果。
- 複合效果執行途中可插入 Refresh（牌庫耗盡時）與補位（餅乾離場時），完成後回到序列中尚未執行的子效果。
- 起始牌組以外包含 Then/If you did 且無法以現有效果組合安全描述的文字，仍維持 unsupported。

### 部分實作：特殊代價（非能量／非 Rest this card）

- 起始牌組 FLIP 的棄 1 張手牌、ST3-002／ST3-005／ST3-015 的支援區卡牌送棄牌區技能代價，以及 ST3-019 的支援區卡牌移至棄牌區已支援；其他特殊代價仍維持 unsupported。
- BS1/BS2 紅色非角色卡（BS2-006 hp-to-trash、BS2-007 discardHandColor）已完整支援；UI 的陷阱手牌候選清單現在會依 `discardHandColor` 過濾，僅顯示符合顏色限制的手牌。

### 尚未實作：一般移動與持續型條件效果

- 起始牌組 FLIP 的 HP 增加已支援；其他任意卡牌移動與持續型條件效果尚未支援。
## BS1 Brave Beginning Phase 1/2 effect adapter notes

- Phase 1 已建立 `official-brave-beginning-bs1.en.json` 的轉接盤點測試：99 筆資料、78 個 base card number，類型分布為 cookie 72、flip 12、item 6、trap 6、stage 3。
- Phase 2 先支援可直接映射到既有規則引擎的 BS1 文字：OnPlay/Activate/FLIP 的棄手牌代價傷害、`Return this Cookie to your hand`、faint 後 `break-to-trash`、支援區送棄牌區代價、`deck-to-support`、`set-active`，以及 `When your turn ends` 的 endPhase 判定。
- `convertOfficialCardEffects` 現在可用 `baseCardNumber` 處理 BS1 變體卡號，例如 `BS1-002@1`，但一般卡號仍優先使用 `cardNumber`，避免測試用假卡或舊資料被 base 欄位誤覆蓋。
- Phase 3 仍需另行處理高風險 BS1 效果：攻擊重新指定、全場/全對手傷害、依休息區或支援區數量變動的效果、從休息區登場、以及「本回合支援區減少」等需要新增狀態追蹤的條件。HP 送棄牌區代價（`hp-to-trash`）已支援。
