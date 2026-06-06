import type {
  GameCard,
  GameState,
  PlayerId,
  PlayerState,
  Shuffle,
} from './types'

export const PLAYER_IDS: PlayerId[] = ['player-one', 'player-two']

export const defaultShuffle: Shuffle = (cards) => {
  const shuffled = [...cards]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ]
  }

  return shuffled
}

export const drawCards = (
  player: PlayerState,
  amount: number,
): PlayerState => {
  if (amount <= 0) {
    return player
  }

  const drawnCards = player.deck.slice(0, amount)

  return {
    ...player,
    deck: player.deck.slice(drawnCards.length),
    hand: [...player.hand, ...drawnCards],
  }
}

export const getOpponentId = (playerId: PlayerId): PlayerId =>
  playerId === 'player-one' ? 'player-two' : 'player-one'

export const updatePlayer = (
  state: GameState,
  player: PlayerState,
): GameState => ({
  ...state,
  players: {
    ...state.players,
    [player.id]: player,
  },
})

export const findCardIndex = (
  cards: GameCard[],
  instanceId: string,
): number => cards.findIndex((card) => card.instanceId === instanceId)

