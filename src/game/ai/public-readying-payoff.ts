import { applyGameCommand, getPendingDecision } from '../commands'
import { isCookieActivePhasePrevented } from '../effects'
import { getLegalTurnCommands } from '../legal-actions'
import { maskGameStateForViewer } from '../masked-state'
import type { GameCard, GameState, PlayerId } from '../types'

/**
 * A legal companion can remove a public restriction on the next Active Phase.
 * This is conditional value: the companion must survive until that phase.
 * Apply the real command to a masked state; never treat unknown HP as known.
 */
export const hasPublicReadyPhasePayoff = (
  state: GameState,
  playerId: PlayerId,
  card: GameCard,
): boolean => {
  const player = state.players[playerId]
  const source = player.battleArea[0]
  if (
    card.type !== 'cookie' || player.battleArea.length !== 1 || !source?.rested ||
    source.card.skill?.trigger !== 'passive' ||
    ![...source.card.skill.effects, ...(source.card.skill.passiveEffects ?? [])]
      .some(effect => effect.kind === 'prevent-source-active-phase')
  ) return false

  const before = maskGameStateForViewer({ ...state, commandLog: undefined }, playerId)
  if (!isCookieActivePhasePrevented(before, playerId, source.card.instanceId)) return false
  const command = getLegalTurnCommands(before, playerId).find(candidate =>
    candidate.kind === 'deploy-cookie' && candidate.instanceId === card.instanceId,
  )
  if (!command || command.kind !== 'deploy-cookie') return false

  const after = applyGameCommand(before, command)
  if (
    after.status !== 'playing' || after.pendingRefresh || after.pendingOnPlay ||
    after.pendingReplacement || getPendingDecision(after)
  ) return false
  if (!after.players[playerId].battleArea.some(cookie =>
    cookie.card.instanceId === source.card.instanceId,
  )) return false
  return !isCookieActivePhasePrevented(after, playerId, source.card.instanceId)
}
