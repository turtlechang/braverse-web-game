import { describe, expect, it } from 'vitest'
import { createBs12PositionCostDemoState, createBs12ActivateDemoState, createBs12AttackDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { getBattleCookiePositionCostCandidates } from './battle-position-cost'
import { takeAiStep } from './ai'

const playerId = 'player-one' as const
const sourceInstanceId = 'bs12-006-source'
const companion = 'bs12-006-companion'
const opponent = 'bs12-006-opponent'
const command = { kind: 'activate-skill' as const, playerId, sourceInstanceId, trigger: 'activate' as const,
  paymentIds: ['bs12-006-payment'], positionCostTargetIds: [companion], effectTargets: [[opponent]] }

describe('BS12-006 printed status cost and damage', () => {
  it('only exposes its candidate route on localhost', () => {
    expect(parseTestStateConfig('?test-state=bs12-006:positive', 'localhost')).toEqual({ kind: 'bs12-006', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-006:positive', 'example.com')).toBeNull()
  })
  it('pays 1R and readies a non-red Arena Cookie before dealing 1 damage', () => {
    const before = createBs12PositionCostDemoState('positive')
    const snapshot = structuredClone(before)
    expect(before.players[playerId].battleArea[1].card.energyColor).toBe('green')
    const after = applyGameCommand(before, command)
    expect(after.players[playerId].supportArea[0].rested).toBe(true)
    expect(after.players[playerId].battleArea.map(cookie => cookie.rested)).toEqual([false, false])
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(5)
    expect(after.players['player-two'].discardPile).toHaveLength(before.players['player-two'].discardPile.length + 1)
    expect(after.cookiesSetActiveByEffectThisTurn ?? {}).toEqual({})
    expect(canActivateCookieSkill(after, playerId, sourceInstanceId, 'activate')).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it('allows its own rested source as the cost, and still permits zero damage targets', () => {
    const before = createBs12PositionCostDemoState('self')
    const after = applyGameCommand(before, { ...command, positionCostTargetIds: [sourceInstanceId], effectTargets: [[]] })
    expect(after.players[playerId].battleArea.map(cookie => cookie.rested)).toEqual([false, true])
    expect(after.players[playerId].supportArea[0].rested).toBe(true)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(canActivateCookieSkill(after, playerId, sourceInstanceId, 'activate')).toBe(false)
  })
  it('begin pays both costs once, and resolve only applies damage', () => {
    const before = createBs12PositionCostDemoState('positive')
    const paid = applyGameCommand(before, { ...command, kind: 'begin-activate-skill' })
    expect(paid.pendingAbilityEffect?.sourceInstanceId).toBe(sourceInstanceId)
    expect(paid.players['player-two']).toEqual(before.players['player-two'])
    expect(paid.players[playerId].battleArea[1].rested).toBe(false)
    const after = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: [opponent] })
    expect(after.pendingAbilityEffect).toBeUndefined()
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(5)
    expect(after.players[playerId]).toEqual(paid.players[playerId])
  })
  it.each([
    { positionCostTargetIds: [] }, { positionCostTargetIds: [sourceInstanceId] },
    { positionCostTargetIds: ['bs12-006-non-arena'] }, { positionCostTargetIds: [opponent] },
    { positionCostTargetIds: [companion, companion] }, { positionCostTargetIds: [companion, sourceInstanceId] },
    { paymentIds: [] }, { paymentIds: ['bs12-006-payment', 'bs12-006-payment'] },
    { effectTargets: [[sourceInstanceId]] }, { effectTargets: [[opponent, opponent]] },
  ])('rejects incomplete or invalid choices atomically: %j', change => {
    const state = createBs12PositionCostDemoState('positive')
    const snapshot = structuredClone(state)
    expect(() => applyGameCommand(state, { ...command, ...change })).toThrow()
    expect(state).toEqual(snapshot)
  })
  it.each(['no-cost', 'wrong-keyword', 'no-energy', 'wrong-energy', 'rested-energy', 'used', 'opponent-turn'] as const)('rejects %s', scenario => {
    const state = createBs12PositionCostDemoState(scenario)
    expect(state.players[playerId].battleArea).toHaveLength(2)
    expect(canActivateCookieSkill(state, playerId, sourceInstanceId, 'activate')).toBe(false)
    expect(() => applyGameCommand(state, command)).toThrow()
  })
  it('the non-Arena negative uses a real rested non-Arena Cookie within the two-Cookie limit', () => {
    const state = createBs12PositionCostDemoState('wrong-keyword')
    expect(state.players[playerId].battleArea[1]).toMatchObject({ rested: true, card: { id: 'ST4-001' } })
    expect(getBattleCookiePositionCostCandidates(state.players[playerId].battleArea[0].card.skill!.cost,
      state.players[playerId].battleArea, sourceInstanceId)).toEqual([])
  })
  it('rules supply precisely the legal Arena cost choices including self', () => {
    const state = createBs12PositionCostDemoState('self')
    expect(getBattleCookiePositionCostCandidates(state.players[playerId].battleArea[0].card.skill!.cost,
      state.players[playerId].battleArea, sourceInstanceId).map(cookie => cookie.card.instanceId)).toEqual([sourceInstanceId, companion])
  })
  it('readying Cheerleader as a cost does not satisfy its by-an-effect condition', () => {
    const state = createBs12PositionCostDemoState('positive')
    const cheerleader = { ...createBs12ActivateDemoState('normal-active').players[playerId].battleArea[0], rested: true }
    const before = { ...state, players: { ...state.players, [playerId]: { ...state.players[playerId],
      battleArea: [state.players[playerId].battleArea[0], cheerleader] } } }
    const after = applyGameCommand(before, { ...command, positionCostTargetIds: [cheerleader.card.instanceId], effectTargets: [[]] })
    expect(after.players[playerId].battleArea[1].rested).toBe(false)
    expect(canActivateCookieSkill(after, playerId, cheerleader.card.instanceId, 'activate')).toBe(false)
  })
  it('normal attack pays R plus a blue support for N', () => {
    const state = createBs12AttackDemoState('BS12-006', true)
    expect(state.players[playerId].supportArea.map(s => s.card.energyColor)).toEqual(['red', 'blue'])
    const after = applyGameCommand(state, { kind: 'declare-attack', playerId,
      attackerInstanceId: state.players[playerId].battleArea[0].card.instanceId,
      targetInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
      supportPaymentIds: state.players[playerId].supportArea.map(s => s.card.instanceId) })
    expect(after.pendingBattle?.remainingDamage).toBe(2)
  })
  it('AI selects a legal status cost without modifying the input', () => {
    const state = createBs12PositionCostDemoState('positive')
    const snapshot = structuredClone(state)
    const decision = takeAiStep(state, playerId, { level: 2 })
    expect(decision.action, decision.description).toBe('activate-skill')
    expect(decision.state.players[playerId].battleArea[1].rested).toBe(false)
    expect(decision.state.players[playerId].supportArea[0].rested).toBe(true)
    expect(state).toEqual(snapshot)
  })
})
