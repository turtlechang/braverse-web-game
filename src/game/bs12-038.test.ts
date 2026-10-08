import { describe, expect, it } from 'vitest'
import { createBs12GreenbellDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { executeCardEffect } from './effects'

const playerId = 'player-one' as const
const sourceId = 'bs12-038-source'
type State = ReturnType<typeof createBs12GreenbellDemoState>
const enter = (before: State) => applyGameCommand(before, { kind: 'activate-skill', playerId, sourceInstanceId: 'bs12-038-deployer', trigger: 'activate', paymentIds: [], effectTargets: [[sourceId]] })
const activate = (before: State) => applyGameCommand(before, { kind: 'activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'on-play', paymentIds: [], effectTargets: [[]] })

describe.each(['BS12-038', 'BS12-038@1'] as const)('%s printed support-origin On Play and GN attack', number => {
  it('uses the physical six-HP Sugar Swan as the ordinary attack target', () => {
    const defender = createBs12GreenbellDemoState('positive', number).players['player-two'].battleArea[0]
    expect(defender.card).toMatchObject({ id: 'BS6-008', name: 'Sugar Swan Cookie', hp: 6 })
    expect(defender.hpCards).toHaveLength(6)
  })
  it.each(['positive', 'equal-before', 'zero-after', 'source-rested', 'opponent-rested'] as const)('real BS7-055 entry removes support then places the exact top card rested: %s', scenario => {
    const before = createBs12GreenbellDemoState(scenario, number)
    const snapshot = structuredClone(before)
    const entered = enter(before)
    expect(entered.players[playerId].battleArea[1].card).toEqual(before.players[playerId].supportArea[0].card)
    expect(entered.players[playerId].battleArea[1].hpCards).toEqual(before.players[playerId].deck.slice(0, 2))
    expect(entered.players[playerId].battleArea[1].rested).toBe(false)
    expect(entered.players[playerId].supportArea.map(s => s.card.instanceId)).not.toContain(sourceId)
    expect(entered.pendingOnPlay).toMatchObject({ sourceInstanceId: sourceId, origin: 'support' })
    expect(canActivateCookieSkill(entered, playerId, sourceId, 'on-play')).toBe(true)
    const after = activate(entered)
    expect(after.players[playerId].supportArea).toEqual([...entered.players[playerId].supportArea, { card: entered.players[playerId].deck[0], rested: true }])
    expect(after.players[playerId].deck).toEqual(entered.players[playerId].deck.slice(1))
    expect(after.players[playerId].battleArea).toEqual(entered.players[playerId].battleArea)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(after.players[playerId].discardPile).toEqual(before.players[playerId].discardPile)
    expect(before).toEqual(snapshot)
  })
  it.each(['equal-after', 'more-after', 'foe-zero'] as const)('blocks condition %s with all other entry resources retained', scenario => {
    const entered = enter(createBs12GreenbellDemoState(scenario, number))
    expect(canActivateCookieSkill(entered, playerId, sourceId, 'on-play')).toBe(false)
    const snapshot = structuredClone(entered)
    expect(() => activate(entered)).toThrow()
    expect(entered).toEqual(snapshot)
    const skipped = applyGameCommand(entered, { kind: 'skip-on-play', playerId, sourceInstanceId: sourceId })
    expect(skipped.players).toEqual(entered.players)
  })
  it('hand deployment configures 2HP but cannot use support-origin effect despite fewer supports', () => {
    const before = createBs12GreenbellDemoState('hand', number)
    const entered = applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: sourceId })
    expect(entered.players[playerId].battleArea[1].hpCards).toHaveLength(2)
    expect(entered.players[playerId].supportArea.length).toBeLessThan(entered.players['player-two'].supportArea.length)
    expect(canActivateCookieSkill(entered, playerId, sourceId, 'on-play')).toBe(false)
    expect(() => activate(entered)).toThrow()
  })
  it('zero top-deck placement is available by skipping the entire free single On Play', () => {
    const entered = enter(createBs12GreenbellDemoState('positive', number))
    const skipped = applyGameCommand(entered, { kind: 'skip-on-play', playerId, sourceInstanceId: sourceId })
    expect(skipped.players).toEqual(entered.players)
    expect(skipped.pendingOnPlay).toBeNull()
    expect(canActivateCookieSkill(skipped, playerId, sourceId, 'on-play')).toBe(false)
  })
  it('origin support itself is required rather than arbitrary break or trash On Play', () => {
    const entered = enter(createBs12GreenbellDemoState('positive', number))
    for (const origin of ['hand', 'break', 'trash'] as const) {
      const wrong = { ...entered, pendingOnPlay: { playerId, sourceInstanceId: sourceId, origin } }
      expect(canActivateCookieSkill(wrong, playerId, sourceId, 'on-play')).toBe(false)
      expect(() => activate(wrong)).toThrow()
    }
  })
  it('checks support counts again at resolution instead of freezing the entry-time condition', () => {
    const entered = enter(createBs12GreenbellDemoState('positive', number))
    const changed = { ...entered, players: { ...entered.players, 'player-two': { ...entered.players['player-two'], supportArea: [] } } }
    expect(canActivateCookieSkill(changed, playerId, sourceId, 'on-play')).toBe(false)
    expect(() => activate(changed)).toThrow()
  })
  it('also works on the opponent turn after an isolated support-entry effect, with no Your Turn marker', () => {
    const entered = createBs12GreenbellDemoState('isolated-opponent-turn', number)
    expect(entered.activePlayerId).toBe('player-two')
    expect(entered.pendingOnPlay?.origin).toBe('support')
    expect(canActivateCookieSkill(entered, playerId, sourceId, 'on-play')).toBe(true)
    expect(activate(entered).players[playerId].supportArea).toHaveLength(3)
  })
  it.each(['short-deck', 'last-deck'] as const)('continues exact HP/setup and top-deck support after Refresh: %s', scenario => {
    const before = createBs12GreenbellDemoState(scenario, number)
    let entered = enter(before)
    if (scenario === 'short-deck') {
      expect(entered.pendingRefresh).toBeTruthy()
      entered = applyGameCommand(entered, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-038-refresh', shuffleSeed: 38 })
    }
    expect(entered.players[playerId].battleArea[1].hpCards).toHaveLength(2)
    const top = entered.players[playerId].deck[0]
    let after = activate(entered)
    expect(after.players[playerId].supportArea.at(-1)).toEqual({ card: top, rested: true })
    if (scenario === 'last-deck') {
      expect(after.pendingRefresh).toBeTruthy()
      after = applyGameCommand(after, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-038-refresh', shuffleSeed: 38 })
    }
    expect(after.pendingRefresh).toBeNull()
    expect(after.players[playerId].battleArea[1].hpCards).toHaveLength(2)
    expect(after.players[playerId].breakArea.map(c => c.instanceId)).toEqual(['bs12-038-refresh'])
    expect(after.players[playerId].deck).toHaveLength(scenario === 'short-deck' ? 4 : 5)
  })
  it('pays actual green and blue for GN2 without using the newly rested support', () => {
    const before = createBs12GreenbellDemoState('attack', number)
    const payments = ['bs12-038-payment-1', 'bs12-038-payment-2']
    let after = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-038-opponent', supportPaymentIds: payments })
    after = applyGameCommand(after, { kind: 'skip-trap', playerId: 'player-two' })
    for (let i = 0; i < 2; i++) after = applyGameCommand(after, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([4, 3])
    expect(after.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(after.pendingOptionalCostAttack).toBeUndefined()
  })
  it.each(['attack-wrong', 'attack-few', 'attack-rested-energy', 'attack-rested-source'] as const)('rejects illegal GN2 %s', scenario => {
    const before = createBs12GreenbellDemoState(scenario, number)
    const snapshot = structuredClone(before)
    expect(() => applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-038-opponent', supportPaymentIds: before.players[playerId].supportArea.filter(s => !s.rested).map(s => s.card.instanceId) })).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('cannot gain support by invoking this skill while its source is still in support', () => {
    const before = createBs12GreenbellDemoState('positive', number)
    expect(canActivateCookieSkill(before, playerId, sourceId, 'on-play')).toBe(false)
    expect(() => activate(before)).toThrow()
  })
  it('does not silently expand the one-card top-deck effect when support difference is larger', () => {
    const entered = enter(createBs12GreenbellDemoState('zero-after', number))
    const effect = entered.players[playerId].battleArea[1].card.skill!.effects[0]
    expect(executeCardEffect(entered, { sourcePlayerId: playerId, sourceInstanceId: sourceId }, effect, []).players[playerId].supportArea).toHaveLength(1)
  })
  it('keeps both candidate print routes local', () => {
    expect(parseTestStateConfig(`?test-state=${number.toLowerCase()}:positive`, 'localhost')).toMatchObject({ kind: 'bs12-038', cardNumber: number })
    expect(parseTestStateConfig(`?test-state=${number.toLowerCase()}:positive`, 'example.com')).toBeNull()
  })
})
