import { getCardPoolEntry } from './card-pool'
import { createCustomDeckFromRoster } from './tournament-deck'
import {
  createGame,
  forceMulliganOpeningHand,
  selectStartingCookie,
} from './setup'
import { createSeededRandom, createSeededShuffle } from './helpers'
import { simulateAiMatchDetailed } from './ai-detailed-sim'
import type { CustomDeck } from './custom-deck'
import type { AiDetailedResult } from './ai/types'
import type { GameState, PlayerId } from './types'

export type TournamentColor = 'red' | 'yellow' | 'green' | 'blue' | 'purple'

export interface SwissRosterDeck extends CustomDeck {
  color: TournamentColor
  seedChoice?: string
  generation?: number
  profile?: {
    bs6Cards: number
    bs5Cards: number
    legacyCards: number
  }
}
export interface SwissTournamentProgress {
  round: number
  rounds: number
  completedMatches: number
  totalMatches: number
  currentMatch?: string
}

export interface SwissMatchRecord {
  round: number
  table: number
  firstPlayerId: PlayerId
  playerOneDeckId: string
  playerTwoDeckId: string
  winnerDeckId: string | null
  loserDeckId: string | null
  result: 'win' | 'draw' | 'stuck'
  actions: number
  turns: number
  reason: string | null
  error: string | null
}

export interface SwissStanding {
  rank: number
  deckId: string
  name: string
  color: TournamentColor
  seedChoice?: string
  generation?: number
  points: number
  wins: number
  losses: number
  draws: number
  games: number
  buchholz: number
  stuckMatches: number
  entries?: SwissRosterDeck['entries']
}

export interface SwissColorSummary {
  color: TournamentColor
  deckCount: number
  averagePoints: number
  averageWinRate: number
  topDecks: SwissStanding[]
  topCards: Array<{
    cardNumber: string
    name: string
    series: string
    appearances: number
    copies: number
    averageCopies: number
  }>
}

export interface SwissTournamentReport {
  schemaVersion: 1
  status: 'PASS' | 'FAIL'
  generatedAt: string
  methodology: {
    rosterSize: number
    rounds: number
    totalMatches: number
    format: 'standard'
    aiLevel: 1 | 2 | 3 | 4
    maxActions: number
    seed: number
    browserRuntime: boolean
    pairing: string
    scoring: string
  }
  progress: SwissTournamentProgress
  metrics: {
    completedMatches: number
    stuckMatches: number
    averageActions: number
    averageTurns: number
  }
  standings: SwissStanding[]
  colors: SwissColorSummary[]
  matches: SwissMatchRecord[]
}

interface InternalStanding {
  deck: SwissRosterDeck
  drawOrder: number
  points: number
  wins: number
  losses: number
  draws: number
  buchholz: number
  stuckMatches: number
  opponents: Set<string>
}

export interface SwissTournamentOptions {
  rounds?: number
  seed?: number
  maxActions?: number
  aiLevel?: 1 | 2 | 3 | 4
  progressEvery?: number
  onProgress?: (
    progress: SwissTournamentProgress,
  ) => void | Promise<void>
}

const COLORS: TournamentColor[] = [
  'red',
  'yellow',
  'green',
  'blue',
  'purple',
]

const ensureOpeningCookie = (
  state: GameState,
  playerId: PlayerId,
  shuffle: ReturnType<typeof createSeededShuffle>,
): GameState => {
  let nextState = state
  let attempts = 0
  while (
    !nextState.players[playerId].hand.some((card) => card.type === 'cookie') &&
    attempts < 100
  ) {
    nextState = forceMulliganOpeningHand(nextState, playerId, shuffle)
    attempts += 1
  }
  if (attempts >= 100) {
    throw new Error(`無法替 ${playerId} 取得含餅乾的起始手牌。`)
  }
  return nextState
}

/**
 * 建立兩副自訂牌組的完整開局狀態，供 Swiss Browser harness 與純規則
 * benchmark 共用。開局處理沿用正式的強制調度與起始餅乾規則。
 */
