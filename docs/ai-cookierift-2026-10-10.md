# Cookierift 構築與 AI 決策改善

## 2026-10-18 HP支付後的補HP目標修正（91c42ea，驗收完成）

本輪已閉合既定驗收：目前35副AI牌組為28副Cookierift社群構築加7副BS12參照，涵蓋紅8、黃5、綠4、藍5、紫4、黑5、混色4。新來源的完整Vitest、build、產品來源ESLint、標準AI Browser、四個雙尺寸HP機制案例與5,040場matched回歸均通過；歷史970的六色雙尺寸12個完整UI鍵仍保留來源及driver差異標籤，不改稱91已重跑12場。這些結果支持固定AI對照及有限ST1腳本條件下的競爭表現，不能推論真人／專家強度或每副牌均改善。

970矩陣的兩筆錯誤已用原凍結970／b81各自精確重現：seed211203400、Cookierift #1239黃對#1295紅、P2先攻，27個成功action後，唯一1HP的Pavlova被同時選為HP代價與補HP目標。真實付款使來源離開戰鬥區，原目標因而非法。救援／補位與額外目標限制兩個替代假設已由同一步觀察排除；原RED與完整失敗fixture保留。

`pending-handler.ts`現僅針對可選、純HP代價、正整數self gain-hp且無額外條件的攻擊後效果，先遮蔽隱藏資訊，再呼叫既有`payHpToTrashCost`投影公開付款結果，從付款後的存活餅乾選目標；沒有候選則略過。正式命令仍對原始狀態付款，不合併未知HP卡的costRecord，也不改卡文或權威付款規則。其他代價／效果維持原路徑；GPT-6.1 Sol唯讀審查未確認P1／P2。

永久回歸`optional-hp-cost-heal-target.test.ts`的24案全部通過（`vitest-hp-cost-target-green-20261018-r1.json`，exit0，9.34秒，RAM39.6～42.1%）：雙座位與Lv.1～5的唯一1HP來源略過、來源有2HP時可自補、犧牲另一張1HP餅乾後治療存活者、同PlayerView隱藏牌置換，以及原始失敗seed的正式命令與不可變性。由於此前RAM超標，永久檔未在修補前執行RED；真正失敗基線來自兩份原凍結政策的精確重播，不宣稱觀察到24案RED。準備式原卡機制測試不當作Browser或完整對局驗收。

新凍結候選`candidate-engine-hp-cost-target-20261018-r1.mjs` SHA `91c42ea9ec6b49ff71f74800898a9e300dbc7f03c420e07625ab826bb2967a22`。對照`baseline-policy-current-rules-measured-b81-common-hp-cost-target-20261018-r1.mjs` SHA `0b83382cadbab17928fe4233d9f667e1c2eee933a031e9ee2300d8c8a318ae8e`，明列`COMMON-LEGALITY-ADAPTATION`。兩邊使用完全相同的新pending-handler compiled模組；逆替該模組可逐byte還原整個970與b81，skills／masked-state依賴與binding也相同，347 inputs／50 policy／297非policy雜湊仍為`ecb78e7a…e91d07`。準備helper已由Sol靜態審查、根代理全文核對後實跑exit0。這不是原b81 bytes，不繼承舊矩陣／UI／全套驗收，新比較差值也不能歸因於兩邊共有的HP修正。

資源恢復後，最終v2護欄tiny self-test在host確認自有child、grandchild與taskkill helper全數退出（`memory-guard-self-test-20261018-v2-r2.log`，exit0，41.8%）；保留parent至tree-stop成功、有限重試與失敗收尾，不再把直接child kill稱為整樹停止。啟動低於48%、52%提前停止，使用者60%上限不變。隨後三檔隔離r2的Lv.4全部8項已通過，其中20 seed對Lv.3耗時2.42秒；該次512MB worker在DeckEditorPage發生heap OOM，整批exit1、RAM41.5～44.9%，不列整批PASS。僅該檔改用1GB heap、原timeout與斷言重跑，24項全通過（`vitest-deck-editor-isolation-20261018-r1.json`，exit0，20.02秒，39.8～44.0%）。此隔離結果不取代新版完整門檻；其後完整PASS見下。

首個HP build因新測試fixture將optional `pendingAbilityEffect`寫成null而exit2，47.3%峰值；改為型別要求的undefined，未改斷言。修後共用pending／HP支付／可選效果／隱藏牌回歸8檔90項全通過（含上述24案，非相加；`vitest-hp-cost-target-regression-20261018-r1.json`，exit0，15.14秒，40.3～42.8%）。新正式build `build-hp-cost-target-20261018-r2.log` exit0、40.7～46.8%，產物`game-demo-_1mlCz8d.js`。中間一次啟動回歸被自動審核拒絕，因其仍將先前3GB build視為可能活動；沒有繞過或並行啟動。分開取得build exit2，再於host查兩自有PID均不存在及RAM40.29%後，才循序啟動上述回歸與build。

兩筆精確GREEN重播已完成：`replay-hp-cost-target-green-20261018-r1.json`為`GREEN-TWO-EXACT-ORIGINAL-ROWS-FINISHED`，exit0、RAM40.8～41.5%。每row先與原bundle逐步核對27個完整decision／state與actor memory，再比對原RED完整fixture；第28步新AI與權威skip的完整狀態相同，保留Pavlova 1HP，兩row都在226個action結束、P2勝。兩種政策座位各一局，因此不能稱兩場候選勝利，也不作勝率證據。

舊970的12個UI完成鍵可沿用為未受影響的操作／完成紀錄：實際六色Arena主牌／EXTRA加人方Tactical ST1共138種cardNumber、97個runtime JSON來源均符合舊非policy雜湊；其完整封閉牌表不含任何hpToTrash攻擊Then的六卡（ST6-002、BS10-022、BS10-047、BS5-010、BS5-098、BS6-003）。轉接表只有BS10-047符合新純self gain-hp分支；裝備追加、EXTRA自有卡池、ability／mandatory wrapper旁路也不會進入新guard。這是完整牌表與執行入口可達性核對，不是由對局log沒Pavlova推論。仍保留970來源標籤與原r1／r2 FAIL、兩場停止、有限ST1及r3能力擴充限制，不改稱91c42ea已重跑12場。Pavlova的新分支另以既有正常測試對局表單準備原卡局面補Browser，不改產品入口或凍結來源。

新產品來源ESLint已通過（`lint-hp-cost-target-20261018-r1.log`，exit0，41.2～44.3%，沿用排除output／test-results／.tmp／附件產物範圍）；新build標準AI Browser六旗標全PASS（`ai-browser-hp-cost-target-20261018-r1/ai-browser-validation.json`及wrapper，exit0，41.5～45.2%）。wrapper以自有strict port核對index／所有JS、CSS的HTTP預檢bytes；這不是Browser實載response紀錄，也不涵蓋Pavlova。根代理已目視該單張截圖，畫面仍為開局動畫過渡，不以它主張穩定終局／雙尺寸RWD驗收。

91c42ea新版完整Vitest已全數通過：1,066檔／21,288項、exit0、1,263.82秒，RAM41.5～47.1%（`vitest-hp-cost-target-full-20261018-r1.json/.log`）。包含先前逾時的DeckEditorPage 24項、Lv.4 8項、simulation 508項，以及新增HP永久回歸24項，均沒有修改原timeout或舊斷言。結束後host確認兩自有PID均退出、RAM40.63%，347個凍結來源雜湊仍一致；這份新來源的全套PASS不改寫970舊FAIL。

Pavlova專用Browser r1在Chromium啟動前退出：driver誤讀ST1-016的`item.cost.energy`，實際凍結runtime為`item.cost={red:2}`。該次0案例、exit1、RAM40.5～41.1%、自有port已釋放，wrapper FAIL證據保留。r2只修正該欄位與產物名稱／driver雜湊，完整bytes逆替可還原r1其餘全部內容；Sol另唯讀閉合。四個預定案例與嚴格驗收不變，沒有改產品來源。既有正常測試對局表單的原生覆盤可能誤標`source=production`，本輪保留原始下載bytes，外層強制`test-state/preparedScenario`，禁止當自然發牌、完整對局或production訓練資料。

Pavlova專用r2四案已全PASS（`hp-cost-target-browser-20261018-r2-1792296399145-c3ca44df-0f69-4599-ae71-fcc1d2a32c0d/report.json`，wrapper exit0、RAM40.2～44.7%、自有port已釋放）。桌機1920×1080與平板1164×777各驗兩案：負向由人方GingerBright真NN／1將印刷2HP的Pavlova降至1HP，再由實際Lv.5 AI支付YY普通2後略過HP代價，保留末張HP；正向由印刷2HP直接發動實際YY／2，再付原最後一張HP並以原牌庫頂補回，完整核對`[H0,H1]→[H0,D0]`、棄牌追加H1及牌庫slice(1)。每案雙方60張、60個唯一ID、15種各四張、牌庫40，均為原始印刷／轉接卡；兩張真RR道具置頂僅隔離兩張抽牌後的其他行動，沒有抑制抽牌或替AI選動作。Item本可一般放支援，四案AI實際略過可選放置，不能稱Item不合法；即使放1張R也仍不足RR。

四案各14個實載product response雜湊與本機一致，含新game chunk，pageErrors全空；負向各14個、正向各11個正式命令均以凍結91引擎獨立完整重播，最終全狀態相同，native `replay.exact=true`。正向實付HP ID `player-two-BS1-020-1201`進棄牌、`player-two-BS1-019-102`由原牌庫頂補入、保留`player-two-BS1-020-1200`；負向保留原HP。Sol另唯讀核對native原件／雜湊與實際agent Lv.5，根代理已目視四張結果、雙尺寸初始HP與真付款共八張圖，未見妨礙該局部操作的溢出。這是四個準備式機制案例、0個完整勝負對局，仍有原生`source=production`誤標的外層隔離，不作online或真人強度證據。

新矩陣與獨立auditor已全PASS：`matched-comparison-hp-cost-target-20261018-r1-seed211000000.json`為5,040／5,040、零錯誤／未完成／動作上限，exit0、兩worker、RAM39.7～43.6%；候選2,540勝、對照2,500勝（50.40%）。630組配對、每組兩seed與四次政策座位／先手交換，1,260初始預檢及5,040逐局parity均已核對。2,520組政策座位鏡像為候選有利34、對照有利14、中立2,472。每副牌在每種政策下各144場，逐色結果如下：

| 色組 | 每政策場數 | 候選勝 | 對照勝 | 勝場差 |
|---|---:|---:|---:|---:|
| 紅 | 1,152 | 671 | 666 | +5 |
| 黃 | 720 | 386 | 374 | +12 |
| 綠 | 576 | 167 | 163 | +4 |
| 藍 | 720 | 331 | 324 | +7 |
| 紫 | 576 | 285 | 280 | +5 |
| 黑 | 720 | 517 | 515 | +2 |
| 混色 | 576 | 183 | 178 | +5 |
| 合計 | 5,040 | 2,540 | 2,500 | +40 |

35副中20副候選勝場較多、12副相同、3副較少：#1164藍55／56、#897混色33／34、#1291黃56／57，三者均各少一勝。交換政策也改變對手，不能將逐副或逐色差值單獨歸因該牌組自身決策，也不把這些相依對局稱為統計顯著或真人勝率。

`hp-cost-target-comparison-audit-20261018-r1.json`另以256MB heap單獨實跑exit0、RAM40.4～40.7%，逐筆重算5040唯一排程、勝場、七個色組、35副與鏡像，核對14份牌表快照、347個目前來源、297個非政策來源、校準／matrix bytes及整份逆替還原；報告SHA `350644d9b938529115305b8ae95338e802bad2568065bbe6304f2ebb3bf15cf3`，audit SHA `701fee8cefab378ac8475eda847563b466a496d2ebc02c4eee6436dd576b1a45`。auditor未另做source rebuild，來源雜湊／校準相同及compiled逆替證據分開列示，不稱獨立source-to-bundle重建證明。執行期間沒有更動產品來源，新增永久回歸檔SHA仍為`47cfd3af…76c69`，因此沿用先前新來源全套／build／lint／Browser證據；收尾僅同步文件。

seed211000000 cohort已用於診斷共用卡死問題，這是修復後matched回歸比較，不能稱未看過的獨立holdout。兩政策共有HP合法性修補，新差值反映其餘攻擊Then順序／Refresh政策，不用來歸因共有修補的勝率效果。舊970矩陣與舊全套FAIL、Browser harness停止及先前99.3% RAM事故原件均保留。修後所有heavy命令循序執行，沒有提高原測試timeout；本次最終通過的驗證觀測最高RAM47.1%，52%提前停止與使用者60%上限維持。這是提交前完整工作樹的驗收紀錄；AI拆分提交的證據範圍見下。

### AI拆分提交的隔離快照檢查

使用者明確要求COMMIT後，本次只暫存61個AI／Cookierift與必要共用引擎／UI修補檔案。`battle.ts`只納入離場佇列、無可用choose-one與EXTRA detached FLIP三組修補（34新增行）；契約ledger只納入BS4複合Then修補。獨立ST9-006／009裁定、AGENTS歷史、候選資料及所有執行產物均保留，未納入本次提交。

上文91c42ea的完整Vitest與5,040場結果來自含ST9未提交裁定的完整工作樹，不能直接稱為本次拆分提交樹的逐byte驗收。以UTF-8文字並將CRLF正規化為LF比較347個bundle來源，50個AI政策來源無差異；只有`official-effect-adapter.ts`、`battle.ts`、`demo.ts`、`st9-007-009-demo.ts`四個非政策來源因排除獨立ST9工作而不同。此比較不冒充raw-byte相等或新的勝率實測。

從暫存樹`23c095a8e5b9bb2d0b7ccc35a14bd5ee8c0c6c17`匯出隔離快照（文件收尾前版本），使用既有node_modules、原timeout與斷言、單worker及52% RAM停止護欄循序執行：build exit0、RAM41.0～47.0%；AI／牌組／共用引擎／hook／契約及原ST9邊界回歸103檔／1,609項全部PASS，exit0、308.01秒、RAM40.8～44.0%；產品來源ESLint保留max-warnings=0與既有產物排除，exit0、RAM41.3～46.5%。證據位於`output/ai-cookierift/commit-ai-20261018-r1/`的`build.log`、`regression.json/.log`、`lint.log`及`source-scope-comparison.json`。

隔離快照未另跑全套Vitest、5,040場矩陣或Browser；這些既有結果仍限於上文原工作樹來源。此後只同步README與本文，提交前再以暫存樹差異確認產品程式及測試與隔離快照相同。

## 2026-10-18 攻擊 Then 順序與 Refresh 生存優先（970歷史FAIL與UI完成紀錄）

本輪只改三個AI政策模組。Refresh在規則層合法候選中，先保留公開Break加卡面LV仍低於10的選項，再沿用原本的保留價值排序；全部必敗仍完成合法選擇。攻擊分配只新增單段、固定正傷害、原攻擊對象的Then，條件限定無條件或公開戰鬥區關鍵字；先付能量、REST及計入普通傷害，再透過共用條件／目標／效果傷害函式計算。同步投影的publicHp，尊重效果免疫與交戰等級封鎖，原目標普通KO後不改選其他目標；其他Then、FLIP、陷阱及昏厥回應不模擬。

Lv.3～5都接入此分配。內部路線先保留條件式Break上限機會；普通分配扣分仍最多240，錯失上限路線最多600，以免被Lv.4／5原有350以上的單次KO加分蓋過。它仍是相對評分，不把未知回應的路線標記為實際終局勝利。深度3、內部非memo節點256，Lv.4／5另受既有deadline；截斷即捨棄整份預測。GPT-6.1 Sol對這三處唯讀審查未發現可確認P1／P2，但不代替效能或實戰驗收。

原始60張牌表的三等級攻擊順序及雙座位Refresh反例，從3＋6項RED轉為PASS；獨立probe使用同一校準bundle亦通過，沒有把準備局面稱為UI敗局重播。修正的BS3-019 hook測試以原卡RRR付款→2傷害→Equip完整父流程取代舊不在區域的Equip-only來源；維持只列指定宿主與缺宿主為空兩項斷言。相關18檔／253項通過（`vitest-order-refresh-regression-20261018-r1.json`、exit0、47.94秒、記憶體42.0～51.6%），另31項分配測試已通過（非加總）。新機制測試的防效果傷害duration欄位曾導致兩次TypeScript build失敗，已按既有型別補為`until-source-next-turn`；`build-order-refresh-20261018-r3.log`最後正式build exit0、記憶體42.3～53.4%，產物`game-demo-mxpVjQ5o.js`。產品來源lint沿用排除生成產物的命令通過（43.6～51.7%）；最後duration型別補正的該檔再跑ESLint exit0。完整Vitest已啟動，兩次build失敗log保留。

新校準來源 `candidate-engine-order-refresh-20261018-r1.mjs` SHA `97045424560f892a2009ca0ac5537a8d6d052aec3ea3808376fc364b6bcd8571`，347個inputs。對照版為上一批實測b81候選的完整bytes拷貝（`baseline-policy-current-rules-measured-b81-before-order-refresh-20261018-r1.mjs`及manifest），297個非政策來源仍為`ecb78e7a…e91d07`。manifest明列單一凍結compiled policy，不冒充目前政策source可重建歷史bundle；Sol另核對與現有benchmark相容。seed `211000000`、35副／5,040場、四worker矩陣最後FAIL：5,038場完成、2場decision-error、0動作上限，exit1、記憶體42.4～53.4%；matrix bundle與校準bytes相同。兩筆皆為Cookierift #1239黃／#1295紅、seed211203400、P2先攻，兩種政策座位交換均成功27個action後`Invalid battle action.`。原凍結bundle精確重播也各在T4、P1黃方、Pavlova攻擊效果之後的可選攻擊代價失敗；診斷進行中，不把未完成矩陣勝場／比例作正式驗收。原比較auditor按`status=PASS`強制門檻exit1，log保留，不稱來源核對PASS；舊2,544勝不併入新結果。

標準AI Browser六旗標已全數PASS（`ai-browser-order-refresh-20261018-r1/ai-browser-validation.json`、exit0、記憶體46.3～50.0%），不把六旗標當作六場完整對局。

正式UI原先固定六色各桌機1920×1080／平板1164×777一場，共12場，見`order-refresh-ui-plan-20261018-r1.json`。r1 driver僅放寬六色白名單、加入預定尺寸及改runTag，逆替換驗證其餘玩家政策／互動／建置核對bytes與前版完全相同；SHA `1a370c6c96684d88b43e8578312908918a3226207e44a9c82b81713838822831`。原批在第4場停止，不能宣稱12場cohort PASS：前三場紅色桌機玩家T13勝、紅色平板AI T15勝、黑色桌機AI T15勝，皆accepted、pageErrors為空、實載build核對PASS，根代理已目視三張終局圖。三筆證據分別為`test-results/post-order-refresh-r1-active-tactical-st1-vs-lv5-bs12-red-arena-20261018-1792286143686-19904/`、`...-1792286286935-6696/`及`...bs12-black-arena-20261018-1792286422652-23476/`。

第4場黑色平板T6出現真正的「對手棄置的卡牌」公開確認（Draining Magic Circle），driver沒有該分支而SAFE_STOP、無勝負、pageErrors為空；`...bs12-black-arena-20261018-1792286590887-14124/`完整保留，根代理已目視停止畫面。r1 wrapper exit1、記憶體46.5～52.7%，原`order-refresh-ui-audit-20261018-r1.json`也明確FAIL（只有4個起跑目錄），不把未完成對局計為AI勝或敗。產品未改，source仍970／同一dist。依實際`InformationModals`／`GameModals`加入兩種嚴格標題及按鈕的AI公開資訊ack，其他未知面板仍停止；ack不改選牌／支付／目標策略，callback會繼續已決定的AI動作，不冒稱只關畫面。

補測計畫`order-refresh-ui-plan-20261018-r2.json`固定9場，r2 driver SHA `b6d7ba5258dff8d37a3db81121763e9c666ba35b255fc6462bbe44dc62ba4dcd`，只增加公開資訊ack、相應穩定重查selector及runTag，inverse可還原r1其他全部bytes。實際只完成黑色平板AI T13勝、綠色桌機玩家T16勝、綠色平板玩家T17勝；根代理已讀報告及目視終局圖。第4場藍色桌機T12在DJ Miya牌庫底展示「條件未匹配／Cherry Cola Cookie／等待對手確認…」及後方人方強制棄1手牌時停止，沒有勝負或pageError，根代理已目視停止畫面。四份報告全數保留；r2 wrapper exit1、記憶體46.3～52.4%，`order-refresh-ui-continuation-audit-20261018-r2.json` FAIL（4個目錄不等於預定9），不能使用原13次起跑假定。

來源確認這是`RevealTopDeckModal`，不是AI公開卡牌ack；只有牌庫擁有者可確認，disabled「等待對手確認…」不能由人方代點。r3透過原有「縮小卡牌展示」控制收起精確的對手牌庫底展示，並新增人方exact強制棄牌能力：僅接受「必須選擇N張手牌棄置」，從可見己方ST1手牌沿原`handValue`由低至高選齊，再確認modal消失、動畫結束及手牌恰少N張。這是明列於policy／plan的玩家策略能力擴充，不稱中性ack，也不宣稱三版玩家政策全部相同；其餘bytes inverse還原r2。Sol唯讀審查未發現需先修正的可確認問題，實際分支涵蓋仍按新run計數。

`order-refresh-ui-plan-20261018-r3.json`固定剩6個新context：前次未完成的藍色桌機及5個未起跑鍵，前6個完成鍵不重跑、不選seed，兩個停止attempt保留無勝負。r3 driver SHA `9394000df0561b81d848653469fa6e9f201822b199327a100114db353a24cfce`，同970產品／同dist已起跑；若剩6場皆完成，只能報14次起跑、12個完整鍵、2場harness停止，原r1與r2 cohort均保持FAIL。有限ST1腳本不等於真人／專家強度。

970來源UI續測已結束，r3 wrapper exit0、記憶體44.0～55.0%；根代理已目視12張終局圖、兩張停止圖，以及牌庫展示／兩次強制棄牌／公開棄牌截圖。`order-refresh-ui-continuation-audit-20261018-r3.json` PASS（exit0，該次唯讀核對記憶體55.6%），核對14次起跑、12個完成鍵、兩個保留停止、三版driver差異與產品實載雜湊。完成鍵實際AI 8勝／玩家4勝：紅1／1、黑2／0、綠0／2、藍1／1、黃2／0、紫2／0。此為有限ST1腳本的觀測，且含已揭露的r3強制棄牌能力擴充，不能稱同版driver的均質勝率、每副牌都強或真人／專家強度。實際涵蓋牌庫展示縮小1次、強制棄牌2次共4張、公開棄牌確認1次；AI單卡公開確認0次，明列未涵蓋。兩個原cohort仍FAIL，停止局不計勝敗。

完整Vitest最後為1,065檔／21,264項，1,062檔及21,261項通過、3檔各1項超過原5000ms，exit1、2,482.82秒、記憶體44.3～55.1%。三項分別為DeckEditorPage正式EXTRA流程、Lv.4對Lv.3二十seed、AI simulation二十seed；沒有失敗斷言，但不能據此稱環境問題已排除或全套PASS。新增Pavlova永久回歸檔不在該次收集清單。

三檔隔離重跑`vitest-order-refresh-timeout-isolation-20261018-r1`發生資源事故：56.1%觸發護欄時，Windows以`The user name or password is incorrect.`拒絕taskkill，記憶體監測峰值升至99.3%，超出使用者60%限制；進程最後自行exit1，這次不列有效驗證。其JSON為537／540通過、Lv.4三項失敗，不能用前兩檔通過取代全套門檻。當時停止新增heavy工作；提升權限唯讀查核未找到本輪Vitest／guard殘留Node程序，整機記憶體仍高於60%，未終止其他工作。後續資源恢復、護欄修正與新HP候選驗證見上節；這份970完整矩陣仍保持FAIL，沒有新的970全套exit0。

## 2026-10-18 Equip 來源跨 Refresh 的候選修正（上一批來源）

兩筆 `209161600` 失敗已用原凍結 `b3bbf7c8…`／`e828a55a…` 政策精確重現：P1 在 T24 使用 BS8-072，inspection 要展示兩張但牌庫只剩一張，因此先 Refresh；來源道具已由棄牌區洗回牌庫，後續 Equip 卻仍提供己方 Mystic Flour 目標。兩政策座位交換均在 220 個 action 後報同樣錯誤。來源身分只從出牌當下的己方手牌與公開區域追蹤，沒有搜尋隱藏牌庫／HP 或對手手牌；`replay-973-equip-error-20261018-r2.json` 保存原始來源邊界與 stack。這是來源消失，不是 self-target 或玩家歸屬錯配。

共用 `getEffectTargetCandidatesForEffect` 現在依既有 executor 檢查來源玩家的指定 battle／trash 區域，排除來源自身與其他玩家的宿主；來源失去時回傳空候選，沿用既有可選 Equip 略過流程。未放寬直接執行時的拒絕條件，也未改卡文／裝備生命週期。新增原始 #973 卡牌 inventory 的縮小回歸先取得精準 red：8 項皆失敗，Lv.1～5 均回傳 `error`；修補後連同既有 BS8-021、BS8 optional counts、BS12 R007 與 BS3 Then 為 5 檔／93 項通過，exit 0、記憶體 42.0～44.7%。報告：`vitest-equip-source-red-20261018-r2.json`、`vitest-equip-source-green-20261018-r1.json`。正常 BS8-072 inspection→Equip 父流程由同批既有 `bs8-optional-counts.test.ts` 正例覆蓋。

新正式 build 通過（`build-equip-source-20261018-r2.log`、exit 0、記憶體 42.0～48.0%，`game-demo-B8ueS_7x.js`）；首個 build wrapper 使用錯誤的 npm CLI 路徑，屬環境命令失敗，已保留 r1 log 並改用目前 `npm.cmd` 所在目錄。排除生成產物的產品來源 lint 通過（保留 `--max-warnings=0`，排除 `output/**`、`test-results/**`、`.tmp*/**`、`.codex-remote-attachments/**`；exit 0、記憶體 46.3～51.4%）。標準 AI Browser 六個開局／HP／暫停旗標全部通過（`ai-browser-equip-source-20261018-r2/ai-browser-validation.json`，exit 0、記憶體 43.8～51.3%）；首跑的沙箱 loopback `EACCES` 環境失敗另存 r1 log，之後以沙箱外本機驗證完成。六旗標不當作六場完整對局。

`replay-973-equip-fixed-20261018-r1.json` 已證實兩筆原種子皆完整結束、各 264 steps，兩場 winner 都是 P2；前 220 steps 的 payload 與各自凍結版本完全相同，第一個差異正是原錯誤位置，修補後以空目標合法續接。Refresh 前來源在 trash 且有兩個合法 host，Refresh 後 trash=false、合法 host 清單為空。兩筆只作診斷，不併入勝場；guard 記憶體 43.1～44.3%、exit 0。

新參考版 `baseline-policy-current-rules-measured-before-healer-equip-source-20261018-r1.mjs`（SHA `e5b90ce2ec750020bda2ed6be300b5a9e1f5bc9bde14443ffa432c6ba5cab75c`）將唯一 Equip shared 分支從新候選直接複製，反替換後完整 bytes 還原 `e828…`，政策其餘 bytes 不變；這是 compiled measured policy 的規則適配，不冒充從歷史 source 重建或繼承原 PASS。297 個非政策來源只變更 `effects/targeting.ts`，新 aggregate `ecb78e7a6b393178dd466a72943b216e68e337d0e8bc2b8a6064865011e91d07`；參考版與候選的整個 compiled targeting 函式 bytes 相同。正式矩陣新候選與 calibration 完整 bytes 同為 `b81cfd414b27f25d53ff8af5cda2c8a86f02dff8a944c8763f192b0ee6c78a7c`。

seed `210000000` 的四 worker 矩陣已完整結束：5,040／5,040、零引擎錯誤／未完成／動作上限，exit 0、全機記憶體 43.0～51.6%。候選 2,544 勝、參考 2,496 勝（50.48%）；2,520 組政策座位鏡像為候選有利62、參考有利38、中立2,420。35副牌各由兩政策控制144場；630組、兩seed、四交換、14來源快照、1,260初始預檢與5,040狀態parity均由 `equip-source-comparison-audit-20261018-r2.json` 核對 PASS，包含 calibration完整bytes一致與當時source重建一致。這是固定AI對照，並非真人勝率、統計顯著性或單獨Healer修補的因果效果。兩 worker 起跑至96場後中止的r1保留、零場併入；正式產物為 `matched-comparison-equip-source-20261018-r2-seed210000000.json`。

同來源完整Vitest已結束，`vitest-equip-source-full-20261018-r1.json` 為exit 1：1,063檔中1檔失敗、21,220項中1項失敗，耗時1,936.65秒、記憶體41.7～51.7%。唯一失敗是 `usePendingEffect.test.tsx` 的舊Equip fixture：來源道具不在任何區域，且將真卡damage→Equip改成Equip-only；正式本機／線上流程於Equip前已付款，故不移除shared來源檢查。測試已改為原始BS3-019完整付款與傷害父流程，指定宿主正反例與同檔45項於下一來源的針對性回歸通過；不反改舊FAIL報告。後建的攻擊順序／Refresh測試不在這份全套收集範圍，不能宣稱已通過。

本來源三色正式 UI 均已完成，每色一次、無重試或挑選開局；新 driver 與前一版僅 runTag 不同（SHA `e897f59c5f206faa14f1893860365ce322f3eaed9143b7ed29689d3818425ea4`）。人方設定原始 60 張 ST1 牌組後，透過正常選單、開局、付款、攻擊、FLIP、抽牌與補位控制完成，未注入 GameState、test-state 或搜尋時鐘。結果如下：

| AI 牌組／尺寸 | 勝方／回合 | 人方支援／登場／攻擊／補位 | 人方 FLIP／手牌代價／抽牌 | 證據目錄（test-results/） |
|---|---|---|---|---|
| 紅色／1920×1080 | 玩家／16 | 8／1／12／6 | 7／5／2 | `post-equip-source-r1-active-tactical-st1-vs-lv5-bs12-red-arena-20261018-1792283838799-13488/` |
| 黑色／1164×777 | AI／12 | 6／1／9／3 | 4／2／2 | `post-equip-source-r1-active-tactical-st1-vs-lv5-bs12-black-arena-20261018-1792284022320-16844/` |
| 綠色／1164×777 | 玩家／16 | 8／1／12／4 | 6／5／1 | `post-equip-source-r1-active-tactical-st1-vs-lv5-bs12-green-arena-20261018-1792284148347-7768/` |

