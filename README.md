# 薑餅人對戰卡牌 Braverse

以 React、TypeScript 與 Vite 建置的 CookieRun: Braverse 網頁遊戲原型。

> **非官方聲明**：本專案為 CookieRun: Braverse 的**非官方粉絲研究 / 學習型實作**，與 Devsisters Corporation 沒有任何合作、授權或背書關係。CookieRun: Braverse 及其卡牌、插畫、標誌之著作權與商標權均屬 Devsisters 及其授權方所有。本專案不商用、不收費；素材使用政策見 [docs/ip-and-asset-policy.md](docs/ip-and-asset-policy.md)。

## 開發背景

BS6 已完成資料準備期、逐色 Browser 稽核與正式 promote：138 筆記錄（107 個不同基礎卡號；106 筆基礎記錄，另 BS6-091 僅有異圖／變體；共 32 筆異圖／變體）已納入 `data/cards/`；正式卡池重新通過 138／138 Browser 入口矩陣、97／97 效果互動矩陣、adapter 回歸、`validate:cards` 與 `check:card-pool`。後續官方更新仍先輸出至 `data/candidates/`，完成同一套稽核後再 promote。

BS6-020「Tonic Spray」已補上陷阱後半段的自身餅乾選擇：可將所選餅乾最上方至多 1 張 HP 卡移回手牌，並保留可略過選擇與既有必要自身目標陷阱的相容行為。

本輪已完成 BS5／BS6 逐卡 Browser 效果語意稽核（2026-08-15）：BS5 效果 143／143（含 14 張條件／時機 A/B）、負向 153／153、無效果攻擊 10／10；BS6 效果 97／97（含 BS6-039 A/B）、負向 138／138、無效果攻擊 10／10。另以 `scripts/verify-bs5-bs6-semantics.ts` 對兩系列全部 291 筆記錄逐張比對官方文字與 runtime 的攻擊／技能／陷阱／物品／場景／FLIP 能量代價、{da} 傷害、Then 傷害、HP 代價與抽牌數量：BS5 400 項、BS6 325 項全部相符。B fixture 將支援區卡設為疲勞，驗證非法能量支付、無支付攻擊不成立，以及攻擊後 `Then` 在實際待處理視窗可正常收斂；報告保存在 `docs/`（`bs5-effect-audit-2026-08-15.json` 等）。

卡牌匯入稽核可使用 BraverseFan 作為社群交叉參考，但不取代官方 JSON、卡面、規則與公告。

卡牌效果文字的官方標記與遊戲規則顯示共用 `CardEffectText`；圖片標籤資產集中於 `public/card-tags/`，保留文字回退與無障礙替代文字。

牌組賽制分為標準賽制與開放賽制：標準賽制套用台灣公告的禁卡／限卡表；開放賽制則允許正式卡池內所有卡牌使用。兩種賽制都仍遵守 60 張牌、同名卡最多 4 張、FLIP 最多 16 張，以及至少 1 張餅乾等基本牌組規則。

牌組編輯器的卡池可依卡牌類型、顏色、系列、稀有度，以及餅乾的 LV、HP、攻擊力篩選；攻擊力條件以官方卡文解析出的普通攻擊傷害為準。

BS5／BS6 攻擊後卡文中的尖括號代價已統一轉為可選的攻擊後效果；BS6-044「Roguefort Cookie」與 BS6-061「Walnut Cookie」的支援區餅乾回手代價，以及 BS5／BS6 其餘同類卡牌，均可略過或依條件支付。BS6-044 的追傷固定鎖定本次攻擊目標，目標昏厥時不建立後續效果。

對戰紀錄的陷阱步驟會先列出實際發動的陷阱卡，再列支付、棄牌與目標；作為代價棄置的卡牌（例如 Banquet of Victory）不會再被誤認為效果來源，本機與線上紀錄共用同一份來源卡 metadata。攻擊後效果則會逐步記錄來源卡、官方效果文字、支付／略過選擇、實際移動的卡牌、目標與傷害／昏厥／增 HP／等待 FLIP 等結果。

BS6-051「Timekeeper Cookie」的攻擊後續目標會明確顯示「從自己的手牌選擇最多 2 張綠色卡牌作為目標（已選 N）」；候選清單只列出來源玩家手牌中的綠色卡牌，避免誤顯示成對手餅乾目標。

BS6-062「Time Rend Scissors」的物品能力已補回 `<{G}>` 能量與「將 1 張支援區餅乾返回手牌」的尖括號代價；發動後可選擇最多 1 張對手餅乾造成 1 點傷害，且 UI 會只列出支援區餅乾作為代價候選。

BS6-063「Into a Time Pocket...」的 test-state 以正式卡文的「支援區正好 5 張」建立成立分支；支付 2 張綠色支援卡後，Browser 可實際進入 Then 二選一，選擇將牌庫頂 1 張牌以疲勞狀態放入支援區。這項 fixture 只負責快速建立合法局面，支付、條件、目標與效果結算仍由正式規則引擎驗證。

