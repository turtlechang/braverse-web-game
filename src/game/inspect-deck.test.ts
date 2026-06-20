import { describe, expect, it } from 'vitest'
import { executeCardEffect, resolveInspectDeck } from './effects'
import { createDemoGame } from './demo'
import { continueInspectDeckAfterRefresh } from './inspect-deck'
import { refreshDeck } from './refresh'
import { getPendingDecision } from './commands'
import type {
  CookieCard,
  GameCard,
  GameState,
  PlayerState,
} from './types'

const testCookie = (id: string, level = 1): GameCard => ({
  id,
  instanceId: `${id}-inst`,
  name: id,
  type: 'cookie',
  level,
  hp: 1,
  attack: 0,
  attackCost: 0,
})

describe('inspect-deck', () => {
  it('reveals top N cards and creates pendingInspectDeck', () => {
    const state = createDemoGame()
    const player = state.players['player-one']
    const deckCards = player.deck.slice(0, 3)
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'test-source' }
    const result = executeCardEffect(state, context, {
      kind: 'inspect-deck',
      lookCount: 3,
      pickCount: 1,
      restToBottom: true,
    }, [])
    expect(result.pendingInspectDeck).toBeDefined()
    expect(result.pendingInspectDeck!.revealedCards).toHaveLength(3)
    expect(result.pendingInspectDeck!.revealedCards.map((c) => c.instanceId)).toEqual(
      deckCards.map((c) => c.instanceId),
    )
    expect(result.pendingInspectDeck!.lookCount).toBe(3)
    expect(result.pendingInspectDeck!.pickCount).toBe(1)
    expect(result.players['player-one'].deck.length).toBe(player.deck.length - 3)
  })

  it('picks one card to hand, returns rest to bottom in specified order', () => {
    const state = createDemoGame()
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'test-source' }
    const withPending = executeCardEffect(state, context, {
      kind: 'inspect-deck',
      lookCount: 3,
      pickCount: 1,
      restToBottom: true,
    }, [])
    const pending = withPending.pendingInspectDeck!
    const pickedId = pending.revealedCards[0].instanceId
    const restOrder = [pending.revealedCards[2].instanceId, pending.revealedCards[1].instanceId]
    const result = resolveInspectDeck(withPending, 'player-one', pickedId, restOrder)
    expect(result.pendingInspectDeck).toBeNull()
    expect(result.players['player-one'].hand.map((c) => c.instanceId)).toContain(pickedId)
    const bottomCards = result.players['player-one'].deck.slice(-2)
    expect(bottomCards[0].instanceId).toBe(restOrder[0])
    expect(bottomCards[1].instanceId).toBe(restOrder[1])
  })

  it('rejects duplicate IDs in pickedCardId + restOrder', () => {
    const state = createDemoGame()
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'test-source' }
    const withPending = executeCardEffect(state, context, {
      kind: 'inspect-deck',
      lookCount: 3,
      pickCount: 1,
      restToBottom: true,
    }, [])
    const pending = withPending.pendingInspectDeck!
    const pickedId = pending.revealedCards[0].instanceId
    expect(() =>
      resolveInspectDeck(withPending, 'player-one', pickedId, [pickedId, pending.revealedCards[1].instanceId]),
    ).toThrow('不能重複選取同一張卡牌')
  })

  it('rejects if restOrder does not cover all non-picked cards', () => {
    const state = createDemoGame()
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'test-source' }
    const withPending = executeCardEffect(state, context, {
      kind: 'inspect-deck',
      lookCount: 3,
      pickCount: 1,
      restToBottom: true,
    }, [])
    const pending = withPending.pendingInspectDeck!
    const pickedId = pending.revealedCards[0].instanceId
    expect(() =>
      resolveInspectDeck(withPending, 'player-one', pickedId, [pending.revealedCards[1].instanceId]),
    ).toThrow('剩餘牌順序必須包含所有未選取的檢視卡牌')
  })

  it('rejects if pickedCardId is not in revealedCards', () => {
    const state = createDemoGame()
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'test-source' }
    const withPending = executeCardEffect(state, context, {
      kind: 'inspect-deck',
      lookCount: 3,
      pickCount: 1,
      restToBottom: true,
    }, [])
    expect(() =>
      resolveInspectDeck(withPending, 'player-one', 'non-existent', ['a', 'b']),
    ).toThrow('選取的卡牌不在檢視清單中')
  })

  it('triggers refresh when deck has insufficient cards', () => {
    let state = createDemoGame()
    const player = state.players['player-one']
    const existingCards = player.deck.slice(0, 1)
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          deck: existingCards,
          discardPile: [testCookie('lv1-cookie', 1), ...player.discardPile],
        },
      },
    }
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'test-source' }
    const result = executeCardEffect(state, context, {
      kind: 'inspect-deck',
      lookCount: 3,
      pickCount: 1,
      restToBottom: true,
    }, [])
    expect(result.pendingRefresh).toBeDefined()
    expect(result.pendingRefresh!.remainingDraws).toBe(0)
    expect(result.pendingInspectDeck).toBeDefined()
    expect(result.pendingInspectDeck!.revealedCards).toHaveLength(1)
  })

  it('triggers defeat when deck is empty and no refresh candidates', () => {
    let state = createDemoGame()
    const player = state.players['player-one']
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          deck: [],
          discardPile: [],
        },
      },
    }
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'test-source' }
    const result = executeCardEffect(state, context, {
      kind: 'inspect-deck',
      lookCount: 3,
      pickCount: 1,
      restToBottom: true,
    }, [])
    expect(result.status).toBe('finished')
    expect(result.result?.loserId).toBe('player-one')
    expect(result.result?.reason).toBe('refresh-unavailable')
  })

  it('continues inspect-deck after refresh, adding cards from new deck', () => {
    let state = createDemoGame()
    const player = state.players['player-one']
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          deck: player.deck.slice(0, 2),
          discardPile: [],
        },
      },
      pendingInspectDeck: {
        playerId: 'player-one',
        sourceInstanceId: 'test-source',
        sourceCardName: 'Test Cookie',
        revealedCards: [player.deck[0]],
        lookCount: 3,
        pickCount: 1,
      },
    }
    const result = continueInspectDeckAfterRefresh(state)
    expect(result.pendingInspectDeck!.revealedCards).toHaveLength(3)
    expect(result.players['player-one'].deck.length).toBe(0)
  })

  it('triggers refresh again when deck remains insufficient but discard has LV1+ cookie', () => {
    let state = createDemoGame()
    const player = state.players['player-one']
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          deck: player.deck.slice(0, 1),
          discardPile: [testCookie('lv1-cookie', 1)],
        },
      },
      pendingInspectDeck: {
        playerId: 'player-one',
        sourceInstanceId: 'test-source',
        sourceCardName: 'Test Cookie',
        revealedCards: [player.deck[0]],
        lookCount: 3,
        pickCount: 1,
      },
    }
    const result = continueInspectDeckAfterRefresh(state)
    expect(result.pendingRefresh).toBeDefined()
    expect(result.pendingRefresh!.remainingDraws).toBe(0)
    expect(result.pendingInspectDeck!.revealedCards).toHaveLength(2)
  })

  it('finishes with defeat when deck remains insufficient and no LV1+ cookie in discard', () => {
    let state = createDemoGame()
    const player = state.players['player-one']
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          deck: player.deck.slice(0, 1),
          discardPile: [],
        },
      },
      pendingInspectDeck: {
        playerId: 'player-one',
        sourceInstanceId: 'test-source',
        sourceCardName: 'Test Cookie',
        revealedCards: [player.deck[0]],
        lookCount: 3,
        pickCount: 1,
      },
    }
    const result = continueInspectDeckAfterRefresh(state)
    expect(result.status).toBe('finished')
    expect(result.result?.loserId).toBe('player-one')
    expect(result.result?.reason).toBe('refresh-unavailable')
  })

  it('finishes with defeat when discard has only LV0 or non-cookie cards', () => {
    let state = createDemoGame()
    const player = state.players['player-one']
    const itemCard: GameCard = {
      id: 'item-only', instanceId: 'item-only-inst', name: 'Item', type: 'item',
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          deck: player.deck.slice(0, 1),
          discardPile: [itemCard, testCookie('lv0-cookie', 0)],
        },
      },
      pendingInspectDeck: {
        playerId: 'player-one',
        sourceInstanceId: 'test-source',
        sourceCardName: 'Test Cookie',
        revealedCards: [player.deck[0]],
        lookCount: 3,
        pickCount: 1,
      },
    }
    const result = continueInspectDeckAfterRefresh(state)
    expect(result.status).toBe('finished')
    expect(result.result?.loserId).toBe('player-one')
    expect(result.result?.reason).toBe('refresh-unavailable')
  })
})

