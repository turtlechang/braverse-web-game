# BS8 黃色逐卡驗證（2026-09-04）

## 範圍與停止位置

- 來源：`data/cards/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json`。
- 黃色篩選：`color === YELLOW` **或** `energyType` 以 `YELLOW` 開頭；不可只用 `color`，部分 FLIP／異圖此欄為空。
- 範圍：BS8-026～BS8-050，25 個基礎卡號、35 筆含異圖紀錄。
- 逐卡 cursor 已完成：BS8-026～050，包含35筆異圖，均有本輪局部 Browser A/B 與適用0選擇證據。現進行最終整體回歸，不代表逐卡完整線上對戰全部驗收。
- 全色卡面載入掃描 35/35 identity 與實際解碼圖片通過，page errors 0；這不是效果驗收。
- 本輪已修正共享 UI 與規則核心，保留原有工作樹修改；未 commit／push。

## BS8-026 Golden Cheese Cookie

卡文：3 黃能量、攻擊 3；攻擊後若自身剩餘 HP ≤ 4，增加 1 HP。此後續效果不是 `up to` 或可選付款。

| 驗證項目 | 預期與觀察 | 結果 |
| --- | --- | --- |
| strict contract | 基礎卡與 @1 共 2 筆 verified；runtime 為 sourceOnly gain-hp 1，source-hp-at-most 4 | 通過（靜態） |
| A：HP 4 | 真實 UI 選 3 黃支援、選對手攻擊；對手 HP 6→3，自身 HP 4→5；trace 有 declare-attack、resolve-attack-effect、增加 1 點 HP | 通過（效果／條件） |
| B：HP 5 | 同樣可付 3 黃並攻擊；對手 HP 6→3，自身保持 5；trace 說明條件不成立，沒有增加 HP | 通過（效果／條件） |
| 異圖 @1 | 上述 A/B 各自執行，不以基礎卡結果代替 | 通過（效果／條件） |
| mandatory UI | 修正後本體／異圖 A/B 均不得出現略過；可選／up-to 效果仍保留合法選 0 | 通過（Chrome driver + 元件測試） |
| timing badge | 修正為「攻擊後續效果」，不再借用 Activate／你的回合標記 | 通過（元件測試） |
| 正式完整對戰／雙端同步 | 尚未執行 | 未驗證 |

### 根因與重現

1. 開啟 `http://localhost:5173/?test-state=card:BS8-026`。
2. 點 Golden Cheese Cookie，選 3 黃支援，再選對手餅乾。
3. 攻擊後面板同時顯示「略過」及「確認發動」。按「略過」仍增加 HP。
4. `src/components/effects/EffectPanel.tsx` 的 `hasOptionalSkip` 對所有 `sourceKind === attack` 一律成立；沒有依此段是否可選決定顯示。
5. 先加入「BS8-026 不應出現 skip-effect」斷言重現 FAIL，再修正 optional 判定，重跑本體／異圖 A/B 各 2 PASS。EffectPanel 元件 34 項通過。

### 測試夾具調整

原 A 初始 HP 1、B 全部支援疲勞，只能證明付款被擋，未隔離 HP 條件。現 A 改為 HP 4，B 改為 HP 5 並保留合法付款。新增兩筆單元測試驗證本體／異圖皆可宣告真實攻擊，且條件只在 A 成立。

### 證據與命令

- `npm.cmd run cards:audit:contracts -- --card BS8-026 --strict`：2 verified。
- `npm.cmd test -- --run src/game/demo.test.ts src/game/bs8-yellow-validation.test.ts src/cards/bs8-strict-contracts.test.ts --maxWorkers=1`：3 files／307 tests passed。
- `npm.cmd run build`：通過；既有大 chunk 提示。
- `npx.cmd eslint src/game/demo.ts src/game/bs8-yellow-validation.test.ts scripts/p-browser-effect-audit.mjs`：通過（僅修改範圍）。
- A/B 功能證據：`test-results/bs8-yellow-026-a-2026-09-04.json`、`test-results/bs8-yellow-026-b-2026-09-04.json`，各 2 通過；A 報告產生於新增 UI 閘門前，不代表 UI 全面通過。
- UI 閘門：`test-results/bs8-yellow-026-ui-gate-2026-09-04.json`：1 FAIL，首張即停。這是預期捕捉到的產品 UI 缺陷，不是 console crash。
- 報告路徑由 `BRAVERSE_AUDIT_REPORT` 指定；driver 為 `node scripts/p-browser-effect-audit.mjs --series=BS8 --card=BS8-026 --fail-fast`，B 加 `--negative`。

