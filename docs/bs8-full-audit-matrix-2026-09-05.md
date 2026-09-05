# BS8 全卡逐張驗收矩陣（執行中）

範圍：171 筆、125 基礎卡。五色皆包含，EXTRA 15 筆走專用流程。

每張原文、正規化文字、runtime、hash 與異圖路由：`test-results/ui-ux-audit-2026-09-05/bs8-runtime-inventory.json`。本矩陣只由實際本輪證據更新，不以舊報告或 shadow verified 自動勾選。

`Browser A/B` 是局部正式共用 UI/命令驗證；`完整對戰/線上` 另列。文字／效果不同的異圖須補獨立案例；未測不得算完成。

| 卡號 | 名稱 | 顏色 | 含異圖筆數 | 路徑 | 原文／規則 | 卡面載入 | Browser A | Browser B | 完整對戰／線上 |
| --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| BS8-001 | Licorice Cookie | RED | 1 | 一般 | FLIP 最多抽 1，0／1 皆核對 | Chrome 實圖已載入 | 通過：FLIP 抽 1，bs8-001-a.json | 通過：略過 FLIP、發動後選 0；bs8-001-b.json／手動即時狀態 | 未測 |
| BS8-002 | Cilantro Cobra Swordsman | RED | 1 | 一般 | 已修復強制抽 1；HP≥2 依官方 FAQ 阻擋 Then | 手動瀏覽器實圖 746px 已載入 | 通過：HP→R 支付→抽 1→傷害；bs8-002-ab.json | 通過：無能量略過、未選付款阻擋、傷害選 0；引擎另測 HP2 | 未測 |
| BS8-003 | Cilantro Cobra Fighter | RED | 1 | 一般 | 已修復官方 FAQ：HP2 可棄牌、無加 HP，消耗次數 | 手動瀏覽器實圖 746px 已載入 | 通過：棄牌後全體合格餅乾加 HP；bs8-003-ab.json | 通過：無手牌阻擋、HP2 付費 no-op 與付款前警示；bs8-003-hp2-paid-noop.txt | 未測 |
| BS8-004 | Cilantro Cobra Cookie | RED | 2 | 一般 | 已修復来源有效 HP=1 才造成傷害；HP不符仍付費的邊界待專卡裁定 | 本圖／異圖實圖已載入 | 通過：R付款、橫置來源、傷害2；bs8-004-ab.json／paid-damage2.txt | 通過：無付款阻擋；引擎測HP2與加成，專卡付費no-op待確認 | 未測 |
| BS8-005 | Avatar of Ruin | RED | 2 | EXTRA | 已核對2次昏厥登場、OnPlay、RRR與雙方其他餅乾傷害；修正中文來源排除提示 | 本圖／異圖745px已載入 | 通過：EXTRA登場與手動OnPlay→攻擊→Then，bs8-005-onplay-attack-then.txt | EXTRA條件不足阻擋；四尺寸付款不足／取消；異圖略過OnPlay保持對手HP4 | 未測 |
| BS8-006 | Nutmeg Tiger Cookie | RED | 2 | 一般 | 依v1.8修正Then可整段略過，發動時先選齊雙方各1，再結算；AI Lv.1／2配對選擇同步修復 | 本圖／異圖745px已載入；本圖實際來源昏厥流程重驗 | 兩圖×1164／390×配對／略過，共8路徑；RR原攻擊傷害1，另選隊友4→3、非攻擊目標5→4。實圖來源昏厥後對手仍受傷並回到主要階段 | 漏選、同方2張不能確認；略過不追加傷害且保留原RR費用。12項引擎測試含來源昏厥／兩種FLIP順序／AI1–5 | 未測 |
| BS8-007 | Dark Choco Cookie | RED | 1 | 一般 | 原文僅RRNN傷害4，無技能／Then；runtime一致 | 實圖746px已載入 | 通過：登場、4支援付款、攻擊；bs8-007-a.json | 通過：無付款不可攻擊；bs8-007-b.json | 未測 |
| BS8-008 | Poison Mushroom Cookie | RED | 1 | 一般 | Blocker需R、改向來源；RRR傷害2轉接一致，普通攻擊Browser待補 | 實圖746px已載入 | Blocker付款後來源HP3→2、原目標保持5；bs8-008-a.json | 無能量／主動放棄均來源保持3、原目標5→4；008-b／skip.json | 未測 |
| BS8-009 | Burning Spice Cookie | RED | 4 | 一般 | 四圖官方原文目視核對；@3確實印Then R；每滿3LV加傷及來源排除一致，8項引擎回歸通過 | 四圖在IAB實際呈現，寬745／746；headless圖片受環境網路限制 | 四圖技能A/B＋各自Then付款／略過後普通RRN攻擊，共8路徑，實際傷害4／3；009-browser.json | 未付款disabled、取消不耗支援、Then另付R、來源限定目標、同回合不可再發動；引擎另測來源唯一／重複付款拒絕／換回合加成消失 | 未測 |
| BS8-010 | Red Velvet Cookie | RED | 2 | 一般 | 兩圖原文一致：本回合我方昏厥才可啟動、最多1傷害；RRN傷害3後可讓我方0／1張昏厥。補具體不可發動原因 | 兩圖官方卡面已目視核對、IAB呈現 | 兩圖技能A/B；實際攻擊→隊友昏厥→完成補位→技能選0／1、實傷0／1，010-browser.json | Then選0保留隊友且技能仍鎖定；可選來源本身昏厥；技能0目標仍消耗本回合次數；8路徑通過 | 未測 |
| BS8-011 | Saffron Buffalo Shaman | RED | 1 | 一般 | 依v1.8 §8-2／8-3修正為付款時一次選齊雙方各1張；來源可選、每張實體各自一次；RRR傷害2一致 | IAB卡面已目視核對；實圖連鎖操作已保存 | 1164／390付款與RRR普通攻擊；實圖Cake Wolf昏厥→另付R→Devil傷害→Mala受傷反應→不補位正常接續 | 兩尺寸漏選／同方2張不能確認、取消不耗支援；引擎9項含兩種FLIP順序／AI2–5，hook4項、RoomStore1項通過 | 遮罩hook與RoomStore通過；專卡完整對戰／雙Browser未測 |
| BS8-012 | Pomegranate Cake Hound | RED | 1 | 一般 | 修復Your Turn昏厥限制與來源代價失效仍抽牌；抽0也須先從休息區送來源至棄牌區。RN普通攻擊Browser待補 | IAB實圖746px載入並目視核對 | 嚴格A/B及1164／390抽0／1／來源代價不足共6路徑；抽1牌庫20→19、手牌0→1，抽0仍支付來源代價 | 來源已不在休息區時說明原因、確認disabled、繼續後無抽牌；引擎另測我方／對手回合的效果傷害與普通攻擊昏厥 | 專卡完整對戰／線上未測 |
| BS8-013 | Pomegranate Cake Shaman | RED | 1 | 一般 | 修復來源代價未支付仍復活；Your Turn、紅色LV.1與排除同名核對，復活0張仍支付來源代價。RN普通攻擊Browser待補 | IAB實圖746px載入並目視核對 | 嚴格A/B及1164／390選0／復活／代價不足共6路徑；復活BS8-002補2HP、牌庫20→18，來源留在棄牌區 | 來源不在休息區時禁止確認並說明原因，繼續後無復活；引擎另拒絕同名、非紅、LV.2及非餅乾，驗證我方／對手回合昏厥 | 專卡完整對戰／線上未測 |
| BS8-014 | Pomegranate Cookie | RED | 1 | 一般 | 卡面與runtime一致：LV.2／HP4／NNN攻擊3，無技能與FLIP；影響本卡的手機手牌／付款遮擋及詳情溢位已修復 | IAB實圖746px與詳情核對 | 登場／普通攻擊A/B；1164／390攻擊、取消、無能量6路徑；登場牌庫20→16補4HP，攻擊目標HP6→3 | 選2張不能選目標，取消不橫置；引擎拒絕不足、重複與已橫置支援、已橫置攻擊者；NNN可用黃綠藍支付 | 專卡完整對戰／線上未測 |
| BS8-015 | Schwarzwälder | RED | 1 | 一般 | FLIP先棄1張，再替原附著餅乾補1張實際HP；修復共用HP計算提前套用未翻開FLIP。RRR普通攻擊Browser待補 | IAB實圖746px載入並目視核對 | FLIP A/B與1164／390支付、略過、無手牌6路徑；支付後手牌4→3、HP1→2、牌庫20→19、棄牌8→10 | 未選手牌不能確認，無手牌僅可略過；引擎驗證未翻開時不增加公開HP，未付款不補HP | 專卡完整對戰／線上未測；共用HP變更全套4,267項、AI20場與雙端整合通過 |
| BS8-016 | Choco Cake Hound | RED | 1 | 一般 | 修復休息區來源為必要代價；先移至棄牌區，再選0–1張己方剩餘HP≤5補1HP；引擎驗證HP5／6邊界。RN普通攻擊Browser待補 | IAB實圖746px載入並目視核對 | strict A/B與1164／390選0、補HP、來源消失6路徑；補HP後4→5、牌庫20→19、棄牌8→9 | 來源不在休息區時確認停用、顯示無法支付原因且不補HP；選0仍支付來源代價 | 專卡完整對戰／線上未測；6檔579項相關測試、build與scoped lint通過 |
| BS8-017 | Cake Monster Army | RED | 2 | 一般 | R技能每回合一次；可選0張紅色印刷HP1復活，成功後才選0–1張任一方餅乾受1傷害；修正可選0中文提示與能量不足原因。RRN普通攻擊2傷害 | 兩圖IAB各745px載入並目視核對，卡文一致 | 兩圖strict A/B；1164／390共10條技能路徑及兩圖共12條普通攻擊路徑通過 | 不足／錯色付款、取消、選0、略過傷害、已用次數、非法復活與滿場；取消不付費，選0仍付R且消耗次數 | 專卡完整對戰／線上未測；6檔409項相關測試、build及scoped lint通過 |
| BS8-018 | Cake Wolf | RED | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-019 | Cake Hound | RED | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-020 | Pepper Pangolin Cookie | RED | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-021 | Soul Jam: Light of Destruction | RED | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-022 | Cake Hound's Crown | RED | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-023 | Shadow of the Destroyer | RED | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-024 | Land of Fire & Ruin | RED | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-025 | Tower of Sweet Chaos | RED | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-026 | Golden Cheese Cookie | YELLOW | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-027 | Golden Cheese Cookie | YELLOW | 6 | EXTRA | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-028 | Manager Cheesebird | YELLOW | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-029 | Miner Cheesebird | YELLOW | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-030 | Lassi Guard Kulfi | YELLOW | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-031 | Mozzarella Cookie | YELLOW | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-032 | Burnt Cheese Cookie | YELLOW | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-033 | Centipede Cookie | YELLOW | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-034 | Smoked Cheese Cookie | YELLOW | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-035 | Cinnamon Cookie | YELLOW | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-036 | Young Kulfi | YELLOW | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-037 | Squid Ink Cookie | YELLOW | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-038 | Olive Cookie | YELLOW | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-039 | Shelly | YELLOW | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-040 | Cheesecake Cookie | YELLOW | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-041 | Elder Kulfi | YELLOW | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-042 | Adventurer Cookie | YELLOW | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-043 | Fettuccine Cookie | YELLOW | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-044 | Pistachio Cookie | YELLOW | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-045 | Habanero Cookie | YELLOW | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-046 | Surprise! Lassi Jar | YELLOW | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-047 | Puny Strength | YELLOW | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-048 | Kulfi Legends | YELLOW | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-049 | Simmering Lassi Springs | YELLOW | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-050 | City of Eternal Gold | YELLOW | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-051 | Meat Dumpling King | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-052 | Cloud Haetae Cookie | GREEN | 2 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-053 | Gim Cookie | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-054 | Leek Cookie | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-055 | Bellflower Cookie | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-056 | Spicy Dumpling King | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-057 | Vagabond Cookie | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-058 | Flavorless Cookie | GREEN | 1 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
| BS8-059 | Mystic Flour Cookie | GREEN | 3 | 一般 | 已轉接，待語意核對 | 未測 | 未測 | 未測 | 未測 |
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
