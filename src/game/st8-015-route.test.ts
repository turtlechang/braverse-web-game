import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { createSt8015PreviewState, rawSt8015 } from './st8-015-demo'

describe('ST8-015 candidate Browser routes', () => {
  it('routes card and negative URLs to the original physical-item fixtures', () => {
    expect(parseTestStateConfig('?test-state=card:ST8-015', 'localhost'))
      .toEqual({ kind: 'card-check', cardNumber: 'ST8-015' })
    expect(parseTestStateConfig('?test-state=card-negative:ST8-015', 'localhost'))
      .toEqual({ kind: 'card-negative', cardNumber: 'ST8-015' })
    expect(createCardCheckDemoState('ST8-015')).toEqual(createSt8015PreviewState('positive'))
    expect(createCardNegativeDemoState('ST8-015')).toEqual(createSt8015PreviewState('no-wind'))
  })

  it('shows the candidate art, Wind Archer battle witness and two active green payments', () => {
    const state = createCardCheckDemoState('ST8-015')
    const item = state.players['player-one'].hand[0]
    expect(item && [item.id, item.name, item.type, item.imageUrl])
      .toEqual(['ST8-015', 'Essence of the Tempest', 'item', rawSt8015.imageUrl])
    expect(state.players['player-one'].battleArea.some(cookie => cookie.card.id === 'ST8-005')).toBe(true)
    expect(state.players['player-one'].supportArea.filter(support =>
      !support.rested && support.card.energyColor === 'green',
    )).toHaveLength(2)
  })

  it('keeps the legal GG payment and Then target while only removing the Wind Archer witness', () => {
    const state = createCardNegativeDemoState('ST8-015')
    expect(state.players['player-one'].hand[0]?.id).toBe('ST8-015')
    expect(state.players['player-one'].battleArea.some(cookie => cookie.card.id === 'ST8-005')).toBe(false)
    expect(state.players['player-one'].supportArea.some(support => support.card.id === 'ST8-005')).toBe(false)
    expect(state.players['player-one'].supportArea.filter(support =>
      !support.rested && support.card.energyColor === 'green',
    )).toHaveLength(2)
    expect(state.players['player-one'].supportArea.some(support => support.card.id === 'ST1-016')).toBe(true)
  })
})
