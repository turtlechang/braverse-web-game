import { describe, expect, it } from 'vitest'
import { createBs12GnomeBandDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import type { GameState } from './types'

const actor = 'player-one' as const
const opponent = 'player-two' as const
const sourceId = 'bs12-075-source'
const begin = (state: GameState, ids = ['bs12-075-cost']) => applyGameCommand(state, {
  kind: 'begin-activate-skill', playerId: actor, sourceInstanceId: sourceId, trigger: 'activate', paymentIds: [], discardHandIds: ids,
})
const resolve = (state: GameState) => applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: actor, targetIds: [] })

describe.each(['BS12-075', 'BS12-075@1'] as const)('%s public paid Activate and receiver selection', number => {
  const create = (scenario?: Parameters<typeof createBs12GnomeBandDemoState>[0]) => createBs12GnomeBandDemoState(scenario, number)
  it('keeps preview restricted to localhost', () => {
    expect(parseTestStateConfig(`?test-state=bs12-075:${number}:positive`, 'localhost')).toEqual({ kind: 'bs12-075', cardNumber: number, scenario: 'positive' })
    expect(parseTestStateConfig(`?test-state=bs12-075:${number}:positive`, 'example.com')).toBeNull()
  })
  it.each(['positive', 'six', 'item-cost', 'non-arena-cost', 'same-name-cost'] as const)('pays any one own hand card and rests only the source before recipient chooses: %s', scenario => {
    const before = create(scenario)
    const copy = structuredClone(before)
    const paid = begin(before)
    expect(paid.players[actor].hand).toEqual([])
    expect(paid.players[actor].discardPile.at(-1)).toEqual(before.players[actor].hand[0])
    expect(paid.players[actor].battleArea[0].rested).toBe(true)
    expect(paid.players[actor].battleArea[0].hpCards).toEqual(before.players[actor].battleArea[0].hpCards)
    expect(paid.players[actor].supportArea).toEqual(before.players[actor].supportArea)
    expect(paid.players[opponent]).toEqual(before.players[opponent])
    const offered = resolve(paid)
    expect(offered.pendingOpponentHandDiscard).toMatchObject({ playerId: opponent, count: 1, sourceInstanceId: sourceId })
    const selected = before.players[opponent].hand[2]
    expect(() => applyGameCommand(offered, { kind: 'resolve-opponent-hand-discard', playerId: actor, cardIds: [selected.instanceId] })).toThrow()
    for (const ids of [[], [selected.instanceId, selected.instanceId], before.players[opponent].hand.slice(0, 2).map(c => c.instanceId), ['foreign-id']]) {
      expect(() => applyGameCommand(offered, { kind: 'resolve-opponent-hand-discard', playerId: opponent, cardIds: ids })).toThrow()
    }
    const after = applyGameCommand(offered, { kind: 'resolve-opponent-hand-discard', playerId: opponent, cardIds: [selected.instanceId] })
    expect(after.players[opponent].hand).toEqual(before.players[opponent].hand.filter(c => c !== selected))
    expect(after.players[opponent].discardPile.at(-1)).toEqual(selected)
    expect(after.players[actor]).toEqual(paid.players[actor])
    expect(after.pendingOpponentHandDiscard).toBeNull()
    expect(before).toEqual(copy)
  })
  it('checks the trailing five-hand condition after the printed costs, retaining a legal no-op at four', () => {
    const before = create('four')
    expect(canActivateCookieSkill(before, actor, sourceId, 'activate')).toBe(true)
    const paid = begin(before)
    expect(paid.players[actor].hand).toEqual([])
    expect(paid.players[actor].battleArea[0].rested).toBe(true)
    expect(paid.players[actor].discardPile.at(-1)).toEqual(before.players[actor].hand[0])
    const after = paid.pendingAbilityEffect ? resolve(paid) : paid
    expect(after.players[opponent]).toEqual(before.players[opponent])
    expect(after.pendingOpponentHandDiscard).toBeFalsy()
  })
  it.each(['source-rested', 'no-hand', 'opponent-turn', 'outside-main'] as const)('blocks declaration before paying a cost: %s', scenario => {
    const before = create(scenario)
    const copy = structuredClone(before)
    expect(canActivateCookieSkill(before, actor, sourceId, 'activate')).toBe(false)
    expect(() => begin(before)).toThrow()
    expect(before).toEqual(copy)
  })
  it.each([[], ['wrong-id'], ['bs12-075-cost', 'bs12-075-cost'], ['bs12-075-source'], ['bs12-075-receiver-hand-0'], ['bs12-075-support-0']].map(ids => [ids]))('rejects a forged hand cost %j', ids => {
    const before = create()
    expect(() => begin(before, ids)).toThrow()
  })
  it('has no unprinted per-turn limit after being made active again', () => {
    const before = create('repeat')
    const offered = resolve(begin(before))
    const after = applyGameCommand(offered, { kind: 'resolve-opponent-hand-discard', playerId: opponent, cardIds: [offered.players[opponent].hand[0].instanceId] })
    const ready = applyGameCommand(after, { kind: 'activate-skill', playerId: actor, sourceInstanceId: 'bs12-075-ready-source', trigger: 'activate', paymentIds: [], effectTargets: [[sourceId], []] })
    expect(canActivateCookieSkill(ready, actor, sourceId, 'activate')).toBe(true)
    const repeated = resolve(begin(ready, ['bs12-075-second-cost']))
    expect(repeated.pendingOpponentHandDiscard).toMatchObject({ count: 1 })
    expect(repeated.players[opponent].hand).toHaveLength(5)
  })
  it('enters from hand with exactly three ordinary HP and no On Play', () => {
    const before = create('deploy')
    const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId: actor, instanceId: sourceId })
    expect(after.players[actor].battleArea[0].hpCards).toEqual(before.players[actor].deck.slice(0, 3))
    expect(after.players[actor].deck).toEqual(before.players[actor].deck.slice(3))
    expect(after.pendingOnPlay).toBeNull()
  })
  it('receiver fixture is established by public skill commands', () => {
    const state = create('receiver')
    expect(state.pendingOpponentHandDiscard).toMatchObject({ playerId: actor, count: 1 })
    expect(state.players[opponent].battleArea[0].rested).toBe(true)
    expect(state.players[opponent].hand).toEqual([])
  })
  it('pays PP from two real supports and deals two ordinary damage without Then or hand cost', () => {
    const before = create('attack')
    let after = applyGameCommand(before, { kind: 'declare-attack', playerId: actor, attackerInstanceId: sourceId, targetInstanceId: 'bs12-064-opponent', supportPaymentIds: before.players[actor].supportArea.map(s => s.card.instanceId) })
    after = applyGameCommand(after, { kind: 'skip-trap', playerId: opponent })
    for (let i = 0; after.pendingBattle?.stage === 'damage' && i < 8; i++) after = applyGameCommand(after, { kind: 'resolve-next-damage', playerId: opponent })
    expect(after.players[opponent].battleArea.map(c => c.hpCards.length)).toEqual([4, 4])
    expect(after.players[actor].battleArea[0].rested).toBe(true)
    expect(after.players[actor].supportArea.every(s => s.rested)).toBe(true)
    expect(after.players[actor].hand).toEqual(before.players[actor].hand)
    expect(after.players[actor].discardPile).toEqual(before.players[actor].discardPile)
    expect(after.pendingBattle).toBeNull()
    expect(after.pendingOpponentHandDiscard).toBeFalsy()
  })
  it.each(['attack-one-energy', 'attack-wrong-energy', 'attack-rested-energy', 'attack-source-rested', 'attack-opponent-turn', 'attack-outside-main'] as const)('rejects an illegal ordinary attack: %s', scenario => {
    const state = create(scenario)
    expect(() => applyGameCommand(state, { kind: 'declare-attack', playerId: actor, attackerInstanceId: sourceId, targetInstanceId: 'bs12-064-opponent', supportPaymentIds: state.players[actor].supportArea.map(s => s.card.instanceId) })).toThrow()
  })
  it.each(['positive', 'deploy', 'four', 'six', 'repeat', 'source-rested', 'no-hand', 'opponent-turn', 'outside-main', 'item-cost', 'non-arena-cost', 'same-name-cost', 'receiver', 'attack', 'attack-one-energy', 'attack-wrong-energy', 'attack-rested-energy', 'attack-source-rested', 'attack-opponent-turn', 'attack-outside-main', 'attack-flip', 'attack-target-faints'] as const)('keeps at most two battle Cookies and unique physical identities: %s', scenario => {
    const state = create(scenario)
    const ids = Object.values(state.players).flatMap(p => {
      expect(p.battleArea.length).toBeLessThanOrEqual(2)
      return [...p.hand, ...p.deck, ...p.discardPile, ...p.breakArea, ...p.supportArea.map(s => s.card), ...p.battleArea.flatMap(c => [c.card, ...c.hpCards])].map(c => c.instanceId)
    })
    expect(new Set(ids).size).toBe(ids.length)
  })
})
