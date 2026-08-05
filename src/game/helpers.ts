import type {
  CookieInBattle,
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

export const createSeededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export const createSeededShuffle = (seed: number): Shuffle => {
  const nextRandom = createSeededRandom(seed)
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

/**
 * 餅乾的有效剩餘 HP：實際附著的 HP 卡張數＋附著卡提供的 HP 加成。
 * 「The Cookie with this card attached for HP gains +1 HP」類 FLIP 卡只要
 * 還附著在 HP，就額外 +1；卡被磨掉／移走時加成隨之消失（由內容推導，
 * 不需要額外的附著／移除鉤子）。所有「剩餘 HP」判定（目標篩選、條件、
 * 傷害結算）都應以這個函式為準。
 */
export const getCookieEffectiveHp = (cookie: CookieInBattle): number =>
  cookie.hpCards.length +
  cookie.hpCards.reduce(
    (bonus, card) => bonus + (card.flip?.attachedHpBonus ?? 0),
    0,
  )

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
