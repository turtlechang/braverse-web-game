import { describe, expect, it } from 'vitest'
import { createBs12TrapDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { getTrapCandidates } from './battle'
import { getAttackDamageAgainst } from './effects'
import { takeAiStep } from './ai'
import { advancePhase } from './turn'
import { describeCommandSteps } from './command-log'

const playerId = 'player-one' as const
const command = { kind: 'play-trap' as const, playerId, trapInstanceId: 'bs12-009-trap', paymentIds: ['bs12-009-payment'],
  positionCostTargetIds: ['bs12-009-defender', 'bs12-009-ally'], targetIds: [], effectTargets: [['bs12-009-attacker']] }

describe('BS12-009 real attack response, mandatory position cost and optional modifier', () => {
  it('exposes only a local candidate fixture', () => {
    expect(parseTestStateConfig('?test-state=bs12-009:positive', 'localhost')).toEqual({ kind: 'bs12-009', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-009:positive', 'example.com')).toBeNull()
    expect(createBs12TrapDemoState('used').pendingBattle).toMatchObject({ trapUsed: true, stage: 'damage' })
  })
  it('pays exactly R plus two active Arena Cookies of different colors and reduces this attack 4 to 1', () => {
    const state = createBs12TrapDemoState()
    const snapshot = structuredClone(state)
    expect(state.players[playerId].battleArea.map(c => c.card.energyColor)).toEqual(['red', 'green'])
    expect(getTrapCandidates(state, playerId).map(c => c.instanceId)).toEqual(['bs12-009-trap'])
    const after = applyGameCommand(state, command)
    expect(describeCommandSteps(state, after, command)?.map(step => step.text).join(' ')).toMatch(/支付能量.*陷阱代價.*Langue de Chat Cookie.*Pancake Cookie.*選擇目標/s)
    expect(after.players[playerId].battleArea.map(c => c.rested)).toEqual([true, true])
    expect(after.players[playerId].battleArea.map(c => c.hpCards)).toEqual(state.players[playerId].battleArea.map(c => c.hpCards))
    expect(after.players[playerId].supportArea[0].rested).toBe(true)
    expect(after.players[playerId].hand).toEqual([])
    expect(after.players[playerId].discardPile.map(c => c.instanceId)).toEqual(['bs12-009-trap'])
    expect(after.pendingBattle).toMatchObject({ remainingDamage: 1, trapUsed: true, stage: 'damage' })
    expect(after.cookiesSetActiveByEffectThisTurn ?? {}).toEqual({})
    expect(state).toEqual(snapshot)
  })
  it('zero target still pays both costs and leaves incoming damage at 4', () => {
    const after = applyGameCommand(createBs12TrapDemoState(), { ...command, effectTargets: [[]] })
    expect(after.pendingBattle?.remainingDamage).toBe(4)
    expect(after.players[playerId].battleArea.every(c => c.rested)).toBe(true)
    expect(after.players[playerId].supportArea[0].rested).toBe(true)
    expect(after.attackModifiers).toEqual([])
  })
  it('may select the other opponent Cookie; only that Cookie is reduced and the current attack remains 4', () => {
    const after = applyGameCommand(createBs12TrapDemoState(), { ...command, effectTargets: [['bs12-009-other']] })
    expect(after.pendingBattle?.remainingDamage).toBe(4)
    expect(getAttackDamageAgainst(after, 'bs12-009-other', 'bs12-009-ally')).toBe(0)
    expect(getAttackDamageAgainst(after, 'bs12-009-attacker', 'bs12-009-defender')).toBe(4)
  })
  it('modifier expires when this turn ends', () => {
    let after = applyGameCommand(createBs12TrapDemoState(), command)
    for (let step = 0; after.pendingBattle && step < 10; step++) after = applyGameCommand(after, { kind: 'resolve-next-damage', playerId })
    expect(after.pendingBattle).toBeNull()
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(3)
    after = advancePhase(after)
    after = advancePhase(after)
    expect(getAttackDamageAgainst(after, 'bs12-009-attacker', 'bs12-009-defender')).toBe(4)
  })
  it.each(['one-rested', 'two-rested', 'non-arena', 'mic-equipped', 'no-energy', 'wrong-energy', 'rested-energy', 'disabled', 'used'] as const)('rejects %s without using the trap or changing the state', scenario => {
    const state = createBs12TrapDemoState(scenario)
    const snapshot = structuredClone(state)
    expect(getTrapCandidates(state, playerId)).toEqual([])
    expect(() => applyGameCommand(state, command)).toThrow()
    expect(state).toEqual(snapshot)
  })
  it.each([
    { positionCostTargetIds: [] }, { positionCostTargetIds: ['bs12-009-defender'] },
    { positionCostTargetIds: ['bs12-009-defender', 'bs12-009-defender'] },
    { positionCostTargetIds: ['bs12-009-defender', 'bs12-009-attacker'] },
    { positionCostTargetIds: ['bs12-009-defender', 'bs12-009-ally', 'bs12-009-mic'] },
    { paymentIds: [] }, { effectTargets: [['bs12-009-defender']] }, { effectTargets: [['bs12-009-attacker', 'bs12-009-other']] },
  ])('rejects invalid choices atomically: %j', change => {
    const state = createBs12TrapDemoState()
    const snapshot = structuredClone(state)
    expect(() => applyGameCommand(state, { ...command, ...change })).toThrow()
    expect(state).toEqual(snapshot)
  })
  it('AI includes concrete resting cost ids in its trap command', () => {
    const state = createBs12TrapDemoState()
    const snapshot = structuredClone(state)
    const result = takeAiStep(state, playerId, { level: 2 })
    expect(result.state.players[playerId].discardPile.map(c => c.instanceId)).toContain('bs12-009-trap')
    expect(result.state.players[playerId].battleArea.every(c => c.rested)).toBe(true)
    expect(result.state.pendingBattle?.remainingDamage).toBe(1)
    expect(state).toEqual(snapshot)
  })
})
