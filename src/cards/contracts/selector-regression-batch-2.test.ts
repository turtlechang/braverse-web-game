import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../official-card-adapter'
import type { OfficialCardRecord } from '../types'
import { analyzeOfficialCardBehavior } from './ledger'

interface SelectorRegressionCase {
  cardId: string
  selector: Record<string, unknown>
  zone?: string
}

/**
 * 第二批 25 張 target evidence 回歸卡。
 *
 * 本批集中驗證 LV／HP 上下限、source exclusion、雙方目標、支援區與
 * 牌庫底／場景 alternate target。測試只檢查來源文字與 runtime selector
 * 的 binding，不以卡名或彈數作策略判斷，也不改正式卡池資料。
 */
const BATCH: readonly SelectorRegressionCase[] = [
  { cardId: 'BS2-027', selector: { side: 'self', min: 0, max: 2 } },
  { cardId: 'BS2-029', selector: { side: 'self', min: 0, max: 1, maxLevel: 2 }, zone: 'battle' },
  { cardId: 'BS2-031', selector: { side: 'opponent', min: 0, max: 2 } },
  { cardId: 'BS2-039', selector: { side: 'self', min: 0, max: 2 } },
  { cardId: 'BS2-047', selector: { side: 'opponent', min: 0, max: 2 } },
  { cardId: 'BS2-050', selector: { side: 'opponent', min: 0, max: 1, maxRemainingHp: 3 } },
  { cardId: 'BS3-011', selector: { side: 'opponent', min: 0, max: 1 } },
  { cardId: 'BS3-117', selector: { side: 'opponent', min: 0, max: 1, maxRemainingHp: 2 } },
  { cardId: 'BS4-001', selector: { side: 'self', min: 0, max: 1, energyColor: 'red', excludeSource: true } },
  { cardId: 'BS4-042', selector: { side: 'opponent', min: 0, max: 1 } },
  { cardId: 'BS4-064', selector: { side: 'self', min: 0, max: 1, energyColor: 'green' }, zone: 'trash' },
  { cardId: 'BS4-073@2', selector: { side: 'opponent', min: 1, max: 1, minLevel: 1, maxLevel: 1 }, zone: 'battle' },
  { cardId: 'BS4-073@2', selector: { side: 'either', min: 1, max: 1, cardType: 'stage' }, zone: 'stage' },
  { cardId: 'BS4-075', selector: { side: 'either', min: 1, max: 1, cardType: 'stage' }, zone: 'stage' },
  { cardId: 'BS5-037', selector: { side: 'self', min: 0, max: 1, energyColor: 'yellow', excludeSource: true } },
  { cardId: 'BS6-021', selector: { side: 'self', min: 0, max: 1, minLevel: 2, maxRemainingHp: 3 } },
  { cardId: 'BS6-039', selector: { side: 'opponent', min: 1, max: 1 }, zone: 'break' },
  { cardId: 'BS6-081', selector: { side: 'either', min: 0, max: 1, cardType: 'stage' }, zone: 'stage' },
  { cardId: 'P-031', selector: { side: 'opponent', min: 0, max: 1, minLevel: 3, maxLevel: 3 } },
  { cardId: 'P-043', selector: { side: 'self', min: 0, max: 1, energyColor: 'yellow', minLevel: 3, maxLevel: 3 }, zone: 'battle' },
  { cardId: 'P-140', selector: { side: 'self', min: 0, max: 1, minLevel: 3, maxLevel: 3, maxRemainingHp: 5 } },
  { cardId: 'P-142', selector: { side: 'self', min: 0, max: 1, maxRemainingHp: 3 } },
  { cardId: 'ST1-002', selector: { side: 'opponent', min: 0, max: 1 } },
  { cardId: 'ST4-013', selector: { side: 'opponent', min: 0, max: 1 } },
  { cardId: 'ST3-010', selector: { side: 'self', min: 1, max: 1 }, zone: 'support' },
]

const loadRecords = (): OfficialCardRecord[] => {
  const cardsDir = resolve(process.cwd(), 'data', 'cards')
  return readdirSync(cardsDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .flatMap((file) => {
      const parsed = JSON.parse(readFileSync(resolve(cardsDir, file), 'utf8')) as {
        cards?: OfficialCardRecord[]
      }
      return parsed.cards ?? []
    })
}

const records = loadRecords()

describe('selector parser and runtime binding regression batch 2 (25 cases)', () => {
  it.each(BATCH)('$cardId exposes the expected selector evidence', ({ cardId, selector, zone }) => {
    const record =
      records.find((candidate) => candidate.cardNumber === cardId) ??
      records.find((candidate) => candidate.baseCardNumber === cardId)
    expect(record, `missing official record ${cardId}`).toBeDefined()
    const converted = convertOfficialCardToGameCard(record!)
    if (converted.status !== 'converted') {
      throw new Error(`${cardId} must have runtime evidence: ${converted.reason}`)
    }
    const audit = analyzeOfficialCardBehavior(record!, converted.gameCard)
    const target = audit.contract.targets.find((candidate) =>
      Object.entries(selector).every(
        ([key, value]) => candidate.selector[key as keyof typeof candidate.selector] === value,
      ) && (zone === undefined || candidate.zone === zone),
    )
    expect(target, `${cardId} target selector was not parsed/bound`).toBeDefined()
    expect(target?.unresolved).toBeUndefined()
    expect(audit.checks.targetCovered, `${cardId} runtime selector evidence is unresolved`).toBe(true)
  })
})
