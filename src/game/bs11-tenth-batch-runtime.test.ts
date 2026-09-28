import { describe, expect, it } from 'vitest'
import bs11 from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialAttackEffects,
  convertOfficialCardEffects,
} from '../cards/official-effect-adapter'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { resolveAttackEffect } from './battle'
import { canActivateCookieSkill } from './skills'
import { executeCardEffect } from './effects/execute'
import { isEffectConditionMet } from './effects/targeting'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'
import type {
  CookieInBattle,
  EffectContext,
  GameCard,
  GameState,
  PendingBattle,
  CookieCard,
} from './types'

const records = bs11.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, `bs11-tenth-runtime-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${cardNumber}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const cookieCandidate = (cardNumber: string, suffix: string): CookieCard => {
  const card = candidate(cardNumber, suffix)
  if (card.type !== 'cookie') throw new Error(`${cardNumber} must be a Cookie`)
  return card
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

const contextFor = (sourcePlayerId: 'player-one' | 'player-two', source: GameCard): EffectContext => ({
  sourcePlayerId,
  sourceInstanceId: source.instanceId,
  sourceCardName: source.name,
})

describe('BS11-032 to BS11-035 runtime boundaries', () => {
  it('BS11-032 requires a level-3 Cookie played from Break and then trashes the source', () => {
    const base = createBattleState()
    const source = cookieCandidate('BS11-032', 'skill-source')
    const conversion = convertOfficialCardEffects(records.find((card) => card.cardNumber === 'BS11-032')!)
    if (conversion.status !== 'supported') throw new Error('BS11-032 effects must convert')
    const effect = conversion.effects[0]!
    const context = contextFor('player-one', source)
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [entry(source, [item('bs11-032-source-hp')])],
        },
      },
      cookiesPlayedFromBreakThisTurn: { 'player-one': true },
      cookieLevelsPlayedFromBreakThisTurn: { 'player-one': [2] },
    }

    expect(isEffectConditionMet(state, context, effect)).toBe(false)
    const levelThree = {
      ...state,
      cookieLevelsPlayedFromBreakThisTurn: { 'player-one': [3] },
    }
    expect(isEffectConditionMet(levelThree, context, effect)).toBe(true)
    const levelFour = {
      ...state,
      cookieLevelsPlayedFromBreakThisTurn: { 'player-one': [4] },
    }
    expect(isEffectConditionMet(levelFour, context, effect)).toBe(false)

    const resolved = executeCardEffect(levelThree, context, effect, [source.instanceId])
    expect(resolved.players['player-one'].battleArea).toHaveLength(0)
    expect(resolved.players['player-one'].discardPile).toContainEqual(source)
  })

  it('BS11-034 accepts only a hand Cookie combination whose level sum is 3', () => {
    const base = createBattleState()
    const source = cookieCandidate('BS11-034', 'skill-source')
    const levelOne = cookieCandidate('BS11-032', 'reveal-level-one')
    const levelTwo = { ...cookieCandidate('BS11-032', 'reveal-level-two'), level: 2 }
    const state: GameState = {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [levelOne, levelTwo],
          battleArea: [],
          breakArea: [source],
          deck: Array.from({ length: 8 }, (_, index) => item(`bs11-034-deck-${index}`)),
        },
      },
    }

    expect(canActivateCookieSkill(state, 'player-one', source.instanceId, 'activate')).toBe(true)
    const pending = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })
    expect(pending.pendingAbilityEffect?.effects[0]).toMatchObject({
      kind: 'reveal-hand',
      minAmount: 1,
      maxAmount: 3,
      levelSum: 3,
    })
    expect(() => applyGameCommand(pending, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [levelOne.instanceId],
    })).toThrow()

    const afterReveal = applyGameCommand(pending, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [levelOne.instanceId, levelTwo.instanceId],
    })
    const afterPlay = applyGameCommand(afterReveal, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    const resolved = applyGameCommand(afterPlay, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(resolved.pendingAbilityEffect).toBeUndefined()
    expect(resolved.players['player-one'].battleArea[0]?.card.instanceId).toBe(source.instanceId)
    expect(resolved.players['player-one'].battleArea[0]?.hpCards).toHaveLength(5)
    expect(resolved.players['player-one'].breakArea).toEqual(
      expect.arrayContaining([levelOne, levelTwo]),
    )
  })

  it('BS11-035 pays 2Y before its On Play sequence and rejects incomplete payment', () => {
    const base = createBattleState()
    const source = candidate('BS11-035', 'on-play-source')
    const placed = candidate('BS11-032', 'on-play-placed')
    const yellowA = item('bs11-035-yellow-a', 'yellow')
    const yellowB = item('bs11-035-yellow-b', 'yellow')
    const state: GameState = {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [placed],
          battleArea: [entry(source, Array.from({ length: 6 }, (_, index) => item(`bs11-035-source-hp-${index}`)))],
          supportArea: [
            { card: yellowA, rested: false },
            { card: yellowB, rested: false },
          ],
        },
      },
      pendingOnPlay: {
        playerId: 'player-one',
        sourceInstanceId: source.instanceId,
        origin: 'hand',
      },
    }

    expect(canActivateCookieSkill(state, 'player-one', source.instanceId, 'on-play')).toBe(true)
    const paid = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
      trigger: 'on-play',
      paymentIds: [yellowA.instanceId, yellowB.instanceId],
    })
    expect(paid.players['player-one'].supportArea.every((support) => support.rested)).toBe(true)
    const afterPlace = applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [placed.instanceId],
    })
    const skippedReturn = applyGameCommand(afterPlace, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(skippedReturn.pendingAbilityEffect).toBeUndefined()
    expect(skippedReturn.players['player-one'].breakArea).toContainEqual(placed)

    const invalid = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          supportArea: [{ card: yellowA, rested: false }],
        },
      },
    }
    expect(canActivateCookieSkill(invalid, 'player-one', source.instanceId, 'on-play')).toBe(false)
    expect(() => applyGameCommand(invalid, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
      trigger: 'on-play',
      paymentIds: [yellowA.instanceId],
    })).toThrow()

    const noCookieInHand = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          hand: [],
        },
      },
    }
    expect(canActivateCookieSkill(noCookieInHand, 'player-one', source.instanceId, 'on-play')).toBe(false)
  })

  it('keeps attack Then order, accepts zero target for optional damage, and validates FLIP payment', () => {
    const source = candidate('BS11-035', 'attack-source')
    const target = entry(cookie('bs11-035-target', 1, 5), Array.from({ length: 5 }, (_, index) => item(`bs11-035-target-hp-${index}`)))
    const flip = candidate('BS11-019', 'attack-flip')
    const yellow = item('bs11-035-attack-yellow', 'yellow')
    const attackEffects = convertOfficialAttackEffects(records.find((card) => card.cardNumber === 'BS11-035')!)
    if (!attackEffects) throw new Error('BS11-035 attack effects must convert')
    const base = createBattleState()
    const battle: PendingBattle = {
      attackerPlayerId: 'player-two',
      defenderPlayerId: 'player-one',
      attackerInstanceId: source.instanceId,
      targetInstanceId: target.card.instanceId,
      declaredDamage: 0,
      remainingDamage: 0,
      stage: 'attack-effect',
      trapUsed: true,
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects,
      attackEffectIndex: 0,
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': { ...base.players['player-one'], battleArea: [target] },
        'player-two': {
          ...base.players['player-two'],
          hand: [flip],
          battleArea: [entry(source, Array.from({ length: 6 }, (_, index) => item(`bs11-035-attack-source-hp-${index}`)))],
          supportArea: [{ card: yellow, rested: false }],
        },
      },
      pendingBattle: battle,
    }
    const opened = resolveAttackEffect(state, 'player-two', [])
    expect(opened.pendingOptionalCostAttack).toMatchObject({
      cost: { energy: { yellow: 1 }, discardHand: 1, discardHandHasFlip: true },
    })
    expect(() => applyGameCommand(opened, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-two',
      action: 'pay',
      paymentIds: [],
      discardCardIds: [flip.instanceId],
      targetIds: [],
    })).toThrow()

    const paid = applyGameCommand(opened, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-two',
      action: 'pay',
      paymentIds: [yellow.instanceId],
      discardCardIds: [flip.instanceId],
      targetIds: [target.card.instanceId],
    })
    expect(paid.pendingOptionalCostAttack).toBeNull()
    expect(paid.players['player-two'].discardPile).toContainEqual(flip)
    expect(paid.players['player-two'].supportArea[0]?.rested).toBe(true)
  })

  it('BS11-032 attack draws only after optional other-Yellow movement resolves', () => {
    const source = candidate('BS11-032', 'attack-source')
    const other = candidate('BS11-033', 'attack-other')
    const attackEffects = convertOfficialAttackEffects(records.find((card) => card.cardNumber === 'BS11-032')!)
    if (!attackEffects) throw new Error('BS11-032 attack effects must convert')
    const base = createBattleState()
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            entry(source, [item('bs11-032-attack-source-hp')]),
            entry(other, [item('bs11-032-attack-other-hp')]),
          ],
        },
      },
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: source.instanceId,
        targetInstanceId: base.players['player-one'].battleArea[0]!.card.instanceId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: true,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects,
        attackEffectIndex: 0,
      },
    }
    const afterMovement = resolveAttackEffect(state, 'player-two', [other.instanceId])
    expect(afterMovement.players['player-two'].battleArea).toHaveLength(1)
    expect(afterMovement.players['player-two'].breakArea).toContainEqual(other)
    expect(afterMovement.pendingBattle?.attackEffectIndex).toBe(0)
    expect(afterMovement.pendingAbilityEffect?.effects[0]).toMatchObject({
      kind: 'draw-up-to',
      max: 1,
    })
    const afterDraw = applyGameCommand(afterMovement, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [],
    })
    expect(afterDraw.pendingDrawUpTo).toMatchObject({ max: 1 })

    const noOtherTarget = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          battleArea: [entry(source, [item('bs11-032-only-source-hp')])],
        },
      },
    }
    const skipped = resolveAttackEffect(noOtherTarget, 'player-two', [])
    expect(skipped.pendingDrawUpTo).toBeUndefined()
    expect(skipped.pendingBattle).toBeNull()
  })

  it('BS11-033 always draws, while its HP-gain condition only controls self-trash', () => {
    const source = candidate('BS11-033', 'attack-source')
    const attackEffects = convertOfficialAttackEffects(records.find((card) => card.cardNumber === 'BS11-033')!)
    if (!attackEffects) throw new Error('BS11-033 attack effects must convert')
    const base = createBattleState()
    const targetInstanceId = base.players['player-one'].battleArea[0]!.card.instanceId
    const makeState = (gainedHp: boolean): GameState => ({
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [entry(source, [item('bs11-033-attack-source-hp')])],
        },
      },
      ...(gainedHp ? { cookiesGainedHpThisTurn: { 'player-two': true } } : {}),
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: source.instanceId,
        targetInstanceId,
        declaredDamage: 0,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: true,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects,
        attackEffectIndex: 0,
      },
    })

    const withoutHpGain = resolveAttackEffect(makeState(false), 'player-two', [])
    expect(withoutHpGain.pendingBattle?.attackEffectIndex).toBe(1)
    const withoutTrash = resolveAttackEffect(withoutHpGain, 'player-two', [])
    expect(withoutTrash.pendingDrawUpTo).toMatchObject({ max: 1 })
    expect(withoutTrash.players['player-two'].battleArea).toHaveLength(1)

    const withHpGain = resolveAttackEffect(makeState(true), 'player-two', [source.instanceId])
    expect(withHpGain.players['player-two'].battleArea).toHaveLength(0)
    expect(withHpGain.players['player-two'].discardPile).toContainEqual(source)
    const withTrash = resolveAttackEffect(withHpGain, 'player-two', [])
    expect(withTrash.pendingDrawUpTo).toMatchObject({ max: 1 })
  })
})
