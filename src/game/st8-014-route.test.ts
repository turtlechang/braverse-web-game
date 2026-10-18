import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { createSt8014PreviewState, rawSt8014 } from './st8-014-demo'

describe('ST8-014 candidate Browser routes', () => {
  it('routes standard positive and negative URLs to the physical item fixtures', () => {
    expect(parseTestStateConfig('?test-state=card:ST8-014', 'localhost'))
      .toEqual({ kind: 'card-check', cardNumber: 'ST8-014' })
    expect(parseTestStateConfig('?test-state=card-negative:ST8-014', 'localhost'))
      .toEqual({ kind: 'card-negative', cardNumber: 'ST8-014' })
    expect(createCardCheckDemoState('ST8-014'))
      .toEqual(createSt8014PreviewState('positive'))
    expect(createCardNegativeDemoState('ST8-014'))
      .toEqual(createSt8014PreviewState('support-below-threshold'))
  })

  it('shows the original candidate card art and five-card positive threshold', () => {
    const state = createCardCheckDemoState('ST8-014')
    const item = state.players['player-one'].hand[0]
    expect(item && [item.id, item.name, item.type, item.imageUrl])
      .toEqual(['ST8-014', 'Cape of the Vanquisher', 'item', rawSt8014.imageUrl])
    expect(state.players['player-one'].supportArea).toHaveLength(5)
    expect(state.players['player-one'].supportArea.some(support =>
      !support.rested && support.card.energyColor === 'green',
    )).toBe(true)
  })

  it('keeps a legal green payment but drops the support area below the threshold in the negative route', () => {
    const state = createCardNegativeDemoState('ST8-014')
    expect(state.players['player-one'].hand[0]?.id).toBe('ST8-014')
    expect(state.players['player-one'].supportArea).toHaveLength(4)
    expect(state.players['player-one'].supportArea.some(support =>
      !support.rested && support.card.energyColor === 'green',
    )).toBe(true)
  })
})
