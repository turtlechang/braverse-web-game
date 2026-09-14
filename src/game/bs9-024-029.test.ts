import { describe, expect, it } from 'vitest'
import {
  convertOfficialCardToGameCard,
} from '../cards/official-card-adapter'
import { buildCardContractActionTrace } from '../cards/contracts/action-trace'
import { analyzeOfficialCardBehavior } from '../cards/contracts/ledger'
import type { OfficialCardRecord } from '../cards/types'
import bs9Candidates from '../../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import {
  createCardCheckDemoState,
  createCardNegativeDemoState,
  parseTestStateConfig,
} from './demo'
import { applyGameCommand } from './commands'
import { resolveFlip } from './battle'
import {
  getEffectSelectionCandidates,
  getEffectSelectionLimits,
} from './effects'
import type { CardEffect, CookieCard, EffectContext, GameCard, GameState } from './types'

const records = bs9Candidates.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string): GameCard => {
  const source = records.find((card) => card.cardNumber === cardNumber) ??
    records.find((card) => card.baseCardNumber === cardNumber)
  if (!source) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  const conversion = convertOfficialCardToGameCard(source, 'bs9-test')
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.gameCard
}

const battle = (state: GameState, cardId: string, playerId: 'player-one' | 'player-two' = 'player-one') => {
  const entry = state.players[playerId].battleArea.find((candidateEntry) => candidateEntry.card.id === cardId)
  if (!entry) throw new Error(`${cardId} is not in ${playerId}'s battle area`)
  return entry
}

