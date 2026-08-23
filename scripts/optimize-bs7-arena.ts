import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import {
  createDeckForChoice,
  createDeckFromCustomDeck,
  createGame,
  createSeededShuffle,
  forceMulliganOpeningHand,
  getAllCardPoolEntries,
  getCardPoolEntry,
  getDeckCopyLimit,
  OFFICIAL_DECK_RECIPES,
  selectStartingCookie,
  simulateAiMatchDetailed,
  validateCustomDeck,
  type BuiltInDeckChoice,
  type CardPoolEntry,
  type CustomDeck,
  type GameState,
  type PlayerId,
  type Shuffle,
  type StarterDeckEntry,
} from '../src/game/index'

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

type CandidateColor = (typeof ALL_CANDIDATES)[number]['color']
type CandidatePosition = 'first' | 'second'
type PoolScope =
  | 'current-plus-reference-bs7'
  | 'all-formal-color'
  | 'guided'

const DEFAULT_POOL_SCOPE: PoolScope = 'current-plus-reference-bs7'
const rescoreMode = Boolean(process.env.BS7_OPTIMIZE_RESCORE_INPUT?.trim())

interface SearchParameters {
  colors: CandidateColor[]
  poolScope: PoolScope
  guidedCards: string[]
  mutationCounts: number[]
  trainSeeds: number[]
  validationSeed: number
  trainGamesPerReference: number
  validationGamesPerReference: number
  beamWidth: number
  maxRounds: number
  maxCandidatesPerRound: number
  validationCandidates: number
  aiLevel: 4
  maxActions: 2500
  format: 'standard'
}

interface RecipeStats {
  totalCards: number
  bs7Slots: number
  distinctBs7Base: number
  validationErrors: string[]
  restrictedCards: string[]
}

interface LegalRecipe {
  valid: boolean
  stats: RecipeStats
}

interface Failure {
  seed: number
  referenceColor: string
  candidatePosition: CandidatePosition
  status: string
  error: string | null
  reasons: string[]
}

interface HealthSummary {
  passed: boolean
  games: number
  failureCount: number
  invalidActionCount: number
  stuck: number
  unfinished: number
  errorCount: number
  deadlockCount: number
  turnCapReached: number
  failures: Failure[]
}

interface MatchupSummary {
  games: number
  wins: number
  losses: number
  firstGames: number
  firstWins: number
  secondGames: number
  secondWins: number
  health: HealthSummary
}

interface SeedSummary {
  seed: number
  games: number
  wins: number
  losses: number
  firstGames: number
  firstWins: number
  secondGames: number
  secondWins: number
  matchups: Record<string, MatchupSummary>
  health: HealthSummary
}

interface AggregateSummary {
  games: number
  wins: number
  losses: number
  firstGames: number
  firstWins: number
  secondGames: number
  secondWins: number
  matchups: Record<string, MatchupSummary>
  health: HealthSummary
  seeds: SeedSummary[]
}

interface RankingScore {
  healthPassed: boolean
  wins: number
  worstSeedWins: number
  worstPositionWins: number
  secondPositionWins: number
  worstMatchupWins: number
}

interface CandidateEvaluation {
  key: string
  color: CandidateColor
  recipe: StarterDeckEntry[]
  candidatePoolSize: number
  legal: LegalRecipe
  train: AggregateSummary
  mutationDistance: number
  score: RankingScore
  rankingReason: string
}

interface RoundCandidateReport {
  rank: number
  selected: boolean
  generated: boolean
  key: string
  recipe: StarterDeckEntry[]
  legal: LegalRecipe
  train: AggregateSummary
  mutationDistance: number
  score: RankingScore
  rankingReason: string
}

interface SearchRoundReport {
  round: number
  parentCount: number
  generatedCount: number
  sampledCount: number
  evaluatedCount: number
  maxMutationDistance: number
  minBs7Slots: number
  mutationCoverage: MutationCoverage
  candidates: RoundCandidateReport[]
}

interface MutationCandidate {
  key: string
  recipe: StarterDeckEntry[]
  parentKey: string
  outgoing: string
  incoming: string
  amount: number
  hash: number
}

interface MutationCoverage {
  generatedCount: number
  sampledCount: number
  generatedDistinctOutgoing: number
  generatedDistinctIncoming: number
  sampledDistinctOutgoing: number
  sampledDistinctIncoming: number
  generatedOutgoing: string[]
  generatedIncoming: string[]
  sampledOutgoing: string[]
  sampledIncoming: string[]
  generatedMutationCounts: Record<string, number>
  sampledMutationCounts: Record<string, number>
}

interface ValidationCandidateReport {
  trainRank: number
  validationRank: number
  key: string
  recipe: StarterDeckEntry[]
  legal: LegalRecipe
  validation: AggregateSummary
  mutationDistance: number
  score: RankingScore
  rankingReason: string
}

interface ColorOptimizationReport {
  color: CandidateColor
  baseRecipe: StarterDeckEntry[]
  candidatePool: {
    scope: PoolScope
    guidedCards: string[]
    size: number
    cardNumbers: string[]
  }
  rounds: SearchRoundReport[]
  trainRanking: Array<{
    rank: number
    key: string
    recipe: StarterDeckEntry[]
    mutationDistance: number
    score: RankingScore
    health: HealthSummary
  }>
  bestTrainCandidate: CandidateEvaluation | null
  validation: {
    seed: number
    gamesPerReference: number
    candidates: ValidationCandidateReport[]
    bestCandidate: ValidationCandidateReport | null
  }
}

interface OptimizerReport {
  schemaVersion: 1
  generatedAt: string
  format: 'standard'
  description: string
  searchParameters: SearchParameters
  candidatePoolPolicy: string
  mutationPolicy: string
  rankingPolicy: string
  holdoutSeparation: {
    trainSeeds: number[]
    validationSeed: number
    finalMainHoldoutNotUsed: true
  }
  colors: Record<CandidateColor, ColorOptimizationReport>
}

interface RescoreSource {
  kind: 'baseRecipe' | 'validationCandidate'
  validationRank: number | null
  trainRank: number | null
}

interface RescoreCandidateReport {
  sourceRank: number
  sources: RescoreSource[]
  key: string
  recipe: StarterDeckEntry[]
  legal: LegalRecipe
  aggregate: AggregateSummary
  score: RankingScore
  health: HealthSummary
  mutationDistance: number
  rankingReason: string
  best: boolean
}

