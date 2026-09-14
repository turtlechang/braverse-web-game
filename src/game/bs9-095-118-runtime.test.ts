import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState, createCardNegativeDemoState } from './demo'
import { getEffectiveAttack } from './effects'
import type { GameState } from './types'

const battleSource = (state: GameState, cardNumber: string) => {
  const entry = state.players['player-one'].battleArea.find((candidate) => candidate.card.id === cardNumber)
  if (!entry) throw new Error(`${cardNumber} source is not in player-one battle area`)
  return entry
}

const supportPayment = (state: GameState) => {
  const support = state.players['player-one'].supportArea.find((entry) => !entry.rested)
  if (!support) throw new Error('fixture has no active support payment')
  return support.card.instanceId
}

describe('BS9-095～118 candidate runtime settlement', () => {
  it('BS9-098 requires three purple supports, then trashes itself and mills the opponent', () => {
    let state = createCardCheckDemoState('BS9-098')
    const source = battleSource(state, 'BS9-098')
    const opponentDeckBefore = state.players['player-two'].deck.length
    const opponentTrashBefore = state.players['player-two'].discardPile.length
    state = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(state.players['player-one'].battleArea.some((entry) => entry.card.instanceId === source.card.instanceId)).toBe(false)
    expect(state.players['player-two'].deck).toHaveLength(opponentDeckBefore - 3)
    expect(state.players['player-two'].discardPile).toHaveLength(opponentTrashBefore + 3)

    expect(() => applyGameCommand(createCardNegativeDemoState('BS9-098'), {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: battleSource(createCardNegativeDemoState('BS9-098'), 'BS9-098').card.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })).toThrow()
  })

  it('BS9-099 mills five, grants attack, and enforces Once Per Turn', () => {
    let state = createCardCheckDemoState('BS9-099')
    const source = battleSource(state, 'BS9-099')
    const payment = supportPayment(state)
    const deckBefore = state.players['player-one'].deck.length
    state = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      trigger: 'activate',
      paymentIds: [payment],
    })
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(state.players['player-one'].deck).toHaveLength(deckBefore - 5)
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [source.card.instanceId],
    })
    expect(getEffectiveAttack(state, source.card.instanceId)).toBe(source.card.attack + 1)
    expect(() => applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })).toThrow()

    const blocked = createCardCheckDemoState('BS9-099')
    const blockedSource = battleSource(blocked, 'BS9-099')
    const noPurple = {
      ...blocked,
      players: {
        ...blocked.players,
        'player-one': {
          ...blocked.players['player-one'],
          supportArea: blocked.players['player-one'].supportArea.map((entry) => ({ ...entry, rested: true })),
        },
      },
    }
    expect(() => applyGameCommand(noPurple, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: blockedSource.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })).toThrow()
  })

  it('BS9-100 On Play mills five cards from both decks', () => {
    let state = createCardCheckDemoState('BS9-100')
    const sourceInHand = state.players['player-one'].hand.find((card) => card.id === 'BS9-100')
    expect(sourceInHand).toBeDefined()
    state = applyGameCommand(state, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: sourceInHand!.instanceId,
    })
    const source = battleSource(state, 'BS9-100')
    const ownDeckBefore = state.players['player-one'].deck.length
    const opponentDeckBefore = state.players['player-two'].deck.length
    state = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      trigger: 'on-play',
      paymentIds: [],
    })
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(state.players['player-one'].deck).toHaveLength(ownDeckBefore - 5)
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(state.players['player-two'].deck).toHaveLength(opponentDeckBefore - 5)
    expect(state.pendingOnPlay).toBeNull()
    expect(state.pendingAbilityEffect).toBeUndefined()
  })

  const resolveAttackEffect = (initial: GameState, cardNumber: string, targetIds: string[] = []) => {
    battleSource(initial, cardNumber)
    let state = applyGameCommand(initial, {
      kind: 'resolve-attack-effect',
      playerId: 'player-one',
      targetIds,
    })
    while (state.pendingBattle?.stage === 'attack-effect') {
      state = applyGameCommand(state, {
        kind: 'resolve-attack-effect',
        playerId: 'player-one',
        targetIds: [],
      })
    }
    return state
  }

  it('BS9-097 attack Then applies only at opponent trash 20', () => {
    const makeState = (trashCount: number) => {
      const initial = createCardCheckDemoState('BS9-097', { normalAttack: 'payable' })
      const witness = initial.players['player-two'].hand[0]!
      return {
        ...initial,
        players: {
          ...initial.players,
          'player-two': {
            ...initial.players['player-two'],
            discardPile: Array.from({ length: trashCount }, (_, index) => ({
              ...witness,
              instanceId: `bs9-097-then-${trashCount}-${index + 1}`,
            })),
          },
        },
      }
    }

    const above = makeState(20)
    const aboveTarget = above.players['player-two'].battleArea[0]!
    const aboveHp = aboveTarget.hpCards.length
    const aboveResolved = resolveAttackEffect(above, 'BS9-097', [aboveTarget.card.instanceId])
    expect(aboveResolved.players['player-two'].battleArea[0]?.hpCards).toHaveLength(aboveHp - 1)

    const below = makeState(19)
    const belowTarget = below.players['player-two'].battleArea[0]!
    const belowHp = belowTarget.hpCards.length
    const belowResolved = resolveAttackEffect(below, 'BS9-097', [belowTarget.card.instanceId])
    expect(belowResolved.players['player-two'].battleArea[0]?.hpCards).toHaveLength(belowHp)
  })

  it('BS9-100 attack Then mills three cards from each deck', () => {
    const initial = createCardCheckDemoState('BS9-100', { normalAttack: 'payable' })
    const ownDeckBefore = initial.players['player-one'].deck.length
    const opponentDeckBefore = initial.players['player-two'].deck.length
    const resolved = resolveAttackEffect(initial, 'BS9-100')
    expect(resolved.players['player-one'].deck).toHaveLength(ownDeckBefore - 3)
    expect(resolved.players['player-two'].deck).toHaveLength(opponentDeckBefore - 3)
    expect(resolved.players['player-one'].discardPile).toHaveLength(3)
    expect(resolved.players['player-two'].discardPile).toHaveLength(3)
  })

  it('BS9-090 inspects exactly three cards and preserves the chosen top order', () => {
    let state = createCardCheckDemoState('BS9-090')
    const item = state.players['player-one'].hand.find((card) => card.id === 'BS9-090')
    expect(item).toBeDefined()
    state = applyGameCommand(state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: item!.instanceId,
      paymentIds: [supportPayment(state)],
    })
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    const revealed = state.pendingInspectDeck?.revealedCards ?? []
    expect(revealed).toHaveLength(3)
    const reversed = [...revealed].reverse().map((card) => card.instanceId)
    state = applyGameCommand(state, {
      kind: 'resolve-inspect-deck',
      playerId: 'player-one',
      pickedCardIds: [],
      restOrder: reversed,
    })
    expect(state.players['player-one'].deck.slice(0, 3).map((card) => card.instanceId)).toEqual(reversed)
    expect(state.pendingInspectDeck).toBeNull()

    const blocked = createCardNegativeDemoState('BS9-090')
    const blockedItem = blocked.players['player-one'].hand.find((card) => card.id === 'BS9-090')
    const noEnergy = {
      ...blocked,
      players: {
        ...blocked.players,
        'player-one': {
          ...blocked.players['player-one'],
          supportArea: blocked.players['player-one'].supportArea.map((entry) => ({ ...entry, rested: true })),
        },
      },
    }
    expect(() => applyGameCommand(noEnergy, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: blockedItem!.instanceId,
      paymentIds: [],
    })).toThrow()
  })

  it('BS9-091 reveals a real Shadow Milk, returns a blue LV2 Cookie, then plays it', () => {
    let state = createCardCheckDemoState('BS9-091')
    const item = state.players['player-one'].hand.find((card) => card.id === 'BS9-091')
    const shadow = state.players['player-one'].hand.find((card) => card.name === 'Shadow Milk Cookie')
    const blueTarget = state.players['player-one'].battleArea.find((entry) => entry.card.energyColor === 'blue')
    expect(item).toBeDefined()
    expect(shadow).toBeDefined()
    expect(blueTarget).toBeDefined()
    const paymentIds = state.players['player-one'].supportArea.slice(0, 2).map((entry) => entry.card.instanceId)
    state = applyGameCommand(state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: item!.instanceId,
      paymentIds,
      targetIds: [shadow!.instanceId],
    })
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [blueTarget!.card.instanceId],
    })
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [shadow!.instanceId],
    })
    expect(state.players['player-one'].battleArea.some((entry) => entry.card.id === 'BS9-079')).toBe(true)
    expect(state.players['player-one'].hand.some((card) => card.instanceId === shadow!.instanceId)).toBe(false)
    expect(() => applyGameCommand(createCardNegativeDemoState('BS9-091'), {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: createCardNegativeDemoState('BS9-091').players['player-one'].hand.find((card) => card.id === 'BS9-091')!.instanceId,
      paymentIds: createCardNegativeDemoState('BS9-091').players['player-one'].supportArea.slice(0, 2).map((entry) => entry.card.instanceId),
      targetIds: [],
    })).toThrow()
  })

  const resolveFlippedCoin = (initial: GameState, modeIndex: 0 | 1) => {
    let state = initial
    const item = state.players['player-one'].hand.find((card) => card.id === 'BS9-114')
    if (!item) throw new Error('BS9-114 item is not in hand')
    state = applyGameCommand(state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: item.instanceId,
      paymentIds: [supportPayment(state)],
    })
    state = applyGameCommand(state, {
      kind: 'resolve-choose-one',
      playerId: 'player-one',
      modeIndex,
    })
    return applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
  }

  it('BS9-114 resolves each trash-count mode and rejects the wrong threshold', () => {
    const ownDeckBefore = createCardCheckDemoState('BS9-114').players['player-one'].deck.length
    const low = resolveFlippedCoin(createCardCheckDemoState('BS9-114'), 0)
    expect(low.players['player-one'].deck).toHaveLength(ownDeckBefore - 5)
    expect(low.players['player-two'].discardPile).toHaveLength(0)

    let high = createCardCheckDemoState('BS9-114')
    const witness = high.players['player-one'].hand[0]!
    high = {
      ...high,
      players: {
        ...high.players,
        'player-one': {
          ...high.players['player-one'],
          discardPile: Array.from({ length: 15 }, (_, index) => ({
            ...witness,
            instanceId: `bs9-114-threshold-${index + 1}`,
          })),
        },
      },
    }
    const opponentDeckBefore = high.players['player-two'].deck.length
    const highResolved = resolveFlippedCoin(high, 1)
    expect(highResolved.players['player-two'].deck).toHaveLength(opponentDeckBefore - 3)
    expect(highResolved.players['player-two'].discardPile).toHaveLength(3)

    expect(() => resolveFlippedCoin(createCardCheckDemoState('BS9-114'), 1)).toThrow()
  })

  it('BS9-115 draws first and only mills the opponent at trash count 15 or less', () => {
    const resolveWolf = (initial: GameState) => {
      let state = initial
      const item = state.players['player-one'].hand.find((card) => card.id === 'BS9-115')
      if (!item) throw new Error('BS9-115 item is not in hand')
      state = applyGameCommand(state, {
        kind: 'begin-play-item',
        playerId: 'player-one',
        instanceId: item.instanceId,
        paymentIds: [supportPayment(state)],
      })
      state = applyGameCommand(state, {
        kind: 'resolve-ability-effect',
        playerId: 'player-one',
        targetIds: [],
      })
      expect(state.pendingDrawUpTo).toBeDefined()
      state = applyGameCommand(state, {
        kind: 'resolve-draw-up-to',
        playerId: 'player-one',
        drawCount: 1,
      })
      if (state.pendingAbilityEffect) {
        state = applyGameCommand(state, {
          kind: 'resolve-ability-effect',
          playerId: 'player-one',
          targetIds: [],
        })
      }
      return state
    }

    const positive = resolveWolf(createCardCheckDemoState('BS9-115'))
    expect(positive.players['player-two'].deck).toHaveLength(21)
    expect(positive.players['player-two'].discardPile).toHaveLength(3)

    let negative = createCardCheckDemoState('BS9-115')
    const witness = negative.players['player-two'].hand[0]!
    negative = {
      ...negative,
      players: {
        ...negative.players,
        'player-two': {
          ...negative.players['player-two'],
          discardPile: Array.from({ length: 16 }, (_, index) => ({
            ...witness,
            instanceId: `bs9-115-over-${index + 1}`,
          })),
        },
      },
    }
    const negativeResolved = resolveWolf(negative)
    expect(negativeResolved.players['player-two'].deck).toHaveLength(24)
    expect(negativeResolved.players['player-two'].discardPile).toHaveLength(16)
    expect(negativeResolved.pendingAbilityEffect).toBeUndefined()
  })

  it('BS9-118 stage activation trashes one HP and is once per turn', () => {
    let state = createCardCheckDemoState('BS9-118')
    const stage = state.players['player-one'].hand.find((card) => card.id === 'BS9-118')
    expect(stage).toBeDefined()
    state = applyGameCommand(state, {
      kind: 'play-stage',
      playerId: 'player-one',
      instanceId: stage!.instanceId,
      paymentIds: [supportPayment(state)],
    })
    const target = state.players['player-two'].battleArea[0]!
    const handCard = state.players['player-one'].hand[0]!
    const hpBefore = target.hpCards.length
    const trashBefore = state.players['player-two'].discardPile.length
    state = applyGameCommand(state, {
      kind: 'begin-activate-stage',
      playerId: 'player-one',
      paymentIds: [],
      discardHandIds: [handCard.instanceId],
      targetIds: [target.card.instanceId],
    })
    expect(state.players['player-two'].battleArea[0]?.hpCards).toHaveLength(hpBefore - 1)
    expect(state.players['player-two'].discardPile).toHaveLength(trashBefore + 1)
    expect(state.players['player-one'].stage?.card.id).toBe('BS9-118')
    expect(() => applyGameCommand(state, {
      kind: 'begin-activate-stage',
      playerId: 'player-one',
      paymentIds: [],
      discardHandIds: [state.players['player-one'].hand[0]!.instanceId],
      targetIds: [target.card.instanceId],
    })).toThrow()
  })

  it('BS9-093 applies -2 to the attacker and chains draw into a top-deck discard', () => {
    let state = createCardCheckDemoState('BS9-093')
    const trap = state.players['player-one'].hand.find((card) => card.id === 'BS9-093')
    const targetId = state.pendingBattle?.targetInstanceId
    expect(trap).toBeDefined()
    expect(targetId).toBeDefined()
    state = applyGameCommand(state, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: trap!.instanceId,
      paymentIds: state.players['player-one'].supportArea.slice(0, 2).map((entry) => entry.card.instanceId),
      targetIds: [targetId!],
    })
    expect(state.pendingBattle?.declaredDamage).toBe(2)
    expect(state.attackModifiers).toEqual([
      expect.objectContaining({ targetInstanceId: state.pendingBattle?.attackerInstanceId, amount: -2 }),
    ])
    expect(state.pendingDrawUpTo?.max).toBe(2)
    state = applyGameCommand(state, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 2,
    })
    expect(state.pendingOpponentHandDiscard).toMatchObject({
      count: 1,
      destination: 'deck-top',
      chainedFromDrawUpTo: true,
    })
    const discardId = state.players['player-one'].hand[0]!.instanceId
    state = applyGameCommand(state, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-one',
      cardIds: [discardId],
    })
    expect(state.players['player-one'].deck[0]?.instanceId).toBe(discardId)

    let blocked = createCardCheckDemoState('BS9-093')
    const blockedTrap = blocked.players['player-one'].hand.find((card) => card.id === 'BS9-093')
    const blockedTarget = blocked.pendingBattle?.targetInstanceId
    const witness = blocked.players['player-two'].hand[0]!
    const witnesses = Array.from({ length: 6 }, (_, index) => ({
      ...witness,
      instanceId: `bs9-093-hand-over-${index + 1}`,
    }))
    blocked = {
      ...blocked,
      players: {
        ...blocked.players,
        'player-one': {
          ...blocked.players['player-one'],
          hand: [blockedTrap!, ...witnesses],
        },
      },
    }
    blocked = applyGameCommand(blocked, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: blockedTrap!.instanceId,
      paymentIds: blocked.players['player-one'].supportArea.slice(0, 2).map((entry) => entry.card.instanceId),
      targetIds: [blockedTarget!],
    })
    expect(blocked.pendingDrawUpTo).toBeUndefined()
    expect(blocked.pendingBattle?.declaredDamage).toBe(2)
  })

  it('BS9-094 branches on the revealed card type in the real trap flow', () => {
    const resolveTrap = (initial: GameState) => {
      let state = initial
      const trap = state.players['player-one'].hand.find((card) => card.id === 'BS9-094')
      const payment = supportPayment(state)
      state = applyGameCommand(state, {
        kind: 'play-trap',
        playerId: 'player-one',
        trapInstanceId: trap!.instanceId,
        paymentIds: [payment],
        targetIds: [],
      })
      state = applyGameCommand(state, {
        kind: 'resolve-reveal-top-deck',
        playerId: 'player-one',
        targetIds: [],
      })
      return state
    }

    const cookie = resolveTrap(createCardCheckDemoState('BS9-094'))
    expect(cookie.pendingDrawUpTo).toBeUndefined()
    expect(cookie.pendingBattle?.declaredDamage).toBe(3)
    expect(cookie.attackModifiers.every((modifier) => modifier.amount === -1)).toBe(true)

    const nonCookie = resolveTrap(createCardNegativeDemoState('BS9-094'))
    expect(nonCookie.pendingDrawUpTo?.max).toBe(1)
    expect(nonCookie.pendingBattle?.declaredDamage).toBe(4)
  })

  it('BS9-095 draws after a Shadow Milk attack only while hand count is at most five', () => {
    const run = (initial: GameState) => {
      let state = initial
      const stage = state.players['player-one'].hand.find((card) => card.id === 'BS9-095')
      state = applyGameCommand(state, {
        kind: 'play-stage',
        playerId: 'player-one',
        instanceId: stage!.instanceId,
        paymentIds: [supportPayment(state)],
      })
      const attacker = state.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS9-079')
      const target = state.players['player-two'].battleArea[0]
      state = applyGameCommand(state, {
        kind: 'declare-attack',
        playerId: 'player-one',
        attackerInstanceId: attacker!.card.instanceId,
        targetInstanceId: target!.card.instanceId,
        supportPaymentIds: state.players['player-one'].supportArea
          .filter((entry) => !entry.rested)
          .slice(0, 3)
          .map((entry) => entry.card.instanceId),
      })
      return state
    }

    let positive = run(createCardCheckDemoState('BS9-095'))
    expect(positive.pendingStageTrigger).toBeDefined()
    positive = applyGameCommand(positive, {
      kind: 'resolve-stage-trigger',
      playerId: 'player-one',
      action: 'activate',
    })
    expect(positive.pendingDrawUpTo?.max).toBe(1)
    const handBefore = positive.players['player-one'].hand.length
    positive = applyGameCommand(positive, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 1,
    })
    expect(positive.players['player-one'].hand).toHaveLength(handBefore + 1)

    const negative = run(createCardNegativeDemoState('BS9-095'))
    expect(negative.pendingStageTrigger).toBeUndefined()
  })

  it('BS9-102 pays a purple hand card and lets the opponent choose a discard', () => {
    let state = createCardCheckDemoState('BS9-102')
    const extra = state.players['player-one'].extraDeck![0]
    state = applyGameCommand(state, {
      kind: 'play-extra-deck-cookie',
      playerId: 'player-one',
      instanceId: extra.instanceId,
    })
    const source = state.players['player-one'].battleArea.find((entry) => entry.card.instanceId === extra.instanceId)
    const purple = state.players['player-one'].hand.find((card) => card.energyColor === 'purple')
    expect(source).toBeDefined()
    expect(purple).toBeDefined()
    state = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source!.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
      discardHandIds: [purple!.instanceId],
    })
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(state.pendingOpponentHandDiscard).toMatchObject({ playerId: 'player-two', count: 1 })
    const opponentCard = state.players['player-two'].hand[0]!
    state = applyGameCommand(state, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-two',
      cardIds: [opponentCard.instanceId],
    })
    expect(state.players['player-two'].hand).toHaveLength(3)
    expect(state.players['player-two'].discardPile).toContainEqual(
      expect.objectContaining({ instanceId: opponentCard.instanceId }),
    )
    expect(() => applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source!.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
      discardHandIds: [],
    })).toThrow()

    let blocked = createCardCheckDemoState('BS9-102')
    const blockedExtra = blocked.players['player-one'].extraDeck![0]
    blocked = applyGameCommand(blocked, {
      kind: 'play-extra-deck-cookie',
      playerId: 'player-one',
      instanceId: blockedExtra.instanceId,
    })
    blocked = {
      ...blocked,
      players: {
        ...blocked.players,
        'player-two': {
          ...blocked.players['player-two'],
          hand: blocked.players['player-two'].hand.slice(0, 3),
        },
      },
    }
    const blockedSource = blocked.players['player-one'].battleArea.find((entry) => entry.card.instanceId === blockedExtra.instanceId)
    const blockedPurple = blocked.players['player-one'].hand.find((card) => card.energyColor === 'purple')
    expect(() => applyGameCommand(blocked, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: blockedSource!.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
      discardHandIds: [blockedPurple!.instanceId],
    })).toThrow()
  })
})
