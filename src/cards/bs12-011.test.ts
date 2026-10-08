import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const source = candidate.cards.find(card => card.cardNumber === 'BS12-011') as OfficialCardRecord

it('Crown Stage preserves R placement and own end-turn optional Arena Cookie readying', () => {
  expect(convertOfficialCardToGameCard(source)).toMatchObject({ status: 'converted', gameCard: {
    type: 'stage', stageAbility: { placementCost: { red: 1 }, cost: {}, restSource: false,
      endPhase: true, endPhaseScope: 'your-turn', effects: [
        { kind: 'set-cookie-active', target: { side: 'self', min: 0, max: 1, keyword: 'arena' } },
      ],
    },
  } })
})

it('strict rejects a missing ready effect, Arena filter or own end-turn timing', () => {
  const converted = convertOfficialCardToGameCard(source)
  if (converted.status !== 'converted' || !converted.gameCard.stageAbility) throw new Error('Missing stage')
  expect(analyzeOfficialCardBehavior(source, converted.gameCard).contract.status).toBe('verified')
  const ability = converted.gameCard.stageAbility
  for (const broken of [
    { ...ability, effects: [] },
    { ...ability, effects: [{ kind: 'set-cookie-active' as const, target: { side: 'self' as const, min: 0, max: 1 } }] },
    { ...ability, endPhase: false },
    { ...ability, endPhaseScope: 'opponent-turn' as const },
  ]) expect(analyzeOfficialCardBehavior(source, { ...converted.gameCard, stageAbility: broken }).contract.status).not.toBe('verified')
})
