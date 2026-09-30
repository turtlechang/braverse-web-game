import { describe, expect, it } from 'vitest'
import bs11 from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { getTrapCandidates } from './battle'
import { canActivateCookieSkill } from './skills'
import { advancePhase } from './turn'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'
import type { CookieInBattle, GameCard, GameState } from './types'

const records = bs11.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, `bs11-ninth-runtime-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${cardNumber}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const entry = (card: GameCard, hpCards: GameCard[], rested = false): CookieInBattle => ({
  card: card as CookieInBattle['card'],
  hpCards,
  rested,
  battleEntryId: `${card.instanceId}:battle`,
})

type ProtectionScenario = {
  state: GameState
  trap: GameCard
  attacker: CookieInBattle
  selfTarget: CookieInBattle
  yellowPayment: GameCard
  neutralPayment: GameCard
}

const makeProtectionState = (withTreeCondition = true): ProtectionScenario => {
  const base = createBattleState()
  const trap = candidate('BS11-029', 'trap')
  const attacker = base.players['player-two'].battleArea[0]
  if (!attacker) throw new Error('Expected the default attacker')
  const selfTarget = entry(
    withTreeCondition
      ? cookie('Millennial Tree Cookie', 1, 3)
      : cookie('plain-defender', 1, 3),
    [item('bs11-029-self-hp')],
  )
  const yellowPayment = item('bs11-029-yellow-payment', 'yellow')
  const neutralPayment = item('bs11-029-neutral-payment', 'red')

  return {
    state: {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [trap],
          battleArea: [selfTarget],
          supportArea: [
            { card: yellowPayment, rested: false },
            { card: neutralPayment, rested: false },
          ],
          discardPile: [],
        },
        'player-two': {
          ...base.players['player-two'],
          hand: [],
          discardPile: [],
        },
      },
    },
    trap,
    attacker,
    selfTarget,
    yellowPayment,
    neutralPayment,
  }
}

const declareProtectionBattle = (scenario: ProtectionScenario): GameState =>
  applyGameCommand(scenario.state, {
    kind: 'declare-attack',
    playerId: 'player-two',
    attackerInstanceId: scenario.attacker.card.instanceId,
    targetInstanceId: scenario.selfTarget.card.instanceId,
    supportPaymentIds: ['p2-support'],
  })

describe('BS11-029 Life\'s Protection runtime', () => {
  it('applies -1 attack first, then opens the optional N ability payment', () => {
    const scenario = makeProtectionState()
    const declared = declareProtectionBattle(scenario)
    expect(getTrapCandidates(declared, 'player-one')).toContainEqual(scenario.trap)

    const opened = applyGameCommand(declared, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: scenario.trap.instanceId,
      paymentIds: [scenario.yellowPayment.instanceId],
      targetIds: [],
      effectTargets: [[scenario.attacker.card.instanceId], []],
    })

    expect(opened.attackModifiers).toContainEqual(expect.objectContaining({
      targetInstanceId: scenario.attacker.card.instanceId,
      amount: -1,
    }))
    const thenOpened = applyGameCommand(opened, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(thenOpened.pendingOptionalCostAttack).toMatchObject({
      resolution: 'ability',
      cost: { energy: { neutral: 1 }, discardHand: 0 },
      payBeforeCondition: true,
    })
    expect(thenOpened.pendingAbilityEffect).toMatchObject({
      sourceKind: 'trap',
      effectIndex: 1,
    })
  })

  it('pays the optional neutral cost only after opening it, then gains HP on the eligible Cookie', () => {
    const scenario = makeProtectionState()
    const trapPlayed = applyGameCommand(declareProtectionBattle(scenario), {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: scenario.trap.instanceId,
      paymentIds: [scenario.yellowPayment.instanceId],
      targetIds: [],
      effectTargets: [[scenario.attacker.card.instanceId], []],
    })
    const opened = applyGameCommand(trapPlayed, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })

    const paid = applyGameCommand(opened, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'pay',
      paymentIds: [scenario.neutralPayment.instanceId],
    })
    expect(paid.pendingOptionalCostAttack).toBeNull()
    expect(paid.pendingAbilityEffect).toMatchObject({ effectIndex: 1 })

    const resolved = applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [scenario.selfTarget.card.instanceId],
    })
    expect(resolved.pendingAbilityEffect).toBeUndefined()
    expect(resolved.players['player-one'].battleArea[0]?.hpCards).toHaveLength(2)
    expect(resolved.players['player-one'].supportArea.every((support) => support.rested)).toBe(true)
  })

  it('still allows paying Then before a failed Tree/Ancient condition, but resolves no HP gain', () => {
    const scenario = makeProtectionState(false)
    const trapPlayed = applyGameCommand(declareProtectionBattle(scenario), {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: scenario.trap.instanceId,
      paymentIds: [scenario.yellowPayment.instanceId],
      targetIds: [],
      effectTargets: [[scenario.attacker.card.instanceId], []],
    })
    const opened = applyGameCommand(trapPlayed, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(opened.pendingOptionalCostAttack).toBeTruthy()

    const paid = applyGameCommand(opened, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'pay',
      paymentIds: [scenario.neutralPayment.instanceId],
    })
    const resolved = applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(resolved.pendingAbilityEffect).toBeUndefined()
    expect(resolved.players['player-one'].battleArea[0]?.hpCards).toHaveLength(1)
  })
})

type ItemScenario = {
  state: GameState
  card: GameCard
  target: CookieInBattle
  payment: GameCard
}

const makeSproutingJarState = (
  breakLevel: number,
  targetMaxHp = 3,
  targetRemainingHp = targetMaxHp - 1,
): ItemScenario => {
  const base = createBattleState()
  const card = candidate('BS11-030', `jar-${breakLevel}`)
  const target = entry(
    cookie(`bs11-030-target-${breakLevel}`, 1, targetMaxHp),
    Array.from({ length: targetRemainingHp }, (_, index) =>
      item(`bs11-030-target-hp-${breakLevel}-${index}`),
    ),
  )
  const payment = item(`bs11-030-payment-${breakLevel}`, 'yellow')
  return {
    state: {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [card],
          battleArea: [target],
          supportArea: [{ card: payment, rested: false }],
          breakArea: Array.from({ length: breakLevel }, (_, index) =>
            cookie(`bs11-030-break-${breakLevel}-${index}`),
          ),
          discardPile: [],
        },
      },
    },
    card,
    target,
    payment,
  }
}

describe('BS11-030 Life-Sprouting Jar runtime', () => {
  it('pays Y1 and restores a Cookie at remaining HP 1 or 2 when Break LV is exactly 3', () => {
    const scenario = makeSproutingJarState(3)
    const resolved = applyGameCommand(scenario.state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: scenario.card.instanceId,
      paymentIds: [scenario.payment.instanceId],
      targetIds: [scenario.target.card.instanceId],
    })

    expect(resolved.pendingAbilityEffect).toBeUndefined()
    expect(resolved.players['player-one'].battleArea[0]?.hpCards).toHaveLength(3)
    expect(resolved.players['player-one'].supportArea[0]?.rested).toBe(true)
    expect(resolved.players['player-one'].discardPile).toContainEqual(scenario.card)
  })

  it('does not gain HP when the Break LV condition is below 3', () => {
    const scenario = makeSproutingJarState(2)
    const resolved = applyGameCommand(scenario.state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: scenario.card.instanceId,
      paymentIds: [scenario.payment.instanceId],
    })

    expect(resolved.players['player-one'].battleArea[0]?.hpCards).toHaveLength(2)
    expect(resolved.players['player-one'].supportArea[0]?.rested).toBe(true)
    expect(resolved.players['player-one'].discardPile).toContainEqual(scenario.card)
  })

  it('rejects a target with more than 3 HP remaining', () => {
    const scenario = makeSproutingJarState(3, 4, 4)
    expect(() => applyGameCommand(scenario.state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: scenario.card.instanceId,
      paymentIds: [scenario.payment.instanceId],
      targetIds: [scenario.target.card.instanceId],
    })).toThrow()
  })
})

type WingedTreeScenario = {
  state: GameState
  card: GameCard
  target: CookieInBattle
  payment: GameCard
  discardA: GameCard
  discardB: GameCard
}

const activateTestCookie = (instanceId: string): GameCard => ({
  ...cookie(instanceId, 1, 3),
  skill: {
    trigger: 'activate',
    oncePerTurn: false,
    yourTurn: true,
    restSource: false,
    cost: { energy: {}, discardHand: 0 },
    text: 'Activate: Draw 1 card.',
    effects: [{ kind: 'draw', amount: 1 }],
  },
})

const makeWingedTreeState = (breakCount: number, handCount = 2): WingedTreeScenario => {
  const base = createBattleState()
  const card = candidate('BS11-031', `winged-${breakCount}-${handCount}`)
  const target = entry(
    activateTestCookie(`bs11-031-target-${breakCount}-${handCount}`),
    [item(`bs11-031-target-hp-${breakCount}-${handCount}`)],
    false,
  )
  const payment = item(`bs11-031-payment-${breakCount}-${handCount}`, 'yellow')
  const discardA = item(`bs11-031-discard-a-${breakCount}-${handCount}`)
  const discardB = item(`bs11-031-discard-b-${breakCount}-${handCount}`)
  return {
    state: {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [card],
          supportArea: [{ card: payment, rested: false }],
          breakArea: Array.from({ length: breakCount }, (_, index) =>
            cookie(`bs11-031-break-${breakCount}-${index}`),
          ),
          discardPile: [],
        },
        'player-two': {
          ...base.players['player-two'],
          deck: [
            ...base.players['player-two'].deck,
            item(`bs11-031-deck-extra-${breakCount}-${handCount}`),
            item(`bs11-031-deck-extra-2-${breakCount}-${handCount}`),
          ],
          hand: Array.from({ length: handCount }, (_, index) =>
            index === 0 ? discardA : index === 1 ? discardB : item(`bs11-031-extra-${index}`),
          ),
          battleArea: [target],
          discardPile: [],
        },
      },
    },
    card,
    target,
    payment,
    discardA,
    discardB,
  }
}

const playWingedTree = (scenario: WingedTreeScenario): GameState =>
  applyGameCommand(scenario.state, {
    kind: 'begin-play-item',
    playerId: 'player-one',
    instanceId: scenario.card.instanceId,
    paymentIds: [scenario.payment.instanceId],
    targetIds: [scenario.target.card.instanceId],
  })

const advanceToPlayerTwoMain = (state: GameState): GameState => {
  let next = state
  for (let index = 0; index < 5; index += 1) next = advancePhase(next)
  return next
}

describe('BS11-031 Winged Tree runtime', () => {
  it('marks one opponent Cookie Activate until the end of that opponent turn', () => {
    const scenario = makeWingedTreeState(4)
    const marked = playWingedTree(scenario)
    expect(marked.preventCookieActiveNextPhase).toBeUndefined()
    expect(marked.cookieActivateDiscardRequirements).toMatchObject({
      'player-two': [{
        cookieInstanceId: scenario.target.card.instanceId,
        count: 2,
        expiresAfterTurn: marked.turnNumber + 1,
      }],
    })

    const opponentMain = advanceToPlayerTwoMain(marked)
    expect(opponentMain).toMatchObject({ activePlayerId: 'player-two', phase: 'main' })
    expect(opponentMain.players['player-two'].battleArea[0]?.rested).toBe(false)
    expect(canActivateCookieSkill(
      opponentMain,
      'player-two',
      scenario.target.card.instanceId,
      'activate',
    )).toBe(true)

    const pending = applyGameCommand(opponentMain, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: scenario.target.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
      targetIds: [],
    })
    expect(pending.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-two',
      count: 2,
      sourceInstanceId: scenario.target.card.instanceId,
      cookieActivateSkill: { kind: 'begin-activate-skill' },
    })
    expect(() => applyGameCommand(pending, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-two',
      cardIds: [scenario.discardA.instanceId],
    })).toThrow('必須選擇 2 張手牌棄置')

    const restored = applyGameCommand(pending, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-two',
      cardIds: [scenario.discardA.instanceId, scenario.discardB.instanceId],
    })
    expect(restored.pendingOpponentHandDiscard).toBeNull()
    expect(restored.cookieActivateDiscardRequirements?.['player-two']).toEqual([])
    expect(restored.pendingAbilityEffect).toBeUndefined()
    expect(restored.players['player-two'].discardPile).toEqual(
      expect.arrayContaining([scenario.discardA, scenario.discardB]),
    )
    expect(restored.players['player-two'].hand).toHaveLength(3)
  })

  it('does not create the Activate restriction below four Cookies in the break area', () => {
    const scenario = makeWingedTreeState(3)
    const resolved = playWingedTree(scenario)
    expect(resolved.cookieActivateDiscardRequirements).toBeUndefined()
  })

  it('keeps the gate unavailable when the target controller has fewer than two cards', () => {
    const scenario = makeWingedTreeState(4, 1)
    const afterDraw = advanceToPlayerTwoMain(playWingedTree(scenario))
    const opponentMain: GameState = {
      ...afterDraw,
      players: {
        ...afterDraw.players,
        'player-two': {
          ...afterDraw.players['player-two'],
          hand: afterDraw.players['player-two'].hand.slice(0, 1),
        },
      },
    }
    expect(canActivateCookieSkill(
      opponentMain,
      'player-two',
      scenario.target.card.instanceId,
      'activate',
    )).toBe(false)
    expect(() => applyGameCommand(opponentMain, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: scenario.target.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
      targetIds: [],
    })).toThrow()
    expect(opponentMain.cookieActivateDiscardRequirements?.['player-two']).toHaveLength(1)
  })

  it('expires after the opponent turn instead of affecting a later turn', () => {
    const scenario = makeWingedTreeState(4)
    const opponentEnd = advancePhase(advanceToPlayerTwoMain(playWingedTree(scenario)))
    const playerOneActive = advancePhase(opponentEnd)
    expect(playerOneActive.activePlayerId).toBe('player-one')
    expect(playerOneActive.cookieActivateDiscardRequirements).toEqual({})
  })
})
