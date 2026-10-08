import { describe, expect, it } from 'vitest'
import { createBs12StageDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateStage } from './card-abilities'
import { getEffectTargetCandidatesForEffect } from './effects'
import { canActivateCookieSkill } from './skills'
import { describeCommandSteps } from './command-log'

const playerId = 'player-one' as const
const stageId = 'bs12-011-stage'
const paymentId = 'bs12-011-payment'
const first = 'bs12-011-first'
const second = 'bs12-011-second'
const place = (state: ReturnType<typeof createBs12StageDemoState>, ids = [paymentId]) =>
  applyGameCommand(state, { kind: 'play-stage', playerId, instanceId: stageId, paymentIds: ids })
const end = (state: ReturnType<typeof createBs12StageDemoState>) => {
  const id = state.activePlayerId
  state = applyGameCommand(state, { kind: 'advance-phase', playerId: id })
  return applyGameCommand(state, { kind: 'advance-phase', playerId: id })
}
const open = (scenario: Parameters<typeof createBs12StageDemoState>[0] = 'positive') => end(place(createBs12StageDemoState(scenario)))
const resolve = (state: ReturnType<typeof open>, targetIds: string[]) =>
  applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds })

describe('BS12-011 placement and own end-turn Arena readying', () => {
  it('isolates the preview route to localhost', () => {
    expect(parseTestStateConfig('?test-state=bs12-011:positive', 'localhost')).toEqual({ kind: 'bs12-011', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-011:positive', 'example.com')).toBeNull()
  })
  it('pays R and places without changing Cookies, HP or creating On Play', () => {
    const before = createBs12StageDemoState()
    const snapshot = structuredClone(before)
    const after = place(before)
    expect(after.players[playerId].stage).toMatchObject({ card: { id: 'BS12-011', instanceId: stageId }, rested: false })
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].supportArea[0].rested).toBe(true)
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.pendingAbilityEffect).toBeUndefined()
    expect(after.pendingOnPlay).toBe(before.pendingOnPlay)
    expect(canActivateStage(after, playerId)).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it.each(['no-energy', 'wrong-energy', 'rested-energy'] as const)('rejects %s without mutation', scenario => {
    const before = createBs12StageDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(() => place(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([{ ids: [] }, { ids: [paymentId, paymentId] }, { ids: ['bs12-011-first'] }])('rejects invalid payment $ids', ({ ids }) => {
    expect(() => place(createBs12StageDemoState(), ids)).toThrow()
  })
  it.each(['active', 'draw', 'support', 'end'] as const)('rejects placement in %s', phase => {
    expect(() => place({ ...createBs12StageDemoState(), phase })).toThrow()
  })
  it('replaces the old Stage and triggers only the new source', () => {
    const placed = place(createBs12StageDemoState('replaced'))
    expect(placed.players[playerId].discardPile.map(card => card.instanceId)).toEqual(['bs12-011-old-stage'])
    expect(end(placed).pendingAbilityEffect?.sourceInstanceId).toBe(stageId)
  })
  it('waits through main and provides both own Arena Cookies, including green', () => {
    const placed = place(createBs12StageDemoState())
    const ending = applyGameCommand(placed, { kind: 'advance-phase', playerId })
    expect(ending.phase).toBe('end')
    expect(ending.pendingAbilityEffect).toBeUndefined()
    const pending = applyGameCommand(ending, { kind: 'advance-phase', playerId })
    expect(pending.pendingAbilityEffect).toMatchObject({ sourceKind: 'stage', trigger: 'passive', sourceInstanceId: stageId })
    const effect = pending.pendingAbilityEffect!.effects[0]
    expect(getEffectTargetCandidatesForEffect(pending, { sourcePlayerId: playerId, sourceInstanceId: stageId }, effect).map(c => c.card.instanceId)).toEqual([first, second])
  })
  it.each([first, second])('readies only %s and keeps all zones and HP unchanged', id => {
    const before = open()
    const snapshot = structuredClone(before)
    const command = { kind: 'resolve-ability-effect' as const, playerId, targetIds: [id] }
    const after = applyGameCommand(before, command)
    expect(after.players[playerId].battleArea.map(c => c.rested)).toEqual(id === first ? [false, true] : [true, false])
    expect(after.players[playerId].battleArea.map(c => c.hpCards)).toEqual(before.players[playerId].battleArea.map(c => c.hpCards))
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    for (const zone of ['deck', 'hand', 'supportArea', 'discardPile', 'stage'] as const) expect(after.players[playerId][zone]).toEqual(before.players[playerId][zone])
    expect(after.pendingAbilityEffect).toBeUndefined()
    expect(describeCommandSteps(before, after, command)?.map(s => s.text).join(' ')).toContain(id === first ? 'Cheerleader Cookie' : 'Pancake Cookie')
    expect(before).toEqual(snapshot)
  })
  it('zero selection records no ready event and does not retrigger on resume', () => {
    const before = open()
    const after = resolve(before, [])
    expect(after.players).toEqual(before.players)
    expect(after.cookiesSetActiveByEffectThisTurn ?? {}).toEqual({})
    const next = applyGameCommand(after, { kind: 'advance-phase', playerId })
    expect(next.pendingAbilityEffect).toBeUndefined()
    expect(next.activePlayerId).toBe('player-two')
  })
  it.each(['non-arena', 'mic-equipped', 'no-target'] as const)('filters %s independently of legal R payment', scenario => {
    const before = open(scenario)
    const effect = before.pendingAbilityEffect!.effects[0]
    const expected = scenario === 'non-arena' ? [first] : scenario === 'mic-equipped' ? [second] : []
    expect(getEffectTargetCandidatesForEffect(before, { sourcePlayerId: playerId, sourceInstanceId: stageId }, effect).map(c => c.card.instanceId)).toEqual(expected)
    expect(() => resolve(before, [scenario === 'non-arena' ? second : 'bs12-011-mic'])).toThrow()
  })
  it.each([{ targets: ['bs12-011-opponent'] }, { targets: [paymentId] }, { targets: [first, second] }, { targets: [first, first] }])('rejects target list $targets atomically', ({ targets }) => {
    const before = open()
    const snapshot = structuredClone(before)
    expect(() => resolve(before, targets)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('accepts an already active Arena target and records the effect event for this turn only', () => {
    const before = open('active-target')
    const after = resolve(before, [first])
    expect(after.players[playerId].battleArea[0].rested).toBe(false)
    expect(after.cookiesSetActiveByEffectThisTurn?.[after.players[playerId].battleArea[0].battleEntryId!]).toBe(true)
    expect(canActivateCookieSkill({ ...after, phase: 'main' }, playerId, first, 'activate')).toBe(true)
    const next = applyGameCommand(after, { kind: 'advance-phase', playerId })
    expect(next.cookiesSetActiveByEffectThisTurn).toEqual({})
  })
  it.each(['opponent-turn', 'removed'] as const)('does not trigger from %s', scenario => {
    const before = createBs12StageDemoState(scenario)
    const after = end(before)
    expect(after.pendingAbilityEffect).toBeUndefined()
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
  })
  it('a rested Stage still supplies its printed end-turn effect', () => {
    const pending = end(createBs12StageDemoState('rested-stage'))
    expect(pending.pendingAbilityEffect?.sourceInstanceId).toBe(stageId)
    expect(resolve(pending, [second]).players[playerId].battleArea[1].rested).toBe(false)
  })
})
