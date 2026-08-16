export type Lv4SearchStopReason =
  | 'completed'
  | 'node-limit'
  | 'time-budget'
  | 'no-candidate'

export interface Lv4PlanTelemetry {
  setupSteps: number
  payoffSteps: number
  completedPayoffs: number
}

export interface Lv4SearchTelemetry {
  stopReason: Lv4SearchStopReason
  elapsedMs: number
  nodesExpanded: number
  nodesGenerated: number
  nodesPruned: number
  maxDepthReached: number
  fallbackUsed: boolean
  hiddenInformationStops: number
  unsupportedEffectCount: number
  unknownInformationPenalty: number
  resourceReservationMisses: number
  plan: Lv4PlanTelemetry
}

export interface Lv4SearchTelemetryAggregate {
  decisions: number
  timeouts: number
  nodeLimits: number
  fallbacks: number
  nodesExpanded: number
  nodesGenerated: number
  nodesPruned: number
  hiddenInformationStops: number
  unsupportedEffectCount: number
  unknownInformationPenalty: number
  resourceReservationMisses: number
  setupSteps: number
  payoffSteps: number
  completedPayoffs: number
  comboAbandonments: number
  averageDecisionMs: number
  p95DecisionMs: number
  maxDecisionMs: number
}

export const createLv4SearchTelemetry = (): Lv4SearchTelemetry => ({
  stopReason: 'completed',
  elapsedMs: 0,
  nodesExpanded: 0,
  nodesGenerated: 0,
  nodesPruned: 0,
  maxDepthReached: 0,
  fallbackUsed: false,
  hiddenInformationStops: 0,
  unsupportedEffectCount: 0,
  unknownInformationPenalty: 0,
  resourceReservationMisses: 0,
  plan: {
    setupSteps: 0,
    payoffSteps: 0,
    completedPayoffs: 0,
  },
})

export const aggregateLv4SearchTelemetry = (
  entries: readonly Lv4SearchTelemetry[],
): Lv4SearchTelemetryAggregate => {
  const elapsed = entries.map((entry) => entry.elapsedMs).sort((left, right) => left - right)
  const sum = (selector: (entry: Lv4SearchTelemetry) => number): number =>
    entries.reduce((total, entry) => total + selector(entry), 0)
  const count = entries.length
  const setupSteps = sum((entry) => entry.plan.setupSteps)
  const completedPayoffs = sum((entry) => entry.plan.completedPayoffs)
  return {
    decisions: count,
    timeouts: entries.filter((entry) => entry.stopReason === 'time-budget').length,
    nodeLimits: entries.filter((entry) => entry.stopReason === 'node-limit').length,
    fallbacks: entries.filter((entry) => entry.fallbackUsed).length,
    nodesExpanded: sum((entry) => entry.nodesExpanded),
    nodesGenerated: sum((entry) => entry.nodesGenerated),
    nodesPruned: sum((entry) => entry.nodesPruned),
    hiddenInformationStops: sum((entry) => entry.hiddenInformationStops),
    unsupportedEffectCount: sum((entry) => entry.unsupportedEffectCount),
    unknownInformationPenalty: sum((entry) => entry.unknownInformationPenalty),
    resourceReservationMisses: sum((entry) => entry.resourceReservationMisses),
    setupSteps,
    payoffSteps: sum((entry) => entry.plan.payoffSteps),
    completedPayoffs,
    comboAbandonments: Math.max(0, setupSteps - completedPayoffs),
    averageDecisionMs: count === 0
      ? 0
      : sum((entry) => entry.elapsedMs) / count,
    p95DecisionMs: count === 0
      ? 0
      : elapsed[Math.ceil(count * 0.95) - 1],
    maxDecisionMs: count === 0 ? 0 : elapsed.at(-1) ?? 0,
  }
}
