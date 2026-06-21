import { GameRuleError } from '../errors'
import type { GameState, PlayerId } from '../types'
import { drawCards, updatePlayer } from '../helpers'
import { getRefreshCandidates } from '../refresh'
import { finishWithDefeat, resolveBasicVictory } from '../victory'

export const resolveDrawUpTo = (
  state: GameState,
  playerId: PlayerId,
  drawCount: number,
): GameState => {
  if (!state.pendingDrawUpTo) {
    throw new GameRuleError('目前沒有待處理的抽牌決策。')
  }

  if (state.pendingDrawUpTo.playerId !== playerId) {
    throw new GameRuleError('不是目前需要執行決策的玩家。')
  }

  if (drawCount < 0 || drawCount > state.pendingDrawUpTo.max) {
    throw new GameRuleError(`抽牌數量必須在 0 到 ${state.pendingDrawUpTo.max} 之間。`)
  }

  const player = state.players[playerId]
  const actualDraw = Math.min(player.deck.length, drawCount)
  const updatedPlayer = drawCards(player, actualDraw)
  let updatedState = updatePlayer(state, updatedPlayer)

  updatedState = {
    ...updatedState,
    pendingDrawUpTo: null,
  }

  if (actualDraw < drawCount || updatedState.players[playerId].deck.length === 0) {
    if (getRefreshCandidates(updatedState, playerId).length === 0) {
      return finishWithDefeat(updatedState, playerId, 'refresh-unavailable')
    }
    return {
      ...updatedState,
      pendingRefresh: {
        playerId,
        remainingDraws: drawCount - actualDraw,
      },
    }
  }

  return resolveBasicVictory(updatedState)
}
