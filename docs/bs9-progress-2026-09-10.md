# BS9 候選匯入與逐卡驗收

## 範圍與目前結果

使用者授權：官方資料與卡圖確認、候選匯入、新機制／轉接缺口盤點，以及逐卡支付、目標、Browser 正／負驗收。不含 promote、commit、push。

2026-09-10 從官方英文 JSON 實際取得 185 筆，基礎卡號連續 BS9-001～118；保留全五色、異圖與促銷記錄。來源欄位與既有官方 normalizer 相容；維持 inventory 隔離。

- [逐筆原文與卡圖來源](bs9-card-inventory.md)
- [逐筆 strict／parser 缺口](bs9-effect-coverage.md)
- [候選資料](../data/candidates/official-a-game-of-truth-and-deceit-bs9.en.json)
- 官方勘誤：[BS9-070](https://cookierunbraverse.com/asia/notice/detail?id=1199)，支援數量條件為己方小於或等於對方。此次英文 JSON 已包含修正文句；不改寫原始資料。

靜態盤點（重新執行 adapter 後）：118 張基礎卡中，主效果 24 已轉接、44 無主效果文字、50 待轉接。一般卡攻擊 Then 0/16；EXTRA 的 Then 必須獨立驗收，不包含在這個分母。185 筆 strict 為 67 verified、118 needs-review。以上皆非卡圖或完整對戰通過數。

## 新機制與高風險待查項

下列依官方文字做盤點，除首張圖片外尚未逐圖核對，不能視為已確認規則或完整缺口清單。

| 卡號 | 機制／待查事項 |
| --- | --- |
| 001 | 本回合指定己方餅乾受到的效果傷害減 2；現有 prevent-effect-damage 是完全防止，modify-all-effect-damage 是造成傷害光環，不能直接替代 |
| 002／010／011 | 上個對手回合／本回合昏厥事件，需按己方、紅色、LV.1 與數量計數 |
| 010 | 對手手牌／HP 卡面朝上成為來源 HP：選擇權、所有權、公開資訊與離場去向需依官方規則確認 |
| 030 | 丟棄指定 FLIP 餅乾作 EXTRA 登場代價；攻擊後丟棄 FLIP 並啟動該效果 |
| 035 | 禁止對手透過效果增加 HP，與一般登場 HP 分開 |
| 050／055／061／063／070 | 本回合支援區到棄牌區累計事件；不能只以現在支援數量推定 |
| 083／088 | 戰鬥區到牌庫頂／底事件，以及 Awaken 的不同門檻 |
| 088／094 | 翻開牌庫頂依卡種／顏色／LV 分支，包含公開資訊與 Refresh 邊界 |
| 102 | 雙方棄牌區門檻、對手自主棄牌；五張 EXTRA 均須新轉接與獨立 Then 案例 |

## 首張 cursor：BS9-001（候選局部通過）

先目視 BS9-001@1 英文實圖；基本版與 @2 尚未目視，不宣稱等價。

- 圖片：https://cookierunbraverse.com/data/en_storage/G2fck1k1zK2Vi2PeQy2GWA.webp
- 本機證據：test-results/bs9-source/BS9-001-at1.webp
- SHA-256：E2D118A76608F6A15474E592969795F5B8AC27C8B4888503E1C68AEF373F52A5
- 目視日期／覆核者：2026-09-10／Codex。
- 卡面：Icicle Yeti Cookie，紅色，LV.2，HP 3，C，BS9-001；攻擊 Pointy Icicle，RR，2 傷害。沒有主動技能。
- FLIP 轉錄：Select up to 1 of your Cookies. During this turn, that Cookie receives -2 effect damage.
- 獨立預期：FLIP 時可選己方 0～1 隻；此 FLIP 沒有印刷能量支付或額外代價；選定者本回合每次受到效果傷害減 2，不改攻擊傷害、不影響未選目標，下回合到期。
- 案例：效果傷害 1／2／3 對應 0／0／1；選 0 不加狀態；不能選對手／超選；一般攻擊不减傷；回合到期不减傷；普通攻擊 RR 付款正向及錯色／疲勞負向另外驗證。
- 目前 strict：BS9-001、BS9-001@1、BS9-001@2 均為 `verified`；三筆共用同一個 `modify-damage-received` runtime effect，仍需各異圖卡面目視覆核。
- 規則／單元：5 項 BS9-001 回歸通過，涵蓋 0～1 目標、效果傷害 1／2／3 邊界、攻擊不減傷、回合到期與 localhost route 隔離。
- Browser：4／4 通過（1907×863、1164×777；正向選 1 目標／發動，負向選擇不發動；公開 trace 均有 `resolve-flip`，無頁面錯誤）。此為候選 `test-state` 局部驗證，不等同正式牌組、多人或線上逐卡通過。
- 候選仍維持 inventory／needs-review：基本版與 `@2` 卡圖尚未目視，未 promote。

## 已完成的本輪最小實作

1. 新增 BS9 專用 development-only candidate preview loader／route，僅載入 BS9-001 三筆記錄；正式 registry、Standard／Open 卡池和線上房間均不載入此候選。
2. 新增 `damageReceivedModifiers` 與 effect／attack 分流的傷害計算；BS9-001 FLIP 可選己方 0～1 隻，指定者本回合效果傷害最多減 2，回合結束自動清除。
3. 完成 adapter／strict contract、5 項規則回歸與桌機／平板 Browser 正／負驗收；Browser 腳本為 `npm run test:bs9-001:browser`，報告寫入忽略的 `test-results/bs9-001-browser.json`。

## 可審閱的下一批實作方案

BS9-001 的最小核心已完成；後續仍須依卡圖與官方規則逐卡擴充，不能把本輪局部證據當成整套 BS9 ready。依使用者 AGENTS 的架構變更確認門檻，下一批維持以下邊界：

1. 核對 BS9-001 基本版與 `@2` 實圖，補同卡異圖 Browser／卡面證據與普通攻擊 RR 正向、錯色／疲勞負向路徑。
2. 同卡全部閘門與必要回歸通過後才到 BS9-002。其餘高風險核心擴充依實際卡圖與官方規則另確認範圍。

本輪責任範圍已交付：candidate preview 模組及測試、App 的明確開發入口、src/game/types.ts、傷害／效果／到期模組、official-effect-adapter、contract evidence、Browser 腳本與本報告；保留工作樹既有未提交修改。

## 本輪驗證

- importer regression：Vitest 1 檔／3 項通過，exit 0。
- cards:analyze:bs9-candidate：exit 0，產生兩份逐卡盤點。
- validate:candidate：exit 0，1 檔／185 筆、成功轉換 0；inventory 僅來源／結構驗證，禁止 promote。
- BS9-001 規則／adapter：Vitest 1 檔／5 項通過，exit 0。
- Browser：`npm run test:bs9-001:browser` 4／4 通過，涵蓋 1907×863／1164×777 正向與負向路徑，exit 0。
- 完整 Vitest：295 檔／4,551 項通過，exit 0。
- build：exit 0；保留既有 chunk size 警告。
- 新增 BS9 腳本／規則相關檔案的 scoped ESLint：exit 0；`git diff --check`：exit 0。
- 全域 lint：exit 1，只有工作樹既有 `.tmp-probe-deploy.ts` 1 項與 `scripts/diagnose-lv5-conservatism.ts` 2 項 unused；未修改這些無關檔案。
- 全域 lint：exit 1，既有 .tmp-probe-deploy.ts 一項、scripts/diagnose-lv5-conservatism.ts 兩項 unused 錯誤；未修改這些檔案。
- 環境：Windows PowerShell、Node 22.22.3；HEAD 419dd5f8e399c5ad2e1d0a36d728284e5fa61888，工作樹包含既有 App／adapter／UI 等未提交修改；本輪不 commit、不 push、不 promote。
