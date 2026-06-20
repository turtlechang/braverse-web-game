# 對手手牌扇形 + Phase Rail 按鈕尺寸 實作計畫

> 日期：2026-06-19
> 規格：`docs/superpowers/specs/2026-06-19-opponent-hand-fan-design.md`、`docs/superpowers/specs/2026-06-19-phase-rail-next-button-size-design.md`
> 狀態：已執行（2026-06-19 第二次派工：撲克牌共用握點放射扇形）

---

## REQUIRED SUB-SKILL

`develop-braverse` — 依 Braverse 專案規範執行 TDD、Git 收尾與文件同步。

---

## 前置條件

- 工作區為 dirty worktree，存在未提交變更：`src/components/battle/BattleRow.tsx`、`src/components/battle/BattleRow.css`。
- 本計畫**不 commit**；使用者未要求提交。
- 保留既有未提交變更，允許在任務範圍內改寫其錯誤手牌實作。
- 不碰其他未追蹤檔（`_tmp_vitest.json`、`docs/codex-app-workflow.html`、`scripts/test-metrics.mjs`、`docs/superpowers/` 下其他檔案）。

---

## 涉及檔案

| 檔案 | 動作 |
|---|---|
| `src/components/battle/BattleRow.test.tsx` | 新增測試（RED → GREEN） |
| `src/components/battle/BattleRow.tsx` | 改寫對手手牌計算與 JSX |
| `src/components/battle/BattleRow.css` | 改寫 `.top-hand` 容器定位、`.opponent-hand-card` 定位、hover/selected 作用域 |
| `src/components/layout/PhaseRail.css` | 新增 `grid-row` 指定與 `max-width: 900px` 重設 |
| `scripts/ai-browser-validation.mjs` | 新增 1538×578 量測段落（對手最左卡 left、下一步按鈕高度） |

---

## 步驟 0：確認 RED — 寫會因現況失敗的測試

### 0.1 純函式測試（BattleRow.test.tsx）

在 `src/components/battle/BattleRow.test.tsx` 新增 `describe('opponent hand fan pure functions')` 區塊。因扇形計算邏輯目前內嵌於 `BattleRow.tsx` render 迴圈中，需先將其抽出為可獨立匯入的純函式。

**抽出純函式**：在 `src/components/battle/opponentFan.ts` 定義並匯出：

```ts
export const CARD_W = 112
export const CARD_H = 156

export function computeOpponentFan(count: number, index: number) {
  const arcSpan = count <= 1 ? 0 : 50
  const centerIndex = (count - 1) / 2
  const opponentAngle = count <= 1 ? 0 : (index - centerIndex) * (arcSpan / (count - 1))
  const maxAngle = count <= 1 ? 0 : arcSpan / 2
  const a = maxAngle * Math.PI / 180
  const leftOverhang = count <= 1 ? 0 : Math.max(0, CARD_H * Math.sin(a) - (CARD_W / 2) * (1 - Math.cos(a)))
  const safetyInset = leftOverhang + 2
  const safetyRatio = count <= 1 ? 0 : leftOverhang / CARD_W
  const fanTrackRatio = count <= 1 ? 1 : 0.25 * (count - 1)
  const handOffsetFraction = count <= 1 ? 0 : index / (count - 1)
  const arcYRatio = 0
  const maxNorm = (count - 1) / 2 || 1
  const normOffset = count <= 1 ? 0 : (index - centerIndex) / maxNorm
  const fanZIndex = count <= 1 ? 0 : Math.round((1 - Math.abs(normOffset)) * 5)
  return { arcSpan, opponentAngle, maxAngle, leftOverhang, safetyInset, safetyRatio, fanTrackRatio, handOffsetFraction, arcYRatio, fanZIndex }
}
```

**新增測試項目**（在 `BattleRow.test.tsx`）：

