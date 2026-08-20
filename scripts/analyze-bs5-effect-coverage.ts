import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import officialBs5Dataset from '../data/cards/official-age-of-heroes-and-kingdoms-bs5.en.json'
import {
  convertOfficialAttackEffects,
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
  convertOfficialFlipAbility,
  convertOfficialItemAbility,
  convertOfficialStageAbility,
  convertOfficialTrapAbility,
} from '../src/cards/official-effect-adapter'
import type { OfficialCardRecord } from '../src/cards/types'

export const DEFAULT_BS5_EFFECT_COVERAGE_OUTPUT =
  'docs/bs5-effect-coverage.md'

type PrimaryConversion =
  | 'supported'
  | 'no-effect-text'
  | 'unsupported-effect-text'
type AbilityConversion = 'not-applicable' | 'converted' | 'pending'
type AttackThenConversion = 'not-applicable' | 'converted' | 'pending'

export interface Bs5EffectCoverageEntry {
  cardNumber: string
  name: string
  type: OfficialCardRecord['type']
  color: string | null
  effectText: string | null
  primaryConversion: PrimaryConversion
  abilityConversion: AbilityConversion
  hasAttackThen: boolean
  attackThenConversion: AttackThenConversion
}

export interface Bs5ColorCoverage {
  total: number
  primaryUnsupported: number
  abilityPending: number
  attackThenPending: number
}

export interface Bs5EffectCoverageReport {
  baseCardCount: number
  primaryConversion: Record<PrimaryConversion, number>
  abilityConversion: Record<AbilityConversion, number>
  attackThen: {
    total: number
    converted: number
    pendingCardNumbers: string[]
  }
  byColor: Record<string, Bs5ColorCoverage>
  primaryUnsupportedCards: Bs5EffectCoverageEntry[]
  pendingAbilityCards: Bs5EffectCoverageEntry[]
  pendingAttackThenCards: Bs5EffectCoverageEntry[]
  entries: Bs5EffectCoverageEntry[]
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

const increment = <Key extends string>(counts: Record<Key, number>, key: Key) => {
  counts[key] += 1
}

const colorLabel = (color: string | null) => color ?? 'COLORLESS'

const toColorCoverage = (entries: Bs5EffectCoverageEntry[]) => {
  const byColor: Record<string, Bs5ColorCoverage> = {}
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

export const analyzeBs5EffectCoverage = (
  cards: OfficialCardRecord[],
): Bs5EffectCoverageReport => {
  const baseCards = cards
    .filter((card) => card.cardNumber === card.baseCardNumber)
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
    const primary = convertOfficialCardEffects(card)
    const primaryStatus: PrimaryConversion =
      primary.status === 'supported' ? 'supported' : primary.reason
    const abilityStatus = getAbilityConversion(card)
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
      primaryConversion: primaryStatus,
      abilityConversion: abilityStatus,
      hasAttackThen: attackThen,
      attackThenConversion: attackThenStatus,
    } satisfies Bs5EffectCoverageEntry
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

const tableRows = (entries: Bs5EffectCoverageEntry[]) =>
  entries
    .map(
      (entry) =>
        `| ${entry.cardNumber} | ${entry.color ?? 'COLORLESS'} | ${entry.type} | ${entry.name.replaceAll('|', '\\|')} | ${(entry.effectText ?? '無效果文字').replaceAll('|', '\\|')} |`,
    )
    .join('\n')

const colorRows = (byColor: Record<string, Bs5ColorCoverage>) =>
  Object.entries(byColor)
    .map(
      ([color, coverage]) =>
        `| ${color} | ${coverage.total} | ${coverage.primaryUnsupported} | ${coverage.abilityPending} | ${coverage.attackThenPending} |`,
    )
    .join('\n')

const pendingTable = (entries: Bs5EffectCoverageEntry[]) =>
  tableRows(entries) || '| 無 | - | - | - | - |'

export const createBs5EffectCoverageMarkdown = (
  report: Bs5EffectCoverageReport,
) => `# BS5 效果轉接覆蓋盤點

> 由 ${markdownCode('npm run cards:analyze:bs5-candidate')} 產生。資料來源是 ${markdownCode('data/cards/')} 的 BS5 正式卡池；此報告追蹤 runtime 轉接與 Chrome 稽核狀態。

## 摘要

| 項目 | 數量 |
| --- | ---: |
| BS5 基礎卡 | ${report.baseCardCount} |
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
${pendingTable(report.pendingAttackThenCards)}

## Chrome 實戰驗證（2026-08-06）

| 類別 | 卡號 | 驗證內容 |
| --- | --- | --- |
| 陷阱主效果 | BS5-087、BS5-109 | 實際 Chrome 驗證陷阱支付、攻擊目標、條件成立／不成立與 Then；BS5-087 另驗證抽牌選擇與攻擊結算銜接 |
| 攻擊後 Then | BS5-067、BS5-071、BS5-080、BS5-085、BS5-089、BS5-094、BS5-097、BS5-098、BS5-099、BS5-106 | 實際 Chrome 驗證提示框、支付／代價、目標、可選數量、牌庫／棄牌區變化與 Then 連續結算 |

BS5-098 已補上來源餅乾因支付最後一張 HP 而離場後，仍能建立並完成下一段攻擊後效果的回歸測試。BS5-109 的兩段「最多選擇 1 張對手餅乾」已改用逐效果 effectTargets，離線／線上回應 UI 會依效果段落各自列出合法目標；第一段可選 LV2、第二段可改選另一張 LV1，明確空選擇仍代表略過該段。規則層、command payload 與 Browser trace 均以同一份 selector 驗證。

## Promotion 門檻

1. 本表的三個待轉接區塊皆為 0，且每張卡都有對應單元測試或專用 test-state。
2. 每色均完成 Chrome 的合法與不合法互動路徑，包含支付、代價、目標、選擇、可略過與 Then。
3. BS5 已完成本批次 promote；後續官方更新仍須重新走候選資料、runtime、測試與 Chrome 稽核流程。
`

export const writeBs5EffectCoverage = async (
  output = DEFAULT_BS5_EFFECT_COVERAGE_OUTPUT,
) => {
  const report = analyzeBs5EffectCoverage(
    officialBs5Dataset.cards as OfficialCardRecord[],
  )
  const markdown = createBs5EffectCoverageMarkdown(report)
  const outputPath = resolve(output)

  await writeFile(outputPath, markdown, 'utf8')
  return { outputPath, report }
}

const isDirectExecution =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  try {
    const { outputPath, report } = await writeBs5EffectCoverage()
    console.log(
      `BS5 覆蓋盤點：${report.baseCardCount} 張基礎卡，主效果待轉接 ${report.primaryConversion['unsupported-effect-text']}，能力待轉接 ${report.abilityConversion.pending}，攻擊 Then ${report.attackThen.converted}/${report.attackThen.total}。`,
    )
    console.log(`已寫入 ${outputPath}`)
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}
