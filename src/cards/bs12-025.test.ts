import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('025 has free On Play selecting zero to one own Caramel Choux Cookie without a color restriction', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-025') as OfficialCardRecord
  const before = structuredClone(source)
  const result = convertOfficialCardToGameCard(source)
  expect(result).toMatchObject({ status: 'converted', gameCard: { id: 'BS12-025', name: 'Mayor Cuckoobeans', energyColor: 'yellow',
    level: 1, hp: 1, attack: 1, attackCost: 1, attackEnergyCost: { yellow: 1 }, keywords: ['arena'],
    skill: { trigger: 'on-play', yourTurn: false, restSource: false, cost: { energy: {} }, effects: [
      { kind: 'gain-hp', amount: 1, target: { side: 'self', min: 0, max: 1, cardName: 'Caramel Choux Cookie' } },
    ] } } })
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Mayor Cuckoobeans')
  const effect = result.gameCard.skill?.effects[0]
  if (effect?.kind !== 'gain-hp' || !effect.target) throw new Error('Missing HP effect target')
  expect(effect.target?.energyColor).toBeUndefined()
  expect(effect.target?.sourceOnly).toBeUndefined()
  expect(effect.condition).toBeUndefined()
  expect(result.gameCard.skill?.effects).toHaveLength(1)
  expect(result.gameCard.flip).toBeUndefined()
  expect(result.gameCard.attackEffects ?? []).toEqual([])
  expect(result.gameCard.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/Q5eCbqNECwUKVcZ5fI3faQ.webp')
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  const skill = result.gameCard.skill!
  for (const mutated of [
    { ...skill, trigger: 'activate' as const }, { ...skill, yourTurn: true }, { ...skill, restSource: true },
    { ...skill, cost: { energy: { yellow: 1 } } },
    { ...skill, effects: [{ ...effect, target: { ...effect.target, cardName: undefined } }] },
    { ...skill, effects: [{ ...effect, target: { ...effect.target, side: 'opponent' as const } }] },
    { ...skill, effects: [{ ...effect, target: { ...effect.target, min: 1 } }] },
    { ...skill, effects: [{ ...effect, target: { ...effect.target, energyColor: 'yellow' as const } }] },
  ]) expect(analyzeOfficialCardBehavior(source, { ...result.gameCard, skill: mutated }).contract.status).not.toBe('verified')
  expect(source).toEqual(before)
})
