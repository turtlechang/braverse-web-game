import { describe, expect, it } from 'vitest'
import { BS12_POPPING_CANDY_SCENARIOS, createBs12PoppingCandyDemoState, parseTestStateConfig, type Bs12PoppingCandyScenario } from './demo'
import { applyGameCommand } from './commands'
import { canPlayExtraDeckCookie } from './actions'
import { canActivateCookieSkill } from './skills'
import type { GameState } from './types'

const playerId = 'player-one' as const
const sourceId = 'bs12-074-source'
const entry = (state: GameState) => applyGameCommand(state, { kind: 'play-extra-deck-cookie', playerId, instanceId: sourceId })
const attack = (state: GameState) => {
  let after = applyGameCommand(state, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-064-opponent', supportPaymentIds: state.players[playerId].supportArea.filter(support => !support.rested).map(support => support.card.instanceId) })
  after = applyGameCommand(after, { kind: 'skip-trap', playerId: 'player-two' })
  for (let index = 0; after.pendingBattle?.stage === 'damage' && index < 12; index++) after = applyGameCommand(after, { kind: 'resolve-next-damage', playerId: 'player-two' })
  if (after.pendingReplacement) after = applyGameCommand(after, { kind: 'skip-replacement', playerId: 'player-two' })
  return applyGameCommand(after, { kind: 'resolve-attack-effect', playerId, targetIds: [] })
}
const reveal = (state: GameState) => applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId, action: 'pay', paymentIds: [], targetIds: [] })
const confirm = (state: GameState) => applyGameCommand(state, { kind: 'resolve-reveal-top-deck', playerId })
const move = (state: GameState, targetIds = ['bs12-064-opponent']) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds })

