import { describe, expect, it } from 'vitest'
import { createBs12ParfaitDemoState, parseTestStateConfig, type Bs12ParfaitScenario } from './demo'
import { applyGameCommand } from './commands'
import { describeCommandSteps } from './command-log'
import { executeCardEffect, isCookieActivePhasePrevented } from './effects'
import { canActivateCookieSkill } from './skills'

const playerId = 'player-one' as const
const advance = (state: ReturnType<typeof createBs12ParfaitDemoState>) => applyGameCommand(state, { kind: 'advance-phase', playerId })
describe.each(['BS12-015', 'BS12-015@1'] as const)('%s Active Phase passive', number => {
  it('uses an isolated candidate route', () => {
    expect(parseTestStateConfig(`?test-state=bs12-015:${number}:solo`, 'localhost')).toEqual({ kind: 'bs12-015', cardNumber: number, scenario: 'solo' })
    expect(parseTestStateConfig(`?test-state=bs12-015:${number}:solo`, 'example.com')).toBeNull()
  })
  it.each(['solo', 'non-arena', 'equipment', 'support-only', 'opponent-only'] as const)('keeps source rested for %s but readies other ordinary cards', scenario => {
    const before = createBs12ParfaitDemoState(scenario, number)
    const snapshot = structuredClone(before)
    const after = advance(before)
    expect(after.phase).toBe('draw')
    expect(after.players[playerId].battleArea[0].rested).toBe(true)
    expect(after.players[playerId].battleArea.slice(1).every(cookie => !cookie.rested)).toBe(true)
    expect(after.players[playerId].supportArea.every(card => !card.rested)).toBe(true)
    expect(after.players[playerId].battleArea.map(cookie => cookie.hpCards)).toEqual(before.players[playerId].battleArea.map(cookie => cookie.hpCards))
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(after.players[playerId].discardPile).toEqual(before.players[playerId].discardPile)
    expect(describeCommandSteps(before, after, { kind: 'advance-phase', playerId })?.map(step => step.text).join(' ')).toContain('沒有另一張【Arena】餅乾')
    expect(before).toEqual(snapshot)
  })
  it.each(['positive', 'green-arena', 'other-rested', 'two-copies'] as const)('readies source with another real Arena Cookie for %s', scenario => {
    const before = createBs12ParfaitDemoState(scenario, number)
    const after = advance(before)
    expect(after.players[playerId].battleArea.every(cookie => !cookie.rested)).toBe(true)
    expect(after.cookiesSetActiveByEffectThisTurn).toEqual({})
    expect(describeCommandSteps(before, after, { kind: 'advance-phase', playerId })?.map(step => step.text).join(' ')).toContain('有另一張【Arena】餅乾')
  })
  it('does not force an already-active source to rest', () => {
    expect(advance(createBs12ParfaitDemoState('already-active', number)).players[playerId].battleArea[0].rested).toBe(false)
  })
  it('does not prohibit readying by a main-phase item with no other Arena Cookie', () => {
    let state = advance(createBs12ParfaitDemoState('effect-ready', number))
    state = advance(advance(state))
    expect(state.phase).toBe('main')
    expect(state.players[playerId].battleArea[0].rested).toBe(true)
    state = applyGameCommand(state, { kind: 'play-item', playerId, instanceId: 'bs12-015-ready-item', paymentIds: ['bs12-015-payment-0'], effectTargets: [['bs12-015-source']] })
    expect(state.players[playerId].battleArea[0].rested).toBe(false)
    expect(state.players[playerId].battleArea[1].rested).toBe(false)
    expect(state.players[playerId].battleArea[0].hpCards).toHaveLength(5)
  })
  it('is not an Activate skill and is inactive after the source leaves battle', () => {
    const before = createBs12ParfaitDemoState('positive', number)
    expect(canActivateCookieSkill({ ...before, phase: 'main' }, playerId, 'bs12-015-source', 'activate')).toBe(false)
    const moved = executeCardEffect(before, { sourcePlayerId: playerId, sourceInstanceId: 'bs12-015-source' },
      { kind: 'return-to-hand', target: { side: 'self', min: 1, max: 1 } }, ['bs12-015-source'])
    expect(isCookieActivePhasePrevented(moved, playerId, 'bs12-015-source')).toBe(false)
    expect(advance(moved).players[playerId].battleArea.every(cookie => !cookie.rested)).toBe(true)
  })
  it('only readies the current owner during the opponent Active Phase', () => {
    const before = createBs12ParfaitDemoState('opponent-turn', number)
    const after = applyGameCommand(before, { kind: 'advance-phase', playerId: 'player-two' })
    expect(after.players[playerId]).toEqual(before.players[playerId])
    expect(after.players['player-two'].battleArea[0].rested).toBe(false)
  })
  it('declares the printed RRN attack for exactly 3 damage after ordinary readying', () => {
    let state = advance(createBs12ParfaitDemoState('positive', number))
    state = advance(advance(state))
    const after = applyGameCommand(state, { kind: 'declare-attack', playerId, attackerInstanceId: 'bs12-015-source', targetInstanceId: 'bs12-015-opponent', supportPaymentIds: ['bs12-015-payment-0', 'bs12-015-payment-1', 'bs12-015-payment-2'] })
    expect(after.pendingBattle?.declaredDamage).toBe(3)
    expect(after.players[playerId].supportArea.map(card => card.rested)).toEqual([true, true, true])
    expect(after.players[playerId].battleArea.map(cookie => cookie.rested)).toEqual([true, false])
  })
  it('respects an independent next-phase prevention even when another Arena exists', () => {
    const before = createBs12ParfaitDemoState('positive', number)
    const after = advance({ ...before, preventCookieActiveNextPhase: { [playerId]: ['bs12-015-source'] } })
    expect(after.players[playerId].battleArea[0].rested).toBe(true)
    expect(after.preventCookieActiveNextPhase).toBeUndefined()
    expect(describeCommandSteps({ ...before, preventCookieActiveNextPhase: { [playerId]: ['bs12-015-source'] } }, after, { kind: 'advance-phase', playerId })?.map(step => step.text).join(' ')).toContain('其他效果阻止活躍')
  })
})

