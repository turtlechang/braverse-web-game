import { describe, expect, it } from 'vitest'
import { createBs12PuddingDemoState } from './demo'
import { applyGameCommand } from './commands'
import { getBlockerCandidates } from './battle'
import { hasPendingCardResolution } from './pending'
import { handleAiPendingBattle } from './ai/battle-handler'
import { describeCommandSteps } from './command-log'
import { commandFromLogEntry, replayCommands } from './replay'

const playerId = 'player-one' as const
const sourceInstanceId = 'bs12-081-source'
const block = (state: ReturnType<typeof createBs12PuddingDemoState>, discardHandIds = ['bs12-081-cost']) =>
  applyGameCommand(state, { kind: 'play-blocker', playerId, sourceInstanceId, paymentIds: [], discardHandIds })
const finish = (before: ReturnType<typeof createBs12PuddingDemoState>) => {
  let state = before
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 10; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId })
  return state
}

describe('081 purple Arena hand Blocker payment before redirect', () => {
  it('prepares the second response with public commands and the first payment already settled', () => {
    const state = createBs12PuddingDemoState('second-response')
    expect(state.turnNumber).toBe(2)
    expect(state.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([1, 4])
    expect(state.players[playerId].hand.map(c => c.instanceId)).toEqual(['bs12-081-cost-two'])
    expect(state.players[playerId].discardPile.map(c => c.instanceId)).toEqual(['bs12-081-cost', 'bs12-081-source-hp-1'])
    expect(state.pendingBattle?.attackerInstanceId).toBe('bs12-081-attacker-two')
    expect(getBlockerCandidates(state, playerId).map(c => c.card.instanceId)).toEqual([sourceInstanceId])
  })
  it('deploys exactly two HP without triggering Blocker or OnPlay', () => {
    const before = createBs12PuddingDemoState('deploy')
    const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: sourceInstanceId })
    expect(after.players[playerId].battleArea[1].hpCards).toEqual(before.players[playerId].deck.slice(0, 2))
    expect(after.players[playerId].deck).toHaveLength(10)
    expect(after.pendingOnPlay).toBeNull()
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it('pays one purple support for ordinary damage without Blocker activation', () => {
    const before = createBs12PuddingDemoState('attack')
    const after = applyGameCommand(before, { kind: 'attack', playerId, attackerInstanceId: sourceInstanceId,
      targetInstanceId: 'bs12-081-attacker', supportPaymentIds: ['bs12-081-payment'] })
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3, 2])
    expect(after.players[playerId].battleArea[0].rested).toBe(true)
    expect(after.players[playerId].supportArea[0].rested).toBe(true)
    expect(after.players[playerId].discardPile).toEqual([])
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it.each(['wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main'] as const)('blocks ordinary attack: %s', scenario => {
    const before = createBs12PuddingDemoState(scenario)
    expect(() => applyGameCommand(before, { kind: 'attack', playerId, attackerInstanceId: sourceInstanceId,
      targetInstanceId: 'bs12-081-attacker', supportPaymentIds: before.players[playerId].supportArea.map(c => c.card.instanceId) })).toThrow()
  })
  it('records public hand cost before redirect and replays the same command without private fields', () => {
    const before = createBs12PuddingDemoState()
    const command = { kind: 'play-blocker' as const, playerId, sourceInstanceId, paymentIds: [], discardHandIds: ['bs12-081-cost'] }
    const after = applyGameCommand(before, command)
    const steps = describeCommandSteps(before, after, command)!
    expect(steps[0].text).toContain('Blocker 代價：棄置手牌')
    expect(steps[0].cards?.map(card => card.instanceId)).toEqual(['bs12-081-cost'])
    expect(steps.at(-1)?.text).toContain('Pudding Cookie')
    expect(JSON.stringify(steps)).not.toContain('bs12-081-deck')
    const commands = (after.commandLog ?? []).slice(before.commandLog?.length ?? 0).map(commandFromLogEntry)
    expect(commands).toEqual([command])
    expect(replayCommands(JSON.parse(JSON.stringify(before)), commands)).toEqual(after)
  })
  it.each([1, 3, 5] as const)('AI pays a real legal hand cost at level %s', level => {
    const original = createBs12PuddingDemoState()
    const before = { ...original, players: { ...original.players, [playerId]: { ...original.players[playerId],
      battleArea: original.players[playerId].battleArea.map((cookie, i) => i === 1 ? { ...cookie, hpCards: cookie.hpCards.slice(0, 1) } : cookie),
    } } }
    const decision = handleAiPendingBattle(before, playerId, level)
    expect(decision?.action).toBe('play-blocker')
    expect(decision?.state.players[playerId].hand).toEqual([])
    expect(decision?.state.players[playerId].discardPile).toEqual([before.players[playerId].hand[0]])
    expect(decision?.state.pendingBattle?.targetInstanceId).toBe(sourceInstanceId)
  })
  it.each(['response', 'item-cost', 'stage-cost', 'trap-cost', 'rested-source'] as const)('pays a legal any-type hand card and preserves source status: %s', scenario => {
    const before = createBs12PuddingDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(getBlockerCandidates(before, playerId).map(c => c.card.instanceId)).toEqual([sourceInstanceId])
    const paid = block(before)
    expect(paid.players[playerId].hand).toEqual([])
    expect(paid.players[playerId].discardPile).toEqual([before.players[playerId].hand[0]])
    expect(paid.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(paid.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(paid.pendingBattle).toMatchObject({ targetInstanceId: sourceInstanceId, stage: 'damage', declaredDamage: 1 })
    const after = finish(paid)
    expect(after.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([1, 4])
    expect(after.players[playerId].battleArea[0].rested).toBe(scenario === 'rested-source')
    expect(hasPendingCardResolution(after)).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it.each(['no-hand', 'wrong-color', 'non-arena', 'split-cost', 'original-target'] as const)('rejects %s without exposing a free Blocker candidate', scenario => {
    const before = createBs12PuddingDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(getBlockerCandidates(before, playerId)).toEqual([])
    expect(() => block(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([[], ['unknown'], ['bs12-081-cost', 'bs12-081-cost'], ['bs12-081-cost', 'bs12-081-cost-two']].map(ids => ({ ids })))('rejects missing, unknown, duplicate or excess hand ids $ids', ({ ids }) => {
    const before = createBs12PuddingDemoState('twice')
    expect(() => block(before, ids)).toThrow()
  })
  it('can block twice within the same turn by paying a different hand card each time', () => {
    const before = createBs12PuddingDemoState('twice')
    const first = finish(block(before))
    const second = applyGameCommand(first, { kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: 'bs12-081-attacker-two',
      targetInstanceId: 'bs12-081-ally', supportPaymentIds: ['bs12-081-attacker-payment-1'] })
    expect(getBlockerCandidates(second, playerId).map(c => c.card.instanceId)).toEqual([sourceInstanceId])
    const after = finish(block(second, ['bs12-081-cost-two']))
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-081-ally'])
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(4)
    expect(after.players[playerId].breakArea.map(c => c.instanceId)).toEqual([sourceInstanceId])
  })
})
