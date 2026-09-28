import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/candidates/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { maskGameStateForViewer } from './masked-state'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'
import type { CookieInBattle, GameCard, GameState } from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, `bs11-sixteenth-runtime-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${cardNumber}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const entry = (card: GameCard, hpCount: number): CookieInBattle => ({
  card: card as CookieInBattle['card'],
  hpCards: Array.from({ length: hpCount }, (_, index) => item(`${card.instanceId}:hp-${index}`)),
  rested: false,
  battleEntryId: `${card.instanceId}:battle`,
})

describe('BS11-060 Hero Cookie BLUE MIX runtime', () => {
  it('accepts a red support card for the neutral one-energy attack', () => {
    const base = createBattleState()
    const hero = entry(candidate('BS11-060', 'hero'), 2)
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [hero],
          supportArea: [{ card: item('BS11-060:red-payment', 'red'), rested: false }],
        },
      },
    }

    const declared = applyGameCommand(state, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: hero.card.instanceId,
      targetInstanceId: 'defender',
      supportPaymentIds: ['BS11-060:red-payment'],
    })
    expect(declared.players['player-two'].supportArea[0]?.rested).toBe(true)
    expect(declared.pendingBattle?.attackerInstanceId).toBe(hero.card.instanceId)
  })
})

const makeCandyState = (withTarget: boolean): {
  state: GameState
  candy: CookieInBattle
  target: CookieInBattle
  paymentIds: string[]
} => {
  const base = createBattleState()
  const candy = entry(candidate('BS11-061', 'candy'), 3)
  const target = entry({ ...cookie('BS11-061:target', 1, 2), energyColor: 'blue' }, 2)
  const paymentIds = ['BS11-061:blue-a', 'BS11-061:blue-b']
  return {
    state: {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [],
          battleArea: [candy],
          supportArea: paymentIds.map((id) => ({ card: item(id, 'blue'), rested: false })),
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: withTarget ? [target] : [],
          deck: [item('BS11-061:deck-top'), item('BS11-061:deck-bottom')],
        },
      },
    },
    candy,
    target,
    paymentIds,
  }
}

describe('BS11-061 Candy Apple Cookie runtime', () => {
  it('pays 2B, moves the target HP top to the opponent deck bottom, and consumes Once Per Turn', () => {
    const scenario = makeCandyState(true)
    const pending = applyGameCommand(scenario.state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: scenario.candy.card.instanceId,
      trigger: 'activate',
      paymentIds: scenario.paymentIds,
    })
    const resolved = applyGameCommand(pending, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [scenario.target.card.instanceId],
    })

    expect(resolved.players['player-two'].battleArea[0]?.hpCards).toHaveLength(1)
    expect(resolved.players['player-two'].deck.at(-1)?.instanceId).toBe('BS11-061:target:hp-1')
    expect(resolved.skillUsesThisTurn).toContain(scenario.candy.battleEntryId)
    expect(canActivateCookieSkill(
      resolved,
      'player-one',
      scenario.candy.card.instanceId,
      'activate',
    )).toBe(false)
    expect(() => applyGameCommand(resolved, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: scenario.candy.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })).toThrow()
  })

  it('allows the up-to-one target to be skipped without moving any cards', () => {
    const scenario = makeCandyState(false)
    const deckBefore = [...scenario.state.players['player-two'].deck]
    const pending = applyGameCommand(scenario.state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: scenario.candy.card.instanceId,
      trigger: 'activate',
      paymentIds: scenario.paymentIds,
    })
    const resolved = applyGameCommand(pending, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })

    expect(resolved.players['player-two'].deck).toEqual(deckBefore)
    expect(resolved.skillUsesThisTurn).toContain(scenario.candy.battleEntryId)
  })
})

describe('BS11-062 Top of the Spire of Deceit runtime', () => {
  it('places for 2B, trashes itself on activation, and snapshots the opponent hand view', () => {
    const base = createBattleState()
    const stage = candidate('BS11-062', 'stage')
    const opponentHand = [item('BS11-062:opponent-hand-a'), item('BS11-062:opponent-hand-b')]
    const payments = [
      item('BS11-062:payment-a', 'blue'),
      item('BS11-062:payment-b', 'blue'),
    ]
    const state: GameState = {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [stage],
          supportArea: payments.map((card) => ({ card, rested: false })),
        },
        'player-two': {
          ...base.players['player-two'],
          hand: opponentHand,
        },
      },
    }

    const placed = applyGameCommand(state, {
      kind: 'play-stage',
      playerId: 'player-one',
      instanceId: stage.instanceId,
      paymentIds: payments.map((card) => card.instanceId),
    })
    const activated = applyGameCommand(placed, {
      kind: 'activate-stage',
      playerId: 'player-one',
      paymentIds: [],
    })

    expect(activated.players['player-one'].stage).toBeNull()
    expect(activated.players['player-one'].discardPile).toContainEqual(stage)
    expect(activated.handInspectionResults?.['player-one']).toMatchObject({
      sourceInstanceId: stage.instanceId,
      targetPlayerId: 'player-two',
      cards: opponentHand,
    })
    expect(maskGameStateForViewer(activated, 'player-two')).not.toHaveProperty('handInspectionResults')
  })
})

type SeaProtectionAlly = 'sea-fairy' | 'ancient' | 'none'

const makeSeaProtectionState = (ally: SeaProtectionAlly): {
  state: GameState
  trap: GameCard
  attacker: CookieInBattle
  trapPayment: GameCard
  drawCard: GameCard
} => {
  const base = createBattleState()
  const trap = candidate('BS11-063', `trap-${ally}`)
  const attacker = entry({ ...cookie(`BS11-063:${ally}:attacker`, 1, 3), energyColor: 'red' }, 1)
  const defender = entry({ ...cookie(`BS11-063:${ally}:defender`, 1, 3), energyColor: 'blue' }, 2)
  const allyCard = ally === 'sea-fairy'
    ? { ...cookie(`BS11-063:${ally}:ally`, 1, 3), name: 'Sea Fairy Cookie', energyColor: 'blue' as const }
    : ally === 'ancient'
      ? { ...cookie(`BS11-063:${ally}:ally`, 1, 3), keywords: ['ancient' as const], energyColor: 'blue' as const }
      : undefined
  const trapPayment = item(`BS11-063:${ally}:trap-payment`, 'blue')
  const attackPayment = item(`BS11-063:${ally}:attack-payment`, 'red')
  const drawCard = item(`BS11-063:${ally}:draw`)
  return {
    state: {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [trap],
          battleArea: [defender, ...(allyCard ? [entry(allyCard, 2)] : [])],
          supportArea: [{ card: trapPayment, rested: false }],
          deck: [drawCard, item(`BS11-063:${ally}:deck-extra`)],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [attacker],
          supportArea: [{ card: attackPayment, rested: false }],
        },
      },
    },
    trap,
    attacker,
    trapPayment,
    drawCard,
  }
}

describe('BS11-063 Sea\'s Protection runtime', () => {
  it.each([
    ['Sea Fairy Cookie', 'sea-fairy'],
    ['Ancient Cookie', 'ancient'],
  ] as const)('draws after -1 attack when %s is present', (_label, ally) => {
    const scenario = makeSeaProtectionState(ally)
    const declared = applyGameCommand(scenario.state, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: scenario.attacker.card.instanceId,
      targetInstanceId: scenario.state.players['player-one'].battleArea[0]!.card.instanceId,
      supportPaymentIds: [scenario.state.players['player-two'].supportArea[0]!.card.instanceId],
    })
    const played = applyGameCommand(declared, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: scenario.trap.instanceId,
      paymentIds: [scenario.trapPayment.instanceId],
      targetIds: [],
      effectTargets: [[scenario.attacker.card.instanceId]],
    })

    expect(played.attackModifiers).toContainEqual(expect.objectContaining({
      targetInstanceId: scenario.attacker.card.instanceId,
      amount: -1,
    }))
    expect(played.pendingDrawUpTo).toMatchObject({ max: 1, playerId: 'player-one' })
    const drawn = applyGameCommand(played, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 1,
    })
    expect(drawn.players['player-one'].hand).toContainEqual(scenario.drawCard)
  })

  it('keeps the attack reduction but skips the conditional draw without Sea Fairy or Ancient', () => {
    const scenario = makeSeaProtectionState('none')
    const declared = applyGameCommand(scenario.state, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: scenario.attacker.card.instanceId,
      targetInstanceId: scenario.state.players['player-one'].battleArea[0]!.card.instanceId,
      supportPaymentIds: [scenario.state.players['player-two'].supportArea[0]!.card.instanceId],
    })
    const played = applyGameCommand(declared, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: scenario.trap.instanceId,
      paymentIds: [scenario.trapPayment.instanceId],
      targetIds: [],
      effectTargets: [[scenario.attacker.card.instanceId]],
    })

    expect(played.attackModifiers).toContainEqual(expect.objectContaining({
      targetInstanceId: scenario.attacker.card.instanceId,
      amount: -1,
    }))
    expect(played.pendingDrawUpTo).toBeUndefined()
  })

  it('allows the opponent Cookie target to be skipped while still resolving the condition', () => {
    const scenario = makeSeaProtectionState('sea-fairy')
    const declared = applyGameCommand(scenario.state, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: scenario.attacker.card.instanceId,
      targetInstanceId: scenario.state.players['player-one'].battleArea[0]!.card.instanceId,
      supportPaymentIds: [scenario.state.players['player-two'].supportArea[0]!.card.instanceId],
    })
    const played = applyGameCommand(declared, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: scenario.trap.instanceId,
      paymentIds: [scenario.trapPayment.instanceId],
      targetIds: [],
      effectTargets: [[]],
    })

    expect(played.attackModifiers).not.toContainEqual(expect.objectContaining({
      targetInstanceId: scenario.attacker.card.instanceId,
      amount: -1,
    }))
    expect(played.pendingDrawUpTo).toMatchObject({ max: 1, playerId: 'player-one' })
  })
})