卡牌詳情中的場景效果沿用官方卡圖換行，將放置場景文字與 Activate 效果分列顯示。

桌面 `tactical-clean` 戰場以深藍桌墊與低對比菱格建立層次；對手場區採紅色、我方採青色完整圓角框，戰鬥區比支援區更深。休息區只保留加大的 `LV. x/10`，兩側功能欄分別依對手「棄牌 → 牌庫 → 場景」與我方「場景 → 牌庫 → 棄牌」排列，並與可見場區等高。全畫面裝飾框不延伸至手牌區，避免切過卡片與影響操作體感。

平板橫向（901–1280px 且高度不超過 840px）正式採用與戰場 mockup 相同的 `src/styles/tablet-layout.css`：1164×777 以支援區／戰鬥區 36／64 與 64／36 鏡射比例配置，手牌改為底部操作 dock，右上／左下雙方資訊牌在此尺寸隱藏，並為右側階段列與左右資源欄保留安全邊界。

對戰桌以共用展示元件呈現本機與線上對戰，將攻擊者、攻擊目標、回應流程與傷害結算的可視回饋維持一致，避免玩家必須從對戰紀錄回推目前攻擊關係。

Browser 實戰稽核與 `test-state` 分層：`test-state` 僅驗證局部成立／不成立 UI 與規則分支；正式 Browser 實戰則從主選單正式牌組入口開始，涵蓋猜拳、調度、起始餅乾、支付、攻擊、陷阱／FLIP、昏厥補位、OnPlay、結束階段與勝負結算，兩者分開記錄。

主選單的 AI 對手設定在桌機／平板以牌組 8、等級 4 的欄寬比例呈現並保留欄間距；手機改為單欄。開發者工具依視窗寬度在桌機顯示、手機可收合，合法牌組的錯誤提示則以布林狀態控制，避免將 `errors.length = 0` 誤渲染到畫面。

戰鬥區文字固定於中央；單張餅乾使用左側卡槽，兩張餅乾分居左右卡槽。卡片的「能量不足」與「啟動技能」提示會完整置於所屬卡片的外側，避免遮蔽中央戰鬥區文字、HP 卡或支援區。

我方攻擊翻開對手 HP 卡的 FLIP 效果時，沿用左側卡牌快速預覽固定顯示約 3 秒；玩家可點擊預覽外側提前關閉，避免必須查看對戰紀錄才能確認翻出的卡片。

本專案以官方 Braverse 規則、官方起始牌組卡牌資料、卡背與能量圖示為基礎，將純函式規則引擎、AI 決策與 React UI 分離。規則引擎集中於 `src/game/`，官方卡牌資料轉接集中於 `src/cards/`，React 畫面只呼叫規則層公開 API，不另寫權威規則。

BS4 沿用 BS3 的候選資料流程：先將官方英文資料匯入 `data/candidates/` 的 `inventory` 快照，再依卡面文字與官方規則逐色稽核 runtime adapter；候選完成驗證與效果覆蓋前不直接併入 `data/cards/`。

測試對局設定以正式卡池為來源，可逐方指定戰鬥區餅乾、精確 HP 卡、起始手牌、牌庫頂端順序、支援區實際卡片與能量顏色、場景卡及棄牌區卡片；未指定的牌庫尾端與支援區張數才以測試填充補足。設定視窗提供 BS3-018 的 Blocker／傷害分支與 BS3-020 的 HP 卡回手快速案例，方便在正式規則流程中重現問題並回報。

目前以《綜合規則》Ver.1.2、《CRB 遊戲指南》240812 更新版、《CRB 說明書 P1》、《裁判指南》及 2026-03-30 官方 Rule Update 作為規則文件基線；專案裁定與仍待新版官方資料覆核的項目記錄於 [docs/rule-clarifications.md](docs/rule-clarifications.md)。

卡牌效果觸發會依官方文字描述的區域與卡牌所有者判定，不以造成移動的效果控制者取代事件條件。

效果操作的 UI 以「同一個提示框完成一段決策」為原則：必要時依序呈現能量、代價、二選一效果與目標，並讓玩家在最後一步才確認發動，避免同一效果被巢狀提示打斷；條件效果只有在規則層判定成立且存在合法目標時才顯示目標選擇。

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

BS6 正式卡池包含 138 筆記錄（107 個不同基礎卡號，其中 106 筆為基礎記錄、32 筆為異圖／變體；BS6-091 僅有變體）。主效果待轉接 0 張，攻擊後 `Then` 已完成 27／27；正式 Browser 效果矩陣以可互動效果的基礎卡代表稽核，97／97 通過（含 BS6-039 成立／不成立 A/B）。BS6-041 休息區條件物品、BS6-039 休息區連鎖與 BS6-042 陷阱條件的成立／不成立 test-state 也均通過 Browser 驗證。牌組編輯器已可用 BS6 篩選顯示與加入正式 BS6 卡牌。完整逐色結果見 [BS6 Browser 稽核報告](docs/bs6-browser-audit-2026-08-12.md) 與 [BS6 效果轉接覆蓋盤點](docs/bs6-effect-coverage.md)。

