import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { createSt9020PreviewState, rawSt9020 } from './st9-020-demo'

describe('ST9-020 Browser routes', () => {
  it('routes the positive and conditional-negative URLs to original-card main-phase states', () => {
    expect(parseTestStateConfig('?test-state=card:ST9-020', 'localhost'))
      .toEqual({ kind: 'card-check', cardNumber: 'ST9-020' })
    expect(parseTestStateConfig('?test-state=card-negative:ST9-020', 'localhost'))
      .toEqual({ kind: 'card-negative', cardNumber: 'ST9-020' })
    expect(createCardCheckDemoState('ST9-020')).toEqual(createSt9020PreviewState('positive'))
    expect(createCardNegativeDemoState('ST9-020')).toEqual(createSt9020PreviewState('high-hand'))
  })

  it('exposes the original Tearcrown, a legal B payment, and positive/negative hand sizes', () => {
    const positive = createCardCheckDemoState('ST9-020').players['player-one']
    expect(positive.hand[0]).toMatchObject({
      id: 'ST9-020', name: 'Tearcrown', type: 'stage', imageUrl: rawSt9020.imageUrl,
    })
    expect(positive.stage).toBeNull()
    expect(positive.supportArea.filter(support => !support.rested && support.card.energyColor === 'blue'))
      .toHaveLength(1)
    expect(positive.hand).toHaveLength(3)

    const negative = createCardNegativeDemoState('ST9-020').players['player-one']
    expect(negative.hand).toHaveLength(5)
    expect(negative.supportArea.filter(support => !support.rested && support.card.energyColor === 'blue'))
      .toHaveLength(1)
  })
})
