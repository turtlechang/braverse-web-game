import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { getBreakToTrashCandidates } from './effects'
import { canActivateCookieSkill } from './skills'
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
  const base = createCardCheckDemoState('BS8-035')
  const source = cookie('BS8-035', 'source')
  const breakCookies = [cookie('BS8-037', 'break-lv1'), cookie('BS8-035', 'break-lv2'), cookie('BS8-030', 'break-lv3')]
  const costCookies = [cookie('BS8-037', 'cost-lv1'), cookie('BS8-035', 'cost-lv2'), cookie('BS8-030', 'cost-lv3')]
  const initial: GameState = { ...base, players: { ...base.players, 'player-one': {
    ...base.players['player-one'], battleArea: [], hand: [source], breakArea: breakCookies,
    discardPile: [...costCookies, official('BS8-046', 'trash-item')],
  } } }
  const state = applyGameCommand(initial, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: source.instanceId })
  const command = {
    kind: 'begin-activate-skill' as const, playerId: 'player-one' as const,
    sourceInstanceId: source.instanceId, trigger: 'on-play' as const, paymentIds: [],
  }
  return { initial, state, source, breakCookies, costCookies, command }
}

const resolve = (state: GameState, targetIds: string[]) => applyGameCommand(state, {
  kind: 'resolve-ability-effect', playerId: 'player-one', targetIds,
})

