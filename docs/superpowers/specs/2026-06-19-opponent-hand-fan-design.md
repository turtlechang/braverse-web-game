# 對手手牌扇形展開設計

> 日期：2026-06-19
> 狀態：已核准（實作驗證：1538×578 六張牌 faceTransform 為 CSS matrix(-1,0,0,-1,0,0)，外側角度 ±25deg，左界約 2px，無捲軸／console error）
> 幾何：集中握點／近共同 pivot 放射扇形，中央近垂直、外側約 ±25°，相鄰 pivot 位移約 0.25 卡寬，無 U 型上下弧。

---

## 1. 目標

- 對手手牌依照官方參考圖，在畫面左上角以牌背扇形展開，與我方手牌（右下角、正面朝上）對稱配置。
- 扇形容器（`.hand-fan.top-hand`）移入 `.field-stack` 內，使其 `left: 0` 直接對應 `.support-zone` 左邊界；不得使用 `section.battle-row` 層級的 magic offset（如 `left: 16px`）。
- 最左張旋轉後的可視 bounding box 左緣須貼齊 `.support-zone` 左邊界（允許 0～4px 安全 padding），不得內縮 ≥ 56px 浪費可用空間。
- 安全邊界以「精確左側 overhang」公式計算（見第 5.2 節公式 4），取代保守的 `W/2 + H·sin(|θ|)` 高估。
- 牌卡之間有由左向右的 index-based 水平位移（百分比軌道），再疊加中間高、兩側低與旋轉；不得全部堆疊於容器水平中線（`left: 50%`）。
- 手牌數量增加時，扇形張角與水平間距依可用寬度動態壓縮，以可測試的純函式表達。不捏造未確認的最大手牌上限。
- 對手牌不可 hover、不可選取、不可顯示正面。
- 本專案支援視窗 600×338 以上之響應式尺寸，該範圍內最左張不得越過 `.support-zone` 左邊界。
- 我方手牌（`.bottom-hand`）的定位、互動行為保持不變。
- 佈局純依 CSS 百分比與 custom property 完成，不引入 `useRef`、`ResizeObserver` 或 JS 端 `containerWidth` 量測。

## 2. 非目標

- 不顯示對手手牌卡面正面（一律牌背）。
- 不支援對手牌的 hover 放大、選取高亮或動作按鈕。
- 不改變 `.bottom-hand`（我方手牌）的定位邏輯、CSS custom property 公式與互動行為。
- 不修改 `CardFace` 元件或遊戲規則引擎。
- 不實作對手手牌的動畫進場或抽牌過渡（後續另案）。
- 不支援拖曳對手手牌。

## 3. DOM / CSS 設計

### 3.1 容器：移入 `.field-stack`，以 `inset-inline` 建立安全軌道

將 `.hand-fan.top-hand` 從 `section.battle-row` 的直接子層移入 `.field-stack`，作為絕對定位的覆疊層。透過動態 `inset-inline`（對應 LTR 下的 `left`／`right`）縮排左右邊界，建立「安全軌道」，牌卡在軌道內以百分比定位。

```css
/* .field-stack 需為 positioned 祖先（若尚未宣告 position，則補上 relative） */
.field-stack {
  position: relative;
}

.field-stack > .hand-fan.top-hand {
  position: absolute;
  inset: 0;
  /*
   * --safety-inset：由 JS 依 hand.length / 最大角度計算的精確內距 (px)。
   * = leftOverhang + 2（見第 5.2 節公式 5）。
   * clamp(0px, …, 50%) 僅防止軌道負寬導致 CSS 無效值；
   * 當容器可用寬度 < 2 × safetyInset 時已屬不支援的退化條件（見 6.3 節）。
   */
  --safe: clamp(0px, var(--safety-inset), 50%);
  inset-inline: var(--safe);
  height: 140px;
  pointer-events: none;
  z-index: 10;
}
```

- `inset: 0` 先將四邊錨定至 `.field-stack` 邊界；`inset-inline: var(--safe)` 覆寫左右側，使容器左／右邊各內縮 `var(--safe)`。
- 容器實際內容寬度 = `.field-stack` 寬度 − `2 × var(--safe)`。牌卡在此寬度內以 `0%`～`100%` 定位。
- `clamp(0px, …, 50%)` 僅防止安全內距超過容器一半導致軌道負寬（CSS 無效值）；不保證此時仍滿足左邊界。當容器可用寬度 < `2 × safetyInset` 時屬幾何退化條件（見第 6.3 節），本專案不支援。
- `--safety-inset` 以 inline style 設定於容器元素（`<div className="hand-fan top-hand" style={{ '--safety-inset': `${safetyInset}px` }}>`）。

