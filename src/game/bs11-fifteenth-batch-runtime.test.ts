import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { getAttackResponseSkillCandidates } from './battle'
import { canActivateCookieSkill } from './skills'
import { advancePhase } from './turn'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'
import type { CookieInBattle, GameCard, GameState } from './types'

const records = bs11CandidateDocument.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, `bs11-fifteenth-runtime-${suffix}`)
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

const advanceToPlayerTwoMain = (state: GameState): GameState => {
  let next = state
  for (let index = 0; index < 5; index += 1) next = advancePhase(next)
  return next
}

type NetScenario = {
  state: GameState
  net: GameCard
  target: CookieInBattle
  defender: CookieInBattle
  discardA: GameCard
  discardB: GameCard
  supports: GameCard[]
}

const makeNetScenario = (): NetScenario => {
  const base = createBattleState()
  const net = candidate('BS11-054', 'net')
  const target = entry(candidate('BS11-055', 'target'), 2)
  const defender = entry(cookie('net-defender', 1, 3), 3)
  const discardA = item('BS11-054:discard-a')
  const discardB = item('BS11-054:discard-b')
  const supports = [
    item('BS11-054:support-a', 'red'),
    item('BS11-054:support-b', 'green'),
    item('BS11-054:support-c', 'purple'),
  ]

  return {
    state: {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [net],
          deck: Array.from({ length: 8 }, (_, index) => item(`BS11-054:deck-${index}`)),
          battleArea: [defender],
          supportArea: [],
          discardPile: [],
        },
        'player-two': {
          ...base.players['player-two'],
          hand: [discardA, discardB],
          deck: Array.from({ length: 4 }, (_, index) => item(`BS11-054:opponent-deck-${index}`)),
          battleArea: [target],
          supportArea: supports.map((card) => ({ card, rested: false })),
          discardPile: [],
        },
      },
    },
    net,
    target,
    defender,
    discardA,
    discardB,
    supports,
  }
}

describe('BS11-054 Net Cookie runtime', () => {
  it('selects one opponent Cookie on play and requires two cards before its attack', () => {
    const scenario = makeNetScenario()
    const deployed = applyGameCommand(scenario.state, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: scenario.net.instanceId,
    })
    expect(deployed.pendingOnPlay).toMatchObject({
      playerId: 'player-one',
      sourceInstanceId: scenario.net.instanceId,
    })

    const pending = applyGameCommand(deployed, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: scenario.net.instanceId,
      trigger: 'on-play',
      paymentIds: [],
    })
    const marked = applyGameCommand(pending, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [scenario.target.card.instanceId],
    })
    expect(marked.cookieAttackDiscardRequirements).toMatchObject({
      'player-two': [{
        cookieInstanceId: scenario.target.card.instanceId,
        count: 2,
        expiresAfterTurn: marked.turnNumber + 1,
      }],
    })
    const opponentMain = advanceToPlayerTwoMain(marked)
    const insufficientHand: GameState = {
      ...opponentMain,
      players: {
        ...opponentMain.players,
        'player-two': {
          ...opponentMain.players['player-two'],
          hand: [scenario.discardA],
        },
      },
    }
    expect(() => applyGameCommand(insufficientHand, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: scenario.target.card.instanceId,
      targetInstanceId: scenario.defender.card.instanceId,
      supportPaymentIds: scenario.supports.map((card) => card.instanceId),
    })).toThrow('無法宣告攻擊')

    const pendingDiscard = applyGameCommand(opponentMain, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: scenario.target.card.instanceId,
      targetInstanceId: scenario.defender.card.instanceId,
      supportPaymentIds: scenario.supports.map((card) => card.instanceId),
    })
    expect(pendingDiscard.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-two',
      count: 2,
      sourceInstanceId: scenario.net.instanceId,
      attackDeclaration: {
        attackerInstanceId: scenario.target.card.instanceId,
      },
    })

    const resumed = applyGameCommand(pendingDiscard, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-two',
      cardIds: [scenario.discardA.instanceId, scenario.discardB.instanceId],
    })
    expect(resumed.pendingOpponentHandDiscard).toBeNull()
    expect(resumed.pendingBattle?.stage).toBe('trap')
    expect(resumed.players['player-two'].discardPile).toEqual(
      expect.arrayContaining([scenario.discardA, scenario.discardB]),
    )
    expect(resumed.players['player-two'].battleArea[0]?.rested).toBe(true)
  })

  it('expires after the targeted Cookie controller completes the next turn', () => {
    const scenario = makeNetScenario()
    const deployed = applyGameCommand(scenario.state, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: scenario.net.instanceId,
    })
    const marked = applyGameCommand(
      applyGameCommand(deployed, {
        kind: 'begin-activate-skill',
        playerId: 'player-one',
        sourceInstanceId: scenario.net.instanceId,
        trigger: 'on-play',
        paymentIds: [],
      }),
      {
        kind: 'resolve-ability-effect',
        playerId: 'player-one',
        targetIds: [scenario.target.card.instanceId],
      },
    )
    const opponentEnd = advancePhase(advanceToPlayerTwoMain(marked))
    const playerOneActive = advancePhase(opponentEnd)
    expect(playerOneActive.activePlayerId).toBe('player-one')
    expect(playerOneActive.cookieAttackDiscardRequirements).toEqual({})
  })
})

