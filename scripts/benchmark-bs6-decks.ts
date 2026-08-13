import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  BS6_AI_PRESET_DECK_CHOICES,
  BS6_COMPETITIVE_AI_PRESET_DECK_CHOICES,
  createDeckForChoice,
  createDemoGame,
  OFFICIAL_DECK_RECIPES,
  simulateAiMatchDetailed,
  validateCustomDeck,
  type BuiltInDeckChoice,
} from '../src/game/index'

const MATRIX_SEED = Number(process.env.BS6_BENCHMARK_SEED ?? 20260812)
const GAMES_PER_PAIR = Number(process.env.BS6_GAMES_PER_PAIR ?? 4)
const FIRST_PLAYER_SPLIT = GAMES_PER_PAIR / 2
const MAX_ACTIONS = 2500
const AI_LEVEL = 4
const BENCHMARK_MODE =
  process.env.BS6_BENCHMARK_MODE === 'competitive' ? 'competitive' : 'standard'

if (
  !Number.isInteger(GAMES_PER_PAIR) ||
  GAMES_PER_PAIR <= 0 ||
  GAMES_PER_PAIR % 2 !== 0
) {
  throw new Error('BS6_GAMES_PER_PAIR 必須是正偶數。')
}

const STANDARD_DECKS = [
  { color: 'red', choice: 'bs6-red-standard' },
  { color: 'yellow', choice: 'bs6-yellow-standard' },
  { color: 'green', choice: 'bs6-green-standard' },
  { color: 'blue', choice: 'bs6-blue-standard' },
  { color: 'purple', choice: 'bs6-purple-standard' },
] as const satisfies readonly { color: string; choice: BuiltInDeckChoice }[]

const COMPETITIVE_DECKS = [
  { color: 'red', choice: 'bs6-red-competitive' },
  { color: 'yellow', choice: 'bs6-yellow-competitive' },
  { color: 'green', choice: 'bs6-green-competitive' },
  { color: 'blue', choice: 'bs6-blue-competitive' },
  { color: 'purple', choice: 'bs6-purple-competitive' },
] as const satisfies readonly { color: string; choice: BuiltInDeckChoice }[]

const DECKS = BENCHMARK_MODE === 'competitive' ? COMPETITIVE_DECKS : STANDARD_DECKS

type DeckColor = (typeof DECKS)[number]['color']

interface MatchBucket {
  games: number
  wins: number
  losses: number
  stuck: number
  totalTurns: number
  totalActions: number
  skillActivations: number
  refreshes: number
  reasons: Record<string, number>
  errors: string[]
}

interface MatchSummary extends MatchBucket {
  winRate: number
  completionRate: number
  avgTurns: number
  avgActions: number
  avgSkillActivations: number
  avgRefreshes: number
}

const createBucket = (): MatchBucket => ({
  games: 0,
  wins: 0,
  losses: 0,
  stuck: 0,
  totalTurns: 0,
  totalActions: 0,
  skillActivations: 0,
  refreshes: 0,
  reasons: {},
  errors: [],
})

const summarize = (bucket: MatchBucket): MatchSummary => ({
  ...bucket,
  winRate: bucket.games === 0 ? 0 : bucket.wins / bucket.games,
  completionRate:
    bucket.games === 0 ? 0 : (bucket.wins + bucket.losses) / bucket.games,
  avgTurns: bucket.games === 0 ? 0 : bucket.totalTurns / bucket.games,
  avgActions: bucket.games === 0 ? 0 : bucket.totalActions / bucket.games,
  avgSkillActivations:
    bucket.games === 0 ? 0 : bucket.skillActivations / bucket.games,
  avgRefreshes: bucket.games === 0 ? 0 : bucket.refreshes / bucket.games,
})

const recordMatch = (
  bucket: MatchBucket,
  result: ReturnType<typeof simulateAiMatchDetailed>,
  perspective: 'player-one' | 'player-two',
) => {
  bucket.games += 1
  bucket.totalTurns += result.state.turnNumber - 1
  bucket.totalActions += result.actions
  bucket.skillActivations += result.metrics.skillActivations
  bucket.refreshes += result.metrics.refreshes

  const reason = result.state.result?.reason ?? (result.error ? 'error' : 'unknown')
  bucket.reasons[reason] = (bucket.reasons[reason] ?? 0) + 1

  if (result.stuck || result.state.status !== 'finished') {
    bucket.stuck += 1
    if (result.error && !bucket.errors.includes(result.error)) {
      bucket.errors.push(result.error)
    }
    return
  }

  if (result.state.result?.winnerId === perspective) {
    bucket.wins += 1
  } else {
    bucket.losses += 1
  }
}

