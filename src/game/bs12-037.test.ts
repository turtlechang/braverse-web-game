import { describe, expect, it } from 'vitest'
import { createBs12FinancierDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { executeCardEffect } from './effects'
import { takeAiStep } from './ai'
import { getOptionalCostAttackPrompt } from '../components/modals/optionalCostAttackPrompt'

const playerId = 'player-one' as const
const sourceId = 'bs12-037-source'
const foeId = 'bs12-037-opponent'
type State = ReturnType<typeof createBs12FinancierDemoState>
const activate = (before: State, targets: string[] = [foeId], paymentIds = ['bs12-037-payment-0']) => applyGameCommand(before, {
  kind: 'activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'activate', paymentIds, effectTargets: [targets],
})
const attack = (before: State) => {
  let state = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: foeId, supportPaymentIds: before.players[playerId].supportArea.slice(0, 3).map(s => s.card.instanceId) })
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 10; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  if (state.pendingReplacement) state = applyGameCommand(state, { kind: 'skip-replacement', playerId: 'player-two' })
  return applyGameCommand(state, { kind: 'resolve-attack-effect', playerId, targetIds: [] })
}
const pay = (before: State, targets: string[] = [foeId], paymentIds = ['bs12-037-payment-3']) => applyGameCommand(before, { kind: 'resolve-optional-cost-attack', playerId, action: 'pay', paymentIds, targetIds: targets })
const finish = (before: State) => {
  let state = before
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 10; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return state
}
describe.each(['BS12-037', 'BS12-037@1'] as const)('%s physical damage bearers', number => {
  it('uses full printed HP for both normal and fainting targets', () => {
    const normal = createBs12FinancierDemoState('four', number).players['player-two'].battleArea[0]
    const fainting = createBs12FinancierDemoState('target-faints', number).players['player-two'].battleArea[0]
    expect(normal.card).toMatchObject({ id: 'BS6-008', name: 'Sugar Swan Cookie', hp: 6 })
    expect(normal.hpCards).toHaveLength(6)
    expect(fainting.card).toMatchObject({ id: 'BS12-008', name: 'Shiningberry Cookie', hp: 3 })
    expect(fainting.hpCards).toHaveLength(3)
  })
})

