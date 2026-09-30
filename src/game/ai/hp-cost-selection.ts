import { getHpToTrashCostCandidates } from '../skills'
import type { AbilityCost, CookieInBattle } from '../types'
import type { PendingSelectionStrategy } from './strategy/pending-selection'

/** Select enough public HP for the shared payment rule, preserving strategy order. */
export const chooseAiHpToTrashIds = (
  cost: AbilityCost,
  battleArea: CookieInBattle[],
  sourceInstanceId: string,
  strategy?: PendingSelectionStrategy | null,
): string[] | null => {
  if (!cost.hpToTrash) return []
  const candidates = getHpToTrashCostCandidates(cost, battleArea, sourceInstanceId)
  const candidateIds = candidates.map((cookie) => cookie.card.instanceId)
  const orderedIds = strategy?.enabled
    ? strategy.orderCostIds(candidateIds, candidateIds.length)
    : candidateIds
  if (!cost.hpToTrash.totalAcrossCookies) return orderedIds.length ? orderedIds.slice(0, 1) : null
  const required = Math.max(1, cost.hpToTrash.amount ?? 1)
  const selected: string[] = []
  let available = 0
  for (const id of orderedIds) {
    const cookie = candidates.find((candidate) => candidate.card.instanceId === id)
    if (!cookie || cookie.hpCards.length === 0 || selected.includes(id)) continue
    selected.push(id)
    available += cookie.hpCards.length
    if (available >= required) return selected
  }
  return null
}
