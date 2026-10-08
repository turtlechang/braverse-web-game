import { describe, expect, it } from 'vitest'
import { createBs12CandyAppleDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill, getCookieSkillUnavailableReason } from './skills'
import { executeCardEffect } from './effects'
import { describeCommandSteps } from './command-log'

const playerId = 'player-one' as const
const sourceId = 'bs12-017-source'
const otherId = 'bs12-017-other'
const cookieCostId = 'bs12-017-hand-cookie'
const itemCostId = 'bs12-017-hand-item'
type State = ReturnType<typeof createBs12CandyAppleDemoState>
const activate = (state: State, targets: string[], cost = [cookieCostId]) => applyGameCommand(state, {
  kind: 'activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'activate', paymentIds: [], discardHandIds: cost, effectTargets: [targets],
})
const attackUntilThen = (prepared: State) => {
  let state = applyGameCommand(prepared, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId,
    targetInstanceId: 'bs12-017-opponent', supportPaymentIds: prepared.players[playerId].supportArea.map(s => s.card.instanceId) })
  expect(state.pendingBattle?.declaredDamage).toBe(2)
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 10; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return state
}

describe.each(['BS12-017', 'BS12-017@1'] as const)('%s hand cost and selectable damage Then', number => {
  it('isolates the candidate route to localhost', () => {
    expect(parseTestStateConfig(`?test-state=bs12-017:${number}:positive`, 'localhost')).toEqual({ kind: 'bs12-017', cardNumber: number, scenario: 'positive' })
    expect(parseTestStateConfig(`?test-state=bs12-017:${number}:positive`, 'example.com')).toBeNull()
  })
  it.each(['positive', 'green-arena', 'active-target', 'source-rested', 'no-energy', 'one-hand'] as const)('pays one card without energy or source REST, then readies another Arena for %s', scenario => {
    const before = createBs12CandyAppleDemoState(scenario, number)
    const snapshot = structuredClone(before)
    const after = activate(before, [otherId])
    expect(after.players[playerId].hand.map(c => c.instanceId)).toEqual(before.players[playerId].hand.slice(1).map(c => c.instanceId))
    expect(after.players[playerId].discardPile.map(c => c.instanceId)).toEqual([cookieCostId])
    expect(after.players[playerId].battleArea[0].rested).toBe(before.players[playerId].battleArea[0].rested)
    expect(after.players[playerId].battleArea[1].rested).toBe(false)
    expect(after.players[playerId].battleArea.map(c => c.hpCards)).toEqual(before.players[playerId].battleArea.map(c => c.hpCards))
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(Object.keys(after.cookiesSetActiveByEffectThisTurn ?? {})).toEqual([after.players[playerId].battleArea[1].battleEntryId])
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it('can discard an Item and select zero, still paying and using the skill', () => {
    const before = createBs12CandyAppleDemoState('positive', number)
    const after = activate(before, [], [itemCostId])
    expect(after.players[playerId].hand.map(c => c.instanceId)).toEqual([cookieCostId])
    expect(after.players[playerId].discardPile.map(c => c.instanceId)).toEqual([itemCostId])
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.cookiesSetActiveByEffectThisTurn ?? {}).toEqual({})
    expect(() => activate(after, [])).toThrow()
  })
  it('all isolated scenarios respect the official two-Cookie battle-area limit', () => {
    for (const scenario of ['positive', 'green-arena', 'active-target', 'source-rested', 'solo', 'non-arena', 'equipment', 'support-only', 'opponent-only', 'no-energy', 'opponent-turn', 'no-hand', 'one-hand', 'no-faerie', 'faerie-support', 'faerie-opponent', 'faerie-variant', 'target-faints', 'wrong-energy', 'few-energy', 'rested-energy', 'attack', 'faerie-only'] as const) {
      const state = createBs12CandyAppleDemoState(scenario, number)
      for (const player of Object.values(state.players)) expect(player.battleArea.length).toBeLessThanOrEqual(2)
    }
  })
  it('real non-Arena Apple Faerie satisfies attack condition but cannot be readied by this skill', () => {
    const before = createBs12CandyAppleDemoState('faerie-only', number)
    const snapshot = structuredClone(before)
    expect(() => activate(before, ['bs12-017-faerie'])).toThrow()
    expect(before).toEqual(snapshot)
    expect(activate(before, []).players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
  })
  it.each(['solo', 'non-arena', 'equipment', 'support-only', 'opponent-only', 'faerie-only'] as const)('zero selection remains legal and costs one card with %s', scenario => {
    const before = createBs12CandyAppleDemoState(scenario, number)
    const after = activate(before, [])
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.players[playerId].discardPile.map(c => c.instanceId)).toEqual([cookieCostId])
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
  })
  it('interactive begin commits discard before any effect, then publicly records ready', () => {
    const before = createBs12CandyAppleDemoState('positive', number)
    const begin = { kind: 'begin-activate-skill' as const, playerId, sourceInstanceId: sourceId, trigger: 'activate' as const, paymentIds: [], discardHandIds: [itemCostId] }
    const begun = applyGameCommand(before, begin)
    expect(begun.players[playerId].hand.map(c => c.instanceId)).toEqual([cookieCostId])
    expect(begun.players[playerId].discardPile.map(c => c.instanceId)).toEqual([itemCostId])
    expect(begun.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(begun.pendingAbilityEffect?.effectIndex).toBe(0)
    expect(describeCommandSteps(before, begun, begin)?.some(step => step.text.includes('棄') && step.text.includes('Guitar'))).toBe(true)
    const resolve = { kind: 'resolve-ability-effect' as const, playerId, targetIds: [otherId] }
    const after = applyGameCommand(begun, resolve)
    expect(after.players[playerId].battleArea[1].rested).toBe(false)
    expect(after.pendingAbilityEffect).toBeUndefined()
    expect(describeCommandSteps(begun, after, resolve)?.map(step => step.text)).toContain('效果結算：Langue de Chat Cookie 已設為活躍。')
  })
  it.each([[], [cookieCostId, itemCostId], [cookieCostId, cookieCostId], ['bs12-017-payment-0'], ['bs12-017-opponent']].map(ids => ({ ids })))('rejects discard cost $ids without mutating state', ({ ids }) => {
    const before = createBs12CandyAppleDemoState('positive', number)
    const snapshot = structuredClone(before)
    expect(() => activate(before, [otherId], ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('cannot activate without a hand card, even when choosing zero', () => {
    const before = createBs12CandyAppleDemoState('no-hand', number)
    expect(canActivateCookieSkill(before, playerId, sourceId, 'activate')).toBe(false)
    expect(getCookieSkillUnavailableReason(before, playerId, sourceId, 'activate')).toBe('需要棄置 1 張符合條件的手牌，但可支付手牌不足。')
    expect(() => activate(before, [], [])).toThrow()
  })
  it.each(['non-arena', 'equipment'] as const)('rejects readying %s and preserves the hand cost', scenario => {
    const before = createBs12CandyAppleDemoState(scenario, number)
    const snapshot = structuredClone(before)
    expect(() => activate(before, [otherId])).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([[sourceId], ['bs12-017-faerie'], ['bs12-017-opponent'], ['bs12-017-payment-0'], [otherId, otherId], [otherId, sourceId]].map(ids => ({ ids })))('rejects ready targets $ids', ({ ids }) => {
    const before = createBs12CandyAppleDemoState('positive', number)
    const snapshot = structuredClone(before)
    expect(() => activate(before, ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each(['active', 'draw', 'support', 'end'] as const)('rejects activation during %s', phase => {
    expect(() => activate({ ...createBs12CandyAppleDemoState('positive', number), phase }, [])).toThrow()
  })
  it('rejects activation during the opponent turn', () => {
    expect(() => activate(createBs12CandyAppleDemoState('opponent-turn', number), [])).toThrow()
  })
  it.each(['attack', 'faerie-variant'] as const)('accepts a real Apple Faerie print and can choose a different opponent for %s', scenario => {
    const prepared = createBs12CandyAppleDemoState(scenario, number)
    const before = attackUntilThen(prepared)
    expect(before.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([2, 4])
    const after = applyGameCommand(before, { kind: 'resolve-attack-effect', playerId, targetIds: ['bs12-017-opponent-other'] })
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([2, 3])
    expect(after.players['player-two'].discardPile).toHaveLength(3)
    expect(after.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(after.players[playerId].hand).toEqual(prepared.players[playerId].hand)
    expect(after.players[playerId].battleArea[0].rested).toBe(true)
  })
  it.each([true, false])('may select the original defender or zero: original=%s', original => {
    const before = attackUntilThen(createBs12CandyAppleDemoState('attack', number))
    const after = applyGameCommand(before, { kind: 'resolve-attack-effect', playerId, targetIds: original ? ['bs12-017-opponent'] : [] })
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([original ? 1 : 2, 4])
    expect(after.players['player-two'].discardPile).toHaveLength(original ? 3 : 2)
  })
  it.each(['no-faerie', 'faerie-support', 'faerie-opponent', 'solo', 'opponent-only', 'support-only'] as const)('does not satisfy the named friendly battle-area condition with %s', scenario => {
    const before = attackUntilThen(createBs12CandyAppleDemoState(scenario, number))
    const command = { kind: 'resolve-attack-effect' as const, playerId, targetIds: [] }
    const after = applyGameCommand(before, command)
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
    expect(after.players['player-two'].battleArea[1]).toEqual(before.players['player-two'].battleArea[1])
    expect(after.players['player-two'].discardPile).toHaveLength(2)
    expect(describeCommandSteps(before, after, command)?.map(s => s.text)).toContain('攻擊後效果結果：條件不成立，效果未執行')
  })
  it('rechecks the named Cookie at Then settlement', () => {
    const before = attackUntilThen(createBs12CandyAppleDemoState('attack', number))
    const moved = executeCardEffect(before, { sourcePlayerId: playerId, sourceInstanceId: sourceId }, { kind: 'return-to-hand', target: { side: 'self', min: 1, max: 1 } }, ['bs12-017-faerie'])
    const after = applyGameCommand(moved, { kind: 'resolve-attack-effect', playerId, targetIds: [] })
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([2, 4])
  })
  it('can damage the remaining opponent after ordinary damage faints the original defender', () => {
    let before = attackUntilThen(createBs12CandyAppleDemoState('target-faints', number))
    if (before.pendingReplacement) before = applyGameCommand(before, { kind: 'skip-replacement', playerId: 'player-two' })
    expect(before.players['player-two'].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-017-opponent-other'])
    const after = applyGameCommand(before, { kind: 'resolve-attack-effect', playerId, targetIds: ['bs12-017-opponent-other'] })
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
    expect(after.players['player-two'].discardPile).toHaveLength(3)
  })
  it.each([[sourceId], ['bs12-017-payment-0'], ['bs12-017-opponent', 'bs12-017-opponent-other'], ['bs12-017-opponent-other', 'bs12-017-opponent-other']].map(ids => ({ ids })))('rejects Then targets $ids', ({ ids }) => {
    const before = attackUntilThen(createBs12CandyAppleDemoState('attack', number))
    const snapshot = structuredClone(before)
    expect(() => applyGameCommand(before, { kind: 'resolve-attack-effect', playerId, targetIds: ids })).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('resets once-per-turn use upon genuine departure and reentry', () => {
    const prepared = activate(createBs12CandyAppleDemoState('positive', number), [])
    const context = { sourcePlayerId: playerId, sourceInstanceId: sourceId }
    const moved = executeCardEffect(prepared, context, { kind: 'return-to-hand', target: { side: 'self', min: 1, max: 1 } }, [sourceId])
    const reentered = executeCardEffect(moved, context, { kind: 'hand-to-battle', amount: 1 }, [sourceId])
    expect(canActivateCookieSkill(reentered, playerId, sourceId, 'activate')).toBe(true)
  })
  it.each(['no-energy', 'wrong-energy', 'few-energy', 'rested-energy', 'source-rested'] as const)('rejects %s attack payment without changing state', scenario => {
    const before = createBs12CandyAppleDemoState(scenario, number)
    const snapshot = structuredClone(before)
    expect(() => attackUntilThen(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
})