### 3.2 單張卡牌定位

每張對手手牌的 `.hand-card-wrap` 加上修飾類別 `.opponent-hand-card`，在安全軌道內以百分比 `--hand-offset-fraction`（0～1）由左至右排列，再疊加旋轉。所有牌卡 pivot 位於同一水平線（center bottom），無垂直弧深（集中握點放射扇形）。

```css
.hand-card-wrap.opponent-hand-card {
  position: absolute;
  bottom: 0;
  pointer-events: none;
  transform-origin: center bottom;
  transition: none;

  /* 在安全軌道內依比例水平定位 */
  left: calc(100% * var(--hand-offset-fraction));
  /*
   * CSS transform 函式由右向左套用：
   *   1) rotate(var(--opponent-angle)) 將卡牌繞 center bottom 旋轉。
   *   translateY(0) 無垂直位移（集中握點，無 U 型弧）。
   */
  transform:
    rotate(var(--opponent-angle));
}

/* count = 1 時水平置中且無旋轉 */
.hand-card-wrap.opponent-hand-card.single-card {
  left: 50%;
  transform: none;
}
```

- `left: calc(100% * var(--hand-offset-fraction))`：以容器縮排後之內容寬度為 100%，`fraction = 0` 對應軌道最左、`fraction = 1` 對應軌道最右。
- `transform-origin: center bottom`：旋轉基準點設於卡牌底部中點，使頂部旋轉展開幅度大於底部，形成自然扇形。
- `--hand-offset-fraction`：無單位數值（0 ≤ … ≤ 1），由第 5 節公式計算。
- `--opponent-angle`：旋轉角度（deg），正值向右、負值向左。
- `--opponent-arc-y`：垂直弧深（px），正值向下位移。
- `pointer-events: none`：禁止所有指標事件。
- `transition: none`：對手牌不做 hover 過渡動畫。

### 3.3 防止 hover／selected 樣式洩漏至 top-hand

既有 CSS 中存在通用選擇器：

```css
.hand-card-wrap:hover,
.hand-card-wrap:focus-within { ... }
.hand-card-wrap.is-selected { ... }
```

這些選擇器未限定於 `.bottom-hand`，會同時命中 `.top-hand` 內的 `.hand-card-wrap`（即使 `pointer-events: none` 阻止 hover 觸發，`.is-selected` 仍可能因 JS 狀態而套用）。修正方式：將上述規則的選擇器加上 `.bottom-hand` 前綴，使其僅作用於我方手牌：

```css
.bottom-hand .hand-card-wrap:hover,
.bottom-hand .hand-card-wrap:focus-within { ... }

.bottom-hand .hand-card-wrap.is-selected { ... }
```

此外，`BattleRow.tsx` 中在 `isOpponent === true` 時不加入 `is-selected` class，作為 JS 層雙重保護。

### 3.4 牌面隱藏

透過 `CardFace` 元件的 `concealed` prop 傳入 `true`，一律顯示牌背。不依賴 CSS 遮蓋或 `visibility`。此行為與現有實作一致，不需修改。

## 4. 資料流

| 項目 | 來源 | 消費端 |
|---|---|---|
| 對手手牌陣列 | `game.players[opponentId].hand` | `BattleRow` → `.hand-fan.top-hand` 迴圈渲染 |
| 牌背顯示 | `isOpponent`（由 `position === 'top'` 推得） | `CardFace` 的 `concealed` prop |
| 扇形參數 | `BattleRow.tsx` 內純函式即時計算（見第 5 節） | CSS custom property，區分兩層設定 |
| ─ 容器級 | `safetyInset`（px） | `.hand-fan.top-hand` 的 `--safety-inset` |
| ─ 牌卡級 | `handOffsetFraction`、`opponentAngle` | `.hand-card-wrap` 的 `--hand-offset-fraction` / `--opponent-angle`（`arcYRatio` 恆為 0，無弧深） |

元件不儲存對手手牌區域狀態，僅從 `GameState` 讀取唯讀資料。所有計算為純函式，每次 render 重新推導。不讀取 `clientWidth`、不使用 `ResizeObserver`。

## 5. 扇形參數計算

