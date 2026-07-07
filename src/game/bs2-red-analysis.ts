import { createDemoGame, simulateAiMatch, takeAiStep } from '.'
import type { GameState } from './types'

const LOSING_SEEDS = [7, 8, 11, 14, 15, 18, 20, 25, 37, 46, 48]

interface MatchAnalysis {
  seed: number
  winner: string | null
  reason: string | null
  turnNumber: number
  playerBreakLevel: number
  aiBreakLevel: number
  playerBreakCookies: string[]
  aiBreakCookies: string[]
  keyMoments: string[]
}

const analyzeMatch = (seed: number): MatchAnalysis => {
  const state = createDemoGame(seed, { player: 'bs2-red', ai: 'bs2-yellow' })
  const result = simulateAiMatch(state, 2500)

  const p1 = result.state.players['player-one']
  const p2 = result.state.players['player-two']

  const playerBreakLevel = p1.breakArea.reduce((sum, c) => sum + c.level, 0)
  const aiBreakLevel = p2.breakArea.reduce((sum, c) => sum + c.level, 0)

  const playerBreakCookies = p1.breakArea.map((c) => `${c.name} (Lv${c.level})`)
  const aiBreakCookies = p2.breakArea.map((c) => `${c.name} (Lv${c.level})`)

  const keyMoments: string[] = []
  const logs = result.logs ?? []

  logs.forEach((log) => {
    if (log.includes('break-level-limit') || log.includes('昏厥')) {
      keyMoments.push(log)
    }
  })

  return {
    seed,
    winner: result.state.result?.winnerId ?? null,
    reason: result.state.result?.reason ?? null,
    turnNumber: result.state.turnNumber,
    playerBreakLevel,
    aiBreakLevel,
    playerBreakCookies,
    aiBreakCookies,
    keyMoments: keyMoments.slice(-5),
  }
}

const main = () => {
  console.log('=== BS2 Red Losing Seeds Analysis ===\n')

  const analyses = LOSING_SEEDS.map(analyzeMatch)

  analyses.forEach((a) => {
    console.log(`--- Seed ${a.seed} (${a.winner === 'player-two' ? 'AI WIN' : 'OTHER'}) ---`)
    console.log(`Turns: ${a.turnNumber}, Reason: ${a.reason}`)
    console.log(`Player Break Level: ${a.playerBreakLevel}`)
    console.log(`AI Break Level: ${a.aiBreakLevel}`)
    console.log(`Player Break Cookies: [${a.playerBreakCookies.join(', ')}]`)
    console.log(`AI Break Cookies: [${a.aiBreakCookies.join(', ')}]`)
    if (a.keyMoments.length > 0) {
      console.log('Key Moments:')
      a.keyMoments.forEach((m) => console.log(`  ${m}`))
    }
    console.log('')
  })

  const avgPlayerBreak =
    analyses.reduce((sum, a) => sum + a.playerBreakLevel, 0) / analyses.length
  const avgAiBreak =
    analyses.reduce((sum, a) => sum + a.aiBreakLevel, 0) / analyses.length
  const highLevelBreaks = analyses.filter((a) => a.playerBreakLevel >= 8).length

  console.log('=== Summary ===')
  console.log(`Average Player Break Level: ${avgPlayerBreak.toFixed(1)}`)
  console.log(`Average AI Break Level: ${avgAiBreak.toFixed(1)}`)
  console.log(`Games with Player Break >= 8: ${highLevelBreaks}/${analyses.length}`)
}

main()
