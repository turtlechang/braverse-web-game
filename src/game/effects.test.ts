import { describe, expect, it } from 'vitest'
import {
  advancePhase,
  attackCookie,
  createDemoGame,
  executeCardEffect,
  getAttackDamageAgainst,
  getBreakToTrashCandidates,
  getEffectiveAttack,
  isEffectConditionMet,
  isEffectUntargeted,
  resolveOpponentHandDiscard,
  selectEffectTargets,
  validateBreakToTrashTargets,
  type CardEffect,
  type GameCard,
  type GameState,
} from '.'

const context = {
  sourcePlayerId: 'player-one' as const,
  sourceInstanceId: 'player-one-starter-1',
}

const createSupport = (instanceId: string): GameCard => ({
  id: instanceId,
  instanceId,
  name: 'Effect payment',
  type: 'item',
  energyColor: 'red',
})

const reachEndOfTurn = (state: GameState): GameState => {
  let current = state

  while (current.phase !== 'end') {
    current = advancePhase(current)
  }

  return current
}

describe('card effect engine', () => {
  it('validates target side, count, and remaining HP filters', () => {
    const state = createDemoGame()
    const opponent = state.players['player-two'].battleArea[0]
    const selector = {
      side: 'opponent' as const,
      min: 1,
      max: 1,
      remainingHp: opponent.hpCards.length,
    }

    expect(
      selectEffectTargets(state, context, selector, [
        opponent.card.instanceId,
      ]),
    ).toEqual([opponent])
    expect(() =>
      selectEffectTargets(state, context, selector, [
        state.players['player-one'].battleArea[0].card.instanceId,
      ]),
    ).toThrow('不是此效果的合法目標')
    expect(() =>
      selectEffectTargets(state, context, selector, []),
    ).toThrow('目標數量不合法')
  })

  it('deals direct damage to each selected target', () => {
    let state = createDemoGame()
    const firstTarget = {
      ...state.players['player-two'].battleArea[0],
      hpCards: [
        ...state.players['player-two'].battleArea[0].hpCards,
        createSupport('first-target-extra-hp'),
      ],
    }
    const secondTarget = {
      ...firstTarget,
      card: {
        ...firstTarget.card,
        instanceId: 'player-two-second-cookie',
      },
      hpCards: [...firstTarget.hpCards],
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          battleArea: [firstTarget, secondTarget],
        },
      },
    }
    const effect: CardEffect = {
      kind: 'damage',
      amount: 1,
      target: {
        side: 'opponent',
        min: 0,
        max: 2,
      },
    }

    state = executeCardEffect(state, context, effect, [
      firstTarget.card.instanceId,
      secondTarget.card.instanceId,
    ])

    expect(
      state.players['player-two'].battleArea.map(
        (cookie) => cookie.hpCards.length,
      ),
    ).toEqual([
      firstTarget.hpCards.length - 1,
      secondTarget.hpCards.length - 1,
    ])
  })

  it('applies positive and negative attack modifiers with a zero floor', () => {
    let state = createDemoGame()
    const ownCookie = state.players['player-one'].battleArea[0]
    const opponent = state.players['player-two'].battleArea[0]

    state = executeCardEffect(
      state,
      context,
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1 },
      },
      [ownCookie.card.instanceId],
    )
    state = executeCardEffect(
      state,
      context,
      {
        kind: 'modify-attack',
        amount: -5,
        duration: 'this-turn',
        target: { side: 'opponent', min: 1, max: 1 },
      },
      [opponent.card.instanceId],
    )

    expect(getEffectiveAttack(state, ownCookie.card.instanceId)).toBe(
      ownCookie.card.attack + 2,
    )
    expect(getEffectiveAttack(state, opponent.card.instanceId)).toBe(0)
  })

  it('expires this-turn modifiers when the turn ends', () => {
    let state = createDemoGame()
    const ownCookie = state.players['player-one'].battleArea[0]

    state = executeCardEffect(
      state,
      context,
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1 },
      },
      [ownCookie.card.instanceId],
    )
    state = advancePhase(reachEndOfTurn(state))

    expect(state.attackModifiers).toHaveLength(0)
    expect(getEffectiveAttack(state, ownCookie.card.instanceId)).toBe(
      ownCookie.card.attack,
    )
  })

  it('reduces attack damage received without changing attack power', () => {
    let state = createDemoGame()
    const attacker = state.players['player-two'].battleArea[0]
    const target = state.players['player-one'].battleArea[0]

    state = executeCardEffect(
      state,
      context,
      {
        kind: 'modify-damage-received',
        amount: -1,
        duration: 'opponent-next-turn',
        target: { side: 'self', min: 1, max: 1 },
      },
      [target.card.instanceId],
    )

    expect(getEffectiveAttack(state, target.card.instanceId)).toBe(
      target.card.attack,
    )
    expect(
      getAttackDamageAgainst(
        state,
        attacker.card.instanceId,
        target.card.instanceId,
      ),
    ).toBe(Math.max(0, attacker.card.attack - 1))
  })

  it('enforces break-level activation conditions', () => {
    let state = createDemoGame()
    const target = {
      ...state.players['player-two'].battleArea[0],
      hpCards: [
        ...state.players['player-two'].battleArea[0].hpCards,
        createSupport('condition-extra-hp'),
      ],
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          battleArea: [target],
        },
      },
    }
    const effect: CardEffect = {
      kind: 'damage',
      amount: 1,
      condition: {
        kind: 'break-level-at-least',
        level: 6,
      },
      target: { side: 'opponent', min: 0, max: 1 },
    }

    expect(() =>
      executeCardEffect(state, context, effect, [
        target.card.instanceId,
      ]),
    ).toThrow('尚未滿足')
    expect(isEffectConditionMet(state, context, effect)).toBe(false)

    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [
            { ...state.players['player-one'].battleArea[0].card, level: 6 },
          ],
        },
      },
    }

    expect(
      executeCardEffect(state, context, effect, [
        target.card.instanceId,
      ]).players['player-two'].battleArea[0].hpCards,
    ).toHaveLength(target.hpCards.length - 1)
    expect(isEffectConditionMet(state, context, effect)).toBe(true)
  })

  it('attaches supported official effects to demo cards', () => {
    const state = createDemoGame()
    const cards = Object.values(state.players).flatMap((player) => [
      ...player.deck,
      ...player.hand,
      ...player.battleArea.map((cookie) => cookie.card),
    ])
    const ninja = cards.find((card) => card.id === 'ST1-002')
    const jelly = cards.find((card) => card.id === 'ST1-016')

    expect(ninja?.effects?.[0]).toMatchObject({
      kind: 'damage',
      amount: 1,
    })
    expect(jelly?.effectText).toContain("opponent's Cookies")
  })

  it('uses modified attack damage for a basic attack', () => {
    let state = createDemoGame()
    const attacker = state.players['player-one'].battleArea[0]
    const target = state.players['player-two'].battleArea[0]
    const extendedTarget = {
      ...target,
      hpCards: [
        ...target.hpCards,
        createSupport('extra-hp-1'),
        createSupport('extra-hp-2'),
      ],
    }
    const payments = Array.from(
      { length: attacker.card.attackCost },
      (_, index) => createSupport(`effect-payment-${index + 1}`),
    )
    state = {
      ...state,
      turnNumber: 2,
      phase: 'main',
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          supportArea: payments.map((card) => ({
            card,
            rested: false,
          })),
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea: [extendedTarget],
        },
      },
    }
    state = executeCardEffect(
      state,
      context,
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1 },
      },
      [attacker.card.instanceId],
    )
    state = attackCookie(
      state,
      attacker.card.instanceId,
      target.card.instanceId,
      payments.map((card) => card.instanceId),
    )

    expect(
      state.players['player-two'].battleArea[0].hpCards,
    ).toHaveLength(
      extendedTarget.hpCards.length - attacker.card.attack - 1,
    )
  })
})

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
})

