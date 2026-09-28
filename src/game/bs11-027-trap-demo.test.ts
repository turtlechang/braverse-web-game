import { describe, expect, it } from 'vitest'
import { createBs11027TrapDemoState, parseTestStateConfig } from './demo'

describe('BS11-027 Trap Browser fixture', () => {
  it.each([true, false])('places Y2 payment at an opponent attack payable=%s', (payable) => {
    expect(parseTestStateConfig(`?test-state=bs11-027-trap:${payable ? 'positive' : 'negative'}`, 'localhost'))
      .toEqual({ kind: 'bs11-027-trap', payable })
    const state = createBs11027TrapDemoState(payable)
    expect(state.pendingBattle?.stage).toBe('trap')
    const player = state.players['player-one']
    expect(player.hand.some((card) => card.id === 'BS11-027')).toBe(true)
    expect(player.supportArea.length).toBe(payable ? 2 : 1)
    expect(player.supportArea.every((entry) => entry.card.energyColor === 'yellow')).toBe(true)
  })
})
