# ST6～ST10 逐卡盤點

<!-- ai-starter-current-start -->
2026-10-16 ST9-009觸發來源重查：掃描正式卡池96個JSON檔中所有帶手牌／discard／trash字樣的Sea Fairy Cookie attack、skill與FLIP文字，找到4個canonical卡號的8筆印刷紀錄。ST9-006、BS4-073@2及BS2-029的手牌棄置都屬尖括號成本；BS11-069只把手牌卡放牌庫頂，BS4-073其餘效果不棄手牌。ST9-006 Then 是目前找到唯一可能把手牌 Wave Drop 移入棄牌區的路徑，但官方 FAQ 對成本／效果的相關例子沒有直接裁定這筆成本是否符合「by the effect」；見[官方 FAQ](https://cookierunbraverse.com/en/faq?v=1761351065)。依使用者「先promote」指示，已將 Wave Drop 以僅含 ST9-009 的 promotion-ready 隔離 stage 正式加入 `data/cards/official-st9.en.json`；正式卡牌 payload 與原候選相同，並移除單卡候選來源；本機原圖 `output/st6-st10/images/ST9-009.webp` 已目視核對 Wave Drop、LV.1／2HP及「Sea Fairy效果使其自手牌進棄牌」觸發文字。ST6～ST10目前100正式／0候選。正式 strict 仍為0 verified／1 needs-review／0 blocked，未將此 promote 視為語義驗收；候選驗證4檔／0卡inventory、`validate:cards` 97檔／2,180卡號／2,124轉換、registry check與build通過，ST9定向回歸36檔／179項（含ST9-009 trigger tests）通過；既有Browser 10／10 PASS僅覆蓋ST9-007／008，腳本明確排除ST9-009，不能列為此卡Browser驗收。ST9-009尚無實際合法Sea Fairy手牌棄置正向父流程；runtime測試只記錄現行ST9-006成本路徑行為，不裁定官方語義，也不代表online或完整對局；本批完整Vitest 1,054檔／21,082項PASS（1,366.07秒、exit0）。此盤點的96個正式JSON來源掃描是在promotion前完成。

2026-10-15 ST10-017 Inside the Clock Tower、ST10-018 Reunion of Star and Moon、ST10-020 Wizard Archives 已依原圖與印刷文字逐卡驗收，並以僅含三卡的 promotion-ready 隔離 stage promote；ST6～ST10目前**99正式／1候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 19／1、ST10 20／0）。017支付PP後可選0～1對手餅乾本回合攻擊傷害-2，Then由牌庫頂選0～3張放入棄牌區；018支付PPP後同樣可選0～1對手餅乾本回合攻擊傷害-2，Then可將0～1張己方紫色LV.3餅乾由棄牌區回手；020支付P放置場景，Activate時休息此卡後可將0～1張己方紫色LV.1戰鬥餅乾放入棄牌區。三張正式strict各1 verified／0 needs-review／0 blocked；候選到正式source hash一致，候選清單只剩ST9-009。正式Browser桌機1366×768／平板1164×777共26／26 PASS，涵蓋017選0～3張、略過目標仍續Then、018付款後合法紫色LV.3回收與非法候選排除、020放置／啟動／合法目標及無目標路徑，746×1038原圖載入。候選驗證5檔／1張inventory、`validate:cards` 96檔／2,179卡號／2,123轉換、registry check、build（2,202 modules）通過；定向回歸9檔／224項及最新完整Vitest 1,052檔／21,055項PASS（1,446.65秒、exit0）；全域`npm.cmd run lint` exit0；受影響正式程式碼ESLint（排除`output/`、`.tmp*`及附件產物）亦exit0。Vite仍提示game-demo大型chunk。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；ST9-009因尚無真實Sea Fairy效果棄置父流程仍needs-review，未promote亦未改寫來源；未commit／push。正式資料：`data/cards/official-st10-017-018-020.en.json`；formal strict：`output/st6-st10/ST10-017-contract-formal-post-ledger-fix-20261015.json`等三份；Browser：`output/st6-st10/st10-017-018-020-browser-formal-20261015/results.json`。
2026-10-15 使用者指出 ST9-009 與 ST9-006 攻擊後的 Then 有關。重查原圖和正式卡文後確認：ST9-006 的 Then 確實能將手牌中的 Wave Drop 丟入棄牌，而 `<discard 2 cards>` 是支付成本，不是後續全體傷害效果。當時依成本／效果區分預期此移動不符合 Wave Drop 的「by the effect」條件；2026-10-16 再查官方 FAQ 與規則資料，仍未找到直接裁定這筆成本是否滿足該觸發文字，因此不把預期當作官方定論。`src/game/st9-009-trigger.test.ts` 確認真實攻擊者是 ST9-006、Then 需棄2張，並驗證目前候選 runtime 在支付包含 ST9-009 的手牌後不排入被動觸發佇列；此測試只記錄實作行為，不能裁定卡面語義。BS11-069 是先抽牌再將手牌卡放牌庫頂；BS2-029 的棄牌句也是尖括號代價；BS4-073 沒有手牌棄置效果。ST9-009 維持唯一候選 `needs-review`，未 promote。印刷資料：`data/candidates/st6-st10/official-st9.en.json`；ST9-006：`data/cards/official-st9-004-006.en.json`。
2026-10-15 ST10-014 Lunar Compendium、ST10-015 Essence of Moonlight、ST10-016 Delicate Glass Flower 已依官方原圖與印刷文字逐卡驗收，並由僅含三卡的 promotion-ready 隔離 stage promote；ST6～ST10目前**96正式／4候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 19／1、ST10 17／3）。014 支付P及1張己方紫色LV.1戰鬥餅乾作代價後可對0～1對手餅乾造成1傷害；015支付PP，己方戰鬥區或棄牌區有 Moonlight Cookie 時可選0～4對手餅乾，將各自最上層1張HP移入其擁有者棄牌區；016支付P後若己方棄牌區達15張可造成1傷害，Item先進棄牌區計數，因此原有14張可生效，13張則付款後無效果。三張候選與正式 strict audit各為1 verified／0 needs-review／0 blocked，promote前後 sourceHash一致；正式 Browser 桌機1366×768／平板1164×777共16／16 PASS、0錯誤，使用746×1038原圖並覆蓋代價不足、兩種Moonlight見證及15／14／13張門檻。GPT-6.1 Sol唯讀複核無P0～P2。候選驗證5檔／4張inventory、`validate:cards` 95檔／2,176卡號／2,120轉換、registry check、promote後build（2,198 modules）及全域ESLint通過；定向回歸85項、轉接3項皆通過。promote後完整Vitest首跑發現轉接測試仍只讀候選彙總，已修成正式卡池優先、候選回退，最終全套1,046檔／20,960項PASS（1,366.60秒）。Vite仍提示game-demo大型chunk。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：`data/cards/official-st10-014-016.en.json`；strict：`output/st6-st10/ST10-014-contract-formal-20261015.json`等三份；Browser：`output/st6-st10/st10-014-016-browser/results.json`。
2026-10-15 ST10-012 Taurus Cookie 已依原圖完成逐卡驗收並正式化；ST6～ST10目前**93正式／7候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 19／1、ST10 14／6）。印刷為紫色FLIP、LV.3／4HP、PPPP普通攻擊4；實際BS6-017攻擊揭示後，棄1張任意手牌使此HP承載者補1HP，無手牌不能發動且可略過。候選與正式strict audit各1 verified／0 needs-review／0 blocked；候選驗證5檔／7張inventory、`validate:cards` 94檔／2,173卡號／2,117轉接、registry check、build（2,196 modules）通過。專項1檔／5項及定向ESLint通過；正式卡池本機Browser桌機1366×768／平板1164×777共4／4 PASS，原圖746×1038實際載入、正常點擊付款／略過、決策與結算截圖共8張，無console／頁面錯誤。GPT-6.1 Sol最終複核無P0～P2；完整Vitest留待本批末執行。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：`data/cards/official-st10-012.en.json`；strict：`output/st6-st10/ST10-012-contract-formal-final-20261015.json`；Browser：`output/st6-st10/st10-012-browser/results.json`。
2026-10-15 ST10-011 Cream Unicorn Cookie 已依原圖、印刷屬性及實際普通攻擊逐卡驗收並完成單卡 promote；ST6～ST10目前**92正式／8候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 19／1、ST10 13／7）。原圖紫色 LV.2／4HP，NNN普通攻擊3，無技能／Then／FLIP；候選與正式strict audit皆`verified=1 / needs-review=0 / blocked=0`。正式Browser桌機1366×768及平板1164×777共4／4 PASS，實付三張原始支援、目標6→3HP且來源維持4HP；兩張支援不足時無攻擊命令且區域不變。專項1檔／4項、promotion-ready stage 1檔／1卡、候選驗證5檔／8張inventory、`validate:cards`（93檔／2,172卡號／2,116轉接）、registry check、build（2,194 modules）均通過。GPT-6.1 Sol唯讀複核無P0～P3；完整Vitest 1,042檔／20,937項（1,422.04秒）exit0；全域lint因長時間無輸出而中止，不列為通過；定向ESLint通過。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：`data/cards/official-st10-011.en.json`；正式strict：`output/st6-st10/ST10-011-contract-formal-20261015.json`；Browser：`output/st6-st10/st10-011-browser/results.json`。
2026-10-15 ST10-010 Prophet Cookie 已依原圖與印刷數值逐卡驗收並完成單卡 promote；ST6～ST10目前**91正式／9候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 19／1、ST10 12／8）。原圖為紫色 LV.1／2HP，只有 N 普通攻擊1，無技能／Then／FLIP；正式strict audit `verified=1 / needs-review=0 / blocked=0`。正式卡池桌機1366×768及平板1164×777 Browser 4／4 PASS，實際支付1張紫色支援供N、對手6→5HP、來源維持2HP；缺能量路徑未產生命令或狀態變化。專項1檔／4項、候選驗證5檔／9張inventory、`validate:cards`（92檔／2,171卡號／2,115轉接）、registry、build（2,192 modules）與定向ESLint通過。GPT-6.1 Sol關閉候選重複登錄P2，無新增P0～P3；ST10-010／011批末完整Vitest通過1,042檔／20,937項（1,422.04秒）。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：`data/cards/official-st10-010.en.json`；Browser：`output/st6-st10/st10-010-browser/results.json`。
2026-10-15 ST10-009 Space Doughnut 已依原圖、印刷HP與實際離場父流程逐卡驗收，並以只含此卡的promotion-ready隔離stage promote；ST6～ST10目前**90正式／10候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 19／1、ST10 11／9）。印刷效果為此Cookie從己方戰鬥區進棄牌時抽0～1張，沒有Your Turn限制；昏厥進休息區與移至Break不觸發。候選與正式strict均`verified=1 / needs-review=0 / blocked=0`；正式雙尺寸Browser 16/16 PASS，涵蓋零／一抽、對手回合抽牌後以原版Goblin Cookie補位、雙方離場佇列、牌庫用盡Refresh及雙方補位。GPT-6.1 Sol複核關閉exact-trigger旗標與本機viewer交接兩項P2，無新增P0～P3。專項7檔／125項、`validate:cards`（91檔／2,170卡號／2,114轉接）、候選驗證（5檔／10張inventory）、strict audit、registry check、build（2,190 modules）、本批檔案定向ESLint及完整Vitest（1,040檔／20,929項，1,342.41秒）均exit0；全域lint本批未完成，不能列為通過；Vite仍提示game-demo大型chunk。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：`data/cards/official-st10-009.en.json`；strict audit 已由 CLI 驗證；Browser：`output/st6-st10/st10-009-browser/results.json`。
2026-10-15 ST10-006 Blueberry Pie Cookie 已依原圖、印刷屬性與實際離場父流程逐卡驗收，並以單卡隔離stage promote；ST6～ST10目前**89正式／11候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 19／1、ST10 10／10）。印刷效果為【Your Turn】此餅乾由己方戰鬥區直接進棄牌時，選0～1對手餅乾造成1傷害；昏厥進休息區及移至Break不屬此觸發。GPT-6.1 Sol規格複核發現ST10-013 Little Star以餅乾支付費用直接棄牌時未接續離場技能，已修正並以實際P費用重驗；候選、stage、正式strict各1 verified／0 needs-review／0 blocked，候選與stage sourceHash一致。正式桌機1366×768與平板1164×777 Browser 8/8 PASS，涵蓋正向指定／選零、Little Star代價送棄牌、對手回合不觸發與原圖載入。專項3檔／10項，離場規則與Item／Stage回歸5檔／79項；validate:cards（90檔／2,169卡號／2,113轉換）、候選驗證（5檔／11張inventory）、registry check、build（2,188 modules）、全域ESLint及完整Vitest 1,037檔／20,901項（1,352.41秒）均exit0；Vite仍提示game-demo大型chunk。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：data/cards/official-st10-006.en.json；Browser：output/st6-st10/st10-006-browser/results.json。
2026-10-15 ST10-005 Dreamcatcher 已依原圖、印刷資料與真實 On Play 流程逐卡驗收，並以僅含此卡的隔離 stage promote；ST6～ST10目前**88正式／12候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 19／1、ST10 9／11）。ST10-005支付棄1張任意手牌後，僅在己方戰鬥區有Moonlight Cookie時可對0～1對手Cookie造成1傷害；正反條件、付款後檢查、選零、缺代價不可發動及P普通攻擊實際支付／錯色反例均已驗證。候選、stage、正式strict均verified=1／needs-review=0／blocked=0且sourceHash一致；正式桌機1366×768與平板1164×777 Browser 10/10 PASS。GPT-6.1 Sol複核關閉強制點擊P2，未見新P0／P1／P2。專項2檔／9項、validate:cards（89檔／2,168卡號／2,112轉接）、候選驗證（5檔／12張inventory）、registry check、build、全域ESLint與完整Vitest 1,034檔／20,891項（1,396.76秒）均exit0；Vite仍提示game-demo大型chunk。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：data/cards/official-st10-005.en.json；Browser：output/st6-st10/st10-005-browser/results.json。
2026-10-15 ST10-001 Dreamweaver Cookie、ST10-003 Poison Mushroom Cookie、ST10-004 Wizard Cookie 已依原圖與印刷資料逐卡驗收，並以隔離 stage 逐卡 promote；ST6～ST10目前**87正式／13候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 19／1、ST10 8／12）。001／003支付PPP完成普通攻擊3，001 FLIP只回手揭示卡、003抽0～1；004支付P可將實際攻擊轉向自身，Wizard 3→2 HP且原目標不受傷，亦驗證付PN普通攻擊1使Devil Cookie 4→3 HP。004候選、stage、正式strict均verified=1／needs-review=0／blocked=0且sourceHash一致；正式桌機1366×768與平板1164×777 Browser 10/10 PASS，涵蓋使用／略過Blocker、無紫能量、PN支付與缺N；001／003正式Browser 14/14 PASS。GPT-6.1 Sol指出的舊driver P2及ST10-004普通攻擊驗收缺口均已修正並複查關閉。ST10-004專項4檔／32項、validate:cards（88檔／2,167卡號／2,111轉接）、候選驗證（5檔／13張inventory）、registry check、build、全域ESLint與完整Vitest 1,032檔／20,882項（1,353.40秒）均exit0；Vite仍提示game-demo大型chunk。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：data/cards/official-st10.en.json；Browser：output/st6-st10/st10-004-browser/results.json。
2026-10-15 ST9-015 Essence of the Ocean 依原圖與印刷資料逐卡驗收，以只含此卡的隔離 stage promote；目前**84正式／16候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 19／1、ST10 5／15）。印刷效果為支付B後，使用後手牌至多5張才抽0～1；Then獨立選0～1己方剩餘HP至多5的Sea Fairy Cookie補1。stage／正式strict均`verified=1 / needs-review=0 / blocked=0`，sourceHash一致；雙尺寸正式Browser 10/10 PASS，包含抽牌門檻、Then順序、零目標及己方非Sea Fairy／對手Sea Fairy／6HP Sea Fairy的排除。GPT-6.1 Sol複核未見P0／P1／P2。專項3檔／17項、`validate:cards`（86檔／2,164卡號／2,108轉接）、候選驗證（5檔／16張inventory）、registry check、build、全域lint及批末完整Vitest 1,026檔／20,848項（1,388.05秒）均exit0。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：`data/cards/official-st9-015.en.json`；strict：`output/st6-st10/ST9-015-contract-formal-20261015.json`；Browser：`output/st6-st10/st9-015-browser/results.json`。
2026-10-14 ST9-014 Glittering Pearl Shell 已依原圖及印刷資料逐卡驗收，並以只含此卡的隔離stage promote；目前**83正式／17候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 18／2、ST10 5／15）。藍色道具支付BB、棄3張牌後選0～1己方Cookie補2HP。候選、隔離stage與正式strict皆`verified=1 / needs-review=0 / blocked=0`且sourceHash一致。正式雙尺寸Browser 10/10 PASS，實際驗證3張手牌代價、選一／零目標、取消草稿與無支援／手牌不足；原圖及命令紀錄已核對。專項3檔／17項、`validate:cards`（85檔／2,163卡號／2,107轉接）、候選驗證（5檔／17張inventory）、registry check、build、全域lint exit0；批末完整Vitest 1,023檔／20,831項PASS（1,383.11秒，exit0）。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：`data/cards/official-st9-014.en.json`；正式契約：`output/st6-st10/ST9-014-contract-formal-final-20261014.json`；Browser：`output/st6-st10/st9-014-browser/results.json`。
2026-10-14 ST9-013 Shimmering Moonlit Coral 已依原圖及印刷資料逐卡驗收，並以只含此卡的隔離stage promote；目前**82正式／18候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 17／3、ST10 5／15）。藍色道具支付B並另棄1張藍色手牌後抽0～2張。候選、隔離stage及正式strict均`verified=1 / needs-review=0 / blocked=0`且sourceHash一致。正式雙尺寸Browser 12/12 PASS，涵蓋抽0／1／2、付款草稿取消與重開、草稿期間區域不變、無藍色手牌／支援時禁止使用；原圖與命令紀錄均核對。專項3檔／17項、`validate:cards`（84檔／2,162卡號／2,106轉接）、候選驗證（5檔／18張inventory）、registry check、build及定向ESLint exit0；批末完整Vitest 1,020檔／20,814項PASS（1,314.73秒，exit0）。GPT-6.1 Sol複核的區域不變P2已補足並關閉，未發現新P0／P1／P2。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：`data/cards/official-st9-013.en.json`；正式契約：`output/st6-st10/ST9-013-contract-formal-final-20261014.json`；Browser：`output/st6-st10/st9-013-browser/results-formal-accepted-20261014.json`。
2026-10-14 ST9-012 White Pearl Cookie 已依原圖與印刷資料逐卡驗收，並以只含此卡的隔離stage promote；目前**81正式／19候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 16／4、ST10 5／15）。LV1／HP2；On Play 手牌至多4張時可抽0～2；BB普通2後可選擇由支援區支付B，僅在己方戰鬥區有Sea Fairy Cookie時，對0～1對手Cookie造成1傷害。候選／正式strict均`verified=1 / needs-review=0 / blocked=0`且sourceHash相同。正式雙尺寸Browser 18/18 PASS，涵蓋登場後剛好4張手牌、抽0／1／2、高手牌、Then支付／零目標／略過、僅剩紅色支援無法支付藍色B及缺Sea Fairy；命令紀錄與HP／支援狀態均核對。專項3檔／19項、`validate:cards`（83檔／2,161卡號／2,105轉接）、候選驗證（5檔／19張inventory）、registry check、build與完整Vitest（1,017檔／20,797項，1,347.63秒）exit0；定向ESLint與Browser腳本語法檢查通過。全域lint執行逾7分鐘無輸出後中止，不列為通過。Browser為本機test-state，不代表逐卡online、完整對局或玩家勝率；未commit／push。正式資料：`data/cards/official-st9-012.en.json`；正式契約：`output/st6-st10/ST9-012-contract-formal-20261014.json`；Browser：`output/st6-st10/st9-012-browser/results.json`。
2026-10-14 ST9-010～011 依原圖與印刷資料逐卡驗收，並以只含兩張卡的隔離stage promote：目前**80正式／20候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 15／5、ST10 5／15）。Parfait Cookie（HP1）與Frilled Jellyfish Cookie（HP4）都是藍色FLIP：玩家支付棄1張手牌後，附著餅乾補1HP；無手牌時可明確選擇不發動。候選及正式strict各`verified=1 / needs-review=0 / blocked=0`，逐卡sourceHash一致。正式Browser桌面1366×768／平板1164×777共8/8 PASS；玩家實際操作支付與略過UI、FLIP紀錄及HP／牌庫／棄牌變化均核對。專項5檔／30項、build、`validate:cards`（82檔／2,160卡號／2,104轉接）、候選驗證（5檔／20張inventory）、registry check及完整Vitest 1,014檔／20,778項（1,307.25秒）皆exit0。最新變更檔定向ESLint與`git diff --check`通過；全域lint本次長時間無輸出後中止，不列為通過。ST9-009仍保留候選needs-review，原因為尚無已確認的Sea Fairy Cookie效果將本人手牌Cookie送入棄牌區。Browser為本機test-state，不代表逐卡online、完整對局勝負或玩家勝率；未commit／push。正式資料：`data/cards/official-st9-010-011.en.json`；正式契約：`output/st6-st10/ST9-010-contract-formal-20261014.json`、`output/st6-st10/ST9-011-contract-formal-20261014.json`；Browser：`output/st6-st10/st9-010-011-browser/results.json`。
2026-10-14 ST9-007～008 逐卡驗收並以僅含兩張卡的隔離stage promote：目前**78正式／22候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 13／7、ST10 5／15）。ST9-007／008候選及正式strict各`verified=1 / needs-review=0 / blocked=0`；正式Browser 10/10 PASS，桌面1366×768、平板1164×777，原圖746×1038，涵蓋抽0／1、高手牌不發動、On Play回手代價與無合法目標略過。`validate:cards`為81檔／2,158卡號／2,102轉接，候選驗證5檔／22張inventory，registry／build通過；完整Vitest 1,011檔／20,762項（1,303.40秒）exit0。最新改動檔定向ESLint與`git diff --check`通過；本次全域lint長時間無輸出後中止，不能列為通過。ST9-009仍是候選及1張needs-review：沒有已確認的Sea Fairy Cookie效果把本人手牌Cookie移入棄牌區；尖括號代價及移到牌庫底不作正向觸發依據，未promote。GPT-6.1 Sol複核手牌觸發佇列修補未發現新P0／P1／P2。Browser為本機test-state，不代表逐卡online或玩家勝率；未commit／push。證據：`data/cards/official-st9-007-008.en.json`、`output/st6-st10/ST9-007-formal-contract-20261014.json`、`output/st6-st10/ST9-008-formal-contract-20261014.json`、`output/st6-st10/st9-007-009-browser/results.json`。
2026-10-14 ST9-004～006 已依原圖與印刷資料逐卡驗收，並以只含三張卡的隔離stage promote：**76正式／24候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 11／9、ST10 5／15）。ST9-004 Pond Dino Cookie（LV2／HP3、BBB普通3、FLIP抽0～1）由真實攻擊翻開並交防守方操作FLIP，抽0／1均實際結算；ST9-005 Mystic Opal Cookie（LV1／HP3、支付B後將攻擊改指向自身）完成合法Blocker付款與錯色不可使用反例；ST9-006 Sea Fairy Cookie（LV3／HP6、手牌至多5時Activate抽0～1；BBB攻擊Then棄2張手牌後對所有對手Cookie各造成1傷害）驗證手牌條件正反、實際棄牌、全體合法目標必須選齊及傷害結算。候選與正式strict各三張均`verified=1 / needs-review=0 / blocked=0`，promotion前後原始卡片記錄逐筆相同；候選彙總只移除此三張，保留ST9-007～015。正式Browser 18/18 PASS（桌面1366×768、平板1164×777各9案）；定向測試9檔／54項、build、全域lint、`validate:candidate`（5檔／24張inventory）、`validate:cards`（80檔／2,156卡號／2,100轉接）、registry check，以及完整Vitest 1,008檔／20,741項（1,370.30秒）皆exit0。GPT-6.1 Sol複查未發現尚存產品、規則或Browser缺陷。Browser為本機test-state流程，不代表逐卡online、完整對局至勝負或玩家勝率；AI整體勝率仍未驗證。未commit／push。正式資料：`data/cards/official-st9-004-006.en.json`；Browser證據：`output/st6-st10/st9-004-006-browser/results.json`。

2026-10-14 ST9-001～003 已依原圖及實體印刷資料逐卡驗收，並以只含三卡的隔離stage promote：**73正式／27候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 8／12、ST10 5／15）。Gold Citrine Cookie（NNN普通3、HP4）及Aquamarine Cookie（N普通1、HP2）完成真實能量付款與攻擊；Blue Whale Cookie（BBB普通3、HP4）完成攻擊後翻出自身FLIP，正式紀錄指明Blue Whale發動FLIP、對手手牌增加1，且攻擊目標結算至1HP。三張候選strict各`verified=1 / needs-review=0 / blocked=0`，promote後正式strict也各為1／0／0。正式Browser 12/12 PASS（桌面1366×768、平板1164×777各6案），原圖746×1038，涵蓋三種攻擊費用與不足能量不得攻擊；正式卡池79檔／2,153卡號／2,097轉接，候選5檔27卡全為inventory。`validate:candidate`、`validate:cards`、registry check及promote後build皆exit0；Browser腳本eslint／node check與`git diff --check`通過。全域lint重跑exit0；批末完整Vitest 1,002檔／20,717項PASS（1,425.66秒、exit0）。Browser為本機test-state，不代表逐卡online、完整對局至勝負或玩家勝率；AI整體勝率尚未驗證。未commit／push。證據：`output/st6-st10/ST9-001-formal-contract-20261014.json`、`output/st6-st10/ST9-002-formal-contract-20261014.json`、`output/st6-st10/ST9-003-formal-contract-20261014.json`、`output/st6-st10/st9-001-003-browser/results.json`。

2026-10-14 ST9-020 Tearcrown 已依原圖、印刷資料與實際指令逐卡驗收並由只含此卡的隔離 stage promote：**70正式／30候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 5／15、ST10 5／15）。原圖為B放置；Activate只REST來源，手牌至多3時抽0～1。實際驗證手牌超過3時仍可支付REST並明確跳過抽牌；正向抽0／1皆完成。strict候選及正式資料各`verified=1 / needs-review=0 / blocked=0`且sourceHash相同。正式Browser 6/6 PASS（桌面1366×768、平板1164×777各3案）；正式卡池78檔／2,150卡號／2,094轉接，候選5檔30卡全為inventory；candidate/card驗證、registry check、build、全域lint及完整Vitest 997檔／20,691項PASS（1,385.73秒，exit0）。Browser為本機test-state，不代表逐卡online、完整對局至勝負或玩家勝率；AI整體勝率尚未驗證。未commit／push。證據：`output/st6-st10/ST9-020-formal-contract-20261014.json`、`output/st6-st10/st9-020-browser/results.json`、`output/st6-st10/st9-020-full-vitest-20261014.log`。

2026-10-14 ST8-019／020 已依原圖與正式資料逐卡驗收，並由只含本兩卡的隔離 stage promote：**66正式／34候選**（ST6 20／0、ST7 20／0、ST8 20／0、ST9 1／19、ST10 5／15）。ST8-019 Bad Omen 為GG陷阱，0～1對手餅乾本回合攻擊-2；Then雙方支援相等時，同一目標再-1。ST8-020 Dark Enchantress Laboratory 支付G放置並疲勞；己方回合結束時場景進棄牌區，選0～2張己方支援轉為活躍。兩張各strict `verified=1 / needs-review=0 / blocked=0`；正式資料strict與候選稽核雜湊一致。ST8-019／020正式Browser各6/6 PASS，共12案，桌面1366×768及平板1164×777均涵蓋；實際確認付款、效果目標、傷害／攻擊數值、Then條件、場景放置及回合結束。正式卡池`validate:cards` 76檔／2,146卡號／2,090轉接，`check:card-pool`、候選5檔34卡inventory驗證、build、全域lint皆exit0；完整Vitest 989檔／20,648項PASS（1,322.63秒、exit0）。候選原檔只移除019／020並保留其餘inventory。Browser是本機test-state流程，不代表逐卡online、完整對局至勝負或玩家勝率；未commit／push。正式Browser輸出：`output/st6-st10/st8-019-browser/results.json`、`output/st6-st10/st8-020-browser/results.json`。其餘待辦為ST9／ST10候選逐卡驗收及AI決策品質批次驗證。

2026-10-14 ST8-014～017 已依原圖及印刷資料逐卡驗收，並以只含本四卡的隔離stage promote：**64正式／36候選**（ST6 20／0、ST7 20／0、ST8 18／2、ST9 1／19、ST10 5／15）。ST8-014 Cape of the Vanquisher：G、支援區至少5張時，選0～1張己方剩餘HP不高於3的綠色Cookie補1HP；ST8-015 Essence of the Tempest：GG、場上或支援區有Wind Archer時牌庫頂至多1張置支援疲勞，Then回收至多1張支援；ST8-016 Wind's Grace Earrings：G、己方戰鬥區有Wind Archer且支援至少5張時，對所有對手Cookie各造成1傷害；ST8-017 Hindering Darkness：GG陷阱，選0～1張對手Cookie本回合攻擊傷害-2，Then僅雙方支援張數相同時抽0～1。四張正式 strict contract 各 `verified=1 / needs-review=0 / blocked=0`，sourceHash與候選稽核相同。正式卡池 `validate:cards` 75檔／2,144卡號／2,088轉接、`check:card-pool`、候選5檔36卡inventory驗證、build、全域lint皆exit0。正式卡圖Browser共24/24 PASS：014 4、015 10、016 4、017 6，全部含1366×768及1164×777；涵蓋付款、條件正反、Then、傷害與陷阱結算。完整Vitest 983檔／20,633項PASS（1,314.14秒、exit0）。Browser為本機test-state實際UI，不代表逐卡online、完整對局至勝負或玩家勝率；未commit／push。候選階段Browser原始輸出另保存於各`*-candidate-run1-preserved`目錄。下一批仍有ST8-019／020及其餘ST9／ST10候選待逐卡處理。

2026-10-13 ST8-004～013 逐卡狀態及批末全域回歸刷新：正式資料／registry包含十張，十張 strict contract 各 `verified=1 / needs-review=0 / blocked=0`；ST8-012依使用者裁定只計自己啟動的Item。完整Vitest 969檔／20,556項PASS（1275.15秒、exit0），全域lint、build與標準AI Browser六項檢查PASS；標準AI Browser只驗開局／暫停流程，不代表逐卡驗收。ST8-013桌面正反與平板正向已驗，平板反向仍未驗；逐卡online、完整對局至勝負及玩家勝率未驗證，未commit／push。

2026-10-13 ST8-013 已單卡 promote：**60正式／40候選**（ST6 20／0、ST7 20／0、ST8 14／6、ST9 1／19、ST10 5／15）。原圖 Windgrass 綠色 Item，固定支付 G；先選0～1張對手支援橫置，Then 僅在己方戰鬥區有 Wind Archer Cookie 時，選0～1張己方支援卡轉為活躍。strict contract 1 verified、30種錯誤runtime變異拒絕；隔離單卡候選嚴格驗證後 promote。正式資料74檔／2140卡號／2084轉接、registry check、build、全域lint及3檔13項針對性Vitest通過。Browser test-state 實際UI：桌面正向／反向通過，正向平板通過；反向平板未驗（viewport覆寫未生效，實際仍為1907×863）。完整Vitest未重跑。逐卡online、完整對局至勝負、AI勝率未驗證，未commit／push。

2026-10-13 ST8-012 已單卡 promote：**59正式／41候選**（ST6 20／0、ST7 20／0、ST8 13／7、ST9 1／19、ST10 5／15）。原圖 Windcatcher 綠LV1／HP2、GG普通2；Activate REST來源，本回合由自己啟動Item才對0～1對手造成1傷害；Then獨立支付支援區G，選0～1己方Wind Archer Cookie補1HP，無Once。依使用者決議只認列卡片擁有者自己啟動的Item；效果條件在結算時檢查，不成立時跳過傷害但仍保留Then。strict contract 1 verified；隔離候選1檔／1卡通過嚴格 validate 並單卡 promote；候選 A/B test-state Browser 實際操作通過：正向啟動自身Item後傷害對手1，支援支付G後 Wind Archer 6→7 HP；負向未啟動Item仍可合法啟動，明確no-op且對手HP不變，仍可完成獨立Then。promote後正式資料驗證73檔／2139卡號／2083轉換PASS、registry check PASS、build PASS、受影響5檔104項PASS；完整Vitest 966檔／20532項PASS（1580.97秒、exit0）、全域lint／build PASS；ST6～ST10剩餘候選5檔41卡來源／結構驗證PASS，仍為inventory。原始ST8候選清單僅移除此卡並將importedCount 8→7。未驗證逐卡online、一般完整對局至勝負或玩家勝率；test-state效果操作不冒充上述驗收。未commit／push。證據：output/st6-st10/st8-012-promotion-evidence/strict-report.json。

2026-10-13 ST8-011 已逐卡 promote 並正式重驗，**58正式／42候選**（ST6 20／0、ST7 20／0、ST8 12／8、ST9 1／19、ST10 5／15）。原圖Kiwi Cookie綠LV1／HP3、GN普通1，G Blocker將攻擊轉向本來源，不加REST來源／Once／YourTurn／FLIP／Then。正常adapter已符合卡面；補精確契約後，原先21個漏拒變異修復，53種有效錯誤runtime全拒，58項契約測試通過。候選最終3檔171項、契約共享5檔185項及Blocker共享4檔64項、正式13檔450項通過。候選與正式各80案雙尺寸Chrome、各4案實際Lv5，完整初始／真實父命令／最終GameState與canonical紀錄的獨立重播及來源指紋通過。真1／2／3普通傷害、疲勞來源可Block、同回合真第一次Block父流程後再付第二張G、雙Kiwi已是原目標者不可再Block、唯一餅乾真昏厥後強制補位及最後牌庫Refresh均驗。GN第二支援分別實際支付六種顏色；新增卡色斷言抓到原測試假黑素材，已依正式raw與原圖改成BS11-092 BLACK，失敗run與斷言完整保留。Lv3～5真G支付保護原本會被2傷害擊倒的HP2餅乾，Kiwi由HP3降1；缺G只有紅支援則合法略過，未宣稱對人類勝率提升。正式build／受影響lint／72檔2138卡號2082轉接／registry／strict／標準AI Browser／ST1核心同步通過。完整Browser首輪15PASS後因棄牌區下方Kiwi原圖定位逾時失敗，改經正常公開棄牌viewer核圖，再整輪重驗；不以partial或放寬圖像檢查通過。012原圖與付款規格覆核準備：沿目前通用專案規則選活躍支援G付款，不是新增個別官方FAQ裁定，012仍未驗收。既有7張正式卡仍待本輪重驗；官方五組各60張已確認，但精確逐卡配比仍缺官方來源，未猜測填入。本批010～012全域lint／完整Vitest仍待批末；上一批007～009修後組合驗證不涵蓋本批且沒有新的全套exit0。逐卡online、完整UI開局至勝負及對人類勝率未驗收，未commit／push。證據：output/st6-st10/st8-011-promotion.json、output/st6-st10/st8-011-browser-candidate-run2/independent-replay-audit.json、st8-011-browser-formal-run1/independent-replay-audit.json、st8-012-payment-spec-review.md。

2026-10-13 ST8-010 已逐卡 promote 並正式重驗，**57正式／43候選**（ST6 20／0、ST7 20／0、ST8 11／9、ST9 1／19、ST10 5／15）。原圖 Cookiemals 綠LV1／HP2、G普通1；昏厥先將己方支援恰好1張任意色／可已橫置的物品卡回手作代價，再選牌庫頂0～1張放入支援疲勞，沒有Then／FLIP／Once／YourTurn。補齊原本缺失的技能與物品成本轉接，修正共用昏厥模式必須先付成本；選0仍支付、付款前可不發動、非法命令不改原狀態，保留原父效果／戰鬥與context。55種錯誤runtime全拒絕；候選5檔177項及共享11檔315項、正式17檔522項通過。候選與正式各106案雙尺寸Chrome、各4案實際Lv5，獨立完整初始／真實父命令／最終GameState及canonical紀錄重播與來源指紋通過。真正普通傷害、自己攻擊被Kumiho印刷FLIP1反傷（之前真普通1）、ST7-013實付YY與黃色棄牌餅乾代價的效果傷害、同回合第二張Cookiemals昏厥、空牌庫Refresh、唯一餅乾強制補位均已操作，正常結算無卡死pending。正式build／受影響lint／71檔2137卡號2081轉接／registry／strict／標準AI Browser／ST1核心同步通過；ST1首輪進遊戲前networkidle逾時失敗保留，卡牌Browser終止後同版本隔離重跑通過。ST8-011已原圖與來源準備，尚未驗收；既有7張正式卡仍需本輪逐卡重驗。官方五組各60張已確認，但官方海報沒有逐卡張數且官方商店HTTP429，精確預組配比仍缺來源。上一批007～009完整Vitest首輪955檔20100項有1項舊庫存預期失敗，修後該檔30項與其餘來源未變的954檔組合驗證已保留，沒有新全套exit0；該證據不涵蓋010改動，本批全域lint及完整Vitest仍待批末。逐卡online、完整UI對局與對人類勝率未驗收，未commit／push。證據：output/st6-st10/st8-010-promotion.json、st8-010-browser-candidate-run1/independent-replay-audit.json、st8-010-browser-formal-run1/independent-replay-audit.json。

2026-10-13 ST8-009 已逐卡 promote 並正式重驗，**56正式／44候選**（ST6 20／0、ST7 20／0、ST8 10／10、ST9 1／19、ST10 5／15）。原圖 Cucumber Cookie 綠LV2／HP3、GGG普通3，免費HP FLIP抽0～1，沒有Skill／Then／手牌門檻或補HP；48種錯誤runtime全拒絕。候選最終5檔149項／共享6檔313項、正式12檔377項、build／受影響lint／資料70檔2136卡號2080轉接／registry／strict／標準AI Browser／ST1核心同步皆PASS。候選與正式各102案雙尺寸Chrome、各4案實際Lv5，主代理獨立完整初始狀態、真實父命令、最終GameState與紀錄重播及來源指紋PASS；兩層不重複累加。兩張不同instance FLIP各自選0／1、真正最後牌庫Refresh、最後HP仍昏厥、新抽Goblin真補位及原印刷OnPlay略過均已操作。發現test-state捷徑會略過第二FLIP，修成公開卡牌／預組preview逐點續接；一般對局不走該捷徑，未推稱production同缺陷。原失敗與修復證據完整保留，未放寬斷言。ST8-010來源核對確認Quick Roll尚未轉接、Item支援回手成本尚未分類；僅來源準備，不算驗收。既有7張正式卡仍需本輪逐卡重驗。官方五組各60張已確認，但目前官方海報無逐卡張數且官方商店HTTP429，精確預組配比仍缺來源，未猜測填入。批末完整Vitest首輪955檔／20100項：954檔20099項通過，僅1項舊庫存預期失敗（exit1保留）。獨立原始資料核對2080印刷／1597機制後，盤點測試改為嚴格對照正式來源並補008／009能力檢查，該檔30項及lint通過；其餘1823項來源指紋完全相同，沿用954檔通過證據。全域lint通過；修後未重跑全套，此為組合驗證，沒有新的全套exit0。逐卡online、完整UI對局與對人類勝率未驗收，未commit／push。證據：output/st6-st10/st8-009-full-acceptance.json、st8-009-ai-inventory-check.md、st8-009-promotion.json、st8-009-browser-candidate-run1/independent-replay-audit.json、st8-009-browser-formal-run1/independent-replay-audit.json、starter-recipes-source-report.md。

2026-10-13 AI公開禁止補HP付款修正正式局部驗收完成：真實BS9-035原圖目視與棄1Activate父效果、Devil Cookie NNN3揭示ST8-007；AI僅對被公開禁止的純attached HP、一般正棄牌代價預設不付費，保留免費／detached／特殊目的地／其他有效效果。45正式測試舊9fail36pass→全PASS，最終相關6檔199項、build3／scopedlint4／標準AI BrowserPASS。手動及actualLv5×雙尺寸4案Chrome、主代理獨立完整父命令／最終GameState重播PASS；AI略過時手牌不減，之後兩案皆真實replace-cookie補位。相同規則凍結舊版與正式新版9個Lv3～5決策各保留1手牌且HP／牌庫相同，非整體勝率證明。Browser run1紀錄群組未展開導致縮圖找不到，driver修後run2 PASS；根據battle-replay.ts匯出格式，initialState分開commandLog，父序列及最終完整紀錄另精確比對。來源交換曾省略undefined／改變audience順序，已從交換後prepared state真正重播父命令，保留完整斷言；失敗紀錄均留存。ST8-008原圖及5案60張實體父流程基線證實兩段效果缺失；新增支援區具名predicate、AI支援差值<=修正及Then新抽牌／Refresh UI尚待實作／驗收，未promote。正式仍54／46；完整Vitest940檔為ST8-006終值，不含007及本AI，後續批末需回歸。未commit／push。證據：output/st6-st10/ai-blocked-hp-flip-acceptance.json、ai-blocked-hp-flip-browser-formal-run2/independent-replay-audit.json、st8-008-preparation-report.md、st8-008-condition-integration-map.md。

2026-10-13 ST8-007正式重驗完成：**54正式／46候選**（ST6 20／0、ST7 20／0、ST8 8／12、ST9 1／19、ST10 5／15）。原圖綠LV1／HP1、GG普通2，FLIP任意手牌恰1→實際HP承載者+1；own-carrier自身1HP補1後剩餘NNN3傷害昏厥與不發動分開驗。精確契約23種錯誤runtime全拒絕，候選2檔94項、共享5檔210項、正式4檔124項、build／受影響lint／資料68檔2134卡號2078轉接／registry／單卡strict 1 verified／標準AI BrowserPASS。候選run2與正式run1各74案雙尺寸Chrome、各含8案實際Lv5，主代理逐筆獨立父指令與最終GameState重播一致並核對關鍵畫面；兩層不重複累加。候選run1第33案僅driver要求逐點指令而UI實際resolve-battle，失敗完整保留，修後一次重跑全矩陣PASS。兩agent分別完成Browser審查／執行與AI反例原型；AI尚未改產品。完整Vitest940檔19627項為前一批ST8-006終值，ST8-007本輪修改須納入後續批末完整回歸。未commit／push，逐卡online、完整UI對局及人類勝率未驗收；下一張ST8-008僅委派原圖與隔離準備。證據：output/st6-st10/st8-007-promotion.json、st8-007-browser-candidate-run2/replay-audit.json、st8-007-browser-formal-run1/replay-audit.json、ai-blocked-hp-flip-policy-results.json。

2026-10-13 ST8-006批末終值：完整Vitest **940檔／19,627項PASS**，1061.35秒、exit0；全域lint exit0，1800份來源／設定／資料指紋一致，凍結解除。該全套包含ST8-005呈現修正，不含後續ST8-007候選產品修改。ST8-007已套入精確契約／實體fixture，失敗基線27項中21失敗、6通過，修後2檔94項PASS；own-carrier實際1HP承載者受NNN3、FLIP補1後剩餘傷害昏厥與略過保留手牌分開驗。build1、scopedlint1、strict1 verified PASS；使用者授權並行agent後修正Browser遺留四支援點選，74案雙尺寸候選Chrome已分派執行，尚未promote。AI準備式旗標探針找到禁止補HP時仍支付純HP FLIP，18+3項探針PASS但非實體父流程；另有agent補BS9-035 Cookie Activate Once真實父效果，不提前改正式政策或宣稱勝率提升。正式數量仍53／47，未commit／push。證據：output/st6-st10/st8-006-full-acceptance.json、st8-007-candidate-targeted2.log、st8-007-draft-review.md、ai-prevent-hp-flip-probe.md。下方仍凍結／全套執行中的敘述為較早快照。

ST8-006批末更新：全域lint run1已完成exit0，完整Vitest仍為原session28563執行中，不重啟、不宣稱全套PASS。正式53／候選47僅表示卡池位置；既有ST8-018、ST9-016及ST10-002／007／008／013／019的本輪逐卡驗收仍須依序補齊，不能用既有promote或全域回歸代替。官方ST8產品頁確認60張預組及另附推廣卡，但未列各卡張數，未據此猜測構築配比。證據：output/st6-st10/st8-006-global-lint-run1-exit.txt、st8-official-product-live.json。

ST8-007 隔離準備（2026-10-13，產品來源仍凍結）：原圖目視確認 Blue Slushy Cookie 綠色LV1／HP1、GG普通2、FLIP棄恰好1張任意手牌後僅HP承載者補1。舊通用契約接受21種錯誤runtime，輸出區精確守衛拒絕23／23；23個原始60張卡局面、唯一ID與四張限制、完整實際父指令重播、手牌登場1HP、GG2擊倒及Lv3～5六個救援／無法支付決策通過原型檢查。專用規則／變異與雙尺寸Browser草稿已備，但未套入產品、未Browser驗收、未promote。ST8-006批末完整Vitest及全域lint仍由原handle執行，1800份來源指紋中途核對一致；正式數量仍53／47。證據：output/st6-st10/st8-007-printed-expectation.json、st8-007-prototype-checks.json。

2026-10-13 ST8-006 Basil Pesto Cookie 已逐卡驗證並 promote，**53正式／47候選**（ST6 20／0、ST7 20／0、ST8 7／13、ST9 1／19、ST10 5／15）。原圖綠色LV3／HP4、GGGG普通4；FLIP可不發動，發動須棄恰好1張任意色／類型手牌，僅實際HP承載者補1，最後HP救援後仍繼續剩餘傷害。23種錯誤runtime全拒絕，專用2檔91項、正式4檔122項與通用網址4項通過；實際ST7-018先補HP後揭示的超過印刷HP、最後牌庫Refresh、無手牌／取消／超選及六色代價均分開驗證。候選run2與正式run1各72案雙尺寸Chrome、各含8案實際Lv5，完整父指令與最終GameState獨立重播通過，不重複累加。build、資料67檔／2133卡號／2077轉接、registry、單卡strict 1 verified及標準AI Browser通過。首輪Vitest因沙箱暫存檔rename權限未執行任何測試，本機重跑通過；失敗保留。完整Vitest session28563與全域lint session90234已啟動，1800份來源／設定／資料凍結，尚無終值；包含ST8-005呈現修正，不沿用修正前全套。證據：output/st6-st10/st8-006-browser-candidate-run2/results.json、st8-006-browser-formal-run1/replay-audit.json、st8-006-formal-targeted2.log、st8-006-full-source-manifest.json。未commit／push；逐卡online、完整UI對局及人類勝率未驗證。以下為較早快照。

2026-10-13 ST8-005 呈現修正：使用者確認自身HP未減少，但攻擊後紀錄將額外橫置支援與傷害目標混列，且效果REST動畫朝來源餅乾移動。已分列「額外橫置支援／傷害目標」，效果REST留在支援區，普通攻擊能量支付動畫保留；失敗基線6項中5項失敗，修後6檔116項、build及受影響lint通過。使用者原網址標準動畫4案（直接攻擊／先物品×雙尺寸）、完整指令／狀態重播通過，自身維持6HP；正式建置同組4案與標準AI Browser皆通過，來源及驗收範圍見 output/st6-st10/st8-005-presentation-acceptance.json。先前完整Vitest已936檔／19525項PASS、1129.09秒、exit0，1794份來源指紋一致；這份全套屬本次呈現修正前，後續批末需再回歸。全域lint run2 PASS，輸出區三項未使用匯入修正已另留證據；最終呈現三檔lint另通過。仍52正式／48候選，ST8-006只完成原圖、8條隔離fixture及23項精確契約原型（舊generic接受21項錯誤runtime），未驗收或promote。未commit／push。證據：output/st6-st10/st8-005-manual-full-acceptance.json、st8-005-presentation-green2.log、st8-005-presentation-browser-dev-run1/results.json、st8-006-contract-prototype-checks.json。以下未完成全套與仍在執行中的敘述為較早快照。

2026-10-13 使用者手動驗證入口已更新：card:ST8-004 預設由手牌登場、配置印刷5HP，再GGG普通3及活躍支援；card:ST8-005 預設手牌含真實ST1-016物品，先RR支付、再免費Once抽1、GGG攻擊與Then追加傷害，大小寫皆可。兩張卡×大小寫×雙尺寸共8案在dev與正式建置各通過，完整父指令及獨立狀態重播一致；原圖完成解碼，使用者提供ST8-005原圖雜湊一致。相關8檔687項、build／受影響lint／標準AI Browser通過。卡池稽核逾時已定位並修正為效果表只建構一次、五種依記錄計算的效果保留factory，回傳獨立副本；2132份正式轉接JSON逐筆一致，量測約14.5秒→2.4秒，不提高timeout。全域lint仍執行中，完整Vitest已啟動並凍結1794份來源／設定／資料；尚未有全套終值，仍52正式／48候選，未commit／push。證據：output/st6-st10/st8-004-005-manual-acceptance.json。下方入口尚未調整及逾時未解的敘述屬較早快照。

2026-10-13 ST8-005 已完成逐卡候選驗證與promote，**52正式／48候選**（ST6 20／0、ST7 20／0、ST8 6／14、ST9 1／19、ST10 5／15）。候選run11與正式run1各78案雙尺寸Chrome、各含8案實際Lv5與完整指令／狀態重播通過；兩層分列、不重複累加。免費Activate Once抽1要求手牌≤5且本回合實際發動Item；GGG普通3後獨立選0～2活躍己方支援與0～1對手，傷害依實際橫置數計算。專用3檔89項、共享6檔452項、fail-closed相關3檔112項與34／34錯誤runtime拒絕通過；正式資料／registry通過。原政策與新政策採相同規則，Lv3～5三個真實GGG3父流程中，原版漏掉立即擊倒，新版各只橫置1支援擊倒1HP並保留另一支援，僅為立即決策對照。使用者回報 card:st8-005 錯誤頁，Chrome擷取到找不到小寫官方卡號；另發現promote後退出候選清單會使通用入口回退舊fixture。已正規化通用card卡號並明確接到原始實體卡fixture，新增6項回歸；原網址大小寫×雙尺寸4案完成實際GGG支付、Then1傷害、勝負及精確覆盤。最終build／受影響lint／標準AI Browser通過；入口與通用局面323項通過，能力稽核23項通過但全卡池1項仍超過既有5秒門檻（完整合併run2為346通過／1逾時），未放寬timeout。正式建置原網址4案及獨立完整指令重播亦通過；完整Vitest待本輪修改後重驗；下方930檔屬修改前。未commit／push，逐卡online／完整UI對局／對人類勝率未驗證。證據：output/st6-st10/st8-005-promotion.json、st8-005-candidate-browser-run11/results.json、st8-005-formal-browser-run1/results.json、st8-005-generic-repro.json、st8-005-generic-fixed/results.json；候選引擎證據已依原雜湊完整還原，formal引擎另存獨立檔案。

2026-10-13 ST8-004 批末正式驗收完成：**51 正式／49 候選**（ST6 20／0、ST7 20／0、ST8 5／15、ST9 1／19、ST10 5／15），正式／候選無重複。完整Vitest run2 **930檔／19,420項通過**，1983.85秒、exit0；1786份來源／設定／資料指紋一致，來源凍結解除。上一聊天中斷的run1未有終值，不當通過。候選與正式雙尺寸Chrome各48案、各含4案實際Lv5及完整指令／狀態重播，分開留存、不重複累計；正式399項相關測試、build／全域lint／資料／registry／標準AI Browser終值exit0，沿用證據之來源再次核驗一致。證據：output/st6-st10/st8-004-full-acceptance.json、st8-004-promotion.json、st8-004-formal-browser-run1/replay-audit.json、st8-004-full-run2.log、st8-004-full-integrity-run2.log。這份全套不包含ST8-005輸出區原型；局部準備式Browser不代替逐卡online或完整UI對局，未commit／push。下一張ST8-005仍為候選，準備內容如下；以下50／100與仍為候選敘述為較早歷史快照。

ST8-005 隔離準備終值（產品來源仍凍結）：再次目視原圖，確認免費Activate Once的手牌≤5與本回合Item條件、GGG普通3後橫置0～2己方支援並對0～1對手造成實際橫置數傷害。原轉接漏技能及Then，正式strict仍為needs-review。輸出區exact轉接與精確守衛原型19案規則／條件及Lv3～5三案通過，包括實際道具父指令、手牌0／4／5／6、Once、疲勞來源、錯誤時機、選0／1／2、非法支援及非原防守者。原AI三案只選Cookie而不選支援，造成零傷害；修復原型三案只橫置1張支援便擊倒剩餘1HP目標，保留另一張能量。15案AI邊界診斷亦通過，包含可用支援0／1／2、合成公開免疫與隱藏牌序不變性；免疫旗標是機制隔離，不能算實體父流程驗收。只補契約分類的原型34種錯誤runtime中漏擋28種；最終專用守衛原卡verified／34種全拒絕（僅驗收器變異，非引擎mutation coverage）。隔離app TypeScript零診斷，初次union narrowing錯誤已修；型別修正後重新建置最終契約引擎，34種仍全拒絕，其他未變的AI／規則原型證據沿用。未套入產品、未Browser驗收／promote、不宣稱整體或對人類勝率提升。尚待完整Refresh／來源離場／UI各分支與正式回歸。證據：output/st6-st10/st8-005-guarded-run3.log、st8-005-ai-boundary-result.json、st8-005-contract-parser-only-baseline.json、st8-005-final-contract-guarded.json、st8-005-isolated-typecheck-run2.log；早期失敗run均保留。

ST8-005另補1案來源離場規則原型：印刷6HP先經實際普通4降至2，再由兩張真正Kumiho FLIP各1傷害昏厥，仍可橫置1支援並對獨立對手目標造成恰好1效果傷害。來源／目標牌區與60張身分核對通過；run2原型結尾誤期待目標必昏厥，run3改依卡面「實際橫置1張造成1傷害」核對精確前後差值，不改規則引擎。此1案與上述19案不重疊，仍未Browser驗收；來源離場UI、真實Refresh及正式套用待完成。證據：output/st6-st10/st8-005-source-departure-run3.log、st8-005-source-departure-result.json。

ST8-004 Browser 增補終值（2026-10-13）：`st8-004-candidate-browser-run2/results.json` **30／30** 案通過，1366×900及1164×777，逐案完整重播相符；包含支援3／4／5／6、對手5不算、已活躍目標、選0／反選／取消／支付反選及錯色／疲勞／時機等。與首批4案重疊，不累加34案。仍缺來源／目標離場UI、其餘目標操作與實際AI Browser，批末完整回歸未跑；不得以此promote。當前新增專用2檔47項包含於4檔145項結果，並無重複計數。首個完整build之後僅新增來源離場測試與文件，產品轉接／fixture未再改；build不代表這份新增測試已再做TypeScript檢查。

2026-10-13 ST8-004 開發中，仍為候選：依原圖補上 GGG 普通3之後的 Then，己方支援總數至少5才可活躍0～1任意己方支援，包含剛支付與原已活躍卡；沒有額外費用。新增精確契約守衛與18種錯誤 runtime 變異測試，第一輪19項中12項失敗，修後19項通過。實體規則含5HP來源先受普通4、再由真實 Kumiho FLIP1昏厥後續接 Then；專用與相關4檔145項通過，build及受影響lint通過。首批雙尺寸4案UI與完整重播通過；完整Browser矩陣、實際AI Browser、批末全套與promote尚未完成，不增加50／100正式數。證據：output/st6-st10/st8-004-red-run1.log、st8-004-targeted-run2.log、st8-004-build-run1.log、st8-004-candidate-browser-run1/results.json。ST8-004本輪產品修改未commit／push。

2026-10-13 提交前終值：ST8-002／003 批末完整 Vitest **927 檔／19,369 項通過**，1520.19 秒、exit 0；1,781 份來源／設定／資料指紋一致。全域 lint、build、標準 AI Browser 與兩張正式雙尺寸 66 案／完整重播均通過。目前 **50 正式／50 候選**；ST8-004 尚未 promote，其 output 原型不列入驗收。僅更新文件，沿用未變動產品來源的測試結果；以下執行中敘述為較早紀錄。未宣稱逐卡 online 或完整 UI 對局，未 push。

ST8-004 隔離準備（2026-10-13，非正式驗收）：原圖及 Kumiho 參照卡圖已目視核對。`output/st6-st10/st8-004-isolated-prototype.mjs` 證明可用 selectable／optional `set-active` 加己方支援數≥5 條件轉接 Then。原通用 strict 對 18 種錯誤 runtime 變異漏擋 16 種；`prepare-st8-004-guarded-prototype.mjs` 產生輸出區 ledger 守衛後全部 18 種被拒絕，原卡 12 組（含 Lv3～5）通過。`st8-004-source-faints-prototype.mjs` 以實際普通4＋Kumiho FLIP1使原始5HP來源昏厥後仍續接 Then，修正最初61張配置後通過60張檢查。這些只有 output 原型，產品來源未改；尚待正式套用、型別檢查、完整門檻／支付／目標／離場測試與雙尺寸 Browser，不得據此 promote。002／003 全套仍執行時保持 src／scripts／data 凍結。

2026-10-13 ST8-003 逐卡 promote 與正式重驗通過：目前 **50 正式／50 候選**，ST6 20／0、ST7 20／0、ST8 4／16、ST9 1／19、ST10 5／15。NNN 普通3／HP4／LV2／無技能或 FLIP；六色及混色、負向支付、登場、AI 等正式雙尺寸 34 案與完整重播通過，專用 32 項、相關 396 項通過。002／003 全域 lint 及批末完整 Vitest 執行中，來源已凍結。下一張 ST8-004 原圖已讀；Then 應於己方支援至少 5 張時可活躍 0～1 己方支援，但現行 attackEffects 缺失，未驗收／未 promote。詳見 README 最新紀錄。

2026-10-13 ST8-002 完成逐卡 promote 及正式重驗：49 正式／51 候選，ST8 為 3／17，其餘系列數量不變。原圖 GGG 普通3、被揭示卡免費 FLIP 回手，26 項專用與正式相關 378 項、雙尺寸 Chrome 32 案及完整重播（含 6 案 Lv5）、build／受影響 lint／資料／registry／strict 通過；批末完整回歸待跑，未宣稱逐卡 online。下一張 ST8-003；本批未 commit／push。詳見 README 最新進度。

2026-10-13：ST8-001 已 promote，現為 48 正式／52 候選：ST6 20／0、ST7 20／0、ST8 2／18、ST9 1／19、ST10 5／15。Greenbell Cookie 原圖為綠色 LV1／HP2、N 普通1，無其他能力；正式雙尺寸 Chrome 32 案（含 4 案 Lv5）與完整重播通過。單卡 31 項、正式含能力稽核 50 項、build／lint／registry／strict 通過；本次完整回歸結果見 README 最新紀錄。尚未宣稱逐卡 online 或完整 UI 對局驗收。下一張 ST8-002。

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

最終局部重驗：正式009 Chrome雙尺寸同32案、批次AI Browser與全域lint皆exit0；007／008正式同28／24案已通過，候選與正式不重複累加。最終001～009及AI稽核22檔213項PASS，build／資料／registry通過。17正式／83候選，原始資料不變、交集0。來源指紋已固定，完整Vitest在`output/st6-st10/st6-007-009-full-vitest.log`執行，尚無終值；期間不改程式／測試／資料。009單卡gate完成；010可僅做output隔離準備，不以先前834檔完整結果代替新增007～009的批次全套。逐卡online未驗收。

2026-10-11 本批最新：ST6-009 原圖紅LV3／5HP、RRRR普通4；Activate Once R＋棄任意手牌1，0～1對手餅乾1傷害，無REST代價。strict verified=1、3檔34項含Lv4／5真實付款指令、候選Chrome雙尺寸32案通過後單卡promote；原始record與正式相同才移出候選。001～009與AI稽核22檔213項PASS、build通過；正式009 Chrome／批次AI Browser／全域lint待終值，完整回歸未開始。合計17正式／83候選，交集0、唯一100：ST6=9／11、ST7=1／19、ST8=1／19、ST9=1／19、ST10=5／15。正式31 JSON／2097卡號／2041轉換、registry一致，ST6 AI strict ready。初輪測試錯用selector player欄位與尚未結束補位父流程、Chrome漏掉能量→代價換頁及把休息區卡圖當成仍在戰鬥區，均保留失敗證據並修正fixture／driver，沒有改共用規則。下一張010效果gate未進行，逐卡online未驗收。

最新 cursor：ST6-008 已單卡 promote，合計 16 正式／84 候選。ST6 正式 001～008／候選 12，ST7=1／19、ST8=1／19、ST9=1／19、ST10=5／15。008 原圖紅 LV2／3HP／RRR 普通3、免費 FLIP 抽0～1；strict verified=1，專項20項及候選 Chrome雙尺寸24案通過。最後一張牌實際抽牌→Refresh→原攻擊昏厥→不補位，已匯出重播證明只抽1、牌庫恢復、pendingRefresh／pendingBattle清空。初次 driver 錯讀 trace payload、把 Refresh 後補位視窗當 Refresh 未關閉及卡片過濾 trace 缺少 Refresh 命令均保留，最終 candidate-v5 取代。原始008 record與正式 record相同才移出候選。正式資料30 JSON／2096卡號／2040轉換、registry一致，ST6 AI strict ready；正式 Browser／最終回歸仍待完成，不推進009。007最終lint已exit0；此前v9完整834檔17416項不涵蓋007／008。逐卡online未驗收。

2026-10-11 最新單卡結果：ST6-007 已經候選 strict verified=1／needs-review=0／blocked=0、2 檔 30 項測試、build／lint、雙尺寸 Chrome 28 案後單卡 promote。正式 registry 同 30 項測試與同 28 案 Chrome 通過，不重複累加物理案例；正式資料驗證及 registry 一致性通過。原始 007 record 與 promote 後正式 record 比對相同，才移出系列候選。ST6 正式 001～007、候選 13；其餘 ST7=1／19、ST8=1／19、ST9=1／19、ST10=5／15，共 15 正式／85 候選。正式 lint 首輪抓到兩個未使用候選 import，清除後重跑中。最新完整 Vitest 834 檔／17,416 項 PASS、1341.17 秒、exit 0，1576 來源指紋在 007 修改前一致；此全套涵蓋 v9／P-163，不涵蓋新增 007。逐卡 online 未驗收，008 效果 gate 尚未進行。

2026-10-11 ST6-007隔離準備補齊：候選規則與卡面2檔30項通過（`st6-007-candidate-checks.log`），正式007路徑仍斷言不可用；獨立型別檢查首輪JSON型別過寬，output草稿補OfficialCardRecord邊界後v2通過。single inventory的validate僅來源／schema、converted=0；另跑真正strict單卡audit，verified=1／needs-review=0／blocked=0。候選Chrome雙尺寸28案仍有效，型別修正不改執行期。這些結果未替代正式路徑／實作測試與promote後重驗，沒有增加14正式／86候選。當前v9完整回歸session29773尚未結束，1576來源指紋一致；不在期間修改正式來源。

ST6-007隔離Browser準備完成：本輪重新目視原圖，確認紅LV3／HP4、RRRR普通4、FLIP棄任意1手牌後原HP持有者補1。只在output產生虛擬005共用fixture及007URL路徑的獨立Vite build，沒有改正式來源／dist／卡池；Chrome雙尺寸28案全部通過，exit0，結果`output/st6-st10/st6-007-isolated-browser/candidate-run1/results.json`。涵蓋實際NNN3父傷害、正常／最後HP、Cookie／道具手牌、缺手牌／略過／取消、RRRR4支付與疲勞／錯色／錯階段；1164攻擊後已目視核對來源4HP、對手昏厥及四支援付款。未與舊準備16檢查混為同類累加；正式factory／卡牌與實體測試草稿已存output，但尚未安裝／驗收，也尚未promote。14正式／86候選不變，等待當前v9完整回歸結束才改正式來源。


2026-10-10 AI v9正式續批：v8完整Vitest已結束，833檔／17,396項全部通過，1420.70秒、exit0；修改前1572份來源／設定／資料指紋一致。其後正式套用「可救下當前防守者的減攻陷阱優先當前攻擊者」，版本`lv5-public-saving-trap-target-v9`；原v8的11項測試9失敗／2通過，修正後11項全通過。受影響AI回歸65檔986項、build、全域lint與標準AI Browser通過；實際AI雙尺寸6案及匯出付款／目標／resolve-battle／HP指令全部通過。前兩輪Browser driver對HP文字格式及結算指令的假設失敗保留，run3取代，不當產品失敗。六色BS12實際時鐘完整對局368次搜尋、0逾時／0丟棄評估，4次實際Special Play。

勝率證據：凍結原型兩個預選種子組各624場，338／286（54.17%）及329／295（52.72%）；正式v9另用seedBase=2027022617完成624場，342／282（54.81%）、零錯誤，312組政策座位配對中38組新版雙勝／8組舊版雙勝／266組各勝一場。正式bundle除版本字串外與前兩組原型完全一致；共同規則／資料與bundle指紋、種子／座位稽核通過。正式報告SHA=632df663ef40d00570964b2febf4f02d048c5509caba744fc427d7e6a33e4311；原report.method沿用output-only範本文字，正確正式版本身份見protocol／manifest及formal-comparison-summary.json，原報告保留不覆寫。這是固定12牌表的AI對AI改善證據，不等於人類勝率或所有環境的穩定提升。

P-163舊三張戰鬥區fixture已撤回合法驗收解讀，改為來源加一張紅Arena／綠Arena／非Arena的獨立兩張局面，錯色支付改用真正ST2-020，不改卡牌印刷屬性。原上限測試1失敗／11通過，修正後21項通過，正式Chrome雙尺寸14案通過；舊Browser紀錄保留但不累加。沒有新增卡牌promote，ST6～ST10仍14正式／86候選，007正式驗收及逐卡online未完成。

本批最終完整Vitest已凍結1576份來源啟動，session29773，`output/ai-cookierift/formal-saving-trap-v9/full-vitest.log`，尚待終值；執行期間不改程式／測試／資料。v8的833檔結果不替v9宣稱完整通過。localhost:5173開發伺服器session26822已啟動，HTTP200／Braverse對戰卡牌；未commit／push。


007隔離準備：本輪重新目視原圖確認Chili Pepper Cookie紅LV3／HP4、RRRR普通4；FLIP棄1任意手牌，原HP持有者補1。單卡strict verified=1／needs-review=0／blocked=0；output-only合法原始60張、唯一instance／同卡≤4／戰鬥≤2、NNN3父傷害正常／最後HP及Cookie／道具代價、RRRR4與疲勞／錯色／錯階段共16檢查通過（`output/st6-st10/st6-007-preview-probe.json`）。首輪隔離build因舊demo匯入名稱失敗、首輪probe因undefined選項鍵的deepStrictEqual失敗，均為準備工具問題，修正後通過；未改產品／測試／候選資料。正式測試、Browser與promote仍待完成，不增加14正式／86候選數量。當前AI v8完整回歸執行期間，來源保持不變。

ST6-006／AI v7完整Vitest已結束：832檔／17,384項全部通過，1276.56秒、exit0，1571份來源／設定／資料指紋一致（`output/st6-st10/st6-006-full-vitest.log`）。本卡正式局部／Browser及全套回歸均已通過；正式14張／候選86張，007尚未推進效果驗收，逐卡online未驗收。後續AI v8修改需要自己的最終回歸，不沿用本結果宣稱v8通過。

ST6-006最終局部重驗：正式Chrome雙尺寸同18案全部通過，不與候選累加；正式build修正測試型別窄化後通過，最終全域lint／AI Browser／資料／registry通過。Lv4／Lv5正常與最後HP四案實際AI均免費發動006回手且輸入不變。本批完整Vitest已凍結1571份來源／設定／資料指紋啟動，報告`output/st6-st10/st6-006-full-vitest.log`，session需等最終結果，執行期間不改程式／測試／資料。正式14張／候選86張，007尚未推進效果驗收。

ST6-006續批：原圖重讀、strict verified=1、候選Chrome雙尺寸18案、受影響10檔435項及build／全域lint通過後已單卡promote；正式14張／候選86張（ST6正式001～006、剩14）。正式28JSON／2094卡號／2038轉換及registry一致性、promote後4檔29項通過。正式build初次發現新detached測試缺少Cookie型別窄化，已補真實type assertion；重建、正式Chrome／AI Browser與本批完整回歸仍待完成，停止後續007驗收。前版829檔17,361項全套不涵蓋006。逐卡online未驗收。

2026-10-10 22:33最終完整回歸：v7／ST6-005的Vitest 829檔／17,361項全部通過，1206.63秒、exit0；1565份來源／設定／資料指紋一致。報告`output/ai-cookierift/full-vitest-on-play-v7-st6-005.log`。此結果不包含後續006或Venom原型的正式套用。

006隔離準備續進：再次直接目視原圖確認紅LV2／HP4／RRR普通3、免費FLIP將揭示的本卡回手。output-only通用機制的正常／最後HP×發動／略過四案通過；另由正式BS9-030 EXTRA真實登場及Then棄FLIP父流程證明detached FLIP由棄牌回手且不重複，略過則留棄牌。新增原始卡牌、每方60張、唯一instance、同卡≤4、戰鬥區≤2的隔離fixture，八案正常／最後HP／略過／RRR攻擊及疲勞、錯色、錯階段通過（`output/st6-st10/st6-006-physical-prototype.json`）。第一版盤點誤用targetPlayerId漏計揭示卡、第二版用立即結算attack後再skipTrap而失敗，修正probe為defenderPlayerId及declare-attack正式分段後通過；未改產品。型別／adapter／共用戰鬥／AI／契約／UI整合與Browser仍待完成，不增加promote數量或cursor。

005正式續驗結果：正式registry載入的Chrome雙尺寸同28案全部通過（不與候選重複累加），promote後5檔53項回歸、最終build／全域lint／資料／registry通過。AI最終Browser與182來源runtime bundle已另存，不覆寫增加005前的624場比較bundle；42個AI政策來源SHA皆與比較版本相同。完整Vitest已固定1565份程式／設定／資料指紋後啟動，報告`output/ai-cookierift/full-vitest-on-play-v7-st6-005.log`，尚未有最終結果，執行期間不改程式／測試／資料。

下一張006僅隔離準備：再目視原圖確認Cherry Cookie紅LV2／HP4／RRR普通3，免費FLIP只將這張揭示卡回手、不將原HP持有者回手。現有adapter沒有runtime FLIP，實際ST6-003 NNN3父流程不會停在FLIP；單卡strict verified=0／needs-review=1／blocked=0（`st6-006-contract.json`），原失敗probe保留。候選中另有ST7-007、ST8-002、ST9-003、ST10-001共五張完全相同印刷句型；目前只盤點影響範圍，不等於五卡驗收。完整Vitest來源保持不變，結束後才補006正式失敗測試與通用揭示卡回手機制，另驗一般／最後HP／略過及實際FLIP父流程；006未promote，不推進007效果驗收。

2026-10-10 ST6-005續批：再次目視原圖，30項卡牌／實體合法60張局面測試、strict verified=1與候選Chrome雙尺寸28案通過，validate後已單卡promote；移除候選preview fallback並改用正式registry。正式13張／候選87張，ST6正式001～005、剩15張；其他四系列數量不變。正式資料27JSON／2093卡號／2037轉換與registry一致性通過，正式Chrome重驗及本批完整Vitest尚待完成。首輪測試與Browser driver失敗已保留，不當作產品缺陷：測試使用錯誤欄位／空陣列參數／未限定攻擊者，driver誤把休息區卡圖視為仍在戰鬥區；修正後30項與28案通過。局部Browser與規則命令證據不等於完整線上對局，逐卡online未驗收。

續查來源準備：本輪再次實際開啟ST6-005原圖，確認Agar Agar Cookie紅色LV1／HP1、RR普通2（Draining Mirror）；FLIP先棄一張任意手牌，使原HP持有餅乾補1HP，不是此揭示卡自身另行登場。仍留候選，尚未新增本卡實體局面／Browser驗收或promote。image-manifest的ST6-002舊formal=false已依實際正式資料修正為true，保留原圖hash與撤回的舊Browser說明，不重複計算26案。

005隔離診斷續進：單卡strict verified=1／needs-review=0／blocked=0、exit0（`st6-005-contract.json`）；原圖到adapter三項比對v2通過，首版錯誤要求顯式effects[]，但既有attachedHpBonus會由resolveFlip在支付後建立原持有者gain-hp，首版失敗保留、不當產品缺陷。以實際NNN3攻擊父流程隔離驗證正常揭示2→3HP與最後揭示0→1HP，任意道具手牌代價、缺少／不存在代價拒絕、另一張餅乾HP不變及輸入不變通過（`st6-005-rules-probe.json`）。隔離未知牌背並非完整實體60張局面，仍不能當Browser或promote驗收。

2026-10-10覆核修正：ST6-002舊fixture為對手配置三張戰鬥區餅乾，違反正式最多兩張的限制；舊候選／正式Browser 26案保留為歷史診斷，撤回其「合法實體局面驗收」解讀。現已拆分一般雙目標與原防守者昏厥的兩張局面，新增區域上限assertion；3檔23項專項測試、build與正式Chrome雙尺寸技能14案／攻擊Then12案全部通過（exit0）。新報告`st6-002-browser-skill-formal-legal-zones-v2`及`st6-002-browser-attack-formal-legal-zones-v2`取代舊局面驗收，不累加成52案。已目視核對1164原防守者昏厥與1366來源最後HP代價後不補位畫面。003使用兩張對手餅乾，不受此問題影響；正式卡池仍11張／候選89張，逐卡online未驗收。

v4.1／ST6-003原批完整回歸822檔／17,262項通過，1223.77秒、exit0，報告`output/ai-cookierift/full-vitest-knockout-allocation-st6-003.log`及同名exit檔。該結果在本輪002局面修正與AI v5套用前，不能取代本輪最終完整回歸。

ST6-004本輪完成：原圖、3項卡牌／25項實體局面測試、strict單卡verified、候選Chrome雙尺寸34案通過；validate後單卡promote，移除候選preview fallback並改從正式registry載入。正式同34案全部重驗通過，不與候選重複累加；首輪driver手牌容器讀取失敗保留，修正為實際bottom-hand後run2通過。promote後與AI／能力稽核共4檔45項、build／全域lint／registry／正式資料驗證通過；v5／004本輪完整Vitest825檔／17,306項通過（1231.87秒、exit0）。正式12張／候選88張（ST6剩16），剩餘strict47 verified／41 needs-review／0 blocked，未把strict verified當作實體效果驗收。

004前置診斷紀錄：原圖重讀確認Activate免費、棄一張任意手牌、自身本回合攻擊+1；RRR普通3後可另付R，選0～1任意對手受1。目前adapter缺少此Then。`output/st6-st10/st6-004-contract-probe.json`保留缺漏基線；隔離修補`st6-004-contract-prototype.json`結構比對通過，`st6-004-rules-prototype.json`六項規則實驗通過：任意手牌代價與Once、無手牌阻擋、普通RRR3後獨立R付款、不自動產生來源能量、可選另一對手、略過及剩餘黃色不能付R。此為套用前隔離證據；後續正式結果以上段為準。

002隔離修正基線見`output/st6-st10/st6-002-zone-limit-probe.json`：九種舊fixture全部超出兩張上限；隔離修正九種均符合最多兩張、每方60張／唯一instance／同卡最多四張，另由實際普通攻擊證明原防守者昏厥後不另選Then目標、不消耗來源HP。共十項隔離檢查通過；後續已套用產品，正式測試與Browser結果如上。

前批歷史快照（最新結果見上）：ST6的20張原圖已於2026-10-10逐張打開核對。下表為獨立印刷預期，未以runtime輸出當預期；001已完成strict、9項專項／691項回歸、雙尺寸14案與promote後正式卡池14案。002已完成strict、2項卡牌／4項規則整合／14項實體局面測試與Chrome雙尺寸26案，已單卡promote；正式Browser26案重驗通過，本批全套曾有2項失敗，修正／原限制專項重跑通過，最終全套819檔／17,239項全部通過（1195.95秒、exit0），其他17張尚未驗收。003已完成原圖、strict、2項卡牌／8項實體局面測試與雙尺寸候選Browser10案，已promote；正式Browser同10案重驗通過，本批完整回歸待完成。ST6～ST10合計正式11張／候選89張，不能將100張原圖盤點當成逐卡效果驗收。R為紅色支援能量，N為任意能量；所有Cookie為紅色。原圖URL、SHA256見image-manifest，實際規則解讀依 `docs/game-rules.md`。

| 卡號 | LV／HP與普通攻擊 | 技能／FLIP／道具／陷阱／場景印刷預期 |
|---|---|---|
| ST6-001 | 1／2，R普通1 | Mace Swing，Activate Once；R及最上方一張自身HP進棄牌，0～1任意對手受1。無REST代價。 |
| ST6-002 | 3／6，RR普通1 | Ever-Burning Flames，Activate Once付R，0～1任意對手受1。攻擊Then可將最上方一張自身HP進棄牌，原攻擊追加2。2026-10-10再次放大核對原圖，修正先前誤記免費；不修改正確的技能能量轉接。 |
| ST6-003 | 2／4，NNN普通3 | 無技能、Then或FLIP。原圖、strict、規則與候選Browser雙尺寸10案通過，已promote；正式Browser同10案重驗通過，本批全套待完成。 |
| ST6-004 | 2／4，RRR普通3 | Dragon；免費Activate Once棄任意手牌1，自身本回合攻擊+1，不需REST。Then另付R、0～1任意對手受1。已promote，候選／正式雙尺寸各34案通過，v5／004全套825檔／17,306項通過。 |
| ST6-005 | 1／1，RR普通2 | FLIP棄任意手牌1，原HP持有者補1。 |
| ST6-006 | 2／4，RRR普通3 | FLIP此揭示Cookie回手，不是原HP持有者回手。 |
| ST6-007 | 3／4，RRRR普通4 | FLIP棄任意手牌1，原HP持有者補1。 |
| ST6-008 | 2／3，RRR普通3 | FLIP抽0～1。 |
| ST6-009 | 3／5，RRRR普通4 | The Essence of Spice，Activate Once；R及棄任意手牌1，0～1任意對手受1。無REST代價。 |
| ST6-010 | 1／3，RN普通1 | Sturdy Armor，Blocker付R，對手餅乾攻擊時可轉向本Cookie。沒有印REST、Once或手牌代價。 |
| ST6-011 | 1／2，N普通1 | 無技能、Then或FLIP；原圖、strict、23項單卡測試及候選／正式雙尺寸同24案通過，已promote。 |
| ST6-012 | 1／2，RR普通2 | Magma Blast，Activate Once付R，0～1己方名為Fire Spirit Cookie的餅乾補1HP。不限同卡號。 |
| ST6-013 | 道具，R | 抽0～1，Then選0～1己方剩餘HP至多2的餅乾，本回合攻擊+1。抽零與Then分開核驗。 |
| ST6-014 | 道具，RR | 另將一張任意己方餅乾最上方HP進棄牌；所有對手各受1，再選0～1己方Fire Spirit Cookie，本回合攻擊+1。 |
| ST6-015 | 道具，RR | 另將一張任意己方餅乾最上方HP進棄牌；0～1任意己方餅乾本回合攻擊+2。代價餅乾與受益目標分開選。 |
| ST6-016 | 道具，RRR | 另棄任意手牌1；0～2對手，一張受2、另一張受1，需保留選取順序及0／1／2目標路徑。 |
| ST6-017 | 陷阱，RR | 0～1對手本回合攻擊-2；Then任意己方餅乾剩餘HP恰1時，同一對手再-1。 |
| ST6-018 | 陷阱，R | 0～1己方餅乾，本回合受到的攻擊傷害-1；主客體與減少對手攻擊不同。 |
| ST6-019 | 陷阱，R | 0～1對手本回合攻擊-1；Then任意己方餅乾剩餘HP恰1時抽0～1。 |
| ST6-020 | 場景，RR放置 | Into the Depths；Activate橫置此場景及將一張任意己方餅乾最上方HP進棄牌，抽0～1。啟動沒有印額外能量或Once。 |

ST7的20張原圖亦已於2026-10-10逐張打開核對；Y為黃色支援能量，全部Cookie為黃色。只有005已完成本輪效果驗收，以下其餘列只記來源預期。

| 卡號 | LV／HP與普通攻擊 | 技能／FLIP／道具／陷阱／場景印刷預期 |
|---|---|---|
| ST7-001 | 3／5，YYY普通3 | Problem Solver，Activate Once，Y及一張任意手牌Cookie進己方休息區，0～1對手受2。 |
| ST7-002 | 1／2，Y普通1 | Perfect Day For Sightseeing，On Play己方休息區總LV至少2，自身補1HP。 |
| ST7-003 | 3／4，YYYY普通4 | FLIP棄任意手牌1，原HP持有者補1。 |
| ST7-004 | 1／2，N普通1 | 無技能、Then或FLIP。 |
| ST7-005 | 1／1，YY普通2 | FLIP棄任意手牌1，原HP持有者補1；已完成雙尺寸實際傷害與最後HP救援。 |
| ST7-006 | 2／3，YYY普通3 | FLIP抽0～1。 |
| ST7-007 | 2／4，YYY普通3 | FLIP此揭示Cookie回手，不是原HP持有者回手。 |
| ST7-008 | 2／4，YYY普通3 | Protector of the Faerie Kingdom；On Play己方戰鬥或休息區有LV3 Millennial Tree Cookie，0～1己方休息區黃色LV1 Cookie進棄牌。攻擊Then己方休息總LV至少4，原攻擊追加1。 |
| ST7-009 | 2／4，NNN普通3 | 無技能、Then或FLIP。 |
| ST7-010 | Millennial Tree Cookie | 正式（已 promote） | 原卡26項＋實體31項、strict、最終199項受影響回歸、完整900檔／18743項、build／lint／資料／registry通過 | 正式雙尺寸42案＋AI6案及48案完整重播PASS；逐卡online未驗收 |
| ST7-011 | 1／2，YY普通2 | 攻擊Then：來源剩餘HP至多2，且己方戰鬥區有LV3 Millennial Tree Cookie，來源補1。休息區見證不符合此卡。 |
| ST7-012 | 1／3，YN普通1 | Churro Tribe Warrior，Blocker付Y，可轉向本Cookie；沒有REST、Once或手牌代價。 |
| ST7-013 | 道具，YY | 另將己方棄牌區一張黃色Cookie進休息區，0～1任意對手受2。代價不限制LV1。 |
| ST7-014 | Essence of Rejuvenation | 正式（已 promote） | 25項契約＋54項實體／AI指令、正式190項受影響回歸、build／lint／資料／registry／strict通過；批末完整回歸待跑 | 正式雙尺寸34案及34案完整重播、標準AI Browser PASS；局部UI非完整對局或逐卡online |
| ST7-015 | 道具，YY | 相同戰鬥或休息區LV3 Millennial Tree條件，本回合所有己方餅乾攻擊+1。 |
| ST7-016 | 道具，YY | 0～1剩餘HP至多2的任意對手，下次對手Active Phase不設為活躍。不是立即REST。 |
| ST7-017 | 陷阱，Y | 0～1任意對手本回合攻擊-1；Then己方休息總LV至少4，同一目標再-1。 |
| ST7-018 | 陷阱，YY | 所有己方餅乾補1HP，不限顏色或LV，沒有選擇目標。 |
| ST7-019 | Millennial Jade Deer's Wrath | 正式（已 promote） | 22契約／52實體AI／11支付；v21完整917檔／19179項、build／lint／資料／registry／strict PASS | 正式雙尺寸52案含16案Lv5，各完整狀態重播PASS；逐卡online未驗收 |
| ST7-020 | Forest of Life | 已 promote | 原圖／契約／正式Chrome62與精確重播62 PASS | 完整Vitest 920檔／19271項PASS；逐卡online未驗收 |

ST8的20張原圖亦已逐張打開作來源盤點，尚未推進效果驗收cursor。G為綠色支援能量；以下Cookie全部為綠色。

| 卡號 | LV／HP與普通攻擊 | 技能／FLIP／Then印刷預期 |
|---|---|---|
| ST8-001 | 1／2，N普通1 | Greenbell Cookie，無技能、Then或FLIP。 |
| ST8-002 | 2／4，GGG普通3 | Muscle Cookie，FLIP此揭示Cookie回手。 |
| ST8-003 | 2／4，NNN普通3 | Leek Cookie，無技能、Then或FLIP。 |
| ST8-004 | 3／5，GGG普通3 | Red Panna Cotta Cookie，攻擊Then己方支援至少5張時，0～1己方支援設為活躍。 |
| ST8-005 | 3／6，GGG普通3 | Wind Archer Cookie，免費Activate Once；手牌至多5且本回合已使用道具時抽恰1。攻擊Then可橫置至多2張己方支援，對0～1任意對手造成等於本次實際橫置支援數的傷害。 |
| ST8-006 | 3／4，GGGG普通4 | Basil Pesto Cookie，FLIP棄任意手牌1，原HP持有者補1。 |
| ST8-007 | 1／1，GG普通2 | Blue Slushy Cookie，FLIP棄任意手牌1，原HP持有者補1。 |
| ST8-008 | 2／4，GGG普通3 | Sugar Swan Cookie，昏厥時己方支援數不大於對手，將牌庫頂0～1張放入己方支援並疲勞。攻擊Then己方支援有Wind Archer Cookie時抽恰1再棄恰1；戰鬥區同名卡不符合支援條件。 |
| ST8-009 | 2／3，GGG普通3 | Cucumber Cookie，FLIP抽0～1。 |
| ST8-010 | 1／2，G普通1 | Cookiemals，昏厥時可支付一張己方支援道具回手，再將牌庫頂0～1張放入己方支援並疲勞。不限原支援道具活躍狀態，不額外付能量。 |
| ST8-011 | 1／3，GN普通1 | Kiwi Cookie，Blocker付G，可轉向本Cookie；無REST或Once。 |
| ST8-012 | 1／2，GG普通2 | Windcatcher，Activate只REST來源；本回合已使用道具時對0～1對手造成1。Then可另由支援支付G，0～1己方Wind Archer Cookie補1。沒有Once；不可由來源自動產生額外G。 |
| ST8-013 | 道具，G | Windgrass，0～1對手支援疲勞；Then己方戰鬥區有Wind Archer Cookie時，0～1己方支援活躍。 |
| ST8-014 | 道具，G | Cape of the Vanquisher，己方支援至少5張時，0～1己方綠色且剩餘HP至多3的餅乾補1。 |
| ST8-015 | 道具，GG | Essence of the Tempest，己方戰鬥或支援區有Wind Archer Cookie時，牌庫頂0～1張進己方支援並疲勞。Then己方支援0～1張回手，包含剛加入者；Then條件作用範圍須另以規則契約驗證。 |
| ST8-016 | 道具，G | Wind's Grace Earrings，己方戰鬥區有Wind Archer Cookie且己方支援至少5張，所有對手餅乾各受1。 |
| ST8-017 | 陷阱，GG | Hindering Darkness，0～1對手本回合攻擊-2；Then雙方支援張數相等時抽0～1。 |
| ST8-018 | 陷阱，G | Piercing Arrow of Purity，0～1對手本回合攻擊-1；Then己方支援至少5張時，同一目標再-1。 |
| ST8-019 | 陷阱，GG | Bad Omen，0～1對手本回合攻擊-2；Then雙方支援張數相等時，同一目標再-1。 |
| ST8-020 | 場景，G放置 | Dark Enchantress Laboratory，自己回合結束時可支付此場景進棄牌區，0～2己方支援設為活躍；不是Activate，也無額外能量費用。 |

ST9的20張原圖已逐張目視；以下為來源盤點，B為藍色支援能量，Cookie均為藍色。ST9-001～003已完成逐卡驗收並promote；其餘候選不因來源盤點而視為效果驗收。

| 卡號 | LV／HP與普通攻擊 | 技能／FLIP／Then印刷預期 |
|---|---|---|
| ST9-001 | 2／4，NNN普通3 | Gold Citrine Cookie，無技能、Then或FLIP。 |
| ST9-002 | 1／2，N普通1 | Aquamarine Cookie，無技能、Then或FLIP。 |
| ST9-003 | 2／4，BBB普通3 | Blue Whale Cookie，FLIP此揭示Cookie回手。 |
| ST9-004 | 2／3，BBB普通3 | Pond Dino Cookie，FLIP抽0～1。 |
| ST9-005 | 1／3，BN普通1 | Mystic Opal Cookie，Blocker付B，可轉向本Cookie；無REST／Once。 |
| ST9-006 | 3／6，BBB普通3 | Sea Fairy Cookie，免費Activate Once；手牌至多5時抽0～1。攻擊Then可棄任意手牌2，所有對手各受1。 |
| ST9-007 | 2／5，BBB普通2 | Peppermint Cookie，免費Activate Once；手牌至多3時抽0～1。 |
| ST9-008 | 3／5，BBB普通3 | Crimson Coral Cookie，On Play可支付己方戰鬥區LV2以下任意色Cookie回手，來源補1。 |
| ST9-009 | 1／2，B普通1 | Wave Drop，己方Sea Fairy Cookie效果將其從手牌移入棄牌時抽0～1；ST9-006 Then 可棄此牌，但官方來源尚未直接裁定尖括號成本是否符合「by the effect」，故維持needs-review。 |
| ST9-010 | 1／1，BB普通2 | Parfait Cookie，FLIP棄任意手牌1，原HP持有者補1。 |
| ST9-011 | 3／4，BBBB普通4 | Frilled Jellyfish Cookie，FLIP棄任意手牌1，原HP持有者補1。 |
| ST9-012 | 1／2，BB普通2 | White Pearl Cookie，免費On Play，手牌至多4時抽0～2。攻擊Then可另由支援支付B；己方戰鬥區有Sea Fairy Cookie時，0～1任意對手受1。 |
| ST9-013 | 道具，B | Shimmering Moonlit Coral，另棄一張任意類型藍色手牌，抽0～2。 |
| ST9-014 | 道具，BB | Glittering Pearl Shell，另棄任意手牌3，0～1任意己方餅乾補2。 |
| ST9-015 | 道具，B | Essence of the Ocean，手牌至多5時抽0～1；Then獨立選0～1己方剩餘HP至多5的Sea Fairy Cookie補1；前段手牌條件只限制抽牌。 |
| ST9-016 | 道具，BB | Bubble Wave Shell，另棄任意手牌3，0～1任意對手受3。 |
| ST9-017 | 陷阱，BBB | Revelation of the Seas，0～1對手本回合攻擊-3；Then手牌至多3時抽0～2。 |
| ST9-018 | 陷阱，B | Tower of Frozen Waves，0～1對手本回合攻擊-1；Then可另棄任意手牌1，同一目標再-1。 |
| ST9-019 | 陷阱，B | Curse of the Seas，0～1對手本回合攻擊-1；Then可另棄任意手牌2，重新選0～1剩餘HP至少2的任意對手受1；後段不要求原目標。 |
| ST9-020 | 場景，B放置 | Tearcrown，Activate只REST來源；手牌至多3時抽0～1。沒有Once或額外能量。 |

ST10的20張原圖已逐張目視；以下為來源盤點，P為紫色支援能量，Cookie均為紫色。未推進效果驗收cursor。

| 卡號 | LV／HP與普通攻擊 | 技能／FLIP／Then印刷預期 |
|---|---|---|
| ST10-001 | 2／4，PPP普通3 | Dreamweaver Cookie，FLIP此揭示Cookie回手。 |
| ST10-002 | 3／6，PPP普通3 | Moonlight Cookie，免費On Play，棄牌區0～1紫色LV2以下Cookie登場。攻擊Then可將己方戰鬥區一張紫色LV2以下Cookie進棄牌，抽0～2後棄恰1；抽零仍需棄牌。 |
| ST10-003 | 2／3，PPP普通3 | Poison Mushroom Cookie，FLIP抽0～1。 |
| ST10-004 | 1／3，PN普通1 | Wizard Cookie，Blocker付P，可轉向本Cookie；無REST／Once。 |
| ST10-005 | 1／2，P普通1 | Dreamcatcher，On Play可棄任意手牌1；己方戰鬥區有Moonlight Cookie時，0～1任意對手受1。 |
| ST10-006 | 1／2，PP普通2 | Blueberry Pie Cookie，Your Turn；來源從己方戰鬥區進棄牌時，0～1任意對手受1。昏厥本體進休息區不屬此事件。 |
| ST10-007 | 1／1，PP普通2 | Sugar Glass Cookie，FLIP棄任意手牌1，原HP持有者補1。 |
| ST10-008 | 2／4，PPP普通3 | Stardust Cookie，免費On Play，己方棄牌至少15張時所有對手各受1。攻擊Then可將己方戰鬥區一張紫色LV1 Cookie進棄牌，對原攻擊目標追加1；沒有重新選目標。 |
| ST10-009 | 1／1，PP普通1 | Space Doughnut，從己方戰鬥區進棄牌時抽0～1；沒有Your Turn限制。 |
| ST10-010 | 1／2，N普通1 | Prophet Cookie，無技能、Then或FLIP。 |
| ST10-011 | 2／4，NNN普通3 | Cream Unicorn Cookie，無技能、Then或FLIP。 |
| ST10-012 | 3／4，PPPP普通4 | Taurus Cookie，FLIP棄任意手牌1，原HP持有者補1。 |
| ST10-013 | 道具，P | Little Star，另將己方戰鬥區一張紫色LV1 Cookie進棄牌；0～1對手LV2以下Cookie進其棄牌。不是昏厥。 |
| ST10-014 | 道具，P | Lunar Compendium，另將己方戰鬥區一張紫色LV1 Cookie進棄牌；0～1任意對手受1。 |
| ST10-015 | 道具，PP | Essence of Moonlight，己方戰鬥或棄牌區有Moonlight Cookie時，每張對手Cookie最上方0～1張HP進棄牌。不是傷害或FLIP；逐張選零與實際移動另驗。 |
| ST10-016 | 道具，P | Delicate Glass Flower，己方棄牌至少15張時，0～1任意對手受1。 |
| ST10-017 | 陷阱，PP | Inside the Clock Tower，0～1對手本回合攻擊-2；Then己方牌庫頂0～3張進棄牌。 |
| ST10-018 | 陷阱，PP | Reunion of Star and Moon，0～1對手本回合攻擊-2；Then己方棄牌區0～1紫色LV3 Cookie回手。 |
| ST10-019 | 陷阱，P | Sleeping Moon，0～1對手本回合攻擊-1；Then己方棄牌至少20張時，同一目標再-1。 |
| ST10-020 | 場景，P放置 | Wizard Archives，Activate只REST來源，0～1己方戰鬥區紫色LV1 Cookie進棄牌，後者是效果而非尖括號代價。選零仍REST來源；沒有Once或額外能量。 |

來源：官方英文 cardList，取資料日期 2026-10-10。共100張，每系列20張；正式24張、候選76張。100張原圖皆已目視並記錄獨立預期；這不代表100張的效果已驗收。正式欄只表示卡池狀態，不能當作整副逐卡驗收。

本任務追蹤與完成定義見 [AI 工作報告](ai-cookierift-2026-10-10.md)。原圖、SHA256及來源URL保存在 `output/st6-st10/image-manifest.json`；prepared image不等於目視確認。剩餘候選全部維持inventory、禁止提前promote。ST6-001報告：`output/st6-st10/st6-001-browser/results.json`；正式資料檢查／registry／build／全域lint均exit0，本批完整Vitest 812檔／17,195項通過（1137.49秒、exit0）。ST6-002已另完成26案及promote後26案；本批全套曾有2項失敗、專項已重驗通過，全套重跑通過後再推進ST6-003。

| 卡號 | 卡名 | 卡池狀態 | 本輪卡面核對 | 本輪 Browser |

2026-10-11 ST7-002正式進度：Mango 已完成原圖逐字核對、免費On Play己方休息區總LV至少2→自身補1HP及Y普通1的實際來源驗收，已單卡promote。共用解析修正同時保留BS4-033休息LV5門檻與BS6-078手牌至多5門檻；候選12檔652項、正式13檔659項回歸、候選與正式build／全域lint／單卡strict／資料及registry皆exit0。候選與正式各同46案雙尺寸原圖Chrome（補HP36＋Mango普通攻擊10）及獨立實際指令重播PASS，仍為準備式局部流程，不等於開局至勝負或逐卡online。Lv3～5另12案正式AI探針確認門檻未達略過、達標接受免費補HP；標準AI Browser也PASS，這不是新勝率證據。正式44 JSON／2110卡號／2054轉換／1571 canonical AI cards；ST7能力稽核ready3／5能力／0unsupported／0conversionFailures。ST6～ST10現為30正式／70候選（ST6=20／0、ST7=3／17、ST8=1／19、ST9=1／19、ST10=5／15）。本批完整Vitest已終值exit0：872檔／18,125項全部PASS、1309.94秒，1665份來源／設定／資料指紋一致，來源凍結已結束；此完整回歸不涵蓋其後ST7-003候選來源修改。ST7-003原圖及獨立預期、轉接基線已存output；14種執行期strict變異僅攔2／漏12，正式來源未套用，也未promote。初版兩個無效手牌篩選欄位的診斷已撤回，v2改真實discardHandType／discardHandColor重驗，統計取v2。未commit／push。
|---|---|---|---|---|
| ST10-001 | Dreamweaver Cookie | 正式（已 promote） | 原圖及印刷逐卡核對 | FLIP發動／略過與所有者回手；正式雙尺寸Browser |
| ST10-002 | Moonlight Cookie | 正式（已 promote） | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-003 | Poison Mushroom Cookie | 正式（已 promote） | 原圖及印刷逐卡核對 | FLIP抽0／1、略過及無紫色能量；正式雙尺寸Browser |
| ST10-004 | Wizard Cookie | 正式（已 promote） | 原圖、印刷屬性與實際攻擊流程逐卡核對 | P Blocker轉向／略過／無紫能量；PN普通攻擊支付／缺N；正式雙尺寸Browser 10/10 |
| ST10-005 | Dreamcatcher | 正式（已 promote） | 原圖、印刷屬性與實際 On Play 逐卡核對 | 棄手牌1張；Moonlight 條件正反、付款後檢查、選零、正式雙尺寸 Browser 10/10 |
| ST10-006 | Blueberry Pie Cookie | 正式（已 promote） | 原圖、印刷HP、直接離場／Item費用流程逐卡核對 | Your Turn 正反時機、直接進棄牌與休息區／Break反例、指定／選零；ST10-013 Little Star 支付P作費用後觸發；正式雙尺寸Browser 8/8 |
| ST10-007 | Sugar Glass Cookie | 正式（已 promote） | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-008 | Stardust Cookie | 正式（已 promote） | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-009 | Space Doughnut | 正式（已 promote） | 依原圖、印刷HP與實際離場父流程逐卡核對 | battle-to-trash抽0～1；無Your Turn限制；對手回合補位、雙方佇列、Refresh及雙尺寸正式Browser 16/16 |
| ST10-010 | Prophet Cookie | 正式（已 promote） | 原圖已目視（2026-10-15；官方卡圖） | N普通攻擊1；正式strict verified；雙尺寸Browser 4/4 |
| ST10-011 | Cream Unicorn Cookie | 正式（已 promote） | 原圖已目視（2026-10-15；官方卡圖） | 紫色 LV.2／4HP；NNN普通攻擊3；strict verified；雙尺寸 Browser 4／4 |
| ST10-012 | Taurus Cookie | 正式（已 promote） | 原圖已目視核對（2026-10-15；官方卡圖，SHA-256 843DEB0A…109853E4） | 實際攻擊翻開FLIP後棄1手牌、HP承載者+1；無手牌略過；正式strict verified；雙尺寸 Browser 4/4 |
| ST10-013 | Little Star | 正式（已 promote） | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-014 | Lunar Compendium | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-015 | Essence of Moonlight | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-016 | Delicate Glass Flower | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-017 | Inside the Clock Tower | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-018 | Reunion of Star and Moon | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-019 | Sleeping Moon | 正式（已 promote） | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-020 | Wizard Archives | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST6-001 | Mala Sauce Cookie | 正式（已 promote） | 已目視原圖及效果驗收 | 雙尺寸14案及正式卡池重驗14案通過 |
| ST6-002 | Fire Spirit Cookie | 正式（已 promote） | 已目視原圖；strict verified及20項卡牌／規則／實體局面測試通過 | 雙尺寸26案及正式卡池重驗26案通過 |
| ST6-003 | Devil Cookie | 正式（已 promote） | 已目視原圖；單卡規則與strict通過 | 雙尺寸同10案候選／正式重驗通過（不重複累計） |
| ST6-004 | Pitaya Dragon Cookie | 正式（已 promote） | 已目視原圖；單卡規則與strict通過 | 雙尺寸同34案候選／正式重驗通過（不重複累計） |
| ST6-005 | Agar Agar Cookie | 正式（已 promote） | 已目視原圖；單卡規則與strict通過 | 雙尺寸同28案候選／正式重驗通過（不重複累計） |
| ST6-006 | Cherry Cookie | 正式（已 promote） | 已目視原圖；單卡規則與strict通過 | 雙尺寸同18案候選／正式重驗通過（不重複累計） |
| ST6-007 | Chili Pepper Cookie | 正式（已 promote） | 已目視原圖；單卡規則與strict通過 | 雙尺寸同28案候選／正式重驗通過（不重複累計） |
| ST6-008 | Candy Apple Cookie | 正式（已 promote） | 已目視原圖；單卡規則與strict通過 | 雙尺寸同24案候選／正式重驗通過（不重複累計） |
| ST6-009 | Capsaicin Cookie | 正式（已 promote） | 已目視原圖；單卡規則與strict通過 | 雙尺寸同32案候選／正式重驗通過（不重複累計） |
| ST6-010 | Peperoncino Cookie | 正式（已 promote） | 已目視原圖；單卡規則與strict通過 | 雙尺寸同34案候選／正式重驗通過（不重複累計） |
| ST6-011 | Habanero Cookie | 正式（已 promote） | 已目視原圖；單卡規則與strict通過 | 雙尺寸同24案候選／正式重驗通過（不重複累計） |
| ST6-012 | Picky Pyro-tiger | 正式（已 promote） | 已目視原圖；技能／strict根因修正與50項單卡測試通過 | 雙尺寸同32案候選／正式重驗通過（不重複累計） |
| ST6-013 | Hot Jellyco Missile | 正式（已 promote） | 原圖、漏轉接及strict修正、33項單卡／實體規則測試通過 | 雙尺寸同28案候選／正式及60張精確重播稽核通過（不重複累計） |
| ST6-014 | Essence of Conflagration | 正式（已 promote） | 原圖、完整費用／傷害／Then轉接與strict修正，52項單卡／實體規則通過 | 雙尺寸同32案候選／正式及60張精確重播核對通過（不重複累計）；局部fixture，不等於逐卡online／完整正式對局 |
| ST6-015 | Fire Spirit Cookie's Staff | 正式（已 promote） | 原圖RR＋任意己方頂端HP；0～1任意己方本回合攻擊+2。4檔68項、strict18種變異拒絕；正式受影響49檔714項PASS | 候選／正式雙尺寸相同34案通過，不重複累計；修正HP代價離場目標，本機投影／線上先付後選；逐卡online完整對局未驗收 |
| ST6-016 | Dragon's Breath | 正式（已 promote） | 原圖RRR＋棄任意手牌1；0～2對手依選取順序2／1傷害。42項、18種strict變異拒絕，既有2103正式分析不變 | 隔離／來源候選雙尺寸相同30案與精確重播通過；新增順位，取消重選、昏厥及實際AI FLIP。正式build／lint／337項回歸／雙尺寸30案與重播／資料／registry／AI Browser通過；完整860檔17,814項PASS、1323.39秒、1632指紋一致，逐卡online未驗收 |
| ST6-017 | Restored Power of Fire | 正式（已 promote） | 原圖RR、0～1對手-2；己方戰鬥區恰1HP時同一目標再-1；51項／23種strict錯誤變異／2104既有分析不變 | 候選來源366項與雙尺寸40案及重播通過後promote；正式373項、資料／registry／strict及AI ready17通過；build PASS／lint PASS／正式40案 PASS／重播 PASS／AI Browser PASS；本批完整回歸及逐卡online尚未驗收 |
| ST6-018 | Frozen Flame | 正式（已 promote） | 原圖、36項單卡、strict、雙尺寸28案／重播PASS；正式393項PASS | 正式build／資料／registry PASS；lint PENDING，AI Browser PASS；本批全套待020 |
| ST6-019 | Power Unleashed | 正式（已 promote） | 原圖、53項單卡、strict、雙尺寸46案／獨立重播PASS | 候選403項／build PASS、lint PASS；正式Chrome PASS，本批全套待020 |
| ST6-020 | Into the Depths | 正式（已 promote） | 原圖、61項、strict、雙尺寸38案／獨立重播PASS | 隔離407項／build／型別PASS；來源回歸 PASS、build PASS、全域lint PASS；本批全套待最後狀態 |
| ST7-001 | Blue Lily Cookie | 正式（已 promote） | 原圖、54項單卡／契約、正式321項回歸、strict verified／AI ready | 候選與正式雙尺寸各同44案／重播PASS；逐卡online未驗收 |
| ST7-002 | Mango Cookie | 正式（已 promote） | 原圖、42項新回歸；正式13檔659項、build／全域lint／strict／資料／registry PASS | 候選及正式各同46案Chrome／重播PASS；Lv3～5 AI 12案PASS；逐卡online未驗收 |
| ST7-003 | Rainbow Sherbet Cookie | 正式（已 promote） | 正式7檔133項、build／全域lint／strict／資料／registry PASS | 正式28案Chrome／重播、12案AI探針PASS；逐卡online未驗收 |
| ST7-004 | Fig Cookie | 正式（已 promote） | 已 promote；正式回歸證據見現況段落 | 逐卡驗收沿用先前專項證據；逐卡online未驗收 |
| ST7-005 | Caramel Choux Cookie | 正式（已 promote） | 已核對 | 雙尺寸正反／救援通過 |
| ST7-006 | Cream Puff Cookie | 正式（已 promote） | 已 promote；正式回歸證據見現況段落 | 逐卡驗收沿用先前專項證據；逐卡online未驗收 |
| ST7-007 | Fairy Cookie | 正式（已 promote） | 已 promote；正式回歸證據見現況段落 | 逐卡驗收沿用先前專項證據；逐卡online未驗收 |
| ST7-008 | Elder Faerie Cookie | 正式（已 promote） | 正式單卡59項與strict、資料／registry通過；完整897檔／18674項PASS | 正式登場22／攻擊20／AI4案雙尺寸精確回放PASS；局部test-state，逐卡online未驗收 |
| ST7-009 | Lilybell Cookie | 正式（已 promote） | 已 promote；正式回歸證據見現況段落 | 逐卡驗收沿用先前專項證據；逐卡online未驗收 |
| ST7-010 | Millennial Tree Cookie | 正式（已 promote） | 已重驗原圖；HP≤4技能與FLIP手牌代價抽0～2局部規則通過，26項專項／572項受影響回歸 | Browser／完整回歸／promote待完成 |
| ST7-011 | Millennial Jade Deer | 正式（已 promote） | 已 promote；正式回歸證據見現況段落 | 逐卡驗收沿用先前專項證據；逐卡online未驗收 |
| ST7-012 | Churro Cookie | 正式（已 promote） | 已 promote；正式回歸證據見現況段落 | 逐卡驗收沿用先前專項證據；逐卡online未驗收 |
| ST7-013 | Miraculous Nutrient Ampoule | 正式（已 promote） | 正式130項、strict／build／資料／registry通過；完整894檔／18614項PASS | 正式雙尺寸24案及逐欄位精確回放PASS；逐卡online完整對局未驗收 |
| ST7-014 | Essence of Rejuvenation | 正式（已 promote） | 2026-10-12 原圖與來源一致；修正原先漏掉己方同名LV3戰鬥／Break條件，另保留條件未達可付款而無效果。25項卡牌契約與42項實體指令測試、8檔166項受影響回歸（範圍重疊）、build、受影響lint、單卡strict通過；卡面基線1敗，契約基線22敗／3過均保留 | 候選雙尺寸28案Chrome與28案完整狀態／commandLog獨立重播PASS，含取消／返回、區域、HP、支付及Refresh。仍為準備式局部UI，未promote／正式Browser／逐卡online。標準AI Browser執行中；其餘單卡邊界與正式全套待收尾。證據：output/st6-st10/st7-014-candidate-browser-run2/replay-audit.json、st7-014-regression-run1.log、st7-014-build-run2.log |
| ST7-015 | Budding Future | 正式（已 promote） | 68項單卡／228項正式回歸（重疊），build／lint／資料／registry／strict PASS；批末full PASS | 正式雙尺寸32案操作＋4案Lv5，各完整重播PASS；逐卡online未驗收 |
| ST7-016 | Tightly Tied Vine | 正式（已 promote） | 19卡牌／35實體AI／11政策測試，正式261項（重疊）；build／產品lint／資料／registry／strict PASS；批末full PASS | 正式雙尺寸20案＋8案Lv5，各完整重播PASS；逐卡online未驗收 |
| ST7-017 | Vined Cavern | 正式（已 promote） | 23卡牌／41實體AI／344正式回歸（重疊），build／lint／資料／registry／strict PASS；批末full PASS | 正式雙尺寸36案＋8案Lv5，各完整重播PASS；逐卡online未驗收 |
| ST7-018 | Millennial Tree Cookie's Gift | 正式（已 promote） | 19契約／33實體AI；v20完整914檔／19094項、build／lint／資料／registry／strict PASS | 正式雙尺寸44案含10案Lv5，各完整狀態重播PASS；逐卡online未驗收 |
| ST7-019 | Millennial Jade Deer's Wrath | 候選 inventory | 已目視原圖，待效果驗收 | 本輪未驗收 |
| ST7-020 | Forest of Life | 已 promote | 原圖／契約／正式Chrome62與精確重播62 PASS | 完整Vitest 920檔／19271項PASS；逐卡online未驗收 |
| ST8-001 | Greenbell Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-002 | Muscle Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-003 | Leek Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-004 | Red Panna Cotta Cookie | 正式（已 promote） | strict 1 verified；逐卡紀錄：`output/st6-st10/st8-004-promotion.json` | 候選／正式 Browser 各48案；逐卡online未驗收 |
| ST8-005 | Wind Archer Cookie | 正式（已 promote） | strict 1 verified；逐卡紀錄：`output/st6-st10/st8-005-promotion.json` | 遊戲內效果測試與promotion記錄保留；逐卡online未驗收 |
| ST8-006 | Basil Pesto Cookie | 正式（已 promote） | strict 1 verified；逐卡紀錄：`output/st6-st10/st8-006-promotion.json` | 完整回歸940檔／19,627項PASS；逐卡online未驗收 |
| ST8-007 | Blue Slushy Cookie | 正式（已 promote） | strict 1 verified；逐卡紀錄：`output/st6-st10/st8-007-promotion.json` | 正反效果與候選／正式Browser證據留存；引用批次回歸非fresh full run；逐卡online未驗收 |
| ST8-008 | Sugar Swan Cookie | 正式（已 promote） | strict 1 verified；逐卡紀錄：`output/st6-st10/st8-008-promotion.json` | 正反效果與候選／正式Browser證據留存；引用批次回歸非fresh full run；逐卡online未驗收 |
| ST8-009 | Cucumber Cookie | 正式（已 promote） | strict 1 verified；逐卡紀錄：`output/st6-st10/st8-009-promotion.json` | 正反效果與候選／正式Browser證據留存；引用批次回歸非fresh full run；逐卡online未驗收 |
| ST8-010 | Cookiemals | 正式（已 promote） | strict 1 verified；逐卡紀錄：`output/st6-st10/st8-010-promotion.json` | 正反效果與候選／正式Browser證據留存；當批完整回歸原標為pending；逐卡online未驗收 |
| ST8-011 | Kiwi Cookie | 正式（已 promote） | strict 1 verified；逐卡紀錄：`output/st6-st10/st8-011-promotion.json` | 正反效果與候選／正式Browser證據留存；當批完整回歸原標為pending；逐卡online未驗收 |
| ST8-012 | Windcatcher | 正式（已 promote） | 原圖／strict 1 verified／候選正反 test-state Browser／正式資料及registry驗證通過 | 受影響5檔104項、完整Vitest 966檔／20532項、全域lint及build PASS |
| ST8-013 | Windgrass | 正式（已 promote） | 原圖／strict 1 verified／30種錯誤runtime拒絕／正式資料及registry驗證通過 | 桌面正反與平板正向 test-state UI 通過；平板反向未驗 |
| ST8-014 | Cape of the Vanquisher | 正式（已 promote） | strict 1 verified；逐卡紀錄：`output/st6-st10/ST8-014-contract-20261014.json` | 正反效果Browser 4/4；批末Vitest 989檔／20,648項PASS |
| ST8-015 | Essence of the Tempest | 正式（已 promote） | strict 1 verified；逐卡紀錄：`output/st6-st10/ST8-015-contract-20261014.json` | 無Wind pending交接與Then Browser 10/10；批末Vitest 989檔／20,648項PASS |
| ST8-016 | Wind's Grace Earrings | 正式（已 promote） | strict 1 verified；逐卡紀錄：`output/st6-st10/ST8-016-contract-20261014.json` | 全對手傷害與FLIP Browser 4/4；批末Vitest 989檔／20,648項PASS |
| ST8-017 | Hindering Darkness | 正式（已 promote） | strict 1 verified；逐卡紀錄：`output/st6-st10/ST8-017-contract-20261014.json` | 陷阱、攻擊減傷及Then Browser 6/6；批末Vitest 989檔／20,648項PASS |
| ST8-018 | Piercing Arrow of Purity | 正式（已 promote） | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-019 | Bad Omen | 正式（已 promote） | strict 1 verified；逐卡紀錄：`output/st6-st10/ST8-019-contract-20261014.json` | 目標傷害與Trap Then Browser 6/6；批末Vitest 989檔／20,648項PASS |
| ST8-020 | Dark Enchantress Laboratory | 正式（已 promote） | strict 1 verified；逐卡紀錄：`output/st6-st10/ST8-020-contract-20261014.json` | Stage放置、消耗及回合結束Browser 6/6；批末Vitest 989檔／20,648項PASS |
| ST9-001 | Gold Citrine Cookie | 正式（已 promote） | strict正式 1 verified；`output/st6-st10/ST9-001-formal-contract-20261014.json` | 正式Browser 4/4（桌面／平板）；NNN普通3傷害與不足能量未付款 |
| ST9-002 | Aquamarine Cookie | 正式（已 promote） | strict正式 1 verified；`output/st6-st10/ST9-002-formal-contract-20261014.json` | 正式Browser 4/4（桌面／平板）；N普通1傷害與不足能量未付款 |
| ST9-003 | Blue Whale Cookie | 正式（已 promote） | strict正式 1 verified；`output/st6-st10/ST9-003-formal-contract-20261014.json` | 正式Browser 4/4（桌面／平板）；BBB普通3傷害，FLIP將此次揭示的Blue Whale回手（紀錄辨識卡名、對手手牌+1） |
| ST9-004 | Pond Dino Cookie | 正式（已 promote） | strict正式 1 verified；`output/st6-st10/ST9-004-contract-20261014.json` | 正式Browser 6/6；真實攻擊翻FLIP並結算抽0／1 |
| ST9-005 | Mystic Opal Cookie | 正式（已 promote） | strict正式 1 verified；`output/st6-st10/ST9-005-contract-20261014.json` | 正式Browser 6/6；B支付後轉向Blocker，錯色不可發動 |
| ST9-006 | Sea Fairy Cookie | 正式（已 promote） | strict正式 1 verified；`output/st6-st10/ST9-006-contract-20261014.json` | 正式Browser 6/6；手牌門檻與攻擊Then全體傷害結算 |
| ST9-007 | Peppermint Cookie | 正式（已 promote） | strict正式 1 verified；`output/st6-st10/ST9-007-formal-contract-20261014.json` | 正式Browser 6/6；手牌≤3抽0／1，>3不發動 |
| ST9-008 | Crimson Coral Cookie | 正式（已 promote） | strict正式 1 verified；`output/st6-st10/ST9-008-formal-contract-20261014.json` | 正式Browser 4/4；LV2以下餅乾回手後來源+1HP，無合法代價跳過 |
| ST9-009 | Wave Drop | 正式資料（依使用者指示先promote；needs-review） | 正式 strict 0 verified／1 needs-review／0 blocked；`npm.cmd run cards:audit:contracts -- --dir data/cards --card ST9-009` | ST9-006 Then 的 `<discard 2 cards>` 可棄到此牌，但官方來源未直接裁定這筆成本是否符合「by effect」；目前沒有其他已確認Sea Fairy效果將其從手牌移入棄牌區。已正式化資料，但尚無官方語義裁定。 |
| ST9-010 | Parfait Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-011 | Frilled Jellyfish Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-012 | White Pearl Cookie | 正式（已 promote） | strict正式 1 verified；`output/st6-st10/ST9-012-contract-formal-20261014.json` | 正式Browser 18/18；On Play手牌≤4抽0～2，攻擊Then可由支援支付B並依Sea Fairy Cookie條件造成1傷害 |
| ST9-013 | Shimmering Moonlit Coral | 正式（已 promote） | strict正式 1 verified；`output/st6-st10/ST9-013-contract-formal-final-20261014.json` | 正式Browser 12/12；藍色道具支付B＋棄藍色手牌後抽0～2，桌面／平板、草稿取消與錯誤資源負向均通過 |
| ST9-014 | Glittering Pearl Shell | 正式（已 promote） | strict正式 1 verified；`output/st6-st10/ST9-014-contract-formal-final-20261014.json` | 正式Browser 10/10；支付BB與棄3張牌，Cookie補2HP，桌面／平板及零目標／取消／不足資源均通過 |
| ST9-015 | Essence of the Ocean | 正式（已 promote） | strict正式 1 verified；`output/st6-st10/ST9-015-contract-formal-20261015.json` | 正式Browser 10/10；支付B、手牌門檻抽牌、Then己方Sea Fairy補HP；錯名／錯方／6HP負向候選排除，桌面／平板通過 |
| ST9-016 | Bubble Wave Shell | 正式（已 promote） | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-017 | Revelation of the Seas | 正式（已 promote） | 已核對原圖、印刷費用及效果 | strict／正式雙尺寸 Browser 通過 |
| ST9-018 | Tower of Frozen Waves | 正式（已 promote） | 已核對原圖、印刷費用及效果 | strict／正式雙尺寸 Browser 通過 |
| ST9-019 | Curse of the Seas | 正式（已 promote） | 已核對原圖、印刷費用及效果 | strict／正式雙尺寸 Browser 通過 |
| ST9-020 | Tearcrown | 正式（已 promote） | 已核對原圖、印刷費用與Activate流程 | strict／正式雙尺寸 Browser 6/6 通過 |




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

2026-10-14 ST9-017～019正式逐卡驗收與promotion：三張均依原圖核對，strict候選與正式稽核各1 verified／0 needs-review／0 blocked，三份正式來源hash與promotion前候選一致。只以含017～019的隔離stage進行promotion；ST9候選匯總移除這三張後保留16張inventory。ST9-017為BBB、選0～1對手Cookie本回合攻擊傷害-3，手牌至多3再抽0～2；ST9-018為B、選0～1對手Cookie本回合攻擊傷害-1，Then可棄1張手牌並沿用同目標再-1；ST9-019為B、先-1，Then可棄2張手牌後另選1張至少2HP的對手Cookie造成1傷害。正式原圖Browser 12／12（桌機1366×768／平板1164×777），驗證付款、原始目標、選填代價、獨立Then目標／1HP排除及實際攻擊傷害；三卡原圖746×1038。修正共用command log在後續目標效果排隊時誤記「未選擇目標／效果未生效」；TDD基線1失敗／55通過，修後定向6檔85項通過，正式Browser trace亦核對後續目標命令。build、validate:cards（77檔／2,149卡號／2,093轉接）、check:card-pool及candidate（5檔／31張inventory）通過；完整Vitest 994檔／20,681項，1,313.80秒，exit0。全域lint程序13分鐘無輸出後中止；修改檔定向ESLint通過，不能列全域lint通過。Browser為本機test-state卡牌流程，不代表逐卡online或完整對局。ST6～ST10合計69正式／31候選（ST6 20／0、ST7 20／0、ST8 20／0、ST9 4／16、ST10 5／15）；ST9-020預檢strict仍0 verified／1 needs-review／0 blocked，Activate付款／時機／效果未轉接，留待下一張獨立驗收。AI決策品質／整體勝率尚未完成驗收，未commit／push。

2026-10-15 ST10-017／018／020正式逐卡驗收與promotion：三張均依原圖、印刷屬性及文字逐卡核對，以僅含三筆資料的promotion-ready隔離stage promote；候選彙總僅移除這三張並保留其他候選。ST6～ST10目前99正式／1候選（ST6 20／0、ST7 20／0、ST8 20／0、ST9 19／1、ST10 20／0）。ST10-017【Inside the Clock Tower】紫色Trap，PP後選0～1對手餅乾本回合攻擊傷害-2，Then選0～3張牌庫頂移入己方棄牌；實際選0、1、2、3皆驗，取消目標仍續Then，短牌庫能接Refresh。ST10-018【Reunion of Star and Moon】紫色Trap，PPP後選0～1對手餅乾本回合攻擊傷害-2，Then回收0～1張己方紫色LV.3棄牌餅乾至手牌；非法顏色／等級不列候選，選零或無合法目標均驗。ST10-020【Wizard Archives】紫色Stage，P放置後Activate休息此場景，再將0～1張己方紫色LV.1戰鬥餅乾放入棄牌；合法目標、無目標及藍色錯色指令遭規則層拒絕且狀態不變均驗。候選及正式strict三張各1 verified／0 needs-review／0 blocked，source hash一致；`validate:candidate` 5檔／1張inventory、`validate:cards` 96檔／2,179卡號／2,123轉換、registry check通過。正式資料`data/cards/official-st10-017-018-020.en.json`；promotion後只移除三筆來源候選，正式卡池共用LEDGER後的ST10 strict報告為`output/st6-st10/ST10-017-contract-formal-post-ledger-fix-20261015.json`等三份。

ST10正式Browser為桌機1366×768及平板1164×777共26／26 PASS、0錯誤，載入原圖746×1038；依實際支付、目標UI、Then、結算與正式指令trace驗收。定向Vitest 9檔／224項PASS；批末完整Vitest `npm.cmd test -- --maxWorkers=1` exit0，1,049檔／21,004項，1,343.89秒。build exit0、2,200 modules；Vite仍提示game-demo大型chunk。標準`npm.cmd run lint`掃描含歷史產物的整個工作區4分半無輸出後人工中止（exit1，不能列為全域通過）；排除`output/`、`.tmp*`與附件產物後同一ESLint正式程式碼範圍命令exit0。共用LEDGER後定向合約測試及三卡formal strict均重跑通過。Browser是本機test-state，未驗逐卡online或完整對局；未commit／push。

AI與來源待續：ST9-009已依使用者指示先promote至正式資料，但strict contract仍needs-review；使用者指出ST9-006攻擊後的Then與此被動有關，卡文確認它能將手牌中的ST9-009送入棄牌，該次棄牌位於 `<discard 2 cards>` 成本中。官方 FAQ 將特定棄牌路徑區分為遊戲規則而非卡牌效果，也分開描述成本與後續效果，但沒有直接裁定 ST9-006 這筆成本是否滿足 ST9-009 的「by effect」條件；現有測試只確認目前 runtime 不排入被動觸發佇列，不是官方語義裁定。BS2-029棄1張同為尖括號代價，BS11-069是將手牌放牌庫頂，BS4-073沒有手牌棄置效果；目前沒有其他已確認Sea Fairy效果將ST9-009從手牌移入棄牌；資料已依使用者指示正式化，但仍維持needs-review。公開條件無效陷阱守衛已納入AI R7（Lv.3+）；原卡局面反例19／19、批末Vitest全數通過。三組matched run原始4,560筆包含760筆逐局完全相同的重複紀錄，第三組無重疊；去重後3,800局，候選1,908勝／基準1,892勝，固定矩陣小幅方向性結果，未證明穩定或人類勝率提升；詳見 docs/ai-cookierift-2026-10-10.md。

最新Lv.5 holdout則以目前policy對比HEAD基準完成兩批不重疊seed（203100000／203200000），19副牌共3,040局，候選1,539勝、基準1,501勝（50.63%）；760組初始預檢及3,040組逐局parity全通過，0失敗／未完成／動作上限，來源規則／資料hash一致。這是固定矩陣的描述性結果，不代表統計顯著或人類勝率；完整分析與兩份報告路徑見 `docs/ai-cookierift-2026-10-10.md`。
