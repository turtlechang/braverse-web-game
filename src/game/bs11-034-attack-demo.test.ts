import { describe, expect, it } from 'vitest'
import { createBs11034AttackDemoState, parseTestStateConfig } from './demo'

describe('BS11-034 attack Browser fixtures', () => {
  it.each(['BS11-034', 'BS11-034@1'] as const)('%s counts only eligible Break Ancients', (cardNumber) => {
    for (const hasAncients of [true, false]) {
      expect(parseTestStateConfig(`?test-state=bs11-034-attack:${cardNumber}:${hasAncients ? 'positive' : 'negative'}`, 'localhost'))
        .toEqual({ kind: 'bs11-034-attack', cardNumber, hasAncients })
      const state = createBs11034AttackDemoState(cardNumber, hasAncients)
      const player = state.players['player-one']
      expect(player.battleArea.some((entry) => entry.card.id === 'BS11-034')).toBe(true)
      expect(player.supportArea.map((entry) => entry.card.energyColor)).toEqual(['yellow', 'red', 'green', 'blue'])
      expect(player.breakArea.map((card) => card.id)).toEqual(hasAncients ? ['BS11-017', 'BS11-070'] : [])
    }
  })
})