`test-state` 僅為局部驗證，尚未證明正式完整對戰、牌組構成、未知牌序、多人同步與全回合狀態正確。此次不宣稱黃色批次通過。

## 後續

BS8-026 修復證據：`test-results/bs8-yellow-026-fixed-a.json`、`test-results/bs8-yellow-026-fixed-b.json`；卡面掃描：`test-results/bs8-yellow-load.json`。初始 FAIL 證據保留供追溯，不代表最新狀態。

BS8-027 已修正休息區交換順序、無棄牌目標的啟動檢查與異圖 route；新增休息區 LV9 的交換測試及真實覺醒／付款攻擊（對手兩張分別受 3+1／1 傷害）。4 檔 75 tests 通過，strict contract 6 verified。Browser 覺醒另抓到 HP+2 被顯示為 6/2 的問題，仍在本卡 gate 修正。

更新：覺醒 HP 改顯示目前 HP 與「覺醒HP +2」，不宣稱是上限；缺合法棄牌目標時按鈕 disabled 並顯示規則層原因。BattleRow 59 tests 通過，Browser 覺醒 A/B、付款攻擊 Then、6 筆本體／異圖休息區交換 A/B 全通過，公開 trace 說明先來源到棄牌、再選定目標到休息區。證據：`test-results/bs8-yellow-027-browser.json`。僅 demo／正式共用命令，尚未完整線上驗收。

後續各卡須獨立覆蓋支付、代價、條件、目標、up-to 選 0、Then、FLIP／EXTRA 與 UI，不能沿用前卡通過結論。

## BS8-028 Manager Cheesebird

- 修正缺色正規化：官方 `color: "null"` 由結構化 `energyType` 恢復，正式牌組建構與 adapter 共用；沒有改官方 JSON。
- 修正「本回合曾從休息區登場」為事件旗標，離場／覺醒不會消失，換回合清除；兩個正式 Break 登場分支均涵蓋。
- A：選對手一張，HP6→5；B：本回合無登場事件，disabled 並明示原因；C：選0，HP維持6，公開紀錄明示可選效果未執行；A/C後當回合不能再次啟動，顯示每回合一次原因。
- Chrome A/B/C 全通過：`test-results/bs8-yellow-028-a.json`、`bs8-yellow-028-b.json`、`bs8-yellow-028-zero.json`；strict contract 1 verified。
- 卡池registry一致；核心／UI針對測試69項通過，共用相容性126項通過，另有normalization／Break事件15項回歸通過。完整全套與線上仍待最終整合。

## BS8-029 Miner Cheesebird

- 核心命令允許抽0／1、拒絕抽2；無本回合登場事件與同回合重用皆阻擋。
- Browser A抽1與B無事件通過；C選0抓到 `PendingDecisionModals` 對所有 `max===1` 自動代選1的問題。
- 修正方向：移除UI自動選牌數，沿用既有0～max選項與正式 `resolve-draw-up-to`；待修復後A/B/C全部重跑，不能沿用舊A作為完整驗收。
- 更新：已移除自動代選；相關39 tests與build通過。最新Chrome A抽1牌庫20→19、B條件不足禁用、C不抽牌庫維持20，全數通過並記錄 `resolve-draw-up-to`；A/C均消耗一次使用機會。證據：`test-results/bs8-yellow-029-a.json`、`bs8-yellow-029-b.json`、`bs8-yellow-029-zero.json`。React檢查確認dispatch由確認事件觸發，不在useEffect自動送出。

## BS8-030 Lassi Guard Kulfi

- 真實登場後以2黃+2任意支付攻擊4；1黃+3藍拒絕，2黃+2藍成功。無額外技能或攻擊效果。
- Chrome A真實登場、支付4張、攻擊；B真實登場後能量不足無法攻擊。`test-results/bs8-yellow-030-a.json`、`bs8-yellow-030-b.json` 全通過；strict contract 1 verified；黃色定向測試7項通過。

