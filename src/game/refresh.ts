import { GameRuleError } from './errors'
import {
  defaultShuffle,
  drawCards,
  findCardIndex,
  updatePlayer,
} from './helpers'
import { continuePendingReplacements } from './replacement'
import { continueInspectDeckAfterRefresh } from './inspect-deck'
import { executeDeckToTrash } from './effects/deck-to-trash'
import type {
  CookieCard,
  GameState,
  PlayerId,
  PlayerState,
  Shuffle,
} from './types'
import { finishWithDefeat, resolveBasicVictory } from './victory'

type PendingHpSetups = NonNullable<
  NonNullable<GameState['pendingRefresh']>['remainingHpSetup']
>

type PendingHpGains = NonNullable<
  NonNullable<GameState['pendingRefresh']>['remainingHpGains']
>

export const getRefreshCandidates = (
  state: GameState,
  playerId: PlayerId,
): CookieCard[] =>
  state.players[playerId].discardPile.filter(
    (card): card is CookieCard =>
      card.type === 'cookie' && card.level >= 1,
  )

const continuePendingHpGain = (
  state: GameState,
  playerId: PlayerId,
  pendingHpGain: NonNullable<GameState['pendingRefresh']>['remainingHpGain'],
): GameState => {
  if (!pendingHpGain || pendingHpGain.amount <= 0) return state
  const player = state.players[playerId]
  const targetIndex = player.battleArea.findIndex(
    (cookie) => cookie.card.instanceId === pendingHpGain.targetInstanceId,
  )
  if (targetIndex < 0) return state

  const gainedCards = player.deck.slice(0, pendingHpGain.amount)
  return updatePlayer(state, {
    ...player,
    deck: player.deck.slice(gainedCards.length),
    battleArea: player.battleArea.map((cookie, index) =>
      index === targetIndex
        ? { ...cookie, hpCards: [...cookie.hpCards, ...gainedCards] }
        : cookie,
    ),
  })
}

const continuePendingHpGains = (
  state: GameState,
  playerId: PlayerId,
  pendingHpGains?: PendingHpGains,
): { state: GameState; remainingHpGains: PendingHpGains } => {
  let nextState = state
  const remainingHpGains: PendingHpGains = []

  for (let index = 0; index < (pendingHpGains?.length ?? 0); index += 1) {
    const pendingHpGain = pendingHpGains![index]
    const player = nextState.players[playerId]
    const targetIndex = player.battleArea.findIndex(
      (cookie) => cookie.card.instanceId === pendingHpGain.targetInstanceId,
    )
    if (targetIndex < 0) continue

    const gainedCards = player.deck.slice(0, pendingHpGain.amount)
    nextState = updatePlayer(nextState, {
      ...player,
      deck: player.deck.slice(gainedCards.length),
      battleArea: player.battleArea.map((cookie, cookieIndex) =>
        cookieIndex === targetIndex
          ? { ...cookie, hpCards: [...cookie.hpCards, ...gainedCards] }
          : cookie,
      ),
    })

    const remainingAmount = pendingHpGain.amount - gainedCards.length
    if (remainingAmount > 0) {
      remainingHpGains.push(
        { ...pendingHpGain, amount: remainingAmount },
        ...pendingHpGains!.slice(index + 1),
      )
      break
    }
  }

  return { state: nextState, remainingHpGains }
}

