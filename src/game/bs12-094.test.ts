import { expect, it } from 'vitest'
import { BS12_BUTTER_ROLL_SCENARIOS, createBs12ButterRollDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { hasPendingCardResolution } from './pending'

const playerId = 'player-one' as const
const sourceId = 'bs12-094-source'
const targetId = 'bs12-094-opponent'
type State = ReturnType<typeof createBs12ButterRollDemoState>
const ids = ['bs12-094-payment-0', 'bs12-094-payment-1', 'bs12-094-payment-2']
const declare = (state: State, supportPaymentIds = ids, targetInstanceId = targetId) => applyGameCommand(state,
  { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId, supportPaymentIds })
const damage = (before: State, target = targetId) => {
  let state = applyGameCommand(declare(before, ids, target), { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 10; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return state
}

it('094 normal entry uses four actual top-deck HP and does not invent On Play', () => {
  const before = createBs12ButterRollDemoState('deploy')
  const snapshot = structuredClone(before)
  const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: sourceId })
  expect(after.players[playerId].battleArea[1].hpCards).toEqual(before.players[playerId].deck.slice(0, 4))
  expect(after.players[playerId].deck).toHaveLength(8)
  expect(after.players[playerId].hand).toEqual([])
  expect(after.pendingOnPlay).toBeNull()
  expect(hasPendingCardResolution(after)).toBe(false)
  expect(before).toEqual(snapshot)
})

it.each(['attack', 'red-energy', 'blue-energy', 'yellow-energy', 'green-energy', 'purple-energy', 'black-energy', 'spare-energy'] as const)('094 pays three actual supports and deals ordinary four without Then: %s', scenario => {
  const before = createBs12ButterRollDemoState(scenario)
  const snapshot = structuredClone(before)
  const after = damage(before)
  expect(before.players[playerId].battleArea[0].card).toMatchObject({ level: 3, hp: 4, attack: 4, attackEnergyCost: { neutral: 3 } })
  expect(after.players[playerId].supportArea.map(s => s.rested)).toEqual(scenario === 'spare-energy' ? [true, true, true, false] : [true, true, true])
  expect(after.players[playerId].battleArea[0]).toMatchObject({ rested: true, hpCards: before.players[playerId].battleArea[0].hpCards })
  expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([1, 4])
  expect(after.players['player-two'].discardPile).toEqual([...before.players['player-two'].battleArea[0].hpCards].reverse().slice(0, 4))
  expect(after.players['player-two'].battleArea[1]).toEqual(before.players['player-two'].battleArea[1])
  expect(after.players[playerId].deck).toEqual(before.players[playerId].deck)
  expect(after.players[playerId].hand).toEqual([])
  expect(after.players[playerId].discardPile).toEqual([])
  expect(after.pendingBattle).toBeNull()
  expect(after.pendingOptionalCostAttack).toBeUndefined()
  expect(hasPendingCardResolution(after)).toBe(false)
  expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
  expect(before).toEqual(snapshot)
})

it.each(['few-energy', 'no-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main'] as const)('094 rejects illegal resources or timing atomically: %s', scenario => {
  const before = createBs12ButterRollDemoState(scenario)
  const snapshot = structuredClone(before)
  expect(() => declare(before)).toThrow()
  expect(before).toEqual(snapshot)
})

it('094 rejects underpayment, repeated ids, an unknown support and an unknown opponent', () => {
  const before = createBs12ButterRollDemoState()
  const snapshot = structuredClone(before)
  for (const payment of [[], ids.slice(0, 2), [ids[0], ids[0], ids[1]], [ids[0], ids[1], 'unknown']]) expect(() => declare(before, payment)).toThrow()
  expect(() => declare(before, ids, 'unknown')).toThrow()
  expect(before).toEqual(snapshot)
})

it.each([{ scenario: 'target-faints' as const, target: targetId, level: 3 }, { scenario: 'attack' as const, target: 'bs12-094-opponent-other', level: 3 }])('094 faints only the chosen Cookie: $target', ({ scenario, target, level }) => {
  const before = createBs12ButterRollDemoState(scenario)
  const original = before.players['player-two'].battleArea.find(c => c.card.instanceId === target)!
  const after = damage(before, target)
  expect(after.players['player-two'].battleArea).toEqual(before.players['player-two'].battleArea.filter(c => c.card.instanceId !== target))
  expect(after.players['player-two'].breakArea).toEqual([original.card])
  expect(after.players['player-two'].breakArea[0].type === 'cookie' && after.players['player-two'].breakArea[0].level).toBe(level)
  expect(after.players['player-two'].discardPile).toEqual([...original.hpCards].reverse())
  expect(after.pendingBattle).toBeNull()
  expect(after.pendingOptionalCostAttack).toBeUndefined()
})

it('094 local route accepts only its declared scenarios and never a remote hostname', () => {
  expect(parseTestStateConfig('?test-state=bs12-094:attack', 'localhost')).toEqual({ kind: 'bs12-094', scenario: 'attack' })
  expect(parseTestStateConfig('?test-state=bs12-094:invalid', 'localhost')).toBeNull()
  expect(parseTestStateConfig('?test-state=bs12-094:attack', 'example.com')).toBeNull()
})

it.each([true, false])('094 ordinary fourth damage reveals the last HP FLIP before faint: activate=%s', activate => {
  const before = createBs12ButterRollDemoState('target-flip')
  const revealed = damage(before)
  expect(revealed.pendingBattle?.stage).toBe('flip')
  expect(revealed.players['player-two'].battleArea[0].hpCards).toHaveLength(0)
  expect(revealed.players['player-two'].breakArea).toEqual([])
  const after = applyGameCommand(revealed, { kind: 'resolve-flip', playerId: 'player-two', activate,
    targetIds: activate ? [targetId] : [], discardHandIds: activate ? ['bs12-094-flip-hand-cost'] : [] })
  if (activate) {
    expect(after.players['player-two'].battleArea[0].hpCards).toEqual(before.players['player-two'].deck.slice(0, 1))
    expect(after.players['player-two'].deck).toHaveLength(11)
    expect(after.players['player-two'].hand).toEqual([])
    expect(after.players['player-two'].breakArea).toEqual([])
  } else {
    expect(after.players['player-two'].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-094-opponent-other'])
    expect(after.players['player-two'].breakArea.map(c => c.instanceId)).toEqual([targetId])
    expect(after.players['player-two'].hand).toEqual(before.players['player-two'].hand)
    expect(after.players['player-two'].deck).toEqual(before.players['player-two'].deck)
  }
  expect(after.pendingBattle).toBeNull()
  expect(after.pendingOptionalCostAttack).toBeUndefined()
  expect(after.players[playerId].battleArea[0].hpCards).toEqual(before.players[playerId].battleArea[0].hpCards)
})

it.each(BS12_BUTTER_ROLL_SCENARIOS)('094 fixture keeps distinct actual identities, no fifth copy and at most two battle Cookies: %s', scenario => {
  const state = createBs12ButterRollDemoState(scenario)
  const allIds: string[] = []
  for (const player of Object.values(state.players)) {
    expect(player.battleArea.length).toBeLessThanOrEqual(2)
    const cards = [...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile, ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
    const copies = new Map<string, number>()
    for (const card of cards) copies.set(card.id, (copies.get(card.id) ?? 0) + 1)
    expect([...copies.values()].every(count => count <= 4)).toBe(true)
    allIds.push(...cards.map(c => c.instanceId))
  }
  expect(new Set(allIds).size).toBe(allIds.length)
})
