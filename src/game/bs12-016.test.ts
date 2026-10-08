import { describe, expect, it } from 'vitest'
import { createBs12MochiDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { executeCardEffect, isEffectConditionMet } from './effects'
import { describeCommandSteps } from './command-log'

const playerId = 'player-one' as const
const sourceId = 'bs12-016-source'
const otherId = 'bs12-016-other'
type State = ReturnType<typeof createBs12MochiDemoState>
const activate = (state: State, ready: string[], rest: string[]) => applyGameCommand(state, {
  kind: 'activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'activate', paymentIds: [], discardHandIds: [], effectTargets: [ready, rest],
})
const readyItem = (state: State, targets: string[]) => applyGameCommand(state, {
  kind: 'play-item', playerId, instanceId: 'bs12-016-ready-item', paymentIds: ['bs12-016-payment-0'], effectTargets: [targets],
})
const attackUntilThen = (prepared: State) => {
  let state = applyGameCommand(prepared, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId,
    targetInstanceId: 'bs12-016-opponent', supportPaymentIds: prepared.players[playerId].supportArea.filter(s => !s.rested).map(s => s.card.instanceId).slice(-3) })
  expect(state.pendingBattle?.declaredDamage).toBe(3)
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 10; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return state
}

describe.each(['BS12-016', 'BS12-016@1'] as const)('%s free skill and attack history', number => {
  it('uses an isolated candidate route', () => {
    expect(parseTestStateConfig(`?test-state=bs12-016:${number}:positive`, 'localhost')).toEqual({ kind: 'bs12-016', cardNumber: number, scenario: 'positive' })
    expect(parseTestStateConfig(`?test-state=bs12-016:${number}:positive`, 'example.com')).toBeNull()
  })
  it.each(['positive', 'green-arena', 'active-target', 'source-rested', 'no-energy'] as const)('readies another Arena without payment or mandatory source REST for %s', scenario => {
    const before = createBs12MochiDemoState(scenario, number)
    const snapshot = structuredClone(before)
    const after = activate(before, [otherId], [])
    expect(after.players[playerId].battleArea[0].rested).toBe(before.players[playerId].battleArea[0].rested)
    expect(after.players[playerId].battleArea[1].rested).toBe(false)
    expect(after.players[playerId].battleArea.map(c => c.hpCards)).toEqual(before.players[playerId].battleArea.map(c => c.hpCards))
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
    expect(Object.keys(after.cookiesSetActiveByEffectThisTurn ?? {})).toEqual([after.players[playerId].battleArea[1].battleEntryId])
    expect(before).toEqual(snapshot)
  })
  it.each([true, false])('zero target may independently rest source=%s, still consuming the once-per-turn use', rest => {
    const before = createBs12MochiDemoState('solo', number)
    const after = activate(before, [], rest ? [sourceId] : [])
    expect(after.players[playerId].battleArea[0].rested).toBe(rest)
    expect(after.cookiesSetActiveByEffectThisTurn ?? {}).toEqual({})
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
    expect(() => activate(after, [], [])).toThrow()
  })
  it('readies the ally before resting only the source', () => {
    const before = createBs12MochiDemoState('positive', number)
    const after = activate(before, [otherId], [sourceId])
    expect(after.players[playerId].battleArea.map(c => c.rested)).toEqual([true, false])
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
  })
  it('allows optional REST to no-op on an already-rested source', () => {
    const after = activate(createBs12MochiDemoState('source-rested', number), [], [sourceId])
    expect(after.players[playerId].battleArea.map(c => c.rested)).toEqual([true, true])
  })
  it('interactive begin does not pay REST early and resolves both separate effect steps', () => {
    const before = createBs12MochiDemoState('positive', number)
    let state = applyGameCommand(before, { kind: 'begin-activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'activate', paymentIds: [], discardHandIds: [] })
    expect(state.players).toEqual(before.players)
    expect(state.pendingAbilityEffect?.effectIndex).toBe(0)
    const readyCommand = { kind: 'resolve-ability-effect' as const, playerId, targetIds: [otherId] }
    const readyBefore = state
    state = applyGameCommand(state, readyCommand)
    expect(describeCommandSteps(readyBefore, state, readyCommand)?.map(step => step.text)).toContain('效果結算：Langue de Chat Cookie 已設為活躍。')
    expect(state.players[playerId].battleArea.map(c => c.rested)).toEqual([false, false])
    expect(state.pendingAbilityEffect?.effectIndex).toBe(1)
    const restCommand = { kind: 'resolve-ability-effect' as const, playerId, targetIds: [sourceId] }
    const restBefore = state
    state = applyGameCommand(state, restCommand)
    expect(describeCommandSteps(restBefore, state, restCommand)?.map(step => step.text)).toContain('效果結算：Strawberry Mochi Cookie 已橫置。')
    expect(state.players[playerId].battleArea.map(c => c.rested)).toEqual([true, false])
    expect(state.pendingAbilityEffect).toBeUndefined()
  })
  it.each(['non-arena', 'equipment'] as const)('excludes %s from the other Arena target', scenario => {
    const before = createBs12MochiDemoState(scenario, number)
    const snapshot = structuredClone(before)
    expect(() => activate(before, [otherId], [])).toThrow()
    expect(before).toEqual(snapshot)
    expect(activate(before, [], [sourceId]).players[playerId].battleArea[0].rested).toBe(true)
  })
  it.each([[sourceId], ['bs12-016-opponent'], ['bs12-016-payment-0'], [otherId, otherId], [sourceId, otherId]].map(ids => ({ ids })))('rejects ready targets $ids', ({ ids }) => {
    const before = createBs12MochiDemoState('positive', number)
    const snapshot = structuredClone(before)
    expect(() => activate(before, ids, [])).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([[otherId], ['bs12-016-opponent'], [sourceId, sourceId]].map(ids => ({ ids })))('rejects optional REST targets $ids', ({ ids }) => {
    const before = createBs12MochiDemoState('positive', number)
    const snapshot = structuredClone(before)
    expect(() => activate(before, [otherId], ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each(['active', 'draw', 'support', 'end'] as const)('rejects activation during %s', phase => {
    expect(() => activate({ ...createBs12MochiDemoState('positive', number), phase }, [], [])).toThrow()
  })
  it('rejects activation during the opponent turn', () => {
    expect(() => activate(createBs12MochiDemoState('opponent-turn', number), [], [])).toThrow()
  })
  it.each(['effect-ready', 'already-active-ready'] as const)('earns own effect-ready history through 1R item then deals 3 + 2 to the original defender for %s', scenario => {
    const prepared = readyItem(createBs12MochiDemoState(scenario, number), [sourceId])
    const before = attackUntilThen(prepared)
    expect(before.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
    const after = applyGameCommand(before, { kind: 'resolve-attack-effect', playerId, targetIds: ['bs12-016-opponent'] })
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([1, 4])
    expect(after.players['player-two'].discardPile).toHaveLength(5)
    expect(after.players[playerId].battleArea.map(c => c.hpCards)).toEqual(prepared.players[playerId].battleArea.map(c => c.hpCards))
    expect(after.players[playerId].supportArea.every(s => s.rested)).toBe(true)
  })
  it.each(['attack-normal', 'attack-other', 'positive'] as const)('normal Active Phase, another-cookie event, or own ally-ready skill does not qualify: %s', scenario => {
    let prepared = createBs12MochiDemoState(scenario, number)
    if (scenario === 'attack-normal') while (prepared.phase !== 'main') prepared = applyGameCommand(prepared, { kind: 'advance-phase', playerId })
    if (scenario === 'attack-other') prepared = readyItem(prepared, [otherId])
    if (scenario === 'positive') prepared = activate(prepared, [otherId], [])
    const before = attackUntilThen(prepared)
    const command = { kind: 'resolve-attack-effect' as const, playerId, targetIds: [] }
    const after = applyGameCommand(before, command)
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3, 4])
    expect(after.players['player-two'].discardPile).toHaveLength(3)
    expect(describeCommandSteps(before, after, command)?.map(s => s.text)).toContain('攻擊後效果結果：條件不成立，效果未執行')
  })
  it('rejects transferring qualified Then to another opponent', () => {
    const before = attackUntilThen(readyItem(createBs12MochiDemoState('effect-ready', number), [sourceId]))
    const snapshot = structuredClone(before)
    expect(() => applyGameCommand(before, { kind: 'resolve-attack-effect', playerId, targetIds: ['bs12-016-opponent-other'] })).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('does not transfer qualified Then after ordinary damage faints the original target', () => {
    let state = attackUntilThen(readyItem(createBs12MochiDemoState('target-faints', number), [sourceId]))
    if (state.pendingReplacement) state = applyGameCommand(state, { kind: 'skip-replacement', playerId: 'player-two' })
    state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId, targetIds: [] })
    expect(state.players['player-two'].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-016-opponent-other'])
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
    expect(state.players['player-two'].discardPile).toHaveLength(3)
  })
  it('clears old-incarnation qualification and resets once-per-turn use on reentry', () => {
    const context = { sourcePlayerId: playerId, sourceInstanceId: sourceId }
    const prepared = activate(readyItem(createBs12MochiDemoState('effect-ready', number), [sourceId]), [], [])
    expect(canActivateCookieSkill(prepared, playerId, sourceId, 'activate')).toBe(false)
    const moved = executeCardEffect(prepared, context, { kind: 'return-to-hand', target: { side: 'self', min: 1, max: 1 } }, [sourceId])
    const reentered = executeCardEffect(moved, context, { kind: 'hand-to-battle', amount: 1 }, [sourceId])
    expect(canActivateCookieSkill(reentered, playerId, sourceId, 'activate')).toBe(true)
    expect(isEffectConditionMet(reentered, context, { kind: 'damage', amount: 2, target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true }, condition: { kind: 'source-set-active-by-effect-this-turn' } })).toBe(false)
  })
  it('normal next Active Phase clears qualification and once-per-turn use', () => {
    const prepared = activate(readyItem(createBs12MochiDemoState('effect-ready', number), [sourceId]), [], [])
    let state = applyGameCommand(prepared, { kind: 'advance-phase', playerId })
    for (let i = 0; (state.activePlayerId !== playerId || state.phase !== 'active') && i < 15; i++) {
      state = applyGameCommand(state, { kind: 'advance-phase', playerId: state.activePlayerId })
    }
    expect(state.activePlayerId).toBe(playerId)
    expect(state.phase).toBe('active')
    state = applyGameCommand(state, { kind: 'advance-phase', playerId })
    expect(state.cookiesSetActiveByEffectThisTurn).toEqual({})
    expect(canActivateCookieSkill({ ...state, phase: 'main' }, playerId, sourceId, 'activate')).toBe(true)
  })
  it.each(['no-energy', 'wrong-energy', 'few-red', 'rested-energy'] as const)('rejects %s attack payment while free skill remains usable', scenario => {
    const before = createBs12MochiDemoState(scenario, number)
    const snapshot = structuredClone(before)
    expect(canActivateCookieSkill(before, playerId, sourceId, 'activate')).toBe(true)
    expect(() => attackUntilThen(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
})
