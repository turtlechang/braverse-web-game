import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  takeAiStep,
  type GameState,
} from '.'

describe('AI opponent hand discard decision', () => {
  it('AI deterministically discards hand cards when forced', () => {
    const state = createDemoGame()
    const handCards = state.players['player-two'].hand.slice(0, 3)
    const discardState: GameState = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          hand: handCards,
        },
      },
      activePlayerId: 'player-one',
      phase: 'main',
      pendingOpponentHandDiscard: {
        playerId: 'player-two',
        count: 1,
        sourcePlayerId: 'player-one',
        sourceInstanceId: 'player-one-starter-1',
        sourceCardName: 'Roguefort Cookie',
        effectText: 'opponent-discard-hand',
      },
    }
    const decision = takeAiStep(discardState, 'player-two')
    expect(decision.state.pendingOpponentHandDiscard).toBeNull()
    expect(decision.state.players['player-two'].hand).toHaveLength(
      handCards.length - 1,
    )
  })

  it('AI waits when opponent discard is for the other player', () => {
    const state = createDemoGame()
    const waitState: GameState = {
      ...state,
      activePlayerId: 'player-two',
      phase: 'main',
      pendingOpponentHandDiscard: {
        playerId: 'player-one',
        count: 1,
        sourcePlayerId: 'player-two',
        sourceInstanceId: 'player-two-starter-1',
        sourceCardName: 'Roguefort Cookie',
        effectText: 'opponent-discard-hand',
      },
    }
    const decision = takeAiStep(waitState, 'player-two')
    expect(decision.action).toBe('idle')
    expect(decision.description).toContain('等待')
  })
})