import { describe, expect, it } from 'vitest'
import { createBs12OptionalTrapDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { getTrapCandidates } from './battle'
import { getAttackDamageAgainst } from './effects'
import { takeAiStep } from './ai'
import { describeCommandSteps } from './command-log'
import { advancePhase } from './turn'
import { getOptionalCostAttackPrompt } from '../components/modals/optionalCostAttackPrompt'

const playerId = 'player-one' as const
const initial = { kind: 'play-trap' as const, playerId, trapInstanceId: 'bs12-010-trap', paymentIds: ['bs12-009-payment'],
  targetIds: [], effectTargets: [['bs12-009-attacker']] }
const pay = { kind: 'resolve-optional-cost-attack' as const, playerId, action: 'pay' as const,
  positionCostTargetIds: ['bs12-009-defender', 'bs12-009-ally'] }
const resolveAbility = (state: ReturnType<typeof createBs12OptionalTrapDemoState>) =>
  applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
const open = (scenario: Parameters<typeof createBs12OptionalTrapDemoState>[0] = 'positive', targets = ['bs12-009-attacker']) =>
  resolveAbility(applyGameCommand(createBs12OptionalTrapDemoState(scenario), { ...initial, effectTargets: [targets] }))
const draw = (state: ReturnType<typeof open>, count: number) => {
  state = resolveAbility(state)
  state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId, drawCount: count })
  return resolveAbility(state)
}

