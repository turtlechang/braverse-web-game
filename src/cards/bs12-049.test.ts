import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('049 pays G for optional opponent minus one and separately offers an Arena support return cost for optional draw', () => {
  const record = candidate.cards.find(card => card.cardNumber === 'BS12-049') as OfficialCardRecord
  const before = structuredClone(record)
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: {
    name: 'Immersed Audience', type: 'trap', energyColor: 'green', keywords: ['arena'],
    trap: { cost: { energy: { green: 1 }, discardHand: 0 }, effects: [
      { kind: 'modify-attack', amount: -1, duration: 'this-turn', target: { side: 'opponent', min: 0, max: 1 } },
      { kind: 'optional-cost-attack', resolution: 'ability', cost: { energy: {}, discardHand: 0, supportToHand: 1, supportToHandKeyword: 'arena' }, effects: [{ kind: 'draw-up-to', max: 1 }] },
    ] },
  } })
  if (converted.status !== 'converted' || !converted.gameCard.trap) throw new Error('Missing Audience')
  const trap = converted.gameCard.trap
  expect(trap.condition).toBeUndefined()
  expect(trap.conditionalCost).toBeUndefined()
  expect(trap.effects).toHaveLength(2)
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  const then = trap.effects[1]
  if (then.kind !== 'optional-cost-attack') throw new Error('Missing Then cost')
  for (const changed of [
    { ...trap, cost: { energy: {} } }, { ...trap, effects: [trap.effects[0], ...then.effects] },
    { ...trap, effects: [then, trap.effects[0]] },
    ...[
      { ...then.cost, supportToHandKeyword: undefined }, { ...then.cost, supportToHand: 0 },
      { ...then.cost, supportToHandType: 'cookie' as const }, { ...then.cost, supportToHandColor: 'green' as const },
      { ...then.cost, energy: { green: 1 } },
    ].map(cost => ({ ...trap, effects: [trap.effects[0], { ...then, cost }] })),
    { ...trap, effects: [trap.effects[0], { ...then, mandatory: true }] },
  ]) expect(analyzeOfficialCardBehavior(record, { ...converted.gameCard, trap: changed }).contract.status).not.toBe('verified')
  expect(record).toEqual(before)
})