```ts
import { computeOpponentFan, CARD_W, CARD_H } from './opponentFan'

describe('opponent hand fan pure functions', () => {
  it('count=1: angle=0, arcYRatio=0, fanTrackRatio=1, safetyInset=2, fanZIndex=0', () => {
    const r = computeOpponentFan(1, 0)
    expect(r.opponentAngle).toBe(0)
    expect(r.arcYRatio).toBe(0)
    expect(r.fanTrackRatio).toBe(1)
    expect(r.safetyInset).toBe(2)
    expect(r.fanZIndex).toBe(0)
    expect(r.handOffsetFraction).toBe(0)
    expect(r.arcSpan).toBe(0)
  })

  it('edges arcYRatio=0, center arcYRatio=0, symmetric angles ±25° for count=3', () => {
    const r0 = computeOpponentFan(3, 0)    // left edge
    const r1 = computeOpponentFan(3, 1)    // center
    const r2 = computeOpponentFan(3, 2)    // right edge
    expect(r0.arcYRatio).toBe(0)
    expect(r1.arcYRatio).toBe(0)
    expect(r2.arcYRatio).toBe(0)
    expect(r0.opponentAngle).toBeCloseTo(-25, 0)
    expect(r2.opponentAngle).toBeCloseTo(25, 0)
    expect(r1.opponentAngle).toBe(0)
  })

  it('count=2: arcSpan=50, maxAngle=25, fanTrackRatio=0.25', () => {
    const r0 = computeOpponentFan(2, 0)
    expect(r0.arcSpan).toBe(50)
    expect(r0.maxAngle).toBe(25)
    expect(r0.fanTrackRatio).toBeCloseTo(0.25, 1)
    expect(r0.opponentAngle).toBeCloseTo(-25, 0)
    expect(r0.handOffsetFraction).toBe(0)
  })

  it('count=5: maxAngle=25, fanTrackRatio=1, leftOverhang≈61', () => {
    const r = computeOpponentFan(5, 0)
    expect(r.maxAngle).toBe(25)
    expect(r.fanTrackRatio).toBeCloseTo(1, 1)
    expect(r.leftOverhang).toBeCloseTo(61, 0)
    expect(r.safetyInset).toBeCloseTo(63, 0)
  })

  it('fanTrackRatio yields adjacent anchor spacing ≈0.25 card-width', () => {
    for (const count of [3, 4, 5, 7, 10]) {
      const fan = computeOpponentFan(count, 0)
      const step = fan.fanTrackRatio / (count - 1)
      expect(step).toBeCloseTo(0.25, 5)
    }
  })

  it('center fanZIndex > edge fanZIndex', () => {
    const r0 = computeOpponentFan(5, 0)    // edge
    const r1 = computeOpponentFan(5, 1)    // mid-edge
    const r2 = computeOpponentFan(5, 2)    // center
    expect(r2.fanZIndex).toBe(5)
    expect(r2.fanZIndex).toBeGreaterThan(r1.fanZIndex)
    expect(r2.fanZIndex).toBeGreaterThan(r0.fanZIndex)
    expect(r0.fanZIndex).toBe(0)
  })
})
```

### 0.2 JSX 渲染測試（BattleRow.test.tsx）

在 `describe('BattleRow desktop interactions')` 新增：

