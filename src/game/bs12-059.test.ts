import { describe, expect, it } from 'vitest'
import { createBs12SourBeltDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { hasBlockingPending, hasPendingCardResolution } from './pending'

type State = ReturnType<typeof createBs12SourBeltDemoState>
const playerId = 'player-one' as const
const sourceId = 'bs12-059-source'
const declare = (state: State, ids = state.players[playerId].supportArea.map(s => s.card.instanceId)) => applyGameCommand(state,
  { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-059-opponent', supportPaymentIds: ids })
const finish = (before: State) => {
  let state = applyGameCommand(declare(before), { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 12; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return state
}

describe('BS12-059 neutral payment and ordinary damage', () => {
  it('keeps the candidate route local', () => {
    expect(parseTestStateConfig('?test-state=bs12-059:positive', 'localhost')).toEqual({ kind: 'bs12-059', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-059:positive', 'example.com')).toBeNull()
  })
  it('normal deployment configures exactly four HP and no OnPlay', () => {
    const before = createBs12SourBeltDemoState('deploy')
    const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: sourceId })
    expect(after.players[playerId].battleArea[1].hpCards).toEqual(before.players[playerId].deck.slice(0, 4))
    expect(after.players[playerId].deck).toHaveLength(8)
    expect(after.players[playerId].hand).toEqual([])
    expect(after.pendingOnPlay).toBeNull()
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it.each(['positive', 'blue-energy'] as const)('pays three real supports and deals exactly four without Then: %s', scenario => {
    const before = createBs12SourBeltDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(before.players[playerId].supportArea.map(s => s.card.energyColor)).toEqual(scenario === 'positive' ? ['red', 'blue', 'green'] : ['blue', 'blue', 'blue'])
    const after = finish(before)
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([2, 4])
    expect(after.players['player-two'].discardPile).toEqual([...before.players['player-two'].battleArea[0].hpCards].reverse().slice(0, 4))
    expect(after.players[playerId].battleArea[0]).toMatchObject({ rested: true, hpCards: before.players[playerId].battleArea[0].hpCards })
    expect(after.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].discardPile).toEqual([])
    expect(after.pendingBattle).toBeNull()
    expect(hasBlockingPending(after)).toBe(false)
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it.each(['few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main'] as const)('rejects %s without modifying input', scenario => {
    const before = createBs12SourBeltDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(() => declare(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('rejects underpayment, repeated ids and an unknown support', () => {
    const before = createBs12SourBeltDemoState()
    for (const ids of [['bs12-059-payment-0', 'bs12-059-payment-1'], ['bs12-059-payment-0', 'bs12-059-payment-0', 'bs12-059-payment-1'], ['bs12-059-payment-0', 'bs12-059-payment-1', 'unknown']]) expect(() => declare(before, ids)).toThrow()
  })
  it('faints only the attacked Cookie, moving its four HP and body to their proper areas', () => {
    const before = createBs12SourBeltDemoState('target-faints')
    const after = finish(before)
    expect(after.players['player-two'].battleArea).toEqual([before.players['player-two'].battleArea[1]])
    expect(after.players['player-two'].breakArea.map(c => c.instanceId)).toEqual(['bs12-059-opponent'])
    expect(after.players['player-two'].discardPile).toEqual([...before.players['player-two'].battleArea[0].hpCards].reverse())
    expect(after.pendingBattle).toBeNull()
    expect(hasPendingCardResolution(after)).toBe(false)
    expect(after.pendingReplacement).toBeTruthy()
  })
  it.each(['positive', 'blue-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'target-faints'] as const)('uses legal battle-area capacity: %s', scenario => {
    const state = createBs12SourBeltDemoState(scenario)
    expect(state.players[playerId].battleArea.length).toBeLessThanOrEqual(2)
    expect(state.players['player-two'].battleArea.length).toBeLessThanOrEqual(2)
  })
})
