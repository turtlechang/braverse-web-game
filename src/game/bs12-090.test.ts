import { describe, expect, it } from 'vitest'
import { BS12_MILKY_WAY_SCENARIOS, createBs12MilkyWayDemoState, parseTestStateConfig } from './demo'
import type { Bs12MilkyWayScenario } from './demo'
import { applyGameCommand } from './commands'
import { getBlockerCandidates, getFaintEffectCardCandidates, getFaintEffectCandidateLabel } from './battle'
import { executeCardEffect, isEffectConditionMet } from './effects'
import { describeCommandSteps } from './command-log'
import { getFaintTriggeredCost } from './skills'
import type { GameState } from './types'

const sourceId = 'bs12-090-source'
const block = (state: GameState, discardHandIds = ['bs12-090-cost']) => applyGameCommand(state, { kind: 'play-blocker', playerId: 'player-one', sourceInstanceId: sourceId, paymentIds: [], discardHandIds })
const damaged = (scenario: Bs12MilkyWayScenario = 'faint-four', number: 'BS12-090' | 'BS12-090@1' = 'BS12-090') => {
  const start = createBs12MilkyWayDemoState(number, scenario)
  const paid = ['direct-attack', 'no-hand-faint', 'last-hp-flip'].includes(scenario) ? applyGameCommand(start, { kind: 'skip-trap', playerId: 'player-one' }) : block(start)
  let state=paid
  for(let hit=0;state.pendingBattle?.stage==='damage'&&hit<4;hit++)state=applyGameCommand(state,{kind:'resolve-next-damage',playerId:'player-one'})
  return state
}
const move = (state: GameState, targetIds = ['bs12-090-target']) => applyGameCommand(state, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds })

