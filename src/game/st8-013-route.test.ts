import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { createSt8013PreviewState } from './st8-013-demo'

describe('ST8-013 candidate preview Browser routes', () => {
  it('routes standard positive and negative card URLs to original Windgrass fixtures', () => {
    expect(parseTestStateConfig('?test-state=card:ST8-013', 'localhost'))
      .toEqual({ kind: 'card-check', cardNumber: 'ST8-013' })
    expect(parseTestStateConfig('?test-state=card-negative:ST8-013', 'localhost'))
      .toEqual({ kind: 'card-negative', cardNumber: 'ST8-013' })
    expect(createCardCheckDemoState('ST8-013')).toEqual(createSt8013PreviewState('positive'))
    expect(createCardNegativeDemoState('ST8-013')).toEqual(createSt8013PreviewState('no-wind-archer'))
  })

  it('keeps actual payment and opponent targets while removing only Wind Archer from the negative fixture', () => {
    const state = createCardNegativeDemoState('ST8-013')
    expect(state.players['player-one'].hand.map(card => [card.id, card.type]))
      .toContainEqual(['ST8-013', 'item'])
    expect(state.players['player-one'].supportArea.some(support => !support.rested && support.card.energyColor === 'green'))
      .toBe(true)
    expect(state.players['player-two'].supportArea.length).toBeGreaterThan(0)
    expect(state.players['player-one'].battleArea.some(cookie => cookie.card.name === 'Wind Archer Cookie'))
      .toBe(false)
  })
})
