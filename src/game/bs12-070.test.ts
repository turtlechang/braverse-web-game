import { describe, expect, it } from 'vitest'
import { createBs12StardustDemoState as createStardust, parseTestStateConfig, type Bs12StardustScenario } from './demo'
import { applyGameCommand } from './commands'
import type { GameState } from './types'
import { getEffectSelectionCandidates } from './effects'
import { takeAiStep } from './ai'
const playerId = 'player-one' as const
const finish = (state: GameState) => {
  let after = state
  for (let i = 0; after.pendingBattle?.stage === 'damage' && i < 16; i++) after = applyGameCommand(after, { kind: 'resolve-next-damage', playerId: after.pendingBattle.damagePlayerId ?? after.pendingBattle.defenderPlayerId })
  return after
}
const attack = (state: GameState) => finish(applyGameCommand(applyGameCommand(state, { kind: 'declare-attack', playerId, attackerInstanceId: 'bs12-070-source', targetInstanceId: 'bs12-064-opponent', supportPaymentIds: ['bs12-069-payment-0', 'bs12-069-payment-1'] }), { kind: 'skip-trap', playerId: 'player-two' }))
const then = (state: GameState) => applyGameCommand(state, { kind: 'resolve-attack-effect', playerId, targetIds: [] })
const pay = (state: GameState) => applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId, action: 'pay', paymentIds: [], targetIds: [] })
const confirm = (state: GameState) => applyGameCommand(state, { kind: 'resolve-reveal-top-deck', playerId })
const damage = (state: GameState, targetIds = ['bs12-064-opponent', 'bs12-064-opponent-other']) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds })
describe.each(['BS12-070', 'BS12-070@1'] as const)('%s bottom reveal attack continuation', number => {
  const createBs12StardustDemoState = (scenario: Bs12StardustScenario = 'positive') => createStardust(scenario, number)
  it('keeps the original attack suspended until public bottom confirmation and all damage finish', () => {
    const before = createBs12StardustDemoState()
    const ordinary = attack(before)
    expect(ordinary.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([4, 4])
    const offered = then(ordinary)
    expect(offered.pendingOptionalCostAttack?.effects[0].kind).toBe('reveal-bottom-deck')
    const shown = pay(offered)
    expect(shown.pendingRevealTopDeck).toMatchObject({ deckPosition: 'bottom', matched: true, battleContinuation: 'attack-effect' })
    expect(shown.pendingBattle?.stage).toBe('attack-effect')
    const returned = confirm(shown)
    expect(returned.pendingAbilityEffect).toMatchObject({ sourceKind: 'skill', sourceInstanceId: 'bs12-070-source', sourceCardName: 'Stardust Cookie', battleContinuation: 'attack-effect' })
    const after = finish(damage(returned))
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3, 3])
    expect(after.players[playerId].hand).toEqual(before.players[playerId].deck.slice(-1))
    expect(after.pendingBattle ?? null).toBeNull()
    expect(after.pendingAbilityEffect ?? null).toBeNull()
  })
  it.each(['positive', 'green-arena', 'red-arena', 'yellow-arena', 'target-rested'] as const)('returns every color matching bottom and damages the complete opponent set: %s', scenario => {
    const before = createBs12StardustDemoState(scenario)
    const snapshot = structuredClone(before)
    const ordinary = attack(before)
    expect(ordinary.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(ordinary.players[playerId].battleArea[0].rested).toBe(true)
    const after = finish(damage(confirm(pay(then(ordinary)))))
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3, 3])
    expect(after.players[playerId].hand).toEqual(before.players[playerId].deck.slice(-1))
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(0, -1))
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(2)
    expect(after.players[playerId].discardPile).toEqual(before.players[playerId].discardPile)
    expect(before).toEqual(snapshot)
  })
  it.each(['non-arena', 'level-one', 'level-three', 'arena-item', 'top-only'] as const)('retains the mismatched actual bottom and ordinary damage: %s', scenario => {
    const before = createBs12StardustDemoState(scenario)
    const ordinary = attack(before)
    const shown = pay(then(ordinary))
    expect(shown.pendingRevealTopDeck?.matched).toBe(false)
    const after = confirm(shown)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players['player-two']).toEqual(ordinary.players['player-two'])
    expect(after.pendingBattle ?? null).toBeNull()
  })
  it('optional skip preserves ordinary damage and BB without revealing or returning a card', () => {
    const ordinary = attack(createBs12StardustDemoState())
    const after = applyGameCommand(then(ordinary), { kind: 'resolve-optional-cost-attack', playerId, action: 'skip' })
    expect(after.players).toEqual(ordinary.players)
    expect(after.pendingRevealTopDeck ?? null).toBeNull()
    expect(after.pendingBattle ?? null).toBeNull()
  })
  it('empty deck blocks only the optional reveal, never the ordinary BB attack', () => {
    const before = createBs12StardustDemoState('empty-deck')
    const ordinary = attack(before)
    const after = then(ordinary)
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([4, 4])
    expect(after.pendingOptionalCostAttack ?? null).toBeNull()
    expect(after.pendingRevealTopDeck ?? null).toBeNull()
    expect(after.pendingBattle ?? null).toBeNull()
  })
  it.each(['no-energy', 'one-energy', 'wrong-energy', 'mixed-energy', 'rested-energy', 'opponent-turn', 'outside-main', 'source-rested'] as const)('rejects illegal ordinary attack before payment: %s', scenario => {
    const before = createBs12StardustDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(() => attack(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([[], ['bs12-064-opponent'], ['bs12-064-opponent', 'bs12-064-opponent'], ['bs12-070-source', 'bs12-064-opponent'], ['missing', 'bs12-064-opponent']].map(ids => ({ ids })))('rejects incomplete or invalid all-target order $ids without moving HP', ({ ids }) => {
    const before = confirm(pay(then(attack(createBs12StardustDemoState()))))
    const snapshot = structuredClone(before)
    expect(() => damage(before, ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('accepts reverse order and one remaining opponent', () => {
    const returned = confirm(pay(then(attack(createBs12StardustDemoState()))))
    const begun = damage(returned, ['bs12-064-opponent-other', 'bs12-064-opponent'])
    expect(begun.pendingBattle?.damageTargetInstanceId ?? begun.pendingBattle?.targetInstanceId).toBe('bs12-064-opponent-other')
    expect(finish(begun).players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3, 3])
    const single = confirm(pay(then(attack(createBs12StardustDemoState('single-opponent')))))
    expect(finish(damage(single, ['bs12-064-opponent'])).players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3])
  })
  it('normal faint finishes replacement before Then and damages only the remaining opponent', () => {
    const ordinary = attack(createBs12StardustDemoState('target-faints'))
    expect(ordinary.players['player-two'].breakArea.map(c => c.instanceId)).toContain('bs12-064-opponent')
    expect(ordinary.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([4])
    const after = finish(damage(confirm(pay(then(ordinary))), ['bs12-064-opponent-other']))
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3])
  })
  it('effect faint of the other opponent preserves the source and first opponent result', () => {
    const after = finish(damage(confirm(pay(then(attack(createBs12StardustDemoState('other-faints')))))))
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3])
    expect(after.players['player-two'].breakArea.map(c => c.instanceId)).toContain('bs12-064-opponent-other')
  })
  it('returns the last bottom and Refreshes before all damage with the actual attack source', () => {
    const ordinary = attack(createBs12StardustDemoState('short-deck'))
    const waiting = confirm(pay(then(ordinary)))
    expect(waiting.pendingRefresh).toMatchObject({ playerId, remainingDraws: 0 })
    expect(waiting.pendingAbilityEffect?.sourceKind).toBe('skill')
    expect(waiting.pendingBattle?.stage).toBe('attack-effect')
    expect(waiting.players[playerId].hand).toHaveLength(1)
    expect(waiting.players['player-two']).toEqual(ordinary.players['player-two'])
    expect(() => damage(waiting)).toThrow()
    const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-069-refresh-cookie', shuffleSeed: 1 })
    expect(after.players[playerId].deck).toHaveLength(7)
    expect(finish(damage(after)).players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3, 3])
  })
  it.each(['refresh-defeat', 'no-refresh-cookie'] as const)('retains ordinary damage and return but ends before all damage: %s', scenario => {
    const ordinary = attack(createBs12StardustDemoState(scenario))
    const returned = confirm(pay(then(ordinary)))
    const after = scenario === 'refresh-defeat' ? applyGameCommand(returned, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-069-refresh-cookie', shuffleSeed: 1 }) : returned
    expect(after.status).toBe('finished')
    expect(after.result?.winnerId).toBe('player-two')
    expect(after.players[playerId].hand).toHaveLength(1)
    expect(after.players['player-two']).toEqual(ordinary.players['player-two'])
  })
  it('excludes only actual effect-protected opponents without allowing a partial target set', () => {
    const returned = confirm(pay(then(attack(createBs12StardustDemoState('protected')))))
    const pending = returned.pendingAbilityEffect!
    expect(getEffectSelectionCandidates(returned, { sourcePlayerId: playerId, sourceInstanceId: pending.sourceInstanceId }, pending.effects[0]).map(c => c.instanceId)).toEqual(['bs12-064-opponent'])
    expect(finish(damage(returned, ['bs12-064-opponent'])).players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3, 3])
  })
  it('last bottom still requires Refresh when every opponent is effect protected', () => {
    const ordinary = attack(createBs12StardustDemoState('short-all-protected'))
    const waiting = confirm(pay(then(ordinary)))
    expect(waiting.pendingRefresh).toMatchObject({ playerId, remainingDraws: 0 })
    const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-069-refresh-cookie', shuffleSeed: 1 })
    expect(after.players['player-two']).toEqual(ordinary.players['player-two'])
    expect(after.players[playerId].deck).toHaveLength(7)
    expect(after.pendingBattle ?? null).toBeNull()
    expect(after.pendingAbilityEffect ?? null).toBeNull()
  })
  it('actual FLIP resolves between targets without losing the all-damage queue or returned bottom', () => {
    const before = createBs12StardustDemoState('flip')
    const flipped = finish(damage(confirm(pay(then(attack(before)))), ['bs12-064-opponent-other', 'bs12-064-opponent']))
    expect(flipped.pendingBattle?.stage).toBe('flip')
    expect(flipped.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([4, 3])
    const paid = applyGameCommand(flipped, { kind: 'resolve-flip', playerId: 'player-two', activate: true, discardHandIds: ['bs12-070-flip-cost'] })
    expect(paid.pendingDrawUpTo?.max).toBe(2)
    const after = finish(applyGameCommand(paid, { kind: 'resolve-draw-up-to', playerId: 'player-two', drawCount: 2 }))
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3, 3])
    expect(after.pendingBattle ?? null).toBeNull()
    expect(after.pendingAbilityEffect ?? null).toBeNull()
    expect(after.players[playerId].hand[0]?.instanceId).toBe('bs12-069-bottom')
  })
  it('wrong confirmer or changed bottom is atomically rejected', () => {
    const shown = pay(then(attack(createBs12StardustDemoState())))
    expect(() => applyGameCommand(shown, { kind: 'resolve-reveal-top-deck', playerId: 'player-two' })).toThrow()
    const changed = { ...shown, players: { ...shown.players, [playerId]: { ...shown.players[playerId], deck: shown.players[playerId].deck.slice().reverse() } } }
    const snapshot = structuredClone(changed)
    expect(() => confirm(changed)).toThrow()
    expect(changed).toEqual(snapshot)
  })
  it('AI handles actual optional reveal and ordered damage through public commands', () => {
    let state = then(attack(createBs12StardustDemoState()))
    for (let i = 0; i < 22 && (state.pendingOptionalCostAttack || state.pendingRevealTopDeck || state.pendingAbilityEffect || state.pendingBattle); i++) state = takeAiStep(state, playerId).state
    expect(state.pendingBattle ?? null).toBeNull()
    expect(state.pendingRevealTopDeck ?? null).toBeNull()
    expect(state.pendingOptionalCostAttack ?? null).toBeNull()
  })
  it('uses localhost-only fixtures and JSON replay preserves the attack and revealed source', () => {
    expect(parseTestStateConfig(`?test-state=bs12-070:${number}:positive`, 'localhost')).toEqual({ kind: 'bs12-070', cardNumber: number, scenario: 'positive' })
    expect(parseTestStateConfig(`?test-state=bs12-070:${number}:positive`, 'example.com')).toBeNull()
    const opened = then(attack(createBs12StardustDemoState()))
    const command = JSON.parse(JSON.stringify({ kind: 'resolve-optional-cost-attack', playerId, action: 'pay', paymentIds: [], targetIds: [] }))
    const shown = applyGameCommand(opened, command)
    expect(shown.pendingRevealTopDeck?.sourceInstanceId).toBe('bs12-070-source')
    const sourceImage = number === 'BS12-070'
      ? 'https://cookierunbraverse.com/data/en_storage/72cuFfsiIhjGpF5g1ISRYw.webp'
      : 'https://cookierunbraverse.com/data/en_storage/So-W7uu2r8hT5OuwFqf2gQ.webp'
    expect(shown.commandLog?.some(e => e.card?.id === 'BS12-070' && e.card.imageUrl === sourceImage && e.card.instanceId === 'bs12-070-source')).toBe(true)
  })
  it.each(['positive', 'green-arena', 'red-arena', 'yellow-arena', 'non-arena', 'level-one', 'level-three', 'arena-item', 'top-only', 'short-deck', 'refresh-defeat', 'no-refresh-cookie', 'empty-deck', 'no-energy', 'one-energy', 'wrong-energy', 'mixed-energy', 'rested-energy', 'opponent-turn', 'outside-main', 'target-faints', 'target-rested', 'source-rested', 'single-opponent', 'other-faints', 'flip', 'ordinary-flip', 'protected', 'all-protected', 'short-all-protected'] as Bs12StardustScenario[])('keeps fixture within real field and copy limits: %s', scenario => {
    for (const player of Object.values(createBs12StardustDemoState(scenario).players)) {
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      expect(player.breakArea.reduce((sum, card) => sum + card.level, 0)).toBeLessThan(10)
      const cards = [...player.hand, ...player.deck, ...player.discardPile, ...player.breakArea, ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
      for (const count of Object.values(cards.reduce<Record<string, number>>((counts, card) => ({ ...counts, [card.id]: (counts[card.id] ?? 0) + 1 }), {}))) expect(count).toBeLessThanOrEqual(4)
    }
  })
})
