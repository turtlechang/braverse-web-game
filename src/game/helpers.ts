import type {
  GameCard,
  GameState,
  PlayerId,
  PlayerState,
  Shuffle,
} from './types'

export const PLAYER_IDS: PlayerId[] = ['player-one', 'player-two']

const fisherYatesShuffle = (
  cards: GameCard[],
  nextRandom: () => number,
): GameCard[] => {
  const shuffled = [...cards]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandom() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ]
  }

  return shuffled
}

export const defaultShuffle: Shuffle = (cards) =>
  fisherYatesShuffle(cards, Math.random)

export const createSeededShuffle = (seed: number): Shuffle => {
  let state = seed >>> 0

  const nextRandom = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  return (cards) => fisherYatesShuffle(cards, nextRandom)
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
