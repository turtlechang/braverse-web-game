import { GameRuleError } from '../errors'
import type { GameState, PlayerId } from '../types'
import { drawCards, updatePlayer } from '../helpers'
import { getRefreshCandidates } from '../refresh'
import { finishWithDefeat, resolveBasicVictory } from '../victory'
import { executeCardEffect } from './execute'
import { isEffectConditionMet, requiresEffectCardSelection } from './targeting'

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
    const shouldContinueAfterEffects =
      Boolean(pending.afterEffects && pending.afterEffectContext) &&
      (!pending.afterEffectsRequireDraw || actualDraw > 0)
    return {
      ...updatedState,
      pendingRefresh: {
        playerId,
        remainingDraws: drawCount - actualDraw,
        ...(shouldContinueAfterEffects && pending.afterEffects && pending.afterEffectContext
          ? {
              afterDrawContinuation: {
                effects: pending.afterEffects,
                context: pending.afterEffectContext,
                sourceKind: pending.afterEffectSourceKind ?? 'skill',
                battleContinuation: pending.battleContinuation,
              },
            }
          : {}),
      },
    }
  }

  if (pending.afterEffects && pending.afterEffectContext && (!pending.afterEffectsRequireDraw || actualDraw > 0)) {
    for (let effectIndex = 0; effectIndex < pending.afterEffects.length; effectIndex += 1) {
      const effect = pending.afterEffects[effectIndex]
      // A FLIP may queue a conditional Then behind the draw decision.  The
      // condition belongs to that queued effect and must be checked again
      // when the draw modal resolves; an unmet branch is simply skipped
      // instead of being passed to executeCardEffect (which correctly throws
      // when called directly with an unmet condition).
      if (!isEffectConditionMet(updatedState, pending.afterEffectContext, effect)) {
        continue
      }

      // Targeted Then effects must use the ordinary effect-selection channel.
      // Passing [] here used to make optional damage silently resolve as zero,
      // which hid BS9-041's opponent-Cookie target after its draw decision.
      // Keep the whole remaining queue so the same pendingAbilityEffect can
      // resume any later Then effects after this target is confirmed.
      if (requiresEffectCardSelection(effect)) {
        return {
          ...updatedState,
          pendingAbilityEffect: {
            playerId: pending.playerId,
            sourcePlayerId: pending.afterEffectContext.sourcePlayerId,
            sourceInstanceId: pending.afterEffectContext.sourceInstanceId,
            sourceCardName: pending.afterEffectContext.sourceCardName,
            sourceKind: pending.afterEffectSourceKind ?? 'skill',
            effects: pending.afterEffects,
            effectIndex,
            battleContinuation: pending.battleContinuation,
          },
        }
      }
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
