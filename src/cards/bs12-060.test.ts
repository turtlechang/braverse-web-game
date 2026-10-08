import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('060 pays one hand card and selects zero to one own Arena Cookie for one HP', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-060') as OfficialCardRecord
  const snapshot = structuredClone(source)
  const conversion = convertOfficialCardToGameCard(source)
  expect(conversion).toMatchObject({ status: 'converted', gameCard: { id: 'BS12-060', name: 'Sorbet Shark Cookie', cardColor: 'blue', energyColor: 'blue',
    level: 2, hp: 2, attack: 2, attackCost: 2, attackEnergyCost: { blue: 2 }, keywords: ['arena'],
    attackText: '<{B}{B}> 0o0o0O! oOOo0! {da} 2', flip: { cost: { energy: {}, discardHand: 1 }, effects: [
      { kind: 'gain-hp', amount: 1, target: { side: 'self', min: 0, max: 1, keyword: 'arena' } },
    ] } } })
  if (conversion.status !== 'converted' || conversion.gameCard.type !== 'cookie') throw new Error('Missing Sorbet Shark Cookie')
  expect(conversion.gameCard.skill).toBeUndefined()
  expect(conversion.gameCard.attackEffects).toBeUndefined()
  expect(conversion.gameCard.flip?.effects).toHaveLength(1)
  expect(conversion.gameCard.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/lmlbEAHLGtBTLdMgG32FvA.webp')
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  expect(source).toEqual(snapshot)
})
