import {
  getEffectSelectionCandidates,
  getEffectSelectionLimits,
  isEffectConditionMet,
  requiresEffectCardSelection,
} from '../effects'
import type { CardEffect, EffectContext, GameState } from '../types'
import type { PendingSelectionStrategy } from './strategy/pending-selection'

export interface SharedEffectTargetSelection {
  valid: boolean
  targetIds?: string[]
}

/**
 * Some command payloads intentionally carry one target list for several
 * effects (FLIP and optional attack costs). Select only the intersection of
 * every currently applicable effect's legal candidates. This keeps the
 * strategy conservative: when the rules require independent target groups,
 * the caller can skip the optional effect rather than submit an invalid
 * command or infer hidden semantics.
 */
export const chooseSharedEffectTargets = (
  state: GameState,
  context: EffectContext,
  effects: readonly CardEffect[],
  universal?: PendingSelectionStrategy,
): SharedEffectTargetSelection => {
  const selectableEffects = effects.filter(
    (effect) =>
      isEffectConditionMet(state, context, effect) &&
      requiresEffectCardSelection(effect),
  )
  if (selectableEffects.length === 0) return { valid: true }

  const selections = selectableEffects.map((effect) => {
    const limits = getEffectSelectionLimits(effect)
    const candidateIds = getEffectSelectionCandidates(state, context, effect)
      .map((card) => card.instanceId)
    return { effect, limits, candidateIds }
  })
  if (selections.some((selection) => selection.limits === null)) {
    return { valid: false }
  }

  const commonIds = selections
    .slice(1)
    .reduce(
      (ids, selection) =>
        ids.filter((id) => selection.candidateIds.includes(id)),
      [...selections[0].candidateIds],
    )
  const minimum = Math.max(
    ...selections.map((selection) => selection.limits!.min),
  )
  const maximum = Math.min(
    commonIds.length,
    ...selections.map((selection) => selection.limits!.max),
  )
  if (maximum < minimum) return { valid: false }

  const first = selections[0]
  const targetIds = universal?.enabled
    ? universal.selectEffectTargetIds(first.effect, commonIds, maximum)
    : commonIds.slice(0, maximum)
  const acceptedByEveryEffect = selections.every(
    (selection) =>
      targetIds.length >= selection.limits!.min &&
      targetIds.length <= selection.limits!.max &&
      targetIds.every((id) => selection.candidateIds.includes(id)),
  )
  return acceptedByEveryEffect
    ? { valid: true, targetIds }
    : { valid: false }
}
