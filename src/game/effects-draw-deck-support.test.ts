import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  executeCardEffect,
  getTrashToSupportCandidates,
  isEffectUntargeted,
  type CardEffect,
} from '.'

describe('draw effect', () => {
  const drawContext = {
    sourcePlayerId: 'player-one' as const,
    sourceInstanceId: 'player-one-draw-source',
  }

  it('draws cards from source player deck to hand', () => {
    const state = createDemoGame()
    const initialDeckLen =
      state.players['player-one'].deck.length
    const initialHandLen =
      state.players['player-one'].hand.length
    const topCard = state.players['player-one'].deck[0]

    const effect: CardEffect = { kind: 'draw', amount: 1 }
    const newState = executeCardEffect(
      state,
      drawContext,
      effect,
      [],
    )

    expect(newState.players['player-one'].deck).toHaveLength(
      initialDeckLen - 1,
    )
    expect(newState.players['player-one'].hand).toHaveLength(
      initialHandLen + 1,
    )
    expect(
      newState.players['player-one'].hand.find(
        (c) => c.instanceId === topCard.instanceId,
      ),
    ).toBeDefined()
  })

  it('moves available top deck cards directly to either discard pile without Refresh', () => {
    let state = createDemoGame()
    const sourceTopCards = state.players['player-one'].deck.slice(0, 2)
    const opponentTopCards = state.players['player-two'].deck.slice(0, 2)

    state = executeCardEffect(
      state,
      drawContext,
      { kind: 'deck-to-trash', amount: 2, side: 'self' },
      [],
    )
    state = executeCardEffect(
      state,
      drawContext,
      { kind: 'deck-to-trash', amount: 2, side: 'opponent' },
      [],
    )

    expect(
      state.players['player-one'].discardPile.map((card) => card.instanceId),
    ).toEqual(expect.arrayContaining(sourceTopCards.map((card) => card.instanceId)))
    expect(
      state.players['player-two'].discardPile.map((card) => card.instanceId),
    ).toEqual(expect.arrayContaining(opponentTopCards.map((card) => card.instanceId)))
    expect(state.pendingRefresh).toBeNull()
    expect(isEffectUntargeted({ kind: 'deck-to-trash', amount: 1, side: 'self' }))
      .toBe(true)
  })

  it('draws multiple cards in one effect', () => {
    const state = createDemoGame()
    const deckLen = state.players['player-one'].deck.length
    const handLen = state.players['player-one'].hand.length

    const effect: CardEffect = { kind: 'draw', amount: 3 }
    const newState = executeCardEffect(
      state,
      drawContext,
      effect,
      [],
    )

    expect(newState.players['player-one'].deck).toHaveLength(
      deckLen - 3,
    )
    expect(newState.players['player-one'].hand).toHaveLength(
      handLen + 3,
    )
  })

  it('sets pendingRefresh when deck is exhausted with remaining draws', () => {
    let state = createDemoGame()
    const player = state.players['player-one']

    const cookieInDiscard = {
      ...player.battleArea[0].card,
      instanceId: 'discard-cookie-1',
    }

    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          deck: player.deck.slice(0, 1),
          discardPile: [cookieInDiscard],
        },
      },
    }

    const effect: CardEffect = { kind: 'draw', amount: 2 }
    const newState = executeCardEffect(
      state,
      drawContext,
      effect,
      [],
    )

    expect(newState.pendingRefresh).not.toBeNull()
    expect(newState.pendingRefresh?.playerId).toBe('player-one')
    expect(newState.pendingRefresh?.remainingDraws).toBe(1)
  })

  it('defeats player when deck empty and no refresh candidates', () => {
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

    const effect: CardEffect = { kind: 'draw', amount: 1 }
    const newState = executeCardEffect(
      state,
      drawContext,
      effect,
      [],
    )

    expect(newState.status).toBe('finished')
    expect(newState.result?.loserId).toBe('player-one')
    expect(newState.result?.reason).toBe('refresh-unavailable')
  })

  it('does not mutate the input game state', () => {
    const state = createDemoGame()
    const initialPlayer = state.players['player-one']
    const initialDeck = [...initialPlayer.deck]
    const initialHand = [...initialPlayer.hand]

    const effect: CardEffect = { kind: 'draw', amount: 1 }
    executeCardEffect(state, drawContext, effect, [])

    expect(state.players['player-one'].deck).toEqual(initialDeck)
    expect(state.players['player-one'].hand).toEqual(initialHand)
  })
})

