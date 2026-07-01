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

  it('skips conditional attack effect when condition is not met', () => {
    let state = createBattleState()
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'damage',
        amount: 3,
        target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
        condition: { kind: 'opponent-has-cookie-with-level', level: 1 },
      },
    ]

    state = skipTrap(declareAttack(state), 'player-one')
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)

    expect(state.pendingBattle).toMatchObject({
      stage: 'attack-effect',
      attackEffectIndex: 0,
    })

    state = resolveAttackEffect(state, 'player-two', [])

    expect(state.pendingBattle).toBeNull()
  })
})