BS6-020 的規則層、離線／線上陷阱控制器與回應 Modal 已完成自身目標回歸測試；完整 Vitest 目前為 208 個測試檔、3,337 項通過，並以本機 Browser test-state 驗證選取與略過兩條路徑。牌組編輯器卡池篩選已支援 LV、HP 與攻擊力條件，攻擊力沿用官方卡文解析結果。BS5／BS6 尖括號攻擊後代價已完成逐卡轉接與可略過回歸，BS6-044 追傷目標與原攻擊目標昏厥分支、BS6-061 支援區回手後 BS1-078 場景條件、BS6-062 物品的支援區餅乾回手代價也已補回歸；攻擊後效果對戰紀錄已補齊來源、代價、目標與結果步驟。BS4-075 Black Pearl Cookie 的攻擊後棄牌代價也已接入可略過 UI，涵蓋支付、略過與最多一張目標的回歸測試。另修正 BS6-053／BS6-055／BS6-058～BS6-063 的 card-check 初始 HP、支援區門檻、合法候選與 Then 續接，並讓 BS4-005／BS2-015 代價昏厥後先完成原效果、再建立補位，完整記錄於 Browser／AI／規則回歸流程。

BS6-101「Twizzly Gummy Cookie」昏厥效果已先顯示可選的紫色能量支援卡付款，再進入棄牌區紫色餅乾登場目標；本機、線上與 AI 共用同一套規則驗證，並保留不支付而略過的合法路徑。

卡牌轉接新增 shadow 行為契約稽核：`src/cards/contracts/` 會將官方來源拆成 clause ledger，交叉比對支付、代價、目標與 `Then` 的 runtime evidence，並產生 `verified`／`needs-review`／`blocked` 報告。`npm run cards:audit:contracts` 只讀取並報告，不改變正式決策；候選資料可用 `--strict-contracts` 阻止未完成契約進入 promote，`promote:candidate` 預設已啟用此 gate。完整流程與限制見 [卡牌行為契約](docs/card-behavior-contract.md)。

卡牌契約 P1～P5 已接續實作：P1 提供契約型別與 shadow compiler；P2 將契約步驟投影到 `DecisionDescriptor`，並由規則層的 energy／cost／target helper 產生合法候選；P3 讓本機 pending modal 與線上效果候選先共用 descriptor，`GameCommand` 仍是唯一執行入口；P4 新增負向／隱藏資訊測試與 `cards:attest` 公開 command trace gate；P5 以 `cards:migrate:batch` 依 card.id、排序、批次執行 shadow migration，未 `verified` 卡牌不會進入批次，也不會改動正式卡池。offset 150 與 offset 175 的 25 張批次均已完成 Browser／runtime gate；契約 parser 另補齊 HP 代價、牌庫底／棄牌區移動、支援區回手、Reveal／Discard 與原始單字母能量標記。

契約稽核已全部歸零：`cards:audit:contracts` 目前 **verified=1,101、needs-review=0、blocked=0**。最後 25 筆缺口分三群修正——（1）16 筆 `payment evidence missing` 與 3 筆 runtime energy：ledger 現在收集 `StageAbility.placementCost` 作為場景卡放置費用的能量證據；（2）9 筆 `cost evidence missing`：BS5-092／BS5-093 補上 `trashToDeck` 技能代價（BS5-092 一併改為 `opponent-attack` 回應觸發並在戰鬥陷阱視窗內支付代價、結算 `modify-attack`，skipTrap 與 playTrap 路徑統一重算傷害）、BS2-081 的 `stage-source-to-trash` 綁定 self-to-trash、P-082 的 trap `alternativeCosts` 綁定 trash-to-break、P-045 修正雙重棄牌代價並以 deck-bottom 效果作為付款證據；（3）BS4-080@2 異圖欄位併寫正規化（技能／攻擊拆分 + Then 抽牌）與 P-100 FLIP 正規化，補齊 Then／once-per-turn／resolution order／timing 證據。契約建立改以 adapter 正規化後的來源為準，runtime 與契約消費同一份文字。25 張修正卡新增回歸測試（`payment-cost-regression.test.ts` 31 項、`bs5-092-attack-response.test.ts` 4 項）並以 25 張 batch 完成 Browser attestation。

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

P-0XX 特典卡原正式卡池的 26 張已完成逐卡轉接與瀏覽器路由掃描；本批依官方資料重新盤點出完整 153 筆 P-0XX 記錄（含 14 筆異圖變體），新增 127 筆候選資料至 `data/candidates/`，且 153／153 筆均已通過 adapter conversion。候選目前為 `promotion-ready`，但尚未 promote；P-082 替代／主支付、P-084 昏厥後轉為 `{N}` 的動態啟動費用，以及 P-147 Special Play 已接上 runtime／UI，並完成專用 Browser 情境驗證。完整記錄見 [P-0XX 匯入盤點](docs/p0xx-card-inventory.md)，已 promote 範圍與剩餘門檻見 [P-0XX 效果稽核](docs/p0xx-effect-coverage.md)。

