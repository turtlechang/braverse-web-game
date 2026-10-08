import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const record = candidate.cards.find(card => card.cardNumber === 'BS12-068') as OfficialCardRecord
const convert = () => {
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'item' || !result.gameCard.item) throw new Error('Missing Bone-afide Multivitamin Jelly ability')
  return result.gameCard
}
it('matches the physical B draw zero to one, then conditional opponent support zero to two to its owner hand', () => {
  const before = structuredClone(record)
  const card = convert()
  expect(card).toMatchObject({ id: 'BS12-068', name: 'Bone-afide Multivitamin Jelly', type: 'item', energyColor: 'blue', keywords: ['arena'],
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/Ze0QuQjwghjF0f5LaJePsA.webp',
    item: { cost: { blue: 1 }, effects: [
      { kind: 'draw-up-to', max: 1 },
      { kind: 'support-to-hand', side: 'opponent', amount: 2, optional: true, condition: { kind: 'support-count-less-than-opponent', difference: 2 } },
    ] } })
  expect(card.item!.effects).toHaveLength(2)
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(before)
})
it.each(['free', 'extra-energy', 'extra-hand-cost', 'no-draw', 'extra-draw', 'condition-before-draw', 'draw-hand-cap', 'no-return', 'self-return', 'mandatory-return', 'one-return', 'three-return', 'no-condition', 'difference-one', 'extra-type', 'extra-color', 'extra-level', 'any-number', 'keep-count', 'nested-draw', 'source-energy'] as const)('fails closed for incorrect runtime: %s', mutation => {
  const card = structuredClone(convert())
  const ability = card.item!
  const draw = ability.effects[0]
  const bounce = ability.effects[1]
  if (draw.kind !== 'draw-up-to' || bounce.kind !== 'support-to-hand') throw new Error('Missing multivitamin effects')
  if (mutation === 'free') ability.cost = {}
  if (mutation === 'extra-energy') ability.cost.green = 1
  if (mutation === 'extra-hand-cost') ability.cost.discardHand = 1
  if (mutation === 'no-draw') ability.effects.splice(0, 1)
  if (mutation === 'extra-draw') draw.max = 2
  if (mutation === 'condition-before-draw') draw.condition = bounce.condition
  if (mutation === 'draw-hand-cap') draw.untilHandSize = 3
  if (mutation === 'no-return') ability.effects.pop()
  if (mutation === 'self-return') bounce.side = 'self'
  if (mutation === 'mandatory-return') delete bounce.optional
  if (mutation === 'one-return') bounce.amount = 1
  if (mutation === 'three-return') bounce.amount = 3
  if (mutation === 'no-condition') delete bounce.condition
  if (mutation === 'difference-one') bounce.condition = { kind: 'support-count-less-than-opponent', difference: 1 }
  if (mutation === 'extra-type') bounce.cardType = 'cookie'
  if (mutation === 'extra-color') bounce.energyColor = 'blue'
  if (mutation === 'extra-level') bounce.maxLevel = 2
  if (mutation === 'any-number') bounce.anyNumber = true
  if (mutation === 'keep-count') bounce.keepCount = 2
  if (mutation === 'nested-draw') bounce.thenEffects = [{ kind: 'draw-up-to', max: 1 }]
  if (mutation === 'source-energy') ability.sourceEnergy = { blue: 1 }
  expect(analyzeOfficialCardBehavior(record, card).errors).toContain('BS12-068 lacks B optional one draw then exact support difference two and opponent zero to two supports returned to opponent hand')
})
