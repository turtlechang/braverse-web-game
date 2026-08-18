/* 由 data/flip-card-inventory.json 產生 docs/flip-card-audit-matrix.md（含敘述段）。 */
import { readFileSync, writeFileSync } from 'node:fs'

interface InventoryEntry {
  base: string
  name: string
  color: string | null
  type: string
  flipText: string
  runtimeFlipEffectKinds: string[]
  runtimeFlipEffectCount: number
  runtimeAttachedHpBonus: number | null
  runtimeFlipText: string | null
}

const inv = JSON.parse(readFileSync('data/flip-card-inventory.json', 'utf8')) as { cards: InventoryEntry[] }
const cards: InventoryEntry[] = inv.cards
const FIXED = new Set(['P-099'])
const VANILLA = new Set(['BS2-042', 'P-047'])

const classify = (c: InventoryEntry): { status: string; note: string } => {
  if (FIXED.has(c.base)) return { status: '已修正', note: '本 session：官方把抽 1 FLIP 效果併進 attackText，已拆回 flipText' }
  const hasFlip =
    c.runtimeFlipEffectCount > 0 ||
    (c.runtimeAttachedHpBonus ?? 0) > 0 ||
    Boolean(c.runtimeFlipText)
  if (!hasFlip) {
    if (VANILLA.has(c.base))
      return c.base === 'BS2-042'
        ? { status: '無效果', note: 'flipText 為空，人工已核無效果文字' }
        : { status: '無效果', note: 'flipText 為空，P_EXACT 故意留空效果' }
    return { status: '誤計為FLIP', note: 'cookie/變體 flipText 重複攻擊名或欄位錯置，runtime 無 FlipAbility，但 deck 計數計為 FLIP' }
  }
  return { status: '效果通過', note: '' }
}

const kindsLabel = (c: InventoryEntry): string => {
  const kinds = c.runtimeFlipEffectKinds.join('+')
  const bonus = c.runtimeAttachedHpBonus ? '附著+HP' : ''
  return [kinds, bonus].filter(Boolean).join(' ') || '（無效果）'
}

const rows: string[] = []
const meta = new Map<string, { status: string }>()
for (const c of cards) {
  const { status, note } = classify(c)
  meta.set(c.base, { status })
  const flipText = (c.flipText || '（空）').replace(/\|/g, '/')
  rows.push(`| ${c.base} | ${c.name} | ${c.color ?? ''} | ${flipText} | ${kindsLabel(c)} | ${c.runtimeFlipEffectCount} | ${status}${note ? ' — ' + note : ''} |`)
}

// 依系列
interface SeriesStat { total: number; ok: number; fixed: number; vanilla: number; miscount: number }
const bySeries = new Map<string, SeriesStat>()
for (const c of cards) {
  const series = c.base.split('-')[0] ?? '?'
  const stat = bySeries.get(series) ?? { total: 0, ok: 0, fixed: 0, vanilla: 0, miscount: 0 }
  stat.total += 1
  const status = meta.get(c.base)?.status ?? ''
  if (status === '效果通過') stat.ok += 1
  else if (status === '已修正') stat.fixed += 1
  else if (status === '無效果') stat.vanilla += 1
  else stat.miscount += 1
  bySeries.set(series, stat)
}
const summaryLines = ['| 系列 | FLIP 基礎卡數 | 效果通過 | 已修正 | 無效果 | 誤計為FLIP |', '| --- | ---: | ---: | ---: | ---: | ---: |']
const seriesTotals = { ok: 0, fixed: 0, vanilla: 0, miscount: 0 }
for (const [series, stat] of [...bySeries].sort((a, b) => a[0].localeCompare(b[0]))) {
  summaryLines.push(`| ${series} | ${stat.total} | ${stat.ok} | ${stat.fixed} | ${stat.vanilla} | ${stat.miscount} |`)
  seriesTotals.ok += stat.ok
  seriesTotals.fixed += stat.fixed
  seriesTotals.vanilla += stat.vanilla
  seriesTotals.miscount += stat.miscount
}
summaryLines.push(`| **合計** | **${cards.length}** | ${seriesTotals.ok} | ${seriesTotals.fixed} | ${seriesTotals.vanilla} | ${seriesTotals.miscount} |`)

