import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  BS6_COMPETITIVE_AI_PRESET_DECK_CHOICES,
  createDeckForChoice,
  createDemoGame,
  OFFICIAL_DECK_RECIPES,
  simulateAiMatchDetailed,
  validateCustomDeck,
  type BuiltInDeckChoice,
} from '../src/game/index'

const MATRIX_SEED = Number(process.env.BS6_COMPETITIVE_ROUND_ROBIN_SEED ?? 20260814)
const GAMES_PER_MATCHUP = Number(
  process.env.BS6_COMPETITIVE_GAMES_PER_MATCHUP ?? 5,
)
const MAX_ACTIONS = 2500
const AI_LEVEL = 4

if (!Number.isInteger(GAMES_PER_MATCHUP) || GAMES_PER_MATCHUP <= 0) {
  throw new Error('BS6_COMPETITIVE_GAMES_PER_MATCHUP 必須是正整數。')
}

const DECKS = [
  { color: 'red', choice: 'bs6-red-competitive' },
  { color: 'yellow', choice: 'bs6-yellow-competitive' },
  { color: 'green', choice: 'bs6-green-competitive' },
  { color: 'blue', choice: 'bs6-blue-competitive' },
  { color: 'purple', choice: 'bs6-purple-competitive' },
] as const satisfies readonly { color: string; choice: BuiltInDeckChoice }[]

type DeckColor = (typeof DECKS)[number]['color']
type AiResult = ReturnType<typeof simulateAiMatchDetailed>

interface DeckBucket {
  games: number
  wins: number
  losses: number
  stuck: number
  totalActions: number
  totalTurns: number
  skillActivations: number
  refreshes: number
  reasons: Record<string, number>
  errors: string[]
}

interface DeckSummary extends DeckBucket {
  winRate: number
  completionRate: number
  avgActions: number
  avgTurns: number
  avgSkillActivations: number
  avgRefreshes: number
}

interface MatchupBucket {
  games: number
  leftWins: number
  rightWins: number
  stuck: number
  totalActions: number
  totalTurns: number
  reasons: Record<string, number>
  errors: string[]
}

interface MatchupSummary extends MatchupBucket {
  leftWinRate: number
  rightWinRate: number
  completionRate: number
  avgActions: number
  avgTurns: number
}

const createDeckBucket = (): DeckBucket => ({
  games: 0,
  wins: 0,
  losses: 0,
  stuck: 0,
  totalActions: 0,
  totalTurns: 0,
  skillActivations: 0,
  refreshes: 0,
  reasons: {},
  errors: [],
})

const createMatchupBucket = (): MatchupBucket => ({
  games: 0,
  leftWins: 0,
  rightWins: 0,
  stuck: 0,
  totalActions: 0,
  totalTurns: 0,
  reasons: {},
  errors: [],
})

const resultReason = (result: AiResult): string =>
  result.state.result?.reason ?? result.error ?? 'unknown'

const addResultMetadata = (
  bucket: Pick<
    DeckBucket,
    | 'games'
    | 'totalActions'
    | 'totalTurns'
    | 'skillActivations'
    | 'refreshes'
    | 'reasons'
    | 'errors'
  >,
  result: AiResult,
) => {
  bucket.games += 1
  bucket.totalActions += result.actions
  bucket.totalTurns += result.state.turnNumber - 1
  bucket.skillActivations += result.metrics.skillActivations
  bucket.refreshes += result.metrics.refreshes
  const reason = resultReason(result)
  bucket.reasons[reason] = (bucket.reasons[reason] ?? 0) + 1
  if (result.error && !bucket.errors.includes(result.error)) {
    bucket.errors.push(result.error)
  }
}

const recordDeckResult = (
  bucket: DeckBucket,
  result: AiResult,
  perspective: 'player-one' | 'player-two',
) => {
  addResultMetadata(bucket, result)
  if (result.stuck || result.state.status !== 'finished') {
    bucket.stuck += 1
    return
  }
  if (result.state.result?.winnerId === perspective) {
    bucket.wins += 1
  } else {
    bucket.losses += 1
  }
}

const summarizeDeck = (bucket: DeckBucket): DeckSummary => ({
  ...bucket,
  winRate: bucket.games === 0 ? 0 : bucket.wins / bucket.games,
  completionRate:
    bucket.games === 0 ? 0 : (bucket.wins + bucket.losses) / bucket.games,
  avgActions: bucket.games === 0 ? 0 : bucket.totalActions / bucket.games,
  avgTurns: bucket.games === 0 ? 0 : bucket.totalTurns / bucket.games,
  avgSkillActivations:
    bucket.games === 0 ? 0 : bucket.skillActivations / bucket.games,
  avgRefreshes: bucket.games === 0 ? 0 : bucket.refreshes / bucket.games,
})