describe.each(['BS12-037', 'BS12-037@1'] as const)('%s group damage, actual payment and independent Then', number => {
  it('deploys from hand with exactly five printed HP and no On Play', () => {
    const before = createBs12FinancierDemoState('deploy', number)
    const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: sourceId })
    expect(after.players[playerId].battleArea[1].hpCards).toEqual(before.players[playerId].deck.slice(0, 5))
    expect(after.players[playerId].deck).toHaveLength(7)
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.pendingOnPlay).toBeNull()
  })
  it('retains the original per-Cookie behavior when groupSize is absent', () => {
    const before = createBs12FinancierDemoState('four', number)
    const after = executeCardEffect(before, { sourcePlayerId: playerId, sourceInstanceId: sourceId }, { kind: 'damage-by-break-count', perCount: 1, keyword: 'arena', target: { side: 'opponent', min: 0, max: 1 } }, [foeId])
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
  })
  it.each([{ scenario: 'zero', amount: 0 }, { scenario: 'three', amount: 0 }, { scenario: 'four', amount: 1 }, { scenario: 'five', amount: 1 }, { scenario: 'seven', amount: 1 }, { scenario: 'eight', amount: 2 }, { scenario: 'mixed-colors', amount: 1 }, { scenario: 'non-arena', amount: 0 }, { scenario: 'high-level', amount: 0 }, { scenario: 'opponent-break', amount: 0 }, { scenario: 'trash-arena', amount: 0 }, { scenario: 'support-arena', amount: 0 }, { scenario: 'source-rested', amount: 1 }] as const)('pays Y1 and floors current own Arena count: $scenario', ({ scenario, amount }) => {
    const before = createBs12FinancierDemoState(scenario, number)
    const snapshot = structuredClone(before)
    expect(canActivateCookieSkill(before, playerId, sourceId, 'activate')).toBe(true)
    const after = activate(before)
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([6 - amount, 3])
    expect(after.players[playerId].supportArea.map(s => s.rested)).toEqual([true, false, false, false])
    expect(after.players[playerId].battleArea).toEqual(before.players[playerId].battleArea)
    expect(after.players[playerId].breakArea).toEqual(before.players[playerId].breakArea)
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it('selecting zero consumes payment and once-per-turn with no damage', () => {
    const before = createBs12FinancierDemoState('eight', number)
    const after = activate(before, [])
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(after.players[playerId].supportArea[0].rested).toBe(true)
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
  })
  it.each(['wrong-energy', 'no-energy', 'rested-energy', 'opponent-turn', 'outside-main', 'used'] as const)('rejects illegal activation %s immutably', scenario => {
    const before = createBs12FinancierDemoState(scenario, number)
    const snapshot = structuredClone(before)
    expect(canActivateCookieSkill(before, playerId, sourceId, 'activate')).toBe(false)
    expect(() => activate(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([[sourceId], ['bs12-037-ally'], ['bs12-037-payment-0'], [foeId, foeId], [foeId, 'bs12-037-opponent-other']].map(targets => ({ targets })))('rejects illegal skill targets $targets', ({ targets }) => {
    const before = createBs12FinancierDemoState('four', number)
    expect(() => activate(before, targets)).toThrow()
  })
  it.each(['original', 'other', 'zero'] as const)('pays YYY first then blue N1 and selects %s independently', choice => {
    const before = createBs12FinancierDemoState('attack', number)
    const opened = attack(before)
    expect(opened.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3, 3])
    expect(opened.players[playerId].supportArea.map(s => s.rested)).toEqual([true, true, true, false])
    expect(getOptionalCostAttackPrompt(opened, playerId)).toMatchObject({ energyCostTotal: 1, needsTarget: true })
    const done = finish(pay(opened, choice === 'zero' ? [] : [choice === 'other' ? 'bs12-037-opponent-other' : foeId]))
    expect(done.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([choice === 'original' ? 2 : 3, choice === 'other' ? 2 : 3])
    expect(done.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    expect(done.players[playerId].hand).toEqual(before.players[playerId].hand)
  })
  it('permits choosing remaining opponent after original target faints', () => {
    const opened = attack(createBs12FinancierDemoState('target-faints', number))
    expect(opened.players['player-two'].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-037-opponent-other'])
    expect(finish(pay(opened, ['bs12-037-opponent-other'])).players['player-two'].battleArea[0].hpCards).toHaveLength(2)
  })
  it('skipping Then preserves remaining support and ordinary damage', () => {
    const opened = attack(createBs12FinancierDemoState('attack', number))
    expect(applyGameCommand(opened, { kind: 'resolve-optional-cost-attack', playerId, action: 'skip' }).players).toEqual(opened.players)
  })
  it('cannot pay Then with already rested or missing support', () => {
    for (const scenario of ['attack', 'attack-three-energy'] as const) {
      const opened = attack(createBs12FinancierDemoState(scenario, number))
      expect(() => pay(opened, [], ['bs12-037-payment-0'])).toThrow()
      expect(() => pay(opened, [], [])).toThrow()
    }
  })
  it.each([[sourceId], ['bs12-037-ally'], [foeId, foeId], [foeId, 'bs12-037-opponent-other']].map(targets => ({ targets })))('rejects illegal paid Then targets $targets', ({ targets }) => {
    const opened = attack(createBs12FinancierDemoState('attack', number))
    const snapshot = structuredClone(opened)
    expect(() => pay(opened, targets)).toThrow()
    expect(opened).toEqual(snapshot)
  })
  it.each(['attack-wrong', 'attack-rested'] as const)('rejects illegal YYY ordinary %s', scenario => {
    expect(() => attack(createBs12FinancierDemoState(scenario, number))).toThrow()
  })
  it.each([0, -1, 1.5])('rejects invalid group size %s', groupSize => {
    const before = createBs12FinancierDemoState('four', number)
    expect(() => executeCardEffect(before, { sourcePlayerId: playerId, sourceInstanceId: sourceId }, { kind: 'damage-by-break-count', perCount: 1, groupSize, keyword: 'arena', target: { side: 'opponent', min: 0, max: 1 } }, [foeId])).toThrow('正整數')
  })
  it('AI can settle the separately paid Then without losing the optional choice', () => {
    const opened = attack(createBs12FinancierDemoState('attack', number))
    const step = takeAiStep(opened, playerId)
    expect(step.state.pendingOptionalCostAttack).toBeNull()
    expect(step.state.players[playerId].supportArea.every(s => s.rested)).toBe(true)
  })
  it('only exposes the candidate fixture on localhost', () => {
    expect(parseTestStateConfig(`?test-state=${number.toLowerCase()}:eight`, 'localhost')).toEqual({ kind: 'bs12-037', scenario: 'eight', cardNumber: number })
    expect(parseTestStateConfig(`?test-state=${number.toLowerCase()}:eight`, 'example.com')).toBeNull()
  })
})
