import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  selectAiEnergyPayment,
  simulateAiMatch,
  takeAiStep,
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
    expect(
      decision.state.players['player-one'].battleArea[0].hpCards.length,
    ).toBeLessThan(
      state.players['player-one'].battleArea[0].hpCards.length,
    )
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
      pendingReplacementPlayerId: 'player-two',
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
