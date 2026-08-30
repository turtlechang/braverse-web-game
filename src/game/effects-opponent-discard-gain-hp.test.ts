import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  executeCardEffect,
  isEffectUntargeted,
  refreshDeck,
  resolveOpponentHandDiscard,
  type CardEffect,
  type GameState,
} from '.'

describe('opponent-discard-hand effect', () => {
  const odhContext = {
    sourcePlayerId: 'player-one' as const,
    sourceInstanceId: 'player-one-starter-1',
  }

  it('sets pendingOpponentHandDiscard when opponent has hand cards', () => {
    const state = createDemoGame()
    const effect: CardEffect = { kind: 'opponent-discard-hand', count: 1 }
    const result = executeCardEffect(state, odhContext, effect, [])
    expect(result.pendingOpponentHandDiscard).toBeTruthy()
    expect(result.pendingOpponentHandDiscard!.playerId).toBe('player-two')
    expect(result.pendingOpponentHandDiscard!.count).toBe(1)
    expect(result.pendingOpponentHandDiscard!.sourcePlayerId).toBe('player-one')
  })

  it('auto-completes when opponent has no hand cards', () => {
    const state = createDemoGame()
    const emptyState: GameState = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          hand: [],
        },
      },
    }
    const effect: CardEffect = { kind: 'opponent-discard-hand', count: 1 }
    const result = executeCardEffect(emptyState, odhContext, effect, [])
    expect(result.pendingOpponentHandDiscard).toBeFalsy()
  })

  it('isEffectUntargeted returns true for opponent-discard-hand', () => {
    expect(
      isEffectUntargeted({ kind: 'opponent-discard-hand', count: 1 }),
    ).toBe(true)
  })

  it('treats an any-number discard followed by equal draw as untargeted', () => {
    expect(
      isEffectUntargeted({
        kind: 'discard-hand-then-draw-same',
        energyColor: 'blue',
      }),
    ).toBe(true)
  })
})

describe('resolveOpponentHandDiscard', () => {
  const createState = (overrides: Partial<GameState> = {}): GameState => {
    const base = createDemoGame()
    return {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          hand: base.players['player-two'].hand.slice(0, 3),
        },
      },
      pendingOpponentHandDiscard: {
        playerId: 'player-two' as const,
        count: 1,
        sourcePlayerId: 'player-one' as const,
        sourceInstanceId: 'player-one-starter-1',
        sourceCardName: 'Roguefort Cookie',
        effectText: 'opponent-discard-hand',
      },
      ...overrides,
    }
  }

  it('resolves with exactly 1 chosen card', () => {
    const state = createState()
    const targetCard = state.players['player-two'].hand[0]
    const result = resolveOpponentHandDiscard(state, 'player-two', [
      targetCard.instanceId,
    ])
    expect(result.pendingOpponentHandDiscard).toBeNull()
    expect(
      result.players['player-two'].hand.some(
        (c) => c.instanceId === targetCard.instanceId,
      ),
    ).toBe(false)
    expect(
      result.players['player-two'].discardPile.some(
        (c) => c.instanceId === targetCard.instanceId,
      ),
    ).toBe(true)
  })

  it('rejects wrong player', () => {
    const state = createState()
    expect(() =>
      resolveOpponentHandDiscard(state, 'player-one', [
        state.players['player-two'].hand[0].instanceId,
      ]),
    ).toThrow('不是目前需要棄牌的玩家')
  })

  it('rejects card not in hand', () => {
    const state = createState()
    expect(() =>
      resolveOpponentHandDiscard(state, 'player-two', ['nonexistent-id']),
    ).toThrow('不在你的手牌中')
  })

  it('rejects 0 cards when count is 1', () => {
    const state = createState()
    expect(() =>
      resolveOpponentHandDiscard(state, 'player-two', []),
    ).toThrow('必須選擇 1 張手牌棄置')
  })

  it('rejects 2 cards when count is 1', () => {
    const state = createState()
    const hand = state.players['player-two'].hand
    if (hand.length < 2) return
    expect(() =>
      resolveOpponentHandDiscard(state, 'player-two', [
        hand[0].instanceId,
        hand[1].instanceId,
      ]),
    ).toThrow('必須選擇 1 張手牌棄置')
  })

  it('rejects duplicate cards', () => {
    const state = createState()
    const id = state.players['player-two'].hand[0].instanceId
    expect(() =>
      resolveOpponentHandDiscard(state, 'player-two', [id, id]),
    ).toThrow('不能重複選擇')
  })

  it('throws when there is no pending discard decision', () => {
    const state = createState()
    const resolved = resolveOpponentHandDiscard(
      state,
      'player-two',
      [state.players['player-two'].hand[0].instanceId],
    )
    expect(resolved.pendingOpponentHandDiscard).toBeNull()
    expect(() =>
      resolveOpponentHandDiscard(resolved, 'player-two', [
        resolved.players['player-two'].hand[0]?.instanceId ?? 'any',
      ]),
    ).toThrow('目前沒有等待對手棄牌的決策')
  })
})

