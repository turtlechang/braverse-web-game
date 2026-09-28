import { describe, expect, it } from 'vitest'
import bs11 from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { convertOfficialAttackEffects } from '../cards/official-effect-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { resolveAttackEffect } from './battle'
import { applyGameCommand } from './commands'
import { getAttackEnergyCostForState } from './energy'
import { canActivateCookieSkill } from './skills'
import { createBattleState, cookie, item } from './test-helpers/battle-helpers'
import type { CookieInBattle, GameCard, GameState, PendingBattle } from './types'

const records = bs11.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, `bs11-eleventh-runtime-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${cardNumber}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const entry = (card: GameCard, hpCards: GameCard[]): CookieInBattle => ({
  card: card as CookieInBattle['card'],
  hpCards,
  rested: false,
  battleEntryId: `${card.instanceId}:battle`,
})

const attackPending = (
  attacker: GameCard,
  attackEffects: NonNullable<Extract<GameCard, { type: 'cookie' }>['attackEffects']>,
  targetInstanceId: string,
): PendingBattle => ({
  attackerPlayerId: 'player-two',
  defenderPlayerId: 'player-one',
  attackerInstanceId: attacker.instanceId,
  targetInstanceId,
  declaredDamage: 0,
  remainingDamage: 0,
  stage: 'attack-effect',
  trapUsed: false,
  revealedHpCard: null,
  preventKnockoutTargetIds: [],
  faintedColors: [],
  attackEffects,
  attackEffectIndex: 0,
})

describe('BS11-036 to BS11-039 runtime boundaries', () => {
  it('BS11-036 applies one neutral attack-cost increase only without another same-name Cookie', () => {
    const base = createBattleState()
    const source = candidate('BS11-036', 'skill-source')
    const other = candidate('BS11-036', 'skill-other')
    const target = cookie('bs11-036-target', 2, 2)
    const state: GameState = {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [entry(source, [item('bs11-036-source-hp')])],
          hand: [],
          supportArea: [],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [entry(target, [item('bs11-036-target-hp')])],
        },
      },
    }

    expect(canActivateCookieSkill(state, 'player-one', source.instanceId, 'activate')).toBe(true)
    const activated = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })
    const resolved = applyGameCommand(activated, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [target.instanceId],
    })
    expect(resolved.attackCostModifiers).toContainEqual(expect.objectContaining({
      targetInstanceId: target.instanceId,
      energyCost: { neutral: 1 },
      operation: 'increase',
      expiresAfterTurn: 3,
    }))
    expect(getAttackEnergyCostForState(resolved, target.instanceId)).toEqual({ red: 1, neutral: 1 })
    expect(canActivateCookieSkill(resolved, 'player-one', source.instanceId, 'activate')).toBe(false)

    const duplicate = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [
            entry(source, [item('bs11-036-duplicate-source-hp')]),
            entry(other, [item('bs11-036-duplicate-other-hp')]),
          ],
        },
      },
    }
    expect(canActivateCookieSkill(duplicate, 'player-one', source.instanceId, 'activate')).toBe(false)
    expect(() => applyGameCommand(duplicate, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })).toThrow()
  })

  it('BS11-036 attack Then gains HP only at remaining HP 3 or lower', () => {
    const source = candidate('BS11-036', 'attack-source')
    const attackEffects = convertOfficialAttackEffects(records.find((card) => card.cardNumber === 'BS11-036')!)
    if (!attackEffects) throw new Error('BS11-036 attack effects must convert')
    const makeState = (hpCount: number): GameState => {
      const base = createBattleState()
      return {
        ...base,
        players: {
          ...base.players,
          'player-two': {
            ...base.players['player-two'],
            battleArea: [entry(source, Array.from({ length: hpCount }, (_, index) => item(`bs11-036-attack-hp-${hpCount}-${index}`)))],
            deck: [item(`bs11-036-gain-hp-${hpCount}`)],
          },
        },
        pendingBattle: attackPending(
          source,
          attackEffects as NonNullable<Extract<GameCard, { type: 'cookie' }>['attackEffects']>,
          base.players['player-one'].battleArea[0]!.card.instanceId,
        ),
      }
    }

    const gained = resolveAttackEffect(makeState(3), 'player-two', [source.instanceId])
    expect(gained.players['player-two'].battleArea[0]?.hpCards).toHaveLength(4)
    expect(gained.players['player-two'].deck).toHaveLength(0)

    const skipped = resolveAttackEffect(makeState(4), 'player-two', [source.instanceId])
    expect(skipped.players['player-two'].battleArea[0]?.hpCards).toHaveLength(4)
    expect(skipped.players['player-two'].deck).toHaveLength(1)
  })

  it('BS11-038 requires Shine Muscat and sets at most one rested support active once per turn', () => {
    const base = createBattleState()
    const source = candidate('BS11-038', 'skill-source')
    const shine = { ...source, id: 'shine-muscat', instanceId: 'shine-muscat', name: 'Shine Muscat Cookie' }
    const support = { card: item('bs11-038-support', 'green'), rested: true }
    const state: GameState = {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [entry(source, [item('bs11-038-source-hp')]), entry(shine, [item('bs11-038-shine-hp')])],
          supportArea: [support],
        },
      },
    }

    expect(canActivateCookieSkill(state, 'player-one', source.instanceId, 'activate')).toBe(true)
    const activated = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
      trigger: 'activate',
      paymentIds: [],
    })
    const resolved = applyGameCommand(activated, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [support.card.instanceId],
    })
    expect(resolved.players['player-one'].supportArea[0]?.rested).toBe(false)
    expect(canActivateCookieSkill(resolved, 'player-one', source.instanceId, 'activate')).toBe(false)

    const withoutShine = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [entry(source, [item('bs11-038-no-shine-source-hp')])],
        },
      },
    }
    expect(canActivateCookieSkill(withoutShine, 'player-one', source.instanceId, 'activate')).toBe(false)
  })

  it('BS11-039 pays one hand card when the attached FLIP is revealed in battle', () => {
    const base = createBattleState()
    const flip = candidate('BS11-039', 'flip')
    const bearer = cookie('bs11-039-bearer', 1, 2)
    const attacker = cookie('bs11-039-attacker', 1, 1)
    const handCost = item('bs11-039-hand-cost')
    const hpTop = item('bs11-039-hp-top')
    const makeState = (hand: GameCard[]): GameState => ({
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [entry(bearer, [item('bs11-039-bearer-bottom'), flip])],
          hand,
          deck: [hpTop],
          discardPile: [],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [entry(attacker, [item('bs11-039-attacker-hp')])],
        },
      },
    })

    let state = makeState([handCost])
    state = applyGameCommand(state, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: attacker.instanceId,
      targetInstanceId: bearer.instanceId,
      supportPaymentIds: ['p2-support'],
    })
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-one' })
    expect(state.pendingBattle?.stage).toBe('flip')

    const paid = applyGameCommand(state, {
      kind: 'resolve-flip',
      playerId: 'player-one',
      activate: true,
      discardHandIds: [handCost.instanceId],
    })
    expect(paid.players['player-one'].battleArea[0]?.hpCards.map((card) => card.instanceId)).toEqual([
      'bs11-039-bearer-bottom',
      hpTop.instanceId,
    ])
    expect(paid.players['player-one'].hand).toEqual([])
    expect(paid.players['player-one'].discardPile).toEqual(
      expect.arrayContaining([flip, handCost]),
    )
    const afterFlipDraw = paid.pendingDrawUpTo
      ? applyGameCommand(paid, {
        kind: 'resolve-draw-up-to',
        playerId: 'player-one',
        drawCount: 0,
      })
      : paid
    const afterFlipRefresh = afterFlipDraw.pendingRefresh
      ? applyGameCommand(afterFlipDraw, {
        kind: 'refresh-deck',
        playerId: 'player-one',
        cookieInstanceId: flip.instanceId,
        shuffleSeed: 11,
      })
      : afterFlipDraw
    const resolved = applyGameCommand(afterFlipRefresh, {
      kind: 'resolve-next-damage',
      playerId: 'player-one',
    })
    expect(resolved.pendingBattle).toBeNull()

    const noCost = makeState([])
    const noCostAttack = applyGameCommand(noCost, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: attacker.instanceId,
      targetInstanceId: bearer.instanceId,
      supportPaymentIds: ['p2-support'],
    })
    const noCostAfterTrap = applyGameCommand(noCostAttack, { kind: 'skip-trap', playerId: 'player-one' })
    const noCostFlip = applyGameCommand(noCostAfterTrap, { kind: 'resolve-next-damage', playerId: 'player-one' })
    const snapshot = structuredClone(noCostFlip)
    expect(() => applyGameCommand(noCostFlip, {
      kind: 'resolve-flip',
      playerId: 'player-one',
      activate: true,
      discardHandIds: [],
    })).toThrow()
    expect(noCostFlip).toEqual(snapshot)
  })
})
