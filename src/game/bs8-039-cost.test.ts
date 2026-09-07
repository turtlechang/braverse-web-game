import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { getBreakToBattleCandidates } from './effects'
import { canActivateCookieSkill, getHandToBreakAreaCostCandidates } from './skills'
import type { GameCard, GameState } from './types'

const official = (id: string, suffix: string): GameCard => {
  const entry = getCardPoolEntry(id)
  if (!entry) throw new Error(`Missing ${id}`)
  const result = convertOfficialCardToGameCard(entry)
  if (result.status !== 'converted') throw new Error(`Unconverted ${id}`)
  return { ...result.gameCard, instanceId: `${id}:${suffix}` }
}

const cookie = (id: string, suffix: string) => {
  const card = official(id, suffix)
  if (card.type !== 'cookie') throw new Error(`Expected Cookie ${id}`)
  return card
}

const setup = () => {
  const base = createCardCheckDemoState('BS8-039')
  const source = base.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS8-039')!
  const costCard = cookie('BS8-034', 'lv2-cost')
  const lowHand = cookie('BS8-037', 'lv1-hand')
  const highHand = cookie('BS8-030', 'lv3-hand')
  const existing = cookie('BS8-037', 'break-lv1')
  const state: GameState = { ...base, players: { ...base.players, 'player-one': {
    ...base.players['player-one'], battleArea: [source], hand: [costCard, lowHand, highHand],
    breakArea: [existing], discardPile: [],
  } } }
  const command = {
    kind: 'begin-activate-skill' as const, playerId: 'player-one' as const,
    sourceInstanceId: source.card.instanceId, trigger: 'activate' as const, paymentIds: [],
    handToBreakAreaIds: [costCard.instanceId],
  }
  return { state, source, costCard, lowHand, highHand, existing, command }
}

const resolve = (state: GameState, targetIds: string[]) => applyGameCommand(state, {
  kind: 'resolve-ability-effect', playerId: 'player-one', targetIds,
})

