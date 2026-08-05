import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  BS4_AI_PRESET_DECK_CHOICES,
  createDeckForChoice,
  createDemoGame,
  OFFICIAL_DECK_RECIPES,
  simulateAiMatchDetailed,
  validateCustomDeck,
  type BuiltInDeckChoice,
} from '../src/game/index'

const MATRIX_SEED = 20260803
const GAMES_PER_PAIR = Number(process.env.BS4_GAMES_PER_PAIR ?? 6)
const FIRST_PLAYER_SPLIT = GAMES_PER_PAIR / 2
const MAX_ACTIONS = 2500
const AI_LEVEL = 4

if (!Number.isInteger(GAMES_PER_PAIR) || GAMES_PER_PAIR <= 0 || GAMES_PER_PAIR % 2 !== 0) {
  throw new Error('BS4_GAMES_PER_PAIR 必須是正偶數。')
}

const DECKS = [
  {
    color: 'red',
    baseline: 'bs3-red-pitaya',
    final: 'bs4-red-fire-spirit',
  },
  {
    color: 'yellow',
    baseline: 'bs3-yellow-counter',
    final: 'bs4-yellow-millennial',
  },
  {
    color: 'green',
    baseline: 'bs3-green-lily',
    final: 'bs4-green-wind-archer',
  },
  {
    color: 'blue',
    baseline: 'bs3-blue-sorbet',
    final: 'bs4-blue-abyss',
  },
  {
    color: 'purple',
    baseline: 'bs3-purple-dark-cacao',
    final: 'bs4-purple-moonlight',
  },
] as const

type DeckColor = (typeof DECKS)[number]['color']
type Variant = 'baseline' | 'final'

interface MatchBucket {
  games: number
  wins: number
  losses: number
  stuck: number
  totalTurns: number
  totalBreakLevel: number
  errors: string[]
}

interface MatchSummary extends Omit<MatchBucket, 'errors'> {
  winRate: number
  completionRate: number
  avgTurns: number
  avgBreakLevel: number
  errors: string[]
}

interface VariantReport {
  decks: Record<DeckColor, MatchSummary>
  matchups: Record<string, MatchSummary>
}

const createBucket = (): MatchBucket => ({
  games: 0,
  wins: 0,
  losses: 0,
  stuck: 0,
  totalTurns: 0,
  totalBreakLevel: 0,
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
  avgBreakLevel:
    bucket.games === 0 ? 0 : bucket.totalBreakLevel / bucket.games,
  errors: bucket.errors,
})

const recordMatch = (
  bucket: MatchBucket,
  result: ReturnType<typeof simulateAiMatchDetailed>,
  perspective: 'player-one' | 'player-two',
) => {
  bucket.games += 1
  bucket.totalTurns += result.state.turnNumber - 1
  bucket.totalBreakLevel += result.state.players[perspective].breakArea.reduce(
    (sum, card) => sum + card.level,
    0,
  )

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

const runVariant = (variant: Variant): VariantReport => {
  const choices = new Map<DeckColor, BuiltInDeckChoice>(
    DECKS.map((deck) => [deck.color, deck[variant]]),
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

const validateDecks = () => {
  for (const choice of BS4_AI_PRESET_DECK_CHOICES) {
    const validation = validateCustomDeck(OFFICIAL_DECK_RECIPES[choice])
    if (!validation.isValid) {
      throw new Error(
        `${choice} invalid: ${validation.errors.join('; ')}`,
      )
    }
    if (createDeckForChoice(choice, 'player-one').length !== 60) {
      throw new Error(`${choice} did not create a 60-card runtime deck`)
    }
  }
}

validateDecks()

const report = {
  schemaVersion: 1,
  methodology: {
    description:
      `以 BS3 五色 preset 為基準，五色 BS4 preset 互相對戰；每色對五個對手各 ${GAMES_PER_PAIR} 場，共 ${DECKS.length * GAMES_PER_PAIR} 場。每組 ${FIRST_PLAYER_SPLIT} 場由目標牌組先手、${FIRST_PLAYER_SPLIT} 場交換先手。`,
    colors: DECKS.map((deck) => deck.color),
    gamesPerDeck: DECKS.length * GAMES_PER_PAIR,
    gamesPerPair: GAMES_PER_PAIR,
    firstPlayerSplit: FIRST_PLAYER_SPLIT,
    aiLevel: AI_LEVEL,
    maxActions: MAX_ACTIONS,
    seed: MATRIX_SEED,
    baselineChoices: Object.fromEntries(
      DECKS.map((deck) => [deck.color, deck.baseline]),
    ),
    finalChoices: Object.fromEntries(
      DECKS.map((deck) => [deck.color, deck.final]),
    ),
  },
  baseline: runVariant('baseline'),
  final: runVariant('final'),
}

const outputPath = resolve(
  process.env.BS4_BENCHMARK_OUTPUT ?? 'data/decks/bs4-benchmark-report.json',
)
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log(`BS4 deck benchmark completed: ${outputPath}`)
for (const deck of DECKS) {
  const before = report.baseline.decks[deck.color]
  const after = report.final.decks[deck.color]
  console.log(
    `${deck.color}: ${before.wins}/${before.games} -> ${after.wins}/${after.games} wins; ` +
      `stuck ${before.stuck} -> ${after.stuck}; ` +
      `win rate ${(before.winRate * 100).toFixed(1)}% -> ${(after.winRate * 100).toFixed(1)}%`,
  )
}
