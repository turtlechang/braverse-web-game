import { getEffectDamageAmount } from '../effects/combat'
import { isEffectDamagePrevented } from '../effects/targeting'
import { maskGameStateForViewer } from '../masked-state'
import type { CardEffect, EffectContext, GameState, PlayerId } from '../types'

/** Numeric rule forecasts only; the selection strategy never receives GameState. */
export const getPublicEffectDamageByTarget = (
  state: GameState,
  viewerId: PlayerId,
  context: EffectContext,
  effect: CardEffect,
  candidateIds: readonly string[],
): ReadonlyMap<string, number> | undefined => {
  if (effect.kind !== 'damage' && effect.kind !== 'damage-all') return undefined
  // History is irrelevant to damage rules and can be large during search.
  const publicState = maskGameStateForViewer({ ...state, commandLog: undefined }, viewerId)
  return new Map(candidateIds.map(instanceId => {
    const owner = Object.values(publicState.players).find(player =>
      player.battleArea.some(cookie => cookie.card.instanceId === instanceId))
    const target = owner?.battleArea.find(cookie => cookie.card.instanceId === instanceId)
    const damage = owner && target && !isEffectDamagePrevented(publicState, target, owner.id)
      ? getEffectDamageAmount(publicState, context, effect.amount, instanceId)
      : 0
    return [instanceId, damage]
  }))
}
