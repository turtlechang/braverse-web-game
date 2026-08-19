/**
 * 逐批執行 card contract 的 shadow migration gate。
 *
 * 這個腳本只讀取 data/cards，產生報告，不修改正式卡牌資料或 runtime
 * registry。offset 以所有唯一 cardId 為穩定游標；目前游標若是
 * needs-review／blocked，仍會選入並讓 strict gate 失敗，不能被後面的
 * verified 卡牌越過。選入批次的 runtime 編譯結果若不可執行也會失敗。
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  analyzeOfficialCardBehavior,
  checkContractMigrationBatch,
  compileCardBehaviorContract,
  isContractMigrationBatchReady,
  selectRecordsForMigrationBatch,
  selectVerifiedMigrationBatch,
} from '../src/cards/contracts'
import { convertOfficialCardToGameCard } from '../src/cards/official-card-adapter'
import type { OfficialCardRecord } from '../src/cards/types'

const projectRoot = join(fileURLToPath(new URL('..', import.meta.url)))
const cardsDir = join(projectRoot, 'data', 'cards')

interface Options {
  directory: string
  offset: number
  limit: number
  output?: string
}
const parseArgs = (argv: string[]): Options => {
  let directory = cardsDir
  let offset = 0
  let limit = 25
  let output: string | undefined
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--dir' && argv[index + 1]) directory = argv[++index]
    else if (arg === '--offset' && argv[index + 1]) offset = Number(argv[++index])
    else if (arg === '--limit' && argv[index + 1]) limit = Number(argv[++index])
    else if (arg === '--output' && argv[index + 1]) output = argv[++index]
  }
  return { directory, offset, limit, output }
}

const readCards = (directory: string): OfficialCardRecord[] => {
  const cards: OfficialCardRecord[] = []
  for (const file of readdirSync(directory).filter((name) => name.endsWith('.json')).sort()) {
    const parsed = JSON.parse(readFileSync(join(directory, file), 'utf8')) as { cards?: unknown }
    if (!Array.isArray(parsed.cards)) continue
    cards.push(...(parsed.cards as OfficialCardRecord[]))
  }
  return cards
}

export const migrateCardContractBatch = (options: Partial<Options> = {}) => {
  const resolved: Options = {
    directory: options.directory ?? cardsDir,
    offset: Math.max(0, Math.floor(options.offset ?? 0)),
    limit: Math.max(1, Math.floor(options.limit ?? 25)),
    output: options.output,
  }
  const records = readCards(resolved.directory)
    .filter((card) => card.flags?.enabled !== false && card.flags?.hidden !== true)
    .sort((left, right) => left.baseCardNumber.localeCompare(right.baseCardNumber))
  const audits = records.map((record) => {
    const converted = convertOfficialCardToGameCard(record)
    return analyzeOfficialCardBehavior(record, converted.status === 'converted' ? converted.gameCard : null)
  })
  const batch = selectVerifiedMigrationBatch(audits, resolved)
  const compiled = selectRecordsForMigrationBatch(records, batch)
    .map((record) => {
      const converted = convertOfficialCardToGameCard(record)
      return compileCardBehaviorContract(
        record,
        converted.status === 'converted' ? converted.gameCard : null,
      )
    })
  const checks = checkContractMigrationBatch(batch, compiled)
  const report = {
    schemaVersion: 1,
    mode: 'shadow',
    batch,
    checks,
    ready: isContractMigrationBatchReady(checks),
  }
  if (resolved.output) writeFileSync(resolved.output, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  return report
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = migrateCardContractBatch(parseArgs(process.argv.slice(2)))
  console.log(
    `card contract shadow migration batch：offset=${report.batch.offset}、` +
      `limit=${report.batch.limit}、selected=${report.batch.cardIds.length}、` +
      `ready=${report.ready}`,
  )
  for (const check of report.checks.filter((entry) => !entry.executable)) {
    console.log(`- ${check.cardId}: blocked — ${check.blockers.join('; ')}`)
  }
  if (!report.ready) process.exit(1)
}
