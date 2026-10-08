import { expect, it } from 'vitest'
import { createBs12UnderstandingDemoState, parseTestStateConfig, type Bs12UnderstandingScenario } from './demo'
import { applyGameCommand } from './commands'
import { getTrapCandidates, getTrapCostOptions } from './battle'
import { getAttackDamageAgainst, getEffectTargetCandidatesForEffect } from './effects'
import { advancePhase } from './turn'
import { describeCommand, describeCommandSteps } from './command-log'
import { takeAiStep } from './ai'
import type { GameState } from './types'

const actor = 'player-one' as const
const enemy = 'player-two' as const
const scenarios: Bs12UnderstandingScenario[] = ['nine', 'eight', 'ten', 'mixed', 'non-arena', 'opponent-trash', 'other-zones', 'wrong-energy', 'rested-energy', 'no-energy', 'one-energy', 'one-rested', 'spare-energy', 'disabled', 'used', 'main', 'after-battle', 'dj', 'expired']
const command = (targets = ['bs12-087-attacker'], payments = ['bs12-087-payment-0', 'bs12-087-payment-1']) => ({
  kind: 'play-trap' as const, playerId: actor, trapInstanceId: 'bs12-087-trap', targetIds: [], paymentIds: payments, effectTargets: [targets],
})
const play = (before = createBs12UnderstandingDemoState(), targets?: string[], payments?: string[]) => applyGameCommand(before, command(targets, payments))
const settle = (before: GameState) => {
  let state = before
  for (let i = 0; state.pendingBattle && i < 16; i++) state = applyGameCommand(state, state.pendingBattle.stage === 'attack-effect'
    ? { kind: 'resolve-attack-effect', playerId: enemy, targetIds: [] }
    : { kind: 'resolve-next-damage', playerId: actor })
  return state
}

it.each(['nine', 'ten', 'mixed', 'spare-energy', 'dj'] satisfies Bs12UnderstandingScenario[])('%s: PP and source joins trash, then same attacker gets total -3 without changing HP immediately', scenario => {
  const before = createBs12UnderstandingDemoState(scenario)
  const snapshot = structuredClone(before)
  expect(getTrapCandidates(before, actor).map(card => card.instanceId)).toEqual(['bs12-087-trap'])
  expect(getTrapCostOptions(before.players[actor].hand[0].trap!, before, actor)).toEqual([{ energy: { purple: 2 }, discardHand: 0 }])
  const paid = play(before)
  expect(paid.players[actor].hand).toEqual([])
  expect(paid.players[actor].discardPile.at(-1)?.instanceId).toBe('bs12-087-trap')
  expect(paid.players[actor].supportArea.map(s => s.rested)).toEqual([true, true, false])
  expect(paid.players[actor].battleArea).toEqual(before.players[actor].battleArea)
  expect(paid.players[enemy].battleArea).toEqual(before.players[enemy].battleArea)
  expect(paid.attackModifiers).toMatchObject([
    { sourceInstanceId: 'bs12-087-trap', targetInstanceId: 'bs12-087-attacker', amount: -2, expiresAfterTurn: 2 },
    { sourceInstanceId: 'bs12-087-trap', targetInstanceId: 'bs12-087-attacker', amount: -1, expiresAfterTurn: 2 },
  ])
  expect(paid.pendingBattle?.remainingDamage).toBe(0)
  expect(getAttackDamageAgainst(paid, 'bs12-087-other', 'bs12-087-defender')).toBe(1)
  expect(settle(paid).players[actor].battleArea[0].hpCards).toHaveLength(4)
  expect(before).toEqual(snapshot)
  expect(applyGameCommand(before, JSON.parse(JSON.stringify(command())))).toEqual(paid)
})

it.each(['eight', 'non-arena', 'opponent-trash', 'other-zones'] satisfies Bs12UnderstandingScenario[])('%s: below ten own trash Arena cards retains the unconditional -2', scenario => {
  const before = createBs12UnderstandingDemoState(scenario)
  const after = play(before)
  expect(after.attackModifiers).toHaveLength(1)
  expect(after.attackModifiers[0].amount).toBe(-2)
  expect(after.pendingBattle?.remainingDamage).toBe(1)
  expect(settle(after).players[actor].battleArea[0].hpCards).toHaveLength(3)
})

it.each(['nine', 'eight'] satisfies Bs12UnderstandingScenario[])('%s: selected rested non-Arena opponent gets both segments while original attacker still deals three', scenario => {
  const before = createBs12UnderstandingDemoState(scenario)
  const after = play(before, ['bs12-087-other'])
  expect(after.attackModifiers.map(m => m.targetInstanceId)).toEqual(Array(scenario === 'nine' ? 2 : 1).fill('bs12-087-other'))
  expect(getAttackDamageAgainst(after, 'bs12-087-other', 'bs12-087-defender')).toBe(0)
  expect(getAttackDamageAgainst(after, 'bs12-087-attacker', 'bs12-087-defender')).toBe(3)
  expect(settle(after).players[actor].battleArea[0].hpCards).toHaveLength(1)
})

it.each(['nine', 'eight'] satisfies Bs12UnderstandingScenario[])('%s: zero selection pays PP and discards source but modifies neither opponent', scenario => {
  const after = play(createBs12UnderstandingDemoState(scenario), [])
  expect(after.attackModifiers).toEqual([])
  expect(after.players[actor].hand).toEqual([])
  expect(after.pendingBattle?.remainingDamage).toBe(3)
  expect(settle(after).players[actor].battleArea[0].hpCards).toHaveLength(1)
})

it('ends both modifiers at current opponent turn end', () => {
  const state = advancePhase(advancePhase(settle(play())))
  expect(state.turnNumber).toBe(3)
  expect(state.attackModifiers).toEqual([])
  expect(getAttackDamageAgainst(state, 'bs12-087-attacker', 'bs12-087-defender')).toBe(3)
})

