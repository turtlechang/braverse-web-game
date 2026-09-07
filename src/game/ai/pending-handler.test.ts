import { describe, expect, it } from 'vitest'
import { handleAiPendingDecision } from './pending-handler'
import { beginAttack } from '../battle'
import { createBattleState } from '../test-helpers/battle-helpers'

const pendingOptionalCost = {
  playerId: 'player-two' as const,
  sourceInstanceId: 'attacker',
  sourceCardName: 'Optional attack',
  cost: { energy: { red: 1 } },
  effects: [{
    kind: 'damage' as const,
    amount: 1,
    target: { side: 'opponent' as const, min: 1, max: 1 },
  }],
  effectText: 'Deal 1 damage',
}

describe('Lv.5 pending optional attack defense', () => {
  it('不為低價值擊倒消耗唯一支援陷阱', () => {
    const state = createBattleState()
    state.players['player-two'].supportArea = [{
      card: {
        id: 'ordinary-support',
        instanceId: 'ordinary-support',
        name: 'ordinary support',
        type: 'item',
        energyColor: 'red',
      },
      rested: false,
    }, {
      card: {
        id: 'support-trap',
        instanceId: 'support-trap',
        name: 'support trap',
        type: 'trap',
        energyColor: 'red',
        trap: {
          text: 'Trap',
          cost: { energy: { red: 1 } },
          effects: [],
        },
      },
      rested: false,
    }]
    const attackState = beginAttack(
      state,
      'attacker',
      'defender',
      ['ordinary-support'],
    )
    attackState.pendingOptionalCostAttack = pendingOptionalCost

    const decision = handleAiPendingDecision(attackState, 'player-two', { level: 5 })

    expect(decision?.action).toBe('resolve-optional-cost-attack')
    expect(decision?.description).toContain('保留唯一防守陷阱')
    expect(decision?.reason?.optionalCostDefense).toMatchObject({
      preserve: true,
      onlyDefenseTrapConsumed: true,
    })
    expect(decision?.state.pendingOptionalCostAttack).toBeNull()
    expect(decision?.state.players['player-two'].supportArea[1].rested).toBe(false)
  })
})
