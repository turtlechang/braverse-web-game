import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createDemoGame,
  simulateAiMatchDetailed,
  ALL_AI_TRAINING_DECK_CHOICES,
  type AiLevel,
  type BuiltInDeckChoice,
  type PlayerId,
} from '../src/game/index'
import { getAllCardPoolEntries } from '../src/game/card-pool'

const DEFAULT_DECKS: BuiltInDeckChoice[] = [
  'bs7-red-arena',
  'bs7-yellow-arena',
  'bs7-green-arena',
  'bs7-blue-arena',
  'bs7-purple-arena',
]

type MatchupMode = 'mirror' | 'rotating' | 'both'

interface Matchup {
  challengerDeck: BuiltInDeckChoice
  championDeck: BuiltInDeckChoice
}

const buildMatchups = (
  decks: readonly BuiltInDeckChoice[],
  mode: MatchupMode,
): Matchup[] => decks.flatMap((challengerDeck, index) => {
  const matchups: Matchup[] = []
  if (mode !== 'rotating') {
    matchups.push({ challengerDeck, championDeck: challengerDeck })
  }
  if (mode !== 'mirror' && decks.length > 1) {
    matchups.push({
      challengerDeck,
      championDeck: decks[(index + 1) % decks.length]!,
    })
  }
  return matchups
})

const cardPoolCoverage = () => {
  const inventory = getAllCardPoolEntries().filter((entry) =>
    entry.flags.enabled &&
    !entry.flags.hidden &&
    entry.type !== 'extra' &&
    entry.type !== 'unknown',
  )
  return {
    formalInventoryEntries: inventory.length,
    uniqueRuntimeMechanics: new Set(inventory.map((entry) => entry.poolId)).size,
    includesAlternatePrints: true,
  }
}

interface Bucket {
  games: number
  completed: number
  challengerWins: number
  stuck: number
  invalidActions: number
  deadlocks: number
  turnCaps: number
  comboStarted: number
  comboCompleted: number
  comboAbandoned: number
  endgameForecasts: number
  refreshForecasts: number
  emptyBattleForecasts: number
}

const emptyBucket = (): Bucket => ({
  games: 0,
  completed: 0,
  challengerWins: 0,
  stuck: 0,
  invalidActions: 0,
  deadlocks: 0,
  turnCaps: 0,
  comboStarted: 0,
  comboCompleted: 0,
  comboAbandoned: 0,
  endgameForecasts: 0,
  refreshForecasts: 0,
  emptyBattleForecasts: 0,
})

const wilson95 = (wins: number, games: number) => {
  if (games === 0) return { lower: 0, upper: 0 }
  const z = 1.959963984540054
  const rate = wins / games
  const denominator = 1 + (z * z) / games
  const center = (rate + (z * z) / (2 * games)) / denominator
  const margin = z * Math.sqrt(
    (rate * (1 - rate) + (z * z) / (4 * games)) / games,
  ) / denominator
  return { lower: center - margin, upper: center + margin }
}

const addResult = (
  bucket: Bucket,
  result: ReturnType<typeof simulateAiMatchDetailed>,
  challengerId: PlayerId,
) => {
  bucket.games += 1
  bucket.stuck += Number(result.stuck)
  bucket.invalidActions += result.behavior.invalidActionCount
  bucket.deadlocks += result.behavior.deadlockCount
  bucket.turnCaps += Number(result.endInfo.turnCapReached)
  bucket.comboStarted += result.behavior.comboIntentsStarted
  bucket.comboCompleted += result.behavior.comboIntentsCompleted
  bucket.comboAbandoned += result.behavior.comboIntentsAbandoned
  bucket.endgameForecasts += result.behavior.endgameForecastCount
  bucket.refreshForecasts += result.behavior.refreshForecastCount
  bucket.emptyBattleForecasts += result.behavior.emptyBattleForecastCount
  if (!result.stuck && result.state.status === 'finished') {
    bucket.completed += 1
    bucket.challengerWins += Number(result.state.result?.winnerId === challengerId)
  }
}

const argumentValue = (name: string): string | undefined => {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
}

