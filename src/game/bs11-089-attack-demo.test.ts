import { describe, expect, it } from 'vitest'
import { createBs11089AttackDemoState, parseTestStateConfig } from './demo'

describe('BS11-089 attack Browser fixture', () => {
  it.each(['BS11-089', 'BS11-089@1', 'BS11-089@2'] as const)('%s keeps Refresh history separate', (cardNumber) => {
    for (const refreshed of [true, false]) {
      expect(parseTestStateConfig(`?test-state=bs11-089-attack:${cardNumber}:${refreshed ? 'positive' : 'negative'}`, 'localhost'))
        .toEqual({ kind: 'bs11-089-attack', cardNumber, refreshed })
      const state = createBs11089AttackDemoState(cardNumber, refreshed)
      expect(state.refreshedDuringGame?.['player-one']).toBe(refreshed)
      expect(state.players['player-one'].supportArea).toHaveLength(3)
      expect(state.players['player-two'].battleArea).toHaveLength(2)
    }
  })
})
