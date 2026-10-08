import { describe, expect, it } from 'vitest'
import { createBs12HarmonyDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { getTrapCandidates } from './battle'
import { getAttackDamageAgainst } from './effects'
import { advancePhase } from './turn'

const playerId = 'player-one' as const
const command = (targets = ['bs12-009-attacker'], paymentIds = ['bs12-047-payment-0', 'bs12-047-payment-1']) => ({
  kind: 'play-trap' as const, playerId, trapInstanceId: 'bs12-047-trap', paymentIds, targetIds: [], effectTargets: [targets],
})
const finish = (before: ReturnType<typeof createBs12HarmonyDemoState>) => {
  let state = before
  for (let i = 0; state.pendingBattle && i < 10; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId })
  return state
}
describe('047 fixed payment and independent conditional Then', () => {
  it('keeps its fixture on localhost', () => {
    expect(parseTestStateConfig('?test-state=bs12-047:seven', 'localhost')).toEqual({ kind: 'bs12-047', scenario: 'seven' })
    expect(parseTestStateConfig('?test-state=bs12-047:seven', 'example.com')).toBeNull()
  })
  it.each(['seven', 'six', 'eight', 'non-arena', 'rested-other', 'opponent-only', 'battle-only'] as const)('%s always pays GG and counts only own total supports', scenario => {
    const before = createBs12HarmonyDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(getTrapCandidates(before, playerId).map(c => c.instanceId)).toEqual(['bs12-047-trap'])
    const after = applyGameCommand(before, command())
    expect(after.players[playerId].supportArea.slice(0, 2).every(s => s.rested)).toBe(true)
    expect(after.players[playerId].discardPile.at(-1)?.instanceId).toBe('bs12-047-trap')
    expect(after.pendingBattle?.remainingDamage).toBe(2)
    expect(Boolean(after.pendingDrawUpTo)).toBe(['seven', 'eight', 'non-arena', 'rested-other'].includes(scenario))
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(before).toEqual(snapshot)
  })
  it.each([0, 1])('draws %s then continues ordinary damage for two', count => {
    const paid = applyGameCommand(createBs12HarmonyDemoState(), command())
    const drawn = applyGameCommand(paid, { kind: 'resolve-draw-up-to', playerId, drawCount: count })
    expect(drawn.players[playerId].hand).toHaveLength(count)
    expect(drawn.players[playerId].deck).toHaveLength(12 - count)
    expect(finish(drawn).players[playerId].battleArea[0].hpCards).toHaveLength(3)
  })
  it('first effect zero still draws, and targeting another opponent leaves attacker unchanged', () => {
    const zero = applyGameCommand(createBs12HarmonyDemoState(), command([]))
    expect(zero.pendingDrawUpTo?.max).toBe(1)
    expect(zero.pendingBattle?.remainingDamage).toBe(4)
    const other = applyGameCommand(createBs12HarmonyDemoState('six'), command(['bs12-009-other']))
    expect(other.pendingDrawUpTo).toBeFalsy()
    expect(other.pendingBattle?.remainingDamage).toBe(4)
    expect(getAttackDamageAgainst(other, 'bs12-009-other', 'bs12-009-defender')).toBe(0)
  })
  it.each(['no-energy', 'one-energy', 'wrong-energy', 'mixed-energy', 'rested-energy', 'one-rested', 'disabled', 'used', 'main', 'after-battle'] as const)('rejects %s atomically', scenario => {
    const before = createBs12HarmonyDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(getTrapCandidates(before, playerId)).toEqual([])
    expect(() => applyGameCommand(before, command())).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([[], ['bs12-047-payment-0'], ['bs12-047-payment-0', 'bs12-047-payment-0'], ['bs12-047-payment-0', 'bs12-047-payment-2']].map(paymentIds => ({ paymentIds })))('rejects incorrect payment %j', ({ paymentIds }) => {
    expect(() => applyGameCommand(createBs12HarmonyDemoState(), command(undefined, paymentIds))).toThrow()
  })
  it.each([['bs12-009-defender'], ['bs12-047-payment-0'], ['bs12-009-attacker', 'bs12-009-other'], ['bs12-009-attacker', 'bs12-009-attacker']].map(targets => ({ targets })))('rejects incorrect targets %j', ({ targets }) => {
    expect(() => applyGameCommand(createBs12HarmonyDemoState(), command(targets))).toThrow()
  })
  it('expires at the turn handoff', () => {
    const paid = applyGameCommand(createBs12HarmonyDemoState('six'), command())
    const next = advancePhase(advancePhase(finish(paid)))
    expect(getAttackDamageAgainst(next, 'bs12-009-attacker', 'bs12-009-defender')).toBe(4)
  })
  it('keeps the battle waiting through Refresh and resumes only after the choice', () => {
    const paid = applyGameCommand(createBs12HarmonyDemoState('short-deck'), command())
    const waiting = applyGameCommand(paid, { kind: 'resolve-draw-up-to', playerId, drawCount: 1 })
    expect(waiting.pendingRefresh?.playerId).toBe(playerId)
    expect(waiting.players[playerId].battleArea[0].hpCards).toHaveLength(5)
    const refreshed = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-047-refresh', shuffleSeed: 47 })
    expect(refreshed.players[playerId].deck).toHaveLength(6)
    expect(finish(refreshed).players[playerId].battleArea[0].hpCards).toHaveLength(3)
  })
  it('halts damage after Refresh reaches LV10', () => {
    const waiting = applyGameCommand(applyGameCommand(createBs12HarmonyDemoState('refresh-lv10'), command()), { kind: 'resolve-draw-up-to', playerId, drawCount: 1 })
    const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-047-refresh', shuffleSeed: 47 })
    expect(after.status).toBe('finished')
    expect(after.result?.winnerId).toBe('player-two')
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(5)
  })
})