describe('BS11-055 Menthol Cookie runtime', () => {
  it('pays its BLUE MIX NNN attack with any three active support cards', () => {
    const base = createBattleState()
    const menthol = candidate('BS11-055', 'attacker')
    const supports = [
      item('BS11-055:support-red', 'red'),
      item('BS11-055:support-green', 'green'),
      item('BS11-055:support-purple', 'purple'),
    ]
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [entry(menthol, 2)],
          supportArea: supports.map((card) => ({ card, rested: false })),
        },
      },
    }

    const declared = applyGameCommand(state, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: menthol.instanceId,
      targetInstanceId: 'defender',
      supportPaymentIds: supports.map((card) => card.instanceId),
    })
    expect(declared.pendingBattle).toMatchObject({
      stage: 'trap',
      declaredDamage: 4,
    })
    expect(declared.players['player-two'].supportArea.every(({ rested }) => rested)).toBe(true)
  })
})

describe('BS11-056 Soda Dollop runtime', () => {
  const makeState = (withCreamSoda: boolean): {
    state: GameState
    soda: GameCard
    drawCard: GameCard
  } => {
    const base = createBattleState()
    const soda = candidate('BS11-056', 'soda')
    const creamSoda = candidate('BS11-058', 'cream-condition')
    const drawCard = item('BS11-056:draw')
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
            deck: [drawCard, item('BS11-056:deck-extra')],
            battleArea: [
              entry(soda, 1),
              ...(withCreamSoda ? [entry(creamSoda, 5)] : []),
            ],
            supportArea: [],
          },
        },
      },
      soda,
      drawCard,
    }
  }

  it('draws up to one only with Cream Soda Cookie present and then locks once per turn', () => {
    const scenario = makeState(true)
    expect(canActivateCookieSkill(
      scenario.state,
      'player-one',
      scenario.soda.instanceId,
      'activate',
    )).toBe(true)

    let resolved = applyGameCommand(scenario.state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: scenario.soda.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })
    resolved = applyGameCommand(resolved, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(resolved.pendingDrawUpTo).toMatchObject({ max: 1, playerId: 'player-one' })
    resolved = applyGameCommand(resolved, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 1,
    })

    expect(resolved.players['player-one'].hand).toContainEqual(scenario.drawCard)
    expect(canActivateCookieSkill(
      resolved,
      'player-one',
      scenario.soda.instanceId,
      'activate',
    )).toBe(false)
  })

  it('rejects activation when the named Cream Soda Cookie condition is absent', () => {
    const scenario = makeState(false)
    expect(canActivateCookieSkill(
      scenario.state,
      'player-one',
      scenario.soda.instanceId,
      'activate',
    )).toBe(false)
    expect(() => applyGameCommand(scenario.state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: scenario.soda.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })).toThrow()
  })
})

describe('BS11-057 Custard Cookie III FLIP runtime', () => {
  it('opens the real FLIP window and draws up to one card after activation', () => {
    const base = createBattleState()
    const flip = candidate('BS11-057', 'flip')
    const drawCard = item('BS11-057:draw')
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          deck: [drawCard, item('BS11-057:deck-extra')],
          battleArea: [{
            ...base.players['player-one'].battleArea[0]!,
            hpCards: [item('BS11-057:hp-bottom'), flip],
          }],
        },
      },
    }

    let current = applyGameCommand(state, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: 'attacker',
      targetInstanceId: 'defender',
      supportPaymentIds: ['p2-support'],
    })
    current = applyGameCommand(current, { kind: 'skip-trap', playerId: 'player-one' })
    current = applyGameCommand(current, { kind: 'resolve-next-damage', playerId: 'player-one' })
    expect(current.pendingBattle?.stage).toBe('flip')

    current = applyGameCommand(current, {
      kind: 'resolve-flip',
      playerId: 'player-one',
      activate: true,
    })
    expect(current.pendingDrawUpTo).toMatchObject({ max: 1, playerId: 'player-one' })
    current = applyGameCommand(current, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 1,
    })
    expect(current.players['player-one'].hand).toContainEqual(drawCard)
    expect(current.players['player-one'].discardPile).toContainEqual(flip)
  })
})

