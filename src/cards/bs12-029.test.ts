import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('029 pays YY, reduces optional opponent attack by two, then draws up to one only for four own yellow Arena break Cookies', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-029') as OfficialCardRecord
  const snapshot = structuredClone(source)
  const converted = convertOfficialCardToGameCard(source)
  expect(converted).toMatchObject({ status: 'converted', gameCard: { type: 'trap', energyColor: 'yellow', keywords: ['arena'],
    trap: { cost: { energy: { yellow: 2 }, discardHand: 0 }, effects: [
      { kind: 'modify-attack', amount: -2, duration: 'this-turn', target: { side: 'opponent', min: 0, max: 1 } },
      { kind: 'draw-up-to', max: 1, condition: { kind: 'break-area-card-count-at-least', side: 'self', count: 4, color: 'yellow', keyword: 'arena' } },
    ] },
  } })
  if (converted.status !== 'converted' || !converted.gameCard.trap) throw new Error('029 trap missing')
  expect(converted.gameCard.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/-p1avcr8zVzKmXHbe05VmQ.webp')
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  const trap = converted.gameCard.trap
  expect(trap.condition).toBeUndefined()
  expect(trap.conditionalCost).toBeUndefined()
  const reduction = trap.effects[0]
  const draw = trap.effects[1]
  if (reduction.kind !== 'modify-attack' || draw.kind !== 'draw-up-to' || draw.condition?.kind !== 'break-area-card-count-at-least') throw new Error('029 ordered effects missing')
  const mutations = [
    { ...trap, cost: { energy: { yellow: 1 } } },
    { ...trap, conditionalCost: { condition: { kind: 'break-area-card-count-at-least' as const, count: 4, color: 'yellow' as const, keyword: 'arena' as const }, cost: { energy: {} } } },
    { ...trap, effects: [reduction] },
    { ...trap, effects: [draw, reduction] },
    { ...trap, effects: [reduction, { ...draw, condition: undefined }] },
    ...[{ ...draw.condition, color: undefined }, { ...draw.condition, keyword: undefined }, { ...draw.condition, side: 'opponent' as const }, { ...draw.condition, count: 3 }].map(condition => ({ ...trap, effects: [reduction, { ...draw, condition }] })),
    { ...trap, effects: [{ ...reduction, target: { ...reduction.target, min: 1 } }, draw] },
    { ...trap, effects: [reduction, { ...draw, max: 2 }] },
  ]
  for (const changed of mutations) expect(analyzeOfficialCardBehavior(source, { ...converted.gameCard, trap: changed }).contract.status).not.toBe('verified')
  expect(source).toEqual(snapshot)
})
