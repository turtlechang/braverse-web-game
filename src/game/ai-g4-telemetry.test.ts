import { describe, expect, it } from 'vitest'
import { createDemoGame, simulateAiMatchDetailed } from '.'

describe('G4 detailed telemetry integration', () => {
  it('Lv.4 對局會保留每次搜尋樣本並產出可供 benchmark 彙整的指標', () => {
    const result = simulateAiMatchDetailed(createDemoGame(31), 1500, {
      levels: { 'player-one': 4, 'player-two': 4 },
      seed: 31,
    })

    expect(result.stuck, result.error ?? '').toBe(false)
    expect(result.behavior.invalidActionCount).toBe(0)
    expect(result.behavior.deadlockCount).toBe(0)
    expect(result.lv4SearchTelemetry.length).toBe(
      result.behavior.lv4Search.decisions,
    )
    expect(result.behavior.lv4Search.nodesGenerated).toBeGreaterThan(0)
    expect(result.behavior.lv4Search.averageDecisionMs).toBeGreaterThanOrEqual(0)
    expect(result.behavior.legalAttackSkippedCount).toBeGreaterThanOrEqual(0)
    expect(result.behavior.lethalOpportunityCount).toBeGreaterThanOrEqual(
      result.behavior.lethalConversionCount,
    )
  })
})
