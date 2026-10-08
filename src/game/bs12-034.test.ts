import { describe, expect, it } from 'vitest'
import { createBs12MadeleineDemoState, parseTestStateConfig, type Bs12MadeleineScenario } from './demo'
import { applyGameCommand } from './commands'
import { getCookieToBreakCostCandidates } from './cookie-break-cost'
import { getOptionalCostAttackPrompt } from '../components/modals/optionalCostAttackPrompt'
import { compilePendingDecisionDescriptor } from './decision-descriptor-compiler'
import { describeCommandSteps } from './command-log'
import { takeAiStep } from './ai'
import { isOnlineGameCommand } from '../net/onlineProtocol'
const playerId = 'player-one' as const
const sourceId = 'bs12-034-source'
const targetId = 'bs12-034-opponent'
const pay = (before: ReturnType<typeof createBs12MadeleineDemoState>, costIds: string[], targetIds: string[] = []) =>
  applyGameCommand(before, { kind: 'resolve-optional-cost-attack', playerId, action: 'pay', cookieToBreakAreaIds: costIds, targetIds })
const attack = (scenario: Bs12MadeleineScenario, number: 'BS12-034' | 'BS12-034@1') => {
  const before = createBs12MadeleineDemoState(scenario, number)
  let next = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: targetId,
    supportPaymentIds: before.players[playerId].supportArea.map(support => support.card.instanceId) })
  next = applyGameCommand(next, { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; next.pendingBattle?.stage === 'damage' && i < 8; i++) next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return applyGameCommand(next, { kind: 'resolve-attack-effect', playerId, targetIds: [] })
}
describe.each(['BS12-034', 'BS12-034@1'] as const)('%s ordinary attack and combined Arena Break cost', number => {
  it('uses the physical six-HP Sugar Swan as the ordinary attack target', () => {
    const defender = createBs12MadeleineDemoState('positive', number).players['player-two'].battleArea[0]
    expect(defender.card).toMatchObject({ id: 'BS6-008', name: 'Sugar Swan Cookie', hp: 6 })
    expect(defender.hpCards).toHaveLength(6)
  })
  it.each(['positive', 'four-arena', 'three-arena', 'non-arena-break', 'opponent-break', 'high-level'] as const)('counts Arena Cookies rather than Break LV in %s', scenario => {
    const before = createBs12MadeleineDemoState(scenario, number)
    const done = attack(scenario, number)
    expect(done.players['player-two'].battleArea[0].hpCards).toHaveLength(scenario === 'four-arena' ? 3 : 4)
    expect(done.players[playerId].hand).toEqual(before.players[playerId].hand)
    expect(done.players[playerId].supportArea.every(s => s.rested)).toBe(true)
  })
  it.each(['bs12-034-hand', 'bs12-034-source', 'bs12-034-ally'])('pays exactly one from its printed zone before LV1 HP: %s', id => {
    const opened = attack('positive', number)
    const snapshot = structuredClone(opened)
    const hpTarget = id === sourceId ? 'bs12-034-ally' : sourceId
    const done = pay(opened, [id], [hpTarget])
    expect(done.players[playerId].breakArea.at(-1)?.instanceId).toBe(id)
    expect(done.players[playerId].battleArea.find(cookie => cookie.card.instanceId === hpTarget)?.hpCards).toHaveLength(4)
    expect(done.players[playerId].deck).toHaveLength(10)
    expect(done.players[playerId].discardPile).toHaveLength(id === 'bs12-034-hand' ? 0 : 2)
    expect(done.players[playerId].hand).toHaveLength(id === 'bs12-034-hand' ? 1 : 2)
    expect(opened).toEqual(snapshot)
    expect(done.pendingOptionalCostAttack).toBeNull()
  })
  it('zero HP target still pays cost without gaining HP', () => {
    const opened = attack('positive', number)
    const done = pay(opened, ['bs12-034-hand'])
    expect(done.players[playerId].battleArea).toEqual(opened.players[playerId].battleArea)
    expect(done.players[playerId].deck).toEqual(opened.players[playerId].deck)
    expect(done.players[playerId].breakArea).toHaveLength(1)
  })
  it('skip never pays the extra cost or changes ordinary damage', () => {
    const opened = attack('positive', number)
    const done = applyGameCommand(opened, { kind: 'resolve-optional-cost-attack', playerId, action: 'skip' })
    expect(done.players).toEqual(opened.players)
  })
  it.each([[], ['bs12-034-wrong-hand'], ['bs12-034-payment-0'], [targetId], ['bs12-034-hand', 'bs12-034-hand'], ['bs12-034-hand', sourceId]].map(ids => ({ ids })))('rejects invalid/duplicate/multiple costs $ids', ({ ids }) => {
    const opened = attack('positive', number)
    const snapshot = structuredClone(opened)
    expect(() => pay(opened, ids)).toThrow()
    expect(opened).toEqual(snapshot)
  })
  it('cannot choose the paid battle Cookie as the later HP target', () => {
    const opened = attack('positive', number)
    expect(() => pay(opened, [sourceId], [sourceId])).toThrow()
  })
  it('rejects LV2 and opponent HP targets while keeping LV1 source legal', () => {
    const opened = attack('lv2-ally', number)
    expect(opened.players[playerId].battleArea[1].card.level).toBe(2)
    expect(() => pay(opened, ['bs12-034-hand'], ['bs12-034-ally'])).toThrow()
    expect(() => pay(opened, ['bs12-034-hand'], [targetId])).toThrow()
    expect(getOptionalCostAttackPrompt(opened, playerId)?.targetCandidates.map(c => c.instanceId)).toEqual([sourceId])
  })
  it.each(['rested-ally', 'equipped-ally'] as const)('allows direct battle cost from %s; original HP/equipment are discarded', scenario => {
    const opened = attack(scenario, number)
    const done = pay(opened, ['bs12-034-ally'], [sourceId])
    expect(done.players[playerId].discardPile).toHaveLength(scenario === 'equipped-ally' ? 3 : 2)
    expect(done.cookiesFaintedThisTurn?.[playerId] ?? 0).toBe(0)
  })
  it('allows a non-Arena LV1 HP recipient but excludes it as a cost', () => {
    const opened = attack('non-arena-ally', number)
    expect(getCookieToBreakCostCandidates(opened.pendingOptionalCostAttack!.cost, opened.players[playerId]).map(c => c.instanceId)).not.toContain('bs12-034-ally')
    expect(pay(opened, ['bs12-034-hand'], ['bs12-034-ally']).players[playerId].battleArea[1].hpCards).toHaveLength(5)
  })
  it('settles LV10 immediately after payment and before HP or draw standby', () => {
    const opened = attack('break-nine', number)
    const done = pay(opened, ['bs12-034-hand'], [sourceId])
    expect(done.status).toBe('finished')
    expect(done.players[playerId].deck).toEqual(opened.players[playerId].deck)
    expect(done.pendingAfterDamageEffects).toBeUndefined()
  })
  it('R001 isolated Espresso cost standby waits for HP resolution; not printed trigger acceptance', () => {
    const opened = attack('espresso-ally', number)
    const done = pay(opened, ['bs12-034-ally'], [sourceId])
    expect(done.pendingAfterDamageEffects?.[0]).toMatchObject({ sourceInstanceId: 'bs12-034-ally', effect: { kind: 'draw-up-to', max: 1 } })
    const choice = applyGameCommand(done, { kind: 'resolve-after-damage-effect', playerId, targetIds: [] })
    const drawn = applyGameCommand(choice, { kind: 'resolve-draw-up-to', playerId, drawCount: 1 })
    expect(drawn.players[playerId].deck).toHaveLength(9)
  })
  it('cost descriptor masks another viewer’s private hand IDs', () => {
    const opened = attack('positive', number)
    const descriptor = compilePendingDecisionDescriptor(opened, undefined, { viewerPlayerId: 'player-two' })
    const cost = descriptor?.steps.find(step => step.id === 'cookie-break-cost')
    expect(cost?.candidateIds).toEqual([sourceId, 'bs12-034-ally'])
    expect(compilePendingDecisionDescriptor(opened, undefined, { viewerPlayerId: playerId })?.steps.find(step => step.id === 'cookie-break-cost')?.candidateIds).toContain('bs12-034-hand')
  })
  it('public trace names the real selected Break cost', () => {
    const opened = attack('positive', number)
    const command = { kind: 'resolve-optional-cost-attack' as const, playerId, action: 'pay' as const, cookieToBreakAreaIds: ['bs12-034-hand'], targetIds: [sourceId] }
    expect(describeCommandSteps(opened, applyGameCommand(opened, command), command)?.map(step => step.text).join(' ')).toMatch(/代價.*休息區/)
    expect(isOnlineGameCommand(command)).toBe(true)
    expect(isOnlineGameCommand({ ...command, cookieToBreakAreaIds: [1] })).toBe(false)
  })
  it('AI pays a legal hand cost and selects its target after payment', () => {
    const opened = attack('positive', number)
    const result = takeAiStep(opened, playerId)
    expect(result.state.players[playerId].breakArea.at(-1)?.instanceId).toBe('bs12-034-hand')
    expect(result.state.pendingOptionalCostAttack).toBeNull()
  })
  it.each(['wrong-energy', 'one-energy', 'rested-energy', 'rested-source'] as const)('blocks the attack for %s', scenario => {
    expect(() => attack(scenario, number)).toThrow()
  })
  it('routes only on localhost', () => {
    expect(parseTestStateConfig(`?test-state=${number.toLowerCase()}:positive`, 'localhost')).toMatchObject({ kind: 'bs12-034', cardNumber: number })
    expect(parseTestStateConfig(`?test-state=${number.toLowerCase()}:positive`, 'example.com')).toBeNull()
  })
})
