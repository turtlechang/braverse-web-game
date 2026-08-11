# 薑餅人對戰卡牌 Braverse

以 React、TypeScript 與 Vite 建置的 CookieRun: Braverse 網頁遊戲原型。

> **非官方聲明**：本專案為 CookieRun: Braverse 的**非官方粉絲研究 / 學習型實作**，與 Devsisters Corporation 沒有任何合作、授權或背書關係。CookieRun: Braverse 及其卡牌、插畫、標誌之著作權與商標權均屬 Devsisters 及其授權方所有。本專案不商用、不收費；素材使用政策見 [docs/ip-and-asset-policy.md](docs/ip-and-asset-policy.md)。

## 開發背景

BS6 依照既有卡牌匯入工作流進入資料準備期：官方來源先保留在 `data/candidates/`，完成 adapter、效果覆蓋、規則回歸與 Browser 互動驗證後，才會進入 `promotion-ready` 並 promote 至正式卡池。

卡牌效果文字的官方標記與遊戲規則顯示共用 `CardEffectText`；圖片標籤資產集中於 `public/card-tags/`，保留文字回退與無障礙替代文字。

牌組賽制分為標準賽制與開放賽制：標準賽制套用台灣公告的禁卡／限卡表；開放賽制則允許正式卡池內所有卡牌使用。兩種賽制都仍遵守 60 張牌、同名卡最多 4 張、FLIP 最多 16 張，以及至少 1 張餅乾等基本牌組規則。

卡牌詳情中的場景效果沿用官方卡圖換行，將放置場景文字與 Activate 效果分列顯示。

桌面 `tactical-clean` 戰場以深藍桌墊與低對比菱格建立層次；對手場區採紅色、我方採青色完整圓角框，戰鬥區比支援區更深。休息區只保留加大的 `LV. x/10`，兩側功能欄分別依對手「棄牌 → 牌庫 → 場景」與我方「場景 → 牌庫 → 棄牌」排列，並與可見場區等高。全畫面裝飾框不延伸至手牌區，避免切過卡片與影響操作體感。

平板橫向（901–1280px 且高度不超過 840px）正式採用與戰場 mockup 相同的 `src/styles/tablet-layout.css`：1164×777 以支援區／戰鬥區 24／76 與 76／24 鏡射比例配置，手牌改為底部操作 dock，右上／左下雙方資訊牌在此尺寸隱藏，並為右側階段列與左右資源欄保留安全邊界。

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

技能代價若令戰鬥區清空，UI 會先提交規則層產生的終局或強制補位狀態：沒有可補位餅乾時立即顯示對局結果；可補位時暫停原效果，完成補位與 OnPlay 後才繼續結算，不會略過優先決策或把規則錯誤留在舊提示框。

昏厥效果遵守戰鬥區清空時的補位優先順序：先完成強制再登場及其 OnPlay，再處理昏厥技能；BS3-029 的黃色能量付款、手牌目標與 `+1 HP` 已接入離線、線上及 AI 決策流程。

對戰資訊可視化依 P0–P2 分層：P0 固定顯示行動玩家、階段、來源卡、攻擊箭頭與一致事件句型；P1 顯示宣告 → 費用 → 代價 → 目標 → 結算進度、對手卡牌預覽與陷阱／FLIP／攻擊效果回應狀態；P2 提供活動紀錄篩選、連線同步細節與伺服器提供的決策期限。戰場採扇形手牌與左右資源欄；對手手牌以貼齊頂緣的淺弧牌背呈現，我方手牌以低弧度展開，卡牌僅於 hover 或鍵盤 focus 時顯示左側快速預覽。所有線上公開提示都只使用伺服器過濾後的公開卡牌與 instance ID，不揭露對手手牌或牌庫內容。

專案開發流程已整理為 `.agents/skills/develop-braverse`、`.agents/skills/braverse-workflow` 與 `.agents/skills/braverse-card-import-audit` 三個 Skill，統一需求分析、規則查核、架構邊界、卡牌匯入、Chrome 逐色效果稽核、測試驗證、文件同步、派工與 Git 收尾步驟；`AGENTS.md` 保留硬性規範入口。子代理協作與停滯交接流程見 [docs/subagent-stall-handoff-protocol.md](docs/subagent-stall-handoff-protocol.md)。

