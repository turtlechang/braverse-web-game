import type { GameState } from './types'

export const hasBlockingPending = (state: GameState): boolean =>
  Boolean(
    state.pendingReplacement ||
      state.pendingOnPlay ||
      state.pendingRefresh ||
      state.pendingBattle ||
      (state.pendingFaintEffects && state.pendingFaintEffects.length > 0) ||
      state.pendingOpponentHandDiscard ||
      state.pendingOpponentRandomDiscard ||
      state.pendingInspectDeck ||
      state.pendingOptionalCostAttack ||
      state.pendingDrawUpTo ||
      state.pendingStageTrigger,
  )
