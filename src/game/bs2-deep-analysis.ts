import { createDemoGame, simulateAiMatch } from '.'
import type { BuiltInDeckChoice } from './starter-deck'

const MATCH_COUNT = 50
const MAX_ACTIONS = 2500

interface LosingSeedDetail {
  seed: number
  matchup: string
  winner: string | null
  reason: string | null
  turnNumber: number
  playerBreakLevel: number
  aiBreakLevel: number
  playerCookies: string[]
  aiCookies: string[]
  playerSupportCount: number
  aiSupportCount: number
  lastLogs: string[]
  keyPatterns: string[]
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

const analyzeLosingSeed = (config: MatchupConfig, seed: number): LosingSeedDetail | null => {
  const state = createDemoGame(seed, { player: config.playerDeck, ai: config.aiDeck })
  const result = simulateAiMatch(state, MAX_ACTIONS)

  if (result.state.result?.winnerId !== 'player-two') return null

  const p1 = result.state.players['player-one']
  const p2 = result.state.players['player-two']

  const playerBreakLevel = p1.breakArea.reduce((sum, c) => sum + c.level, 0)
  const aiBreakLevel = p2.breakArea.reduce((sum, c) => sum + c.level, 0)

  const playerCookies = p1.breakArea.map((c) => `${c.name}(Lv${c.level})`)
  const aiCookies = p2.breakArea.map((c) => `${c.name}(Lv${c.level})`)

  const logs = result.logs ?? []
  const lastLogs = logs.slice(-10)

  const keyPatterns: string[] = []
  logs.forEach((log) => {
    if (log.includes('break-level-limit')) keyPatterns.push('BREAK_LIMIT')
    if (log.includes('no-cookie-available')) keyPatterns.push('NO_COOKIE')
    if (log.includes('昏厥')) keyPatterns.push('FAINT')
    if (log.includes('block')) keyPatterns.push('BLOCK')
    if (log.includes('trap')) keyPatterns.push('TRAP')
    if (log.includes('skill')) keyPatterns.push('SKILL')
    if (log.includes('refresh')) keyPatterns.push('REFRESH')
  })

  return {
    seed,
    matchup: config.label,
    winner: result.state.result?.winnerId ?? null,
    reason: result.state.result?.reason ?? null,
    turnNumber: result.state.turnNumber,
    playerBreakLevel,
    aiBreakLevel,
    playerCookies,
    aiCookies,
    playerSupportCount: p1.supportArea.length,
    aiSupportCount: p2.supportArea.length,
    lastLogs,
    keyPatterns: [...new Set(keyPatterns)],
  }
}

const main = () => {
  console.log('=== Deep Analysis of Losing Seeds ===\n')

  const allDetails: LosingSeedDetail[] = []

  for (const config of MATCHUPS) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`  ${config.label} - Losing Seeds Deep Analysis`)
    console.log(`${'='.repeat(60)}`)

    for (let seed = 1; seed <= MATCH_COUNT; seed++) {
      const detail = analyzeLosingSeed(config, seed)
      if (detail) {
        allDetails.push(detail)
        console.log(`\n--- Seed ${seed} ---`)
        console.log(`  Turns: ${detail.turnNumber}, Reason: ${detail.reason}`)
        console.log(`  Player Break: ${detail.playerBreakLevel} | AI Break: ${detail.aiBreakLevel}`)
        console.log(`  Player Break Cookies: [${detail.playerCookies.join(', ')}]`)
        console.log(`  AI Break Cookies: [${detail.aiCookies.join(', ')}]`)
        console.log(`  Player Support: ${detail.playerSupportCount} | AI Support: ${detail.aiSupportCount}`)
        console.log(`  Key Patterns: [${detail.keyPatterns.join(', ')}]`)
        console.log(`  Last Logs:`)
        detail.lastLogs.forEach((l) => console.log(`    ${l}`))
      }
    }
  }

  // Cross-matchup pattern analysis
  console.log('\n\n=== Cross-Matchup Pattern Analysis ===')

  const patternCounts: Record<string, number> = {}
  allDetails.forEach((d) => {
    d.keyPatterns.forEach((p) => {
      patternCounts[p] = (patternCounts[p] || 0) + 1
    })
  })
  console.log('\nPattern Frequency Across All Losing Seeds:')
  Object.entries(patternCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([pattern, count]) => {
      console.log(`  ${pattern}: ${count} / ${allDetails.length} (${((count / allDetails.length) * 100).toFixed(0)}%)`)
    })

  // Break level comparison
  const avgPlayerBreak = allDetails.reduce((s, d) => s + d.playerBreakLevel, 0) / allDetails.length
  const avgAiBreak = allDetails.reduce((s, d) => s + d.aiBreakLevel, 0) / allDetails.length
  console.log(`\nAvg Player Break in Losing Games: ${avgPlayerBreak.toFixed(1)}`)
  console.log(`Avg AI Break in Losing Games: ${avgAiBreak.toFixed(1)}`)

  const playerHigherBreak = allDetails.filter((d) => d.playerBreakLevel > d.aiBreakLevel).length
  console.log(`Games where Player had HIGHER break but still lost: ${playerHigherBreak} / ${allDetails.length} (${((playerHigherBreak / allDetails.length) * 100).toFixed(0)}%)`)

  // Turn distribution
  const turnDistribution: Record<string, number> = {}
  allDetails.forEach((d) => {
    const bracket = `${Math.floor((d.turnNumber - 1) / 3) * 3 + 1}-${Math.floor((d.turnNumber - 1) / 3) * 3 + 3}`
    turnDistribution[bracket] = (turnDistribution[bracket] || 0) + 1
  })
  console.log('\nTurn Distribution of Losing Games:')
  Object.entries(turnDistribution)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([range, count]) => {
      console.log(`  Turns ${range}: ${count}`)
    })
}

main()
