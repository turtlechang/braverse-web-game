# BS9 候選匯入與逐卡驗收

## 範圍與目前結果

使用者授權：官方資料與卡圖確認、候選匯入、新機制／轉接缺口盤點，以及逐卡支付、目標、Browser 正／負驗收。不含 promote、commit、push。

2026-09-10 從官方英文 JSON 實際取得 185 筆，基礎卡號連續 BS9-001～118；保留全五色、異圖與促銷記錄。來源欄位與既有官方 normalizer 相容；維持 inventory 隔離。

- [逐筆原文與卡圖來源](bs9-card-inventory.md)
- [逐筆 strict／parser 缺口](bs9-effect-coverage.md)
- [候選資料](../data/candidates/official-a-game-of-truth-and-deceit-bs9.en.json)
- 官方勘誤：[BS9-070](https://cookierunbraverse.com/asia/notice/detail?id=1199)，支援數量條件為己方小於或等於對方。此次英文 JSON 已包含修正文句；不改寫原始資料。

靜態盤點（重新執行 adapter 後）：118 張基礎卡中，主效果 31 已轉接、44 無主效果文字、43 待轉接。一般卡攻擊 Then 2/16；EXTRA 的 Then 必須獨立驗收，不包含在這個分母。185 筆 strict 為 82 verified、103 needs-review。以上皆非卡圖或完整對戰通過數。

## 第一批 BS9-001～009（候選局部通過）

本批已核對官方卡圖與英文卡文：BS9-001（含 `@2`）、BS9-002／`@1`、BS9-003／`@1`、BS9-005／`@1`、BS9-006／`@1`、BS9-007／`@1`、BS9-008、BS9-009；BS9-004／`@1` 為無技能登場卡。逐卡原文、異圖與圖片網址仍以 [BS9 卡表盤點](bs9-card-inventory.md) 為準。

- BS9-001：FLIP 選己方 0～1 隻，本回合減少效果傷害；BS9-002：對手上一回合己方紅色 LV.1 昏厥條件成立時，來源卡本回合攻擊傷害 +1；BS9-003：On Play 選己方至多 1 隻，本回合攻擊傷害 +1。
- BS9-004／BS9-008：無技能餅乾只走正式登場與 HP 配置；BS9-005：FLIP 棄 1 張手牌，附著餅乾 +1 HP；BS9-007：FLIP 抽最多 1 張牌。
- BS9-006：本回合己方至少 2 隻餅乾昏厥後，來源卡本回合受到的攻擊／效果傷害均 -3，最低為 0；BS9-009：本回合對手餅乾昏厥後，On Play 抽最多 1 張牌。
- 規則／adapter／UI 回歸涵蓋條件時間窗、顏色／等級、來源限定、全傷害通道、零傷害下限、FLIP 棄牌／增 HP、抽牌上限與回合到期；新增 BS9 專用測試檔及效果／命令紀錄文案測試。
- Browser：`test:bs9-001:browser` 4／4，加上 `test:bs9-002-009:browser` 32／32，合計 36／36；每張均在 1907×863 與 1164×777 執行正向及負向／略過路徑，並檢查公開 `GameCommand` trace 與頁面錯誤。這些是 localhost `test-state` 候選證據，不等同正式牌組、多人或線上逐卡驗收。
- 另以 Chrome localhost 續接驗證 BS9-006 的實際傷害：`?test-state=bs9-damage:BS9-006` 先由正式 `deploy-cookie`／`activate-skill` 建立 -3，再由同一 turn number 的真實 BS8-002 宣告攻擊並自動結算，對戰紀錄明確顯示「Cilantro Cobra Swordsman」攻擊「Melted Choco Cookie」，HP 維持 2／2；`?test-state=bs9-damage-negative:BS9-006@1` 相同攻擊下 HP 為 1／2。兩條 Chrome 路徑無 console error。原本 `card:` 路徑讓 AI 到下一回合才攻擊，`this-turn` 修正已正常到期，因此不能作為 -3 的實際傷害證據。
- 候選仍維持 inventory 隔離，未載入正式 registry、Standard／Open 卡池，也未 promote。

## 第二批 BS9-010～023（候選局部通過）

本輪依官方英文卡文建立第二批 candidate fixture，補上 EXTRA、昏厥時間窗、HP 搬移、Ancient／同名條件、Your Turn 防護、Item／Trap／Stage 的支付與 Then 續接。`src/game/bs9-010-023.test.ts` 的 8 項規則／adapter／localhost route 回歸通過；`npm run test:bs9-010-023:browser` 在 1164×777 完成 14 張卡的正向／負向共 28／28 路徑，沒有頁面錯誤。BS9-001～023 的正／負 card-check fixture 牌區、HP、手牌、支援、棄牌與 EXTRA 卡均取自官方 BS8／BS9／Starter 記錄，並由實體卡牌回歸測試檢查卡號格式與佔位符遺漏。Browser 報告只涵蓋實際互動的 BS9-010／011／019／020／022／023；其餘卡號為候選真卡面掛載與正／負 fixture smoke，不能解讀成完整效果對局。

| 卡號 | 本輪候選證據 |
| --- | --- |
| BS9-010 | EXTRA 條件正／負入口、OnPlay 對手手牌轉 HP；規則回歸另覆蓋攻擊後可選能量與 HP 搬移。 |
| BS9-011 | OnPlay 紅色 LV.1 昏厥數量條件；Browser 正向造成 1 傷害、負向顯示條件未滿足並自動略過。 |
| BS9-012～013 | 對手回合結束自傷條件與無技能 Cookie 登場；Browser 正／負 fixture smoke。 |
| BS9-014～018 | HP 代價／搬移、昏厥 Then、同名／Ancient 選擇與 Your Turn 傷害防止；規則回歸涵蓋正／負，Browser 正／負 fixture smoke。 |
| BS9-019～020 | Item 紅色能量支付；BS9-019 目標加攻後加 HP，BS9-020 抽最多 2 張再棄 1 張；Browser 正向完成面板操作，負向不提供「使用」。 |
| BS9-021～022 | Trap 紅色能量、對手 HP 搬移及攻擊 -1／抽最多 1 張條件；規則與 Browser 正／負路徑通過。 |
| BS9-023 | Stage 放置／啟動各付 1 紅色能量、橫置來源與最多 2 個己方目標；Browser 正／負路徑通過。 |

另以 Chrome 直接開啟 localhost `127.0.0.1:5173` 走過 BS9-011 正／負路徑：正向選擇對手 Melon Bun Cookie 後效果紀錄顯示「受到 1 傷害」；負向登場後顯示「效果尚未滿足發動條件」。這是開發用候選狀態與代表性 UI 證據，不是正式牌組或線上房間驗收。

## 第三批 BS9-024～029（候選局部通過）

本輪先核對 BS9-024～029 官方卡圖與英文卡文，再以正式 BS8／BS9／Starter 實體卡牌建立候選 fixture。BS9-024 的 Activate 條件為來源剩餘 HP 不超過 4 且己方另有 Ancient；攻擊後 Then 可選擇將來源最上方 1 張 HP 卡回手，支付後對手受到 1 點傷害。BS9-025 的 FLIP 同時涉及棄牌、附著餅乾與自己的回合／另一張餅乾條件，受益者與目標邊界仍缺官方裁決，因此只保留卡面詳情與 fail-closed smoke，不植入猜測性 runtime 效果。BS9-026 為 FLIP 抽最多 1 張；BS9-027 為啟動時可將最多 1 張手牌置於來源最上方 HP，Then 來源受到 1 點傷害；BS9-028 無主效果；BS9-029 為 FLIP 時在兩張己方餅乾間移動最多 1 張最上方 HP，UI 以有序 donor／receiver 配對選擇呈現。

- 規則／adapter／UI 回歸涵蓋 BS9-024 技能條件與攻擊後 HP 代價、BS9-026 抽牌／略過、BS9-027 手牌置 HP 後傷害順序、BS9-029 0 或 2 張有序目標及重複／單張／同一張阻擋；BS9-025 維持官方裁決前的明確 fail-closed。
- Browser：`test:bs9-024-029:browser` 在 1907×863 與 1164×777 共 28／28 通過，包含 BS9-024 技能／攻擊正負、BS9-025 詳情正負、BS9-026 FLIP 抽牌／略過、BS9-027 有手牌／零手牌、BS9-028 登場 smoke，以及 BS9-029 有序配對／略過；所有路徑均無頁面錯誤並檢查公開 `GameCommand` trace。
- BS9-025 明確標記為 review-only：沒有可宣稱的 runtime FLIP 受益者或目標轉接；其正／負 Browser 案例只證明卡面可載入且未知效果會安全封鎖，不代表規則完成。
- 候選仍維持 inventory 隔離，未載入正式 registry、Standard／Open 卡池，也未 promote。

## 第四批 BS9-030（候選局部通過）

本輪核對官方 BS9-030「Shadow Milk Cookie」實卡與英文卡文（黃色、LV.3、HP 6、EXTRA；普通攻擊支付 3 點黃色能量、造成 3 點傷害）。卡面包含兩段不同時機：EXTRA 登場前必須從手牌棄置 3 張具有 FLIP 的黃色 Cookie；登場後可將棄牌區最多 1 張 LV.1 Cookie 放入棄牌區；攻擊 Then 則可再棄置 1 張手牌中的 FLIP Cookie，並立即發動該張卡的 FLIP。

- 獨立預期：EXTRA 代價必須使用合格的黃色 FLIP Cookie，支付完成後才將 Shadow Milk 實體化並進入 On Play；攻擊支付沿用一般黃色能量規則；攻擊 Then 的 FLIP 代價與發動者是同一位玩家，不能把來源 Shadow Milk 當成被棄置的 FLIP 卡，也不能重複移動已進棄牌區的卡。被棄置的 BS9-026「Burnt Cheese Cookie」FLIP 抽牌完成後，原攻擊後效果鏈才收尾。
- 規則／adapter／文案回歸：`src/game/bs9-024-029.test.ts` 8 項通過，新增 BS9-030 EXTRA 代價、On Play、真實攻擊、攻擊後 detached FLIP、抽牌 0 張收尾，以及不足 3 張合格 FLIP 的負向案例；公開 command trace 同時確認 EXTRA 登場、代價、On Play、攻擊、攻擊後代價、FLIP 與抽牌事件。
- Browser：`npm run test:bs9-030:browser` 在 1907×863 與 1164×777 共 4／4 通過。正向路徑使用 4 張真實黃色 FLIP Cookie，保留 1 張 BS9-026 作攻擊後代價，完成 EXTRA 登場、On Play、攻擊 3 黃色能量、棄置 BS9-026、發動其 FLIP 並選擇抽 0；負向路徑只有 2 張合格手牌，EXTRA 入口顯示「目前無法登場」且沒有送出登場命令。兩種尺寸均無頁面錯誤，並保存實際卡圖 URL 與命名 fallback 的截圖／公開 trace 報告於 `output/playwright/bs9-030-browser.json`。
- 公開 trace 的 detached FLIP／抽牌事件歸屬於 BS9-030 的同一攻擊因果鏈；一般 HP 翻牌仍保留翻出卡片的來源歸屬。候選資料仍維持 inventory 隔離，未載入正式 registry、Standard／Open 卡池，也未 promote。

## 新機制與高風險待查項

下列依官方文字做盤點；第一批 BS9-001～009、第三批 BS9-024～029 與第四批 BS9-030 的卡圖已另行核對，第二批及其餘卡號仍不能視為已完成逐圖語意確認或完整缺口清單。

| 卡號 | 機制／待查事項 |
| --- | --- |
| 001 | 本回合指定己方餅乾受到的效果傷害減 2；現有 prevent-effect-damage 是完全防止，modify-all-effect-damage 是造成傷害光環，不能直接替代 |
| 010／011 | 上個對手回合／本回合昏厥事件，需按己方、紅色、LV.1 與數量計數；BS9-002／006／009 的第一批條件窗口已完成獨立實作與 A/B |
| 010 | 對手手牌／HP 卡面朝上成為來源 HP：選擇權、所有權、公開資訊與離場去向需依官方規則確認 |
| 030 | 已完成候選 EXTRA 登場／黃色 FLIP 代價、On Play、攻擊 Then detached FLIP 與抽牌收尾；正式牌組／多人／線上仍待 |
| 035 | 禁止對手透過效果增加 HP，與一般登場 HP 分開 |
| 050／055／061／063／070 | 本回合支援區到棄牌區累計事件；不能只以現在支援數量推定 |
| 083／088 | 戰鬥區到牌庫頂／底事件，以及 Awaken 的不同門檻 |
| 088／094 | 翻開牌庫頂依卡種／顏色／LV 分支，包含公開資訊與 Refresh 邊界 |
| 102 | 雙方棄牌區門檻、對手自主棄牌；五張 EXTRA 均須新轉接與獨立 Then 案例 |

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
3. 完成 BS9-002／003／006／009、BS9-011／012／014／015／016／017／018／019／020 的 exact adapter，並補 BS9-010 EXTRA、BS9-021／022 Trap、BS9-023 Stage、BS9-024／027 技能／攻擊後、BS9-026 FLIP、BS9-029 有序雙目標，以及 BS9-030 EXTRA 登場／攻擊後 detached FLIP 的成本、條件與 Then 續接；BS9-004／008／013／028 保留無技能正式登場流程，BS9-025 依官方裁決前 fail-closed。
4. 新增 BS9 第一至四批規則／adapter／文案回歸與候選 Browser 正／負驗收；腳本為 `npm run test:bs9-001:browser`、`npm run test:bs9-002-009:browser`、`npm run test:bs9-010-023:browser`、`npm run test:bs9-024-029:browser`、`npm run test:bs9-030:browser`，報告寫入忽略的 `test-results/` 與 `output/playwright/`。

## 後續驗收範圍

BS9-001～030 已有候選局部證據；後續仍須依卡圖與官方規則逐卡擴充，不能把本批局部證據當成整套 BS9 ready。依使用者 AGENTS 的架構變更確認門檻，下一步維持以下邊界：

1. 補 BS9-001 `@2` 與本批異圖的獨立 Browser／正式牌組／線上證據，以及普通攻擊能量正向、錯色／疲勞負向路徑；目前 Browser 只覆蓋本批代表路由與指定負向變體。
2. 進入 BS9-031 起的下一張卡，先核對卡圖、支付、目標、時機與 Then 順序，再逐卡建立正／負 fixture；BS9-025 仍需先取得官方受益者／目標裁決。不把 strict 靜態 verified 或本批候選 Browser 通過當成可 promote。

本輪責任範圍已交付：candidate preview 模組及測試、App 的明確開發入口、src/game/types.ts、傷害／效果／到期模組、official-effect-adapter、contract evidence、Browser 腳本與本報告；保留工作樹既有未提交修改。

## 本輪驗證

- importer regression：Vitest 1 檔／3 項通過，exit 0。
- cards:analyze:bs9-candidate：exit 0，185 筆／118 個基礎卡號，主效果 31 supported、44 no-effect、43 待轉接，攻擊 Then 2／16，strict 82 verified／103 needs-review。
- validate:candidate：exit 0，1 檔／185 筆、成功轉換 0；inventory 僅來源／結構驗證，禁止 promote。
- check:card-pool：exit 0，正式 registry 與 `data/cards/*.json` 一致；`data/cards/` 無 BS9 記錄，候選維持隔離。
- BS9-001 規則／adapter：Vitest 1 檔／5 項通過，exit 0；BS9-002～009 規則／adapter／文案回歸與既有受影響測試一併通過。
- Browser：`npm run test:bs9-001:browser` 4／4、`npm run test:bs9-002-009:browser` 32／32 通過，涵蓋 1907×863／1164×777 正向與負向／略過路徑，exit 0。
- BS9-010～023：`src/game/bs9-010-023.test.ts` 8 項通過；`npm run test:bs9-010-023:browser` 28／28（1164×777）通過，exit 0。代表性 Chrome localhost BS9-011 正／負路徑亦完成；此批仍是 candidate／test-state 局部證據。
- BS9-024～029：`src/game/bs9-024-029.test.ts` 與 `GameModals` pair UI 回歸通過；`npm run test:bs9-024-029:browser` 28／28（1907×863／1164×777）通過，exit 0。BS9-025 僅 review-only 詳情／fail-closed，未宣稱效果完成。
- BS9-030：`src/game/bs9-024-029.test.ts` 8 項通過；`npm run test:bs9-030:browser` 4／4（1907×863／1164×777）通過，exit 0。正向完成真實 EXTRA 代價、On Play、3 黃色能量攻擊、攻擊後 detached BS9-026 FLIP 與抽牌 0；負向以 2 張合格 FLIP Cookie 阻擋 EXTRA 入口。此批仍是 candidate／test-state 局部證據。
- 完整 Vitest：298 檔／4,579 項通過，exit 0。
- build：exit 0；保留既有 chunk size 警告。
- 新增 BS9 腳本／規則相關檔案的 scoped ESLint：exit 0；`git diff --check`：exit 0。
- 全域 lint：exit 1，工作樹既有未追蹤 `.tmp-bs9-030-ui9.mjs` 有 1 項 parsing error，另有 `.tmp-probe-deploy.ts` 1 項與 `scripts/diagnose-lv5-conservatism.ts` 2 項 unused；本輪未修改這些無關檔案。
- 環境：Windows PowerShell、Node 22.22.3；HEAD 419dd5f8e399c5ad2e1d0a36d728284e5fa61888，工作樹包含既有 App／adapter／UI 等未提交修改；本輪不 commit、不 push、不 promote。
