import { describe, expect, it } from 'vitest'
import { createBs12BananaRotiDemoState, parseTestStateConfig, type Bs12BananaRotiScenario } from './demo'
import { applyGameCommand } from './commands'
import { describeCommandSteps } from './command-log'
import { getOptionalCostAttackPrompt } from '../components/modals/optionalCostAttackPrompt'
import { compilePendingDecisionDescriptor } from './decision-descriptor-compiler'

const playerId = 'player-one' as const
const sourceId = 'bs12-026-source'
type State = ReturnType<typeof createBs12BananaRotiDemoState>
const resolveDamage = (before: State) => {
  let state = before
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 20; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return state
}
const attack = (before: State, targetInstanceId = 'bs12-026-opponent') => {
  let state = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId,
    supportPaymentIds: before.players[playerId].supportArea.map(s => s.card.instanceId) })
  expect(state.pendingBattle?.declaredDamage).toBe(3)
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  state = resolveDamage(state)
  if (state.pendingReplacement) state = applyGameCommand(state, { kind: 'skip-replacement', playerId: 'player-two' })
  return applyGameCommand(state, { kind: 'resolve-attack-effect', playerId, targetIds: [] })
}
const pay = (before: State, discardHandIds = ['bs12-026-hand'], targetIds: string[] = []) => applyGameCommand(before, {
  kind: 'resolve-optional-cost-attack', playerId, action: 'pay', discardCardIds: discardHandIds, targetIds, paymentIds: [],
})
const positive: Bs12BananaRotiScenario[] = ['four-arena', 'five-arena', 'mixed-arena', 'turn-event', 'green-event', 'hand-event', 'faint-event', 'removed-event', 'both', 'item-hand', 'blue-hand']
const negative: Bs12BananaRotiScenario[] = ['three-arena', 'high-level', 'non-arena-break', 'opponent-break', 'trash-arena', 'previous-turn', 'non-arena-event', 'opponent-event', 'no-condition']

