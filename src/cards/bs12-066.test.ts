import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const record = candidate.cards.find(card => card.cardNumber === 'BS12-066') as OfficialCardRecord
const convert = () => {
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'trap') throw new Error('Missing Ending Pose')
  return result.gameCard
}
it('matches the physical B Trap: required bottom reveal, same LV2 Arena Cookie to hand, then optional opponent reduction', () => {
  const before = structuredClone(record)
  const card = convert()
  expect(card).toMatchObject({ id: 'BS12-066', type: 'trap', energyColor: 'blue', keywords: ['arena'],
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/PbwDhvQgH1K0aHBbd20V0A.webp',
    trap: { cost: { energy: { blue: 1 }, discardHand: 0 }, effects: [
      { kind: 'reveal-bottom-deck', requireCard: true, match: { type: 'cookie', level: 2, keyword: 'arena' },
        addMatchedToHand: true, effects: [
          { kind: 'modify-attack', amount: -2, duration: 'this-turn', target: { side: 'opponent', min: 0, max: 1 } },
        ] },
    ] } })
  expect(card.trap?.effects).toHaveLength(1)
  expect(analyzeOfficialCardBehavior(record).errors).toEqual([])
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(before)
})
it.each(['no-reveal', 'optional-reveal', 'no-match', 'no-level', 'no-arena', 'wrong-type', 'no-hand', 'unconditional', 'amount', 'duration', 'self', 'required-target', 'two-targets', 'color', 'extra-energy', 'free', 'extra-cost', 'extra-draw'] as const)('fails closed for incomplete or overrestricted runtime: %s', mutation => {
  const card = structuredClone(convert())
  const trap = card.trap!
  const reveal = trap.effects[0]
  if (reveal.kind !== 'reveal-bottom-deck' || !reveal.match || !reveal.effects || reveal.effects[0].kind !== 'modify-attack') throw new Error('Missing expected reveal')
  const modifier = reveal.effects[0]
  const match = reveal.match
  if (mutation === 'no-reveal') trap.effects = [modifier]
  if (mutation === 'optional-reveal') delete reveal.requireCard
  if (mutation === 'no-match') delete reveal.match
  if (mutation === 'no-level') delete match.level
  if (mutation === 'no-arena') delete match.keyword
  if (mutation === 'wrong-type') match.type = 'item'
  if (mutation === 'no-hand') delete reveal.addMatchedToHand
  if (mutation === 'unconditional') trap.effects.push(modifier)
  if (mutation === 'amount') modifier.amount = -1
  if (mutation === 'duration') modifier.duration = 'persistent'
  if (mutation === 'self') modifier.target.side = 'self'
  if (mutation === 'required-target') modifier.target.min = 1
  if (mutation === 'two-targets') modifier.target.max = 2
  if (mutation === 'color') modifier.target.energyColor = 'blue'
  if (mutation === 'extra-energy') trap.cost.energy!.green = 1
  if (mutation === 'free') trap.cost.energy = {}
  if (mutation === 'extra-cost') trap.cost.discardHand = 1
  if (mutation === 'extra-draw') reveal.effects.push({ kind: 'draw-up-to', max: 1 })
  expect(analyzeOfficialCardBehavior(record, card).errors).toContain('BS12-066 lacks B required bottom reveal, exact same LV2 Arena Cookie to hand and conditional opponent reduction')
})
