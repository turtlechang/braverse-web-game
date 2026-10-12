# ST6～ST10 逐卡盤點

<!-- ai-starter-current-start -->
ST7-008 隔離進度（2026-10-12，仍為候選）：原圖黃色 LV2／HP4／YYY 普通3，免費 On Play 需同張己方具名 LV3 Millennial Tree 位於戰鬥或休息區，回收0～1黃色LV1；攻擊 Then 在己方休息區總LV≥4時對原防守者追加1。新增具名休息區條件與 exact contract 草稿，18種錯誤變異全攔。實際登場／攻擊反例證實：LV4回收至LV3會失去追加傷害；Lv3～5基線都選回收，錯失公開局面的立即獲勝機會；隔離原型保留此機會，仍在不能攻擊、非致勝、LV5降至LV4時正常回收，隱藏卡順序不影響決策。另補自動 attack 缺少原防守者目標的規則入口反例及隔離修正；同組47項基線4失敗／43通過，原型47全過。桌機／平板14案真實登場UI及每個狀態欄位／完整commandLog獨立回放PASS，涵蓋正向／選零／戰鬥見證／錯名／對手見證／無見證／錯階段；初輪driver誤等負向效果面板而逾時已保留，修為檢查實際自動略過。這14案尚不涵蓋攻擊Then或新AI原型的Chrome操作，非完整對局／online驗收。所有新規則與AI修正仍在output隔離，正式AI仍v15、ST6～ST10仍38正式／62候選，未promote／commit／push，也沒有新勝率證據。證據：output/st6-st10/st7-008-ai-auto-prototype-run1.log、st7-008-onplay-browser-run2/replay-audit.json。

正式 v15 新種子對照已完成（2026-10-12）：相同正式規則、卡池與其他 AI 政策，只比較空目標可選移動 guard 開／關，兩組各 624 場共 **1,248 場，631：617（50.56%）**；成對受益 8、受損 1、互分勝負 615，全部完成且零錯誤。這是單一政策消融比較，不是全部 v15 改動對舊版，也不是人類勝率或穩定優勢證明。每色每策略各 208 場，藍 83／83、綠 64／53、黃 93／92、紅 113／111、紫 115／115、黑 163／163；分色差額同時受對手政策與配對影響。逐場、座位、先後手、牌表及 bundle／報告雜湊獨立稽核 PASS。證據：output/st6-st10/ai-v15-holdout/combined-audit.json、color-comparison-audit.json。

ST7-013／正式 v15 本輪完整回歸已結束（2026-10-12）：**894 檔／18,614 項全部 PASS，1480.40 秒、exit0**；1717 份來源／設定／資料指紋一致、integrity exit0，來源凍結已解除。全域 lint exit0。涵蓋 ST7-013 正式付款／可選傷害、AI 安全 Break 代價、協定欄位檢查、UI 與 adapter 首次初始化效能修正，並保留 v14 空移動略過與 ST7-011 目前 LV 條件。證據：output/st6-st10/ai-v15-st7-013-full-completion.json、ai-v15-st7-013-full-vitest-run1.log。下列 v14 完整結果為歷史證據；v15 新種子單一政策消融結果見本節。

ST7-013 已 promote（2026-10-12）：依原圖支付 YY＋己方棄牌區恰好 1 張黃色 Cookie 放入 Break，之後對手 0～1 Cookie 受 2 效果傷害；代價使己方 Break 達 10 時先敗北、不結算傷害。正式 AI v15 選較低印刷 LV 的合法代價，拒絕付款自敗，並保留 v14 空移動略過。候選／正式來源／正式卡池各同 24 案雙尺寸 Chrome 及全部狀態欄位精確回放通過，不重複累加；正式 5 檔 130 項、共用 10 檔 231 項、AI 分類 9 項、build／受影響 lint／伺服器型別／資料／registry／單卡 strict 通過。協定拒絕非字串代價 ID；好友房核心雙瀏覽器同步通過，仍非逐卡 online 完整對局。首次來源回歸兩項 ST6-015 hook 逾時與建房未回應已保留；CPU profile 定位新增效果欄位放於大型展開前的效能退化，調整欄位順序後同局面首次初始化 14.47 秒回到 0.68 秒（修改前 0.67 秒），原測試不放寬時限即通過。正式 v15 新種子單一政策消融為 631／617，不把 v14 的 637／611 當成 v15 勝率。最新證據：output/st6-st10/st7-013-formal-browser-run1/replay-audit.json、st7-013-promotion.json。 全卡池 strict AI 稽核仍因既有 unsupported 清單而 exit1／conservative，9 項回歸確認清單未變、conversionFailures 為空；ST7 系列 strict ready，不能宣稱全卡池 AI 無缺口。

ST7-011 完整回歸 run1 已結束（2026-10-12，session85902）：890 檔中 889 通過，18,547 項中 18,546 通過、1 失敗，1271.44 秒、exit1；1709 份來源／設定／資料指紋一致、integrity exit0，來源凍結已解除。唯一失敗為卡池稽核仍預期 2060，實際為 2061；重新執行正式全卡池 AI 稽核確認 2061 inventory／1578 canonical、conversionFailures 空、unsupported 清單未變。精確計數更新並加入 ST7-011 單卡分類回歸後，該檔 8 項通過；未放寬既有 unsupported／conversionFailures 斷言；後續 v14＋ST7-011 新指紋完整回歸 891 檔／18,559 項已全部通過，首輪失敗紀錄保留。

