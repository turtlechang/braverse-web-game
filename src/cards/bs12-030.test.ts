import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('030 separates Y placement from Y and source rest activation, then conditionally grants optional own Cookie one HP', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-030') as OfficialCardRecord
  const snapshot = structuredClone(source)
  const converted = convertOfficialCardToGameCard(source)
  expect(converted).toMatchObject({ status: 'converted', gameCard: { type: 'stage', energyColor: 'yellow', keywords: ['arena'],
    stageAbility: { placementCost: { yellow: 1 }, cost: { energy: { yellow: 1 }, discardHand: 0 }, restSource: true,
      allowInactiveConditionalEffects: true, effects: [{ kind: 'gain-hp', amount: 1, target: { side: 'self', min: 0, max: 1 },
        condition: { kind: 'arena-cookie-placed-in-break-this-turn' } }] },
  } })
  if (converted.status !== 'converted' || !converted.gameCard.stageAbility) throw new Error('030 stage missing')
  expect(converted.gameCard.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/lx0hvfHL1nKSKOOyz2uYpg.webp')
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  const ability = converted.gameCard.stageAbility
  const effect = ability.effects[0]
  if (effect.kind !== 'gain-hp' || !effect.target) throw new Error('030 gain HP target missing')
  const mutations = [
    { ...ability, placementCost: {} }, { ...ability, cost: { energy: {} } },
    { ...ability, restSource: false }, { ...ability, allowInactiveConditionalEffects: false },
    { ...ability, oncePerTurn: true }, { ...ability, ownerIndependent: true }, { ...ability, endPhase: true },
    { ...ability, effects: [{ ...effect, condition: undefined }] },
    { ...ability, effects: [{ ...effect, condition: { kind: 'break-area-card-count-at-least' as const, side: 'self' as const, count: 1, keyword: 'arena' as const } }] },
    ...[{ ...effect.target, side: 'opponent' as const }, { ...effect.target, keyword: 'arena' as const }, { ...effect.target, energyColor: 'yellow' as const }, { ...effect.target, min: 1 }, { ...effect.target, max: 2 }].map(target => ({ ...ability, effects: [{ ...effect, target }] })),
    { ...ability, effects: [{ ...effect, amount: 2 }] },
  ]
  for (const changed of mutations) expect(analyzeOfficialCardBehavior(source, { ...converted.gameCard, stageAbility: changed }).contract.status).not.toBe('verified')
  expect(source).toEqual(snapshot)
})
