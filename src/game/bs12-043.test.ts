import { describe, expect, it } from 'vitest'
import { createBs12CoffeeCandyDemoState, parseTestStateConfig, type Bs12CoffeeCandyScenario } from './demo'
import { applyGameCommand } from './commands'
import { hasPendingCardResolution } from './pending'

const playerId = 'player-one' as const
type State = ReturnType<typeof createBs12CoffeeCandyDemoState>
const resolve = (state: State, targetIds: string[], activate = true) => applyGameCommand(state, { kind: 'resolve-flip', playerId, activate, targetIds })
const finish = (before: State) => {
  let state = before
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 12; i++) state = applyGameCommand(state, {
    kind: 'resolve-next-damage', playerId: state.pendingBattle.damagePlayerId ?? state.pendingBattle.defenderPlayerId,
  })
  return state
}

describe('BS12-043 support intersection, FLIP selection and ordinary GGG3', () => {
  it('keeps the route local', () => {
    expect(parseTestStateConfig('?test-state=bs12-043:positive', 'localhost')).toEqual({ kind: 'bs12-043', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-043:positive', 'example.com')).toBeNull()
  })
  it.each(['positive', 'six', 'rested-own', 'item-count', 'stage-count'] as const)('counts all printed eligible support cards: %s', scenario => {
    const before = createBs12CoffeeCandyDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(before.pendingBattle?.revealedHpCard?.id).toBe('BS12-043')
    const after = finish(resolve(before, ['bs12-043-opponent-support-1']))
    expect(after.players['player-two'].supportArea.map(s => s.rested)).toEqual([true, true, false, false])
    expect(after.players['player-two'].battleArea).toEqual(before.players['player-two'].battleArea)
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].discardPile.map(c => c.instanceId)).toEqual(['bs12-043-revealed'])
    expect(hasPendingCardResolution(after)).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it.each([0, 1, 2, 3])('accepts any opponent support card and already rested card: %s', index => {
    const before = createBs12CoffeeCandyDemoState()
    const after = finish(resolve(before, [`bs12-043-opponent-support-${index}`]))
    expect(after.players['player-two'].supportArea.map(s => s.rested)).toEqual([true, index === 1, index === 2, index === 3])
  })
  it('resolves the non-battle card selection sent by the FLIP modal', () => {
    const before = createBs12CoffeeCandyDemoState()
    const after = finish(applyGameCommand(before, { kind: 'resolve-flip', playerId, activate: true,
      targetIds: [], effectTargetIds: ['bs12-043-opponent-support-1'] }))
    expect(after.players['player-two'].supportArea.map(s => s.rested)).toEqual([true, true, false, false])
  })
  it.each(['four', 'non-arena', 'wrong-color', 'intersection', 'opponent-only', 'battle-only'] as const)('does not count the wrong intersection or zone: %s', scenario => {
    const before = createBs12CoffeeCandyDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(before.pendingBattle).toBeNull()
    expect(before.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([1, 3])
    expect(before.players[playerId].discardPile.map(c => c.instanceId)).toEqual(['bs12-043-revealed'])
    expect(before.players['player-two'].supportArea.slice(1).every(s => !s.rested)).toBe(true)
    expect(() => resolve(before, ['bs12-043-opponent-support-1'])).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([true, false])('choosing zero or declining changes no support: %s', activate => {
    const before = createBs12CoffeeCandyDemoState()
    const after = finish(resolve(before, [], activate))
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].discardPile).toHaveLength(1)
  })
  it('can select an already rested support without moving it', () => {
    const before = createBs12CoffeeCandyDemoState('all-target-rested')
    expect(finish(resolve(before, ['bs12-043-opponent-support-2'])).players['player-two']).toEqual(before.players['player-two'])
  })
  it.each([['bs12-043-own-support-0'], ['bs12-043-attacker'], ['unknown'], ['bs12-043-opponent-support-1', 'bs12-043-opponent-support-2'], ['bs12-043-opponent-support-1', 'bs12-043-opponent-support-1']].map(ids => ({ ids })))('rejects wrong zone, side, over-selection and duplicates $ids', ({ ids }) => {
    const before = createBs12CoffeeCandyDemoState()
    const snapshot = structuredClone(before)
    expect(() => resolve(before, ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('faints the zero HP bearer after resting the chosen support', () => {
    const after = finish(resolve(createBs12CoffeeCandyDemoState('last-hp'), ['bs12-043-opponent-support-1']))
    expect(after.players[playerId].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-043-companion'])
    expect(after.players[playerId].breakArea.map(c => c.instanceId)).toEqual(['bs12-043-bearer'])
    expect(after.players['player-two'].supportArea[1].rested).toBe(true)
    expect(after.pendingReplacement).toBeTruthy()
  })
  it('faints the printed two-HP bearer during the actual four-damage parent attack after FLIP', () => {
    const before = createBs12CoffeeCandyDemoState('follow-up')
    const bearer = before.players[playerId].battleArea.find(c => c.card.instanceId === 'bs12-043-bearer')!
    const attacker = before.players['player-two'].battleArea.find(c => c.card.instanceId === 'bs12-043-attacker')!
    expect(bearer.card.id).toBe('BS12-021')
    expect(bearer.card.hp).toBe(2)
    expect(bearer.hpCards.map(c => c.instanceId)).toEqual(['bs12-043-bottom-0'])
    expect(attacker.card.id).toBe('BS12-019')
    expect(attacker.card.hp).toBe(4)
    expect(before.pendingBattle?.attackerInstanceId).toBe('bs12-043-attacker')
    expect(before.pendingBattle?.targetInstanceId).toBe('bs12-043-bearer')
    expect(before.pendingBattle?.stage).toBe('flip')
    expect(before.pendingBattle?.declaredDamage).toBe(4)
    expect(before.pendingBattle?.remainingDamage).toBe(3)
    expect(before.pendingBattle?.revealedHpCard?.id).toBe('BS12-043')
    const afterFlip = resolve(before, ['bs12-043-opponent-support-3'])
    expect(afterFlip.players[playerId].battleArea.find(c => c.card.instanceId === 'bs12-043-bearer')?.hpCards.map(c => c.instanceId)).toEqual(['bs12-043-bottom-0'])
    expect(afterFlip.players[playerId].discardPile.map(c => c.instanceId)).toContain('bs12-043-revealed')
    expect(afterFlip.pendingBattle?.remainingDamage).toBe(3)
    const after = finish(afterFlip)
    expect(after.players[playerId].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-043-companion'])
    expect(after.players[playerId].breakArea.map(c => c.instanceId)).toContain('bs12-043-bearer')
    expect(after.pendingReplacement).toBeTruthy()
    expect(after.players['player-two'].supportArea.every(s => s.rested)).toBe(true)
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it('deploys three printed HP without On Play', () => {
    const after = applyGameCommand(createBs12CoffeeCandyDemoState('deploy'), { kind: 'deploy-cookie', playerId, instanceId: 'bs12-043-source' })
    expect(after.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([2, 3])
    expect(after.players[playerId].deck).toHaveLength(9)
    expect(after.pendingOnPlay).toBeNull()
  })
  it('pays three green supports for exactly three ordinary damage', () => {
    const before = createBs12CoffeeCandyDemoState('attack')
    const after = applyGameCommand(before, { kind: 'attack', playerId, attackerInstanceId: 'bs12-043-source', targetInstanceId: 'bs12-039-opponent',
      supportPaymentIds: before.players[playerId].supportArea.map(s => s.card.instanceId) })
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3, 4])
    expect(after.players['player-two'].discardPile).toHaveLength(3)
    expect(after.players[playerId].battleArea[0].hpCards).toEqual(before.players[playerId].battleArea[0].hpCards)
    expect(after.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it.each(['attack-wrong', 'attack-few', 'attack-rested', 'attack-source-rested', 'opponent-turn'] as const)('rejects ordinary %s', scenario => {
    const before = createBs12CoffeeCandyDemoState(scenario)
    expect(() => applyGameCommand(before, { kind: 'attack', playerId, attackerInstanceId: 'bs12-043-source', targetInstanceId: 'bs12-039-opponent',
      supportPaymentIds: before.players[playerId].supportArea.map(s => s.card.instanceId) })).toThrow()
  })
  it.each(['positive', 'six', 'rested-own', 'item-count', 'stage-count', 'non-arena', 'wrong-color', 'intersection', 'opponent-only', 'battle-only', 'last-hp', 'follow-up', 'deploy'] as Bs12CoffeeCandyScenario[])('retains legal field and card copy capacity: %s', scenario => {
    for (const player of Object.values(createBs12CoffeeCandyDemoState(scenario).players)) {
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      const cards = [...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile, ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
      const counts = cards.reduce<Record<string, number>>((result, card) => ({ ...result, [card.id]: (result[card.id] ?? 0) + 1 }), {})
      expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(4)
    }
  })
})
