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
        count: 2,
        sourcePlayerId: 'player-one',
        sourceInstanceId: 'player-one-starter-1',
        sourceCardName: 'Roguefort Cookie',
        effectText: 'opponent-discard-hand',
      },
    }
    const decision = takeAiStep(discardState, 'player-two')
    expect(decision.state.pendingOpponentHandDiscard).toBeNull()
    expect(decision.state.players['player-two'].hand).toHaveLength(
      handCards.length - 2,
    )
    expect(decision.revealedCards?.map((card) => card.instanceId)).toEqual(
      handCards.slice(0, 2).map((card) => card.instanceId),
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

  it('AI resolves ST5-004 forced discard before the fainted player replacement', () => {
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
      activePlayerId: 'player-two',
      phase: 'main',
      pendingReplacement: {
        tasks: [{ playerId: 'player-one', remaining: 1 }],
      },
      pendingOpponentHandDiscard: {
        playerId: 'player-two',
        count: 1,
        sourcePlayerId: 'player-one',
        sourceInstanceId: 'st5-004-fainted',
        sourceCardName: 'Skater Cookie',
        effectText: 'opponent-discard-hand',
      },
    }

    const decision = takeAiStep(discardState, 'player-two')

    expect(decision.state.pendingOpponentHandDiscard).toBeNull()
    expect(decision.state.pendingReplacement).toEqual(
      discardState.pendingReplacement,
    )
    expect(decision.state.players['player-two'].hand).toHaveLength(
      handCards.length - 1,
    )
    expect(decision.revealedCards).toEqual([handCards[0]])
  })
})
