import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('039 preserves the independently read NNN ordinary attack without inventing a skill or Then', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-039') as OfficialCardRecord
  const before = structuredClone(source)
  const conversion = convertOfficialCardToGameCard(source)
  expect(conversion.status).toBe('converted')
  if (conversion.status !== 'converted' || conversion.gameCard.type !== 'cookie') throw new Error('Missing Melon Soda Cookie')
  expect(conversion.gameCard).toMatchObject({ id: 'BS12-039', name: 'Melon Soda Cookie', energyColor: 'green', level: 3, hp: 4,
    attack: 4, attackCost: 3, attackEnergyCost: { neutral: 3 }, keywords: ['arena'],
    attackText: '<{N}{N}{N}> Soda Splash Party {da} 4', imageUrl: source.imageUrl })
  expect(conversion.gameCard.skill).toBeUndefined()
  expect(conversion.gameCard.attackEffects ?? []).toEqual([])
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  expect(source).toEqual(before)
})
