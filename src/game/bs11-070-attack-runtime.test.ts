import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createBs11070AttackDemoState } from './demo'

describe('BS11-070 Pure Vanilla Cookie attack Then deck placement', () => {
  it.each([['top', 0], ['bottom', 1]] as const)(
    'moves only the other LV1 Cookie to deck %s',
    (destination, modeIndex) => {
      let state = createBs11070AttackDemoState('BS11-070', destination)
      const source = state.players['player-one'].battleArea[0]!
      const ally = state.players['player-one'].battleArea[1]!
      const target = state.players['player-two'].battleArea[0]!
      const paymentIds = state.players['player-one'].supportArea.map((entry) => entry.card.instanceId)
      state = applyGameCommand(state, {
        kind: 'declare-attack',
        playerId: 'player-one',
        attackerInstanceId: source.card.instanceId,
        targetInstanceId: target.card.instanceId,
        supportPaymentIds: paymentIds.slice(0, 3),
      })
      state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
      for (let step = 0; step < 8 && state.pendingBattle?.stage === 'damage'; step += 1) {
        state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
      }
      expect(state.pendingBattle?.stage).toBe('attack-effect')
      state = applyGameCommand(state, {
        kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [],
      })
      expect(state.pendingOptionalCostAttack?.cost.energy).toEqual({ neutral: 1 })
      state = applyGameCommand(state, {
        kind: 'resolve-optional-cost-attack',
        playerId: 'player-one',
        action: 'pay',
        paymentIds: paymentIds.slice(3),
      })
      state = applyGameCommand(state, {
        kind: 'resolve-choose-one', playerId: 'player-one', modeIndex,
      })
      state = applyGameCommand(state, {
        kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [ally.card.instanceId],
      })
      expect(state.players['player-one'].battleArea.map((entry) => entry.card.instanceId))
        .toEqual([source.card.instanceId])
      expect(state.players['player-one'].discardPile).toEqual(expect.arrayContaining(ally.hpCards))
      expect(destination === 'top'
        ? state.players['player-one'].deck[0]
        : state.players['player-one'].deck.at(-1)).toEqual(ally.card)
    },
  )
})
