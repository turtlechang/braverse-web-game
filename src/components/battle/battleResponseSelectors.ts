import type { BattleUiMatchLike } from '../../hooks/battleUiContracts'

/**
 * The generic response chooser is only needed when more than one response
 * family is available. A trap-only attack opens TrapResponseModal directly;
 * otherwise the chooser and the trap modal would be mounted at the same time
 * while both described the same pending attack.
 */
export const shouldShowAttackResponseChooser = (args: {
  pendingBattle: BattleUiMatchLike['game']['pendingBattle']
  viewerPlayerId: BattleUiMatchLike['viewerPlayerId']
  pendingResponseMode: BattleUiMatchLike['pendingResponseMode']
  trapCount: number
  blockerCount: number
  attackResponseCount: number
}): boolean => {
  const {
    pendingBattle,
    viewerPlayerId,
    pendingResponseMode,
    trapCount,
    blockerCount,
    attackResponseCount,
  } = args
  return (
    pendingBattle?.stage === 'trap' &&
    pendingBattle.defenderPlayerId === viewerPlayerId &&
    pendingResponseMode === null &&
    (blockerCount > 0 || attackResponseCount > 0) &&
    (trapCount > 0 || blockerCount > 0 || attackResponseCount > 0)
  )
}
