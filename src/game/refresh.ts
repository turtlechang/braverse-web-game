import { GameRuleError } from './errors'
import {
  defaultShuffle,
  drawCards,
  findCardIndex,
  updatePlayer,
} from './helpers'
import type {
  CookieCard,
  GameState,
  PlayerId,
  PlayerState,
  Shuffle,
} from './types'
import { finishWithDefeat, resolveBasicVictory } from './victory'

export const getRefreshCandidates = (
  state: GameState,
  playerId: PlayerId,
): CookieCard[] =>
  state.players[playerId].discardPile.filter(
    (card): card is CookieCard =>
      card.type === 'cookie' && card.level >= 1,
  )

export const refreshDeck = (
  state: GameState,
  playerId: PlayerId,
  cookieInstanceId: string,
  shuffle: Shuffle = defaultShuffle,
): GameState => {
  if (state.status !== 'playing') {
    throw new GameRuleError('只有進行中的遊戲可以 Refresh。')
  }

  const player = state.players[playerId]

  if (player.deck.length > 0) {
    throw new GameRuleError('牌庫仍有卡牌，不需要 Refresh。')
  }

  if (state.pendingRefresh && state.pendingRefresh.playerId !== playerId) {
    throw new GameRuleError('目前應由另一位玩家完成 Refresh。')
  }

  const candidateIndex = findCardIndex(
    player.discardPile,
    cookieInstanceId,
  )
  const selectedCookie = player.discardPile[candidateIndex]

  if (
    !selectedCookie ||
    selectedCookie.type !== 'cookie' ||
    selectedCookie.level < 1
  ) {
    throw new GameRuleError('Refresh 必須選擇棄牌區內 LV1 以上的餅乾。')
  }

  const remainingDiscard = player.discardPile.filter(
    (_, index) => index !== candidateIndex,
  )
  let updatedPlayer: PlayerState = {
    ...player,
    deck: shuffle(remainingDiscard),
    discardPile: [],
    breakArea: [...player.breakArea, selectedCookie],
  }
  let updatedState = updatePlayer(state, updatedPlayer)
  updatedState = resolveBasicVictory(updatedState)

  if (updatedState.status === 'finished') {
    return {
      ...updatedState,
      pendingRefresh: null,
    }
  }

  if (updatedPlayer.deck.length === 0) {
    return finishWithDefeat(
      {
        ...updatedState,
        pendingRefresh: null,
      },
      playerId,
      'refresh-unavailable',
    )
  }

  const remainingDraws =
    state.pendingRefresh?.playerId === playerId
      ? state.pendingRefresh.remainingDraws
      : 0

  if (remainingDraws > 0) {
    const drawAmount = Math.min(updatedPlayer.deck.length, remainingDraws)
    updatedPlayer = drawCards(updatedPlayer, drawAmount)
    updatedState = updatePlayer(updatedState, updatedPlayer)

    if (drawAmount < remainingDraws) {
      return finishWithDefeat(
        {
          ...updatedState,
          pendingRefresh: null,
        },
        playerId,
        'refresh-unavailable',
      )
    }

    if (updatedPlayer.deck.length === 0) {
      return finishWithDefeat(
        {
          ...updatedState,
          pendingRefresh: null,
        },
        playerId,
        'refresh-unavailable',
      )
    }
  }

  return {
    ...updatedState,
    pendingRefresh: null,
  }
}
