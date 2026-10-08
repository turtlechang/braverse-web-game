import { describe, expect, it } from 'vitest'
import { createBs12GingerBraveDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { hasBlockingPending } from './pending'

const playerId = 'player-one' as const
const sourceId = 'bs12-024-source'
type State = ReturnType<typeof createBs12GingerBraveDemoState>
const declare = (state: State, ids = state.players[playerId].supportArea.map(s => s.card.instanceId), target = 'bs12-024-opponent') =>
  applyGameCommand(state, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: target, supportPaymentIds: ids })
const finish = (state: State, target?: string) => {
  let next = applyGameCommand(declare(state, undefined, target), { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; next.pendingBattle?.stage === 'damage' && i < 4; i++) next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return next
}
describe('BS12-024 printed HP, neutral payment and ordinary damage', () => {
  it('uses real printed defenders at their printed HP', () => {
    const normal = createBs12GingerBraveDemoState()
    expect(normal.players['player-two'].battleArea.map(entry => [entry.card.id, entry.hpCards.length])).toEqual([
      ['BS6-008', 6],
      ['BS12-001', 4],
    ])
    const faint = createBs12GingerBraveDemoState('target-faints')
    expect(faint.players['player-two'].battleArea.map(entry => [entry.card.id, entry.hpCards.length])).toEqual([
      ['BS6-017', 1],
      ['BS12-001', 4],
    ])
  })
  it('keeps the preview local and configures exactly two printed HP through normal deployment', () => {
    expect(parseTestStateConfig('?test-state=bs12-024:deploy', 'localhost')).toEqual({ kind: 'bs12-024', scenario: 'deploy' })
    expect(parseTestStateConfig('?test-state=bs12-024:deploy', 'example.com')).toBeNull()
    const before = createBs12GingerBraveDemoState('deploy')
    const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: sourceId })
    expect(after.players[playerId].battleArea[0].hpCards).toEqual(before.players[playerId].deck.slice(0, 2))
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(2))
    expect(after.players[playerId].hand).toEqual([])
    expect(after.pendingOnPlay).toBeNull()
    expect(hasBlockingPending(after)).toBe(false)
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
  })
  it.each([{ scenario: 'positive', color: 'red' }, { scenario: 'blue-energy', color: 'blue' }, { scenario: 'green-energy', color: 'green' }, { scenario: 'yellow-energy', color: 'yellow' }] as const)('accepts real $color support for neutral one', ({ scenario, color }) => {
    const before = createBs12GingerBraveDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(before.players[playerId].supportArea[0].card.energyColor).toBe(color)
    const after = finish(before)
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([5, 4])
    expect(after.players['player-two'].discardPile).toEqual(before.players['player-two'].battleArea[0].hpCards.slice(-1))
    expect(after.players[playerId].battleArea[0]).toMatchObject({ rested: true, hpCards: before.players[playerId].battleArea[0].hpCards })
    expect(after.players[playerId].supportArea[0].rested).toBe(true)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].discardPile).toEqual([])
    expect(after.pendingBattle).toBeNull()
    expect(hasBlockingPending(after)).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it.each(['few-energy', 'rested-energy', 'source-rested', 'opponent-turn'] as const)('rejects %s without modifying input', scenario => {
    const before = createBs12GingerBraveDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(() => declare(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([{ ids: [] }, { ids: ['unknown'] }, { ids: ['bs12-024-payment-0', 'bs12-024-payment-0'] }])('rejects invalid support IDs $ids', ({ ids }) => {
    expect(() => declare(createBs12GingerBraveDemoState(), ids)).toThrow()
  })
  it('may attack another opponent while leaving the first unchanged', () => {
    const before = createBs12GingerBraveDemoState()
    const after = finish(before, 'bs12-024-opponent-other')
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([6, 3])
  })
  it('faints exactly the original one-HP target without Then', () => {
    const before = createBs12GingerBraveDemoState('target-faints')
    const after = finish(before)
    expect(after.players['player-two'].battleArea).toEqual([before.players['player-two'].battleArea[1]])
    expect(after.players['player-two'].breakArea.map(c => c.instanceId)).toEqual(['bs12-024-opponent'])
    expect(after.players['player-two'].discardPile).toEqual(before.players['player-two'].battleArea[0].hpCards)
    expect(after.pendingBattle).toBeNull()
    expect(after.pendingReplacement).toBeTruthy()
  })
  it.each(['positive', 'blue-energy', 'green-energy', 'yellow-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'target-faints', 'deploy'] as const)('uses legal field/break/copy capacity %s', scenario => {
    for (const player of Object.values(createBs12GingerBraveDemoState(scenario).players)) {
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      expect(player.breakArea.reduce((sum, c) => sum + c.level, 0)).toBeLessThan(10)
      const cards = [...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile, ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
      const counts = cards.reduce<Record<string, number>>((result, card) => ({ ...result, [card.id]: (result[card.id] ?? 0) + 1 }), {})
      expect(Math.max(0, ...Object.values(counts))).toBeLessThanOrEqual(4)
    }
  })
})
