import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  executeCardEffect,
  type CardEffect,
  type GameState,
} from '.'
import {
  applyGameCommand,
  getPendingDecision,
} from './commands'
import { replayCommands } from './replay'

describe('getPendingDecision', () => {
  it('returns null when no pending decisions exist', () => {
    const state = createDemoGame()
    expect(getPendingDecision(state)).toBeNull()
  })

  it('returns null when only pendingBattle exists', () => {
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
    expect(getPendingDecision(state)).toBeNull()
  })

  it('returns null when only pendingReplacement exists', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingReplacement: {
        tasks: [{ playerId: 'player-one', remaining: 1 }],
      },
    }
    expect(getPendingDecision(state)).toBeNull()
  })

  it('returns null when only pendingOnPlay exists', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingOnPlay: {
        playerId: 'player-one',
        sourceInstanceId: 'cookie-1',
      },
    }
    expect(getPendingDecision(state)).toBeNull()
  })

  it('returns null when only pendingRefresh exists', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingRefresh: {
        playerId: 'player-one',
        remainingDraws: 2,
      },
    }
    expect(getPendingDecision(state)).toBeNull()
  })

  it('returns null when state.status is finished', () => {
    const state: GameState = {
      ...createDemoGame(),
      status: 'finished',
      pendingInspectDeck: {
        playerId: 'player-one',
        sourceInstanceId: 'test-source',
        sourceCardName: 'Test',
        revealedCards: [
          createDemoGame().players['player-one'].deck[0],
        ],
        lookCount: 3,
        pickCount: 1,
      },
    }
    expect(getPendingDecision(state)).toBeNull()
  })

  it('returns null when state.status is finished even with pendingOptionalCostAttack', () => {
    const state: GameState = {
      ...createDemoGame(),
      status: 'finished',
      pendingOptionalCostAttack: {
        playerId: 'player-two' as const,
        sourceInstanceId: 'test-source',
        sourceCardName: 'Test',
        cost: { energy: {}, discardHand: 0 },
        effects: [],
        effectText: 'test',
      },
    }
    expect(getPendingDecision(state)).toBeNull()
  })

  it('returns null when state.status is setup', () => {
    const state: GameState = {
      ...createDemoGame(),
      status: 'setup',
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-one' as const,
          sourceInstanceId: 'faint-cookie',
          effect: {
            kind: 'damage' as const,
            amount: 1,
            target: { side: 'opponent' as const, min: 0, max: 1 },
          },
          context: {
            sourcePlayerId: 'player-one' as const,
            sourceInstanceId: 'faint-cookie',
          },
        },
      ],
    }
    expect(getPendingDecision(state)).toBeNull()
  })

  it('returns faint-effect decision with metadata', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-one' as const,
          sourceInstanceId: 'faint-cookie',
          effect: {
            kind: 'damage' as const,
            amount: 1,
            target: { side: 'opponent' as const, min: 0, max: 1 },
          },
          context: {
            sourcePlayerId: 'player-one' as const,
            sourceInstanceId: 'faint-cookie',
          },
        },
      ],
    }

    const decision = getPendingDecision(state)
    expect(decision).not.toBeNull()
    expect(decision!.kind).toBe('faint-effect')
    expect(decision!.playerId).toBe('player-one')
    expect(decision!.sourcePlayerId).toBe('player-one')
    expect(decision!.sourceInstanceId).toBe('faint-cookie')
    expect(decision!).toHaveProperty('min', 0)
    expect(decision!).toHaveProperty('max', 1)
  })

  it('returns faint-effect with min>0 metadata', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-two' as const,
          sourceInstanceId: 'faint-cookie-2',
          effect: {
            kind: 'modify-attack' as const,
            amount: 2,
            target: { side: 'self' as const, min: 1, max: 1 },
            duration: 'this-turn',
          },
          context: {
            sourcePlayerId: 'player-two' as const,
            sourceInstanceId: 'faint-cookie-2',
          },
        },
      ],
    }

    const decision = getPendingDecision(state)
    expect(decision).not.toBeNull()
    expect(decision!.kind).toBe('faint-effect')
    expect(decision!.playerId).toBe('player-two')
    expect(decision!).toHaveProperty('min', 1)
    expect(decision!).toHaveProperty('max', 1)
  })

  it('returns opponent-hand-discard decision with metadata', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingOpponentHandDiscard: {
        playerId: 'player-two' as const,
        count: 2,
        sourcePlayerId: 'player-one' as const,
        sourceInstanceId: 'rogue-cookie',
        sourceCardName: 'Roguefort Cookie',
        effectText: 'Your opponent discards 2 card(s) from their hand.',
      },
    }

    const decision = getPendingDecision(state)
    expect(decision).not.toBeNull()
    expect(decision!.kind).toBe('opponent-hand-discard')
    expect(decision!.playerId).toBe('player-two')
    expect(decision!.sourcePlayerId).toBe('player-one')
    expect(decision!.sourceInstanceId).toBe('rogue-cookie')
    expect(decision!).toHaveProperty('sourceCardName', 'Roguefort Cookie')
    expect(decision!).toHaveProperty('effectText')
    expect(decision!).toHaveProperty('count', 2)
  })

  it('faint takes priority over opponent discard when both exist', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-one' as const,
          sourceInstanceId: 'faint-cookie',
          effect: {
            kind: 'damage' as const,
            amount: 1,
            target: { side: 'opponent' as const, min: 0, max: 1 },
          },
          context: {
            sourcePlayerId: 'player-one' as const,
            sourceInstanceId: 'faint-cookie',
          },
        },
      ],
      pendingOpponentHandDiscard: {
        playerId: 'player-two' as const,
        count: 1,
        sourcePlayerId: 'player-one' as const,
        sourceInstanceId: 'rogue-cookie',
        sourceCardName: 'Roguefort Cookie',
        effectText: 'Discard 1 card.',
      },
    }

    const decision = getPendingDecision(state)
    expect(decision!.kind).toBe('faint-effect')
  })

  it('does not copy candidate card objects in decision', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingOpponentHandDiscard: {
        playerId: 'player-two' as const,
        count: 2,
        sourcePlayerId: 'player-one' as const,
        sourceInstanceId: 'rogue-cookie',
        sourceCardName: 'Roguefort Cookie',
        effectText: 'Discard 2 cards.',
      },
    }

    const decision = getPendingDecision(state)
    const keys = Object.keys(decision!)
    expect(keys).not.toContain('candidates')
    expect(keys).not.toContain('handCards')
    expect(keys).not.toContain('cards')
  })
})

