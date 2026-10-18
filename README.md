# 薑餅人對戰卡牌 Braverse

<!-- ai-starter-current-start -->
2026-10-18 AI 優化驗收完成：目前35副牌組＝28副Cookierift社群構築＋7副BS12參照，涵蓋六色與混色。修正攻擊Then順序、Refresh生存優先及HP支付後目標判定；新候選91c42ea對共用合法性修正對照0b83382的5,040場matched回歸全部完成，零錯誤／未完成／動作上限，候選2,540勝、對照2,500勝（50.40%），七個色組勝場差均為正；逐副20增／12平／3副各少一勝。獨立auditor與Sol原生逐列複核通過，347個目前來源雜湊、校準bytes、整份逆替與297個非政策來源核對通過；此cohort曾用於診斷，不能稱獨立holdout，也不能將差值歸因兩邊共有的HP修補。新來源完整Vitest 1,066檔／21,288項、build、產品來源ESLint、標準AI Browser與Pavlova雙尺寸四個實際Lv.5準備式案例全通過，最終通過的驗證RAM觀測最高47.1%。前一970來源六色雙尺寸12個完整UI鍵為AI8勝／玩家4勝，另保留2場harness停止；已核對本次HP修補在該封閉牌表不可達，仍不改稱91已重跑12場。原970矩陣／全套FAIL與先前99.3% RAM事故證據保留；新版護欄已實測停止自有子孫程序，52%提前停止、使用者60%上限維持。固定AI及有限ST1腳本的競爭表現不代表真人／專家強度、每副牌均改善或online驗收。本次提交範圍另以隔離快照通過build、產品來源ESLint及103檔／1,609項回歸；獨立ST9、AGENTS與產物未納入。詳見[本輪證據與提交範圍](docs/ai-cookierift-2026-10-10.md)，下列數字屬更早來源。

2026-10-18 AI 影片策略分析與 Lv.3 登場續接：一般／EXTRA 登場沿用最高單一合法後續指令估值，確認實際攻擊支付，並排除未知揭牌／洗牌結果。完整 Vitest 1,059 檔／21,187 項、build、產品來源 ESLint、標準 AI Browser 通過。AI 目前有 35 副六色及混色牌組，牌表含 BS1～BS12 與 33 個 P 卡號。兩批不同 seed 的 Lv.5 完整對照各為 5,040／5,040 場、零錯誤：對重建 HEAD policy 候選 2,587 勝、基準 2,453 勝（51.33%）；對另存的場景來源修正參考版候選 2,586 勝、參考 2,454 勝（51.31%）。兩批每副牌在兩種政策下各出賽 144 場，來源／牌表／鏡像完整性均核對，參考版本不同而不合併勝率。最新批六色及混色均有較多候選勝場，紫色只多 2 勝，仍有八副牌在候選控制時的勝場較少；政策交換也改變對手，差值不能單獨歸因於該牌組自身決策。第二組 5,038／5,040 的 FAIL 已重播確認兩筆皆為原基準的共用場景來源／付款不一致，保留失敗與診斷，不併入勝場。這是固定 AI 矩陣結果，不能歸因 Lv.3 修補或代表真人強度。

正式 UI 除原先人方偏略過的第 14 回合終局外，新增主動操作對局：人方 6 次支援、9 次攻擊、5 次補位，Lv.5 紅色 Arena AI 於第 13 回合勝利、頁面錯誤 0，未注入搜尋時鐘；人方使用簡單腳本策略，尚未量測真人勝率。最新矩陣記憶體最高 43.1%、主動 UI 44.6%。全域 lint 掃描產物後中止；產品來源 ESLint 已通過，未提交／推送。詳見[AI 牌組與決策報告](docs/ai-cookierift-2026-10-10.md)。
2026-10-16 AI末場陷阱保命決策修正：以實際支付與正式效果執行器投影陷阱方案，修正固定失敗 seed 的 ST3-019 保命及藍色 BS6-085 減傷；GPT-6.1 Sol複核未發現P0～P3。26副牌、兩個seed cohort的 matched AI-vs-AI 矩陣，相對修正前 policy 為2,871／2,745勝（5,616場，51.12%），相對凍結基準為2,848／2,768（5,616場，50.71%）；僅是固定AI矩陣描述，不代表統計顯著或真人勝率。詳見[AI牌組與決策報告](docs/ai-cookierift-2026-10-10.md)。
2026-10-16 Cookierift #1127 Purple Arena 已加入AI牌組、選單與Lv.5 benchmark：60張主牌／4張EXTRA，28筆印刷分支strict verified；27個選單選項桌機／平板54／54 Browser PASS。兩組matched holdout共6,048場，候選3,074勝、基準2,974勝（50.83%）；指定#1127時候選99／224、基準100／224，結果屬描述性資料。來源與逐色結果見[AI牌組與決策報告](docs/ai-cookierift-2026-10-10.md)。
2026-10-17 ST9-009依使用者於10/16轉述的官方裁定完成驗收：ST9-006 Then 的`<discard 2 cards>`成本算Sea Fairy效果，實付棄置Wave Drop會觸發；ST6～ST10目前100正式／0候選，ST9-009 strict 1 verified。正式卡池本機Browser桌機／平板14／14 PASS，定向4檔／23項、完整Vitest 1,054檔／21,115項全數通過（1,417.83秒、exit0）、build及卡池檢查通過。排除`output/`、`.tmp*`與附件產物後的正式程式碼範圍ESLint通過；未排除產物的`npm.cmd run lint`因既有未追蹤`.tmp-vitest-ai-seeded-shuffle-debug-20261016/replay.ts`中8個`no-explicit-any`錯誤而exit1，不能列為全域lint通過。Browser為本機test-state，不代表逐卡online或完整對局。
2026-10-15 AI Lv.3 黑色牌組連動修補：以 Cookierift-506 的 BS11-092 Licorice 降級，解鎖 BS11-113 Venom Dough 特殊登場作真實牌組回歸；Lv.3 不再錯過免費降級；BS11-092也不再承受unsupported -8罰分。定向4檔／49項、build（2,202 modules）、全域lint、完整Vitest 1,052檔／21,055項（1,446.65秒）及標準AI Browser 6／6通過；GPT-6.1 Sol複核未見阻擋問題。此Lv.3修補未以專屬Lv.3 matched benchmark隔離評估。詳見 docs/ai-cookierift-2026-10-10.md。
2026-10-15 Cookierift六色Lv.5策略 holdout：19副牌（12副社群六色構築、7副BS12參照）以兩組不重疊seed完成3,040局；候選1,539勝、基準1,501勝（50.63%），760組初始預檢及3,040組逐局parity通過，0失敗／未完成／動作上限。這是固定矩陣AI-vs-AI描述性結果，不代表統計顯著或人類勝率，也不能歸因到Lv.3修補。詳見 docs/ai-cookierift-2026-10-10.md。
2026-10-15 ST10-017／018／020 已依原圖與真實流程逐卡驗收並以三卡隔離stage promote；ST6～ST10目前99正式／1候選，僅ST9-009仍needs-review。017陷阱可選0～3張牌庫頂牌入棄牌區，018續效果可回收己方棄牌區紫色LV.3餅乾，020可放置後休息自身並棄置0～1張己方紫色LV.1戰鬥餅乾。正式Browser桌機／平板26／26、9檔224項定向回歸與GPT-6.1 Sol複核通過；最新全套1,052檔／21,055項、全域lint、build均exit0。Browser為本機test-state，不代表逐卡online或完整對局；未commit／push。資料與完整分層證據見 docs/st6-st10-card-inventory.md。

2026-10-15 Cookierift #801 Garena（Chaeryo，2026-10-12更新）已保存原始60張主牌／6張EXTRA並加入AI選單；桌機／平板開局Browser 24／24、定向測試35項及build通過。社群牌組12副涵蓋六色，綠色三種。來源與證據見[AI牌組紀錄](docs/ai-cookierift-2026-10-10.md)及`output/ai-cookierift/community-browser/results.json`。
2026-10-15 AI移動目標修補後matched比較：7副BS12與12副Cookierift牌組、19副／190組配對、2 seeds×4次座位／先手交換，共1,520場；380組局面預檢與1,520場逐局parity全通過，0失敗／未完成／500動作上限。候選與修補後公平基準各760勝（50.00%）；此為固定矩陣AI-vs-AI描述性結果，不代表人類勝率或統計顯著改進。Build（2,202 modules）、標準AI Browser 6／6、完整Vitest 1,049檔／21,015項（1,408.02秒）通過。報告：`output/ai-cookierift/matched-comparison-movementfix-fairbaseline-seed-202610151.json`。
2026-10-15 AI公開條件無效陷阱守衛：所有AI等級都會略過缺少戰鬥區顏色見證、根效果必定無效的BS12-105；33項陷阱局面測試通過（含Lv.1／2在無效候選後選用ST8-018），受影響ESLint通過。完整Vitest 1,050檔／21,034項、build與標準AI Browser 6／6是在新增最後兩項候選順序測試前通過；Browser僅驗一般UI。三組matched run去重後3,800局，候選1,908勝／基準1,892勝（50.21%），固定矩陣只呈現描述性小幅差異，未證明穩定或人類勝率提升；詳見 docs/ai-cookierift-2026-10-10.md。
2026-10-15 ST10-014 Lunar Compendium、ST10-015 Essence of Moonlight、ST10-016 Delicate Glass Flower 已依官方原圖與印刷文字逐卡驗收，並由僅含三卡的 promotion-ready 隔離 stage promote；ST6～ST10目前**96正式／4候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 19／1、ST10 17／3）。014 支付P及1張己方紫色LV.1戰鬥餅乾作代價後可對0～1對手餅乾造成1傷害；015支付PP，己方戰鬥區或棄牌區有 Moonlight Cookie 時可選0～4對手餅乾，將各自最上層1張HP移入其擁有者棄牌區；016支付P後若己方棄牌區達15張可造成1傷害，Item先進棄牌區計數，因此原有14張可生效，13張則付款後無效果。三張候選與正式 strict audit各為1 verified／0 needs-review／0 blocked，promote前後 sourceHash一致；正式 Browser 桌機1366×768／平板1164×777共16／16 PASS、0錯誤，使用746×1038原圖並覆蓋代價不足、兩種Moonlight見證及15／14／13張門檻。GPT-6.1 Sol唯讀複核無P0～P2。候選驗證5檔／4張inventory、`validate:cards` 95檔／2,176卡號／2,120轉換、registry check、promote後build（2,198 modules）及全域ESLint通過；定向回歸85項、轉接3項皆通過。promote後完整Vitest首跑發現轉接測試仍只讀候選彙總，已修成正式卡池優先、候選回退，最終全套1,046檔／20,960項PASS（1,366.60秒）。Vite仍提示game-demo大型chunk。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：`data/cards/official-st10-014-016.en.json`；strict：`output/st6-st10/ST10-014-contract-formal-20261015.json`等三份；Browser：`output/st6-st10/st10-014-016-browser/results.json`。
2026-10-15 ST10-012 Taurus Cookie 已依原圖完成逐卡驗收並正式化；ST6～ST10目前**93正式／7候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 19／1、ST10 14／6）。印刷為紫色FLIP、LV.3／4HP、PPPP普通攻擊4；實際BS6-017攻擊揭示後，棄1張任意手牌使此HP承載者補1HP，無手牌不能發動且可略過。候選與正式strict audit各1 verified／0 needs-review／0 blocked；候選驗證5檔／7張inventory、`validate:cards` 94檔／2,173卡號／2,117轉接、registry check、build（2,196 modules）通過。專項1檔／5項及定向ESLint通過；正式卡池本機Browser桌機1366×768／平板1164×777共4／4 PASS，原圖746×1038實際載入、正常點擊付款／略過、決策與結算截圖共8張，無console／頁面錯誤。GPT-6.1 Sol最終複核無P0～P2；完整Vitest留待本批末執行。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：`data/cards/official-st10-012.en.json`；strict：`output/st6-st10/ST10-012-contract-formal-final-20261015.json`；Browser：`output/st6-st10/st10-012-browser/results.json`。
2026-10-15 ST10-011 Cream Unicorn Cookie 已依原圖、印刷屬性及實際普通攻擊逐卡驗收並完成單卡 promote；ST6～ST10目前**92正式／8候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 19／1、ST10 13／7）。原圖為紫色 LV.2／4HP，NNN普通攻擊3，無技能／Then／FLIP。候選與正式strict audit皆`verified=1 / needs-review=0 / blocked=0`；正式Browser桌機1366×768／平板1164×777共4／4 PASS，實付三張原始支援、目標6→3HP且來源維持4HP；僅兩張支援時沒有攻擊命令、區域不變。專項1檔／4項、promotion-ready候選stage 1檔／1卡、候選驗證5檔／8張inventory、`validate:cards` 93檔／2,172卡號／2,116轉接、registry check、build（2,194 modules）通過。GPT-6.1 Sol唯讀複核無P0～P3。完整Vitest 1,042檔／20,937項（1,422.04秒）exit0；全域lint因長時間無輸出而中止，不列為通過；定向ESLint通過；Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：`data/cards/official-st10-011.en.json`；strict：`output/st6-st10/ST10-011-contract-formal-20261015.json`；Browser：`output/st6-st10/st10-011-browser/results.json`。
2026-10-15 ST10-010 Prophet Cookie 已依原圖及印刷數值逐卡驗收並完成單卡 promote；目前 ST6～ST10 為 **91 正式／9 候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 19／1、ST10 12／8）。原圖為紫色 LV.1／2HP，只有 N 普通攻擊 1，無技能／Then／FLIP。正式 strict audit `verified=1 / needs-review=0 / blocked=0`；桌機 1366×768／平板 1164×777 本機 Browser 4／4 PASS，實際付1張紫色支援支付 N、對手 6→5HP且來源維持2HP；缺少能量時未產生命令或狀態變化。專項 1 檔／4 項、候選驗證5檔／9張inventory、`validate:cards` 92檔／2,171卡號／2,115轉接、registry check、build（2,192 modules）、本批定向ESLint均通過。GPT-6.1 Sol 關閉候選重複登錄P2，無新增P0～P3；ST10-010／011批末完整Vitest通過1,042檔／20,937項（1,422.04秒）。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：`data/cards/official-st10-010.en.json`；Browser：`output/st6-st10/st10-010-browser/results.json`。
2026-10-15 ST10-006 Blueberry Pie Cookie 已依原圖、印刷屬性與實際離場父流程逐卡驗收，並以單卡隔離stage promote；ST6～ST10目前**89正式／11候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 19／1、ST10 10／10）。印刷效果為【Your Turn】此餅乾由己方戰鬥區直接進棄牌時，選0～1對手餅乾造成1傷害；昏厥進休息區及移至Break不屬此觸發。GPT-6.1 Sol規格複核發現ST10-013 Little Star以餅乾支付費用直接棄牌時未接續離場技能，已修正並以實際P費用重驗；候選、stage、正式strict各1 verified／0 needs-review／0 blocked，候選與stage sourceHash一致。正式桌機1366×768與平板1164×777 Browser 8/8 PASS，涵蓋正向指定／選零、Little Star代價送棄牌、對手回合不觸發與原圖載入。專項3檔／10項，離場規則與Item／Stage回歸5檔／79項；validate:cards（90檔／2,169卡號／2,113轉換）、候選驗證（5檔／11張inventory）、registry check、build（2,188 modules）、全域ESLint及完整Vitest 1,037檔／20,901項（1,352.41秒）均exit0；Vite仍提示game-demo大型chunk。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：data/cards/official-st10-006.en.json；Browser：output/st6-st10/st10-006-browser/results.json。
2026-10-15 ST10-005 Dreamcatcher 已依原圖、印刷資料與真實 On Play 流程逐卡驗收，並以僅含此卡的隔離 stage promote；ST6～ST10目前**88正式／12候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 19／1、ST10 9／11）。ST10-005支付棄1張任意手牌後，僅在己方戰鬥區有Moonlight Cookie時可對0～1對手Cookie造成1傷害；正反條件、付款後檢查、選零、缺代價不可發動及P普通攻擊實際支付／錯色反例均已驗證。候選、stage、正式strict均verified=1／needs-review=0／blocked=0且sourceHash一致；正式桌機1366×768與平板1164×777 Browser 10/10 PASS。GPT-6.1 Sol複核關閉強制點擊P2，未見新P0／P1／P2。專項2檔／9項、validate:cards（89檔／2,168卡號／2,112轉接）、候選驗證（5檔／12張inventory）、registry check、build、全域ESLint與完整Vitest 1,034檔／20,891項（1,396.76秒）均exit0；Vite仍提示game-demo大型chunk。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：data/cards/official-st10-005.en.json；Browser：output/st6-st10/st10-005-browser/results.json。
2026-10-15 ST10-001 Dreamweaver Cookie、ST10-003 Poison Mushroom Cookie、ST10-004 Wizard Cookie 已依原圖與印刷資料逐卡驗收，並以隔離 stage 逐卡 promote；ST6～ST10目前**87正式／13候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 19／1、ST10 8／12）。001／003支付PPP完成普通攻擊3，001 FLIP只回手揭示卡、003抽0～1；004支付P可將實際攻擊轉向自身，Wizard 3→2 HP且原目標不受傷，亦驗證付PN普通攻擊1使Devil Cookie 4→3 HP。004候選、stage、正式strict均verified=1／needs-review=0／blocked=0且sourceHash一致；正式桌機1366×768與平板1164×777 Browser 10/10 PASS，涵蓋使用／略過Blocker、無紫能量、PN支付與缺N；001／003正式Browser 14/14 PASS。GPT-6.1 Sol指出的舊driver P2及ST10-004普通攻擊驗收缺口均已修正並複查關閉。ST10-004專項4檔／32項、validate:cards（88檔／2,167卡號／2,111轉接）、候選驗證（5檔／13張inventory）、registry check、build、全域ESLint與完整Vitest 1,032檔／20,882項（1,353.40秒）均exit0；Vite仍提示game-demo大型chunk。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：data/cards/official-st10.en.json；Browser：output/st6-st10/st10-004-browser/results.json。
2026-10-15 ST9-015 Essence of the Ocean 依原圖與印刷資料逐卡驗收，以只含此卡的隔離 stage promote；ST6～ST10目前**84正式／16候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 19／1、ST10 5／15）。支付B後，僅在使用後手牌至多5張時抽0～1；Then獨立選0～1己方剩餘HP至多5的Sea Fairy Cookie補1。候選、stage及正式strict皆`verified=1 / needs-review=0 / blocked=0`，sourceHash一致；正式Browser桌面1366×768／平板1164×777共10/10 PASS，包含手牌門檻、抽牌0／1、Then與零目標，並以己方非Sea Fairy、對手Sea Fairy及6HP Sea Fairy驗證候選排除。GPT-6.1 Sol複核未發現P0／P1／P2。專項3檔／17項、`validate:cards`（86檔／2,164卡號／2,108轉接）、候選驗證（5檔／16張inventory）、registry check、build、全域lint及完整Vitest 1,026檔／20,848項（1,388.05秒）均exit0。ST9-009仍因缺少已確認的Sea Fairy效果棄牌來源而保留待複核。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：`data/cards/official-st9-015.en.json`；契約：`output/st6-st10/ST9-015-contract-formal-20261015.json`；Browser：`output/st6-st10/st9-015-browser/results.json`。
2026-10-14 ST9-014 Glittering Pearl Shell 已依原圖及印刷資料逐卡驗收，並以只含此卡的隔離stage promote；ST6～ST10目前**83正式／17候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 18／2、ST10 5／15）。印刷為藍色道具：支付BB、棄3張牌後選0～1己方Cookie補2HP。候選、隔離stage及正式strict均`verified=1 / needs-review=0 / blocked=0`，sourceHash一致。正式Browser桌面1366×768／平板1164×777共10/10 PASS，包含實際支付與3張異類手牌代價、選一／零目標、取消草稿及無支援／手牌不足的負向路徑；原圖與命令紀錄核對。專項3檔／17項、正式資料驗證（85檔／2,163卡號／2,107轉接）、候選驗證（5檔／17張inventory）、registry check、build、全域lint及完整Vitest 1,023檔／20,831項（1,383.11秒）均exit0。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：`data/cards/official-st9-014.en.json`；契約：`output/st6-st10/ST9-014-contract-formal-final-20261014.json`；Browser：`output/st6-st10/st9-014-browser/results.json`。
2026-10-14 ST9-013 Shimmering Moonlit Coral 已依原圖及印刷資料逐卡驗收，並以只含此卡的隔離stage promote；ST6～ST10目前**82正式／18候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 17／3、ST10 5／15）。印刷為藍色道具：支付B並另棄1張藍色手牌後抽0～2張。候選、隔離stage及正式strict均`verified=1 / needs-review=0 / blocked=0`，sourceHash一致。正式Browser桌面1366×768／平板1164×777共12/12 PASS，含抽0／1／2、付款草稿取消且區域不變、重開仍有相同合法候選、缺藍色手牌／支援時禁止使用；原圖與實際命令紀錄已核對。專項3檔／17項、正式資料驗證（84檔／2,162卡號／2,106轉接）、候選驗證（5檔／18張inventory）、registry check、build及定向ESLint均exit0；批末完整Vitest 1,020檔／20,814項PASS（1,314.73秒，exit0）。GPT-6.1 Sol複核提出的付款草稿期間區域不變P2已由Browser補證並確認關閉，未發現新的P0／P1／P2。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：`data/cards/official-st9-013.en.json`；契約：`output/st6-st10/ST9-013-contract-formal-final-20261014.json`；Browser：`output/st6-st10/st9-013-browser/results-formal-accepted-20261014.json`。
2026-10-14 ST9-012 White Pearl Cookie 已依原圖與印刷資料逐卡驗收，並以只含此卡的隔離stage promote；ST6～ST10目前**81正式／19候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 16／4、ST10 5／15）。LV1／HP2；On Play 手牌至多4張時抽0～2；BB普通2後可選擇由支援區支付B，且僅在己方戰鬥區有Sea Fairy Cookie時，對0～1對手Cookie造成1傷害。候選／正式strict均`verified=1 / needs-review=0 / blocked=0`且sourceHash相同；雙尺寸正式Browser 18/18 PASS，含登場後剛好4張手牌、抽0／1／2、高手牌、Then支付／零目標／略過、只剩實體紅色支援不得支付藍色B、缺Sea Fairy等路徑。專項3檔／19項、`validate:cards`（83檔／2,161卡號／2,105轉接）、候選驗證（5檔／19張inventory）、registry check、build與完整Vitest（1,017檔／20,797項，1,347.63秒）exit0；定向ESLint與Browser腳本語法檢查通過。全域lint執行逾7分鐘無輸出後中止，不列為通過。Browser是本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：`data/cards/official-st9-012.en.json`；正式契約：`output/st6-st10/ST9-012-contract-formal-20261014.json`；Browser：`output/st6-st10/st9-012-browser/results.json`。
2026-10-14 ST9-010～011 已依原圖及印刷資料逐卡驗收，並以只含兩張卡的隔離stage promote；ST6～ST10目前**80正式／20候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 15／5、ST10 5／15）。兩張藍色FLIP（Parfait Cookie HP1、Frilled Jellyfish Cookie HP4）均驗證玩家實際棄1張手牌後附著餅乾補1HP，無手牌時可選擇不發動；候選及正式strict各`verified=1 / needs-review=0 / blocked=0`且sourceHash一致。正式Browser桌面／平板共8/8 PASS，專項5檔／30項、build、正式／候選資料與registry檢查、完整Vitest 1,014檔／20,778項（1,307.25秒）exit0；本批變更檔定向ESLint通過。全域lint長時間無輸出後中止，不列為通過。ST9-009仍留候選needs-review；Browser為本機test-state，不代表逐卡online、完整對局勝負或玩家勝率；未commit／push。正式檔：`data/cards/official-st9-010-011.en.json`；Browser：`output/st6-st10/st9-010-011-browser/results.json`。
2026-10-14 ST9-007～008 已依原圖與印刷資料逐卡驗收，並以只含兩張卡的隔離stage promote；目前ST6～ST10為**78正式／22候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 13／7、ST10 5／15）。兩卡候選及正式strict各`verified=1 / needs-review=0 / blocked=0`；正式Browser 10/10 PASS（桌面1366×768、平板1164×777），涵蓋ST9-007手牌條件與抽0／1、ST9-008合法Cookie回手後來源補1HP及無合法代價時略過On Play。正式資料驗證81檔／2,158卡號／2,102轉接，候選驗證5檔／22張inventory、registry check與build通過；批末完整Vitest 1,011檔／20,762項PASS（1,303.40秒、exit0）。最新改動檔定向ESLint與`git diff --check` exit0；本次全域lint長時間無輸出後中止，不能列為通過。ST9-009 Wave Drop 仍留候選：strict為1張needs-review，因目前Sea Fairy手牌棄置是尖括號代價或移至牌庫底，沒有已確認的效果將手牌卡送進棄牌區；先前把ST9-006代價當正向觸發的探索Browser已撤回驗收並保留紀錄。GPT-6.1 Sol複核未發現手牌觸發佇列修補的新P0／P1／P2。Browser為本機test-state，不代表逐卡online、完整對局勝負或玩家勝率；整體AI勝率仍未證明。未commit／push。正式資料：`data/cards/official-st9-007-008.en.json`；Browser證據：`output/st6-st10/st9-007-009-browser/results.json`。
2026-10-14 ST9-004～006 已依原圖／印刷資料逐卡驗收並以三卡隔離stage promote；目前ST6～ST10為**76正式／24候選**，ST9為11正式／9候選。三張正式strict均`verified=1 / needs-review=0 / blocked=0`，正式Browser桌面／平板共18/18 PASS；定向9檔／54項、build、全域lint、候選／正式資料與registry檢查，以及完整Vitest 1,008檔／20,741項（1,370.30秒）皆exit0。ST9-006 Then UI要求選齊全部合法對手Cookie後才可確認；ST9-004防守方FLIP與ST9-005 Blocker付款亦依實際攻擊操作。Browser為本機test-state，不代表逐卡online、完整對局至勝負或玩家勝率；AI整體勝率仍未驗證。未commit／push。證據：`data/cards/official-st9-004-006.en.json`、`output/st6-st10/st9-004-006-browser/results.json`。

2026-10-14 Cookierift 六色構築更新：採用最新公開快照新增 Taipei Arena [BS12 Black]（#16）與 Rarena（#731），並刷新 Yellow #67；目前可用11副社群牌組涵蓋六色。Forky（#51）已保存來源，但因主牌含尚未正式匯入的 ST10-006，隔離於選單與基準之外。Browser 實際開啟選取牌組並比對完整主牌／EXTRA 清單，桌面與平板共22／22 PASS。經來源清單與規則／資料雜湊比對的1,224場AI對AI基準 PASS，候選／基準各612勝，初始局面306組與逐場狀態1,224組一致，失敗／未完成／動作上限皆0；這證明本次牌組擴充沒有破壞該矩陣的同局面比較，不代表AI整體或對玩家勝率提升。候選與基準皆305個bundle輸入、257個規則／資料輸入雜湊一致。完整Vitest 997檔／20,697項全部通過（1,399.27秒、exit0）。報告：`output/ai-cookierift/matched-comparison-20261014T061040794Z-29004-d17a6347.json`；牌組來源：`data/decks/cookierift-community-20261014.json`。

2026-10-14 ST9-001～003 已逐卡驗收並由只含三卡的隔離stage promote：目前**73正式／27候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 8／12、ST10 5／15）。正式Browser 12/12 PASS（桌面／平板各6案），三張各strict verified；ST9-003真實攻擊翻出自身FLIP、命令紀錄確認Blue Whale發動FLIP，對手手牌增加1、攻擊目標結算至1HP。正式卡池79檔／2,153卡號／2,097轉接，候選5檔27卡仍為inventory；promote後build、候選／正式資料與registry檢查通過。全域lint重跑exit0；完整Vitest 1,002檔／20,717項PASS（1,425.66秒、exit0）。Browser僅本機test-state流程，不代表online、完整對局或玩家勝率。證據：`output/st6-st10/st9-001-003-browser/results.json`與三份`ST9-00x-formal-contract-20261014.json`。

2026-10-14 ST9-020 Tearcrown 已依原圖、印刷資料與實際指令逐卡驗收並單卡 promote：**70正式／30候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 5／15、ST10 5／15）。正式卡池78檔／2,150卡號／2,094轉接；候選5檔30卡全為inventory。ST9-020 strict `verified=1 / needs-review=0 / blocked=0`，正式Browser 6/6 PASS，桌面1366×768及平板1164×777皆驗證原圖、B放置支付、REST啟動、抽0／1與手牌超過3仍付款但跳過抽牌。候選／正式sourceHash一致；validate:cards、候選驗證、registry check、build、全域lint及完整Vitest 997檔／20,691項PASS（1,385.73秒、exit0）。Browser為本機test-state，不代表逐卡online、完整對局至勝負或玩家勝率；AI整體勝率尚未證實。未commit／push；ST9其餘卡、ST10候選與AI決策品質工作仍待完成。證據：`output/st6-st10/ST9-020-formal-contract-20261014.json`、`output/st6-st10/st9-020-browser/results.json`、`output/st6-st10/st9-020-full-vitest-20261014.log`。

2026-10-14 ST9-017～019 已逐卡驗收並單卡promote：**69正式／31候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 4／16、ST10 5／15）。正式卡池77檔／2,149卡號／2,093轉接；候選5檔31卡全為inventory。三卡strict各`verified=1 / needs-review=0 / blocked=0`，正式雙尺寸Browser 12/12通過，實際核對原圖、印刷成本、目標、Then與傷害結算；build、正式資料／registry、候選驗證及完整Vitest 994檔／20,681項（1,313.80秒）exit0。共用命令紀錄器修正已排隊的 Then 效果仍誤標「未選擇目標／效果未生效」；本次新增回歸，6檔85項通過。全域lint本次長時間無輸出後中止，修改檔定向ESLint通過，不能列全域lint通過。Browser僅為本機test-state卡牌流程，不代表逐卡online、完整對局勝負或玩家勝率；AI整體勝率提升尚未證實。未commit／push；ST9-020及其餘候選、AI品質工作仍待完成。

2026-10-13 ST8-011 已逐卡 promote 並正式重驗，**58正式／42候選**（ST6 20／0、ST7 20／0、ST8 12／8、ST9 1／19、ST10 5／15）。原圖Kiwi Cookie綠LV1／HP3、GN普通1，G Blocker將攻擊轉向本來源，不加REST來源／Once／YourTurn／FLIP／Then。正常adapter已符合卡面；補精確契約後，原先21個漏拒變異修復，53種有效錯誤runtime全拒，58項契約測試通過。候選最終3檔171項、契約共享5檔185項及Blocker共享4檔64項、正式13檔450項通過。候選與正式各80案雙尺寸Chrome、各4案實際Lv5，完整初始／真實父命令／最終GameState與canonical紀錄的獨立重播及來源指紋通過。真1／2／3普通傷害、疲勞來源可Block、同回合真第一次Block父流程後再付第二張G、雙Kiwi已是原目標者不可再Block、唯一餅乾真昏厥後強制補位及最後牌庫Refresh均驗。GN第二支援分別實際支付六種顏色；新增卡色斷言抓到原測試假黑素材，已依正式raw與原圖改成BS11-092 BLACK，失敗run與斷言完整保留。Lv3～5真G支付保護原本會被2傷害擊倒的HP2餅乾，Kiwi由HP3降1；缺G只有紅支援則合法略過，未宣稱對人類勝率提升。正式build／受影響lint／72檔2138卡號2082轉接／registry／strict／標準AI Browser／ST1核心同步通過。完整Browser首輪15PASS後因棄牌區下方Kiwi原圖定位逾時失敗，改經正常公開棄牌viewer核圖，再整輪重驗；不以partial或放寬圖像檢查通過。012原圖與付款規格覆核準備：沿目前通用專案規則選活躍支援G付款，不是新增個別官方FAQ裁定，012仍未驗收。既有7張正式卡仍待本輪重驗；官方五組各60張已確認，但精確逐卡配比仍缺官方來源，未猜測填入。本批010～012全域lint／完整Vitest仍待批末；上一批007～009修後組合驗證不涵蓋本批且沒有新的全套exit0。逐卡online、完整UI開局至勝負及對人類勝率未驗收，未commit／push。證據：output/st6-st10/st8-011-promotion.json、output/st6-st10/st8-011-browser-candidate-run2/independent-replay-audit.json、st8-011-browser-formal-run1/independent-replay-audit.json、st8-012-payment-spec-review.md。

2026-10-13 ST8-010 已逐卡 promote 並正式重驗，**57正式／43候選**（ST6 20／0、ST7 20／0、ST8 11／9、ST9 1／19、ST10 5／15）。原圖 Cookiemals 綠LV1／HP2、G普通1；昏厥先將己方支援恰好1張任意色／可已橫置的物品卡回手作代價，再選牌庫頂0～1張放入支援疲勞，沒有Then／FLIP／Once／YourTurn。補齊原本缺失的技能與物品成本轉接，修正共用昏厥模式必須先付成本；選0仍支付、付款前可不發動、非法命令不改原狀態，保留原父效果／戰鬥與context。55種錯誤runtime全拒絕；候選5檔177項及共享11檔315項、正式17檔522項通過。候選與正式各106案雙尺寸Chrome、各4案實際Lv5，獨立完整初始／真實父命令／最終GameState及canonical紀錄重播與來源指紋通過。真正普通傷害、自己攻擊被Kumiho印刷FLIP1反傷（之前真普通1）、ST7-013實付YY與黃色棄牌餅乾代價的效果傷害、同回合第二張Cookiemals昏厥、空牌庫Refresh、唯一餅乾強制補位均已操作，正常結算無卡死pending。正式build／受影響lint／71檔2137卡號2081轉接／registry／strict／標準AI Browser／ST1核心同步通過；ST1首輪進遊戲前networkidle逾時失敗保留，卡牌Browser終止後同版本隔離重跑通過。ST8-011已原圖與來源準備，尚未驗收；既有7張正式卡仍需本輪逐卡重驗。官方五組各60張已確認，但官方海報沒有逐卡張數且官方商店HTTP429，精確預組配比仍缺來源。上一批007～009完整Vitest首輪955檔20100項有1項舊庫存預期失敗，修後該檔30項與其餘來源未變的954檔組合驗證已保留，沒有新全套exit0；該證據不涵蓋010改動，本批全域lint及完整Vitest仍待批末。逐卡online、完整UI對局與對人類勝率未驗收，未commit／push。證據：output/st6-st10/st8-010-promotion.json、st8-010-browser-candidate-run1/independent-replay-audit.json、st8-010-browser-formal-run1/independent-replay-audit.json。

2026-10-13 ST8-009 已逐卡 promote 並正式重驗，**56正式／44候選**（ST6 20／0、ST7 20／0、ST8 10／10、ST9 1／19、ST10 5／15）。原圖 Cucumber Cookie 綠LV2／HP3、GGG普通3，免費HP FLIP抽0～1，沒有Skill／Then／手牌門檻或補HP；48種錯誤runtime全拒絕。候選最終5檔149項／共享6檔313項、正式12檔377項、build／受影響lint／資料70檔2136卡號2080轉接／registry／strict／標準AI Browser／ST1核心同步皆PASS。候選與正式各102案雙尺寸Chrome、各4案實際Lv5，主代理獨立完整初始狀態、真實父命令、最終GameState與紀錄重播及來源指紋PASS；兩層不重複累加。兩張不同instance FLIP各自選0／1、真正最後牌庫Refresh、最後HP仍昏厥、新抽Goblin真補位及原印刷OnPlay略過均已操作。發現test-state捷徑會略過第二FLIP，修成公開卡牌／預組preview逐點續接；一般對局不走該捷徑，未推稱production同缺陷。原失敗與修復證據完整保留，未放寬斷言。ST8-010來源核對確認Quick Roll尚未轉接、Item支援回手成本尚未分類；僅來源準備，不算驗收。既有7張正式卡仍需本輪逐卡重驗。官方五組各60張已確認，但目前官方海報無逐卡張數且官方商店HTTP429，精確預組配比仍缺來源，未猜測填入。批末完整Vitest首輪955檔／20100項：954檔20099項通過，僅1項舊庫存預期失敗（exit1保留）。獨立原始資料核對2080印刷／1597機制後，盤點測試改為嚴格對照正式來源並補008／009能力檢查，該檔30項及lint通過；其餘1823項來源指紋完全相同，沿用954檔通過證據。全域lint通過；修後未重跑全套，此為組合驗證，沒有新的全套exit0。逐卡online、完整UI對局與對人類勝率未驗收，未commit／push。證據：output/st6-st10/st8-009-full-acceptance.json、st8-009-ai-inventory-check.md、st8-009-promotion.json、st8-009-browser-candidate-run1/independent-replay-audit.json、st8-009-browser-formal-run1/independent-replay-audit.json、starter-recipes-source-report.md。

2026-10-13 AI純補HP FLIP付款修正已採用：真實BS9-035先棄1Activate禁止對手補HP，再由Devil Cookie NNN3揭示ST8-007；公開禁止補HP且僅有一般付費棄牌／純補HP時，AI預設略過無效支付，保留免費、detached、特殊代價與其他有效效果。正式失敗基線9失敗／36通過，最終6檔199項、build3／受影響lint4／標準AI Browser通過；真實父流程手動與actualLv5雙尺寸4案、完整獨立重播通過，兩案AI保留手牌並正常補位。相同規則舊／正式新策略9個Lv3～5決策各保留1手牌、HP與牌庫相同；不代表整體或人類勝率改善。ST6～ST10仍54正式／46候選。ST8-008仍候選：兩段效果皆缺，支援區具名條件須新增，且AI支援差值用<與權威<=不一致，待整合與逐卡驗收。最新完整Vitest940檔／19627項屬ST8-006批末，未含ST8-007與本次AI，後續批末須回歸；未commit／push。證據：output/st6-st10/ai-blocked-hp-flip-acceptance.json、ai-blocked-hp-flip-current-policy-comparison.json。

2026-10-13 ST8-007 已逐卡 promote 並正式重驗，**54正式／46候選**（ST8 8／12）。候選run2與正式run1各74案雙尺寸Chrome、各含8案實際Lv5，主代理獨立完整父指令／最終狀態重播與關鍵畫面核對通過；正式4檔124項、共享5檔210項、build／受影響lint／資料／registry／單卡strict／標準AI Browser皆PASS。使用者授權的兩agent分工完成driver審查及候選／正式Chrome、公開禁止補HP下AI無效支付反例；AI新舊原型9個真實父流程省下1手牌、18個隱藏牌置換比較及15個反例PASS，尚未套入正式政策或證明勝率提高。最新完整Vitest940檔／19627項屬ST8-006批末，不含ST8-007，後續批末須回歸。未commit／push，逐卡online與完整UI對局未驗收。證據：output/st6-st10/st8-007-promotion.json、st8-007-browser-formal-run1/replay-audit.json、ai-blocked-hp-flip-policy-review.md。下方53／47為較早快照。

2026-10-13 ST8-006批末完整回歸已完成：**940檔／19,627項全部通過**，1061.35秒、exit0；全域lint exit0，1800份來源／設定／資料指紋一致，來源凍結解除。包含ST8-005紀錄／REST動畫修正與ST8-006正式卡池驗收；後續ST8-007候選修改不包含在此全套。ST6～ST10仍53正式／47候選；ST8-007專用2檔94項、build／受影響lint／單卡strict通過，雙尺寸74案Browser進行中，尚未promote。使用者授權後加派兩agent，分別負責Browser草稿與實際驗收、純補HP FLIP的AI反例證據；主代理整合與核驗，未commit／push。證據：output/st6-st10/st8-006-full-acceptance.json、st8-007-candidate-targeted2.log。

2026-10-13 ST8-006 Basil Pesto Cookie 已逐卡驗證並 promote，ST6～ST10 為 **53正式／47候選**（ST8 7／13）。原圖綠色LV3／HP4、GGGG普通4、FLIP棄恰好1張任意手牌後僅HP承載者補1；候選與正式雙尺寸Chrome各72案、各含8案實際Lv5，完整父指令及最終狀態獨立重播通過。專用91項、正式4檔122項與通用網址4項通過；build、資料、registry、單卡strict、標準AI Browser通過。批末完整Vitest與全域lint正在執行，1800份來源／資料／設定已凍結；尚未宣稱全套通過。測試首輪因沙箱暫存檔rename權限未能執行，改用本機環境重跑通過，失敗證據保留。未commit／push；逐卡online與完整UI對局未驗收，局部Lv5結果不代表對人類勝率。證據見 output/st6-st10/st8-006-browser-formal-run1/replay-audit.json、st8-006-promotion.json。下方52正式及未promote敘述為較早快照。

2026-10-13 ST8-005 呈現修正：使用者確認自身HP未減少，但攻擊後紀錄將額外橫置支援與傷害目標混列，且效果REST動畫朝來源餅乾移動。已分列「額外橫置支援／傷害目標」，效果REST留在支援區，普通攻擊能量支付動畫保留；失敗基線6項中5項失敗，修後6檔116項、build及受影響lint通過。使用者原網址標準動畫4案（直接攻擊／先物品×雙尺寸）、完整指令／狀態重播通過，自身維持6HP；正式建置同組4案與標準AI Browser皆通過，來源及驗收範圍見 output/st6-st10/st8-005-presentation-acceptance.json。先前完整Vitest已936檔／19525項PASS、1129.09秒、exit0，1794份來源指紋一致；這份全套屬本次呈現修正前，後續批末需再回歸。全域lint run2 PASS，輸出區三項未使用匯入修正已另留證據；最終呈現三檔lint另通過。仍52正式／48候選，ST8-006只完成原圖、8條隔離fixture及23項精確契約原型（舊generic接受21項錯誤runtime），未驗收或promote。未commit／push。證據：output/st6-st10/st8-005-manual-full-acceptance.json、st8-005-presentation-green2.log、st8-005-presentation-browser-dev-run1/results.json、st8-006-contract-prototype-checks.json。以下未完成全套與仍在執行中的敘述為較早快照。

2026-10-13 使用者手動驗證入口已更新：card:ST8-004 預設由手牌登場、配置印刷5HP，再GGG普通3及活躍支援；card:ST8-005 預設手牌含真實ST1-016物品，先RR支付、再免費Once抽1、GGG攻擊與Then追加傷害，大小寫皆可。兩張卡×大小寫×雙尺寸共8案在dev與正式建置各通過，完整父指令及獨立狀態重播一致；原圖完成解碼，使用者提供ST8-005原圖雜湊一致。相關8檔687項、build／受影響lint／標準AI Browser通過。卡池稽核逾時已定位並修正為效果表只建構一次、五種依記錄計算的效果保留factory，回傳獨立副本；2132份正式轉接JSON逐筆一致，量測約14.5秒→2.4秒，不提高timeout。全域lint仍執行中，完整Vitest已啟動並凍結1794份來源／設定／資料；尚未有全套終值，仍52正式／48候選，未commit／push。證據：output/st6-st10/st8-004-005-manual-acceptance.json。下方入口尚未調整及逾時未解的敘述屬較早快照。

ST8-005 已逐卡驗證後 promote，目前 **52正式／48候選**（2026-10-13）。候選與正式雙尺寸 Chrome 各78案（各含8案實際Lv5）、完整指令／狀態重播通過；34種錯誤runtime均被精確契約拒絕。使用者回報的小寫 card:st8-005 崩潰已重現並修正：正規化卡號，且正式通用入口沿用實體卡fixture；原網址大小寫、桌機／平板4案實際支付及Then結算通過。入口與通用局面323項、最終build／受影響lint／標準AI Browser通過；全卡池能力稽核仍有1項超過5秒門檻，完整Vitest尚未重驗；下方930檔結果屬ST8-004。三案Lv3～5對照修正漏掉立即擊倒並保留支援，不代表整體或人類勝率提升。詳見 docs/st6-st10-card-inventory.md；未commit／push。

2026-10-13 ST8-004 批末驗收完成：ST6～ST10為 **51正式／49候選**。完整Vitest **930檔／19,420項全數通過**，1983.85秒、exit0；1786份來源／設定／資料指紋一致，凍結解除。正式雙尺寸Chrome48案（含4案實際Lv5）、完整指令／狀態重播、399項相關測試、build／全域lint／資料／registry／標準AI Browser皆通過，證據來源重查一致；中斷run1不列通過。下一張ST8-005原圖已再核對；輸出區轉接／守衛／AI原型19案規則條件、3案Lv3～5 Then、15案AI邊界及34種錯誤runtime拒絕通過，隔離app型別零診斷；尚未套入產品或Browser驗收，不納入上述完整Vitest或promote數量。詳見 docs/st6-st10-card-inventory.md；未commit／push，逐卡online、完整UI對局及對人類勝率尚未驗證。證據：output/st6-st10/st8-004-full-acceptance.json、st8-005-preparation-summary.json。以下為較早快照。

ST8-004 本輪 Browser 終值：候選桌機／平板 **30／30** 案與完整指令／狀態重播通過，不另加首批重複4案。來源／目標離場UI、實際AI Browser與批末完整回歸待完成，仍未promote。詳見逐卡盤點最新紀錄。

2026-10-13 ST8-004 候選修正進行中：補上「GGG普通3後，己方至少5張支援，活躍0～1張己方支援」的 Then 與精確 strict 守衛。失敗基線19項中12項失敗，修後卡面／變異19項通過；含實體來源昏厥續接、Lv3～5規則決策及相關回歸4檔145項通過。build／受影響lint、首批桌機／平板4案UI與完整重播通過。仍須完成Browser矩陣、實際AI Browser及批末完整回歸，尚未promote；正式進度仍50／100。本輪尚未commit／push，下一步持續此卡驗收；下方927檔全套結果屬ST8-004修正前。詳細證據與待驗範圍見 docs/st6-st10-card-inventory.md。

2026-10-13 本次提交：ST8-002 Muscle Cookie、ST8-003 Leek Cookie 已逐卡驗證並 promote，ST6～ST10 為 **50 正式／50 候選**。正式雙尺寸 Chrome 分別 32／34 案，共 66 案（含 10 案 Lv5）及完整指令／狀態重播通過。build、全域 lint、資料／registry／strict、標準 AI Browser 均通過；完整 Vitest **927 檔／19,369 項全數通過**，1520.19 秒、exit 0，1,781 份來源／設定／資料指紋一致。僅同步文件後沿用此結果，產品來源未再改動。ST8-004 的 Then 與 strict 守衛僅為 output 隔離原型，尚未正式驗收或 promote；下一步先完成該卡。局部 Browser 不代表逐卡 online 或完整 UI 對局；本批未變更 AI 策略，不宣稱整體勝率提升。既有 AGENTS.md 修改與測試產物不納入提交，未 push。證據：output/st6-st10/st8-002-003-full-run1.log、st8-002-003-full-integrity-run1.log、st8-002-003-global-lint-run1.log、st8-002-003-standard-ai-browser.log。以下執行中敘述為本次終值前的歷史進度。

ST8-002／003 本輪進度（2026-10-13）：兩張皆依原圖逐卡驗收後 promote，現為 **50 正式／50 候選**（ST8 4／16）。ST8-003 Leek Cookie 為綠色 LV2／HP4、NNN 普通3，無技能／FLIP；32 項專用與正式相關 6 檔 396 項通過。候選 run2、正式 run1 各 34 案雙尺寸 Chrome（含 4 案 Lv5）、完整狀態／指令重播與原圖覆核通過；六色、混色支付及非法路徑分開驗證。首次 driver 的 AI 昏厥補位時序與首次 promote 的 registry 暫時寫入失敗已保留，重跑通過。兩張的正式 build、受影響 lint、資料／registry／strict 與標準 AI Browser 通過；全域 lint（session 5783）與完整 Vitest（session 91713）執行中，1,781 份來源／設定／資料已凍結，尚未宣稱全套通過。正式資料 64 檔／2,130 卡號／2,074 轉換；AI 既有 unsupported 清單未增。下一張 ST8-004 原圖已核對，但 runtime 缺少攻擊 Then、strict 仍有缺漏，保持候選；待本輪完整回歸結束再修補。局部 Browser 不代替逐卡 online 或完整 UI 對局；本輪未 commit／push，最新既有 commit 為 5b5651e7。證據：output/st6-st10/st8-003-promotion.json、st8-003-formal-browser-run1/replay-audit.json、st8-002-003-full-run1.log、st8-004-readonly-baseline-run2.json。

ST8-002 已逐卡 promote 並正式重驗（2026-10-13）：原圖 Muscle Cookie 綠色 LV2／HP4、GGG 普通3，免費 FLIP 將被揭示卡本身回手，不回收 HP 承載者。26 項卡牌／規則測試、正式相關 5 檔 378 項、build／受影響 lint／資料／registry／strict 通過；候選 run3 與正式 run1 各 32 案雙尺寸 Chrome（含 6 案 Lv5）及全狀態／指令重播通過，不重複累加。兩次 driver 失敗分別為補位 modal 與平板卡片重疊點位，已透過正常 UI 操作修正並保留紀錄。ST6～ST10 現為 49 正式／51 候選；下一張 ST8-003，原圖已核對。新增內容批末完整 Vitest 尚待執行，下方 923 檔結果不涵蓋本卡。局部 Browser 不代替逐卡 online 或完整 UI 對局；本批未 commit／push。證據：output/st6-st10/st8-002-promotion.json、st8-002-formal-browser-run1/replay-audit.json、st8-002-formal-tests-run1.log。

2026-10-13 本次提交範圍：ST8-001 Greenbell Cookie 已依原圖驗證並 promote，ST6～ST10 為 48 正式／52 候選。正式雙尺寸 Chrome 32 案（含 4 案 Lv5）與完整指令重播通過。修正 Cookie Games Stadium 等待 Choco Drizzle 子傷害時互相等待的結算卡死；保留父效果，子傷害完成後只續接一次。原本兩場卡住的綠色鏡像對局均在原 500 動作上限內、221 動作結束。新增 6 項回歸、共享 19 檔 687 項、雙尺寸 Lv5 Chrome 與完整重播、標準 AI Browser、ST1 核心同步、build、lint、registry 與單卡 strict 均通過。完整 Vitest 923 檔／19,309 項全數通過，1500.77 秒、exit 0；1,773 份來源／設定／資料指紋一致。正式資料驗證 62 檔／2,128 卡號／2,072 成功轉換。HP 支付策略原型仍留在 output，未採用；本次不宣稱整體或人類勝率提升。局部 Browser／核心同步不等於逐卡 online 或完整 UI 對局。證據：output/st6-st10/commit-st8-stage-full.log、commit-st8-stage-full-integrity.log、commit-stage-browser.log、commit-standard-ai-browser.log、commit-online-core.log。

ST7-020／AI v22 完整回歸已通過（2026-10-13）：920檔／19271項全部PASS、1782.51秒、exit0；1766份程式／設定／資料指紋一致。Forest of Life已逐卡promote；ST6～ST10為47正式／53候選，ST6與ST7各20張正式。原圖Y放置、Activate Y＋REST、本回合己方實際補HP後可抽0～1；對手／前回合／選0補HP皆不成立。候選run5與正式run2各62案雙尺寸Chrome及62份完整父指令／狀態重播PASS，各含14案實際Lv5，不重複累計。正式17檔526項、共享AI10檔181項、build／全域與受影響lint／資料／registry／單卡strict／ST7能力稽核／標準AI Browser及ST1核心同步PASS。候選清空後JSON推斷never[]已修復；formal build run1與舊dist Browser run1失敗保留，run2為有效證據。AI v22解除攻擊權限誤擋場景候選，無效果／無安全抽牌時保留資源；舊版Lv3～5三項反例失敗，修後22項PASS。728場同規則對照364：364，配對受益5／受損5／互分354，新舊場景啟動92／0，未證明整體或對人類勝率提高。單一worker完整測試的30秒抽樣最高RSS為831.9MiB，8GiB為堆積上限而非實際配置。局部Chrome／核心同步不等於逐卡online或完整UI對局。本次提交保存此驗收範圍，未push；未驗收的HP支付診斷留在output。下一步ST8-001逐卡驗收與AI支付反例驗證。證據：output/st6-st10/ai-v22-st7-020-full-acceptance.json、st7-020-formal-browser-run2/replay-audit.json、ai-v22-stage-safe-benchmark/audit.json。

ST7-019／AI v21 完整回歸已通過（2026-10-13）：917檔／19,179項全部PASS、1449.83秒、exit0；1761份程式／設定／資料指紋一致。原圖Y陷阱、強制手牌餅乾進Break後對0～1對手造成1效果傷害已驗收並promote。修正代價立即達Break10後仍執行效果的核心錯誤及AI自敗支付；85項專用、正式含能力稽核102項及共享144項PASS。候選與正式各52案雙尺寸Chrome及全狀態／父指令重播PASS（各含16案實際Lv5），final build／全域lint／資料／registry／單卡strict／標準AI Browser及ST1核心同步PASS。相同規則與已驗收v20策略指紋的12準備局面對照，避免6次自敗並保留6次安全勝利；六色新種子實際時鐘Lv5對局合計1197動作／407搜尋、0錯誤／0搜尋逾時。13既有牌表無受影響陷阱支付分支，未證明整體或對人類勝率提升。全域AI仍有既有21張unsupported而strict exit1，conversionFailures為空。ST6～ST10為46正式／54候選、ST7=19／1；局部Chrome及核心同步不代替逐卡online或完整UI對局。後續修改未commit／push。證據：output/st6-st10/ai-v21-st7-019-full-acceptance.json、st7-019-promotion.json、ai-v21-break-payment-formal-comparison.json、ai-v21-real-clock-six-colors-report.json。


ST7-018／AI v20 完整回歸已通過（2026-10-12）：914檔／19,094項全部PASS、1482.89秒、exit0；1755份程式／設定／資料指紋一致。原圖YY陷阱全部己方餅乾各+1HP已驗證後promote；修正AI漏交必選全體而出牌error，以及本機／線上UI可取消固定對象的問題。候選與正式各44案雙尺寸Chrome及完整父指令／狀態重播PASS（各含10案實際Lv5）；final build／全域lint／資料／registry／單卡strict／標準AI Browser及ST1核心同步PASS。全域AI仍有既有21張unsupported而strict exit1，conversionFailures為空，未稱全部AI能力支援。ST6～ST10為45正式／55候選，ST7=18／2；13副既有牌表不含受修正分支，未宣稱整體或對人類勝率提高。局部準備式Chrome、線上元件及核心同步不代替逐卡online或完整UI對局；後續修改未commit／push。證據：output/st6-st10/ai-v20-st7-018-full-acceptance.json、st7-018-promotion.json、st7-018-formal-browser-run1/replay-audit.json。


正式AI v19完整回歸已通過（2026-10-12）：910檔／19,036項全部PASS、1544.45秒、exit0；1749份來源／設定／資料指紋一致，來源凍結解除。保留Yoga FLIP在巢狀效果傷害中的控制權／AI續接修復，並排除擁有該傷害序列的外層FLIP，避免重跑傷害；首次v19全套因補此守衛而主動停止，未當作通過；專用10項、受影響13檔383項（含10項）、final build／全域lint及產品src/scripts lint／桌機平板實際Lv5 Chrome2案及完整父指令＋狀態重播／標準AI Browser PASS。原500動作卡住兩場均以相同開局／種子在245動作正常結束，上限未改。陷阱無效付款guard原型新種子728場363：365、零錯誤，未證明勝率提升，保留output草稿且未採用；不宣稱對人類或穩定整體勝率改善。ST6～ST10仍44正式／56候選，六色13副已驗證構築；018～020僅完成原圖與轉接基線，尚未逐卡驗收／promote。局部Chrome不等於完整UI對局或逐卡online；後續修改未commit／push。證據：output/st6-st10/ai-v19-ownership-full-acceptance.json、ai-v19-flip-sequence-progress.json、ai-public-noop-trap-adoption-decision.json。

AI v19最終所有權守衛回歸進行中（2026-10-12）：內層揭示FLIP先處理，擁有傷害序列的外層FLIP不得重跑；專用10項／受影響13檔383項、build、產品lint、桌機與平板Chrome2案＋完整指令／狀態重播、標準AI Browser均PASS。首輪v19全套為補此守衛而主動中止，保留FAIL及來源一致性exit0，不當作通過；新的ownership-full以1749份來源指紋、單worker執行，尚未取得最終結果。ST7-008已正式驗收／promote；ST6～ST10累計44正式／56候選，六色13副牌組。

AI陷阱原型評估完成（2026-10-12，未採用）：避免無效條件付款的隔離原型18案通過，但兩邊共同含FLIP修復的新種子728場為363：365、成對受益1／受損2／互分361，完整矩陣／牌表／bundle／報告雜湊稽核PASS且零卡住，未證明勝率提升。原型觀察到20次保留無效陷阱、0次無效支付，對照14次無效支付；屬描述性事件，不能代替勝率結果。原型及19案失敗基線測試草稿已保存於output，不加入正式政策；既有產品測試未刪除。正式v19保留已確認的Yoga FLIP控制權／續接修復，final build與產品src/scripts lint PASS，局部Browser來源／dist指紋仍一致；v19完整Vitest待跑。ST6～ST10仍44／100，六色13副AI構築；未commit／push。證據：output/st6-st10/ai-public-noop-trap-adoption-decision.json、ai-public-noop-trap-fixed-holdout/audit.json。

AI v19進行中（2026-10-12，完整回歸待跑）：13構築對照揭露Yoga FLIP在巢狀效果傷害中卡住，已修正控制權及AI佇列阻擋，先結算FLIP再續接傷害。專用舊版3失敗／2通過，修後8項PASS；兩組不重疊受影響回歸13檔381項（含8專用）、build／受影響lint／雙尺寸實際Lv5 Chrome2案及完整父指令＋狀態重播／標準AI Browser PASS。原兩場500動作卡住皆以相同種子從開局在245動作正常結束，上限未放寬。陷阱無效條件guard仍為隔離原型，新種子728場同規則比較進行中，首輪726完成／2卡住不作勝率結論。ST6～ST10仍44正式／56候選，六色13副AI構築；下列909檔19026項為v18快照，不包含本次v19修復。後續修改未commit／push。證據：output/st6-st10/ai-v19-flip-sequence-progress.json、ai-public-noop-trap-holdout/failed-pilot-audit.json。

ST7-014～017／AI v18與13副牌組完整回歸已通過（2026-10-12）：909檔／19,026項全部PASS、1432.62秒、exit0；1747份來源／設定／資料指紋一致，來源凍結解除。新增Cookierift1035「imortal」黃色Tree/control原表60＋4，來源逐印刷比對、ST2-020異圖實體卡文核對、雙尺寸正常UI開局與完整狀態／commandLog重播、標準AI Browser皆PASS，目前六色13副可選。ST6～ST10仍44正式／56候選，逐卡online與完整UI對局未驗收。v18下次Active評分在這13副中沒有對應效果，取消無作用的728場消融，不據此宣稱勝率提升。另已重現Perfect Stage無黑色且Arena見證仍浪費陷阱的AI問題，隔離原型18案PASS（舊版12失敗）；尚未套入正式AI／未量測勝率。後續修改未commit／push。證據：output/st6-st10/ai-v18-st7-014-017-full-acceptance.json、cookierift-1035-acceptance.json、ai-v18-next-active-policy-exposure.json、ai-public-noop-trap-prototype-matrix.json。

ST7-017 已 promote 且正式重驗通過（2026-10-12）：原圖黃色Y陷阱，0～1對手本回合普通攻擊-1，Then己方Break LV≥4時同一目標再-1；不加整張發動門檻／目標LV限制／新目標／額外代價。23卡牌＋41實體與AI測試，正式12檔344項（重疊），build／產品lint及受影響檔lint／資料／registry／strict PASS；正式雙尺寸36案操作＋36案精確重播、8案真實Lv5 Chrome＋8案精確重播、標準AI Browser PASS。實際ST7-008普通3→1後Then效果1不減；Lv3～5可於Break未達4時使用基礎減攻，無合法Y時保留陷阱。ST6～ST10為44正式／56候選，ST7=17／3；58JSON／2124卡號／2068可轉換／1585 canonical AI，21張unsupported仍保守。AI v18未新增政策，完整014～017批末Vitest及獨立holdout待跑；下一步核對1035完整原表後加入多樣性，不提前宣稱勝率提升。局部準備式Chrome／AI不等於online或完整對局；未新增commit／push。證據：output/st6-st10/st7-017-promotion.json、st7-017-formal-browser-run1/replay-audit.json、st7-017-formal-ai-browser-run1/replay-audit.json。

ST7-017 進行中（2026-10-12，尚未 promote）：依實體Vined Cavern原圖修正舊轉接三個錯誤：Then的己方Break LV4誤升為整張發動門檻、錯限目標LV4、漏掉同目標追加-1。原始錯誤轉接曾被舊契約誤列verified，已增加exact契約與21種突變防護；23卡牌＋36實體AI測試通過，8檔191項受影響回歸與修型別後2檔59項、build／專項lint通過。候選隔離Browser入口已備，雙尺寸Chrome／實際Lv5／重播與標準AI、promote後正式重驗尚未執行；ST6～ST10仍43正式／57候選，014～017批末全套及v18勝率holdout待跑。證據：output/st6-st10/st7-017-source-progress.json。

ST7-016 已 promote 且正式重驗通過（2026-10-12）：原圖黃色YY道具，選0～1對手剩餘HP≤2餅乾，阻止該餅乾下次Active Phase活躍；不限顏色／LV／REST、不立即橫置、只消耗一次標記。19項卡牌／35項實體與AI／11項新政策測試，正式11檔261項（重疊）；build／產品lint（排除output與附件）／資料／registry／strict通過，正式雙尺寸20案操作與20案完整重播，另8案真實Lv5 Chrome及8案完整重播、標準AI Browser PASS。AI v18依公開支援顏色與共享費用評估下次活躍封鎖的普通攻擊壓力，已活躍、無攻擊能量、重複標記避免浪費；相同原卡局面12案新舊對照，3案有效疲勞目標從跳過改為使用、9案控制不變，非整體勝率證據。ST6～ST10為43正式／57候選，ST7=16／4；57JSON／2123卡號／2067可轉換／1584 canonical AI；21張unsupported仍保守處理，條件棄手牌解鎖不誤列支援。014～017批末完整Vitest與v18獨立holdout待跑，先前900檔18743項不涵蓋本批。局部準備式UI／AI不等於完整對局或逐卡online；後續修改未commit／push。證據：output/st6-st10/st7-016-promotion.json、st7-016-formal-browser-run1/replay-audit.json、st7-016-formal-ai-browser-run1/replay-audit.json、st7-016-formal-regression-run1.log。

ST7-015 已 promote 且正式重驗通過（2026-10-12）：原圖黃色YY道具，己方同名LV3 Millennial Tree在戰鬥或Break時，本回合結算時全部己方餅乾攻擊+1；不限見證顏色／REST、無選擇目標，未達條件仍可付款並no-op。新增exact轉接與防漏契約，26項卡牌／42項實體與AI測試，正式8檔228項（重疊）、build／產品lint（排除output與附件）／資料／registry／strict通過；正式雙尺寸32案操作與32案完整重播，另4案真實Lv5 Chrome及4案完整重播、標準AI Browser PASS。Lv4／5可先付YY再留一張支援完成普通1→2的攻擊，Lv3～5無見證保留資源；沒有新AI政策或本卡整體勝率增益宣稱。ST6～ST10為42正式／58候選，ST7=15／5；56JSON／2122卡號／2066可轉換／1583 canonical AI，既有23張unsupported不變。014～017批末完整Vitest仍待跑，下列900檔18743項不涵蓋本批。局部準備式UI／AI不等於完整對局或逐卡online；後續修改未commit／push。證據：output/st6-st10/st7-015-promotion.json、st7-015-formal-browser-run1/replay-audit.json、st7-015-formal-ai-browser-run2/replay-audit.json、st7-015-formal-regression-run1.log。

ST7-014 已 promote 且正式重驗通過（2026-10-12）：原圖Y道具、同張己方具名LV3 Millennial Tree在戰鬥或Break才補0～1任意己方餅乾1HP；修正舊轉接漏條件，保留條件未達可付款且明列no-op。見證不限顏色／REST，目標不限剩餘HP，與ST7-010的HP≤4不同。25項卡牌契約＋54項實體／AI指令測試、正式9檔190項（範圍重疊）、build、產品來源／腳本lint（排除output與附件）、資料／registry／單卡strict通過；正式雙尺寸34案Chrome與34案完整狀態／commandLog重播、標準AI Browser PASS。舊轉接使Lv3～5將無見證的補血當成有效動作，修正後三個等級保留道具及能量；這是卡牌條件修正，非新AI政策或整體勝率提升證據。ST6～ST10為41正式／59候選，ST7=14／6；55 JSON／2121卡號／2065可轉換／1582 canonical AI，既有unsupported清單未變。014～017依逐卡閘門推進，批末完整Vitest待跑；下列900檔／18743項屬014之前。局部UI不等於完整對局或逐卡online；後續修改未commit／push。證據：output/st6-st10/st7-014-promotion.json、st7-014-formal-browser-run1/replay-audit.json、st7-014-formal-regression-run1.log、st7-014-ai-conversion-comparison.json。

ST7-010 與正式AI v17完整回歸已通過（2026-10-12）：900檔／18,743項全部PASS、exit0；1729份來源／設定／資料指紋一致。原圖黃色LV3／5HP／YYY普通3、免費Once棄任意手牌補0～1己方剩餘HP≤4，以及攻擊Then可棄FLIP Cookie抽0～2均已驗；修正Then抽牌視窗錯顯Activate文字。正式雙尺寸42案Chrome＋6案AI及48案完整狀態重播PASS，屬準備式局部操作，非完整UI對局或逐卡online。v17修正Lv3～5為必須抽0的純抽牌Then白白支付手牌代價；11項決策測試通過。同規則新種子624場單一政策消融為312：312，成對受益0／受損0／互分312，逐場矩陣／牌表／引擎及報告雜湊稽核PASS；不據此宣稱人類或穩定整體勝率提升。最終199項受影響回歸、build、產品來源／腳本lint（排除output與附件）、資料／registry／strict通過。ST6～ST10仍40正式／60候選，ST7=13／7；後續修改未commit／push。證據：output/st6-st10/st7-010-promotion.json、ai-v17-st7-010-full-completion.json、ai-v17-draw-cost-holdout/audit.json。

ST7-008／正式AI v16完整回歸已通過（2026-10-12）：897檔／18,674項全部PASS；1723份來源／設定／資料指紋一致，exit0。產品來源及腳本lint通過（排除output與附件產物）；原全目錄lint因掃描暫存bundle而中止，紀錄保留。39正式／61候選，ST7=12／8。新策略同規則624場對照為312：312，成對受益0／受損0／互分312，零錯誤；逐場矩陣、牌表、種子、座位及bundle／報告雜湊稽核PASS。此為單一回收guard消融，不能據此宣稱對人類或穩定整體勝率提升。專項致勝反例及正式Chrome已驗；逐卡online與完整UI對局未驗收。本輪後續修改未commit／push。證據：output/st6-st10/ai-v16-st7-008-full-completion.json、ai-v16-break-recovery-holdout/audit.json、st7-008-promotion.json。

ST7-008 已 promote（2026-10-12，完整回歸通過）：原圖黃色 LV2／HP4／YYY 普通3，免費 On Play 需同張己方具名 LV3 Millennial Tree 位於戰鬥或休息區，選0～1己方黃色LV1休息區餅乾移至棄牌；Then 己方休息區總LV≥4時對原防守者追加1。補 exact adapter、具名休息區條件與 strict guard，21種錯誤變異被攔截。正式59項單卡測試、共用19檔450項、正式7檔141項回歸（範圍重疊，不相加）、build、資料／registry／單卡strict、ST7 AI分類、標準AI Browser及產品來源lint通過。修正自動attack缺原目標及來源被FLIP昏厥至公開休息區後漏Then；ST7-011測試補實際Then結算命令，原不補他牌／不抽HP斷言保留。雙尺寸隔離登場22／攻擊20／AI新舊對照8案均完整狀態與commandLog獨立回放PASS；promote後正式登場22／攻擊20／AI4案及精確回放PASS，同情境不重複累加。正式AI v16在Lv3～5避免回收使休息LV4降3而失去當回合公開致勝攻擊，無可用致勝攻擊／回收後仍達門檻時照常回收；隱藏卡順序不影響該決策。此為局部準備式Chrome及特定反例修正，未證明完整UI對局／逐卡online或新的整體勝率。全卡池AI分類2063 inventory／1580 canonical，conversionFailures空，既有unsupported清單不變。ST6～ST10為39正式／61候選。既有工作已commit 3760269a，本次後續修改尚未commit／push。證據：output/st6-st10/st7-008-promotion.json、st7-008-formal-onplay-browser-run1/replay-audit.json、st7-008-formal-attack-browser-run1/replay-audit.json、st7-008-formal-ai-browser-run1/replay-audit.json。

正式 v15 新種子對照已完成（2026-10-12）：相同正式規則、卡池與其他 AI 政策，只比較空目標可選移動 guard 開／關，兩組各 624 場共 **1,248 場，631：617（50.56%）**；成對受益 8、受損 1、互分勝負 615，全部完成且零錯誤。這是單一政策消融比較，不是全部 v15 改動對舊版，也不是人類勝率或穩定優勢證明。每色每策略各 208 場，藍 83／83、綠 64／53、黃 93／92、紅 113／111、紫 115／115、黑 163／163；分色差額同時受對手政策與配對影響。逐場、座位、先後手、牌表及 bundle／報告雜湊獨立稽核 PASS。證據：output/st6-st10/ai-v15-holdout/combined-audit.json、color-comparison-audit.json。

ST7-013／正式 v15 本輪完整回歸已結束（2026-10-12）：**894 檔／18,614 項全部 PASS，1480.40 秒、exit0**；1717 份來源／設定／資料指紋一致、integrity exit0，來源凍結已解除。全域 lint exit0。涵蓋 ST7-013 正式付款／可選傷害、AI 安全 Break 代價、協定欄位檢查、UI 與 adapter 首次初始化效能修正，並保留 v14 空移動略過與 ST7-011 目前 LV 條件。證據：output/st6-st10/ai-v15-st7-013-full-completion.json、ai-v15-st7-013-full-vitest-run1.log。下列 v14 完整結果為歷史證據；v15 新種子單一政策消融結果見本節。

ST7-013 已 promote（2026-10-12）：依原圖支付 YY＋己方棄牌區恰好 1 張黃色 Cookie 放入 Break，之後對手 0～1 Cookie 受 2 效果傷害；代價使己方 Break 達 10 時先敗北、不結算傷害。正式 AI v15 選較低印刷 LV 的合法代價，拒絕付款自敗，並保留 v14 空移動略過。候選／正式來源／正式卡池各同 24 案雙尺寸 Chrome 及全部狀態欄位精確回放通過，不重複累加；正式 5 檔 130 項、共用 10 檔 231 項、AI 分類 9 項、build／受影響 lint／伺服器型別／資料／registry／單卡 strict 通過。協定拒絕非字串代價 ID；好友房核心雙瀏覽器同步通過，仍非逐卡 online 完整對局。首次來源回歸兩項 ST6-015 hook 逾時與建房未回應已保留；CPU profile 定位新增效果欄位放於大型展開前的效能退化，調整欄位順序後同局面首次初始化 14.47 秒回到 0.68 秒（修改前 0.67 秒），原測試不放寬時限即通過。正式 v15 新種子單一政策消融為 631／617，不把 v14 的 637／611 當成 v15 勝率。最新證據：output/st6-st10/st7-013-formal-browser-run1/replay-audit.json、st7-013-promotion.json。 全卡池 strict AI 稽核仍因既有 unsupported 清單而 exit1／conservative，9 項回歸確認清單未變、conversionFailures 為空；ST7 系列 strict ready，不能宣稱全卡池 AI 無缺口。

ST7-011 完整回歸 run1 已結束（2026-10-12，session85902）：890 檔中 889 通過，18,547 項中 18,546 通過、1 失敗，1271.44 秒、exit1；1709 份來源／設定／資料指紋一致、integrity exit0，來源凍結已解除。唯一失敗為卡池稽核仍預期 2060，實際為 2061；重新執行正式全卡池 AI 稽核確認 2061 inventory／1578 canonical、conversionFailures 空、unsupported 清單未變。精確計數更新並加入 ST7-011 單卡分類回歸後，該檔 8 項通過；未放寬既有 unsupported／conversionFailures 斷言；後續 v14＋ST7-011 新指紋完整回歸 891 檔／18,559 項已全部通過，首輪失敗紀錄保留。

AI 空移動代價修正已套入正式來源 v14（2026-10-12，完整回歸已通過）：原型兩組 624 場分別 323：301、314：310，合計 1248 場新策略 637／舊策略 611（51.04%），零錯誤；624 組成對比較 beneficial15／harmful2／split607。完整工作組合、bundle／牌表／報告雜湊稽核 PASS，不宣稱對人類勝率或穩定優勢。正式 handler 與受測候選的標準化可執行 JavaScript 完全相同。基線實際敗局保留；原型 9 案 PASS，正式新增 11 案涵蓋 Lv3～5 無目標略過、有目標救援、真實隱藏卡順序排列及 Lv1～2 舊行為。原型 Chrome 8 案與正式 Chrome 4 案逐欄位精確重播 PASS，標準 AI Browser 六項 PASS，正式 build／受影響 lint PASS；局部準備式 Browser 非完整 UI 對局或 online。最新證據：output/st6-st10/ai-empty-then-benchmark/combined-audit.json、ai-v14-formal-browser-run1/replay-audit.json。

分色補充：兩組比較各色各策略皆 208 場；藍 91／89、綠 68／51、黃 101／100、紅 103／102、紫 116／112、黑 158／157（新／舊勝場）。逐場與報告雜湊核驗 PASS，合計 637／611；同場是新策略對舊策略，因此分色差額含對手策略改變及牌組對局的影響，不能當作各色獨立因果效果或對人類勝率。證據：output/st6-st10/ai-empty-then-benchmark/color-comparison-audit.json。

目前狀態（2026-10-12）：ST6～ST10 **39／100 已 promote、61 張候選**；ST6=20／0、ST7=12／8、ST8=1／19、ST9=1／19、ST10=5／15。正式卡池 53 JSON／2119 卡號／2063 可轉換／1580 canonical AI cards。沿用六色 BS12 與 Cookierift 921／927／67／83／568／506 共 12 副牌表，預設 Lv5、正式 AI 政策為 v16。ST7-008／v16 本輪完整回歸已通過；下列 v14 完整回歸為較早快照。

ST7-011 已逐卡驗證並 promote：印刷黃色 LV1／2HP、YY 普通 2，Then 僅在來源 HP≤2 且同張己方戰鬥區具名 Millennial Tree Cookie 的目前 LV 恰 3 時，讓來源補 1HP；來源在 FLIP 中離場不補。具名條件保留舊欄位相容性；離線 UI Refresh 捕捉並記錄一次 uint32 seed，既有種子（含 0）保留，規則引擎仍純函式。候選隔離 80 項／型別／strict、來源 31 檔 882 項及全域 lint run2、正式 32 檔 904 項／build／資料／registry／單卡 strict／受影響 lint 皆通過。正式 ST7 AI 稽核 10 張、18 能力、3 候選組合邊、零 unsupported／conversionFailures，狀態 ready。

候選、來源、正式階段重驗同一組雙尺寸 Chrome 32 案，不重複累加；正式 run2 與 32 案獨立精確重播均 PASS，包括付款取消、真實 1／3HP 父流程、來源被 Kumiho FLIP 擊倒及 Refresh。所有狀態欄位、最終牌序與完整 commandLog 均比較，沒有洗牌排除項；正式桌機正向與平板 Refresh 最終畫面已目視。標準 AI Browser 開局／暫停／繼續 PASS。這些是原卡 60 張準備式局部操作，非完整開局至勝負或逐卡 online。正式 Chrome 初跑因 driver 仍讀已移出候選的卡失敗；改讀正式 JSON 後重跑，不是產品規則缺陷。全域 lint 初輪唯一失敗為 output AI 草稿 unused import，修後 run2 exit0；promote 後只改 fixture 正式載入與生成 registry，兩檔受影響 lint exit0，沿用其餘未變更來源的全域證據。

AI 減傷估值原型：正式 v13 的 15 項反例有 4 失敗，改用實際對防守者普通傷害後 15 項通過、全 app 型別零診斷；兩組固定種子共 1248 場為 **624：624（50%）、零錯誤**，未證明整體勝率提升，未採用。另一個僅使用公開 Break LV 的非線性競速評分為探索性原型，首組 624 場 312：312；5 組配對動作總數改變但勝負未變，第二組亦為 312：312；兩組合計 1248 場 624：624、零錯誤，bundle／報告與配對 audit PASS，未證明提升，不採用這組權重。既有 v13 對 v12 的 1248 場亦為 624：624，不混成同一實驗；皆非人類勝率。

最新完整 Vitest（2026-10-12）：正式 v14＋ST7-011／具名目前 LV 條件／已提交 Refresh 種子修正，**891 檔／18,559 項全部 PASS，1286.20 秒、exit0**；1712 份來源／設定／資料指紋一致、integrity exit0，來源凍結已解除。證據：output/st6-st10/ai-v14-st7-011-full-vitest-run1.log、ai-v14-st7-011-full-source-integrity-run1.log、ai-v14-st7-011-full-completion.json。這輪不涵蓋 ST7-013 隔離草稿；其餘未採用 AI 原型不混入正式來源。部分提交 9d523506 與 Refresh 獨立提交 be4371a9 均未 push，v14 與 ST7-011 等其餘變更尚未 commit。全 100 張逐卡驗收／promote 與對人類玩家的實測仍未完成。

證據：output/st6-st10/inventory-37-formal.json、st7-011-formal-affected-run1.log、st7-011-browser-formal-run2/results.json／replay-audit.json、st7-011-formal-standard-ai-browser.log、st7-011-formal-ai-capabilities.json；AI 實驗見 ai-stored-reduction-benchmark/combined-summary.json 與 ai-break-race-benchmark/first-group-summary.json。

<!-- ai-starter-current-end -->

歷史進度（現況以本文開頭摘要為準）：ST6-020 Into the Depths 已依原圖補齊 RR 放置、Activate 橫置場景＋己方任意戰鬥區餅乾最上方1HP進棄牌後抽0～1；沒有額外啟動能量或Once。61項單卡（22種執行期strict錯誤變異）、隔離20檔407項回歸與型別檢查PASS；單元另驗真實FLIP HP支付不揭示也不觸發FLIP。38案桌機1366×768／平板1164×777 Chrome及獨立重播PASS，含任意顏色／REST餅乾、1HP昏厥、抽0、取消／切換、錯色付款、抽最後一張→Refresh。修正通用draw-up-to來源查找及UI漏場景區，抽牌視窗保留原卡圖、卡號與卡文；仍屬原卡準備式局部Browser，非整副開局至勝負或online驗收。重播將準備式父指令與initialState後的操作分開；Refresh未匯出洗牌seed，只宣稱牌庫成員與其他牌區精確相符，不宣稱重現隨機牌序。實際來源回歸=PASS、build=PASS、全域lint=PASS、單卡strict=PASS、來源Browser=PASS、來源重播=PASS。020已單卡promote；正式21檔414項、build、全域lint、資料／registry／strict、38案Chrome與重播、標準AI Browser及ST1好友房核心同步皆exit0（非020逐卡online）；43 JSON／2109卡號／2053轉換／1570 canonical AI cards，ST6 ready20／44能力／10組合邊／0unsupported；目前29正式／71候選，ST6=20／0，ST7=2／18、ST8=1／19、ST9=1／19、ST10=5／15。019正式410項、46案Chrome／重播、build／資料／registry／受影響lint／標準AI Browser均PASS；本批017～020完整Vitest已終值exit0：868檔／18,016項全部PASS、1359.78秒，1652份來源／設定／資料指紋一致；此完整回歸不涵蓋其後ST7-001候選來源修改。正式AI已整合安全Break代價選擇v10，正式局部與完整Vitest驗證均通過，條件評分原型14項PASS、修正前6項失敗：019己方1HP門檻成立122分，不成立117分；僅處理已證明不改HP的代價與前段效果，未知或可能改變條件的路徑保留原估值。原型未採用、未宣稱提高勝率。全正式陷阱與12副已接受牌組的靜態掃描確認此原型目前只影響ST6-019，現有12副均未含該卡，不以未受影響牌組的對照賽當作改善證據。另一救援陷阱原型128項／4案AI Chrome PASS，但兩組各624場625／623（50.08%），未證明穩定提升，未採用。逐卡online、完整正式對局及對人類勝率未驗收／量測；未commit／push。 本輪AI診斷確認canAttack僅為主要階段／首回合門檻，舊AI卻以其排除場景啟動候選；輸出隔離原型只讓Lv3～5比較合法場景，未改正式AI。原型40項回歸PASS（原版3項反例失敗）、原圖60卡準備局面雙尺寸Chrome12案及全部實際命令獨立重播PASS；兩組各624場為314／310與312／312，合計626／622（50.16%）；624組交換policy座位配對中5組有利、3組不利、616組勝負不變；場景啟動59次對基線1次。原型型別零diagnostics，未套用正式來源，不能宣稱穩定勝率提升。ST7-001原圖已目視並建立獨立預期；隔離54項測試（31原卡規則＋23契約，含22種錯誤變異）及型別PASS，原strict漏20種的反例已確認。實際來源候選已套用，12檔321項回歸與build、strict verified=1通過；原圖60卡雙尺寸Chrome44案及全部實際指令獨立重播PASS，新增guard對2108張正式卡分析不變。全域lint首次因三處測試prefer-const失敗，已改const並重跑321項PASS；全域lint重跑exit0，ST7-001已單卡promote；正式12檔321項回歸、資料／registry／strict皆exit0。正式雙尺寸Chrome44案及獨立重播、標準AI Browser與v10共批全域lint均exit0；ST7正式AI能力稽核ready2／2能力／0unsupported／0conversionFailures。首次driver將ST1-001誤認為GingerBrave已改為原圖Princess，後續付款候選及結果視窗driver錯誤已修正，失敗紀錄保留，不計為產品缺陷。 AI主線另重現BS12-035手牌進Break代價的自敗錯誤：己方Break7時Lv3～5按手牌順序選LV3會立即敗北，LV1可實際擊倒對手並獲勝。輸出隔離修正優先低印刷LV、排除其他手牌代價並拒絕會先達Break10的可選付款；59項回歸PASS（基線6項失敗）、型別零diagnostics、雙尺寸Lv5 Chrome12案及獨立指令重播PASS。首組624場312／312（50.00%），未證明整體勝率提升；安全代價原型其後已整合正式AI v10（lv5-safe-break-cost-v10），只改手牌進Break候選選擇與其他手牌付款排除；正式94檔1370項AI／ST7回歸、build、全域lint與標準AI Browser皆exit0；正式v10原圖60卡準備局面雙尺寸Chrome6案及獨立重播PASS。正式624場預選種子對照312／312（50.00%）、零錯誤，雙方各14次手牌進Break付款、零此類付款自敗，不能宣稱整體勝率提升。當前引擎SHA be714a097c6f0bae32991608a125342d9e4954acef4a8a7d2d355796cde090f4與對照賽bundle完全一致，對照020完整回歸僅8個既有來源／資料檔為預期修改。另用實際搜尋時鐘完成六色BS12對局至勝負，340次搜尋／0逾時／0丟棄評估；仍非人類勝率或逐卡online驗收。15項正式閘門通過後凍結1660份來源／設定／資料，AI v10＋ST7-001完整Vitest已終值exit0：871檔／18,083項全部PASS、1289.13秒，1660指紋一致。完整回歸不涵蓋其後ST7-002隔離或正式修補；002尚未套用／promote，當前29正式／71候選。來源凍結已結束。場景啟動與019條件估值原型仍未套用。實體卡準備式局部Browser不等於完整對局、逐卡online或人類勝率驗收。凍結期間另以正式ST7-001原圖60卡準備局面驗證主動技能：己方來源REST／Break7、對手Break9，高LV手牌在前時舊v9的Lv3～5皆弱部署而錯過立即勝利，v10皆付Princess LV1後兩點傷害收尾；低LV在前時新舊皆收尾，共6個實際命令反例，輸入不變／60唯一實體卡／同卡至多4張，見st7-001-ai-safe-break-diagnostic.json。此為局部策略證據，不是新勝率、全場或online驗收；未修改凍結來源。

最新完成：ST6-015 Fire Spirit Cookie’s Staff 已依原圖驗證並 promote：RR＋任意己方餅乾頂端1HP，0～1任意己方餅乾本回合攻擊+2，無具名／顏色／等級限制。68項單卡回歸、18種strict錯誤變異、49檔714項受影響回歸通過。候選與正式雙尺寸Chrome各重驗相同34案（32一般＋2最後餅乾代價，不重複累加），精確命令與付款、選零、離場候選、REST、異色目標、到期及普通攻擊已核對。本機目標以純付款命令投影，線上先付款再選權威目標；6項hook回歸通過，逐卡online完整對局未驗收。現23正式／77候選，ST6=15／5、ST7=1／19、ST8=1／19、ST9=1／19、ST10=5／15；37 JSON／2103卡號／2047轉換／1564 canonical AI cards。正式build、全域lint、資料／registry、strict ST6 ready=15、標準AI Browser皆exit0；修改前2102筆正式分析不變。015完整Vitest858檔／17,772項全部PASS、1273.65秒、exit0，1627份來源／設定／資料指紋一致，見output/st6-st10/st6-015-full-vitest.log；此終值不涵蓋後續016。AI正式仍v9；增攻原型兩組預選種子各624場為312／312、311／313，無穩定提升，未套入正式AI。對人類勝率未量測。未commit／push。下一cursor ST6-016；以下舊段落為歷史快照。

最新進度：**ST6～ST10 共17張正式／83張候選，交集0、總數100**。ST6-009 候選雙尺寸32案及3檔34項（含Lv4／Lv5實際付費技能收尾）通過後單卡promote；ST6-001～009與AI卡池稽核受影響22檔213項PASS，最終build通過。正式009 Chrome／本批AI Browser／全域lint仍待終值；完成後啟動007～009批次完整Vitest。正式資料31 JSON／2097卡號／2041轉換、registry一致，ST6 AI strict ready。未commit／push，逐卡online未驗收。以下為歷史快照。

目前核驗進度：ST6～ST10 為 **16 張正式／84 張候選**；ST6-007／008 已完成正式雙尺寸 Chrome 28／24 案、合計 50 項卡牌測試，加入全卡池 AI 稽核後 5 檔 57 項 PASS。008 的最後一張牌／Refresh／不補位父流程以匯出重播核驗。正式 build、全域及修改檔 lint、資料與 registry、AI Browser 通過。ST6-009 已目視原圖、strict verified=1、32 項專項測試及候選 build／lint，Chrome 尚待終值；未 promote。正式 AI 仍 v9；新後續攻擊減傷原型兩組各 624 場為 315／309、313／311，只略高五成，沒有當成穩定勝率提升。最新完整回歸 834 檔／17,416 項只涵蓋新增007以前的 v9／P-163。localhost:5173 已確認 HTTP200；逐卡 online 未驗收，未 commit／push。以下為先前快照。

2026-10-11 最新核驗：正式 AI v9／P-163 修正的完整 Vitest 已終值通過（834 檔、17,416 項、1341.17 秒、exit 0），修改 ST6-007 前 1576 份來源指紋一致。ST6-007 其後完成原圖、strict verified=1、候選與正式各同 28 案雙尺寸 Chrome、正式 2 檔 30 項測試及單卡 promote；正式資料 29 JSON／2095 卡號／2039 轉換與 registry 一致。ST6～ST10 現為 15 正式／85 候選，007 不在前述完整回歸範圍，逐卡 online 未驗收。正式 lint 首輪因兩個未使用候選 import 失敗，已清除重跑。AI 後續減傷原型已發現盲目優先當前攻擊者會忽略可支付的第二次攻擊；公開普通攻擊預估原型僅在 output 驗證與比較，正式仍為 v9。未 commit／push。

本批最終build及全域lint已exit0；完整Vitest仍在session29773，1576指紋保持一致。ST6-007隔離候選雙尺寸Chrome28案已通過，尚未整合正式路徑／測試或promote，數量仍14正式／86候選。正式開發頁面localhost:5173已確認HTTP200。


2026-10-10 AI v9正式續批：v8完整Vitest已結束，833檔／17,396項全部通過，1420.70秒、exit0；修改前1572份來源／設定／資料指紋一致。其後正式套用「可救下當前防守者的減攻陷阱優先當前攻擊者」，版本`lv5-public-saving-trap-target-v9`；原v8的11項測試9失敗／2通過，修正後11項全通過。受影響AI回歸65檔986項、build、全域lint與標準AI Browser通過；實際AI雙尺寸6案及匯出付款／目標／resolve-battle／HP指令全部通過。前兩輪Browser driver對HP文字格式及結算指令的假設失敗保留，run3取代，不當產品失敗。六色BS12實際時鐘完整對局368次搜尋、0逾時／0丟棄評估，4次實際Special Play。

勝率證據：凍結原型兩個預選種子組各624場，338／286（54.17%）及329／295（52.72%）；正式v9另用seedBase=2027022617完成624場，342／282（54.81%）、零錯誤，312組政策座位配對中38組新版雙勝／8組舊版雙勝／266組各勝一場。正式bundle除版本字串外與前兩組原型完全一致；共同規則／資料與bundle指紋、種子／座位稽核通過。正式報告SHA=632df663ef40d00570964b2febf4f02d048c5509caba744fc427d7e6a33e4311；原report.method沿用output-only範本文字，正確正式版本身份見protocol／manifest及formal-comparison-summary.json，原報告保留不覆寫。這是固定12牌表的AI對AI改善證據，不等於人類勝率或所有環境的穩定提升。

P-163舊三張戰鬥區fixture已撤回合法驗收解讀，改為來源加一張紅Arena／綠Arena／非Arena的獨立兩張局面，錯色支付改用真正ST2-020，不改卡牌印刷屬性。原上限測試1失敗／11通過，修正後21項通過，正式Chrome雙尺寸14案通過；舊Browser紀錄保留但不累加。沒有新增卡牌promote，ST6～ST10仍14正式／86候選，007正式驗收及逐卡online未完成。

本批最終完整Vitest已凍結1576份來源啟動，session29773，`output/ai-cookierift/formal-saving-trap-v9/full-vitest.log`，尚待終值；執行期間不改程式／測試／資料。v8的833檔結果不替v9宣稱完整通過。localhost:5173開發伺服器session26822已啟動，HTTP200／Braverse對戰卡牌；未commit／push。


AI v8最終局部驗證：專項2檔21項、受影響65檔990項、最終build／全域lint／新增測試lint／AI Browser通過。正式新種子624場312勝／312敗，未測得整體勝率提升；8組配對行動過程不同但勝負不變。六色實際時鐘完整對局350次搜尋、0逾時／0丟棄評估、4次真實Special Play。v8完整Vitest已凍結1572來源啟動（`output/ai-cookierift/formal-resource-v8/full-vitest.log`），尚待最終結果；執行期間不改程式／測試／資料。

2026-10-10 ST6-006／AI v7完整回歸已完成：832檔／17,384項全數通過，1276.56秒、exit0；1571份來源／設定／資料指紋一致，報告`output/st6-st10/st6-006-full-vitest.log`。ST6～ST10正式14張／候選86張，逐卡online尚未驗收。其後正式AI更新為`lv5-public-on-play-resources-v8`，加入登場後抽牌／公開回收與淨手牌計分、拒絕未完成Refresh預測；專項20項與build通過，AI回歸／Browser／正式v8新種子比較仍進行，前述全套不涵蓋v8。

ST6-006最終局部重驗：正式Chrome雙尺寸同18案全部通過，不與候選累加；正式build修正測試型別窄化後通過，最終全域lint／AI Browser／資料／registry通過。Lv4／Lv5正常與最後HP四案實際AI均免費發動006回手且輸入不變。本批完整Vitest已凍結1571份來源／設定／資料指紋啟動，報告`output/st6-st10/st6-006-full-vitest.log`，session需等最終結果，執行期間不改程式／測試／資料。正式14張／候選86張，007尚未推進效果驗收。

ST6-006續批：原圖重讀、strict verified=1、候選Chrome雙尺寸18案、受影響10檔435項及build／全域lint通過後已單卡promote；正式14張／候選86張（ST6正式001～006、剩14）。正式28JSON／2094卡號／2038轉換及registry一致性、promote後4檔29項通過。正式build初次發現新detached測試缺少Cookie型別窄化，已補真實type assertion；重建、正式Chrome／AI Browser與本批完整回歸仍待完成，停止後續007驗收。前版829檔17,361項全套不涵蓋006。逐卡online未驗收。

2026-10-10 22:33最終完整回歸：v7／ST6-005的Vitest 829檔／17,361項全部通過，1206.63秒、exit0；1565份來源／設定／資料指紋一致。報告`output/ai-cookierift/full-vitest-on-play-v7-st6-005.log`。此結果不包含後續006或Venom原型的正式套用。

本批最後狀態：ST6-005正式雙尺寸28案及promote後五檔53項通過，最終build／lint／資料／registry／AI Browser通過；最終runtime六色350次搜尋無逾時。完整Vitest已固定1565份來源指紋啟動，尚待最終結果。預組正式13／候選87；下一張ST6-006已確認印刷FLIP缺少轉接，僅隔離診斷、不提前promote。最新證據以下方報告為準，舊快照不代表本批完整驗收。

最新AI v7／ST6-005：修正健康Licorice／Mold Dough登場收尾漏估，原始三反例由失敗轉通過，AI回歸63檔963項及build／lint／AI Browser通過。新種子624場全部完成零錯誤，新版313勝／舊版311勝（50.16%），僅多贏一組交換位置配對，尚不足以證明穩定勝率提升。真實時鐘六色完整對局350次搜尋無逾時／無丟棄評估；比較bundle凍結於005增加前。ST6-005完成原圖、30項卡牌／實體局面測試、strict與候選雙尺寸28案後已單卡promote，正式13張／候選87張；正式資料／registry通過，正式Browser及本批最終完整Vitest仍待完成。P-163舊非法三餅乾fixture仍待修正，不以舊證據宣稱驗收。詳見[AI報告](docs/ai-cookierift-2026-10-10.md)與[預組逐卡矩陣](docs/st6-st10-card-inventory.md)。

續批AI v6：正式回歸先重現10項失敗，修補Special Play合法代價組合列舉及動作識別後，4檔29項、最終3檔39項與AI回歸62檔954項通過；build／lint／AI Browser通過，真實時鐘六色完整對局350次搜尋無逾時並記錄4次Special Play。新種子624場全部完成、零錯誤，新版310勝／舊版314勝（49.68%），仍未證明勝率提升；完整回歸尚未完成，下一版先處理已重現的On Play漏估。前批v5／ST6-004完整Vitest已結束：825檔／17,306項通過，1231.87秒、exit0；不作為v6驗收。ST6-005完成原圖重讀、strict及隔離正常／最後HP FLIP診斷，仍留候選。P-163舊fixture超出戰鬥區兩張上限，已撤回其合法實體局面驗收解讀、待拆分重驗。正式12張／候選88張。

前批v5驗收：AI v5修正Arena同伴活躍收益，34項專項與AI Browser通過；新種子624場與凍結v4.1同規則比較全部完成、0錯誤，各312勝（50%），尚未測得整體勝率提升。最終程式六色完整鏡像350次搜尋無搜尋超時。ST6-002已改成合法雙餅乾局面，23項專項與正式雙尺寸Browser26案取代舊三餅乾局面。ST6-004完成原圖、28項卡牌／實體局面測試、strict與候選雙尺寸34案後單卡promote，正式同34案重驗通過；正式資料／registry／build／全域lint通過。目前正式12張／候選88張，v5／004本輪完整Vitest825檔／17,306項通過（1231.87秒、exit0）；前版822檔17,262項不替代本輪驗收。詳見[AI報告](docs/ai-cookierift-2026-10-10.md)與[預組逐卡矩陣](docs/st6-st10-card-inventory.md)。

前批v4.1歷史快照（最新結果見上）：2026-10-10 Cookierift AI擴充進行中：六色社群構築已加入，AI共12副可選牌組。v4修正溢傷反例，但新種子624場僅307勝／317敗，未證明提升勝率；v4.1再修正同等擊倒收益被HP傷害重複加分的問題，正式專項、build／全域lint／AI Browser通過，新一輪624場同為307勝／317敗（49.20%）、0錯誤，尚未證明整體勝率提升。前版v3完整Vitest819檔／17,239項通過，不能當作v4.1最終驗收。ST6～ST10共100張已匯入及原圖盤點；ST6-003另完成原圖、strict、10項測試與候選Browser雙尺寸10案並promote，目前正式11張、候選89張；正式Browser同10案重驗通過，本批全套仍待完成，不能宣稱全預組完成。詳見[AI報告](docs/ai-cookierift-2026-10-10.md)及[預組逐卡矩陣](docs/st6-st10-card-inventory.md)。

2026-10-09 新加坡S3牌表參考AI改善：依使用者四張圖片及正式卡文，修正Lv.5陷阱實際能量／顏色預留、Blocker指定手牌支付、免費能量Blocker的錯誤支援需求，以及唯一合格手牌被放支援的資源流失評估。五項原始反例修正，另確認不再因不存在的Blocker能量需求而跳過合法攻擊。固定種子新舊版本168場全部完成，新版85勝、舊版83勝（50.60%），尚無顯著整體勝率提升證據；未更動六副BS12牌表或採用新經驗權重。專項5檔／37項、完整Vitest806檔／17,155項（1153.51秒）、build、全域lint與完整AI Browser通過。來源、反例、對照及驗收限制見 [S3牌表與AI改善報告](docs/ai-s3-finalists-2026-10-09.md)。

2026-10-09 BS12六色1,028人賽事：11輪瑞士輪5,654場及16強淘汰賽15場全部完成，冠軍黑色#0144、亞軍黑色#0036，16強全為黑色。修正六項AI決策流程缺陷，11個原始失敗種子全部完成；另以336場獨立對照評估賽事經驗權重，候選166勝（49.40%），未達採用門檻，因此保留原權重。全套805檔／17,147項通過，最後守門修改再通過受影響8檔／581項；build、lint、完整AI Browser、雙尺寸補位UI正反4／4及賽果稽核通過。六色固定牌表未更動；完整排名、顏色圓餅圖、相性矩陣與打法見 [賽事與AI分析報告](docs/bs12-1028-tournament-2026-10-09.md)。

2026-10-09 BS12黑色牌組：依原清單新增60張主牌／5張Extra，全部21種卡均已在正式卡池；AI與其他牌組選單新增黑色，現有BS12共六色，已安裝五色玩家只新增黑色並保留既有修改。相關2檔／24項、build、lint、完整AI Browser、雙尺寸選單與四場固定種子AI對局通過。驗證範圍見 [黑色牌組報告](docs/bs12-black-deck-2026-10-09.md)。

2026-10-09 AI覆盤改善：依使用者BS12藍對綠紀錄，修正Lv.5先使用Mystic Flour技能退回支援、漏掉先攻擊再用疲勞支援付代價的順序盲點。新增有限的公開資源續接評分，保留真實Trap／FLIP回應及既有支付規則，策略版本為`lv5-support-cost-sequencing-v1`。專項3檔／17項、完整Vitest804檔／17,133項（1,169.49秒）、build、全域lint與完整AI Browser通過；固定種子前後各24場全部完成，逐場勝負相同，尚無勝率提升證據。完整分析與驗證紀錄見 [BS12綠色AI覆盤報告](docs/ai-bs12-green-replay-2026-10-09.md)。

2026-10-09 BS12五色牌組：依提供清單建立藍／綠／黃／紅／紫各60張主牌，Extra Deck各6／6／6／4／6張；AI選單僅保留五副BS12、預設藍色，其他牌組選單優先顯示BS12。九張缺卡已經原圖逐卡驗證及授權promote，正式strict9張全數verified；雙尺寸實體卡Browser74案、五色開局及完整AI Browser、ST1好友房核心同步通過。完整Vitest803檔／17,127項（1,102.14秒）、build與lint通過。既有玩家牌組與後續編輯／刪除保留。完整證據與驗收範圍見 [BS12牌組報告](docs/bs12-deck-presets-2026-10-09.md)。

2026-10-08 BS12 promote：依使用者明確授權，154 筆印刷（112 張基礎卡、42 筆變體）已由 `data/candidates/official-festival-arena-bs12.en.json` 移入 `data/cards/official-festival-arena-bs12.en.json`，重建正式 registry；只將來源狀態改為 `promotion-ready`，卡片內容逐筆比對未變。246 個測試、fixture 與 Browser 工具同步改讀正式資料。正式 validator 補辨識 Special Play 代價技能，BS12-112／@1 新增正向與缺失代價反例，未改遊戲規則；BS12 正式註冊期待、AI 卡池數量及 EXTRA 精確數量同步，新增 BS12 系列選單與篩選前綴。受影響 6 檔／297 項整合回歸通過。候選 strict／正式 strict 均 154 verified、0 needs-review、0 blocked；候選 strict validate、promote、validate:cards、check:card-pool、build、全域 lint、針對性 3 檔／63 項皆 exit 0。BS12-043 通用正反入口雙尺寸 smoke 4／4、AI Browser 與牌組編輯器 Browser PASS；正式牌組 EXTRA 列表由 42 增為 56，精確確認新增 14 筆 BS12，原有張數／儲存／匯入判定保留，牌組 UI 19 項（含 BS12 篩選／主牌組加入）回歸通過；這些不替代整系列正式對局或逐卡 online 驗收。完整 Vitest 最終第三次回歸 799 檔／17,048 項（1,011.97 秒）全部通過，exit 0，1,396 個來源雜湊一致；前兩次因舊 EXTRA 數量／候選隔離／AI 卡池數量期待失敗而中止，日誌保留。AI capability audit 無轉接失敗；BS12-014／015／082 的策略效果仍採保守處理，不宣稱 AI 能完整評估這三張。Browser 初次 sandbox 本機網路失敗保留，允許本機連線的重跑通過；Vitest 暫存目錄設於 `test-results/bs12-promote-temp` 避免 sandbox rename EPERM。證據：`test-results/bs12-promoted-contracts-2026-10-08.json`、`bs12-promoted-043-browser-final2/results.json`、`bs12-promote-ai-browser-final2.log`、`bs12-promote-full-vitest-final3-2026-10-08.log`。本輪 Git 發佈整理於 `codex/bs12-promote`；既有 AGENTS 修改與其他產物不納入提交。

以 React、TypeScript 與 Vite 建置的 CookieRun: Braverse 網頁遊戲原型。

> **非官方聲明**：本專案為 CookieRun: Braverse 的**非官方粉絲研究 / 學習型實作**，與 Devsisters Corporation 沒有任何合作、授權或背書關係。CookieRun: Braverse 及其卡牌、插畫、標誌之著作權與商標權均屬 Devsisters 及其授權方所有。本專案不商用、不收費；素材使用政策見 [docs/ip-and-asset-policy.md](docs/ip-and-asset-policy.md)。

## 開發背景

2026-10-18 PR #125 合併後追修：起始牌組草稿改用正式社群／BS12 配方名稱並保留 EXTRA，預設牌組 storage 寫入失敗時仍保留已載入的選單牌組。

本批依實際 AI 綠色鏡像對局的 138 筆前置指令重現子傷害卡死，修正共用結算，並延續 ST6～ST10 逐卡實體驗收。

離線 Refresh 在 UI dispatch 時將隨機種子寫入正式指令，讓實際對局與匯出的重播使用同一次洗牌；既有種子（含 0）保持不變。

2026-10-12 已驗證里程碑：新增 Cookierift 六色構築，並以固定種子、實際 UI 與規則回歸改善 AI 決策；ST6～ST10 採逐卡驗證後 promote。

2026-10-15 牌組擴充與 AI 對照：加入依使用者圖片逐張轉錄的韓版 PVP KR 紅色牌表，並納入7副 BS12＋12副 Cookierift 的 1,520 場 Lv5 matched AI-vs-AI 矩陣。初始狀態配對與所有對局完成，無錯誤；候選762勝、HEAD基準758勝（50.13%），僅屬小幅描述性差異，不證明勝率提升或人類對戰表現。38／38 桌機／平板牌組開局 Browser 與逐張主牌／EXTRA比對通過。細節與限制見 [Cookierift／AI 報告](docs/ai-cookierift-2026-10-10.md)。

BS12綠色AI覆盤已重現先技能退回支援而漏掉攻擊的順序問題，修正與範圍見 [覆盤報告](docs/ai-bs12-green-replay-2026-10-09.md)。

2026-10-08 PR #124 修復：server 型別檢查排除測試入口，避免由測試載入瀏覽器專用 hook；測試仍由前端型別檢查與 Vitest 驗證。BS12-082 額外棄牌可用性保留道具的展示代價，單機／線上切換陷阱時清除狀態代價草稿。

2026-10-07 BS12-007 實體宿主修正：`card:BS12-007` 的 Shining Glitter Cookie 已由 BS4-095 換成指定的 EXTRA 卡 BS12-018，透過正式 EXTRA adapter 實體化為 5HP／RRRR／普通4。實際 Equip 會將 Producer Mic 原本 3 張 HP 與宿主舊裝備移入棄牌區，不補位且保留 BS12-018 的 HP；後續以 4 張實體紅色 Arena 支援付款，攻擊實體 BS6-008 Sugar Swan 6→2HP，四張 ST2-007 FLIP 全部進棄牌且 0 次發動。雙尺寸正式裝備流程 32／32、預先裝備／未裝備攻擊對照 4／4、相關 5 檔／168 項、build、全域 lint 與完整 Vitest 799 個結果檔／1,999 suites／16,986 項全部通過。候選仍為 154 inventory／0 promoted，未 commit／push；正式 BS12 與逐卡 online 尚未驗收。閘門：`test-results/bs12-007-bs12-018-gate1.json`。

2026-10-07 BS12-005 使用者回報修復：`card:BS12-005` 現在先顯示實體 Yoga Cookie FLIP 目標選擇，再以 Cheerleader Cookie 本回合被效果設為活躍的條件開放技能；技能可選己方餅乾補 1 HP。修正本機控制器過度停用 AI，結束玩家回合後不再卡在對手活躍階段。5 檔／41 項相關測試、build、全域 lint、雙尺寸 Browser 26／26（通用入口 8 案）及原生 Chrome 的 Mustard Cookie 4→5 HP、AI 完成第 3 回合並進入玩家第 4 回合均通過；最新完整 Vitest 799 個結果檔／1,999 suites／16,983 項（681.48 秒）全部通過。020～023 本輪替換重驗另有 252／252 案，其中 236 案為原始印刷卡與實際父指令，16 案為明確標示的移動／裝備／時機準備式控制。最新預設 HP 診斷剩 12 個標記；正式 BS12、逐卡 online 與 promote 尚未驗收，候選仍為 154 inventory／0 promoted，未 commit／push。閘門：`test-results/bs12-005-user-repair-gate1.json`。

2026-10-05 BS12 裁定後起始 HP 第二批修正016／018（含異圖）及019：8檔／536項相關測試、雙尺寸280案（含18案準備式裝備／時機控制）、build／全域lint／strict154 verified通過；完整Vitest 797檔／16953項通過。018改經真正Arena手牌代價與EXTRA登場配置5HP，疲勞來源有實際RRRR普通4／Then選零父指令；016／019存活對手使用實體Sugar Swan6HP。舊8,906／8,978／8,316累計不作整系列合法起始局面或完整父流程驗收；仍有17個預設HP標記及其他情境／父流程待核對，正式BS12／逐卡online未驗收，候選154／0 promoted，未commit／push。詳細證據與裁定見[目前重驗報告](docs/bs12-rulings-2026-10-05.md)，本批閘門`test-results/bs12-hp-second-repair-gate1.json`。下列為歷史快照。


2026-10-05 BS12 實體卡重驗已處理至112及全部154筆印刷的已確認分支：通用正反入口308個情境逐區比對原始印刷資料、卡圖、唯一ID與每卡至多四張限制；雙尺寸局部實體操作累計8,906案，舊8,316一般累計不當作實體驗收。109～112十一印刷404案，其中398為已確認實體分支、6為109待定Then隔離；112付款前揭露隱藏HP的舊96案撤回，修成正式支付來源及全HP後才選公開棄牌回收目標，重驗96案取代、不重複累加。修補後9檔／394項、build／全域lint／AI Browser／ST1核心同步通過；最新完整Vitest783檔／16,660項（994.07秒）全部通過，1323來源雜湊一致。全系列strict143 verified／11 needs-review／0 blocked，九項規則／來源差異已於112及所有印刷後統一整理，見[裁定清單](docs/bs12-rulings-2026-10-05.md)。候選154 inventory／0 promoted；準備式fixture不代替父流程、待定分支／正式BS12／逐卡online未驗收，未commit／push。下列為第二十四批及更早歷史快照。

2026-10-05 實體卡重驗第二十四批：106～108含107／108異圖，共五筆印刷；157項實體規則與通用情境、6項付款後目標UI、8項strict契約測試，雙尺寸Browser232／232，局部實體卡重驗累計8,508。106固定KK陷阱，先選0～1任意對手本回合攻擊-2，再可棄1任意手牌、回收0～1具有Special Play的Arena餅乾；107固定KN普通2，Then可棄1任意手牌、回收0～1Arena餅乾，不要求Special Play；108免費Activate Once，手牌至多5且另一張己方戰鬥區餅乾同時黑色及Arena，抽0～1，來源與見證餅乾可已REST。107剛棄掉的實體Arena餅乾可立即回收；修正規則驗證時點與UI付款後候選，切換代價清除舊目標。全部情境使用原始印刷資料、原圖、完整屬性與真實指令，無虛構卡。專項3檔／171項、相關14檔／798項、build／全域lint／AI Browser／ST1核心同步exit0；完整Vitest779檔／16,372項（958秒）通過，1317來源雜湊一致。候選154 inventory／0 promoted，109～112及其餘印刷／正式BS12／逐卡online未完成，裁定仍留112與全部印刷後。下列為第二十三批及更早歷史快照。

2026-10-05 實體卡重驗第二十三批：104／105兩筆印刷、57專用場景與63項新增測試，雙尺寸Browser184／184，無隔離控制，局部實體卡重驗累計8,276案。104固定K1抽0～1，再選0～1己方具有印刷Special Play的餅乾本回合攻擊+1；不限Arena／顏色／LV／REST，抽零仍可執行Then。空牌庫由實際Chess Choco普通攻擊與Arena手牌代價觸發Refresh，接續抽牌後才另付道具費用。105固定K1陷阱，必須同張己方戰鬥區餅乾同時為黑色且Arena，選0～1任意對手本回合攻擊-2；Sugar Swan印刷6HP／RRR普通3，先受實際4傷害降至2HP才封鎖陷阱，已用旗標由真正第一張105支付產生。Chrome104付費、抽牌與Then後，Blueberry Cake Hound以剩餘KK支付實際普通3傷害，Butter Roll 4HP→1HP；缺能量時沒有使用入口且區域不變。Chrome105 K1後將Muscle普通4減至2、防守Muscle 4HP→2HP，另一張2HP不變；公開紀錄展開原攻擊後可見Perfect Stage、付款與-2。104 mandatory Refresh完整命令、105攻擊群組紀錄／Sugar Swan父序列／已用105減攻的driver期待已修正，失敗run1／2與中止重複run3紀錄保留。首次104輸出參數用錯覆寫舊default results.json，已另存可用失敗證據且舊檔不作驗收依據。專項6檔／318項、另列不重疊相關4檔／448項、strict2 verified／0 needs-review／0 blocked、build／全域lint／AI Browser／ST1核心同步exit0。最新完整Vitest776檔／16,201項（925.49秒）全部通過，1312來源雜湊一致。兩factory／三通用入口／兩driver／兩既有game測試修正，另一既有physical檔未變更，無引擎／schema／adapter／候選資料變更。106～112共16筆原圖已目視核對、106～108轉接／實際父效果與107付款後新目標草稿已備，但尚未套用或Browser驗收。舊8,316一般累計不代表實體驗收，154 inventory／0 promoted，正式BS12／逐卡online未完成，所有裁定留112與全部印刷後。下列為第二十二批及更早歷史快照。

2026-10-05 實體卡重驗第二十二批：099～103五筆印刷，165專用場景、203項實體身分／印刷HP／實際觸發／通用入口測試；雙尺寸Browser474／474，無隔離控制，局部實體卡重驗累計8,092案。099印刷2HP經真正普通PN2／效果傷害／直接昏厥，支付牌庫頂3張後才回收0～1黑色且Arena棄牌區餅乾；當次昏厥來源在休息區不屬棄牌目標，非昏厥Special Play／道具回手不觸發。100實體黑色LV.1餅乾棄牌Special Play、KK2與免費FLIP回收0～1具Special Play的Arena餅乾分開驗。101印刷2HP／K1普通1後棄恰好1張手牌Arena Cookie才抽0～1，實際FLIP／來源昏厥仍續接；102場景放置與Activate各K1，後者另REST，回收0～1具Special Play的Arena Cookie。103固定K1看牌庫頂4、公開0～1黑色且Arena任意類型卡入手，其餘棄牌，空牌庫由真實Chess Then觸發Refresh。Chrome099牌庫12→9／棄牌2→5／回收後手牌0→1與棄牌5→4，無法支付時禁止付款且區域不變。專項13檔／827項、另列不重疊相關6檔／610項、strict5 verified／0 needs-review／0 blocked、build／全域lint／AI Browser／ST1核心同步exit0；最新完整Vitest775檔／16,138項（919.77秒）全部通過，1311來源雜湊一致。五factory／三通用入口／五driver／三既有game與UI檔修正，另三既有檔未變更沿用；補修通用入口101／102測試期待，保留六案並加強真實卡正反條件。完整full1為775檔／16,138項，其中兩項舊入口期待失敗，紀錄保留；最終full2如下。無引擎／schema／adapter／候選資料變更。104／105完整卡面、實體父效果與63項草稿已備，尚未套用或Browser驗收。舊8,316一般累計不代表實體驗收，105通用入口仍待重驗，154 inventory／0 promoted，正式BS12／逐卡online未完成，所有裁定留112與全部印刷後。下列為第二十一批及更早歷史快照。

2026-10-05 實體卡重驗第二十一批：094～098五筆印刷，167專用場景、220項實體身分／印刷HP／實際觸發／通用入口測試；雙尺寸Browser438／438，無隔離控制，局部實體卡重驗累計7,618案。五張均依實圖黑色屬性，094 LV.3／4HP／NNN普通4，097 LV.1／2HP／N1普通1；095／096／098 LV.1／1HP，實體黑色LV.1餅乾進棄牌的Special Play與KK普通2、三種FLIP分開驗。Licorice印刷LV.2必須實際Activate降LV.1才付代價；095棄任意手牌後0～1己方Arena補1HP，096手牌≤5且己方黑色且Arena餅乾時抽0～2，098黑色且Arena存在時對原LV.2以上HP承載者補1HP。實際普通傷害、救援／昏厥／補位／Refresh、選零／取消／非法代價及補HP超過印刷值均分開驗。Chrome096抽2使牌庫12→10／手牌0→2／棄牌0→1，黑色非Arena不抽牌且正常昏厥，原圖與公開紀錄已驗。專項12檔／722項、另列不重疊相關10檔／531項、strict5 verified／0 needs-review／0 blocked、build／全域lint／AI Browser／ST1核心同步exit0；最新完整Vitest774檔／15,935項（918.08秒）全部通過，1310來源雜湊一致。五factory／三通用入口／五driver／六既有game測試修正，無引擎／schema／adapter／候選資料變更。下一批099～103原圖及實體父效果草稿已備，尚未套用或Browser驗收。舊8,316一般累計不代表實體驗收，105通用入口仍待重驗，154 inventory／0 promoted，正式BS12／逐卡online未完成，所有裁定留112與全部印刷後。下列為第二十批及更早歷史快照。

2026-10-05 實體卡重驗第二十批：089～093十筆印刷，326專用場景、370項身分／張數／通用入口／印刷HP／實際觸發流程通過。雙尺寸Browser876／876，另列4案092預設EXTRA已用隔離控制；局部實體卡重驗累計7,180案。089任意紫色且Arena手牌支付Blocker，只有本張與對手LV.3交戰時封鎖攻擊效果，來源5HP、DJ實際先受2傷害及真實Awaken+2使6HP成為8HP已驗；090來源4HP由Muscle NNN4觸發昏厥，休息區至少4張Blocker餅乾後將0～1己方休息區LV.1任意餅乾移棄牌；091來源2HP由實體PN2攻擊觸發昏厥，先將牌庫頂3張移棄牌才選0～1異名Blocker回手；092實體紫色LV.2以下戰鬥區餅乾進棄牌為代價，休息區至少3張Arena且Blocker後EXTRA登場配置5HP，Gnome3HP代價完整棄置、存活來源的己方昏厥監聽與PPPP4／後攻Then手牌棄置分開驗；093 PPN普通3與恰好兩張己方棄牌區Blocker依序放牌庫底代價、0～1獨立對手追加1分開驗，CreamPuff5HP及Kohlrabi1HP參照已驗。五factory／三通用入口／五driver／七既有game與local／onlineUI測試修正，另補092通用預覽測試的實體Gnome3HP斷言，無規則引擎／轉接／候選資料變更。專項15檔／886項、另列相關12檔／1129項（不重疊）、strict10 verified／0 needs-review／0 blocked，build／全域lint／AI Browser／ST1核心同步exit0。最新完整Vitest 773檔／15,715項（914.51秒）全部通過，1309來源雜湊一致。第一次全套2項舊092通用HP預期失敗已保留；補修後專項4檔／418項、build與該檔lint通過，再跑上述全套。全域104個factory無虛構卡直接建立呼叫；103個預設情境仍30個factory／30個餅乾高於印刷HP，僅診斷，實際補HP可能合法。下一批094～098五原圖與獨立預期已備，原始167唯讀場景59案屬性差異紀錄保留，實體草稿167案無屬性差異、220項身分／印刷HP／實際觸發／通用入口測試通過，尚未修改產品。舊8,316一般累計不代表實體驗收，105通用入口仍待重驗、不推進106，154 inventory／0 promoted，正式BS12／逐卡online未完成；所有裁定留112與全部印刷後。下列為第十九批及更早歷史快照。

2026-10-05 實體卡重驗第十九批：084～088六筆印刷，127專用場景、139項身分／張數／通用入口／起始印刷HP／實際觸發流程檢查通過。雙尺寸Browser404／404，另列8案086／087準備式禁用／已用隔離控制；局部實體卡身分與操作重驗累計6,304案。084 P1＋REST來源＋兩張己方棄牌區Blocker依序放牌庫底，對手手牌至少6張才由對手棄1，異色／非Arena參照與未達門檻付款後no-op已驗；085 P1道具於己方棄牌區至少5張Blocker餅乾時將全部一般棄牌與自身洗回牌庫，四張反例、DJ付款後新門檻已驗；086 P1陷阱選0～1己方Blocker至下次己方回合結束前攻擊傷害+2，087 PP陷阱對手0～1本回合攻擊傷害-2、己方棄牌區至少10張Arena卡才對同目標再-1，陷阱自身進棄牌時點及選零已驗；088兩印刷從3HP開始，由實體Onion PPP3傷害觸發昏厥，紫色且Arena任意手牌支付Blocker及另一筆任意色Arena手牌支付昏厥抽0～2分開驗，PN普通1、最後HP FLIP救援／Refresh已驗。五factory／三通用入口／五driver與088既有game／local／online UI測試改依實際印刷HP受傷流程，無規則引擎／轉接／候選資料變更。專項13檔／559項、另列相關11檔／990項（不重疊），strict6 verified／0 needs-review／0 blocked，build／全域lint／AI Browser／ST1核心同步exit0。最新完整Vitest 772檔／15,345項（907.45秒）全部通過，1308來源雜湊一致。全域104個BS12 factory已無虛構卡直接建立呼叫，但仍需印刷屬性／起始HP／實際觸發流程及瀏覽器逐卡核驗；103個可建立預設情境仍32個factory／32個餅乾高於印刷HP，僅診斷，補HP可能合法。下一批089～093十印刷草稿；舊8,316一般累計不代表實體驗收，105通用入口仍待重驗、不推進106，154 inventory／0 promoted，正式BS12／逐卡online未完成；084／085 EXTRA生命週期及所有裁定留112與全部印刷後。下列為第十八批及更早歷史快照。

2026-10-05 實體卡重驗第十八批：079～083五筆印刷，98專用場景、118項身分／張數／通用入口／起始印刷HP／實際父流程檢查通過。雙尺寸Browser272／272，另列4案080準備式裝備／082多DJ隔離，不當作印刷父流程或R005裁定驗收；局部實體卡身分與操作重驗累計5,900案。079印刷2HP、N1普通1，真實五色支付與PinkChoco1HP昏厥；080棄任意手牌FLIP選0～1己方Arena補1HP，真實PinkChoco傷害揭示／自身最後HP救援／CreamPuff印刷5HP後續傷害、各色Arena及非Arena反例，補HP可高於印刷值；081任意紫色且Arena手牌支付Blocker（含道具／場景／陷阱），不加REST／Once／Your Turn，真實Peach2HP第二次回應；082對手道具額外棄任意手牌＋原能量，原道具代價與付款後手牌門檻、取消與第二次發動、非戰鬥區DJ反例；083 P1選0～1己方棄牌區Blocker特殊登場，實體Pudding2HP／Affogato3HP、付款後新目標與選零／短牌庫／Refresh。五factory／三通用入口／五driver與BS1正式參照改為實體資源，BS1追加於既有查找後；三既有測試改依印刷HP預期，另修正通用預覽測試仍期待080中立入口，增加精確FLIP父流程與負向入口斷言，無規則引擎／轉接／候選資料變更。專項11檔／351項、另列相關10檔／872項（不重疊），strict5 verified／0 needs-review／0 blocked，build／全域lint／AI Browser／ST1核心同步exit0。最新完整Vitest 771檔／15,206項（905.12秒）全部通過，1307來源雜湊一致。最新2個factory／2處虛構卡直接呼叫待修；全域103個可建立預設情境仍33個factory／34個餅乾高於印刷HP，僅診斷，補HP可能合法，仍需逐卡核對實際來源與父流程。下一批084～088六印刷；舊8,316一般累計不代表實體驗收，105通用入口仍待重驗、不推進106，154 inventory／0 promoted，正式BS12／逐卡online未完成，全部裁定留112及所有印刷後。下列為第十七批及更早歷史快照。

2026-10-05 實體卡重驗第十七批：074～078七筆印刷，180專用場景、201項身分／張數／通用入口／起始印刷HP／實際父流程檢查通過。雙尺寸Browser470／470，另列30案074準備式事件／077裝備機制隔離，不當作印刷父流程驗收；局部實體卡身分與操作重驗累計5,628案。074實際072使Arena餅乾放底後EXTRA登場5HP、後攻OnPlay抽0～2、BBB普通3後符合LV2且Arena底牌入手，再選0～1對手最上方HP放底；075棄任意手牌＋REST來源，不加能量／Once，對手至少5手牌自行棄1，4張仍支付後no-op、PP普通2；076印刷4HP、NNN普通4；077印刷3HP與PN普通1、Rockstar單次戰鬥Blocker封鎖已驗，Equip生命週期仍待裁定；078實際傷害揭示FLIP，棄任意紫色且Arena手牌（含道具／場景／陷阱）、對手至少5手牌自行棄2，4張no-op、PPP普通3與PinkChoco1HP昏厥已驗。五factory／三通用入口／五driver改為實體資源；074舊hook與Browser寫死卡名改依獨立實體卡預期，無規則引擎／轉接／候選資料變更。專項11檔／650項、另列相關18檔／2,077項（僅卡名斷言修正後重跑4項，其餘17檔原通過且未變更）；strict6 verified／1 needs-review（077）／0 blocked，build／全域lint／AI Browser／ST1核心同步exit0。最新完整Vitest 770檔／15,088項（894.54秒）全部通過，1306來源雜湊一致。最新7個factory／9處虛構卡呼叫待修；全域103個可建立預設情境仍35個factory／37個餅乾高於印刷HP，僅診斷，補HP可能合法，仍需逐卡核對實際來源與父流程。下一批079～083；舊8,316一般累計不代表實體驗收，105通用入口仍待重驗、不推進106，154 inventory／0 promoted，正式BS12／逐卡online未完成，全部裁定留112及所有印刷後。下列為第十六批及更早歷史快照。

2026-10-05 實體卡重驗第十六批：069～073九筆印刷，253專用場景、290項身分／張數／通用入口／起始印刷HP／實際父流程檢查通過。雙尺寸Browser664／664（069 64、070兩印刷148、071兩印刷128、072兩印刷148、073兩印刷176），另列20案準備式Equip／Awaken清理隔離，不當作印刷父流程驗收；局部實體卡身分與操作重驗累計5,158案。069 BB道具揭示符合LV2且Arena餅乾才入手並對0～1對手造成1傷害；070 BB普通2後匹配底牌入手、全部對手各1效果傷害，實體GingerBrave3HP免疫及Sorbet2HP／PinkChoco1HP昏厥反例已驗；071免費Once啟動，匹配底牌才可棄來源並Special Play，不加能量／REST；072 B Once選0～1另一張己方LV2以下Arena放牌庫底、BB普通2，整段攻擊Then仍R004待裁定；073實際2HP登場、底牌符合LV2且Arena且非DJMiya才入手，Then對手至少6手牌自行棄1，BB普通2後任意手牌代價＋來源放底已驗。修正五factory／三通用入口與BS3實體參考，舊070測試依勇敢餅乾印刷HP3修正，無規則引擎／轉接／候選資料變更。專項11檔／900項、另列相關23檔／2,045項；strict7 verified／2 needs-review（072兩印刷）／0 blocked，build／全域lint／AI Browser／ST1核心同步exit0。最新完整Vitest 769檔／14,887項（879.43秒）全部通過，1305來源雜湊一致。最新10個factory／14處虛構卡呼叫待修；全域103個可建立預設情境仍37個factory／39個餅乾高於印刷HP，僅診斷，補HP可能合法，仍需逐卡核對實際來源與父流程。下一批074～078；舊8,316一般累計不代表實體驗收，105通用入口仍待重驗、不推進106，154 inventory／0 promoted，正式BS12／逐卡online未完成，全部裁定留112及所有印刷後。下列為第十五批及更早歷史快照。

2026-10-05 實體卡重驗第十五批：064～068五筆印刷，110專用場景、124項實體／通用入口／起始印刷HP／實際父流程檢查通過。雙尺寸Browser268／268（064 46、065 56、066 48、067 62、068 56），另列8案065／066手動disabled／used旗標隔離，不重複累計；局部實體卡身分與操作重驗累計4,494案。064真實登場5HP、揭示牌庫底符合LV2且Arena餅乾才加入手牌並抽0～2，BBN普通3；065付B、0～1對手本回合普通傷害-1，Then公開符合LV2且Arena手牌放牌庫底才抽0～1；066付B、揭示符合牌庫底才入手並選0～1對手本回合普通傷害-2；067實際B放置與Activate B＋REST來源、底牌匹配入手，不加Once；068付B抽0～1，Then己方支援至少少兩張才回收0～2對手支援到其手牌。修正064共用目標為實體Sugar Swan6HP，074舊hook依實際選中實體卡名驗證；064原圖按卡號精確核對，065／066取消與阻擋保留實際登場／跳過OnPlay／戰鬥結算指令。專項11檔／449項、另列相關30檔／2,467項；strict5 verified／0 needs-review／0 blocked、主效果5 supported／能力5 converted，build／全域lint／AI Browser／ST1核心同步exit0。最新完整Vitest 768檔／14,597項（879.86秒）全部通過，1304來源雜湊一致。最新11個factory／16處虛構卡呼叫待修；全域103個可建立預設情境仍37個factory／39個餅乾高於印刷HP，僅診斷，補HP可能合法，之前／其餘情境需核對來源與父流程。下一批069～073九筆完整原圖、獨立預期及前置診斷已備，仍待本批後失敗基線。舊8,316一般累計不代表實體驗收；105通用入口仍待重驗、不推進106；154 inventory／0 promoted，正式BS12／逐卡online未完成，所有裁定112及全部印刷後。下列為第十四批及更早歷史快照。

2026-10-05 實體卡重驗第十四批：059～063五筆印刷，88專用場景、102項實體／通用入口／起始印刷HP／實際父流程檢查通過。雙尺寸Browser178／178（059 24、060 64、061 32、062 18、063 40），另列40案裝備／效果歷史隔離，不重複累計；局部實體卡身分與操作重驗累計4,226案。059 NNN普通4與4HP、061 N普通1與實際登場2HP；060實際FLIP棄任意手牌後0～1己方Arena補1HP，實體各色／非Arena／來源／Refresh／跟進傷害與BB普通2；062已確認BN普通1、實際登場3HP及裝備合法性一般分支，裝備生命週期仍needs-review；063 exact己方戰鬥區Popping Candy條件、實體普通0／1／2／3／4傷害及來源／另一對手、BB普通3與實際登場2HP。修正060舊測試統一3HP為各印刷數值，補HP可超過印刷HP；059／061非主要階段改為穩定支援階段，避免UI自動活躍／抽牌改變反例。專項11檔／331項、另列相關16檔／1,573項與重疊phase補驗3檔／145項；strict4 verified／1 needs-review（062）、主效果3 supported／2 no-effect、能力3 converted／2 not-applicable，build／全域lint／AI Browser／ST1核心同步exit0。最新完整Vitest 767檔／14,473項（852.92秒）全部通過，1303來源雜湊一致。最新15個factory／22處虛構卡呼叫待修；全域103個可建立預設情境仍47個factory／49個餅乾高於印刷HP，僅診斷、實際補HP可能合法，之前／其餘情境需核對來源與父流程。下一批064起原圖與獨立預期準備中。舊8,316一般累計不代表實體驗收；105通用入口仍待重驗、不推進106；154 inventory／0 promoted，正式BS12／逐卡online未完成，所有裁定112及全部印刷後。下列為第十三批及更早歷史快照。

2026-10-04 實體卡重驗第十三批：054～058含全部九筆印刷，206專用場景、232項實體／通用入口／起始印刷HP／實際父流程檢查通過。雙尺寸Browser628／628（054兩印刷144、055兩印刷136、056兩印刷160、057 76、058兩印刷112），另列16案裝備／已用旗標／時機隔離，不重複累計；局部實體卡身分與操作重驗累計4,048案。054任意支援棄牌後回收0～1任意餅乾疲勞；055同張卡本回合由支援登場才可棄任意手牌及來源，牌庫頂0～1任意卡入支援疲勞；056實際EXTRA依己方Arena Candy Apple或七張綠色支援登場3HP，後攻NN普通2後棄任意手牌活躍0～1任意己方支援；057實際登場4HP、棄蓝色且Arena任意手牌將對手0～1 LV2以下餅乾放牌庫底；058實際FLIP印刷，Arena任意手牌公開放牌庫底後抽0～2。修正056／057／058 Refresh棄牌區缺少實體可選餅乾，以及058異圖測試必須同時核對canonical基礎ID與原始印刷圖。專項11檔／641項、另列相關18檔／1,336項，strict9／9、主效果5 supported／能力5 converted、Then1／1，build／全域lint／AI Browser／ST1核心同步exit0。最新完整Vitest 766檔／14,371項（844.37秒）全部通過，1302來源雜湊一致。最新20個factory／29處虛構卡呼叫待修；下一批059～063五筆原圖已逐張讀取、88情境唯讀基線待修。全域103個可建立預設情境仍52個factory／54個餅乾高於印刷HP，僅診斷、實際補HP可能合法，之前／其餘情境需核對來源與父流程。舊8,316一般累計不代表實體驗收；105通用入口仍待重驗、不推進106；154 inventory／0 promoted，正式BS12／逐卡online未完成，所有裁定112及全部印刷後。下列為第十二批及更早歷史快照。

2026-10-04 實體卡重驗第十二批：049～053含全部八筆印刷，140專用場景、164項實體／通用入口／起始印刷HP／實際前置指令檢查通過。雙尺寸Browser500／500（049 68、050 56、051兩印刷116、052兩印刷140、053兩印刷120），另列12案隔離旗標／時機，不重複累計；局部實體卡身分與操作重驗累計3,420案。049可退回剛用於G付款的Arena支援卡；050固定GGG後把己方棄牌區0～1 Arena Cookie放到支援疲勞；051實際G普通1後從己方支援登場Arena Cookie並給印刷HP；052實際051攻擊Then或048場景登場後才可棄任意手牌對0～1對手造成1，手牌登場反例不觸發；053實際Langue NNN普通4開回應，棄任意己方支援後對0～1對手普通攻擊－2，GGGN普通3後所有己方支援疲勞才全體追加1。修正053另一受攻擊對象實體Melon Soda印刷4HP卻放6HP的兩個情境，未新增規則HP上限。專項11檔／409項、另列相關15檔／1,200項，最後164項測試重跑通過；strict8／8、主效果4 supported／1 no-effect、能力4 converted／1不適用、Then2／2，build／全域lint／AI Browser／ST1核心同步exit0。最新完整Vitest 765檔／14,139項（839.62秒）全部通過，1301來源雜湊一致。最新22個factory／32處虛構卡呼叫待修；下一批054～058九筆印刷已逐張讀完整卡面，206情境基線待修。全域103個可建立預設情境仍55個factory／57個餅乾高於印刷HP，僅診斷、實際補HP可能合法，之前／其餘情境需核對來源與父流程；累計身分／局部操作不代表所有初始局面合法。舊8,316一般累計不代表實體驗收；105通用入口仍待重驗、不推進106；154 inventory／0 promoted，正式BS12／逐卡online未完成，所有裁定112及全部印刷後。下列為第十一批及更早歷史快照。

2026-10-04 實體卡重驗第十一批：044～048五筆印刷，99專用場景、111項實體／通用入口／印刷HP／前置指令檢查通過，各區域符合實際卡片、原圖、唯一ID與同卡最多四張。雙尺寸Browser314／314（044 68、045 54、046 52、047 62、048 78），另列6案隔離機制，不重複累計；局部實體卡身分與操作重驗累計2,920案。044／045改用印刷6HP的實體Sugar Swan；046離場路徑經實體Herb Teapot登場、Tower of Sweet Chaos付款／橫置／昏厥及不補位，仍可觸發Camera抽牌；047以實體Langue de Chat付三張支援宣告攻擊，使用印刷5HP的Shining Glitter防守，完整核對陷阱／抽牌／Refresh／逐點傷害指令。共享053回應前置改用實體Langue NNN普通4與印刷4HP，修正繼承Sugar Swan後付款顏色不合法的56項回歸失敗；053其餘資源尚未全實體驗收。專項11檔／275項、另列相關23檔／1,400項，strict5／5、主效果5 supported、能力5 converted、Then0；build／全域lint、AI Browser及ST1好友房核心同步exit0。最新完整Vitest 764檔／13,975項（829.83秒）全部通過，1300來源雜湊一致。最新25個factory／36處虛構卡呼叫待修；下一批049～053含全部印刷。全域起始HP盤點103個可建立情境中55個factory／57個餅乾高於印刷HP，實際補HP可能合法，仍須逐一核對實體來源；累計身分／局部操作不代表全部初始局面合法。舊8,316一般累計不代表實體驗收；105通用入口仍待重驗、不推進106；154 inventory／0 promoted，正式BS12／逐卡online未完成，所有裁定112及全部印刷後。下列為第十批及更早歷史快照。

2026-10-04 實體卡重驗第十批：040～043四筆印刷，69專用場景、87項實體／通用入口／FLIP紀錄／印刷HP檢查通過，各區域符合實際卡片、原圖、唯一ID與同卡最多四張。雙尺寸Browser194／194（040 56、041 22、042 56、043 60），局部實體重驗累計2,606案；042／043實體BS6-017攻擊者起始HP修正為印刷1，043符合條件的支援道具／場景使用實體BS7-063／065，042裝備排除使用合法實體BS4-095。修正FLIP支援疲勞公開紀錄，顯示實際目標與原已疲勞／選零結果；10項實體紀錄回歸通過。專項10檔／239項、另列相關34檔／1,871項，strict4／4、主效果3 supported／1無效果、能力3 converted／1不適用、Then0；build／全域lint、AI Browser及ST1好友房核心同步exit0。最新完整Vitest 763檔／13,864項（833.52秒）全部通過，1299來源雜湊一致。最新30個factory／44處虛構卡呼叫待修；下一批044～048含全部印刷。舊8,316一般累計不代表全實體驗收；105通用入口仍待重驗、不推進106；154 inventory／0 promoted，正式BS12／逐卡online未完成，所有裁定112及全部印刷後。下列為第九批及更早歷史快照。 全域唯讀起始HP盤點：104個factory中103個可建立，65個factory／67個場上餅乾的HP高於印刷值，需逐一核對實體補HP來源；印刷HP不是規則上限，此數字不能直接當成65個違規。已通過的實體卡身分與局部操作累計，仍不代表全系列所有初始局面及父指令已合法驗收。

2026-10-04 實體卡重驗第九批：036～039七筆印刷，124專用場景、147項實體／通用入口／條件紀錄檢查通過，各區域均符合實際印刷資料、原圖、唯一ID與同卡最多四張。雙尺寸Browser322／322（036 72、037 140、038 88、039 22），局部實體重驗累計2,412案；038以實際BS7-055技能從支援區登場，排除虛構對手回合觸發。修正條件不成立或來源非支援區的登場紀錄誤寫為玩家選擇不發動，10項038實體紀錄回歸、6項實體BS11-114固定棄牌後手牌門檻紀錄回歸，以及036／038共用Browser36案重驗通過（不重複累計）。專項12檔／396項、另列相關26檔／1,618項，strict5 verified／2 needs-review（036 R003），主效果3 supported／1無效果、能力3 converted、Then1 converted／1 pending；build／全域lint、AI Browser及ST1好友房核心同步exit0。最新完整Vitest 761檔／13,777項（827.72秒）全部通過，1297來源雜湊一致。最新34個factory／50處虛構卡呼叫待修；下一批040～043含全部印刷。舊8,316一般累計不代表全實體驗收；105通用入口仍待重驗、不推進106；154 inventory／0 promoted，正式BS12／逐卡online未完成，所有裁定112及全部印刷後。下列為第八批及更早歷史快照。

2026-10-04 實體卡重驗第八批：032～035八筆印刷，218場景、230項新實體／入口／真實BS8-010流程檢查通過，所有區域及翻開HP符合原始資料、原圖、唯一ID、同卡最多四張及合法裝備對象。雙尺寸Browser292／292（032／033普通攻擊各36、Arena FLIP各24、034 104、035 68），另列12／12實體非Arena直接昏厥控制、不加入局部實體重驗累計2,090案。修正巢狀FLIP後原受攻擊對手HP歸零卻未昏厥的引擎錯誤，12項真實卡回歸通過。專項8檔／483項、另列相關34檔／1,214項，strict6 verified／2 needs-review（035 R002），主效果4 supported／能力4 converted；build／全域lint、AI Browser及ST1好友房核心同步均exit0。最新完整Vitest 758檔／13,630項（820.48秒）全部通過，1294來源雜湊一致。最新38個factory／56處虛構卡呼叫待修；下一批036～039含全部印刷，R001／R002／R003裁定分支繼續隔離。舊8,316一般累計不代表全實體驗收；105通用入口仍待重驗、不推進106；154 inventory／0 promoted，正式BS12／逐卡online未完成，所有裁定112及全部印刷後。下列為第七批及更早歷史快照。

2026-10-04 實體卡重驗第七批：022裝備配對補修與029～031三張卡；72場景、77項新實體／入口／真實陷阱流程檢查通過，所有區域及翻開HP符合原始資料、原圖、唯一ID、同卡最多四張及Producer Mic合法裝備對象。雙尺寸Browser228／228（022補驗2、029 74、030 80、031 72），新增226案加恢復022撤回2案，局部實體重驗累計1,798案。專項5檔／377項、另列相關14檔／951項、strict4／4、主效果4 supported／能力4 converted，build／全域lint均exit0；最新完整Vitest 756檔／13,388項（808.14秒）全部通過，1292來源雜湊一致。最新41個factory／59處虛構卡呼叫待修；下一批032～035含全部印刷，R001／R002裁定分支繼續隔離。舊8,316一般累計不代表全實體驗收；105通用入口仍待重驗、不推進106；154 inventory／0 promoted，正式BS12／逐卡online未完成，所有裁定112及全部印刷後。下列為第六批及更早歷史快照。

2026-10-04 實體卡重驗第六批：024～028五筆印刷，通用card／card-negative已接各卡效果與阻擋資源。87個場景、94項實體身分與入口檢查通過，所有區域／翻開HP均符合原始印刷資料、原圖、唯一ID及同卡最多四張。雙尺寸Browser268／268（024 30、025 48、026 74、027 66、028 50），專項6檔／329項、另列相關15檔／1,026項通過；strict5／5、主效果3 supported／2 no-effect、能力3 converted／0 pending、攻擊Then1／1，build／全域lint均exit0。最新完整Vitest 755檔／13,311項（833.17秒）全部通過，1291來源雜湊一致。局部實體重驗操作原計1,572案，其中022裝備對象不合法的雙尺寸2案已撤回，暫列1,570案；舊8,316一般累計不代表全實體驗收。最新44個factory／65處虛構卡呼叫待修，其他factory仍需身分與操作核驗；下一批022裝備配對補修加029～031；032／033兩種印刷已唯讀盤點、裁定分支繼續隔離。105通用入口仍待重驗、不推進106；154 inventory／0 promoted，正式BS12／逐卡online未完成；所有裁定112及全部印刷後。下列為第五批與更早歷史快照。

2026-10-04 實體卡重驗第五批：019～023含021@1六筆印刷，通用card／card-negative已接各卡效果與阻擋資源，99個場景及通用入口全部核對原始印刷資料、原圖、唯一ID及同卡最多四張，涵蓋所有區域與翻開HP。雙尺寸Browser272／272（019 20、020 48、021兩印刷100、022 50、023 54），106項實體檢查、專項6檔／320項與最終相關21檔／1,245項通過（後者包含專項，不相加），strict6／6、效果覆蓋4 supported／1 no-effect、能力4 converted／0 pending；build／全域lint均exit0。最新完整Vitest 754檔／13,217項（798.45秒）全部通過，1290來源雜湊一致。局部實體重驗累計1,304案；舊8,316一般累計不代表全實體驗收。最新49個factory／76處虛構卡呼叫待修，其他factory仍需身分與操作核驗；下一批024～028含全部印刷。105通用入口仍待重驗、不推進106；154 inventory／0 promoted，正式BS12／逐卡online未完成；所有裁定112及全部印刷後。下列為第四批與更早歷史快照。

2026-10-04 實體卡重驗第四批：014～018含全部@1十筆印刷，通用card／card-negative已接各卡效果與阻擋資源，全部場景核對原始印刷資料、原圖、唯一ID及同卡最多四張；身分檢查器亦涵蓋EXTRA與Awaken底卡。雙尺寸Browser568／568（014 64、015 96、016 120、017 148、018 140），216項新增實體檢查、專項6檔／606項及相關9檔／465項通過，strict10／10、效果覆蓋5／5與攻擊Then4／4，build／全域lint均exit0。最新完整Vitest 753檔／13,111項（797.66秒）全部通過，1289來源雜湊一致。局部實體重驗累計1,032案；舊8,316一般累計不代表全實體驗收。最新54個factory／90處虛構卡呼叫待修，其他factory仍需身分與操作核驗；下一批019～023含021@1。105通用入口仍待重驗、不推進106；154 inventory／0 promoted，正式BS12／逐卡online未完成；所有裁定112及全部印刷後。下列為第三批與更早歷史快照。

2026-10-04 實體卡重驗第三批：009～013 通用 card／card-negative 入口已連接各卡效果與阻擋情境，全部場景資源核對原始印刷資料、原圖、唯一 ID 與同卡最多四張。雙尺寸 Browser 182／182（009 34、010 42、011 34、012 34、013 38）、新實體檢查37項、專項6檔／170項與相關14檔／598項通過（重疊不相加）；build／全域lint均exit0。最新完整 Vitest 752檔／12,895項（793.72秒）、exit0及1288來源雜湊一致。局部實體卡重驗累計464案，舊8,316一般累計不代表全實體驗收。最新59個factory／116處虛構卡呼叫待修，其他factory仍需身分與操作核驗；下一批014～018含全部@1。105通用入口仍待重驗、不推進106；154 inventory／0 promoted、正式BS12／逐卡online未完成，全部裁定112與所有印刷後。下列為第二批與更早歷史快照。

2026-10-04 實體卡重驗第二批：005～008及異圖Browser148／148、12檔／491項回歸通過，連同首批實體卡重驗累計184案。105另補31項實體身分檢查並修正參照卡印刷顏色，專項147＋online元件14項、最新build／全域lint通過；105 Browser98／98已通過，局部實體卡重驗累計282案；103～105 full3最終751檔／12,858項（828.93秒）、exit0及1287來源雜湊一致。最新待修為63個factory／139處虛構卡呼叫，其餘仍需執行期核驗；所有驗收資源一律用實體卡原圖及印刷屬性，舊8,316累計不代表全實體卡驗收。下一批009～013，154 inventory／0 promoted、正式／逐卡online未完成，裁定仍112及全部印刷後。下列首批與一般累計為歷史快照。

2026-10-04 實體卡場景重驗：所有驗收資源須使用實體印刷卡與原圖，通用BS12入口須提供對應效果情境。001～004及092兩印刷已修正，雙尺寸Browser36／36、12檔／462項回歸、build／全域與新增腳本lint通過。靜態盤點仍有68個factory／160處虛構卡呼叫待修正；舊8,316累計不代表本次全實體卡驗收。105批末完整測試兩次中斷、不計通過，下一批重驗005～008；154 inventory／0 promoted、正式／逐卡online未完成，裁定仍112及全部印刷後。詳見[實體卡重驗進度](docs/bs12-progress-2026-09-30.md)。

2026-10-04：104候選局部Browser86／86、專項3檔／119項（卡牌39含38個有效runtime語意變異、規則69、實際OnlineBattleView／OnlineActivityFeed11）、受影響19檔／1,072項（含專項，不相加）、strict1／1、build／全域lint通過。K1抽0～1後獨立選0～1己方戰鬥區具有印刷Special Play的Cookie，本回合攻擊+1；抽零仍接Then，Arena普通餅乾不符，不限Arena／LV／REST。修復online抽牌面板優先序及公開抽牌紀錄洩漏私密手牌；Chrome正反與實際3傷害通過，共用031八案另列。一般8,316、cursor105、剩8基礎／17印刷；1,275來源雜湊一致。最新完整737檔／12,384項屬102、103／104修改前，103～105全套及AI／ST1留105批末。154 inventory／0 promoted，正式BS12／逐卡online未完成，所有裁定112及全部印刷後統一提報。

2026-10-04：103候選局部Browser86／86、專項3檔／134項（卡牌39含38個runtime語意變異、規則86、實際OnlineBattleView／OnlineActivityFeed9）、最終受影響17檔／679項（含專項，不相加）、strict1／1、build及全域lint＋最後新增檔scoped lint通過。K1檢視己方牌庫頂四張，展示0～1張同時黑色且Arena的任意卡加入手牌，其餘全進棄牌區；選牌前對手看不到檢視內容。修正Refresh後來源道具進入檢視牌堆時的紀錄卡圖遺失。共用BS11-104／109雙尺寸8案另列，原生Chrome正反通過。一般累計8,230、局部cursor104、剩9基礎／18印刷；1271個凍結來源雜湊一致。最新完整737檔／12,384項及AI／ST1屬100～102、103修改前歷史結果，103～105新全套／共用驗證留105批末。080原使用者通用入口已恢復正常。154 inventory／0 promoted、正式BS12／逐卡online未完成，裁定仍112及所有印刷後；下列102及更早為歷史快照。

2026-10-04：102候選局部Browser88／88、專項3檔／120項（卡牌36含35個runtime語意變異、規則79、OnlineBattleView5）、最終受影響16檔／875項（含專項，不相加）、strict1／1、build／全域lint通過。K1放置，另付K1＋REST來源後回收0～1己方棄牌區同時具Arena與Special Play的Cookie；修正online場景漏顯REST代價步驟。BS12通用card入口漏載候選造成080崩潰已修，單元6項與雙尺寸載入／FLIP略過12案另列、不加語意累計；原生Chrome原網址恢復。一般累計8,144、局部cursor103、剩10基礎／19印刷；100～102批末完整Vitest 737檔／12,384項（830.51秒）全部通過／exit0，1267個凍結來源雜湊全部一致，full1為修復使用者回報入口而中斷，不計通過；AI Browser六項UI／ST1核心同步以最終build重驗均exit0。103～105原圖及獨立預期已備，下一張103尚未修改產品實作。154 inventory／0 promoted、正式BS12／逐卡online未完成；全部裁定112及所有印刷後。下列101及更早為歷史快照。

2026-10-04：101候選局部Browser100／100、專項4檔／126項（卡牌33含32個runtime語意變異、規則86、OnlineBattleView4、抽牌UI3）、受影響22檔／746項（含專項，不相加）、strict1／1、build／全域lint通過。黑色Arena LV1／HP2、K1普通1後可選棄1張Arena餅乾手牌，再抽0～1。修正公開休息區來源卡名／卡圖、代價餅乾類型提示與抽牌縮小後選取重設；交集／區域反例、選零／略過／取消、FLIP先結算／來源昏厥Then續接、Refresh／LV10已驗。共用026／065雙尺寸16案另列，原生Chrome正反與實際CDN通過。一般累計8,056、cursor102、剩11基礎／20印刷；1262個來源雜湊一致。100～102批末全套及AI／ST1待102完成後，726檔／11,996項屬097～099、100／101修改前歷史結果。154 inventory／0 promoted、正式BS12／逐卡online未完成；全部裁定112及所有印刷後。

2026-10-04：100候選局部Browser116／116、專項3檔／136項（卡牌39含38個runtime語意變異、規則95、UI2）、受影響14檔／665項（包含專項，不相加）、strict1／1、build／全域lint通過。黑色Arena LV1／HP1、黑色有效LV1戰鬥區Special Play、KK普通2；免費FLIP回收0～1己方棄牌區同時具Arena與Special Play的Cookie。修正共用FLIP棄牌回收選取及實際公開紀錄，同名／交集與區域反例、選零／反選／取消、最後HP昏厥／補位、099續接、Refresh與LV10已驗；共用098十二案另列，原生Chrome正反另確認。一般累計7,956、cursor101、剩12基礎／21印刷；1257個來源雜湊一致。100～102批末全套及AI／ST1待102完成後；726檔／11,996項及AI／ST1屬097～099、100修改前歷史結果。154 inventory／0 promoted、正式BS12／逐卡online未完成；全部裁定112及所有印刷後。

2026-10-04：099候選局部Browser80／80、專項2檔／122項（卡牌33含32個runtime語意變異、規則89）、受影響13檔／460項（包含專項，不相加）、strict1／1、build／全域lint通過。黑色Arena LV1／HP2、KK普通2；來源昏厥後先支付牌庫頂三張，再回收0～1己方棄牌區黑色且Arena餅乾，同名及LV1／LV3皆可。新棄入目標、交集／區域反例、選零／不付費、FLIP救援、Refresh／LV10及非昏厥送棄已驗，原生Chrome正反另確認。一般累計7,840、cursor100、剩13基礎／22印刷；1253個來源雜湊一致。097～099批末完整Vitest 726檔／11,996項（769.04秒）全部通過／exit0，1253個凍結來源雜湊一致。共用AI Browser六項UI檢查與ST1好友房核心同步均exit0；不等同BS12逐卡online或完整對局至勝負。154 inventory／0 promoted、正式BS12／逐卡online未完成；全部裁定112及所有印刷後。

2026-10-04：098候選局部Browser112／112、卡牌／規則2檔93項及共用預覽4項、受影響15檔／741項（包含專項，不相加）、strict1／1、build／全域lint通過。黑色Arena LV1／HP1、黑色有效LV1戰鬥區Special Play、KK普通2及免費FLIP固定原LV2以上HP持有者補1HP已驗；LV1／交集與區域反例、最後HP救援／昏厥、Refresh／LV10通過。修正共用快速預覽漏顯Special Play，095／096／097／098雙尺寸8案另列；原生Chrome正反另確認。一般累計7,760、cursor099、剩14基礎／23印刷；1250個來源雜湊一致。719檔／11,724項與AI／ST1屬097／098修改前，097～099全套留099批末。154 inventory／0 promoted、正式BS12／逐卡online未完成；全部裁定112及所有印刷後。

2026-10-04：097候選局部Browser42／42、專項2檔／53項（包含於四檔108項097／094回歸）、受影響10檔／539項（包含專項，不相加）、strict1／1、build／全域lint通過。黑色Arena LV1／HP2、N1普通1與六色支援支付、未選支援保留、取消／反選／改選目標、昏厥及最後HP控制FLIP已驗；新增strict guard拒絕16個真實runtime語意變異，普通轉接原已正確。原生Chrome紫色支付／取消／無能量阻擋／兩HP登場與原圖746×1038另確認。一般累計7,648、cursor098、剩15基礎／24印刷；719檔／11,724項（773.98秒）及AI／ST1共用驗證為094～096、097修改前歷史證據，097～099全套留099批末。154 inventory／0 promoted、正式BS12／逐卡online未完成；全部裁定112及所有印刷後。

2026-10-04：096候選局部Browser126／126、專項3檔／92項、受影響19檔／806項（包含專項，不相加）、strict1／1、build／全域lint通過。黑色Arena LV1／HP1、黑色LV1戰鬥區Special Play、KK普通2、己方手牌最多五且同張己方黑色Arena戰鬥區Cookie才免費抽0～2已驗。手牌五→七、零HP來源／抽後昏厥／抽出Cookie補位、區域及交集反例、Refresh／LV10均通過；共用詳情漏顯Special Play及誤標FLIP已修正，095／096詳情四案、095操作十二案另列。一般累計7,606、cursor097、剩16基礎／25印刷；094～096批末完整Vitest 719檔／11,724項（773.98秒）、AI Browser與ST1好友房核心同步全部exit0；1242個凍結來源雜湊一致。ST1為共用核心同步，未驗完整對局至勝負或BS12逐卡online。154 inventory／0 promoted、正式BS12／逐卡online未完成；全部裁定112及所有印刷後。

2026-10-04：095候選局部Browser114／114、專項4檔／119項、受影響兩組不重疊14檔／605項（包含專項，不相加）、strict1／1、build／全域lint通過。黑色Arena LV1／HP1，黑色LV1戰鬥區餅乾Special Play代價、一般一HP登場、KK普通2、棄任意手牌後0～1己方Arena補HP、救援／昏厥／Refresh已驗；Special Play面板誤顯FLIP卡文已修正，本機／online完成提示不再誤稱等待OnPlay。原生Chrome正反與救援另確認，online元件確認命令2項不等同線上對局。一般累計7,480、cursor096、剩17基礎卡號／26印刷；最新完整709檔／11,457項屬091～093批末、094／095修改前，094～096全套留096批末。154 inventory／0 promoted、正式BS12／逐卡online未完成；全部裁定留112及所有印刷後。下列094及更早為歷史快照。

2026-10-04：094候選局部Browser44／44、專項3檔／56項、受影響15檔／623項（包含專項，不相加）、strict1／1、build／全域lint通過。黑色Arena LV3／HP4，任意三能量普通4、六色及混色付款／剩餘支援保留、正常登場四HP、取消／反選／非法資源與時機、指定目標昏厥、最後HP FLIP救援／略過已驗。修正候選本機普通傷害FLIP操作方判定，線上viewer維持原值；原生Chrome正反另確認。一般累計7,366、cursor095、剩18基礎卡號／27印刷；093兩印刷共用FLIP八案另列。最新完整709檔／11,457項屬091～093批末、094修改前，094～096全套留096批末。154 inventory／0 promoted、正式BS12／逐卡online未完成；全部裁定留112及所有印刷後。下列093及更早為歷史快照。

2026-10-04：093／093@1候選局部Browser172／172、專項3檔／119項、受影響27檔／901項（包含專項，不相加）、strict2／2、build／全域lint通過。PPN普通3後可先將恰好兩張己方棄牌區Blocker Cookie依選取順序放牌庫底，再選0～1任意對手造成1傷害；不洗牌，選零仍支付，略過不支付。紫色且Arena任意手牌Blocker獨立處理。原對手／另一對手、順序／取消／返回／反選／收合／超選、不足代價、昏厥／FLIP救援及Refresh／LV10已驗。一般累計7,322、cursor094、剩19基礎卡號／28印刷；共用026／084／091三十二案另列。091～093批末完整Vitest709檔／11,457項（763.34秒）全部通過，1228個凍結來源雜湊一致；BS9舊錯誤文字斷言已依明確代價提示更新並保留失敗基線。AI Browser／ST1核心同步exit0，正式BS12／逐卡online未完成。154 inventory／0 promoted，094～096卡面與獨立預期已備；全部裁定留112及所有印刷後，未stage／commit／push。下列092及更早為歷史快照。

2026-10-04：092／092@1候選已確認分支局部Browser156／156、專項4檔／87項、受影響39檔／1,121項（包含專項，不相加）、strict2／2、build／全域lint通過。EXTRA需己方休息區三張同時Arena且Blocker Cookie，支付一張己方紫色LV2以下戰鬥區餅乾與HP／裝備到棄牌區後正常配置5HP；付款不是昏厥。存活戰鬥區來源在己方餅乾昏厥且對手手牌至少三張時，由對手自行棄一；PPPP普通4及後攻Then棄一另獨立、不套三手牌門檻。取消／返回／反選／收合、交集反例、FLIP救援／略過及對手選牌控制權已驗。一般累計7,150、cursor093／093@1、剩20基礎卡號／30印刷；018／090／091共用48案另列。最新完整Vitest700檔／11,138項屬091前版本，本批091～093全套留093批末；正式BS12／逐卡online未完成。154 inventory／0 promoted、全部裁定留112及所有印刷後，未stage／commit／push。下列091及更早為歷史快照。

2026-10-04：091／091@1候選局部Browser188／188、專項3檔／123項、受影響24檔／667項（重疊不相加）、strict2／2、build／全域lint通過。Blocker棄1紫色且Arena手牌，昏厥獨立先支付牌庫頂3張，再回收0～1己方棄牌區Blocker Cookie，排除全部同名Caramel Arrow；付款後新候選、選零、拒絕重複付款、Refresh／LV10、FLIP先救援及PN普通2已驗。Chrome正反、16案可見紀錄、共用088／089／090各16案、AI Browser／ST1核心同步通過。一般累計6,994、cursor092／092@1、剩21基礎卡號／32印刷。最新完整Vitest700檔／11,138項（809.98秒）屬091修改前的088～090批末，本批091～093全套留093批末；正式BS12／逐卡online未完成。154 inventory／0 promoted、所有裁定留112及全部印刷後，未stage／commit／push。下列090及更早為歷史快照。

2026-10-04：090／090@1候選局部Browser180／180、專項91項、受影響16檔／505項、strict2／2、build／全域lint通過。棄1紫色且Arena手牌Blocker與免費昏厥效果分開轉接；來源昏厥計入己方休息區第四張Blocker後，可選0～1任意顏色／非Arena的LV1餅乾移到棄牌區。三／四／五張門檻、選零／反選／超選、收合、FLIP救援／略過及LV10終局已驗。Chrome正反、八案可見紀錄、共用088／089各十六案、AI Browser／ST1核心同步通過。088～090批末完整Vitest700檔／11,138項（809.98秒）全部通過，1,344個src／scripts／data與建置設定凍結雜湊一致。一般累計6,806、cursor091／091@1、剩22基礎卡號／34印刷；091～093六印刷卡面及獨立預期已備。所有裁定留112及全部印刷後，154 inventory／0 promoted、正式BS12／逐卡online未完成；下列089及更早為歷史快照。

2026-10-04：089／089@1候選局部Browser184／184、專項110項、受影響17檔／682項、strict2／2、build／全域lint通過。棄1紫色且Arena手牌Blocker與本次戰鬥封鎖對手有效LV3攻擊效果分開轉接；普通傷害、直接受攻擊、來源昏厥、FLIP、零傷害、其他Blocker改向及戰鬥結束到期均已驗。Chrome正反、八案可見公開紀錄、共用088十六案、AI Browser／ST1核心同步通過。一般累計6,626、cursor090／090@1、剩23基礎卡號／36印刷。最新完整Vitest691檔／10,795項（726.24秒）仍屬088／089修改前的087批末，本批全套留090批末；所有裁定留112及全部印刷後，154 inventory／0 promoted、正式BS12／逐卡online未完成。

2026-10-04：088／088@1候選局部Browser172／172、專項142項、受影響18檔／394項及昏厥／FLIP補回歸6檔／142項（重疊不相加）、strict2／2、build／全域lint通過。Blocker棄1紫色且Arena任意卡種手牌，昏厥另棄1任意顏色Arena手牌後抽0～2；最後HP FLIP救援／略過、兩次付款、Refresh與LV10終局已驗。修正088測試場景快速結算略過昏厥決定，本機與online hook來源／候選已驗；Chrome正反、AI／ST1核心同步及共用Blocker10案／舊昏厥4案通過。一般累計6,442、cursor089／089@1、剩24基礎卡號／38印刷。最新完整Vitest691檔／10,795項（726.24秒）屬088修改前的087批末，本批全套留090批末；全部裁定仍112及全部印刷後，154 inventory／0 promoted、正式BS12／逐卡online未完成。

2026-10-03：087候選局部Browser68／68、新增83項、受影響14檔／514項、strict1／1、build／全域lint及AI Browser／ST1核心同步通過。PP、0～1對手本回合攻擊-2，來源先進棄牌區；己方目前十張任意Arena牌時同一目標追加-1，九張→十張／八張→九張、選零／取消／非法付款與原攻擊結算已驗。可見公開紀錄六案、共用086十二案／029十六案另列。085～087批末完整Vitest691檔／10,795項（726.24秒）全部通過，1,343個凍結來源雜湊全部一致。一般累計6,270、cursor088／088@1、剩25基礎卡號／40印刷；088～090六印刷卡面及獨立預期已備。全部裁定留112及全部印刷後，154 inventory／0 promoted，正式BS12／逐卡online未完成。

2026-10-03：086候選局部Browser54／54通過，一般累計6,202，cursor087，剩26基礎卡號／41印刷。P1、0～1己方戰鬥區印刷Blocker攻擊+2至自己下回合結束；不限顏色／LV／Arena／REST／Blocker可支付性，選零仍付款，原攻擊不變、下回合實際3傷害及到期恢復已驗。新增63項、受影響18檔／512項、strict1／1、build／全域lint與AI Browser／ST1核心同步通過，共用027十六案另列。最新完整685檔／10,592項仍屬085修改前的084批末，085～087本批全套留087批末。所有裁定留112含全部印刷後，154 inventory／0 promoted，正式BS12／逐卡online未完成。

2026-10-03：085候選局部Browser50／50通過，一般累計6,148，cursor086，剩27基礎卡號／42印刷。P1、己方目前棄牌區至少五張Blocker Cookie才將全部棄牌連同來源道具洗回並洗牌，4／5／6門檻、區域／種類交集、DJ追加棄牌後判斷、取消／重開／收合及非法付款均已驗。adapter15／game40／面板新增2項，受影響13檔／388項、strict1／1、build／全域lint通過；共用083十六案另列。最新完整685檔／10,592項（767.28秒）是085修改前的084批末結果，本批全套留087批末。086／087完整卡面及獨立預期已備；所有裁定留112含全部印刷後，154 inventory／0 promoted，正式BS12／逐卡online未完成。

2026-10-03：084候選局部Browser68／68通過，一般累計6,098，cursor085，剩28基礎卡號／43印刷。P1放置、P1＋REST來源＋兩張己方棄牌區Blocker依玩家選取順序放牌庫底、對手手牌5／6／7門檻與自行棄1均已驗；取消／返回／超選、非法付款及本機／online UI回歸通過。專項84項、受影響17檔／430項、strict1／1、build／全域lint通過，共用083十六案另列。本批最新完整Vitest685檔／10,592項（767.28秒）、AI Browser／ST1核心同步皆exit0，1,334個凍結來源雜湊全部一致。085～087完整卡面與獨立預期已備，尚未轉接。所有裁定留112含全部印刷後；154 inventory／0 promoted，正式BS12／逐卡online未完成。

2026-10-03：081候選局部Browser56／56通過，一般累計5,906；紫色且Arena任意手牌先支付才轉移攻擊，不加REST／Once／Your Turn。既有Blocker共用10案另列，受影響19檔／375項、build／全域lint／strict1／1通過，online UI同回合第二次代價與舊選取清除已測。079～081批末完整Vitest675檔／10,408項（712.33秒）、AI Browser／ST1核心同步全部exit0，1,321個凍結來源雜湊全部一致。cursor082，剩31基礎卡號／46印刷；082完整官方卡面與獨立預期已備，額外道具棄牌代價缺口已唯讀定位。裁定留112含全部印刷後；154 inventory／0 promoted，正式BS12／逐卡online未完成。

2026-10-03：080候選局部Browser64／64通過，一般累計5,850；棄任意手牌、己方0～1 Arena補HP、救援／昏厥／Refresh及P1普通1已驗，078共用12案另列。修正FLIP卡文原始能量token呈現；受影響11檔／360項、build／全域lint／strict1／1通過。cursor081，剩餘32基礎卡號／47印刷；最新完整668檔／10,261項屬077／078，本批全套留081完成後。裁定留112含全部印刷後；154 inventory／0 promoted，正式BS12／逐卡online未完成。

2026-10-03：079候選局部Browser32／32通過，一般累計5,786；LV1／HP2、N1普通1、五色支付與未選支援保留、登場及昏厥已驗。專項26項、受影響7檔／421項、build／全域lint／strict1／1通過；Chrome藍色支援支付及疲勞阻擋另確認。cursor080，剩餘33基礎卡號／48印刷；最新完整668檔／10,261項屬077／078批末，079新增測試留下一批全套。裁定留112含全部印刷後；154 inventory／0 promoted，正式BS12／逐卡online未完成。

2026-10-03：078候選局部Browser60／60通過，首次一般累計5,754；紫色且Arena任意卡代價、對手五張門檻／自行恰好棄二、最後HP昏厥、PPP普通3及三HP登場已驗。修復直接FLIP棄牌漏接昏厥，受影響16檔／675項、build／全域lint／strict1／1通過，077共用6案另列。cursor079，剩餘34基礎卡號／49印刷；077／078批末完整Vitest668檔／10,261項（702.32秒）全部通過，AI Browser／ST1核心同步exit0。所有裁定留112含全部印刷後；154 inventory／0 promoted，正式BS12／逐卡online未完成。

2026-10-03：077已確認分支候選Browser50／50（一般26、裝備隔離14、Blocker參考控制10）通過，首次一般累計5,694。P1／Once／Rockstar單次戰鬥Blocker封鎖已轉接，PN普通1及3HP登場已驗；Cookie Equip HP／替補仍needs-review。修正Blocker漏付來源REST並補畫面代價提示；受影響12檔／555項、build／全域lint、AI Browser／ST1核心同步通過。最新完整664檔／10,152項屬075／076、077變更前，077／078全套待批末。cursor078，剩餘35基礎卡號／50印刷；裁定留112含全部印刷後，154 inventory／0 promoted，正式BS12／逐卡online未完成。

2026-10-03：073／073@1的On Play底牌同名排除、獨立對手六張手牌棄1及BB2後棄1／固定來源回底已局部驗收。雙尺寸176／176一般操作通過，另列8／8裝備清理及Awaken隔離防護；候選局部累計5,290，cursor074／074@1，剩餘39個基礎卡號／56筆印刷。專項3檔／98項、受影響10檔／587項、strict2／2、build／全域lint與共用Browser10案通過。最新完整653檔／9,688項屬073變更前；073／074本批全套與AI／ST1共用驗證待074完成後執行。裁定仍待112含全部印刷處理後統一提報，未promote。

2026-10-03：BS12-071／072四印刷已確認分支局部Browser132＋156＝288案，累計5,114；072完成B1啟動、另一張己方LV2以下Arena放牌庫底及BB普通2，修復共用面板收合／展開重設步驟。focused12檔／671項、完整Vitest653檔／9,688項（674.86秒）、build／全域lint、AI Browser與ST1好友房核心同步通過。072兩印刷Then因R004整段未執行，strict維持0 verified／2 needs-review；所有裁定待112含全部印刷處理後統一提報。cursor073／073@1，073／074四印刷完整卡面及獨立預期已備。154筆候選inventory／0 promoted，正式BS12／逐卡online與全系列未完成。

2026-10-01 BS12 Festival Arena：官方booster148印刷／112基礎卡，候選154筆inventory。001～031及已驗異圖局部Browser1,760案；031支付YY及一張己方黃色Arena戰鬥區餅乾進休息區，再獨立抽0～1及選對手0～1受1傷害，雙尺寸72／72含取消／返回、非法代價、補位及Refresh。strict1／1、build／lint、focused13檔／396項、AI／ST1好友房及完整Vitest552檔／7,139項（699.85秒）通過。cursor032／032@1，兩印刷完整卡面已備；007原HP棄牌不補位、015／016／026原目標Then依使用者裁定。全系列及正式／online逐卡未完成，未promote。詳見[BS12進度](docs/bs12-progress-2026-09-30.md)。

2026-09-30 建立 BS10／BS11 可重跑自動驗證入口：正式來源 323 筆／239 基礎卡，來源片段盤點、獨立官方原圖預期、雙尺寸正常 UI 點擊、精確公開狀態及指令順序分開記錄；指定 FLIP 小批次 30／30 通過。六色 BS11 種子牌組生成 1024 個不同合法構築，10 輪不重賽 Swiss 5120 場與 TOP 8 淘汰賽 7 場全部完成；黑色「魔女特殊登場 #062」奪冠。六色／八強牌表與圓餅圖見 [賽事報告](docs/bs11-1024-tournament-2026-09-30.md)，測試範圍、已修正缺陷及完整效果矩陣缺口見 [本輪方法與證據](docs/bs10-bs11-automatic-validation-2026-09-30.md)。

BS11 逐筆效果清單可查 [官方卡牌盤點](docs/bs11-card-inventory.md)（159 筆含技能、攻擊、FLIP 及印刷變體）與 [效果轉接覆蓋盤點](docs/bs11-effect-coverage.md)（116 張基礎卡逐卡實作狀態）。

CI 的 Vitest 使用單 worker，避免 seeded AI simulation 在共享 runner 的併行負載下超過單項逾時；應用入口 gzip 預算為 180 KiB，AI 策略與 Browser Swiss 對戰模組採延遲載入。

2026-09-29 **BS11 官方範圍與驗收狀態校正**：使用桌面瀏覽器核對官方 Asia 卡表的 The Dark Enchantress War 篩選，Duplicated Card 開啟為 150 張，關閉為 116 張，確認此 booster 範圍是 116 個基礎卡號＋34 個重複印刷。正式卡池的 159 筆 BS11 前綴資料跨三個官方產品：booster 150、Eternal Farewell promotion pack 8、Time for Deceit Promotion Pack 1；9 筆跨產品促銷印刷不是漏掉的 booster 卡，且保留於正式卡池。116／116 基礎卡均在官方清單。正式卡池驗證為 19 檔／1,923 筆／1,881 筆成功轉換；BS11 strict contract 159／159，主效果 93 supported／23 no-effect-text／0 unsupported、能力 93 converted／0 pending、攻擊 Then 27／27。局部 test-state Browser A/B 覆核 344／344，另有 EXTRA／Awaken 20／20、088 On Play 8／8、115 24／24、116 18／18、035 16／16。正式 BS11 牌組編輯器四尺寸、正式 AI 對局（第 15 回合結算）、雙瀏覽器 BS11 線上全對局（157 命令／16 次攻擊／兩端結果一致）均通過；這些整合流程不等於線上逐卡技能矩陣。完整 Vitest 481 檔／5,720 項（581.78 秒）、build、BS11 scoped lint 通過；全域 lint 有 4 個既有無關錯誤。正式環境官方 CDN 直連仍受本機網路限制。詳細分層見 [BS11 進度](docs/bs11-progress-2026-09-22.md)。

下列同日 BS11 摘要保留 promote 前的工作快照；目前卡池與驗收狀態以上段及 [BS11 進度](docs/bs11-progress-2026-09-22.md) 為準。

2026-09-28 **BS11-088／@1 On Play 補驗**：發現原先只有攻擊 Then 的 Browser 證據，已補紫色 LV.1 餅乾代價、LV.2 以上回收目標與缺代價阻擋；兩尺寸正反 **8／8** 通過。最新完整 Vitest **481 檔／5,702 項（531.02 秒）**、build、scoped lint 通過。115 的條件不成立合法登場與 116 的分別阻擋／覺醒後防移動仍待 Browser，候選未 promote。

2026-09-28 **BS11 EXTRA／Awaken 補驗**：090／091 含異圖的正反 12／12、116／@1 的正反 8／8 於本輪 build 與兩尺寸 Browser 重跑通過；這 20 案另計於下述 344 案之外。候選仍待逐卡完整印刷分支矩陣、promote 與正式／online 驗收。

2026-09-28 **BS11 候選實圖補驗前段快照**：159／159 張官方原始 WebP 已目視、雜湊及 Browser 解碼核對；16 支既有候選 Browser 驅動以本機原始圖檔重跑 **344／344**，其中 041 同回合第二次啟動與 042 兩目標超選防護已補驗，041～044 在修改 fixture 後兩尺寸 16／16 通過。當時完整 Vitest **481 檔／5,700 項（542.50 秒）**、build 與 scoped lint 通過。候選仍為 `inventory`／0 converted；逐卡完整分支矩陣、正式牌組、formal battle、online 與正式環境直連 CDN 尚未驗收，未 promote。最新證據見 [BS11 進度](docs/bs11-progress-2026-09-22.md)。

2026-09-28 **BS11 候選轉接與 Browser 補驗前段快照**：159／159 strict contract、27／27 攻擊 Then；前段與通用攻擊 86／86 後，補完 017／018、021、024～036、038、089～094、108、112～116 等候選局面操作，包含 112～115 攻擊 Then 40／40、089 攻擊 12／12、027／031 跨指令續接各 4／4。完整 Vitest **481 檔／5,700 項（538.12 秒）**、build、BS11 scoped lint 通過；全域 lint 仍有四個既有無關錯誤。159 筆官方 WebP 已本機取得且逐張目視；當時早期實圖 Browser 已補 016、041～053 共 90／90，其他實圖／分支與逐卡獨立預期仍有缺口；候選保持 `inventory`／0 converted，正式牌組、formal battle、online、正式環境卡圖與 promote 尚未驗收。詳見 [BS11 進度](docs/bs11-progress-2026-09-22.md)。

2026-09-28 **BS11-074～078 candidate Browser 補驗**：074／077／078 兩尺寸正反新增 12／12；075／076 沿用前輪 FLIP 8／8。074 核對紅色支援支付 1N 與付款不足，077 核對官方卡圖補足的被動文字及 Dark Choco 在棄牌區 15／14 張時的 4／3 傷害，078 核對 15 張門檻後追加 1P、目標與 HP 送棄。071@2 異圖另補攻擊 Then／EXTRA 技能正反 4／4，官方圖與 base 攻擊文字一致、無 FLIP 技能；作為 HP 的無效果揭示尚未獨立 Browser 覆核。完整 Vitest **447 檔／5,601 項（518.51 秒）**、build 與修改檔 lint 通過。候選仍 `inventory`／0 converted，079 起逐卡 Browser、正式牌組／formal battle／online 與 promote 未完成。詳見 [BS11 進度](docs/bs11-progress-2026-09-22.md)。

2026-09-28 **BS11-071～073 candidate Browser 補驗**：071／@1 的 3B 攻擊、1N＋棄手牌 Then、EXTRA 技能選擇與 BS9-055 Activate 續接，以及 072 的 15／14 張棄牌區門檻、073 的 3N 攻擊，在兩尺寸共 16／16 通過。完整 Vitest **446 檔／5,597 項（530.76 秒）**、build、修改檔 lint、候選驗證與 strict 159／159 通過；全域 lint 仍有 4 個既有無關錯誤。071@2 為無 FLIP 文字的 `type: flip` 變體，官方圖與攻擊正反路徑已補，作為 HP 的無效果揭示仍待獨立覆核。BS11 候選仍 `inventory`／0 converted，079 起逐卡 Browser、正式牌組／formal battle／online 與 promote 未完成；本輪 artifact 與限制見 [BS11 進度](docs/bs11-progress-2026-09-22.md)。

2026-09-28 **BS11-064～070 candidate Browser 補驗**：兩尺寸新增 66／66 條可操作路徑，063 零目標／略過抽牌另補 8／8；062 手牌快照跨後續指令仍固定且只向擁有者顯示。修正手牌置頂提示誤稱棄置，並補實際牌序回歸。159／159 筆官方 WebP 已取得並以本機原始位元組載入新 Browser 案例，仍需正式環境圖片與逐卡驗收。全套 Vitest 首跑 445 檔／5,593 項有 1 項舊數量斷言（寫 6、實列 5）失敗；修正後該檔 5／5 通過，未重跑全套。build、scoped lint、候選驗證、strict 159／159 通過；全域 lint 有 4 個無關既有錯誤。候選仍 `inventory`／0 converted，074 起的 Browser、正式牌組／formal battle／online 與 promote 均未完成。詳見 [BS11 進度](docs/bs11-progress-2026-09-22.md)。

2026-09-28 **BS11-060～063 candidate-only Browser 輕度驗收**：Luna 完成 BS11-060～063，Astra 依 inline 實作與結果摘要唯讀複核，未發現重大阻擋，並指出快照後續變化、零目標／略過 Then 抽牌仍未覆核。1280×720／1164×777 共 26／26 通過；062 手牌快照僅效果擁有者可見且 trace 不含卡身分。完整 Vitest 443 檔／5,577 項（517.37 秒）、build、scoped lint、candidate validation、BS11 strict 159／159 通過。官方卡圖 CDN 受本機網路限制未載入；候選仍 `inventory`，正式牌組／formal battle／online 未驗收。

2026-09-27 **BS11-054～058 candidate-only Browser 輕度驗收**：Luna 完成第十五批 fixture／route，Astra 輕度檢視指出 056／058 普通攻擊負向 route 被技能專用分支攔截；以紅綠測試修正 route precedence，並隔離 058 Once Per Turn 測試前提。兩尺寸新 Browser 路徑 24／24，加上重用 057 FLIP 4／4；focused 2 檔／14 項、完整 Vitest 441 檔／5,565 項（522.12 秒）、build 與 scoped lint 通過。Browser 矩陣在 route guard 修正前完成，修正後由兩個普通攻擊負向 route 回歸測試覆核，未重跑 UI 矩陣。候選仍 `inventory`，官方圖資實際載入、正式牌組／formal battle／online 未驗收。詳見 [BS11 進度](docs/bs11-progress-2026-09-22.md)。

2026-09-27 **BS11-050～053 candidate-only Browser 輕度驗收**：Luna 完成四張卡與 @1 的轉接／fixture；Astra 輕驗收指出 050／053 Then 自我送 trash 的代價提示及 053 Activate 公開結果紀錄缺口，修正後由本地 Playwright 在 1280×720／1164×777 完成 base／@1 共 40／40。實際核對 050 optional G＋自我送 trash、將牌庫頂牌以休息狀態放入支援；051 昏厥後最多 ready 兩張支援；052 綠色 Item 代價／追加傷害／手牌門檻抽牌；以及 053 Activate HP≥5 目標與攻擊 Then。Astra 後續確認結果 trace 限定合法效果目標。focused 4 檔／89 項、完整 Vitest 440 檔／5,559 項（517.39 秒）、build、scoped lint、candidate validation 與 strict 159／159 通過；候選仍 inventory／converted=0，正式牌組／formal battle／online／promote 未完成。官方圖資網路受限，異圖實際圖像 identity 未驗收。

2026-09-27 **BS11-045～049 candidate-only Browser 輕度驗收**：主代理修正陷阱技能 Then 命令紀錄的條件來源，並以本地 Playwright 在 1280×720／1164×777 完成 045～049 正／負向與 047 replacement follow-through，共 26／26。Astra 唯讀抽查確認 048 狀態／公開 trace 一致，並核對兩尺寸 replacement 的 instance 區域移動。focused 回歸 6 檔／73 項、完整 Vitest 439 檔／5,542 項（525.49 秒）、build、candidate validation、BS11 strict 159／159 與 scoped lint 通過；候選仍 `inventory`／converted=0，正式牌組／formal battle／online／promote 未完成。官方圖資網路受限，BS11-048@1 異圖視覺 identity 尚未驗收。Browser artifact：`test-results/bs11-045-049-browser/bs11-045-049-browser-1790506664621.json`。

2026-09-27 **BS11-040～044 candidate-only Browser 輕度驗收**：Luna 完成 041～044 Browser driver，主代理在 1280×720／1164×777 對 041～044 各完成 positive／negative，共 16 條路徑；Sol 以 GPT-6 Sol 高度唯讀檢視 route、fixture 與首輪失敗診斷。040 加入既有 simple FLIP 矩陣後累計 60／60；041 確認綠色支援回手且己方 Cookie 各 +1 HP、042 確認休息支援設為 active 與零目標 no-op、043 確認普通攻擊 1 傷害及能量不足不宣告、044 確認 7／6 張支援分別造成 3／2 傷害。focused 回歸 4 檔／36 項、build、driver syntax check 通過；候選仍 `inventory`，正式牌組／formal battle／online／promote 未完成，官方圖 URL／alt 或命名 fallback 已核對但不代表外部圖檔實際載入。

2026-09-23 **BS11-003／005／019／020／039 RED／YELLOW／GREEN simple FLIP candidate Browser 輕度驗收**：Luna 擴充既有共用 simple FLIP route／fixture，Astra 以本地 Playwright 在 1280×720／1164×777 對五張卡各完成 positive／negative，新增 20 條路徑，累計 simple FLIP 矩陣 56／56 通過。正向實際走過 003／020 抽最多 1 張，以及 005／019／039 棄 1 張後附著 Cookie +1 HP；負向確認棄牌代價不足或明確不發動，並核對官方圖 URL／alt 或命名 fallback 與公開 trace。strict **159／0／0**、coverage 主效果 **93／23／0**、能力 **93／0**、攻擊 Then **27／27**；focused 回歸 6 檔／44 項、完整 Vitest **437 檔／5,524 項（480.81 秒）**、build、candidate validation、coverage analyzer、scoped lint 通過。候選仍 `inventory`，正式牌組／formal battle／online／promote 仍待；外部官方圖資未載入 `naturalWidth`，未將其冒報為圖檔載入證據。

2026-09-23 **BS11-057／059／075／076 BLUE／PURPLE FLIP candidate Browser 輕度驗收**：Luna 擴充既有 simple FLIP candidate route／fixture，Astra 以本地 Playwright 在 1280×720／1164×777 對四張卡各完成 positive／negative，新增 16 條路徑；正向實際走過 057／075 抽最多 1 張、059／076 棄 1 張後附著 Cookie +1 HP，負向確認代價不足或明確不發動，並核對各卡官方圖 URL／alt 或命名 fallback 與公開 trace。累計 simple FLIP 矩陣 36／36 通過；strict **159／0／0**、coverage 主效果 **93／23／0**、能力 **93／0**、攻擊 Then **27／27**；完整 Vitest **437 檔／5,519 項（482.29 秒）**、build、scoped lint 通過。候選仍 `inventory`，正式牌組／formal battle／online／promote 仍待。

2026-09-23 **BS11-093／095／096／100／101 BLACK FLIP candidate Browser 輕度驗收**：Luna 完成 inventory-only route／fixture／focused route 回歸；Astra 以本地 Playwright 在 1280×720／1164×777 對五張卡各完成 positive／negative，共 20 條路徑。正向實際走過攻擊後 FLIP、093／096／101 棄 1 張手牌後讓附著 Cookie +1 HP、095／100 抽最多 1 張；負向確認無手牌時棄牌代價阻擋或明確不發動，並核對官方圖 URL／alt 或命名 fallback 與公開 trace。strict **159／0／0**、coverage 主效果 **93／23／0**、能力 **93／0**、攻擊 Then **27／27**；完整 Vitest **437 檔／5,515 項（471.66 秒）**、build、scoped lint 通過。候選仍 `inventory`，正式牌組／formal battle／online／promote 仍待。

2026-09-23 **BS11-016／016@1 跨 Cookie HP 核心收尾**：Luna 完成 exact adapter、`totalAcrossCookies` HP 支付、EffectPanel／pending UI 與 inventory-only fixture；Astra 以本地 Playwright 在 1280×720／1164×777 對 base／@1 各完成 positive／negative，共 8 條路徑，實際驗證兩張紅色 Cookie 分攤合計 2 張 HP、昏厥／Break、對手全體 1 傷害與不足 HP 阻擋。strict 收斂為 **159／0／0**，coverage 為主效果 **93／23／0**、能力 **93／0**、攻擊 Then **27／27**；完整 Vitest **436 檔／5,510 項**、build、受影響檔 scoped lint 通過。候選仍 `inventory`，正式牌組／formal battle／online／promote 未完成；官方圖資受本機網路限制時保留命名 fallback，未宣稱 `naturalWidth` 載入。

2026-09-23 **BS11 contract gate 收斂**：在不擴大 BS11-016 跨 Cookie HP 核心的前提下，Luna 補上 033／034／090／116 的 runtime contract 證據，修正 071 巢狀 EXTRA timing 與 080 curly apostrophe target 解析；Astra 輕度驗收後 strict 為 157 verified／2 needs-review／0 blocked，並以本地 Playwright 對 BS11-090／091、097～099 與 BS11-116 在 1280×720／1164×777 完成 positive／negative 路徑。候選維持 `inventory`，未 promote；完整逐卡 Browser／正式牌組／online 仍依分層驗證計畫進行。

2026-09-23 **BS11-103／104／109 localhost Browser 輕度驗收**：Astra 以本地 Playwright 在 1280×720／1164×777 對三張卡各完成 positive／negative，共 12 條路徑；實際走過 103 登場／手牌門檻／Special Play 回收、104 昏厥／黑色牌庫選牌、109 黑色支付／Special Play 牌庫選牌，並核對公開 command trace 與官方圖 URL／alt。外部官方圖資在本機未載入 `naturalWidth`，未將其冒報為圖檔載入證據；候選仍 `inventory`，正式牌組／formal battle／online／promote 仍待。

2026-09-23 **BS11-106／107／110 localhost Browser 輕度驗收**：Astra 以本地 Playwright 在 1280×720／1164×777 對三張卡各完成 positive／negative，共 12 條路徑；106 實際核對正向 0K／反向 1K 陷阱支付、107 正向 2K／2 傷害與反向條件阻擋、110 正向同一目標由 base 6 降至 4／反向由 6 降至 5，並核對公開 trace 與官方圖 URL／alt。外部官方圖資在本機未載入 `naturalWidth`，未將其冒報為圖檔載入證據；候選仍 `inventory`，正式牌組／formal battle／online／promote 仍待。

2026-09-23 **BS11-088／088@1／105 attack Then localhost Browser 輕度驗收**：Astra 以本地 Playwright 在 1280×720／1164×777 對三筆記錄各完成 positive／negative，共 12 條路徑；正向目標 HP 6→5、負向維持 6，均核對 `resolve-attack-effect`，088@1 以 base card id 取得 contract trace。外部官方圖資受本機網路限制時保留命名 fallback，未將其冒報為 `naturalWidth` 載入；這是已支付普通攻擊後的 continuation fixture，不等同正式支付、正式牌組、formal battle 或 online 驗收。

2026-09-23 **BS11-111～113 Special Play／On Play localhost Browser 輕度驗收**：Astra 以本地 Playwright 對 111／111@1／112／112@1／113／113@1 在 1280×720／1164×777 各完成 positive／negative，共 24 條路徑；正向實際完成共同黑色 LV.1 Special Play 代價、111 棄牌後 1 傷害、112 棄牌區黑色 Cookie 回收、113 抽 2 張，負向以不合格紅色 LV.1 Cookie 阻擋 Special Play，並核對公開 `deploy-cookie`／`begin-activate-skill`／效果結算 trace。官方圖資受本機網路限制時保留 fallback，未將其冒報為 `naturalWidth` 載入；候選仍 `inventory`，正式牌組／formal battle／online／promote 仍待。

2026-09-23 **BS11-115／115@1～@3 Special Play／On Play localhost Browser 輕度驗收**：Astra 以本地 Playwright 對 4 筆變體在 1280×720／1164×777 各完成 positive／negative，共 16 條路徑；正向實際選滿 2 張黑色 LV.2 Special Play 代價 Cookie、選對手 Cookie 並造成 1 傷害（HP 3→2），負向只有 1 張合法代價 Cookie 時阻擋特殊登場，並核對各變體官方圖 URL／alt 與公開 trace。候選仍 `inventory`，正式牌組／formal battle／online／promote 仍待。

2026-09-23 **BS11-089／089@1／089@2 On Play localhost Browser 輕度驗收**：Luna 完成 candidate fixture／route，Astra 以本地 Playwright 在 1280×720／1164×777 對 3 筆變體各完成 positive／negative，共 12 條路徑；正向實際確認登場效果、牌庫頂 3 張送 trash、抽 2 張、棄 1 張並在 Refresh 條件成立時將來源 HP 4→5，負向完成相同抽棄流程但不開啟第二段補 HP，來源維持 4。各變體核對官方圖 URL／alt 或命名 fallback 與公開 trace；候選仍 `inventory`，正式牌組／formal battle／online／promote 仍待。

2026-09-23 **BS11-084～087 localhost Browser 輕度驗收**：Luna 完成 inventory-only route／fixture 與 1 檔／6 項回歸；Astra 以本地 Playwright 對 084、085／085@1、086／086@1、087／087@1 在 1280×720／1164×777 各完成 positive／negative，共 28 條路徑。正向實際完成 Trap 紫色付款／目標、Refresh 後抽 1、085 來源自我送 trash、086 指定 Dark Cacao 從 trash 登場及 +2 HP、087 Ancient 條件隨機棄手；負向驗證 Refresh／支付／命名候選／Ancient 條件不成立。官方圖資受本機網路限制時保留命名 fallback，未宣稱 `naturalWidth` 載入；候選仍 `inventory`，正式牌組／formal battle／online／promote 仍待。

> BS11 最新驗證狀態以本頁首段與「目前進度」為準：完整 Vitest **481 檔／5,720 項（581.78 秒）全綠**。下方長摘要保留歷史批次結果；060～063 原有 26 條 Browser 路徑，本輪 063 邊界新增 8 條、064～070 新增 66 條、071～073（base／@1）新增 16 條、071@2 另補 4 條、074／077／078 新增 12 條、079～083 新增 28 條，前段與通用攻擊另新增 86 條。正式 AI 牌組對局與 BS11 雙瀏覽器線上全對局已另完成；線上逐卡技能矩陣與正式 CDN 直連仍未驗。

2026-09-23 **BS11 候選與前三十七批轉接**：由 Luna 建立官方英文候選匯入／靜態盤點，159 筆／116 個基礎卡號／43 個變體維持 `inventory`；BS11-001～015、017～047、048～102、103～116 完成 adapter 與核心回歸。第二十三批 090～091 接入 White Lily Cookie 自我昏厥後忽略條件登場 Avatar of Destiny 並增加 3 HP，以及雙方 Break Area／手牌 EXTRA 條件；第二十四批 097～099 接入 Special Play 戰鬥區條件、1K／棄牌／目標限制與自我送 trash；第二十五批 111～113 接入共用黑色 LV.1 Special Play 代價、On Play 效果、LV.2+ On Play 封鎖與攻擊 Then；第二十六批 114 接入黑色手牌代價、手牌門檻抽牌與指定 Dark Enchantress Cookie 回收；第二十七批 115 接入兩張具 Special Play 的黑色 LV.2 Cookie 多選代價、代價後容量檢查、支援區門檻全體傷害與 2 黑色能量攻擊 Then；第二十八批 116 接入 Break Area LV.7、Dark Enchantress's Castle、同回合具 Special Play 的 LV.3 Dark Enchantress Awaken 條件、`awakenHpBonus: 2` 與被動 `sourceOnly` 移動防止；第二十九批 106／107／110 接入黑色陷阱費用條件、戰鬥區 Cookie 等級合計門檻 2 傷害，以及同一目標的攻擊下降 Then；第三十批 103／104／109 接入手牌至多 5 張時回收棄牌區 Special Play Cookie、昏厥後檢視 3 張選黑色卡，以及支付 1 黑色後檢視 5 張選 Special Play Cookie，並補上牌庫／棄牌區共同篩選與 UI／AI／decision path；第三十一批 088／105 接入攻擊 Then 的對手棄牌區 15 張與己方 Special Play Cookie 條件；第三十二批 094 接入黑色付款的 Blocker 攻擊轉向，沿用既有陷阱視窗與 source-only redirect 核心；第三十三批 108（base／@1）接入 Dark Enchantress's Castle 的黑色放置、休息自身、Special Play 回合條件與抽 1／棄 1，新增逐玩家回合旗標並接入既有補位／pending 流程；第三十四批 092 接入 Licorice Cookie 的 Activate／Once Per Turn 有效 LV.1 覆寫，保留印刷 LV.2 並在回合切換清除覆寫，且同步接入目標、戰鬥、技能代價、AI、PlayerView 與 UI；第三十五批 093／096／100／101 接入黑色 LV.1 FLIP 的棄牌代價、附著 Cookie +1 HP 與抽最多 1 張，並補上實際攻擊後 FLIP runtime；第三十六批 095／102 接入 095 的免費抽最多 1 張 BLACK FLIP 與 102 的 BLACK MIX vanilla Cookie；第三十七批 047 接入 Dumpling Censer 的 `{G}`＋支援回手啟動代價與本回合對手 Cookie On Play 的 `{N}`＋支援回手 replacement。官方卡圖與 runtime 正／負條件已由 Astra 輕度驗收，另以 inventory-only localhost test-state 實際驗證 047 的正向兩段付款／replacement 註冊與負向付款阻擋。本地／online Special Play modal 與 deploy command 已支援多張代價。候選仍 `inventory`，最新主效果 93 supported／23 no-effect-text／0 unsupported、能力 93 converted／0 pending、攻擊 Then 27／27、strict **159 verified／0 needs-review／0 blocked**；第二十九批 focused 2 檔／5 項、第三十批 focused 2 檔／6 項、第三十一批 focused 2 檔／7 項、第三十二批 focused 2 檔／4 項、第三十三批 focused 2 檔／4 項、第三十四批 focused 2 檔／4 項、第三十五批 focused 2 檔／14 項、第三十六批 focused 2 檔／4 項、第三十七批 focused 2 檔／4 項，另有第二十九批 Browser fixture 3 檔／10 項、第二十四批 3 檔／16 項、第三十一批 1 檔／5 項、第四十批 1 檔／20 項與第四十一批 1 檔／6 項 focused contract／runtime／fixture；第二十九～三十一批各有 12 條、第四十批另有 24 條、第四十一批另有 8 條 Browser 路徑，完整 Vitest 436 檔／5,510 項（478.54 秒）全數通過。092／103／104／109／088／088@1／094／105／108／111／111@1／112／112@1／113／113@1／114／114@1 已完成 shared UI／AI／decision path、effective-LV、attack-effect 或 On Play 的靜態接線，其中 106／107／110、103／104／109、088／088@1／105 與 111～114（含 @1）已完成本地 Browser A/B／continuation；第四十五批已補上 016／016@1 的跨 Cookie HP 核心、UI／fixture 與 Browser 證據；整體仍未完成正式牌組／online 與 promote。BS11-016／016@1 的跨 Cookie HP 核心與 candidate Browser 已完成；BS11-062 卡圖 404 仍保留，正式牌組／online／promote 仍待。詳見 [BS11 進度](docs/bs11-progress-2026-09-22.md)。

2026-09-15 修復 BS9-035／041／050 手動場景：加入補 HP 阻擋比較、BS9-030 攻擊後觸發 FLIP，以及攻擊後送棄支援接技能的連續操作。見 [場景修復](docs/bs9-progress-2026-09-10.md#2026-09-15-手動驗證場景修復)。

2026-09-15 修正攻擊付款時大卡預覽遮住支援區；付款與選目標期間自動收起快速預覽，本機／線上共用。

2026-09-15 **UI／UX 入門與深藍精修**：新增可跳過／重讀的操作教學與正式紅色起始牌組練習，補 AI 難度說明、牌組頂部合法性檢查、篩選清除、回合所有者、提示音與結果摘要；保留既有規則、卡圖及收藏。詳見 [盤點與驗證](docs/ui-ux-redesign-plan.md#2026-09-15-正式流程盤點與深藍介面精修)。

2026-09-21 **BS10 第六～第九批靜態轉接**：補上 021／045／049／070／094／107／109／110／119／122 與 15 張攻擊 Then 的 exact adapter、Refresh／離場／攻擊費用／支援條件共用規則與 targeted 回歸；目前主效果 65 supported、58 無效果文字、0 unsupported，能力 65 converted／0 pending，攻擊 Then 18／18，strict 127／31／6。候選仍 inventory，新增卡片尚未 Browser／正式／online 驗收。詳見 [BS10 進度](docs/bs10-progress-2026-09-14.md)。

2026-09-21 **BS10 Luna 批次整合**：非 Cookie、攻擊 Then、062／063／067／068 共用機制，以及 042／045／116／048／098／123 的合約與 EXTRA 證據已整合；目前主效果 98 supported、25 無效果文字、0 unsupported，能力 98 converted／0 pending，攻擊 Then 21／23，strict 158／0／6。受影響回歸5檔／357項、完整 Vitest 348檔／5,006項、build、scoped lint通過；Browser 仍只有前十張的88案，024／073仍因資料缺口 blocked，候選維持 inventory／converted=0。詳見 [BS10 進度](docs/bs10-progress-2026-09-14.md)。

2026-09-21 **BS10-024／073 Awaken 收尾**：補上兩張 EXTRA（含異圖）的 `awakenHpBonus: 1`、同名本回合 Awaken、024 的 HP≤3 禁攻擊與 2R 攻擊 Then，以及 073 的 1G／對手支援至少6張 On Play 與支援 Cookie 回手攻擊 Then；並修正 BS10-015／035／038／042 的代價、補 HP、Then 目標與條件語意。最新主效果 98／25／0、能力 98／0、攻擊 Then 23／23，strict 164／0／0；3檔／77項 targeted、完整 Vitest 348檔／5,008項（475.29秒）、build、修改檔 scoped lint通過。候選仍 inventory／converted=0，Browser 維持既有88案，正式／online與新增卡逐卡 Browser仍待驗收；024／073 圖檔與 API 候選文字仍有文案差異，正式 promote 前須再核對。詳見 [BS10 進度](docs/bs10-progress-2026-09-14.md)。

2026-09-22 **BS10 正式收尾批次**：164 筆候選已完成 strict 轉接並 promote 至 `data/cards/`；正式卡池核對為 1,764 張卡號／1,726 張可轉換，BS10 靜態 contract 164／164 verified。非 EXTRA 卡逐卡 Browser 正向通用矩陣在 1280×720／1164×777 各 135／135、負向各 151／151；BS10-008 另以 1907×863／1164×777 完成獨立 FLIP 正負 16／16。12 張 EXTRA（含變體）各在 1280×720 與 1164×777 完成正負 12／12，並以官方卡圖驗證 024／073。正式牌組 Browser 四尺寸、online modal 兩尺寸與雙瀏覽器好友房完整流程通過；完整線上對局實際完成 108 個命令／14 次付款攻擊，雙端勝負一致，完成房間斷線後終局結果仍保留。完整 Vitest 348 檔／5,022 項全數通過、build 通過；全域 lint 的 4 個既有錯誤仍另列。詳見 [BS10 進度](docs/bs10-progress-2026-09-14.md)。

2026-09-22 **BS10-088 Butterfly Lantern 檢視流程修正**：效果改為先顯示正式 BS10-001 Princess Cookie，再由玩家選擇放回牌庫頂／底；補上 `pickCount=0` 的牌面、規則命令驗證與響應式放置選擇排版。BS10-088 實卡規則／modal／既有 inspect-deck 回歸共 4 檔／71 項通過，Browser 以 1280×777／1164×777 驗證頂／底與後續抽牌，負向路徑維持不可使用。

2026-09-14 選牌提示框改善：候選卡可就地展開技能卡文，選取狀態與棄牌代價尚缺張數直接顯示，減少查看卡文時離開操作流程。

2026-09-14 開始 BS10：新增官方英文候選匯入與缺口盤點，維持 inventory 隔離；依使用者指定由 Luna 實作、Astra 複核，首批5個基礎卡號／6筆通過卡圖、規則及36案候選Browser驗收，接續006～010。詳見 [BS10 進度](docs/bs10-progress-2026-09-14.md)。

2026-09-14 **對戰桌視覺整理**：正式本機／線上共用低對比深藍桌墊、細邊框與縮小區域標籤，主要回合操作改為金色；桌機手牌保留獨立區域，選牌抬升不遮支援，支援張數留在區域內。卡牌快速預覽加寬至 320–380px，卡圖最大 300px、卡名 18px、效果文字 14px。提交前完整 Vitest 327 檔／4,802 項與 build 通過，全域 lint 仍有 4 個無關既有錯誤。驗證與缺圖限制見 [對戰桌整理](docs/ui-ux-redesign-plan.md#對戰桌視覺整理2026-09-14)。

2026-09-14 **全流程對戰動畫**：AI／線上共用指令呈現事件、卡牌移動與支援／攻擊軌跡、HP／FLIP、昏厥與勝負，提供標準／快速／減少動畫及略過；先後攻確認前不顯示手牌，確認後逐張發牌，發完再開啟調度；開局面板採四步進度、手勢選項與深色手牌展示；暫停面板及工具選單統一深色風格，支援鍵盤操作與收合問題回報。主選單更新為左右雙欄對戰大廳，整合牌組／AI 設定、金色對戰入口與牌背載入替代。完整 Vitest 327 檔／4,802 項、AI Browser 及桌機／平板主選單操作通過；全域 lint 仍有無關未追蹤檔的 4 個錯誤。動畫不改變規則，事件卡面與私密 ID 依觀看者遮罩。驗證範圍與環境限制見 [全流程動畫](docs/ui-ux-redesign-plan.md#2026-09-14-全流程動畫)。

2026-09-14 **Master Duel 風格正式主選單與我的牌組流程**：`MainMenuMasterDuel` 統一為正式主選單，採用準備區與代表卡並列的對戰大廳視覺；點選「管理牌組」會進入正式「我的牌組」畫面，支援建立／編輯／複製／匯入／匯出／批次刪除與 starter deck，`deck-editor` 保留既有排版。`my-decks-disclaimer` 僅保留非官方聲明。

2026-09-14 **BS9 Lv.5 賽事 benchmark P1 修正與重跑**：保留紅、黃、綠、藍、紫五份 60 張純色 BS9 主牌與同色 BS9 EXTRA ×4，並修正 holdout 為 baseline／訓練策略交叉對戰、交換策略座位後依實際 winner player 計分；同時將 benchmark 預設與參數上限恢復為 500 步，超限對局標記 FAIL 且不納入訓練。固定 seed 的完整 1,024 人／10 輪 Swiss 完成 5,084／5,120 場，36 場卡住／超限，Swiss／整體報告為 FAIL；top cut 冠軍為藍色 `#005`，四強為 `#005`、`#183`、`#040`、`#201`。本次重跑 profile 僅收錄 5,084 場完成決勝資料；32 副×2 輪 holdout 的 64 場雙向交叉對戰為訓練策略 35 勝、baseline 29 勝、0 失敗。完整報告見 [BS9 Lv.5 1024 人賽事報告](docs/bs9-lv5-1024-report.md)。

2026-09-14 **BS9-022／BS9-023 card-check HP 公開資訊**：正向 test-state fixture 將被放入己方 Cookie HP 的對手卡標記為正面朝上，雙玩家 view 均可辨識；新增遮罩視角回歸，確保條件成立時才可依規則抽牌，未改動正式牌池資料。

2026-09-14 **BS9-031／BS9-032 FLIP 攻擊後入口修正**：正向 card-check fixture 改由正式 BS9-030「Shadow Milk Cookie」完成 EXTRA 代價、On Play、三張黃色能量攻擊與攻擊後代價，再透過正式 FLIP pending 選擇 Alchemist／Yoga；分別驗證 Alchemist 的 LV.3 +1 HP＋抽牌，以及 Yoga 的抽牌＋設 active。負向仍保留 P-018 HP FLIP 的對手回合路徑，用來驗證 own-turn Then 不會誤觸發；規則回歸 11／11、完整 Vitest 324 檔／4,787 項通過，Browser 正向已進入正確 UI，但終端腳本仍受官方圖片載入環境限制。

2026-09-13 **BS9 正式牌池與端到端收尾**：官方卡表與 Ver.1.8 未提供 BS9-025 專卡裁決；依使用者確認，FLIP 卡依正常規則進入 Trash、棄置 1 張手牌、+1 HP 預設給原附著 Cookie，且在持有者自己的回合可改選另一隻己方 Cookie（不轉移 FLIP 卡本身）。BS9 全 185 筆正式記錄已移入 `data/cards/`，候選 JSON 為 0；strict contract **185／185 verified、0 needs-review、0 blocked**。所有 BS9 專用 Browser 命令均 exit 0，合計執行 **864 lanes（含重疊的專卡加強矩陣）**，覆蓋雙尺寸正／負互動與官方卡圖載入；BS9-025 專用 **8／8** 通過。正式牌組編輯器四種視窗、雙瀏覽器好友房同步、線上 modal RWD（桌機／280px）均通過；`validate:cards`（17 檔／1,600 種卡號／1,574 張轉換）、`check:card-pool`、build 與完整 Vitest **323 檔／4,782 項**通過。AI Browser Smoke 已修正為驗證現行暫停資訊／恢復流程並通過；本機全域 lint 仍受 4 個既有未追蹤暫存／診斷檔錯誤阻塞，修改檔 scoped lint 通過。詳見 [BS9 進度報告](docs/bs9-progress-2026-09-10.md#2026-09-13-bs9-正式牌池端到端收尾)。

（採用 BS9-025 前的歷史快照）2026-09-13 BS9-071～118 完成候選隔離 exact adapter、runtime hardening 與嚴格 Browser 驗收：依 76 筆官方實體卡圖（含異圖）建立獨立契約，補上 Refresh continuation、Shadow Milk discard provenance、陷阱 HP 目標／Then、檢視牌庫與牌庫移動回歸；新版 1907×863／1164×777 正／負矩陣 **352／352 全數通過**，含 210 條 command trace、152 條 substantive settlement、**352 條官方影像成功載入**與 176 條負向證據。BS9-071～118 strict contract **76／76 verified**；全檔為 183 verified／2 needs-review／0 blocked（兩筆均為 BS9-025），候選仍維持 inventory，尚未 promote，正式 registry 仍無 BS9。完整 Vitest **319 檔／4,757 項**、build、server typecheck 通過；全域 lint 僅剩 4 個既有無關診斷檔錯誤。正式牌組／多人／線上逐卡驗收與 BS9-025 官方裁決仍待。詳見 [BS9 驗證紀錄](docs/bs9-progress-2026-09-10.md#第十四批-bs9-071118候選全範圍通過)。

2026-09-13 BS9-051～070 strict Browser 重跑完成：修正 BS9-062 必須棄 2 張支援卡的負向夾具，使其停在宣告前而非捏造攻擊後 pending；140／140 lane 通過，140／140 exact 官方影像載入、140／140 pending 清空、70／70 負向 evidence、94 條 command trace 與 140／140 public state。完整 Vitest **319 檔／4,757 項**仍全數通過；候選維持 inventory，未 promote。

2026-09-12 BS9-051～070 完成第十三批候選隔離轉換與逐卡驗證：依 28 筆官方實體卡圖建立獨立契約，接入 FLIP／Skill／攻擊／Item／陷阱／場景的 exact adapter、規則、UI 與公開 trace；1907×863／1164×777 正／負 Browser 共 140／140，strict contract 28／28 verified，候選仍維持 inventory，尚未 promote。詳見 [BS9 驗證紀錄](docs/bs9-progress-2026-09-10.md#第十三批-bs9-051070候選局部通過)。

2026-09-12 BS9-050「Wind Archer Cookie」完成第十二批候選局部驗收：Crow Storm 的本回合支援區棄牌累計條件／Once Per Turn，以及 Arrow of Darkness 攻擊 Then 的 2 張支援卡代價、所有對手 Cookie sequential 傷害均已實際接入規則、UI、AI 與公開 trace。基本版／`@1` 在 1907×863／1164×777 完成技能與攻擊正／負共 16／16 Browser；strict 2／2 verified，候選維持 inventory，尚未 promote。詳見 [BS9 驗證紀錄](docs/bs9-progress-2026-09-10.md#第十二批-bs9-050候選局部通過)。

2026-09-12 BS9-046～049 完成第十一批候選局部驗收：Fragmented Soul 的陷阱第二段 FLIP 回收、Yogurt River of Rebirth 的場景 Activate、Matcha Cookie 兩筆 FLIP 異圖，以及 Fig Cookie 昏厥後把對手 LV.1 Cookie 移至疲勞支援區，均已實際經過雙尺寸正／負 Browser 操作。此批亦修正陷阱逐段目標送出不得預先略過後續卡牌選擇；候選仍維持 inventory，尚未 promote。詳見 [BS9 驗證紀錄](docs/bs9-progress-2026-09-10.md#第十一批-bs9-046049候選局部通過)。

2026-09-12 BS9-032「Yoga Cookie」與 BS9-033「GingerBrave」完成第七、八批候選局部驗收：Yoga 的 FLIP 保留抽 0／1 後、只在持有者自己的回合把己方至多 1 張橫置 Cookie 設為 active；GingerBrave 則以 1 黃色與 1 張具有 FLIP 的手牌為 Activate 代價，支付後才檢查 6 張手牌門檻並抽 0～2。Yoga 在 1907×863／1164×777 正／負 Browser 4／4，GingerBrave（基本版／`@1`）共 8／8 通過；BS9-033 strict 2／2 verified，候選仍未進正式牌組或 promote。詳見 [BS9-032／033 驗證紀錄](docs/bs9-progress-2026-09-10.md#第七批-bs9-032候選局部通過)。

2026-09-11 BS9-017「Hollyberry Cookie」修正固定目標 UI：技能的另一張 Ancient 是條件，+2 僅套用自身；攻擊後所有己方 Ancient 自動列為受保護者，提示與紀錄顯示「3 點以上傷害改為 2 點」。候選測試局面補上對手 6 張紅色支援，桌機／平板均驗證 Dark Choco Cookie 實際攻擊 Ancient 扣 2 HP、非 Ancient 扣 4 HP。詳見 [BS9-017 驗證紀錄](docs/bs9-progress-2026-09-10.md#2026-09-11-bs9-017-hollyberry-cookie-固定目標與實際受擊驗證)。

2026-09-11 BS9-031「Alchemist Cookie」完成第五批候選局部驗收：以正式 P-018「Mustard Cookie」On Play effect-damage 在自己的回合翻出真實 BS9-031 HP FLIP，驗證棄 1 張手牌、唯一己方 LV.3 目標 +1 HP，以及自己回合抽 0／1；對手回合負向只結算 +1 HP、不建立 Then 抽牌。基本版、`@1`、`@2` 在 1907×863／1164×777 共 12／12 Browser 通過，候選仍未進正式牌組或 promote。詳見 [BS9-031 驗證紀錄](docs/bs9-progress-2026-09-10.md#第五批-bs9-031候選局部通過)。

2026-09-11 BS9-041「Pistachio Cookie」完成第六批候選局部驗收：三筆官方實卡共用 FLIP 抽最多 1 張與 `activated during your turn` Then 目標傷害；正向控制 fixture 實際選對手 Hero 造成 1 點並續接 BS9-018 原攻擊，負向自然攻擊只抽牌、不建立傷害目標。三筆記錄在 1907×863／1164×777 共 12／12 Browser 通過，候選仍未進正式牌組或 promote。詳見 [BS9-041 驗證紀錄](docs/bs9-progress-2026-09-10.md#第六批-bs9-041候選局部通過)。

2026-09-12 BS9-021「Stolen Light of Truth」完成跨所有權陷阱的精準目標與 HP 朝向修復：最多選 1 張對手 donor、再選 1 張己方 receiver，將 donor 最上方 HP 正面朝上放到 receiver HP 最下方；超選會被規則層拒絕，無 HP donor 不捏造卡片。1907×863／1164×777 正／負共 4／4 Browser 通過，候選仍未進正式牌組或 promote。詳見 [BS9-021 驗證紀錄](docs/bs9-progress-2026-09-10.md#2026-09-12-bs9-021-stolen-light-of-truth-精準陷阱目標與-hp-朝向驗證)。

2026-09-12 BS9-018「Hero Cookie」新增實際攻擊見證：`card:BS9-018` 由 Hero 攻擊正式 BS1-007 Melon Bun 或 BS8-007 Dark Choco，翻出正式 BS1-002 Kumiho；`card-negative:BS9-018` 改由 Pomegranate 攻擊作為沒有 Hero 防護的對照。Browser 在兩種尺寸、兩個目標與正／負路徑共 8／8 完成 Kumiho 棄牌、目標選擇、FLIP 結算與原攻擊續接；候選仍未進正式牌組或 promote。詳見 [BS9-018 驗證紀錄](docs/bs9-progress-2026-09-10.md#2026-09-12-bs9-018-hero-實際攻擊-bs1-007bs8-007-與-kumiho-flip-續接)。

2026-09-12 完成 BS9-034～038 第九批候選局部驗收：Fortune Teller Cookie 對手 HP 重排、Truthless Recluse 的本回合 HP 增加封鎖與攻擊 Then、Bookseller 回合結束二選一代價、Apple Faerie Cookie 黃色 FLIP 回收，以及 Chess Choco Cookie 同名條件與全體固定 HP 增加均已接入規則、UI 與公開 command trace。1907×863／1164×777 合計 36／36 Browser A/B 通過；7 筆 strict contract verified，候選仍維持 inventory、未 promote。詳見 [BS9 進度報告](docs/bs9-progress-2026-09-10.md#第九批-bs9-034038候選局部通過)。

2026-09-11 修復 BS9-010「Shadow Milk Cookie」與 BS9-014「Candy Apple Cookie」的 HP 公開位置／朝向，以及 BS9-015「Parfait Cookie」昏厥後續目標誤列：登場／攻擊 Then 及 Candy Apple 登場效果依卡文將取得的 HP 正面朝上放到來源 HP 最下方；BS9-015 第二段只保留第一段實際登場的 Cookie。同步修正公開 HP 卡圖、詳情、對戰紀錄與 EXTRA 條件阻擋提示。測試對局設定的候選 staging 額外牌組欄位現在可解析 BS9-010／BS9-030，仍不會加入正式卡池。BS9-010 桌機／平板 10／10、BS9-014 正負 4／4、BS9-015 正負 4／4 候選 Browser 及官方卡圖載入通過，正式牌組／完整線上逐卡驗收仍待，詳見 [BS9 修復報告](docs/bs9-progress-2026-09-10.md)。

2026-09-10 BS9 候選第一、二批 BS9-001～023 維持隔離轉接：官方英文資料 185 筆／118 個基礎卡號維持 inventory；本批 Browser 為 BS9-001～009 68／68、BS9-010～023 80／80 的雙尺寸正／負路徑，第二批另有 8 項規則／adapter 回歸。BS9-006 另以同回合實際 `declare-attack`／傷害結算續接確認正向 HP 2／2、負向 HP 1／2；一般 `card:` 路徑的下一回合攻擊不作為 -3 證據。BS9-001～023 的 card-check／Browser fixture 均以官方 BS8／BS9／Starter 實體卡牌記錄建立，並有回歸測試阻擋佔位符回流。完整 Vitest、正式牌組／多人／線上逐卡仍分層記錄；候選不進正式卡池、不 promote。詳見 [BS9 進度報告](docs/bs9-progress-2026-09-10.md)。

2026-09-10 完成 BS9-024～029 第三批候選局部驗收：BS9-024 技能／攻擊後 HP 回手、BS9-026 FLIP 抽牌、BS9-027 手牌置 HP 後傷害、BS9-029 有序 donor／receiver FLIP 已補 exact adapter、規則／UI 回歸；BS9-028 vanilla 登場 smoke 通過。`test:bs9-024-029:browser` 在 1907×863／1164×777 共 56／56 通過，BS9-025 基礎版與 `@1` 異圖各自完成 review-only 詳情／fail-closed 正負路徑。BS9-025 仍因官方 FLIP 受益者／目標邊界未裁決而維持 review-only 與 fail-closed，候選不進正式卡池、不 promote；完整結果與正式牌組／多人／線上逐卡邊界見 [BS9 進度報告](docs/bs9-progress-2026-09-10.md)。

2026-09-10 完成 BS9-030「Shadow Milk Cookie」第四批候選局部驗收：EXTRA 登場前棄置 3 張黃色 FLIP Cookie、On Play LV.1 目標、普通攻擊 3 黃色能量，以及攻擊後棄置 BS9-026 並發動其 FLIP 抽牌的完整續接均已接入 exact adapter、規則／command trace 與實際 UI。正向／負向在 1907×863／1164×777 共 8／8 通過；候選維持 inventory 隔離，不等同正式牌組／多人／線上逐卡完成，詳見 [BS9 進度報告](docs/bs9-progress-2026-09-10.md)。

2026-09-11 依實體卡圖補齊 BS8-121「Black Concoction」、BS8-122「Milk Cart」與 BS8-125「The Days of Resolution and Dignity」的正式卡牌 fixture：BS8-121／122 使用正式紫色 Item、錯色 Item、錯類型 Cookie 與實際抽牌卡，BS8-125 使用正式 Stage、舊 Stage、Dark Cacao Cookie、紫色支付卡及 15／13 張真實棄牌區卡。規則回歸與 Chrome `test-state` 正／負 A/B 均通過，確認紫色 Item 條件、抽牌上限、場景放置後攻擊費用 3→2 與 15 張門檻不成立時維持 3；這仍是局部驗證，不等同正式牌組、多人或線上逐卡覆蓋。

2026-09-09 修正 BS8-095「Herb Cookie」與 BS8-098「Warmth of the Snowfield」的可重現驗證局面：前者保留可棄手牌並以無手牌負向路徑驗證昏厥代價；後者將 Then 翻成「接著，你可以支付 1 點藍色支援能量；若支付，且自己的手牌為 2 張或更少，則從牌庫抽最多 3 張牌」，並保留手牌條件成立／不成立的陷阱後續。規則回歸與 Chrome Browser 正／負 A/B 通過；這仍屬 localhost `test-state` 局部驗證，不等同正式多人／線上逐卡覆蓋。

同日補正 BS8-100「Snowfall Lantern Tree」與 BS8-119「Crunchy Chip Cookie」的可重現卡牌局面：BS8-100 改用正式 Tiger Lily Cookie、Herb Cookie、Warm Wind Flower、White Flour Fog 作為真實手牌，並以正／負 Browser 路徑驗證藍色支付、來源移至棄牌、只選藍色手牌及等量抽牌；BS8-119 則以正式 BS8-103「Dark Cacao Cookie」作為棄牌區候選，透過另一張正式卡的實際技能鏈驗證來源支付後進棄牌、Dark Cacao 從棄牌區進入戰鬥區並觸發 OnPlay，再完成紫色支付與雙目標 HP 棄牌。這些是 localhost `test-state` 局部驗證，不等同正式牌組、多人或線上逐卡覆蓋。

同日補上 Awakened EXTRA 卡的底卡顯示：所有帶有 Awakened runtime underlay 的戰鬥區卡牌，現在會在目前卡面旁呈現覺醒前的真實卡圖與卡名，並可點擊查看底卡詳情；卡牌詳情也會列出底卡與卡號。BS8-027「Golden Cheese Cookie」與 BS8-104「Dark Cacao Cookie」的正向 Awaken 及 BS8-027 不成立條件已以 Chrome Browser 實際驗證；這仍屬 localhost `test-state` 局部驗證，不等同正式多人／線上逐卡覆蓋。

2026-09-10 將 BS8-107「Wizard Cookie」的 `card:`／`card-negative:` fixture 手牌改為同系列正式卡：兩張可支付的紫色 Item，以及藍色 Item／紫色 Cookie 反例；Chrome 實際走過代價選擇、目標與 HP 棄置，並確認負向路徑只因缺少紫色 Item 而阻擋。這仍屬 localhost `test-state` 局部驗證，不等同正式牌組、多人或線上逐卡覆蓋。

2026-09-10 完成 BS8 紫色 101–125 剩餘四張的條件／代價負向收尾：BS8-111 保留 Onion Cookie 登場但移除棄 1 手牌代價，BS8-113／114／117 分別以 14／29／14 張棄牌驗證 15／30／15 張門檻；四張卡與 BS8-107 在 1907×863／1164×777 共 10 個 strict ability A/B Browser 報告均通過。這仍是共用正式 adapter／規則／UI 的 localhost `test-state` 局部驗證，不等同正式牌組、多人或線上逐卡覆蓋。

2026-09-08 將依實體卡圖建立獨立預期、逐項負向案例、精確 Browser 結果與證據失效規則寫入 [卡牌稽核 Skill](.agents/skills/braverse-card-import-audit/SKILL.md)，供不同模型沿用相同驗收標準。

2026-09-08 整理 Codex 工程工作流：以 `$braverse-workflow` 為日常入口，合併重複規則、明訂授權與驗證證據邊界，取消 OpenCode Go 備援；Braverse 子代理上限為 2，不含主代理。這是工作流改善，不代表遊戲功能通過新的品質驗收。

2026-09-08 修正 BS8-053「Gim Cookie」的可重現測試局面：`card:` 正向路徑配置唯一疲勞綠色支援卡，`card-negative:` 路徑配置全數活躍支援卡；效果面板與效果紀錄在零合法目標時明確顯示未生效，並以規則回歸及 Chrome Browser A/B 實際操作確認。這仍屬 localhost `test-state` 局部驗證，不等同正式多人／線上逐卡覆蓋。

2026-09-08 修正 BS8-074「White Flour Fog」的可重現陷阱局面：`card:` 以己方 2 張／對手 4 張支援卡驗證條件式免費支付，`card-negative:` 以 3 張／4 張保留印刷 `{G}` 支付；規則回歸與 Chrome Browser 正／負 A/B 均確認目標、付款、支援卡橫置及攻擊力 -1。這仍屬 localhost `test-state` 局部驗證，不等同正式多人／線上逐卡覆蓋。

2026-09-08 修正 BS8-085「Pinecone Cookie」的可重現目標局面：`card:` 使用正式 White Ghost Cookie 並保留 1 HP，另以正式 Sherbet Cookie 作高 HP 反例；`card-negative:` 保留對手餅乾但移除所有 1 HP 目標。規則回歸與 Chrome Browser 正／負 A/B 均確認棄 2 張手牌、只顯示合法 1 HP 目標及無目標時不昏厥。這仍屬 localhost `test-state` 局部驗證，不等同正式多人／線上逐卡覆蓋。

2026-09-08 完成 BS8-076 凍結目標的攻擊後／下一個 Active Phase 分支驗證，以及 BS8-059 Mystic Flour Cookie 的逐目標 HP 1／2 張選擇、支援區代價與線上 payload；技能支付時支援區維持一般能量排版。BS8-076 Browser 12／12、BS8-059 Browser 18／18（1907×863／1164×777）通過，完整 Vitest 292 檔／4,508 項與 build 通過；全域 lint 僅保留既有診斷檔的 3 項 unused 錯誤。

2026-09-07 依桌機／平板優先範圍重查 BS8 全部125張基礎卡、171筆含異圖資料，逐張文字與runtime對照見 [本輪逐卡複核](docs/bs8-text-runtime-review-2026-09-07.md)，操作與驗證分層見 [桌機／平板稽查](docs/bs8-desktop-tablet-audit-2026-09-07.md)。已修復攻擊付款隱藏手牌、一般／攻擊支援卡間距、059／067／072／111「最多」數量、076可略過Then、005／009／021傷害順序、028／029基礎卡號遺失技能及083異圖多出的每回合一次標記；另補051／052真實候選、069綠色卡牌回收與略過、120零手牌邊界及promotion測試完整隔離。經確認後已開放正式EXTRA：Standard／Open編輯器、相容JSON、本機與標準好友房共用全牌組驗證和建構，15筆含異圖可放入獨立六張額外牌組。

本輪稽核續查至黃色BS8-047（仍有逐卡驗收缺口），依使用者最新要求以桌機與平板為主，手機模式暫緩。已修復來源已離開休息區仍繼續補HP、未翻開的補HP FLIP提前影響剩餘HP與公開數字、付款面板遮擋攻擊目標及卡牌詳情關閉按鈕溢位，並補清楚可選0張與技能能量不足提示。022／025的昏厥代價改走完整昏厥結算，先付款再依新狀態選目標；024異圖誤用025卡文已在正規化邊界修正。027攻擊後全體傷害已支援自選順序；039補上無登場候選時的操作指引，040修正強制棄牌來源卡名Unknown。既有手機局部修正保留；局部卡牌驗證、完整套件與正式多人驗收仍分層記錄。

2026-09-05 全專案 UI/UX 與 BS8 全卡稽核進行中：已修復線上隱藏資訊、命令捷徑／洗牌種子、結束事件遺漏／未付款結算及部分 BS8 文字／付款／效果問題；付款中的支援卡改為可逐張點選，資訊視窗補鍵盤焦點與重新開始確認。依官方 v1.8 修正 BS8-011 的完整目標選擇代價、BS8-006 的可選 Then 與配對選擇，並修復低階 AI 的同方誤選。市售 TCG 的主要差距、修復狀態與未完成範圍見 [稽核報告](docs/ui-ux-and-bs8-audit-2026-09-05.md) 和 [125 張逐卡矩陣](docs/bs8-full-audit-matrix-2026-09-05.md)。既有 contract verified 不等於卡文語意或完整對戰驗收。

2026-09-05 的 BS8 綠色重驗涵蓋 BS8-051～075，共 25 個基礎卡號／34 筆含異圖紀錄。逐卡正式 Browser 流程、條件 A/B、卡圖載入與嚴格契約均通過；本輪修正 BS8-059 的另一同名餅乾禁止發動、BS8-065 的可選支援重置、BS8-073 的陷阱 Then 可選綠色付款與對手支援選擇，以及 BS8-074 的條件式陷阱減費。完整測試與 AI Browser 20/20 均通過；尚不將 localhost 局部驗證表述為每張卡完整線上對戰覆蓋，詳見 [本輪驗證紀錄](docs/bs8-green-validation-2026-09-05.md)。

2026-09-04 的 BS8 黃色重驗涵蓋 BS8-026～050，共25個基礎卡號／35筆含異圖紀錄。逐卡局部 Browser A/B、適用的選0、卡面載入與35/35契約檢查已通過，並修正支付／Then／條件／對戰紀錄與本地、線上選牌候選。正式雙瀏覽器好友房核心回歸通過，但不等同每張卡均在完整線上對戰觸發；完整回歸的最新結果與限制見 [本輪驗證紀錄](docs/bs8-yellow-validation-2026-09-04.md)。

BS6 已完成資料準備期、逐色 Browser 稽核與正式 promote：138 筆記錄（107 個不同基礎卡號；106 筆基礎記錄，另 BS6-091 僅有異圖／變體；共 32 筆異圖／變體）已納入 `data/cards/`；正式卡池重新通過 138／138 Browser 入口矩陣、97／97 效果互動矩陣、adapter 回歸、`validate:cards` 與 `check:card-pool`。後續官方更新仍先輸出至 `data/candidates/`，完成同一套稽核後再 promote。

BS7「Arena of Glory」已於 2026-08-22 完成正式 promote：官方英文卡表快照的 143 筆記錄、108 個基礎卡號與 35 個異圖／變體已納入 `data/cards/`，正式卡池共 1,244 筆。108 張基礎卡的 runtime／strict contract 已完成，主效果待轉接 0 張、額外能力待轉接 0 張、攻擊後 `Then` 23／23 已轉接；BS7 formal strict contract 143／143 verified，整體 `validate:cards` 1,244／1,244 且 registry consistent。BS7-039 與 BS7-082 的「對手全體餅乾受傷」使用 sequential 逐目標結算；Browser 專項會刻意先選第二張、再選第一張，逐張處理 HP、FLIP 與昏厥。BS7-097 依官方英文勘誤轉為對手下回合「受到的攻擊傷害 -1」，不再誤作降低自身攻擊力。`gain-hp`、登場 HP 補充或抽牌恰好耗盡最後一張牌時都會建立 pending Refresh；只有被中斷的該張登場餅乾會以明確的 `remainingHpSetup` 接續補 HP，之後才接續尚未補完的效果 HP，絕不藉 Refresh 回滿其他受傷餅乾；無合法回收 LV.1 餅乾時立即以 `refresh-unavailable` 判負。

BS8「Land of Fire & Ruin, Realm of Apathy」已於 2026-08-31 完成正式 promotion：171 筆記錄、125 個基礎卡號（含 15 筆 `EXTRA`）已納入 `data/cards/`，正式卡池由 1,244 增至 1,415 種卡號；156 張非 EXTRA 可玩記錄通過 runtime 轉接，15 筆 EXTRA 由獨立 `ExtraDeckCard` 處理；2026-09-07 已開放正式 Standard／Open 額外牌組，不會混入 60 張主牌組。EXTRA Deck Phase 0／1、六槽候選牌組編輯器、固定 seed Lv.1–Lv.5 staging AI、候選雙瀏覽器房與對手 EXTRA 遮罩均和 Standard 分離；牌組編輯器在 Standard 可篩選 BS7，BS8 主牌可由正式卡池搜尋，六槽 EXTRA 已在正式與候選編輯器各自提供，並可在同一個主要牌組捲動區以實際卡面、卡號、張數與加減控制檢視，正式匯入／匯出使用選填 `extraDeckEntries`；候選仍使用 `candidateStaging.extraDeckEntries`，Standard importer 拒絕候選標記與雙欄位混用。戰場中玩家開啟自己的 EXTRA Deck 時，也會看到每張卡的實際卡圖、卡名與卡號；對手內容仍維持私密遮罩。BS8-005／069／090 的直接登場及 BS8-027／104 的 Awaken 覆蓋核心已有 TDD；localhost `card:`／`card-negative:` 的 BS8-005／027／069／090／104 都會維持對應卡片在獨立 EXTRA Deck，絕不放入手牌；BS8-009 的正向 fixture 以休息區 Cookie LV 總和 3 驗證每滿 3 LV 的加傷，另以總 LV 4／7 回歸測試確認 +1／+2 門檻。正式 strict audit 為 **171 verified／0 needs-review／0 blocked**；BS8-076 的可選 Then「自身置牌庫底 → 抽 1 → 對手下一個 Active Phase 可選擇棄 0 或恰好 2 張以活躍目標」已補齊規則、UI、TDD 與兩條 Browser 分支。BS8-043 依已確認的戰鬥區兩格上限，讓來源 Fettuccine Cookie 佔一格、另一格的本回合從 Break 登場 LV.3 成為唯一合法目標；strict selector 不可退化為任選或全體。本輪並將 BS8-005 的 `card:`／`card-negative:` fixture 接到規則層 eligibility，EXTRA 區只在至少兩張自家餅乾本回合昏厥時高光提醒；BS8-008 Blocker 的紅色能量則由 modal 明確選擇支援卡，未完成支付前禁止確認。凡卡文 `Then, <can be used as {R}>` 均由支援區選擇並支付紅色能量，不自動把來源餅乾當作能量。詳見 [BS8 卡表盤點](docs/bs8-card-inventory.md)、[效果覆蓋盤點](docs/bs8-effect-coverage.md)、[規則裁決矩陣](docs/bs8-extra-deck-ruling-matrix.md)與 [EXTRA Deck 分階段方案](docs/bs8-extra-deck-plan.md)。

正式卡池 Browser 已驗證通用主效果 146／146 正向、156／156 負向，54／54 張能力的獨立技能表面 A/B，以及 14 個 Then 的實際攻擊語意 A/B；EXTRA Deck 的逐卡條件另有局部 Browser gate，正式編輯器／開局與標準好友房接線證據見[正式EXTRA方案](docs/bs8-formal-extra-plan-2026-09-07.md)。所有 BS8 正式來源 strict gate 已完成；後續官方更新仍須回到候選流程，完成同一套驗收後再 promotion。官方卡文的條件句、支付、目標與 Then 轉接另受 fail-closed contract 與 parser 防漏規範約束，不能以部分效果冒充完整支援。巢狀昏厥觸發的 after-damage 結算現在會保留外層 `pendingAbilityEffect`；BS8-011 → BS8-018 → BS1-006 的第二段目標不會再被 after-damage 佇列清掉，效果面板與規則狀態保持同步。

BS6-020「Tonic Spray」已補上陷阱後半段的自身餅乾選擇：可將所選餅乾最上方至多 1 張 HP 卡移回手牌，並保留可略過選擇與既有必要自身目標陷阱的相容行為。攻擊回應只有陷阱時會直接進入陷阱視窗；只有同時存在 Blocker／攻擊回應技能時才顯示通用回應選擇器，避免同一個攻擊宣告重複顯示兩層視窗。

本輪已完成 BS5／BS6 逐卡 Browser 效果語意稽核（2026-08-15）：BS5 效果 143／143（含 14 張條件／時機 A/B）、負向 153／153、無效果攻擊 10／10；BS6 效果 97／97（含 BS6-039 A/B）、負向 138／138、無效果攻擊 10／10。另以 `scripts/verify-bs5-bs6-semantics.ts` 對兩系列全部 291 筆記錄逐張比對官方文字與 runtime 的攻擊／技能／陷阱／物品／場景／FLIP 能量代價、{da} 傷害、Then 傷害、HP 代價與抽牌數量：BS5 400 項、BS6 325 項全部相符。B fixture 將支援區卡設為疲勞，驗證非法能量支付、無支付攻擊不成立，以及攻擊後 `Then` 在實際待處理視窗可正常收斂；報告保存在 `docs/`（`bs5-effect-audit-2026-08-15.json` 等）。

卡牌匯入稽核可使用 BraverseFan 作為社群交叉參考，但不取代官方 JSON、卡面、規則與公告。

卡牌效果文字的官方標記與遊戲規則顯示共用 `CardEffectText`；元件會保留官方 CRLF 段落換行（例如 BS7-104 的被動段與 Activate 段），圖片標籤資產集中於 `public/card-tags/`，並保留文字回退與無障礙替代文字。

牌組賽制分為標準賽制與開放賽制：標準賽制套用版本化的 ASIA 亞洲版 2026-02-13 禁卡／限卡快照（詳見 [禁限卡表文件](docs/banlist-asia-2026-02-13.md)）；開放賽制則允許正式卡池內所有卡牌使用。兩種賽制都仍遵守 60 張牌、同名卡最多 4 張、FLIP 最多 16 張，以及至少 1 張餅乾等基本牌組規則。

牌組編輯器的卡池可依卡牌類型、顏色、系列、稀有度，以及餅乾的 LV、HP、攻擊力篩選；攻擊力條件以官方卡文解析出的普通攻擊傷害為準。

BS5／BS6 攻擊後卡文中的尖括號代價已統一轉為可選的攻擊後效果；BS6-044「Roguefort Cookie」與 BS6-061「Walnut Cookie」的支援區餅乾回手代價，以及 BS5／BS6 其餘同類卡牌，均可略過或依條件支付。BS6-044 的追傷固定鎖定本次攻擊目標，目標昏厥時不建立後續效果。

對戰紀錄的陷阱步驟會先列出實際發動的陷阱卡，再列支付、棄牌與目標；作為代價棄置的卡牌（例如 Banquet of Victory）不會再被誤認為效果來源，本機與線上紀錄共用同一份來源卡 metadata。攻擊後效果則會逐步記錄來源卡、官方效果文字、支付／略過選擇、實際移動的卡牌、目標與傷害／昏厥／增 HP／等待 FLIP 等結果。

BS6-051「Timekeeper Cookie」的攻擊後續目標會明確顯示「從自己的手牌選擇最多 2 張綠色卡牌作為目標（已選 N）」；候選清單只列出來源玩家手牌中的綠色卡牌，避免誤顯示成對手餅乾目標。

BS6-062「Time Rend Scissors」的物品能力已補回 `<{G}>` 能量與「將 1 張支援區餅乾返回手牌」的尖括號代價；發動後可選擇最多 1 張對手餅乾造成 1 點傷害，且 UI 會只列出支援區餅乾作為代價候選。

BS6-063「Into a Time Pocket...」的 test-state 以正式卡文的「支援區正好 5 張」建立成立分支；支付 2 張綠色支援卡後，Browser 可實際進入 Then 二選一，選擇將牌庫頂 1 張牌以疲勞狀態放入支援區。這項 fixture 只負責快速建立合法局面，支付、條件、目標與效果結算仍由正式規則引擎驗證。

BS6-036「Zombie Cookie」的 `card:` test-state 會提供 1 張合法 LV.3 休息區餅乾；支付攻擊後黃色能量後，可實際驗證每張 LV.3 休息區餅乾使自身增加 1 HP 的 Then 效果。

BS6-042「Clever Advice」的 `card:` test-state 會提供 3 張休息區餅乾，讓攻擊回應陷阱可實際進入支付、LV.2 以上目標與抽牌效果流程。

BS6-043「Timecraft Garage」的 `card:` test-state 會提供 1 張黃色手牌餅乾，以及 2 張已橫置支援卡，讓回合結束時的放置、支援卡重置與抽牌效果可以依序測試。

BS6-013「Chess Choco Cookie」的正向 `card:` 夾具會提供第二張真正同名餅乾；BS6-007「Blue Slushy Cookie」則提供對手昏厥證據與 2 張支援卡，兩張卡均有對應 `card-negative:` 條件未成立路徑。BS6-010「Timekeeper Cookie」與 BS6-008「Sugar Swan Cookie」分別提供 `bs6-010-open／blocked`、`bs6-008-trap-open／blocked` A/B 路徑，詳見 [docs/bs6-card-check-routes.md](docs/bs6-card-check-routes.md)。

BS6-031「Timekeeper Cookie」的 `test-state` 會將同時具有 OnPlay 與攻擊後效果的卡牌留在手牌，必須透過正式「登場」指令開啟黃色能量支付與對手餅乾目標選擇，避免攻擊後 fixture 遮蔽登場技能。

BS6-016「Crunchy Chip Cookie」的 `card:` 正向 fixture 會提供 1/3 剩餘 HP，讓「剩餘 HP 為 1」的攻擊後效果能進入目標選擇；負向 fixture 恢復滿 HP，確認條件不成立時只留下合法略過／零傷害 trace。

卡牌詳情中的場景效果沿用官方卡圖換行，將放置場景文字與 Activate 效果分列顯示。

桌面 `tactical-clean` 戰場以深藍桌墊與低對比菱格建立層次；對手場區採紅色、我方採青色完整圓角框，戰鬥區比支援區更深。休息區只保留加大的 `LV. x/10`，兩側功能欄分別依對手「棄牌 → 牌庫 → 場景」與我方「場景 → 牌庫 → 棄牌」排列，並與可見場區等高。雙方另預留靜態額外區：我方位於支援區左側、休息區下方，對手採 180° 鏡像；目前不接入遊戲狀態或操作。全畫面裝飾框不延伸至手牌區，避免切過卡片與影響操作體感。

平板橫向（901–1280px 且高度不超過 840px）正式採用與戰場 mockup 相同的 `src/styles/tablet-layout.css`：1164×777 以支援區／戰鬥區 36／64 與 64／36 鏡射比例配置，手牌改為底部操作 dock，右上／左下雙方資訊牌在此尺寸隱藏，並為右側階段列與左右資源欄保留安全邊界。

對戰桌以共用展示元件呈現本機與線上對戰，將攻擊者、攻擊目標、回應流程與傷害結算的可視回饋維持一致，避免玩家必須從對戰紀錄回推目前攻擊關係。

戰鬥進入待處理階段時，行動者顯示以規則層的 `getActingPlayerId` 為準，而非只看回合的 `activePlayerId`；因此 BS3-010「Pitaya Dragon Cookie」攻擊 BS4-024「Kumiho Cookie」時，防守方回應窗會正確顯示目前等待對象，對戰紀錄也會保留「等待防守方回應」等尚未結算的進度。

Browser 實戰稽核與 `test-state` 分層：`test-state` 僅驗證局部成立／不成立 UI 與規則分支；正式 Browser 實戰則從主選單正式牌組入口開始，涵蓋猜拳、調度、起始餅乾、支付、攻擊、陷阱／FLIP、昏厥補位、OnPlay、結束階段與勝負結算，兩者分開記錄。

主選單的 AI 對手設定在桌機／平板以牌組 8、等級 4 的欄寬比例呈現並保留欄間距；手機改為單欄。開發者工具依視窗寬度在桌機顯示、手機可收合，合法牌組的錯誤提示則以布林狀態控制，避免將 `errors.length = 0` 誤渲染到畫面。

戰鬥區文字固定於中央；單張餅乾使用左側卡槽，兩張餅乾分居左右卡槽。卡片的「能量不足」與「啟動技能」提示會完整置於所屬卡片的外側，避免遮蔽中央戰鬥區文字、HP 卡或支援區。

我方攻擊翻開對手 HP 卡的 FLIP 效果時，沿用左側卡牌快速預覽固定顯示約 3 秒；玩家可點擊預覽外側提前關閉，避免必須查看對戰紀錄才能確認翻出的卡片。

本專案以官方 Braverse 規則、官方起始牌組卡牌資料、卡背與能量圖示為基礎，將純函式規則引擎、AI 決策與 React UI 分離。規則引擎集中於 `src/game/`，官方卡牌資料轉接集中於 `src/cards/`，React 畫面只呼叫規則層公開 API，不另寫權威規則。

對戰紀錄匯出除了提供 `initialState`、`commands`、`commandLog` 與終局快照，也會標記資料來源與樣本品質；測試局面、零動作快照、未完成對局、非精確 replay 與線上遮罩資料會由 `training.exclusionReasons` 明確排除，避免誤送入 AI 訓練集。離線 AI 對局另記錄 `aiLevel`、`AI_STRATEGY_VERSION`、可選的 `VITE_GIT_COMMIT`、對應 `commandLogId` 與公開決策理由；`strategyMemory` 與線上 AI metadata 永不匯出。

離線 AI replay 的 `public-attack` 決策理由使用規則層的公開宣告傷害，包含已公開的攻防修正與目標條件；同回合先發動技能、後續再完成同一擊倒的行為也會記為成功轉換，避免把正確操作輸入成訓練負樣本。策略版本已提升為 `lv5-defense-retention-endgame-v2`。

BS4 沿用 BS3 的候選資料流程：先將官方英文資料匯入 `data/candidates/` 的 `inventory` 快照，再依卡面文字與官方規則逐色稽核 runtime adapter；候選完成驗證與效果覆蓋前不直接併入 `data/cards/`。

測試對局設定以正式卡池為來源，可逐方指定戰鬥區餅乾、精確 HP 卡、起始手牌、牌庫頂端順序、支援區實際卡片與能量顏色、場景卡及棄牌區卡片；未指定的牌庫尾端與支援區張數才以測試填充補足。設定視窗提供 BS3-018 的 Blocker／傷害分支與 BS3-020 的 HP 卡回手快速案例，方便在正式規則流程中重現問題並回報。

目前以《綜合規則》Ver.1.2、《CRB 遊戲指南》240812 更新版、《CRB 說明書 P1》、《裁判指南》及 2026-03-30 官方 Rule Update 作為規則文件基線；專案裁定與仍待新版官方資料覆核的項目記錄於 [docs/rule-clarifications.md](docs/rule-clarifications.md)。

卡牌效果觸發會依官方文字描述的區域與卡牌所有者判定，不以造成移動的效果控制者取代事件條件。

效果操作的 UI 以「同一個提示框完成一段決策」為原則：必要時依序呈現能量、代價、二選一效果與目標，並讓玩家在最後一步才確認發動，避免同一效果被巢狀提示打斷；一般條件效果只有在規則層判定成立且存在合法目標時才顯示目標選擇，但若卡文把手牌門檻放在棄牌代價之後（如 BS6-084），則先完成付款／代價，再於同一面板顯示條件目標。

複合效果若同時要求支付能量、額外操作支援區與選擇餅乾目標，UI 會依卡面順序拆成獨立步驟；已作為能量支付的支援卡不會再次出現在後續支援候選中。

技能代價若令戰鬥區清空，UI 會先保留規則層產生的原效果佇列：效果、傷害、FLIP 與昏厥後續都完成後，才建立強制補位；沒有可補位餅乾時也要先完成原效果，再顯示對局結果，不會讓補位或敗北判定插入卡牌效果鏈。

昏厥效果遵守「卡牌效果優先於補位」順序：同一狀態若同時有昏厥／傷害／OnPlay 效果與補位任務，先完成整條效果鏈，再開啟強制再登場及其 OnPlay；BS3-029 的黃色能量付款、手牌目標與 `+1 HP`，以及 BS6-101 從棄牌區登場前的紫色能量付款，均已接入離線、線上及 AI 決策流程。

對戰資訊可視化依 P0–P2 分層：P0 固定顯示行動玩家、階段、來源卡、攻擊箭頭與一致事件句型；P1 顯示宣告 → 費用 → 代價 → 目標 → 結算進度、對手卡牌預覽與陷阱／FLIP／攻擊效果回應狀態；P2 提供活動紀錄篩選、連線同步細節與伺服器提供的決策期限。戰場採扇形手牌與左右資源欄；對手手牌以貼齊頂緣的淺弧牌背呈現，我方手牌以低弧度展開，卡牌僅於 hover 或鍵盤 focus 時顯示左側快速預覽。所有線上公開提示都只使用伺服器過濾後的公開卡牌與 instance ID，不揭露對手手牌或牌庫內容。

專案開發流程已整理為 `.agents/skills/develop-braverse`、`.agents/skills/braverse-workflow` 與 `.agents/skills/braverse-card-import-audit` 三個 Skill，統一需求分析、規則查核、架構邊界、卡牌匯入、Chrome 逐色效果稽核、測試驗證、文件同步、派工與 Git 收尾步驟；`AGENTS.md` 保留硬性規範入口。子代理協作與停滯交接流程見 [docs/subagent-stall-handoff-protocol.md](docs/subagent-stall-handoff-protocol.md)。

CI/CD 採 GitHub Actions + Vercel Git Integration：GitHub Actions 執行卡牌驗證、app＋server typecheck、測試、零 warning lint、build 與 bundle gate；AI、牌組編輯器與好友房 Playwright 組成 `test:browser:smoke`，在 Browser 影響範圍的 PR、`main` push 與手動觸發時執行，並由固定名稱 `Browser Smoke PR Gate` 彙總結果。Vercel 監聽 PR 與 push 自動產生 Preview 與正式部署；`deployment_status` 成功後另以外部 URL 驗收首頁、SPA rewrite、牌池卡圖、合法牌組匯入、正式對戰入口與 Render WebSocket。Preview 若啟用 Vercel Authentication，需在 GitHub 設定 `VERCEL_AUTOMATION_BYPASS_SECRET`。

好友房 V1 不做自動重連；前端只保留單一有效 WebSocket，容許 Render 最長 90 秒冷啟動，連線後 10 秒內未收到伺服器回應或中途斷線時會明確結束並顯示錯誤，不讓畫面永久停在「連線中」。

好友房以玩家輸入的名稱識別雙方；攻擊宣告前的餅乾選取與支援卡付款預覽使用非權威暫態訊息同步，正式狀態仍只由伺服器的 `GameCommand` 結果更新。

好友房開局由伺服器協調私密猜拳、勝者選擇先後攻、依順位調度、強制調度補償與起始餅乾覆蓋；開局操作直接疊加在對戰桌上，雙方完成後才同步揭示起始餅乾並進入正式回合。

## 目前進度

2026-10-18 PR #125 後續修正：45 項定向回歸、完整 Vitest 1,067 檔／21,302 項、typecheck、全域 lint 與 production build 通過；PR #126 的 Browser Smoke／PR Gate 已通過，CI 在目前 PR head 上仍執行中。

本批新增 ST8-001 正式卡池與父場景／子傷害續接修復；提交前完整回歸終值見頁首最新紀錄。

- 2026-10-12 Refresh 獨立提交：控制器／重播 4 檔 32 項測試、受影響檔案 lint 與 build 通過；測試只依賴既有 ST7-012 原卡 fixture。沿用先前雙尺寸局部 Refresh 操作與精確重播證據，未新增逐卡 online 驗收。全工作區 ST7-011 全套首輪有 1 項卡池數量預期失敗，已修正但尚未完整重跑；本次不納入 ST7-011、ST7-013、AI 原型或候選資料。

- 2026-10-12 部分提交範圍：正式 AI v13、六副 Cookierift 構築及 ST6～ST10 已 promote 36／100 張。最新完整回歸 887 檔／18,467 項全部通過、1703 份來源指紋一致；v13 對 v12 共 1248 場各勝 624，不宣稱穩定勝率提升。

- Lv.5支援代價續接評分已完成：完整Vitest804檔／17,133項、build、lint與AI Browser通過；固定種子前後各24場勝負相同。

- PR #124 修復：相關 7 檔／123 項回歸、最終控制器 3 檔／20 項回歸、typecheck（含 server）、全域 lint 與 build 通過；兩則留言的新問題由規則／控制器測試覆蓋。既有 BS12-009／082 雙尺寸付款正反、取消／返回 Browser 共 12 案通過，不代表新的跨陷阱切換或展示道具組合已完成 Browser／online 驗收。

- 2026-10-08：BS12 154 筆印刷已 promote，正式 registry 與 BS12 系列篩選已同步。799 檔／17,048 項完整 Vitest、build、lint、strict 154／154、資料驗證及 Browser smoke 通過；驗證來源雜湊未變。正式完整對局與逐卡 online 仍未驗收，AI 對 BS12-014／015／082 採保守處理。

- **BS12-091候選局部驗收**：兩印刷雙尺寸188／188、專項123項及24檔／667項回歸、strict2／2、build／lint通過；先付牌庫頂三張，再取己方棄牌區其他名稱Blocker Cookie，Chrome正反、16案可見紀錄與共用48案另列。一般6,994、cursor092／092@1、剩21基礎／32印刷。完整700檔／11,138項屬091前版本，本批全套留093批末；正式／逐卡online未完成，裁定留112及全部印刷後。
- **BS12-090候選局部驗收（歷史快照）**：兩印刷雙尺寸180／180、91項專項與16檔／505項回歸、strict2／2、build／lint通過；Blocker與免費昏厥LV1移牌分開，四張門檻含來源、三張反例、選零／反選／超選、FLIP與LV10已驗。088～090最新完整Vitest700檔／11,138項（809.98秒）、AI／ST1核心同步及1,344凍結雜湊通過，共用088／089共32案另列。一般6,806、cursor091／091@1、剩22基礎卡號／34印刷，091～093六印刷卡面已備；裁定留112全部印刷後，154 inventory／0 promoted，正式／逐卡online未完成。
- **BS12-087歷史局部驗收**：雙尺寸68／68、PP／0～1對手本回合-2及十張任意Arena棄牌後同一目標-1，來源先入棄牌、選零／取消／非法付款與真正傷害結算已驗；新增83項、受影響14檔／514項、strict1／1、build／lint及AI／ST1核心同步通過。可見紀錄六案、共用086十二案／029十六案另列；當時完整Vitest691檔／10,795項（726.24秒）及1,343凍結來源核對通過。當時cursor088／088@1，一般6,270，剩25基礎卡號／40印刷；088～090六印刷卡面已備，全部裁定留112及全部印刷後，正式BS12／逐卡online未完成。
- **BS12-083歷史局部驗收**：雙尺寸52／52、P1與0～1己方棄牌區Blocker、正常HP、選零／取消／非法付款與Refresh；DJ新棄牌目標由付款後狀態選取。本機／online UI專項38項、受影響16檔／370項、strict1／1、build／lint通過，共用082八案另列；當時cursor084，一般累計6,030。
- **BS12-082已確認分支局部驗收**：最終雙尺寸72／72、受影響15檔／378項、strict1／1，一般累計5,978；剩30基礎卡號、45印刷。原凍結版完整679檔／10,466項及AI／ST1核心同步通過；手牌門檻補修與083的最新全套待本批末。多來源R005仍待裁定。

- **BS12-081候選局部驗收**：雙尺寸56／56、受影響19檔／375項、build／lint／strict通過；一般累計5,906，cursor082。079～081批末完整Vitest675檔／10,408項、AI／ST1核心同步通過，1,321個來源雜湊一致；既有Blocker共用10案另列。
- **BS12-079歷史局部驗收**：N1普通1、兩HP登場，雙尺寸32／32、受影響421項與build／lint／strict通過；一般累計5,786，cursor080。
- **BS12-078歷史局部驗收**：雙尺寸60／60、一般累計5,754；675項、build／全域lint／strict1／1通過，077共用6案另列。cursor079，完整Vitest668檔／10,261項、AI／ST1核心同步通過；154 inventory／0 promoted，正式／逐卡online未完成。

- **BS12-075／075@1歷史候選局部驗收**：雙尺寸124／124、一般累計5,642；受影響9檔／799項、build／lint及strict靜態2／2通過，016共用12案另列。cursor076；075／076批末全套及AI／ST1待076後，正式／online逐卡未完成。

- **BS12-074／074@1歷史局部驗收**：雙尺寸一般228／228、隔離事件反例12／12另列，專項220項、受影響453項及build／全域lint／strict通過；修正HP移動提示及公開紀錄。候選一般累計5,518，cursor075／075@1，AI／ST1核心同步通過，本批完整Vitest660檔／10,007項（699.18秒）全數通過。

- **BS12-073／073@1歷史局部閘門**：雙尺寸176／176一般操作、另列8／8裝備清理及Awaken隔離防護；專項98項、受影響587項（兩組有重疊）、strict2／2、build／lint與共用Browser10案通過。原生Chrome另核對異圖六／五張手牌及原版攻擊後實際來源／HP結算紀錄。當時候選局部累計5,290，cursor074／074@1；074及本批回歸的最新結果見上列。
- **BS12-071／072歷史批次結果**：2026-10-03四印刷已確認分支局部Browser132＋156＝288案，當時累計5,114；072完成B1啟動、另一張己方LV2以下Arena放牌庫底及BB普通2，修復共用面板收合／展開重設步驟。focused12檔／671項、完整Vitest653檔／9,688項（674.86秒）、build／全域lint、AI Browser與ST1好友房核心同步通過。072兩印刷Then因R004整段未執行，strict維持0 verified／2 needs-review；所有裁定待112含全部印刷處理後統一提報。當時cursor073／073@1；最新進度見上列，154筆候選inventory／0 promoted，正式BS12／逐卡online與全系列未完成。

- **BS12 候選逐卡轉接／操作（2026-10-01）**：001～031及已驗異圖Browser1,760／1,760；031雙尺寸72／72，涵蓋YY及己方黃色Arena戰鬥區餅乾進休息區代價、抽牌與傷害獨立可選、取消／返回、非法付款／代價、補位及Refresh。strict1／1、build／lint、focused13檔／396項、共用028五十案及AI／ST1好友房回歸通過；完整Vitest552檔／7,139項（699.85秒）通過；cursor032／032@1。主效果44／18／50、Then5／23、strict59／93／2僅靜態盤點，031原標converted卻缺item ability，已補獨立回歸及guard；154筆inventory／0 promoted，正式／online及全系列未完成。見[BS12報告](docs/bs12-progress-2026-09-30.md)。

- **BS10／BS11 自動驗證與六色賽事（2026-09-30）**：新增來源／程式／原圖／獨立預期指紋與執行前後新鮮度檢查；指定 FLIP 雙尺寸 30／30、Wind Archer 的 FLIP 插入續接正反 8／8 通過。最新完整 Vitest **489 檔／5,765 項（828.92 秒）**、全域 lint、build、AI Browser 通過。1024 副不同構築的 **5120 場 Swiss＋7 場淘汰賽 PASS**，0 重賽／0 未完成，獨立積分、對手分、配對與來源指紋稽核通過；冠軍黑色 #062，TOP 8／四強皆黑色。BS10／BS11 靜態 strict 為 164／164、159／159；610 個來源片段尚未接入新的獨立預期格式，正式／線上逐卡與 CDN 直連仍分開列缺口。賽事與牌表入口見 [本輪報告](docs/bs10-bs11-automatic-validation-2026-09-30.md)。

- **PR #123 CI 修復（2026-09-30）**：AI 策略改為 AI 回合／模擬請求時載入，Browser Swiss 頁面改為直接引用 tournament 模組，使主入口 gzip 回到 144.24 KiB（180 KiB 預算內）。CI Vitest 改用單 worker；完整測試 481 檔／5,720 項、AI Browser 6 項、typecheck、lint、build 與 bundle gate 均在本機通過；GitHub Actions 會以 runner 環境重跑相同 gates。

- **BS11 generic test-state 修正（2026-09-29）**：BS11-091／116 的通用 `card:` 路由將 EXTRA 正確放在 EXTRA Deck；092 場景加入官方黑色 LV.2 Special Play BS11-111。Browser 實際發動 Licorice 使其當前 LV 降至 1、以其支付登場 BS11-111，再棄 1 張手牌並對對手造成 1 傷害；focused 19／19、完整 Vitest 481 檔／5,720 項（581.78 秒）、修改檔 scoped lint、build 通過。這是 localhost fixture 證據，不代表線上逐卡技能矩陣完成。

> 下方較早批次摘要保留各批完成當時的驗證快照；最新測試總數與 Browser 範圍以本節上方最新批次及 [BS11 進度報告](docs/bs11-progress-2026-09-22.md) 為準。

- **BS11 正式卡池狀態（2026-09-29）**：官方 booster 清單經桌面瀏覽器核對為 150 張（116 基礎＋34 重複印刷）；正式卡池 159 筆是 BS11 前綴跨產品資料，另含 Eternal Farewell promo 8 筆、Time for Deceit promo 1 筆，並非 9 張漏卡。正式卡池核對 19 檔／1,923 筆／1,881 converted，BS11 strict contract 159／159、攻擊 Then 27／27。局部 test-state Browser A/B 路徑 344／344，另完成 EXTRA／Awaken 20／20、088 On Play 8／8、115 24／24、116 18／18 與 035 16／16；牌組編輯器四尺寸已能篩選、加入及移除 BS11 主牌與 EXTRA。正式 AI 牌組實戰第 15 回合完成結算；雙瀏覽器線上 BS11 牌組以 157 命令、16 次付款攻擊走到 Refresh 勝負，雙端結果一致且完成後離線仍保留結果。strict 與整合對局通過不等於線上逐卡技能矩陣；正式 CDN 直連及該矩陣仍未驗。

- **BS11-074～078 candidate-only Browser 與 071@2 補驗（2026-09-28）**：074／077／078 正反兩尺寸新增 12／12，075／076 前輪 FLIP 正反 8／8，071@2 官方異圖攻擊 Then／EXTRA 技能另補 4／4。077 被動依官方圖文字讓具名 Dark Choco 在 15 張己方棄牌區門檻造成 4 傷害，14 張時造成 3；078 追加 1P 與 HP 送棄只在 15 張門檻成立時出現。完整 Vitest 447 檔／5,601 項（518.51 秒）、build、修改檔 lint 通過。071@2 作為 HP 的無效果揭示待覆核。候選仍 `inventory`／0 converted，079 起 Browser、正式牌組／formal battle／online／promote 未完成。詳見 [BS11 進度](docs/bs11-progress-2026-09-22.md)。

- **BS11-071～073 candidate-only Browser（2026-09-28）**：071／@1 正反攻擊 Then／EXTRA 技能續接、072 棄牌區 15／14 張邊界、073 3N 攻擊付款，在 1280×720／1164×777 共 16／16 通過。071@2 另於本輪完成攻擊路徑；候選仍 `inventory`，正式牌組／formal battle／online／promote 未完成。詳見 [BS11 進度](docs/bs11-progress-2026-09-22.md)。

- **BS11-064～070 candidate-only Browser 與邊界補驗（2026-09-28）**：064～070 在 1280×720／1164×777 新增 66／66 條可操作的付款、代價、目標、結算正反路徑；063／@1 零目標與略過抽牌另補 8／8。062 手牌快照跨後續指令保持固定與擁有者限定。070 牌序及手牌置頂提示均有回歸。159 筆官方卡圖已取得至忽略的本機測試目錄，新 Browser 案例載入原始 WebP；一般 CDN 連線與正式環境仍待驗證。完整 Vitest 首跑 445 檔／5,593 項有 1 項舊測試筆數斷言失敗，修正後該檔 5／5 通過，全套當時未重跑；build、scoped lint、候選驗證與 strict 159／159 通過，全域 lint 仍有 4 個無關既有錯誤。候選維持 `inventory`／0 converted，正式牌組／formal battle／online／promote 未完成。詳見 [BS11 進度](docs/bs11-progress-2026-09-22.md)。

- **BS11-060～063 candidate-only Browser 輕度驗收（2026-09-28，前一輪）**：060 紅色支援支付任意 1 能量攻擊、061 2B 移動對手 HP 頂牌、062 2B 場景放置／自我送棄／擁有者限定手牌快照（含空手牌）、063／@1 1B 陷阱減傷與 Sea Fairy／Ancient 條件 Then 抽牌；兩尺寸正向／阻擋／條件不成立共 26／26。前輪完整 Vitest 443 檔／5,577 項（517.37 秒）、build、scoped lint、candidate validation、strict 159／159 通過。當時 CDN 受網路限制未載入圖像，候選仍 `inventory`，正式牌組／formal battle／online 未完成；本輪已補快照後續變化與 063 邊界。

2026-10-11 ST7-002正式進度：Mango 已完成原圖逐字核對、免費On Play己方休息區總LV至少2→自身補1HP及Y普通1的實際來源驗收，已單卡promote。共用解析修正同時保留BS4-033休息LV5門檻與BS6-078手牌至多5門檻；候選12檔652項、正式13檔659項回歸、候選與正式build／全域lint／單卡strict／資料及registry皆exit0。候選與正式各同46案雙尺寸原圖Chrome（補HP36＋Mango普通攻擊10）及獨立實際指令重播PASS，仍為準備式局部流程，不等於開局至勝負或逐卡online。Lv3～5另12案正式AI探針確認門檻未達略過、達標接受免費補HP；標準AI Browser也PASS，這不是新勝率證據。正式44 JSON／2110卡號／2054轉換／1571 canonical AI cards；ST7能力稽核ready3／5能力／0unsupported／0conversionFailures。ST6～ST10現為30正式／70候選（ST6=20／0、ST7=3／17、ST8=1／19、ST9=1／19、ST10=5／15）。本批完整Vitest已終值exit0：872檔／18,125項全部PASS、1309.94秒，1665份來源／設定／資料指紋一致，來源凍結已結束；此完整回歸不涵蓋其後ST7-003候選來源修改。ST7-003原圖及獨立預期、轉接基線已存output；14種執行期strict變異僅攔2／漏12，正式來源未套用，也未promote。初版兩個無效手牌篩選欄位的診斷已撤回，v2改真實discardHandType／discardHandColor重驗，統計取v2。未commit／push。
- **BS11-054～058 candidate-only Browser 輕度驗收（2026-09-27）**：新兩尺寸路徑 24／24 通過，另重用 057 simple FLIP 4／4；覆蓋 On Play 攻擊限制／手牌代價、任意能量攻擊、Activate 條件／抽牌／Once Per Turn、FLIP 與 opponent-attack response。Astra 指出 056／058 普通攻擊負向 route precedence 問題，紅綠測試修正後 focused 2 檔／14 項、完整 Vitest 441 檔／5,565 項（522.12 秒）、build、scoped lint 通過。Browser 矩陣早於 route guard 修正，該兩條 generic attack route 在 focused 回歸中另行確認；未重跑 UI 矩陣。官方圖資實際載入與少數 timing／target 邊界未驗收；候選仍 `inventory`，正式牌組／formal battle／online 未完成。
- **BS11-050～053 candidate-only Browser 輕度驗收（2026-09-27）**：base／@1 在 1280×720／1164×777 共 40／40 正反路徑通過；053 另驗 Activate，確認恰好 5 HP 的 Cookie 失去 1 HP、4 HP 不受影響，並在公開 trace 記錄 HP 張數變化／無符合目標原因。修正 Then self-trash 代價提示與 Browser trace steps 讀取，並將 HP 結果限定於合法效果目標；Astra 複核通過。focused 4 檔／89 項、完整 Vitest 440 檔／5,559 項（517.39 秒）、build、scoped lint、candidate validation、strict 159／159 通過。候選仍 `inventory`／converted=0；圖資、正式牌組／formal battle／online／promote 未完成。
- **BS11-045～049 candidate-only Browser 輕度驗收（2026-09-27）**：本地 Playwright 在 1280×720／1164×777 完成 045～049 positive／negative，另驗 047 replacement follow-through，共 26／26。048 正向確認支付 G＋1N 後依 Wind Archer／Ancient 條件休息對手支援，負向付款後 no-op；命令紀錄現以陷阱技能來源判定 Then 條件。Astra 唯讀驗收通過。focused 6 檔／73 項、完整 Vitest 439 檔／5,542 項（525.49 秒）、build、BS11 strict 159／159、candidate validation 與 scoped lint 通過；候選維持 `inventory`／converted=0。外部圖資未載入，048@1 異圖 identity 未做視覺驗收；正式牌組／formal battle／online／promote 未完成。
- **BS11-040～044 candidate-only Browser 輕度驗收（2026-09-27）**：Luna 完成 041～044 Browser driver；主代理以本地 Playwright 在 1280×720／1164×777 對四張卡各完成 positive／negative，共 16 條路徑。040 納入 simple FLIP 後累計 60／60；041 實際支付一張綠色支援回手且所有己方 Cookie +1 HP，042 正向 ready 一張休息支援、負向零目標 no-op，043 正向支付後造成 1 傷害、負向能量不足且無 `declare-attack`，044 七張／六張支援各支付 3 能量後分別造成 3／2 傷害，且付款後支援張數不變。Sol 高度唯讀驗收與首輪失敗診斷已納入修正；focused 回歸 4 檔／36 項、build 與 syntax check 通過。候選仍 `inventory`，正式牌組／formal battle／online／promote 未完成；外部圖資只核對 URL／alt 或命名 fallback，未宣稱 `naturalWidth` 載入。
- **BS11-003／005／019／020／039 RED／YELLOW／GREEN simple FLIP candidate-only Browser 輕度驗收（2026-09-23）**：Luna 擴充既有共用 route／fixture；Astra 以本地 Playwright 在 1280×720／1164×777 對五張卡各完成 positive／negative，新增 20 條路徑，累計 simple FLIP 56／56。正向實際走過 003／020 抽最多 1 張、005／019／039 棄 1 張後附著 Cookie +1 HP；負向確認代價不足或明確不發動，並核對官方圖 URL／alt 或命名 fallback 與公開 trace。候選仍 `inventory`，正式牌組／formal battle／online／promote 仍待；外部官方圖資未載入 `naturalWidth`，未宣稱圖檔載入。
- **BS11-057／059／075／076 BLUE／PURPLE FLIP candidate-only Browser 輕度驗收（2026-09-23）**：Luna 擴充既有 simple FLIP route／fixture；Astra 以本地 Playwright 在 1280×720／1164×777 對四張卡各完成 positive／negative，新增 16 條路徑。正向實際走過 057／075 抽最多 1 張、059／076 棄 1 張後附著 Cookie +1 HP；負向確認棄牌代價不足或明確不發動，並核對官方圖 URL／alt 或命名 fallback 與公開 trace。候選仍 `inventory`，正式牌組／formal battle／online／promote 仍待。
- **BS11-093／095／096／100／101 BLACK FLIP candidate-only Browser 輕度驗收（2026-09-23）**：Luna 完成 route／fixture 與 focused route 回歸；Astra 以本地 Playwright 在 1280×720／1164×777 對五張卡各完成 positive／negative，共 20 條路徑。正向實際由 `declare-attack` 進入 `resolve-next-damage`／`resolve-flip`，確認 093／096／101 棄 1 張手牌後附著 Cookie +1 HP、095／100 抽最多 1 張；負向確認無手牌時代價阻擋或明確不發動，並核對官方圖 URL／alt 或命名 fallback 與公開 trace。候選仍 `inventory`，正式牌組／formal battle／online／promote 仍待。
- **BS11 contract gate 最新收斂（2026-09-23）**：Luna 補上 BS11-033 source-only 自身送 trash、034 手牌 Cookie 等級合計 3 reveal、090 `selfToFaint`、116 EXTRA 移動防止的 shadow ledger 證據；並修正 071 巢狀 EXTRA `On Play`／`Activate` timing 誤判與 080 curly apostrophe 對手目標解析。第四十五批完成 016／016@1 的跨 Cookie HP 核心，第四十六批完成 093／095／096／100／101 的 BLACK FLIP route／fixture，第四十七批擴充 057／059／075／076，第四十八批再補上 003／005／019／020／039 的共用 FLIP Browser 路徑，strict 為 **159／0／0**；完整 Vitest **437 檔／5,524 項（480.81 秒）**、build、scoped lint 通過。simple FLIP 累計 56 條 Browser 路徑；候選仍 `inventory`／converted=0，未完成正式牌組、formal battle、online 或 promote。
- **BS11-016／016@1 candidate-only Browser 輕度驗收（2026-09-23）**：Luna 完成 `totalAcrossCookies` 共享 HP 支付、EffectPanel／pending UI、exact adapter 與 fixture；Astra 以本地 Playwright 在 1280×720／1164×777 對 base／@1 各完成 positive／negative，共 8 條路徑。正向實際選 2 張紅色 Cookie 分攤合計 2 張 HP，來源保留 1 HP、另一張昏厥並進 Break，對手全體各受 1 傷害；負向驗證紅色 HP 不足時不提供 Activate，並核對公開 command trace。候選仍 `inventory`，正式牌組／formal battle／online／promote 仍待；外部官方圖資未載入 `naturalWidth`，保留命名 fallback。

- **BS11-088／088@1／105 attack Then localhost Browser 輕度驗收（2026-09-23）**：新增 inventory-only continuation fixture 與 1 檔／5 項 route／條件回歸；本地 Playwright 在 1280×720／1164×777 對三筆記錄各完成 positive／negative，共 12 條路徑，實際由已支付普通攻擊後進入 `resolve-attack-effect`，正向目標 HP 6→5、負向維持 6，088@1 以 base card id 取得 contract trace；官方圖資受本機網路限制時保留命名 fallback。這仍不等同完整支付、正式牌組、formal battle 或 online 驗收。

- **BS11-111～113 Special Play／On Play localhost Browser 輕度驗收（2026-09-23）**：新增 inventory-only fixture 與 1 檔／20 項 route／條件回歸；本地 Playwright 對 111／111@1／112／112@1／113／113@1 在 1280×720／1164×777 各完成 positive／negative，共 24 條路徑，實際完成共同黑色 LV.1 Special Play 代價、111 棄牌後 1 傷害、112 棄牌區黑色 Cookie 回收、113 抽 2 張與負向門檻阻擋，並核對 `deploy-cookie`／`begin-activate-skill`／效果結算 trace；官方圖資受本機網路限制時保留 fallback。這仍不等同正式牌組、formal battle 或 online 驗收。
- **BS11-114／114@1 On Play localhost Browser 輕度驗收（2026-09-23）**：新增 inventory-only fixture 與 1 檔／6 項 route／條件回歸；本地 Playwright 對兩筆記錄在 1280×720／1164×777 各完成 positive／negative，共 8 條路徑，正向實際部署後支付 1 張黑色手牌並抽 2 張，負向以棄牌後手牌超過 5 張留下 `skip-on-play` 且不抽牌，核對官方圖 URL／alt 或命名 fallback 與公開 trace。攻擊 Then 仍未進入 Browser；這仍不等同正式牌組、formal battle 或 online 驗收。

- **BS11-089／089@1／089@2 On Play localhost Browser 輕度驗收（2026-09-23）**：新增 inventory-only fixture 與 1 檔／6 項 route／條件回歸；本地 Playwright 對三筆記錄在 1280×720／1164×777 各完成 positive／negative，共 12 條路徑，正向實際確認牌庫頂 3 張送 trash、抽 2 張、棄 1 張及 Refresh 後來源 HP 4→5，負向完成抽棄但不開啟第二段補 HP、來源維持 4，並核對官方圖 URL／alt 或命名 fallback 與公開 trace。這仍不等同正式牌組、formal battle 或 online 驗收。

- **BS11-084～087 localhost Browser 輕度驗收（2026-09-23）**：Luna 完成 inventory-only route／fixture 與 1 檔／6 項回歸；Astra 以本地 Playwright 對 084、085／085@1、086／086@1、087／087@1 在 1280×720／1164×777 各完成 positive／negative，共 28 條路徑。正向實際完成 Trap 紫色付款／目標、Refresh 後抽 1、085 來源自我送 trash、086 指定 Dark Cacao 從 trash 登場及 +2 HP、087 Ancient 條件隨機棄手；負向驗證 Refresh／支付／命名候選／Ancient 條件不成立。官方圖資受本機網路限制時保留命名 fallback，未宣稱 `naturalWidth` 載入；這仍不等同正式牌組、formal battle 或 online 驗收。

- **BS11-097～099 localhost Browser 輕度驗收（2026-09-23）**：新增 inventory-only fixture 與 1 檔／6 項 fixture 回歸；本地 Playwright 在 1280×720／1164×777 對三張卡各完成 positive／negative，共 12 條路徑，實際走過 097 黑色支付／棄牌／LV.1 無 Skill 昏厥、098 黑色支付／1 傷害、099 source-only 自我送 trash，確認官方卡圖與 `begin-activate-skill`／`resolve-ability-effect` trace；負向均因缺少 Special Play Cookie 門檻阻擋。這仍不等同正式牌組、formal battle 或 online 驗收。
- **BS11-103／104／109 localhost Browser 輕度驗收（2026-09-23）**：新增 inventory-only fixture 與 1 檔／6 項 fixture 回歸；本地 Playwright 在 1280×720／1164×777 對三張卡各完成 positive／negative，共 12 條路徑，實際走過 103 登場／手牌至多 5 張／Special Play 回收、104 昏厥後檢視 3 張選黑色、109 黑色支付後檢視 5 張選 Special Play，負向分別以手牌門檻、無黑色候選、無 Special Play 候選驗證 no-op／阻擋，trace 為 `deploy-cookie`／`begin-activate-skill` 或 `skip-on-play`、`resolve-faint-effect`／`resolve-inspect-deck`、`begin-play-item`／`resolve-ability-effect`／`resolve-inspect-deck`。DOM 核對官方圖 URL／alt；外部圖資 `naturalWidth` 受本機網路限制。這仍不等同正式牌組、formal battle 或 online 驗收。
- **BS11-090／091 localhost Browser 輕度驗收（2026-09-23）**：新增 inventory-only fixture 與 1 檔／2 項回歸；本地 Playwright 在 1280×720／1164×777 各完成正／負路徑，正向實際走過 White Lily Activate、自我昏厥、選擇 Avatar of Destiny、登場後 8 張 HP 與公開 `begin-activate-skill`／`resolve-ability-effect`／`resolve-extra-deck-attack` trace，負向以非主要階段阻擋 Activate。這仍不等同正式牌組、formal battle 或 online 驗收。
- **BS11 前四十三批候選**：官方英文資料已隔離至 `data/candidates/`，候選 159 筆／116 個基礎卡號／43 個變體，BS11-001～015、017～047、048～102、103～116（含 010／014／015／017／018／036／048～053／063／067／068／071／082／085～092／097～099／111～116 異圖）已完成靜態 exact adapter／核心回歸；BS11-093／096／100／101 另已完成官方卡圖、exact FLIP adapter 與攻擊後 FLIP 正／負 runtime 輕度驗收；BS11-095／102 另已完成官方卡圖、095 exact FLIP 與 102 vanilla conversion contract／runtime 輕度驗收；BS11-047 另已完成官方卡圖、exact item／replacement adapter 與正／負 runtime 輕度驗收，並新增 inventory-only localhost `card-skill`／`card-skill-negative` 正／負操作證據；BS11-103／104／109 與 BS11-106／107／110 另已完成官方卡圖、exact adapter、shared UI／AI／decision path 與兩尺寸正／負 Browser 輕度驗收，BS11-088／088@1／105 已完成官方卡圖、attack Then exact adapter 與兩尺寸正／負 continuation Browser 輕度驗收；BS11-111／111@1／112／112@1／113／113@1／114／114@1／115／115@1／115@2／115@3 已完成官方卡圖、shared Special Play／On Play adapter 與兩尺寸正／負 Browser 輕度驗收；BS11-089／089@1／089@2 已完成官方卡圖、On Play exact adapter 與兩尺寸正／負 Browser 輕度驗收；BS11-094 已完成官方卡圖、Blocker exact adapter 與黑色／錯色付款正／負 runtime 輕度驗收；BS11-108（base／@1）已完成官方卡圖、Stage exact adapter 與 Special Play 回合條件、抽 1／棄 1 正／負 runtime 輕度驗收；BS11-092 已完成官方卡圖、Skill exact adapter、有效 LV. 覆寫與回合清除正／負 runtime 輕度驗收。BS11-016 的跨 Cookie 總計 HP 代價與 BS11-062 卡圖 URL 404 仍保留，BS11-115 的多張 Special Play 與 BS11-116 的 Awaken 已接入，並完成 BS11-090／091、097～099、103／104／109、106／107／110、111～114（含 @1）、115（含 @1～@3）／116、089（含 @1～@2）localhost test-state 正負路徑輕度 Browser 驗收。strict 已更新為 157／2／0，主效果 92／23／1、能力 92／1、攻擊 Then 27／27；第二十九批原有 2 檔／5 項並新增 1 檔／5 項 Browser fixture、第三十批 3 檔／12 項、第三十一批 2 檔／7 項、第三十二批 2 檔／4 項、第三十三批 2 檔／4 項、第三十四批 2 檔／4 項、第三十五批 2 檔／14 項、第三十六批 2 檔／4 項、第三十七批 2 檔／4 項，另有第二十四批 3 檔／16 項、第三十九批 1 檔／5 項、第四十批 1 檔／20 項、第四十一批 1 檔／6 項、第四十二批 1 檔／8 項與第四十三批 1 檔／6 項 focused contract／runtime／fixture，第二十九～三十一批各有 12 條、第四十批另有 24 條、第四十一批另有 8 條、第四十二批另有 16 條、第四十三批另有 12 條 Browser 路徑，完整 Vitest 432 檔／5,497 項（548.31 秒）全數通過；正式牌組／online／promote 仍待，BS11-047／088／089／092／093／094／095／096／100／101／102／103／104／105／106／107／108／109／111／112／113／114／115 與 BS11-116 的正式／online Browser 驗收仍未完成，詳細範圍見 [BS11 進度](docs/bs11-progress-2026-09-22.md)。

- BS9-035／041／050：最終完整 Vitest 333 檔／4,866 項、相關回歸 5 檔／22 項、build、修改檔 lint 與桌機／平板手動正反操作通過；屬 localhost 場景驗證，完整證據見 [報告](docs/bs9-progress-2026-09-10.md#2026-09-15-手動驗證場景修復)。

- 攻擊付款預覽遮擋：相關 2 檔／15 項、build、修改檔 lint 通過；詳見 [修復驗證](docs/ui-ux-redesign-plan.md#2026-09-15-攻擊付款預覽遮擋修復)。

- **2026-09-15 UI／UX**：完整 Vitest 332 檔／4,859 項、最後受影響回歸 3 檔／33 項、build、修改檔 lint、AI Browser、三尺寸組牌與好友房核心通過。有攻擊好友房完整對局 99 次操作／11 次攻擊、雙方結果一致；另有 149 次命令的 Refresh 決勝路徑。全域 lint 仍有 4 個無關既有錯誤；逐卡 FLIP 矩陣及真機觸控未驗收。來源及重跑邊界見 [本批報告](docs/ui-ux-redesign-plan.md#2026-09-15-正式流程盤點與深藍介面精修)。

- 技能提示框已加入候選卡文展開、選取／取消狀態及付款前提示；隱藏手牌維持匿名且不提供卡文。

BS10 已正式完成本批驗收並 promote：`data/cards/` 現有 164 筆（123 個基礎卡號、41 筆變體），`check:card-pool`、`validate:cards` 與 strict contract 164／164 verified 通過；BS10 盤點為主效果 98 supported／25 no-effect-text／0 unsupported、能力 98 converted／0 pending、攻擊 Then 23／23。非 EXTRA 逐卡 Browser 雙尺寸正向 135／135、負向 151／151；BS10-008 另有獨立 FLIP 矩陣 16／16，12 張 EXTRA 各在 1280×720 與 1164×777 完成正負 12／12，含 024／073 官方卡圖核對。正式牌組四尺寸、online modal 兩尺寸與雙瀏覽器好友房完整流程通過；完整線上對局完成 108 個命令／14 次付款攻擊，雙端勝負一致，完成房間斷線後終局結果保留。BS10-088 另已補上先檢視正式牌面、頂／底選擇與後續抽牌 Browser 證據。完整 Vitest 348 檔／5,022 項全數通過、build 通過；全域 lint 四個既有錯誤另列。[驗證與範圍](docs/bs10-progress-2026-09-14.md)。

2026-09-14 **對戰桌視覺整理**：正式本機／線上共用低對比深藍桌墊、細邊框與縮小區域標籤，主要回合操作改為金色；桌機手牌保留獨立區域，選牌抬升不遮支援，支援張數留在區域內。卡牌快速預覽加寬至 320–380px，卡圖最大 300px、卡名 18px、效果文字 14px。提交前完整 Vitest 327 檔／4,802 項與 build 通過，全域 lint 仍有 4 個無關既有錯誤。驗證與缺圖限制見 [對戰桌整理](docs/ui-ux-redesign-plan.md#對戰桌視覺整理2026-09-14)。

2026-09-14 **全流程對戰動畫**：AI／線上共用指令呈現事件、卡牌移動與支援／攻擊軌跡、HP／FLIP、昏厥與勝負，提供標準／快速／減少動畫及略過；先後攻確認前不顯示手牌，確認後逐張發牌，發完再開啟調度；開局面板採四步進度、手勢選項與深色手牌展示；暫停面板及工具選單統一深色風格，支援鍵盤操作與收合問題回報。主選單更新為左右雙欄對戰大廳，整合牌組／AI 設定、金色對戰入口與牌背載入替代。完整 Vitest 327 檔／4,802 項、AI Browser 及桌機／平板主選單操作通過；全域 lint 仍有無關未追蹤檔的 4 個錯誤。動畫不改變規則，事件卡面與私密 ID 依觀看者遮罩。驗證範圍與環境限制見 [全流程動畫](docs/ui-ux-redesign-plan.md#2026-09-14-全流程動畫)。

- 2026-09-14 **0.10.0 正式 UI 流程**：`MainMenuMasterDuel` 是唯一正式主選單；「管理牌組」已連到 Master Duel 風格「我的牌組」，並可返回主選單或進入既有 `deck-editor`。已驗證建立／返回流程、`/?mockup=my-decks` 保留 mockup、disclaimer 文案，以及正式主選單的雙欄大廳樣式。

- 2026-09-14 **BS9 五色牌組、同色 EXTRA 與 Lv.5 1024 人賽事重驗**：紅／黃／綠／藍／紫各有 60 張 BS9 主牌，並分別配置 BS9-010／030／055／088／102 ×4 的同色 EXTRA Deck；1024 名參賽者依 205／205／205／205／204 分色生成，正式 `GameState.players[].extraDeck`、合法 EXTRA 攻擊、AI 決策與賽事報告均已接通。修正後 10 輪 Swiss 使用 500 步硬上限，完成 **5,084／5,120**，36 場卡住／超限而標記 FAIL；冠軍／四強為藍色 `#005`、`#183`、`#040`、`#201`，八強另含 `#107`、紫色 `#156`、`#111`、`#166`。公開資訊訓練 profile 僅收錄 5,084 場完成決勝資料；32 副×2 輪 holdout 以兩種策略座位交叉對戰，共 **64 場、訓練策略 35 勝／baseline 29 勝／0 失敗**。完整產物見 [roster](data/decks/bs9-lv5-1024-roster.json)、[賽事報告](data/decks/bs9-lv5-1024-report.json)、[報告 Markdown](docs/bs9-lv5-1024-report.md)、[Lv.5 經驗 profile](data/ai/bs9-lv5-experience.json)。

- 2026-09-14 **BS9-022／BS9-023 正向 fixture 公開 HP**：card-check fixture 將對手持有且位於己方 Cookie HP 的卡以正面朝上標記，並以 `player-one`／`player-two` 遮罩視角回歸驗證；專用測試 **10／10** 通過。這仍是 localhost `test-state` 證據，不代表正式牌組／雙瀏覽器逐卡驗收。

- 2026-09-14 **BS9-031／BS9-032 正向 FLIP 入口**：兩張 card-check fixture 均由正式 BS9-030 Shadow Milk Cookie 的 EXTRA 登場、On Play、三黃攻擊及攻擊後代價觸發 detached FLIP；Alchemist 只列 BS9-030 為 LV.3 目標並完成 6→7 HP、棄 1 與抽 0／1，Yoga 完成抽 0／1 後只列 BS9-030 為己方目標並可選 0 設 active。`src/game/bs9-031.test.ts` 6 項、`src/game/bs9-032.test.ts` 5 項通過；Chrome host 已實際走完正向 FLIP UI，終端 12／4 lanes 則在官方圖片 `naturalWidth` gate 受環境限制，未宣稱 Browser 全綠。負向仍保留 P-018 HP FLIP 的 opponent-turn Then 邊界。此仍是 `test-state` 局部證據，不代表正式雙瀏覽器逐卡線上驗收。

- 2026-09-13 **BS9-025／`@1` 採用語義與 promotion**：依使用者確認採用「FLIP 進 Trash、棄 1 張手牌、原附著 Cookie +1 HP；持有者自己的回合可改選另一隻己方 Cookie，FLIP 卡不轉移」的專案規則。兩筆 exact adapter／runtime／UI／contract 均已完成；strict **185／185 verified、0／0／0**，專用 Browser（U/P × 1907×863／1164×777 × 正／負）**8／8** 通過。`promote:candidate` 已成功移入正式 `data/cards/`，`validate:cards` 17 檔／1,600 種卡號／1,574 張成功轉換；目前完整 Vitest **322 檔／4,780 項**、build 通過；正式 registry 已納入 BS9，本次變更尚未 push。終端整批影像 gate 仍受外部網路限制，Chrome host 已驗證兩張 exact 圖檔載入。

- 2026-09-13 BS9-071～118 runtime hardening：在既有 BS9-017 驗證之上，補上抽牌耗盡後 Refresh continuation、Shadow Milk discard provenance、陷阱 HP 目標／Then 與牌庫檢視／移牌回歸；新增 runtime／UI／online 回歸，並修正好友房 Browser 腳本對已移除 `command-log-filters` selector 的等待。`test:online:browser` 桌機／280px **2／2**、`test:online:match:browser` 開房／同步／攻擊預覽／支付／拒絕／斷線情境通過；完整 Vitest 最新為 **319 檔／4,757 tests** 通過，build／server typecheck 通過。新版 071～118 嚴格 Browser 矩陣為 **352／352**（1907×863／1164×777），含 210 條 command trace、152 條 substantive settlement、**352 條官方影像載入**與 176 條負向證據；全域 lint 仍有既有未追蹤檔的 4 個錯誤，候選 test-state 與共用線上 gate 不代表正式牌組／雙瀏覽器逐卡驗收。

- 2026-09-13 BS9 全候選報告聚合（採用前歷史快照）：依卡號核對現存 18 份可聚合 Browser 報告，185／185 筆候選均有正／負路徑，合計 **852／852 lanes 通過**；精確官方影像 **848／852**，4 條 BS9-018 負向為隱藏對手手牌而明確不適用。採用語義後 BS9-025／`@1` 另完成專用雙尺寸正／負 8／8，strict 已更新為 **185／185 verified、0 needs-review、0 blocked**；這些仍是候選 localhost／test-state 證據，不代表正式牌組、多人或線上逐卡完成。
- 上述全候選交叉證據是採用前快照；`node scripts/audit-bs9-candidate-evidence.mjs` 的完整重跑需在可載入官方影像的環境進行。採用後的最新可核對項目為 strict 185／185、候選轉換 174 `GameCard`＋11 `ExtraDeckCard`，以及 BS9-025 專用 Browser 8／8；終端整批報告目前受官方影像網路限制，不將失敗檔案宣稱為全綠。
- BS9-025／`@1` 的 ledger 回歸現採用「棄 1 張手牌、原附著 Cookie +1 HP、持有者自己的回合可改選另一隻己方 Cookie，FLIP 卡不轉移」語義：`src/game/bs9-024-029.test.ts` 與 ledger 42／42 通過，兩筆已解除 strict needs-review 並標為 verified；官方原始資料未補足選定後動作的事實仍保留於來源紀錄。

- 2026-09-13 BS9-051～070 strict Browser 重跑：修正 BS9-062 必須棄 2 張支援卡的負向夾具，避免未宣告攻擊卻出現不可結算的 attack-effect pending；雙尺寸正／負 **140／140** 通過，含 140／140 exact 官方影像載入、140／140 pending 清空、70／70 負向 evidence、94 條 command trace 與 140／140 public state。完整 Vitest 319 檔／4,757 tests 維持通過；候選仍為 inventory，未 promote。

- 2026-09-12～13 BS9-018：Hero Cookie 的 Your Turn 對手傷害防止改以來源玩家、目標所有權與 Hero 是否仍在戰鬥區判定，攻擊／效果傷害逐段在實際傷害點重驗。正式 P-018 Mustard Cookie 來源與 Hero／Pomegranate 兩目標的正／負 Browser A/B 先以 effect-damage 完成 4／4；再以 Hero／Pomegranate 實際攻擊 BS1-007／BS8-007 翻出 BS1-002 Kumiho，兩尺寸與兩目標共 8／8 完成棄牌、效果目標、Hero 防止／Pomegranate 受擊及原攻擊續接；正向四條路徑並通過 Hero 候選 `imageUrl` exact request／render／load，負向四條明確標示來源在對手隱藏手牌。`src/game/bs9-018.test.ts` 9 項通過；候選 test-state 仍不代表正式牌組／雙瀏覽器逐卡驗收。

- 2026-09-11 BS9-010：匿名對手手牌位置、正面 HP 最下方、Then 支援區 1 任意能量、0 目標／略過及 EXTRA 負向提示已修正；1907×863／1164×777 共 10／10 Browser 通過，實際 HP 4→5→6、對手 6→4→3，卡圖及公開紀錄皆驗證。規則／UI／RoomStore、完整 Vitest、build、scoped lint 與一般好友房驗證的最新結果及限制詳見 [BS9-010 修復驗證](docs/bs9-progress-2026-09-10.md#bs9-010-修復驗證)。候選仍未 promote。
- 2026-09-14 BS9-031：正向改由正式 BS9-030 Shadow Milk Cookie 的 EXTRA／On Play／三黃攻擊／攻擊後代價，透過 detached FLIP 發動 Alchemist；只列 BS9-030 為合法 LV.3 目標，完成 6→7 HP、棄 1 與抽 0／1。`src/game/bs9-031.test.ts` 6 項通過；Chrome host 正向 UI 已走完，終端 12 lanes 在官方圖片 `naturalWidth` gate 受環境限制，未宣稱 Browser 通過。負向仍保留 P-018 HP FLIP 的 opponent-turn Then 邊界。

- 2026-09-11 BS9-041：三筆官方 Pistachio Cookie FLIP 均保留抽 0／1、持有者自己回合 Then 與對手 0～1 Cookie 受 1 傷害；正向控制 fixture 實際完成 FLIP、目標傷害與 BS9-018 原攻擊續接，負向自然攻擊只抽牌。`src/game/bs9-041.test.ts` 4 項、三筆記錄在 1907×863／1164×777 Browser 12／12 通過；候選 test-state 仍不代表自然攻擊可在防守方回合發動或正式牌組／雙瀏覽器逐卡驗收。

- 2026-09-12～13 BS9-021：`transfer-hp` exact adapter 補上跨所有權 donor／receiver 目標邊界、最下方放置與正面朝上；本機／線上陷阱 UI 共用最多 1 張 donor 上限，AI 可解析 receiver。規則／受影響回歸及 1907×863／1164×777 正／負 Browser 共 4／4 通過，四條路徑均完成候選 `imageUrl` exact request／render／load；候選 test-state 不代表正式牌組／雙瀏覽器逐卡驗收。

- 2026-09-14 BS9-032：正向改由正式 BS9-030 Shadow Milk Cookie 的攻擊後代價，透過 detached FLIP 發動 Yoga；完成抽 0／1，Then 只列 BS9-030 為己方目標並可選 0 設 active。`src/game/bs9-032.test.ts` 5 項通過；Chrome host 正向 UI 已走完，終端 4 lanes 在官方圖片 `naturalWidth` gate 受環境限制，未宣稱 Browser 通過。負向仍保留 P-018 HP FLIP 的 opponent-turn Then 邊界；候選 test-state 不代表正式雙瀏覽器逐卡驗收。

- 2026-09-12 BS9-033：Activate／Once Per Turn 先支付 1 黃色並棄唯一具有 runtime FLIP 的手牌，再以支付後手牌判定 6 張門檻與抽 0～2。7→6 正向、無 FLIP 負向及抽 0／2在雙尺寸 Browser 共 4／4 通過；基本版／`@1` strict 2／2 verified，候選 test-state 不代表正式牌組／雙瀏覽器逐卡驗收。

- 2026-09-12 BS9-034～038：完成 7 筆卡圖／卡文核對、五張基礎卡 exact runtime、支付／代價／條件／固定目標 UI 與公開結算 trace；桌機／平板正負及 BS9-035 雙時機共 36／36 Browser 通過。後續批次更新後全候選為主效果 73 supported、44 no-effect、1 待轉接，一般攻擊 Then 16／16，strict 183 verified／2 needs-review／0 blocked；候選仍不進正式牌組。

- 2026-09-12 BS9-039～040、BS9-042～045：卡圖／卡文已核對；完成揭示 FLIP 條件、裝備 Soul Jam→公開 HP、黃色 FLIP 回收與 FLIP Cookie 陷阱代價。雙尺寸 Browser A/B 為 8／8 加 16／16，BS9-042～045 strict 各 1／1 verified；目前全候選為主效果 73 supported、44 no-effect、1 待轉接，strict 183 verified／2 needs-review／0 blocked。候選仍不進正式牌組。

- 2026-09-12 BS9-046～049：雙尺寸 Browser A/B 24／24 完成陷阱的攻擊修正→FLIP 回收、場景放置／橫置來源＋棄牌的 Activate、兩筆 Matcha Cookie FLIP 與兩筆 Fig Cookie 昏厥目標。strict 為 1＋1＋2＋2 筆 verified；目前全候選為主效果 73 supported、44 no-effect、1 待轉接，strict 183 verified／2 needs-review／0 blocked。候選仍不進正式牌組。
- 2026-09-12 BS9-050：Wind Archer Cookie 的 Crow Storm 支援區棄牌累計條件／Once Per Turn 與 Arrow of Darkness 的 2 張支援代價、所有對手 Cookie sequential 傷害完成；基本版／`@1` 雙尺寸技能／攻擊正負 Browser 16／16、strict 2／2 verified。全候選 analyzer 為主效果 73 supported、44 no-effect、1 待轉接，一般卡攻擊 Then 16／16，strict 183 verified／2 needs-review／0 blocked；候選仍不進正式牌組。
- 2026-09-12～13 BS9-051～070：28 筆官方實體卡圖各自建立候選契約並完成 exact adapter、規則／UI／trace；修正 BS9-062 負向夾具後，FLIP、Skill、Extra、Attack、Item、Faint、Trap、Stage 正／負雙尺寸 Browser **140／140** 通過，含 exact image／pending／negative evidence／public state 閘門；strict contract 28／28 verified，候選仍維持 inventory。BS9-051～070 正式 registry 為 0，未 promote。
- 2026-09-12～13 BS9-071～118：76 筆官方實體卡圖（含異圖）各自建立候選契約並完成 exact adapter、規則／UI／trace；原版 372／372 僅保留為歷史 smoke。新版嚴格雙尺寸正／負 Browser 為 **352／352 全數通過**，含 exact variant、官方卡圖、正／負 UI、substantive trace 與無殘留 pending；全檔 strict 183／2／0，候選 validator 185 筆 inventory、converted=0；正式 registry 為 0，未 promote。這些仍是候選／localhost 證據，不代表正式牌組、多人或線上逐卡完成。

BS9 正式卡池總結（2026-09-13）：原 185 筆候選記錄（BS9-001～118，含異圖）均已建立卡圖／契約資料；採用前分批 **852／852 lanes 通過**、exact image loaded **848／852**（4 條 BS9-018 負向隱藏手牌明確不適用）保留為歷史快照。採用 BS9-025 語義後，adapter 交叉檢查 174 筆 `GameCard`／11 筆 `ExtraDeckCard` 均可轉換，主效果 74 supported、44 no-effect、0 pending，strict **185 verified／0 needs-review／0 blocked**；BS9-025／`@1` 專用 Browser 8／8。已依授權正式 promotion，BS9 檔案現位於 `data/cards/`，正式 registry 已納入 BS9。

BS9 目前已納入正式卡池：主效果 74 張已轉接、44 張無主效果文字、0 張待轉接；額外能力 74 張已轉接、44 張不適用、0 張待轉接；一般卡攻擊 Then 16／16、strict 185 verified／0 needs-review／0 blocked。BS9-001～118 已完成 adapter／規則局部驗證，BS9-051～070 嚴格 Browser 140／140、BS9-071～118 嚴格 Browser 352／352，BS9-025／`@1` 專用 Browser 8／8；正式 registry 已納入 BS9（17 個正式 JSON、1,600 種卡號）。上述 Browser 數字仍是分層驗證證據，不代表完整多人或線上逐卡完成。

- 卡牌稽核 Skill 已補上 [實體卡圖與獨立驗收方法](.agents/skills/braverse-card-import-audit/references/physical-card-verification.md)，並串接工作流、官方轉接與逐卡矩陣入口；這是驗證流程更新，尚未量測跨模型正確率提升。

- 工程工作流已完成規則／Skill 結構與引用檢查，以及四個新舊隔離案例；新版桌面任務已確認載入規則與子代理上限。案例保留失敗到通過證據，並如實揭露缺少外部素材的整合阻塞。用量對照有升有降，尚未證明穩定節省額度。
- 2026-09-08 工作流提交前檢查：目前含既有未提交遊戲修改的工作樹通過完整 Vitest 292 檔／4,513 項及 build；BS8-074 Browser 4／4、BS8-076 Browser 12／12、BS8-059 Browser 18／18 均在 1907×863／1164×777 通過。全域 lint 仍有 `.tmp-probe-deploy.ts` 與 `scripts/diagnose-lv5-conservatism.ts` 共 3 項既有 unused 錯誤。

- 2026-09-07：完成125張文字／runtime複核與雙尺寸局部操作稽查，171筆實圖／詳情各尺寸全部通過；正式15筆EXTRA已開放Standard／Open編輯器、JSON往返、本機及標準好友房。最新全套292檔／4,498項測試、build、scoped lint、AI種子1–20通過；全域lint仍有既有診斷檔3項unused錯誤。桌機／平板已從真實首頁匯入儲存，正常開局後069由不符條件到可登場，好友房雙方6張EXTRA真圖／私密遮罩也通過。詳見[本輪報告](docs/bs8-desktop-tablet-audit-2026-09-07.md)與[正式EXTRA方案及驗證](docs/bs8-formal-extra-plan-2026-09-07.md)，未宣稱125張全效果完整線上對局通過。

- 2026-09-08：BS8-053 `card:`／`card-negative:` fixture 分別建立唯一疲勞綠色支援卡與全活躍支援卡；新增 demo／UI 文案回歸，相關 319 項測試、build、scoped lint 及 Chrome Browser 正向選取／負向零目標 A/B 通過。負向效果與紀錄均顯示「未選擇疲勞支援卡，效果未生效」，未宣稱正式多人或線上逐卡完成。
- 2026-09-08：BS8-074 `card:`／`card-negative:` fixture 分別建立支援區差距 2 的免費陷阱與差距 1 的印刷 `{G}` 支付；新增規則回歸及 1907×863／1164×777 Chrome Browser 正／負 A/B，確認目標、付款、橫置與攻擊力修正。
- 2026-09-08：BS8-078 fixture 改用正式 Kumiho Cookie；效果面板補上 `hand-to-battle` 目標選擇與可選 0 張回歸，Chrome Browser 實際選取後確認戰鬥區顯示 5 張 HP 卡；完整 Vitest 292 檔／4,510 項、build、scoped lint 通過，未宣稱正式多人／線上逐卡完成。
- 2026-09-08：BS8-079 `card:`／`card-negative:` fixture 改用正式 White Ghost Cookie（LV.1）與 Frost Queen Cookie（LV.3）；新增唯一合法目標、支付 2 張藍色手牌、放回牌庫及下一個 Active Phase 維持 rested 的回歸，Chrome Browser 正／負路徑與完整 Vitest 292 檔／4,511 項、build、scoped lint 通過，未宣稱正式多人／線上逐卡完成。
- 2026-09-08：BS8-083 `card:` fixture 讓 Frost Queen Cookie 保持在手牌並完成登場支付／任一正式目標；`card-attack:` 另驗證攻擊支付 3 張藍色支援卡及 Then 抽至手牌 3 張，Chrome Browser 正／負路徑與完整 Vitest 292 檔／4,512 項、build、scoped lint 通過，未宣稱正式多人／線上逐卡完成。
- 2026-09-08：BS8-085 `card:`／`card-negative:` fixture 改用正式 White Ghost Cookie（剩 1 HP）與 Sherbet Cookie（高 HP反例）；新增棄 2 張手牌、只列出 1 HP 合法目標及無合法目標不昏厥的規則回歸，Chrome Browser 正／負路徑與完整 Vitest 292 檔／4,513 項、build、scoped lint 通過，未宣稱正式多人／線上逐卡完成。
- 2026-09-09：BS8-095 `card:`／`card-negative:` fixture 補上正式 Herb Cookie 的棄 1 張手牌代價與己方 HP 目標；BS8-098 翻譯可選藍色支付的 Then，並建立手牌 2 張或更少／條件不成立的陷阱後續 A/B fixture；BS8-100 `card:`／`card-negative:` fixture 改用正式藍色與綠色卡牌，驗證只可選藍色手牌、等量抽牌與休息支援卡阻擋；BS8-119 串接正式 Crunchy Chip Cookie 與 BS8-103 Dark Cacao Cookie，透過 Browser 實際驗證支付後來源進棄牌、棄牌區登場與 Dark Cacao OnPlay。完整 Vitest 293 檔／4,538 項、build、scoped lint 及 Chrome Browser 正／負路徑通過，未宣稱正式多人／線上逐卡完成。
- 2026-09-09：BattleRow 與卡牌詳情共用 Awakened 的 `awakenedUnderlay`，BS8-027／BS8-104 均顯示覺醒前真實卡圖、卡名、卡號及可點擊詳情；正向 Awaken、負向登場封鎖與新 Chrome 頁面零警告通過。完整 Vitest 293 檔／4,542 項、build、修改檔 scoped lint 通過；全域 lint 仍只有既有未追蹤診斷檔的 3 個 unused 錯誤，正式多人／線上逐卡驗收未宣稱。
- 2026-09-10：BS8-107 `card:`／`card-negative:` fixture 改用四張正式 BS8 手牌，保留紫色 Item 合法候選與錯色／錯類型反例；Chrome 實際驗證代價、目標、HP 棄置及缺少紫色 Item 的阻擋，局部 test-state 不等同正式多人／線上逐卡完成。另完成 BS9-010～023 候選第二批 8 項規則／adapter 回歸與 80／80（1907×863／1164×777）Browser 正／負路徑，並將 BS9-001～023 fixture 統一改用官方實體卡牌記錄；正式牌組／多人／線上逐卡 gate 仍待。
- 2026-09-10：BS8-111／113／114／117 負向 fixture 分別驗證棄 1 手牌與 15／30／15 張棄牌門檻；連同 BS8-107 在桌機／平板共 10 個 strict ability A/B 報告通過。另完成 BS9-001～009 第一批 adapter／規則／文案回歸與 68／68 候選 Browser 正／負路徑（1907×863／1164×777）。完整 Vitest、build、scoped lint 與全域 lint 結果及正式牌組／多人／線上逐卡邊界見 BS9 進度報告。
- 2026-09-11：BS8-121／122／125 fixture 改用正式卡圖與卡名建立正／負 A/B：BS8-121 驗證紫色 Item 磨牌條件，BS8-122 驗證紫色非 Cookie 手牌代價與抽最多 2 張，BS8-125 驗證正式 Stage／Dark Cacao／支付及 15 張棄牌門檻。相關 4 檔／355 項 targeted tests、完整 Vitest 298 檔／4,586 項、build、修改檔 scoped lint 與 Chrome Browser 路徑通過；全域 lint 仍受既有未追蹤探針的 3 項錯誤阻擋，局部 `test-state` 不等同正式牌組／多人／線上逐卡完成。

- BS8-020／021：補明確HP條件提示、修復RR傷害後漏收額外R即裝備；Then待結算時本機／線上均禁止推進階段，道具提示不再誤標技能。020共12條、021共36條桌面／手機Browser通過；本批全套282檔4,328項、build、scoped lint與AI20場通過；專卡完整多人仍未測。
- BS8-018／019追加修復：來源代價失效仍傷害／回收、未棄手牌仍回收已修正；24項專卡回歸、兩卡共32條桌面／手機昏厥與攻擊路徑通過。另補001／008／012／013／015／016共36條普通攻擊路徑。全套4,304項、build、scoped lint與AI20場通過；逐卡完整對局仍未測。稽查工具現在拒絕指定卡號未實際納入的空跑。
- BS8-022：修復必要昏厥代價被當成直接棄牌及付款前先選回收目標的錯序。11項規則與本機／線上hook回歸、1164／390共8條Browser通過，含回收剛付出的紅色LV.1 HP卡、選0仍付款、付款前取消與缺代價阻擋；另核對IAB實圖。僅demo，尚未證明正式狀態已修改，專卡完整線上Browser未測。
- BS8-023／024／025：已驗證023的HP≥2門檻、修正024異圖卡文與R配置／RR啟動、修正025必要昏厥代價。專卡規則共19項、1164／390共18條Browser通過，024另有兩圖generic正向驗證；023／024已補跨雙方自選結算順序、所有合法目標選齊與原攻擊目標續接，兩者12條Browser已重跑；專卡完整對局／線上Browser及Refresh續接未完成。
- UI/UX／BS8 全面稽核修復批次：040修正後最新Vitest為289檔／4,386項，其中4,385通過、1項候選卡工具寫入generated-card-pool.ts回報UNKNOWN失敗；不得視為全綠。039批次同項失敗後單獨重跑候選工具30項通過，間歇寫入根因仍待查。build與修改檔scoped lint通過。黃色續查至047：038／039共42條局部Browser路徑，040／041依最新範圍完成桌機／平板26條，修正空登場候選缺少指引與強制棄牌來源Unknown。040相關4檔59項及041專卡6項通過。042–045另完成62條桌機／平板操作，含下次活躍限制、限定補HP、Blocker與強制離場；045修正來源限定與休息區提示，相關3檔69項、build及scoped lint通過，另042／043／044共32項規則回歸通過。046另通過11項及14條桌機／平板操作；047修正Then未執行卻顯示完成，修正後8條操作與相關3檔80項通過，build與scoped lint通過。045及047各新增1項文案測試，未重跑全套，前述4,386項為040批次歷史全套結果。AI與好友房共用回歸沿用031批次，未宣稱重跑；全域lint仍有診斷檔3項既有unused錯誤，專卡完整對局／線上及部分Refresh Browser仍待；詳見稽核報告。
- BS8 黃色048–050與綠色059本輪完成：048具名Soul Jam回收、049精確剩餘HP1補HP、050逐段HP Then（HP1→3）各有12–17項引擎回歸，兩尺寸正向／負向／選0共26條Browser通過；059修復回手2張支援卡漏掉的綠色限制並補混色拒絕回歸，三變體兩尺寸12條通過。官方卡圖HEAD可載入；專卡完整對局／線上仍待。115／118缺棄牌區條件、111固定磨4張列為待覆核。
- BS8 黃色逐卡重驗：026～050局部Browser A/B與適用選0通過。修正真實移牌代價、覺醒HP、Break登場事件、040強制抽棄及等待、041 FLIP選0/1、042支援候選、043目標前置檢查、045附卡保存、046/049精確有效HP、047展示成本與同牌Then、048指名Soul Jam回收、050批次與逐段HP Then一致。最終258檔／4,135項測試、建置、AI Browser 20/20及雙瀏覽器好友房核心回歸通過，35/35來源契約與卡圖載入通過；全域lint另有兩個原有診斷檔的3項unused變數錯誤，不混入本次修復。
- BS8 綠色逐卡重驗：051～075 的 25 個基礎卡號／34 筆含異圖紀錄已完成。30 筆效果來源以正式 Browser 操作完成，另有 2 張無效果餅乾攻擊、1 張 EXTRA 直接登場 A/B，以及 34/34 實際卡圖解碼通過。BS8-059／065／073／074 各有成立與不成立 A/B；完整 Vitest 為 259 檔／4,142 項、建置與 AI Browser 20/20 通過。全域 lint 僅保留既有 `.tmp-probe-deploy.ts` 與 `scripts/diagnose-lv5-conservatism.ts` 的 3 項未使用變數錯誤。
- BS8 藍色與紫色逐卡初查：076～100（藍色）與 101～125（紫色）共 50 個基礎卡號完成語意核對與逐卡 Browser 流程，含 076 兩變體、083@2 合併卡文正規化、090／104 EXTRA A/B（090 手牌≤2、104 Awaken 由規則 TDD 覆蓋）、103 從棄牌區登場、111 固定磨 4 張、120 五變體、121 磨 0–3 與 125 靜態攻擊費用 modifier。修復 BS8-115／118 漏掉的棄牌區張數條件（115≤5、118≥15）並新增 strict contract 回歸；矩陣 125 列全數更新。完整測試與 build 通過；專卡完整對局／線上未測。

Lv.5「高手對抗」維持實驗 challenger：在 Lv.4 合法 command search 上加入只認同一 plan ID 的通用 `ComboPlan`、跨步生命週期、精確公開條件門檻、規則層合法收益時機、payoff 能量張數／顏色預留、公開資訊對手回應，以及依對手牌庫／手牌張數、棄牌區最低 LV、Break 與最後一隻餅乾 HP 推估的 Refresh 洗傷／空場敗北。最新迭代改以公開餅乾 HP 分布計算補位 Refresh 風險，並只對規則層已列出可支付 payoff 的同回合 setup 給有限機會加分；當我方戰鬥區已有一張餅乾時，Lv.5 預設保留第二張手牌，只有公開確認 Combo、可斬殺、有效 OnPlay 或明確補防才放寬，Lv.4 對照組維持原評分。相同 `PlayerView`、只替換對手隱藏手牌卡面時決策保持一致。全卡池訓練母體包含 1,244 筆正式 inventory，合併異圖後為 967 種唯一 runtime 機制、2,371 筆 capability evidence 與 42,463 條候選 Combo 邊，strict audit 為 `ready`。看過的 calibration seeds 503–504（368 場）為 Combo 3 啟動／3 完成／0 放棄；既有 untouched holdout seeds 601–602 為 368 場、Lv.5 186 勝（50.54%，Wilson 95% CI 45.46%–55.62%），完成率 100% 且安全指標全 0。新迭代 diagnostic seeds 701–702 亦為 368 場、186 勝（50.54%，Wilson 95% CI 45.46%–55.62%），Combo 8 啟動／8 完成／0 放棄、終局預判 3 次且自然 Refresh 0；部署節奏 matched replay seeds 801–802 由 174 勝提升至 181 勝（49.18%）、Combo 4／4 完成；先前 holdout seeds 803–804 為 368 場、180 勝（48.91%，Wilson 95% CI 43.84%–54.01%），最終 holdout seeds 805–806 為 368 場、178 勝（48.37%，Wilson 95% CI 43.31%–53.47%）、Combo 5／5 完成，兩批安全指標全 0，尚未達升格門檻，Lv.4 仍是 champion。Refresh 洗傷與空場邊界由 deterministic corpus 另行覆蓋，701–702、801–806 已看過，不再作為後續 untouched holdout。方法與門檻見 [Lv.5 champion–challenger 契約](docs/ai/lv5-champion-challenger.md)。
本輪再加入公開回應 Min：每個搜尋節點以 `PlayerView` 建立不回應、未知手牌 envelope、對手保留活躍支援的未知支付容量，以及公開 Block／Trap／攻擊回應能力分支；`activeSupportCount` 與 `hiddenHandEnergyCapacity` 只代表公開資源上限，不讀對手隱藏卡面。同時新增防守資源保留評估：手牌有可支付 Trap、戰鬥區有可支付 Blocker，或存在可支付 OnPlay／Stage／Item 能量時，攻擊若耗盡保留線會扣分，保留活躍支援並結束主要階段會獲得 bounded bonus。低收益攻擊在回歸夾具中會讓位給防守準備，公開斬殺與高收益攻擊仍優先；當對手有可攻擊餅乾時，唯一手牌 Trap 放入支援區會被 `trap-retention` 明確扣分，可選效果也不會為低價值擊倒消耗唯一防守 Trap；Break 6–9 另有終局生存評估與 telemetry。Lv.5 仍維持 challenger，尚未以新 holdout 宣稱勝率升格，完整診斷見 [Lv.5 防守保留與終局生存迭代報告](docs/ai/lv5-defense-retention-report-2026-08-26.md)。
2026-08-27 的未見 seed `20260827`（250 場 BS7 Arena）在修正前後皆為 113／250 勝、健康異常皆為 0；這確認公開宣告傷害與同回合擊倒 telemetry 的資料校正沒有改寫既有 R9 選擇。Arena 報表保留整局 `behavior`，另以 `candidateBehavior`／`referenceBehavior` 分開決策歸屬；完整比較與限制見 [Lv.5 公開宣告傷害與 telemetry 校正](docs/ai/lv5-public-damage-telemetry-report-2026-08-27.md)。
2026-08-28 的 BS7 Blue 弱勢診斷發現，`attack-tempo` 雖寫入 reason，卻未計入 Lv.4／Lv.5 search 的實際排序；修正後，同 seed 100 場的 Lv.5 由 39／100 提為 41／100，跳過合法攻擊由 20 次降為 14 次，獨立 seed 為 42／100，兩批健康閘門均通過。剩餘跳過都會實際計入節奏扣分，除非同一候選有明確的正向防守保留理由；相同修正版 Lv.4 control 為 44／100。這是決策一致性修正，不足以讓 Lv.5 升格，完整限制見 [BS7 Blue 攻擊節奏診斷](docs/ai/bs7-blue-attack-tempo-regression-2026-08-28.md)。
主選單「AI 對手」的等級預設現為 Lv.5；玩家仍可在下拉選單切換 Lv.1～Lv.5，benchmark 與測試對局的明確等級設定不受影響。
本輪新增版本化 ASIA 2026-02-13 禁限卡快照，並產生 256 副五色、每副合法且構築簽名不同的 Lv.5 Swiss roster；8 輪共 1,024 場 Swiss 與 7 場 Top cut 全部完成，Lv.4 以相同 pairing 重播亦為 1,024／1,024 完成。Lv.5 冠軍為 YELLOW #057、亞軍為 YELLOW #002；安全／完成／Top cut 通過，但 paired advantage 的 Wilson 95% CI 為 44.62%–59.34%，尚不足以證明顯著超過 Lv.4。完整排名與牌表見 [256 副 Lv.5 Swiss 報告](docs/lv5-swiss-256-report.md)。
結算畫面現在提供「查看對戰紀錄」入口；回顧視窗沿用 commandLog 的回合／玩家／卡牌／分類篩選與行動組逐步展開，並顯示紀錄筆數、行動組、回合統計，支援全部展開／收合及返回結算畫面。本機與線上對戰共用同一份公開紀錄資料，不另外重算或改寫遊戲狀態。
對戰紀錄現在可從本機側欄／結算覆盤與線上完整紀錄下載版本化 `braverse-battle-replay` JSON；離線檔含 `initialState`、扁平 `commands`、`commandLog`、終局快照與 replay 可用性，並新增 `source`、`sampleQuality`、`training.eligible`／`exclusionReasons` 資料品質門檻；未植入種子時明示 best-effort，線上只匯出遮罩後公開資料，不洩漏對手隱藏資訊。離線 AI 對局另輸出 `aiLevel`、strategy version／commit、對應 command 與公開決策分數／原因，線上即使誤傳也會省略；AI 可用 `replayBattleExport`／`assessBattleReplay` 驗證決策重播與資料集資格，完整欄位與限制見 [對戰紀錄 AI 覆盤匯出](docs/battle-replay-export.md)。
卡牌詳情與快速預覽沿用同一套 `CardEffectText` 段落渲染；BS7-104「Prune Juice Cookie」的官方第二段 Activate／Once per turn 技能會在 UI 另起一行，與卡面段落一致。

Refresh 邊界現在以來源與剩餘張數明確續接：登場 HP 補充只恢復真正被牌庫耗盡中斷的該張餅乾，`gain-hp` 無法 Refresh 時立即判負；將檢視牌庫的牌移到支援區而使牌庫歸零也會進入 Refresh。BS7-024 以 HP 作為回手代價而離場時，會清除來源 modifier 並依既有順序建立補位，避免留下空戰鬥區。

BS6 正式卡池包含 138 筆記錄（107 個不同基礎卡號，其中 106 筆為基礎記錄、32 筆為異圖／變體；BS6-091 僅有變體）。主效果待轉接 0 張，攻擊後 `Then` 已完成 27／27；正式 Browser 效果矩陣以可互動效果的基礎卡代表稽核，97／97 通過（含 BS6-039 成立／不成立 A/B）。BS6-041 休息區條件物品、BS6-039 休息區連鎖與 BS6-042 陷阱條件的成立／不成立 test-state 也均通過 Browser 驗證。牌組編輯器已可用 BS6 篩選顯示與加入正式 BS6 卡牌。完整逐色結果見 [BS6 Browser 稽核報告](docs/bs6-browser-audit-2026-08-12.md) 與 [BS6 效果轉接覆蓋盤點](docs/bs6-effect-coverage.md)。
BS6-084「Time Manipulator」的手牌條件會在棄牌代價完成後判定：當初始手牌超過 5 張時，使用流程仍會先開啟藍色能量支付與「棄 1 張以上手牌」步驟，之後才顯示對手餅乾目標；正向 `card:BS6-084` 與支援卡疲勞的 `card-negative:BS6-084` 均已用本機 Browser 驗證。

BS7「Arena of Glory」的正式來源為 `data/cards/official-arena-of-glory-bs7.en.json`；`cards:analyze:bs7` 會從正式卡池更新 [BS7 效果轉接覆蓋盤點](docs/bs7-effect-coverage.md)，[BS7 卡表盤點](docs/bs7-card-inventory.md) 保留 promote 前的歷史快照。正式卡面／效果／負向 Browser 矩陣目標分別為 143、98、143 筆；BS7-039／082 另有自訂反向點選順序的 Browser 證據，BS7-082 的負向路徑只棄 1 張且不建立全體傷害目標。

五色 BS7 Arena 牌組已加入主選單與牌組 registry，格式門檻為 60 張、至少 32 個 BS7 槽位與至少 8 個不同 BS7 基礎卡號。牌表以 deterministic optimizer 分離 training、validation、multi-seed rescore 與 untouched final；Lv.4 對 frozen BS6 五色 competitive reference 的採用樣本為 Red 51／100、Yellow 62／100、Green 102／200、Blue 63／100、Purple 55／100，合計 600 場的 invalid、stuck、deadlock、unfinished、error 與 turn cap 全為 0。另以兩個共同 seed 跑五色統一壓力樣本 500 場，結果為 Red 51／100、Yellow 54／100、Green 47／100、Blue 49／100、Purple 45／100，顯示單一 seed 仍有明顯波動；這些數字只代表本專案 AI 與 frozen reference 環境，不宣稱官方賽事強度。Lv.4 對 Lv.3 的兩批獨立 30 場為 21／30 與 18／30，並已修正技能／場景的合法支援區代價、非餅乾效果目標、關鍵字檢視選牌、來源離場後的不可支付自身代價，以及無法立即擊倒時的受傷目標聚焦。

2026-08-20 已完成 BS1～BS6 與 P 卡的正式卡池全面收尾：1,101／1,101 筆正式 Browser 卡牌路由均可載入；效果互動矩陣為 BS1 81／81、BS2 86／86、BS3 166／166、BS4 158／158、BS5 143／143、BS6 基礎卡代表 97／97、P 卡 138／138，blocked 與 failed 均為 0。全記錄負向矩陣依序為 99／99、104／104、176／176、170／170、153／153、138／138、153／153；無效果普通攻擊矩陣為 18／18、18／18、10／10、12／12、10／10、10／10、15／15。BS4-038 的基礎卡與兩個異圖變體均以「攻擊後進入目標選擇並完成效果」通過；BS6-036／042／043 與 BS5-109 另有專用正反路徑驗收。這些 test-state 路徑與正式對戰共用 adapter、規則引擎及 `GameCommand`，並再由正式 AI／牌組編輯器／本機雙瀏覽器好友房 smoke 覆核整合層；fixture 仍只負責快速建立局面，不取代真實隨機牌序的長局統計。完整矩陣與產物邊界見 [BS1～BS6 與 P 卡全面稽核收尾](docs/bs1-bs6-p-full-audit-2026-08-20.md)。

BS6-020 的規則層、離線／線上陷阱控制器與回應 Modal 已完成自身目標回歸測試；完整 Vitest 目前為 238 個測試檔、3,831 項（本輪新增 BS8-009 技能 Then、五張 BS8 EXTRA 登場條件與命令紀錄語意回歸；並保留 BS8-011 雙實體卡技能入口／Once Per Turn、BS8-005 真實效果傷害昏厥計數與候選 EXTRA Deck 編輯器隔離回歸；另新增官方條件 parser 與 strict contract fail-closed 回歸；BS8-013 昏厥效果補上正式紅色 LV.1 棄牌區候選與來源離場後的第二段 UI 續接回歸；BS8-017 補上官方紅色印刷 HP=1 棄牌區餅乾候選、戰鬥區空位與支付後的 Then 目標續接，Browser A/B 會 fail-closed 檢查完整「支付→棄牌區登場→Then 傷害」順序；BS8-018 補上紅色支援區支付夾具與「一次昏厥觸發只支付一次」的 Break→棄牌區→傷害順序回歸；BS8-011 巢狀 BS8-018 昏厥效果現在保留外層第二段目標，並補上 BS8-011／BS8-018／BS1-006 的真實卡牌續接夾具；依 BS1-006 官方卡面，效果傷害後仍留在戰鬥區也會觸發 afterDamage，並以 BS8-011 的第二段 BS1-006 傷害回歸覆核）。本機 Browser test-state 已驗證選取、略過與 AI 覆盤下載路徑。牌組編輯器卡池篩選已支援 LV、HP 與攻擊力條件，攻擊力沿用官方卡文解析結果。BS5／BS6 尖括號攻擊後代價已完成逐卡轉接與可略過回歸，BS6-044 追傷目標與原攻擊目標昏厥分支、BS6-061 支援區回手後 BS1-078 場景條件、BS6-062 物品的支援區餅乾回手代價也已補回歸；攻擊後效果對戰紀錄已補齊來源、代價、目標與結果步驟。BS4-075 Black Pearl Cookie 的攻擊後棄牌代價也已接入可略過 UI，涵蓋支付、略過與最多一張目標的回歸測試。另修正 BS6-023／BS6-024／BS6-031／BS6-036／BS6-042／BS6-043／BS6-053／BS6-055／BS6-058～BS6-063 的 card-check 初始 HP、休息區／支援區門檻、合法候選、OnPlay 登場與 Then 續接；BS6-023 登場全體傷害現在依序選擇對手餅乾，逐張完成傷害、FLIP 與昏厥後才處理下一張。並讓 BS4-005／BS2-015 代價昏厥後先完成原效果、再建立補位，完整記錄於 Browser／AI／規則回歸流程。

BS3-010「Pitaya Dragon Cookie」攻擊 BS4-024「Kumiho Cookie」的正式卡池 AI 回歸已補上：攻擊宣告停在防守方回應時不再誤寫自動結算，AI 會依序完成陷阱略過、傷害、攻擊後效果與支付；戰場雙方狀態也依實際待處理決策者顯示，避免畫面看起來像 AI 卡死。正式對戰中沒有任何回應時，回應窗改以不可取消的 microtask 略過，避免 render 清理掉零延遲計時器後留下無法操作的待處理攻擊。

BS4-026「Strawberry Crepe Cookie」的 OnPlay 移出戰鬥區效果若被 BS6-010「Timekeeper Cookie」阻擋，現在會在對戰紀錄明示阻擋來源與未生效結果；BS6-031「Timekeeper Cookie」攻擊後效果若沒有可支付的黃色能量，效果提示與略過後的對戰紀錄都會說明原因。兩者均新增正式卡池的正／負向 `test-state` 路徑，並由共享 `GameCommand`／規則層驗證。

BS6-101「Twizzly Gummy Cookie」昏厥效果已先顯示可選的紫色能量支援卡付款，再進入棄牌區紫色餅乾登場目標；本機、線上與 AI 共用同一套規則驗證，並保留不支付而略過的合法路徑。

卡牌轉接新增 shadow 行為契約稽核：`src/cards/contracts/` 會將官方來源拆成 clause ledger，交叉比對支付、代價、目標與 `Then` 的 runtime evidence，並產生 `verified`／`needs-review`／`blocked` 報告。`npm run cards:audit:contracts` 只讀取並報告，不改變正式決策；候選資料可用 `--strict-contracts` 阻止未完成契約進入 promote，`promote:candidate` 預設已啟用此 gate。完整流程與限制見 [卡牌行為契約](docs/card-behavior-contract.md)。

卡牌契約 P1～P5 已接續實作：P1 提供契約型別與 shadow compiler；P2 將契約步驟投影到 `DecisionDescriptor`，並由規則層的 energy／cost／target helper 產生合法候選；P3 讓本機 pending modal 與線上效果候選先共用 descriptor，`GameCommand` 仍是唯一執行入口；P4 新增負向／隱藏資訊測試與 `cards:attest` 公開 command trace gate；P5 以 `cards:migrate:batch` 依 card.id、排序、批次執行 shadow migration，未 `verified` 卡牌不會進入批次，也不會改動正式卡池。offset 150 與 offset 175 的 25 張批次均已完成 Browser／runtime gate；契約 parser 另補齊 HP 代價、牌庫底／棄牌區移動、支援區回手、Reveal／Discard 與原始單字母能量標記。

契約稽核已全部歸零：`cards:audit:contracts -- --strict` 目前 **verified=1,244、needs-review=0、blocked=0**。最後 25 筆 BS1～BS6/P 歷史缺口分三群修正——（1）16 筆 `payment evidence missing` 與 3 筆 runtime energy：ledger 現在收集 `StageAbility.placementCost` 作為場景卡放置費用的能量證據；（2）9 筆 `cost evidence missing`：BS5-092／BS5-093 補上 `trashToDeck` 技能代價（BS5-092 一併改為 `opponent-attack` 回應觸發並在戰鬥陷阱視窗內支付代價、結算 `modify-attack`，skipTrap 與 playTrap 路徑統一重算傷害）、BS2-081 的 `stage-source-to-trash` 綁定 self-to-trash、P-082 的 trap `alternativeCosts` 綁定 trash-to-break、P-045 修正雙重棄牌代價並以 deck-bottom 效果作為付款證據；（3）BS4-080@2 異圖欄位併寫正規化（技能／攻擊拆分 + Then 抽牌）與 P-100 FLIP 正規化，補齊 Then／once-per-turn／resolution order／timing 證據。契約建立改以 adapter 正規化後的來源為準，runtime 與契約消費同一份文字。25 張修正卡新增回歸測試（`payment-cost-regression.test.ts` 31 項、`bs5-092-attack-response.test.ts` 4 項）並以 25 張 batch 完成 Browser attestation；新增的 BS7 143 筆也全部通過同一 strict gate。

效果傷害（攻擊後追傷、技能、物品、場景與陷阱的傷害）現在統一進入逐點傷害／FLIP 結算流程；效果佇列會在 FLIP、昏厥與補位等決策完成後再續接下一段。丟棄、移除、HP 費用與 HP 區域移動仍不翻開或觸發 FLIP，並有正負向回歸測試。

BS5-073「Cyborg Cookie」已依官方 `flipText` 在卡牌詳情與牌組編輯器顯示為 FLIP；BS4-024「Kumiho Cookie」在對手有黃色 LV.3 餅乾時，攻擊目標 UI 只允許 Kumiho，其他目標會顯示限制原因，展開對戰紀錄也會保留限制步驟與來源卡。兩條流程均已用 localhost-only Browser fixture 實際操作驗證。

Browser smoke 的 1024×576 短桌面版面已修正手牌 hover／focus 抬升造成的戰鬥卡遮擋，並將案例納入明確 hover 回歸；Vite 也將大型 demo harness 拆至 `game-demo` chunk，使主入口 gzip 從 183.59 KiB 降至 161.73 KiB，低於 180 KiB budget。

五色 BS6 標準牌組已建立並接入 AI preset；資料驗證、固定 seed 100 場引擎矩陣與正式根路徑 Browser 實戰均通過。修正後五色各 20/20、合計 100/100 場完成，`simulationStuck=0`、Browser 錯誤與頁面例外均為 0；完整結果見 [BS6 牌組 Browser 報告](docs/bs6-deck-browser-validation-2026-08-12.md)。勝率只作固定樣本觀察，不作為環境強度定案。

BS6 競技環境 AI 牌組保留紅、黃、綠、藍、紫五色，並與既有 BS5／BS6 標準 choice 分開顯示；目前卡表以使用者提供的第六彈環境構築為準，可包含現役標準賽制允許的舊彈與起始牌。`P-059` 官方 API 重複攻擊名稱的 `flipText` 已在正規化層排除，避免誤算為 FLIP。可用 `npm run benchmark:bs6-competitive:round-robin` 重跑五色兩兩配對各 5 場、合計 50 場的固定 seed Lv.4 報告；結果僅代表本專案 AI 規則樣本，不等同官方賽事勝率。

BS1～BS6 五色 512 副牌組 Swiss 基準已完成：初代與第一輪 BS6 加權迭代各在 Chromium Browser 完成 9 輪、2,304／2,304 場，卡住 0、Browser 錯誤 0。第一輪上位卡表與牌組清單已保存於 [512 副牌組 Swiss 報告](docs/bs1-bs6-512-swiss-report.md)，後續牌組調整以此固定 seed 基準持續迭代。

BraverseFan 中文圖鑑與判例整理已列入文件參考來源；目前僅作為資料交叉核對與測試案例搜尋，不改變正式卡池權威來源。

2026-08-09 已修正 Deployment Browser Validation 的失敗遮蔽：trusted default branch 缺少驗收 harness 時會先明確報錯，artifact 目錄會預先建立且缺少檔案只警告；Preview 來自 PR 分支時安全略過自動驗收，改由 default branch 手動觸發，Production deployment status 則維持自動驗證；CI、Browser smoke 與部署驗收 workflow 同步升級至 Node 24 相容的 Actions major。

2026-08-08 穩定化批次已將 AI benchmark 從報表改為 CI 品質閘門，強制要求卡死、deadlock、非法操作與 turn cap 全為 0，且未達等級勝率門檻即失敗並輸出 `ReplayIssueBundle`。新閘門抓出並修正空戰鬥區仍有合法補位餅乾時錯誤列出「略過補位」的根因；另修正 Google Chrome 聚焦手牌動作時牌桌自動捲動、導致「登場」click 落空的 UI 問題。完整基線與未完成項目見 [穩定化對帳與執行計畫](docs/stabilization-plan-2026-08-08.md)。

BS2-015 已修正支付自身離場代價後按下「確認發動」看似無反應的問題；無可補位餅乾時會先完成尚未結算的傷害／`Then` 效果再顯示敗北，有可補位餅乾時也會先完成整條效果鏈，再開啟強制補位並續接登場效果。`card:BS2-015` 及專用終局／補位 test-state 都維持合法正 HP。

已完成 Equip（官方 `{mou}`）、On play、Your Turn、Once Per Turn、Activate、Blocker、Damage（`{da}`）、Skill（`{sk}`）八種卡牌標籤的圖片對應，以及黑色能量（`{K}`）圖示，並支援 `{token}` 與 `【Official Tag】` 兩種資料格式。

卡牌詳情中的普通攻擊已將 `{da}` 攻擊力數字固定在能量與招式名稱同一行，並以黑色粗體、白色邊框呈現；`Then` 攻擊後效果仍獨立保留於下一行。

效果操作視窗中的普通攻擊文案與 `Then` 攻擊後效果已拆成兩個段落，並以分隔線提升 BS5-010 等多段攻擊效果的閱讀性；回歸測試與 Browser 實測均確認兩段正常呈現。

場景卡詳情已將放置場景文字與後續 Activate 效果固定分成不同顯示行，與卡圖排版一致。

測試對局設定已支援雙方正式卡池的戰鬥區、精確 HP 卡、起始手牌、牌庫頂端順序、破損區、支援區指定卡／能量顏色、場景與棄牌區；牌庫尾端與支援未指定卡片會依設定補足測試卡／萬用能量，並提供 BS3-018 Blocker／傷害與 BS3-020 HP 卡回手案例。二選一效果選項會保留官方完整條件文字，避免只顯示簡化後的傷害摘要。

主選單已完成桌機／平板 AI 牌組與等級欄位的 8:4 版面調整、測試對局設定入口可見性與合法牌組錯誤區回歸修正，並補上對應的 MainMenu 測試。

攻擊宣告期間已在場上保留攻擊箭頭、以目標黃框標示被攻擊餅乾，並在陷阱與 Blocker 回應視窗直接呈現「攻擊者 → 攻擊目標」摘要；陷阱目標選擇步驟同步顯示攻擊者資訊，攻擊中餅乾以紅色邊框與「⚔ 攻擊中」徽章明顯標示。我方攻擊觸發對手 FLIP 時，翻出的 HP 卡會以左側大卡短暫固定呈現 3 秒，並可點擊外側關閉。本機 AI 與線上對戰共用此回饋邏輯。BS3-019 靈魂果醬在聖梅果餅乾不在戰鬥區時自動跳過裝載步驟；BS3-017 攻擊後效果在戰鬥區無其他餅乾時自動略過。陷阱卡同時含對手與自身目標效果（如 BS3-021 盾之誓言 -3 攻擊 + 自身 1 傷害）時，導引步驟自動補齊自身目標選取，不再因缺少 `selfTargetIds` 而無法發動。

BS3-045 `damage-by-break-count` 已納入陷阱目標候選與驗證，休息區有 LV.3 餅乾時可正確選擇對手並造成對應傷害；ST2-020 的回歸測試確認減攻擊效果不會改寫原攻擊目標。

BS3-028「莫札瑞拉起司餅乾」已補上登場技能目標選擇 UI：對手休息區 LV 總和 ≤6 且棄牌區有合法 LV.1 餅乾時顯示選擇；LV7 以上由規則層略過效果並不顯示目標提示，兩條件路徑均有回歸測試。

BS3-063「Carameleon Cookie」的登場效果已修正為先完成支援區卡返回手牌，再於 Then 階段列出包含該卡的手牌候選；「最多放置 1 張」可選 0 張並正常結束技能，規則層、AI 與 UI 共用同一候選／可選性判定。

BS3-061「Silverbell Cookie」的昏厥效果已修正為顯示正確的支援區卡候選，並在支付代價後重新判定「支援區有 5 張或更多」條件；條件不成立或沒有可支付卡時會自動略過後續效果，不再留下空白提示或卡住對局。成立／不成立／無可支付代價均有回歸測試與專用瀏覽器情境。
BS3-061「Silverbell Cookie」的昏厥技能現在可由玩家選擇是否發動；選擇發動後才支付支援區代價，並以支付後的支援區張數重新判定全場傷害。選擇不發動會跳過同一次觸發的所有效果。

BS3 全系列本輪完成 121 張基礎卡的瀏覽器載入掃描，並針對餅乾技能／FLIP、攻擊後效果、物品、陷阱、場景、Soul Jam、特殊勝利與 AI 對局補做代表性實戰驗證；修正 BS3-024、BS3-098、BS3-121 的可重現問題。BS3 共 176 筆資料（121 張基礎卡、55 個異圖／促銷變體）已於 2026-07-26 promote 至正式卡池。

BS4 系列已完成 111 張基礎卡的效果覆蓋稽核：攻擊 `Then` 23／23 已轉接，額外能力來源 87 張已轉接，原先 14 張待補效果已降為 0。170 筆資料（111 張基礎卡、59 個異圖／促銷變體）已於 2026-08-03 promote 至 `data/cards/`；HP 代價、BS4-001 自我昏厥、BS4-065／109 陷阱後半效果、BS4-008 FLIP 目標與 BS4-102 FLIP 選擇牌庫分支已補齊，完整狀態見 [BS4 效果轉接覆蓋盤點](docs/bs4-effect-coverage.md)。

BS4-089 月光餅乾的登場效果提示已明確區分「強制將對手牌庫頂 5 張牌放入棄牌區」與 Then 後續目標選擇，並顯示第幾段效果進度；完成後的對戰紀錄也會明確確認牌庫移牌已執行。

BS4-062「Wind Gems」已修正為「支付 2 點綠色能量 → 從支付後仍活躍的支援中額外橫置最多 4 張 → 選擇最多 1 個對手餅乾」三階段提示；額外橫置張數決定效果傷害，單機與線上共用分組上限。專用 Browser 路徑已驗證 8 張活躍支援時會留下 6 張候選，最後形成 6 張疲勞、2 張活躍並造成 4 點傷害。

BS4-106／107 的一般 `card:` test-state 已分別準備 10／15 張對手棄牌，能直接操作條件成立流程；`bs4-condition:*:unmet` 仍保留門檻不足分支。BS4-107 的後半段已依「最多 3 張」改為 0／1／2／3 張選擇，Chrome 已驗證最大 3 張與選 0 張都能完成且不會留下待處理效果。

BS4 後續規則回歸已完成 AI benchmark 的 RNG 傳遞修正：同一個 step seed 會流經技能、物品、場景與 Refresh；固定 seed 的 100 場矩陣重跑結果完全一致。另為 22 張條件卡建立 `met`／`unmet` 專用 test-state，共 44 條路徑通過；24 張一般 fixture 卡的效果面板、支付、代價、目標與可略過流程也以 Chrome 實際互動 24／24 通過。111 張 BS4 基礎卡以 Chrome card-check 逐卡載入 111／111 通過，並在 AI browser 的 1280×720、1024×576 等 viewport 通過 responsive geometry gate；BS4-052 end-phase 目標結算與 BS4-029 chained optional attack 的回歸問題已修正。完整結果見 [BS4 卡牌、RNG、responsive 與互動稽核報告](docs/bs4-browser-audit-report-2026-08-04-final.md)。

擊倒觸發的攻擊後技能（如 BS4-011 擊倒對手後抽 1 張並棄 1 張）已確認以「效果鏈優先於空場補位」結算：傷害結算後先完成抽牌／棄牌及其他待處理效果（空缺且無餅乾可補位時也先完成效果再判負），全部清空後才建立補位；離線、線上與 AI 決策流程共用同一判定，回歸測試涵蓋手牌為空時必棄唯一抽牌、以及無補位餅乾直接敗北兩條邊界路徑。

兩階段選擇效果已落地：BS4-030 桃花餅乾「世外桃源」與 BS4-044 千年寺場景的目標選擇拆為「先選目標餅乾 → 再選 1 張手牌放回其 HP 最上方」兩個順序決策，沒有合法目標時不詢問發動、第一階段目標昏厥時自動中止並略過第二階段，對戰紀錄只公開動作過程、不揭露被搬移的卡牌內容；本機、線上與 AI 共用同一判定。

P-0XX 特典卡已完成全量 153 筆（含 14 筆異圖變體）的 adapter conversion、正式卡池 promote 與 Browser 收尾；P-082 替代／主支付、P-084 昏厥後轉為 `{N}` 的動態啟動費用，以及 P-147 Special Play 已接上 runtime／UI，並完成專用 Browser 情境驗證。完整記錄見 [P-0XX 匯入盤點](docs/p0xx-card-inventory.md) 與 [P-0XX 效果稽核](docs/p0xx-effect-coverage.md)。

BS5 YELLOW 與 GREEN 已完成 runtime 轉接，逐色稽核歸零：GREEN 批次新增 `deferred-end-of-turn`（BS5-051／056／058／063「When your turn ends」延遲佇列，於 end 階段重入排空、互動效果建立對應 pending）、`opponent-rests-support`（BS5-065 由對手選定橫置支援卡，`activeOnly` 與候選不足自動略過）、`StageAbility.endPhase`（BS5-066 場景被動觸發，不可手動啟動）；UI 新增 `OpponentRestSupportResponseModal` 並共用本機／線上控制器，`cards:analyze:bs5-candidate` 覆蓋盤點 GREEN 0／0／0（見 [BS5 效果轉接覆蓋盤點](docs/bs5-effect-coverage.md)）。

BS5 BLUE／PURPLE／PURE 的 23 張能力，以及 BS5-087／BS5-109 兩張陷阱主效果與 BS5-067／071／080／085／089／094／097／098／099／106 十張攻擊後 `Then` 已完成 runtime 轉接與回歸測試；`cards:analyze:bs5-candidate`（目前以正式 `data/cards/` 來源分析）顯示 111 張基礎卡的主效果／能力／攻擊 `Then` 待轉接皆為 0。BS5 已於 2026-08-06 promote 至正式卡池，另補上 BS5-089@2 異圖攻擊欄位 normalize 與 attached HP bonus FLIP 的正式驗證契約。

BS5 五色已各建立標準／開放兩種 60 張 AI preset。標準 preset 全部使用 BS5；開放 preset 以 BS5 為主並加入受標準禁限卡表限制的既有卡牌，作為「開放可使用所有正式卡牌」的回歸驗證樣本。牌組編輯器、主選單、本機對戰與線上對戰入口共用同一個賽制欄位與規則驗證。

BS5 標準 preset 已以固定 seed 完成五色各 40 場、共 200 場 Lv.4 矩陣，五色完成率均為 100%、卡死 0 場；依兩組 seed 的隔離比較迭代紅／黃／綠／藍牌組，紫色保留原構築。正式報表見 [BS5 標準牌組 40 場 benchmark](data/decks/bs5-benchmark-report-40-standard.json)。目前勝率僅作為固定樣本觀察，不作為環境強度定案。

BS5-111「覺醒!龍之怒」已依官方 Q&A 改為動態 HP 門檻：攻擊者在攻擊尚未結算完畢時因 BS1-002 FLIP 由 4 HP 降至 3 HP，未結算傷害會套用 +1；防守者在同一筆多點傷害中途降至 3 HP 以下，-1 受擊傷害不追溯套用，必須等下一次攻擊。兩條路徑均有 battle regression test。

完整技術細節見 [docs/architecture.md](docs/architecture.md)（分層架構、規則引擎模組、AI 分級）與 [docs/audit-report.md](docs/audit-report.md)（逐 Phase 完成度盤點）。摘要：

- **規則引擎**：`src/game/` 純函式引擎，五色 + 第二彈官方起始牌組、typed `GameCommand` 指令層（8 決策 + 24 動作）、`commandLog` + replay（含 AI 對局重播）；多段能力效果不得繞過中途決策，已有 8 類決策回歸；`isEffectTargeted` 涵蓋 split-damage、prevent-effect-damage 等效果型別，AI 目標選擇已補齊 7 類效果排序；ST5-007／ST5-022 觸發、同時補位逐一處理 OnPlay 與傷害步驟鎖定皆有完整流程回歸。
- **牌組編輯器**：搜尋／篩選、合法性即時檢查（60 張／同卡 4 張／≥1 餅乾／FLIP ≤16）、匯入匯出、版本化 localStorage 儲存；系列選單已分開 BS3 與 BS4，避免兩彈共用官方 product title 時混在一起。BS8 候選 staging 的卡池可切換 `EXTRA` 類型搜尋 EXTRA 餅乾，選取後會在主要牌組捲動區下方以實際卡面、卡號、張數與加減控制呈現六槽額外牌組；Standard 模式仍不提供 EXTRA 選項。`@1` 卡面變體（如 `BS2-031@1`）與其 base（`BS2-031`）視為同一張卡共用 4 張上限，輸入／匯入時自動正規化為 base；卡池列表僅顯示 base，原始變體資料保留在 `data/cards/*.json` 並可透過 `getCardPoolVariants` 取得。
- **AI**：Lv.1–4 已完成（隨機／啟發式／評估式／兩層前瞻），Lv.5 為可選的實驗 challenger；所有等級只讀 `PlayerView` 保證資訊邊界。Lv.5 已加入通用 ComboPlan、同 plan 跨步記憶、資源預留及牌庫耗盡／Refresh／空場敗北預測，但全 corpus 尚未證明勝率優於 Lv.4。效果目標選擇涵蓋 split-damage（列舉四種配置取最優）、hp-to-trash/support、disable-flip/attack、battle-to-support、prevent-effect-damage（sourceOnly）等 7 類效果。Lv.5 戰鬥區已有一張餅乾時預設保留第二張手牌，公開 Combo／斬殺／有效 OnPlay／補防例外才允許第二張；Lv.2–4 維持原有手牌品質與 FLIP 保留策略。等級 benchmark 強制驗證零卡死／deadlock／非法操作／turn cap 與最低勝率；見 [docs/ai-levels.md](docs/ai-levels.md)。
- **卡牌池**：BS1～BS10、五色起始牌組與 P-0XX 特典卡均已匯入正式 `data/cards/`；正式卡池共 18 個資料檔、1,764 種卡號（1,726 張可轉接記錄，另 38 筆 EXTRA 保留於 registry），其中 BS7 143 筆、BS8 171 筆、BS9 185 筆與 BS10 164 筆（含異圖變體）皆已完成對應 strict／Browser gate 與 promote。BS8-005 的 localhost `card:`／`card-negative:` fixture 會沿用獨立 `ExtraDeckCard`，不再以一般 `GameCard`／物品卡承載；BattleRow 會依同一規則裁決器顯示 EXTRA 可登場高光，開啟玩家自己的 EXTRA Deck 時呈現卡圖，對手仍只看到私密提示；BS8-008 Blocker 則要求在 modal 選取合法紅色支援支付。詳見 [BS7 匯入盤點](docs/bs7-card-inventory.md)、[BS7 效果稽核](docs/bs7-effect-coverage.md)、[BS8 匯入盤點](docs/bs8-card-inventory.md)、[BS8 效果稽核](docs/bs8-effect-coverage.md)、[BS9 卡牌盤點](docs/bs9-card-inventory.md)、[BS9 效果稽核](docs/bs9-effect-coverage.md)、[BS10 卡牌盤點](docs/bs10-card-inventory.md)、[BS10 效果稽核](docs/bs10-effect-coverage.md)、[P-0XX 匯入盤點](docs/p0xx-card-inventory.md) 與 [P-0XX 效果稽核](docs/p0xx-effect-coverage.md)。靈魂果醬裝載與 BS3-115 保護（含攻擊附加例外、全場／棄置排除、無目標 Then 中止）已依官方 Q&A 落地。`npm run validate:cards` 接入 CI，除資料完整性外，也檢查 ability 非空、技能標記、可選抽牌、來源橫置及高風險卡語意契約。
- **UI**：滿版桌墊 HUD、扇形手牌、統一效果 modal、響應式（最低支援 600×338）；桌面戰場（≥901px）採參考圖的中央戰場、左右資源欄、左側卡牌焦點預覽與右側回合欄排版，底色維持既有深藍／青色基調；1164×777 平板與 1366×768、1440×900、1920×1080 通用桌面 viewport 均以實際卡面邊界驗證，短高度桌面的手牌高度依 viewport 縮放並完整留在畫布內；1280×720 已修正手牌裁切、提高戰鬥區比例與資源標籤／中央狀態提示對比，並保留 hover 與鍵盤 focus 的卡牌快速預覽；主選單使用 CookieRun BRAVERSE 金色／棕色品牌文字排版；餅乾、物品、場景與陷阱的效果操作共用「能量 → 代價 → 目標」導引步驟，缺少的步驟自動略過，支援下一步／上一步並只在最後確認發動；能量支付候選依卡牌明確顏色限制，只有真正沒有顏色的 `MIX` 卡才視為萬用能量；攻擊支付候選與規則層共用中性費用判定，本機與線上均可點選 BS1-007 的 3 張支援卡；ST3-019 支援區棄牌改由玩家在既有提示框選卡，BS2-021 目標清單可換行捲動，BS2-044 攻擊可選效果與攻擊提示合併為單一流程；BS1-037 攻擊後效果沿用同一個提示框，沒有合法 LV.1 目標時由規則層自動略過，玩家也能手動略過；BS6-057 的綠色能量、自身送棄牌區與支援區 Cookie 回手三項代價會在抽牌前逐項呈現；`App.tsx` 協調邏輯已拆至多個自訂 hooks。
- **戰鬥區卡槽**：中央「戰鬥區」文字固定不位移；單張餅乾落在左槽，雙張餅乾以放大的左右間隔排開。HP 卡 dock 置於卡片下緣；能量不足與技能提示以所屬卡片外側的垂直中線排列，左卡向左、右卡向右，本機與線上對戰共用。
- **戰場視覺同步**：`/?mockup=battlefield` 直接重用正式戰場元件與桌面 `tactical-clean` 樣式；對手紅框、我方青框、深藍戰鬥區與次深藍支援區、支援張數與休息區等級文字均同步套用。平板橫向正式對戰與 mockup 共用 `src/styles/tablet-layout.css`，本機與 mockup 都已移除會穿過手牌的全畫面裝飾框；responsive gate 同時檢查手牌實際卡面，不只檢查手牌 dock 容器。
- **近期對戰桌版面**：桌機版雙方戰鬥、支援與休息區以等高鏡射排列，側邊區組新增與支援區同列的靜態額外區預留格；對手區域統一紅色邊框、我方區域統一藍色邊框，共享戰鬥區中央不再保留分隔線。`table-status-banner` 已移除，避免常駐提示遮蔽戰場；回合欄改為深藍底、金色外框。
- **線上對戰**：WebSocket server（Render 部署）+ 房間碼 + 玩家名稱 + 遮罩狀態；開局已整合至對戰桌，依序完成私密猜拳、勝者選先後攻、先攻再後攻調度、強制調度補償與起始餅乾同步揭示，並持續顯示雙方順位及目前行動者／階段。對局中提供即時對戰動態、昏厥／陷阱／FLIP／物品事件提示與可展開完整紀錄；手牌點擊外部可取消選取，公開資源可查看，對手攻擊選取會同步餅乾高光與付款支援卡橫置，自己的攻擊支付也會收到候選清單而正常點選支援卡。P0–P2 對戰可視化以 `ActionStatus` 統一提供玩家／階段／來源卡、等待原因、五步驟進度與伺服器期限；戰場不再常駐渲染中央 `RemoteActionBanner`，改以攻擊箭頭、公開來源卡預覽、回應狀態與可展開活動紀錄呈現必要資訊。上述功能共用伺服器權威 `PublicIntent`（序號／狀態版本／公開牌面過濾）與 `ActionStatus`，本機與線上維持相同顯示邏輯；BS1-037 無合法 LV.1 對手目標時不建立等待提示，已有提示可由玩家略過；本機雙瀏覽器自動驗證完整開局、階段同步、卡牌詳情、攻擊預覽、拒絕提示、斷線與連線失敗。
- **CI/CD**：GitHub Actions（卡牌／候選／registry 驗證 → app＋server typecheck → test → 零 warning lint → build → bundle budget；main push 另跑 AI／牌組編輯器／好友房瀏覽器 smoke）+ Vercel Git Integration 自動部署。

測試基線、bundle 大小等會隨每次 PR 變動的數字，一律以 [CHANGELOG.md](CHANGELOG.md) 最新項目為準（非永久門檻，只要求不低於前次基線）。

BS4 五色強化牌組已依 BS3 preset 建立 5 份可匯入 JSON，並提供 `benchmark:bs4-decks` 以固定種子、Lv.4、每色 30 場矩陣比較 BS3 基準與 BS4 版本；本輪另以 `BS4_GAMES_PER_PAIR=4` 完成 100 場固定 seed 重跑，結果寫入 `data/decks/bs4-benchmark-report-100-fixed.json`。此處的「環境強度」指本專案五色 AI 對戰環境；在專用條件情境與更完整對局樣本完成前，不將勝率排名視為正式環境強度結論。

## 下一步計畫

- PR #126 維持草稿，待目前 head 的 CI 完成後由 reviewer 決定是否合併；不啟用自動合併。

- 從 ST8-002 繼續逐卡驗收；HP 支付 AI 原型須完成獨立對照評估後才決定是否採用。

- Refresh 修正先獨立提交；其餘卡牌與 AI 工作保留在工作區，完成各自驗證後再提交。

- 完成剩餘 63 張逐卡驗收；ST7-011 已 promote 並通過正式局部驗證，接續完整 Vitest 與後續卡牌。防守減傷與 Break 競速估值仍為未採用原型；後續修改未納入既有部分提交。

- 後續AI評估仍需驗證長期支援管理與交換收益；本次局部順序改善尚未證明勝率提升。

- PR #124：推送修復後確認 GitHub CI；BS12 新增組合的完整 Browser／逐卡 online 驗收仍另列待驗。

- BS12：一般累計8,144，局部cursor103；102雙尺寸88案、3檔120項專項、16檔875項受影響、strict1／1、build／全域lint通過。通用card入口修復的6項單元／12案載入回歸另列。剩10基礎／19印刷；100～102批末完整Vitest 737檔／12,384項（830.51秒）全部通過／exit0，1267個凍結來源雜湊全部一致；AI Browser六項UI／ST1核心同步以最終build重驗均exit0，full1中斷不計通過。裁定112及全部印刷後，154 inventory／0 promoted、正式／逐卡online未完成。

- 按 3～5 張共用機制批次補齊 BS10／BS11 的獨立原圖預期、條件／付款／目標／FLIP／印刷分支，再補正式與線上逐卡矩陣；保留失敗、程式與資料變更造成的過期證據，避免由舊腳本引用或大量完成對局推定全卡正確。六色模擬結果另以更多固定種子及真人對戰覆核。

- CI 持續保留單 worker Vitest 與 180 KiB 主入口 gzip 門檻；新增 AI 或 tournament 功能時，確認依賴仍只在需要的流程載入。

- BS11 159 筆跨產品官方記錄已 promote；官方 booster 範圍已由瀏覽器確認為 150 筆、116 個基礎卡號，9 筆其他產品促銷印刷保留為系列變體。通用 test-state 已修正 BS11-091／116 EXTRA 分區及 BS11-092／111 Special Play 見證；逐筆效果文字與 116 張轉接狀態見 [BS11 卡牌盤點](docs/bs11-card-inventory.md)及[效果轉接覆蓋盤點](docs/bs11-effect-coverage.md)。正式 AI 牌組對局與雙瀏覽器線上全對局已走到結算；仍待在可連線環境確認官方 CDN 卡圖載入，線上逐卡技能矩陣也未另行驗收。各驗收層級與限制見 [BS11 進度](docs/bs11-progress-2026-09-22.md)。

- BS9-035／041／050 已補可操作的場景見證；正式牌組完整對局與線上逐卡驗證仍須另行驗收。

- 攻擊付款遮擋已修復；持續以長卡文、真機觸控及其他付款情境檢查預覽與操作區的互動。

- UI／UX：以本批正式流程證據為基礎，後續補逐卡 FLIP／多目標矩陣與真機觸控；教學目前為正常對局搭配五段操作說明，逐步判定的練習關卡另行設計。排位、配對、觀戰與雲端戰績未納入本批。

持續檢查不同效果的提示與卡牌詳情銜接；本次先改善技能面板中的選牌與閱讀流程，獨立卡牌詳情視窗維持既有行為。

BS10 的卡牌轉接、逐卡 Browser、候選 promote、正式牌組與 online 完整流程已完成本批驗收；後續僅需在官方卡圖網路可載入環境重跑 BS10-008 專用 FLIP 的 1 個受阻起始 lane，並保留全域 lint 的 4 個既有診斷檔錯誤。詳見 [BS10 進度](docs/bs10-progress-2026-09-14.md)。

對戰桌後續在正式卡圖可載入環境補驗大量支援與多張手牌、長卡名及長局的視覺辨識，維持本機／線上共用樣式。

主選單保留單一正式入口，後續以長牌組名稱、多牌組切換與完整卡圖載入持續驗證。動畫後續須在官方卡圖可載入環境補完卡面視覺驗收，並擴充線上多段攻擊／FLIP 的逐卡矩陣；第一版不包含音效與逐卡專屬動畫。

0.10.0 已固定正式主選單與「管理牌組 → 我的牌組 → deck-editor」的入口邊界；後續以正式對戰／線上對戰驗收與長局品質為主，不再另開第二套正式主選單。

BS9 五色主牌組與同色 EXTRA、1024 人 Swiss／淘汰賽及 Lv.5 公開資訊經驗訓練流程已接通；目前 500 步硬上限下仍有 36／5,120 場 Swiss 卡住／超限，整體 benchmark 為 FAIL，不能把現有 profile 視為已證明提升勝率。下一步應先針對這 36 場的共同 deadlock／長局根因補回歸與調整 Lv.5，再以更多固定 seed、完整 256 副×8 輪交叉 holdout 及真人盲測重新校準強度；正式牌組逐卡／雙瀏覽器驗收仍依影像可載入環境補足。AI Browser Smoke 已通過現行暫停資訊／恢復流程。

BS9-017／018 已完成候選固定目標與對手實際受擊／防止重驗，BS9-018 另有實際攻擊→BS1-002 Kumiho FLIP 的雙目標 A/B；正式牌組與雙瀏覽器逐卡驗收仍待，候選不 promote。

BS9-010 的隱藏手牌、HP 朝向／位置及付款已完成候選重驗；後續保留正式牌組與完整線上逐卡 gate。先前只檢查 HP 張數的通過紀錄不能取代此次語義驗證。

BS9-022／BS9-023 的 test-state 已補上對手持有 HP 卡的正面公開標記與雙玩家遮罩回歸；後續若要宣稱正式功能，仍需在正式牌組與雙瀏覽器線上流程確認相同公開牌面及合法／不合法路徑。

BS9-031／BS9-032 的正向 test-state 已改由 BS9-030 Shadow Milk Cookie 的真實攻擊後 detached FLIP 驗證，不再把 P-018 effect-damage 當成唯一正向入口；負向仍用 HP FLIP 覆核 opponent-turn Then 邊界。後續需在可載入官方圖片的環境重跑雙尺寸 Browser，並補正式牌組／雙瀏覽器線上逐卡驗收。

BS9-001～118 與各批專項驗收已完成；BS9-051～070 的 140／140、BS9-071～118 的新版嚴格 Browser 352／352，以及 BS9-025／`@1` 專用 8／8 已納入正式卡池前驗證。這些 Browser 證據仍不等於完整多人或線上逐卡完成；BS9-025 已依使用者確認的專案語義解除 review-only／fail-closed 並完成 strict verified。promotion 已完成，本輪不 commit／push。

後續逐卡任務依新版 Skill 留存卡圖、獨立預期、各限制負向案例與 UI 結算證據，分別追蹤初次缺陷及驗收後漏失，不以測試全綠推算卡牌正確率。

日常沿用 `$braverse-workflow` 與現行任務報告，依實際失敗證據調整流程；不新增重複追蹤系統，不因本次文字精簡降低遊戲測試或正式 Browser 驗收門檻。

[2026-09-07 桌機／平板稽查](docs/bs8-desktop-tablet-audit-2026-09-07.md)的逐卡局部重驗、異圖入口與完整測試已完成。156筆非EXTRA可用於正式Standard主牌組；15筆EXTRA已開放正式自訂牌組與線上入口，JSON、共用驗證與房間協定已同步。逐卡完整正式對局及線上覆蓋另列後續，手機維持本次範圍外。下列早期計畫與測試數為歷史背景，本輪狀態以上述稽查文件為準。

BS8-076 的凍結／棄牌分支與 BS8-059 的逐目標 HP 選擇已納入本機回歸及桌機／平板 Browser 證據；後續仍需依既定門檻補正式牌組、多人與線上逐卡覆蓋，不以 localhost `test-state` 取代完整對戰驗收。

BS8-053 的正向／負向 `test-state` 現已保留為可重現的目標候選與零合法目標回歸；後續仍需依全體 BS8 驗收範圍補正式牌組、多人與線上路徑，不以局部 fixture 證據取代完整對戰覆蓋。

BS8-074 的正向／負向 `test-state` 現已保留為可重現的條件式陷阱減費與印刷費用回歸；後續仍需依全體 BS8 驗收範圍補正式牌組、多人與線上路徑，不以局部 fixture 證據取代完整對戰覆蓋。

BS8-085 的正向／負向 `test-state` 現已保留為可重現的剩餘 1 HP 目標與高 HP 反例回歸；後續仍需依全體 BS8 驗收範圍補正式牌組、多人與線上路徑，不以局部 fixture 證據取代完整對戰覆蓋。

BS8-095 的正向／負向 `test-state` 現已保留為可重現的棄手牌代價與無手牌阻擋回歸；BS8-098 亦已保留 Then 藍色支付、手牌條件成立／不成立的陷阱後續回歸。兩者仍需依全體 BS8 驗收範圍補正式牌組、多人與線上路徑，不以局部 fixture 證據取代完整對戰覆蓋。

Awakened EXTRA 的底卡顯示已以 BS8-027／BS8-104 的本機正向 Awaken、底卡詳情與 BS8-027 負向封鎖路徑確認；後續仍需在正式牌組、多人及線上公開資訊投影中覆核相同 underlay 顯示，localhost fixture 不取代完整對戰驗收。

BS8-100 的正向／負向 `test-state` 現已保留正式卡牌手牌、藍色支付、藍色手牌篩選、等量抽牌與休息支援卡阻擋回歸；BS8-119 則以正式 Crunchy Chip Cookie 串接正式 BS8-103 Dark Cacao Cookie，保留來源進棄牌、棄牌區登場、OnPlay 紫色支付與雙目標 HP 棄牌回歸。上述仍是 localhost 局部證據，後續需補正式牌組、多人與線上逐卡覆蓋。

BS8-107 的正向／負向 `test-state` 現已保留正式 Black Concoction／Milk Cart 紫色 Item 代價候選，以及 Warm Wind Flower／Blackberry Cookie 的錯色／錯類型反例；後續仍需依全體 BS8 驗收範圍補正式牌組、多人與線上路徑。

BS8-121／122／125 的正向／負向 `test-state` 現已保留正式紫色 Item、錯色／錯類型手牌、正式 Stage／Dark Cacao、實際紫色支付卡與 15／13 張真實棄牌區證據；Chrome 已確認條件成立與阻擋、來源／代價移動、抽牌及動態攻擊費用。上述仍是局部 fixture，後續需補正式牌組、多人與線上逐卡路徑。

依 [本輪全面稽核報告](docs/ui-ux-and-bs8-audit-2026-09-05.md) 接續黃色BS8-051；先做桌機與平板，手機模式暫緩。黃色026–050已記錄本輪卡面與局部效果證據，專卡完整對局仍需補驗。023／024跨玩家順序已修，仍需擴充Refresh與專卡線上驗收；前序完整對局證據集中補齊，包含021完整裝備後攻擊Browser連鎖，不延後黃色初查。保留配對代價、昏厥來源代價及未翻開FLIP不影響HP的回歸。另需修復結束階段同時觸發排序、覆核舊系列付款文字差異，推進BS8全色／EXTRA完整對戰驗收。UI中期改善以新手直接開局、來源卡文連續顯示、付款與目標集中、平板身分與操作區可見為主。候選卡測試曾有Windows寫入失敗；2026-09-07已完成輸出隔離，完整套件通過。

依 [BS8 綠色驗證紀錄](docs/bs8-green-validation-2026-09-05.md) 與 [BS8 黃色驗證紀錄](docs/bs8-yellow-validation-2026-09-04.md) 保留後續逐卡線上／正式完整對戰覆蓋範圍。先前AI Browser回歸通過；最新完整測試已通過，候選工具隔離修復與驗證以上方本輪紀錄為準。局部 test-state、靜態 contract 與本機 Browser 不等同全色逐卡完整線上對戰通過。

Lv.5 的 attack-tempo 修正完成後，完整 46 副 corpus、mirror＋輪替跨牌組、雙 seed／雙邊換位的 368 場 holdout（seed `1001`–`1002`）為 180 勝（48.9%，Wilson 95% CI 43.8%–54.0%，安全指標全 0），未達升格門檻，Lv.4 維持 champion。下一輪先用 replay attribution 比較 Lv.5／Lv.4 在低勝率樣本的公開回應、防守預留、可選支付、攻擊節奏與終局生存判斷，預先登錄不含牌組／顏色／卡號的通用假設與回歸 fixture，再用新的未見 seed 重跑全 corpus；seed `1001`–`1002` 不得再作為調參後 holdout。只有安全指標全為 0、勝率至少 52% 且 Wilson 95% CI 下界高於 50%，才由實驗 challenger 升格。任何新卡池先通過 `ai:audit:capabilities --strict`，再進逐卡規則／Browser 與 promote gate。
Arena telemetry 已依 player view 分拆候選與 reference 指標；本輪觀測到起始牌組 RED／GREEN、BS3 Blue Sorbet、BS5 Green Open 與 BS6 Green Standard 各僅 1／8，不可據此寫特判，僅能作為後續 replay 歸因的抽樣入口。
對戰紀錄回顧已提供版本化 `braverse-battle-replay` JSON 下載；目前匯出會以 `source`、`sampleQuality` 與 `training` 明確分離可重播資料和可進 AI corpus 的行為樣本，並對離線 AI 紀錄保存等級、策略版本／commit、command 對應與公開決策理由；舊 v1 檔案解析時會保守補成 `unknown` 並重新計算資格。後續可在不揭露隱藏資訊的前提下，加入逐回合狀態差異與「從此步重播」入口，並以 replay API 作為唯一狀態來源。卡牌文字 UI 則維持官方段落換行與無障礙文字回退，新增卡池時沿用同一渲染契約。

BS7-001～BS7-108 已完成 runtime 轉接、strict contract、正式 promote、五色牌組的跨 seed optimizer／holdout 與 Lv.4 AI 強度校準。後續官方卡文或卡表更新仍須重新從 `inventory` candidate 開始，通過 strict contract、逐卡正反 Browser、BS7-039／082 順序結算、正式 smoke 與人工覆核後，才可再次 promote；五色牌組則以真人對局、較大獨立樣本與 Green／Purple 對 Yellow 的弱勢對局作為下一輪校準重點。後續 Refresh 變更須維持「無候選立即判負、只續接明確中斷的登場 HP、效果 HP 後置」三項不變量，並以正反 Browser 路徑覆核實際 pending／補位順序。

通用型 Lv.3／Lv.4 AI 已完成 G0～G5：Lv.3 會對規則層列舉的合法候選輸出 `ActionScoreBreakdown`；Lv.4 則以 width 5、depth 5、240 nodes、150ms 的有限 command search 維持 Setup→Payoff 計畫並預留攻擊資源。搜尋只使用 `PlayerView` 與合法 `KnowledgeState`，遇到未知抽牌、攻擊 pending、trap／blocker／FLIP／replacement 等決策即停止推演；timeout 一律回退 Lv.3。G5 已將合法的補位、付款、目標、順序、二選一、棄牌、陷阱、FLIP、阻擋、Refresh 與多階段 pending 決策接入 TacticalPlan，並輸出可稽核的 selection telemetry；Lv.1／Lv.2 行為不變。

卡牌行為契約維持 shadow mode 盤點正式卡池；BS7 formal strict contract 為 143／143、BS8 為 171／171 `verified`，整體正式 strict audit 與資料驗證分別為 1,415／1,415 與 1,400／1,400（EXTRA 15 筆由獨立 adapter 處理）。payment、runtime energy、cost、target、Then、timing 與 resolution order 缺口皆已補上可追溯的來源與 runtime 證據；現在連「本回合 Cookie 曾昏厥」這類條件也必須有 runtime `EffectCondition` 證據，缺少時自動落到 `needs-review`。新卡或官方卡文更新仍必須重新通過 strict gate。

本輪亦修正 P-015 攻擊後可選代價的多段效果續接、P-016 從棄牌區移至 break 的候選與 descriptor 接線、BS4-014／BS4-080 特殊效果正規化，以及稽核驅動對 P-053／P-130 條件、P-099／P-100 FLIP 與無效果異圖的分類。該歷史批次完整 Vitest 為 238 檔、3,831 項（本輪最新結果見「目前進度」）；BS8-011／BS8-018 巢狀昏厥續接、BS8-013／BS8-017／BS8-018 範圍測試、scoped lint、typecheck、build 與完整套件均已通過。全域 lint 尚有工作樹既有的 `.tmp-probe-deploy.ts` 與 `scripts/diagnose-lv5-conservatism.ts` 3 個未使用變數，未納入本輪修正。

契約遷移目前已完成 P1～P5 的可回退 shadow gate：各 25 張 deterministic 批次均在不寫入卡池的前提下確認 verified 契約可編譯，並以 `cardNumber` 保留 `@1` 異圖變體。Browser 驗收可用 `npm run cards:attest:browser` 或指定 batch report 檢查 card-check route 與公開 command trace；shadow migration 是契約驗證工具，不是另一批等待 promote 的卡牌資料。

卡牌效果驗收維持三層：先以 `test-state` 建立可重現的公開局面並跑 `GameCommand`／規則層回歸，再以相同 `test-state` 走正式 UI 的 Browser positive／blocked trace，最後用至少一條正式牌組或根路徑 smoke 確認開局、隨機抽牌、隱藏資訊與補位整合。前兩層共享正式卡牌 adapter、規則引擎與 UI command path，因此修正共享規則會套用正式對戰；fixture 本身只改測試局面，不能取代正式整合驗證。

牌組編輯器的 LV／HP／攻擊力篩選、BS3-061／BS6-101 可選昏厥技能、BS5／BS6 尖括號攻擊後代價稽核、BS6-044 固定攻擊目標追傷、效果傷害 FLIP 結算、陷阱來源／代價與攻擊後效果詳細步驟對戰紀錄，以及 BS5-073、BS4-024 的本輪 UI／規則回歸已完成；後續若官方卡文、卡圖或目標限制規則更新，需同步重跑牌組編輯器、攻擊目標選擇、昏厥效果與對戰紀錄的正向／負向 Browser 路徑，並覆核 BS6-016 的剩餘 HP 門檻與零傷害負向 trace。

BS6 已完成候選卡牌逐色逐卡 Browser 稽核、`promotion-ready` 審查與正式 promote；五色標準牌組已完成資料、固定 seed 矩陣與正式根路徑多場 Browser 驗證，五色各 20/20、合計 100/100 且卡死 0。BS5+6 競技環境五色 AI choice 已接入，BS6-020 的陷阱自身目標選擇也已納入回歸基線；512 副牌組 Swiss 已成為新的 AI 回歸基準，後續以其上位卡表進行 matchup-aware 迭代，並持續以真人對戰與官方賽事資料校準。

BS1～BS6 與 P 卡逐卡報告已納入回歸基線；2026-08-20 的正式卡牌路由、效果互動、全記錄負向與無效果攻擊矩陣均通過。BS5-060 另以專用 localhost-only end-phase fixture 補驗「攻擊支付後支援卡休息 → 結束回合最多 3 張啟動」，避免一般 `card:` fixture 因支援卡全為啟動而產生假陰性。後續官方卡文、卡圖或規則更新時，需同步重跑正向／負向 Browser 路徑，並維持正式卡池與報告逐色無缺卡、無重複。

後續引用社群判例時，需在 inventory／coverage 文件記錄 URL、查閱日期與官方對應依據，並保留差異待確認。

BS1～BS7 與 P 卡的資料、契約、規則回歸及本機 Browser 稽核均已納入正式回歸基線。BS7「Arena of Glory」143 筆資料已完成 runtime 轉接、143/143 卡面載入、143/143 strict contract、98/98 正向效果 Browser、143/143 負向 A/B Browser 與正式 promote；真人 5 人 Playtest、`0.10.0` 發布基線、相依套件升級與 Bundle Gate V2 是獨立的發布／長局品質工作，不回退已完成的 promote。

後續持續以專用 A/B test-state 稽核「支付代價後來源離場」的卡牌，確認終局、補位、OnPlay 與原效果續接都遵守同一套 pending decision 優先順序。

持續以桌機、平板與手機 viewport 實測主選單的欄位比例、開發者工具收合與牌組統計可讀性；平板橫向戰場已正式套用 mockup 版面，後續維持 1164×777 與其他短高度桌面尺寸的可讀性回歸，並維持合法與不合法牌組錯誤提示的 DOM 狀態一致。正式 Standard 已開放獨立 EXTRA 牌組，採現有禁限卡表；候選 staging 保留獨立入口，兩者共用獨立 `ExtraDeckCard`、`GameState.extraDeck` 與 Browser A/B，且 `card:BS8-005`／`card-negative:BS8-005` 會驗證登場條件、On Play 與攻擊後 Then；符合條件時 BattleRow 會高光 EXTRA 區並提供登場提醒，開啟玩家自己的 EXTRA Deck 會顯示卡圖、卡名與卡號，未符合時維持一般狀態。BS8-008 Blocker 的支付 UI 也已納入正向／負向 Browser 回歸。後續官方逐卡裁決或新卡更新時，仍須在此隔離流程完成規則、UI、匯入／匯出與線上遮罩驗收後，才評估是否擴充候選範圍。

持續以正式卡池驗證 BS3 條件效果的成立／不成立 UI 路徑，優先維持規則層條件判定、合法目標候選與效果面板顯示的一致性。

BS4 已完成效果轉接覆蓋稽核、候選嚴格驗證與正式卡池 promote；牌組編輯器已新增 BS4 系列選單並與 BS3 分流，條件卡成立／不成立專用情境、一般 fixture 實際 UI 互動、固定 seed benchmark、170 筆正式卡路由與 158 筆效果 Browser 稽核均已完成。BS4-038 基礎卡與兩個異圖變體、BS4-062 付款／支援／目標複合流程均已納入 Browser 回歸；後續維持同型卡牌在單機與好友房的候選分組一致。BS4 勝率排名仍只作為觀察資料，不作為正式環境強度定案。

BS5 已完成資料準備期與本批次 promote：`cards:import:bs5-candidate` 仍依 `BS5-*` 卡號前綴保留官方來源與異圖／促銷變體，`cards:analyze:bs5-candidate` 目前讀取正式 `data/cards/` 產生效果覆蓋盤點；111 張基礎卡的主效果、能力與攻擊 `Then` 均已轉接。牌組賽制已區分為標準（套用禁限卡）與開放（所有正式卡牌都能用）；後續 BS5 官方更新仍須重新走候選匯入、逐色稽核、測試與 Chrome 驗證，再提升為 `promotion-ready` 後 promote。

BS5 的 Browser 稽核目前已完成五色標準正式牌組各 2 場、共 10 場端到端實戰（完整走過開局、支付／攻擊、陷阱／FLIP、昏厥補位、OnPlay 與勝負結算），並確認 console 無 error／warning；完整結果見 [BS5 五色正式 Browser 實戰矩陣](docs/bs5-browser-formal-matrix-2026-08-07.md)。每色 40 場與逐卡自然抽牌覆蓋仍是後續稽核項目，不能以這 10 場取代。

下一步補做每色 40 場正式 Browser 矩陣，並將每張 BS5 卡牌的自然抽牌技能、攻擊後 `Then`、陷阱、物品、場景與不成立條件納入逐卡證據；攻擊後「When your turn ends」卡牌須額外推進至結束階段確認實際狀態變化。

持續以瀏覽器透過正式卡池測試對局設定驗證 BS3 卡牌在卡牌詳情、效果面板與戰鬥互動中的技能、攻擊後、物品、陷阱、場景與資源區效果，並維持規則引擎與 UI 的責任分離。

優先以實際本機與好友房對局檢視新版桌面戰場在多張手牌、單／雙戰鬥餅乾、能量不足與技能提示同時出現時的可讀性，持續確保場區外框不會與手牌或操作提示重疊。

BS3 已建立候選卡表盤點與可重複匯入流程，並完成 `PURE` 通用分類／特殊費用／Mix Cost 相容性、`Ancient`／`Soul Jam` runtime 追蹤與 `BS3-121` 的主動特殊勝利判定。攻擊後 `Then`、額外能力來源轉接與靈魂果醬裝載家族已有 runtime；BS3-115 保護已依官方 Q&A 補齊 `attackTargetOnly` 例外、全場／棄置路徑排除，以及無合法目標時能力 Then 整段中止。`reveal-top-deck` 已從靜默執行改為兩階段流程（展示 → 確認 → 執行），巢狀效果含目標選擇時正確暫停於 `pendingAbilityEffect`，UI 與 AI 均可正常選取目標。BS3 已完成 promote；後續以正式卡池驗證、規則回歸與官方更新追蹤為主。

P-0XX 官方全量 153 筆（含異圖變體）均已完成資料／adapter 轉換並 promote 至正式卡池；正式路由 153／153、效果互動 138／138、負向 153／153、無效果攻擊 15／15 均通過。P-015／P-016 多段規則、P-082 主支付／替代支付、P-084 met／unmet 動態費用、P-147 Special Play＋On Play，以及 P-099／P-100 FLIP 正規化皆有 runtime、UI 或專用 Browser／回歸證據；目前沒有 P 卡候選資料待 promote。

待辦事項與優先序統一維護於 [docs/roadmap.md](docs/roadmap.md)（依 P0–P3 分類，含每項的完成狀態與前置條件）；WebSocket 入站驗證、玩家名稱、攻擊選取預覽、開局整合、導引式效果操作、對戰中指令拒絕提示、公開互動意圖與 P0–P2 對戰可視化第一版已完成，並補上 ST3-019、BS2-021、BS2-044、BS1-007 攻擊支付與 BS1-037 攻擊後效果的提示框回歸。下一步是以真人好友房驗證攻擊箭頭、卡牌預覽、活動紀錄與回應狀態在 BS2-069、OnPlay、陷阱／FLIP／物品／場景多段決策中的文案與高光邊界，並覆核 600×338 窄畫面下的手牌可讀性；伺服器期限目前只提供顯示，不自動替玩家作決策。R5 已建立語意驗證與官方更新回歸防線，但仍須在新卡或新版規則進入時擴充契約。近期應以 Vercel Preview 完成 1–2 場真人好友房試玩，特別確認開局節奏、ST5-007／ST5-022 的雙方提示、窄畫面可讀性與 Render 冷啟動後的完整流程，再稽核 GitHub Actions／Vercel／Render 健康。已知風險與緩解狀態見 [docs/known-risks.md](docs/known-risks.md)。

## 開發指令

| 指令 | 用途 |
|---|---|
| `npm install` | 安裝相依套件 |
| `npm run dev` | 啟動開發伺服器（Vite HMR） |
| `npm run check:bundle` | 檢查 dist/assets/index-*.js 的 raw/gzip bundle budget，預設上限 850/180 KiB，執行前需先 `npm run build` |

## 驗證指令

```bash
npm run validate:cards
npm run validate:candidate
npm run cards:audit:contracts
npm run generate:card-pool
npm run check:card-pool
npm run benchmark:bs6-competitive:round-robin
npm test
npm run lint
npm run typecheck
npm run build
```

`validate:cards` 檢查 `data/cards/*.json` 的必填欄位、同檔重複卡號、全卡池可轉換為 `GameCard` 與效果文字未轉出偵測；CI 會在測試前先執行。`validate:candidate` 檢查 `data/candidates/*.json` 的候選卡牌資料，包含 schemaVersion、source 結構、欄位型別、卡牌轉換與正式卡池跨檔重複檢查。`generate:card-pool` 重新生成 `src/game/generated-card-pool.ts`（promote 後會自動執行）。`typecheck` 對 app 與 server 做全量型別檢查（`tsc -b` + server tsconfig）。

瀏覽器驗證（皆需先 `npm run build`）：

```bash
npm run test:ai:browser      # AI 對局多解析度 smoke test
npm run test:browser:smoke   # PR gate：AI＋牌組編輯器＋好友房核心 smoke
npm run test:deployment:browser # 外部 Preview／Production URL 與 Render WebSocket 驗收
npm run test:bs4:cards:browser # BS4 111 張 Chrome card-check 載入 gate
npm run test:bs4:interaction:browser # BS4 條件卡與一般 fixture 實際互動
npm run test:bs6:decks:browser # BS6 五色牌組主選單開局與每色 20 場 Browser AI 驗證
npm run test:bs6:competitive:decks:browser # BS6 五色競技環境牌組 Browser AI 驗證
npm run test:deck:browser    # 牌組編輯器正式 EXTRA、候選隔離、匯入／儲存與 RWD smoke test
npm run test:blue:browser    # 藍牌效果使用/付款/目標/決策流程
npm run test:online:browser  # 線上對戰 modal 桌機／窄視窗驗證
npm run test:online:match:browser # 本機雙瀏覽器好友房猜拳、順位、依序調度、起始餅乾揭示、對戰動態、階段同步、拒絕提示、斷線與連線失敗驗證
npm run test:bs8:effects:browser # 正式 BS8 主效果 146／146 正向 Browser gate
npm run test:bs8:effects:negative:browser # 正式 BS8 主效果 156／156 負向 Browser A/B
npm run test:bs8:abilities:browser # 正式 BS8：54 張能力的獨立技能表面 Browser A/B（含 14 個 Then）
npm run test:bs8-005:browser # BS8-005 EXTRA Avatar of Ruin staging 登場／On Play／攻擊後 Then A/B
npm run test:bs8:extra-deck:browser # BS8 五張 EXTRA 登場條件正向／負向 Browser A/B
npm run test:bs8:076:browser # BS8-076：對手 Active Phase 棄 0／恰好 2 張的 Browser A/B
npm run ai:audit:capabilities # 正式 runtime 卡池的 AI capability strict gate
npm run benchmark:ai:challenger -- --seeds=10 --seed-start=401 # Lv.5/Lv.4 五色雙邊換位 gate
npm run benchmark:ai:challenger -- --corpus=full --matchups=both --seeds=2 --seed-start=501 # 46 副全 corpus、mirror＋輪替跨牌組 gate
```

若 Playwright 安裝於外部目錄，可用 `PLAYWRIGHT_NODE_MODULES` 指定其 `node_modules` 路徑。測試報告與截圖會輸出到 `test-results/`，不得提交。詳細驗證分級見 [.agents/skills/braverse-workflow/references/verification-levels.md](.agents/skills/braverse-workflow/references/verification-levels.md)。

## 卡牌資料匯入

```bash
npm run cards:import:sample
npm run cards:import:red-sample
npm run cards:import:yellow-sample
npm run cards:import:green-sample
npm run cards:import:blue-sample
npm run cards:import:purple-sample
npm run cards:import:bs3-candidate
npm run cards:analyze:bs3-candidate
```

`cards:import:sample` 目前預設匯入綠色起始牌組；紅色、黃色、綠色、藍色與紫色也可使用明確腳本重新產生。`cards:import:bs3-candidate` 會將官方英文資料中所有 `BS3-*` 記錄輸出為不可 promote 的候選快照，並生成 [BS3 卡表盤點](docs/bs3-card-inventory.md)；接著以 `cards:analyze:bs3-candidate` 產生 [效果轉接覆蓋盤點](docs/bs3-effect-coverage.md)。候選快照是匯入流程的中間產物，正式 BS3 狀態以 `data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json` 為準。新卡牌／新彈的完整匯入流程見 [docs/card-update-process.md](docs/card-update-process.md)。

BS4 已完成首次 promote；正式資料以 `data/cards/official-age-of-heroes-and-kingdoms-bs4.en.json` 為準，效果覆蓋報表由 `cards:analyze:bs4-candidate` 依正式檔案產生。

BS5 本批次已完成 runtime 轉接、效果稽核與正式 promote；正式資料以 `data/cards/official-age-of-heroes-and-kingdoms-bs5.en.json` 為準，覆蓋報表由 `cards:analyze:bs5-candidate` 依正式檔案產生。後續官方更新仍先輸出至 `data/candidates/`，完成陷阱／攻擊後 `Then` 的效果稽核、測試與 Chrome 實戰驗證後，才可改為 `promotion-ready` 並 promote。

BS10 已完成候選匯入、轉接盤點、逐卡 Browser、正式 promote 與完整牌組／線上驗證；正式資料以 `data/cards/official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json` 為準，盤點可用 `npm run cards:analyze:bs10-candidate` 重建。

## 變更記錄

目前發布版本 **`0.10.0`**（2026-09-14，git tag `0.10.0`）。完整變更記錄見 [CHANGELOG.md](CHANGELOG.md#0100---2026-09-14)；發布與 PR 流程見 [docs/release-process.md](docs/release-process.md)。

| 日期 | 概要 |
| --- | --- |
| 2026-10-18 | PR #125 後續修正社群起始牌組名稱／EXTRA 遺漏與 BS12 預設牌組 storage 寫入例外；45 項定向回歸及完整 Vitest 1,067 檔／21,302 項、typecheck、lint、build 通過，PR #126 Browser Smoke／Gate 通過，CI 待完成。 |
| 2026-10-04 | 091／091@1雙尺寸188案、專項123項／受影響24檔667項、build／lint／strict2／2及AI／ST1核心同步通過；Chrome新目標正例／同名排除反例、16案可見紀錄與共用48案另列。一般6,994、cursor092／092@1、剩21基礎／32印刷。最新完整700檔／11,138項屬091前版本，本批全套留093；裁定留112全部印刷後，未promote。 |
| 2026-10-04 | 090／090@1雙尺寸180案、91項專項與16檔／505項回歸通過。紫色且Arena手牌Blocker及免費昏厥四Blocker門檻／0～1己方休息區LV1移棄牌分開，Chrome正反及八案可見紀錄已驗；共用088／089共32案另列。088～090完整Vitest700檔／11,138項（809.98秒）、build／lint／strict2／2、AI／ST1核心同步及1,344凍結雜湊通過。一般6,806、cursor091／091@1、剩22基礎／34印刷，091～093卡面已備；裁定留112全部印刷後，未promote。 |
| 2026-10-03 | 087雙尺寸68案、新增83項與14檔／514項回歸通過，cursor088／088@1、候選一般累計6,270。PP、本回合對手-2與十張Arena棄牌同一目標追加-1、九張加來源達門檻、選零／取消與非法付款已驗；公開紀錄六案及共用28案另列。085～087批末完整Vitest691檔／10,795項（726.24秒）、AI Browser／ST1核心同步及1,343凍結來源全部通過。088～090六印刷卡面已備；裁定留112全部印刷後，未promote。 |
| 2026-10-03 | 085雙尺寸50案與388項回歸通過，cursor086、候選一般累計6,148；共用083十六案另列。P1、五張Blocker Cookie門檻、DJ追加棄牌後判斷及全部一般棄牌連來源道具洗回已驗。最新完整685檔／10,592項（767.28秒）屬085修改前的084批末，085～087全套留087批末。裁定留112全部印刷後，未promote。 |
| 2026-10-03 | 086雙尺寸54案與18檔／512項回歸通過，cursor087、候選一般累計6,202；共用027十六案另列。P1、0～1己方印刷Blocker+2至自己下回合結束、跨回合攻擊及到期、選零與取消已驗；AI Browser／ST1核心同步通過。最新完整685檔／10,592項仍屬085修改前084批末，本批全套留087批末。裁定留112全部印刷後，未promote。 |
| 2026-10-03 | 083雙尺寸52案與370項回歸通過，當時cursor084、候選一般累計6,030；共用082八案另列。679檔／10,466項屬082手牌門檻補修及083前版本。 |
| 2026-10-02 | BS12候選累計3,756，055兩印刷雙尺寸136案與支援登場來源限制、兩項棄牌代價及0／1支援選擇通過；完整612檔／8,367項通過。cursor056，裁定待112含各印刷完成後統一提報，未promote。 |
| 2026-10-01 | BS12候選完成至031、Browser1,760案；032／032@1Arena直接代價88案、普通攻擊36案、預置待命UI52案分列，原網址崩潰與抽牌等待修復；當日完整Vitest555檔／7,211項通過。昏厥觸發待裁定，cursor032／032@1。 |
| 2026-09-30 | BS12候選001～013含異圖Browser426案，013同目標增傷與活躍、012反例補驗及完整Vitest511檔／6,041項通過；007依使用者裁定HP棄牌／不補位；BS11六色1024副賽事黑色#062奪冠。 |
| 2026-09-29 | 核對 BS11 官方 booster／跨產品範圍，修正 EXTRA generic test-state 分區及 BS11-092 Special Play 見證；整理 159 筆逐筆效果文字與 116 張轉接覆蓋連結。 |
| 2026-09-28 | BS11 159 筆官方資料 promote 至正式卡池；19 檔／1,923 筆／1,881 converted，strict 159／159、攻擊 Then 27／27。完成局部 Browser A/B、牌組編輯器四尺寸、正式 AI 對局及雙瀏覽器 BS11 線上全對局（157 命令／16 次付款攻擊／雙端結果一致），完整 Vitest 481 檔／5,715 項（537.51 秒）、build；全域 lint 仍有 4 個無關既有錯誤。正式 CDN 直連及線上逐卡技能矩陣仍未驗。 |
| 2026-09-27 | BS11-040～058 candidate Browser：040 加入後 simple FLIP 60／60；041～044 共 16／16、045～049 含 replacement 共 26／26、050～053 base／@1 兩尺寸共 40／40、054～058 新增 24／24（另重用 057 FLIP 4／4）。修正 048 Then 條件來源、050／053 self-trash／公開 trace 與 056／058 negative route precedence；完整 Vitest 441／5,565（522.12 秒）、build、scoped lint 通過。候選仍 inventory，圖資及正式／online 驗收仍有缺口。 |
| 2026-09-23 | BS11-003／005／019／020／039 simple FLIP candidate Browser 補驗：Luna 擴充共用 route／fixture，Astra 以 1280×720／1164×777 對五張卡各完成 positive／negative，新增 20 條路徑，累計 simple FLIP 56／56；確認 003／020 抽最多 1 張、005／019／039 棄 1 張後附著 Cookie +1 HP、負向代價不足／不發動與官方圖 URL／alt 或命名 fallback／公開 trace。strict 159／0／0，主效果 93／23／0、能力 93／0、攻擊 Then 27／27；完整 Vitest 437／5,524（480.81 秒）、build、candidate validation、coverage analyzer、scoped lint 通過。候選仍 inventory，正式牌組／formal battle／online／promote 未完成。 |
| 2026-09-23 | BS11-057／059／075／076 BLUE／PURPLE FLIP candidate Browser 補驗：Luna 擴充既有 simple FLIP route／fixture，Astra 以 1280×720／1164×777 對四張卡各完成 positive／negative，新增 16 條路徑；實際確認 057／075 抽最多 1 張、059／076 棄 1 張後附著 Cookie +1 HP、負向代價不足／不發動與官方圖 URL／alt 或命名 fallback；累計 simple FLIP 36／36，完整 Vitest 437／5,519、build、scoped lint 通過。候選仍 inventory，正式牌組／formal battle／online／promote 未完成。 |
| 2026-09-23 | BS11-093／095／096／100／101 完成 Luna BLACK FLIP route／fixture；Astra 以 1280×720／1164×777 對五張卡各完成 positive／negative，共 20 條 localhost Browser 路徑，實際核對攻擊後 FLIP、棄牌補 HP、抽牌、負向代價阻擋／不發動、官方圖 URL／alt 或命名 fallback 與公開 trace；strict 159／0／0，主效果 93／23／0、能力 93／0、攻擊 Then 27／27；完整 Vitest 437／5,515、build、scoped lint 通過。候選仍 inventory，正式牌組／formal battle／online／promote 未完成。 |
| 2026-09-23 | BS11-016／016@1 完成 Luna 跨 Cookie HP 核心、exact adapter、UI／candidate fixture；Astra 以 1280×720／1164×777 完成 base／@1 正／負共 8 條 localhost Browser 路徑，strict 159／159 verified，主效果 93／23／0、能力 93／0、攻擊 Then 27／27；完整 Vitest 436／5,510、build、scoped lint 通過。候選仍 inventory，正式牌組／formal battle／online／promote 未完成。 |
| 2026-09-23 | BS11-084～087 inventory-only Browser 輕度驗收：Luna 完成 route／fixture 與 1 檔／6 項回歸，Astra 以本地 Playwright 在 1280×720／1164×777 對 084、085／085@1、086／086@1、087／087@1 各完成 positive／negative，共 28 條路徑；核對 Trap 付款／目標、Refresh 抽 1、trash-to-battle、trash-origin +2 HP 與 Ancient 條件隨機棄手，官方圖資受本機網路限制時保留命名 fallback。候選仍 inventory，未宣稱正式牌組／formal battle／online／promote。 |
| 2026-09-23 | BS11-111～113 Special Play／On Play Browser 補驗：Astra 以本地 Playwright 對 111／111@1／112／112@1／113／113@1 在 1280×720／1164×777 各完成 positive／negative，共 24 條路徑；確認共同黑色 LV.1 代價、111 傷害、112 回收、113 抽 2 張與負向門檻阻擋，核對公開 command trace；未宣稱正式牌組／formal battle／online／promote。 |
| 2026-09-23 | BS11-088／088@1／105 attack Then Browser 補驗：Astra 以本地 Playwright 在 1280×720／1164×777 對三筆記錄各完成 positive／negative，共 12 條已支付攻擊後 continuation 路徑；正向目標 HP 6→5、負向維持 6，088@1 使用 base card id 的 contract trace，圖資受網路限制時保留命名 fallback；未宣稱完整支付、正式牌組／formal battle／online／promote。 |
| 2026-09-23 | BS11-106／107／110 條件 Browser 補驗：Astra 以本地 Playwright 在 1280×720／1164×777 對三張卡各完成 positive／negative，共 12 條路徑；確認 106 的 0K／1K 陷阱支付、107 的 2K／2 傷害與反向使用阻擋、110 的同一目標 base 6→4／6→5 攻擊修正，DOM 核對官方圖 URL／alt；未宣稱正式牌組／formal battle／online／promote。 |
| 2026-09-23 | BS11-097～099 Special Play localhost Browser：Astra 以本地 Playwright 在 1280×720／1164×777 對三張卡各完成 positive／negative，共 12 條路徑；確認 097／098 的黑色支付與效果目標、099 的 source-only 自我送 trash、官方卡圖與 command trace，負向均阻擋缺少 Special Play Cookie 門檻；未宣稱正式牌組／formal battle／online／promote。 |
| 2026-09-23 | BS11-103／104／109 牌庫／棄牌區 Browser：Astra 以本地 Playwright 在 1280×720／1164×777 對三張卡各完成 positive／negative，共 12 條路徑；確認 103 登場手牌門檻、104 昏厥後黑色選牌、109 黑色支付後 Special Play 選牌與負向 no-op／阻擋，DOM 核對官方圖 URL／alt；未宣稱外部圖檔載入、正式牌組／formal battle／online／promote。 |
| 2026-09-23 | BS11-090／091 White Lily → Avatar localhost Browser：Astra 以本地 Playwright 在 1280×720／1164×777 各驗證 positive／negative，確認自我昏厥、EXTRA 選擇、Avatar 8 HP、官方卡圖與非主要階段阻擋；未宣稱正式牌組／formal battle／online／promote。 |
| 2026-09-23 | BS11-116 Awaken localhost Browser recheck：Luna 保留 inventory-only fixture，Astra 以本地 Playwright 在 1280×720／1164×777 各驗證 positive／negative，確認官方卡圖、EXTRA readiness、`play-extra-deck-cookie` trace 與條件不成立時的登場阻擋；未宣稱正式牌組／formal battle／online／promote。 |
| 2026-09-23 | BS11 contract gate 收斂：Luna 補上 033／034／090／116 的 shadow ledger 證據，修正 071 巢狀 EXTRA timing 與 080 curly apostrophe target 解析；Astra 輕度驗收確認 BS11 strict 157／2／0、候選仍 inventory／converted=0，5 檔／73 項 focused、完整 Vitest 423／5,433、build／scoped lint 通過。BS11-016／016@1 的跨 Cookie HP 支付仍維持 needs-review，未新增 Browser／正式／online／promote 證據。 |
| 2026-09-23 | BS11 第三十七批 BS11-047 Dumpling Censer 完成 Luna exact item／replacement adapter：保留 `{G}`＋支援回手啟動代價，建立本回合對手 Cookie On Play 的 `{N}`＋由該 Cookie 控制者回手支援卡 replacement；Astra 以官方卡圖、2 檔／4 項 contract／runtime 與既有 replacement 回歸輕度驗收，正向走過兩段付款與正確所有權回手，負向確認缺少啟動代價卡阻擋，另以 inventory-only localhost test-state 實際走過正向付款／replacement 註冊與負向付款阻擋。新增 3 檔／6 項 demo fixture 回歸、candidate validation／coverage analyzer、scoped lint、build 與完整 Vitest 423 檔／5,426 項（533.67 秒）通過；候選仍 inventory／converted=0，主效果 92／23／1、能力 92／1、strict 144／15／0，尚未完成完整 Browser A/B、正式牌組／online／promote；BS11-016 跨 Cookie HP 合計代價仍需核心協定確認。 |
| 2026-09-23 | BS11 第三十六批 BS11-095／102 完成 Luna 轉接：095 Matcha Cookie 接入與 100 共用的免費抽最多 1 張 BLACK FLIP，102 Cake Warrior 保留無技能 BLACK MIX vanilla Cookie 與 `{N}{N}` 普通攻擊；Astra 以兩張官方卡圖、2 檔／4 項 source／adapter／runtime 輕度驗收，實際走過 095 攻擊後 FLIP 抽牌 pending 與 102 vanilla conversion。candidate validation／coverage analyzer、scoped lint、build 與完整 Vitest 420 檔／5,420 項（582.26 秒）通過；候選仍 inventory／converted=0，主效果 91／23／2、能力 91／2、strict 143／16／0，尚未完成 Browser A/B、正式牌組／online／promote。 |
| 2026-09-23 | BS11 第三十五批 BS11-093／096／100／101 完成 Luna exact FLIP adapter：093／096／101 棄 1 張手牌後讓附著 Cookie 增加 1 HP，100 無代價抽最多 1 張；Astra 以四張官方卡圖、2 檔／14 項 contract／runtime 正反輕度驗收，實際走過攻擊後 FLIP、合法／缺少代價、補 HP 與抽牌 pending。candidate validation／coverage analyzer、scoped lint、build 與完整 Vitest 418 檔／5,416 項（582.54 秒）通過；候選仍 inventory／converted=0，主效果 91／23／2、能力 91／2、strict 143／16／0，尚未完成 Browser A/B、正式牌組／online／promote。 |
| 2026-09-23 | BS11 第三十四批 BS11-092 由 Luna 完成 Licorice Cookie 的 Activate／Once Per Turn 有效 LV.1 覆寫：以 `levelOverride`／`getCookieEffectiveLevel` 接入目標、戰鬥、技能代價、AI、PlayerView 與 UI，回合切換清除覆寫並保留印刷 LV.2。Astra 以官方卡圖、2 檔／4 項 contract／runtime 正反輕度驗收；candidate validation／coverage analyzer、scoped lint、build 與完整 Vitest 416 檔／5,402 項（579.17 秒）通過；候選仍 inventory／converted=0，主效果 91／23／2、能力 91／2、strict 143／16／0，尚未完成 Browser A/B、正式牌組／online／promote。 |
| 2026-09-23 | BS11 第三十三批 BS11-108（base／@1）由 Luna 完成 Dark Enchantress's Castle 的黑色放置、休息自身、Special Play 回合旗標與抽 1／棄 1 Stage 效果；Astra 以官方卡圖、2 檔／4 項 contract／runtime 正反輕度驗收，確認普通登場不建立條件且 Special Play 路徑會續接既有補位／pending。candidate validation／coverage analyzer、scoped lint、build 與完整 Vitest 414 檔／5,398 項（579.41 秒）通過；候選仍 inventory／converted=0，主效果 90／23／3、能力 90／3、strict 142／17／0，尚未完成 Browser A/B、正式牌組／online／promote。 |
| 2026-09-23 | BS11 第三十二批 BS11-094 由 Luna 完成 exact Blocker adapter，沿用既有黑色付款與 source-only redirect；Astra 以官方卡圖、2 檔／4 項 contract／runtime 正反輕度驗收。candidate validation／coverage analyzer、scoped lint、build 與完整 Vitest 412 檔／5,394 項（590.24 秒）通過；候選仍 inventory／converted=0，strict 140／19／0，尚未完成 Browser A/B、正式牌組／online／promote。 |
| 2026-09-23 | BS11 第三十一批 BS11-088／105 完成 Luna attack Then exact adapter：088（含 base／@1）依對手棄牌區至少 15 張追加 1 傷害，105 依己方戰鬥區 Special Play Cookie 追加 1 傷害；Astra 以三張官方卡圖、contract 與 2 檔／7 項 focused 正反 runtime 輕度驗收，3 張指定色攻擊付款與主傷害後結算通過。candidate validation／coverage analyzer、scoped lint、build 與完整 Vitest 410 檔／5,390 項（571.15 秒）通過。候選仍 inventory／converted=0，attack Then 27／27、strict 140／19／0；尚未完成 Browser A/B、正式牌組／online／promote。 |
| 2026-09-23 | BS11 第三十批 BS11-103／104／109 完成 Luna core／adapter：103 手牌至多 5 張時回收棄牌區 Special Play Cookie，104 昏厥後檢視 3 張選黑色卡，109 以 1 黑檢視 5 張選 Special Play Cookie；補上棄牌／牌庫共同篩選、UI／AI／decision path 與正反 runtime。Astra 以官方卡圖、contract 與 2 檔／6 項 focused 輕度驗收；candidate validation／coverage analyzer、scoped lint、build 與完整 Vitest 408 檔／5,383 項（571.75 秒）通過。候選仍 inventory／converted=0，strict 137／22／0；尚未完成 Browser A/B、正式牌組／online／promote。 |
| 2026-09-23 | BS11 第二十九批 BS11-106／107／110 完成 Luna core／adapter：106 依己方 LV.5+ 或具 Special Play Cookie 降低陷阱費用，107 依己方戰鬥區 Cookie 等級合計至少 5 造成 2 傷害，110 對同一目標以 Then 追加第二次 -1 攻擊。Astra 以官方卡圖與 runtime 正／負條件輕度驗收；2 檔／5 項 focused、candidate validation、coverage analyzer、完整 Vitest 406 檔／5,377 項（569.93 秒）、build／scoped lint 通過。候選仍 inventory／converted=0，strict 134／25／0；本批尚未完成 Browser A/B、正式牌組／online／promote。 |
| 2026-09-23 | BS11 第二十八批 BS11-116 完成 Luna core／adapter／Awaken 條件：Break Area LV.7、Dark Enchantress's Castle、同回合具 Special Play 的 LV.3 Dark Enchantress，並接入 `awakenHpBonus: 2`、被動 `sourceOnly` 移動防止與 `requiresSpecialPlay` 目標契約。Astra 以官方 base／@1 卡圖及 localhost test-state 正負路徑輕度驗收：正向實際從 EXTRA Deck Awaken、顯示覺醒前與 HP+2，負向顯示條件不成立。3 檔／7 項 focused、candidate validation、coverage analyzer、完整 Vitest 404 檔／5,372 項（650.99 秒）、build／scoped lint 通過；候選仍 inventory／converted=0，strict 134／25／0，正式牌組／完整 Browser A/B／online／promote 尚待驗證。 |
| 2026-09-22 | BS11 第二十七批 BS11-115 完成 Luna core／adapter／command／UI：Special Play 嚴格多選 2 張黑色 LV.2 且具 Special Play 的 Cookie，滿戰鬥區時於代價支付後檢查容量；On Play 支援區門檻全體傷害與攻擊 Then 2 黑色能量付款接線完成。Astra 輕度驗收以 localhost test-state 通過正向 1→2 張選牌狀態、確認與技能代價等待，以及負向不足合法代價不顯示入口；另修正滿戰鬥區 hand action 不顯示的 UI 缺口。2 檔／11 項 focused、BattleRow 1 檔／70 項、candidate validation、coverage analyzer、完整 Vitest 401 檔／5,365 項（649.06 秒）、build／scoped lint 通過。候選仍 inventory／converted=0，strict 134／23／2；正式牌組／完整 Browser A/B／online／promote 尚待驗證。 |
| 2026-09-22 | BS11 第二十六批 BS11-114 完成 Luna core／adapter：On Play 棄 1 張黑色手牌後手牌至多 5 張時抽最多 2 張，攻擊 Then 棄 1 張手牌後回收指定 Dark Enchantress Cookie；Astra 輕度驗收確認黑色支付、手牌門檻、指定卡名與可選回收。2 檔／7 項 focused、candidate validation、coverage analyzer、完整 Vitest 399 檔／5,353 項、build／scoped lint 通過。候選仍 inventory／converted=0，strict 130／27／2；Browser／正式／online／promote 尚待驗證。115 的雙 Cookie Special Play 代價保留 needs-review。 |
| 2026-09-22 | BS11 第二十五批 BS11-111～113 完成 Luna core／adapter：三張共用黑色 LV.1 Cookie Special Play 代價，111 On Play 傷害、112 棄牌區黑色 Cookie 回收與 LV.2+ On Play 封鎖、113 手牌門檻抽牌與攻擊後 +1 HP；Astra 輕度驗收確認 Special Play／On Play／攻擊 Then／逐回合限等級封鎖邊界。2 檔／14 項 focused、candidate validation、coverage analyzer、完整 Vitest 397 檔／5,346 項、build／scoped lint 通過。候選仍 inventory／converted=0，strict 128／29／2；Browser／正式／online／promote 尚待驗證。 |
| 2026-09-22 | BS11 第二十四批 BS11-097～099 完成 Luna core／adapter：共用 Special Play Cookie 條件、097 的 1K＋棄牌與 LV.1／無 Skill 昏厥、098 的 1K 傷害、099 的 source-only 自我送 trash；Astra 輕度驗收確認 payment／target／condition。2 檔／10 項 focused、candidate validation、coverage analyzer、完整 Vitest 395 檔／5,332 項、build／scoped lint 通過。候選仍 inventory／converted=0，strict 124／33／2；Browser／正式／online／promote 尚待驗證。 |
| 2026-09-22 | BS11 第二十三批 BS11-090～091 完成 Luna core／adapter：090 自我昏厥後忽略條件登場 Avatar of Destiny 並增加 3 HP，091 固定雙方 Break Area／手牌門檻的 enter-battle EXTRA；Astra 輕度驗收確認 pending／命令／UI／AI 接線與 8 HP Refresh 續接。2 檔／10 項 focused、5 檔／90 項受影響回歸、完整 Vitest 393 檔／5,322 項、build／scoped lint通過。候選仍 inventory／converted=0，strict 122／35／2；Browser／正式／online／promote 尚待驗證。 |
| 2026-09-22 | BS11 第二十二批 BS11-089 完成 Luna core／adapter：自動磨牌 3 張技能成本、抽最多 2 張後棄 1 張、Refresh 後 +1 HP 與攻擊後對手全體逐一 1 傷害；Astra 輕度驗收確認成本／Refresh continuation／結算時條件重檢。2 檔／9 項 focused、14 檔／652 項共享回歸、candidate validation、coverage analyzer、完整 Vitest 391 檔／5,312 項、build／scoped lint 通過。候選仍 inventory／converted=0，strict 122／35／2；Browser／正式／online／promote 尚待驗證。 |
| 2026-09-22 | BS11 第二十一批 BS11-084～088 完成 Luna core／adapter、Refresh／trash-origin／Ancient／LV 目標與 On Play 代價語意；Astra 輕度驗收指出並修正 087 的 trash-origin +2 HP、088 的 LV.1 代價不可重複成效果，以及既有「from the trash」文案相容性。2 檔／11 項 focused、11 檔／577 項共享回歸、candidate validation、coverage analyzer、完整 Vitest 389 檔／5,303 項、build／scoped lint 通過。候選仍 inventory／converted=0，strict 119／38／2；Browser／正式／online／promote 尚待驗證。 |
| 2026-09-22 | BS11 第二十批 BS11-079～083 完成 Luna core／adapter、Refresh 次數條件、雙方棄牌區回牌庫、Moonlight／Ancient 條件陷阱與 Refresh 後 On Play replacement；Astra 輕度驗收確認 080／081／082@1／083 的條件與來源邊界，補上 2 檔／17 項 focused、9 檔／566 項共享回歸、完整 Vitest 387 檔／5,292 項、build／scoped lint。候選仍 inventory／converted=0，strict 113／44／2；Browser／正式／online／promote 尚待驗證。 |
| 2026-09-22 | BS11 第十九批 BS11-074～078 完成 Luna core／adapter、指定卡名被動攻擊光環與 image-backed 077 skill fallback；Astra 輕度驗收確認 077 raw API 空技能文字與 078 15 張門檻／1P／對手 Cookie 最上方 HP Then。2 檔／9 項 focused、6 檔／505 項共享回歸、coverage analyzer 3 項、完整 Vitest 385 檔／5,275 項、build／scoped lint 通過。候選仍 inventory／converted=0，strict 110／47／2；Browser／正式／online／promote 尚待驗證。 |
| 2026-09-22 | BS11 第十八批 BS11-069～073 完成 Luna core／adapter、主代理補上 071 EXTRA 技能二選一的 pending／commands／移牌／On Play／Activate 續接，以及 UI／AI／公開描述接線；Astra 指出 070 正確成本為 `{B}{N}{N}` 與 071 初版必要選擇／移牌／技能續接缺口。2 檔／13 項 focused、9 檔／191 項共享回歸、完整 Vitest 383 檔／5,265 項、build／scoped lint 通過。候選仍 inventory／converted=0，strict 109／48／2；Browser／正式／online／promote 尚待驗證。 |
| 2026-09-22 | BS11 第十七批 BS11-064～068 完成 Luna core／adapter、主代理補上 064 On Play replacement（本回合 1N 抽最多1）、本地／線上付款面板與 AI 接線，以及 068 最後 HP 昏厥／departure／裝備／Timekeeper 邊界；2 檔／18 項 focused、7 檔／176 項共享回歸、hooks 67 項、AI 23 項、完整 Vitest 381 檔／5,252 項、build／scoped lint通過。候選仍 inventory／converted=0，strict 105／52／2；Browser／正式／online／promote 尚待驗證，047 另一種替代效果與 016／116 資料缺口維持未完成。 |
| 2026-09-22 | BS11 第十六批 BS11-059～063（含 063@1）完成 Luna core／adapter、主代理補上 `field-to-deck-bottom.hpOnly` 執行分支與 2 檔／16 項 focused 回歸；059 FLIP 附著 Cookie +1 HP、060 BLUE MIX 任意支付、061 2B／HP 頂牌移牌庫底／Once Per Turn、062 2B Stage 手牌檢視、063／063@1 陷阱減傷與 Sea Fairy／Ancient 條件抽牌均接入。Astra 輕度驗收未見明確 blocker，但 062 官方圖 URL 404、Browser／正式／online 尚待補。候選仍 inventory／converted=0，主效果65／24／27、攻擊 Then 14／27、strict 99／58／2；candidate validation、coverage analyzer、5 檔／401 項回歸、build、scoped lint與完整 Vitest 379 檔／5,234 項通過。 |
| 2026-09-22 | BS11 第十五批 BS11-054～058 完成 Luna core／adapter、主代理靜態／runtime 2 檔／14 項 focused 回歸；054 接入期限內攻擊前棄 2、056 指定 Cream Soda／Once Per Turn、057 FLIP 抽牌、058 opponent-attack／棄 2／選 0～1／+1 HP。候選仍 inventory／converted=0，主效果63／24／29、攻擊 Then 14／27、strict 97／60／2；candidate validation、build、scoped lint通過，完整 Vitest 377 檔／5,218 項有 1 項既有 AI Level4 預設 timeout，Browser／正式／online 尚待驗證。 |
| 2026-09-22 | BS11 第十四批 BS11-050～053（含 @1）完成 Luna core／adapter、主代理靜態／runtime 2 檔／15 項 focused 回歸；新增 `HpToTrashAllEffect.target` 以保留 053 的 HP≥5 門檻與無 target 舊行為，並修正 050／053 self-trash 為可略過 Then 代價。候選仍 inventory／converted=0，主效果61／24／31、攻擊 Then 14／27、strict 95／62／2；candidate validation、build、scoped lint 與完整 Vitest 375 檔／5,204 項通過，Browser／正式／online 尚待驗證。 |
| 2026-09-22 | BS11 第十三批 BS11-045～049 完成可安全轉接的 adapter 與 2 檔／11 項 focused 測試；Astra 確認來源／映射／測試一致、047 維持 unsupported、048 的 1N pending 層級正確，並指出 048@1 獨立 runtime identity 與取消／略過／錯色／完整目標邊界仍待補。候選仍 inventory／converted=0，主效果60／24／32、攻擊 Then 10／27、strict 87／70／2；完整 Vitest 373 檔／5,189 項（588.06 秒）通過，Browser／正式與 online 尚未驗證。 |
| 2026-09-22 | BS11 第十二批 BS11-040～044 完成 adapter 與 11 項 runtime；Astra 確認來源／映射與 focused 測試，候選維持 inventory／converted=0，22 檔／424 項 targeted、完整 Vitest 371 檔／5,178 項（503.14 秒）、主效果58／24／34、攻擊 Then 10／27、strict 83／74／2；Browser／正式與 online 尚未驗證。 |
| 2026-09-22 | BS11 第十一批 BS11-036～039 完成 Luna 靜態／核心轉接，Astra 確認 9 項 runtime 與支付／條件／Once Per Turn 邊界；候選維持 inventory／converted=0，20 檔／413 項 targeted、完整 Vitest 369 檔／5,167 項（487.69 秒）、主效果56／24／36、攻擊 Then 10／27、strict 81／76／2；Browser／正式與 online 尚未驗證。 |
| 2026-09-22 | BS11 第十批 BS11-032～035 完成 Luna 靜態／核心轉接，Astra 指出並修正 032 精確 LV.3、移動後抽牌與 035 空手牌啟動邊界；候選維持 inventory／converted=0，20 檔／479 項 targeted、完整 Vitest 366 檔／5,156 項（516.85 秒）、主效果54／24／38、攻擊 Then 9／27、strict 78／79／2；Browser／正式與 online 尚未驗證。 |
| 2026-09-22 | BS11 候選與前九批 BS11-001～015、017～031 靜態／核心轉接：159 筆／116 基礎卡號／43 變體維持 inventory，18 檔／468 項 targeted、完整 Vitest 364 檔／5,145 項（538.07 秒）、主效果51／24／41、攻擊 Then 5／27、strict 74／83／2；029～031 補上條件／Activate pending runtime，031 經 Astra 指出後修正為精確棄 2 張手牌並到期清除，016 跨 Cookie 總計 HP 仍 needs-review，Browser／正式與 online 尚未驗證。 |
| 2026-09-22 | BS10 正式收尾批次：候選 promote 至正式卡池；非 EXTRA Browser 正向135／135、負向151／151，BS10-008 FLIP 16／16，12 張 EXTRA 兩尺寸各正負12／12；正式牌組四尺寸、online modal 兩尺寸、好友房完整對局108命令／14次攻擊、完整 Vitest 348 檔／5,022 項與 build 通過。 |
| 2026-09-22 | BS10-088 Butterfly Lantern：先顯示正式 BS10-001 Princess Cookie，再選擇牌庫頂／底；補 `pickCount=0` modal、規則驗證與響應式排版，4 檔／71 項 targeted 與兩尺寸 Browser 實卡流程通過。 |
| 2026-09-21 | BS10 Luna批次整合：主效果98 supported／25 no-effect-text／0 unsupported，能力98 converted／0 pending，攻擊 Then 21／23，strict 158 verified／0 needs-review／6 blocked；受影響5檔／357項、完整Vitest 348檔／5,006項、build、scoped lint通過，Browser仍僅前十張88案。 |
| 2026-09-21 | BS10-024／073 Awaken 收尾與語意修正：兩張 EXTRA（含異圖）補上 HP+1／同名本回合 Awaken、024 HP≤3 禁攻擊與 2R 攻擊 Then、073 1G／對手支援至少6張 On Play 與 Cookie 回手攻擊 Then；並修正 BS10-015／035／038／042 的代價、補 HP、Then 目標與條件。strict 164 verified／0 needs-review／0 blocked，攻擊 Then 23／23，受影響3檔／77項、完整Vitest 348檔／5,008項（475.29秒）、build、scoped lint通過，Browser仍88案，候選仍 inventory／converted=0。024／073 圖檔與 API 候選文字仍有差異，正式 promote 前須再核對。 |
| 2026-09-21 | BS10第二批候選Browser累計52案：006／007核心、008 FLIP、009 HP代價與006／007／010普通攻擊均完成雙尺寸正負路徑；第三批011／012／025完成靜態 exact adapter；set/reduce與昏厥續接另有受影響回歸，正式牌組／online與剩餘卡號仍待完成。 |
| 2026-09-21 | BS10第三～第九批完成 65 張主效果、65 張能力與 18／18 攻擊 Then 的結構化轉接；strict 127 verified／31 needs-review／6 blocked，受影響回歸與 build 通過。新增卡片尚未 Browser，候選維持 inventory／converted=0。 |
| 2026-09-15 | 修復 BS9-035／041／050 手動驗證場景；修正攻擊付款預覽遮擋；深藍介面與新手操作教學精修，驗證範圍見各任務報告。 |
| 2026-09-14 | BS10候選164筆／123基礎卡保持隔離；Luna實作、Astra驗收首批001～005及異圖，36案候選Browser通過，接續006。 |
| 2026-09-14 | 優化對戰桌資訊層級與桌機手牌獨立區域；加入全流程對戰動畫、速度／略過、開局與暫停面板優化及雙欄對戰大廳；`0.10.0`：正式主選單套用參考圖的左側垂直導覽；「管理牌組」進入 Master Duel 風格「我的牌組」，支援牌組管理操作並保留既有 `deck-editor` 排版；移除 `my-decks-disclaimer` 中多餘的正式風格說明。 |
| 2026-09-14 | 修正 BS9 Lv.5 benchmark 的 500 步硬上限、超限失敗排除訓練，以及 baseline／訓練策略雙向交叉 holdout；完整 Swiss 實測 5,084／5,120 完成、36 場 FAIL，32 副×2 輪交叉 holdout 為訓練 35 勝／baseline 29 勝／0 失敗，並同步重生報告與 profile。 |
| 2026-09-14 | BS9-022／BS9-023 正向 card-check fixture 補上對手持有 HP 卡的正面公開標記，並新增雙玩家遮罩視角回歸。 |
| 2026-09-14 | BS9-031／BS9-032 正向 card-check fixture 改由 BS9-030 攻擊後 detached FLIP 驗證，補共同入口／攻擊續接與 Alchemist／Yoga FLIP 回歸；終端 Browser 重跑受官方圖片載入環境限制。 |
| 2026-09-13 | BS9-025 基礎版／`@1` 依使用者確認採用 FLIP 進 Trash、棄 1 手牌、原附著 Cookie +1 HP，持有者自己的回合可改選另一隻己方 Cookie（不轉移 FLIP 卡）；接入 exact adapter／runtime／UI／contract，strict 185／185 verified，專用 Browser 8／8；依授權正式移入 `data/cards/`，`validate:cards` 17 檔／1,600 種卡號／1,574 張成功轉換，完整 Vitest 319／4,769、build 通過。終端整批 image gate 受官方影像網路限制，未 commit／push。 |
| 2026-09-13 | （BS9-025 採用前快照）BS9 coverage analyzer 接入 EXTRA Deck 專用 adapter，5 張 EXTRA 由 pending 修正為 converted；全候選 coverage 更新為 73 supported／44 no-effect／1 pending，071～118 runtime hardening 後完整 Vitest 為 319 檔／4,757 項通過；修正好友房 Browser 腳本的 stale `command-log-filters` selector，線上 modal 2／2 與好友房同步 gate 通過；新版 Browser 嚴格矩陣 352／352（官方影像 352／352、負向證據 176／176），全候選 185 筆聚合為 852／852 lanes 通過、exact image loaded 848／852（018 負向隱藏手牌 4 條不適用）；新增全候選 evidence audit 與 BS9-068 對手攻擊 4／3→3／2 的實際 state witness；官方 English／Asia／韓文原始 JSON 與圖檔 metadata 仍未補足 BS9-025 選定後動作，台灣版 Ver.1.8 §3-10／§8-3-4／§10-1-2／§11-1 亦未定義選定後操作，FAQ／公告查無專卡裁決，採用語義前維持 strict needs-review。 |
| 2026-09-12 | BS9-025 基礎版與 `@1` 異圖由官方卡表再次確認相同未完句 FLIP 原文；FAQ／公告查無專卡裁決，故保留卡圖 URL 綁定的 review-only 詳情與正／負 Browser fail-closed 路徑，納入 BS9-024～029 的雙尺寸共 56／56；全檔 strict 維持 183 verified／2 needs-review／0 blocked，候選仍為 inventory、未 promote。 |
| 2026-09-12～13 | BS9-071～118 完成 76 筆候選 exact adapter／規則／UI／公開 trace 與 runtime hardening；舊版 Browser 372／372 僅保留歷史 smoke，新版嚴格矩陣為 352／352，strict 76／76 verified，全檔 strict 183／2／0，候選 185 筆維持 inventory、converted=0，未 promote。 |
| 2026-09-12 | BS9-018 完成實際攻擊後的 Kumiho FLIP 續接；BS9-021 修正跨所有權 HP 搬移；BS9-032／033 完成 own-turn Then 與支付後手牌門檻；BS9-034～038 完成 HP 重排／增加封鎖、攻擊 Then、回合結束二選一、黃色 FLIP 回收與同名全體增 HP；BS9-039～040、042～045 完成 FLIP 揭示條件、裝備轉 HP、回收與陷阱 FLIP 代價；BS9-046～049 完成陷阱第二段選牌、場景 Activate、FLIP 異圖與昏厥移至支援區；BS9-050 完成支援區累計條件與攻擊 Then 支援代價；BS9-051～070 完成 28 筆候選 exact adapter／規則／UI 與雙尺寸正／負 Browser 140／140、strict 28／28 verified。候選仍維持 inventory。 |
| 2026-09-11 | BS9-018「Hero Cookie」補上來源玩家／目標所有權／Your Turn 的對手攻擊與效果傷害防止，並以 P-018 effect-damage 兩目標在 1907×863／1164×777 完成正／負 Browser A/B 共 4／4；候選仍維持 inventory。 |
| 2026-09-11 | BS9-031「Alchemist Cookie」以 P-018 On Play effect-damage 完成自己的回合 FLIP 觸發、LV.3 目標、棄 1 與抽 0／1 的候選規則／Browser A/B；1907×863／1164×777 共 4／4，對手回合負向不建立 Then 抽牌，候選仍維持 inventory。 |
| 2026-09-11 | BS9-041「Pistachio Cookie」完成 FLIP 抽牌後 `activated during your turn` 對手 Cookie 傷害的候選規則／Browser A/B；正向控制 fixture 續接 BS9-018 原攻擊，負向自然攻擊只抽牌，1907×863／1164×777 共 4／4，候選仍維持 inventory。 |
| 2026-09-11 | BS9-017 修正固定目標提示、全體 Ancient 減傷確認與對戰紀錄；補齊對手能量，雙尺寸驗證 4 點攻擊對 Ancient 只扣 2 HP、非 Ancient 扣 4 HP。 |
| 2026-09-11 | 修復 BS9-010／BS9-014 隱藏手牌與正面 HP 最下方語意，以及 BS9-015 昏厥 Then 只列第一段登場 Cookie；BS9-010 雙尺寸 10／10、BS9-014／015 雙尺寸正負各 4／4 候選 Browser 通過，並讓候選 staging 額外牌組欄位解析 BS9-010／BS9-030；BS8-121／122／125 補齊實卡正／負 fixture。各批完整測試及 lint 結果見任務報告，正式牌組／多人／線上逐卡仍待。 |
| 2026-09-10 | BS8-107 card-check fixture 改用正式 BS8 手牌，並以 Chrome 驗證紫色 Item 代價選擇、對手 HP 棄置及缺少合法代價的負向阻擋；BS8-111／113／114／117 補上條件／代價負向 fixture，桌機／平板 strict ability A/B 共10份報告通過。另完成 BS9-001～030 候選 adapter／規則／文案回歸與官方實體卡牌 fixture：第一批 68／68、第二批 80／80、第三批 56／56、BS9-030 第四批 8／8 Browser 正／負路徑；補上 BS9-006 同回合實際攻擊傷害正／負續接（2／2 對 1／2），完整 Vitest／build 與 scoped lint 通過；BS9-025 保留 review-only／fail-closed，BS9-030 及其他候選仍未進正式牌組，正式牌組／多人／線上逐卡 gate 仍待。 |
| 2026-09-09 | 修正BS8-095昏厥棄手牌代價與BS8-098陷阱Then可選藍色支付／手牌條件的可重現fixture；補上BS8-100正式卡牌手牌／藍色篩選與BS8-119→BS8-103棄牌區登場鏈；新增通用Awakened底卡實圖／卡名／詳情顯示，驗證BS8-027／104正向與BS8-027負向路徑。完成規則回歸、build、scoped lint及Chrome Browser正／負路徑，保留正式牌組／多人／線上逐卡驗收邊界。 |
| 2026-09-08 | 修正BS8-053正向／負向test-state的疲勞綠色支援候選與零目標效果紀錄；完成BS8-076凍結分支、BS8-059逐目標HP選擇、BS8-078手牌登場目標與技能支付支援區排版、BS8-079正式LV.1目標與下一個Active Phase回歸、BS8-083手牌登場與獨立攻擊後Then路徑、BS8-085剩餘1 HP昏厥目標與高HP反例，並補上UI文案回歸與Chrome Browser A/B。整理Codex規則與Skills、取消OpenCode Go備援，完成隔離工作流驗證。 |
| 2026-09-07 | 完成BS8全125張文字／runtime與桌機平板局部稽查、171筆實圖詳情；修復手牌／支援間距、候選／數量／Then／傷害順序／異圖與promotion測試隔離。4,498項測試通過，正式EXTRA編輯器／JSON／本機登場／標準好友房與私密遮罩已開放並驗證。 |
| 2026-09-06 | BS8藍色076～100與紫色101～125逐卡語意核對及Browser流程完成；修復BS8-115／118漏掉的棄牌區張數條件並補回歸；BS8-069／090／104 EXTRA A/B通過，125列矩陣全數更新。攻擊能量支付維持緊湊堆疊排版。 |
| 2026-09-05 | BS8綠色重驗及全專案UI/UX稽核，續查至黃色050並修復綠色059回手顏色限制；修復付款／昏厥代價、效果排序、線上資訊、FLIP、登場略過與空候選提示、棄牌來源及異圖資料。後續優先桌機／平板，手機暫緩；完整測試有候選卡工具寫入失敗，逐卡與完整對局界線見稽核報告。 |
| 2026-09-04 | BS8黃色026～050（35筆含異圖）逐卡Browser A/B與選0重驗；修正成本、目標、Then續接、HP條件及公開效果紀錄，完整驗證邊界見黃色驗證文件。 |
| 2026-09-03 | 修正 BS8-011 先讓 BS8-018 昏厥時外層第二段目標被覆寫的規則佇列與效果面板競態；依 BS1-006 官方卡面補正效果傷害後仍在場的 `afterDamage` 觸發，保留 BS8-011 後續對 BS1-006 的傷害，並新增 BS8-011／BS8-018／BS1-006 正向與不昏厥控制情境的 TDD／localhost Browser 驗證。 |
| 2026-09-03 | 修正 BS8-013 昏厥效果的 `Break → 棄牌區` 來源查找與正式紅色 LV.1 候選夾具；BS8-017 補上紅色印刷 HP=1 棄牌區候選、戰鬥區空位與支付後 Then 續接；BS8-018 補上紅色支援區支付、單次昏厥觸發只收一次費用及未支付時跳過整組效果，Browser A/B 完成選取、略過與傷害結算。 |
| 2026-09-02 | 戰場玩家 EXTRA Deck 彈窗新增實際卡圖、卡名與卡號，保留登場條件高光與對手內容私密遮罩；Browser A/B 增加卡圖／回退視覺驗證，並依裁決補上 BS8-009 總 LV4／7 的 +1／+2 門檻回歸；BS8-010 昏厥條件改由 parser／strict contract fail-closed 保護。 |
| 2026-09-01 | 測試對局設定新增雙方獨立 EXTRA Deck 卡號欄位與 6 張／同卡 4 張驗證；牌組編輯器在 BS8 候選 staging 顯示 EXTRA 篩選、卡池加入與六槽數量控制，額外牌組在主要牌組捲動區下方以實際卡面呈現，Standard 仍維持隔離；新增五張 BS8 EXTRA 登場條件 Browser A/B，並修正 `card:`／`card-negative:` 不得將 EXTRA 放入手牌、BS8-009 技能 Then 的支援區紅色能量支付、休息區 LV 倍數加傷與紀錄語意。 |
| 2026-08-31 | BS8 完成正式 promotion：171 筆記錄／125 個基礎卡號（含 15 筆 EXTRA）移入 `data/cards/`，正式 card-pool 增至 1,415 種卡號；修正 Stage 靜態攻擊費用 modifier 的驗證 payload 判定，並修正 BS8-005 generic card-check 不得降級為手牌物品卡；正式 `validate:cards` 1,400／1,400、strict contract 171／171，Browser 正向 146／146、負向 156／156、能力 A/B 54／54 與 Then 14／14 均通過，EXTRA Deck 維持獨立 staging；新增 BS8-005 條件式 EXTRA 區高光／登場提醒與 BS8-008 Blocker 紅色能量選擇及付款前確認鎖定。 |
| 2026-08-30 | BS8 候選 strict contract 為 170 verified／0 needs-review／1 explicit official-ruling block；補齊 BS8-076 強制置牌庫底、抽牌與對手 Active Phase 棄 0／2 張分支，並以 `test:bs8:076:browser` 實際驗證兩條分支。通用主效果 Browser 為 145／145 正向、155／155 負向；`test:bs8:abilities:browser` 完成 54／54 獨立技能表面 A/B，14 個 Then 的實際攻擊語意 A/B 亦完成。牌組編輯器新增 Standard 的 BS7 篩選及候選限定的 BS8 主牌／六槽 EXTRA、專用 JSON 匯入匯出；BS8-043 官方裁決仍阻擋 promotion。 |
| 2026-08-29 | BS8 EXTRA Deck 依官方 Comprehensive Rules v1.8 完成 Phase 0／1 與首批直接登場核心：0–6 張、EXTRA／Awakened、每卡號四張、私密重排、主牌組／開局隔離、玩家 view／線上遮罩及 `play-extra-deck-cookie` 均有 TDD；BS8-005／090 攻擊後效果、Lv.1／Lv.2 通用 AI 路徑與線上 payload 拒絕測試也已補齊。其後以規則 §2-4-2-2、§3-5-5-1、§4-9、§4-12-2、§9-4-2 與 FAQ 補齊 BS8-027／104 Awaken 的 HP、裝備、效果清理與昏厥去向 TDD，並完成 BS8-002 首張 serial strict contract。自訂牌組、固定 seed 整場 AI、正式線上／逐卡 Browser gate 與 promotion 仍待完成。 |
| 2026-08-28 | BS7 Blue 100 場診斷修正 search 漏算的 `attack-tempo`，並保留明確唯一防守資源的例外；新增回歸與獨立 seed 健康驗證。修正後 46 副全 corpus、368 場 holdout 為 180 勝（48.9%）、安全異常 0，未達 Lv.5 升格門檻。BS8 官方資料以 171 筆 `inventory` 候選匯入，15 筆 EXTRA 與效果缺口維持不可 promote，並建立核心模型分階段方案。 |
| 2026-08-27 | 校正 Lv.5 公開宣告傷害的 replay reason 與同回合擊倒 telemetry；matched 250 場 Arena 維持 113 勝、健康異常 0，尚未宣稱強度升格。 |
| 2026-08-26 | 新增版本化對戰紀錄與 AI 決策 provenance；完成 Lv.5 唯一陷阱保留、可選支付防守、Break 6–9 生存評估及 BS6-084／AI 回歸。 |
| 2026-08-25 | Lv.5 部署節奏迭代：戰鬥區已有一張餅乾時預設保留第二張手牌，公開 Combo／斬殺／有效 OnPlay／補防才放寬；matched seeds 801–802 由 174／368 提升至 181／368，holdout 803–804 為 180／368、805–806 為 178／368，安全指標全 0，仍未達正式升格門檻。 |
| 2026-08-25 | Lv.5 challenger 迭代：終局預判改用公開補位 HP 分布估算 Refresh 風險；strict same-turn Combo 僅在規則層已列出合法 payoff 時給 setup 機會加分。新 seeds 701–702 的 368 場 diagnostic 為 186 勝、Combo 8／8 完成、安全指標全 0，但勝率尚未達升格門檻。 |
| 2026-08-24 | 修正官方卡牌文字的段落渲染：`CardEffectText` 保留 CRLF 換行，BS7-104 的被動與 Activate／Once per turn 技能在卡牌詳情及快速預覽中分成兩段；新增 CardVisuals／CardDetailModal 回歸測試與本機 Browser 驗證。 |
| 2026-08-24 | 主選單「AI 對手」預設等級由 Lv.4 調整為 Lv.5；保留 Lv.1～Lv.5 手動切換，benchmark／測試對局的明確等級設定不變。 |
| 2026-08-24 | 新增結算後對戰紀錄回顧：提供勝負摘要、紀錄／行動組／回合統計，沿用既有回合／玩家／卡牌／分類篩選與逐步展開，支援全部展開／收合及返回結算；本機與線上結果畫面共用公開 commandLog，並完成元件回歸、lint、build 與 localhost Browser flow。 |
| 2026-08-23 | 新增 ASIA 2026-02-13 版本化禁限卡表與標準牌組 gate；產生 256 副五色多樣化 roster，完成 Lv.5 8 輪／1,024 場 Swiss、7 場 Top cut 與同 pairing Lv.4 控制組 1,024 場。修正 AI 陷阱多代價選項、棄牌區餅乾替代代價與 `excludeSource` 合法性；Lv.5／Lv.4 均 100% 完成且安全指標全 0，冠軍 YELLOW #057、亞軍 YELLOW #002，但 paired advantage Wilson 95% CI 44.62%–59.34%，尚未升格。完整排名、牌表與 telemetry 見 [256 副 Lv.5 Swiss 報告](docs/lv5-swiss-256-report.md)。 |
| 2026-08-23 | 修正 PR 審查發現的 Refresh 邊界：最後一張 HP 卡後沒有可回收 LV.1 餅乾時立即 `refresh-unavailable` 判負；登場 HP 補充（含檢視牌庫後登場）改為以 `remainingHpSetup` 精確續接，不再於任意 Refresh 回滿其他受傷餅乾；檢視牌庫→支援區耗盡牌庫也會進入 Refresh；BS7-024 的 HP 回手代價離場會清除 modifier 並建立補位。新增／更新回歸後完整 Vitest 220 檔／3,542 項、lint、build 通過。 |
| 2026-08-23 | 完善實驗 Lv.5：新增 capability 驅動的通用 ComboPlan、同 plan 跨步生命週期、payoff 能量顏色預留、對手牌庫耗盡／Refresh 洗傷／空場敗北公開預測，以及 1,244 筆 inventory／967 種唯一 runtime 機制的全卡池訓練 gate；46 副牌組 mirror＋輪替跨牌組 untouched holdout 368 場為 186 勝，完成率 100%、安全指標全 0，但 Wilson 95% CI 未過門檻，Lv.4 維持 champion。完整 Vitest 220 檔／3,537 項通過。 |
| 2026-08-22 | 完成 BS7「Arena of Glory」正式 promote，正式卡池增至 15 檔／1,244 筆，strict contract 1,244／1,244、卡牌轉換 1,244／1,244、registry consistent；新增五色 BS7 Arena 牌組與 deterministic batch optimizer，採用的 untouched final 為 Red 51／100、Yellow 62／100、Green 102／200、Blue 63／100、Purple 55／100，所有對局均無 invalid、stuck、deadlock、unfinished、error 或 turn cap；Lv.4 對 Lv.3 兩批 30 場為 21／30、18／30，並補齊合法代價／目標選擇與受傷目標聚焦。新增實驗 Lv.5 challenger 的每場公開資訊記憶、對手回應期望、跨步意圖與 champion–challenger gate；正式 967 張基礎 runtime 卡及 BS7 108 張 capability strict audit 均為 ready，五色雙邊換位 100 場 holdout 為 49／100，安全指標全為 0、尚未升格。`gain-hp` 現可跨 Refresh 接續剩餘 HP。BS7-097 依官方英文勘誤改為降低受到的攻擊傷害；正式 Browser 卡面 143／143、正向效果 98／98、負向 A/B 143／143，BS7-039／082 均以第二目標→第一目標的反向點選順序通過，BS7-082 正向棄 2 張、負向只棄 1 張。完整 Vitest 218 檔／3,531 項、lint、build、AI Browser 20／20 通過。 |
| 2026-08-21 | 修正 AI 攻擊無可用回應時可能卡住的戰鬥轉移；新增 BS7「Arena of Glory」候選匯入／效果盤點入口，143 筆資料維持 inventory，尚未 promote；完成 BS7-001～BS7-108 runtime／strict contract，補齊非餅乾 Trap Then 與 `trash-to-hand` 目標管線，並將 BS7-039／082 對手全體傷害改為依序選取、逐張處理 HP／FLIP／昏厥；BS7-039／082、BS7-064／085／106／108 已補 Browser A/B。候選 strict 143／143、正式 strict 1,101／1,101 verified；卡面載入 143／143、正向效果 98／98、負向 A/B 143／143。完整 Vitest 212 檔／3,497 項、lint、build。 |
| 2026-08-20 | 補強 BS4-026 被 BS6-010 阻擋與 BS6-031 攻擊後效果的可支付原因：對戰紀錄／效果提示同步顯示阻擋來源與黃色能量不足，新增正式卡池 test-state A/B；完整 Vitest 211 檔／3,408 項、lint、build 與瀏覽器正反向驗證通過。 |
| 2026-08-20 | 完成 BS1～BS6 與 P 卡正式卡池全面收尾：1,101／1,101 路由載入，效果、全記錄負向與無效果攻擊 Browser 矩陣全部通過；修正 P-015／P-016 多段效果、BS4-014／080 正規化、BS4-038 攻擊後效果與稽核 fixture／分類，BS6-036／042／043、BS5-109 專項正反驗收全綠。契約稽核 1,101 verified、0 needs-review、0 blocked；完整 Vitest 211 檔／3,401 項、lint、build 與 AI／牌組編輯器／本機雙瀏覽器好友房 smoke 通過。 |
| 2026-08-20 | 修正 Browser smoke fixture 與現行 UI 契約：場景放置先選擇支援區付款卡再確認，Pretzel Snare 改用新的逐段目標略過控制；另修正 BS6-016 Crunchy Chip Cookie 的 card-check 正／負向 HP fixture 與回歸測試；完整 Vitest 210 檔／3,376 項、lint、build 與 BS6-016 Browser A/B 通過。 |
| 2026-08-19 | 修正陷阱是唯一攻擊回應時重複掛載通用回應選擇器與陷阱視窗的問題；BS6-020 現在只顯示一個回應流程，並補上 selector 回歸與 Browser 驗證。 |
| 2026-08-19 | 修正 BS6-031 Timekeeper Cookie 的 card-check fixture：同時具備 OnPlay 與攻擊後效果時，保留在手牌並透過正式登場指令測試黃色能量支付、對手目標與 1 點傷害；新增回歸測試，完整 Vitest 209 檔／3,341 項通過。 |
| 2026-08-19 | 修正 PR Browser Smoke 的 Playwright 安裝步驟：避免使用會觸發 Ubuntu apt mirror 的 `--with-deps`，改為只下載 Chromium 並加上安裝步驟逾時，避免依賴安裝卡住導致 Gate 被取消。 |
| 2026-08-19 | 修正 BS6-023 Dark Fondue Cookie 登場全體傷害：改為依序選擇每張對手餅乾，逐張完成傷害、FLIP 與昏厥結算後再處理下一個目標；補上 adapter 與規則層回歸測試，並以 `test-state` 實際驗證兩張對手餅乾的目標順序與效果紀錄。 |
| 2026-08-18 | 修正昏厥／離場後的全域待處理優先序：卡牌效果、效果傷害、FLIP、昏厥效果與 `pendingEffectOrder` 必須先完成，才建立或顯示餅乾補位；同步更新本機／線上 pending UI、AI 控制器與效果傷害序列，避免補位插入 BS2-015／BS4-005／BS4-011 等效果鏈。補上合法指令雙 pending 回歸與 BS2-015 Then→補位 Browser 3/3 驗證；完整 Vitest 208 檔／3,337 項、lint、typecheck、build 通過。 |
| 2026-08-18 | FLIP 卡全面盤點與收尾：以 `scripts/inventory-flip-cards.ts` 列出 114 張 FLIP 基礎卡（效果 111、vanilla 無效果 2、修正 1）的 runtime FlipAbility，`scripts/verify-flip-kinds.ts` 在引擎層逐種效果 kind 驗證「翻開→決策窗→發動作」。修正四項：(1) P-099 Bell Pepper Cookie 官方把 FLIP 抽 1 效果併進 attackText 的欄位錯置（與 P-100 同型，補轉接與 battle 回歸）；(2) `hasFlipAbility` 改為與 runtime 一致，`type: cookie` 只有在轉接後真有 `FlipAbility` 才算 FLIP，P-056～P-069、BS4-004@1、BS5-039@2 等 flipText 重複攻擊名的 21 張普通餅乾／變體不再誤計入 Deck editor 的 FLIP 篩選與「FLIP N/16」上限（計數 144→123，補卡池回歸測試）；(3) `convertOfficialFlipAbility` 一般路徑對「The Cookie with this card attached for HP gains +N HP.」統一為 `attachedHpBonus`（附著期間剩餘 HP 連續 +N，與 BS5-004／BS6-069 同語意），BS3-012 等 29 張舊系列卡補回附著隱藏 +1（同步更新 7 處斷言）；(4) BS2-042／P-047 官方 flipText 為空的 vanilla FLIP 保留為 FLIP 卡但不開決策窗（待官方確認）。稽核矩陣見 [docs/flip-card-audit-matrix.md](docs/flip-card-audit-matrix.md)。完整驗證：Vitest 208 檔／3,336 項、typecheck、lint、build、`validate:cards`、`check:card-pool`、FLIP kinds verifier 全過；Browser smoke 的 AI 20／20、牌組編輯器 4 viewport、線上好友房同步與錯誤路徑全過。 |
| 2026-08-18 | 卡牌行為契約稽核歸零：`cards:audit:contracts` verified=1,101、needs-review=0、blocked=0。修正最後 25 筆——16 筆 payment evidence（ledger 收集 `StageAbility.placementCost` 場景放置能量）與 3 筆 runtime energy、9 筆 cost evidence（BS5-092／BS5-093 `trashToDeck` 技能代價、BS5-092 改為對手指攻回應觸發並在陷阱視窗支付代價與結算 modify-attack，`skipTrap` 統一重算傷害、BS2-081 self-to-trash、P-082 trap 替代代價、P-045 雙重棄牌修正）、Then／once-per-turn／resolution order／timing 各 1 筆（BS4-080@2 欄位正規化與 Then 抽牌、P-100 FLIP 正規化）；契約改以 adapter 正規化來源建立。新增回歸 37 項；21 張修正卡＋4 錨卡 Browser batch attestation 全過（BS5-092／093 的對手指攻回應技能沿用 BS5-081 的無人機 UI 缺口，引擎層以 battle 回歸涵蓋）；完整 Vitest 208 檔／3,310 項、lint、build 通過。 |
| 2026-08-17 | 建立卡牌行為契約 shadow ledger 與支付／代價／目標／Then 交叉稽核，完成 P1～P5 的 descriptor bridge、公開 trace attestation 與七批各 25 張 verified shadow migration gate（含 `cardNumber` 異圖綁定）；補齊 LV／Blocker／markup／直接能量鍵、HP／牌庫底／棄牌區／支援區移動、Reveal／Discard parser 與 selector binding，讓 `source contains unclassified clause` 歸零；稽核原因改為可統計分類，並修正 Browser trace 不應載入 Node-only ledger 的啟動問題；補正 BS2-014 條件式 break→hand→break 效果，讓唯一 `target evidence unresolved` 歸零；讓 `promote:candidate` 預設阻擋未完成契約；修正 BS3-113 Caramel Arrow Cookie 登場後全體傷害的逐張目標順序與 AI 指令；同時修正 BS6-096 Cherry Cookie 攻擊後「自身進棄牌區後再從棄牌區登場」的目標提示、BS6-107 Machine Room 的棄牌區登場條件按鈕，以及 BS6-101 Twizzly Gummy Cookie 昏厥後先支付紫色能量再選擇棄牌區餅乾登場；BS4-075 Black Pearl Cookie 攻擊後棄 2 張手牌改為可略過的代價選擇，並以 Browser／規則回歸驗證支付與目標流程；補正 BS6-053／BS6-055／BS6-058～BS6-062 card-check 條件、BS4-005 補位後效果傷害日誌；修正 BS6-057 Coffee Candy Cookie 將支援區 Cookie 回手正確建模為第二項技能代價，並補上規則層卡種驗證與 Browser 回歸；offset 125／150 25 張逐卡 attestation 已取得 effect trace 或合法 no-op，完整 Vitest 206 檔／3,273 項通過。 |
| 2026-08-16 | 調整 Lv.2–Lv.4 AI 餅乾部署策略：不強制填滿兩張戰鬥區，已有餅乾時優先避免 FLIP 卡，僅在缺少非 FLIP 替代品或可直接補刀時允許登場；新增部署政策回歸測試，完整 Vitest 190 檔／3,110 項、lint、build 與 AI Browser 20／20 通過。 |
| 2026-08-16 | 完成牌組編輯器 LV／HP／攻擊力篩選，修正並稽核 BS5／BS6 尖括號攻擊後代價可略過流程，補上 P-059 抽牌來源與條件紀錄；完成 BS6-008「Sugar Swan Cookie」陷阱封鎖、BS6-044 固定原攻擊目標追傷、BS6-061 支援區回手後 BS1-078 場景條件、BS6-051 綠色手牌目標提示、BS6-062 物品支援區餅乾回手代價、效果傷害 FLIP 逐點結算與 BS3-061 可選昏厥技能修正；補上本機／線上對戰紀錄的陷阱來源卡、代價與攻擊後效果來源／目標／結果步驟；完整 Vitest 189 檔／3,104 項、lint、build 通過。 |
| 2026-08-15 | 依官方韓文資料與實體卡逐卡修正 BS6「Operation Timeguard」52 個基礎卡號（64 筆含異圖）的英文 API 攻擊傷害誤記，並補上 BS4-045@1／BS4-097@1 兩張異圖變體；修正 BS6-079 攻擊後可選代價的目標選擇只能選 1 張的問題（OptionalCostAttackModal 改為多選、支援「對手支援區的卡」標籤與上限進度），新增 `bs6-079-multi-target-probe` Browser 驗證「支付代價→選 3 張對手支援卡橫置」；補強 1164×777 與通用桌面 viewport 的手牌實際卡面邊界 gate；完整 Vitest 188 檔／3,039 項、lint、build 通過。 |
| 2026-08-15 | 完成 BS5／BS6 全卡 Browser 效果語意稽核與代價交叉驗證：BS5 效果 143／143＋負向 153／153＋無效果攻擊 10／10、BS6 效果 97／97＋負向 138／138＋無效果攻擊 10／10；新增 `verify-bs5-bs6-semantics.ts` 對 291 筆記錄逐張比對官方文字與 runtime 能量代價／傷害／HP 代價／抽牌數量（BS5 400 項、BS6 325 項全相符）；修正稽核驅動對 cookie＋FLIP 文案（BS5-073）與 `battle-cookie-to-hand` 代價群（BS6-073）的分類／驅動缺口；盤點修復 3 項潛在 UI／AI 隱患（battle-cookie-to-hand 提示改為依 runtime 代價動態產生顏色與等級、hpToTrash 缺 amount 時自動代價描述與 AI 成本阻尼一致視為 1 張），並為慢速機器加長 AI benchmark 測試 timeout；完整 Vitest 187 檔／3,031 項、lint、build 通過。 |
| 2026-08-14 | 修正 BS5-073 FLIP 顯示，並補上 BS4-024 Kumiho Cookie 強制攻擊目標的 UI 限制提示、不可用目標回饋與對戰紀錄原因／來源卡步驟；完整 Vitest 187 檔／3,018 項、lint、typecheck、build、bundle gate 與 Browser 回歸通過。 |
| 2026-08-14 | 匯入使用者提供的 BS6 五色競技環境牌組，修正 P-059 官方 API 將攻擊名稱誤寫入 FLIP 欄位；Lv.4 新增技能／道具後續行動前瞻，並提供五色兩兩配對各 5 場、共 50 場的可重現 round-robin benchmark。 |
| 2026-08-14 | 修正 Browser smoke 1024×576 短桌面手牌 hover／focus 遮擋戰鬥卡問題，新增明確 hover 回歸；拆分 `game-demo` chunk，主入口 gzip 由 183.59 KiB 降至 161.73 KiB，bundle gate 與完整 Browser smoke 通過。 |
| 2026-08-14 | 修正 BS5-073「Cyborg Cookie」官方資料遺漏的 FLIP 抽牌效果；同步修正 FLIP 轉接、牌組編輯器篩選與 16 張上限統計，並以本機 Browser 驗證卡圖、詳情文案與加入牌組流程；完整 Vitest 187 檔／3,007 項、lint、typecheck、build 通過。 |
| 2026-08-14 | 以本機 in-app Browser Use 完成 BS5-001～111、BS6-001～107 共 436 條正向／負向逐卡路徑；補上 BS6-025、032、045、057、081 的合法候選 fixture，完整 Vitest 187 檔／3,004 項、lint、build 通過。 |
| 2026-08-14 | 釐清 BS5-060 一般 `card:` 夾具未模擬攻擊支付後的休息支援卡；新增專用 end-phase A/B fixture、146 項 demo 回歸，並以 Browser Use 驗證 4 張休息支援卡於結束回合啟動 3 張、全啟動路徑安全略過。 |
| 2026-08-14 | 完成 BS1～BS6 五色 512 副牌組的 9 輪 Browser Swiss 與第一輪 BS6 加權迭代：初代／迭代各 2,304／2,304 場、卡住 0、Browser 錯誤 0；補上五色上位卡表與 JSON 報告，並修正 BS6-039、BS6-043、陷阱移動目標、過期效果順序及 AI 攻擊目標的結算卡死；完整 Vitest 187 檔／3,003 項、lint、build 通過。 |
| 2026-08-13 | 完成 BS5／BS6 五色逐卡 A/B Browser 稽核：151＋138 張正向／負向路徑全部通過；新增 localhost-only `card-negative` fixture 與支付／額外代價／攻擊後 `Then` 驗證驅動，完整 Vitest 185 檔／2,994 項、lint、build 通過。 |
| 2026-08-13 | 修正 BS6-020 `Tonic Spray` 陷阱後半段的自身餅乾與最上方 HP 卡回手選擇；新增規則／Modal 回歸測試，完整 Vitest 185 檔／2,994 項、lint、build 與本機 Browser 選取／略過路徑通過。 |
| 2026-08-13 | 新增 BS5+6 五色競技環境 AI 牌組，保留 BS5／BS6 標準 choice；補上賽事研究紀錄、固定 seed 100 場競技矩陣與競技牌組 Browser 驗證入口。 |
| 2026-08-13 | 修正 BS6 五色標準牌組 Browser 實戰的 HP／支援區／場景代價與陷阱 `choose-one` 決策串接；補上 46 項 AI／陷阱回歸測試，固定 seed 100 場與正式根路徑 Browser 100／100 場完成、卡死 0，Browser gate PASS。 |
| 2026-08-12 | 五色 BS6 標準牌組完成資料驗證、固定 seed 100 場矩陣與正式根路徑 Browser 驗證；Browser 多場結果仍有 AI／效果結算卡死，已保留失敗證據並列入修正，不宣稱全綠。 |
| 2026-08-12 | 建立 BS6 五色純 BS6 標準牌組與 AI preset，補上固定 seed 100 場矩陣及根路徑 Browser 牌組驗證；修正 Browser AI simulation 傳遞自訂牌組，並記錄目前效果／AI 結算卡死，未將未全綠結果誤標為通過。 |
| 2026-08-12 | BS6 138 筆（107 個不同基礎卡號；106 筆基礎記錄、32 筆異圖／變體）完成五色逐卡 Browser 入口矩陣與 97／97 效果互動矩陣；修正 6 筆官方資料遺漏 `{da}`、BS6-001 HP 代價候選與 BS6-106 陷阱 Then 目標，候選通過 promotion-ready gate 後 promote 至正式卡池，正式 `validate:cards`、`check:card-pool`、完整測試、lint、build 與 bundle gate 通過；牌組編輯器新增 BS6 系列篩選並以 Browser 回歸驗證。 |
| 2026-08-11 | P-0XX 127 筆（118 個 base card number、含 14 筆 `@` 異圖）已 promote 至 `data/cards/`，正式卡池增至 963 種卡號；修正 test-state、轉接覆蓋與 Browser 稽核腳本仍讀候選檔的路徑。P-041 的生日祝福登場文字明確標示為不改變規則狀態的社交效果，保留時機與攻擊後生日 +1 攻擊的轉接及回歸測試。 |
| 2026-08-11 | 完成牌組編輯器全頁工作台第二輪收斂：主要牌組依餅乾／FLIP／物品／陷阱／場景分區並預留 BS8 額外牌組；JSON 匯入改為輔助提示框；Open 匯入略過標準禁限卡但保留核心牌組規則。頁首整合合法性、賽制、卡池統計與 JSON 工具，卡池篩選預設收合；左欄採卡圖＋數值摘要與能量圖示，補齊元件與 Browser 回歸驗證。 |
| 2026-08-10 | 完成官方 P-0XX 全量盤點與轉換：153 筆記錄（含 14 筆異圖變體）全部完成 adapter conversion，新增 127 筆候選資料與完整匯入清單；完成 P-082／P-084／P-147 特殊支付的 runtime、UI 與專用 Browser 驗證，候選仍待逐卡稽核後 promote。 |
| 2026-08-09 | 修正部署 Browser 驗收 workflow 的 trusted harness preflight、Preview 信任分支閘門與 artifact 缺檔錯誤遮蔽，升級 GitHub Actions 至 Node 24 相容版本，並完成 `main` required checks 與 Vercel Preview bypass secret 設定。 |
| 2026-08-08 | 落實全面稽核第一批穩定化：AI benchmark 強制零卡死／deadlock／非法操作／turn cap 與最低勝率；修正非法略過補位、Chrome 手牌動作焦點捲動、BS4-062 分段選擇、BS2-015 自身離場代價，以及 BS4-106／107 測試前置與 BS4-107「最多 3 張」選擇。新增 Browser Smoke PR check 與 Preview／Production 部署後驗收；Production 首頁、SPA、836 張牌池、卡圖、合法牌組、對戰入口及 Render WebSocket 通過，Preview 需設定 Vercel bypass secret。完整 Vitest 177 檔／2,827 項、lint、build、AI Browser 20／20、牌組編輯器 2／2與好友房完整 smoke 均通過。 |
| 2026-08-07 | 修正 BS5-038／BS5-046 FLIP 文案落在 `skill.text` 造成的空白／無法結算問題，補上 adapter 回歸測試與 `test-state` fixture；優化攻擊效果提示框、補上 BS5-010 排版回歸測試並驗證 BS5-011 條件不成立路徑可正常結束；完成 BS5 五色標準正式牌組各 2 場、共 10 場 Browser 端到端實戰，結果記錄於 [Browser 實戰矩陣](docs/bs5-browser-formal-matrix-2026-08-07.md)。 |
| 2026-08-06 | 完成 BS5 五色標準牌組各 40 場、共 200 場固定 seed Lv.4 矩陣與兩組 seed 構築迭代；補上 BS5-111 HP 門檻的攻擊中動態加傷／受擊不追溯減傷回歸測試，Chrome 代表性流程通過，逐色逐卡完整稽核列入下一階段。 |
| 2026-08-06 | 修正 BS3-028 登場效果在合法對手棄牌區目標存在時未顯示 UI 選擇；補上 LV6 以下成立與 LV7 以上略過的規則／效果面板回歸測試。 |
| 2026-08-06 | 建立 BS5 五色標準／開放賽制牌組 preset；牌組編輯器、主選單、本機與線上對戰入口共用賽制驗證，標準套用台灣禁限卡、開放允許正式卡池所有卡牌；新增賽制規則回歸測試。 |
| 2026-08-06 | 完成 BS5-087／BS5-109 陷阱主效果與 10 張攻擊後 `Then` 的 runtime 轉接、條件成立／不成立回歸測試；補上 BS5-089@2 異圖 normalize、attached HP bonus FLIP 驗證契約，111 張基礎卡覆蓋達 0／0／0，`validate:candidate`、`promote:candidate`、`validate:cards`、`check:card-pool` 全部通過；12 張已用 Chrome 完成支付、代價、目標與 Then 實戰驗證，並修正 BS5-098 來源離場後 Then 中斷與 BS5-087 陷阱 Then 待決策流程。 |
| 2026-08-05 | BS5 GREEN 全數轉接完成：10 張主效果、9 項額外能力、3 組攻擊 Then（056／059／060）；新增 `deferred-end-of-turn`（「When your turn ends」延遲佇列，end 階段重入排空＋`effectIndex` 書籤）、`opponent-rests-support`（BS5-065 對手選定橫置支援卡）與 `StageAbility.endPhase`（BS5-066 場景被動觸發、不可手動啟動）；BS5-051 回牌庫底在自身為唯一戰鬥區餅乾時略過；UI 新增 `OpponentRestSupportResponseModal` 並接線本機／線上控制器；新增 16 項引擎測試與 14 項 adapter 測試，GREEN 逐色待轉接歸零。 |
| 2026-08-05 | BS5 YELLOW 全數轉接完成：新增 `make-faint` 效果（BS5-036）、`noSkillOnly` 目標過濾、`cookie-gained-hp-this-turn`／`attack-target-remaining-hp-at-most` 條件，並以昏厥流程結算；BS5-026 DJ 昏厥技能（手牌黃色 LV.2 以下進休息區＋自身回手）、BS5-044 場景、BS5-042 道具與 7 張攻擊 Then 完成轉接，YELLOW 逐色待轉接歸零；新增 13 項引擎測試與 22 項 adapter 測試。 |
| 2026-08-05 | BS5 BLUE／PURPLE／PURE 能力轉接完成：補齊技能棄牌模式、牌庫檢視登場額外 HP、Dragon 裝備條件與本機／線上 UI 支付流程；能力待轉接歸零，保留陷阱主效果與攻擊 Then 待辦。 |
| 2026-08-05 | 修正擊倒觸發技能（BS4-011）延後至空場補位／敗北判定之後結算，離線、線上與 AI 共用判定並補齊手牌為空與無補位餅乾邊界測試；BS5 候選匯入與效果覆蓋分析腳本就緒（`cards:import:bs5-candidate`、`cards:analyze:bs5-candidate`），尚未 promote；BS4-030「世外桃源」與 BS4-044 千年寺改為兩階段選擇（先選目標餅乾、再選 1 張手牌放回 HP 最上方），含無目標不詢問、昏厥中斷與對戰紀錄隱私。 |
| 2026-08-04 | 修正 AI benchmark 的技能／物品／場景／Refresh RNG 傳遞並完成 100 場固定 seed 重跑；補上 BattleRow 物品支付 aria label 回歸測試、BS4-052／BS4-029 規則回歸、22 張條件卡 44／44、24 張一般 fixture 24／24、Chrome 111／111 card-check 與平板 responsive geometry gate；BS5 進入 inventory 資料準備期。 |
| 2026-08-03 | 以 BS3 五色牌組為基礎完成 BS4 五色強化牌組 JSON；新增固定種子 Lv.4 每色 30 場 benchmark，五色共 150 場皆完成且無卡死。 |
| 2026-08-03 | 完成 BS4 111 張基礎卡效果稽核：攻擊 `Then` 23／23、額外能力待補 14→0；170 筆候選資料全數通過嚴格驗證並 promote 至正式卡池，重建 card pool registry；牌組編輯器新增 BS4 系列選單，並修正 HP 代價、BS4-001 自我昏厥、BS4-008 FLIP 目標、BS4-065／109 陷阱後半及 BS4-102 FLIP 選擇分支；主選單完成 AI 設定欄位 8:4 版面、測試對局入口顯示與合法牌組錯誤提示修正；新增卡牌匯入與 Chrome 逐色效果稽核 Skill。 |
| 2026-07-31 | 修正 BS3-029 昏厥目標／黃色能量付款與補位優先順序，補上 BS3-045 陷阱傷害目標及 ST2-020 攻擊目標回歸測試。線上協定新增 resolve-faint-effect paymentIds 驗證。 |
| 2026-07-31 | 功能完成與測試：BS3-029 昏厥目標選擇、黃色能量付款、補位優先順序、空場強制補位；BS3-045 damage-by-break-count 陷阱目標；ST2-020 modify-attack 不改寫攻擊目標。效果面板 optionalCostAttack 支援最小化。完整單元測試 2394 項、lint、build 通過。 |
| 2026-07-31 | R10 完整版：新增 Attacker 反擊暴露罰分（捕獲 lv4RiskBonus 不讀對手手牌與攻擊力的缺口），修正 `-= responseRiskPenalty(...)` 方向 bug；新增 r10ExposureRisk 指標與 11 條純函式行為測試。 |
| 2026-07-31 | Lv.4 回合層 beam search（w=3, d=3）：取代逐指令 greedy 評分，改以 beam 探索同一回合內的行動序列並取終端 state 最高分。300 seeds benchmark 全 PASS 且無回歸。AI 對戰預設等級改為 Lv.4。 |
| 2026-07-31 | BS3 全五色 benchmark（各 60 seeds, Lv.4 mirror）與 Playwright 瀏覽器對戰驗證腳本（`test:bs3-*:browser`）。 |
| 2026-07-30 | 完善正式卡池測試對局設定，可指定牌庫順序、HP／手牌／支援卡與能量／場景／棄牌，並新增 BS3-018／BS3-020 快速測試案例與回歸測試。 |
| 2026-07-30 | 修正場景卡詳情的官方換行，將放置場景文字與 Activate 效果分列顯示，並補上 BS3-096 回歸測試。 |
| 2026-07-30 | 調整卡牌詳情普通攻擊排版，將攻擊力徽章固定於能量／招式名稱行並保留 `Then` 後續效果。 |
| 2026-07-30 | 補上 `{sk}` Skill 技能名稱前綴透明圖片，並完成 UI 回歸測試。 |
| 2026-07-30 | 新增六種卡牌效果圖片標籤對應，支援官方全形時機標記並補上回歸測試。 |
| 2026-07-30 | 補上 `{da}` Damage 與 `{K}` 黑色能量透明圖片，並完成 UI 回歸測試。 |
| 2026-07-30 | 完成 26 張 P-0XX 特典卡逐卡稽核與正式卡池 promote；補齊餅乾技能、攻擊後、物品、FLIP、陷阱、場景與 Ancient／Marzipan／支援事件規則，新增代表性瀏覽器流程與效果覆蓋文件。 |
| 2026-07-29 | 完成 BS3 基礎卡瀏覽器載入與代表性對戰稽核；修正 BS3-024、BS3-098、BS3-121 效果流程、窄版手牌重疊與 AI 瀏覽器驗證競速；另修正 `reveal-top-deck` 巢狀效果含目標選擇時未暫停的 bug（BS3-090）及 BS3-076 攻擊後 `pendingBattle` 提前清除。 |
| 2026-07-28 | BS3-025~048 黃色卡牌全數轉換驗證；修正 BS3-023 場景卡 choose-one（補 hp-to-hand 選項）、BS3-024 啟動代價 `Make faint` 模式解析與 `activateStage()` 犧牲代價參數；新增 BS3-001~048 完整整合測試。 |
| 2026-07-26 | 依官方 Q&A 補齊 BS3-115 保護：`attackTargetOnly` 附加傷害例外、全場／棄置路徑排除，以及 BS3-019 無合法目標時 Then 裝載整段中止。 |
| 2026-07-25 | 新增 BS3 官方英文卡表候選盤點匯入與 `PURE` 通用分類／特殊費用／Mix Cost、Ancient／Soul Jam／BS3-121 runtime 基礎，追加效果覆蓋報表、來源能量付款與 18 張攻擊後 `Then` 效果；`inventory` 候選仍禁止直接 promote。 |
| 2026-07-25 | 戰場 mockup 與正式桌面對局同步採深藍桌墊、紅／青場區框、區域資訊與鏡射功能欄；移除會穿過手牌的全畫面裝飾框。 |
| 2026-07-21 | 攻擊宣告可視化：場上高亮被攻擊餅乾、於陷阱／Blocker 回應直接顯示攻擊者與目標，並在我方攻擊觸發 FLIP 時短暫顯示可外點關閉的左側大卡預覽。 |
| 2026-07-20 | 線上對戰桌版面收斂：雙方戰鬥／支援／休息區對齊、紅藍陣營邊框、對手手牌淺弧及移除中央狀態橫幅。 |

## 2026-08-11 工作狀態補充

P-0XX 127 筆已完成 `127/127` Browser 路由載入；108 筆 effect-bearing 卡已完成通用流程稽核，26 張條件／時機卡已完成 `met`／`unmet` A/B Browser 稽核，結果為 `108 passed / 0 blocked / 0 failed`。這批資料已正式 promote 到 `data/cards/official-p-0xx-remaining.en.json`，card-check 與 P-0XX Browser 稽核腳本均改讀正式檔；原始來源 metadata 的 `promotion-ready` 保留作為匯入稽核證據，不代表檔案仍在候選區。

牌組編輯器採 Master Duel 取向的 Braverse 全頁工作台：左側卡圖與數值摘要、中間依餅乾／FLIP／物品／陷阱／場景分區的主要牌組，以及右側卡池。合法性、賽制、卡池統計與 JSON 工具均收斂至頁首；卡池篩選預設收合，卡片能更早顯示。JSON 匯入使用輔助提示框，不影響工作台版面；額外牌組已開放正式 BS8，使用選填 extraDeckEntries JSON，主牌仍須60張。完整桌面、平板與窄版驗收詳見 [牌組編輯器設計驗收](docs/deck-editor-design-qa.md) 與 [設計 QA](design-qa.md)。

已重跑 `test:deck:browser` 與 `test:online:browser`：桌面 `1366×768`、窄版 `280×720` 均通過；窄版允許垂直滾動，但沒有水平溢出。牌組編輯器在手機與窄平板由頁面本身承接垂直捲動，可到達主要牌組加減按鈕與卡池；Browser gate 另涵蓋 `622×1040`、`390×844` 與 `280×720`。下一步為 P-0XX 正式牌池持續執行回歸與實戰驗證；官方新增卡牌仍先以候選資料流程隔離處理。


2026-10-11 ST7-003候選來源進度：Rainbow Sherbet 原圖獨立預期為黃色LV3／HP4，YYYY普通4、無Cookie技能；FLIP棄任意手牌恰好1張，原HP持有者補1HP，沒有額外能量／顏色／類型限制。隔離52項規則與契約回歸PASS（基線19項失敗／33項通過），21種真實runtime錯誤變異全攔、2110筆正式卡分析不變、型別零diagnostics。28案雙尺寸實際Chrome及獨立重播PASS，含實際攻擊／傷害父指令、最後HP救援、不同顏色類型代價、取消／略過、付款不足／錯色／錯時機；均為準備式局部流程，非逐卡online或完整對局。已採用候選來源guard、fixture、52項回歸與Chrome driver；實際來源6檔126項回歸及strict verified=1通過，其他來源閘門進行中，尚未promote。初版guard錯把選填cardColor視為必填，已依實際createCard改用cardColor??energyColor並新增實際runtime正例；沒有修改卡牌規則或偽造屬性。AI政策仍v10，沒有新的整體勝率提升證據。


2026-10-11 ST7-003正式進度：Rainbow Sherbet 已依原圖逐字驗證黃色LV3／HP4、YYYY普通4、FLIP棄任意1手牌→原HP持有者補1HP，完成單卡promote。候選6檔126項、正式7檔133項回歸，候選及正式build／全域lint／strict／資料及registry全部exit0；候選及正式各同28案桌機／平板原圖Chrome與獨立實際命令重播PASS，含真實攻擊／傷害父指令，仍是準備式局部驗收，非完整對局或逐卡online。Lv3～5共12案正式AI探針確認可付代價時補HP／最後HP救援，無手牌正常略過；標準AI Browser PASS。ST7正式AI覆蓋ready4／6能力／0unsupported／0conversionFailures。現45 JSON／2111卡號／2055轉換／1572 canonical AI cards；ST6～ST10為31正式／69候選（ST6=20／0、ST7=4／16、ST8=1／19、ST9=1／19、ST10=5／15），intersection=0。新完整Vitest首輪session14916已因Node原生Fatal process out of memory終止，無完整測試終值；原錯誤保留st7-003-full-vitest-run1-native-oom.log，不標示為產品assert失敗或通過。1670來源／設定／資料指紋仍一致；原程序不存在，已以相同命令獨立重跑session37357、st7-003-full-vitest-run2.log，重跑期間不再同時執行Chrome／型別檢查，尚待終值。ST7-004原圖獨立預期及runtime基線已確認，N代表任意色而既有runtime欄位為neutral；初次草稿誤用any欄位的assert已修正，非產品錯誤。004的12種strict錯誤變異只攔2／漏10，仍為output隔離診斷，未改來源／promote。AI政策仍v10，沒有新的整體或人類勝率提升證據；未commit／push。


2026-10-11 ST7-004隔離驗收：Fig Cookie 原圖獨立預期及runtime基線確認黃色LV1／HP2、N普通1，無Cookie技能／FLIP／keyword。有效型別變異重驗strict基線漏10／攔2，output-only guard及38項測試全部PASS（基線10失敗／28通過）、型別零diagnostics，2111正式卡分析不變。26案桌機1366×768／平板1164×777原圖Chrome與獨立實際指令重播PASS，涵蓋六色任意能量1支付、取消、零活躍支援、錯階段、來源REST、真實首次攻擊後禁止第二次及對原圖1HP Pink Choco造成1傷害昏厥／Break1；60原卡、唯一實體ID與同卡最多4張皆核對。仍為準備式局部驗收，非開局至勝負或online。初稿BS6-017誤寫ST6-017、兩個無效Skill／FLIP變異及driver誤等無手牌補位視窗均已修正，失敗證據保留；不計為產品缺陷。004只在output隔離區，未套用凍結來源／未promote，正式數仍31／候選69。


2026-10-11 ST7-003完整回歸終值：第二輪session37357 exit0，874檔／18,177項Vitest全部PASS，耗時1373.15秒；1670來源／設定／資料指紋一致（integrity exit0）。首輪Node原生OOM紀錄仍保留，不計為通過。此前「重跑尚待終值」為歷史狀態，現由本段取代。正式ST6～ST10仍31／100、候選69；ST7-004隔離完成，尚未套用或promote。

AI補HP／Refresh決策修正原型：使用原圖ST7-003及BS10-039、雙方各60張唯一實體卡且同卡至多4張，實際普通攻擊及陷阱傷害揭示FLIP。舊v10在Lv3／4／5都會補HP耗盡牌庫，Refresh令自身Break10，將本可獲勝的攻擊變為落敗；output-only公開資訊guard在三個等級皆略過該FLIP並接續攻擊獲勝。17項回歸PASS，舊版6失敗／11通過，涵蓋安全Break8、足夠牌庫及最後HP救援；六副既有牌表有相符卡型，但這只是靜態適用範圍，不是發生率或勝率證據。原型尚未正式採用，瀏覽器A/B、型別與同種子對照仍待驗證；不宣稱整體勝率提升。


2026-10-11 AI補HP／Refresh原型進度：TypeScript零diagnostics；桌機1366×768／平板1164×777共12案真實Chrome A/B及獨立父流程／最終指令重播全部PASS。致命Refresh舊v10落敗、原型略過FLIP後獲勝；Break8安全Refresh與足夠牌庫兩組均保留補HP並獲勝。兩次沙箱本機連線／模組解析限制及未建成prototype預覽錯誤保留，不當作產品失敗；完成兩份build後run3 exit0。624場12牌表同種子／換政策座位／換先手對照已固定快照啟動，尚待終值；原型仍未正式採用。

ST7-004已在003完整回歸及來源指紋通過後套用候選來源：精確guard、原圖fixture、38項回歸與正式Chrome driver已加入；6檔／453項來源測試PASS（包含003、ledger與demo回歸）。build／全域lint及來源Chrome尚待完成，未promote，正式數仍31／100。先前「004只在output」是歷史狀態，現由本段取代。


2026-10-11 AI補HP／Refresh同種子對照終值：624／624場有效、0 error，原型312勝／v10 312勝（50%）；不能宣稱整體勝率提高。原型補HP315次／略過11次，v10補HP316次／略過10次；交換政策座位的312對中僅1對動作數不同，seed2026142192、BS12紫對Cookierift568紫、player-one先手：原型223動作與舊版220動作，兩場皆player-two勝。這項原型消除已獨立重現的補HP自敗，但本批全局比賽未改變勝負分布。快照、種子、牌表雜湊及逐場結果保留ai-hp-flip-refresh-benchmark/，原型尚未正式採用。

ST7-004來源驗證新增：build exit0；26案實體卡Chrome及獨立指令重播exit0，與來源6檔／453項測試相符。全域lint仍為已核對存活程序，尚無終值；標準AI Browser、資料閘門及promote尚未完成。ST7-006另已讀原圖並儲存獨立預期，原始黃色LV2／HP3／YYY普通3／免費FLIP抽0～1張的raw-runtime基線PASS；初稿checker對effects鏡像／draw-up-to及undefined欄位表示的錯誤已修正，並非產品缺陷；006尚無操作／Browser驗收或promote。


2026-10-11 AI v11已套入正式來源：lv5-public-hp-flip-refresh-v11，以玩家公開資訊下界判斷純補HP FLIP是否會迫使致命Refresh，且只有原HP承載者能安全承受剩餘傷害才略過。helper不讀取隱藏牌庫或HP卡面，保留安全Refresh及補HP救援；未增加規則引擎替代實作。build exit0，正式AI來源＋隔離局面入口的桌機／平板6案Chrome與實際父流程／最終指令重播exit0，標準AI Browser exit0（開局／暫停／繼續，非完整對局或online）。來源AI回歸與新全域lint仍在執行，最後完整Vitest仍是v10＋ST7-003的874檔／18177項，不涵蓋新v11／004。此前「原型尚未正式採用」為歷史狀態，現由本段取代。624場快照對照仍為312比312，整體勝率改善未證實；此版只主張修正已重現的自敗決策。未commit／push。

2026-10-14 ST8-014～017 正式驗收：Cape of the Vanquisher、Essence of the Tempest、Wind's Grace Earrings、Hindering Darkness 已依原圖／印刷文字逐卡稽核，隔離僅含本四卡的stage通過strict驗證後promote；四張各`verified=1 / needs-review=0 / blocked=0`，sourceHash與候選稽核相同。正式卡池75檔／2,144卡號／2,088轉接，候選5檔36卡仍為inventory。24案本機卡牌Browser（1366×768及1164×777）全PASS；build、全域lint、`validate:cards`、`check:card-pool`、候選驗證及完整Vitest 983檔／20,633項（1,314.14秒）皆exit0。修正ST8-015無Wind分支在Item啟動後交接權威pending效果時，hook沿用舊本地選擇而送出過期resolve的問題，新增回歸測試。Browser只代表本機test-state流程，不代表逐卡online、完整對局或玩家勝率；候選階段Browser輸出保留，未commit／push。


2026-10-15 ST10-009 Space Doughnut 已逐卡驗收並以單卡隔離stage promote，ST6～ST10為90正式／10候選（ST10 11／9）。完整正式Browser 16／16通過，含對手回合離場抽牌後實際補位與雙玩家Refresh佇列；GPT-6.1 Sol複核關閉兩項P2。正式strict verified、validate:cards 91檔／2,170卡號／2,114轉接、候選10張inventory、registry、build與完整Vitest 1,040檔／20,929項均通過，定向ESLint通過；全域lint未完成，不列為通過。Browser為本機test-state，不代表完整對局、online或對玩家勝率；未commit／push。詳見 docs/st6-st10-card-inventory.md。
