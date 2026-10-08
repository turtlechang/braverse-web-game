import { describe, expect, it } from 'vitest'
import { createBs12OrchestraDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateStage } from './card-abilities'
import { getEffectSelectionCandidates } from './effects'
import { hasPendingCardResolution } from './pending'

const playerId = 'player-one' as const
type State = ReturnType<typeof createBs12OrchestraDemoState>
const place = (s: State, ids = ['bs12-048-support-1']) => applyGameCommand(s, { kind: 'play-stage', playerId, instanceId: 'bs12-048-stage', paymentIds: ids })
const begin = (s: State) => applyGameCommand(s, { kind: 'begin-activate-stage', playerId, paymentIds: [] })
const resolve = (s: State, targetIds: string[]) => applyGameCommand(s, { kind: 'resolve-ability-effect', playerId, targetIds })
const enter = (s: State, ids = ['bs12-048-support-0']) => resolve(begin(s), ids)
const pay = (s: State, targets = ['bs12-048-foe-support-0'], paymentIds = ['bs12-048-support-2']) => resolve(applyGameCommand(s, { kind: 'resolve-optional-cost-attack', playerId, action: 'pay', paymentIds }), targets)
const ready = (scenario: Parameters<typeof createBs12OrchestraDemoState>[0] = 'positive') => place(createBs12OrchestraDemoState(scenario))

