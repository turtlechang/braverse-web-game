import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { executeCardEffect } from './effects'
import { createCardCheckDemoState, createCardNegativeDemoState } from './demo'
import { getFaintEffectCardCandidates } from './battle'
import { getCardPoolEntry } from './card-pool'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { GameState } from './types'

const resolve = (state: GameState, targetIds: string[] = [], discardHandIds: string[] = []) =>
  applyGameCommand(state, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds, discardHandIds })
const formal = (id: string, instanceId: string) => {
  const converted = convertOfficialCardToGameCard(getCardPoolEntry(id)!)
  if (converted.status !== 'converted') throw new Error(`Missing ${id}`)
  return { ...converted.gameCard, instanceId }
}

describe('BS8-019 discard and source costs before recovery', () => {
  it.each([false, true])('declining the discard cost skips the entire recovery (empty hand=%s)', (empty) => {
    const state = empty ? createCardNegativeDemoState('BS8-019@1') : createCardCheckDemoState('BS8-019@1')
    const next = resolve(state)
    expect(next.pendingFaintEffects).toBeUndefined()
    expect(next.players).toEqual(state.players)
  })
  it('cannot discard or recover when an earlier effect has moved the source', () => {
    const state = createCardCheckDemoState('BS8-019@1')
    const moved = executeCardEffect(state, state.pendingFaintEffects![0].context, { kind: 'break-source-to-trash' }, [])
    const next = resolve(moved, [], [moved.players['player-one'].hand[0].instanceId])
    expect(next.pendingFaintEffects).toBeUndefined()
    expect(next.players).toEqual(moved.players)
  })
  it('declining this trigger preserves a different Cookie awaiting resolution', () => {
    const state = createCardCheckDemoState('BS8-019@1')
    const other = createCardCheckDemoState('BS8-018').pendingFaintEffects!
    state.pendingFaintEffects!.push(...other)
    expect(resolve(state).pendingFaintEffects).toEqual(other)
  })
  it.each([0, 1])('pays both costs before selecting %s recovery targets', (count) => {
    const state = createCardCheckDemoState('BS8-019@1')
    const player = state.players['player-one']
    const source = player.breakArea.find(card => card.id === 'BS8-019')!
    const cost = player.hand[0]
    const paid = resolve(state, [], [cost.instanceId])
    expect(paid.players['player-one'].hand).toHaveLength(player.hand.length - 1)
    for (const id of [source.instanceId, cost.instanceId]) {
      expect(paid.players['player-one'].discardPile.some(card => card.instanceId === id)).toBe(true)
    }
    const candidate = getFaintEffectCardCandidates(paid).find(card => card.id === 'BS8-002')!
    expect(candidate).toBeDefined()
    const next = resolve(paid, count ? [candidate.instanceId] : [])
    expect(next.players['player-one'].hand).toHaveLength(player.hand.length - 1 + count)
    expect(next.players['player-one'].breakArea.some(card => card.instanceId === source.instanceId)).toBe(false)
    expect(next.pendingFaintEffects).toBeUndefined()
  })
  it('can recover a red LV.1 Cookie just discarded as the cost', () => {
    const state = createCardCheckDemoState('BS8-019@1')
    const card = formal('BS8-018', 'just-discarded-wolf')
    state.players['player-one'].hand = [card]
    const paid = resolve(state, [], [card.instanceId])
    expect(getFaintEffectCardCandidates(paid).some(candidate => candidate.instanceId === card.instanceId)).toBe(true)
    expect(resolve(paid, [card.instanceId]).players['player-one'].hand).toEqual([card])
  })
  it('excludes same name, non-red, higher level and non-Cookies', () => {
    const state = createCardCheckDemoState('BS8-019@1')
    const forbidden = [formal('BS8-019@1', 'same-name'), formal('BS8-026', 'yellow'), formal('BS8-006', 'lv2'), formal('BS8-022', 'item')]
    state.players['player-one'].discardPile.push(...forbidden)
    const paid = resolve(state, [], [state.players['player-one'].hand[0].instanceId])
    const before = structuredClone(paid)
    for (const card of forbidden) {
      expect(getFaintEffectCardCandidates(paid).some(candidate => candidate.instanceId === card.instanceId)).toBe(false)
      expect(() => resolve(paid, [card.instanceId])).toThrow()
    }
    expect(paid).toEqual(before)
  })
  it('rejects duplicate or foreign discard payment', () => {
    const state = createCardCheckDemoState('BS8-019@1')
    const card = state.players['player-one'].hand[0]
    const before = structuredClone(state)
    expect(() => resolve(state, [], [card.instanceId, card.instanceId])).toThrow()
    expect(() => resolve(state, [], ['foreign-card'])).toThrow()
    expect(state).toEqual(before)
  })
  it.each(['player-one', 'player-two'] as const)('real effect damage respects Your Turn (active=%s)', (activePlayerId) => {
    const state = createCardCheckDemoState('BS8-006')
    const source = formal('BS8-019@1', 'real-faint-hound')
    if (source.type !== 'cookie') throw new Error('Expected Cookie')
    state.players['player-one'].battleArea[0].card = source
    state.activePlayerId = activePlayerId
    const next = executeCardEffect(state, { sourcePlayerId: 'player-one', sourceInstanceId: source.instanceId },
      { kind: 'damage', amount: 1, target: { side: 'self', min: 1, max: 1 } }, [source.instanceId])
    expect(next.pendingFaintEffects?.filter(effect => effect.sourceInstanceId === source.instanceId) ?? [])
      .toHaveLength(activePlayerId === 'player-one' ? 2 : 0)
  })
})
