import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const source = candidate.cards.find(card => card.cardNumber === 'BS12-084') as OfficialCardRecord
it('084 preserves separate P placement and P + REST + two trash Blockers before conditional opponent discard', () => {
  const result = convertOfficialCardToGameCard(source)
  expect(result).toMatchObject({ status: 'converted', gameCard: { id: 'BS12-084', name: 'Summer Soda Festival', type: 'stage', energyColor: 'purple', keywords: ['arena'],
    stageAbility: { placementCost: { purple: 1 }, cost: { energy: { purple: 1 }, discardHand: 0, trashToDeckBottom: { count: 2, cookieOnly: true, blockerOnly: true } },
      restSource: true, allowInactiveConditionalEffects: true,
      effects: [{ kind: 'opponent-discard-hand', count: 1, condition: { kind: 'opponent-hand-count-at-least', count: 6 } }],
    },
  } })
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
})

it.each(['placement-free', 'activate-free', 'wrong-color', 'no-rest', 'once', 'no-cookie', 'no-blocker', 'one-cost', 'three-cost', 'extra-discard', 'wrong-threshold', 'two-discard', 'no-condition', 'skip-cost-below-threshold'] as const)('084 strict rejects changed printed behavior: %s', mutation => {
  const converted = convertOfficialCardToGameCard(source)
  if (converted.status !== 'converted' || !converted.gameCard.stageAbility) throw new Error('Missing 084 stage ability')
  const card = structuredClone(converted.gameCard)
  const ability = card.stageAbility!
  const effect = ability.effects[0]
  if (effect?.kind !== 'opponent-discard-hand' || effect.condition?.kind !== 'opponent-hand-count-at-least' || !ability.cost.trashToDeckBottom) throw new Error('Missing 084 independent costs')
  if (mutation === 'placement-free') ability.placementCost = {}
  if (mutation === 'activate-free') ability.cost.energy = {}
  if (mutation === 'wrong-color') ability.cost.energy = { neutral: 1 }
  if (mutation === 'no-rest') ability.restSource = false
  if (mutation === 'once') ability.oncePerTurn = true
  if (mutation === 'no-cookie') delete ability.cost.trashToDeckBottom.cookieOnly
  if (mutation === 'no-blocker') delete ability.cost.trashToDeckBottom.blockerOnly
  if (mutation === 'one-cost') ability.cost.trashToDeckBottom.count = 1
  if (mutation === 'three-cost') ability.cost.trashToDeckBottom.count = 3
  if (mutation === 'extra-discard') ability.cost.discardHand = 1
  if (mutation === 'wrong-threshold') effect.condition.count = 5
  if (mutation === 'two-discard') effect.count = 2
  if (mutation === 'no-condition') delete effect.condition
  if (mutation === 'skip-cost-below-threshold') ability.allowInactiveConditionalEffects = false
  expect(analyzeOfficialCardBehavior(source, card).contract.status).not.toBe('verified')
})
