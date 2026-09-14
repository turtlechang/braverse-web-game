import { GameRuleError } from './errors'
import {
  defaultShuffle,
  drawCards,
  findCardIndex,
  getOpponentId,
  updatePlayer,
} from './helpers'
import { continuePendingReplacements } from './replacement'
import { continueInspectDeckAfterRefresh } from './inspect-deck'
import { executeDeckToTrash } from './effects/deck-to-trash'
import { executeCardEffect } from './effects/execute'
import { isEffectConditionMet, requiresEffectCardSelection } from './effects/targeting'
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

type PendingAfterDrawContinuation = NonNullable<
  NonNullable<GameState['pendingRefresh']>['afterDrawContinuation']
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

/**
 * Resume a draw-up-to Then chain after Refresh has supplied a new deck.
 * This mirrors the normal `resolveDrawUpTo` continuation path, but lives here
 * because Refresh is the command boundary that owns the interrupted state.
 */
const continueAfterDrawUpTo = (
  state: GameState,
  continuation: PendingAfterDrawContinuation,
): GameState => {
  let updatedState = state
  for (let effectIndex = 0; effectIndex < continuation.effects.length; effectIndex += 1) {
    const effect = continuation.effects[effectIndex]
    if (!isEffectConditionMet(updatedState, continuation.context, effect)) continue
    if (requiresEffectCardSelection(effect)) {
      return {
        ...updatedState,
        pendingAbilityEffect: {
          playerId: continuation.context.sourcePlayerId,
          sourcePlayerId: continuation.context.sourcePlayerId,
          sourceInstanceId: continuation.context.sourceInstanceId,
          sourceCardName: continuation.context.sourceCardName,
          sourceKind: continuation.sourceKind,
          effects: continuation.effects,
          effectIndex,
          battleContinuation: continuation.battleContinuation,
        },
      }
    }
    updatedState = executeCardEffect(updatedState, continuation.context, effect, [])
    if (updatedState.pendingOpponentHandDiscard) {
      updatedState = {
        ...updatedState,
        pendingOpponentHandDiscard: {
          ...updatedState.pendingOpponentHandDiscard,
          chainedFromDrawUpTo: true,
        },
      }
    }
    if (
      updatedState.pendingDrawUpTo ||
      updatedState.pendingOpponentHandDiscard ||
      updatedState.pendingInspectDeck ||
      updatedState.pendingRevealTopDeck ||
      updatedState.pendingOptionalCostAttack ||
      updatedState.pendingStageTrigger
    ) {
      break
    }
  }
  return resolveBasicVictory(updatedState)
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

  const requiredCookieCount = getRefreshCookieBreakCount(state, playerId)
  const eligible = getRefreshCandidates(state, playerId)
  const selectedCookies: CookieCard[] = []
  if (requiredCookieCount > 0) {
    const candidateIndex = findCardIndex(player.discardPile, cookieInstanceId)
    const selectedCookie = player.discardPile[candidateIndex]
    if (!selectedCookie || selectedCookie.type !== 'cookie' || selectedCookie.level < 1) {
      throw new GameRuleError('Refresh 必須選擇棄牌區內 LV1 以上的餅乾。')
    }
    selectedCookies.push(selectedCookie)
    // The command protocol currently carries one selected instance.  For
    // BS9-111, complete the second required Cookie deterministically from the
    // remaining legal candidates; the selected card remains the first choice.
    for (const candidate of eligible) {
      if (selectedCookies.length >= requiredCookieCount) break
      if (!selectedCookies.some((cookie) => cookie.instanceId === candidate.instanceId)) {
        selectedCookies.push(candidate)
      }
    }
    if (selectedCookies.length < requiredCookieCount) {
      throw new GameRuleError(`Refresh 必須選擇 ${requiredCookieCount} 張 LV1 以上的餅乾。`)
    }
  }

  const selectedIds = new Set(selectedCookies.map((cookie) => cookie.instanceId))
  const remainingDiscard = player.discardPile.filter((card) => !selectedIds.has(card.instanceId))
  let updatedPlayer: PlayerState = {
    ...player,
    deck: shuffle(remainingDiscard),
    discardPile: [],
    breakArea: [...player.breakArea, ...selectedCookies],
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
  const afterDrawContinuation =
    state.pendingRefresh?.playerId === playerId
      ? state.pendingRefresh.afterDrawContinuation
      : undefined
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
        ...(afterDrawContinuation ? { afterDrawContinuation } : {}),
        remainingHpSetup: hpSetupResult.remainingHpSetups,
      },
    }
  }

  const hpGainsResult = continuePendingHpGains(
    hpSetupState,
    playerId,
    pendingHpGains,
  )

function getRefreshCookieBreakCount(
  state: GameState,
  playerId: PlayerId,
): number {
  // Refresh replacement rules are split by their printed subject.  A
  // controller's own passive (for example BS9-096) applies while that player
  // refreshes, whereas BS9-111 explicitly changes the opponent's Refresh.
  // Scan the refreshing player's area for self-scoped prevention first, then
  // scan the opponent's area for opponent-scoped count overrides.
  const player = state.players[playerId]
  const ownPassiveEffects = player.battleArea.flatMap((entry) => {
    const skill = entry.card.skill
    if (!skill || skill.trigger !== 'passive') return []
    return [...skill.effects, ...(skill.passiveEffects ?? [])]
  })
  if (ownPassiveEffects.some((effect) => effect.kind === 'prevent-refresh-cookie-break')) return 0

  const opponentPassiveEffects = state.players[getOpponentId(playerId)].battleArea.flatMap((entry) => {
    const skill = entry.card.skill
    if (!skill || skill.trigger !== 'passive') return []
    return [...skill.effects, ...(skill.passiveEffects ?? [])]
  })
  const override = opponentPassiveEffects.find((effect) => effect.kind === 'refresh-cookie-break-count')
  return override?.kind === 'refresh-cookie-break-count' ? Math.max(1, override.count) : 1
}
  if (hpGainsResult.remainingHpGains.length > 0) {
    if (getRefreshCandidates(hpGainsResult.state, playerId).length === 0) {
      return finishWithDefeat(hpGainsResult.state, playerId, 'refresh-unavailable')
    }
    return {
      ...hpGainsResult.state,
      pendingRefresh: {
        playerId,
        remainingDraws: 0,
        ...(afterDrawContinuation ? { afterDrawContinuation } : {}),
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
        ...(afterDrawContinuation ? { afterDrawContinuation } : {}),
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

  let refreshedState = continueInspectDeckAfterRefresh({
    ...hpGainState,
    pendingRefresh: null,
  })
  if (afterDrawContinuation) {
    refreshedState = continueAfterDrawUpTo(refreshedState, afterDrawContinuation)
  }
  const remainingMill = state.pendingRefresh?.remainingDeckToTrash
  if (remainingMill) {
    return continuePendingReplacements(executeDeckToTrash(refreshedState, remainingMill.context, remainingMill.effect, remainingMill.movedCards))
  }
  return continuePendingReplacements(refreshedState)
}