```ts
it('renders opponent hand cards with opponent-hand-card class and no onClick', () => {
  const game = createItemUsageDemoState(true)
  const opponentHand = Array.from({ length: 3 }, (_, i) => ({
    id: `opp-${i}`,
    instanceId: `opp-${i}`,
    name: `對手牌${i}`,
    type: 'cookie' as const,
    hp: 3,
    attack: 2,
    speed: 1,
    energyCost: { red: 1 },
    skill: undefined,
  }))
  const gameWithOppHand = {
    ...game,
    players: {
      ...game.players,
      'player-two': {
        ...game.players['player-two'],
        hand: opponentHand,
      },
    },
  }
  const markup = renderToStaticMarkup(
    <BattleRow
      {...createProps({
        game: gameWithOppHand,
        playerId: 'player-two',
        position: 'top',
      })}
    />,
  )
  expect(markup).toContain('opponent-hand-card')
  expect(markup).not.toContain('hand-card-actions')
})

it('does not add is-selected class to opponent hand cards', () => {
  const game = createItemUsageDemoState(true)
  const markup = renderToStaticMarkup(
    <BattleRow
      {...createProps({
        game,
        position: 'top',
        selectedHandCardId: game.players['player-one'].hand[0]?.instanceId ?? 'none',
      })}
    />,
  )
  const topHandMatch = markup.match(/top-hand[\s\S]*?(?=<\/div>\s*<\/section>)/)
  if (topHandMatch) {
    expect(topHandMatch[0]).not.toContain('is-selected')
  }
})

it('sets --safety-inset on .hand-fan.top-hand container', () => {
  const game = createItemUsageDemoState(true)
  const opponentHand = Array.from({ length: 3 }, (_, i) => ({
    id: `opp-${i}`,
    instanceId: `opp-${i}`,
    name: `對手牌${i}`,
    type: 'cookie' as const,
    hp: 3,
    attack: 2,
    speed: 1,
    energyCost: { red: 1 },
    skill: undefined,
  }))
  const gameWithOppHand = {
    ...game,
    players: {
      ...game.players,
      'player-two': {
        ...game.players['player-two'],
        hand: opponentHand,
      },
    },
  }
  const markup = renderToStaticMarkup(
    <BattleRow
      {...createProps({
        game: gameWithOppHand,
        playerId: 'player-two',
        position: 'top',
      })}
    />,
  )
  expect(markup).toContain('--safety-inset')
  expect(markup).toContain('--hand-offset-fraction')
})

it('renders .single-card class when opponent has exactly 1 hand card', () => {
  const game = createItemUsageDemoState(true)
  const singleCard = [{
    id: 'opp-single',
    instanceId: 'opp-single',
    name: '單張',
    type: 'cookie' as const,
    hp: 3,
    attack: 2,
    speed: 1,
    energyCost: { red: 1 },
    skill: undefined,
  }]
  const gameWithOppHand = {
    ...game,
    players: {
      ...game.players,
      'player-two': {
        ...game.players['player-two'],
        hand: singleCard,
      },
    },
  }
  const markup = renderToStaticMarkup(
    <BattleRow
      {...createProps({
        game: gameWithOppHand,
        playerId: 'player-two',
        position: 'top',
      })}
    />,
  )
  expect(markup).toContain('single-card')
})

it('renders no hand-card-wrap when opponent has 0 hand cards', () => {
  const game = createItemUsageDemoState(true)
  const gameWithEmptyHand = {
    ...game,
    players: {
      ...game.players,
      'player-two': {
        ...game.players['player-two'],
        hand: [],
      },
    },
  }
  const markup = renderToStaticMarkup(
    <BattleRow
      {...createProps({
        game: gameWithEmptyHand,
        playerId: 'player-two',
        position: 'top',
      })}
    />,
  )
  const topHandMatch = markup.match(/top-hand[^>]*>([\s\S]*?)<\/div>/)
  if (topHandMatch) {
    expect(topHandMatch[1]).not.toContain('hand-card-wrap')
  }
})
```

### 0.3 執行測試確認 RED

```powershell
npm test -- --run src/components/battle/BattleRow.test.tsx
```

預期：上述新增測試全部失敗（RED），因為：
- `computeOpponentFan` 尚未匯出（或不存在）
- `--safety-inset`、`--hand-offset-fraction` 尚未設定於 JSX
- `.single-card` class 尚未加入
- 對手手牌 count≥6 時 arcSpan 未壓縮（現況固定 30）

---

## 步驟 1：GREEN — 改寫 BattleRow.tsx 對手手牌計算

### 1.1 抽出純函式

新建 `src/components/battle/opponentFan.ts`：