describe('BS8-039 Shelly hand cost and battle capacity', () => {
  it('requires exactly LV2, preserves the source in battle and exposes the paid card as a fresh candidate', () => {
    const { state, source, costCard, existing, command } = setup()
    expect(source.card.skill?.oncePerTurn).toBe(true)
    expect(source.card.skill?.cost).toMatchObject({ energy: {}, handToBreakArea: { count: 1, minLevel: 2, maxLevel: 2 } })
    expect(source.card.skill?.effects).toEqual([{ kind: 'break-to-battle', amount: 1, maxLevel: 2 }])
    expect(getHandToBreakAreaCostCandidates(source.card.skill!.cost, state.players['player-one'].hand, source.card.instanceId)).toEqual([costCard])
    const paid = applyGameCommand(state, command)
    expect(paid.players['player-one'].battleArea).toEqual(state.players['player-one'].battleArea)
    expect(paid.players['player-one'].hand).not.toContainEqual(costCard)
    expect(paid.players['player-one'].breakArea).toContainEqual(costCard)
    const effect = paid.pendingAbilityEffect!.effects[0]
    if (effect.kind !== 'break-to-battle') throw new Error('Expected post-cost summon')
    expect(getBreakToBattleCandidates(paid, { sourcePlayerId: 'player-one', sourceInstanceId: source.card.instanceId }, effect)).toEqual([existing, costCard])
  })

  it.each(['begin-activate-skill', 'activate-skill'] as const)('%s rejects missing, LV1 or LV3 payment', (kind) => {
    const { state, source, lowHand, highHand, command } = setup()
    for (const hand of [[], [lowHand], [highHand]]) {
      const invalid: GameState = { ...state, players: { ...state.players, 'player-one': { ...state.players['player-one'], hand } } }
      expect(canActivateCookieSkill(invalid, 'player-one', source.card.instanceId, 'activate')).toBe(false)
      expect(() => applyGameCommand(invalid, { ...command, kind, handToBreakAreaIds: hand.map((card) => card.instanceId) })).toThrow()
    }
  })

  it.each(['zero', 'paid', 'existing'] as const)('human and batch agree for the %s selection', (selection) => {
    const { state, source, costCard, existing, command } = setup()
    const targets = selection === 'zero' ? [] : [selection === 'paid' ? costCard.instanceId : existing.instanceId]
    const human = resolve(applyGameCommand(state, command), targets)
    const batch = applyGameCommand(state, { ...command, kind: 'activate-skill', effectTargets: [targets] })
    expect(batch.players).toEqual(human.players)
    for (const result of [human, batch]) {
      expect(result.pendingAbilityEffect).toBeFalsy()
      expect(result.players['player-one'].battleArea).toHaveLength(selection === 'zero' ? 1 : 2)
      expect(result.players['player-one'].battleArea[0].card).toEqual(source.card)
      expect(result.players['player-one'].hand).not.toContainEqual(costCard)
      if (selection === 'paid') expect(result.players['player-one'].battleArea[1].card).toEqual(costCard)
      else expect(result.players['player-one'].breakArea).toContainEqual(costCard)
    }
  })

  it('keeps the effect pending after payment empties the hand and can summon the just-paid card without old candidates', () => {
    const { state, source, costCard, command } = setup()
    const prepared: GameState = { ...state, players: { ...state.players, 'player-one': { ...state.players['player-one'], hand: [costCard], breakArea: [] } } }
    expect(canActivateCookieSkill(prepared, 'player-one', source.card.instanceId, 'activate')).toBe(true)
    const paid = applyGameCommand(prepared, command)
    expect(paid.players['player-one'].hand).toEqual([])
    expect(paid.pendingAbilityEffect?.effectIndex).toBe(0)
    const summoned = resolve(paid, [costCard.instanceId])
    expect(summoned.players['player-one'].battleArea[1].card).toEqual(costCard)
    expect(summoned.players['player-one'].breakArea).toEqual([])
  })

  it.each(['begin-activate-skill', 'activate-skill'] as const)('%s can pay at two battle Cookies but only choose zero', (kind) => {
    const { state, source, costCard, existing, command } = setup()
    const companion = cookie('BS8-043', 'full-battle-companion')
    const full: GameState = { ...state, players: { ...state.players, 'player-one': {
      ...state.players['player-one'], battleArea: [...state.players['player-one'].battleArea, { card: companion, hpCards: [official('BS8-046', 'companion-hp')], rested: false }],
    } } }
    expect(canActivateCookieSkill(full, 'player-one', source.card.instanceId, 'activate')).toBe(true)
    const paid = applyGameCommand(full, command)
    const effect = paid.pendingAbilityEffect!.effects[0]
    if (effect.kind !== 'break-to-battle') throw new Error('Expected post-cost summon')
    expect(getBreakToBattleCandidates(paid, { sourcePlayerId: 'player-one', sourceInstanceId: source.card.instanceId }, effect)).toEqual([])
    for (const target of [costCard, existing]) {
      if (kind === 'begin-activate-skill') expect(() => resolve(paid, [target.instanceId])).toThrow()
      else expect(() => applyGameCommand(full, { ...command, kind, effectTargets: [[target.instanceId]] })).toThrow()
    }
    const result = kind === 'begin-activate-skill' ? resolve(paid, []) : applyGameCommand(full, { ...command, kind, effectTargets: [[]] })
    expect(result.players['player-one'].battleArea).toEqual(full.players['player-one'].battleArea)
    expect(result.players['player-one'].breakArea).toContainEqual(costCard)
    expect(result.pendingAbilityEffect).toBeFalsy()
  })

  it('blocks reuse this turn and permits it after normal turns return to the owner main phase', () => {
    const { state, source, costCard, command } = setup()
    const nextCost = cookie('BS8-034', 'next-turn-cost')
    const prepared: GameState = { ...state, players: { ...state.players, 'player-one': { ...state.players['player-one'], hand: [costCard, nextCost] } } }
    let result = resolve(applyGameCommand(prepared, command), [])
    expect(canActivateCookieSkill(result, 'player-one', source.card.instanceId, 'activate')).toBe(false)
    expect(() => applyGameCommand(result, { ...command, handToBreakAreaIds: [nextCost.instanceId] })).toThrow()
    const firstTurn = result.turnNumber
    for (let step = 0; step < 16 && !(result.turnNumber > firstTurn && result.activePlayerId === 'player-one' && result.phase === 'main'); step += 1) {
      result = applyGameCommand(result, { kind: 'advance-phase', playerId: result.activePlayerId })
    }
    expect(result.turnNumber).toBeGreaterThan(firstTurn)
    expect(result.activePlayerId).toBe('player-one')
    expect(result.phase).toBe('main')
    expect(canActivateCookieSkill(result, 'player-one', source.card.instanceId, 'activate')).toBe(true)
    const paidAgain = applyGameCommand(result, { ...command, handToBreakAreaIds: [nextCost.instanceId] })
    expect(paidAgain.players['player-one'].breakArea).toContainEqual(nextCost)
    expect(paidAgain.pendingAbilityEffect).toBeTruthy()
  })

  it.each(['begin-activate-skill', 'activate-skill'] as const)('%s loses at Break ten before summoning could reduce it', (kind) => {
    const { state, costCard, command } = setup()
    const breakArea = [cookie('BS8-030', 'break3-a'), cookie('BS8-026', 'break3-b'), cookie('BS8-034', 'break2')]
    expect(breakArea.reduce((sum, card) => sum + card.level, 0) + costCard.level).toBe(10)
    const nearDefeat: GameState = { ...state, players: { ...state.players, 'player-one': { ...state.players['player-one'], breakArea } } }
    const result = applyGameCommand(nearDefeat, { ...command, kind, ...(kind === 'activate-skill' ? { effectTargets: [[costCard.instanceId]] } : {}) })
    expect(result.status).toBe('finished')
    expect(result.pendingAbilityEffect).toBeFalsy()
    expect(result.players['player-one'].battleArea).toEqual(nearDefeat.players['player-one'].battleArea)
    expect(result.players['player-one'].breakArea).toEqual([...breakArea, costCard])
  })
})
