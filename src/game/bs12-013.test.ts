import { describe, expect, it } from 'vitest'
import { createBs12RecordDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { getAttackDamageAgainst, getEffectTargetCandidatesForEffect } from './effects'
import { canActivateCookieSkill } from './skills'
import { describeCommandSteps } from './command-log'

const playerId = 'player-one' as const
const itemId = 'bs12-013-item'
const paymentId = 'bs12-013-payment-0'
const first = 'bs12-013-first'
const second = 'bs12-013-second'
const opponent = 'bs12-013-opponent-0'
const begin = (state = createBs12RecordDemoState(), paymentIds = [paymentId]) =>
  applyGameCommand(state, { kind: 'begin-play-item', playerId, instanceId: itemId, paymentIds })
const resolve = (state: ReturnType<typeof begin>, targetIds: string[]) =>
  applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds })

describe('BS12-013 same-target attack bonus and ready Then', () => {
  it('isolates the candidate route to localhost', () => {
    expect(parseTestStateConfig('?test-state=bs12-013:positive', 'localhost')).toEqual({ kind: 'bs12-013', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-013:positive', 'example.com')).toBeNull()
  })
  it('pays only one R and puts the item in trash before modifying or readying', () => {
    const before = createBs12RecordDemoState()
    const snapshot = structuredClone(before)
    const after = begin(before)
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].discardPile.map(card => card.instanceId)).toEqual([itemId])
    expect(after.players[playerId].supportArea.map(card => card.rested)).toEqual([true, false, false, false])
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.attackModifiers).toEqual([])
    expect(before).toEqual(snapshot)
  })
  it.each([{ ids: [] }, { ids: [first] }, { ids: [paymentId, paymentId] }, { ids: [paymentId, 'bs12-013-payment-1'] }])('rejects invalid payment $ids atomically', ({ ids }) => {
    const before = createBs12RecordDemoState()
    const snapshot = structuredClone(before)
    expect(() => begin(before, ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each(['no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn'] as const)('rejects %s before any cost or effect', scenario => {
    const before = createBs12RecordDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(() => begin(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each(['active', 'draw', 'support', 'end'] as const)('rejects item use in %s', phase => {
    expect(() => begin({ ...createBs12RecordDemoState(), phase })).toThrow()
  })
  it.each([first, second])('adds exactly one attack damage and readies only %s', id => {
    const before = begin()
    const snapshot = structuredClone(before)
    const command = { kind: 'resolve-ability-effect' as const, playerId, targetIds: [id] }
    const after = applyGameCommand(before, command)
    expect(after.pendingAbilityEffect).toBeUndefined()
    expect(after.attackModifiers).toMatchObject([{ sourceInstanceId: itemId, targetInstanceId: id, amount: 1, expiresAfterTurn: 2 }])
    expect(after.attackModifiers).toHaveLength(1)
    expect(getAttackDamageAgainst(after, first, opponent)).toBe(id === first ? 4 : 3)
    expect(getAttackDamageAgainst(after, second, opponent)).toBe(id === second ? 5 : 4)
    expect(after.players[playerId].battleArea.map(card => card.rested)).toEqual(id === first ? [false, true] : [true, false])
    expect(after.players[playerId].battleArea.map(card => card.hpCards)).toEqual(before.players[playerId].battleArea.map(card => card.hpCards))
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    for (const zone of ['hand', 'deck', 'supportArea', 'discardPile', 'stage'] as const) expect(after.players[playerId][zone]).toEqual(before.players[playerId][zone])
    for (const card of after.players[playerId].battleArea) expect(Boolean(after.cookiesSetActiveByEffectThisTurn?.[card.battleEntryId!])).toBe(id === card.card.instanceId)
    expect(before).toEqual(snapshot)
    expect(describeCommandSteps(before, after, command)?.map(step => step.text).join(' '))
      .toContain(`Then 結算：${id === first ? 'Cheerleader Cookie' : 'Langue de Chat Cookie'} 已設為活躍（沿用同一張目標）。`)
  })
  it('zero target pays R but neither segment selects a fallback Cookie', () => {
    const before = begin()
    const command = { kind: 'resolve-ability-effect' as const, playerId, targetIds: [] }
    const after = applyGameCommand(before, command)
    expect(after.players).toEqual(before.players)
    expect(after.attackModifiers).toEqual([])
    expect(after.cookiesSetActiveByEffectThisTurn ?? {}).toEqual({})
    expect(after.pendingAbilityEffect).toBeUndefined()
    expect(describeCommandSteps(before, after, command)?.map(step => step.text).join(' '))
      .toContain('Then 結算：未選擇餅乾，未將任何餅乾設為活躍。')
  })
  it.each(['wrong-color', 'wrong-keyword', 'no-target'] as const)('requires both target filters for %s', scenario => {
    const before = begin(createBs12RecordDemoState(scenario))
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
      expect(() => resolve(before, ['bs12-013-mic'])).toThrow()
      expect(resolve(before, []).players).toEqual(before.players)
    }
  })
  it.each([{ ids: [paymentId] }, { ids: [opponent] }, { ids: [first, first] }, { ids: [first, second] }])('rejects invalid target list $ids atomically', ({ ids }) => {
    const before = begin()
    const snapshot = structuredClone(before)
    expect(() => resolve(before, ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('accepts an active target and clears both the bonus and Cheerleader event after this turn', () => {
    const after = resolve(begin(createBs12RecordDemoState('active-target')), [first])
    expect(canActivateCookieSkill(after, playerId, first, 'activate')).toBe(true)
    const next = applyGameCommand(applyGameCommand(after, { kind: 'advance-phase', playerId }), { kind: 'advance-phase', playerId })
    expect(next.cookiesSetActiveByEffectThisTurn).toEqual({})
    expect(getAttackDamageAgainst(next, first, opponent)).toBe(3)
    expect(getAttackDamageAgainst(next, second, opponent)).toBe(4)
  })
  it.each([first, second])('a real paid attack from %s declares the buffed damage and rests only its attacker', id => {
    const before = resolve(begin(), [id])
    const after = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: id, targetInstanceId: opponent,
      supportPaymentIds: ['bs12-013-payment-1', 'bs12-013-payment-2', 'bs12-013-payment-3'] })
    expect(after.pendingBattle).toMatchObject({ declaredDamage: id === first ? 4 : 5, attackerInstanceId: id, targetInstanceId: opponent })
    expect(after.players[playerId].battleArea.every(card => card.rested)).toBe(true)
    expect(after.players[playerId].supportArea.every(card => card.rested)).toBe(true)
  })
  it.each([{ ids: [] }, { ids: [second] }])('atomic play-item also preserves target linkage for $ids', ({ ids }) => {
    const after = applyGameCommand(createBs12RecordDemoState(), { kind: 'play-item', playerId, instanceId: itemId, paymentIds: [paymentId], effectTargets: [ids] })
    expect(after.players[playerId].battleArea.map(card => card.rested)).toEqual(ids.length ? [true, false] : [true, true])
    expect(after.attackModifiers.map(modifier => modifier.targetInstanceId)).toEqual(ids)
  })
})
