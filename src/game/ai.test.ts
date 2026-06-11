import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  selectAiEnergyPayment,
  simulateAiMatch,
  takeAiStep,
  type CardEffect,
  type CardSkill,
  type GameCard,
  type GameState,
} from '.'

const createSupport = (
  instanceId: string,
  energyColor: GameCard['energyColor'] = 'red',
) => ({
  card: {
    id: instanceId,
    instanceId,
    name: instanceId,
    type: 'item' as const,
    energyColor,
  },
  rested: false,
})

const asAiTurn = (
  state: GameState,
  phase: GameState['phase'],
): GameState => ({
  ...state,
  activePlayerId: 'player-two',
  phase,
  turnNumber: 2,
})

describe('simple AI opponent', () => {
  it('places one support card during the support phase', () => {
    const state = asAiTurn(createDemoGame(), 'support')
    const decision = takeAiStep(state)

    expect(decision.action).toBe('place-support')
    expect(
      decision.state.players['player-two'].supportArea,
    ).toHaveLength(1)
    expect(decision.state.supportPlacedThisTurn).toBe(true)
  })

  it('deploys a Cookie before other main phase actions', () => {
    const state = asAiTurn(createDemoGame(), 'main')
    const decision = takeAiStep(state)

    expect(decision.action).toBe('deploy-cookie')
    expect(
      decision.state.players['player-two'].battleArea,
    ).toHaveLength(2)
  })

  it('attacks the lowest remaining HP target with available support', () => {
    let state = asAiTurn(createDemoGame(), 'main')
    const attacker = state.players['player-two'].battleArea[0]
    const target = state.players['player-one'].battleArea[0]
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [
            {
              ...target,
              hpCards: [
                ...target.hpCards,
                createSupport('extra-hp').card,
              ],
            },
          ],
        },
        'player-two': {
          ...state.players['player-two'],
          hand: state.players['player-two'].hand.filter(
            (card) => card.type !== 'cookie',
          ),
          battleArea: [attacker],
          supportArea: Array.from(
            { length: attacker.card.attackCost },
            (_, index) => createSupport(`attack-${index}`),
          ),
        },
      },
    }

    const decision = takeAiStep(state)

    expect(decision.action).toBe('attack')
    expect(decision.state.pendingBattle).toMatchObject({
      stage: 'trap',
      attackerInstanceId: attacker.card.instanceId,
      targetInstanceId: target.card.instanceId,
    })
    expect(
      decision.state.players['player-two'].battleArea[0].rested,
    ).toBe(true)
    expect(
      decision.state.players['player-two'].supportArea.every(
        (support) => support.rested,
      ),
    ).toBe(true)
  })

  it('selects colored and neutral skill payments deterministically', () => {
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: false,
      restSource: false,
      cost: { red: 2, neutral: 1 },
      text: 'Skill',
      effects: [],
    }
    const supports = [
      createSupport('red-1', 'red'),
      createSupport('blue-1', 'blue'),
      createSupport('red-2', 'red'),
    ]

    expect(selectAiEnergyPayment(skill, supports)).toEqual([
      'red-1',
      'red-2',
      'blue-1',
    ])
  })

  it('activates a legal skill and chooses a legal effect target', () => {
    let state = asAiTurn(createDemoGame(), 'main')
    const source = state.players['player-two'].battleArea[0]
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: true,
      restSource: false,
      cost: { red: 1 },
      text: 'Deal damage',
      effects: [
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1 },
        },
      ],
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          hand: state.players['player-two'].hand.filter(
            (card) => card.type !== 'cookie',
          ),
          battleArea: [
            {
              ...source,
              card: { ...source.card, skill },
            },
          ],
          supportArea: [createSupport('skill-red')],
        },
      },
    }

    const decision = takeAiStep(state)

    expect(decision.action).toBe('activate-skill')
    expect(decision.effectSelections?.[0]).toMatchObject({
      paymentIds: ['skill-red'],
      targetIds: [
        state.players['player-one'].battleArea[0].card.instanceId,
      ],
    })
    expect(decision.state.skillUsesThisTurn).toHaveLength(1)
  })

  it('handles Refresh and defeated Cookie replacement first', () => {
    const base = createDemoGame()
    const refreshCookie = base.players['player-two'].battleArea[0].card
    const refreshState: GameState = {
      ...base,
      pendingRefresh: {
        playerId: 'player-two',
        remainingDraws: 0,
      },
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          deck: [],
          discardPile: [
            refreshCookie,
            ...base.players['player-two'].deck.slice(0, 4),
          ],
        },
      },
    }

    expect(takeAiStep(refreshState).action).toBe('refresh')

    const replacementCard = base.players['player-two'].hand.find(
      (card) => card.type === 'cookie',
    )
    expect(replacementCard).toBeDefined()
    const replacementState: GameState = {
      ...base,
      pendingReplacement: {
        tasks: [{ playerId: 'player-two', remaining: 1 }],
      },
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [],
        },
      },
    }

    expect(takeAiStep(replacementState).action).toBe('replace-cookie')
  })

  it('resolves replacement OnPlay even during the opponent turn', () => {
    const base = createDemoGame()
    const replacement = base.players['player-two'].hand.find(
      (card) => card.type === 'cookie',
    )
    expect(replacement).toBeDefined()
    const onPlayReplacement = {
      ...replacement!,
      skill: {
        trigger: 'on-play' as const,
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: {},
        text: 'Draw 1',
        effects: [{ kind: 'draw' as const, amount: 1 }],
      },
    }
    const state: GameState = {
      ...base,
      activePlayerId: 'player-one',
      pendingReplacement: {
        tasks: [{ playerId: 'player-two', remaining: 1 }],
      },
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [],
          hand: [onPlayReplacement],
        },
      },
    }

    const decision = takeAiStep(state, 'player-two')

    expect(decision.action).toBe('replace-cookie')
    expect(decision.state.pendingOnPlay).toBeNull()
    expect(decision.effectSelections).toHaveLength(1)
  })

  it('skips an optional replacement when no legal Cookie is available', () => {
    const base = createDemoGame()
    const state: GameState = {
      ...base,
      pendingReplacement: {
        tasks: [{ playerId: 'player-two', remaining: 1 }],
      },
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          hand: base.players['player-two'].hand.filter(
            (card) => card.type !== 'cookie',
          ),
          battleArea: [base.players['player-two'].battleArea[0]],
        },
      },
    }

    const decision = takeAiStep(state)

    expect(decision.action).toBe('skip-replacement')
    expect(decision.state.status).toBe('playing')
    expect(decision.state.pendingReplacement).toBeNull()
  })

  it('advances the phase when no other legal action exists', () => {
    let state = asAiTurn(createDemoGame(), 'main')
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          hand: state.players['player-two'].hand.filter(
            (card) => card.type !== 'cookie',
          ),
          battleArea: state.players['player-two'].battleArea.map(
            (cookie) => ({ ...cookie, rested: true }),
          ),
          supportArea: [],
        },
      },
    }

    const decision = takeAiStep(state)
    expect(decision.action).toBe('advance-phase')
    expect(decision.state.phase).toBe('end')
  })

  it('does not attack during the first player first turn', () => {
    let state = createDemoGame(1)

    while (state.phase !== 'main') {
      state = takeAiStep(state, 'player-one').state
    }

    const actions: string[] = []
    while (state.phase === 'main') {
      const decision = takeAiStep(state, 'player-one')
      actions.push(decision.action)
      state = decision.state
    }

    expect(actions).not.toContain('attack')
    expect(actions.at(-1)).toBe('advance-phase')
    expect(state.phase).toBe('end')
  })

  it('does not repeat a Once per turn skill', () => {
    let state = asAiTurn(createDemoGame(), 'main')
    const source = state.players['player-two'].battleArea[0]
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: false,
      restSource: false,
      cost: { red: 1 },
      text: 'Once',
      effects: [
        {
          kind: 'modify-attack',
          amount: 1,
          duration: 'this-turn',
          target: {
            side: 'self',
            min: 1,
            max: 1,
            sourceOnly: true,
          },
        },
      ],
    }
    state = {
      ...state,
      skillUsesThisTurn: [
        source.battleEntryId ?? source.card.instanceId,
      ],
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          hand: state.players['player-two'].hand.filter(
            (card) => card.type !== 'cookie',
          ),
          battleArea: [
            {
              ...source,
              rested: true,
              card: { ...source.card, skill },
            },
          ],
          supportArea: [createSupport('once-red')],
        },
      },
    }

    expect(takeAiStep(state).action).toBe('advance-phase')
  })

  it('stops a full simulation at the configured action limit', () => {
    const result = simulateAiMatch(createDemoGame(), 1)

    expect(result.stuck).toBe(true)
    expect(result.actions).toBe(1)
    expect(result.error).toContain('最大行動數')
    expect(result.logs.length).toBeLessThanOrEqual(20)
  })

  it('completes a deterministic full AI match', () => {
    const result = simulateAiMatch(createDemoGame())

    expect(result.stuck, result.error ?? '').toBe(false)
    expect(result.state.status).toBe('finished')
    expect(result.state.result).not.toBeNull()
    expect(result.actions).toBeLessThan(500)
  })

  it('completes 20 reproducible seeded matches with varied outcomes', () => {
    const firstRun = Array.from({ length: 20 }, (_, index) => {
      const seed = index + 1
      const result = simulateAiMatch(createDemoGame(seed))

      expect(result.stuck, `種子 ${seed}: ${result.error ?? ''}`).toBe(false)
      return {
        seed,
        winnerId: result.state.result?.winnerId,
        reason: result.state.result?.reason,
        turnNumber: result.state.turnNumber,
        actions: result.actions,
        metrics: result.metrics,
      }
    })
    const repeatedRun = Array.from({ length: 20 }, (_, index) => {
      const seed = index + 1
      const result = simulateAiMatch(createDemoGame(seed))

      return {
        seed,
        winnerId: result.state.result?.winnerId,
        reason: result.state.result?.reason,
        turnNumber: result.state.turnNumber,
        actions: result.actions,
        metrics: result.metrics,
      }
    })
    const outcomeSignatures = new Set(
      firstRun.map((result) =>
        JSON.stringify({
          winnerId: result.winnerId,
          reason: result.reason,
          turnNumber: result.turnNumber,
          actions: result.actions,
          metrics: result.metrics,
        }),
      ),
    )

    expect(repeatedRun).toEqual(firstRun)
    expect(outcomeSignatures.size).toBeGreaterThan(1)
  })

  it('can move from the first active phase without mutating input', () => {
    const state = createDemoGame()
    const snapshot = structuredClone(state)
    const next = takeAiStep(
      {
        ...state,
        activePlayerId: 'player-two',
      },
      'player-two',
    )

    expect(next.action).toBe('advance-phase')
    expect(state).toEqual(snapshot)
  })
})

