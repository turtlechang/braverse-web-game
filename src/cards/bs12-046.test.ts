import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('046 pays one green and draws zero to two only after an own support Cookie entry this turn', () => {
  const record = candidate.cards.find(card => card.cardNumber === 'BS12-046') as OfficialCardRecord
  const before = structuredClone(record)
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: {
    id: 'BS12-046', name: 'E-Z Camera', type: 'item', energyColor: 'green', keywords: ['arena'],
    item: { allowInactiveConditionalEffects: true, cost: { energy: { green: 1 }, discardHand: 0 }, effects: [
      { kind: 'draw-up-to', max: 2, condition: { kind: 'cookie-played-from-support-this-turn' } },
    ] },
  } })
  if (converted.status !== 'converted' || converted.gameCard.type !== 'item') throw new Error('Missing Camera')
  expect(converted.gameCard.item?.effects).toHaveLength(1)
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(before)
})