BS5 YELLOW 與 GREEN 已完成 runtime 轉接，逐色稽核歸零：GREEN 批次新增 `deferred-end-of-turn`（BS5-051／056／058／063「When your turn ends」延遲佇列，於 end 階段重入排空、互動效果建立對應 pending）、`opponent-rests-support`（BS5-065 由對手選定橫置支援卡，`activeOnly` 與候選不足自動略過）、`StageAbility.endPhase`（BS5-066 場景被動觸發，不可手動啟動）；UI 新增 `OpponentRestSupportResponseModal` 並共用本機／線上控制器，`cards:analyze:bs5-candidate` 覆蓋盤點 GREEN 0／0／0（見 [BS5 效果轉接覆蓋盤點](docs/bs5-effect-coverage.md)）。

BS5 BLUE／PURPLE／PURE 的 23 張能力，以及 BS5-087／BS5-109 兩張陷阱主效果與 BS5-067／071／080／085／089／094／097／098／099／106 十張攻擊後 `Then` 已完成 runtime 轉接與回歸測試；`cards:analyze:bs5-candidate`（目前以正式 `data/cards/` 來源分析）顯示 111 張基礎卡的主效果／能力／攻擊 `Then` 待轉接皆為 0。BS5 已於 2026-08-06 promote 至正式卡池，另補上 BS5-089@2 異圖攻擊欄位 normalize 與 attached HP bonus FLIP 的正式驗證契約。

BS5 五色已各建立標準／開放兩種 60 張 AI preset。標準 preset 全部使用 BS5；開放 preset 以 BS5 為主並加入受標準禁限卡表限制的既有卡牌，作為「開放可使用所有正式卡牌」的回歸驗證樣本。牌組編輯器、主選單、本機對戰與線上對戰入口共用同一個賽制欄位與規則驗證。

BS5 標準 preset 已以固定 seed 完成五色各 40 場、共 200 場 Lv.4 矩陣，五色完成率均為 100%、卡死 0 場；依兩組 seed 的隔離比較迭代紅／黃／綠／藍牌組，紫色保留原構築。正式報表見 [BS5 標準牌組 40 場 benchmark](data/decks/bs5-benchmark-report-40-standard.json)。目前勝率僅作為固定樣本觀察，不作為環境強度定案。

BS5-111「覺醒!龍之怒」已依官方 Q&A 改為動態 HP 門檻：攻擊者在攻擊尚未結算完畢時因 BS1-002 FLIP 由 4 HP 降至 3 HP，未結算傷害會套用 +1；防守者在同一筆多點傷害中途降至 3 HP 以下，-1 受擊傷害不追溯套用，必須等下一次攻擊。兩條路徑均有 battle regression test。

完整技術細節見 [docs/architecture.md](docs/architecture.md)（分層架構、規則引擎模組、AI 分級）與 [docs/audit-report.md](docs/audit-report.md)（逐 Phase 完成度盤點）。摘要：

