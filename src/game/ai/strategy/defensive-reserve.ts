import { getCookieEffectiveHp, getOpponentId } from '../../helpers'
import { getEnergyCostTotal, selectEnergyPayment } from '../../energy'
import { isEffectConditionMet } from '../../effects'
import type { PlayerActionCommand } from '../../commands'
import { createPlayerView } from '../../player-view'
import type { PlayerView } from '../../player-view'
import type { AbilityCost, EffectContext, GameState, PlayerId } from '../../types'
import { getBreakAreaLevel } from '../../victory'

export type DefensiveReserveReason =
  | 'none'
  | 'trap-in-hand'
  | 'trap-retention'
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

export const hasLv5OpponentAttackThreat = (view: PlayerView): boolean =>
  view.opponent.battleArea.some(
    (cookie) => !cookie.rested && !cookie.card.nonAttackable && cookie.card.attack > 0,
  )

export const canPayEnergy = (
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

export const hasPayableTrap = (view: PlayerView): boolean =>
  view.hand.some((card) => {
    if (card.type !== 'trap' || !card.trap) return false
    const costs = [card.trap.cost, ...(card.trap.alternativeCosts ?? [])]
    return costs.some((cost) => canPayEnergy(cost, view))
  })

export const hasReadyBlocker = (view: PlayerView): boolean =>
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
 * 不會猜測具體陷阱或餅乾卡面。`beforeState` 只提供階段與當前規則狀態，
 * 供「結束主要階段的保留加分」判斷時機，不參與任何隱藏資訊推導。
 */
export const assessLv5DefensiveReserve = (
  beforeView: PlayerView,
  afterView: PlayerView,
  command: PlayerActionCommand,
  beforeState: GameState,
): DefensiveReserveAssessment => {
  const activeSupportBefore = activeSupportCount(beforeView)
  const activeSupportAfter = activeSupportCount(afterView)
  const trapInHand = hasPayableTrap(beforeView)
  const blockerReady = hasReadyBlocker(beforeView)
  const onPlayEnergy = getOnPlayEnergyRequirement(beforeView)
  const opponentThreat = hasLv5OpponentAttackThreat(beforeView)

  // A trap moved to support is no longer available for the next attack
  // response. This must be checked before payable-cost logic: a trap whose
  // cost is not payable this instant can still be the only defensive card in
  // hand, and spending it as support is exactly the failure mode observed in
  // the Lv.5 replay.
  const placedUniqueTrap =
    command.kind === 'place-support' &&
    opponentThreat &&
    beforeView.hand.filter((card) => card.type === 'trap' && card.trap).length === 1 &&
    beforeView.hand.some(
      (card) =>
        card.instanceId === command.instanceId &&
        card.type === 'trap' &&
        Boolean(card.trap),
    )
  if (placedUniqueTrap) {
    return {
      reason: 'trap-retention',
      reserveRequired: 1,
      activeSupportBefore,
      activeSupportAfter,
      shortage: 0,
      adjustment: -72,
      detail: '對手戰鬥區有可攻擊餅乾；這會把手上唯一防守陷阱移入支援區，應保留在手牌。',
    }
  }

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
      adjustment: -shortage * 24,
      detail:
        `Lv.5 保留 ${reserveRequired} 張活躍支援；此攻擊後只剩 ${activeSupportAfter} 張，` +
        `不足 ${shortage} 張（${reason}）。`,
    }
  }

  // 只有「主要階段、面對公開攻擊威脅的防守性保留」可以獲得結束階段的
  // 有限加分。支援階段的 advance-phase 與 OnPlay 能量需求不給加分，避免
  // Lv.5 為了收集加分而跳過放支援或無故結束主要階段。
  if (
    command.kind === 'advance-phase' &&
    beforeState.phase === 'main' &&
    (reason === 'trap-in-hand' || reason === 'blocker-ready') &&
    activeSupportBefore >= reserveRequired
  ) {
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

export interface OptionalCostDefenseAssessment {
  preserve: boolean
  onlyDefenseTrapConsumed: boolean
  immediateWin: boolean
  defenseTrapCountBefore: number
  defenseTrapCountAfter: number
  detail: string
}

type PendingOptionalCostAttack = NonNullable<GameState['pendingOptionalCostAttack']>

const defenseTrapCount = (view: PlayerView): number =>
  view.hand.filter((card) => card.type === 'trap' && card.trap).length +
  view.self.supportArea.filter(
    (support) => !support.rested && support.card.type === 'trap',
  ).length

const opponentBattleCookie = (state: GameState, playerId: PlayerId, instanceId: string) =>
  state.players[getOpponentId(playerId)].battleArea.find(
    (cookie) => cookie.card.instanceId === instanceId,
  )

const selectedOpponentTargetIds = (
  state: GameState,
  playerId: PlayerId,
  targetIds: readonly string[],
): string[] => targetIds.filter((instanceId) =>
  Boolean(opponentBattleCookie(state, playerId, instanceId)),
)

/**
 * 只把可由目前公開目標與條件證明的直接傷害／昏厥視為「立即勝利」。
 * 未知目標、choose-one 或需要推測翻牌結果的效果不會解除陷阱保留，
 * 以免把「可能斬殺」誤當成確定斬殺。
 */
const canImmediatelyWin = (
  state: GameState,
  playerId: PlayerId,
  pending: PendingOptionalCostAttack,
  targetIds: readonly string[],
): boolean => {
  const opponentId = getOpponentId(playerId)
  const context: EffectContext = {
    sourcePlayerId: playerId,
    sourceInstanceId: pending.sourceInstanceId,
  }
  const damageByTarget = new Map<string, number>()
  const faintTargets = new Set<string>()

  for (const effect of pending.effects) {
    if (!isEffectConditionMet(state, context, effect)) continue

    if (effect.kind === 'damage') {
      if (effect.target.side !== 'opponent') continue
      for (const instanceId of selectedOpponentTargetIds(state, playerId, targetIds)) {
        damageByTarget.set(
          instanceId,
          (damageByTarget.get(instanceId) ?? 0) + effect.amount,
        )
      }
      continue
    }

    if (effect.kind === 'damage-all') {
      if (effect.side !== 'opponent') continue
      const ids = effect.target
        ? selectedOpponentTargetIds(state, playerId, targetIds)
        : state.players[opponentId].battleArea.map((cookie) => cookie.card.instanceId)
      for (const instanceId of ids) {
        damageByTarget.set(
          instanceId,
          (damageByTarget.get(instanceId) ?? 0) + effect.amount,
        )
      }
      continue
    }

    if (effect.kind === 'make-faint') {
      if (effect.target.side !== 'opponent') continue
      for (const instanceId of selectedOpponentTargetIds(state, playerId, targetIds)) {
        faintTargets.add(instanceId)
      }
    }
  }

  const lethalTargets = new Set<string>(faintTargets)
  for (const [instanceId, damage] of damageByTarget) {
    const cookie = opponentBattleCookie(state, playerId, instanceId)
    if (cookie && damage >= getCookieEffectiveHp(cookie)) {
      lethalTargets.add(instanceId)
    }
  }

  const breakGain = state.players[opponentId].battleArea
    .filter((cookie) => lethalTargets.has(cookie.card.instanceId))
    .reduce((total, cookie) => total + cookie.card.level, 0)
  return lethalTargets.size > 0 && getBreakAreaLevel(state, opponentId) + breakGain >= 10
}

/**
 * 可選攻擊後效果的支付保護。支援區的 Trap 雖然是能量，也保留為公開的
 * 防守資源訊號；當它是唯一資源且對手仍有可攻擊餅乾時，除非這次效果已
 * 被公開證明會直接勝利，Lv.5 應改為 skip。
 */
export const assessLv5OptionalCostDefense = (
  state: GameState,
  playerId: PlayerId,
  pending: PendingOptionalCostAttack,
  paymentIds: readonly string[],
  targetIds: readonly string[],
): OptionalCostDefenseAssessment => {
  // The resource count is derived from the public projection so this helper
  // cannot accidentally start depending on the opponent's hidden cards.
  const view = createPlayerView(state, playerId)
  const before = defenseTrapCount(view)
  const paidTrapIds = new Set(
    state.players[playerId].supportArea
      .filter((support) => !support.rested && support.card.type === 'trap')
      .map((support) => support.card.instanceId),
  )
  const paidTrapCount = paymentIds.filter((instanceId) => paidTrapIds.has(instanceId)).length
  const after = Math.max(0, before - paidTrapCount)
  const onlyDefenseTrapConsumed = before === 1 && after === 0
  const immediateWin = canImmediatelyWin(state, playerId, pending, targetIds)
  const preserve =
    onlyDefenseTrapConsumed &&
    hasLv5OpponentAttackThreat(view) &&
    !immediateWin

  return {
    preserve,
    onlyDefenseTrapConsumed,
    immediateWin,
    defenseTrapCountBefore: before,
    defenseTrapCountAfter: after,
    detail: preserve
      ? '略過攻擊後續可選代價，保留唯一防守陷阱；目前效果未被公開證明為立即勝利。'
      : immediateWin
        ? '可選效果已由公開目標與傷害證明會立即達成勝利，允許支付防守陷阱。'
        : '可選代價未消耗唯一公開防守陷阱，或目前沒有公開攻擊威脅。',
  }
}
