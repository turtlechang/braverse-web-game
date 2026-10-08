import { describe, expect, it } from 'vitest'
import { createBs12EntranceDemoState, parseTestStateConfig, type Bs12EntranceScenario } from './demo'
import { applyGameCommand } from './commands'
import { getTrapCandidates, getTrapCostOptions } from './battle'
import { getAttackDamageAgainst } from './effects'
import { advancePhase } from './turn'
import { describeCommandSteps } from './command-log'
import { takeAiStep } from './ai'
const playerId = 'player-one' as const
const yes: Bs12EntranceScenario[] = ['four', 'five']
const no: Bs12EntranceScenario[] = ['three', 'arena-only', 'yellow-only', 'non-arena', 'high-level', 'opponent-break', 'trash-arena', 'support-arena', 'battle-arena', 'event-only']
const blocked: Bs12EntranceScenario[] = ['no-energy', 'wrong-energy', 'rested-energy', 'one-energy', 'mixed-energy', 'one-rested', 'disabled', 'used', 'main', 'after-battle']
const command = (before: ReturnType<typeof createBs12EntranceDemoState>, targets = ['bs12-027-attacker'], payments = before.players[playerId].supportArea.slice(0, 2).map(s => s.card.instanceId)) => ({
  kind: 'play-trap' as const, playerId, trapInstanceId: 'bs12-029-trap', paymentIds: payments, targetIds: [], effectTargets: [targets],
})
const play = (before: ReturnType<typeof createBs12EntranceDemoState>, targets?: string[], payments?: string[]) => applyGameCommand(before, command(before, targets, payments))
const finishDamage = (before: ReturnType<typeof createBs12EntranceDemoState>) => {
  let state = before
  for (let i = 0; state.pendingBattle && i < 10; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId })
  return state
}
describe('BS12-029 payment, independent Then condition, and original battle continuation', () => {
  it('routes the candidate', () => expect(parseTestStateConfig('?test-state=bs12-029:four', 'localhost')).toEqual({ kind: 'bs12-029', scenario: 'four' }))
  it.each([...yes, ...no])('%s always pays YY and only the intersection enables Then', scenario => {
    const before = createBs12EntranceDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(getTrapCandidates(before, playerId).map(c => c.instanceId)).toEqual(['bs12-029-trap'])
    expect(getTrapCostOptions(before.players[playerId].hand[0].trap!, before, playerId)).toEqual([{ energy: { yellow: 2 }, discardHand: 0 }])
    const paid = play(before)
    expect(paid.players[playerId].supportArea.filter(s => s.rested)).toHaveLength(2)
    expect(paid.players[playerId].discardPile.at(-1)?.instanceId).toBe('bs12-029-trap')
    expect(paid.pendingBattle?.remainingDamage).toBe(2)
    expect(Boolean(paid.pendingDrawUpTo)).toBe(yes.includes(scenario))
    if (yes.includes(scenario)) expect(paid.pendingDrawUpTo).toMatchObject({ max: 1, sourceCardName: 'Shining Entrance' })
    expect(before).toEqual(snapshot)
  })
  it.each([0, 1])('chooses draw %s after payment, then settles the original attack for two', count => {
    const paid = play(createBs12EntranceDemoState('four'))
    expect(paid.players[playerId].hand).toHaveLength(0)
    const afterDraw = applyGameCommand(paid, { kind: 'resolve-draw-up-to', playerId, drawCount: count })
    expect(afterDraw.players[playerId].hand).toHaveLength(count)
    expect(afterDraw.players[playerId].deck).toHaveLength(12 - count)
    expect(afterDraw.pendingDrawUpTo).toBeFalsy()
    expect(finishDamage(afterDraw).players[playerId].battleArea[0].hpCards).toHaveLength(3)
  })
  it('selects zero in the first effect and still offers Then draw', () => {
    const paid = play(createBs12EntranceDemoState('four'), [])
    expect(paid.pendingDrawUpTo?.max).toBe(1)
    expect(paid.pendingBattle?.remainingDamage).toBe(4)
    const drawn = applyGameCommand(paid, { kind: 'resolve-draw-up-to', playerId, drawCount: 1 })
    expect(finishDamage(drawn).players[playerId].battleArea[0].hpCards).toHaveLength(1)
  })
  it('can target the other opponent without changing the current attacker', () => {
    const paid = play(createBs12EntranceDemoState('three'), ['bs12-027-other'])
    expect(paid.pendingBattle?.remainingDamage).toBe(4)
    expect(getAttackDamageAgainst(paid, 'bs12-027-other', 'bs12-027-defender')).toBe(0)
    expect(getAttackDamageAgainst(paid, 'bs12-027-attacker', 'bs12-027-defender')).toBe(4)
  })
  it('expires at turn end', () => {
    let state = finishDamage(play(createBs12EntranceDemoState('three')))
    state = advancePhase(advancePhase(state))
    expect(getAttackDamageAgainst(state, 'bs12-027-attacker', 'bs12-027-defender')).toBe(4)
  })
  it.each(blocked)('rejects %s atomically', scenario => {
    const before = createBs12EntranceDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(getTrapCandidates(before, playerId)).toEqual([])
    expect(() => play(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([[], ['bs12-029-payment-0'], ['bs12-029-payment-0', 'bs12-029-payment-0']].map(payments => ({ payments })))('rejects incorrect payment %j', ({ payments }) => expect(() => play(createBs12EntranceDemoState('four'), undefined, payments)).toThrow())
  it.each([['bs12-027-defender'], ['bs12-029-payment-0'], ['bs12-027-attacker', 'bs12-027-other'], ['bs12-027-attacker', 'bs12-027-attacker']])('rejects incorrect target %j', (...targets) => expect(() => play(createBs12EntranceDemoState('four'), targets)).toThrow())
  it('refuses a draw beyond the card limit without settling any damage', () => {
    const state = play(createBs12EntranceDemoState('four'))
    expect(() => applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId, drawCount: 2 })).toThrow()
    expect(state.players[playerId].battleArea[0].hpCards).toHaveLength(5)
  })
  it('preserves the battle through Refresh after drawing the last deck card', () => {
    let state = applyGameCommand(play(createBs12EntranceDemoState('short-deck')), { kind: 'resolve-draw-up-to', playerId, drawCount: 1 })
    expect(state.pendingRefresh?.playerId).toBe(playerId)
    expect(state.players[playerId].hand).toHaveLength(1)
    expect(state.players[playerId].battleArea[0].hpCards).toHaveLength(5)
    state = applyGameCommand(state, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-029-refresh-cost', shuffleSeed: 3 })
    expect(state.pendingRefresh).toBeFalsy()
    expect(finishDamage(state).players[playerId].battleArea[0].hpCards).toHaveLength(3)
  })
  it('names the source, YY payments, selected target and draw prompt in public traces', () => {
    const before = createBs12EntranceDemoState()
    const cmd = command(before)
    const text = describeCommandSteps(before, applyGameCommand(before, cmd), cmd)?.map(step => step.text).join(' ')
    expect(text).toMatch(/Shining Entrance/)
    expect(text).toMatch(/支付能量/)
    expect(text).toMatch(/Langue de Chat Cookie/)
  })
  it.each(['four', 'three'] as const)('%s AI pays YY and follows the same conditional draw decision', scenario => {
    const initial = createBs12EntranceDemoState(scenario)
    const paid = takeAiStep(initial, playerId, { level: 2 }).state
    expect(paid.players[playerId].supportArea.filter(s => s.rested)).toHaveLength(2)
    expect(paid.players[playerId].discardPile.at(-1)?.instanceId).toBe('bs12-029-trap')
    expect(paid.pendingBattle?.remainingDamage).toBe(2)
    expect(Boolean(paid.pendingDrawUpTo)).toBe(scenario === 'four')
    if (scenario === 'four') {
      const drawn = takeAiStep(paid, playerId, { level: 2 }).state
      expect(drawn.pendingDrawUpTo).toBeFalsy()
      expect(drawn.players[playerId].hand).toHaveLength(1)
    }
  })
  it.each([...yes, ...no, ...blocked, 'short-deck'] satisfies Bs12EntranceScenario[])('%s fixture respects capacity, break level and copy limits', scenario => {
    const state = createBs12EntranceDemoState(scenario)
    for (const player of Object.values(state.players)) {
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      expect(player.breakArea.reduce((sum, c) => sum + c.level, 0)).toBeLessThan(10)
      const cards = [...player.hand, ...player.breakArea, ...player.discardPile, ...player.supportArea.map(s => s.card), ...player.battleArea.map(c => c.card)]
      for (const id of new Set(cards.map(c => c.id))) expect(cards.filter(c => c.id === id).length).toBeLessThanOrEqual(4)
    }
  })
})
