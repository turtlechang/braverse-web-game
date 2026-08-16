import { describe, expect, it } from 'vitest'
import {
  aggregateLv4SearchTelemetry,
  createLv4SearchTelemetry,
} from './search-telemetry'

describe('Lv4 search telemetry', () => {
  it('彙總預算、節點、計畫與 p95 決策時間', () => {
    const completed = {
      ...createLv4SearchTelemetry(),
      elapsedMs: 10,
      nodesExpanded: 2,
      nodesGenerated: 4,
      nodesPruned: 1,
      plan: { setupSteps: 1, payoffSteps: 1, completedPayoffs: 1 },
    }
    const timeout = {
      ...createLv4SearchTelemetry(),
      stopReason: 'time-budget' as const,
      fallbackUsed: true,
      elapsedMs: 30,
      nodesExpanded: 1,
      nodesGenerated: 2,
      hiddenInformationStops: 1,
      unsupportedEffectCount: 2,
      unknownInformationPenalty: -12,
      resourceReservationMisses: 1,
    }
    const nodeLimit = {
      ...createLv4SearchTelemetry(),
      stopReason: 'node-limit' as const,
      elapsedMs: 20,
    }

    expect(aggregateLv4SearchTelemetry([completed, timeout, nodeLimit])).toMatchObject({
      decisions: 3,
      timeouts: 1,
      nodeLimits: 1,
      fallbacks: 1,
      nodesExpanded: 3,
      nodesGenerated: 6,
      hiddenInformationStops: 1,
      unsupportedEffectCount: 2,
      unknownInformationPenalty: -12,
      resourceReservationMisses: 1,
      setupSteps: 1,
      payoffSteps: 1,
      completedPayoffs: 1,
      comboAbandonments: 0,
      averageDecisionMs: 20,
      p95DecisionMs: 30,
      maxDecisionMs: 30,
    })
  })

  it('空資料集保留零值，供 benchmark 安全輸出', () => {
    expect(aggregateLv4SearchTelemetry([])).toMatchObject({
      decisions: 0,
      averageDecisionMs: 0,
      p95DecisionMs: 0,
      maxDecisionMs: 0,
    })
  })
})
