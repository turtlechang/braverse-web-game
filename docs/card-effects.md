# 卡牌效果引擎

2026-10-05 R008／R009 已依使用者答案確認：非昏厥離場的 Awaken 底卡與原 HP／裝備進棄牌區；072 Activate／073 Then 不再隔離底卡互動。主牌庫返回代價的候選與最終支付均排除 EXTRA 本體；回牌庫效果將其分流至 EXTRA Deck，085 的五張 Blocker 是條件，不是回牌庫代價。公開紀錄、目標提示與結算短訊同步呈現實際去向；舊隔離與先前完整實體驗收結論的更正見[裁定清單](bs12-rulings-2026-10-05.md)。

2026-10-05 BS12-112來源棄牌代價與HP隱私：來源及全HP尚未真正支付前，攻擊後代價提示不提供棄牌區目標、不投影隱藏HP牌面。純規則指令先提交來源代價，再透過既有攻擊續接佇列選公開棄牌區卡；剛進棄牌區的合法LV1Arena HP可回收0～2張，選零不退費，補位在整段結算後才處理。既有明確目標的原子命令仍先支付再結算；其他公開手牌代價投影不變。112兩印刷新矩陣96案、專項／共用394項、最新完整783檔／16,660項通過。全部已確認印刷及九項待裁定範圍見[統一清單](bs12-rulings-2026-10-05.md)，正式／逐卡online另列。下列為較早歷史快照。

2026-10-04：098候選局部Browser112／112、卡牌／規則2檔93項及共用預覽4項、受影響15檔／741項（包含專項，不相加）、strict1／1、build／全域lint通過。黑色Arena LV1／HP1、黑色有效LV1戰鬥區Special Play、KK普通2及免費FLIP固定原LV2以上HP持有者補1HP已驗；LV1／交集與區域反例、最後HP救援／昏厥、Refresh／LV10通過。修正共用快速預覽漏顯Special Play，095／096／097／098雙尺寸8案另列；原生Chrome正反另確認。一般累計7,760、cursor099、剩14基礎／23印刷；1250個來源雜湊一致。719檔／11,724項與AI／ST1屬097／098修改前，097～099全套留099批末。154 inventory／0 promoted、正式BS12／逐卡online未完成；全部裁定112及所有印刷後。

2026-10-04：097候選局部Browser42／42、專項2檔／53項（包含於四檔108項097／094回歸）、受影響10檔／539項（包含專項，不相加）、strict1／1、build／全域lint通過。黑色Arena LV1／HP2、N1普通1與六色支援支付、未選支援保留、取消／反選／改選目標、昏厥及最後HP控制FLIP已驗；新增strict guard拒絕16個真實runtime語意變異，普通轉接原已正確。原生Chrome紫色支付／取消／無能量阻擋／兩HP登場與原圖746×1038另確認。一般累計7,648、cursor098、剩15基礎／24印刷；719檔／11,724項（773.98秒）及AI／ST1共用驗證為094～096、097修改前歷史證據，097～099全套留099批末。154 inventory／0 promoted、正式BS12／逐卡online未完成；全部裁定112及所有印刷後。

2026-10-04：096候選局部Browser126／126、專項3檔／92項、受影響19檔／806項（包含專項，不相加）、strict1／1、build／全域lint通過。黑色Arena LV1／HP1、黑色LV1戰鬥區Special Play、KK普通2、己方手牌最多五且同張己方黑色Arena戰鬥區Cookie才免費抽0～2已驗。手牌五→七、零HP來源／抽後昏厥／抽出Cookie補位、區域及交集反例、Refresh／LV10均通過；共用詳情漏顯Special Play及誤標FLIP已修正，095／096詳情四案、095操作十二案另列。一般累計7,606、cursor097、剩16基礎／25印刷；094～096批末完整Vitest 719檔／11,724項（773.98秒）、AI Browser與ST1好友房核心同步全部exit0；1242個凍結來源雜湊一致。ST1為共用核心同步，未驗完整對局至勝負或BS12逐卡online。154 inventory／0 promoted、正式BS12／逐卡online未完成；全部裁定112及所有印刷後。

2026-10-04 BS12-095：Special Play獨立保存黑色有效LV1 Cookie戰鬥區棄牌代價，沒有Arena／REST限制；來源技能被動且無OnPlay。FLIP棄1任意手牌後0～1己方Arena補1HP，KK普通2無Then；沿用既有非昏厥離場／補位、FLIP救援、Refresh／終局。119項專項／605項不重疊回歸、114案Browser、strict1／1、build／lint通過。完整709檔／11,457項屬094／095修改前，本批全套待096批末。下列094及更早為歷史快照。

2026-10-04 BS12-094：沿用NNN普通4與正常四HP登場，六色及混色實際付款，來源及未選支援維持正確狀態；沒有Skill／Then／FLIP／EXTRA／Awaken。新增精確契約守門16個語意mutant與規則／控制器回歸，普通傷害最後HP先保留FLIP，再救援或昏厥。候選本機操作方fallback不改線上viewer。56項專項／623項受影響、44案Browser、strict1／1、build／lint通過；完整709檔／11,457項屬修改前，094～096全套待096批末。下列093及更早為歷史快照。

2026-10-04 BS12-093／093@1：optional-cost-attack沿用AbilityCost.trashToDeckBottom及trashToDeckIds有序payload，要求兩張不同的己方棄牌區印刷Blocker Cookie，原牌庫順序保留並依點選順序附加，不洗牌；付款後再結算0～1任意對手damage1。普通3先結算，原對手昏厥可選另一張，選零仍支付、略過不移動。Blocker手牌代價獨立。核心／AI／descriptor／公開紀錄與共用面板同步，未新增command欄位。119項專項、901項受影響、172案Browser、strict2／2及091～093完整709檔／11,457項（763.34秒）通過。下列092及更早為歷史快照。

2026-10-04 BS12-092／092@1：CardSkill.friendlyFaintEffects與PendingFaintEffect.triggerReason保存存活戰鬥區來源的己方昏厥監聽，僅真正昏厥且對手目前手牌至少三張才要求owner棄一，REST仍有效；離場及非昏厥移動不觸發。BreakBlockerCookieCountAtLeastCondition.keyword使092要求Cookie／Arena／Blocker同卡交集，090未加Arena限制。EXTRA付款沿用resolve-optional-cost-attack的targetIds作戰鬥區代價，核心先移Cookie及HP／裝備，再正常登場五HP，不觸發補位。後攻Then獨立棄一、不套三手牌門檻，棄牌pending保存實際attackText。Awaken底卡非昏厥離場仍隔離，不猜裁定。87項專項、39檔1,121項受影響、156案Browser及strict2／2通過；最新完整700檔11,138項屬091前，091～093全套留093批末。

2026-10-04 BS12-091／091@1候選：TrashToHandEffect新增blockerOnly，規則候選要求同一張Cookie具有印刷Blocker，另用excludeCardName排除全部Caramel Arrow同名。PendingFaintEffect.cost保存獨立牌庫頂三張代價；resolve-faint-effect以payDeckToTrash明確確認，付款前min/max=0且不提供目標，使用既有executeDeckToTrash／Refresh續接，保留其他尚未支付的代價，付款後再取目前棄牌區候選。舊指令沒有新旗標時維持原有流程，新旗標重複支付會被拒絕。descriptor僅公開代價張數，不預看或洩漏牌庫ID；AI先付款再取新候選，本機／online共用同一規則及truthful紀錄。091專項123項與受影響24檔／667項、Browser188案、strict2／2、build／lint、AI／ST1核心同步通過；最新完整700檔／11,138項屬091前版本，091～093全套留093批末。

2026-10-04 BS12-089／089@1候選：exact主效果為來源限定`redirect-attack`，代價為棄1紫色且Arena手牌；另以`CardSkill.battleOpponentAttackEffectPrevention.level=3`保存「參與本次戰鬥時封鎖對手LV3攻擊效果」，不併成Blocker發動費用或全域被動。`PendingBattle.attackEffectPreventions`保留真正參戰來源、對手與LV；來源離場仍使用本次戰鬥紀錄，battle結束一起移除。規則層公開`getBattleAttackEffectPrevention`供本機／online UI及紀錄共用，在選目標與支付Then代價之前推進被封鎖的效果。contract evidence及19個runtime語意mutant拒絕漏限制、錯LV、合併／額外代價與額外效果。Browser184／184、專項110項、受影響17檔／682項、strict2／2、build／lint通過；全套留090批末。

2026-10-04 BS12-088／088@1候選：主技能`effects`只包含Blocker的來源限定`redirect-attack`，主`cost`為棄1紫色Arena手牌；新增獨立`CardSkill.faintEffects`（`draw-up-to max2`）與`faintCost`（棄1任意顏色Arena手牌）。一般戰鬥昏厥、效果傷害／直接昏厥與AI能力抽取使用獨立子句；未設定的舊技能保留既有`effects`／`cost`語意。strict evidence同時保存兩組效果與代價，27個實際GameCard語意mutant捕捉漏條件、合併代價、錯色或錯抽牌數量。Browser172／172、專項142項、受影響18檔／394項與另6檔／142項（重疊不相加）、strict2／2、build／lint通過；最新全套691檔／10,795項屬088前的087批末，本批全套留090批末。

2026-10-03 BS12-087候選：PP陷阱對0～1張對手戰鬥區餅乾套用本回合`modify-attack -2`，Then以既有`trash-keyword-count-at-least Arena count10`檢查己方目前棄牌區，再以`previousEffectTargetOnly`對同一目標追加-1。計數包含任意卡種／顏色與先入棄牌的來源陷阱，不計其他區域或對手；選零兩段均no-op，Then不另選目標或收費。公開紀錄依實際modifier判斷門檻成立與追加結果，共用陷阱摘要改為「發動」。雙尺寸68案、最終可見紀錄六案、受影響14檔／514項及最新批末完整Vitest691檔／10,795項（726.24秒）通過；正式BS12／逐卡online未完成。

2026-10-03 BS12-086候選：P1陷阱，以`EffectTargetSelector.blockerOnly`篩選己方戰鬥區印刷Blocker，不檢查發動Blocker所需費用、REST、顏色、LV或Arena。選0～1後`modify-attack +2`採`own-next-turn`，依來源玩家和目前活躍玩家計算到期回合；原對手攻擊不變，自己下回合結束後移除。來源已進棄牌區仍不取消加成；被加成餅乾返回手牌會清除舊modifier，重新登場不繼承。AI己方加成採逐效果目標提交，公開紀錄區分實際加成與選零。雙尺寸54案、受影響18檔／512項、strict1／1、build／lint通過；最新全套留087批末，正式BS12／逐卡online未完成。

2026-10-03 BS12-085候選：新增`trash-blocker-cookie-count-at-least`，只數己方目前棄牌區同時為Cookie且印刷技能是Blocker的卡，不另加顏色／LV／Arena或可支付Blocker代價限制。P1與外部額外棄牌先支付、來源Item進棄牌區後才判斷，少於五張仍可發動但記錄no-op；達門檻以既有`trash-to-deck-all`將全部一般棄牌連來源道具併入原牌庫並使用注入shuffle。公開AI條件共用同一交集，公開紀錄以實際移動結果判斷，不在棄牌區已清空後錯誤宣稱條件不成立。雙尺寸50案、受影響13檔／388項、build／lint／strict1／1通過；最新完整685檔／10,592項屬085修改前，本批全套留087批末。EXTRA來源返回主牌庫分支未驗收，留112及全部印刷後統一確認。

2026-10-03 BS12-084候選：場景沿用`AbilityCost.trashToDeckBottom`，限定己方棄牌區恰好兩張印刷為Blocker技能的Cookie，按`trashToDeckBottomIds`選取順序附加到原牌庫底。共用候選目前隔離EXTRA來源；其返回主牌庫的交互分支不列為已驗收證據，待系列末與其餘裁定統一確認。能量、來源REST與此代價一次驗證後支付，再判斷對手手牌至少六張，由對手自己的pending決策恰好棄一。五張手牌仍可支付完整代價並記錄條件不成立，不抽牌、不洗牌、不補HP。公開命令、重播、AI與本機／online草稿共用此規則；雙尺寸68案與受影響17檔／430項通過，最新批末完整685檔／10,592項、AI／ST1核心同步exit0。

