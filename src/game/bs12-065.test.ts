import { describe, expect, it } from 'vitest'
import { createBs12FanLetterDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { getTrapCandidates } from './battle'
import { getOptionalCostAttackPrompt } from '../components/modals/optionalCostAttackPrompt'
import { takeAiStep } from './ai'
import { advancePhase } from './turn'
import { getAttackDamageAgainst } from './effects'
type State = ReturnType<typeof createBs12FanLetterDemoState>
const playerId = 'player-one' as const
const resolve = (s: State) => applyGameCommand(s, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
const play = (s: State, targets = ['bs12-065-attacker'], paymentIds = ['bs12-065-payment']) => applyGameCommand(s,
  { kind: 'play-trap', playerId, trapInstanceId: 'bs12-065-trap', paymentIds, targetIds: [], effectTargets: [targets] })
const open = (scenario: Parameters<typeof createBs12FanLetterDemoState>[0] = 'positive', targets?: string[]) => resolve(play(createBs12FanLetterDemoState(scenario), targets))
const pay = (s: State, ids = ['bs12-065-hand-cost']) => applyGameCommand(s, { kind: 'resolve-optional-cost-attack', playerId, action: 'pay', discardCardIds: ids })
const draw = (s: State, count: number) => {
  let after = applyGameCommand(resolve(s), { kind: 'resolve-draw-up-to', playerId, drawCount: count })
  if (after.pendingAbilityEffect) after = resolve(after)
  return after
}
const finish = (s: State) => {
  let after = s
  for (let i = 0; after.pendingBattle && i < 12; i++) after = applyGameCommand(after, { kind: 'resolve-next-damage', playerId })
  return after
}
describe('BS12-065 separate initial B and optional public hand-to-bottom Then', () => {
  it.each(['positive', 'green-arena', 'red-arena', 'yellow-arena'] as const)('pays B first, then moves the same exact LV2 Arena Cookie of any color: %s', scenario => {
    const original = createBs12FanLetterDemoState(scenario)
    const before = open(scenario)
    const snapshot = structuredClone(before)
    const card = before.players[playerId].hand[0]
    expect(before.players[playerId].supportArea[0].rested).toBe(true)
    expect(before.players[playerId].discardPile.at(-1)?.id).toBe('BS12-065')
    expect(before.players[playerId].hand).toHaveLength(1)
    expect(before.players[playerId].deck).toEqual(original.players[playerId].deck)
    expect(before.players[playerId].battleArea[0].hpCards).toHaveLength(5)
    expect(getOptionalCostAttackPrompt(before, playerId)?.discardHandCandidates.map(c => c.instanceId)).toEqual([card.instanceId])
    const paid = pay(before)
    expect(paid.players[playerId].hand).toEqual([])
    expect(paid.players[playerId].deck).toEqual([...before.players[playerId].deck, card])
    expect(paid.players[playerId].discardPile).toEqual(before.players[playerId].discardPile)
    expect(paid.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(paid.commandLog?.at(-1)?.steps?.some(step => step.text.includes('公開手牌並將同一張牌放入牌庫底'))).toBe(true)
    const after = finish(draw(paid, 1))
    expect(after.players[playerId].hand).toEqual(original.players[playerId].deck.slice(0, 1))
    expect(after.players[playerId].deck.at(-1)).toEqual(card)
    expect(after.players[playerId].deck).toHaveLength(12)
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(2)
    expect(after.pendingBattle).toBeNull()
    expect(before).toEqual(snapshot)
  })
  it.each(['non-arena', 'level-one', 'level-three', 'arena-item', 'no-hand'] as const)('no legal hand only blocks Then, not B reduction: %s', scenario => {
    const before = open(scenario)
    expect(getOptionalCostAttackPrompt(before, playerId)?.discardHandCandidates).toEqual([])
    expect(() => pay(before)).toThrow()
    const after = finish(applyGameCommand(before, { kind: 'resolve-optional-cost-attack', playerId, action: 'skip' }))
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(2)
  })
  it('drawing zero still pays the hand-to-bottom cost', () => {
    const before = open()
    const after = finish(draw(pay(before), 0))
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].deck).toEqual([...before.players[playerId].deck, before.players[playerId].hand[0]])
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(2)
  })
  it.each([[], ['bs12-064-opponent-other']].map(targets => ({ targets })))('front target $targets is independent of Then payment and draw', ({ targets }) => {
    const before = open('positive', targets)
    const after = finish(draw(pay(before), 1))
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(1)
    expect(after.players[playerId].hand).toHaveLength(1)
  })
  it.each([[], ['unknown'], ['bs12-064-source'], ['bs12-065-payment'], ['bs12-065-hand-cost', 'bs12-065-hand-cost']].map(ids => ({ ids })))('rejects missing, wrong zone and repeated cost $ids atomically', ({ ids }) => {
    const before = open()
    const snapshot = structuredClone(before)
    expect(() => pay(before, ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each(['no-energy', 'wrong-energy', 'rested-energy', 'disabled', 'used', 'main'] as const)('blocks initial illegal payment or timing: %s', scenario => {
    const before = createBs12FanLetterDemoState(scenario)
    expect(getTrapCandidates(before, playerId)).toEqual([])
    expect(() => play(before)).toThrow()
  })
  it('AI pays the legal hand cost, draws and resumes the same attack', () => {
    let state = open()
    for (let i = 0; (state.pendingAbilityEffect || state.pendingOptionalCostAttack || state.pendingDrawUpTo) && i < 12; i++) state = takeAiStep(state, playerId, { level: 2 }).state
    expect(finish(state).players[playerId].battleArea[0].hpCards).toHaveLength(2)
    expect(state.players[playerId].deck.at(-1)?.instanceId).toBe('bs12-065-hand-cost')
  })
  it('short deck draws the old top rather than the newly paid bottom', () => {
    const before = open('short-deck')
    const after = finish(draw(pay(before), 1))
    expect(after.players[playerId].hand).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].hand)
  })
  it('empty deck can be supplied by Then cost, and drawing it triggers Refresh before damage', () => {
    const before = open('empty-deck')
    const after = draw(pay(before), 1)
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
    expect(after.pendingRefresh?.playerId).toBe(playerId)
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(5)
    const refreshed = applyGameCommand(after, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-065-refresh-cookie', shuffleSeed: 1 })
    expect(finish(refreshed).players[playerId].battleArea[0].hpCards).toHaveLength(2)
  })
  it('expires at turn end and round-trips accepted commands', () => {
    const before = open()
    expect(pay(JSON.parse(JSON.stringify(before)))).toEqual(pay(before))
    let after = finish(draw(pay(before), 0))
    after = advancePhase(advancePhase(after))
    expect(getAttackDamageAgainst(after, 'bs12-065-attacker', 'bs12-064-source')).toBe(4)
    expect(parseTestStateConfig('?test-state=bs12-065:positive', 'localhost')).toEqual({ kind: 'bs12-065', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-065:positive', 'example.com')).toBeNull()
  })
  it.each(['positive', 'green-arena', 'red-arena', 'yellow-arena', 'non-arena', 'level-one', 'level-three', 'arena-item', 'no-hand', 'short-deck', 'empty-deck'] as const)('has legal field and copy capacity: %s', scenario => {
    for (const player of Object.values(createBs12FanLetterDemoState(scenario).players)) {
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      expect(player.breakArea.reduce((sum, c) => sum + c.level, 0)).toBeLessThan(10)
      const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea,
        ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
      const counts = cards.reduce<Record<string, number>>((all, card) => ({ ...all, [card.id]: (all[card.id] ?? 0) + 1 }), {})
      expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(4)
    }
  })
})
