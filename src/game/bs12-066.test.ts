import { describe, expect, it } from 'vitest'
import { createBs12EndingPoseDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { explainUnavailableTraps, getTrapCandidates } from './battle'
import { takeAiStep } from './ai'
import { advancePhase } from './turn'
import { getAttackDamageAgainst } from './effects'
type State = ReturnType<typeof createBs12EndingPoseDemoState>
type Scenario = Parameters<typeof createBs12EndingPoseDemoState>[0]
const playerId = 'player-one' as const
const play = (s: State, paymentIds = ['bs12-066-payment']) => applyGameCommand(s,
  { kind: 'play-trap', playerId, trapInstanceId: 'bs12-066-trap', paymentIds, targetIds: [] })
const confirm = (s: State) => applyGameCommand(s, { kind: 'resolve-reveal-top-deck', playerId })
const target = (s: State, targetIds = ['bs12-066-attacker']) => applyGameCommand(s, { kind: 'resolve-ability-effect', playerId, targetIds })
const finish = (s: State) => {
  let after = s
  for (let i = 0; after.pendingBattle && i < 12; i++) after = applyGameCommand(after, { kind: 'resolve-next-damage', playerId })
  return after
}
describe('BS12-066 required bottom reveal and independent optional target', () => {
  it.each(['positive', 'green-arena', 'red-arena', 'yellow-arena'] as const)('publicly samples the same matching bottom before returning and reducing: %s', scenario => {
    const before = createBs12EndingPoseDemoState(scenario)
    const snapshot = structuredClone(before)
    const opened = play(before)
    expect(opened.pendingRevealTopDeck).toMatchObject({ deckPosition: 'bottom', matched: true, revealedCard: before.players[playerId].deck.at(-1), battleContinuation: 'after-trap' })
    expect(opened.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(opened.players[playerId].hand).toEqual([])
    expect(opened.players[playerId].supportArea[0].rested).toBe(true)
    expect(opened.players[playerId].discardPile.at(-1)?.id).toBe('BS12-066')
    expect(opened.players[playerId].battleArea[0].hpCards).toHaveLength(5)
    const returned = confirm(opened)
    expect(returned.players[playerId].hand).toEqual(before.players[playerId].deck.slice(-1))
    expect(returned.players[playerId].deck).toEqual(before.players[playerId].deck.slice(0, -1))
    expect(returned.pendingAbilityEffect).toMatchObject({ sourceKind: 'trap', sourceInstanceId: 'bs12-066-trap', battleContinuation: 'after-trap' })
    const after = finish(target(returned))
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(3)
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([4, 4])
    expect(after.pendingBattle).toBeNull()
    expect(before).toEqual(snapshot)
  })
  it.each(['non-arena', 'level-one', 'level-three', 'arena-item', 'top-only'] as const)('does not return or reduce on mismatched bottom while B is spent: %s', scenario => {
    const before = createBs12EndingPoseDemoState(scenario)
    const opened = play(before)
    expect(opened.pendingRevealTopDeck?.matched).toBe(false)
    const after = finish(confirm(opened))
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(1)
    expect(after.players[playerId].supportArea[0].rested).toBe(true)
    expect(after.pendingAbilityEffect).toBeUndefined()
  })
  it.each(['empty-deck', 'no-energy', 'wrong-energy', 'rested-energy', 'disabled', 'used', 'main'] as const)('rejects the initial illegal declaration atomically: %s', scenario => {
    const before = createBs12EndingPoseDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(getTrapCandidates(before, playerId)).toEqual([])
    expect(() => play(before)).toThrow()
    expect(before).toEqual(snapshot)
    if (scenario === 'empty-deck') expect(explainUnavailableTraps(before, playerId)[0].reason).toBe('condition-not-met')
  })
  it.each([[], ['bs12-064-opponent-other']].map(ids => ({ ids })))('target $ids does not undo the already returned card', ({ ids }) => {
    const before = createBs12EndingPoseDemoState()
    const after = finish(target(confirm(play(before)), ids))
    expect(after.players[playerId].hand).toEqual(before.players[playerId].deck.slice(-1))
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(1)
  })
  it.each([['bs12-064-source'], ['bs12-066-attacker', 'bs12-066-attacker'], ['bs12-066-attacker', 'bs12-064-opponent-other']].map(ids => ({ ids })))('rejects illegal or too many targets $ids without a second return', ({ ids }) => {
    const before = confirm(play(createBs12EndingPoseDemoState()))
    const snapshot = structuredClone(before)
    expect(() => target(before, ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('rejects wrong player or a changed bottom before any movement', () => {
    const before = play(createBs12EndingPoseDemoState())
    expect(() => applyGameCommand(before, { kind: 'resolve-reveal-top-deck', playerId: 'player-two' })).toThrow()
    const changed = { ...before, players: { ...before.players, [playerId]: { ...before.players[playerId], deck: before.players[playerId].deck.slice().reverse() } } }
    const snapshot = structuredClone(changed)
    expect(() => confirm(changed)).toThrow()
    expect(changed).toEqual(snapshot)
  })
  it('Refreshes after the last matching bottom returns, before targeting or damage', () => {
    const before = createBs12EndingPoseDemoState('short-deck')
    const awaiting = confirm(play(before))
    expect(awaiting.players[playerId].hand).toEqual(before.players[playerId].deck)
    expect(awaiting.pendingRefresh).toMatchObject({ playerId, remainingDraws: 0 })
    expect(awaiting.pendingAbilityEffect?.sourceKind).toBe('trap')
    expect(awaiting.players[playerId].battleArea[0].hpCards).toHaveLength(5)
    expect(() => target(awaiting)).toThrow()
    const refreshed = applyGameCommand(awaiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-066-refresh-cookie', shuffleSeed: 1 })
    expect(refreshed.players[playerId].deck).toHaveLength(7)
    expect(finish(target(refreshed)).players[playerId].battleArea[0].hpCards).toHaveLength(3)
  })
  it('Refresh reaching LV10 ends before target reduction and original attack damage', () => {
    const awaiting = confirm(play(createBs12EndingPoseDemoState('refresh-defeat')))
    const after = applyGameCommand(awaiting, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-066-refresh-cookie', shuffleSeed: 1 })
    expect(after.status).toBe('finished')
    expect(after.result?.winnerId).toBe('player-two')
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(5)
    expect(after.players['player-two'].battleArea[0].card.attack).toBe(4)
  })
  it('emptying the deck without a Refresh Cookie loses after the real bottom returns', () => {
    const before = createBs12EndingPoseDemoState('short-deck')
    before.players[playerId] = { ...before.players[playerId], discardPile: [] }
    const after = confirm(play(before))
    expect(after.status).toBe('finished')
    expect(after.players[playerId].hand[0].instanceId).toBe('bs12-066-bottom')
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(5)
  })
  it('AI consumes reveal and target decisions and retains the same returned bottom', () => {
    let state = play(createBs12EndingPoseDemoState())
    for (let i = 0; (state.pendingRevealTopDeck || state.pendingAbilityEffect) && i < 12; i++) state = takeAiStep(state, playerId, { level: 2 }).state
    expect(state.pendingRevealTopDeck).toBeNull()
    expect(state.pendingAbilityEffect).toBeUndefined()
    expect(state.players[playerId].hand[0].instanceId).toBe('bs12-066-bottom')
    expect(finish(state).pendingBattle).toBeNull()
  })
  it('JSON commands preserve public source and actual bottom identity, and reduction expires', () => {
    const opened = play(createBs12EndingPoseDemoState())
    const returned = confirm(JSON.parse(JSON.stringify(opened)))
    expect(returned).toEqual(confirm(opened))
    expect(returned.commandLog?.at(-1)?.card?.id).toBe('BS12-066')
    expect(returned.commandLog?.at(-1)?.steps?.[0].cards?.[0].instanceId).toBe('bs12-066-bottom')
    let after = finish(target(returned))
    expect(getAttackDamageAgainst(after, 'bs12-066-attacker', 'bs12-064-source')).toBe(2)
    after = advancePhase(advancePhase(after))
    expect(getAttackDamageAgainst(after, 'bs12-066-attacker', 'bs12-064-source')).toBe(4)
    expect(parseTestStateConfig('?test-state=bs12-066:positive', 'localhost')).toEqual({ kind: 'bs12-066', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-066:positive', 'example.com')).toBeNull()
  })
  it.each(['positive', 'green-arena', 'red-arena', 'yellow-arena', 'non-arena', 'level-one', 'level-three', 'arena-item', 'top-only', 'short-deck', 'refresh-defeat'] as Scenario[])('has legal field, copy and rest capacity: %s', scenario => {
    for (const player of Object.values(createBs12EndingPoseDemoState(scenario).players)) {
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      expect(player.breakArea.reduce((sum, c) => sum + c.level, 0)).toBeLessThan(10)
      const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea,
        ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
      const counts = cards.reduce<Record<string, number>>((all, card) => ({ ...all, [card.id]: (all[card.id] ?? 0) + 1 }), {})
      expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(4)
    }
  })
})
