import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeOfficialCardBehavior } from '../src/cards/contracts/ledger'
import {
  analyzeBs6EffectCoverage,
  type Bs6EffectCoverageReport,
} from './analyze-bs6-effect-coverage'
import type { OfficialCardRecord } from '../src/cards/types'

export const DEFAULT_BS11_CANDIDATE_INPUT =
  'data/candidates/official-dark-enchantress-war-bs11.en.json'
export const DEFAULT_BS11_OFFICIAL_INPUT =
  'data/cards/official-dark-enchantress-war-bs11.en.json'
export const DEFAULT_BS11_INVENTORY_OUTPUT = 'docs/bs11-card-inventory.md'
export const DEFAULT_BS11_EFFECT_COVERAGE_OUTPUT =
  'docs/bs11-effect-coverage.md'

export type Bs11EffectCoverageReport = Bs6EffectCoverageReport

type CandidateDocument = {
  source: {
    datasetUrl: string
    fetchedAt: string
    candidateStatus?: string
    importedCount: number
    matchedAvailable: number
    totalAvailable: number
    imagesDownloaded: boolean
  }
  cards: OfficialCardRecord[]
}

const compareText = (left: string, right: string) =>
  left.localeCompare(right, 'en')

const isPromotedSource = (input: string) =>
  resolve(input).replaceAll('\\', '/').toLowerCase().includes('/data/cards/')

const escape = (value: string | null | undefined) =>
  (value ?? '無')
    .replaceAll('|', '\\|')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replace(/\r?\n/g, '<br>')

const countRows = (values: Array<string | null | undefined>) => {
  const counts = new Map<string, number>()
  for (const value of values) {
    const label = value ?? '無'
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([label, count]) => `| ${escape(label)} | ${count} |`)
    .join('\n')
}

const baseCardNumbers = (cards: OfficialCardRecord[]) =>
  [...new Set(cards.map((card) => card.baseCardNumber))].sort(compareText)

const strictAudits = (cards: OfficialCardRecord[]) =>
  cards.map((card) => {
    try {
      const audit = analyzeOfficialCardBehavior(card)
      return { card, status: audit.contract.status, errors: audit.errors }
    } catch (error) {
      return {
        card,
        status: 'blocked',
        errors: [
          `契約分析失敗：${error instanceof Error ? error.message : String(error)}`,
        ],
      }
    }
  })

const readBs11CandidateDocument = async (
  input = DEFAULT_BS11_CANDIDATE_INPUT,
): Promise<CandidateDocument> => {
  const document = JSON.parse(await readFile(resolve(input), 'utf8')) as CandidateDocument
  if (!document || !Array.isArray(document.cards) || !document.source) {
    throw new Error(`BS11 候選資料格式錯誤：${input}`)
  }
  return document
}

export const analyzeBs11EffectCoverage = (
  cards: OfficialCardRecord[],
): Bs11EffectCoverageReport => analyzeBs6EffectCoverage(cards)