## BS8-031 Mozzarella Cookie

- LV.3棄牌區→休息區改為真正代價；付款前合法性、錯級／重複／未選拒絕，付款後才選恰好兩張合計LV≤3回手，對戰紀錄明示代價。
- 新增共用兩種移牌代價UI（手牌／棄牌區→休息區），線上／本地均使用正式begin命令，不能把空targetIds當未選而提前resolve。
- 本體／異圖Chrome A/B共4條通過；`test-results/bs8-yellow-031-a.json`、`bs8-yellow-031-b.json`。strict contract 2 verified；核心+BS8契約36 tests通過。線上hook13、本地hook37測試通過，不等同完整線上雙客戶端Browser。

## BS8-032 Burnt Cheese Cookie

- 來源與LV≥2手牌均為代價；前置休息區必須已有餅乾，不能用自己的代價補滿條件。滿兩格仍可支付騰出空位，HP／裝備／底卡不遺失。
- 抽0/1/2之後仍能選Golden0/1；無Golden可選0。真人／批次與AI模擬在抽牌時暫停，Refresh後Then保留。付款達Break LV10立即敗北，不得先抽牌。
- 14項核心邊界測試通過，含Refresh與付款敗北；contract ledger修正來源加手牌複合代價的來源分類，strict 2 verified。
- 本體／異圖Chrome A/B/zero共6條通過：`test-results/bs8-yellow-032-a.json`、`bs8-yellow-032-b.json`、`bs8-yellow-032-zero.json`。A使用真實Golden Cheese／Cinnamon卡，B顯示付款前休息區條件，zero明確抽0且不登場。

## BS8-033 Centipede Cookie

- 缺色正規化後正式異圖為黃色；無技能，3任意能量攻擊3。紅／綠／藍混付3張成功，2張拒絕，實際對手HP6→3。
- Chrome真實登場／攻擊A、能量不足B通過；`test-results/bs8-yellow-033-a.json`、`bs8-yellow-033-b.json`；strict 1 verified，黃色定向10 tests通過。

## BS8-034 Smoked Cheese Cookie

- 來源＋任意等級手牌餅乾為真正代價，須先有Break餅乾。滿兩格可付來源騰位；Golden0/1、登場HP6、不能選非Golden／EXTRA、付款達Break10立即敗北，本體／異圖18項測試通過。
- Chrome A/B/zero共6條通過，A以LV1 Squid Ink付費、真實Golden顯示6/5；B顯示前置Break條件；zero不登場。`test-results/bs8-yellow-034-a.json`、`bs8-yellow-034-b.json`、`bs8-yellow-034-zero.json`。strict 2 verified。

## BS8-035 Cinnamon Cookie

- 棄牌餅乾→Break是真正代價；本次代價等級快照綁定來源／玩家／回合，後段只能選同級至多1張，包含剛支付的卡；選0仍付代價。Break達10先敗北，不得靠後段降回9。
- 14核心tests通過，含真人／batch、不同來源付款不串用。Browser選0抓到公開log缺漏與LV.undefined；已修共用選牌限制及中文說明，並補batch選0紀錄。
- 最新Chrome A/B/zero全通過：`test-results/bs8-yellow-035-a.json`、`bs8-yellow-035-b.json`、`bs8-yellow-035-zero.json`；A以真實Centipede付LV2、選Cinnamon；zero紀錄明示未移動目標。strict 1 verified，相關74 tests通過。

## BS8-036 Young Kulfi

- 由正式declare-attack→傷害翻FLIP測試棄1補實體HP1、無手牌／非法代價拒絕、可拒絕、翻卡與支付卡進trash、卡片實體守恆。修正重複discard ID被默默去重接受，9 tests通過。
- Chrome A棄牌HP1→2；B無手牌發動disabled；C有手牌主動拒絕HP維持1。`test-results/bs8-yellow-036-a.json`、`bs8-yellow-036-b.json`、`bs8-yellow-036-decline.json`全通過。strict 1 verified。2026-09-05更正：上述Browser案例未證明未翻開時的HP計算；共用`attachedHpBonus`原本提前加算屬規則錯誤，已於全面稽核R4移除，更新BS8-036／046／049回歸為未翻開FLIP不影響剩餘HP。