```ts
export const CARD_W = 112
export const CARD_H = 156

export interface OpponentFanResult {
  arcSpan: number
  opponentAngle: number
  maxAngle: number
  leftOverhang: number
  safetyInset: number
  safetyRatio: number
  handOffsetFraction: number
  arcYRatio: number
  fanZIndex: number
}

export function computeOpponentFan(count: number, index: number): OpponentFanResult {
  const arcSpan = count <= 1 ? 0 : 50
  const centerIndex = (count - 1) / 2
  const opponentAngle = count <= 1 ? 0 : (index - centerIndex) * (arcSpan / (count - 1))
  const maxAngle = count <= 1 ? 0 : arcSpan / 2
  const a = maxAngle * Math.PI / 180
  const leftOverhang =
    count <= 1 ? 0 : Math.max(0, CARD_H * Math.sin(a) - (CARD_W / 2) * (1 - Math.cos(a)))
  const safetyInset = leftOverhang + 2
  const safetyRatio = count <= 1 ? 0 : leftOverhang / CARD_W
  const handOffsetFraction = count <= 1 ? 0 : index / (count - 1)
  const arcYRatio = 0
  return { arcSpan, opponentAngle, maxAngle, leftOverhang, safetyInset, safetyRatio, handOffsetFraction, arcYRatio, fanZIndex }
}
```

### 1.2 改寫 BattleRow.tsx 手牌迴圈

在 `BattleRow.tsx` 中：

1. 匯入 `computeOpponentFan`。
2. 在 `player.hand.map(...)` 迴圈外計算 `count = player.hand.length` 與 `safetyInset`（僅 `isOpponent` 時）。
3. 在 `.hand-fan.top-hand` 容器元素上設定 `style={{ '--safety-inset': \`${safetyInset}px\` }}`。
4. 在每張 `.hand-card-wrap` 上：
   - `isOpponent` 時加入 `opponent-hand-card` class。
   - `isOpponent && count === 1` 時額外加入 `single-card` class。
   - `isOpponent` 時設定 `--hand-offset-fraction`、`--opponent-angle`、`--opponent-arc-y`。
   - `isOpponent` 時不加入 `is-selected` class。
   - `isOpponent` 時 `onClick` 為 `undefined`。
5. 移除既有錯誤的 `opponentAngle` / `opponentArcY` 內嵌計算（現況使用 `offset * (30 / (count - 1))`，未處理 count≥6 壓縮）。
6. 將 `.hand-fan.top-hand` DOM 節點從 `section.battle-row` 的直接子層移入 `.field-stack` 內部（在 `{position === 'top' && supportZone}` 之後或 `.combat-zone` 之前）。

**容器移動**：

目前 `.hand-fan.${position}-hand` 在 `</section>` 前渲染（line 472–582）。需將 `top-hand` 的渲染位置移入 `.field-stack` 區塊內（line 251–369 之間），使 `.field-stack` 成為其 positioned 祖先。

具體改動：
- 在 `.field-stack` 內部（`{position === 'top' && supportZone}` 之後），條件渲染 `top-hand` 容器。
- 原 `section` 尾部的 `.hand-fan` 迴圈保留給 `bottom-hand`；`top-hand` 不再在此處渲染。

### 1.3 執行測試確認 GREEN

```powershell
npm test -- --run src/components/battle/BattleRow.test.tsx
```

預期：所有新增測試通過。

---

## 步驟 2：GREEN — 改寫 BattleRow.css

### 2.1 容器定位（移入 `.field-stack`）

```css
.field-stack {
  position: relative;
}

.field-stack > .hand-fan.top-hand {
  position: absolute;
  inset: 0;
  --safe: clamp(0px, var(--safety-inset), 50%);
  inset-inline: var(--safe);
  height: 140px;
  pointer-events: none;
  z-index: 10;
}
```

移除既有 `.hand-fan.top-hand` 的 `left: 16px` / `right: auto` / `width: min(500px, calc(100% - 32px))` 規則（包含所有 container query 內的覆蓋）。

### 2.2 單張卡牌定位

```css
.hand-card-wrap.opponent-hand-card {
  position: absolute;
  bottom: 0;
  pointer-events: none;
  transform-origin: center bottom;
  transition: none;
  left: calc(100% * var(--hand-offset-fraction));
  transform:
    translateY(var(--opponent-arc-y))
    rotate(var(--opponent-angle));
}

.hand-card-wrap.opponent-hand-card.single-card {
  left: 50%;
  transform: none;
}
```

移除既有 `.hand-card-wrap.opponent-hand-card` 的 `left: 50%` / `translateX(-50%)` / `transform-origin: top center` 規則。

