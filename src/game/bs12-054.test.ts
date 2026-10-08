import { describe, expect, it } from 'vitest'
import { createBs12MintChocoDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { getTrashToSupportCandidates } from './effects/targeting'

const playerId = 'player-one' as const
const sourceId = 'bs12-054-source'
type State = ReturnType<typeof createBs12MintChocoDemoState>
const activate = (state: State, targets = ['bs12-054-trash-0'], cost = ['bs12-054-support-0']) => applyGameCommand(state, {
  kind: 'activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'activate', paymentIds: [], costSupportToTrashIds: cost, effectTargets: [targets],
})

describe.each(['BS12-054', 'BS12-054@1'] as const)('%s support trash then rested Cookie recovery', number => {
  it.each(['positive', 'rested-cost', 'all-rested', 'source-rested'] as const)('pays any support and recovers a higher level Arena Cookie: %s', scenario => {
    const before = createBs12MintChocoDemoState(scenario, number)
    const snapshot = structuredClone(before)
    const after = activate(before)
    expect(after.players[playerId].supportArea).toEqual([...before.players[playerId].supportArea.slice(1), { card: before.players[playerId].discardPile[0], rested: true }])
    expect(after.players[playerId].discardPile).toEqual([...before.players[playerId].discardPile.slice(1), before.players[playerId].supportArea[0].card])
    for (const field of ['hand', 'deck', 'battleArea', 'breakArea'] as const) expect(after.players[playerId][field]).toEqual(before.players[playerId][field])
    expect(after.players['player-two']).toEqual(before.players['player-two'])
    expect(after.pendingOnPlay).toBeNull()
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
    expect(before).toEqual(snapshot)
  })
  it.each([0, 1, 2, 3, 4])('accepts support card type or color at index %s as cost', index => {
    const before = createBs12MintChocoDemoState('positive', number)
    const after = activate(before, ['bs12-054-trash-1'], [`bs12-054-support-${index}`])
    expect(after.players[playerId].supportArea.at(-1)).toEqual({ card: before.players[playerId].discardPile[1], rested: true })
    expect(after.players[playerId].discardPile.at(-1)).toEqual(before.players[playerId].supportArea[index].card)
  })
  it.each([0, 1, 2])('has no color, Arena or level restriction on recovered Cookie %s', index => {
    const before = createBs12MintChocoDemoState('positive', number)
    const after = activate(before, [`bs12-054-trash-${index}`])
    expect(after.players[playerId].supportArea.at(-1)).toEqual({ card: before.players[playerId].discardPile[index], rested: true })
  })
  it.each([0, 1, 2])('can trash and recover the same support Cookie even from empty trash: %s', index => {
    const before = createBs12MintChocoDemoState('empty-trash', number)
    const after = activate(before, [`bs12-054-support-${index}`], [`bs12-054-support-${index}`])
    expect(after.players[playerId].discardPile).toEqual([])
    expect(after.players[playerId].supportArea).toEqual([...before.players[playerId].supportArea.filter((_, i) => i !== index), { card: before.players[playerId].supportArea[index].card, rested: true }])
  })
  it.each(['positive', 'empty-trash', 'item-trash', 'item-only-support'] as const)('selecting zero still pays cost and consumes once per turn: %s', scenario => {
    const before = createBs12MintChocoDemoState(scenario, number)
    const after = activate(before, [])
    expect(after.players[playerId].supportArea).toEqual(before.players[playerId].supportArea.slice(1))
    expect(after.players[playerId].discardPile).toEqual([...before.players[playerId].discardPile, before.players[playerId].supportArea[0].card])
    expect(canActivateCookieSkill(after, playerId, sourceId, 'activate')).toBe(false)
  })
  it('enumerates actual post-cost candidates in begin then resolve', () => {
    const before = createBs12MintChocoDemoState('empty-trash', number)
    const paid = applyGameCommand(before, { kind: 'begin-activate-skill', playerId, sourceInstanceId: sourceId, trigger: 'activate', paymentIds: [], costSupportToTrashIds: ['bs12-054-support-0'] })
    const effect = paid.pendingAbilityEffect!.effects[0]
    if (effect.kind !== 'trash-to-support') throw new Error('Missing recovery')
    expect(getTrashToSupportCandidates(paid, { sourcePlayerId: playerId, sourceInstanceId: sourceId }, effect).map(c => c.instanceId)).toEqual(['bs12-054-support-0'])
    const after = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: ['bs12-054-support-0'] })
    expect(after.players[playerId].supportArea.at(-1)).toMatchObject({ card: { instanceId: 'bs12-054-support-0' }, rested: true })
    expect(after.players[playerId].discardPile).toEqual([])
  })
  it.each(['no-support', 'opponent-turn', 'outside-main', 'used', 'source-support'] as const)('rejects %s without mutation', scenario => {
    const before = createBs12MintChocoDemoState(scenario, number)
    const snapshot = structuredClone(before)
    expect(canActivateCookieSkill(before, playerId, sourceId, 'activate')).toBe(false)
    expect(() => activate(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([[], ['bs12-054-foe-support'], ['bs12-054-trash-0'], ['bs12-054-hand'], ['bs12-054-source'], ['bs12-054-support-0', 'bs12-054-support-1'], ['bs12-054-support-0', 'bs12-054-support-0'], ['unknown']])('rejects invalid cost %j', (...cost) => {
    const before = createBs12MintChocoDemoState('positive', number)
    const snapshot = structuredClone(before)
    expect(() => activate(before, ['bs12-054-trash-0'], cost)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([['bs12-054-trash-item'], ['bs12-054-trash-stage'], ['bs12-054-foe-trash'], ['bs12-054-hand'], ['bs12-054-break'], ['bs12-054-source'], ['bs12-054-support-1'], ['bs12-054-trash-0', 'bs12-054-trash-1'], ['bs12-054-trash-0', 'bs12-054-trash-0']])('rejects invalid recovery %j', (...targets) => {
    const before = createBs12MintChocoDemoState('positive', number)
    const snapshot = structuredClone(before)
    expect(() => activate(before, targets)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it.each([3, 4])('cannot recover paid non-Cookie support %s', index => {
    const before = createBs12MintChocoDemoState('empty-trash', number)
    expect(() => activate(before, [`bs12-054-support-${index}`], [`bs12-054-support-${index}`])).toThrow()
  })
  it('pays GGN ordinary three with real blue neutral and no Then', () => {
    const before = createBs12MintChocoDemoState('attack', number)
    let after = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-054-opponent', supportPaymentIds: ['bs12-054-support-0', 'bs12-054-support-1', 'bs12-054-support-2'] })
    after = applyGameCommand(after, { kind: 'skip-trap', playerId: 'player-two' })
    for (let i = 0; i < 3; i++) after = applyGameCommand(after, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(after.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([3, 3])
    expect(after.players[playerId].supportArea.map(s => s.rested)).toEqual([true, true, true, false, false])
    expect(after.players[playerId].battleArea[0].rested).toBe(true)
    expect(after.pendingBattle).toBeNull()
  })
  it('cannot pay an attack with the freshly recovered rested Cookie', () => {
    const before = createBs12MintChocoDemoState('empty-trash', number)
    const recovered = activate(before, ['bs12-054-support-2'], ['bs12-054-support-2'])
    expect(() => applyGameCommand(recovered, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-054-opponent', supportPaymentIds: ['bs12-054-support-0', 'bs12-054-support-1', 'bs12-054-support-2'] })).toThrow()
  })
  it.each(['attack-few', 'attack-wrong', 'attack-rested-energy', 'attack-rested-source'] as const)('rejects invalid attack %s', scenario => {
    const before = createBs12MintChocoDemoState(scenario, number)
    expect(() => applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId, targetInstanceId: 'bs12-054-opponent', supportPaymentIds: before.players[playerId].supportArea.slice(0, 3).map(s => s.card.instanceId) })).toThrow()
  })
  it('deploys printed four HP without an On Play skill', () => {
    const before = createBs12MintChocoDemoState('deploy', number)
    const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: sourceId })
    expect(after.players[playerId].battleArea.map(c => c.hpCards.length)).toEqual([2, 4])
    expect(after.players[playerId].deck).toHaveLength(8)
    expect(after.pendingOnPlay).toBeNull()
  })
  it('only enables the local candidate route', () => {
    const query = `?test-state=bs12-054:${number}:empty-trash`
    expect(parseTestStateConfig(query, 'localhost')).toEqual({ kind: 'bs12-054', cardNumber: number, scenario: 'empty-trash' })
    expect(parseTestStateConfig(query, 'example.com')).toBeNull()
  })
})
