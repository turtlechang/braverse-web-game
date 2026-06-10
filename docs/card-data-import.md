# 官方卡牌資料匯入

## 來源

- 官方卡牌頁：`https://cookierunbraverse.com/en/cardList`
- 官方 JSON：`https://cookierunbraverse.com/data/json/cardList_en.json`
- 匯入腳本以 `card_product_title` 篩選產品名稱；這對應專案討論中的 `category_title`。
- 圖片目前保留官方 HTTPS URL，不下載到 repository。

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

`src/cards/official-effect-adapter.ts` 目前支援直接傷害、攻擊傷害增減、全體攻擊修正、受到攻擊傷害減免、目標篩選、break area 等級條件、disable-flip、view-hp、battle-to-support、trash-to-battle、support-to-hand 等物品/場景效果。無法安全轉換的效果會標記為 `unsupported`，避免把尚未確認的規則誤實作成權威邏輯。
