import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { getBreakToTrashCandidates } from './effects'
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
  const base = createCardCheckDemoState('BS8-038')
  const source = cookie('BS8-038', 'source')
  const costCard = cookie('BS8-030', 'lv3-cost')
  const wrongHand = cookie('BS8-035', 'lv2-hand')
  const lowCookies = [cookie('BS8-037', 'break1-a'), cookie('BS8-043', 'break1-b'), cookie('BS8-036', 'break1-c')]
  const wrongBreak = cookie('BS8-035', 'break2')
  const initial: GameState = { ...base, players: { ...base.players, 'player-one': {
    ...base.players['player-one'], battleArea: [], hand: [source, costCard, wrongHand],
    breakArea: [...lowCookies, wrongBreak], discardPile: [],
  } } }
  const state = applyGameCommand(initial, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: source.instanceId })
  const command = {
    kind: 'begin-activate-skill' as const, playerId: 'player-one' as const,
    sourceInstanceId: source.instanceId, trigger: 'on-play' as const, paymentIds: [],
    handToBreakAreaIds: [costCard.instanceId],
  }
  return { state, source, costCard, wrongHand, lowCookies, wrongBreak, command }
}

const resolve = (state: GameState, targetIds: string[]) => applyGameCommand(state, {
  kind: 'resolve-ability-effect', playerId: 'player-one', targetIds,
})

describe('BS8-038 Olive Cookie real hand cost', () => {
  it('deploys the official card and pays exactly one LV3 hand Cookie before selecting LV1 Break targets', () => {
    const { state, source, costCard, wrongHand, lowCookies, command } = setup()
    expect(state.pendingOnPlay?.sourceInstanceId).toBe(source.instanceId)
    expect(source.skill?.cost).toMatchObject({ energy: {}, handToBreakArea: { count: 1, minLevel: 3, maxLevel: 3 } })
    expect(source.skill?.effects).toEqual([{ kind: 'break-to-trash', max: 2, exactLevel: 1 }])
    expect(getHandToBreakAreaCostCandidates(source.skill!.cost, state.players['player-one'].hand, source.instanceId)).toEqual([costCard])
    const paid = applyGameCommand(state, command)
    expect(paid.players['player-one'].hand).toEqual([wrongHand])
    expect(paid.players['player-one'].breakArea).toContainEqual(costCard)
    expect(paid.players['player-one'].discardPile).toEqual([])
    expect(paid.pendingAbilityEffect?.effectIndex).toBe(0)
    const effect = paid.pendingAbilityEffect!.effects[0]
    if (effect.kind !== 'break-to-trash') throw new Error('Expected post-cost LV1 selection')
    expect(getBreakToTrashCandidates(paid, { sourcePlayerId: 'player-one', sourceInstanceId: source.instanceId }, effect)).toEqual(lowCookies)
    expect(() => resolve(paid, [costCard.instanceId])).toThrow()
  })

  it.each(['begin-activate-skill', 'activate-skill'] as const)('%s rejects absent LV3, LV2, empty, duplicate and excessive hand costs', (kind) => {
    const { state, source, costCard, wrongHand, command } = setup()
    const noLv3: GameState = { ...state, players: { ...state.players, 'player-one': { ...state.players['player-one'], hand: [wrongHand] } } }
    expect(canActivateCookieSkill(noLv3, 'player-one', source.instanceId, 'on-play')).toBe(false)
    expect(() => applyGameCommand(noLv3, { ...command, kind, handToBreakAreaIds: [wrongHand.instanceId] })).toThrow()
    for (const ids of [[], [wrongHand.instanceId], [costCard.instanceId, costCard.instanceId], [costCard.instanceId, wrongHand.instanceId]]) {
      expect(() => applyGameCommand(state, { ...command, kind, handToBreakAreaIds: ids })).toThrow()
    }
    expect(state.players['player-one'].hand).toContainEqual(costCard)
  })

  it.each([0, 1, 2])('human and batch choices of %i targets agree and never refund the cost', (count) => {
    const { state, costCard, lowCookies, command } = setup()
    const targets = lowCookies.slice(0, count)
    const targetIds = targets.map((card) => card.instanceId)
    const human = resolve(applyGameCommand(state, command), targetIds)
    const batch = applyGameCommand(state, { ...command, kind: 'activate-skill', effectTargets: [targetIds] })
    expect(batch.players).toEqual(human.players)
    for (const resolved of [human, batch]) {
      expect(resolved.players['player-one'].hand).not.toContainEqual(costCard)
      expect(resolved.players['player-one'].breakArea).toContainEqual(costCard)
      expect(resolved.players['player-one'].discardPile).toEqual(targets)
      expect(resolved.pendingAbilityEffect).toBeFalsy()
      if (count === 0) expect(JSON.stringify(resolved.commandLog)).toContain('選擇 0 個目標')
    }
  })

  it.each(['begin-activate-skill', 'activate-skill'] as const)('%s rejects LV2 targets, more than two targets and duplicate targets', (kind) => {
    const { state, costCard, lowCookies, wrongBreak, command } = setup()
    const paid = applyGameCommand(state, command)
    for (const ids of [[wrongBreak.instanceId], [costCard.instanceId], lowCookies.map((card) => card.instanceId), [lowCookies[0].instanceId, lowCookies[0].instanceId]]) {
      if (kind === 'begin-activate-skill') expect(() => resolve(paid, ids)).toThrow()
      else expect(() => applyGameCommand(state, { ...command, kind, effectTargets: [ids] })).toThrow()
    }
  })

  it.each(['begin-activate-skill', 'activate-skill'] as const)('%s permits paying and choosing zero without any LV1 in Break', (kind) => {
    const { state, source, costCard, wrongBreak, command } = setup()
    const noLv1: GameState = { ...state, players: { ...state.players, 'player-one': { ...state.players['player-one'], breakArea: [wrongBreak] } } }
    expect(canActivateCookieSkill(noLv1, 'player-one', source.instanceId, 'on-play')).toBe(true)
    const started = applyGameCommand(noLv1, { ...command, kind, ...(kind === 'activate-skill' ? { effectTargets: [[]] } : {}) })
    const resolved = kind === 'begin-activate-skill' ? resolve(started, []) : started
    expect(resolved.players['player-one'].breakArea).toEqual([wrongBreak, costCard])
    expect(resolved.players['player-one'].discardPile).toEqual([])
    expect(resolved.pendingAbilityEffect).toBeFalsy()
  })

  it.each(['begin-activate-skill', 'activate-skill'] as const)('%s loses at Break ten immediately, before removing LV1 targets', (kind) => {
    const { state, costCard, lowCookies, command } = setup()
    const breakArea = [cookie('BS8-030', 'break3-a'), cookie('BS8-026', 'break3-b'), lowCookies[0]]
    expect(breakArea.reduce((sum, card) => sum + card.level, 0) + costCard.level).toBe(10)
    const nearDefeat: GameState = { ...state, players: { ...state.players, 'player-one': { ...state.players['player-one'], breakArea } } }
    const result = applyGameCommand(nearDefeat, { ...command, kind, ...(kind === 'activate-skill' ? { effectTargets: [[lowCookies[0].instanceId]] } : {}) })
    expect(result.status).toBe('finished')
    expect(result.pendingAbilityEffect).toBeFalsy()
    expect(result.players['player-one'].breakArea).toEqual([...breakArea, costCard])
    expect(result.players['player-one'].discardPile).toEqual([])
  })
})
