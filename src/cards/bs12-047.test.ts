import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('047 pays GG, reduces zero to one opponent attack, then independently draws at seven own supports', () => {
  const record = candidate.cards.find(card => card.cardNumber === 'BS12-047') as OfficialCardRecord
  const before = structuredClone(record)
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: {
    id: 'BS12-047', name: 'Beautiful Harmony', type: 'trap', energyColor: 'green', keywords: ['arena'],
    trap: { cost: { energy: { green: 2 }, discardHand: 0 }, effects: [
      { kind: 'modify-attack', amount: -2, duration: 'this-turn', target: { side: 'opponent', min: 0, max: 1 } },
      { kind: 'draw-up-to', max: 1, condition: { kind: 'support-count-at-least', count: 7 } },
    ] },
  } })
  if (converted.status !== 'converted' || !converted.gameCard.trap) throw new Error('Missing Harmony')
  const trap = converted.gameCard.trap
  expect(trap.effects).toHaveLength(2)
  expect(trap.condition).toBeUndefined()
  expect(trap.conditionalCost).toBeUndefined()
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  const reduction = trap.effects[0]
  const draw = trap.effects[1]
  if (draw.kind !== 'draw-up-to' || draw.condition?.kind !== 'support-count-at-least') throw new Error('Missing Then')
  for (const changed of [
    { ...trap, cost: { energy: { green: 1 } } },
    { ...trap, effects: [reduction] },
    { ...trap, effects: [draw, reduction] },
    { ...trap, effects: [reduction, { ...draw, condition: undefined }] },
    ...[{ ...draw.condition, count: 6 }, { ...draw.condition, keyword: 'arena' as const }, { ...draw.condition, energyColor: 'green' as const }, { ...draw.condition, restedOnly: true }].map(condition => ({ ...trap, effects: [reduction, { ...draw, condition }] })),
  ]) expect(analyzeOfficialCardBehavior(record, { ...converted.gameCard, trap: changed }).contract.status).not.toBe('verified')
  expect(record).toEqual(before)
})
