import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  simulateAiMatch,
  takeAiStep,
} from '.'

describe('AI match simulation', () => {
  it('stops a full simulation at the configured action limit', () => {
    const result = simulateAiMatch(createDemoGame(), 1)

    expect(result.stuck).toBe(true)
    expect(result.actions).toBe(1)
    expect(result.error).toContain('最大行動數')
    expect(result.logs.length).toBeLessThanOrEqual(20)
  })

  it('completes a deterministic full AI match', () => {
    const result = simulateAiMatch(createDemoGame())

    expect(result.stuck, result.error ?? '').toBe(false)
    expect(result.state.status).toBe('finished')
    expect(result.state.result).not.toBeNull()
    expect(result.actions).toBeLessThan(500)
  })

  it('completes 20 reproducible seeded matches with varied outcomes', () => {
    const firstRun = Array.from({ length: 20 }, (_, index) => {
      const seed = index + 1
      const result = simulateAiMatch(createDemoGame(seed))

      expect(result.stuck, `種子 ${seed}: ${result.error ?? ''}`).toBe(false)
      return {
        seed,
        winnerId: result.state.result?.winnerId,
        reason: result.state.result?.reason,
        turnNumber: result.state.turnNumber,
        actions: result.actions,
        metrics: result.metrics,
      }
    })
    const repeatedRun = Array.from({ length: 20 }, (_, index) => {
      const seed = index + 1
      const result = simulateAiMatch(createDemoGame(seed))

      return {
        seed,
        winnerId: result.state.result?.winnerId,
        reason: result.state.result?.reason,
        turnNumber: result.state.turnNumber,
        actions: result.actions,
        metrics: result.metrics,
      }
    })
    const outcomeSignatures = new Set(
      firstRun.map((result) =>
        JSON.stringify({
          winnerId: result.winnerId,
          reason: result.reason,
          turnNumber: result.turnNumber,
          actions: result.actions,
          metrics: result.metrics,
        }),
      ),
    )

    expect(repeatedRun).toEqual(firstRun)
    expect(outcomeSignatures.size).toBeGreaterThan(1)
  })

  it.each([6, 19, 29, 33])(
    'completes purple mirror match for regression seed %i',
    (seed) => {
      const result = simulateAiMatch(
        createDemoGame(seed, { player: 'purple', ai: 'purple' }),
      )

      expect(result.stuck, result.error ?? '').toBe(false)
      expect(result.state.status).toBe('finished')
      expect(result.actions).toBeLessThan(500)
    },
  )

  it('can move from the first active phase without mutating input', () => {
    const state = createDemoGame()
    const snapshot = structuredClone(state)
    const next = takeAiStep(
      {
        ...state,
        activePlayerId: 'player-two',
      },
      'player-two',
    )

    expect(next.action).toBe('advance-phase')
    expect(state).toEqual(snapshot)
  })
})