2026-10-03 BS12-082候選：`require-item-activate-discard-hand` 是由對手戰鬥區來源持續讀取的道具額外要求；不作為一次性技能執行，也不加到Trap／Stage／Cookie Activate或攻擊。道具宣告保留原費用，使用 `pendingOpponentHandDiscard.itemActivation` 選擇獨立任意手牌；確認後原子支付額外與原費用，再沿原命令結算，取消則清除宣告。多來源仍待R005裁定，詳見 [BS12進度](bs12-progress-2026-09-30.md)。

## 資料模型

BS12-083 的 `trash-to-battle` 使用 `blockerOnly: true` 篩選印刷為 Blocker 技能的 Cookie，不要求其當下能支付 Blocker 代價；目標為己方棄牌區0～1張，不另加顏色、LV或Arena限制。共用復活路徑維持兩張戰鬥區上限、正常HP配置及既有Refresh續接，重複選取同一張卡會被拒絕。DJ額外棄牌會增加復活候選時，本機及online UI先完成公開道具付款，再從權威棄牌區選目標；一般道具仍保留原選取。082的手牌門檻預覽使用規則層 `isItemEffectConditionSatisfiedAfterAdditionalCost`，計入額外棄牌、道具離手與原代價回手，不在React另算規則。083雙尺寸52案通過，已納入084批末完整685檔／10,592項回歸。

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
- `deck-to-trash`：將指定玩家牌庫頂的卡牌直接放入棄牌區；牌庫耗盡時先建立 Refresh，保留已移動卡及尚未完成的數量後續接。
- `gain-hp`：從牌庫頂增加實體 HP 卡；途中或完成時牌庫耗盡會先進入 Refresh，再繼續尚未補完的 HP
- `prevent-knockout`：本次戰鬥中使指定餅乾 HP 不會降至 0
- `support-to-trash`：將指定數量的支援區卡牌移至棄牌區
- `trash-to-support`：預設選棄牌區餅乾；卡文明定「卡牌」時以 `cookieOnly: false` 允許其他類型，再共用顏色與數量限制。BS8-069 可選 0～1 張綠色卡，包含物品；UI 與引擎都允許選 0，略過登場效果須清除權威 OnPlay。
- `optional-cost-attack`：攻擊傷害後可略過的追加效果；來源餅乾可先提供 `sourceEnergy`，其餘費用才由支援區支付
- `modify-attack-cost`：依持續條件即時調整指定攻擊者的能量費用；BS11-017 的 `source-hp-at-most` 只作用於來源自身，不寫入一次性回合修正
- `target`：目標陣營、最少／最多數量與篩選條件
- `condition`：目前支援 Break Area 最低等級、來源 HP、牌庫／棄牌區／支援區 keyword，以及「本回合己方／對手餅乾曾昏厥」等條件；BS11-009 的「己方 LV.2 以上且剩餘 HP 為 1」以同一張 Cookie 的複合條件表示，避免把不同餅乾的 LV 與 HP 錯誤拼接
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

BS12-012 Sweet Jams Guitar 保留1R費用與`set-cookie-active`的己方／`min:0/max:2`／red／arena交集，strict拒絕缺漏或變更任一目標限制。契約battle selector接受顏色在Arena前與後的官方語序；UI同時呈現兩個條件、兩張上限與選0結果。付款與目標草稿可取消／返回，確認後透過正常道具命令支付、棄牌並結算，見 [BS12進度](bs12-progress-2026-09-30.md)。

BS12-013 Limited Edition Record 以`modify-attack`套用本回合+1，`thenEffects`的`set-cookie-active`保留`previousEffectTargetOnly:true`，兩段均限定己方／0～1／red／arena。沿用規則核心的原目標續接，選0不回退選取來源；strict拒絕缺漏增傷、期間、目標條件或Then連結。公開結算紀錄同時記錄增傷與同目標活躍，零目標分別記錄兩段未執行；UI固定原目標，見 [BS12進度](bs12-progress-2026-09-30.md)。

BS12-014／014@1 以被動`prevent-source-active-phase`表示來源自動活躍的例外；`battle-area-cookie-count`新增可選`excludeSource`，本卡條件為己方／0張其他／Arena，不限制顏色。Active Phase由規則層檢查當下戰鬥區，保持原REST／active狀態；不影響主階段ready或建立新的整回合封鎖。strict要求實際skill內完整被動證據，不接受根層effects鏡像取代。公開階段紀錄指出來源、條件與實際結果，見 [BS12進度](bs12-progress-2026-09-30.md)。

BS12-011 Crown Stage 的 `placementCost: { red: 1 }` 與無費用的 `endPhase: true / endPhaseScope: your-turn` 分開保存；`set-cookie-active` 只選己方戰鬥區的 Arena、`min:0/max:1`，不限色與目前狀態。無Activate按鈕，不在放置時ready；strict會拒絕缺少效果、Arena限制或自己的回合結束時機。UI選0須明示沒有設為活躍，不以「效果 已設為活躍」冒充結算；規則與雙尺寸候選Browser證據見 [BS12進度](bs12-progress-2026-09-30.md)。

2026-09-30 BS12 首批：002 FLIP 的己方 Arena 補 HP 必須保留棄手牌代價與 `min:0/max:1`；選 0 不能使用 pending battle 目標 fallback。004 FLIP 以 exact mapping 保留兩個紅色 Arena 條件，計數 selector 同時核對顏色／關鍵字，不能將條件句靜默丟棄。兩尺寸合法／阻擋與精確結算見 [BS12 進度](bs12-progress-2026-09-30.md)。

BS12-005 的 `source-set-active-by-effect-this-turn` 檢查目前來源登場身分的 ready 事件，不以「目前直立」推測；一般 Active Phase、其他餅乾、前回合與舊登場不能滿足條件。合法啟動可選任意己方餅乾 0～1 張補 HP，選 0 仍消耗 Once Per Turn；沒有額外能量或 REST 代價。

BS12-006 的 1R 與「將1個 Arena 餅乾設為活躍」均為代價；`battleCookiePosition` 由共用候選／支付規則處理，來源自身與非紅色 Arena 可選，非 Arena／已 active 不可選。UI 必須完成能量、狀態代價、可選傷害目標才確認付款。選0仍支付兩項代價並消耗 Once Per Turn；代價 ready 不建立005的效果事件。item／stage 未支援此代價時明確阻擋，009 TRAP 尚未驗收。