const summarizeMatchup = (bucket: MatchupBucket): MatchupSummary => ({
  ...bucket,
  leftWinRate: bucket.games === 0 ? 0 : bucket.leftWins / bucket.games,
  rightWinRate: bucket.games === 0 ? 0 : bucket.rightWins / bucket.games,
  completionRate:
    bucket.games === 0
      ? 0
      : (bucket.leftWins + bucket.rightWins) / bucket.games,
  avgActions: bucket.games === 0 ? 0 : bucket.totalActions / bucket.games,
  avgTurns: bucket.games === 0 ? 0 : bucket.totalTurns / bucket.games,
})

const validateDecks = () => {
  if (BS6_COMPETITIVE_AI_PRESET_DECK_CHOICES.length !== DECKS.length) {
    throw new Error('競技牌組 choice 清單與 round-robin 清單不一致。')
  }

  for (const deck of DECKS) {
    const entries = OFFICIAL_DECK_RECIPES[deck.choice]
    const validation = validateCustomDeck(entries, { format: 'standard' })
    if (!validation.isValid || validation.stats.totalCards !== 60) {
      throw new Error(`${deck.choice} invalid: ${validation.errors.join('; ')}`)
    }
    if (createDeckForChoice(deck.choice, 'player-one').length !== 60) {
      throw new Error(`${deck.choice} 無法建立 60 張 runtime 牌組。`)
    }
  }
}

const runRoundRobin = () => {
  const deckBuckets = Object.fromEntries(
    DECKS.map((deck) => [deck.color, createDeckBucket()]),
  ) as Record<DeckColor, DeckBucket>
  const matchups: Record<string, MatchupSummary> = {}

  for (let leftIndex = 0; leftIndex < DECKS.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < DECKS.length;
      rightIndex += 1
    ) {
      const left = DECKS[leftIndex]
      const right = DECKS[rightIndex]
      const bucket = createMatchupBucket()

      for (let gameIndex = 0; gameIndex < GAMES_PER_MATCHUP; gameIndex += 1) {
        const leftIsFirst = gameIndex % 2 === 0
        const playerChoice = leftIsFirst ? left.choice : right.choice
        const aiChoice = leftIsFirst ? right.choice : left.choice
        const seed =
          MATRIX_SEED + leftIndex * 10_000 + rightIndex * 1_000 + gameIndex
        const result = simulateAiMatchDetailed(
          createDemoGame(seed, { player: playerChoice, ai: aiChoice }),
          MAX_ACTIONS,
          { levels: { 'player-one': AI_LEVEL, 'player-two': AI_LEVEL }, seed },
        )

        bucket.games += 1
        bucket.totalActions += result.actions
        bucket.totalTurns += result.state.turnNumber - 1
        const reason = resultReason(result)
        bucket.reasons[reason] = (bucket.reasons[reason] ?? 0) + 1
        if (result.error && !bucket.errors.includes(result.error)) {
          bucket.errors.push(result.error)
        }

        const leftPerspective = leftIsFirst ? 'player-one' : 'player-two'
        const rightPerspective = leftIsFirst ? 'player-two' : 'player-one'
        recordDeckResult(deckBuckets[left.color], result, leftPerspective)
        recordDeckResult(deckBuckets[right.color], result, rightPerspective)

        if (result.stuck || result.state.status !== 'finished') {
          bucket.stuck += 1
        } else if (result.state.result?.winnerId === leftPerspective) {
          bucket.leftWins += 1
        } else {
          bucket.rightWins += 1
        }
      }

      matchups[`${left.color}-vs-${right.color}`] = summarizeMatchup(bucket)
    }
  }

  return {
    decks: Object.fromEntries(
      DECKS.map((deck) => [deck.color, summarizeDeck(deckBuckets[deck.color])]),
    ),
    matchups,
  }
}

validateDecks()

const result = runRoundRobin()
const totalGames = (DECKS.length * (DECKS.length - 1) * GAMES_PER_MATCHUP) / 2
const outputPath = resolve(
  process.env.BS6_COMPETITIVE_ROUND_ROBIN_OUTPUT ??
    'data/decks/bs6-competitive-round-robin-report-50.json',
)
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  methodology: {
    description:
      '五副使用者提供的 BS6 競技環境牌組兩兩對戰；每組 5 場，左右牌組輪替先攻。',
    colors: DECKS.map((deck) => deck.color),
    choices: Object.fromEntries(DECKS.map((deck) => [deck.color, deck.choice])),
    gamesPerMatchup: GAMES_PER_MATCHUP,
    totalGames,
    sameColorMatchupsIncluded: false,
    firstPlayerPolicy:
      '每組第 1、3、5 場由左方先攻；第 2、4 場由右方先攻。',
    aiLevel: AI_LEVEL,
    maxActions: MAX_ACTIONS,
    seed: MATRIX_SEED,
  },
  result,
}

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log(`BS6 competitive ${totalGames}-game round-robin completed: ${outputPath}`)
for (const deck of DECKS) {
  const summary = result.decks[deck.color] as DeckSummary
  console.log(
    `${deck.color}: ${summary.wins}/${summary.games} wins; ` +
      `completion ${(summary.completionRate * 100).toFixed(1)}%; ` +
      `stuck ${summary.stuck}; avg turns ${summary.avgTurns.toFixed(1)}`,
  )
}
