# Phase Rail 下一階段按鈕尺寸設計

> 日期：2026-06-19
> 狀態：已核准

---

## 1. 目標

- 修正 `@container game-shell (max-width: 1200px)` 隱藏 `.turn-indicator` 後，`.next-phase-button` 誤落入 `minmax(0, 1fr)` row 而膨脹至 331px 的問題。
- 為 `.phase-rail` 的五個直接子元素明確指定 `grid-row`，使隱藏 `turn-indicator` 時第二列收斂為 0，`ol` 仍固定第三列 `1fr`，按鈕固定第四列內容高度（`auto`）。
- 按鈕在 1538×578 viewport 下顯示約 44px（即 `min-height: 44px` 對應的內容高度），階段列表（`ol`）取得剩餘 `1fr` 高度。
- `max-width: 900px` 橫向佈局再次 override `grid-row: 1`，使子元素依既有 `grid-column` 配置水平排列，不受桌面 row 指定污染。
- 所有支援 viewport 解析度下不溢出、不產生額外垂直捲軸。

## 2. 非目標

- 不改變 grid 基本結構（仍為五列 `auto auto minmax(0, 1fr) auto auto`）。
- 不改變 `max-width: 900px` 以下的橫向 `grid-template-columns` 配置或子元素內容。
- 不加入固定 px 症狀補丁（如 `max-height: 44px`、`height: 44px` 強蓋）。
- 不改變 `container` query 斷點或現有 gap／padding。
- 不修改 `PhaseRail.tsx` 的 JSX 結構或 props。
- 不修改其他 CSS 檔案。

## 3. 根因

在 1538×578 viewport、`game-shell` 1027.55×578 的 container 尺寸下：

1. `@container (max-width: 1200px)` 使 `.turn-indicator { display: none }`，第二個 `auto` row 收斂為 0。
2. `display: none` 元素不參與 CSS Grid 自動放置（auto-placement），grid 僅對 4 個可見項目依序放置：
   - `.brand-mark` → row 1（`auto`）→ 16px
   - `.phase-rail ol` → row 2（`auto`）→ 146px
   - `.next-phase-button` → row 3（`minmax(0, 1fr)`）→ 331px（1fr 分配剩餘高度）
   - `.turn-counter` → row 4（`auto`）→ 14px
   - row 5（`auto`）未被佔用 → 0px

3. 因此 computed grid rows 為 `16px / 146px / 331px / 14px / 0px`，按鈕收到 331px 遠超過其 `min-height: 44px`，階段列表被壓縮在 146px。

## 4. CSS 設計

### 4.1 為五個子元素指定 `grid-row`

在 `.phase-rail` 的基礎規則中補上：

```css
.phase-rail {
  grid-template-rows: auto auto minmax(0, 1fr) auto auto;
  /* 其餘現有屬性不變 */
}

.brand-mark {
  grid-row: 1;
}

.turn-indicator {
  grid-row: 2;
}

.phase-rail ol {
  grid-row: 3;
}

.next-phase-button {
  grid-row: 4;
}

.turn-counter {
  grid-row: 5;
}
```

#### 行為推導

- `grid-row: 2` 設在 `.turn-indicator` 上，即使 `display: none` 其 grid area 仍保留 row 2 的位置，但由於 `display: none` 元素不佔用空間，row 2（`auto`）收斂為 0。
- `.phase-rail ol` 固定在 `grid-row: 3`（`minmax(0, 1fr)`），無論 turn-indicator 顯示與否，ol 永遠取得第三列的 `1fr` 空間。
- `.next-phase-button` 固定在 `grid-row: 4`（`auto`），其高度僅由內容 + `min-height: 44px`（或對應 container query 的 `min-height`）決定，不受 `1fr` 分配影響。
- `grid-row: 5` 設在 `.turn-counter` 上，明確留在最後一列 `auto`。

#### 與既有 container query 的互動

