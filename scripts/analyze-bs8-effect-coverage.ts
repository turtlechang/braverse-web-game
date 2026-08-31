import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  analyzeBs6EffectCoverage,
  type Bs6EffectCoverageEntry,
  type Bs6EffectCoverageReport,
} from './analyze-bs6-effect-coverage'
import { analyzeOfficialCardBehavior } from '../src/cards/contracts/ledger'
import type { OfficialCardRecord } from '../src/cards/types'

export const DEFAULT_BS8_FORMAL_INPUT =
  'data/cards/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json'
/** @deprecated Use DEFAULT_BS8_FORMAL_INPUT after BS8 promotion. */
export const DEFAULT_BS8_CANDIDATE_INPUT = DEFAULT_BS8_FORMAL_INPUT
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

const strictContractSummary = (cards: OfficialCardRecord[]) =>
  cards.reduce(
    (summary, card) => {
      const status = analyzeOfficialCardBehavior(card).contract.status
      summary[status] += 1
      return summary
    },
    { verified: 0, 'needs-review': 0, blocked: 0 },
  )

export const createBs8EffectCoverageMarkdown = (
  cards: OfficialCardRecord[],
  report: Bs6EffectCoverageReport,
) => {
  const extraCards = cards.filter((card) => card.type === 'extra' || card.flags.extra)
  const strict = strictContractSummary(cards)
  return `# BS8 Land of Fire & Ruin, Realm of Apathy 效果覆蓋盤點（正式卡池）

> 由 \`npm run cards:analyze:bs8\` 產生。資料來源是 \`${DEFAULT_BS8_FORMAL_INPUT}\`；parser inventory 與 strict contract 是不同量表，Browser 證據另見正式 BS8 Browser 稽核產物。

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
| strict contract verified | ${strict.verified} |
| strict contract needs-review | ${strict['needs-review']} |
| strict contract blocked | ${strict.blocked} |

## EXTRA 核心規則阻塞

主牌組用的通用 adapter 仍會明確將 \`extra\` 視為 \`unsupported-card-type\`，避免 EXTRA 誤混入 60 張牌組；15 筆 EXTRA 記錄已隨 BS8 正式資料進入 registry，但仍由專用 \`convertOfficialCardToExtraDeckCard\` 與獨立 staging 流程處理。該轉接已涵蓋 BS8-005／027／069／090／104，其中 BS8-005／069／090 有核心直接登場 command、戰場私密檢視、攻擊後效果與 Browser A/B；Lv.1／Lv.2 也只透過通用合法指令與既有 Cookie 評分使用直接 EXTRA，沒有卡號特判。BS8-027／104 已依官方規則與 FAQ 轉接 Awakened 的覆蓋目標、\`HP+2\`、裝備保留、既有套用效果清除及昏厥區域去向，並有純規則 TDD。BS8-076 的 Browser A/B 會實際驗證對手下一個 Active Phase 選擇棄 0 張時維持 rested，恰好棄 2 張時才轉 active。牌組編輯器的 BS8 篩選、主牌組與六槽 EXTRA 仍只在明確 staging 模式出現；匯入／匯出只接受帶 \`candidateStaging.extraDeckEntries\` 的專用 JSON，Standard importer 會拒絕它。這些額外牌組流程不會混入 Standard 牌組或正式房間。

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

1. BS8 正式資料以 \`npm run validate:cards\` 與 \`npm run check:card-pool\` 驗證；來源 metadata 的 \`promotion-ready\` 僅作匯入稽核證據。
2. BS8-043 依已確認的戰鬥區兩張餅乾上限裁決：來源 Fettuccine Cookie 自己佔一格，另一格若是本回合從 Break 登場的 LV.3，即為唯一合法目標。runtime 以 \`gain-hp\` 的 \`self／LV.3／enteredFrom=break／enteredThisTurn／min=max=1\` selector 綁定，不能改成任選或全體。
3. 正式 Browser 逐卡 gate：通用主效果 146／146 正向、156／156 負向；54／54 張能力使用獨立 \`card-skill\`／\`card-skill-negative\` A/B；14 個 Then 使用實際攻擊語意 A/B。EXTRA 仍另走 staging Browser 流程。
4. BS8 已完成使用者授權的 promotion；後續官方更新仍必須回到候選目錄，完成同一套 strict／Browser gate 後再 promote。
`
}

export const readBs8Cards = async (
  input = DEFAULT_BS8_FORMAL_INPUT,
): Promise<OfficialCardRecord[]> => {
  const payload: unknown = JSON.parse(await readFile(resolve(input), 'utf8'))
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { cards?: unknown }).cards)) {
    throw new Error(`BS8 資料格式錯誤：${input}`)
  }
  return (payload as { cards: OfficialCardRecord[] }).cards
}

/** @deprecated Use readBs8Cards. */
export const readBs8CandidateCards = readBs8Cards

export const writeBs8EffectCoverage = async ({
  input = DEFAULT_BS8_FORMAL_INPUT,
  output = DEFAULT_BS8_EFFECT_COVERAGE_OUTPUT,
} = {}) => {
  const cards = await readBs8Cards(input)
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
      `BS8 正式效果盤點：${report.baseCardCount} 張基礎卡、EXTRA ${extraCount} 筆、主效果待轉接 ${report.primaryConversion['unsupported-effect-text']}。`,
    )
    console.log(`已更新 ${outputPath}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
