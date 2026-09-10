import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import bs9Candidates from '../../data/candidates/official-a-game-of-truth-and-deceit-bs9.en.json'
import {
  createBs9ActualDamageDemoState,
  createBs9CandidatePreviewDemoState,
  parseTestStateConfig,
} from './demo'
import { applyGameCommand } from './commands'
import { resolveFlip } from './battle'
import {
  getAttackDamageAgainst,
  getEffectDamageAmount,
  isEffectConditionMet,
} from './effects'
import { advancePhase } from './turn'
import type { CardEffect, EffectContext, GameCard, GameState } from './types'

const candidate = (cardNumber: string): GameCard => {
  const records = bs9Candidates.cards as unknown as OfficialCardRecord[]
  const source = records.find((card) => card.cardNumber === cardNumber) ??
    records.find((card) => card.baseCardNumber === cardNumber)
  if (!source) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  const conversion = convertOfficialCardToGameCard(source, 'bs9-test')
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.gameCard
}

const sourceInBattle = (state: GameState, cardNumber: string) => {
  const source = state.players['player-one'].battleArea.find(
    (entry) => entry.card.id === cardNumber,
  )
  if (!source) throw new Error(`${cardNumber} source is not in battle area`)
  return source
}

const ownCompanionInBattle = (state: GameState) => {
  const companion = state.players['player-one'].battleArea.find(
    (entry) => entry.card.id === 'BS8-014' || entry.card.id === 'BS8-026',
  )
  if (!companion) throw new Error('physical BS9 companion is not in battle area')
  return companion
}

const opponentInBattle = (state: GameState, cardId: string) => {
  const opponent = state.players['player-two'].battleArea.find(
    (entry) => entry.card.id === cardId,
  )
  if (!opponent) throw new Error(`physical opponent ${cardId} is not in battle area`)
  return opponent
}

const deployFromHand = (state: GameState, cardNumber: string): GameState => {
  const card = state.players['player-one'].hand.find((entry) => entry.id === cardNumber)
  if (!card) throw new Error(`${cardNumber} source is not in hand`)
  return applyGameCommand(state, {
    kind: 'deploy-cookie',
    playerId: 'player-one',
    instanceId: card.instanceId,
  })
}