移除既有 `.top-hand .hand-card-wrap` 的 `transform` 覆蓋（line 655–661）。

### 2.3 hover/selected 作用域限定

```css
.bottom-hand .hand-card-wrap:hover,
.bottom-hand .hand-card-wrap:focus-within {
  z-index: 50;
  filter: brightness(1.08);
  transform: translateX(calc(-50% + var(--fan-x))) translateY(-20px) rotate(0deg) scale(1.05);
}

.bottom-hand .hand-card-wrap.is-selected {
  z-index: 60;
  filter:
    drop-shadow(0 0 10px rgba(255, 236, 104, 0.85))
    brightness(1.1);
  transform: translateX(calc(-50% + var(--fan-x))) translateY(-28px) rotate(0deg) scale(1.07);
}
```

移除既有未限定 `.bottom-hand` 的 `.hand-card-wrap:hover` / `.hand-card-wrap.is-selected` 規則。

### 2.4 清理 container query 內的 top-hand 覆蓋

移除所有 `@container` 區塊中 `.hand-fan.top-hand` 的 `left: 16px` / `width: min(500px, ...)` 覆蓋（出現在 `min-width: 1500px`、`max-height: 720px`、`max-width: 1200px`、`max-width: 900px`、`max-width: 900px and max-height: 400px` 等區塊）。

保留 `.hand-fan.bottom-hand` 在各 container query 內的覆蓋不變。

### 2.5 執行測試確認 GREEN

```powershell
npm test -- --run
```

---

## 步驟 3：GREEN — 改寫 PhaseRail.css

### 3.1 基礎 `grid-row` 指定

在 `PhaseRail.css` 中新增：

```css
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

注意：`.brand-mark`、`.turn-indicator`、`.turn-counter` 已有基礎規則，在既有規則中補上 `grid-row`。`.phase-rail ol` 與 `.next-phase-button` 同理。

### 3.2 `max-width: 900px` 重設

在現有 `@container game-shell (max-width: 900px)` 區塊內新增：

```css
.brand-mark,
.turn-indicator,
.phase-rail ol,
.next-phase-button,
.turn-counter {
  grid-row: 1;
}
```

### 3.3 執行測試確認 GREEN

```powershell
npm test -- --run
```

---

## 步驟 4：Playwright 量測（1538×578）

### 4.1 修改 `scripts/ai-browser-validation.mjs`

在 viewport 迴圈前或內新增 1538×578 專屬量測段落：

```js
// 1538×578 專屬量測
await page.setViewportSize({ width: 1538, height: 578 })
await page.waitForTimeout(200)

const phaseMetrics = await page.evaluate(() => {
  const button = document.querySelector('.next-phase-button')
  const ol = document.querySelector('.phase-rail ol')
  if (!(button instanceof HTMLElement) || !(ol instanceof HTMLElement)) {
    throw new Error('找不到 next-phase-button 或 phase-rail ol')
  }
  return {
    buttonHeight: button.getBoundingClientRect().height,
    olHeight: ol.getBoundingClientRect().height,
  }
})

assert(phaseMetrics.buttonHeight >= 40 && phaseMetrics.buttonHeight <= 48,
  `next-phase-button height ${phaseMetrics.buttonHeight} not in 44±4px range`)
assert(phaseMetrics.olHeight > phaseMetrics.buttonHeight,
  `ol height ${phaseMetrics.olHeight} should exceed button height ${phaseMetrics.buttonHeight}`)

const fanMetrics = await page.evaluate(() => {
  const topHandCards = document.querySelectorAll('.top-hand .hand-card-wrap')
  const supportZone = document.querySelector('.top-field .support-zone')
  if (topHandCards.length === 0) return { skipped: true }
  if (!(supportZone instanceof HTMLElement)) throw new Error('找不到 support-zone')
  const supportLeft = supportZone.getBoundingClientRect().left
  const leftmostCard = topHandCards[0]
  if (!(leftmostCard instanceof HTMLElement)) throw new Error('找不到最左張')
  const cardLeft = leftmostCard.getBoundingClientRect().left
  return {
    supportLeft,
    cardLeft,
    diff: cardLeft - supportLeft,
  }
})

