import { describe, it } from 'vitest'
import { createDemoGame, simulateAiMatch } from '.'
import type { BuiltInDeckChoice } from '.'

// Each case runs 50 deterministic full matches; allow slower CI runners to
// finish without changing the simulation step cap or masking a deadlock.
const AI_BATCH_TEST_TIMEOUT_MS = 60_000

const MATCHUPS_TO_TRAIN: Array<{
  label: string
  playerDeck: string
  aiDeck: string
}> = [
  { label: 'BS2 Blue vs BS2 Red', playerDeck: 'bs2-blue', aiDeck: 'bs2-red' },
  { label: 'BS2 Blue vs BS2 Yellow', playerDeck: 'bs2-blue', aiDeck: 'bs2-yellow' },
  { label: 'BS2 Blue vs BS2 Bean', playerDeck: 'bs2-blue', aiDeck: 'bs2-bean' },
  { label: 'BS2 Blue vs BS2 Purple', playerDeck: 'bs2-blue', aiDeck: 'bs2-purple' },
  { label: 'BS2 Purple vs BS2 Red', playerDeck: 'bs2-purple', aiDeck: 'bs2-red' },
  { label: 'BS2 Purple vs BS2 Yellow', playerDeck: 'bs2-purple', aiDeck: 'bs2-yellow' },
  { label: 'BS2 Purple vs BS2 Bean', playerDeck: 'bs2-purple', aiDeck: 'bs2-bean' },
  { label: 'BS2 Purple vs BS2 Blue', playerDeck: 'bs2-purple', aiDeck: 'bs2-blue' },
]

describe('BS2 AI Training Batch', () => {
  for (const matchup of MATCHUPS_TO_TRAIN) {
    it(`${matchup.label} — 50 matches`, () => {
      const results = {
        label: matchup.label,
        wins: 0,
        losses: 0,
        draws: 0,
        stuck: 0,
        totalTurns: 0,
        playerBreakInWins: [] as number[],
        playerBreakInLosses: [] as number[],
        aiBreakInWins: [] as number[],
        aiBreakInLosses: [] as number[],
        lossTurns: [] as number[],
        winTurns: [] as number[],
        losingSeeds: [] as number[],
        winReasons: {} as Record<string, number>,
        losingReasons: {} as Record<string, number>,
      }

      for (let seed = 1; seed <= 50; seed++) {
        const state = createDemoGame(seed, {
          player: matchup.playerDeck as BuiltInDeckChoice,
          ai: matchup.aiDeck as BuiltInDeckChoice,
        })
        const result = simulateAiMatch(state, 2500, {
          levels: { 'player-one': 2, 'player-two': 2 },
        })

        if (result.stuck) {
          results.stuck++
          results.losingSeeds.push(seed)
          results.losingReasons['stuck'] = (results.losingReasons['stuck'] ?? 0) + 1
          continue
        }

        const winner = result.state.result?.winnerId
        const loser = result.state.result?.loserId
        const reason = result.state.result?.reason ?? 'unknown'
        const turnCount = result.actions

        const playerBreak = result.state.players['player-one'].breakArea.reduce(
          (sum, c) => sum + c.level,
          0,
        )
        const aiBreak = result.state.players['player-two'].breakArea.reduce(
          (sum, c) => sum + c.level,
          0,
        )

        results.totalTurns += turnCount

        if (winner === 'player-one') {
          results.wins++
          results.winTurns.push(turnCount)
          results.playerBreakInWins.push(playerBreak)
          results.aiBreakInWins.push(aiBreak)
          results.winReasons[reason] = (results.winReasons[reason] ?? 0) + 1
        } else if (loser === 'player-one') {
          results.losses++
          results.lossTurns.push(turnCount)
          results.playerBreakInLosses.push(playerBreak)
          results.aiBreakInLosses.push(aiBreak)
          results.losingSeeds.push(seed)
          results.losingReasons[reason] = (results.losingReasons[reason] ?? 0) + 1
        } else {
          results.draws++
        }
      }

      const total = results.wins + results.losses + results.draws
      const avgTurns = results.totalTurns / 50
      const avgPlayerBreakWin =
        results.playerBreakInWins.reduce((a, b) => a + b, 0) /
          (results.playerBreakInWins.length || 1)
      const avgPlayerBreakLoss =
        results.playerBreakInLosses.reduce((a, b) => a + b, 0) /
          (results.playerBreakInLosses.length || 1)
      const avgAiBreakWin =
        results.aiBreakInWins.reduce((a, b) => a + b, 0) /
          (results.aiBreakInWins.length || 1)
      const avgAiBreakLoss =
        results.aiBreakInLosses.reduce((a, b) => a + b, 0) /
          (results.aiBreakInLosses.length || 1)

      console.log(`\n=== ${matchup.label} ===`)
      console.log(`Win Rate: ${((results.wins / total) * 100).toFixed(1)}% (${results.wins}/${total})`)
      console.log(`Losses: ${results.losses}, Draws: ${results.draws}, Stuck: ${results.stuck}`)
      console.log(`Avg Turns: ${avgTurns.toFixed(1)}`)
      console.log(`Player Break - Wins: ${avgPlayerBreakWin.toFixed(1)}, Losses: ${avgPlayerBreakLoss.toFixed(1)}`)
      console.log(`AI Break - Wins: ${avgAiBreakWin.toFixed(1)}, Losses: ${avgAiBreakLoss.toFixed(1)}`)
      console.log(`Losing Seeds: [${results.losingSeeds.join(',')}]`)
      console.log(`Win Reasons:`, results.winReasons)
      console.log(`Losing Reasons:`, results.losingReasons)
    }, AI_BATCH_TEST_TIMEOUT_MS)
  }
})
