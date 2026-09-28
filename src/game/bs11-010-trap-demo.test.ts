import { describe, expect, it } from 'vitest'
import { createBs11010TrapDemoState, parseTestStateConfig } from './demo'

describe('BS11-010 Trap Browser fixtures', () => {
  it.each(['BS11-010', 'BS11-010@1'] as const)('%s separates the second payment and Fire Spirit condition', (cardNumber) => {
    for (const conditionMet of [true, false]) {
      const route = `bs11-010-trap:${cardNumber}:${conditionMet ? 'positive' : 'negative'}`
      expect(parseTestStateConfig(`?test-state=${route}`, 'localhost'))
        .toEqual({ kind: 'bs11-010-trap', cardNumber, conditionMet })
      const state = createBs11010TrapDemoState(cardNumber, conditionMet)
      expect(state.pendingBattle?.stage).toBe('trap')
      expect(state.players['player-one'].supportArea).toHaveLength(2)
      expect(state.players['player-one'].battleArea.some((entry) => entry.card.name === 'Fire Spirit Cookie'))
        .toBe(conditionMet)
      expect(state.players['player-one'].battleArea.find((entry) =>
        entry.card.instanceId === state.pendingBattle?.targetInstanceId)?.hpCards).toHaveLength(8)
    }
  })
})