- **規則引擎**：`src/game/` 純函式引擎，五色 + 第二彈官方起始牌組、typed `GameCommand` 指令層（8 決策 + 24 動作）、`commandLog` + replay（含 AI 對局重播）；多段能力效果不得繞過中途決策，已有 8 類決策回歸；`isEffectTargeted` 涵蓋 split-damage、prevent-effect-damage 等效果型別，AI 目標選擇已補齊 7 類效果排序；ST5-007／ST5-022 觸發、同時補位逐一處理 OnPlay 與傷害步驟鎖定皆有完整流程回歸。
- **牌組編輯器**：搜尋／篩選、合法性即時檢查（60 張／同卡 4 張／≥1 餅乾／FLIP ≤16）、匯入匯出、版本化 localStorage 儲存；系列選單已分開 BS3 與 BS4，避免兩彈共用官方 product title 時混在一起。`@1` 卡面變體（如 `BS2-031@1`）與其 base（`BS2-031`）視為同一張卡共用 4 張上限，輸入／匯入時自動正規化為 base；卡池列表僅顯示 base，原始變體資料保留在 `data/cards/*.json` 並可透過 `getCardPoolVariants` 取得。
- **AI**：Lv.1–4 已完成（隨機／啟發式／評估式／兩層前瞻），只讀 `PlayerView` 保證資訊邊界；效果目標選擇涵蓋 split-damage（列舉四種配置取最優）、hp-to-trash/support、disable-flip/attack、battle-to-support、prevent-effect-damage（sourceOnly）等 7 類效果。Lv.2–4 的部署策略採手牌品質門檻，不強制填滿兩張餅乾；戰鬥區已有餅乾時優先保留 FLIP 卡，僅在沒有非 FLIP 替代品或可直接補刀時登場。等級 benchmark 已強制驗證零卡死／deadlock／非法操作／turn cap 與最低勝率，失敗會輸出可重播問題包；見 [docs/ai-levels.md](docs/ai-levels.md)。Lv.5 為設計稿。
- **卡牌池**：BS1/BS2 官方卡池、五色起始牌組、BS3 官方卡池與 P-0XX 特典卡均已匯入；BS3 的 176 筆資料（含 121 張基礎卡、異圖與促銷變體）及目前 26 張 P-0XX 已正式納入 `data/cards/`。另有官方 P-0XX 全量 153 筆資料（含異圖變體）已完成 adapter conversion，其中 127 筆仍在候選區等待 Browser 稽核與 promote；以 [P-0XX 匯入盤點](docs/p0xx-card-inventory.md) 與 [P-0XX 效果稽核](docs/p0xx-effect-coverage.md) 分開追蹤候選與正式狀態。靈魂果醬裝載與 BS3-115 保護（含攻擊附加例外、全場／棄置排除、無目標 Then 中止）已依官方 Q&A 落地。`npm run validate:cards` 接入 CI，除資料完整性外，也檢查 ability 非空、技能標記、可選抽牌、來源橫置及 8 張高風險卡的語意契約。
- **UI**：滿版桌墊 HUD、扇形手牌、統一效果 modal、響應式（最低支援 600×338）；桌面戰場（≥901px）採參考圖的中央戰場、左右資源欄、左側卡牌焦點預覽與右側回合欄排版，底色維持既有深藍／青色基調；1164×777 平板與 1366×768、1440×900、1920×1080 通用桌面 viewport 均以實際卡面邊界驗證，短高度桌面的手牌高度依 viewport 縮放並完整留在畫布內；1280×720 已修正手牌裁切、提高戰鬥區比例與資源標籤／中央狀態提示對比，並保留 hover 與鍵盤 focus 的卡牌快速預覽；主選單使用 CookieRun BRAVERSE 金色／棕色品牌文字排版；餅乾、物品、場景與陷阱的效果操作共用「能量 → 代價 → 目標」導引步驟，缺少的步驟自動略過，支援下一步／上一步並只在最後確認發動；能量支付候選依卡牌明確顏色限制，只有真正沒有顏色的 `MIX` 卡才視為萬用能量；攻擊支付候選與規則層共用中性費用判定，本機與線上均可點選 BS1-007 的 3 張支援卡；ST3-019 支援區棄牌改由玩家在既有提示框選卡，BS2-021 目標清單可換行捲動，BS2-044 攻擊可選效果與攻擊提示合併為單一流程；BS1-037 攻擊後效果沿用同一個提示框，沒有合法 LV.1 目標時由規則層自動略過，玩家也能手動略過；BS6-057 的綠色能量、自身送棄牌區與支援區 Cookie 回手三項代價會在抽牌前逐項呈現；`App.tsx` 協調邏輯已拆至多個自訂 hooks。
- **戰鬥區卡槽**：中央「戰鬥區」文字固定不位移；單張餅乾落在左槽，雙張餅乾以放大的左右間隔排開。HP 卡 dock 置於卡片下緣；能量不足與技能提示以所屬卡片外側的垂直中線排列，左卡向左、右卡向右，本機與線上對戰共用。
- **戰場視覺同步**：`/?mockup=battlefield` 直接重用正式戰場元件與桌面 `tactical-clean` 樣式；對手紅框、我方青框、深藍戰鬥區與次深藍支援區、支援張數與休息區等級文字均同步套用。平板橫向正式對戰與 mockup 共用 `src/styles/tablet-layout.css`，本機與 mockup 都已移除會穿過手牌的全畫面裝飾框；responsive gate 同時檢查手牌實際卡面，不只檢查手牌 dock 容器。
- **近期對戰桌版面**：桌機版雙方戰鬥、支援與休息區以等高鏡射排列；對手區域統一紅色邊框、我方區域統一藍色邊框，共享戰鬥區中央不再保留分隔線。`table-status-banner` 已移除，避免常駐提示遮蔽戰場；回合欄改為深藍底、金色外框。
- **線上對戰**：WebSocket server（Render 部署）+ 房間碼 + 玩家名稱 + 遮罩狀態；開局已整合至對戰桌，依序完成私密猜拳、勝者選先後攻、先攻再後攻調度、強制調度補償與起始餅乾同步揭示，並持續顯示雙方順位及目前行動者／階段。對局中提供即時對戰動態、昏厥／陷阱／FLIP／物品事件提示與可展開完整紀錄；手牌點擊外部可取消選取，公開資源可查看，對手攻擊選取會同步餅乾高光與付款支援卡橫置，自己的攻擊支付也會收到候選清單而正常點選支援卡。P0–P2 對戰可視化以 `ActionStatus` 統一提供玩家／階段／來源卡、等待原因、五步驟進度與伺服器期限；戰場不再常駐渲染中央 `RemoteActionBanner`，改以攻擊箭頭、公開來源卡預覽、回應狀態與可展開活動紀錄呈現必要資訊。上述功能共用伺服器權威 `PublicIntent`（序號／狀態版本／公開牌面過濾）與 `ActionStatus`，本機與線上維持相同顯示邏輯；BS1-037 無合法 LV.1 對手目標時不建立等待提示，已有提示可由玩家略過；本機雙瀏覽器自動驗證完整開局、階段同步、卡牌詳情、攻擊預覽、拒絕提示、斷線與連線失敗。
- **CI/CD**：GitHub Actions（卡牌／候選／registry 驗證 → app＋server typecheck → test → 零 warning lint → build → bundle budget；main push 另跑 AI／牌組編輯器／好友房瀏覽器 smoke）+ Vercel Git Integration 自動部署。