- `max-height: 720px`（min-height: 52px）、`max-height: 620px`（min-height: 44px）的覆蓋仍然有效，因為按鈕固定在 row 4（`auto`），`min-height` 正常生效。
- `max-height` 限縮時 `.phase-rail` 的整體高度變小，`1fr` 分配給 `ol` 的空間相應減少，但按鈕 row 4 維持 `auto` 內容高度。

### 4.2 `max-width: 900px` 橫向佈局重設

`max-width: 900px` 斷點將 `.phase-rail` 改為水平流向：

```css
@container game-shell (max-width: 900px) {
  .phase-rail {
    grid-template-columns: 74px minmax(0, 1fr) 90px 40px;
    grid-template-rows: 1fr;
    /* 其餘現有屬性不變 */
  }
}
```

此時必須將五個子元素的 `grid-row` 重設回 `1`，否則 `grid-row: 2`～`5` 的指定會讓子元素超出 `.phase-rail` 的單列 grid，導致元素遺失或溢出。

```css
@container game-shell (max-width: 900px) {
  .brand-mark,
  .turn-indicator,
  .phase-rail ol,
  .next-phase-button,
  .turn-counter {
    grid-row: 1;
  }
}
```

這樣所有子元素回到同一列，依既有 `grid-column` 設定水平排列。

> `.turn-indicator` 在此斷點下 `display: grid` 重新顯示，`.brand-mark` `display: none`，皆與既有行為一致；`grid-row: 1` 確保它們在水平列中各自佔據正確的 `grid-column`。

### 4.3 修改要點總結

| 位置 | 新增內容 | 原因 |
|---|---|---|
| `.brand-mark` 基礎規則 | `grid-row: 1;` | 明確定位第一列 |
| `.turn-indicator` 基礎規則 | `grid-row: 2;` | 明確定位第二列，隱藏時 row 2 收斂 0 |
| `.phase-rail ol` 基礎規則 | `grid-row: 3;` | 固定佔據 `minmax(0, 1fr)` 第三列 |
| `.next-phase-button` 基礎規則 | `grid-row: 4;` | 固定為 `auto` 第四列，避免落入 1fr |
| `.turn-counter` 基礎規則 | `grid-row: 5;` | 明確定位第五列 |
| `max-width: 900px` 區塊 | 五元素 `grid-row: 1;` 群組重設 | 水平佈局時回到單列 grid |

## 5. 響應式邊界

### 5.1 支援 viewport

本專案支援視窗範圍 600×338 以上（含 768×432、900×506、1024×576、1280×720、1366×768、1440×960、1536×864、1600×900、1907×868、1920×1080）。

### 5.2 `max-width: 1200px` 情境

- `.turn-indicator` 隱藏，第二列收斂為 0。
- `ol` 固定在 `grid-row: 3`（`minmax(0, 1fr)`）取得剩餘高度。
- `.next-phase-button` 固定在 `grid-row: 4`（`auto`），高度僅由內容撐起 + `min-height`。
- 各 container query（`max-height: 720px`、`max-height: 620px`）的縮減仍有效，按鈕 `min-height` 依序遞減。

### 5.3 `max-width: 900px` 情境

- `.phase-rail` 改為水平 `grid-template-columns` + `grid-template-rows: 1fr`。
- 所有子元素 `grid-row: 1`，依 `grid-column` 水平排列。
- 既有 `max-width: 900px and max-height: 400px` 的進一步壓縮不受影響。

### 5.4 按鈕高度保證

- `min-height` 在三個 container query 層級分別為 68px（預設）、52px（max-height: 720px）、44px（max-height: 620px），均在 `grid-row: 4`（`auto`）下正常生效。
- 當內容（含 span + small + svg）少於 `min-height` 時，按鈕高度 = `min-height`；當內容大於 `min-height` 時，按鈕高度 = 內容高度。
- `min-height: 0` 在 `max-width: 900px` 時依既有規則使用，不變。

### 5.5 階段列表（`ol`）可用高度說明

