import { describe, expect, it } from 'vitest'
import { createSt6012PreviewState as fixture } from './st6-012-demo'
import { applyGameCommand as apply } from './commands'
import { canActivateCookieSkill } from './skills'
import { parseTestStateConfig } from './demo'
import type { GameState } from './types'

const owner = 'player-one', foe = 'player-two'
const activate = (state: GameState, targets = [state.players[owner].battleArea[1].card.instanceId], payment = state.players[owner].supportArea.find(s => !s.rested && s.card.energyColor === 'red')?.card.instanceId) => apply(state, {
  kind: 'activate-skill', playerId: owner, trigger: 'activate',
  sourceInstanceId: state.players[owner].battleArea[0].card.instanceId,
  paymentIds: payment ? [payment] : [], effectTargets: [targets],
})
describe('ST6-012 original named healing through real commands', () => {
  it.each(['positive', 'negative', 'zero', 'low', 'wrong-color', 'wrong-phase', 'used', 'no-target',
    'rested-source', 'rested-target', 'one-card', 'attack', 'attack-negative'] as const)(
    'retains legal sixty-card zones and route (%s)', scenario => {
      const state = fixture(scenario)
      expect(parseTestStateConfig(`?test-state=deck-addition:ST6-012:${scenario}`, 'localhost'))
        .toEqual({ kind: 'deck-addition', cardNumber: 'ST6-012', scenario })
      for (const player of Object.values(state.players)) {
        const cards = [...player.deck, ...player.hand, ...player.breakArea, ...player.discardPile,
          ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
        expect(cards).toHaveLength(60)
        expect(new Set(cards.map(c => c.instanceId)).size).toBe(60)
        expect(player.battleArea.length).toBeLessThanOrEqual(2)
        const counts = new Map<string, number>()
        for (const card of cards) {
          expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)
          counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
        }
        expect([...counts.values()].every(n => n <= 4)).toBe(true)
      }
    },
  )
  it.each(['ST6-002', 'BS4-005', 'BS11-016'])('heals the actual top deck card above printed HP for %s', targetNumber => {
    const state = fixture('positive', targetNumber), before = structuredClone(state), own = state.players[owner]
    const next = activate(state), after = next.players[owner]
    expect(after.battleArea[1].hpCards).toEqual([...own.battleArea[1].hpCards, own.deck[0]])
    expect(after.deck).toEqual(own.deck.slice(1))
    expect(after.battleArea[0]).toEqual(own.battleArea[0])
    expect(after.hand).toEqual(own.hand)
    expect(after.supportArea.filter(s => s.rested)).toHaveLength(1)
    expect(next.players[foe]).toEqual(state.players[foe])
    expect(canActivateCookieSkill(next, owner, own.battleArea[0].card.instanceId, 'activate')).toBe(false)
    expect(state).toEqual(before)
  })
  it.each(['zero', 'no-target'] as const)('%s may select zero but still spends R and Once', scenario => {
    const state = fixture(scenario), next = activate(state, [])
    expect(next.players[owner].battleArea).toEqual(state.players[owner].battleArea)
    expect(next.players[owner].deck).toEqual(state.players[owner].deck)
    expect(next.players[owner].supportArea[0].rested).toBe(true)
    expect(canActivateCookieSkill(next, owner, state.players[owner].battleArea[0].card.instanceId, 'activate')).toBe(false)
  })
  it.each(['rested-source', 'rested-target'] as const)('does not add an unprinted active-only restriction (%s)', scenario => {
    const state = fixture(scenario), next = activate(state)
    if (scenario === 'rested-target') expect(state.players[owner].battleArea[1].hpCards).toHaveLength(6)
    expect(next.players[owner].battleArea[1].hpCards.length).toBe(state.players[owner].battleArea[1].hpCards.length + 1)
    expect(next.players[owner].battleArea.map(c => c.rested)).toEqual(state.players[owner].battleArea.map(c => c.rested))
  })
  it('heals Fire Spirit from one to two after actual Sour Belt four plus Leek one', () => {
    const state = fixture('low')
    expect(state.players[owner].battleArea[1].hpCards).toHaveLength(1)
    const next = activate(state)
    expect(next.players[owner].battleArea[1].hpCards).toHaveLength(2)
  })
  it('adds the last deck card to HP before actual trash-Cookie Refresh', () => {
    const state = fixture('one-card'), own = state.players[owner]
    let next = activate(state)
    expect(next.players[owner].battleArea[1].hpCards).toEqual([...own.battleArea[1].hpCards,own.deck[0]])
    expect(next.players[owner].deck).toEqual([])
    expect(next.pendingRefresh?.playerId).toBe(owner)
    const cost = own.discardPile.find(c=>c.type==='cookie'&&c.level>=1)
    if (!cost) throw new Error('Missing original Refresh cost in trash')
    next = apply(next,{kind:'refresh-deck',playerId:owner,cookieInstanceId:cost.instanceId,shuffleSeed:2026101112})
    expect(next.pendingRefresh).toBeNull()
    expect(next.pendingReplacement).toBeNull()
    expect(next.players[owner].breakArea.map(c=>c.instanceId)).toContain(cost.instanceId)
    expect(next.players[owner].battleArea[0]).toEqual(own.battleArea[0])
    expect(next.players[owner].battleArea[1].hpCards).toHaveLength(7)
    expect(next.players[owner].deck).toHaveLength(own.discardPile.length - 1)
  })
  it.each(['negative', 'wrong-color', 'wrong-phase', 'used'] as const)('blocks %s with resources unchanged', scenario => {
    const state = fixture(scenario), before = structuredClone(state)
    expect(canActivateCookieSkill(state, owner, state.players[owner].battleArea[0].card.instanceId, 'activate')).toBe(false)
    expect(() => activate(state)).toThrow()
    expect(state).toEqual(before)
  })
  it.each(['self', 'opponent', 'two-targets', 'yellow-payment', 'rested-payment'] as const)(
    'rejects independent %s restriction immutably', invalid => {
      const state = fixture(invalid === 'rested-payment' ? 'rested-source' : 'positive'), before = structuredClone(state)
      const own = state.players[owner]
      const targets = invalid === 'self' ? [own.battleArea[0].card.instanceId] : invalid === 'opponent'
        ? [state.players[foe].battleArea[0].card.instanceId] : invalid === 'two-targets'
          ? own.battleArea.map(c => c.card.instanceId) : [own.battleArea[1].card.instanceId]
      const payment = invalid === 'yellow-payment' ? own.supportArea[3].card.instanceId : own.supportArea[0].card.instanceId
      expect(() => activate(state, targets, payment)).toThrow()
      expect(state).toEqual(before)
    },
  )
  it('pays exactly RR for ordinary two without healing or Then', () => {
    const state = fixture('attack'), own = state.players[owner]
    let next = apply(state, {kind:'declare-attack',playerId:owner,attackerInstanceId:own.battleArea[0].card.instanceId,
      targetInstanceId:state.players[foe].battleArea[1].card.instanceId,supportPaymentIds:own.supportArea.slice(0,2).map(s=>s.card.instanceId)})
    next = apply(apply(next,{kind:'skip-trap',playerId:foe}),{kind:'resolve-battle',playerId:owner})
    expect(next.players[foe].battleArea[1].hpCards).toHaveLength(2)
    expect(next.players[owner].battleArea[1]).toEqual(own.battleArea[1])
    expect(next.players[owner].supportArea.filter(s=>s.rested)).toHaveLength(2)
    expect(next.pendingOptionalCostAttack).toBeUndefined()
    expect(next.pendingBattle).toBeNull()
  })
})
