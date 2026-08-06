import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  createDeckForChoice,
  createDemoGame,
  OFFICIAL_DECK_RECIPES,
  simulateAiMatchDetailed,
  validateCustomDeck,
  type BuiltInDeckChoice,
} from '../src/game/index'

const MATRIX_SEED = Number(process.env.BS5_BENCHMARK_SEED ?? 20260806)
const GAMES_PER_PAIR = Number(process.env.BS5_GAMES_PER_PAIR ?? 8)
const FIRST_PLAYER_SPLIT = GAMES_PER_PAIR / 2
const MAX_ACTIONS = 2500
const AI_LEVEL = 4

if (!Number.isInteger(GAMES_PER_PAIR) || GAMES_PER_PAIR <= 0 || GAMES_PER_PAIR % 2 !== 0) {
  throw new Error('BS5_GAMES_PER_PAIR 必須是正偶數。')
}

const DECKS = [
  { color: 'red', choice: 'bs5-red-standard' },
  { color: 'yellow', choice: 'bs5-yellow-standard' },
  { color: 'green', choice: 'bs5-green-standard' },
  { color: 'blue', choice: 'bs5-blue-standard' },
  { color: 'purple', choice: 'bs5-purple-standard' },
] as const satisfies readonly { color: string; choice: BuiltInDeckChoice }[]

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
  maxNoProgressTurns: number
  totalBreakLevel: number
  reasons: Record<string, number>
  errors: string[]
}

interface MatchSummary extends Omit<MatchBucket, 'errors'> {
  winRate: number
  completionRate: number
  avgTurns: number
  avgActions: number
  avgSkillActivations: number
  avgRefreshes: number
  avgBreakLevel: number
  errors: string[]
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
  maxNoProgressTurns: 0,
  totalBreakLevel: 0,
  reasons: {},
  errors: [],
})

const summarize = (bucket: MatchBucket): MatchSummary => ({
  games: bucket.games,
  wins: bucket.wins,
  losses: bucket.losses,
  stuck: bucket.stuck,
  winRate: bucket.games === 0 ? 0 : bucket.wins / bucket.games,
  completionRate:
    bucket.games === 0 ? 0 : (bucket.wins + bucket.losses) / bucket.games,
  avgTurns: bucket.games === 0 ? 0 : bucket.totalTurns / bucket.games,
  avgActions: bucket.games === 0 ? 0 : bucket.totalActions / bucket.games,
  avgSkillActivations:
    bucket.games === 0 ? 0 : bucket.skillActivations / bucket.games,
  avgRefreshes: bucket.games === 0 ? 0 : bucket.refreshes / bucket.games,
  avgBreakLevel:
    bucket.games === 0 ? 0 : bucket.totalBreakLevel / bucket.games,
  totalActions: bucket.totalActions,
  skillActivations: bucket.skillActivations,
  refreshes: bucket.refreshes,
  maxNoProgressTurns: bucket.maxNoProgressTurns,
  totalBreakLevel: bucket.totalBreakLevel,
  reasons: bucket.reasons,
  errors: bucket.errors,
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
  bucket.maxNoProgressTurns = Math.max(
    bucket.maxNoProgressTurns,
    result.turnProgression.consecutiveNoProgressMax,
  )
  bucket.totalBreakLevel += result.state.players[perspective].breakArea.reduce(
    (sum, card) => sum + card.level,
    0,
  )

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
  for (const deck of DECKS) {
    const entries = OFFICIAL_DECK_RECIPES[deck.choice]
    const validation = validateCustomDeck(entries, { format: 'standard' })
    if (!validation.isValid) {
      throw new Error(`${deck.choice} invalid: ${validation.errors.join('; ')}`)
    }
    if (validation.stats.totalCards !== 60) {
      throw new Error(`${deck.choice} is not a 60-card deck`)
    }
    if (createDeckForChoice(deck.choice, 'player-one').length !== 60) {
      throw new Error(`${deck.choice} did not create a 60-card runtime deck`)
    }
    if (!entries.every((entry) => entry.cardNumber.startsWith('BS5-'))) {
      throw new Error(`${deck.choice} contains a non-BS5 card`)
    }
  }
}

const runMatrix = () => {
  const choices = new Map<DeckColor, BuiltInDeckChoice>(
    DECKS.map((deck) => [deck.color, deck.choice]),
  )
  const decks = Object.fromEntries(
    DECKS.map((deck) => [deck.color, createBucket()]),
  ) as Record<DeckColor, MatchBucket>
  const matchups = new Map<string, MatchBucket>()

  for (const [targetIndex, target] of DECKS.entries()) {
    for (const [opponentIndex, opponent] of DECKS.entries()) {
      const key = `${target.color}-vs-${opponent.color}`
      const matchup = createBucket()
      matchups.set(key, matchup)

      for (let gameIndex = 0; gameIndex < FIRST_PLAYER_SPLIT; gameIndex += 1) {
        const seed =
          MATRIX_SEED +
          targetIndex * 1000 +
          opponentIndex * 100 +
          gameIndex
        const result = simulateAiMatchDetailed(
          createDemoGame(seed, {
            player: choices.get(target.color)!,
            ai: choices.get(opponent.color)!,
          }),
          MAX_ACTIONS,
          {
            levels: { 'player-one': AI_LEVEL, 'player-two': AI_LEVEL },
            seed,
          },
        )
        recordMatch(matchup, result, 'player-one')
        recordMatch(decks[target.color], result, 'player-one')
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
          {
            levels: { 'player-one': AI_LEVEL, 'player-two': AI_LEVEL },
            seed,
          },
        )
        recordMatch(matchup, result, 'player-two')
        recordMatch(decks[target.color], result, 'player-two')
      }
    }
  }

  return {
    decks: Object.fromEntries(
      DECKS.map((deck) => [deck.color, summarize(decks[deck.color])]),
    ) as Record<DeckColor, MatchSummary>,
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
    description:
      `BS5 五色標準 preset 互相對戰；每色對五個對手各 ${GAMES_PER_PAIR} 場，共 ${DECKS.length * GAMES_PER_PAIR} 場。每組 ${FIRST_PLAYER_SPLIT} 場由目標牌組先手、${FIRST_PLAYER_SPLIT} 場交換先手。`,
    colors: DECKS.map((deck) => deck.color),
    choices: Object.fromEntries(
      DECKS.map((deck) => [deck.color, deck.choice]),
    ),
    gamesPerDeck: DECKS.length * GAMES_PER_PAIR,
    gamesPerPair: GAMES_PER_PAIR,
    totalGames: DECKS.length * DECKS.length * GAMES_PER_PAIR,
    firstPlayerSplit: FIRST_PLAYER_SPLIT,
    sameColorMatchupsIncluded: true,
    aiLevel: AI_LEVEL,
    maxActions: MAX_ACTIONS,
    seed: MATRIX_SEED,
  },
  result: runMatrix(),
}

const outputPath = resolve(
  process.env.BS5_BENCHMARK_OUTPUT ?? 'data/decks/bs5-benchmark-report-40-standard.json',
)
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log(`BS5 standard deck benchmark completed: ${outputPath}`)
for (const deck of DECKS) {
  const summary = report.result.decks[deck.color]
  console.log(
    `${deck.color}: ${summary.wins}/${summary.games} wins; ` +
      `completion ${(summary.completionRate * 100).toFixed(1)}%; ` +
      `stuck ${summary.stuck}; ` +
      `avg turns ${summary.avgTurns.toFixed(1)}`,
  )
}
