import { describe, expect, it } from 'vitest'
import { createBs12AudienceDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { getAttackDamageAgainst } from './effects'
import { getTrapCandidates } from './battle'
import { getOptionalCostAttackPrompt } from '../components/modals/optionalCostAttackPrompt'
import { canPlayItem, playItem } from './card-abilities'
import { isSupportToHandCostCandidate } from './skills'
import { hasPendingCardResolution } from './pending'

const playerId = 'player-one' as const
type State = ReturnType<typeof createBs12AudienceDemoState>
const initial = (s: State, targets = ['bs12-009-attacker'], paymentIds = ['bs12-049-support-0']) => applyGameCommand(s, { kind: 'play-trap', playerId, trapInstanceId: 'bs12-049-trap', paymentIds, targetIds: [], effectTargets: [targets] })
const resolve = (s: State) => applyGameCommand(s, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
const open = (scenario: Parameters<typeof createBs12AudienceDemoState>[0] = 'positive', targets?: string[]) => resolve(initial(createBs12AudienceDemoState(scenario), targets))
const pay = (s: State, ids = ['bs12-049-support-0']) => applyGameCommand(s, { kind: 'resolve-optional-cost-attack', playerId, action: 'pay', supportToHandIds: ids })
const draw = (s: State, count: number) => {
  const opened = resolve(s)
  let after = applyGameCommand(opened, { kind: 'resolve-draw-up-to', playerId, drawCount: count })
  if (after.pendingAbilityEffect) after = resolve(after)
  return after
}
const finish = (s: State) => {
  let after = s
  for (let i = 0; after.pendingBattle && i < 10; i++) after = applyGameCommand(after, { kind: 'resolve-next-damage', playerId })
  return after
}

describe('BS12-049 separate G reduction and optional Arena return cost', () => {
  it('keeps candidate fixtures local', () => {
    expect(parseTestStateConfig('?test-state=bs12-049:positive', 'localhost')).toEqual({ kind: 'bs12-049', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-049:positive', 'example.com')).toBeNull()
  })
  it.each([0, 2, 3, 4])('can return any type/color/REST Arena support, including the original G payment: %s', index => {
    const before = open()
    const snapshot = structuredClone(before)
    const card = before.players[playerId].supportArea[index].card
    const paid = pay(before, [card.instanceId])
    expect(paid.players[playerId].hand).toEqual([card])
    expect(paid.players[playerId].supportArea.map(c => c.card.instanceId)).toEqual(before.players[playerId].supportArea.filter(c => c.card.instanceId !== card.instanceId).map(c => c.card.instanceId))
    expect(paid.players[playerId].deck).toHaveLength(12)
    expect(paid.players[playerId].battleArea[0].hpCards).toHaveLength(5)
    expect(paid.players[playerId].discardPile.map(c => c.id)).toEqual(['BS12-049'])
    expect(paid.players['player-two']).toEqual(before.players['player-two'])
    const after = finish(draw(paid, 1))
    expect(after.players[playerId].hand).toHaveLength(2)
    expect(after.players[playerId].deck).toHaveLength(11)
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(2)
    expect(hasPendingCardResolution(after)).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it('rested non-Cookie Arena remains a valid cost', () => {
    const before = open('rested-cost')
    expect(before.players[playerId].supportArea[2].rested).toBe(true)
    expect(pay(before, ['bs12-049-support-2']).players[playerId].hand[0].type).toBe('item')
  })
  it('may pay return cost and draw zero, or decline without returning', () => {
    const before = open()
    const zero = finish(draw(pay(before), 0))
    expect(zero.players[playerId].hand.map(c => c.instanceId)).toEqual(['bs12-049-support-0'])
    expect(zero.players[playerId].deck).toHaveLength(12)
    const skipped = finish(applyGameCommand(before, { kind: 'resolve-optional-cost-attack', playerId, action: 'skip' }))
    expect(skipped.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(skipped.players[playerId].hand).toEqual([])
    expect(skipped.players[playerId].deck).toHaveLength(12)
    expect(skipped.players[playerId].battleArea[0].hpCards).toHaveLength(2)
  })
  it.each([[], ['bs12-009-other']].map(ids => ({ ids })))('first reduction selection $ids does not suppress independent Then', ({ ids }) => {
    const before = open('positive', ids)
    expect(before.pendingOptionalCostAttack?.cost.supportToHandKeyword).toBe('arena')
    expect(getAttackDamageAgainst(before, 'bs12-009-attacker', 'bs12-009-defender')).toBe(4)
    const after = finish(draw(pay(before), 1))
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(1)
    expect(after.players[playerId].hand).toHaveLength(2)
  })
  it.each(['non-arena-only', 'opponent-only', 'battle-only'] as const)('still reduces when own support has no Arena, but blocks Then payment: %s', scenario => {
    const before = open(scenario)
    const prompt = getOptionalCostAttackPrompt(before, playerId)!
    expect(prompt.supportToHandCandidates).toEqual([])
    expect(prompt.costText).toContain('【Arena】')
    expect(() => pay(before, ['bs12-049-support-0'])).toThrow()
    expect(finish(applyGameCommand(before, { kind: 'resolve-optional-cost-attack', playerId, action: 'skip' })).players[playerId].battleArea[0].hpCards).toHaveLength(2)
  })
  it('uses the same keyword intersection for prompt, normal costs and optional Then', () => {
    const before = open()
    const cost = { energy: {}, supportToHand: 1, supportToHandKeyword: 'arena' as const }
    expect(getOptionalCostAttackPrompt(before, playerId)!.supportToHandCandidates.map(c => c.instanceId)).toEqual([0, 2, 3, 4].map(i => `bs12-049-support-${i}`))
    const normalItem = { id: 'arena-return-cost-test', instanceId: 'arena-return-cost-test', name: 'Arena return cost test', type: 'item' as const, item: { cost, text: 'cost test', effects: [{ kind: 'draw-up-to' as const, max: 1 }] } }
    const normal = (s: State): State => ({ ...s, activePlayerId: playerId, phase: 'main', pendingBattle: undefined, pendingAbilityEffect: undefined, pendingOptionalCostAttack: null,
      players: { ...s.players, [playerId]: { ...s.players[playerId], hand: [normalItem] } },
    })
    expect(canPlayItem(normal(before), playerId, normalItem.instanceId)).toBe(true)
    expect(() => playItem(normal(before), playerId, normalItem.instanceId, [], [], ['bs12-049-support-1'])).toThrow(/arena/)
    expect(playItem(normal(before), playerId, normalItem.instanceId, [], [], ['bs12-049-support-3']).players[playerId].hand[0].type).toBe('stage')
    expect(isSupportToHandCostCandidate({ ...cost, supportToHandType: 'cookie', supportToHandColor: 'blue' }, before.players[playerId].supportArea[4])).toBe(true)
    expect(isSupportToHandCostCandidate({ ...cost, supportToHandType: 'cookie', supportToHandColor: 'green' }, before.players[playerId].supportArea[4])).toBe(false)
    const none = open('non-arena-only')
    expect(canPlayItem(normal(none), playerId, normalItem.instanceId)).toBe(false)
  })
  it('rejects an actual Arena support owned by the opponent', () => {
    const before = open('opponent-only')
    expect(before.players['player-two'].supportArea.find(c => c.card.instanceId === 'bs12-049-opponent-arena')?.card.keywords).toContain('arena')
    expect(() => pay(before, ['bs12-049-opponent-arena'])).toThrow()
    expect(getOptionalCostAttackPrompt(before, playerId)!.supportToHandCandidates).toEqual([])
  })
  it.each([[], ['bs12-049-support-1'], ['unknown'], ['bs12-009-defender'], ['bs12-049-support-0', 'bs12-049-support-2'], ['bs12-049-support-0', 'bs12-049-support-0']].map(ids => ({ ids })))('rejects missing/illegal/duplicate return cost $ids', ({ ids }) => {
    expect(() => pay(open(), ids)).toThrow()
  })
  it.each(['no-energy', 'wrong-energy', 'rested-energy', 'disabled', 'used', 'main', 'after-battle'] as const)('blocks initial payment or timing: %s', scenario => {
    const before = createBs12AudienceDemoState(scenario)
    expect(getTrapCandidates(before, playerId)).toEqual([])
    expect(() => initial(before)).toThrow()
  })
  it('waits for last-card draw Refresh before continuing ordinary damage', () => {
    const paid = pay(open('last-deck'))
    const waiting = applyGameCommand(resolve(paid), { kind: 'resolve-draw-up-to', playerId, drawCount: 1 })
    expect(waiting.pendingRefresh?.playerId).toBe(playerId)
    expect(waiting.players[playerId].battleArea[0].hpCards).toHaveLength(5)
    let after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-049-refresh', shuffleSeed: 3 })
    if (after.pendingAbilityEffect) after = resolve(after)
    after = finish(after)
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(2)
    expect(after.players[playerId].hand).toHaveLength(2)
    expect(after.players[playerId].deck).toHaveLength(6)
  })
  it('stops before battle damage at Refresh LV10', () => {
    const waiting = applyGameCommand(resolve(pay(open('refresh-lv10'))), { kind: 'resolve-draw-up-to', playerId, drawCount: 1 })
    const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-049-refresh', shuffleSeed: 3 })
    expect(after.status).toBe('finished')
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(5)
    expect(after.players[playerId].breakArea.reduce((n, c) => n + c.level, 0)).toBe(11)
  })
})
