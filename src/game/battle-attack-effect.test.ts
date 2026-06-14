import { describe, expect, it } from 'vitest'
import {
  resolveAttackEffect,
  resolveNextDamage,
  skipTrap,
} from '.'
import {
  cookie,
  createBattleState,
  declareAttack,
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
})
