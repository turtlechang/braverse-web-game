import { describe, expect, it } from 'vitest'
import {
  createCardCheckDemoState,
  createCardNegativeDemoState,
  parseTestStateConfig,
} from './demo'
import {
  createSt10009BothPlayersDepartureState,
  createSt10009FaintState,
  createSt10009ItemCostState,
} from './st10-009-demo'
import { st10006Zones } from './st10-006-demo'

describe('ST10-009 local card-check routes', () => {
  it('opens the original Space Doughnut direct-trash effect on its owner turn', () => {
    const state = createCardCheckDemoState('ST10-009')
    expect(state.activePlayerId).toBe('player-one')
    expect(state.players['player-one'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-009'])
    expect(state.players['player-one'].battleArea[0]?.hpCards).toHaveLength(1)
    expect(state.players['player-one'].hand.map(card => card.id)).toEqual(['BS2-055'])
    expect(state.players['player-one'].supportArea.map(support => support.card.id)).toEqual(['BS9-096'])
  })

  it('opens the same real target with the other player active', () => {
    const state = createCardNegativeDemoState('ST10-009')
    expect(state.activePlayerId).toBe('player-two')
    expect(state.players['player-one'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-009'])
    expect(state.players['player-two'].hand.map(card => card.id)).toEqual(['BS2-055'])
    expect(state.players['player-two'].supportArea.map(support => support.card.id)).toEqual(['BS9-096'])
  })

  it('exposes the real Little Star cost route and attack-faint negative route locally', () => {
    expect(parseTestStateConfig('?test-state=st10-009-cost', 'localhost')).toEqual({
      kind: 'st10-009-cost',
    })
    expect(parseTestStateConfig('?test-state=st10-009-faint', 'localhost')).toEqual({
      kind: 'st10-009-faint',
    })
    expect(parseTestStateConfig('?test-state=st10-009-both-departure', 'localhost')).toEqual({
      kind: 'st10-009-both-departure',
      opponentDeck: 'normal',
    })
    expect(parseTestStateConfig('?test-state=st10-009-both-departure-refresh', 'localhost')).toEqual({
      kind: 'st10-009-both-departure',
      opponentDeck: 'last-card',
    })
    const cost = createSt10009ItemCostState()
    expect(cost.players['player-one'].hand.map(card => card.id)).toEqual(['ST10-013'])
    expect(cost.players['player-one'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-009'])
    expect(st10006Zones(cost, 'player-one')).toHaveLength(60)

    const faint = createSt10009FaintState()
    expect(faint.activePlayerId).toBe('player-two')
    expect(faint.players['player-one'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-009'])
    expect(faint.players['player-two'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-005'])

    const both = createSt10009BothPlayersDepartureState()
    expect(both.activePlayerId).toBe('player-one')
    for (const playerId of ['player-one', 'player-two'] as const) {
      expect(both.players[playerId].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-009'])
      expect(both.players[playerId].battleArea[0]?.hpCards).toHaveLength(1)
      expect(st10006Zones(both, playerId)).toHaveLength(60)
      expect(new Set(st10006Zones(both, playerId).map(card => card.instanceId)).size).toBe(60)
    }

    const refresh = createSt10009BothPlayersDepartureState('last-card')
    expect(refresh.players['player-two'].deck).toHaveLength(1)
    expect(st10006Zones(refresh, 'player-two')).toHaveLength(60)
    expect(new Set(st10006Zones(refresh, 'player-two').map(card => card.instanceId)).size).toBe(60)
  })
})
