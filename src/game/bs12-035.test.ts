import { describe, expect, it } from 'vitest'
import { createBs12KouignDemoState, parseTestStateConfig, type Bs12KouignScenario } from './demo'
import { applyGameCommand } from './commands'
import { getHandToBreakAreaCostCandidates } from './skills'
import { describeCommand } from './command-log'
const playerId = 'player-one' as const
const sourceId = 'bs12-035-source'
const costId = 'bs12-035-cost'
const paymentId = 'bs12-035-payment'
const foeId = 'bs12-035-opponent'
const deploy = (scenario: Bs12KouignScenario, number: 'BS12-035' | 'BS12-035@1') => {
  const state = createBs12KouignDemoState(scenario, number)
  return state.pendingOnPlay ? state : applyGameCommand(state, { kind: 'deploy-cookie', playerId, instanceId: sourceId })
}
const begin = (before: ReturnType<typeof createBs12KouignDemoState>, costIds = [costId], paymentIds = [paymentId]) =>
  applyGameCommand(before, { kind: 'begin-activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'on-play', paymentIds, handToBreakAreaIds: costIds })

describe.each(['BS12-035', 'BS12-035@1'] as const)('%s confirmed On Play and R002 attack', number => {
  it.each(['positive', 'peach-cost'] as const)('deploys printed 2HP then pays hand Arena of any color: %s', scenario => {
    const entered = deploy(scenario, number)
    expect(entered.players[playerId].battleArea.find(c => c.card.instanceId === sourceId)?.hpCards).toHaveLength(2)
    expect(entered.players[playerId].deck).toHaveLength(12)
    const source = entered.players[playerId].battleArea.find(c => c.card.instanceId === sourceId)!
    expect(getHandToBreakAreaCostCandidates(source.card.skill!.cost, entered.players[playerId].hand, sourceId).map(c => c.instanceId)).toEqual([costId])
    const paid = begin(entered)
    expect(paid.players[playerId].supportArea[0].rested).toBe(true)
    expect(paid.players[playerId].hand.map(c => c.instanceId)).toEqual(['bs12-035-wrong-cost'])
    expect(paid.players[playerId].breakArea.map(c => c.instanceId)).toEqual([costId])
    expect(paid.players[playerId].discardPile).toHaveLength(0)
    expect(paid.players['player-two'].battleArea[0].hpCards).toHaveLength(6)
    const command = { kind: 'resolve-ability-effect' as const, playerId, targetIds: [foeId] }
    const done = applyGameCommand(paid, command)
    expect(done.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([4, 3])
    expect(done.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([2, 2])
    expect(describeCommand(paid, done, command)).toMatch(/2.*傷害/)
    expect(done.pendingAfterDamageEffects?.length ?? 0).toBe(scenario === 'positive' ? 1 : 0)
  })
  it.each([[], [foeId], ['bs12-035-opponent-other']].map(targetIds => ({ targetIds })))('allows optional target $targetIds after mandatory payment', ({ targetIds }) => {
    const paid = begin(deploy('positive', number))
    const done = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds })
    expect(done.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([targetIds[0] === foeId ? 4 : 6, targetIds[0] === 'bs12-035-opponent-other' ? 1 : 3])
    expect(done.players[playerId].breakArea).toHaveLength(1)
    const opened = applyGameCommand(done, { kind: 'resolve-after-damage-effect', playerId, targetIds: [] })
    expect(opened.pendingDrawUpTo?.max).toBe(1)
    const drawn = applyGameCommand(opened, { kind: 'resolve-draw-up-to', playerId, drawCount: 1 })
    expect(drawn.players[playerId].deck).toHaveLength(11)
    expect(drawn.players[playerId].hand).toHaveLength(2)
  })
  it('skips the complete On Play without payment or cost', () => {
    const entered = deploy('positive', number)
    const skipped = applyGameCommand(entered, { kind: 'skip-on-play', playerId, sourceInstanceId: sourceId })
    expect(skipped.players).toEqual(entered.players)
    expect(skipped.pendingOnPlay).toBeNull()
    expect(skipped.pendingAfterDamageEffects?.length ?? 0).toBe(0)
  })
  it.each(['no-cost', 'wrong-energy', 'no-energy', 'rested-energy', 'opponent-turn'] as const)('rejects unpaid/inactive branch %s immutably', scenario => {
    const entered = deploy(scenario, number)
    const snapshot = structuredClone(entered)
    expect(() => begin(entered)).toThrow()
    expect(entered).toEqual(snapshot)
  })
  it.each([[], ['bs12-035-wrong-cost'], [sourceId], ['bs12-035-ally'], [foeId], [costId, costId]].map(ids => ({ ids })))('rejects wrong hand cost $ids', ({ ids }) => {
    expect(() => begin(deploy('positive', number), ids)).toThrow()
  })
  it('rejects two opponents, own target and incorrect actor', () => {
    const paid = begin(deploy('positive', number))
    for (const ids of [[foeId, 'bs12-035-opponent-other'], [sourceId]]) {
      expect(() => applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: ids })).toThrow()
    }
    expect(() => applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-two', targetIds: [foeId] })).toThrow()
  })
  it('stops damage and standby at LV10 cost', () => {
    const paid = begin(deploy('break-nine', number))
    expect(paid.status).toBe('finished')
    expect(paid.players[playerId].breakArea.reduce((sum, card) => sum + card.level, 0)).toBe(10)
    expect(paid.players['player-two'].battleArea[0].hpCards).toHaveLength(6)
    expect(paid.pendingAfterDamageEffects?.length ?? 0).toBe(0)
  })
  it('keeps Y1 ordinary damage and makes Then a no-op without four Arena in Break', () => {
    const before = createBs12KouignDemoState('attack', number)
    let next = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: foeId, supportPaymentIds: [paymentId] })
    next = applyGameCommand(next, { kind: 'skip-trap', playerId: 'player-two' })
    next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(5)
    expect(next.players[playerId].supportArea[0].rested).toBe(true)
    expect(next.players[playerId].breakArea).toHaveLength(0)
    expect(next.pendingBattle?.stage).toBe('attack-effect')
    const done = applyGameCommand(next, { kind: 'resolve-attack-effect', playerId, targetIds: [] })
    expect(done.players).toEqual(next.players)
    expect(done.pendingBattle ?? null).toBeNull()
    expect(done.commandLog?.at(-1)?.steps?.map(step => step.text).join(' ')).toContain('條件不成立')
  })
  it('rejects a rested attacker and keeps candidate routing local', () => {
    expect(() => applyGameCommand(createBs12KouignDemoState('attack-rested', number), { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: foeId, supportPaymentIds: [paymentId] })).toThrow()
    expect(parseTestStateConfig(`?test-state=${number.toLowerCase()}:positive`, 'localhost')).toMatchObject({ kind: 'bs12-035', cardNumber: number })
    expect(parseTestStateConfig(`?test-state=${number.toLowerCase()}:positive`, 'example.com')).toBeNull()
  })
})
