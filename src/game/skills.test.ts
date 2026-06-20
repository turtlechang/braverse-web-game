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
      canPayEnergyCost({ energy: { red: 2, neutral: 2 }, discardHand: 0 }, supports),
    ).toBe(true)
    expect(
      canPayEnergyCost({ energy: { green: 2, neutral: 2 }, discardHand: 0 }, supports),
    ).toBe(false)
  })

  it('allows Activate only from the battle area in the main phase', () => {
    let state = createDemoGame()
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: { red: 1 }, discardHand: 0 },
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
      cost: { energy: { red: 1 }, discardHand: 0 },
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
      cost: { energy: { red: 1 }, discardHand: 0 },
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
      cost: { energy: { red: 1 }, discardHand: 0 },
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
      cost: { energy: { red: 1 }, discardHand: 0 },
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
      cost: { energy: {}, discardHand: 0 },
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
      cost: { energy: {}, discardHand: 0 },
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

  it('moves a selected support card to trash as a special skill cost', () => {
    let state = createDemoGame()
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: false,
      restSource: false,
      cost: {
        energy: {},
        discardHand: 0,
        supportToTrash: 1,
      },
      text: 'Place 1 card from your support area into the trash.',
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
      [],
      ['blue-1'],
    )

    expect(
      state.players['player-one'].supportArea.map(
        (support) => support.card.instanceId,
      ),
    ).not.toContain('blue-1')
    expect(
      state.players['player-one'].discardPile.map(
        (card) => card.instanceId,
      ),
    ).toContain('blue-1')
  })

  it('does not allow one support card to pay energy and a trash cost', () => {
    let state = createDemoGame()
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: {
        energy: { red: 1 },
        discardHand: 0,
        supportToTrash: 1,
      },
      text: 'Pay energy and trash a support.',
      effects: [effect],
    }
    state = withSkill(state, 'player-one', skill)
    state = advancePhase(advancePhase(state))
    const sourceId =
      state.players['player-one'].battleArea[0].card.instanceId

    expect(() =>
      activateCookieSkill(
        state,
        'player-one',
        sourceId,
        'activate',
        ['red-1'],
        ['red-1'],
      ),
    ).toThrow('同一張支援卡不能同時支付兩種費用。')
  })

  it('requires separate support cards for energy and trash costs before activation', () => {
    let state = createDemoGame()
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: {
        energy: { red: 1 },
        discardHand: 0,
        supportToTrash: 1,
      },
      text: 'Pay energy and trash a support.',
      effects: [effect],
    }
    state = withSkill(state, 'player-one', skill)
    state = advancePhase(advancePhase(state))
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          supportArea: [state.players['player-one'].supportArea[0]],
        },
      },
    }
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
  })
})

describe('activate skill with discardHand cost', () => {
  const discardHandSkill = (
    discardHand: number,
    effects: CardSkill['effects'] = [],
  ): CardSkill => ({
    trigger: 'activate',
    oncePerTurn: false,
    yourTurn: false,
    restSource: false,
    cost: { energy: {}, discardHand },
    text: 'test',
    effects,
  })

  const withDiscardHandSkill = (
    state: GameState,
    discardHand: number,
    effects: CardSkill['effects'] = [],
  ): GameState =>
    withSkill(
      advancePhase(advancePhase(state)),
      'player-one',
      discardHandSkill(discardHand, effects),
    )

  it('rejects when hand has fewer cards than discardHand cost', () => {
    const state = withDiscardHandSkill(createDemoGame(), 1)
    const stateWithEmptyHand: GameState = {
      ...state,
      players: {
        ...state.players,
        'player-one': { ...state.players['player-one'], hand: [] },
      },
    }
    const sourceId =
      stateWithEmptyHand.players['player-one'].battleArea[0].card.instanceId
    expect(
      canActivateCookieSkill(
        stateWithEmptyHand,
        'player-one',
        sourceId,
        'activate',
      ),
    ).toBe(false)
  })

  it('allows when hand has enough cards for discardHand cost', () => {
    const state = withDiscardHandSkill(createDemoGame(), 1)
    const player = state.players['player-one']
    expect(player.hand.length).toBeGreaterThanOrEqual(1)
    const sourceId = player.battleArea[0].card.instanceId
    expect(
      canActivateCookieSkill(state, 'player-one', sourceId, 'activate'),
    ).toBe(true)
  })

  it('discards specified hand cards when paying discardHand cost', () => {
    const baseState = withDiscardHandSkill(createDemoGame(), 1, [
      { kind: 'draw', amount: 1 },
    ])
    const handCardToDiscard =
      baseState.players['player-one'].hand[0]
    const sourceId =
      baseState.players['player-one'].battleArea[0].card.instanceId
    const result = activateCookieSkill(
      baseState,
      'player-one',
      sourceId,
      'activate',
      [],
      [],
      [handCardToDiscard.instanceId],
    )
    expect(
      result.players['player-one'].hand.map((c) => c.instanceId),
    ).not.toContain(handCardToDiscard.instanceId)
    expect(
      result.players['player-one'].discardPile.map((c) => c.instanceId),
    ).toContain(handCardToDiscard.instanceId)
  })

  it('rejects wrong discardHand count', () => {
    const baseState = withDiscardHandSkill(createDemoGame(), 2, [
      { kind: 'draw', amount: 1 },
    ])
    const player = baseState.players['player-one']
    const sourceId = player.battleArea[0].card.instanceId
    expect(() =>
      activateCookieSkill(
        baseState,
        'player-one',
        sourceId,
        'activate',
        [],
        [],
        [player.hand[0].instanceId],
      ),
    ).toThrow('必須棄置 2 張手牌作為技能代價')
  })

  it('rejects discardHandIds not in hand', () => {
    const baseState = withDiscardHandSkill(createDemoGame(), 1, [
      { kind: 'draw', amount: 1 },
    ])
    const sourceId =
      baseState.players['player-one'].battleArea[0].card.instanceId
    expect(() =>
      activateCookieSkill(
        baseState,
        'player-one',
        sourceId,
        'activate',
        [],
        [],
        ['non-existent-id'],
      ),
    ).toThrow('只能選擇自己的手牌作為代價')
  })

  it('rejects discardHandIds when cost does not require discardHand', () => {
    const baseState = withDiscardHandSkill(createDemoGame(), 0, [
      { kind: 'draw', amount: 1 },
    ])
    const player = baseState.players['player-one']
    const sourceId = player.battleArea[0].card.instanceId
    expect(() =>
      activateCookieSkill(
        baseState,
        'player-one',
        sourceId,
        'activate',
        [],
        [],
        [player.hand[0].instanceId],
      ),
    ).toThrow('此技能不需要棄手牌代價')
  })

  it('rejects duplicate discardHandIds', () => {
    const baseState = withDiscardHandSkill(createDemoGame(), 2, [
      { kind: 'draw', amount: 1 },
    ])
    const player = baseState.players['player-one']
    const sourceId = player.battleArea[0].card.instanceId
    const handCardId = player.hand[0].instanceId
    expect(() =>
      activateCookieSkill(
        baseState,
        'player-one',
        sourceId,
        'activate',
        [],
        [],
        [handCardId, handCardId],
      ),
    ).toThrow('不能重複選擇同一張手牌作為代價。')
  })
})