const buildInspectDeckTestState = (
  deckSize: number,
  breakLevel: number,
): GameState => {
  const battleCookie: CookieCard = {
    id: 'bc1', instanceId: 'bc1-inst', name: 'BC1',
    type: 'cookie', level: 1, hp: 1, attack: 0, attackCost: 0,
  }
  const deckCards: GameCard[] = Array.from({ length: deckSize }, (_, i) => ({
    id: `top-deck-${i}`, instanceId: `top-deck-${i}-inst`, name: `TopDeck${i}`,
    type: 'cookie', level: 1, hp: 1, attack: 0, attackCost: 0,
  }))
  const refreshCookie: CookieCard = {
    id: 'refresh-me', instanceId: 'refresh-me-inst', name: 'RefreshCookie',
    type: 'cookie', level: 2, hp: 1, attack: 0, attackCost: 0,
  }
  const discardOthers: GameCard[] = Array.from({ length: 7 }, (_, i) => ({
    id: `discard-other-${i}`, instanceId: `discard-other-${i}-inst`, name: `DiscOth${i}`,
    type: 'item',
  }))
  const breakCookies: CookieCard[] = Array.from({ length: breakLevel }, (_, i) => ({
    id: `break-lv1-${i}`, instanceId: `break-lv1-${i}-inst`, name: `Break${i}`,
    type: 'cookie', level: 1, hp: 1, attack: 0, attackCost: 0,
  }))
  const opponentCookie: CookieCard = {
    id: 'opp', instanceId: 'opp-inst', name: 'Opponent',
    type: 'cookie', level: 1, hp: 1, attack: 0, attackCost: 0,
  }

  const p1: PlayerState = {
    id: 'player-one',
    name: 'Player 1',
    deck: deckCards,
    hand: [],
    battleArea: [
      { card: battleCookie, hpCards: [testCookie('hp1')], rested: false, battleEntryId: 'bc1:battle:1' },
    ],
    supportArea: [],
    breakArea: breakCookies,
    discardPile: [refreshCookie, ...discardOthers],
    stage: null,
    hasMulliganed: true,
    startingCookieSelected: true,
    freeMulliganDecided: true,
    forcedMulliganCount: 0,
  }
  const p2: PlayerState = {
    id: 'player-two',
    name: 'Player 2',
    deck: [],
    hand: [],
    battleArea: [
      { card: opponentCookie, hpCards: [testCookie('opp-hp')], rested: false, battleEntryId: 'opp:battle:1' },
    ],
    supportArea: [],
    breakArea: [],
    discardPile: [],
    stage: null,
    hasMulliganed: true,
    startingCookieSelected: true,
    freeMulliganDecided: true,
    forcedMulliganCount: 0,
  }

  return {
    players: { 'player-one': p1, 'player-two': p2 },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-one',
    turnNumber: 1,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 3,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingOnPlay: null,
    pendingRefresh: null,
    pendingBattle: null,
    pendingFaintEffects: undefined,
    pendingOpponentHandDiscard: null,
    pendingInspectDeck: null,
    pendingOptionalCostAttack: undefined,
  }
}