## BS8-037 Squid Ink Cookie

- 真實OnPlay：黃1支付一次，來源HP2→3、同伴不變；無能量／錯色拒絕，不可重用，略過不付款。黃色定向11 tests通過。
- Chrome A/B明確驗證來源3/2與2/2，A有begin命令、B無begin；`test-results/bs8-yellow-037-a.json`、`bs8-yellow-037-b.json`全通過；strict 1 verified。

## BS8-038 Olive Cookie

- LV.3手牌→Break改真正代價；之後0/1/2張LV.1→trash。錯等級、缺代價、重複／超額拒絕；無LV1可付並選0；付款達10先敗北。真人／batch狀態與0選擇紀錄一致，12 tests通過。
- Chrome A選兩張真實LV1、B缺LV3、zero三條全通過；`test-results/bs8-yellow-038-a.json`、`bs8-yellow-038-b.json`、`bs8-yellow-038-zero.json`。strict 1 verified；adapter+demo+本卡共546 tests通過。

## BS8-039 Shelly

- LV.2手牌為代價，付款後才產生Break候選；空手不會跳掉效果，剛付卡可登場。滿兩格只能選0；0也消耗一次，正常下一個自己的回合重置。非法代價／目標、付款LV10敗北與真人batch一致，12 tests通過。
- Chrome A將剛付的Centipede登場、B只有LV1手牌明示禁用原因且不執行其他卡、zero不登場且log明示；A/zero源技能同回合disabled。`test-results/bs8-yellow-039-a.json`、`bs8-yellow-039-b.json`、`bs8-yellow-039-zero.json`全通過。strict 1 verified，含Break事件回歸共16 tests通過。

## BS8-040 Cheesecake Cookie

- 修正錯誤的「最多抽1再棄1」為強制抽1→棄1；Break LV.2不執行，LV.3必須執行，可棄新抽卡。真實黃1攻擊、非法棄牌、Refresh後保留棄牌共9 tests通過，adapter合計265 tests通過。
- 修正棄牌完成紀錄缺來源卡與結果，卡牌篩選可見實際棄牌；返回隱藏牌庫的共用路徑只公開張數和去向，相關59 tests通過。
- Chrome A/B全通過，來源不可略過、A牌庫20→19且確實棄1、B維持20且不棄，兩邊均真實攻擊使對手HP6→5。`test-results/bs8-yellow-040-a.json`、`bs8-yellow-040-b.json`；strict 1 verified。

## BS8-041 Elder Kulfi

- 修正共用 FLIP 將 draw-up-to 自動抽滿的錯誤，改由玩家明確選0/1；未選時禁止下一段傷害，自動戰鬥也必須等待決策。免費FLIP即使無手牌／支援也能發動，並可拒絕。
- 真實2黃攻擊翻FLIP、0/1、非法數量／擁有者、Refresh續接與實體卡守恆6 tests；共用FLIP/P-099與040/log回歸合計85 tests通過。Chrome A/zero/decline全通過且驗證實際牌庫20→19／維持20與公開抽牌紀錄：`test-results/bs8-yellow-041-a.json`、`bs8-yellow-041-zero.json`、`bs8-yellow-041-decline.json`；strict 1 verified。
- 20:43啟動的全套測試在編輯期間讀到混合版本（舊runtime／新測試），結果3977 pass／9 fail；9項均屬040 log與041新測試，最新定向85項已通過。此結果不作為最終全套驗收，待修復全部完成後重跑。

## BS8-042 Adventurer Cookie

- A fixture由正式039支付成本→Break登場042建立真實origin；B由手牌真實登場不得發動，log明示來源條件不符。0/1、非法目標、active不立即橫置、rested只跳下一次Active、手牌／trash來源拒絕11 tests通過。
- 修正本地漏支援卡候選、線上誤顯示戰鬥餅乾；兩端hook都以真實對手支援0/1驗證，不能選我方。UI與log說明不立即橫置及下一個活躍階段期限。
- Chrome A選Squid Ink支援、B錯誤origin、zero明示0全部通過：`test-results/bs8-yellow-042-a.json`、`bs8-yellow-042-b.json`、`bs8-yellow-042-zero.json`；strict 1 verified。hooks+035+黃色核心共80 tests通過。共享候選檢查另外揭露031線上固定張數回手候選漏接，已補規則層選牌入口，持續補confirm驗證。