// 依顏色
interface ColorStat { total: number; ok: number; fixed: number; vanilla: number; miscount: number }
const colorNames: Record<string, string> = { RED: '紅', YELLOW: '黃', GREEN: '綠', BLUE: '藍', PURPLE: '紫', BLACK: '黑', WILD: '萬用' }
const byColor = new Map<string, ColorStat>()
for (const c of cards) {
  const color = (c.color ?? '?').toUpperCase()
  const stat = byColor.get(color) ?? { total: 0, ok: 0, fixed: 0, vanilla: 0, miscount: 0 }
  stat.total += 1
  const status = meta.get(c.base)?.status ?? ''
  if (status === '效果通過') stat.ok += 1
  else if (status === '已修正') stat.fixed += 1
  else if (status === '無效果') stat.vanilla += 1
  else stat.miscount += 1
  byColor.set(color, stat)
}
const colorLines = ['| 顏色 | 基礎卡總數 | 效果通過 | 已修正 | 無效果 | 誤計為FLIP |', '| --- | ---: | ---: | ---: | ---: | ---: |']
for (const [color, stat] of [...byColor].sort((a, b) => a[0].localeCompare(b[0]))) {
  colorLines.push(`| ${colorNames[color] ?? color} | ${stat.total} | ${stat.ok} | ${stat.fixed} | ${stat.vanilla} | ${stat.miscount} |`)
}
colorLines.push(`| 合計 | ${cards.length} | ${seriesTotals.ok} | ${seriesTotals.fixed} | ${seriesTotals.vanilla} | ${seriesTotals.miscount} |`)

const vanillaNames = cards.filter((c) => VANILLA.has(c.base)).map((c) => `${c.base} ${c.name}`).join('、') || '—'

