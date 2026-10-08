import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('028 pays Y1 and one hand Arena Cookie to break before drawing zero to three', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-028') as OfficialCardRecord
  const snapshot = structuredClone(source)
  const converted = convertOfficialCardToGameCard(source)
  expect(converted).toMatchObject({ status: 'converted', gameCard: { type: 'item', energyColor: 'yellow', keywords: ['arena'],
    item: { cost: { energy: { yellow: 1 }, discardHand: 0, handToBreakArea: { count: 1, keyword: 'arena' } }, effects: [{ kind: 'draw-up-to', max: 3 }] },
  } })
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  if (converted.status !== 'converted' || !converted.gameCard.item) throw new Error('028 item missing')
  const item = converted.gameCard.item
  const mutations = [
    { ...item, cost: { energy: { yellow: 1 } } },
    { ...item, cost: { ...item.cost, handToBreakArea: { count: 1 } } },
    { ...item, cost: { ...item.cost, handToBreakArea: { count: 0, keyword: 'arena' as const } } },
    { ...item, cost: { ...item.cost, handToBreakArea: { count: 1, keyword: 'arena' as const, energyColor: 'yellow' as const } } },
    { ...item, cost: { ...item.cost, energy: {} } },
    { ...item, effects: [{ kind: 'draw' as const, amount: 3 }] },
    { ...item, effects: [{ kind: 'draw-up-to' as const, max: 2 }] },
  ]
  for (const changed of mutations) expect(analyzeOfficialCardBehavior(source, { ...converted.gameCard, item: changed }).contract.status).not.toBe('verified')
  expect(converted.gameCard.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/Zrgn6srz9B0HvvyCEv0ZXQ.webp')
  expect(source).toEqual(snapshot)
})