describe('BS9-002～009 first candidate batch', () => {
  it('converts the audited cards and variants with the printed effect boundaries', () => {
    expect(candidate('BS9-002').skill?.effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: 1,
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      condition: {
        kind: 'cookies-fainted-during-opponent-previous-turn-at-least',
        side: 'self',
        count: 1,
        energyColor: 'red',
        minLevel: 1,
        maxLevel: 1,
      },
    })
    expect(candidate('BS9-002@1').skill?.effects[0]).toEqual(
      candidate('BS9-002').skill?.effects[0],
    )
    expect(candidate('BS9-003').skill?.effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: 1,
      duration: 'this-turn',
      target: { side: 'self', min: 0, max: 1 },
    })
    expect(candidate('BS9-003@1').skill?.effects[0]).toEqual(
      candidate('BS9-003').skill?.effects[0],
    )
    expect(candidate('BS9-005').flip).toMatchObject({
      cost: { energy: {}, discardHand: 1 },
      effects: [],
      attachedHpBonus: 1,
    })
    expect(candidate('BS9-005@1').flip).toEqual(candidate('BS9-005').flip)
    expect(candidate('BS9-006').skill?.effects[0]).toMatchObject({
      kind: 'modify-damage-received',
      amount: -3,
      duration: 'this-turn',
      damageType: 'all',
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      condition: { kind: 'cookies-fainted-this-turn-at-least', side: 'self', count: 2 },
    })
    expect(candidate('BS9-006@1').skill?.effects[0]).toEqual(
      candidate('BS9-006').skill?.effects[0],
    )
    expect(candidate('BS9-007').flip?.effects).toEqual([
      { kind: 'draw-up-to', max: 1 },
    ])
    expect(candidate('BS9-007@1').flip?.effects).toEqual(candidate('BS9-007').flip?.effects)
    expect(candidate('BS9-004').skill).toBeUndefined()
    expect(candidate('BS9-008').skill).toBeUndefined()
    expect(candidate('BS9-009').skill?.effects[0]).toMatchObject({
      kind: 'draw-up-to',
      max: 1,
      condition: { kind: 'cookies-fainted-this-turn-at-least', side: 'opponent', count: 1 },
    })
  })

  it('filters BS9-002 by the prior-turn owner, colour, and level', () => {
    const effect = candidate('BS9-002').skill!.effects[0] as CardEffect
    const base = createBs9CandidatePreviewDemoState('BS9-002', true)
    const context: EffectContext = {
      sourcePlayerId: 'player-one',
      sourceInstanceId: sourceInBattle(base, 'BS9-002').card.instanceId,
    }
    const matching = {
      ...base,
      cookiesFaintedDuringOpponentPreviousTurn: {
        'player-one': [{ energyColor: 'red' as const, level: 1 }],
      },
    }
    expect(isEffectConditionMet(matching, context, effect)).toBe(true)
    expect(isEffectConditionMet({
      ...matching,
      cookiesFaintedDuringOpponentPreviousTurn: {
        'player-one': [{ energyColor: 'yellow' as const, level: 1 }],
      },
    }, context, effect)).toBe(false)
    expect(isEffectConditionMet({
      ...matching,
      cookiesFaintedDuringOpponentPreviousTurn: {
        'player-one': [{ energyColor: 'red' as const, level: 2 }],
      },
    }, context, effect)).toBe(false)
    expect(isEffectConditionMet({
      ...matching,
      cookiesFaintedDuringOpponentPreviousTurn: {
        'player-two': [{ energyColor: 'red' as const, level: 1 }],
      },
    }, context, effect)).toBe(false)
  })

  it('snapshots the ending turn before the next Active Phase resets current details', () => {
    const state = createBs9CandidatePreviewDemoState('BS9-002')
    const witness = { energyColor: 'red' as const, level: 1 }
    const next = advancePhase({
      ...state,
      phase: 'end',
      activePlayerId: 'player-one',
      cookiesFaintedThisTurnDetails: {
        'player-one': [witness],
        'player-two': [],
      },
    })

    expect(next.activePlayerId).toBe('player-two')
    expect(next.cookiesFaintedDuringOpponentPreviousTurn?.['player-one']).toEqual([witness])
    expect(next.cookiesFaintedThisTurnDetails?.['player-one']).toEqual([witness])

    const nextActive = advancePhase(next)
    expect(nextActive.cookiesFaintedThisTurnDetails).toEqual({})
    expect(nextActive.cookiesFaintedDuringOpponentPreviousTurn?.['player-one']).toEqual([witness])
  })

  it('activates BS9-002 only on the matching prior-turn witness and expires at turn end', () => {
    const sourceId = sourceInBattle(
      createBs9CandidatePreviewDemoState('BS9-002'),
      'BS9-002',
    ).card.instanceId
    const initial = createBs9CandidatePreviewDemoState('BS9-002')
    const activated = applyGameCommand(initial, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: sourceId,
      trigger: 'activate',
      paymentIds: [],
      targetIds: [sourceId],
    })
    expect(activated.attackModifiers).toContainEqual(expect.objectContaining({
      sourceInstanceId: sourceId,
      targetInstanceId: sourceId,
      amount: 1,
      expiresAfterTurn: 2,
    }))
    const expired = advancePhase(advancePhase(activated))
    expect(expired.attackModifiers).toEqual([])
    const negative = createBs9CandidatePreviewDemoState('BS9-002', true)
    expect(() => applyGameCommand(negative, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: sourceId,
      trigger: 'activate',
      paymentIds: [],
      targetIds: [sourceId],
    })).toThrow()
  })

  it('resolves BS9-003 On Play through the real target selection', () => {
    const deployed = deployFromHand(
      createBs9CandidatePreviewDemoState('BS9-003'),
      'BS9-003',
    )
    const source = sourceInBattle(deployed, 'BS9-003')
    const target = ownCompanionInBattle(deployed)
    const resolved = applyGameCommand(deployed, {
      kind: 'activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      trigger: 'on-play',
      paymentIds: [],
      effectTargets: [[target.card.instanceId]],
    })
    expect(resolved.attackModifiers).toContainEqual(expect.objectContaining({
      sourceInstanceId: source.card.instanceId,
      targetInstanceId: target.card.instanceId,
      amount: 1,
    }))
  })

  it('applies BS9-006 reduction to both attack and effect damage, with zero floor', () => {
    const deployed = deployFromHand(
      createBs9CandidatePreviewDemoState('BS9-006'),
      'BS9-006',
    )
    const source = sourceInBattle(deployed, 'BS9-006')
    const resolved = applyGameCommand(deployed, {
      kind: 'activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      trigger: 'on-play',
      paymentIds: [],
      effectTargets: [[source.card.instanceId]],
    })
    expect(resolved.damageReceivedModifiers).toContainEqual(expect.objectContaining({
      targetInstanceId: source.card.instanceId,
      amount: -3,
      damageType: 'all',
    }))
    expect(getAttackDamageAgainst(
      resolved,
      opponentInBattle(resolved, 'BS8-002').card.instanceId,
      source.card.instanceId,
    )).toBe(0)
    expect(getEffectDamageAmount(
      resolved,
      { sourcePlayerId: 'player-two', sourceInstanceId: opponentInBattle(resolved, 'BS8-002').card.instanceId },
      2,
      source.card.instanceId,
    )).toBe(0)
    expect(getEffectDamageAmount(
      resolved,
      { sourcePlayerId: 'player-two', sourceInstanceId: opponentInBattle(resolved, 'BS8-002').card.instanceId },
      5,
      source.card.instanceId,
    )).toBe(2)
    const expired = advancePhase(advancePhase(resolved))
    expect(expired.damageReceivedModifiers).toEqual([])
    const negative = deployFromHand(
      createBs9CandidatePreviewDemoState('BS9-006', true),
      'BS9-006',
    )
    const negativeSource = sourceInBattle(negative, 'BS9-006')
    expect(() => applyGameCommand(negative, {
      kind: 'activate-skill',
      playerId: 'player-one',
      sourceInstanceId: negativeSource.card.instanceId,
      trigger: 'on-play',
      paymentIds: [],
      effectTargets: [[negativeSource.card.instanceId]],
    })).toThrow()
  })

  it('proves BS9-006 reduction through an actual same-turn attack resolution', () => {
    const resolveIncomingAttack = (initial: GameState): GameState => {
      const source = sourceInBattle(initial, 'BS9-006')
      const attacker = opponentInBattle(initial, 'BS8-002')
      const payment = initial.players['player-two'].supportArea[0]
      if (!payment) throw new Error('BS9-006 damage fixture has no opponent payment')

      let next = applyGameCommand(initial, {
        kind: 'declare-attack',
        playerId: 'player-two',
        attackerInstanceId: attacker.card.instanceId,
        targetInstanceId: source.card.instanceId,
        supportPaymentIds: [payment.card.instanceId],
      })
      expect(next.pendingBattle?.stage).toBe('trap')

      next = applyGameCommand(next, { kind: 'skip-trap', playerId: 'player-one' })
      expect(next.pendingBattle?.stage).toBe('damage')
      return applyGameCommand(next, {
        kind: 'resolve-next-damage',
        playerId: 'player-one',
      })
    }

    const positiveInitial = createBs9ActualDamageDemoState('BS9-006')
    expect(positiveInitial.damageReceivedModifiers).toContainEqual(expect.objectContaining({
      targetInstanceId: sourceInBattle(positiveInitial, 'BS9-006').card.instanceId,
      amount: -3,
    }))
    const positiveResolved = resolveIncomingAttack(positiveInitial)
    expect(positiveResolved.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
    expect(positiveResolved.pendingBattle).toBeNull()
    expect(positiveResolved.commandLog?.some((entry) => entry.commandKind === 'declare-attack')).toBe(true)

    const negativeInitial = createBs9ActualDamageDemoState('BS9-006', true)
    expect(negativeInitial.damageReceivedModifiers).toEqual([])
    const negativeResolved = resolveIncomingAttack(negativeInitial)
    expect(negativeResolved.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
    expect(negativeResolved.pendingBattle).toBeNull()
  })

  it('resolves BS9-005 attached HP and BS9-007 optional draw through FLIP', () => {
    const flip = createBs9CandidatePreviewDemoState('BS9-005')
    const payment = flip.players['player-one'].hand[0].instanceId
    const beforeHp = flip.players['player-one'].battleArea[0].hpCards.length
    const resolved = resolveFlip(flip, 'player-one', {
      activate: true,
      discardHandIds: [payment],
    })
    expect(resolved.players['player-one'].battleArea[0].hpCards.length).toBe(beforeHp + 1)
    expect(resolved.players['player-one'].discardPile.some((card) => card.instanceId === payment)).toBe(true)

    const drawFlip = createBs9CandidatePreviewDemoState('BS9-007')
    const drawResolved = resolveFlip(drawFlip, 'player-one', { activate: true })
    expect(drawResolved.pendingDrawUpTo).toMatchObject({
      playerId: 'player-one',
      max: 1,
      sourceCardName: 'Cherry Blossom Cookie',
    })
    const drawCount = drawResolved.players['player-one'].deck.length > 0 ? 1 : 0
    const afterDraw = applyGameCommand(drawResolved, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount,
    })
    expect(afterDraw.pendingDrawUpTo).toBeNull()
  })

  it('resolves BS9-009 conditionally and keeps 004/008 vanilla cards deployable', () => {
    const deployed = deployFromHand(
      createBs9CandidatePreviewDemoState('BS9-009'),
      'BS9-009',
    )
    const source = sourceInBattle(deployed, 'BS9-009')
    const resolved = applyGameCommand(deployed, {
      kind: 'activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      trigger: 'on-play',
      paymentIds: [],
      effectTargets: [[]],
    })
    expect(resolved.pendingDrawUpTo).toMatchObject({ max: 1, sourceCardId: 'BS9-009' })

    const negative = deployFromHand(
      createBs9CandidatePreviewDemoState('BS9-009', true),
      'BS9-009',
    )
    const negativeSource = sourceInBattle(negative, 'BS9-009')
    expect(() => applyGameCommand(negative, {
      kind: 'activate-skill',
      playerId: 'player-one',
      sourceInstanceId: negativeSource.card.instanceId,
      trigger: 'on-play',
      paymentIds: [],
      effectTargets: [[]],
    })).toThrow()

    for (const cardNumber of ['BS9-004', 'BS9-008'] as const) {
      const state = createBs9CandidatePreviewDemoState(cardNumber)
      const card = state.players['player-one'].hand.find((entry) => entry.id === cardNumber)
      expect(card).toBeDefined()
      const deployedVanilla = deployFromHand(state, cardNumber)
      expect(deployedVanilla.players['player-one'].battleArea.some((entry) => entry.card.id === cardNumber)).toBe(true)
    }
  })

  it('keeps all first-batch routes localhost-only and candidate-isolated', () => {
    expect(parseTestStateConfig('?test-state=bs9-card:BS9-009', 'localhost')).toEqual({
      kind: 'bs9-candidate', cardNumber: 'BS9-009', negative: false,
    })
    expect(parseTestStateConfig('?test-state=bs9-card-negative:BS9-006@1', 'localhost')).toEqual({
      kind: 'bs9-candidate', cardNumber: 'BS9-006@1', negative: true,
    })
    expect(parseTestStateConfig('?test-state=bs9-damage:BS9-006', 'localhost')).toEqual({
      kind: 'bs9-damage', cardNumber: 'BS9-006', negative: false,
    })
    expect(parseTestStateConfig('?test-state=bs9-damage-negative:BS9-006@1', 'localhost')).toEqual({
      kind: 'bs9-damage', cardNumber: 'BS9-006@1', negative: true,
    })
    expect(parseTestStateConfig('?test-state=bs9-card:BS9-009', 'braverse.example')).toBeNull()
  })
})
