import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('026 pays a hand card before its OR condition and damages only the original defender', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-026') as OfficialCardRecord
  const before = structuredClone(source)
  const result = convertOfficialCardToGameCard(source)
  expect(result).toMatchObject({ status: 'converted', gameCard: { name: 'Banana Roti Cookie', energyColor: 'yellow', keywords: ['arena'],
    level: 3, hp: 5, attack: 3, attackEnergyCost: { yellow: 3 }, attackEffects: [{ kind: 'optional-cost-attack',
      cost: { energy: {}, discardHand: 1 }, payBeforeCondition: true, effects: [{ kind: 'damage', amount: 1,
        target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true }, condition: { kind: 'any-of', conditions: [
          { kind: 'break-area-card-count-at-least', side: 'self', count: 4, keyword: 'arena' }, { kind: 'arena-cookie-placed-in-break-this-turn' },
        ] } }],
    }] } })
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Banana Roti')
  expect(result.gameCard.skill).toBeUndefined()
  expect(result.gameCard.flip).toBeUndefined()
  expect(result.gameCard.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/03BYT8BtDOzsBLDNDJy2yQ.webp')
  expect(result.gameCard.attackEffects).toHaveLength(1)
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  const optional = result.gameCard.attackEffects?.[0]
  if (optional?.kind !== 'optional-cost-attack') throw new Error('Missing Then cost')
  const damage = optional.effects[0]
  if (damage?.kind !== 'damage' || damage.condition?.kind !== 'any-of') throw new Error('Missing OR damage')
  const mutations = [
    { ...optional, payBeforeCondition: false }, { ...optional, mandatory: true }, { ...optional, resolution: 'ability' as const },
    { ...optional, cost: { energy: { yellow: 1 }, discardHand: 1 } }, { ...optional, cost: { energy: {}, discardHand: 0 } },
    { ...optional, effects: [{ ...damage, target: { ...damage.target, attackTargetOnly: false } }] },
    { ...optional, effects: [{ ...damage, amount: 2 }] },
    { ...optional, effects: [{ ...damage, condition: { ...damage.condition, kind: 'all-of' as const } }] },
    ...damage.condition.conditions.map(condition => ({ ...optional, effects: [{ ...damage, condition }] })),
    { ...optional, effects: [{ ...damage, condition: { ...damage.condition, conditions: [
      { kind: 'break-area-card-count-at-least' as const, side: 'self' as const, count: 4, keyword: 'arena' as const, color: 'yellow' as const },
      damage.condition.conditions[1],
    ] } }] },
  ]
  for (const effect of mutations) expect(analyzeOfficialCardBehavior(source, { ...result.gameCard, attackEffects: [effect] }).contract.status).not.toBe('verified')
  expect(source).toEqual(before)
})
