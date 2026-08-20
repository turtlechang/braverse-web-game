import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import officialBS4Dataset from '../data/cards/official-age-of-heroes-and-kingdoms-bs4.en.json'
import {
  convertOfficialAttackEffects,
  convertOfficialCookieSkill,
  convertOfficialFlipAbility,
  convertOfficialItemAbility,
  convertOfficialStageAbility,
  convertOfficialTrapAbility,
} from '../src/cards/official-effect-adapter'
import type { OfficialCardRecord } from '../src/cards/types'

export const DEFAULT_BS4_EFFECT_COVERAGE_OUTPUT =
  'docs/bs4-effect-coverage.md'

export interface Bs4EffectCoverageEntry {
  cardNumber: string
  name: string
  type: OfficialCardRecord['type']
  color: string | null
  primaryConversion: 'supported' | 'no-effect-text' | 'unsupported-effect-text'
  abilityConversion: 'not-applicable' | 'converted' | 'pending'
  hasAttackThen: boolean
  attackThenConversion: 'not-applicable' | 'converted' | 'pending'
}

export interface Bs4EffectCoverageReport {
  baseCardCount: number
  primaryConversion: Record<Bs4EffectCoverageEntry['primaryConversion'], number>
  abilityConversion: Record<
    Bs4EffectCoverageEntry['abilityConversion'],
    number
  >
  attackThen: {
    total: number
    converted: number
    pendingCardNumbers: string[]
  }
  pendingAbilityCards: Bs4EffectCoverageEntry[]
  entries: Bs4EffectCoverageEntry[]
}

const compareCardNumber = (left: string, right: string) =>
  left.localeCompare(right, 'en')

const hasAttackThen = (card: OfficialCardRecord) =>
  (card.type === 'cookie' || card.type === 'flip') &&
  /\bThen\b/i.test(card.attackText ?? '')

const getEffectText = (card: OfficialCardRecord): string | null => {
  if (card.type === 'cookie') return card.skill.text
  if (card.type === 'flip') return card.flipText
  return card.attackText
}

const getAbilityConversion = (
  card: OfficialCardRecord,
): Bs4EffectCoverageEntry['abilityConversion'] => {
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

const increment = <Key extends string>(counts: Record<Key, number>, key: Key) => {
  counts[key] += 1
}

// Match the runtime's specialised conversion path. A generic CardEffect-only
// probe incorrectly reports supported Item, Trap, Stage, FLIP, and Cookie
// abilities as pending.
const getPrimaryConversion = (
  card: OfficialCardRecord,
  abilityConversion: Bs4EffectCoverageEntry['abilityConversion'],
): Bs4EffectCoverageEntry['primaryConversion'] => {
  if (!getEffectText(card)) return 'no-effect-text'
  return abilityConversion === 'converted'
    ? 'supported'
    : 'unsupported-effect-text'
}

export const analyzeBs4EffectCoverage = (
  cards: OfficialCardRecord[],
): Bs4EffectCoverageReport => {
  const baseCards = cards
    .filter((card) => card.cardNumber === card.baseCardNumber)
    .sort((left, right) => compareCardNumber(left.cardNumber, right.cardNumber))
  const primaryConversion = {
    supported: 0,
    'no-effect-text': 0,
    'unsupported-effect-text': 0,
  }
  const abilityConversion = {
    'not-applicable': 0,
    converted: 0,
    pending: 0,
  }

  const entries = baseCards.map((card) => {
    const abilityStatus = getAbilityConversion(card)
    const primaryStatus = getPrimaryConversion(card, abilityStatus)
    const attackThen = hasAttackThen(card)
    const attackThenStatus = attackThen
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
      primaryConversion: primaryStatus,
      abilityConversion: abilityStatus,
      hasAttackThen: attackThen,
      attackThenConversion: attackThenStatus,
    } satisfies Bs4EffectCoverageEntry
  })

  const attackThenEntries = entries.filter((entry) => entry.hasAttackThen)

  return {
    baseCardCount: baseCards.length,
    primaryConversion,
    abilityConversion,
    attackThen: {
      total: attackThenEntries.length,
      converted: attackThenEntries.filter(
        (entry) => entry.attackThenConversion === 'converted',
      ).length,
      pendingCardNumbers: attackThenEntries
        .filter((entry) => entry.attackThenConversion === 'pending')
        .map((entry) => entry.cardNumber),
    },
    pendingAbilityCards: entries.filter(
      (entry) => entry.abilityConversion === 'pending',
    ),
    entries,
  }
}

const tableRows = (entries: Bs4EffectCoverageEntry[]) =>
  entries
    .map(
      (entry) =>
        `| ${entry.cardNumber} | ${entry.type} | ${entry.name} | ${entry.color ?? '—'} |`,
    )
    .join('\n')

export const createBs4EffectCoverageMarkdown = (
  report: Bs4EffectCoverageReport,
) => `# BS4 效果轉接覆蓋盤點

> 以 \`npm run cards:analyze:bs4-candidate\` 重新生成。
>
> 此文件只追蹤 runtime adapter 的轉接狀態；BS4 已於 2026-08-03 promote 至 \`data/cards/\`，本報表依正式卡池資料產生，不取代 \`validate:cards\` 的正式卡池驗證。

## 摘要

| 項目 | 數量 |
| --- | ---: |
| BS4 基礎卡 | ${report.baseCardCount} |
| 主要效果文字已轉接 | ${report.primaryConversion.supported} |
| 主要效果文字待轉接 | ${report.primaryConversion['unsupported-effect-text']} |
| 沒有效果文字 | ${report.primaryConversion['no-effect-text']} |
| 額外能力來源已轉接 | ${report.abilityConversion.converted} |
| 額外能力來源待轉接 | ${report.abilityConversion.pending} |
| 攻擊 \`Then\` 已轉接 | ${report.attackThen.converted}／${report.attackThen.total} |

## 攻擊 \`Then\` 待轉接

${report.attackThen.pendingCardNumbers.length > 0 ? report.attackThen.pendingCardNumbers.join(', ') : '無'}

## 額外能力來源待轉接

| 卡號 | 類型 | 卡名 | 顏色 |
| --- | --- | --- | --- |
${tableRows(report.pendingAbilityCards) || '| — | — | — | — |'}

## 使用方式

1. 先依此盤點選擇可由既有 runtime 表達的一小批卡牌。
2. 涉及附著、未知標記或新狀態區的卡牌保持候選，先確認官方規則後另開引擎切片。
3. BS4 已完成首次 promote；後續新增或更新的 BS4 資料仍須先以 \`inventory\` 候選隔離，完成 runtime 轉接與嚴格驗證後才可 promote。
`

export const writeBs4EffectCoverage = async (
  output = DEFAULT_BS4_EFFECT_COVERAGE_OUTPUT,
) => {
  const report = analyzeBs4EffectCoverage(
    officialBS4Dataset.cards as OfficialCardRecord[],
  )
  const markdown = createBs4EffectCoverageMarkdown(report)
  const outputPath = resolve(output)

  await writeFile(outputPath, markdown, 'utf8')
  return { outputPath, report }
}

const isDirectExecution =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  try {
    const { outputPath, report } = await writeBs4EffectCoverage()
    console.log(
      `BS4 效果覆蓋盤點：${report.baseCardCount} 張基礎卡，攻擊 Then ${report.attackThen.converted}/${report.attackThen.total} 已轉接。`,
    )
    console.log(`已更新 ${outputPath}`)
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}
