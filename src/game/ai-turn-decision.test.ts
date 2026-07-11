import { describe, expect, it } from 'vitest'
import {
  activateCookieSkill,
  createDemoGame,
  createOfficialPurpleStarterDeck,
  executeCardEffect,
  finalizePendingReplacements,
  getActingPlayerId,
  replaceDefeatedCookie,
  replayCommandLog,
  selectAiEnergyPayment,
  simulateAiMatch,
  takeAiStep,
  type CardSkill,
  type CookieCard,
  type GameCard,
  type GameState,
} from '.'
import { createFlipResponseDemoState } from './demo'

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
  it('resolves a faint decision before a simultaneous replacement', () => {
    const result = simulateAiMatch(
      createDemoGame(8, { player: 'red', ai: 'yellow' }),
    )

    expect(result.stuck).toBe(false)
    expect(result.error).toBeNull()
  })

  it('reports the revealed FLIP card before applying the AI response', () => {
    const state = createFlipResponseDemoState()
    const playerId =
      state.pendingBattle?.damagePlayerId ??
      state.pendingBattle?.defenderPlayerId
    expect(playerId).toBeDefined()

    const decision = takeAiStep(state, playerId)

    expect(decision.action).toBe('resolve-flip')
    expect(decision.revealedCard).toBe(
      state.pendingBattle?.revealedHpCard,
    )
  })

  it('draws immediately, without a pending decision, after activating an optional FLIP draw', () => {
    const base = createFlipResponseDemoState()
    const playerId =
      base.pendingBattle?.damagePlayerId ??
      base.pendingBattle?.defenderPlayerId
    expect(playerId).toBeDefined()
    const revealedCard = {
      ...base.pendingBattle!.revealedHpCard!,
      flip: {
        text: 'Draw up to 1 card from your deck.',
        cost: { energy: {}, discardHand: 0 },
        effects: [{ kind: 'draw-up-to' as const, max: 1 }],
      },
    }
    const state: GameState = {
      ...base,
      pendingBattle: {
        ...base.pendingBattle!,
        revealedHpCard: revealedCard,
      },
    }
    const handSizeBefore = state.players['player-one'].hand.length

    const decision = takeAiStep(state, playerId)

    expect(decision.action).toBe('resolve-flip')
    expect(decision.state.pendingDrawUpTo ?? null).toBeNull()
    expect(decision.state.players['player-one'].hand).toHaveLength(
      handSizeBefore + 1,
    )
  })

  it.each([1, 2, 3] as const)(
    'places one support card during the support phase at level %i',
    (level) => {
      const state = asAiTurn(createDemoGame(), 'support')
      const supportCount = state.players['player-two'].supportArea.length
      const decision = takeAiStep(state, 'player-two', { level, seed: 5 })

      expect(decision.action).toBe('place-support')
      expect(
        decision.state.players['player-two'].supportArea,
      ).toHaveLength(supportCount + 1)
      expect(decision.state.supportPlacedThisTurn).toBe(true)
    },
  )

  it('fills support on every AI support phase while cards are available', () => {
    let state = createDemoGame(4, { player: 'red', ai: 'bs2-blue' })
    const supportTurns: number[] = []

    for (let step = 0; step < 500 && supportTurns.length < 5; step += 1) {
      const controller = getActingPlayerId(state) ?? state.activePlayerId
      const aiCanPlaceSupport =
        state.activePlayerId === 'player-two' &&
        state.phase === 'support' &&
        !state.supportPlacedThisTurn &&
        state.players['player-two'].hand.length > 0

      if (aiCanPlaceSupport) {
        const supportCount = state.players['player-two'].supportArea.length
        const decision = takeAiStep(state, 'player-two')

        expect(decision.action).toBe('place-support')
        expect(
          decision.state.players['player-two'].supportArea,
        ).toHaveLength(supportCount + 1)
        expect(decision.state.supportPlacedThisTurn).toBe(true)
        supportTurns.push(state.turnNumber)
        state = decision.state
        continue
      }

      const decision = takeAiStep(state, controller)
      expect(decision.action, decision.description).not.toBe('error')
      expect(decision.state, decision.description).not.toBe(state)
      state = decision.state
    }

    expect(supportTurns.length).toBeGreaterThanOrEqual(3)
    expect(new Set(supportTurns).size).toBe(supportTurns.length)
  })

  it('deploys a Cookie before other main phase actions', () => {
    const state = asAiTurn(createDemoGame(), 'main')
    const decision = takeAiStep(state)

    expect(decision.action).toBe('deploy-cookie')
    expect(
      decision.state.players['player-two'].battleArea,
    ).toHaveLength(2)
  })

  it('handles replacement before resolving its own pending faint effect', () => {
    const base = asAiTurn(createDemoGame(), 'main')
    const replacement: CookieCard = {
      id: 'ai-replacement',
      instanceId: 'ai-replacement',
      name: 'AI Replacement',
      type: 'cookie',
      level: 1,
      hp: 1,
      attack: 1,
      attackCost: 1,
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          hand: [replacement],
          deck: [
            createSupport('ai-replacement-hp').card,
            createSupport('ai-spare-deck-card').card,
          ],
          battleArea: [],
        },
      },
      pendingReplacement: {
        tasks: [{ playerId: 'player-two', remaining: 1 }],
      },
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-two',
          sourceInstanceId: 'ai-fainted-cookie',
          sourceCardName: 'AI Fainted Cookie',
          effect: {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          context: {
            sourcePlayerId: 'player-two',
            sourceInstanceId: 'ai-fainted-cookie',
            sourceCardName: 'AI Fainted Cookie',
          },
        },
      ],
    }

    const decision = takeAiStep(state)

    expect(decision.action).toBe('replace-cookie')
    expect(decision.state.pendingReplacement).toBeNull()
    expect(decision.state.pendingFaintEffects).toHaveLength(1)
    expect(
      decision.state.players['player-two'].battleArea[0].card.instanceId,
    ).toBe('ai-replacement')
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
          hand: [],
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

  it('does not attack with a cookie disabled for the current turn, and does not error', () => {
    let state = asAiTurn(createDemoGame(), 'main')
    const attacker = state.players['player-two'].battleArea[0]
    state = {
      ...state,
      attackDisabledUntilTurn: { [attacker.card.instanceId]: state.turnNumber },
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          hand: [],
          battleArea: [attacker],
          supportArea: Array.from(
            { length: attacker.card.attackCost },
            (_, index) => createSupport(`attack-${index}`),
          ),
        },
      },
    }

    const decision = takeAiStep(state)

    expect(decision.action).not.toBe('attack')
    expect(decision.action).not.toBe('error')
    expect(
      decision.state.players['player-two'].battleArea[0].rested,
    ).toBe(false)
  })

  it('skips a disabled attacker and attacks with another cookie instead', () => {
    let state = asAiTurn(createDemoGame(), 'main')
    const disabledAttacker = state.players['player-two'].battleArea[0]
    const readyAttacker = {
      ...disabledAttacker,
      card: { ...disabledAttacker.card, instanceId: 'ready-attacker' },
    }
    const target = state.players['player-one'].battleArea[0]
    state = {
      ...state,
      attackDisabledUntilTurn: {
        [disabledAttacker.card.instanceId]: state.turnNumber,
      },
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          hand: [],
          battleArea: [disabledAttacker, readyAttacker],
          supportArea: Array.from(
            { length: readyAttacker.card.attackCost * 2 },
            (_, index) => createSupport(`attack-${index}`),
          ),
        },
      },
    }

    const decision = takeAiStep(state)

    expect(decision.action).toBe('attack')
    expect(decision.state.pendingBattle).toMatchObject({
      attackerInstanceId: readyAttacker.card.instanceId,
      targetInstanceId: target.card.instanceId,
    })
    expect(
      decision.state.players['player-two'].battleArea.find(
        (cookie) => cookie.card.instanceId === disabledAttacker.card.instanceId,
      )?.rested,
    ).toBe(false)
  })

  it('selects colored and neutral skill payments deterministically', () => {
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: false,
      restSource: false,
      cost: { energy: { red: 2, neutral: 1 }, discardHand: 0 },
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
      cost: { energy: { red: 1 }, discardHand: 0 },
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

    const refreshDecision = takeAiStep(refreshState, 'player-two', { seed: 42 })
    expect(refreshDecision.action).toBe('refresh')
    const refreshEntry = refreshDecision.state.commandLog?.at(-1)
    expect(refreshEntry?.payload).toMatchObject({
      shuffleSeed: expect.any(Number),
    })
    expect(replayCommandLog(refreshState, refreshDecision.state.commandLog ?? []))
      .toEqual(refreshDecision.state)

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
        cost: { energy: {}, discardHand: 0 },
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

  it('selects a discard pile cookie for trash-to-support OnPlay', () => {
    const base = createDemoGame()
    const source = base.players['player-two'].battleArea[0]
    const discardCookie = {
      ...base.players['player-two'].hand.find((card) => card.type === 'cookie')!,
      instanceId: 'ai-discard-cookie',
    }
    const sourceWithSkill = {
      ...source,
      card: {
        ...source.card,
        skill: {
          trigger: 'on-play' as const,
          oncePerTurn: false,
          yourTurn: false,
          restSource: false,
          cost: { energy: {}, discardHand: 0 },
          text: 'Choose 1 Cookie from your trash and place it in your support area.',
          effects: [{ kind: 'trash-to-support' as const, amount: 1 }],
        },
      },
    }
    const state: GameState = {
      ...base,
      pendingOnPlay: {
        playerId: 'player-two',
        sourceInstanceId: source.card.instanceId,
      },
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [sourceWithSkill],
          discardPile: [discardCookie],
        },
      },
    }

    const decision = takeAiStep(state, 'player-two')

    expect(decision.action).toBe('activate-skill')
    expect(decision.error).toBeUndefined()
    expect(decision.effectSelections?.[0]?.targetIds).toEqual([
      'ai-discard-cookie',
    ])
    expect(
      decision.state.players['player-two'].supportArea.at(-1)?.card
        .instanceId,
    ).toBe('ai-discard-cookie')
    expect(decision.state.pendingOnPlay).toBeNull()
  })

  it('resumes AI after player replacement ST5-010 removes an AI Cookie', () => {
    const base = createDemoGame(7, { player: 'purple', ai: 'purple' })
    const purpleDeck = createOfficialPurpleStarterDeck('player-one')
    const carol = purpleDeck.find((card) => card.id === 'ST5-010')!
    const supportCard = purpleDeck.find(
      (card) => card.instanceId !== carol.instanceId,
    )!
    const aiTarget = base.players['player-two'].battleArea[0]
    let state: GameState = {
      ...base,
      activePlayerId: 'player-two',
      phase: 'main',
      pendingReplacement: {
        tasks: [{ playerId: 'player-one', remaining: 1 }],
      },
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [],
          hand: [carol],
          supportArea: [{ card: supportCard, rested: false }],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            { ...aiTarget, hpCards: aiTarget.hpCards.slice(0, 2) },
          ],
        },
      },
    }

    state = replaceDefeatedCookie(state, carol.instanceId)
    state = activateCookieSkill(
      state,
      'player-one',
      carol.instanceId,
      'on-play',
      [supportCard.instanceId],
    )
    state = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: carol.instanceId },
      carol.skill!.effects[0],
      [aiTarget.card.instanceId],
    )
    state = finalizePendingReplacements(state)

    expect(getActingPlayerId(state)).toBe('player-two')
    expect(state.pendingReplacement).toMatchObject({
      tasks: [{ playerId: 'player-two', remaining: 1 }],
    })

    const actions: string[] = []
    for (let step = 0; step < 8 && getActingPlayerId(state) === 'player-two'; step += 1) {
      const decision = takeAiStep(state, 'player-two')
      expect(decision.action, decision.description).not.toBe('error')
      expect(decision.state, decision.description).not.toBe(state)
      actions.push(decision.action)
      state = decision.state
    }

    expect(actions).toContain('replace-cookie')
    expect(state.pendingReplacement).toBeNull()
    expect(state.pendingOnPlay).toBeNull()
    expect(state.pendingBattle).toBeNull()
  })

  it('resolves an AI attack effect while the AI is the attacker', () => {
    const base = createDemoGame()
    const attacker = base.players['player-two'].battleArea[0]
    const target = base.players['player-one'].battleArea[0]
    const state: GameState = {
      ...base,
      activePlayerId: 'player-two',
      phase: 'main',
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: attacker.card.instanceId,
        targetInstanceId: target.card.instanceId,
        declaredDamage: 1,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
        attackEffectIndex: 0,
      },
    }

    expect(getActingPlayerId(state)).toBe('player-two')

    const decision = takeAiStep(state, 'player-two')

    expect(decision.action).toBe('resolve-attack-effect')
    expect(decision.state).not.toBe(state)
  })

  it('selects a required target for an AI attack damage effect', () => {
    const base = createDemoGame()
    const attacker = base.players['player-two'].battleArea[0]
    const target = base.players['player-one'].battleArea[0]
    const state: GameState = {
      ...base,
      activePlayerId: 'player-two',
      phase: 'main',
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: attacker.card.instanceId,
        targetInstanceId: target.card.instanceId,
        declaredDamage: 1,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 1, max: 1 },
          },
        ],
        attackEffectIndex: 0,
      },
    }

    const decision = takeAiStep(state, 'player-two')

    expect(decision.action).toBe('resolve-attack-effect')
    expect(decision.error).toBeUndefined()
    expect(decision.state).not.toBe(state)
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
      cost: { energy: { red: 1 }, discardHand: 0 },
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
})
