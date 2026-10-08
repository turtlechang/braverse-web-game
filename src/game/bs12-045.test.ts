import { describe, expect, it } from 'vitest'
import { createBs12CloverDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { hasPendingCardResolution } from './pending'

const playerId = 'player-one' as const
const sourceId = 'bs12-045-source'
type State = ReturnType<typeof createBs12CloverDemoState>
const deploy = (state: State) => applyGameCommand(state, { kind: 'deploy-cookie', playerId, instanceId: sourceId })
const begin = (state: State) => applyGameCommand(state, { kind: 'begin-activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'on-play', paymentIds: [] })
const draw = (state: State, count: number) => applyGameCommand(applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds: [] }), { kind: 'resolve-draw-up-to', playerId, drawCount: count })

describe('BS12-045 current support threshold and ordinary GN2', () => {
  it('limits the route to localhost', () => {
    expect(parseTestStateConfig('?test-state=bs12-045:five', 'localhost')).toEqual({ kind: 'bs12-045', scenario: 'five' })
    expect(parseTestStateConfig('?test-state=bs12-045:five', 'example.com')).toBeNull()
  })
  it.each(['five', 'six', 'all-rested', 'non-arena'] as const)('draws an actual top card after hand deployment: %s', scenario => {
    const before = createBs12CloverDemoState(scenario)
    const snapshot = structuredClone(before)
    const entered = deploy(before)
    expect(entered.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([2, 2])
    expect(entered.players[playerId].deck).toEqual(before.players[playerId].deck.slice(2))
    const after = draw(begin(entered), 1)
    expect(after.players[playerId].hand).toEqual(before.players[playerId].deck.slice(2, 3))
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(3))
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(hasPendingCardResolution(after)).toBe(false)
    expect(canActivateCookieSkill(after, playerId, sourceId, 'on-play')).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it.each(['four', 'zero', 'opponent-only', 'battle-only'] as const)('cannot use non-own-support cards to reach five: %s', scenario => {
    const after = deploy(createBs12CloverDemoState(scenario))
    expect(canActivateCookieSkill(after, playerId, sourceId, 'on-play')).toBe(false)
    expect(() => begin(after)).toThrow()
    expect(after.players[playerId].deck).toHaveLength(10)
  })
  it('choosing zero keeps deck and consumes the On Play', () => {
    const entered = deploy(createBs12CloverDemoState())
    const after = draw(begin(entered), 0)
    expect(after.players[playerId].deck).toEqual(entered.players[playerId].deck)
    expect(after.players[playerId].hand).toEqual([])
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it.each(['support-five', 'support-four'] as const)('checks own support after real support entry: %s', scenario => {
    const before = createBs12CloverDemoState(scenario)
    const parent = applyGameCommand(before, { kind: 'begin-activate-skill', playerId, sourceInstanceId: 'bs12-045-deployer', trigger: 'activate', paymentIds: [] })
    const entered = applyGameCommand(parent, { kind: 'resolve-ability-effect', playerId, targetIds: [sourceId] })
    expect(entered.players[playerId].supportArea).toHaveLength(scenario === 'support-five' ? 5 : 4)
    expect(entered.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([5, 2])
    expect(canActivateCookieSkill(entered, playerId, sourceId, 'on-play')).toBe(scenario === 'support-five')
    if (scenario === 'support-five') expect(draw(begin(entered), 1).players[playerId].deck).toHaveLength(9)
    else expect(() => begin(entered)).toThrow()
  })
  it('does not add an unprinted Your Turn restriction to an isolated On Play', () => {
    const entered = createBs12CloverDemoState('opponent-turn')
    expect(draw(begin(entered), 1).players[playerId].hand).toHaveLength(1)
  })
  it.each(['short-deck', 'last-deck'] as const)('resumes after HP setup or last-card draw Refresh: %s', scenario => {
    let entered = deploy(createBs12CloverDemoState(scenario))
    if (scenario === 'short-deck') entered = applyGameCommand(entered, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-045-refresh', shuffleSeed: 45 })
    let after = draw(begin(entered), 1)
    if (scenario === 'last-deck') after = applyGameCommand(after, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-045-refresh', shuffleSeed: 45 })
    expect(after.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([2, 2])
    expect(after.players[playerId].hand).toHaveLength(1)
    expect(after.players[playerId].deck).toHaveLength(scenario === 'short-deck' ? 3 : 5)
    expect(after.players[playerId].breakArea.map(c => c.level)).toEqual([2])
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it('stops after last-card draw leads to LV10 Refresh defeat', () => {
    const waiting = draw(begin(deploy(createBs12CloverDemoState('refresh-lv10'))), 1)
    const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-045-refresh', shuffleSeed: 45 })
    expect(after.status).toBe('finished')
    expect(after.result?.winnerId).toBe('player-two')
    expect(after.players[playerId].breakArea.reduce((sum, c) => sum + (c.level ?? 0), 0)).toBe(11)
  })
  it.each(['attack', 'attack-blue'] as const)('pays one green and one real arbitrary support: %s', scenario => {
    const before = createBs12CloverDemoState(scenario)
    const after = applyGameCommand(before, { kind: 'attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-044-opponent', supportPaymentIds: ['bs12-045-support-0', 'bs12-045-support-1'] })
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([4, 3])
    expect(after.players['player-two'].discardPile).toHaveLength(2)
    expect(after.players[playerId].supportArea.map(s => s.rested)).toEqual([true, true, false, false, false])
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].battleArea[0].rested).toBe(true)
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it.each(['attack-wrong', 'attack-few', 'attack-rested', 'attack-rested-source'] as const)('rejects invalid payment or source: %s', scenario => {
    expect(() => applyGameCommand(createBs12CloverDemoState(scenario), { kind: 'attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-044-opponent', supportPaymentIds: ['bs12-045-support-0', 'bs12-045-support-1'] })).toThrow()
  })
})
