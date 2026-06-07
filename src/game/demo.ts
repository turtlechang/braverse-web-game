import { createGame, selectStartingCookie } from './setup'
import { createOfficialStarterDeck } from './starter-deck'
import type { GameCard, GameState } from './types'

const identityShuffle = (cards: GameCard[]) => [...cards]

export const createDemoGame = (): GameState => {
  let state = createGame(
    {
      id: 'player-one',
      name: '玩家',
      deck: createOfficialStarterDeck('player-one'),
    },
    {
      id: 'player-two',
      name: 'AI 對手',
      deck: createOfficialStarterDeck('player-two'),
    },
    'player-one',
    identityShuffle,
  )

  state = selectStartingCookie(
    state,
    'player-one',
    'player-one-ST1-001-1',
  )
  state = selectStartingCookie(
    state,
    'player-two',
    'player-two-ST1-001-1',
  )

  return state
}
