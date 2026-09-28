import { describe, expect, it } from 'vitest'
import { createBs11006OnPlayDemoState, parseTestStateConfig } from './demo'

describe('BS11-006 On Play Browser fixtures', () => {
  it.each(['positive', 'no-macaron', 'no-item'] as const)('%s isolates the printed condition and Item cost', (scenario) => {
    expect(parseTestStateConfig(`?test-state=bs11-006-on-play:${scenario}`, 'localhost'))
      .toEqual({ kind: 'bs11-006-on-play', scenario })
    const state = createBs11006OnPlayDemoState(scenario)
    const player = state.players['player-one']
    expect(player.hand[0]?.id).toBe('BS11-006')
    expect(player.hand.length).toBe(scenario === 'no-item' ? 1 : 2)
    expect(player.battleArea.some((entry) => entry.card.name === 'Macaron Cookie'))
      .toBe(scenario === 'positive')
    expect(state.players['player-two'].battleArea).toHaveLength(2)
  })
})
