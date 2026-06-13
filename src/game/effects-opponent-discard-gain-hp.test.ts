import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  executeCardEffect,
  isEffectUntargeted,
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

  it('throws when deck is empty', () => {
    const state = createDemoGame()
    const emptyState: GameState = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          deck: [],
        },
      },
    }
    const effect: CardEffect = {
      kind: 'gain-hp',
      amount: 1,
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    }
    expect(() =>
      executeCardEffect(
        emptyState,
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: emptyState.players['player-one'].battleArea[0].card.instanceId,
        },
        effect,
        [],
      ),
    ).toThrow('牌庫張數不足')
  })
})