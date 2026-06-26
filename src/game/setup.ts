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
      freeMulliganDecided: false,
      forcedMulliganCount: 0,
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
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 1,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    skipAttackUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: {
      'player-one': 0,
      'player-two': 0,
    },
    pendingOnPlay: null,
    pendingRefresh: null,
    pendingBattle: null,
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
      freeMulliganDecided: true,
    },
    OPENING_HAND_SIZE,
  )

  return updatePlayer(state, resetPlayer)
}

export const keepOpeningHand = (
  state: GameState,
  playerId: PlayerId,
): GameState => {
  if (state.status !== 'setup') {
    throw new GameRuleError('只能在開局設定時保留起始手牌。')
  }

  const player = state.players[playerId]
  if (player.freeMulliganDecided) {
    throw new GameRuleError('已完成自由調度決定。')
  }

  return updatePlayer(state, {
    ...player,
    freeMulliganDecided: true,
  })
}

export const forceMulliganOpeningHand = (
  state: GameState,
  playerId: PlayerId,
  shuffle: Shuffle = defaultShuffle,
): GameState => {
  if (state.status !== 'setup') {
    throw new GameRuleError('只能在開局設定時進行強制調度。')
  }

  const player = state.players[playerId]
  if (player.hand.some((card) => card.type === 'cookie')) {
    throw new GameRuleError('手牌已有餅乾，不需要強制調度。')
  }

  const resetPlayer = drawCards(
    {
      ...player,
      deck: shuffle([...player.deck, ...player.hand]),
      hand: [],
      freeMulliganDecided: true,
      forcedMulliganCount: (player.forcedMulliganCount ?? 0) + 1,
    },
    OPENING_HAND_SIZE,
  )

  return updatePlayer(state, resetPlayer)
}

export const drawMulliganCompensation = (
  state: GameState,
  playerId: PlayerId,
): GameState => {
  if (state.status !== 'setup') {
    throw new GameRuleError('只能在開局設定時抽取調度補償。')
  }

  const player = state.players[playerId]
  if (player.deck.length === 0) {
    throw new GameRuleError('牌庫沒有可抽取的調度補償。')
  }

  return updatePlayer(state, drawCards(player, 1))
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

  const cookie = selectedCard as CookieCard
  const hpCards = player.deck.slice(0, cookie.hp)
  const battleEntryId =
    `${cookie.instanceId}:battle:${state.nextBattleEntrySequence}`
  const updatedPlayer: PlayerState = {
    ...player,
    deck: player.deck.slice(cookie.hp),
    hand: player.hand.filter((_, index) => index !== cardIndex),
    battleArea: [
      {
        card: cookie,
        hpCards,
        rested: false,
        battleEntryId,
      },
    ],
    startingCookieSelected: true,
  }

  const updatedState = {
    ...updatePlayer(state, updatedPlayer),
    nextBattleEntrySequence: state.nextBattleEntrySequence + 1,
  }
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