describe('gain-hp effect', () => {
  it('adds HP to an explicitly selected other cookie', () => {
    const base = createDemoGame()
    const otherCard = base.players['player-one'].hand.find(
      (card) => card.type === 'cookie',
    )!
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            ...base.players['player-one'].battleArea,
            {
              card: otherCard,
              hpCards: [],
              rested: false,
              battleEntryId: `${otherCard.instanceId}:test`,
            },
          ],
        },
      },
    }
    const sourceCookie = state.players['player-one'].battleArea[0]
    const otherCookie = state.players['player-one'].battleArea[1]
    const effect: CardEffect = {
      kind: 'gain-hp',
      amount: 1,
      target: { side: 'self', min: 1, max: 1, excludeSource: true },
    }

    const newState = executeCardEffect(
      state,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: sourceCookie.card.instanceId,
      },
      effect,
      [otherCookie.card.instanceId],
    )

    expect(newState.players['player-one'].battleArea[1].hpCards).toHaveLength(
      otherCookie.hpCards.length + 1,
    )
  })

  it('adds HP cards from deck top to source cookie in battle', () => {
    const state = createDemoGame()
    const sourceCookie = state.players['player-one'].battleArea[0]
    const effect: CardEffect = {
      kind: 'gain-hp',
      amount: 1,
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    }
    const newState = executeCardEffect(
      state,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: sourceCookie.card.instanceId,
      },
      effect,
      [],
    )
    expect(newState.players['player-one'].battleArea[0].hpCards).toHaveLength(
      sourceCookie.hpCards.length + 1,
    )
    expect(newState.players['player-one'].deck).toHaveLength(
      state.players['player-one'].deck.length - 1,
    )
  })

  it('adds HP to an explicitly selected opponent Cookie', () => {
    const state = createDemoGame()
    const opponentCookie = state.players['player-two'].battleArea[0]
    const effect: CardEffect = {
      kind: 'gain-hp',
      amount: 1,
      target: { side: 'opponent', min: 1, max: 1 },
    }

    const newState = executeCardEffect(
      state,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
      },
      effect,
      [opponentCookie.card.instanceId],
    )

    expect(newState.players['player-two'].battleArea[0].hpCards).toHaveLength(
      opponentCookie.hpCards.length + 1,
    )
    expect(newState.players['player-one'].battleArea[0].hpCards).toHaveLength(
      state.players['player-one'].battleArea[0].hpCards.length,
    )
  })

  it('opens Refresh and continues the HP gain after the deck is rebuilt', () => {
    const state = createDemoGame()
    const refreshCookie = state.players['player-one'].hand.find(
      (card) => card.type === 'cookie' && card.level >= 1,
    )!
    const refreshCards = state.players['player-one'].deck.slice(0, 3)
    const emptyState: GameState = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          hand: state.players['player-one'].hand.filter(
            (card) => card.instanceId !== refreshCookie.instanceId,
          ),
          deck: [],
          discardPile: [refreshCookie, ...refreshCards],
        },
      },
    }
    const effect: CardEffect = {
      kind: 'gain-hp',
      amount: 1,
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    }
    const pending = executeCardEffect(
      emptyState,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: emptyState.players['player-one'].battleArea[0].card.instanceId,
      },
      effect,
      [],
    )
    expect(pending.pendingRefresh).toEqual({
      playerId: 'player-one',
      remainingDraws: 0,
      remainingHpGain: {
        targetInstanceId: emptyState.players['player-one'].battleArea[0].card.instanceId,
        amount: 1,
      },
    })

    const refreshed = refreshDeck(
      pending,
      'player-one',
      refreshCookie.instanceId,
      (cards) => [...cards],
    )
    expect(refreshed.pendingRefresh).toBeNull()
    expect(refreshed.players['player-one'].battleArea[0].hpCards).toHaveLength(
      emptyState.players['player-one'].battleArea[0].hpCards.length + 1,
    )
  })

  it('uses available cards, Refreshes, then finishes the remaining HP gain', () => {
    const state = createDemoGame()
    const player = state.players['player-one']
    const refreshCookie = player.hand.find(
      (card) => card.type === 'cookie' && card.level >= 1,
    )!
    const [lastDeckCard, ...refreshCards] = player.deck.slice(0, 4)
    const partialState: GameState = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          hand: player.hand.filter(
            (card) => card.instanceId !== refreshCookie.instanceId,
          ),
          deck: [lastDeckCard],
          discardPile: [refreshCookie, ...refreshCards],
        },
      },
    }
    const source = partialState.players['player-one'].battleArea[0]
    const pending = executeCardEffect(
      partialState,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: source.card.instanceId,
      },
      {
        kind: 'gain-hp',
        amount: 2,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
      [],
    )
    expect(pending.players['player-one'].battleArea[0].hpCards).toHaveLength(
      source.hpCards.length + 1,
    )
    expect(pending.pendingRefresh?.remainingHpGain?.amount).toBe(1)

    const refreshed = refreshDeck(
      pending,
      'player-one',
      refreshCookie.instanceId,
      (cards) => [...cards],
    )
    expect(refreshed.pendingRefresh).toBeNull()
    expect(refreshed.players['player-one'].battleArea[0].hpCards).toHaveLength(
      source.hpCards.length + 2,
    )
  })

  it('opens Refresh when the final deck card exactly completes the HP gain', () => {
    const state = createDemoGame()
    const player = state.players['player-one']
    const refreshCookie = player.hand.find(
      (card) => card.type === 'cookie' && card.level >= 1,
    )!
    const [lastDeckCard, ...refreshCards] = player.deck.slice(0, 4)
    const exactState: GameState = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          hand: player.hand.filter(
            (card) => card.instanceId !== refreshCookie.instanceId,
          ),
          deck: [lastDeckCard],
          discardPile: [refreshCookie, ...refreshCards],
        },
      },
    }
    const source = exactState.players['player-one'].battleArea[0]
    const pending = executeCardEffect(
      exactState,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: source.card.instanceId,
      },
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
      [],
    )
    expect(pending.pendingRefresh).toEqual({
      playerId: 'player-one',
      remainingDraws: 0,
    })

    const refreshed = refreshDeck(
      pending,
      'player-one',
      refreshCookie.instanceId,
      (cards) => [...cards],
    )
    expect(refreshed.pendingRefresh).toBeNull()
    expect(refreshed.players['player-one'].battleArea[0].hpCards).toHaveLength(
      source.hpCards.length + 1,
    )
  })

  it('ends the game when the final HP card leaves no Refresh candidate', () => {
    const state = createDemoGame()
    const player = state.players['player-one']
    const [lastDeckCard] = player.deck
    const source = player.battleArea[0]
    const exactState: GameState = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          deck: [lastDeckCard],
          discardPile: [],
        },
      },
    }

    const result = executeCardEffect(
      exactState,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: source.card.instanceId,
      },
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
      [],
    )

    expect(result.status).toBe('finished')
    expect(result.result).toMatchObject({
      loserId: 'player-one',
      reason: 'refresh-unavailable',
    })
  })

  it('does not restore unrelated damaged HP after a draw Refresh', () => {
    const state = createDemoGame()
    const player = state.players['player-one']
    const refreshCookie = player.hand.find(
      (card) => card.type === 'cookie' && card.level >= 1,
    )!
    const [recycledA, recycledB] = player.deck.slice(0, 2)
    const wounded = player.battleArea[0]
    const refreshState: GameState = {
      ...state,
      pendingRefresh: { playerId: 'player-one', remainingDraws: 1 },
      players: {
        ...state.players,
        'player-one': {
          ...player,
          hand: player.hand.filter(
            (card) => card.instanceId !== refreshCookie.instanceId,
          ),
          deck: [],
          discardPile: [refreshCookie, recycledA, recycledB],
          battleArea: [{ ...wounded, hpCards: wounded.hpCards.slice(0, -1) }],
        },
      },
    }

    const result = refreshDeck(
      refreshState,
      'player-one',
      refreshCookie.instanceId,
      (cards) => [...cards],
    )

    expect(result.pendingRefresh).toBeNull()
    expect(result.players['player-one'].battleArea[0].hpCards).toHaveLength(
      wounded.hpCards.length - 1,
    )
  })
})
