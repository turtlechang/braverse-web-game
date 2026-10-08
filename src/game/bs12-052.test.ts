import { describe, expect, it } from 'vitest'
import { createBs12CocoaDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { hasPendingCardResolution } from './pending'

const playerId = 'player-one' as const
const sourceId = 'bs12-052-source'
type State = ReturnType<typeof createBs12CocoaDemoState>
const settleDamage = (state: State) => {
  let after = state
  for (let i = 0; after.pendingBattle?.stage === 'damage' && i < 10; i++) after = applyGameCommand(after, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return after
}
const enter = (before: State) => {
  if (before.players[playerId].stage) {
    return applyGameCommand(before, { kind: 'activate-stage', playerId, paymentIds: [], effectTargets: [[sourceId]] })
  }
  const attacking = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: 'bs12-051-source', targetInstanceId: 'bs12-044-opponent', supportPaymentIds: ['bs12-051-support-0'] })
  const damaged = settleDamage(applyGameCommand(attacking, { kind: 'skip-trap', playerId: 'player-two' }))
  return applyGameCommand(damaged, { kind: 'resolve-attack-effect', playerId, targetIds: [sourceId] })
}
const activate = (before: State, targets: string[] = ['bs12-044-opponent-other'], discards = ['bs12-052-hand-0']) => settleDamage(applyGameCommand(before, {
  kind: 'activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'on-play', paymentIds: [], discardHandIds: discards, effectTargets: [targets],
}))