CI/CD 採 GitHub Actions + Vercel Git Integration：GitHub Actions 執行卡牌驗證、app＋server typecheck、測試、零 warning lint、build 與 bundle gate；AI、牌組編輯器與好友房 Playwright 組成 `test:browser:smoke`，在 Browser 影響範圍的 PR、`main` push 與手動觸發時執行，並由固定名稱 `Browser Smoke PR Gate` 彙總結果。Vercel 監聽 PR 與 push 自動產生 Preview 與正式部署；`deployment_status` 成功後另以外部 URL 驗收首頁、SPA rewrite、牌池卡圖、合法牌組匯入、正式對戰入口與 Render WebSocket。Preview 若啟用 Vercel Authentication，需在 GitHub 設定 `VERCEL_AUTOMATION_BYPASS_SECRET`。

好友房 V1 不做自動重連；前端只保留單一有效 WebSocket，容許 Render 最長 90 秒冷啟動，連線後 10 秒內未收到伺服器回應或中途斷線時會明確結束並顯示錯誤，不讓畫面永久停在「連線中」。

好友房以玩家輸入的名稱識別雙方；攻擊宣告前的餅乾選取與支援卡付款預覽使用非權威暫態訊息同步，正式狀態仍只由伺服器的 `GameCommand` 結果更新。

好友房開局由伺服器協調私密猜拳、勝者選擇先後攻、依順位調度、強制調度補償與起始餅乾覆蓋；開局操作直接疊加在對戰桌上，雙方完成後才同步揭示起始餅乾並進入正式回合。

## 目前進度

BS6 候選資料目前包含 138 張卡牌（106 張基礎卡與 32 張異圖／變體）。主效果待轉接 0 張，攻擊後 `Then` 已完成 27／27；新增 BS6-034 HP 重排與 BS6-039 休息區連鎖的條件成立／不成立 test-state，並以 Browser 驗證支付、強制第一段、可略過第二段、HP 重排與條件不成立時不會卡死。BS6 仍未 promote，以上 Browser 證據僅代表本機候選測試流程。

2026-08-09 已修正 Deployment Browser Validation 的失敗遮蔽：trusted default branch 缺少驗收 harness 時會先明確報錯，artifact 目錄會預先建立且缺少檔案只警告；Preview 來自 PR 分支時安全略過自動驗收，改由 default branch 手動觸發，Production deployment status 則維持自動驗證；CI、Browser smoke 與部署驗收 workflow 同步升級至 Node 24 相容的 Actions major。

2026-08-08 穩定化批次已將 AI benchmark 從報表改為 CI 品質閘門，強制要求卡死、deadlock、非法操作與 turn cap 全為 0，且未達等級勝率門檻即失敗並輸出 `ReplayIssueBundle`。新閘門抓出並修正空戰鬥區仍有合法補位餅乾時錯誤列出「略過補位」的根因；另修正 Google Chrome 聚焦手牌動作時牌桌自動捲動、導致「登場」click 落空的 UI 問題。完整基線與未完成項目見 [穩定化對帳與執行計畫](docs/stabilization-plan-2026-08-08.md)。

BS2-015 已修正支付自身離場代價後按下「確認發動」看似無反應的問題；無可補位餅乾時會顯示敗北結果，有可補位餅乾時會先完成強制補位，再從目標選擇續接傷害與 `Then` 支援效果。`card:BS2-015` 及專用終局／補位 test-state 都維持合法正 HP。

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

BS3 全系列本輪完成 121 張基礎卡的瀏覽器載入掃描，並針對餅乾技能／FLIP、攻擊後效果、物品、陷阱、場景、Soul Jam、特殊勝利與 AI 對局補做代表性實戰驗證；修正 BS3-024、BS3-098、BS3-121 的可重現問題。BS3 共 176 筆資料（121 張基礎卡、55 個異圖／促銷變體）已於 2026-07-26 promote 至正式卡池。

BS4 系列已完成 111 張基礎卡的效果覆蓋稽核：攻擊 `Then` 23／23 已轉接，額外能力來源 87 張已轉接，原先 14 張待補效果已降為 0。170 筆資料（111 張基礎卡、59 個異圖／促銷變體）已於 2026-08-03 promote 至 `data/cards/`；HP 代價、BS4-001 自我昏厥、BS4-065／109 陷阱後半效果、BS4-008 FLIP 目標與 BS4-102 FLIP 選擇牌庫分支已補齊，完整狀態見 [BS4 效果轉接覆蓋盤點](docs/bs4-effect-coverage.md)。

