import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  convertOfficialAttackEffects,
  convertOfficialCookieSkill,
  convertOfficialFlipAbility,
  convertOfficialItemAbility,
  convertOfficialStageAbility,
  convertOfficialTrapAbility,
} from '../src/cards/official-effect-adapter'
import { normalizeOfficialCardRecord } from '../src/cards/official-card-adapter'
import type { OfficialCardRecord } from '../src/cards/types'

export const DEFAULT_BS6_FORMAL_INPUT =
  'data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json'
export const DEFAULT_BS6_EFFECT_COVERAGE_OUTPUT =
  'docs/bs6-effect-coverage.md'

type PrimaryConversion =
  | 'supported'
  | 'no-effect-text'
  | 'unsupported-effect-text'
type AbilityConversion = 'not-applicable' | 'converted' | 'pending'
type AttackThenConversion = 'not-applicable' | 'converted' | 'pending'

export interface Bs6EffectCoverageEntry {
  cardNumber: string
  name: string
  type: OfficialCardRecord['type']
  color: string | null
  effectText: string | null
  attackThenText: string | null
  primaryConversion: PrimaryConversion
  abilityConversion: AbilityConversion
  hasAttackThen: boolean
  attackThenConversion: AttackThenConversion
}

export interface Bs6ColorCoverage {
  total: number
  primaryUnsupported: number
  abilityPending: number
  attackThenPending: number
}

export interface Bs6EffectCoverageReport {
  baseCardCount: number
  primaryConversion: Record<PrimaryConversion, number>
  abilityConversion: Record<AbilityConversion, number>
  attackThen: {
    total: number
    converted: number
    pendingCardNumbers: string[]
  }
  byColor: Record<string, Bs6ColorCoverage>
  primaryUnsupportedCards: Bs6EffectCoverageEntry[]
  pendingAbilityCards: Bs6EffectCoverageEntry[]
  pendingAttackThenCards: Bs6EffectCoverageEntry[]
  entries: Bs6EffectCoverageEntry[]
}

const compareCardNumber = (left: string, right: string) =>
  left.localeCompare(right, 'en')

const getEffectText = (card: OfficialCardRecord): string | null => {
  if (card.type === 'cookie') return card.skill.text
  if (card.type === 'flip') return card.flipText
  return card.attackText
}

const hasAttackThen = (card: OfficialCardRecord) =>
  (card.type === 'cookie' || card.type === 'flip') &&
  /\bThen\b/i.test(card.attackText ?? '')

const getAbilityConversion = (
  card: OfficialCardRecord,
): AbilityConversion => {
  if (card.type === 'cookie') {
    if (!card.skill.text) return 'not-applicable'
    return convertOfficialCookieSkill(card) ? 'converted' : 'pending'
  }

  if (card.type === 'flip') {
    if (!card.flipText) return 'not-applicable'
    return convertOfficialFlipAbility(card) ? 'converted' : 'pending'
  }

  if (!card.attackText) return 'not-applicable'

  const ability =
    card.type === 'item'
      ? convertOfficialItemAbility(card)
      : card.type === 'stage'
        ? convertOfficialStageAbility(card)
        : card.type === 'trap'
          ? convertOfficialTrapAbility(card)
          : undefined

  return ability ? 'converted' : 'pending'
}

// The generic converter intentionally only understands CardEffect arrays.  A
// Trap, Item, or Stage also needs its specialised adapter for cost, timing,
// and activation conditions, so use the same public conversion path as the
// runtime when reporting the primary effect's coverage.
const getPrimaryConversion = (
  card: OfficialCardRecord,
  abilityConversion: AbilityConversion,
): PrimaryConversion => {
  if (!getEffectText(card)) return 'no-effect-text'
  return abilityConversion === 'converted'
    ? 'supported'
    : 'unsupported-effect-text'
}

const increment = <Key extends string>(counts: Record<Key, number>, key: Key) => {
  counts[key] += 1
}

const colorLabel = (color: string | null) => color ?? 'COLORLESS'

const toColorCoverage = (entries: Bs6EffectCoverageEntry[]) => {
  const byColor: Record<string, Bs6ColorCoverage> = {}
  for (const entry of entries) {
    const color = colorLabel(entry.color)
    const current = byColor[color] ?? {
      total: 0,
      primaryUnsupported: 0,
      abilityPending: 0,
      attackThenPending: 0,
    }
    current.total += 1
    if (entry.primaryConversion === 'unsupported-effect-text') {
      current.primaryUnsupported += 1
    }
    if (entry.abilityConversion === 'pending') current.abilityPending += 1
    if (entry.attackThenConversion === 'pending') current.attackThenPending += 1
    byColor[color] = current
  }
  return Object.fromEntries(
    Object.entries(byColor).sort(([left], [right]) =>
      left.localeCompare(right, 'en'),
    ),
  )
}

