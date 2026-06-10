import { describe, expect, it } from 'vitest'
import {
  activateCookieSkill,
  advancePhase,
  canActivateCookieSkill,
  canPayEnergyCost,
  createDemoGame,
  getEffectiveAttack,
  skipCookieOnPlay,
  type CardSkill,
  type GameCard,
  type GameState,
  type PlayerId,
} from '.'

const effect = {
  kind: 'damage' as const,
  amount: 1,
  target: { side: 'opponent' as const, min: 0, max: 1 },
}

const createSupport = (
  instanceId: string,
  energyColor: GameCard['energyColor'],
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

const withSkill = (
  state: GameState,
  playerId: PlayerId,
  skill: CardSkill,
): GameState => {
  const player = state.players[playerId]
  const source = player.battleArea[0]

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        battleArea: [
          {
            ...source,
            card: { ...source.card, skill },
          },
        ],
        supportArea: [
          createSupport('red-1', 'red'),
          createSupport('red-2', 'red'),
          createSupport('blue-1', 'blue'),
          createSupport('wild-1', 'wild'),
        ],
      },
    },
  }
}

describe('cookie skill activation', () => {
  it('pays colored costs first and neutral costs with any energy', () => {
    const supports = [
      createSupport('red-1', 'red'),
      createSupport('red-2', 'red'),
      createSupport('blue-1', 'blue'),
      createSupport('wild-1', 'wild'),
    ]

    expect(
      canPayEnergyCost({ red: 2, neutral: 2 }, supports),
    ).toBe(true)
    expect(
      canPayEnergyCost({ green: 2, neutral: 2 }, supports),
    ).toBe(false)
  })

  it('allows Activate only from the battle area in the main phase', () => {
    let state = createDemoGame()
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { red: 1 },
      text: 'Activate skill',
      effects: [effect],
    }
    state = withSkill(state, 'player-one', skill)
    const sourceId =
      state.players['player-one'].battleArea[0].card.instanceId

    expect(
      canActivateCookieSkill(
        state,
        'player-one',
        sourceId,
        'activate',
      ),
    ).toBe(false)

    state = advancePhase(state)
    state = advancePhase(state)

    expect(state.phase).toBe('main')
    expect(
      canActivateCookieSkill(
        state,
        'player-one',
        sourceId,
        'activate',
      ),
    ).toBe(true)
  })

  it('enforces Once per turn and resets usage next turn', () => {
    let state = createDemoGame()
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: false,
      restSource: false,
      cost: { red: 1 },
      text: 'Once per turn skill',
      effects: [effect],
    }
    state = withSkill(state, 'player-one', skill)
    state = advancePhase(advancePhase(state))
    const sourceId =
      state.players['player-one'].battleArea[0].card.instanceId

    state = activateCookieSkill(
      state,
      'player-one',
      sourceId,
      'activate',
      ['red-1'],
    )

    expect(
      canActivateCookieSkill(
        state,
        'player-one',
        sourceId,
        'activate',
      ),
    ).toBe(false)

    state = advancePhase(state)
    state = advancePhase(state)

    expect(state.skillUsesThisTurn).toEqual([])
  })

  it('resets Once per turn when the same card leaves and re-enters', () => {
    let state = createDemoGame()
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: false,
      restSource: false,
      cost: { red: 1 },
      text: 'Once per turn skill',
      effects: [effect],
    }
    state = withSkill(state, 'player-one', skill)
    state = advancePhase(advancePhase(state))
    const firstEntry =
      state.players['player-one'].battleArea[0]
    const sourceId = firstEntry.card.instanceId

    state = activateCookieSkill(
      state,
      'player-one',
      sourceId,
      'activate',
      ['red-1'],
    )

    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [
            {
              ...firstEntry,
              battleEntryId: `${sourceId}:battle:re-entered`,
            },
          ],
          supportArea: state.players['player-one'].supportArea.map(
            (support) => ({ ...support, rested: false }),
          ),
        },
      },
    }

    expect(
      canActivateCookieSkill(
        state,
        'player-one',
        sourceId,
        'activate',
      ),
    ).toBe(true)
  })

  it('deactivates Your Turn skills immediately on the opponent turn', () => {
    let state = createDemoGame()
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: true,
      restSource: false,
      cost: { red: 1 },
      text: 'Your Turn skill',
      effects: [effect],
    }
    state = withSkill(state, 'player-one', skill)
    state = advancePhase(advancePhase(state))
    const sourceId =
      state.players['player-one'].battleArea[0].card.instanceId

    expect(
      canActivateCookieSkill(
        state,
        'player-one',
        sourceId,
        'activate',
      ),
    ).toBe(true)

    state = {
      ...state,
      activePlayerId: 'player-two',
    }

    expect(
      canActivateCookieSkill(
        state,
        'player-one',
        sourceId,
        'activate',
      ),
    ).toBe(false)
  })

  it('allows OnPlay on either turn unless marked Your Turn', () => {
    const baseSkill: CardSkill = {
      trigger: 'on-play',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { red: 1 },
      text: 'OnPlay skill',
      effects: [effect],
    }
    let state = withSkill(createDemoGame(), 'player-two', baseSkill)
    const sourceId =
      state.players['player-two'].battleArea[0].card.instanceId
    state = {
      ...state,
      activePlayerId: 'player-one',
      pendingOnPlay: {
        playerId: 'player-two',
        sourceInstanceId: sourceId,
      },
    }

    expect(
      canActivateCookieSkill(
        state,
        'player-two',
        sourceId,
        'on-play',
      ),
    ).toBe(true)

    state = withSkill(state, 'player-two', {
      ...baseSkill,
      yourTurn: true,
    })

    expect(
      canActivateCookieSkill(
        state,
        'player-two',
        sourceId,
        'on-play',
      ),
    ).toBe(false)
  })

  it('only allows OnPlay during its matching entry window', () => {
    const skill: CardSkill = {
      trigger: 'on-play',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: {},
      text: 'OnPlay skill',
      effects: [effect],
    }
    let state = withSkill(createDemoGame(), 'player-one', skill)
    const sourceId =
      state.players['player-one'].battleArea[0].card.instanceId

    expect(
      canActivateCookieSkill(state, 'player-one', sourceId, 'on-play'),
    ).toBe(false)

    state = {
      ...state,
      pendingOnPlay: {
        playerId: 'player-one',
        sourceInstanceId: sourceId,
      },
    }
    state = activateCookieSkill(
      state,
      'player-one',
      sourceId,
      'on-play',
      [],
    )

    expect(state.pendingOnPlay).toBeNull()
    expect(
      canActivateCookieSkill(state, 'player-one', sourceId, 'on-play'),
    ).toBe(false)
  })

  it('consumes an OnPlay window when its owner skips it', () => {
    const state = createDemoGame()
    const sourceId =
      state.players['player-one'].battleArea[0].card.instanceId
    const pendingState = {
      ...state,
      pendingOnPlay: {
        playerId: 'player-one' as const,
        sourceInstanceId: sourceId,
      },
    }

    expect(
      skipCookieOnPlay(pendingState, 'player-one', sourceId)
        .pendingOnPlay,
    ).toBeNull()
    expect(() =>
      skipCookieOnPlay(state, 'player-one', sourceId),
    ).toThrow('目前沒有可略過的登場效果。')
  })

  it('applies a Your Turn passive only while its owner is active', () => {
    let state = createDemoGame()
    const skill: CardSkill = {
      trigger: 'passive',
      oncePerTurn: false,
      yourTurn: true,
      restSource: false,
      cost: {},
      text: 'This Cookie gains +1 attack damage.',
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
    state = withSkill(state, 'player-one', skill)
    const source =
      state.players['player-one'].battleArea[0].card

    expect(getEffectiveAttack(state, source.instanceId)).toBe(
      source.attack + 1,
    )

    state = {
      ...state,
      activePlayerId: 'player-two',
    }

    expect(getEffectiveAttack(state, source.instanceId)).toBe(
      source.attack,
    )
  })
})