interface RescoreColorReport {
  color: CandidateColor
  baseRecipe: StarterDeckEntry[]
  candidates: RescoreCandidateReport[]
  bestCandidate: RescoreCandidateReport | null
}

interface RescoreReport {
  schemaVersion: 1
  generatedAt: string
  format: 'standard'
  mode: 'rescore'
  description: string
  sourceReportPath: string
  rescoreParameters: {
    colors: CandidateColor[]
    seeds: number[]
    gamesPerReference: number
    aiLevel: 4
    maxActions: 2500
    format: 'standard'
  }
  rankingPolicy: string
  colors: Record<CandidateColor, RescoreColorReport>
}

interface RescoreInputColor {
  baseRecipe: StarterDeckEntry[]
  validation: {
    candidates: Array<{
      trainRank?: number
      validationRank?: number
      recipe: StarterDeckEntry[]
    }>
  }
}

interface RescoreInputReport {
  colors: Partial<Record<CandidateColor, RescoreInputColor>>
}

const parsePositiveInt = (name: string, fallback: number): number => {
  const value = process.env[name]
  if (value === undefined || value.trim() === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} 必須是正整數。`)
  }
  return parsed
}

const parseCsvInts = (name: string, fallback: number[]): number[] => {
  const raw = process.env[name]
  if (raw === undefined || raw.trim() === '') return fallback
  const values = raw
    .split(',')
    .map((part) => Number(part.trim()))
  if (
    values.length === 0 ||
    values.some((value) => !Number.isInteger(value) || value < 1)
  ) {
    throw new Error(`${name} 必須是逗號分隔的正整數。`)
  }
  return values
}

const parseMutationCounts = (): number[] => {
  const values = parseCsvInts('BS7_OPTIMIZE_MUTATION_COUNTS', [1])
  if (values.some((value) => value < 1 || value > 4)) {
    throw new Error('BS7_OPTIMIZE_MUTATION_COUNTS 必須是 1 至 4 的正整數。')
  }
  return [...new Set(values)].sort((left, right) => left - right)
}

const requestedPoolScope =
  process.env.BS7_OPTIMIZE_POOL_SCOPE?.trim().toLowerCase() ||
  DEFAULT_POOL_SCOPE
if (
  requestedPoolScope !== DEFAULT_POOL_SCOPE &&
  requestedPoolScope !== 'all-formal-color' &&
  requestedPoolScope !== 'guided'
) {
  throw new Error(
    `BS7_OPTIMIZE_POOL_SCOPE 僅支援 ${DEFAULT_POOL_SCOPE}、all-formal-color 或 guided。`,
  )
}
const poolScope = requestedPoolScope as PoolScope

const requestedColors = new Set(
  (process.env.BS7_OPTIMIZE_COLORS ?? 'green,purple')
    .split(',')
    .map((color) => color.trim().toLowerCase())
    .filter(Boolean),
)

const unknownColors = [...requestedColors].filter(
  (color) => !ALL_CANDIDATES.some((candidate) => candidate.color === color),
)
if (unknownColors.length > 0) {
  throw new Error(`BS7_OPTIMIZE_COLORS 含未知顏色：${unknownColors.join(', ')}`)
}

const colors = ALL_CANDIDATES
  .filter((candidate) => requestedColors.has(candidate.color))
  .map((candidate) => candidate.color)

if (colors.length === 0) {
  throw new Error('BS7_OPTIMIZE_COLORS 至少需要一個顏色。')
}

const parseGuidedCards = (): string[] => {
  if (poolScope !== 'guided' || rescoreMode) return []
  const raw = process.env.BS7_OPTIMIZE_GUIDED_CARDS
  if (raw === undefined || raw.trim() === '') {
    throw new Error('BS7_OPTIMIZE_GUIDED_CARDS 在 guided pool mode 必須提供。')
  }
  const cardNumbers = [...new Set(
    raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  )].sort((left, right) => left.localeCompare(right))
  if (cardNumbers.length === 0) {
    throw new Error('BS7_OPTIMIZE_GUIDED_CARDS 在 guided pool mode 必須至少提供一張卡。')
  }

  const requestedColorSet = new Set<string>(colors)
  const invalid = cardNumbers.flatMap((cardNumber) => {
    const entry = getCardPoolEntry(cardNumber)
    if (!entry) return [`${cardNumber}: 不存在於正式 card pool`]
    const reasons: string[] = []
    if (entry.cardNumber !== entry.baseCardNumber) {
      reasons.push(`必須使用 baseCardNumber（目前為 ${entry.baseCardNumber}）`)
    }
    if (!entry.color || !requestedColorSet.has(entry.color.toLowerCase())) {
      reasons.push(`顏色必須符合 requested colors（${colors.join(', ')}）`)
    }
    if (entry.restrictions.banned) reasons.push('banned 卡不可加入 guided pool')
    return reasons.length > 0
      ? [`${cardNumber}: ${reasons.join('、')}`]
      : []
  })
  if (invalid.length > 0) {
    throw new Error(`BS7_OPTIMIZE_GUIDED_CARDS 無效：${invalid.join('; ')}`)
  }
  return cardNumbers
}

const guidedCards = parseGuidedCards()

const searchParameters: SearchParameters = {
  colors,
  poolScope,
  guidedCards,
  mutationCounts: parseMutationCounts(),
  trainSeeds: parseCsvInts('BS7_OPTIMIZE_TRAIN_SEEDS', [20260830, 20260831]),
  validationSeed: parsePositiveInt('BS7_OPTIMIZE_VALIDATION_SEED', 20260832),
  trainGamesPerReference: parsePositiveInt(
    'BS7_OPTIMIZE_TRAIN_GAMES_PER_REFERENCE',
    2,
  ),
  validationGamesPerReference: parsePositiveInt(
    'BS7_OPTIMIZE_VALIDATION_GAMES_PER_REFERENCE',
    10,
  ),
  beamWidth: parsePositiveInt('BS7_OPTIMIZE_BEAM_WIDTH', 6),
  maxRounds: parsePositiveInt('BS7_OPTIMIZE_ROUNDS', 4),
  maxCandidatesPerRound: parsePositiveInt(
    'BS7_OPTIMIZE_MAX_CANDIDATES_PER_ROUND',
    24,
  ),
  validationCandidates: parsePositiveInt(
    'BS7_OPTIMIZE_VALIDATION_CANDIDATES',
    6,
  ),
  aiLevel: 4,
  maxActions: 2500,
  format: 'standard',
}

if (searchParameters.trainGamesPerReference % 2 !== 0) {
  throw new Error('BS7_OPTIMIZE_TRAIN_GAMES_PER_REFERENCE 必須是偶數。')
}
if (searchParameters.validationGamesPerReference % 2 !== 0) {
  throw new Error('BS7_OPTIMIZE_VALIDATION_GAMES_PER_REFERENCE 必須是偶數。')
}

const outputPath = resolve(
  process.env.BS7_OPTIMIZE_OUTPUT ?? 'data/decks/bs7-optimizer-report.json',
)

const cloneRecipe = (
  recipe: readonly StarterDeckEntry[],
): StarterDeckEntry[] =>
  recipe
    .filter((entry) => entry.count > 0)
    .map((entry) => ({ cardNumber: entry.cardNumber, count: entry.count }))
    .sort((left, right) => left.cardNumber.localeCompare(right.cardNumber))

const recipeKey = (recipe: readonly StarterDeckEntry[]): string =>
  JSON.stringify(cloneRecipe(recipe))

const addCount = (
  counts: Map<string, number>,
  cardNumber: string,
  amount: number,
): void => {
  const next = (counts.get(cardNumber) ?? 0) + amount
  if (next <= 0) counts.delete(cardNumber)
  else counts.set(cardNumber, next)
}

const recipeFromCounts = (
  counts: Map<string, number>,
): StarterDeckEntry[] =>
  cloneRecipe(
    [...counts.entries()].map(([cardNumber, count]) => ({ cardNumber, count })),
  )

const recipeMutationDistance = (
  baseRecipe: readonly StarterDeckEntry[],
  recipe: readonly StarterDeckEntry[],
): number => {
  const baseCounts = new Map(
    baseRecipe.map((entry) => [entry.cardNumber, entry.count]),
  )
  const recipeCounts = new Map(
    recipe.map((entry) => [entry.cardNumber, entry.count]),
  )
  const cardNumbers = new Set([...baseCounts.keys(), ...recipeCounts.keys()])
  const absoluteDelta = [...cardNumbers].reduce(
    (total, cardNumber) =>
      total + Math.abs(
        (baseCounts.get(cardNumber) ?? 0) - (recipeCounts.get(cardNumber) ?? 0),
      ),
    0,
  )
  return absoluteDelta / 2
}

const getRecipeStats = (recipe: readonly StarterDeckEntry[]): LegalRecipe => {
  const validation = validateCustomDeck([...recipe], { format: 'standard' })
  const restrictedCards = recipe
    .filter((entry) => {
      const poolEntry = getCardPoolEntry(entry.cardNumber)
      return Boolean(poolEntry?.restrictions.banned || poolEntry?.restrictions.limited)
    })
    .map((entry) => entry.cardNumber)
  const bs7Entries = recipe.filter((entry) => entry.cardNumber.startsWith('BS7-'))
  const distinctBs7Base = new Set(
    bs7Entries.map((entry) => getCardPoolEntry(entry.cardNumber)?.baseCardNumber ?? entry.cardNumber),
  )
  const stats: RecipeStats = {
    totalCards: validation.stats.totalCards,
    bs7Slots: bs7Entries.reduce((total, entry) => total + entry.count, 0),
    distinctBs7Base: distinctBs7Base.size,
    validationErrors: [...validation.errors],
    restrictedCards,
  }
  const errors = [...stats.validationErrors]
  if (stats.bs7Slots < 32) errors.push(`BS7 槽位不足：${stats.bs7Slots}`)
  if (stats.distinctBs7Base < 8) {
    errors.push(`BS7 基礎卡種類不足：${stats.distinctBs7Base}`)
  }
  return {
    valid: errors.length === 0,
    stats: { ...stats, validationErrors: errors },
  }
}

const candidatePoolFor = (
  color: CandidateColor,
): CardPoolEntry[] => {
  const candidate = ALL_CANDIDATES.find((entry) => entry.color === color)
  if (!candidate) throw new Error(`找不到候選色：${color}`)
  const reference = REFERENCES.find((entry) => entry.color === color)
  if (!reference) throw new Error(`找不到同色 BS6 reference：${color}`)

  const pool = new Map<string, CardPoolEntry>()
  const add = (cardNumber: string): void => {
    const entry = getCardPoolEntry(cardNumber)
    if (!entry || entry.restrictions.banned) return
    pool.set(entry.cardNumber, entry)
  }

  if (poolScope === 'guided') {
    for (const entry of OFFICIAL_DECK_RECIPES[candidate.choice]) add(entry.cardNumber)
    for (const cardNumber of guidedCards) {
      const entry = getCardPoolEntry(cardNumber)
      if (entry?.color?.toLowerCase() === color) add(cardNumber)
    }
    return [...pool.values()].sort((left, right) =>
      left.cardNumber.localeCompare(right.cardNumber),
    )
  }

  if (poolScope === 'all-formal-color') {
    for (const entry of getAllCardPoolEntries()) {
      if (
        entry.cardNumber === entry.baseCardNumber &&
        entry.color?.toLowerCase() === color
      ) {
        add(entry.cardNumber)
      }
    }
    return [...pool.values()].sort((left, right) =>
      left.cardNumber.localeCompare(right.cardNumber),
    )
  }

  for (const entry of OFFICIAL_DECK_RECIPES[candidate.choice]) add(entry.cardNumber)
  for (const entry of OFFICIAL_DECK_RECIPES[reference.choice]) add(entry.cardNumber)
  for (const entry of getAllCardPoolEntries()) {
    if (
      entry.cardNumber.startsWith('BS7-') &&
      entry.cardNumber === entry.baseCardNumber &&
      entry.color?.toLowerCase() === color
    ) {
      add(entry.cardNumber)
    }
  }
  return [...pool.values()].sort((left, right) => left.cardNumber.localeCompare(right.cardNumber))
}

const stableHash = (value: string): number => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const compareMutations = (
  left: MutationCandidate,
  right: MutationCandidate,
): number => {
  if (left.hash !== right.hash) return left.hash - right.hash
  if (left.outgoing !== right.outgoing) {
    return left.outgoing.localeCompare(right.outgoing)
  }
  if (left.incoming !== right.incoming) {
    return left.incoming.localeCompare(right.incoming)
  }
  if (left.parentKey !== right.parentKey) {
    return left.parentKey.localeCompare(right.parentKey)
  }
  return left.key.localeCompare(right.key)
}

const generateMutations = (
  recipe: readonly StarterDeckEntry[],
  candidatePool: readonly CardPoolEntry[],
): MutationCandidate[] => {
  const counts = new Map(recipe.map((entry) => [entry.cardNumber, entry.count]))
  const existing = [...counts.keys()].sort((left, right) => left.localeCompare(right))
  const parentKey = recipeKey(recipe)
  const mutations = new Map<string, MutationCandidate>()

  for (const outgoing of existing) {
    for (const incoming of candidatePool) {
      if (incoming.cardNumber === outgoing) continue
      const incomingLimit = getDeckCopyLimit(incoming.cardNumber, 'standard')
      const outgoingCount = counts.get(outgoing) ?? 0
      const incomingGap = incomingLimit - (counts.get(incoming.cardNumber) ?? 0)
      const maxAmount = Math.min(outgoingCount, incomingGap)
      for (const amount of searchParameters.mutationCounts) {
        if (amount > maxAmount) break
        const nextCounts = new Map(counts)
        addCount(nextCounts, outgoing, -amount)
        addCount(nextCounts, incoming.cardNumber, amount)
        const nextRecipe = recipeFromCounts(nextCounts)
        const key = recipeKey(nextRecipe)
        if (!mutations.has(key)) {
          const hashInput = amount === 1
            ? `${parentKey}|${outgoing}|${incoming.cardNumber}`
            : `${parentKey}|${outgoing}|${incoming.cardNumber}|amount=${amount}`
          mutations.set(key, {
            key,
            recipe: nextRecipe,
            parentKey,
            outgoing,
            incoming: incoming.cardNumber,
            amount,
            hash: stableHash(hashInput),
          })
        }
      }
    }
  }

  return [...mutations.values()].sort(compareMutations)
}

const selectMutationSamples = (
  mutations: readonly MutationCandidate[],
  limit: number,
): MutationCandidate[] => {
  const ordered = [...mutations].sort(compareMutations)
  const selected: MutationCandidate[] = []
  const selectedKeys = new Set<string>()
  const selectedOutgoing = new Set<string>()
  const selectedIncoming = new Set<string>()

  while (selected.length < limit && selected.length < ordered.length) {
    const remaining = ordered.filter((mutation) => !selectedKeys.has(mutation.key))
    remaining.sort((left, right) => {
      const leftCoverage = Number(!selectedOutgoing.has(left.outgoing)) +
        Number(!selectedIncoming.has(left.incoming))
      const rightCoverage = Number(!selectedOutgoing.has(right.outgoing)) +
        Number(!selectedIncoming.has(right.incoming))
      if (leftCoverage !== rightCoverage) return rightCoverage - leftCoverage
      return compareMutations(left, right)
    })
    const next = remaining[0]
    if (!next) break
    selected.push(next)
    selectedKeys.add(next.key)
    selectedOutgoing.add(next.outgoing)
    selectedIncoming.add(next.incoming)
  }

  return selected
}

const sortedUnique = (values: Iterable<string>): string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right))

const mutationAmountCounts = (
  mutations: readonly MutationCandidate[],
): Record<string, number> => {
  const counts = new Map<number, number>()
  for (const mutation of mutations) {
    counts.set(mutation.amount, (counts.get(mutation.amount) ?? 0) + 1)
  }
  return Object.fromEntries(
    [...counts.entries()]
      .sort(([left], [right]) => left - right)
      .map(([amount, count]) => [String(amount), count]),
  )
}

const mutationCoverage = (
  generated: readonly MutationCandidate[],
  sampled: readonly MutationCandidate[],
): MutationCoverage => ({
  generatedCount: generated.length,
  sampledCount: sampled.length,
  generatedDistinctOutgoing: sortedUnique(generated.map((mutation) => mutation.outgoing)).length,
  generatedDistinctIncoming: sortedUnique(generated.map((mutation) => mutation.incoming)).length,
  sampledDistinctOutgoing: sortedUnique(sampled.map((mutation) => mutation.outgoing)).length,
  sampledDistinctIncoming: sortedUnique(sampled.map((mutation) => mutation.incoming)).length,
  generatedOutgoing: sortedUnique(generated.map((mutation) => mutation.outgoing)),
  generatedIncoming: sortedUnique(generated.map((mutation) => mutation.incoming)),
  sampledOutgoing: sortedUnique(sampled.map((mutation) => mutation.outgoing)),
  sampledIncoming: sortedUnique(sampled.map((mutation) => mutation.incoming)),
  generatedMutationCounts: mutationAmountCounts(generated),
  sampledMutationCounts: mutationAmountCounts(sampled),
})

const createEmptyHealth = (): HealthSummary => ({
  passed: true,
  games: 0,
  failureCount: 0,
  invalidActionCount: 0,
  stuck: 0,
  unfinished: 0,
  errorCount: 0,
  deadlockCount: 0,
  turnCapReached: 0,
  failures: [],
})

const createEmptyMatchup = (): MatchupSummary => ({
  games: 0,
  wins: 0,
  losses: 0,
  firstGames: 0,
  firstWins: 0,
  secondGames: 0,
  secondWins: 0,
  health: createEmptyHealth(),
})

const createEmptyAggregate = (): AggregateSummary => ({
  games: 0,
  wins: 0,
  losses: 0,
  firstGames: 0,
  firstWins: 0,
  secondGames: 0,
  secondWins: 0,
  matchups: {},
  health: createEmptyHealth(),
  seeds: [],
})

const getMatchup = (
  aggregate: AggregateSummary | SeedSummary,
  referenceColor: string,
): MatchupSummary => {
  const current = aggregate.matchups[referenceColor]
  if (current) return current
  const created = createEmptyMatchup()
  aggregate.matchups[referenceColor] = created
  return created
}

const healthReasons = (
  result: ReturnType<typeof simulateAiMatchDetailed>,
): string[] => {
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

const addHealth = (
  target: HealthSummary,
  result: ReturnType<typeof simulateAiMatchDetailed>,
  failure: Failure,
): void => {
  target.games += 1
  target.invalidActionCount += result.behavior.invalidActionCount
  target.stuck += Number(result.stuck)
  target.unfinished += Number(result.state.status !== 'finished' || !result.state.result?.winnerId)
  target.errorCount += Number(Boolean(result.error))
  target.deadlockCount += result.behavior.deadlockCount
  target.turnCapReached += Number(result.turnProgression.turnCapReached)
  if (failure.reasons.length > 0) {
    target.failureCount += 1
    target.passed = false
    target.failures.push(failure)
  }
}

const mergeHealth = (target: HealthSummary, source: HealthSummary): void => {
  target.games += source.games
  target.failureCount += source.failureCount
  target.invalidActionCount += source.invalidActionCount
  target.stuck += source.stuck
  target.unfinished += source.unfinished
  target.errorCount += source.errorCount
  target.deadlockCount += source.deadlockCount
  target.turnCapReached += source.turnCapReached
  target.passed = target.passed && source.passed
  target.failures.push(...source.failures)
}

const addGameToAggregate = (
  aggregate: AggregateSummary | SeedSummary,
  referenceColor: string,
  candidatePosition: CandidatePosition,
  candidateWon: boolean,
  result: ReturnType<typeof simulateAiMatchDetailed>,
  failure: Failure,
): void => {
  const matchup = getMatchup(aggregate, referenceColor)
  aggregate.games += 1
  aggregate.wins += Number(candidateWon)
  aggregate.losses += Number(!candidateWon)
  matchup.games += 1
  matchup.wins += Number(candidateWon)
  matchup.losses += Number(!candidateWon)
  if (candidatePosition === 'first') {
    aggregate.firstGames += 1
    aggregate.firstWins += Number(candidateWon)
    matchup.firstGames += 1
    matchup.firstWins += Number(candidateWon)
  } else {
    aggregate.secondGames += 1
    aggregate.secondWins += Number(candidateWon)
    matchup.secondGames += 1
    matchup.secondWins += Number(candidateWon)
  }
  const gameHealth = createEmptyHealth()
  addHealth(gameHealth, result, failure)
  addHealth(aggregate.health, result, failure)
  mergeHealth(matchup.health, gameHealth)
}

const ensureOpeningCookie = (
  initialState: GameState,
  playerId: PlayerId,
  shuffle: Shuffle,
): GameState => {
  let state = initialState
  let attempts = 0
  while (!state.players[playerId].hand.some((card) => card.type === 'cookie')) {
    if (attempts >= 100) {
      throw new Error(`無法替 ${playerId} 取得含餅乾的起始手牌。`)
    }
    state = forceMulliganOpeningHand(state, playerId, shuffle)
    attempts += 1
  }
  return state
}

const selectOpeningCookie = (state: GameState, playerId: PlayerId): GameState => {
  const cookie = state.players[playerId].hand.find((card) => card.type === 'cookie')
  if (!cookie) throw new Error(`起始手牌沒有餅乾：${playerId}`)
  return selectStartingCookie(state, playerId, cookie.instanceId)
}

const createOptimizerDeck = (
  color: CandidateColor,
  recipe: readonly StarterDeckEntry[],
  playerId: PlayerId,
): ReturnType<typeof createDeckForChoice> => {
  const customDeck: CustomDeck = {
    id: `bs7-optimizer-${color}`,
    name: `BS7 optimizer ${color}`,
    entries: [...recipe],
    format: 'standard',
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
  }
  return createDeckFromCustomDeck(customDeck, playerId)
}

const createOptimizerGame = (
  color: CandidateColor,
  recipe: readonly StarterDeckEntry[],
  referenceChoice: BuiltInDeckChoice,
  candidatePosition: CandidatePosition,
  seed: number,
): GameState => {
  const shuffle = createSeededShuffle(seed)
  const candidatePlayerId: PlayerId = candidatePosition === 'first'
    ? 'player-one'
    : 'player-two'
  const referencePlayerId: PlayerId = candidatePosition === 'first'
    ? 'player-two'
    : 'player-one'
  let state = createGame(
    {
      id: 'player-one',
      name: candidatePosition === 'first' ? `BS7 ${color}` : 'BS6 reference',
      deck: candidatePosition === 'first'
        ? createOptimizerDeck(color, recipe, candidatePlayerId)
        : createDeckForChoice(referenceChoice, referencePlayerId),
    },
    {
      id: 'player-two',
      name: candidatePosition === 'second' ? `BS7 ${color}` : 'BS6 reference',
      deck: candidatePosition === 'second'
        ? createOptimizerDeck(color, recipe, candidatePlayerId)
        : createDeckForChoice(referenceChoice, referencePlayerId),
    },
    'player-one',
    shuffle,
  )
  state = ensureOpeningCookie(state, 'player-one', shuffle)
  state = ensureOpeningCookie(state, 'player-two', shuffle)
  state = selectOpeningCookie(state, 'player-one')
  state = selectOpeningCookie(state, 'player-two')
  return state
}

const runGame = (
  color: CandidateColor,
  recipe: readonly StarterDeckEntry[],
  reference: (typeof REFERENCES)[number],
  candidatePosition: CandidatePosition,
  seed: number,
): {
  candidateWon: boolean
  result: ReturnType<typeof simulateAiMatchDetailed>
  failure: Failure
} => {
  const result = simulateAiMatchDetailed(
    createOptimizerGame(color, recipe, reference.choice, candidatePosition, seed),
    searchParameters.maxActions,
    {
      levels: { 'player-one': searchParameters.aiLevel, 'player-two': searchParameters.aiLevel },
      seed,
    },
  )
  const reasons = healthReasons(result)
  const candidatePlayerId: PlayerId = candidatePosition === 'first' ? 'player-one' : 'player-two'
  return {
    candidateWon: result.state.result?.winnerId === candidatePlayerId,
    result,
    failure: {
      seed,
      referenceColor: reference.color,
      candidatePosition,
      status: result.state.status,
      error: result.error,
      reasons,
    },
  }
}

const evaluateAggregate = (
  color: CandidateColor,
  recipe: readonly StarterDeckEntry[],
  seeds: readonly number[],
  gamesPerReference: number,
): AggregateSummary => {
  const aggregate = createEmptyAggregate()
  for (const seed of seeds) {
    const seedSummary: SeedSummary = {
      seed,
      games: 0,
      wins: 0,
      losses: 0,
      firstGames: 0,
      firstWins: 0,
      secondGames: 0,
      secondWins: 0,
      matchups: {},
      health: createEmptyHealth(),
    }
    for (const [referenceIndex, reference] of REFERENCES.entries()) {
      for (let pairIndex = 0; pairIndex < gamesPerReference / 2; pairIndex += 1) {
        const pairSeed = seed + referenceIndex * 1000 + pairIndex
        for (const candidatePosition of ['first', 'second'] as const) {
          const run = runGame(color, recipe, reference, candidatePosition, pairSeed)
          addGameToAggregate(
            seedSummary,
            reference.color,
            candidatePosition,
            run.candidateWon,
            run.result,
            run.failure,
          )
          addGameToAggregate(
            aggregate,
            reference.color,
            candidatePosition,
            run.candidateWon,
            run.result,
            run.failure,
          )
        }
      }
    }
    aggregate.seeds.push(seedSummary)
  }
  return aggregate
}

const scoreAggregate = (aggregate: AggregateSummary): RankingScore => ({
  healthPassed: aggregate.health.passed,
  wins: aggregate.wins,
  worstSeedWins: aggregate.seeds.length > 0
    ? Math.min(...aggregate.seeds.map((seed) => seed.wins))
    : 0,
  worstPositionWins: Math.min(aggregate.firstWins, aggregate.secondWins),
  secondPositionWins: aggregate.secondWins,
  worstMatchupWins: Math.min(
    ...REFERENCES.map((reference) => aggregate.matchups[reference.color]?.wins ?? 0),
  ),
})

const compareRankingScores = (
  left: { key: string; score: RankingScore },
  right: { key: string; score: RankingScore },
): number => {
  if (left.score.healthPassed !== right.score.healthPassed) {
    return left.score.healthPassed ? -1 : 1
  }
  if (left.score.wins !== right.score.wins) return right.score.wins - left.score.wins
  if (left.score.worstSeedWins !== right.score.worstSeedWins) {
    return right.score.worstSeedWins - left.score.worstSeedWins
  }
  if (left.score.worstPositionWins !== right.score.worstPositionWins) {
    return right.score.worstPositionWins - left.score.worstPositionWins
  }
  if (left.score.secondPositionWins !== right.score.secondPositionWins) {
    return right.score.secondPositionWins - left.score.secondPositionWins
  }
  if (left.score.worstMatchupWins !== right.score.worstMatchupWins) {
    return right.score.worstMatchupWins - left.score.worstMatchupWins
  }
  return left.key.localeCompare(right.key)
}

const compareScores = (
  left: CandidateEvaluation,
  right: CandidateEvaluation,
): number => compareRankingScores(left, right)

const rankingReason = (score: RankingScore): string =>
  `health=${score.healthPassed ? 'pass' : 'fail'}; wins=${score.wins}; ` +
  `worst-seed-wins=${score.worstSeedWins}; ` +
  `worst-position-wins=${score.worstPositionWins}; ` +
  `second-position-wins=${score.secondPositionWins}; ` +
  `worst-matchup-wins=${score.worstMatchupWins}`

const createEvaluation = (
  color: CandidateColor,
  baseRecipe: readonly StarterDeckEntry[],
  recipe: readonly StarterDeckEntry[],
  candidatePoolSize: number,
): CandidateEvaluation => {
  const normalizedRecipe = cloneRecipe(recipe)
  const legal = getRecipeStats(normalizedRecipe)
  const train = legal.valid
    ? evaluateAggregate(
        color,
        normalizedRecipe,
        searchParameters.trainSeeds,
        searchParameters.trainGamesPerReference,
      )
    : createEmptyAggregate()
  const score = {
    ...scoreAggregate(train),
    healthPassed: legal.valid && train.health.passed,
  }
  return {
    key: recipeKey(normalizedRecipe),
    color,
    recipe: normalizedRecipe,
    candidatePoolSize,
    legal,
    train,
    mutationDistance: recipeMutationDistance(baseRecipe, normalizedRecipe),
    score,
    rankingReason: rankingReason(score),
  }
}

const isEligibleForBeam = (evaluation: CandidateEvaluation): boolean =>
  evaluation.legal.valid && evaluation.train.health.passed

const selectBeam = (
  ranked: readonly CandidateEvaluation[],
): CandidateEvaluation[] => {
  const eligible = ranked.filter(isEligibleForBeam)
  if (searchParameters.beamWidth !== 6) {
    return eligible.slice(0, searchParameters.beamWidth)
  }

  const selected: CandidateEvaluation[] = []
  const selectedKeys = new Set<string>()
  const add = (candidate: CandidateEvaluation | undefined): void => {
    if (!candidate || selectedKeys.has(candidate.key)) return
    selected.push(candidate)
    selectedKeys.add(candidate.key)
  }

  for (const candidate of eligible.slice(0, 4)) add(candidate)

  const farthest = [...eligible].sort((left, right) => {
    if (left.mutationDistance !== right.mutationDistance) {
      return right.mutationDistance - left.mutationDistance
    }
    return compareScores(left, right)
  })[0]
  const lowestBs7Slots = [...eligible].sort((left, right) => {
    if (left.legal.stats.bs7Slots !== right.legal.stats.bs7Slots) {
      return left.legal.stats.bs7Slots - right.legal.stats.bs7Slots
    }
    return compareScores(left, right)
  })[0]
  add(farthest)
  add(lowestBs7Slots)

  for (const candidate of eligible) {
    if (selected.length >= searchParameters.beamWidth) break
    add(candidate)
  }
  return selected
}

const toRoundCandidateReport = (
  evaluation: CandidateEvaluation,
  rank: number,
  selected: boolean,
  generated: boolean,
): RoundCandidateReport => ({
  rank,
  selected,
  generated,
  key: evaluation.key,
  recipe: evaluation.recipe,
  legal: evaluation.legal,
  train: evaluation.train,
  mutationDistance: evaluation.mutationDistance,
  score: evaluation.score,
  rankingReason: evaluation.rankingReason,
})

const optimizeColor = (color: CandidateColor): ColorOptimizationReport => {
  const candidate = ALL_CANDIDATES.find((entry) => entry.color === color)
  if (!candidate) throw new Error(`找不到候選色：${color}`)
  const baseRecipe = cloneRecipe(OFFICIAL_DECK_RECIPES[candidate.choice])
  const candidatePool = candidatePoolFor(color)
  const cache = new Map<string, CandidateEvaluation>()
  const evaluate = (recipe: readonly StarterDeckEntry[]): CandidateEvaluation => {
    const key = recipeKey(recipe)
    const cached = cache.get(key)
    if (cached) return cached
    const result = createEvaluation(color, baseRecipe, recipe, candidatePool.length)
    cache.set(key, result)
    return result
  }
  const baseline = evaluate(baseRecipe)
  let beam = [baseline]
  const rounds: SearchRoundReport[] = [{
    round: 0,
    parentCount: 0,
    generatedCount: 0,
    sampledCount: 0,
    evaluatedCount: 1,
    maxMutationDistance: baseline.mutationDistance,
    minBs7Slots: baseline.legal.stats.bs7Slots,
    mutationCoverage: mutationCoverage([], []),
    candidates: [toRoundCandidateReport(baseline, 1, true, false)],
  }]

  for (let round = 1; round <= searchParameters.maxRounds; round += 1) {
    const parentBeam = [...beam]
    const generated = new Map<string, MutationCandidate>()
    for (const parent of parentBeam) {
      for (const mutation of generateMutations(parent.recipe, candidatePool)) {
        const key = mutation.key
        if (!cache.has(key) && !generated.has(key)) generated.set(key, mutation)
      }
    }
    const generatedMutations = [...generated.values()]
    const sampledMutations = selectMutationSamples(
      generatedMutations,
      searchParameters.maxCandidatesPerRound,
    )
    const generatedRecipes = sampledMutations.map((mutation) => mutation.recipe)
    const generatedEvaluations = generatedRecipes.map((recipe) => evaluate(recipe))
    const roundEvaluations = [...parentBeam, ...generatedEvaluations]
    const ranked = roundEvaluations.sort(compareScores)
    beam = selectBeam(ranked)
    const selectedKeys = new Set(beam.map((evaluation) => evaluation.key))
    rounds.push({
      round,
      parentCount: parentBeam.length,
      generatedCount: generatedMutations.length,
      sampledCount: sampledMutations.length,
      evaluatedCount: ranked.length,
      maxMutationDistance: Math.max(
        ...roundEvaluations.map((evaluation) => evaluation.mutationDistance),
      ),
      minBs7Slots: Math.min(
        ...roundEvaluations.map((evaluation) => evaluation.legal.stats.bs7Slots),
      ),
      mutationCoverage: mutationCoverage(generatedMutations, sampledMutations),
      candidates: ranked.map((evaluation, index) =>
        toRoundCandidateReport(
          evaluation,
          index + 1,
          selectedKeys.has(evaluation.key),
          generatedEvaluations.some((candidateEvaluation) => candidateEvaluation.key === evaluation.key),
        ),
      ),
    })
  }

  const allRanked = [...cache.values()].sort(compareScores)
  const trainRanking = allRanked.map((evaluation, index) => ({
    rank: index + 1,
    key: evaluation.key,
    recipe: evaluation.recipe,
    mutationDistance: evaluation.mutationDistance,
    score: evaluation.score,
    health: evaluation.train.health,
  }))
  const trainRankByKey = new Map(
    allRanked.map((evaluation, index) => [evaluation.key, index + 1]),
  )
  const topForValidation = allRanked
    .filter(isEligibleForBeam)
    .slice(0, searchParameters.validationCandidates)
  const validationResults = topForValidation.map((evaluation, index) => {
    const validation = evaluateAggregate(
      color,
      evaluation.recipe,
      [searchParameters.validationSeed],
      searchParameters.validationGamesPerReference,
    )
    return {
      trainRank: trainRankByKey.get(evaluation.key) ?? index + 1,
      validationRank: 0,
      key: evaluation.key,
      recipe: evaluation.recipe,
      legal: evaluation.legal,
      validation,
      mutationDistance: evaluation.mutationDistance,
      score: scoreAggregate(validation),
      rankingReason: rankingReason(scoreAggregate(validation)),
    }
  })
  validationResults.sort(compareRankingScores)
  validationResults.forEach((candidateResult, index) => {
    candidateResult.validationRank = index + 1
  })

  return {
    color,
    baseRecipe,
    candidatePool: {
      scope: poolScope,
      guidedCards,
      size: candidatePool.length,
      cardNumbers: candidatePool.map((entry) => entry.cardNumber),
    },
    rounds,
    trainRanking,
    bestTrainCandidate: allRanked.find(isEligibleForBeam) ?? null,
    validation: {
      seed: searchParameters.validationSeed,
      gamesPerReference: searchParameters.validationGamesPerReference,
      candidates: validationResults,
      bestCandidate: validationResults[0] ?? null,
    },
  }
}

const parseRequiredCsvInts = (name: string): number[] => {
  const raw = process.env[name]
  if (raw === undefined || raw.trim() === '') {
    throw new Error(`${name} 在 rescore mode 必須提供。`)
  }
  return parseCsvInts(name, [])
}

const parseRequiredPositiveInt = (name: string): number => {
  const raw = process.env[name]
  if (raw === undefined || raw.trim() === '') {
    throw new Error(`${name} 在 rescore mode 必須提供。`)
  }
  return parsePositiveInt(name, 1)
}

const runRescore = async (): Promise<RescoreReport> => {
  const inputPath = process.env.BS7_OPTIMIZE_RESCORE_INPUT?.trim()
  if (!inputPath) {
    throw new Error('BS7_OPTIMIZE_RESCORE_INPUT 在 rescore mode 必須提供。')
  }

  const sourceReportPath = resolve(inputPath)
  const sourceReportRelativePath = relative(process.cwd(), sourceReportPath)
  if (
    sourceReportRelativePath.startsWith('..') ||
    isAbsolute(sourceReportRelativePath)
  ) {
    throw new Error('BS7_OPTIMIZE_RESCORE_INPUT 必須位於專案工作目錄內。')
  }
  const sourceReport = JSON.parse(
    await readFile(sourceReportPath, 'utf8'),
  ) as RescoreInputReport
  const sourceColorNames = Object.keys(sourceReport.colors ?? {})
  const unknownColors = sourceColorNames.filter(
    (color) => !ALL_CANDIDATES.some((candidate) => candidate.color === color),
  )
  if (unknownColors.length > 0) {
    throw new Error(`rescore input 含未知顏色：${unknownColors.join(', ')}`)
  }
  const rescoreColors = sourceColorNames as CandidateColor[]
  if (rescoreColors.length === 0) {
    throw new Error('rescore input 至少需要一個 colors。')
  }

  const seeds = parseRequiredCsvInts('BS7_OPTIMIZE_RESCORE_SEEDS')
  const gamesPerReference = parseRequiredPositiveInt(
    'BS7_OPTIMIZE_RESCORE_GAMES_PER_REFERENCE',
  )
  if (gamesPerReference % 2 !== 0) {
    throw new Error(
      'BS7_OPTIMIZE_RESCORE_GAMES_PER_REFERENCE 必須是偶數。',
    )
  }

  const colorReports = {} as Record<CandidateColor, RescoreColorReport>
  for (const color of rescoreColors) {
    const sourceColor = sourceReport.colors[color]
    if (!sourceColor) {
      throw new Error(`rescore input 缺少 ${color} 顏色資料。`)
    }
    const baseRecipe = cloneRecipe(sourceColor.baseRecipe)
    const recipeSources = new Map<string, {
      recipe: StarterDeckEntry[]
      sources: RescoreSource[]
    }>()
    const addRecipe = (
      recipe: readonly StarterDeckEntry[],
      source: RescoreSource,
    ): void => {
      const normalizedRecipe = cloneRecipe(recipe)
      const key = recipeKey(normalizedRecipe)
      const existing = recipeSources.get(key)
      if (existing) {
        existing.sources.push(source)
        return
      }
      recipeSources.set(key, {
        recipe: normalizedRecipe,
        sources: [source],
      })
    }

    addRecipe(baseRecipe, {
      kind: 'baseRecipe',
      validationRank: null,
      trainRank: null,
    })
    for (const [index, candidate] of (
      sourceColor.validation?.candidates ?? []
    ).entries()) {
      addRecipe(candidate.recipe, {
        kind: 'validationCandidate',
        validationRank: candidate.validationRank ?? index + 1,
        trainRank: candidate.trainRank ?? null,
      })
    }

    const candidates: RescoreCandidateReport[] = [...recipeSources.values()].map(
      (entry): RescoreCandidateReport => {
        const legal = getRecipeStats(entry.recipe)
        const aggregate = legal.valid
          ? evaluateAggregate(color, entry.recipe, seeds, gamesPerReference)
          : createEmptyAggregate()
        const score: RankingScore = {
          ...scoreAggregate(aggregate),
          healthPassed: legal.valid && aggregate.health.passed,
        }
        const sourceRank = Math.min(
          ...entry.sources.map((source) => source.validationRank ?? 0),
        )
        return {
          sourceRank,
          sources: entry.sources,
          key: recipeKey(entry.recipe),
          recipe: entry.recipe,
          legal,
          aggregate,
          score,
          health: aggregate.health,
          mutationDistance: recipeMutationDistance(baseRecipe, entry.recipe),
          rankingReason: rankingReason(score),
          best: false,
        }
      }
    )

    candidates.sort(compareRankingScores)
    candidates.forEach((candidate, index) => {
      candidate.best = index === 0
    })
    colorReports[color] = {
      color,
      baseRecipe,
      candidates,
      bestCandidate: candidates[0] ?? null,
    }
  }

  const report: RescoreReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    format: 'standard',
    mode: 'rescore',
    description: 'Deterministic BS7 optimizer rescore of source validation candidates across multiple seeds; mutation search is not rerun.',
    sourceReportPath: sourceReportRelativePath.replaceAll('\\', '/'),
    rescoreParameters: {
      colors: rescoreColors,
      seeds,
      gamesPerReference,
      aiLevel: searchParameters.aiLevel,
      maxActions: searchParameters.maxActions,
      format: searchParameters.format,
    },
    rankingPolicy: 'Healthy candidates first, then total wins descending, worst-seed wins descending, worst-position wins descending, second-position wins descending, worst-matchup wins descending, canonical recipe key ascending.',
    colors: colorReports,
  }
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  return report
}

const run = async (): Promise<OptimizerReport> => {
  const colorReports = {} as Record<CandidateColor, ColorOptimizationReport>
  for (const color of colors) {
    colorReports[color] = optimizeColor(color)
  }
  const report: OptimizerReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    format: 'standard',
    description: 'Deterministic bounded BS7 pair-swap/count mutation beam search against frozen BS6 competitive references.',
    searchParameters,
    candidatePoolPolicy:
      poolScope === 'guided'
        ? `poolScope=guided; current candidate formal recipe cards + normalized guided cards=[${guidedCards.join(', ')}]; explicit guided cards require a formal base cardNumber, requested-color match, and non-banned status; limited cards are retained only when standard validation permits the count.`
        : poolScope === 'all-formal-color'
        ? 'poolScope=all-formal-color; all formal card-pool base cards whose cardNumber equals baseCardNumber and whose color matches the candidate; banned cards excluded, limited cards retained only when standard validation permits the count.'
        : 'poolScope=current-plus-reference-bs7; current formal recipe cards + same-color BS7 formal base cards + same-color BS6 competitive reference recipe cards; banned cards excluded, limited cards retained only when standard validation permits the count.',
    mutationPolicy: `Equal-count pair swap per mutation; BS7_OPTIMIZE_MUTATION_COUNTS=${searchParameters.mutationCounts.join(',')} (default 1, allowed 1..4); each amount is bounded by outgoing count and incoming standard copy-limit gap; 60 cards preserved, including limited-card count 1.`,
    rankingPolicy: 'Healthy candidates first, then total wins descending, worst-seed wins descending, worst-position wins descending, second-position wins descending, worst-matchup wins descending, canonical recipe key ascending; beam width 6 additionally reserves the farthest mutation and lowest-BS7-slot eligible candidates.',
    holdoutSeparation: {
      trainSeeds: searchParameters.trainSeeds,
      validationSeed: searchParameters.validationSeed,
      finalMainHoldoutNotUsed: true,
    },
    colors: colorReports,
  }
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  return report
}

if (rescoreMode) {
  const report = await runRescore()
  console.log(`BS7 optimizer rescore report: ${outputPath}`)
  for (const color of report.rescoreParameters.colors) {
    const colorReport = report.colors[color]
    const best = colorReport.bestCandidate
    console.log(
      `${color}: rescore best ${best?.aggregate.wins ?? 0} wins; ` +
      `candidates ${colorReport.candidates.length}; ` +
      `health ${best?.health.passed ? 'pass' : 'fail'}`,
    )
  }
} else {
  const report = await run()
  console.log(`BS7 optimizer report: ${outputPath}`)
  for (const color of colors) {
    const colorReport = report.colors[color]
    const best = colorReport.bestTrainCandidate
    const validation = colorReport.validation.bestCandidate
    console.log(
      `${color}: train best ${best?.train.wins ?? 0} wins; ` +
      `validation best ${validation?.validation.wins ?? 0} wins; ` +
      `candidate pool ${colorReport.candidatePool.size}; ` +
      `health ${best?.train.health.passed ? 'pass' : 'fail'}`,
    )
  }
}
