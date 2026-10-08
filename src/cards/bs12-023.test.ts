import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('023 has free On Play gaining one source HP for every three own break Arena Cookies', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-023') as OfficialCardRecord
  const snapshot = structuredClone(source)
  const result = convertOfficialCardToGameCard(source)
  expect(result).toMatchObject({ status: 'converted', gameCard: { id: 'BS12-023', name: 'Chocolate Bonbon Cookie', energyColor: 'yellow',
    level: 2, hp: 4, keywords: ['arena'], attack: 3, attackCost: 3, attackEnergyCost: { yellow: 2, neutral: 1 },
    attackText: '<{Y}{Y}{N}> Detailed Design {da} 3',
    skill: { trigger: 'on-play', yourTurn: false, restSource: false, cost: { energy: {} }, effects: [
      { kind: 'gain-hp', amount: 1, perBreakCard: { keyword: 'arena', divisor: 3 }, target: { side: 'self', min: 1, max: 1, sourceOnly: true } },
    ] } } })
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Chocolate Bonbon Cookie')
  expect(result.gameCard.flip).toBeUndefined()
  expect(result.gameCard.attackEffects ?? []).toEqual([])
  expect(result.gameCard.skill?.effects).toHaveLength(1)
  expect(result.gameCard.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/yn9ig0NwQH5DT6WyEtpEIg.webp')
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  expect(source).toEqual(snapshot)
  expect(source.energyType).toBe('YELLOW MIX')
})
