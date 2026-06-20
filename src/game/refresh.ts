import { GameRuleError } from './errors'
import {
  defaultShuffle,
  drawCards,
  findCardIndex,
  updatePlayer,
} from './helpers'
import { continuePendingReplacements } from './replacement'
import { continueInspectDeckAfterRefresh } from './inspect-deck'
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

const replenishPlayerHpCards = (
  state: GameState,
  playerId: PlayerId,
): GameState => {
  const player = state.players[playerId]
  let updatedPlayer = player
  for (const cookie of player.battleArea) {
    const needed = cookie.card.hp - cookie.hpCards.length
    if (needed > 0) {
      const available = updatedPlayer.deck.slice(0, needed)
      updatedPlayer = {
        ...updatedPlayer,
        deck: updatedPlayer.deck.slice(needed),
        battleArea: updatedPlayer.battleArea.map((c) =>
          c.card.instanceId === cookie.card.instanceId
            ? {
                ...c,
                hpCards: [...c.hpCards, ...available],
              }
            : c,
        ),
      }
    }
  }
  return updatePlayer(state, updatedPlayer)
}

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
  }

  // 補足因登場或效果設置 HP 途中耗盡牌庫的餅乾
  const replenishedState = replenishPlayerHpCards(updatedState, playerId)

  const replenishedPlayer = replenishedState.players[playerId]
  const stillNeedsHp = replenishedPlayer.battleArea.some(
    (cookie) => cookie.hpCards.length < cookie.card.hp,
  )
  if (stillNeedsHp && replenishedPlayer.deck.length === 0) {
    if (getRefreshCandidates(replenishedState, playerId).length === 0) {
      return finishWithDefeat(replenishedState, playerId, 'refresh-unavailable')
    }
    return {
      ...replenishedState,
      pendingRefresh: {
        playerId,
        remainingDraws: 0,
      },
    }
  }

  const refreshedState = continueInspectDeckAfterRefresh({
    ...replenishedState,
    pendingRefresh: null,
  })
  return continuePendingReplacements(refreshedState)
}