測試基線、bundle 大小等會隨每次 PR 變動的數字，一律以 [CHANGELOG.md](CHANGELOG.md) 最新項目為準（非永久門檻，只要求不低於前次基線）。

BS4 五色強化牌組已依 BS3 preset 建立 5 份可匯入 JSON，並提供 `benchmark:bs4-decks` 以固定種子、Lv.4、每色 30 場矩陣比較 BS3 基準與 BS4 版本；本輪另以 `BS4_GAMES_PER_PAIR=4` 完成 100 場固定 seed 重跑，結果寫入 `data/decks/bs4-benchmark-report-100-fixed.json`。此處的「環境強度」指本專案五色 AI 對戰環境；在專用條件情境與更完整對局樣本完成前，不將勝率排名視為正式環境強度結論。

## 下一步計畫

通用型 Lv.3／Lv.4 AI 已完成 G0～G5：Lv.3 會對規則層列舉的合法候選輸出 `ActionScoreBreakdown`；Lv.4 則以 width 5、depth 5、240 nodes、150ms 的有限 command search 維持 Setup→Payoff 計畫並預留攻擊資源。搜尋只使用 `PlayerView` 與合法 `KnowledgeState`，遇到未知抽牌、攻擊 pending、trap／blocker／FLIP／replacement 等決策即停止推演；timeout 一律回退 Lv.3。G5 已將合法的補位、付款、目標、順序、二選一、棄牌、陷阱、FLIP、阻擋、Refresh 與多階段 pending 決策接入 TacticalPlan，並輸出可稽核的 selection telemetry；Lv.1／Lv.2 行為不變。

卡牌行為契約目前先以 shadow mode 盤點正式卡池；最新稽核為 1101 筆公開記錄，1,076 筆 `verified`、25 筆保守標記 `needs-review`、0 筆 `blocked`，其中 `target evidence unresolved` 與 `source contains unclassified clause` 均已降至 0 筆。剩餘原因為 payment／runtime energy evidence、cost evidence、Then／timing／resolution order，均保留為 needs-review，未以 parser 忽略或虛構 runtime evidence 代替修正；後續依原因分群補齊。

本輪完成最後一筆 target evidence 修正：BS2-014 的「可選從 break 取回 LV.1 餅乾；若取回，再從手牌放 1 張餅乾進 break」已接入條件式 pending effect queue，並補上正／負向回歸。另修正 BS6-063 test-state 的精確支援區門檻，並讓 Browser audit 正確完成 choose-one Then 與隱藏 modal shell 收斂。最新 audit 為 1,076 筆 `verified`、25 筆 `needs-review`、0 筆 `blocked`，`target evidence unresolved=0` 且 `source contains unclassified clause=0`；offset 125、150、175 的 25 張 shadow migration 均回報 `selected=25、ready=true`，offset 150 Browser attestation 25／25 取得 effect trace（含 BS2-049／050 陷阱代價與 BS2-060 昏厥＋抽牌）。本輪完整 Vitest（206 檔、3,273 項）、lint、build、AI replay 20／20 與 Browser smoke（AI／牌組編輯器／好友房）均已通過；未轉為正式卡池資料。

契約遷移目前已完成 P1～P5 的可回退 shadow gate：`npm run cards:migrate:batch -- --limit 25`、`npm run cards:migrate:batch -- --offset 50 --limit 25`、`npm run cards:migrate:batch -- --offset 75 --limit 25`、`npm run cards:migrate:batch -- --offset 100 --limit 25`、`npm run cards:migrate:batch -- --offset 125 --limit 25`、`npm run cards:migrate:batch -- --offset 150 --limit 25` 與 `npm run cards:migrate:batch -- --offset 175 --limit 25` 均會在不寫入卡池的前提下選出 25 張 verified 卡並確認 runtime compile 可執行；批次綁定使用 `cardNumber`，可保留 `@1` 異圖變體。Browser 驗收可用 `npm run cards:attest:browser`，或以 `npm run cards:attest:browser -- --batch-report <migration-report.json>` 檢查批次 card-check route 與可取得的公開 command trace；offset 125／150 批次現已逐張取得效果 trace 或明確合法 no-op。這些批次仍未 promote 正式 runtime 卡池。

