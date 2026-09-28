import { describe, expect, it } from 'vitest'
import { getBlockerCandidates } from './battle'
import { createBs11094BlockerDemoState, parseTestStateConfig } from './demo'

describe('BS11-094 Blocker Browser fixtures', () => {
  it.each([true, false])('uses a live attack and %s black payment', (payable) => {
    expect(parseTestStateConfig(`?test-state=bs11-094-blocker:${payable ? 'positive' : 'negative'}`, 'localhost'))
      .toEqual({ kind: 'bs11-094-blocker', payable })
    const state = createBs11094BlockerDemoState(payable)
    expect(state.pendingBattle?.stage).toBe('trap')
    expect(state.players['player-one'].battleArea[1]?.card.id).toBe('BS11-094')
    expect(state.players['player-one'].supportArea[0]?.card.energyColor).toBe(payable ? 'black' : 'red')
    expect(getBlockerCandidates(state, 'player-one').some((entry) => entry.card.id === 'BS11-094')).toBe(payable)
  })
})