以下邏輯位於 `BattleRow.tsx` 的手牌迴圈中，僅在 `isOpponent` 為 `true` 時使用。計算結果以 CSS custom property 注入對應元素。

### 5.1 輸入

| 符號 | 意義 | 來源 |
|---|---|---|
| `count` | `hand.length` | `GameState` |
| `index` | 該牌在 `hand` 陣列中的位置（0‑based） | 迴圈 |
| `W` | 牌寬，112（px） | `.hand-card` CSS width |
| `H` | 牌高，156（px） | 由牌面比例推算（112 × 63/88 × 2 ≈ 160；此處取保守值 156） |

無 JS 端 `containerWidth` 參數；水平佈局純由 CSS `%` 與 `inset-inline` 處理。

### 5.2 公式

```
// 1. 扇形張角（總弧寬）
//    1 張為 0；2 張以上固定 50°（外側約 ±25°）。
//    採用「集中握點／近共同 pivot」放射扇形，無壓縮。
arcSpan = count <= 1 ? 0 : 50

// 2. 各牌旋轉角度：以陣列中位為零，等距分佈
centerIndex = (count - 1) / 2
opponentAngle = count <= 1 ? 0 : (index - centerIndex) * (arcSpan / (count - 1))

// 3. 最大旋轉幅度（deg），即最左張 |opponentAngle| 的絕對值
maxAngle = count <= 1 ? 0 : arcSpan / 2  // = 25°（count ≥ 2）

// 4. 精確左側 overhang（px）
//    以 center bottom 為旋轉原點、最左張負角度 a = maxAngle 旋轉時，
//    可視 bounding box 左緣超越未旋轉 layout left 的距離。
//
//    推導：旋轉矩陣（−a），取卡片四角的 x' 最小值。
//    未旋轉座標系下，錨點 (left + W/2, bottom)。
//    最左點在 (−W/2, −H) 處（左上角）：
//      x' = (left + W/2) + (−W/2)·cos(a) + (−H)·sin(a)
//         = left + (W/2)·(1 − cos(a)) − H·sin(a)
//    overhang = left − x' = H·sin(a) − (W/2)·(1 − cos(a))
//
//    max(0, …) 防止極小角度時浮點負值。
a = maxAngle * Math.PI / 180
leftOverhang = count <= 1 ? 0 : Math.max(0, H * Math.sin(a) - (W / 2) * (1 - Math.cos(a)))

// 5. 安全內距（px）
//    = leftOverhang + 2px padding。
//    使最左張旋轉後可視左緣貼齊 .support-zone 左邊界（內縮 ≤ 2px）。
//    前提為容器可用寬度 ≥ 2 × safetyInset（支援視窗內恆成立，見 6.3）。
safetyInset = leftOverhang + 2

// 6. safetyRatio（無單位，leftOverhang 占卡寬比例）
safetyRatio = count <= 1 ? 0 : leftOverhang / W

// 7. 緊密扇形軌道寬度比（無單位）
//    總軌道寬 = W × fanTrackRatio。
//    count = 1 時至少 1（單張全寬）；count > 1 時約 0.25×(count−1)，
//    使相鄰 pivot 僅位移約 0.25 卡寬（每張只露出約 30～40px，考慮旋轉後視覺）。
//    近共同握點結構，牌卡大幅重疊形成撲克牌放射扇形。
fanTrackRatio = count <= 1 ? 1 : 0.25 * (count - 1)

// 8. 各牌在緊密軌道內的百分比位置（0～1，自左至右）
//    count = 1 時設為 0，由 .single-card class 覆蓋為 left: 50%。
handOffsetFraction = count <= 1 ? 0 : index / (count - 1)

// 9. 垂直弧深比（無單位）
//    採用集中握點放射扇形，不再使用人工 U 型上下位移。
//    所有牌卡 pivot 位於同一水平線（center bottom），無 translateY 弧度。
arcYRatio = 0

// 10. z-index：中央牌較高，向兩側遞減
//     center → 5，edges → 0。CSS 端以 calc(10 + var(--fan-z-index)) 疊加。
maxNorm = (count - 1) / 2 || 1
normOffset = count <= 1 ? 0 : (index - centerIndex) / maxNorm
fanZIndex = count <= 1 ? 0 : Math.round((1 - Math.abs(normOffset)) * 5)
```

### 5.3 計算範例表（W=112, H=156）