const validateDecks = () => {
  expectChoiceSet()
  for (const deck of DECKS) {
    const entries = OFFICIAL_DECK_RECIPES[deck.choice]
    const validation = validateCustomDeck(entries, { format: 'standard' })
    if (!validation.isValid || validation.stats.totalCards !== 60) {
      throw new Error(`${deck.choice} invalid: ${validation.errors.join('; ')}`)
    }
    if (createDeckForChoice(deck.choice, 'player-one').length !== 60) {
      throw new Error(`${deck.choice} did not create a 60-card runtime deck`)
    }
    if (
      BENCHMARK_MODE === 'standard' &&
      !entries.every((entry) => entry.cardNumber.startsWith('BS6-'))
    ) {
      throw new Error(`${deck.choice} contains a non-BS6 card`)
    }
    if (
      BENCHMARK_MODE === 'competitive' &&
      entries.some((entry) => entry.cardNumber === 'BS6-064')
    ) {
      throw new Error(`${deck.choice} contains banned card BS6-064`)
    }
  }
}

const expectChoiceSet = () => {
  const expectedChoices =
    BENCHMARK_MODE === 'competitive'
      ? BS6_COMPETITIVE_AI_PRESET_DECK_CHOICES
      : BS6_AI_PRESET_DECK_CHOICES
  if (expectedChoices.length !== DECKS.length) {
    throw new Error('BS6 preset choice list and benchmark matrix differ')
  }
}

const runMatrix = () => {
  const choices = new Map<DeckColor, BuiltInDeckChoice>(
    DECKS.map((deck) => [deck.color, deck.choice]),
  )
  const deckBuckets = Object.fromEntries(
    DECKS.map((deck) => [deck.color, createBucket()]),
  ) as Record<DeckColor, MatchBucket>
  const matchups = new Map<string, MatchBucket>()

  for (const [targetIndex, target] of DECKS.entries()) {
    for (const [opponentIndex, opponent] of DECKS.entries()) {
      const matchup = createBucket()
      matchups.set(`${target.color}-vs-${opponent.color}`, matchup)

      for (let gameIndex = 0; gameIndex < FIRST_PLAYER_SPLIT; gameIndex += 1) {
        const seed = MATRIX_SEED + targetIndex * 1000 + opponentIndex * 100 + gameIndex
        const result = simulateAiMatchDetailed(
          createDemoGame(seed, {
            player: choices.get(target.color)!,
            ai: choices.get(opponent.color)!,
          }),
          MAX_ACTIONS,
          { levels: { 'player-one': AI_LEVEL, 'player-two': AI_LEVEL }, seed },
        )
        recordMatch(matchup, result, 'player-one')
        recordMatch(deckBuckets[target.color], result, 'player-one')
      }

      for (let gameIndex = 0; gameIndex < FIRST_PLAYER_SPLIT; gameIndex += 1) {
        const seed =
          MATRIX_SEED +
          50000 +
          targetIndex * 1000 +
          opponentIndex * 100 +
          gameIndex
        const result = simulateAiMatchDetailed(
          createDemoGame(seed, {
            player: choices.get(opponent.color)!,
            ai: choices.get(target.color)!,
          }),
          MAX_ACTIONS,
          { levels: { 'player-one': AI_LEVEL, 'player-two': AI_LEVEL }, seed },
        )
        recordMatch(matchup, result, 'player-two')
        recordMatch(deckBuckets[target.color], result, 'player-two')
      }
    }
  }

  return {
    decks: Object.fromEntries(
      DECKS.map((deck) => [deck.color, summarize(deckBuckets[deck.color])]),
    ),
    matchups: Object.fromEntries(
      Array.from(matchups, ([key, bucket]) => [key, summarize(bucket)]),
    ),
  }
}

validateDecks()

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  format: 'standard',
  methodology: {
    benchmarkMode: BENCHMARK_MODE,
    description:
      `BS6 五色標準 preset 互相對戰；每個有向配對 ${GAMES_PER_PAIR} 場，含鏡像先後攻，共 ${DECKS.length * DECKS.length * GAMES_PER_PAIR} 場。`,
    colors: DECKS.map((deck) => deck.color),
    choices: Object.fromEntries(DECKS.map((deck) => [deck.color, deck.choice])),
    gamesPerPair: GAMES_PER_PAIR,
    totalGames: DECKS.length * DECKS.length * GAMES_PER_PAIR,
    sameColorMatchupsIncluded: true,
    aiLevel: AI_LEVEL,
    maxActions: MAX_ACTIONS,
    seed: MATRIX_SEED,
  },
  result: runMatrix(),
}

const outputPath = resolve(
  process.env.BS6_BENCHMARK_OUTPUT ??
    'data/decks/bs6-benchmark-report-100-standard.json',
)
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log(`BS6 ${BENCHMARK_MODE} deck benchmark completed: ${outputPath}`)
for (const deck of DECKS) {
  const summary = report.result.decks[deck.color] as MatchSummary
  console.log(
    `${deck.color}: ${summary.wins}/${summary.games} wins; ` +
      `completion ${(summary.completionRate * 100).toFixed(1)}%; ` +
      `stuck ${summary.stuck}; avg turns ${summary.avgTurns.toFixed(1)}`,
  )
}