卡牌效果驗收維持三層：先以 `test-state` 建立可重現的公開局面並跑 `GameCommand`／規則層回歸，再以相同 `test-state` 走正式 UI 的 Browser positive／blocked trace，最後用至少一條正式牌組或根路徑 smoke 確認開局、隨機抽牌、隱藏資訊與補位整合。前兩層共享正式卡牌 adapter、規則引擎與 UI command path，因此修正共享規則會套用正式對戰；fixture 本身只改測試局面，不能取代正式整合驗證。

牌組編輯器的 LV／HP／攻擊力篩選、BS3-061／BS6-101 可選昏厥技能、BS5／BS6 尖括號攻擊後代價稽核、BS6-044 固定攻擊目標追傷、效果傷害 FLIP 結算、陷阱來源／代價與攻擊後效果詳細步驟對戰紀錄，以及 BS5-073、BS4-024 的本輪 UI／規則回歸已完成；後續若官方卡文、卡圖或目標限制規則更新，需同步重跑牌組編輯器、攻擊目標選擇、昏厥效果與對戰紀錄的正向／負向 Browser 路徑。

BS6 已完成候選卡牌逐色逐卡 Browser 稽核、`promotion-ready` 審查與正式 promote；五色標準牌組已完成資料、固定 seed 矩陣與正式根路徑多場 Browser 驗證，五色各 20/20、合計 100/100 且卡死 0。BS5+6 競技環境五色 AI choice 已接入，BS6-020 的陷阱自身目標選擇也已納入回歸基線；512 副牌組 Swiss 已成為新的 AI 回歸基準，後續以其上位卡表進行 matchup-aware 迭代，並持續以真人對戰與官方賽事資料校準。

BS5／BS6 五色逐卡 A/B 報告已納入回歸基線；本次以本機 in-app Browser Use 重跑 BS5 222／222、BS6 214／214 正向／負向路徑並全數通過。BS5-060 另以專用 localhost-only end-phase fixture 補驗「攻擊支付後支援卡休息 → 結束回合最多 3 張啟動」，避免一般 `card:` fixture 因支援卡全為啟動而產生假陰性。後續官方卡文、卡圖或規則更新時，需同步重跑正向／負向 Browser 路徑，並維持正式卡池與報告逐色無缺卡、無重複。

後續引用社群判例時，需在 inventory／coverage 文件記錄 URL、查閱日期與官方對應依據，並保留差異待確認。

目前先執行 [2026-08-08 穩定化計畫](docs/stabilization-plan-2026-08-08.md)，暫停新增 BS6+：本輪已完成 AI zero-stuck gate、CI server typecheck／零 lint warning、BS2 五色 81／81 Browser 歷史回歸、Chrome 手牌動作修正、Browser PR check／部署後 Browser 驗收流程、`main` 的 required checks 與 Vercel Preview bypass secret 設定；仍需真人 5 人 Playtest、`0.10.0` 發布基線決策、開發相依套件升級與 Bundle Gate V2。

後續持續以專用 A/B test-state 稽核「支付代價後來源離場」的卡牌，確認終局、補位、OnPlay 與原效果續接都遵守同一套 pending decision 優先順序。

持續以桌機、平板與手機 viewport 實測主選單的欄位比例、開發者工具收合與牌組統計可讀性；平板橫向戰場已正式套用 mockup 版面，後續維持 1164×777 與其他短高度桌面尺寸的可讀性回歸，並維持合法與不合法牌組錯誤提示的 DOM 狀態一致。

持續以正式卡池驗證 BS3 條件效果的成立／不成立 UI 路徑，優先維持規則層條件判定、合法目標候選與效果面板顯示的一致性。

BS4 已完成效果轉接覆蓋稽核、候選嚴格驗證與正式卡池 promote；牌組編輯器已新增 BS4 系列選單並與 BS3 分流，22 張條件卡的成立／不成立專用情境、24 張一般 fixture 的實際 UI 互動、固定 seed benchmark、111 張 Chrome 逐卡載入與平板 responsive geometry gate 均已完成。BS4-062 的付款／支援／目標複合流程已納入專用 Browser 回歸；後續維持同型卡牌在單機與好友房的候選分組一致。下一步可進入 BS5 資料準備期；BS4 勝率排名仍只作為觀察資料，不作為正式環境強度定案。

BS5 已完成資料準備期與本批次 promote：`cards:import:bs5-candidate` 仍依 `BS5-*` 卡號前綴保留官方來源與異圖／促銷變體，`cards:analyze:bs5-candidate` 目前讀取正式 `data/cards/` 產生效果覆蓋盤點；111 張基礎卡的主效果、能力與攻擊 `Then` 均已轉接。牌組賽制已區分為標準（套用禁限卡）與開放（所有正式卡牌都能用）；後續 BS5 官方更新仍須重新走候選匯入、逐色稽核、測試與 Chrome 驗證，再提升為 `promotion-ready` 後 promote。

