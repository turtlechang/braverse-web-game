import { createDemoGame, simulateAiMatch } from '.'

const MATCH_COUNT = 50
const MAX_ACTIONS = 2500

interface MatchResult {
  seed: number
  winner: 'player-one' | 'player-two' | null
  reason: string | null
  turnNumber: number
  actions: number
  stuck: boolean
  error: string | null
}

const runMatches = (): MatchResult[] => {
  const results: MatchResult[] = []

  for (let seed = 1; seed <= MATCH_COUNT; seed++) {
    const state = createDemoGame(seed, { player: 'bs2-red', ai: 'bs2-yellow' })
    const result = simulateAiMatch(state, MAX_ACTIONS)

    results.push({
      seed,
      winner: result.state.result?.winnerId ?? null,
      reason: result.state.result?.reason ?? null,
      turnNumber: result.state.turnNumber,
      actions: result.actions,
      stuck: result.stuck,
      error: result.error,
    })
  }

  return results
}

const analyzeResults = (results: MatchResult[]) => {
  const playerWins = results.filter((r) => r.winner === 'player-one').length
  const aiWins = results.filter((r) => r.winner === 'player-two').length
  const draws = results.filter((r) => r.winner === null).length
  const stuckGames = results.filter((r) => r.stuck).length
  const avgTurns =
    results.filter((r) => !r.stuck).reduce((sum, r) => sum + r.turnNumber, 0) /
    (results.length - stuckGames)

  console.log('=== BS2 Red vs BS2 Yellow 50-Match Test ===')
  console.log(`Player (BS2 Red) Wins: ${playerWins} (${((playerWins / MATCH_COUNT) * 100).toFixed(1)}%)`)
  console.log(`AI (BS2 Yellow) Wins: ${aiWins} (${((aiWins / MATCH_COUNT) * 100).toFixed(1)}%)`)
  console.log(`Draws: ${draws}`)
  console.log(`Stuck Games: ${stuckGames}`)
  console.log(`Average Turns (non-stuck): ${avgTurns.toFixed(1)}`)

  const reasonCounts: Record<string, number> = {}
  results.forEach((r) => {
    if (r.reason) {
      reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1
    }
  })
  console.log('\nWin Reasons:')
  Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([reason, count]) => {
      console.log(`  ${reason}: ${count}`)
    })

  const loseSeeds = results
    .filter((r) => r.winner === 'player-two')
    .map((r) => r.seed)
  console.log(`\nLosing Seeds: [${loseSeeds.join(', ')}]`)

  return { playerWins, aiWins, draws, stuckGames, avgTurns }
}

const main = () => {
  console.log('Starting 50-match test: BS2 Red (Player) vs BS2 Yellow (AI)...\n')
  const results = runMatches()
  const stats = analyzeResults(results)

  console.log('\n=== Detailed Results ===')
  results.forEach((r) => {
    const status = r.stuck ? 'STUCK' : r.winner === 'player-one' ? 'WIN' : r.winner === 'player-two' ? 'LOSE' : 'DRAW'
    console.log(`Seed ${r.seed}: ${status} (T${r.turnNumber}, ${r.actions} actions) ${r.error ?? ''}`)
  })
}

main()
