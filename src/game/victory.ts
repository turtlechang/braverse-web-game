import { getOpponentId } from './helpers'
import type {
  CardKeyword,
  DefeatReason,
  GameResult,
  GameState,
  PlayerId,
  SpecialVictoryCondition,
  VictoryReason,
} from './types'

export const getBreakAreaLevel = (
  state: GameState,
  playerId: PlayerId,
): number =>
  state.players[playerId].breakArea.reduce(
    (total, cookie) => total + cookie.level,
    0,
  )

const getDistinctKeywordCardNames = (
  state: GameState,
  playerId: PlayerId,
  keyword: CardKeyword,
  cardType?: 'cookie' | 'item' | 'trap' | 'stage',
): Set<string> => {
  const player = state.players[playerId]
  const cards = [
    ...player.battleArea.map((cookie) => cookie.card),
    ...player.supportArea.map((support) => support.card),
  ]

  return new Set(
    cards
      .filter(
        (card) =>
          card.keywords?.includes(keyword) &&
          (cardType === undefined || card.type === cardType),
      )
      .map((card) => card.name.trim().toLocaleLowerCase()),
  )
}

/**
 * 特殊勝利僅由來源卡的主動能力呼叫，不會在玩家湊齊卡片時自動結束遊戲。
 */
export const isSpecialVictoryConditionMet = (
  state: GameState,
  playerId: PlayerId,
  condition: SpecialVictoryCondition,
): boolean => {
  switch (condition.kind) {
    case 'distinct-named-keywords':
      return condition.requirements.every((requirement) =>
        getDistinctKeywordCardNames(
          state,
          playerId,
          requirement.keyword,
          requirement.cardType,
        ).size >= requirement.count,
      )
  }
}

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
        pendingStageTrigger: null,
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
        pendingStageTrigger: null,
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
  pendingStageTrigger: null,
  result: {
    loserId,
    winnerId: getOpponentId(loserId),
    reason,
  },
})

export const finishWithVictory = (
  state: GameState,
  winnerId: PlayerId,
  reason: VictoryReason,
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
  pendingStageTrigger: null,
  result: {
    winnerId,
    loserId: getOpponentId(winnerId),
    reason,
  },
})
