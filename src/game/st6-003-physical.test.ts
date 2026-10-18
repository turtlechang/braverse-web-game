import { describe, expect, it } from 'vitest'
import { createSt6003State as fixture } from './st6-003-demo'
import { applyGameCommand } from './commands'
import { getLegalTurnCommands } from './legal-actions'
import { parseTestStateConfig } from './demo'

describe('ST6-003 original-printing acceptance', () => {
  it.each(['positive', 'negative', 'wrong-phase', 'used'] as const)(
    '%s retains sixty original cards per side, unique instances and four-copy limits', scenario => {
      const state = fixture(scenario)
      for (const player of Object.values(state.players)) {
        const cards = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea,
          ...player.supportArea.map(s => s.card), ...player.battleArea.flatMap(c => [c.card, ...c.hpCards])]
        expect(cards).toHaveLength(60)
        expect(new Set(cards.map(c => c.instanceId)).size).toBe(60)
        const counts = new Map<string, number>()
        for (const card of cards) {
          counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
          expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//)
        }
        expect([...counts.values()].every(n => n <= 4)).toBe(true)
      }
      expect(state.players['player-one'].battleArea[0].card).toMatchObject({ id: 'ST6-003', hp: 4, level: 2, attack: 3 })
      expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(4)
      expect(parseTestStateConfig(`?test-state=deck-addition:ST6-003:${scenario}`, 'localhost'))
        .toEqual({ kind: 'deck-addition', cardNumber: 'ST6-003', scenario })
    },
  )
  it('pays three different support colors for NNN, deals exactly 3, rests the source and adds no Then', () => {
    const state = fixture('positive'), before = structuredClone(state)
    const own = state.players['player-one'], foe = state.players['player-two']
    expect(own.supportArea.slice(0, 3).map(s => s.card.energyColor)).toEqual(['red', 'yellow', 'green'])
    let next = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one',
      attackerInstanceId: own.battleArea[0].card.instanceId, targetInstanceId: foe.battleArea[0].card.instanceId,
      supportPaymentIds: own.supportArea.slice(0, 3).map(s => s.card.instanceId) })
    next = applyGameCommand(next, { kind: 'skip-trap', playerId: 'player-two' })
    next = applyGameCommand(next, { kind: 'resolve-battle', playerId: 'player-one' })
    expect(state).toEqual(before)
    expect(next.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([1, 3])
    expect(next.players['player-two'].discardPile).toHaveLength(3)
    expect(next.players['player-one'].supportArea.map(s => s.rested)).toEqual([true, true, true, false, false, false])
    expect(next.players['player-one'].battleArea[0].rested).toBe(true)
    expect(next.pendingBattle).toBeNull()
    expect(next.pendingOptionalCostAttack).toBeFalsy()
    expect(next.phase).toBe('main')
  })
  it('blocks insufficient energy while preserving other resources and another legal attacker', () => {
    const state = fixture('negative'), before = structuredClone(state)
    const own = state.players['player-one'], foe = state.players['player-two']
    expect(getLegalTurnCommands(state, 'player-one').filter(c => c.kind === 'attack').map(c => c.attackerInstanceId))
      .not.toContain(own.battleArea[0].card.instanceId)
    expect(getLegalTurnCommands(state, 'player-one').some(c => c.kind === 'attack' && c.attackerInstanceId === own.battleArea[1].card.instanceId)).toBe(true)
    expect(() => applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one',
      attackerInstanceId: own.battleArea[0].card.instanceId, targetInstanceId: foe.battleArea[0].card.instanceId,
      supportPaymentIds: own.supportArea.slice(0, 2).map(s => s.card.instanceId) })).toThrow()
    expect(state).toEqual(before)
  })
  it('blocks the wrong phase despite six active supports and legal targets', () => {
    const state = fixture('wrong-phase')
    expect(state.players['player-one'].supportArea.every(s => !s.rested)).toBe(true)
    expect(state.players['player-two'].battleArea).toHaveLength(2)
    expect(getLegalTurnCommands(state, 'player-one').some(c => c.kind === 'attack')).toBe(false)
  })
  it('blocks a second attack after the real first attack while three supports remain active', () => {
    const state = fixture('used'), own = state.players['player-one']
    expect(own.battleArea[0].rested).toBe(true)
    expect(own.supportArea.filter(s => !s.rested)).toHaveLength(3)
    expect(state.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([1, 3])
    expect(getLegalTurnCommands(state, 'player-one').some(c => c.kind === 'attack' && c.attackerInstanceId === own.battleArea[0].card.instanceId)).toBe(false)
    expect(getLegalTurnCommands(state, 'player-one').some(c => c.kind === 'attack' && c.attackerInstanceId === own.battleArea[1].card.instanceId)).toBe(true)
  })
})