describe('BS8-035 OnPlay payment level', () => {
  it('uses a real deploy and rejects OnPlay without a trash Cookie', () => {
    const { state, source, command } = setup()
    expect(state.pendingOnPlay?.sourceInstanceId).toBe(source.instanceId)
    expect(source.skill?.cost).toMatchObject({ trashCookieToBreakArea: { count: 1 } })
    expect(source.skill?.effects).toEqual([{ kind: 'break-to-trash', max: 1, sameLevelAsPreviousEffectTarget: true }])
    const noCookie: GameState = { ...state, players: { ...state.players, 'player-one': {
      ...state.players['player-one'], discardPile: state.players['player-one'].discardPile.filter((card) => card.type !== 'cookie'),
    } } }
    expect(canActivateCookieSkill(noCookie, 'player-one', source.instanceId, 'on-play')).toBe(false)
    expect(() => applyGameCommand(noCookie, { ...command, trashCookieToBreakAreaIds: [noCookie.players['player-one'].discardPile[0].instanceId] })).toThrow()
  })

  it.each([1, 2, 3])('LV%i payment exposes same-level Break Cookies including the just-paid card', (level) => {
    const { state, source, costCookies, breakCookies, command } = setup()
    const paidCard = costCookies[level - 1]
    const paid = applyGameCommand(state, { ...command, trashCookieToBreakAreaIds: [paidCard.instanceId] })
    expect(paid.players['player-one'].discardPile).not.toContainEqual(paidCard)
    expect(paid.players['player-one'].breakArea).toContainEqual(paidCard)
    expect(paid.costRecord?.trashToBreakPayment).toEqual({
      playerId: 'player-one', sourceInstanceId: source.instanceId, turnNumber: state.turnNumber,
      cards: [{ instanceId: paidCard.instanceId, level }],
    })
    expect(paid.pendingAbilityEffect?.previousEffectTargetIds ?? []).toEqual([])
    const effect = paid.pendingAbilityEffect!.effects[0]
    if (effect.kind !== 'break-to-trash') throw new Error('Expected post-cost break-to-trash')
    expect(getBreakToTrashCandidates(paid, { sourcePlayerId: 'player-one', sourceInstanceId: source.instanceId }, effect).map((card) => card.instanceId).sort())
      .toEqual([paidCard.instanceId, breakCookies[level - 1].instanceId].sort())
    expect(getBreakToTrashCandidates(paid, { sourcePlayerId: 'player-one', sourceInstanceId: 'another-source' }, effect)).toEqual([])
    expect(getBreakToTrashCandidates(paid, { sourcePlayerId: 'player-two', sourceInstanceId: source.instanceId }, effect)).toEqual([])
    expect(getBreakToTrashCandidates({ ...paid, turnNumber: paid.turnNumber + 1 }, { sourcePlayerId: 'player-one', sourceInstanceId: source.instanceId }, effect)).toEqual([])
    const wrong = breakCookies.find((card) => card.level !== level)!
    expect(() => resolve(paid, [wrong.instanceId])).toThrow()
    for (const target of [paidCard, breakCookies[level - 1]]) {
      const resolved = resolve(paid, [target.instanceId])
      expect(resolved.players['player-one'].discardPile).toContainEqual(target)
      expect(resolved.players['player-one'].breakArea).not.toContainEqual(target)
      expect(resolved.pendingAbilityEffect).toBeFalsy()
    }
  })

  it.each(['begin-activate-skill', 'activate-skill'] as const)('%s preserves the paid cost when zero is selected', (kind) => {
    const { state, costCookies, command } = setup()
    const paidCard = costCookies[1]
    const started = applyGameCommand(state, { ...command, kind, trashCookieToBreakAreaIds: [paidCard.instanceId], ...(kind === 'activate-skill' ? { effectTargets: [[]] } : {}) })
    const resolved = kind === 'begin-activate-skill' ? resolve(started, []) : started
    expect(resolved.players['player-one'].breakArea).toContainEqual(paidCard)
    expect(resolved.players['player-one'].discardPile).not.toContainEqual(paidCard)
    expect(resolved.pendingAbilityEffect).toBeFalsy()
    expect(JSON.stringify(resolved.commandLog)).toContain('選擇 0 個目標')
  })

  it.each(['begin-activate-skill', 'activate-skill'] as const)('%s rejects missing, excessive or duplicate costs and more than one effect target', (kind) => {
    const { state, costCookies, breakCookies, command } = setup()
    const cost = costCookies[0]
    for (const ids of [[], [cost.instanceId, cost.instanceId], costCookies.slice(0, 2).map((card) => card.instanceId)]) {
      expect(() => applyGameCommand(state, { ...command, kind, trashCookieToBreakAreaIds: ids })).toThrow()
    }
    const paid = applyGameCommand(state, { ...command, trashCookieToBreakAreaIds: [cost.instanceId] })
    for (const targetIds of [[cost.instanceId, cost.instanceId], [cost.instanceId, breakCookies[0].instanceId]]) {
      if (kind === 'begin-activate-skill') expect(() => resolve(paid, targetIds)).toThrow()
      else expect(() => applyGameCommand(state, { ...command, kind, trashCookieToBreakAreaIds: [cost.instanceId], effectTargets: [targetIds] })).toThrow()
    }
  })

  it.each([1, 2, 3])('batch and human commands agree when the LV%i paid card is selected', (level) => {
    const { state, costCookies, command } = setup()
    const cost = costCookies[level - 1]
    const payment = { ...command, trashCookieToBreakAreaIds: [cost.instanceId] }
    const human = resolve(applyGameCommand(state, payment), [cost.instanceId])
    const batch = applyGameCommand(state, { ...payment, kind: 'activate-skill', effectTargets: [[cost.instanceId]] })
    expect(batch.players).toEqual(human.players)
    expect(batch.pendingAbilityEffect).toBeFalsy()
  })

  it('a second Cinnamon source cannot reuse the first source payment or its level', () => {
    const { initial, source, breakCookies, costCookies } = setup()
    const second = cookie('BS8-035', 'second-source')
    const prepared: GameState = { ...initial, players: { ...initial.players, 'player-one': {
      ...initial.players['player-one'], hand: [source, second], breakArea: [breakCookies[1]],
    } } }
    const firstDeployed = applyGameCommand(prepared, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: source.instanceId })
    const firstPaid = applyGameCommand(firstDeployed, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.instanceId, trigger: 'on-play', paymentIds: [], trashCookieToBreakAreaIds: [costCookies[0].instanceId] })
    const firstDone = resolve(firstPaid, [])
    const secondDeployed = applyGameCommand(firstDone, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: second.instanceId })
    const secondCommand = { kind: 'begin-activate-skill' as const, playerId: 'player-one' as const, sourceInstanceId: second.instanceId, trigger: 'on-play' as const, paymentIds: [] }
    expect(() => applyGameCommand(secondDeployed, secondCommand)).toThrow()
    const secondPaid = applyGameCommand(secondDeployed, { ...secondCommand, trashCookieToBreakAreaIds: [costCookies[2].instanceId] })
    const effect = secondPaid.pendingAbilityEffect!.effects[0]
    if (effect.kind !== 'break-to-trash') throw new Error('Expected second post-cost effect')
    expect(getBreakToTrashCandidates(secondPaid, { sourcePlayerId: 'player-one', sourceInstanceId: second.instanceId }, effect).map((card) => card.instanceId))
      .toEqual([costCookies[2].instanceId])
    expect(() => resolve(secondPaid, [costCookies[0].instanceId])).toThrow()
    expect(resolve(secondPaid, [costCookies[2].instanceId]).players['player-one'].discardPile).toContainEqual(costCookies[2])
  })

  it.each(['begin-activate-skill', 'activate-skill'] as const)('%s loses at Break LV10 before an effect could lower it to nine', (kind) => {
    const { state, costCookies, command } = setup()
    const breakArea = [cookie('BS8-030', 'lv3-a'), cookie('BS8-030', 'lv3-b'), cookie('BS8-026', 'lv3-c')]
    const nearDefeat: GameState = { ...state, players: { ...state.players, 'player-one': { ...state.players['player-one'], breakArea } } }
    const cost = costCookies[0]
    expect(cost.level).toBe(1)
    const result = applyGameCommand(nearDefeat, { ...command, kind, trashCookieToBreakAreaIds: [cost.instanceId], ...(kind === 'activate-skill' ? { effectTargets: [[cost.instanceId]] } : {}) })
    expect(result.status).toBe('finished')
    expect(result.pendingAbilityEffect).toBeFalsy()
    expect(result.players['player-one'].breakArea.reduce((sum, card) => sum + card.level, 0)).toBe(10)
    expect(result.players['player-one'].breakArea).toContainEqual(cost)
    expect(result.players['player-one'].discardPile).not.toContainEqual(cost)
  })
})
