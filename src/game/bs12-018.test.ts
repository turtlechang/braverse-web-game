import { describe, expect, it } from 'vitest'
import { createBs12GlitterDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canPlayExtraDeckCookie, getExtraDeckCookieUnavailableReason } from './actions'
import { canActivateCookieSkill } from './skills'
import { isEffectConditionMet } from './effects'
import { describeCommandSteps } from './command-log'

const playerId = 'player-one' as const
const sourceId = 'bs12-018-source'
const otherId = 'bs12-018-other'
const handId = 'bs12-018-hand'
type State = ReturnType<typeof createBs12GlitterDemoState>
const activate = (state: State, targets: string[]) => applyGameCommand(state, {
  kind: 'activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'activate', paymentIds: [], discardHandIds: [], effectTargets: [targets],
})
const attack = (before: State) => {
  let state = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-018-opponent', supportPaymentIds: before.players[playerId].supportArea.map(s => s.card.instanceId) })
  expect(state.pendingBattle?.declaredDamage).toBe(4)
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 12; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return state
}

describe.each(['BS12-018', 'BS12-018@1'] as const)('%s EXTRA, free Activate and second-player Then', number => {
  it('keeps fixture routes local', () => {
    expect(parseTestStateConfig(`?test-state=bs12-018:${number}:extra`, 'localhost')).toEqual({ kind: 'bs12-018', cardNumber: number, scenario: 'extra' })
    expect(parseTestStateConfig(`?test-state=bs12-018:${number}:extra`, 'example.com')).toBeNull()
  })
  it.each(['extra', 'green-hand', 'item-hand'] as const)('pays a real Arena card before entering with five HP: %s', scenario => {
    const before = createBs12GlitterDemoState(scenario, number)
    const snapshot = structuredClone(before)
    expect(before.players[playerId].breakArea.reduce((sum, c) => sum + c.level, 0)).toBe(4)
    expect(canPlayExtraDeckCookie(before, playerId, sourceId)).toBe(true)
    const begin = { kind: 'play-extra-deck-cookie' as const, playerId, instanceId: sourceId }
    const begun = applyGameCommand(before, begin)
    expect(begun.pendingOptionalCostAttack).toMatchObject({ mandatory: true, extraDeckPlayInstanceId: sourceId, cost: { discardHand: 1, discardHandKeyword: 'arena' } })
    expect(begun.players).toEqual(before.players)
    const pay = { kind: 'resolve-optional-cost-attack' as const, playerId, action: 'pay' as const, discardCardIds: [handId], paymentIds: [] }
    const after = applyGameCommand(begun, pay)
    expect(after.players[playerId].extraDeck).toEqual([])
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].discardPile.map(c => c.instanceId)).toEqual([handId])
    expect(after.players[playerId].deck.length).toBe(before.players[playerId].deck.length - 5)
    expect(after.players[playerId].battleArea).toHaveLength(2)
    const source = after.players[playerId].battleArea.find(c => c.card.instanceId === sourceId)!
    expect(source.hpCards).toEqual(before.players[playerId].deck.slice(0, 5))
    expect(source.card.extraDeckOrigin).toBe('extra')
    expect(after.players[playerId].battleArea[0]).toEqual(before.players[playerId].battleArea[0])
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.players[playerId].breakArea).toEqual(before.players[playerId].breakArea)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(after.extraDeckPlayUsedThisTurn).toBe(true)
    expect(after.pendingOptionalCostAttack).toBeNull()
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(true)
    const ready = activate(after, [otherId])
    expect(ready.players[playerId].battleArea[0].rested).toBe(false)
    expect(ready.players[playerId].discardPile).toEqual(after.players[playerId].discardPile)
    expect(describeCommandSteps(begun, after, pay)?.some(step => step.text.includes('棄') && step.text.includes(before.players[playerId].hand[0].name))).toBe(true)
    expect(before).toEqual(snapshot)
  })
  it.each(['break-low', 'no-hand', 'non-arena-hand', 'full-battle'] as const)('blocks illegal EXTRA entry: %s', scenario => {
    const before = createBs12GlitterDemoState(scenario, number)
    const snapshot = structuredClone(before)
    expect(canPlayExtraDeckCookie(before, playerId, sourceId)).toBe(false)
    expect(getExtraDeckCookieUnavailableReason(before, playerId, sourceId)).not.toBeNull()
    expect(() => applyGameCommand(before, { kind: 'play-extra-deck-cookie', playerId, instanceId: sourceId })).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([[], [handId, handId], ['bs12-018-payment-0'], ['bs12-018-opponent']].map(ids => ({ ids })))('rejects invalid mandatory discard $ids', ({ ids }) => {
    const before = applyGameCommand(createBs12GlitterDemoState('extra', number), { kind: 'play-extra-deck-cookie', playerId, instanceId: sourceId })
    const snapshot = structuredClone(before)
    expect(() => applyGameCommand(before, { kind: 'resolve-optional-cost-attack', playerId, action: 'pay', discardCardIds: ids, paymentIds: [] })).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('mandatory EXTRA cost cannot be skipped', () => {
    const before = applyGameCommand(createBs12GlitterDemoState('extra', number), { kind: 'play-extra-deck-cookie', playerId, instanceId: sourceId })
    expect(() => applyGameCommand(before, { kind: 'resolve-optional-cost-attack', playerId, action: 'skip' })).toThrow()
  })
  it.each(['active', 'end'] as const)('EXTRA cannot bypass its main-phase timing in %s phase', phase => {
    const before = { ...createBs12GlitterDemoState('extra', number), phase }
    expect(canPlayExtraDeckCookie(before, playerId, sourceId)).toBe(false)
    expect(() => applyGameCommand(before, { kind: 'play-extra-deck-cookie', playerId, instanceId: sourceId })).toThrow()
  })
  it('EXTRA cannot be played by the inactive player or twice in a turn', () => {
    const before = createBs12GlitterDemoState('extra', number)
    expect(canPlayExtraDeckCookie({ ...before, activePlayerId: 'player-two' }, playerId, sourceId)).toBe(false)
    expect(canPlayExtraDeckCookie({ ...before, extraDeckPlayUsedThisTurn: true }, playerId, sourceId)).toBe(false)
  })
  it.each(['positive', 'active-target', 'source-rested', 'no-energy'] as const)('readies only another red Arena for free: %s', scenario => {
    const before = createBs12GlitterDemoState(scenario, number)
    const snapshot = structuredClone(before)
    const after = activate(before, [otherId])
    expect(after.players[playerId].battleArea.find(cookie => cookie.card.instanceId === otherId)!.rested).toBe(false)
    expect(after.players[playerId].battleArea.find(cookie => cookie.card.instanceId === sourceId)).toEqual(before.players[playerId].battleArea.find(cookie => cookie.card.instanceId === sourceId))
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
    expect(after.players[playerId].discardPile).toEqual(before.players[playerId].discardPile)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it.each(['solo', 'green-arena', 'non-arena', 'equipment', 'support-only', 'opponent-only'] as const)('zero target still uses free skill: %s', scenario => {
    const before = createBs12GlitterDemoState(scenario, number)
    const after = activate(before, [])
    expect(after.players).toEqual(before.players)
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
  })
  it.each(['green-arena', 'non-arena', 'equipment'] as const)('rejects invalid other Cookie: %s', scenario => {
    const before = createBs12GlitterDemoState(scenario, number)
    const snapshot = structuredClone(before)
    expect(() => activate(before, [otherId])).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([[sourceId], ['bs12-018-payment-0'], ['bs12-018-opponent'], [otherId, otherId], [sourceId, otherId]].map(ids => ({ ids })))('rejects invalid free skill targets $ids', ({ ids }) => {
    const before = createBs12GlitterDemoState('positive', number)
    expect(() => activate(before, ids)).toThrow()
  })
  it('free skill stays legal with no hand after EXTRA entry', () => {
    const before = createBs12GlitterDemoState('positive', number)
    before.players[playerId].hand = []
    expect(canActivateCookieSkill(before, playerId, sourceId, 'activate')).toBe(true)
    expect(activate(before, [otherId]).players[playerId].hand).toEqual([])
  })
  it('cannot activate during opponent turn', () => {
    const before = createBs12GlitterDemoState('opponent-turn', number)
    expect(canActivateCookieSkill(before, playerId, sourceId, 'activate')).toBe(false)
    expect(() => activate(before, [])).toThrow()
  })
  it.each(['player-one', 'player-two'] as const)('second-player condition uses source identity for %s', sourcePlayerId => {
    const before = createBs12GlitterDemoState('positive', number)
    const effect = before.players[playerId].battleArea.find(cookie => cookie.card.instanceId === sourceId)!.card.attackEffects![0]
    for (const firstPlayerId of ['player-one', 'player-two'] as const) {
      for (const activePlayerId of ['player-one', 'player-two'] as const) {
        for (const turnNumber of [1, 2, 20]) {
          expect(isEffectConditionMet({ ...before, firstPlayerId, activePlayerId, turnNumber }, { sourcePlayerId, sourceInstanceId: sourceId }, effect)).toBe(firstPlayerId !== sourcePlayerId)
        }
      }
    }
  })
  it.each(['original', 'other', 'zero'] as const)('second player pays RRRR then can choose %s', choice => {
    const before = createBs12GlitterDemoState('positive', number)
    const begun = attack(before)
    expect(begun.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
    expect(begun.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(begun.players[playerId].battleArea.find(cookie => cookie.card.instanceId === sourceId)!.rested).toBe(true)
    const targets = choice === 'zero' ? [] : [choice === 'original' ? 'bs12-018-opponent' : 'bs12-018-opponent-other']
    const after = applyGameCommand(begun, { kind: 'resolve-attack-effect', playerId, targetIds: targets })
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([choice === 'original' ? 1 : 2, choice === 'other' ? 3 : 4])
    expect(after.players[playerId].battleArea.find(cookie => cookie.card.instanceId === sourceId)!.hpCards).toHaveLength(5)
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
  })
  it('first player gets normal four damage and a public condition no-op', () => {
    const begun = attack(createBs12GlitterDemoState('first-player', number))
    const command = { kind: 'resolve-attack-effect' as const, playerId, targetIds: [] }
    const after = applyGameCommand(begun, command)
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([2, 4])
    expect(describeCommandSteps(begun, after, command)?.some(step => step.text.includes('條件不成立'))).toBe(true)
  })
  it('after original target faints, second player may select the remaining opponent', () => {
    const begun = attack(createBs12GlitterDemoState('target-faints', number))
    expect(begun.players['player-two'].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-018-opponent-other'])
    const after = applyGameCommand(begun, { kind: 'resolve-attack-effect', playerId, targetIds: ['bs12-018-opponent-other'] })
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
  })
  it.each([[sourceId], [otherId], ['bs12-018-payment-0'], ['bs12-018-opponent', 'bs12-018-opponent-other'], ['bs12-018-opponent', 'bs12-018-opponent']].map(ids => ({ ids })))('rejects illegal Then targets $ids', ({ ids }) => {
    const begun = attack(createBs12GlitterDemoState('positive', number))
    const snapshot = structuredClone(begun)
    expect(() => applyGameCommand(begun, { kind: 'resolve-attack-effect', playerId, targetIds: ids })).toThrow()
    expect(begun).toEqual(snapshot)
  })
  it.each(['wrong-energy', 'few-energy', 'rested-energy'] as const)('rejects illegal RRRR payment: %s', scenario => {
    const before = createBs12GlitterDemoState(scenario, number)
    const snapshot = structuredClone(before)
    expect(() => attack(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('all scenarios obey both battle-area limits', () => {
    for (const scenario of ['positive', 'extra', 'break-low', 'no-hand', 'non-arena-hand', 'full-battle', 'green-hand', 'item-hand', 'first-player', 'target-faints', 'green-arena', 'non-arena', 'equipment', 'active-target', 'source-rested', 'solo', 'support-only', 'opponent-only', 'no-energy', 'opponent-turn', 'wrong-energy', 'few-energy', 'rested-energy'] as const) {
      const state = createBs12GlitterDemoState(scenario, number)
      for (const player of Object.values(state.players)) expect(player.battleArea.length).toBeLessThanOrEqual(2)
    }
  })
})
