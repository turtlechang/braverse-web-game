import { describe, expect, it } from 'vitest'
import { createBs12ComebackStageDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateStage, canPlayStage } from './card-abilities'
import { takeAiStep } from './ai'
import { selectEnergyPayment } from './energy'

const playerId = 'player-one' as const
type State = ReturnType<typeof createBs12ComebackStageDemoState>
const place = (s: State, paymentIds = ['bs12-067-payment-0']) => applyGameCommand(s, { kind: 'play-stage', playerId, instanceId: 'bs12-067-stage', paymentIds })
const ready = (scenario: Parameters<typeof createBs12ComebackStageDemoState>[0] = 'positive') => place(createBs12ComebackStageDemoState(scenario))
const open = (s: State, paymentIds = ['bs12-067-payment-1']) => applyGameCommand(s, { kind: 'begin-activate-stage', playerId, paymentIds, targetIds: [] })
const confirm = (s: State) => applyGameCommand(s, { kind: 'resolve-reveal-top-deck', playerId })

describe('BS12-067 separate Stage payments and exact bottom return', () => {
  it('places for B only: no source REST, reveal or movement from the deck', () => {
    const before = createBs12ComebackStageDemoState()
    const snapshot = structuredClone(before)
    const after = place(before)
    expect(after.players[playerId].stage).toMatchObject({ card: { id: 'BS12-067' }, rested: false })
    expect(after.players[playerId].supportArea.map(s => s.rested)).toEqual([true, false])
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.pendingRevealTopDeck ?? null).toBeNull()
    expect(before).toEqual(snapshot)
  })
  it('replaces only the old Stage and preserves deck, hand and battle semantics', () => {
    const before = createBs12ComebackStageDemoState('replace')
    expect(place(before).players[playerId].discardPile).toEqual([...before.players[playerId].discardPile, before.players[playerId].stage!.card])
  })
  it('allows placement with an empty deck but rejects Activate before another B or source REST', () => {
    const before = createBs12ComebackStageDemoState('empty-deck')
    expect(canPlayStage(before, playerId, 'bs12-067-stage')).toBe(true)
    const placed = place(before)
    const snapshot = structuredClone(placed)
    expect(canActivateStage(placed, playerId)).toBe(false)
    expect(() => open(placed)).toThrow()
    expect(placed).toEqual(snapshot)
  })
  it('does not reuse the B already spent on placement', () => {
    const placed = ready('one-energy')
    expect(canActivateStage(placed, playerId)).toBe(false)
    expect(() => open(placed, ['bs12-067-payment-0'])).toThrow()
    expect(placed.players[playerId].stage?.rested).toBe(false)
  })
  it.each(['positive', 'green-arena', 'red-arena', 'yellow-arena'] as const)('pays a second B and REST before revealing, then returns the same actual Cookie: %s', scenario => {
    const before = ready(scenario)
    const snapshot = structuredClone(before)
    const bottom = before.players[playerId].deck.at(-1)!
    expect(bottom).toMatchObject({ type: 'cookie', level: 2 })
    expect(bottom.keywords).toContain('arena')
    const opened = open(before)
    expect(opened.players[playerId].stage?.rested).toBe(true)
    expect(opened.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(opened.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(opened.players[playerId].hand).toEqual([])
    expect(opened.players[playerId].discardPile).toEqual(before.players[playerId].discardPile)
    expect(opened.pendingRevealTopDeck).toMatchObject({ deckPosition: 'bottom', revealedCard: bottom, matched: true, addMatchedToHand: true, nestedEffects: [] })
    const after = confirm(opened)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(0, -1))
    expect(after.players[playerId].hand).toEqual([bottom])
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(after.pendingRevealTopDeck).toBeNull()
    expect(after.pendingDrawUpTo ?? null).toBeNull()
    expect(after.pendingAbilityEffect ?? null).toBeNull()
    expect(after.skillUsesThisTurn).toEqual(before.skillUsesThisTurn)
    expect(before).toEqual(snapshot)
  })
  it.each(['non-arena', 'level-one', 'level-three', 'arena-item', 'top-only'] as const)('retains the entire deck and no hand gain on mismatch, while costs remain paid: %s', scenario => {
    const before = ready(scenario)
    const opened = open(before)
    expect(opened.pendingRevealTopDeck?.matched).toBe(false)
    const after = confirm(opened)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].stage?.rested).toBe(true)
    expect(after.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(after.commandLog?.at(-1)?.steps?.some(step => step.text.includes('底牌維持原位'))).toBe(true)
  })
  it.each(['no-energy', 'wrong-energy', 'rested-energy'] as const)('blocks illegal placement without moving any cards: %s', scenario => {
    const before = createBs12ComebackStageDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(selectEnergyPayment({ blue: 1 }, before.players[playerId].supportArea)).toBeNull()
    expect(() => place(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each(['activation-no-energy', 'activation-wrong-energy', 'activation-rested-energy', 'rested-source', 'opponent-turn', 'outside-main'] as const)('blocks illegal activation with all other resources present: %s', scenario => {
    const before = createBs12ComebackStageDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(canActivateStage(before, playerId)).toBe(false)
    expect(() => open(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([[], ['unknown'], ['bs12-067-payment-0'], ['bs12-067-payment-1', 'bs12-067-payment-1'], ['bs12-064-source']].map(ids => ({ ids })))('rejects illegal activation payment $ids atomically', ({ ids }) => {
    const before = ready()
    const snapshot = structuredClone(before)
    expect(() => open(before, ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('rejects the wrong public confirmer and a changed bottom before moving the card', () => {
    const opened = open(ready())
    expect(() => applyGameCommand(opened, { kind: 'resolve-reveal-top-deck', playerId: 'player-two' })).toThrow()
    const changed = { ...opened, players: { ...opened.players, [playerId]: { ...opened.players[playerId], deck: opened.players[playerId].deck.slice().reverse() } } }
    expect(() => confirm(changed)).toThrow()
  })
  it('Refreshes immediately after returning the last bottom card with no subsequent target or draw', () => {
    const before = ready('short-deck')
    const returned = confirm(open(before))
    expect(returned.players[playerId].hand).toEqual(before.players[playerId].deck)
    expect(returned.players[playerId].deck).toEqual([])
    expect(returned.pendingRefresh).toEqual({ playerId, remainingDraws: 0 })
    const after = applyGameCommand(returned, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-067-refresh-cookie', shuffleSeed: 1 })
    expect(after.pendingRefresh).toBeNull()
    expect(after.players[playerId].hand).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].deck).toHaveLength(7)
    expect(after.players[playerId].breakArea.map(c => c.instanceId)).toEqual(['bs12-067-refresh-cookie'])
    expect(after.players[playerId].stage?.rested).toBe(true)
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
  })
  it('Refresh LV10 defeats before any extra draw or battle change', () => {
    const before = ready('refresh-defeat')
    const after = applyGameCommand(confirm(open(before)), { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-067-refresh-cookie', shuffleSeed: 1 })
    expect(after.status).toBe('finished')
    expect(after.result?.winnerId).toBe('player-two')
    expect(after.players[playerId].hand).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
  })
  it('loses without a Refresh Cookie only after the real bottom has entered hand', () => {
    const state = ready('short-deck')
    const before = { ...state, players: { ...state.players, [playerId]: { ...state.players[playerId], discardPile: state.players[playerId].discardPile.filter(c => c.type !== 'cookie') } } }
    const after = confirm(open(before))
    expect(after.status).toBe('finished')
    expect(after.result?.reason).toBe('refresh-unavailable')
    expect(after.players[playerId].hand).toEqual(before.players[playerId].deck)
  })
  it('is limited by REST rather than a once-per-turn flag; genuine readiness permits another paid use', () => {
    const after = confirm(open(ready()))
    expect(canActivateStage(after, playerId)).toBe(false)
    const readied = { ...after, players: { ...after.players, [playerId]: { ...after.players[playerId], stage: { ...after.players[playerId].stage!, rested: false },
      supportArea: after.players[playerId].supportArea.map((s, i) => ({ ...s, rested: i === 0 })) } } }
    expect(canActivateStage(readied, playerId)).toBe(true)
    expect(open(readied).players[playerId].stage?.rested).toBe(true)
  })
  it('AI resolves the public bottom and Refresh without an invented optional draw', () => {
    let state = open(ready('short-deck'))
    for (let i = 0; (state.pendingRevealTopDeck || state.pendingRefresh || state.pendingAbilityEffect) && i < 10; i++) state = takeAiStep(state, playerId, { level: 2 }).state
    expect(state.players[playerId].hand).toHaveLength(1)
    expect(state.players[playerId].deck).toHaveLength(7)
    expect(state.pendingRefresh).toBeNull()
  })
  it('replays JSON commands and records the actual source and public bottom, on a localhost-only route', () => {
    const opened = open(ready())
    const after = confirm(JSON.parse(JSON.stringify(opened)))
    expect(after).toEqual(confirm(opened))
    expect(after.commandLog?.at(-1)?.card?.id).toBe('BS12-067')
    expect(after.commandLog?.at(-1)?.steps?.[0].cards?.[0].instanceId).toBe('bs12-067-bottom')
    expect(parseTestStateConfig('?test-state=bs12-067:positive', 'localhost')).toEqual({ kind: 'bs12-067', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-067:positive', 'example.com')).toBeNull()
  })
  it.each(['positive', 'green-arena', 'red-arena', 'yellow-arena', 'non-arena', 'level-one', 'level-three', 'arena-item', 'top-only', 'short-deck', 'refresh-defeat', 'empty-deck', 'replace', 'placed', 'no-energy', 'wrong-energy', 'rested-energy', 'one-energy', 'activation-no-energy', 'activation-wrong-energy', 'activation-rested-energy', 'rested-source', 'opponent-turn', 'outside-main'] as const)('keeps legal field, copy and break capacity: %s', scenario => {
    for (const player of Object.values(createBs12ComebackStageDemoState(scenario).players)) {
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      expect(player.breakArea.reduce((sum, c) => sum + c.level, 0)).toBeLessThan(10)
      const cards = [...player.hand, ...player.deck, ...player.discardPile, ...player.breakArea, ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards]), ...(player.stage ? [player.stage.card] : [])]
      const counts = cards.reduce<Record<string, number>>((r, c) => ({ ...r, [c.id]: (r[c.id] ?? 0) + 1 }), {})
      expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(4)
    }
  })
})
