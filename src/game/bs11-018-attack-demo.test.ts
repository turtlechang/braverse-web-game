import { describe, expect, it } from 'vitest'
import { createBs11018AttackDemoState, parseTestStateConfig } from './demo'

describe('BS11-018 attack Browser fixtures', () => {
  it.each(['BS11-018', 'BS11-018@1'] as const)('%s supplies exact attack and faint boundaries', (cardNumber) => {
    for (const scenario of ['positive', 'skip', 'underpay'] as const) {
      expect(parseTestStateConfig(`?test-state=bs11-018-attack:${cardNumber}:${scenario}`, 'localhost'))
        .toEqual({ kind: 'bs11-018-attack', cardNumber, scenario })
      const state = createBs11018AttackDemoState(cardNumber, scenario)
      const player = state.players['player-one']
      const source = player.battleArea.find((entry) => entry.card.id === 'BS11-018')
      expect(source).toBeDefined()
      expect(player.battleArea.some((entry) => entry.card.instanceId === 'bs11-018-faint-ally')).toBe(true)
      expect(player.supportArea.length).toBe(scenario === 'underpay' ? 2 : 3)
    }
  })
})
