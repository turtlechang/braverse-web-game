import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  evaluatePlayerView,
  createPlayerView,
  applyGameCommand,
  simulateAiMatch,
  takeAiStep,
  type GameState,
  type PlayerView,
} from '.'

const emptySide = (id: 'player-one' | 'player-two'): PlayerView['self'] => ({
  id,
  name: id,
  handCount: 3,
  deckCount: 40,
  battleArea: [],
  supportArea: [],
  breakArea: [],
  discardPile: [],
  stage: null,
})

const baseView = (): PlayerView => ({
  viewerId: 'player-one',
  hand: [],
  self: emptySide('player-one'),
  opponent: emptySide('player-two'),
  turnNumber: 1,
  phase: 'main',
  status: 'playing',
  activePlayerId: 'player-one',
  firstPlayerId: 'player-one',
  result: null,
  supportPlacedThisTurn: false,
  attackModifiers: [],
  damageReceivedModifiers: [],
})

describe('Lv.3 評估式 AI', () => {
  it('決策附帶 Lv.3 結構化 reason', () => {
    const state = applyGameCommand(createDemoGame(1), {
      kind: 'advance-phase',
      playerId: 'player-one',
    })
    const decision = takeAiStep(state, state.activePlayerId, { level: 3 })

    expect(decision.reason?.level).toBe(3)
    expect(decision.reason?.actionScore?.scoreType).toBe('relative-action-score')
    expect(decision.reason?.actionScore?.contributions).toEqual(
      expect.any(Array),
    )
  })

  it('Lv.1、Lv.2 不會附加 Lv.3 action score', () => {
    const state = applyGameCommand(createDemoGame(1), {
      kind: 'advance-phase',
      playerId: 'player-one',
    })

    expect(takeAiStep(state, state.activePlayerId, { level: 1 }).reason?.actionScore)
      .toBeUndefined()
    expect(takeAiStep(state, state.activePlayerId, { level: 2 }).reason?.actionScore)
      .toBeUndefined()
  })

  it('evaluatePlayerView 對己方場面優勢給正分、劣勢給負分', () => {
    const baseline = evaluatePlayerView(baseView())

    const advantaged: PlayerView = {
      ...baseView(),
      self: {
        ...baseView().self,
        battleArea: [
          {
            card: {
              id: 'x',
              instanceId: 'x',
              name: 'X',
              type: 'cookie',
              level: 1,
              hp: 3,
              attack: 1,
              attackCost: 1,
            },
            hpCount: 3,
            rested: false,
          },
        ],
      },
    }
    expect(evaluatePlayerView(advantaged)).toBeGreaterThan(baseline)

    const disadvantaged: PlayerView = {
      ...baseView(),
      opponent: {
        ...baseView().opponent,
        battleArea: [
          {
            card: {
              id: 'y',
              instanceId: 'y',
              name: 'Y',
              type: 'cookie',
              level: 1,
              hp: 3,
              attack: 1,
              attackCost: 1,
            },
            hpCount: 3,
            rested: false,
          },
        ],
      },
    }
    expect(evaluatePlayerView(disadvantaged)).toBeLessThan(baseline)
  })

  it('evaluatePlayerView 對已結束對局回傳勝負分數', () => {
    let state = createDemoGame(1)
    state = {
      ...state,
      status: 'finished',
      result: { winnerId: 'player-one', loserId: 'player-two', reason: 'no-cookie-available' },
    }

    expect(evaluatePlayerView(createPlayerView(state, 'player-one'))).toBeGreaterThan(0)
    expect(evaluatePlayerView(createPlayerView(state, 'player-two'))).toBeLessThan(0)
  })

  it('Lv.3 對局能正常結束（種子 1-5）', () => {
    for (let seed = 1; seed <= 5; seed += 1) {
      const result = simulateAiMatch(createDemoGame(seed), 1500, {
        levels: { 'player-one': 3, 'player-two': 3 },
        seed,
      })

      expect(result.stuck, `種子 ${seed}: ${result.error ?? ''}`).toBe(false)
      expect(result.state.status).toBe('finished')
    }
  })

  it('Lv.3 對 Lv.1 的多場模擬中，Lv.3 的勝率明顯較高', () => {
    const seeds = Array.from({ length: 20 }, (_, index) => index + 1)
    let lv3Wins = 0
    let completed = 0

    for (const seed of seeds) {
      const result = simulateAiMatch(createDemoGame(seed), 2000, {
        levels: { 'player-one': 3, 'player-two': 1 },
        seed,
      })
      if (result.stuck) continue
      completed += 1
      if (result.state.result?.winnerId === 'player-one') {
        lv3Wins += 1
      }
    }

    expect(completed).toBeGreaterThan(10)
    expect(lv3Wins / completed).toBeGreaterThanOrEqual(0.55)
  })

  it('相同狀態下 Lv.3 決策可重現（無亂數依賴時應完全一致）', () => {
    const state: GameState = createDemoGame(4)
    const first = takeAiStep(state, state.activePlayerId, { level: 3 })
    const second = takeAiStep(state, state.activePlayerId, { level: 3 })

    expect(first.description).toBe(second.description)
    expect(first.reason).toEqual(second.reason)
  })
})
