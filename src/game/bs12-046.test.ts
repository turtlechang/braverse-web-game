import { describe, expect, it } from 'vitest'
import { createBs12CameraDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canPlayItem } from './card-abilities'
import { executeCardEffect, isEffectConditionMet } from './effects'
import { advancePhase } from './turn'
import { hasPendingCardResolution } from './pending'
import { describeCommandSteps } from './command-log'

const playerId = 'player-one' as const
const itemId = 'bs12-046-item'
type State = ReturnType<typeof createBs12CameraDemoState>
const enter = (state: State) => applyGameCommand(state, { kind: 'activate-skill', playerId, sourceInstanceId: 'bs12-044-source', trigger: 'activate', paymentIds: [], effectTargets: [['bs12-044-support-0'], []] })
const begin = (state: State) => applyGameCommand(state, { kind: 'begin-play-item', playerId, instanceId: itemId, paymentIds: ['bs12-044-support-1'] })
const draw = (state: State, count: number) => applyGameCommand(applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds: [] }), { kind: 'resolve-draw-up-to', playerId, drawCount: count })

describe('BS12-046 actual support entry turn history and optional draw', () => {
  it('keeps its candidate route local', () => {
    expect(parseTestStateConfig('?test-state=bs12-046:positive', 'localhost')).toEqual({ kind: 'bs12-046', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-046:positive', 'example.com')).toBeNull()
  })
  it.each([0, 1, 2])('pays G and trashes the item before drawing %s exact top cards', count => {
    const original = createBs12CameraDemoState()
    const snapshot = structuredClone(original)
    expect(canPlayItem(original, playerId, itemId)).toBe(true)
    const before = enter(original)
    expect(before.cookiesPlayedFromSupportThisTurn).toEqual({ [playerId]: true })
    expect(before.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([2, 2])
    const paid = begin(before)
    expect(paid.players[playerId].supportArea.map(s => s.rested)).toEqual([true, true, true])
    expect(paid.players[playerId].hand).toEqual([])
    expect(paid.players[playerId].discardPile.map(c => c.instanceId)).toEqual([itemId])
    expect(paid.players[playerId].deck).toEqual(before.players[playerId].deck)
    const after = draw(paid, count)
    expect(after.players[playerId].hand).toEqual(before.players[playerId].deck.slice(0, count))
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(count))
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.players['player-two']).toEqual(original.players['player-two'])
    expect(hasPendingCardResolution(after)).toBe(false)
    expect(original).toEqual(snapshot)
  })
  it('counts rested Arena support entry and preserves the record after departure', () => {
    const rested = enter(createBs12CameraDemoState('rested-entry'))
    expect(rested.cookiesPlayedFromSupportThisTurn?.[playerId]).toBe(true)
    const removed = createBs12CameraDemoState('removed')
    expect(removed.players[playerId].battleArea).toHaveLength(1)
    expect(removed.cookiesPlayedFromSupportThisTurn?.[playerId]).toBe(true)
    expect(removed.players[playerId].stage).toMatchObject({ card: { id: 'BS8-025' }, rested: true })
    expect(removed.pendingReplacement).toBeTruthy()
    const continued = applyGameCommand(removed, { kind: 'skip-replacement', playerId })
    expect(continued.pendingReplacement).toBeNull()
    expect(draw(begin(continued), 2).players[playerId].hand).toHaveLength(2)
  })
  it('counts any Cookie without requiring Arena or a level/color', () => {
    const base = createBs12CameraDemoState()
    const moved = executeCardEffect(base, { sourcePlayerId: playerId, sourceInstanceId: 'bs12-044-source' }, { kind: 'support-to-battle', amount: 1 }, ['bs12-044-support-1'])
    expect(moved.cookiesPlayedFromSupportThisTurn?.[playerId]).toBe(true)
    const withoutArena = { ...base, players: { ...base.players, [playerId]: { ...base.players[playerId], supportArea: base.players[playerId].supportArea.map(s => s.card.instanceId === 'bs12-044-support-1' ? { ...s, card: { ...s.card, keywords: [] } } : s) } } }
    const other = executeCardEffect(withoutArena, { sourcePlayerId: playerId, sourceInstanceId: 'bs12-044-source' }, { kind: 'support-to-battle', amount: 1 }, ['bs12-044-support-1'])
    expect(other.cookiesPlayedFromSupportThisTurn?.[playerId]).toBe(true)
    expect(isEffectConditionMet(other, { sourcePlayerId: playerId, sourceInstanceId: itemId }, { kind: 'draw-up-to', max: 2, condition: { kind: 'cookie-played-from-support-this-turn' } })).toBe(true)
  })
  it('does not record zero or failed support entry', () => {
    const before = createBs12CameraDemoState()
    const after = applyGameCommand(before, { kind: 'activate-skill', playerId, sourceInstanceId: 'bs12-044-source', trigger: 'activate', paymentIds: [], effectTargets: [[]] })
    expect(after.cookiesPlayedFromSupportThisTurn).toBeUndefined()
    expect(() => executeCardEffect(before, { sourcePlayerId: playerId, sourceInstanceId: 'bs12-044-source' }, { kind: 'support-to-battle', amount: 1 }, ['bs12-044-support-2'])).toThrow()
    expect(before.cookiesPlayedFromSupportThisTurn).toBeUndefined()
  })
  it.each(['no-event', 'old-turn', 'hand-entry', 'opponent-entry'] as const)('pays then performs no draw without an own current support event: %s', scenario => {
    const before = createBs12CameraDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(canPlayItem(before, playerId, itemId)).toBe(true)
    const after = begin(before)
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand.filter(c => c.instanceId !== itemId))
    expect(after.players[playerId].discardPile.map(c => c.instanceId)).toContain(itemId)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.players[playerId].supportArea.find(s => s.card.instanceId === 'bs12-044-support-1')?.rested).toBe(true)
    expect(after.pendingDrawUpTo).toBeFalsy()
    expect(hasPendingCardResolution(after)).toBe(false)
    expect(describeCommandSteps(before, after, { kind: 'begin-play-item', playerId, instanceId: itemId, paymentIds: ['bs12-044-support-1'] })?.some(step => /道具效果結果：條件不成立，效果未執行/.test(step.text))).toBe(true)
    expect(before).toEqual(snapshot)
  })
  it.each(['no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn', 'outside-main'] as const)('rejects illegal payment/timing: %s', scenario => {
    const before = createBs12CameraDemoState(scenario)
    expect(canPlayItem(before, playerId, itemId)).toBe(false)
    expect(() => begin(before)).toThrow()
    expect(before.players[playerId].hand.map(c => c.instanceId)).toContain(itemId)
  })
  it('clears the event at both the turn handoff and Active Phase', () => {
    const before = enter(createBs12CameraDemoState())
    const active = advancePhase({ ...before, phase: 'active' })
    expect(active.cookiesPlayedFromSupportThisTurn).toEqual({})
    const handed = advancePhase({ ...before, phase: 'end' })
    expect(handed.cookiesPlayedFromSupportThisTurn).toEqual({})
  })
  it.each(['short-deck', 'last-deck'] as const)('continues the actual paid draw through Refresh: %s', scenario => {
    const before = createBs12CameraDemoState(scenario)
    const waiting = draw(begin(before), scenario === 'short-deck' ? 1 : 2)
    expect(waiting.pendingRefresh?.playerId).toBe(playerId)
    const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-046-refresh', shuffleSeed: 46 })
    expect(after.players[playerId].hand).toHaveLength(scenario === 'short-deck' ? 1 : 2)
    expect(after.players[playerId].deck).toHaveLength(6)
    expect(after.players[playerId].discardPile).toEqual([])
    expect(after.players[playerId].breakArea.map(c => c.level)).toEqual([2])
    expect(after.cookiesPlayedFromSupportThisTurn?.[playerId]).toBe(true)
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it('halts at LV10 Refresh defeat after drawing the last two cards', () => {
    const waiting = draw(begin(createBs12CameraDemoState('refresh-lv10')), 2)
    const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-046-refresh', shuffleSeed: 46 })
    expect(after.status).toBe('finished')
    expect(after.result?.winnerId).toBe('player-two')
    expect(after.players[playerId].supportArea.every(s => s.rested)).toBe(true)
  })
  it('rejects drawing beyond the printed maximum', () => {
    const before = begin(enter(createBs12CameraDemoState()))
    expect(() => draw(before, 3)).toThrow()
  })
})
