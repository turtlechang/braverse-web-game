import { describe, expect, it } from 'vitest'
import { executeCardEffect, resolveInspectDeck } from './effects'
import { createDemoGame } from './demo'
import { continueInspectDeckAfterRefresh } from './inspect-deck'
import type { GameCard } from './types'

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
