import { describe, expect, it } from 'vitest'
import { createSt6010PreviewState as fixture } from './st6-010-demo'
import { applyGameCommand as apply } from './commands'
import { getBlockerCandidates } from './battle'
import { getLegalTurnCommands } from './legal-actions'
import { parseTestStateConfig } from './demo'
import type { GameState } from './types'

const owner = 'player-one' as const
const scenarios = ['positive', 'negative', 'wrong-color', 'rested-source', 'already-target',
  'no-battle', 'low', 'second-attack', 'attack', 'attack-negative', 'attack-wrong-color', 'wrong-phase'] as const
const block = (state: GameState, paymentIds?: string[]) => apply(state, {
  kind: 'play-blocker', playerId: owner,
  sourceInstanceId: state.players[owner].battleArea[0].card.instanceId,
  paymentIds: paymentIds ?? [state.players[owner].supportArea.find(s => !s.rested && s.card.energyColor === 'red')!.card.instanceId],
})

describe('ST6-010 original-printing Blocker and ordinary attack', () => {
  it.each(scenarios)('preserves original sixty-card zones and routing (%s)', scenario => {
    const state = fixture(scenario)
    expect(parseTestStateConfig(`?test-state=deck-addition:ST6-010:${scenario}`, 'localhost'))
      .toEqual({ kind: 'deck-addition', cardNumber: 'ST6-010', scenario })
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
      expect([...counts.values()].every(count => count <= 4)).toBe(true)
    }
  })
  it.each(['positive', 'rested-source', 'second-attack', 'low'] as const)('%s spends R and redirects one damage to the original HP3 source', scenario => {
    const state = fixture(scenario), before = structuredClone(state)
    const own = state.players[owner], source = own.battleArea[0]
    expect(getBlockerCandidates(state, owner).map(c => c.card.instanceId)).toEqual([source.card.instanceId])
    const redirected = block(state)
    expect(redirected.pendingBattle?.targetInstanceId).toBe(source.card.instanceId)
    const next = apply(redirected, { kind: 'resolve-battle', playerId: 'player-two' })
    expect(next.players[owner].battleArea[0].hpCards).toHaveLength(source.hpCards.length - 1)
    expect(next.players[owner].battleArea[1]).toEqual(own.battleArea[1])
    expect(next.players[owner].battleArea[0].rested).toBe(source.rested)
    expect(next.players[owner].hand).toEqual(own.hand)
    expect(next.players[owner].supportArea.filter(s => !s.rested).length)
      .toBe(own.supportArea.filter(s => !s.rested).length - 1)
    expect(state).toEqual(before)
  })
  it.each(['negative', 'wrong-color', 'already-target', 'no-battle', 'wrong-phase'] as const)(
    'rejects Blocker at %s without moving resources', scenario => {
      const state = fixture(scenario), before = structuredClone(state)
      expect(getBlockerCandidates(state, owner)).toEqual([])
      expect(() => block(state, [state.players[owner].supportArea[0].card.instanceId])).toThrow()
      expect(state).toEqual(before)
    },
  )
  it.each(['empty', 'wrong-color', 'overpay'] as const)('rejects %s payment while the genuine R remains available', scenario => {
    const state = fixture('positive'), before = structuredClone(state), support = state.players[owner].supportArea
    const payment = scenario === 'empty' ? [] : scenario === 'wrong-color' ? [support[2].card.instanceId]
      : [support[0].card.instanceId, support[1].card.instanceId]
    expect(() => block(state, payment)).toThrow()
    expect(state).toEqual(before)
  })
  it('blocks two real attacks with separate R payments, without REST or Once', () => {
    let state = fixture('positive')
    const buddyId = state.players[owner].battleArea[1].card.instanceId
    for (let index = 0; index < 2; index++) {
      if (index) {
        const foe = state.players['player-two']
        state = apply(state, { kind: 'declare-attack', playerId: 'player-two',
          attackerInstanceId: foe.battleArea[1].card.instanceId, targetInstanceId: buddyId,
          supportPaymentIds: [foe.supportArea[1].card.instanceId] })
      }
      expect(getBlockerCandidates(state, owner)).toHaveLength(1)
      state = apply(block(state), { kind: 'resolve-battle', playerId: 'player-two' })
      expect(state.players[owner].battleArea[0].hpCards).toHaveLength(2 - index)
      expect(state.players[owner].battleArea[1].hpCards).toHaveLength(2)
      expect(state.players[owner].battleArea[0].rested).toBe(false)
    }
  })
  it.each(['attack', 'attack-negative', 'attack-wrong-color', 'wrong-phase'] as const)(
    'offers RN ordinary attack only with its own legal timing and energy (%s)', scenario => {
      const state = fixture(scenario), own = state.players[owner]
      const offered = getLegalTurnCommands(state, owner).some(c => c.kind === 'attack' && c.attackerInstanceId === own.battleArea[0].card.instanceId)
      expect(offered).toBe(scenario === 'attack')
      if (scenario === 'attack') {
        const next = apply(state, { kind: 'declare-attack', playerId: owner,
          attackerInstanceId: own.battleArea[0].card.instanceId,
          targetInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
          supportPaymentIds: [own.supportArea[0].card.instanceId, own.supportArea[2].card.instanceId] })
        const settled = apply(apply(next, { kind: 'skip-trap', playerId: 'player-two' }), { kind: 'resolve-battle', playerId: owner })
        expect(settled.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
        expect(settled.players[owner].battleArea[0].hpCards).toHaveLength(3)
        expect(settled.players[owner].battleArea[0].rested).toBe(true)
      }
    },
  )
})