const integerArgument = (name: string, fallback: number): number => {
  const value = Number(argumentValue(name) ?? fallback)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} 必須是正整數。`)
  }
  return value
}

const levelArgument = (name: string, fallback: AiLevel): AiLevel => {
  const value = integerArgument(name, fallback)
  if (value < 1 || value > 5) throw new Error(`--${name} 必須介於 1..5。`)
  return value as AiLevel
}

const summarize = (bucket: Bucket) => ({
  ...bucket,
  completionRate: bucket.games > 0 ? bucket.completed / bucket.games : 0,
  challengerWinRate:
    bucket.completed > 0 ? bucket.challengerWins / bucket.completed : 0,
  wilson95: wilson95(bucket.challengerWins, bucket.completed),
})

export const runAiChallengerBenchmark = ({
  championLevel = 4,
  challengerLevel = 5,
  seedStart = 1,
  seeds = 10,
  decks = DEFAULT_DECKS,
  minWinRate = 0.52,
  matchupMode = 'mirror',
}: {
  championLevel?: AiLevel
  challengerLevel?: AiLevel
  seedStart?: number
  seeds?: number
  decks?: readonly BuiltInDeckChoice[]
  minWinRate?: number
  matchupMode?: MatchupMode
} = {}) => {
  const overall = emptyBucket()
  const byDeck: Record<string, Bucket> = {}
  const byMatchup: Record<string, Bucket> = {}

  for (const deck of decks) byDeck[deck] = emptyBucket()
  for (const matchup of buildMatchups(decks, matchupMode)) {
    const bucket = emptyBucket()
    const matchupKey = `${matchup.challengerDeck}__vs__${matchup.championDeck}`
    byMatchup[matchupKey] = bucket
    for (let seed = seedStart; seed < seedStart + seeds; seed += 1) {
      for (const challengerFirst of [true, false]) {
        const challengerId: PlayerId = challengerFirst
          ? 'player-one'
          : 'player-two'
        const result = simulateAiMatchDetailed(
          createDemoGame(seed, challengerFirst
            ? { player: matchup.challengerDeck, ai: matchup.championDeck }
            : { player: matchup.championDeck, ai: matchup.challengerDeck }),
          2500,
          {
            levels: challengerFirst
              ? { 'player-one': challengerLevel, 'player-two': championLevel }
              : { 'player-one': championLevel, 'player-two': challengerLevel },
            seed,
          },
        )
        addResult(bucket, result, challengerId)
        addResult(byDeck[matchup.challengerDeck]!, result, challengerId)
        addResult(overall, result, challengerId)
      }
    }
  }

  const summary = summarize(overall)
  const safetyPass =
    summary.completed === summary.games &&
    summary.stuck === 0 &&
    summary.invalidActions === 0 &&
    summary.deadlocks === 0 &&
    summary.turnCaps === 0
  const performancePass = summary.challengerWinRate >= minWinRate
  const statisticallyAhead = summary.wilson95.lower > 0.5

  return {
    schemaVersion: 2 as const,
    generatedAt: new Date().toISOString(),
    championLevel,
    challengerLevel,
    seedPolicy: {
      seedStart,
      seedEnd: seedStart + seeds - 1,
      pairedSides: true,
      decks: [...decks],
      matchupMode,
      matchups: Object.keys(byMatchup),
    },
    trainingCorpus: cardPoolCoverage(),
    threshold: { minWinRate },
    overall: summary,
    byDeck: Object.fromEntries(
      Object.entries(byDeck).map(([deck, bucket]) => [deck, summarize(bucket)]),
    ),
    byMatchup: Object.fromEntries(
      Object.entries(byMatchup).map(([matchup, bucket]) => [matchup, summarize(bucket)]),
    ),
    gate: {
      safetyPass,
      performancePass,
      statisticallyAhead,
      promotionReady: safetyPass && performancePass && statisticallyAhead,
    },
  }
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  const corpus = argumentValue('corpus') ?? 'bs7'
  if (corpus !== 'bs7' && corpus !== 'full') {
    throw new Error('--corpus 必須是 bs7 或 full。')
  }
  const decks = (argumentValue('decks')?.split(',').filter(Boolean) ?? (
    corpus === 'full' ? [...ALL_AI_TRAINING_DECK_CHOICES] : DEFAULT_DECKS
  )) as BuiltInDeckChoice[]
  const matchupMode = argumentValue('matchups') ?? (corpus === 'full' ? 'both' : 'mirror')
  if (matchupMode !== 'mirror' && matchupMode !== 'rotating' && matchupMode !== 'both') {
    throw new Error('--matchups 必須是 mirror、rotating 或 both。')
  }
  const minWinRate = Number(argumentValue('min-win-rate') ?? 0.52)
  if (!Number.isFinite(minWinRate) || minWinRate < 0 || minWinRate > 1) {
    throw new Error('--min-win-rate 必須介於 0..1。')
  }
  const report = runAiChallengerBenchmark({
    championLevel: levelArgument('champion', 4),
    challengerLevel: levelArgument('challenger', 5),
    seedStart: integerArgument('seed-start', 1),
    seeds: integerArgument('seeds', 10),
    decks,
    minWinRate,
    matchupMode,
  })
  const serialized = `${JSON.stringify(report, null, 2)}\n`
  const output = argumentValue('output')
  if (output) {
    const outputPath = resolve(output)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, serialized, 'utf8')
  }
  process.stdout.write(serialized)
  if (process.argv.includes('--strict') && !report.gate.promotionReady) {
    process.exitCode = 1
  }
}
