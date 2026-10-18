import { getHpToTrashCostCandidates } from '../skills'
import type { AbilityCost, CookieInBattle } from '../types'
import type { PendingSelectionStrategy } from './strategy/pending-selection'

type HpCostSelectionStrategy = Pick<PendingSelectionStrategy, 'enabled' | 'orderCostIds'>

/** Select enough public HP for the shared payment rule, preserving strategy order. */
export const chooseAiHpToTrashIds = (
  cost: AbilityCost,
  battleArea: CookieInBattle[],
  sourceInstanceId: string,
  strategy?: HpCostSelectionStrategy | null,
): string[] | null => {
  const hpToTrash = cost.hpToTrash
  if (!hpToTrash) return []
  const candidates = getHpToTrashCostCandidates(cost, battleArea, sourceInstanceId)
  const candidateIds = candidates.map((cookie) => cookie.card.instanceId)
  const orderedIds = strategy?.enabled
    ? strategy.orderCostIds(candidateIds, candidateIds.length)
    : candidateIds
  if (!hpToTrash.totalAcrossCookies) {
    const preferred = candidates.find((cookie) => cookie.card.instanceId === orderedIds[0])
    const hpToRemove = (cookie: CookieInBattle): number =>
      hpToTrash.untilRemainingHp !== undefined
        ? Math.max(0, cookie.hpCards.length - hpToTrash.untilRemainingHp)
        : Math.max(0, hpToTrash.amount ?? 1)
    const wouldFaint = (cookie: CookieInBattle): boolean =>
      hpToRemove(cookie) >= cookie.hpCards.length
    const hasKnownFaintPayoff = (cookie: CookieInBattle): boolean =>
      cookie.card.skill?.faint === true || battleArea.some((ally) =>
        ally.card.instanceId !== cookie.card.instanceId &&
        ally.hpCards.length > 0 &&
        Boolean(ally.card.skill?.friendlyFaintEffects?.length),
      )

    // Preserve a legal Cookie when the default low-retention cost choice would
    // faint it. Keep the existing strategy order whenever that faint has an
    // explicit own/friendly trigger or every eligible Cookie would faint.
    if (preferred && wouldFaint(preferred) && !hasKnownFaintPayoff(preferred)) {
      const survivingId = orderedIds.find((id) => {
        const cookie = candidates.find((candidate) => candidate.card.instanceId === id)
        return cookie !== undefined && !wouldFaint(cookie)
      })
      if (survivingId) return [survivingId]
    }
    return orderedIds.length ? orderedIds.slice(0, 1) : null
  }
  const required = Math.max(1, hpToTrash.amount ?? 1)
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
