import { describe, expect, it } from 'vitest'
import { beginAttack, GameRuleError, type GameState } from '.'
import { createBattleState } from './test-helpers/battle-helpers'

describe('assertNoBlockingDecision', () => {
  it('throws GameRuleError when pendingOnPlay is set before beginAttack', () => {
    const state: GameState = {
      ...createBattleState(),
      pendingOnPlay: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
      },
    }

    expect(() =>
      beginAttack(state, 'attacker', 'defender', ['p2-support']),
    ).toThrow(GameRuleError)
  })

  it('throws GameRuleError when pendingAbilityEffect is set before beginAttack', () => {
    const state: GameState = {
      ...createBattleState(),
      pendingAbilityEffect: {
        playerId: 'player-two',
        sourcePlayerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceKind: 'skill',
        effects: [{ kind: 'draw', amount: 1 }],
        effectIndex: 0,
      },
    }

    expect(() =>
      beginAttack(state, 'attacker', 'defender', ['p2-support']),
    ).toThrow(GameRuleError)
  })
})
