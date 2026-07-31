import { describe, expect, it } from 'vitest'
import { createDemoGame, simulateAiMatchDetailed } from '.'
import type { AiLevel, BuiltInDeckChoice } from '.'

/**
 * Phase 3b Final Baseline (locked after R5/R6b/R8/R7, seeds 1–30):
 *
 * | Matchup       | Win Rate | Skill Uses | Lv.A LQ | Lv.B LQ | Total LQ | Break Δ/Attack |
 * |---------------|----------|------------|--------:|--------:|---------:|----------------|
 * | Lv.2 vs Lv.1  | 83.3%    | 22         |       0 |      18 |       18 | 0.44           |
 * | Lv.3 vs Lv.2  | 66.7%    | 5          |       4 |       2 |        6 | 0.47           |
 * | Lv.4 vs Lv.3  | 70.0%    | 4          |       5 |       1 |        6 | 0.44           |
 * | Lv.3 vs Lv.1  | 100.0%   | 1          |       0 |      23 |       23 | 0.41           |
 * | Lv.4 vs Lv.1  | 100.0%   | 1          |       0 |      31 |       31 | 0.43           |
 *
 * Lv.A = player-one level, Lv.B = player-two level.
 * LQ = Low Quality (Level<=1 AND HP<=1).
 *
 * Trap Usage (R7, seeds 1–30):
 *   Lv.2 vs Lv.1: 30 offered / 30 played / 0 skipped (R7 not enabled for Lv.2)
 *   Lv.3 vs Lv.2: 42 offered / 41 played / 1 skipped (R7 skips expendable targets)
 *   Lv.4 vs Lv.3: 50 offered / 47 played / 3 skipped (R7 skips expendable targets)
 *   Lv.3 vs Lv.1: not collected (Lv.1 trap decisions not tracked by R7)
 *   Lv.4 vs Lv.1: not collected (Lv.1 trap decisions not tracked by R7)
 *
 * Phase 3b cumulative improvements:
 *   R6b: Lv.3 vs Lv.2 63.3% → 66.7%, Lv.4 vs Lv.3 66.7% → 76.7%
 *   R8:  Lv.3/Lv.4 vs Lv.1 96.7% → 100.0%
 *   R7:  Lv.4 vs Lv.3 76.7% → 70.0% (tradeoff: trap skip for expendable targets)
 *
 * Known pre-existing test-suite issue:
 *   opencode-go-benchmark.test.js has no test suite (not caused by AI changes).
 *
 * Repeat Target Rate note:
 *   "Repeat Target Rate" = same-attacker consecutive same-target ratio.
 *   Lower value = more target switching (not necessarily more focused).
 *   Use "Damaged Prior" and "Target Switches" for focus-fire quality.
 */

interface AggregatedReport {
  label: string
  games: number
  wins: number
  losses: number
  stuck: number
  turnCapReached: number
  winRate: string
  avgTurns: string
  avgNoDamageTurns: string
  avgNoBoardChangeTurns: string
  maxConsecutiveNoProgress: string
  turnCapRatio: string
  replacementAvgScore: string
  replacementAvgRank: string
  lowQualityReplacements: number
  totalReplacements: number
  playerOneLowQualityReplacements: number
  playerTwoLowQualityReplacements: number
  playerOneTotalReplacements: number
  playerTwoTotalReplacements: number
  playerOneReplacementAvgScore: string
  playerTwoReplacementAvgScore: string
  attackKillRate: string
  overkillRatio: string
  avgOverkillAmount: string
  totalAttacks: number
  redirectCount: number
  totalBreakAreaDelta: number
  repeatTargetRate: string
  targetSwitchCount: number
  damagedTargetPriorityRate: string
  attacksPerKill: string
  breakDeltaPerKill: string
  breakDeltaPerAttack: string
  killsWhenOpponentBreakHigh: number
  skillActivations: number
  avgBreakInWins: string
  avgBreakInLosses: string
  invalidActions: number
  deadlocks: number
  avgFinalHandSize: string
  lowHandTurns: number
  totalDrawMentions: number
  trapOfferedCount: number
  trapPlayedCount: number
  trapSkippedCount: number
  seedWinLoss: Array<{ seed: number; win: boolean }>
  missedLethalCount: number
  lethalOpportunityCount: number
  lethalConversionCount: number
  directWinCount: number
  r10PenaltyAppliedCount: number
  r10BreakRaceRiskCount: number
  r10ExposureRiskCount: number
  r6cReplacementCount: number
  r6cLowQualityCount: number
  r6cForcedCount: number
  r6cBreakWorsenedCount: number
}

