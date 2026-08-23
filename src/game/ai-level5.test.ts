import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  createPlayerView,
  simulateAiMatch,
  takeAiStep,
  type GameState,
} from '.'

const reachFreeChoice = (initial: GameState): GameState => {
  let current = initial
  for (let step = 0; step < 30; step += 1) {
    if (
      current.status === 'playing' &&
      !current.pendingRefresh &&
      !current.pendingReplacement &&
      !current.pendingOnPlay &&
      !current.pendingBattle &&
      (current.phase === 'support' || current.phase === 'main')
    ) return current
    const decision = takeAiStep(current, current.activePlayerId, { level: 2 })
    if (decision.action === 'error' || decision.state === current) break
    current = decision.state
  }
  throw new Error('fixture 未進入 free-choice 狀態')
}

const swapOpponentHiddenCards = (state: GameState): GameState => {
  const playerId = state.activePlayerId
  const opponentId = playerId === 'player-one' ? 'player-two' : 'player-one'
  const opponent = state.players[opponentId]
  if (opponent.hand.length === 0 || opponent.deck.length === 0) return state
  return {
    ...state,
    players: {
      ...state.players,
      [opponentId]: {
        ...opponent,
        hand: [opponent.deck[0], ...opponent.hand.slice(1)],
        deck: [opponent.hand[0], ...opponent.deck.slice(1)],
      },
    },
  }
}

describe('Lv.5 高手對抗 AI', () => {
  it('決策可重現、不 mutation，並回傳可延續的每場策略記憶', () => {
    const state = reachFreeChoice(createDemoGame(5))
    const snapshot = JSON.stringify(state)
    const first = takeAiStep(state, state.activePlayerId, { level: 5, seed: 5 })
    const second = takeAiStep(state, state.activePlayerId, { level: 5, seed: 5 })

    expect(JSON.stringify(state)).toBe(snapshot)
    expect(first.action).toBe(second.action)
    expect(first.description).toBe(second.description)
    expect(first.reason?.level).toBe(5)
    expect(first.reason?.strategyMemory?.decisionCount).toBe(1)
    expect(first.reason?.opponentResponse).toEqual(second.reason?.opponentResponse)

    const continued = takeAiStep(first.state, state.activePlayerId, {
      level: 5,
      seed: 5,
      memory: first.reason?.strategyMemory,
    })
    expect(continued.reason?.strategyMemory?.decisionCount).toBe(2)
  })

  it('相同 PlayerView 下改變對手隱藏手牌卡面，不會改變 Lv.5 選擇', () => {
    const state = reachFreeChoice(createDemoGame(7))
    const hiddenVariant = swapOpponentHiddenCards(state)
    expect(createPlayerView(hiddenVariant, state.activePlayerId))
      .toEqual(createPlayerView(state, state.activePlayerId))

    const first = takeAiStep(state, state.activePlayerId, { level: 5, seed: 7 })
    const second = takeAiStep(hiddenVariant, state.activePlayerId, { level: 5, seed: 7 })
    expect({
      action: first.action,
      description: first.description,
      chosen: first.reason?.chosenCommandKind,
      score: first.reason?.actionScore,
      response: first.reason?.opponentResponse,
    }).toEqual({
      action: second.action,
      description: second.description,
      chosen: second.reason?.chosenCommandKind,
      score: second.reason?.actionScore,
      response: second.reason?.opponentResponse,
    })
  })

  it('Lv.5 mirror 種子 1-3 能正常結束且不會卡死', () => {
    for (let seed = 1; seed <= 3; seed += 1) {
      const result = simulateAiMatch(createDemoGame(seed), 1500, {
        levels: { 'player-one': 5, 'player-two': 5 },
        seed,
      })
      expect(result.stuck, `種子 ${seed}: ${result.error ?? ''}`).toBe(false)
      expect(result.state.status).toBe('finished')
    }
  }, 120000)
})