if (!fanMetrics.skipped) {
  assert(fanMetrics.cardLeft >= fanMetrics.supportLeft,
    `最左卡 left ${fanMetrics.cardLeft} < support-zone left ${fanMetrics.supportLeft}`)
  assert(fanMetrics.diff <= 4,
    `最左卡 left - support-zone left = ${fanMetrics.diff}px > 4px`)
}
```

### 4.2 執行 Playwright 驗證

```powershell
npm run build
npm run test:ai:browser
```

---

## 步驟 5：多解析度檢查

### 5.1 600×338 檢查

在 viewport 迴圈內（既有 600×338 量測段落），確認：
- `.top-hand` 最左卡 `getBoundingClientRect().left >= .top-field .support-zone` 的 `left`。
- `.phase-rail` 無溢出（`document.documentElement.scrollHeight <= window.innerHeight`）。
- 無垂直捲軸（`document.documentElement.scrollHeight <= window.innerHeight`）。

### 5.2 1920×1080 檢查

在 viewport 迴圈內（既有 1920×1080 量測段落），確認：
- `.next-phase-button` 高度不超過 80px（無 `grid-row` 錯位影響）。
- `.top-hand` 最左卡位置未越界。

### 5.3 全解析度迴圈

既有 viewport 清單（1920×1080 → 600×338）已涵蓋所有支援解析度。在每個解析度下量測：
- `topHandLeftmostCard.left >= topSupportZone.left`
- `topHandLeftmostCard.left - topSupportZone.left <= 4`
- `document.documentElement.scrollHeight <= window.innerHeight`（無垂直捲軸）

---

## 步驟 6：Lint + Build + Full Test

```powershell
npm run lint
npm run build
npm test -- --run
```

全部通過即完成。

---

## 驗證矩陣

| 項目 | 命令 | 預期 |
|---|---|---|
| 純函式 RED | `npm test -- --run src/components/battle/BattleRow.test.tsx`（步驟 0.3） | 新增測試失敗 |
| JSX RED | 同上 | 新增測試失敗 |
| 純函式 GREEN | `npm test -- --run src/components/battle/BattleRow.test.tsx`（步驟 1.3） | 全部通過 |
| CSS GREEN | `npm test -- --run`（步驟 2.5） | 全部通過 |
| PhaseRail GREEN | `npm test -- --run`（步驟 3.3） | 全部通過 |
| Playwright 1538×578 | `npm run build; npm run test:ai:browser`（步驟 4.2） | 按鈕 40–48px、最左卡 diff ≤ 4px |
| 600×338 | 同上（步驟 5.1） | 無溢出、無垂直捲軸、左界未越 |
| 1920×1080 | 同上（步驟 5.2） | 按鈕 ≤ 80px、左界未越 |
| Lint | `npm run lint`（步驟 6） | 0 errors |
| Build | `npm run build`（步驟 6） | 成功 |
| Full test | `npm test -- --run`（步驟 6） | 全部通過 |

---

## 風險與邊界

- **既有未提交變更**：`BattleRow.tsx` 與 `BattleRow.css` 已有部分對手手牌實作（`opponent-hand-card` class、`--opponent-angle`、`--opponent-arc-y`）。本計畫在其基礎上改寫，不還原無關變更。
- **container query 覆蓋**：`BattleRow.css` 在 6 個 `@container` 區塊中均有 `.hand-fan.top-hand` 的 `left: 16px` 覆蓋。全部移除，改由 `.field-stack > .hand-fan.top-hand` 的 `inset-inline` 統一處理。
- **`bottom-hand` 不變**：所有改動僅影響 `.top-hand` 與 `.opponent-hand-card`。`.bottom-hand` 的 `fanX`/`fanY`/`fanRotation` 公式、hover、selected、container query 覆蓋均保持不變。
- **PhaseRail.css 僅新增 `grid-row`**：不改變 grid 結構、container query 斷點、gap/padding。
- **不 commit**：使用者未要求提交。
