import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const record = candidate.cards.find(card => card.cardNumber === 'BS12-069') as OfficialCardRecord
const convert = () => {
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'item' || !result.gameCard.item) throw new Error('Missing Pop Pop Photocard')
  return result.gameCard
}
it('matches printed BB required bottom reveal, same LV2 Arena Cookie to hand before opponent zero to one damage', () => {
  const snapshot = structuredClone(record)
  const card = convert()
  expect(card).toMatchObject({ name: 'Pop Pop Photocard', type: 'item', energyColor: 'blue', keywords: ['arena'],
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/w6zLQ6rva-y0pRclBPe3Lw.webp',
    item: { cost: { blue: 2 }, effects: [{ kind: 'reveal-bottom-deck', requireCard: true,
      match: { type: 'cookie', level: 2, keyword: 'arena' }, addMatchedToHand: true,
      effects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }] }] } })
  expect(card.item!.effects).toHaveLength(1)
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(snapshot)
})
it.each(['free', 'one-energy', 'extra-energy', 'extra-hand', 'no-reveal', 'optional-reveal', 'no-return', 'no-match', 'wrong-level', 'no-arena', 'no-cookie', 'extra-color', 'extra-condition', 'mismatch-moves', 'no-damage', 'two-damage', 'self-target', 'required-target', 'two-targets', 'filtered-target', 'source-energy'] as const)('fails closed for incorrect runtime: %s', mutation => {
  const card = structuredClone(convert())
  const ability = card.item!
  const reveal = ability.effects[0]
  if (reveal.kind !== 'reveal-bottom-deck' || !reveal.match) throw new Error('Missing bottom match')
  const match = reveal.match
  const damage = reveal.effects![0]
  if (damage.kind !== 'damage') throw new Error('Missing conditional damage')
  if (mutation === 'free') ability.cost = {}
  if (mutation === 'one-energy') ability.cost.blue = 1
  if (mutation === 'extra-energy') ability.cost.green = 1
  if (mutation === 'extra-hand') ability.cost.discardHand = 1
  if (mutation === 'no-reveal') ability.effects = [damage]
  if (mutation === 'optional-reveal') delete reveal.requireCard
  if (mutation === 'no-return') delete reveal.addMatchedToHand
  if (mutation === 'no-match') delete reveal.match
  if (mutation === 'wrong-level') match.level = 3
  if (mutation === 'no-arena') delete match.keyword
  if (mutation === 'no-cookie') match.type = 'item'
  if (mutation === 'extra-color') Object.assign(match, { energyColor: 'blue' })
  if (mutation === 'extra-condition') reveal.condition = { kind: 'support-count-at-least', count: 3 }
  if (mutation === 'mismatch-moves') reveal.otherwiseDestination = 'hand'
  if (mutation === 'no-damage') reveal.effects = []
  if (mutation === 'two-damage') damage.amount = 2
  if (mutation === 'self-target') damage.target.side = 'self'
  if (mutation === 'required-target') damage.target.min = 1
  if (mutation === 'two-targets') damage.target.max = 2
  if (mutation === 'filtered-target') damage.target.energyColor = 'blue'
  if (mutation === 'source-energy') ability.sourceEnergy = { blue: 1 }
  expect(analyzeOfficialCardBehavior(record, card).errors).toContain('BS12-069 lacks BB required bottom reveal, exact same LV2 Arena Cookie to hand then opponent zero to one damage')
})
