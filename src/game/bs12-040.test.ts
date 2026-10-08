import { describe, expect, it } from 'vitest'
import { createBs12BaguetteDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'

const playerId = 'player-one' as const
const sourceId = 'bs12-040-source'
type State = ReturnType<typeof createBs12BaguetteDemoState>
const activate = (state: State, targets = ['bs12-040-hand'], cost = ['bs12-040-payment-0']) => applyGameCommand(state, {
  kind: 'activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'activate', paymentIds: [], supportToHandIds: cost, effectTargets: [targets],
})

describe('BS12-040 support return cost and rested Arena placement', () => {
  it.each(['positive', 'item-hand', 'stage-hand', 'yellow-hand', 'returned-arena', 'rested-cost', 'non-arena-cost', 'non-arena-hand', 'item-support-only', 'no-support', 'source-rested', 'all-support-rested', 'opponent-turn', 'outside-main', 'used', 'attack', 'attack-wrong', 'attack-few', 'attack-rested-energy', 'attack-rested-source', 'deploy'] as const)('starts from the printed source and Sugar Swan HP: %s', scenario => {
    const before = createBs12BaguetteDemoState(scenario)
    const source = scenario === 'deploy' ? before.players[playerId].hand[0] : before.players[playerId].battleArea[0].card
    expect(source).toMatchObject({ id: 'BS12-040', name: 'Baguette Cookie', hp: 3 })
    if (source.type !== 'cookie') throw new Error('BS12-040 fixture must use the printed Cookie')
    const sourceEntry = before.players[playerId].battleArea.find(cookie => cookie.card.instanceId === sourceId)
    if (scenario === 'deploy') expect(sourceEntry).toBeUndefined()
    else expect(sourceEntry?.hpCards).toHaveLength(source.hp)
    const target = before.players['player-two'].battleArea[0]
    expect(target.card).toMatchObject({ id: 'BS6-008', name: 'Sugar Swan Cookie', hp: 6 })
    expect(target.hpCards).toHaveLength(target.card.hp)
    expect(before.players['player-two'].battleArea[1].card).toMatchObject({ id: 'ST4-001', name: 'Candy Diver Cookie', hp: 3 })
    expect(before.players['player-two'].battleArea[1].hpCards).toHaveLength(3)
  })
  it.each(['positive', 'item-hand', 'stage-hand', 'yellow-hand', 'rested-cost', 'non-arena-cost', 'source-rested', 'all-support-rested'] as const)('returns exactly one Cookie then places an Arena card: %s', scenario => {
    const before = createBs12BaguetteDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(canActivateCookieSkill(before, playerId, sourceId, 'activate')).toBe(true)
    const cost = before.players[playerId].supportArea[0].card
    const hand = before.players[playerId].hand[0]
    const after = activate(before)
    expect(after.players[playerId].supportArea).toEqual([...before.players[playerId].supportArea.slice(1), { card: hand, rested: true }])
    expect(after.players[playerId].hand).toEqual([before.players[playerId].hand[1], cost])
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].discardPile).toEqual([])
    expect(after.players[playerId].breakArea).toEqual([])
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it('can return an Arena Cookie and immediately place the same card when the original hand is empty', () => {
    const before = createBs12BaguetteDemoState('returned-arena')
    const cost = before.players[playerId].supportArea[0].card
    const after = activate(before, [cost.instanceId])
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].supportArea).toEqual([...before.players[playerId].supportArea.slice(1), { card: cost, rested: true }])
  })
  it.each(['positive', 'non-arena-hand', 'returned-arena'] as const)('allows zero placement but still pays Cookie return and uses the once-per-turn: %s', scenario => {
    const before = createBs12BaguetteDemoState(scenario)
    const after = activate(before, [])
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea.slice(1))
    expect(after.players[playerId].hand).toEqual([...before.players[playerId].hand, before.players[playerId].supportArea[0].card])
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
  })
  it('pays the mandatory return before enumerating hand placement in the command queue', () => {
    const before = createBs12BaguetteDemoState('returned-arena')
    const returned = before.players[playerId].supportArea[0].card
    const paid = applyGameCommand(before, { kind: 'begin-activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'activate', paymentIds: [], supportToHandIds: [returned.instanceId] })
    expect(paid.players[playerId].hand).toEqual([returned])
    expect(paid.players[playerId].supportArea).toHaveLength(3)
    const after = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: [returned.instanceId] })
    expect(after.players[playerId].supportArea.at(-1)).toEqual({ card: returned, rested: true })
  })
  it.each(['item-support-only', 'no-support', 'opponent-turn', 'outside-main', 'used'] as const)('rejects %s without mutation', scenario => {
    const before = createBs12BaguetteDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(canActivateCookieSkill(before, playerId, sourceId, 'activate')).toBe(false)
    expect(() => activate(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([[], ['bs12-040-payment-3'], ['bs12-040-hand'], ['bs12-040-source'], ['bs12-040-payment-0', 'bs12-040-payment-1'], ['bs12-040-payment-0', 'bs12-040-payment-0'], ['unknown']])('rejects illegal return cost %j', (...cost) => {
    const before = createBs12BaguetteDemoState()
    const snapshot = structuredClone(before)
    expect(() => activate(before, ['bs12-040-hand'], cost)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([['bs12-040-wrong-hand'], ['bs12-040-source'], ['bs12-040-payment-1'], ['bs12-040-hand', 'bs12-040-payment-0'], ['bs12-040-hand', 'bs12-040-hand']])('rejects illegal placement %j', (...targets) => {
    const before = createBs12BaguetteDemoState()
    const snapshot = structuredClone(before)
    expect(() => activate(before, targets)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('pays real green green blue for GGN and deals three without Then', () => {
    const before = createBs12BaguetteDemoState('attack')
    let after = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-040-opponent', supportPaymentIds: ['bs12-040-payment-0', 'bs12-040-payment-1', 'bs12-040-payment-2'] })
    after = applyGameCommand(after, { kind: 'skip-trap', playerId: 'player-two' })
    for (let i = 0; i < 3; i++) after = applyGameCommand(after, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3, 3])
    expect(after.players[playerId].supportArea.map(s => s.rested)).toEqual([true, true, true, false])
    expect(after.players[playerId].battleArea[0].rested).toBe(true)
    expect(after.pendingBattle).toBeNull()
  })
  it.each(['attack-wrong', 'attack-few', 'attack-rested-energy', 'attack-rested-source'] as const)('rejects illegal ordinary attack %s', scenario => {
    const before = createBs12BaguetteDemoState(scenario)
    expect(() => applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-040-opponent', supportPaymentIds: before.players[playerId].supportArea.slice(0, 3).map(s => s.card.instanceId) })).toThrow()
  })
  it('deploys the source from hand with printed three HP', () => {
    const before = createBs12BaguetteDemoState('deploy')
    const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: sourceId })
    expect(after.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([2, 3])
    expect(after.players[playerId].deck).toHaveLength(9)
    expect(after.pendingOnPlay).toBeNull()
  })
  it('keeps the candidate route local', () => {
    expect(parseTestStateConfig('?test-state=bs12-040:positive', 'localhost')).toEqual({ kind: 'bs12-040', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-040:positive', 'example.com')).toBeNull()
  })
})