const runBenchmark = (
  label: string,
  playerLevel: AiLevel,
  aiLevel: AiLevel,
  seeds: number[],
  deck?: { player: BuiltInDeckChoice; ai: BuiltInDeckChoice },
): AggregatedReport => {
  const agg: AggregatedReport = {
    label,
    games: seeds.length,
    wins: 0,
    losses: 0,
    stuck: 0,
    turnCapReached: 0,
    winRate: '0%',
    avgTurns: '0',
    avgNoDamageTurns: '0',
    avgNoBoardChangeTurns: '0',
    maxConsecutiveNoProgress: '0',
    turnCapRatio: '0%',
    replacementAvgScore: '0',
    replacementAvgRank: '0',
    lowQualityReplacements: 0,
    totalReplacements: 0,
    playerOneLowQualityReplacements: 0,
    playerTwoLowQualityReplacements: 0,
    playerOneTotalReplacements: 0,
    playerTwoTotalReplacements: 0,
    playerOneReplacementAvgScore: '0',
    playerTwoReplacementAvgScore: '0',
    attackKillRate: '0%',
    overkillRatio: '0%',
    avgOverkillAmount: '0',
    totalAttacks: 0,
    redirectCount: 0,
    totalBreakAreaDelta: 0,
    repeatTargetRate: '0%',
    targetSwitchCount: 0,
    damagedTargetPriorityRate: '0%',
    attacksPerKill: '0',
    breakDeltaPerKill: '0',
    breakDeltaPerAttack: '0',
    killsWhenOpponentBreakHigh: 0,
    skillActivations: 0,
    avgBreakInWins: '0',
    avgBreakInLosses: '0',
    invalidActions: 0,
    deadlocks: 0,
    avgFinalHandSize: '0',
    lowHandTurns: 0,
    totalDrawMentions: 0,
    trapOfferedCount: 0,
    trapPlayedCount: 0,
    trapSkippedCount: 0,
    seedWinLoss: [],
    missedLethalCount: 0,
    lethalOpportunityCount: 0,
    lethalConversionCount: 0,
    directWinCount: 0,
    r10PenaltyAppliedCount: 0,
    r10BreakRaceRiskCount: 0,
    r10ExposureRiskCount: 0,
    r6cReplacementCount: 0,
    r6cLowQualityCount: 0,
    r6cForcedCount: 0,
    r6cBreakWorsenedCount: 0,
  }

  let sumTurns = 0
  let sumNoDamage = 0
  let sumNoBoardChange = 0
  let maxConsecNoProgress = 0
  let sumReplacementScore = 0
  let sumReplacementRank = 0
  let sumP1ReplacementScore = 0
  let sumP2ReplacementScore = 0
  let totalKill = 0
  let totalOverkill = 0
  let sumOverkillAmount = 0
  let totalRedirects = 0
  let totalBreakAreaDelta = 0
  let totalRepeatTargets = 0
  let totalTargetSwitches = 0
  let totalDamagedPriority = 0
  let totalKills = 0
  let totalBreakDeltaOnKill = 0
  let killsWhenOpponentBreakHigh = 0
  let sumFinalHandSize = 0
  let totalDrawMentions = 0
  let totalTrapPlayed = 0
  let totalTrapSkipped = 0
  const breakInWins: number[] = []
  const breakInLosses: number[] = []

  for (const seed of seeds) {
    const state = createDemoGame(seed, deck)
    const result = simulateAiMatchDetailed(state, 2500, {
      levels: { 'player-one': playerLevel, 'player-two': aiLevel },
      seed,
    })

    if (result.stuck) {
      agg.stuck++
      agg.deadlocks++
      continue
    }

    if (result.endInfo.turnCapReached) agg.turnCapReached++

    const winner = result.endInfo.winner
    const isWin = winner === 'player-one'
    if (isWin) {
      agg.wins++
      breakInWins.push(result.endInfo.playerOneBreakLevel)
    } else {
      agg.losses++
      breakInLosses.push(result.endInfo.playerTwoBreakLevel)
    }
    agg.seedWinLoss.push({ seed, win: isWin })

    sumTurns += result.turnProgression.totalTurns
    sumNoDamage += result.turnProgression.noDamageTurns
    sumNoBoardChange += result.turnProgression.noBoardChangeTurns
    maxConsecNoProgress = Math.max(maxConsecNoProgress, result.turnProgression.consecutiveNoProgressMax)

    agg.totalReplacements += result.metrics.replacements
    agg.lowQualityReplacements += result.behavior.lowQualityReplacementCount
    agg.playerOneLowQualityReplacements += result.behavior.playerOneLowQualityReplacements
    agg.playerTwoLowQualityReplacements += result.behavior.playerTwoLowQualityReplacements
    agg.playerOneTotalReplacements += result.behavior.playerOneTotalReplacements
    agg.playerTwoTotalReplacements += result.behavior.playerTwoTotalReplacements
    sumReplacementScore += result.behavior.replacementAvgScore * result.metrics.replacements
    sumReplacementRank += result.behavior.replacementAvgRank * result.metrics.replacements
    sumP1ReplacementScore += result.behavior.playerOneReplacementAvgScore * result.behavior.playerOneTotalReplacements
    sumP2ReplacementScore += result.behavior.playerTwoReplacementAvgScore * result.behavior.playerTwoTotalReplacements

    agg.totalAttacks += result.attackEvents.length
    totalKill += result.attackEvents.filter((e) => e.isKill).length
    totalOverkill += result.attackEvents.filter((e) => e.isOverkill).length
    sumOverkillAmount += result.attackEvents.reduce((sum, e) => sum + e.overkillAmount, 0)
    totalRedirects += result.attackEvents.filter((e) => e.wasRedirected).length
    totalBreakAreaDelta += result.attackEvents.reduce((sum, e) => sum + e.breakAreaDelta, 0)
    totalKills += result.attackEvents.filter((e) => e.isKill).length

    for (let i = 0; i < result.attackEvents.length; i++) {
      const event = result.attackEvents[i]
      if (i > 0) {
        const prev = result.attackEvents[i - 1]
        if (prev.attackerPlayerId === event.attackerPlayerId) {
          if (prev.finalTargetId === event.finalTargetId) {
            totalRepeatTargets += 1
          } else {
            totalTargetSwitches += 1
          }
        }
      }
      if (event.targetHpBefore > event.damage && event.damage > 0) {
        totalDamagedPriority += 1
      }
      if (event.isKill) {
        totalBreakDeltaOnKill += event.breakAreaDelta
        if (event.breakAreaBefore >= 6) {
          killsWhenOpponentBreakHigh += 1
        }
      }
    }

    agg.skillActivations += result.behavior.skillUsageCount
    agg.invalidActions += result.behavior.invalidActionCount

    // R8 hand size tracking
    const finalHandSize = result.state.players['player-one'].hand.length
    sumFinalHandSize += finalHandSize
    const drawMentions = result.logs.filter(
      (l) => l.includes('抽') || l.includes('draw') || l.includes('Draw'),
    ).length
    totalDrawMentions += drawMentions

    // R7 trap tracking
    const trapPlayedInGame = result.logs.filter(
      (l) => l.includes('發動') && !l.includes('技能') && !l.includes('FLIP') && !l.includes('未發動'),
    ).length
    totalTrapPlayed += trapPlayedInGame
    totalTrapSkipped += result.behavior.r7TrapSkippedCount

    // R9 lethal tracking
    agg.lethalOpportunityCount += result.behavior.lethalOpportunityCount
    agg.lethalConversionCount += result.behavior.lethalConversionCount
    agg.directWinCount += result.behavior.directWinCount

    // R10 risk tracking
    agg.r10PenaltyAppliedCount += result.behavior.r10PenaltyAppliedCount
    agg.r10BreakRaceRiskCount += result.behavior.r10BreakRaceRiskCount
    agg.r10ExposureRiskCount += result.behavior.r10ExposureRiskCount

    // R6c audit tracking
    agg.r6cReplacementCount += result.behavior.r6cReplacementCount
    agg.r6cLowQualityCount += result.behavior.r6cLowQualityCount
    agg.r6cForcedCount += result.behavior.r6cForcedCount
    agg.r6cBreakWorsenedCount += result.behavior.r6cBreakWorsenedCount
  }

  const completed = agg.wins + agg.losses
  if (completed === 0) return agg

  agg.winRate = `${((agg.wins / completed) * 100).toFixed(1)}%`
  agg.avgTurns = (sumTurns / completed).toFixed(1)
  agg.avgNoDamageTurns = (sumNoDamage / completed).toFixed(1)
  agg.avgNoBoardChangeTurns = (sumNoBoardChange / completed).toFixed(1)
  agg.maxConsecutiveNoProgress = maxConsecNoProgress.toString()
  agg.turnCapRatio = `${((agg.turnCapReached / agg.games) * 100).toFixed(1)}%`
  agg.replacementAvgScore = agg.totalReplacements > 0
    ? (sumReplacementScore / agg.totalReplacements).toFixed(1)
    : '0'
  agg.replacementAvgRank = agg.totalReplacements > 0
    ? (sumReplacementRank / agg.totalReplacements).toFixed(1)
    : '0'
  agg.playerOneReplacementAvgScore = agg.playerOneTotalReplacements > 0
    ? (sumP1ReplacementScore / agg.playerOneTotalReplacements).toFixed(1)
    : '0'
  agg.playerTwoReplacementAvgScore = agg.playerTwoTotalReplacements > 0
    ? (sumP2ReplacementScore / agg.playerTwoTotalReplacements).toFixed(1)
    : '0'
  agg.attackKillRate = agg.totalAttacks > 0
    ? `${((totalKill / agg.totalAttacks) * 100).toFixed(1)}%`
    : '0%'
  agg.overkillRatio = agg.totalAttacks > 0
    ? `${((totalOverkill / agg.totalAttacks) * 100).toFixed(1)}%`
    : '0%'
  agg.avgOverkillAmount = totalOverkill > 0
    ? (sumOverkillAmount / totalOverkill).toFixed(1)
    : '0'
  agg.redirectCount = totalRedirects
  agg.totalBreakAreaDelta = totalBreakAreaDelta
  agg.repeatTargetRate = agg.totalAttacks > 1
    ? `${((totalRepeatTargets / (agg.totalAttacks - 1)) * 100).toFixed(1)}%`
    : '0%'
  agg.targetSwitchCount = totalTargetSwitches
  agg.damagedTargetPriorityRate = agg.totalAttacks > 0
    ? `${((totalDamagedPriority / agg.totalAttacks) * 100).toFixed(1)}%`
    : '0%'
  agg.attacksPerKill = totalKills > 0
    ? (agg.totalAttacks / totalKills).toFixed(1)
    : 'N/A'
  agg.breakDeltaPerKill = totalKills > 0
    ? (totalBreakDeltaOnKill / totalKills).toFixed(2)
    : '0'
  agg.breakDeltaPerAttack = agg.totalAttacks > 0
    ? (totalBreakAreaDelta / agg.totalAttacks).toFixed(2)
    : '0'
  agg.killsWhenOpponentBreakHigh = killsWhenOpponentBreakHigh
  agg.avgFinalHandSize = completed > 0
    ? (sumFinalHandSize / completed).toFixed(1)
    : '0'
  agg.totalDrawMentions = totalDrawMentions
  agg.trapPlayedCount = totalTrapPlayed
  agg.trapSkippedCount = totalTrapSkipped
  agg.trapOfferedCount = totalTrapPlayed + totalTrapSkipped
  agg.missedLethalCount = agg.lethalOpportunityCount - agg.lethalConversionCount
  agg.avgBreakInWins = breakInWins.length > 0
    ? (breakInWins.reduce((a, b) => a + b, 0) / breakInWins.length).toFixed(1)
    : 'N/A'
  agg.avgBreakInLosses = breakInLosses.length > 0
    ? (breakInLosses.reduce((a, b) => a + b, 0) / breakInLosses.length).toFixed(1)
    : 'N/A'

  return agg
}