export const createBs11InventoryMarkdown = ({
  document,
  input = DEFAULT_BS11_CANDIDATE_INPUT,
  audits,
}: {
  document: CandidateDocument
  input?: string
  audits: ReturnType<typeof strictAudits>
}) => {
  const { cards, source } = document
  const promoted = isPromotedSource(input)
  const bases = baseCardNumbers(cards)
  const variants = cards.filter(
    (card) => card.cardNumber !== card.baseCardNumber,
  )
  const baseRecords = cards.filter(
    (card) => card.cardNumber === card.baseCardNumber,
  )
  const variantOnly = bases.filter(
    (base) => !baseRecords.some((card) => card.baseCardNumber === base),
  )
  const strictCounts = audits.reduce<Record<string, number>>((counts, audit) => {
    counts[audit.status] = (counts[audit.status] ?? 0) + 1
    return counts
  }, {})

  return `# BS11 The Dark Enchantress War 卡牌盤點（${promoted ? '正式卡池' : '候選資料'}）

來源：[官方英文卡表](${source.datasetUrl})。抓取時間：${source.fetchedAt}。
由 \`npm run cards:analyze:bs11-candidate\` 產生；${promoted ? '官方資料已位於正式卡池' : `候選狀態：\`${source.candidateStatus ?? 'inventory'}\``}；原始文字與卡圖 URL 保留於 \`${input}\`。下表逐筆列出技能、攻擊與 FLIP 文字（含印刷變體）；實作轉接狀態見 [BS11 轉接覆蓋盤點](bs11-effect-coverage.md)。此靜態盤點不取代逐卡卡圖、Browser、正式牌組或 online 驗收。

## 來源與數量

| 項目 | 數量 |
| --- | ---: |
| 官方資料總數 | ${source.totalAvailable} |
| BS11 匹配記錄 | ${source.matchedAvailable} |
| ${promoted ? '正式卡池記錄' : '匯入候選記錄'} | ${cards.length} |
| 不同基礎卡號 | ${bases.length} |
| 基礎記錄 | ${baseRecords.length} |
| 變體記錄 | ${variants.length} |
| 僅有變體的基礎卡號 | ${variantOnly.length}（${variantOnly.join(', ') || '無'}） |
| 卡圖下載 | ${source.imagesDownloaded ? '是' : '否；保留官方 URL'} |

## 卡片類型

| 類型 | 筆數 |
| --- | ---: |
${countRows(cards.map((card) => card.type))}

## 顏色

| 顏色 | 筆數 |
| --- | ---: |
${countRows(cards.map((card) => card.color))}

## 官方產品

| 官方產品 | 筆數 |
| --- | ---: |
${countRows(cards.map((card) => card.product.title))}

## Strict contract 靜態狀態

| 狀態 | 筆數 |
| --- | ---: |
${Object.entries(strictCounts)
  .sort(([left], [right]) => compareText(left, right))
  .map(([status, count]) => `| ${status} | ${count} |`)
  .join('\n')}

## ${promoted ? '全部正式來源記錄' : '全部候選記錄'}

| 卡號 | 基礎卡號 | 卡名 | 類型 | 顏色 | 技能 | 攻擊 | FLIP | 官方卡圖 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${cards
  .slice()
  .sort((left, right) => compareText(left.cardNumber, right.cardNumber))
  .map(
    (card) =>
      `| ${card.cardNumber} | ${card.baseCardNumber} | ${escape(card.name)} | ${card.type} | ${escape(card.color)} | ${escape(card.skill.text)} | ${escape(card.attackText)} | ${escape(card.flipText)} | [卡圖](${card.imageUrl}) |`,
  )
  .join('\n')}

## 資料與驗收界線

- ${promoted ? '正式卡池位置只證明資料已 promote，不代表每張卡的正式牌組或 online 流程都已驗收。' : '`inventory` 只代表官方資料已隔離保存與結構驗證，不代表 runtime、卡圖語意或正式卡池已完成。'}
- \`needs-review\`／\`blocked\` 的卡號與缺口必須在 adapter、規則與逐卡 Browser A/B 前保留，不能用猜測文字或數值補齊。
- 所有變體仍需逐筆核對卡圖；基本卡與變體不能僅因卡號相同就共用語意案例。
`
}

