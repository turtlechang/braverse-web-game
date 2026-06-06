import { GameRuleError } from './errors'
import {
  defaultShuffle,
  drawCards,
  findCardIndex,
  PLAYER_IDS,
  updatePlayer,
} from './helpers'
import type {
  CookieCard,
  GameState,
  PlayerId,
  PlayerSetup,
  PlayerState,
  Shuffle,
} from './types'

const OPENING_HAND_SIZE = 6

const createPlayerState = (
  setup: PlayerSetup,
  shuffle: Shuffle,
): PlayerState =>
  drawCards(
    {
      id: setup.id,
      name: setup.name,
      deck: shuffle(setup.deck),
      hand: [],
      battleArea: [],
      supportArea: [],
      breakArea: [],
      discardPile: [],
      stage: null,
      hasMulliganed: false,
      startingCookieSelected: false,
    },
    OPENING_HAND_SIZE,
  )

export const createGame = (
  playerOne: PlayerSetup,
  playerTwo: PlayerSetup,
  firstPlayerId: PlayerId,
  shuffle: Shuffle = defaultShuffle,
): GameState => {
  if (playerOne.id === playerTwo.id) {
    throw new GameRuleError('兩位玩家必須使用不同的玩家 ID。')
  }

  if (!PLAYER_IDS.includes(firstPlayerId)) {
    throw new GameRuleError('先攻玩家 ID 無效。')
  }

  const players = {
    [playerOne.id]: createPlayerState(playerOne, shuffle),
    [playerTwo.id]: createPlayerState(playerTwo, shuffle),
  } as Record<PlayerId, PlayerState>

  if (!players['player-one'] || !players['player-two']) {
    throw new GameRuleError('遊戲需要 player-one 與 player-two。')
  }

  return {
    players,
    firstPlayerId,
    activePlayerId: firstPlayerId,
    turnNumber: 1,
    phase: 'active',
    status: 'setup',
    result: null,
  }
}

export const mulliganOpeningHand = (
  state: GameState,
  playerId: PlayerId,
  shuffle: Shuffle = defaultShuffle,
): GameState => {
  if (state.status !== 'setup') {
    throw new GameRuleError('只有開局準備期間可以重抽。')
  }

  const player = state.players[playerId]

  if (player.hasMulliganed) {
    throw new GameRuleError('每位玩家只能自願重抽一次。')
  }

  if (player.startingCookieSelected) {
    throw new GameRuleError('選擇起始餅乾後不能重抽。')
  }

  const resetPlayer = drawCards(
    {
      ...player,
      deck: shuffle([...player.deck, ...player.hand]),
      hand: [],
      hasMulliganed: true,
    },
    OPENING_HAND_SIZE,
  )

  return updatePlayer(state, resetPlayer)
}

export const selectStartingCookie = (
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState => {
  if (state.status !== 'setup') {
    throw new GameRuleError('目前不是選擇起始餅乾的時機。')
  }

  const player = state.players[playerId]

  if (player.startingCookieSelected) {
    throw new GameRuleError('此玩家已選擇起始餅乾。')
  }

  const cardIndex = findCardIndex(player.hand, instanceId)
  const selectedCard = player.hand[cardIndex]

  if (!selectedCard || selectedCard.type !== 'cookie') {
    throw new GameRuleError('起始卡牌必須是手牌中的餅乾卡。')
  }

  if (player.deck.length < selectedCard.hp) {
    throw new GameRuleError('牌庫張數不足，無法配置起始餅乾 HP。')
  }

  const cookie = selectedCard as CookieCard
  const hpCards = player.deck.slice(0, cookie.hp)
  const updatedPlayer: PlayerState = {
    ...player,
    deck: player.deck.slice(cookie.hp),
    hand: player.hand.filter((_, index) => index !== cardIndex),
    battleArea: [
      {
        card: cookie,
        hpCards,
        rested: false,
      },
    ],
    startingCookieSelected: true,
  }

  const updatedState = updatePlayer(state, updatedPlayer)
  const setupComplete = PLAYER_IDS.every(
    (id) => updatedState.players[id].startingCookieSelected,
  )

  return setupComplete
    ? {
        ...updatedState,
        status: 'playing',
      }
    : updatedState
}

