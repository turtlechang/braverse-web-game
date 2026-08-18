import { describe, expect, it } from 'vitest'
import { createDemoGame, type GameState } from '.'
import { getActingPlayerId, isPlayerControllingState } from './controller'

describe('getActingPlayerId', () => {
  it('returns activePlayerId when no pending state exists', () => {
    const state = createDemoGame()
    expect(getActingPlayerId(state)).toBe(state.activePlayerId)
  })

  it('returns activePlayerId for player-two when no pending state', () => {
    const state: GameState = {
      ...createDemoGame(),
      activePlayerId: 'player-two',
    }
    expect(getActingPlayerId(state)).toBe('player-two')
  })

  it('returns pendingDecision playerId for faint-effect', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: 'faint-cookie',
          effect: {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          context: {
            sourcePlayerId: 'player-one',
            sourceInstanceId: 'faint-cookie',
          },
        },
      ],
    }
    expect(getActingPlayerId(state)).toBe('player-one')
  })

  it('returns pending faint effect playerId before replacementTask', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingReplacement: {
        tasks: [{ playerId: 'player-two', remaining: 1 }],
      },
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: 'faint-cookie',
          effect: {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          context: {
            sourcePlayerId: 'player-one',
            sourceInstanceId: 'faint-cookie',
          },
        },
      ],
    }
    expect(getActingPlayerId(state)).toBe('player-one')
  })

  it('returns pendingDecision playerId for opponent-hand-discard', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingOpponentHandDiscard: {
        playerId: 'player-two',
        count: 2,
        sourcePlayerId: 'player-one',
        sourceInstanceId: 'rogue-cookie',
        sourceCardName: 'Roguefort Cookie',
        effectText: 'Discard 2 cards.',
      },
    }
    expect(getActingPlayerId(state)).toBe('player-two')
  })

  it('pendingDecision takes priority over pendingRefresh', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: 'faint-cookie',
          effect: {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          context: {
            sourcePlayerId: 'player-one',
            sourceInstanceId: 'faint-cookie',
          },
        },
      ],
      pendingRefresh: {
        playerId: 'player-two',
        remainingDraws: 2,
      },
    }
    expect(getActingPlayerId(state)).toBe('player-one')
  })

  it('returns pendingRefresh playerId when no pendingDecision', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingRefresh: {
        playerId: 'player-two',
        remainingDraws: 2,
      },
    }
    expect(getActingPlayerId(state)).toBe('player-two')
  })

  it('returns pendingRefresh playerId before replacementTask', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingRefresh: {
        playerId: 'player-one',
        remainingDraws: 1,
      },
      pendingReplacement: {
        tasks: [{ playerId: 'player-two', remaining: 1 }],
      },
    }
    expect(getActingPlayerId(state)).toBe('player-one')
  })

  it('returns pendingOnPlay playerId when no higher priority pending', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingOnPlay: {
        playerId: 'player-one',
        sourceInstanceId: 'cookie-1',
      },
    }
    expect(getActingPlayerId(state)).toBe('player-one')
  })

  it('pendingRefresh takes priority over pendingOnPlay', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingRefresh: {
        playerId: 'player-two',
        remainingDraws: 1,
      },
      pendingOnPlay: {
        playerId: 'player-one',
        sourceInstanceId: 'cookie-1',
      },
    }
    expect(getActingPlayerId(state)).toBe('player-two')
  })

  it('returns replacementTask playerId when no other pending', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingReplacement: {
        tasks: [{ playerId: 'player-two', remaining: 1 }],
      },
    }
    expect(getActingPlayerId(state)).toBe('player-two')
  })

  it('pendingOnPlay takes priority over replacementTask', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingOnPlay: {
        playerId: 'player-one',
        sourceInstanceId: 'cookie-1',
      },
      pendingReplacement: {
        tasks: [{ playerId: 'player-two', remaining: 1 }],
      },
    }
    expect(getActingPlayerId(state)).toBe('player-one')
  })

  it('returns defenderPlayerId for pendingBattle trap stage', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingBattle: {
        attackerInstanceId: 'attacker-1',
        attackerPlayerId: 'player-one',
        defenderPlayerId: 'player-two',
        declaredDamage: 2,
        faintedColors: [],
        preventKnockoutTargetIds: [],
        remainingDamage: 2,
        revealedHpCard: null,
        stage: 'trap',
        targetInstanceId: 'target-1',
        trapUsed: false,
        attackEffects: [],
        attackEffectIndex: 0,
      },
    }
    expect(getActingPlayerId(state)).toBe('player-two')
  })

  it('returns defenderPlayerId for pendingBattle damage stage', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingBattle: {
        attackerInstanceId: 'attacker-1',
        attackerPlayerId: 'player-one',
        defenderPlayerId: 'player-two',
        declaredDamage: 3,
        faintedColors: [],
        preventKnockoutTargetIds: [],
        remainingDamage: 3,
        revealedHpCard: null,
        stage: 'damage',
        targetInstanceId: 'target-1',
        trapUsed: false,
        attackEffects: [],
        attackEffectIndex: 0,
      },
    }
    expect(getActingPlayerId(state)).toBe('player-two')
  })

  it('returns defenderPlayerId for damage stage even when defender is player-one', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingBattle: {
        attackerInstanceId: 'attacker-1',
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        declaredDamage: 3,
        faintedColors: [],
        preventKnockoutTargetIds: [],
        remainingDamage: 3,
        revealedHpCard: null,
        stage: 'damage',
        targetInstanceId: 'target-1',
        trapUsed: false,
        attackEffects: [],
        attackEffectIndex: 0,
      },
    }
    expect(getActingPlayerId(state)).toBe('player-one')
  })

  it('returns damagePlayerId for pendingBattle flip stage when set', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingBattle: {
        attackerInstanceId: 'attacker-1',
        attackerPlayerId: 'player-one',
        defenderPlayerId: 'player-two',
        declaredDamage: 3,
        faintedColors: [],
        preventKnockoutTargetIds: [],
        remainingDamage: 0,
        revealedHpCard: null,
        stage: 'flip',
        targetInstanceId: 'target-1',
        trapUsed: false,
        attackEffects: [],
        attackEffectIndex: 0,
        damagePlayerId: 'player-one',
      },
    }
    expect(getActingPlayerId(state)).toBe('player-one')
  })

  it('returns defenderPlayerId for pendingBattle flip stage when damagePlayerId not set', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingBattle: {
        attackerInstanceId: 'attacker-1',
        attackerPlayerId: 'player-one',
        defenderPlayerId: 'player-two',
        declaredDamage: 3,
        faintedColors: [],
        preventKnockoutTargetIds: [],
        remainingDamage: 0,
        revealedHpCard: null,
        stage: 'flip',
        targetInstanceId: 'target-1',
        trapUsed: false,
        attackEffects: [],
        attackEffectIndex: 0,
      },
    }
    expect(getActingPlayerId(state)).toBe('player-two')
  })

  it('returns attackerPlayerId for pendingBattle attack-effect stage', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingBattle: {
        attackerInstanceId: 'attacker-1',
        attackerPlayerId: 'player-one',
        defenderPlayerId: 'player-two',
        declaredDamage: 3,
        faintedColors: [],
        preventKnockoutTargetIds: [],
        remainingDamage: 0,
        revealedHpCard: null,
        stage: 'attack-effect',
        targetInstanceId: 'target-1',
        trapUsed: false,
        attackEffects: [],
        attackEffectIndex: 0,
      },
    }
    expect(getActingPlayerId(state)).toBe('player-one')
  })

  it('pendingBattle takes priority over activePlayerId', () => {
    const state: GameState = {
      ...createDemoGame(),
      activePlayerId: 'player-one',
      pendingBattle: {
        attackerInstanceId: 'attacker-1',
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        declaredDamage: 2,
        faintedColors: [],
        preventKnockoutTargetIds: [],
        remainingDamage: 2,
        revealedHpCard: null,
        stage: 'trap',
        targetInstanceId: 'target-1',
        trapUsed: false,
        attackEffects: [],
        attackEffectIndex: 0,
      },
    }
    expect(getActingPlayerId(state)).toBe('player-one')
  })

  it('does not mutate input state', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingRefresh: {
        playerId: 'player-two',
        remainingDraws: 2,
      },
    }
    const frozen = JSON.parse(JSON.stringify(state)) as GameState
    getActingPlayerId(state)
    expect(state).toEqual(frozen)
  })

  it('returns pendingRefresh playerId when both pendingRefresh and pendingInspectDeck exist', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingRefresh: {
        playerId: 'player-two',
        remainingDraws: 0,
      },
      pendingInspectDeck: {
        playerId: 'player-one',
        sourceInstanceId: 'test-source',
        sourceCardName: 'Test',
        revealedCards: [],
        lookCount: 3,
        pickCount: 1,
      },
    }
    expect(getActingPlayerId(state)).toBe('player-two')
  })
})

