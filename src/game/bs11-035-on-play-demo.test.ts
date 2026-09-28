import { describe, expect, it } from 'vitest'
import { createBs11035OnPlayDemoState, parseTestStateConfig } from './demo'

describe('BS11-035 On Play Browser fixtures', () => {
  it.each(['BS11-035', 'BS11-035@1'] as const)('%s has a separate hand Cookie cost', (cardNumber) => {
    for (const hasHandCost of [true, false]) {
      expect(parseTestStateConfig(`?test-state=bs11-035-on-play:${cardNumber}:${hasHandCost ? 'positive' : 'negative'}`, 'localhost'))
        .toEqual({ kind: 'bs11-035-on-play', cardNumber, hasHandCost })
      const state = createBs11035OnPlayDemoState(cardNumber, hasHandCost)
      const player = state.players['player-one']
      expect(player.hand.some((card) => card.id === 'BS11-035')).toBe(true)
      expect(player.hand.some((card) => card.instanceId === 'bs11-035-hand-to-break-cost')).toBe(hasHandCost)
      expect(player.breakArea[0]?.instanceId).toBe('bs11-035-break-to-hand-target')
      expect(player.supportArea.length).toBe(2)
    }
  })
})
