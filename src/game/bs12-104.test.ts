import { expect, it } from 'vitest'
import { BS12_RECIPE_SCENARIOS, createBs12RecipeDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand, getPendingDecision } from './commands'
import { getAttackDamageAgainst, getEffectTargetCandidatesForEffect } from './effects'
import { describeCommandSteps } from './command-log'
import { maskGameStateForViewer } from './masked-state'
import { takeAiStep } from './ai'
import type { GameState } from './types'

const playerId = 'player-one' as const, source = 'bs12-104-item', target = 'bs12-104-target', enemy = 'bs12-104-opponent'
const begin = (state = createBs12RecipeDemoState(), id = source, payment = 'bs12-104-payment-0') => applyGameCommand(state, { kind: 'begin-play-item', playerId, instanceId: id, paymentIds: [payment] })
const startDraw = (state = createBs12RecipeDemoState()) => applyGameCommand(begin(state), { kind: 'resolve-ability-effect', playerId, targetIds: [] })
const draw = (state: GameState, drawCount = 1) => applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId, drawCount })
const buff = (state: GameState, targetIds = [target]) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds })
const choose = (state: GameState) => {
  const pending = state.pendingAbilityEffect!
  return getEffectTargetCandidatesForEffect(state, { sourcePlayerId: playerId, sourceInstanceId: source }, pending.effects[pending.effectIndex]).map(entry => entry.card.instanceId)
}
const refresh = (state: GameState) => applyGameCommand(state, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-104-refresh' }, { shuffle: cards => [...cards] })

it('104 pays K1 once and trashes the Item before drawing or buffing', () => {
  const before = createBs12RecipeDemoState('spare-energy'), snapshot = structuredClone(before), after = begin(before)
  expect(after.players[playerId].hand).toEqual([])
  expect(after.players[playerId].discardPile.map(card => card.instanceId)).toEqual([source])
  expect(after.players[playerId].supportArea.map(entry => entry.rested)).toEqual([true, false, false, false])
  expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
  expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
  expect(after.attackModifiers).toEqual([])
  expect(before).toEqual(snapshot)
})
it.each([0, 1])('104 drawing %s independently allows selecting a target or zero', drawCount => {
  const before = createBs12RecipeDemoState(), waiting = startDraw(before)
  expect(waiting.pendingDrawUpTo).toMatchObject({ max: 1, sourceInstanceId: source })
  expect(choose(draw(waiting, drawCount))).toEqual([target])
  for (const ids of [[], [target]]) {
    const after = buff(draw(waiting, drawCount), ids)
    expect(after.pendingDrawUpTo).toBeFalsy()
    expect(after.pendingAbilityEffect).toBeFalsy()
    expect(after.players[playerId].hand).toEqual(before.players[playerId].deck.slice(0, drawCount))
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(drawCount))
    expect(after.attackModifiers).toHaveLength(ids.length)
    expect(getAttackDamageAgainst(after, target, enemy)).toBe(ids.length ? 3 : 2)
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
  }
})
it.each(['positive', 'non-arena', 'pudding', 'strategist', 'rested-target'] as const)('104 accepts real printed Special Play %s without LV/Arena/REST restrictions', scenario => {
  const before = createBs12RecipeDemoState(scenario), selection = draw(startDraw(before), 0), after = buff(selection)
  expect(choose(selection)).toEqual([target])
  expect(after.attackModifiers).toMatchObject([{ targetInstanceId: target, sourceInstanceId: source, amount: 1, expiresAfterTurn: 2 }])
  expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
  if (scenario === 'non-arena') {
    expect(before.players[playerId].battleArea[0].card.keywords ?? []).not.toContain('arena')
    expect(before.players[playerId].battleArea[0].card.level).toBe(2)
  }
})
it.each(['ordinary', 'arena-only', 'hand-only', 'support-only', 'trash-only', 'break-only', 'opponent-only', 'no-target'] as const)('104 excludes %s but still independently draws and accepts zero buff', scenario => {
  const before = createBs12RecipeDemoState(scenario), selection = draw(startDraw(before)), after = buff(selection, [])
  expect(choose(selection)).toEqual([])
  expect(after.players[playerId].hand.at(-1)).toEqual(before.players[playerId].deck[0])
  expect(after.attackModifiers).toEqual([])
})
it('104 two printed targets allow either one while a mixed ordinary Cookie is excluded', () => {
  const waiting = draw(startDraw(createBs12RecipeDemoState('two-targets')), 0)
  expect(choose(waiting)).toEqual([target, 'bs12-104-other'])
  expect(buff(waiting, ['bs12-104-other']).attackModifiers).toMatchObject([{ targetInstanceId: 'bs12-104-other' }])
  expect(choose(draw(startDraw(createBs12RecipeDemoState('mixed')), 0))).toEqual([target])
})
it.each([[], [target], ['bs12-104-payment-0', 'bs12-104-payment-0'], ['bs12-104-payment-0', 'bs12-104-payment-1']].map(ids => ({ ids })))('104 rejects invalid payment $ids atomically', ({ ids: paymentIds }) => {
  const state = createBs12RecipeDemoState(), snapshot = structuredClone(state)
  expect(() => applyGameCommand(state, { kind: 'begin-play-item', playerId, instanceId: source, paymentIds })).toThrow()
  expect(state).toEqual(snapshot)
})
it.each(['no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn', 'outside-main'] as const)('104 rejects %s before paying or drawing', scenario => {
  const state = createBs12RecipeDemoState(scenario), snapshot = structuredClone(state)
  expect(() => begin(state)).toThrow()
  expect(state).toEqual(snapshot)
})
it.each([-1, 2, 0.5, NaN])('104 rejects draw amount %s atomically', count => {
  const state = startDraw(), snapshot = structuredClone(state)
  expect(() => draw(state, count)).toThrow()
  expect(state).toEqual(snapshot)
})
it.each([[target, target], [target, 'bs12-104-other'], [enemy], ['bs12-104-payment-0'], [source]].map(ids => ({ ids })))('104 rejects illegal target list $ids atomically', ({ ids: targetIds }) => {
  const state = draw(startDraw(createBs12RecipeDemoState('two-targets')), 0), snapshot = structuredClone(state)
  expect(() => buff(state, targetIds)).toThrow()
  expect(state).toEqual(snapshot)
})
it('104 waits for the draw decision before allowing buff selection and rejects duplicate settlement', () => {
  const state = startDraw()
  expect(getPendingDecision(state)?.kind).toBe('draw-up-to')
  expect(() => buff(state)).toThrow()
  const after = buff(draw(state))
  expect(() => draw(after)).toThrow()
  expect(() => buff(after)).toThrow()
})
it('104 bonus affects a real paid attack, is additive for two Items, then expires this turn', () => {
  const first = buff(draw(startDraw(createBs12RecipeDemoState('stack')), 0))
  const secondPaid = begin(first, 'bs12-104-item-2', 'bs12-104-payment-1')
  const secondDraw = applyGameCommand(secondPaid, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
  const after = buff(draw(secondDraw, 0))
  expect(getAttackDamageAgainst(after, target, enemy)).toBe(4)
  const attacking = applyGameCommand(after, { kind: 'declare-attack', playerId, attackerInstanceId: target, targetInstanceId: enemy, supportPaymentIds: ['bs12-104-payment-2', 'bs12-104-payment-3'] })
  expect(attacking.pendingBattle).toMatchObject({ declaredDamage: 4, attackerInstanceId: target, targetInstanceId: enemy })
  expect(attacking.players[playerId].battleArea[0].rested).toBe(true)
  const next = applyGameCommand(applyGameCommand(after, { kind: 'advance-phase', playerId }), { kind: 'advance-phase', playerId })
  expect(getAttackDamageAgainst(next, target, enemy)).toBe(2)
  expect(next.attackModifiers).toEqual([])
})
it.each([0, 1])('104 last-card draw %s refreshes and preserves Then without requiring a draw', count => {
  const before = createBs12RecipeDemoState('one-card'), selection = count ? refresh(draw(startDraw(before), count)) : draw(startDraw(before), count)
  expect(choose(selection)).toEqual([target])
  const after = buff(selection)
  expect(after.players[playerId].hand).toHaveLength(count)
  expect(after.players[playerId].supportArea[0].rested).toBe(true)
  expect(getAttackDamageAgainst(after, target, enemy)).toBe(3)
  expect(after.players[playerId].breakArea).toHaveLength(count)
})
it('104 empty-deck legal Refresh precedes payment and draw, then target choice remains independent', () => {
  const before = createBs12RecipeDemoState('empty-deck')
  expect(before.commandLog?.map(c => c.commandKind)).toEqual(['declare-attack', 'skip-trap', 'resolve-next-damage', 'resolve-attack-effect', 'resolve-optional-cost-attack', 'resolve-draw-up-to'])
  const refreshed = refresh(before)
  expect(refreshed.players[playerId].deck).toHaveLength(6)
  expect(refreshed.players[playerId].hand).toHaveLength(2)
  expect(refreshed.players[playerId].supportArea.map(c => c.rested)).toEqual([true, false, false])
  const paid = begin(refreshed, source, 'bs12-104-payment-1')
  const drawing = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
  const after = buff(draw(drawing))
  expect(after.players[playerId].hand).toHaveLength(2)
  expect(after.players[playerId].supportArea.map(c => c.rested)).toEqual([true, true, false])
  expect(after.players[playerId].deck).toHaveLength(5)
  expect(getAttackDamageAgainst(after, target, enemy)).toBe(3)
})
it('104 no Refresh or LV10 defeat stops before a bonus is granted', () => {
  const unavailable = draw(startDraw(createBs12RecipeDemoState('no-refresh')))
  expect(unavailable.result).toMatchObject({ loserId: playerId, reason: 'refresh-unavailable' })
  const defeat = refresh(draw(startDraw(createBs12RecipeDemoState('break-nine'))))
  expect(defeat.result).toMatchObject({ loserId: playerId, reason: 'break-level-limit' })
  expect(unavailable.attackModifiers).toEqual([])
  expect(defeat.attackModifiers).toEqual([])
})
it('104 logs actual draw count and bonus target without exposing the privately drawn card', () => {
  const waiting = startDraw(), command = { kind: 'resolve-draw-up-to' as const, playerId, drawCount: 1 }, selection = applyGameCommand(waiting, command)
  const drawSteps = JSON.stringify(describeCommandSteps(waiting, selection, command))
  expect(drawSteps).toMatch(/1/)
  expect(drawSteps).not.toContain(waiting.players[playerId].deck[0].name)
  const after = buff(selection), log = maskGameStateForViewer(after, 'player-two').commandLog!.at(-1)!
  expect(log.steps?.some(step => step.cards?.some(card => card.instanceId === target))).toBe(true)
  expect(JSON.stringify(log.steps)).not.toContain(waiting.players[playerId].deck[0].instanceId)
})
it('104 deterministic AI resolves the actual draw and filtered bonus through ordinary commands', () => {
  const before = startDraw(), drawn = takeAiStep(before, playerId), selected = takeAiStep(drawn.state, playerId)
  expect(drawn.state.commandLog?.at(-1)?.commandKind).toBe('resolve-draw-up-to')
  expect(selected.state.commandLog?.at(-1)?.commandKind).toBe('resolve-ability-effect')
  expect(selected.state.pendingAbilityEffect).toBeFalsy()
})
it.each(BS12_RECIPE_SCENARIOS)('104 finite fixture %s uses printed cards and legal capacities', scenario => {
  expect(parseTestStateConfig(`?test-state=bs12-104:${scenario}`, 'localhost')).toEqual({ kind: 'bs12-104', scenario })
  expect(parseTestStateConfig(`?test-state=bs12-104:${scenario}`, 'example.com')).toBeNull()
  const state = createBs12RecipeDemoState(scenario)
  for (const player of Object.values(state.players)) {
    expect(player.battleArea.length).toBeLessThanOrEqual(2)
    expect(player.breakArea.reduce((sum, card) => sum + card.level, 0)).toBeLessThan(10)
    const cards = [...player.hand, ...player.deck, ...player.discardPile, ...player.breakArea, ...player.supportArea.map(entry => entry.card), ...player.battleArea.flatMap(entry => [entry.card, ...entry.hpCards])]
    expect(new Set(cards.map(card => card.instanceId)).size).toBe(cards.length)
    for (const id of new Set(cards.map(card => card.id))) expect(cards.filter(card => card.id === id).length).toBeLessThanOrEqual(4)
  }
})
