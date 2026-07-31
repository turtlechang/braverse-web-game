import { describe, expect, it } from 'vitest'
import {
  resolveAttackEffect,
  resolveOptionalCostAttack,
  resolveBattleAutomatically,
  skipTrap,
  resolveNextDamage,
  beginAttack,
} from './battle'
import { applyGameCommand } from './commands'
import { deployCookie } from './actions'
import type { GameState } from './types'
import { createBattleState, declareAttack } from './test-helpers/battle-helpers'
import type { GameCard } from './types'
import { createOfficialBlueStarterDeck } from './starter-deck'

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
  it('reaches the pending decision through a real ST4-013 attack', () => {
    let state = createBattleState()
    const caviar = createOfficialBlueStarterDeck('player-two').find(
      (card) => card.id === 'ST4-013',
    )
    if (!caviar || caviar.type !== 'cookie') {
      throw new Error('ST4-013 should be a runtime cookie card.')
    }
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: caviar,
    }
    state.players['player-two'].supportArea[0].card.energyColor = 'blue'
    const costCardOne = handCookie('hc1')
    const costCardTwo = handCookie('hc2')
    const deployableCookie = handCookie('deployable-cookie')
    state.players['player-two'].hand = [
      costCardOne,
      costCardTwo,
      deployableCookie,
    ]

    state = beginAttack(
      state,
      caviar.instanceId,
      'defender',
      ['p2-support'],
    )
    state = advanceToAttackEffect(state)
    state = resolveAttackEffect(state, 'player-two', [])

    expect(state.pendingOptionalCostAttack).toMatchObject({
      playerId: 'player-two',
      sourceInstanceId: caviar.instanceId,
      cost: { discardHand: 2 },
    })

    state = resolveOptionalCostAttack(
      state,
      'player-two',
      'pay',
      [costCardOne.instanceId, costCardTwo.instanceId],
      ['defender'],
    )
    expect(state.pendingBattle).toBeNull()
    expect(state.pendingOptionalCostAttack).toBeNull()

    state = deployCookie(state, deployableCookie.instanceId)
    expect(
      state.players['player-two'].battleArea.map(
        (cookie) => cookie.card.instanceId,
      ),
    ).toContain(deployableCookie.instanceId)
  })

  it('skips optional attack effects with no applicable child effect', () => {
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
    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.pendingBattle).toBeFalsy()
  })

  it('creates pendingOptionalCostAttack when hand has enough cards', () => {
    let state = createBattleState()
    state.players['player-two'].battleArea[0].card.attack = 1
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
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
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
    ).toThrow('Must discard exactly 2 cards for this effect.')
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
    ).toThrow('Must discard exactly 2 cards for this effect.')
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
    ).toThrow('Invalid battle action.')
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
    ).toThrow('Invalid battle action.')
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
    ).toThrow('Invalid battle action.')
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
    ).toThrow('Invalid battle action.')
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
    ).toThrow('Invalid battle action.')
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
    state.players['player-two'].battleArea[0].card.attack = 1
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
    while (state.pendingBattle?.stage === 'damage') {
      state = resolveNextDamage(state)
    }
    expect(state.pendingBattle!.stage).toBe('attack-effect')
    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeDefined()
    expect(state.pendingOptionalCostAttack!.cost.discardHand).toBe(2)
    expect(state.pendingOptionalCostAttack!.effectText).toBe('Pay 2 hand to deal 1 damage.')
    expect(state.pendingBattle).toBeDefined()
  })

  it('full battle flow with insufficient hand skips without pending', () => {
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
    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.pendingBattle).toBeFalsy()
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

  it('skips optional attack effects when opponent has no battle area cookies', () => {
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
    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.pendingBattle).toBeFalsy()
  })

  it('skips BS1-037-style optional effect when only higher-level cookies remain', () => {
    let state = createBattleState()
    state.players['player-one'].battleArea[0].card.level = 2
    state.players['player-two'].hand = [handCookie('hc1')]
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: 'attacker',
        targetInstanceId: 'defender',
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect' as const,
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [
          {
            kind: 'optional-cost-attack' as const,
            cost: { energy: {}, discardHand: 0 },
            effects: [
              {
                kind: 'opponent-battle-to-trash' as const,
                maxLevel: 1,
                destination: 'break' as const,
              },
            ],
            effectText: 'Select up to 1 opposing LV.1 Cookie.',
          },
        ],
        attackEffectIndex: 0,
      },
    }

    state = resolveAttackEffect(state, 'player-two', [])

    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.pendingBattle).toBeFalsy()
  })

  it('allows an up-to-one opponent-battle target effect to resolve with no target', () => {
    let state = createBattleState()
    state.players['player-one'].battleArea[0].card.level = 2
    state = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: 'attacker',
        targetInstanceId: 'defender',
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect' as const,
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [
          {
            kind: 'optional-cost-attack' as const,
            cost: { energy: {}, discardHand: 0 },
            effects: [
              {
                kind: 'opponent-battle-to-trash' as const,
                min: 0,
                maxLevel: 1,
                destination: 'break' as const,
              },
            ],
            effectText: 'Select up to 1 opposing LV.1 Cookie.',
          },
        ],
        attackEffectIndex: 0,
      },
    }

    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeDefined()

    state = resolveOptionalCostAttack(state, 'player-two', 'pay', [], [])

    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-one'].battleArea).toHaveLength(1)
    expect(state.players['player-one'].breakArea).toHaveLength(0)
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

  it('resolveBattleAutomatically uses source energy before support payments', () => {
    let state = createBattleState()
    state.players['player-two'].supportArea.forEach((support) => {
      support.rested = true
    })
    state.players['player-two'].battleArea[0].card.attackEnergyCost = {}
    state.players['player-two'].battleArea[0].card.attackCost = 0
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { blue: 1 } },
        effects: [
          { kind: 'damage', amount: 3, target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 } },
        ],
        effectText: 'Pay {B} to deal 3 damage.',
        sourceEnergy: { blue: 1 },
      },
    ]
    state = beginAttack(state, 'attacker', 'defender', [])
    state = resolveBattleAutomatically(state)
    expect(state.pendingBattle).toBeNull()
    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.status).toBe('playing')
  })

  it('resolveBattleAutomatically skips when neither source nor support can pay', () => {
    let state = createBattleState()
    state.players['player-two'].supportArea.forEach((s) => { s.rested = true })
    state.players['player-two'].battleArea[0].card.attackEnergyCost = {}
    state.players['player-two'].battleArea[0].card.attackCost = 0
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { blue: 1 } },
        effects: [
          { kind: 'damage', amount: 3, target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 } },
        ],
        effectText: 'Pay {B} to deal 3 damage.',
      },
    ]
    state = beginAttack(state, 'attacker', 'defender', [])
    state = resolveBattleAutomatically(state)
    expect(state.pendingBattle).toBeNull()
    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.status).toBe('playing')
  })

  it('reveal-top-deck match with attackTargetOnly preserves pendingBattle until ability effect resolves', () => {
    let state = createBattleState()
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        // 〈can be used as {B}〉是「你可以支付 {B}」，代價要從支援區實際付出來
        // （見 47bed64）——這裡跟著真實卡片的付費方式，別再用 sourceEnergy 抵掉。
        cost: { energy: { blue: 1 } },
        effects: [
          {
            kind: 'reveal-top-deck',
            match: { type: 'cookie', energyColor: 'blue', level: 2 },
            effects: [
              {
                kind: 'damage',
                amount: 2,
                target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
              },
            ],
          },
        ],
        effectText: 'Reveal top card. If blue LV2, deal 2 damage to attacked cookie.',
      },
    ]
    state.players['player-two'].battleArea[0].card.attackCost = 0
    state.players['player-two'].battleArea[0].card.attackEnergyCost = {}
    state.players['player-two'].battleArea[0].card.attack = 1

    const blueLv2: GameCard = {
      id: 'blue-lv2', instanceId: 'blue-lv2', name: 'Blue LV2',
      type: 'cookie', level: 2, energyColor: 'blue', hp: 1, attack: 0, attackCost: 0,
    }
    state.players['player-two'].deck = [blueLv2]
    state.players['player-two'].supportArea = [
      { card: { id: 'sup', instanceId: 'sup', name: 'sup', type: 'item', energyColor: 'blue' }, rested: false },
    ]

    state = beginAttack(state, 'attacker', 'defender', [])
    state = advanceToAttackEffect(state)
    expect(state.pendingBattle!.stage).toBe('attack-effect')

    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeDefined()

    state = resolveOptionalCostAttack(state, 'player-two', 'pay', [], [], ['sup'])
    // 代價確實付了：支援卡被橫置。
    expect(state.players['player-two'].supportArea[0].rested).toBe(true)
    expect(state.pendingRevealTopDeck).toBeDefined()
    expect(state.pendingRevealTopDeck!.matched).toBe(true)
    expect(state.pendingBattle).toBeDefined()

    state = applyGameCommand(state, {
      kind: 'resolve-reveal-top-deck',
      playerId: 'player-two',
    })
    expect(state.pendingRevealTopDeck).toBeNull()
    expect(state.pendingAbilityEffect).toBeDefined()
    expect(state.pendingBattle).toBeDefined()
    expect(state.pendingBattle!.targetInstanceId).toBe('defender')

    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: ['defender'],
    })
    expect(state.pendingAbilityEffect).toBeUndefined()
    expect(state.pendingBattle).toBeNull()
    expect(state.status).toBe('playing')
  })

  it('BS3-076: skips the optional reveal-top-deck prompt when the base attack already fainted the attacked cookie', () => {
    let state = createBattleState()
    // 預設 attacker 攻擊力 3 恰好等於 defender 的 3 張 HP 卡，普通攻擊本身
    // 就會讓 defender 昏厥離場；巢狀 damage 效果鎖定 attackTargetOnly，
    // 目標消失後不可能再有合法目標，不該再詢問是否要付費翻牌。
    state.players['player-two'].battleArea[0].card.attackEffects = [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { blue: 1 } },
        effects: [
          {
            kind: 'reveal-top-deck',
            match: { type: 'cookie', energyColor: 'blue', level: 2 },
            effects: [
              {
                kind: 'damage',
                amount: 2,
                target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
              },
            ],
          },
        ],
        effectText: 'Reveal top card. If blue LV2, deal 2 damage to attacked cookie.',
      },
    ]
    state.players['player-two'].supportArea = [
      ...state.players['player-two'].supportArea,
      { card: { id: 'sup', instanceId: 'sup', name: 'sup', type: 'item', energyColor: 'blue' }, rested: false },
    ]

    state = declareAttack(state)
    state = advanceToAttackEffect(state)

    expect(
      state.players['player-one'].battleArea.some(
        (cookie) => cookie.card.instanceId === 'defender',
      ),
    ).toBe(false)
    expect(state.pendingBattle!.stage).toBe('attack-effect')

    state = resolveAttackEffect(state, 'player-two', [])
    expect(state.pendingOptionalCostAttack).toBeFalsy()
    expect(state.pendingBattle).toBeNull()
  })
})