describe('deck-to-support effect', () => {
  const dtsContext = {
    sourcePlayerId: 'player-one' as const,
    sourceInstanceId: 'player-one-dts-source',
  }

  it('moves top card from deck to support area as active', () => {
    const state = createDemoGame()
    const initialDeckLen = state.players['player-one'].deck.length
    const initialSupportLen = state.players['player-one'].supportArea.length
    const topCard = state.players['player-one'].deck[0]

    const effect: CardEffect = { kind: 'deck-to-support', amount: 1 }
    const newState = executeCardEffect(state, dtsContext, effect, [])

    expect(newState.players['player-one'].deck).toHaveLength(initialDeckLen - 1)
    expect(newState.players['player-one'].supportArea).toHaveLength(initialSupportLen + 1)
    const newSupport = newState.players['player-one'].supportArea[newState.players['player-one'].supportArea.length - 1]
    expect(newSupport.card.instanceId).toBe(topCard.instanceId)
    expect(newSupport.rested).toBe(false)
  })

  it('sets pendingRefresh with remainingDraws=0 when deck becomes empty', () => {
    let state = createDemoGame()
    const player = state.players['player-one']

    const cookieInDiscard = {
      ...player.battleArea[0].card,
      instanceId: 'discard-cookie-1',
    }

    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          deck: player.deck.slice(0, 1),
          discardPile: [cookieInDiscard],
        },
      },
    }

    const effect: CardEffect = { kind: 'deck-to-support', amount: 1 }
    const newState = executeCardEffect(state, dtsContext, effect, [])

    expect(newState.pendingRefresh).not.toBeNull()
    expect(newState.pendingRefresh?.playerId).toBe('player-one')
    expect(newState.pendingRefresh?.remainingDraws).toBe(0)
  })

  it('defeats player when deck empty and no refresh candidates', () => {
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

    const effect: CardEffect = { kind: 'deck-to-support', amount: 1 }
    const newState = executeCardEffect(state, dtsContext, effect, [])

    expect(newState.status).toBe('finished')
    expect(newState.result?.loserId).toBe('player-one')
    expect(newState.result?.reason).toBe('refresh-unavailable')
  })

  it('does not mutate the input game state', () => {
    const state = createDemoGame()
    const initialDeck = [...state.players['player-one'].deck]
    const initialSupport = [...state.players['player-one'].supportArea]

    const effect: CardEffect = { kind: 'deck-to-support', amount: 1 }
    executeCardEffect(state, dtsContext, effect, [])

    expect(state.players['player-one'].deck).toEqual(initialDeck)
    expect(state.players['player-one'].supportArea).toEqual(initialSupport)
  })

  it('moves multiple cards from deck to support area', () => {
    const state = createDemoGame()
    const initialDeckLen = state.players['player-one'].deck.length
    const initialSupportLen = state.players['player-one'].supportArea.length
    const topCards = state.players['player-one'].deck.slice(0, 3)

    const effect: CardEffect = { kind: 'deck-to-support', amount: 3 }
    const newState = executeCardEffect(state, dtsContext, effect, [])

    expect(newState.players['player-one'].deck).toHaveLength(initialDeckLen - 3)
    expect(newState.players['player-one'].supportArea).toHaveLength(initialSupportLen + 3)
    const newSupports = newState.players['player-one'].supportArea.slice(initialSupportLen)
    expect(newSupports.map((s) => s.card.instanceId)).toEqual(topCards.map((c) => c.instanceId))
    expect(newSupports.every((s) => s.rested === false)).toBe(true)
  })

  it('takes remaining cards and sets pendingRefresh when refresh candidates exist', () => {
    let state = createDemoGame()
    const player = state.players['player-one']
    const cookieInDiscard = {
      ...player.battleArea[0].card,
      instanceId: 'discard-cookie-1',
    }

    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          deck: player.deck.slice(0, 2),
          discardPile: [cookieInDiscard],
        },
      },
    }

    const effect: CardEffect = { kind: 'deck-to-support', amount: 5 }
    const newState = executeCardEffect(state, dtsContext, effect, [])

    expect(newState.players['player-one'].deck).toHaveLength(0)
    expect(newState.players['player-one'].supportArea).toHaveLength(player.supportArea.length + 2)
    expect(newState.pendingRefresh).not.toBeNull()
    expect(newState.pendingRefresh?.remainingDraws).toBe(0)
  })

  it('defeats player when deck exhausted and no refresh candidates for deck-to-support', () => {
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

    const effect: CardEffect = { kind: 'deck-to-support', amount: 1 }
    const newState = executeCardEffect(state, dtsContext, effect, [])

    expect(newState.status).toBe('finished')
    expect(newState.result?.loserId).toBe('player-one')
    expect(newState.result?.reason).toBe('refresh-unavailable')
  })

  it('isEffectUntargeted returns true for deck-to-support and draw', () => {
    expect(isEffectUntargeted({ kind: 'deck-to-support', amount: 1 })).toBe(true)
    expect(isEffectUntargeted({ kind: 'draw', amount: 1 })).toBe(true)
    expect(isEffectUntargeted({ kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } })).toBe(false)
  })

  it('isEffectUntargeted returns false for support-to-trash, trash-to-battle and support-to-hand', () => {
    expect(isEffectUntargeted({ kind: 'support-to-trash', amount: 1 })).toBe(false)
    expect(isEffectUntargeted({ kind: 'trash-to-battle', amount: 1 })).toBe(false)
    expect(isEffectUntargeted({ kind: 'trash-to-support', amount: 1 })).toBe(false)
    expect(isEffectUntargeted({ kind: 'support-to-hand', amount: 1 })).toBe(false)
  })
})