it('expired fixture advances the real phases and draws two without retaining reductions', () => {
  const state = createBs12UnderstandingDemoState('expired')
  expect(state.turnNumber).toBe(3)
  expect(state.activePlayerId).toBe(actor)
  expect(state.phase).toBe('main')
  expect(state.attackModifiers).toEqual([])
  expect(state.players[actor].hand).toHaveLength(2)
  expect(state.players[actor].deck).toHaveLength(10)
})

it('lists exactly two opponent Battle Area targets of any color and REST state', () => {
  const state = createBs12UnderstandingDemoState('other-zones')
  const effect = state.players[actor].hand[0].trap!.effects[0]
  expect(getEffectTargetCandidatesForEffect(state, { sourcePlayerId: actor, sourceInstanceId: 'bs12-087-trap' }, effect).map(c => c.card.instanceId)).toEqual(['bs12-087-attacker', 'bs12-087-other'])
})

it.each(['wrong-energy', 'rested-energy', 'no-energy', 'one-energy', 'one-rested', 'disabled', 'used', 'main', 'after-battle'] satisfies Bs12UnderstandingScenario[])('%s refuses declaration without changing input', scenario => {
  const state = createBs12UnderstandingDemoState(scenario)
  const snapshot = structuredClone(state)
  expect(getTrapCandidates(state, actor)).toEqual([])
  expect(() => play(state)).toThrow()
  expect(state).toEqual(snapshot)
})
it.each([{ ids: [] }, { ids: ['bs12-087-payment-0'] }, { ids: ['bs12-087-payment-0', 'bs12-087-payment-0'] }, { ids: ['bs12-087-payment-0', 'bs12-087-payment-1', 'bs12-087-payment-2'] }, { ids: ['unknown', 'bs12-087-payment-1'] }])('invalid payment $ids is atomic', ({ ids }) => {
  const state = createBs12UnderstandingDemoState()
  const snapshot = structuredClone(state)
  expect(() => play(state, undefined, ids)).toThrow()
  expect(state).toEqual(snapshot)
})
it.each([{ ids: ['bs12-087-defender'] }, { ids: ['bs12-087-payment-0'] }, { ids: ['unknown'] }, { ids: ['bs12-087-attacker', 'bs12-087-other'] }, { ids: ['bs12-087-attacker', 'bs12-087-attacker'] }])('invalid target $ids is atomic', ({ ids }) => {
  const state = createBs12UnderstandingDemoState()
  const snapshot = structuredClone(state)
  expect(() => play(state, ids)).toThrow()
  expect(state).toEqual(snapshot)
})
it('does not accept a new Then target from an additional effectTargets entry', () => {
  const state = createBs12UnderstandingDemoState()
  const after = applyGameCommand(state, { ...command(), effectTargets: [['bs12-087-attacker'], ['bs12-087-other']] })
  expect(after.attackModifiers.map(m => m.targetInstanceId)).toEqual(['bs12-087-attacker', 'bs12-087-attacker'])
})

it.each(['nine', 'eight'] satisfies Bs12UnderstandingScenario[])('%s public trace identifies actual Arena threshold and Then outcome', scenario => {
  const state = createBs12UnderstandingDemoState(scenario)
  const text = describeCommandSteps(state, play(state), command())?.map(step => step.text).join(' ')
  expect(text).toMatch(/Coming To An Understanding/)
  expect(text).toMatch(/支付能量/)
  expect(text).toMatch(/攻擊傷害 -2.*本回合/)
  expect(text).toMatch(scenario === 'nine' ? /10.*10.*同一.*-1/ : /9.*10.*條件不成立/)
})
it('zero public trace explains neither segment applies', () => {
  const state = createBs12UnderstandingDemoState()
  expect(describeCommandSteps(state, play(state, []), command([]))?.map(step => step.text).join(' ')).toMatch(/未選擇.*兩段/)
})
it('describes a paid Trap reaction as activation in the visible battle log summary', () => {
  const state = createBs12UnderstandingDemoState()
  expect(describeCommand(state, play(state), command())).toBe('玩家 發動了陷阱卡「Coming To An Understanding」')
})
it.each(['nine', 'eight'] satisfies Bs12UnderstandingScenario[])('%s AI follows PP and shared conditional same-target resolution', scenario => {
  const state = takeAiStep(createBs12UnderstandingDemoState(scenario), actor, { level: 2 }).state
  expect(state.players[actor].discardPile.at(-1)?.instanceId).toBe('bs12-087-trap')
  expect(state.pendingBattle?.remainingDamage).toBe(scenario === 'nine' ? 0 : 1)
})

it.each(scenarios)('%s fixture uses unique genuine cards and four-copy limits in every zone', scenario => {
  const state = createBs12UnderstandingDemoState(scenario)
  expect(parseTestStateConfig(`?test-state=bs12-087:${scenario}`, 'localhost')).toEqual({ kind: 'bs12-087', scenario })
  expect(parseTestStateConfig(`?test-state=bs12-087:${scenario}`, 'example.com')).toBeNull()
  for (const player of Object.values(state.players)) {
    expect(player.battleArea.length).toBeLessThanOrEqual(2)
    expect(player.breakArea.reduce((sum, c) => sum + c.level, 0)).toBeLessThan(10)
    const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea, ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
    expect(new Set(cards.map(c => c.instanceId)).size).toBe(cards.length)
    expect(cards.every(c => c.id.startsWith('BS12-') || c.id === 'BS1-009')).toBe(true)
    for (const id of new Set(cards.map(c => c.id))) expect(cards.filter(c => c.id === id).length).toBeLessThanOrEqual(4)
  }
})