describe('AI break-to-trash target selection', () => {
  const bttEffect: CardEffect = {
    kind: 'break-to-trash',
    max: 1,
    exactLevel: 1,
  }

  const bttSkill: CardSkill = {
    trigger: 'activate',
    oncePerTurn: false,
    yourTurn: false,
    restSource: false,
    cost: {},
    text: 'Test break-to-trash',
    effects: [bttEffect],
  }

  it('selects 1 break area target when candidates exist', () => {
    let state = createDemoGame()
    const aiCookie = {
      ...state.players['player-two'].battleArea[0].card,
      skill: bttSkill,
      effects: [bttEffect],
    }
    const lv1Card = {
      ...state.players['player-two'].battleArea[0].card,
      instanceId: 'ai-break-lv1',
      level: 1,
    }

    state = {
      ...state,
      activePlayerId: 'player-two',
      phase: 'main',
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          battleArea: [{ ...state.players['player-two'].battleArea[0], card: aiCookie }],
          breakArea: [lv1Card],
          hand: state.players['player-two'].hand.filter(
            (c) => c.type !== 'cookie',
          ),
        },
      },
    }

    const decision = takeAiStep(state, 'player-two')

    expect(decision.action).toBe('activate-skill')
    expect(decision.effectSelections).toBeDefined()
    expect(decision.effectSelections![0].targetIds).toEqual([lv1Card.instanceId])
    expect(decision.state.players['player-two'].breakArea).toHaveLength(0)
    expect(decision.state.players['player-two'].discardPile).toHaveLength(
      state.players['player-two'].discardPile.length + 1,
    )
  })

  it('resolves faint effect by selecting lowest HP opponent target', () => {
    const base = createDemoGame()
    const targetCookie = base.players['player-one'].battleArea[0]
    const faintCookie: GameCard & { skill: CardSkill } = {
      ...base.players['player-two'].battleArea[0].card,
      skill: {
        trigger: 'passive',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: {},
        text: 'When this Cookie faints, select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
        faint: true,
      },
    }
    const state: GameState = {
      ...base,
      activePlayerId: 'player-two',
      phase: 'main',
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-two',
          sourceInstanceId: faintCookie.instanceId,
          effect: {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          context: {
            sourcePlayerId: 'player-two',
            sourceInstanceId: faintCookie.instanceId,
          },
        },
      ],
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [],
          breakArea: [faintCookie],
          hand: base.players['player-two'].hand.filter(
            (c) => c.type !== 'cookie',
          ),
        },
      },
    }

    const decision = takeAiStep(state, 'player-two')

    expect(decision.action).toBe('resolve-faint')
    expect(
      decision.state.players['player-one'].battleArea[0].hpCards.length,
    ).toBe(targetCookie.hpCards.length - 1)
  })

  it('skips faint effect when target min is 0 and no candidates wanted', () => {
    const base = createDemoGame()
    const state: GameState = {
      ...base,
      activePlayerId: 'player-two',
      phase: 'main',
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-two',
          sourceInstanceId: 'faint-cookie',
          effect: {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          context: {
            sourcePlayerId: 'player-two',
            sourceInstanceId: 'faint-cookie',
          },
        },
      ],
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [],
          breakArea: [],
          hand: base.players['player-two'].hand.filter(
            (c) => c.type !== 'cookie',
          ),
        },
        'player-one': {
          ...base.players['player-one'],
          battleArea: [],
        },
      },
    }

    const decision = takeAiStep(state, 'player-two')

    expect(decision.action).toBe('resolve-faint')
    expect(decision.state.pendingFaintEffects).toBeUndefined()
  })

  it('waits for the correct player to resolve faint effect', () => {
    const base = createDemoGame()
    const state: GameState = {
      ...base,
      activePlayerId: 'player-two',
      phase: 'main',
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: 'p1-cookie',
          effect: {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          context: {
            sourcePlayerId: 'player-one',
            sourceInstanceId: 'p1-cookie',
          },
        },
      ],
    }

    const decision = takeAiStep(state, 'player-two')

    expect(decision.action).toBe('idle')
    expect(decision.description).toContain('等待')
  })

  it('selects 0 break area targets when no candidates exist', () => {
    let state = createDemoGame()
    const aiCookie = {
      ...state.players['player-two'].battleArea[0].card,
      skill: bttSkill,
      effects: [bttEffect],
    }

    state = {
      ...state,
      activePlayerId: 'player-two',
      phase: 'main',
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          battleArea: [{ ...state.players['player-two'].battleArea[0], card: aiCookie }],
          breakArea: [],
          hand: state.players['player-two'].hand.filter(
            (c) => c.type !== 'cookie',
          ),
        },
      },
    }

    const decision = takeAiStep(state, 'player-two')

    expect(decision.action).toBe('activate-skill')
    expect(decision.effectSelections![0].targetIds).toHaveLength(0)
  })
})

