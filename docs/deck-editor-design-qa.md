# 牌組編輯器設計驗收

**驗收日期：2026-08-10**
**範圍：Master Duel 牌組編輯器資訊架構的 Braverse 風格全頁實作**

## 設計基準

本次版面參考以下使用者提供的 Master Duel 截圖：

- `C:\Users\WH3FTURTLE\Downloads\螢幕擷取畫面 2026-08-10 153749.png`（1600×904）
- `C:\Users\WH3FTURTLE\Downloads\8161caf9fd01e4ebfd1dc03601be1123.jpg`（1274×717）

保留 Master Duel 的三區資訊架構：左側選取卡詳情、中間目前牌組、右側卡牌列表；視覺改用專案既有的深藍桌墊、青色描邊、金色重點、卡牌原圖與 BRAVERSE 字體／色彩語彙。牌組主流程渲染在整頁 `DeckEditorPage`，不以 modal 作為工作區容器。

## 實作對照

| 區域 | 實作 | 驗收內容 |
| --- | --- | --- |
| 頁首 | `src/components/DeckEditorPage.tsx` | 返回、牌組名稱、賽制、卡數、FLIP 數、儲存與匯入／匯出入口均在頁面內 |
| 左欄 | `src/components/DeckEditorPage.tsx` | 卡圖、卡號、類型、稀有度、等級／HP／攻擊、能力／攻擊／FLIP 文字與加減卡按鈕 |
| 中欄 | `src/components/DeckEditorPage.tsx` | Main Deck 格狀排列、張數統計、合法性提示、清空與牌組操作列 |
| 右欄 | `src/components/DeckEditorPage.tsx` | 搜尋、系列／顏色／類型／稀有度篩選、Standard／Open 賽制提示、卡池加入按鈕 |
| 響應式 | `src/components/DeckEditorPage.css` | 桌面三欄；≤1100px 壓縮欄寬；≤820px 改為雙欄並讓卡池滿寬；≤560px 堆疊為單欄 |
| 主選單接線 | `src/components/battle/MenuScreen.tsx` | 進入牌組編輯器後隱藏主選單，顯示整頁工作台；返回時回到主選單 |

## Browser 驗收

以本機 Vite Preview、1280×720 viewport 驗證：

1. 從主選單進入「牌組編輯器」後，頁面顯示三欄工作區，沒有 `.modal-backdrop` 或 `[role="dialog"]` 牌組編輯容器。
2. 搜尋卡牌、查看左側詳情、從右欄加入卡牌、在中欄看到張數與合法性狀態均可完成。
3. 載入既有 60／60 牌組後，Main Deck 格狀清單、FLIP 統計與儲存狀態正常呈現。
4. 桌面、平板橫向與窄版的欄位收合規則由 CSS media query 控制，不依賴固定 viewport 或 modal 內捲動。

## 回歸檢查

- `src/components/DeckEditorPage.test.tsx`：確認整頁渲染、不存在 modal／dialog，並驗證卡池加入流程。
- `npm.cmd test -- src/components/DeckEditorPage.test.tsx src/components/modals/DeckEditorModal.interaction.test.tsx src/components/modals/DeckEditorModal.data-safety.test.tsx --maxWorkers=1`：14 tests passed。
- `npm.cmd run build`：通過；Vite 僅回報既有大型 chunk 警告。
- `npm.cmd run test:deck:browser`：應作為 PR Browser gate 的正式整頁驗收命令。

## 已知界線

本次只改變牌組編輯器的頁面承載與資訊架構，不改動 `custom-deck` 的牌組規則、匯入格式、localStorage schema 或正式卡池內容；現有舊版 `DeckEditorModal` 保留給其他相容流程，但主選單入口已改走全頁工作台。

final result: passed

## Browser gate rerun 2026-08-10

- `npm.cmd run test:deck:browser`: passed at `1366x768` and `280x720`; both viewports have no horizontal overflow and no page errors.
- `npm.cmd run test:online:browser`: passed at `1366x768` and `280x720`; the full-page editor returns through its back control and the online match panel remains within the viewport.
- Full-page editor vertical scrolling is intentional on narrow viewports; the acceptance gate checks horizontal geometry separately.
