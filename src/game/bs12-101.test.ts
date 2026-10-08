import {expect, it} from 'vitest'
import {BS12_CHESS_CHOCO_SCENARIOS, createBs12ChessChocoDemoState, parseTestStateConfig} from './demo'
import {applyGameCommand} from './commands'
import {getOptionalCostAttackPrompt} from '../components/modals/optionalCostAttackPrompt'
import {describeCommandSteps} from './command-log'
import {takeAiStep} from './ai'
import {getRefreshCandidates} from './refresh'
import {hasPendingCardResolution} from './pending'
import type {GameState} from './types'

const playerId = 'player-one' as const, source = 'bs12-101-source', target = 'bs12-101-opponent', cost = 'bs12-101-cost'
const damage = (input: GameState) => {
  let state = input
  for (let i = 0; state.pendingBattle?.stage === 'damage' && !state.pendingRefresh && !state.pendingFaintEffects?.length && !state.pendingReplacement && i < 12; i++) {
    state = applyGameCommand(state, {kind: 'resolve-next-damage', playerId: state.pendingBattle.damagePlayerId ?? state.pendingBattle.defenderPlayerId})
  }
  return state
}
const attack = (before: GameState) => damage(applyGameCommand(applyGameCommand(before,
  {kind: 'declare-attack', playerId, attackerInstanceId: source, targetInstanceId: target, supportPaymentIds: ['bs12-101-payment']}),
  {kind: 'skip-trap', playerId: 'player-two'}))
const open = (scenario: Parameters<typeof createBs12ChessChocoDemoState>[0] = 'positive') => {
  let state = attack(createBs12ChessChocoDemoState(scenario))
  if (state.pendingReplacement) state = applyGameCommand(state, {kind: 'skip-replacement', playerId: 'player-two'})
  return applyGameCommand(state, {kind: 'resolve-attack-effect', playerId, targetIds: []})
}
const pay = (state: GameState, ids = [cost]) => applyGameCommand(state, {kind: 'resolve-optional-cost-attack', playerId, action: 'pay', discardCardIds: ids, paymentIds: [], targetIds: []})
const draw = (state: GameState, drawCount = 1) => damage(applyGameCommand(state, {kind: 'resolve-draw-up-to', playerId, drawCount}))
const skip = (state: GameState) => applyGameCommand(state, {kind: 'resolve-optional-cost-attack', playerId, action: 'skip'})

