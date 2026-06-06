# 官方卡牌資料匯入

## 已確認資料來源

- 卡表頁面：<https://cookierunbraverse.com/en/cardList>
- 公開資料端點：<https://cookierunbraverse.com/data/json/cardList_en.json>
- 端點回傳 `productCategoryList`、`filterList`、`cardList` 三個頂層欄位。
- 2026-06-06 查證時，`cardList` 有 1,992 筆資料。
- `card_image` 是官方網站上的完整 HTTPS 圖片 URL。

搜尋引擎可能顯示較舊的卡牌筆數，匯入結果應以執行當下官方 JSON 為準。

## 執行方式

預設匯入英文版 `Starter Deck RED`：

```bash
npm run cards:import:sample
```

等同於：

```bash
node scripts/import-official-cards.mjs \
  --locale en \
  --category-title "Starter Deck RED" \
  --limit 100 \
  --output data/cards/official-sample.en.json
```

官方 `cardList` 使用 `card_product_title`，其值對應產品分類清單的
`category_title`。目前 `Starter Deck RED` 共匯入 22 張不同卡號。

`--limit` 限制為 1 到 100，篩選會先於數量上限執行。匯入器只請求
一份官方 JSON，並不下載任何卡牌圖片。

## 資料格式

輸出以 `data/schemas/official-card-import.schema.json` 為準。主要映射如下：

| 專案欄位 | 官方欄位 | 說明 |
| --- | --- | --- |
| `sourceId` | `card_idx` | 官網內部資料 ID |
| `cardNumber` | `card_no` | 完整卡號，包含 `@1` 等異圖標記 |
| `baseCardNumber` | `card_no` | 移除 `@` 後的基礎卡號 |
| `variant` | `card_no` | `@` 後的異圖版本；一般版本為 `null` |
| `type` | `card_type` | 正規化為小寫 |
| `level`, `hp` | `card_level`, `card_hp` | 轉為數字或 `null` |
| `imageUrl` | `card_image` | 只保存 URL，不下載圖片 |
| `skill` | `card_skill_name`, `card_skill_text` | 保留官方效果文字 |
| `attackText` | `card_attack_text` | 保留尚未解析的攻擊文字 |
| `flipText` | `card_flip` | 保留 FLIP 效果文字 |

匯入器不改寫攻擊文字內的 `{R}`、`{N}`、`{da}` 等標記；這些內容由下方的文字解析層處理。

## 文字解析與遊戲轉換

`src/cards/official-text-parser.ts` 目前會解析：

- `{R}`、`{Y}`、`{G}`、`{B}`、`{P}`、`{K}`：各色能源費用
- `{N}`：任意／中性費用
- `{da} 數字`：攻擊傷害
- 其他標記會保留在 `markers` 或 `unknownTokens`，不推測效果規則

`src/cards/official-card-adapter.ts` 負責轉為目前遊戲引擎的 `GameCard`：

- `COOKIE` 與具餅乾數值的 `FLIP` 轉為 `CookieCard`
- `ITEM`、`TRAP`、`STAGE` 轉為非餅乾卡
- `EXTRA`、未知類型或缺少必要數值的卡回傳 `unsupported`
- runtime `id` 使用 `baseCardNumber`，異圖卡號與圖片 URL 保留在來源 metadata

轉換層只處理可確定的基本數值，不會把尚未支援的官方效果文字假裝成可執行效果。

## Starter Deck RED 效果轉換

`src/cards/official-effect-adapter.ts` 將可確認的英文效果文字轉成
`CardEffect`。目前 22 張範例中有 12 張可轉換，支援：

- 指定自己或對手戰場上的餅乾
- 「最多 N 張」與固定數量目標
- 排除效果來源、剩餘 HP、最低等級等目標條件
- 直接傷害
- 本回合或對手下回合的攻擊傷害增減
- Break Area 最低等級的發動條件

抽牌、HP 增加、被動攻擊加成，以及棄牌、休息等發動成本尚未進入
執行器，會明確回傳 `unsupported`。

## 使用與版權

- 匯入資料保留來源 URL、抓取時間與官方更新時間。
- 卡牌圖片由 CookieRun / Devsisters 等權利人持有。
- 此階段只保存圖片 URL，不將圖片檔提交到 repository。
- 未取得授權前，不應把大量官方圖片重新散布或用於商業服務。
- 匯入器應維持低頻、手動執行，不繞過登入、權限或存取限制。