describe('AI opponent hand discard decision', () => {
  it('AI deterministically discards hand cards when forced', () => {
    const state = createDemoGame()
    const handCards = state.players['player-two'].hand.slice(0, 3)
    const discardState: GameState = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          hand: handCards,
        },
      },
      activePlayerId: 'player-one',
      phase: 'main',
      pendingOpponentHandDiscard: {
        playerId: 'player-two',
        count: 1,
        sourcePlayerId: 'player-one',
        sourceInstanceId: 'player-one-starter-1',
        sourceCardName: 'Roguefort Cookie',
        effectText: 'opponent-discard-hand',
      },
    }
    const decision = takeAiStep(discardState, 'player-two')
    expect(decision.state.pendingOpponentHandDiscard).toBeNull()
    expect(decision.state.players['player-two'].hand).toHaveLength(
      handCards.length - 1,
    )
  })

  it('AI waits when opponent discard is for the other player', () => {
    const state = createDemoGame()
    const waitState: GameState = {
      ...state,
      activePlayerId: 'player-two',
      phase: 'main',
      pendingOpponentHandDiscard: {
        playerId: 'player-one',
        count: 1,
        sourcePlayerId: 'player-two',
        sourceInstanceId: 'player-two-starter-1',
        sourceCardName: 'Roguefort Cookie',
        effectText: 'opponent-discard-hand',
      },
    }
    const decision = takeAiStep(waitState, 'player-two')
    expect(decision.action).toBe('idle')
    expect(decision.description).toContain('等待')
  })
})
