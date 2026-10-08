import { isEffectConditionMet } from './effects/targeting'
import type { GameState, PlayerId, PendingFaintEffect } from './types'

/** Queue only actual faint events. Direct battle-to-trash/break movement never calls this. */
export const collectFriendlyFaintEffects = (state: GameState, playerId: PlayerId, count = 1): GameState => {
  if (count <= 0 || state.status !== 'playing') return state
  const queued: PendingFaintEffect[] = []
  for (const source of state.players[playerId].battleArea) {
    const skill = source.card.skill
    if (source.hpCards.length === 0 || !skill?.friendlyFaintEffects?.length ||
      (skill.yourTurn && state.activePlayerId !== playerId)) continue
    const context = { sourcePlayerId: playerId, sourceInstanceId: source.card.instanceId, sourceCardName: source.card.name }
    for (let event = 0; event < count; event++) {
      for (const effect of skill.friendlyFaintEffects) {
        if (!isEffectConditionMet(state, context, effect)) continue
        queued.push({ ...context, triggerReason: 'friendly-faint', context, effect })
      }
    }
  }
  return queued.length ? { ...state, pendingFaintEffects: [...(state.pendingFaintEffects ?? []), ...queued] } : state
}

export const isFaintListenerSourceAvailable = (state: GameState, pending: PendingFaintEffect): boolean =>
  pending.triggerReason !== 'friendly-faint' || state.players[pending.sourcePlayerId].battleArea.some(
    cookie => cookie.card.instanceId === pending.sourceInstanceId && cookie.hpCards.length > 0,
  )
