import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  analyzeBs6EffectCoverage,
  type Bs6EffectCoverageEntry,
  type Bs6EffectCoverageReport,
} from './analyze-bs6-effect-coverage'
import type { OfficialCardRecord } from '../src/cards/types'

export const DEFAULT_BS8_CANDIDATE_INPUT =
  'data/candidates/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json'
export const DEFAULT_BS8_EFFECT_COVERAGE_OUTPUT = 'docs/bs8-effect-coverage.md'

const tableRows = (entries: Bs6EffectCoverageEntry[]) =>
  entries
    .map(
      (entry) =>
        `| ${entry.cardNumber} | ${entry.color ?? 'COLORLESS'} | ${entry.type} | ${entry.name.replaceAll('|', '\\|')} | ${(entry.effectText ?? '無效果文字').replaceAll('|', '\\|')} |`,
    )
    .join('\n') || '| 無 | - | - | - | - |'

const colorRows = (report: Bs6EffectCoverageReport) =>
  Object.entries(report.byColor)
    .map(
      ([color, coverage]) =>
        `| ${color} | ${coverage.total} | ${coverage.primaryUnsupported} | ${coverage.abilityPending} | ${coverage.attackThenPending} |`,
    )
    .join('\n')

const extraRows = (cards: OfficialCardRecord[]) =>
  cards
    .filter((card) => card.type === 'extra' || card.flags.extra)
    .sort((left, right) => left.cardNumber.localeCompare(right.cardNumber, 'en'))
    .map(
      (card) =>
        `| ${card.cardNumber} | ${(card.color ?? 'COLORLESS').replaceAll('|', '\\|')} | ${card.name.replaceAll('|', '\\|')} | ${(card.skill.text ?? card.attackText ?? card.flipText ?? '無效果文字').replaceAll('|', '\\|')} |`,
    )
    .join('\n') || '| 無 | - | - | - |'

export const createBs8EffectCoverageMarkdown = (
  cards: OfficialCardRecord[],
  report: Bs6EffectCoverageReport,
) => {
  const extraCards = cards.filter((card) => card.type === 'extra' || card.flags.extra)
  return `# BS8 Land of Fire & Ruin, Realm of Apathy 效果覆蓋盤點（候選資料）

> 由 \`npm run cards:analyze:bs8-candidate\` 產生。資料來源是 \`${DEFAULT_BS8_CANDIDATE_INPUT}\`；此報告是 runtime gap inventory，不是 promotion 或 Browser 驗收證據。

## 摘要

| 項目 | 數量 |
| --- | ---: |
| BS8 基礎卡 | ${report.baseCardCount} |
| EXTRA 記錄 | ${extraCards.length} |
| 主效果已轉接 | ${report.primaryConversion.supported} |
| 主效果沒有文字 | ${report.primaryConversion['no-effect-text']} |
| 主效果待轉接 | ${report.primaryConversion['unsupported-effect-text']} |
| 額外能力待轉接 | ${report.abilityConversion.pending} |
| 攻擊 Then 已轉接 | ${report.attackThen.converted} / ${report.attackThen.total} |

## EXTRA 核心規則阻塞

主牌組用的通用 adapter 仍會明確將 \`extra\` 視為 \`unsupported-card-type\`，避免 EXTRA 誤混入 60 張牌組。專用 \`convertOfficialCardToExtraDeckCard\` 已轉接 BS8-005／027／069／090／104，其中 BS8-005／069／090 有核心直接登場 command、戰場私密檢視、攻擊後效果與 localhost-only Browser A/B；Lv.1／Lv.2 也只透過通用合法指令與既有 Cookie 評分使用直接 EXTRA，沒有卡號特判。BS8-027／104 已依官方規則與 FAQ 轉接 Awakened 的覆蓋目標、\`HP+2\`、裝備保留、既有套用效果清除及昏厥區域去向，並有純規則 TDD。已新增明確標記的候選 staging 自訂牌組／六槽編輯器、固定 seed 的 Lv.1–Lv.5 全場 AI gate，以及雙瀏覽器候選線上房驗收（己方可見 EXTRA 卡名、對手僅見張數）。它們不會寫入正式卡池、Standard 房間或正式匯出；基礎卡逐卡 strict contract 與逐卡 Browser gate 仍未全部完成，不得以候選資料存在或 schema 通過作為 promote 依據。

| 卡號 | 顏色 | 卡名 | 官方文字 |
| --- | --- | --- | --- |
${extraRows(cards)}

## 逐色稽核矩陣

| 顏色 | 基礎卡 | 主效果待轉接 | 額外能力待轉接 | 攻擊 Then 待轉接 |
| --- | ---: | ---: | ---: | ---: |
${colorRows(report)}

## 非 EXTRA 主效果待轉接

| 卡號 | 顏色 | 類型 | 卡名 | 卡面文字 |
| --- | --- | --- | --- | --- |
${tableRows(report.primaryUnsupportedCards.filter((entry) => entry.type !== 'extra'))}

## 後續 gate

1. BS8 候選只能執行 \`npm run validate:candidate\` 的來源／結構驗證；inventory 狀態必須保持不可 promote。
2. 維持候選 staging 的自訂牌組／AI／雙瀏覽器線上隔離；完成其餘 BS8 卡逐卡 runtime adapter、strict contract 與 Browser A/B。
3. 所有基礎卡的 strict contract 與逐卡 Browser gate 都通過後，才可由使用者明確授權 promotion。
`
}

export const readBs8CandidateCards = async (
  input = DEFAULT_BS8_CANDIDATE_INPUT,
): Promise<OfficialCardRecord[]> => {
  const payload: unknown = JSON.parse(await readFile(resolve(input), 'utf8'))
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { cards?: unknown }).cards)) {
    throw new Error(`BS8 候選資料格式錯誤：${input}`)
  }
  return (payload as { cards: OfficialCardRecord[] }).cards
}

export const writeBs8EffectCoverage = async ({
  input = DEFAULT_BS8_CANDIDATE_INPUT,
  output = DEFAULT_BS8_EFFECT_COVERAGE_OUTPUT,
} = {}) => {
  const cards = await readBs8CandidateCards(input)
  const report = analyzeBs6EffectCoverage(cards)
  const outputPath = resolve(output)
  await writeFile(outputPath, createBs8EffectCoverageMarkdown(cards, report), 'utf8')
  return { outputPath, report, extraCount: cards.filter((card) => card.type === 'extra' || card.flags.extra).length }
}

const isDirectExecution =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  try {
    const { outputPath, report, extraCount } = await writeBs8EffectCoverage()
    console.log(
      `BS8 候選效果盤點：${report.baseCardCount} 張基礎卡、EXTRA ${extraCount} 筆、主效果待轉接 ${report.primaryConversion['unsupported-effect-text']}。`,
    )
    console.log(`已更新 ${outputPath}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