describe('break-to-trash effect', () => {
  const bttContext = {
    sourcePlayerId: 'player-one' as const,
    sourceInstanceId: 'player-one-btt-source',
  }

  const effect: CardEffect = {
    kind: 'break-to-trash',
    max: 1,
    exactLevel: 1,
  }

  it('moves selected break area card to discard pile', () => {
    let state = createDemoGame()
    const lv1Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv1-test',
      level: 1,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [lv1Card],
        },
      },
    }

    const initialDiscardLen =
      state.players['player-one'].discardPile.length
    const newState = executeCardEffect(state, bttContext, effect, [
      lv1Card.instanceId,
    ])

    expect(newState.players['player-one'].breakArea).toHaveLength(0)
    expect(newState.players['player-one'].discardPile).toHaveLength(
      initialDiscardLen + 1,
    )
    expect(
      newState.players['player-one'].discardPile.find(
        (c) => c.instanceId === lv1Card.instanceId,
      ),
    ).toBeDefined()
  })

  it('allows selecting 0 targets and does nothing', () => {
    let state = createDemoGame()
    const lv1Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv1-test',
      level: 1,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [lv1Card],
        },
      },
    }

    const newState = executeCardEffect(state, bttContext, effect, [])

    expect(newState.players['player-one'].breakArea).toHaveLength(1)
    expect(newState).not.toBe(state)
  })

  it('rejects duplicate target instanceIds', () => {
    let state = createDemoGame()
    const lv1Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv1-dup',
      level: 1,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [lv1Card],
        },
      },
    }

    expect(() =>
      executeCardEffect(state, bttContext, effect, [
        lv1Card.instanceId,
        lv1Card.instanceId,
      ]),
    ).toThrow('目標數量不合法')
  })

  it('rejects targets with level > exactLevel', () => {
    let state = createDemoGame()
    const lv2Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv2-test',
      level: 2,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [lv2Card],
        },
      },
    }

    expect(() =>
      executeCardEffect(state, bttContext, effect, [
        lv2Card.instanceId,
      ]),
    ).toThrow('不是此效果的合法目標')
  })

  it('rejects targets not in own break area', () => {
    const state = createDemoGame()

    expect(() =>
      executeCardEffect(
        state,
        bttContext,
        effect,
        ['non-existent-instance'],
      ),
    ).toThrow('不是此效果的合法目標')
  })

  it('rejects selecting more than max', () => {
    let state = createDemoGame()
    const card1 = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv1-a',
      level: 1,
    }
    const card2 = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv1-b',
      level: 1,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [card1, card2],
        },
      },
    }

    expect(() =>
      executeCardEffect(state, bttContext, effect, [
        card1.instanceId,
        card2.instanceId,
      ]),
    ).toThrow('目標數量不合法')
  })

  it('enforces break-level condition when present', () => {
    let state = createDemoGame()
    const lv1Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv1-cond',
      level: 1,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [lv1Card],
        },
      },
    }

    const conditionalEffect: CardEffect = {
      kind: 'break-to-trash',
      max: 1,
      exactLevel: 1,
      condition: {
        kind: 'break-level-at-least',
        level: 6,
      },
    }

    expect(
      isEffectConditionMet(state, bttContext, conditionalEffect),
    ).toBe(false)
    expect(() =>
      executeCardEffect(state, bttContext, conditionalEffect, [
        lv1Card.instanceId,
      ]),
    ).toThrow('尚未滿足')

    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [
            lv1Card,
            { ...lv1Card, instanceId: 'lv5-card', level: 5 },
          ],
        },
      },
    }

    expect(
      isEffectConditionMet(state, bttContext, conditionalEffect),
    ).toBe(true)
    expect(
      executeCardEffect(state, bttContext, conditionalEffect, [
        lv1Card.instanceId,
      ]).players['player-one'].breakArea,
    ).toHaveLength(1)
  })

  it('resolves victory after moving break area card and reaching level 10', () => {
    let state = createDemoGame()
    const lv1Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv1-v',
      level: 1,
    }
    const lv9Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'lv9-card',
      level: 9,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [lv1Card, lv9Card],
        },
      },
    }

    const newState = executeCardEffect(state, bttContext, effect, [
      lv1Card.instanceId,
    ])

    expect(newState.players['player-one'].breakArea).toEqual([lv9Card])
    expect(newState.status).toBe('playing')
  })

  it('does not mutate the input game state', () => {
    let state = createDemoGame()
    const lv1Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv1-imm',
      level: 1,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [lv1Card],
        },
      },
    }

    const initialBreak = [...state.players['player-one'].breakArea]
    const initialDiscard = [...state.players['player-one'].discardPile]

    executeCardEffect(state, bttContext, effect, [lv1Card.instanceId])

    expect(state.players['player-one'].breakArea).toEqual(initialBreak)
    expect(state.players['player-one'].discardPile).toEqual(initialDiscard)
  })

  it('does not finish the game when moving does not reach break level 10', () => {
    let state = createDemoGame()
    const lv1Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv1-safe',
      level: 1,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [lv1Card],
        },
      },
    }

    const newState = executeCardEffect(state, bttContext, effect, [
      lv1Card.instanceId,
    ])

    expect(newState.status).toBe('playing')
  })

  it('does not recover a finished state after effect', () => {
    let state = createDemoGame()
    state = { ...state, status: 'finished' as const }

    expect(() =>
      executeCardEffect(state, bttContext, effect, []),
    ).toThrow('只有進行中的遊戲可以執行卡牌效果')
  })

  it('getBreakToTrashCandidates filters by exactLevel', () => {
    let state = createDemoGame()
    const lv1Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'c-lv1',
      level: 1,
    }
    const lv2Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'c-lv2',
      level: 2,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [lv1Card, lv2Card],
        },
      },
    }

    const candidates = getBreakToTrashCandidates(
      state,
      bttContext,
      { kind: 'break-to-trash', max: 1, exactLevel: 1 },
    )

    expect(candidates).toHaveLength(1)
    expect(candidates[0].instanceId).toBe('c-lv1')
  })

  it('validateBreakToTrashTargets throws on duplicate ids', () => {
    expect(() =>
      validateBreakToTrashTargets(
        createDemoGame(),
        bttContext,
        { kind: 'break-to-trash', max: 1, exactLevel: 1 },
        ['id', 'id'],
      ),
    ).toThrow('目標數量不合法')
  })

  it('isEffectUntargeted returns false for break-to-trash', () => {
    expect(
      isEffectUntargeted({
        kind: 'break-to-trash',
        max: 1,
        exactLevel: 1,
      }),
    ).toBe(false)
  })
})

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
