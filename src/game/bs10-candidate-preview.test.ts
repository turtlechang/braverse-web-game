import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import {
  BS10_FIRST_BATCH_CARD_NUMBERS,
  BS10_REVIEWED_PREVIEW_CARD_NUMBERS,
  createCardCheckDemoState,
  createCardNegativeDemoState,
  createBs10CandidatePreviewDemoState,
} from './demo'
import { describeCommandSteps } from './command-log'
import { getEffectiveAttack } from './index'

const sourceEntry = (state: ReturnType<typeof createCardCheckDemoState>, id: string) =>
  state.players['player-one'].battleArea.find((entry) => entry.card.id === id)

const declareOrdinaryAttack = (state: ReturnType<typeof createCardCheckDemoState>) => {
  const source = state.players['player-one'].battleArea[0]
  const target = state.players['player-two'].battleArea[0]
  if (!source || !target) throw new Error('BS10 attack fixture is missing a Cookie')
  return applyGameCommand(state, {
    kind: 'declare-attack',
    playerId: 'player-one',
    attackerInstanceId: source.card.instanceId,
    targetInstanceId: target.card.instanceId,
    supportPaymentIds: state.players['player-one'].supportArea
      .slice(0, source.card.attackCost)
      .map((support) => support.card.instanceId),
  })
}

