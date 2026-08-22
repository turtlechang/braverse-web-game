import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  analyzeBs6EffectCoverage,
  type Bs6ColorCoverage,
  type Bs6EffectCoverageEntry,
  type Bs6EffectCoverageReport,
} from './analyze-bs6-effect-coverage'
import type { OfficialCardRecord } from '../src/cards/types'

export const DEFAULT_BS7_CANDIDATE_INPUT =
  'data/candidates/official-arena-of-glory-bs7.en.json'
export const DEFAULT_BS7_EFFECT_COVERAGE_OUTPUT = 'docs/bs7-effect-coverage.md'

export type Bs7EffectCoverageEntry = Bs6EffectCoverageEntry
export type Bs7ColorCoverage = Bs6ColorCoverage
export type Bs7EffectCoverageReport = Bs6EffectCoverageReport

export const analyzeBs7EffectCoverage = analyzeBs6EffectCoverage

const markdownCode = (value: string) =>
  String.fromCharCode(96) + value + String.fromCharCode(96)

const tableRows = (entries: Bs7EffectCoverageEntry[]) =>
  entries
    .map(
      (entry) =>
        `| ${entry.cardNumber} | ${entry.color ?? 'COLORLESS'} | ${entry.type} | ${entry.name.replaceAll('|', '\\|')} | ${(entry.effectText ?? '無效果文字').replaceAll('|', '\\|')} |`,
    )
    .join('\n')

const colorRows = (byColor: Record<string, Bs7ColorCoverage>) =>
  Object.entries(byColor)
    .map(
      ([color, coverage]) =>
        `| ${color} | ${coverage.total} | ${coverage.primaryUnsupported} | ${coverage.abilityPending} | ${coverage.attackThenPending} |`,
    )
    .join('\n')

const pendingAttackThenTable = (entries: Bs7EffectCoverageEntry[]) =>
  entries
    .map(
      (entry) =>
        `| ${entry.cardNumber} | ${entry.color ?? 'COLORLESS'} | ${entry.type} | ${entry.name.replaceAll('|', '\\|')} | ${(entry.attackThenText ?? entry.effectText ?? '?').replaceAll('|', '\\|')} |`,
    )
    .join('\n') || '| - | - | - | - | - |'

const pendingTable = (entries: Bs7EffectCoverageEntry[]) =>
  tableRows(entries) || '| 無 | - | - | - | - |'

export const createBs7EffectCoverageMarkdown = (
  report: Bs7EffectCoverageReport,
) => `# BS7 Arena of Glory 效果轉接覆蓋盤點（候選資料）

> 由 ${markdownCode('npm run cards:analyze:bs7-candidate')} 產生。資料來源是 ${markdownCode(DEFAULT_BS7_CANDIDATE_INPUT)}；本報告是候選資料的 runtime 轉接盤點，不代表卡牌可 promote 或已完成 Browser 驗收。

## 摘要

| 項目 | 數量 |
| --- | ---: |
| BS7 基礎卡 | ${report.baseCardCount} |
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

## 全體傷害順序門檻

BS7-039 與 BS7-082 的「對手全體餅乾受傷」均必須使用 \`damage-all\` 的 \`sequential: true\` 與完整對手目標 selector。Browser 結算依玩家點選順序逐張處理 HP、FLIP 與昏厥；這項順序要求不是一般無目標全體傷害的同義替代。

## 後續維護門檻

1. 依本報告從每色第一張待轉接卡開始，先完成 parser／contract shadow compile，再進入單卡 runtime 轉接。
2. 每張卡完成 adapter、規則、UI 與回歸測試後，才建立 test-state 正反案例與 Chrome Browser A/B 證據。
3. 所有基礎卡的 strict contract、逐色 Browser gate、正式 smoke 與人工覆核通過前，候選狀態必須維持 \`inventory\`。
`

export const readBs7CandidateCards = async (
  input = DEFAULT_BS7_CANDIDATE_INPUT,
): Promise<OfficialCardRecord[]> => {
  const payload: unknown = JSON.parse(await readFile(resolve(input), 'utf8'))
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.cards)) {
    throw new Error(`BS7 候選資料格式錯誤：${input}`)
  }
  return payload.cards as OfficialCardRecord[]
}

export const writeBs7EffectCoverage = async ({
  input = DEFAULT_BS7_CANDIDATE_INPUT,
  output = DEFAULT_BS7_EFFECT_COVERAGE_OUTPUT,
} = {}) => {
  const report = analyzeBs7EffectCoverage(await readBs7CandidateCards(input))
  const outputPath = resolve(output)
  await writeFile(outputPath, createBs7EffectCoverageMarkdown(report), 'utf8')
  return { outputPath, report }
}

const isDirectExecution =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  try {
    const { outputPath, report } = await writeBs7EffectCoverage()
    console.log(
      `BS7 效果覆蓋盤點：${report.baseCardCount} 張基礎卡，主效果待轉接 ${report.primaryConversion['unsupported-effect-text']}，攻擊 Then ${report.attackThen.converted}/${report.attackThen.total} 已轉接。`,
    )
    console.log(`已更新 ${outputPath}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
