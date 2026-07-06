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
  if (
    replacementTask &&
    (
      !pendingDecision ||
      pendingDecision.kind === 'faint-effect' ||
      pendingDecision.kind === 'effect-order'
    )
  ) {
    if (state.pendingRefresh) return state.pendingRefresh.playerId
    if (state.pendingOnPlay) return state.pendingOnPlay.playerId
    return replacementTask.playerId
  }

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

  return state.activePlayerId
}
