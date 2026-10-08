import { describe, expect, it } from 'vitest'
import { createBs12BasilDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { hasBlockingPending, hasPendingCardResolution } from './pending'

type State = ReturnType<typeof createBs12BasilDemoState>
const playerId = 'player-one' as const
const sourceId = 'bs12-041-source'
const declare = (state: State, ids = state.players[playerId].supportArea.map(s => s.card.instanceId)) => applyGameCommand(state,
  { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-041-opponent', supportPaymentIds: ids })
const finish = (before: State) => {
  let state = applyGameCommand(declare(before), { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 12; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return state
}

describe('BS12-041 neutral payment and ordinary damage', () => {
  it.each(['positive', 'blue-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'target-faints', 'deploy'] as const)('starts with printed Cookie identities and HP counts: %s', scenario => {
    const before = createBs12BasilDemoState(scenario)
    const source = scenario === 'deploy' ? before.players[playerId].hand[0] : before.players[playerId].battleArea[0].card
    expect(source).toMatchObject({ id: 'BS12-041', name: 'Basil Pesto Cookie', hp: 2 })
    if (source.type !== 'cookie') throw new Error('BS12-041 fixture must use the printed Cookie')
    const sourceEntry = before.players[playerId].battleArea.find(cookie => cookie.card.instanceId === sourceId)
    if (scenario === 'deploy') expect(sourceEntry).toBeUndefined()
    else expect(sourceEntry?.hpCards).toHaveLength(source.hp)
    const target = before.players['player-two'].battleArea[0]
    const targetNumber = scenario === 'target-faints' ? 'BS6-017' : 'BS6-008'
    const targetName = scenario === 'target-faints' ? 'Pink Choco Cookie' : 'Sugar Swan Cookie'
    const targetHp = scenario === 'target-faints' ? 1 : 6
    expect(target.card).toMatchObject({ id: targetNumber, name: targetName, hp: targetHp })
    expect(target.hpCards).toHaveLength(targetHp)
    expect(before.players['player-two'].battleArea[1].card).toMatchObject({ id: 'BS12-001', name: 'Langue de Chat Cookie', hp: 4 })
    expect(before.players['player-two'].battleArea[1].hpCards).toHaveLength(4)
  })
  it('deploys from hand with the printed two HP and no On Play', () => {
    const before = createBs12BasilDemoState('deploy')
    const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: sourceId })
    expect(after.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([2, 2])
    expect(after.players[playerId].deck).toHaveLength(10)
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.pendingOnPlay).toBeNull()
  })
  it('keeps the candidate route local', () => {
    expect(parseTestStateConfig('?test-state=bs12-041:positive', 'localhost')).toEqual({ kind: 'bs12-041', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-041:positive', 'example.com')).toBeNull()
  })
  it.each(['positive', 'blue-energy'] as const)('pays one real support and deals exactly one without Then: %s', scenario => {
    const before = createBs12BasilDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(before.players[playerId].supportArea.map(s => s.card.energyColor)).toEqual(scenario === 'positive' ? ['red'] : ['blue'])
    const after = finish(before)
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([5, 4])
    expect(after.players['player-two'].discardPile).toEqual([...before.players['player-two'].battleArea[0].hpCards].reverse().slice(0, 1))
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
  it.each(['few-energy', 'rested-energy', 'source-rested', 'opponent-turn'] as const)('rejects %s without modifying input', scenario => {
    const before = createBs12BasilDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(() => declare(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('rejects underpayment, repeated ids and an unknown support', () => {
    const before = createBs12BasilDemoState()
    for (const ids of [[], ['bs12-041-payment-0', 'bs12-041-payment-0'], ['unknown']]) expect(() => declare(before, ids)).toThrow()
  })
  it('faints only the attacked Cookie, moving its one HP and body to their proper areas', () => {
    const before = createBs12BasilDemoState('target-faints')
    const after = finish(before)
    expect(after.players['player-two'].battleArea).toEqual([before.players['player-two'].battleArea[1]])
    expect(after.players['player-two'].breakArea.map(c => c.instanceId)).toEqual(['bs12-041-opponent'])
    expect(after.players['player-two'].discardPile).toEqual([...before.players['player-two'].battleArea[0].hpCards].reverse())
    expect(after.pendingBattle).toBeNull()
    expect(hasPendingCardResolution(after)).toBe(false)
    expect(after.pendingReplacement).toBeTruthy()
  })
  it.each(['positive', 'blue-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'target-faints'] as const)('uses legal battle-area capacity: %s', scenario => {
    const state = createBs12BasilDemoState(scenario)
    expect(state.players[playerId].battleArea.length).toBeLessThanOrEqual(2)
    expect(state.players['player-two'].battleArea.length).toBeLessThanOrEqual(2)
  })
})
