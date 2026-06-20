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

  if (
    !state.pendingReplacement &&
    state.departedCookieCounts[playerId] === 0 &&
    player.battleArea.length === 0
  ) {
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

export const evaluateBreakLevelVictory = (
  state: GameState,
): GameResult | null => {
  if (state.status !== 'playing') {
    return null
  }

  for (const playerId of ['player-one', 'player-two'] as const) {
    if (getBreakAreaLevel(state, playerId) >= 10) {
      return {
        loserId: playerId,
        winnerId: getOpponentId(playerId),
        reason: 'break-level-limit',
      }
    }
  }

  return null
}

export const resolveBreakLevelVictory = (
  state: GameState,
): GameState => {
  const result = evaluateBreakLevelVictory(state)

  return result
    ? {
        ...state,
        status: 'finished',
        pendingReplacement: null,
        departedCookieCounts: {
          'player-one': 0,
          'player-two': 0,
        },
        pendingOnPlay: null,
        pendingRefresh: null,
        pendingBattle: null,
        pendingFaintEffects: undefined,
        pendingInspectDeck: null,
        pendingOptionalCostAttack: undefined,
        pendingOpponentHandDiscard: null,
        result,
      }
    : state
}

export const resolveBasicVictory = (state: GameState): GameState => {
  const result = evaluateBasicVictory(state)

  return result
    ? {
        ...state,
        status: 'finished',
        pendingReplacement: null,
        departedCookieCounts: {
          'player-one': 0,
          'player-two': 0,
        },
        pendingOnPlay: null,
        pendingRefresh: null,
        pendingBattle: null,
        pendingFaintEffects: undefined,
        pendingInspectDeck: null,
        pendingOptionalCostAttack: undefined,
        pendingOpponentHandDiscard: null,
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
  pendingReplacement: null,
  departedCookieCounts: {
    'player-one': 0,
    'player-two': 0,
  },
  pendingOnPlay: null,
  pendingRefresh: null,
  pendingBattle: null,
  pendingFaintEffects: undefined,
  pendingInspectDeck: null,
  pendingOptionalCostAttack: undefined,
  pendingOpponentHandDiscard: null,
  result: {
    loserId,
    winnerId: getOpponentId(loserId),
    reason,
  },
})
