import { describe, expect, it } from 'vitest'
import {
  resolveAttackEffect,
  resolveOptionalCostAttack,
  resolveBattleAutomatically,
  skipTrap,
  resolveNextDamage,
  beginAttack,
} from './battle'
import type { GameState } from './types'
import { createBattleState, declareAttack } from './test-helpers/battle-helpers'
import type { GameCard } from './types'

const handCookie = (id: string): GameCard => ({
  id,
  instanceId: `${id}-instance`,
  name: id,
  type: 'cookie',
  level: 1,
  hp: 1,
  attack: 0,
  attackCost: 0,
})

const advanceToAttackEffect = (state: GameState): GameState => {
  let s = skipTrap(state, 'player-one')
  while (s.pendingBattle?.stage === 'damage') {
    s = resolveNextDamage(s)
  }
  return s
}

describe('optional-cost-attack', () => {
  it('creates pendingOptionalCostAttack even when hand has fewer cards than cost', () => {
    let state = createBattleState()
    state.players['player-two'].hand = []
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'test',
      },
    ]
    state = declareAttack(state)
    state = advanceToAttackEffect(state)
    expect(state.pendingBattle!.stage).toBe('attack-effect')
    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeDefined()
    expect(state.pendingOptionalCostAttack!.cost.discardHand).toBe(2)
    expect(state.pendingBattle).toBeDefined()
  })

  it('creates pendingOptionalCostAttack when hand has enough cards', () => {
    let state = createBattleState()
    const hc1 = handCookie('hc1')
    const hc2 = handCookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          { kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } },
        ],
        effectText: 'test',
      },
    ]
    state = declareAttack(state)
    state = advanceToAttackEffect(state)
    expect(state.pendingBattle!.stage).toBe('attack-effect')
    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeDefined()
    expect(state.pendingOptionalCostAttack!.cost.discardHand).toBe(2)
  })

  it('skip action clears pending and finishes battle', () => {
    let state = createBattleState()
    state.players['player-two'].hand = [handCookie('hc1'), handCookie('hc2')]
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'test',
      },
    }
    state = resolveOptionalCostAttack(state, 'player-two', 'skip')
    expect(state.pendingOptionalCostAttack).toBeNull()
    expect(state.pendingBattle).toBeNull()
  })

  it('pay action discards hand and deals damage', () => {
    let state = createBattleState()
    const hc1 = handCookie('hc1')
    const hc2 = handCookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    const defenderId = state.players['player-one'].battleArea[0].card.instanceId
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: defenderId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          { kind: 'damage' as const, amount: 1, target: { side: 'opponent' as const, min: 1, max: 1 } },
        ],
        effectText: 'test',
      },
    }
    state = resolveOptionalCostAttack(state, 'player-two', 'pay', [hc1.instanceId, hc2.instanceId], [defenderId])
    expect(state.pendingOptionalCostAttack).toBeNull()
    expect(state.players['player-two'].hand).toHaveLength(0)
    expect(state.players['player-two'].discardPile.map((c) => c.instanceId)).toEqual(
      expect.arrayContaining([hc1.instanceId, hc2.instanceId]),
    )
    expect(state.pendingBattle).toBeNull()
  })

  it('rejects pay with wrong discard count', () => {
    let state = createBattleState()
    state.players['player-two'].hand = [handCookie('hc1'), handCookie('hc2')]
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'test',
      },
    }
    expect(() =>
      resolveOptionalCostAttack(state, 'player-two', 'pay', [handCookie('hc1').instanceId], []),
    ).toThrow('必須棄置 2 張手牌作為代價')
  })

  it('rejects pay with duplicate discardCardIds', () => {
    let state = createBattleState()
    const hc = handCookie('hc1')
    state.players['player-two'].hand = [hc, handCookie('hc2')]
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'test',
      },
    }
    expect(() =>
      resolveOptionalCostAttack(state, 'player-two', 'pay', [hc.instanceId, hc.instanceId], []),
    ).toThrow('必須棄置 2 張手牌作為代價')
  })

  it('rejects pay when discardCardIds contain cards not in own hand', () => {
    let state = createBattleState()
    state.players['player-two'].hand = [handCookie('hc1'), handCookie('hc2')]
    const defenderId = state.players['player-one'].battleArea[0].card.instanceId
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: defenderId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'test',
      },
    }
    expect(() =>
      resolveOptionalCostAttack(state, 'player-two', 'pay', ['hc1-instance', 'not-in-hand'], []),
    ).toThrow('只能選擇自己的手牌作為代價')
  })

  it('rejects pay with empty targetIds when effects require targeting', () => {
    let state = createBattleState()
    const hc1 = handCookie('hc1')
    const hc2 = handCookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    const defenderId = state.players['player-one'].battleArea[0].card.instanceId
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: defenderId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          { kind: 'damage' as const, amount: 1, target: { side: 'opponent' as const, min: 1, max: 1 } },
        ],
        effectText: 'test',
      },
    }
    expect(() =>
      resolveOptionalCostAttack(state, 'player-two', 'pay', [hc1.instanceId, hc2.instanceId], []),
    ).toThrow('必須選擇恰好一個效果目標')
  })

  it('rejects pay with multiple targetIds when effects require exactly one', () => {
    let state = createBattleState()
    const hc1 = handCookie('hc1')
    const hc2 = handCookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    const defenderId = state.players['player-one'].battleArea[0].card.instanceId
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: defenderId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          { kind: 'damage' as const, amount: 1, target: { side: 'opponent' as const, min: 1, max: 1 } },
        ],
        effectText: 'test',
      },
    }
    expect(() =>
      resolveOptionalCostAttack(state, 'player-two', 'pay', [hc1.instanceId, hc2.instanceId], [defenderId, 'extra-id']),
    ).toThrow('必須選擇恰好一個效果目標')
  })

  it('rejects pay when target is not in opponent battleArea', () => {
    let state = createBattleState()
    const hc1 = handCookie('hc1')
    const hc2 = handCookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          { kind: 'damage' as const, amount: 1, target: { side: 'opponent' as const, min: 1, max: 1 } },
        ],
        effectText: 'test',
      },
    }
    expect(() =>
      resolveOptionalCostAttack(state, 'player-two', 'pay', [hc1.instanceId, hc2.instanceId], ['attacker']),
    ).toThrow('目標必須在對手戰鬥區')
  })

  it('rejects pay with duplicate targetIds', () => {
    let state = createBattleState()
    const hc1 = handCookie('hc1')
    const hc2 = handCookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    const defenderId = state.players['player-one'].battleArea[0].card.instanceId
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: defenderId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          { kind: 'damage' as const, amount: 1, target: { side: 'opponent' as const, min: 1, max: 1 } },
        ],
        effectText: 'test',
      },
    }
    expect(() =>
      resolveOptionalCostAttack(state, 'player-two', 'pay', [hc1.instanceId, hc2.instanceId], [defenderId, defenderId]),
    ).toThrow('不能重複選取效果目標')
  })

  it('state is unchanged after failed pay validation', () => {
    let state = createBattleState()
    const hc1 = handCookie('hc1')
    const hc2 = handCookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    const defenderId = state.players['player-one'].battleArea[0].card.instanceId
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: defenderId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          { kind: 'damage' as const, amount: 1, target: { side: 'opponent' as const, min: 1, max: 1 } },
        ],
        effectText: 'test',
      },
    }
    const frozen = JSON.parse(JSON.stringify(state)) as GameState
    try {
      resolveOptionalCostAttack(state, 'player-two', 'pay', [hc1.instanceId, hc2.instanceId], ['not-in-battle'])
    } catch { /* expected */ }
    expect(state).toEqual(frozen)
  })

  it('skip is available even with insufficient hand', () => {
    let state = createBattleState()
    state.players['player-two'].hand = []
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
        targetInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Test Attacker',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'test',
      },
    }
    const result = resolveOptionalCostAttack(state, 'player-two', 'skip')
    expect(result.pendingOptionalCostAttack).toBeNull()
    expect(result.pendingBattle).toBeNull()
  })
})

