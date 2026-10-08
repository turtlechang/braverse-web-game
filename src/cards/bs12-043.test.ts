import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('043 counts green Arena support cards and optionally rests one opponent support', () => {
  const record = candidate.cards.find(card => card.cardNumber === 'BS12-043') as OfficialCardRecord
  const before = structuredClone(record)
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: {
    id: 'BS12-043', name: 'Coffee Candy Cookie', energyColor: 'green', level: 3, hp: 3,
    attack: 3, attackCost: 3, attackEnergyCost: { green: 3 }, keywords: ['arena'],
    attackText: '<{G}{G}{G}> Luggage Carrying {da} 3',
    flip: { cost: { energy: {}, discardHand: 0 }, effects: [{ kind: 'rest-support', side: 'opponent', amount: 1, optional: true,
      condition: { kind: 'support-count-at-least', count: 5, energyColor: 'green', keyword: 'arena' } }] },
  } })
  if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('Missing Coffee Candy')
  expect(converted.gameCard.skill).toBeUndefined()
  expect(converted.gameCard.attackEffects).toBeUndefined()
  expect(converted.gameCard.flip?.effects).toHaveLength(1)
  expect(converted.gameCard.flip?.effects[0]).not.toHaveProperty('activeOnly', true)
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(before)
})
