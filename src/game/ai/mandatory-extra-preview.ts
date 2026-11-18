import { getAttackEnergyCostForState, getEnergyCostTotal, selectEnergyPayment } from '../energy'
import { maskGameStateForViewer } from '../masked-state'
import type { GameState, PlayerId } from '../types'
import { handleAiPendingDecision } from './pending-handler'
import type { KnowledgeState } from './strategy/knowledge-state'

export const previewMandatoryExtraState = (
  state: GameState,
  playerId: PlayerId,
  knowledgeState?: KnowledgeState,
  options: { requireAttackPayment?: boolean } = {},
): GameState | null => {
  const pending = state.pendingOptionalCostAttack
  if (!pending || pending.playerId !== playerId || !pending.mandatory ||
      !pending.extraDeckPlayInstanceId || getEnergyCostTotal(pending.cost.energy ?? {}) !== 0) return null
  const discardCount = pending.cost.discardHand ?? 0
  const handOnly = discardCount > 0 && Object.entries(pending.cost).every(([key, value]) =>
    value === undefined || value === false || value === 0 ||
    ['energy', 'discardHand', 'discardHandColor', 'discardHandType', 'discardHandHasFlip'].includes(key))
  if (!handOnly) return null
  const own = state.players[playerId]
  const extra = own.extraDeck?.find(card => card.instanceId === pending.extraDeckPlayInstanceId)
  if (extra?.cardColor !== 'blue' || typeof extra.hp !== 'number' || extra.hp <= 0 || own.deck.length <= extra.hp) return null
  const masked = maskGameStateForViewer(state, playerId)
  const result = handleAiPendingDecision(masked, playerId, { level: 5, knowledgeState })
  if (!result || result.action !== 'resolve-optional-cost-attack' ||
      result.state.players[playerId].hand.length !== own.hand.length - discardCount ||
      result.state.players[playerId].battleArea.length !== own.battleArea.length + 1 ||
      !result.state.players[playerId].battleArea.some(cookie => cookie.card.instanceId === extra.instanceId)) return null
  if (options.requireAttackPayment && !selectEnergyPayment(
    getAttackEnergyCostForState(result.state, extra.instanceId),
    result.state.players[playerId].supportArea,
  )) return null
  return result.state
}
