import { describe, expect, it } from 'vitest'
import { createBs12MayorDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { executeCardEffect, getEffectTargetCandidates } from './effects'
import { canActivateCookieSkill } from './skills'
import { describeCommandSteps } from './command-log'

const playerId = 'player-one' as const
const sourceId = 'bs12-025-source'
type State = ReturnType<typeof createBs12MayorDemoState>
const deploy = (before: State) => before.pendingOnPlay ? before : applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: sourceId })
const gain = (before: State, ids: string[] = ['bs12-025-ally']) => applyGameCommand(before,
  { kind: 'activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'on-play', paymentIds: [], effectTargets: [ids] })
const context = { sourcePlayerId: playerId, sourceInstanceId: sourceId }
const hp = (state: State, id = sourceId) => state.players[playerId].battleArea.find(c => c.card.instanceId === id)!.hpCards
const effect = { kind: 'gain-hp' as const, amount: 1, target: { side: 'self' as const, min: 0, max: 1, cardName: 'Caramel Choux Cookie' } }
describe('BS12-025 free named On Play target and yellow ordinary attack', () => {
  it('uses real printed defenders at their printed HP', () => {
    const normal = createBs12MayorDemoState('attack')
    expect(normal.players['player-two'].battleArea.map(entry => [entry.card.id, entry.hpCards.length])).toEqual([
      ['BS6-008', 6],
      ['BS12-001', 4],
    ])
    const faint = createBs12MayorDemoState('target-faints')
    expect(faint.players['player-two'].battleArea.map(entry => [entry.card.id, entry.hpCards.length])).toEqual([
      ['BS6-017', 1],
      ['BS12-001', 4],
    ])
  })
  it.each(['positive', 'red-choux', 'no-choux'] as const)('publishes actual named target HP outcome without hidden cards: %s', scenario => {
    const entered = deploy(createBs12MayorDemoState(scenario))
    const begun = applyGameCommand(entered, { kind: 'begin-activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'on-play', paymentIds: [] })
    const command = { kind: 'resolve-ability-effect' as const, playerId, targetIds: scenario === 'no-choux' ? [] : ['bs12-025-ally'] }
    const after = applyGameCommand(begun, command)
    const text = describeCommandSteps(begun, after, command)!.map(step => step.text).join(' ')
    expect(text).toContain(scenario === 'no-choux' ? '未增加 HP' : '「Caramel Choux Cookie」增加 1 點 HP')
    expect(text).not.toContain('bs12-025-deck-')
  })
  it('keeps its fixture local and configures one printed HP before the optional skill', () => {
    expect(parseTestStateConfig('?test-state=bs12-025:positive', 'localhost')).toEqual({ kind: 'bs12-025', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-025:positive', 'example.com')).toBeNull()
    const before = createBs12MayorDemoState()
    const entered = deploy(before)
    expect(hp(entered)).toEqual(before.players[playerId].deck.slice(0, 1))
    expect(entered.players[playerId].deck).toHaveLength(11)
    expect(entered.players[playerId].hand).toEqual([])
    expect(entered.pendingOnPlay?.sourceInstanceId).toBe(sourceId)
  })
  it.each(['positive', 'red-choux', 'rested-choux', 'no-energy', 'rested-support', 'opponent-turn'] as const)('adds exactly one top-deck HP to the named ally: %s', scenario => {
    const before = createBs12MayorDemoState(scenario)
    const entered = deploy(before)
    const snapshot = structuredClone(entered)
    expect(canActivateCookieSkill(entered, playerId, sourceId, 'on-play')).toBe(true)
    expect(getEffectTargetCandidates(entered, context, effect.target).map(c => c.card.instanceId)).toEqual(['bs12-025-ally'])
    const after = gain(entered)
    expect(hp(after, 'bs12-025-ally')).toEqual([...hp(entered, 'bs12-025-ally'), entered.players[playerId].deck[0]])
    expect(hp(after)).toEqual(hp(entered))
    expect(after.players[playerId].deck).toEqual(entered.players[playerId].deck.slice(1))
    expect(after.players[playerId].supportArea).toEqual(entered.players[playerId].supportArea)
    expect(after.players[playerId].battleArea.find(c => c.card.instanceId === 'bs12-025-ally')?.rested).toBe(scenario === 'rested-choux')
    expect(after.players['player-two']).toEqual(entered.players['player-two'])
    expect(after.activePlayerId).toBe(entered.activePlayerId)
    expect(entered).toEqual(snapshot)
    expect(canActivateCookieSkill(after, playerId, sourceId, 'on-play')).toBe(false)
  })
  it.each(['no-choux', 'wrong-name', 'opponent-choux', 'support-choux'] as const)('does not treat %s as an own battle name target; zero remains legal', scenario => {
    const entered = deploy(createBs12MayorDemoState(scenario))
    expect(getEffectTargetCandidates(entered, context, effect.target)).toEqual([])
    expect(canActivateCookieSkill(entered, playerId, sourceId, 'on-play')).toBe(true)
    expect(gain(entered, []).players).toEqual(entered.players)
  })
  it('selecting zero while a legal ally exists does not consume any HP card', () => {
    const entered = deploy(createBs12MayorDemoState())
    expect(gain(entered, []).players).toEqual(entered.players)
  })
  it.each(['positive', 'red-choux', 'no-choux'] as const)('may skip all On Play preserving normal one HP: %s', scenario => {
    const entered = deploy(createBs12MayorDemoState(scenario))
    const after = applyGameCommand(entered, { kind: 'skip-on-play', playerId, sourceInstanceId: sourceId })
    expect(after.players).toEqual(entered.players)
    expect(hp(after)).toHaveLength(1)
    expect(after.pendingOnPlay).toBeNull()
  })
  it.each([{ ids: [sourceId] }, { ids: ['bs12-025-opponent'] }, { ids: ['bs12-025-payment-0'] },
    { ids: ['bs12-025-ally', 'bs12-025-ally'] }, { ids: ['bs12-025-ally', sourceId] }])('rejects invalid targets $ids without mutation', ({ ids }) => {
    const entered = deploy(createBs12MayorDemoState())
    const snapshot = structuredClone(entered)
    expect(() => gain(entered, ids)).toThrow()
    expect(entered).toEqual(snapshot)
  })
  it('a nonmatching Cookie cannot replace the named target', () => {
    const entered = deploy(createBs12MayorDemoState('wrong-name'))
    expect(() => executeCardEffect(entered, context, effect, ['bs12-025-ally'])).toThrow()
  })
  it('source resting is not a cost or restriction for this On Play', () => {
    const entered = deploy(createBs12MayorDemoState())
    const rested = { ...entered, players: { ...entered.players, [playerId]: { ...entered.players[playerId],
      battleArea: entered.players[playerId].battleArea.map(c => c.card.instanceId === sourceId ? { ...c, rested: true } : c) } } }
    expect(canActivateCookieSkill(rested, playerId, sourceId, 'on-play')).toBe(true)
    expect(hp(gain(rested), 'bs12-025-ally')).toHaveLength(4)
  })
  it('ordinary yellow attack deals one and does not rerun the skipped On Play', () => {
    const before = createBs12MayorDemoState('attack')
    const after = applyGameCommand(before, { kind: 'attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-025-opponent', supportPaymentIds: ['bs12-025-payment-0'] })
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([5, 4])
    expect(after.players[playerId].supportArea[0].rested).toBe(true)
    expect(hp(after)).toHaveLength(1)
    expect(hp(after, 'bs12-025-ally')).toEqual(hp(before, 'bs12-025-ally'))
  })
  it.each(['wrong-energy', 'few-energy', 'rested-energy', 'source-rested'] as const)('rejects ordinary attack %s', scenario => {
    const before = createBs12MayorDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(() => applyGameCommand(before, { kind: 'attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-025-opponent', supportPaymentIds: before.players[playerId].supportArea.map(s => s.card.instanceId) })).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each(['positive', 'red-choux', 'rested-choux', 'no-choux', 'wrong-name', 'opponent-choux', 'support-choux', 'no-energy', 'rested-support', 'opponent-turn', 'attack', 'wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'target-faints'] as const)('uses legal field/break/copy capacity %s', scenario => {
    for (const player of Object.values(createBs12MayorDemoState(scenario).players)) {
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      expect(player.breakArea.reduce((sum, c) => sum + c.level, 0)).toBeLessThan(10)
      const cards = [...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile, ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
      const counts = cards.reduce<Record<string, number>>((result, card) => ({ ...result, [card.id]: (result[card.id] ?? 0) + 1 }), {})
      expect(Math.max(0, ...Object.values(counts))).toBeLessThanOrEqual(4)
    }
  })
})
