import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('050 pays exactly GGG then optionally places one own trash Arena Cookie into support REST', () => {
  const record = candidate.cards.find(c => c.cardNumber === 'BS12-050') as OfficialCardRecord
  const before = structuredClone(record)
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: { name: 'Wonderful Melody', type: 'item', energyColor: 'green', keywords: ['arena'], item: {
    cost: { energy: { green: 3 }, discardHand: 0 }, effects: [{ kind: 'trash-to-support', amount: 1, cookieOnly: true, keyword: 'arena', rested: true, optional: true }],
  } } })
  if (converted.status !== 'converted' || !converted.gameCard.item) throw new Error('Missing Melody')
  const item = converted.gameCard.item
  expect(item.effects).toHaveLength(1)
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  for (const changed of [
    { ...item, cost: { energy: { green: 2 } } },
    ...[{ keyword: undefined }, { cookieOnly: false }, { rested: false }, { optional: false }, { amount: 2 }, { energyColor: 'green' as const }, { maxLevel: 1 }]
      .map(patch => ({ ...item, effects: [{ ...item.effects[0], ...patch }] })),
  ]) expect(analyzeOfficialCardBehavior(record, { ...converted.gameCard, item: changed }).contract.status).not.toBe('verified')
  expect(record).toEqual(before)
})
