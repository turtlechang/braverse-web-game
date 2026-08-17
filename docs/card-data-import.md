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

完成每張卡的 runtime 轉接、測試與人工覆核後，確認效果覆蓋盤點沒有待裁決或未支援的規則文字，才可將來源欄位的 `candidateStatus` 改為 `promotion-ready`，再執行嚴格候選驗證與 promote。

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
