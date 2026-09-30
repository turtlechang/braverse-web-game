import { describe, expect, it } from 'vitest'
import bs11 from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'
import type { CookieInBattle, GameCard, GameState } from './types'

const records = bs11.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, `bs11-thirteenth-runtime-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${cardNumber}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const entry = (
  card: GameCard,
  hpCards: GameCard[],
  rested = false,
): CookieInBattle => ({
  card: card as CookieInBattle['card'],
  hpCards,
  rested,
  battleEntryId: `${card.instanceId}:battle`,
})

const greenCookie = (instanceId: string, rested: boolean): CookieInBattle =>
  entry(
    {
      ...cookie(instanceId, 1, 2),
      energyColor: 'green',
      attackEnergyCost: { green: 1 },
    },
    [item(`${instanceId}:hp-a`), item(`${instanceId}:hp-b`)],
    rested,
  )

const makeStageState = (): {
  state: GameState
  stage: GameCard
  greenA: CookieInBattle
  greenB: CookieInBattle
  redCookie: CookieInBattle
  placement: GameCard
  activationA: GameCard
  activationB: GameCard
  wrongColor: GameCard
} => {
  const base = createBattleState()
  const stage = candidate('BS11-045', 'stage')
  const greenA = greenCookie('bs11-045-green-a', true)
  const greenB = greenCookie('bs11-045-green-b', true)
  const redCookie = entry(
    cookie('bs11-045-red-cookie', 1, 2),
    [item('bs11-045-red-cookie:hp-a'), item('bs11-045-red-cookie:hp-b')],
    true,
  )
  const placement = item('bs11-045-placement', 'green')
  const activationA = item('bs11-045-activation-a', 'green')
  const activationB = item('bs11-045-activation-b', 'green')
  const wrongColor = item('bs11-045-wrong-color', 'red')
  return {
    state: {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [stage],
          battleArea: [greenA, greenB, redCookie],
          supportArea: [
            { card: placement, rested: false },
            { card: activationA, rested: false },
            { card: activationB, rested: false },
            { card: wrongColor, rested: false },
          ],
        },
      },
    },
    stage,
    greenA,
    greenB,
    redCookie,
    placement,
    activationA,
    activationB,
    wrongColor,
  }
}

describe('BS11-045 Grand Dust Hotel runtime', () => {
  it('places for G, activates for G2, and sets up to two rested green Cookies active', () => {
    const scenario = makeStageState()
    const placed = applyGameCommand(scenario.state, {
      kind: 'play-stage',
      playerId: 'player-one',
      instanceId: scenario.stage.instanceId,
      paymentIds: [scenario.placement.instanceId],
    })
    expect(placed.players['player-one'].stage).toEqual({ card: scenario.stage, rested: false })

    const activated = applyGameCommand(placed, {
      kind: 'activate-stage',
      playerId: 'player-one',
      paymentIds: [scenario.activationA.instanceId, scenario.activationB.instanceId],
      effectTargets: [[scenario.greenA.card.instanceId, scenario.greenB.card.instanceId]],
    })

    expect(activated.players['player-one'].stage).toEqual({ card: scenario.stage, rested: true })
    expect(activated.players['player-one'].battleArea.map((cookieInBattle) => ({
      id: cookieInBattle.card.instanceId,
      rested: cookieInBattle.rested,
    }))).toEqual([
      { id: scenario.greenA.card.instanceId, rested: false },
      { id: scenario.greenB.card.instanceId, rested: false },
      { id: scenario.redCookie.card.instanceId, rested: true },
    ])
  })

  it('rejects a red activation payment without mutating the placed Stage', () => {
    const scenario = makeStageState()
    const placed = applyGameCommand(scenario.state, {
      kind: 'play-stage',
      playerId: 'player-one',
      instanceId: scenario.stage.instanceId,
      paymentIds: [scenario.placement.instanceId],
    })
    const snapshot = structuredClone(placed)
    expect(() => applyGameCommand(placed, {
      kind: 'activate-stage',
      playerId: 'player-one',
      paymentIds: [scenario.activationA.instanceId, scenario.wrongColor.instanceId],
      effectTargets: [[]],
    })).toThrow()
    expect(placed).toEqual(snapshot)
  })
})

type TrapScenario = {
  state: GameState
  trap: GameCard
  attacker: CookieInBattle
  trapPayment: GameCard
  attackPayment: GameCard
  neutralPayment?: GameCard
  restTarget?: GameCard
}

const makeTrapState = (
  cardNumber: 'BS11-046' | 'BS11-048',
  ownSupportCount: number,
  opponentSupportCount: number,
): TrapScenario => {
  const base = createBattleState()
  const trap = candidate(cardNumber, `trap-${ownSupportCount}-${opponentSupportCount}`)
  const attacker = entry(
    {
      ...cookie(`${cardNumber}:attacker`, 1, 3),
      energyColor: 'green',
      attackEnergyCost: { green: 1 },
    },
    [item(`${cardNumber}:attacker-hp`)],
  )
  const defender = entry(
    cookie(`${cardNumber}:defender`, 1, 3),
    [item(`${cardNumber}:defender-hp`)],
  )
  const trapPayment = item(`${cardNumber}:trap-payment`, 'green')
  const attackPayment = item(`${cardNumber}:attack-payment`, 'green')
  const neutralPayment = cardNumber === 'BS11-048'
    ? item(`${cardNumber}:neutral-payment`, 'red')
    : undefined
  const restTarget = cardNumber === 'BS11-048'
    ? item(`${cardNumber}:rest-target`, 'red')
    : undefined
  const ownSupport = Array.from({ length: ownSupportCount }, (_, index) => ({
    card: index === 0 ? trapPayment : index === 1 && neutralPayment ? neutralPayment : item(`${cardNumber}:own-support-${index}`, 'green'),
    rested: false,
  }))
  const opponentSupport = Array.from({ length: opponentSupportCount }, (_, index) => ({
    card: index === 0 ? attackPayment : index === 1 && restTarget ? restTarget : item(`${cardNumber}:opponent-support-${index}`, 'red'),
    rested: false,
  }))
  return {
    state: {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [trap],
          battleArea: [defender],
          supportArea: ownSupport,
          discardPile: [],
        },
        'player-two': {
          ...base.players['player-two'],
          hand: [],
          battleArea: [attacker],
          supportArea: opponentSupport,
          discardPile: [],
        },
      },
    },
    trap,
    attacker,
    trapPayment,
    attackPayment,
    neutralPayment,
    restTarget,
  }
}

const declareTrapBattle = (scenario: TrapScenario): GameState =>
  applyGameCommand(scenario.state, {
    kind: 'declare-attack',
    playerId: 'player-two',
    attackerInstanceId: scenario.attacker.card.instanceId,
    targetInstanceId: scenario.state.players['player-one'].battleArea[0]!.card.instanceId,
    supportPaymentIds: [scenario.attackPayment.instanceId],
  })

describe('BS11-046 Awakened Apathy runtime', () => {
  it('adds the conditional second -1 only when own support is behind by two', () => {
    const cases: Array<{ opponentSupportCount: number; expectedAmounts: number[] }> = [
      { opponentSupportCount: 4, expectedAmounts: [-2, -1] },
      { opponentSupportCount: 3, expectedAmounts: [-2] },
    ]
    for (const { opponentSupportCount, expectedAmounts } of cases) {
      const scenario = makeTrapState('BS11-046', 2, opponentSupportCount)
      const result = applyGameCommand(declareTrapBattle(scenario), {
        kind: 'play-trap',
        playerId: 'player-one',
        trapInstanceId: scenario.trap.instanceId,
        paymentIds: scenario.state.players['player-one'].supportArea
          .slice(0, 2)
          .map(({ card }) => card.instanceId),
        targetIds: [],
        effectTargets: [[scenario.attacker.card.instanceId]],
      })
      expect(result.attackModifiers
        .filter((modifier) => modifier.targetInstanceId === scenario.attacker.card.instanceId)
        .map((modifier) => modifier.amount)).toEqual(expectedAmounts)
    }
  })
})

describe('BS11-048 Wind\'s Protection runtime', () => {
  it('pays Then 1N and rests one active opponent support when Wind Archer is present', () => {
    const scenario = makeTrapState('BS11-048', 2, 2)
    const windArcher = entry(
      { ...cookie('Wind Archer Cookie', 1, 2), name: 'Wind Archer Cookie', energyColor: 'green' },
      [item('bs11-048-wind-archer-hp')],
    )
    const stateWithCondition: GameState = {
      ...declareTrapBattle({ ...scenario, state: {
        ...scenario.state,
        players: {
          ...scenario.state.players,
          'player-one': {
            ...scenario.state.players['player-one'],
            battleArea: [windArcher],
          },
        },
      } }),
    }
    const opened = applyGameCommand(stateWithCondition, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: scenario.trap.instanceId,
      paymentIds: [scenario.trapPayment.instanceId],
      targetIds: [],
      effectTargets: [[scenario.attacker.card.instanceId]],
    })
    const thenOpened = opened.pendingOptionalCostAttack
      ? opened
      : applyGameCommand(opened, {
          kind: 'resolve-ability-effect',
          playerId: 'player-one',
          targetIds: [],
        })
    expect(thenOpened.pendingOptionalCostAttack).toMatchObject({
      resolution: 'ability',
      cost: { energy: { neutral: 1 }, discardHand: 0 },
    })

    const paid = applyGameCommand(thenOpened, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'pay',
      paymentIds: [scenario.neutralPayment!.instanceId],
    })
    const resolved = applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [scenario.restTarget!.instanceId],
    })
    expect(resolved.players['player-two'].supportArea.find(
      ({ card }) => card.instanceId === scenario.restTarget!.instanceId,
    )?.rested).toBe(true)
    expect(resolved.pendingAbilityEffect).toBeUndefined()
  })
})

describe('BS11-049 Emerald of the Wind runtime', () => {
  it('pays G and plays the named Wind Archer Cookie from the trash', () => {
    const base = createBattleState()
    const card = candidate('BS11-049', 'item')
    const windArcher: GameCard = {
      ...cookie('bs11-049-wind-archer', 2, 2),
      name: 'Wind Archer Cookie',
      energyColor: 'green',
      attackEnergyCost: { green: 2 },
    }
    const payment = item('bs11-049-payment', 'green')
    const state: GameState = {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [card],
          battleArea: [],
          supportArea: [{ card: payment, rested: false }],
          discardPile: [windArcher],
          deck: [
            item('bs11-049-hp-a'),
            item('bs11-049-hp-b'),
            item('bs11-049-deck-extra'),
          ],
        },
      },
    }

    const resolved = applyGameCommand(state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: card.instanceId,
      paymentIds: [payment.instanceId],
      targetIds: [windArcher.instanceId],
    })
    expect(resolved.players['player-one'].battleArea.map(({ card: battleCard }) => battleCard.instanceId))
      .toContain(windArcher.instanceId)
    expect(resolved.players['player-one'].discardPile.map(({ instanceId }) => instanceId))
      .not.toContain(windArcher.instanceId)
    expect(resolved.players['player-one'].discardPile).toContainEqual(card)
    expect(resolved.players['player-one'].supportArea[0]).toMatchObject({ rested: true })
  })
})