合計 22 次支援、3 次登場、33 次攻擊、13 次補位、17 次 FLIP、12 次手牌代價與5次抽牌。三場皆 finished／activeHumanMatchAccepted=true、pageErrors=[]；主代理目視終局圖，獨立 `post-equip-ui-audit-20261018-r1.json` 重核原卡牌表、driver、23 個產品檔案與每場12個實際 GET body hash，全部一致。這份 UI 完成核對為 PASS，不代表 AI 三場皆勝；本批實際為 AI 一勝兩敗，不足以單獨宣稱競爭力終點。兩筆敗局保留，未宣稱從紅色公開紀錄已證實漏必勝，也未把綠色終局誤認為Refresh選錯：當時Break9已無任何LV≥1的存活選項。

後續以獨立原始60張牌表重現兩類決策錯誤，並非上述UI敗局重播。第一類為P-175在另一張Arena已REST時才追加1，先Red Osmanthus再Caramel可在無FLIP的正式父流程造成6傷害、達Break10，反向僅5；原Lv.3～5三項均RED。第二類為Break8時有LV1可停在9，原Lv.3～5雙座位卻選LV2立即敗北，六項RED；只以公開Break與卡面LV優先生存後，原排序／全數必敗等16項已PASS（`vitest-refresh-survival-green-20261018-r1.json`、exit0、41.9～43.9%）。攻擊Then預測及Lv.3～5接線仍在針對性驗證；新策略尚未完成新來源全套、矩陣與正式UI，不沿用本節b81結果冒充驗收。

UI wrapper exit 0、全機記憶體 45.4～51.7%，audit exit 0、46.8%；完整 Vitest 與四 worker 矩陣併行，因此不是效能量測。對局沿用真實預設 180ms 搜尋時鐘。index hash 僅核對本機 dist bytes，沒有宣稱對局當時 index HTTP body attestation；JS／CSS 則有當時 GET body。三場為有限 ST1 戰術腳本挑戰，不是真人／專家勝率；舊來源 UI 成績不與此批合併。Browser 與17847自有 preview 已關閉。

## 2026-10-18 Healer 支援重返與 Once 保留（修補前來源）

本節修補前配對矩陣 `matched-comparison-20261017T230106394Z-21704-470e87fb.json` 為 FAIL：5,038／5,040 場結束、2 場 decision-error、零動作上限，exit 1、記憶體 40.1～46.5%。兩筆皆為 Cookierift #973 自身對局、seed `209161600`、P2 先攻，在兩種政策座位交換下各成功 220 個 action 後出現 `Invalid Equip source or self target.`。候選 bundle `b3bbf7c84e9d8436933e2e5aa41abd8adffab482cfa79608bf09836d6238ee20` 與實測舊候選參考版 `e828a55a…` 保留不改；P1 來源跨 Refresh 消失的定位與修補後重播見上節。未完成矩陣的 2,553／2,485 勝與 50.67% 不作正式驗收勝率，也不併入先前矩陣；下文單元／build／UI 僅為此修補前來源的分層證據。

以 60 張原始綠色卡牌、每卡四張建立準備式反例，並先用兩次真實普通攻擊使 Shining Glitter 與 Green Tea Mousse REST：舊決策先空用 Shining Glitter 的免費 Activate Once，修正選零後仍提前結束回合，錯過 Healer → 合法略過補位 → 支援重返 → 合法略過 On Play → 同張餅乾再攻擊的路線。這是依影片啟發建立的獨立規則回歸，沒有稱為影片指令重播或完整自然對局。

本批 AI 只排除免費、非 REST、無 Then 的單一支援登場能力且實際選零的候選；玩家合法選零仍保留。新增有限公開推演，從動作前的遮罩狀態重播實際道具命令，逐步經正式指令處理己方略過與 Stadium 的可選抽零，再確認同一 instanceId 以新 battleEntry 活躍登場、且普通攻擊可實際支付。未知 HP 被棄置後仍以背面推演，不讀新揭露牌面；父道具與再登場成本納入場面變化，攻擊付款沿用原評分、潛力折扣至 75% 並封頂 250。只取最高一條路線並扣除已計入的正向連動估值，不結算隱藏 FLIP／陷阱，也不把它當成保證勝利。

這項資訊限制指新增的 reentry 推演；沒有把整套既有 root 評分宣稱為棄牌張數限定。額外唯讀查核確認目前 PlayerView 的攻擊費用不依新棄牌重算、BS12-014／015 的活躍封鎖只依公開戰鬥區見證，Healer 的 battle／support capability 也不連接只有 trash tag 的條件。既有 strict tactical condition helper 能讀公開棄牌屬性；混合條件及其他卡的全核心資訊邊界不屬這次完整驗收。

最終定向 8 檔／56 項通過，exit 0、記憶體 40.4～42.7%，報告為 `output/ai-cookierift/vitest-healer-reentry-focused-20261018-r3.json`。其中 Healer／Once 的兩檔 20 項包含 Lv.3～5 的第一步選擇，以及 Lv.5 使用 Shining Glitter／Stadium、由 AI 逐步執行至 Break 10 勝利的兩條完整續接；另有 Once 已用、付款後能量不足、優先現有致勝攻擊、準備式已 REST 場景及最後餅乾反例，以及原始隱藏 HP／牌庫換牌後完全相同的命令與評分。兩路線均核對每位玩家完整 60 張實體 inventory、唯一 instanceId 與每卡四張；準備式反例仍與自然對局證據分開。兩個獨立唯讀 review 未發現本批 P1／P2，不能替代動態驗證。

相關 ST6-004 回歸不再依賴現行 AI 的第 172 步：從 `e828a55a…` 實際策略提取 175 筆正式指令，以目前規則重播至原來第 13 回合、P1 主要階段的相同局面，保留「來源已 REST、技能仍可合法付費、全部攻擊機會已用完，故不棄手牌增傷」與後續對局完成期待。正向案例也改用兩副真實 60 張牌組，原 Pitaya Dragon 為 LV.2／4HP／RRR 普通 3，棄一手牌後真正提升至 4 且仍有合法攻擊。fixture／提取器保留來源 SHA、seed、牌表與舊 frame；測試執行不依賴 output bundle。先前固定步數偏移及新準備式案例錯放先攻第一回合的失敗紀錄保留，未修改產品规则來配合測試。

最終 `npm.cmd run build` 等同的受 guard 包覆 npm CLI 建置通過 TypeScript 全範圍與 Vite 2,207 modules，exit 0、記憶體 40.3～46.2%；產品 bundle 為 `game-demo-Bpx5GkLT.js`。`npm.cmd run lint -- --ignore-pattern 'output/**' --ignore-pattern 'test-results/**' --ignore-pattern '.tmp*/**' --ignore-pattern '.codex-remote-attachments/**'` 等同的 npm CLI 檢查通過，exit 0、記憶體最高 44.8%，只排除生成產物目錄，沒有修改 lint 規則或設定；不把它稱為包含所有產物的原始全域 lint。型別檢查第一次在 1,536MB Node heap 耗盡，exit 134、記憶體最高 45.6%；第二次指出四處既有 Windmill 測試原始 payload 的型別錯誤，沿用 `commandFromLogEntry` 與 `kind` 縮窄修正，原 assertions 保留。最終以 3,072MB heap、相同檢查範圍與 56% 系統停止門檻完成，沒有排除測試或修改 TypeScript 設定。

完整 Vitest 1,062 檔／21,212 項全數通過，零失敗／略過，1,420.73 秒、exit 0，記憶體 40.0～44.6%；報告為 `output/ai-cookierift/vitest-healer-reentry-full-20261018-r1.json`，實際命令為受 guard 包覆的 npm CLI `test -- --maxWorkers=1 --reporter=dot --reporter=json --outputFile=output/ai-cookierift/vitest-healer-reentry-full-20261018-r1.json`。標準 AI Browser 六個開局／HP／暫停旗標全部通過，exit 0、記憶體 40.0～44.6%，產物為 `output/ai-cookierift/ai-browser-healer-20261018-r1/`；旗標不當作六場完整比賽。修補後三色正式 UI 對局如下；新配對矩陣的 Equip 失敗正在定位，詳見本節開頭。新對照使用先前成功矩陣的實際候選 bundle `e828a55a…`，另存的 `baseline-policy-current-rules-measured-candidate-before-healer-20261018-r1.mjs` 與它 bytes 完全相同。manifest 的 297 個規則／資料來源逐檔雜湊一致（`e353892b…`），政策身分明確為 compiled measured candidate，未重建或冒充 HEAD 策略；舊 49 個政策來源的 aggregate 只作歷史 provenance。此比較包含 `e828…` 之後的其他 AI 修補，不單獨歸因於 Healer。先前對照賽及 UI 結果保留為舊來源證據，尚不宣稱本批已提高整體勝率。

### 修補後三色正式 UI 對抗

沿用原始 ST1 60 張牌表及已核對的可見戰術操作，以新的隔離 Chrome context 各執行一次，沒有注入 GameState、test-state 或搜尋時鐘。人方依印刷 HP／攻擊／費用選開局與登場、保留較好的餅乾、按公開 HP 選擊倒目標，並實付手牌代價使用補 HP FLIP、選擇抽牌；仍略過道具／陷阱及其他未支援的能力，是有限腳本對手。三場依序執行，沒有重試或篩選 seed。

| AI 牌組 | 尺寸 | 終局 | 玩家攻擊 | FLIP | 棄手補 HP／抽牌 | 記憶體 |
|---|---|---|---:|---:|---:|---|
| BS12 紅色 Arena | 1920×1080 | 第 13 回合 AI 勝利 | 8 | 3 | 2／1 | 41.2～45.8% |
| BS12 黑色 Arena | 1164×777 | 第 14 回合 AI 勝利 | 10 | 9 | 7／2 | 41.2～45.5% |
| BS12 綠色 Arena | 1164×777 | 第 12 回合 AI 勝利 | 8 | 3 | 1／2 | 41.9～46.6% |

人方合計 19 次支援、5 次一般登場、26 次攻擊、9 次補位、15 次 FLIP，包含 10 次實付棄手補 HP、5 次抽 1 張。三場 finished／active acceptance 皆為 true，exit 0、頁面錯誤 0、無 SAFE_STOP；主代理逐張核對終局截圖，並重新查核報告。每場捕捉的 12 個 JS／CSS GET body 均與本機同一 23 檔 dist 資源雜湊匹配；實載 `game-demo-Bpx5GkLT.js` SHA-256 為 `6ebbae4aaae958a06e48cbdb83026b79bd64cf18f94f4542da5f5f70b35fd23f`。index hash 只證明本機檔案，沒有捕捉對局當時的 index HTTP body。Driver SHA-256 為 `177a097d1a2cd30ea86c831c67539d752d830f1bce2c86eeccb3a2e0f6253b67`，三場 source／build／操作數核驗報告為 `output/ai-cookierift/post-healer-ui-audit-20261018-r1.json`，原始截圖、公開紀錄與影片保存在 `test-results/post-healer-r1-active-tactical-st1-vs-lv5-*-20261018-*/`。

這三場使用預設真實 180ms 搜尋時鐘，背景有同一 seed-base 209000000、單 worker 矩陣執行，因此不作標準效能測量。記憶體持續以 500ms 抽樣、56% 停止門檻保護 60% 上限，最高 46.6%；本機 preview 已關閉。AI 三勝支持對這個腳本的實際對抗能力，不代表真人／專家勝率、各色全部構築都強，也不能把新綠色勝局與舊敗局的差異歸因於單一修補，兩次自然開局不同。

## 2026-10-18 影片策略拆解與 Lv.3 登場續接