describe('applyGameCommand', () => {
  it('throws GameRuleError when no pending decision', () => {
    const state = createDemoGame()
    expect(() =>
      applyGameCommand(state, {
        kind: 'resolve-faint-effect',
        playerId: 'player-one',
        targetIds: [],
      }),
    ).toThrow('目前沒有待處理的決策')
  })

  it('applies resolve-faint-effect command with empty targetIds', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-one' as const,
          sourceInstanceId: 'faint-cookie',
          effect: {
            kind: 'modify-attack' as const,
            amount: 1,
            target: { side: 'opponent' as const, min: 0, max: 1 },
            duration: 'this-turn',
          },
          context: {
            sourcePlayerId: 'player-one' as const,
            sourceInstanceId: 'faint-cookie',
          },
        },
      ],
    }

    const result = applyGameCommand(state, {
      kind: 'resolve-faint-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(result.pendingFaintEffects).toBeUndefined()
  })

  it('applies resolve-opponent-hand-discard command', () => {
    const odhContext = {
      sourcePlayerId: 'player-one' as const,
      sourceInstanceId: 'rogue-cookie',
    }
    const state = executeCardEffect(
      createDemoGame(),
      odhContext,
      { kind: 'opponent-discard-hand', count: 1 } as CardEffect,
      [],
    )
    expect(state.pendingOpponentHandDiscard).toBeTruthy()

    const handCardIds = state.players['player-two'].hand.slice(0, 1).map(
      (card) => card.instanceId,
    )
    const result = applyGameCommand(state, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-two',
      cardIds: handCardIds,
    })
    expect(result.pendingOpponentHandDiscard).toBeNull()
  })

  it('rejects wrong player for faint-effect', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-one' as const,
          sourceInstanceId: 'faint-cookie',
          effect: {
            kind: 'damage' as const,
            amount: 1,
            target: { side: 'opponent' as const, min: 0, max: 1 },
          },
          context: {
            sourcePlayerId: 'player-one' as const,
            sourceInstanceId: 'faint-cookie',
          },
        },
      ],
    }

    expect(() =>
      applyGameCommand(state, {
        kind: 'resolve-faint-effect',
        playerId: 'player-two',
        targetIds: [],
      }),
    ).toThrow('不是目前需要執行決策的玩家')
  })

  it('rejects wrong player for opponent-hand-discard', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingOpponentHandDiscard: {
        playerId: 'player-two' as const,
        count: 1,
        sourcePlayerId: 'player-one' as const,
        sourceInstanceId: 'rogue-cookie',
        sourceCardName: 'Roguefort Cookie',
        effectText: 'Discard 1 card.',
      },
    }

    expect(() =>
      applyGameCommand(state, {
        kind: 'resolve-opponent-hand-discard',
        playerId: 'player-one',
        cardIds: [],
      }),
    ).toThrow('不是目前需要執行決策的玩家')
  })

  it('rejects command kind mismatch: faint command on discard pending', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingOpponentHandDiscard: {
        playerId: 'player-two' as const,
        count: 1,
        sourcePlayerId: 'player-one' as const,
        sourceInstanceId: 'rogue-cookie',
        sourceCardName: 'Roguefort Cookie',
        effectText: 'Discard 1 card.',
      },
    }

    expect(() =>
      applyGameCommand(state, {
        kind: 'resolve-faint-effect',
        playerId: 'player-two',
        targetIds: [],
      }),
    ).toThrow('指令種類與目前待處理的決策不相符')
  })

  it('rejects command kind mismatch: discard command on faint pending', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-one' as const,
          sourceInstanceId: 'faint-cookie',
          effect: {
            kind: 'damage' as const,
            amount: 1,
            target: { side: 'opponent' as const, min: 0, max: 1 },
          },
          context: {
            sourcePlayerId: 'player-one' as const,
            sourceInstanceId: 'faint-cookie',
          },
        },
      ],
    }

    expect(() =>
      applyGameCommand(state, {
        kind: 'resolve-opponent-hand-discard',
        playerId: 'player-one',
        cardIds: [],
      }),
    ).toThrow('指令種類與目前待處理的決策不相符')
  })

  it('input state is immutable after getPendingDecision', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-one' as const,
          sourceInstanceId: 'faint-cookie',
          effect: {
            kind: 'damage' as const,
            amount: 1,
            target: { side: 'opponent' as const, min: 0, max: 1 },
          },
          context: {
            sourcePlayerId: 'player-one' as const,
            sourceInstanceId: 'faint-cookie',
          },
        },
      ],
    }

    const frozen = JSON.parse(JSON.stringify(state)) as GameState
    getPendingDecision(state)
    expect(state).toEqual(frozen)
  })

  it('input state is immutable after applyGameCommand', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingOpponentHandDiscard: {
        playerId: 'player-two' as const,
        count: 1,
        sourcePlayerId: 'player-one' as const,
        sourceInstanceId: 'rogue-cookie',
        sourceCardName: 'Roguefort Cookie',
        effectText: 'Discard 1 card.',
      },
    }

    const frozen = JSON.parse(JSON.stringify(state)) as GameState
    const handCardIds = state.players['player-two'].hand.slice(0, 1).map(
      (card) => card.instanceId,
    )
    applyGameCommand(state, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-two',
      cardIds: handCardIds,
    })
    expect(state).toEqual(frozen)
  })

  it('returns inspect-deck decision when pendingInspectDeck exists', () => {
    const base = createDemoGame()
    const state: GameState = {
      ...base,
      pendingInspectDeck: {
        playerId: 'player-two' as const,
        sourceInstanceId: 'test-source',
        sourceCardName: 'Test',
        revealedCards: [
          base.players['player-two'].deck[0],
          base.players['player-two'].deck[1],
          base.players['player-two'].deck[2],
        ],
        lookCount: 3,
        pickCount: 1,
      },
    }
    const decision = getPendingDecision(state)
    expect(decision).toBeDefined()
    expect(decision!.kind).toBe('inspect-deck')
  })

  it('returns null for inspect-deck when pendingRefresh also exists', () => {
    const base = createDemoGame()
    const state: GameState = {
      ...base,
      pendingRefresh: {
        playerId: 'player-two',
        remainingDraws: 2,
      },
      pendingInspectDeck: {
        playerId: 'player-two' as const,
        sourceInstanceId: 'test-source',
        sourceCardName: 'Test',
        revealedCards: [
          base.players['player-two'].deck[0],
          base.players['player-two'].deck[1],
          base.players['player-two'].deck[2],
        ],
        lookCount: 3,
        pickCount: 1,
      },
    }
    expect(getPendingDecision(state)).toBeNull()
  })

  it('returns optional-cost-attack decision when pendingOptionalCostAttack exists', () => {
    const state: GameState = {
      ...createDemoGame(),
      pendingOptionalCostAttack: {
        playerId: 'player-two' as const,
        sourceInstanceId: 'test-source',
        sourceCardName: 'Test',
        cost: { energy: {}, discardHand: 2 },
        effects: [],
        effectText: 'test',
      },
    }
    const decision = getPendingDecision(state)
    expect(decision).toBeDefined()
    expect(decision!.kind).toBe('optional-cost-attack')
  })

  it('applyGameCommand dispatches resolve-inspect-deck', () => {
    const state = createDemoGame()
    const deck = state.players['player-two'].deck
    const withPending: GameState = {
      ...state,
      pendingInspectDeck: {
        playerId: 'player-two' as const,
        sourceInstanceId: 'test-source',
        sourceCardName: 'Test',
        revealedCards: [deck[0], deck[1], deck[2]],
        lookCount: 3,
        pickCount: 1,
      },
    }
    const result = applyGameCommand(withPending, {
      kind: 'resolve-inspect-deck',
      playerId: 'player-two',
      pickedCardId: deck[0].instanceId,
      restOrder: [deck[1].instanceId, deck[2].instanceId],
    })
    expect(result.pendingInspectDeck).toBeNull()
    expect(result.players['player-two'].hand.map((c) => c.instanceId)).toContain(
      deck[0].instanceId,
    )
  })

  it('applyGameCommand dispatches resolve-optional-cost-attack', () => {
    const state = createDemoGame()
    const withPending: GameState = {
      ...state,
      pendingBattle: {
        attackerPlayerId: 'player-two' as const,
        defenderPlayerId: 'player-one' as const,
        attackerInstanceId: 'attacker-inst',
        targetInstanceId: 'target-inst',
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
        playerId: 'player-two' as const,
        sourceInstanceId: 'test-source',
        sourceCardName: 'Test',
        cost: { energy: {}, discardHand: 0 },
        effects: [],
        effectText: 'test',
      },
    }
    const result = applyGameCommand(withPending, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-two',
      action: 'skip',
    })
    expect(result.pendingOptionalCostAttack).toBeNull()
  })
})

