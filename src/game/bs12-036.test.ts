import { describe, expect, it } from 'vitest'
import { createBs12ClottedDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canPlayExtraDeckCookie } from './actions'
import { canActivateCookieSkill } from './skills'
const playerId = 'player-one' as const
const sourceId = 'bs12-036-source'
describe.each(['BS12-036', 'BS12-036@1'] as const)('%s EXTRA/On Play/ordinary before optional Then', number => {
  it.each(['positive', 'first-player'] as const)('enters without energy or hand cost and gets exactly printed 4HP: %s', scenario => {
    const before = createBs12ClottedDemoState(scenario, number)
    expect(canPlayExtraDeckCookie(before, playerId, sourceId)).toBe(true)
    const entered = applyGameCommand(before, { kind: 'play-extra-deck-cookie', playerId, instanceId: sourceId })
    expect(entered.players[playerId].extraDeck).toHaveLength(0)
    expect(entered.players[playerId].battleArea[1].hpCards).toEqual(before.players[playerId].deck.slice(0, 4))
    expect(entered.players[playerId].deck).toHaveLength(10)
    expect(entered.players[playerId].breakArea).toEqual(before.players[playerId].breakArea)
    expect(entered.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(entered.players[playerId].discardPile).toHaveLength(0)
    expect(entered.players[playerId].hand).toHaveLength(0)
    expect(entered.pendingOptionalCostAttack).toBeUndefined()
    expect(canActivateCookieSkill(entered, playerId, sourceId, 'on-play')).toBe(scenario === 'positive')
    if (scenario === 'positive') {
      const begun = applyGameCommand(entered, { kind: 'begin-activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'on-play', paymentIds: [] })
      const done = applyGameCommand(begun, { kind: 'resolve-ability-effect', playerId, targetIds: [sourceId] })
      expect(done.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([2, 6])
      expect(done.players[playerId].deck).toHaveLength(8)
      expect(done.players['player-two']).toEqual(before.players['player-two'])
    } else {
      expect(() => applyGameCommand(entered, { kind: 'begin-activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'on-play', paymentIds: [] })).toThrow()
    }
  })
  it.each(['three-arena', 'wrong-color', 'non-arena', 'high-level', 'opponent-break', 'full-battle', 'opponent-turn', 'outside-main'] as const)('rejects illegal EXTRA %s immutably', scenario => {
    const before = createBs12ClottedDemoState(scenario, number)
    const snapshot = structuredClone(before)
    expect(canPlayExtraDeckCookie(before, playerId, sourceId)).toBe(false)
    expect(() => applyGameCommand(before, { kind: 'play-extra-deck-cookie', playerId, instanceId: sourceId })).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('permits skipping the entire optional On Play without changing printed HP', () => {
    const entered = applyGameCommand(createBs12ClottedDemoState('positive', number), { kind: 'play-extra-deck-cookie', playerId, instanceId: sourceId })
    const skipped = applyGameCommand(entered, { kind: 'skip-on-play', playerId, sourceInstanceId: sourceId })
    expect(skipped.players).toEqual(entered.players)
    expect(skipped.pendingOnPlay).toBeNull()
  })
  it('never redirects source-only On Play HP to a supplied ally ID', () => {
    const entered = applyGameCommand(createBs12ClottedDemoState('positive', number), { kind: 'play-extra-deck-cookie', playerId, instanceId: sourceId })
    const begun = applyGameCommand(entered, { kind: 'begin-activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'on-play', paymentIds: [] })
    const done = applyGameCommand(begun, { kind: 'resolve-ability-effect', playerId, targetIds: ['bs12-036-ally'] })
    expect(done.players[playerId].battleArea.map(cookie => cookie.hpCards.length)).toEqual([2, 6])
    expect(done.players[playerId].deck).toHaveLength(8)
  })
  it('pays three actual yellow supports and deals ordinary three', () => {
    const before = createBs12ClottedDemoState('attack', number)
    let next = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-036-opponent', supportPaymentIds: before.players[playerId].supportArea.map(s => s.card.instanceId) })
    next = applyGameCommand(next, { kind: 'skip-trap', playerId: 'player-two' })
    for (let i = 0; i < 3; i++) next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(next.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3, 3])
    expect(next.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(next.players[playerId].breakArea).toEqual(before.players[playerId].breakArea)
    expect(next.pendingOptionalCostAttack).toBeUndefined()
    expect(next.pendingBattle?.stage).toBe('attack-effect')
    next = applyGameCommand(next, { kind: 'resolve-attack-effect', playerId, targetIds: [] })
    expect(next.pendingOptionalCostAttack?.cost.cookieToBreakArea?.excludeSource).toBe(true)
    const skipped = applyGameCommand(next, { kind: 'resolve-optional-cost-attack', playerId, action: 'skip' })
    expect(skipped.players).toEqual(next.players)
    expect(skipped.pendingBattle).toBeFalsy()
  })
  it.each(['wrong-energy', 'few-energy', 'rested-energy', 'rested-source'] as const)('rejects illegal ordinary %s', scenario => {
    const before = createBs12ClottedDemoState(scenario, number)
    expect(() => applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-036-opponent', supportPaymentIds: before.players[playerId].supportArea.map(s => s.card.instanceId) })).toThrow()
  })
  it('keeps the candidate route local', () => {
    expect(parseTestStateConfig(`?test-state=${number.toLowerCase()}:positive`, 'localhost')).toMatchObject({ kind: 'bs12-036', cardNumber: number })
    expect(parseTestStateConfig(`?test-state=${number.toLowerCase()}:positive`, 'example.com')).toBeNull()
  })
})