describe('optional-cost-attack integration', () => {
  it('full battle flow with sufficient hand creates pending', () => {
    let state = createBattleState()
    const hc1 = handCookie('hc1')
    const hc2 = handCookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          { kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } },
        ],
        effectText: 'Pay 2 hand to deal 1 damage.',
      },
    ]
    state = beginAttack(state, 'attacker', 'defender', ['p2-support'])
    expect(state.pendingBattle!.stage).toBe('trap')
    state = skipTrap(state, 'player-one')
    expect(state.pendingBattle!.stage).toBe('damage')
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    expect(state.pendingBattle!.stage).toBe('attack-effect')
    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeDefined()
    expect(state.pendingOptionalCostAttack!.cost.discardHand).toBe(2)
    expect(state.pendingOptionalCostAttack!.effectText).toBe('Pay 2 hand to deal 1 damage.')
    expect(state.pendingBattle).toBeDefined()
  })

  it('full battle flow with insufficient hand still creates pending', () => {
    let state = createBattleState()
    state.players['player-two'].hand = []
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'Pay 2 hand.',
      },
    ]
    state = beginAttack(state, 'attacker', 'defender', ['p2-support'])
    state = skipTrap(state, 'player-one')
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    expect(state.pendingBattle!.stage).toBe('attack-effect')
    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeDefined()
    expect(state.pendingOptionalCostAttack!.cost.discardHand).toBe(2)
    expect(state.pendingBattle).toBeDefined()
  })

  it('resolveBattleAutomatically auto-skips optional-cost-attack without looping', () => {
    let state = createBattleState()
    state.players['player-two'].hand = []
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'Pay 2 hand.',
      },
    ]
    state = beginAttack(state, 'attacker', 'defender', ['p2-support'])
    state = resolveBattleAutomatically(state)
    expect(state.pendingBattle).toBeNull()
    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.status).toBe('playing')
  })

  it('still creates pending even when opponent has no battle area cookies (UI decides pay vs skip)', () => {
    let state = createBattleState()
    const hc1 = handCookie('hc1')
    const hc2 = handCookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    // Remove all opponent battle area cookies
    state.players['player-one'].battleArea = []
    const attackerInst = state.players['player-two'].battleArea[0].card.instanceId
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: attackerInst,
        targetInstanceId: 'no-target',
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect' as const,
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [
          {
            kind: 'optional-cost-attack',
            cost: { energy: {}, discardHand: 2 },
            effects: [
              { kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } },
            ],
            effectText: 'Pay 2 hand to deal 1 damage.',
          },
        ],
        attackEffectIndex: 0,
      },
    }
    state = resolveAttackEffect(state, 'player-two', [])
    // Still creates pending — the UI/AI decides whether Pay is available
    expect(state.pendingOptionalCostAttack).toBeDefined()
    expect(state.pendingBattle).toBeDefined()
  })

  it('resolveBattleAutomatically completes battle with optional-cost-attack and damage effect', () => {
    let state = createBattleState()
    const hc1 = handCookie('hc1')
    const hc2 = handCookie('hc2')
    state.players['player-two'].hand = [hc1, hc2]
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          { kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } },
        ],
        effectText: 'Pay 2 hand to deal 1 damage.',
      },
    ]
    state = beginAttack(state, 'attacker', 'defender', ['p2-support'])
    state = resolveBattleAutomatically(state)
    expect(state.pendingBattle).toBeNull()
    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.status).toBe('playing')
  })
})
