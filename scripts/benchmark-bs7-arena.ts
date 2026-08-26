import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  BS6_COMPETITIVE_AI_PRESET_DECK_CHOICES,
  BS7_ARENA_AI_PRESET_DECK_CHOICES,
  createDeckForChoice,
  createDemoGame,
  OFFICIAL_DECK_RECIPES,
  simulateAiMatchDetailed,
  validateCustomDeck,
  type BuiltInDeckChoice,
  type AiLevel,
} from '../src/game/index'
import type { Lv4SearchTelemetryAggregate } from '../src/game/ai/strategy/search-telemetry'

const BENCHMARK_SEED = Number(process.env.BS7_BENCHMARK_SEED ?? 20260822)
const GAMES_PER_REFERENCE = Number(
  process.env.BS7_GAMES_PER_REFERENCE ?? 10,
)
const MAX_ACTIONS = 2500
const requestedAiLevel = Number(process.env.BS7_AI_LEVEL ?? 4)
if (!Number.isInteger(requestedAiLevel) || requestedAiLevel < 1 || requestedAiLevel > 5) {
  throw new Error('BS7_AI_LEVEL 必須介於 1..5。')
}
const AI_LEVEL = requestedAiLevel as AiLevel
const OUTPUT_PATH = resolve(
  process.env.BS7_BENCHMARK_OUTPUT ??
    'data/decks/bs7-arena-vs-bs6-reference-report-250.json',
)

if (!Number.isInteger(BENCHMARK_SEED)) {
  throw new Error('BS7_BENCHMARK_SEED 必須是整數。')
}

if (
  !Number.isInteger(GAMES_PER_REFERENCE) ||
  GAMES_PER_REFERENCE <= 0 ||
  GAMES_PER_REFERENCE % 2 !== 0
) {
  throw new Error('BS7_GAMES_PER_REFERENCE 必須是正偶數。')
}

const ALL_CANDIDATES = [
  { color: 'red', choice: 'bs7-red-arena' },
  { color: 'yellow', choice: 'bs7-yellow-arena' },
  { color: 'green', choice: 'bs7-green-arena' },
  { color: 'blue', choice: 'bs7-blue-arena' },
  { color: 'purple', choice: 'bs7-purple-arena' },
] as const satisfies readonly {
  color: string
  choice: BuiltInDeckChoice
}[]

type CandidateColor = (typeof ALL_CANDIDATES)[number]['color']

const requestedCandidateColors = new Set(
  (process.env.BS7_CANDIDATE_COLORS ?? '')
    .split(',')
    .map((color) => color.trim().toLowerCase())
    .filter(Boolean),
)
const unknownCandidateColors = [...requestedCandidateColors].filter(
  (color) => !ALL_CANDIDATES.some((candidate) => candidate.color === color),
)
if (unknownCandidateColors.length > 0) {
  throw new Error(
    `BS7_CANDIDATE_COLORS 含未知顏色：${unknownCandidateColors.join(', ')}`,
  )
}

const CANDIDATES = ALL_CANDIDATES.filter(
  (candidate) =>
    requestedCandidateColors.size === 0 ||
    requestedCandidateColors.has(candidate.color),
)

const REFERENCES = [
  { color: 'red', choice: 'bs6-red-competitive' },
  { color: 'yellow', choice: 'bs6-yellow-competitive' },
  { color: 'green', choice: 'bs6-green-competitive' },
  { color: 'blue', choice: 'bs6-blue-competitive' },
  { color: 'purple', choice: 'bs6-purple-competitive' },
] as const satisfies readonly {
  color: string
  choice: BuiltInDeckChoice
}[]

type CandidatePosition = 'first' | 'second'
type AiResult = ReturnType<typeof simulateAiMatchDetailed>

interface Lv4Aggregate extends Lv4SearchTelemetryAggregate {
  totalDecisionMs: number
  decisionTimes: number[]
}

