import { describe, expect, it } from 'vitest'
import { createBs11025AttackDemoState, parseTestStateConfig } from './demo'

describe('BS11-025 attack Browser fixture', () => {
  it.each([true, false])('represents two yellow attack energy payable=%s', (payable) => {
    expect(parseTestStateConfig(`?test-state=bs11-025-attack:${payable ? 'positive' : 'negative'}`, 'localhost'))
      .toEqual({ kind: 'bs11-025-attack', payable })
    const state = createBs11025AttackDemoState(payable)
    const player = state.players['player-one']
    expect(player.battleArea.some((entry) => entry.card.id === 'BS11-025')).toBe(true)
    expect(player.supportArea.length).toBe(payable ? 2 : 1)
    expect(player.supportArea.every((entry) => entry.card.energyColor === 'yellow' && !entry.rested)).toBe(true)
    expect(player.deck.slice(0, 2).map((card) => card.instanceId)).toEqual(['bs11-025-draw-one', 'bs11-025-draw-two'])
  })
})
