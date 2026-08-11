import { describe, expect, it } from 'vitest'
import {
  activateCookieSkill,
  advancePhase,
  canActivateCookieSkill,
  canPayEnergyCost,
  createDemoGame,
  getEffectiveAttack,
  getHpToTrashCostCandidates,
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
  it('requires a matching support Cookie for support-to-hand effects', () => {
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: {}, discardHand: 0 },
      text: 'Return 1 Cookie from your support area to your hand.',
      effects: [{ kind: 'support-to-hand', amount: 1, cardType: 'cookie' }],
    }
    let state: GameState = {
      ...withSkill(createDemoGame(), 'player-one', skill),
      phase: 'main',
      activePlayerId: 'player-one',
    }
    const sourceId = state.players['player-one'].battleArea[0].card.instanceId

    expect(
      canActivateCookieSkill(state, 'player-one', sourceId, 'activate'),
    ).toBe(false)

    const supportCookie: GameCard = {
      id: 'support-cookie',
      instanceId: 'support-cookie',
      name: 'Support Cookie',
      type: 'cookie',
      energyColor: 'green',
      level: 1,
      hp: 2,
      attack: 1,
      attackCost: 0,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          supportArea: [{ card: supportCookie, rested: false }],
        },
      },
    }

    expect(
      canActivateCookieSkill(state, 'player-one', sourceId, 'activate'),
    ).toBe(true)
  })

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
    ).toThrow('同一張卡不能同時支付兩種費用。')
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

  it('canActivateCookieSkill returns false when no valid targets exist for min:1 effect', () => {
    let state = createDemoGame()
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: {}, discardHand: 0 },
      text: 'test',
      effects: [
        {
          kind: 'return-to-hand',
          target: { side: 'opponent', min: 1, max: 1, maxLevel: 2 },
        },
      ],
      faint: false,
      endPhase: false,
      afterDamage: false,
    }
    state = withSkill(state, 'player-one', skill)
    state.players['player-two'].battleArea = []
    state = advancePhase(state)
    state = advancePhase(state)
    const sourceId = state.players['player-one'].battleArea[0].card.instanceId
    expect(
      canActivateCookieSkill(state, 'player-one', sourceId, 'activate'),
    ).toBe(false)
  })

  it('canActivateCookieSkill returns true when valid targets exist for min:1 effect', () => {
    let state = createDemoGame()
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: {}, discardHand: 0 },
      text: 'test',
      effects: [
        {
          kind: 'return-to-hand',
          target: { side: 'opponent', min: 1, max: 1, maxLevel: 2 },
        },
      ],
      faint: false,
      endPhase: false,
      afterDamage: false,
    }
    state = withSkill(state, 'player-one', skill)
    state.players['player-two'].battleArea = [
      {
        card: {
          id: 'opp-1',
          instanceId: 'opp-1',
          name: 'opp',
          type: 'cookie',
          level: 1,
          hp: 3,
          attack: 1,
          attackCost: 1,
          energyColor: 'red',
        },
        hpCards: [],
        rested: false,
      },
    ]
    state = advancePhase(state)
    state = advancePhase(state)
    const sourceId = state.players['player-one'].battleArea[0].card.instanceId
    expect(
      canActivateCookieSkill(state, 'player-one', sourceId, 'activate'),
    ).toBe(true)
  })

  it('canActivateCookieSkill respects hand-count-at-most conditions', () => {
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: {}, discardHand: 0 },
      text:
        'If there are 6 cards or less in your hand, you can draw 1 card from your deck.',
      effects: [
        {
          kind: 'draw',
          amount: 1,
          condition: { kind: 'hand-count-at-most', count: 6 },
        },
      ],
      faint: false,
      endPhase: false,
      afterDamage: false,
    }
    let state = withSkill(createDemoGame(), 'player-one', skill)
    state = advancePhase(state)
    state = advancePhase(state)
    const sourceId = state.players['player-one'].battleArea[0].card.instanceId
    const sevenCardHand = Array.from({ length: 7 }, (_, index) => ({
      id: `hand-${index}`,
      instanceId: `hand-${index}`,
      name: `hand-${index}`,
      type: 'item' as const,
      energyColor: 'red' as const,
    }))

    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          hand: sevenCardHand,
        },
      },
    }

    expect(
      canActivateCookieSkill(state, 'player-one', sourceId, 'activate'),
    ).toBe(false)

    const sixCardState = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          hand: sevenCardHand.slice(0, 6),
        },
      },
    }

    expect(
      canActivateCookieSkill(sixCardState, 'player-one', sourceId, 'activate'),
    ).toBe(true)
  })

  it("only allows this Cookie's HP to pay a source-only HP cost", () => {
    let state = createDemoGame()
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: {}, discardHand: 0, hpToTrash: { amount: 1, sourceOnly: true } },
      text: "Place 1 card from the top of this Cookie's HP into the trash.",
      effects: [{ kind: 'damage-all', amount: 1, side: 'opponent' }],
    }
    state = withSkill(state, 'player-one', skill)
    state = advancePhase(advancePhase(state))
    const source = state.players['player-one'].battleArea[0]
    const other = {
      ...source,
      card: { ...source.card, id: 'other-cookie', instanceId: 'other-cookie' },
      hpCards: [
        { id: 'other-hp', instanceId: 'other-hp', name: 'other-hp', type: 'item' as const },
      ],
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [
            { ...source, hpCards: [{ id: 'source-hp', instanceId: 'source-hp', name: 'source-hp', type: 'item' as const }] },
            other,
          ],
        },
      },
    }

    expect(
      getHpToTrashCostCandidates(
        skill.cost,
        state.players['player-one'].battleArea,
        source.card.instanceId,
      ).map((cookie) => cookie.card.instanceId),
    ).toEqual([source.card.instanceId])

    expect(() =>
      activateCookieSkill(
        state,
        'player-one',
        source.card.instanceId,
        'activate',
        [],
        [],
        [],
        [],
        [],
        [],
        undefined,
        [other.card.instanceId],
      ),
    ).toThrow('選擇的 HP 費用餅乾不合法。')

    const paid = activateCookieSkill(
      state,
      'player-one',
      source.card.instanceId,
      'activate',
      [],
      [],
      [],
      [],
      [],
      [],
      undefined,
      [source.card.instanceId],
    )
    expect(paid.players['player-one'].battleArea).toHaveLength(1)
    expect(paid.players['player-one'].battleArea[0].card.instanceId).toBe(
      other.card.instanceId,
    )
    expect(paid.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
  })

  it('filters HP and discard-hand costs by the card restrictions stated on the card', () => {
    const base = createDemoGame()
    const source = base.players['player-one'].battleArea[0]
    const redLevelOne = {
      ...source,
      card: {
        ...source.card,
        id: 'red-level-one',
        instanceId: 'red-level-one',
        energyColor: 'red' as const,
        level: 1,
      },
    }
    const redLevelTwo = {
      ...source,
      card: {
        ...source.card,
        id: 'red-level-two',
        instanceId: 'red-level-two',
        energyColor: 'red' as const,
        level: 2,
      },
    }
    const blueLevelThree = {
      ...source,
      card: {
        ...source.card,
        id: 'blue-level-three',
        instanceId: 'blue-level-three',
        energyColor: 'blue' as const,
        level: 3,
      },
    }
    const hpCost: CardSkill['cost'] = {
      energy: {},
      discardHand: 0,
      hpToTrash: {
        amount: 1,
        energyColor: 'red',
        minLevel: 2,
        excludeSource: true,
      },
    }

    expect(
      getHpToTrashCostCandidates(hpCost, [
        source,
        redLevelOne,
        redLevelTwo,
        blueLevelThree,
      ], source.card.instanceId).map((cookie) => cookie.card.instanceId),
    ).toEqual(['red-level-two'])

    const discardSkill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: {
        energy: {},
        discardHand: 1,
        discardHandColor: 'red',
        discardHandType: 'trap',
      },
      text: 'Discard 1 red Trap card.',
      effects: [effect],
    }
    let state = withSkill(base, 'player-one', discardSkill)
    state = advancePhase(advancePhase(state))
    const sourceId = state.players['player-one'].battleArea[0].card.instanceId
    const redItem: GameCard = {
      id: 'red-item',
      instanceId: 'red-item',
      name: 'red-item',
      type: 'item',
      energyColor: 'red',
    }
    const redTrap: GameCard = {
      id: 'red-trap',
      instanceId: 'red-trap',
      name: 'red-trap',
      type: 'trap',
      energyColor: 'red',
    }

    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': { ...state.players['player-one'], hand: [redItem] },
      },
    }
    expect(canActivateCookieSkill(state, 'player-one', sourceId, 'activate')).toBe(false)

    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': { ...state.players['player-one'], hand: [redTrap] },
      },
    }
    expect(canActivateCookieSkill(state, 'player-one', sourceId, 'activate')).toBe(true)
  })

  it('supports at-least and entire-hand discard costs for cookie skills', () => {
    const makeHand = (prefix: string, count: number): GameCard[] =>
      Array.from({ length: count }, (_, index) => ({
        id: `${prefix}-${index}`,
        instanceId: `${prefix}-${index}`,
        name: `${prefix}-${index}`,
        type: 'item' as const,
      }))

    const atLeastSkill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: {
        energy: {},
        discardHand: 3,
        discardHandAtLeast: true,
      },
      text: 'Discard 3 or more cards.',
      effects: [{ kind: 'draw', amount: 1 }],
    }
    let atLeastState = advancePhase(advancePhase(
      withSkill(createDemoGame(), 'player-one', atLeastSkill),
    ))
    atLeastState = {
      ...atLeastState,
      players: {
        ...atLeastState.players,
        'player-one': {
          ...atLeastState.players['player-one'],
          hand: makeHand('at-least', 4),
        },
      },
    }
    const atLeastSource = atLeastState.players['player-one'].battleArea[0]
      .card.instanceId
    expect(
      canActivateCookieSkill(atLeastState, 'player-one', atLeastSource, 'activate'),
    ).toBe(true)
    const atLeastResult = activateCookieSkill(
      atLeastState,
      'player-one',
      atLeastSource,
      'activate',
      [],
      [],
      atLeastState.players['player-one'].hand.slice(0, 3).map((card) => card.instanceId),
    )
    expect(atLeastResult.players['player-one'].hand).toHaveLength(1)
    expect(atLeastResult.players['player-one'].discardPile).toHaveLength(3)

    const allHandSkill: CardSkill = {
      ...atLeastSkill,
      cost: { energy: {}, discardHand: 0, discardAllHand: true },
      text: 'Discard your entire hand.',
    }
    let allHandState = advancePhase(advancePhase(
      withSkill(createDemoGame(), 'player-one', allHandSkill),
    ))
    allHandState = {
      ...allHandState,
      players: {
        ...allHandState.players,
        'player-one': {
          ...allHandState.players['player-one'],
          hand: makeHand('all', 2),
        },
      },
    }
    const allHandSource = allHandState.players['player-one'].battleArea[0]
      .card.instanceId
    expect(
      canActivateCookieSkill(allHandState, 'player-one', allHandSource, 'activate'),
    ).toBe(true)
    const allHandResult = activateCookieSkill(
      allHandState,
      'player-one',
      allHandSource,
      'activate',
      [],
      [],
      allHandState.players['player-one'].hand.map((card) => card.instanceId),
    )
    expect(allHandResult.players['player-one'].hand).toHaveLength(0)
    expect(allHandResult.players['player-one'].discardPile).toHaveLength(2)
  })
})
