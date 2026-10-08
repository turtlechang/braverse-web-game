import { describe, expect, it } from 'vitest'
import { createBs12ActivateDemoState, createBs12AttackDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill, getCookieSkillUnavailableReason } from './skills'
import { executeCardEffect } from './effects'
import { advancePhase } from './turn'

const playerId = 'player-one' as const
const sourceInstanceId = 'bs12-005-source'
const companionId = 'bs12-005-companion'
const activate = (state: ReturnType<typeof createBs12ActivateDemoState>, ids: string[]) => applyGameCommand(state, {
  kind: 'activate-skill', playerId, sourceInstanceId, trigger: 'activate', paymentIds: [], discardHandIds: [], effectTargets: [ids],
})

describe('BS12-005 effect history, targets and incarnation', () => {
  it('pays a normal attack with red, red and an arbitrary blue support', () => {
    const before = createBs12AttackDemoState('BS12-005', true)
    expect(before.players[playerId].supportArea.map(s => s.card.energyColor)).toEqual(['red', 'red', 'blue'])
    const result = applyGameCommand(before, { kind: 'declare-attack', playerId,
      attackerInstanceId: before.players[playerId].battleArea[0].card.instanceId,
      targetInstanceId: before.players['player-two'].battleArea[0].card.instanceId,
      supportPaymentIds: before.players[playerId].supportArea.map(s => s.card.instanceId),
    })
    expect(result.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(result.pendingBattle?.remainingDamage).toBe(3)
  })
  it('isolates the route to localhost', () => {
    expect(parseTestStateConfig('?test-state=bs12-005:enable', 'localhost')).toEqual({ kind: 'bs12-005', scenario: 'enable' })
    expect(parseTestStateConfig('?test-state=card:BS12-005', 'localhost')).toEqual({ kind: 'bs12-005', scenario: 'enable' })
    expect(parseTestStateConfig('?test-state=bs12-005:positive', 'example.com')).toBeNull()
  })
  it.each(['normal-active', 'previous-turn', 'other-cookie', 'reentered'] as const)('rejects %s and does not mutate state', scenario => {
    const state = createBs12ActivateDemoState(scenario)
    const before = structuredClone(state)
    expect(canActivateCookieSkill(state, playerId, sourceInstanceId, 'activate')).toBe(false)
    expect(getCookieSkillUnavailableReason(state, playerId, sourceInstanceId, 'activate')).toContain('尚未被效果設為活躍')
    expect(() => activate(state, [sourceInstanceId])).toThrow()
    expect(state).toEqual(before)
  })
  it.each(['positive', 'rested-after-effect'] as const)('heals any friendly Cookie in %s without payment or source REST', scenario => {
    const state = createBs12ActivateDemoState(scenario)
    const before = structuredClone(state)
    expect(canActivateCookieSkill(state, playerId, sourceInstanceId, 'activate')).toBe(true)
    expect(state.players[playerId].battleArea[1].card.keywords ?? []).not.toContain('arena')
    const result = activate(state, [companionId])
    expect(result.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([3, 5])
    expect(result.players[playerId].deck).toEqual(state.players[playerId].deck.slice(1))
    expect(result.players[playerId].supportArea).toEqual(state.players[playerId].supportArea)
    expect(result.players[playerId].battleArea[0].rested).toBe(state.players[playerId].battleArea[0].rested)
    expect(result.players['player-two']).toEqual(state.players['player-two'])
    expect(canActivateCookieSkill(result, playerId, sourceInstanceId, 'activate')).toBe(false)
    expect(getCookieSkillUnavailableReason(result, playerId, sourceInstanceId, 'activate')).toContain('每回合一次')
    expect(state).toEqual(before)
  })
  it('allows the source itself as target', () => {
    const result = activate(createBs12ActivateDemoState('positive'), [sourceInstanceId])
    expect(result.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([4, 4])
  })
  it('zero selection keeps HP and deck but consumes once per turn', () => {
    const state = createBs12ActivateDemoState('positive')
    const result = activate(state, [])
    expect(result.players).toEqual(state.players)
    expect(canActivateCookieSkill(result, playerId, sourceInstanceId, 'activate')).toBe(false)
  })
  it.each([{ ids: ['bs12-005-opponent'] }, { ids: [sourceInstanceId, companionId] }, { ids: [sourceInstanceId, sourceInstanceId] }])('rejects illegal target list $ids', ({ ids }) => {
    const state = createBs12ActivateDemoState('positive')
    const before = structuredClone(state)
    expect(() => activate(state, ids)).toThrow()
    expect(state).toEqual(before)
  })
  it.each(['used', 'opponent-turn'] as const)('rejects %s without executing the effect', scenario => {
    expect(() => activate(createBs12ActivateDemoState(scenario), [])).toThrow()
  })
  it.each(['active', 'draw', 'support', 'end'] as const)('rejects Activate during %s phase', phase => {
    expect(() => activate({ ...createBs12ActivateDemoState('positive'), phase }, [])).toThrow()
  })
  it('resolving the real FLIP Then through a command enables the source', () => {
    const before = createBs12ActivateDemoState('enable')
    const state = applyGameCommand(before, { kind: 'resolve-ability-effect', playerId, targetIds: [sourceInstanceId] })
    expect(state.pendingAbilityEffect).toBeUndefined()
    expect(state.players[playerId].battleArea[0].rested).toBe(false)
    expect(canActivateCookieSkill(state, playerId, sourceInstanceId, 'activate')).toBe(true)
    expect(activate(state, [companionId]).players[playerId].battleArea[1].hpCards).toHaveLength(5)
  })
  it('skipping the enabler records no event and enables no skill', () => {
    const state = applyGameCommand(createBs12ActivateDemoState('enable'), { kind: 'resolve-ability-effect', playerId, targetIds: [] })
    expect(state.cookiesSetActiveByEffectThisTurn ?? {}).toEqual({})
    expect(canActivateCookieSkill(state, playerId, sourceInstanceId, 'activate')).toBe(false)
  })
  it('normal Active Phase clears history and cannot qualify as an effect', () => {
    const prepared = createBs12ActivateDemoState('positive')
    const state = advancePhase({ ...prepared, phase: 'active' })
    expect(state.players[playerId].battleArea[0].rested).toBe(false)
    expect(state.cookiesSetActiveByEffectThisTurn).toEqual({})
    expect(canActivateCookieSkill({ ...state, phase: 'main' }, playerId, sourceInstanceId, 'activate')).toBe(false)
  })
  it('legacy set-active records only the source, whereas selectable support readying does not', () => {
    const prepared = createBs12ActivateDemoState('normal-active')
    const context = { sourcePlayerId: playerId, sourceInstanceId }
    const state = executeCardEffect(prepared, context, { kind: 'set-active', supportCount: 0 }, [])
    expect(canActivateCookieSkill(state, playerId, sourceInstanceId, 'activate')).toBe(true)
    const supportState = executeCardEffect(prepared, context, { kind: 'set-active', supportCount: 1, selectable: true, optional: true }, [])
    expect(canActivateCookieSkill(supportState, playerId, sourceInstanceId, 'activate')).toBe(false)
  })
  it('leaving and re-entering through rules loses the previous event and previous use', () => {
    const used = activate(createBs12ActivateDemoState('positive'), [])
    const context = { sourcePlayerId: playerId, sourceInstanceId: companionId }
    const moved = executeCardEffect(used, context, { kind: 'return-to-hand', target: { side: 'self', min: 1, max: 1 } }, [sourceInstanceId])
    const reentered = executeCardEffect(moved, context, { kind: 'hand-to-battle', amount: 1 }, [sourceInstanceId])
    expect(canActivateCookieSkill(reentered, playerId, sourceInstanceId, 'activate')).toBe(false)
    const ready = executeCardEffect(reentered, context, { kind: 'set-cookie-active', target: { side: 'self', min: 1, max: 1 } }, [sourceInstanceId])
    expect(canActivateCookieSkill(ready, playerId, sourceInstanceId, 'activate')).toBe(true)
  })
})
