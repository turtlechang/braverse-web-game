import { GameRuleError } from './errors'
import { getNonFaintAttachmentTrash } from './card-destinations'
import type { AbilityCost, CookieCard, PlayerState } from './types'

export const getCookieToBreakCostCandidates = (cost: AbilityCost, player: PlayerState, sourceInstanceId?: string) => {
  const payment = cost.cookieToBreakArea
  if (!payment || (payment.excludeSource && !sourceInstanceId)) return []
  const matches = (card: CookieCard) => (!payment.excludeSource || card.instanceId !== sourceInstanceId) && (!payment.keyword || card.keywords?.includes(payment.keyword))
  return [
    ...(payment.zones.includes('hand') ? player.hand.filter((card): card is CookieCard => card.type === 'cookie' && Boolean(matches(card)))
      .map(card => ({ card, instanceId: card.instanceId, zone: 'hand' as const })) : []),
    ...(payment.zones.includes('battle') ? player.battleArea.filter(cookie => matches(cookie.card))
      .map(cookie => ({ card: cookie.card, instanceId: cookie.card.instanceId, zone: 'battle' as const })) : []),
  ]
}

export const payCookieToBreakCost = (cost: AbilityCost, player: PlayerState, selectedIds: string[], sourceInstanceId?: string) => {
  if (!cost.cookieToBreakArea && selectedIds.length === 0) return { departedCount: 0, paidCards: [], player }
  const unique = new Set(selectedIds)
  const candidates = getCookieToBreakCostCandidates(cost, player, sourceInstanceId)
  if (unique.size !== selectedIds.length || selectedIds.length !== (cost.cookieToBreakArea?.count ?? 0) ||
    selectedIds.some(id => !candidates.some(candidate => candidate.instanceId === id))) {
    throw new GameRuleError('必須從指定區域選擇正確張數的餅乾放入休息區作為代價。')
  }
  const selected = candidates.filter(candidate => unique.has(candidate.instanceId))
  const departed = player.battleArea.filter(cookie => unique.has(cookie.card.instanceId))
  return { departedCount: departed.length, paidCards: selected.map(candidate => candidate.card), player: {
    ...player,
    hand: player.hand.filter(card => !unique.has(card.instanceId)),
    battleArea: player.battleArea.filter(cookie => !unique.has(cookie.card.instanceId)),
    breakArea: [...player.breakArea, ...selected.map(candidate => candidate.card)],
    discardPile: [...player.discardPile, ...departed.flatMap(getNonFaintAttachmentTrash)],
  } }
}
