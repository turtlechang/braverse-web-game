import { describe, expect, it } from 'vitest'
import { createBs11028StageDemoState, parseTestStateConfig } from './demo'

describe('BS11-028 Stage Browser fixture', () => {
  it.each([true, false])('sets yellow Cookie HP cost hasYellowCookie=%s', (hasYellowCookie) => {
    expect(parseTestStateConfig(`?test-state=bs11-028-stage:${hasYellowCookie ? 'positive' : 'negative'}`, 'localhost'))
      .toEqual({ kind: 'bs11-028-stage', hasYellowCookie })
    const state = createBs11028StageDemoState(hasYellowCookie)
    const player = state.players['player-one']
    expect(player.hand.some((card) => card.id === 'BS11-028')).toBe(true)
    expect(player.supportArea[0]?.card.energyColor).toBe('yellow')
    expect(player.battleArea.some((entry) => entry.card.instanceId === 'bs11-028-yellow-hp-target')).toBe(hasYellowCookie)
  })
})
