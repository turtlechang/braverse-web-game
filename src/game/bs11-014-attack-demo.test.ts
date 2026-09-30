import { describe, expect, it } from 'vitest'
import { createBs11014AttackDemoState, parseTestStateConfig } from './demo'

describe('BS11-014 attack Browser fixtures', () => {
  it.each(['BS11-014', 'BS11-014@1'] as const)('%s isolates 2R payment and an allied HP target', (cardNumber) => {
    for (const payable of [true, false]) {
      expect(parseTestStateConfig(`?test-state=bs11-014-attack:${cardNumber}:${payable ? 'positive' : 'negative'}`, 'localhost'))
        .toEqual({ kind: 'bs11-014-attack', cardNumber, payable })
      const state = createBs11014AttackDemoState(cardNumber, payable)
      expect(state.players['player-one'].battleArea.some((entry) => entry.card.id === 'BS11-014')).toBe(true)
      expect(state.players['player-one'].battleArea.some((entry) => entry.card.instanceId === 'bs11-014-hp-ally')).toBe(true)
      expect(state.players['player-one'].supportArea).toHaveLength(payable ? 2 : 1)
    }
  })
})
