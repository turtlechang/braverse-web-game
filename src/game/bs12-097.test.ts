import { expect, it } from 'vitest'
import { BS12_JASMINE_SCENARIOS, createBs12JasmineDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { hasPendingCardResolution } from './pending'

const playerId = 'player-one' as const
const sourceId = 'bs12-097-source'
const targetId = 'bs12-097-opponent'
const paymentId = 'bs12-097-payment-0'
type State = ReturnType<typeof createBs12JasmineDemoState>
const declare = (state: State, supportPaymentIds = [paymentId], targetInstanceId = targetId) => applyGameCommand(state,
  { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId, supportPaymentIds })
const damage = (before: State, target = targetId) => {
  let state = applyGameCommand(declare(before, [paymentId], target), { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 10; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return state
}

it('097 normal entry uses exactly two actual top-deck HP and has no On Play or Special Play', () => {
  const before = createBs12JasmineDemoState('deploy')
  const snapshot = structuredClone(before)
  const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: sourceId })
  expect(after.players[playerId].battleArea[1].hpCards).toEqual(before.players[playerId].deck.slice(0, 2))
  expect(after.players[playerId].deck).toHaveLength(10)
  expect(after.players[playerId].hand).toEqual([])
  expect(after.pendingOnPlay).toBeNull()
  expect(hasPendingCardResolution(after)).toBe(false)
  expect(after.players[playerId].battleArea[1].card.skill).toBeUndefined()
  expect(before).toEqual(snapshot)
})

it.each(['attack', 'red-energy', 'blue-energy', 'yellow-energy', 'green-energy', 'purple-energy', 'black-energy', 'spare-energy'] as const)('097 pays one actual support and deals ordinary one without Then: %s', scenario => {
  const before = createBs12JasmineDemoState(scenario)
  const snapshot = structuredClone(before)
  const after = damage(before)
  expect(before.players[playerId].battleArea[0].card).toMatchObject({ level: 1, hp: 2, attack: 1, attackEnergyCost: { neutral: 1 } })
  expect(after.players[playerId].supportArea.map(s => s.rested)).toEqual(scenario === 'spare-energy' ? [true, false] : [true])
  expect(after.players[playerId].battleArea[0]).toMatchObject({ rested: true, hpCards: before.players[playerId].battleArea[0].hpCards })
  expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([1, 4])
  expect(after.players['player-two'].discardPile).toEqual(before.players['player-two'].battleArea[0].hpCards.slice(-1))
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

it.each(['no-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main'] as const)('097 rejects illegal resources or timing atomically: %s', scenario => {
  const before = createBs12JasmineDemoState(scenario)
  const snapshot = structuredClone(before)
  expect(() => declare(before)).toThrow()
  expect(before).toEqual(snapshot)
})

it('097 rejects absent payment, duplicate ids, an unknown support and an unknown opponent', () => {
  const before = createBs12JasmineDemoState()
  const snapshot = structuredClone(before)
  for (const payment of [[], [paymentId, paymentId], ['unknown']]) expect(() => declare(before, payment)).toThrow()
  expect(() => declare(before, [paymentId], 'unknown')).toThrow()
  expect(before).toEqual(snapshot)
})

it('097 chooses the second opponent without damaging the first or inventing a Then target', () => {
  const before = createBs12JasmineDemoState()
  const after = damage(before, 'bs12-097-opponent-other')
  expect(after.players['player-two'].battleArea[0]).toEqual(before.players['player-two'].battleArea[0])
  expect(after.players['player-two'].battleArea[1].hpCards).toEqual(before.players['player-two'].battleArea[1].hpCards.slice(0, 3))
  expect(after.players['player-two'].discardPile).toEqual(before.players['player-two'].battleArea[1].hpCards.slice(-1))
  expect(after.pendingBattle).toBeNull()
  expect(after.pendingOptionalCostAttack).toBeUndefined()
})

it('097 ordinary one faints exactly the chosen one-HP Cookie', () => {
  const before = createBs12JasmineDemoState('target-faints')
  const after = damage(before)
  expect(after.players['player-two'].battleArea).toEqual(before.players['player-two'].battleArea.slice(1))
  expect(after.players['player-two'].breakArea).toEqual([before.players['player-two'].battleArea[0].card])
  expect(after.players['player-two'].discardPile).toEqual(before.players['player-two'].battleArea[0].hpCards)
  expect(after.pendingBattle).toBeNull()
  expect(after.pendingOptionalCostAttack).toBeUndefined()
  expect(before.players['player-two'].battleArea).toHaveLength(2)
})

it('097 local route accepts only its finite scenarios and never a remote hostname', () => {
  expect(parseTestStateConfig('?test-state=bs12-097:attack', 'localhost')).toEqual({ kind: 'bs12-097', scenario: 'attack' })
  expect(parseTestStateConfig('?test-state=bs12-097:invalid', 'localhost')).toBeNull()
  expect(parseTestStateConfig('?test-state=bs12-097:attack', 'example.com')).toBeNull()
})

it.each([true, false])('097 last ordinary damage reveals the real HP FLIP before faint: activate=%s', activate => {
  const before = createBs12JasmineDemoState('target-flip')
  const revealed = damage(before)
  expect(revealed.pendingBattle?.stage).toBe('flip')
  expect(revealed.players['player-two'].battleArea[0].hpCards).toHaveLength(0)
  expect(revealed.players['player-two'].breakArea).toEqual([])
  const after = applyGameCommand(revealed, { kind: 'resolve-flip', playerId: 'player-two', activate,
    targetIds: activate ? [targetId] : [], discardHandIds: activate ? ['bs12-097-flip-hand-cost'] : [] })
  if (activate) {
    expect(after.players['player-two'].battleArea[0].hpCards).toEqual(before.players['player-two'].deck.slice(0, 1))
    expect(after.players['player-two'].deck).toHaveLength(11)
    expect(after.players['player-two'].hand).toEqual([])
    expect(after.players['player-two'].breakArea).toEqual([])
    // Pay the hand cost while the revealed FLIP is pending; discard that FLIP after its effect.
    expect(after.players['player-two'].discardPile).toEqual([before.players['player-two'].hand[0], before.players['player-two'].battleArea[0].hpCards[0]])
  } else {
    expect(after.players['player-two'].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-097-opponent-other'])
    expect(after.players['player-two'].breakArea.map(c => c.instanceId)).toEqual([targetId])
    expect(after.players['player-two'].hand).toEqual(before.players['player-two'].hand)
    expect(after.players['player-two'].deck).toEqual(before.players['player-two'].deck)
  }
  expect(after.pendingBattle).toBeNull()
  expect(after.pendingOptionalCostAttack).toBeUndefined()
  expect(after.players[playerId].battleArea[0].hpCards).toEqual(before.players[playerId].battleArea[0].hpCards)
})

it.each(BS12_JASMINE_SCENARIOS)('097 fixture keeps actual unique identities, no fifth copy and at most two battle Cookies: %s', scenario => {
  const state = createBs12JasmineDemoState(scenario)
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