describe('BS10 reviewed/formal preview fixtures', () => {
  it('loads reviewed previews and keeps promoted records on the formal loader', () => {
    for (const cardNumber of BS10_FIRST_BATCH_CARD_NUMBERS) {
      const state = createCardCheckDemoState(cardNumber)
      const visibleIds = [
        ...state.players['player-one'].hand,
        ...state.players['player-one'].battleArea.map((entry) => entry.card),
        ...(state.pendingBattle?.revealedHpCard ? [state.pendingBattle.revealedHpCard] : []),
      ].map((card) => card.id)
      expect(visibleIds).toContain(cardNumber.split('@')[0])
    }
    for (const cardNumber of BS10_REVIEWED_PREVIEW_CARD_NUMBERS.slice(BS10_FIRST_BATCH_CARD_NUMBERS.length)) {
      const state = createCardCheckDemoState(cardNumber)
      expect(state.players['player-one'].battleArea.some((entry) => entry.card.id === cardNumber)).toBe(true)
    }
    expect(() => createCardCheckDemoState('BS10-008')).toThrow()
    for (const cardNumber of ['BS10-009', 'BS10-024', 'BS10-073']) {
      expect(() => createCardCheckDemoState(cardNumber)).not.toThrow()
    }
    expect(() => createCardCheckDemoState('BS10-006@1')).toThrow()
    expect(() => createCardCheckDemoState('BS10-005@2')).toThrow()
  })

  it('builds BS10-006 before a real 2R attack for positive and condition-false routes', () => {
    const settle = (initial: ReturnType<typeof createBs10CandidatePreviewDemoState>) => {
      let state = applyGameCommand(initial, {
        kind: 'declare-attack', playerId: 'player-one',
        attackerInstanceId: initial.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS10-006')!.card.instanceId,
        targetInstanceId: initial.players['player-two'].battleArea[0].card.instanceId,
        supportPaymentIds: initial.players['player-one'].supportArea.slice(0, 2).map(({ card }) => card.instanceId),
      })
      if (state.pendingBattle?.stage === 'trap') state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
      for (let i = 0; state.pendingBattle && i < 8; i += 1) {
        if (state.pendingReplacement) {
          state = applyGameCommand(state, { kind: 'skip-replacement', playerId: 'player-two' })
        } else if (state.pendingBattle.stage === 'damage') {
          state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
        } else break
      }
      return state
    }
    const positiveInitial = createBs10CandidatePreviewDemoState('BS10-006')
    const negativeInitial = createBs10CandidatePreviewDemoState('BS10-006', true)
    const primaryTargetId = positiveInitial.players['player-two'].battleArea[0].card.instanceId
    const positive = settle(positiveInitial)
    const negative = settle(negativeInitial)
    expect(positive.cookiesFaintedThisTurn?.['player-two']).toBe(1)
    expect(negative.cookiesFaintedThisTurn?.['player-two'] ?? 0).toBe(0)
    expect(positive.pendingBattle?.stage).toBe('attack-effect')
    expect(negative.pendingBattle?.stage).toBe('attack-effect')
    expect(positive.players['player-one'].supportArea.filter(({ rested }) => rested)).toHaveLength(2)
    expect(positive.players['player-one'].supportArea.filter(({ rested }) => !rested)).toHaveLength(4)
    const positiveTarget = positive.players['player-two'].battleArea.find((entry) => entry.card.instanceId === primaryTargetId)
    const negativeTarget = negative.players['player-two'].battleArea.find((entry) => entry.card.instanceId === primaryTargetId)!
    expect(positiveTarget).toBeUndefined()
    expect(negativeTarget.card.id).toBe('BS1-007')
    expect(negativeTarget.hpCards).toHaveLength(1)
    const positiveThenTarget = positive.players['player-two'].battleArea[0]
    const positiveBefore = positiveThenTarget.hpCards.length
    const positiveAfter = applyGameCommand(positive, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [positiveThenTarget.card.instanceId] })
    const negativeBefore = negativeTarget.hpCards.length
    const negativeAfter = applyGameCommand(negative, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [negativeTarget.card.instanceId] })
    expect(positiveAfter.players['player-two'].battleArea.find((entry) => entry.card.instanceId === positiveThenTarget.card.instanceId)?.hpCards).toHaveLength(positiveBefore - 1)
    expect(negativeAfter.players['player-two'].battleArea[0].hpCards).toHaveLength(negativeBefore)
    expect(describeCommandSteps(negative, negativeAfter, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [negativeTarget.card.instanceId] })?.map((step) => step.text)).toContain('攻擊後效果結果：條件不成立，效果未執行')
  })

  it('builds BS10-007 with a real setup attack: positive draws 0/1, negative blocks the skill', () => {
    const resolveSetup = (initial: ReturnType<typeof createBs10CandidatePreviewDemoState>) => {
      expect(initial.pendingBattle).toBeNull()
      expect(initial.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS6-017')?.rested).toBe(true)
      return initial
    }
    const positive = resolveSetup(createBs10CandidatePreviewDemoState('BS10-007'))
    const negative = resolveSetup(createBs10CandidatePreviewDemoState('BS10-007', true))
    expect(positive.cookiesFaintedThisTurn?.['player-two']).toBe(1)
    expect(negative.cookiesFaintedThisTurn?.['player-two'] ?? 0).toBe(0)
    const source = positive.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS10-007')!
    expect(source.rested).toBe(false)
    expect(positive.players['player-one'].supportArea.filter(({ rested }) => !rested)).toHaveLength(5)
    const activated = applyGameCommand(positive, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.card.instanceId, trigger: 'activate', paymentIds: [] })
    const resolved = applyGameCommand(activated, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    expect(resolved.pendingDrawUpTo?.max).toBe(1)
    const draw0 = applyGameCommand(resolved, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount: 0 })
    expect(draw0.players['player-one'].hand).toEqual(positive.players['player-one'].hand)
    expect(() => applyGameCommand(draw0, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.card.instanceId, trigger: 'activate', paymentIds: [] })).toThrow()
    const activatedOne = applyGameCommand(positive, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.card.instanceId, trigger: 'activate', paymentIds: [] })
    const draw1Pending = applyGameCommand(activatedOne, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    const topDeck = draw1Pending.players['player-one'].deck[0]
    const handBefore = [...draw1Pending.players['player-one'].hand]
    const draw1 = applyGameCommand(draw1Pending, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount: 1 })
    expect(draw1.players['player-one'].hand).toEqual([...handBefore, topDeck])
    const negativeSource = negative.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS10-007')!
    expect(() => applyGameCommand(negative, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: negativeSource.card.instanceId, trigger: 'activate', paymentIds: [] })).toThrow()
  })

  it('keeps BS10-001 at exactly two real hand cards and exposes the discard-cost A/B', () => {
    const positive = createBs10CandidatePreviewDemoState('BS10-001')
    const negative = createBs10CandidatePreviewDemoState('BS10-001', true)
    expect(positive.players['player-one'].hand).toHaveLength(2)
    expect(positive.players['player-one'].hand.every((card) => card.imageUrl)).toBe(true)
    expect(positive.players['player-one'].supportArea).toHaveLength(6)
    expect(positive.players['player-one'].supportArea.every(
      ({ card, rested }) => card.energyColor === 'red' && rested === false && card.imageUrl,
    )).toBe(true)
    expect(negative.players['player-one'].hand).toHaveLength(1)

    const source = sourceEntry(positive, 'BS10-001')!.card
    const paid = applyGameCommand(positive, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
      trigger: 'activate',
      paymentIds: [],
      discardHandIds: positive.players['player-one'].hand.map((card) => card.instanceId),
    })
    const activated = applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [source.instanceId],
    })
    expect(getEffectiveAttack(activated, source.instanceId)).toBe(source.attack + 1)
    expect(() => applyGameCommand(negative, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
      trigger: 'activate',
      paymentIds: [],
      discardHandIds: negative.players['player-one'].hand.map((card) => card.instanceId),
    })).toThrow()
  })

  it('builds BS10-004 positive from a real opponent faint and keeps negative condition-false', () => {
    const positive = createBs10CandidatePreviewDemoState('BS10-004')
    const negative = createBs10CandidatePreviewDemoState('BS10-004', true)
    expect(positive.players['player-two'].battleArea.some((entry) => entry.card.id === 'BS1-007')).toBe(false)
    expect(positive.cookiesFaintedThisTurn?.['player-two']).toBe(1)
    expect(positive.cookiesFaintedThisTurnDetails?.['player-two']).toHaveLength(1)
    expect(sourceEntry(positive, 'BS10-004')?.rested).toBe(false)
    expect(positive.players['player-one'].supportArea.filter(({ card, rested }) =>
      card.energyColor === 'red' && !rested,
    )).toHaveLength(5)
    expect(negative.players['player-two'].battleArea.some((entry) => entry.card.id === 'BS1-007')).toBe(true)
    expect(negative.players['player-two'].battleArea.find((entry) => entry.card.id === 'BS1-007')?.hpCards).toHaveLength(1)
    expect(negative.cookiesFaintedThisTurn?.['player-two'] ?? 0).toBe(0)
    expect(sourceEntry(negative, 'BS10-004')?.rested).toBe(false)
    expect(negative.players['player-one'].supportArea.filter(({ rested }) => !rested)).toHaveLength(5)

    const source = sourceEntry(positive, 'BS10-004')!.card
    const activated = applyGameCommand(
      applyGameCommand(positive, {
        kind: 'begin-activate-skill',
        playerId: 'player-one',
        sourceInstanceId: source.instanceId,
        trigger: 'activate',
        paymentIds: [],
      }),
      { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [source.instanceId] },
    )
    expect(getEffectiveAttack(activated, source.instanceId)).toBe(source.attack + 1)
    expect(() => applyGameCommand(negative, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: negative.players['player-one'].battleArea[0].card.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })).toThrow()
  })

  it('exposes BS10-003 through the real HP FLIP and its draw-up-to 0/1 choices', () => {
    const initial = createBs10CandidatePreviewDemoState('BS10-003')
    expect(initial.pendingBattle?.stage).toBe('flip')
    expect(initial.pendingBattle?.revealedHpCard?.id).toBe('BS10-003')
    expect(initial.pendingBattle?.revealedHpCard?.instanceId).toContain('BS10-003-hp-')
    const activated = applyGameCommand(initial, {
      kind: 'resolve-flip', playerId: 'player-one', activate: true,
    })
    expect(activated.pendingDrawUpTo).toMatchObject({ playerId: 'player-one', max: 1 })
    const drawZero = applyGameCommand(activated, {
      kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount: 0,
    })
    const drawOne = applyGameCommand(
      applyGameCommand(createBs10CandidatePreviewDemoState('BS10-003'), {
        kind: 'resolve-flip', playerId: 'player-one', activate: true,
      }),
      { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount: 1 },
    )
    expect(drawZero.players['player-one'].hand).toHaveLength(initial.players['player-one'].hand.length)
    expect(drawOne.players['player-one'].hand).toHaveLength(initial.players['player-one'].hand.length + 1)
    expect(drawZero.pendingBattle).toBeNull()
    expect(drawZero.pendingDrawUpTo).toBeNull()
    expect(drawZero.players['player-one'].discardPile.some((card) => card.id === 'BS10-003')).toBe(true)
    expect(drawOne.pendingBattle).toBeNull()
    expect(drawOne.pendingDrawUpTo).toBeNull()
    expect(drawOne.players['player-one'].discardPile.some((card) => card.id === 'BS10-003')).toBe(true)
  })

  it.each([
    ['decline', null],
    ['draw0', 0],
    ['draw1', 1],
  ] as const)('uses card-negative BS10-003 as a lethal real FLIP (%s) and settles replacement', (_mode, drawCount) => {
    const lethal = createCardNegativeDemoState('BS10-003')
    expect(lethal.pendingBattle?.stage).toBe('flip')
    expect(lethal.players['player-one'].battleArea[0].card.id).toBe('BS6-047')
    expect(lethal.players['player-one'].battleArea[0].hpCards).toHaveLength(0)
    let afterFlip = applyGameCommand(lethal, {
      kind: 'resolve-flip', playerId: 'player-one', activate: drawCount !== null,
    })
    if (drawCount !== null) {
      afterFlip = applyGameCommand(afterFlip, {
        kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount,
      })
    }
    expect(afterFlip.pendingReplacement).toMatchObject({ tasks: [{ playerId: 'player-one', remaining: 1 }] })
    expect(afterFlip.players['player-one'].battleArea).toHaveLength(0)
    const settled = applyGameCommand(afterFlip, {
      kind: 'replace-cookie',
      playerId: 'player-one',
      instanceId: 'BS10-003-replacement',
    })
    expect(settled.pendingOnPlay).toMatchObject({
      playerId: 'player-one',
      sourceInstanceId: 'BS10-003-replacement',
      origin: 'hand',
    })
    const finished = applyGameCommand(settled, {
      kind: 'skip-on-play',
      playerId: 'player-one',
      sourceInstanceId: 'BS10-003-replacement',
    })
    expect(finished.status).toBe('playing')
    expect(finished.pendingBattle).toBeNull()
    expect(finished.pendingDrawUpTo ?? null).toBeNull()
    expect(finished.pendingReplacement).toBeNull()
    expect(finished.pendingOnPlay).toBeNull()
    expect(finished.players['player-one'].breakArea.some((card) => card.instanceId === 'BS10-003-defender')).toBe(true)
    expect(finished.players['player-one'].discardPile.some((card) => card.instanceId === 'BS10-003-hp-lethal')).toBe(true)
    expect(finished.cookiesFaintedThisTurn?.['player-one']).toBe(1)
    expect(finished.players['player-one'].deck).toHaveLength(20 - (drawCount ?? 0) - 5)
    expect(finished.players['player-one'].hand).toHaveLength(drawCount ?? 0)
    expect(finished.players['player-one'].battleArea).toHaveLength(1)
    expect(finished.players['player-one'].battleArea[0].card.id).toBe('BS6-079')
    expect(finished.players['player-one'].battleArea[0].hpCards).toHaveLength(5)
  })

  it('keeps card-attack-negative BS10-003 active with enough real blue but wrong-colour payment', () => {
    const negative = createCardNegativeDemoState('BS10-003', { normalAttack: 'blocked' })
    const source = negative.players['player-one'].battleArea[0]
    expect(source.card.id).toBe('BS10-003')
    expect(source.rested).toBe(false)
    expect(negative.players['player-one'].supportArea).toHaveLength(6)
    expect(negative.players['player-one'].supportArea.every(({ card, rested }) =>
      card.energyColor === 'blue' && rested === false && card.imageUrl,
    )).toBe(true)
    expect(() => declareOrdinaryAttack(negative)).toThrow()
  })

  it('uses the formal red BS6 supports for BS10-003 2R payment and deals 2 damage', () => {
    const initial = createCardCheckDemoState('BS10-003', { normalAttack: 'payable' })
    const source = initial.players['player-one'].battleArea[0]
    const target = initial.players['player-two'].battleArea[0]
    expect(source?.card.id).toBe('BS10-003')
    expect(source?.card.attackEnergyCost).toEqual({ red: 2 })
    expect(target).toBeDefined()
    expect(initial.players['player-one'].supportArea).toHaveLength(6)
    expect(initial.players['player-one'].supportArea.map(({ card }) => card.id)).toEqual([
      'BS6-002', 'BS6-002', 'BS6-002', 'BS6-004', 'BS6-004', 'BS6-004',
    ])
    expect(initial.players['player-one'].supportArea.every(({ card, rested }) =>
      card.energyColor === 'red' && card.imageUrl && rested === false,
    )).toBe(true)

    let settled = declareOrdinaryAttack(initial)
    if (settled.pendingBattle?.stage === 'trap') {
      settled = applyGameCommand(settled, { kind: 'skip-trap', playerId: 'player-two' })
    }
    for (let step = 0; settled.pendingBattle && step < 3; step += 1) {
      settled = applyGameCommand(settled, {
        kind: 'resolve-next-damage',
        playerId: 'player-two',
      })
    }
    expect(settled.pendingBattle).toBeNull()
    expect(settled.players['player-two'].battleArea[0]?.hpCards).toHaveLength(
      target!.hpCards.length - 2,
    )
    expect(settled.players['player-one'].supportArea.filter(({ rested }) => rested)).toHaveLength(2)
  })

  it.each(['BS10-002', 'BS10-005', 'BS10-005@1'] as const)('%s has ordinary attack A/B payment fixtures', (cardNumber) => {
    const positive = createBs10CandidatePreviewDemoState(cardNumber)
    const negative = createBs10CandidatePreviewDemoState(cardNumber, true)
    expect(positive.players['player-one'].battleArea[0].rested).toBe(false)
    expect(new Set(positive.players['player-one'].supportArea.map(({ card }) => card.energyColor))).toEqual(
      new Set(['red', 'green']),
    )
    expect(() => declareOrdinaryAttack(positive)).not.toThrow()
    expect(negative.players['player-one'].battleArea[0].rested).toBe(false)
    expect(negative.players['player-one'].supportArea.filter(({ rested }) => !rested)).toHaveLength(
      Math.max(0, negative.players['player-one'].battleArea[0].card.attackCost - 1),
    )
    expect(() => declareOrdinaryAttack(negative)).toThrow()
  })
})