describe('BS9-024～029 yellow candidate batch', () => {
  it('converts every reviewed card and adopts the BS9-025 recipient ruling', () => {
    expect(candidate('BS9-024').skill).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      effects: [{
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: {
          kind: 'all-of',
          conditions: [
            { kind: 'source-hp-at-most', amount: 4 },
            { kind: 'battle-area-has-keyword', keyword: 'ancient', excludeSource: true },
          ],
        },
      }],
    })
    expect((candidate('BS9-024') as CookieCard).attackEffects).toMatchObject([{
      kind: 'optional-cost-attack',
      cost: { hpToHand: { amount: 1, sourceOnly: true } },
      effects: [{ kind: 'damage', amount: 1, target: { attackTargetOnly: true } }],
    }])
    expect(candidate('BS9-026').flip).toMatchObject({
      cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'draw-up-to', max: 1 }],
    })
    expect(candidate('BS9-027').skill).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      effects: [
        { kind: 'hand-to-hp', optional: true, target: { sourceOnly: true, min: 0, max: 1 } },
        { kind: 'damage', amount: 1, target: { sourceOnly: true, min: 1, max: 1 } },
      ],
    })
    expect(candidate('BS9-028').skill).toBeUndefined()
    expect(candidate('BS9-028').flip).toBeUndefined()
    expect(candidate('BS9-029').flip).toMatchObject({
      effects: [{
        kind: 'transfer-hp',
        amount: 1,
        direction: 'to-source',
        target: { side: 'self', min: 0, max: 1 },
        receiverTarget: { side: 'self', min: 0, max: 1 },
      }],
    })
    for (const cardNumber of ['BS9-025', 'BS9-025@1'] as const) {
      const source = records.find((card) => card.cardNumber === cardNumber)!
      const converted = convertOfficialCardToGameCard(source, 'review')
      expect(converted.status, cardNumber).toBe('converted')
      if (converted.status !== 'converted') continue
      expect(converted.source.cardNumber).toBe(cardNumber)
      expect(converted.source.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\/data\/en_storage\/.+\.webp$/)
      expect(converted.gameCard.flip, cardNumber).toMatchObject({
        cost: { energy: {}, discardHand: 1 },
        effects: [],
        attachedHpBonus: 1,
        attachedHpAlternateTarget: {
          side: 'self', min: 0, max: 1, excludeSource: true,
        },
      })

      const audit = analyzeOfficialCardBehavior(source)
      expect(audit.contract.costs.some(
        (cost) => cost.kind === 'discard-hand' && cost.amount === 1,
      ), cardNumber).toBe(true)
      expect(audit.contract.targets.some((target) =>
        target.unresolved === undefined &&
        target.selector.side === 'self' &&
        target.selector.min === 0 &&
        target.selector.max === 1 &&
        target.selector.excludeSource === true,
      ), cardNumber).toBe(true)
      expect(audit.checks.costCovered, cardNumber).toBe(true)
      expect(audit.checks.targetCovered, cardNumber).toBe(true)
      expect(audit.errors, cardNumber).toEqual([])
      expect(audit.contract.status, cardNumber).toBe('verified')
    }

    for (const cardNumber of [
      'BS9-024@1', 'BS9-025@1', 'BS9-026@1', 'BS9-026@2',
      'BS9-027@1', 'BS9-029@1',
    ]) {
      expect(convertOfficialCardToGameCard(
        records.find((card) => card.cardNumber === cardNumber)!,
        'variant',
      ).status, cardNumber).toBe('converted')
    }
  })

  it('resolves BS9-025 as attached HP with an own-turn alternate recipient', () => {
    for (const cardNumber of ['BS9-025', 'BS9-025@1'] as const) {
      const initial = createCardCheckDemoState(cardNumber)
      const host = battle(initial, 'BS8-030')
      const alternate = battle(initial, 'BS8-014')
      const payment = initial.players['player-one'].hand[0]!

      const defaultResolved = resolveFlip(initial, 'player-one', {
        activate: true,
        discardHandIds: [payment.instanceId],
      })
      expect(battle(defaultResolved, 'BS8-030').hpCards).toHaveLength(2)
      expect(battle(defaultResolved, 'BS8-014').hpCards).toHaveLength(4)
      expect(defaultResolved.players['player-one'].discardPile).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ instanceId: payment.instanceId }),
          expect.objectContaining({ id: 'BS9-025' }),
        ]),
      )

      const redirected = resolveFlip(createCardCheckDemoState(cardNumber), 'player-one', {
        activate: true,
        discardHandIds: [payment.instanceId],
        targetIds: [alternate.card.instanceId],
      })
      expect(battle(redirected, 'BS8-030').hpCards).toHaveLength(1)
      expect(battle(redirected, 'BS8-014').hpCards).toHaveLength(5)
      expect(redirected.players['player-one'].discardPile).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'BS9-025' })]),
      )

      const outsideOwnTurn = {
        ...createCardCheckDemoState(cardNumber),
        activePlayerId: 'player-two' as const,
      }
      const outsideResolved = resolveFlip(outsideOwnTurn, 'player-one', {
        activate: true,
        discardHandIds: [payment.instanceId],
      })
      expect(battle(outsideResolved, 'BS8-030').hpCards).toHaveLength(2)
      expect(battle(outsideResolved, 'BS8-014').hpCards).toHaveLength(4)
      expect(() => resolveFlip(outsideOwnTurn, 'player-one', {
        activate: true,
        discardHandIds: [payment.instanceId],
        targetIds: [alternate.card.instanceId],
      })).toThrow('只能在自己的回合選擇另一隻餅乾')

      expect(() => resolveFlip(initial, 'player-one', {
        activate: true,
        discardHandIds: [payment.instanceId],
        targetIds: [host.card.instanceId],
      })).toThrow('不是合法的 HP 目標')

      const negative = createCardNegativeDemoState(cardNumber)
      expect(negative.players['player-one'].hand).toHaveLength(0)
      expect(() => resolveFlip(negative, 'player-one', { activate: true })).toThrow(
        'Must discard exactly 1 cards for FLIP activation.',
      )
      expect(negative.pendingBattle?.stage).toBe('flip')
    }
  })

  it('resolves Golden Cheese Activate only at four or less HP with another Ancient', () => {
    let state = createCardCheckDemoState('BS9-024')
    const source = battle(state, 'BS9-024')
    state = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })
    expect(state.pendingAbilityEffect?.effectIndex).toBe(0)
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [source.card.instanceId],
    })
    expect(battle(state, 'BS9-024').hpCards).toHaveLength(5)

    const negative = createCardNegativeDemoState('BS9-024')
    const negativeSource = battle(negative, 'BS9-024')
    expect(() => applyGameCommand(negative, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: negativeSource.card.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })).toThrow()
  })

  it('pays Golden Cheese attack Then by returning HP before dealing one damage', () => {
    let state = createCardCheckDemoState('BS9-024', { normalAttack: 'payable' })
    const source = battle(state, 'BS9-024')
    const target = battle(state, 'BS1-007', 'player-two')
    state = applyGameCommand(state, {
      kind: 'resolve-attack-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(state.pendingOptionalCostAttack?.cost.hpToHand).toEqual({ amount: 1, sourceOnly: true })
    state = applyGameCommand(state, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'pay',
      paymentIds: [],
      hpToHandIds: [source.card.instanceId],
      targetIds: [target.card.instanceId],
    })
    expect(state.pendingOptionalCostAttack).toBeNull()
    expect(battle(state, 'BS9-024').hpCards).toHaveLength(4)
    expect(battle(state, 'BS1-007', 'player-two').hpCards).toHaveLength(3)
    expect(state.players['player-one'].hand).toContainEqual(
      expect.objectContaining({ instanceId: 'bs9-bs9-024-source-hp-5' }),
    )

    let skipped = createCardCheckDemoState('BS9-024', { normalAttack: 'payable' })
    skipped = applyGameCommand(skipped, {
      kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [],
    })
    skipped = applyGameCommand(skipped, {
      kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'skip',
    })
    expect(battle(skipped, 'BS9-024').hpCards).toHaveLength(5)
    expect(battle(skipped, 'BS1-007', 'player-two').hpCards).toHaveLength(4)
  })

  it('plays Shadow Milk through the EXTRA entry cost and resumes its detached FLIP', () => {
    let state = createCardCheckDemoState('BS9-030')
    const extra = state.players['player-one'].extraDeck?.[0]
    expect(extra).toMatchObject({
      id: 'BS9-030',
      extraDeckPlayMode: 'enter-battle',
      extraDeckPlayCost: {
        discardHand: 3,
        discardHandColor: 'yellow',
        discardHandType: 'cookie',
        discardHandHasFlip: true,
      },
    })
    expect(extra?.attackEffects).toMatchObject([{
      kind: 'optional-cost-attack',
      effects: [{ kind: 'activate-discarded-flip' }],
    }])
    if (!extra) throw new Error('BS9-030 EXTRA fixture is missing its card')

    state = applyGameCommand(state, {
      kind: 'play-extra-deck-cookie',
      playerId: 'player-one',
      instanceId: extra.instanceId,
    })
    expect(state.pendingOptionalCostAttack).toMatchObject({
      mandatory: true,
      extraDeckPlayInstanceId: extra.instanceId,
    })

    const entryHand = state.players['player-one'].hand
    // Leave the first Caramel Choux out of the entry cost so the fixture has a
    // real BS9-026 FLIP Cookie available for the later attack Then effect.
    state = applyGameCommand(state, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'pay',
      discardCardIds: [
        entryHand[0]!.instanceId,
        entryHand[2]!.instanceId,
        entryHand[3]!.instanceId,
      ],
      paymentIds: [],
    })
    expect(state.pendingOnPlay).toMatchObject({
      sourceInstanceId: extra.instanceId,
      origin: 'extra-deck',
    })
    expect(state.players['player-one'].extraDeck).toHaveLength(0)

    state = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: extra.instanceId,
      trigger: 'on-play',
      paymentIds: [],
    })
    const onPlay = state.pendingAbilityEffect
    expect(onPlay?.effects[0]).toMatchObject({
      kind: 'break-to-trash',
      exactLevel: 1,
    })
    const breakTarget = getEffectSelectionCandidates(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: extra.instanceId },
      onPlay!.effects[0]!,
    )[0]
    expect(breakTarget).toBeDefined()
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [breakTarget!.instanceId],
    })
    expect(state.pendingOnPlay).toBeNull()
    expect(state.players['player-one'].discardPile).toContainEqual(
      expect.objectContaining({ id: 'BS9-006' }),
    )

    const attacker = state.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === extra.instanceId,
    )!
    const target = state.players['player-two'].battleArea[0]!
    state = applyGameCommand(state, {
      kind: 'declare-attack',
      playerId: 'player-one',
      attackerInstanceId: attacker.card.instanceId,
      targetInstanceId: target.card.instanceId,
      supportPaymentIds: state.players['player-one'].supportArea.map(
        (support) => support.card.instanceId,
      ),
    })
    state = applyGameCommand(state, {
      kind: 'skip-trap',
      playerId: 'player-two',
    })
    while (state.pendingBattle?.stage === 'damage') {
      state = applyGameCommand(state, {
        kind: 'resolve-next-damage',
        playerId: 'player-two',
      })
    }
    expect(state.pendingBattle?.stage).toBe('attack-effect')
    state = applyGameCommand(state, {
      kind: 'resolve-attack-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(state.pendingOptionalCostAttack).toMatchObject({
      effects: [{ kind: 'activate-discarded-flip' }],
    })

    const flip = state.players['player-one'].hand[0]!
    expect(flip.id).toBe('BS9-026')
    state = applyGameCommand(state, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-one',
      action: 'pay',
      discardCardIds: [flip.instanceId],
      paymentIds: [],
    })
    expect(state.pendingBattle?.detachedFlip).toBe(true)
    state = applyGameCommand(state, {
      kind: 'resolve-flip',
      playerId: 'player-one',
      activate: true,
    })
    expect(state.pendingDrawUpTo).toMatchObject({
      sourceCardId: 'BS9-026',
      battleContinuation: 'attack-effect',
    })
    state = applyGameCommand(state, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount: 0,
    })
    expect(state.pendingDrawUpTo).toBeNull()
    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-one'].discardPile).toContainEqual(
      expect.objectContaining({ id: 'BS9-026', instanceId: flip.instanceId }),
    )

    const trace = buildCardContractActionTrace(state.commandLog ?? [], 'BS9-030')
    expect(trace.map((entry) => entry.commandKind)).toEqual(expect.arrayContaining([
      'play-extra-deck-cookie',
      'resolve-optional-cost-attack',
      'begin-activate-skill',
      'resolve-ability-effect',
      'declare-attack',
      'resolve-attack-effect',
      'resolve-flip',
      'resolve-draw-up-to',
    ]))
  })

  it('blocks BS9-030 EXTRA entry when fewer than three qualifying FLIP Cookies remain', () => {
    const state = createCardNegativeDemoState('BS9-030')
    expect(state.players['player-one'].hand).toHaveLength(2)
    expect(() => applyGameCommand(state, {
      kind: 'play-extra-deck-cookie',
      playerId: 'player-one',
      instanceId: state.players['player-one'].extraDeck![0]!.instanceId,
    })).toThrow('足夠資源')
  })

  it('resolves Vampire in order, including optional zero hand cards', () => {
    let state = createCardCheckDemoState('BS9-027')
    const source = battle(state, 'BS9-027')
    const handCard = state.players['player-one'].hand[0]
    state = applyGameCommand(state, {
      kind: 'begin-activate-skill', playerId: 'player-one',
      sourceInstanceId: source.card.instanceId, trigger: 'activate', paymentIds: [],
    })
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect', playerId: 'player-one',
      targetIds: [handCard.instanceId],
    })
    expect(battle(state, 'BS9-027').hpCards).toHaveLength(6)
    expect(state.pendingAbilityEffect?.effectIndex).toBe(1)
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect', playerId: 'player-one',
      targetIds: [source.card.instanceId],
    })
    expect(battle(state, 'BS9-027').hpCards).toHaveLength(5)
    expect(state.pendingAbilityEffect).toBeUndefined()

    let zero = createCardNegativeDemoState('BS9-027')
    const zeroSource = battle(zero, 'BS9-027')
    zero = applyGameCommand(zero, {
      kind: 'begin-activate-skill', playerId: 'player-one',
      sourceInstanceId: zeroSource.card.instanceId, trigger: 'activate', paymentIds: [],
    })
    zero = applyGameCommand(zero, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [],
    })
    zero = applyGameCommand(zero, {
      kind: 'resolve-ability-effect', playerId: 'player-one',
      targetIds: [zeroSource.card.instanceId],
    })
    expect(battle(zero, 'BS9-027').hpCards).toHaveLength(4)
    expect(zero.pendingAbilityEffect).toBeUndefined()
  })

  it('uses real FLIP targets for Burnt Cheese and enforces Caramel Choux pairs', () => {
    const drawFlip = createCardCheckDemoState('BS9-026')
    const drawResolved = resolveFlip(drawFlip, 'player-one', { activate: true })
    expect(drawResolved.pendingDrawUpTo).toMatchObject({ max: 1, sourceCardName: 'Burnt Cheese Cookie' })

    const pairState = createCardCheckDemoState('BS9-029')
    const donor = battle(pairState, 'BS8-014')
    const receiver = battle(pairState, 'BS8-030')
    const effect = pairState.pendingBattle!.revealedHpCard!.flip!.effects[0]
    expect(effect.kind).toBe('transfer-hp')
    expect(getEffectSelectionLimits(effect as CardEffect)).toEqual({ min: 0, max: 2 })
    const context: EffectContext = {
      sourcePlayerId: 'player-one',
      sourceInstanceId: pairState.pendingBattle!.revealedHpCard!.instanceId,
    }
    expect(getEffectSelectionCandidates(pairState, context, effect as CardEffect)
      .map((card) => card.instanceId)).toEqual([receiver.card.instanceId, donor.card.instanceId])

    expect(() => resolveFlip(pairState, 'player-one', {
      activate: true, targetIds: [donor.card.instanceId],
    })).toThrow('必須同時選擇供牌與接收牌')
    expect(() => resolveFlip(pairState, 'player-one', {
      activate: true, targetIds: [donor.card.instanceId, donor.card.instanceId],
    })).toThrow('不能重複選擇同一張餅乾')

    const resolved = resolveFlip(pairState, 'player-one', {
      activate: true,
      targetIds: [donor.card.instanceId, receiver.card.instanceId],
    })
    expect(battle(resolved, 'BS8-014').hpCards).toHaveLength(3)
    expect(battle(resolved, 'BS8-030').hpCards).toHaveLength(2)
    expect(resolved.players['player-one'].discardPile).toContainEqual(
      expect.objectContaining({ id: 'BS9-029' }),
    )
  })

  it('keeps the adopted Mala Sauce FLIP route visible with its real targets', () => {
    const state = createCardCheckDemoState('BS9-025')
    expect(state.pendingBattle).toMatchObject({ stage: 'flip' })
    expect(state.pendingBattle?.revealedHpCard).toMatchObject({
      id: 'BS9-025',
      name: 'Mala Sauce Cookie',
    })
    expect(state.pendingBattle?.revealedHpCard?.flip).toMatchObject({
      attachedHpBonus: 1,
      attachedHpAlternateTarget: { side: 'self', min: 0, max: 1, excludeSource: true },
    })
    const variantState = createCardCheckDemoState('BS9-025@1')
    expect(variantState.pendingBattle?.revealedHpCard).toMatchObject({ id: 'BS9-025' })
    expect(parseTestStateConfig('?test-state=bs9-card:BS9-029', 'localhost')).toEqual({
      kind: 'bs9-candidate', cardNumber: 'BS9-029', negative: false,
    })
    expect(parseTestStateConfig('?test-state=bs9-card-negative:BS9-029', 'localhost')).toEqual({
      kind: 'bs9-candidate', cardNumber: 'BS9-029', negative: true,
    })
    expect(parseTestStateConfig('?test-state=bs9-card:BS9-029', 'braverse.example')).toBeNull()
  })
})
