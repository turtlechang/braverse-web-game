import { describe, expect, it } from 'vitest'
import { createBs12KumihoDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { getAttackResponseSkillCandidates } from './battle'
import { getAttackDamageAgainst } from './effects'
import { describeCommandSteps } from './command-log'
import { takeAiStep } from './ai'
import { hasPendingCardResolution } from './pending'

const playerId = 'player-one' as const
type State = ReturnType<typeof createBs12KumihoDemoState>
const command = (ids = ['bs12-053-support-0']) => ({ kind: 'play-attack-response' as const, playerId, sourceInstanceId: 'bs12-053-source', discardHandIds: [], trashToDeckIds: [], supportToTrashIds: ids })
const pay = (state: State, ids?: string[]) => applyGameCommand(state, command(ids))
const finishDamage = (state: State) => {
  let after = state
  for (let i = 0; after.pendingBattle?.stage === 'damage' && i < 15; i++) after = applyGameCommand(after, { kind: 'resolve-next-damage', playerId: after.pendingBattle.damagePlayerId ?? after.pendingBattle.defenderPlayerId })
  return after
}
const attack = (state: State) => finishDamage(applyGameCommand(applyGameCommand(state, { kind: 'declare-attack', playerId, attackerInstanceId: 'bs12-053-source', targetInstanceId: 'bs12-044-opponent', supportPaymentIds: [0, 1, 2, 3].map(i => `bs12-053-support-${i}`) }), { kind: 'skip-trap', playerId: 'player-two' }))
const then = (state: State, targets = ['bs12-044-opponent', 'bs12-044-opponent-other']) => applyGameCommand(state, { kind: 'resolve-attack-effect', playerId, targetIds: targets })

describe.each(['BS12-053', 'BS12-053@1'] as const)('%s actual attack response support cost', number => {
  it('restricts both print fixtures to localhost', () => {
    expect(parseTestStateConfig(`?test-state=bs12-053:${number}:response`, 'localhost')).toEqual({ kind: 'bs12-053', cardNumber: number, scenario: 'response' })
    expect(parseTestStateConfig(`?test-state=bs12-053:${number}:response`, 'example.com')).toBeNull()
  })
  it.each([0, 1, 2, 3])('trashes any support type/color/REST before choosing reduction: %s', index => {
    const before = createBs12KumihoDemoState('response', number)
    const snapshot = structuredClone(before)
    const card = before.players[playerId].supportArea[index].card
    const after = pay(before, [card.instanceId])
    expect(after.players[playerId].supportArea).toHaveLength(3)
    expect(after.players[playerId].discardPile.at(-1)).toEqual(card)
    expect(after.players[playerId].hand).toEqual(before.players[playerId].hand)
    expect(after.supportAreaDecreasedThisTurn?.[playerId]).toBe(true)
    expect(after.supportCardsTrashedThisTurn?.[playerId]).toBe(1)
    expect(after.pendingBattle?.stage).toBe('trap')
    expect(after.pendingAbilityEffect?.effects[0].kind).toBe('modify-attack')
    expect(after.skillUsesThisTurn).toContain(before.players[playerId].battleArea[0].battleEntryId)
    expect(getAttackResponseSkillCandidates(after, playerId)).toEqual([])
    expect(before).toEqual(snapshot)
  })
  it('hides response without support and rejects missing cost', () => {
    const before = createBs12KumihoDemoState('response-no-support', number)
    expect(getAttackResponseSkillCandidates(before, playerId)).toEqual([])
    expect(() => pay(before, [])).toThrow()
  })
  it.each([[], ['unknown'], ['bs12-053-hand'], ['bs12-053-foe-support-0'], ['bs12-053-support-0', 'bs12-053-support-0'], ['bs12-053-support-0', 'bs12-053-support-1']].map(ids => ({ ids })))('rejects illegal support cost $ids without changing state', ({ ids }) => {
    const before = createBs12KumihoDemoState('response', number)
    const snapshot = structuredClone(before)
    expect(() => pay(before, ids)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each(['response-rested-source', 'response-other', 'response-rested-support'] as const)('source need not be active or attacked and support need not be active: %s', scenario => {
    const before = createBs12KumihoDemoState(scenario, number)
    const paid = pay(before)
    const after = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: [before.pendingBattle!.attackerInstanceId] })
    expect(getAttackDamageAgainst(after, before.pendingBattle!.attackerInstanceId, before.pendingBattle!.targetInstanceId)).toBe(2)
    expect(after.pendingBattle?.stage).toBe('trap')
    expect(after.players[playerId].battleArea[0].rested).toBe(before.players[playerId].battleArea[0].rested)
  })
  it('paid zero consumes one support and once-per-turn without reduction', () => {
    const before = createBs12KumihoDemoState('response', number)
    const after = applyGameCommand(pay(before), { kind: 'resolve-ability-effect', playerId, targetIds: [] })
    expect(getAttackDamageAgainst(after, before.pendingBattle!.attackerInstanceId, before.pendingBattle!.targetInstanceId)).toBe(4)
    expect(after.attackModifiers).toEqual(before.attackModifiers)
    expect(() => pay(after, ['bs12-053-support-1'])).toThrow(/once per turn/)
  })
  it('records the actual support card as a public cost', () => {
    const before = createBs12KumihoDemoState('response', number)
    const cost = command(['bs12-053-support-2'])
    const steps = describeCommandSteps(before, applyGameCommand(before, cost), cost)!
    expect(steps.find(step => /支援區送入棄牌區/.test(step.text))?.cards?.map(c => c.instanceId)).toEqual(cost.supportToTrashIds)
  })
  it('recomputes ordinary damage only when the response window closes', () => {
    const before = createBs12KumihoDemoState('response', number)
    const reduced = applyGameCommand(pay(before), { kind: 'resolve-ability-effect', playerId, targetIds: ['bs12-044-opponent'] })
    const after = finishDamage(applyGameCommand(reduced, { kind: 'skip-trap', playerId }))
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(4)
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it('cannot close the response window while reduction is still awaiting a target', () => {
    const paid = pay(createBs12KumihoDemoState('response', number))
    expect(() => applyGameCommand(paid, { kind: 'skip-trap', playerId })).toThrow()
    expect(paid.players[playerId].battleArea[0].hpCards).toHaveLength(6)
  })
  it('another legal response source waits for the first effect instead of replacing its queue', () => {
    const base = createBs12KumihoDemoState('response', number)
    const own = base.players[playerId]
    const second = { ...own.battleArea[0], card: { ...own.battleArea[0].card, instanceId: 'bs12-053-second' }, battleEntryId: 'bs12-053-second:battle:2' }
    const before = { ...base, players: { ...base.players, [playerId]: { ...own, battleArea: [...own.battleArea, second] } } }
    const paid = pay(before)
    expect(getAttackResponseSkillCandidates(paid, playerId)).toEqual([])
    expect(() => applyGameCommand(paid, { ...command(['bs12-053-support-1']), sourceInstanceId: second.card.instanceId })).toThrow()
    const resolved = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
    expect(getAttackResponseSkillCandidates(resolved, playerId).map(c => c.card.instanceId)).toEqual([second.card.instanceId])
    expect(applyGameCommand(resolved, { ...command(['bs12-053-support-1']), sourceInstanceId: second.card.instanceId }).players[playerId].supportArea).toHaveLength(2)
  })
  it('ordinary reduction expires at the real turn end and use counter resets in active phase', () => {
    const before = createBs12KumihoDemoState('response', number)
    const reduced = applyGameCommand(pay(before), { kind: 'resolve-ability-effect', playerId, targetIds: ['bs12-044-opponent'] })
    let after = finishDamage(applyGameCommand(reduced, { kind: 'skip-trap', playerId }))
    after = applyGameCommand(after, { kind: 'advance-phase', playerId: 'player-two' })
    after = applyGameCommand(after, { kind: 'advance-phase', playerId: 'player-two' })
    expect(after.attackModifiers).toEqual([])
    after = applyGameCommand(after, { kind: 'advance-phase', playerId })
    expect(after.skillUsesThisTurn).toEqual([])
  })
  it('selecting the other opponent reduces that Cookie without redirecting current damage', () => {
    const before = createBs12KumihoDemoState('response', number)
    const reduced = applyGameCommand(pay(before), { kind: 'resolve-ability-effect', playerId, targetIds: ['bs12-044-opponent-other'] })
    expect(getAttackDamageAgainst(reduced, 'bs12-044-opponent-other', 'bs12-053-source')).toBe(0)
    const after = finishDamage(applyGameCommand(reduced, { kind: 'skip-trap', playerId }))
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(2)
  })
  it('skipping response spends no cost and does not use once-per-turn', () => {
    const before = createBs12KumihoDemoState('response', number)
    const after = finishDamage(applyGameCommand(before, { kind: 'skip-trap', playerId }))
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea)
    expect(after.skillUsesThisTurn).toEqual([])
  })
  it('blocks an already used response', () => {
    const before = createBs12KumihoDemoState('response-used', number)
    expect(getAttackResponseSkillCandidates(before, playerId)).toEqual([])
    expect(() => pay(before)).toThrow()
  })
  it('only offers the response to the defending player in the attack window', () => {
    const main = createBs12KumihoDemoState('attack', number)
    expect(getAttackResponseSkillCandidates(main, playerId)).toEqual([])
    expect(() => pay(main)).toThrow()
    const attacked = createBs12KumihoDemoState('response', number)
    expect(getAttackResponseSkillCandidates(attacked, 'player-two')).toEqual([])
    expect(() => applyGameCommand(attacked, { ...command(), playerId: 'player-two' })).toThrow()
  })
  it('rejects own, unknown and more than one opponent reduction target', () => {
    const paid = pay(createBs12KumihoDemoState('response', number))
    for (const targetIds of [['bs12-053-source'], ['unknown'], ['bs12-044-opponent', 'bs12-044-opponent-other']]) expect(() => applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds })).toThrow()
  })
  it('AI pays a real support when answering a lethal attack', () => {
    const before = createBs12KumihoDemoState('response-last-hp', number)
    const decision = takeAiStep(before, playerId, { level: 2, seed: 1 })
    expect(decision.action).toBe('play-attack-response')
    expect(decision.state.players[playerId].supportArea).toHaveLength(3)
    expect(decision.state.players[playerId].discardPile).toHaveLength(1)
  })
  it.each(['attack', 'attack-rested-fifth'] as const)('ordinary three precedes sequential one to every remaining opponent: %s', scenario => {
    const before = createBs12KumihoDemoState(scenario, number)
    const waiting = attack(before)
    expect(waiting.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3, 3])
    const after = finishDamage(then(waiting))
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([2, 2])
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(6)
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it('an unpaid active own non-Arena blue Cookie blocks Then; active opponent support does not', () => {
    const waiting = attack(createBs12KumihoDemoState('attack-active-fifth', number))
    const after = then(waiting, [])
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3, 3])
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it('requires the full set of opponent targets and rejects duplicates or own target', () => {
    const waiting = attack(createBs12KumihoDemoState('attack', number))
    for (const targetIds of [[], ['bs12-044-opponent'], ['bs12-044-opponent', 'bs12-044-opponent'], ['bs12-044-opponent', 'bs12-053-source']]) expect(() => then(waiting, targetIds)).toThrow()
    expect(finishDamage(then(waiting, ['bs12-044-opponent-other', 'bs12-044-opponent'])).players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([2, 2])
  })
  it('original ordinary target can faint before Then damages the remaining opponent', () => {
    const waiting = attack(createBs12KumihoDemoState('attack-target-faint', number))
    expect(waiting.players['player-two'].breakArea).toHaveLength(1)
    const after = finishDamage(then(waiting, ['bs12-044-opponent-other']))
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it('sequential additional damage resolves each faint before completing', () => {
    const after = finishDamage(then(attack(createBs12KumihoDemoState('attack-other-faint', number))))
    expect(after.players['player-two'].breakArea).toHaveLength(1)
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it('stops sequential damage at the actual HP FLIP then resumes the next damage step', () => {
    const waiting = finishDamage(then(attack(createBs12KumihoDemoState('attack-flip', number))))
    expect(waiting.pendingBattle?.stage).toBe('flip')
    expect(waiting.pendingBattle?.revealedHpCard?.id).toBe('BS12-022')
    const after = finishDamage(applyGameCommand(waiting, { kind: 'resolve-flip', playerId: 'player-two', activate: false }))
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([2, 2])
    expect(hasPendingCardResolution(after)).toBe(false)
  })
  it.each(['attack-few', 'attack-wrong', 'attack-rested-energy', 'attack-rested-source', 'attack-source-support', 'attack-opponent-turn', 'attack-outside-main'] as const)('rejects illegal attack %s', scenario => {
    expect(() => attack(createBs12KumihoDemoState(scenario, number))).toThrow()
  })
})