export const createBs11EffectCoverageMarkdown = (
  report: Bs11EffectCoverageReport,
  audits: ReturnType<typeof strictAudits>,
  input = DEFAULT_BS11_CANDIDATE_INPUT,
) => {
  const promoted = isPromotedSource(input)
  const pendingRows = (entries: Bs11EffectCoverageReport['entries']) =>
    entries.length === 0
      ? '| 無 | - | - | - | - |'
      : entries
          .map(
            (entry) =>
              `| ${entry.cardNumber} | ${escape(entry.color)} | ${entry.type} | ${escape(entry.name)} | ${escape(entry.effectText)} |`,
          )
          .join('\n')
  const strictRows = audits
    .filter((audit) => audit.status !== 'verified')
    .map(
      ({ card, status, errors }) =>
        `| ${card.cardNumber} | ${status} | ${escape(errors.join('; ') || '無靜態錯誤')} |`,
    )
    .join('\n') || '| 無 | verified | 無 |'

  return `# BS11 轉接覆蓋盤點（${promoted ? '正式卡池' : '候選資料'}）

由 \`npm run cards:analyze:bs11-candidate\` 產生。逐筆卡面技能、攻擊與 FLIP 原文（159 筆記錄含 43 個變體）見 [BS11 卡牌盤點](bs11-card-inventory.md)；下表列出 116 張基礎卡的主效果、額外能力與攻擊 Then 轉接狀態。這是靜態 runtime 轉接盤點，不取代逐卡卡圖、Browser、正式牌組或 online 驗收；${promoted ? '正式卡池中的 BS11 記錄仍須分層回報其瀏覽器、牌組與 online 證據。' : '候選維持 `inventory`，不得由本報告推導 promote。'}

## 摘要

| 項目 | 數量 |
| --- | ---: |
| BS11 基礎卡 | ${report.baseCardCount} |
| 主效果已轉接 | ${report.primaryConversion.supported} |
| 主效果沒有文字 | ${report.primaryConversion['no-effect-text']} |
| 主效果待轉接 | ${report.primaryConversion['unsupported-effect-text']} |
| 額外能力已轉接 | ${report.abilityConversion.converted} |
| 額外能力待轉接 | ${report.abilityConversion.pending} |
| 攻擊 Then 已轉接 | ${report.attackThen.converted} / ${report.attackThen.total} |

## 逐色稽核矩陣

| 顏色 | 基礎卡 | 主效果待轉接 | 額外能力待轉接 | 攻擊 Then 待轉接 |
| --- | ---: | ---: | ---: | ---: |
${Object.entries(report.byColor)
  .sort(([left], [right]) => compareText(left, right))
  .map(
    ([color, coverage]) =>
      `| ${color} | ${coverage.total} | ${coverage.primaryUnsupported} | ${coverage.abilityPending} | ${coverage.attackThenPending} |`,
  )
  .join('\n')}

## 主效果待轉接

| 卡號 | 顏色 | 類型 | 卡名 | 卡面文字 |
| --- | --- | --- | --- | --- |
${pendingRows(report.primaryUnsupportedCards)}

## 額外能力待轉接

| 卡號 | 顏色 | 類型 | 卡名 | 卡面文字 |
| --- | --- | --- | --- | --- |
${pendingRows(report.pendingAbilityCards)}

## 攻擊 Then 待轉接

| 卡號 | 顏色 | 類型 | 卡名 | 卡面文字 |
| --- | --- | --- | --- | --- |
${pendingRows(report.pendingAttackThenCards)}

## Strict contract 非 verified

| 卡號 | 狀態 | 缺口 |
| --- | --- | --- |
${strictRows}

## 基礎卡 parser 盤點

| 卡號 | 主效果 | 額外能力 | 攻擊 Then |
| --- | --- | --- | --- |
${report.entries
  .map(
    (entry) =>
      `| ${entry.cardNumber} | ${entry.primaryConversion} | ${entry.abilityConversion} | ${entry.attackThenConversion} |`,
  )
  .join('\n')}

## 後續門檻

${promoted
  ? '1. 官方來源更新時先重新匯入候選區，再完成卡圖、契約、規則與逐卡 Browser 驗證。\n2. 轉接變更同步補規則／adapter 回歸測試及必要的合法／不合法操作路徑。\n3. 正式牌組與 online 驗收仍是獨立證據層。'
  : '1. 先逐筆查看官方卡圖，確認卡號、變體、費用、代價、目標、時機與 Then，再補 exact adapter。\n2. 每個新增效果補規則／adapter 回歸測試；必要時保留合法與不合法操作路徑。\n3. 完成 strict contract、逐卡 Browser A/B、正式牌組與 online 證據，且經明確授權後，才可考慮 promote.'}
`
}

export const writeBs11EffectCoverage = async ({
  input = DEFAULT_BS11_CANDIDATE_INPUT,
  inventoryOutput = DEFAULT_BS11_INVENTORY_OUTPUT,
  effectCoverageOutput = DEFAULT_BS11_EFFECT_COVERAGE_OUTPUT,
} = {}) => {
  const document = await readBs11CandidateDocument(input)
  const report = analyzeBs11EffectCoverage(document.cards)
  const audits = strictAudits(document.cards)
  await writeFile(
    resolve(inventoryOutput),
    createBs11InventoryMarkdown({ document, input, audits }),
    'utf8',
  )
  await writeFile(
    resolve(effectCoverageOutput),
    createBs11EffectCoverageMarkdown(report, audits, input),
    'utf8',
  )
  return { document, report, audits }
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  try {
    const input = existsSync(resolve(DEFAULT_BS11_CANDIDATE_INPUT))
      ? DEFAULT_BS11_CANDIDATE_INPUT
      : existsSync(resolve(DEFAULT_BS11_OFFICIAL_INPUT))
        ? DEFAULT_BS11_OFFICIAL_INPUT
        : undefined
    if (!input) {
      throw new Error(
        `找不到 BS11 候選或正式資料：${DEFAULT_BS11_CANDIDATE_INPUT} / ${DEFAULT_BS11_OFFICIAL_INPUT}`,
      )
    }
    const { document, report, audits } = await writeBs11EffectCoverage({ input })
    const strict = audits.reduce<Record<string, number>>((counts, audit) => {
      counts[audit.status] = (counts[audit.status] ?? 0) + 1
      return counts
    }, {})
    console.log(
      JSON.stringify(
        {
          records: document.cards.length,
          baseCards: report.baseCardCount,
          primary: report.primaryConversion,
          abilities: report.abilityConversion,
          attackThen: report.attackThen,
          strict,
        },
        null,
        2,
      ),
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
