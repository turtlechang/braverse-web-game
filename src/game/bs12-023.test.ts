import { describe, expect, it } from 'vitest'
import { createBs12BonbonDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { executeCardEffect } from './effects'
import { canActivateCookieSkill } from './skills'
import { describeCommandSteps } from './command-log'

const playerId = 'player-one' as const
const sourceId = 'bs12-023-source'
const deploy = (before: ReturnType<typeof createBs12BonbonDemoState>) => applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: sourceId })
const activate = { kind: 'activate-skill' as const, playerId, sourceInstanceId: sourceId, trigger: 'on-play' as const, paymentIds: [], effectTargets: [[sourceId]] }
const hp = (state: ReturnType<typeof deploy>) => state.players[playerId].battleArea.find(c => c.card.instanceId === sourceId)!.hpCards

describe('BS12-023 printed four HP then source gain per complete three Arena break Cookies', () => {
  it('keeps its isolated route local', () => {
    expect(parseTestStateConfig('?test-state=bs12-023:nine', 'localhost')).toEqual({ kind: 'bs12-023', scenario: 'nine' })
    expect(parseTestStateConfig('?test-state=bs12-023:nine', 'example.com')).toBeNull()
  })
  it.each([{ scenario: 'zero', gain: 0 }, { scenario: 'two', gain: 0 }, { scenario: 'three', gain: 1 }, { scenario: 'five', gain: 1 },
    { scenario: 'six', gain: 2 }, { scenario: 'eight', gain: 2 }, { scenario: 'nine', gain: 3 }, { scenario: 'non-arena', gain: 0 },
    { scenario: 'high-level', gain: 0 }, { scenario: 'green-arena', gain: 1 }, { scenario: 'opponent-break', gain: 0 },
    { scenario: 'trash-arena', gain: 0 }, { scenario: 'history-only', gain: 0 }, { scenario: 'no-energy', gain: 1 }, { scenario: 'rested-support', gain: 1 }] as const)('settles $scenario as normal four plus $gain HP', ({ scenario, gain }) => {
    const before = createBs12BonbonDemoState(scenario)
    const snapshot = structuredClone(before)
    const entered = deploy(before)
    expect(hp(entered)).toEqual(before.players[playerId].deck.slice(0, 4))
    expect(entered.players[playerId].deck).toHaveLength(16)
    expect(canActivateCookieSkill(entered, playerId, sourceId, 'on-play')).toBe(true)
    const after = applyGameCommand(entered, activate)
    expect(hp(after)).toEqual(before.players[playerId].deck.slice(0, 4 + gain))
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(4 + gain))
    expect(after.players[playerId].battleArea[0]).toEqual(entered.players[playerId].battleArea[0])
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.players[playerId].breakArea).toEqual(before.players[playerId].breakArea)
    expect(after.players[playerId].discardPile).toEqual(before.players[playerId].discardPile)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(before).toEqual(snapshot)
  })
  it.each(['zero', 'three', 'nine'] as const)('may skip On Play without removing normal four HP: %s', scenario => {
    const entered = deploy(createBs12BonbonDemoState(scenario))
    const after = applyGameCommand(entered, { kind: 'skip-on-play', playerId, sourceInstanceId: sourceId })
    expect(after.players).toEqual(entered.players)
    expect(hp(after)).toHaveLength(4)
  })
  it('On Play remains legal on the opponent turn after real effect deployment', () => {
    const entered = createBs12BonbonDemoState('opponent-turn')
    expect(entered.activePlayerId).toBe('player-two')
    expect(hp(entered)).toHaveLength(4)
    expect(canActivateCookieSkill(entered, playerId, sourceId, 'on-play')).toBe(true)
    const after = applyGameCommand(entered, activate)
    expect(hp(after)).toHaveLength(5)
    expect(after.players[playerId].deck).toHaveLength(15)
    expect(after.activePlayerId).toBe('player-two')
  })
  it.each(['zero', 'six', 'nine'] as const)('actual UI begin/resolve path records the real result %s', scenario => {
    const entered = deploy(createBs12BonbonDemoState(scenario))
    const begun = applyGameCommand(entered, { kind: 'begin-activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'on-play', paymentIds: [] })
    const command = { kind: 'resolve-ability-effect' as const, playerId, targetIds: [] }
    const after = applyGameCommand(begun, command)
    const text = describeCommandSteps(begun, after, command)!.map(s => s.text).join(' ')
    expect(text).toContain(scenario === 'zero' ? '未增加 HP' : `「Chocolate Bonbon Cookie」增加 ${scenario === 'six' ? 2 : 3} 點 HP`)
    expect(text).not.toContain('bs12-023-deck-')
  })
  it('does not offer repeat On Play or Activate after resolution', () => {
    const after = applyGameCommand(deploy(createBs12BonbonDemoState()), activate)
    expect(canActivateCookieSkill(after, playerId, sourceId, 'on-play')).toBe(false)
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
  })
  it('Refresh continues the frozen missing HP amount after break count changes', () => {
    const entered = deploy(createBs12BonbonDemoState('refresh'))
    expect(hp(entered)).toHaveLength(4)
    const partial = applyGameCommand(entered, activate)
    expect(hp(partial)).toHaveLength(5)
    expect(partial.pendingRefresh?.remainingHpGain).toEqual({ targetInstanceId: sourceId, amount: 1 })
    const after = applyGameCommand(partial, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-023-refresh-cookie', shuffleSeed: 3 })
    expect(hp(after)).toHaveLength(6)
    expect(after.players[playerId].breakArea).toHaveLength(7)
    expect(after.players[playerId].deck).toHaveLength(11)
    expect(after.pendingRefresh).toBeNull()
  })
  it('keeps default per-break grouping for legacy exact-level HP effects', () => {
    const entered = deploy(createBs12BonbonDemoState('high-level'))
    const after = executeCardEffect(entered, { sourcePlayerId: playerId, sourceInstanceId: sourceId },
      { kind: 'gain-hp', amount: 1, perBreakCard: { exactLevel: 3 }, target: { side: 'self', min: 1, max: 1, sourceOnly: true } }, [])
    expect(hp(after)).toHaveLength(6)
  })
  it.each([0, -1, 1.5])('rejects invalid grouping divisor %s immutably', divisor => {
    const entered = deploy(createBs12BonbonDemoState())
    const snapshot = structuredClone(entered)
    expect(() => executeCardEffect(entered, { sourcePlayerId: playerId, sourceInstanceId: sourceId },
      { kind: 'gain-hp', amount: 1, perBreakCard: { keyword: 'arena', divisor }, target: { side: 'self', min: 1, max: 1, sourceOnly: true } }, [])).toThrow('正整數')
    expect(entered).toEqual(snapshot)
  })
  it('normal YYN attack pays two yellow plus blue for ordinary three damage', () => {
    const before = createBs12BonbonDemoState('attack')
    const after = applyGameCommand(before, { kind: 'attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-023-opponent', supportPaymentIds: before.players[playerId].supportArea.map(s => s.card.instanceId) })
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3, 4])
    expect(after.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(hp(after)).toEqual(hp(before))
    expect(after.pendingBattle).toBeNull()
  })
  it.each(['wrong-energy', 'few-yellow', 'few-energy', 'rested-energy'] as const)('blocks bad YYN payment %s', scenario => {
    const before = createBs12BonbonDemoState(scenario)
    expect(() => applyGameCommand(before, { kind: 'attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-023-opponent', supportPaymentIds: before.players[playerId].supportArea.map(s => s.card.instanceId) })).toThrow()
  })
  it.each(['zero', 'two', 'three', 'five', 'six', 'eight', 'nine', 'non-arena', 'high-level', 'green-arena', 'opponent-break', 'trash-arena', 'history-only', 'opponent-turn', 'no-energy', 'rested-support', 'attack', 'wrong-energy', 'few-yellow', 'few-energy', 'rested-energy', 'refresh'] as const)('uses legal field/break/copy capacity %s', scenario => {
    for (const player of Object.values(createBs12BonbonDemoState(scenario).players)) {
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      expect(player.breakArea.reduce((sum, c) => sum + c.level, 0)).toBeLessThan(10)
      const cards = [...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile,
        ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
      const counts = cards.reduce<Record<string, number>>((result, card) => ({ ...result, [card.id]: (result[card.id] ?? 0) + 1 }), {})
      expect(Math.max(0, ...Object.values(counts))).toBeLessThanOrEqual(4)
    }
  })
})