interface BehaviorAggregate {
  invalidActionCount: number
  deadlockCount: number
  turnCapReached: number
  legalAttackSkippedCount: number
  lethalOpportunityCount: number
  lethalConversionCount: number
  lowQualityReplacementCount: number
  noDamageTurns: number
  noBoardChangeTurns: number
  consecutiveNoProgressMax: number
  lv4Search: Lv4Aggregate
}

interface MatchBucket {
  games: number
  wins: number
  losses: number
  stuck: number
  unfinished: number
  errorCount: number
  totalTurns: number
  totalActions: number
  totalSkillActivations: number
  totalRefreshes: number
  reasons: Record<string, number>
  errors: string[]
  behavior: BehaviorAggregate
}

interface WinRateCi {
  lower: number
  upper: number
  confidence: number
}

interface PositionSummary {
  games: number
  wins: number
  losses: number
  stuck: number
  unfinished: number
  errorCount: number
  completionRate: number
  winRate: number
  wilson95Ci: WinRateCi
}

interface MatchSummary extends PositionSummary {
  avgTurns: number
  avgActions: number
  avgSkillActivations: number
  avgRefreshes: number
  reasons: Record<string, number>
  errors: string[]
  behavior: BehaviorSummary
}

interface BehaviorSummary {
  invalidActionCount: number
  deadlockCount: number
  turnCapReached: number
  legalAttackSkippedCount: number
  lethalOpportunityCount: number
  lethalConversionCount: number
  lowQualityReplacementCount: number
  noDamageTurns: number
  noBoardChangeTurns: number
  consecutiveNoProgressMax: number
  lv4Search: Omit<Lv4Aggregate, 'decisionTimes' | 'totalDecisionMs'>
}

interface CandidateSummary extends MatchSummary {
  candidatePositionSplits: Record<CandidatePosition, PositionSummary>
}

interface ValidationReport {
  choice: string
  color: string
  role: 'candidate' | 'reference'
  valid: boolean
  validationErrors: string[]
  totalCards: number
  runtimeCards: number
  bs7Slots?: number
  distinctBs7Base?: number
}

interface FailureReport {
  seed: number
  candidateChoice: string
  referenceChoice: string
  candidatePosition: CandidatePosition
  status: string
  reason: string
  error: string | null
}

const createLv4Aggregate = (): Lv4Aggregate => ({
  decisions: 0,
  timeouts: 0,
  nodeLimits: 0,
  fallbacks: 0,
  nodesExpanded: 0,
  nodesGenerated: 0,
  nodesPruned: 0,
  hiddenInformationStops: 0,
  unsupportedEffectCount: 0,
  unknownInformationPenalty: 0,
  resourceReservationMisses: 0,
  publicResponseEvaluations: 0,
  publicResponseBranches: 0,
  publicResponseMinPenalty: 0,
  defensiveReserveEvaluations: 0,
  defensiveReserveAdjustment: 0,
  endgameSurvivalEvaluations: 0,
  endgameSurvivalAdjustment: 0,
  setupSteps: 0,
  payoffSteps: 0,
  completedPayoffs: 0,
  comboAbandonments: 0,
  averageDecisionMs: 0,
  p95DecisionMs: 0,
  maxDecisionMs: 0,
  totalDecisionMs: 0,
  decisionTimes: [],
})

const createBehaviorAggregate = (): BehaviorAggregate => ({
  invalidActionCount: 0,
  deadlockCount: 0,
  turnCapReached: 0,
  legalAttackSkippedCount: 0,
  lethalOpportunityCount: 0,
  lethalConversionCount: 0,
  lowQualityReplacementCount: 0,
  noDamageTurns: 0,
  noBoardChangeTurns: 0,
  consecutiveNoProgressMax: 0,
  lv4Search: createLv4Aggregate(),
})

const createBucket = (): MatchBucket => ({
  games: 0,
  wins: 0,
  losses: 0,
  stuck: 0,
  unfinished: 0,
  errorCount: 0,
  totalTurns: 0,
  totalActions: 0,
  totalSkillActivations: 0,
  totalRefreshes: 0,
  reasons: {},
  errors: [],
  behavior: createBehaviorAggregate(),
})