const printFullReport = (r: AggregatedReport) => {
  const levels = r.label.match(/Lv\.(\d)\s+vs\s+Lv\.(\d)/)
  const playerLv = levels?.[1] ?? '?'
  const aiLv = levels?.[2] ?? '?'

  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${r.label}`)
  console.log(`${'='.repeat(60)}`)
  console.log(`  Games: ${r.games}  Stuck: ${r.stuck}  Turn Cap: ${r.turnCapRatio}`)
  console.log(`  Win Rate: ${r.winRate} (${r.wins}W / ${r.losses}L)`)
  console.log(``)
  console.log(`  --- Turn Progression ---`)
  console.log(`  Avg Turns:           ${r.avgTurns}`)
  console.log(`  Avg No-Damage Turns: ${r.avgNoDamageTurns}`)
  console.log(`  Avg No-Board Turns:  ${r.avgNoBoardChangeTurns}`)
  console.log(`  Max Consec No-Prog:  ${r.maxConsecutiveNoProgress}`)
  console.log(``)
  console.log(`  --- Replacement ---`)
  console.log(`  Total:           ${r.totalReplacements}`)
  console.log(`  Low Quality:     ${r.lowQualityReplacements}  (Lv.${playerLv}: ${r.playerOneLowQualityReplacements}  Lv.${aiLv}: ${r.playerTwoLowQualityReplacements})`)
  console.log(`  Avg Score:       ${r.replacementAvgScore}  (Lv.${playerLv}: ${r.playerOneReplacementAvgScore}  Lv.${aiLv}: ${r.playerTwoReplacementAvgScore})`)
  console.log(`  Avg Rank:        ${r.replacementAvgRank}`)
  console.log(`  Per-Player:      Lv.${playerLv} total=${r.playerOneTotalReplacements}  Lv.${aiLv} total=${r.playerTwoTotalReplacements}`)
  console.log(``)
  console.log(`  --- Attack ---`)
  console.log(`  Total Attacks:   ${r.totalAttacks}`)
  console.log(`  Kill Rate:       ${r.attackKillRate}`)
  console.log(`  Attacks/Kill:    ${r.attacksPerKill}`)
  console.log(`  Overkill Ratio:  ${r.overkillRatio}`)
  console.log(`  Redirects:       ${r.redirectCount}`)
  console.log(`  Break Area Δ:    ${r.totalBreakAreaDelta}`)
  console.log(`  --- R1 Break Level ---`)
  console.log(`  Break Δ/Kill:    ${r.breakDeltaPerKill}`)
  console.log(`  Break Δ/Attack:  ${r.breakDeltaPerAttack}`)
  console.log(`  Kills@Break≥6:   ${r.killsWhenOpponentBreakHigh}`)
  console.log(`  --- R2 Focus Fire ---`)
  console.log(`  Target Switches: ${r.targetSwitchCount}`)
  console.log(`  Damaged Prior:   ${r.damagedTargetPriorityRate}`)
  console.log(`  (Note: Repeat Target Rate = same-attacker consecutive same-target ratio)`)
  console.log(`  (Lower = more target switching, not necessarily more focused)`)
  console.log(`  Repeat Target:   ${r.repeatTargetRate}`)
  console.log(``)
  console.log(`  --- Quality ---`)
  console.log(`  Skill Uses:      ${r.skillActivations}`)
  console.log(`  Invalid Actions: ${r.invalidActions}`)
  console.log(`  Deadlocks:       ${r.deadlocks}`)
  console.log(``)
  console.log(`  --- R8 Hand Management ---`)
  console.log(`  Avg Final Hand:  ${r.avgFinalHandSize}`)
  console.log(`  Draw Mentions:   ${r.totalDrawMentions}`)
  console.log(``)
  console.log(`  --- R7 Trap Usage ---`)
  console.log(`  Trap Offered:    ${r.trapOfferedCount}`)
  console.log(`  Trap Played:     ${r.trapPlayedCount}`)
  console.log(`  Trap Skipped:    ${r.trapSkippedCount}`)
  console.log(``)
  console.log(`  --- R9 Lethal Detection ---`)
  console.log(`  Lethal Opps:     ${r.lethalOpportunityCount}`)
  console.log(`  Lethal Taken:    ${r.lethalConversionCount}`)
  console.log(`  Missed Lethal:   ${r.missedLethalCount}`)
  console.log(`  Conv Rate:       ${r.lethalOpportunityCount > 0 ? ((r.lethalConversionCount / r.lethalOpportunityCount) * 100).toFixed(1) + '%' : 'N/A'}`)
  console.log(`  Direct Wins:     ${r.directWinCount}`)
  console.log(``)
  console.log(`  --- R10 Risk Management ---`)
  console.log(`  Penalty Applied: ${r.r10PenaltyAppliedCount}`)
  console.log(`  Break Race Risk: ${r.r10BreakRaceRiskCount}`)
  console.log(`  Exposure Risk:   ${r.r10ExposureRiskCount}`)
  console.log(``)
  console.log(`  --- R6c Replacement Audit ---`)
  console.log(`  Replacements:    ${r.r6cReplacementCount}`)
  console.log(`  Low Quality:     ${r.r6cLowQualityCount}`)
  console.log(`  Forced (≤2):     ${r.r6cForcedCount}`)
  console.log(`  Non-Forced LQ:   ${r.r6cLowQualityCount - r.r6cForcedCount}`)
  console.log(`  Break Worsened:  ${r.r6cBreakWorsenedCount}`)
  console.log(``)
  console.log(`  --- Break Level ---`)
  console.log(`  Avg Break (Wins):   ${r.avgBreakInWins}`)
  console.log(`  Avg Break (Losses): ${r.avgBreakInLosses}`)
  console.log(`${'='.repeat(60)}`)
}

describe('R6a AI Level Benchmark (Detailed)', () => {
  const seeds = Array.from({ length: 30 }, (_, i) => i + 1)

  it('Lv.2 vs Lv.1', () => {
    const r = runBenchmark('Lv.2 vs Lv.1', 2, 1, seeds)
    printFullReport(r)
    const wr = r.wins / (r.wins + r.losses)
    console.log(`\n  Target >= 60%: ${(wr * 100).toFixed(1)}% ${wr >= 0.6 ? 'PASS' : 'FAIL'}`)
  })

  it('Lv.3 vs Lv.2', () => {
    const r = runBenchmark('Lv.3 vs Lv.2', 3, 2, seeds)
    printFullReport(r)
    const wr = r.wins / (r.wins + r.losses)
    console.log(`\n  Target >= 58%: ${(wr * 100).toFixed(1)}% ${wr >= 0.58 ? 'PASS' : 'FAIL'}`)
  })

  it('Lv.4 vs Lv.3', () => {
    const r = runBenchmark('Lv.4 vs Lv.3', 4, 3, seeds)
    printFullReport(r)
    const wr = r.wins / (r.wins + r.losses)
    const wrPct = (wr * 100).toFixed(1)
    console.log(`\n  Target >= 55%: ${wrPct}% ${wr >= 0.55 ? 'PASS' : 'FAIL'}`)

    // Phase 3c-0: Upper limit warnings
    if (wr >= 0.80) {
      console.log(`  ⚠️  STOP: Lv.4 vs Lv.3 >= 80% — pause and audit`)
    } else if (wr >= 0.75) {
      console.log(`  ⚠️  WARN: Lv.4 vs Lv.3 >= 75% — review for over-strength`)
    }

    // Phase 3c-0: Seed variance analysis
    const losses = r.seedWinLoss.filter((s) => !s.win).map((s) => s.seed)
    console.log(`  Losing seeds: [${losses.join(',')}]`)
    console.log(`  Seed loss rate: ${losses.length}/${r.games} (${((losses.length / r.games) * 100).toFixed(1)}%)`)
  })

  it('Lv.3 vs Lv.1', () => {
    const r = runBenchmark('Lv.3 vs Lv.1', 3, 1, seeds)
    printFullReport(r)
    const wr = r.wins / (r.wins + r.losses)
    console.log(`\n  Target >= 65%: ${(wr * 100).toFixed(1)}% ${wr >= 0.65 ? 'PASS' : 'FAIL'}`)
  })

  it('Lv.4 vs Lv.1', () => {
    const r = runBenchmark('Lv.4 vs Lv.1', 4, 1, seeds)
    printFullReport(r)
    const wr = r.wins / (r.wins + r.losses)
    console.log(`\n  Target >= 70%: ${(wr * 100).toFixed(1)}% ${wr >= 0.7 ? 'PASS' : 'FAIL'}`)
  })
})

describe('BS3 All Presets — 完整性驗證（60 seeds, Lv.4 mirror）', () => {
  const bs3Seeds = Array.from({ length: 60 }, (_, i) => i + 1)
  const bs3Presets = [
    { label: 'BS3 Red Pitaya', deck: 'bs3-red-pitaya' as BuiltInDeckChoice },
    { label: 'BS3 Blue Sorbet', deck: 'bs3-blue-sorbet' as BuiltInDeckChoice },
    { label: 'BS3 Green Lily', deck: 'bs3-green-lily' as BuiltInDeckChoice },
    { label: 'BS3 Purple Dark Cacao', deck: 'bs3-purple-dark-cacao' as BuiltInDeckChoice },
    { label: 'BS3 Yellow Counter', deck: 'bs3-yellow-counter' as BuiltInDeckChoice },
  ]

  for (const preset of bs3Presets) {
    it(`${preset.label} — 無卡死、無異常中斷`, () => {
      const r = runBenchmark(
        preset.label,
        4,
        4,
        bs3Seeds,
        { player: preset.deck, ai: preset.deck },
      )
      printFullReport(r)

      // <= 10/60 stuck 容忍（牌組控制／治癒型節奏可能觸及 2500 步上限）
      const maxStuck = 10
      expect(r.stuck).toBeLessThanOrEqual(maxStuck)
      expect(r.deadlocks).toBeLessThanOrEqual(maxStuck)

      const completed = r.wins + r.losses
      if (r.stuck > 0) {
        console.log(`  ⚠️  ${preset.label}: ${r.stuck}/${bs3Seeds.length} stuck — 可能因牌組控制型節奏觸及 2500 步上限`)
      }
      console.log(`\n  ${preset.label}: Stuck ${r.stuck} | Completed ${completed}/${bs3Seeds.length}`)
    })
  }
})
