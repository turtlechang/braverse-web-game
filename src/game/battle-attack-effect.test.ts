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

  it('applies BS2-058-style conditional bonus damage when the attacker has 15+ cards in their own trash', () => {
    let state = createBattleState()
    state.players['player-two'].battleArea[0].card.attack = 4
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'trash-count-at-least', count: 15 },
      },
    ]
    state.players['player-two'].discardPile = Array.from(
      { length: 15 },
      (_, i) => item(`p2-trash-${i}`),
    )
    state.players['player-one'].battleArea[0].hpCards = Array.from(
      { length: 6 },
      (_, i) => item(`defender-hp-${i}`),
    )

    state = skipTrap(declareAttack(state), 'player-one')
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)

    expect(state.pendingBattle).toMatchObject({
      stage: 'attack-effect',
      attackEffectIndex: 0,
    })
    // 主傷害 4 點先扣完，後續條件效果尚未結算。
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(2)

    state = resolveAttackEffect(state, 'player-two', ['defender'])

    expect(state.pendingBattle).toBeNull()
    // 條件成立（攻擊方棄牌區 15 張），額外 1 點傷害確實扣到防守方餅乾。
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
  })

  it('skips BS2-058-style conditional bonus damage when the attacker has fewer than 15 cards in their own trash', () => {
    let state = createBattleState()
    state.players['player-two'].battleArea[0].card.attack = 4
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'trash-count-at-least', count: 15 },
      },
    ]
    // player-two 的棄牌區維持預設空值（<15 張），條件不成立。
    state.players['player-one'].battleArea[0].hpCards = Array.from(
      { length: 6 },
      (_, i) => item(`defender-hp-${i}`),
    )

    state = skipTrap(declareAttack(state), 'player-one')
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)

    expect(state.pendingBattle).toMatchObject({
      stage: 'attack-effect',
      attackEffectIndex: 0,
    })
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(2)

    state = resolveAttackEffect(state, 'player-two', [])

    expect(state.pendingBattle).toBeNull()
    // 條件不成立，防守方餅乾 HP 停在主傷害結算後的數字，沒有再多扣 1 點。
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
  })
})