export const createCustomDeckMatch = (
  seed: number,
  playerOneDeck: SwissRosterDeck,
  playerTwoDeck: SwissRosterDeck,
  firstPlayerId: PlayerId = 'player-one',
): GameState => {
  const stateShuffle = createSeededShuffle(seed)
  const initialState = createGame(
    {
      id: 'player-one',
      name: playerOneDeck.name,
      deck: createCustomDeckFromRoster(playerOneDeck, 'player-one'),
    },
    {
      id: 'player-two',
      name: playerTwoDeck.name,
      deck: createCustomDeckFromRoster(playerTwoDeck, 'player-two'),
    },
    firstPlayerId,
    stateShuffle,
  )

  const openingShuffle = createSeededShuffle(seed ^ 0x5f3759df)
  let state = ensureOpeningCookie(initialState, 'player-one', openingShuffle)
  state = ensureOpeningCookie(state, 'player-two', openingShuffle)

  const playerOneCookie = state.players['player-one'].hand.find(
    (card) => card.type === 'cookie',
  )
  const playerTwoCookie = state.players['player-two'].hand.find(
    (card) => card.type === 'cookie',
  )
  if (!playerOneCookie || !playerTwoCookie) {
    throw new Error('Swiss 開局找不到可用的起始餅乾。')
  }

  state = selectStartingCookie(state, 'player-one', playerOneCookie.instanceId)
  return selectStartingCookie(state, 'player-two', playerTwoCookie.instanceId)
}

const hasPlayed = (left: InternalStanding, right: InternalStanding): boolean =>
  left.opponents.has(right.deck.id) || right.opponents.has(left.deck.id)

const buildPairings = (
  standings: InternalStanding[],
  round: number,
): Array<[InternalStanding, InternalStanding]> => {
  const groups = new Map<number, InternalStanding[]>()
  for (const standing of standings) {
    const group = groups.get(standing.points) ?? []
    group.push(standing)
    groups.set(standing.points, group)
  }

  const pointsDescending = [...groups.keys()].sort((a, b) => b - a)
  const pairings: Array<[InternalStanding, InternalStanding]> = []
  let carry: InternalStanding | null = null

  for (const points of pointsDescending) {
    const group = [...(groups.get(points) ?? [])]
    if (carry) group.unshift(carry)
    carry = null
    group.sort((left, right) => {
      if (left.points !== right.points) return right.points - left.points
      return left.drawOrder - right.drawOrder
    })

    if (group.length % 2 === 1) carry = group.pop() ?? null

    while (group.length >= 2) {
      const first = group.shift()!
      let candidateIndex = group.findIndex(
        (candidate) => !hasPlayed(first, candidate),
      )
      if (candidateIndex < 0) candidateIndex = 0
      const [second] = group.splice(candidateIndex, 1)
      pairings.push([first, second])
    }
  }

  if (carry) {
    throw new Error(`第 ${round} 輪產生未配對牌組：${carry.deck.id}`)
  }
  return pairings
}

const sortStandings = (standings: InternalStanding[]): InternalStanding[] =>
  [...standings].sort((left, right) => {
    if (right.points !== left.points) return right.points - left.points
    if (right.buchholz !== left.buchholz) {
      return right.buchholz - left.buchholz
    }
    const leftWinRate = (left.wins + left.draws / 2) / Math.max(1, left.opponents.size)
    const rightWinRate = (right.wins + right.draws / 2) / Math.max(1, right.opponents.size)
    if (rightWinRate !== leftWinRate) return rightWinRate - leftWinRate
    return left.drawOrder - right.drawOrder
  })