以下展示各 `count` 對應的 JS 純函式輸出值。`handOffsetFraction` 範圍為 0 ～ 1（最左 0，最右 1），不依賴容器像素寬度。

| count | arcSpan (°) | maxAngle (°) | leftOverhang (px) | safetyInset (px) | fanTrackRatio | arcYRatio 中心 | fanZIndex 中心 | opponentAngle 範圍 (°) | handOffsetFraction 範圍 |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | – | – | – | – | – | – | – | – | – | – |
| 1 | 0 | 0 | 0 | 2 | 1 | 0 | 0 | 0 | 0（單張強制 `left: 50%`） |
| 2 | 50 | 25 | 60.7 | 62.7 | 0.25 | 0 | 5, 5 | −25, +25 | 0, 1 |
| 3 | 50 | 25 | 60.7 | 62.7 | 0.5 | 0 | 0, 5, 0 | −25, 0, +25 | 0, 0.5, 1 |
| 4 | 50 | 25 | 60.7 | 62.7 | 0.75 | 0 | 0, 3, 3, 0 | −25, −8.3, +8.3, +25 | 0, 0.333, 0.667, 1 |
| 5 | 50 | 25 | 60.7 | 62.7 | 1.0 | 0 | 0, 3, 5, 3, 0 | −25, −12.5, 0, +12.5, +25 | 0, 0.25, 0.5, 0.75, 1 |
| 6 | 50 | 25 | 60.7 | 62.7 | 1.25 | 0 | 0, 2, 4, 4, 2, 0 | −25, −15, −5, +5, +15, +25 | 0, 0.2, 0.4, 0.6, 0.8, 1 |
| 7 | 50 | 25 | 60.7 | 62.7 | 1.5 | 0 | – | −25 … +25 | 0 … 1 |
| 8 | 50 | 25 | 60.7 | 62.7 | 1.75 | 0 | – | −25 … +25 | 0 … 1 |
| 10 | 50 | 25 | 60.7 | 62.7 | 2.25 | 0 | – | −25 … +25 | 0 … 1 |
| 12 | 50 | 25 | 60.7 | 62.7 | 2.75 | 0 | – | −25 … +25 | 0 … 1 |

> 表中值為近似（至小數一位），實際以 JS `Math` 運算結果為準。`arcYRatio` 恆為 0（集中握點放射扇形，無 U 型上下弧）。`fanTrackRatio = 0.25 × (count − 1)`，相鄰 pivot 位移約 0.25 卡寬（每張只露出約 30～40px，考慮旋轉後視覺）。

### 5.4 公式約束

- `safetyInset = leftOverhang + 2`，其中 `leftOverhang = max(0, H·sin(a) − (W/2)·(1−cos(a)))`，`a = maxAngle`。
- `safetyRatio = leftOverhang / W`，用於 CSS 容器左側安全內距。
- `count = 1` 時 `leftOverhang = 0`、`safetyInset = 2`、`fanTrackRatio = 1`。
- `count ≥ 2` 時 `maxAngle = 25°`（外側約 ±25°）、`arcSpan = 50°`、`leftOverhang ≈ 60.7`、`safetyInset ≈ 62.7`。
- 採用「集中握點／近共同 pivot」放射扇形，`arcSpan` 固定 50°，不因手牌數量增加而壓縮張角。
- `fanTrackRatio = 0.25 × (count − 1)`（count ≥ 2），相鄰 pivot 位移約 0.25 卡寬，每張只露出約 30～40px（考慮旋轉後視覺），牌卡大幅重疊形成撲克牌放射扇形。
- `handOffsetFraction` 在 `count > 1` 時恆為 `0`（最左張）到 `1`（最右張）。
- `arcYRatio` 恆為 `0`（集中握點放射扇形，不再使用人工 U 型上下位移）。所有牌卡 pivot 位於同一水平線。
- `fanZIndex = round((1 − |normOffset|) × 5)`，中央牌最高（5），兩側遞減至 0。
- 容器採用 `left: calc(cardWidth × safetyRatio + 2px)` + `width: calc(cardWidth × fanTrackRatio)` 緊密軌道。

### 5.5 與 bottom-hand 分離

- `bottom-hand` 仍使用既有的 `fanX` / `fanY` / `fanRotation`（線性水平間距 + 二次曲線垂直 + 線性旋轉），公式位於 `BattleRow.tsx` 現有手牌迴圈。
- `top-hand` 的 `safetyInset` / `handOffsetFraction` / `opponentAngle` 為獨立計算路徑，兩者互不干擾。
- `top-hand` 不使用 `--fan-x` / `--fan-y` / `--fan-rotation`；`bottom-hand` 不使用 `--safety-inset` / `--hand-offset-fraction` / `--opponent-angle`。