describe.each(['BS12-074', 'BS12-074@1'] as const)('%s complete public command flow', number => {
  const initial = (scenario: Bs12PoppingCandyScenario = 'positive') => createBs12PoppingCandyDemoState(scenario, number)
  it.each(BS12_POPPING_CANDY_SCENARIOS)('builds the independent candidate fixture without illegal card identity overlap: %s', scenario => {
    const state = initial(scenario)
    const cards = Object.values(state.players).flatMap(player => [
      ...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile, ...(player.extraDeck ?? []), ...player.supportArea.map(support => support.card),
      ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
    ])
    expect(new Set(cards.map(card => card.instanceId)).size).toBe(cards.length)
    expect(state.players[playerId].battleArea.length).toBeLessThanOrEqual(2)
    expect(state.players['player-two'].battleArea.length).toBeLessThanOrEqual(2)
  })
  it('only allows the dedicated candidate route on localhost', () => {
    expect(parseTestStateConfig(`?test-state=bs12-074:${number}:positive`, 'localhost')).toEqual({ kind: 'bs12-074', cardNumber: number, scenario: 'positive' })
    expect(parseTestStateConfig(`?test-state=bs12-074:${number}:positive`, 'example.com')).toBeNull()
  })
  it('uses actual 072 event commands, then normal EXTRA entry and five top HP', () => {
    const before = initial('extra')
    expect(before.commandLog?.map(command => command.commandKind)).toContain('begin-activate-skill')
    expect(canPlayExtraDeckCookie(before, playerId, sourceId)).toBe(true)
    const after = entry(before)
    expect(after.players[playerId].battleArea[1]).toMatchObject({ card: { name: 'Popping Candy Cookie', extraDeckOrigin: 'extra' }, enteredFrom: 'extra-deck', rested: false })
    expect(after.players[playerId].battleArea[1].hpCards).toEqual(before.players[playerId].deck.slice(0, 5))
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(5))
    expect(after.extraDeckPlayUsedThisTurn).toBe(true)
  })
  it.each(['extra-no-event', 'extra-non-arena', 'extra-top', 'extra-hand', 'extra-support', 'extra-opponent', 'extra-old-turn', 'extra-full', 'extra-used', 'extra-opponent-turn', 'extra-outside-main'] as const)('rejects illegal EXTRA entry atomically: %s', scenario => {
    const before = initial(scenario)
    const snapshot = structuredClone(before)
    expect(canPlayExtraDeckCookie(before, playerId, sourceId)).toBe(false)
    expect(() => entry(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([0, 1, 2])('second-player On Play draws up to two after five normal HP: %s', drawCount => {
    const before = initial('onplay')
    expect(before.players[playerId].battleArea[1].hpCards).toHaveLength(5)
    const offered = applyGameCommand(before, { kind: 'begin-activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'on-play', paymentIds: [], targetIds: [] })
    const after = applyGameCommand(offered, { kind: 'resolve-draw-up-to', playerId, drawCount })
    expect(after.players[playerId].hand).toEqual([...before.players[playerId].hand, ...before.players[playerId].deck.slice(0, drawCount)])
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(drawCount))
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
  })
  it('first-player On Play does not draw', () => {
    const before = initial('onplay-first')
    expect(canActivateCookieSkill(before, playerId, sourceId, 'on-play')).toBe(false)
    expect(() => applyGameCommand(before, { kind: 'begin-activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'on-play', paymentIds: [] })).toThrow()
  })
  it.each(['positive', 'green-arena', 'red-arena', 'yellow-arena', 'bottom-dj'] as const)('pays BBB3, returns the same matching bottom then moves exactly the opponent top HP to its own bottom: %s', scenario => {
    const before = initial(scenario)
    const ordinary = attack(before)
    expect(ordinary.players['player-two'].battleArea.map(cookie => cookie.hpCards.length)).toEqual([3, 4])
    const shown = reveal(ordinary)
    expect(shown.pendingRevealTopDeck).toMatchObject({ deckPosition: 'bottom', matched: true, revealedCard: before.players[playerId].deck.at(-1) })
    const returned = confirm(shown)
    const target = returned.players['player-two'].battleArea[0]
    const after = move(returned)
    expect(after.players['player-two'].battleArea[0].hpCards).toEqual(target.hpCards.slice(0, -1))
    expect(after.players['player-two'].deck).toEqual([...returned.players['player-two'].deck, target.hpCards.at(-1)!])
    expect(after.players['player-two'].discardPile).toEqual(returned.players['player-two'].discardPile)
    expect(after.players[playerId].hand).toEqual([...before.players[playerId].hand, before.players[playerId].deck.at(-1)!])
    expect(after.players[playerId].battleArea.map(cookie => cookie.hpCards)).toEqual(before.players[playerId].battleArea.map(cookie => cookie.hpCards))
    expect(after.pendingBattle ?? null).toBeNull()
    expect(after.commandLog?.at(-1)?.steps?.map(step => step.text).join(' ')).toContain('最上方 1 張 HP 卡放到持有者牌庫底；HP 3 → 2')
    expect(after.commandLog?.filter(command => command.commandKind === 'resolve-flip')).toEqual([])
  })
  it.each(['level-one', 'level-three', 'non-arena', 'arena-item', 'top-only'] as const)('keeps an unmatched bottom and does no HP movement after ordinary three: %s', scenario => {
    const before = initial(scenario)
    const ordinary = attack(before)
    const shown = reveal(ordinary)
    expect(shown.pendingRevealTopDeck?.matched).toBe(false)
    const after = confirm(shown)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
    expect(after.players['player-two']).toEqual(ordinary.players['player-two'])
  })
  it.each([[], ['bs12-064-opponent-other']].map(ids => ({ ids })))('selects zero or a different opponent after returning the bottom: $ids', ({ ids }) => {
    const before = initial()
    const returned = confirm(reveal(attack(before)))
    const after = move(returned, ids)
    expect(after.players['player-two'].battleArea.map(cookie => cookie.hpCards.length)).toEqual(ids.length ? [3, 3] : [3, 4])
    expect(after.players[playerId].hand).toEqual([before.players[playerId].deck.at(-1)!])
  })
  it('moving a top FLIP card does not reveal or trigger its FLIP', () => {
    const returned = confirm(reveal(attack(initial('flip'))))
    const after = move(returned)
    expect(after.players['player-two'].deck.at(-1)?.instanceId).toBe('bs12-074-flip')
    expect(after.pendingBattle ?? null).toBeNull()
    expect(after.commandLog?.filter(command => command.commandKind === 'resolve-flip')).toEqual([])
  })
  it.each(['target-last-hp', 'other-last-hp'] as const)('moves the last top HP to its owner bottom before faint/replacement: %s', scenario => {
    const returned = confirm(reveal(attack(initial(scenario))))
    const targetIndex = scenario === 'other-last-hp' ? 1 : 0
    const target = returned.players['player-two'].battleArea[targetIndex]
    expect(target.hpCards).toHaveLength(1)
    const moved = move(returned, [target.card.instanceId])
    expect(moved.players['player-two'].deck).toEqual([...returned.players['player-two'].deck, target.hpCards[0]])
    expect(moved.players['player-two'].breakArea).toEqual([...returned.players['player-two'].breakArea, target.card])
    expect(moved.players['player-two'].discardPile).toEqual(returned.players['player-two'].discardPile)
    expect(moved.players['player-two'].battleArea).toEqual(returned.players['player-two'].battleArea.filter(cookie => cookie.card.instanceId !== target.card.instanceId))
    expect(moved.pendingBattle?.stage).not.toBe('flip')
    expect(moved.commandLog?.at(-1)?.steps?.map(step => step.text).join(' ')).toContain('HP 1 → 0，該餅乾因此昏厥')
    const after = moved.pendingReplacement ? applyGameCommand(moved, { kind: 'skip-replacement', playerId: 'player-two' }) : moved
    expect(after.status).toBe('playing')
    expect(after.pendingBattle ?? null).toBeNull()
  })
  it('allows the remaining different opponent when ordinary damage fainted the original defender', () => {
    const returned = confirm(reveal(attack(initial('target-faints'))))
    expect(returned.players['player-two'].battleArea.map(cookie => cookie.card.instanceId)).toEqual(['bs12-064-opponent-other'])
    const after = move(returned, ['bs12-064-opponent-other'])
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
  })
  it('returns the final matching bottom, Refreshes, then resumes HP movement with the same EXTRA source', () => {
    const ordinary = attack(initial('short-deck'))
    const returned = confirm(reveal(ordinary))
    expect(returned.pendingRefresh?.playerId).toBe(playerId)
    expect(returned.pendingAbilityEffect?.sourceInstanceId).toBe(sourceId)
    expect(returned.players[playerId].hand).toEqual([ordinary.players[playerId].deck[0]])
    expect(returned.players['player-two']).toEqual(ordinary.players['player-two'])
    expect(() => move(returned)).toThrow()
    const refreshed = applyGameCommand(returned, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-074-refresh-cookie', shuffleSeed: 74 })
    const after = move(refreshed)
    expect(after.players['player-two'].battleArea.map(cookie => cookie.hpCards.length)).toEqual([2, 4])
  })
  it.each(['refresh-defeat', 'no-refresh-cookie'] as const)('ends after ordinary damage and bottom return, before any HP movement: %s', scenario => {
    const ordinary = attack(initial(scenario))
    const returned = confirm(reveal(ordinary))
    const after = scenario === 'refresh-defeat' ? applyGameCommand(returned, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-074-refresh-cookie', shuffleSeed: 74 }) : returned
    expect(after.status).toBe('finished')
    expect(after.result?.winnerId).toBe('player-two')
    expect(after.players['player-two']).toEqual(ordinary.players['player-two'])
  })
  it.each([1, 2])('On Play draws from the one-card deck and queues any remaining draw after Refresh: %s', drawCount => {
    const before = initial('onplay-short')
    const offered = applyGameCommand(before, { kind: 'begin-activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'on-play', paymentIds: [], targetIds: [] })
    expect(offered.pendingDrawUpTo?.max).toBe(2)
    expect(() => applyGameCommand(offered, { kind: 'resolve-draw-up-to', playerId, drawCount: 3 })).toThrow()
    const after = applyGameCommand(offered, { kind: 'resolve-draw-up-to', playerId, drawCount })
    expect(after.pendingRefresh).toMatchObject({ playerId, remainingDraws: drawCount - 1 })
    expect(after.players[playerId].hand).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].battleArea[1].hpCards).toHaveLength(5)
  })
  it.each(['one-energy', 'two-energy', 'wrong-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main'] as const)('rejects illegal BBB attack atomically: %s', scenario => {
    const before = initial(scenario)
    const snapshot = structuredClone(before)
    expect(() => attack(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
})
