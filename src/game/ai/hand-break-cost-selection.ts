import type { AbilityCost, GameState, PlayerId } from '../types'
import { getHandToBreakAreaCostCandidates } from '../skills'

/** Select from the owner's public hand. A paid Break loss precedes the effect. */
export const chooseAiHandToBreakCostIds = (
  state: GameState,
  playerId: PlayerId,
  cost: AbilityCost,
  sourceInstanceId: string,
  excludedHandIds: readonly string[] = [],
  otherBreakCostIds: readonly string[] = [],
): string[] | null => {
  const count = cost.handToBreakArea?.count ?? 0
  if (count === 0) return []

  const player = state.players[playerId]
  const candidates = getHandToBreakAreaCostCandidates(cost, player.hand, sourceInstanceId)
    .filter((card) => !excludedHandIds.includes(card.instanceId))
    .sort((left, right) => left.level - right.level)
  if (candidates.length < count) return null

  const selected = candidates.slice(0, count)
  const currentLevel = player.breakArea.reduce((sum, card) => sum + card.level, 0)
  const otherCostLevel = otherBreakCostIds.reduce((sum, id) => {
    const card = player.discardPile.find((candidate) => candidate.instanceId === id)
    return sum + (card?.type === 'cookie' ? card.level : 0)
  }, 0)
  // Break stores the printed card; an in-battle level modifier does not persist.
  const selfCostLevel = cost.selfToBreakArea
    ? (player.battleArea.find((cookie) => cookie.card.instanceId === sourceInstanceId)?.card.level ?? 0)
    : 0
  const handCostLevel = selected.reduce((sum, card) => sum + card.level, 0)
  if (currentLevel + otherCostLevel + selfCostLevel + handCostLevel >= 10) return null

  return selected.map((card) => card.instanceId)
}