BS4-089 月光餅乾的登場效果提示已明確區分「強制將對手牌庫頂 5 張牌放入棄牌區」與 Then 後續目標選擇，並顯示第幾段效果進度；完成後的對戰紀錄也會明確確認牌庫移牌已執行。

BS4-062「Wind Gems」已修正為「支付 2 點綠色能量 → 從支付後仍活躍的支援中額外橫置最多 4 張 → 選擇最多 1 個對手餅乾」三階段提示；額外橫置張數決定效果傷害，單機與線上共用分組上限。專用 Browser 路徑已驗證 8 張活躍支援時會留下 6 張候選，最後形成 6 張疲勞、2 張活躍並造成 4 點傷害。

BS4-106／107 的一般 `card:` test-state 已分別準備 10／15 張對手棄牌，能直接操作條件成立流程；`bs4-condition:*:unmet` 仍保留門檻不足分支。BS4-107 的後半段已依「最多 3 張」改為 0／1／2／3 張選擇，Chrome 已驗證最大 3 張與選 0 張都能完成且不會留下待處理效果。

BS4 後續規則回歸已完成 AI benchmark 的 RNG 傳遞修正：同一個 step seed 會流經技能、物品、場景與 Refresh；固定 seed 的 100 場矩陣重跑結果完全一致。另為 22 張條件卡建立 `met`／`unmet` 專用 test-state，共 44 條路徑通過；24 張一般 fixture 卡的效果面板、支付、代價、目標與可略過流程也以 Chrome 實際互動 24／24 通過。111 張 BS4 基礎卡以 Chrome card-check 逐卡載入 111／111 通過，並在 AI browser 的 1280×720、1024×576 等 viewport 通過 responsive geometry gate；BS4-052 end-phase 目標結算與 BS4-029 chained optional attack 的回歸問題已修正。完整結果見 [BS4 卡牌、RNG、responsive 與互動稽核報告](docs/bs4-browser-audit-report-2026-08-04-final.md)。