type CreamAttackScenario = {
  state: GameState
  cream: CookieInBattle
  ally: CookieInBattle
  discardA: GameCard
  discardB: GameCard
}

const makeCreamAttackScenario = (): CreamAttackScenario => {
  const base = createBattleState()
  const cream = entry(candidate('BS11-058', 'cream'), 5)
  const ally = entry(cookie('BS11-058:ally', 1, 3), 2)
  const discardA = item('BS11-058:discard-a')
  const discardB = item('BS11-058:discard-b')
  return {
    state: {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [discardA, discardB],
          battleArea: [cream, ally],
          discardPile: [],
        },
      },
    },
    cream,
    ally,
    discardA,
    discardB,
  }
}

describe('BS11-058 Cream Soda Cookie runtime', () => {
  it('pays two hand cards in the opponent-attack window and adds one HP to a selected ally', () => {
    const scenario = makeCreamAttackScenario()
    const declared = applyGameCommand(scenario.state, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: 'attacker',
      targetInstanceId: scenario.cream.card.instanceId,
      supportPaymentIds: ['p2-support'],
    })
    expect(getAttackResponseSkillCandidates(declared, 'player-one')).toContainEqual(scenario.cream)

    let resolved = applyGameCommand(declared, {
      kind: 'play-attack-response',
      playerId: 'player-one',
      sourceInstanceId: scenario.cream.card.instanceId,
      discardHandIds: [scenario.discardA.instanceId, scenario.discardB.instanceId],
      trashToDeckIds: [],
    })
    expect(resolved.pendingAbilityEffect?.effects[0]).toMatchObject({ kind: 'gain-hp', amount: 1 })
    resolved = applyGameCommand(resolved, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [scenario.ally.card.instanceId],
    })
    expect(resolved.players['player-one'].battleArea.find(
      (entryInBattle) => entryInBattle.card.instanceId === scenario.ally.card.instanceId,
    )?.hpCards).toHaveLength(3)
    expect(resolved.players['player-one'].discardPile).toEqual(
      expect.arrayContaining([scenario.discardA, scenario.discardB]),
    )
    const secondPaymentHand = [
      item('BS11-058:once-payment-a'),
      item('BS11-058:once-payment-b'),
    ]
    const otherwiseLegal = (state: GameState): GameState => ({
      ...state,
      players: {
        ...state.players,
        'player-one': { ...state.players['player-one'], hand: secondPaymentHand },
      },
    })
    expect(getAttackResponseSkillCandidates(otherwiseLegal(declared), 'player-one')).toContainEqual(scenario.cream)
    expect(getAttackResponseSkillCandidates(otherwiseLegal(resolved), 'player-one')).toEqual([])
  })

  it('allows selecting zero Cookies after paying two cards, and hides the response with one card', () => {
    const scenario = makeCreamAttackScenario()
    const declared = applyGameCommand(scenario.state, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: 'attacker',
      targetInstanceId: scenario.cream.card.instanceId,
      supportPaymentIds: ['p2-support'],
    })
    const paid = applyGameCommand(declared, {
      kind: 'play-attack-response',
      playerId: 'player-one',
      sourceInstanceId: scenario.cream.card.instanceId,
      discardHandIds: [scenario.discardA.instanceId, scenario.discardB.instanceId],
      trashToDeckIds: [],
    })
    const skippedTarget = applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(skippedTarget.players['player-one'].battleArea.find(
      (entryInBattle) => entryInBattle.card.instanceId === scenario.ally.card.instanceId,
    )?.hpCards).toHaveLength(2)

    const insufficient = {
      ...declared,
      players: {
        ...declared.players,
        'player-one': {
          ...declared.players['player-one'],
          hand: [scenario.discardA],
        },
      },
    }
    expect(getAttackResponseSkillCandidates(insufficient, 'player-one')).toEqual([])
    expect(() => applyGameCommand(insufficient, {
      kind: 'play-attack-response',
      playerId: 'player-one',
      sourceInstanceId: scenario.cream.card.instanceId,
      discardHandIds: [scenario.discardA.instanceId],
      trashToDeckIds: [],
    })).toThrow('Must discard exactly 2 cards')
  })
})