const addNumber = (
  target: Lv4Aggregate,
  source: Lv4SearchTelemetryAggregate,
  key: Exclude<keyof Lv4SearchTelemetryAggregate, 'averageDecisionMs' | 'p95DecisionMs' | 'maxDecisionMs'>,
): void => {
  target[key] += source[key]
}

const addLv4Telemetry = (
  target: Lv4Aggregate,
  source: Lv4SearchTelemetryAggregate,
  elapsedMs: readonly number[],
): void => {
  const keys: Array<Exclude<keyof Lv4SearchTelemetryAggregate, 'averageDecisionMs' | 'p95DecisionMs' | 'maxDecisionMs'>> = [
    'decisions',
    'timeouts',
    'nodeLimits',
    'fallbacks',
    'nodesExpanded',
    'nodesGenerated',
    'nodesPruned',
    'hiddenInformationStops',
    'unsupportedEffectCount',
    'unknownInformationPenalty',
    'resourceReservationMisses',
    'publicResponseEvaluations',
    'publicResponseBranches',
    'publicResponseMinPenalty',
    'defensiveReserveEvaluations',
    'defensiveReserveAdjustment',
    'endgameSurvivalEvaluations',
    'endgameSurvivalAdjustment',
    'setupSteps',
    'payoffSteps',
    'completedPayoffs',
    'comboAbandonments',
  ]
  for (const key of keys) {
    addNumber(target, source, key)
  }
  target.decisionTimes.push(...elapsedMs)
  target.totalDecisionMs += elapsedMs.reduce((sum, value) => sum + value, 0)
}

const addBehavior = (
  target: BehaviorAggregate,
  result: AiResult,
): void => {
  const behavior = result.behavior
  target.invalidActionCount += behavior.invalidActionCount
  target.deadlockCount += behavior.deadlockCount
  target.turnCapReached += Number(result.turnProgression.turnCapReached)
  target.legalAttackSkippedCount += behavior.legalAttackSkippedCount
  target.lethalOpportunityCount += behavior.lethalOpportunityCount
  target.lethalConversionCount += behavior.lethalConversionCount
  target.lowQualityReplacementCount += behavior.lowQualityReplacementCount
  target.noDamageTurns += behavior.noDamageTurns
  target.noBoardChangeTurns += behavior.noBoardChangeTurns
  target.consecutiveNoProgressMax = Math.max(
    target.consecutiveNoProgressMax,
    behavior.consecutiveNoProgressMax,
  )
  addLv4Telemetry(
    target.lv4Search,
    behavior.lv4Search,
    result.lv4SearchTelemetry.map((entry) => entry.elapsedMs),
  )
}

const resultReason = (result: AiResult): string =>
  result.state.result?.reason ??
  result.error ??
  (result.state.status === 'finished'
    ? 'finished-without-result'
    : `status:${result.state.status}`)

const addResult = (
  bucket: MatchBucket,
  result: AiResult,
  perspective: 'player-one' | 'player-two',
): void => {
  bucket.games += 1
  bucket.totalTurns += result.state.turnNumber - 1
  bucket.totalActions += result.actions
  bucket.totalSkillActivations += result.metrics.skillActivations
  bucket.totalRefreshes += result.metrics.refreshes
  addBehavior(bucket.behavior, result)

  const reason = resultReason(result)
  bucket.reasons[reason] = (bucket.reasons[reason] ?? 0) + 1
  if (result.error) {
    bucket.errorCount += 1
    if (!bucket.errors.includes(result.error)) {
      bucket.errors.push(result.error)
    }
  }

  const hasWinner = result.state.result?.winnerId !== undefined
  const finished = result.state.status === 'finished' && hasWinner
  if (result.stuck || !finished) {
    bucket.stuck += 1
  }
  if (result.state.status !== 'finished') {
    bucket.unfinished += 1
  }
  if (!finished) {
    return
  }
  if (result.state.result?.winnerId === perspective) {
    bucket.wins += 1
  } else {
    bucket.losses += 1
  }
}

