import { describe, expect, it } from 'vitest'
import { createSt6008PreviewState as fixture } from './st6-008-demo'
import { applyGameCommand as apply } from './commands'
import { getLegalTurnCommands } from './legal-actions'
import { parseTestStateConfig } from './demo'

describe('ST6-008 original card rules through actual damage and FLIP commands', () => {
  it.each(['positive', 'low', 'attack', 'attack-negative', 'wrong-color', 'wrong-phase', 'one-card'] as const)(
    'uses legal original sixty-card zones (%s)', scenario => {
      const state = fixture(scenario)
      expect(parseTestStateConfig(`?test-state=deck-addition:ST6-008:${scenario}`, 'localhost'))
        .toEqual({ kind: 'deck-addition', cardNumber: 'ST6-008', scenario })
      for (const player of Object.values(state.players)) {
        const revealed = state.pendingBattle?.defenderPlayerId === player.id ? state.pendingBattle.revealedHpCard : null
        const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea,
          ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards]), ...(revealed ? [revealed] : [])]
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
  it.each(['positive', 'low'] as const)('draws the actual top card or zero after %s HP reveal', scenario => {
    const state = fixture(scenario), before = structuredClone(state)
    const revealed = state.pendingBattle?.revealedHpCard
    expect(revealed).toMatchObject({ id: 'ST6-008', level: 2, hp: 3, attack: 3 })
    for (const drawCount of [0, 1]) {
      const opened = apply(state, { kind: 'resolve-flip', playerId: 'player-one', activate: true })
      expect(opened.pendingDrawUpTo?.max).toBe(1)
      const after = apply(opened, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount })
      expect(after.players['player-one'].hand.map(c => c.instanceId))
        .toEqual(state.players['player-one'].deck.slice(0, drawCount).map(c => c.instanceId))
      expect(after.players['player-one'].deck.length).toBe(state.players['player-one'].deck.length - drawCount)
      expect(after.players['player-one'].discardPile.some(c => c.instanceId === revealed?.instanceId)).toBe(true)
      expect(after.players['player-one'].battleArea.map(c => c.card.id))
        .toEqual(scenario === 'low' ? ['ST1-011'] : ['ST1-005', 'ST1-011'])
      expect(after.players['player-one'].supportArea).toEqual([])
    }
    expect(state).toEqual(before)
  })
  it.each(['positive', 'low'] as const)('declining %s FLIP leaves the original revealed card discarded', scenario => {
    const state = fixture(scenario)
    const after = apply(state, { kind: 'resolve-flip', playerId: 'player-one', activate: false })
    expect(after.players['player-one'].hand).toEqual([])
    expect(after.pendingDrawUpTo).toBeUndefined()
    expect(after.players['player-one'].discardPile.map(c => c.instanceId))
      .toContain(state.pendingBattle?.revealedHpCard?.instanceId)
  })
  it('rejects the wrong player and out-of-range draw counts immutably', () => {
    const state = fixture('positive'), before = structuredClone(state)
    expect(() => apply(state, { kind: 'resolve-flip', playerId: 'player-two', activate: true })).toThrow()
    const opened = apply(state, { kind: 'resolve-flip', playerId: 'player-one', activate: true })
    const openedBefore = structuredClone(opened)
    for (const drawCount of [-1, 2]) {
      expect(() => apply(opened, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount })).toThrow()
      expect(opened).toEqual(openedBefore)
    }
    expect(() => apply(opened, { kind: 'resolve-draw-up-to', playerId: 'player-two', drawCount: 1 })).toThrow()
    expect(state).toEqual(before)
  })
  it('drawing the last deck card pauses for mandatory Refresh and does not draw a second card', () => {
    const state = fixture('one-card'), player = state.players['player-one']
    const top = player.deck[0], before = structuredClone(state)
    const opened = apply(state, { kind: 'resolve-flip', playerId: 'player-one', activate: true })
    const drawn = apply(opened, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount: 1 })
    expect(drawn.players['player-one'].hand.map(c => c.instanceId)).toEqual([top.instanceId])
    expect(drawn.players['player-one'].deck).toEqual([])
    expect(drawn.pendingRefresh).toMatchObject({ playerId: 'player-one', remainingDraws: 0 })
    const cost = drawn.players['player-one'].discardPile.find(c => c.type === 'cookie')
    if (!cost) throw new Error('Original Cookie needed for actual Refresh')
    const refreshed = apply(drawn, { kind: 'refresh-deck', playerId: 'player-one',
      cookieInstanceId: cost.instanceId, shuffleSeed: 2026101108 })
    expect(refreshed.pendingRefresh).toBeNull()
    expect(refreshed.players['player-one'].deck.length).toBeGreaterThan(0)
    expect(refreshed.players['player-one'].hand.map(c => c.instanceId)).toEqual([top.instanceId])
    expect(refreshed.players['player-one'].breakArea.map(c => c.instanceId)).toContain(cost.instanceId)
    expect(state).toEqual(before)
  })
  it('pays three red supports for exactly three ordinary damage with no attack effect', () => {
    const state = fixture('attack'), self = state.players['player-one'], before = structuredClone(state)
    let next = apply(state, { kind: 'declare-attack', playerId: 'player-one',
      attackerInstanceId: self.battleArea[0].card.instanceId,
      targetInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
      supportPaymentIds: self.supportArea.map(s => s.card.instanceId) })
    next = apply(next, { kind: 'skip-trap', playerId: 'player-two' })
    next = apply(next, { kind: 'resolve-battle', playerId: 'player-one' })
    expect(next.players['player-two'].battleArea).toEqual([])
    expect(next.players['player-two'].breakArea.map(c => c.id)).toContain('ST1-005')
    expect(next.players['player-one'].supportArea.every(s => s.rested)).toBe(true)
    expect(next.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
    expect(next.players['player-one'].battleArea[0].rested).toBe(true)
    expect(state).toEqual(before)
  })
  it.each(['attack-negative', 'wrong-color', 'wrong-phase'] as const)('blocks %s', scenario => {
    const state = fixture(scenario)
    expect(getLegalTurnCommands(state, 'player-one').some(c => c.kind === 'attack' &&
      c.attackerInstanceId === state.players['player-one'].battleArea[0].card.instanceId)).toBe(false)
  })
})
