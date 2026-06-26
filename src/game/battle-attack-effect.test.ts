import { describe, expect, it } from 'vitest'
import {
  beginAttack,
  resolveAttackEffect,
  resolveNextDamage,
  skipTrap,
} from '.'
import type { GameState } from './types'
import {
  cookie,
  createBattleState,
  declareAttack,
  item,
} from './test-helpers/battle-helpers'

describe('post-attack effects', () => {
  it('resolves Wizard Cookie break-to-trash after damage and before battle completion', () => {
    let state = createBattleState()
    state.players['player-two'].battleArea[0].card.attackEffects = [
      { kind: 'break-to-trash', max: 1, exactLevel: 1 },
    ]
    state.players['player-two'].breakArea = [cookie('break-level-one')]

    state = skipTrap(declareAttack(state), 'player-one')
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)

    expect(state.pendingBattle).toMatchObject({
      stage: 'attack-effect',
      attackEffectIndex: 0,
    })

    state = resolveAttackEffect(state, 'player-two', ['break-level-one'])

    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-two'].breakArea).toHaveLength(0)
    expect(
      state.players['player-two'].discardPile.map((card) => card.instanceId),
    ).toContain('break-level-one')
  })

  it('resolves skip-attack effect and prevents target from attacking next turn', () => {
    let state = createBattleState()
    const targetInstanceId = state.players['player-one'].battleArea[0].card.instanceId
    
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'skip-attack',
        duration: 'opponent-next-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ]
    state.players['player-one'].battleArea[0].hpCards = [
      item('defender-hp-a'),
      item('defender-hp-b'),
      item('defender-hp-c'),
      item('defender-hp-d'),
      item('defender-hp-e'),
    ]

    state = skipTrap(declareAttack(state), 'player-one')
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)

    expect(state.pendingBattle).toMatchObject({
      stage: 'attack-effect',
      attackEffectIndex: 0,
    })

    state = resolveAttackEffect(state, 'player-two', [targetInstanceId])

    expect(state.pendingBattle).toBeNull()
    expect(state.skipAttackUntilTurn[targetInstanceId]).toBe(3)
  })

  it('prevents cookie with skip-attack from attacking', () => {
    const state = createBattleState()
    const attackerInstanceId = state.players['player-two'].battleArea[0].card.instanceId
    const targetInstanceId = state.players['player-one'].battleArea[0].card.instanceId
    
    const modifiedState: GameState = {
      ...state,
      skipAttackUntilTurn: { [attackerInstanceId]: 2 },
    }

    expect(() => beginAttack(modifiedState, attackerInstanceId, targetInstanceId, [])).toThrow('此餅乾本回合無法攻擊。')
  })
})
