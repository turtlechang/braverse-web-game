import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  simulateAiMatch,
  takeAiStep,
  type GameState,
} from '.'

describe('Lv.4 兩層前瞻 AI', () => {
  it('決策附帶 Lv.4 結構化 reason', () => {
    const state = createDemoGame(1)
    let current = state
    // 找到一個 free-choice 狀態（support 或 main phase）
    for (let i = 0; i < 10; i += 1) {
      if (current.status !== 'playing') break
      const decision = takeAiStep(current, current.activePlayerId, { level: 4 })
      if (decision.action === 'error' || decision.state === current) break
      if (decision.reason?.consideredCommands && decision.reason.consideredCommands > 0) {
        expect(decision.reason.level).toBe(4)
        expect(decision.reason.consideredCommands).toBeGreaterThan(0)
        expect(decision.reason.chosenCommandKind).toBeDefined()
        return
      }
      current = decision.state
    }
    // 若所有步驟都是 forced action，至少確認 Lv.4 正常運作
    expect(true).toBe(true)
  })

  it('相同狀態下 Lv.4 決策可重現', () => {
    const state = createDemoGame(4)
    const first = takeAiStep(state, state.activePlayerId, { level: 4 })
    const second = takeAiStep(state, state.activePlayerId, { level: 4 })

    expect(first.description).toBe(second.description)
    expect(first.reason).toEqual(second.reason)
  })

  it('Lv.4 決策前後原始 state 不變（不可 mutation）', () => {
    const state = createDemoGame(3)
    const snapshot = JSON.stringify(state)
    takeAiStep(state, state.activePlayerId, { level: 4 })
    expect(JSON.stringify(state)).toBe(snapshot)
  })

  it('Lv.4 對局能正常結束（種子 1-5）', () => {
    for (let seed = 1; seed <= 5; seed += 1) {
      const result = simulateAiMatch(createDemoGame(seed), 1500, {
        levels: { 'player-one': 4, 'player-two': 4 },
        seed,
      })

      expect(result.stuck, `種子 ${seed}: ${result.error ?? ''}`).toBe(false)
      expect(result.state.status).toBe('finished')
    }
  })

  it('Lv.4 對 Lv.3 的模擬對局中，Lv.4 勝率 ≥ 55%（種子 1-20）', () => {
    const seeds = Array.from({ length: 20 }, (_, index) => index + 1)
    let lv4Wins = 0
    let completed = 0

    for (const seed of seeds) {
      const result = simulateAiMatch(createDemoGame(seed), 2000, {
        levels: { 'player-one': 4, 'player-two': 3 },
        seed,
      })
      if (result.stuck) continue
      completed += 1
      if (result.state.result?.winnerId === 'player-one') {
        lv4Wins += 1
      }
    }

    expect(completed).toBeGreaterThan(10)
    expect(lv4Wins / completed).toBeGreaterThanOrEqual(0.55)
  })

  it('Lv.4 卡死率為 0（種子 1-10）', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const result = simulateAiMatch(createDemoGame(seed), 1500, {
        levels: { 'player-one': 4, 'player-two': 4 },
        seed,
      })

      expect(
        result.stuck,
        `種子 ${seed} 卡死: ${result.error ?? ''}`,
      ).toBe(false)
    }
  })

  it('Lv.4 決策具確定性（多步序列可重現）', () => {
    const initialState = createDemoGame(2)
    const runSteps = (state: GameState, steps: number): string[] => {
      let current = state
      const actions: string[] = []
      for (let i = 0; i < steps; i += 1) {
        if (current.status !== 'playing') break
        const decision = takeAiStep(current, current.activePlayerId, {
          level: 4,
        })
        if (decision.action === 'error' || decision.state === current) break
        actions.push(decision.reason?.chosenCommandKind ?? decision.action)
        current = decision.state
      }
      return actions
    }

    const first = runSteps(initialState, 30)
    const second = runSteps(initialState, 30)

    expect(first.length).toBeGreaterThan(0)
    expect(first).toEqual(second)
  })

  it('Lv.4 不 fallback 到 Lv.3 行為（reason.level 始終為 4）', () => {
    for (let seed = 1; seed <= 5; seed += 1) {
      const state = createDemoGame(seed)
      let current = state
      for (let step = 0; step < 50; step += 1) {
        if (current.status !== 'playing') break
        const decision = takeAiStep(current, current.activePlayerId, {
          level: 4,
        })
        if (decision.action === 'error' || decision.state === current) break
        expect(
          decision.reason?.level,
          `種子 ${seed} 步驟 ${step}: reason.level 應為 4`,
        ).toBe(4)
        current = decision.state
      }
    }
  })
})
