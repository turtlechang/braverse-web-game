import { describe, expect, it } from 'vitest'
import { createBs11027AttackCostContinuationDemoState, parseTestStateConfig } from './demo'

describe('BS11-027 later attack cost Browser fixture', () => {
  it.each([true, false])('adds 1N to a marked Cookie with payment available %s', (canPayExtra) => {
    expect(parseTestStateConfig(`?test-state=bs11-027-attack-cost-continuation:${canPayExtra ? 'positive' : 'negative'}`, 'localhost'))
      .toEqual({ kind: 'bs11-027-attack-cost-continuation', canPayExtra })
    const state = createBs11027AttackCostContinuationDemoState(canPayExtra)
    expect(state.attackCostModifiers?.[0]).toMatchObject({
      targetInstanceId: state.players['player-one'].battleArea[0]?.card.instanceId,
      energyCost: { neutral: 1 },
      operation: 'increase',
    })
    expect(state.players['player-one'].supportArea).toHaveLength(canPayExtra ? 2 : 1)
  })
})
