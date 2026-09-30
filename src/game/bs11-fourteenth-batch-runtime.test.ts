import { describe, expect, it } from 'vitest'
import bs11 from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { executeCardEffect } from './effects'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'
import type { CookieInBattle, GameCard, GameState } from './types'

const records = bs11.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, `bs11-fourteenth-runtime-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${cardNumber}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const entry = (
  card: GameCard,
  hpCount: number,
  rested = false,
): CookieInBattle => ({
  card: card as CookieInBattle['card'],
  hpCards: Array.from({ length: hpCount }, (_, index) => item(`${card.instanceId}:hp-${index}`)),
  rested,
  battleEntryId: `${card.instanceId}:battle`,
})

const cookieHp = (card: GameCard): number => card.type === 'cookie' ? card.hp : 1

const reachAttackEffect = (state: GameState, attacker: CookieInBattle, target: CookieInBattle, paymentIds: string[]) => {
  let current = applyGameCommand(state, {
    kind: 'declare-attack',
    playerId: 'player-one',
    attackerInstanceId: attacker.card.instanceId,
    targetInstanceId: target.card.instanceId,
    supportPaymentIds: paymentIds,
  })

  for (let step = 0; step < 20 && current.pendingBattle?.stage !== 'attack-effect'; step += 1) {
    if (current.pendingReplacement) {
      current = applyGameCommand(current, {
        kind: 'skip-replacement',
        playerId: current.pendingReplacement.tasks[0]!.playerId,
      })
    } else if (current.pendingBattle?.stage === 'trap') {
      current = applyGameCommand(current, {
        kind: 'skip-trap',
        playerId: current.pendingBattle.defenderPlayerId,
      })
    } else if (current.pendingBattle?.stage === 'damage') {
      current = applyGameCommand(current, {
        kind: 'resolve-next-damage',
        playerId: current.pendingBattle.defenderPlayerId,
      })
    } else {
      break
    }
  }

  expect(current.pendingBattle?.stage).toBe('attack-effect')
  return current
}

const makeAttackState = (
  cardNumber: 'BS11-050' | 'BS11-051' | 'BS11-052' | 'BS11-053',
  opponentHp: number,
  ownSupportCount: number,
  opponentSupportCount: number,
): { state: GameState; attacker: CookieInBattle; target: CookieInBattle; ownSupports: GameCard[]; opponentSupports: GameCard[] } => {
  const base = createBattleState()
  const attackerCard = candidate(cardNumber, 'attacker')
  const attacker = entry(attackerCard, cookieHp(attackerCard))
  const targetCard = cookie(`${cardNumber}:target`, 1, opponentHp)
  const target = entry(targetCard, opponentHp)
  const ownSupports = Array.from({ length: ownSupportCount }, (_, index) => item(`${cardNumber}:own-support-${index}`, 'green'))
  const opponentSupports = Array.from({ length: opponentSupportCount }, (_, index) => item(`${cardNumber}:opponent-support-${index}`, 'red'))

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
          battleArea: [attacker],
          supportArea: ownSupports.map((card) => ({ card, rested: false })),
          discardPile: [],
          deck: [item(`${cardNumber}:deck-a`, 'red'), item(`${cardNumber}:deck-b`, 'red')],
        },
        'player-two': {
          ...base.players['player-two'],
          hand: [],
          battleArea: [target],
          supportArea: opponentSupports.map((card) => ({ card, rested: false })),
          discardPile: [],
        },
      },
    },
    attacker,
    target,
    ownSupports,
    opponentSupports,
  }
}

describe('BS11-050 Cloud Haetae Cookie runtime', () => {
  it('pays the optional G Then, trashes itself, and places the deck top rested when behind on support', () => {
    const scenario = makeAttackState('BS11-050', 3, 2, 3)
    const opened = reachAttackEffect(
      scenario.state,
      scenario.attacker,
      scenario.target,
      [scenario.ownSupports[0]!.instanceId],
    )
    const paid = applyGameCommand(opened, {
      kind: 'resolve-attack-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(paid.pendingOptionalCostAttack).toMatchObject({
      cost: { energy: { green: 1 } },
      effects: [
        { kind: 'deck-to-support', amount: 1, rested: true },
      ],
    })

    const resolved = applyGameCommand(paid, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'pay',
      paymentIds: [scenario.ownSupports[1]!.instanceId],
      targetIds: [],
    })
    expect(resolved.players['player-one'].battleArea).toHaveLength(0)
    expect(resolved.players['player-one'].discardPile.map((card) => card.instanceId))
      .toContain(scenario.attacker.card.instanceId)
    expect(resolved.players['player-one'].supportArea).toContainEqual({
      card: expect.objectContaining({ instanceId: 'BS11-050:deck-a' }),
      rested: true,
    })
    expect(resolved.pendingBattle).toBeNull()
  })
})

describe('BS11-053 attack Then runtime', () => {
  it('opens a skippable self-trash cost before placing the deck top as rested support', () => {
    const scenario = makeAttackState('BS11-053', 5, 3, 4)
    const opened = reachAttackEffect(
      scenario.state,
      scenario.attacker,
      scenario.target,
      scenario.ownSupports.slice(0, 3).map((card) => card.instanceId),
    )
    const awaitingCost = applyGameCommand(opened, {
      kind: 'resolve-attack-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(awaitingCost.pendingOptionalCostAttack).toMatchObject({
      cost: { energy: {}, discardHand: 0, selfToTrash: true },
      effects: [{ kind: 'deck-to-support', amount: 1, rested: true }],
    })

    const resolved = applyGameCommand(awaitingCost, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'pay',
      paymentIds: [],
      targetIds: [],
    })
    expect(resolved.players['player-one'].battleArea).toHaveLength(0)
    expect(resolved.players['player-one'].discardPile.map((card) => card.instanceId))
      .toContain(scenario.attacker.card.instanceId)
    expect(resolved.players['player-one'].supportArea).toContainEqual({
      card: expect.objectContaining({ instanceId: 'BS11-053:deck-a' }),
      rested: true,
    })
    expect(resolved.pendingBattle).toBeNull()
  })
})

describe('BS11-051 Mercurial Knight Cookie runtime', () => {
  it('opens the up-to-two active-support choice only after this attack faints an opponent Cookie', () => {
    const scenario = makeAttackState('BS11-051', 1, 7, 1)
    const attackPaymentIds = scenario.ownSupports.slice(0, 3).map((card) => card.instanceId)
    const opened = reachAttackEffect(scenario.state, scenario.attacker, scenario.target, attackPaymentIds)
    expect(opened.cookiesFaintedThisTurn?.['player-two']).toBe(1)

    const resolved = applyGameCommand(opened, {
      kind: 'resolve-attack-effect',
      playerId: 'player-one',
      targetIds: [scenario.ownSupports[0]!.instanceId, scenario.ownSupports[1]!.instanceId],
    })
    expect(resolved.players['player-one'].supportArea
      .filter(({ card }) => [scenario.ownSupports[0]!.instanceId, scenario.ownSupports[1]!.instanceId].includes(card.instanceId))
      .every(({ rested }) => !rested)).toBe(true)
    expect(resolved.pendingBattle).toBeNull()
  })
})

describe('BS11-052 Wind Archer Cookie runtime', () => {
  it('discards a green Item, resolves one damage target, and continues into the hand-gated draw', () => {
    const scenario = makeAttackState('BS11-052', 5, 3, 1)
    const discardItem = item('BS11-052:discard-item', 'green')
    const state: GameState = {
      ...scenario.state,
      players: {
        ...scenario.state.players,
        'player-one': {
          ...scenario.state.players['player-one'],
          hand: [discardItem],
          deck: [item('BS11-052:draw-a'), item('BS11-052:draw-b'), item('BS11-052:draw-c')],
        },
      },
    }
    const opened = reachAttackEffect(
      state,
      scenario.attacker,
      scenario.target,
      scenario.ownSupports.map((card) => card.instanceId),
    )
    const awaitingPayment = applyGameCommand(opened, {
      kind: 'resolve-attack-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    const afterDiscardAndDamage = applyGameCommand(awaitingPayment, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'pay',
      discardCardIds: [discardItem.instanceId],
      targetIds: [scenario.target.card.instanceId],
    })
    expect(afterDiscardAndDamage.players['player-one'].hand).toHaveLength(0)
    expect(afterDiscardAndDamage.players['player-one'].discardPile.map((card) => card.instanceId))
      .toContain(discardItem.instanceId)
    expect(afterDiscardAndDamage.players['player-two'].battleArea[0]!.hpCards).toHaveLength(2)
    expect(afterDiscardAndDamage.pendingDrawUpTo).toMatchObject({ max: 2, playerId: 'player-one' })

    const resolved = applyGameCommand(afterDiscardAndDamage, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 2,
    })
    expect(resolved.players['player-one'].hand.map((card) => card.instanceId))
      .toEqual(['BS11-052:draw-a', 'BS11-052:draw-b'])
    expect(resolved.pendingBattle).toBeNull()
  })

  it('checks the draw threshold after discarding from six cards to five', () => {
    const scenario = makeAttackState('BS11-052', 5, 3, 1)
    const discardItem = item('BS11-052:threshold-discard', 'green')
    const fillers = Array.from({ length: 5 }, (_, index) => item(`BS11-052:threshold-hand-${index}`))
    const state: GameState = {
      ...scenario.state,
      players: {
        ...scenario.state.players,
        'player-one': {
          ...scenario.state.players['player-one'],
          hand: [discardItem, ...fillers],
        },
      },
    }
    const opened = reachAttackEffect(
      state,
      scenario.attacker,
      scenario.target,
      scenario.ownSupports.map((card) => card.instanceId),
    )
    const awaitingPayment = applyGameCommand(opened, {
      kind: 'resolve-attack-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    const resolved = applyGameCommand(awaitingPayment, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'pay',
      discardCardIds: [discardItem.instanceId],
      targetIds: [scenario.target.card.instanceId],
    })

    expect(resolved.players['player-one'].hand).toHaveLength(5)
    expect(resolved.pendingDrawUpTo).toMatchObject({ max: 2, playerId: 'player-one' })
  })
})

describe('BS11-053 Mystic Flour Cookie runtime', () => {
  it('pays G once per turn and removes HP only from opponent Cookies at five or more remaining HP', () => {
    const base = createBattleState()
    const source = candidate('BS11-053', 'source')
    const payment = item('BS11-053:payment', 'green')
    const eligible = entry(cookie('BS11-053:eligible', 1, 5), 5)
    const ineligible = entry(cookie('BS11-053:ineligible', 1, 4), 4)
    const state: GameState = {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [],
          battleArea: [entry(source, cookieHp(source))],
          supportArea: [{ card: payment, rested: false }],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [eligible, ineligible],
        },
      },
    }

    const activated = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
      trigger: 'activate',
      paymentIds: [payment.instanceId],
    })
    expect(activated.pendingAbilityEffect?.effects).toMatchObject([{
      kind: 'hp-to-trash-all',
      target: { minRemainingHp: 5 },
    }])

    const resolved = applyGameCommand(activated, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(resolved.players['player-two'].battleArea.find((cookieInBattle) => cookieInBattle.card.instanceId === eligible.card.instanceId)?.hpCards)
      .toHaveLength(4)
    expect(resolved.players['player-two'].battleArea.find((cookieInBattle) => cookieInBattle.card.instanceId === ineligible.card.instanceId)?.hpCards)
      .toHaveLength(4)
    expect(resolved.pendingAbilityEffect).toBeUndefined()
    expect(resolved.players['player-one'].supportArea[0]!.rested).toBe(true)
  })

  it('preserves the legacy no-target hp-to-trash-all path for older cards', () => {
    const base = createBattleState()
    const first = entry(cookie('legacy-hp-all-a', 1, 3), 3)
    const second = entry(cookie('legacy-hp-all-b', 1, 2), 2)
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [first, second],
        },
      },
    }
    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'defender' },
      { kind: 'hp-to-trash-all', amount: 1, side: 'opponent' },
      [],
    )
    expect(resolved.players['player-two'].battleArea.map((cookieInBattle) => cookieInBattle.hpCards.length))
      .toEqual([2, 1])
  })
})
