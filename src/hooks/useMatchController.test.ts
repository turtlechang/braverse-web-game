import { describe, expect, it } from 'vitest'
import { createDemoGame, type GameState, type ReplacementTask } from '../game'
import { getPendingChoicePlayerId } from './useMatchController'

const replacementTask: ReplacementTask = {
  playerId: 'player-one',
  remaining: 1,
}

const withReplacement = (state: GameState): GameState => ({
  ...state,
  pendingReplacement: { tasks: [replacementTask] },
})

describe('getPendingChoicePlayerId', () => {
  it('hides replacement choice while a higher priority pending decision must resolve first', () => {
    const state: GameState = {
      ...withReplacement(createDemoGame()),
      pendingOpponentHandDiscard: {
        playerId: 'player-one',
        count: 1,
        sourcePlayerId: 'player-two',
        sourceInstanceId: 'discard-source',
        sourceCardName: 'Discard Source',
        effectText: 'opponent-discard-hand',
      },
    }

    expect(getPendingChoicePlayerId(state, replacementTask)).toBeUndefined()
  })

  it('hides replacement choice before pending faint effects', () => {
    const state: GameState = {
      ...withReplacement(createDemoGame()),
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: 'faint-source',
          sourceCardName: 'Faint Source',
          effect: {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          context: {
            sourcePlayerId: 'player-one',
            sourceInstanceId: 'faint-source',
            sourceCardName: 'Faint Source',
          },
        },
      ],
    }

    expect(getPendingChoicePlayerId(state, replacementTask)).toBeUndefined()
  })

  it('hides replacement choice before unresolved effect order', () => {
    const state: GameState = {
      ...withReplacement(createDemoGame()),
      pendingEffectOrder: {
        playerId: 'player-one',
        items: [
          {
            id: 'effect-1',
            kind: 'faint-effect',
            sourcePlayerId: 'player-one',
            sourceInstanceId: 'faint-source',
            sourceCardName: 'Faint Source',
          },
        ],
      },
    }

    expect(getPendingChoicePlayerId(state, replacementTask)).toBeUndefined()
  })

  it('shows refresh choice before replacement choice', () => {
    const state: GameState = {
      ...withReplacement(createDemoGame()),
      pendingRefresh: {
        playerId: 'player-two',
        remainingDraws: 0,
      },
    }

    expect(getPendingChoicePlayerId(state, replacementTask)).toBe('player-two')
  })
})
