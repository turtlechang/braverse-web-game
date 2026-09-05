# BS8 全卡逐張驗收矩陣（執行中）

範圍：171 筆、125 基礎卡。五色皆包含，EXTRA 15 筆走專用流程。

目前優先序依使用者更新：先完成桌機與平板，手機模式暫緩。既有手機證據保留，不將未測手機項目標為通過。紅色001–025已完成第一輪局部逐卡檢查；黃色續查至050（048／049／050本輪完成），下一張051。BS8-059修復回手綠色限制並完成兩尺寸Browser。完整正式對局、線上與複合效果仍依各列缺口補驗。

每張原文、正規化文字、runtime、hash 與異圖路由：`test-results/ui-ux-audit-2026-09-05/bs8-runtime-inventory.json`。本矩陣只由實際本輪證據更新，不以舊報告或 shadow verified 自動勾選。

`Browser A/B` 是局部正式共用 UI/命令驗證；`完整對戰/線上` 另列。文字／效果不同的異圖須補獨立案例；未測不得算完成。

| 卡號 | 名稱 | 顏色 | 含異圖筆數 | 路徑 | 原文／規則 | 卡面載入 | Browser A | Browser B | 完整對戰／線上 |
| --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| BS8-001 | Licorice Cookie | RED | 1 | 一般 | FLIP 最多抽 1，0／1 皆核對 | Chrome 實圖已載入 | 通過：FLIP 抽 1，bs8-001-a.json | 通過：略過 FLIP、發動後選 0；bs8-001-b.json／手動即時狀態 | 未測 |
| BS8-002 | Cilantro Cobra Swordsman | RED | 1 | 一般 | 已修復強制抽 1；HP≥2 依官方 FAQ 阻擋 Then | 手動瀏覽器實圖 746px 已載入 | 通過：HP→R 支付→抽 1→傷害；bs8-002-ab.json | 通過：無能量略過、未選付款阻擋、傷害選 0；引擎另測 HP2 | 未測 |
| BS8-003 | Cilantro Cobra Fighter | RED | 1 | 一般 | 已修復官方 FAQ：HP2 可棄牌、無加 HP，消耗次數 | 手動瀏覽器實圖 746px 已載入 | 通過：棄牌後全體合格餅乾加 HP；bs8-003-ab.json | 通過：無手牌阻擋、HP2 付費 no-op 與付款前警示；bs8-003-hp2-paid-noop.txt | 未測 |
| BS8-004 | Cilantro Cobra Cookie | RED | 2 | 一般 | 已修復來源有效 HP=1 才造成傷害；HP不符仍付費的邊界待專卡裁定 | 本圖／異圖實圖已載入 | 通過：R付款、橫置來源、傷害2；bs8-004-ab.json／paid-damage2.txt | 通過：無付款阻擋；引擎測HP2與加成，專卡付費no-op待確認 | 未測 |
| BS8-005 | Avatar of Ruin | RED | 2 | EXTRA | 已核對2次昏厥登場、OnPlay、RRR與雙方其他餅乾傷害；修正中文來源排除提示 | 本圖／異圖745px已載入 | 通過：EXTRA登場與手動OnPlay→攻擊→Then，bs8-005-onplay-attack-then.txt | EXTRA條件不足阻擋；四尺寸付款不足／取消；異圖略過OnPlay保持對手HP4 | 未測 |
| BS8-006 | Nutmeg Tiger Cookie | RED | 2 | 一般 | 依v1.8修正Then可整段略過，發動時先選齊雙方各1，再結算；AI Lv.1／2配對選擇同步修復 | 本圖／異圖745px已載入；本圖實際來源昏厥流程重驗 | 兩圖×1164／390×配對／略過，共8路徑；RR原攻擊傷害1，另選隊友4→3、非攻擊目標5→4。實圖來源昏厥後對手仍受傷並回到主要階段 | 漏選、同方2張不能確認；略過不追加傷害且保留原RR費用。12項引擎測試含來源昏厥／兩種FLIP順序／AI1–5 | 未測 |
| BS8-007 | Dark Choco Cookie | RED | 1 | 一般 | 原文僅RRNN傷害4，無技能／Then；runtime一致 | 實圖746px已載入 | 通過：登場、4支援付款、攻擊；bs8-007-a.json | 通過：無付款不可攻擊；bs8-007-b.json | 未測 |
| BS8-008 | Poison Mushroom Cookie | RED | 1 | 一般 | Blocker需R、改向來源；RRR傷害2轉接一致，普通攻擊已通過兩尺寸攻擊／取消／不足 | 實圖746px已載入 | Blocker付款後來源HP3→2、原目標保持5；bs8-008-a.json | 無能量／主動放棄均來源保持3、原目標5→4；008-b／skip.json | 未測 |
| BS8-009 | Burning Spice Cookie | RED | 4 | 一般 | 四圖官方原文目視核對；@3確實印Then R；每滿3LV加傷及來源排除一致，8項引擎回歸通過 | 四圖在IAB實際呈現，寬745／746；headless圖片受環境網路限制 | 四圖技能A/B＋各自Then付款／略過後普通RRN攻擊，共8路徑，實際傷害4／3；009-browser.json | 未付款disabled、取消不耗支援、Then另付R、來源限定目標、同回合不可再發動；引擎另測來源唯一／重複付款拒絕／換回合加成消失 | 未測 |
| BS8-010 | Red Velvet Cookie | RED | 2 | 一般 | 兩圖原文一致：本回合我方昏厥才可啟動、最多1傷害；RRN傷害3後可讓我方0／1張昏厥。補具體不可發動原因 | 兩圖官方卡面已目視核對、IAB呈現 | 兩圖技能A/B；實際攻擊→隊友昏厥→完成補位→技能選0／1、實傷0／1，010-browser.json | Then選0保留隊友且技能仍鎖定；可選來源本身昏厥；技能0目標仍消耗本回合次數；8路徑通過 | 未測 |
| BS8-011 | Saffron Buffalo Shaman | RED | 1 | 一般 | 依v1.8 §8-2／8-3修正為付款時一次選齊雙方各1張；來源可選、每張實體各自一次；RRR傷害2一致 | IAB卡面已目視核對；實圖連鎖操作已保存 | 1164／390付款與RRR普通攻擊；實圖Cake Wolf昏厥→另付R→Devil傷害→Mala受傷反應→不補位正常接續 | 兩尺寸漏選／同方2張不能確認、取消不耗支援；引擎9項含兩種FLIP順序／AI2–5，hook4項、RoomStore1項通過 | 遮罩hook與RoomStore通過；專卡完整對戰／雙Browser未測 |
| BS8-012 | Pomegranate Cake Hound | RED | 1 | 一般 | 修復Your Turn昏厥限制與來源代價失效仍抽牌；抽0也須先從休息區送來源至棄牌區。RN普通攻擊已通過兩尺寸攻擊／取消／不足 | IAB實圖746px載入並目視核對 | 嚴格A/B及1164／390抽0／1／來源代價不足共6路徑；抽1牌庫20→19、手牌0→1，抽0仍支付來源代價 | 來源已不在休息區時說明原因、確認disabled、繼續後無抽牌；引擎另測我方／對手回合的效果傷害與普通攻擊昏厥 | 專卡完整對戰／線上未測 |
| BS8-013 | Pomegranate Cake Shaman | RED | 1 | 一般 | 修復來源代價未支付仍復活；Your Turn、紅色LV.1與排除同名核對，復活0張仍支付來源代價。RN普通攻擊已通過兩尺寸攻擊／取消／不足 | IAB實圖746px載入並目視核對 | 嚴格A/B及1164／390選0／復活／代價不足共6路徑；復活BS8-002補2HP、牌庫20→18，來源留在棄牌區 | 來源不在休息區時禁止確認並說明原因，繼續後無復活；引擎另拒絕同名、非紅、LV.2及非餅乾，驗證我方／對手回合昏厥 | 專卡完整對戰／線上未測 |
| BS8-014 | Pomegranate Cookie | RED | 1 | 一般 | 卡面與runtime一致：LV.2／HP4／NNN攻擊3，無技能與FLIP；影響本卡的手機手牌／付款遮擋及詳情溢位已修復 | IAB實圖746px與詳情核對 | 登場／普通攻擊A/B；1164／390攻擊、取消、無能量6路徑；登場牌庫20→16補4HP，攻擊目標HP6→3 | 選2張不能選目標，取消不橫置；引擎拒絕不足、重複與已橫置支援、已橫置攻擊者；NNN可用黃綠藍支付 | 專卡完整對戰／線上未測 |
| BS8-015 | Schwarzwälder | RED | 1 | 一般 | FLIP先棄1張，再替原附著餅乾補1張實際HP；修復共用HP計算提前套用未翻開FLIP。RRR普通攻擊已通過兩尺寸攻擊／取消／不足 | IAB實圖746px載入並目視核對 | FLIP A/B與1164／390支付、略過、無手牌6路徑；支付後手牌4→3、HP1→2、牌庫20→19、棄牌8→10 | 未選手牌不能確認，無手牌僅可略過；引擎驗證未翻開時不增加公開HP，未付款不補HP | 專卡完整對戰／線上未測；共用HP變更全套4,267項、AI20場與雙端整合通過 |
| BS8-016 | Choco Cake Hound | RED | 1 | 一般 | 修復休息區來源為必要代價；先移至棄牌區，再選0–1張己方剩餘HP≤5補1HP；引擎驗證HP5／6邊界。RN普通攻擊已通過兩尺寸攻擊／取消／不足 | IAB實圖746px載入並目視核對 | strict A/B與1164／390選0、補HP、來源消失6路徑；補HP後4→5、牌庫20→19、棄牌8→9 | 來源不在休息區時確認停用、顯示無法支付原因且不補HP；選0仍支付來源代價 | 專卡完整對戰／線上未測；6檔579項相關測試、build與scoped lint通過 |
| BS8-017 | Cake Monster Army | RED | 2 | 一般 | R技能每回合一次；可選0張紅色印刷HP1復活，成功後才選0–1張任一方餅乾受1傷害；修正可選0中文提示與能量不足原因。RRN普通攻擊2傷害 | 兩圖IAB各745px載入並目視核對，卡文一致 | 兩圖strict A/B；1164／390共10條技能路徑及兩圖共12條普通攻擊路徑通過 | 不足／錯色付款、取消、選0、略過傷害、已用次數、非法復活與滿場；取消不付費，選0仍付R且消耗次數 | 專卡完整對戰／線上未測；6檔409項相關測試、build及scoped lint通過 |
| BS8-018 | Cake Wolf | RED | 1 | 一般 | 修復來源移動未標為必要代價；Your Turn、可選R支援支付、來源進棄牌後選0–1張對手受1傷害；RN普通攻擊1傷害 | IAB實圖已目視核對並操作付款／傷害 | strict A/B；1164／390共10條昏厥及6條普通攻擊路徑通過，付款只一次、傷害4→3或6→5 | 來源已移走但能量充足仍封鎖；無能量、不發動、付款後選0、取消攻擊；13項專卡規則回歸含錯色／重複支付與Your Turn | 專卡完整對戰／線上未測；最新3檔343項相關測試、build與scoped lint通過 |
| BS8-019 | Cake Hound | RED | 1（@1） | 一般 | 修復不棄手牌仍回收、來源移動未標為代價；Your Turn、棄1張→來源進棄牌→紅色LV.1非同名回手0／1核對；RN攻擊1 | IAB實圖目視核對並實際回收BS8-002 | 正／負向稽查與1164／390共10條昏厥、6條普通攻擊通過；可回收剛支付的合法手牌 | 無手牌、不發動、來源消失均整組略過；選0仍棄牌並移動來源；11項引擎回歸含排除同名／錯色／LV.2／物品及保留其他來源佇列 | 專卡完整對戰／線上未測；全套280檔4,304項、build、scoped lint及AI20場通過 |
| BS8-020 | Pepper Pangolin Cookie | RED | 1 | 一般 | HP1可啟動將自身與HP送棄牌、非昏厥；RR普通攻擊2傷害；HP2提示已具體化 | IAB實圖已目視核對 | 1164／390共6條技能與6條普通攻擊通過，來源移除、Break不變 | HP2不能發動；取消不移動卡片；6項專卡回歸含休息狀態、錯誤目標及回合 | 專卡完整對局／線上未測；4檔327項相關測試通過 |
| BS8-021 | Soul Jam: Light of Destruction | RED | 2 | 一般 | 修復RR後漏收R裝備，及效果傷害漏掉補HP型FLIP；非Burning Spice受1傷害、Then付R裝備0／1、Break LV8禁陷阱 | 兩種IAB實圖皆已目視核對 | 兩圖×1164／390共20條付款、12條無能量／FLIP支付／昏厥續接；另4條LV7／8陷阱回應 | 16項專卡回歸：錯誤付款與目標、FLIP可救回最後HP、不發動則昏厥技能後再裝備；測試入口不再自動略過FLIP | 僅demo共用UI；RR→R→裝備→攻擊完整Browser連鎖及專卡完整對局／線上未測；本批全套4,328項通過 |
| BS8-022 | Cake Hound's Crown | RED | 1 | 一般 | 修復必要昏厥代價被當成直接棄牌；先付款與昏厥，再從新狀態選紅色LV.1回收0–2張 | IAB實圖與卡文已核對 | 1164／390共8條：選0／1／2、取消、缺付款／代價時阻擋、回收剛棄置HP；IAB另實際操作HP回收 | 11項專卡規則及本機／線上hook回歸；含敗北停止、昏厥技能續接、錯色／LV／重複與覺醒下疊卡 | 僅demo共用UI，尚未證明正式狀態已修改；專卡完整真人對局／線上Browser未測；bs8-022-browser.json |
| BS8-023 | Shadow of the Destroyer | RED | 1 | 一般 | RR及HP≥2門檻；已改為跨雙方選擇全體結算順序，恢復陷阱前原攻擊目標 | IAB實圖與卡文已核對 | 1164／390共4條發動／略過重跑；排序未選齊阻擋，HP1及未翻開015不受效果傷害 | 7項專卡；另共用12項排序／防護／FLIP／昏厥／AI及2項本機／線上hook | 僅demo；完整正式對局、專卡線上Browser與Refresh續接仍待；bs8-023-order-browser.json |
| BS8-024 | Land of Fire & Ruin | RED | 2 | 一般 | @1錯置卡文已勘誤；R配置／RR橫置；全體1傷害改為跨雙方自選順序 | 兩款官方卡面、修正後詳情及IAB排序已核對 | 兩圖×1164／390共8條發動／取消重跑；對手→己方→對手、未選齊阻擋 | 5項專卡；共用排序回歸涵蓋所有目標各一次、FLIP後昏厥與免疫候選一致 | 僅demo；完整正式對局、專卡線上Browser與Refresh續接仍待；bs8-024-order-browser.json、bs8-024-order-iab.png |
| BS8-025 | Tower of Sweet Chaos | RED | 1 | 一般 | 修正昏厥代價；RR配置、R及橫置並使己方1張昏厥，付款後才選對手0–1張受1傷害 | 官方實圖及IAB付款／結算已核對 | 1164／390共6條選0／1與取消；Break4→5、3支援橫置、缺費用／代價阻擋 | 7項：付款、Break敗北停止、018昏厥續接、錯誤目標／階段／能量及不可變性 | 僅demo共用UI，尚未證明正式狀態已修改；專卡完整對局／線上Browser未測；bs8-025-browser.json |
| BS8-026 | Golden Cheese Cookie | YELLOW | 2 | 一般 | 兩圖YYY／3傷害；Then自身HP≤4補1已核對 | 兩款官方卡面已目視核對 | 1440×960兩圖A/B共4條：3支援支付、目標6→3；自身4→5／5→5 | 既有yellow-validation兩圖付款／門檻測試，Browser另驗實際HP結果 | 僅test-state既有攻擊者，正式開局／完整對局、手機與專卡線上未測；bs8-026-positive.json、bs8-026-negative.json |
| BS8-027 | Golden Cheese Cookie | YELLOW | 6 | EXTRA | 六圖HP+2、Break登場覺醒、Break交換與YYY／3一致；修復攻擊後全對手1傷害的自選順序與自動結算候選 | 六款官方實圖均已目視核對 | 1164／390共32條：覺醒成立／不成立、YYY攻擊後反向排序、六變體Break技能A/B；HP4→6、對手6／6→2／5；普通點擊通過 | 新增8項回歸涵蓋六變體、錯色／缺漏／重複付款、漏選／重複／己方目標與免疫；相關5檔330項通過 | 僅test-state共用UI，尚未證明正式狀態已修改；完整開局／對局、專卡線上、六變體各自覺醒Browser及Refresh仍待；bs8-027-browser-1164.json、bs8-027-browser-390.json |
| BS8-028 | Manager Cheesebird | YELLOW | 1（@1） | 一般 | 官方JSON類型／顏色錯置已有正規化；黃色LV.2／HP4，本回合Break登場條件、每回合一次、對手0–1受1傷害及YYY／3一致；strict verified與單卡shadow ready | 官方實圖與IAB實際技能面板已目視核對 | 1440／390技能成立／不成立／選0共6條，HP6→5或維持6；1164／390普通攻擊、取消、不足共6條，YYY使HP6→3；IAB另實際發動扣1HP | 未達條件不可發動、使用後次數耗盡；未選齊支援不可攻擊、取消不扣費；既有引擎涵蓋真實Break登場後離場仍有效與換回合重置 | 僅test-state；完整正式／線上對局未測；bs8-028-attack-browser.json、mobile-positive／negative／zero.json、bs8-028-skill-iab.png |
| BS8-029 | Miner Cheesebird | YELLOW | 1（@1） | 一般 | 黃色LV.1／HP2；Break登場歷史、每回合一次抽0–1及YY／2與官方卡面一致；strict verified與單卡shadow ready；修復手機技能列裁切與卡牌點擊攔截 | 官方實圖及手機數值／操作列已目視核對 | 1440／390技能成立／不成立／抽0共6條；抽1牌庫20→19、抽0保留20。1164／390普通攻擊、取消、不足共6條，HP6→4；CSS修正後重跑手機技能3條與全部攻擊路徑 | 抽0亦消耗次數、不得抽2或同回合重複發動；取消攻擊不付款，付款未齊不能選目標；與028共18條320／390／680技能列邊界、數值不重疊及操作回歸 | 僅test-state；完整正式／線上對局未測；bs8-029-mobile-final-positive／negative／zero.json、bs8-029-attack-browser.json、bs8-mobile-skill-controls.json |
| BS8-030 | Lassi Guard Kulfi | YELLOW | 1 | 一般 | LV.3／HP5、YYNN／4且無技能／Then／FLIP與官方卡面一致；strict verified與單卡shadow ready | 官方實圖已目視核對 | 1440／390登場與攻擊A/B共4條；1164／390攻擊、取消、不足共6條，目標HP6→2 | 3／4支援不可選目標，取消不橫置；既有yellow-validation驗2黃＋2藍合法、1黃＋3藍拒絕 | 僅test-state；完整正式／線上對局未測；bs8-030-1440／390-positive／negative.json、bs8-030-attack-browser.json |
| BS8-031 | Mozzarella Cookie | YELLOW | 2 | 一般 | 兩圖Y＋棄牌LV.3進Break，再回收恰好2張且LV合計≤3；YY／2一致。修復重複目標輸入被去重接受；修正OnPlay無效取消按鈕，本機／線上改用明確略過入口 | 兩款官方實圖、IAB支付後目標與超額阻擋已目視核對 | 兩圖×1440／390 A/B共8條；1164／390支付步驟略過／代價步驟略過／回收共12條，Break3→6→3，付款1次；普通攻擊12條HP6→4 | 選0／單張／LV4不能確認，略過不扣費；兩圖規則拒絕A,A,B重複選擇，支付代價至LV10立即判負且不回收；線上元件確認只送skip-on-play | 僅test-state共用UI；專卡完整正式／線上Browser對局未測；bs8-031-choice-browser.json、bs8-031-attack-browser.json、bs8-031-1440／390-final-positive／negative.json |
| BS8-032 | Burnt Cheese Cookie | YELLOW | 2 | 一般 | 兩圖Activate／每回合一次、預先有Break餅乾；自身＋手牌LV≥2進Break後抽0–2，再登場0–1 Golden Cheese Cookie；YY／2一致。修正選0仍顯示已登場及break區提示 | 兩款官方實圖已核對；IAB實際操作抽0後仍能登場 | 1440／390技能成立／不成立／選0共12條，1164／390普通攻擊12條；另16條取消／抽0登場／抽1或2不登場，檢查實際區域、牌庫與結果訊息 | 既有14項專卡回歸涵蓋手牌LV限制、來源先離場、HP／裝備棄置、抽0–2的Then、代價達LV10與Refresh續接；新結果訊息回歸與相關3檔75項通過 | 僅test-state共用UI；專卡完整正式／線上Browser及Refresh Browser未測；bs8-032-choice-browser.json、bs8-032-attack-browser.json及兩尺寸A/B報告 |
| BS8-033 | Centipede Cookie | YELLOW | 1（@1） | 一般 | 官方欄位誤為flip／null，既有正規化為黃色LV.2／HP4餅乾；無技能／FLIP，NNN攻擊3與卡面一致；strict verified及單卡shadow ready | 官方實圖已目視核對 | 1440／390登場與攻擊A/B共4條；1164／390攻擊／取消／不足共6條，HP6→3、支付3張 | 只選2支援不能選目標、取消不付款；既有yellow-validation驗藍紅綠混色合法且來源仍為黃色 | 僅test-state；完整正式／線上對局未測；bs8-033-attack-browser.json、bs8-033-1440／390-positive／negative.json |
| BS8-034 | Smoked Cheese Cookie | YELLOW | 2 | 一般 | 兩圖Activate／每回合一次、預先有Break餅乾；自身＋任意LV手牌餅乾進Break，再登場0–1 Golden Cheese Cookie並設6HP；YYY／2與卡面一致；strict／兩筆shadow ready | 兩款官方實圖均已核對 | 1440／390成立／不成立／選0共12條；1164／390取消／選0／登場12條與普通攻擊12條；LV1代價合法、登場6HP使牌庫20→14、選0不消耗HP牌 | 兩變體既有18項規則回歸涵蓋完整代價、無Cookie手牌、預先Break條件、非Golden／EXTRA阻擋、代價達LV10與離場後不能再發動；相關2檔29項通過 | 僅test-state；專卡完整正式／線上Browser與Refresh Browser仍未測；bs8-034-choice-browser.json、bs8-034-attack-browser.json及兩尺寸A/B報告 |
| BS8-035 | Cinnamon Cookie | YELLOW | 1 | 一般 | OnPlay先棄牌餅乾進Break，再選0–1同LV餅乾回棄牌；無能量代價，YYY／3與卡面一致。修正共用略過按鈕的重複可存取名稱 | 官方實圖及IAB先付款、再選回剛支付卡均已核對 | 1440／390成立／不成立／選0共6條；普通攻擊6條；1164／390代價前略過／選代價後略過／回收代價卡／交換別張／選0共10條 | 同LV2候選包含Cinnamon及剛支付Centipede，排除LV1 Squid；略過不移牌，選0留在Break LV5；14項既有專卡回歸涵蓋LV1–3、跨來源紀錄、重複與LV10判負，相關3檔55項通過 | 僅test-state共用UI；專卡完整正式／線上Browser未測；bs8-035-choice-browser.json、bs8-035-attack-browser.json及兩尺寸A/B報告 |
| BS8-036 | Young Kulfi | YELLOW | 1 | 一般 | LV.1／HP1、Y／1，FLIP棄1手牌後從牌庫補1HP；不將未翻開卡當持續HP加成；strict／shadow ready | 官方實圖與IAB末頁手牌支付後HP1→2均已核對 | 1440／390 FLIP成立／無手牌阻擋／不發動6條，1164／390末頁支付／不發動／選牌後不發動／空手8條，普通攻擊6條 | 未選／取消選取時禁用發動；支付手牌4→3、牌庫20→19，略過不扣牌；既有9項專卡回歸涵蓋正式攻擊揭示、錯區／重複／超量代價、實體卡守恆 | 僅test-state；完整正式／線上Browser及最後HP／Refresh Browser仍待；bs8-036-flip-browser.json、bs8-036-attack-browser.json及兩尺寸A/B報告 |
| BS8-037 | Squid Ink Cookie | YELLOW | 1 | 一般 | OnPlay付Y只替自身補1HP；LV.1／HP2、YY／2與官方卡面一致；strict／shadow ready | 官方實圖已目視核對 | 1440／390技能成立／能量不足4條，普通攻擊6條；1164／390／320付款／付款前略過／選付款後略過共9條 | 未選能量不能確認；付款後自身2→3HP、其他餅乾保持4HP、牌庫18→17及1支援橫置；略過不扣費、不補HP；既有yellow-validation源限定／錯色／付款／略過回歸，與036共2檔20項通過 | 僅test-state；專卡完整正式／線上Browser及Refresh仍待；bs8-037-choice-browser.json、bs8-037-attack-browser.json及兩尺寸A/B報告 |
| BS8-038 | Olive Cookie | YELLOW | 1 | 一般 | OnPlay先將恰好LV.3手牌餅乾放入Break，再選0–2張LV.1移至棄牌；Y／1與卡面一致；strict／shadow ready | 官方實圖及IAB支付後只選1張均已核對 | 1440／390成立／缺代價／選0共6條，普通攻擊6條，1164／390付款前略過／選好代價後略過／選0／1／2共10條 | 代價前略過保持Break LV4；付款升至LV7，選0／1／2後為7／6／5，LV3代價不退回；12項專卡規則回歸通過，涵蓋錯等級／重複／超量、無LV1可付代價選0與LV10立即判負 | 僅test-state共用UI；專卡完整正式／線上Browser仍待；bs8-038-choice-browser.json、bs8-038-attack-browser.json及兩尺寸A/B報告 |
| BS8-039 | Shelly | YELLOW | 1 | 一般 | Activate每回合一次、恰好LV.2手牌進Break，再登場0–1 LV≤2餅乾；YYY／3一致。補充無合法登場候選時可確認0張的提示 | 官方實圖、IAB從空Break支付後登場及滿場情境已核對 | 1440／390成立／缺代價／選0共6條、普通攻擊6條；1164／390取消／選0／剛支付卡登場／控場表單建立滿場共8條 | 原本Break空、支付後手牌空仍保留候選；滿場可付代價但不能登場第三張，零張不退代價；12項既有規則回歸含錯LV、換回合重置及LV10判負；新空候選元件回歸與相關3檔54項通過 | 僅test-state／控場表單；完整正式／線上對局及Refresh Browser仍待；bs8-039-choice-browser.json、bs8-039-attack-browser.json及兩尺寸A/B報告 |
| BS8-040 | Cheesecake Cookie | YELLOW | 1 | 一般 | LV1／HP2、Y攻擊1；Break LV≥3時強制抽1再棄1，strict／offset1041 shadow ready；修正攻擊後棄牌來源名稱Unknown | 官方實圖與IAB棄置剛抽卡已核對 | 修正後1440×960／1164×777 A/B共4條，加原手牌／新抽牌／Break不足／取消／無能量共10條；選牌後取消選取仍禁止0張確認，確認鈕在畫面內且可普通點擊 | Break LV2仍造成1傷害但不抽棄；取消不付費、無能量不能選目標；10項規則回歸含重複／錯區／超量、Refresh後強制棄牌及來源卡名；4檔59項相關回歸通過 | 僅test-state共用UI；完整正式／專卡線上與Refresh Browser仍待。手機暫緩後未重跑修正版；bs8-040-choice-browser.json及1440／1164-final-positive／negative.json |
| BS8-041 | Elder Kulfi | YELLOW | 1 | 一般 | LV2／HP2、YY攻擊2；免費FLIP最多抽1，strict／offset1042 shadow ready | 官方實圖已核對；IAB實際發動並抽1 | 1440×960／1164×777抽1／不發動／抽0共6條，普通攻擊／取消／不足6條。抽1牌庫20→19、手牌4→5，FLIP進棄牌區；不消耗支援 | 抽0與不發動均保留牌庫20；6項既有規則回歸通過，涵蓋空手零支援可發動、錯誤操作者／超量抽牌拒絕、未選完不得續傷害、Refresh續傷害與實體卡守恆 | 僅test-state共用UI；完整正式／專卡線上與Refresh Browser仍待；手機暫緩。bs8-041-attack-browser.json及1440／1164-positive／negative／zero.json |
| BS8-042 | Adventurer Cookie | YELLOW | 1 | 一般 | 僅從Break登場觸發；免費選對手0–1支援，下次活躍階段不設為活躍，不立即橫置；LV1／HP2、YY／2一致，strict／offset1043 ready | 官方實圖及IAB選活躍支援已核對 | 1440×960／1164×777成立／手牌登場不成立／選0共6條、攻擊6條；選活躍／已橫置／0／略過並推進對手回合共8條，只有被選中的橫置卡保持橫置 | 11項規則回歸通過，含真實Shelly付款復活命令、空支援選0、手牌／棄牌登場不觸發、錯區／重複／超量拒絕及第二次活躍階段恢復 | 僅test-state；fixture以真實命令建立Break來源但非完整開局。下一次活躍階段有Browser證據，第二次恢復僅規則測試；完整正式／線上仍待，手機暫緩。bs8-042-choice-browser.json、attack-browser及兩尺寸A/B／zero |
| BS8-043 | Fettuccine Cookie | YELLOW | 1 | 一般 | Activate每回合一次付Y；只替本回合從Break登場的己方LV3補1實際HP；LV1／HP2、Y／1一致，strict／offset1044 ready | 官方實圖及IAB補HP已核對 | 1440×960／1164×777條件A/B共4條、普通攻擊6條、付款前取消／目標步驟取消／返回換支援再付款共6條；目標4→5HP、來源維持1HP、牌庫20→19 | 13項規則回歸含空／錯色／橫置支付、手牌／LV2／前回合登場拒絕、次數重置仍需新登場、錯誤／零／重複目標。Browser確認取消不扣費與次數；選取旋轉是付款預覽，最後確認才支付 | 僅test-state；正式完整對局、專卡線上及Refresh Browser仍待，手機暫緩。bs8-043-choice-browser.json、attack-browser及兩尺寸A/B |
| BS8-044 | Pistachio Cookie | YELLOW | 1 | 一般 | Blocker付Y改變攻擊目標；不橫置來源、非每回合一次；LV1／HP3、YYY／2一致，strict／offset1045 ready | 官方實圖與IAB末張支援付款已核對 | 1440×960／1164×777攔截／無能量／不使用6條、普通攻擊6條，末張付款／選好後不使用／返回不發動6條；攔截HP3→2、原目標5不變，略過則原目標5→4 | 8項專卡規則回歸通過：來源已橫置仍可攔截、同回合第二次付新Y仍可用、錯色／橫置支援／錯誤玩家／時機及已被攻擊來源拒絕；Browser取消選取鎖定確認，不使用無付款，來源不橫置 | 僅test-state；完整正式／線上與同回合連續兩次攔截Browser仍待；手機暫緩。bs8-044-choice-browser.json、attack-browser及兩尺寸positive／negative／decline |
| BS8-045 | Habanero Cookie | YELLOW | 1 | 一般 | LV2／HP4、YY攻擊3；Then休息區LV≤6時來源必須進休息區，strict／offset1046 ready；提示修成「將此餅乾放入休息區」 | 官方實圖與IAB離場至LV8已核對 | 修正後1440×960／1164×777 LV6／LV7共4條；普通攻擊取消／不足另4條。LV6→8、來源HP棄置並開補位；LV7原地保留；均先造成3傷害 | UI無略過／取消且不能0張確認；10項規則回歸含正式付款、補位、物理卡守恆、附件去向、錯色／目標／重複拒絕及BS6-010移動禁止；共3檔69項UI／專卡回歸、build與scoped lint通過 | 僅test-state；完整正式／線上、移動禁止與空場補位Browser仍待；手機暫緩。bs8-045-choice-browser.json、attack-browser、ui-targeted.log |
| BS8-046 | Surprise! Lassi Jar | YELLOW | 1 | 一般 | Y物品，己方恰好1HP可選0–1補1HP；strict／offset1047 ready | 官方實圖及IAB補HP已核對 | 1440×960／1164×777共14條：正反向／0及付款前、目標階段取消、0／1；HP1→2、牌庫20→19，其他HP2不變 | 11項規則回歸；無1HP目標仍可付Y選0並消耗物品；取消保留物品與能量；未翻FLIP不改變HP條件 | 僅test-state；完整正式／線上及Refresh Browser待；手機暫緩。bs8-046-choice-browser.json、兩尺寸positive／negative／zero、targeted.log |
| BS8-047 | Puny Strength | YELLOW | 1 | 一般 | Y＋公開任意色手牌LV3代價；休息區黃色LV3登場0–1，再將原公開卡移入休息區；strict／offset1048 ready | 官方實圖及IAB三段順序已核對 | 修正後兩尺寸取消付款／公開前取消／登場1／登場0共8條；已付代價不可撤回，Then不能改選，登場時牌庫20→15、休息區LV3→0→3；0登場則LV3→6 | 20項專卡回歸含紅色公開、錯誤代價／顏色／目標、滿場與空休息區、Refresh及OnPlay略過續接；修正Then尚未確認卻顯示已完成，相關3檔80項與build／scoped lint通過；修正前通用A/B／0另6條通過 | 僅test-state；完整正式／線上、Refresh／OnPlay插入Browser待；手機暫緩。bs8-047-choice-browser.json、兩尺寸positive／negative／zero、ui-targeted.log |
| BS8-048 | Kulfi Legends | YELLOW | 1 | 一般 | Y費用、己方Break LV≥3、棄牌區具名Soul Jam（Destruction=BS8-021、Abundance=BS3-043）回收0–1；12項引擎回歸（兩種具名、選0、錯名／手牌／對手棄牌／重複／超量拒絕、Break LV2不可發動、錯色／休息／缺付款拒絕） | 官方卡圖HEAD 200可載入；Browser以實際DOM確認回收 | 1440×960正向／負向／選0／Abundance共4條＋1164×777同4條通過：Y付款、支援橫置、回收進手牌、原攻擊續接傷害；Break不足留手牌無trace | 專卡完整對局／線上未測；bs8-048-050-desktop/tablet-positive、negative、048-abundance證據 |
| BS8-049 | Simmering Lassi Springs | YELLOW | 1 | 一般 | YY配置、Activate再付Y＋橫置來源、選己方恰好剩餘HP1補1HP0–1；14項引擎回歸（選0仍付款橫置、HP2／對手／重複／未知目標拒絕、錯色／休息／缺付款拒絕、非主人主要階段拒絕、未翻開FLIP不預先計HP） | 官方卡圖HEAD 200可載入 | 1440×960與1164×777正向／負向／選0共6條通過：配置YY橫置2支援、啟動橫置場景、HP1→2、牌庫20→19；選0仍橫置，條件不足選0 | 專卡完整對局／線上及Refresh續接未測；bs8-048-050-desktop/tablet-positive／negative／zero證據 |
| BS8-050 | City of Eternal Gold | YELLOW | 2 | 一般 | Y配置、Activate僅橫置無能量費、選本回合從Break登場的LV.3 0–1補1HP、Then以後段剩餘HP=2再補1（HP1→3、HP2→3）；17項引擎回歸（兩變體、手牌／前回合／LV2／對手目標拒絕、Then不可改選、Refresh中斷續接、批次Then一致） | 兩變體官方卡圖HEAD 200可載入（@1另行確認） | 兩圖×1440×960／1164×777正向／負向／選0共12條通過：配置Y、啟動只橫置不耗支援、HP1→3、Then紀錄「HP 2 → 3」；選0不補HP仍橫置 | 專卡完整對局／線上及複合Refresh插入未測；bs8-048-050-desktop/tablet-positive／negative／zero證據 |
| BS8-051 | Meat Dumpling King | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-052 | Cloud Haetae Cookie | GREEN | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-053 | Gim Cookie | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-054 | Leek Cookie | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-055 | Bellflower Cookie | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-056 | Spicy Dumpling King | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-057 | Vagabond Cookie | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-058 | Flavorless Cookie | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-059 | Mystic Flour Cookie | GREEN | 3 | 一般 | 修復回手2張支援卡漏掉綠色限制（官方卡文Return 2 {G}）；轉接補supportToHandColor green，AI／hook沿用共用候選判定。既有具名同名互斥回歸＋新增混色付款拒絕、綠卡不足不可發動 | 三變體官方卡圖於Browser載入核對 | 三圖×1440×960／1164×777正向／負向共12條通過：G付款＋2綠回手、對手全體HP各減2、同名在場不可發動 | 專卡完整對局／線上未測；bs8-059-desktop/tablet-positive／negative證據 |
| BS8-060 | Peach Blossom Cookie | GREEN | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-061 | Chives Dumpling King | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-062 | Shrimp Dumpling King | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-063 | Hydrangea Cookie | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-064 | Snake Fruit Cookie | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-065 | Spinach Cookie | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-066 | Almond Cookie | GREEN | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-067 | Oyster Cookie | GREEN | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-068 | Yugwa Cookie | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-069 | Peak of Apathy | GREEN | 2 | EXTRA | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-070 | White Ghost Cookie | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-071 | Peach Baos | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-072 | Soul Jam: Light of Apathy | GREEN | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-073 | Noodle Cocoon | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-074 | White Flour Fog | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-075 | The Ivory Pagoda | GREEN | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-076 | Icicle Yeti Cookie | BLUE | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-077 | Kumiho Cookie | BLUE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-078 | Snow Sugar Cookie | BLUE | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-079 | Snowflake Cookie | BLUE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-080 | Moon Rabbit Cookie | BLUE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-081 | Strawberry Cream Cookie | BLUE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-082 | Cotton Cookie | BLUE | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-083 | Frost Queen Cookie | BLUE | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-084 | Sherbet Cookie | BLUE | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-085 | Pinecone Cookie | BLUE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-086 | Cream Puff Cookie | BLUE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-087 | Starfruit Cookie | BLUE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-088 | Milk Cookie | BLUE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-089 | Carol Cookie | BLUE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-090 | Will of Nature | BLUE | 2 | EXTRA | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-091 | Tiger Lily Cookie | BLUE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-092 | Angel Cookie | BLUE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-093 | Cocoa Cookie | BLUE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-094 | Pancake Cookie | BLUE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-095 | Herb Cookie | BLUE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-096 | Warm Wind Flower | BLUE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-097 | Heartfelt Light | BLUE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-098 | Warmth of the Snowfield | BLUE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-099 | Frozen Mountain Depths | BLUE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-100 | Snowfall Lantern Tree | BLUE | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-101 | Dark Cacao Adviser 1 | PURPLE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-102 | Dark Cacao Adviser 2 | PURPLE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-103 | Dark Cacao Cookie | PURPLE | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-104 | Dark Cacao Cookie | PURPLE | 3 | EXTRA | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-105 | Strawberry Cookie | PURPLE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-106 | Lilac Cookie | PURPLE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-107 | Wizard Cookie | PURPLE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-108 | Blackberry Cookie | PURPLE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-109 | Affogato Cookie | PURPLE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-110 | Affogato Cookie's Disciple | PURPLE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-111 | Onion Cookie | PURPLE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-112 | Espresso Cookie | PURPLE | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-113 | Knight Cookie | PURPLE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-114 | Old Milk Villager Cookie | PURPLE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-115 | Young Milk Villager Cookie | PURPLE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-116 | Milk Cookie | PURPLE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-117 | Healer Cookie 1 | PURPLE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-118 | Healer Cookie 2 | PURPLE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-119 | Crunchy Chip Cookie | PURPLE | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-120 | Caramel Arrow Cookie | PURPLE | 5 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-121 | Black Concoction | PURPLE | 1 | 一般 | 已修復磨0–3、本次紫色Item判定、Refresh續磨；9項專測通過 | 手動瀏覽器實圖已載入 | 局部：P付款、磨3命中後HP+1；bs8-121-mill3-hp1.txt | 局部：磨0不加HP；bs8-121-mill0-no-hp.txt；其餘逐卡Browser待測 | 未測 |
| BS8-122 | Milk Cart | PURPLE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-123 | Dark Resolution | PURPLE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-124 | Glorious Return | PURPLE | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-125 | The Days of Resolution and Dignity | PURPLE | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |

補充普通攻擊證據：BS8-001／008／012／013／015／016各於1164／390驗證攻擊、取消及無能量，合計36路徑；見`bs8-prior-attacks-browser.json`。BS8-001的RR攻擊實傷2、BS8-008的RRR實傷2、BS8-015的RRR實傷3，其餘RN實傷1。