補充：031線上固定兩張／等級總和與035／038候選已補回歸；非法組合由規則層純效果預檢拒絕，不送command。Online hook 18 tests通過，面板沿用既有張數／等級總和禁用檢查。

## BS8-043 Fettuccine Cookie

- 修正帶「本回合從指定區域登場」必要目標的gain-hp啟動檢查；無合法LV3時不付款、不消耗次數，UI明示缺本回合Break LV3。同伴改真實Golden Cheese卡面，A HP4→5，B hand-origin維持4。
- 真實Break進場、黃1成本、來源不加HP、once、舊回合／錯來源／錯等級拒絕、下一回合重新登場後可再發動，共13 tests通過。含黃色核心與Online回歸42 tests通過；strict 1 verified。
- Chrome A/B通過：`test-results/bs8-yellow-043-a.json`、`bs8-yellow-043-b.json`；B保留活躍能量但按鈕disabled，A發動後同回合disabled。

## BS8-044 Pistachio Cookie

- 改由正式Young Kulfi宣告1傷攻擊Smoked Cheese，再開Pistachio Blocker。Blocker可在Trap共用回應窗付黃1轉移攻擊，不要求來源活躍也非每回合一次；Y3攻擊2、錯付款／玩家／時機、拒絕與同回合連續阻擋8 tests通過。
- Chrome A付款後Pistachio HP3→2、原目標維持5；B缺能量及有能量拒絕均維持Pistachio3、原目標5→4。付款前確認disabled，A log列轉移前後真實卡名。`test-results/bs8-yellow-044-a.json`、`bs8-yellow-044-b.json`、`bs8-yellow-044-decline.json`全通過；strict1 verified，demo與Online回歸合計304 tests通過。

## BS8-045 Habanero Cookie

- LV6→8必須離場、LV7不離場；Y2攻擊3、非法target／付款、正常補位10 tests通過。修正battle-to-break遺失裝備／覺醒底牌，HP與附屬卡全部入trash；BS6-010阻擋時log明示來源與未執行，不再誤報移動。
- Chrome A/B通過，兩邊真實付款攻擊使對手HP6→3；A source離場且可選不補位，B source留場，mandatory面板無略過。`test-results/bs8-yellow-045-a.json`、`bs8-yellow-045-b.json`；strict1 verified，與command-log合計60 tests通過。

## BS8-046 Surprise! Lassi Jar

- 修正 parser 遺漏「剛好剩 1 HP」篩選；依有效 HP（含實體 HP 額外加成）精確檢查，不能選 2 HP 或對手。黃1、0/1、錯付款／目標與牌守恆11 tests通過；adapter共268 tests通過。可選HP UI明示最多與0張。
- Chrome A/B/zero通過：`test-results/bs8-yellow-046-a.json`、`bs8-yellow-046-b.json`、`bs8-yellow-046-zero.json`；zero實際付款後不選目標、HP不變，公開紀錄0個目標；strict1 verified。UI與此卡29 tests通過。

## 共享線上回歸結果

- `npm.cmd run test:online:match:browser`通過：兩個隔離瀏覽器建房／加入、開局、階段同步、對手攻擊／付款預覽、實際支援疲勞、雙方動態、非法指令提示與斷線／連線失敗提示。這是共用正式好友房流程，不代表25張黃色卡都各自在完整線上對戰觸發。

## BS8-047 Puny Strength

- 角括號展示以首段 `asCost` 標記，begin-play-item 必須同時提交必選展示目標才原子付款；無牌／錯等級不能付費。展示可為任意色LV3，登場只能黃LV3，Then鎖同一實體。修正Break登場重複ID被去重接受。
- 真實卡0/1、滿場／無目標、非法成本／目標、Refresh／OnPlay續接、批次／逐段一致20 tests通過；線上hook另驗0/1及未展示不能confirm。040／047／log／Online合計100 tests通過。
- Chrome A/B/zero全通過，A真實Golden Cheese登場，zero不登場但仍把展示的Lassi Guard Kulfi放入Break，B無LV3且物品不可操作，log同步公開展示與同牌Then：`test-results/bs8-yellow-047-a.json`、`bs8-yellow-047-b.json`、`bs8-yellow-047-zero.json`；strict1 verified。
- 共用回歸另修040 auto resolver等待mandatory discard，不再空轉；正式攻擊→抽牌→等待→棄牌→戰鬥完成已測。

