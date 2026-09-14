# BS9 匯入、逐卡驗收與正式 promotion

## 範圍與目前結果

使用者授權：官方資料與卡圖確認、候選匯入、新機制／轉接缺口盤點、逐卡支付／目標／Browser 正負驗收、正式 promotion，以及端到端完成後 commit；不含 push。

2026-09-10 從官方英文 JSON 實際取得 185 筆，基礎卡號連續 BS9-001～118；保留全五色、異圖與促銷記錄。來源欄位與既有官方 normalizer 相容。2026-09-13 完成 runtime／strict contract 收尾並依使用者授權正式 promotion；BS9 已移入 `data/cards/`，正式 registry 已重建，Standard／Open 卡池均可讀取正式資料。

- [逐筆原文與卡圖來源](bs9-card-inventory.md)
- [逐筆 strict／parser 缺口](bs9-effect-coverage.md)
- [正式資料](../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json)
- 官方勘誤：[BS9-070](https://cookierunbraverse.com/asia/notice/detail?id=1199)，支援數量條件為己方小於或等於對方。此次英文 JSON 已包含修正文句；不改寫原始資料。
- 2026-09-13 官方來源再查：官方[BS9-025 基礎版卡表](https://cookierunbraverse.com/asia/cardList?t_favorite_only=0&t_duplicate_card=1&t_skill=1&t_attack_effect=1&t_extra=1&t_ban_card=1&category=BOOSTER%20PACK%20%5BA%20Game%20of%20Truth%20and%20Deceit%5D&search=BS9-025&cardId=46180)與[BS9-025 `@1` PROMOTION 卡表](https://cookierunbraverse.com/asia/cardList?t_favorite_only=0&t_duplicate_card=1&t_skill=1&t_attack_effect=1&t_extra=1&t_ban_card=1&search=46838&cardId=46838)均確認同一段 FLIP 原文，結尾仍是 `If activated during your turn, you can select another of your Cookies.`，沒有受益者／後續動作。官方韓文卡表與 Ver.1.8 規則、FAQ／公告查核也沒有補充專卡裁決；因此下方採用的是使用者確認的**專案語義**，不是冒稱官方新增裁決。
- 同日補查官方原始資料：[English JSON](https://cookierunbraverse.com/data/json/cardList_en.json) 對應 BS9-025 source `46180`（`update_dt=2026-08-05`、圖檔 `9jjojmdgNcq8GjYQKn9LwQ.webp`）與 BS9-025 `@1` source `46838`（`update_dt=2026-03-13`、圖檔 `ByViy8futwWjS_dACoAylA.webp`）；[Asia JSON](https://cookierunbraverse.com/data/json/cardList_asia.json) 的繁中也只寫「如果曾在自己的回合中發動，則可以選擇自己的另一個餅乾」，[韓文 JSON](https://cookierunbraverse.com/data/json/cardList.json) 同樣只寫可選擇其他餅乾。官方資料端點只有 `ko`／`asia`／`en`，沒有日文端點；四張官方 WebP 也沒有文字 metadata，附件與官方圖檔一致。來源仍未補足選定後動作；依使用者確認的專案語義已完成定義並解除兩筆 strict `needs-review`，不把該專案語義冒稱官方裁決。
- 2026-09-13 使用者補充的 BS9-025 U 與 P 實體卡圖及繁中卡文再作逐字／目視核對：兩張卡的卡號、等級、HP、黃色雙能量、`Tough Rook` 與整段 FLIP 文字均與候選來源一致；繁中正文同樣在「可以選擇你的另一塊餅乾」結束，英文正文則在 `you can select another of your Cookies.` 結束，影像沒有被截掉或藏有後續句。兩張只在稀有度／卡面浮水印與插圖呈現不同，故仍分開保留 `BS9-025`／`BS9-025@1` 契約。
- 依官方 Ver.1.8 台灣／韓文規則，HP 卡在受傷翻開後進棄牌區並依 FLIP 處理；「選擇」不會自行改變卡片區域或附著關係。因此採用語義只把選擇解讀為 **+1 HP 受益者的可選重新指定**，不移動／重新附著 FLIP 卡本身；其餘未寫出的後續操作不自行延伸。
- `src/game/bs9-024-029.test.ts` 現以採用語義驗證 BS9-025／`@1`：棄 1 張手牌成本、預設原附著餅乾 +1 HP、自己的回合可選另一隻己方 Cookie +1 HP、非自己回合不得改選，以及無手牌／非法目標／重複目標阻擋。

靜態盤點（2026-09-13 重新執行 adapter 後）：118 張基礎卡中，主效果 74 已轉接、44 無主效果文字、0 待轉接；額外能力 74 已轉接、44 不適用、0 待轉接；一般卡攻擊 Then 16/16。185 筆 strict 為 **185 verified、0 needs-review、0 blocked**。另以 converter 交叉檢查 174 筆 `GameCard`／11 筆 `ExtraDeckCard` 均可轉換。

2026-09-13 採用前既有 18 份 Browser 報告聚合為 **852／852 lanes**（exact image 848／852；4 條 BS9-018 隱藏對手手牌標記 N/A）。BS9-025 本輪另以專用雙尺寸正／負路徑驗證 8／8；終端整批腳本因目前環境拒絕官方影像網域而未列入正式全綠統計。所有數字均為候選 localhost／test-state 證據，不能替代正式牌組、多人或線上逐卡驗收。

上述舊版交叉證據保留為採用前歷史快照；本輪 strict 已更新為 185／185 verified。由於 `test-results/bs9-024-029-browser.json` 的終端重跑在官方影像載入前即受 `cookierunbraverse.com:443` 網路限制中止，不能把該檔案宣稱為目前全量 Browser audit；BS9-025 的 8／8 互動與 Chrome 官方卡圖載入證據另列於下方。

## 2026-09-14 BS9 Lv.5 benchmark review 修正

- 修正 holdout 的比較方法：同一 fixed pairing 以 baseline／訓練 profile 做兩種策略座位交叉對戰，依實際 `winnerPlayerId` 歸屬勝場；不再將單邊 replay 的 winner-change 當成訓練勝場。
- benchmark 與正式 Swiss 使用 500 步硬上限；本次固定 seed 的 1,024 副／10 輪 Swiss 完成 **5,084／5,120**，36 場卡住／超限標記 FAIL，訓練 profile 僅收錄 5,084 場完成決勝資料。Top cut 仍產生冠軍藍色 `#005`、四強 `#005`／`#183`／`#040`／`#201`。
- 32 副×2 輪縮小 holdout 共 64 場雙向交叉對戰，訓練策略 35 勝、baseline 29 勝、0 失敗；完整 256 副×8 輪版本可由同一腳本參數重跑，本次報告的實測規模已在產物中標明。
- CI 對應修正：BS9-071～118 長稽核測試設 30 秒 suite timeout；AI Browser 改驗證現行「暫停資訊／繼續對戰」流程，不再等待已移除的 20 場 AI 按鈕。完整 Vitest **323 檔／4,782 項**、build、AI Browser Smoke 與修改檔 scoped lint 通過；本機全域 lint 的 4 個錯誤仍只來自既有未追蹤暫存／診斷檔。

## 2026-09-13 BS9 正式牌池端到端收尾

BS9 已完成候選隔離 → strict contract → Browser 正／負驗收 → 正式 promotion → 正式牌組／線上共用 gate 的收尾鏈。正式資料為 `data/cards/official-a-game-of-truth-and-deceit-bs9.en.json`，`data/candidates/` 不再保留 BS9 JSON；正式 registry 已重建，Standard／Open 可讀取 BS9。

- **逐卡與正式資料**：全檔 185／185 verified、0 needs-review、0 blocked；`validate:cards` 為 17 檔／1,600 種卡號／1,574 張成功轉換，`check:card-pool` 與 `promote:candidate` 均 exit 0。
- **BS9 Browser 矩陣**：所有 `test:bs9-*` package scripts 均 exit 0，合計執行 **864 lanes（含重疊的專卡加強矩陣）**；每筆正式記錄均走雙尺寸正／負路徑，檢查實卡名稱、官方 `imageUrl` request／render／load、支付／目標／時機、公開 `GameCommand` trace 與 pending 結算。BS9-018 的隱藏對手手牌路徑依規則標記 N/A；其餘可見卡圖 lanes 均通過 exact image gate。
- **跨流程 Browser gate**：`test:deck:browser` 四種視窗（1366×768、622×1040、390×844、280×720）通過；`test:online:match:browser` 通過開房、開局同步、攻擊預覽／支付、非法指令拒絕、斷線與連線失敗；`test:online:browser` 桌機與 280px modal **2／2** 通過，無水平溢出。
- **本機回歸**：完整 Vitest **319 檔／4,769 項**、build、牌池核對均 exit 0；scoped ESLint 與 `git diff --check` 通過。
- **當時基線狀態（2026-09-13）**：完整 `npm.cmd run lint` 仍被 4 個既有無關暫存／診斷檔錯誤阻塞；當時 `test:ai:browser` 尚未更新為現行暫停資訊流程。最新修正與驗證請見上方 2026-09-14 區段。
- **剩餘驗收邊界**：已通過正式牌組與通用雙瀏覽器好友房／線上 modal gate，但尚未建立「每一張 BS9 卡在真實雙瀏覽器線上對局中逐卡操作」的專用矩陣；這是額外覆蓋範圍，不影響本次正式 promotion 與 BS9 Browser 收尾判定。

## 2026-09-13 BS9-025 採用語義收尾

使用者確認採用以下專案判定（官方卡表與 Ver.1.8 規則沒有補足的專卡裁決，故明確標示為專案語義）：

- FLIP 卡翻開後依一般規則進入 Trash；發動成本為棄置 1 張手牌。
- +1 HP 預設給原本附著此卡的 Cookie；若在持有者自己的回合發動，可將受益者改選為另一隻己方 Cookie。
- 重新指定只改變 HP 受益者，不移動或重新附著這張 FLIP 卡；非自己的回合不得送出改選目標。

完成內容：`official-effect-adapter`／P adapter／runtime `FlipAbility`／contract ledger／Battle response modal／測試 fixture 均已同步；BS9-025 與 `@1` 各自保留官方卡圖與來源卡號。

驗證證據：

- strict contract：185／185 verified、0 needs-review、0 blocked；候選驗證 185 筆、成功轉換 174 張可遊玩卡（11 張 `ExtraDeckCard` 另列）。
- 規則／契約：BS9-025 專項及 ledger 42／42 通過；promotion 後完整 Vitest **319 檔／4,769 項**通過，exit 0；build exit 0。
- Browser 互動：U／P × 桌面 1907×863／平板 1164×777 × 正／負共 **8／8** 通過；正向實際選 Pomegranate Cookie、棄 1 張手牌、發動 FLIP，原附著餅乾維持 1/5、受益者變為 5/4；負向無手牌時發動按鈕 disabled 且可略過。
- Chrome 使用者工作階段以官方遠端 URL 實際載入兩張卡圖：U `9jjojmdgNcq8GjYQKn9LwQ.webp` 為 746×1038、P `ByViy8futwWjS_dACoAylA.webp` 為 745×1041，均 `complete=true`／`naturalWidth>0`，並在同一 FLIP 視窗完成正向操作。終端 Playwright 批次因目前環境拒絕 `cookierunbraverse.com:443` 而在 exact-image assertion 前止步；不將該 56-lane 報告列為正式全綠。
- promotion 後正式資料位於 `data/cards/official-a-game-of-truth-and-deceit-bs9.en.json`，候選檔已移除；`promote:candidate`、`validate:cards`、`check:card-pool` 均通過，正式 registry 已納入 BS9。當時尚未執行 commit 或 push；目前端到端收尾與提交邊界見上方「BS9 正式牌池端到端收尾」。

## 2026-09-13 正式 promotion 收尾

依使用者明確授權執行 `npm.cmd run promote:candidate`：1 份候選檔成功移入 `data/cards/`，候選目錄不再保留 BS9 JSON，正式 registry 重建為 17 個 JSON。promotion 後修正測試／demo／Browser script 對已移除候選路徑的引用，改讀正式 `data/cards`。

- `npm.cmd run validate:cards`：17 個檔案、1,600 種卡號、1,574 張成功轉換，exit 0。
- `npm.cmd run cards:audit:contracts -- --dir data/cards --file official-a-game-of-truth-and-deceit-bs9.en.json --strict`：185 verified／0 needs-review／0 blocked，exit 0。
- `npm.cmd run check:card-pool`：registry 與 `data/cards/*.json` 一致，exit 0；`npm.cmd run build`：1977 modules、exit 0。
- 受 promotion 影響的 AI audit／Deck Editor 基線已更新；完整 Vitest **319 檔／4,769 項**通過，exit 0。scoped ESLint 與 `git diff --check` 通過；全域 lint 仍只有既有 4 個暫存／診斷檔錯誤。

## 第一批 BS9-001～009（候選局部通過）

本批已核對官方卡圖與英文卡文：BS9-001（含 `@2`）、BS9-002／`@1`、BS9-003／`@1`、BS9-005／`@1`、BS9-006／`@1`、BS9-007／`@1`、BS9-008、BS9-009；BS9-004／`@1` 為無技能登場卡。逐卡原文、異圖與圖片網址仍以 [BS9 卡表盤點](bs9-card-inventory.md) 為準。

- BS9-001：FLIP 選己方 0～1 隻，本回合減少效果傷害；BS9-002：對手上一回合己方紅色 LV.1 昏厥條件成立時，來源卡本回合攻擊傷害 +1；BS9-003：On Play 選己方至多 1 隻，本回合攻擊傷害 +1。
- BS9-004／BS9-008：無技能餅乾只走正式登場與 HP 配置；BS9-005：FLIP 棄 1 張手牌，附著餅乾 +1 HP；BS9-007：FLIP 抽最多 1 張牌。
- BS9-006：本回合己方至少 2 隻餅乾昏厥後，來源卡本回合受到的攻擊／效果傷害均 -3，最低為 0；BS9-009：本回合對手餅乾昏厥後，On Play 抽最多 1 張牌。
- 規則／adapter／UI 回歸涵蓋條件時間窗、顏色／等級、來源限定、全傷害通道、零傷害下限、FLIP 棄牌／增 HP、抽牌上限與回合到期；新增 BS9 專用測試檔及效果／命令紀錄文案測試。
- Browser：`test:bs9-001:browser`（基本版、`@1`、`@2`）12／12，加上 `test:bs9-002-009:browser` 56／56，合計 68／68；每筆均在 1907×863 與 1164×777 執行正向及負向／略過路徑，並檢查該筆官方 `imageUrl` 的 request／render、公開 `GameCommand` trace 與頁面錯誤。這些是 localhost `test-state` 候選證據，不等同正式牌組、多人或線上逐卡驗收。
- 另以 Chrome localhost 續接驗證 BS9-006 的實際傷害：`?test-state=bs9-damage:BS9-006` 先由正式 `deploy-cookie`／`activate-skill` 建立 -3，再由同一 turn number 的真實 BS8-002 宣告攻擊並自動結算，對戰紀錄明確顯示「Cilantro Cobra Swordsman」攻擊「Melted Choco Cookie」，HP 維持 2／2；`?test-state=bs9-damage-negative:BS9-006@1` 相同攻擊下 HP 為 1／2。兩條 Chrome 路徑無 console error。原本 `card:` 路徑讓 AI 到下一回合才攻擊，`this-turn` 修正已正常到期，因此不能作為 -3 的實際傷害證據。
- 候選仍維持 inventory 隔離，未載入正式 registry、Standard／Open 卡池，也未 promote。

## 第二批 BS9-010～023（候選局部通過）

### 2026-09-11 BS9-010 修復與重新驗證

使用者回報 `?test-state=card:BS9-010` 無法正確驗證後，重新目視[官方基本版卡圖](https://cookierunbraverse.com/data/en_storage/MhIiu1Yhpzag7Phn8ZdSWg.webp)：Shadow Milk Cookie／黑影牛奶餅乾，紅色、LV.2、HP 4；EXTRA 要求對手上一回合己方至少 2 隻紅色 LV.1 餅乾昏厥。登場選對手 0～1 張手牌，選定後正面朝上放在來源 HP 最下方。普通攻擊支付 2 紅、造成 2 傷害；Then 可另付支援區 1 任意能量，選對手 0～1 隻餅乾，取其最上方 HP 正面朝上放到來源最下方。

先前 28／28 Browser 與 HP 張數測試未檢查選擇前洩露手牌、HP 堆位置及正反面，不能用來證明這三項語義。本次先以 3 個失敗回歸重現，再修正如下：

- 對手手牌候選使用匿名位置，不含真實卡名、卡號、instanceId 或 imageUrl；本機、masked state 與 RoomStore 共用位置解析。非法位置、真實手牌 ID、重複及超選均拒絕；可選 0 張不移動卡牌。
- `hand-to-hp` 與 `transfer-hp` 以 `hpPlacement: 'bottom'`／`faceUp: true` 保留既有 HP 順序，使用公開 HP 標記讓雙方看到取得的卡圖；離開原 HP 堆即清除標記。一般 HP 搬移維持原有預設。
- 登場面板改為「對手手牌／不查看牌面／正面朝上／最下方」；HP 可點擊實際公開卡詳情，對戰紀錄附取得的實際卡名、卡圖、位置與 HP 張數。EXTRA 負向入口顯示規則層的上一回合紅色 LV.1 昏厥條件原因。
- 1907×863、1164×777 各執行完整正向、EXTRA 條件負向、On Play 選 0、Then 略過、Then 付款後選 0，共 10／10；所有點擊均經可操作 UI，無強制點擊或注入指令。正向 HP 為己方 4→5→6、對手 6→4→3，最下方依序為 Ninja Cookie、Cilantro Cobra Swordsman，原有 4 張 HP 仍朝下；付款總共橫置 2 紅與 1 任意色支援。
- `node scripts/bs9-010-browser.mjs` 在有官方公開圖片網路存取的環境通過；腳本要求來源及公開 HP 卡圖完成載入，報告中全部卡圖均載入成功，無頁面錯誤。Chrome 使用者原始 localhost 路徑亦完成正／負實際操作與實圖目視。報告：[test-results/bs9-010/report.json](../test-results/bs9-010/report.json)；截圖：[平板正向](../test-results/bs9-010/positive-1164-PASS.png)、[桌機正向](../test-results/bs9-010/positive-1907-PASS.png)。
- 測試對局設定的候選 staging 額外牌組欄位原先只查正式 `card-pool`，因此手動輸入 BS9-010 會顯示「找不到額外牌組卡號」。現在由隔離候選資料解析已具備完整 runtime contract 的 BS9-010／BS9-030，並在欄位 datalist 顯示候選選項；正式卡池與 Standard／Open 牌組維持不變。
- 規則／UI 與 RoomStore 回歸驗證匿名選擇、雙方公開範圍、最上方取牌／最下方放牌、標記離場後清理、合法 0、跳過、付款不足／疲勞支援／來源卡不可作能量、錯誤目標與 EXTRA 時機。RoomStore 使用隔離 fixture，並非正式 BS9 牌組入房。

此修復仍為候選 `test-state` 驗證：僅 demo，尚未證明正式狀態已修改；BS9 未進正式卡池、未 promote，也未完成 BS9-010 正式牌組／完整線上對局。最新完整測試及環境結果見下方「BS9-010 修復驗證」。

### 2026-09-11 BS9-014 Candy Apple Cookie 修復與重新驗證

使用者回報 `?test-state=card:BS9-014` 將對手餅乾最上方 HP 搬入 Candy Apple Cookie 後，新增卡未依卡面正面朝上放在來源 HP 最下方。根因是 BS9-014 的 exact adapter 只有宣告 `transfer-hp`，遺漏 `hpPlacement: 'bottom'` 與 `faceUp: true`；共用規則執行器原本已支援這兩個欄位。

- adapter 現在明確宣告「對手餅乾最上方 1 張 HP → 來源卡 HP 最下方、正面朝上」；On Play 的「其他 Cookie HP 2 張」代價仍由 `hpToTrash: { amount: 2, excludeSource: true }` 驗證，不能用 Candy Apple 自身支付。
- `src/game/bs9-010-023.test.ts` 的 BS9-014 實際 command path 現在檢查 HP 順序、正面公開標記、跨所有權 marker 與負向支付不足，而非只檢查張數。
- `npm run test:bs9-014:browser`（腳本 `scripts/bs9-014-browser.mjs`）使用正式 `card:`／`card-negative:` fixture，在 1907×863 與 1164×777 各完成正／負路徑，共 4／4；正向檢查 Pomegranate Cookie HP 4→2、Candy Apple Cookie HP 2→3、新增 `Soul Jam: Light of Destruction` 位於 HP 最下方且正面可點擊查看，對戰紀錄含「正面朝上／最下方」及實際卡圖；負向只有 1 張其他 Cookie HP 時，On Play 不開啟效果面板且 HP 不變。四條路徑無頁面錯誤，官方卡圖載入成功。報告：[test-results/bs9-014/report.json](../test-results/bs9-014/report.json)；正向截圖：[桌機](../test-results/bs9-014/positive-1907-PASS.png)、[平板](../test-results/bs9-014/positive-1164-PASS.png)。

這是候選 `test-state` 的局部修復驗收：BS9 仍未進正式卡池、未 promote，也未完成正式牌組／完整線上逐卡對局。

### 2026-09-11 BS9-015 Parfait Cookie 昏厥 Then 目標修復與重新驗證

使用者回報 BS9-015 昏厥效果第一段從手牌登場 Capricious Wizard 後，第二段「將該 Cookie 最上方 1 張 HP 回到手牌」的面板錯誤同時列出 Pomegranate Cookie 與 Capricious Wizard。根因是共用 `getEffectTargetCandidates` 只套用一般 `side: 'self'` selector，沒有把 `previousEffectTargetOnly` 對應到 pending 效果佇列保存的前一步目標 ID。

- `src/game/effects/targeting.ts` 現在會在 pending 佇列已有前一步目標時，依來源玩家／來源卡實體只保留相同 `instanceId`；立即執行的巢狀 `Then` 尚未寫入 pending ID 時，仍沿用命令傳入的前一步選擇，不改變既有效果結算。
- `src/game/bs9-010-023.test.ts` 新增 BS9-015 的規則層候選回歸：第二段 `getEffectTargetCandidates`／`getEffectSelectionCandidates` 均只回傳 Capricious Wizard，錯誤選 Pomegranate Cookie 會被規則層拒絕；原有 HP 回手與無手牌負向路徑仍通過。
- `npm run test:bs9-015:browser` 以正式 `bs9-card:`／`bs9-card-negative:` candidate fixture，在 1907×863 與 1164×777 完成正／負共 4／4。正向面板只顯示 Capricious Wizard，結算後其 HP 為 3、Pomegranate Cookie 維持 4；負向無手牌時略過第一段且不建立第二段面板。四條路徑均無頁面錯誤，官方卡圖載入成功；報告：[test-results/bs9-015/report.json](../test-results/bs9-015/report.json)，第二段面板截圖：[桌機](../test-results/bs9-015/positive-1907-target-panel.png)、[平板](../test-results/bs9-015/positive-1164-target-panel.png)。

這是候選 `test-state` 的局部 UI／規則驗收：BS9 仍未進正式卡池、未 promote，也未完成正式牌組／完整線上逐卡對局。

### 2026-09-11 BS9-017 Hollyberry Cookie 固定目標與實際受擊驗證

依使用者提供的 BS9-017 英文實體卡面目視核對：Activate／Once Per Turn／任意能量 1，另一張己方 Ancient 是條件，本回合 +2 攻擊只給來源 Cookie；攻擊費用為 1 紅＋2 任意、印刷傷害 2，Then 到對手回合結束前，己方 Ancient 每次受到 3 點以上傷害時改為 2。Golden Cheese Cookie 的實卡具有 Ancient。這張卡沒有「選最多四張」或「受到傷害 +0」的文字。

- adapter 的 `sourceOnly`、`allMatching`、`minimumDamage: 3`／`setDamageTo: 2` 原本已存在。問題在本機／線上 UI 沒有把固定修正對象自動帶入，且用一般多選與加減值文案顯示。現在規則層共用 helper 提供固定 ID；兩個 hook 都使用該結果，面板直接列出受影響卡、不需逐張點選，不能略過部分 Ancient。卡圖保留彩色，避免看起來像不合法目標。
- 技能面板明示另一張 Ancient 是條件、自己 +2；攻擊後提示與公開對戰紀錄都顯示門檻減傷與期限，不再顯示 +0。未改動官方卡文或候選 adapter。
- 正／負 `card:BS9-017` fixture 均補上對手 6 張活躍 `BS8-021 Soul Jam: Light of Destruction` 紅色支援；對手 `BS8-007 Dark Choco Cookie` 可支付 4 張支援實際攻擊。負向以實卡 Strawberry Cookie 取代 Ancient 同伴，保留全部付款資源。
- 規則回歸：來源技能 +2／另一 Ancient 缺少時阻擋；固定全體 ID 與非法非 Ancient 拒絕；傷害 0／1／2 不變、3／5 改為 2，攻擊及效果傷害皆覆蓋；己方回合結束保留、對手回合結束移除。另經正式 `declare-attack`→`skip-trap`→`resolve-next-damage` 命令確認 Golden Cheese HP 5→3。
- `npm.cmd run test:bs9-017:browser` 在 1907×863、1164×777 各完成正／負路徑共 4／4：正向技能支付 1 任意支援後 Hollyberry 攻擊 2→4、Golden Cheese 保持 3；Then 固定列出兩張 Ancient，結束回合後 AI 的 Dark Choco 實際攻擊 Hollyberry，HP 5→3、同伴維持 5。負向技能停用、Then 只列 Hollyberry，對手攻擊非 Ancient Strawberry 時 HP 5→1，Hollyberry 維持 5。官方卡圖完成載入，沒有頁面／請求錯誤。使用者原始 localhost 路徑也完成實際點擊與公開攻擊紀錄核對。
- 驗證：當時 BS9-017 基線為完整 `npm.cmd test -- --maxWorkers=1` 299 檔／4,618 tests、exit 0（439.82 秒）；加入 BS9-018 後為 301 檔／4,627 tests、exit 0（418.03 秒），BS9-021／BS9-041 完成後於 2026-09-12 再跑為 302 檔／4,631 tests、exit 0（386.94 秒）；BS9-032／033 後為 304 檔／4,649 tests、exit 0（402.71 秒）；BS9-034～038 收尾後為 309 檔／4,668 tests、exit 0（394.12 秒）。build、task-scoped ESLint 與 diff check 通過；全域 lint 為既有未追蹤 `.tmp-bs9-030-ui9.mjs` 語法錯誤、`.tmp-probe-deploy.ts` 與 `scripts/diagnose-lv5-conservatism.ts` 共 4 個錯誤，未改動。沒有 stage／commit／push。

Browser 報告：[report.json](../test-results/bs9-017/report.json)；[桌機固定 Ancient](../test-results/bs9-017/positive-1907-attack.png)、[平板技能](../test-results/bs9-017/positive-1164-skill.png)、[桌機實際減傷](../test-results/bs9-017/positive-1907-damage.png)、[平板非 Ancient 受擊](../test-results/bs9-017/negative-1164-damage.png)。這仍是候選 test-state 局部驗收；線上 hook 已有 command 回歸，但正式 BS9 牌組與雙瀏覽器完整逐卡對局未完成，未 promote。

### 2026-09-11 BS9-018 Hero Cookie 對手傷害防止與回合／來源邊界驗證

依使用者提供的 BS9-018 英文實體卡面目視核對：紅色、LV.2、HP 2；被動技能為 `Your Turn`，只要 Hero Cookie 在戰鬥區，自己的所有 Cookies 不會受到對手傷害；普通攻擊支付 RR、造成 2 點傷害。這張卡的文字是對手傷害防止，不能擴張成自己造成的傷害免疫，也不能在對手回合持續生效。

- 規則層將防止條件拆成目標所有權、目前活躍回合、傷害來源玩家，以及 Hero 是否仍在自己的戰鬥區；攻擊與效果傷害共用 `isOpponentDamagePrevented`。效果傷害逐段結算時在實際 HP／FLIP 點重新檢查，因此已建立的待處理序列也不能繞過 Hero 的持續效果；Hero 離場或切到對手回合後，傷害恢復正常。自己的攻擊／效果傷害不會被這張卡擋下。
- `createBs9018ProtectionDemoState` 使用真正 BS9-018 Hero Cookie、正式 BS8-014 Pomegranate Cookie 與對手正式 P-018 Mustard Cookie，建立兩目標、每目標 1 點的效果傷害序列；candidate route 只在 localhost 可解析，沒有寫入正式 registry。
- 規則回歸：`src/game/bs9-018.test.ts` 4 項通過，涵蓋 exact adapter、兩張己方 Cookie 的攻擊／效果來源判定、自己的回合／對手回合、Hero 離場、兩目標逐段 HP 結算，以及 localhost／candidate 隔離。受影響的 command-log、戰鬥佇列與效果測試另以 5 檔／107 項通過。
- Browser：`npm.cmd run test:bs9-018:browser` 在 1907×863 與 1164×777 執行正／負共 4／4。正向兩張 Cookie HP 維持 Hero 2、Pomegranate 4；負向對手回合兩張各受 1 點，HP 為 1／3；兩條路徑均留下兩筆 `resolve-next-damage` 公開摘要，卡面載入官方圖或命名 fallback，沒有頁面錯誤或可見對話框。報告與截圖寫入忽略的 `output/playwright/bs9-018-browser.json`。
- `command-log` 對效果傷害序列以真正的效果來源歸屬每個 `resolve-next-damage`，讓公開 trace 能驗證「未受到傷害」與實際受擊摘要；一般戰鬥傷害仍保留翻開 HP 卡的既有歸屬。候選仍未 promote。

### 2026-09-12 BS9-018 Hero 實際攻擊 BS1-007／BS8-007 與 Kumiho FLIP 續接

為了讓 BS9-018 的 Your Turn 防護在真正的戰鬥流程中可觀察，localhost `card:BS9-018` 現在由 Hero Cookie 實際攻擊正式 BS1-007 Melon Bun Cookie 或 BS8-007 Dark Choco Cookie，目標最上方 HP 由正式 BS1-002 Kumiho Cookie 翻開。`card-negative:BS9-018` 移除戰鬥區的 Hero，只由正式 Pomegranate Cookie 攻擊，保留相同 Kumiho HP／攻擊鏈作為負向對照。

- `createBs9018KumihoAttackDemoState` 透過正式 `declare-attack`、`skip-trap`、`resolve-next-damage` 建立待處理 HP FLIP；防守方在實際 modal 選 1 張手牌支付 Kumiho，並從場上的攻擊 Cookie 選效果目標。正向 Hero 仍在戰鬥區時，1 點 Kumiho 效果傷害不扣 Hero HP；負向 Pomegranate 會扣 1 點。原攻擊剩餘傷害仍在 FLIP 後續接完成。
- `src/game/bs9-018.test.ts` 現為 9 項，涵蓋兩個正式攻擊目標、正／負 attacker、BS1-002 翻牌／棄牌／效果目標、完整 command log 與 localhost／hostname 隔離；`card:`／`card-negative:` 可用 `bs9-target=BS8-007` 切換 Dark Choco。
- Browser：`npm.cmd run test:bs9-018:browser` 在 1907×863 與 1164×777、BS1-007／BS8-007 及正／負路徑共 8／8 通過。腳本實際選擇 Kumiho 目標與 1 張 Soul Jam 手牌，公開 trace 含 `resolve-next-damage`／`resolve-flip`；Hero 路徑攻擊者 HP 維持 2，Pomegranate 路徑由 4 降至 3，兩種目標的原攻擊傷害也均完成。正向 4／4 另通過候選 `imageUrl` 的 request／render／load；負向 4／4 明確記錄 Hero 留在對手隱藏手牌，正面卡圖不在公開 UI，未將卡背誤算為 exact image。報告與截圖寫入忽略的 `output/playwright/bs9-018-browser.json`／`bs9-018-*.png`。
- 以上仍是候選 localhost test-state 的規則／UI 局部證據；BS9 未進正式 registry、Standard／Open 牌組或 promote，也未完成正式牌組、多人或線上逐卡驗收。

### 2026-09-12 BS9-021 Stolen Light of Truth 精準陷阱目標與 HP 朝向驗證

依官方 BS9-021 實體卡圖與英文卡文核對：紅色、LV.1、HP 1 的陷阱，支付 3 點紅色能量後「選至多 1 張對手餅乾；將該餅乾最上方 1 張 HP 正面朝上放到己方 Cookie HP 的最下方」。這個效果同時有對手 donor 與己方 receiver，不能讓一般雙目標上限把對手選擇擴成兩張，也不能把搬入的 HP 卡藏回牌堆。

- `official-effect-adapter.ts` 現在明確宣告 `transfer-hp` 的 `target: opponent, max: 1`、`receiverTarget: self, min/max: 1`、`hpPlacement: 'bottom'` 與 `faceUp: true`。本機／線上陷阱控制器使用共用的跨所有權目標上限 helper，第一段最多只能選 1 張對手 Cookie；AI 也能解析己方 receiver。
- 規則回歸新增於 `src/game/bs9-010-023.test.ts`：超選兩名 donor 會被拒絕；正向由 Burning Spice Cookie 取最上方 HP，放入 Lassi Guard Kulfi 的最下方並留下公開 face-up marker；無 HP 的負向 donor 不捏造卡片，receiver 不增加公開 HP。BS9-024～029 與既有同側雙目標行為仍維持原上限。
- Browser：`npm.cmd run test:bs9-021:browser` 在 1907×863 與 1164×777 各執行正／負路徑，共 4／4。實際操作付款、最多 1 張 donor（第二次點擊只替換第一張）、己方 receiver 與確認；正向 donor HP 5→4、receiver 5→2，新增 Soul Jam 卡位於 HP 最下方且可見正面，公開 trace 含「正面朝上／最下方」；負向 donor HP 0、receiver 維持 1，沒有虛構 HP 卡或放置 trace。四條路徑均通過 BS9-021 候選 `imageUrl` 的 request／render／load，無頁面錯誤或殘留對話框，報告與截圖寫入忽略的 `output/playwright/bs9-021-browser.json`／`bs9-021-*.png`。
- 這仍是 candidate `test-state` 局部驗證：BS9-021 未進正式 registry、Standard／Open 牌組或 promote，也未完成正式牌組／多人／線上逐卡驗收。

### 先前第二批紀錄

本輪依官方英文卡文建立第二批 candidate fixture，補上 EXTRA、昏厥時間窗、HP 搬移、Ancient／同名條件、Your Turn 防護、Item／Trap／Stage 的支付與 Then 續接。`src/game/bs9-010-023.test.ts` 的 8 項規則／adapter／localhost route 回歸通過；`npm run test:bs9-010-023:browser` 在 1907×863／1164×777 完成 20 筆候選記錄的正向／負向共 **80／80** 路徑，沒有頁面錯誤。BS9-001～023 的正／負 card-check fixture 牌區、HP、手牌、支援、棄牌與 EXTRA 卡均取自官方 BS8／BS9／Starter 記錄，並由實體卡牌回歸測試檢查卡號格式與佔位符遺漏；每筆候選均通過該筆 exact image gate。Browser 報告仍以實際互動的效果案例為主，其餘卡號保留真卡面掛載與正／負 fixture smoke，不能解讀成正式牌組或完整多人／線上逐卡對局。

| 卡號 | 本輪候選證據 |
| --- | --- |
| BS9-010 | EXTRA 條件正／負入口、OnPlay 對手手牌轉 HP；規則回歸另覆蓋攻擊後可選能量與 HP 搬移。 |
| BS9-011 | OnPlay 紅色 LV.1 昏厥數量條件；Browser 正向造成 1 傷害、負向顯示條件未滿足並自動略過。 |
| BS9-012～013 | 對手回合結束自傷條件與無技能 Cookie 登場；Browser 正／負 fixture smoke。 |
| BS9-014～018 | BS9-014 另完成 HP 2 張代價與對手最上方 HP 正面朝上放到來源最下方的 command／Browser 正負驗收；BS9-015～017 具備各自的 HP／昏厥／Ancient 局部證據；BS9-018 另完成 Hero 對手傷害防止的攻擊／效果來源與 own-turn／opponent-turn A/B Browser 驗收。 |
| BS9-019～020 | Item 紅色能量支付；BS9-019 目標加攻後加 HP，BS9-020 抽最多 2 張再棄 1 張；Browser 正向完成面板操作，負向不提供「使用」。 |
| BS9-021 | Trap 3 紅色能量、最多 1 張對手 donor 與 1 張己方 receiver；最上方 HP 正面朝上放到己方 HP 最下方，已完成規則與雙尺寸 Browser 正／負驗收。 |
| BS9-022 | Trap 紅色能量、對手攻擊 -1 及對手持有 HP 時抽最多 1 張；規則與 Browser 正／負路徑通過。 |
| BS9-023 | Stage 放置／啟動各付 1 紅色能量、橫置來源與最多 2 個己方目標；Browser 正／負路徑通過。 |

另以 Chrome 直接開啟 localhost `127.0.0.1:5173` 走過 BS9-011 正／負路徑：正向選擇對手 Melon Bun Cookie 後效果紀錄顯示「受到 1 傷害」；負向登場後顯示「效果尚未滿足發動條件」。這是開發用候選狀態與代表性 UI 證據，不是正式牌組或線上房間驗收。

## 第三批 BS9-024～029（候選局部通過）

本輪先核對 BS9-024～029 官方卡圖與英文卡文，再以正式 BS8／BS9／Starter 實體卡牌建立候選 fixture。BS9-024 的 Activate 條件為來源剩餘 HP 不超過 4 且己方另有 Ancient；攻擊後 Then 可選擇將來源最上方 1 張 HP 卡回手，支付後對手受到 1 點傷害。BS9-025 依本報告上方的使用者確認採用語義：棄 1 張手牌，翻開後 +1 HP 預設給原附著餅乾，自己的回合可改選另一隻己方餅乾，FLIP 卡本身不轉移。BS9-026 為 FLIP 抽最多 1 張；BS9-027 為啟動時可將最多 1 張手牌置於來源最上方 HP，Then 來源受到 1 點傷害；BS9-028 無主效果；BS9-029 為 FLIP 時在兩張己方餅乾間移動最多 1 張最上方 HP，UI 以有序 donor／receiver 配對選擇呈現。

- 規則／adapter／UI 回歸涵蓋 BS9-024 技能條件與攻擊後 HP 代價、BS9-025 成本／預設受益者／回合內重新指定與 fail-closed 邊界、BS9-026 抽牌／略過、BS9-027 手牌置 HP 後傷害順序、BS9-029 0 或 2 張有序目標及重複／單張／同一張阻擋。
- Browser：原批次腳本曾有 56／56 歷史結果；採用語義後新增專用 BS9-025 U／P × 1907×863／1164×777 × 正／負 **8／8 通過**，包含實際選 Pomegranate Cookie、棄 1 張手牌、發動 FLIP、HP 結算及無手牌 disabled／略過。終端重跑目前受官方影像網路限制，未把失敗報告列入全量通過。
- BS9-025 已由 review-only／fail-closed 改為 strict `verified`；該語義已隨本次 promotion 進入正式 `data/cards/`／registry，正式牌組／多人／線上逐卡仍另列驗收範圍。

## 第四批 BS9-030（候選局部通過）

本輪核對官方 BS9-030「Shadow Milk Cookie」實卡與英文卡文（黃色、LV.3、HP 6、EXTRA；普通攻擊支付 3 點黃色能量、造成 3 點傷害）。卡面包含兩段不同時機：EXTRA 登場前必須從手牌棄置 3 張具有 FLIP 的黃色 Cookie；登場後可將棄牌區最多 1 張 LV.1 Cookie 放入棄牌區；攻擊 Then 則可再棄置 1 張手牌中的 FLIP Cookie，並立即發動該張卡的 FLIP。

- 獨立預期：EXTRA 代價必須使用合格的黃色 FLIP Cookie，支付完成後才將 Shadow Milk 實體化並進入 On Play；攻擊支付沿用一般黃色能量規則；攻擊 Then 的 FLIP 代價與發動者是同一位玩家，不能把來源 Shadow Milk 當成被棄置的 FLIP 卡，也不能重複移動已進棄牌區的卡。被棄置的 BS9-026「Burnt Cheese Cookie」FLIP 抽牌完成後，原攻擊後效果鏈才收尾。
- 規則／adapter／文案回歸：`src/game/bs9-024-029.test.ts` 8 項通過，新增 BS9-030 EXTRA 代價、On Play、真實攻擊、攻擊後 detached FLIP、抽牌 0 張收尾，以及不足 3 張合格 FLIP 的負向案例；公開 command trace 同時確認 EXTRA 登場、代價、On Play、攻擊、攻擊後代價、FLIP 與抽牌事件。
- Browser：`npm run test:bs9-030:browser` 在 1907×863 與 1164×777 共 **8／8** 通過。正向路徑使用 4 張真實黃色 FLIP Cookie，保留 1 張 BS9-026 作攻擊後代價，完成 EXTRA 登場、On Play、攻擊 3 黃色能量、棄置 BS9-026、發動其 FLIP 並選擇抽 0；負向路徑只有 2 張合格手牌，EXTRA 入口顯示「目前無法登場」且沒有送出登場命令。兩種尺寸均通過來源 exact image gate、無頁面錯誤，並保存實際卡圖 URL 與命名 fallback 的截圖／公開 trace 報告於 `output/playwright/bs9-030-browser.json`。
- 公開 trace 的 detached FLIP／抽牌事件歸屬於 BS9-030 的同一攻擊因果鏈；一般 HP 翻牌仍保留翻出卡片的來源歸屬。候選資料仍維持 inventory 隔離，未載入正式 registry、Standard／Open 卡池，也未 promote。

## 第五批 BS9-031（候選局部通過）

本輪核對官方 BS9-031「Alchemist Cookie」實卡與英文卡文：黃色、LV.1、HP 2、FLIP；普通攻擊支付 1 點黃色能量、造成 1 點傷害。FLIP 卡文為「棄置 1 張手牌；己方 1 張 LV.3 Cookie 增加 1 張 HP；Then，若在自己的回合發動，從牌庫抽最多 1 張牌」。本輪同時核對基本版、`@1` 異圖與 `@2` 促銷記錄，三者沿用相同 runtime 效果邊界。

- 獨立預期：發動 FLIP 前必須恰好棄置 1 張手牌；第一段只能選己方 1 張 LV.3 Cookie，成功後先增加 HP；Then 的條件是 FLIP 實際發動者正在自己的回合，才開啟抽 0～1 張的選擇，對手回合只結算 +1 HP、不建立抽牌決策。抽出的牌不由來源 Alchemist Cookie 充當支付，FLIP 來源與棄牌均進入公開棄牌區。
- 規則／adapter 回歸：`src/game/bs9-031.test.ts` 1 檔／5 項通過，涵蓋基本版與兩張異圖轉接、LV.3 目標唯一性、棄牌／錯誤目標阻擋、自己回合抽 0／1 的 Then 續接，以及對手回合只保留 HP 增益的負向路徑。
- own-turn 實際觸發：正向 fixture 以正式 P-018「Mustard Cookie」登場 On Play 的效果傷害移除己方 HP，讓真實 BS9-031 從己方 HP 翻開；這條路徑明確由自己的回合啟動 FLIP。原先以對手攻擊翻牌的畫面只能驗證負向時間窗，已改成此 effect-damage route。
- Browser：`npm run test:bs9-031:browser` 在 1907×863 與 1164×777 共 **12／12** 通過（基本版、`@1`、`@2`）。正向先完成 Mustard Cookie On Play、選唯一的 LV.3 Mustard Cookie、棄 1 張手牌，再分別選抽 1（1907×863）與抽 0（1164×777）；負向切到對手回合，仍增加 1 HP 但沒有 `resolve-draw-up-to`。每筆路徑均通過該筆 exact image gate、無頁面錯誤，報告與截圖寫入忽略的 `output/playwright/bs9-031-browser.json`。
- 候選資料仍維持 inventory 隔離，未載入正式 registry、Standard／Open 卡池，也未 promote；以上是 localhost `test-state` 的局部規則／UI 證據，不等同正式牌組、多人或線上逐卡驗收。

## 第六批 BS9-041（候選局部通過）

本輪核對官方 BS9-041「Pistachio Cookie」三張實卡：基本版、`@1` 異圖與 `@2` 促銷記錄均為黃色、LV.2、HP 2、FLIP，普通攻擊支付 3 點黃色能量造成 2 點傷害；三筆卡圖與來源網址保留於 [BS9 卡表盤點](bs9-card-inventory.md#L93-L95)。FLIP 原文為「Draw up to 1 card from your deck. Then, if activated during your turn, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage.」。

- 獨立預期：FLIP 本身沒有額外支付或棄牌代價，必須先由持有者選擇抽 0／1 張；Then 只在「這張 FLIP 由其持有者自己的回合發動」時成立，成立後以一般效果目標面板選對手 0～1 張 Cookie 造成 1 點效果傷害。自然的 BS9-018 攻擊由玩家攻擊對手時，翻到的是對手 HP，持有者不在自己的回合，因此只能完成抽牌並略過傷害；不能把攻擊者回合誤當成 FLIP 持有者回合。
- 轉接與規則回歸：`src/cards/official-effect-adapter.ts` 對 BS9-041、`@1`、`@2` 共用 exact `draw-up-to`＋`activated-during-your-turn` damage；`src/game/effects/draw-up-to.ts` 在 Then 需要目標時建立 `pendingAbilityEffect`，保留來源、effect index 與原攻擊續接，條件不成立則安全略過。`src/game/bs9-041.test.ts` 4 項通過，涵蓋三筆轉接、抽牌後目標面板、效果傷害後續接原攻擊、自然攻擊條件不成立及 route 隔離。
- Browser：`npm.cmd run test:bs9-041:browser` 在 1907×863、1164×777 共 4／4 通過。正向 `bs9-041-attack:BS9-041:met` 為條件邊界控制 fixture：暫把本機控制面切到 HP 持有者，實際點擊 FLIP、抽 1、選對手 Hero，Hero 由 2/2→1/2，原攻擊目標由 3/4→2/4；公開 trace 依序留下 `resolve-flip`、`resolve-draw-up-to`、`resolve-ability-effect`。負向 `...:unmet` 保留自然 BS9-018 攻擊時間窗，點擊 FLIP、抽 0 後沒有 Then 目標／效果 trace，Hero 維持 2/2，原攻擊目標只由 3/4→2/4。兩尺寸均無頁面錯誤或殘留對話框；報告與截圖寫入忽略的 `output/playwright/bs9-041-browser.json`／`bs9-041-*.png`。官方圖片受本機網路政策阻擋時，腳本只用命名 fallback 維持局部操作可見性，不把 fallback 當成完整卡圖 gate。
- 候選仍維持 inventory 隔離，未載入正式 registry、Standard／Open 卡池，也未 promote；正向路徑是為了操作條件成立的本機控制 fixture，不宣稱自然攻擊可在防守方回合發動 BS9-041，也不等同正式牌組、多人或線上逐卡驗收。

## 第七批 BS9-032（候選局部通過）

本輪核對官方 BS9-032「Yoga Cookie」實卡與英文卡文：黃色、LV.1、HP 1、FLIP；普通攻擊支付 2 點黃色能量、造成 1 點傷害。FLIP 原文為「Draw up to 1 card from your deck. Then, if activated during your turn, set up to 1 of your Cookies active.」。

- 獨立預期：FLIP 沒有能量或棄牌代價，先由持有者選擇抽 0／1 張；Then 只在 FLIP 持有者自己的回合成立。成立時只能選己方至多 1 張橫置 Cookie 設為 active，也可選 0；已 active 的己方 Cookie 與對手 Cookie 都不是合法目標。對手回合翻開時仍可抽 0／1，但不得建立 set-active 決策。
- 轉接與規則回歸：`official-effect-adapter.ts` 新增 BS9-032 exact `draw-up-to`＋`activated-during-your-turn` `set-cookie-active`；`src/game/bs9-032.test.ts` 5 項覆蓋轉接、抽 0／1、唯一己方橫置目標、選 0、對手回合略過 Then、來源種類與原效果傷害序列續接。連同 BS9-041 及本機／線上 pending hook 共 4 檔／38 項通過。
- 續接修正：FLIP 的 `draw-up-to` 現在保留 `sourceKind: 'flip'`，讓本機與線上 UI 在外層 `effectDamageSequence` 尚未結束時仍顯示 Yoga 的 Then 面板；本機／線上自動傷害控制器會等待該 pending 決策。`commands.ts` 也改為只在效果「新建立」傷害序列時進入該序列，避免把既有外層序列誤認成 Yoga 新效果而重複開啟 pending queue。
- Browser：`npm.cmd run test:bs9-032:browser` 在 1907×863、1164×777 共 4／4 通過。桌機正向抽 1 並把橫置 Pomegranate Cookie 設為 active；平板正向抽 0 並選 0，Pomegranate 保持橫置；兩個 opponent-turn 負向均完成抽牌選擇但沒有 Then 面板。四條路徑均通過 BS9-032 exact image request／render／load gate；正向公開 trace 依序包含 `resolve-flip`、`resolve-draw-up-to`、`resolve-ability-effect`，無頁面錯誤或殘留對話框。這仍不取代本輪已完成的實卡目視與正式牌組／線上驗收。
- strict contract audit：只稽核 BS9-032 的 `cards:audit:contracts --strict` 為 verified 1／needs-review 0／blocked 0；全候選 analyzer 為 33 supported、44 no-effect、41 待轉接，strict 86 verified／99 needs-review。候選仍未進正式 registry、Standard／Open 卡池或 promote；正式牌組與真實雙瀏覽器線上 pending 流程仍待。

## 第八批 BS9-033（候選局部通過）

本輪核對官方 BS9-033「GingerBrave」基本版與 `@1` 異圖實卡：黃色、LV.1、HP 3；普通攻擊支付 2 點黃色能量、造成 1 點傷害。Activate／Once Per Turn「Brave Heart」支付 1 點黃色能量，並從手牌棄置 1 張具有 FLIP 的卡；支付完成後若手牌為 6 張以下，從牌庫抽最多 2 張。

- 卡圖：基本版 `test-results/bs9-source/BS9-033.webp`，SHA-256 `E52E63C3127DEDF1621D7890B2586AD90D98ECA6C4BB6B894E5014CA83E2AABF`；`@1` 為 `BS9-033-at1.webp`，SHA-256 `1A1F05CD909D78BFCCE7281A22E3B3611F5A022A0354E3B43F8F0BCD5419E9BC`。兩張於 2026-09-12 以原始解析度目視，卡名、LV／HP、黃色、技能標記、支付、棄牌限制、手牌門檻與攻擊一致；官方網址保留於 [BS9 卡表盤點](bs9-card-inventory.md#L82-L83)。
- 獨立預期：黃色能量與 FLIP 手牌都是真正的啟動代價，必須先支付再檢查手牌張數；起始 7 張、棄 1 後為 6，技能合法並可抽 0／1／2；起始 8 張、棄 1 後仍為 7，技能應封鎖。棄牌候選必須具有 runtime FLIP，不能靠卡名、顏色或一般 Cookie 推定；同一張場上實體一回合只能發動一次。
- 轉接與規則回歸：`official-effect-adapter.ts` 新增 BS9-033 exact `draw-up-to`、黃色 1 與 `discardHandHasFlip`；`skills.ts` 與本地 pending UI 共用固定手牌代價後的張數投影，避免規則允許 7→6、畫面卻用支付前 7 張隱藏效果。`src/game/bs9-033.test.ts` 5 項覆蓋兩張卡圖轉接、6／7／8 張邊界、只有 FLIP 可支付、抽 0／1／2、付款與每回合一次、正負 route 隔離。
- Browser：`npm.cmd run test:bs9-033:browser` 在 1907×863、1164×777 共 **8／8** 通過（基本版與 `@1`）。桌機基本版從 7 張手牌支付 1 黃色、唯一的真實 BS9-032 Yoga Cookie FLIP，再抽 2，手牌最後 8；平板 `@1` 完成相同代價並選擇不抽，手牌最後 6。兩個負向保留 7 張手牌與足夠黃色能量，只把唯一 FLIP 換成非 FLIP 卡，技能按鈕由規則層封鎖且沒有付款／抽牌 trace。每條路徑均通過該筆 exact image gate，正向公開 trace 均有 `begin-activate-skill`、`resolve-ability-effect`、`resolve-draw-up-to`，第二次發動因 Once Per Turn 停用，無頁面錯誤或殘留對話框。
- strict contract audit：BS9-033 基本版與 `@1` 為 verified 2／needs-review 0／blocked 0；全候選 analyzer 為 34 supported、44 no-effect、40 待轉接，strict 88 verified／97 needs-review。候選仍未進正式 registry、Standard／Open 卡池或 promote；Browser 是 localhost `test-state` 候選證據，不等同正式牌組、多人或線上逐卡驗收。

## 第九批 BS9-034～038（候選局部通過）

本輪逐筆目視官方卡圖並核對英文卡文：BS9-034 Fortune Teller Cookie、BS9-035／`@1` Truthless Recluse、BS9-036 Bookseller、BS9-037／`@1` Apple Faerie Cookie、BS9-038 Chess Choco Cookie；七筆卡圖與來源網址見 [BS9 卡表盤點](bs9-card-inventory.md)。異圖只在目視確認卡名、數值、技能、攻擊與標記一致後共用 runtime 語意案例。

- 獨立預期：BS9-034 登場先付 1 黃色，再選對手 0～1 隻並以完整 permutation 重排其全部 HP；BS9-035 Activate 棄任意 1 張手牌，本回合阻止對手透過卡牌效果增加 HP，攻擊 Then 則先棄 1 張具有 FLIP 的 Cookie，再檢查自己休息區是否至少 2 張 Cookie；BS9-036 回合結束必須在「棄 1 張 FLIP Cookie」與「來源最上方 1 張 HP 進棄牌區」中選一個可支付分支；BS9-037 昏厥時可回收自己棄牌區 0～2 張同時符合黃色、Cookie、FLIP 的牌；BS9-038 登場後若已有另一張同名 Cookie，己方當下所有 Cookie 各增加 1 HP。
- 規則與 adapter：新增 opponent HP `reorder-hp`、`prevent-opponent-hp-gain`、帶 FLIP Cookie 過濾且「先付代價再檢查條件」的攻擊後可選效果、回合結束 `choose-one`、帶顏色／類型／FLIP 過濾的 `trash-to-hand`，以及同名條件＋`allMatching` `gain-hp`。HP 增加封鎖涵蓋 `gain-hp`、`hand-to-hp`、`support-to-hp`、`transfer-hp`、裝備附帶 HP 與戰鬥 FLIP 補 HP，但不阻止一般登場配置，也只維持本回合。
- UI／command：本機與線上效果面板都由規則層的 `isChooseOneModePlayable` 停用不可支付分支；`allMatching` HP 增加由規則層自動提供完整固定目標，不能只選部分。HP 重排的 `resolve-reorder-hp` 現會歸屬來源卡，公開 trace 可證明重排結算。BS9-035 沒有 FLIP Cookie 時保留正常攻擊並只停用 Then 支付；有代價但休息區條件不成立時，代價仍保留。
- 測試：`src/game/bs9-034.test.ts`～`bs9-038.test.ts` 共 5 檔／16 項，連同 contract ledger 與效果面板為 7 檔／86 項通過；補強後受影響的 fixed-target／choose-one／command-log 針對性回歸亦通過。
- Browser：`npm.cmd run test:bs9-034-038:browser` 在 1907×863、1164×777 共 **36／36** 通過。每種尺寸涵蓋七筆卡圖記錄的正／負路徑，BS9-035 另拆 Activate 與攻擊 Then；實際操作支付、棄牌、目標、HP 排序、回合結束分支、昏厥回收與固定全體 HP 增加，均通過該筆 exact image gate，無頁面錯誤或殘留對話框。負向分別為無可用黃色能量、無手牌、無 FLIP Cookie、只有 HP 分支可付、棄牌區過濾不符與缺少同名 Cookie。

## 第十批 BS9-039～040、BS9-042～045（候選局部通過）

已逐張在官方亞洲卡表核對卡面與英文原文：BS9-039 Choco Bar Cookie 為無能力 Yellow MIX LV.2；BS9-040 Cauliflower Cookie 的 Activate／Once Per Turn 是付 1 黃色、揭示牌庫頂，僅在該牌為有 FLIP 的 Cookie 時抽最多 1 張；BS9-042 Financier Cookie 的 FLIP 棄 1 張手牌後使附著餅乾 +1 HP；BS9-043 Heart Stained With Lies 在己方 break area LV.4 以上時，把對手已裝備的 [Soul Jam] 正面朝上放回宿主 HP 頂；BS9-044 Shadow Milk Cookie Doll 付 1 黃色、棄 1，回收最多 3 張黃色有 FLIP Cookie；BS9-045 Overtaken Other-Realm 付 1 黃色、棄 2 張有 FLIP Cookie，使最多 1 張對手 Cookie 本回合攻擊 -2，Then 抽最多 2 張。

- 轉接／規則：BS9-040 的 reveal match 同時要求 Cookie 與 runtime FLIP；BS9-043 新增 `equipped-to-hp`，目標是裝備卡而不是宿主，並保留公開 HP 標記；BS9-044 的棄牌區篩選同時限制黃色／Cookie／FLIP；BS9-045 的陷阱代價共用 `getDiscardHandCostCandidates`，介面與 command 層都拒絕非 Cookie 或無 FLIP 的手牌。``src/game/bs9-040.test.ts`` 4 項與 ``src/game/bs9-042-045.test.ts`` 5 項連同受影響 UI／online hook 回歸共 74 項通過。
- Browser：``test:bs9-039-040:browser`` 於 1907×863／1164×777 共 8／8、``test:bs9-042-045:browser`` 共 16／16 通過。實際操作了 Activate 付款、棄手牌、FLIP、Item／Trap 付款、裝備選取、棄牌區目標與 Then 抽牌；各負向 fixture 只移除被測條件而保留其他資源。BS9-045 的候選面板曾錯列一般手牌，已以共用規則層篩選修正；兩個尺寸的候選只顯示兩張有 FLIP 的 Cookie。
- strict：對候選檔逐張執行 BS9-042／043／044／045 strict audit，皆為 verified=1、needs-review=0、blocked=0。`validate:candidate` 通過但仍顯示 inventory、成功轉換 0；`check:card-pool` 通過，沒有 promote。
- strict／候選：七筆逐卡 strict 為 verified 7／needs-review 0／blocked 0；全候選最新 analyzer 為 73 supported、44 no-effect、1 待轉接，一般攻擊 Then 16／16，strict 183 verified／2 needs-review／0 blocked。`validate:candidate` 仍顯示 inventory、成功轉換 0，未進正式 registry、Standard／Open 卡池或 promote；Browser 是 localhost `test-state` 候選證據，不等同正式牌組、多人或線上逐卡驗收。

## 第十一批 BS9-046～049（候選局部通過）

已逐筆目視官方亞洲卡表：BS9-046「Fragmented Soul」是付 2 黃色能量的陷阱，先使最多 1 張對手 Cookie 本回合攻擊 -2，再回收最多 1 張 FLIP Cookie；BS9-047「Yogurt River of Rebirth」以 1 黃色放置，Activate 時橫置來源並棄 1 張手牌後回收 FLIP Cookie；BS9-048「Matcha Cookie」與 `@1` 都是棄 1 張手牌使附著 Cookie +1 HP 的 FLIP；BS9-049「Fig Cookie」與 `@1` 都在昏厥時把最多 1 張對手 LV.1 Cookie 放到對手疲勞支援區。

- 轉接／修正：BS9-046 exact trap 保留攻擊目標與 `Then` 的獨立 `trash-to-hand` effect；修正 Trap 回應 modal 只提交實際渲染的目標步驟，讓尚未呈現的棄牌區選擇正確開啟 EffectPanel。BS9-047 exact stage ability 同時保留來源橫置、棄手牌代價與 FLIP selector；BS9-049 exact faint selector 限定對手 LV.1 與疲勞放置。BS9-048 兩筆異圖的既有 FLIP runtime 已由實卡比對確認相同。
- 規則／UI：`src/game/bs9-046-049.test.ts` 與 `BattleResponseModals.test.tsx` 共 10 項通過，涵蓋 Trap 兩段 effect index、場景無回收候選的合法 no-op、兩筆 FLIP 異圖與昏厥目標的 LV 邊界。雙尺寸 `test:bs9-046-049:browser` 24／24 通過；每條 A/B 都實際操作支付、棄牌、目標、Then／昏厥結算，無殘留對話框或頁面錯誤。
- strict／候選：BS9-046 為 verified 1、047 為 1、048／`@1` 為 2、049／`@1` 為 2，均無 needs-review／blocked。最新全候選 analyzer 為主效果 73 supported、44 no-effect、1 待轉接，strict 183 verified／2 needs-review／0 blocked；`validate:candidate` 是 inventory、converted=0，`check:card-pool` 通過。這些均為 localhost `test-state` 候選證據，不等同正式牌組、多人或線上逐卡驗收，也沒有 promote。

## 第十二批 BS9-050（候選局部通過）

已逐筆目視官方亞洲卡表的 BS9-050 Wind Archer Cookie 基本版／`@1` 異圖（來源 ID 46210／46211），核對綠色 LV.2、HP 4、Crow Storm 的 Activate／Once Per Turn 標記，以及 Arrow of Darkness 的 GGG、3 傷害與 Then 原文。兩筆卡面均為同一張 runtime 語意：本回合己方至少有 2 張支援卡進入棄牌區時，Crow Storm 可將己方至多 1 張支援卡設為 active；攻擊 Then 可將自己支援區恰好 2 張卡放入棄牌區，並讓所有對手 Cookie 各受 1 傷害。

- 轉接／規則：`official-effect-adapter.ts` 新增 BS9-050 skill 的 `support-cards-trashed-this-turn-at-least` 條件與可選 `set-active`，以及攻擊後 `optional-cost-attack` 的兩張 `supportToTrash` 代價與 sequential `damage-all`。本機／線上 Optional Cost Attack UI、command、AI pending handler 與支援區累計計數共用同一套規則；付款候選會排除已選能量，代價不足時可略過 Then 且不移動支援卡。
- 獨立預期：Crow Storm 只在來源仍於戰鬥區、同回合計數至少 2 且存在橫置支援卡時可啟動，選定後該卡變 active 並鎖定本回合 Once Per Turn；Arrow of Darkness 的 Then 必須先支付 2 張己方支援卡，再逐一讓所有對手 Cookie 受 1 傷害，只有 1 張支援卡時付款按鈕停用／略過不應誤棄牌。
- 測試：`src/game/bs9-050.test.ts` 4 項通過，涵蓋兩筆異圖轉接、恰好兩張支援代價與超選拒絕、支援區累計條件／Once Per Turn、逐一傷害與不足時略過；受影響的 Optional Cost Attack／EffectPanel／pending modal 回歸合計 81 項通過。
- Browser：`npm.cmd run test:bs9-050:browser` 於 1907×863／1164×777，基本版與 `@1` 各完成 Crow Storm 正／負及 Arrow of Darkness 正／不足代價負向，共 16／16 通過。正向實際選橫置支援卡設為 active、棄 2 張支援並依序選兩張對手 Cookie，各扣 1 HP；負向分別以計數 1 封鎖技能及只留 1 張支援卡略過 Then。無頁面錯誤或殘留對話框；這仍是 localhost `test-state` 候選證據。
- strict／候選：BS9-050 與 `@1` strict contract 各為 verified（2／2、needs-review 0、blocked 0）；最新全候選分析為主效果 73 supported、44 no-effect、1 待轉接，一般攻擊 Then 16／16，185 筆 strict 183 verified／2 needs-review／0 blocked。`validate:candidate` 維持 inventory、converted=0，`check:card-pool` 通過；兩筆仍未進正式 registry、Standard／Open 卡池或 promote。

## 第十三批 BS9-051～070（候選局部通過）

2026-09-12 依官方英文卡表與實體卡圖逐筆核對 28 筆候選記錄：BS9-051／`@1` Butter Roll、BS9-052 Ring Candy、BS9-053／`@1` Cream Ferret、BS9-054 Mercurial Knight、BS9-055／`@1` Shadow Milk EXTRA、BS9-056～058 Faerie Cookie 1～3、BS9-059 Fairy、BS9-060／`@1`／`@2` Elder Faerie、BS9-061 Silverbell、BS9-062 Carameleon、BS9-063／`@1` Cookiemals、BS9-064／`@1` Clover、BS9-065／`@1` Pure Vanilla、BS9-066 Meat Jelly、BS9-067 Concealer of Truth、BS9-068 Radiant Light of Protection、BS9-069 Broken Seal、BS9-070 Puppet Theater Stage。異圖只在卡名、顏色、LV／HP、技能標記、支付、目標與攻擊文字一致後共用 runtime 語意；原始卡圖網址與文字保留於 [BS9 卡表盤點](bs9-card-inventory.md)。

- 獨立契約：BS9-051 FLIP 抽最多 1；BS9-052 支援區至少 7 張時來源 +1 攻擊；BS9-053 FLIP 回手最多 3 張支援卡，再以相同數量的綠色手牌橫置放回支援區；BS9-054 Activate／Once Per Turn 棄 2 張支援卡，選己方至多 1 隻本回合 +1 攻擊。BS9-056～058 為無技能餅乾，僅保留各自印刷攻擊費用／傷害。
- BS9-055 EXTRA 的登場門檻是對手支援區至少 3 張且本回合己方至少 2 張支援卡進棄牌；登場後 Activate／Once Per Turn 在己方支援區至多 5 張時，將牌庫頂 1 張以橫置放入支援區；攻擊 Then 可將 1 張支援卡回手後選對手至多 1 隻造成 1 傷害。BS9-059 攻擊 Then 為可選的「自身＋2 張支援卡送棄」代價，支付後抽最多 2 張。
- BS9-060 Activate／Once Per Turn 棄 2 張支援卡並將己方至多 2 張支援卡設為 active；攻擊 Then 只有對手支援區至少 6 張時才可選對手 Cookie 造成 1 傷害。BS9-061 在本回合己方至少 2 張支援卡進棄牌時，將牌庫頂 1 張橫置放入支援區；BS9-062 攻擊 Then 必須棄 2 張支援卡。BS9-063 在本回合同一累計條件成立時，先將來源送棄，再抽最多 2 張並棄 1 張。
- BS9-064 昏厥時必須選對手支援區 1 張送棄；BS9-065 的技能需另一張 Ancient Cookie 才能把己方 1 張支援卡設為 active，攻擊 Then 則可支付 2 張支援卡後選己方至多 1 隻 +1 HP。BS9-066／067 均為綠色能量 1 加 1 張支援區代價，前者選己方 Cookie +1 HP、後者抽最多 2 張。BS9-068 為綠色 1 的陷阱，僅在己方支援少於對手時使對手所有 Cookie 本回合攻擊 -1；BS9-069 為綠色 2，選對手至多 1 隻本回合攻擊 -2，且對手支援至少 5 張時 Then 可將己方至多 1 張支援設為 active。BS9-070 放置支付綠色 1；Activate 再支付綠色 1 並橫置來源，己方支援不多於對手且本回合至少棄 2 張支援時，將牌庫頂 1 張以 active 放入支援區。
- 轉接／規則：`official-effect-adapter.ts` 補齊 051～070 的 exact FLIP／passive／skill／EXTRA／attack Then／item／faint／trap／stage 結構；支援區棄牌累計、對手支援門檻、Ancient／來源限定、同數量綠色回放、可選代價與來源自棄均由純函式條件及共用 `GameCommand` 執行。契約 ledger 另將 BS9-059 單一括號中的「自身＋支援卡」拆成 `self-to-trash` 與 `support-to-trash` 兩項證據，strict audit 不再以 unknown cost 放行。
- UI／公開 trace：本機效果面板、攻擊後可選代價、EXTRA 區、昏厥／陷阱回應、物品支付與場景橫置均走規則層候選；負向路徑保留真正的 disabled／無 modal／略過狀態（BS9-068 條件不成立不開陷阱回應，BS9-064 無合法對手支援時只能拒絕）。Browser 檢查實際卡面名稱、官方圖片 URL（`naturalWidth > 0`）、支付／代價／目標順序、公開 `GameCommand` trace、public state 與頁面錯誤；BS9-062 負向夾具修正為宣告前支援卡全橫置，避免捏造無法結算的必須棄牌 pending。
- 測試：`src/game/bs9-051-070.test.ts` 與 contract ledger 針對 28 筆轉換、異圖、條件／支付／Then／跨時機邊界共 34 項通過；另補 BS9-062 負向夾具 `pendingBattle=null` 回歸。`npm.cmd run test:bs9-051-070:browser` 在 1907×863 與 1164×777 執行 28 筆實體記錄的正／負路徑（含 35 組操作案例），共 **140／140** 通過；140／140 exact image loaded、140／140 無殘留 pending、70／70 負向 evidence、94 條 command trace 與 140／140 public state，無頁面錯誤。
- strict／候選：逐卡 `cards:audit:contracts --strict` 為 **28 筆 verified、0 needs-review、0 blocked**；候選子集實際轉換 **28／28**，無 unsupported。`npm.cmd run validate:candidate -- --dir data/candidates --strict-contracts` 通過（1 檔／185 筆、converted=0），`converted=0` 是因候選仍為 inventory 的預期結果；`check:card-pool` 通過且正式 registry 的 BS9-051～070 為 0 筆。所有候選仍未進正式牌組、Standard／Open 卡池，未 promote、commit 或 push。

## 第十四批 BS9-071～118（候選全範圍通過）

2026-09-12 依官方英文資料與實體卡圖逐筆核對 BS9-071～118 的 **76 筆候選記錄（含所有異圖變體）**。每筆均建立獨立卡面／卡名／來源圖片契約，並以該筆官方 `cardNumber` 驗證 exact adapter；無技能卡仍保留正式攻擊／登場資料，不以共用 fixture 取代卡圖存在性檢查。

- 轉接／規則：完成 071～118 的 FLIP、attached HP、一般技能／攻擊 `Then`、EXTRA／Awaken、Item、Trap、Stage 與 Refresh 分支。高風險路徑包括 075 的二選一牌庫位置、077／100 的 On Play 抽牌後手牌回牌庫、079／088／102 的 EXTRA／攻擊續接、084／110 的附著餅乾 +1 HP、085 的牌庫頂／底選擇、095／118 的場景觸發（含跨所有權）、096／111 的 Refresh 防止／計數、112／113 的棄牌區門檻與 FLIP，以及 114～117 的二選一／陷阱條件。支付、代價、目標、時機、Once Per Turn 與 Then 順序均由規則層及共用 `GameCommand` 執行。
- UI／公開 trace：077／100 的正向路徑由手牌實際點選「登場」後才進入 EffectPanel，完成抽牌、手牌棄置或放回牌庫頂；負向路徑保留來源實卡並切換至對手回合，驗證登場時機阻擋。其餘技能、攻擊、EXTRA、Item、Trap、Stage 與 FLIP 均檢查實際卡面、合法／不合法候選、disabled／略過狀態、公開 `GameCommand` trace 與頁面錯誤。完整矩陣產生 210 條 command trace，其中 152 條具 substantive settlement；其餘為刻意的條件阻擋、無技能普通攻擊或實體來源觀察。**352／352 lane** 成功載入該筆官方影像，負向證據 **176／176**，不再以來源移除跳過 image gate。
- 測試：新增 `src/game/bs9-071-118.test.ts`，目前 **11 項**測試涵蓋 76 筆轉換／strict、精確成本與目標、FLIP／牌庫位置／attached HP、技能／目標／Once Per Turn、Refresh 與棄牌區門檻，以及 2026-09-13 補上的 BS9-101 檢視牌庫分支、攻擊後移牌／條件／目標邊界；檔案已通過。
- Browser：原版 `npm.cmd run test:bs9-071-118:browser` 的 **372／372** 僅保留為歷史 smoke；新版嚴格閘門去除 vanilla attack 重複後為 352 lanes，驗證 exact variant、官方 `imageUrl` 載入、正／負 UI evidence、substantive trace 與公開 final state，最終 **352／352 通過**（1907×863／1164×777）。
- strict／候選：071～118 子集為 **76／76 verified、0 needs-review、0 blocked**；採用 BS9-025 語義後全檔 strict 為 **185 verified／0 needs-review／0 blocked**。`npm.cmd run validate:candidate -- --require-promotion-ready --strict-contracts` 為 1 檔／185 筆、成功轉換 **174**；正式 registry 維持 0，未 promote、commit 或 push。

### 2026-09-13 BS9-071～118 runtime hardening

依新版 card-import-audit／develop-braverse 驗收門檻，重新檢查「strict／Browser 綠燈是否真的代表效果結算」。本輪補上可捕捉規則根因的回歸，而不是只增加入口 trace：

- `draw-up-to` 抽空牌庫進入 Refresh 時，保留 `afterEffects`／來源／戰鬥續接；BS9-077、085、086、093 的抽牌後手牌去向不再因 Refresh 靜默遺失。
- BS9-111 改以 Refresh 的對手控制者套用「2 張 Cookie 進 Break」，並以雙向測試確認持有者自己仍是 1 張、對手才是 2 張。
- BS9-106～108 接上「自己的 Shadow Milk 效果造成自己的手牌棄置」provenance queue；own-cost 會分別觸發抽牌／+HP／磨對手 HP，對手被迫棄牌的 negative path 不會誤觸發。
- BS9-116 補齊 `hp-to-trash` 陷阱目標候選／驗證；BS9-117 保留陷阱第一段選定目標給 Then，並在對手棄牌未達 20 時跳過第二段。
- BS9-101 補上紫色命中與三張非紫色的實際檢視／入手／Trash 分支；另補 BS9-075／076／077／081／083／087 的牌庫移動、條件、目標與支付邊界。
- 共用 `useMatchController`／candidate fixture 調整後，重新執行 BS9-018 實際攻擊→Kumiho FLIP **8／8** 與 BS9-041 Pistachio FLIP draw 0／1、Your Turn Then A/B **12／12**（1907×863／1164×777），均無 Browser failure；041 三筆異圖均重新確認 exact official image 與公開 final state。

本輪命令結果：BS9-071～118 規則回歸 **11 項**與完整 Vitest **319 檔／4,757 項**均 exit 0；`npm.cmd run build`、`npm.cmd run server:typecheck`、受影響 TS／TSX scoped ESLint 均 exit 0。新版 Browser 全矩陣為 **352／352 通過**（1907×863／1164×777；210 command traces、152 substantive settlement、352 exact image loaded、176 negative evidence）。全域 `npm.cmd run lint` 仍被既有 `.tmp-bs9-030-ui9.mjs`、`.tmp-probe-deploy.ts` 與 `scripts/diagnose-lv5-conservatism.ts` 的 4 個錯誤阻擋，未改動無關檔案。

本輪另修正共用好友房驗收腳本仍等待已移除的 `command-log-filters` selector，改為等待目前 `OnlineActivityFeed` 實際渲染的完整紀錄區；`npm.cmd run test:online:browser` 的桌機／280px modal **2／2** 通過，`npm.cmd run test:online:match:browser` 的開房、回合同步、攻擊預覽、支援支付、拒絕、斷線與連線失敗處理亦通過。這是共用線上層 gate，不替代逐張 BS9 正式牌組驗收。

候選層的 BS9-071～118 已達本輪完成條件：新版矩陣 352／352 全綠，並通過 exact image、正／負互動、substantive trace 與無殘留 public pending 檢查；BS9-025 基礎版與 `@1` 另以專用雙尺寸正／負 8／8 通過並完成採用語義轉接。這些仍是候選 `test-state`／localhost 證據，不能替代正式牌組、Standard／Open、雙瀏覽器多人或線上逐卡驗收。

## 新機制與高風險待查項

下列依官方文字做盤點；第一批 BS9-001～009、第二批 BS9-021 的本次卡圖、第三批 BS9-024～029、第四批 BS9-030、第五批 BS9-031、第六批 BS9-041、第七批 BS9-032、第八批 BS9-033、第九批 BS9-034～038、第十批 BS9-039～040、BS9-042～045、第十一批 BS9-046～049、第十二批 BS9-050、第十三批 BS9-051～070 與第十四批 BS9-071～118 的卡圖均已另行核對；以下只列正式牌組／多人／線上逐卡尚待事項。BS9-025 的操作定義已依使用者確認採用，且明確標示為專案語義而非官方新增裁決。

| 卡號 | 機制／待查事項 |
| --- | --- |
| 001 | 本回合指定己方餅乾受到的效果傷害減 2；現有 prevent-effect-damage 是完全防止，modify-all-effect-damage 是造成傷害光環，不能直接替代 |
| 010／011 | 上個對手回合／本回合昏厥事件，需按己方、紅色、LV.1 與數量計數；BS9-002／006／009 的第一批條件窗口已完成獨立實作與 A/B |
| 010 | 對手手牌／HP 卡面朝上成為來源 HP：選擇權、所有權、公開資訊與離場去向需依官方規則確認 |
| 018 | Hero 在自己的回合且仍在戰鬥區時，己方所有 Cookies 不受對手攻擊／效果傷害；已完成兩目標逐段 A/B，並以 Hero／Pomegranate 實際攻擊 BS1-007／BS8-007 翻出 BS1-002 Kumiho 驗證 FLIP 續接，正式牌組／多人／線上仍待 |
| 021 | Trap 跨所有權移動 HP：對手 donor 最多 1 張、己方 receiver 1 張，最上方 HP 正面朝上放到己方 HP 最下方；候選雙尺寸 A/B 已完成，正式牌組／多人／線上仍待 |
| 025（含 `@1`） | 官方卡文仍未補足選定後動作；採用的專案語義為棄 1 張手牌、FLIP 進 Trash、+1 HP 預設給原附著餅乾，自己的回合可把受益者改選另一隻己方餅乾，且不移動／重新附著 FLIP 卡。strict 已 verified；正式牌組／多人／線上逐卡仍待 |
| 030 | 已完成候選 EXTRA 登場／黃色 FLIP 代價、On Play、攻擊 Then detached FLIP 與抽牌收尾；正式牌組／多人／線上仍待 |
| 031 | FLIP 棄 1 張手牌、己方 LV.3 Cookie +1 HP；自己的回合才抽最多 1 張，已完成候選正／負 A/B，正式牌組／多人／線上仍待 |
| 032 | FLIP 抽最多 1 張；自己的回合才可把己方至多 1 張橫置 Cookie 設為 active，已完成抽 0／1、選 0／1 與 opponent-turn Then 略過的候選雙尺寸 A/B，正式牌組／多人／線上仍待 |
| 033 | Activate／Once Per Turn 支付 1 黃色並棄 1 張具有 FLIP 的手牌後，才檢查手牌 6 張以下並抽最多 2；已完成 7→6 正向、無 FLIP 負向、抽 0／2與每回合一次候選雙尺寸 A/B，正式牌組／多人／線上仍待 |
| 034 | On Play 先付 1 黃色，再選對手至多 1 隻並完整重排全部 HP；雙尺寸支付不足與實際重排 A/B 已完成，正式牌組／多人／線上仍待 |
| 035 | Activate 棄 1 張手牌後阻止對手本回合透過卡牌效果增加 HP；攻擊 Then 先棄 FLIP Cookie 再檢查休息區至少 2 張 Cookie。雙時機正／負 A/B 已完成，正式牌組／多人／線上仍待 |
| 036 | 回合結束在 FLIP Cookie 棄牌與來源頂端 HP 送棄牌區中選一個可支付分支；不可支付分支由規則層停用，雙尺寸 A/B 已完成，正式牌組／多人／線上仍待 |
| 037 | 昏厥時回收自己棄牌區至多 2 張黃色、Cookie、FLIP 交集；異色／非 FLIP 不列候選，雙尺寸 A/B 已完成，正式牌組／多人／線上仍待 |
| 038 | 另一張 Chess Choco Cookie 在己方戰鬥區時，己方全部 Cookie 各 +1 HP；固定全目標不可部分略過，缺少同名卡自動略過，雙尺寸 A/B 已完成，正式牌組／多人／線上仍待 |
| 041 | FLIP 抽最多 1 張；Then 只在 FLIP 持有者自己的回合成立，選對手至多 1 張造成 1 傷害；自然 BS9-018 攻擊為條件不成立，已補條件成立控制 fixture 與 A/B，正式牌組／多人／線上仍待 |
| 046 | Trap 先選攻擊目標、再以獨立面板回收最多 1 張 FLIP Cookie；雙尺寸 A/B 已完成，正式牌組／多人／線上仍待 |
| 047 | Stage 放置後，Activate 橫置來源並棄 1 張手牌，回收最多 1 張 FLIP Cookie；雙尺寸 A/B 已完成，正式牌組／多人／線上仍待 |
| 048 | 基本版與 `@1` 均為 FLIP 棄 1 張手牌使附著 Cookie +1 HP；兩筆各自載入、雙尺寸 A/B 已完成，正式牌組／多人／線上仍待 |
| 049 | 基本版與 `@1` 昏厥時只可選對手 LV.1 Cookie，移至對手疲勞支援區；兩筆各自載入、雙尺寸 A/B 已完成，正式牌組／多人／線上仍待 |
| 050 | Crow Storm 依本回合己方支援卡進入棄牌區的累計事件啟動；候選雙尺寸正／負 Browser 與兩筆 strict 已完成，正式牌組／多人／線上仍待 |
| 055／061／063／070 | 本回合支援區到棄牌區累計事件；已完成候選 exact adapter／規則／雙尺寸正負 Browser，正式牌組／多人／線上仍待 |
| 071～118 | 76 筆（含異圖）均已完成卡圖／契約／exact adapter 與候選正負 Browser；正式牌組／多人／線上逐卡仍待，不得以候選證據 promote |
| 075／081／083／085／086／087／089／090／101 | 牌庫頂／底、揭示、檢視、抽牌後手牌去向與 Refresh 邊界；候選已以正／負 UI 與規則回歸覆核，正式牌組／多人／線上仍待 |
| 088／102 | EXTRA／Awaken 登場門檻、牌庫揭示與攻擊續接；候選已完成各異圖獨立卡面與 Then 案例，正式牌組／多人／線上仍待 |
| 095／118 | Stage 觸發、來源／所有權與 Once Per Turn；候選已完成己方／跨所有權正負路徑，正式牌組／多人／線上仍待 |
| 096／111 | Refresh Cookie Break 防止／累計次數；候選已完成 no-break／count threshold A/B，正式牌組／多人／線上仍待 |
| 112～117 | 棄牌區門檻、FLIP 回收、二選一與陷阱 Then；候選已完成正／負 UI／公開 trace，正式牌組／多人／線上仍待 |

## 首張 cursor：BS9-001（候選局部通過）

BS9-001 基本版、`@1` 與 `@2` 英文實圖均已目視；三筆仍只共用同一份候選 runtime 驗證，不宣稱正式牌組或線上等價。

- 圖片：https://cookierunbraverse.com/data/en_storage/G2fck1k1zK2Vi2PeQy2GWA.webp
- 本機證據：test-results/bs9-source/BS9-001-at1.webp
- SHA-256：E2D118A76608F6A15474E592969795F5B8AC27C8B4888503E1C68AEF373F52A5
- 目視日期／覆核者：2026-09-10／Codex。
- 卡面：Icicle Yeti Cookie，紅色，LV.2，HP 3，C，BS9-001；攻擊 Pointy Icicle，RR，2 傷害。沒有主動技能。
- FLIP 轉錄：Select up to 1 of your Cookies. During this turn, that Cookie receives -2 effect damage.
- 獨立預期：FLIP 時可選己方 0～1 隻；此 FLIP 沒有印刷能量支付或額外代價；選定者本回合每次受到效果傷害減 2，不改攻擊傷害、不影響未選目標，下回合到期。
- 案例：效果傷害 1／2／3 對應 0／0／1；選 0 不加狀態；不能選對手／超選；一般攻擊不减傷；回合到期不减傷；普通攻擊 RR 付款正向及錯色／疲勞負向另外驗證。
- 目前 strict：BS9-001、BS9-001@1、BS9-001@2 均為 `verified`；三筆共用同一個 `modify-damage-received` runtime effect，正式牌組／多人／線上仍待。
- 規則／單元：5 項 BS9-001 回歸通過，涵蓋 0～1 目標、效果傷害 1／2／3 邊界、攻擊不減傷、回合到期與 localhost route 隔離。
- Browser：4／4 通過（1907×863、1164×777；正向選 1 目標／發動，負向選擇不發動；公開 trace 均有 `resolve-flip`，無頁面錯誤）。此為候選 `test-state` 局部驗證，不等同正式牌組、多人或線上逐卡通過。
- 候選仍維持 inventory／needs-review：卡圖已完成本輪目視，但正式牌組／多人／線上 gate 尚未完成，未 promote。

## 已完成的本輪最小實作

1. 新增 BS9 專用 development-only candidate preview loader／route，載入 BS9 候選資料但維持 inventory 隔離；正式 registry、Standard／Open 卡池和線上房間均不載入此候選。
2. 新增 `damageReceivedModifiers` 與 effect／attack／all 分流的傷害計算、跨回合昏厥特徵快照與條件判定；BS9-001／006 的效果傷害邊界、BS9-002 的上一回合顏色／等級條件及回合到期均由規則層處理。
3. 完成 BS9-002／003／006／009、BS9-011／012／014／015／016／017／018／019／020／033～038 的 exact adapter，並補 BS9-010 EXTRA、BS9-021／022 Trap、BS9-023 Stage、BS9-024／027 技能／攻擊後、BS9-026／031／032／041 FLIP、BS9-029 有序雙目標，以及 BS9-030 EXTRA 登場／攻擊後 detached FLIP、BS9-050～070 支援區代價／累計條件、陷阱／物品／昏厥／場景的成本、條件與 Then 續接，及 BS9-071～118 全 76 筆的 FLIP／技能／攻擊／EXTRA／Item／Trap／Stage／Refresh exact adapter；BS9-004／008／013／028／056～058 保留無技能正式登場流程，BS9-025 已依採用語義完成 exact adapter／runtime／UI。
4. 新增 BS9 第一至十四批及 BS9-021 專項的規則／adapter／文案回歸與候選 Browser 正／負驗收；腳本包含 `npm run test:bs9-001:browser`、`test:bs9-002-009:browser`、`test:bs9-010-023:browser`、各專卡腳本、`test:bs9-024-029:browser`、`test:bs9-030:browser`～`test:bs9-050:browser`、`test:bs9-051-070:browser` 與 `test:bs9-071-118:browser`，規則回歸為 `src/game/bs9-071-118.test.ts`；報告寫入忽略的 `test-results/` 與 `output/playwright/`。

## 後續驗收範圍與邊界

BS9-001～118 的 185 筆正式記錄均已有卡圖／契約與 Browser 正／負證據；現行專用命令合計 864 lanes（含重疊加強矩陣），正式 promotion、正式牌組編輯器、通用雙瀏覽器好友房與線上 modal gate 均已通過。依使用者 AGENTS 的架構變更確認門檻，仍保留「每一張 BS9 卡在真實雙瀏覽器線上對局逐卡操作」未建立專用矩陣的邊界：

1. promotion 已完成，BS9-001～118（含所有異圖）現位於正式 `data/cards/`；已完成正式牌組／Standard／Open 可讀取核對、Deck Editor 四視窗與通用雙瀏覽器多人／線上 modal gate；僅逐卡線上多人矩陣仍是未建立的額外覆蓋範圍。
2. BS9-025（基礎版與 `@1`）已依使用者確認的專案語義完成正式牌池接入；官方未發布專卡裁決的事實仍保留在來源紀錄，不把專案語義誤稱官方規則。

本輪責任範圍已交付：candidate preview 模組及測試、App 的明確開發入口、src/game/types.ts、傷害／效果／到期模組、official-effect-adapter、draw-up-to Then pending continuation、contract evidence、Browser 腳本與本報告；保留工作樹既有未提交修改。

## 本輪驗證

- importer regression：Vitest 1 檔／3 項通過，exit 0。
- cards:analyze:bs9-candidate：exit 0，185 筆／118 個基礎卡號，主效果 74 supported、44 no-effect、0 待轉接，額外能力 74 converted、44 not-applicable、0 pending，攻擊 Then 16／16，strict 185 verified／0 needs-review／0 blocked。
- `cards:audit:contracts --strict`：exit 0，185 筆為 verified 185、needs-review 0、blocked 0。
- validate:candidate：promotion 前 exit 0，1 檔／185 筆、成功轉換 174；候選狀態為 `promotion-ready`。
- promote:candidate：exit 0，1 份 BS9 檔案移入正式 `data/cards/`，候選檔移除，registry 重建。
- validate:cards：exit 0，17 個正式檔案／1,600 種卡號、成功轉換 1,574 張。
- check:card-pool：exit 0，正式 registry 與 `data/cards/*.json` 一致；BS9 已納入正式卡池。
- BS9-001 規則／adapter：Vitest 1 檔／5 項通過，exit 0；BS9-002～009 規則／adapter／文案回歸與既有受影響測試一併通過。
- Browser：`npm run test:bs9-001:browser` 12／12、`npm run test:bs9-002-009:browser` 56／56 通過，涵蓋 1907×863／1164×777 正向與負向／略過路徑，exit 0。
- BS9-010～023：`src/game/bs9-010-023.test.ts` 8 項通過；`npm run test:bs9-010-023:browser` **80／80**（1907×863／1164×777）通過，exit 0。代表性 Chrome localhost BS9-011 正／負路徑亦完成；每筆候選均通過 exact image gate，此批仍是 candidate／test-state 局部證據。
- BS9-024～029：`src/game/bs9-024-029.test.ts`、ledger／BattleResponseModals 回歸通過；BS9-025／`@1` 專用 Browser 正／負雙尺寸 **8／8** 通過，實際完成目標改選、棄 1 張手牌、FLIP 結算及無手牌 disabled／略過。批次腳本的 56 lanes 歷史結果保留，但本次終端重跑受官方影像網路限制，未宣稱 56／56 全綠。
- BS9-030：`src/game/bs9-024-029.test.ts` 8 項通過；`npm run test:bs9-030:browser` **8／8**（1907×863／1164×777）通過，exit 0。正向完成真實 EXTRA 代價、On Play、3 黃色能量攻擊、攻擊後 detached BS9-026 FLIP 與抽牌 0；負向以 2 張合格 FLIP Cookie 阻擋 EXTRA 入口。此批仍是 candidate／test-state 局部證據。
- BS9-031：`src/game/bs9-031.test.ts` 1 檔／5 項通過；`npm run test:bs9-031:browser` **12／12**（1907×863／1164×777）通過，exit 0。正向由 P-018 On Play effect-damage 觸發真實 HP FLIP，完成 LV.3 目標、棄 1、抽 0／1；負向切到對手回合後只保留 +1 HP，沒有 Then 抽牌 trace。此批仍是 candidate／test-state 局部證據。
- BS9-032：`src/game/bs9-032.test.ts` 與 BS9-041／本機及線上 pending hook 共 4 檔／38 項通過；`npm.cmd run test:bs9-032:browser` 4／4（1907×863／1164×777）通過，exit 0。正向覆蓋抽 1＋設 active 與抽 0＋選 0；負向在 opponent turn 仍抽牌但略過 Then。strict 單卡為 verified 1／needs-review 0／blocked 0。此批仍是 candidate／test-state 局部證據。
- BS9-033：`src/game/bs9-033.test.ts` 1 檔／5 項通過，與本地 pending hook 合計 2 檔／46 項通過；`npm.cmd run test:bs9-033:browser` **8／8**（1907×863／1164×777）通過，exit 0。正向覆蓋 1 黃色＋唯一 FLIP 代價、支付後 7→6 門檻、抽 0／2與 Once Per Turn；負向在相同手牌張數與能量下以非 FLIP 卡封鎖。strict 基本版／`@1` 為 verified 2／needs-review 0／blocked 0。此批仍是 candidate／test-state 局部證據。
- BS9-034～038：五個專卡測試檔共 16 項，連同 ledger／EffectPanel 為 7 檔／86 項通過；`npm.cmd run test:bs9-034-038:browser` **36／36**（1907×863／1164×777）通過，exit 0。涵蓋 HP 完整重排、HP 增加封鎖、Activate／攻擊 Then 代價、回合結束可支付分支、黃色 FLIP 回收與同名固定全體增 HP；七筆 strict verified 7／needs-review 0／blocked 0。此批仍是 candidate／test-state 局部證據。
- BS9-039～040、042～045：`npm.cmd run test -- --maxWorkers=1 src/game/bs9-040.test.ts src/game/bs9-042-045.test.ts src/components/effects/EffectPanel.test.tsx src/hooks/useOnlinePendingEffect.test.tsx` 為 3 檔／74 項通過；兩個雙尺寸 Browser driver 分別為 8／8、16／16，exit 0。042～045 的候選 strict 各為 verified 1／needs-review 0／blocked 0；此批仍是 candidate／test-state 局部證據。
- BS9-046～049：`src/game/bs9-046-049.test.ts` 與 `BattleResponseModals.test.tsx` 為 2 檔／10 項通過；`npm.cmd run test:bs9-046-049:browser` 為 **24／24**（1907×863／1164×777）通過，exit 0。strict 為 BS9-046 1、047 1、048／`@1` 2、049／`@1` 2 verified；最新全候選 analyzer 為 73／44／1、strict 183／2／0，`validate:candidate` 與 `check:card-pool` 均通過且未 promote。此批仍是 candidate／test-state 局部證據。
- BS9-018：`src/game/bs9-018.test.ts` 1 檔／9 項通過；`npm run test:bs9-018:browser` 8／8（1907×863／1164×777，BS1-007／BS8-007 兩目標）通過，exit 0。正向 Hero／Pomegranate 在自己的回合均不受 P-018 effect-damage，負向切到對手回合各扣 1 HP；兩段 `resolve-next-damage` 均有公開摘要。正向四條路徑通過 Hero 候選 `imageUrl` exact request／render／load，負向四條保留隱藏手牌不適用註記。此批仍是 candidate／test-state 局部證據。
- BS9-021：`src/game/bs9-010-023.test.ts` 的 exact transfer／跨所有權上限／HP 順序回歸與 BS9-024～029、battle-trap 受影響測試共 3 檔／64 項通過；`npm.cmd run test:bs9-021:browser` 4／4（1907×863／1164×777）通過，exit 0。正向實際搬移最上方 HP 至己方最下方且正面朝上，負向無 donor HP 不建立卡片；四條路徑均通過 BS9-021 候選 `imageUrl` exact request／render／load。此批仍是 candidate／test-state 局部證據。
- BS9-041：`src/game/bs9-041.test.ts` 1 檔／4 項通過；`npm.cmd run test:bs9-041:browser` **12／12**（1907×863／1164×777，基本版、`@1`、`@2`）通過，exit 0。正向控制 fixture 實際完成 FLIP、抽 1、選對手 Hero 造成 1 點效果傷害並續接原攻擊；負向自然 BS9-018 攻擊保留持有者回合條件，抽 0 後沒有 Then 目標／效果 trace。此批仍是 candidate／test-state 局部證據。
- BS9-071～118：`src/game/bs9-071-118.test.ts` **11 項**通過；新版 `npm.cmd run test:bs9-071-118:browser` 在 1907×863／1164×777 的嚴格矩陣 **352／352 通過**。報告寫入 `output/playwright/bs9-071-118-browser.json`；210 條 command trace、152 條 substantive settlement、**352 條 official image loaded**、176 條 negative evidence 均已記錄，不把舊 372／372 smoke 當作目前主證據。
- BS9-071～118 Browser driver hardening（2026-09-13）：現行 `scripts/bs9-071-118-browser.mjs` 驗證 exact variant route（`test-state` 保留完整 `@variant`、`contract-card` 使用 base runtime id）、official image `naturalWidth > 0`／request failure、明確正負 UI 證據、substantive trace 與公開 final state／無未結 pending surface；`.card-fallback` 不再算 image pass。BS9-079 的 `.extra-deck-attack-modal` 候選精確選擇／略過與 `resolve-extra-deck-attack` trace，升權 Browser 正／負兩尺寸 **4／4 通過**。
- BS9-071～118 strict／promotion 前候選：子集 `cards:audit:contracts --strict` 為 **76 verified／0 needs-review／0 blocked**；採用 BS9-025 語義後全檔為 **185／0／0**。promotion 後正式 registry 已納入 BS9，沒有 commit 或 push。
- 完整 Vitest：promotion 後再次執行 `npm.cmd test -- --maxWorkers=1`，**319 檔／4,769 項**全部通過，exit 0；受影響 AI audit／Deck Editor 基線已同步。全域 lint 只剩既有未追蹤 `.tmp-bs9-030-ui9.mjs` 語法錯誤、`.tmp-probe-deploy.ts` 及 `scripts/diagnose-lv5-conservatism.ts` 共 4 項錯誤；本輪未修改無關診斷檔。
- build：exit 0；保留既有 chunk size 警告。
- 新增 BS9 腳本／規則相關檔案的 scoped ESLint：exit 0；`git diff --check`：exit 0。
- 全域 lint：exit 1，工作樹既有未追蹤 `.tmp-bs9-030-ui9.mjs` 有 1 項 parsing error，另有 `.tmp-probe-deploy.ts` 1 項與 `scripts/diagnose-lv5-conservatism.ts` 2 項 unused；本輪未修改這些無關檔案。
- 環境：Windows PowerShell、Node 22.22.3；工作樹包含既有 App／adapter／UI 等未提交修改；本輪已依授權 promote。當時仍不 commit、不 push，後續由端到端收尾段落依使用者授權提交；不 push。

## BS9-010 修復驗證

2026-09-11，Windows PowerShell／Node v22.22.3，cwd `C:\Users\WH3FTURTLE\Documents\braverse-web-game`，基底 HEAD `28a20a901dfccd17076fcaa4b3e0dfbe8ebbe140`。本輪修改限於 BS9-010 轉接、HP 朝向／位置與公開資訊、共用 EXTRA 原因提示、對應測試／Browser 腳本及文件；保留既有未追蹤檔案，沒有 commit、push 或 promote。

| 檢查 | 結果與範圍 |
| --- | --- |
| 先失敗再修復 | 新增的匿名手牌、HP 最下方／正反面 3 個回歸先失敗，實作後通過；後續補齊邊界與 UI／伺服器整合 |
| 完整 Vitest | BS9-010 修復當時執行 299 檔／4,612 項通過；BS9-018 完成後為 301 檔／4,627 項；BS9-032／033 與續接修正完成後重新執行 `npm.cmd test -- --maxWorkers=1` 為 304 檔／4,649 項通過，exit 0，402.71 秒 |
| EXTRA 受影響回歸 | `npm.cmd test -- --maxWorkers=1 src/game/bs9-010-hp-placement.test.ts src/game/extra-deck.test.ts src/components/battle/BattleRow.test.tsx src/game/bs9-024-029.test.ts`，4 檔／117 項通過，exit 0 |
| 規則與 RoomStore | `npm.cmd test -- --maxWorkers=1 src/game/bs9-010-hp-placement.test.ts server/src/rooms.test.ts`，2 檔／47 項通過，exit 0；包含匿名位置往返與雙方 HP 遮罩 |
| Browser | build 後執行 `node scripts/bs9-010-browser.mjs`，雙尺寸 10／10 通過，exit 0；來源／公開 HP 的官方卡圖、公開對戰紀錄、HP 點擊詳情、正／負與 0／略過皆驗證。報告位於 `test-results/bs9-010/report.json` |
| build／server typecheck | `npm.cmd run build`、`npm.cmd run server:typecheck` 均 exit 0；build 保留既有 bundle size 警告。規則與 UI 最終程式碼建置後，僅追加測試／Browser 檢查與文件，故沿用此 build |
| 本次檔案 lint | 對所有修改的 TS／TSX、新增 `card-visibility.ts`、專卡測試與 Browser 腳本執行 ESLint，exit 0，無警告 |
| 全域 lint | `npm.cmd run lint` exit 1；既有未追蹤 `.tmp-bs9-030-ui9.mjs` 1 項 parsing error、`.tmp-probe-deploy.ts` 1 項及 `scripts/diagnose-lv5-conservatism.ts` 2 項 unused，未修改或排除這些檔案 |
| 一般好友房 Browser | 原 `npm.cmd run test:online:match:browser` exit 1，停在第 393 行已不存在的 `command-log-filters`。核對現行 `OnlineActivityFeed` 後，在忽略的測試副本只將此定位改成 `.online-activity-history-header`，其餘斷言不變；`node test-results/bs9-010-online-match-current.mjs` exit 0，通過建房／開局、支援→主要同步、攻擊預覽／支付、完整紀錄、卡牌詳情、非法指令拒絕與斷線提示。原腳本未修改；此結果不是 BS9-010 正式線上逐卡驗收 |
| 最終差異 | `git diff --check` exit 0；stage 為空，既有未追蹤檔案維持未納入 |

完整輸出保存於 `test-results/bs9-010-*.log`；所有產物均未 stage。候選 BS9-010 仍未進正式牌組／正式卡池，完整正式線上對局與其他異圖的獨立驗收不在本次通過宣稱內。
