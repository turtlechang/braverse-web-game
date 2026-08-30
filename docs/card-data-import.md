# 官方卡牌資料匯入

## 來源

- 官方卡牌頁：`https://cookierunbraverse.com/en/cardList`
- 官方 JSON：`https://cookierunbraverse.com/data/json/cardList_en.json`
- 匯入腳本以 `card_product_title` 篩選產品名稱；這對應專案討論中的 `category_title`。
- 圖片目前保留官方 HTTPS URL，不下載到 repository。

### 社群參考來源（非權威）

- [BraverseFan 中文圖鑑](https://braversefan.com/cookierun/)：可作為卡名、卡號、類型、顏色、稀有度、卡面翻譯與系列盤點的交叉參考。
- [BraverseFan 官方判例整理](https://braversefan.com/cookierun/faq/)：可用來尋找官方公告所整理的效果互動與 Q&A，尤其是 Then、FLIP、昏厥、HP 移動、效果傷害與結算順序案例。
- 該站為粉絲整理，頁面明確聲明翻譯與整理內容非官方；正式匯入仍以官方 JSON／卡面與官方規則、公告為準。社群資料不得直接覆寫 `data/cards/`，也不得單獨作為 promote 依據。
- 使用社群資料形成裁定或測試案例時，應在相關 inventory／coverage 文件記錄 URL、查閱日期與對應官方依據；若官方來源與社群整理不一致，保留差異並標記待確認。

## 指令

預設匯入英文版綠色起始牌組 `Starter Deck GREEN`：

```bash
npm run cards:import:sample
```

明確匯入紅色起始牌組：

```bash
npm run cards:import:red-sample
```

明確匯入黃色起始牌組：

```bash
npm run cards:import:yellow-sample
```

明確匯入綠色起始牌組：

```bash
npm run cards:import:green-sample
```

也可以直接指定參數：

```bash
node scripts/import-official-cards.mjs \
  --locale en \
  --category-title "Starter Deck GREEN" \
  --limit 100 \
  --output data/cards/official-starter-deck-green.en.json
```

目前樣本：

- `data/cards/official-sample.en.json`：`Starter Deck RED`，22 種卡號。
- `data/cards/official-starter-deck-yellow.en.json`：`Starter Deck YELLOW`，20 種卡號；官方清單未包含 `ST2-017`。
- `data/cards/official-starter-deck-green.en.json`：`Starter Deck GREEN`，22 種卡號。

## 候選卡牌安全匯入管線

新增候選卡牌資料時，使用隔離的匯入管線避免直接修改正式卡池：

```bash
# 1. 將候選 JSON 放入 data/candidates/ 目錄
# 2. 驗證候選資料
npm run validate:candidate

# 3. 驗證通過後 promote 到正式卡池
npm run promote:candidate
```

`promote:candidate` 預設會一併執行 `--strict-contracts`；只有需要處理歷史候選的
相容性診斷時，才可明確使用 `--allow-contract-gaps`，不得把它當成正式上線依據。

### 盤點中的候選資料

尚未具備 runtime 規則支援的新系列，先以 `inventory` 候選資料保存官方來源與卡表盤點。這類資料會通過結構驗證，但 `promote:candidate` 一律拒絕，避免尚未轉接的效果進入正式卡池。

BS3 使用卡號前綴而非產品標題篩選，以完整保留 `BS3-*` 異圖與促銷變體：

```bash
npm run cards:import:bs3-candidate
npm run cards:analyze:bs3-candidate
npm run validate:candidate
```

指令會更新：

- `data/candidates/official-age-of-heroes-and-kingdoms-bs3.en.json`
- `docs/bs3-card-inventory.md`
- `docs/bs3-effect-coverage.md`（只報告 runtime 轉接覆蓋，不表示可 promote）

BS5 同樣使用卡號前綴篩選，保留所有 `BS5-*` 異圖與促銷變體。本批次已完成正式 promote；後續官方更新仍先輸出為 `inventory` 候選資料：

```bash
npm run cards:import:bs5-candidate
npm run validate:candidate
```

指令會更新：

- `data/candidates/official-age-of-heroes-and-kingdoms-bs5.en.json`
- `docs/bs5-card-inventory.md`

BS5 已提供 `cards:analyze:bs5-candidate`；本批次 BS5-087／BS5-109 陷阱主效果與 10 張攻擊後 `Then` 已完成 adapter／規則引擎／UI 支援、測試與效果盤點，111 張基礎卡的主效果／能力／攻擊 `Then` 待轉接皆為 0。正式資料以 `data/cards/official-age-of-heroes-and-kingdoms-bs5.en.json` 為準；`docs/bs5-card-inventory.md` 是 promote 前的歷史盤點快照，`docs/bs5-effect-coverage.md` 追蹤目前正式卡池覆蓋狀態。

BS6 使用同樣的完整卡號前綴篩選與資料準備期隔離；本批 138 筆資料已完成 Browser 稽核並 promote，正式資料以 `data/cards/` 為準：

```bash
npm run cards:import:bs6-candidate
npm run cards:analyze:bs6-candidate
npm run validate:candidate
```

匯入指令會建立 `data/candidates/official-age-of-heroes-and-kingdoms-bs6.en.json` 與 `docs/bs6-card-inventory.md`，供官方更新重新進入候選流程；`cards:analyze:bs6-candidate` 會相容地轉呼叫正式卡池分析。已 promote 的 BS6 覆蓋盤點應以 `npm run cards:analyze:bs6` 從 `data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json` 重新產生。BS6 本批已完成逐色 runtime 轉接、回歸測試與 Browser 效果稽核；完整證據見 [BS6 Browser 稽核報告](bs6-browser-audit-2026-08-12.md)，後續更新仍須先維持 `inventory`，完成稽核後才可改為 `promotion-ready` 並 promote。

BS7「Arena of Glory」已完成本批正式 promotion。143 筆資料／108 個基礎卡號已完成逐卡 strict contract 與 Browser gate，正式來源為 `data/cards/official-arena-of-glory-bs7.en.json`。未來官方更新仍使用 `cards:import:bs7-candidate` 先寫入 candidate，完成 gate 後再 promote：

```bash
npm run cards:import:bs7-candidate
npm run validate:candidate
npm run cards:analyze:bs7
```

匯入指令會建立 `data/candidates/official-arena-of-glory-bs7.en.json` 與 `docs/bs7-card-inventory.md`，供官方更新重新進入候選流程；目前正式效果覆蓋報告由 `npm run cards:analyze:bs7` 從 `data/cards/official-arena-of-glory-bs7.en.json` 產生。未來候選仍須完成 strict contract、逐色正反 Browser gate、正式 smoke 與人工覆核，才可將 `candidateStatus` 改為 `promotion-ready` 並 promote。

BS8「Land of Fire & Ruin, Realm of Apathy」目前僅完成候選盤點，不可 promote：

```bash
npm run cards:import:bs8-candidate
npm run cards:analyze:bs8-candidate
npm run validate:candidate
```

匯入會建立 `data/candidates/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json`、`docs/bs8-card-inventory.md` 與 `docs/bs8-effect-coverage.md`。目前快照有 171 筆記錄／125 個基礎卡號，包含 15 筆 `EXTRA`；一般 `GameCard` adapter 仍刻意將 `extra` 視為 `unsupported-card-type`，避免混入主牌組。專用 `convertOfficialCardToExtraDeckCard` 已轉接五個基礎 EXTRA 卡號；BS8-005／069／090 有直接登場核心 TDD，且戰場提供持有者私密卡面與 localhost-only `met`／`unmet` Browser A/B；BS8-027／104 已依官方規則與 FAQ 實作 Awakened 覆蓋、`HP+2`、裝備／暫時效果與昏厥去向的純規則 TDD。尚無自訂牌組、BS8 AI 策略、雙瀏覽器線上與逐卡 Browser gate；即使 `validate:candidate` 通過也只代表來源與結構正確，不得改寫 `candidateStatus` 或執行 `promote:candidate`。

以下 serial gate 段落保留各卡在逐卡稽核當時的候選資料與 `inventory` 狀態；其中「候選仍為 `inventory`／不可 promote」是當時的歷史狀態，不代表目前。BS7 已於 2026-08-22 完成 promotion，現在以正式卡池為準。BS7 採單卡 serial gate，可用 `--card` 將 strict contract 限定在目前卡號（基礎卡號會一併涵蓋同卡異圖）：

```bash
npm run cards:audit:contracts -- --dir data/candidates --file official-arena-of-glory-bs7.en.json --card BS7-002 --strict
```

BS7 全批次已完成逐卡 runtime 與 Browser gate：`test:bs7:cards:browser` 為 143/143 卡面載入，`test:bs7:effects:browser` 為 98/98 正向效果流程，`test:bs7:effects:negative:browser` 為 143/143 負向 A/B；formal strict contract 為 143/143 verified。正向與負向 trace 分別保存在 `docs/bs7-effect-audit-2026-08-21.json` 與 `docs/bs7-effect-audit-2026-08-21-negative.json`。BS7-039／BS7-082 的對手全體傷害均使用 `sequential: true`，Browser 會依玩家點選順序逐張完成 HP、FLIP 與昏厥結算；這項 sequential 契約在 promote 後仍須維持。

第一張 BS7-001「Nutmeg Tiger Cookie」已完成候選 runtime 轉接與 localhost Browser A/B：`/?test-state=card:BS7-001` 提供自身 HP 支付與 LV.3 正向目標；`/?test-state=card-negative:BS7-001` 保留同一支付，但只提供 LV.2，確認該卡不會成為可選目標。這兩條 preview 直接由候選 JSON 經正式 adapter 建立狀態，沒有寫入 `generated-card-pool.ts` 或正式牌組。官方韓文卡表已用於交叉確認 BS7-001 的 `{da}` 傷害、時機、代價與目標文字；官方更新時仍須依同一 gate 重新稽核。

BS7-002「Red Osmanthus Cookie」已完成第二個 serial gate。官方韓文與英文的條件式 FLIP 皆轉接為一次性的 `gain-hp`：己方戰鬥區必須有紅色【Arena】Cookie，且附著本卡作為 HP 的受傷餅乾必須為 LV.2 以上。它不使用 `attachedHpBonus` 的持續加成；FLIP 結算層會以實際附著目標重跑 selector。`/?test-state=card:BS7-002` 的 Browser A 由 1/5 補至 2/5、牌庫 20→19；`/?test-state=card-negative:BS7-002` 保留紅色同伴但移除 Arena 關鍵字，發動後維持 1/5、牌庫 20。兩條路徑均無頁面錯誤，且單卡 strict contract 已 verified。候選仍為 `inventory`，不可 promote。

BS7-003「Raspberry Cookie」已完成第三個 serial gate。官方韓文／英文的 On Play 條件是「己方戰鬥區有另一張【Arena】Cookie」；runtime 使用 `battle-area-has-keyword` 並排除來源實體，再在本回合寫入對手 `blockDisabledUntilTurn`。`/?test-state=card:BS7-003` 部署後實際顯示「對手本回合不能發動 {bl}」並留下效果紀錄；`/?test-state=card-negative:BS7-003` 只移除同伴的 `Arena` 關鍵字，畫面顯示「效果尚未滿足發動條件」且只留下部署紀錄。兩條 Browser 路徑 Console error 均為 0，strict contract 已 verified。

BS7-004「Mala Sauce Cookie」已完成第四個 serial gate。generic parser 原本沒有保留「己方 Arena Cookie 本回合已造成效果傷害」條件，現改為 exact `damage` effect，沿用 `arena-cookie-dealt-effect-damage-this-turn` runtime flag、紅色能量支付與最多 1 張對手餅乾目標。`/?test-state=card:BS7-004` 實際支付 1 張紅色支援卡並使 `opp-lv1` 由 6/6 變 5/6；`/?test-state=card-negative:BS7-004` 清除回合旗標後不提供啟動按鈕，目標維持 6/6。兩條 Browser 路徑 Console error 均為 0，strict contract 已 verified。候選仍為 `inventory`，不可 promote。

BS7-006「Basil Pesto Cookie」已完成第五個 serial gate。官方 On Play 先支付「將自身 HP 頂端 1 張置入棄牌區」，再「最多抽 1 張」；runtime 以 `hpToTrash.sourceOnly` 保留來源限制，並以 `draw-up-to` 建立可選抽牌 pending。`/?test-state=card:BS7-006` 實際由 2/2 降至 1/2、牌庫 18→17，效果紀錄顯示「最多可抽 1 張牌」；`/?test-state=card-negative:BS7-006` 走「略過整個登場效果」，維持 2/2、牌庫 18，未建立抽牌效果。兩條 Browser 路徑 Console error 均為 0，strict contract 已 verified。候選仍為 `inventory`，不可 promote。

BS7-005「Marble Danish Cookie」已完成無效果卡 gate。候選 adapter 與 strict contract 均通過；正向 Browser 部署後確認卡面沒有技能操作，支付 3 張任意色支援卡攻擊 `opp-lv1`，對手 HP 6→3；負向路徑在不足攻擊費用時顯示「能量不足：需要 3，目前可用 0」，目標維持 6/6。兩條路徑 Console error 均為 0，候選仍為 `inventory`，不可 promote。

BS7-007「Street Urchin Cookie」已完成第六個效果 gate。runtime 保留 `side: either` 與 `keyword: arena`，並補上跨雙方逐 owner 的效果傷害結算；正向 Browser 在 modal 同時提供來源與對手【Arena】目標，選 `opp-lv1` 後 6/6→5/6；負向略過整個 On Play，目標維持 6/6。兩條 Browser 路徑 Console error 均為 0，strict contract 已 verified。候選仍為 `inventory`，不可 promote。

BS7-008「Earl Grey Cookie」已完成第七個效果 gate。官方文字的 `<...your 【Arena】 Cookie's HP...>` 由 `hpToTrash.keyword: arena` 限定支付來源，之後 `gain-hp` 讓己方至多 1 張 Cookie +1 HP；另補齊 contract parser 對「HP in your battle area」的辨識。正向 Browser 選 `self-extra-1` 作為 Arena HP 費用（4→3），再選 Earl Grey 自身由 3/3→4/3；負向略過整個 On Play，維持來源 3/3 與費用餅乾 4/4。兩條 Browser 路徑 Console error 均為 0，strict contract 已 verified。候選仍為 `inventory`，不可 promote。

BS7-009「Spicy Scovillia Student」已完成無效果卡 serial gate。候選 adapter 與 strict contract 均通過；正向 Browser 只顯示攻擊文字，部署後支付 2 張任意色支援卡攻擊 `opp-lv1`，對手 HP 6→4；負向部署後支援卡全疲勞，畫面顯示「能量不足：需要 2，目前可用 0」，沒有攻擊宣告，目標維持 6/6。兩條 Browser 路徑 Console error 均為 0，候選仍為 `inventory`，不可 promote。

BS7-010「Olive Cookie」已完成昏厥效果 serial gate。runtime exact effect 保留「己方戰鬥區有【Arena】Cookie」的 `battle-area-has-keyword` 條件，再選至多 1 張對手餅乾造成 1 點傷害；正向 Browser 的 pending faint modal 選 `opp-lv1` 後 6/6→5/6，負向移除 `self-extra-1` 的 Arena 關鍵字後即使選同一目標也維持 6/6。兩條 Browser 路徑 Console error 均為 0，strict contract 已 verified；覆蓋盤點降為 47 張主效果／能力待轉接（BS7-010 原本已有 generic effect 形狀，這次補的是條件語意），候選仍為 `inventory`，不可 promote。

BS7-011「Yoga Cookie」已完成 FLIP serial gate。runtime exact effect 以 `all-of` 同時保留「手牌 5 張以下」與「己方有紅色【Arena】Cookie」兩個條件，成立後最多抽 2 張；正向 Browser 發動後牌庫 20→18、手牌 4→6，負向移除同伴的 Arena 關鍵字後牌庫維持 20 且不抽牌。兩條 Browser 路徑 Console error 均為 0，strict contract 已 verified；覆蓋盤點降為 46 張主效果／能力待轉接，候選仍為 `inventory`，不可 promote。

BS7-012「Sachertorte Cookie」已完成 Activate serial gate。runtime exact effect 以 `hpToTrash.keyword: arena` 限定 HP 代價，並用 `costSelected: true` 將 +1 攻擊傷害鎖定在剛支付 HP 的同一張餅乾；正向 Browser 選 `self-extra-1` 作為 Arena HP 費用（4→3），再只提供同一張餅乾作為目標，顯示基礎攻擊力 1、目前 2。負向移除所有 Arena 關鍵字後沒有合法 HP 代價／啟動按鈕，來源與目標維持原值；同時補上 UI 在付款前不應以空 `costRecord` 錯誤拒絕 `costSelected` 目標的回歸測試。兩條 Browser 路徑 Console error 均為 0，strict contract 已 verified；覆蓋盤點降為 45 張主效果／能力待轉接，候選仍為 `inventory`，不可 promote。

BS7-013「Chili Pepper Cookie」已完成被動光環 serial gate。runtime 新增 `modify-all-effect-damage`，只在本卡仍位於戰鬥區、且效果傷害來源是己方紅色 LV.2 以上【Arena】餅乾時加 1 點；效果傷害結算與攻擊後／技能傷害共用同一 helper，不寫入過期的攻擊修正。正向 Browser 以 fixture 的 LV.2 紅色 Arena 效果傷害餅乾造成 1→2 點效果傷害，對手 6→4；負向移除傷害來源的 Arena 關鍵字後為 1 點，對手 6→5。兩條 Browser 路徑 Console error 均為 0，strict contract（含同卡變體）已 verified；覆蓋盤點降為 44 張主效果／能力待轉接，候選仍為 `inventory`，不可 promote。

BS7-014「Capsaicin Cookie」已完成靜態條件與 Activate serial gate。runtime 將「己方有 Kouign-Amann Cookie 或 Prune Juice Cookie 時自身 +1 攻擊」放入 `CardSkill.passiveEffects`，與「棄 1 張手牌、選對手 LV.2 以上餅乾造成 1 傷害」的 Activate effects 分離；正向 Browser 顯示基礎攻擊 3、目前 4，支付棄牌後對手 LV.3 由 5/8→4/8；負向移除指定卡名後攻擊維持 3，但 Activate 仍可支付並造成 1 傷害。兩條 Browser 路徑無 error，strict contract（含同卡變體）已 verified；候選仍為 `inventory`，不可 promote。

BS7-015「Crushed Pepper Cookie」已完成攻擊後條件 serial gate。runtime exact `damage` effect 鎖定本次被攻擊餅乾，只有己方另有【Arena】Cookie（`excludeSource: true`）時追加 2 傷害；正向 Browser 的 `opp-lv1` 由 6/6→4/6，負向移除同伴 Arena 關鍵字後效果自動略過並維持 6/6。兩條 Browser 路徑無 error，strict contract 已 verified；攻擊後覆蓋盤點為 1／23，候選仍為 `inventory`，不可 promote。

BS7-016「Cream Unicorn Cookie」已完成 On Play serial gate。runtime exact `draw-up-to` 以 `arena-cookie-dealt-effect-damage-this-turn` 回合旗標限制效果；正向 Browser 實際部署後顯示「最多抽 1 張牌」，牌庫由 15→14 並抽入 1 張，負向清除旗標後部署仍可完成但登場效果自動略過、牌庫維持 15。兩條 Browser 路徑無 error，strict contract 已 verified；覆蓋盤點降為 43 張主效果／能力待轉接，候選仍為 `inventory`，不可 promote。

BS7-017「Tarte Tatin Cookie」已完成低 HP Arena 條件的 On Play serial gate。候選英文快照的攻擊欄位缺少閉合 `>` 與 `{da}` 標記，`official-card-adapter` 在資料邊界明確 normalize 為可解析的 `{R}{N}`／傷害 1，並以 exact `draw-up-to-then-discard` 保留「己方剩餘 HP ≤2 的 Arena Cookie」條件。正向 Browser 以 `self-extra-1` 的 2/4 狀態抽 2 張（牌庫 20→16→14）後再棄 1 張；負向移除 Arena 關鍵字後登場效果自動略過、牌庫維持 16。兩條 Browser 路徑無 error，strict contract（含同卡變體）已 verified；候選仍為 `inventory`，不可 promote。

BS7-018「Jalapeño Cookie」已完成攻擊後目標傷害 serial gate。runtime exact `damage` 保留「己方戰鬥區有另一張【Arena】Cookie」條件與 `excludeSource`，成立時可選至多 1 張對手餅乾追加 1 傷害。`/?test-state=card:BS7-018` 的 Browser 正向選 `opp-lv1` 由 6/6→5/6；`/?test-state=card-negative:BS7-018` 移除同伴關鍵字後不建立效果視窗、維持 6/6。兩條 Browser 路徑無 error，strict contract（含同卡變體）已 verified；攻擊後覆蓋盤點為 2／23，候選仍為 `inventory`，不可 promote。

BS7-019「Rye Cookie」已完成可選紅色能量攻擊後 serial gate。runtime exact `optional-cost-attack` 要求支付 1 點紅色能量，並在另有 Arena Cookie 時把 `damage` 鎖定本次攻擊目標；正向 Browser 先選 `support-pay-0` 支付，再選 `opp-lv1` 使 6/6→5/6；負向移除 Arena 關鍵字後不提供支付／追加傷害、維持 6/6。兩條 Browser 路徑無 error，strict contract（含同卡變體）已 verified；攻擊後覆蓋盤點為 3／23，候選仍為 `inventory`，不可 promote。

BS7-020「Scovilsky Manuscript」已完成休息區等級差 serial gate。runtime exact `damage` 保留「己方 break area 等級至少高對手 2 級」條件，並鎖定對手 LV.1 Cookie、最多 1 張；正向 Browser 支付紅色能量後選 `opp-lv1`，對手 6/6→3/6 並將物品置入棄牌區；負向讓雙方休息區等級差不足，不提供「使用」入口，目標維持 6/6。兩條 Browser 路徑無 error，strict contract 已 verified，候選仍為 `inventory`，不可 promote。

BS7-021「Labyrinth Golem Attack」已完成 Arena 陷阱 serial gate。runtime exact `trap` 以紅色＋任意色支付，保留己方有【Arena】Cookie 的條件，先選至多 1 張對手餅乾套用本回合 -2 攻擊傷害，再以 `thenEffects` 對同一目標造成 1 點傷害；官方「can be used as {R}{R}」另以 `sourceEnergy` 證據保留，不誤當成陷阱啟動代價。正向 Browser 支付兩張支援卡後重用同一 `trap-attacker` 目標，畫面顯示 1 點傷害且攻擊力 6→4；負向移除 Arena 關鍵字後不建立陷阱回應，目標維持 5/5。兩條 Browser 路徑無 error，strict contract 已 verified，候選仍為 `inventory`，不可 promote。

BS7-022「Scovillia Quarters」已完成場景 serial gate。runtime exact `stage` 保留放置紅色能量、Activate 紅色能量與來源橫置，並以 `arena-cookie-dealt-effect-damage-this-turn` 旗標限制本回合對手目標 1 傷害。正向 Browser 先放置場景，再支付 Activate 費用並選 `opp-lv1`，對手 6/6→5/6；負向清除效果傷害旗標後只可放置、沒有啟動入口，目標維持 6/6。兩條 Browser 路徑無 error，strict contract 已 verified，候選仍為 `inventory`，不可 promote。

BS7-023「Honorable Paladin Trainee」已完成無效果卡 serial gate。候選資料經正式 adapter 轉成 LV.2／HP.3／攻擊 2、黃色＋任意色 2 費用的【Arena】餅乾，沒有 skill／FLIP／攻擊後效果；`convertOfficialCardEffects` 明確回傳 `no-effect-text`，不把空技能當成可發動能力。正向 Browser 部署後支付 1 張黃色與 1 張任意色支援卡攻擊 `opp-lv1`，對手 6/6→4/6；負向部署後支援卡全疲勞，顯示「能量不足：需要 2，目前可用 0」，沒有攻擊宣告，目標維持 6/6。兩條路徑 Console error 均為 0，strict contract 已 verified，候選仍為 `inventory`，不可 promote。

BS7-024「Ice Juggler Cookie」已完成攻擊後 HP 回手代價 serial gate。runtime exact `optional-cost-attack` 將「從己方【Arena】Cookie 的 HP 頂牌返回手牌」建模為 `hpToHand`（1 張、`keyword: arena`），支付後把傷害鎖定本次攻擊目標。正向 Browser 選 `self-extra-1` 的 HP 頂牌（4/4→3/4）返回手牌，再選 `opp-lv1` 追加 1 傷害（6/6→5/6）；負向同時移除來源與同伴的 Arena 關鍵字，支付按鈕因沒有合法候選而停用，略過後維持目標 6/6 與同伴 4/4。兩條路徑 Console error 均為 0，strict contract 已 verified；攻擊後覆蓋盤點為 4／23，候選仍為 `inventory`，不可 promote。

BS7-025「Golden Osmanthus Cookie」已完成黃色 Arena 條件 FLIP serial gate。runtime exact FLIP 以 `battle-area-has-color` 限定己方戰鬥區存在黃色【Arena】Cookie，並要求附著餅乾 LV.2 以上時一次性 `gain-hp` +1，不誤用持續 `attachedHpBonus`。正向 Browser 發動 FLIP 後 `flip-defender` 由 1/5→2/5；負向移除黃色同伴的 Arena 關鍵字後仍完成翻牌但不增加 HP、維持 1/5。兩條路徑 Console error 均為 0，strict contract 已 verified；主效果覆蓋盤點降為 41 張待轉接，候選仍為 `inventory`，不可 promote。

BS7-026「Twisted Donut Cookie」已完成攻擊後自身離場／Arena HP serial gate。runtime exact `optional-cost-attack` 先以 `selfToBreakArea` 將來源餅乾與其 HP 放入休息區／棄牌區，再選至多 1 張其他【Arena】Cookie `gain-hp` +1；UI 代價文案明示「將此餅乾放入休息區」。正向 Browser 支付後來源進入休息區、`self-extra-1` 由 2/4→3/4（牌庫補入 1 張 HP）；負向移除同伴 Arena 關鍵字後不建立攻擊後視窗，來源仍在戰鬥區且目標維持 2/4。兩條路徑 Console error 均為 0，strict contract 已 verified；攻擊後覆蓋盤點為 5／23，候選仍為 `inventory`，不可 promote。

BS7-027「Lemon Cookie」已完成黃色 Activate／Arena 休息區事件 serial gate。runtime exact `modify-attack` 保留「本回合己方 Arena 餅乾已進入休息區」旗標條件，選至多 1 張己方 Cookie 使本回合攻擊傷害 +2；正向 Browser 顯示 `self-extra-1` 基礎 1、目前 3，負向清除事件旗標與休息區 Arena 實體後沒有啟動入口。兩條路徑 Console error 均為 0，strict contract 已 verified；候選仍為 `inventory`，不可 promote。

BS7-028「Lemon Zest Cookie」已完成無能量 Activate 抽牌 serial gate。runtime exact `draw-up-to` 受同一 Arena 休息區事件旗標限制；正向 Browser 發動後牌庫 20→19，負向清除旗標後沒有啟動入口。兩條路徑 Console error 均為 0，strict contract 已 verified；候選仍為 `inventory`，不可 promote。

BS7-029「Madeleine Cookie」已完成黃色 Activate／事件條件傷害 serial gate。runtime exact `damage` 在事件成立時選對手至多 1 張餅乾造成 2 傷害；正向 Browser `opp-lv1` 6/6→4/6，負向事件旗標清除後沒有啟動入口。兩條路徑 Console error 均為 0，strict contract（含同卡記錄）已 verified；候選仍為 `inventory`，不可 promote。

BS7-030「Rainbow Sherbet Cookie」已完成黃色 Arena 雙條件 FLIP serial gate。runtime exact FLIP 同時要求手牌至多 5 張與己方戰鬥區黃色【Arena】Cookie，正向 Browser 牌庫 20→18；負向移除黃色 Arena 關鍵字後仍完成翻牌但不抽牌、牌庫維持 20。兩條路徑 Console error 均為 0，strict contract 已 verified；候選仍為 `inventory`，不可 promote。

BS7-031「Vanilla Sugar Cookie」已完成黃色能量／棄 1 張手牌的 On Play serial gate。runtime exact `gain-hp` 限定己方戰鬥區【Arena】Cookie；正向 Browser 支付黃色能量、棄 `hand-filler-0` 後 `self-extra-1` 4/4→5/4，負向支援卡疲勞而阻擋支付。兩條路徑 Console error 均為 0，strict contract 已 verified；候選仍為 `inventory`，不可 promote。

BS7-032「Onyx Cream Cookie」已完成事件條件設為活躍 serial gate。runtime exact `set-cookie-active` 鎖定來源 Cookie；正向 Browser 來源原先橫置，發動後紀錄「Onyx Cream Cookie 已設為活躍」，負向清除事件旗標後沒有啟動入口。兩條路徑 Console error 均為 0，strict contract 已 verified；候選仍為 `inventory`，不可 promote。

BS7-001～BS7-108 已完成逐卡 runtime 轉接與 strict contract。BS7-033～BS7-043 涵蓋黃色移動、無技能餅乾、休息區／場景條件、攻擊後傷害與陷阱；BS7-044～BS7-065 涵蓋綠色支援區登場、Arena 支援費用、FLIP HP、牌庫檢視與 Trap Then；BS7-066～BS7-087 涵蓋藍色 Arena 棄牌、攻擊後目標傷害、手牌門檻、牌庫底與無技能餅乾；BS7-088～BS7-108 涵蓋紫色棄牌區門檻、隨機棄牌、檢視／抽牌／棄牌、HP／攻擊修正、場景與多段 Trap。

全體傷害的順序是獨立驗收門檻：BS7-039「Financier Cookie」與 BS7-082「Red Pepper Cookie」的 `damage-all` 均帶有 `sequential: true` 及 `target: { side: 'opponent', min: 1, max: 2 }`。Browser A 會依玩家點選順序逐張處理對手 Cookie 的 HP、FLIP 與昏厥，再移往下一個目標；Browser B 在條件不成立時不建立全體傷害視窗。BS7-082 已實際驗證「棄 2 張後按自訂順序各 1 傷害」與「只棄 1 張則不造成全體傷害」。

本批另完成非餅乾 Then 的正式 runtime 路徑：BS7-041／063／105 的物品／場景多段效果，以及 BS7-021／042／064／085／106／108 的 Trap Then；其中 BS7-064 的支援區棄牌→回收、BS7-085 的條件抽牌、BS7-106 的 Arena 棄牌→回手與 BS7-108 的兩段攻擊修正均已建立正反 Browser fixture。`trash-to-hand` 已接入共用目標候選，避免 Trap 後半段靜默略過。

目前正式卡池為 143 筆記錄／108 個基礎卡號／35 個異圖或變體，來源為 `data/cards/official-arena-of-glory-bs7.en.json`；candidate 檔案已移出，正式來源的 `candidateStatus` 為 `promotion-ready`。BS7 formal strict contract 為 143／143 `verified`，整體 formal validate 為 1,244／1,244，registry consistent；效果覆蓋為主效果待轉接 0、額外能力待轉接 0、攻擊 Then 23／23。既有 Browser 證據為 143/143 卡面載入、98/98 正向效果、143/143 負向 A/B；BS7-039／BS7-082 的 sequential 契約保持不變。

未來官方更新仍須先以 `inventory` candidate 隔離，完成每張卡的 runtime 轉接、測試與人工覆核，確認效果覆蓋盤點沒有待裁決或未支援的規則文字後，才可將來源欄位的 `candidateStatus` 改為 `promotion-ready`，再執行嚴格候選驗證與 promote。

### 流程說明

1. **隔離**：候選 JSON 放入 `data/candidates/` 目錄，不影響 `data/cards/`
2. **驗證**：`validate:candidate` 檢查：
   - 頂層 `schemaVersion`（必須為 number）與 `source`（必須為物件，含 `provider`/`pageUrl`/`locale`）
   - `cards` 為物件陣列
   - 必填欄位存在且型別正確（`cardNumber`/`baseCardNumber`/`name`/`locale`/`imageUrl` 為 string、`sourceId` 為 number、`type` 為合法值）
   - 子物件結構檢查（`flags`/`restrictions`/`product` 含必要 boolean/number 欄位）
   - 同一檔案內不得有重複 cardNumber
   - 不得與現有正式卡池卡號重複
   - `promotion-ready` 候選的每張可玩卡牌必須能轉換為 GameCard，且有效果文字時必須轉出對應效果
   - 可用 `npm run validate:candidate -- --strict-contracts` 額外執行卡牌行為契約 gate；支付、代價、目標或 Then 證據不足時拒絕進入 promote
   - `inventory` 候選僅驗證來源、schema、卡號與欄位結構；它們仍明確禁止 promote
3. **Promote**：`promote:candidate`：
   - 先檢查檔名碰撞（不得與既有 `data/cards/` 檔案同名）
   - 通過後執行驗證（fail-fast）
   - 全部檢查通過後，依序複製到 `data/cards/`
   - 複製成功後重新生成 `src/game/generated-card-pool.ts`
   - 最後從 `data/candidates/` 移除已 promote 的檔案

### 安全保證

- 檔名碰撞時拒絕全部，不修改任何檔案
- 驗證失敗時不執行任何寫入
- 複製階段若任一失敗則 rollback（刪除已複製的檔案、還原卡池 registry），候選全數保留
- 只在複製全部成功 + registry 重新生成後才刪除候選檔案

### 卡池 registry

正式卡池透過 `scripts/generate-card-pool.ts` 產生 `src/game/generated-card-pool.ts`，`promote:candidate` 會自動重新生成。若需手動重新生成：

```bash
npm run generate:card-pool
```

CI 會執行 `npm run check:card-pool`，只讀檢查 `data/cards/*.json` 與 generated registry 是否一致；若手動修改正式卡牌資料後忘記重新生成，CI 會拒絕提交。

### 正式卡池語意驗證

`npm run validate:cards` 會對正式卡池執行下列檢查：

1. 每張啟用中的可玩卡必須能轉換為 `GameCard`。
2. 有技能、FLIP、物品、陷阱或場景文字時，對應 ability 必須包含至少 1 個可執行效果，不能只有空殼物件。
3. `{mob}`／`{ap}`／`{t1}`／`{mt}`、`You can draw` 與來源橫置文字必須轉為對應 runtime 語意。
4. ST2-018、ST5-007、ST5-022、BS2-056、BS2-058、BS2-077、BS2-079、BS2-080 另以人工覆核的高風險契約鎖定複合效果、特殊代價、條件與可選性。

高風險契約只防止已確認語意退化；官方文字或規則更新時，仍須依卡牌更新流程人工覆核並補完整流程測試。

## 欄位轉換

匯入資料需符合 `data/schemas/official-card-import.schema.json`。

| Runtime 欄位 | 官方欄位 | 說明 |
| --- | --- | --- |
| `sourceId` | `card_idx` | 官方資料 ID |
| `cardNumber` | `card_no` | 完整卡號，可能含 `@1` 異圖版本 |
| `baseCardNumber` | `card_no` | 移除 `@` 後的基礎卡號 |
| `variant` | `card_no` | `@` 後的異圖編號，沒有時為 `null` |
| `type` | `card_type` | `COOKIE`、`ITEM`、`TRAP`、`STAGE`、`FLIP`、`EXTRA` |
| `level`, `hp` | `card_level`, `card_hp` | 非餅乾卡可能為 `null` |
| `imageUrl` | `card_image` | 官方圖片 URL |
| `skill` | `card_skill_name`, `card_skill_text` | 官方技能文字 |
| `attackText` | `card_attack_text` | 攻擊與道具／陷阱使用文字 |
| `flipText` | `card_flip` | FLIP 效果文字 |
| `product.title` | `card_product_title` | 產品名稱，用於篩選起始牌組 |

## 文字與效果轉換

`src/cards/official-text-parser.ts` 解析官方標記：

- `{R}`、`{Y}`、`{G}`、`{B}`、`{P}`、`{K}`：指定顏色能量。
- `{N}`：任意能量。
- `{mob}`：Activate。
- `{ap}`：OnPlay。
- `{t1}`：每回合一次。
- `{mt}`：你的回合。

`src/cards/official-card-adapter.ts` 會將官方卡牌轉成 `GameCard`：

- `COOKIE` 與 `FLIP` 轉成 runtime `cookie`，並以 `officialType` 保留來源卡種。
- `FLIP` 的能力只從 `flipText`（官方 `card_flip`）建立。
- `TRAP` 的能力只從 `attackText`（官方 `card_attack_text`）建立。
- `ITEM`、`TRAP`、`STAGE` 轉成對應非餅乾卡。
- `EXTRA` 與資料不完整的餅乾卡會回傳 `unsupported`。
- runtime `id` 使用 `baseCardNumber`，保留異圖與圖片 URL 在轉換結果 metadata。

`src/cards/official-effect-adapter.ts` 目前支援直接傷害、攻擊傷害增減、全體攻擊修正、受到攻擊傷害減免、目標篩選、break area 等級條件、disable-flip、view-hp、reorder-hp、battle-to-support、trash-to-battle、support-to-hand，以及跨區的兩段式休息區移動等物品/場景效果。無法安全轉換的效果會標記為 `unsupported`，避免把尚未確認的規則誤實作成權威邏輯。
