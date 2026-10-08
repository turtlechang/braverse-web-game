import { describe, expect, it } from 'vitest'
import { createBs12YappingDemoState, createBs12BananaRotiDemoState, parseTestStateConfig, type Bs12YappingScenario } from './demo'
import { applyGameCommand } from './commands'
import { getTrapCandidates, getTrapCostOptions } from './battle'
import { getAttackDamageAgainst } from './effects'
import { takeAiStep } from './ai'
import { advancePhase } from './turn'
import { describeCommandSteps } from './command-log'
import type { GameState } from './types'

const playerId = 'player-one' as const
const free: Bs12YappingScenario[] = ['four', 'five', 'free-no-energy', 'free-wrong-energy', 'free-rested-energy']
const paid: Bs12YappingScenario[] = ['three', 'arena-only', 'yellow-only', 'non-arena', 'high-level', 'opponent-break', 'trash-arena', 'support-arena', 'battle-arena']
const play = (state: GameState, target = ['bs12-027-attacker'], paymentIds?: string[]) => {
  const trap = state.players[playerId].hand.find(c => c.instanceId === 'bs12-027-trap')?.trap
  if (!trap) throw new Error('trap missing')
  const cost = getTrapCostOptions(trap, state, playerId)[0]
  return applyGameCommand(state, { kind: 'play-trap', playerId, trapInstanceId: 'bs12-027-trap', paymentIds: paymentIds ?? ((cost.energy?.yellow ?? 0) === 0 ? [] : [state.players[playerId].supportArea[0].card.instanceId]), targetIds: [], effectTargets: [target] })
}
const settle = (before: GameState) => {
  let state = before
  for (let i = 0; state.pendingBattle && i < 10; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId })
  return state
}
describe('BS12-027 yellow Arena intersection cost and optional opponent modifier', () => {
  it('exposes a localhost-only fixture', () => {
    expect(parseTestStateConfig('?test-state=bs12-027:four', 'localhost')).toEqual({ kind: 'bs12-027', scenario: 'four' })
    expect(parseTestStateConfig('?test-state=bs12-027:four', 'example.com')).toBeNull()
  })
  it.each(free)('%s pays no support, trashes the trap, reduces current attack 4 to 3', scenario => {
    const before = createBs12YappingDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(getTrapCandidates(before, playerId).map(c => c.instanceId)).toEqual(['bs12-027-trap'])
    expect(getTrapCostOptions(before.players[playerId].hand[0].trap!, before, playerId)).toEqual([{ energy: {}, discardHand: 0 }])
    const after = play(before)
    expect(after.pendingBattle).toMatchObject({ remainingDamage: 3, trapUsed: true, stage: 'damage' })
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.players[playerId].hand).toHaveLength(0)
    expect(after.players[playerId].discardPile.at(-1)?.instanceId).toBe('bs12-027-trap')
    expect(after.players[playerId].breakArea).toEqual(before.players[playerId].breakArea)
    expect(settle(after).players[playerId].battleArea[0].hpCards).toHaveLength(2)
    expect(before).toEqual(snapshot)
  })
  it.each(paid)('%s pays Y1 because only currently own yellow AND Arena break Cookies count', scenario => {
    const before = createBs12YappingDemoState(scenario)
    expect(getTrapCostOptions(before.players[playerId].hand[0].trap!, before, playerId)).toEqual([{ energy: { yellow: 1 }, discardHand: 0 }])
    expect(() => play(before, undefined, [])).toThrow()
    const after = play(before)
    expect(after.players[playerId].supportArea[0].rested).toBe(true)
    expect(after.pendingBattle?.remainingDamage).toBe(3)
  })
  it.each(['four', 'three'] as const)('%s allows zero targets but still pays its actual cost', scenario => {
    const before = createBs12YappingDemoState(scenario)
    const after = play(before, [])
    expect(after.pendingBattle?.remainingDamage).toBe(4)
    expect(after.attackModifiers).toEqual([])
    expect(after.players[playerId].supportArea[0].rested).toBe(scenario === 'three')
    expect(settle(after).players[playerId].battleArea[0].hpCards).toHaveLength(1)
  })
  it('can select the other opponent; current attack remains 4 and other 1 becomes 0', () => {
    const after = play(createBs12YappingDemoState('four'), ['bs12-027-other'])
    expect(after.pendingBattle?.remainingDamage).toBe(4)
    expect(getAttackDamageAgainst(after, 'bs12-027-other', 'bs12-027-defender')).toBe(0)
    expect(getAttackDamageAgainst(after, 'bs12-027-attacker', 'bs12-027-defender')).toBe(4)
  })
  it('expires at turn end', () => {
    let after = settle(play(createBs12YappingDemoState('four')))
    after = advancePhase(advancePhase(after))
    expect(getAttackDamageAgainst(after, 'bs12-027-attacker', 'bs12-027-defender')).toBe(4)
  })
  it('a prior Arena entry event after leaving break does not discount this trap', () => {
    const event = createBs12BananaRotiDemoState('removed-event')
    expect(event.arenaCookiesPlacedInBreakThisTurn?.[playerId]).toBeGreaterThan(0)
    const before = createBs12YappingDemoState('three')
    const state = { ...before, arenaCookiesPlacedInBreakThisTurn: event.arenaCookiesPlacedInBreakThisTurn }
    expect(getTrapCostOptions(state.players[playerId].hand[0].trap!, state, playerId)[0].energy).toEqual({ yellow: 1 })
  })
  it.each(['no-energy', 'wrong-energy', 'rested-energy', 'disabled', 'used', 'main', 'after-battle'] as const)('rejects %s atomically', scenario => {
    const before = createBs12YappingDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(getTrapCandidates(before, playerId)).toEqual([])
    expect(() => play(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([['bs12-027-defender'], ['bs12-027-payment'], ['bs12-027-attacker', 'bs12-027-other'], ['bs12-027-attacker', 'bs12-027-attacker']].map(ids => ({ ids })))('rejects illegal target %j', ({ ids }) => {
    const before = createBs12YappingDemoState('four')
    const snapshot = structuredClone(before)
    expect(() => play(before, ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('free activation rejects unnecessary support payment', () => {
    expect(() => play(createBs12YappingDemoState('four'), undefined, ['bs12-027-payment'])).toThrow()
  })
  it('legacy unfiltered break count still counts every Cookie', () => {
    const before = createBs12YappingDemoState('non-arena')
    const trap = before.players[playerId].hand[0].trap!
    expect(getTrapCostOptions({ ...trap, conditionalCost: { condition: { kind: 'break-area-card-count-at-least', count: 4 }, cost: { energy: {} } } }, before, playerId)).toEqual([{ energy: {} }])
  })
  it.each([...free, ...paid, 'no-energy', 'wrong-energy', 'rested-energy', 'disabled', 'used', 'main', 'after-battle'] as Bs12YappingScenario[])('fixture %s respects board, break and copy limits', scenario => {
    const state = createBs12YappingDemoState(scenario)
    for (const player of Object.values(state.players)) {
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      expect(player.breakArea.reduce((sum, c) => sum + c.level, 0)).toBeLessThan(10)
      const cards = [...player.hand, ...player.breakArea, ...player.discardPile, ...player.supportArea.map(s => s.card), ...player.battleArea.map(s => s.card)]
      const counts = new Map<string, number>()
      for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
      for (const count of counts.values()) expect(count).toBeLessThanOrEqual(4)
    }
  })
  it.each(['four', 'three'] as const)('%s AI uses the same cost and modifier', scenario => {
    const before = createBs12YappingDemoState(scenario)
    const result = takeAiStep(before, playerId, { level: 2 })
    expect(result.state.players[playerId].discardPile.at(-1)?.instanceId).toBe('bs12-027-trap')
    expect(result.state.pendingBattle?.remainingDamage).toBe(3)
  })
  it('public command traces name the actual trap, payment and opponent target', () => {
    const before = createBs12YappingDemoState('three')
    const command = { kind: 'play-trap' as const, playerId, trapInstanceId: 'bs12-027-trap', paymentIds: ['bs12-027-payment'], targetIds: [], effectTargets: [['bs12-027-attacker']] }
    const steps = describeCommandSteps(before, applyGameCommand(before, command), command)?.map(s => s.text).join(' ')
    expect(steps).toMatch(/Designers' Yapping/)
    expect(steps).toMatch(/支付能量/)
    expect(steps).toMatch(/Langue de Chat Cookie/)
  })
})
