import { createDemoGame, simulateAiMatch } from '.'
import type { BuiltInDeckChoice } from './starter-deck'

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
  playerBreakLevel: number
  aiBreakLevel: number
}

interface MatchupConfig {
  label: string
  playerDeck: BuiltInDeckChoice
  aiDeck: BuiltInDeckChoice
}

const MATCHUPS: MatchupConfig[] = [
  { label: 'BS2 Blue vs BS2 Red',     playerDeck: 'bs2-blue',   aiDeck: 'bs2-red' },
  { label: 'BS2 Purple vs BS2 Red',   playerDeck: 'bs2-purple', aiDeck: 'bs2-red' },
  { label: 'BS2 Blue vs BS2 Yellow',  playerDeck: 'bs2-blue',   aiDeck: 'bs2-yellow' },
  { label: 'BS2 Purple vs BS2 Yellow',playerDeck: 'bs2-purple', aiDeck: 'bs2-yellow' },
  { label: 'BS2 Blue vs BS2 Green',   playerDeck: 'bs2-blue',   aiDeck: 'bs2-bean' },
  { label: 'BS2 Purple vs BS2 Green', playerDeck: 'bs2-purple', aiDeck: 'bs2-bean' },
]

const runMatchup = (config: MatchupConfig): MatchResult[] => {
  const results: MatchResult[] = []

  for (let seed = 1; seed <= MATCH_COUNT; seed++) {
    const state = createDemoGame(seed, { player: config.playerDeck, ai: config.aiDeck })
    const result = simulateAiMatch(state, MAX_ACTIONS)

    const p1 = result.state.players['player-one']
    const p2 = result.state.players['player-two']
    const playerBreakLevel = p1.breakArea.reduce((sum, c) => sum + c.level, 0)
    const aiBreakLevel = p2.breakArea.reduce((sum, c) => sum + c.level, 0)

    results.push({
      seed,
      winner: result.state.result?.winnerId ?? null,
      reason: result.state.result?.reason ?? null,
      turnNumber: result.state.turnNumber,
      actions: result.actions,
      stuck: result.stuck,
      error: result.error,
      playerBreakLevel,
      aiBreakLevel,
    })
  }

  return results
}

const analyzeMatchup = (config: MatchupConfig, results: MatchResult[]) => {
  const playerWins = results.filter((r) => r.winner === 'player-one').length
  const aiWins = results.filter((r) => r.winner === 'player-two').length
  const draws = results.filter((r) => r.winner === null).length
  const stuckGames = results.filter((r) => r.stuck).length
  const validResults = results.filter((r) => !r.stuck)
  const avgTurns = validResults.length > 0
    ? validResults.reduce((sum, r) => sum + r.turnNumber, 0) / validResults.length
    : 0

  const winRate = ((playerWins / MATCH_COUNT) * 100).toFixed(1)

  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${config.label}`)
  console.log(`  Player: ${config.playerDeck.toUpperCase()} | AI: ${config.aiDeck.toUpperCase()}`)
  console.log(`${'='.repeat(60)}`)
  console.log(`Player Wins:   ${playerWins} / ${MATCH_COUNT} (${winRate}%)`)
  console.log(`AI Wins:       ${aiWins} / ${MATCH_COUNT} (${((aiWins / MATCH_COUNT) * 100).toFixed(1)}%)`)
  console.log(`Draws:         ${draws}`)
  console.log(`Stuck Games:   ${stuckGames}`)
  console.log(`Avg Turns:     ${avgTurns.toFixed(1)}`)

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

  const avgPlayerBreak = validResults.length > 0
    ? validResults.reduce((sum, r) => sum + r.playerBreakLevel, 0) / validResults.length
    : 0
  const avgAiBreak = validResults.length > 0
    ? validResults.reduce((sum, r) => sum + r.aiBreakLevel, 0) / validResults.length
    : 0
  console.log(`\nAvg Player Break Level: ${avgPlayerBreak.toFixed(1)}`)
  console.log(`Avg AI Break Level:     ${avgAiBreak.toFixed(1)}`)

  return { playerWins, aiWins, draws, stuckGames, winRate, loseSeeds }
}

const main = () => {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  BS2 Matchup Batch Test: 50 Games x 6 Matchups        ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log(`\nMatch Count: ${MATCH_COUNT} per matchup`)
  console.log(`Max Actions: ${MAX_ACTIONS} per game`)

  const summaries: Array<{
    label: string
    winRate: string
    playerWins: number
    aiWins: number
    loseSeeds: number[]
  }> = []

  for (const config of MATCHUPS) {
    const results = runMatchup(config)
    const summary = analyzeMatchup(config, results)
    summaries.push({
      label: config.label,
      winRate: summary.winRate,
      playerWins: summary.playerWins,
      aiWins: summary.aiWins,
      loseSeeds: summary.loseSeeds,
    })

    console.log('\n--- Detailed Results ---')
    results.forEach((r) => {
      const status = r.stuck ? 'STUCK' : r.winner === 'player-one' ? 'WIN' : r.winner === 'player-two' ? 'LOSE' : 'DRAW'
      console.log(`  Seed ${String(r.seed).padStart(2)}: ${status.padEnd(6)} T${String(r.turnNumber).padStart(3)} ${String(r.actions).padStart(4)} actions | Pbreak=${r.playerBreakLevel} Abreak=${r.aiBreakLevel} ${r.error ?? ''}`)
    })
  }

  console.log('\n\n╔══════════════════════════════════════════════════════════╗')
  console.log('║  OVERALL SUMMARY                                       ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log('')
  console.log('Matchup                              Win%   W   L   D')
  console.log('─'.repeat(55))
  for (const s of summaries) {
    const d = MATCH_COUNT - s.playerWins - s.aiWins
    console.log(`${s.label.padEnd(38)} ${s.winRate.padStart(5)} ${String(s.playerWins).padStart(3)} ${String(s.aiWins).padStart(3)} ${String(d).padStart(3)}`)
  }

  const totalPlayerWins = summaries.reduce((s, x) => s + x.playerWins, 0)
  const totalAiWins = summaries.reduce((s, x) => s + x.aiWins, 0)
  const totalGames = MATCH_COUNT * MATCHUPS.length
  console.log('─'.repeat(55))
  console.log(`${'TOTAL'.padEnd(38)} ${((totalPlayerWins / totalGames) * 100).toFixed(1).padStart(5)} ${String(totalPlayerWins).padStart(3)} ${String(totalAiWins).padStart(3)} ${String(totalGames - totalPlayerWins - totalAiWins).padStart(3)}`)

  console.log('\n\n=== All Losing Seeds by Matchup ===')
  for (const s of summaries) {
    console.log(`${s.label}: [${s.loseSeeds.join(', ')}]`)
  }
}

main()
