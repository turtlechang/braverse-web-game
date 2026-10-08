import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const record = candidate.cards.find(card => card.cardNumber === 'BS12-065') as OfficialCardRecord
const convert = () => {
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'trap') throw new Error('Missing Fan Letter')
  return result.gameCard
}
it('matches the physical blue Arena Trap: B reduction then public LV2 Arena Cookie hand cost to bottom before optional draw', () => {
  const before = structuredClone(record)
  const card = convert()
  expect(card).toMatchObject({ id: 'BS12-065', type: 'trap', energyColor: 'blue', keywords: ['arena'],
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/UQIbRgMbKywf6tcWMwo9Og.webp',
    trap: { cost: { energy: { blue: 1 }, discardHand: 0 }, effects: [
      { kind: 'modify-attack', amount: -1, duration: 'this-turn', target: { side: 'opponent', min: 0, max: 1 } },
      { kind: 'optional-cost-attack', resolution: 'ability', cost: { energy: {}, discardHand: 1,
        discardHandType: 'cookie', discardHandLevel: 2, discardHandKeyword: 'arena', handCostDestination: 'deck-bottom' },
        effects: [{ kind: 'draw-up-to', max: 1 }] },
    ] } })
  expect(card.trap?.effects).toHaveLength(2)
  expect(analyzeOfficialCardBehavior(record).errors).toEqual([])
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(before)
})
it.each(['missing-then', 'no-cost', 'no-level', 'no-arena', 'wrong-type', 'trash', 'color', 'front-cost', 'free-front', 'wrong-front', 'source-target', 'mandatory', 'energy', 'draw-two', 'hand-cap'] as const)('fails closed for incomplete or overrestricted runtime: %s', mutation => {
  const card = structuredClone(convert())
  const trap = card.trap!
  const front = trap.effects[0]
  const then = trap.effects[1]
  if (front.kind !== 'modify-attack' || then.kind !== 'optional-cost-attack' || then.effects[0].kind !== 'draw-up-to') throw new Error('Missing expected shape')
  if (mutation === 'missing-then') trap.effects.pop()
  if (mutation === 'no-cost') then.cost.discardHand = 0
  if (mutation === 'no-level') delete then.cost.discardHandLevel
  if (mutation === 'no-arena') delete then.cost.discardHandKeyword
  if (mutation === 'wrong-type') then.cost.discardHandType = 'item'
  if (mutation === 'trash') delete then.cost.handCostDestination
  if (mutation === 'color') then.cost.discardHandColor = 'blue'
  if (mutation === 'front-cost') trap.cost.discardHand = 1
  if (mutation === 'free-front') trap.cost.energy = {}
  if (mutation === 'wrong-front') front.amount = -2
  if (mutation === 'source-target') front.target.side = 'self'
  if (mutation === 'mandatory') then.mandatory = true
  if (mutation === 'energy') then.cost.energy = { blue: 1 }
  if (mutation === 'draw-two') then.effects[0].max = 2
  if (mutation === 'hand-cap') then.effects[0].untilHandSize = 1
  expect(analyzeOfficialCardBehavior(record, card).errors).toContain('BS12-065 lacks B reduction then optional public exact LV2 Arena Cookie hand cost to bottom before draw up to one')
})
