import { describe, expect, it } from 'vitest'
import { createBs12PhotocardDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canPlayItem, playItem } from './card-abilities'
import { takeAiStep } from './ai'
import type { GameState } from './types'
const playerId = 'player-one' as const
const ids = ['bs12-069-payment-0', 'bs12-069-payment-1']
const initial = { kind: 'begin-play-item' as const, playerId, instanceId: 'bs12-069-item', paymentIds: ids }
const open = (state: GameState, paymentIds = ids) => applyGameCommand(state, { ...initial, paymentIds })
const reveal = (state: GameState) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
const confirm = (state: GameState) => applyGameCommand(state, { kind: 'resolve-reveal-top-deck', playerId })
const damage = (state: GameState, targetIds = ['bs12-064-opponent']) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds })
const finish = (state: GameState) => {
  let after = state
  for (let i = 0; after.pendingBattle?.stage === 'damage' && i < 12; i++) after = applyGameCommand(after,
    { kind: 'resolve-next-damage', playerId: after.pendingBattle.damagePlayerId ?? after.pendingBattle.defenderPlayerId })
  return after
}
describe('BS12-069 BB and required actual bottom before independent effect damage', () => {
  it.each(['positive', 'green-arena', 'red-arena', 'yellow-arena', 'target-rested'] as const)('pays BB, publicly confirms the same matching bottom, then deals one: %s', scenario => {
    const before = createBs12PhotocardDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(canPlayItem(before, playerId, initial.instanceId)).toBe(true)
    const paid = open(before)
    expect(paid.players[playerId].hand).toEqual([])
    expect(paid.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(paid.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(paid.players[playerId].discardPile.at(-1)?.id).toBe('BS12-069')
    const shown = reveal(paid)
    expect(shown.pendingRevealTopDeck).toMatchObject({ deckPosition: 'bottom', matched: true, addMatchedToHand: true, revealedCard: before.players[playerId].deck.at(-1) })
    expect(shown.players[playerId].deck).toEqual(before.players[playerId].deck)
    const returned = confirm(shown)
    expect(returned.players[playerId].hand).toEqual(before.players[playerId].deck.slice(-1))
    expect(returned.players[playerId].deck).toEqual(before.players[playerId].deck.slice(0, -1))
    expect(returned.pendingAbilityEffect).toMatchObject({ sourceKind: 'item', sourceCardName: 'Pop Pop Photocard', sourceInstanceId: initial.instanceId })
    expect(returned.players['player-two']).toEqual(before.players['player-two'])
    const after = finish(damage(returned))
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([5, 4])
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(5)
    expect(after.pendingBattle ?? null).toBeNull()
    expect(after.pendingAbilityEffect ?? null).toBeNull()
    expect(before).toEqual(snapshot)
  })
  it.each(['non-arena', 'level-one', 'level-three', 'arena-item', 'top-only'] as const)('retains unmatched bottom and does no damage, while still paying BB: %s', scenario => {
    const before = createBs12PhotocardDemoState(scenario)
    const shown = reveal(open(before))
    expect(shown.pendingRevealTopDeck?.matched).toBe(false)
    const after = confirm(shown)
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(after.pendingAbilityEffect ?? null).toBeNull()
    expect(after.pendingRevealTopDeck ?? null).toBeNull()
  })
  it.each([[], ['bs12-064-opponent-other']].map(targetIds => ({ targetIds })))('target $targetIds preserves the already returned actual bottom', ({ targetIds }) => {
    const before = createBs12PhotocardDemoState()
    const after = finish(damage(confirm(reveal(open(before))), targetIds))
    expect(after.players[playerId].hand).toEqual(before.players[playerId].deck.slice(-1))
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual(targetIds.length ? [6, 3] : [6, 4])
  })
  it.each(['empty-deck', 'no-energy', 'one-energy', 'wrong-energy', 'mixed-energy', 'rested-energy', 'opponent-turn', 'outside-main'] as const)('rejects illegal declaration before any movement: %s', scenario => {
    const before = createBs12PhotocardDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(canPlayItem(before, playerId, initial.instanceId)).toBe(false)
    expect(() => open(before)).toThrow()
    expect(() => playItem(before, playerId, initial.instanceId, ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([[], [ids[0]], [ids[0], ids[0]], [ids[0], 'bs12-069-bottom']].map(paymentIds => ({ paymentIds })))('rejects illegal actual payment $paymentIds atomically', ({ paymentIds }) => {
    const before = createBs12PhotocardDemoState()
    const snapshot = structuredClone(before)
    expect(() => open(before, paymentIds)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([['bs12-064-source'], [ids[0]], ['missing'], ['bs12-064-opponent', 'bs12-064-opponent'], ['bs12-064-opponent', 'bs12-064-opponent-other']].map(targetIds => ({ targetIds })))('rejects illegal damage $targetIds without undoing the bottom return', ({ targetIds }) => {
    const before = confirm(reveal(open(createBs12PhotocardDemoState())))
    const snapshot = structuredClone(before)
    expect(() => damage(before, targetIds)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('refuses a wrong confirmer or a changed actual bottom before returning it', () => {
    const shown = reveal(open(createBs12PhotocardDemoState()))
    expect(() => applyGameCommand(shown, { kind: 'resolve-reveal-top-deck', playerId: 'player-two' })).toThrow()
    const changed = { ...shown, players: { ...shown.players, [playerId]: { ...shown.players[playerId], deck: shown.players[playerId].deck.slice().reverse() } } }
    const snapshot = structuredClone(changed)
    expect(() => confirm(changed)).toThrow()
    expect(changed).toEqual(snapshot)
  })
  it('returns the last bottom, then Refreshes before choosing or causing damage', () => {
    const before = createBs12PhotocardDemoState('short-deck')
    const awaiting = confirm(reveal(open(before)))
    expect(awaiting.players[playerId].hand).toEqual(before.players[playerId].deck)
    expect(awaiting.pendingRefresh).toMatchObject({ playerId, remainingDraws: 0 })
    expect(awaiting.pendingAbilityEffect?.sourceKind).toBe('item')
    expect(() => damage(awaiting)).toThrow()
    const after = applyGameCommand(awaiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-069-refresh-cookie', shuffleSeed: 1 })
    expect(after.players[playerId].deck).toHaveLength(8)
    expect(finish(damage(after)).players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([5, 4])
  })
  it.each(['refresh-defeat', 'no-refresh-cookie'] as const)('ends after actual return but before damage: %s', scenario => {
    const before = createBs12PhotocardDemoState(scenario)
    const returned = confirm(reveal(open(before)))
    const after = scenario === 'refresh-defeat' ? applyGameCommand(returned, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-069-refresh-cookie', shuffleSeed: 1 }) : returned
    expect(after.status).toBe('finished')
    expect(after.result?.winnerId).toBe('player-two')
    expect(after.players[playerId].hand).toEqual(before.players[playerId].deck)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
  })
  it('effect damage faints only the chosen opponent and keeps the other Cookie untouched', () => {
    const after = finish(damage(confirm(reveal(open(createBs12PhotocardDemoState('target-faints'))))))
    expect(after.players['player-two'].breakArea.map(c => c.instanceId)).toContain('bs12-064-opponent')
    expect(after.players['player-two'].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-064-opponent-other'])
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
  })
  it('keeps the effect damage suspended for actual opponent FLIP and resumes after its draw', () => {
    const before = createBs12PhotocardDemoState('flip')
    const flipped = finish(damage(confirm(reveal(open(before)))))
    expect(flipped.pendingBattle?.stage).toBe('flip')
    expect(flipped.pendingBattle?.damagePlayerId ?? flipped.pendingBattle?.defenderPlayerId).toBe('player-two')
    const paid = applyGameCommand(flipped, { kind: 'resolve-flip', playerId: 'player-two', activate: true, discardHandIds: ['bs12-069-flip-cost'] })
    expect(paid.pendingDrawUpTo?.max).toBe(2)
    expect(paid.players['player-two'].deck.at(-1)?.instanceId).toBe('bs12-069-flip-cost')
    const after = finish(applyGameCommand(paid, { kind: 'resolve-draw-up-to', playerId: 'player-two', drawCount: 2 }))
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([5, 4])
    expect(after.pendingBattle ?? null).toBeNull()
    expect(after.pendingAbilityEffect ?? null).toBeNull()
    expect(after.players[playerId].hand).toEqual(before.players[playerId].deck.slice(-1))
  })
  it('AI consumes the real reveal, optional target and damage decisions', () => {
    let state = open(createBs12PhotocardDemoState())
    for (let i = 0; i < 20 && (state.pendingAbilityEffect || state.pendingRevealTopDeck || state.pendingBattle); i++) state = takeAiStep(state, playerId).state
    expect(state.pendingAbilityEffect ?? null).toBeNull()
    expect(state.pendingRevealTopDeck ?? null).toBeNull()
    expect(state.pendingBattle ?? null).toBeNull()
    expect(state.players[playerId].hand[0]?.instanceId).toBe('bs12-069-bottom')
  })
  it('JSON replay preserves the actual item and public bottom receipts on a localhost-only fixture', () => {
    const before = createBs12PhotocardDemoState()
    const commands = [initial, { kind: 'resolve-ability-effect' as const, playerId, targetIds: [] }, { kind: 'resolve-reveal-top-deck' as const, playerId }, { kind: 'resolve-ability-effect' as const, playerId, targetIds: [] }]
    const replayed = JSON.parse(JSON.stringify(commands)).reduce((state: GameState, command: typeof initial) => applyGameCommand(state, command), before)
    expect(replayed.players[playerId].hand[0].instanceId).toBe('bs12-069-bottom')
    expect(replayed.commandLog.some((entry: NonNullable<GameState['commandLog']>[number]) => entry.card?.id === 'BS12-069')).toBe(true)
    expect(parseTestStateConfig('?test-state=bs12-069:positive', 'localhost')).toEqual({ kind: 'bs12-069', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-069:positive', 'example.com')).toBeNull()
  })
  it.each(['positive', 'green-arena', 'red-arena', 'yellow-arena', 'non-arena', 'level-one', 'level-three', 'arena-item', 'top-only', 'short-deck', 'refresh-defeat', 'no-refresh-cookie', 'empty-deck', 'no-energy', 'one-energy', 'wrong-energy', 'mixed-energy', 'rested-energy', 'opponent-turn', 'outside-main', 'target-faints', 'target-rested', 'flip'] as const)('has legal fixture capacity: %s', scenario => {
    const state = createBs12PhotocardDemoState(scenario)
    for (const player of Object.values(state.players)) {
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      expect(player.breakArea.reduce((sum, card) => sum + card.level, 0)).toBeLessThan(10)
      const cards = [...player.hand, ...player.deck, ...player.discardPile, ...player.breakArea, ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
      for (const count of Object.values(cards.reduce<Record<string, number>>((counts, card) => ({ ...counts, [card.id]: (counts[card.id] ?? 0) + 1 }), {}))) expect(count).toBeLessThanOrEqual(4)
    }
  })
})
