import { describe, expect, it } from 'vitest'
import { createBs11029TrapDemoState, parseTestStateConfig } from './demo'

describe('BS11-029 Trap Browser fixtures', () => {
  it.each(['BS11-029', 'BS11-029@1'] as const)('%s keeps optional Then condition', (cardNumber) => {
    for (const conditionMet of [true, false]) {
      expect(parseTestStateConfig(`?test-state=bs11-029-trap:${cardNumber}:${conditionMet ? 'positive' : 'negative'}`, 'localhost'))
        .toEqual({ kind: 'bs11-029-trap', cardNumber, conditionMet })
      const state = createBs11029TrapDemoState(cardNumber, conditionMet)
      expect(state.pendingBattle?.stage).toBe('trap')
      const player = state.players['player-one']
      expect(player.hand.some((card) => card.id === 'BS11-029')).toBe(true)
      expect(player.battleArea.some((entry) => entry.card.instanceId === 'bs11-029-millennial-ally')).toBe(conditionMet)
      expect(player.supportArea.map((entry) => entry.card.energyColor)).toEqual(['yellow', 'red'])
    }
  })
})
