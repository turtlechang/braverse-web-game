import { describe, expect, it } from 'vitest'
import { createBs12IcePopDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { executeCardEffect } from './effects'
import { canActivateCookieSkill } from './skills'
import { takeAiStep } from './ai'
import type { GameState } from './types'

const playerId = 'player-one' as const
const sourceId = 'bs12-071-source'
const context = { sourcePlayerId: playerId, sourceInstanceId: sourceId, sourceCardName: 'Ice Pop Cookie' }
const revealEffect = { kind: 'reveal-bottom-deck' as const,
  match: { type: 'cookie' as const, level: 2, keyword: 'arena' as const }, playMatchedAfterSourceTrash: true }
const begin = (state: GameState) => applyGameCommand(state, { kind: 'begin-activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'activate', paymentIds: [] })
const reveal = (state: GameState) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
const confirm = (state: GameState) => applyGameCommand(state, { kind: 'resolve-reveal-top-deck', playerId })
const pay = (state: GameState, action: 'pay' | 'skip' = 'pay') => applyGameCommand(state,
  { kind: 'resolve-optional-cost-attack', playerId, action, discardCardIds: [], targetIds: [], paymentIds: [] })
const play = (state: GameState) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds: [] })

describe.each(['BS12-071', 'BS12-071@1'] as const)('%s conditional source cost and actual bottom play', number => {
  const initial = (scenario: Parameters<typeof createBs12IcePopDemoState>[0] = 'positive') => createBs12IcePopDemoState(scenario, number)
  it('confirms publicly before offering the source trash cost, without drawing or selecting from hand', () => {
    const before = initial()
    const shown = executeCardEffect(before, context, revealEffect, [])
    expect(shown.players).toEqual(before.players)
    const confirmed = confirm(shown)
    expect(confirmed.players).toEqual(before.players)
    expect(confirmed.pendingOptionalCostAttack).toMatchObject({ resolution: 'ability', cost: { energy: {}, selfToTrash: true } })
    const paid = pay(confirmed)
    expect(paid.players[playerId].battleArea).toEqual([])
    expect(paid.pendingReplacement ?? null).toBeNull()
    expect(paid.players[playerId].discardPile.slice(-4)).toEqual([before.players[playerId].battleArea[0].card, ...before.players[playerId].battleArea[0].hpCards])
    const after = play(paid)
    const bottom = before.players[playerId].deck.at(-1)!
    expect(after.players[playerId].battleArea[0]).toMatchObject({ card: bottom, enteredFrom: 'deck', rested: false })
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].battleArea[0].hpCards).toEqual(before.players[playerId].deck.slice(0, bottom.type === 'cookie' ? bottom.hp : 0))
    expect(after.players[playerId].breakArea).toEqual(before.players[playerId].breakArea)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
  })
  it('loads only a localhost isolated candidate fixture', () => {
    expect(parseTestStateConfig(`?test-state=bs12-071:${number}:positive`, 'localhost')).toEqual({ kind: 'bs12-071', cardNumber: number, scenario: 'positive' })
    expect(parseTestStateConfig(`?test-state=bs12-071:${number}:positive`, 'example.com')).toBeNull()
  })
  it.each(['positive', 'green-arena', 'red-arena', 'yellow-arena', 'no-energy', 'source-rested', 'two-cookies', 'equipped', 'hand-decoy'] as const)('actual commands play the same bottom, irrespective of color or energy: %s', scenario => {
    const before = initial(scenario)
    const snapshot = structuredClone(before)
    expect(canActivateCookieSkill(before, playerId, sourceId, 'activate')).toBe(true)
    const declared = begin(before)
    expect(declared.players).toEqual(before.players)
    const shown = reveal(declared)
    expect(shown.pendingRevealTopDeck).toMatchObject({ matched: true, revealedCard: before.players[playerId].deck.at(-1) })
    const after = play(pay(confirm(shown)))
    const bottom = before.players[playerId].deck.at(-1)!
    expect(after.players[playerId].battleArea.at(-1)?.card).toEqual(bottom)
    expect(after.players[playerId].battleArea.at(-1)?.hpCards).toHaveLength(bottom.type === 'cookie' ? bottom.hp : 0)
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.players[playerId].discardPile.slice(before.players[playerId].discardPile.length)).toEqual([
      before.players[playerId].battleArea[0].card, ...before.players[playerId].battleArea[0].hpCards,
      ...(before.players[playerId].battleArea[0].equippedCards ?? []),
    ])
    expect(after.players[playerId].breakArea).toEqual(before.players[playerId].breakArea)
    expect(after.pendingFaintEffects ?? []).toEqual([])
    expect(after.pendingBattle ?? null).toBeNull()
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(before).toEqual(snapshot)
  })
  it.each(['non-arena', 'level-one', 'level-three', 'arena-item', 'top-only'] as const)('unmatched bottom keeps source/HP and consumes once: %s', scenario => {
    const before = initial(scenario)
    const shown = reveal(begin(before))
    expect(shown.pendingRevealTopDeck?.matched).toBe(false)
    const after = confirm(shown)
    expect(after.players).toEqual(before.players)
    expect(after.pendingOptionalCostAttack ?? null).toBeNull()
    expect(after.pendingAbilityEffect ?? null).toBeNull()
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
    expect(() => begin(after)).toThrow()
  })
  it('declining only the conditional cost preserves the public reveal and spends once', () => {
    const before = initial()
    const after = pay(confirm(reveal(begin(before))), 'skip')
    expect(after.players).toEqual(before.players)
    expect(after.pendingOptionalCostAttack ?? null).toBeNull()
    expect(after.pendingAbilityEffect ?? null).toBeNull()
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
  })
  it.each(['opponent-turn', 'outside-main', 'once-used'] as const)('rejects declaration atomically: %s', scenario => {
    const before = initial(scenario)
    const snapshot = structuredClone(before)
    expect(canActivateCookieSkill(before, playerId, sourceId, 'activate')).toBe(false)
    expect(() => begin(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('an unbracketed empty reveal is a no-op, distinct from required reveal costs', () => {
    const before = initial('empty-deck')
    const after = reveal(begin(before))
    expect(after.players).toEqual(before.players)
    expect(after.pendingRevealTopDeck ?? null).toBeNull()
    expect(after.pendingOptionalCostAttack ?? null).toBeNull()
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
  })
  it.each(['short-deck', 'no-refresh-cookie', 'refresh-defeat'] as const)('short HP setup suspends for real Refresh, including the freshly trashed source: %s', scenario => {
    const before = initial(scenario)
    const waiting = play(pay(confirm(reveal(begin(before)))))
    expect(waiting.pendingRefresh?.remainingHpSetup).toEqual([{ targetInstanceId: 'bs12-069-bottom', amount: 2 }])
    expect(waiting.pendingReplacement ?? null).toBeNull()
    expect(waiting.players[playerId].battleArea[0].hpCards).toEqual([])
    const after = applyGameCommand(waiting, { kind: 'refresh-deck', playerId, cookieInstanceId: scenario === 'no-refresh-cookie' ? sourceId : 'bs12-069-refresh-cookie', shuffleSeed: 1 })
    expect(after.status).toBe(scenario === 'refresh-defeat' ? 'finished' : 'playing')
    if (scenario === 'refresh-defeat') expect(after.result?.winnerId).toBe('player-two')
    else expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(2)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
  })
  it('deck play establishes the actual On Play window after normal HP', () => {
    const before = initial('yellow-arena')
    const after = play(pay(confirm(reveal(begin(before)))))
    expect(after.pendingOnPlay).toEqual({ playerId, sourceInstanceId: 'bs12-069-bottom', origin: 'deck' })
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(2)
    expect(after.pendingReplacement ?? null).toBeNull()
    expect(applyGameCommand(after, { kind: 'skip-on-play', playerId, sourceInstanceId: 'bs12-069-bottom' }).pendingOnPlay ?? null).toBeNull()
  })
  it.each(['bottom', 'source', 'entry'] as const)('stale cost rejects atomically: %s', mutation => {
    const waiting = confirm(reveal(begin(initial())))
    const player = waiting.players[playerId]
    const stale = { ...waiting, players: { ...waiting.players, [playerId]: { ...player,
      deck: mutation === 'bottom' ? player.deck.slice(0, -1) : player.deck,
      battleArea: mutation === 'source' ? [] : player.battleArea.map(cookie => mutation === 'entry' ? { ...cookie, battleEntryId: 'different-entry' } : cookie),
    } } }
    const snapshot = structuredClone(stale)
    expect(() => pay(stale)).toThrow()
    expect(stale).toEqual(snapshot)
  })
  it('round-trips public decisions through JSON, and forbids substituting a hand card', () => {
    const before = initial('hand-decoy')
    const confirmed = JSON.parse(JSON.stringify(confirm(reveal(begin(before))))) as GameState
    const paid = pay(confirmed)
    expect(() => applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: ['bs12-071-hand-decoy'] })).toThrow()
    expect(play(paid).players[playerId].hand).toEqual(before.players[playerId].hand)
  })
  it('same-card play cannot be executed before paying the source cost', () => {
    const before = initial()
    expect(() => executeCardEffect(before, context, { kind: 'play-revealed-bottom-cookie', revealedInstanceId: 'bs12-069-bottom' }, [])).toThrow('必須先支付')
  })
  it('AI can finish the public confirm, optional payment and same-card play without a stuck queue', () => {
    let state = reveal(begin(initial()))
    for (let i = 0; i < 8 && (state.pendingRevealTopDeck || state.pendingOptionalCostAttack || state.pendingAbilityEffect); i++) state = takeAiStep(state, playerId).state
    expect(state.pendingRevealTopDeck ?? null).toBeNull()
    expect(state.pendingOptionalCostAttack ?? null).toBeNull()
    expect(state.pendingAbilityEffect ?? null).toBeNull()
  })
  it('once use belongs to the old battle entry, while a new entry can activate again', () => {
    const used = pay(confirm(reveal(begin(initial()))), 'skip')
    const player = used.players[playerId]
    const reentered = { ...used, players: { ...used.players, [playerId]: { ...player,
      battleArea: player.battleArea.map(cookie => ({ ...cookie, battleEntryId: 'new-battle-entry' })),
    } } }
    expect(canActivateCookieSkill(reentered, playerId, sourceId, 'activate')).toBe(true)
    expect(begin(reentered).pendingAbilityEffect?.effectIndex).toBe(0)
  })
  it('wrong actor cannot confirm the public reveal or pay the source cost', () => {
    const shown = reveal(begin(initial()))
    expect(() => applyGameCommand(shown, { kind: 'resolve-reveal-top-deck', playerId: 'player-two' })).toThrow()
    expect(() => applyGameCommand(confirm(shown), { kind: 'resolve-optional-cost-attack', playerId: 'player-two', action: 'pay' })).toThrow()
  })
  it.each(['positive', 'mixed-energy'] as const)('ordinary BN one damage is independent of bottom reveal: %s', scenario => {
    const before = initial(scenario)
    let after = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId,
      targetInstanceId: 'bs12-064-opponent', supportPaymentIds: ['bs12-069-payment-0', 'bs12-069-payment-1'] })
    expect(after.pendingBattle?.declaredDamage).toBe(1)
    after = applyGameCommand(after, { kind: 'skip-trap', playerId: 'player-two' })
    for (let i = 0; after.pendingBattle?.stage === 'damage' && i < 5; i++) after = applyGameCommand(after, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(after.players['player-two'].battleArea.map(cookie => cookie.hpCards.length)).toEqual([5, 4])
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].battleArea[0].rested).toBe(true)
    expect(after.players[playerId].supportArea.every(support => support.rested)).toBe(true)
    expect(after.pendingRevealTopDeck ?? null).toBeNull()
    expect(after.pendingOptionalCostAttack ?? null).toBeNull()
  })
  it.each(['one-energy', 'wrong-energy', 'rested-energy', 'source-rested'] as const)('illegal ordinary payment never starts a reveal: %s', scenario => {
    const before = initial(scenario)
    const snapshot = structuredClone(before)
    expect(() => applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId,
      targetInstanceId: 'bs12-064-opponent', supportPaymentIds: before.players[playerId].supportArea.map(support => support.card.instanceId) })).toThrow()
    expect(before).toEqual(snapshot)
  })
})
