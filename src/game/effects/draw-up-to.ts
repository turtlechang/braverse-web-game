import { GameRuleError } from '../errors'
import type { GameState, PlayerId } from '../types'
import { drawCards, updatePlayer } from '../helpers'
import { getRefreshCandidates } from '../refresh'
import { finishWithDefeat, resolveBasicVictory } from '../victory'
import { executeCardEffect } from './execute'

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

  const pending = state.pendingDrawUpTo
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

  if (pending.afterEffects && pending.afterEffectContext && (!pending.afterEffectsRequireDraw || actualDraw > 0)) {
    for (const effect of pending.afterEffects) {
      updatedState = executeCardEffect(
        updatedState,
        pending.afterEffectContext,
        effect,
        [],
      )
      // 標記這個棄牌決策接續在同一張卡的抽牌步驟之後，UI 才能把兩個彈窗
      // 顯示成同一個效果的「步驟 1/2 → 2/2」，而不是兩個互不相關的提示。
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
  }

  return resolveBasicVictory(updatedState)
}
