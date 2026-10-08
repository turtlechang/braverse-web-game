import { describe, expect, it } from 'vitest'
import { BS12_BLACK_SAPPHIRE_SCENARIOS, createBs12BlackSapphireDemoState, parseTestStateConfig } from './demo'
import type { Bs12BlackSapphireScenario } from './demo'
import { applyGameCommand } from './commands'
import { getBlockerCandidates } from './battle'
import { getFaintTriggeredCost } from './skills'
import { executeCardEffect } from './effects'
import type { GameState } from './types'
import { describeCommandSteps } from './command-log'
import { hasPendingCardResolution } from './pending'
import { commandFromLogEntry, replayCommands } from './replay'
import { handleAiPendingDecision } from './ai/pending-handler'
import { extractCardCapabilities } from './ai/strategy/capability-extractor'

const playerId = 'player-one' as const
const sourceInstanceId = 'bs12-088-source'
const initial = (scenario: Bs12BlackSapphireScenario = 'response', number: 'BS12-088' | 'BS12-088@1' = 'BS12-088') => createBs12BlackSapphireDemoState(number, scenario)
const block = (state: GameState, discardHandIds = ['bs12-088-block-cost']) => applyGameCommand(state, { kind: 'play-blocker', playerId, sourceInstanceId, paymentIds: [], discardHandIds })
const damage = (state: GameState) => {
  let next=state
  for(let hit=0;hit<3&&next.pendingBattle?.stage==='damage';hit++)next=applyGameCommand(next,{kind:'resolve-next-damage',playerId})
  return next
}
const faint = (scenario: Bs12BlackSapphireScenario = 'faint') => damage(block(initial(scenario)))
const payFaint = (state: GameState, discardHandIds = ['bs12-088-faint-cost']) => applyGameCommand(state, { kind: 'resolve-faint-effect', playerId, targetIds: [], discardHandIds })

