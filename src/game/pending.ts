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
      state.pendingStageTrigger,
  )