const md = `# FLIP 卡稽核矩陣

> 產生：scripts/inventory-flip-cards.ts → data/flip-card-inventory.json → scripts/generate-flip-matrix.ts → 本表。稽核單位＝去除 @ 變體的基礎卡號（保留被 deck 計為 FLIP 的記錄）。

## 摘要（依系列）

${summaryLines.join('\n')}

## 非「效果通過」清單

- 已修正：P-099（本 session 拆回 FLIP 文字，見下方 Bug 紀錄）。
- 無效果：${vanillaNames}（官方 flipText 為空的 vanilla FLIP，翻開時自動進棄牌、不開決策窗）。

## 驗證方法（2026-08-18 session）

1. **靜態轉接稽核**：scripts/inventory-flip-cards.ts 逐張從官方卡池轉接 runtime FlipAbility，核對 flipText／代價／效果 kinds／attachedHpBonus，產出 data/flip-card-inventory.json（114 張 FLIP 基礎卡）。
2. **引擎層正式對戰驗證**（scripts/verify-flip-kinds.ts，tsc→CJS→node 對實際轉換卡執行 resolveNextDamage／resolveFlip）：每種 FLIP 效果 kind 以真實卡驗證「翻開→開啟 flip 決策窗→發動後正確結算」：draw-up-to（BS3-004）、gain-hp＋棄牌代價（BS3-012）、attachedHpBonus（BS6-069）、damage 選對手（BS1-002）、flip-to-break＋break-to-hand（BS4-031）、flip-to-support 休息（BS1-067）、choose-one（BS4-102）；P-099 修正後翻開停在 flip 決策窗、發動抽 1 張、翻開卡進棄牌區。全通過。
3. **既有單元測試**（本 session 以無沙箱模式跑過）：battle-faint-queue、ai-turn-decision、bs3-choice-and-cost、official-effect-adapter、official-effect-adapter-bs6 共 303 項通過；battle-pending-flip.test.ts（17 個 FLIP 專屬測試）與 effects-new-mechanics.test.ts（flip-to-support／flip-to-break）為既有 FLIP 情境主測試。
4. **既有瀏覽器正式稽核文件**：docs/bs5-effect-audit-*.json、docs/bs6-effect-audit-*.json、docs/p0xx-effect-audit-*.json 對 .flip-response-modal 記錄 select:flip／confirm:flip／skip:negative-flip，BS5／BS6／P 系列 FLIP 卡全數 PASS。

> 注意：本 session 後段的無沙箱執行權限核准無人回應，未能在本 session 重新執行全量 npm test／npm run build／Playwright 瀏覽器稽核；上列瀏覽器證據來自既有稽核文件，新增回歸測試已加入但未在此 session 重跑。引擎層行為已用編譯管線實際驗證。

## 色別結算

${colorLines.join('\n')}

## Bug 紀錄

\`\`\`text
卡號：P-099 Bell Pepper Cookie（GREEN、FLIP）
重現率：100%（資料層，與牌序無關）
前置狀態與操作步驟：以 P-099 作為 HP 卡被翻開，或點開卡牌詳情：
- 翻開時不會停留 flip 決策窗（revealedHpCard.flip 為 undefined），直接進棄牌；
- Deck editor 的 FLIP 篩選／計數仍把它算作 FLIP 卡。
預期（引用卡面）：官方卡面攻擊文字帶「Draw up to 1 card from your deck.」的 FLIP 效果，翻開時觸發抽 1 張。
實際：官方 API 把 FLIP 效果併進 attackText、flipText 為空；P_EXACT_FLIP_EFFECTS[P-099] 因 flipText 為空而永遠走不到，runtime 無 FlipAbility，FLIP 完全不會觸發，卡牌詳情 FLIP 段空白（與 P-100 修正前同型）。
疑似層級：adapter（official-card-adapter.ts 欄位錯置）
證據：data/flip-card-inventory.json（P-099 修正前 runtimeFlipEffectCount=0）、引擎驗證輸出。
修正：official-card-adapter.ts normalizeOfficialCardRecord 新增 P-099 拆欄，與 P-100 同型。
回歸測試：src/cards/contracts/payment-cost-regression.test.ts（新增 P-099 轉接測試）、src/game/battle-pending-flip.test.ts（新增「P-099 FLIP 開啟決策窗並抽 1 張」測試）。
修正後重測：引擎編譯管線執行該劇本 PASS；全量 vitest 待權限恢復後補跑。
\`\`\`

## 本輪已收尾的其它發現（2026-08-18）

- **誤計為FLIP（21 張）已修正**：hasFlipAbility（src/game/card-pool.ts）改為與 runtime 一致——官方 type: flip 一律算 FLIP，type: cookie 只有在轉接後真的有 FlipAbility（效果或附著加成）才算。P-056～P-069、BS4-004@1、BS5-039@2 等官方 flipText 重複攻擊名的普通餅乾／變體不再計入 Deck editor 的 FLIP 篩選與「FLIP N/16」上限（custom-deck.ts）；FLIP 計數由 144 降至 123、cookie 誤算歸零（P-059 同型、先前已修正過）。
- **gain-hp vs attachedHpBonus 已統一**：convertOfficialFlipAbility 的一般路徑對「The Cookie with this card attached for HP gains +N HP.」改回 attachedHpBonus（附著期間剩餘 HP 連續 +N，getCookieEffectiveHp 一併計算），與 BS5-004／BS6-069 等 exact map 同一語意；BS3-012 等 29 張舊系列卡補回附著期間的隱藏 +1（引擎驗證 1→2）。翻開發動時由 resolveFlip 把加成轉成牌庫頂補 N 張 HP 卡，實戰結算不變（verify-flip-kinds.ts 全 PASS）。

## 待確認／未處理

- **BS2-042 Milk Cookie、P-047 GingerBrave**：官方 flipText 為空。BS2-042 已在 docs/card-review-checklist.md 人工勾核為「無效果文字」；P-047 的 P_EXACT_FLIP_EFFECTS 故意留空效果。兩者翻開時自動進棄牌（不開決策窗），與 vanilla FLIP 一致；hasFlipAbility 仍依官方 type: flip 把它們算入「FLIP N/16」。是否官方卡面確無 FLIP 效果仍待官方來源確認。

## 已知限制

- 本 session 無法重新執行 npm test（全量）／npm run build／Playwright 瀏覽器稽核：無沙箱（danger-full-access）核准後段無人回應，vitest／vite 需 pipe 子程序，受限模式下必然 EPERM。引擎層已用 tsc→CJS→node 編譯管線實際驗證。

## 全部 FLIP 卡

| 卡號 | 名稱 | 顏色 | 官方 flipText | runtime 效果 | 效果數 | 狀態 |
| --- | --- | --- | --- | --- | ---: | --- |
${rows.join('\n')}


`
writeFileSync('docs/flip-card-audit-matrix.md', md)
console.log(summaryLines.join('\n'))
console.log('--- colors ---')
console.log(colorLines.join('\n'))
console.log('written docs/flip-card-audit-matrix.md')
