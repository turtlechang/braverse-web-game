import { describe, expect, it } from 'vitest'
import { createBs12ActivePhaseDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { describeCommandSteps } from './command-log'
import { executeCardEffect, isCookieActivePhasePrevented } from './effects'
import { canActivateCookieSkill } from './skills'

const playerId = 'player-one' as const
const advance = (state: ReturnType<typeof createBs12ActivePhaseDemoState>) => applyGameCommand(state, { kind: 'advance-phase', playerId })
describe.each(['BS12-014', 'BS12-014@1'] as const)('%s Active Phase passive', number => {
  it('uses an isolated candidate route', () => {
    expect(parseTestStateConfig(`?test-state=bs12-014:${number}:solo`, 'localhost')).toEqual({ kind: 'bs12-014', cardNumber: number, scenario: 'solo' })
    expect(parseTestStateConfig(`?test-state=bs12-014:${number}:solo`, 'example.com')).toBeNull()
  })
  it.each(['solo', 'non-arena', 'equipment', 'support-only', 'opponent-only'] as const)('keeps source rested for %s but readies other ordinary cards', scenario => {
    const before = createBs12ActivePhaseDemoState(scenario, number)
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
    const before = createBs12ActivePhaseDemoState(scenario, number)
    const after = advance(before)
    expect(after.players[playerId].battleArea.every(cookie => !cookie.rested)).toBe(true)
    expect(after.cookiesSetActiveByEffectThisTurn).toEqual({})
    expect(describeCommandSteps(before, after, { kind: 'advance-phase', playerId })?.map(step => step.text).join(' ')).toContain('有另一張【Arena】餅乾')
  })
  it('does not force an already-active source to rest', () => {
    expect(advance(createBs12ActivePhaseDemoState('already-active', number)).players[playerId].battleArea[0].rested).toBe(false)
  })
  it('does not prohibit readying by a main-phase item with no other Arena Cookie', () => {
    let state = advance(createBs12ActivePhaseDemoState('effect-ready', number))
    state = advance(advance(state))
    expect(state.phase).toBe('main')
    expect(state.players[playerId].battleArea[0].rested).toBe(true)
    state = applyGameCommand(state, { kind: 'play-item', playerId, instanceId: 'bs12-014-ready-item', paymentIds: ['bs12-014-payment-0'], effectTargets: [['bs12-014-source']] })
    expect(state.players[playerId].battleArea[0].rested).toBe(false)
    expect(state.players[playerId].battleArea[1].rested).toBe(false)
    expect(state.players[playerId].battleArea[0].hpCards).toHaveLength(1)
  })
  it('is not an Activate skill and is inactive after the source leaves battle', () => {
    const before = createBs12ActivePhaseDemoState('positive', number)
    expect(canActivateCookieSkill({ ...before, phase: 'main' }, playerId, 'bs12-014-source', 'activate')).toBe(false)
    const moved = executeCardEffect(before, { sourcePlayerId: playerId, sourceInstanceId: 'bs12-014-source' },
      { kind: 'return-to-hand', target: { side: 'self', min: 1, max: 1 } }, ['bs12-014-source'])
    expect(isCookieActivePhasePrevented(moved, playerId, 'bs12-014-source')).toBe(false)
    expect(advance(moved).players[playerId].battleArea.every(cookie => !cookie.rested)).toBe(true)
  })
  it('only readies the current owner during the opponent Active Phase', () => {
    const before = createBs12ActivePhaseDemoState('opponent-turn', number)
    const after = applyGameCommand(before, { kind: 'advance-phase', playerId: 'player-two' })
    expect(after.players[playerId]).toEqual(before.players[playerId])
    expect(after.players['player-two'].battleArea[0].rested).toBe(false)
  })
  it('declares the printed RR attack for exactly 3 damage after ordinary readying', () => {
    let state = advance(createBs12ActivePhaseDemoState('positive', number))
    state = advance(advance(state))
    const after = applyGameCommand(state, { kind: 'declare-attack', playerId, attackerInstanceId: 'bs12-014-source', targetInstanceId: 'bs12-014-opponent', supportPaymentIds: ['bs12-014-payment-0', 'bs12-014-payment-1'] })
    expect(after.pendingBattle?.declaredDamage).toBe(3)
    expect(after.players[playerId].supportArea.map(card => card.rested)).toEqual([true, true, false])
    expect(after.players[playerId].battleArea.map(cookie => cookie.rested)).toEqual([true, false])
  })
  it('respects an independent next-phase prevention even when another Arena exists', () => {
    const before = createBs12ActivePhaseDemoState('positive', number)
    const after = advance({ ...before, preventCookieActiveNextPhase: { [playerId]: ['bs12-014-source'] } })
    expect(after.players[playerId].battleArea[0].rested).toBe(true)
    expect(after.preventCookieActiveNextPhase).toBeUndefined()
    expect(describeCommandSteps({ ...before, preventCookieActiveNextPhase: { [playerId]: ['bs12-014-source'] } }, after, { kind: 'advance-phase', playerId })?.map(step => step.text).join(' ')).toContain('其他效果阻止活躍')
  })
})
