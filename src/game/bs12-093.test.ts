import { expect, it } from 'vitest'
import { createBs12RockstarDemoState, BS12_ROCKSTAR_SCENARIOS, parseTestStateConfig } from './demo'
import type { Bs12RockstarScenario } from './demo'
import { applyGameCommand } from './commands'
import { getOptionalCostAttackPrompt } from '../components/modals/optionalCostAttackPrompt'
import type { GameState } from './types'
import { getBlockerCandidates } from './battle'
import { describeCommandSteps } from './command-log'
import { compilePendingDecisionDescriptor } from './decision-descriptor-compiler'
import { takeAiStep } from './ai'
import { isOnlineGameCommand } from '../net/onlineProtocol'

// Actual printed Rockstar source exercises the independent two-Blocker bottom cost.
const offered = () => {
  let state=createBs12RockstarDemoState('BS12-093','two-blockers')
  const own=state.players['player-one']
  state={...state,players:{...state.players,'player-one':{...own,discardPile:own.discardPile.slice(0,2).map((card,index)=>({...card,instanceId:index===0?'first-blocker':'second-blocker'}))}}}
  state=applyGameCommand(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:'bs12-093-source',targetInstanceId:'bs12-093-opponent',supportPaymentIds:own.supportArea.map(support=>support.card.instanceId)})
  state=applyGameCommand(state,{kind:'skip-trap',playerId:'player-two'})
  while(state.pendingBattle?.stage==='damage')state=applyGameCommand(state,{kind:'resolve-next-damage',playerId:'player-two'})
  return applyGameCommand(state,{kind:'resolve-attack-effect',playerId:'player-one',targetIds:[]})
}

const pay = (state: GameState, trashToDeckIds = ['second-blocker', 'first-blocker'], targetIds: string[] = []) => applyGameCommand(state, {
  kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'pay', trashToDeckIds, targetIds,
})

it('093 shared Then prompt exposes exactly two own printed Blocker Cookies in bottom order', () => {
  const prompt = getOptionalCostAttackPrompt(offered(), 'player-one')
  expect(prompt?.trashToDeckCost).toBe(2)
  expect(prompt?.trashToDeckCandidates.map(card => card.instanceId)).toEqual(['first-blocker', 'second-blocker'])
  expect(prompt?.costText).toMatch(/牌庫底|最下方/)
})
it('093 shared Then pays ordered bottom cost even with zero damage targets and preserves the original deck', () => {
  const before = offered()
  const original = structuredClone(before)
  const after = pay(before)
  expect(after.players['player-one'].deck).toEqual([...before.players['player-one'].deck, before.players['player-one'].discardPile[1], before.players['player-one'].discardPile[0]])
  expect(after.players['player-one'].discardPile).toEqual([])
  expect(after.players['player-two']).toEqual(before.players['player-two'])
  expect(after.pendingOptionalCostAttack).toBeFalsy()
  expect(after.pendingBattle).toBeFalsy()
  expect(before).toEqual(original)
})