describe.each(['BS12-052', 'BS12-052@1'] as const)('%s actual support-origin Cocoa On Play', number => {
  it('keeps candidate routes local and print-specific', () => {
    expect(parseTestStateConfig(`?test-state=bs12-052:${number}:positive`, 'localhost')).toEqual({ kind: 'bs12-052', cardNumber: number, scenario: 'positive' })
    expect(parseTestStateConfig(`?test-state=bs12-052:${number}:positive`, 'example.com')).toBeNull()
  })
  it.each(['positive', 'rested-entry', 'item-hand', 'stage-hand', 'non-arena-hand', 'stage-entry'] as const)('real support entry configures HP before one any-hand discard and damage: %s', scenario => {
    const before = createBs12CocoaDemoState(scenario, number)
    const snapshot = structuredClone(before)
    const entered = enter(before)
    expect(entered.players[playerId].battleArea.at(-1)?.hpCards).toHaveLength(2)
    expect(entered.players[playerId].battleArea.at(-1)?.rested).toBe(false)
    expect(entered.pendingOnPlay).toMatchObject({ sourceInstanceId: sourceId, origin: 'support' })
    expect(canActivateCookieSkill(entered, playerId, sourceId, 'on-play')).toBe(true)
    const after = activate(entered)
    expect(after.players[playerId].hand).toHaveLength(1)
    expect(after.players[playerId].discardPile.at(-1)).toEqual(before.players[playerId].hand[0])
    expect(after.players['player-two'].battleArea[1].hpCards).toHaveLength(2)
    expect(after.players[playerId].battleArea.at(-1)?.hpCards).toHaveLength(2)
    expect(after.players[playerId].deck).toHaveLength(10)
    expect(before).toEqual(snapshot)
  })
  it('zero target still discards exactly one hand card without damage', () => {
    const entered = enter(createBs12CocoaDemoState('positive', number))
    const after = activate(entered, [])
    expect(after.players[playerId].hand).toHaveLength(1)
    expect(after.players['player-two']).toEqual(entered.players['player-two'])
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it.each(['activate', 'zero', 'skip'] as const)('preserves the parent Stage Then across nested On Play %s', action => {
    const entered = enter(createBs12CocoaDemoState('stage-entry', number))
    const parent = structuredClone(entered.pendingAbilityEffect)
    const after = action === 'skip'
      ? applyGameCommand(entered, { kind: 'skip-on-play', playerId, sourceInstanceId: sourceId })
      : activate(entered, action === 'zero' ? [] : ['bs12-044-opponent-other'])
    expect(after.pendingAbilityEffect).toEqual(parent)
    expect(after.suspendedAbilityEffects).toBeUndefined()
    const opened = applyGameCommand(after, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
    expect(opened.pendingOptionalCostAttack?.sourceInstanceId).toBe('bs12-052-stage')
    const completed = applyGameCommand(opened, { kind: 'resolve-optional-cost-attack', playerId, action: 'skip' })
    expect(hasPendingCardResolution(completed)).toBe(false)
  })
  it('interactive On Play pays before selecting damage and restores the parent queue', () => {
    const entered = enter(createBs12CocoaDemoState('stage-entry', number))
    const parent = structuredClone(entered.pendingAbilityEffect)
    const paid = applyGameCommand(entered, { kind: 'begin-activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'on-play', paymentIds: [], discardHandIds: ['bs12-052-hand-0'] })
    expect(paid.players[playerId].hand).toHaveLength(1)
    expect(paid.suspendedAbilityEffects).toEqual([parent])
    expect(paid.pendingAbilityEffect?.sourceInstanceId).toBe(sourceId)
    expect(paid.players['player-two'].battleArea[1].hpCards).toHaveLength(3)
    const after = settleDamage(applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: ['bs12-044-opponent-other'] }))
    expect(after.players['player-two'].battleArea[1].hpCards).toHaveLength(2)
    expect(after.pendingAbilityEffect).toEqual(parent)
    expect(after.suspendedAbilityEffects).toBeUndefined()
  })
  it('skipping On Play leaves the successfully entered Cookie and hand untouched', () => {
    const entered = enter(createBs12CocoaDemoState('positive', number))
    const after = applyGameCommand(entered, { kind: 'skip-on-play', playerId, sourceInstanceId: sourceId })
    expect(after.players).toEqual(entered.players)
    expect(hasPendingCardResolution(after)).toBe(false)
    expect(canActivateCookieSkill(after, playerId, sourceId, 'on-play')).toBe(false)
  })
  it('hand deployment configures normal HP but cannot trigger this skill', () => {
    const before = createBs12CocoaDemoState('hand', number)
    const entered = applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: sourceId })
    expect(entered.players[playerId].battleArea.at(-1)?.hpCards).toHaveLength(2)
    expect(canActivateCookieSkill(entered, playerId, sourceId, 'on-play')).toBe(false)
    expect(() => activate(entered)).toThrow()
  })
  it('no hand blocks only On Play, not successful support entry', () => {
    const entered = enter(createBs12CocoaDemoState('no-hand', number))
    expect(entered.players[playerId].battleArea.at(-1)?.hpCards).toHaveLength(2)
    expect(canActivateCookieSkill(entered, playerId, sourceId, 'on-play')).toBe(false)
    expect(() => activate(entered)).toThrow()
  })
  it('rejects omitted, duplicate, excessive or wrong-zone discard costs without mutation', () => {
    const entered = enter(createBs12CocoaDemoState('positive', number))
    const snapshot = structuredClone(entered)
    for (const discards of [[], ['bs12-052-hand-0', 'bs12-052-hand-0'], ['bs12-052-hand-0', 'bs12-052-hand-1'], [sourceId], ['bs12-051-support-0'], ['unknown']]) expect(() => activate(entered, [], discards)).toThrow()
    expect(entered).toEqual(snapshot)
  })
  it('rejects self, support, missing and multiple damage targets', () => {
    const entered = enter(createBs12CocoaDemoState('positive', number))
    for (const targets of [[sourceId], ['bs12-051-support-0'], ['unknown'], ['bs12-044-opponent', 'bs12-044-opponent-other']]) expect(() => activate(entered, targets)).toThrow()
  })
  it('support-origin skill can run during the opponent turn without a Your Turn marker', () => {
    const entered = createBs12CocoaDemoState('isolated-opponent-turn', number)
    expect(entered.activePlayerId).toBe('player-two')
    expect(canActivateCookieSkill(entered, playerId, sourceId, 'on-play')).toBe(true)
    expect(activate(entered).players['player-two'].battleArea[1].hpCards).toHaveLength(2)
  })
  it.each(['short-deck', 'last-deck'] as const)('finishes HP and Refresh before exposing On Play: %s', scenario => {
    const waiting = enter(createBs12CocoaDemoState(scenario, number))
    expect(waiting.pendingRefresh).toBeTruthy()
    expect(canActivateCookieSkill(waiting, playerId, sourceId, 'on-play')).toBe(false)
    const refreshed = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-051-refresh', shuffleSeed: 52 })
    expect(refreshed.players[playerId].battleArea.at(-1)?.hpCards).toHaveLength(2)
    expect(canActivateCookieSkill(refreshed, playerId, sourceId, 'on-play')).toBe(true)
    expect(activate(refreshed).players[playerId].hand).toHaveLength(1)
  })
  it('Refresh LV10 defeat stops On Play and preserves its unpaid hand cost', () => {
    const waiting = enter(createBs12CocoaDemoState('refresh-lv10', number))
    const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-051-refresh', shuffleSeed: 52 })
    expect(after.status).toBe('finished')
    expect(after.players[playerId].hand).toHaveLength(2)
    expect(() => activate(after)).toThrow()
  })
  it('effect damage can faint the selected other opponent without another ordinary attack', () => {
    const entered = enter(createBs12CocoaDemoState('last-hp', number))
    const after = activate(entered)
    expect(after.players['player-two'].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-044-opponent'])
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(5)
    expect(after.players['player-two'].breakArea.at(-1)?.instanceId).toBe('bs12-044-opponent-other')
  })
  it.each(['attack', 'attack-blue'] as const)('pays actual green plus blue for GN ordinary two: %s', scenario => {
    const before = createBs12CocoaDemoState(scenario, number)
    let after = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-044-opponent', supportPaymentIds: ['bs12-052-payment-0', 'bs12-052-payment-1'] })
    after = applyGameCommand(after, { kind: 'skip-trap', playerId: 'player-two' })
    after = settleDamage(after)
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
    expect(after.players[playerId].supportArea.slice(0, 2).every(entry => entry.rested)).toBe(true)
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it.each(['attack-wrong', 'attack-few', 'attack-rested-energy', 'attack-rested-source'] as const)('blocks illegal GN attack: %s', scenario => {
    expect(() => applyGameCommand(createBs12CocoaDemoState(scenario, number), { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-044-opponent', supportPaymentIds: ['bs12-052-payment-0', 'bs12-052-payment-1'] })).toThrow()
  })
})
