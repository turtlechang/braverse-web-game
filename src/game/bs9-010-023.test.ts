import { describe, expect, it } from 'vitest'
import {
  convertOfficialCardToExtraDeckCard,
  convertOfficialCardToGameCard,
} from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import bs9Candidates from '../../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import {
  createBs9CandidatePreviewDemoState,
  createCardCheckDemoState,
  createCardNegativeDemoState,
  parseTestStateConfig,
} from './demo'
import { applyGameCommand } from './commands'
import {
  getAttackDamageAgainst,
  getEffectDamageAmount,
  getEffectSelectionCandidates,
  getEffectTargetSelectionLimits,
  getEffectTargetCandidates,
  getFixedModifierTargetIds,
} from './effects'
import { advancePhase } from './turn'
import { getAttackEnergyCostForState, selectEnergyPayment } from './energy'
import { describeCommandSteps } from './command-log'
import type { GameCard, GameState, PlayerId } from './types'

const records = bs9Candidates.cards as unknown as OfficialCardRecord[]

const sourceRecord = (cardNumber: string): OfficialCardRecord => {
  const record = records.find((card) => card.cardNumber === cardNumber) ??
    records.find((card) => card.baseCardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  return record
}

const candidate = (cardNumber: string): GameCard => {
  const conversion = convertOfficialCardToGameCard(sourceRecord(cardNumber), 'bs9-test')
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.gameCard
}

const extraCandidate = (cardNumber: string) => {
  const conversion = convertOfficialCardToExtraDeckCard(sourceRecord(cardNumber), 'bs9-test')
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.extraDeckCard
}

const battle = (state: GameState, cardId: string, playerId: PlayerId = 'player-one') => {
  const entry = state.players[playerId].battleArea.find((candidateEntry) => candidateEntry.card.id === cardId)
  if (!entry) throw new Error(`${cardId} is not in ${playerId}'s battle area`)
  return entry
}

const handCard = (state: GameState, cardId: string, playerId: PlayerId = 'player-one') => {
  const card = state.players[playerId].hand.find((candidateCard) => candidateCard.id === cardId)
  if (!card) throw new Error(`${cardId} is not in ${playerId}'s hand`)
  return card
}

const deploy = (state: GameState, cardId: string) => {
  const card = handCard(state, cardId)
  return applyGameCommand(state, {
    kind: 'deploy-cookie',
    playerId: 'player-one',
    instanceId: card.instanceId,
  })
}

const payOne = (state: GameState) => {
  const support = state.players['player-one'].supportArea.find((entry) => !entry.rested)
  if (!support) throw new Error('fixture has no active support payment')
  return support.card.instanceId
}

const payN = (state: GameState, count: number) => {
  const supports = state.players['player-one'].supportArea.filter((entry) => !entry.rested).slice(0, count)
  if (supports.length !== count) throw new Error(`fixture has fewer than ${count} active support cards`)
  return supports.map((entry) => entry.card.instanceId)
}

type FixtureCardIdentity = {
  id: string
  instanceId: string
  name: string
  type: string
}

const fixtureCards = (state: GameState): FixtureCardIdentity[] => {
  const cards: FixtureCardIdentity[] = []
  for (const player of Object.values(state.players)) {
    cards.push(
      ...player.deck,
      ...(player.extraDeck ?? []),
      ...player.hand,
      ...player.breakArea,
      ...player.discardPile,
      ...player.supportArea.map((entry) => entry.card),
      ...(player.stage ? [player.stage.card] : []),
      ...player.battleArea.flatMap((entry) => [
        entry.card,
        ...entry.hpCards,
        ...(entry.equippedCards ?? []),
        ...(entry.awakenedUnderlay ?? []),
      ]),
    )
  }
  if (state.deckTrashResolution?.cards) cards.push(...state.deckTrashResolution.cards)
  if (state.pendingBattle?.revealedHpCard) cards.push(state.pendingBattle.revealedHpCard)
  if (state.pendingRefresh?.remainingDeckToTrash?.movedCards) {
    cards.push(...state.pendingRefresh.remainingDeckToTrash.movedCards)
  }
  if (state.pendingInspectDeck?.revealedCards) cards.push(...state.pendingInspectDeck.revealedCards)
  if (state.pendingRevealTopDeck?.revealedCard) cards.push(state.pendingRevealTopDeck.revealedCard)
  for (const result of Object.values(state.hpInspectionResults ?? {})) {
    for (const pile of result?.piles ?? []) cards.push(...pile.cards)
  }
  return cards
}

const officialCardId = /^(?:BS\d+-\d{3}|ST\d+-\d{3}|P-\d{3})(?:@\d+)?$/
const forbiddenFixtureTokens = [
  ['opp', '-lv1'],
  ['support', '-pay'],
  ['self', '-break'],
  ['hand', '-filler'],
  ['trash', '-cookie'],
].map(([prefix, suffix]) => `${prefix}${suffix}`)
const forbiddenFixtureTokenPattern = new RegExp(forbiddenFixtureTokens.join('|'), 'i')

describe('BS9-010～023 second RED candidate batch', () => {
  it('uses official physical card records throughout every BS9 fixture route', () => {
    const cardNumbers = Array.from({ length: 23 }, (_, index) => `BS9-${String(index + 1).padStart(3, '0')}`)
    for (const cardNumber of cardNumbers) {
      for (const state of [createCardCheckDemoState(cardNumber), createCardNegativeDemoState(cardNumber)]) {
        const cards = fixtureCards(state)
        expect(cards.length, `${cardNumber} fixture should contain physical cards`).toBeGreaterThan(0)
        for (const card of cards) {
          expect(card.id, `${cardNumber} fixture card id`).toMatch(officialCardId)
          expect(`${card.id} ${card.name} ${card.instanceId}`, `${cardNumber} fixture card identity`)
            .not.toMatch(forbiddenFixtureTokenPattern)
        }
      }
    }
  })

  it('converts every candidate with variant-safe costs, timing, and effect boundaries', () => {
    const eleven = candidate('BS9-011')
    expect(eleven.skill).toMatchObject({
      trigger: 'on-play',
      effects: [{ kind: 'damage', amount: 1, condition: { count: 2, energyColor: 'red', minLevel: 1, maxLevel: 1 } }],
    })
    expect(candidate('BS9-012').skill).toMatchObject({
      trigger: 'passive',
      endPhase: true,
      endPhaseScope: 'opponent-turn',
      effects: [{ kind: 'damage', amount: 3, condition: { kind: 'battle-area-cookie-count', count: 2 } }],
    })
    expect(candidate('BS9-013').skill).toBeUndefined()
    expect(candidate('BS9-014').skill).toMatchObject({
      cost: { hpToTrash: { amount: 2, excludeSource: true } },
      effects: [{
        kind: 'transfer-hp',
        direction: 'to-source',
        amount: 1,
        hpPlacement: 'bottom',
        faceUp: true,
      }],
    })
    expect(candidate('BS9-015').skill).toMatchObject({
      faint: true,
      effects: [{ kind: 'hand-to-battle', optional: true, thenEffects: [{ kind: 'hp-to-hand', amount: 1 }] }],
    })
    expect(candidate('BS9-016').skill?.effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: 1,
      condition: { kind: 'battle-area-has-named-cookie', name: 'Pizza Cookie', excludeSource: true },
    })
    expect(candidate('BS9-017').skill).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: { neutral: 1 } },
      effects: [{ kind: 'modify-attack', amount: 2, condition: { kind: 'battle-area-has-keyword', keyword: 'ancient', excludeSource: true } }],
    })
    expect(candidate('BS9-018').skill).toMatchObject({
      trigger: 'passive',
      yourTurn: true,
      effects: [{ kind: 'prevent-opponent-damage' }],
    })
    expect(candidate('BS9-019').item).toMatchObject({
      cost: { energy: { red: 2 } },
      effects: [{ kind: 'modify-attack', amount: 1, thenEffects: [{ kind: 'gain-hp', amount: 1 }] }],
    })
    expect(candidate('BS9-020').item).toMatchObject({
      cost: { energy: { red: 1 } },
      effects: [{ kind: 'draw-up-to-then-discard', max: 2, discardCount: 1 }],
    })
    expect(candidate('BS9-021').trap).toMatchObject({
      cost: { energy: { red: 3 } },
      effects: [{
        kind: 'transfer-hp',
        hpPlacement: 'bottom',
        faceUp: true,
        receiverTarget: { side: 'self', min: 1, max: 1 },
      }],
    })
    expect(candidate('BS9-022').trap).toMatchObject({
      cost: { energy: { red: 1 } },
      effects: [{ kind: 'modify-attack', amount: -1 }, { kind: 'draw-up-to', max: 1 }],
    })
    expect(candidate('BS9-023').stageAbility).toMatchObject({
      placementCost: { red: 1 },
      cost: { energy: { red: 1 } },
      restSource: true,
      effects: [{ kind: 'modify-attack', amount: 1, target: { max: 2 } }],
    })

    const extra = extraCandidate('BS9-010')
    expect(extra).toMatchObject({
      extraDeckPlayMode: 'enter-battle',
      playRequirement: { kind: 'cookies-fainted-during-opponent-previous-turn-at-least', count: 2, energyColor: 'red', minLevel: 1, maxLevel: 1 },
      skill: { trigger: 'on-play', effects: [{ kind: 'hand-to-hp', handSide: 'opponent', optional: true }] },
      attackEffects: [{ kind: 'optional-cost-attack', cost: { energy: { neutral: 1 } }, effects: [{ kind: 'transfer-hp' }] }],
    })
    for (const cardNumber of ['BS9-010', 'BS9-011', 'BS9-012', 'BS9-014', 'BS9-015', 'BS9-016', 'BS9-017', 'BS9-018', 'BS9-019', 'BS9-020', 'BS9-021', 'BS9-022', 'BS9-023']) {
      const variant = records.find((record) => record.baseCardNumber === cardNumber && record.cardNumber !== cardNumber)
      if (variant) {
        const conversion = cardNumber === 'BS9-010'
          ? convertOfficialCardToExtraDeckCard(variant, 'variant')
          : convertOfficialCardToGameCard(variant, 'variant')
        expect(conversion.status).toBe('converted')
      }
    }
  })

  it('plays BS9-010 EXTRA only with the prior-turn condition and resolves both HP transfers', () => {
    const blocked = createCardNegativeDemoState('BS9-010')
    const extraId = blocked.players['player-one'].extraDeck![0]!.instanceId
    expect(() => applyGameCommand(blocked, {
      kind: 'play-extra-deck-cookie', playerId: 'player-one', instanceId: extraId,
    })).toThrow()

    let state = createBs9CandidatePreviewDemoState('BS9-010')
    const extra = state.players['player-one'].extraDeck![0]!
    state = applyGameCommand(state, { kind: 'play-extra-deck-cookie', playerId: 'player-one', instanceId: extra.instanceId })
    const hand = state.players['player-two'].hand[0]!
    state = applyGameCommand(state, {
      kind: 'activate-skill', playerId: 'player-one', sourceInstanceId: extra.instanceId,
      trigger: 'on-play', paymentIds: [], effectTargets: [['player-two-hidden-hand-0']],
    })
    expect(state.foreignHpCardInstanceIds?.[extra.instanceId]).toContain(hand.instanceId)

    const attacker = battle(state, 'BS9-010')
    const defender = state.players['player-two'].battleArea[0]
    const attackPayment = state.players['player-one'].supportArea.slice(0, 2).map((entry) => entry.card.instanceId)
    state = applyGameCommand(state, {
      kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: attacker.card.instanceId,
      targetInstanceId: defender.card.instanceId, supportPaymentIds: attackPayment,
    })
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
    state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] })
    expect(state.pendingOptionalCostAttack).toBeTruthy()
    const optionalPayment = payOne(state)
    state = applyGameCommand(state, {
      kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'pay',
      paymentIds: [optionalPayment], targetIds: [defender.card.instanceId],
    })
    expect(state.pendingOptionalCostAttack).toBeNull()
    expect(battle(state, 'BS9-010').hpCards.length).toBe(6)
    expect(state.foreignHpCardInstanceIds?.[extra.instanceId]).toHaveLength(2)
  })

  it('resolves BS9-011, BS9-012, BS9-013, BS9-014, BS9-016 through real command paths', () => {
    let state = deploy(createCardCheckDemoState('BS9-011'), 'BS9-011')
    const source = battle(state, 'BS9-011')
    const opponent = state.players['player-two'].battleArea[0]
    state = applyGameCommand(state, {
      kind: 'activate-skill', playerId: 'player-one', sourceInstanceId: source.card.instanceId,
      trigger: 'on-play', paymentIds: [], effectTargets: [[opponent.card.instanceId]],
    })
    expect(battle(state, 'BS1-007', 'player-two').hpCards.length).toBe(3)
    const negativeEleven = deploy(createCardNegativeDemoState('BS9-011'), 'BS9-011')
    const negativeSource = battle(negativeEleven, 'BS9-011')
    expect(() => applyGameCommand(negativeEleven, {
      kind: 'activate-skill', playerId: 'player-one', sourceInstanceId: negativeSource.card.instanceId,
      trigger: 'on-play', paymentIds: [], effectTargets: [[opponent.card.instanceId]],
    })).toThrow()

    state = createCardCheckDemoState('BS9-012')
    const knight = battle(state, 'BS9-012')
    state = advancePhase({ ...state, activePlayerId: 'player-two', phase: 'end' })
    expect(state.pendingAbilityEffect).toBeTruthy()
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [knight.card.instanceId] })
    expect(state.players['player-one'].battleArea.some((entry) => entry.card.id === 'BS9-012')).toBe(false)
    const negativeTwelve = advancePhase({ ...createCardNegativeDemoState('BS9-012'), activePlayerId: 'player-two', phase: 'end' })
    expect(negativeTwelve.pendingAbilityEffect).toBeUndefined()

    expect(battle(deploy(createCardCheckDemoState('BS9-013'), 'BS9-013'), 'BS9-013').card.name).toBe('Capricious Wizard')

    state = deploy(createCardCheckDemoState('BS9-014'), 'BS9-014')
    const candy = battle(state, 'BS9-014')
    const donor = battle(state, 'BS8-014')
    const target = state.players['player-two'].battleArea[0]
    const targetTopHp = target.hpCards[target.hpCards.length - 1]!
    state = applyGameCommand(state, {
      kind: 'activate-skill', playerId: 'player-one', sourceInstanceId: candy.card.instanceId,
      trigger: 'on-play', paymentIds: [], hpToTrashTargetIds: [donor.card.instanceId],
      effectTargets: [[target.card.instanceId]],
    })
    expect(battle(state, 'BS8-014').hpCards).toHaveLength(2)
    const candyAfter = battle(state, 'BS9-014')
    expect(candyAfter.hpCards).toHaveLength(3)
    expect(candyAfter.hpCards[0]?.instanceId).toBe(targetTopHp.instanceId)
    expect(candyAfter.faceUpHpCardInstanceIds).toContain(targetTopHp.instanceId)
    expect(state.foreignHpCardInstanceIds?.[candy.card.instanceId]).toContain(targetTopHp.instanceId)
    const negativeFourteen = deploy(createCardNegativeDemoState('BS9-014'), 'BS9-014')
    const negativeCandy = battle(negativeFourteen, 'BS9-014')
    const negativeTarget = negativeFourteen.players['player-two'].battleArea[0]!
    expect(() => applyGameCommand(negativeFourteen, {
      kind: 'activate-skill', playerId: 'player-one', sourceInstanceId: negativeCandy.card.instanceId,
      trigger: 'on-play', paymentIds: [], hpToTrashTargetIds: [battle(negativeFourteen, 'BS8-014').card.instanceId],
      effectTargets: [[negativeTarget.card.instanceId]],
    })).toThrow()

    state = deploy(createCardCheckDemoState('BS9-016'), 'BS9-016')
    const pizza = state.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === state.pendingOnPlay?.sourceInstanceId,
    )
    if (!pizza) throw new Error('deployed Pizza Cookie source is missing')
    state = applyGameCommand(state, {
      kind: 'activate-skill', playerId: 'player-one', sourceInstanceId: pizza.card.instanceId,
      trigger: 'on-play', paymentIds: [], effectTargets: [[pizza.card.instanceId]],
    })
    expect(state.attackModifiers).toContainEqual(expect.objectContaining({ sourceInstanceId: pizza.card.instanceId, amount: 1 }))
    const negativePizza = deploy(createCardNegativeDemoState('BS9-016'), 'BS9-016')
    expect(() => applyGameCommand(negativePizza, {
      kind: 'activate-skill', playerId: 'player-one', sourceInstanceId: battle(negativePizza, 'BS9-016').card.instanceId,
      trigger: 'on-play', paymentIds: [], effectTargets: [[battle(negativePizza, 'BS9-016').card.instanceId]],
    })).toThrow()
  })

  it('enforces BS9-015 faint Then and the BS9-017 Ancient selector on both surfaces', () => {
    let state = createCardCheckDemoState('BS9-015')
    const hand = handCard(state, 'BS9-013')
    state = applyGameCommand(state, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [hand.instanceId] })
    expect(state.pendingAbilityEffect?.previousEffectTargetIds).toEqual([hand.instanceId])
    const pending = state.pendingAbilityEffect!
    const hpToHand = pending.effects[pending.effectIndex]
    if (hpToHand.kind !== 'hp-to-hand') throw new Error('BS9-015 Then effect is missing')
    const context = {
      sourcePlayerId: pending.sourcePlayerId,
      sourceInstanceId: pending.sourceInstanceId,
    }
    expect(getEffectTargetCandidates(state, context, hpToHand.target).map((cookie) => cookie.card.instanceId))
      .toEqual([hand.instanceId])
    expect(getEffectSelectionCandidates(state, context, hpToHand).map((card) => card.instanceId))
      .toEqual([hand.instanceId])
    const wrongTarget = battle(state, 'BS8-014').card.instanceId
    expect(() => applyGameCommand(state, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [wrongTarget],
    })).toThrow('後續 HP 效果只能作用於先前選定的同一張餅乾。')
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [hand.instanceId] })
    expect(state.players['player-one'].hand.some((card) => card.instanceId.startsWith('bs9-faint-player-one-deck-'))).toBe(true)
    expect(createCardNegativeDemoState('BS9-015').pendingAbilityEffect).toBeUndefined()

    state = createCardCheckDemoState('BS9-017', { preferSkillSurface: true })
    const holly = battle(state, 'BS9-017')
    state = applyGameCommand(state, {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: holly.card.instanceId,
      trigger: 'activate', paymentIds: [payOne(state)], targetIds: [holly.card.instanceId],
    })
    expect(state.attackModifiers).toContainEqual(expect.objectContaining({ sourceInstanceId: holly.card.instanceId, amount: 2 }))
    const negative = createCardNegativeDemoState('BS9-017', { preferSkillSurface: true })
    expect(() => applyGameCommand(negative, {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: battle(negative, 'BS9-017').card.instanceId,
      trigger: 'activate', paymentIds: [payOne(negative)], targetIds: [battle(negative, 'BS9-017').card.instanceId],
    })).toThrow()

    const attackState = createCardCheckDemoState('BS9-017')
    const attackSource = battle(attackState, 'BS9-017')
    const attackCompanion = battle(attackState, 'BS8-026')
    const attackEffect = attackSource.card.type === 'cookie' ? attackSource.card.attackEffects![0] : null
    expect(getFixedModifierTargetIds(attackState, {
      sourcePlayerId: 'player-one', sourceInstanceId: attackSource.card.instanceId,
    }, attackEffect)).toEqual([attackSource.card.instanceId, attackCompanion.card.instanceId])
    const attackResolved = applyGameCommand(attackState, {
      kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [attackSource.card.instanceId, attackCompanion.card.instanceId],
    })
    expect(attackResolved.damageReceivedModifiers).toHaveLength(2)
    const logText = describeCommandSteps(attackState, attackResolved, {
      kind: 'resolve-attack-effect', playerId: 'player-one',
      targetIds: [attackSource.card.instanceId, attackCompanion.card.instanceId],
    })?.map(step => step.text).join('\n')
    expect(logText).toContain('3 點以上的傷害改為 2 點')
    expect(logText).not.toContain('傷害 +0')
    const opponent = attackResolved.players['player-two'].battleArea[1]
    for (const protectedCookie of [attackSource, attackCompanion]) {
      for (const amount of [0, 1, 2, 3, 5]) {
        expect(getEffectDamageAmount(attackResolved, {
          sourcePlayerId: 'player-two', sourceInstanceId: opponent.card.instanceId,
        }, amount, protectedCookie.card.instanceId)).toBe(amount >= 3 ? 2 : amount)
      }
      expect(getAttackDamageAgainst(attackResolved, opponent.card.instanceId, protectedCookie.card.instanceId)).toBe(2)
    }
    const ownTurnEnded = advancePhase({ ...attackResolved, phase: 'end' })
    expect(ownTurnEnded.damageReceivedModifiers).toHaveLength(2)
    expect(ownTurnEnded.players['player-two'].supportArea).toHaveLength(6)
    expect(ownTurnEnded.players['player-two'].supportArea.every(support => support.card.id === 'BS8-021' && !support.rested)).toBe(true)
    let opponentAttack: GameState = { ...ownTurnEnded, phase: 'main' }
    const opponentPayment = selectEnergyPayment(getAttackEnergyCostForState(opponentAttack, opponent.card.instanceId), opponentAttack.players['player-two'].supportArea)
    expect(opponentPayment).not.toBeNull()
    opponentAttack = applyGameCommand(opponentAttack, {
      kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: opponent.card.instanceId,
      targetInstanceId: attackCompanion.card.instanceId, supportPaymentIds: opponentPayment!,
    })
    expect(opponentAttack.pendingBattle?.declaredDamage).toBe(2)
    opponentAttack = applyGameCommand(opponentAttack, { kind: 'skip-trap', playerId: 'player-one' })
    for (let step = 0; opponentAttack.pendingBattle?.stage === 'damage' && step < 8; step++) {
      opponentAttack = applyGameCommand(opponentAttack, { kind: 'resolve-next-damage', playerId: 'player-one' })
    }
    expect(battle(opponentAttack, 'BS8-026').hpCards).toHaveLength(3)
    const opponentTurnEnded = advancePhase({ ...ownTurnEnded, phase: 'end' })
    expect(opponentTurnEnded.damageReceivedModifiers).toHaveLength(0)
    const attackNegative = createCardNegativeDemoState('BS9-017')
    const attackNegativeSource = battle(attackNegative, 'BS9-017')
    const attackNegativeCompanion = battle(attackNegative, 'BS8-105')
    const attackNegativeResolved = applyGameCommand(attackNegative, {
      kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [attackNegativeSource.card.instanceId],
    })
    expect(attackNegativeResolved.damageReceivedModifiers).toHaveLength(1)
    expect(getEffectDamageAmount(attackNegativeResolved, {
      sourcePlayerId: 'player-two', sourceInstanceId: opponent.card.instanceId,
    }, 3, attackNegativeCompanion.card.instanceId)).toBe(3)
    expect(() => applyGameCommand(attackNegative, {
      kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [attackNegativeSource.card.instanceId, attackNegativeCompanion.card.instanceId],
    })).toThrow()
  })

  it('keeps BS9-018 Your Turn protection and resolves BS9-019/020 item decisions', () => {
    const positiveHero = createBs9CandidatePreviewDemoState('BS9-018')
    const hero = battle(positiveHero, 'BS9-018')
    const ownTarget = battle(positiveHero, 'BS8-014')
    const opponent = battle(positiveHero, 'BS1-007', 'player-two')
    expect(getAttackDamageAgainst(positiveHero, opponent.card.instanceId, ownTarget.card.instanceId)).toBe(0)
    expect(getEffectDamageAmount(positiveHero, { sourcePlayerId: 'player-two', sourceInstanceId: opponent.card.instanceId }, 2, hero.card.instanceId)).toBe(0)
    const negativeHero = createCardNegativeDemoState('BS9-018')
    expect(getAttackDamageAgainst(negativeHero, battle(negativeHero, 'BS1-007', 'player-two').card.instanceId, battle(negativeHero, 'BS8-014').card.instanceId)).toBeGreaterThan(0)
    expect(getEffectDamageAmount(negativeHero, { sourcePlayerId: 'player-two', sourceInstanceId: battle(negativeHero, 'BS1-007', 'player-two').card.instanceId }, 2, battle(negativeHero, 'BS8-014').card.instanceId)).toBeGreaterThan(0)

    let itemState = createCardCheckDemoState('BS9-019')
    const item = handCard(itemState, 'BS9-019')
    itemState = applyGameCommand(itemState, { kind: 'begin-play-item', playerId: 'player-one', instanceId: item.instanceId, paymentIds: payN(itemState, 2) })
    itemState = applyGameCommand(itemState, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [battle(itemState, 'BS8-014').card.instanceId] })
    expect(itemState.attackModifiers).toContainEqual(expect.objectContaining({ sourceInstanceId: item.instanceId, amount: 1 }))
    expect(battle(itemState, 'BS8-014').hpCards).toHaveLength(5)

    let cutter = createCardCheckDemoState('BS9-020')
    const cutterCard = handCard(cutter, 'BS9-020')
    cutter = applyGameCommand(cutter, { kind: 'begin-play-item', playerId: 'player-one', instanceId: cutterCard.instanceId, paymentIds: [payOne(cutter)] })
    cutter = applyGameCommand(cutter, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    expect(cutter.pendingDrawUpTo).toMatchObject({ max: 2 })
    cutter = applyGameCommand(cutter, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount: 2 })
    expect(cutter.pendingOpponentHandDiscard).toMatchObject({ count: 1 })
    const discard = cutter.players['player-one'].hand[0]
    cutter = applyGameCommand(cutter, { kind: 'resolve-opponent-hand-discard', playerId: 'player-one', cardIds: [discard.instanceId] })
    expect(cutter.pendingOpponentHandDiscard).toBeNull()
    let negativeCutter = createCardNegativeDemoState('BS9-020')
    const negativeCutterCard = handCard(negativeCutter, 'BS9-020')
    negativeCutter = applyGameCommand(negativeCutter, { kind: 'begin-play-item', playerId: 'player-one', instanceId: negativeCutterCard.instanceId, paymentIds: [payOne(negativeCutter)] })
    expect(negativeCutter.pendingAbilityEffect).toBeUndefined()
    expect(negativeCutter.pendingDrawUpTo).toBeUndefined()
  })

  it('moves HP with BS9-021 and gates BS9-022/023 on opponent-owned HP markers', () => {
    let trapState = createCardCheckDemoState('BS9-021')
    const trap = handCard(trapState, 'BS9-021')
    const donor = battle(trapState, 'BS8-009', 'player-two')
    const receiver = battle(trapState, 'BS8-030')
    const donorTop = donor.hpCards.at(-1)!
    const receiverBottom = receiver.hpCards[0]!
    const transferEffect = trap.trap!.effects[0]!
    expect(getEffectTargetSelectionLimits(transferEffect)).toEqual({ min: 0, max: 1 })
    expect(() => applyGameCommand(trapState, {
      kind: 'play-trap', playerId: 'player-one', trapInstanceId: trap.instanceId,
      paymentIds: trapState.players['player-one'].supportArea.slice(0, 3).map((entry) => entry.card.instanceId),
      targetIds: trapState.players['player-two'].battleArea.map((entry) => entry.card.instanceId),
      selfTargetIds: [receiver.card.instanceId],
    })).toThrow()
    const payment = trapState.players['player-one'].supportArea.slice(0, 3).map((entry) => entry.card.instanceId)
    trapState = applyGameCommand(trapState, {
      kind: 'play-trap', playerId: 'player-one', trapInstanceId: trap.instanceId,
      paymentIds: payment, targetIds: [donor.card.instanceId], selfTargetIds: [receiver.card.instanceId],
    })
    expect(battle(trapState, 'BS8-030').hpCards).toHaveLength(6)
    expect(battle(trapState, 'BS8-009', 'player-two').hpCards).toHaveLength(4)
    expect(battle(trapState, 'BS8-030').hpCards[0]?.instanceId).toBe(donorTop.instanceId)
    expect(battle(trapState, 'BS8-030').hpCards[1]?.instanceId).toBe(receiverBottom.instanceId)
    expect(battle(trapState, 'BS8-030').faceUpHpCardInstanceIds).toContain(donorTop.instanceId)
    expect(trapState.foreignHpCardInstanceIds?.['bs9-trap-receiver']).toHaveLength(1)
    const negativeTrap = createCardNegativeDemoState('BS9-021')
    const negativeDonor = battle(negativeTrap, 'BS8-009', 'player-two')
    const negativeReceiver = battle(negativeTrap, 'BS8-030')
    const negativeResult = applyGameCommand(negativeTrap, {
      kind: 'play-trap', playerId: 'player-one', trapInstanceId: handCard(negativeTrap, 'BS9-021').instanceId,
      paymentIds: negativeTrap.players['player-one'].supportArea.slice(0, 3).map((entry) => entry.card.instanceId),
      targetIds: [negativeDonor.card.instanceId], selfTargetIds: [negativeReceiver.card.instanceId],
    })
    expect(negativeResult.foreignHpCardInstanceIds).toBeUndefined()

    for (const negative of [false, true]) {
      let state = negative ? createCardNegativeDemoState('BS9-022') : createCardCheckDemoState('BS9-022')
      const trapCard = handCard(state, 'BS9-022')
      const attacker = battle(state, 'BS8-007', 'player-two')
      state = applyGameCommand(state, {
        kind: 'play-trap', playerId: 'player-one', trapInstanceId: trapCard.instanceId,
        paymentIds: [state.players['player-one'].supportArea[0].card.instanceId], targetIds: [attacker.card.instanceId],
      })
      expect(state.attackModifiers).toContainEqual(expect.objectContaining({ targetInstanceId: attacker.card.instanceId, amount: -1 }))
      if (negative) expect(state.pendingDrawUpTo).toBeUndefined()
      else expect(state.pendingDrawUpTo).toMatchObject({ max: 1 })
    }

    let stageState = createCardCheckDemoState('BS9-023')
    const stageCard = handCard(stageState, 'BS9-023')
    stageState = applyGameCommand(stageState, { kind: 'play-stage', playerId: 'player-one', instanceId: stageCard.instanceId, paymentIds: [payOne(stageState)] })
    const stageTargets = stageState.players['player-one'].battleArea.map((entry) => entry.card.instanceId)
    stageState = applyGameCommand(stageState, {
      kind: 'begin-activate-stage', playerId: 'player-one', paymentIds: [payOne(stageState)], targetIds: stageTargets,
    })
    expect(stageState.players['player-one'].stage?.rested).toBe(true)
    expect(stageState.attackModifiers.filter((modifier) => modifier.sourceInstanceId === stageCard.instanceId)).toHaveLength(2)
    let negativeStage = createCardNegativeDemoState('BS9-023')
    const negativeStageCard = handCard(negativeStage, 'BS9-023')
    negativeStage = applyGameCommand(negativeStage, { kind: 'play-stage', playerId: 'player-one', instanceId: negativeStageCard.instanceId, paymentIds: [payOne(negativeStage)] })
    expect(() => applyGameCommand(negativeStage, {
      kind: 'begin-activate-stage', playerId: 'player-one', paymentIds: [payOne(negativeStage)], targetIds: [],
    })).toThrow()
  })

  it('keeps the batch candidate-only and localhost-only', () => {
    expect(parseTestStateConfig('?test-state=bs9-card:BS9-010', 'localhost')).toEqual({ kind: 'bs9-candidate', cardNumber: 'BS9-010', negative: false })
    expect(parseTestStateConfig('?test-state=bs9-card-negative:BS9-023', 'localhost')).toEqual({ kind: 'bs9-candidate', cardNumber: 'BS9-023', negative: true })
    expect(parseTestStateConfig('?test-state=bs9-card:BS9-010', 'braverse.example')).toBeNull()
  })
})