BS5 的 Browser 稽核目前已完成五色標準正式牌組各 2 場、共 10 場端到端實戰（完整走過開局、支付／攻擊、陷阱／FLIP、昏厥補位、OnPlay 與勝負結算），並確認 console 無 error／warning；完整結果見 [BS5 五色正式 Browser 實戰矩陣](docs/bs5-browser-formal-matrix-2026-08-07.md)。每色 40 場與逐卡自然抽牌覆蓋仍是後續稽核項目，不能以這 10 場取代。

下一步補做每色 40 場正式 Browser 矩陣，並將每張 BS5 卡牌的自然抽牌技能、攻擊後 `Then`、陷阱、物品、場景與不成立條件納入逐卡證據；攻擊後「When your turn ends」卡牌須額外推進至結束階段確認實際狀態變化。

持續以瀏覽器透過正式卡池測試對局設定驗證 BS3 卡牌在卡牌詳情、效果面板與戰鬥互動中的技能、攻擊後、物品、陷阱、場景與資源區效果，並維持規則引擎與 UI 的責任分離。

優先以實際本機與好友房對局檢視新版桌面戰場在多張手牌、單／雙戰鬥餅乾、能量不足與技能提示同時出現時的可讀性，持續確保場區外框不會與手牌或操作提示重疊。

BS3 已建立候選卡表盤點與可重複匯入流程，並完成 `PURE` 通用分類／特殊費用／Mix Cost 相容性、`Ancient`／`Soul Jam` runtime 追蹤與 `BS3-121` 的主動特殊勝利判定。攻擊後 `Then`、額外能力來源轉接與靈魂果醬裝載家族已有 runtime；BS3-115 保護已依官方 Q&A 補齊 `attackTargetOnly` 例外、全場／棄置路徑排除，以及無合法目標時能力 Then 整段中止。`reveal-top-deck` 已從靜默執行改為兩階段流程（展示 → 確認 → 執行），巢狀效果含目標選擇時正確暫停於 `pendingAbilityEffect`，UI 與 AI 均可正常選取目標。BS3 已完成 promote；後續以正式卡池驗證、規則回歸與官方更新追蹤為主。

P-0XX 已完成原 26 張正式卡的 promote 與高風險效果回歸；官方全量盤點的其餘 127 筆（含異圖變體）已完成資料／adapter 轉換並停在候選區。P-082 主支付／替代支付、P-084 met／unmet 動態費用、P-147 Special Play＋On Play 已完成 runtime、UI 與專用 Browser 路徑；下一步是 127 筆候選的逐卡效果 Browser 稽核，完成後才正式牌池 promote，不把候選資料誤稱為已上線卡池。

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
npm run test:deck:browser    # 牌組編輯器匯入／儲存與 RWD smoke test
npm run test:blue:browser    # 藍牌效果使用/付款/目標/決策流程
npm run test:online:browser  # 線上對戰 modal 桌機／窄視窗驗證
npm run test:online:match:browser # 本機雙瀏覽器好友房猜拳、順位、依序調度、起始餅乾揭示、對戰動態、階段同步、拒絕提示、斷線與連線失敗驗證
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

## 變更記錄

目前發布版本 **`0.9.0`**（2026-07-16，git tag `0.9.0`）。完整變更記錄見 [CHANGELOG.md](CHANGELOG.md#090---2026-07-16)；發布與 PR 流程見 [docs/release-process.md](docs/release-process.md)。

| 日期 | 概要 |
| --- | --- |
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

牌組編輯器採 Master Duel 取向的 Braverse 全頁工作台：左側卡圖與數值摘要、中間依餅乾／FLIP／物品／陷阱／場景分區的主要牌組，以及右側卡池。合法性、賽制、卡池統計與 JSON 工具均收斂至頁首；卡池篩選預設收合，卡片能更早顯示。JSON 匯入使用輔助提示框，不影響工作台版面；額外牌組僅預留 BS8 區段，尚未改動主牌組規則或匯入格式。完整桌面、平板與窄版驗收詳見 [牌組編輯器設計驗收](docs/deck-editor-design-qa.md) 與 [設計 QA](design-qa.md)。

已重跑 `test:deck:browser` 與 `test:online:browser`：桌面 `1366×768`、窄版 `280×720` 均通過；窄版允許垂直滾動，但沒有水平溢出。牌組編輯器在手機與窄平板由頁面本身承接垂直捲動，可到達主要牌組加減按鈕與卡池；Browser gate 另涵蓋 `622×1040`、`390×844` 與 `280×720`。下一步為 P-0XX 正式牌池持續執行回歸與實戰驗證；官方新增卡牌仍先以候選資料流程隔離處理。