const continuePendingHpSetups = (
  state: GameState,
  playerId: PlayerId,
  pendingHpSetups?: PendingHpSetups,
): {
  state: GameState
  remainingHpSetups: PendingHpSetups
} => {
  let nextState = state
  const remainingHpSetups: PendingHpSetups = []

  for (let index = 0; index < (pendingHpSetups?.length ?? 0); index += 1) {
    const pendingHpSetup = pendingHpSetups![index]
    const player = nextState.players[playerId]
    const targetIndex = player.battleArea.findIndex(
      (cookie) => cookie.card.instanceId === pendingHpSetup.targetInstanceId,
    )
    if (targetIndex < 0) continue

    const gainedCards = player.deck.slice(0, pendingHpSetup.amount)
    nextState = updatePlayer(nextState, {
      ...player,
      deck: player.deck.slice(gainedCards.length),
      battleArea: player.battleArea.map((cookie, cookieIndex) =>
        cookieIndex === targetIndex
          ? { ...cookie, hpCards: [...cookie.hpCards, ...gainedCards] }
          : cookie,
      ),
    })

    const remainingAmount = pendingHpSetup.amount - gainedCards.length
    if (remainingAmount > 0) {
      remainingHpSetups.push(
        { ...pendingHpSetup, amount: remainingAmount },
        ...pendingHpSetups!.slice(index + 1),
      )
      break
    }
  }

  return { state: nextState, remainingHpSetups }
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
  const pendingHpGain =
    state.pendingRefresh?.playerId === playerId
      ? state.pendingRefresh.remainingHpGain
      : undefined
  const pendingHpGains =
    state.pendingRefresh?.playerId === playerId
      ? state.pendingRefresh.remainingHpGains
      : undefined
  const pendingHpSetups =
    state.pendingRefresh?.playerId === playerId
      ? state.pendingRefresh.remainingHpSetup
      : undefined

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

  const hpSetupResult = continuePendingHpSetups(
    updatedState,
    playerId,
    pendingHpSetups,
  )
  const hpSetupState = hpSetupResult.state
  if (hpSetupResult.remainingHpSetups.length > 0) {
    if (getRefreshCandidates(hpSetupState, playerId).length === 0) {
      return finishWithDefeat(hpSetupState, playerId, 'refresh-unavailable')
    }
    return {
      ...hpSetupState,
      pendingRefresh: {
        playerId,
        remainingDraws: 0,
        remainingHpSetup: hpSetupResult.remainingHpSetups,
      },
    }
  }

  const hpGainsResult = continuePendingHpGains(
    hpSetupState,
    playerId,
    pendingHpGains,
  )
  if (hpGainsResult.remainingHpGains.length > 0) {
    if (getRefreshCandidates(hpGainsResult.state, playerId).length === 0) {
      return finishWithDefeat(hpGainsResult.state, playerId, 'refresh-unavailable')
    }
    return {
      ...hpGainsResult.state,
      pendingRefresh: {
        playerId,
        remainingDraws: 0,
        remainingHpGains: hpGainsResult.remainingHpGains,
      },
    }
  }

  const hpGainState = continuePendingHpGain(
    hpGainsResult.state,
    playerId,
    pendingHpGain,
  )
  const remainingHpGain = pendingHpGain
    ? pendingHpGain.amount -
      Math.max(
        0,
        hpSetupState.players[playerId].deck.length -
          hpGainState.players[playerId].deck.length,
      )
    : 0
  if (hpGainState.players[playerId].deck.length === 0) {
    if (getRefreshCandidates(hpGainState, playerId).length === 0) {
      return finishWithDefeat(hpGainState, playerId, 'refresh-unavailable')
    }
    return {
      ...hpGainState,
      pendingRefresh: {
        playerId,
        remainingDraws: 0,
        ...(pendingHpGain && remainingHpGain > 0
          ? {
              remainingHpGain: {
                ...pendingHpGain,
                amount: remainingHpGain,
              },
            }
          : {}),
      },
    }
  }

  const refreshedState = continueInspectDeckAfterRefresh({
    ...hpGainState,
    pendingRefresh: null,
  })
  const remainingMill = state.pendingRefresh?.remainingDeckToTrash
  if (remainingMill) {
    return continuePendingReplacements(executeDeckToTrash(refreshedState, remainingMill.context, remainingMill.effect, remainingMill.movedCards))
  }
  return continuePendingReplacements(refreshedState)
}
