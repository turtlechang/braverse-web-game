import { createGame, selectStartingCookie } from './setup'
import type { GameCard, GameState, PlayerId } from './types'

const createDemoDeck = (playerId: PlayerId): GameCard[] => {
  const label = playerId === 'player-one' ? '勇氣' : '謀略'
  const cards: GameCard[] = [
    {
      id: `${playerId}-starter`,
      instanceId: `${playerId}-starter-1`,
      name: `${label}薑餅勇士`,
      type: 'cookie',
      level: 2,
      hp: 3,
      attack: 1,
    },
    {
      id: `${playerId}-cookie-scout`,
      instanceId: `${playerId}-scout-1`,
      name: `${label}斥候餅乾`,
      type: 'cookie',
      level: 1,
      hp: 2,
      attack: 1,
    },
  ]

  for (let index = cards.length; index < 60; index += 1) {
    cards.push(
      index % 8 === 0
        ? {
            id: `${playerId}-cookie-guard`,
            instanceId: `${playerId}-guard-${index}`,
            name: `${label}守衛餅乾`,
            type: 'cookie',
            level: 1,
            hp: 2,
            attack: 1,
          }
        : {
            id: `${playerId}-item-supply`,
            instanceId: `${playerId}-supply-${index}`,
            name: `${label}補給`,
            type: 'item',
          },
    )
  }

  return cards
}

const identityShuffle = (cards: GameCard[]) => [...cards]

export const createDemoGame = (): GameState => {
  let state = createGame(
    {
      id: 'player-one',
      name: '玩家一',
      deck: createDemoDeck('player-one'),
    },
    {
      id: 'player-two',
      name: '玩家二',
      deck: createDemoDeck('player-two'),
    },
    'player-one',
    identityShuffle,
  )

  state = selectStartingCookie(state, 'player-one', 'player-one-starter-1')
  state = selectStartingCookie(state, 'player-two', 'player-two-starter-1')

  return state
}
