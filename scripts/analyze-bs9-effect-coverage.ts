import { readFile, writeFile } from 'node:fs/promises'
import { analyzeBs6EffectCoverage } from './analyze-bs6-effect-coverage'
import { analyzeOfficialCardBehavior } from '../src/cards/contracts/ledger'
import type { OfficialCardRecord } from '../src/cards/types'

const input = 'data/candidates/official-a-game-of-truth-and-deceit-bs9.en.json'
const document = JSON.parse(await readFile(input, 'utf8')) as {
  source: { fetchedAt: string; datasetUrl: string }; cards: OfficialCardRecord[]
}
const cards = [...document.cards].sort((a, b) => a.cardNumber.localeCompare(b.cardNumber, 'en'))
const report = analyzeBs6EffectCoverage(cards)
const analyses = cards.map((card) => ({ card, audit: analyzeOfficialCardBehavior(card) }))
const escape = (value: string | null) => (value ?? '無').replaceAll('|', '\\|').replaceAll('\n', '<br>')
const counts = (values: string[]) => [...new Set(values)].map((value) => `| ${value} | ${values.filter((item) => item === value).length} |`).join('\n')
await writeFile('docs/bs9-card-inventory.md', `# BS9 A Game of Truth and Deceit 候選盤點

來源：[官方英文卡表](${document.source.datasetUrl})。抓取時間：${document.source.fetchedAt}。
由 cards:analyze:bs9-candidate 產生；原始文字保留於 ${input}，inventory 不代表可 promote。

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
await writeFile('docs/bs9-effect-coverage.md', `# BS9 轉接缺口盤點

由 cards:analyze:bs9-candidate 產生。這是靜態盤點，所有卡的 Browser 驗收仍未完成；strict verified 不是卡圖語意驗收。

基礎卡 ${report.baseCardCount}；主效果待轉接 ${report.primaryConversion['unsupported-effect-text']}；額外能力待轉接 ${report.abilityConversion.pending}；攻擊 Then ${report.attackThen.converted}/${report.attackThen.total} 已轉接。

| strict 狀態 | 筆數 |
| --- | ---: |
${counts(analyses.map(({ audit }) => audit.contract.status))}

| 卡號 | strict 狀態 | 缺口 |
| --- | --- | --- |
${analyses.map(({ card, audit }) => `| ${card.cardNumber} | ${audit.contract.status} | ${escape(audit.errors.join('; ') || '靜態未報錯；待獨立卡圖與 Browser 驗收')} |`).join('\n')}

## 基礎卡 parser 盤點

| 卡號 | 主效果 | 額外能力 | 攻擊 Then |
| --- | --- | --- | --- |
${report.entries.map((entry) => `| ${entry.cardNumber} | ${entry.primaryConversion} | ${entry.abilityConversion} | ${entry.attackThenConversion} |`).join('\n')}
`, 'utf8')
console.log(JSON.stringify({ records: cards.length, baseCards: report.baseCardCount, primary: report.primaryConversion, abilities: report.abilityConversion, then: report.attackThen, strict: analyses.reduce<Record<string, number>>((acc, { audit }) => { acc[audit.contract.status] = (acc[audit.contract.status] ?? 0) + 1; return acc }, {}), first: analyses[0] }, null, 2))