describe('trash-to-support effect', () => {
  const trashSupportContext = {
    sourcePlayerId: 'player-one' as const,
    sourceInstanceId: 'player-one-trash-support-source',
  }

  const createStateWithDiscardCookies = () => {
    const state = createDemoGame()
    const player = state.players['player-one']
    const sourceCookie = player.battleArea[0].card
    const firstCookie = {
      ...sourceCookie,
      instanceId: 'discard-cookie-1',
    }
    const secondCookie = {
      ...sourceCookie,
      instanceId: 'discard-cookie-2',
    }
    const nonCookie = {
      id: 'discard-item-1',
      instanceId: 'discard-item-1',
      name: 'discard item',
      type: 'item' as const,
    }

    return {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          discardPile: [firstCookie, nonCookie, secondCookie],
        },
      },
    }
  }

  it('moves selected discard pile cookies to support area', () => {
    const state = createStateWithDiscardCookies()
    const player = state.players['player-one']
    const effect: CardEffect = { kind: 'trash-to-support', amount: 1 }
    const targetId = player.discardPile[0].instanceId

    const next = executeCardEffect(
      state,
      trashSupportContext,
      effect,
      [targetId],
    )

    expect(next.players['player-one'].discardPile.map((card) => card.instanceId))
      .not.toContain(targetId)
    expect(next.players['player-one'].supportArea.at(-1)?.card.instanceId)
      .toBe(targetId)
    expect(next.players['player-one'].supportArea.at(-1)?.rested).toBe(false)
  })

  it('moves multiple selected discard pile cookies to support area as rested', () => {
    const state = createStateWithDiscardCookies()
    const player = state.players['player-one']
    const targetIds = [
      player.discardPile[0].instanceId,
      player.discardPile[2].instanceId,
    ]
    const effect: CardEffect = {
      kind: 'trash-to-support',
      amount: 2,
      rested: true,
    }

    const next = executeCardEffect(
      state,
      trashSupportContext,
      effect,
      targetIds,
    )

    expect(next.players['player-one'].discardPile.map((card) => card.instanceId))
      .not.toEqual(expect.arrayContaining(targetIds))
    const addedSupports = next.players['player-one'].supportArea.slice(
      player.supportArea.length,
    )
    expect(addedSupports.map((support) => support.card.instanceId))
      .toEqual(targetIds)
    expect(addedSupports.every((support) => support.rested)).toBe(true)
  })

  it('throws when trash-to-support receives no selected cookie', () => {
    const state = createStateWithDiscardCookies()
    const effect: CardEffect = { kind: 'trash-to-support', amount: 1 }

    expect(() =>
      executeCardEffect(state, trashSupportContext, effect, []),
    ).toThrow()
  })

  it('lists only discard pile cookies as trash-to-support candidates', () => {
    const state = createStateWithDiscardCookies()
    const candidates = getTrashToSupportCandidates(
      state,
      trashSupportContext,
    )

    expect(candidates.map((card) => card.instanceId)).toEqual([
      'discard-cookie-1',
      'discard-cookie-2',
    ])
  })

  it('filters optional trash-to-support selection by color and permits skipping', () => {
    const state = createStateWithDiscardCookies()
    const player = state.players['player-one']
    const greenCookie = {
      ...player.battleArea[0].card,
      instanceId: 'discard-green-cookie',
      energyColor: 'green' as const,
    }
    const redCookie = {
      ...player.battleArea[0].card,
      instanceId: 'discard-red-cookie',
      energyColor: 'red' as const,
    }
    const filteredState = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...player,
          discardPile: [greenCookie, redCookie],
        },
      },
    }
    const effect: CardEffect = {
      kind: 'trash-to-support',
      amount: 1,
      optional: true,
      energyColor: 'green',
      rested: true,
    }

    expect(
      getTrashToSupportCandidates(filteredState, trashSupportContext, effect).map(
        (card) => card.instanceId,
      ),
    ).toEqual(['discard-green-cookie'])
    const skipped = executeCardEffect(
      filteredState,
      trashSupportContext,
      effect,
      [],
    )
    expect(skipped.players['player-one'].supportArea).toEqual(
      player.supportArea,
    )
  })
})