## 6. 邊界條件

### 6.1 手牌數量

- **0 張**：不渲染任何 `.hand-card-wrap`，容器為空。
- **1 張**：`opponentAngle = 0`、`opponentArcY = 0`、`safetyInset = 2`。牌卡以 `.single-card` 修飾類別強制 `left: 50%`（軌道水平置中，無旋轉）。
- **2 張以上**：依公式計算。各牌在安全軌道內由左至右排列。

### 6.2 最左張位置保證（核心）

以最左張 `index = 0`、`handOffsetFraction = 0`、負角度 `−maxAngle` 推導。

1. CSS `left: 0`（`calc(100% × 0)`）使卡牌未旋轉左緣貼齊容器安全軌道之左邊界。
2. 容器左邊界距 `.support-zone` 左邊界 = `var(--safe)` px（`inset-inline` 內縮）。
3. 正常寬度下 `var(--safe) = safetyInset = leftOverhang + 2`（未觸發 `clamp()` 限縮）。
4. 旋轉後，卡牌最左可視點位於未旋轉左緣之左方 `leftOverhang` px（第 5.2 節公式 4 推導）。
5. 可視左緣距 `.support-zone` 左邊界 = `(leftOverhang + 2) − leftOverhang = 2` px。

→ 最左張旋轉後可視左緣貼齊 `.support-zone` 左邊界（內縮 2px safety padding）。

上述推導以 `var(--safe) = safetyInset`（即容器可用寬度 ≥ `2 × safetyInset`，`clamp()` 未限縮）為前提。若容器可用寬度 < `2 × safetyInset`，`clamp()` 將 `--safe` 限縮但不保證可視左緣不越界 —— 此為本專案不支援的幾何退化條件（見 6.3 節）。

### 6.3 支援視窗與退化條件

- 本專案支援視窗範圍：**600×338 以上**（見 AGENTS.md 瀏覽器驗證解析度清單）。
- `.field-stack` 在 `section.battle-row` 內佔中間彈性欄（`minmax(0, 1fr)`），600px 視窗下其可用寬度 ≧ 400px。最大 `safetyInset = 62.7` px（count ≥ 2），遠小於最小可用寬度之半，公式前提（容器可用寬度 ≥ `2 × safetyInset`）在支援範圍內恆成立。
- 若容器可用寬度 < `2 × safetyInset`（例如視窗 < ~120px 或極端窄版 sidebar 佔據大量空間），則 `clamp()` 僅避免 CSS 軌道負寬，不保證可視左緣不越界；此為不支援的幾何退化條件。Playwright 應在各支援解析度下量測左界（見 8.3 節），確認未觸發此退化。
- `clamp(0px, …, 50%)` 目的為防止 `inset-inline` 接收負值（CSS 無效），非保證左邊界。

### 6.4 右側邊界

- 使用者硬性需求僅有左邊界（最左張不越過 `.support-zone` 左界）。
- `inset-inline` 對左右側施以相同內距 `var(--safe)`，提供對稱的安全軌道。此為視覺對稱設計，非硬性右側保證。
- 當手牌極多或容器極窄時，最右張可能部分延伸至 `.support-zone` 右側之外。
- 驗收階段需檢查最右張（或整體扇形）不遮蔽對戰關鍵區域（break zone、combat zone、utility zones）。

### 6.5 無互動

- `pointer-events: none` 禁止所有滑鼠、觸控、聚焦事件。
- `onClick`、`onSelectHandCard` 等 handler 在 `isOpponent` 時傳入 `undefined`。
- `.is-selected` class 在 `isOpponent === true` 時不加入。

### 6.6 響應式

- 支援視窗 600×338 以上：扇形佈局依同一套 CSS `%` + `inset-inline` + `clamp()` 機制自動適配，無需額外 media query（容器高度在窄矮版可縮減但不改變扇形公式）。左邊界保證在此範圍內成立（見 6.3 節）。
- `top-hand` 與 `bottom-hand` 不同步縮放；`bottom-hand` 仍維持其既有響應式行為。

## 7. 驗收標準