const attackUntilThen = (scenario: Bs12ParfaitScenario, number: 'BS12-015' | 'BS12-015@1') => {
  let state = createBs12ParfaitDemoState(scenario, number)
  while (state.phase !== 'main') state = advance(state)
  state = applyGameCommand(state, { kind: 'declare-attack', playerId, attackerInstanceId: 'bs12-015-source',
    targetInstanceId: 'bs12-015-opponent', supportPaymentIds: ['bs12-015-payment-0', 'bs12-015-payment-1', 'bs12-015-payment-2'] })
  expect(state.pendingBattle?.declaredDamage).toBe(3)
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 10; i++) {
    state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  }
  return state
}

describe.each(['BS12-015', 'BS12-015@1'] as const)('%s original-defender attack Then', number => {
  it.each(['positive', 'attack-green-arena'] as const)('deals 3 ordinary then 1 effect damage to the original target for %s', scenario => {
    const before = attackUntilThen(scenario, number)
    expect(before.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
    expect(before.pendingBattle?.stage).toBe('attack-effect')
    const after = applyGameCommand(before, { kind: 'resolve-attack-effect', playerId, targetIds: ['bs12-015-opponent'] })
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
    expect(after.players['player-two'].battleArea[1].hpCards).toHaveLength(4)
    expect(after.players['player-two'].discardPile).toHaveLength(4)
    expect(after.players[playerId].battleArea.map(entry => entry.hpCards)).toEqual(before.players[playerId].battleArea.map(entry => entry.hpCards))
    expect(after.players[playerId].supportArea.every(entry => entry.rested)).toBe(true)
    expect(before.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
  })
  it.each(['attack-solo', 'attack-non-arena', 'attack-equipment', 'attack-support-only', 'attack-opponent-only'] as const)('retains paid ordinary damage but no-ops Then with %s', scenario => {
    const before = attackUntilThen(scenario, number)
    const command = { kind: 'resolve-attack-effect' as const, playerId, targetIds: [] }
    const after = applyGameCommand(before, command)
    expect(after.players['player-two'].battleArea.map(entry => entry.hpCards.length)).toEqual([2, 4])
    expect(after.players['player-two'].discardPile).toHaveLength(3)
    expect(after.players[playerId].supportArea.every(entry => entry.rested)).toBe(true)
    expect(describeCommandSteps(before, after, command)?.map(step => step.text)).toContain('攻擊後效果結果：條件不成立，效果未執行')
  })
  it('rejects moving the extra point to the other opponent', () => {
    const before = attackUntilThen('positive', number)
    const snapshot = structuredClone(before)
    expect(() => applyGameCommand(before, { kind: 'resolve-attack-effect', playerId, targetIds: ['bs12-015-opponent-other'] })).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('does not transfer Then to the other opponent after the original target faints', () => {
    let state = attackUntilThen('target-faints', number)
    if (state.pendingReplacement) state = applyGameCommand(state, { kind: 'skip-replacement', playerId: 'player-two' })
    state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId, targetIds: [] })
    expect(state.players['player-two'].battleArea.map(entry => entry.card.instanceId)).toEqual(['bs12-015-opponent-other'])
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
    expect(state.players['player-two'].discardPile).toHaveLength(3)
    expect(state.players['player-two'].breakArea).toHaveLength(1)
  })
  it('rechecks the other Arena condition when Then resolves', () => {
    const before = attackUntilThen('positive', number)
    const state = { ...before, players: { ...before.players, [playerId]: { ...before.players[playerId], battleArea: before.players[playerId].battleArea.slice(0, 1) } } }
    const after = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId, targetIds: [] })
    expect(after.players['player-two'].battleArea.map(entry => entry.hpCards.length)).toEqual([2, 4])
  })
  it.each(['no-energy', 'wrong-energy', 'few-red', 'rested-energy'] as const)('rejects %s payment without mutation', scenario => {
    let before = createBs12ParfaitDemoState(scenario, number)
    while (before.phase !== 'main') before = advance(before)
    const snapshot = structuredClone(before)
    expect(() => applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: 'bs12-015-source', targetInstanceId: 'bs12-015-opponent',
      supportPaymentIds: before.players[playerId].supportArea.map(entry => entry.card.instanceId) })).toThrow()
    expect(before).toEqual(snapshot)
  })
})