describe('BS12-010 initial reduction and optional same-target Then', () => {
  it('exposes only the local candidate route', () => {
    expect(parseTestStateConfig('?test-state=bs12-010:positive', 'localhost')).toEqual({ kind: 'bs12-010', scenario: 'positive' })
    expect(parseTestStateConfig('?test-state=bs12-010:positive', 'example.com')).toBeNull()
  })
  it('initial R does not rest Arena Cookies and keeps the first target across Then', () => {
    const state = createBs12OptionalTrapDemoState()
    const snapshot = structuredClone(state)
    const after = resolveAbility(applyGameCommand(state, initial))
    expect(getAttackDamageAgainst(after, 'bs12-009-attacker', 'bs12-009-defender')).toBe(3)
    expect(after.players[playerId].battleArea.every(c => !c.rested)).toBe(true)
    expect(after.players[playerId].supportArea[0].rested).toBe(true)
    expect(after.players[playerId].discardPile.map(c => c.instanceId)).toEqual(['bs12-010-trap'])
    expect(after.pendingOptionalCostAttack?.resolution).toBe('ability')
    expect(after.pendingAbilityEffect?.previousEffectTargetIds).toEqual(['bs12-009-attacker'])
    expect(state).toEqual(snapshot)
  })
  it('skipping Then retains the first -1 and spends no Cookie cost or draw', () => {
    const after = applyGameCommand(open(), { kind: 'resolve-optional-cost-attack', playerId, action: 'skip' })
    expect(after.pendingBattle).toMatchObject({ stage: 'damage', remainingDamage: 3 })
    expect(after.players[playerId].battleArea.every(c => !c.rested)).toBe(true)
    expect(after.players[playerId].hand).toHaveLength(0)
    expect(after.players[playerId].deck).toHaveLength(12)
  })
  it.each([0, 1])('rests two Arena Cookies; draw %s still adds -1 to the same attacker', count => {
    const before = open()
    const paid = applyGameCommand(before, pay)
    expect(describeCommandSteps(before, paid, pay)?.map(step => step.text).join(' ')).toMatch(/餅乾設為橫置.*Langue de Chat Cookie.*Pancake Cookie/)
    expect(paid.players[playerId].battleArea.every(c => c.rested)).toBe(true)
    const after = draw(paid, count)
    expect(after.pendingBattle).toMatchObject({ stage: 'damage', remainingDamage: 2 })
    expect(after.players[playerId].hand).toHaveLength(count)
    expect(after.players[playerId].deck).toHaveLength(12 - count)
    expect(getAttackDamageAgainst(after, 'bs12-009-other', 'bs12-009-ally')).toBe(1)
  })
  it('selecting another opponent Cookie keeps both reductions on it', () => {
    const after = draw(applyGameCommand(open('positive', ['bs12-009-other']), pay), 1)
    expect(after.pendingBattle?.remainingDamage).toBe(4)
    expect(after.attackModifiers.map(m => m.targetInstanceId)).toEqual(['bs12-009-other', 'bs12-009-other'])
  })
  it('selecting zero still permits independent Then draw without retargeting', () => {
    const after = draw(applyGameCommand(open('positive', []), pay), 1)
    expect(after.pendingBattle?.remainingDamage).toBe(4)
    expect(after.players[playerId].hand).toHaveLength(1)
    expect(after.attackModifiers).toEqual([])
  })
  it.each(['one-rested', 'two-rested', 'non-arena', 'mic-equipped'] as const)('initial R stays legal with %s; only optional Then is unavailable', scenario => {
    expect(getTrapCandidates(createBs12OptionalTrapDemoState(scenario), playerId).map(c => c.instanceId)).toEqual(['bs12-010-trap'])
    const state = open(scenario)
    const prompt = getOptionalCostAttackPrompt(state, playerId)!
    expect(prompt.positionCostCandidates.length).toBeLessThan(2)
    expect(prompt.sourceCard?.id).toBe('BS12-010')
    expect(prompt.needsTarget).toBe(false)
    expect(prompt.paymentUnavailableWarning).toMatch(/沒有足夠/)
    expect(() => applyGameCommand(state, pay)).toThrow()
    expect(applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId, action: 'skip' }).pendingBattle?.remainingDamage).toBe(3)
  })
  it.each([[], ['bs12-009-defender'], ['bs12-009-defender', 'bs12-009-defender'],
    ['bs12-009-defender', 'bs12-009-attacker'], ['bs12-009-defender', 'bs12-009-ally', 'bs12-009-mic']].map(ids => ({ ids })))('rejects invalid position cost atomically: %j', ({ ids }) => {
    const state = open()
    const snapshot = structuredClone(state)
    expect(() => applyGameCommand(state, { ...pay, positionCostTargetIds: ids })).toThrow()
    expect(state).toEqual(snapshot)
  })
  it.each(['no-energy', 'wrong-energy', 'rested-energy', 'disabled', 'used'] as const)('initial trap is blocked with %s', scenario => {
    const state = createBs12OptionalTrapDemoState(scenario)
    expect(getTrapCandidates(state, playerId)).toEqual([])
    expect(() => applyGameCommand(state, initial)).toThrow()
  })
  it('refuses to change the linked target after drawing', () => {
    let state = resolveAbility(applyGameCommand(open(), pay))
    state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId, drawCount: 0 })
    expect(() => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId, targetIds: ['bs12-009-other'] })).toThrow(/同一張/)
  })
  it('AI pays concrete Cookie cost ids and skips when the cost is unavailable', () => {
    expect(takeAiStep(open(), playerId, { level: 2 }).state.players[playerId].battleArea.every(c => c.rested)).toBe(true)
    expect(takeAiStep(open('one-rested'), playerId, { level: 2 }).state.pendingOptionalCostAttack).toBeNull()
  })
  it('does not retarget if the original opponent Cookie leaves before the additional modifier', () => {
    let state = resolveAbility(applyGameCommand(open('positive', ['bs12-009-other']), pay))
    state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId, drawCount: 0 })
    state = { ...state, players: { ...state.players, 'player-two': { ...state.players['player-two'],
      battleArea: state.players['player-two'].battleArea.filter(c => c.card.instanceId !== 'bs12-009-other'),
    } } }
    const after = resolveAbility(state)
    expect(after.pendingBattle?.remainingDamage).toBe(4)
    expect(after.attackModifiers).toHaveLength(1)
    expect(describeCommandSteps(state, after, { kind: 'resolve-ability-effect', playerId, targetIds: [] })?.map(s => s.text).join(' ')).toMatch(/目標.*離場|無.*目標/)
  })
  it('keeps the linked original target across a last-card draw and Refresh', () => {
    let state = open()
    const refreshCard = state.players['player-two'].battleArea[1].card
    state = { ...state, players: { ...state.players, [playerId]: { ...state.players[playerId],
      deck: state.players[playerId].deck.slice(0, 1), discardPile: [...state.players[playerId].discardPile, { ...refreshCard, instanceId: 'refresh-cookie' }],
    } } }
    state = resolveAbility(applyGameCommand(state, pay))
    state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId, drawCount: 1 })
    expect(state.pendingRefresh?.playerId).toBe(playerId)
    state = applyGameCommand(state, { kind: 'refresh-deck', playerId, cookieInstanceId: 'refresh-cookie', shuffleSeed: 1 })
    state = resolveAbility(state)
    expect(state.pendingBattle?.remainingDamage).toBe(2)
    expect(state.attackModifiers.map(m => m.targetInstanceId)).toEqual(['bs12-009-attacker', 'bs12-009-attacker'])
  })
  it('both reductions expire after this turn', () => {
    let state = draw(applyGameCommand(open(), pay), 0)
    for (let step = 0; state.pendingBattle && step < 10; step++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId })
    expect(state.players[playerId].battleArea[0].hpCards).toHaveLength(2)
    state = advancePhase(advancePhase(state))
    expect(getAttackDamageAgainst(state, 'bs12-009-attacker', 'bs12-009-defender')).toBe(4)
  })
})