export const analyzeBs6EffectCoverage = (
  cards: OfficialCardRecord[],
): Bs6EffectCoverageReport => {
  // 官方偶爾只提供異圖記錄（BS6-091），不能只篩無 @ 的本體卡號。
  // 每個 baseCardNumber 優先取真正基礎記錄；若不存在，取排序最前的變體作為
  // 代表卡，讓卡號層級覆蓋盤點不漏卡。
  const baseCards = [...cards]
    .sort((left, right) => {
      const baseCompare = compareCardNumber(left.baseCardNumber, right.baseCardNumber)
      if (baseCompare !== 0) return baseCompare
      const leftIsBase = left.cardNumber === left.baseCardNumber ? 0 : 1
      const rightIsBase = right.cardNumber === right.baseCardNumber ? 0 : 1
      return leftIsBase - rightIsBase || compareCardNumber(left.cardNumber, right.cardNumber)
    })
    .filter(
      (card, index, sortedCards) =>
        index === 0 || card.baseCardNumber !== sortedCards[index - 1]!.baseCardNumber,
    )
    .map(normalizeOfficialCardRecord)
    .sort((left, right) => compareCardNumber(left.cardNumber, right.cardNumber))
  const primaryConversion: Record<PrimaryConversion, number> = {
    supported: 0,
    'no-effect-text': 0,
    'unsupported-effect-text': 0,
  }
  const abilityConversion: Record<AbilityConversion, number> = {
    'not-applicable': 0,
    converted: 0,
    pending: 0,
  }

  const entries = baseCards.map((card) => {
    const abilityStatus = getAbilityConversion(card)
    const primaryStatus = getPrimaryConversion(card, abilityStatus)
    const attackThen = hasAttackThen(card)
    const attackThenStatus: AttackThenConversion = attackThen
      ? convertOfficialAttackEffects(card)
        ? 'converted'
        : 'pending'
      : 'not-applicable'

    increment(primaryConversion, primaryStatus)
    increment(abilityConversion, abilityStatus)

    return {
      cardNumber: card.cardNumber,
      name: card.name,
      type: card.type,
      color: card.color,
      effectText: getEffectText(card),
      attackThenText: attackThen ? card.attackText : null,
      primaryConversion: primaryStatus,
      abilityConversion: abilityStatus,
      hasAttackThen: attackThen,
      attackThenConversion: attackThenStatus,
    } satisfies Bs6EffectCoverageEntry
  })
  const attackThenEntries = entries.filter((entry) => entry.hasAttackThen)
  const primaryUnsupportedCards = entries.filter(
    (entry) => entry.primaryConversion === 'unsupported-effect-text',
  )
  const pendingAbilityCards = entries.filter(
    (entry) => entry.abilityConversion === 'pending',
  )
  const pendingAttackThenCards = attackThenEntries.filter(
    (entry) => entry.attackThenConversion === 'pending',
  )

  return {
    baseCardCount: baseCards.length,
    primaryConversion,
    abilityConversion,
    attackThen: {
      total: attackThenEntries.length,
      converted: attackThenEntries.filter(
        (entry) => entry.attackThenConversion === 'converted',
      ).length,
      pendingCardNumbers: pendingAttackThenCards.map(
        (entry) => entry.cardNumber,
      ),
    },
    byColor: toColorCoverage(entries),
    primaryUnsupportedCards,
    pendingAbilityCards,
    pendingAttackThenCards,
    entries,
  }
}

const markdownCode = (value: string) =>
  String.fromCharCode(96) + value + String.fromCharCode(96)

const tableRows = (entries: Bs6EffectCoverageEntry[]) =>
  entries
    .map(
      (entry) =>
        `| ${entry.cardNumber} | ${entry.color ?? 'COLORLESS'} | ${entry.type} | ${entry.name.replaceAll('|', '\\|')} | ${(entry.effectText ?? '無效果文字').replaceAll('|', '\\|')} |`,
    )
    .join('\n')

