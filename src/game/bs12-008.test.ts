import { describe, expect, it } from 'vitest'
import { createBs12ReadyDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { getEffectTargetCandidatesForEffect } from './effects'
import { describeCommandSteps } from './command-log'

const playerId = 'player-one' as const
const sourceInstanceId = 'bs12-008-source'
const target = 'bs12-008-target'
const command = { kind: 'begin-activate-skill' as const, playerId, sourceInstanceId, trigger: 'activate' as const, paymentIds: [] }

describe('BS12-008 Shining Dash', () => {
  it('candidate route is local only and preserves the print variant', () => {
    expect(parseTestStateConfig('?test-state=bs12-008:BS12-008@1:positive', 'localhost')).toEqual({ kind: 'bs12-008', cardNumber: 'BS12-008@1', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-008:BS12-008:positive', 'example.com')).toBeNull()
  })
  it.each(['positive', 'five', 'rested-support', 'rested-source', 'active-target'] as const)('four or more red Arena cards permit %s with no energy payment', scenario => {
    const before = createBs12ReadyDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(canActivateCookieSkill(before, playerId, sourceInstanceId, 'activate')).toBe(true)
    const paid = applyGameCommand(before, command)
    expect(paid.players[playerId].battleArea.map(c => c.card.instanceId)).toEqual([target])
    expect(paid.players[playerId].discardPile.map(c => c.instanceId)).toEqual([sourceInstanceId, 'bs12-008-hp-0', 'bs12-008-hp-1', 'bs12-008-hp-2'])
    expect(paid.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(paid.players[playerId].hand).toEqual(before.players[playerId].hand)
    expect(paid.pendingReplacement).toBeNull()
    expect(paid.pendingAbilityEffect?.sourceInstanceId).toBe(sourceInstanceId)
    const effect = paid.pendingAbilityEffect!.effects[0]
    expect(getEffectTargetCandidatesForEffect(paid, { sourcePlayerId: playerId, sourceInstanceId }, effect).map(c => c.card.instanceId)).toEqual([target])
    const after = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: [target] })
    expect(after.players[playerId].battleArea[0].rested).toBe(false)
    expect(after.pendingReplacement?.tasks[0].playerId).toBe(playerId)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(before).toEqual(snapshot)
  })
  it.each(['three', 'wrong-color', 'wrong-keyword', 'opponent-turn'] as const)('rejects %s while retaining a valid target and self cost', scenario => {
    const state = createBs12ReadyDemoState(scenario)
    const snapshot = structuredClone(state)
    expect(state.players[playerId].battleArea).toHaveLength(2)
    expect(canActivateCookieSkill(state, playerId, sourceInstanceId, 'activate')).toBe(false)
    expect(() => applyGameCommand(state, command)).toThrow()
    expect(state).toEqual(snapshot)
  })
  it('up to one permits zero targets but still pays self-trash and opens replacement', () => {
    const before = createBs12ReadyDemoState()
    const paid = applyGameCommand(before, command)
    const after = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
    expect(after.players[playerId].battleArea[0].rested).toBe(true)
    expect(after.players[playerId].discardPile).toHaveLength(4)
    expect(after.pendingReplacement?.tasks[0].playerId).toBe(playerId)
  })
  it('records the paid source and publicly trashed HP before the ready effect', () => {
    const before = createBs12ReadyDemoState()
    const paid = applyGameCommand(before, command)
    const steps = describeCommandSteps(before, paid, command)
    expect(steps?.map(step => step.text).join(' ')).toMatch(/技能代價.*Shiningberry Cookie.*3.*HP/)
    expect(steps?.flatMap(step => step.cards ?? []).map(card => card.instanceId)).toEqual([sourceInstanceId, 'bs12-008-hp-0', 'bs12-008-hp-1', 'bs12-008-hp-2'])
  })
  it('readying Cheerleader by this effect enables its skill for the same battle identity', () => {
    const paid = applyGameCommand(createBs12ReadyDemoState('cheerleader'), command)
    const after = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: [target] })
    expect(after.cookiesSetActiveByEffectThisTurn?.[after.players[playerId].battleArea[0].battleEntryId!]).toBe(true)
    // Replacement must be completed before another skill can be used.
    const settled = applyGameCommand(after, { kind: 'skip-replacement', playerId })
    expect(canActivateCookieSkill(settled, playerId, target, 'activate')).toBe(true)
  })
  it.each([{ targetIds: [sourceInstanceId] }, { targetIds: ['bs12-008-opponent'] }, { targetIds: [target, target] }])('rejects unavailable or duplicated targets: %j', ({ targetIds }) => {
    const paid = applyGameCommand(createBs12ReadyDemoState(), command)
    expect(() => applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds })).toThrow()
  })
  it('self-trash also disposes of equipped cards and awakened underlay', () => {
    const state = createBs12ReadyDemoState()
    const source = state.players[playerId].battleArea[0]
    const gear = { ...state.players[playerId].hand[0], instanceId: '008-old-gear' }
    const underlay = { ...source.card, instanceId: '008-underlay' }
    const before = { ...state, players: { ...state.players, [playerId]: { ...state.players[playerId], battleArea: [{ ...source, equippedCards: [gear], awakenedUnderlay: [underlay] }, state.players[playerId].battleArea[1]] } } }
    const paid = applyGameCommand(before, command)
    expect(paid.players[playerId].discardPile.map(c => c.instanceId)).toEqual([sourceInstanceId, 'bs12-008-hp-0', 'bs12-008-hp-1', 'bs12-008-hp-2', '008-old-gear', '008-underlay'])
  })
})
