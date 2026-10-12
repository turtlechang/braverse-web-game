import { describe, expect, it } from 'vitest'
import { createSt6011PreviewState as fixture } from './st6-011-demo'
import { applyGameCommand as apply } from './commands'
import { getLegalTurnCommands } from './legal-actions'
import { parseTestStateConfig } from './demo'
import type { GameState } from './types'

const owner = 'player-one', foe = 'player-two'
const attack = (state: GameState, paymentIds: string[], targetInstanceId = state.players[foe].battleArea[0].card.instanceId) => apply(state, {
  kind: 'declare-attack', playerId: owner,
  attackerInstanceId: state.players[owner].battleArea[0].card.instanceId,
  targetInstanceId, supportPaymentIds: paymentIds,
})
const settle = (state: GameState) => {
  let next = apply(apply(state, { kind: 'skip-trap', playerId: foe }), { kind: 'resolve-battle', playerId: owner })
  if (next.pendingReplacement) next = apply(next, { kind: 'skip-replacement', playerId: foe })
  return next
}

describe('ST6-011 original ordinary attack and no-FLIP rules', () => {
  it.each(['positive', 'negative', 'low', 'wrong-phase', 'rested-source', 'reveal'] as const)(
    'has legal sixty-card original zones and route (%s)', scenario => {
      const state = fixture(scenario)
      expect(parseTestStateConfig(`?test-state=deck-addition:ST6-011:${scenario}`, 'localhost'))
        .toEqual({ kind: 'deck-addition', cardNumber: 'ST6-011', scenario })
      for (const player of Object.values(state.players)) {
        const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea,
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
      expect(getLegalTurnCommands(state, owner).some(c => c.kind === 'attack' &&
        c.attackerInstanceId === state.players[owner].battleArea[0].card.instanceId))
        .toBe(scenario === 'positive' || scenario === 'low')
    },
  )
  it.each(['red', 'yellow', 'green', 'blue', 'purple', 'black'] as const)(
    'accepts exactly one active %s support for the neutral cost', color => {
      const state = fixture('positive'), before = structuredClone(state)
      const payment = state.players[owner].supportArea.find(s => s.card.energyColor === color)
      if (!payment) throw new Error('Missing original payment card')
      const next = settle(attack(state, [payment.card.instanceId]))
      expect(next.players[foe].battleArea.map(c => c.hpCards.length)).toEqual([3, 3])
      expect(next.players[owner].battleArea[0].hpCards).toHaveLength(2)
      expect(next.players[owner].battleArea[0].rested).toBe(true)
      expect(next.players[owner].supportArea.filter(s => s.rested).map(s => s.card.instanceId))
        .toEqual([payment.card.instanceId])
      expect(state).toEqual(before)
    },
  )
  it.each(['none', 'overpay', 'own-target', 'rested-payment'] as const)(
    'rejects %s without changing the input', invalid => {
      const state = fixture(invalid === 'rested-payment' ? 'low' : 'positive'), before = structuredClone(state)
      const own = state.players[owner]
      const ids = invalid === 'none' ? [] : invalid === 'overpay'
        ? own.supportArea.slice(0, 2).map(s => s.card.instanceId) : [own.supportArea[0].card.instanceId]
      expect(() => attack(state, ids, invalid === 'own-target' ? own.battleArea[1].card.instanceId : undefined)).toThrow()
      expect(state).toEqual(before)
    },
  )
  it('finishes the parent attack after real ordinary three plus one faints Sour Belt', () => {
    const state = fixture('low'), own = state.players[owner], target = state.players[foe].battleArea[0]
    expect(target.hpCards).toHaveLength(1)
    const payment = own.supportArea.find(s => !s.rested)
    if (!payment) throw new Error('Missing remaining active support')
    const next = settle(attack(state, [payment.card.instanceId]))
    expect(next.players[foe].breakArea.map(c => c.instanceId)).toContain(target.card.instanceId)
    expect(next.pendingBattle).toBeNull()
    expect(next.pendingReplacement).toBeNull()
  })
  it('discards the actual revealed Habanero HP without offering a fictional FLIP', () => {
    const state = fixture('reveal'), before = structuredClone(state)
    const next = apply(apply(state, { kind: 'skip-trap', playerId: owner }), { kind: 'resolve-battle', playerId: foe })
    expect(next.players[owner].battleArea[0].hpCards).toHaveLength(1)
    expect(next.players[owner].discardPile.some(c => c.id === 'ST6-011')).toBe(true)
    expect(next.pendingBattle).toBeNull()
    expect((next.commandLog ?? []).some(entry => entry.commandKind.includes('flip'))).toBe(false)
    expect(state).toEqual(before)
  })
})
