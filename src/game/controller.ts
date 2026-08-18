import { getPendingDecision } from './commands'
import { getCurrentReplacementTask } from './replacement'
import type { GameState, PlayerId } from './types'

export const isPlayerControllingState = (
  state: GameState,
  playerId: PlayerId,
): boolean => {
  if (state.pendingBattle?.stage === 'damage') return true
  return getActingPlayerId(state) === playerId
}

export const getActingPlayerId = (state: GameState): PlayerId => {
  const pendingDecision = getPendingDecision(state)
  const replacementTask = getCurrentReplacementTask(state)
  if (pendingDecision) return pendingDecision.playerId

  if (state.pendingRefresh) return state.pendingRefresh.playerId
  if (state.pendingOnPlay) return state.pendingOnPlay.playerId

  if (state.pendingBattle) {
    const battle = state.pendingBattle
    if (battle.stage === 'flip') {
      return battle.damagePlayerId ?? battle.defenderPlayerId
    }
    if (battle.stage === 'attack-effect') {
      return battle.attackerPlayerId
    }
    return battle.defenderPlayerId
  }

  if (state.pendingAbilityEffect) return state.pendingAbilityEffect.playerId

  // Replacement is intentionally last. A replacement task may coexist with
  // an effect chain after a faint; the effect owner (or battle responder) must
  // finish that chain before the empty battle area can be filled.
  if (replacementTask) return replacementTask.playerId

  return state.activePlayerId
}