兩支使用者提供的影片（[Green／Blue Arena](https://www.youtube.com/watch?v=V3yLYFafzLg)、[Shadow Blue／Arena Green](https://www.youtube.com/watch?v=29V-Ilj_HUk)）以視覺分析工具觀看；沒有可用字幕，觀察不等同逐步權威指令重播。第一支的啟發是先建立登場、回收與支援資源，再接攻擊；第二支則提示保留防守能量、確認連動條件與低手牌時節制展開。現有 Lv.5 的 defensive reserve、公開回應搜尋與手牌消耗評分已部分涵蓋後三點，尚不能據此宣稱影片完整打法已驗收。

本輪修補 Lv.3 的主要階段登場評分：一般登場與 EXTRA 登場現在沿用既有 `legal-action-followup`，取新增合法後續指令的最高價值一次。它會確認後續攻擊實際可支付，不因目標／付款變體較多而累加。續接估值限制在同一玩家、同一回合的主要階段，遇到待決效果、新公開卡片、牌庫檢視或洗牌等未知結果時停止預測。未新增另一套攻擊機會加分，也未把此 Lv.3 修補當成 Lv.5 勝率改善。

以實體 BS12-056 Apple Faerie、BS12-017 Candy Apple 與原始 NN 支援建立回歸：登場後有能量時會接真正 `declare-attack`；少一份能量不產生攻擊收益；增加對手目標不重複加值。另驗證隱藏牌庫／HP 順序不影響決策，以及 BS9-070 Puppet Theater 揭示不同未知牌面時不預先利用結果。定向 4 檔／23 項通過，最終來源 production build 與 `eslint src scripts vite.config.ts --max-warnings=0` 通過。完整 Vitest 1,059 檔／21,187 項全數通過，零失敗／略過，報告時間 1,422.22 秒、exit 0，記憶體 37.7～44.0%；報告為 `output/ai-cookierift/vitest-ai-video-full-20261018-r1.json`。

標準 `test:ai:browser` exit 0，六個開局／HP／暫停等摘要旗標全為 true，產物保存在 `output/ai-cookierift/ai-browser-video-20261018-r2/`；這些旗標不是六場完整比賽。另以 `test:animations:browser` 跑一場 1164×777、reduced 動畫、BS11 人方牌表的正式 UI 對局，經可見控制在第 14 回合出現「AI 對手勝利」與 BS12 藍色 Arena 牌組資訊，頁面錯誤與阻擋圖片請求皆為 0，exit 0。結果截圖與錄影在 `test-results/animation-1164x777-reduced-*`，兩次 Browser 記憶體最高分別為 40.3%／40.2%。人方操作偏向略過，這場只驗證完整 UI 流程，不能當成真人強度證據。

本輪全域 `npm.cmd run lint` 掃描既有大量產物後中止，不能列為全域 lint 通過；沒有刪除產物或修改 lint 設定。所有重負載工作依序執行，以 500ms 抽樣的 56% 記憶體停止門檻保留使用者 60% 上限緩衝。未提交／推送。

### 35 副牌組 Lv.5 完整對照賽

執行 `node scripts/benchmark-cookierift.mjs --workers 2 --seed-base 206400000 --baseline output/ai-cookierift/baseline-policy-current-rules-goal-20261018-video-aware-baseline-r1.mjs`，由 768MB heap 的記憶體 guard 包覆。35 副牌組涵蓋六色 BS12 Arena、韓版 BS12 starter 與 28 副社群構築；630 組配對、兩個 seed、雙政策座位及雙先手排列，共 5,040／5,040 場正常結束，零錯誤／未完成／動作上限，exit 0，記憶體 37.0～40.0%。1,260 組初始預檢與 5,040 場 initial-state parity 全通過，每副牌在候選與基準政策下各出賽 144 場。牌表使用 403 個不同卡號，包含 BS1～BS12 與 33 個 P 卡號；這是構築涵蓋範圍，並非全部印刷卡的逐卡驗收。

候選政策 2,587 勝、基準政策 2,453 勝，候選占 51.33%。固定「牌組配對＋seed＋先手」再交換政策座位的 2,520 組鏡像中，167 組候選較有利、2,253 組中立、100 組基準較有利；鏡像鍵無缺漏、重複或額外列。這些是配對矩陣的描述性結果，沒有把 5,040 場當作獨立隨機樣本，也沒有據此宣稱統計顯著或真人勝率。各色的分母為該色牌組由同一政策控制時的場次：

| 色組 | 每種政策場次 | 候選勝場 | 基準勝場 | 勝場差 |
|---|---:|---:|---:|---:|
| 藍 | 720 | 346 | 328 | +18 |
| 綠 | 576 | 188 | 170 | +18 |
| 黃 | 720 | 384 | 367 | +17 |
| 紅 | 1,152 | 687 | 642 | +45 |
| 紫 | 576 | 289 | 278 | +11 |
| 黑 | 720 | 510 | 486 | +24 |
| 混色 | 576 | 183 | 182 | +1 |

#1140（候選 25／144、基準 28／144）、#1248（99／144、102／144）及 #1268（54／144、55／144）在候選控制時的勝場較少。政策交換同時改變對手，這些差值不能單獨歸因於該牌組自身決策。綠色與混色的候選原始勝率仍只有 32.64%／31.77%，因此總差值不能證明每副牌都有競爭力；本矩陣為 Lv.5，也不能把結果歸因到本輪 Lv.3 登場續接修補。

比較基準是從 HEAD `45ad207fd98252075f87a5068d6ff71324075bc5` 的來源重建 AI policy，搭配同一現行規則與卡片資料；尚未證明與舊封存 bundle 行為等價，不能混用兩者的強度結果。候選 bundle SHA-256 為 `e828a55a02ea6e3e562b04f1e0e13e893f93335bebdb961315a0479ae04140eb`，基準為 `85049dea7b8aca002f5370c872a2ce4779a9832a4f3a10b92051f8e08e4f8a8b`。候選來源 346 路徑中有 49 個 policy、297 個非 policy；非 policy 路徑及內容雜湊 `e353892b58acb164d93f700ade3cccd1e08afd7b60242c668ff1a790ef3ab733` 與基準一致。完成後重新核對現行來源、兩個 bundle 及 14 份牌表快照均一致，未以後續來源替代已測版本。

完整報告：`output/ai-cookierift/matched-comparison-20261017T172823846Z-6164-2e953969.json`；來源核驗：`output/ai-cookierift/source-audit-video-20261018-r1.json`。先前 5,038／5,040 的未完成 run 保留為失敗證據，不併入本次結果。此階段已取得完整 AI 對照賽與正式 UI 終局證據；對真人的競爭力及弱勢牌組的具體失誤仍待實戰確認。

同來源的第二組 cohort 使用 `--seed-base 207000000`，與本組數字 seed 範圍不重疊，牌組、政策、規則與排列方式相同，候選 bundle SHA-256 仍為上述值。報告 `output/ai-cookierift/matched-comparison-20261017T182917702Z-18604-a3945cfc.json` 為 FAIL：5,038／5,040 場完成，#1268／#283 與 #283／#1248 各有一場 decision-error，零動作上限，exit 1；記憶體 38.1～41.0%。不把未完成的 50.91% 候選勝率併入正式勝場或宣稱改善重現。

兩個失敗 seed `207242601`／`207262801` 均用原始凍結兩個 bundle 完整重播到第 136／168 個成功 action 後的錯誤，error actor 都是 baseline。公開場景快照及診斷 stack 確認同一根因：baseline 用 `canActivateStage` 判斷可啟動，卻取己方場景的費用；權威 resolver 此時選擇對手可共用的 BS9-118 Endless Game of Chess，要求棄 1 張手牌。兩例的己方 Guardian Tree／Tearcrown 都已 REST、無手牌費用，對手 Chess 未 REST、要求棄 1。現行 AI 已沿用同一 `getStageActivationSource` 取得來源與代價，在各失敗局面以 fresh memory 呼叫候選單步，皆產生帶 1 張 `discardHandIds` 的合法 `activate-stage`。這項候選 probe 只確認兩局面的單步付款，未以候選策略取代失敗基準方後跑完續局，不新增勝場，也不改寫原 FAIL。兩份正確快照為 `output/ai-cookierift/replay-holdout-discard-error-207242601-20261018-r4-stage-source.json` 與 `output/ai-cookierift/replay-holdout-discard-error-207262801-20261018-r4-stage-source.json`；早期 r3 錯用 `stageArea` 的 null 快照不作來源證據。診斷 stack bundle 只改錯誤訊息輸出，未用於正式 benchmark。

### 修正場景來源後的參考政策比較

另存付款來源修正版參考 bundle `output/ai-cookierift/baseline-policy-current-rules-goal-20261018-shared-stage-adapted-r1.mjs`，SHA-256 `38e58d1e16631378137176aaf347a6acdb094967aa4a8741d025ed51c68170c9`；它只把上述單一 root Activate 區塊由取己方場景改為解構 `getStageActivationSource`，反向替換可逐位元還原原 bundle，297 個非 policy 輸入未變。Manifest 明確記錄新 policyRef、原基準 hash、原來源 hash 與 post-bundle adaptation script input，不能當成原未修改 HEAD policy 或舊封存版。兩個已知錯誤 seed 先依原凍結政策重播，再保留對局 memory、只替換基準 actor 的後續政策；均實棄 1 張手牌並完整結束，228／266 actions，exit 0，記憶體 39.7～40.1%。這是診斷續局，不算勝場。報告為 `output/ai-cookierift/shared-stage-reference-diagnostic-20261018-r1.json`。

新 seed base `208000000` 的完整 35 副／630 組／5,040 場比較已 PASS：5,040／5,040 正常結束，零錯誤、未完成及動作上限，exit 0，記憶體 39.5～43.1%。候選 2,586 勝、修正來源參考版 2,454 勝，候選占 51.31%。候選 bundle 仍為同一 `e828a55a…`，未據已知失敗 seed 調整策略；新 numeric seed 範圍與前兩批不重疊。1,260 組初始預檢、5,040 筆 initial-state parity 及唯一結果鍵全通過，每副牌在兩政策下各出賽 144 場。2,520 組政策座位鏡像為候選較有利 144、參考較有利 78、中立 2,298，沒有缺漏、重複或額外列。

| 色組 | 每種政策場次 | 候選勝場 | 修正來源參考勝場 | 勝場差 |
|---|---:|---:|---:|---:|
| 藍 | 720 | 330 | 301 | +29 |
| 綠 | 576 | 178 | 164 | +14 |
| 黃 | 720 | 406 | 384 | +22 |
| 紅 | 1,152 | 695 | 657 | +38 |
| 紫 | 576 | 267 | 265 | +2 |
| 黑 | 720 | 527 | 515 | +12 |
| 混色 | 576 | 183 | 168 | +15 |

14 份牌表快照、牌組完整內容雜湊、候選 346 路徑／49 policy／297 非 policy 的來源 manifest 均與第一批一致，完成後也重新核對實際 bundle、當前非 policy 來源及 adaptation script 的內容。報告為 `output/ai-cookierift/matched-comparison-20261017T200339750Z-5720-1f93096c.json`，獨立核對為 `output/ai-cookierift/adapted-comparison-audit-20261018-r1.json`（exit 0／PASS）。

六色與混色均有較多候選勝場，紫色只多 2 勝；綠色與混色原始候選勝率為 30.90%／31.77%，仍不能證明每副牌都有競爭力。八副牌在候選控制時勝場較少，其中 #1151 為 61／144 對參考 65／144；政策交換也改變對手，這些差值不能單獨當成各牌組自身決策回歸。這批同時換 seed 與參考政策，不能用 51.33% 與 51.31% 的差值推定來源適配的因果效果，也不與原參考／失敗矩陣／已知種子診斷續局合併勝率。結果是固定 AI 對局的描述性競爭力證據，未作顯著性檢定或量測真人勝率。

選中的場景與 `ability` 也會傳入後續目標 context 及效果模擬，因此該適配是 root 場景來源的一致性修正，連帶使用正確來源的費用與效果列表；不是只改費用數值。策略權重、搜尋限制及其餘 bundle 程式碼維持原參考版本。

上述 benchmark 均注入 `searchNow: () => 0`，仍受 Lv.5 的 360 nodes、6 層與 beam 6 限制，但不驗證真實時間截止與超時行為。正式 UI 沒有注入時鐘，搜尋器使用 `Date.now` 與預設 180ms 時間預算；完整積極 UI 對局才能補驗實際瀏覽器條件，不能直接把 headless 矩陣結果視為該層驗收。

### 主動操作的正式 UI 對局

`node output/ai-cookierift/memory-guard-goal-20261018.mjs 768 output/ai-cookierift/active-human-vs-lv5-browser-20261018-r1.mjs` 在已完成 build 的本機 preview `127.0.0.1:4291`、既有 Chrome、1920×1080 執行。隔離 browser context 僅設定一般 60 張 ST1 自訂牌表及快速動畫；AI 等級／紅色 Arena 牌組、猜拳、開局、支援、登場、支付、目標、FLIP 略過與補位均由可見控制操作。未注入 GameState／test-state／搜尋時鐘，未讀 React 私有 state、對手手牌或隱藏牌面。

最終 run `test-results/active-human-vs-lv5-20261018-1792266731514-20764/report.json` 為 finished／accepted、exit 0：人方 6 次支援、1 次一般登場、9 次攻擊宣告、5 次補位，Lv.5 BS12 紅色 Arena AI 於第 13 回合勝利；原因為人方休息區等級達到 10，頁面錯誤 0。`final-or-stop.png` 與 `video/page@33b0afd3dcb4b67244d72c2d385fa158.webm` 保存結果與完整操作；driver SHA-256 為 `f26c0dc9710657c1a0f632047876dc39ea92f69f0fbb9ebfa45fae4387ff83dd`，記憶體 40.9～44.6%。先前三次 run 因 AI label locator、支援 wrapper 可見性計數及未辨識 FLIP modal 停止，均保留為 driver 失敗證據；實際支援放置成功，不列為產品缺陷。

此 driver 優先把可見重複手牌放支援、一般餅乾登場及合法攻擊，使用首個合法攻擊者／目標，略過可選回應；結果只驗收主動人方操作與真實瀏覽器時鐘的完整流程，不是專家打法、真人勝率或多人同步證據。這輪只修正 output driver 及文件，產品來源未變更，前述全套 Vitest／build／產品 ESLint 證據仍適用。

### 戰術 ST1 的三色正式 UI 對抗（Windmill 修補前）

另以獨立 driver 加入開局／登場耐久與費用評分、低價值手牌放支援、依公開 HP／有效攻擊選擇攻擊者及目標，以及 ST1 補 HP／抽牌 FLIP。己方查表限於這副 60 張牌表的正式 ST1 印刷，不以同名 BS12 卡覆寫；對手基礎 LV 不依同名猜測，只使用實際顯示的修改 LV badge。這仍是有限腳本，尚未操作 ST1 的道具、陷阱及所有可選技能，不能當專家或真人勝率。

三場都從一般選單選 Lv.5 與指定牌組、自然開局，未注入 GameState／test-state／搜尋時鐘；使用既有 Chrome、快速動畫及 56% 記憶體 guard。完整流程三場 finished／accepted，頁面錯誤皆 0，AI 勝負另列：

| AI 牌組 | 畫面 | 終局 | 人方攻擊 | 人方 FLIP | 其中棄牌補 HP／抽牌 | 記憶體 |
|---|---|---|---:|---:|---|---|
| BS12 紅色 Arena | 1920×1080 | 第 15 回合 AI 勝利 | 13 | 7 | 6／1 | 40.0～44.4% |
| BS12 黑色 Arena | 1164×777 | 第 17 回合 AI 勝利 | 9 | 8 | 6／2 | 39.7～43.6% |
| BS12 綠色 Arena | 1164×777 | 第 14 回合玩家勝利 | 11 | 3 | 2／1 | 39.5～43.5% |

人方合計 22 次支援、3 次一般登場、33 次攻擊宣告、12 次補位、18 次 FLIP；14 次實付棄牌補 HP、4 次選擇抽 1 張。黑色及綠色 r3 driver 等抽牌演出完成後才核對手牌恰好增加 1，三次可見觀測均為 6→7。兩場也經正常「查看對戰紀錄／全部展開」保存完整公開文字，沒有取 React 私有狀態或 engine payload；公開文字不保證每筆指令都含完整普通攻擊付款資訊。

原始報告為 `test-results/active-tactical-st1-vs-lv5-bs12-red-arena-20261018-1792271089857-9620/report.json`、`test-results/active-tactical-st1-vs-lv5-bs12-black-arena-20261018-1792271495102-18632/report.json`、`test-results/active-tactical-st1-vs-lv5-bs12-green-arena-20261018-1792271707838-15796/report.json`。各目錄保存終局截圖、付款截圖及完整錄影；黑／綠另有公開紀錄截圖。獨立 audit `output/ai-cookierift/tactical-ui-audit-20261018-r1.json` 為 PASS，核對原始報告／driver／ST1 資料雜湊、60 張牌表與每卡至多四張、操作數與連續 sequence、影片及終局圖存在；這個 PASS 是紀錄與流程驗收，並非三種 AI 都通過強度門檻。紅色 r1 SHA-256 `0b2999c9408828ab64c66ecde3d867fbb1264e3bdeabbabadb9965f699138661`，黑／綠 r3 為 `8b4f942d6120cfc627a8ebaa5ad18520d71a2a9dd9bd56c395d36890137a4e05`。

兩次失敗 driver run 保留：紅色 `1792270972688-4252` 的 ST1／BS12 同名查表覆寫與彈窗讀取競態，黑色 `1792271284194-22932` 在抽牌動畫未完成就計數（5≠6）。後者停止圖仍顯示「牌庫→手牌」演出；r3 等待演出後維持原本 +1 assertion，沒有放寬期待。兩次均不併入完成場次，也不列為產品規則缺陷。

綠色敗局第 2 回合則有具體 AI 決策問題：Leek 宣告 N 普通 1、唯一人方支援已 REST，AI 支付 BS7-064 Cookie Windmill 的 G 並把唯一 Grand Cookie Games Trophy 支援送棄牌，減攻卻選到本回合無法支付 RR 普通攻擊的 Mint Choco，回收段選零；這回合沒有得到紀錄可見的減傷或回收收益。後續已修正公開攻擊壓力評估：本回合無法實付普通攻擊的餅乾不再取得未來減攻收益；正在結算的攻擊仍按已宣告攻擊處理。五項原始實體卡回歸覆蓋只有已 REST 支援、另有兩份可付 RR 的支援、雙方隱藏牌換牌及獨立回收收益，並已包含於頁首本輪 56 項定向與 21,212 項完整測試；修補後 UI 結果另列，不改寫此敗局。第 13 回合的 Choco Drizzle（BS7-059）與 Buttercup（P-104）各 GGG 普通 3，可提出對同一 LV.3 Espresso 的公開致勝候選，但缺少完整活躍支援與隱藏 FLIP／陷阱回應資訊，不能直接宣稱 AI 漏掉必勝。本批屬相同 `e828a55a…` 來源在 Windmill 修補前的證據。

敗局診斷沒有直接以輸贏推定缺陷。#973 對藍色 Arena、seed `206401601` 的 23 步短敗局已完整重現：唯一餅乾昏厥後，手牌沒有餅乾，唯一合法補位指令為 `skip-replacement`。前一回合有合法攻擊卻選擇保留陷阱能量；BS8-073／074 的基本 G 費用確實可支付，但各減攻 1，不能僅憑保留與後續未發動就判定存在可救援方案。此步仍是待分析的防守估值，不是已確認漏補位 bug。

#1140 對紅色 Arena、seed `206432701` 的政策鏡像分別以 174 步落敗、209 步獲勝，兩邊指令與公開局面到 index 75 一致，首先分歧的是紅方在 index 76 的陷阱選擇，並非 #1140 先改變行動。另對 #1140 index 120 的支援顏色做單點合法分支：control 放 BS8-083 藍色支援，alternative 放 ST3-011 綠色支援；兩支在該步同步清除己方策略記憶以隔離重播方式差異。control 仍為 174 步落敗，綠色分支 170 步落敗，沒有增加攻擊次數或取得勝場，因此沒有根據此樣本調高混色支援權重。這是局部反事實實驗，不併入正式矩陣。重播與分支產物為 `output/ai-cookierift/replay-1140-red206432701-*-20261018-r1.json`、`output/ai-cookierift/counterfactual-1140-support-20261018-r1-{control,green}.json`；記憶體最高 39.1%，exit 0。未因這些診斷修改產品來源。

## 2026-10-17 ST6-004 攻擊後浪費增傷代價

以 Cookierift #1295 對 #1239、seed `206129620`、候選先手 player-one 重播，發現第 13 回合 Pitaya（ST6-004）已攻擊並 REST，Then 又用掉最後可用紅色支援；接著 AI 仍棄 1 張手牌發動「本回合自身攻擊傷害 +1」，當時沒有可用攻擊，隨即結束主要階段。官方匯入卡文 `data/cards/official-st6-004.en.json` 確認增傷僅到本回合結束。這是明確的付費 no-op 決策缺陷；強制提前增傷的分支遇到對手陷阱後仍落敗，不當作勝負改善證據。

`resolveAiSkill` 會在模擬中實際執行的效果全是來源自身、本回合有效的正向攻擊增益時，於支付技能代價後檢查增益是否選中來源、來源是否仍在戰鬥區，以及本回合是否還有該來源可執行的合法攻擊；任一條件不成立便排除該技能候選。這項檢查不以來源是否 REST 為條件。混合效果、其他目標、持續增益，以及含 Then／額外抽牌跟進的增益不在此 guard 範圍。新增 #1295／#1239 固定 seed 回歸，完整重播至終局，確認原決策點改為推進階段、手牌不變且對局正常結束。首輪過寬 guard 曾使 5 項既有測試失敗；縮窄至上述來源增益與付款後合法攻擊檢查後，同批 59 項測試通過。

驗證：4 個 AI 測試檔 59／59 通過、受影響檔 ESLint 通過、production build 通過（2,205 模組；既有 `game-demo` 大型 chunk 警告）、AI Browser 一般 UI smoke 6／6 通過。Browser smoke 沒有直接操作 ST6-004 場景；未跑完整 Vitest／全域 lint。GPT-6.1 Sol 唯讀複核未發現可證明的修補缺陷，未執行測試。這只證明一個固定 seed 的手牌保留決策改善，不代表勝率提升；未提交／推送。

## 2026-10-17 可選攻擊 Then 估值與不可用模式略過

重播 Cookierift #1295 對 #1001、seed `206129683` 時，BS9-077「Black Raisin Cookie」攻擊後的兩個牌庫移動模式都被對手 BS6-010「Timekeeper Cookie」禁止。原 AI 在沒有可用模式時選擇預設第一項，命令層拒絕後使對局中斷。現在 AI 與規則結算都會在所有模式不可用時略過該選擇並推進攻擊效果；本地與線上待決效果也會自動略過，不改變合法模式的選擇流程。以兩張正式卡及真實攻擊流程建立的回歸確認不再拋錯、戰鬥完成且來源仍留在戰鬥區。

另加入公開資訊限定的 optional attack Then 根估值：目前只預測單一對原防守者造成的公開傷害，投影普通傷害及已知自身 HP 代價，未讀取隱藏手牌／HP 或猜測 FLIP、陷阱回應。將此估值只從策略中停用，與啟用版本使用相同 source hash `5d981265434ee475df220fabe5b2ac1770a05833eeccb6fdb596e749b80a0cfc`；每副對手使用 12 個固定 replicate（0–11），含 27 副對手、三副紅色候選／參考構築及雙座位／先手鏡像，共 3,888 組配對、每個版本 3,888 場，全部完成且零失敗。此批 seed 公式為 `206129500 + opponentIndex * 10 + replicate`，因步幅小於 replicate 數，跨對手重用了部分數字，整體有 272 個 distinct seed values。候選牌組勝場：#1295 為 914 對 897、#793 為 835 對 830、#1259 為 718 對 699；195 組結果改變，其中候選牌組在啟用版勝出的有 118 組、停用版勝出的有 77 組，整體淨差 41 勝。這是固定矩陣下、兩個政策版本各自同時控制雙方的 deterministic AI-vs-AI 篩選；不代表真人勝率或普遍 AI 強度提升。

為排除 seed 數值跨對手重用，再用相同 27 副對手、三副構築及鏡像方式做獨立 cohort，seed 公式改為 `206200000 + opponentIndex * 12 + replicate`，共 324 個唯一 seed 值。兩版本仍使用相同 source hash；各完成 3,888 場、零失敗，3,888 組配對鍵全部唯一。候選牌組勝場：#1295 為 936 對 917、#793 為 827 對 824、#1259 為 706 對 668；196 組結果改變，啟用版候選牌組勝出 128 組、停用版 68 組，淨差 60 勝。這仍是另一組固定矩陣的 AI-vs-AI 篩選；未進行顯著性檢定，不代表真人勝率或普遍策略提升。報告：`output/ai-cookierift/community-1295-mirror-diagnostic-aftereffect-mode-skip-unique-seed-12rep-run2-20261017.json`、`output/ai-cookierift/community-1295-mirror-baseline-noaftereffect-mode-skip-unique-seed-12rep-run2-20261017.json`。

反向案例抽查中，#1295 對 #1174 的 48 場配對為啟用版 31 勝、停用版 34 勝，4 場由停用版勝出、1 場由啟用版勝出。啟用版在 seed `206200230` 第 4 回合選擇 Fire Spirit 的二能量攻擊，後續支付 1 HP 造成 Then 傷害並擊倒 3 HP 的 Caramel Choux；seed `206200231` 的第 4 回合也選擇攻擊而非發動 1 能量技能，攻擊估值增加 49，同時仍扣除公開回應 47 與防守保留 24。這些翻盤標出攻擊後續效果會促成高代價出手的局面，但單局結果不足以證明該交換不合理；目前不據此調低全域權重，保留為後續對戰診斷樣本。

2026-10-17 另以新加入的 Cookierift #897 綠藍牌組做政策交叉賽：啟用 aftereffect 的 AI 與同來源停用版輪流控制雙方，對另外 25 副社群牌組及 7 副官方 BS12 牌組，以 12 個 seed、雙候選座位與雙先手排列共跑 3,072 場，1,536 組鏡像配對全部完成且零失敗，bundle 輸入雜湊同為 `a2e17858e7c84fa51797041cb8ca693090d2bfffbc7ee694afc839dea41491d8`。啟用版政策 1,534 勝、停用版 1,538 勝；#897 在啟用／停用政策下分別 359／1,536 與 361／1,536 勝。四場淨差只來自韓版紅色 starter 的 12-replicate 小樣本，故另對該對手跑 48 個新 seed、384 場交叉賽，啟用版反以 194 勝對停用版 190 勝，#897 分別 22／192 對 20／192 勝。方向反轉且差距都小，沒有證據支持通用調參或勝率改善宣稱；保留 aftereffect 評分，後續應用更多獨立對局找可重現的決策問題。報告：`output/ai-cookierift/community-897-roster-policy-crossplay-20261017.json`、`output/ai-cookierift/community-897-korean-red-policy-crossplay-48rep-20261017.json`；四組非平手鏡像的決策重播：`output/ai-cookierift/trace-897-policy-crossplay-adverse-seeds-continuations-20261017.json`。

驗證：no-playable-mode 修正的定向回歸 4 檔／98 項、AI suite 87 檔／1,298 項、production build、受影響檔 scoped ESLint 與 AI Browser 6／6 通過；後續 only-test 變更的 optional-Then 測試為 1 檔／13 項通過。完整 `npm.cmd run lint` 仍被既存未追蹤 `.tmp-vitest-ai-seeded-shuffle-debug-20261016/replay.ts` 的 8 個 `no-explicit-any` 錯誤阻擋，該使用者暫存檔未修改。GPT-6.1 Sol 雙軸唯讀複核未找到可證實的 P1／P2 產品問題；Spec 軸發現的 ST6-004 說明差異已同步修正，Standards 軸另列低優先度具名付款參數群組建議。未提交／推送。

## 2026-10-17 Cookierift #1295 紅色「Basic red」

從 [Cookierift 社群牌組 #1295](https://cookierift.com/decks/community/1295) 擷取 atomic 的「Basic red」（2026-10-17 更新，頁面標示合法，主牌 60 張、EXTRA 6 張）。卡號取自頁面實際顯示的卡圖 URL、張數取自同一張卡片按鈕；保留 26 種正式卡號與原張數，沒有替換。所有主牌與 EXTRA 卡都能在正式卡池找到，印刷顏色全為紅色，沒有禁限卡或超過四張的卡號。來源快照位於 `data/decks/cookierift-community-20261017.json`，牌表 hash 為 `sha256:35ba4acb3785f900682609b56251243ffb4794575e578b2d82413cff20996da8`。

牌組已接入 AI 選單、正式牌組建立、Browser 選單驗證與 benchmark roster。與最接近的已收錄牌組 #793 共用 24／66 張副本，唯一卡號 Jaccard 為 13／39（0.333），有足夠卡牌差異可增加紅色構築變化。使用同一個新編譯的目前 AI bundle，對 27 副已收錄社群／官方對手、雙座位與雙先手指派做固定 seed 鏡像篩選：#1295 勝 70／108，最近兩副參考 #793 勝 67／108、#1259 勝 64／108；324／324 場完成，沒有執行錯誤。這是小型 deterministic AI-vs-AI 篩選，不能代表真人勝率或整體 AI 強度。

定向 Vitest 2 檔／68 項、受影響檔 ESLint、benchmark／Browser 腳本語法檢查與 `git diff --check` 通過；production build 轉譯 2,205 個模組並成功，僅出現既有 `game-demo` 大型 chunk 警告。正式選單 Browser 在桌機 1366×768 與平板 1164×777 共 62／62 通過，包含 #1290／#1295 的開局與問題包逐張核對；#1295 兩種尺寸均載入原始 60 張主牌及 6 張 EXTRA，頁面錯誤為 0。

`benchmark-cookierift.mjs --plan-only` 驗證目前 31 副牌組、496 組配對、3,968 場的 roster 計畫。由於目前基準 manifest 引用缺少的 `data/candidates/st6-st10/official-st9.en.json`，本次僅以現行 diagnostic bundle 路徑執行不建置／不對戰的 plan-only roster 檢查，沒有執行完整 matched benchmark 或基準 policy 比較。未提交／推送。

GPT-6.1 Sol 唯讀複核未發現可證明的 P1／P2 整合缺陷；複核沒有重跑測試、build 或 Browser，也沒有重新查驗線上來源。另追蹤 #1295 對 #506 的落敗 seed `206129560`：第 9 回合 AI 保留支援並結束主要階段時，規則層仍列出攻擊及部署；同局面強制攻擊或部署的分支仍落敗，攻擊分支還觸發對手 BS11-110 減攻陷阱。這不足以證明原決策錯誤，暫不據此調整 AI。診斷重播：`output/ai-cookierift/trace-community-1295-debug-vs-506-seed206129560-p1-p1.json` 及兩個 `branch-1295-*` 檔。

## 2026-10-17 Cookierift #1140 綠藍「Sea-green Deck! :D」

從 [Cookierift 社群牌組 #1140](https://cookierift.com/decks/community/1140) 擷取 Lady_Pastel15 的「Sea-green Deck! :D」（頁面標示合法，2026-10-11 更新、尚無評分，主牌 60 張、EXTRA 6 張）。逐一開啟 41 個卡片詳情按鈕確認卡號，依頁面張數合併重複列，保留 31 種正式卡號，未替換；來源 hash 為 `sha256:0321bc5c67b9eca65e9552484d338b0a124164e8e3f6df34f73cea87facd2f27`。牌組已登錄到 AI 選單、正式牌組建立器、benchmark roster 與 Browser 選單矩陣。它與最接近的既有構築 #283 只共用 6／46 個唯一卡號（Jaccard 13.0%），提供低重疊的綠藍構築變化；頁面沒有競技評分，因此不據此宣稱強度或勝率提升。

驗證在 Windows PowerShell 完成：`npm.cmd test -- --run src/game/community-deck-recipes.test.ts src/components/MainMenu.test.tsx --maxWorkers=1`（TEMP／TMP 指向 `.tmp-vitest-cookierift-1140-green2-20261017`）exit 0，2 檔／80 項通過，涵蓋來源 hash、合法 60+6 張牌表、正式卡池解析、選單選項與原卡號張數；`npx.cmd eslint --max-warnings=0` 加上受影響的 7 個 TS／TSX／MJS 檔案 exit 0；`npm.cmd run build` exit 0、轉譯 2,206 模組，僅有既有 `game-demo` 大型 chunk 警告；兩支腳本 `node --check` 與 `git diff --check HEAD -- <受影響路徑>` exit 0。`node scripts/cookierift-menu-browser.mjs` 以本機 Vite preview `127.0.0.1:4240` 執行，沿用先前已確認必須升權的 loopback Browser 驗證流程，exit 0；桌機 1366×768 與平板 1164×777 共 70／70 個牌組選項通過，無錯誤，#1140 兩尺寸均載入來源相同的 60 張主牌及 6 張 EXTRA，結果在 `output/ai-cookierift/community-browser-20261017-current-menu-897-283-1140/results.json`。`node scripts/benchmark-cookierift.mjs --baseline output/ai-cookierift/baseline-engine.mjs --plan-only` exit 0，列出 35 副牌組、630 組 matchup、預估 5,040 場；`writesFiles:false`，未建立 bundle 或執行對戰，故沒有 #1140 勝率證據。未跑完整 Vitest／完整 AI 對戰，未提交／推送。

## 2026-10-17 Cookierift #1291 黃色「Immortal Cheese (Ver 1)」

從 [Cookierift 社群牌組 #1291](https://cookierift.com/decks/community/1291) 擷取 homocidalspider 的「Immortal Cheese (Ver 1)」（2026-10-17 更新，頁面標示合法，黃色，主牌 60 張、EXTRA 2 張）。逐張開啟頁面卡片詳情核對卡號，張數來自同張卡按鈕；頁面將 Pistachio Cookie 分列 3 張與 1 張不同圖版本，依相同印刷基礎卡號合併為 `BS9-041:4`。牌表保留 25 個主牌卡號及 2 個 EXTRA 卡號，沒有替換。正式卡池建牌與標準格式驗證通過。來源快照與 hash 位於 `data/decks/cookierift-community-20261017.json`，牌表 hash 為 `sha256:b60cb81279942a495e155bc0b194316e46fa93a4c8b316d03db5debcda995f81`。

這份牌表與最接近的已收錄黃色參考 #1035 共用 4／43 個唯一卡號，與 #1239 共用 4／48，能補入明顯不同的黃色構築。不過同一目前 AI 對 28 副共同社群／BS12 對手、輪替兩個座位與兩種先手指派的固定種子篩選中，#1291 勝 37／112；#1035 勝 80／112、#1239 勝 63／112。336／336 場都正常結束、沒有引擎錯誤。這只支持牌組篩選，不代表真人勝率；結果顯示 #1291 目前是較弱的 AI 配置，不能當作 AI 勝率提升證據。

對 BS12 紅色的代表性落敗重播（seed `206129350`）共 193 個 AI 動作。檢查候選 AI 的主要階段，所有沒有行動而推進階段的節點僅有 `advance-phase` 合法指令；這條重播未找出可證明的漏攻擊或漏部署決策。尚未證明低勝場來自決策缺陷，後續 AI 強化仍需從更能重現的錯誤選擇下手。

候選接入 AI 選單、牌組建立、Browser roster 與 matched benchmark roster。定向 Vitest 2 檔／71 項、受影響檔 ESLint、production build 通過；Browser 桌機 1366×768 與平板 1164×777 共 64／64 通過，#1291 兩種尺寸均實際載入原始 60 張主牌與 2 張 EXTRA，頁面錯誤為 0。新的 `--plan-only` roster 檢查為 32 副牌組、528 組配對、4,224 場，未寫入報告檔。完整 matched benchmark 仍受缺少的 `data/candidates/st6-st10/official-st9.en.json` baseline manifest 輸入阻擋；未提交／推送。

## 2026-10-17 ST10-018 陷阱救援漏判

在固定敗局 seed `206042101`（Cookierift #1151「Silent」對 BS12 紫色 Arena，候選 AI 為 player-two）中，ST10-018「Reunion of Star and Moon」可支付 PPP，將攻擊傷害降低 2，之後回收最多一張紫色 LV.3 Cookie。當己方棄牌區沒有符合回收條件的 Cookie 時，原 AI 將整條陷阱序列視為不可救援，錯過仍可合法執行的前段減傷。修正後只要最終 `trash-to-hand` 的選擇下限為 0，就保留前段效果的救援投影，並將回收交給一般選牌流程；必選的尾段目標仍不會被略過。

新增以正式 ST10-018、合法 PPP 支援及無紫色 LV.3 棄牌目標的 AI 回歸，確認 AI 仍支付減傷、選擇攻擊者、以空選擇完成可選回收，並在實際傷害結算後保住 2 HP Cookie。精確同種子前後重播中，舊策略在 3 點傷害對 2 HP 目標時略過 ST10-018，修正後實際減傷至 1 並翻轉該場勝負；其他前置選擇與初始牌局 parity 一致。

再以 Cookierift #1151 對六色 BS12 Arena 起始牌組做 120 組配對 AI-vs-AI 診斷：每色 10 個 seed、雙先手指派，逐場初始狀態 parity 通過，所有對局結束。117 場勝負相同、3 場由候選 AI 翻勝、0 場反向翻盤；候選 AI 勝場由 50／120 變為 53／120。翻勝分布為紫色對局 2 場、黑色對局 1 場。這是單一社群牌組對六副官方牌組的局部策略比較，不是人工對戰勝率或整體 AI 強度證明。診斷程式與兩個策略 bundle 位於 `output/ai-cookierift/paired-st10-018-rescue-color-matrix.mjs`、`output/ai-cookierift/candidate-lv5-st5-020-current-20261017.mjs`、`output/ai-cookierift/candidate-match-after-st10-018-20261017.mjs`。

定向 Vitest 21／21、兩個受影響檔 Scoped ESLint、production build 通過；完整 Vitest 1,054 檔／21,129 項全部通過。AI Browser smoke 6／6 通過一般 UI 流程，沒有直接操作 ST10-018 場景。GPT-6.1 Sol 配置的唯讀複查未指出 P1／P2 缺陷，複查工具無法獨立回報執行模型 ID。追蹤中的 1,788 個程式檔 ESLint 皆 0 errors／warnings；原始全域 `npm.cmd run lint` 因未追蹤 `.tmp-vitest-ai-seeded-shuffle-debug-20261016/replay.ts` 的 8 個 `no-explicit-any` 錯誤退出 1，沒有修改該使用者暫存檔。未提交／推送；其他顏色牌組及對真人勝率仍需持續驗證。

## 2026-10-17 BS12-082 道具額外棄牌下的 Then 預檢

GPT-6.1-configured 唯讀複查指出，對手場上有 BS12-082「DJ Cookie」時，AI 會先開啟額外棄牌流程並提前返回，略過一般道具路徑已具備的可選 Then 付款檢查。以正式 BS10-119「Soul Jam: Light of Silence」、BS12-082、合法額外手牌與支援付款重現：己方本局未 Refresh、沒有 BS10-122「Silent Salt Cookie」，且支付道具基本費用後無法支付 Then；原 AI 仍宣告道具並要求棄牌，預期失敗案例證實會建立 `pendingOpponentHandDiscard`。

修正後會先依 AI 的額外棄牌選擇，使用權威 `playItem` 模擬 DJ 稅費與道具基本費用，再依實際付款後狀態檢查條件效果及可選 Then。若沒有啟動效果，或僅有不可付款／沒有合法目標的 optional-cost Then，就保留道具、不開始棄牌流程；無額外稅費的原路徑也重用同一個 Then 可行性判斷。新增正式卡牌回歸確認 BS10-119 留在手牌、支援未橫置、沒有開始 BS12-082 棄牌待決且輸入狀態未變。

定向 Vitest 2 檔／15 項、受影響檔 Scoped ESLint、production build 通過；完整 Vitest 1,055 檔／21,132 項全部通過（1,402.15 秒，exit 0）。AI Browser smoke 6／6 通過一般 UI 檢查，沒有直接操作 BS12-082 稅費場景。GPT-6.1-configured 唯讀複查未發現 P1／P2／P3；複查介面無法獨立確認 runtime model ID。此次是局部錯誤決策修正與固定官方卡測試，沒有新的對戰勝率證據；未提交／推送。

## 2026-10-17 Cookierift #1001 純藍牌組「Pure Shadow」

依 [Cookierift 社群牌組 #1001](https://cookierift.com/decks/community/1001) 的最新可見牌表加入純藍「Pure Shadow」（milk_man，2026-10-16 更新，60 張主牌、6 張 EXTRA，頁面顯示 19 次匯入、尚無評分）。來源快照保留於 `data/decks/cookierift-community-20261016.json`，牌表來源 hash 為 `sha256:8685b4c2aaf20b5545c6842a4333447be12a275891118d78b02359189d20da33`。24 種卡號皆可在正式卡池找到，張數未超過同卡四張上限，包含 P-092；牌表沒有替換卡。

已將牌組接入正式社群牌組選單、牌組建立與 benchmark roster。它與目前最相似的已收錄牌組 #1164 有 15/32 個共同卡號（Jaccard 0.469）；現有牌組彼此最高重疊為 #927／#801 的 20/30（0.667），因此這份最新純藍構築增加了相對不同的選擇。這是牌表差異比較，不代表其競技強度。

驗證結果：定向 Vitest 3 檔／62 項、五個受影響 TypeScript 檔 Scoped ESLint、production build（2,204 modules；僅既有大型 `game-demo` chunk 警告）通過；桌機 1366×768 與平板 1164×777 的選單 Browser 共 56/56 通過，28 個選項均可開啟且無頁面錯誤。最終完整 Vitest 1,054 檔／21,127 項全部通過（1,388.37 秒，exit 0），包含本次牌組接線與 fixture 修正。GPT-6.1 Sol 唯讀複查未發現可採取行動的缺陷；複查沒有執行測試，線上來源則由本批的瀏覽器查驗。`--plan-only` 將 #1001 列入 28 副牌組、406 組配對、3,248 場的計畫，但沒有執行對局；因此本批沒有新的 AI 勝場或勝率證據。計畫與 Browser 報告分別位於 `output/ai-cookierift/cookierift-1001-plan-20261017.json` 及 `output/ai-cookierift/community-browser-20261017-pure-shadow-menu-1001-retry/results.json`；完整測試日誌及退出碼記錄在 `output/ai-cookierift/full-vitest-cookierift-1001-20261017.log` 與 `output/ai-cookierift/full-vitest-cookierift-1001-20261017-exit.txt`。既有 matched cohort 基準仍標示 `PROTOTYPE-EQUIVALENCE-NOT-YET-VERIFIED`，不據此主張對真人勝率或普遍 AI 強度提升。

## 2026-10-17 Cookierift #1174 紅色「Red Arena」

依 Cookierift 社群牌組 [#1174](https://cookierift.com/decks/community/1174) 收錄 Clannad_is_Life 的紅色「Red Arena」（頁面更新 2026-10-12，60 張主牌、6 張 EXTRA）。來源快照為 `data/decks/cookierift-community-20261017.json`，來源欄位 hash `sha256:a79295f6c7a2ca1a5b465e85c03f8bab91ee1a5a7593f1dd487b274fbbbe2690`，檔案 SHA-256 `28986a7abdd33eba6969dbc1fe5eae2f3c1e380022a07e47ea1cbc0117220f32`。21 個卡號可由正式卡池建立，沒有替換卡；與最相近的紅色 #83 共有 14／28 種卡號，另含 7 種不同卡號。

牌組接入正式社群 recipe、牌組與 EXTRA 建立、AI 對手選單及 Cookierift benchmark roster。定向 Vitest 2 檔／62 項、受影響 JS／TS Scoped ESLint、`npm.cmd run build`（2,205 modules）通過，僅有既存大型 `game-demo` chunk 警告。桌機 1366×768 與平板 1164×777 的 Browser 驗收 58／58 通過；兩種尺寸均實際選擇 #1174、完成開局，並逐卡確認問題包與建立出的 60 張主牌／6 張 EXTRA 和來源張數完全一致。結果：`output/ai-cookierift/community-browser-20261017-red-arena-1174/results.json`。

同一個新建 current-policy bundle 的鏡像診斷中，#1174 與 #83 各自對 26 個相同社群／官方對手進行 104 場；每個對手使用一個固定 seed，交換雙方席位與先後攻。兩者均完成全部 104 場且無執行錯誤；#1174 勝 55 場、#83 勝 64 場。GPT-6.1-configured 唯讀複查建議將 #1174 排低優先度，但也指出 9 勝差距不足以判定其普遍較弱，且牌表不是近似複製。基於本任務增加配對多樣性的目的，仍將此合法且有明顯牌表差異的紅色選項納入；單一 seed／對手的四種座位交換不視為獨立隨機樣本，結果不代表人類勝率或競技強度，需更多 seeds 才能評估相對表現。最終 bundle SHA-256 `f2ee470c008fab929fbf1d634f4200f1ba057bc80acb20ced98a623ce885904e`，報告：`output/ai-cookierift/community-1174-mirror-diagnostic-20261017-r4.json`。複查介面未提供可獨立確認的 runtime model ID。

## 2026-10-17 27 副牌組 matched cohort（BS9 修正前）

以 27 副牌組、378 組配對、兩個 seed 及四種座位／先手交換執行 Lv.5 matched AI-vs-AI，共 3,024 場；756 項預檢與 3,024 項逐局 parity 全通過，失敗、未完成及動作上限皆為 0。候選策略 1,554 勝、凍結基準 1,470 勝（51.39%）。各色候選／基準勝場為藍 230/214（448 場）、綠 138/115（448）、黃 251/242（448）、紅 358/356（672）、紫 213/217（448）、黑 323/307（448）、多色 41/19（112）。

報告：`output/ai-cookierift/matched-comparison-lv5-next-active-pressure-seed-206000000-20261017.json`。這是 next-active-pressure 政策修正的描述性固定矩陣，產生時間早於下方 BS9 EXTRA 可選 Then 修正，不能作為該卡牌修正的證據。凍結基準 manifest 標示 `PROTOTYPE-EQUIVALENCE-NOT-YET-VERIFIED`；結果未作顯著性檢定，不代表真人勝率或普遍策略提升。

## 2026-10-17 ST5-020 直接棄置成本的陷阱救援

在固定敗局 seed `206002100` 中，候選 AI 面對 Wind Archer 的 2 點致命攻擊時略過 ST5-020「Forbidden Grimoire」。它可支付 P1 並將實體 ST10-006「Blueberry Pie」從戰鬥區棄置，讓 BS2-058 Wind Archer 留下 2 HP。問題在於陷阱目標評估未投影 `trashBattleCookie` 付款，因此把可行救援視為不可用。這是固定 AI-vs-AI 重播中的決策缺陷，不是勝率提升證據。

修正後，評估器會先以實際可支付的戰鬥區餅乾 ID 投影直接棄牌成本，並同步處理離場修飾與離場紀錄，再計算陷阱效果；同一組合法 ID 也會用於最後的陷阱指令。昏厥區及放到 Break 區的餅乾成本仍採保守略過。新增官方卡資料回歸驗證 AI 實際支付 ST5-020、棄置 ST10-006、降低傷害並保住 BS2-058；牌組維持 60 張且 instance ID 唯一，未建立虛構卡。

另以報告所附的舊候選 bundle（早於 BS9 修正）與目前 bundle 對固定敗局 seed `206002100` 做逐決策比較，初始狀態 parity 通過；第 7 回合第 68 步的實際公開狀態中，舊策略跳過陷阱，目前策略則支付 P1、棄掉 ST10-006 並對攻擊者減傷。可重現 trace 存於 `output/ai-cookierift/st5-020-loss-206002100-policy-trace-20261017.json`。兩個 bundle 除此陷阱修正外也有其他版本差異，因此該 trace 用來確認目前在原始狀態採取付款／減傷，不單獨作修正歸因；它在第一個策略分歧處停止，也不代表整局勝負翻轉。

聚焦 Vitest 2 檔／23 項、受影響檔 Scoped ESLint、`npm.cmd run build`（2,204 modules；僅既有大型 `game-demo` chunk 警告）及 `npm.cmd run test:ai:browser` 6/6 smoke 檢查通過。Browser smoke 覆蓋一般 AI UI，沒有直接操作 ST5-020 場景。GPT-6.1 Sol 唯讀複查未發現可採取行動的缺陷。完整 Vitest 1,054 檔／21,124 項全數通過（1,403.77 秒，exit 0）。本批不以固定 seed 推估真人勝率或普遍策略提升。

## 2026-10-17 BS9 EXTRA 攻擊可選 Then 與 detached FLIP

修正 AI 選擇 EXTRA 攻擊效果後略過可選 Then 費用的流程。現在會將該類費用交給既有能力付款佇列；若費用包含 BS9-030 的 `activate-discarded-flip`，付款後會建立真正的 detached FLIP 戰鬥決策，完成 FLIP 後才接續原攻擊流程。

以 BS9-079 的真實父效果與原始卡資料重現：BS9-055 可選效果現在會由 AI 支付支援區卡片回手，選擇並對 1 HP 對手造成 1 點傷害；BS9-030 可選效果以印刷 BS9-026 FLIP 支付後，會開啟實際抽牌 FLIP、完成解析並把 FLIP 卡留在棄牌區。測試清除了無關且超過合法張數的對手棄牌區 fixture，使用原始卡資料，未建立虛構卡。

定向 Vitest 6 檔／91 項通過，包含 BS9 效果與能力稽核回歸；受影響檔 ESLint、build（2,204 modules；只有既有大型 `game-demo` chunk 警告）通過。`npm.cmd run test:ai:browser` 6 項 UI smoke 檢查全通過：開局設定、HP 顯示、手牌檢視、AI 狀態標示及暫停資訊顯示／恢復。這是一般 AI Browser smoke，沒有直接操作 BS9-030／055 情境。

本批完整 Vitest 執行 1,054 檔／21,123 項，1,053 檔／21,122 項通過；唯一失敗是全卡池能力稽核仍將已支援的 BS8-076 列為 unsupported。依該卡印刷文字及 BS8-076 專項能力測試，已從稽核預期清單移除 BS8-076；修正後包含全卡池稽核的六檔／91 項定向測試全過，未重跑整套 Vitest。全域 ESLint 執行約六分鐘無輸出後取消，結果不列為通過；本次受影響檔的 Scoped ESLint 通過。

## 2026-10-17 效果傷害目標公開減傷重驗

重跑先前記錄在本報告舊段落的 AI 單元反例 `output/ai-cookierift/effect-damage-action-probe.ts`。目前 `takeAiStep(level: 5)` 對公開可知的 2 點效果傷害，略過有 -2 效果減傷的 1HP 保護目標，改選可受2點傷害的 2HP 餅乾；它與權威 `applyGameCommand` 的合法替代指令得到相同狀態：受保護目標仍有1HP，脆弱目標昏厥並開啟補位。探針命令 `node_modules/.bin/tsx.cmd output/ai-cookierift/effect-damage-action-probe.ts` exit0；目標評估沿用共用 `getPublicEffectDamageByTarget` 預測。這驗證先前記錄的代表性入口目前已修正，不代表所有效果傷害卡／目標模式皆已覆蓋，也不證明整體或對人類勝率提升；未為這次重驗修改產品程式。

## 2026-10-17 BS8-076 條件式下回合啟動壓力

改善 BS8-076 Icicle Yeti 的攻擊 Then 評估：公開狀態若顯示目標持有人手牌足以支付棄牌數，AI 會比較「維持休息」與「棄牌後重新啟動」兩種回應，費用只依公開手牌張數估值，不推測隱藏手牌身分；共享支援能量只計算一次。目標挑選保留有合法 REST 傷害技能的對手餅乾，即使普通攻擊壓力為零。另修正壓力基線不再把已啟動、僅受「下回合不啟動」技能標記的餅乾誤算為受限制。

回歸涵蓋 BS12-015 已啟動餅乾與 BS3-101 Moon Rabbit 的共享付款情境、持有人手牌足夠／不足、多個條件目標共用手牌預算、BS8-004 以 REST 技能造成致命傷害，以及實際 BS8-076 攻擊 Then 由 `takeAiStep(level: 5)` 支付並選擇普通攻擊壓力最高的對手目標。聚焦 Vitest 2 檔／35 項通過，Scoped ESLint、`npm.cmd run build`、`git diff --check` 通過；GPT-6.1 Sol 唯讀審查沒有可採取的修正意見。

後續審查發現其中一個 5 HP fixture 使用五張 BS8-078，超過同卡四張限制；改以一張正式 BS8-080 保持 5 HP。修正後該測試檔 17/17 項及 Scoped ESLint 通過；這項測試資料修正也包含在上方記錄的最終完整 Vitest 中。

正式能力稽核重跑結果為 2,124 筆印刷、1,641 張唯一卡、4,232 項能力、138,477 個候選 Combo、0 筆轉換失敗；整體仍為 conservative，BS8-076 已不在 unsupported 清單，其他 19 張未支援卡仍待分別處理。報告：`output/ai-cookierift/ai-capability-audit-after-bs8-076-20261017.json`。既有 matched harness 的凍結基準早於目前政策／規則版本，因此本次未以它估算勝率，也不主張整體或對人類勝率提升。

## 2026-10-16 末場陷阱保命決策修正

在固定失敗 seed `204512100`（S3 綠色防守牌組對 Cookierift #1151）中，己方只剩 1 HP 的 Plantain Cookie，對手 Prophet Cookie 的 1 點攻擊傷害會直接結束對局。手牌中的實體 ST3-019「Supreme Whipped Cream」可支付綠色能量並棄置一張支援，將該次傷害降為 0；舊決策卻因陷阱保留分數與代價扣分而選擇跳過，隨即敗北。原始重播紀錄：`output/ai-cookierift/trace-candidate-loss-204512100-green-vs-1151.json`。

修正後，AI 先依實際付款橫置支援、將陷阱移入棄牌區，再用正式效果執行器投影各效果及符合條件的 Then，並為每個效果建立可執行的獨立目標。預測器以該目標實際承受的傷害與效果後 HP 判斷是否救下最後一隻餅乾；僅當手牌沒有補位候選且這個具體支付／目標方案能避免昏厥時，保命門檻才高於跳過。棄手牌費用也以同一組合法 instance ID 投影付款與後續手牌／棄牌區，再將這組 ID 原樣交給實際陷阱指令；最後的 draw-up-to 留給一般效果解析流程。其他未能投影的非能量費用或效果仍採保守處理，不把未付款的方案當成可行。

新增回歸涵蓋原始 seed、ST3-019 保命、ST6-017 的巢狀 Then 減攻、BS4-042 分別鎖定攻擊者與自身的複合目標、BS1-051 在禁止補 HP／公開傷害減免下不誤判保命，以及 BS12-087 陷阱本身進入棄牌後才達成 Arena 門檻、BS10-116 的 Then 移除 Beast 攻擊者。GPT-6.1 Sol 唯讀複查確認 BS12-087 與 BS10-116 反例已關閉，未發現其他可重現產品缺陷。

另外，藍色鏡像 seed `204500000` 第 90 步重現 BS6-085「Destruction of a Pastless Future」漏判：BS7-067 Dark Choco Cookie 剩 2 HP，正承受 2 點傷害，手牌共 4 張且可支付藍色能量。修正前 AI 跳過陷阱；修正後支付能量、棄兩張合法手牌，將攻擊降低 2 並救下 BS7-067。實際 AI bundle 重播記錄到付款、ATK -2 與兩張牌進棄牌區。

定向驗證 3 檔／34 項通過。`npm.cmd run build` 通過（2,204 modules；僅既有大型 `game-demo` chunk 警告）；全域 ESLint（排除生成 `.tmp-vitest-*` 與 `output`）通過；AI Browser smoke 的開局、HP 顯示、手牌檢視與暫停／恢復 6 項全通過。完整 `npm.cmd test -- --maxWorkers=1` 通過 1,054 檔／21,110 項（1,352.35 秒，exit 0）。

以 26 副牌組、351 組配對、兩個 seed 與四種座位／先手交換執行 Lv.5 matched AI-vs-AI。相對於修正前 policy，候選 2,871 勝、基準 2,745 勝／5,616 場（候選 51.12%）；1,404 項初始 parity 檢查與 5,616 項逐局 parity 全通過，失敗、未完成及動作上限皆為 0。再與先前凍結的 `candidate-lv5-community-1248` policy 比較，相同兩個 seed cohort 共 2,848 勝對 2,768 勝／5,616 場（候選 50.71%），所有 parity 通過，失敗、未完成及動作上限皆為 0。固定基準的各色候選勝場／基準勝場為藍 418/400（864 場）、綠 263/243（864）、黃 462/451（864）、紅 721/690（1,296）、紫 310/328（648）、黑 601/587（864）、多色 73/69（216）。這些是固定牌組與 seeds 的描述性結果，未作顯著性檢定，也不代表真人勝率或普遍策略提升。

對照修正前 policy 的報告：`output/ai-cookierift/matched-comparison-lv5-blue-discard-hand-projection-seed-204500000-20261016.json`、`output/ai-cookierift/matched-comparison-lv5-blue-discard-hand-projection-seed-204600000-20261016.json`；對照凍結基準的報告：`output/ai-cookierift/matched-comparison-lv5-blue-discard-hand-projection-vs-baseline-seed-204500000-20261016.json`、`output/ai-cookierift/matched-comparison-lv5-blue-discard-hand-projection-vs-baseline-seed-204600000-20261016.json`。AI Browser 是 UI smoke；本次陷阱決策與付款由固定 seed 模擬及 matched AI-vs-AI 報告驗證。

## 2026-10-16 Cookierift #1127 紫色 Arena 牌組與 Lv.5 matched holdout

從 [Cookierift 社群牌組 #1127](https://cookierift.com/decks/community/1127) 擷取 Lyxn 的 Purple Arena（頁面更新於 2026-10-15，合法，60 張主牌、4 張 EXTRA、21 種卡號）；來源 hash `sha256:39403fb1450d8587df51c83aef9c5cd6ec6e1d75d23cf77c4266f525ec755d84` 已寫入並重算一致。逐卡 strict 稽核 28 筆印刷分支皆 verified，沒有 needs-review 或 blocked。與已收錄牌組比較，最高唯一卡號 Jaccard 相似度為 #568 的 9/33（27.27%）。牌組已接入 community recipes、選單、starter deck 建構及 benchmark；27 個選單項目於桌機1366×768／平板1164×777共54／54 Browser PASS，聚焦 Vitest 2檔／56項、build 與全域 lint 通過。

以 27 副牌組、378 組配對、兩個 seed cohort、每組四種座位／先手交換執行 Lv.5 matched AI-vs-AI。第一組候選 1,542 勝、基準 1,482 勝／3,024 場；第二組候選 1,532 勝、基準 1,492 勝／3,024 場，合併為 3,074 對 2,974／6,048（候選50.83%）。兩組各756項初始預檢、3,024項逐局 parity 全通過，無失敗、未完成或動作上限。指定 #1127 時，候選策略在兩組分別為48／112及51／112勝；基準為47／112及53／112勝，合併99／224對100／224。各色合併勝場候選／基準為藍402／357（896場）、綠283／271（896）、黃514／501（896）、紅749／732（1,344）、紫420／413（896）、黑631／627（896）、多色75／73（224）。這是固定 AI-vs-AI 牌組與 seed 矩陣的描述性結果，未作顯著性檢定，不代表真人勝率或普遍策略提升。

兩組報告：`output/ai-cookierift/matched-comparison-purple-1127-seed-204700000-20261016.json`、`output/ai-cookierift/matched-comparison-purple-1127-seed-204800000-20261016.json`；Browser 選單結果：`output/ai-cookierift/community-browser-20261016-current-menu-1127/results.json`。

## 2026-10-16 Cookierift #1248 藍色牌組與 Lv.5 matched holdout

從 [Cookierift 社群牌組 #1248](https://cookierift.com/decks/community/1248) 擷取 DonutGaming 的「Sea Build」（頁面更新於 2026-10-16，合法，60 張主牌、6 張 EXTRA）；逐張依頁面卡圖與張數匯入，未替換卡牌。來源快照在 `data/decks/cookierift-community-20261016.json`，來源欄位 hash 為 `sha256:260e8bcafe02d4814c7fc458d42712dd6e214c18fc7161a864c1fcf54d67818d`。21 個不同卡號的全部 32 筆印刷通過 strict contract audit，0 needs-review、0 blocked。與既有 18 副社群牌組相比，最高唯一卡號 Jaccard 相似度為 #1164 的 7/37（18.92%），其次 #921 為 3/40（7.50%）、#1268 為 1/41（2.44%）；其餘皆無重疊。

將 #1248 加入 AI 選單、牌組建立流程與 Lv.5 benchmark。26 個選項在桌機 1366×768 與平板 1164×777 共 52/52 Browser PASS，沒有頁面錯誤；兩種尺寸都完成 #1248 開局，問題包及牌庫確認為來源的 60 張主牌與 6 張 EXTRA。定向 Vitest 4 檔／91 項、production build（2,204 modules）、全域 lint、兩支 Browser 驗證腳本 `node --check` 通過。

以 26 副牌組、351 組配對（含每副牌組的鏡像賽）、兩個 seeds、每組四種座位／先手交換執行 Lv.5 matched AI-vs-AI，共 2,808 場；702 項初始預檢、2,808 項逐局 parity 全通過，全部完成且失敗、未完成及動作上限皆為 0。候選 1,416 勝、基準 1,392 勝（50.43%）。排除 #1248 的 8 場鏡像賽後，候選策略使用 #1248 為 77/100 勝，凍結基準策略為 75/100 勝。候選與基準共用規則／資料 hash `fb417f449d44cf5ea86e56461bc265d4830268b4509dabd2ad306cadb0179156`；基準 policy ref 為 `1051a94b0b88ed6686d9c8e496f7fff14f50ed0f`，manifest 仍標記 `PROTOTYPE-EQUIVALENCE-NOT-YET-VERIFIED`。這是兩個固定 seeds 的 AI-vs-AI 描述性結果，未作顯著性檢定，不代表真人勝率或普遍策略提升。

完整 benchmark：`output/ai-cookierift/matched-comparison-lv5-community-1248-shared-corrections-seed-204500000-20261016.json`；Browser 結果：`output/ai-cookierift/community-browser-20261016-current-menu-1248/results.json`。

本批牌組整合後執行 `npm.cmd test -- --maxWorkers=1`（TEMP/TMP 指向 `.tmp-vitest-cookierift-1248-full-final-20261016`）：完整 Vitest 1,054/1,054 檔、21,097/21,097 項通過，耗時 1,523.80 秒，exit 0。

## 2026-10-16 Cookierift #1268 綠藍牌組與近重複隔離

從 [Cookierift 社群牌組 #1268](https://cookierift.com/decks/community/1268) 擷取合法的「Wa green」牌表（作者 55Hz，頁面更新於 2026-10-15，60 張主牌、4 張 EXTRA），依公開牌面卡號與張數匯入，未替換卡牌。來源快照位於 `data/decks/cookierift-community-20261016.json`，牌組來源 hash 為 `sha256:004f291c3bf8c108e24132ad47bf57c58ef4a1038828b54ed987fa7c8e09611e`，包含21種卡號。逐卡嚴格契約稽核涵蓋21個卡號的全部印刷版本，均為 verified，沒有 needs-review 或 blocked。

與既有社群牌組比較唯一卡號集合，#1268 的最高 Jaccard 相似度是 #801 的 8/39（20.51%），其次是 #927 的 7/38（18.42%）；因此將它加入正式 AI 牌組、建立流程與 Lv.5 benchmark。新擷取的紅藍牌 #1272 則有21種卡號，與已收錄紅牌 #83 共用20種，Jaccard 為20/22（90.91%），保留在來源快照但不列入正式選單或 benchmark，並以測試固定此近重複隔離理由。

正式選單25副牌組在桌機1366×768與平板1164×777共50/50 Browser PASS。兩尺寸都完成 #1268 開局，確認選取摘要正確、主牌60張、EXTRA 4張且牌號／張數與來源相符；沒有頁面錯誤。定向 Vitest 4檔／96項、production build（2,204 modules）、受影響檔 ESLint、兩支驗證腳本 `node --check` 及 `git diff --check` 通過。

Lv.5 matched AI-vs-AI 矩陣包含25副牌組、325組配對、兩個 seeds 與四種座位／先手交換，共2,600場；650項初始預檢與2,600項逐局 parity 全通過，2,600場完成，失敗、未完成及動作上限皆為0。候選1,319勝、基準1,281勝（50.73%）；#1268 候選端39/104勝、基準端30/104勝。基準政策固定於 `1051a94b0b88ed6686d9c8e496f7fff14c50ed0f`，共同使用已驗證的合法性、defender-FLIP 與 HP 支付目標安全修補；兩側規則／資料 hash 均為 `c22b0dfc20f74861f1755bcfccc122046f6a4016cd5ad23a4535f1801bdafce0`。基準 manifest 仍標記 `PROTOTYPE-EQUIVALENCE-NOT-YET-VERIFIED`；這是兩個固定 seeds 的 AI-vs-AI 方向性結果，沒有顯著性檢定，不能推論真人勝率或普遍策略提升。

完整矩陣報告：`output/ai-cookierift/matched-comparison-lv5-community-1268-shared-corrections-seed-204300000-20261016.json`；基準 manifest：`output/ai-cookierift/baseline-policy-current-rules-nestedflip-hp-cost-target-correction-community-1268-20261016-manifest.json`；Browser 結果：`output/ai-cookierift/community-browser-20261016-current-menu-1268/results.json`。

#1268 加入正式選單、#1272 近重複隔離與選單期望修正後，完整 Vitest 為 1,054 檔／21,094 項全數通過（1,447.63 秒，exit 0）。

再以不重疊 seed base `204400000` 跑相同的 Lv.5 matched 矩陣：25 副牌組、325 組配對、兩個 seeds、四種座位／先手交換，共 2,600 場；650 項初始預檢及 2,600 項逐局 parity 全通過，失敗、未完成及動作上限皆為 0。候選 1,314 勝、基準 1,286 勝（50.54%）。候選側各色結果為藍124/312、綠124/416、黃238/416、紅340/624、紫149/312、黑293/416、多色46/104；候選與基準規則／資料 hash 同為 `c22b0dfc20f74861f1755bcfccc122046f6a4016cd5ad23a4535f1801bdafce0`。與前一個 seed cohort 合併是候選 2,633 勝、基準 2,567 勝／5,200 場（50.63%）。這仍只是兩個固定 AI-vs-AI 矩陣的描述性結果，未作顯著性檢定，也不能推論真人勝率或普遍策略提升。

第二份報告：`output/ai-cookierift/matched-comparison-lv5-community-1268-shared-corrections-seed-204400000-20261016.json`；基準 bundle SHA-256 `f693e43c4c56b9ea22c80755e81fad2b4225063de3cbdd7657e95d1f3e6a8aa4`，候選 bundle SHA-256 `c841bd96c391e99143a134194560d4127286ddad1ca6a6cf22d501c31804ea3b`，同一基準 manifest 仍標記 `PROTOTYPE-EQUIVALENCE-NOT-YET-VERIFIED`。

## 2026-10-16 Cookierift #1251 六色牌組評估

從 [Cookierift 社群牌組 #1251](https://cookierift.com/decks/community/1251) 擷取合法的「I love Cookiez!!!」牌表（KawaiiXO，2026-10-14 更新，60 張主牌、6 張 EXTRA）；頁面當時顯示 0 次匯入、尚無評分。依卡片圖片 URL 讀取33個不同卡號、依張數標籤讀取數量，來源 hash 為 `sha256:30140940794b017e6a247f85e2b7d8d0e2109e80822a60add4ca4df9f4776269`，來源快照保留在 `data/decks/cookierift-community-20261016.json`。33張均可由正式 BS12 資料轉接，行為契約為33/33 verified。

以暫時加入的選單整合驗證牌組建立、開局摘要、問題包 ID、主牌／EXTRA 清單及牌圖；25副牌組在桌機1366×768與平板1164×777共50/50 PASS。再以25副牌組、325組配對、兩個 seeds、四種座位／先手交換跑Lv.5 matched AI-vs-AI，共2,600場；650項初始預檢、2,600項Parity全通過，2,600場完成，失敗、未完成及動作上限皆為0。候選1,306勝、基準1,294勝（50.23%），四種座位／先手交換與新資料 hash 一致；基準 manifest 仍標記 `PROTOTYPE-EQUIVALENCE-NOT-YET-VERIFIED`，沒有顯著性檢定，不代表真人勝率或策略普遍提升。

更直接的配方評估中，候選與基準政策各自操作 #1251 均為7/104勝（6.7%）。由於來源尚無匯入紀錄，且此固定矩陣顯示它是目前社群清單中的低勝率對手，故保留原始來源及完整 benchmark 作評估資料，但不加入可選 AI 牌組，避免把未見競技採用且明顯偏弱的六色牌組當成 AI 強度素材。最後的正式選單仍只有六個單色類別。

移出正式選單後的定向回歸4檔／93項通過，涵蓋完整來源 hash 與不列入可選牌組的隔離斷言；build（2,204 modules）與 card-pool registry check 通過。最終選單24個牌組在桌機1366×768／平板1164×777共48/48 Browser PASS，沒有頁面錯誤；#1251 不在最終選單問題包或實際 AI 牌庫中。完整單元回歸另以最終 #1259 狀態執行1,054檔／21,089項全通過（1,495.49秒、exit0）。

完整 benchmark：`output/ai-cookierift/matched-comparison-lv5-community-sixcolor-1251-shared-corrections-seed-204200000-20261016.json`；baseline manifest：`output/ai-cookierift/baseline-policy-current-rules-nestedflip-hp-cost-target-correction-sixcolor-20261016-manifest.json`；暫時整合的 Browser 結果：`output/ai-cookierift/community-browser-20261016-six-color-1251/results.json`。

## 2026-10-16 Cookierift #1259 紅牌與 Lv.5 matched holdout

從 [Cookierift 社群牌組 #1259](https://cookierift.com/decks/community/1259) 匯入合法的「Flames of Immortality」純紅牌組（60 張主牌、無 EXTRA；作者 Crest_Strikard，頁面更新於 2026-10-14）。逐張依公開頁面按鈕圖片 URL 讀取卡號、依張數標籤讀取數量，未替換卡牌。快照位於 `data/decks/cookierift-community-20261016.json`，該牌組來源 SHA-256 為 `d81103b48f95738caf8d79c39412ef64d43d0d3313361db1e18d78bfdece3e8d`。其 16 種卡號與其他已接受紅牌構築差異明顯：與 #83、#731、#1120 沒有共同卡號，與 #793 只有一種重疊。

將 #1259 加入可選社群牌組、牌組建立與 Lv.5 benchmark 清單；空白 EXTRA 欄位解析為空牌組。build 通過；選單 Browser 驗證 23 副牌組、桌機 1366×768 與平板 1164×777 共 46/46 PASS，確認選項、開局流程、牌圖／張數及問題包牌組 ID。另以本機瀏覽器手動完成 #1259 開局至首回合棋盤。該驗證是選單與開局，不代表完整對局或線上同步。

第一份 matched 報告保留為 FAIL：候選 2,208 場中有 2 場基準策略在 Lv.5 自損後又選同一張已昏厥餅乾作補 HP 目標，送出無效命令。該流程的固定回歸已確認候選 AI 會避開昏厥來源；為公平比較，重建與候選共用這項已驗證目標安全修補、巢狀 FLIP 與共用合法性修補的凍結基準，使用同一規則／資料 hash `8537af552c2ad053b086d3fe8cea90d50355cf4ceccb0f0c51af34e6a00f07a3` 重跑。23 副牌組、276 組配對、兩個 seeds 與四種座位／先手交換共 2,208 場；552 項預檢、2,208 項 parity 全通過，2,208 場完成，失敗、未完成及動作上限皆為 0。候選 1,103 勝、基準 1,105 勝（候選 49.95%）。

| 顏色 | 場次 | 候選勝 | 基準勝 |
|---|---:|---:|---:|
| 藍 | 288 | 103 | 103 |
| 綠 | 384 | 119 | 118 |
| 黃 | 384 | 211 | 214 |
| 紅 | 576 | 317 | 314 |
| 紫 | 288 | 143 | 143 |
| 黑 | 288 | 210 | 213 |

這只是兩個 seeds 的 AI-vs-AI 固定矩陣，基準 manifest 仍標為 `PROTOTYPE-EQUIVALENCE-NOT-YET-VERIFIED`；小幅勝場差不具顯著性，也不能推論人類勝率或各色策略全面變強。失敗原始報告保留於 `output/ai-cookierift/matched-comparison-lv5-community-1259-seed-204100000-20261016.json`；共用修補後報告為 `output/ai-cookierift/matched-comparison-lv5-community-1259-shared-hpcost-seed-204100000-20261016.json`。

同日查看最新社群清單時，也核對了 [#1260 Blue Arena](https://cookierift.com/decks/community/1260) 與 [#1270 repeat the cycle ahh deck](https://cookierift.com/decks/community/1270) 的牌面卡號。前者含 P-178×3，後者含 P-180×4；兩張促銷卡都不在 `data/cards/` 或 `data/candidates/`，因此這些原牌表（含已盤點的 #1273）保留為缺卡隔離，不加入選單或 benchmark，也不替換卡牌。這次加入 #1259 提高了已驗證牌組多樣性，但最新純黑牌表尚受 P-180 缺卡阻擋；AI 強度與對真人勝率仍需更多獨立矩陣與實戰證據。

## 2026-10-16 六色牌組 Lv.3 matched holdout

以 22 副牌組、253 組配對、兩個 seeds 與四種先手／座位交換執行 2,024 場 Lv.3 AI-vs-AI 比較。初次使用未共用攻擊合法性修補的凍結基準時，有兩局因基準端在空手牌下嘗試支付攻擊棄牌而失敗；固定 seed 重播顯示候選端在相同狀態會推進階段，兩個候選換座對局也完成。該次 FAIL 報告不納入勝場比較。

重新凍結 HEAD 策略，並讓基準共用已驗證的攻擊目標列舉與手牌棄牌合法性，再以同一規則／資料雜湊 `b5fafb9fd89f8e98bf0afc79c02c37f2fa1e55c2d2963ae2e41f94ef5c45cc7a` 重跑。506 組初始預檢及 2,024 場逐局 parity 全通過；2,024 場全部完成，失敗、未完成與 500 動作上限皆為 0。候選 1,024 勝、基準 1,000 勝（候選 50.59%）。

| 顏色 | 場次 | 候選勝 | 基準勝 |
|---|---:|---:|---:|
| 藍 | 276 | 119 | 118 |
| 綠 | 368 | 99 | 103 |
| 黃 | 368 | 211 | 205 |
| 紅 | 460 | 276 | 262 |
| 紫 | 276 | 123 | 121 |
| 黑 | 276 | 196 | 191 |

這是兩個 seeds 的固定 AI-vs-AI 矩陣，未作顯著性檢定；基準 manifest 仍標記 `PROTOTYPE-EQUIVALENCE-NOT-YET-VERIFIED`。24 勝差不代表人類勝率，也不能歸因於綠牌支援成本修正或證明各色策略全面提升。

有效報告：`output/ai-cookierift/matched-comparison-lv3-sharedlegality-seed-203900000-20261016.json`；基準建置與 manifest：`output/ai-cookierift/build-policy-baseline-current-rules-silent1151-lv3-sharedlegality-203900000.mjs`、`output/ai-cookierift/baseline-policy-current-rules-silent1151-lv3-sharedlegality-203900000-manifest.json`。初次未共用合法性基準的失敗報告保留於 `output/ai-cookierift/matched-comparison-lv3-seed-203900000-20261016.json`；失敗與交換座位重播細節：`output/ai-cookierift/replay-lv3-1164-failures-20261016.json`。

## 2026-10-16 Lv.3 綠牌可公開擊倒優先於續接估值

固定重播 `cookierift-921` 對 `cookierift-927`、seed `203970800`、先手 player-one、候選綠牌 player-two，在第 8 回合主要階段重現了不合理選擇：Mystic Flour（BS8-059）打 Ice Pop（BS12-071）的非致命攻擊，因支援費用後續技能估值 166 加上 tactical payoff 36，評分 373；Choco Drizzle（BS7-059）可公開擊倒同一目標，評分 331。原候選分支最終落敗；同一局面強制採用擊倒攻擊的反事實分支獲勝。

現在 Lv.3 會以同一候選集中的最高公開致命攻擊分數，限制非致命攻擊的 `support-cost-followup` 加分；只扣除會讓非致命攻擊超過致命替代動作的部分，其他估值及攻擊後正式回應流程保留。以重播局面製作固定回歸後，測試確認 AI 選擇 Choco Drizzle 擊倒。以修正後原始 TypeScript 建立的候選引擎重播同 seed，player-two（綠牌候選）完成勝局。原 fixture 測試在修正前因選到 BS8-059 而失敗，修正後通過；原 BS12 綠牌支援費用順序及六個既有社群固定 seed 也同批回歸。

定向 Vitest 3 檔／18 項、完整 Vitest 1,054 檔／21,081 項（1,356.14 秒）、production build（2,204 modules）、兩個變更 TS 檔的 ESLint 均通過；build 保留既有大型 chunk 警告。修正後以凍結候選政策及共用已驗證合法性修補的基準政策，使用同一規則／資料 hash `b5fafb9fd89f8e98bf0afc79c02c37f2fa1e55c2d2963ae2e41f94ef5c45cc7a`，完成 22 副牌組、253 組配對、兩個 seeds 與四種先手／座位交換，共 2,024 場 Lv.3 matched 比較；506 項初始預檢及 2,024 項逐局 parity 全通過，沒有失敗、未完成或動作上限。候選 1,025 勝、基準 999 勝（候選 50.64%）。

| 顏色 | 場次 | 候選勝 | 基準勝 |
|---|---:|---:|---:|
| 藍 | 276 | 119 | 116 |
| 綠 | 368 | 100 | 104 |
| 黃 | 368 | 211 | 205 |
| 紅 | 460 | 276 | 261 |
| 紫 | 276 | 123 | 122 |
| 黑 | 276 | 196 | 191 |

以未重疊 seed base `203910000` 再跑同一 22 副牌組矩陣：506 項初始預檢、2,024 項逐局 parity 全通過，2,024 場完成且沒有失敗、未完成或動作上限。候選 1,016 勝、基準 1,008 勝（50.20%）。

| 顏色（候選側牌組） | 場次 | 候選勝 | 基準勝 |
|---|---:|---:|---:|
| 藍 | 276 | 120 | 119 |
| 綠 | 368 | 104 | 108 |
| 黃 | 368 | 193 | 189 |
| 紅 | 460 | 264 | 263 |
| 紫 | 276 | 130 | 126 |
| 黑 | 276 | 205 | 203 |

兩組修正後 cohort 合計 4,048 場，候選 2,041 勝、基準 2,007 勝（50.42%，淨差 34 勝）；依候選側牌組顏色合計為藍239／235、綠204／212、黃404／394、紅540／524、紫253／248、黑401／394。仍只有四個固定 seeds，沒有顯著性檢定；這是方向性 AI-vs-AI 證據，不代表人類勝率或綠牌已改善。第二份報告：`output/ai-cookierift/matched-comparison-lv3-public-lethal-seed-203910000-20261016.json`。兩份候選 bundle SHA-256 均為 `0a04a9732b93ac2fff77a6b2931586cc318a4eb4f4292d68b73702921ab50805`，基準均為 `2342ee6a05e09dd9981cbbe8f8093116396d0aef25972f04dd4753c009ec8553`。

只看 seed base `203900000` 與修正前同 seed 報告逐局比對，有 5 場結果翻轉：3 場由基準勝轉為候選勝，2 場反向，淨增加 1 場候選勝；該 cohort 的綠色候選側為 100 比 104。這確認特定公開擊倒回歸局已修正，但四個固定 seeds 合併仍只有小幅勝差，不能據此宣稱 AI 或綠牌勝率有廣泛提升。基準 manifest 仍標記 `PROTOTYPE-EQUIVALENCE-NOT-YET-VERIFIED`；修正後全域 lint 與 Browser 尚未重跑。修正後報告：`output/ai-cookierift/matched-comparison-lv3-public-lethal-seed-203900000-20261016.json`（基準 bundle SHA-256 `2342ee6a05e09dd9981cbbe8f8093116396d0aef25972f04dd4753c009ec8553`；候選 bundle SHA-256 `0a04a9732b93ac2fff77a6b2931586cc318a4eb4f4292d68b73702921ab50805`）。修正前同 seed 報告：`output/ai-cookierift/matched-comparison-lv3-sharedlegality-seed-203900000-20261016.json`。決策 fixture：`src/game/ai/fixtures/public-lethal-over-followup-203970800.json`；重播摘要：`output/ai-cookierift/support-priority-review-20261015/replay-public-lethal-current-lv3-candidate-cookierift-921-vs-cookierift-927-seed-203970800-first-player-one-candidate-player-two.json`。

## 2026-10-16 Cookierift #1151 紫色 Silent 牌組

從 [Cookierift 社群牌組 #1151](https://cookierift.com/decks/community/1151) 重新核對合法的「Silent」牌表；作者 Yen，頁面更新於 2026-10-11，主牌 60 張、EXTRA 6 張。逐卡來源清單共 22 種主牌與 2 種 EXTRA；正式卡池的 24 個卡號皆為紫色，組成以 Silent Salt、牌庫干涉與 Catacombs of Silence 為主的紫色 mill 牌組，沒有換牌。

新增獨立來源快照 `data/decks/cookierift-community-20261016-silent.json`（檔案 SHA-256 `b7539a279f7812012c0f53808e5f6a956041c1d0125b599c09b42b295ecdb521`；來源欄位 hash `sha256:6611ce972ad1a8fad51087025334b137c657cb5a0f947d379ec1ff1b300711b6`），接入正式牌組建立、AI 選單與 benchmark。牌組／選單／固定 seed 回歸 3 檔 47 項、production build（2,204 modules）、變更檔 ESLint、Node 語法檢查與 `git diff --check` 通過。Browser 覆蓋 22 個選項 × 桌機 1366×768／平板 1164×777，共 44/44 PASS；問題回報包與實際 60+6 張牌庫逐卡一致。

以 HEAD 凍結 AI 政策、目前規則與資料重建 baseline；manifest 仍標為 `PROTOTYPE-EQUIVALENCE-NOT-YET-VERIFIED`。seed base `203800000` 下 22 副牌組、253 組配對、2 個 seeds、4 次座位／先手交換共 2,024 局；506 項初始預檢及 2,024 項逐局 parity 通過。2,021 局完成，另 3 局由凍結基準端決策失敗、沒有 action-cap；候選 1,008 勝、基準 1,013 勝，因此整份 benchmark **FAIL**，不宣稱 AI 勝率提升。三個失敗（#801 對 #1239、#568 對 #793、#1164 內戰）重播均定位到 baseline actor，換候選座位後同 seed 完成；現行 AI 固定 seed 回歸 6/6 通過。涉及 #1151 的 176 局全部完成：候選操作 Silent 的 84 局中該側 29 勝；基準操作 Silent 的 84 局中該側也 29 勝，另 8 局 Silent 鏡像為 4 比 4。這顯示在此固定矩陣下兩政策對 Silent 表現一致，牌組本身勝場偏低；不代表人類對戰勝率。

完整 benchmark：`output/ai-cookierift/matched-comparison-20261015T195124093Z-29756-a458ddf4.json`；基準失敗交換座位重播：`output/ai-cookierift/replay-silent1151-failures-20261016.json`；Browser 結果：`output/ai-cookierift/community-browser-20261016-silent1151/results.json`。

## 2026-10-16 Cookierift #1239 黃色補 HP 牌組

從 [Cookierift 社群牌組 #1239](https://cookierift.com/decks/community/1239) 讀取合法的「Kawaii's Ol' Reliable Yellow」牌表；頁面列 60 張主牌與 6 張 EXTRA，逐張詳情確認共 22 個主牌卡號及 3 個 EXTRA 卡號。牌組以補 HP 串接 Pavlova／Wedding Cake 等自損與補血、Cream Ferret 增傷、Sugarfly 抽牌，再搭配藤蔓陷阱降低攻擊傷害。原始清單未替換卡牌，alternate-art 後綴正規化為正式卡號。

加入 `data/decks/cookierift-community-20261016.json`（檔案 SHA-256 `37a540c0f04a2f562f5661cc850a9cb55cc021ea400c1b367206403437f056cc`；來源欄位 hash `sha256:8a4ede8796899338307858649d2a43bf708f01928a363507512f144b401b3da0`）、正式卡池牌組建立、AI 對手選單與 benchmark recipe 清單。合併重跑牌組／選單／固定 seed 回歸 3 檔 42 項通過；build（2,203 modules）、變更檔 ESLint 與 `git diff --check` 通過。AI 選單 Browser 覆蓋 21 個牌組選項 × 桌機 1366×768／平板 1164×777，共 42/42 PASS；#1239 的開局設定及問題包實際牌庫均與來源張數相符。

以同一 seed base `203700000` 跑 21 副牌組、231 組配對、1,848 場 matched Lv.5 AI-vs-AI。462 項初始預檢及 1,848 項逐局初始狀態 parity 通過；只有 1,845 場完成，3 場由 Git 基準政策端在決策時失敗（1 場對 #1239 的 Pavlova 攻擊後續效果送出無效命令；2 場攻擊未支付兩張手牌）。因此整份 benchmark **FAIL**，不將勝率作為驗收；已完成場次為候選 922 勝、基準 923 勝。三個相同 seed／先手／座位的交換重播均顯示錯誤發生在基準端；候選版對應局完成。另新增三個固定 seed 自我對戰回歸，3/3 完成、沒有非法動作。基準 manifest 的狀態仍是 `PROTOTYPE-EQUIVALENCE-NOT-YET-VERIFIED`，本次數字僅描述此固定矩陣，不能代表人類勝率或證明策略全面提升。

完整 benchmark：`output/ai-cookierift/matched-comparison-20261015T191414337Z-27776-79702188.json`；基準端失敗重播：`output/ai-cookierift/replay-failure-s3-green-vs-1239-seed-203712000-20261016.json`、`output/ai-cookierift/replay-failures-attack-discard-20261016.json`。瀏覽器結果：`output/ai-cookierift/community-browser-20261016/results.json`。

## 2026-10-16 Cookierift #1164 與 AI 合法性回歸

加入 Cookierift #1164「sky blue」藍色牌表（60 張主牌、6 張 EXTRA）至社群牌表登錄與 AI 對手選單；來源快照為 `data/decks/cookierift-community-20261015.json`，檔案 SHA-256 `35eb851bd03c037ed2141ae110f26432f8bd6bb9322ecaf9873a743bdcc38017`。牌組選單單元測試確認該選項可選，牌表測試確認每張卡可由正式卡池建立。

修正兩個共享 AI 合法性缺口：來源限定的手牌轉 HP 效果在來源 Cookie 離開戰鬥區後不再產生隱藏手牌候選，避免可選效果送出無效目標；攻擊命令列舉與低階 AI 備援共用正式攻擊棄牌需求，手牌不足以支付對手被動或目標要求時不宣告攻擊。GPT-6.1 Sol 唯讀審查未發現 P0–P2，並指出被動與目標棄牌需求的合併路徑缺少直接測試；新增實卡 BS8-084 被動 1 張＋目標效果棄牌標記 2 張的回歸，2 張手牌時不列攻擊且 Lv.1～5 不會硬攻，3 張時指令要求棄 3 張。

以 20 副牌組、210 組配對、420 項初始預檢與逐局初始狀態比對進行 1,680 場 matched AI-vs-AI holdout；候選與基準各完成 1,680 場，失敗、未完成及動作上限均為 0。候選 842 勝、基準 838 勝；樣本差距很小，不代表人類勝率或已證明各色策略改善。候選／基準分色勝場如下：

| 顏色 | 場次 | 候選勝 | 基準勝 |
|---|---:|---:|---:|
| 藍 | 252 | 94 | 94 |
| 綠 | 336 | 106 | 104 |
| 黃 | 252 | 141 | 146 |
| 紅 | 420 | 241 | 242 |
| 紫 | 168 | 80 | 81 |
| 黑 | 252 | 180 | 171 |

其中 #1164 為 84 場、候選與基準各 37 勝；不能把新牌表加入或這批合法性修補歸因成勝率提升。基準使用目前規則與共用合法性函式，manifest 仍標記 `PROTOTYPE-EQUIVALENCE-NOT-YET-VERIFIED`，配對結果僅作方向性證據。原始報告：`output/ai-cookierift/matched-comparison-cookierift1164-shared-legality-203700000-20261016.json`。

定向 Vitest 6 檔／96 項、production build（2,202 modules）及本批 scoped ESLint 通過；補上組合棄牌測試後，`legal-actions.test.ts` 16／16 與 ESLint 再通過。完整 Vitest 1,052 檔／21,064 項、1,369.29 秒、exit 0 是新增單一測試前的結果，新增後未重跑全套。全域 `npm.cmd run lint` 掃描逾九分鐘仍無輸出，已停止，故全域 lint 未驗證；主選單為單元測試驗收，未另跑 Browser。

## 2026-10-16 綠色支援成本與攻擊順序

同一個 BS12 綠牌固定重播在不同 AI 等級呈現兩種資源排序問題：Lv.4 原先先啟動 BS8-059，將兩張疲勞支援移回手牌後只剩一張疲勞支援，錯過原本可支付的攻擊；Lv.3 則把三張支援全付給 BS7-046 攻擊，放棄「BS8-059 兩張支援攻擊，再用剩下一張支付其 Activate」的路線。Lv.5 原本已先攻擊。原因是 `supportCostFollowup` 只套用在 Lv.5 的雙層搜尋，Lv.3 評分也沒有把這種後續能力納入攻擊候選。

Lv.4／5 現在都使用受限續接預測；Lv.3 的根候選攻擊也加入相同估值。預測只計算已知支援／手牌成本與簡單公開 HP 效果，不猜抽牌或未建模條件，也不改變遊戲狀態。三個等級都先以兩張支援宣告 BS8-059 攻擊，再由正式流程結算陷阱、傷害及可能的 FLIP，最後才支付 Activate 能量並將疲勞支援移回手牌。回歸曾重現 Lv.4 先 `activate-skill` 及 Lv.3 選錯三能量攻擊；修正後測試確認攻擊、支付能力與隱藏資訊不變性。

固定資料 `src/game/ai/fixtures/bs12-green-support-cost-replay.json` 與回歸 `src/game/ai/support-cost-sequencing.test.ts`。定向 Vitest 4 檔／49 項、完整 Vitest 1,053 檔／21,080 項（1,354.60 秒）、production build（2,204 modules）、受影響檔 ESLint 與 `git diff --check` 通過。既有 AI Browser 的 6 項開局／手牌檢視／暫停流程檢查也通過，但未操作這個綠牌重播。尚未跑 Lv.3／4 matched holdout 或全域 lint；這是單一固定綠牌重播的決策修正，不代表整體或人類勝率已提升。

同日另查 #973 綠牌對 BS12 黃色 Arena、seed `203921600` 的分支敏感度：候選在第 7 回合先以 Mystic Flour 攻擊再啟動，分數 280；凍結基準在相同公開局面先啟動，分數 166。直接反轉雙方牌庫、手牌及覆蓋 HP 順序後，候選仍選同一攻擊且分數不變，未讀取這些隱藏順序。兩條路線後續分別讓候選敗／勝，但攻擊路線多揭露了對手替補 Cookie 與後續 HP；單一 seed 無法證明先啟動的期望值較高，也不能推翻支援成本續接的 matched 結果，因此不加入強迫先啟動的 seed 專用評分規則。重播與逐命令軌跡保留於 `output/ai-cookierift/support-priority-review-20261015/`。

## 2026-10-16 巢狀 FLIP 對戰停滯修正

seedBase `203920000` 的 2,024 場 Lv.3 matched run 有 2,022 場完成，另 2 場在同一組 `cookierift-1035` 黃牌與 `cookierift-973` 綠牌、seed `204061601` 產生 decision error；這組報告不作勝負或勝率證據。用目前候選 AI 單獨重播同 seed 也在第 200 個決策停住：第 17 回合防守方翻開需棄 1 張手牌的 ST8-007 Blue Slushy Cookie 時，攻擊者 Yoga Cookie 的 FLIP 延遲效果仍在佇列。`getActingPlayerId` 已把當前 FLIP 交給防守方，但 `handleAiPendingDecision` 先回傳「等待 imortal 處理卡牌效果」，遮住後續 battle handler。

修正是在不同玩家持有的延遲效果旁，若目前 `attack-effect` 攻擊者或 `flip` 防守方正持有戰鬥步驟，就交還給 battle handler 先結算；原效果持有者仍會在戰鬥步驟完成後續接。新增的完整固定 seed 回歸在修正前重現停滯、修正後對局完成；既有 nested-FLIP continuation 與六個社群牌組失敗 seed 也一併驗證。定向 Vitest 2 檔／17 項、production build（2,204 modules）、兩個變更檔 ESLint 與 `git diff --check` 通過。Build 保留既有大 chunk 與 plugin timing 警告。

原始 seedBase `203920000` 報告仍為 FAIL 並保留，不納入勝場。為重跑同一 cohort，從 HEAD 凍結舊 AI 策略，基準只共享已驗證的攻擊合法性來源，並對 `pending-handler.ts` 套用單一 defender-FLIP 派工修正；來源與雜湊記在基準 manifest，該 manifest 仍標示 `PROTOTYPE-EQUIVALENCE-NOT-YET-VERIFIED`。新 matched 報告 `output/ai-cookierift/matched-comparison-lv3-nestedflip-shared-correctness-seed-203920000-20261016.json` 通過 506 項初始預檢及 2,024 項逐局 parity，2,024 場全數完成，失敗／未完成／動作上限皆為 0。候選 1,016 勝、基準 1,008 勝（50.20%）；綠牌 368 場為 108／102。這是單一兩 seeds 的 AI-vs-AI 矩陣，未作顯著性檢定，不代表人類勝率，也不足以單獨證明整體牌組改善。建置腳本與基準 manifest 為 `output/ai-cookierift/build-policy-baseline-current-rules-nestedflip-shared-correctness-203920000-20261016.mjs`、`output/ai-cookierift/baseline-policy-current-rules-nestedflip-shared-correctness-203920000-20261016-manifest.json`。

## 2026-10-15 六色牌組 Lv.5 matched holdout

以目前候選 AI 與政策基準對 19 副牌組進行兩組獨立 matched run：每組 seedBase 203100000／203200000、190 組配對、2 個 seeds、4 次座位與先手交換，共 1,520 局；合計 3,040 局，兩組沒有重複局。每組 380 項初始牌組預檢與 1,520 項逐局 parity 全通過，沒有失敗、未完成或超過 500 動作上限。候選共 1,539 勝、基準 1,501 勝，候選為 50.63%。牌組包含 12 副 Cookierift 社群牌表（藍、綠、黃、紅、紫、黑六色）與 7 副 BS12 參照牌表；全部使用 Lv.5 policy、共同種子與確定性搜尋時鐘。

| 候選牌組顏色 | 場次 | 候選勝 | 基準勝 |
|---|---:|---:|---:|
| 藍 | 320 | 121 | 121 |
| 綠 | 640 | 191 | 191 |
| 黃 | 480 | 278 | 270 |
| 紅 | 800 | 439 | 436 |
| 紫 | 320 | 171 | 164 |
| 黑 | 480 | 339 | 319 |

兩份報告使用同一候選 policy hash `0aafce2688ca906550e6925b172dd8c1a0ffb52d21ef39a12dcd225c8d04fb3c` 與 bundle SHA-256 `2549c34d3433d714983aeb571ed3fd94963790a4379e7143a165b5cb3a8e31ca`；基準 policy 為 `1051a94b0b88ed6686d9c8e496f7fff14c50ed0f`，基準 bundle SHA-256 `def045d3765874d218f60388384a8af5715f0fbad45af7375319b327095339a4`。342 個來源輸入中 48 個為 policy、294 個為規則／資料；後者 SHA-256 與基準完全相同，11 個牌組來源快照及兩個 bundle hash 也逐一核對通過。這是目前策略與基準在固定 AI-vs-AI 矩陣下的小幅方向性差異，未作顯著性檢定，不能推論人類勝率，也不能歸因到某一項近期修補。報告：`output/ai-cookierift/matched-comparison-cookierift-ai-holdout-203100000-20261015.json`、`output/ai-cookierift/matched-comparison-cookierift-ai-holdout-203200000-20261015.json`。

以最新正式卡池重新產生的能力盤點為 1,640 張唯一 runtime 卡、4,232 項能力、20 張保守標記卡，沒有轉換失敗；BS11-092 已不在 unsupported 清單。12 副社群牌表中，剩餘盤點缺口只出現在紅色 Cookierift-83／Cookierift-731 的 BS12-014／015；既有 `src/game/ai/strategy/readying-payoff-decision.test.ts` 已用這兩張實卡驗證 Lv.5 會部署 Arena 同伴以解除下回合待機限制，因此不把這份保守能力標記當成已重現的決策缺陷。最新盤點：`output/ai-cookierift/ai-capabilities-20261015-post-ai-fix.json`。

## 2026-10-15 Lv.3 黑色牌組連動決策補強

以實際 Cookierift-506 牌表與正式卡面建立決策重現：BS11-092 Licorice 可免費將自身 LV.2 降至 LV.1，讓手中的 BS11-113 Venom Dough 滿足特殊登場費用；其登場時手牌不超過 5 張還可抽牌。舊 Lv.3 會直接推進階段，錯過免費降級與後續特殊登場；Lv.4／5 原本已能完成這條序列。

修正回合評分：技能前後比對合法指令，只為新出現且有正增益的語意行動加分，避免同一攻擊因可支付支援卡換了 instance ID 而被重複計分。能力抽取器也將 set-cookie-level 歸為 control，正式 BS11-092 不再承受 unsupported 效果的 -8 罰分，全卡池能力測試同步移除此誤報。GPT-6.1 Sol 首輪指出重複計分風險；修正行動身分鍵後複核未見阻擋問題。此次 set-cookie-level 能力分類的唯讀複核也未發現具體 P0–P2。使用官方牌組來源的回歸確認 Lv.3 會降級、特殊登場並續接抽牌；同一攻擊不同付款者不再取得虛假的後續加分。

定向 Vitest 4 檔／49 項、受影響 ESLint、build（2,202 modules）、全域 lint 與完整 Vitest 1,052 檔／21,055 項（1,446.65 秒、exit 0）通過；標準 AI Browser 6／6 通過一般 UI 流程，並非這條連動的逐步 Browser 驗收。沒有以 Lv.3 專屬 matched benchmark 隔離評估此修補；上方 holdout 是 Lv.5 整體策略比較，不據此主張此項修補或整體政策已提升人類勝率。


## 2026-10-15 公開條件不成立時略過無效陷阱

正式 AI 的陷阱候選層加入窄範圍守衛：Lv.1～5 都會略過已知必定 no-op 的陷阱；條件限於純能量費用、沒有替代或條件費用，且所有根效果都是依公開戰鬥區顏色見證判斷的 `modify-attack`。R7（Lv.3+）評分也把這類陷阱視為 0；Lv.1／2 則由共用候選篩選略過，其他簡化策略不變。混合根效果、其他代價及替代／條件費用不套用這個守衛。

以原始 BS12-105 及合法 60 張局面建立 6 種見證情境，跨 Lv.1～5 共 30 案，另測隱藏牌序置換及「無效 BS12-105 在前、有效 ST8-018 在後」的 Lv.1／2 兩案。原 R7 19 案基線有 13 案付費發動無效陷阱；目前擴充後的 33 項針對測試全通過，包含正確黑色 Arena 與疲勞見證仍可發動，以及無效候選後續仍選有效陷阱。GPT-6.1 Sol 規格複核未發現產品缺陷；複合效果／其他費用仍是未覆蓋的守衛邊界。

修補後完整 Vitest 1,050 檔／21,034 項全數通過（1,345.01 秒、exit 0）；其後新增兩個候選順序案例，最新陷阱測試檔為 33／33 通過，受影響檔 ESLint 通過。build 2,202 modules 與標準 AI Browser 6／6 也通過。標準 Browser 驗證開局、HP 卡、手牌檢視、階段 AI 狀態及暫停／恢復 UI，不是陷阱情境的獨立 Browser 測試；新增兩個候選順序案例後，最新完整 Vitest 1,052 檔／21,055 項亦全數通過。

以同 19 副牌組／190 組配對跑三組 matched run（seedBase 202610160、202610161、202610170；每份報告為 2 seeds×4 次座位／先手交換、1,520 局）。前兩組每個牌組配對重疊 1 個 seed，共 760 筆重複局；逐局以 seed、牌組配對、先手及候選座位比對，結果完全相同。第三組與前兩組無重疊。4,560 筆原始紀錄去重後為 3,800 局，候選 1,908 勝、基準 1,892 勝（候選勝率 50.21%，只多 16 勝）；每個 190 組配對各有 20 局，其中候選領先 8 組、打平 180 組、基準領先 2 組。三份報告各自 380 項初始牌組預檢與 1,520 項逐局 parity 皆通過；去重後 3,800 局均完成且 parity 為真，失敗／未完成／500 動作上限皆為 0。按候選方牌組顏色分組的候選／基準勝數為：藍 145／255（400 局）、綠 235／565（800 局）、黃 326／274（600 局）、紅 572／428（1,000 局）、紫 193／207（400 局）、黑 437／163（600 局）。三份報告的 baseline／candidate bundle SHA、牌組快照 hash 完全相同；11 個來源快照各自 SHA 與報告一致。seed 161／170 報告的來源 manifest 均為 342 個輸入（48 policy、294 規則／資料）；兩次與本機現況比較都只有 src/game/ai/battle-handler.ts 一個 policy 輸入不同，且規則／資料輸入 294 項全相同。baseline／candidate policy hash 分別為 34fc7f895e50c69942ec7bce6fd740900f1d7f4c90a614ec46e8ad278feef667／a147badd69aaf3fb4bcb3a20fb1b4c83c8e4a1d48f1e35c5c705ffaae15ae08c；規則／資料 hash 為 80f481debcf1a3d4d9c6bd5322c1cd82d77169a859a46c4132e125b35b5c70b0。這是已隔離單一守衛在固定矩陣中的小幅方向性差異，不足以主張穩定整體或人類勝率提升，也未做顯著性檢定。報告：output/ai-cookierift/matched-comparison-public-noop-trap-guard-seed-202610160.json、output/ai-cookierift/matched-comparison-public-noop-trap-isolated-seed-202610161.json、output/ai-cookierift/matched-comparison-public-noop-trap-isolated-seed-202610170.json。

## 2026-10-15 移動目標修補後的公平比較

AI 的 `opponent-battle-to-trash` On Play 與攻擊後續選目標改用共用規則層合法候選，避免將受 BS6-010 保護的餅乾寫入指令。GPT-6.1 Sol 複核發現攻擊後續測試只檢查結算動作與 Timekeeper 留場，舊版也會因規則層 no-op 通過；已補命令紀錄 `targetIds: []` 斷言。BS2-062／BS6-010 的 On Play 正向回歸則在舊基準重現「選擇的卡牌不是合法目標」，修補後合法略過並清除 pending。

使用 7 副 BS12 與 12 副 Cookierift 構築，共 19 副牌、190 組配對、2 個 seeds、每個 seed 4 次座位／先手交換，完成 1,520 場。380 組牌組配對預檢、1,520 場逐局初始狀態 parity 全通過；失敗、未完成與 500 動作上限皆為 0。候選與固定歷史政策基準各 760 勝（50.00%）。色別候選／基準勝場為藍 60／60、綠 97／96、黃 134／135、紅 214／214、紫 79／79、黑 176／176。這是固定牌組、Lv5 與兩個 seeds 下的 AI-vs-AI 描述性結果，不代表人類勝率或統計顯著差異。

公平基準以現行規則／資料重建歷史 AI 策略，並套用共同的合法移動目標修補；修補本身不計為候選優勢。候選來源 manifest 為 342 項（48 項 policy、294 項規則／資料），候選與基準規則／資料雜湊相同；11 個牌組來源快照與兩個 bundle 雜湊均核對通過。完整報告：`output/ai-cookierift/matched-comparison-movementfix-fairbaseline-seed-202610151.json`。

建置 2,202 modules、標準 AI Browser 6／6、完整 Vitest 1,049 檔／21,015 項全部通過（1,408.02 秒、exit 0）；AI Browser 因沙箱禁止 loopback，改以升級執行權限由腳本啟動本機 preview 後通過。GPT-6.1 Sol 審查確認 overlay 來源雜湊一致，並指出上述攻擊後續測試缺口，已用命令 payload 斷言補上。

## 2026-10-15 使用者提供的韓版 PVP KR 紅色牌組

依使用者提供的牌表圖片逐項轉錄至 `data/decks/bs12-red-korean-starter.json`，主牌60張、EXTRA 6張、25個唯一卡號，未替換卡牌；定向測試確認所有卡號可由正式卡池建立，並保留玩家牌組的編輯／刪除語意。加入 BS12 AI 預設選單與 AI 對照牌組。桌機1366×768及平板1164×777的牌組選單／開局 Browser 共38／38 PASS，逐卡核對主牌與EXTRA，頁面錯誤0；目視可讀畫面與精確結果見 `output/ai-cookierift/community-browser-bs12-korean-20261015/results.json`。

以7副BS12牌組（含PVP KR）、12副Cookierift構築進行 matched AI-vs-AI 比較：190組牌組配對、每組2個seed及4次座位／先手交換，共1,520場；380組預檢及1,520場初始狀態皆一致，失敗、未完成與500動作上限均為0。候選策略762勝、HEAD基準758勝，候選50.13%。這是兩個seed／配對的描述性結果，四次交換彼此相關；小幅差異不證明整體勝率提升，也不代表人類對戰勝率。比較固定48個AI policy輸入為候選差異，294個現行規則／資料輸入的SHA-256與基準完全一致（policy HEAD `1051a94b0b88ed6686d9c8e496f7fff14c50ed0f`）。完整報告：`output/ai-cookierift/matched-comparison-korean-20261015.json`。定向測試3檔／44項、AI Browser、產品lint與build已通過；完整Vitest 1,049檔／21,007項全部通過（1,474.83秒、exit 0，於後續牌組編輯器系列篩選修改前）；篩選修改後，編輯器24項定向測試、相關ESLint及build再通過。

## 2026-10-15 社群綠色牌組 #801 Garena

Cookierift [#801 Garena](https://cookierift.com/decks/community/801) 顯示為合法牌組，作者 Chaeryo，更新日期 2026-10-12。已按頁面卡牌詳情保存原始張數與 canonical 卡號至 `data/decks/cookierift-community-20261015.json`；主牌60張、EXTRA 6張、26個唯一卡號，未替換或刪除卡牌。加入正式社群牌組選單後，12副已接受牌組仍涵蓋六色，綠色有三種構築。

桌機1366×768及平板1164×777的AI牌組選單／開局 Browser 共24／24 PASS，確認#801顯示為「社群 綠色｜Garena」，並逐卡核對實際主牌、EXTRA數量及開局完成。牌表契約與主選單定向測試2檔35項PASS，production build（2,201 modules）exit0；`scripts/benchmark-cookierift.mjs --plan-only`已確認18副牌、171組配對、每組2 seeds×4座位／先手交換，共1,368場。AI對局比較尚未執行，因此不據此宣稱決策品質或勝率提升；資料與 Browser 證據：`output/ai-cookierift/community-browser/results.json`。

2026-10-14 六色社群構築更新：從 Cookierift 公開頁面逐張讀取並保存 #16 Taipei Arena [BS12 Black]、#51 Forky、#67 [BS12] Kane's Yellow Arena Recipe、#731 Rarena 的最新牌表與來源雜湊；採用黑色 #16、紅色 #731、更新黃色 #67。#51 保留在來源快照但不加入遊戲，因其2張 ST10-006 尚未進正式卡池。現有11副 Cookierift 牌組涵蓋六色；選單Browser實際核對選取值、開啟對局及完整主牌／EXTRA清單，桌面1366×768與平板1164×777共22／22 PASS。

同一批牌組以1,224場固定種子、座位與先手交換進行 matched AI-vs-AI 比較。306組對戰配對的初始狀態及1,224場逐局狀態全相同，失敗／未完成／動作上限皆0；候選與基準各612勝，整體50.00%。色別結果（場次／候選勝場／基準勝場）為藍144／58／58、綠216／63／61、黃216／116／118、紅288／136／138、紫144／76／75、黑216／163／162。候選bundle輸入路徑與基準manifest完全相同（305項），257項規則／資料輸入SHA-256完全一致；比較只隔離AI policy輸入。結果支持同一測試矩陣下規則／局面一致，沒有顯示整體對戰勝率提升，也不能推論對人類玩家勝率。完整Vitest 997檔／20,697項全數通過（1,399.27秒、exit0）。完整報告：`output/ai-cookierift/matched-comparison-20261014T061040794Z-29004-d17a6347.json`。

2026-10-13 ST8-011 已逐卡 promote 並正式重驗，**58正式／42候選**（ST6 20／0、ST7 20／0、ST8 12／8、ST9 1／19、ST10 5／15）。原圖Kiwi Cookie綠LV1／HP3、GN普通1，G Blocker將攻擊轉向本來源，不加REST來源／Once／YourTurn／FLIP／Then。正常adapter已符合卡面；補精確契約後，原先21個漏拒變異修復，53種有效錯誤runtime全拒，58項契約測試通過。候選最終3檔171項、契約共享5檔185項及Blocker共享4檔64項、正式13檔450項通過。候選與正式各80案雙尺寸Chrome、各4案實際Lv5，完整初始／真實父命令／最終GameState與canonical紀錄的獨立重播及來源指紋通過。真1／2／3普通傷害、疲勞來源可Block、同回合真第一次Block父流程後再付第二張G、雙Kiwi已是原目標者不可再Block、唯一餅乾真昏厥後強制補位及最後牌庫Refresh均驗。GN第二支援分別實際支付六種顏色；新增卡色斷言抓到原測試假黑素材，已依正式raw與原圖改成BS11-092 BLACK，失敗run與斷言完整保留。Lv3～5真G支付保護原本會被2傷害擊倒的HP2餅乾，Kiwi由HP3降1；缺G只有紅支援則合法略過，未宣稱對人類勝率提升。正式build／受影響lint／72檔2138卡號2082轉接／registry／strict／標準AI Browser／ST1核心同步通過。完整Browser首輪15PASS後因棄牌區下方Kiwi原圖定位逾時失敗，改經正常公開棄牌viewer核圖，再整輪重驗；不以partial或放寬圖像檢查通過。012原圖與付款規格覆核準備：沿目前通用專案規則選活躍支援G付款，不是新增個別官方FAQ裁定，012仍未驗收。既有7張正式卡仍待本輪重驗；官方五組各60張已確認，但精確逐卡配比仍缺官方來源，未猜測填入。本批010～012全域lint／完整Vitest仍待批末；上一批007～009修後組合驗證不涵蓋本批且沒有新的全套exit0。逐卡online、完整UI開局至勝負及對人類勝率未驗收，未commit／push。證據：output/st6-st10/st8-011-promotion.json、output/st6-st10/st8-011-browser-candidate-run2/independent-replay-audit.json、st8-011-browser-formal-run1/independent-replay-audit.json、st8-012-payment-spec-review.md。

2026-10-13 ST8-010 已逐卡 promote 並正式重驗，**57正式／43候選**（ST6 20／0、ST7 20／0、ST8 11／9、ST9 1／19、ST10 5／15）。原圖 Cookiemals 綠LV1／HP2、G普通1；昏厥先將己方支援恰好1張任意色／可已橫置的物品卡回手作代價，再選牌庫頂0～1張放入支援疲勞，沒有Then／FLIP／Once／YourTurn。補齊原本缺失的技能與物品成本轉接，修正共用昏厥模式必須先付成本；選0仍支付、付款前可不發動、非法命令不改原狀態，保留原父效果／戰鬥與context。55種錯誤runtime全拒絕；候選5檔177項及共享11檔315項、正式17檔522項通過。候選與正式各106案雙尺寸Chrome、各4案實際Lv5，獨立完整初始／真實父命令／最終GameState及canonical紀錄重播與來源指紋通過。真正普通傷害、自己攻擊被Kumiho印刷FLIP1反傷（之前真普通1）、ST7-013實付YY與黃色棄牌餅乾代價的效果傷害、同回合第二張Cookiemals昏厥、空牌庫Refresh、唯一餅乾強制補位均已操作，正常結算無卡死pending。正式build／受影響lint／71檔2137卡號2081轉接／registry／strict／標準AI Browser／ST1核心同步通過；ST1首輪進遊戲前networkidle逾時失敗保留，卡牌Browser終止後同版本隔離重跑通過。ST8-011已原圖與來源準備，尚未驗收；既有7張正式卡仍需本輪逐卡重驗。官方五組各60張已確認，但官方海報沒有逐卡張數且官方商店HTTP429，精確預組配比仍缺來源。上一批007～009完整Vitest首輪955檔20100項有1項舊庫存預期失敗，修後該檔30項與其餘來源未變的954檔組合驗證已保留，沒有新全套exit0；該證據不涵蓋010改動，本批全域lint及完整Vitest仍待批末。逐卡online、完整UI對局與對人類勝率未驗收，未commit／push。證據：output/st6-st10/st8-010-promotion.json、st8-010-browser-candidate-run1/independent-replay-audit.json、st8-010-browser-formal-run1/independent-replay-audit.json。

2026-10-13 ST8-009 已逐卡 promote 並正式重驗，**56正式／44候選**（ST6 20／0、ST7 20／0、ST8 10／10、ST9 1／19、ST10 5／15）。原圖 Cucumber Cookie 綠LV2／HP3、GGG普通3，免費HP FLIP抽0～1，沒有Skill／Then／手牌門檻或補HP；48種錯誤runtime全拒絕。候選最終5檔149項／共享6檔313項、正式12檔377項、build／受影響lint／資料70檔2136卡號2080轉接／registry／strict／標準AI Browser／ST1核心同步皆PASS。候選與正式各102案雙尺寸Chrome、各4案實際Lv5，主代理獨立完整初始狀態、真實父命令、最終GameState與紀錄重播及來源指紋PASS；兩層不重複累加。兩張不同instance FLIP各自選0／1、真正最後牌庫Refresh、最後HP仍昏厥、新抽Goblin真補位及原印刷OnPlay略過均已操作。發現test-state捷徑會略過第二FLIP，修成公開卡牌／預組preview逐點續接；一般對局不走該捷徑，未推稱production同缺陷。原失敗與修復證據完整保留，未放寬斷言。ST8-010來源核對確認Quick Roll尚未轉接、Item支援回手成本尚未分類；僅來源準備，不算驗收。既有7張正式卡仍需本輪逐卡重驗。官方五組各60張已確認，但目前官方海報無逐卡張數且官方商店HTTP429，精確預組配比仍缺來源，未猜測填入。批末完整Vitest首輪955檔／20100項：954檔20099項通過，僅1項舊庫存預期失敗（exit1保留）。獨立原始資料核對2080印刷／1597機制後，盤點測試改為嚴格對照正式來源並補008／009能力檢查，該檔30項及lint通過；其餘1823項來源指紋完全相同，沿用954檔通過證據。全域lint通過；修後未重跑全套，此為組合驗證，沒有新的全套exit0。逐卡online、完整UI對局與對人類勝率未驗收，未commit／push。證據：output/st6-st10/st8-009-full-acceptance.json、st8-009-ai-inventory-check.md、st8-009-promotion.json、st8-009-browser-candidate-run1/independent-replay-audit.json、st8-009-browser-formal-run1/independent-replay-audit.json、starter-recipes-source-report.md。

## 2026-10-13 公開禁止補 HP 的付費 FLIP 修正

已採用窄範圍策略：真實BS9-035啟動使對手本回合不能透過效果補HP時，AI不再為被禁止的純attached HP支付一般棄牌；其他有效effects、免費、detached、替代目標及特殊費用保留原行為。正式45項失敗基線9fail36pass，修後最終6檔199項、build／受影響lint／標準AI Browser通過；真實BS9-035父命令及NNN3揭示ST8-007的手動／actualLv5雙尺寸Chrome4案與完整獨立重播PASS，AI保留手牌後正常補位。正式新舊同規則9個Lv3～5決策均保留1手牌，HP及牌庫相同；這是立即決策對照，未證明整體或對人類勝率提高。完整Vitest需納入下一批，940檔19627項為較早ST8-006基線。證據見output/st6-st10/ai-blocked-hp-flip-acceptance.json及ai-blocked-hp-flip-current-policy-comparison.json；未commit／push。以下為較早紀錄。


<!-- ai-starter-current-start -->
2026-10-13：修正綠色鏡像對局中，懸置的 Cookie Games Stadium 父效果被誤當成子傷害外部中斷而永久等待。僅在子序列完成檢查中排除父堆疊，實際父效果仍保留，由命令邊界續接；不重複傷害、支付或抽牌。實際開局加 138 筆前置指令可重現，修前 4 項失敗；修後新增 6 項及共享 19 檔 687 項通過。原本兩場達 500 動作上限的對局皆於 221 動作結束；桌機／平板 Lv5 Chrome 與完整重播、標準 AI Browser、ST1 核心同步通過。HP 支付策略原型未採用，正式策略維持 v22；未證明整體或對人類勝率提升。本次完整回歸結果見 README 最新紀錄。

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

2026-10-11 ST7-002正式進度：Mango 已完成原圖逐字核對、免費On Play己方休息區總LV至少2→自身補1HP及Y普通1的實際來源驗收，已單卡promote。共用解析修正同時保留BS4-033休息LV5門檻與BS6-078手牌至多5門檻；候選12檔652項、正式13檔659項回歸、候選與正式build／全域lint／單卡strict／資料及registry皆exit0。候選與正式各同46案雙尺寸原圖Chrome（補HP36＋Mango普通攻擊10）及獨立實際指令重播PASS，仍為準備式局部流程，不等於開局至勝負或逐卡online。Lv3～5另12案正式AI探針確認門檻未達略過、達標接受免費補HP；標準AI Browser也PASS，這不是新勝率證據。正式44 JSON／2110卡號／2054轉換／1571 canonical AI cards；ST7能力稽核ready3／5能力／0unsupported／0conversionFailures。ST6～ST10現為30正式／70候選（ST6=20／0、ST7=3／17、ST8=1／19、ST9=1／19、ST10=5／15）。本批完整Vitest已終值exit0：872檔／18,125項全部PASS、1309.94秒，1665份來源／設定／資料指紋一致，來源凍結已結束；此完整回歸不涵蓋其後ST7-003候選來源修改。ST7-003原圖及獨立預期、轉接基線已存output；14種執行期strict變異僅攔2／漏12，正式來源未套用，也未promote。初版兩個無效手牌篩選欄位的診斷已撤回，v2改真實discardHandType／discardHandColor重驗，統計取v2。未commit／push。

隔離HP代價風險續驗：實際負向配對seed=2027131818，己方Break8、Parfait5HP→1HP後，現有終局評分仍為0，因防守資源數1→1。output隔離風險原型可計入-120，但同一原始局面仍選相同道具，尚未修正選擇、沒有新勝率證據，不套入正式AI。見output/st6-st10/st6-015-ai-survival-cost-observation.json及st6-015-ai-survival-prototype-observation.json。

ST6-015 隔離 AI 反例（正式仍 v9）：同一份原始 60 張局部場景，付款後剩 RR，Lv.4／5 都將可選 +2 給 Fire Spirit（普通1→3），而 Picky（普通2→4）可用實際 RR 指令擊倒對手原圖 Sour Belt 4HP。`output/st6-st10/st6-015-ai-counterexample.json` 保存兩個 AI 決策與合法替代付款／目標／攻擊／跳過陷阱／結算命令；輸入不變。反例指向增攻目標僅按保留價值排序，未比較剩餘能量與普通攻擊擊倒門檻。尚未修正正式 AI、未假設未知陷阱／FLIP必不發動，也不是新勝率證據。015已完成候選與正式驗證並promote。輸出隔離增攻原型可修正此反例，但兩組各624場為50.00%／49.84%，不作正式勝率提升證據。負向配對追到BS1-023將5HP降至1HP而己方Break8的生存代價風險，待另建原型驗證。

歷史進度（現況以本文開頭摘要為準）：ST6-020 Into the Depths 已依原圖補齊 RR 放置、Activate 橫置場景＋己方任意戰鬥區餅乾最上方1HP進棄牌後抽0～1；沒有額外啟動能量或Once。61項單卡（22種執行期strict錯誤變異）、隔離20檔407項回歸與型別檢查PASS；單元另驗真實FLIP HP支付不揭示也不觸發FLIP。38案桌機1366×768／平板1164×777 Chrome及獨立重播PASS，含任意顏色／REST餅乾、1HP昏厥、抽0、取消／切換、錯色付款、抽最後一張→Refresh。修正通用draw-up-to來源查找及UI漏場景區，抽牌視窗保留原卡圖、卡號與卡文；仍屬原卡準備式局部Browser，非整副開局至勝負或online驗收。重播將準備式父指令與initialState後的操作分開；Refresh未匯出洗牌seed，只宣稱牌庫成員與其他牌區精確相符，不宣稱重現隨機牌序。實際來源回歸=PASS、build=PASS、全域lint=PASS、單卡strict=PASS、來源Browser=PASS、來源重播=PASS。020已單卡promote；正式21檔414項、build、全域lint、資料／registry／strict、38案Chrome與重播、標準AI Browser及ST1好友房核心同步皆exit0（非020逐卡online）；43 JSON／2109卡號／2053轉換／1570 canonical AI cards，ST6 ready20／44能力／10組合邊／0unsupported；目前29正式／71候選，ST6=20／0，ST7=2／18、ST8=1／19、ST9=1／19、ST10=5／15。019正式410項、46案Chrome／重播、build／資料／registry／受影響lint／標準AI Browser均PASS；本批017～020完整Vitest已終值exit0：868檔／18,016項全部PASS、1359.78秒，1652份來源／設定／資料指紋一致；此完整回歸不涵蓋其後ST7-001候選來源修改。正式AI已整合安全Break代價選擇v10，正式局部與完整Vitest驗證均通過，條件評分原型14項PASS、修正前6項失敗：019己方1HP門檻成立122分，不成立117分；僅處理已證明不改HP的代價與前段效果，未知或可能改變條件的路徑保留原估值。原型未採用、未宣稱提高勝率。全正式陷阱與12副已接受牌組的靜態掃描確認此原型目前只影響ST6-019，現有12副均未含該卡，不以未受影響牌組的對照賽當作改善證據。另一救援陷阱原型128項／4案AI Chrome PASS，但兩組各624場625／623（50.08%），未證明穩定提升，未採用。逐卡online、完整正式對局及對人類勝率未驗收／量測；未commit／push。 本輪AI診斷確認canAttack僅為主要階段／首回合門檻，舊AI卻以其排除場景啟動候選；輸出隔離原型只讓Lv3～5比較合法場景，未改正式AI。原型40項回歸PASS（原版3項反例失敗）、原圖60卡準備局面雙尺寸Chrome12案及全部實際命令獨立重播PASS；兩組各624場為314／310與312／312，合計626／622（50.16%）；624組交換policy座位配對中5組有利、3組不利、616組勝負不變；場景啟動59次對基線1次。原型型別零diagnostics，未套用正式來源，不能宣稱穩定勝率提升。ST7-001原圖已目視並建立獨立預期；隔離54項測試（31原卡規則＋23契約，含22種錯誤變異）及型別PASS，原strict漏20種的反例已確認。實際來源候選已套用，12檔321項回歸與build、strict verified=1通過；原圖60卡雙尺寸Chrome44案及全部實際指令獨立重播PASS，新增guard對2108張正式卡分析不變。全域lint首次因三處測試prefer-const失敗，已改const並重跑321項PASS；全域lint重跑exit0，ST7-001已單卡promote；正式12檔321項回歸、資料／registry／strict皆exit0。正式雙尺寸Chrome44案及獨立重播、標準AI Browser與v10共批全域lint均exit0；ST7正式AI能力稽核ready2／2能力／0unsupported／0conversionFailures。首次driver將ST1-001誤認為GingerBrave已改為原圖Princess，後續付款候選及結果視窗driver錯誤已修正，失敗紀錄保留，不計為產品缺陷。 AI主線另重現BS12-035手牌進Break代價的自敗錯誤：己方Break7時Lv3～5按手牌順序選LV3會立即敗北，LV1可實際擊倒對手並獲勝。輸出隔離修正優先低印刷LV、排除其他手牌代價並拒絕會先達Break10的可選付款；59項回歸PASS（基線6項失敗）、型別零diagnostics、雙尺寸Lv5 Chrome12案及獨立指令重播PASS。首組624場312／312（50.00%），未證明整體勝率提升；安全代價原型其後已整合正式AI v10（lv5-safe-break-cost-v10），只改手牌進Break候選選擇與其他手牌付款排除；正式94檔1370項AI／ST7回歸、build、全域lint與標準AI Browser皆exit0；正式v10原圖60卡準備局面雙尺寸Chrome6案及獨立重播PASS。正式624場預選種子對照312／312（50.00%）、零錯誤，雙方各14次手牌進Break付款、零此類付款自敗，不能宣稱整體勝率提升。當前引擎SHA be714a097c6f0bae32991608a125342d9e4954acef4a8a7d2d355796cde090f4與對照賽bundle完全一致，對照020完整回歸僅8個既有來源／資料檔為預期修改。另用實際搜尋時鐘完成六色BS12對局至勝負，340次搜尋／0逾時／0丟棄評估；仍非人類勝率或逐卡online驗收。15項正式閘門通過後凍結1660份來源／設定／資料，AI v10＋ST7-001完整Vitest已終值exit0：871檔／18,083項全部PASS、1289.13秒，1660指紋一致。完整回歸不涵蓋其後ST7-002隔離或正式修補；002尚未套用／promote，當前29正式／71候選。來源凍結已結束。場景啟動與019條件估值原型仍未套用。實體卡準備式局部Browser不等於完整對局、逐卡online或人類勝率驗收。凍結期間另以正式ST7-001原圖60卡準備局面驗證主動技能：己方來源REST／Break7、對手Break9，高LV手牌在前時舊v9的Lv3～5皆弱部署而錯過立即勝利，v10皆付Princess LV1後兩點傷害收尾；低LV在前時新舊皆收尾，共6個實際命令反例，輸入不變／60唯一實體卡／同卡至多4張，見st7-001-ai-safe-break-diagnostic.json。此為局部策略證據，不是新勝率、全場或online驗收；未修改凍結來源。

最新完成：ST6-015 Fire Spirit Cookie’s Staff 已依原圖驗證並 promote：RR＋任意己方餅乾頂端1HP，0～1任意己方餅乾本回合攻擊+2，無具名／顏色／等級限制。68項單卡回歸、18種strict錯誤變異、49檔714項受影響回歸通過。候選與正式雙尺寸Chrome各重驗相同34案（32一般＋2最後餅乾代價，不重複累加），精確命令與付款、選零、離場候選、REST、異色目標、到期及普通攻擊已核對。本機目標以純付款命令投影，線上先付款再選權威目標；6項hook回歸通過，逐卡online完整對局未驗收。現23正式／77候選，ST6=15／5、ST7=1／19、ST8=1／19、ST9=1／19、ST10=5／15；37 JSON／2103卡號／2047轉換／1564 canonical AI cards。正式build、全域lint、資料／registry、strict ST6 ready=15、標準AI Browser皆exit0；修改前2102筆正式分析不變。015完整Vitest858檔／17,772項全部PASS、1273.65秒、exit0，1627份來源／設定／資料指紋一致，見output/st6-st10/st6-015-full-vitest.log；此終值不涵蓋後續016。AI正式仍v9；增攻原型兩組預選種子各624場為312／312、311／313，無穩定提升，未套入正式AI。對人類勝率未量測。未commit／push。下一cursor ST6-016；以下舊段落為歷史快照。

2026-10-11 最新卡池續批：ST6-009 strict、候選Chrome32案與34項專項（含Lv4／5實際支付R＋任意手牌1、技能收掉剩1HP對手且輸入不變）通過後promote；001～009及AI卡池稽核22檔213項PASS，build通過。正式卡池31 JSON／2097卡號／2041轉換、canonical cards=1558，能力缺口清單保持原23張；ST6 strict ready。預組17正式／83候選，0交集／唯一100；正式009 Chrome、批次AI Browser與全域lint仍待終值，007～009完整回歸尚未開始。正式AI仍v9；下段所列兩組後續普通攻擊減傷原型維持output-only，不冒稱穩定／人類勝率改善。

2026-10-11 最新狀態（以下舊快照不覆蓋本段）：正式 v9／P-163 完整 Vitest 834 檔、17,416 項 PASS，1341.17 秒、exit 0；007 修改前 1576 來源指紋一致。其後 ST6-007 已完成候選及正式雙尺寸同 28 案、30 項測試、最終 lint／build／資料／registry 並 promote；ST6-008 完成原圖、strict、20 項測試、候選雙尺寸 24 案（含實際 Refresh／不補位／重播父流程）後 promote，正式重驗進行中。現 16 正式／84 候選，前述全套不涵蓋新增 007／008；逐卡 online 未驗收。候選 008 初輪測試的 amount/max 欄位及 absent pending 的期待、Browser trace 欄位與 Refresh 後補位視窗期待失敗均保留，不當產品規則缺陷。

公開後續普通攻擊減傷原型保持 output-only、正式仍 v9。完全相同凍結策略兩組新種子各 624 場：2027031917 為 315／309（50.48%）、配對雙勝 14／11／287 各勝；2027032617 為 313／311（50.16%）、配對 11／10／291。兩組零錯誤，來源／種子／交換座位稽核 PASS，報告 SHA 分別 `4e29bda02df4281e894a3e9e347939389a584523de9c2e9631cf5996fd2eaa82`、`f292cac0f53b2dc16df6cc26cfd8b03dd09eb2990be7a3088bfeb48ceb7b2d69`。只證明此固定環境兩組略高五成，不能宣稱穩定或人類勝率提升。合法兩次攻擊反例證明盲目優先當前攻擊者會由剩 2 HP 變昏厥；新原型保留 2 HP，REST／可支付／無法支付三項政策檢查通過。此為公開普通傷害啟發式，不預測隱藏 FLIP 或額外技能。

全卡池 AI strict 能力稽核仍為既有 conservative：23 張 unsupported、conversionFailures=0，不能當全卡池 AI ready。新增 007／008 沒有增加缺口，ST6 單系列 strict ready；全卡池正式 inventory=2040／canonical cards=1557 已作為稽核測試的新數量基準，缺口清單 assertion 保留。

2026-10-11隔離續驗：非致命減攻原型相對凍結正式v9，兩組預選新種子各624場均完成且零錯誤；seed2027030517為326／298（52.24%），配對21新版雙勝／7舊版雙勝／284各勝；seed2027031217為318／306（50.96%），配對16／10／286，兩組來源／身份／種子／座位／bundle稽核皆PASS。原型兩bundle未在第一組後調參；候選SHA=e5c8946b5855ed63854562301bd6d07c3678a2ccd03c2a438c42309fdce1f617，正式v9 SHA=696c1c04e452be8859587244d42f5eee4ca0ec2d04ddaa2c3cbcffce473cbaed。報告SHA分別3318f8b85a36d18070273992608b41fd0399ed79ba7e47eecbf0f98b4aec5798及282d950b5ccbb36aa3ef686de585e97f4b08c595501f73f38b4de13206b35f95。第二組僅略高五成，不宣稱穩定或人類勝率提升；正式v9仍未改為v10。原完整Vitest session29773保持執行且1576來源指紋一致，不能因觀察逾時重啟。一般沙箱終端讀檔出現延遲，改由既有Node runtime讀紀錄及經允許的外部終端稽核；三個額外唯讀觀察session49711／3271／22753尚未確認終值，不影響原測試／比賽程序。

ST6-007隔離候選另通過2檔30項規則／卡面檢查，明確斷言正式007路徑仍未開放；獨立TypeScript初次發現JSON字串型別過寬，補官方資料邊界型別後v2通過，僅output草稿改動。single inventory候選schema驗證exit0但converted=0，不能當轉換或promote通過；獨立strict單卡audit verified=1／needs-review=0／blocked=0。候選Browser28案沿用，型別修正不改執行期；尚待正式整合與promote後重驗，仍14正式／86候選。

本批最終build／全域lint已exit0，完整Vitest仍在session29773，1576來源指紋保持一致。等待期間另外建立output-only direct-mitigation原型（`trap-damage-v10-prototype`）：合法60張實際非致命Chamomile攻擊下，正式v9選REST Sour Belt、自己剩1HP；相同付款改選當前攻擊者可剩2HP。只從凍結v9 bundle更改兩個公開傷害門檻及原型版本字串，不改正式來源。預選seedBase=2027030517、12牌表624場與正式v9比較已在session63067執行，仍待終值；不得用此原型稱正式v10或先宣稱勝率改善。ST6-007隔離Browser28案亦已通過但未promote。


2026-10-10 AI v9正式續批：v8完整Vitest已結束，833檔／17,396項全部通過，1420.70秒、exit0；修改前1572份來源／設定／資料指紋一致。其後正式套用「可救下當前防守者的減攻陷阱優先當前攻擊者」，版本`lv5-public-saving-trap-target-v9`；原v8的11項測試9失敗／2通過，修正後11項全通過。受影響AI回歸65檔986項、build、全域lint與標準AI Browser通過；實際AI雙尺寸6案及匯出付款／目標／resolve-battle／HP指令全部通過。前兩輪Browser driver對HP文字格式及結算指令的假設失敗保留，run3取代，不當產品失敗。六色BS12實際時鐘完整對局368次搜尋、0逾時／0丟棄評估，4次實際Special Play。

勝率證據：凍結原型兩個預選種子組各624場，338／286（54.17%）及329／295（52.72%）；正式v9另用seedBase=2027022617完成624場，342／282（54.81%）、零錯誤，312組政策座位配對中38組新版雙勝／8組舊版雙勝／266組各勝一場。正式bundle除版本字串外與前兩組原型完全一致；共同規則／資料與bundle指紋、種子／座位稽核通過。正式報告SHA=632df663ef40d00570964b2febf4f02d048c5509caba744fc427d7e6a33e4311；原report.method沿用output-only範本文字，正確正式版本身份見protocol／manifest及formal-comparison-summary.json，原報告保留不覆寫。這是固定12牌表的AI對AI改善證據，不等於人類勝率或所有環境的穩定提升。

P-163舊三張戰鬥區fixture已撤回合法驗收解讀，改為來源加一張紅Arena／綠Arena／非Arena的獨立兩張局面，錯色支付改用真正ST2-020，不改卡牌印刷屬性。原上限測試1失敗／11通過，修正後21項通過，正式Chrome雙尺寸14案通過；舊Browser紀錄保留但不累加。沒有新增卡牌promote，ST6～ST10仍14正式／86候選，007正式驗收及逐卡online未完成。

本批最終完整Vitest已凍結1576份來源啟動，session29773，`output/ai-cookierift/formal-saving-trap-v9/full-vitest.log`，尚待終值；執行期間不改程式／測試／資料。v8的833檔結果不替v9宣稱完整通過。localhost:5173開發伺服器session26822已啟動，HTTP200／Braverse對戰卡牌；未commit／push。


新確認的防守反例：正式v8的通用陷阱目標依保留價值選擇，ST3-019會對已REST的Sour Belt減攻，忽略正在以GG普通2攻擊的ST3-011，己方ST3-005實際失去全部2HP；完全相同付款／支援棄置，改選當前攻擊者即可保留2HP。`formal-resource-v8/trap-attacker-counterexample.json`保留原狀態與兩條正式指令的結果。另建每方60張原始卡、唯一instance／同卡≤4／戰鬥≤2、印刷起始HP、實際GG2宣告父流程的隔離fixture，仍重現相同錯誤（`trap-physical-preview-probe.json`）；這是合法局部規則／AI證據，未當作Browser或online驗收。

Output-only saving-trap原型：從masked狀態用規則引擎預估直接減攻，僅在能救下當前受致命攻擊的防守者時優先實際攻擊者，不提前付款／翻HP；六種陷阱與條件不成立、不致命、傷害免疫、未知牌面共10情境通過（`saving-trap-matrix.json`）。已準備正式測試與合法Browser fixture草稿，未改正式來源。預選seedBase=2027021217、12牌表／624場比較正式v8與此原型正在執行，目錄`output/ai-cookierift/trap-saving-v9-prototype`；185份同輸入，僅virtual修改battle-handler，兩bundle SHA已固定。比較preparer首次錯誤引用舊atomic builder、第二次缺少新entry，修正output恢復腳本後才開始比較；舊atomic報告／bundle SHA稽核仍通過，未覆寫既有結果。v8全套仍在原session執行，1572指紋一致，不套用v9或007產品修改直到它結束。

正式v8最終局部與比較結果：專項2檔21項、AI回歸65檔990項（322.78秒）、最終build／全域lint及新增測試lint／AI Browser全部通過。8個實際時鐘資源續接案例通過；六色BS12實際時鐘完整鏡像對局350次搜尋、0逾時／0丟棄評估、4次真實Special Play（`formal-resource-v8/real-clock-runtime-probe-full.json`），是執行／決策證據而非人類勝率。

正式v8預選新seedBase=2027020517的624場全部完成、零錯誤，312勝／312敗（50%）；312組政策交換配對全部各勝一場，未測得整體勝率提升。身份／種子／雙先後手／共同來源／bundle SHA稽核通過，report SHA=08539fda67777980474809fa52353256be4f827992d5e8b637a822af8f3ebbf1。8組配對行動數不同但勝負不變，首組藍對社群506黑、seed2027021617、黑先手，第9回合step107，黑由Pom-pom改選Venom，皆用BS11-114支付Special Play；`formal-resource-v8/first-draw-hand-divergence.json`保留狀態與理由，不作最佳解或唯一勝因宣稱。前面atomic原型316／308不能替正式v8宣稱提升。主目標的廣泛AI強度與勝率提升仍未達成。

正式v8完整Vitest已凍結1572來源／設定／資料指紋啟動，報告`output/ai-cookierift/formal-resource-v8/full-vitest.log`，仍在執行且指紋一致；執行期間不改程式／測試／資料。前832檔17,384項全套僅證明v7／ST6-006，不取代這次最終結果。

正式AI已套用`lv5-public-on-play-resources-v8`：將合法On Play自方抽牌／公開棄牌回收併入部署續接，整段淨手牌計分、非負暫時耗竭扣分退款，且拒絕未完成Refresh預測；保留mask與真實效果另行結算。新測試舊版5失敗／6通過，修正後與原傷害續接共20項通過，另補六起始手牌的淨收益邊界；build與全域lint通過。受影響AI回歸、Browser及新seedBase=2027020517的624場正式v8比較仍進行，舊原型結果不能代替。比較已核對185份輸入，只有handler／搜尋hook／版本識別三個政策檔差異，baseline SHA=fe497c185778fd6011404dca49b9965c8fadecfa6cb3a371d26da4740b489b88、v8 SHA=56275b3e428c0be40ba1bf7e108169f271c6eefee455043620c1c1684d92d8a1，目錄`output/ai-cookierift/formal-resource-v8`。

ST6-006／AI v7全套已完成：832檔／17,384項全部通過，1276.56秒、exit0，1571份來源指紋一致；這是v8修改前的結果，不當作v8最終完整回歸。

Refresh 邊界隔離重驗：將 Venom fixture 的 On Play 改成合成 exact-draw 2，只為測預測安全邊界、不當實體卡驗收。實際規則抽牌停在 pendingRefresh（remainingDraws=1）時，atomic 原型仍給45分，`on-play-v7/exact-draw-refresh-baseline.log`保留失敗；新 output-only refresh-safe 原型先拒絕未完成 Refresh，反例通過且輸入不變。原本8個決策、4個抽牌邊界及六起始手牌檢查共13案另重跑通過，檔名尾碼`-refresh-safe`。生成腳本首次錨點不唯一造成build失敗，已改用唯一pendingDraw錨點；不屬正式產品缺陷。此修正仍未套用正式AI，不混入既有比較bundle。

Atomic resource 原型第三組比較已完成並稽核通過：預先固定seedBase=2027012917，同12副牌表／624場全部完成，316勝／308敗（50.64%）；312組政策交換配對新版全勝4組／舊版全勝0組／各勝308組。報告目錄`output/ai-cookierift/atomic-resource-v8-prototype`，report SHA=362d27e193fcea537d4ffb86a3f4dccd4cfa02246de979c073076c262e08cd40，candidate SHA=3a782cf09ce373c030be98efdb93fd47eb127a0e11568ebdcb499860d6f79a52；身份／種子／雙先後手／共同規則資料來源與bundle SHA稽核通過。它包含整段部署淨手牌計分與公開棄牌回收，不包含之後的Refresh guard；結果不能替代後者新驗證，也不足以證明穩定提升或人類勝率。正式AI尚未套用，不將三個不同原型的比較合併計算。

v2已用勝負改變配對的首次命令差異另存`draw-hand-v8-prototype-v2/changed-winner-first-divergence.json`：社群83紅對506黑、seed=2027103317、紅先手，黑方第2回合step11由Pom-pom Dough改為Venom Dough，皆支付同一張BS11-104 Special Play代價。這是第一個可觀測差異，不等於唯一勝因或最佳解；完整狀態與理由保留供後續一般化驗證。未因小幅勝率結果放寬卡牌／AI驗收或修改正式政策。

Draw/hand v2原型第二組624場全部完成、零錯誤：314勝／310敗（50.32%），312個政策交換配對中新版全勝2組／舊版全勝0組／各勝310組；尚不足以證明穩定提升。seedBase=2027012217、report SHA=825114a2a99acd63854f4ce34ddbae86e482ef9704ed015fe843f79001f8d9c9，身份／種子／雙先後手／bundle SHA稽核通過。v1第一組為312／312，兩組不混作同一政策結果。12副固定牌表的AI-vs-AI不代表人類勝率，v2仍只在output，正式政策尚未套用。另已在已用藍對黑506對局重現Pom-pom公開棄牌回收預估null但實際回收1張，擴充隔離resource分支可預估12；完整部署／On Play淨手牌會計實驗再將抽2但淨增1的技能獎勵由12改6，8個決策案例與5個安全邊界通過，但與前一recovery原型在這8案選擇相同，原先預期舊版失敗的假設不成立、紀錄保留，不能宣稱已抓到無效循環產品bug。此後續實驗未跑新比較，不併入v2結果。

Draw/hand v1原型624場已結束：全部完成、零錯誤，312勝／312敗（50%），312組政策交換配對全部各勝一場，未測得勝率提升。report SHA=f193b4158f66aa21b2a9d2a1c2c8d22a33bfdb26a827ca4a8a240ecb951710d7，身份／種子／雙先後手／bundle SHA稽核通過；此版本保留六起始手牌少估8的已知缺陷。修正版v2另預先固定seedBase=2027012217，與相同正式v7 baseline SHA=fe497c185778fd6011404dca49b9965c8fadecfa6cb3a371d26da4740b489b88重新比較624場，尚在執行；不覆寫v1或重用其種子當新驗證集。v2仍只在output，不改目前正式AI。

AI原型邊界續查：預先固定seedBase=2027011517的624場正在比較正式v7與output-only draw/hand v1（同185份輸入graph、只virtual修改兩個AI檔，共用非修改來源SHA=4ccf0dbda7ab91334a7fb234833191317722d58abba70c3378ef8de08f23045b）。進行中另發現起始手牌6→部署後5的原型扣分混入囤牌-8：應只保留登場抽2收益22，v1卻為14；保留失敗`venom-six-hand-regression.log`，另建v2將暫時扣分退款限制為非負，正常62、六手牌22、手牌門檻不符null、短牌庫null及未知牌面62均通過。未覆寫正在比較的v1 bundle、未修改正式政策；v1結果須帶此已知限制，不替代v2新種子驗證或人類勝率。

ST6-006最終局部重驗：正式Chrome雙尺寸同18案全部通過，不與候選累加；正式build修正測試型別窄化後通過，最終全域lint／AI Browser／資料／registry通過。Lv4／Lv5正常與最後HP四案實際AI均免費發動006回手且輸入不變。本批完整Vitest已凍結1571份來源／設定／資料指紋啟動，報告`output/st6-st10/st6-006-full-vitest.log`，session需等最終結果，執行期間不改程式／測試／資料。正式14張／候選86張，007尚未推進效果驗收。

ST6-006續批：原圖重讀、strict verified=1、候選Chrome雙尺寸18案、受影響10檔435項及build／全域lint通過後已單卡promote；正式14張／候選86張（ST6正式001～006、剩14）。正式28JSON／2094卡號／2038轉換及registry一致性、promote後4檔29項通過。正式build初次發現新detached測試缺少Cookie型別窄化，已補真實type assertion；重建、正式Chrome／AI Browser與本批完整回歸仍待完成，停止後續007驗收。前版829檔17,361項全套不涵蓋006。逐卡online未驗收。

2026-10-10 22:33最終完整回歸：v7／ST6-005的Vitest 829檔／17,361項全部通過，1206.63秒、exit0；1565份來源／設定／資料指紋一致。報告`output/ai-cookierift/full-vitest-on-play-v7-st6-005.log`。此結果不包含後續006或Venom原型的正式套用。

22:30隔離診斷續進（尚未套入正式政策）：Venom Dough登場抽牌的漏估不只來自未涵蓋draw；trace證明部署後手牌暫時2→1先被舊handManagement扣40，再加部署低手牌扣5，單純新增On Play收益22仍會放棄。output-only原型按實際可發動的masked On Play續接處理抽牌，僅沖回已恢復的暫時手牌耗盡扣分，保留部署扣分且不另加抽牌管理獎勵；正常預估22+40=62。健康Licorice活躍／疲勞皆可選降等→Venom Special Play，真正部署仍停在pending On Play、手牌1張，實際發動及玩家抽2決策後才成為3張；對手HP不變。手牌7張、部署後仍超過≤5門檻時不強迫部署。另四案forecast正向／門檻不符／短牌庫可能Refresh／未知牌面置換均通過：短牌庫不預估，未知牌面不改62估值，輸入不變。證據`output/ai-cookierift/on-play-v7/venom-hand-guards.json`與`venom-forecast-guards.json`，原失敗診斷保留；尚無此原型正式測試、Browser或新勝率比較，不宣稱v7已包含修正。完整Vitest原session仍執行、1565來源指紋一致。

最終狀態續驗：ST6-005正式Chrome雙尺寸28案通過，promote後五檔53項回歸、最終build／全域lint／registry／資料驗證通過。最終AI Browser通過；增加005後的runtime另存`on-play-v7/candidate-final.mjs`與182項來源manifest，42個政策來源SHA與已比較v7完全相同；最終六色完整鏡像350次搜尋、0逾時／0丟棄評估，4次真實Special Play。沒有覆寫增加005前的比較bundle與結果。本批完整Vitest已固定1565份程式／設定／資料指紋啟動，報告`full-vitest-on-play-v7-st6-005.log`，必須等最終結果；執行期間不改程式／測試／資料。次目標正式13／候選87；下一張006確認缺少FLIP轉接，僅隔離診斷，仍留候選。

v7／ST6-005 最新結果：AI 回歸 63 檔／963 項通過（278.22 秒、exit0），build／lint／AI Browser 通過。預先固定 seedBase=2027010711 的 624 場全部完成、零錯誤，新版 313 勝／舊版 311 勝（50.16%）；312 組交換政策位置配對中新版全勝 1 組、舊版全勝 0 組，其餘 311 組各勝一場，差距不足以證明穩定提升。完整身份／種子／政策位置／先後手／SHA 稽核通過，report SHA=dc5d18af12ebcb377b6d53b129ce6caa76ccf4144554f428de8fc81fb2ea38c3。此種子集合已用，不再當作新驗證集。唯一改變勝負的配對為黃色 BS12 對黑色社群506、seed=2027031811、黑方先手；首次政策分歧在黑方第一回合支援階段：v6 放 Draining Magic Circle，v7 放 Skelecake Bomber。黃色新政策臂未發現命令分歧；診斷腳本先錯誤假設兩臂皆有分歧，修正為實際觀察一臂，保留失敗紀錄。這是探索性首次差異，不宣稱該選擇為唯一勝因或最佳解。真實時鐘 16 個反例通過、健康／低 HP Mold Dough 四個滿場分支均選 Activate；六色完整鏡像 350 次搜尋，0逾時／0丟棄評估，真實紀錄4次Special Play。以上 frozen v7 比較與 runtime bundle 在 ST6-005 fixture／正式卡池增加前建立，未覆寫；後續正式卡池仍須最後狀態回歸。

ST6-005：原圖再目視、30項卡牌／合法60張實體局面測試、strict verified=1、候選Chrome雙尺寸28案通過後單卡validate／promote；正式13張／候選87張。27個正式JSON／2093種卡號／2037筆轉換與registry一致性驗證通過。首輪5項測試失敗為使用錯誤顏色欄位、Vitest空陣列資料列，以及未限定被測攻擊者而把另一張餅乾的合法攻擊誤當違規；保留紀錄後改用既有energyColor、具名資料列與明確來源ID，不變更產品規則。首輪Browser誤抓休息區原卡圖，將昏厥檢查限定戰鬥區後28案通過。正式卡池重驗與本批最終完整Vitest仍待完成，逐卡online未驗收。AI能力稽核精確計數因新增唯一005而增加一筆，新增該卡ready檢查；其餘既有unsupported清單保留。

v7 本輪進度：三項健康 Licorice／Mold Dough 公開收尾反例先重現失敗（皆錯選 advance-phase），加入 Lv.5 的 `on-play-followup` 獨立評分項後通過。只預測可支付且無未建模條件的簡單 On Play 傷害，先遮罩隱藏牌面再呼叫既有技能規則；不把預測狀態作為真實對局結果，也不把未知 FLIP 視為保證擊倒。真實登場後仍保留 pendingOnPlay、手牌代價及原對手 HP，另行支付與結算才完成擊倒。專項兩檔 24 項通過，包括未知牌面不影響動作、遮罩／輸入不變、缺代價／錯誤來源／錯誤玩家／抽牌型效果不預測。初次遮罩測試誤用不存在的 `hidden-card` ID，依既有 createHiddenCard 的 `hidden` 修正，保留失敗紀錄。受影響 AI 回歸與最終 build 仍在執行；全域 lint 已通過。本批最後狀態仍須完整 Vitest、AI Browser、真實時鐘與新種子勝率比較，尚未宣稱勝率提升。seedBase=2027010711 的 624 場對照規格已於執行前固定，凍結 v6 baseline SHA=997cfdb48c5645b6f338eb910de01b2cd200980fe70e1237daeeca1eb5440c09，與上一版 bundle 完全一致，兩方底層規則／資料指紋相同。證據入口 `output/ai-cookierift/on-play-v7`。

v6驗證結果：受影響AI回歸62檔／954項通過（271.59秒、exit0）；負向測試改用印刷4HP防守者，避免把對1HP防守者的漏收尾鎖成正確行為，最終3檔39項與該測試檔lint通過。產品來源不再變更後的build／全域lint／AI Browser通過；最終測試修正後再build通過。真實時鐘六色完整對局350次搜尋、0逾時／0丟棄評估，並由真實commandLog記錄四次黑色Special Play，`special-play-v6/runtime-probe-full.json`。預先固定seedBase=2026122813的624場全部完成、零錯誤，新版310勝／舊版314勝（49.68%），312組交換政策位置配對中新版全勝10組、舊版全勝12組、290組各勝一場，沒有達成提升勝率。完整身份／種子／位置／先後手／SHA稽核通過，`matched-special-play-fresh-audit.json`，不刪失利樣本；此種子集合已使用，不能重用為下一版新驗證集。本版完整Vitest尚未啟動；前批825檔不能作為v6驗收。所有以上證據均在`output/ai-cookierift/special-play-v6`。

下一個已確認問題：Licorice剩4HP、手牌Mold Dough及任意手牌代價、戰鬥區已滿、對手最後一隻1HP且無替補手牌時，v6仍推進階段；直接合法降級／Special Play／On Play可擊倒對手，再由雙方真實skip-replacement完成no-cookie-available勝負。原型僅對可支付、無未知抽牌的簡單On Play傷害，用遮罩隱藏牌後的規則結果與既有場面／技能估值提供條件式續接數值；不把預測狀態回傳為真實遊戲，也不宣稱未知FLIP一定不會救援。output-only原型在健康來源反例改選降級／特殊登場；替換未知HP與牌庫為實際BS12-060 FLIP卡後動作不變。報告`readying-v5/level-special-play-on-play-prototype.json`及建置腳本`special-play-v6/build-on-play-prototype.mjs`；尚未正式實作／回歸／勝率驗證。v6的42個政策及動作空間模組已逐一核對指紋並凍結於`on-play-v7/policy-snapshot`，供下一版同底層規則比較。完整回歸仍須在這個AI修補批次的最終程式狀態執行，不降低門檻。

正式v6續批：v5／ST6-004完整Vitest以825檔／17,306項、1231.87秒、exit0結束後才開始改動。新增15項正式Special Play回歸先重現10項失敗；修正合法指令列舉所有單張／雙張代價組合、包含戰鬥區已滿時的特殊登場，動作identity保留實際犧牲ID避免一般登場與不同付款同鍵；沒有改卡牌／支付／登場規則或新增連段分數。4檔29項通過。凍結v5 bundle SHA=a2027d69ee2713987d91a4eeb9ed68af54bf40f727f1b80892b5c2cffb5714fd與修改前最終runtime完全相同，v6 SHA=997cfdb48c5645b6f338eb910de01b2cd200980fe70e1237daeeca1eb5440c09；兩方規則／資料指紋a6167bd9f2d433dbf9589b12b84a05c86e587266b5517b2b18f31a5c7141563f一致。build／全域lint、AI回歸、Browser與新種子624已完成，結果見上；最終完整回歸尚未完成，不能拿825檔當v6綠燈或宣稱勝率提升。

修補前準備快照（後續結果見上）：Special Play output-only原型另通過七種代價組合／邊界，包含兩種單張付款、雙餅乾付款不重複排列、錯色／有效LV／Special Play資格／數量不足及一般與特殊登場並存；每條實際套用合法。未變更的v5 AI與動作列舉42個模組已逐一核對最終runtime指紋並凍結於`special-play-v6/policy-snapshot`，拒絕覆寫既有快照。新624場比較預先固定seedBase=2026122813，尚未啟動；比較時會把legal-actions動作空間明確納入政策快照，底層支付／登場／卡牌規則保持兩方相同，避免舊政策也取得新招而掩蓋修補效果。正式回歸測試草稿保存在output、尚未套用產品；原完整Vitest程序2524未重啟，後以825檔／17,306項通過、exit0結束。

附帶驗收覆核：`cookierift-addition-demo.ts`的P-163分支以兩次push配置三張己方戰鬥區餅乾，既有測試亦引用index2；此超出最多兩張，不能作為合法實體局面驗收。P-163舊Browser保留為診斷，須拆開紅／綠合法Arena目標與非Arena負向局面後重驗。ST7-005走另一分支，並未配置三張。本次尚未修改該factory或撤除正式卡牌資料，不將全套綠燈當作此問題已修正。

修補前隔離診斷（當時v5完整Vitest使用未變更的產品／測試來源）：確認`legal-actions.ts`只列一般登場，漏列支付戰鬥區餅乾的Special Play。隔離公開反例使用正式BS11-092／111或113／115，戰鬥區兩張、Licorice剩1或4HP、活躍或疲勞，共16種局面（含單張戰鬥區對照）；規則命令拒絕未降級的LV2代價，降LV1後則能合法支付、維持最多兩張。原版即使手動降級仍advance-phase；Mold Dough直接合法Special Play後，既有On Play決策可擊倒對手1HP餅乾。只在output bundle注入完整合格代價組合列舉的原型，在四個剩1HP／兩張戰鬥區反例選Activate降級、再Special Play；4HP四例仍保留來源。每個列舉命令實際套用合法、輸入不變，四個低HP反例替換未知牌庫／HP牌面亦不改動作。基線與原型腳本均exit0，報告`readying-v5/level-special-play-probe.json`及`level-special-play-prototype.json`。這是合成AI反例與output-only原型，不是實體卡驗收、正式修補或勝率提升證據；本輪全套結束後先補正式失敗測試及列舉修正，再做AI／效能／新種子對照。未增加連段硬編碼加分，未覆寫凍結比較bundle。

v5配對差異診斷：312組中一組動作數不同（其餘同數不代表動作相同）。黑色BS12對紅色社群83、seed=2026171619、player-two先手；新版紅方第5回合step34部署P-108 Arena同伴，舊版推進階段。探索性兩分支皆紅方勝，分別15／13回合；強制舊動作保留前決策memory，不能當作因果或最優性證明。完整狀態比較排除文字／命令紀錄，見`readying-v5/changed-pair-first-divergence.json`，此種子已屬診斷資料。

最新v5：公開Arena同伴活躍收益已套用產品，使用權威合法部署與活躍限制判定，只移除一般第二張餅乾懲罰，不假定同伴會存活。34項部署／攻擊專項、build與AI Browser通過；凍結v4.1的40個AI模組不改政策，與v5連結相同規則及資料，新種子seedBase=2026120719的624場全部完成、0錯誤，雙方各312勝（50%）。312組交換政策位置的配對全部各勝一場，尚未測得整體勝率提升，不能以局部反例修復宣稱勝率改善。完整624身份、種子、政策位置、先後手及引擎SHA稽核通過；規則／資料指紋0c7eb47b5d2e718c25967f7d90a7c436e4813b67d9a387c31bd96994070239ad。比較在ST6-004 mapping／promote前凍結，該卡不在12副比較牌表中，原bundle不覆寫。報告在output/ai-cookierift/readying-v5。

ST6-002合法局面修正已套用，23項專項與正式雙尺寸Browser26案通過，取代舊非法三餅乾局面。ST6-004正式Vitest先重現Then缺漏與strict目標證據兩項失敗；明確mapping後28項卡牌／實體局面測試、strict單卡verified與候選雙尺寸Browser34案通過，validate後已promote，正式12張／候選88張。promote後與AI v5／能力稽核共4檔45項通過，registry／正式資料驗證通過；ST6正式4張AI能力ready，全球仍因既有unsupported項目為conservative。004正式Browser同34案重驗通過；本輪最終build／全域lint通過，最終程式六色完整鏡像350次搜尋無搜尋超時／無丟棄完整評估。最終runtime bundle另存candidate-final.mjs與180項來源指紋，不覆寫比較bundle。本輪完整Vitest825檔／17,306項通過（full-vitest-readying-v5-st6-004.log，1231.87秒、exit0）；執行期間產品及測試來源未變，之後才開始v6修補。

前批隔離診斷（後續套用結果見上）：v4.1在僅有疲勞BS12-015、手持同為LV2／HP2／普通2的Arena BS12-002及非Arena ST1-001時，兩種手牌順序都選擇結束主要階段。經實際合法部署與雙方推進階段，只有Arena同伴能解除來源下一個Active Phase的活躍限制。隔離原型使用權威`isCookieActivePhasePrevented`，僅在合法部署後解除公開限制、且無未完成決策時移除一般第二張餅乾懲罰；不假定同伴一定存活。六項helper檢查與兩種順序的AI重現通過；真實時鐘下兩種手牌順序也均部署Arena同伴（arena-readying-prototype-real-clock.json）。尚未套用產品或取得新勝率證據。v4.1目前40個可達AI政策模組已依既有比較manifest逐一SHA256核對並凍結於`output/ai-cookierift/attack-allocation-v41/policy-snapshot`，供後續同規則對照，未覆寫v3基準。

預組驗收覆核發現ST6-002舊fixture有三張對手戰鬥區餅乾，違反最多兩張限制；撤回舊26案Browser的合法實體局面驗收解讀，正式收錄狀態不等同驗收完成。修正與重驗列為下一個逐卡閘門，詳見預組矩陣。ST6-004另確認Then遺失，只有隔離mapping結構比對通過，仍留候選。該批完整Vitest保持來源不變並以822檔／17,262項通過，1223.77秒、exit0；這些新發現不會被全套綠燈自動消除，002後續重驗結果見上。

目標：以六色社群構築擴充比賽對手，修正可重現的不合理決策；使用固定舊引擎、相同種子、雙方位置及先後手比較。網站牌表只作構築來源，合法性與效果以本專案正式卡池判定。

目前進度與驗收：

攻擊分配續批：正式Vitest四種排列先全部重現溢傷錯誤，v4加入公開普通攻擊與支付分配後通過；v4 AI回歸61檔／941項、build／全域lint／AI Browser通過，真實時鐘六色鏡像350次搜尋無搜尋超時。v4新種子624場（seedBase=2026111701）完成且0錯誤，但新版307勝／舊版317勝（49.20%）；312組配對中新版全勝5組、舊版全勝10組、297組各勝一場，沒有達成提升勝率。全部失敗表現保留在output/ai-cookierift/attack-allocation-v4，不刪場或換種子當作通過。失利配對追蹤發現同等擊倒收益仍因HP總傷害重複加分而改變目標；獨立4+3傷害對5／7HP反例先失敗。v4.1移除分配模型的HP傷害加分，只比較擊倒收益，同分交回既有風險評估；仍使用實際規則合法攻擊、指定色支付與公開減傷，不執行未知FLIP／陷阱／Then／昏厥，不將預測狀態作真實結算。正式分配回歸12項與promote後ST6-003／能力盤點共4檔26項通過，build通過。v4.1 build／全域lint／AI Browser通過；全新624場（預先固定seedBase=2026114387）完成、0錯誤，新版307勝／舊版317勝（49.20%），312組配對中新版全勝6組、舊版全勝11組、295組各勝一場，仍未證明勝率提高。賽果與完整624身份集合稽核在output/ai-cookierift/attack-allocation-v41；六色真實時鐘完整鏡像350次搜尋無搜尋超時。基準使用已保存的v3 AI來源，不修改政策，雙方連結相同目前規則／卡池，指紋4058cbc816289a1e0c72fbd741cba39322c231082b529c695d66ef9f1e4ce47d。此版完整Vitest822檔／17,262項通過（1223.77秒、exit0），早於本輪v5／002局面／004變更。

2026-10-10效果傷害續批（全套曾失敗，專項重驗通過）：目標排序改用遮罩未知牌後的規則傷害預測，包含公開減傷、效果免疫、到期及來源光環；策略只接收每目標數值，不接收完整GameState。Activate、攻擊Then、陷阱、FLIP共用選擇及pending ability／faint／afterDamage入口已接線。新增9項AI反例測試涵蓋Lv3～5、實際普通攻擊父流程及隱藏牌替換；初始6項反例全部失敗，修正後通過。受影響AI回歸60檔／930項通過，268.98秒、exit0，`output/ai-cookierift/effect-damage-ai-regression.log`。這證明已測反例改善，尚未證明整體勝率提高；新版624場新種子比較已完成，新舊各312勝（50%）、0錯誤；312組交換政策位置配對中，新版兩場皆勝1組、舊版兩場皆勝1組、310組各勝一場，未顯示整體勝率提升。seedBase=2026109901，報告與賽果稽核位於output/ai-cookierift/effect-damage-v3/matched-effect-damage-fresh.json及matched-effect-damage-fresh-audit.json，皆exit0；兩個引擎規則／資料指紋83cb1edd5a37d4446f3ef11c1272961195eda455ad92689f8ba1401bbbe6c484相同，舊政策亂數管線36場／6,950動作等價核對通過。這組種子是為此版預先選取，後續若用來分析或調整策略，須另換新驗證集。本批完整Vitest已結束：819檔中817通過／2失敗，17,236項通過／2失敗，共17,238項，1225.57秒、exit1，output/ai-cookierift/full-vitest-effect-damage-st6-002.log。兩項為promote後仍期待2033的舊inventory基準，以及種子重現案例超過原5000ms限制；前者已依獨立匯入證據改2034／1551並新增單卡能力檢查。所有重型工作結束後以原timeout／assertion重跑，2檔4項通過、507項未選取，exit0，effect-damage-full-failure-recheck.log。不把專項重驗當成全套綠燈；本版最終完整重跑819檔／17,239項全部通過，1195.95秒、exit0，output/ai-cookierift/full-vitest-effect-damage-st6-002-recheck.log；未放寬timeout或assertion。獨立同版引擎40場重跑也一致。舊批817檔全套與624場50.32%不能作為此版本最終驗收或勝率。

ST6-002本批已完成原圖契約、4項規則整合及14項實體局面測試；Chrome1366×768／1164×777技能14案、攻擊Then12案通過，包含錯色／錯階段／Once已用、選零／取消、RR普通1後可選來源頂HP代價、最後HP由真實攻擊減至1後支付、原防守者昏厥時不付費或轉打。首輪driver誤期待固定原目標需要另選，失敗紀錄保留；run3為12案完整攻擊矩陣，不累加run2重複案。strict verified、validate與單卡promote exit0，正式檔`data/cards/official-st6-002.en.json`；registry／正式卡資料驗證通過，promote後正式Browser同26案重驗通過；build、全域lint及AI Browser exit0。ST6～ST10正式10張、候選90張；剩餘strict48 verified／42 needs-review／0 blocked，exit1，`output/st6-st10/contracts-remaining90.json`。最後HP成本昏厥後另完成不補位父流程，確認視窗關閉並返回主要階段；正式攻擊矩陣最終run6共12案，另加技能14案，不重複累計歷史run。run4／5錯誤期待source-filtered契約trace含補位命令的driver診斷保留；來源無關的skip-replacement不在該trace內，補位以真實UI及規則測試核對。未做ST6-002逐卡online驗收。

ST6-003本批完成原圖（紅LV2／4HP、NNN普通3、無技能／Then／FLIP）、strict verified、2項卡牌／8項原始實體局面測試與Chrome雙尺寸10案。混色任意能量支付、3傷害、取消、不足能量、錯階段及真實攻擊後疲勞均驗證；第一輪driver把目前HP／印刷HP格式誤當純數字，失敗保留，修正讀取格式後run2候選10案通過。validate／單卡promote／registry／正式卡資料驗證通過，正式11張／候選89張，剩餘strict47 verified／42 needs-review／0 blocked（exit1）。正式Browser同10案重驗通過，實際混色支付3張、對手4HP→1HP及來源疲勞已核對；來源篩選trace只列declare-attack，普通結算另以實際UI狀態與規則命令測試證明，不虛構resolve trace。本批全套尚待完成；逐卡online未驗收。全正式AI能力稽核仍因原有unsupported卡而conservative（exit1），ST6正式3張則ready、無轉換／能力缺口（exit0）；獨立數量2035 inventory／1552唯一機制已同步測試。

目前12副對戰構築的AI能力覆蓋交集已核對：BS12紅缺BS12-014／015、社群紅83缺BS12-015、社群黑506缺BS11-092，其餘9副無本次audit列出的unsupported交集。014／015為缺少另一張Arena時不在Active Phase活躍的公開被動，015另有已辨識的攻擊Then1；092為免費Activate Once本回合來源LV變1。這是策略模型缺口，不是規則轉接失敗。原始runtime效果與覆蓋交集保存active-capability-gap-effects.json與active-deck-capability-gaps.json；尚未修改其AI能力模型，下一批先建立實際決策反例。

以下為前批歷史證據（不是本版最終驗收）：

2026-10-10續批：共用gain-hp在固定sourceOnly來源已離開戰鬥區時不補HP並繼續結算，仍拒絕非法的手動必選目標。新增回歸先重現2項失敗；修正後實際社群藍921／紅83 seed=202671171完成，相關4檔32項通過。AI pending battle／decision傳遞同一步shuffleSeed，GameCommand及playTrap將注入的shuffle傳到每段陷阱效果；紫色鏡像seed=202610114先重現未注入亂數，再在禁止Math.random下發動BS2-079並完成，兩次結果完全相同、輸入不變。ST6-002原圖重驗後補上缺失的可選自身頂HP代價Then及原攻擊對象2傷害；2項卡牌契約與4項規則整合通過，strict單卡verified／exit0，仍未Browser驗收或promote。此批build、全域lint、AI Browser均exit0；完整Vitest 817檔／17,215項全部通過，1223.95秒、exit0，`output/ai-cookierift/full-vitest-pending-seed-st6-002.log`及同名`-exit.txt`。全套啟動後程式碼與測試未再變更，後續只有報告更新，沿用本批build／lint／Browser結果。

本批比較方法已核驗：固定舊政策ref=1c155d873941b7f0a932163e190a86533f8894b9，38個政策模組只在三檔補相同pending-command亂數管線，其餘政策內容不改；兩個比較引擎使用相同目前規則與資料（SHA256=d666d80e85ed254c0cf09489fe0b5fc41a9897ca6fd186f9543c56630632870c），原凍結bundle保留不覆寫。未改管線的舊政策由隔離診斷shim注入同一步RNG，對照正常管線的版本，36場／6,950動作與精確結果狀態一致；這是有限樣本核驗，不是普遍等價證明。來源與逐項變更記錄於`output/ai-cookierift/seeded-policy-reference-manifest.json`。

以原診斷seedBase=202610270重跑624場，雙方相同目前規則及受控洗牌、禁止Math.random，全部完成、0錯誤，新版314勝／舊版310勝（50.32%）。312組同牌表／種子／先手、交換政策位置的配對中，新版兩場都贏2組、舊版兩場都贏0組、各贏一場310組；仍不足以宣稱穩定勝率提升。原seed=202671171兩個失敗位置皆已完成，沒有刪除樣本。這組種子已用於診斷，不當作未見過的獨立驗證集，也不代表對真人勝率。報告及賽果／雜湊稽核為`matched-seeded-current-rules-regression.json`與`matched-seeded-current-rules-audit.json`，皆exit0。

各色各有104場由新版持有、104場由舊版持有。這是固定12副牌表及本種子集合的AI對戰結果，包含同色對局，不能解讀成真人環境勝率或牌組強弱的普遍排名。

目前版本另跑真實時鐘六色BS12鏡像完整對局，全部結束，350次搜尋／0 time-budget／0丟棄完整評估；`output/ai-cookierift/runtime-probe-pending-seed-full.json`與`.log`，exit0。此有限樣本不排除其他牌序或裝置的逾時。

| 顏色 | 新版勝／場 | 舊版勝／場 |
|---|---:|---:|
| 藍 | 42／104 | 41／104 |
| 綠 | 32／104 | 32／104 |
| 黃 | 51／104 | 51／104 |
| 紅 | 54／104 | 51／104 |
| 紫 | 61／104 | 61／104 |
| 黑 | 74／104 | 74／104 |

目前工作順序：來源離場後補HP及陷阱亂數傳遞已修正；舊政策重接目前規則的亂數管線核驗36場／6,950動作一致，624場原失敗種子集合及本批完整回歸已完成。接續修正效果傷害目標估算，驗證隱藏牌替換不改變決策，再以新的種子集合衡量策略；預組由ST6-002的實體Browser驗收接續，逐卡通過後才promote。來源盤點、strict verified與正式卡池狀態分開記錄，不能互相替代。

下一批若修改共用規則，須先修正比較方法：原凍結bundle內含舊規則，不能在新規則修補後仍宣稱雙方使用相同規則。保留原bundle／SHA256不覆寫，另以凍結舊AI政策檔搭配目前規則建立比較引擎，記錄政策與規則來源指紋並核驗公平性，再重跑失敗種子及完整比較。此批v2只改AI與公開事件投影，ST6-001唯一mapping不在12副比較牌表中，既有對照不因這張mapping改變戰鬥規則。

比較證據限制更新：隔離原型 `baseline-policy-current-rules.mjs` 由HEAD=1c155d873941b7f0a932163e190a86533f8894b9的38個AI政策模組搭配目前規則建置，171個來源指紋記錄於同目錄manifest，原凍結bundle未改。36場逐步比對6,798個動作，35場一致、紫色鏡像seed=202610114先手第110步不同；兩版送出相同Yew Village Scroll指令，差異在洗牌後牌序。`unseeded-trap-probe.log` 在隔離診斷攔截Math.random，確認原凍結版、重接原型、目前v2皆走defaultShuffle未注入亂數。原型仍為未驗收、不得當正式基準；先前固定種子對照的勝負數保留為診斷資料，撤回任何「整場所有亂數均已受控」解讀，不能證明嚴格配對勝率提升。v2兩份報告已加comparisonValidity／limitation，不更動勝負數或刪除失敗樣本。下一批須補齊正式AI各洗牌入口的種子注入、驗證原型政策一致性，再做公平比較。

- 已凍結修改前引擎至 `output/ai-cookierift/baseline-engine.mjs`，不覆寫基準。
- 即時網站共收錄12副原始牌表。接受六副：藍921、綠927、黃67、紅83、紫568、黑506；其餘六副保留原表隔離，缺卡不得替換或靜默刪除。每副來源為 `https://cookierift.com/decks/community/<編號>`；原始卡號／數量與作者記錄在 `data/decks/cookierift-community-20261010.json`。來源牌表標題中的賽事名次不作官方賽果證據。
- 六副接受構築均主牌60張，Extra分別6／4／6／6／6／4張；正式卡池合法性、逐項張數、唯一實例及選單回歸43項通過。AI選單先列既有六副BS12，再列六副社群構築；不修改使用者原牌表或儲存牌組。
- 確認Lv.5目標評分以未套用目標減傷的攻擊力估計傷害，會對公開減傷後0傷害的高LV目標攻擊，放過可擊倒的另一張餅乾。回歸先重現選錯目標，再改用權威 `getAttackDamageAgainst`，同步修正攻擊分數、致命估計與保留攻擊預測；回歸通過且輸入狀態不變。
- 真實時鐘的96次初期搜尋探測未出現超時或丟棄完整評估；此有限樣本不能排除整場後期超時，也不支持將超時視為已確認根因。未修改搜尋時間上限。
- 第一輪只修正目標減傷的624場比較全部正常結束，新舊各312勝，50.00%；保存為 `matched-public-damage-only.json`，不能宣稱整體勝率提升。
- 進一步重現活躍效果錯選已活躍高價值餅乾，放過疲勞、能恢復攻擊的餅乾。公開目標排序改為優先疲勞者；純活躍效果全部候選已活躍時可選零；加攻後活躍同一目標則保留加攻本身價值。Lv3～5及P-163組合回歸通過，31項專項測試。策略版本為 `lv5-public-damage-reactivation-v1`。
- 第二輪開發比較624場正常結束，仍為新版312勝／舊版312勝。另以全新seedBase=202610190完成624場保留集：新版310勝／舊版314勝，新版49.68%，無錯誤或未結束對局；未證明整體勝率提升。12副牌表78種配對、2種種子、雙方策略位置、兩種先後手，雙方共用目前正式卡牌與權威規則，只交換新舊AI決策；持續策略記憶、確定性搜尋時鐘、500動作上限。不代表對人類玩家勝率。報告分別為 `matched-comparison.json` 與 `matched-holdout.json`。
- 完整六場BS12鏡像對局的真實時鐘探測350次搜尋，0次超時／丟棄完整評估、六場均結束；有限樣本仍不能排除其他硬體或局面超時。
- 本批AI最終完整Vitest 810檔／17,186項全部通過（1221.51秒，`full-vitest-final.log`，exit0）。當時正式資料22份、2,088筆卡號、2,032筆成功轉接；build、全域lint、`validate:cards`及`check:card-pool`皆exit0。最終AI Browser（`output/ai-cookierift/ai-browser-final.log`）exit0；六副社群構築雙尺寸12個實際開局流程通過。後續ST6-001唯一卡號mapping不改AI政策或上述12副牌表，另執行本批完整回歸。
- 唯讀診斷另重現效果傷害pending目標排序忽略公開效果減傷：`effect-damage-probe.log`，實際選protected（0傷害），正確候選vulnerable可受2而昏厥。尚未修改此入口；這與已修正的普通攻擊估算不同，列為下一個AI修正點。
- 另以實際 `takeAiStep(level:5)` 重現同一問題：`effect-damage-action-probe.log` 中AI發動技能卻沒有傷害任何對手，權威 `applyGameCommand` 選另一合法目標則能使2HP目標昏厥並開補位。此為合成AI單元局面，證明實際決策入口缺陷，不能當作實體卡Browser／promote驗收。
- 保留集逐步診斷另確認活躍排序回歸：BS12紅對社群黃67、seed=202640991、後手局面，Strawberry Mochi對已活躍P-175選零，漏掉「本回合被效果設為活躍」條件。獨立規則探測 `active-ready-payoff-probe.log` 顯示選零不能啟動P-175技能，選P-175可以；即使目標原已活躍，仍有實際收益。下一步依公開結構化條件保留此類目標，不以卡號特判。此保留集已用於定位，後續改動須另用全新種子評估，不能再宣稱它是未參與開發的保留集。已修正為v2：依結構化Activate／攻擊Then條件保留活躍目標，並將本次battle entry被設為活躍的公開事件投影至PlayerView，避免已解鎖目標被重複選取。7項失敗基線重現後，新增9項回歸及相關4檔42項通過；v2最終完整Vitest 813檔／17,204項通過（1219.84秒、exit0，`full-vitest-reactivation-v2.log`）；build／全域lint／AI Browser亦exit0。效果傷害排序問題仍待修，不能宣稱AI整體改善已完成。
- v2（`lv5-public-damage-reactivation-v2`）build／全域lint／完整AI Browser皆exit0；受影響紅對黃種子重播不再出現原先決策差異，兩種策略位置皆紅勝（`holdout-divergence-v2.json`）。原開發種子624場：新版311勝／舊版313勝、49.84%，全部正常結束（`matched-reactivation-v2-development.json`）；仍未證明整體勝率提升。全新seedBase=202610270保留集結果見下段，失敗樣本全部保留。新版真實時鐘六場完整鏡像對局350次搜尋，0超時／0丟棄評估（`runtime-probe-v2-full.json`），是在完整Vitest與保留集同時執行的本機有限樣本，不能外推其他硬體或所有局面。
- v2新種子保留集已結束但FAIL（exit1）：624場中622場完成，新版313勝／舊版309勝；兩場同seed=202671171、社群藍921對紅83、先手player-one在第56步出錯「增加HP的目標餅乾不在戰鬥區」。不採用排除兩場後的50.32%作驗收或勝率提升證據。`holdout-error-replay.json` 重播全舊／全新／兩種混合策略皆同一步失敗：P-117在對手Cherry FLIP後已離場，attack-effect佇列第二段仍執行sourceOnly gain-hp，己方戰鬥區已空。這是共用攻擊後續結算缺陷，下一批須以實際父流程建立回歸、確認來源離場後的合法no-op，再重跑所有失敗種子與完整保留集；不得刪除失敗樣本或換種子掩蓋。
- 已補讀專案採用的官方完整規則v1.8本機正文（`test-results/bs10-comprehensive-v1.8.txt`）：§7-1-3-2-1在Damage Step讓Then進待命，§8-1-2按可執行程度結算，§8-3-4-1在可行時才要求指定張數；§8-3-5僅禁止待命來源進私人區後啟動。失敗局面的P-117在公開Break，不符合私人區取消條款。依上述一般規則作專案適用，後段sourceOnly補HP沒有現存戰鬥區來源應為不補HP且繼續結算，而非拋錯；尚未實作／Browser驗收，不宣稱取得P-117專屬官方裁定。

## 兩張授權補充卡

P-163及ST7-005先在 `data/candidates/cookierift/` 隔離。官方英文原圖已逐張目視，原始圖檔與來源資料保存在 `output/ai-cookierift/`。P-163：紅色Arena、LV3／6HP、RRR普通3；Activate Once支付R，另一張任意色己方Arena本回合攻擊+1，再將同一目標活躍，可選零、不加來源REST代價。ST7-005：黃色LV1／1HP、YY普通2；實際揭示FLIP後棄一張任意手牌，原HP持有者補1HP，包含最後HP救援。

兩張strict契約verified；12項規則／實體身分測試通過。Chrome在1366×768及1164×777完成18案：P-163付款、跨色合法目標、自身／非Arena排除、支援疲勞阻擋、選零與取消；ST7-005實際傷害FLIP、棄牌、無手牌阻擋、略過及最後HP救援。核對原圖載入、實際公開指令、支付橫置、攻擊力／活躍狀態與完整傷害後HP；零pageerror。報告：`output/ai-cookierift/browser-additions/results.json`。這是局部實體流程，不是逐卡線上同步驗收。

已執行 `validate:candidate -- --dir data/candidates/cookierift` 及 `promote:candidate -- --dir data/candidates/cookierift`，exit0；正式檔為 `data/cards/official-cookierift-additions.en.json`，preview與測試改讀正式檔。ST7候選整副資料同步排除此已promote卡，避免重複匯入。

## ST6～ST10完整預組：尚未完成

官方來源各20張，共100張，無異圖。原有正式ST8一張、ST9一張、ST10五張；本批ST7-005及ST6-001完成後，正式共9張、候選剩91張。未驗收卡維持 `data/candidates/st6-st10/` 的inventory狀態，沒有提前promote。

初次93張候選驗證發現42個轉接錯誤；strict為49 verified／44 needs-review。排除ST7-005後的92張strict歷史快照為48 verified／44 needs-review／0 blocked。001修正並promote後，對剩餘91張重跑strict：48 verified／43 needs-review／0 blocked，exit1；最新報告為 `output/st6-st10/contracts-remaining91.json`。這些是來源文字／runtime契約盤點，不能當作實體驗收。100張官方原圖已全部逐張目視，獨立印刷預期記錄於[逐卡盤點](st6-st10-card-inventory.md)，SHA256與來源URL在 `output/st6-st10/image-manifest.json`；其餘卡的效果驗收仍待完成。

ST6-004～008亦已目視原圖作來源盤點，未推進效果驗收cursor：004紅色Dragon LV2／4HP，Activate Once棄任意手牌使自身本回合攻擊+1，RRR普通3後可另付R、選0～1任意對手受1；額外R由支援支付，不由來源自動產生。005紅色LV1／1HP、RR普通2，FLIP棄任意手牌使原HP持有者補1。006紅色LV2／4HP、RRR普通3，FLIP此揭示Cookie回手，不是原HP持有者回手。007紅色LV3／4HP、RRRR普通4，FLIP同005。008紅色LV2／3HP、RRR普通3，FLIP可抽0～1。全部仍須實際支付、目標、Then及Browser A/B。

ST6-001已完成獨立預期→失敗基線（技能缺失）→exact效果／sourceOnly HP成本→strict verified。9項專項／受影響7檔691項通過；1366×768及1164×777 Chrome14案通過，實際能量→HP代價→目標流程、選零／取消／疲勞支援、最後HP由實體Leek普通1傷害後再支付、來源昏厥仍傷害、正常R1攻擊與付款不足均已核對。最後HP不是改寫印刷HP，所有牌區原圖／唯一實例／60張及四張限制均有測試。

001以獨立單卡候選完成 `validate:candidate`／`promote:candidate`，exit0；正式檔 `data/cards/official-st6-001.en.json`，剩餘ST6候選同步排除它。promote後registry與正式資料驗證exit0：23份資料、2,089筆卡號、2,033成功轉接；正式build／全域lint及Chrome同14案重驗exit0。原始兩次driver診斷（支付步驟順序與顯示空白）保留，不列通過。報告 `output/st6-st10/st6-001-browser/results.json`。本批最終完整Vitest 812檔／17,195項全部通過，1137.49秒，`output/st6-st10/full-vitest-st6-001.log`，exit0；001未做逐卡online驗收。

目前效果驗收cursor為ST6-002：Activate Once付R使0～1對手受1，RR普通1後可支付最上方一張自身HP，原攻擊再2；003紅色LV2／4HP，NNN普通3，無技能或FLIP。002原圖再次放大核對，修正來源盤點誤記的「免費」，既有技能R代價正確；失敗基線確認缺少整段attackEffects／HP代價，已補exact map並取得strict verified、2項卡牌及4項規則整合通過。原91張候選最新strict為49 verified／42 needs-review，exit1，報告`output/st6-st10/contracts-remaining91-after-st6-002.json`。002仍缺實體Browser驗收，維持inventory；其餘未驗收者不得進正式卡池。

來源入口：https://cookierift.com/decks 。檢索工具快取與即時網站不同，以即時頁面為準；牌表抓取日 2026-10-10。

本次依後續授權匯入並驗證補充卡及ST6～ST10；保留既有六副BS12牌表、使用者AGENTS.md及無關未提交產物。未stage／commit／push。



本版額外證據：真實時鐘六色完整對局350次搜尋、0逾時／0丟棄評估，output/ai-cookierift/effect-damage-v3/runtime-probe-full.json，exit0。最終全套執行期間發現AI卡池稽核仍採promote前的2033／1550基準，已同步為2034／1551並新增ST6-002無轉接／能力缺口檢查，專項3項通過；全套原失敗紀錄不刪除。紅色社群83鏡像seed=2026200801／後攻先行的公開分歧局面已保存：第6回合step66，新版用Limited Edition Record使Rye增攻並活躍，舊版直接Red Osmanthus攻擊。探索性強制舊動作分支勝負改變，但保留前決策memory，並非最優操作證明；此種子現已用於診斷，後續策略調整需另外驗證集。

本批最終收尾：最後HP付款的實體局面測試已補完pendingReplacement.tasks與skip-replacement父流程，14項通過（st6-002-physical-final-run2.log）；正式攻擊Browser最終run6為12案，加正式技能14案為26案。最後程式／測試狀態build exit0（build-st6-002-final.log）；全域lint及AI Browser在產品來源最後變更後通過，之後只補稽核／實體測試及driver，補改檔eslint亦exit0。資料驗證24份／2090卡號／2034轉接、registry一致、正式10／候選90無重複、diff check通過。未stage／commit／push。下一批先完成全套重跑；主目標續查紅色分歧中的目標價值、手牌成本及未知FLIP風險，再用新驗證集；次目標由ST6-003開始，不能跳過90張或將來源盤點當作驗收。
# 2026-10-11 最新驗證續記

正式 v9／P-163 的完整 Vitest 已完成：834 檔、17,416 項 PASS，1341.17 秒、exit 0；1576 份來源指紋在新增 ST6-007 前一致。報告 `output/ai-cookierift/formal-saving-trap-v9/full-vitest.log`。ST6-007 其後候選及正式雙尺寸同 28 案、正式 30 項測試、資料／registry 通過並 promote，現 15 正式／85 候選；本完整回歸未涵蓋新增 007。

禁止將盲目減傷原型直接套入正式：合法兩 Cookie／每方 60 張的實際兩次攻擊反例，Chamomile 普通 1 後 Sour Belt 普通 4，對手剩 3 支援可支付第二擊。減攻陷阱選第二隻時己方 Sour Belt 最終 2 HP，盲目選當前攻擊者則昏厥。見 `output/ai-cookierift/trap-damage-v10-prototype/second-attack-counterexample.json`。新 output-only 原型以公開剩餘支援、是否 REST、權威能量費用與普通傷害評估後續攻擊，該反例保留 2 HP；不結算隱藏 HP／FLIP，也不聲稱預測額外技能。正式仍為 `lv5-public-saving-trap-target-v9`，新原型 seedBase=2027031917 的凍結 624 場比較已開始，尚無終值，不計入正式勝率證據。


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

2026-10-11 AI 防守減傷診斷：`output/st6-st10/ai-v13-defender-reduction.json` 已用既有 CAKE POPs 原卡情境，實際宣告攻擊、跳過陷阱、逐點傷害結算，驗證五組對照。正向／普通2／普通3三組實傷均為1、來源2HP剩1，但 evaluateTrapWorth 以 getEffectiveAttack 誤判昏厥；直接評估 ST6-019 得102，改讀 getAttackDamageAgainst 的 output-only 草稿為67，無具名見證反例仍102、一傷害仍67。這只證明評分根因；ST6-019未加入此情境手牌，沒有合法陷阱選擇或決策後悔證據，且兩者均高於50門檻，不能宣稱省下陷阱或提升勝率。未修改正式AI，ST7-012完整測試20395仍執行中，維持來源凍結。

2026-10-11 ST7-011 HP邊界續驗：output/st6-st10/st7-011-hp-boundary-sequence.json 四列（baseline／隔離草稿各兩案）PASS。來源印刷2HP，由原卡Ginger普通1實際打至1HP，經真實換回合、YY普通2與Then後，草稿1→2，baseline仍1。另一案第一次真正Then使2→3，經雙方正常階段推進再攻擊，草稿維持3、不再補HP，baseline維持2；沒有直接準備超過印刷的HP或手動重置REST。逐命令檢查輸入不變、雙方60張、唯一實例與四張限制。此為output-only輕量規則探測，不是型別／Vitest／strict／Browser／promote驗收；來源中途離場、Refresh及其餘UI仍待驗。正式來源維持1703指紋凍結，ST7-012完整重跑session24602待終值。

2026-10-11 ST7-011 Refresh續驗：output/st6-st10/st7-011-refresh-sequence.json／run3 PASS。原卡2HP來源、5HP具名Tree與準備式合法剩1張牌庫，真正YY普通2及傷害結算後，source-only Then自動補至3HP且耗盡牌庫，pendingRefresh為player-one／remainingDraws0。實際refresh-deck以明列shuffleSeed與原卡LV1棄牌餅乾支付後，來源維持3、Tree維持5、牌庫46、沒有遺留Refresh／Then，逐指令保留每方60張、唯一實例、四張上限與輸入不變。run1草稿誤期待source-only需pendingAttackEffect，實際會自動處理；run2觀察確認後，run3改為明確斷言無該視窗，未更改產品。此為output-only隔離規則探測，非型別／strict／Vitest／Browser／promote；零牌庫中途補HP續接、來源在FLIP離場與其餘UI尚未驗。完整回歸24602仍執行，正式來源維持凍結。

2026-10-11 ST7-011 strict隔離草稿：output/st6-st10/st7-011-strict-mutants.json PASS，30種錯誤runtime變異中，沿用同一output-only轉接但未加精確guard的baseline漏27種；新增guard後漏0，原始轉接兩臂皆verified。檢查原始黃色LV1HP2／YY普通2、唯一source-only補1HP、sourceHP≤2及同張己方battle同名Tree目前LV恰3，拒絕多餘效果／條件／目標filter／關鍵字。包含去掉HP或具名條件、any-of、放寬LV範圍、對手見證、negate、非來源或多目標與額外Then。草稿與source map僅在output，未改正式ledger／types／轉接，尚非型別／Vitest／Browser或promote驗收；完整回歸24602仍待終值。

2026-10-11 ST7-011實際FLIP來源離場續驗：output/st6-st10/st7-011-departed-flip-sequence.json／run4 PASS，baseline與隔離轉接各14個指令。來源原始2HP先經Ginger普通1至1HP，真實換回合後YY普通2揭示原卡BS1-002 Kumiho，對手實際棄任意手牌支付FLIP並對攻擊者造成1，使ST7-011進Break；雙方補位選擇與後續傷害完成後，Tree維持5HP、己方牌庫張數不變、無pending Then／battle。逐指令驗輸入不變、60原卡、唯一instance與4張限制，FLIP視窗暫存的revealedHpCard亦計入60張。run1／2漏計該暫存卡且誤認頂層pendingFlip；run3誤讀補位tasks為playerId，均依實際型別修正探測，沒有改產品或放寬60張斷言。此為隔離輕量規則證據，不是型別／Vitest／strict／Browser／promote驗收；正式來源凍結與完整24602重跑仍維持。

2026-10-11 ST7-011型別化草稿準備：output/st6-st10/st7-011-fixture.draft.ts與st7-011-physical.tests.draft.ts已備，13種原卡fixture／25項Vitest測試草稿。輕量esbuild轉譯及實際規則preflight十三案PASS（st7-011-typed-fixture-preflight.json）：每方60原卡、唯一instance、4張限制、初始印刷HP，正向／疲勞Tree補至3、錯名／對手／Break／支援／無見證不補，來源REST／錯色／疲勞能量／不足能量／錯階段拒絕且輸入不變，短牌庫正確觸發Refresh。這不是TypeScript型別檢查或Vitest／Browser驗收；測試草稿尚未執行，來源離場／1HP／3HP／Refresh完整父流程先前的輕量證據仍需整合至正式測試。完整threads重跑30021仍執行、維持1703來源凍結。

2026-10-11 ST7-011隔離正式測試草稿續備：新增st7-011-card.tests.draft.ts，32項（獨立印刷預期、conversion／provided evidence、30種strict變異）；連同physical草稿25項共57。新增st7-011-isolated.config.ts（保持產品base設定，僅output map覆寫type／runtime condition／adapter／ledger，threads單worker）及typecheck-st7-011-isolation.mjs（沿用app tsconfig、覆寫CompilerHost、noEmit，包含全部src與三份草稿）。型別腳本僅node --check語法PASS，尚未執行TypeScript或Vitest，不列入通過數；仍須把1HP／3HP／Refresh／FLIP離場輕量父流程整合測試與Browser。完整30021仍執行，正式來源凍結。

2026-10-11 ST7-011父流程整合：fixture草稿新增injured-one-hp／three-hp／departed-flip，全部經真正Ginger攻擊／YY與Then／正常階段推進／Kumiho HP FLIP及棄牌支付準備；不直接改HP或重置REST。physical草稿新增四項（1HP、3HP、最後牌庫Refresh、FLIP來源離場），現29項physical＋32項card＝61項尚未執行。更新preflight run2十六案PASS，每方60張、唯一原卡／四張限制；3HP對手Tree剩3亦來自第一次真實普通2。三條準備父流程與來源離場／牌庫不動／Tree不被誤補已在typed fixture版本重現，輕量probe不是型別或Vitest驗收。完整threads30021仍執行，來源凍結維持。

2026-10-11 ST7-011 Browser準備：prepare-st7-011-browser-isolation.mjs已重新核對獨立原圖SHA，再生成六檔output shadow map（types／targeting／adapter／ledger／demo路由／factory）、隔離Vite config及st7-011-browser-matrix.json。16情境×1366x768／1164x777＝32案均標NOT_RUN，列出印刷2HP／YY普通2、具名位置反例、支付／階段／REST阻擋、實際1HP／3HP父流程、Refresh與Kumiho離場的預期；未build、未執行Chrome driver／截圖／精確重播，不列為Browser通過。正式src／scripts／data不變，完整threads30021仍執行。

2026-10-11 AI防守評分合法選擇續驗：output/st6-st10/ai-v13-stored-reduction-choice.json／run4 PASS_ACTUAL_CHOICE_DIFFERENCE。60張原卡準備局面，第一張對手Ginger N普通1攻擊己方Cherry時，真實Frozen Flame R支付選另一隻印刷2HP Ginger，使其本回合普通傷害-1；第一戰結束再由真實Sorbet BB普通2攻擊Ginger，規則實傷1。v13 Lv3／4／5皆因getEffectiveAttack誤判致命、score54而支付RR打ST6-017；只改讀getAttackDamageAgainst的隔離草稿score39，三級皆略過並保留陷阱／兩張R。實際傷害後baseline Ginger仍2HP、三張R全REST；隔離Ginger剩1HP、僅先前Frozen的一張R REST，兩者都存活。這證明評分根因會改變合法動作，不代表保留陷阱必然比保住1HP更有勝率價值；尚無Browser／整場比較／正式政策修改。逐父指令驗60張／唯一原卡／4張及輸入不變；run1錯用trap instanceId，run2誤選實體Cherry普通3費卡（未改印刷，改用原始Sorbet BB2），失敗保留。完整30021仍執行、正式來源凍結。

2026-10-11 AI減傷選擇安全對照續驗：stored-reduction-choice run5擴為兩策略×三級×三場景＝18列PASS，report保留相同入口。protected-nonlethal（Sorbet普通2、Frozen減1、Ginger2HP）僅修正策略score39保留RR陷阱、結算剩1HP；v13 score54支付RR、剩2HP。no-protection改第一戰真實skip，第二戰實傷2；protected-still-lethal用原始Devil NNN普通3與四張合法對手支援，Frozen減後實傷2；兩種致命對照中新舊Lv3／4／5都支付RR打ST6-017，Ginger仍2HP。支援實際REST數與陷阱是否留手已明確斷言，沒有修改卡片印刷或準備虛構減傷標記。這是局部動作與防守門檻對照，尚未正式實作／測試／Browser／新種子整場比較，不能宣稱勝率提升。完整threads30021仍執行，正式來源凍結。

2026-10-11 AI減傷對照型別化草稿：新增output/st6-st10/ai-stored-reduction-fixture.draft.ts、ai-stored-reduction.tests.draft.ts與isolated.config.ts。三種場景皆以原卡＋實際兩次宣告攻擊／Frozen R支付或skip準備，15項草稿包括3項60原卡／印刷HP與真實減傷來源、3項致命分數39／54對照、Lv3～5各三項陷阱留手／實際RR支付／傷害結算／輸入不變。僅在output，未執行TypeScript／Vitest，不當作測試通過；仍以先前18列輕量探測為局部證據。完整run5 session67446仍存活，8GB heap與30秒記憶體記錄啟用，期間不並行其他Node診斷；早期測試程序RSS485MB、主執行緒heap90MB、可用實體約22GB，這是當時樣本而非全程峰值或失敗原因結論。

2026-10-11 ST7-011 Chrome driver草稿已備：output/st6-st10/st7-011-browser.draft.mjs依32案矩陣實作雙尺寸、原圖decode、印刷HP、YY選2付款草稿不改狀態、合法攻擊／阻擋、Refresh真實選卡、對手AI實際Kumiho FLIP指令／來源離場、輸出截圖與replay、60原卡／唯一／四張及console／HTTP錯誤檢查。尚未語法檢查／build／Chrome執行／精確重播，不當驗收。準備時修正wrong-energy fixture：原先3支援中仍有2Y，雖選前兩張會被規則拒絕，UI整體卻可合法攻擊；現三張均為原始R支援、保留足夠總能量張數，只測缺Y。舊16案preflight證據對此fixture已過期，修改後重驗待完整測試結束，不隱藏此缺口。完整run5／67446仍執行，不並行其他Node。

2026-10-11 ST7-011獨立Browser replay auditor草稿：output/st6-st10/audit-st7-011-browser.draft.mjs已備。fixture新增prepareOnly，停在真實父指令前；稽核從先前獨立hp-boundary／departed-FLIP探測紀錄取父指令前綴，重建injured／three-hp／departed初始players及pending，再套用所有UI剩餘指令。最終所有狀態key（含commandLog及付款／修正／pending／結果）均精確比較、不排洗牌或任何區域；原始appendCommandLogEntry已查明沒有客戶端timestamp欄位，故初稿預設排除commandLog已立即撤除，尚未執行任何稽核。仍需32案Chrome先完成、驗證前綴及重播格式，不能宣稱replay PASS。正式來源未變，完整67446仍執行，期間不另啟Node。

ST7-011隔離準備續批：Browser driver草稿加入實際選兩張黃色支援→取消攻擊→重新開啟付款的檢查，要求取消前後公開HP／全部支援狀態與contract trace不變、重新開啟已選0／2；獨立replay auditor要求每個可攻擊案例都有取消證據。另將同名見證目前等級的9個相容情境加入typed physical tests草稿：實體Licorice以真正Activate由LV2降至1，旁邊保持原圖LV3 Tree，檢查同張見證、舊name-only、否定、來源排除與對手區域。現為兩個隔離測試檔共70項預備案例；新增與既有草稿均尚未TypeScript／Vitest／Chrome執行，未增加驗收或promote數。ST7-012完整run5 session67446再確認仍live，保持1703來源凍結，沒有併跑其他Node診斷。

ST7-011重播稽核草稿修正：唯讀核對src/game/battle-replay.ts後確認離線匯出會將commandLog提升到artifact頂層，initialState／finalState不保留重複commandLog。稽核先從獨立父流程重建紀錄，再回填初始狀態重播剩餘UI指令；直接比對重建紀錄與replay.commandLog，並以頂層紀錄還原expected final後逐欄比較，不排除任何紀錄、牌序或狀態欄位。這是匯出表示的還原，尚未實際執行，不能當成重播PASS。正式來源未變更，ST7-012完整run5仍live。

2026-10-11 ST7-012最終完整run5已PASS：887檔18,467項，1357.41秒，test與integrity均exit0，1703份來源／設定／資料指紋一致，session67446終止、來源凍結解除；先前run1～4失敗紀錄保留。隨後ST7-011最新16局面preflight run3 exit0，涵蓋wrong-energy全R修正及實際1／3HP父流程。第一次全app＋隔離草稿型別檢查發現6診斷：三處誤用不存在的pendingAttackEffect（改檢查真正pendingAbilityEffect），以及strict guard未先narrow到gain-hp而導致condition／子條件型別錯誤；已在output草稿與兩份source map修正，沒有改正式來源、移除測試或放寬斷言，run1失敗保留，run2待終值。

ST7-011候選隔離正式進展：全app＋草稿型別run2零診斷、Vitest兩檔70項6.00秒exit0、單卡strict verified1／review0／blocked0與shadow limit1 ready、候選Vite build exit0。候選Chrome run4雙尺寸32案全部PASS，包括取消付款、實際Then確認、Refresh與Kumiho FLIP後真正不補位。run1因錯把選付款的REST視覺預覽當成已支付、run2漏Then確認、run3漏昏厥後補位視窗；依實際UI補齊driver，失敗紀錄保留。獨立精確重播run1停在short-deck：實際UI refresh-deck未記錄shuffleSeed，export也標示inexact-replay，不能精確重建洗牌後牌序與呈現紀錄。未排除牌序／commandLog，也未promote。新增output-only離線Refresh seed捕捉helper及controller shadow、10項種子／原始指令不變／實體Refresh精確重播測試草稿；未改正式來源。首次seeded型別檢查指出mulligan指令沒有seed欄位，原型已依既有API只處理支援shuffleSeed的Refresh，其他洗牌流程未驗收；seeded型別run2待終值，seeded Browser／精確重播尚未執行。
