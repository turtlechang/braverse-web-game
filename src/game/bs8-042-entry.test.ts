import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { executeCardEffect } from './effects'
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

const setup = (rested = true) => {
  const base = createCardCheckDemoState('BS8-039')
  const shelly = base.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS8-039')!
  const source = cookie('BS8-042', 'adventurer')
  const costCard = cookie('BS8-034', 'shelly-hand-cost')
  const target = official('BS8-037', 'opponent-target')
  const control = official('BS8-043', 'opponent-control')
  const initial: GameState = { ...base, players: { ...base.players,
    'player-one': { ...base.players['player-one'], battleArea: [shelly], hand: [costCard], breakArea: [source], discardPile: [] },
    'player-two': { ...base.players['player-two'], supportArea: [{ card: target, rested }, { card: control, rested: true }] },
  } }
  const paid = applyGameCommand(initial, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: shelly.card.instanceId, trigger: 'activate', paymentIds: [], handToBreakAreaIds: [costCard.instanceId] })
  const entered = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [source.instanceId] })
  const command = { kind: 'begin-activate-skill' as const, playerId: 'player-one' as const, sourceInstanceId: source.instanceId, trigger: 'on-play' as const, paymentIds: [] }
  return { initial, entered, source, shelly, target, control, command }
}

const resolve = (state: GameState, targetIds: string[]) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds })

const advanceToOpponentDraw = (state: GameState, afterTurn: number) => {
  let next = state
  for (let step = 0; step < 24 && !(next.turnNumber > afterTurn && next.activePlayerId === 'player-two' && next.phase === 'draw'); step += 1) {
    next = applyGameCommand(next, { kind: 'advance-phase', playerId: next.activePlayerId })
  }
  expect(next.turnNumber).toBeGreaterThan(afterTurn)
  expect(next.activePlayerId).toBe('player-two')
  expect(next.phase).toBe('draw')
  return next
}

describe('BS8-042 Adventurer Break entry', () => {
  it.each([0, 1])('uses real Shelly commands to enter from Break, then selects %i opposing support for free', (count) => {
    const { entered, source, target, command } = setup()
    expect(source.attackEnergyCost).toEqual({ yellow: 2 })
    expect(source.attack).toBe(2)
    expect(source.skill).toMatchObject({ trigger: 'on-play', onPlayFromBreakArea: true, cost: { energy: {}, discardHand: 0 } })
    expect(entered.pendingOnPlay).toMatchObject({ sourceInstanceId: source.instanceId, origin: 'break' })
    expect(entered.players['player-one'].battleArea.find((entry) => entry.card.instanceId === source.instanceId)?.enteredFrom).toBe('break')
    expect(canActivateCookieSkill(entered, 'player-one', source.instanceId, 'on-play')).toBe(true)
    const resolved = resolve(applyGameCommand(entered, command), count === 0 ? [] : [target.instanceId])
    expect(resolved.players['player-one'].hand).toEqual(entered.players['player-one'].hand)
    expect(resolved.players['player-one'].supportArea).toEqual(entered.players['player-one'].supportArea)
    expect(resolved.players['player-two'].supportArea).toEqual(entered.players['player-two'].supportArea)
    expect(resolved.preventSupportActiveNextPhase?.['player-two'] ?? []).toEqual(count === 0 ? [] : [target.instanceId])
    expect(resolved.pendingAbilityEffect).toBeFalsy()
    expect(resolved.pendingOnPlay).toBeFalsy()
  })

  it('does not immediately rest an active selected support or rest it during the next Active Phase', () => {
    const { entered, target, command } = setup(false)
    const marked = resolve(applyGameCommand(entered, command), [target.instanceId])
    expect(marked.players['player-two'].supportArea[0].rested).toBe(false)
    const afterActive = advanceToOpponentDraw(marked, marked.turnNumber)
    expect(afterActive.players['player-two'].supportArea[0].rested).toBe(false)
    expect(afterActive.preventSupportActiveNextPhase?.['player-two'] ?? []).toEqual([])
  })

  it('allows zero when the opponent has no support cards', () => {
    const { entered, source, command } = setup()
    const emptySupport: GameState = { ...entered, players: { ...entered.players, 'player-two': { ...entered.players['player-two'], supportArea: [] } } }
    expect(canActivateCookieSkill(emptySupport, 'player-one', source.instanceId, 'on-play')).toBe(true)
    const resolved = resolve(applyGameCommand(emptySupport, command), [])
    expect(resolved.pendingAbilityEffect).toBeFalsy()
    expect(resolved.preventSupportActiveNextPhase).toBeUndefined()
  })

  it('keeps only the selected rested support rested for one opponent Active Phase, then restores it next time', () => {
    const { entered, target, command } = setup(true)
    const marked = resolve(applyGameCommand(entered, command), [target.instanceId])
    const firstActive = advanceToOpponentDraw(marked, marked.turnNumber)
    expect(firstActive.players['player-two'].supportArea.map((entry) => entry.rested)).toEqual([true, false])
    expect(firstActive.preventSupportActiveNextPhase?.['player-two'] ?? []).toEqual([])
    const secondActive = advanceToOpponentDraw(firstActive, firstActive.turnNumber)
    expect(secondActive.players['player-two'].supportArea.map((entry) => entry.rested)).toEqual([false, false])
  })

  it.each(['hand', 'trash'] as const)('cannot activate the Break-only skill after a real %s entry', (origin) => {
    const { initial, source, shelly, command } = setup()
    const prepared: GameState = { ...initial, players: { ...initial.players, 'player-one': {
      ...initial.players['player-one'], breakArea: [],
      hand: origin === 'hand' ? [source] : [], discardPile: origin === 'trash' ? [source] : [],
    } } }
    const entered = origin === 'hand'
      ? applyGameCommand(prepared, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: source.instanceId })
      : executeCardEffect(prepared, { sourcePlayerId: 'player-one', sourceInstanceId: shelly.card.instanceId }, { kind: 'trash-to-battle', amount: 1 }, [source.instanceId])
    expect(entered.players['player-one'].battleArea.find((entry) => entry.card.instanceId === source.instanceId)?.enteredFrom).toBe(origin)
    expect(canActivateCookieSkill(entered, 'player-one', source.instanceId, 'on-play')).toBe(false)
    expect(() => applyGameCommand(entered, command)).toThrow()
    expect(entered.preventSupportActiveNextPhase).toBeUndefined()
    const skipped = applyGameCommand(entered, { kind: 'skip-on-play', playerId: 'player-one', sourceInstanceId: source.instanceId })
    expect(skipped.commandLog?.at(-1)?.steps?.map((step) => step.text).join('\n')).toContain('本次不是從休息區登場')
  })

  it.each(['own-support', 'unknown', 'multiple', 'duplicate'] as const)('rejects %s target selection', (selection) => {
    const { entered, target, control, command } = setup()
    const paid = applyGameCommand(entered, command)
    const ids = {
      'own-support': [entered.players['player-one'].supportArea[0].card.instanceId],
      unknown: ['not-a-support'], multiple: [target.instanceId, control.instanceId],
      duplicate: [target.instanceId, target.instanceId],
    }[selection]
    expect(() => resolve(paid, ids)).toThrow()
    expect(paid.preventSupportActiveNextPhase).toBeUndefined()
  })
})