AI 空移動代價修正已套入正式來源 v14（2026-10-12，完整回歸已通過）：原型兩組 624 場分別 323：301、314：310，合計 1248 場新策略 637／舊策略 611（51.04%），零錯誤；624 組成對比較 beneficial15／harmful2／split607。完整工作組合、bundle／牌表／報告雜湊稽核 PASS，不宣稱對人類勝率或穩定優勢。正式 handler 與受測候選的標準化可執行 JavaScript 完全相同。基線實際敗局保留；原型 9 案 PASS，正式新增 11 案涵蓋 Lv3～5 無目標略過、有目標救援、真實隱藏卡順序排列及 Lv1～2 舊行為。原型 Chrome 8 案與正式 Chrome 4 案逐欄位精確重播 PASS，標準 AI Browser 六項 PASS，正式 build／受影響 lint PASS；局部準備式 Browser 非完整 UI 對局或 online。最新證據：output/st6-st10/ai-empty-then-benchmark/combined-audit.json、ai-v14-formal-browser-run1/replay-audit.json。

分色補充：兩組比較各色各策略皆 208 場；藍 91／89、綠 68／51、黃 101／100、紅 103／102、紫 116／112、黑 158／157（新／舊勝場）。逐場與報告雜湊核驗 PASS，合計 637／611；同場是新策略對舊策略，因此分色差額含對手策略改變及牌組對局的影響，不能當作各色獨立因果效果或對人類勝率。證據：output/st6-st10/ai-empty-then-benchmark/color-comparison-audit.json。

目前狀態（2026-10-12）：ST6～ST10 **38／100 已 promote、62 張候選**；ST6=20／0、ST7=11／9、ST8=1／19、ST9=1／19、ST10=5／15。正式卡池 52 JSON／2118 卡號／2062 可轉換／1579 canonical AI cards。沿用六色 BS12 與 Cookierift 921／927／67／83／568／506 共 12 副牌表，預設 Lv5、正式 AI 政策為 v15。ST7-013 本輪完整回歸已通過；下列 v14 完整回歸為較早快照。

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
| ST7-010 | 3／5，YYY普通3 | Millennial Breath，免費Activate Once棄任意手牌1，0～1己方剩餘HP至多4餅乾補1。攻擊Then可棄手牌一張有FLIP的Cookie，再抽0～2。 |
| ST7-011 | 1／2，YY普通2 | 攻擊Then：來源剩餘HP至多2，且己方戰鬥區有LV3 Millennial Tree Cookie，來源補1。休息區見證不符合此卡。 |
| ST7-012 | 1／3，YN普通1 | Churro Tribe Warrior，Blocker付Y，可轉向本Cookie；沒有REST、Once或手牌代價。 |
| ST7-013 | 道具，YY | 另將己方棄牌區一張黃色Cookie進休息區，0～1任意對手受2。代價不限制LV1。 |
| ST7-014 | 道具，Y | 己方戰鬥或休息區有LV3 Millennial Tree Cookie時，0～1任意己方餅乾補1。條件不成立仍須另核對付款與no-op。 |
| ST7-015 | 道具，YY | 相同戰鬥或休息區LV3 Millennial Tree條件，本回合所有己方餅乾攻擊+1。 |
| ST7-016 | 道具，YY | 0～1剩餘HP至多2的任意對手，下次對手Active Phase不設為活躍。不是立即REST。 |
| ST7-017 | 陷阱，Y | 0～1任意對手本回合攻擊-1；Then己方休息總LV至少4，同一目標再-1。 |
| ST7-018 | 陷阱，YY | 所有己方餅乾補1HP，不限顏色或LV，沒有選擇目標。 |
| ST7-019 | 陷阱，Y | 另將一張任意手牌Cookie進己方休息區，0～1任意對手受1。 |
| ST7-020 | 場景，Y放置 | Forest of Life；Activate付Y及REST來源；本回合任意己方餅乾曾獲得HP時抽0～1。沒有Once；須核對本回合HP增加事件，而非只看當前HP。 |

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
| ST8-019 | 陷阱，G | Bad Omen，0～1對手本回合攻擊-2；Then雙方支援張數相等時，同一目標再-1。 |
| ST8-020 | 場景，G放置 | Dark Enchantress Laboratory，自己回合結束時可支付此場景進棄牌區，0～2己方支援設為活躍；不是Activate，也無額外能量費用。 |

