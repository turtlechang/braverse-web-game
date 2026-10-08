import type { AbilityCost, CookieInBattle, PlayerState } from './types'
import { GameRuleError } from './errors'

export const getBattleCookiePositionCostCandidates = (
  cost: AbilityCost,
  cookies: CookieInBattle[],
  sourceInstanceId?: string,
): CookieInBattle[] => {
  const selection = cost.battleCookiePosition
  if (!selection) return []
  return cookies.filter(cookie =>
    cookie.rested === (selection.position === 'active') &&
    (selection.keyword === undefined || cookie.card.keywords?.includes(selection.keyword)) &&
    (selection.energyColor === undefined || cookie.card.energyColor === selection.energyColor) &&
    (!selection.excludeSource || cookie.card.instanceId !== sourceInstanceId),
  )
}

export const payBattleCookiePositionCost = (
  player: PlayerState,
  cost: AbilityCost,
  ids: string[],
  sourceInstanceId?: string,
): PlayerState => {
  const selection = cost.battleCookiePosition
  const selected = new Set(ids)
  if (selected.size !== ids.length || ids.length !== (selection?.count ?? 0)) {
    throw new GameRuleError(`必須選擇 ${selection?.count ?? 0} 個不同的餅乾支付狀態代價。`)
  }
  if (!selection) return player
  const candidates = new Set(getBattleCookiePositionCostCandidates(cost, player.battleArea, sourceInstanceId)
    .map(cookie => cookie.card.instanceId))
  if (ids.some(id => !candidates.has(id))) throw new GameRuleError('選擇的餅乾無法支付狀態代價。')
  return { ...player, battleArea: player.battleArea.map(cookie => selected.has(cookie.card.instanceId)
    ? { ...cookie, rested: selection.position === 'rested' } : cookie) }
}
