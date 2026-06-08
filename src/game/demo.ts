import { createSeededShuffle } from './helpers'
import { createGame, selectStartingCookie } from './setup'
import { createOfficialStarterDeck } from './starter-deck'
import type { GameCard, GameState } from './types'

const identityShuffle = (cards: GameCard[]) => [...cards]

const selectFirstCookie = (
  state: GameState,
  playerId: 'player-one' | 'player-two',
) => {
  const cookie = state.players[playerId].hand.find(
    (card) => card.type === 'cookie',
  )

  if (!cookie) {
    throw new Error(`種子牌序未讓 ${playerId} 抽到起始餅乾。`)
  }

  return selectStartingCookie(state, playerId, cookie.instanceId)
}

export const createDemoGame = (seed?: number): GameState => {
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
    seed === undefined ? identityShuffle : createSeededShuffle(seed),
  )

  state = selectFirstCookie(state, 'player-one')
  state = selectFirstCookie(state, 'player-two')

  return state
}
