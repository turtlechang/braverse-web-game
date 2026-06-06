# 官方卡牌資料匯入

## 已確認資料來源

- 卡表頁面：<https://cookierunbraverse.com/en/cardList>
- 公開資料端點：<https://cookierunbraverse.com/data/json/cardList_en.json>
- 端點回傳 `productCategoryList`、`filterList`、`cardList` 三個頂層欄位。
- 2026-06-06 查證時，`cardList` 有 1,992 筆資料。
- `card_image` 是官方網站上的完整 HTTPS 圖片 URL。

搜尋引擎可能顯示較舊的卡牌筆數，匯入結果應以執行當下官方 JSON 為準。

## 執行方式

預設只匯入前 10 筆英文資料：

```bash
npm run cards:import:sample
```

等同於：

```bash
node scripts/import-official-cards.mjs \
  --locale en \
  --limit 10 \
  --output data/cards/official-sample.en.json
```

`--limit` 限制為 1 到 100。匯入器只請求一份官方 JSON，並不下載任何卡牌圖片。

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

目前不解析攻擊文字內的 `{R}`、`{N}`、`{da}` 等標記；解析器應在確認完整符號規格後另行實作。

## 使用與版權

- 匯入資料保留來源 URL、抓取時間與官方更新時間。
- 卡牌圖片由 CookieRun / Devsisters 等權利人持有。
- 此階段只保存圖片 URL，不將圖片檔提交到 repository。
- 未取得授權前，不應把大量官方圖片重新散布或用於商業服務。
- 匯入器應維持低頻、手動執行，不繞過登入、權限或存取限制。
