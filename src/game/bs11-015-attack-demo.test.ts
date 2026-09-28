import { describe, expect, it } from 'vitest'
import { createBs11015AttackDemoState, parseTestStateConfig } from './demo'

describe('BS11-015 attack Browser fixtures', () => {
  it.each(['BS11-015', 'BS11-015@1'] as const)('%s separates a faint, survival, and underpayment', (cardNumber) => {
    for (const scenario of ['faint', 'no-faint', 'underpay'] as const) {
      expect(parseTestStateConfig(`?test-state=bs11-015-attack:${cardNumber}:${scenario}`, 'localhost'))
        .toEqual({ kind: 'bs11-015-attack', cardNumber, scenario })
      const state = createBs11015AttackDemoState(cardNumber, scenario)
      expect(state.players['player-one'].supportArea).toHaveLength(scenario === 'underpay' ? 3 : 4)
      expect(state.players['player-two'].battleArea[0]?.hpCards).toHaveLength(scenario === 'no-faint' ? 5 : 4)
    }
  })
})
