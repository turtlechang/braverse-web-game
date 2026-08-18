import type { GameState } from './types'

export const hasBlockingPending = (state: GameState): boolean =>
  Boolean(
    state.pendingReplacement ||
      state.pendingOnPlay ||
      state.pendingRefresh ||
      state.pendingBattle ||
      state.pendingAbilityEffect ||
      (state.pendingFaintEffects && state.pendingFaintEffects.length > 0) ||
      (state.pendingAfterDamageEffects && state.pendingAfterDamageEffects.length > 0) ||
      state.pendingOpponentHandDiscard ||
      state.pendingInspectDeck ||
      state.pendingRevealTopDeck ||
      state.pendingOptionalCostAttack ||
      state.pendingDrawUpTo ||
      state.pendingStageTrigger ||
      state.pendingOpponentRestSupport,
      // 注意：pendingEndOfTurnEffects（Then, when your turn ends 的延遲佇列）
      // 不視為阻塞——它是 end 階段的 processEndPhaseEffects 每次重入時都會
      // 自己排空的佇列；若列為阻塞，processEndPhaseEffects 開頭的
      // hasBlockingPending 檢查會把自己擋住，延遲效果永遠無法結算。
  )

/**
 * Whether a card/effect resolution is still pending independently of cookie
 * replacement.
 *
 * A replacement task may coexist with the effect chain that caused the faint
 * (for example an opponent's OnPlay effect). Replacement is deliberately
 * lower priority: all card effects, damage, FLIP, and effect-order decisions
 * must finish before the replacement window becomes actionable.
 */
export const hasPendingCardResolution = (state: GameState): boolean =>
  hasBlockingPending({ ...state, pendingReplacement: null }) ||
  Boolean(state.pendingEffectOrder && !state.pendingEffectOrder.resolvedOrder)
