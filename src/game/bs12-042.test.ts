import { describe, expect, it } from 'vitest'
import { createBs12ChamomileDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { hasPendingCardResolution } from './pending'
import { describeCommandSteps } from './command-log'

const playerId = 'player-one' as const
type State = ReturnType<typeof createBs12ChamomileDemoState>
const resolve = (state: State, targetIds: string[], activate = true) => applyGameCommand(state, { kind: 'resolve-flip', playerId,
  activate, targetIds, discardHandIds: activate ? ['bs12-042-hand'] : [] })
const finish = (before: State) => {
  let state = before
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 12; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: state.pendingBattle.damagePlayerId ?? state.pendingBattle.defenderPlayerId })
  return state
}

describe('BS12-042 actual FLIP reveal, hand cost and Arena-only HP', () => {
  it('deploys the printed one HP from hand without On Play', () => {
    const before = createBs12ChamomileDemoState('deploy')
    const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: 'bs12-042-source' })
    expect(after.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([2, 1])
    expect(after.players[playerId].deck).toHaveLength(11)
    expect(after.pendingOnPlay).toBeNull()
  })
  it('preserves the healed HP while Refresh pays a real LV2 Cookie and resumes battle', () => {
    const before = createBs12ChamomileDemoState('refresh')
    const waiting = resolve(before, ['bs12-042-bearer'])
    expect(waiting.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([2, 3])
    expect(waiting.pendingRefresh?.playerId).toBe(playerId)
    const after = finish(applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-042-refresh', shuffleSeed: 3 }))
    expect(after.players[playerId].deck).toHaveLength(7)
    expect(after.players[playerId].discardPile).toEqual([])
    expect(after.players[playerId].breakArea.map(c => [c.instanceId, c.level])).toEqual([['bs12-042-refresh', 2]])
    expect(after.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([2, 3])
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it('keeps its candidate route local', () => {
    expect(parseTestStateConfig('?test-state=bs12-042:positive', 'localhost')).toEqual({ kind: 'bs12-042', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-042:positive', 'example.com')).toBeNull()
  })
  it.each([[], ['bs12-042-bearer'], ['bs12-042-companion']].map(targets => ({ targets })))('pays exactly one hand card before healing $targets', ({ targets }) => {
    const before = createBs12ChamomileDemoState()
    const snapshot = structuredClone(before)
    expect(before.pendingBattle?.stage).toBe('flip')
    expect(before.pendingBattle?.revealedHpCard?.id).toBe('BS12-042')
    expect(before.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([1, 3])
    const after = finish(resolve(before, targets))
    expect(after.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([targets.includes('bs12-042-bearer') ? 2 : 1, targets.includes('bs12-042-companion') ? 4 : 3])
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(targets.length))
    if (targets.length) expect(after.players[playerId].battleArea.find(c => c.card.instanceId === targets[0])?.hpCards.at(-1)).toEqual(before.players[playerId].deck[0])
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].discardPile.map(c => c.instanceId)).toEqual(['bs12-042-hand', 'bs12-042-revealed'])
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(hasPendingCardResolution(after)).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it.each(['red-arena', 'green-arena', 'item-hand', 'rested-target'] as const)('accepts any-color Arena and printed hand/status rule: %s', scenario => {
    const before = createBs12ChamomileDemoState(scenario)
    const targets = [scenario === 'rested-target' ? 'bs12-042-bearer' : 'bs12-042-companion']
    const companion = before.players[playerId].battleArea.find(c => c.card.instanceId === 'bs12-042-companion')!
    if (scenario === 'red-arena') {
      expect(companion.card.id).toBe('BS12-003')
      expect(companion.card.hp).toBe(2)
      expect(companion.hpCards).toHaveLength(2)
    }
    const after = finish(resolve(before, targets))
    expect(after.players[playerId].hand).toHaveLength(0)
    expect(after.players[playerId].deck).toHaveLength(11)
    expect(after.players[playerId].battleArea.find(c => c.card.instanceId === targets[0])?.hpCards.length).toBe(
      scenario === 'rested-target' ? 2 : scenario === 'red-arena' ? 3 : 4,
    )
    expect(after.players[playerId].battleArea.map(c => c.rested)).toEqual(before.players[playerId].battleArea.map(c => c.rested))
  })
  it('permits zero Arena targets with no Arena Cookies while still paying one hand card', () => {
    const before = createBs12ChamomileDemoState('no-arena')
    expect(before.pendingBattle?.stage).toBe('flip')
    const after = finish(resolve(before, []))
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].hand).toHaveLength(0)
    expect(after.players[playerId].discardPile).toHaveLength(2)
  })
  it('declines without paying or healing', () => {
    const before = createBs12ChamomileDemoState()
    const after = finish(resolve(before, [], false))
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.players[playerId].discardPile.map(c => c.instanceId)).toEqual(['bs12-042-revealed'])
  })
  it('blocks missing hand cost', () => {
    const before = createBs12ChamomileDemoState('no-hand')
    expect(() => resolve(before, ['bs12-042-bearer'])).toThrow()
    const after = finish(resolve(before, [], false))
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
  })
  it.each([['bs12-042-attacker'], ['bs12-042-support'], ['bs12-042-bearer', 'bs12-042-bearer'], ['bs12-042-bearer', 'bs12-042-companion']].map(targets => ({ targets })))('rejects side/zone/duplicates/over-selection $targets', ({ targets }) => {
    const before = createBs12ChamomileDemoState()
    const snapshot = structuredClone(before)
    expect(() => resolve(before, targets)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each(['non-arena', 'equipment'] as const)('does not treat %s as an Arena battle Cookie', scenario => {
    const before = createBs12ChamomileDemoState(scenario)
    expect(() => resolve(before, ['bs12-042-companion'])).toThrow()
    if (scenario === 'equipment') expect(() => resolve(before, ['bs12-042-equipped'])).toThrow()
    expect(finish(resolve(before, ['bs12-042-bearer'])).players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([2, 3])
  })
  it.each([[], ['bs12-042-bearer']].map(targets => ({ targets })))('public trace records hand cost before actual gain: $targets', ({ targets }) => {
    const before = createBs12ChamomileDemoState()
    const command = { kind: 'resolve-flip' as const, playerId, activate: true, targetIds: targets, discardHandIds: ['bs12-042-hand'] }
    const after = applyGameCommand(before, command)
    const steps = describeCommandSteps(before, after, command)!
    expect(steps[0].text).toContain('FLIP 代價：棄置手牌')
    expect(steps[0].text).toContain('Peach Cookie')
    expect(steps[1].text).toContain(targets.length ? '「Mango Cookie」增加 1 點 HP' : '未增加 HP')
    expect(steps.flatMap(s => s.cards ?? []).some(card => card.instanceId.startsWith('bs12-042-deck-'))).toBe(false)
  })
  it('rescues its zero-HP bearer before fainting', () => {
    const before = createBs12ChamomileDemoState('last-hp')
    expect(before.players[playerId].battleArea[0].hpCards).toHaveLength(0)
    const after = finish(resolve(before, ['bs12-042-bearer']))
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(1)
    expect(after.players[playerId].breakArea).toHaveLength(0)
  })
  it('can heal the other Arena while the zero-HP bearer faints', () => {
    const after = finish(resolve(createBs12ChamomileDemoState('last-hp'), ['bs12-042-companion']))
    expect(after.players[playerId].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-042-companion'])
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(4)
    expect(after.players[playerId].breakArea.at(-1)?.instanceId).toBe('bs12-042-bearer')
  })
  it('uses printed HP for the bearer and resolves its actual 4 damage after healing', () => {
    const before = createBs12ChamomileDemoState('follow-up')
    const bearer = before.players[playerId].battleArea.find(c => c.card.instanceId === 'bs12-042-bearer')!
    const attacker = before.players['player-two'].battleArea.find(c => c.card.instanceId === 'bs12-042-attacker')!
    expect(bearer.card.id).toBe('BS12-021')
    expect(bearer.card.hp).toBe(2)
    expect(bearer.hpCards.map(c => c.instanceId)).toEqual(['bs12-042-bottom-0'])
    expect(attacker.card.id).toBe('BS12-019')
    expect(attacker.card.hp).toBe(4)
    expect(before.pendingBattle?.declaredDamage).toBe(4)
    expect(before.pendingBattle?.remainingDamage).toBe(3)
    expect(before.pendingBattle?.stage).toBe('flip')
    expect(before.pendingBattle?.revealedHpCard?.id).toBe('BS12-042')
    const afterFlip = resolve(before, ['bs12-042-bearer'])
    expect(afterFlip.players[playerId].battleArea.find(c => c.card.instanceId === 'bs12-042-bearer')?.hpCards).toHaveLength(2)
    expect(afterFlip.players[playerId].discardPile.map(c => c.instanceId)).toEqual(['bs12-042-hand', 'bs12-042-revealed'])
    expect(afterFlip.pendingBattle?.remainingDamage).toBe(3)
    const after = finish(afterFlip)
    expect(after.players[playerId].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-042-companion'])
    expect(after.players[playerId].breakArea.map(c => c.instanceId)).toContain('bs12-042-bearer')
    expect(after.pendingReplacement).toBeTruthy()
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it('pays one green support for normal one damage without Then', () => {
    const before = createBs12ChamomileDemoState('attack')
    const after = applyGameCommand(before, { kind: 'attack', playerId, attackerInstanceId: 'bs12-042-source', targetInstanceId: 'bs12-019-opponent', supportPaymentIds: ['bs12-042-payment-0'] })
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([5, 4])
    expect(after.players[playerId].supportArea[0].rested).toBe(true)
    expect(after.players[playerId].battleArea[0].rested).toBe(true)
    expect(after.players[playerId].battleArea[0].hpCards).toEqual(before.players[playerId].battleArea[0].hpCards)
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it.each(['wrong-energy', 'few-energy', 'rested-energy', 'opponent-turn', 'source-rested'] as const)('blocks ordinary attack %s', scenario => {
    const before = createBs12ChamomileDemoState(scenario)
    expect(() => applyGameCommand(before, { kind: 'attack', playerId, attackerInstanceId: 'bs12-042-source', targetInstanceId: 'bs12-019-opponent', supportPaymentIds: before.players[playerId].supportArea.map(s => s.card.instanceId) })).toThrow()
  })
  it.each(['positive', 'red-arena', 'green-arena', 'non-arena', 'no-arena', 'no-hand', 'item-hand', 'last-hp', 'follow-up', 'rested-target', 'equipment', 'attack', 'wrong-energy', 'few-energy', 'rested-energy', 'opponent-turn', 'source-rested'] as const)('uses legal field/break/card-copy capacity %s', scenario => {
    const state = createBs12ChamomileDemoState(scenario)
    for (const player of Object.values(state.players)) {
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      expect(player.breakArea.reduce((sum, c) => sum + c.level, 0)).toBeLessThan(10)
      const cards = [...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile,
        ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards, ...(c.equippedCards ?? [])])]
      const counts = cards.reduce<Record<string, number>>((result, card) => ({ ...result, [card.id]: (result[card.id] ?? 0) + 1 }), {})
      expect(Math.max(0, ...Object.values(counts))).toBeLessThanOrEqual(4)
    }
  })
})
