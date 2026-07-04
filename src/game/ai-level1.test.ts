import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  simulateAiMatch,
  takeAiStep,
  type GameState,
} from '.'

const runLevel1Steps = (
  initialState: GameState,
  seed: number,
  steps: number,
): string[] => {
  let state = initialState
  const kinds: string[] = []
  for (let index = 0; index < steps; index += 1) {
    if (state.status !== 'playing') break
    const decision = takeAiStep(state, state.activePlayerId, {
      level: 1,
      seed,
    })
    if (decision.action === 'error' || decision.state === state) break
    kinds.push(
      decision.reason?.chosenCommandKind ?? decision.action,
    )
    state = decision.state
  }
  return kinds
}

describe('Lv.1 隨機 AI', () => {
  it('相同種子與局面產生相同的決策序列', () => {
    const first = runLevel1Steps(createDemoGame(3), 5, 40)
    const second = runLevel1Steps(createDemoGame(3), 5, 40)

    expect(first.length).toBeGreaterThan(0)
    expect(first).toEqual(second)
  })

  it('不同種子在足夠步數內會出現不同決策', () => {
    const seedFive = runLevel1Steps(createDemoGame(3), 5, 60)
    const seedNine = runLevel1Steps(createDemoGame(3), 9, 60)

    expect(seedFive.join('|')).not.toBe(seedNine.join('|'))
  })

  it('決策附帶 Lv.1 結構化 reason', () => {
    let state = createDemoGame(1)
    const decision = takeAiStep(state, state.activePlayerId, {
      level: 1,
      seed: 1,
    })

    expect(decision.reason?.level).toBe(1)
    expect(decision.reason?.consideredCommands).toBeGreaterThan(0)
    expect(decision.reason?.chosenCommandKind).toBeDefined()

    // 預設等級為 Lv.2，也會標示 reason。
    state = createDemoGame(1)
    const defaultDecision = takeAiStep(state, state.activePlayerId)
    expect(defaultDecision.reason?.level).toBe(2)
  })

  it('Lv.1 對 Lv.2 的模擬對局能正常結束（種子 1-5）', () => {
    for (let seed = 1; seed <= 5; seed += 1) {
      const result = simulateAiMatch(createDemoGame(seed), 1500, {
        levels: { 'player-two': 1 },
        seed,
      })

      expect(result.stuck, `種子 ${seed}: ${result.error ?? ''}`).toBe(false)
      expect(result.state.status).toBe('finished')
    }
  })

  it('Lv.1 對 Lv.1 的模擬對局能正常結束且可重現（種子 1-3）', () => {
    for (let seed = 1; seed <= 3; seed += 1) {
      const options = {
        levels: { 'player-one': 1, 'player-two': 1 } as const,
        seed,
      }
      const first = simulateAiMatch(createDemoGame(seed), 2000, options)
      const second = simulateAiMatch(createDemoGame(seed), 2000, options)

      expect(first.stuck, `種子 ${seed}: ${first.error ?? ''}`).toBe(false)
      expect(first.state.status).toBe('finished')
      expect(first.state.result?.winnerId).toBe(second.state.result?.winnerId)
      expect(first.actions).toBe(second.actions)
    }
  })
})
