import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const record = candidate.cards.find(card => card.cardNumber === 'BS12-067') as OfficialCardRecord
const convert = () => {
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'stage' || !result.gameCard.stageAbility) throw new Error('Missing Comeback Stage ability')
  return result.gameCard
}
it('matches the physical Comeback Stage: separate B placement and B source REST activation, required exact bottom Cookie to hand', () => {
  const before = structuredClone(record)
  const card = convert()
  expect(card).toMatchObject({ id: 'BS12-067', name: 'Comeback Stage', type: 'stage', energyColor: 'blue', keywords: ['arena'],
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/aAnhxJ4YX4GZE-uFJVW2WQ.webp',
    stageAbility: { placementCost: { blue: 1 }, cost: { energy: { blue: 1 }, discardHand: 0 }, restSource: true,
      effects: [{ kind: 'reveal-bottom-deck', requireCard: true, match: { type: 'cookie', level: 2, keyword: 'arena' }, addMatchedToHand: true }] } })
  const ability = card.stageAbility!
  expect(ability.effects).toHaveLength(1)
  expect(ability.oncePerTurn).not.toBe(true)
  expect(ability.triggered).not.toBe(true)
  expect(ability.endPhase).not.toBe(true)
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(before)
})
it.each(['free-placement', 'extra-placement', 'free-activation', 'extra-activation', 'extra-hand-cost', 'no-rest', 'once', 'triggered', 'end-phase', 'owner-independent', 'no-reveal', 'optional-reveal', 'no-match', 'no-level', 'no-arena', 'wrong-type', 'no-hand', 'nested-draw', 'outer-condition', 'extra-match'] as const)('fails closed for incorrect runtime: %s', mutation => {
  const card = structuredClone(convert())
  const ability = card.stageAbility!
  const reveal = ability.effects[0]
  if (reveal.kind !== 'reveal-bottom-deck' || !reveal.match) throw new Error('Missing bottom reveal')
  const match = reveal.match
  if (mutation === 'free-placement') ability.placementCost = {}
  if (mutation === 'extra-placement') ability.placementCost.green = 1
  if (mutation === 'free-activation') ability.cost = {}
  if (mutation === 'extra-activation') ability.cost = { energy: { blue: 1, green: 1 } }
  if (mutation === 'extra-hand-cost') ability.cost = { energy: { blue: 1 }, discardHand: 1 }
  if (mutation === 'no-rest') ability.restSource = false
  if (mutation === 'once') ability.oncePerTurn = true
  if (mutation === 'triggered') ability.triggered = true
  if (mutation === 'end-phase') ability.endPhase = true
  if (mutation === 'owner-independent') ability.ownerIndependent = true
  if (mutation === 'no-reveal') ability.effects = []
  if (mutation === 'optional-reveal') delete reveal.requireCard
  if (mutation === 'no-match') delete reveal.match
  if (mutation === 'no-level') delete match.level
  if (mutation === 'no-arena') delete match.keyword
  if (mutation === 'wrong-type') match.type = 'item'
  if (mutation === 'no-hand') delete reveal.addMatchedToHand
  if (mutation === 'nested-draw') reveal.effects = [{ kind: 'draw-up-to', max: 1 }]
  if (mutation === 'outer-condition') reveal.condition = { kind: 'support-count-at-least', count: 7 }
  if (mutation === 'extra-match') Object.assign(match, { energyColor: 'blue' })
  expect(analyzeOfficialCardBehavior(record, card).errors).toContain('BS12-067 lacks separate B placement and B source REST activation with required exact LV2 Arena Cookie bottom return only')
})
