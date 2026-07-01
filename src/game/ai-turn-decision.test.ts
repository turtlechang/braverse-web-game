import { describe, expect, it } from 'vitest'
import {
  activateCookieSkill,
  createDemoGame,
  createOfficialPurpleStarterDeck,
  executeCardEffect,
  finalizePendingReplacements,
  getActingPlayerId,
  replaceDefeatedCookie,
  selectAiEnergyPayment,
  simulateAiMatch,
  takeAiStep,
  type CardSkill,
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
