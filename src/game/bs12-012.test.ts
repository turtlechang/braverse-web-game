import { describe, expect, it } from 'vitest'
import { createBs12GuitarDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { getEffectTargetCandidatesForEffect } from './effects'
import { canActivateCookieSkill } from './skills'
import { describeCommandSteps } from './command-log'

const playerId = 'player-one' as const
const itemId = 'bs12-012-item'
const paymentId = 'bs12-012-payment'
const first = 'bs12-012-first'
const second = 'bs12-012-second'
const begin = (state = createBs12GuitarDemoState(), paymentIds = [paymentId]) =>
  applyGameCommand(state, { kind: 'begin-play-item', playerId, instanceId: itemId, paymentIds })
const resolve = (state: ReturnType<typeof begin>, targetIds: string[]) =>
  applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds })

describe('BS12-012 paid item and optional red Arena readying', () => {
  it('isolates the candidate route to localhost', () => {
    expect(parseTestStateConfig('?test-state=bs12-012:positive', 'localhost')).toEqual({ kind: 'bs12-012', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-012:positive', 'example.com')).toBeNull()
  })
  it('pays R and puts the item in trash before the target decision without changing Cookies', () => {
    const before = createBs12GuitarDemoState()
    const snapshot = structuredClone(before)
    const after = begin(before)
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].discardPile.map(card => card.instanceId)).toEqual([itemId])
    expect(after.players[playerId].supportArea[0].rested).toBe(true)
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.pendingAbilityEffect).toMatchObject({ sourceKind: 'item', sourceInstanceId: itemId })
    expect(after.pendingOnPlay).toBe(before.pendingOnPlay)
    expect(before).toEqual(snapshot)
  })
  it.each([{ ids: [] }, { ids: [first] }, { ids: [paymentId, paymentId] }])('rejects invalid payment $ids atomically', ({ ids }) => {
    const before = createBs12GuitarDemoState()
    const snapshot = structuredClone(before)
    expect(() => begin(before, ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each(['no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn'] as const)('rejects %s before any cost or effect', scenario => {
    const before = createBs12GuitarDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(() => begin(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each(['active', 'draw', 'support', 'end'] as const)('rejects item use in %s', phase => {
    expect(() => begin({ ...createBs12GuitarDemoState(), phase })).toThrow()
  })
  it.each([{ ids: [] }, { ids: [first] }, { ids: [second] }, { ids: [first, second] }, { ids: [second, first] }])('resolves zero, one or two targets $ids exactly', ({ ids }) => {
    const before = begin()
    const snapshot = structuredClone(before)
    const command = { kind: 'resolve-ability-effect' as const, playerId, targetIds: ids }
    const after = applyGameCommand(before, command)
    expect(after.pendingAbilityEffect).toBeUndefined()
    expect(after.players[playerId].battleArea.map(card => card.rested)).toEqual([!ids.includes(first), !ids.includes(second)])
    expect(after.players[playerId].battleArea.map(card => card.hpCards)).toEqual(before.players[playerId].battleArea.map(card => card.hpCards))
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    for (const zone of ['hand', 'deck', 'supportArea', 'discardPile', 'stage'] as const) expect(after.players[playerId][zone]).toEqual(before.players[playerId][zone])
    for (const card of after.players[playerId].battleArea) expect(Boolean(after.cookiesSetActiveByEffectThisTurn?.[card.battleEntryId!])).toBe(ids.includes(card.card.instanceId))
    const log = describeCommandSteps(before, after, command)?.map(step => step.text).join(' ') ?? ''
    expect(log).toContain(ids.length ? '效果目標' : '選擇 0 個目標')
    for (const id of ids) expect(log).toContain(id === first ? 'Cheerleader Cookie' : 'Langue de Chat Cookie')
    expect(before).toEqual(snapshot)
  })
  it.each(['wrong-color', 'wrong-keyword', 'no-target'] as const)('requires the color and Arena intersection for %s', scenario => {
    const before = begin(createBs12GuitarDemoState(scenario))
    const excluded = before.players[playerId].battleArea[1].card
    if (scenario === 'wrong-keyword') {
      expect(excluded.energyColor).toBe('red')
      expect(excluded.keywords ?? []).not.toContain('arena')
    } else if (scenario === 'wrong-color') {
      expect(excluded.energyColor).toBe('green')
      expect(excluded.keywords).toContain('arena')
    }
    expect(getEffectTargetCandidatesForEffect(before, { sourcePlayerId: playerId, sourceInstanceId: itemId }, before.pendingAbilityEffect!.effects[0]).map(card => card.card.instanceId))
      .toEqual(scenario === 'no-target' ? [] : [first])
    expect(() => resolve(before, [second])).toThrow()
    if (scenario === 'no-target') {
      expect(() => resolve(before, ['bs12-012-mic'])).toThrow()
      expect(resolve(before, []).players).toEqual(before.players)
    }
  })
  it.each([{ ids: [paymentId] }, { ids: ['bs12-012-opponent'] }, { ids: [first, first] }, { ids: [first, second, 'bs12-012-opponent'] }])('rejects target list $ids atomically', ({ ids }) => {
    const before = begin()
    const snapshot = structuredClone(before)
    expect(() => resolve(before, ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('records an effect event even for an already active target and enables Cheerleader for this turn', () => {
    const after = resolve(begin(createBs12GuitarDemoState('active-target')), [first])
    expect(canActivateCookieSkill(after, playerId, first, 'activate')).toBe(true)
    const zero = resolve(begin(), [])
    expect(canActivateCookieSkill(zero, playerId, first, 'activate')).toBe(false)
    const next = applyGameCommand(applyGameCommand(after, { kind: 'advance-phase', playerId }), { kind: 'advance-phase', playerId })
    expect(next.cookiesSetActiveByEffectThisTurn).toEqual({})
  })
  it('the atomic item command uses the same payment and two-target effect', () => {
    const before = createBs12GuitarDemoState()
    const after = applyGameCommand(before, { kind: 'play-item', playerId, instanceId: itemId, paymentIds: [paymentId], effectTargets: [[second, first]] })
    expect(after.players[playerId].battleArea.every(card => !card.rested)).toBe(true)
    expect(after.players[playerId].discardPile.map(card => card.instanceId)).toEqual([itemId])
    expect(after.players[playerId].supportArea[0].rested).toBe(true)
  })
})
