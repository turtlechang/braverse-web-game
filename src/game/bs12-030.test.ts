import { describe, expect, it } from 'vitest'
import { createBs12WorkshopDemoState, parseTestStateConfig, type Bs12WorkshopScenario } from './demo'
import { applyGameCommand } from './commands'
import { canActivateStage, getStageActivationSource } from './card-abilities'
import { getEffectTargetCandidatesForEffect, executeCardEffect } from './effects'
import { describeCommandSteps } from './command-log'
import { takeAiStep } from './ai'

const playerId = 'player-one' as const
const stageId = 'bs12-030-stage'
const targetId = 'bs12-030-target'
const place = (state: ReturnType<typeof createBs12WorkshopDemoState>, ids = ['bs12-030-payment-0']) => applyGameCommand(state, { kind: 'play-stage', playerId, instanceId: stageId, paymentIds: ids })
const beginCommand = { kind: 'begin-activate-stage' as const, playerId, paymentIds: ['bs12-030-payment-1'] }
const begin = (state: ReturnType<typeof createBs12WorkshopDemoState>) => applyGameCommand(state, beginCommand)
const resolve = (state: ReturnType<typeof createBs12WorkshopDemoState>, targetIds = [targetId]) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds })
const scenarios = ['positive', 'faint', 'green-arena', 'hand-break', 'removed-break', 'old-break', 'previous-turn', 'non-arena', 'opponent-break', 'trash-arena', 'no-event', 'no-energy', 'wrong-energy', 'rested-energy', 'one-energy', 'rested-source', 'opponent-turn', 'wrong-phase', 'non-arena-target', 'red-target', 'rested-target', 'equipment', 'support-only', 'no-target', 'replace', 'placed', 'refresh'] satisfies Bs12WorkshopScenario[]

