import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { createSt8020PreviewState, rawSt8020 } from './st8-020-demo'

describe('ST8-020 candidate Browser routes', () => {
  it('routes the positive and payment-negative URLs to original-card main-phase states', () => {
    expect(parseTestStateConfig('?test-state=card:ST8-020', 'localhost'))
      .toEqual({ kind: 'card-check', cardNumber: 'ST8-020' })
    expect(parseTestStateConfig('?test-state=card-negative:ST8-020', 'localhost'))
      .toEqual({ kind: 'card-negative', cardNumber: 'ST8-020' })
    expect(createCardCheckDemoState('ST8-020')).toEqual(createSt8020PreviewState('positive'))
    expect(createCardNegativeDemoState('ST8-020'))
      .toEqual(createSt8020PreviewState('no-green-payment'))
  })

  it('exposes the actual Stage, G payment, and two rested Support targets', () => {
    const state = createCardCheckDemoState('ST8-020')
    const owner = state.players['player-one']
    expect(owner.hand).toHaveLength(1)
    expect(owner.hand[0]).toMatchObject({
      id: 'ST8-020', name: 'Dark Enchantress Laboratory', type: 'stage', imageUrl: rawSt8020.imageUrl,
    })
    expect(owner.stage).toBeNull()
    expect(owner.supportArea.filter(support => !support.rested && support.card.energyColor === 'green'))
      .toHaveLength(1)
    expect(owner.supportArea.filter(support => support.rested)).toHaveLength(2)
    expect(state.phase).toBe('main')
    expect(state.activePlayerId).toBe('player-one')
  })
})