BS12-007 保留1R、必要己方同名裝備目標與裝備攻擊的當次戰鬥FLIP封鎖。2026-09-30使用者提供「原HP移入棄牌區、不觸發補位登場」裁定；exact map 以 `battleSourceDisposition: { hp: 'trash', replacement: 'none' }` 保存，結算移除來源戰鬥實體與其HP、保留宿主HP／狀態，裝備只保留007本體，不建立departure補位或原HP的FLIP。未帶設定的其他Cookie Equip仍阻擋、契約needs-review。詳見 [007裁定與驗證](bs12-progress-2026-09-30.md#使用者裁定解除007閘門)；本機候選證據不等同正式牌組／online驗收。

`npm run validate:cards` 除了確認卡牌可轉換，還會驗證 ability 不是空殼、技能標記、可選抽牌與來源橫置語意。對容易發生「已有 payload 但語意不完整」的卡牌，`scripts/lib/card-effect-validation.ts` 維護人工覆核的高風險契約，鎖定效果 kind、代價、條件、目標與複合效果數量。`src/cards/contracts/ledger.ts` 另會對規則層已有明確計數器的條件句（例如本回合 Cookie 昏厥）比對 runtime `EffectCondition`；只要條件證據遺失就落到 `needs-review`，不允許部分 payload 冒充完整支援。契約是回歸防線，不取代官方文字與完整流程測試。

## 已支援效果

下列效果已完整實作，可經由 `CardEffect` union type 描述並由規則引擎執行：

| 效果 | 對應 CardEffect kind | 說明 |
|---|---|---|
| 傷害 | `damage` | 對合法目標造成固定傷害，含勝負與替補判定 |
| 依序全體傷害 | `damage-all`（`sequential: true`） | 發動方依點擊順序選齊所有合法目標；每一個目標的傷害、FLIP、昏厥與中斷流程處理完畢後才繼續下一個。現用於 BS4-005，並非攻擊，不開啟陷阱步驟。 |
| 休息區等級差傷害 | `damage-by-break-level-difference` | 依雙方休息區等級總和差造成動態傷害；可搭配 `break-level-higher-than-opponent` 條件 |
| 攻擊修正 | `modify-attack` | 增加或減少攻擊傷害，回合結束移除 |
| 攻擊費用修正 | `modify-attack-cost` | 依來源卡的持續條件即時增加／減少指定攻擊者的能量費用；例如 BS11-017 只有來源剩餘 HP≤3 時降低自身 1R |
| 全體攻擊修正 | `modify-all-attack` | 增加或減少己方所有餅乾攻擊傷害，回合結束移除 |
| 承受傷害修正 | `modify-damage-received` | 增加或減少承受的攻擊傷害；可在指定門檻達成時固定為特定傷害，回合結束移除 |
| 純抽牌 | `draw` | 從牌庫抽固定 N 張，牌庫耗盡觸發 pending Refresh |
| 可選抽牌 | `draw-up-to` | 玩家選擇抽 0～N 張；選擇大於 0 時沿用逐張抽牌與 Refresh 流程。若卡文後續 `Then` 需要目標，抽牌確認後保留來源／effect index 建立 `pendingAbilityEffect`，由同一效果面板接續選擇；條件不成立則略過該段。 |
| 抽到與對手手牌相同 | `draw-until-hand-equals-opponent` | 僅在己方手牌較少時抽牌，抽到雙方手牌數相同；沿用 Refresh 流程 |
| 場上卡→棄牌區 | `field-to-trash` | 依陣營、等級與剩餘 HP 上限篩選餅乾，文字允許時也可選場景；餅乾屬非昏厥離場，仍會清理修正並建立補位 |
| 對手戰鬥區→棄牌區 | `opponent-battle-to-trash` | 移除符合條件的對手戰鬥區餅乾，屬非昏厥離場；可用 `min: 0` 表示「最多選 1 個」 |
| 對手隨機棄牌 | `opponent-random-discard` | 透過注入式洗牌決定棄置卡，剩餘手牌維持原順序 |
| 牌庫頂→支援區 | `deck-to-support` | 從牌庫頂取 N 張直立放入支援區（例：ST3-010 Aloe Cookie）；牌庫耗盡觸發 pending Refresh（remainingDraws=0）。僅接受等價於「Take N card(s) from the top your deck and place it/them in your support area as active」的文字 |
| 牌庫頂→棄牌區 | `deck-to-trash` | 將己方或對手牌庫頂 N 張卡牌放入棄牌區；耗盡牌庫時由 Refresh 續接，最多 N 張的卡文另提供0–N數量選擇 |
| 休息區→棄牌區 | `break-to-trash` | 從效果來源玩家休息區選最多 N 張 LV.X 卡移至棄牌區；不需選擇目標時玩家可選 0 張確認。移動後以 resolveBasicVictory 檢查勝負。僅接受等價於「Select up to N LV.X card(s) from your break area and place it/them in the trash」的文字，不接受 Then/FLIP/額外子效果 |
| 增加 HP | `gain-hp` | 從牌庫頂補入 HP 卡；牌庫耗盡時建立 pending Refresh，Refresh 後繼續剩餘數量。`target.allMatching` 代表卡文已固定全部符合者，規則層與 UI 必須帶入完整目標集合，不允許只選部分（BS8-003、BS9-038）。 |
| HP 下限保護 | `prevent-knockout` | 目前供 TRAP 使用，本次戰鬥保留至少 1 張 HP 卡。官方裁定（BS3-100 vs ST3-020）：這個保護擋的是「這次戰鬥中 HP 不會變 0」，不是只擋一般傷害——只要 `state.pendingBattle` 還在（戰鬥尚未結束）且目標在 `preventKnockoutTargetIds` 內，任何會讓 HP 卡歸零的移除都要擋下，包括攻擊後續效果的 `hp-to-trash`。`hp-to-trash` 執行器已對此加上檢查：保護生效且剩餘 HP 卡數 ≤ 欲移除數時直接不執行，回傳原狀態；不能算出 `removeCount=0` 後照舊呼叫 `slice(-removeCount)`——JS 的 `slice(-0)` 等同 `slice(0)`，會把整疊 HP 卡誤判成「被移除」，導致同一張卡同時留在 `hpCards` 又被複製進棄牌區 |
| 效果傷害免疫 | `prevent-effect-damage` | 被影響餅乾在持續期間內不受任何效果傷害（技能、攻擊附加效果等），基本攻擊傷害仍正常結算。`damage`、`damage-all`、`split-damage` 執行器會檢查 `effectDamagePreventedUntilTurn`，受保護餅乾直接跳過（BS3-082） |
| 對手傷害防止 | `prevent-opponent-damage` | BS9-018 的 `Your Turn` 持續效果；只在來源玩家屬對手、目標屬自己的 Cookie、Hero 仍在戰鬥區且目前為 Hero 擁有者回合時，將攻擊／效果傷害降為 0。逐段效果傷害在實際結算點重新檢查；自己的傷害、Hero 離場或對手回合不適用。 |
| 對手效果增加 HP 防止 | `prevent-opponent-hp-gain` | BS9-035 的 Activate 效果；支付棄 1 張手牌後，到本回合結束前阻止對手透過卡牌效果把實際卡加入 Cookie HP。涵蓋 `gain-hp`、手牌／支援／其他 HP 的搬入及裝備／FLIP 補 HP，不影響一般登場時配置的印刷 HP，也不阻止來源玩家自己的效果。 |
| 對手 On Play 防止 | `prevent-opponent-on-play` | 本回合禁止對手啟動 Cookie 的 On Play 效果；登場仍可完成，但 pending On Play 只能略過。|
| 禁止 FLIP | `disable-flip` | 被影響玩家本回合不能發動 FLIP 效果 |
| 檢視 HP | `view-hp` | 查看目標餅乾的 HP 卡內容（可選） |
| 重排 HP | `reorder-hp` | 依 selector 選擇至多 1 個己方或對手餅乾，再以完整且不重複的順序重新排列其全部 HP 卡；不可遺漏、複製或混入其他卡（BS6-034、BS9-034） |
| 裝備→HP | `equipped-to-hp` | 選擇指定一方戰鬥區已裝備的卡，從宿主的裝備列移至同一宿主的 HP 最上方；`keyword` 篩選裝備，`faceUp` 保留公開 HP 標記（BS9-043）。 |
| 戰鬥區→支援區 | `battle-to-support` | 將目標餅乾從戰鬥區移至支援區 |
| 棄牌區→戰鬥區 | `trash-to-battle` | 從棄牌區將指定餅乾移至戰鬥區 |
| 支援區→手牌 | `support-to-hand` | 將支援區卡牌移回手牌 |
| 棄牌區→手牌 | `trash-to-hand` | 從來源玩家棄牌區選擇至多指定數量回手；可同時限制顏色、Cookie 與 runtime FLIP，所有篩選都由規則層與 UI 共用。可作為 Trap 的 `Then` 或 Stage Activate 的後續選擇，前段未呈現卡牌目標時不得以空目標陣列略過它（BS9-037、BS9-044、BS9-046、BS9-047）。 |
| 對手手牌→棄牌區 | `opponent-discard-hand` | 對手必須選擇指定數量的手牌放入棄牌區；對手無手牌時效果直接完成 |
| 整手牌→棄牌區 | `discard-hand-all` | 將來源玩家全部手牌放入棄牌區 |
| 支援區→棄牌區 | `support-to-trash` | 指定數量的支援區卡牌移至棄牌區 |
| 目標選擇 | `target` | 目標陣營、最少／最多數量與篩選條件 |
| 條件 | `condition` | 依遊戲狀態檢查效果是否可結算；不成立時略過該效果 |
| 同一張 Cookie 的等級與剩餘 HP | `battle-area-has-cookie-with-level-and-remaining-hp` | 要求同一張戰鬥區餅乾同時達到最低 LV（可選 `maxLevel`）與指定剩餘 HP；BS11-009 使用，規則層與 AI 公開視圖共用；BS11-013 的陷阱條件使用 LV.3 精確上限。 |
| 本回合餅乾曾昏厥 | `cookies-fainted-this-turn-at-least` | 以 `GameState.cookiesFaintedThisTurn` 檢查指定陣營本回合昏厥張數；例如 BS8-010 沒有己方昏厥紀錄時，Activate 不可發動 |
| 對手戰鬥區無 Blocker | `opponent-battle-area-has-no-blocker` | BS3-018 第二分支的條件；可選取該分支，但條件不成立時不造成傷害 |
| 支援區 keyword 條件 | `support-keyword-at-least` | 檢查來源玩家支援區是否至少有指定數量的 keyword 卡，例如 `[Soul Jam]` |
| 持續時間 | `duration` | 本回合、對手下回合或永久 |
| HP 送棄牌區 | `hp-to-trash` | 選擇己方 1 隻餅乾，將指定數量的 HP 卡送入棄牌區；非傷害不觸發 FLIP/afterDamage，HP 歸 0 時餅乾進入休息區並沿用離場/補位/勝負流程 |
| HP 交換 | `cycle-hp` | 取回目標餅乾最上方 1 張 HP，並可將 1 張手牌放回；取走最後 HP 時餅乾立即進入休息區，後續放回步驟不再執行（BS4-030） |
| 手牌→HP | `hand-to-hp` | 預設將手牌面朝下放到 HP 頂端（BS4-044），不會先移除既有 HP。BS9-010 以匿名位置選擇對手 0～1 張手牌，選定後正面朝上放到來源 HP 最下方；支援 `hpPlacement`／`faceUp` |
| 支援區→HP | `support-to-hp` | 可同時選擇支援卡與目標餅乾，將符合顏色的支援卡放到 HP 頂端（BS4-066） |
| 休息支援並造成傷害 | `rest-support-and-damage` | 最多選指定數量、符合顏色且目前活躍的支援卡改為疲勞，再依本次新增疲勞張數對最多 1 個目標造成傷害（BS4-062） |
| 可選攻擊後續費用 | `optional-cost-attack` | 玩家可略過；來源餅乾先提供 `sourceEnergy` 中列出的指定能量，只有剩餘費用由支援區支付。目標步驟依子效果的對象與 `min` 呈現，支援己方／對手與「最多選 1 個」 |
| HP 卡搬移 | `transfer-hp` | 取供牌餅乾最上方 HP；`direction: 'to-source'` 由目標供牌（BS3-031），`'from-source'` 由來源供牌（BS3-089）。預設面朝下放至接收者最上方；BS9-010 指定對手目標、正面朝上與最下方。跨玩家取得的 HP 由 `foreignHpCardInstanceIds` 記錄；供牌方 HP 歸 0 時照常昏厥並沿用離場／補位／勝負流程 |
| 餅乾設為活躍 | `set-cookie-active` | 解除選定餅乾的休息狀態；與只處理支援區的 `set-active` 不同。可用 `restedOnly` 目標篩選只列出休息中的餅乾（BS3-053） |
| 依戰鬥區餅乾數抽牌 | `draw-up-to-battle-cookie-count` | 依雙方戰鬥區指定等級的餅乾數量計算抽牌上限，再沿用 `draw-up-to` 的可選抽牌流程；上限為 0 時直接略過（BS3-092） |
| 棄牌區全部→牌庫 | `trash-to-deck-all` | 不需選擇，將棄牌區整批洗回牌庫。後續的「Then」必須放在 `thenEffects` 內嵌執行——本效果會清空棄牌區，同層的下一個效果若重掛同一個棄牌區條件，重新判定時必定失敗而被跳過（BS3-113） |
| 場上卡→牌庫底 | `field-to-deck-bottom` | 將選定餅乾或允許的場景卡放到持有者牌庫底；餅乾的 HP／裝備卡進入持有者棄牌區，可用 `battleSide` 表達「對手餅乾或任一方場景」（BS4-075） |
| 雙方餅乾→各自牌庫底 | `field-to-deck-bottom-all` | 將雙方符合等級的戰鬥區餅乾放到各自牌庫底，HP／裝備卡進入各自棄牌區（BS4-111） |
| 揭示牌庫底 | `reveal-bottom-deck` | BS3-073 可選揭示並依 Cookie／其他類型移動，空牌庫略過；BS12-064 必須展示一張，同卡 LV2／Arena／Cookie 條件成立才回手並接續抽牌，不符保留牌庫底 |
| 揭示牌庫頂 | `reveal-top-deck` | peek 牌庫頂 1 張（不移除），檢查 `match` 條件；匹配時執行 `effects` 內嵌效果，不匹配時直接略過。卡始終留在牌庫頂，等價於官方文字的「抽 1 張展示，執行完放回牌庫頂」（BS3-090、BS3-093） |
| 手牌→戰鬥區 | `hand-to-battle` | 從手牌選餅乾登場，HP 卡照常自牌庫頂補入；`energyCost` 需先由活躍支援卡支付；`gainHp` 對應「Then, that Cookie gains +N HP」。登場後照常觸發 OnPlay 與牌庫耗盡的 Refresh 判定（BS3-029） |
| 對手棄牌區→對手休息區 | `opponent-trash-to-break` | 從對手棄牌區選餅乾放進**對手**休息區；會推進對手 break 等級，因此走與其他休息區移動相同的勝負判定（BS3-028） |
| 對手休息區→棄牌區→休息區 | `opponent-break-to-trash-then-battle-to-break` | 先強制將對手休息區 1 張餅乾放進棄牌區，記錄該卡 LV；再可選擇對手戰鬥區中剛好高 1 LV 的餅乾放進對手休息區。第二段允許略過，且仍受「對手效果不能移動戰鬥區餅乾」保護（BS6-039） |
| 牌庫檢視 | `inspect-deck` | 查看牌庫頂 N 張。`restDestination` 決定未選走的卡去 `bottom`／`top`／`trash`（前兩者由玩家排序）；`top-or-bottom` 會先顯示檢視卡，再由玩家決定放回牌庫頂或牌庫底。`pickDestination` 決定選走的卡加入手牌或直接登場，`filterColor`／`filterType`／`filterKeyword`／`optionalPick` 控制可選範圍；`revealPicked` 僅在卡文要求時公開展示選入的牌，不公開尚未確認的檢視內容（BS1/BS2 既有卡、BS3-095、BS3-083、BS3-114、BS10-088、BS12-103） |

| 選擇一項 | `choose-one` | 官方文字的「Select 1 of the following.」（BS3-068、BS9-036）。這個效果本身永遠不會被執行——玩家或 AI 選定模式後由 `expandChooseOne` 就地換成該模式的效果，`effectIndex` 不動，之後每個子效果照常各自走代價／目標流程。每個模式先由規則層判定是否可支付，不可支付者在本機與線上 UI 均停用且指令層拒絕；若只剩一個可支付模式，玩家仍須明確確認。`resolve-choose-one`／`begin-*` 的 `chooseOneModes` 與 AI 共用同一份展開邏輯。 |
| 休息區→戰鬥區（來源自己） | `break-source-to-battle` | 讓技能來源自己從休息區登場，HP 卡數固定為 `hpCount`（不是卡面 HP），照常觸發 OnPlay 與牌庫耗盡的 Refresh 判定；戰鬥區已滿（2 隻）時執行器直接丟錯，`canActivateCookieSkill` 會提前擋下（BS3-025） |
| FLIP→休息區 | `flip-to-break` | FLIP 卡翻開並滿足條件時放入持有者休息區，而非棄牌區（BS4-031） |

代價方面，`AbilityCost.trashToDeckBottom` 表示「從棄牌區選 N 張卡放到牌庫底」（BS3-112），選取順序即為放入牌庫底的順序。目前只有餅乾技能路徑（`activate-skill`／`begin-activate-skill`）實作，item／stage 的 `payAbilityCost` 會直接丟錯，避免被靜默忽略。`AbilityCost.trashBattleCookie.faint` 表示「使選定的戰鬥區 Cookie 昏厥」而非直接送入棄牌區；Cookie 技能與 item／stage 共用完整 GameState 的昏厥、休息區、HP 棄牌、昏厥觸發、補位與勝負流程（BS8-022、BS11-018）。`AbilityCost.handToBreakArea` 表示「將手牌餅乾放入自己休息區」，與棄到棄牌區的 `discardHand` 不同。餅乾技能、陷阱及道具付款會推進自己的 break 等級並立即檢查勝負；道具與技能共用候選與支付驗證，新增可選 `keyword` 限制（BS12-028 的 Arena），未指定時保留既有顏色／LV 語意。來源道具不能當餅乾代價，重複、少選、超選或與棄手牌代價重疊均拒絕。

`CardSkill.oncePerGame` 搭配 `GameState.skillUsesThisGame` 表示整局只能發動一次。官方 Q&A 明確釋疑：這個限制是**每位玩家**限定一次，即使同一玩家休息區同時有多張同名卡（例如兩張 BS3-025），也只共用這一次額度——因此 key 是 `playerId:card.id`（同名卡共用、跨玩家互不影響），不是 `card.instanceId`（每張實體卡各自不同，會讓同玩家的第二張複本被誤判成尚未使用）。`getOncePerGameKey`（`skills.ts`）是唯一組 key 的入口。BS3-025 的另一條 Q&A 釋疑——戰鬥區與手牌都沒有餅乾時必須從手牌執行「再登場」，不能用休息區的這個技能頂替——由既有的 `pendingReplacement` 一律擋下 `activate` 觸發自然滿足，不需要額外邏輯。`CardSkill.fromBreakArea` 表示技能來源允許在休息區而非戰鬥區發動。這兩個標記靠明確的文字比對設定，不是靠 `{mob}`／`{ap}` 標記推斷——BS3-025 的原文只有 `{mt}`，一般解析會誤判成 `passive`，需要在 `exactCookieSkillTriggers` 明確覆寫成 `activate`。`findSkillSource`（`skills.ts`）是唯一的來源查找入口：先查戰鬥區，找不到才查休息區（且只在該卡技能有 `fromBreakArea` 時才算數），`canActivateCookieSkill`／`activateCookieSkill`／`commands.ts` 的 `activate-skill`／`begin-activate-skill`、`App.tsx`／`OnlineBattleView.tsx` 的點擊處理都必須走這個函式，任何一處各自查 `battleArea` 都會讓休息區技能失效。AI 主動發動技能的三個決策迴圈（`turn-handler.ts`、`evaluated-turn-handler.ts` 兩處）改用 `getActivatableSkillSources` 取得候選來源，把符合 `fromBreakArea` 的休息區餅乾一併收進來，否則 AI 永遠不會用到這類技能。

`TrapCondition.friendly-color-fainted-this-battle` 新增可選的 `minLevel`：未指定時沿用舊行為（本次戰鬥有沒有該顏色餅乾昏厥，不分擁有者與等級），指定時改用 `PendingBattle.faintedCookies`（含擁有者與等級的完整紀錄，`faintedColors` 只留顏色不夠用）判定「己方指定顏色且等級達標的餅乾昏厥」（BS3-046 的「your {Y} LV.2 or higher」）。延遲觸發成立、且效果需要玩家選卡時，`finishBattle` 不會直接執行，而是把效果轉存進 `pendingAbilityEffect`（`sourceKind: 'trap'`）交給既有的逐步結算流程；本機 UI 原本沒有「規則層主動建佇列、UI 被動接手」這種方向的處理，新增了一個 `useEffect` 專門偵測 `sourceKind === 'trap'` 的 `pendingAbilityEffect` 並補建本機的 `pendingEffect`（透過 `window.setTimeout(...,0)` 延後呼叫，避免在 effect body 內同步 `setState`）。

跨玩家戰鬥區目標由 `EffectTargetSelector.side: 'either'` 表示（官方文字的「either player's battle area」）。這種選擇沒有單一擁有者，`getTargetPlayerId` 會直接丟出錯誤，效果必須改用 `getCookieOwnerId` 逐一判定並依擁有者分組結算離場；`battle-to-break`（BS3-040）、`battle-to-deck-top`（BS3-076）與 `field-to-deck-bottom`（BS4-075）均已處理，後者另以 `battleSide` 限制餅乾目標而保留任一方場景選項。

無目標效果的判斷統一由 `isEffectUntargeted` 共用（目前涵蓋 `draw`、`deck-to-support`、`modify-all-attack`、`trash-to-battle`、`support-to-hand`、`opponent-discard-hand`、`draw-up-to-battle-cookie-count`、`trash-to-deck-all` 與 `reveal-bottom-deck`）。

### 已實作：攻擊後續效果

- `CookieCard.attackEffects` 保存攻擊傷害文字後的效果序列，戰鬥以 `attack-effect` 待決階段在傷害完成後、替補前結算。
- ST2-003 Wizard Cookie 已支援「造成 3 點傷害，之後可選最多 1 張己方 LV.1 休息區卡牌移至棄牌區」。
- BS3-002、BS3-010、BS3-011 已支援「can be used as」來源能量，分別以來源餅乾支付 {R}、{R}、{R}{R} 的可選攻擊後續費用。
- BS3-009、BS3-087、BS3-111 已支援「支援區有 `[Soul Jam]`」的攻擊後條件；僅檢查支援區現存卡的 keyword，`{mou}` 附著本身仍待專屬狀態模型。
- BS3-018 的第二個選項已保留「選擇最多 1 個對手餅乾造成 1 點傷害」的 `min: 0` 語意，並在結算時檢查對手戰鬥區不得有 `[Blocker]`；條件不成立時費用仍照常支付，但傷害效果略過。
- 另一種「{mou} this card to your [指定 Cookie 名稱]」是把道具卡直接附著到特定 Cookie（不進支援區），走 `equip-source` 效果，附著後放進 `CookieInBattle.equippedCards`（見 `docs/game-rules.md` 或 `equip-source` 執行器）。已依官方 Q&A 逐張核對 BS3-019／043／066／091／115 五張「靈魂果醬」的裝載後效果，全數已正確：BS3-019 是持續攻擊加成（`attackBonus`，寫入 `attackModifiers`）；BS3-043 是裝載當下的一次性 +2 HP（只有 `gainHp`，不建立任何持續修正，官方 Q&A 已確認）；BS3-066／091 是「該餅乾攻擊時」的自動觸發效果，由 `battle.ts` 的 `getEquipAttackEffects` 依裝備卡 id 查表，`beginAttack` 建立 `pendingBattle.attackEffects` 時附加在來源餅乾自身攻擊後效果之後；BS3-115 是「不能被對手效果選為目標／不能被送入棄牌區」的保護，集中於 `isBlockedByOpponentEffectProtection`：`matchesSelector` 排除對手選擇候選；`damage-all`／`field-to-trash`／`field-to-trash-all`／`opponent-battle-to-trash`／`modify-all-attack` 執行器同樣略過受保護餅乾。例外：`attackTargetOnly` 攻擊附加傷害保持同一攻擊對象時不算重新選擇，仍可造成傷害。官方 Q&A（BS3-019）：需要指定目標的效果若當場沒有合法候選，能力效果鏈（含後續 Then 裝載）整段中止，但費用與棄牌不回溯；若有合法目標卻自願選 0（`min: 0`），Then 仍可繼續。
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
- 卡面明確允許整組昏厥技能選擇時，`CardSkill.faintOptional` 會讓玩家先決定發動或不發動；選擇不發動會移除同一次觸發佇列的所有效果。BS3-061「Silverbell Cookie」選擇發動後，先支付「支援區 1 張送棄牌區」代價，再以支付後的支援區張數重新判定後續全場傷害條件。

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


### BS12-008 支援交集條件與自身棄牌

Shining Dash（含008@1）以`support-count-at-least`保存count4／energyColor red／keyword arena；三項同時成立且支援不分活躍／休息。`AbilityCost.selfToTrash`於效果前將來源、HP、裝備與Awaken底卡棄置，`set-cookie-active`選己方0～1張剩餘餅乾，不限制色別或Arena。設為活躍屬效果事件，可滿足BS12-005；支付008來源棄牌後，補位等待整組效果完成。007裝備的「不補位」裁定不套用此技能。詳見[008局部驗收](bs12-progress-2026-09-30.md#bs12-0080081-活躍效果與自身棄牌代價)。

### BS12-009 陷阱橫置代價

Clumsy Day支付1R及`battleCookiePosition: { count: 2, position: 'rested', keyword: 'arena' }`，必須選兩張己方仍活躍的Arena餅乾，不限定顏色；007裝備不屬戰鬥餅乾候選。共用陷阱規則先驗證所有能量／代價／目標，再不可變地支付；local與online共用modal依序呈現能量、代價、目標。`positionCostTargetIds`保留實際代價實體，AI與入站協定亦支援此欄位。效果選對手0～1張餅乾，本回合攻擊傷害-3；選0仍支付全部代價，選其他餅乾不降低正在進行的攻擊。

### BS12-010 可選Then與同目標減傷

A Moment of Misunderstanding以exact map保留前段1R／對手0～1張本回合-1，後接`optional-cost-attack`（`resolution: 'ability'`）。兩張Arena餅乾橫置代價放在wrapper的`cost.battleCookiePosition`，不列為前段宣告必付；支付後依序執行`draw-up-to: max1`與`modify-attack: -1`，後者`previousEffectTargetOnly`沿用前段選定實體。`playTrap`保存前段目標，抽牌／Refresh保留，UI以固定候選呈現且禁止重選。前段選0或原目標離場時追加減傷為公開no-op；Then抽牌仍可獨立結算，抽0也不取消追加減傷。可選代價共用規則、AI、local／online UI與協定接受`positionCostTargetIds`；公開trace記錄實際橫置餅乾與同目標追加結果。

### BS12-015 原攻擊目標追加傷害

015／015@1沿用014的`prevent-source-active-phase`被動；攻擊Then以exact map建立`damage: 1`、`attackTargetOnly`及`battle-area-has-keyword: self/arena/excludeSource`。此目標依2026-10-01使用者裁定。共用攻擊後流程於普通傷害結束及Then結算檢查條件／原目標，缺其他Arena或原目標已離場則公開no-op，不改選、不退費。strict另外核對1傷害／原對手／必選1／另一張己方Arena完整runtime證據。固定攻擊目標的共用UI描述明記同一原目標且不能改選；其餘一般傷害仍顯示正常選擇提示。

### BS12-016 免費活躍與可選橫置來源

BS12-016／016@1使用ordered `set-cookie-active`（己方0～1／Arena／excludeSource）與`rest-cookie`（己方0～1／sourceOnly）兩段技能，Activate無能量或REST代價、每回合一次。第二段選0表示略過REST，不退回前段ready或次數；來源原本REST亦可使用免費技能。攻擊Then為`damage:2`、`attackTargetOnly`與`source-set-active-by-effect-this-turn`，目標依使用者2026-10-01裁定，沿用現有登場身分事件及傷害流程。strict要求完整時機、零代價、順序與兩段selector，不能以來源REST代價或無條件傷害取代。

### BS12-017 棄手牌活躍與指定卡名條件

017／017@1將`discardHand:1`留在Activate的`AbilityCost`，效果為己方0～1／Arena／excludeSource的`set-cookie-active`，無能量或REST代價。攻擊Then使用`damage:1`、對手0～1正常selector與`battle-area-has-named-cookie: self/Apple Faerie Cookie`，不帶`attackTargetOnly`。strict另外核對代價／時機／完整selector／同名條件，移除棄手牌、固定原目標或換到對手場條件均不可verified。共用不可發動原因重用規則的棄手牌候選篩選，提示需要張數與符合條件手牌不足，不讓React另外推導付款規則。

## BS12-018 EXTRA 與後攻攻擊 Then

018／018@1：休息區 LV 合計至少4時，從 EXTRA Deck 宣告登場並強制棄1張 Arena 手牌；顏色／卡片種類不限，仍需戰鬥區空位。場上 Activate Once Per Turn 免費，0～1另一張己方紅色 Arena Cookie 活躍，選0仍使用一次；EXTRA棄牌不再套到 Activate。RRRR 普通4後，開局後攻玩家才可選0～1對手追加1效果傷害，可以改選另一對手；先攻條件不成立。


## BS12-020 條件式 FLIP 補HP

精確FLIP保留`discardHand:1`與零能量，`gain-hp:1`使用己方0～2個不限顏色／Arena的Cookie；條件為己方休息區至少4張Arena Cookie，非LV合計。依完整規則v1.8 §8-3-1-1先檢查發動條件，不成立時不支付手牌、揭示卡正常棄置。選0仍支付；補牌依玩家目標順序從牌庫頂各配置1HP。最後HP揭示仍先處理FLIP再判昏厥，共用傷害續接不新增特殊規則。strict檢查此代價／條件／selector，不得漏Arena張數或誤限Arena補牌目標。

## BS12-021 本回合休息區事件與來源補HP

021／021@1精確技能為免費Your Turn On Play、`gain-hp:1`／`sourceOnly`與`arena-cookie-placed-in-break-this-turn`。一般登場先配置印刷2HP；本回合己方有Arena Cookie實際進休息區事件，才可另發動補1HP。共用事件帳本按實體移入紀錄，涵蓋效果／昏厥／手牌代價／Refresh，進入後離開仍保留，下一活躍階段清空；現有休息區張數不是事件證據。條件不成立時禁止宣告，略過保留正常登場HP。UI來源固定，不提供選另一餅乾入口；公開結果僅列卡名與增加張數，不揭露暗HP內容。

## BS12-022／023 補HP

022精確FLIP：零能量、棄1任意手牌、己方戰鬥區0～1張Arena Cookie補1HP；顏色與活躍狀態不限，選0仍棄牌，缺手牌不可發動。最後HP揭示先處理FLIP再判昏厥，剩餘傷害繼續結算。

023免費On Play只替來源補HP，`perBreakCard: { keyword: 'arena', divisor: 3 }`依己方當下休息區Arena Cookie張數完整分組，補`floor(count / 3)`張。一般登場先配置印刷4HP，略過保留4HP；對手回合也可發動，0～2張時可合法發動但不補HP。LV總和、對手牌區、棄牌與歷史事件不計。`divisor`必須是正整數，省略時為1，保留既有BS6-036等逐張計算；Refresh續接使用既定剩餘補HP量，不重算組數。黃色MIX維持黃色能量，MIX不是執行期技能keyword。

## BS12-024／025 普通攻擊與同名補HP

024沿用一般Cookie轉接：LV1、印刷HP2、黃色MIX仍提供黃色能量；N1普通攻擊造成1傷害，沒有技能、FLIP或Then。

025正常登場配置印刷1HP；精確免費On Play為`gain-hp:1`、己方戰鬥區`min:0 / max:1 / cardName:'Caramel Choux Cookie'`，不增加顏色、Arena、活躍狀態或Your Turn限制。可選0／略過，不能選來源Mayor、其他名稱、對手或支援區卡；補牌來自己方牌庫頂。Y1普通攻擊造成1傷害，與免費技能分開。契約解析保留具名戰鬥區selector的名稱、所屬玩家及上下限；公開命令紀錄列實際HP增量，不揭露暗HP身分。

### BS12-026：先棄手牌、OR 條件與固定原攻擊目標

026正常登場配置印刷5HP，YYY普通攻擊3後可選Then。`optional-cost-attack`的零能量／`discardHand:1`及`payBeforeCondition:true`先支付，再檢查己方休息區至少4張Arena Cookie或本回合Arena進己方休息區事件，成立才追加1傷害。張數不看LV、顏色不限；條件不成立仍可自願付代價，零手牌只能略過。目標依2026-10-01使用者裁定固定原受攻擊對手，原目標昏厥不轉移，仍可付代價但不追加傷害。

必選1個原對手的damage由`isFixedAttackTargetDamage`辨識，規則、付款提示與DecisionDescriptor均不要求再次選目標；其他可選對手Then仍保留選取流程。重複手牌ID與非法改選目標由規則拒絕。離線／線上是否建立付款決策共用`hasApplicableOptionalAttackEffect`，不能在尚待付款時提前宣告略過。公開紀錄明列代價、原目標及實際傷害／條件不成立／原目標離場原因。

### BS12-027：黃色 Arena 休息區交集減費

Designers' Yapping 基礎發動費用 Y1；`conditionalCost` 只在己方目前休息區至少四張同時黃色且 Arena 的 Cookie 時改為零。`TrapCondition` 的休息區張數條件支援 `color`／`keyword` 交集篩選，省略篩選時保留既有全部 Cookie 計數。張數不看 LV，其他顏色 Arena、黃色非 Arena、其他牌區與歷史進入事件不符合。

沿用對手攻擊宣告時直接從手牌發動的陷阱流程。可選零至一張任何對手戰鬥區 Cookie，本回合普通攻擊傷害 -1；可以選另一張對手 Cookie，當前攻擊者未被選中時仍造成原傷害。選零仍支付實際費用並棄置陷阱，沒有減傷。免費時 UI 直接進入目標步驟，需要 Y1 時由正常支援付款選擇；確認前取消／返回不修改遊戲狀態。效果沿用回合結束清理。

### BS12-028：手牌 Arena Cookie 代價與可選抽牌

Luxury Red Carpet 的 exact item cost 為 Y1＋`handToBreakArea: { count: 1, keyword: 'arena' }`，效果僅 `draw-up-to`／max3。共用 selector 保留 Cookie 身分、來源排除、顏色／LV／keyword 條件；道具命令、AI、offline／online cost draft 與 descriptor 都傳遞選定手牌實體 ID，確認前不付款。`playItem` 在費用及道具棄牌後檢查休息區勝負，Arena 進休息區事件由規則層記錄。

strict guard 驗證 Y1、恰一張任意顏色／LV Arena 手牌餅乾代價及最多抽三，漏掉代價、誤加黄色限制、免費或改成強制抽三均不能 verified。抽牌 Modal 使用 pending effect 的規則上限，短牌庫不截斷選項；超過現有牌庫的選項提示 Refresh，由既有流程完成續抽。

### BS12-029：陷阱雙效果與條件抽牌

Shining Entrance 的 exact trap 為固定 YY、對手戰鬥區 `min:0 / max:1` 本回合 `modify-attack:-2`，再執行 `draw-up-to:max1`。後段獨立條件為 `break-area-card-count-at-least`、self／count4／yellow／arena 交集；前段選零仍檢查，不能沿用027減費或將抽牌條件套在整張陷阱上。

原泛用轉接只保留減傷，卻被舊靜態盤點標成 converted／verified；獨立卡面失敗回歸捕捉漏 Then。新增 strict guard 檢查費用、兩段順序、目標與完整交集條件，十一種漏段／錯費用／錯條件／錯上限 mutant 均不得 verified。沿用既有 pending effect、抽牌與 Refresh 續接，不另建規則或 UI 權威判定。

### BS12-030：場景費用與條件補 HP

Well-Lit Workshop 的 exact Stage 為 `placementCost:{yellow:1}`、啟動 `cost.energy:{yellow:1}`、`restSource:true`，效果 `gain-hp:1`、己方戰鬥區 `min:0 / max:1`，條件為 `arena-cookie-placed-in-break-this-turn`。來源場景具 `allowInactiveConditionalEffects:true`，沿用費用先支付、條件不成立時 no-op 的場景命令；不加 Once per turn、對手可使用或回合結束時觸發。

strict guard 與十五種 mutant 檢查放置／啟動費用、橫置來源、事件條件與任意己方目標。公開場景紀錄只在費用結算後所有條件效果仍不成立時列「場景效果結果：條件不成立，效果未執行」；正常補 HP 紀錄採實際增量並保護暗 HP 身分。離線／線上付款草稿的目標候選沿用規則層條件判定，無效條件不標成可選效果目標。

### BS12-031：直接移入休息區代價與兩段可選效果

Fashionista Spotlight 的 exact item 為 YY＋`trashBattleCookie:{count:1, toBreakArea:true, energyColor:'yellow', keyword:'arena'}`；沿用戰鬥區代價選取及既有命令欄位，以明確目的地旗標區分直接移入休息區、昏厥與棄置。共用候選函式驗證顏色與 Arena 交集，費用可支付性亦使用該函式；HP／裝備棄置、離場與 Arena 事件由規則層記錄。既有不帶旗標的代價維持原語意。

效果依序為 `draw-up-to:max1`、`damage:1` 對手 `min:0 / max:1`，兩段獨立可選，不限定原攻擊目標或 Arena。strict guard 及十六種 mutant 檢查完整代價、兩段順序與目標；漏移動代價、錯顏色／keyword、改成昏厥、免費、強制抽牌或錯傷害對象皆不得 verified。來源拼字修正只套用卡號、原錯名及官方圖片 URL 三者符合的正規化，不改候選原始 JSON。

### BS12-032／032@1：休息區移入待命來源

exact 技能使用 `break-by-arena-effect`、Your Turn、`gain-hp:1` 與己方 `min:0/max:1`，沿用來源效果佇列及既有 `resolve-after-damage-effect` 命令，增加明確 triggerReason；公開提示與紀錄顯示休息區移入及實際 HP 增量。直接移入的規則測試包含手牌／棄牌區／戰鬥區、離場來源、略過、非法目標、等待原效果鏈及私有區域取消。

待命效果來源離開休息區後，離線及線上 controller 共用 `getAfterDamageEffectSourceCard` 查找公開區域（包括棄牌區、支援、裝備、Awaken底牌及正面朝上HP）；不查手牌、牌庫、EXTRA Deck或暗HP。來源仍在公開棄牌區時保持選擇視窗，移入私有區域則取消待命效果。補HP後牌庫耗盡沿用正常 `refresh-deck` 命令，不另建Refresh流程。這些共用機制與預置待命選擇UI的驗證，不能代替實際Arena卡牌的觸發來源驗收。

032@1 的英文 skillText 正確，attackText 與內嵌中文卻混入 Espresso；僅以卡號、名稱及官方圖片 URL 三者符合的正規化修正普通攻擊，原始候選 JSON 不改。strict verified 只證明靜態形狀，不等於技能完整驗收。2026-10-01 使用者確認 Arena 直接移入休息區的代價會觸發補 HP：依實際 Arena 來源、明確代價選牌與新增休息區實體收集，原效果鏈、抽牌及 Refresh 完成後才啟動；休息區 LV10 結束對局時不另排補 HP。BS12-031 戰鬥區代價與 BS12-028 手牌代價已有實際候選 Browser 證據。2026-10-02修復BS7-033：把「另一張己方Arena進休息區」轉為 `trashBattleCookie` 代價（count1、keyword arena、excludeSource、toBreakArea），效果只剩對手0～1受2傷害，代價紀錄也改為休息區。它可作為實際On Play代價來源，不能稱為直接移動效果。2026-10-02使用者確認Arena效果傷害造成昏厥與效果直接使其昏厥也觸發。立即效果依實際新進休息區收集；逐張HP／FLIP傷害保留Arena來源到全部目標結算完，再啟動待命補HP，LV10終局不排後續。HP／昏厥代價是否歸因於Arena集中記錄，待全系列處理後統一提報。

### BS12-033／033@1：休息區移入待命抽牌

以免費Your Turn／break-by-arena-effect及draw-up-to max1表示。沒有戰鬥區Cookie目標；公開命令先開抽牌選擇，再由resolve-draw-up-to結算0／1張。原效果仍未結束時不可搶先啟動。抽牌來源查找包含休息區，保留來源卡號、異圖及完整技能文案；公開紀錄不再沿用補HP結果文字。@1 API錯放034攻擊，只在卡號／名稱／官方imageUrl一致的正規化邊界改為印刷Bean Scatter YN／1，原始候選保留。

### BS12-034／034@1：手牌或戰鬥區Arena Cookie代價

被動modify-attack persistent1只作用來源，條件為己方目前休息區至少四張Arena Cookie。攻擊Then以optional-cost-attack及cookieToBreakArea count1、zones hand／battle、keyword arena表示；支付後gain-hp2，己方min0／max1及minLevel=maxLevel=1。選0HP仍支付，來源可支付；付款純函式先投影移動後戰鬥區，再驗證HP目標，避免代價卡同時作目標。UI、AI及DecisionDescriptor共用合法候選，線上命令附cookieToBreakAreaIds，公開紀錄列實際移動卡牌。非擁有者Descriptor遮蔽手牌代價實體，不遮蔽公開戰鬥區候選。@1錯放035攻擊以卡號／名稱／官方URL三重guard修正為YY／Excellent Explosion／2及完整Then，原始候選JSON保留。

### BS12-035／035@1：已確認On Play，Then待裁定

On Play／Your Turn，cost為yellow1及handToBreakArea count1 keyword arena，支付後對手min0／max1 damage2。正常登場配置2HP另計；033手牌代價的待命抽牌等原傷害完成才結算。普通Y1／1，Then未明示傷害對象列R002；attackEffects不猜測，strict needs-review。異圖attackText在三重guard下修正，原始JSON保留。

### BS12-036／036@1：已確認EXTRA與後攻On Play，Then待裁定

EXTRA enter-battle，playRequirement為己方break-area-card-count-at-least count4、color yellow與keyword arena交集。沒有能量／手牌登場代價，先配置印刷4HP；免費On Play以player-started-second條件及sourceOnly gain-hp2表示，可完整略過。普通YYY／3。Then的登場來源區域未在英文印刷明示，列R003，不以中文API推定；attackEffects暫不轉接，strict needs-review亦保留cost evidence missing。@1攻擊錯置以三重guard修正。

### BS12-037／037@1：每四張Arena傷害與追加N1

damage-by-break-count新增可選groupSize4，結果為floor(己方符合keyword arena的休息區張數／4)×perCount1。缺省groupSize1維持既有逐張傷害，分組必須正整數。Activate、Y1、Once Per turn、REST来源不要求；opponent min0／max1。普通YYY3後optional-cost-attack cost.energy.neutral1，再獨立opponent min0／max1 damage1，不設attackTargetOnly。strict形狀guard檢查分組、區域計數及兩段付款／目標。@1錯置038攻擊以三重guard修正，原始JSON保留。

### BS12-038／038@1：從支援區登場與疲勞支援

免費on-play帶fromSupportArea；deck-to-support amount1／restedtrue、support-count-less-than-opponent difference1。登場後比較支援張數，不使用進場前數量；整個免費登場效果略過表示選0，確認表示放1。基本版誤置039攻擊以卡號／名稱／URL三重guard修正為GN2，原始候選JSON保留。UI描述明示疲勞；beginCookieSkill與On Play監看器在pendingRefresh時等待，避免把暫時不可發動誤判成永久略過。


### BS12-039～041：普通攻擊及回手後放支援

039與041依印刷正規化NNN4與N1，沒有技能／Then。040以exact CookieSkillCost的supportToHand1／supportToHandType cookie支付，免費Activate Once Per Turn；hand-to-support amount1／keyword arena／optional／rested true，沒有卡種或顏色限制。候選以實際回手後的手牌計算，回手的Arena Cookie可以立即放回。規則引擎拒絕重複ID，原始官方JSON保留；卡號／名稱／原圖URL三重guard限制攻擊錯置修正。


### BS12-042／043：補HP與支援疲勞FLIP

042 exact FLIP以discardHand1支付，gain-hp amount1／self min0 max1／keyword Arena；普通G1。043 exact FLIP免費，rest-support side opponent／amount1／optional true，condition support-count-at-least count5／energyColor green／keyword Arena；普通GGG3。043的非戰鬥區FLIP選牌透過既有effectTargetIds傳遞，targetIds保持相容；不可把支援區卡當作戰鬥區Cookie目標。原始API資料未改。

### BS12-044：實際指名登場後活躍支援

免費Activate Once Per Turn以support-to-battle amount1／optional／Arena從己方支援區登場Cookie；thenEffects的set-active supportCount1／selectable／optional／restedOnly false，condition previous-effect-target-card-name Herb Cookie只檢查前段實際登場ID。選0、錯名或既有場上Herb不開後段選擇；允許任意卡種／顏色與已活躍支援，其他既有set-active維持疲勞限定預設。Refresh須先補足登場HP再續接，終局停止。atomic技能與逐段GameCommand共用待命佇列，支援登場重複ID拒絕。

### BS12-045：免費登場抽牌

exact On Play免費draw-up-to max1，condition support-count-at-least count5沒有energyColor／keyword／restedOnly。來源手牌及支援登場皆可，支援來源進場後重新算張數，沒有Once或Your Turn；GN普通2依卡號／名稱／原圖URL三重guard修正API錯置。原始JSON保留。

### BS12-046：支援登場事件與條件抽牌

exact item G1、draw-up-to max2，condition cookie-played-from-support-this-turn；GameState.cookiesPlayedFromSupportThisTurn以玩家為key，由成功support-to-battle記錄，換回合與Active Phase清除。CardAbility.allowInactiveConditionalEffects沿用原Stage旗標語意，046明確啟用付款後條件不成立仍結算no-op，其他道具不自動放寬。UI開始與完成流程須讀來源item旗標，不能因沒有權威待命效果再送resolve-ability-effect；對戰紀錄明示條件不成立未執行。

### BS12-047：獨立支援張數Then

exact trap固定green2，前段modify-attack amount-2／this-turn／opponent min0 max1；後段draw-up-to max1、support-count-at-least count7不帶顏色／Arena／疲勞篩選。沒有整卡TrapCondition或減費分支；ignoreParsedCondition使抽牌條件只屬Then，不會誤擋前段。支付後支援仍在支援區，總張數不變；前段空選不連動略過抽牌，付款／順序／目標與條件均受strict guard核對。

### BS12-048：場景登場及後續支援付款

exact stage placementCost green1、cost零、restSource true；support-to-battle amount1 optional Arena的thenEffects包含optional-cost-attack resolution ability、green1以及opponent rest-support amount1 optional。沿用實際登場目標非空才展開Then的權威佇列，付款完成後再選支援目標。hasUsableEffect的可選support-to-battle須接受零目標，不受支援候選缺少或戰鬥區已滿阻擋；強制登場維持候選門檻。strict guard拒絕前置收G、遺失REST／Arena／可選付款、獨立Then、錯方／錯費及Once Per Turn。

### BS12-049：獨立減傷與 Arena 回手付款

exact trap cost green1，第一段modify-attack -1／this-turn／opponent min0 max1；第二段optional-cost-attack resolution ability，cost supportToHand1與supportToHandKeyword arena、無額外能量，effects draw-up-to max1。AbilityCost的支援回手新增keyword篩選，與既有Type／Color取交集，正常技能、道具、Then、決策候選及AI共用isSupportToHandCostCandidate。strict guard核對順序、固定G、可選付款、任意卡種／顏色及抽牌上限，拒絕漏代價或誤加Cookie／綠色限制。

### BS12-050：Arena 棄牌區至疲勞支援

exact item cost green3、trash-to-support amount1／cookieOnly true／keyword arena／rested true／optional true。TrashToSupportEffect新增keyword，getTrashToSupportCandidates與既有卡種／顏色／等級條件取交集，UI與AI沿用權威候選，未指定keyword的既有卡保持原候選。strict拒絕漏Arena／Cookie／REST／可選、錯費與額外色／等級限制。公開紀錄依實際新增支援回報回收身份及位置／疲勞，選0明示未移動。

### BS12-051／051@1：普通攻擊後 Arena 支援登場

兩印刷共用exact attackEffects：support-to-battle amount1／optional true／keyword arena，保留印刷green1普通1；沒有額外費用、顏色／LV條件或技能。沿用權威支援候選與登場／HP／OnPlay／Refresh佇列，先普通傷害再處理選牌。strict拒絕漏Then／Arena／可選、錯G或額外篩選。UI明示Arena及選0；公開攻擊結果依實際新增戰鬥區餅乾顯示身份與已配置HP，Refresh等待時不宣稱HP已全數完成。

### BS12-052／052@1：支援登場先棄牌再傷害

exact skill trigger on-play／fromSupportArea true、cost discardHand1／energy零、damage1／opponent min0 max1，保留GN普通2與無攻擊Then。strict拒絕passive、漏支援來源／代價、誤加Your Turn／Once Per Turn及錯攻擊付款。任意手牌Cookie／道具／場景皆可支付，不限Arena／顏色。

場景支援登場的父pendingAbilityEffect會與pendingOnPlay並存；僅匹配該OnPlay來源才可暫停父佇列。GameState.suspendedAbilityEffects保存父效果，applyGameCommand在子卡牌結算完成、沒有其他卡牌待處理決策時接回最後一層，仍優先於補位。正常發動與begin-activate-skill共用技能代價和來源檢查。UI只更新相同來源的權威效果佇列，子技能完成時清除本機面板並從父來源重新呈現。

### BS12-053／053@1：支援棄牌攻擊回應及全體追加傷害

exact skill為opponent-attack／oncePerTurn true、supportToTrash1／零能量、modify-attack -2／this-turn／opponent min0 max1。exact attackEffects為damage-all1／opponent／sequential true，target min1 max2與condition all-support-rested self；保留GGGN普通3。strict核對實圖及完整代價／目標／時機，拒絕漏Then、錯費、錯條件方或誤加Arena／卡種／色／REST限制。

play-attack-response新增可選supportToTrashIds，舊指令仍有效。battle的候選及付款共用getSupportEffectCandidates；驗證精確數量、唯一ID、己方支援區與關鍵字條件後才移牌並記錄supportAreaDecreasedThisTurn／supportCardsTrashedThisTurn。技能加入逐段pendingAbilityEffect，保持trap階段，skipTrap與下一個回應拒絕未完成的卡牌效果；UI與online自動關窗也必須等待該佇列。AI同樣透過正式GameCommand選取實際支援代價，公開trace列出實際送入棄牌區的支援卡。

### BS12-054／054@1：支援棄牌後回收任意Cookie

exact skill為activate／oncePerTurn true、supportToTrash1／零能量、trash-to-support amount1／cookieOnly true／rested true／optional true，不附加keyword／energyColor／level條件；GGN普通3無Then。strict防漏核對兩印刷完整實圖預期並拒絕誤加目標限制。

本機usePendingEffect.selectionGame以純begin-activate-skill預覽支援棄牌後的狀態，描述器與getTrashToSupportCandidates共用該狀態，使剛棄置的同實體Cookie成為候選；草稿不修改真實GameState或提交command log。換代價清除前次回收目標，確認才執行實際begin與resolve。online在supportToTrash接trash-to-support時先提交begin付款，等待權威狀態後再選回收目標，不能付款前把空targetIds一起送出而跳過效果。activateCookieSkill與trash-to-support執行器分別拒絕重複代價／回收ID。

### BS12-055／055@1：這次登場的啟動限制與支付後零／一張支援

CardSkill.activationOriginThisTurn在canActivateCookieSkill核對當前CookieInBattle.enteredFrom與enteredTurn，先於所有支付；不使用玩家全域cookiesPlayedFromSupportThisTurn或OnPlay的fromSupportArea。getCookieSkillUnavailableReason提供同一權威判定的失效理由。exact cost為零能量／discardHand1／selfToTrash true，不加REST或每回合次數；同時支付手牌與來源棄牌時，手牌代價先置入棄牌區且不重複棄牌。

既有choose-one呈現0／1數量選擇，兩模式各展開deck-to-support amount0或1／rested true。amount0直接no-op，空牌庫也不開Refresh；來源離場不取消已保留的效果。命令紀錄只公開實際新增支援卡及疲勞狀態，零張明確記錄未移動，沒有揭露剩餘牌庫。兩印刷strict guard完整檢查來源條件、兩項代價、數量選擇及G普通1。

### BS12-056／056@1：同一餅乾名稱與關鍵字、後攻可選棄牌Then

EXTRA exact spec為enter-battle，any-of包含battle-area-has-named-cookie self／Candy Apple Cookie／keyword arena及support-color-count-at-least self／green／7；不附加Awaken、energy或其他代價。BattleAreaHasNamedCookieCondition新增可選keyword，規則層與AI公開條件必須在同一餅乾檢查名稱與關鍵字，舊有未指定keyword的卡牌保持原名稱語意。

exact attackEffects為optional-cost-attack／零能量／discardHand1，內層set-active supportCount1／selectable true／optional true／restedOnly false／player-started-second；使用既有內層條件在支付前判定，不設payBeforeCondition。strict guard核對完整印刷、OR兩支、NN普通2及Then條件／代價／支援目標；implicit target evidence補上selectable set-active的己方支援選擇，避免錯認為未分類目標。

optional-cost-attack提示依set-active呈現己方支援卡，不沿用對手餅乾文案。公開command log由實際targetIds列出選取卡及活躍結果，原已活躍明示原狀；選0明示未改變支援狀態，不能用supportCount1宣稱實際活躍一張。

### BS12-057：藍色且Arena手牌代價與LV2以下Cookie移動

Cookie exact cost為energy空、discardHand1／discardHandColor blue／discardHandKeyword arena，trigger為on-play；沿用同一卡交集的代價驗證，未限定discardHandCookieOnly或fromSupportArea。單段field-to-deck-bottom selector為opponent／min0／max1／maxLevel2，不加hpOnly、allowStage或顏色／Arena目標限制。完整印刷strict guard另核對LV2／HP4／BBN普通2及沒有攻擊Then。

field-to-deck-bottom在任何移動前拒絕重複targetIds，避免去重後將非法輸入默認成合法單選；對一般Cookie、場景及hpOnly共用分支生效。一般Cookie移動沿用HP／裝備棄牌與非昏厥補位流程。來源從手牌或支援登場都走同一OnPlay；實際Cream Ferret攻擊Then從支援登場的活躍／疲勞支援兩條合法路徑均以GameCommand驗證。

### BS12-058／058@1：FLIP 公開手牌至牌庫底

按兩印刷完整卡圖精確正規化B普通1與FLIP文字，清除API異圖混入skill的攻擊；候選原文保持不變。Exact FLIP cost使用energy空、discardHand1／discardHandKeyword arena，另以FlipAbility.handCostDestination deck-bottom限定這筆代價的目的地。沿用同一手牌候選、恰好1張與重複ID拒絕；移除手牌後公開並加入己方牌庫末端，不加入棄牌區，再建立單段draw-up-to max2。

一般HP FLIP開啟抽牌時保留完整afterEffects／context及flip-damage續接，即使沒有Then也保留空效果佇列，供Refresh還原。抽牌或Refresh命令完成後，共用resumeBattleAfterFlipDecision先等待真正的子決策，再判定昏厥及完成目前傷害點；effectDamageSequence的父pendingAbilityEffect不視為自己的阻擋。Detached FLIP仍沿用attack-effect續接。Strict guard核對兩印刷身分、B1、無技能／Then、Arena代價、公開牌庫底及draw-up-to2。

### BS12-063：自己承傷門檻與命名宿主

完整卡面要求免費持續被動：modify-damage-received amount0／persistent／damageType all／minimumDamage2／setDamageTo1，target self／1～1／sourceOnly，condition battle-area-has-named-cookie self／Popping Candy Cookie。沿用現有傷害規則，未新增傷害種類或UI規則。strict專屬守衛核對印刷LV2／HP2／BB3、完整條件及傷害種類，不能以普通攻擊正確取代漏掉的被動。

本機效果結果通知重用公開getEffectDamageAmount及已支付後狀態，逐目標顯示規則算出的傷害（含減傷／加成及可選傷害數），不再使用卡面amount冒充結果；CardEffect原文與目標選擇仍保留印刷值。只有觀察通知的值改變，React不另寫減傷條件。候選／局部Browser證據見BS12進度，未promote及逐卡online。

### BS12-062：獨立裝備攻擊觸發

exact skill cost B1／discardHand0、Activate／Once Per Turn，單段equip-source sourceZone battle／self1／cardName Popping Candy Cookie；battleSourceDisposition保持未定。另由CardSkill.equippedAttackTrigger保存宿主名稱與draw-up-to max2／hand-count-at-most5，契約 evidence 獨立遍歷此段並防漏，來源HP通用待裁定守衛仍有效。

beginAttack在普通付款與REST後、陷阱前建立cookie-equip的pendingStageTrigger，保存實際裝備與宿主ID。resolve-stage-trigger重新確認裝備仍附著、命名宿主和本次攻擊一致，從現行裝備metadata執行，拒絕偽造pending效果；另以既有抽牌／Refresh指令續接，不新增網路命令。resolveDrawUpTo拒絕非整數、NaN與Infinity。公開紀錄使用真實裝備卡圖，手牌條件不成立時明確記錄效果未執行。

### BS12-064：同一張牌庫底的條件與回手

免費 OnPlay 的 exact effect 為 reveal-bottom-deck requireCard／match Cookie、LV2、Arena／addMatchedToHand，唯一後段 draw-up-to max2。match 模式使用既有 pendingRevealTopDeck 並標明 deckPosition bottom；展示與切換抽牌數量皆不先移牌。resolve-reveal-top-deck 重新核對目前底牌身分，條件成立才將實際底牌加入手牌並接續抽0～2；不成立維持完整牌庫順序並記錄 no-op。空牌庫不能宣告必須展示一張的技能。

原 BS3-073 的 Cookie／其他卡去向與可選空牌庫行為不變。contract 新增 reveal-deck-bottom 代價證據及條件辨識，064專屬守衛拒絕漏交集、漏回手、抽牌數錯誤或額外顏色／費用／時機限制。不新增 GameCommand。

### BS12-065：Then 公開手牌至牌庫底

Trap exact map 保留前段 B1／對手0～1本回合普通攻擊-1，再建立 optional-cost-attack resolution ability。Then cost 使用 discardHand1／discardHandType Cookie／discardHandLevel2／discardHandKeyword Arena／handCostDestination deck-bottom；欄位名稱沿用現有選牌命令，實際目的地由規則層處理，不視為棄置手牌。四項同卡交集由 getDiscardHandCostCandidates 共用於 AI／UI／規則驗證，沒有合法代價只停用 Then，前段仍可正常支付 B。

resolveOptionalAbilityEffect 確認恰好一張合法手牌後才公開並將同一張牌放入己方牌庫末端，不加入棄牌區，再排入唯一 draw-up-to max1。抽0仍支付代價；Then略過／草稿取消不移牌且不撤回前段。空牌庫可先放入該手牌再抽，最後一張依既有Refresh完成後續原攻擊。公開GameCommand紀錄列出實際支付卡與牌庫底目的地；不新增網路命令。此目的地分支限定 ability Then 的結算，不擴張一般技能付款或既有FLIP路徑。

### BS12-066：必須展示底牌後的條件減傷

Root 與 Trap exact map 均使用 B1、reveal-bottom-deck requireCard、match Cookie／LV2／Arena、addMatchedToHand，以及唯一後段 modify-attack -2／this-turn／opponent0～1。不加顏色或額外代價，亦不沿用泛用解析的外層條件。isTrapConditionMet 共用必須底牌的空牌庫門檻，讓候選、不可用原因及實際 playTrap 在支付前一致拒絕。

沿用 resolve-reveal-top-deck 公開確認及底牌身分重核；匹配才同卡回手，不匹配保持原位。後段目標佇列保留 trap sourceKind 及 after-trap 續接；最後底牌回手後先建立 Refresh，完成後才選減傷目標及結算攻擊，無合法 Refresh 或 LV10 敗北即中止。Refresh 將來源陷阱洗入隱藏牌庫後，local／online UI 從已公開 commandLog receipt 恢復來源卡圖與身分，無須讀取隱藏牌庫。不新增 GameCommand 或網路欄位。

### BS12-067：場景放置與啟動底牌回手

Comeback Stage 使用 exact Stage effects／cost，放置 B1，Activate 另 B1＋restSource。唯一效果為 reveal-bottom-deck requireCard、match Cookie／LV2／Arena、addMatchedToHand，沒有巢狀後段、抽牌、額外顏色、Once、被動或對手可啟動限制。Root exact map 與場景能力使用同一個底牌交集。

hasUsableEffect 在 ability 宣告前共用必須底牌門檻，讓 canActivateStage／activateStage／UI／AI 一致拒絕空牌庫；playStage 放置仍合法，放置與啟動付款分開。resolve-reveal-top-deck 在沒有巢狀效果的回手分支也處理空牌庫：實際底牌先回手，再建立 remainingDraws0 的 Refresh；沒有合法休息區餅乾則判敗北。既有064抽牌與066目標佇列分支不變，不新增命令。

### BS12-068：抽牌後依支援差距回手對手支援

藍色 Arena 道具固定 B，先 draw-up-to max1，再 support-to-hand side opponent／amount2／optional true；後段 condition 為 support-count-less-than-opponent difference2，計算雙方支援總張數，疲勞支援也計入。目標不限卡種、顏色或活躍狀態，選0仍支付道具費用，抽0仍可處理後段。

support-to-hand 新增可選 side，省略時保留既有己方預設；候選、移動、支援減少事件及 UI／AI 共用相同對象。實際 GameCard 返回該支援控制者手牌，不保留 SupportEntry 的場上疲勞狀態；重複、超量或錯方 ID 在移動前拒絕。道具抽牌後的條件留至後段實際結算再判定，Refresh 與敗北完成後才續選支援。公開紀錄列出實際回手卡，條件不成立及選0皆明示未移動；不讀取隱藏對手手牌。

### BS12-069：BB 必要展示底牌後回手及效果傷害

Pop Pop Photocard 固定BB，道具 exact effect 是 reveal-bottom-deck requireCard、match Cookie／LV2／Arena、addMatchedToHand，唯一巢狀 damage1／opponent min0 max1。展示與公開確認前牌庫順序不動，符合才同一卡回手，不符留原位且不開傷害；選0不撤回回手或付款。不限制底牌顏色、對手Cookie顏色／Arena／活躍狀態。

playItem 付款函式也共用必須底牌的空牌庫預檢，與canPlayItem一致，在能量橫置及道具棄牌前拒絕。公開確認沿用底牌身分重核，最後一張回手先Refresh，完成後才選目標及傷害；沒有合法Refresh或到達敗北則停止。傷害沿用效果傷害序列及FLIP／昏厥續接，不進普通攻擊陷阱步驟。strict guard拒絕錯費、漏必要展示、同卡交集／回手／傷害、錯方／強制或額外篩選。

### BS12-070／070@1：底牌回手後全體傷害的攻擊 Then

Stardust Cookie 為藍色LV2／HP2 Arena，BB普通2、無技能。Then 使用 optional-cost-attack，cost energy為空，唯一子效果必須展示一張底牌；同卡Cookie／LV2／Arena才回手，唯一後段 damage-all amount1／opponent／sequential，target min1 max2要求完整合法對手集合及玩家點選順序。不限底牌顏色，不能只傷一個仍合法的對手。

普通攻擊、陷阱、FLIP及昏厥先完成，Then可略過而保留BB及普通傷害。空牌庫只阻擋必要展示的Then，不封鎖普通攻擊。不匹配的底牌留原位且不執行傷害。resolveOptionalCostAttack保留公開展示的attack-effect續接，確認回手後pendingAbility保留真正攻擊來源與同一續接；最後底牌先Refresh及敗北判定，再逐一傷害。若全部對手受效果傷害保護，回手仍成立且最後底牌仍必須Refresh。原目標昏厥後不重建或轉移普通傷害；後段處理仍在場的合法對手。

### BS12-071／071@1：展示後支付來源棄牌代價並讓同一張底牌登場

Ice Pop Cookie 為藍色Arena、LV1／HP3、BN普通1，無攻擊Then。技能免費Activate／Once per turn，不橫置來源。唯一前段reveal-bottom-deck精確匹配Cookie／LV2／Arena，playMatchedAfterSourceTrash先公開展示而不移牌；不符或空牌庫不移來源、HP或底牌，但正常宣告已消耗當回合使用次數。原候選中文附錄的抽牌字樣不覆寫完整英文實圖的展示語意。

符合後才開可選selfToTrash代價；未支付保留原位。支付時重核來源battleEntryId及真正底牌，來源、一般HP及裝備進棄牌區，記錄離場但不觸發傷害／FLIP／昏厥。巢狀play-revealed-bottom-cookie只接受已展示instanceId，不接受手牌替代或其他目標；原來源已在己方棄牌區才可處理。直接從牌庫底登場並正常配置HP，enteredFrom／pendingOnPlay.origin記為deck，牌庫耗盡先處理Refresh／剩餘HP配置及敗北，再續接On Play及整段後的補位。Awaken底卡的來源棄牌代價暫拒絕，留待全系列末裁定。

### BS12-072／072@1：B1 啟動與其他己方低等級 Arena 放牌庫底

Cream Soda Cookie藍色Arena、LV2／HP3、BB普通2。exact skill為Activate Once per turn／B1／不REST來源，唯一field-to-deck-bottom selector為self／min0／max1／maxLevel2／keyword arena／excludeSource。目標不限顏色、活躍狀態或名稱，但只能另一張場上Cookie實體；手牌、支援、場景與裝備不是候選。

沿用field-to-deck-bottom的實際底端追加、HP與裝備棄牌、離場紀錄及效果鏈後補位；選0仍支付並使用一次。新增此效果的deferAwakenedUnderlay旗標，只在072 exact effect排除帶底卡目標，命令重核候選也拒絕偽造選取；未設旗標的既有卡維持原規則。Then整段因R004暫不轉接，不建立只有棄牌／展示／回手的殘缺鏈。strict guard核對已確認技能、付款、精確selector與普通攻擊，並持續回報needs-review及Then代價缺證，不將整張卡誤標verified。

### BS12-073／073@1：同名排除底牌回手與獨立對手棄牌

DJ Miya藍色Arena、LV2／HP2、BB普通2。On Play免費且非Once／非REST，前段必須公開一張真正底牌；同一張牌是Cookie／LV2／Arena且name不是DJ Miya才回手，同名異圖也排除。第二段獨立檢查對手目前手牌≥6，對手自己選恰好1張手牌進棄牌區；前段不匹配不阻擋第二段，對手五張也不阻擋前段。exact skill設effectConditionsAtResolution，不把後段條件當成整體發動條件。

攻擊Then先完成BB普通2，之後可支付棄1任意手牌，將來源本身放到牌庫底；移動是field-to-deck-bottom效果而非額外selfToDeckBottom代價。固定來源不開選擇其他Cookie步驟，規則層仍拒絕偽造目標；一般HP與裝備棄牌、不算昏厥，補位／空場敗北在效果鏈後處理。公開紀錄核對實際移動並顯示原HP及裝備棄牌張數。帶Awaken底卡的來源依既有未裁定guard排除。match.excludeCardName是可選欄位，未指定的既有展示效果沿用原匹配。兩印刷雙尺寸一般176案通過，隔離裝備清理／Awaken防護8案另列，不代表合法裝備或完整Awaken對局；073／074批末完整Vitest660檔／10,007項全數通過，見BS12進度報告。

### BS12-074／074@1：精確底牌事件 EXTRA 與頂端 HP 移動

Popping Candy Cookie為Arena EXTRA、LV3／HP5、BBB普通3。playRequirement使用獨立arena-cookie-placed-from-battle-to-deck-bottom-this-turn／self，來源必須為同一張持有者戰鬥區Arena Cookie、目的地為其持有者真正牌庫底；舊泛用deck事件、非Arena、其他區域、HP-only與別的玩家不能替代。事件在普通移動及自回底代價實際完成後記錄，換回合清除，公開AI投影只含玩家旗標。

On Play免費、非Once／非REST，player-started-second才draw-up-to max2；EXTRA正常配置5HP另計，短牌庫可以Refresh後續抽到所選上限。攻擊Then沒有額外棄牌代價，可整段略過；執行時必要展示真正底牌，Cookie／LV2／Arena同卡匹配回手後才可選對手0～1，把其最上方HP放入對手牌庫底。此移動不算效果傷害、不觸發FLIP，最後HP仍處理昏厥／補位；己方最後底牌Refresh敗北時不續接移動。公開紀錄顯示實際目標名稱及HP前後數，不公開隱藏HP牌名。兩印刷雙尺寸一般228案通過，三種直接執行效果的事件反例12案隔離另列；strict靜態2／2、build／lint與AI／ST1核心同步通過，073／074批末完整Vitest660檔／10,007項（699.18秒）全數通過。僅localhost候選證據，正式BS12／逐卡online未完成，見BS12進度報告。

### BS12-075／075@1：棄手牌與來源 REST 代價、對手五張手牌棄牌

Gnome Band紫色Arena LV2／HP3、PP普通2，無Then。Activate只在己方主要階段使用，先棄1任意己方手牌及橫置來源；無能量／Once Per Turn代價。effectConditionsAtResolution在支付後檢查對手目前手牌至少5，符合才由對手選恰好1張自己的私密手牌棄置；四張仍支付、後段no-op。來源REST或無合法己方手牌不能宣告；由其他效果再次活躍後可在同回合再次付款使用。generic來源REST判定只新增角括號`<Rest this Cookie.>`，不誤讀016非代價的可選Then。075專屬ledger核對cost、threshold、接收玩家、PP2與沒有額外Once；局部命令及原生Chrome已驗，完整雙尺寸／異圖與本批全套另見進度報告。

### BS12-076：NNN 普通四傷害

Blackberry Cookie為紫色Arena、LV3／HP4，Seasoned Touch支付三張任意活躍支援並造成普通4傷害；沒有技能、Then或FLIP。沿用generic普通攻擊轉接，不另加能量顏色條件或手牌代價。原卡圖與獨立預期核對後，專用候選fixture以真實付款、登場、普通傷害及昏厥流程驗證；雙尺寸26／26涵蓋紅藍綠、全藍／全紫、取消／返回、付款取消選取、不足／REST／錯回合階段及昏厥，strict靜態1／1。候選局部證據不等同正式／online驗收，本批完整Vitest結果另見BS12進度報告。

### BS12-077：指定宿主的單次戰鬥 Blocker 封鎖

Spotlight Fan以exact map保留P Activate Once Per Turn、必須裝備至己方Rockstar Cookie及PN普通1。`CardSkill.equippedAttackBlockerPrevention.hostCardName`獨立表示裝備後被動；宿主宣告攻擊時才保存`PendingBattle.blockerPrevention`的對手與裝備來源。`isBlockDisabled`同時供候選、UI、AI與正式命令使用，戰鬥結束後不留回合旗標，也不設定FLIP／陷阱封鎖。

Cookie Equip HP／替補裁定尚未確認，077保留付款前阻擋與strict needs-review，不能加入007專屬`battleSourceDisposition`。專屬ledger防漏檢查宿主、P、Once、沒有REST／額外代價、唯一Equip、普通PN1及Blocker旗標，並拒絕误加FLIP封鎖或抽牌。附著狀態隔離驗證不能當作實際Equip完成。

共用Blocker原先漏付來源REST；依實圖BS4-014修正候選排除REST來源，`playBlocker`重核活躍狀態並在確認後橫置來源。無REST代價的Blocker不改變來源狀態，能量驗證維持共用規則。


### BS12-078 Onion Cookie（候選局部驗收）

完整實圖確認紫色Arena LV3／HP3、PPP普通3，FLIP先棄1張同卡紫色且Arena的任意手牌，再由至少五張手牌的對手自行選恰好二張棄牌；四張時不啟動或付代價。exact adapter與strict raw flip guard保留intersection及trash語義，非法卡種限制／額外能量／HP加成／去向不得靜默接受。直接FLIP的對手棄牌pending帶flip-damage續接，選牌完成後才昏厥／補位；規則與重播／序列化、雙尺寸60案通過，正式／逐卡online未完成。


2026-10-03 BS12-080候選：FLIP支付棄1任意手牌後，選0～1任意顏色／LV／REST的己方Arena Cookie補1實體HP；沒有附著加成或額外條件，普通P1傷害1。strict檢查完整費用／去向／selector／單一效果，候選局部雙尺寸64案通過，未promote。

2026-10-03 BS12-081候選：Holiday Rock為Blocker，先棄1張同時為紫色且Arena的任意己方手牌，再將攻擊轉移至來源；不支付能量、不加REST／Once／Your Turn，來源已REST仍可使用，同回合再次支付可以再使用。Cookie／ITEM／STAGE／TRAP均可作代價，分開兩張各自符合顏色／Arena不能支付。P1普通1、登場2HP，沒有FLIP或攻擊Then；strict完整費用／轉移／目標防漏與12個變異反例、候選雙尺寸56案通過，未promote。


## 2026-10-04 BS12-099 局部驗收

2026-10-04：099候選局部Browser80／80、專項2檔／122項（卡牌33含32個runtime語意變異、規則89）、受影響13檔／460項（包含專項，不相加）、strict1／1、build／全域lint通過。黑色Arena LV1／HP2、KK普通2；來源昏厥後先支付牌庫頂三張，再回收0～1己方棄牌區黑色且Arena餅乾，同名及LV1／LV3皆可。新棄入目標、交集／區域反例、選零／不付費、FLIP救援、Refresh／LV10及非昏厥送棄已驗，原生Chrome正反另確認。一般累計7,840、cursor100、剩13基礎／22印刷；1253個來源雜湊一致。097～099批末全套及AI／ST1尚待執行，719檔／11,724項屬094～096歷史結果。154 inventory／0 promoted、正式BS12／逐卡online未完成；全部裁定112及所有印刷後。

099的faint-only技能使用三張牌庫頂代價與black＋arena＋cookieOnly的trash-to-hand（max1）；付款後重新取得公開棄牌區候選，沒有同名／等級／Blocker排除。正常HP2與KK普通2分開驗證；詳見[本卡驗收](bs12-progress-2026-09-30.md#2026-10-04-bs12-099-局部驗收)。


## 2026-10-04 BS12-100 局部驗收

100以既有trash-to-hand＋cookieOnly＋arena＋hasSpecialPlay（max1）表達免費FLIP，Special Play另以己方戰鬥區黑色有效LV1 Cookie送棄支付。共用FLIP面板新增棄牌回收候選／反選／選零，公開紀錄顯示實際回收卡名；116案雙尺寸候選Browser、專項136項、受影響665項、strict1／1及build／lint通過，共用098十二案另列。一般7,956、cursor101，剩12基礎／21印刷。100～102全套留102批末；726檔／11,996項與AI／ST1是100修改前歷史結果。154 inventory／0 promoted，正式／逐卡online未完成，全部裁定112及所有印刷後；詳見[本卡驗收](bs12-progress-2026-09-30.md#2026-10-04-bs12-100-局部驗收)。


## 2026-10-04 BS12-101 局部驗收

101為黑色Arena LV1／HP2、K1普通1，Then可選支付1張己方Arena餅乾手牌，再抽0～1。公開休息區保留來源卡名／卡圖、代價明示餅乾類型，抽牌縮小保留選取；規則／實際OnlineBattleView及雙尺寸100案通過，專項126項、受影響746項、strict1／1、build／lint通過。共用026／065十六案另列；一般8,056、cursor102、剩11基礎／20印刷。154 inventory／0 promoted，正式／逐卡online未完成；100～102全套與AI／ST1待102批末，726檔／11,996項屬100／101修改前歷史結果。裁定112及所有印刷後；詳見[本卡驗收](bs12-progress-2026-09-30.md#2026-10-04-bs12-101-局部驗收)。


## 2026-10-04 BS12-103 局部驗收

103為K1黑色Arena Item，inspect-deck檢視己方頂四張、可選0～1張同時黑色且Arena的任意卡公開展示入手，其他全進棄牌區。revealPicked可選旗標保存印刷展示語意，未指定的舊檢視效果與未確認內容仍私密；紀錄依實際區域差異顯示入手／送棄，來源在Refresh後被檢視仍能找到已公開卡圖。專項134項、受影響17檔679項、Browser86／86、strict1／1、build／lint通過；共用BS11-104／109八案另列。一般8,230、cursor104、剩9基礎／18印刷；最新全套737檔12,384項屬103之前，新全套留105批末。154 inventory／0 promoted，正式BS12／逐卡online未完成；裁定112及所有印刷後。詳見[本卡驗收](bs12-progress-2026-09-30.md#2026-10-04-bs12-103-局部驗收)。


## 2026-10-04 BS12-104 局部驗收

104黑色Arena Item付款K1，先抽0～1，再獨立選0～1己方戰鬥區具有印刷Special Play的Cookie、本回合攻擊+1；抽零仍接Then，不加顏色／Arena／LV／REST限制。EffectTargetSelector.hasSpecialPlay使用skill.specialPlayCost存在性，UI不另建權威規則。公開抽牌紀錄只顯示張數及來源，不展示未印刷要求公開的手牌；online抽牌決策優先於下一段效果面板。專項119項、受影響19檔1,072項、Browser86／86、strict1／1、build／lint通過；031共用八案另列。一般8,316、cursor105、剩8基礎／17印刷，最新全套737檔12,384項屬103／104前，新全套留105批末。154 inventory／0 promoted，正式BS12／逐卡online未完成；裁定112及全部印刷後。詳見[本卡驗收](bs12-progress-2026-09-30.md#2026-10-04-bs12-104-局部驗收)。
