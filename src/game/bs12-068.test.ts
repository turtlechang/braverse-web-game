import { describe, expect, it } from 'vitest'
import { createBs12MultivitaminDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canPlayItem } from './card-abilities'
import { executeCardEffect, getEffectSelectionCandidates, isEffectConditionMet } from './effects'
import { compileEffectDecisionDescriptor } from './decision-descriptor-compiler'
import { takeAiStep } from './ai'
import type { GameState } from './types'

const playerId = 'player-one' as const
const initial = { kind: 'begin-play-item' as const, playerId, instanceId: 'bs12-068-item', paymentIds: ['bs12-068-payment'] }
const open = (state: GameState, paymentIds = initial.paymentIds) => applyGameCommand(state, { ...initial, paymentIds })
const draw = (state: GameState, drawCount: number) => applyGameCommand(applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds: [] }), { kind: 'resolve-draw-up-to', playerId, drawCount })
const finish = (state: GameState, targetIds: string[]) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds })
const context = { sourcePlayerId: playerId, sourceInstanceId: initial.instanceId }

describe('BS12-068 optional draw before conditional opponent support return', () => {
  it.each([0, 1])('pays B and discards the actual item before choosing draw %s, without moving any support', count => {
    const before = createBs12MultivitaminDemoState()
    const snapshot = structuredClone(before)
    const paid = open(before)
    expect(paid.players[playerId].supportArea[0].rested).toBe(true)
    expect(paid.players[playerId].hand).toEqual([])
    expect(paid.players[playerId].discardPile.at(-1)?.instanceId).toBe(initial.instanceId)
    expect(paid.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(paid.players['player-two']).toEqual(before.players['player-two'])
    const after = draw(paid, count)
    expect(after.players[playerId].hand).toEqual(before.players[playerId].deck.slice(0, count))
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(count))
    expect(after.pendingAbilityEffect?.effectIndex).toBe(1)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(before).toEqual(snapshot)
  })
  it.each([0, 1, 2])('returns exactly %s opponent support cards to the opponent, with state stripped and no HP changes', count => {
    const before = createBs12MultivitaminDemoState()
    const ready = draw(open(before), 0)
    const selected = before.players['player-two'].supportArea.slice(0, count)
    const after = finish(ready, selected.map(support => support.card.instanceId))
    expect(after.players['player-two'].hand).toEqual(selected.map(support => support.card))
    expect(after.players['player-two'].supportArea).toEqual(before.players['player-two'].supportArea.slice(count))
    expect(after.players[playerId]).toEqual(ready.players[playerId])
    expect(after.players['player-two'].battleArea).toEqual(before.players['player-two'].battleArea)
    expect(after.pendingAbilityEffect ?? null).toBeNull()
    expect(after.supportAreaDecreasedThisTurn?.['player-two'] ?? false).toBe(count > 0)
    expect(after.supportAreaDecreasedThisTurn?.[playerId] ?? false).toBe(false)
    const log = after.commandLog!.at(-1)!.steps!
    expect(log.map(step => step.text).join(' ')).toContain(count === 0 ? '選擇 0 張' : `對手 ${count} 張支援卡返回對手手牌`)
    expect(log.flatMap(step => step.cards ?? []).map(card => card.instanceId)).toEqual(selected.map(support => support.card.instanceId))
  })
  it.each(['difference-one', 'equal-support', 'more-own'] as const)('keeps unconditional draw result and already paid B when Then condition is false: %s', scenario => {
    const before = createBs12MultivitaminDemoState(scenario)
    expect(canPlayItem(before, playerId, initial.instanceId)).toBe(true)
    const ready = draw(open(before), 1)
    expect(isEffectConditionMet(ready, context, ready.pendingAbilityEffect!.effects[1])).toBe(false)
    const after = finish(ready, [])
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(after.players[playerId].hand).toHaveLength(1)
    expect(after.players[playerId].supportArea[0].rested).toBe(true)
    expect(after.commandLog!.at(-1)!.steps!.map(step => step.text).join(' ')).toContain('條件不成立')
  })
  it.each(['positive', 'large-gap', 'all-opponent-rested', 'non-cookie-support'] as const)('uses all support cards in the count and candidates, irrespective of color, type or REST: %s', scenario => {
    const ready = draw(open(createBs12MultivitaminDemoState(scenario)), 0)
    const effect = ready.pendingAbilityEffect!.effects[1]
    expect(isEffectConditionMet(ready, context, effect)).toBe(true)
    expect(getEffectSelectionCandidates(ready, context, effect)).toEqual(ready.players['player-two'].supportArea.map(support => support.card))
    const chosen = ready.players['player-two'].supportArea.at(-1)!.card
    expect(finish(ready, [chosen.instanceId]).players['player-two'].hand).toEqual([chosen])
  })
  it('counts the source B after payment as a support card instead of counting only active cards', () => {
    const ready = draw(open(createBs12MultivitaminDemoState('difference-one')), 0)
    expect(ready.players[playerId].supportArea[0].rested).toBe(true)
    expect(isEffectConditionMet(ready, context, ready.pendingAbilityEffect!.effects[1])).toBe(false)
  })
  it.each([['bs12-068-payment'], ['bs12-064-opponent'], ['unknown'], ['bs12-068-opponent-support-0', 'bs12-068-opponent-support-0'], ['bs12-068-opponent-support-0', 'bs12-068-opponent-support-1', 'bs12-068-opponent-support-2']].map(ids => ({ ids })))('rejects wrong-area, unknown, duplicate or too many cards $ids atomically', ({ ids }) => {
    const ready = draw(open(createBs12MultivitaminDemoState()), 0)
    const snapshot = structuredClone(ready)
    expect(() => finish(ready, ids)).toThrow()
    expect(ready).toEqual(snapshot)
  })
  it.each(['no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn', 'outside-main'] as const)('rejects illegal declaration %s before B or item moves', scenario => {
    const before = createBs12MultivitaminDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(canPlayItem(before, playerId, initial.instanceId)).toBe(false)
    expect(() => open(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([[], ['unknown'], ['bs12-068-opponent-support-0'], ['bs12-068-payment', 'bs12-068-payment']].map(ids => ({ ids })))('rejects illegal payment $ids atomically', ({ ids }) => {
    const before = createBs12MultivitaminDemoState()
    const snapshot = structuredClone(before)
    expect(() => open(before, ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('rejects selecting the Then before the draw choice or using the wrong player', () => {
    const pendingDraw = applyGameCommand(open(createBs12MultivitaminDemoState()), { kind: 'resolve-ability-effect', playerId, targetIds: [] })
    expect(() => finish(pendingDraw, ['bs12-068-opponent-support-0'])).toThrow()
    const ready = draw(open(createBs12MultivitaminDemoState()), 0)
    expect(() => applyGameCommand(ready, { kind: 'resolve-ability-effect', playerId: 'player-two', targetIds: [] })).toThrow()
  })
  it('rechecks current support counts when the Then is confirmed', () => {
    const ready = draw(open(createBs12MultivitaminDemoState()), 0)
    const changed = { ...ready, players: { ...ready.players, 'player-two': { ...ready.players['player-two'], supportArea: ready.players['player-two'].supportArea.slice(0, 2) } } }
    expect(finish(changed, []).players['player-two'].supportArea).toHaveLength(2)
    expect(finish(changed, []).players['player-two'].hand).toEqual([])
  })
  it('retains a conditional item continuation that becomes active only after the preceding draw', () => {
    const before = createBs12MultivitaminDemoState()
    const bounce = before.players[playerId].hand[0].item!.effects[1]
    if (bounce.kind !== 'support-to-hand') throw new Error('Missing support continuation')
    bounce.condition = { kind: 'hand-count-at-least', count: 1 }
    const ready = draw(open(before), 1)
    expect(ready.pendingAbilityEffect?.effectIndex).toBe(1)
    expect(finish(ready, ['bs12-068-opponent-support-0']).players['player-two'].hand).toHaveLength(1)
  })
  it('refreshes after the last draw, then resumes opponent support return without further draws', () => {
    const before = createBs12MultivitaminDemoState('short-deck')
    const pending = draw(open(before), 1)
    expect(pending.pendingRefresh).toMatchObject({ playerId, remainingDraws: 0 })
    expect(pending.players[playerId].hand).toEqual(before.players[playerId].deck)
    expect(pending.players['player-two']).toEqual(before.players['player-two'])
    const refreshed = applyGameCommand(pending, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-068-refresh-cookie', shuffleSeed: 12 })
    expect(refreshed.pendingAbilityEffect?.effectIndex).toBe(1)
    expect(refreshed.players[playerId].hand).toHaveLength(1)
    expect(refreshed.players[playerId].deck).toHaveLength(8)
    expect(finish(refreshed, ['bs12-068-opponent-support-1']).players['player-two'].hand).toHaveLength(1)
  })
  it('ends at Refresh LV10 before any opponent support returns', () => {
    const before = createBs12MultivitaminDemoState('refresh-defeat')
    const pending = draw(open(before), 1)
    const after = applyGameCommand(pending, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-068-refresh-cookie', shuffleSeed: 12 })
    expect(after.status).toBe('finished')
    expect(after.result?.winnerId).toBe('player-two')
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(after.players[playerId].hand).toHaveLength(1)
  })
  it('defeats after the last draw when no legal Refresh Cookie exists, without returning supports', () => {
    const before = createBs12MultivitaminDemoState('no-refresh-cookie')
    const after = draw(open(before), 1)
    expect(after.status).toBe('finished')
    expect(after.result?.reason).toBe('refresh-unavailable')
    expect(after.players['player-two']).toEqual(before.players['player-two'])
  })
  it('allows drawing zero with an empty deck, refreshes first and still returns opponent support', () => {
    const before = createBs12MultivitaminDemoState('empty-deck')
    expect(canPlayItem(before, playerId, initial.instanceId)).toBe(true)
    const ready = draw(open(before), 0)
    expect(ready.pendingRefresh).toMatchObject({ playerId, remainingDraws: 0 })
    expect(ready.players[playerId].hand).toEqual([])
    const refreshed = applyGameCommand(ready, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-068-refresh-cookie', shuffleSeed: 12 })
    expect(refreshed.players[playerId].hand).toEqual([])
    expect(finish(refreshed, ['bs12-068-opponent-support-0']).players['player-two'].hand).toHaveLength(1)
  })
  it('can select one with an empty deck, completes Refresh and the requested draw before the Then', () => {
    const pending = draw(open(createBs12MultivitaminDemoState('empty-deck')), 1)
    expect(pending.pendingRefresh).toMatchObject({ playerId, remainingDraws: 1 })
    expect(pending.players[playerId].hand).toEqual([])
    const refreshed = applyGameCommand(pending, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-068-refresh-cookie', shuffleSeed: 12 })
    expect(refreshed.players[playerId].hand).toHaveLength(1)
    expect(refreshed.players[playerId].deck).toHaveLength(7)
    expect(finish(refreshed, ['bs12-068-opponent-support-0']).players['player-two'].hand).toHaveLength(1)
  })
  it('preserves self support return when side is absent', () => {
    const before = createBs12MultivitaminDemoState()
    const after = executeCardEffect(before, context, { kind: 'support-to-hand', amount: 1 }, ['bs12-068-payment'])
    expect(after.players[playerId].hand.at(-1)?.instanceId).toBe('bs12-068-payment')
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(after.supportAreaDecreasedThisTurn?.[playerId]).toBe(true)
  })
  it('compiles only opponent support candidates for the public zero to two choice', () => {
    const ready = draw(open(createBs12MultivitaminDemoState()), 0)
    const card = ready.players[playerId].discardPile.at(-1)!
    const descriptor = compileEffectDecisionDescriptor({ state: ready, playerId, sourcePlayerId: playerId, sourceInstanceId: card.instanceId, sourceCardName: card.name,
      context, cost: {}, effect: ready.pendingAbilityEffect!.effects[1], viewerPlayerId: playerId })
    expect(JSON.stringify(descriptor)).toContain('bs12-068-opponent-support-0')
    expect(JSON.stringify(descriptor)).not.toContain('bs12-068-payment')
  })
  it('AI resolves draw and opponent-only support selections from the same public pending rules', () => {
    let state = open(createBs12MultivitaminDemoState())
    for (let i = 0; i < 8 && (state.pendingAbilityEffect || state.pendingDrawUpTo || state.pendingRefresh); i++) state = takeAiStep(state, playerId).state
    expect(state.pendingAbilityEffect ?? null).toBeNull()
    expect(state.pendingDrawUpTo ?? null).toBeNull()
    expect(state.players[playerId].supportArea).toHaveLength(1)
    expect(state.players['player-two'].hand.length).toBeLessThanOrEqual(2)
    expect(state.players['player-two'].hand.length + state.players['player-two'].supportArea.length).toBe(3)
  })
  it('replays the JSON commands with actual card receipts and keeps the fixture local', () => {
    const opened = open(createBs12MultivitaminDemoState())
    const replayed = finish(draw(JSON.parse(JSON.stringify(opened)), 1), ['bs12-068-opponent-support-0'])
    expect(replayed).toEqual(finish(draw(opened, 1), ['bs12-068-opponent-support-0']))
    expect(JSON.parse(JSON.stringify(replayed)).players['player-two'].hand[0].instanceId).toBe('bs12-068-opponent-support-0')
    expect(replayed.commandLog!.find(entry => entry.card?.id === 'BS12-068')).toBeDefined()
    expect(parseTestStateConfig('?test-state=bs12-068:positive', 'localhost')).toEqual({ kind: 'bs12-068', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-068:positive', 'example.com')).toBeNull()
  })
  it.each(['positive', 'difference-one', 'equal-support', 'more-own', 'large-gap', 'all-opponent-rested', 'non-cookie-support', 'no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn', 'outside-main', 'short-deck', 'refresh-defeat', 'empty-deck', 'no-refresh-cookie'] as const)('keeps legal battle/copy/Break capacity: %s', scenario => {
    const state = createBs12MultivitaminDemoState(scenario)
    for (const player of Object.values(state.players)) {
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      expect(player.breakArea.reduce((sum, card) => sum + (card.type === 'cookie' ? card.level : 0), 0)).toBeLessThan(10)
      const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea, ...player.supportArea.map(support => support.card), ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards])]
      for (const card of cards) expect(cards.filter(other => other.id.split('@')[0] === card.id.split('@')[0]).length).toBeLessThanOrEqual(4)
    }
  })
})