describe('BS12-026 ordinary three, optional hand cost, OR condition, and fixed original defender', () => {
  it('uses real printed defenders at their printed HP', () => {
    const normal = createBs12BananaRotiDemoState()
    expect(normal.players['player-two'].battleArea.map(entry => [entry.card.id, entry.hpCards.length])).toEqual([
      ['BS6-008', 6],
      ['BS12-001', 4],
    ])
    const faint = createBs12BananaRotiDemoState('target-faints')
    expect(faint.players['player-two'].battleArea.map(entry => [entry.card.id, entry.hpCards.length])).toEqual([
      ['BS12-008', 3],
      ['BS12-001', 4],
    ])
  })
  it('routes only on localhost', () => {
    expect(parseTestStateConfig('?test-state=bs12-026:four-arena', 'localhost')).toEqual({ kind: 'bs12-026', scenario: 'four-arena' })
    expect(parseTestStateConfig('?test-state=bs12-026:four-arena', 'example.com')).toBeNull()
  })
  it('normally deploys printed five HP independently of its LV3', () => {
    const before = createBs12BananaRotiDemoState('deploy')
    const snapshot = structuredClone(before)
    const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: sourceId })
    expect(after.players[playerId].battleArea.at(-1)?.hpCards).toEqual(before.players[playerId].deck.slice(0, 5))
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck.slice(5))
    expect(after.players[playerId].hand.map(c => c.instanceId)).toEqual(['bs12-026-hand'])
    expect(after.pendingOnPlay).toBeNull()
    expect(before).toEqual(snapshot)
  })
  it.each(positive)('ordinary 3 precedes one-hand payment and original-target +1 for %s', scenario => {
    const before = createBs12BananaRotiDemoState(scenario)
    const snapshot = structuredClone(before)
    const opened = attack(before)
    expect(opened.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
    expect(opened.pendingOptionalCostAttack).toMatchObject({ cost: { discardHand: 1 }, payBeforeCondition: true })
    expect(opened.players[playerId].hand).toEqual(before.players[playerId].hand)
    expect(opened.players[playerId].supportArea.every(s => s.rested)).toBe(true)
    const prompt = getOptionalCostAttackPrompt(opened, playerId)
    expect(prompt).toMatchObject({ discardHandCost: 1, energyCostTotal: 0, needsTarget: false, unmetConditionWarning: null })
    const paid = pay(opened)
    expect(paid.players[playerId].hand.map(c => c.instanceId)).not.toContain('bs12-026-hand')
    expect(paid.players[playerId].discardPile.at(-1)?.instanceId).toBe('bs12-026-hand')
    const after = resolveDamage(paid)
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
    expect(after.players['player-two'].battleArea.slice(1)).toEqual(before.players['player-two'].battleArea.slice(1))
    expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
    expect(after.players[playerId].battleArea[0].hpCards).toEqual(before.players[playerId].battleArea[0].hpCards)
    expect(after.pendingBattle).toBeNull()
    expect(before).toEqual(snapshot)
  })
  it.each(negative)('may pay the printed cost but does not deal conditional damage for %s', scenario => {
    const before = createBs12BananaRotiDemoState(scenario)
    const opened = attack(before)
    expect(opened.pendingOptionalCostAttack).toBeTruthy()
    expect(getOptionalCostAttackPrompt(opened, playerId)?.unmetConditionWarning).toMatch(/條件不成立/)
    const after = resolveDamage(pay(opened))
    expect(after.players[playerId].discardPile.at(-1)?.instanceId).toBe('bs12-026-hand')
    expect(after.players[playerId].hand).toHaveLength(before.players[playerId].hand.length - 1)
    expect(after.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
    expect(after.players['player-two'].discardPile).toHaveLength(before.players['player-two'].discardPile.length + 3)
    expect(after.pendingBattle).toBeNull()
  })
  it.each(['four-arena', 'three-arena'] as const)('skipping preserves the hand card and ordinary 3 for %s', scenario => {
    const opened = attack(createBs12BananaRotiDemoState(scenario))
    const after = applyGameCommand(opened, { kind: 'resolve-optional-cost-attack', playerId, action: 'skip' })
    expect(after.players).toEqual(opened.players)
    expect(after.pendingBattle).toBeNull()
  })
  it('cannot pay without a hand card but may skip the optional Then', () => {
    const opened = attack(createBs12BananaRotiDemoState('no-hand'))
    expect(getOptionalCostAttackPrompt(opened, playerId)?.discardHandCandidates).toEqual([])
    expect(() => pay(opened, [])).toThrow()
    expect(applyGameCommand(opened, { kind: 'resolve-optional-cost-attack', playerId, action: 'skip' }).players).toEqual(opened.players)
  })
  it.each([[], ['bs12-026-source'], ['bs12-026-opponent'], ['bs12-026-hand', 'bs12-026-hand']].map(ids => ({ ids })))('rejects incomplete/illegal/duplicate discard $ids', ({ ids }) => {
    const opened = attack(createBs12BananaRotiDemoState())
    const snapshot = structuredClone(opened)
    expect(() => pay(opened, ids)).toThrow()
    expect(opened).toEqual(snapshot)
  })
  it('does not transfer fixed damage after the original defender faints; paying still discards', () => {
    const before = createBs12BananaRotiDemoState('target-faints')
    const opened = attack(before)
    expect(opened.players['player-two'].battleArea).toEqual([before.players['player-two'].battleArea[1]])
    const after = resolveDamage(pay(opened))
    expect(after.players['player-two'].battleArea).toEqual([before.players['player-two'].battleArea[1]])
    expect(after.players[playerId].discardPile.at(-1)?.instanceId).toBe('bs12-026-hand')
    expect(after.pendingBattle).toBeNull()
  })
  it('another original defender receives both portions when selected for the ordinary attack', () => {
    const before = createBs12BananaRotiDemoState()
    const opened = attack(before, 'bs12-026-opponent-other')
    expect(opened.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([6, 1])
    const after = resolveDamage(pay(opened))
    expect(after.players['player-two'].battleArea).toEqual([before.players['player-two'].battleArea[0]])
  })
  it('cannot redirect the original-defender effect through explicit target IDs', () => {
    const opened = attack(createBs12BananaRotiDemoState())
    const snapshot = structuredClone(opened)
    expect(() => pay(opened, ['bs12-026-hand'], ['bs12-026-opponent-other'])).toThrow(/不能改選/)
    expect(opened).toEqual(snapshot)
  })
  it.each(['wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn'] as const)('blocks ordinary attack for %s', scenario => {
    const before = createBs12BananaRotiDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(() => attack(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([...positive, ...negative, 'no-hand', 'target-faints', 'wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'deploy'] as Bs12BananaRotiScenario[])('has legal field/break/copy capacity %s', scenario => {
    for (const player of Object.values(createBs12BananaRotiDemoState(scenario).players)) {
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      expect(player.breakArea.reduce((sum, c) => sum + c.level, 0)).toBeLessThan(10)
      const cards = [...player.hand, ...player.deck, ...player.breakArea, ...player.discardPile, ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
      const counts = cards.reduce<Record<string, number>>((result, card) => ({ ...result, [card.id]: (result[card.id] ?? 0) + 1 }), {})
      expect(Math.max(0, ...Object.values(counts))).toBeLessThanOrEqual(4)
    }
  })
  it('public cost steps identify the actual discarded card and do not expose hidden HP identities', () => {
    const opened = attack(createBs12BananaRotiDemoState())
    const command = { kind: 'resolve-optional-cost-attack' as const, playerId, action: 'pay' as const, discardCardIds: ['bs12-026-hand'] }
    const after = applyGameCommand(opened, command)
    const steps = describeCommandSteps(opened, after, command) ?? []
    expect(steps.map(s => s.text).join(' ')).toMatch(/棄.*Mint Wafer/)
    expect(steps.map(s => s.text).join(' ')).toMatch(/原受攻擊.*Sugar Swan/)
    expect(steps.map(s => s.text).join(' ')).not.toMatch(/沒有符合條件的目標/)
    expect(steps.flatMap(s => s.cards ?? []).some(c => c.instanceId.includes('-hp-'))).toBe(false)
  })
  it.each(['four-arena', 'three-arena', 'target-faints'] as const)('shared descriptor does not invent a new target choice for %s', scenario => {
    const opened = attack(createBs12BananaRotiDemoState(scenario))
    const descriptor = compilePendingDecisionDescriptor(opened)
    expect(descriptor?.steps.filter(step => step.kind === 'target')).toEqual([])
  })
})
