import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { refreshDeck } from './refresh'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'
import type { CookieCard, CookieInBattle, GameCard, GameState } from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, `bs11-twentieth-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${cardNumber}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const cookieEntry = (
  card: GameCard,
  hpCards: GameCard[],
): CookieInBattle => {
  if (card.type !== 'cookie') throw new Error(`Expected Cookie: ${card.name}`)
  return {
    card: card as CookieCard,
    hpCards,
    rested: false,
    battleEntryId: `${card.instanceId}:battle`,
  }
}

describe('BS11-079 Espresso Cookie runtime', () => {
  it('pays two hand cards and deploys a purple Cookie from trash', () => {
    const base = createBattleState()
    const espresso = candidate('BS11-079', 'source')
    const purpleCookie = candidate('BS11-074', 'trash-purple')
    const discardCost = [item('BS11-079:discard-a'), item('BS11-079:discard-b')]
    const state: GameState = {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [espresso, ...discardCost],
          battleArea: [],
          deck: [
            item('BS11-079:hp-1'),
            item('BS11-079:hp-2'),
            item('BS11-079:trash-hp-1'),
            item('BS11-079:trash-hp-2'),
            item('BS11-079:deck-tail'),
          ],
          discardPile: [purpleCookie],
        },
      },
    }

    let current = applyGameCommand(state, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: espresso.instanceId,
    })
    expect(current.pendingOnPlay).toMatchObject({
      playerId: 'player-one',
      sourceInstanceId: espresso.instanceId,
    })

    current = applyGameCommand(current, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: espresso.instanceId,
      trigger: 'on-play',
      paymentIds: [],
      discardHandIds: discardCost.map((card) => card.instanceId),
    })
    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [purpleCookie.instanceId],
    })

    expect(current.pendingOnPlay).toBeNull()
    expect(current.players['player-one'].hand).toEqual([])
    expect(current.players['player-one'].discardPile).toEqual(discardCost)
    expect(current.players['player-one'].battleArea.map((entry) => entry.card.instanceId))
      .toEqual([espresso.instanceId, purpleCookie.instanceId])
    expect(current.players['player-one'].battleArea[1]?.hpCards).toEqual([
      item('BS11-079:trash-hp-1'),
      item('BS11-079:trash-hp-2'),
    ])
  })

  it('rejects a non-purple Cookie target from the trash', () => {
    const base = createBattleState()
    const espresso = candidate('BS11-079', 'wrong-color-source')
    const wrongColor = cookie('BS11-079:trash-red')
    const discardCost = [item('BS11-079:wrong-a'), item('BS11-079:wrong-b')]
    const state: GameState = {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [espresso, ...discardCost],
          battleArea: [],
          deck: [item('BS11-079:wrong-hp-1'), item('BS11-079:wrong-hp-2'), item('BS11-079:wrong-tail')],
          discardPile: [wrongColor],
        },
      },
    }
    let current = applyGameCommand(state, {
      kind: 'deploy-cookie', playerId: 'player-one', instanceId: espresso.instanceId,
    })
    current = applyGameCommand(current, {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: espresso.instanceId,
      trigger: 'on-play', paymentIds: [], discardHandIds: discardCost.map((card) => card.instanceId),
    })
    expect(() => applyGameCommand(current, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [wrongColor.instanceId],
    })).toThrow()
  })
})

describe('BS11-080 Banner of the Solitary Oath runtime', () => {
  const bannerState = (refreshCount: number): {
    state: GameState
    banner: GameCard
    target: CookieInBattle
    drawCard: GameCard
    payments: GameCard[]
  } => {
    const base = createBattleState()
    const banner = candidate('BS11-080', `banner-${refreshCount}`)
    const drawCard = item(`BS11-080:draw-${refreshCount}`)
    const target = cookieEntry(
      cookie(`BS11-080:target-${refreshCount}`, 1, 4),
      [
        item(`BS11-080:target-${refreshCount}:hp-1`),
        item(`BS11-080:target-${refreshCount}:hp-2`),
        item(`BS11-080:target-${refreshCount}:hp-3`),
        item(`BS11-080:target-${refreshCount}:hp-4`),
      ],
    )
    const payments = [
      item(`BS11-080:payment-a-${refreshCount}`, 'purple'),
      item(`BS11-080:payment-b-${refreshCount}`, 'purple'),
    ]
    return {
      state: {
        ...base,
        activePlayerId: 'player-one',
        phase: 'main',
        refreshCountDuringGame: { 'player-one': refreshCount },
        players: {
          ...base.players,
          'player-one': {
            ...base.players['player-one'],
            hand: [banner],
          deck: [drawCard, item(`BS11-080:deck-tail-${refreshCount}`)],
            supportArea: payments.map((card) => ({ card, rested: false })),
          },
          'player-two': {
            ...base.players['player-two'],
            battleArea: [target],
          },
        },
      },
      banner,
      target,
      drawCard,
      payments,
    }
  }

  it('requires two Refreshes, draws one card, then deals two damage to a selected Cookie', () => {
    const scenario = bannerState(2)
    const current = applyGameCommand(scenario.state, {
      kind: 'play-item',
      playerId: 'player-one',
      instanceId: scenario.banner.instanceId,
      paymentIds: scenario.payments.map((card) => card.instanceId),
      effectTargets: [[], [scenario.target.card.instanceId]],
    })
    expect(current.players['player-one'].hand).toContainEqual(scenario.drawCard)
    expect(current.players['player-two'].battleArea[0]?.hpCards).toHaveLength(2)
    expect(current.pendingAbilityEffect).toBeUndefined()
  })

  it('does not resolve either effect before the second Refresh', () => {
    const scenario = bannerState(1)
    const paid = applyGameCommand(scenario.state, {
      kind: 'play-item',
      playerId: 'player-one',
      instanceId: scenario.banner.instanceId,
      paymentIds: scenario.payments.map((card) => card.instanceId),
    })
    expect(paid.players['player-one'].hand).toEqual([])
    expect(paid.players['player-one'].deck).toHaveLength(2)
    expect(paid.players['player-two'].battleArea[0]?.hpCards).toHaveLength(4)
    expect(paid.pendingAbilityEffect).toBeUndefined()
  })
})

describe('BS11-081 Dream Traveler\'s Hourglass runtime', () => {
  it('returns both players\' discard piles to their own decks', () => {
    const base = createBattleState()
    const hourglass = candidate('BS11-081', 'hourglass')
    const p1Trash = item('BS11-081:p1-trash')
    const p2Trash = item('BS11-081:p2-trash')
    const p1Deck = item('BS11-081:p1-deck')
    const p2Deck = item('BS11-081:p2-deck')
    const payments = [item('BS11-081:payment-a', 'purple'), item('BS11-081:payment-b', 'purple')]
    const state: GameState = {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [hourglass],
          deck: [p1Deck],
          discardPile: [p1Trash],
          supportArea: payments.map((card) => ({ card, rested: false })),
        },
        'player-two': {
          ...base.players['player-two'],
          deck: [p2Deck],
          discardPile: [p2Trash],
        },
      },
    }
    const current = applyGameCommand(state, {
      kind: 'play-item',
      playerId: 'player-one',
      instanceId: hourglass.instanceId,
      paymentIds: payments.map((card) => card.instanceId),
    }, { shuffle: (cards) => [...cards] })
    expect(current.players['player-one'].discardPile).toEqual([])
    expect(current.players['player-two'].discardPile).toEqual([])
    expect(current.players['player-one'].deck).toHaveLength(3)
    expect(current.players['player-one'].deck).toEqual(expect.arrayContaining([p1Deck, p1Trash, hourglass]))
    expect(current.players['player-two'].deck).toEqual([p2Deck, p2Trash])
  })
})

describe('BS11-082 Moonlight\'s Protection runtime', () => {
  const trapState = (withMoonlight: boolean): {
    state: GameState
    trap: GameCard
    trapPayment: GameCard
    attacker: CookieInBattle
    handCard: GameCard
    attackPayment: GameCard
  } => {
    const base = createBattleState()
    const trap = candidate('BS11-082', withMoonlight ? 'trap-positive' : 'trap-negative')
    const moonlight = candidate('BS11-088', withMoonlight ? 'moonlight' : 'unused-moonlight')
    const defender = base.players['player-one'].battleArea[0]!
    const attacker = base.players['player-two'].battleArea[0]!
    const trapPayment = item(`BS11-082:trap-payment-${withMoonlight}`, 'purple')
    const attackPayment = item(`BS11-082:attack-payment-${withMoonlight}`, 'red')
    const handCard = item(`BS11-082:opponent-hand-${withMoonlight}`)
    return {
      state: {
        ...base,
        players: {
          ...base.players,
          'player-one': {
            ...base.players['player-one'],
            battleArea: withMoonlight
              ? [cookieEntry(moonlight, [item('BS11-082:moonlight-hp')]), defender]
              : [defender],
            hand: [trap],
            supportArea: [{ card: trapPayment, rested: false }],
          },
          'player-two': {
            ...base.players['player-two'],
            hand: [handCard],
            supportArea: [{ card: attackPayment, rested: false }],
          },
        },
      },
      trap,
      trapPayment,
      attacker,
      handCard,
      attackPayment,
    }
  }

  it('reduces the attacker and then makes the opponent discard when Moonlight is present', () => {
    const scenario = trapState(true)
    const declared = applyGameCommand(scenario.state, {
      kind: 'declare-attack', playerId: 'player-two',
      attackerInstanceId: scenario.attacker.card.instanceId,
      targetInstanceId: scenario.state.players['player-one'].battleArea[1]!.card.instanceId,
      supportPaymentIds: [scenario.attackPayment.instanceId],
    })
    let current = applyGameCommand(declared, {
      kind: 'play-trap', playerId: 'player-one', trapInstanceId: scenario.trap.instanceId,
      paymentIds: [scenario.trapPayment.instanceId], targetIds: [],
      effectTargets: [[scenario.attacker.card.instanceId]],
    })
    expect(current.attackModifiers).toContainEqual(expect.objectContaining({
      targetInstanceId: scenario.attacker.card.instanceId,
      amount: -1,
    }))
    if (current.pendingAbilityEffect) {
      current = applyGameCommand(current, {
        kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [],
      })
    }
    expect(current.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-two', count: 1, destination: 'trash',
    })
    current = applyGameCommand(current, {
      kind: 'resolve-opponent-hand-discard', playerId: 'player-two',
      cardIds: [scenario.handCard.instanceId],
    })
    expect(current.players['player-two'].hand).toEqual([])
    expect(current.players['player-two'].discardPile).toContainEqual(scenario.handCard)
  })

  it('does not discard a hand card when neither Moonlight nor Ancient is present', () => {
    const scenario = trapState(false)
    const declared = applyGameCommand(scenario.state, {
      kind: 'declare-attack', playerId: 'player-two',
      attackerInstanceId: scenario.attacker.card.instanceId,
      targetInstanceId: scenario.state.players['player-one'].battleArea[0]!.card.instanceId,
      supportPaymentIds: [scenario.attackPayment.instanceId],
    })
    const current = applyGameCommand(declared, {
      kind: 'play-trap', playerId: 'player-one', trapInstanceId: scenario.trap.instanceId,
      paymentIds: [scenario.trapPayment.instanceId], targetIds: [],
      effectTargets: [[scenario.attacker.card.instanceId]],
    })
    expect(current.attackModifiers).toContainEqual(expect.objectContaining({
      targetInstanceId: scenario.attacker.card.instanceId,
      amount: -1,
    }))
    expect(current.pendingOpponentHandDiscard).toBeUndefined()
    expect(current.players['player-two'].hand).toEqual([scenario.handCard])
  })
})

describe('BS11-083 Catacombs of Lost Solidarity runtime', () => {
  const stageState = (refreshed: boolean): {
    state: GameState
    stage: GameCard
    placementPayment: GameCard
    activationPayment: GameCard
    replacementPayment: GameCard
    onPlayCookie: GameCard
    handCard: GameCard
  } => {
    const base = createBattleState()
    const stage = candidate('BS11-083', refreshed ? 'stage-refreshed' : 'stage-unrefreshed')
    const onPlayCookie = candidate('BS11-079', refreshed ? 'replacement-cookie' : 'unreplaced-cookie')
    const placementPayment = item(`BS11-083:placement-${refreshed}`, 'purple')
    const activationPayment = item(`BS11-083:activation-${refreshed}`, 'purple')
    const replacementPayment = item(`BS11-083:replacement-${refreshed}`, 'red')
    const handCard = item(`BS11-083:opponent-hand-${refreshed}`)
    return {
      state: {
        ...base,
        activePlayerId: 'player-one',
        phase: 'main',
        refreshedDuringGame: refreshed ? { 'player-one': true } : {},
        players: {
          ...base.players,
          'player-one': {
          ...base.players['player-one'],
            hand: [stage, handCard],
            battleArea: [],
            supportArea: [{ card: placementPayment, rested: false }, { card: activationPayment, rested: false }],
            stage: null,
          },
          'player-two': {
          ...base.players['player-two'],
            hand: [],
            battleArea: [cookieEntry(onPlayCookie, [item(`BS11-083:on-play-hp-${refreshed}`)])],
            supportArea: [{ card: replacementPayment, rested: false }],
          },
        },
      },
      stage,
      placementPayment,
      activationPayment,
      replacementPayment,
      onPlayCookie,
      handCard,
    }
  }

  it('after Refresh, replaces the opponent On Play with a paid hand discard', () => {
    const scenario = stageState(true)
    let current = applyGameCommand(scenario.state, {
      kind: 'play-stage', playerId: 'player-one', instanceId: scenario.stage.instanceId,
      paymentIds: [scenario.placementPayment.instanceId],
    })
    current = applyGameCommand(current, {
      kind: 'begin-activate-stage', playerId: 'player-one',
      paymentIds: [scenario.activationPayment.instanceId],
    })
    expect(current.players['player-one'].stage).toBeNull()
    expect(current.players['player-one'].discardPile).toContainEqual(scenario.stage)
    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [],
    })
    expect(current.onPlayReplacementUntilTurn?.['player-two']).toMatchObject({
      turn: current.turnNumber,
      cost: { energy: { neutral: 1 }, discardHand: 0 },
      effects: [{ kind: 'opponent-discard-hand', count: 1, destination: 'trash' }],
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
      kind: 'begin-activate-skill', playerId: 'player-two',
      sourceInstanceId: scenario.onPlayCookie.instanceId, trigger: 'on-play',
      paymentIds: [scenario.replacementPayment.instanceId],
    })
    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect', playerId: 'player-two', targetIds: [],
    })
    expect(current.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-one', count: 1, destination: 'trash',
    })
    current = applyGameCommand(current, {
      kind: 'resolve-opponent-hand-discard', playerId: 'player-one',
      cardIds: [scenario.handCard.instanceId],
    })
    expect(current.players['player-one'].hand).toEqual([])
    expect(current.players['player-one'].discardPile).toContainEqual(scenario.handCard)
  })

  it('does not create the replacement before Refresh, while still paying the stage activation', () => {
    const scenario = stageState(false)
    let current = applyGameCommand(scenario.state, {
      kind: 'play-stage', playerId: 'player-one', instanceId: scenario.stage.instanceId,
      paymentIds: [scenario.placementPayment.instanceId],
    })
    current = applyGameCommand(current, {
      kind: 'begin-activate-stage', playerId: 'player-one',
      paymentIds: [scenario.activationPayment.instanceId],
    })
    expect(current.players['player-one'].stage).toBeNull()
    expect(current.players['player-one'].discardPile).toContainEqual(scenario.stage)
    expect(current.onPlayReplacementUntilTurn?.['player-two']).toBeUndefined()
    expect(current.pendingAbilityEffect).toBeUndefined()
  })
})

describe('BS11 Refresh count tracking', () => {
  it('increments the source player count when a Refresh completes', () => {
    const base = createBattleState()
    const refreshCookie = cookie('BS11-refresh-cookie', 1, 1)
    const trashCard = item('BS11-refresh-trash')
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          deck: [],
          discardPile: [refreshCookie, trashCard],
        },
      },
    }
    const refreshed = refreshDeck(state, 'player-one', refreshCookie.instanceId, (cards) => [...cards])
    expect(refreshed.refreshCountDuringGame?.['player-one']).toBe(1)
    expect(refreshed.refreshedDuringGame?.['player-one']).toBe(true)
    expect(refreshed.players['player-one'].breakArea).toContainEqual(refreshCookie)
    expect(refreshed.players['player-one'].deck).toEqual([trashCard])
  })
})