const toStanding = (
  standing: InternalStanding,
  rank: number,
  includeEntries = false,
): SwissStanding => ({
  rank,
  deckId: standing.deck.id,
  name: standing.deck.name,
  color: standing.deck.color,
  seedChoice: standing.deck.seedChoice,
  generation: standing.deck.generation,
  points: standing.points,
  wins: standing.wins,
  losses: standing.losses,
  draws: standing.draws,
  games: standing.opponents.size,
  buchholz: standing.buchholz,
  stuckMatches: standing.stuckMatches,
  ...(includeEntries ? { entries: standing.deck.entries } : {}),
})

const buildColorSummaries = (
  sortedStandings: InternalStanding[],
): SwissColorSummary[] =>
  COLORS.map((color) => {
    const colorStandings = sortedStandings.filter(
      (standing) => standing.deck.color === color,
    )
    const topDecks = colorStandings
      .slice(0, 8)
      .map((standing, index) => toStanding(standing, index + 1, true))
    const cardStats = new Map<
      string,
      { name: string; appearances: number; copies: number }
    >()
    for (const standing of colorStandings.slice(0, 8)) {
      for (const entry of standing.deck.entries) {
        const card = getCardPoolEntry(entry.cardNumber)
        const current = cardStats.get(entry.cardNumber) ?? {
          name: card?.name ?? entry.cardNumber,
          appearances: 0,
          copies: 0,
        }
        current.appearances += 1
        current.copies += entry.count
        cardStats.set(entry.cardNumber, current)
      }
    }
    const topCards = [...cardStats.entries()]
      .sort((left, right) => {
        if (right[1].appearances !== left[1].appearances) {
          return right[1].appearances - left[1].appearances
        }
        return right[1].copies - left[1].copies
      })
      .slice(0, 20)
      .map(([cardNumber, stats]) => ({
        cardNumber,
        name: stats.name,
        series: cardNumber.match(/^BS[1-6]/)?.[0] ?? 'other',
        appearances: stats.appearances,
        copies: stats.copies,
        averageCopies: stats.copies / Math.max(1, stats.appearances),
      }))
    const games = colorStandings.reduce(
      (sum, standing) => sum + standing.opponents.size,
      0,
    )
    const wins = colorStandings.reduce((sum, standing) => sum + standing.wins, 0)
    return {
      color,
      deckCount: colorStandings.length,
      averagePoints:
        colorStandings.reduce((sum, standing) => sum + standing.points, 0) /
        Math.max(1, colorStandings.length),
      averageWinRate: wins / Math.max(1, games),
      topDecks,
      topCards,
    }
  })

