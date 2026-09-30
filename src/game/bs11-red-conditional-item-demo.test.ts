import { describe, expect, it } from 'vitest'
import { createBs11RedConditionalItemDemoState, parseTestStateConfig } from './demo'

describe('BS11 RED conditional Item Browser fixtures', () => {
  it.each(['BS11-009', 'BS11-012'] as const)('%s keeps real payment on both condition routes', (cardNumber) => {
    for (const conditionMet of [true, false]) {
      const route = `bs11-red-conditional-item:${cardNumber}:${conditionMet ? 'positive' : 'negative'}`
      expect(parseTestStateConfig(`?test-state=${route}`, 'localhost'))
        .toEqual({ kind: 'bs11-red-conditional-item', cardNumber, conditionMet })
      const state = createBs11RedConditionalItemDemoState(cardNumber, conditionMet)
      expect(state.players['player-one'].hand.some((card) => card.id === cardNumber)).toBe(true)
      expect(state.players['player-one'].supportArea).toHaveLength(cardNumber === 'BS11-009' ? 3 : 2)
      if (cardNumber === 'BS11-012') {
        expect(state.cookiesFaintedThisTurn?.['player-one']).toBe(conditionMet ? 2 : 1)
      } else {
        const cookies = state.players['player-one'].battleArea
        expect(cookies.some((entry) => entry.card.level >= 2 && entry.hpCards.length === 1)).toBe(conditionMet)
      }
    }
  })
})