const addThrownResult = (bucket: MatchBucket, error: string): void => {
  bucket.games += 1
  bucket.stuck += 1
  bucket.unfinished += 1
  bucket.errorCount += 1
  bucket.reasons.error = (bucket.reasons.error ?? 0) + 1
  if (!bucket.errors.includes(error)) {
    bucket.errors.push(error)
  }
}

const wilson95 = (wins: number, games: number): WinRateCi => {
  if (games === 0) {
    return { lower: 0, upper: 0, confidence: 0.95 }
  }
  const z = 1.959963984540054
  const proportion = wins / games
  const zSquared = z * z
  const denominator = 1 + zSquared / games
  const center = proportion + zSquared / (2 * games)
  const margin =
    z *
    Math.sqrt(
      (proportion * (1 - proportion) + zSquared / (4 * games)) / games,
    )
  return {
    lower: Math.max(0, (center - margin) / denominator),
    upper: Math.min(1, (center + margin) / denominator),
    confidence: 0.95,
  }
}

const percentile95 = (values: readonly number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0
}

const summarizeLv4 = (
  aggregate: Lv4Aggregate,
): Omit<Lv4Aggregate, 'decisionTimes' | 'totalDecisionMs'> => ({
  decisions: aggregate.decisions,
  timeouts: aggregate.timeouts,
  nodeLimits: aggregate.nodeLimits,
  fallbacks: aggregate.fallbacks,
  nodesExpanded: aggregate.nodesExpanded,
  nodesGenerated: aggregate.nodesGenerated,
  nodesPruned: aggregate.nodesPruned,
  hiddenInformationStops: aggregate.hiddenInformationStops,
  unsupportedEffectCount: aggregate.unsupportedEffectCount,
  unknownInformationPenalty: aggregate.unknownInformationPenalty,
  resourceReservationMisses: aggregate.resourceReservationMisses,
  publicResponseEvaluations: aggregate.publicResponseEvaluations,
  publicResponseBranches: aggregate.publicResponseBranches,
  publicResponseMinPenalty: aggregate.publicResponseMinPenalty,
  defensiveReserveEvaluations: aggregate.defensiveReserveEvaluations,
  defensiveReserveAdjustment: aggregate.defensiveReserveAdjustment,
  endgameSurvivalEvaluations: aggregate.endgameSurvivalEvaluations,
  endgameSurvivalAdjustment: aggregate.endgameSurvivalAdjustment,
  setupSteps: aggregate.setupSteps,
  payoffSteps: aggregate.payoffSteps,
  completedPayoffs: aggregate.completedPayoffs,
  comboAbandonments: aggregate.comboAbandonments,
  averageDecisionMs:
    aggregate.decisions === 0
      ? 0
      : aggregate.totalDecisionMs / aggregate.decisions,
  p95DecisionMs: percentile95(aggregate.decisionTimes),
  maxDecisionMs: aggregate.decisionTimes.length === 0
    ? 0
    : Math.max(...aggregate.decisionTimes),
})

const summarizePosition = (bucket: MatchBucket): PositionSummary => ({
  games: bucket.games,
  wins: bucket.wins,
  losses: bucket.losses,
  stuck: bucket.stuck,
  unfinished: bucket.unfinished,
  errorCount: bucket.errorCount,
  completionRate: bucket.games === 0 ? 0 : (bucket.wins + bucket.losses) / bucket.games,
  winRate: bucket.games === 0 ? 0 : bucket.wins / bucket.games,
  wilson95Ci: wilson95(bucket.wins, bucket.games),
})