const identityShuffle = <T>(cards: T[]): T[] => [...cards]

describe('inspect-deck integration', () => {
  it('deck 0: executeCardEffect → pendingRefresh, identity refresh → 3 revealed from new deck, resolve picks 1 to hand', () => {
    const state = buildInspectDeckTestState(0, 0)
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'bc1-inst' }
    const result = executeCardEffect(state, context, {
      kind: 'inspect-deck',
      lookCount: 3,
      pickCount: 1,
      restToBottom: true,
    }, [])
    expect(result.pendingRefresh).toBeDefined()
    expect(result.pendingRefresh!.playerId).toBe('player-one')
    expect(result.pendingInspectDeck!.revealedCards).toHaveLength(0)

    const refreshed = refreshDeck(result, 'player-one', 'refresh-me-inst', identityShuffle)
    expect(refreshed.pendingRefresh).toBeNull()
    expect(refreshed.pendingInspectDeck!.revealedCards).toHaveLength(3)
    const revealed = refreshed.pendingInspectDeck!.revealedCards
    const revealedIds = new Set(revealed.map((c) => c.instanceId))
    const p1 = refreshed.players['player-one']
    for (const card of p1.deck) {
      expect(revealedIds.has(card.instanceId)).toBe(false)
    }
    for (const card of p1.hand) {
      expect(revealedIds.has(card.instanceId)).toBe(false)
    }

    const pickedId = revealed[0].instanceId
    const restOrder = [revealed[2].instanceId, revealed[1].instanceId]
    const final = resolveInspectDeck(refreshed, 'player-one', pickedId, restOrder)
    expect(final.pendingInspectDeck).toBeNull()
    expect(final.players['player-one'].hand.map((c) => c.instanceId)).toContain(pickedId)
    const bottom = final.players['player-one'].deck.slice(-2)
    expect(bottom[0].instanceId).toBe(restOrder[0])
    expect(bottom[1].instanceId).toBe(restOrder[1])
  })

  it('deck 1: executeCardEffect → pendingRefresh, identity refresh → 1 original + 2 new, resolve picks 1 to hand', () => {
    const state = buildInspectDeckTestState(1, 0)
    const expectedTopCard = state.players['player-one'].deck[0]
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'bc1-inst' }
    const result = executeCardEffect(state, context, {
      kind: 'inspect-deck',
      lookCount: 3,
      pickCount: 1,
      restToBottom: true,
    }, [])
    expect(result.pendingRefresh).toBeDefined()
    expect(result.pendingInspectDeck!.revealedCards).toHaveLength(1)
    expect(result.pendingInspectDeck!.revealedCards[0].instanceId).toBe(expectedTopCard.instanceId)

    const refreshed = refreshDeck(result, 'player-one', 'refresh-me-inst', identityShuffle)
    expect(refreshed.pendingRefresh).toBeNull()
    expect(refreshed.pendingInspectDeck!.revealedCards).toHaveLength(3)
    const revealed = refreshed.pendingInspectDeck!.revealedCards
    expect(revealed[0].instanceId).toBe(expectedTopCard.instanceId)
    const revealedIds = new Set(revealed.map((c) => c.instanceId))
    const p1 = refreshed.players['player-one']
    for (const card of p1.deck) {
      expect(revealedIds.has(card.instanceId)).toBe(false)
    }
    for (const card of p1.hand) {
      expect(revealedIds.has(card.instanceId)).toBe(false)
    }

    const pickedId = revealed[0].instanceId
    const restOrder = [revealed[2].instanceId, revealed[1].instanceId]
    const final = resolveInspectDeck(refreshed, 'player-one', pickedId, restOrder)
    expect(final.pendingInspectDeck).toBeNull()
    expect(final.players['player-one'].hand.map((c) => c.instanceId)).toContain(pickedId)
    const bottom = final.players['player-one'].deck.slice(-2)
    expect(bottom[0].instanceId).toBe(restOrder[0])
    expect(bottom[1].instanceId).toBe(restOrder[1])
  })

  it('deck 2: executeCardEffect → no pendingRefresh, identity refresh only via continuePath, resolve picks 1 to hand', () => {
    const state = buildInspectDeckTestState(2, 0)
    const expectedTopCards = [
      state.players['player-one'].deck[0],
      state.players['player-one'].deck[1],
    ]
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'bc1-inst' }
    const result = executeCardEffect(state, context, {
      kind: 'inspect-deck',
      lookCount: 3,
      pickCount: 1,
      restToBottom: true,
    }, [])
    expect(result.pendingRefresh).toBeDefined()
    expect(result.pendingInspectDeck!.revealedCards).toHaveLength(2)
    expect(result.pendingInspectDeck!.revealedCards[0].instanceId).toBe(expectedTopCards[0].instanceId)
    expect(result.pendingInspectDeck!.revealedCards[1].instanceId).toBe(expectedTopCards[1].instanceId)

    const refreshed = refreshDeck(result, 'player-one', 'refresh-me-inst', identityShuffle)
    expect(refreshed.pendingRefresh).toBeNull()
    expect(refreshed.pendingInspectDeck!.revealedCards).toHaveLength(3)
    const revealed = refreshed.pendingInspectDeck!.revealedCards
    expect(revealed[0].instanceId).toBe(expectedTopCards[0].instanceId)
    expect(revealed[1].instanceId).toBe(expectedTopCards[1].instanceId)
    const revealedIds = new Set(revealed.map((c) => c.instanceId))
    const p1 = refreshed.players['player-one']
    for (const card of p1.deck) {
      expect(revealedIds.has(card.instanceId)).toBe(false)
    }
    for (const card of p1.hand) {
      expect(revealedIds.has(card.instanceId)).toBe(false)
    }

    const pickedId = revealed[1].instanceId
    const restOrder = [revealed[0].instanceId, revealed[2].instanceId]
    const final = resolveInspectDeck(refreshed, 'player-one', pickedId, restOrder)
    expect(final.pendingInspectDeck).toBeNull()
    expect(final.players['player-one'].hand.map((c) => c.instanceId)).toContain(pickedId)
    const bottom = final.players['player-one'].deck.slice(-2)
    expect(bottom[0].instanceId).toBe(restOrder[0])
    expect(bottom[1].instanceId).toBe(restOrder[1])
  })

  it('refresh with break-level-limit ends game, clears pendingInspectDeck/pendingOptionalCostAttack, no residual decisions', () => {
    const base = buildInspectDeckTestState(0, 8)
    const state: GameState = {
      ...base,
      pendingRefresh: { playerId: 'player-one', remainingDraws: 0 },
      pendingInspectDeck: {
        playerId: 'player-one',
        sourceInstanceId: 'test-source',
        sourceCardName: 'Test',
        revealedCards: [],
        lookCount: 3,
        pickCount: 1,
      },
      pendingOptionalCostAttack: {
        playerId: 'player-one',
        sourceInstanceId: 'test-source',
        sourceCardName: 'Test',
        cost: { energy: {}, discardHand: 0 },
        effects: [],
        effectText: 'test-optional',
      },
      pendingOpponentHandDiscard: {
        playerId: 'player-one',
        count: 2,
        sourcePlayerId: 'player-two',
        sourceInstanceId: 'rogue-cookie',
        sourceCardName: 'Roguefort Cookie',
        effectText: 'opponent-discard-hand',
      },
    }
    const result = refreshDeck(state, 'player-one', 'refresh-me-inst', identityShuffle)
    expect(result.status).toBe('finished')
    expect(result.result?.reason).toBe('break-level-limit')
    expect(result.pendingInspectDeck).toBeNull()
    expect(result.pendingOptionalCostAttack).toBeUndefined()
    expect(result.pendingOpponentHandDiscard).toBeNull()
    expect(result.pendingRefresh).toBeNull()
    expect(getPendingDecision(result)).toBeNull()
  })
})