擊倒觸發的攻擊後技能（如 BS4-011 擊倒對手後抽 1 張並棄 1 張）已確認以「空場補位優先」結算：傷害結算後先完成戰鬥區再登場（空缺且無餅乾可補位時立即判負），補位完成後才執行技能佇列；離線、線上與 AI 決策流程共用同一判定，回歸測試涵蓋手牌為空時必棄唯一抽牌、以及無補位餅乾直接敗北兩條邊界路徑。

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
- **AI**：Lv.1–4 已完成（隨機／啟發式／評估式／兩層前瞻），只讀 `PlayerView` 保證資訊邊界；效果目標選擇涵蓋 split-damage（列舉四種配置取最優）、hp-to-trash/support、disable-flip/attack、battle-to-support、prevent-effect-damage（sourceOnly）等 7 類效果。等級 benchmark 已強制驗證零卡死／deadlock／非法操作／turn cap 與最低勝率，失敗會輸出可重播問題包；見 [docs/ai-levels.md](docs/ai-levels.md)。Lv.5 為設計稿。
- **卡牌池**：BS1/BS2 官方卡池、五色起始牌組、BS3 官方卡池與 P-0XX 特典卡均已匯入；BS3 的 176 筆資料（含 121 張基礎卡、異圖與促銷變體）及目前 26 張 P-0XX 已正式納入 `data/cards/`。另有官方 P-0XX 全量 153 筆資料（含異圖變體）已完成 adapter conversion，其中 127 筆仍在候選區等待 Browser 稽核與 promote；以 [P-0XX 匯入盤點](docs/p0xx-card-inventory.md) 與 [P-0XX 效果稽核](docs/p0xx-effect-coverage.md) 分開追蹤候選與正式狀態。靈魂果醬裝載與 BS3-115 保護（含攻擊附加例外、全場／棄置排除、無目標 Then 中止）已依官方 Q&A 落地。`npm run validate:cards` 接入 CI，除資料完整性外，也檢查 ability 非空、技能標記、可選抽牌、來源橫置及 8 張高風險卡的語意契約。
- **UI**：滿版桌墊 HUD、扇形手牌、統一效果 modal、響應式（最低支援 600×338）；桌面戰場（≥901px）採參考圖的中央戰場、左右資源欄、左側卡牌焦點預覽與右側回合欄排版，底色維持既有深藍／青色基調；1280×720 已修正手牌裁切、提高戰鬥區比例與資源標籤／中央狀態提示對比，並保留 hover 與鍵盤 focus 的卡牌快速預覽；主選單使用 CookieRun BRAVERSE 金色／棕色品牌文字排版；餅乾、物品、場景與陷阱的效果操作共用「能量 → 代價 → 目標」導引步驟，缺少的步驟自動略過，支援下一步／上一步並只在最後確認發動；能量支付候選依卡牌明確顏色限制，只有真正沒有顏色的 `MIX` 卡才視為萬用能量；攻擊支付候選與規則層共用中性費用判定，本機與線上均可點選 BS1-007 的 3 張支援卡；ST3-019 支援區棄牌改由玩家在既有提示框選卡，BS2-021 目標清單可換行捲動，BS2-044 攻擊可選效果與攻擊提示合併為單一流程；BS1-037 攻擊後效果沿用同一個提示框，沒有合法 LV.1 目標時由規則層自動略過，玩家也能手動略過；`App.tsx` 協調邏輯已拆至多個自訂 hooks。
- **戰鬥區卡槽**：中央「戰鬥區」文字固定不位移；單張餅乾落在左槽，雙張餅乾以放大的左右間隔排開。HP 卡 dock 置於卡片下緣；能量不足與技能提示以所屬卡片外側的垂直中線排列，左卡向左、右卡向右，本機與線上對戰共用。
- **戰場視覺同步**：`/?mockup=battlefield` 直接重用正式戰場元件與桌面 `tactical-clean` 樣式；對手紅框、我方青框、深藍戰鬥區與次深藍支援區、支援張數與休息區等級文字均同步套用。平板橫向正式對戰與 mockup 共用 `src/styles/tablet-layout.css`，本機與 mockup 都已移除會穿過手牌的全畫面裝飾框。
- **近期對戰桌版面**：桌機版雙方戰鬥、支援與休息區以等高鏡射排列；對手區域統一紅色邊框、我方區域統一藍色邊框，共享戰鬥區中央不再保留分隔線。`table-status-banner` 已移除，避免常駐提示遮蔽戰場；回合欄改為深藍底、金色外框。
- **線上對戰**：WebSocket server（Render 部署）+ 房間碼 + 玩家名稱 + 遮罩狀態；開局已整合至對戰桌，依序完成私密猜拳、勝者選先後攻、先攻再後攻調度、強制調度補償與起始餅乾同步揭示，並持續顯示雙方順位及目前行動者／階段。對局中提供即時對戰動態、昏厥／陷阱／FLIP／物品事件提示與可展開完整紀錄；手牌點擊外部可取消選取，公開資源可查看，對手攻擊選取會同步餅乾高光與付款支援卡橫置，自己的攻擊支付也會收到候選清單而正常點選支援卡。P0–P2 對戰可視化以 `ActionStatus` 統一提供玩家／階段／來源卡、等待原因、五步驟進度與伺服器期限；戰場不再常駐渲染中央 `RemoteActionBanner`，改以攻擊箭頭、公開來源卡預覽、回應狀態與可展開活動紀錄呈現必要資訊。上述功能共用伺服器權威 `PublicIntent`（序號／狀態版本／公開牌面過濾）與 `ActionStatus`，本機與線上維持相同顯示邏輯；BS1-037 無合法 LV.1 對手目標時不建立等待提示，已有提示可由玩家略過；本機雙瀏覽器自動驗證完整開局、階段同步、卡牌詳情、攻擊預覽、拒絕提示、斷線與連線失敗。
- **CI/CD**：GitHub Actions（卡牌／候選／registry 驗證 → app＋server typecheck → test → 零 warning lint → build → bundle budget；main push 另跑 AI／牌組編輯器／好友房瀏覽器 smoke）+ Vercel Git Integration 自動部署。

測試基線、bundle 大小等會隨每次 PR 變動的數字，一律以 [CHANGELOG.md](CHANGELOG.md) 最新項目為準（非永久門檻，只要求不低於前次基線）。

