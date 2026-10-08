import { describe, expect, it } from 'vitest'
import { createBs12ClottedDemoState, parseTestStateConfig, type Bs12ClottedScenario } from './demo'
import { applyGameCommand } from './commands'
import { getEffectSelectionCandidates } from './effects'
import { assertBs12PhysicalFixture } from './bs12-physical-fixtures.test-helpers'
import type { GameState } from './types'
const owner = 'player-one' as const, foe = 'player-two' as const
const source = 'bs12-036-source', ally = 'bs12-036-ally'
const open = (state: GameState) => {
  let next = applyGameCommand(state, { kind: 'declare-attack', playerId: owner, attackerInstanceId: source, targetInstanceId: 'bs12-036-opponent', supportPaymentIds: state.players[owner].supportArea.map(s => s.card.instanceId) })
  next = applyGameCommand(next, { kind: 'skip-trap', playerId: foe })
  for (let i = 0; i < 3; i++) next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: foe })
  return applyGameCommand(next, { kind: 'resolve-attack-effect', playerId: owner, targetIds: [] })
}
const pay = (state: GameState, ids = [ally]) => applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId: owner, action: 'pay', cookieToBreakAreaIds: ids, targetIds: [] })
const choices = (state: GameState) => {
  const pending = state.pendingAbilityEffect!
  return getEffectSelectionCandidates(state, { sourcePlayerId: owner, sourceInstanceId: source }, pending.effects[pending.effectIndex])
}
describe.each(['BS12-036', 'BS12-036@1'] as const)('%s R003 actual parent, payment and Break targets', number => {
  it.each(['then-positive', 'then-rested'] as const)('pays another actual battle Arena before selecting revival: %s', scenario => {
    const before = createBs12ClottedDemoState(scenario, number)
    assertBs12PhysicalFixture(before)
    expect(before.players[foe].battleArea.every(c => c.hpCards.length === c.card.hp)).toBe(true)
    expect(before.commandLog?.map(c => c.commandKind)).toEqual(['play-extra-deck-cookie', 'begin-activate-skill', 'resolve-ability-effect'])
    const pending = open(before), paid = pay(pending)
    const cost = before.players[owner].battleArea.find(c => c.card.instanceId === ally)!
    expect(paid.players[owner].breakArea.at(-1)?.instanceId).toBe(ally)
    expect(paid.players[owner].discardPile).toEqual(cost.hpCards)
    expect(paid.players[owner].battleArea.map(c => c.card.instanceId)).toEqual([source])
    expect(paid.pendingReplacement).toBeFalsy()
    expect(paid.players[owner].supportArea).toEqual(pending.players[owner].supportArea)
    expect(choices(paid).map(c => c.instanceId)).not.toContain(ally)
    const target = choices(paid).find(c => c.id === 'BS12-034')!
    const revived = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [target.instanceId] })
    const entry = revived.players[owner].battleArea.find(c => c.card.instanceId === target.instanceId)!
    expect(entry.hpCards).toEqual(paid.players[owner].deck.slice(0, entry.card.hp))
    expect(entry.enteredFrom).toBe('break')
    expect(revived.players[owner].battleArea.find(c => c.card.instanceId === source)?.hpCards).toHaveLength(6)
    assertBs12PhysicalFixture(revived)
  })
  it.each(['then-same-number', 'then-same-alt'] as const)('excludes every print of the just-paid base card number: %s', scenario => {
    const paid = pay(open(createBs12ClottedDemoState(scenario, number)))
    assertBs12PhysicalFixture(paid)
    expect(paid.costRecord?.cookieToBreakPayment?.cards).toEqual([{ instanceId: ally, cardNumber: 'BS12-032' }])
    expect(choices(paid).every(c => c.id !== 'BS12-032')).toBe(true)
    for (const id of [ally, 'bs12-036-break-0', ...(scenario === 'then-same-alt' ? ['r003-same-alt'] : [])]) {
      const snapshot = structuredClone(paid)
      expect(() => applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [id] })).toThrow()
      expect(paid).toEqual(snapshot)
    }
  })
  it.each(['then-red', 'then-green', 'then-blue', 'then-purple', 'then-black'] as const)('revives any-color printed LV1 Arena: %s', scenario => {
    const before = createBs12ClottedDemoState(scenario, number)
    assertBs12PhysicalFixture(before)
    const paid = pay(open(before))
    const target = choices(paid).find(c => c.instanceId === 'r003-revival')!
    expect(target.type).toBe('cookie')
    const revived = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: owner, targetIds: ['r003-revival'] })
    expect(revived.players[owner].battleArea.find(c => c.card.instanceId === 'r003-revival')?.hpCards).toHaveLength(target.type === 'cookie' ? target.hp : -1)
    assertBs12PhysicalFixture(revived)
  })
  it('allows zero revival after paying, and allows skipping the entire unpaid Then', () => {
    const pending = open(createBs12ClottedDemoState('then-positive', number))
    const skipped = applyGameCommand(pending, { kind: 'resolve-optional-cost-attack', playerId: owner, action: 'skip' })
    expect(skipped.players).toEqual(pending.players)
    const paid = pay(pending)
    const zero = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [] })
    expect(zero.players).toEqual(paid.players)
    expect(zero.pendingBattle).toBeFalsy()
  })
  it('the actual Arena battle cost triggers the paid Choux Skill exactly once after Then', () => {
    const paid = pay(open(createBs12ClottedDemoState('then-same-number', number)))
    expect(paid.pendingAfterDamageEffects?.filter(e => e.sourceInstanceId === ally)).toHaveLength(1)
    const parentDone = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [] })
    const triggered = applyGameCommand(parentDone, { kind: 'resolve-after-damage-effect', playerId: owner, targetIds: [source] })
    expect(triggered.players[owner].battleArea.find(c => c.card.instanceId === source)?.hpCards).toHaveLength(7)
    expect(triggered.pendingAfterDamageEffects).toBeUndefined()
    assertBs12PhysicalFixture(triggered)
  })
  it('pays even with no legal different LV1 target', () => {
    const paid = pay(open(createBs12ClottedDemoState('then-no-target', number)))
    expect(paid.players[owner].breakArea).toHaveLength(5)
    expect(choices(paid)).toEqual([])
    const done = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [] })
    expect(done.players).toEqual(paid.players)
  })
  it.each(['then-non-arena-cost', 'then-no-cost'] as const)('cannot pay a non-Arena Cookie or the source: %s', scenario => {
    const pending = open(createBs12ClottedDemoState(scenario, number)), snapshot = structuredClone(pending)
    for (const ids of [[], [source], [ally], [ally, ally], ['bs12-036-break-2'], ['bs12-036-payment-0'], ['bs12-036-opponent']]) expect(() => pay(pending, ids)).toThrow()
    expect(pending).toEqual(snapshot)
  })
  it.each(['then-positive', 'then-rested', 'then-same-number', 'then-same-alt', 'then-red', 'then-green', 'then-blue', 'then-purple', 'then-black', 'then-no-target'] as Bs12ClottedScenario[])('parses dedicated real-card route %s', scenario => {
    expect(parseTestStateConfig('?test-state=' + number.toLowerCase() + ':' + scenario, 'localhost')).toMatchObject({ kind: 'bs12-036', cardNumber: number, scenario })
  })
})