const colorRows = (byColor: Record<string, Bs6ColorCoverage>) =>
  Object.entries(byColor)
    .map(
      ([color, coverage]) =>
        `| ${color} | ${coverage.total} | ${coverage.primaryUnsupported} | ${coverage.abilityPending} | ${coverage.attackThenPending} |`,
    )
    .join('\n')

const pendingAttackThenTable = (entries: Bs6EffectCoverageEntry[]) =>
  entries
    .map(
      (entry) =>
        `| ${entry.cardNumber} | ${entry.color ?? 'COLORLESS'} | ${entry.type} | ${entry.name.replaceAll('|', '\\|')} | ${(entry.attackThenText ?? entry.effectText ?? '?').replaceAll('|', '\\|')} |`,
    )
    .join('\n') || '| - | - | - | - | - |'

const pendingTable = (entries: Bs6EffectCoverageEntry[]) =>
  tableRows(entries) || '| 無 | - | - | - | - |'

export const createBs6EffectCoverageMarkdown = (
  report: Bs6EffectCoverageReport,
) => `# BS6 效果轉接覆蓋盤點（正式卡池）

> 由 ${markdownCode('npm run cards:analyze:bs6')} 產生。資料來源是 ${markdownCode(DEFAULT_BS6_FORMAL_INPUT)}；本報告只標示 runtime 轉接現況，Browser 證據另見 BS6 Browser 稽核報告。

## 摘要

| 項目 | 數量 |
| --- | ---: |
| BS6 基礎卡 | ${report.baseCardCount} |
| 主效果已轉接 | ${report.primaryConversion.supported} |
| 主效果沒有文字 | ${report.primaryConversion['no-effect-text']} |
| 主效果待轉接 | ${report.primaryConversion['unsupported-effect-text']} |
| 額外能力已轉接 | ${report.abilityConversion.converted} |
| 額外能力待轉接 | ${report.abilityConversion.pending} |
| 攻擊 Then 已轉接 | ${report.attackThen.converted} / ${report.attackThen.total} |

## 逐色稽核矩陣

| 顏色 | 基礎卡 | 主效果待轉接 | 額外能力待轉接 | 攻擊 Then 待轉接 |
| --- | ---: | ---: | ---: | ---: |
${colorRows(report.byColor)}

## 主效果待轉接

| 卡號 | 顏色 | 類型 | 卡名 | 卡面文字 |
| --- | --- | --- | --- | --- |
${pendingTable(report.primaryUnsupportedCards)}

## 額外能力待轉接

| 卡號 | 顏色 | 類型 | 卡名 | 卡面文字 |
| --- | --- | --- | --- | --- |
${pendingTable(report.pendingAbilityCards)}

## 攻擊 Then 待轉接

| 卡號 | 顏色 | 類型 | 卡名 | 卡面文字 |
| --- | --- | --- | --- | --- |
${pendingAttackThenTable(report.pendingAttackThenCards)}

## 後續維護門檻

1. 官方資料更新時，先重新匯入候選資料並逐色檢查新增或變更的效果。
2. 對每個新增效果補齊 adapter、規則、UI 與合法／不合法路徑回歸測試。
3. 在正式對戰狀態以 Chrome 完成支付、代價、目標、Then、FLIP／TRAP 與錯誤路徑稽核後，才可再次 promote。
`

export const readBs6FormalCards = async (
  input = DEFAULT_BS6_FORMAL_INPUT,
): Promise<OfficialCardRecord[]> => {
  const payload: unknown = JSON.parse(await readFile(resolve(input), 'utf8'))
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.cards)) {
    throw new Error(`BS6 正式卡池資料格式錯誤：${input}`)
  }
  return payload.cards as OfficialCardRecord[]
}

export const writeBs6EffectCoverage = async ({
  input = DEFAULT_BS6_FORMAL_INPUT,
  output = DEFAULT_BS6_EFFECT_COVERAGE_OUTPUT,
} = {}) => {
  const report = analyzeBs6EffectCoverage(await readBs6FormalCards(input))
  const outputPath = resolve(output)
  await writeFile(outputPath, createBs6EffectCoverageMarkdown(report), 'utf8')
  return { outputPath, report }
}

const isDirectExecution =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  try {
    const { outputPath, report } = await writeBs6EffectCoverage()
    console.log(
      `BS6 效果覆蓋盤點：${report.baseCardCount} 張基礎卡，主效果待轉接 ${report.primaryConversion['unsupported-effect-text']}，攻擊 Then ${report.attackThen.converted}/${report.attackThen.total} 已轉接。`,
    )
    console.log(`已更新 ${outputPath}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
