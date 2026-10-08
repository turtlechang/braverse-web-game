import { describe, expect, it } from 'vitest'
import { createBs12CurrantCreamDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { hasBlockingPending, hasPendingCardResolution } from './pending'

type State = ReturnType<typeof createBs12CurrantCreamDemoState>
const playerId = 'player-one' as const
const sourceId = 'bs12-079-source'
const declare = (state: State, ids = ['bs12-079-payment-0']) => applyGameCommand(state,
  { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-079-opponent', supportPaymentIds: ids })
const finish = (before: State) => {
  let state = applyGameCommand(declare(before), { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 12; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return state
}

describe('BS12-079 neutral payment and ordinary damage', () => {
  it('keeps the candidate route local', () => {
    expect(parseTestStateConfig('?test-state=bs12-079:positive', 'localhost')).toEqual({ kind: 'bs12-079', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-079:positive', 'example.com')).toBeNull()
  })
  it('normal deployment configures exactly two HP and no OnPlay', () => {
    const before = createBs12CurrantCreamDemoState('deploy')
    const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: sourceId })
    expect(after.players[playerId].battleArea[1].hpCards).toEqual(before.players[playerId].deck.slice(0, 2))
    expect(after.players[playerId].deck).toHaveLength(10)
    expect(after.players[playerId].hand).toEqual([])
    expect(after.pendingOnPlay).toBeNull()
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it.each(['positive', 'blue-energy', 'purple-energy', 'yellow-energy', 'green-energy', 'spare-energy'] as const)('pays one real support and deals exactly one without Then: %s', scenario => {
    const before = createBs12CurrantCreamDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(before.players[playerId].supportArea.map(s => s.card.energyColor)).toEqual(scenario === 'spare-energy' ? ['red', 'blue'] : [scenario === 'purple-energy' ? 'purple' : scenario === 'yellow-energy' ? 'yellow' : scenario === 'green-energy' ? 'green' : scenario === 'blue-energy' ? 'blue' : 'red'])
    const after = finish(before)
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3, 4])
    expect(after.players['player-two'].discardPile).toEqual([...before.players['player-two'].battleArea[0].hpCards].reverse().slice(0, 1))
    expect(after.players[playerId].battleArea[0]).toMatchObject({ rested: true, hpCards: before.players[playerId].battleArea[0].hpCards })
    expect(after.players[playerId].supportArea.map(s => s.rested)).toEqual(scenario === 'spare-energy' ? [true, false] : [true])
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].discardPile).toEqual([])
    expect(after.pendingBattle).toBeNull()
    expect(hasBlockingPending(after)).toBe(false)
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it.each(['few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main'] as const)('rejects %s without modifying input', scenario => {
    const before = createBs12CurrantCreamDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(() => declare(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('rejects underpayment, repeated ids and an unknown support', () => {
    const before = createBs12CurrantCreamDemoState()
    for (const ids of [[], ['bs12-079-payment-0', 'bs12-079-payment-0'], ['unknown']]) expect(() => declare(before, ids)).toThrow()
  })
  it('faints only the attacked Cookie, moving its one HP and body to their proper areas', () => {
    const before = createBs12CurrantCreamDemoState('target-faints')
    const after = finish(before)
    expect(after.players['player-two'].battleArea).toEqual([before.players['player-two'].battleArea[1]])
    expect(after.players['player-two'].breakArea.map(c => c.instanceId)).toEqual(['bs12-079-opponent'])
    expect(after.players['player-two'].discardPile).toEqual([...before.players['player-two'].battleArea[0].hpCards].reverse())
    expect(after.pendingBattle).toBeNull()
    expect(hasPendingCardResolution(after)).toBe(false)
    expect(after.pendingReplacement).toBeTruthy()
  })
  it.each(['positive', 'blue-energy', 'purple-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'target-faints', 'deploy', 'outside-main'] as const)('uses legal battle-area capacity and unique physical identities: %s', scenario => {
    const state = createBs12CurrantCreamDemoState(scenario)
    expect(state.players[playerId].battleArea.length).toBeLessThanOrEqual(2)
    expect(state.players['player-two'].battleArea.length).toBeLessThanOrEqual(2)
    const ids = Object.values(state.players).flatMap(p => [...p.hand, ...p.deck, ...p.discardPile, ...p.breakArea, ...p.supportArea.map(s => s.card), ...p.battleArea.flatMap(c => [c.card, ...c.hpCards])].map(c => c.instanceId))
    expect(new Set(ids).size).toBe(ids.length)
  })
})
