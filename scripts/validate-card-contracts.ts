/**
 * 卡牌行為契約 shadow audit。
 *
 * 這個工具刻意不改變既有 converter 或規則決策；它把官方來源文字與
 * 現有 GameCard/CardEffect 並列，列出支付、代價、目標及 Then 的證據缺口。
 * 預設只產生報告；CI／promotion gate 可用 `--strict` 將缺口視為失敗。
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeOfficialCardBehavior } from '../src/cards/contracts'
import type { OfficialCardRecord } from '../src/cards/types'

const projectRoot = join(fileURLToPath(new URL('..', import.meta.url)))
const cardsDir = join(projectRoot, 'data', 'cards')

interface AuditOptions {
  directory: string
  output?: string
  strict: boolean
  file?: string
}

const parseArgs = (argv: string[]): AuditOptions => {
  let output: string | undefined
  let directory = cardsDir
  let strict = false
  let file: string | undefined
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--strict') strict = true
    else if (arg === '--dir' && argv[index + 1]) directory = argv[++index]
    else if (arg === '--output' && argv[index + 1]) output = argv[++index]
    else if (arg === '--file' && argv[index + 1]) file = argv[++index]
  }
  return { directory, output, strict, file }
}

const readCards = (directory: string, file?: string): OfficialCardRecord[] => {
  const files = file
    ? [file]
    : readdirSync(directory).filter((name) => name.endsWith('.json')).sort()
  const cards: OfficialCardRecord[] = []
  for (const name of files) {
    const path = join(directory, name)
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { cards?: unknown }
    if (!Array.isArray(parsed.cards)) continue
    for (const card of parsed.cards) cards.push(card as OfficialCardRecord)
  }
  return cards
}

export const auditCardContracts = (
  options: Partial<AuditOptions> = {},
) => {
  const resolved: AuditOptions = {
    directory: options.directory ?? cardsDir,
    output: options.output,
    strict: options.strict ?? false,
    file: options.file,
  }
  const cards = readCards(resolved.directory, resolved.file)
  const audits = cards
    .filter((card) => card.flags?.enabled !== false && card.flags?.hidden !== true)
    .map((card) => analyzeOfficialCardBehavior(card))
  const counts = audits.reduce(
    (result, audit) => {
      result[audit.contract.status] += 1
      return result
    },
    { verified: 0, 'needs-review': 0, blocked: 0 },
  )
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceDirectory: resolved.directory,
    totalCards: audits.length,
    counts,
    audits,
  }
  if (resolved.output) writeFileSync(resolved.output, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  return report
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const options = parseArgs(process.argv.slice(2))
  const report = auditCardContracts(options)
  console.log(
    `卡牌行為契約 shadow audit：${report.totalCards} 張；` +
      `verified=${report.counts.verified}、needs-review=${report.counts['needs-review']}、blocked=${report.counts.blocked}`,
  )
  if (report.counts['needs-review'] > 0 || report.counts.blocked > 0) {
    for (const audit of report.audits.filter((item) => item.contract.status !== 'verified').slice(0, 30)) {
      console.log(`- ${audit.contract.cardId}: ${audit.contract.status} — ${audit.errors.join('; ')}`)
    }
  }
  if (options.strict && (report.counts['needs-review'] > 0 || report.counts.blocked > 0)) process.exit(1)
}
