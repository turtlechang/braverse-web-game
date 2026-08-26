import { getEnergyCostTotal, selectEnergyPayment } from '../../energy'
import type { PlayerActionCommand } from '../../commands'
import type { PlayerView } from '../../player-view'
import type { AbilityCost } from '../../types'

export type DefensiveReserveReason =
  | 'none'
  | 'trap-in-hand'
  | 'blocker-ready'
  | 'on-play-energy'

export interface DefensiveReserveAssessment {
  reason: DefensiveReserveReason
  reserveRequired: number
  activeSupportBefore: number
  activeSupportAfter: number
  shortage: number
  /** 攻擊消耗防守資源的扣分，或結束階段保留資源的加分。 */
  adjustment: number
  detail: string
}

const activeSupportCount = (view: PlayerView): number =>
  view.self.supportArea.filter((support) => !support.rested).length

const hasOpponentAttackThreat = (view: PlayerView): boolean =>
  view.opponent.battleArea.some(
    (cookie) => !cookie.rested && !cookie.card.nonAttackable && cookie.card.attack > 0,
  )

const canPayEnergy = (
  cost: AbilityCost | undefined,
  view: PlayerView,
): boolean =>
  !cost || selectEnergyPayment(cost.energy ?? cost, view.self.supportArea) !== null

const getOnPlayEnergyRequirement = (view: PlayerView): number => {
  const costs = view.hand.flatMap((card) => {
    if (card.type === 'cookie' && card.skill) {
      const hasOnPlay = card.skill.trigger === 'on-play' ||
        Boolean(card.skill.onPlayEffects?.length)
      if (hasOnPlay) {
        const cost = card.skill.onPlayCost ?? card.skill.cost
        return canPayEnergy(cost, view) ? [getEnergyCostTotal(cost.energy ?? cost)] : []
      }
    }
    if (card.type === 'stage' && card.stageAbility) {
      return canPayEnergy(card.stageAbility.cost, view)
        ? [getEnergyCostTotal(card.stageAbility.cost.energy ?? card.stageAbility.cost)]
        : []
    }
    if (card.type === 'item' && card.item) {
      return canPayEnergy(card.item.cost, view)
        ? [getEnergyCostTotal(card.item.cost.energy ?? card.item.cost)]
        : []
    }
    return []
  })
  return costs.length === 0 ? 0 : Math.max(...costs)
}

const hasPayableTrap = (view: PlayerView): boolean =>
  view.hand.some((card) => {
    if (card.type !== 'trap' || !card.trap) return false
    const costs = [card.trap.cost, ...(card.trap.alternativeCosts ?? [])]
    return costs.some((cost) => canPayEnergy(cost, view))
  })

const hasReadyBlocker = (view: PlayerView): boolean =>
  view.self.battleArea.some((cookie) =>
    cookie.card.skill?.trigger === 'block' &&
    canPayEnergy(cookie.card.skill.cost, view),
  )

/**
 * 評估 Lv.5 是否應在攻擊時保留活躍支援：
 * - 手牌有可支付陷阱；
 * - 戰鬥區有可支付 Blocker；
 * - 手牌有可支付 OnPlay／Stage／Item 能量需求。
 *
 * 所有輸入均為 PlayerView；未知對手手牌只透過對手公開戰鬥區威脅觸發，
 * 不會猜測具體陷阱或餅乾卡面。
 */
export const assessLv5DefensiveReserve = (
  beforeView: PlayerView,
  afterView: PlayerView,
  command: PlayerActionCommand,
): DefensiveReserveAssessment => {
  const activeSupportBefore = activeSupportCount(beforeView)
  const activeSupportAfter = activeSupportCount(afterView)
  const trapInHand = hasPayableTrap(beforeView)
  const blockerReady = hasReadyBlocker(beforeView)
  const onPlayEnergy = getOnPlayEnergyRequirement(beforeView)
  const opponentThreat = hasOpponentAttackThreat(beforeView)

  let reason: DefensiveReserveReason = 'none'
  let reserveRequired = 0
  if (trapInHand && opponentThreat) {
    reason = 'trap-in-hand'
    reserveRequired = 1
  } else if (blockerReady && opponentThreat) {
    reason = 'blocker-ready'
    reserveRequired = 1
  } else if (onPlayEnergy > 0) {
    reason = 'on-play-energy'
    reserveRequired = onPlayEnergy
  }

  if (reserveRequired === 0) {
    return {
      reason,
      reserveRequired: 0,
      activeSupportBefore,
      activeSupportAfter,
      shortage: 0,
      adjustment: 0,
      detail: '沒有公開可證明的防守或下一步能量保留需求。',
    }
  }

  const shortage = Math.max(0, reserveRequired - activeSupportAfter)
  if (command.kind === 'attack' && shortage > 0) {
    return {
      reason,
      reserveRequired,
      activeSupportBefore,
      activeSupportAfter,
      shortage,
      adjustment: -shortage * 58,
      detail:
        `Lv.5 保留 ${reserveRequired} 張活躍支援；此攻擊後只剩 ${activeSupportAfter} 張，` +
        `不足 ${shortage} 張（${reason}）。`,
    }
  }

  // 若目前攻擊仍可執行，保留資源本身可抵銷「無故結束階段」的舊懲罰。
  if (command.kind === 'advance-phase' && activeSupportBefore >= reserveRequired) {
    return {
      reason,
      reserveRequired,
      activeSupportBefore,
      activeSupportAfter,
      shortage: 0,
      adjustment: 42,
      detail: `公開 ${reason} 需求成立，保留 ${activeSupportBefore} 張活躍支援供防守／下一步使用。`,
    }
  }

  return {
    reason,
    reserveRequired,
    activeSupportBefore,
    activeSupportAfter,
    shortage,
    adjustment: 0,
    detail: `目前活躍支援足以覆蓋 ${reason} 的公開能量保留需求。`,
  }
}
