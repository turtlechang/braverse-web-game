import { expect, it } from 'vitest'
import { BS12_COFFEE_TRUCK_SCENARIOS, createBs12CoffeeTruckDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateStage } from './card-abilities'
import { getTrashToHandCandidates } from './effects'
import { describeCommandSteps } from './command-log'
import { takeAiStep } from './ai'
import { hasPendingCardResolution } from './pending'
import type { GameState } from './types'

const playerId = 'player-one' as const, source = 'bs12-102-stage', target = 'bs12-102-target'
const placement = { kind: 'play-stage' as const, playerId, instanceId: source, paymentIds: ['bs12-102-payment-0'] }
const activation = { kind: 'begin-activate-stage' as const, playerId, paymentIds: ['bs12-102-payment-1'] }
const place = (state: GameState) => applyGameCommand(state, placement)
const begin = (state: GameState) => applyGameCommand(state, activation)
const recover = (state: GameState, ids = [target]) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds: ids })
const candidates = (state: GameState) => getTrashToHandCandidates(state, { sourcePlayerId: playerId, sourceInstanceId: source },
  { cookieOnly: true, keyword: 'arena', hasSpecialPlay: true }).map(card => card.instanceId)

it('102 black placement leaves Stage active and all trash recovery for a separate activation', () => {
  const before = createBs12CoffeeTruckDemoState(), snapshot = structuredClone(before), after = place(before)
  expect(after.players[playerId].stage).toMatchObject({ card: { id: 'BS12-102', instanceId: source }, rested: false })
  expect(after.players[playerId].hand).toEqual([])
  expect(after.players[playerId].supportArea.map(entry => entry.rested)).toEqual([true, false])
  for (const zone of ['battleArea', 'deck', 'breakArea', 'discardPile'] as const) expect(after.players[playerId][zone]).toEqual(before.players[playerId][zone])
  expect(after.players['player-two']).toEqual(before.players['player-two'])
  expect(after.pendingAbilityEffect).toBeFalsy()
  expect(before).toEqual(snapshot)
})
it('102 replacement sends only the old Stage to trash without recovering', () => {
  const before = createBs12CoffeeTruckDemoState('replace'), after = place(before)
  expect(after.players[playerId].discardPile).toEqual([...before.players[playerId].discardPile, before.players[playerId].stage!.card])
  expect(after.players[playerId].stage?.rested).toBe(false)
  expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
})
it.each(['positive', 'crimson', 'pudding', 'strategist', 'mixed', 'zones', 'spare-energy', 'four-targets'] as const)('102 pays before recovering exactly the chosen real printed Cookie: %s', scenario => {
  const before = place(createBs12CoffeeTruckDemoState(scenario)), snapshot = structuredClone(before), chosen = before.players[playerId].discardPile[0]
  const paid = begin(before)
  expect(paid.players[playerId].stage?.rested).toBe(true)
  expect(paid.players[playerId].supportArea.slice(0, 2).map(entry => entry.rested)).toEqual([true, true])
  if (scenario === 'spare-energy') expect(paid.players[playerId].supportArea[2].rested).toBe(false)
  expect(paid.players[playerId].discardPile).toEqual(before.players[playerId].discardPile)
  expect(paid.players[playerId].hand).toEqual(before.players[playerId].hand)
  expect(paid.pendingAbilityEffect?.sourceKind).toBe('stage')
  expect(candidates(paid)).toEqual(scenario === 'four-targets' ? [target, 'bs12-102-other-0', 'bs12-102-other-1', 'bs12-102-other-2'] : [target])
  const after = recover(paid)
  expect(after.players[playerId].hand).toEqual([...before.players[playerId].hand, chosen])
  expect(after.players[playerId].discardPile).toEqual(before.players[playerId].discardPile.slice(1))
  for (const zone of ['deck', 'battleArea', 'breakArea'] as const) expect(after.players[playerId][zone]).toEqual(before.players[playerId][zone])
  expect(after.players['player-two']).toEqual(before.players['player-two'])
  expect(hasPendingCardResolution(after)).toBe(false)
  expect(canActivateStage(after, playerId)).toBe(false)
  expect(before).toEqual(snapshot)
})
it.each(['no-target', 'arena-only', 'special-only', 'split', 'stage-only', 'opponent-only', 'hand-only', 'support-only', 'break-only'] as const)('102 optional zero remains legal and paid with no eligible trash target: %s', scenario => {
  const before = place(createBs12CoffeeTruckDemoState(scenario)), paid = begin(before)
  expect(candidates(paid)).toEqual([])
  const after = paid.pendingAbilityEffect ? recover(paid, []) : paid
  expect(after.players[playerId].stage?.rested).toBe(true)
  expect(after.players[playerId].supportArea.slice(0, 2).every(entry => entry.rested)).toBe(true)
  for (const zone of ['hand', 'discardPile', 'deck', 'battleArea', 'breakArea'] as const) expect(after.players[playerId][zone]).toEqual(before.players[playerId][zone])
  expect(after.players['player-two']).toEqual(before.players['player-two'])
  expect(hasPendingCardResolution(after)).toBe(false)
})
it('102 choosing zero with an eligible target does not refund costs', () => {
  const paid = begin(place(createBs12CoffeeTruckDemoState())), after = recover(paid, [])
  expect(after.players).toEqual(paid.players)
  expect(hasPendingCardResolution(after)).toBe(false)
})
it.each(['bs12-102-other-0', 'bs12-102-other-1', 'bs12-102-other-2'])('102 can select any actual Special Play name: %s', id => {
  const before = begin(place(createBs12CoffeeTruckDemoState('four-targets'))), after = recover(before, [id])
  expect(after.players[playerId].hand.map(card => card.instanceId)).toEqual([id])
  expect(after.players[playerId].discardPile.some(card => card.instanceId === target)).toBe(true)
})
it.each(['no-energy', 'wrong-energy', 'rested-energy'] as const)('102 rejects illegal placement atomically: %s', scenario => {
  const before = createBs12CoffeeTruckDemoState(scenario), snapshot = structuredClone(before)
  expect(() => place(before)).toThrow()
  expect(before).toEqual(snapshot)
})
it.each(['rested-source', 'opponent-turn', 'outside-main', 'no-energy-activate', 'wrong-energy-activate', 'rested-energy-activate'] as const)('102 rejects unavailable activation atomically: %s', scenario => {
  const before = createBs12CoffeeTruckDemoState(scenario), snapshot = structuredClone(before)
  expect(canActivateStage(before, playerId)).toBe(false)
  expect(() => begin(before)).toThrow()
  expect(before).toEqual(snapshot)
})
it('102 one black support cannot fund both placement and activation while rested', () => {
  const before = place(createBs12CoffeeTruckDemoState('one-energy'))
  expect(canActivateStage(before, playerId)).toBe(false)
  expect(() => begin(before)).toThrow()
})
it.each([[], ['bs12-102-payment-0'], ['bs12-102-payment-1', 'bs12-102-payment-1']].map(ids => ({ ids })))('102 rejects missing, spent or duplicate activation payment $ids', ({ ids }) => {
  const before = place(createBs12CoffeeTruckDemoState()), snapshot = structuredClone(before)
  expect(() => applyGameCommand(before, { ...activation, paymentIds: ids })).toThrow()
  expect(before).toEqual(snapshot)
})
it.each([[target, target], [target, 'bs12-102-other-0'], ['missing'], [source]].map(ids => ({ ids })))('102 rejects duplicate, excess or nonexistent recovery $ids', ({ ids }) => {
  const before = begin(place(createBs12CoffeeTruckDemoState('four-targets'))), snapshot = structuredClone(before)
  expect(() => recover(before, ids)).toThrow()
  expect(before).toEqual(snapshot)
})
it.each(['bs12-102-arena-only', 'bs12-102-special-only', 'bs12-102-trash-stage'])('102 refuses a printed intersected-trash counterexample: %s', id => {
  const before = begin(place(createBs12CoffeeTruckDemoState('mixed'))), snapshot = structuredClone(before)
  expect(() => recover(before, [id])).toThrow()
  expect(before).toEqual(snapshot)
})
it.each(['hand', 'support', 'break', 'opponent'])('102 refuses the same eligible printed Cookie in wrong zone: %s', zone => {
  const before = begin(place(createBs12CoffeeTruckDemoState('zones'))), snapshot = structuredClone(before)
  expect(() => recover(before, [`bs12-102-${zone}-target`])).toThrow()
  expect(before).toEqual(snapshot)
})
it('102 no printed once restriction is added, and readying alone never restores spent support', () => {
  const paid = recover(begin(place(createBs12CoffeeTruckDemoState('spare-energy'))))
  expect(paid.skillUsesThisTurn).not.toContain(source)
  const ready = { ...paid, players: { ...paid.players, [playerId]: { ...paid.players[playerId], stage: { ...paid.players[playerId].stage!, rested: false } } } }
  expect(canActivateStage(ready, playerId)).toBe(true)
  const second = applyGameCommand(ready, { ...activation, paymentIds: ['bs12-102-payment-2'] })
  expect(second.players[playerId].supportArea.every(entry => entry.rested)).toBe(true)
  expect(second.players[playerId].stage?.rested).toBe(true)
})
it('102 AI uses the same paid recovery decision without repeating payment', () => {
  const before = begin(place(createBs12CoffeeTruckDemoState())), after = takeAiStep(before, playerId).state
  expect(after.players[playerId].hand.map(card => card.instanceId)).toEqual([target])
  expect(after.players[playerId].supportArea.every(entry => entry.rested)).toBe(true)
  expect(after.players[playerId].stage?.rested).toBe(true)
  expect(hasPendingCardResolution(after)).toBe(false)
})
it('102 logs real Stage REST, energy, recovered card and explicit zero outcome', () => {
  const before = place(createBs12CoffeeTruckDemoState()), paid = begin(before)
  expect(describeCommandSteps(before, paid, activation)?.map(step => step.text).join(' ')).toMatch(/場景代價.*Manager Scarlet.*支付能量/s)
  const command = { kind: 'resolve-ability-effect' as const, playerId, targetIds: [target] }
  expect(describeCommandSteps(paid, recover(paid), command)?.map(step => step.text).join(' ')).toMatch(/Blueberry Cake Hound.*棄牌區.*手牌/)
  expect(describeCommandSteps(paid, recover(paid, []), { ...command, targetIds: [] })?.map(step => step.text).join(' ')).toMatch(/選擇 0 個目標，此段可選效果未執行/)
})
it.each(BS12_COFFEE_TRUCK_SCENARIOS)('102 finite local fixture %s preserves printed card capacities', scenario => {
  expect(parseTestStateConfig(`?test-state=bs12-102:${scenario}`, 'localhost')).toEqual({ kind: 'bs12-102', scenario })
  expect(parseTestStateConfig(`?test-state=bs12-102:${scenario}`, 'example.com')).toBeNull()
  const state = createBs12CoffeeTruckDemoState(scenario)
  for (const player of Object.values(state.players)) {
    expect(player.battleArea.length).toBeLessThanOrEqual(2)
    expect(player.breakArea.reduce((sum, card) => sum + card.level, 0)).toBeLessThan(10)
    const cards = [...player.hand, ...player.deck, ...player.discardPile, ...player.breakArea, ...player.supportArea.map(entry => entry.card),
      ...player.battleArea.flatMap(entry => [entry.card, ...entry.hpCards]), ...(player.stage ? [player.stage.card] : [])]
    expect(new Set(cards.map(card => card.instanceId)).size).toBe(cards.length)
    for (const id of new Set(cards.map(card => card.id))) expect(cards.filter(card => card.id === id).length).toBeLessThanOrEqual(4)
  }
})
