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
 * 第一批 25 張 target evidence 回歸卡。
 *
 * 這些卡刻意涵蓋棄牌區／休息區／支援區／手牌、LV／顏色／HP／other、
 * active-only、複數目標與 AbilityCost 選牌。測試只驗證公開 selector
 * binding，不以卡名或彈數作策略判斷，也不改正式 CardEffect。
 */
const BATCH: readonly SelectorRegressionCase[] = [
  { cardId: 'BS3-028', selector: { side: 'opponent', min: 0, max: 1, minLevel: 1, maxLevel: 1 }, zone: 'trash' },
  { cardId: 'BS3-032', selector: { side: 'self', min: 0, max: 1, energyColor: 'yellow', minLevel: 1, maxLevel: 1 }, zone: 'break' },
  { cardId: 'BS3-033', selector: { side: 'opponent', min: 0, max: 1, remainingHp: 1 } },
  { cardId: 'BS3-046', selector: { side: 'self', min: 0, max: 1, energyColor: 'yellow', minLevel: 1, maxLevel: 1 }, zone: 'break' },
  { cardId: 'BS3-052', selector: { side: 'self', min: 0, max: 1, maxRemainingHp: 2, excludeSource: true } },
  { cardId: 'BS3-053', selector: { side: 'self', min: 0, max: 1, energyColor: 'green', excludeSource: true }, zone: 'battle' },
  { cardId: 'BS3-055', selector: { side: 'opponent', min: 0, max: 1, activeOnly: true }, zone: 'support' },
  { cardId: 'BS3-060', selector: { side: 'opponent', min: 0, max: 1, activeOnly: true }, zone: 'support' },
  { cardId: 'BS3-061', selector: { side: 'self', min: 1, max: 1 }, zone: 'support' },
  { cardId: 'BS3-068', selector: { side: 'self', min: 2, max: 2 }, zone: 'support' },
  { cardId: 'BS3-069', selector: { side: 'self', min: 2, max: 2 }, zone: 'support' },
  { cardId: 'BS3-072', selector: { side: 'opponent', min: 0, max: 1, activeOnly: true }, zone: 'support' },
  { cardId: 'BS3-098', selector: { side: 'self', min: 5, max: 5, energyColor: 'purple' }, zone: 'trash' },
  { cardId: 'BS3-101', selector: { side: 'opponent', min: 0, max: 1, maxRemainingHp: 2 } },
  { cardId: 'BS3-112', selector: { side: 'self', min: 0, max: 1, energyColor: 'purple' }, zone: 'trash' },
  { cardId: 'BS4-025', selector: { side: 'self', min: 0, max: 1, energyColor: 'yellow', minLevel: 2, maxLevel: 2 }, zone: 'break' },
  { cardId: 'BS4-029', selector: { side: 'self', min: 0, max: 1, energyColor: 'yellow', minLevel: 3, maxLevel: 3 }, zone: 'break' },
  { cardId: 'BS4-035', selector: { side: 'self', min: 0, max: 1, energyColor: 'yellow', minLevel: 1, maxLevel: 1 }, zone: 'break' },
  { cardId: 'BS4-038', selector: { side: 'self', min: 0, max: 1, energyColor: 'yellow', maxLevel: 2 }, zone: 'break' },
  { cardId: 'BS4-058', selector: { side: 'self', min: 0, max: 1, energyColor: 'green' } },
  { cardId: 'BS4-063', selector: { side: 'self', min: 1, max: 1 }, zone: 'support' },
  { cardId: 'BS4-066', selector: { side: 'self', min: 0, max: 1, energyColor: 'green' }, zone: 'support' },
  { cardId: 'BS4-091', selector: { side: 'self', min: 0, max: 3 }, zone: 'trash' },
  { cardId: 'BS4-108', selector: { side: 'self', min: 0, max: 1, energyColor: 'purple' }, zone: 'trash' },
  { cardId: 'BS5-059', selector: { side: 'opponent', min: 0, max: 1, maxLevel: 2 } },
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

describe('selector parser and runtime binding regression batch (25 cards)', () => {
  it.each(BATCH)('$cardId exposes the expected selector evidence', ({ cardId, selector, zone }) => {
    const record = records.find(
      (candidate) => candidate.cardNumber === cardId || candidate.baseCardNumber === cardId,
    )
    expect(record, `missing official record ${cardId}`).toBeDefined()
    const converted = convertOfficialCardToGameCard(record!)
    if (converted.status !== 'converted') {
      throw new Error(`${cardId} must have runtime evidence: ${converted.reason}`)
    }
    const audit = analyzeOfficialCardBehavior(record!, converted.gameCard)
    const target = audit.contract.targets.find((candidate) =>
      Object.entries(selector).every(([key, value]) => candidate.selector[key as keyof typeof candidate.selector] === value) &&
      (zone === undefined || candidate.zone === zone),
    )
    expect(target, `${cardId} target selector was not parsed/bound`).toBeDefined()
    expect(target?.unresolved).toBeUndefined()
    expect(audit.checks.targetCovered, `${cardId} runtime selector evidence is unresolved`).toBe(true)
  })
})
