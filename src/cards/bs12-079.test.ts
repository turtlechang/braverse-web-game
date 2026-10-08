import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('079 preserves the independently read N ordinary attack without inventing a skill or Then', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-079') as OfficialCardRecord
  const before = structuredClone(source)
  const conversion = convertOfficialCardToGameCard(source)
  expect(conversion.status).toBe('converted')
  if (conversion.status !== 'converted' || conversion.gameCard.type !== 'cookie') throw new Error('Missing Currant Cream Cookie')
  expect(conversion.gameCard).toMatchObject({ id: 'BS12-079', name: 'Currant Cream Cookie', cardColor: 'purple', energyColor: 'purple', level: 1, hp: 2,
    attack: 1, attackCost: 1, attackEnergyCost: { neutral: 1 }, keywords: ['arena'],
    attackText: '<{N}> Sincere Stage Planning {da} 1', imageUrl: 'https://cookierunbraverse.com/data/en_storage/B0G6buSRUWWB6aOSNNSU0w.webp' })
  expect(conversion.gameCard.flip).toBeUndefined()
  expect(conversion.gameCard.skill).toBeUndefined()
  expect(conversion.gameCard.attackEffects ?? []).toEqual([])
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  expect(source).toEqual(before)
})
