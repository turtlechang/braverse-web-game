# 新卡牌更新流程（Card Update Process）

最後更新：2026-07-10。適用於匯入新彈、新起始牌組或修正既有卡牌資料。

> **定位**：本流程為 Codex／CLI 受控匯入，不走遊戲內上傳。所有卡牌資料變更必須經過 `validate:cards` 驗證；**資料驗證失敗不得覆蓋正式卡池**（`data/cards/*.json`）。匯入腳本以 npm scripts 執行，由維護者在開發環境手動觸發，不開放終端使用者上傳卡牌資料。

## 流程總覽（11 步）

| # | 步驟 | 工具 / 位置 |
|---|---|---|
| 1 | 匯入卡牌資料 | `npm run cards:import:*`（起始牌組）或 `cards:import:brave-beginning`（BOOSTER）；新彈需新增匯入腳本，套用既有 normalize + **異圖回填**（`backfillVariantStats`）邏輯 |
| 2 | 執行資料驗證 | `npm run validate:cards` — 必填欄位、同檔重複卡號、全卡池可轉換 GameCard、效果文字未轉出偵測 |
| 3 | 檢查效果轉換 | validate:cards 報「有效果文字但未轉出」即此步：確認 `official-text-parser` 可解析、或需要 exact 表項目 |
| 4 | 補效果 resolver | `src/cards/official-effect-adapter.ts`（exact 表或通用 parser）；新機制需擴充 `CardEffect` 型別與 `src/game/effects/` 執行邏輯——**待官方規則確認後才擴充 CardEffect** |
| 5 | 補單元測試 | 每張新支援卡至少一則效果結算測試；新機制加機制測試（參考 `effects-new-mechanics.test.ts`） |
| 6 | AI smoke test | 含新卡的牌組跑 `simulateAiMatch` 多種子模擬（參考 `ai-training-batch.test.ts` 的矩陣寫法），確認對局可正常結束、AI 不卡死 |
| 7 | UI 卡牌顯示檢查 | 牌組編輯器搜尋/篩選可見、卡牌詳情 modal 正常、效果決策提示框流程可完成（依 [manual-playtest-checklist.md](manual-playtest-checklist.md) §卡牌） |
| 8 | 更新 CHANGELOG | `CHANGELOG.md` 的 `[Unreleased]` 段落 |
| 9 | 建立 PR | 依 [release-process.md](release-process.md) 的分支與驗證門檻 |
| 10 | Preview 驗收 | Vercel Preview URL 實際用新卡打一局 |
| 11 | 合併與部署 | 維護者交叉驗證後合併，main 自動部署 |

## 注意事項

- **卡牌資料不硬寫在元件中**：一律走 `data/cards/*.json` → `src/cards/` 轉接層 → `GameCard`。
- **異圖版（`@` 變體）**：官方資料偶爾缺 level/hp（前例：BS2-061@1），匯入腳本會從基礎版回填；exact 效果表查詢一律用 `baseCardNumber` 正規化（PR #17 教訓）。
- **陷阱/FLIP 由欄位驅動**：`card_type=TRAP` 解析 `card_attack_text`、`card_type=FLIP` 解析 `card_flip`，不依卡號硬編碼。
- **卡池去重**：跨檔案同卡號屬正常（卡池以 cardNumber 去重取先見者）；同檔重複才是錯誤。
- **不確定的官方裁定**：記錄到 `docs/rule-clarifications.md`，不得把待確認規則寫成已完成。
- 官方資料更新時重新匯入樣本，並同步更新文件與測試中的張數/數字。