ST9的20張原圖已逐張目視；以下為來源盤點，B為藍色支援能量，Cookie均為藍色。未推進效果驗收cursor。

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
| ST9-009 | 1／2，B普通1 | Wave Drop，從己方手牌因己方Sea Fairy Cookie效果進棄牌時抽0～1；效果與尖括號代價的事件來源需另依規則核驗，不以同名來源直接假定相同。 |
| ST9-010 | 1／1，BB普通2 | Parfait Cookie，FLIP棄任意手牌1，原HP持有者補1。 |
| ST9-011 | 3／4，BBBB普通4 | Frilled Jellyfish Cookie，FLIP棄任意手牌1，原HP持有者補1。 |
| ST9-012 | 1／2，BB普通2 | White Pearl Cookie，免費On Play，手牌至多4時抽0～2。攻擊Then可另由支援支付B；己方戰鬥區有Sea Fairy Cookie時，0～1任意對手受1。 |
| ST9-013 | 道具，B | Shimmering Moonlit Coral，另棄一張任意類型藍色手牌，抽0～2。 |
| ST9-014 | 道具，BB | Glittering Pearl Shell，另棄任意手牌3，0～1任意己方餅乾補2。 |
| ST9-015 | 道具，B | Essence of the Ocean，手牌至多5時抽0～1；Then選0～1己方剩餘HP至多5的Sea Fairy Cookie補1。前段條件的Then作用範圍須另核驗。 |
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
| ST10-001 | Dreamweaver Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-002 | Moonlight Cookie | 正式（已 promote） | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-003 | Poison Mushroom Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-004 | Wizard Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-005 | Dreamcatcher | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-006 | Blueberry Pie Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-007 | Sugar Glass Cookie | 正式（已 promote） | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-008 | Stardust Cookie | 正式（已 promote） | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-009 | Space Doughnut | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-010 | Prophet Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-011 | Cream Unicorn Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST10-012 | Taurus Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
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
| ST7-008 | Elder Faerie Cookie | 候選 inventory | 已目視原圖，待效果驗收 | 本輪未驗收 |
| ST7-009 | Lilybell Cookie | 正式（已 promote） | 已 promote；正式回歸證據見現況段落 | 逐卡驗收沿用先前專項證據；逐卡online未驗收 |
| ST7-010 | Millennial Tree Cookie | 候選 inventory | 已目視原圖，待效果驗收 | 本輪未驗收 |
| ST7-011 | Millennial Jade Deer | 正式（已 promote） | 已 promote；正式回歸證據見現況段落 | 逐卡驗收沿用先前專項證據；逐卡online未驗收 |
| ST7-012 | Churro Cookie | 正式（已 promote） | 已 promote；正式回歸證據見現況段落 | 逐卡驗收沿用先前專項證據；逐卡online未驗收 |
| ST7-013 | Miraculous Nutrient Ampoule | 正式（已 promote） | 正式130項、strict／build／資料／registry通過；完整894檔／18614項PASS | 正式雙尺寸24案及逐欄位精確回放PASS；逐卡online完整對局未驗收 |
| ST7-014 | Essence of Rejuvenation | 候選 inventory | 已目視原圖，待效果驗收 | 本輪未驗收 |
| ST7-015 | Budding Future | 候選 inventory | 已目視原圖，待效果驗收 | 本輪未驗收 |
| ST7-016 | Tightly Tied Vine | 候選 inventory | 已目視原圖，待效果驗收 | 本輪未驗收 |
| ST7-017 | Vined Cavern | 候選 inventory | 已目視原圖，待效果驗收 | 本輪未驗收 |
| ST7-018 | Millennial Tree Cookie's Gift | 候選 inventory | 已目視原圖，待效果驗收 | 本輪未驗收 |
| ST7-019 | Millennial Jade Deer's Wrath | 候選 inventory | 已目視原圖，待效果驗收 | 本輪未驗收 |
| ST7-020 | Forest of Life | 候選 inventory | 已目視原圖，待效果驗收 | 本輪未驗收 |
| ST8-001 | Greenbell Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-002 | Muscle Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-003 | Leek Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-004 | Red Panna Cotta Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-005 | Wind Archer Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-006 | Basil Pesto Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-007 | Blue Slushy Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-008 | Sugar Swan Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-009 | Cucumber Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-010 | Cookiemals | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-011 | Kiwi Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-012 | Windcatcher | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-013 | Windgrass | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-014 | Cape of the Vanquisher | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-015 | Essence of the Tempest | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-016 | Wind's Grace Earrings | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-017 | Hindering Darkness | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-018 | Piercing Arrow of Purity | 正式（已 promote） | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-019 | Bad Omen | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST8-020 | Dark Enchantress Laboratory | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-001 | Gold Citrine Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-002 | Aquamarine Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-003 | Blue Whale Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-004 | Pond Dino Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-005 | Mystic Opal Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-006 | Sea Fairy Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-007 | Peppermint Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-008 | Crimson Coral Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-009 | Wave Drop | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-010 | Parfait Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-011 | Frilled Jellyfish Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-012 | White Pearl Cookie | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-013 | Shimmering Moonlit Coral | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-014 | Glittering Pearl Shell | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-015 | Essence of the Ocean | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-016 | Bubble Wave Shell | 正式（已 promote） | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-017 | Revelation of the Seas | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-018 | Tower of Frozen Waves | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-019 | Curse of the Seas | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |
| ST9-020 | Tearcrown | 候選 inventory | 已目視原圖（來源盤點） | 本輪未驗收 |




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