BS4 五色強化牌組已依 BS3 preset 建立 5 份可匯入 JSON，並提供 `benchmark:bs4-decks` 以固定種子、Lv.4、每色 30 場矩陣比較 BS3 基準與 BS4 版本；本輪另以 `BS4_GAMES_PER_PAIR=4` 完成 100 場固定 seed 重跑，結果寫入 `data/decks/bs4-benchmark-report-100-fixed.json`。此處的「環境強度」指本專案五色 AI 對戰環境；在專用條件情境與更完整對局樣本完成前，不將勝率排名視為正式環境強度結論。

## 下一步計畫

完成 BS6 候選卡牌逐色逐卡 Browser 稽核，補齊每張卡的條件成立／不成立、支付、代價、目標、Then、FLIP、陷阱、物品與場景流程證據；全部通過後再執行 `promotion-ready` 審查與 promote，不提前併入正式卡池。

目前先執行 [2026-08-08 穩定化計畫](docs/stabilization-plan-2026-08-08.md)，暫停新增 BS6+：本輪已完成 AI zero-stuck gate、CI server typecheck／零 lint warning、BS2 五色 81／81 Browser 歷史回歸、Chrome 手牌動作修正、Browser PR check／部署後 Browser 驗收流程、`main` 的 required checks 與 Vercel Preview bypass secret 設定；仍需真人 5 人 Playtest、`0.10.0` 發布基線決策、開發相依套件升級與 Bundle Gate V2。

後續持續以專用 A/B test-state 稽核「支付代價後來源離場」的卡牌，確認終局、補位、OnPlay 與原效果續接都遵守同一套 pending decision 優先順序。

持續以桌機、平板與手機 viewport 實測主選單的欄位比例、開發者工具收合與牌組統計可讀性；平板橫向戰場已正式套用 mockup 版面，後續維持 1164×777 與其他短高度桌面尺寸的可讀性回歸，並維持合法與不合法牌組錯誤提示的 DOM 狀態一致。

持續以正式卡池驗證 BS3 條件效果的成立／不成立 UI 路徑，優先維持規則層條件判定、合法目標候選與效果面板顯示的一致性。

BS4 已完成效果轉接覆蓋稽核、候選嚴格驗證與正式卡池 promote；牌組編輯器已新增 BS4 系列選單並與 BS3 分流，22 張條件卡的成立／不成立專用情境、24 張一般 fixture 的實際 UI 互動、固定 seed benchmark、111 張 Chrome 逐卡載入與平板 responsive geometry gate 均已完成。BS4-062 的付款／支援／目標複合流程已納入專用 Browser 回歸；後續維持同型卡牌在單機與好友房的候選分組一致。下一步可進入 BS5 資料準備期；BS4 勝率排名仍只作為觀察資料，不作為正式環境強度定案。

BS5 已完成資料準備期與本批次 promote：`cards:import:bs5-candidate` 仍依 `BS5-*` 卡號前綴保留官方來源與異圖／促銷變體，`cards:analyze:bs5-candidate` 目前讀取正式 `data/cards/` 產生效果覆蓋盤點；111 張基礎卡的主效果、能力與攻擊 `Then` 均已轉接。牌組賽制已區分為標準（套用禁限卡）與開放（所有正式卡牌都能用）；後續 BS5 官方更新仍須重新走候選匯入、逐色稽核、測試與 Chrome 驗證，再提升為 `promotion-ready` 後 promote。

BS5 的 Browser 稽核目前已完成五色標準正式牌組各 2 場、共 10 場端到端實戰（完整走過開局、支付／攻擊、陷阱／FLIP、昏厥補位、OnPlay 與勝負結算），並確認 console 無 error／warning；完整結果見 [BS5 五色正式 Browser 實戰矩陣](docs/bs5-browser-formal-matrix-2026-08-07.md)。每色 40 場與逐卡自然抽牌覆蓋仍是後續稽核項目，不能以這 10 場取代。

下一步補做每色 40 場正式 Browser 矩陣，並將每張 BS5 卡牌的自然抽牌技能、攻擊後 `Then`、陷阱、物品、場景與不成立條件納入逐卡證據。

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
npm run generate:card-pool
npm run check:card-pool
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