describe('090 separate Blocker and free faint movement', () => {
  it.each(['BS12-090', 'BS12-090@1'] as const)('includes newly fainted Blocker as fourth, then moves one own LV1 without another payment: %s', number => {
    const start = createBs12MilkyWayDemoState(number, 'faint-four')
    const snapshot = structuredClone(start)
    const before = damaged('faint-four', number)
    expect(before.players['player-one'].breakArea.filter(card => card.type === 'cookie' && card.skill?.trigger === 'block')).toHaveLength(4)
    expect(before.pendingFaintEffects?.[0].cost).toBeUndefined()
    expect(getFaintTriggeredCost(start.players['player-one'].battleArea[0].card.skill!)).toBeUndefined()
    expect(getFaintEffectCandidateLabel(before)).toBe('自己的休息區 LV.1 餅乾')
    const after = move(before)
    expect(after.players['player-one'].discardPile.map(card => card.instanceId)).toContain('bs12-090-target')
    expect(after.players['player-one'].breakArea.map(card => card.instanceId)).not.toContain('bs12-090-target')
    expect(after.players['player-one'].breakArea.map(card => card.instanceId)).toContain(sourceId)
    expect(after.players['player-one'].hand).toEqual(before.players['player-one'].hand)
    expect(after.players['player-one'].deck).toEqual(before.players['player-one'].deck)
    expect(after.players['player-one'].supportArea).toEqual(before.players['player-one'].supportArea)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(start).toEqual(snapshot)
  })
  it.each(['faint-three', 'wrong-zones'] as const)('does not count non-Blockers or other zones: %s', scenario => {
    const after = damaged(scenario)
    expect(after.pendingFaintEffects).toBeUndefined()
    expect(after.players['player-one'].breakArea.map(card => card.instanceId)).toContain('bs12-090-target')
  })
  it.each(['faint-five', 'mixed-break', 'other-color', 'non-arena-target', 'no-hand-faint', 'direct-attack'] as const)('permits printed Blockers and own LV1 regardless of Arena/color/payment: %s', scenario => {
    const before = damaged(scenario)
    expect(getFaintEffectCardCandidates(before).map(card => card.instanceId)).toContain('bs12-090-target')
    expect(move(before).players['player-one'].discardPile.map(card => card.instanceId)).toContain('bs12-090-target')
  })
  it('may select a LV1 Blocker even though removing it reduces the count below four', () => {
    const before = damaged()
    const after = move(before, ['bs12-090-blocker-0'])
    expect(after.players['player-one'].breakArea.filter(card => card.type === 'cookie' && card.skill?.trigger === 'block')).toHaveLength(3)
    expect(after.players['player-one'].discardPile.map(card => card.instanceId)).toContain('bs12-090-blocker-0')
  })
  it.each(['faint-four', 'no-target'] as const)('zero is a legal free decision: %s', scenario => {
    const before = damaged(scenario)
    const after = move(before, [])
    expect(after.players['player-one'].breakArea).toEqual(before.players['player-one'].breakArea)
    expect(after.players['player-one'].discardPile).toEqual(before.players['player-one'].discardPile)
    expect(after.pendingFaintEffects).toBeUndefined()
  })
  it.each([[sourceId], ['unknown'], ['bs12-090-target', 'bs12-090-blocker-0'], ['bs12-090-target', 'bs12-090-target']])('rejects wrong LV, zone, unknown, duplicate or excess targets: %s', (...targetIds) => {
    const before = damaged()
    const snapshot = structuredClone(before)
    expect(() => move(before, targetIds)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('LV10 faint ends before the free effect or replacement', () => {
    const after = damaged('lv10-defeat')
    expect(after.status).toBe('finished')
    expect(after.pendingFaintEffects).toBeUndefined()
  })
  it('last HP FLIP rescue resolves before faint and avoids the movement', () => {
    const before = damaged('last-hp-flip')
    expect(before.pendingBattle?.stage).toBe('flip')
    const after = applyGameCommand(before, { kind: 'resolve-flip', playerId: 'player-one', activate: true, targetIds: [sourceId], discardHandIds: ['bs12-090-cost'] })
    expect(after.players['player-one'].battleArea.find(cookie => cookie.card.instanceId === sourceId)?.hpCards).toHaveLength(1)
    expect(after.pendingFaintEffects).toBeUndefined()
  })
  it('last HP FLIP decline leads to the free faint selection', () => {
    const before = damaged('last-hp-flip')
    const after = applyGameCommand(before, { kind: 'resolve-flip', playerId: 'player-one', activate: false, targetIds: [] })
    expect(after.pendingFaintEffects?.[0].cost).toBeUndefined()
    expect(move(after).players['player-one'].discardPile.map(card => card.instanceId)).toContain('bs12-090-target')
  })
  it.each(['damage', 'make-faint'] as const)('[isolated generic effect engine] %s queues the independent free clause', kind => {
    const before = createBs12MilkyWayDemoState('BS12-090', 'attack')
    const prepared = createBs12MilkyWayDemoState('BS12-090', 'faint-four')
    const state = { ...before, players: { ...before.players, 'player-one': { ...prepared.players['player-one'], hand: [] } } }
    const after = executeCardEffect(state, { sourcePlayerId: 'player-two', sourceInstanceId: 'bs12-090-attacker' }, kind === 'damage'
      ? { kind, amount: 4, target: { side: 'opponent', min: 1, max: 1 } } : { kind, target: { side: 'opponent', min: 1, max: 1 } }, [sourceId])
    expect(after.pendingFaintEffects?.[0].cost).toBeUndefined()
    expect(move(after).players['player-one'].discardPile.map(card => card.instanceId)).toContain('bs12-090-target')
  })
  it('public log records the selected card actually moving from Break to trash', () => {
    const before = damaged()
    const command = { kind: 'resolve-faint-effect' as const, playerId: 'player-one' as const, targetIds: ['bs12-090-target'] }
    expect(describeCommandSteps(before, applyGameCommand(before, command), command)?.map(step => step.text).join(' ')).toMatch(/Currant Cream Cookie.*休息區.*棄牌區/)
  })
})

it.each(['item-cost', 'stage-cost', 'trap-cost', 'rested-source'] as const)('090 legal Blocker has no added source REST or energy: %s', scenario => {
  const before = createBs12MilkyWayDemoState('BS12-090', scenario)
  const after = block(before)
  expect(after.pendingBattle?.targetInstanceId).toBe(sourceId)
  expect(after.players['player-one'].supportArea).toEqual(before.players['player-one'].supportArea)
  expect(after.players['player-one'].battleArea).toEqual(before.players['player-one'].battleArea)
})
it.each(['wrong-color', 'non-arena', 'split-cost', 'no-hand'] as const)('090 requires purple and Arena on one hand card: %s', scenario => {
  const before = createBs12MilkyWayDemoState('BS12-090', scenario)
  expect(getBlockerCandidates(before, 'player-one')).toEqual([])
  expect(() => block(before)).toThrow()
})
it.each(BS12_MILKY_WAY_SCENARIOS)('090 fixture is isolated and uses no more than four copies, two battle Cookies: %s', scenario => {
  const state = createBs12MilkyWayDemoState('BS12-090', scenario)
  for (const player of Object.values(state.players)) {
    expect(player.battleArea.length).toBeLessThanOrEqual(2)
    const counts = new Map<string, number>()
    const cards = [...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile, ...player.supportArea.map(support => support.card), ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards])]
    for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
    expect([...counts.values()].every(count => count <= 4)).toBe(true)
  }
  expect(parseTestStateConfig(`?test-state=bs12-090:BS12-090:${scenario}`, 'localhost')).toEqual({ kind: 'bs12-090', cardNumber: 'BS12-090', scenario })
  expect(parseTestStateConfig(`?test-state=bs12-090:BS12-090:${scenario}`, 'example.com')).toBeNull()
})
it('090 condition counts current printed Blocker Cookies exactly in own Break', () => {
  const state = damaged()
  expect(isEffectConditionMet(state, { sourcePlayerId: 'player-one', sourceInstanceId: sourceId }, state.pendingFaintEffects![0].effect)).toBe(true)
})
