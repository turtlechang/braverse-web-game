import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const source = candidate.cards.find(card => card.cardNumber === 'BS12-012') as OfficialCardRecord

it('Sweet Jams Guitar pays R and readies zero to two own red Arena Cookies', () => {
  expect(convertOfficialCardToGameCard(source)).toMatchObject({ status: 'converted', gameCard: {
    type: 'item', item: { cost: { red: 1 }, effects: [
      { kind: 'set-cookie-active', target: { side: 'self', min: 0, max: 2, energyColor: 'red', keyword: 'arena' } },
    ] },
  } })
})

it('strict rejects missing readying, color, Arena or optional target bounds', () => {
  const converted = convertOfficialCardToGameCard(source)
  if (converted.status !== 'converted' || !converted.gameCard.item) throw new Error('Missing item')
  expect(analyzeOfficialCardBehavior(source, converted.gameCard).contract.blockers).toEqual([])
  expect(analyzeOfficialCardBehavior(source, converted.gameCard).contract.status).toBe('verified')
  const item = converted.gameCard.item
  for (const target of [
    { side: 'self' as const, min: 0, max: 2, keyword: 'arena' as const },
    { side: 'self' as const, min: 0, max: 2, energyColor: 'red' as const },
    { side: 'self' as const, min: 1, max: 2, energyColor: 'red' as const, keyword: 'arena' as const },
    { side: 'self' as const, min: 0, max: 1, energyColor: 'red' as const, keyword: 'arena' as const },
    { side: 'opponent' as const, min: 0, max: 2, energyColor: 'red' as const, keyword: 'arena' as const },
  ]) expect(analyzeOfficialCardBehavior(source, { ...converted.gameCard, item: { ...item,
    effects: [{ kind: 'set-cookie-active', target }],
  } }).contract.status).not.toBe('verified')
  expect(analyzeOfficialCardBehavior(source, { ...converted.gameCard, item: { ...item, effects: [] } }).contract.status).not.toBe('verified')
})
