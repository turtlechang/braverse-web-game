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
    expect(result.pendingStrategyTelemetry).toHaveLength(
      result.behavior.pendingStrategy.decisions,
    )
    expect(
      result.behavior.pendingStrategy.universalSelections +
        result.behavior.pendingStrategy.fallbackSelections,
    ).toBe(result.behavior.pendingStrategy.decisions)
    expect(
      result.behavior.byPlayer['player-one'].lv4Search.decisions +
        result.behavior.byPlayer['player-two'].lv4Search.decisions,
    ).toBe(result.behavior.lv4Search.decisions)
    expect(
      result.lv4SearchTelemetryByPlayer['player-one'].length +
        result.lv4SearchTelemetryByPlayer['player-two'].length,
    ).toBe(result.lv4SearchTelemetry.length)
    expect(
      result.behavior.byPlayer['player-one'].lethalOpportunityCount +
        result.behavior.byPlayer['player-two'].lethalOpportunityCount,
    ).toBe(result.behavior.lethalOpportunityCount)
    expect(
      result.behavior.byPlayer['player-one'].lethalConversionCount +
        result.behavior.byPlayer['player-two'].lethalConversionCount,
    ).toBe(result.behavior.lethalConversionCount)
  })

  it('同回合先處理技能再宣告相同公開擊倒時，會計為已轉換的擊倒機會', () => {
    const seed = 20_563_827
    const result = simulateAiMatchDetailed(
      createDemoGame(seed, {
        player: 'bs7-blue-arena',
        ai: 'bs6-blue-competitive',
      }),
      2500,
      {
        levels: { 'player-one': 5, 'player-two': 5 },
        seed,
      },
    )

    expect(result.stuck, result.error ?? '').toBe(false)
    expect(result.behavior.lethalOpportunityCount).toBeGreaterThan(0)
    expect(result.behavior.lethalConversionCount).toBe(
      result.behavior.lethalOpportunityCount,
    )
  })
})
