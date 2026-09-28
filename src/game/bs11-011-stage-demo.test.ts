import { describe, expect, it } from 'vitest'
import { createBs11011StageDemoState, parseTestStateConfig } from './demo'

describe('BS11-011 Stage Browser fixtures', () => {
  it.each([true, false])('uses separate red payments with faint condition %s', (conditionMet) => {
    expect(parseTestStateConfig(`?test-state=bs11-011-stage:${conditionMet ? 'positive' : 'negative'}`, 'localhost'))
      .toEqual({ kind: 'bs11-011-stage', conditionMet })
    const state = createBs11011StageDemoState(conditionMet)
    expect(state.players['player-one'].hand.some((card) => card.id === 'BS11-011')).toBe(true)
    expect(state.players['player-one'].supportArea).toHaveLength(2)
    expect(state.cookiesFaintedThisTurn?.['player-one']).toBe(conditionMet ? 1 : 0)
  })
})
