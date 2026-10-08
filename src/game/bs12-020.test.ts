import { describe, expect, it } from 'vitest'
import { createBs12StrawberryDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { hasActivatableFlipEffect } from './battle'
import { hasPendingCardResolution } from './pending'
import { describeCommandSteps } from './command-log'

const playerId = 'player-one' as const
type State = ReturnType<typeof createBs12StrawberryDemoState>
const resolve = (state: State, targets: string[], activate = true) => applyGameCommand(state, { kind: 'resolve-flip', playerId,
  activate, targetIds: targets, discardHandIds: activate ? ['bs12-020-hand'] : [] })
const finish = (before: State) => {
  let state = before
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 12; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: state.pendingBattle.damagePlayerId ?? state.pendingBattle.defenderPlayerId })
  return state
}

describe('BS12-020 real FLIP reveal, cost and HP settlement', () => {
  it('keeps candidate routes local', () => {
    expect(parseTestStateConfig('?test-state=bs12-020:positive', 'localhost')).toEqual({ kind: 'bs12-020', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-020:positive', 'example.com')).toBeNull()
  })
  it.each([[], ['bs12-020-bearer'], ['bs12-020-companion'], ['bs12-020-companion', 'bs12-020-bearer']].map(targets => ({ targets })))('pays before resolving zero/one/two actual targets $targets', ({ targets }) => {
    const before = createBs12StrawberryDemoState()
    const snapshot = structuredClone(before)
    expect(before.pendingBattle?.stage).toBe('flip')
    expect(before.pendingBattle?.revealedHpCard?.id).toBe('BS12-020')
    expect(before.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([3, 3])
    const after = finish(resolve(before, targets))
    expect(after.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([targets.includes('bs12-020-bearer') ? 4 : 3, targets.includes('bs12-020-companion') ? 4 : 3])
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(targets.length))
    for (let i = 0; i < targets.length; i++) expect(after.players[playerId].battleArea.find(c => c.card.instanceId === targets[i])?.hpCards.at(-1)).toEqual(before.players[playerId].deck[i])
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].discardPile.map(c => c.instanceId)).toEqual(['bs12-020-hand', 'bs12-020-revealed'])
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(hasPendingCardResolution(after)).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it.each(['five-arena', 'mixed-arena', 'item-hand'] as const)('accepts printed boundary/cost %s', scenario => {
    const before = createBs12StrawberryDemoState(scenario)
    expect(before.pendingBattle?.stage).toBe('flip')
    const after = finish(resolve(before, ['bs12-020-bearer', 'bs12-020-companion']))
    expect(after.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([4, 4])
    expect(after.players[playerId].hand).toEqual([])
  })
  it.each(['three-arena', 'non-arena-break', 'opponent-break', 'trash-arena', 'high-level'] as const)('does not offer activation or discard hand when condition is false: %s', scenario => {
    const before = createBs12StrawberryDemoState(scenario)
    expect(before.pendingBattle?.stage).not.toBe('flip')
    expect(before.players[playerId].hand).toHaveLength(1)
    expect(before.players[playerId].discardPile.some(c => c.instanceId === 'bs12-020-revealed')).toBe(true)
    expect(before.players[playerId].deck).toHaveLength(12)
    expect(before.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([3, 3])
    const effect = createBs12StrawberryDemoState().pendingBattle!.revealedHpCard!.flip!
    expect(hasActivatableFlipEffect(before, effect, { sourcePlayerId: playerId, sourceInstanceId: 'bs12-020-revealed' }, 'bs12-020-bearer')).toBe(false)
  })
  it('declines without paying hand cost or drawing HP', () => {
    const before = createBs12StrawberryDemoState()
    const after = finish(resolve(before, [], false))
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.players[playerId].discardPile.map(c => c.instanceId)).toEqual(['bs12-020-revealed'])
  })
  it.each([[], ['bs12-020-companion', 'bs12-020-bearer']].map(targets => ({ targets })))('records the public paid cost before actual HP outcome: $targets', ({ targets }) => {
    const before = createBs12StrawberryDemoState()
    const command = { kind: 'resolve-flip' as const, playerId, activate: true, targetIds: targets, discardHandIds: ['bs12-020-hand'] }
    const after = applyGameCommand(before, command)
    const steps = describeCommandSteps(before, after, command)!
    expect(steps[0].text).toContain('FLIP 代價：棄置手牌')
    expect(steps[0].text).toContain('Peach Cookie')
    if (targets.length === 0) expect(steps[1].text).toContain('未增加 HP')
    else {
      expect(steps[1].text).toContain('「Langue de Chat Cookie」增加 1 點 HP')
      expect(steps[1].text).toContain('「Candy Diver Cookie」增加 1 點 HP')
    }
    expect(steps.flatMap(step => step.cards ?? []).some(card => card.instanceId.startsWith('bs12-020-deck-'))).toBe(false)
  })
  it('rejects activation without the required hand card', () => {
    const before = createBs12StrawberryDemoState('no-hand')
    expect(before.pendingBattle?.stage).toBe('flip')
    expect(() => resolve(before, ['bs12-020-bearer'])).toThrow()
  })
  it.each([['bs12-020-attacker'], ['bs12-020-support'], ['bs12-020-bearer', 'bs12-020-bearer'], ['bs12-020-bearer', 'bs12-020-companion', 'bs12-020-attacker']].map(targets => ({ targets })))('rejects invalid side, zone, duplicates or over-selection $targets', ({ targets }) => {
    const before = createBs12StrawberryDemoState()
    const snapshot = structuredClone(before)
    expect(() => resolve(before, targets)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('heals the zero-HP bearer before fainting is checked', () => {
    const before = createBs12StrawberryDemoState('last-hp')
    expect(before.players[playerId].battleArea[0].hpCards).toHaveLength(0)
    const after = finish(resolve(before, ['bs12-020-bearer']))
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(1)
    expect(after.players[playerId].breakArea).toEqual(before.players[playerId].breakArea)
  })
  it('can heal the other Cookie while the zero-HP bearer faints', () => {
    const before = createBs12StrawberryDemoState('last-hp')
    const after = finish(resolve(before, ['bs12-020-companion']))
    expect(after.players[playerId].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-020-companion'])
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(4)
    expect(after.players[playerId].breakArea.at(-1)?.instanceId).toBe('bs12-020-bearer')
  })
  it('continues the remaining three damage after the FLIP has added real HP', () => {
    const before = createBs12StrawberryDemoState('follow-up')
    expect(before.pendingBattle?.declaredDamage).toBe(4)
    const after = finish(resolve(before, ['bs12-020-companion', 'bs12-020-bearer']))
    expect(after.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([2, 4])
    expect(after.players[playerId].deck).toHaveLength(10)
    expect(after.players[playerId].discardPile).toHaveLength(5)
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it('pays YYY for an ordinary attack without Then', () => {
    const before = createBs12StrawberryDemoState('attack')
    let state = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: 'bs12-020-source', targetInstanceId: 'bs12-019-opponent', supportPaymentIds: before.players[playerId].supportArea.map(s => s.card.instanceId) })
    expect(state.pendingBattle?.declaredDamage).toBe(3)
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
    const after = finish(state)
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3, 4])
    expect(after.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it.each(['wrong-energy', 'few-energy', 'rested-energy'] as const)('blocks ordinary attack payment %s', scenario => {
    const before = createBs12StrawberryDemoState(scenario)
    expect(() => applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: 'bs12-020-source', targetInstanceId: 'bs12-019-opponent', supportPaymentIds: before.players[playerId].supportArea.map(s => s.card.instanceId) })).toThrow()
  })
  it.each(['positive', 'three-arena', 'five-arena', 'non-arena-break', 'opponent-break', 'trash-arena', 'high-level', 'mixed-arena', 'no-hand', 'item-hand', 'last-hp', 'follow-up', 'attack', 'wrong-energy', 'few-energy', 'rested-energy'] as const)('has legal field and break capacity: %s', scenario => {
    const state = createBs12StrawberryDemoState(scenario)
    for (const player of Object.values(state.players)) {
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      expect(player.breakArea.reduce((sum, c) => sum + c.level, 0)).toBeLessThan(10)
      const cards = [...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile,
        ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
      const counts = cards.reduce<Record<string, number>>((result, card) => ({ ...result, [card.id]: (result[card.id] ?? 0) + 1 }), {})
      expect(Math.max(0, ...Object.values(counts))).toBeLessThanOrEqual(4)
    }
  })
})
