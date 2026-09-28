import { describe, expect, it } from 'vitest'
import { createBs11031ActivateContinuationDemoState, parseTestStateConfig } from './demo'

describe('BS11-031 Activate continuation Browser fixture', () => {
  it.each([true, false])('prepares a marked Cookie with two-card cost %s', (canDiscardTwo) => {
    expect(parseTestStateConfig(`?test-state=bs11-031-activate-continuation:${canDiscardTwo ? 'positive' : 'negative'}`, 'localhost'))
      .toEqual({ kind: 'bs11-031-activate-continuation', canDiscardTwo })
    const state = createBs11031ActivateContinuationDemoState(canDiscardTwo)
    expect(state.cookieActivateDiscardRequirements?.['player-one']?.[0]?.cookieInstanceId)
      .toBe('bs11-031-marked-activate-cookie')
    expect(state.players['player-one'].hand).toHaveLength(canDiscardTwo ? 2 : 1)
  })
})