export const runSwissTournament = async (
  decks: SwissRosterDeck[],
  options: SwissTournamentOptions = {},
): Promise<SwissTournamentReport> => {
  const rounds = options.rounds ?? 9
  const seed = options.seed ?? 20260813
  const maxActions = options.maxActions ?? 2500
  const aiLevel = options.aiLevel ?? 4
  const totalMatches = Math.floor(decks.length / 2) * rounds
  if (decks.length < 2 || decks.length % 2 !== 0) {
    throw new Error('Swiss 牌組數量必須是大於 1 的偶數。')
  }

  const drawRandom = createSeededRandom(seed)
  const standings = decks.map((deck) => ({
    deck,
    drawOrder: Math.floor(drawRandom() * 1_000_000_000),
    points: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    buchholz: 0,
    stuckMatches: 0,
    opponents: new Set<string>(),
  }))
  const standingById = new Map(standings.map((standing) => [standing.deck.id, standing]))
  const matches: SwissMatchRecord[] = []
  let completedMatches = 0
  let stuckMatches = 0
  let totalActions = 0
  let totalTurns = 0
  const progressEvery = Math.max(1, options.progressEvery ?? 16)

  for (let round = 1; round <= rounds; round += 1) {
    const pairings = buildPairings(standings, round)
    for (const [tableIndex, [left, right]] of pairings.entries()) {
      const firstPlayerId: PlayerId =
        (round + tableIndex) % 2 === 0 ? 'player-one' : 'player-two'
      const matchSeed = seed + round * 1_000_000 + tableIndex
      let result: AiDetailedResult | null = null
      let error: string | null = null
      try {
        result = simulateAiMatchDetailed(
          createCustomDeckMatch(matchSeed, left.deck, right.deck, firstPlayerId),
          maxActions,
          {
            levels: {
              'player-one': aiLevel,
              'player-two': aiLevel,
            },
            seed: matchSeed,
          },
        )
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught)
      }

      left.opponents.add(right.deck.id)
      right.opponents.add(left.deck.id)
      const winnerPlayer = result?.endInfo.winner ?? null
      const isStuck = Boolean(error) || Boolean(result?.stuck) || !winnerPlayer
      if (isStuck) {
        stuckMatches += 1
        left.stuckMatches += 1
        right.stuckMatches += 1
        left.draws += 1
        right.draws += 1
        left.points += 1
        right.points += 1
      } else if (winnerPlayer === 'player-one') {
        left.wins += 1
        left.points += 3
        right.losses += 1
      } else {
        right.wins += 1
        right.points += 3
        left.losses += 1
      }

      const winnerDeckId =
        winnerPlayer === 'player-one'
          ? left.deck.id
          : winnerPlayer === 'player-two'
            ? right.deck.id
            : null
      const loserDeckId =
        winnerPlayer === 'player-one'
          ? right.deck.id
          : winnerPlayer === 'player-two'
            ? left.deck.id
            : null
      const matchResult: SwissMatchRecord['result'] = isStuck
        ? 'stuck'
        : winnerPlayer
          ? 'win'
          : 'draw'
      const actions = result?.actions ?? 0
      const turns = result?.endInfo
        ? result.state.turnNumber - 1
        : 0
      totalActions += actions
      totalTurns += turns
      if (!isStuck) completedMatches += 1
      matches.push({
        round,
        table: tableIndex + 1,
        firstPlayerId,
        playerOneDeckId: left.deck.id,
        playerTwoDeckId: right.deck.id,
        winnerDeckId,
        loserDeckId,
        result: matchResult,
        actions,
        turns,
        reason: result?.endInfo.reason ?? null,
        error: error ?? result?.error ?? null,
      })

      if (
        options.onProgress &&
        (matches.length % progressEvery === 0 || matches.length === totalMatches)
      ) {
        await options.onProgress({
          round,
          rounds,
          completedMatches: matches.length,
          totalMatches,
          currentMatch: `${left.deck.name} vs ${right.deck.name}`,
        })
      }
      if (options.onProgress && matches.length % progressEvery === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
    }

    for (const standing of standings) {
      standing.buchholz = [...standing.opponents].reduce(
        (sum, opponentId) => sum + (standingById.get(opponentId)?.points ?? 0),
        0,
      )
    }
  }

  const sortedStandings = sortStandings(standings)
  const finalStandings = sortedStandings.map((standing, index) =>
    toStanding(standing, index + 1),
  )
  const reportProgress: SwissTournamentProgress = {
    round: rounds,
    rounds,
    completedMatches: matches.length,
    totalMatches,
  }
  return {
    schemaVersion: 1,
    status: stuckMatches === 0 && completedMatches === totalMatches ? 'PASS' : 'FAIL',
    generatedAt: new Date().toISOString(),
    methodology: {
      rosterSize: decks.length,
      rounds,
      totalMatches,
      format: 'standard',
      aiLevel,
      maxActions,
      seed,
      browserRuntime: typeof window !== 'undefined',
      pairing: '依積分分組、跨組浮動奇數組，優先避免重賽；同分以 deterministic seed 排序。',
      scoring: '勝 3 分、敗 0 分、卡住／無法完成以技術和各 1 分並標記 FAIL。',
    },
    progress: reportProgress,
    metrics: {
      completedMatches,
      stuckMatches,
      averageActions: totalActions / Math.max(1, matches.length),
      averageTurns: totalTurns / Math.max(1, matches.length),
    },
    standings: finalStandings,
    colors: buildColorSummaries(sortedStandings),
    matches,
  }
}
