import { getAttackEnergyCost, selectEnergyPayment } from '../energy'
import { canAttack } from '../turn'
import type { GameCard, GameState, PlayerId } from '../types'

/**
 * FLIP 卡在 runtime 仍以 Cookie 形式存在，但會保留官方類型與 FLIP 能力。
 * 兩個欄位都檢查，兼容正式轉接資料與測試／舊資料。
 */
export const isFlipCookie = (card: GameCard): boolean =>
  card.type === 'cookie' &&
  (card.officialType === 'flip' || Boolean(card.flip))

/**
 * 判斷把手上的餅乾登場後，是否能用它完成一次公開的補刀。
 * 這是 AI 的部署例外，不改變攻擊規則本身；只有真的能支付攻擊費用、
 * 且目前有可被該攻擊擊倒的對手餅乾時才成立。
 */
export const canDeployCookieForLethal = (
  state: GameState,
  playerId: PlayerId,
  card: GameCard,
): boolean => {
  if (card.type !== 'cookie' || card.attack <= 0 || !canAttack(state)) {
    return false
  }

  const player = state.players[playerId]
  if (!selectEnergyPayment(getAttackEnergyCost(card), player.supportArea)) {
    return false
  }

  const opponentId = playerId === 'player-one' ? 'player-two' : 'player-one'
  return state.players[opponentId].battleArea.some(
    (target) => target.hpCards.length > 0 && target.hpCards.length <= card.attack,
  )
}

/**
 * AI 部署政策：戰鬥區已有餅乾時，避免把 FLIP 餅乾當成一般第二張餅乾。
 * 若沒有非 FLIP 替代品，或這張 FLIP 餅乾能直接補刀，才允許登場。
 * 戰鬥區為空時不攔截，避免違反維持戰線／避免立即敗北的需求。
 */
export const shouldAvoidFlipDeployment = (
  state: GameState,
  playerId: PlayerId,
  card: GameCard,
): boolean => {
  if (!isFlipCookie(card)) return false

  const player = state.players[playerId]
  if (player.battleArea.length === 0) return false

  const hasNonFlipCookie = player.hand.some(
    (candidate) => candidate.type === 'cookie' && !isFlipCookie(candidate),
  )
  if (!hasNonFlipCookie) return false

  return !canDeployCookieForLethal(state, playerId, card)
}

/**
 * 供 Lv.3/Lv.4 的合法指令評估與 beam search 共用，避免兩條路徑對 FLIP
 * 部署採用不同策略。
 */
export const isAllowedAiDeploymentCommand = (
  state: GameState,
  playerId: PlayerId,
  command: { kind: string; instanceId?: string },
): boolean => {
  if (command.kind !== 'deploy-cookie' || !command.instanceId) return true

  const card = state.players[playerId].hand.find(
    (candidate) => candidate.instanceId === command.instanceId,
  )
  return !card || !shouldAvoidFlipDeployment(state, playerId, card)
}