describe('isPlayerControllingState', () => {
  it('returns true for damage stage regardless of playerId', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingBattle: {
        attackerInstanceId: 'attacker-1',
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        declaredDamage: 3,
        faintedColors: [],
        preventKnockoutTargetIds: [],
        remainingDamage: 3,
        revealedHpCard: null,
        stage: 'damage',
        targetInstanceId: 'target-1',
        trapUsed: false,
        attackEffects: [],
        attackEffectIndex: 0,
      },
    }
    expect(isPlayerControllingState(state, 'player-two')).toBe(true)
  })

  it('returns false for non-damage pending when checking non-controlling player', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingOnPlay: {
        playerId: 'player-one',
        sourceInstanceId: 'cookie-1',
      },
    }
    expect(isPlayerControllingState(state, 'player-two')).toBe(false)
  })

  it('returns true for non-damage pending when checking controlling player', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingOnPlay: {
        playerId: 'player-one',
        sourceInstanceId: 'cookie-1',
      },
    }
    expect(isPlayerControllingState(state, 'player-one')).toBe(true)
  })

  it('returns true for player with pendingOptionalCostAttack', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingOptionalCostAttack: {
        playerId: 'player-two',
        sourceInstanceId: 'test-source',
        sourceCardName: 'Test',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'test',
      },
    }
    expect(isPlayerControllingState(state, 'player-two')).toBe(true)
    expect(isPlayerControllingState(state, 'player-one')).toBe(false)
  })

  it('returns true for player with pendingInspectDeck', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingInspectDeck: {
        playerId: 'player-one',
        sourceInstanceId: 'test-source',
        sourceCardName: 'Test',
        revealedCards: [],
        lookCount: 3,
        pickCount: 1,
      },
    }
    expect(isPlayerControllingState(state, 'player-one')).toBe(true)
    expect(isPlayerControllingState(state, 'player-two')).toBe(false)
  })
})
