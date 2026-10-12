import { describe, expect, it } from 'vitest'
import document from '../../data/cards/official-st6-002.en.json'
import { createCard } from './starter-deck'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { createBattleState, item } from './test-helpers/battle-helpers'

// Rule integration fixtures; these synthetic HP resources are not physical-card Browser acceptance.
const fixture = () => {
  const state = createBattleState()
  const raw = document.cards.find(card => card.cardNumber === 'ST6-002') as OfficialCardRecord
  const card = createCard(raw, 'player-two', 1)
  if (card.type !== 'cookie') throw new Error('Expected Cookie')
  state.players['player-two'].battleArea = [{ card, rested: false,
    hpCards: Array.from({ length: 6 }, (_, i) => item(`source-hp-${i}`)), battleEntryId: 'fire:entry' }]
  state.players['player-two'].supportArea.push({ card: item('extra-red'), rested: false })
  return state
}
const attackThen = () => {
  let state = fixture()
  state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-two',
    attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
    targetInstanceId: 'defender', supportPaymentIds: ['p2-support', 'extra-red'] })
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
  state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-one' })
  expect(state.pendingBattle?.stage).toBe('attack-effect')
  state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-two', targetIds: [] })
  expect(state.pendingOptionalCostAttack).toBeTruthy()
  return state
}

describe('ST6-002 promoted rules integration', () => {
  it('normal RR1 opens optional HP payment without spending HP yet; skipping leaves only normal damage', () => {
    const state = attackThen()
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(6)
    expect(state.pendingOptionalCostAttack?.cost.hpToTrash).toEqual({ amount: 1, sourceOnly: true })
    const skipped = applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId: 'player-two', action: 'skip' })
    expect(skipped.players['player-two'].battleArea[0].hpCards).toHaveLength(6)
    expect(skipped.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
    expect(skipped.pendingBattle).toBeNull()
  })

  it('pays exactly the source top HP and deals 2 to the original defender, without more support energy', () => {
    const state = attackThen()
    const source = state.players['player-two'].battleArea[0]
    let paid = applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId: 'player-two', action: 'pay',
      hpToTrashIds: [source.card.instanceId], targetIds: ['defender'] })
    expect(paid.players['player-two'].battleArea[0].hpCards).toHaveLength(5)
    expect(paid.players['player-two'].discardPile.map(c => c.instanceId)).toContain('source-hp-5')
    while (paid.pendingBattle?.stage === 'damage') {
      paid = applyGameCommand(paid, { kind: 'resolve-next-damage', playerId: 'player-one' })
    }
    expect(paid.players['player-one'].breakArea.map(c => c.instanceId)).toContain('defender')
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(6)
  })

  it('rejects another Cookie as source-only HP payment and a different defender target', () => {
    const state = attackThen()
    expect(() => applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId: 'player-two', action: 'pay',
      hpToTrashIds: ['defender'], targetIds: ['defender'] })).toThrow()
    expect(() => applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId: 'player-two', action: 'pay',
      hpToTrashIds: [state.players['player-two'].battleArea[0].card.instanceId], targetIds: ['missing-defender'] })).toThrow()
  })

  it('Activate pays R once, deals 1 without HP cost or REST, and allows choosing zero', () => {
    for (const targets of [[], ['defender']]) {
      const state = fixture(), source = state.players['player-two'].battleArea[0]
      const command = { kind: 'activate-skill' as const, playerId: 'player-two' as const, trigger: 'activate' as const,
        sourceInstanceId: source.card.instanceId, paymentIds: ['p2-support'], effectTargets: [targets] }
      const result = applyGameCommand(state, command)
      expect(result.players['player-two'].battleArea[0].hpCards).toHaveLength(6)
      expect(result.players['player-two'].battleArea[0].rested).toBe(false)
      expect(result.players['player-two'].supportArea[0].rested).toBe(true)
      expect(result.players['player-one'].battleArea[0].hpCards).toHaveLength(targets.length ? 2 : 3)
      expect(() => applyGameCommand(result, { ...command, paymentIds: ['extra-red'] })).toThrow()
    }
  })
})
