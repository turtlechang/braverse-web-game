import { describe, expect, it } from 'vitest'
import { createBs11033AttackDemoState, parseTestStateConfig } from './demo'

describe('BS11-033 attack Browser fixtures', () => {
  it.each(['BS11-033', 'BS11-033@1'] as const)('%s keeps the HP-gain boundary', (cardNumber) => {
    for (const gainedHp of [true, false]) {
      expect(parseTestStateConfig(`?test-state=bs11-033-attack:${cardNumber}:${gainedHp ? 'positive' : 'negative'}`, 'localhost'))
        .toEqual({ kind: 'bs11-033-attack', cardNumber, gainedHp })
      const state = createBs11033AttackDemoState(cardNumber, gainedHp)
      const player = state.players['player-one']
      expect(player.battleArea.some((entry) => entry.card.id === 'BS11-033')).toBe(true)
      expect(player.supportArea[0]?.card.energyColor).toBe('yellow')
      expect(state.cookiesGainedHpThisTurn?.['player-one'] ?? false).toBe(gainedHp)
    }
  })
})
