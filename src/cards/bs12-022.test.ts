import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('022 pays one hand card and selects zero to one own Arena Cookie for one HP', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-022') as OfficialCardRecord
  const snapshot = structuredClone(source)
  const conversion = convertOfficialCardToGameCard(source)
  expect(conversion).toMatchObject({ status: 'converted', gameCard: { id: 'BS12-022', name: 'Mint Wafer Cookie', energyColor: 'yellow',
    level: 1, hp: 1, attack: 1, attackCost: 1, attackEnergyCost: { yellow: 1 }, keywords: ['arena'],
    attackText: '<{Y}> Youthful Performance {da} 1', flip: { cost: { energy: {}, discardHand: 1 }, effects: [
      { kind: 'gain-hp', amount: 1, target: { side: 'self', min: 0, max: 1, keyword: 'arena' } },
    ] } } })
  if (conversion.status !== 'converted' || conversion.gameCard.type !== 'cookie') throw new Error('Missing Mint Wafer Cookie')
  expect(conversion.gameCard.skill).toBeUndefined()
  expect(conversion.gameCard.attackEffects).toBeUndefined()
  expect(conversion.gameCard.flip?.effects).toHaveLength(1)
  expect(conversion.gameCard.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/lmtRvnekrwy3QnqY04Y3RA.webp')
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  expect(source).toEqual(snapshot)
})