describe('BS12-048 printed Stage entry and conditional optional G', () => {
  it('keeps candidate fixtures local', () => {
    expect(parseTestStateConfig('?test-state=bs12-048:positive', 'localhost')).toEqual({ kind: 'bs12-048', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-048:positive', 'example.com')).toBeNull()
  })
  it('places for G without resolving or resting the source', () => {
    const before = createBs12OrchestraDemoState()
    const snapshot = structuredClone(before)
    const after = place(before)
    expect(after.players[playerId].stage).toMatchObject({ card: { id: 'BS12-048' }, rested: false })
    expect(after.players[playerId].supportArea.map(c => c.rested)).toEqual([false, true, false, true])
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.players[playerId].hand).toEqual([])
    expect(before).toEqual(snapshot)
  })
  it('replaces only the previous Stage', () => {
    const after = ready('replace')
    expect(after.players[playerId].discardPile.map(c => c.instanceId)).toEqual(['bs12-048-old-stage'])
  })
  it.each(['positive', 'rested-entry', 'blue-entry'] as const)('rests the source then plays a Cookie of any color/rest state before optional G: %s', scenario => {
    const before = ready(scenario)
    const snapshot = structuredClone(before)
    const opened = enter(before)
    expect(opened.players[playerId].stage?.rested).toBe(true)
    expect(opened.players[playerId].battleArea[1]).toMatchObject({ enteredFrom: 'support', rested: false })
    expect(opened.players[playerId].battleArea[1].hpCards).toHaveLength(2)
    expect(opened.players[playerId].deck).toHaveLength(10)
    expect(opened.pendingOptionalCostAttack).toMatchObject({ resolution: 'ability', sourceInstanceId: 'bs12-048-stage', cost: { energy: { green: 1 } } })
    expect(opened.players[playerId].supportArea.map(c => c.rested)).toEqual([true, false, true])
    const paid = pay(opened)
    expect(paid.players['player-two'].supportArea.map(c => c.rested)).toEqual([true, false, true])
    expect(paid.players[playerId].supportArea.every(c => c.rested)).toBe(true)
    expect(hasPendingCardResolution(paid)).toBe(false)
    expect(canActivateStage(paid, playerId)).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it.each([0, 1, 2])('can select any type/REST opponent support: %s', index => {
    const after = pay(enter(ready()), [`bs12-048-foe-support-${index}`])
    expect(after.players['player-two'].supportArea.map(c => c.rested)).toEqual([index === 0, index === 1, true])
  })
  it('can pay G and choose zero or skip without paying', () => {
    const opened = enter(ready())
    expect(pay(opened, []).players['player-two']).toEqual(opened.players['player-two'])
    expect(pay(opened, []).players[playerId].supportArea.every(c => c.rested)).toBe(true)
    const skipped = applyGameCommand(opened, { kind: 'resolve-optional-cost-attack', playerId, action: 'skip' })
    expect(skipped.players).toEqual(opened.players)
    expect(hasPendingCardResolution(skipped)).toBe(false)
  })
  it.each(['positive', 'no-arena', 'item-only', 'no-support', 'full-battle'] as const)('entry zero consumes source REST but does not open Then: %s', scenario => {
    const before = scenario === 'no-support' ? createBs12OrchestraDemoState(scenario) : scenario === 'item-only' ? place(createBs12OrchestraDemoState(scenario), ['bs12-048-support-2']) : ready(scenario)
    const after = enter(before, [])
    expect(after.players[playerId].stage?.rested).toBe(true)
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it('successful entry cannot use the departed Cookie to pay Then', () => {
    const opened = enter(createBs12OrchestraDemoState('entry-only-energy'))
    expect(() => pay(opened, [], ['bs12-048-support-0'])).toThrow()
    expect(() => pay(opened, [], [])).toThrow()
    expect(applyGameCommand(opened, { kind: 'resolve-optional-cost-attack', playerId, action: 'skip' }).players[playerId].battleArea).toHaveLength(2)
  })
  it.each(['rested-source', 'opponent-turn', 'outside-main'] as const)('blocks activation timing/status: %s', scenario => {
    const before = createBs12OrchestraDemoState(scenario)
    expect(canActivateStage(before, playerId)).toBe(false)
    expect(() => begin(before)).toThrow()
  })
  it.each(['no-energy', 'wrong-energy', 'rested-energy'] as const)('blocks placement payment: %s', scenario => {
    expect(() => place(createBs12OrchestraDemoState(scenario))).toThrow()
  })
  it.each([['bs12-048-support-2'], ['bs12-048-support-3'], ['bs12-048-foe-support-0'], ['unknown'], ['bs12-048-support-0', 'bs12-048-support-0']].map(ids => ({ ids })))('rejects illegal entry $ids', ({ ids }) => {
    expect(() => resolve(begin(ready()), ids)).toThrow()
  })
  it.each([['bs12-048-support-1'], ['bs12-044-opponent'], ['unknown'], ['bs12-048-foe-support-0', 'bs12-048-foe-support-0']].map(ids => ({ ids })))('rejects illegal Then target $ids', ({ ids }) => {
    expect(() => pay(enter(ready()), ids)).toThrow()
  })
  it('offers zero targets when opponent has no support but still accepts payment', () => {
    const opened = enter(ready('no-opponent-support'))
    const effect = opened.pendingOptionalCostAttack!.effects[0]
    expect(getEffectSelectionCandidates(opened, { sourcePlayerId: playerId, sourceInstanceId: 'bs12-048-stage' }, effect)).toEqual([])
    expect(hasPendingCardResolution(pay(opened, []))).toBe(false)
  })
  it.each(['last-deck', 'short-deck'] as const)('waits for HP Refresh before optional G: %s', scenario => {
    const waiting = enter(ready(scenario))
    expect(waiting.pendingRefresh?.playerId).toBe(playerId)
    expect(waiting.pendingOptionalCostAttack).toBeFalsy()
    const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-048-refresh', shuffleSeed: 3 })
    expect(after.players[playerId].battleArea[1].hpCards).toHaveLength(2)
    const opened = after.pendingOptionalCostAttack ? after : resolve(after, [])
    expect(opened.pendingOptionalCostAttack?.resolution).toBe('ability')
    expect(hasPendingCardResolution(pay(opened))).toBe(false)
  })
  it('stops at Refresh defeat before Then', () => {
    const waiting = enter(ready('refresh-lv10'))
    const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-048-refresh', shuffleSeed: 3 })
    expect(after.status).toBe('finished')
    expect(after.players['player-two'].supportArea.map(c => c.rested)).toEqual([false, false, true])
    expect(() => pay(after)).toThrow()
  })
  it('atomic Stage activation preserves the interactive Then queue', () => {
    const before = ready()
    const after = applyGameCommand(before, { kind: 'activate-stage', playerId, paymentIds: [], effectTargets: [['bs12-048-support-0']] })
    expect(after.pendingOptionalCostAttack?.resolution).toBe('ability')
    expect(pay(after).players['player-two'].supportArea[0].rested).toBe(true)
  })
  it('requires Then payment before accepting its support target', () => {
    expect(() => applyGameCommand(enter(ready()), { kind: 'resolve-optional-cost-attack', playerId, action: 'pay', paymentIds: ['bs12-048-support-2'], targetIds: ['bs12-048-foe-support-0'] })).toThrow(/支付後/)
  })
})