## BS8-048 Kulfi Legends

- 修正陷阱把trash-to-hand誤判不接受目標，explicit effectTargets要執行而非丟失選擇；未傳則維持pending互動，重複ID拒絕。正式BS8-021／BS3-043、0、錯名稱／區域／等級條件／費用13 tests通過；共用trap/FLIP合計53 tests通過。
- fixture由正式Young Kulfi宣告黃1攻擊，防守方Break真實LV3 vs LV2；候選限定兩張真實Soul Jam。Chrome A／Abundance／zero／B全部通過，回手卡名／卡圖／0紀錄正確，最後防守Smoked Cheese HP5→4且無pending：`test-results/bs8-yellow-048-{a,abundance,zero,b}.json`；strict1 verified。

## BS8-049 Simmering Lassi Springs

- 放置黃2、啟動黃1+來源橫置、exact有效HP1、0/1、無候選0、036bonus、錯付款／區域／重複、次回合恢復共14 tests通過。共享048 staged新增3tests，049/048/log合計80 tests通過。
- Chrome A/B/zero通過；全部實際支付黃2放置再黃1啟動，來源橫置且log顯示；A HP1→2，B初始HP2不可選且維持2，zero初始1維持1。`test-results/bs8-yellow-049-{a,b,zero}.json`；strict1 verified。

## BS8-050 City of Eternal Gold（含 @1）

- 放置黃1，啟動只橫置來源、無能量費用；真實047指令產生本回合Break登場的Golden Cheese，A設定既有傷害剩1HP、B剩2HP。Then鎖定同一目標並拒絕其他ID。
- 修正批次activate-stage漏掉HP Then，改走同一pending resolver；本體／異圖0/1、錯origin／turn／LV／side、Refresh與批次一致、A/B/zero公開log17 tests通過，相關74 tests通過。
- Chrome兩個版本A/B/zero共6路徑通過：A1→2→3、B2→3且Then條件不成立、zero維持1且沒有Then；全部來源橫置、實際放置付黃1，啟動不額外支付。`test-results/bs8-yellow-050-{a,b,zero}.json`；strict2 verified。

## 最終整合檢查

- AI共用HP選牌修正：明確target優先於廣義untargeted分類，Lv.2／3現在為049／050選合法餅乾；050初始HP1／2均正確到3，無合法LV3則選0。新增8 tests，與049／050合計39 tests通過。
- 35/35正式黃色來源契約verified，無needs-review／blocked；registry一致。最新卡面冷載35/35成功（`test-results/bs8-yellow-load-final.json`）；受限網路環境曾全部BLOCKED_NETWORK，取得官方圖片網路存取後重跑全通過，不更改卡圖來源或偽造圖片。
- 最終建置通過（既有大chunk提示）；scoped ESLint與diff check通過。全域lint在原有 `.tmp-probe-deploy.ts` 與 `scripts/diagnose-lv5-conservatism.ts` 有3項unused錯誤，未修改無關檔案。
- 最終AI Browser重跑20/20完成、stuck0（`test-results/ai-browser-validation.json`）；最終兩瀏覽器好友房核心流程再跑通過，含開局／對手攻擊預覽／支付／回合同步／錯指令／斷線。這些仍不是35筆卡各自在完整線上對戰觸發的逐卡證明。
- 完整Vitest第一輪255檔通過／2檔失敗、4124通過／3失敗；失敗為049舊selector、047舊展示流程與FLIP舊自動抽牌預期，已依真實規則修正，定向60 tests通過。
- 固定版本最終全套通過：258個測試檔、4,135項測試，0失敗，357.13秒。命令：`npm.cmd test -- --maxWorkers=1 --reporter=default --reporter=json --outputFile=test-results/bs8-yellow-full-final.json`；原始報告：`test-results/bs8-yellow-full-final.json`。本輪未commit或push。