describe('088 independent Blocker and faint payment', () => {
  it('uses any-color Arena cost for faint instead of the purple Blocker cost', () => {
    const before = initial('faint')
    expect(getFaintTriggeredCost(before.players[playerId].battleArea[0].card.skill!)).toEqual({ discardHand: 1, discardHandKeyword: 'arena' })
  })
  it('normal Blocker damage queues only the independent faint draw after moving source to Break', () => {
    const after = faint()
    expect(after.players[playerId].breakArea.map(card => card.instanceId)).toContain(sourceInstanceId)
    expect(after.pendingFaintEffects).toHaveLength(1)
    expect(after.pendingFaintEffects?.[0]).toMatchObject({ sourcePlayerId: playerId, sourceInstanceId, sourceCardName: 'Black Sapphire Cookie',
      effect: { kind: 'draw-up-to', max: 2 }, cost: { discardHand: 1, discardHandKeyword: 'arena' } })
    expect(after.pendingFaintEffects?.[0].cost?.discardHandColor).toBeUndefined()
  })
  it('effect damage and direct faint also queue the independent clause, not another redirect', () => {
    for (const effect of [{ kind: 'damage' as const, amount: 3, target: { side: 'self' as const, min: 1, max: 1 } },
      { kind: 'make-faint' as const, target: { side: 'self' as const, min: 1, max: 1 } }]) {
      const before = initial('attack')
      const after = executeCardEffect(before, { sourcePlayerId: playerId, sourceInstanceId: 'bs12-088-effect-origin' }, effect, [sourceInstanceId])
      expect(after.pendingFaintEffects?.map(faint => faint.effect)).toEqual([{ kind: 'draw-up-to', max: 2 }])
    }
  })
  it('pays a separate yellow Arena card before offering the draw, with no second Blocker redirect', () => {
    const before = faint()
    const after = payFaint(before)
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].discardPile.map(card => card.instanceId)).toContain('bs12-088-faint-cost')
    expect(after.pendingDrawUpTo).toMatchObject({ playerId, sourceInstanceId, max: 2 })
  })
  it.each(['response', 'item-cost', 'stage-cost', 'trap-cost', 'rested-source'] as const)('pays an any-type purple Arena hand card before redirect: %s', scenario => {
    const before = initial(scenario)
    const snapshot = structuredClone(before)
    expect(getBlockerCandidates(before, playerId).map(cookie => cookie.card.instanceId)).toEqual([sourceInstanceId])
    const paid = block(before)
    expect(paid.players[playerId].hand.map(card => card.instanceId)).toEqual(['bs12-088-faint-cost'])
    expect(paid.players[playerId].discardPile).toEqual([before.players[playerId].hand[0]])
    expect(paid.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(paid.pendingFaintEffects).toEqual(before.pendingFaintEffects)
    const after = damage(paid)
    expect(after.players[playerId].battleArea.map(cookie => cookie.hpCards.length)).toEqual([2, 4])
    expect(after.players[playerId].battleArea[0].rested).toBe(scenario === 'rested-source')
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(before).toEqual(snapshot)
  })
  it.each(['wrong-color', 'non-arena', 'split-cost', 'no-hand'] as const)('requires the color and keyword on the same hand card: %s', scenario => {
    const before = initial(scenario)
    const snapshot = structuredClone(before)
    expect(getBlockerCandidates(before, playerId)).toEqual([])
    expect(() => block(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([[], ['unknown'], ['bs12-088-block-cost', 'bs12-088-block-cost'], ['bs12-088-block-cost', 'bs12-088-block-cost-two']].map(ids => ({ ids })))(
    'rejects invalid Blocker hand ids $ids', ({ ids }) => expect(() => block(initial('twice'), ids)).toThrow(),
  )
  it.each([0, 1, 2])('pays the faint cost even when choosing to draw %s', drawCount => {
    const before = faint()
    const paid = payFaint(before)
    const after = applyGameCommand(paid, { kind: 'resolve-draw-up-to', playerId, drawCount })
    expect(after.players[playerId].hand).toEqual(before.players[playerId].deck.slice(0, drawCount))
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(drawCount))
    expect(after.players[playerId].discardPile).toEqual([...before.players[playerId].discardPile, before.players[playerId].hand[0]])
    expect(after.pendingFaintEffects).toBeUndefined()
    expect(after.pendingDrawUpTo).toBeNull()
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.players[playerId].battleArea.map(cookie => cookie.hpCards.length)).toEqual([4])
  })
  it.each(['faint-red-item', 'faint-purple-trap'] as const)('faint accepts an Arena card of another type or color: %s', scenario => {
    const after = payFaint(faint(scenario))
    expect(after.pendingDrawUpTo?.max).toBe(2)
    expect(after.players[playerId].hand).toEqual([])
  })
  it('declining the faint cost keeps the remaining hand and never offers a draw', () => {
    const before = faint()
    const after = payFaint(before, [])
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
    expect(after.players[playerId].discardPile).toEqual(before.players[playerId].discardPile)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.pendingFaintEffects).toBeUndefined()
    expect(after.pendingDrawUpTo).toBeFalsy()
  })
  it.each(['only-block-cost', 'no-faint-cost'] as const)('cannot reuse the paid Blocker card or a non-Arena hand card for faint: %s', scenario => {
    const before = faint(scenario)
    const snapshot = structuredClone(before)
    expect(() => payFaint(before, [scenario === 'only-block-cost' ? 'bs12-088-block-cost' : 'bs12-088-faint-cost'])).toThrow()
    expect(before).toEqual(snapshot)
    const after = payFaint(before, [])
    expect(after.pendingDrawUpTo).toBeFalsy()
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
  })
  it.each([['unknown'], ['bs12-088-faint-cost', 'bs12-088-faint-cost'], ['bs12-088-faint-cost', 'bs12-088-block-cost']].map(ids => ({ ids })))(
    'rejects invalid faint cost $ids without changing input', ({ ids }) => {
      const before = faint()
      const snapshot = structuredClone(before)
      expect(() => payFaint(before, ids)).toThrow()
      expect(before).toEqual(snapshot)
    },
  )
  it('records and replays two distinct payments using the departed true source', () => {
    const before = initial('faint')
    const damaged = damage(block(before))
    const command = { kind: 'resolve-faint-effect' as const, playerId, targetIds: [], discardHandIds: ['bs12-088-faint-cost'] }
    const paid = applyGameCommand(damaged, command)
    expect(JSON.stringify(describeCommandSteps(damaged, paid, command))).toContain('Black Sapphire Cookie')
    const commands = (paid.commandLog ?? []).slice(before.commandLog?.length ?? 0).map(commandFromLogEntry)
    expect(commands.map(command => command.kind)).toEqual(['play-blocker', 'resolve-next-damage', 'resolve-next-damage', 'resolve-next-damage', 'resolve-faint-effect'])
    expect(replayCommands(JSON.parse(JSON.stringify(before)), commands)).toEqual(paid)
  })
  it('keeps Blocker and faint capability timing and payments separate', () => {
    const card = initial().players[playerId].battleArea[0].card
    expect(extractCardCapabilities(card).capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'block', timing: 'block', cost: { energy: {}, discardHand: 1, discardHandColor: 'purple', discardHandKeyword: 'arena' } }),
      expect.objectContaining({ kind: 'draw', timing: 'faint', effectKind: 'draw-up-to', cost: { energy: {}, discardHand: 1, discardHandKeyword: 'arena' } }),
    ]))
  })
  it('AI pays the new any-color faint cost rather than trying the Blocker clause again', () => {
    const before = faint()
    const decision = handleAiPendingDecision(before, playerId)
    expect(decision?.state.pendingDrawUpTo?.max).toBe(2)
    expect(decision?.state.players[playerId].hand).toEqual([])
  })
  it('draw crossing a short deck Refresh keeps the already paid faint cost and remaining draw', () => {
    const paid = payFaint(faint('short-deck'))
    const refreshing = applyGameCommand(paid, { kind: 'resolve-draw-up-to', playerId, drawCount: 2 })
    expect(refreshing.pendingRefresh).toMatchObject({ playerId, remainingDraws: 1 })
    expect(refreshing.players[playerId].hand).toHaveLength(1)
    const after = applyGameCommand(refreshing, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-088-block-cost', shuffleSeed: 88 })
    expect(after.players[playerId].hand).toHaveLength(2)
    expect(after.players[playerId].deck).toHaveLength(3)
    expect(after.players[playerId].discardPile).toEqual([])
    expect(after.players[playerId].breakArea.map(card => card.instanceId)).toEqual([sourceInstanceId, 'bs12-088-block-cost'])
    expect(after.pendingDrawUpTo).toBeFalsy()
  })
  it('LV10 faint ends the battle before paying the independent faint cost', () => {
    const after = faint('lv10-defeat')
    expect(after.result?.winnerId).toBe('player-two')
    expect(after.players[playerId].hand.map(card => card.instanceId)).toEqual(['bs12-088-faint-cost'])
    expect(after.pendingFaintEffects?.length ?? 0).toBe(0)
    expect(after.pendingDrawUpTo).toBeFalsy()
  })
  it('waits for the last HP FLIP before faint, then queues the independent cost when skipped', () => {
    const revealed = damage(block(initial('last-hp-flip')))
    expect(revealed.pendingBattle?.stage).toBe('flip')
    expect(revealed.players[playerId].battleArea[0].card.instanceId).toBe(sourceInstanceId)
    expect(revealed.players[playerId].breakArea).toEqual([])
    expect(revealed.pendingFaintEffects).toBeUndefined()
    const after = applyGameCommand(revealed, { kind: 'resolve-flip', playerId, activate: false })
    expect(after.players[playerId].breakArea.map(card => card.instanceId)).toEqual([sourceInstanceId])
    expect(after.pendingFaintEffects?.[0]).toMatchObject({ effect: { kind: 'draw-up-to', max: 2 }, cost: { discardHand: 1, discardHandKeyword: 'arena' } })
    expect(after.players[playerId].hand.map(card => card.instanceId)).toEqual(['bs12-088-faint-cost'])
  })
  it('a paid last HP FLIP can rescue Black Sapphire before its faint clause triggers', () => {
    const revealed = damage(block(initial('last-hp-flip')))
    const after = applyGameCommand(revealed, { kind: 'resolve-flip', playerId, activate: true, discardHandIds: ['bs12-088-faint-cost'], targetIds: [sourceInstanceId] })
    expect(after.players[playerId].battleArea.map(cookie => cookie.hpCards.length)).toEqual([1, 4])
    expect(after.players[playerId].breakArea).toEqual([])
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].deck).toHaveLength(11)
    expect(after.pendingFaintEffects).toBeUndefined()
    expect(after.pendingDrawUpTo).toBeFalsy()
  })
  it('refreshes before drawing from an empty deck after paying the faint cost', () => {
    const paid = payFaint(faint('empty-deck'))
    const refreshing = applyGameCommand(paid, { kind: 'resolve-draw-up-to', playerId, drawCount: 2 })
    expect(refreshing.pendingRefresh).toMatchObject({ playerId, remainingDraws: 2 })
    expect(refreshing.players[playerId].hand).toEqual([])
    const after = applyGameCommand(refreshing, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-088-block-cost', shuffleSeed: 88 })
    expect(after.players[playerId].hand).toHaveLength(2)
    expect(after.players[playerId].deck).toHaveLength(2)
    expect(after.players[playerId].discardPile).toEqual([])
  })
  it('healing the other Arena Cookie does not rescue Black Sapphire or reuse the FLIP cost', () => {
    const revealed = damage(block(initial('last-hp-flip')))
    const after = applyGameCommand(revealed, { kind: 'resolve-flip', playerId, activate: true, discardHandIds: ['bs12-088-faint-cost'], targetIds: ['bs12-088-ally'] })
    expect(after.players[playerId].battleArea.map(cookie => cookie.hpCards.length)).toEqual([5])
    expect(after.players[playerId].breakArea.map(card => card.instanceId)).toEqual([sourceInstanceId])
    expect(after.players[playerId].hand).toEqual([])
    expect(after.pendingFaintEffects?.[0]).toMatchObject({ effect: { kind: 'draw-up-to', max: 2 } })
    expect(() => payFaint(after)).toThrow()
    expect(payFaint(after, []).pendingDrawUpTo).toBeFalsy()
  })
  it.each([-1, 3])('rejects draw count %s without consuming the pending draw', drawCount => {
    const before = payFaint(faint())
    const snapshot = structuredClone(before)
    expect(() => applyGameCommand(before, { kind: 'resolve-draw-up-to', playerId, drawCount })).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('rejects the other player at both independent faint decisions', () => {
    const before = faint()
    expect(() => applyGameCommand(before, { kind: 'resolve-faint-effect', playerId: 'player-two', targetIds: [], discardHandIds: ['bs12-088-faint-cost'] })).toThrow()
    const paid = payFaint(before)
    expect(() => applyGameCommand(paid, { kind: 'resolve-draw-up-to', playerId: 'player-two', drawCount: 2 })).toThrow()
  })
  it('Refresh LV10 stops the remaining draw after both real hand costs', () => {
    const paid = payFaint(faint('refresh-defeat'))
    const refreshing = applyGameCommand(paid, { kind: 'resolve-draw-up-to', playerId, drawCount: 2 })
    const after = applyGameCommand(refreshing, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-088-block-cost', shuffleSeed: 88 })
    expect(after.result?.winnerId).toBe('player-two')
    expect(after.players[playerId].hand).toHaveLength(1)
    expect(after.players[playerId].deck.map(card => card.instanceId)).toContain('bs12-088-faint-cost')
    expect(after.pendingDrawUpTo).toBeFalsy()
  })
  it('deploys with three real HP and does not trigger either independent clause', () => {
    const before = initial('deploy')
    const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: sourceInstanceId })
    expect(after.players[playerId].battleArea[1].hpCards).toEqual(before.players[playerId].deck.slice(0, 3))
    expect(after.players[playerId].deck).toHaveLength(9)
    expect(after.pendingOnPlay).toBeNull()
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it('ordinary PN attack deals one without hand costs or faint draw', () => {
    const before = initial('attack')
    const after = applyGameCommand(before, { kind: 'attack', playerId, attackerInstanceId: sourceInstanceId, targetInstanceId: 'bs12-088-attacker', supportPaymentIds: ['bs12-088-payment-0', 'bs12-088-payment-1'] })
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
    expect(after.players[playerId].battleArea[0].rested).toBe(true)
    expect(after.players[playerId].supportArea.map(support => support.rested)).toEqual([true, true, false])
    expect(after.players[playerId].discardPile).toEqual([])
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it.each(['wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main'] as const)('blocks illegal ordinary attack: %s', scenario => {
    const before = initial(scenario)
    const snapshot = structuredClone(before)
    expect(() => applyGameCommand(before, { kind: 'attack', playerId, attackerInstanceId: sourceInstanceId, targetInstanceId: 'bs12-088-attacker', supportPaymentIds: before.players[playerId].supportArea.slice(0, 2).map(support => support.card.instanceId) })).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each(['BS12-088', 'BS12-088@1'] as const)('can pay a new Blocker cost twice in one turn with %s', number => {
    const first = damage(block(initial('twice', number)))
    const second = applyGameCommand(first, { kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: 'bs12-088-attacker-two', targetInstanceId: 'bs12-088-ally', supportPaymentIds: ['bs12-088-attack-payment-1'] })
    const after = damage(block(second, ['bs12-088-block-cost-two']))
    expect(after.players[playerId].battleArea.map(cookie => cookie.hpCards.length)).toEqual([1, 4])
    expect(after.players[playerId].hand.map(card => card.instanceId)).toEqual(['bs12-088-faint-cost'])
  })
  it.each((['BS12-088', 'BS12-088@1'] as const).flatMap(number => BS12_BLACK_SAPPHIRE_SCENARIOS.map(scenario => ({ number, scenario }))))('keeps printed identity, field capacity and four-copy limits: $number $scenario', ({ number, scenario }) => {
    const before = initial(scenario, number)
    for (const player of Object.values(before.players)) {
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      const cards = [...player.hand, ...player.deck, ...player.discardPile, ...player.breakArea, ...player.supportArea.map(support => support.card), ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]), ...(player.stage ? [player.stage.card] : [])]
      const counts = new Map<string, number>()
      for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
      expect([...counts.values()].every(count => count <= 4)).toBe(true)
      expect(new Set(cards.map(card => card.instanceId)).size).toBe(cards.length)
    }
    expect(parseTestStateConfig(`?test-state=bs12-088:${number}:${scenario}`, 'localhost')).toEqual({ kind: 'bs12-088', cardNumber: number, scenario })
    expect(parseTestStateConfig(`?test-state=bs12-088:${number}:${scenario}`, 'example.com')).toBeNull()
  })
})
