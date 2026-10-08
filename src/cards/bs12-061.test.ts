import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('061 preserves printed two HP, blue and a neutral ordinary one attack without abilities', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-061') as OfficialCardRecord
  const before = structuredClone(source)
  const conversion = convertOfficialCardToGameCard(source)
  expect(conversion.status).toBe('converted')
  if (conversion.status !== 'converted' || conversion.gameCard.type !== 'cookie') throw new Error('Missing Sonic Water Cookie')
  expect(conversion.gameCard).toMatchObject({ id: 'BS12-061', name: 'Sonic Water Cookie', cardColor: 'blue', energyColor: 'blue', level: 1, hp: 2,
    attack: 1, attackCost: 1, attackEnergyCost: { neutral: 1 }, keywords: ['arena'],
    attackText: '<{N}> Infinite Blade Attack {da} 1', imageUrl: 'https://cookierunbraverse.com/data/en_storage/IFXecKoajDJrf2R4aOtI9Q.webp' })
  expect(conversion.gameCard.skill).toBeUndefined()
  expect(conversion.gameCard.flip).toBeUndefined()
  expect(conversion.gameCard.effects ?? []).toEqual([])
  expect(conversion.gameCard.attackEffects ?? []).toEqual([])
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  expect(source).toEqual(before)
})
