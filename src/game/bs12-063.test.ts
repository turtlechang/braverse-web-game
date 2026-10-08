import { describe, expect, it } from 'vitest'
import { createBs12CakePopsDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { executeCardEffect } from './effects'
import { canActivateCookieSkill } from './skills'
import { hasBlockingPending } from './pending'

type State = ReturnType<typeof createBs12CakePopsDemoState>
const sourceId = 'bs12-063-source'
const incoming = (state: State, target = sourceId) => applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one',
  attackerInstanceId: 'bs12-063-attacker', targetInstanceId: target, supportPaymentIds: state.players['player-one'].supportArea.map(s => s.card.instanceId) })
const finish = (state: State) => {
  let next = state.pendingBattle?.stage === 'trap' ? applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' }) : state
  for (let i = 0; next.pendingBattle?.stage === 'damage' && i < 12; i++) next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return next
}
const effectDamage = (state: State, amount: number, target = sourceId) => finish(executeCardEffect(state,
  { sourcePlayerId: 'player-one', sourceInstanceId: 'bs12-063-attacker' },
  { kind: 'damage', amount, target: { side: 'opponent', min: 1, max: 1 } }, [target]))
describe('BS12-063 damage threshold and actual named battle host', () => {
  it('normal deployment grants printed two HP without a manual ability or OnPlay', () => {
    const before = createBs12CakePopsDemoState('deploy')
    const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: sourceId })
    expect(after.players['player-one'].battleArea[0].hpCards).toEqual(before.players['player-one'].deck.slice(0, 2))
    expect(after.players['player-one'].deck).toEqual(before.players['player-one'].deck.slice(2))
    expect(after.pendingOnPlay).toBeNull()
    expect(canActivateCookieSkill(after, 'player-one', sourceId, 'activate')).toBe(false)
    expect(parseTestStateConfig('?test-state=bs12-063:positive', 'localhost')).toEqual({ kind: 'bs12-063', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-063:positive', 'example.com')).toBeNull()
  })
  it.each(['positive', 'host-rested', 'source-rested', 'one-damage', 'two-damage', 'three-damage'] as const)('receives exactly one ordinary damage: %s', scenario => {
    const before = createBs12CakePopsDemoState(scenario)
    const snapshot = structuredClone(before)
    const after = finish(incoming(before))
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([1, 2])
    expect(after.players['player-two'].discardPile).toEqual(before.players['player-two'].battleArea[0].hpCards.slice(-1))
    expect(after.players['player-two'].deck).toEqual(before.players['player-two'].deck)
    expect(after.pendingBattle).toBeNull()
    expect(hasBlockingPending(after)).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it.each(['no-host', 'host-support', 'host-hand', 'host-trash', 'host-break', 'host-equipped', 'opponent-host'] as const)('does not reduce with invalid host location: %s', scenario => {
    const before = createBs12CakePopsDemoState(scenario)
    const after = finish(incoming(before))
    expect(after.players['player-two'].battleArea).toEqual([])
    expect(after.players['player-two'].breakArea.some(c => c.instanceId === sourceId)).toBe(true)
    expect(after.players['player-two'].discardPile).toEqual([...before.players['player-two'].discardPile,
      ...before.players['player-two'].battleArea[0].hpCards.slice().reverse(),
      ...(before.players['player-two'].battleArea[0].equippedCards ?? [])])
  })
  it.each([0, 1, 2, 3, 4, 8])('applies the same 2→1 threshold to %i effect damage', amount => {
    const before = createBs12CakePopsDemoState()
    const after = effectDamage(before, amount)
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([amount === 0 ? 2 : 1, 2])
    expect(after.players['player-two'].discardPile).toHaveLength(amount === 0 ? 0 : 1)
    expect(after.pendingBattle).toBeNull()
  })
  it.each(['no-host', 'host-support', 'host-hand', 'host-trash', 'host-break', 'host-equipped', 'opponent-host'] as const)('does not reduce two effect damage with %s', scenario => {
    const after = effectDamage(createBs12CakePopsDemoState(scenario), 2)
    expect(after.players['player-two'].battleArea).toEqual([])
    expect(after.players['player-two'].breakArea.some(c => c.instanceId === sourceId)).toBe(true)
  })
  it('does not shield Popping Candy, and reevaluates the host after it faints', () => {
    const before = createBs12CakePopsDemoState()
    const noHost = effectDamage(before, 2, 'bs12-063-host')
    expect(noHost.players['player-two'].battleArea.map(c => c.card.instanceId)).toEqual([sourceId])
    const after = effectDamage(noHost, 2)
    expect(after.players['player-two'].battleArea).toEqual([])
  })
  it('is also active during its owner turn and does not consume a once-per-turn use', () => {
    const before = { ...createBs12CakePopsDemoState(), activePlayerId: 'player-two' as const }
    const after = effectDamage(before, 2)
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([1, 2])
    expect(after.skillUsesThisTurn).toEqual(before.skillUsesThisTurn)
  })
  it('does not prevent direct faint because that effect is not damage', () => {
    const before = createBs12CakePopsDemoState()
    const after = executeCardEffect(before, { sourcePlayerId: 'player-one', sourceInstanceId: 'bs12-063-attacker' },
      { kind: 'make-faint', target: { side: 'opponent', min: 1, max: 1 } }, [sourceId])
    expect(after.players['player-two'].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-063-host'])
    expect(after.players['player-two'].breakArea.some(c => c.instanceId === sourceId)).toBe(true)
  })
  it('pays BB for ordinary three; the passive has no additional attack effect', () => {
    const before = createBs12CakePopsDemoState('attack')
    const declared = applyGameCommand(before, { kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: sourceId,
      targetInstanceId: 'bs12-063-attacker', supportPaymentIds: before.players['player-one'].supportArea.map(s => s.card.instanceId) })
    const after = finish(declared)
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
    expect(after.players['player-one'].battleArea.map(c => c.hpCards.length)).toEqual([2, 2])
    expect(after.pendingBattle).toBeNull()
  })
  it.each(['effect-positive', 'effect-no-host', 'effect-other-target', 'effect-zero'] as const)('pays real RR item for two effect damage: %s', scenario => {
    const before = createBs12CakePopsDemoState(scenario)
    const opened = applyGameCommand(before, { kind: 'begin-play-item', playerId: 'player-one',
      instanceId: 'bs12-063-damage-item', paymentIds: ['bs12-063-payment-0', 'bs12-063-payment-1'] })
    const after = finish(applyGameCommand(opened, { kind: 'resolve-ability-effect', playerId: 'player-one',
      targetIds: scenario === 'effect-zero' ? [] : [scenario === 'effect-other-target' ? 'bs12-063-host' : sourceId] }))
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual(scenario === 'effect-no-host' ? []
      : scenario === 'effect-other-target' ? [2] : scenario === 'effect-zero' ? [2, 2] : [1, 2])
    expect(after.players['player-one'].discardPile.map(c => c.id)).toEqual(['BS11-012'])
    expect(after.players['player-one'].supportArea.every(s => s.rested)).toBe(true)
    expect(after.players['player-one'].hand).toEqual([])
    expect(after.players['player-one'].deck).toEqual(before.players['player-one'].deck)
  })
  it.each(['positive', 'no-host', 'host-rested', 'host-support', 'host-hand', 'host-trash', 'host-break', 'host-equipped', 'opponent-host', 'source-rested', 'one-damage', 'two-damage', 'three-damage', 'other-target', 'attack', 'wrong-energy', 'few-energy', 'rested-energy', 'deploy', 'effect-positive', 'effect-no-host', 'effect-other-target', 'effect-zero'] as const)('keeps legal battle/copy/rest capacity: %s', scenario => {
    for (const player of Object.values(createBs12CakePopsDemoState(scenario).players)) {
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      expect(player.breakArea.reduce((sum, card) => sum + card.level, 0)).toBeLessThan(10)
      const cards = [...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile, ...player.supportArea.map(s => s.card),
        ...player.battleArea.flatMap(c => [c.card, ...c.hpCards, ...(c.equippedCards ?? [])])]
      const counts = cards.reduce<Record<string, number>>((result, card) => ({ ...result, [card.id]: (result[card.id] ?? 0) + 1 }), {})
      expect(Math.max(0, ...Object.values(counts))).toBeLessThanOrEqual(4)
    }
  })
  it.each(['wrong-energy', 'few-energy', 'rested-energy'] as const)('rejects illegal BB payment: %s', scenario => {
    const before = createBs12CakePopsDemoState(scenario)
    expect(() => applyGameCommand(before, { kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: sourceId,
      targetInstanceId: 'bs12-063-attacker', supportPaymentIds: before.players['player-one'].supportArea.map(s => s.card.instanceId) })).toThrow()
  })
})
