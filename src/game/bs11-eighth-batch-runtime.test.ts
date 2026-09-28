import { describe, expect, it } from 'vitest'
import bs11 from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { getTrapCandidates } from './battle'
import { canActivateCookieSkill } from './skills'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'
import type { CookieInBattle, GameCard, GameState } from './types'

const records = bs11.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, `bs11-eighth-runtime-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${cardNumber}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const entry = (card: GameCard, hpCards: GameCard[]): CookieInBattle => ({
  card: card as CookieInBattle['card'],
  hpCards,
  rested: false,
  battleEntryId: `${card.instanceId}:battle`,
})

const makeWizardState = (hand: GameCard[]): {
  state: GameState
  source: GameCard
  target: CookieInBattle
  yellowPayment: GameCard
} => {
  const base = createBattleState()
  const source = candidate('BS11-026', 'source')
  const target = base.players['player-one'].battleArea[0]
  if (!target) throw new Error('Expected a default target')
  const yellowPayment = item('bs11-026-yellow-payment', 'yellow')
  const state: GameState = {
    ...base,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        hand: [],
        discardPile: [],
      },
      'player-two': {
        ...base.players['player-two'],
        hand,
        battleArea: [entry(source, [item('bs11-026-source-hp-a'), item('bs11-026-source-hp-b'), item('bs11-026-source-hp-c')])],
        supportArea: [{ card: yellowPayment, rested: false }],
        discardPile: [],
      },
    },
  }
  return { state, source, target, yellowPayment }
}

describe('BS11-026 Wizard Cookie runtime', () => {
  it('pays Y1 and one hand FLIP Cookie, then damages an optional opponent target', () => {
    const flip = candidate('BS11-019', 'discard-flip')
    const { state, source, target, yellowPayment } = makeWizardState([flip])
    expect(source.skill).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: { yellow: 1 }, discardHand: 1, discardHandHasFlip: true },
    })
    expect(canActivateCookieSkill(state, 'player-two', source.instanceId, 'activate')).toBe(true)

    const paid = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: source.instanceId,
      trigger: 'activate',
      paymentIds: [yellowPayment.instanceId],
      discardHandIds: [flip.instanceId],
    })
    expect(paid.pendingAbilityEffect).toBeTruthy()
    expect(paid.players['player-two'].supportArea[0]?.rested).toBe(true)
    expect(paid.players['player-two'].hand).toEqual([])
    expect(paid.players['player-two'].discardPile).toContainEqual(flip)

    const resolved = applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [target.card.instanceId],
    })
    expect(resolved.pendingAbilityEffect).toBeUndefined()
    expect(resolved.players['player-one'].battleArea[0]?.hpCards).toHaveLength(target.hpCards.length - 1)
    expect(resolved.skillUsesThisTurn).toContain(`${source.instanceId}:battle`)
    expect(() => applyGameCommand(resolved, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: source.instanceId,
      trigger: 'activate',
      paymentIds: [],
      discardHandIds: [],
    })).toThrow()
  })

  it('allows selecting zero but rejects a hand Cookie without FLIP and a self target', () => {
    const nonFlip = candidate('BS11-023', 'discard-non-flip')
    const invalid = makeWizardState([nonFlip])
    expect(canActivateCookieSkill(invalid.state, 'player-two', invalid.source.instanceId, 'activate')).toBe(false)
    expect(() => applyGameCommand(invalid.state, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: invalid.source.instanceId,
      trigger: 'activate',
      paymentIds: [invalid.yellowPayment.instanceId],
      discardHandIds: [nonFlip.instanceId],
    })).toThrow()

    const flip = candidate('BS11-019', 'discard-flip-zero')
    const { state, source, yellowPayment } = makeWizardState([flip])
    const paid = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: source.instanceId,
      trigger: 'activate',
      paymentIds: [yellowPayment.instanceId],
      discardHandIds: [flip.instanceId],
    })
    const skipped = applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [],
    })
    expect(skipped.pendingAbilityEffect).toBeUndefined()
    expect(skipped.players['player-one'].battleArea[0]?.hpCards).toHaveLength(3)

    const again = makeWizardState([candidate('BS11-019', 'discard-flip-invalid-target')])
    const paidAgain = applyGameCommand(again.state, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: again.source.instanceId,
      trigger: 'activate',
      paymentIds: [again.yellowPayment.instanceId],
      discardHandIds: [again.state.players['player-two'].hand[0]!.instanceId],
    })
    expect(() => applyGameCommand(paidAgain, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [again.source.instanceId],
    })).toThrow()
  })
})

const makeTrapState = (): {
  state: GameState
  trap: GameCard
  attacker: CookieInBattle
  otherAttacker: CookieInBattle
  defender: CookieInBattle
  payments: GameCard[]
} => {
  const base = createBattleState()
  const trap = candidate('BS11-027', 'trap')
  const attacker = base.players['player-two'].battleArea[0]
  const defender = base.players['player-one'].battleArea[0]
  if (!attacker || !defender) throw new Error('Expected the default battle participants')
  const otherAttacker = entry(cookie('bs11-027-other-attacker', 2, 2), [item('bs11-027-other-hp-a'), item('bs11-027-other-hp-b')])
  const payments = [item('bs11-027-yellow-a', 'yellow'), item('bs11-027-yellow-b', 'yellow')]
  const state: GameState = {
    ...base,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        hand: [trap],
        supportArea: payments.map((card) => ({ card, rested: false })),
        discardPile: [],
      },
      'player-two': {
        ...base.players['player-two'],
        battleArea: [attacker, otherAttacker],
        supportArea: [{ card: item('bs11-027-attack-payment', 'red'), rested: false }],
      },
    },
  }
  const declared = applyGameCommand(state, {
    kind: 'declare-attack',
    playerId: 'player-two',
    attackerInstanceId: attacker.card.instanceId,
    targetInstanceId: defender.card.instanceId,
    supportPaymentIds: ['bs11-027-attack-payment'],
  })
  return { state: declared, trap, attacker, otherAttacker, defender, payments }
}

describe('BS11-027 Passion Escaping Paradise runtime', () => {
  it('reduces every opponent Cookie attack damage, then raises one selected attack cost', () => {
    const { state, trap, attacker, otherAttacker, payments } = makeTrapState()
    expect(getTrapCandidates(state, 'player-one')).toContainEqual(trap)
    const resolved = applyGameCommand(state, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: trap.instanceId,
      paymentIds: payments.map((card) => card.instanceId),
      targetIds: [],
      effectTargets: [[], [attacker.card.instanceId]],
    })
    expect(resolved.players['player-one'].supportArea.every((entry) => entry.rested)).toBe(true)
    expect(resolved.players['player-one'].discardPile).toContainEqual(trap)
    expect(resolved.attackModifiers).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetInstanceId: attacker.card.instanceId, amount: -1 }),
      expect.objectContaining({ targetInstanceId: otherAttacker.card.instanceId, amount: -1 }),
    ]))
    expect(resolved.attackCostModifiers).toContainEqual(expect.objectContaining({
      targetInstanceId: attacker.card.instanceId,
      energyCost: { neutral: 1 },
      operation: 'increase',
    }))
    expect(resolved.pendingBattle?.stage).toBe('damage')
  })

  it('keeps the Then target optional and rejects incomplete all-Cookie selection or wrong payment', () => {
    const scenario = makeTrapState()
    const skippedThen = applyGameCommand(scenario.state, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: scenario.trap.instanceId,
      paymentIds: scenario.payments.map((card) => card.instanceId),
      targetIds: [],
      effectTargets: [[], []],
    })
    expect(skippedThen.attackModifiers).toHaveLength(2)
    expect(skippedThen.attackCostModifiers).toEqual([])

    const invalidTarget = makeTrapState()
    expect(() => applyGameCommand(invalidTarget.state, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: invalidTarget.trap.instanceId,
      paymentIds: invalidTarget.payments.map((card) => card.instanceId),
      targetIds: [],
      effectTargets: [[], [invalidTarget.defender.card.instanceId]],
    })).toThrow()

    const wrongPayment = makeTrapState()
    const redPayments = wrongPayment.payments.map((card) => ({ ...card, energyColor: 'red' as const }))
    const wrongPaymentState: GameState = {
      ...wrongPayment.state,
      players: {
        ...wrongPayment.state.players,
        'player-one': {
          ...wrongPayment.state.players['player-one'],
          supportArea: redPayments.map((card) => ({ card, rested: false })),
        },
      },
    }
    expect(() => applyGameCommand(wrongPaymentState, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: wrongPayment.trap.instanceId,
      paymentIds: redPayments.map((card) => card.instanceId),
      targetIds: [],
      effectTargets: [[], [wrongPayment.attacker.card.instanceId]],
    })).toThrow()
  })
})

const makeStageState = (hand: GameCard[] = []): {
  state: GameState
  stage: GameCard
  target: CookieInBattle
  placementPayment: GameCard
} => {
  const base = createBattleState()
  const stage = candidate('BS11-028', 'stage')
  const targetCard = candidate('BS11-023', 'yellow-target')
  const target = entry(targetCard, [item('bs11-028-target-hp-bottom'), item('bs11-028-target-hp-top')])
  const placementPayment = item('bs11-028-placement-payment', 'yellow')
  const state: GameState = {
    ...base,
    players: {
      ...base.players,
      'player-two': {
        ...base.players['player-two'],
        hand: [stage, ...hand],
        battleArea: [target],
        supportArea: [{ card: placementPayment, rested: false }],
        deck: [item('bs11-028-draw-card'), item('bs11-028-deck-reserve')],
        discardPile: [],
      },
    },
  }
  return { state, stage, target, placementPayment }
}

describe('BS11-028 Berry Paradise runtime', () => {
  it.each([0, 1])('places for Y1, pays the top Y Cookie HP, and draws %s card at hand <= 6', (drawCount) => {
    const { state, stage, target, placementPayment } = makeStageState()
    const placed = applyGameCommand(state, {
      kind: 'play-stage',
      playerId: 'player-two',
      instanceId: stage.instanceId,
      paymentIds: [placementPayment.instanceId],
    })
    expect(placed.players['player-two'].stage).toEqual({ card: stage, rested: false })

    const activated = applyGameCommand(placed, {
      kind: 'begin-activate-stage',
      playerId: 'player-two',
      paymentIds: [],
      hpToTrashTargetIds: [target.card.instanceId],
      targetIds: [],
    })
    expect(activated.players['player-two'].stage?.rested).toBe(true)
    expect(activated.players['player-two'].battleArea[0]?.hpCards.map((card) => card.instanceId))
      .toEqual(['bs11-028-target-hp-bottom'])
    expect(activated.players['player-two'].discardPile.map((card) => card.instanceId))
      .toContain('bs11-028-target-hp-top')
    expect(activated.pendingDrawUpTo).toMatchObject({ playerId: 'player-two', max: 1 })

    const resolved = applyGameCommand(activated, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-two',
      drawCount,
    })
    expect(resolved.pendingDrawUpTo ?? null).toBeNull()
    expect(resolved.players['player-two'].hand.map((card) => card.instanceId))
      .toEqual(drawCount === 0 ? [] : ['bs11-028-draw-card'])
  })

  it('rejects a non-yellow HP payment and does not activate above the six-card hand limit', () => {
    const positive = makeStageState()
    const placed = applyGameCommand(positive.state, {
      kind: 'play-stage',
      playerId: 'player-two',
      instanceId: positive.stage.instanceId,
      paymentIds: [positive.placementPayment.instanceId],
    })
    const redCookie = entry({ ...cookie('bs11-028-red-cookie', 1, 2), energyColor: 'red' }, [item('bs11-028-red-hp')])
    expect(() => applyGameCommand(placed, {
      kind: 'begin-activate-stage',
      playerId: 'player-two',
      paymentIds: [],
      hpToTrashTargetIds: [redCookie.card.instanceId],
    })).toThrow()

    const tooManyCards = makeStageState(Array.from({ length: 7 }, (_, index) => item(`bs11-028-hand-${index}`)))
    const placedTooMany = applyGameCommand(tooManyCards.state, {
      kind: 'play-stage',
      playerId: 'player-two',
      instanceId: tooManyCards.stage.instanceId,
      paymentIds: [tooManyCards.placementPayment.instanceId],
    })
    expect(() => applyGameCommand(placedTooMany, {
      kind: 'begin-activate-stage',
      playerId: 'player-two',
      paymentIds: [],
      hpToTrashTargetIds: [tooManyCards.target.card.instanceId],
    })).toThrow()
  })
})
