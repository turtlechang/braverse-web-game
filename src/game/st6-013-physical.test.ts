import { describe, expect, it } from 'vitest'
import { createSt6013PreviewState as fixture } from './st6-013-demo'
import { applyGameCommand as apply } from './commands'
import type { GameState } from './types'
const owner = 'player-one', foe = 'player-two'
const pay = (state: GameState) => apply(state, { kind: 'play-item', playerId: owner,
  instanceId: state.players[owner].hand[0].instanceId,
  paymentIds: [(state.players[owner].supportArea.find(s => !s.rested && s.card.energyColor === 'red') ?? state.players[owner].supportArea[0]).card.instanceId] })
const draw = (state: GameState, count = 1) => apply(pay(state), { kind: 'resolve-draw-up-to', playerId: owner, drawCount: count })
describe('ST6-013 printed physical item and Then', () => {
  it.each(['positive', 'negative', 'zero', 'low', 'wrong-color', 'wrong-phase', 'no-target', 'rested-source', 'one-card'] as const)(
    '%s retains sixty original cards per player with unique IDs and at most four copies', scenario => {
      for (const player of Object.values(fixture(scenario).players)) {
        const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea,
          ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
        expect(cards).toHaveLength(60)
        expect(new Set(cards.map(c => c.instanceId)).size).toBe(60)
        const counts = new Map<string, number>()
        for (const card of cards) {
          expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)
          counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
        }
        expect([...counts.values()].every(n => n <= 4)).toBe(true)
        expect(player.battleArea.length).toBeLessThanOrEqual(2)
      }
    },
  )
  it.each([0, 1])('draws %s before the optional buff with exact payment and card movement', count => {
    const state = fixture('positive'), before = structuredClone(state), own = state.players[owner]
    let next = pay(state)
    expect(next.pendingDrawUpTo).toBeTruthy()
    next = apply(next, { kind: 'resolve-draw-up-to', playerId: owner, drawCount: count })
    expect(next.pendingAbilityEffect).toBeTruthy()
    next = apply(next, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [own.battleArea[0].card.instanceId] })
    expect(next.attackModifiers).toEqual([{ sourceInstanceId: own.hand[0].instanceId,
      targetInstanceId: own.battleArea[0].card.instanceId, amount: 1, expiresAfterTurn: state.turnNumber }])
    expect(next.players[owner].hand).toEqual(count ? [own.deck[0]] : [])
    expect(next.players[owner].deck).toEqual(own.deck.slice(count))
    expect(next.players[owner].discardPile).toEqual([...own.discardPile, own.hand[0]])
    expect(next.players[owner].supportArea[0].rested).toBe(true)
    expect(next.players[foe]).toEqual(state.players[foe])
    expect(state).toEqual(before)
  })
  it.each(['zero', 'no-target'] as const)('%s still pays R without a buff', scenario => {
    const next = apply(draw(fixture(scenario), 0), { kind: 'resolve-ability-effect', playerId: owner, targetIds: [] })
    expect(next.attackModifiers).toEqual([])
    expect(next.players[owner].supportArea[0].rested).toBe(true)
    expect(next.players[owner].hand).toEqual([])
    expect(next.pendingAbilityEffect).toBeUndefined()
  })
  it.each(['negative', 'wrong-color', 'wrong-phase'] as const)('rejects %s immutably', scenario => {
    const state = fixture(scenario), before = structuredClone(state)
    expect(() => pay(state)).toThrow()
    expect(state).toEqual(before)
  })
  it.each(['ST1-005', 'ST6-002'])('rejects original %s above HP2', targetNumber => {
    const state = draw(fixture('positive', targetNumber), 0), before = structuredClone(state)
    expect(state.players[owner].battleArea[1].hpCards.length).toBe(targetNumber === 'ST1-005' ? 3 : 6)
    expect(() => apply(state, { kind: 'resolve-ability-effect', playerId: owner,
      targetIds: [state.players[owner].battleArea[1].card.instanceId] })).toThrow()
    expect(state).toEqual(before)
  })
  it.each(['low', 'rested-source'] as const)('accepts actual %s HP/REST target', scenario => {
    const state = fixture(scenario), index = scenario === 'low' ? 1 : 0
    const target = state.players[owner].battleArea[index]
    expect(target.hpCards.length).toBe(scenario === 'low' ? 1 : 2)
    const next = apply(draw(state, 0), { kind: 'resolve-ability-effect', playerId: owner, targetIds: [target.card.instanceId] })
    expect(next.attackModifiers[0].targetInstanceId).toBe(target.card.instanceId)
    expect(next.players[owner].battleArea[index].rested).toBe(target.rested)
  })
  it('resumes Then after the last card and actual trash-Cookie Refresh', () => {
    const state = fixture('one-card'), own = state.players[owner]
    let next = draw(state)
    expect(next.pendingRefresh).toBeTruthy()
    const cost = own.discardPile.find(c => c.type === 'cookie' && c.level >= 1)
    if (!cost) throw new Error('Missing actual Refresh cost')
    next = apply(next, { kind: 'refresh-deck', playerId: owner, cookieInstanceId: cost.instanceId, shuffleSeed: 6013 })
    expect(next.pendingAbilityEffect).toBeTruthy()
    next = apply(next, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [] })
    expect(next.pendingAbilityEffect).toBeUndefined()
    expect(next.players[owner].hand).toEqual([own.deck[0]])
    expect(next.players[owner].breakArea.map(c => c.instanceId)).toContain(cost.instanceId)
    expect(next.attackModifiers).toEqual([])
  })
})