describe('applyGameCommand replacement finalization', () => {
  const makeState = (overrides: Partial<GameState> = {}): GameState => {
    const base = createDemoGame()
    return {
      ...base,
      pendingBattle: null,
      pendingRefresh: null,
      pendingOnPlay: null,
      pendingReplacement: null,
      pendingStageTrigger: null,
      pendingFaintEffects: [],
      pendingAfterDamageEffects: [],
      departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
      ...overrides,
    }
  }

  const abilityEffect = {
    playerId: 'player-one' as const,
    sourcePlayerId: 'player-one' as const,
    sourceInstanceId: 'test-source',
    sourceKind: 'skill' as const,
    effects: [{ kind: 'draw' as const, amount: 1 }],
    effectIndex: 0,
  }

  const decisionOverrides = (): Array<[string, string, Partial<GameState>]> => {
    const base = createDemoGame()
    const decisionEffect = { kind: 'draw' as const, amount: 1 }
    const context = {
      sourcePlayerId: 'player-one' as const,
      sourceInstanceId: 'test-source',
    }
    return [
      ['effect order', 'effect-order', {
        pendingEffectOrder: {
          playerId: 'player-one',
          items: [{
            id: 'ordered-effect',
            kind: 'inspect-deck',
            sourcePlayerId: 'player-one',
            sourceInstanceId: 'test-source',
            sourceCardName: 'Test Source',
          }],
        },
      }],
      ['faint effect', 'faint-effect', {
        pendingFaintEffects: [{
          sourcePlayerId: 'player-one',
          sourceInstanceId: 'test-source',
          effect: decisionEffect,
          context,
        }],
      }],
      ['after-damage effect', 'after-damage-effect', {
        pendingAfterDamageEffects: [{
          sourcePlayerId: 'player-one',
          sourceInstanceId: 'test-source',
          effect: decisionEffect,
          context,
        }],
      }],
      ['opponent hand discard', 'opponent-hand-discard', {
        pendingOpponentHandDiscard: {
          playerId: 'player-two',
          count: 1,
          sourcePlayerId: 'player-one',
          sourceInstanceId: 'test-source',
          sourceCardName: 'Test Source',
          effectText: 'Discard 1 card.',
        },
      }],
      ['inspect deck', 'inspect-deck', {
        pendingInspectDeck: {
          playerId: 'player-one',
          sourceInstanceId: 'test-source',
          sourceCardName: 'Test Source',
          revealedCards: base.players['player-one'].deck.slice(0, 2),
          lookCount: 2,
          pickCount: 1,
        },
      }],
      ['optional-cost attack', 'optional-cost-attack', {
        pendingOptionalCostAttack: {
          playerId: 'player-one',
          sourceInstanceId: 'test-source',
          sourceCardName: 'Test Source',
          cost: { energy: {}, discardHand: 0 },
          effects: [],
          effectText: 'Optional cost.',
        },
      }],
      ['draw up to', 'draw-up-to', {
        pendingDrawUpTo: {
          playerId: 'player-one',
          max: 6,
          sourcePlayerId: 'player-one',
          sourceInstanceId: 'test-source',
          sourceCardName: 'Test Source',
        },
      }],
      ['stage trigger', 'stage-trigger', {
        pendingStageTrigger: {
          playerId: 'player-one',
          sourceInstanceId: 'test-source',
          sourceCardName: 'Test Source',
          effectText: 'Trigger effect.',
        },
      }],
    ]
  }

  it.each(decisionOverrides())(
    'does not bypass a pending %s decision between ability-effect steps',
    (_name, expectedKind, decisionOverride) => {
      const state = makeState({
        pendingAbilityEffect: abilityEffect,
        ...decisionOverride,
      })
      const snapshot = JSON.parse(JSON.stringify(state)) as GameState

      expect(getPendingDecision(state)?.kind).toBe(expectedKind)
      expect(() =>
        applyGameCommand(state, {
          kind: 'resolve-ability-effect',
          playerId: 'player-one',
          targetIds: [],
        }),
      ).toThrow('必須先處理待處理的決策。')
      expect(state).toEqual(snapshot)
    },
  )

  it('resumes an ability effect after the intervening decision is resolved', () => {
    const base = makeState({
      pendingAbilityEffect: {
        ...abilityEffect,
        effects: [
          {
            kind: 'inspect-deck',
            lookCount: 2,
            pickCount: 1,
            restToBottom: true,
          },
          { kind: 'draw', amount: 1 },
        ],
      },
    })
    const resolveAbility = {
      kind: 'resolve-ability-effect' as const,
      playerId: 'player-one' as const,
      targetIds: [],
    }

    const awaitingInspect = applyGameCommand(base, resolveAbility)
    expect(awaitingInspect.pendingInspectDeck?.revealedCards).toHaveLength(2)
    expect(awaitingInspect.pendingAbilityEffect?.effectIndex).toBe(1)
    expect(() => applyGameCommand(awaitingInspect, resolveAbility)).toThrow(
      '必須先處理待處理的決策。',
    )

    const revealedCards = awaitingInspect.pendingInspectDeck!.revealedCards
    const resolveInspect = {
      kind: 'resolve-inspect-deck' as const,
      playerId: 'player-one' as const,
      pickedCardId: revealedCards[0].instanceId,
      restOrder: [revealedCards[1].instanceId],
    }
    const afterInspect = applyGameCommand(awaitingInspect, resolveInspect)
    expect(afterInspect.pendingInspectDeck).toBeNull()
    expect(afterInspect.pendingAbilityEffect?.effectIndex).toBe(1)
    expect(afterInspect.players['player-one'].hand).toHaveLength(
      base.players['player-one'].hand.length + 1,
    )

    const result = applyGameCommand(afterInspect, resolveAbility)
    expect(result.pendingAbilityEffect).toBeUndefined()
    expect(result.players['player-one'].hand).toHaveLength(
      base.players['player-one'].hand.length + 2,
    )
    expect(result.commandLog?.slice(-3).map((entry) => entry.commandKind)).toEqual([
      'resolve-ability-effect',
      'resolve-inspect-deck',
      'resolve-ability-effect',
    ])
    expect(replayCommands(base, [resolveAbility, resolveInspect, resolveAbility])).toEqual(
      result,
    )
  })

  it('finalizes replacement after the last ability-effect step', () => {
    const state = makeState({
      departedCookieCounts: { 'player-one': 1, 'player-two': 0 },
      pendingAbilityEffect: {
        playerId: 'player-one',
        sourcePlayerId: 'player-one',
        sourceInstanceId: 'test-source',
        sourceKind: 'skill',
        effects: [{ kind: 'draw', amount: 1 }],
        effectIndex: 0,
      },
    })

    const command = {
      kind: 'resolve-ability-effect' as const,
      playerId: 'player-one' as const,
      targetIds: [],
    }
    const result = applyGameCommand(state, command)

    expect(result.pendingAbilityEffect).toBeUndefined()
    expect(result.pendingReplacement).not.toBeNull()
    expect(result.pendingReplacement?.tasks).toHaveLength(1)
    expect(result.pendingReplacement?.tasks[0]).toMatchObject({
      playerId: 'player-one',
      remaining: 1,
    })
    expect(result.commandLog?.at(-1)?.commandKind).toBe(
      'resolve-ability-effect',
    )
    expect(replayCommands(state, [command])).toEqual(result)
  })

  it('does not finalize replacement between ability-effect steps', () => {
    const base = makeState({
      departedCookieCounts: { 'player-one': 1, 'player-two': 0 },
      pendingAbilityEffect: {
        playerId: 'player-one',
        sourcePlayerId: 'player-one',
        sourceInstanceId: 'test-source',
        sourceKind: 'skill',
        effects: [
          { kind: 'draw', amount: 1 },
          { kind: 'draw', amount: 1 },
        ],
        effectIndex: 0,
      },
    })
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          breakArea: [
            {
              ...base.players['player-one'].battleArea[0].card,
              instanceId: 'break-level-limit-test',
              level: 10,
            },
          ],
        },
      },
    }

    const command = {
      kind: 'resolve-ability-effect' as const,
      playerId: 'player-one' as const,
      targetIds: [],
    }
    const firstResult = applyGameCommand(state, command)

    expect(firstResult.status).toBe('playing')
    expect(firstResult.result).toBeNull()
    expect(firstResult.pendingAbilityEffect).toBeDefined()
    expect(firstResult.pendingAbilityEffect!.effectIndex).toBe(1)
    expect(firstResult.pendingReplacement).toBeNull()
    expect(firstResult.commandLog?.at(-1)?.commandKind).toBe(
      'resolve-ability-effect',
    )

    const finalResult = applyGameCommand(firstResult, command)

    expect(finalResult.status).toBe('finished')
    expect(finalResult.result).toEqual({
      loserId: 'player-one',
      winnerId: 'player-two',
      reason: 'break-level-limit',
    })
    expect(finalResult.pendingAbilityEffect).toBeUndefined()
    expect(finalResult.pendingReplacement).toBeNull()
    expect(replayCommands(state, [command, command])).toEqual(finalResult)
  })

  it('finalizes replacement after a stage decision is cleared', () => {
    const state = makeState({
      departedCookieCounts: { 'player-one': 1, 'player-two': 0 },
      pendingStageTrigger: {
        playerId: 'player-one',
        sourceInstanceId: 'stage-test',
        sourceCardName: 'Test Stage',
        effectText: 'Test effect',
      },
    })

    const result = applyGameCommand(state, {
      kind: 'resolve-stage-trigger',
      playerId: 'player-one',
      action: 'skip',
    })

    expect(result.pendingStageTrigger).toBeNull()
    expect(result.pendingReplacement).not.toBeNull()
    expect(result.pendingReplacement?.tasks).toHaveLength(1)
    expect(result.pendingReplacement?.tasks[0]).toMatchObject({
      playerId: 'player-one',
      remaining: 1,
    })
    expect(result.commandLog?.at(-1)?.commandKind).toBe(
      'resolve-stage-trigger',
    )
  })
})
