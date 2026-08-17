import { describe, expect, it } from 'vitest'
import { createDemoGame, simulateAiMatch } from '.'
import type { AiMatchResult } from '.'

// This case runs 50 deterministic full matches and is intentionally longer
// than Vitest's default 5-second per-test timeout on slower CI runners.
const AI_BATCH_TEST_TIMEOUT_MS = 60_000

describe('BS2 bean deck energy payment color validation', () => {
  it('completes 50 seed games without color mismatch errors', () => {
    const results: {
      seed: number
      winnerId: string | undefined
      reason: string | undefined
      turns: number
      actions: number
      stuck: boolean
      colorMismatchLogs: string[]
    }[] = []

    let colorMismatchCount = 0
    let stuckCount = 0

    for (let seed = 1; seed <= 50; seed += 1) {
      const state = createDemoGame(seed, {
        player: 'bs2-bean',
        ai: 'bs2-bean',
      })
      const result: AiMatchResult = simulateAiMatch(state, 1500)

      const mismatchLogs = result.logs.filter((log) =>
        log.includes('能量顏色不符合費用需求'),
      )

      results.push({
        seed,
        winnerId: result.state.result?.winnerId,
        reason: result.state.result?.reason,
        turns: result.state.turnNumber,
        actions: result.actions,
        stuck: result.stuck,
        colorMismatchLogs: mismatchLogs,
      })

      if (mismatchLogs.length > 0) colorMismatchCount++
      if (result.stuck) stuckCount++

      expect(result.stuck, `種子 ${seed} 卡死: ${result.error ?? ''}`).toBe(false)
      expect(
        mismatchLogs.length,
        `種子 ${seed}: 發現 ${mismatchLogs.length} 條顏色不符錯誤`,
      ).toBe(0)
    }

    const winCounts: Record<string, number> = {}
    for (const r of results) {
      const key = r.winnerId ?? 'draw'
      winCounts[key] = (winCounts[key] ?? 0) + 1
    }

    console.log('\n=== BS2 Bean vs BS2 Bean — 50 matches ===')
    console.log(`Results: ${JSON.stringify(winCounts)}`)
    console.log(`Color mismatch seeds: ${colorMismatchCount}`)
    console.log(`Stuck: ${stuckCount}`)
    console.log(
      `Avg turns: ${(results.reduce((s, r) => s + r.turns, 0) / results.length).toFixed(1)}`,
    )
    console.log(
      `Avg actions: ${(results.reduce((s, r) => s + r.actions, 0) / results.length).toFixed(1)}`,
    )

    expect(colorMismatchCount).toBe(0)
    expect(stuckCount).toBe(0)
  }, AI_BATCH_TEST_TIMEOUT_MS)
})