修正 `grid-row` 後，`ol` 固定在 `grid-row: 3`（`minmax(0, 1fr)`），取得 phase-rail 扣除 padding、gap 及其他 `auto` row 後的剩餘高度。在 1538×578 viewport 下實際 computed grid rows 為：

- row 1（brand-mark, `auto`）：16px
- row 2（turn-indicator, `auto`）：0px（`display: none`）
- row 3（ol, `minmax(0, 1fr)`）：剩餘高度
- row 4（next-phase-button, `auto`）：44px（內容 + min-height: 44px）
- row 5（turn-counter, `auto`）：14px

gap 僅在已佔用 row 之間生效（15px = 5px × 3），padding 約 51px（padding-top 44px + padding-bottom 7px）。`ol` 可取得主要剩餘高度，此為目標，不硬性要求特定 px 下限。

## 6. 驗收標準

- [ ] `.phase-rail` 的五個直接子元素各自帶有 `grid-row` 指定（`.brand-mark: 1`、`.turn-indicator: 2`、`.phase-rail ol: 3`、`.next-phase-button: 4`、`.turn-counter: 5`），且 `max-width: 900px` 斷點內全部重設為 `grid-row: 1`。
- [ ] 1538×578 viewport 下，`.next-phase-button` 的 `getBoundingClientRect().height` 約為 44px（±4px，因 container query 邊界 overlap 或 subpixel 捨入），不再出現 331px 或接近 `1fr` 的異常高度。
- [ ] `.phase-rail ol`（階段列表）在 1538×578 下取得主要剩餘高度，階段項目可視且不限於 146px。
- [ ] 所有支援 viewport 解析度（600×338、768×432、900×506、1024×576、1280×720、1366×768、1440×960、1536×864、1600×900、1907×868、1920×1080）下 `.phase-rail` 內容不溢出，不產生垂直捲軸。
- [ ] `max-width: 900px` 橫向佈局下五個子元素全部在 `grid-row: 1` 內依 `grid-column` 排列，無元素遺失或位置異常。
- [ ] 隱藏 `.turn-indicator`（`max-width: 1200px`）與顯示 `.turn-indicator`（`max-width: 1200px` 以上或 `max-width: 900px`）兩情境下，按鈕與階段列表尺寸行為一致：按鈕維持 `auto` 內容高度，列表取得 `1fr` 剩餘空間。

## 7. 測試規劃

### 7.1 Playwright 量測

- 設定種子（或任何種子）使 game-shell container 寬度落於 900px～1200px 之間（例如 viewport 1024×768），確認 `.next-phase-button` bounding rect 高度不超過 80px。
- 以 1538×578 viewport 重複驗證按鈕高度約 44px。
- 檢查 `.phase-rail ol` bounding rect 高度在 1538×578 下明顯大於按鈕高度（例如 button 44px、ol > 350px，確認 ol 取得主要剩餘空間）。
- 以 600×338 viewport 確認 `.phase-rail` 無溢出、無垂直捲軸。
- 以 1920×1080 viewport 確認按鈕無異常放大（無 `grid-row` 錯位影響）。
- 以 900×600 viewport 確認橫向 `.phase-rail` 之子元素全部位於 `grid-row: 1`，無元素遺失。
- 檢查 `.turn-indicator` 隱藏／顯示時，`ol` 與 `.next-phase-button` 的 grid area 位置不跳動。

### 7.2 單元測試

- 因修改僅涉及 CSS，無純函式邏輯變更，不需新增 unit test。
- 但可擴展現有 CSS 屬性快照測試（如有）檢查 `.phase-rail` 子元素的 `grid-row` computed style。

### 7.3 視覺回歸

- 擷取 1538×578 下 `.phase-rail` 截圖，以程式標註 `.next-phase-button` 與 `.phase-rail ol` 的高度，確認 button 約 44px、ol 取得主要剩餘高度。
- 對 `max-width: 900px` 橫向佈局截圖，確認 `grid-row` 重設後水平排列正常。
