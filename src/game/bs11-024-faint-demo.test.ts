import { describe, expect, it } from 'vitest'
import { createBs11024FaintDemoState, parseTestStateConfig } from './demo'

describe('BS11-024 faint Browser fixture', () => {
  it.each([true, false])('queues a real faint with LV.3 in hand=%s', (hasLv3) => {
    expect(parseTestStateConfig(`?test-state=bs11-024-faint:${hasLv3 ? 'positive' : 'negative'}`, 'localhost'))
      .toEqual({ kind: 'bs11-024-faint', hasLv3 })
    const state = createBs11024FaintDemoState(hasLv3)
    expect(state.pendingFaintEffects?.some((entry) => entry.sourceCardName === 'Smoked Cheese Cookie')).toBe(true)
    const replacement = state.players['player-one'].hand[0]
    expect(replacement?.type).toBe('cookie')
    if (replacement?.type !== 'cookie') throw new Error('BS11-024 replacement must be a Cookie')
    expect(replacement.level).toBe(hasLv3 ? 3 : 2)
    expect(state.players['player-one'].battleArea.some((entry) => entry.card.id === 'BS11-024')).toBe(false)
  })
})
