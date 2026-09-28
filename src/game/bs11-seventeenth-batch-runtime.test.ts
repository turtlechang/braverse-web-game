import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { executeCardEffect } from './effects'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'
import type { CookieInBattle, CookieCard, GameCard, GameState } from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, `bs11-seventeenth-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${cardNumber}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const cookieEntry = (
  card: GameCard,
  hpCards: GameCard[],
  equippedCards: GameCard[] = [],
): CookieInBattle => {
  if (card.type !== 'cookie') throw new Error(`Expected Cookie: ${card.name}`)
  return {
    card: card as CookieCard,
    hpCards,
    ...(equippedCards.length > 0 ? { equippedCards } : {}),
    rested: false,
    battleEntryId: `${card.instanceId}:battle`,
  }
}

const advanceDamage = (state: GameState): GameState => {
  let current = state
  for (let index = 0; index < 8 && current.pendingBattle?.stage === 'damage'; index += 1) {
    current = applyGameCommand(current, {
      kind: 'resolve-next-damage',
      playerId: 'player-one',
    })
  }
  return current
}

const makeBreathState = (withReplacementPayment = true) => {
  const base = createBattleState()
  const breath = candidate('BS11-064', 'item')
  const discardCost = item('BS11-064:discard-cost')
  const breathPayment = item('BS11-064:payment', 'blue')
  const replacementPayment = item('BS11-064:replacement-payment', 'red')
  const onPlayCookie: CookieCard = {
    ...cookie('BS11-064:on-play-cookie', 1, 1),
    skill: {
      trigger: 'on-play',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: { blue: 3 }, discardHand: 1 },
      text: '<{B}{B}{B}> <Discard 1 card.> Draw 2 cards.',
      effects: [{ kind: 'draw', amount: 2 }],
    },
  }
  return {
    state: {
      ...base,
      activePlayerId: 'player-one' as const,
      phase: 'main' as const,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [breath, discardCost],
          supportArea: [{ card: breathPayment, rested: false }],
        },
        'player-two': {
          ...base.players['player-two'],
          hand: [],
          battleArea: [cookieEntry(onPlayCookie, [item('BS11-064:on-play-hp')])],
          supportArea: withReplacementPayment
            ? [{ card: replacementPayment, rested: false }]
            : [],
          deck: [item('BS11-064:draw-1'), item('BS11-064:draw-2')],
        },
      },
    },
    breath,
    discardCost,
    breathPayment,
    replacementPayment,
    onPlayCookie,
  }
}

describe('BS11-064 The Breath of the Depths runtime', () => {
  it('replaces the opponent On Play, charges 1N, and draws at most one card', () => {
    const scenario = makeBreathState()
    let current = applyGameCommand(scenario.state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: scenario.breath.instanceId,
      paymentIds: [scenario.breathPayment.instanceId],
      discardHandIds: [scenario.discardCost.instanceId],
    })
    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(current.onPlayReplacementUntilTurn?.['player-two']).toMatchObject({
      turn: current.turnNumber,
      cost: { energy: { neutral: 1 } },
      effects: [{ kind: 'draw-up-to', max: 1 }],
    })

    current = {
      ...current,
      pendingOnPlay: {
        playerId: 'player-two',
        sourceInstanceId: scenario.onPlayCookie.instanceId,
        origin: 'hand',
      },
    }
    current = applyGameCommand(current, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: scenario.onPlayCookie.instanceId,
      trigger: 'on-play',
      paymentIds: [scenario.replacementPayment.instanceId],
    })
    expect(current.pendingOnPlay).toBeNull()
    expect(current.pendingAbilityEffect?.effects).toEqual([
      { kind: 'draw-up-to', max: 1 },
    ])

    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [],
    })
    expect(current.pendingDrawUpTo).toMatchObject({
      playerId: 'player-two',
      max: 1,
    })
    current = applyGameCommand(current, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-two',
      drawCount: 1,
    })

    expect(current.players['player-two'].hand).toEqual([
      item('BS11-064:draw-1'),
    ])
    expect(current.players['player-two'].supportArea[0]).toMatchObject({
      card: scenario.replacementPayment,
      rested: true,
    })
  })

  it('does not allow the replacement without an active 1N payment', () => {
    const scenario = makeBreathState(false)
    let current = applyGameCommand(scenario.state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: scenario.breath.instanceId,
      paymentIds: [scenario.breathPayment.instanceId],
      discardHandIds: [scenario.discardCost.instanceId],
    })
    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    current = {
      ...current,
      pendingOnPlay: {
        playerId: 'player-two',
        sourceInstanceId: scenario.onPlayCookie.instanceId,
        origin: 'hand',
      },
    }
    expect(() => applyGameCommand(current, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: scenario.onPlayCookie.instanceId,
      trigger: 'on-play',
      paymentIds: [],
    })).toThrow()
  })
})

const makeMirrorState = (target: CookieInBattle): {
  state: GameState
  mirror: GameCard
  discardCost: GameCard
  target: CookieInBattle
  payments: GameCard[]
} => {
  const base = createBattleState()
  const mirror = candidate('BS11-065', 'item')
  const discardCost = item('BS11-065:discard-cost')
  const payments = [item('BS11-065:payment-a', 'blue'), item('BS11-065:payment-b', 'blue')]
  return {
    state: {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [mirror, discardCost],
          supportArea: payments.map((card) => ({ card, rested: false })),
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [target],
          deck: [item('BS11-065:deck-existing')],
        },
      },
    },
    mirror,
    discardCost,
    target,
    payments,
  }
}

describe('BS11-065 Mirror of Destiny runtime', () => {
  it('pays 2B plus one discard and moves the whole LV2 Cookie to its owner deck bottom', () => {
    const targetCard = { ...cookie('BS11-065:target', 2, 3), level: 2 as const }
    const hpCards = [item('BS11-065:hp-1'), item('BS11-065:hp-2'), item('BS11-065:hp-3')]
    const equipped = item('BS11-065:equipped')
    const scenario = makeMirrorState(cookieEntry(targetCard, hpCards, [equipped]))

    let current = applyGameCommand(scenario.state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: scenario.mirror.instanceId,
      paymentIds: scenario.payments.map((card) => card.instanceId),
      discardHandIds: [scenario.discardCost.instanceId],
    })
    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [scenario.target.card.instanceId],
    })

    expect(current.players['player-two'].battleArea).toHaveLength(0)
    expect(current.players['player-two'].deck.at(-1)).toEqual(scenario.target.card)
    expect(current.players['player-two'].discardPile).toEqual(
      expect.arrayContaining([...hpCards, equipped]),
    )
    expect(current.players['player-two'].discardPile).not.toContainEqual(scenario.target.card)
    expect(current.players['player-one'].discardPile).toContainEqual(scenario.discardCost)
  })

  it('rejects wrong payment, wrong timing, and a Cookie above LV2', () => {
    const highTarget = cookieEntry({ ...cookie('BS11-065:lv3', 2, 3), level: 3 }, [item('BS11-065:lv3-hp')])
    const scenario = makeMirrorState(highTarget)
    expect(() => applyGameCommand(scenario.state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: scenario.mirror.instanceId,
      paymentIds: [scenario.payments[0].instanceId],
      discardHandIds: [scenario.discardCost.instanceId],
    })).toThrow()

    const wrongTiming = { ...scenario.state, activePlayerId: 'player-two' as const }
    expect(() => applyGameCommand(wrongTiming, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: scenario.mirror.instanceId,
      paymentIds: scenario.payments.map((card) => card.instanceId),
      discardHandIds: [scenario.discardCost.instanceId],
    })).toThrow()

    const paid = applyGameCommand(scenario.state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: scenario.mirror.instanceId,
      paymentIds: scenario.payments.map((card) => card.instanceId),
      discardHandIds: [scenario.discardCost.instanceId],
    })
    expect(() => applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [scenario.target.card.instanceId],
    })).toThrow()
  })
})

const makeMilkState = () => {
  const base = createBattleState()
  const trap = candidate('BS11-066', 'trap')
  const trapPayment = item('BS11-066:payment', 'blue')
  const attackPayment = item('BS11-066:attack-payment', 'red')
  const topCard = item('BS11-066:opponent-top')
  const bottomCard = item('BS11-066:opponent-bottom')
  return {
    state: {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [trap],
          supportArea: [{ card: trapPayment, rested: false }],
        },
        'player-two': {
          ...base.players['player-two'],
          supportArea: [{ card: attackPayment, rested: false }],
          deck: [topCard, bottomCard],
        },
      },
    },
    trap,
    trapPayment,
    attackPayment,
    attacker: base.players['player-two'].battleArea[0]!,
    defender: base.players['player-one'].battleArea[0]!,
    topCard,
  }
}

describe('BS11-066 Milk Lake of Truth runtime', () => {
  it('reduces the selected attacker and returns the opponent top card to the opponent deck bottom', () => {
    const scenario = makeMilkState()
    const declared = applyGameCommand(scenario.state, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: scenario.attacker.card.instanceId,
      targetInstanceId: scenario.defender.card.instanceId,
      supportPaymentIds: [scenario.attackPayment.instanceId],
    })
    let current = applyGameCommand(declared, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: scenario.trap.instanceId,
      paymentIds: [scenario.trapPayment.instanceId],
      targetIds: [],
      effectTargets: [[scenario.attacker.card.instanceId]],
    })
    expect(current.attackModifiers).toContainEqual(expect.objectContaining({
      targetInstanceId: scenario.attacker.card.instanceId,
      amount: -1,
    }))

    if (current.pendingAbilityEffect && !current.pendingInspectDeck) {
      current = applyGameCommand(current, {
        kind: 'resolve-ability-effect',
        playerId: 'player-one',
        targetIds: [],
      })
    }
    expect(current.pendingInspectDeck).toMatchObject({
      playerId: 'player-one',
      deckPlayerId: 'player-two',
      restDestination: 'top-or-bottom',
    })
    expect(current.pendingInspectDeck?.revealedCards).toEqual([scenario.topCard])
    expect(() => applyGameCommand(current, {
      kind: 'resolve-inspect-deck',
      playerId: 'player-one',
      pickedCardIds: [],
      restOrder: [scenario.topCard.instanceId],
    })).toThrow()

    current = applyGameCommand(current, {
      kind: 'resolve-inspect-deck',
      playerId: 'player-one',
      pickedCardIds: [],
      restOrder: [scenario.topCard.instanceId],
      restDestination: 'bottom',
    })
    expect(current.pendingInspectDeck).toBeNull()
    expect(current.players['player-two'].deck.at(-1)).toEqual(scenario.topCard)
    expect(current.players['player-one'].deck).not.toContainEqual(scenario.topCard)
  })

  it('can leave the inspected opponent card on its deck top', () => {
    const scenario = makeMilkState()
    const declared = applyGameCommand(scenario.state, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: scenario.attacker.card.instanceId,
      targetInstanceId: scenario.defender.card.instanceId,
      supportPaymentIds: [scenario.attackPayment.instanceId],
    })
    let current = applyGameCommand(declared, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: scenario.trap.instanceId,
      paymentIds: [scenario.trapPayment.instanceId],
      targetIds: [],
      effectTargets: [[]],
    })
    if (current.pendingAbilityEffect && !current.pendingInspectDeck) {
      current = applyGameCommand(current, {
        kind: 'resolve-ability-effect',
        playerId: 'player-one',
        targetIds: [],
      })
    }
    expect(current.pendingInspectDeck?.revealedCards).toEqual([scenario.topCard])
    current = applyGameCommand(current, {
      kind: 'resolve-inspect-deck',
      playerId: 'player-one',
      pickedCardIds: [],
      restOrder: [scenario.topCard.instanceId],
      restDestination: 'top',
    })
    expect(current.pendingInspectDeck).toBeNull()
    expect(current.players['player-two'].deck[0]).toEqual(scenario.topCard)
  })

  it('rejects trap payment and a non-opponent target', () => {
    const scenario = makeMilkState()
    const declared = applyGameCommand(scenario.state, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: scenario.attacker.card.instanceId,
      targetInstanceId: scenario.defender.card.instanceId,
      supportPaymentIds: [scenario.attackPayment.instanceId],
    })
    expect(() => applyGameCommand(declared, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: scenario.trap.instanceId,
      paymentIds: [],
      targetIds: [],
      effectTargets: [[scenario.attacker.card.instanceId]],
    })).toThrow()
    expect(() => applyGameCommand(declared, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: scenario.trap.instanceId,
      paymentIds: [scenario.trapPayment.instanceId],
      targetIds: [],
      effectTargets: [[scenario.defender.card.instanceId]],
    })).toThrow()
  })
})

describe('BS11-067 Black Raisin Cookie runtime', () => {
  it('keeps attack payment first, then pays 1B, moves itself, draws, and places a hand card on deck top', () => {
    const base = createBattleState()
    const attacker = candidate('BS11-067', 'attacker')
    const attackSupports = [
      item('BS11-067:attack-a', 'blue'),
      item('BS11-067:attack-b', 'blue'),
      item('BS11-067:then-payment', 'blue'),
    ]
    const oldHand = item('BS11-067:old-hand')
    const drawn = item('BS11-067:drawn')
    const deckTail = item('BS11-067:deck-tail')
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          hand: [oldHand],
          battleArea: [cookieEntry(attacker, [item('BS11-067:attacker-hp')])],
          supportArea: attackSupports.map((card) => ({ card, rested: false })),
          deck: [drawn, deckTail],
        },
      },
    }

    let current = applyGameCommand(state, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: attacker.instanceId,
      targetInstanceId: 'defender',
      supportPaymentIds: attackSupports.slice(0, 2).map((card) => card.instanceId),
    })
    current = applyGameCommand(current, { kind: 'skip-trap', playerId: 'player-one' })
    current = advanceDamage(current)
    expect(current.pendingBattle?.stage).toBe('attack-effect')

    current = applyGameCommand(current, {
      kind: 'resolve-attack-effect',
      playerId: 'player-two',
      targetIds: [],
    })
    expect(current.pendingOptionalCostAttack).toMatchObject({
      cost: { energy: { blue: 1 }, selfToDeckBottom: true },
    })

    current = applyGameCommand(current, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-two',
      action: 'pay',
      paymentIds: [attackSupports[2].instanceId],
    })
    expect(current.players['player-two'].battleArea).toHaveLength(0)
    expect(current.players['player-two'].deck.at(-1)).toEqual(attacker)
    expect(current.players['player-two'].hand).toEqual([oldHand, drawn])
    expect(current.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-two',
      count: 1,
      destination: 'deck-top',
    })

    current = applyGameCommand(current, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-two',
      cardIds: [oldHand.instanceId],
    })
    expect(current.players['player-two'].deck[0]).toEqual(oldHand)
    expect(current.players['player-two'].deck.at(-1)).toEqual(attacker)
    expect(current.pendingOpponentHandDiscard).toBeNull()
  })

  it('rejects paying the attack Then with no 1B support payment', () => {
    const base = createBattleState()
    const attacker = candidate('BS11-067', 'missing-then-payment')
    const attackSupports = [
      item('BS11-067:attack-a', 'blue'),
      item('BS11-067:attack-b', 'blue'),
    ]
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [cookieEntry(attacker, [item('BS11-067:hp')])],
          supportArea: attackSupports.map((card) => ({ card, rested: false })),
          hand: [item('BS11-067:hand')],
          deck: [item('BS11-067:deck')],
        },
      },
    }
    let current = applyGameCommand(state, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: attacker.instanceId,
      targetInstanceId: 'defender',
      supportPaymentIds: attackSupports.map((card) => card.instanceId),
    })
    expect(current.pendingBattle?.stage).toBe('trap')
    current = applyGameCommand(current, { kind: 'skip-trap', playerId: 'player-one' })
    current = advanceDamage(current)
    current = applyGameCommand(current, {
      kind: 'resolve-attack-effect',
      playerId: 'player-two',
      targetIds: [],
    })
    expect(() => applyGameCommand(current, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-two',
      action: 'pay',
      paymentIds: [],
    })).toThrow()
  })
})

describe('BS11-068 Black Sapphire Cookie faint runtime', () => {
  it('pays 1B and removes only the target Cookie top HP to its owner deck bottom', () => {
    const base = createBattleState()
    const source = candidate('BS11-068', 'source')
    const target = cookieEntry(
      cookie('BS11-068:target', 1, 2),
      [item('BS11-068:hp-bottom'), item('BS11-068:hp-top')],
      [item('BS11-068:equipped')],
    )
    const payment = item('BS11-068:payment', 'blue')
    const state: GameState = {
      ...base,
      activePlayerId: 'player-one',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [cookieEntry(source, [item('BS11-068:source-hp')])],
          supportArea: [{ card: payment, rested: false }],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [target],
          deck: [item('BS11-068:deck-existing')],
        },
      },
    }

    const afterDamage = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: source.instanceId },
      { kind: 'damage', amount: 1, target: { side: 'self', min: 1, max: 1 } },
      [source.instanceId],
    )
    expect(afterDamage.pendingFaintEffects?.[0]).toMatchObject({
      sourceInstanceId: source.instanceId,
      sourceEnergy: { blue: 1 },
      effect: { kind: 'field-to-deck-bottom', hpOnly: true },
    })
    expect(() => applyGameCommand(afterDamage, {
      kind: 'resolve-faint-effect',
      playerId: 'player-one',
      targetIds: [source.instanceId],
      paymentIds: [payment.instanceId],
    })).toThrow()
    expect(() => applyGameCommand(afterDamage, {
      kind: 'resolve-faint-effect',
      playerId: 'player-one',
      targetIds: [target.card.instanceId],
      paymentIds: [],
    })).toThrow()

    const resolved = applyGameCommand(afterDamage, {
      kind: 'resolve-faint-effect',
      playerId: 'player-one',
      targetIds: [target.card.instanceId],
      paymentIds: [payment.instanceId],
    })
    expect(resolved.players['player-one'].breakArea).toContainEqual(source)
    expect(resolved.players['player-two'].battleArea[0]?.card).toEqual(target.card)
    expect(resolved.players['player-two'].battleArea[0]?.hpCards).toEqual([target.hpCards[0]])
    expect(resolved.players['player-two'].battleArea[0]?.equippedCards).toEqual(target.equippedCards)
    expect(resolved.players['player-two'].deck.at(-1)).toEqual(target.hpCards[1])
    expect(resolved.players['player-two'].deck).not.toContainEqual(target.card)
    expect(resolved.pendingFaintEffects).toBeUndefined()
  })

  it('faints after the last HP is removed, even while a movement protector is present', () => {
    const base = createBattleState()
    const source = cookie('BS11-068:hp-only-source')
    const targetCard = cookie('BS11-068:one-hp-target', 1, 1)
    const target = cookieEntry(
      targetCard,
      [item('BS11-068:one-hp')],
      [item('BS11-068:one-hp-equipped')],
    )
    const movementProtector = {
      ...cookie('BS11-068:movement-protector'),
      skill: {
        trigger: 'passive' as const,
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'Opposing effects cannot move Cookies out of the battle area.',
        effects: [{ kind: 'prevent-opponent-battle-movement' as const }],
      },
    }
    const state: GameState = {
      ...base,
      activePlayerId: 'player-one',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [cookieEntry(source, [item('BS11-068:source-hp')])],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [target, cookieEntry(movementProtector, [item('BS11-068:protector-hp')])],
          deck: [item('BS11-068:one-hp-deck')],
        },
      },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: source.instanceId },
      {
        kind: 'field-to-deck-bottom',
        target: { side: 'opponent', min: 1, max: 1 },
        hpOnly: true,
      },
      [targetCard.instanceId],
    )

    expect(resolved.players['player-two'].battleArea).toHaveLength(1)
    expect(resolved.players['player-two'].battleArea[0]?.card).toEqual(movementProtector)
    expect(resolved.players['player-two'].breakArea).toContainEqual(targetCard)
    expect(resolved.players['player-two'].deck.at(-1)).toEqual(target.hpCards[0])
    expect(resolved.players['player-two'].discardPile).toContainEqual(target.equippedCards?.[0])
    expect(resolved.cookiesFaintedThisTurn?.['player-two']).toBe(1)
    expect(resolved.departedCookieCounts['player-two']).toBe(1)
  })
})
