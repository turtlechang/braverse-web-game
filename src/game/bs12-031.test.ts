import { describe, expect, it } from 'vitest'
import { createBs12SpotlightDemoState, parseTestStateConfig, type Bs12SpotlightScenario } from './demo'
import { applyGameCommand, getPendingDecision } from './commands'
import { canPlayItem } from './card-abilities'
import { getTrashBattleCookieCostCandidates } from './skills'
import { describeCommandSteps } from './command-log'
import { takeAiStep } from './ai'
import type { GameState } from './types'
const playerId = 'player-one' as const
const initial = { kind: 'begin-play-item' as const, playerId, instanceId: 'bs12-031-item', paymentIds: ['bs12-031-payment-0', 'bs12-031-payment-1'], trashBattleCookieIds: ['bs12-031-cost'] }
const open = (state: GameState, ids = initial.trashBattleCookieIds) => applyGameCommand(state, { ...initial, trashBattleCookieIds: ids })
const draw = (state: GameState, count: number) => applyGameCommand(applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds: [] }), { kind: 'resolve-draw-up-to', playerId, drawCount: count })
const damage = (state: GameState, ids: string[] = ['bs12-031-opponent']) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds: ids })

describe('BS12-031 mandatory battle cost and independent optional effects', () => {
  it('routes the candidate with only own yellow AND Arena cost candidates', () => {
    expect(parseTestStateConfig('?test-state=bs12-031:positive', 'localhost')).toEqual({ kind: 'bs12-031', scenario: 'positive' })
    const state = createBs12SpotlightDemoState()
    expect(getTrashBattleCookieCostCandidates(state.players[playerId].hand[0].item!.cost, state.players[playerId].battleArea).map(c => c.card.instanceId)).toEqual(['bs12-031-cost'])
  })
  it.each([0, 1])('moves the actual Cookie and HP before drawing %s and still permits damage', count => {
    const before = createBs12SpotlightDemoState()
    const snapshot = structuredClone(before)
    const paid = open(before)
    expect(paid.players[playerId].breakArea.map(c => c.instanceId)).toEqual(['bs12-031-cost'])
    expect(paid.players[playerId].discardPile.map(c => c.instanceId)).toEqual(['bs12-031-cost-hp-0', 'bs12-031-cost-hp-1', initial.instanceId])
    expect(paid.players[playerId].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-031-other'])
    expect(paid.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(paid.arenaCookiesPlacedInBreakThisTurn?.[playerId]).toBe(1)
    expect(paid.cookiesFaintedThisTurn?.[playerId] ?? 0).toBe(0)
    expect(paid.pendingReplacement).toBeFalsy()
    expect(paid.players[playerId].deck).toHaveLength(12)
    const drawn = draw(paid, count)
    expect(drawn.players[playerId].hand).toHaveLength(count)
    expect(drawn.players[playerId].deck).toHaveLength(12 - count)
    expect(drawn.pendingAbilityEffect?.effectIndex).toBe(1)
    const after = damage(drawn)
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
    expect(after.players['player-two'].battleArea[1].hpCards).toHaveLength(3)
    expect(after.pendingAbilityEffect).toBeFalsy()
    expect(before).toEqual(snapshot)
  })
  it.each([0, 1])('draw %s and zero damage still pays every cost', count => {
    const after = damage(draw(open(createBs12SpotlightDemoState()), count), [])
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
    expect(after.players[playerId].supportArea.every(s => s.rested)).toBe(true)
  })
  it('can damage the other opponent of a different color', () => {
    const after = damage(draw(open(createBs12SpotlightDemoState()), 0), ['bs12-031-opponent-other'])
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([4, 2])
  })
  it.each([['bs12-031-other'], ['bs12-031-cost'], ['bs12-031-payment-0'], ['bs12-031-opponent', 'bs12-031-opponent-other'], ['bs12-031-opponent', 'bs12-031-opponent']].map(ids => ({ ids })))('rejects illegal damage targets $ids without changing the paid state', ({ ids }) => {
    const state = draw(open(createBs12SpotlightDemoState()), 0)
    const snapshot = structuredClone(state)
    expect(() => damage(state, ids)).toThrow()
    expect(state).toEqual(snapshot)
  })
  it('damage can faint the original chosen opponent and creates replacement only afterwards', () => {
    const state = damage(draw(open(createBs12SpotlightDemoState('opponent-faints')), 0))
    expect(state.players['player-two'].breakArea.map(c => c.instanceId)).toContain('bs12-031-opponent')
    expect(state.players['player-two'].battleArea[0].card.instanceId).toBe('bs12-031-opponent-other')
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
  })
  it('an already empty opponent battlefield ends the game before any further damage decision', () => {
    const state = draw(open(createBs12SpotlightDemoState('no-target')), 0)
    expect(state.status).toBe('finished')
    expect(() => damage(state, [])).toThrow()
    expect(state.players[playerId].breakArea[0].instanceId).toBe('bs12-031-cost')
    expect(state.players[playerId].supportArea.every(s => s.rested)).toBe(true)
  })
  it.each(['no-cost', 'red-arena', 'yellow-non-arena', 'equipment-only', 'support-only', 'no-energy', 'one-energy', 'wrong-energy', 'mixed-energy', 'rested-energy', 'opponent-turn', 'outside-main'] as const)('blocks %s while retaining all other resources', scenario => {
    const state = createBs12SpotlightDemoState(scenario)
    const snapshot = structuredClone(state)
    expect(canPlayItem(state, playerId, initial.instanceId)).toBe(false)
    expect(() => open(state)).toThrow()
    expect(state).toEqual(snapshot)
  })
  it.each([[], ['bs12-031-other'], [initial.instanceId], ['bs12-031-payment-0'], ['bs12-031-opponent'], ['bs12-031-cost', 'bs12-031-other'], ['bs12-031-cost', 'bs12-031-cost']].map(ids => ({ ids })))('rejects invalid/duplicate/missing mandatory cost $ids', ({ ids }) => {
    const state = createBs12SpotlightDemoState()
    const snapshot = structuredClone(state)
    expect(() => open(state, ids)).toThrow()
    expect(state).toEqual(snapshot)
  })
  it.each(['rested-cost'] as const)('accepts %s and discards its HP', scenario => {
    const before = createBs12SpotlightDemoState(scenario)
    const after = open(before)
    expect(after.players[playerId].breakArea[0].instanceId).toBe('bs12-031-cost')
    expect(after.players[playerId].discardPile).toHaveLength(3)
    expect(after.pendingFaintEffects).toBeFalsy()
  })
  it('rejects a legally equipped green Arena Cookie as the mandatory yellow Arena cost', () => {
    const before = createBs12SpotlightDemoState('equipped-cost')
    const snapshot = structuredClone(before)
    const host = before.players[playerId].battleArea[0]
    expect(host.card).toMatchObject({ id: 'BS7-055', name: 'Shining Glitter Cookie', cardColor: 'green' })
    expect(host.equippedCards?.map(card => card.id)).toEqual(['BS12-007'])
    expect(canPlayItem(before, playerId, 'bs12-031-item')).toBe(false)
    expect(() => open(before)).toThrow(/不符合代價條件/)
    expect(before).toEqual(snapshot)
  })
  it('can choose the second qualifying cost Cookie', () => {
    const after = open(createBs12SpotlightDemoState('two-costs'), ['bs12-031-other'])
    expect(after.players[playerId].breakArea[0].instanceId).toBe('bs12-031-other')
  })
  it('records actual public energy and direct battle-to-break cost without a faint label', () => {
    const before = createBs12SpotlightDemoState()
    const steps = describeCommandSteps(before, open(before), initial)!.map(s => s.text).join(' ')
    expect(steps).toMatch(/支付能量/)
    expect(steps).toMatch(/道具代價：戰鬥區餅乾放入休息區/)
    expect(steps).toMatch(/GingerBrave/)
    expect(steps).not.toMatch(/昏厥/)
  })
  it('ends at Break LV10 before any optional effect', () => {
    const state = open(createBs12SpotlightDemoState('break-nine'))
    expect(state.status).toBe('finished')
    expect(state.result?.winnerId).toBe('player-two')
    expect(state.players[playerId].deck).toHaveLength(12)
    expect(state.pendingAbilityEffect).toBeFalsy()
  })
  it('waits until both effects finish before scheduling own replacement', () => {
    let state = open(createBs12SpotlightDemoState('single-cookie'))
    expect(state.pendingReplacement).toBeFalsy()
    state = draw(state, 0)
    expect(state.pendingReplacement).toBeFalsy()
    state = damage(state)
    expect(state.pendingReplacement?.tasks[0]).toMatchObject({ playerId, remaining: 1 })
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
  })
  it('resumes damage only after the final draw and Refresh', () => {
    let state = draw(open(createBs12SpotlightDemoState('short-deck')), 1)
    expect(state.pendingRefresh?.playerId).toBe(playerId)
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
    state = applyGameCommand(state, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-031-refresh-cost', shuffleSeed: 3 })
    expect(state.pendingRefresh).toBeFalsy()
    expect(state.pendingAbilityEffect?.effectIndex).toBe(1)
    expect(damage(state).players['player-two'].battleArea[0].hpCards).toHaveLength(3)
  })
  it('AI uses the same mandatory cost and can continue the paid ability', () => {
    const step = takeAiStep(open(createBs12SpotlightDemoState()), playerId)
    expect(step.state.players[playerId].breakArea[0].instanceId).toBe('bs12-031-cost')
    expect(step.state.players[playerId].supportArea.every(s => s.rested)).toBe(true)
  })
  it('AI ordinary item declaration pays YY and the selected battle Cookie cost', () => {
    const before = createBs12SpotlightDemoState()
    const p = before.players[playerId]
    const state = { ...before, players: { ...before.players, [playerId]: { ...p, battleArea: p.battleArea.map(c => ({ ...c, rested: true })) } } }
    const step = takeAiStep(state, playerId)
    expect(step.action).toBe('play-item')
    expect(step.state.players[playerId].breakArea.map(c => c.instanceId)).toContain('bs12-031-cost')
    expect(step.state.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    let after = step.state
    for (let i = 0; i < 4 && (getPendingDecision(after) || after.pendingAbilityEffect); i++) after = takeAiStep(after, playerId).state
    expect(after.players['player-two'].battleArea.reduce((sum, c) => sum + c.hpCards.length, 0)).toBe(6)
    expect(after.pendingAbilityEffect).toBeFalsy()
  })
  it.each(['positive', 'two-costs', 'no-cost', 'red-arena', 'yellow-non-arena', 'equipment-only', 'support-only', 'rested-cost', 'no-energy', 'one-energy', 'wrong-energy', 'mixed-energy', 'rested-energy', 'opponent-turn', 'outside-main', 'break-nine', 'single-cookie', 'equipped-cost', 'opponent-faints', 'no-target', 'short-deck'] satisfies Bs12SpotlightScenario[])('fixture %s respects battle capacity, Break LV and printed copies', scenario => {
    const state = createBs12SpotlightDemoState(scenario)
    for (const p of Object.values(state.players)) {
      expect(p.battleArea.length).toBeLessThanOrEqual(2)
      expect(p.breakArea.reduce((sum, c) => sum + c.level, 0)).toBeLessThan(10)
      const cards = [...p.hand, ...p.deck, ...p.breakArea, ...p.discardPile, ...p.supportArea.map(s => s.card), ...p.battleArea.flatMap(c => [c.card, ...(c.equippedCards ?? [])])]
      for (const id of new Set(cards.map(c => c.id))) expect(cards.filter(c => c.id === id).length).toBeLessThanOrEqual(4)
    }
  })
})