const summarizeBucket = (bucket: MatchBucket): MatchSummary => ({
  ...summarizePosition(bucket),
  avgTurns: bucket.games === 0 ? 0 : bucket.totalTurns / bucket.games,
  avgActions: bucket.games === 0 ? 0 : bucket.totalActions / bucket.games,
  avgSkillActivations:
    bucket.games === 0 ? 0 : bucket.totalSkillActivations / bucket.games,
  avgRefreshes: bucket.games === 0 ? 0 : bucket.totalRefreshes / bucket.games,
  reasons: bucket.reasons,
  errors: bucket.errors,
  behavior: {
    invalidActionCount: bucket.behavior.invalidActionCount,
    deadlockCount: bucket.behavior.deadlockCount,
    turnCapReached: bucket.behavior.turnCapReached,
    legalAttackSkippedCount: bucket.behavior.legalAttackSkippedCount,
    lethalOpportunityCount: bucket.behavior.lethalOpportunityCount,
    lethalConversionCount: bucket.behavior.lethalConversionCount,
    lowQualityReplacementCount: bucket.behavior.lowQualityReplacementCount,
    noDamageTurns: bucket.behavior.noDamageTurns,
    noBoardChangeTurns: bucket.behavior.noBoardChangeTurns,
    consecutiveNoProgressMax: bucket.behavior.consecutiveNoProgressMax,
    lv4Search: summarizeLv4(bucket.behavior.lv4Search),
  },
})

const baseCardNumber = (cardNumber: string): string => cardNumber.split('@')[0]

const validateDecks = (): ValidationReport[] => {
  const registeredCandidates = new Set(BS7_ARENA_AI_PRESET_DECK_CHOICES)
  if (CANDIDATES.some((candidate) => !registeredCandidates.has(candidate.choice))) {
    throw new Error('BS7 candidate choice 清單含未註冊牌組。')
  }
  if (BS6_COMPETITIVE_AI_PRESET_DECK_CHOICES.length !== REFERENCES.length) {
    throw new Error('BS6 reference choice 清單與 benchmark 清單不一致。')
  }

  const reports: ValidationReport[] = []
  for (const deck of [...CANDIDATES, ...REFERENCES]) {
    const role = deck.choice.startsWith('bs7-') ? 'candidate' : 'reference'
    const entries = OFFICIAL_DECK_RECIPES[deck.choice]
    const validation = validateCustomDeck(entries, { format: 'standard' })
    const runtimeCards = createDeckForChoice(deck.choice, 'player-one').length
    const report: ValidationReport = {
      choice: deck.choice,
      color: deck.color,
      role,
      valid: validation.isValid && validation.stats.totalCards === 60 && runtimeCards === 60,
      validationErrors: validation.errors,
      totalCards: validation.stats.totalCards,
      runtimeCards,
    }
    if (role === 'candidate') {
      const bs7Entries = entries.filter((entry) =>
        baseCardNumber(entry.cardNumber).startsWith('BS7-'),
      )
      report.bs7Slots = bs7Entries.reduce((sum, entry) => sum + entry.count, 0)
      report.distinctBs7Base = new Set(
        bs7Entries.map((entry) => baseCardNumber(entry.cardNumber)),
      ).size
      report.valid =
        report.valid &&
        report.bs7Slots >= 32 &&
        report.distinctBs7Base >= 8
      if (report.bs7Slots < 32) {
        report.validationErrors.push(`BS7 slots 僅 ${report.bs7Slots}，需要至少 32。`)
      }
      if (report.distinctBs7Base < 8) {
        report.validationErrors.push(
          `BS7 distinct base 僅 ${report.distinctBs7Base}，需要至少 8。`,
        )
      }
    }
    reports.push(report)
    if (!report.valid) {
      throw new Error(
        `${deck.choice} invalid: ${report.validationErrors.join('; ') || 'deck validation failed'}`,
      )
    }
  }
  return reports
}

const failureReasons = (result: AiResult): string[] => {
  const reasons: string[] = []
  if (result.stuck) reasons.push('stuck')
  if (result.state.status !== 'finished') reasons.push(`status:${result.state.status}`)
  if (!result.state.result?.winnerId) reasons.push('missing-winner')
  if (result.error) reasons.push('error')
  if (result.behavior.invalidActionCount > 0) reasons.push('invalid-action')
  if (result.behavior.deadlockCount > 0) reasons.push('deadlock')
  if (result.turnProgression.turnCapReached) reasons.push('turn-cap')
  return reasons
}

