import { describe, expect, it } from 'vitest'
import { createBs11092ActivateDemoState, parseTestStateConfig } from './demo'

describe('BS11-092 Activate Browser fixtures', () => {
  it.each([true, false])('keeps printed LV while representing once-per-turn used=%s', (alreadyUsed) => {
    expect(parseTestStateConfig(`?test-state=bs11-092-activate:${alreadyUsed ? 'negative' : 'positive'}`, 'localhost'))
      .toEqual({ kind: 'bs11-092-activate', alreadyUsed })
    const state = createBs11092ActivateDemoState(alreadyUsed)
    const source = state.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS11-092')
    if (!source) throw new Error('Licorice fixture source missing')
    if (!source.battleEntryId) throw new Error('Licorice fixture battle identity missing')
    expect(source?.card.level).toBe(2)
    expect(source?.levelOverride).toBe(alreadyUsed ? 1 : undefined)
    expect(state.skillUsesThisTurn?.includes(source.battleEntryId)).toBe(alreadyUsed)
  })
})
