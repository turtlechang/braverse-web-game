import { getOpponentId } from './helpers'
import type {
  DefeatReason,
  GameResult,
  GameState,
  PlayerId,
} from './types'

export const getBreakAreaLevel = (
  state: GameState,
  playerId: PlayerId,
): number =>
  state.players[playerId].breakArea.reduce(
    (total, cookie) => total + cookie.level,
    0,
  )

export const getBasicDefeatReason = (
  state: GameState,
  playerId: PlayerId,
): DefeatReason | null => {
  const player = state.players[playerId]

  if (getBreakAreaLevel(state, playerId) >= 10) {
    return 'break-level-limit'
  }

  const hasCookieInHand = player.hand.some((card) => card.type === 'cookie')

  if (player.battleArea.length === 0 && !hasCookieInHand) {
    return 'no-cookie-available'
  }

  return null
}

export const evaluateBasicVictory = (state: GameState): GameResult | null => {
  if (state.status !== 'playing') {
    return null
  }

  for (const playerId of ['player-one', 'player-two'] as const) {
    const reason = getBasicDefeatReason(state, playerId)

    if (reason) {
      return {
        loserId: playerId,
        winnerId: getOpponentId(playerId),
        reason,
      }
    }
  }

  return null
}

export const resolveBasicVictory = (state: GameState): GameState => {
  const result = evaluateBasicVictory(state)

  return result
    ? {
        ...state,
        status: 'finished',
        result,
      }
    : state
}

export const finishWithDefeat = (
  state: GameState,
  loserId: PlayerId,
  reason: DefeatReason,
): GameState => ({
  ...state,
  status: 'finished',
  pendingReplacementPlayerId: null,
  pendingOnPlay: null,
  pendingRefresh: null,
  result: {
    loserId,
    winnerId: getOpponentId(loserId),
    reason,
  },
})