it.each(['positive', 'red-hand', 'green-hand', 'yellow-hand', 'blue-hand', 'purple-hand', 'high-level', 'same-name', 'flip-cost', 'mixed-hand', 'large-hand', 'spare-energy'] as const)('101 ordinary one precedes any-color/level/name Arena Cookie hand discard and draw: %s', scenario => {
  const initial = createBs12ChessChocoDemoState(scenario), before = open(scenario), snapshot = structuredClone(before)
  expect(before.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
  expect(before.players['player-two'].battleArea[1]).toEqual(initial.players['player-two'].battleArea[1])
  expect(before.players[playerId].battleArea[0].rested).toBe(true)
  expect(before.players[playerId].battleArea[0].hpCards).toEqual(initial.players[playerId].battleArea[0].hpCards)
  expect(before.players[playerId].supportArea[0].rested).toBe(true)
  expect(before.players[playerId].hand).toEqual(initial.players[playerId].hand)
  expect(before.pendingOptionalCostAttack).toMatchObject({cost: {energy: {}, discardHand: 1, discardHandType: 'cookie', discardHandKeyword: 'arena'}})
  const prompt = getOptionalCostAttackPrompt(before, playerId)
  expect(prompt).toMatchObject({discardHandCost: 1, energyCostTotal: 0, needsTarget: false, mandatory: false})
  expect(prompt?.discardHandCandidates.map(card => card.instanceId)).toEqual(scenario === 'large-hand' ? [cost, 'bs12-101-extra-cost'] : [cost])
  const paid = pay(before), discarded = before.players[playerId].hand.find(card => card.instanceId === cost)!
  expect(paid.players[playerId].hand).toEqual(before.players[playerId].hand.filter(card => card.instanceId !== cost))
  expect(paid.players[playerId].discardPile).toEqual([...before.players[playerId].discardPile, discarded])
  expect(paid.players[playerId].deck).toEqual(before.players[playerId].deck)
  expect(paid.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
  expect(paid.pendingDrawUpTo).toMatchObject({playerId, max: 1})
  const after = draw(paid)
  expect(after.players[playerId].hand).toEqual([...paid.players[playerId].hand, before.players[playerId].deck[0]])
  expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(1))
  expect(after.players[playerId].discardPile).toEqual(paid.players[playerId].discardPile)
  expect(after.players['player-two']).toEqual(before.players['player-two'])
  expect(after.pendingBattle).toBeNull()
  expect(after.pendingOptionalCostAttack).toBeNull()
  expect(after.pendingDrawUpTo).toBeNull()
  expect(before).toEqual(snapshot)
})

it('drawing zero still discards the Arena Cookie and preserves ordinary attack payment/damage', () => {
  const before = open(), paid = pay(before), after = draw(paid, 0)
  expect(after.players).toEqual(paid.players)
  expect(after.players[playerId].hand).toEqual([])
  expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
  expect(after.pendingBattle).toBeNull()
})
it.each(['positive', 'mixed-hand', 'no-hand', 'wrong-zones'] as const)('declining Then preserves all post-attack zones: %s', scenario => {
  const before = open(scenario), after = skip(before)
  expect(after.players).toEqual(before.players)
  expect(after.pendingBattle).toBeNull()
  expect(after.pendingOptionalCostAttack).toBeNull()
})
it.each(['arena-item', 'arena-stage', 'non-arena', 'split', 'no-hand', 'wrong-zones'] as const)('Then cannot borrow split criteria or other zones, ordinary one remains valid: %s', scenario => {
  const before = open(scenario), snapshot = structuredClone(before)
  expect(getOptionalCostAttackPrompt(before, playerId)?.discardHandCandidates).toEqual([])
  expect(before.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
  expect(() => pay(before, before.players[playerId].hand.length ? [before.players[playerId].hand[0].instanceId] : [cost])).toThrow()
  expect(before).toEqual(snapshot)
  expect(skip(before).players).toEqual(before.players)
})
it.each([[], ['unknown'], [source], ['bs12-101-payment'], [target], [cost, cost], [cost, 'bs12-101-other-cost']].map(ids => ({ids})))('rejects missing/unknown/wrong-zone/duplicate/extra discard $ids atomically', ({ids}) => {
  const before = open('two-costs'), snapshot = structuredClone(before)
  expect(() => pay(before, ids)).toThrow()
  expect(before).toEqual(snapshot)
})
it('the second legal Cookie may pay without discarding the first', () => {
  const before = open('two-costs'), paid = pay(before, ['bs12-101-other-cost']), after = draw(paid)
  expect(after.players[playerId].hand[0]).toEqual(before.players[playerId].hand[0])
  expect(after.players[playerId].discardPile.at(-1)?.instanceId).toBe('bs12-101-other-cost')
})
it.each([-1, 2])('rejects unprinted draw amount %s atomically', drawCount => {
  const before = pay(open()), snapshot = structuredClone(before)
  expect(() => draw(before, drawCount)).toThrow()
  expect(before).toEqual(snapshot)
})
it.each(['no-energy', 'wrong-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main', 'first-turn'] as const)('blocks illegal ordinary attack payment/status/timing: %s', scenario => {
  const before = createBs12ChessChocoDemoState(scenario), snapshot = structuredClone(before)
  expect(() => attack(before)).toThrow()
  expect(before).toEqual(snapshot)
})
it('normal entry draws exactly two HP and full battlefield entry is rejected', () => {
  const before = createBs12ChessChocoDemoState('deploy'), snapshot = structuredClone(before)
  const after = applyGameCommand(before, {kind: 'deploy-cookie', playerId, instanceId: source})
  expect(after.players[playerId].battleArea[1].hpCards).toEqual(before.players[playerId].deck.slice(0, 2))
  expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(2))
  expect(after.pendingOnPlay).toBeNull()
  expect(before).toEqual(snapshot)
  expect(() => applyGameCommand(createBs12ChessChocoDemoState('full-battle'), {kind: 'deploy-cookie', playerId, instanceId: source})).toThrow()
})
it('defender faint and replacement do not remove the independent self draw Then', () => {
  const before = open('target-faints'), after = draw(pay(before))
  expect(before.players['player-two'].battleArea.map(cookie => cookie.card.instanceId)).toEqual(['bs12-101-opponent-other'])
  expect(before.players['player-two'].breakArea.at(-1)?.instanceId).toBe(target)
  expect(after.players[playerId].hand).toEqual(before.players[playerId].deck.slice(0, 1))
  expect(after.pendingBattle).toBeNull()
})
it('AI pays a legal Arena Cookie, draws up to one and resumes the same attack', () => {
  const before = open('mixed-hand')
  let after = before
  for (let i = 0; (after.pendingOptionalCostAttack || after.pendingDrawUpTo || after.pendingBattle) && i < 10; i++) after = takeAiStep(after, playerId, {level: 2}).state
  expect(after.players[playerId].discardPile.at(-1)?.instanceId).toBe(cost)
  expect(after.players[playerId].hand).toContainEqual(before.players[playerId].deck[0])
  expect(after.pendingBattle).toBeNull()
})
it('public command traces identify actual hand cost before the separate optional draw', () => {
  const before = open(), command = {kind: 'resolve-optional-cost-attack' as const, playerId, action: 'pay' as const, discardCardIds: [cost], paymentIds: [], targetIds: []}
  const paid = applyGameCommand(before, command)
  expect(describeCommandSteps(before, paid, command)?.map(step => step.text).join(' ')).toMatch(/Blueberry Cake Hound/)
  expect(paid.commandLog?.at(-1)?.commandKind).toBe('resolve-optional-cost-attack')
  const after = draw(paid)
  expect(after.commandLog?.some(entry => entry.commandKind === 'resolve-draw-up-to')).toBe(true)
})

it.each([true, false])('101 waits for the defender FLIP before its own optional hand cost: activate=%s', activate => {
  const initial = createBs12ChessChocoDemoState('flip-before-then'), before = attack(initial)
  expect(before.pendingBattle?.stage).toBe('flip')
  expect(initial.players['player-two'].battleArea[0].card.id).toBe('BS12-080')
  expect(initial.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
  expect(before.pendingBattle?.revealedHpCard?.id).toBe('BS12-002')
  expect(before.pendingOptionalCostAttack).toBeUndefined()
  expect(before.players[playerId].hand).toEqual(initial.players[playerId].hand)
  const resumed = damage(applyGameCommand(before, {kind: 'resolve-flip', playerId: 'player-two', activate,
    targetIds: activate ? [target] : [], discardHandIds: activate ? ['bs12-101-enemy-flip-cost'] : []}))
  expect(resumed.players['player-two'].battleArea[0].hpCards).toHaveLength(activate ? 1 : 2)
  expect(resumed.players['player-two'].battleArea[0].card.instanceId).toBe(activate ? target : 'bs12-101-opponent-other')
  expect(resumed.players['player-two'].breakArea.map(card => card.instanceId)).toEqual(activate ? [] : [target])
  const opened = applyGameCommand(resumed, {kind: 'resolve-attack-effect', playerId, targetIds: []}), after = draw(pay(opened))
  expect(after.players[playerId].hand).toEqual(initial.players[playerId].deck.slice(0, 1))
  expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(activate ? 1 : 2)
  expect(after.pendingBattle).toBeNull()
})
it('101 attack Then is already on standby and can activate after its source faints into public Break', () => {
  const initial = createBs12ChessChocoDemoState('source-faints'), before = attack(initial)
  expect(before.pendingBattle?.revealedHpCard?.id).toBe('BS12-004')
  let after = damage(applyGameCommand(before, {kind: 'resolve-flip', playerId: 'player-two', activate: true, targetIds: [source]}))
  if (after.pendingReplacement) after = applyGameCommand(after, {kind: 'skip-replacement', playerId})
  after = damage(after)
  expect(after.players[playerId].battleArea.map(cookie => cookie.card.instanceId)).toEqual(['bs12-101-ally'])
  expect(after.players[playerId].breakArea.at(-1)?.instanceId).toBe(source)
  expect(after.players[playerId].hand).toEqual(initial.players[playerId].hand)
  expect(after.players[playerId].deck).toEqual(initial.players[playerId].deck)
  expect(after.pendingOptionalCostAttack).toBeUndefined()
  const opened = applyGameCommand(after, {kind: 'resolve-attack-effect', playerId, targetIds: []})
  expect(opened.pendingOptionalCostAttack?.sourceCardName).toBe('Chess Choco Cookie')
  expect(getOptionalCostAttackPrompt(opened, playerId)?.sourceCard?.id).toBe('BS12-101')
  const finished = draw(pay(opened))
  expect(finished.players[playerId].hand).toEqual([...initial.players[playerId].hand.filter(card => card.instanceId !== cost), ...initial.players[playerId].deck.slice(0, 1)])
  expect(finished.players[playerId].breakArea.at(-1)?.instanceId).toBe(source)
  expect(finished.pendingBattle).toBeNull()
})
it('drawing zero from a one-card deck keeps that card and needs no Refresh', () => {
  const before = open('one-deck'), after = draw(pay(before), 0)
  expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
  expect(after.pendingRefresh).toBeNull()
  expect(after.pendingBattle).toBeNull()
})
it.each(['empty-deck', 'short-deck'] as const)('101 keeps the paid discard and ordinary one across Refresh: %s', scenario => {
  const before = open(scenario), paid = pay(before)
  let state = paid
  if (!state.pendingRefresh) state = draw(state)
  expect(state.pendingRefresh).toBeTruthy()
  expect(state.players[playerId].discardPile.some(card => card.instanceId === cost)).toBe(true)
  expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
  const refresh = getRefreshCandidates(state, playerId).find(card => card.instanceId === (scenario === 'empty-deck' ? 'bs12-101-refresh-cookie' : cost))!
  expect(refresh).toBeTruthy()
  state = applyGameCommand(state, {kind: 'refresh-deck', playerId, cookieInstanceId: refresh.instanceId}, {shuffleSeed: 31})
  if (state.pendingDrawUpTo) state = draw(state)
  state = damage(state)
  expect(state.players[playerId].hand).toHaveLength(1)
  expect(state.status).toBe('playing')
  expect(state.players[playerId].breakArea.at(-1)?.instanceId).toBe(refresh.instanceId)
  expect(state.players[playerId].supportArea[0].rested).toBe(true)
  expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
  expect(hasPendingCardResolution(state)).toBe(false)
  expect(state.pendingRefresh).toBeNull()
  expect(state.pendingBattle).toBeNull()
})
it('101 Refresh LV10 defeat stops drawing while keeping already paid hand cost and ordinary damage', () => {
  const before = open('refresh-defeat'), paid = pay(before)
  const refreshing = paid.pendingRefresh ? paid : draw(paid)
  expect(refreshing.pendingRefresh).toBeTruthy()
  expect(refreshing.players[playerId].discardPile.some(card => card.instanceId === cost)).toBe(true)
  const after = applyGameCommand(refreshing, {kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-101-refresh-cookie'}, {shuffleSeed: 31})
  expect(after.status).toBe('finished')
  expect(after.result).toEqual({winnerId: 'player-two', loserId: playerId, reason: 'break-level-limit'})
  expect(after.players[playerId].hand).toEqual([])
  expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
  expect(after.players[playerId].supportArea[0].rested).toBe(true)
  expect(after.pendingBattle).toBeNull()
})

it.each(BS12_CHESS_CHOCO_SCENARIOS)('101 fixture uses finite actual cards, legal field sizes and unique ownership: %s', scenario => {
  const state = createBs12ChessChocoDemoState(scenario)
  expect(parseTestStateConfig(`?test-state=bs12-101:${scenario}`, 'localhost')).toEqual({kind: 'bs12-101', scenario})
  expect(parseTestStateConfig(`?test-state=bs12-101:${scenario}`, 'example.com')).toBeNull()
  const ids: string[] = []
  for (const player of Object.values(state.players)) {
    expect(player.battleArea.length).toBeLessThanOrEqual(2)
    const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea, ...player.supportArea.map(support => support.card), ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards])]
    const counts = new Map<string, number>()
    for (const card of cards) {
      ids.push(card.instanceId)
      counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
      expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
    }
    expect([...counts.values()].every(count => count <= 4)).toBe(true)
  }
  expect(new Set(ids).size).toBe(ids.length)
})
