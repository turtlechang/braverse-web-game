import { describe, expect, it } from 'vitest'
import { createBs11013TrapDemoState, parseTestStateConfig } from './demo'

describe('BS11-013 Trap Browser fixtures', () => {
  it.each([true, false])('provides a real attack with LV3 HP condition %s', (conditionMet) => {
    expect(parseTestStateConfig(`?test-state=bs11-013-trap:${conditionMet ? 'positive' : 'negative'}`, 'localhost'))
      .toEqual({ kind: 'bs11-013-trap', conditionMet })
    const state = createBs11013TrapDemoState(conditionMet)
    expect(state.pendingBattle?.stage).toBe('trap')
    const witness = state.players['player-one'].battleArea.find((entry) => entry.card.instanceId.startsWith('bs11-013-lv3'))
    expect(witness?.card.level).toBe(3)
    expect(witness?.hpCards.length).toBe(conditionMet ? 1 : 2)
    expect(state.players['player-one'].supportArea).toHaveLength(1)
  })
})
