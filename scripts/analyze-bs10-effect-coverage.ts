import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { analyzeBs6EffectCoverage } from './analyze-bs6-effect-coverage'
import { analyzeOfficialCardBehavior } from '../src/cards/contracts/ledger'
import type { OfficialCardRecord } from '../src/cards/types'

const candidateInput = 'data/candidates/official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json'
const formalInput = 'data/cards/official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json'
const input = existsSync(candidateInput) ? candidateInput : formalInput
const document = JSON.parse(await readFile(input, 'utf8')) as {
  source: { fetchedAt: string; datasetUrl: string; candidateStatus?: string }; cards: OfficialCardRecord[]
}
const candidateStatus = document.source.candidateStatus ?? 'inventory'
const datasetStatus = input === candidateInput
  ? `候選狀態：${candidateStatus}`
  : '資料狀態：已 promote 至正式卡池'
const cards = [...document.cards].sort((a, b) => a.cardNumber.localeCompare(b.cardNumber, 'en'))
const report = analyzeBs6EffectCoverage(cards)
// Inventory must retain unsupported EXTRA records and report their failure explicitly.
const analyses = cards.map((card) => {
  try {
    const audit = analyzeOfficialCardBehavior(card)
    return { card, status: audit.contract.status, errors: audit.errors }
  } catch (error) {
    return { card, status: 'blocked', errors: [`契約分析失敗：${error instanceof Error ? error.message : String(error)}`] }
  }
})
const escape = (value: string | null) => (value ?? '無').replaceAll('|', '\\|').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replace(/\r?\n/g, '<br>')
const counts = (values: string[]) => [...new Set(values)].map((value) => `| ${value} | ${values.filter((item) => item === value).length} |`).join('\n')
await writeFile('docs/bs10-card-inventory.md', `# BS10 Paradise of Passion & Sloth / Catacombs of Silence 卡牌盤點

來源：[官方英文卡表](${document.source.datasetUrl})。抓取時間：${document.source.fetchedAt}。
由 cards:analyze:bs10-candidate 產生；${datasetStatus}；原始文字保留於 ${input}。此靜態盤點不取代逐卡卡圖與 Browser 驗收，也不會自行執行 promote。

共 ${cards.length} 筆、${report.baseCardCount} 個基礎卡號；${cards.filter((card) => card.variant !== null).length} 筆變體。

| 類型 | 筆數 |
| --- | ---: |
${counts(cards.map((card) => card.type))}

| 顏色 | 筆數 |
| --- | ---: |
${counts(cards.map((card) => card.color ?? '無'))}

| 卡號 | 卡名 | 類型 | 技能 | 攻擊 | FLIP | 官方卡圖 |
| --- | --- | --- | --- | --- | --- | --- |
${cards.map((card) => `| ${card.cardNumber} | ${escape(card.name)} | ${card.type} | ${escape(card.skill.text)} | ${escape(card.attackText)} | ${escape(card.flipText)} | [卡圖](${card.imageUrl}) |`).join('\n')}
`, 'utf8')
await writeFile('docs/bs10-effect-coverage.md', `# BS10 轉接缺口盤點

由 cards:analyze:bs10-candidate 產生。這是靜態轉接盤點，不取代逐卡卡圖與 Browser 驗收；已完成批次的實際證據另列於 [BS10 進度報告](bs10-progress-2026-09-14.md)。strict verified 不是卡圖語意驗收。

基礎卡 ${report.baseCardCount}；主效果待轉接 ${report.primaryConversion['unsupported-effect-text']}；額外能力待轉接 ${report.abilityConversion.pending}；攻擊 Then ${report.attackThen.converted}/${report.attackThen.total} 已轉接。

| strict 狀態 | 筆數 |
| --- | ---: |
${counts(analyses.map(({ status }) => status))}

| 卡號 | strict 狀態 | 缺口 |
| --- | --- | --- |
${analyses.map(({ card, status, errors }) => `| ${card.cardNumber} | ${status} | ${escape(errors.join('; ') || '靜態未報錯；逐卡 Browser 狀態見進度報告')} |`).join('\n')}

## 基礎卡 parser 盤點

| 卡號 | 主效果 | 額外能力 | 攻擊 Then |
| --- | --- | --- | --- |
${report.entries.map((entry) => `| ${entry.cardNumber} | ${entry.primaryConversion} | ${entry.abilityConversion} | ${entry.attackThenConversion} |`).join('\n')}
`, 'utf8')
console.log(JSON.stringify({ records: cards.length, baseCards: report.baseCardCount, primary: report.primaryConversion, abilities: report.abilityConversion, then: report.attackThen, strict: analyses.reduce<Record<string, number>>((acc, { status }) => { acc[status] = (acc[status] ?? 0) + 1; return acc }, {}), first: analyses[0] }, null, 2))
