import { describe, expect, it } from 'vitest'
import { createBs12FerretDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { getSupportToBattleCandidates } from './effects'
import { hasPendingCardResolution } from './pending'
import { describeCommandSteps } from './command-log'

const playerId = 'player-one' as const
type State = ReturnType<typeof createBs12FerretDemoState>
const open = (before: State) => {
  let after = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: 'bs12-051-source', targetInstanceId: before.players['player-two'].battleArea[0].card.instanceId, supportPaymentIds: ['bs12-051-support-0'] })
  after = applyGameCommand(after, { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; after.pendingBattle?.stage === 'damage' && i < 10; i++) after = applyGameCommand(after, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return after
}
const play = (state: State, targets: string[] = []) => applyGameCommand(state, { kind: 'resolve-attack-effect', playerId, targetIds: targets })

describe.each(['BS12-051', 'BS12-051@1'] as const)('%s actual attack then optional Arena support entry', number => {
  it('keeps fixtures local and prints independently routed', () => {
    expect(parseTestStateConfig(`?test-state=bs12-051:${number}:positive`, 'localhost')).toEqual({ kind: 'bs12-051', cardNumber: number, scenario: 'positive' })
    expect(parseTestStateConfig(`?test-state=bs12-051:${number}:positive`, 'example.com')).toBeNull()
  })
  it.each([0, 1])('deals ordinary one before playing active or original payment support %s', index => {
    const before = createBs12FerretDemoState('positive', number)
    const snapshot = structuredClone(before)
    const waiting = open(before)
    expect(waiting.players['player-two'].battleArea[0].hpCards).toHaveLength(5)
    expect(waiting.players[playerId].battleArea[0].rested).toBe(true)
    expect(waiting.players[playerId].supportArea[0].rested).toBe(true)
    const target = before.players[playerId].supportArea[index].card
    const after = play(waiting, [target.instanceId])
    expect(after.players[playerId].battleArea.at(-1)?.card).toEqual(target)
    expect(after.players[playerId].battleArea.at(-1)?.hpCards).toHaveLength(2)
    expect(after.players[playerId].deck).toHaveLength(10)
    expect(after.players[playerId].supportArea).toHaveLength(4)
    expect(after.cookiesPlayedFromSupportThisTurn?.[playerId]).toBe(true)
    expect(hasPendingCardResolution(after)).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it.each(['rested-entry', 'high-level'] as const)('plays support regardless of REST or level: %s', scenario => {
    const before = createBs12FerretDemoState(scenario, number)
    const target = before.players[playerId].supportArea[1].card
    if (target.type !== 'cookie') throw new Error('Missing support Cookie')
    const after = play(open(before), [target.instanceId])
    expect(after.players[playerId].battleArea.at(-1)?.hpCards).toHaveLength(target.hp)
    expect(after.players[playerId].battleArea.at(-1)?.rested).toBe(false)
  })
  it.each(['positive', 'no-arena', 'item-only', 'full-battle'] as const)('chooses zero after actual G attack: %s', scenario => {
    const waiting = open(createBs12FerretDemoState(scenario, number))
    const after = play(waiting)
    expect(after.players[playerId].supportArea).toEqual(waiting.players[playerId].supportArea)
    expect(after.players[playerId].battleArea).toEqual(waiting.players[playerId].battleArea)
    expect(after.players[playerId].deck).toEqual(waiting.players[playerId].deck)
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it('uses Arena Cookie intersection and excludes other zones', () => {
    const waiting = open(createBs12FerretDemoState('positive', number))
    const effect = waiting.pendingBattle!.attackEffects[0]
    if (effect.kind !== 'support-to-battle') throw new Error('Missing support entry')
    expect(getSupportToBattleCandidates(waiting, { sourcePlayerId: playerId, sourceInstanceId: 'bs12-051-source' }, effect).map(c => c.instanceId)).toEqual(['bs12-051-support-0', 'bs12-051-support-1'])
    for (const ids of [['bs12-051-support-2'], ['bs12-051-support-3'], ['bs12-051-support-4'], ['bs12-051-source'], ['unknown'], ['bs12-051-support-0', 'bs12-051-support-1']]) expect(() => play(waiting, ids)).toThrow()
  })
  it.each(['no-energy', 'wrong-energy', 'rested-energy', 'source-rested', 'source-support', 'opponent-turn', 'outside-main'] as const)('blocks invalid attack payment/source/timing %s', scenario => {
    expect(() => open(createBs12FerretDemoState(scenario, number))).toThrow()
  })
  it('preserves entry and HP configuration across short-deck Refresh', () => {
    const waiting = play(open(createBs12FerretDemoState('short-deck', number)), ['bs12-051-support-1'])
    expect(waiting.pendingRefresh).toBeTruthy()
    const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-051-refresh', shuffleSeed: 3 })
    expect(after.players[playerId].battleArea.at(-1)?.hpCards).toHaveLength(2)
    expect(after.players[playerId].breakArea.map(c => c.instanceId)).toContain('bs12-051-refresh')
  })
  it('still plays a support Cookie after the original defender faints', () => {
    const waiting = open(createBs12FerretDemoState('target-last-hp', number))
    expect(waiting.players['player-two'].breakArea).toHaveLength(1)
    const after = play(waiting, ['bs12-051-support-0'])
    expect(after.players[playerId].battleArea).toHaveLength(2)
    expect(after.players[playerId].battleArea.at(-1)?.hpCards).toHaveLength(2)
  })
  it('configures the last two HP cards before Refresh', () => {
    const waiting = play(open(createBs12FerretDemoState('last-deck', number)), ['bs12-051-support-1'])
    expect(waiting.players[playerId].battleArea.at(-1)?.hpCards).toHaveLength(2)
    expect(waiting.pendingRefresh).toBeTruthy()
    const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-051-refresh', shuffleSeed: 3 })
    expect(after.players[playerId].battleArea.at(-1)?.hpCards).toHaveLength(2)
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it('stops the unfinished HP configuration when Refresh causes LV10 defeat', () => {
    const waiting = play(open(createBs12FerretDemoState('refresh-lv10', number)), ['bs12-051-support-1'])
    expect(waiting.pendingRefresh).toBeTruthy()
    expect(waiting.players[playerId].battleArea.at(-1)?.hpCards).toHaveLength(1)
    const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-051-refresh', shuffleSeed: 3 })
    expect(after.result?.winnerId).toBe('player-two')
    expect(after.players[playerId].battleArea.at(-1)?.hpCards).toHaveLength(1)
  })
  it('records actual public entry and HP without reporting a zero choice as entry', () => {
    const before = open(createBs12FerretDemoState('positive', number))
    const command = { kind: 'resolve-attack-effect' as const, playerId, targetIds: ['bs12-051-support-0'] }
    expect(describeCommandSteps(before, applyGameCommand(before, command), command)!.some(step => /Basil Pesto Cookie 配置 2 HP/.test(step.text))).toBe(true)
    const zero = { ...command, targetIds: [] }
    const steps = describeCommandSteps(before, applyGameCommand(before, zero), zero)!
    expect(steps.some(step => /沒有支援區餅乾登場/.test(step.text))).toBe(true)
    expect(steps.some(step => /配置 2 HP/.test(step.text))).toBe(false)
  })
})
