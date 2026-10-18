import { describe, expect, it } from 'vitest'
import { createSt6009PreviewState as fixture } from './st6-009-demo'
import { applyGameCommand as apply } from './commands'
import { canActivateCookieSkill } from './skills'
import { getLegalTurnCommands } from './legal-actions'
import { parseTestStateConfig } from './demo'
import type { GameState } from './types'

const owner = 'player-one' as const
const activate = (state: GameState, targetIds?: string[]) => apply(state, {
  kind: 'activate-skill', playerId: owner, trigger: 'activate',
  sourceInstanceId: state.players[owner].battleArea[0].card.instanceId,
  paymentIds: [state.players[owner].supportArea.find(s => !s.rested)!.card.instanceId],
  discardHandIds: [state.players[owner].hand[0].instanceId],
  effectTargets: [targetIds ?? [state.players['player-two'].battleArea[0].card.instanceId]],
})

describe('ST6-009 original-printing effect and attack paths', () => {
  it.each(['positive', 'negative', 'low', 'zero', 'wrong-color', 'wrong-phase', 'used',
    'no-energy', 'rested-source', 'cost-cookie', 'cost-item', 'attack', 'attack-negative'] as const)(
    'retains sixty original cards and printed-zone limits (%s)', scenario => {
      const state = fixture(scenario)
      expect(parseTestStateConfig(`?test-state=deck-addition:ST6-009:${scenario}`, 'localhost'))
        .toEqual({ kind: 'deck-addition', cardNumber: 'ST6-009', scenario })
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
    },
  )
  it.each(['positive', 'cost-cookie', 'cost-item', 'rested-source'] as const)(
    '%s pays R plus the actual hand card for one damage only to the selected opponent', scenario => {
      const state = fixture(scenario), before = structuredClone(state), self = state.players[owner]
      const target = state.players['player-two'].battleArea[0]
      const next = activate(state), after = next.players[owner]
      expect(next.players['player-two'].battleArea[0].hpCards.length).toBe(target.hpCards.length - 1)
      expect(next.players['player-two'].battleArea.slice(1)).toEqual(state.players['player-two'].battleArea.slice(1))
      expect(after.hand).toEqual([])
      expect(after.discardPile.map(c => c.instanceId)).toContain(self.hand[0].instanceId)
      expect(after.supportArea.filter(s => !s.rested).length).toBe(self.supportArea.filter(s => !s.rested).length - 1)
      expect(after.battleArea[0].hpCards).toHaveLength(5)
      expect(after.battleArea[0].rested).toBe(self.battleArea[0].rested)
      expect(canActivateCookieSkill(next, owner, after.battleArea[0].card.instanceId, 'activate')).toBe(false)
      expect(state).toEqual(before)
    },
  )
  it('zero targets still spends R, the discard and Once, without damaging either opponent', () => {
    const state = fixture('zero'), next = activate(state, [])
    expect(next.players['player-two']).toEqual(state.players['player-two'])
    expect(next.players[owner].hand).toEqual([])
    expect(next.players[owner].supportArea[0].rested).toBe(true)
    expect(canActivateCookieSkill(next, owner, next.players[owner].battleArea[0].card.instanceId, 'activate')).toBe(false)
  })
  it('one effect damage faints the original HP4 Sour Belt after an actual ordinary three attack', () => {
    const state = fixture('low'), target = state.players['player-two'].battleArea[0]
    expect(target.card.id).toBe('BS12-059')
    expect(target.hpCards).toHaveLength(1)
    expect(state.players[owner].battleArea[1].rested).toBe(true)
    const next = activate(state)
    expect(next.players['player-two'].breakArea.map(c => c.instanceId)).toContain(target.card.instanceId)
    expect(next.players['player-two'].battleArea.map(c => c.card.id)).toEqual(['ST1-005'])
  })
  it.each(['negative', 'wrong-color', 'wrong-phase', 'used', 'no-energy'] as const)(
    'blocks activation at the independent %s boundary', scenario => {
      const state = fixture(scenario)
      expect(canActivateCookieSkill(state, owner, state.players[owner].battleArea[0].card.instanceId, 'activate')).toBe(false)
    },
  )
  it('rejects an own Cookie or two opponent targets without spending resources', () => {
    const state = fixture('positive'), before = structuredClone(state)
    expect(() => activate(state, [state.players[owner].battleArea[1].card.instanceId])).toThrow()
    expect(() => activate(state, state.players['player-two'].battleArea.map(c => c.card.instanceId))).toThrow()
    expect(state).toEqual(before)
  })
  it('uses four red supports for ordinary four, independently of Activate', () => {
    const state = fixture('attack'), self = state.players[owner], before = structuredClone(state)
    let next = apply(state, { kind: 'declare-attack', playerId: owner,
      attackerInstanceId: self.battleArea[0].card.instanceId,
      targetInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
      supportPaymentIds: self.supportArea.slice(0, 4).map(s => s.card.instanceId) })
    next = apply(next, { kind: 'skip-trap', playerId: 'player-two' })
    next = apply(next, { kind: 'resolve-battle', playerId: owner })
    next = apply(next, { kind: 'skip-replacement', playerId: 'player-two' })
    expect(next.players['player-two'].battleArea.map(c => c.card.id)).toEqual(['ST1-005'])
    expect(next.players[owner].supportArea.map(s => s.rested)).toEqual([true, true, true, true, false])
    expect(next.players[owner].hand).toEqual(self.hand)
    expect(next.players[owner].battleArea[0].hpCards).toHaveLength(5)
    expect(canActivateCookieSkill(next, owner, self.battleArea[0].card.instanceId, 'activate')).toBe(true)
    expect(state).toEqual(before)
  })
  it.each(['attack-negative', 'wrong-color', 'wrong-phase'] as const)('blocks ordinary attack: %s', scenario => {
    const state = fixture(scenario)
    expect(getLegalTurnCommands(state, owner).some(c => c.kind === 'attack' &&
      c.attackerInstanceId === state.players[owner].battleArea[0].card.instanceId)).toBe(false)
  })
})
