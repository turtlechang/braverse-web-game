import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('024 preserves printed two HP, yellow MIX and a neutral ordinary one attack without abilities', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-024') as OfficialCardRecord
  const before = structuredClone(source)
  const conversion = convertOfficialCardToGameCard(source)
  expect(conversion.status).toBe('converted')
  if (conversion.status !== 'converted' || conversion.gameCard.type !== 'cookie') throw new Error('Missing GingerBrave')
  expect(conversion.gameCard).toMatchObject({ id: 'BS12-024', name: 'GingerBrave', energyColor: 'yellow', level: 1, hp: 2,
    attack: 1, attackCost: 1, attackEnergyCost: { neutral: 1 }, keywords: ['arena'],
    attackText: '<{N}> Algorithmic Selection {da} 1', imageUrl: 'https://cookierunbraverse.com/data/en_storage/FSvkNQDCtFMX5_va7WS7Og.webp' })
  expect(conversion.gameCard.skill).toBeUndefined()
  expect(conversion.gameCard.flip).toBeUndefined()
  expect(conversion.gameCard.effects ?? []).toEqual([])
  expect(conversion.gameCard.attackEffects ?? []).toEqual([])
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  expect(source.energyType).toBe('YELLOW MIX')
  expect(source).toEqual(before)
})
