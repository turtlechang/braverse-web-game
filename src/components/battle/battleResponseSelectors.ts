import type {
  BattleUiMatchLike,
  BattleUiTrapEffectTargetStep,
} from '../../hooks/battleUiContracts'

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

/**
 * Submit only the target-selection steps that the Trap modal actually
 * rendered. Later card-selection effects must stay omitted, allowing the
 * normal pending-effect UI to ask for their own targets instead of treating
 * an invented empty array as an explicit choice to skip.
 */
export const buildTrapEffectTargetSubmission = (
  targetSteps: readonly Pick<BattleUiTrapEffectTargetStep, 'effectIndex'>[],
  selectedTargets: readonly string[][],
): string[][] | undefined => {
  const lastRenderedEffectIndex = Math.max(
    -1,
    ...targetSteps.map((step) => step.effectIndex),
  )
  if (lastRenderedEffectIndex < 0) return undefined
  return Array.from(
    { length: lastRenderedEffectIndex + 1 },
    (_, effectIndex) => selectedTargets[effectIndex] ?? [],
  )
}
