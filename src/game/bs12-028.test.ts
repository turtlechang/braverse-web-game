import { describe, expect, it } from 'vitest'
import { createBs12CarpetDemoState, parseTestStateConfig, type Bs12CarpetScenario } from './demo'
import { applyGameCommand, getPendingDecision } from './commands'
import { canPlayItem } from './card-abilities'
import { getHandToBreakAreaCostCandidates } from './skills'
import { describeCommandSteps } from './command-log'
import { takeAiStep } from './ai'
import { compileEffectDecisionDescriptor } from './decision-descriptor-compiler'
import type { GameState } from './types'
const playerId = 'player-one' as const
const initial = { kind: 'begin-play-item' as const, playerId, instanceId: 'bs12-028-item', paymentIds: ['bs12-028-payment'], handToBreakAreaIds: ['bs12-028-yellow-cost'] }
const open = (state: GameState, ids = initial.handToBreakAreaIds) => applyGameCommand(state, { ...initial, handToBreakAreaIds: ids })
const draw = (state: GameState, count: number) => {
  state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
  return applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId, drawCount: count })
}
describe('BS12-028 actual hand Cookie cost before optional draw', () => {
  it('routes the isolated candidate and offers only hand Arena Cookies of any color', () => {
    expect(parseTestStateConfig('?test-state=bs12-028:positive', 'localhost')).toEqual({ kind: 'bs12-028', scenario: 'positive' })
    const state = createBs12CarpetDemoState()
    expect(getHandToBreakAreaCostCandidates(state.players[playerId].hand[0].item!.cost, state.players[playerId].hand, initial.instanceId).map(c => c.instanceId)).toEqual(['bs12-028-yellow-cost', 'bs12-028-red-cost'])
  })
  it.each([0, 1, 2, 3])('pays Y1 and moves one Cookie before drawing %s', count => {
    const before = createBs12CarpetDemoState()
    const snapshot = structuredClone(before)
    const paid = open(before)
    expect(paid.players[playerId].supportArea[0].rested).toBe(true)
    expect(paid.players[playerId].breakArea.map(c => c.instanceId)).toContain('bs12-028-yellow-cost')
    expect(paid.players[playerId].discardPile.map(c => c.instanceId)).toEqual([initial.instanceId])
    expect(paid.players[playerId].hand).toHaveLength(3)
    expect(paid.players[playerId].deck).toHaveLength(12)
    expect(paid.arenaCookiesPlacedInBreakThisTurn?.[playerId]).toBe(1)
    const after = draw(paid, count)
    expect(after.players[playerId].hand).toHaveLength(3 + count)
    expect(after.players[playerId].deck).toHaveLength(12 - count)
    expect(after.pendingAbilityEffect).toBeFalsy()
    expect(after.pendingDrawUpTo).toBeFalsy()
    expect(before).toEqual(snapshot)
  })
  it('accepts a red Arena Cookie without yellow or level restrictions', () => {
    const paid = open(createBs12CarpetDemoState('red-only'), ['bs12-028-red-cost'])
    expect(paid.players[playerId].breakArea.at(-1)?.energyColor).toBe('red')
    expect(draw(paid, 0).players[playerId].hand).toHaveLength(0)
  })
  it.each(['no-cost', 'non-arena', 'arena-item', 'no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn', 'outside-main'] as const)('blocks %s atomically with other resources preserved', scenario => {
    const state = createBs12CarpetDemoState(scenario)
    const snapshot = structuredClone(state)
    expect(canPlayItem(state, playerId, initial.instanceId)).toBe(false)
    expect(() => open(state)).toThrow()
    expect(state).toEqual(snapshot)
  })
  it.each([[], ['bs12-028-non-arena'], ['bs12-027-trap'], [initial.instanceId], ['bs12-028-payment'], ['bs12-027-attacker'], ['bs12-028-yellow-cost', 'bs12-028-red-cost'], ['bs12-028-yellow-cost', 'bs12-028-yellow-cost']].map(ids => ({ ids })))('rejects invalid/missing/duplicate cost $ids', ({ ids }) => {
    const state = createBs12CarpetDemoState()
    const snapshot = structuredClone(state)
    expect(() => open(state, ids)).toThrow()
    expect(state).toEqual(snapshot)
  })
  it('records public payment and the exact hand Cookie cost', () => {
    const before = createBs12CarpetDemoState()
    const after = open(before)
    const steps = describeCommandSteps(before, after, initial)!.map(step => step.text).join(' ')
    expect(steps).toMatch(/支付能量/)
    expect(steps).toMatch(/道具代價：手牌餅乾放入休息區/)
    expect(steps).toMatch(/GingerBrave/)
  })
  it('compiles owner-only Arena candidates for the mandatory hand cost', () => {
    const state = createBs12CarpetDemoState()
    const card = state.players[playerId].hand[0]
    const descriptor = compileEffectDecisionDescriptor({ state, playerId, sourcePlayerId: playerId, sourceInstanceId: card.instanceId, sourceCardName: card.name,
      context: { sourcePlayerId: playerId, sourceInstanceId: card.instanceId }, cost: card.item!.cost, effect: card.item!.effects[0], viewerPlayerId: playerId })
    const costSteps = descriptor.steps.filter(step => step.kind === 'cost')
    expect(JSON.stringify(costSteps)).toContain('bs12-028-yellow-cost')
    expect(JSON.stringify(costSteps)).toContain('bs12-028-red-cost')
    expect(JSON.stringify(costSteps)).not.toContain('bs12-028-non-arena')
  })
  it('ends immediately at Break LV10 without creating draw pending', () => {
    const state = open(createBs12CarpetDemoState('break-nine'))
    expect(state.status).toBe('finished')
    expect(state.result?.winnerId).toBe('player-two')
    expect(state.players[playerId].deck).toHaveLength(12)
    expect(state.pendingAbilityEffect).toBeFalsy()
    expect(state.pendingDrawUpTo).toBeFalsy()
  })
  it('continues the chosen three draws through a real Refresh', () => {
    let state = draw(open(createBs12CarpetDemoState('short-deck')), 3)
    expect(state.pendingRefresh?.playerId).toBe(playerId)
    expect(state.players[playerId].hand).toHaveLength(5)
    state = applyGameCommand(state, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-028-refresh-cost', shuffleSeed: 3 })
    expect(state.players[playerId].hand).toHaveLength(6)
    expect(state.players[playerId].breakArea).toHaveLength(5)
    expect(state.arenaCookiesPlacedInBreakThisTurn?.[playerId]).toBe(2)
    expect(state.pendingRefresh).toBeFalsy()
    expect(getPendingDecision(state)).toBeFalsy()
  })
  it('AI sends the same real hand cost in its item command', () => {
    const state = createBs12CarpetDemoState('red-only')
    const step = takeAiStep(state, playerId)
    expect(step.action).toBe('play-item')
    expect(step.state.players[playerId].breakArea.at(-1)?.instanceId).toBe('bs12-028-red-cost')
  })
  it.each(['positive', 'no-cost', 'non-arena', 'arena-item', 'red-only', 'wrong-energy', 'rested-energy', 'no-energy', 'opponent-turn', 'outside-main', 'break-nine', 'short-deck'] satisfies Bs12CarpetScenario[])('keeps a legal fixture capacity for %s', scenario => {
    const state = createBs12CarpetDemoState(scenario)
    for (const player of Object.values(state.players)) {
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      expect(player.breakArea.reduce((sum, c) => sum + c.level, 0)).toBeLessThan(10)
    }
    const printed = Object.values(state.players).flatMap(p => [...p.hand, ...p.breakArea, ...p.discardPile, ...p.supportArea.map(s => s.card), ...p.battleArea.map(c => c.card)]).filter(c => /^(BS|ST|P)-?\d/.test(c.id))
    for (const id of new Set(printed.map(c => c.id))) expect(printed.filter(c => c.id === id).length).toBeLessThanOrEqual(4)
  })
})
