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

## 2026-08-11：牌組分類與匯入提示框

- 主要牌組依正式卡牌類型分為「餅乾／FLIP／物品／陷阱／場景」五個區段；各區段顯示獨立張數，但仍共用既有 60 張、同卡上限、至少 1 張餅乾與 FLIP 上限驗證。
- 額外牌組以「BS8 預備」固定區段呈現；目前沒有可加入卡牌，不改動 `CustomDeck` JSON、60 張主牌組計數或現行賽制規則。
- JSON 匯入改為 `role="dialog"`、`aria-modal="true"` 的置中提示框，支援取消、點擊遮罩與 Esc 關閉。它是唯一的輔助操作 modal，主編輯器本身仍維持全頁工作台。
- Browser 實測完整牌組分區為餅乾 26／FLIP 12／物品 8／陷阱 10／場景 4；開啟匯入提示框前後，中央牌組欄均為 `571.51 × 616px`，無版面位移。

## Browser gate rerun 2026-08-10

- `npm.cmd run test:deck:browser`: passed at `1366x768` and `280x720`; both viewports have no horizontal overflow and no page errors.
- `npm.cmd run test:online:browser`: passed at `1366x768` and `280x720`; the full-page editor returns through its back control and the online match panel remains within the viewport.
- Full-page editor vertical scrolling is intentional on narrow viewports; the acceptance gate checks horizontal geometry separately.

## 2026-08-11：緊湊操作列與可收合篩選

- 賽制選單移到頁首的「儲存牌組／儲存草稿」左側；中央欄僅保留單列牌組名稱，讓主要牌組的分類卡片區更早進入可視範圍。
- 卡池將類型、顏色、系列與稀有度整合到「篩選條件」可展開控制列；預設收合，已套用的篩選條件以數量標記提示，搜尋列下方直接顯示卡片。
- 此調整只改變排版與控制列的顯示密度，沒有修改卡池篩選邏輯、賽制規則、牌組 JSON 或卡片資料。

## 2026-08-11：卡牌資訊欄 Master Duel 式摘要

- 左欄改為卡圖在左、資訊摘要在右；摘要固定列出等級、HP、普通攻擊力、卡牌類型與稀有度。卡圖在桌面版擴大，窄欄時才安全地改為上下排列。
- 技能、普通攻擊、攻擊後續效果與 FLIP 說明維持在摘要下方；普通攻擊以 `{da}` 分出攻擊力與後續效果，避免混在同一段文字。
- 卡牌文字改用共用 `CardEffectText` 呈現，因此 `{R}`、`{G}` 等能量標記會顯示為既有的能量圖示與替代文字，不再顯示原始標記。

## 2026-08-11：頁首牌組狀態

- 原本位於中央牌組欄的合法性提示已移入頁首，與頁面名稱、賽制與儲存操作同屬全局狀態；中央欄不再為這兩行訊息保留高度。
- 桌面版提示緊鄰頁面標題；平板與窄版在可用寬度不足時換行，仍保留完整的可讀狀態與操作說明。

## 2026-08-11：頁首卡池工具

- 卡池統計與匯出／匯入 JSON 已移到頁首中央操作區；右側卡池改從搜尋與可收合篩選直接開始，增加可同時瀏覽的卡片數。
- 工具區在桌面版與標題／合法性狀態同列置中；中小寬度自動換為多列，不讓按鈕或統計超出頁面。

## 2026-08-11：手機工作台垂直捲動

- 手機與窄平板不再把編輯器改成自然高度後交給頁面根節點捲動；因為遊戲殼的根節點會固定 viewport，該做法會使主要牌組與卡池被裁切。
- 現在由全頁 `DeckEditorPage` 維持 viewport 高度並承接垂直觸控捲動，可依序到達卡牌資訊、主要牌組的加減按鈕與卡池；桌面三欄與各清單的內部捲動不受影響。
- `test:deck:browser` 在 `622×1040`、`390×844` 與 `280×720` 會確認編輯器有垂直捲動範圍，並在捲動後實際操作主要牌組的減卡／加卡按鈕。