const runBenchmark = (): {
  candidates: Record<CandidateColor, CandidateSummary>
  matchups: Record<string, MatchSummary & {
    candidateChoice: string
    referenceChoice: string
    candidatePositionSplits: Record<CandidatePosition, PositionSummary>
  }>
  failures: FailureReport[]
  totalGames: number
} => {
  const candidateBuckets = Object.fromEntries(
    CANDIDATES.map((candidate) => [
      candidate.color,
      {
        total: createBucket(),
        first: createBucket(),
        second: createBucket(),
      },
    ]),
  ) as Record<CandidateColor, {
    total: MatchBucket
    first: MatchBucket
    second: MatchBucket
  }>
  const matchups: Record<string, MatchSummary & {
    candidateChoice: string
    referenceChoice: string
    candidatePositionSplits: Record<CandidatePosition, PositionSummary>
  }> = {}
  const failures: FailureReport[] = []

  for (const [candidateIndex, candidate] of CANDIDATES.entries()) {
    for (const [referenceIndex, reference] of REFERENCES.entries()) {
      const matchupBucket = createBucket()
      const positionBuckets: Record<CandidatePosition, MatchBucket> = {
        first: createBucket(),
        second: createBucket(),
      }
      for (let pairIndex = 0; pairIndex < GAMES_PER_REFERENCE / 2; pairIndex += 1) {
        const seed =
          BENCHMARK_SEED +
          candidateIndex * 100_000 +
          referenceIndex * 1_000 +
          pairIndex
        const pairedRuns: Array<{
          candidatePosition: CandidatePosition
          playerChoice: BuiltInDeckChoice
          aiChoice: BuiltInDeckChoice
          perspective: 'player-one' | 'player-two'
        }> = [
          {
            candidatePosition: 'first',
            playerChoice: candidate.choice,
            aiChoice: reference.choice,
            perspective: 'player-one',
          },
          {
            candidatePosition: 'second',
            playerChoice: reference.choice,
            aiChoice: candidate.choice,
            perspective: 'player-two',
          },
        ]
        for (const run of pairedRuns) {
          try {
            const result = simulateAiMatchDetailed(
              createDemoGame(seed, {
                player: run.playerChoice,
                ai: run.aiChoice,
              }),
              MAX_ACTIONS,
              {
                levels: {
                  'player-one': AI_LEVEL,
                  'player-two': AI_LEVEL,
                },
                seed,
              },
            )
            addResult(matchupBucket, result, run.perspective)
            addResult(
              candidateBuckets[candidate.color].total,
              result,
              run.perspective,
            )
            addResult(positionBuckets[run.candidatePosition], result, run.perspective)
            addResult(
              candidateBuckets[candidate.color][run.candidatePosition],
              result,
              run.perspective,
            )

            const reasons = failureReasons(result)
            if (reasons.length > 0) {
              failures.push({
                seed,
                candidateChoice: candidate.choice,
                referenceChoice: reference.choice,
                candidatePosition: run.candidatePosition,
                status: result.state.status,
                reason: reasons.join(','),
                error: result.error,
              })
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            addThrownResult(matchupBucket, message)
            addThrownResult(candidateBuckets[candidate.color].total, message)
            addThrownResult(positionBuckets[run.candidatePosition], message)
            addThrownResult(
              candidateBuckets[candidate.color][run.candidatePosition],
              message,
            )
            failures.push({
              seed,
              candidateChoice: candidate.choice,
              referenceChoice: reference.choice,
              candidatePosition: run.candidatePosition,
              status: 'exception',
              reason: 'simulation-threw',
              error: message,
            })
          }
        }
      }

      const key = `${candidate.color}-vs-${reference.color}`
      matchups[key] = {
        ...summarizeBucket(matchupBucket),
        candidateChoice: candidate.choice,
        referenceChoice: reference.choice,
        candidatePositionSplits: {
          first: summarizePosition(positionBuckets.first),
          second: summarizePosition(positionBuckets.second),
        },
      }
    }
  }

  const candidates = Object.fromEntries(
    CANDIDATES.map((candidate) => {
      const bucket = candidateBuckets[candidate.color]
      return [
        candidate.color,
        {
          ...summarizeBucket(bucket.total),
          candidatePositionSplits: {
            first: summarizePosition(bucket.first),
            second: summarizePosition(bucket.second),
          },
        },
      ]
    }),
  ) as Record<CandidateColor, CandidateSummary>

  return {
    candidates,
    matchups,
    failures,
    totalGames: CANDIDATES.length * REFERENCES.length * GAMES_PER_REFERENCE,
  }
}

const validation = validateDecks()
const result = runBenchmark()
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  format: 'standard',
  methodology: {
    description:
      'BS7 Arena 五色候選牌組對 frozen BS6 competitive reference；不加入 BS7 mirror。每個候選色對每副 reference 以配對 seed 各跑一次 BS7 先手與一次 BS7 後手。',
    candidateChoices: Object.fromEntries(
      CANDIDATES.map((deck) => [deck.color, deck.choice]),
    ),
    candidateColors: CANDIDATES.map((deck) => deck.color),
    referenceChoices: Object.fromEntries(
      REFERENCES.map((deck) => [deck.color, deck.choice]),
    ),
    candidateDeckRecipes: Object.fromEntries(
      CANDIDATES.map((deck) => [
        deck.color,
        OFFICIAL_DECK_RECIPES[deck.choice].map((entry) => ({ ...entry })),
      ]),
    ),
    referenceDeckRecipes: Object.fromEntries(
      REFERENCES.map((deck) => [
        deck.color,
        OFFICIAL_DECK_RECIPES[deck.choice].map((entry) => ({ ...entry })),
      ]),
    ),
    gamesPerReference: GAMES_PER_REFERENCE,
    seedPairsPerReference: GAMES_PER_REFERENCE / 2,
    gamesPerColor: REFERENCES.length * GAMES_PER_REFERENCE,
    totalGames: result.totalGames,
    sameDeckMirrorsIncluded: false,
    candidateVsSameColorReferenceIncluded: true,
    pairedSeedPolicy:
      '每個 candidate/reference 配對使用同一 seed 跑兩局；第一局 BS7 為 player-one，第二局 BS7 為 player-two。',
    candidateFirstPlayerGamesPerColor:
      (REFERENCES.length * GAMES_PER_REFERENCE) / 2,
    candidateSecondPlayerGamesPerColor:
      (REFERENCES.length * GAMES_PER_REFERENCE) / 2,
      aiLevel: AI_LEVEL,
    maxActions: MAX_ACTIONS,
    seed: BENCHMARK_SEED,
  },
  validation,
  result: {
    candidates: result.candidates,
    matchups: result.matchups,
  },
  failures: result.failures,
  healthGate: {
    passed: result.failures.length === 0,
    failureCount: result.failures.length,
    rule:
      '任一場 stuck、unfinished、error、invalid action、deadlock 或 turn cap 即失敗；先寫 report 再以 exit code 1 結束。',
  },
}

await mkdir(dirname(OUTPUT_PATH), { recursive: true })
await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log(`BS7 Arena benchmark completed: ${OUTPUT_PATH}`)
for (const candidate of CANDIDATES) {
  const summary = report.result.candidates[candidate.color]
  console.log(
    `${candidate.color}: ${summary.wins}/${summary.games} wins; ` +
      `95% CI ${(summary.wilson95Ci.lower * 100).toFixed(1)}%-${(summary.wilson95Ci.upper * 100).toFixed(1)}%; ` +
      `first ${summary.candidatePositionSplits.first.wins}/${summary.candidatePositionSplits.first.games}; ` +
      `second ${summary.candidatePositionSplits.second.wins}/${summary.candidatePositionSplits.second.games}; ` +
      `stuck ${summary.stuck}; invalid ${summary.behavior.invalidActionCount}; ` +
      `deadlock ${summary.behavior.deadlockCount}; turnCap ${summary.behavior.turnCapReached}`,
  )
}
if (result.failures.length > 0) {
  console.error(`BS7 Arena health gate failed: ${result.failures.length} game(s)`)
  process.exitCode = 1
}