- [ ] 對手手牌在畫面左上角以牌背扇形展開，最左張旋轉後可視左緣距 `.support-zone` 左邊界 ≤ 4px（即 2px padding ± 浮點／subpixel 容差）。
- [ ] 手牌 2 張以上時，中間牌最高、兩側牌依序降低並外偏；各牌之間有可視的水平間距（由左向右排列）。
- [ ] 手牌 1 張時水平居中無旋轉（`.single-card`，`left: 50%`）。
- [ ] 手牌 0 張時不顯示任何卡牌元素。
- [ ] 對手牌無法 hover、無法點擊、無法選取、無任何互動效果。
- [ ] 對手牌一律顯示牌背，不顯示牌面。
- [ ] 手牌增加時，扇形張角與水平間距自動壓縮（count ≥ 6 起 arcSpan 收窄，handOffsetFraction 步進遞減）。
- [ ] 我方手牌（`.bottom-hand`）的互動、選取、hover 與動作按鈕不受影響，現有 `fanX`/`fanY`/`fanRotation` 公式行為不變。
- [ ] 在 600×338 ~ 1920×1080 範圍內，最左張不越過 `.support-zone` 左邊界。
- [ ] 扇形整體（含最右張）不遮蔽 break zone、combat zone 或 utility zones 的關鍵互動元素。
- [ ] 無垂直捲軸或內容溢出。
- [ ] `.bottom-hand .hand-card-wrap:hover` 等 hover/selected 規則不影響 `.top-hand` 內的卡片。

## 8. 測試規劃

### 8.1 單元測試（純函式）

- 驗證 `opponentAngle` 計算：`count = 1..8` 時各 index 的角度值符合第 5.3 節。
- 驗證 `arcSpan` 計算：`count = 1 → 0`、`count ≥ 2 → 50`。
- 驗證 `maxAngle`：`count ≥ 2 → 25`。
- 驗證 `leftOverhang` 公式：以 `W=112, H=156` 輸入，各 count 輸出符合第 5.3 節數值（容許浮點 ±0.2）。
  - `count ≥ 2, maxAngle = 25° → leftOverhang ≈ 60.7`
  - `count = 1 → leftOverhang = 0`
- 驗證 `safetyInset = leftOverhang + 2`：各 count 輸出符合第 5.3 節。
- 驗證 `handOffsetFraction`：`count > 1` 時最左張為 0、最右張為 1、中間等距遞增。
- 驗證 `arcYRatio` 恆為 `0`（集中握點放射扇形，無 U 型弧深）。
- 驗證 `fanTrackRatio = 0.25 × (count − 1)`（count ≥ 2），相鄰 pivot 位移約 0.25 卡寬。
- 驗證 `count = 0` 時不渲染任何 `.hand-card-wrap`。
- 驗證 `isOpponent = true` 時 `onClick` handler 為 `undefined`，`.is-selected` class 不加入。
- 驗證 `bottom-hand` 的 `fanX`/`fanY`/`fanRotation` 公式不受影響。

### 8.2 CSS custom property 驗證

- 渲染對手手牌後，檢查 `.hand-fan.top-hand` 元素 `style` 中 `--safety-inset` 設定值與公式輸出 `safetyInset` 一致。
- 檢查每張 `.hand-card-wrap.opponent-hand-card` 的 `--hand-offset-fraction`、`--opponent-angle`、`--arc-y-ratio`、`--fan-z-index` 與公式輸出一致（`--arc-y-ratio` 恆為 0）。
- 檢查 `count = 1` 時元素帶有 `.single-card` class 且無旋轉 transform。
- 檢查 transform 字串為 `translateY(0px) rotate(…deg)` 順序。

### 8.3 瀏覽器驗證（Playwright）

- 指定種子產生 5 張對手手牌的場面，截圖確認扇形位置、水平排列與外觀。
- 測量最左張 `getBoundingClientRect()` 的 left 值，與 `.support-zone` 的 `getBoundingClientRect().left` 的差值 ≤ 4px（容許 subpixel）。
- 對手手牌 hover 時無任何 CSS 變化（無 scale、無 translate、無 filter 變更）。
- 對手牌上方點擊不觸發任何事件。
- 測量最右張右側未覆蓋 break zone、combat zone 關鍵元素（以 `getBoundingClientRect` 交集判斷）。
- 響應式斷點（600px、900px、1920px 等）確認最左張位置未越界。
- `.bottom-hand` 卡片 hover 仍正常放大、selected 仍正常高亮。
