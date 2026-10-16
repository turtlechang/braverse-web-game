import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { createSt8016PreviewState, rawSt8016 } from './st8-016-demo'

describe("ST8-016 candidate Browser routes", () => {
  it('routes card and negative URLs to original physical-card fixtures', () => {
    expect(parseTestStateConfig('?test-state=card:ST8-016', 'localhost'))
      .toEqual({ kind: 'card-check', cardNumber: 'ST8-016' })
    expect(parseTestStateConfig('?test-state=card-negative:ST8-016', 'localhost'))
      .toEqual({ kind: 'card-negative', cardNumber: 'ST8-016' })
    expect(createCardCheckDemoState('ST8-016')).toEqual(createSt8016PreviewState('positive'))
    expect(createCardNegativeDemoState('ST8-016')).toEqual(createSt8016PreviewState('support-below-threshold'))
  })

  it('shows the original Item, Wind Archer battle witness and payable G support among five cards', () => {
    const state = createCardCheckDemoState('ST8-016')
    const own = state.players['player-one']
    const item = own.hand[0]
    expect(item && [item.id, item.name, item.type, item.imageUrl])
      .toEqual(['ST8-016', "Wind's Grace Earrings", 'item', rawSt8016.imageUrl])
    expect(own.battleArea.some(cookie => cookie.card.id === 'ST8-005')).toBe(true)
    expect(own.supportArea).toHaveLength(5)
    expect(own.supportArea.find(support => support.card.id === 'ST3-019' && !support.rested)?.card.energyColor)
      .toBe('green')
  })

  it('keeps the legal G payment and Wind Archer while negative route removes only the fifth support', () => {
    const state = createCardNegativeDemoState('ST8-016')
    const own = state.players['player-one']
    expect(own.hand[0]?.id).toBe('ST8-016')
    expect(own.battleArea.some(cookie => cookie.card.id === 'ST8-005')).toBe(true)
    expect(own.supportArea).toHaveLength(4)
    expect(own.supportArea.some(support => !support.rested && support.card.id === 'ST3-019')).toBe(true)
  })
})