describe('BS12-030 real Stage placement and activation', () => {
  it('keeps the candidate route local', () => {
    expect(parseTestStateConfig('?test-state=bs12-030:positive', 'localhost')).toEqual({ kind: 'bs12-030', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-030:positive', 'example.com')).toBeNull()
  })
  it('pays placement Y without HP, activation or premature resting of Stage', () => {
    const before = createBs12WorkshopDemoState()
    const snapshot = structuredClone(before)
    const after = place(before)
    expect(after.players[playerId].stage).toMatchObject({ card: { id: 'BS12-030', instanceId: stageId }, rested: false })
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].supportArea.map(s => s.rested)).toEqual([true, false])
    for (const zone of ['battleArea', 'deck', 'breakArea', 'discardPile'] as const) expect(after.players[playerId][zone]).toEqual(before.players[playerId][zone])
    expect(after.pendingAbilityEffect).toBeFalsy()
    expect(before).toEqual(snapshot)
  })
  it('places a replacement and trashes only the prior Stage', () => {
    const before = createBs12WorkshopDemoState('replace')
    const after = place(before)
    expect(after.players[playerId].discardPile).toEqual([...before.players[playerId].discardPile, before.players[playerId].stage!.card])
    expect(after.players[playerId].stage?.card.instanceId).toBe(stageId)
  })
  it.each(['positive', 'faint', 'green-arena', 'hand-break', 'removed-break', 'non-arena-target', 'red-target', 'rested-target', 'equipment', 'replace'] as const)('pays activation Y plus source rest before optional own +1 top HP: %s', scenario => {
    const before = place(createBs12WorkshopDemoState(scenario))
    const snapshot = structuredClone(before)
    expect(canActivateStage(before, playerId)).toBe(true)
    const paid = begin(before)
    expect(paid.players[playerId].stage?.rested).toBe(true)
    expect(paid.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(paid.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(paid.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(paid.pendingAbilityEffect).toMatchObject({ sourceKind: 'stage', sourceInstanceId: stageId })
    const effect = paid.pendingAbilityEffect!.effects[0]
    expect(getEffectTargetCandidatesForEffect(paid, { sourcePlayerId: playerId, sourceInstanceId: stageId }, effect).map(c => c.card.instanceId)).toEqual([targetId, 'bs12-030-other'])
    const after = resolve(paid)
    expect(after.players[playerId].battleArea[0].hpCards).toEqual([...before.players[playerId].battleArea[0].hpCards, before.players[playerId].deck[0]])
    expect(after.players[playerId].battleArea[1]).toEqual(before.players[playerId].battleArea[1])
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(1))
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(after.pendingAbilityEffect).toBeFalsy()
    expect(before).toEqual(snapshot)
  })
  it.each(['old-break', 'previous-turn', 'non-arena', 'opponent-break', 'trash-arena', 'no-event'] as const)('pays and rests but explicitly records condition no-op: %s', scenario => {
    const before = place(createBs12WorkshopDemoState(scenario))
    const snapshot = structuredClone(before)
    expect(canActivateStage(before, playerId)).toBe(true)
    const after = begin(before)
    expect(after.players[playerId].stage?.rested).toBe(true)
    expect(after.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.pendingAbilityEffect).toBeFalsy()
    const steps = describeCommandSteps(before, after, beginCommand) ?? []
    expect(steps.some(s => /場景效果結果：條件不成立，效果未執行/.test(s.text))).toBe(true)
    expect(before).toEqual(snapshot)
  })
  it.each(['support-only', 'no-target'] as const)('allows zero own battle targets after a true event: %s', scenario => {
    const before = place(createBs12WorkshopDemoState(scenario))
    const paid = begin(before)
    const after = resolve(paid, [])
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].battleArea).toEqual([])
    expect(after.pendingAbilityEffect).toBeFalsy()
  })
  it('selects zero without refunding costs or leaking HP identity', () => {
    const before = place(createBs12WorkshopDemoState())
    const paid = begin(before)
    const command = { kind: 'resolve-ability-effect' as const, playerId, targetIds: [] }
    const after = applyGameCommand(paid, command)
    expect(after.players).toEqual(paid.players)
    expect(describeCommandSteps(paid, after, command)?.some(s => /未增加 HP/.test(s.text))).toBe(true)
  })
  it.each(['no-energy', 'wrong-energy', 'rested-energy'] as const)('rejects placement payment atomically: %s', scenario => {
    const state = createBs12WorkshopDemoState(scenario)
    const snapshot = structuredClone(state)
    expect(() => place(state)).toThrow()
    expect(state).toEqual(snapshot)
  })
  it('one yellow support can place but cannot also activate while rested', () => {
    const placed = place(createBs12WorkshopDemoState('one-energy'))
    expect(canActivateStage(placed, playerId)).toBe(false)
    expect(() => begin(placed)).toThrow()
  })
  it.each(['rested-source', 'opponent-turn', 'wrong-phase'] as const)('rejects unavailable Stage activation atomically: %s', scenario => {
    const state = createBs12WorkshopDemoState(scenario)
    const snapshot = structuredClone(state)
    expect(canActivateStage(state, playerId)).toBe(false)
    expect(getStageActivationSource(state, 'player-two')).toBeNull()
    expect(() => begin(state)).toThrow()
    expect(state).toEqual(snapshot)
  })
  it.each([[], ['bs12-030-payment-0'], ['bs12-030-payment-1', 'bs12-030-payment-1']].map(ids => ({ ids })))('rejects unpaid, spent or duplicate activation support $ids', ({ ids }) => {
    const state = place(createBs12WorkshopDemoState())
    const snapshot = structuredClone(state)
    expect(() => applyGameCommand(state, { ...beginCommand, paymentIds: ids })).toThrow()
    expect(state).toEqual(snapshot)
  })
  it.each([[targetId, 'bs12-030-other'], [targetId, targetId], ['bs12-030-payment-1'], ['bs12-021-opponent'], ['bs12-030-equipped']].map(ids => ({ ids })))('rejects excess, duplicate and wrong-zone targets $ids', ({ ids }) => {
    const state = begin(place(createBs12WorkshopDemoState('equipment')))
    const snapshot = structuredClone(state)
    expect(() => resolve(state, ids)).toThrow()
    expect(state).toEqual(snapshot)
  })
  it('Stage rest prevents reuse, but no printed once-per-turn restriction is invented', () => {
    let state = resolve(begin(place(createBs12WorkshopDemoState())))
    expect(canActivateStage(state, playerId)).toBe(false)
    expect(state.skillUsesThisTurn).not.toContain(stageId)
    state = { ...state, players: { ...state.players, [playerId]: { ...state.players[playerId], stage: { ...state.players[playerId].stage!, rested: false }, supportArea: state.players[playerId].supportArea.map(s => ({ ...s, rested: false })) } } }
    expect(canActivateStage(state, playerId)).toBe(true)
    expect(resolve(begin(state)).players[playerId].battleArea[0].hpCards).toHaveLength(4)
  })
  it('last top HP waits for Refresh and then clears the ability without duplicating HP', () => {
    const placed = place(createBs12WorkshopDemoState('refresh'))
    let state = resolve(begin(placed))
    expect(state.players[playerId].battleArea[0].hpCards).toHaveLength(3)
    expect(state.players[playerId].deck).toEqual([])
    expect(state.pendingRefresh?.playerId).toBe(playerId)
    state = applyGameCommand(state, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-030-refresh-cost', shuffleSeed: 3 })
    expect(state.players[playerId].battleArea[0].hpCards).toHaveLength(3)
    expect(state.players[playerId].deck).toHaveLength(6)
    expect(state.pendingAbilityEffect).toBeFalsy()
    expect(state.pendingRefresh).toBeFalsy()
  })
  it('records source-rest, energy and actual +1 HP without exposing new HP card', () => {
    const before = place(createBs12WorkshopDemoState())
    const paid = begin(before)
    const steps = describeCommandSteps(before, paid, beginCommand) ?? []
    expect(steps.some(s => /場景代價.*Well-Lit Workshop/.test(s.text))).toBe(true)
    expect(steps.some(s => /支付能量/.test(s.text))).toBe(true)
    const command = { kind: 'resolve-ability-effect' as const, playerId, targetIds: [targetId] }
    const after = applyGameCommand(paid, command)
    const results = describeCommandSteps(paid, after, command) ?? []
    expect(results.some(s => /GingerBrave.*增加 1 點 HP/.test(s.text))).toBe(true)
    expect(results.flatMap(s => s.cards ?? []).some(c => c.instanceId.startsWith('bs12-030-deck'))).toBe(false)
  })
  it('AI resolves the same paid Stage HP decision without repeating costs', () => {
    const before = begin(place(createBs12WorkshopDemoState()))
    const step = takeAiStep(before, playerId)
    expect(step.state.players[playerId].stage?.rested).toBe(true)
    expect(step.state.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(step.state.pendingAbilityEffect).toBeFalsy()
    expect(step.state.players[playerId].battleArea.reduce((sum, c) => sum + c.hpCards.length, 0)).toBe(4)
    expect(step.state.players[playerId].deck).toHaveLength(11)
  })
  it('only the own current event satisfies the printed condition after placement', () => {
    const state = place(createBs12WorkshopDemoState('no-event'))
    const withEvent = executeCardEffect(state, { sourcePlayerId: playerId, sourceInstanceId: stageId }, { kind: 'battle-to-break', target: { side: 'self', min: 1, max: 1 } }, [targetId])
    expect(withEvent.arenaCookiesPlacedInBreakThisTurn?.[playerId]).toBe(1)
  })
  it.each(scenarios)('keeps physical-card capacity and legal break LV in fixture: %s', scenario => {
    const state = createBs12WorkshopDemoState(scenario)
    for (const p of Object.values(state.players)) {
      expect(p.battleArea.length).toBeLessThanOrEqual(2)
      expect(p.breakArea.reduce((sum, c) => sum + c.level, 0)).toBeLessThan(10)
    }
    const cards = Object.values(state.players).flatMap(p => [...p.hand, ...p.breakArea, ...p.discardPile, ...p.supportArea.map(s => s.card), ...p.battleArea.flatMap(c => [c.card, ...(c.equippedCards ?? [])]), ...(p.stage ? [p.stage.card] : [])]).filter(c => /^(BS|ST|P)-?\d/.test(c.id))
    for (const id of new Set(cards.map(c => c.id))) expect(cards.filter(c => c.id === id).length).toBeLessThanOrEqual(4)
  })
})
