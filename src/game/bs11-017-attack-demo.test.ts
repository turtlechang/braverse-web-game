import { describe, expect, it } from 'vitest'
import { createBs11017AttackDemoState, parseTestStateConfig } from './demo'

describe('BS11-017 attack Browser fixtures', () => {
  it.each(['BS11-017', 'BS11-017@1'] as const)('%s separates HP reduction and other Ancient condition', (cardNumber) => {
    for (const scenario of ['positive', 'negative', 'underpay'] as const) {
      expect(parseTestStateConfig(`?test-state=bs11-017-attack:${cardNumber}:${scenario}`, 'localhost'))
        .toEqual({ kind: 'bs11-017-attack', cardNumber, scenario })
      const state = createBs11017AttackDemoState(cardNumber, scenario)
      const player = state.players['player-one']
      expect(player.battleArea[0]?.hpCards).toHaveLength(scenario === 'negative' ? 4 : 3)
      expect(player.battleArea.some((entry) => entry.card.name === 'Pure Vanilla Cookie')).toBe(scenario !== 'negative')
      expect(player.supportArea).toHaveLength(scenario === 'underpay' ? 1 : scenario === 'positive' ? 2 : 3)
    }
  })
})