const damage = (before: GameState) => {
  let state = before
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 12; i++) state = applyGameCommand(state, {
    kind: 'resolve-next-damage', playerId: state.pendingBattle.damagePlayerId ?? state.pendingBattle.defenderPlayerId,
  })
  return state
}
const actualThen = (scenario: Bs12RockstarScenario = 'attack', number: 'BS12-093' | 'BS12-093@1' = 'BS12-093') => {
  const state = createBs12RockstarDemoState(number, scenario)
  const declared = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: 'bs12-093-source', targetInstanceId: 'bs12-093-opponent', supportPaymentIds: ['bs12-093-payment-0', 'bs12-093-payment-1', 'bs12-093-payment-2'] })
  const dealt = damage(applyGameCommand(declared, { kind: 'skip-trap', playerId: 'player-two' }))
  return applyGameCommand(dealt, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] })
}
const actualPay = (state: GameState, targetIds: string[] = ['bs12-093-opponent-other'], trashToDeckIds = ['bs12-093-red-blocker', 'bs12-093-blocker']) => applyGameCommand(state, {
  kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'pay', trashToDeckIds, targetIds,
})
it.each(['BS12-093', 'BS12-093@1'] as const)('%s pays PPN ordinary three before independent ordered bottom cost and opposing one damage', number => {
  const before = actualThen('attack', number)
  expect(before.players['player-two'].battleArea[0].card.id).toBe('BS12-064')
  expect(before.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
  expect(before.players['player-one'].supportArea.every(s => s.rested)).toBe(true)
  expect(before.players['player-one'].discardPile).toHaveLength(5)
  const after = damage(actualPay(before))
  expect(after.players['player-one'].deck).toEqual([...before.players['player-one'].deck, before.players['player-one'].discardPile[1], before.players['player-one'].discardPile[0]])
  expect(after.players['player-one'].discardPile.map(c => c.instanceId)).toEqual(['bs12-093-third-blocker', 'bs12-093-non-blocker', 'bs12-093-non-cookie'])
  expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([2, 1])
  expect(after.pendingBattle).toBeFalsy()
})
it.each([[], ['bs12-093-opponent'], ['bs12-093-opponent-other']].map(targetIds => ({ targetIds })))('093 up-to-one damage permits selected opponent or zero while still paying two: $targetIds', ({ targetIds }) => {
  const before = actualThen()
  const after = damage(actualPay(before, targetIds))
  expect(after.players['player-one'].deck).toHaveLength(14)
  expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([targetIds.includes('bs12-093-opponent') ? 1 : 2, targetIds.includes('bs12-093-opponent-other') ? 1 : 2])
})
it('093 skips Then without moving its cost cards', () => {
  const before = actualThen()
  const after = applyGameCommand(before, { kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'skip' })
  expect(after.players).toEqual(before.players)
  expect(after.pendingBattle).toBeFalsy()
})
it.each([[], ['bs12-093-blocker'], ['bs12-093-blocker', 'bs12-093-blocker'], ['bs12-093-blocker', 'bs12-093-red-blocker', 'bs12-093-third-blocker'], ['bs12-093-blocker', 'bs12-093-non-blocker'], ['bs12-093-blocker', 'bs12-093-non-cookie'], ['bs12-093-blocker', 'bs12-093-source'], ['bs12-093-blocker', 'missing']].map(ids => ({ ids })))('093 rejects illegal exact-two actual trash Blocker cost atomically: $ids', ({ ids }) => {
  const before = actualThen()
  const copy = structuredClone(before)
  expect(() => actualPay(before, [], ids)).toThrow()
  expect(before).toEqual(copy)
})
it.each([['bs12-093-source'], ['bs12-093-opponent', 'bs12-093-opponent-other'], ['bs12-093-opponent', 'bs12-093-opponent'], ['missing']].map(ids => ({ ids })))('093 rejects illegal damage selection without moving bottom costs: $ids', ({ ids }) => {
  const before = actualThen()
  const copy = structuredClone(before)
  expect(() => actualPay(before, ids)).toThrow()
  expect(before).toEqual(copy)
})
it.each(['one-blocker', 'no-blocker', 'wrong-zones'] as const)('093 cost shortfall exposes a warning and requires skip: %s', scenario => {
  const before = actualThen(scenario)
  const prompt = getOptionalCostAttackPrompt(before, 'player-one')!
  expect(prompt.trashToDeckCandidates.length).toBe(scenario === 'no-blocker' ? 0 : 1)
  expect(prompt.paymentUnavailableWarning).toMatch(/棄牌區.*不足|棄牌區.*沒有足夠/)
  expect(() => actualPay(before)).toThrow()
  expect(takeAiStep(before, 'player-one').state.players).toEqual(before.players)
})
it('093 actual printed Blockers need no color, Arena, level or currently affordable Blocker hand cost', () => {
  const before = actualThen()
  expect(before.players['player-one'].hand).toEqual([])
  expect(getOptionalCostAttackPrompt(before, 'player-one')!.trashToDeckCandidates.map(c => c.instanceId)).toEqual(['bs12-093-blocker', 'bs12-093-red-blocker', 'bs12-093-third-blocker'])
  expect(before.players['player-one'].discardPile[1].keywords ?? []).not.toContain('arena')
  expect(damage(actualPay(before)).players['player-one'].deck.at(-2)?.instanceId).toBe('bs12-093-red-blocker')
})
it('093 can choose the other opponent after the original ordinary target faints', () => {
  const before = actualThen('ordinary-faint')
  expect(before.players['player-two'].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-093-opponent-other'])
  expect(getOptionalCostAttackPrompt(before, 'player-one')!.targetCandidates.map(c => c.instanceId)).toEqual(['bs12-093-opponent-other'])
  const after = damage(actualPay(before))
  expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
  expect(after.players['player-two'].breakArea.map(c => c.instanceId)).toContain('bs12-093-opponent')
})
it('093 extra damage moves a one-HP target to break only after two costs went to bottom', () => {
  const before = actualThen('damage-faint')
  const after = damage(actualPay(before))
  expect(after.players['player-one'].deck).toHaveLength(14)
  expect(after.players['player-two'].breakArea.map(c => c.instanceId)).toContain('bs12-093-opponent-other')
})
it.each(['last-hp-flip', 'refresh', 'refresh-defeat'] as const)('093 retains paid bottom cost through opposing last HP FLIP: %s', scenario => {
  const before = actualThen(scenario)
  const after = damage(actualPay(before))
  expect(after.pendingBattle?.stage).toBe('flip')
  expect(after.players['player-one'].deck).toHaveLength(14)
  const skipped = applyGameCommand(after, { kind: 'resolve-flip', playerId: 'player-two', activate: false, targetIds: [] })
  expect(skipped.players['player-two'].breakArea.map(c => c.instanceId)).toContain('bs12-093-opponent-other')
})
it('093 command trace and JSON replay preserve reverse cost order and zero choice without private deck contents', () => {
  const before = actualThen()
  const command = { kind: 'resolve-optional-cost-attack' as const, playerId: 'player-one' as const, action: 'pay' as const, trashToDeckIds: ['bs12-093-red-blocker', 'bs12-093-blocker'], targetIds: [] }
  const after = applyGameCommand(before, command)
  expect(isOnlineGameCommand(command)).toBe(true)
  expect(applyGameCommand(before, JSON.parse(JSON.stringify(command)))).toEqual(after)
  const steps = describeCommandSteps(before, after, command)!
  expect(steps.find(s => /代價.*牌庫底/.test(s.text))?.cards?.map(c => c.instanceId)).toEqual(command.trashToDeckIds)
  expect(JSON.stringify(steps)).not.toContain('bs12-093-own-deck')
  const descriptor = compilePendingDecisionDescriptor(before)!
  expect(descriptor.steps.find(s => s.id === 'trash-bottom-cost')).toMatchObject({ kind: 'cost', required: true, min: 2, max: 2, candidateIds: ['bs12-093-blocker', 'bs12-093-red-blocker', 'bs12-093-third-blocker'] })
})
it.each(['last-hp-flip', 'refresh', 'refresh-defeat'] as const)('093 opposing FLIP rescues before faint and preserves bottom cost through Refresh: %s', scenario => {
  const revealed = damage(actualPay(actualThen(scenario)))
  const rescued = applyGameCommand(revealed, { kind: 'resolve-flip', playerId: 'player-two', activate: true, targetIds: ['bs12-093-opponent-other'], discardHandIds: ['bs12-093-flip-hand-cost'] })
  expect(rescued.players['player-one'].deck).toHaveLength(14)
  expect(rescued.players['player-two'].battleArea.find(c => c.card.instanceId === 'bs12-093-opponent-other')?.hpCards).toHaveLength(1)
  if (scenario !== 'last-hp-flip') {
    expect(rescued.pendingRefresh?.playerId).toBe('player-two')
    const refreshed = applyGameCommand(rescued, { kind: 'refresh-deck', playerId: 'player-two', cookieInstanceId: 'bs12-093-refresh-cookie' }, { shuffleSeed: 93 })
    expect(refreshed.status).toBe(scenario === 'refresh-defeat' ? 'finished' : 'playing')
    expect(refreshed.players['player-one'].deck).toHaveLength(14)
    expect(refreshed.players['player-two'].breakArea.map(c => c.instanceId)).toContain('bs12-093-refresh-cookie')
  }
  else expect(rescued.pendingBattle).toBeFalsy()
})
it.each([1, 2, 3, 4, 5] as const)('093 deterministic AI level %i pays two actual ordered Blockers before damage', level => {
  const before = actualThen()
  const after = takeAiStep(before, 'player-one', { level }).state
  expect(after.players['player-one'].deck).toHaveLength(14)
  expect(after.players['player-one'].discardPile.filter(c => c.type === 'cookie' && c.skill?.trigger === 'block')).toHaveLength(1)
})
it.each(['response', 'item-cost', 'stage-cost', 'trap-cost', 'rested-blocker', 'second-response'] as const)('093 Blocker pays one purple Arena hand card separately from trash Then: %s', scenario => {
  const before = createBs12RockstarDemoState('BS12-093', scenario)
  const id = scenario === 'second-response' ? 'bs12-093-hand-cost-two' : 'bs12-093-hand-cost'
  expect(getBlockerCandidates(before, 'player-one').map(c => c.card.instanceId)).toContain('bs12-093-source')
  const after = applyGameCommand(before, { kind: 'play-blocker', playerId: 'player-one', sourceInstanceId: 'bs12-093-source', discardHandIds: [id], paymentIds: [] })
  expect(after.pendingBattle?.targetInstanceId).toBe('bs12-093-source')
  expect(after.players['player-one'].discardPile.at(-1)?.instanceId).toBe(id)
  expect(after.players['player-one'].deck).toEqual(before.players['player-one'].deck)
  expect(after.players['player-one'].supportArea).toEqual(before.players['player-one'].supportArea)
  expect(after.players['player-one'].battleArea[0].rested).toBe(before.players['player-one'].battleArea[0].rested)
})
it.each(['no-hand', 'wrong-hand-color', 'non-arena-hand', 'split-hand'] as const)('093 Blocker rejects the hand cost intersection: %s', scenario => {
  const before = createBs12RockstarDemoState('BS12-093', scenario)
  expect(getBlockerCandidates(before, 'player-one')).toEqual([])
  expect(() => applyGameCommand(before, { kind: 'play-blocker', playerId: 'player-one', sourceInstanceId: 'bs12-093-source', discardHandIds: ['bs12-093-hand-cost'], paymentIds: [] })).toThrow()
})
it.each(['wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main'] as const)('093 PPN ordinary attack rejects illegal payment or timing: %s', scenario => {
  const before = createBs12RockstarDemoState('BS12-093', scenario)
  const copy = structuredClone(before)
  expect(() => applyGameCommand(before, { kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: 'bs12-093-source', targetInstanceId: 'bs12-093-opponent', supportPaymentIds: ['bs12-093-payment-0', 'bs12-093-payment-1', 'bs12-093-payment-2'] })).toThrow()
  expect(before).toEqual(copy)
})
it('093 localhost route rejects unsupported scenario, print and remote host', () => {
  expect(parseTestStateConfig('?test-state=bs12-093:BS12-093@1:attack', 'localhost')).toMatchObject({ kind: 'bs12-093', cardNumber: 'BS12-093@1', scenario: 'attack' })
  expect(parseTestStateConfig('?test-state=bs12-093:BS12-093:invalid', 'localhost')).toBeNull()
  expect(parseTestStateConfig('?test-state=bs12-093:BS12-093@2:attack', 'localhost')).toBeNull()
  expect(parseTestStateConfig('?test-state=bs12-093:BS12-093:attack', 'example.com')).toBeNull()
})
it.each(BS12_ROCKSTAR_SCENARIOS)('093 fixture preserves distinct actual cards, two battle slots and four-copy limit: %s', scenario => {
  const state = createBs12RockstarDemoState('BS12-093', scenario)
  const ids: string[] = []
  for (const player of Object.values(state.players)) {
    expect(player.battleArea.length).toBeLessThanOrEqual(2)
    const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea, ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
    ids.push(...cards.map(c => c.instanceId))
    const counts = new Map<string, number>()
    for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
    expect([...counts.values()].every(n => n <= 4)).toBe(true)
  }
  expect(new Set(ids).size).toBe(ids.length)
})
