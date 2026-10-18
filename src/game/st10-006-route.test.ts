import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { createSt10006CostDepartureState, st10006Zones } from './st10-006-demo'

describe('ST10-006 local card-check routes', () => {
  it('opens the real direct-trash effect on the owner turn', () => {
    const state = createCardCheckDemoState('ST10-006')

    expect(state.activePlayerId).toBe('player-one')
    expect(state.players['player-one'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-006'])
    expect(state.players['player-one'].hand.map(card => card.id)).toEqual(['BS2-055'])
    expect(state.players['player-one'].supportArea.map(support => support.card.id)).toEqual(['BS9-096'])
    expect(state.players['player-two'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-002'])
  })

  it('opens the same physical removal on the opponent turn for the no-trigger branch', () => {
    const state = createCardNegativeDemoState('ST10-006')

    expect(state.activePlayerId).toBe('player-two')
    expect(state.players['player-one'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-006'])
    expect(state.players['player-two'].hand.map(card => card.id)).toEqual(['BS2-055'])
    expect(state.players['player-two'].supportArea.map(support => support.card.id)).toEqual(['BS9-096'])
  })

  it('exposes the real BS4-092 cost path as a local browser test state', () => {
    expect(parseTestStateConfig('?test-state=st10-006-cost', 'localhost')).toEqual({
      kind: 'st10-006-cost',
    })
    const state = createSt10006CostDepartureState()
    expect(state.players['player-one'].hand.map(card => card.id)).toEqual(['BS4-092'])
    expect(state.players['player-one'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-006'])
    expect(state.players['player-one'].supportArea.map(support => support.card.id)).toEqual(['BS9-096'])
    expect(st10006Zones(state, 'player-one')).toHaveLength(60)
  })
})
