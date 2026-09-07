import type { PlayerView } from '../../player-view'
import { canPayEnergy } from './defensive-reserve'

export interface EndgameSurvivalAssessment {
  /** 評估前己方休息區等級，只有 6–9 才會啟用生存扣分。 */
  breakLevel: number
  breakDistance: number
  opponentThreatCount: number
  defenseOptionsBefore: number
  defenseOptionsAfter: number
  defenseOptionsLost: number
  adjustment: number
  detail: string
}

const breakLevel = (view: PlayerView): number =>
  view.self.breakArea.reduce((total, card) => total + card.level, 0)

const opponentThreatCount = (view: PlayerView): number =>
  view.opponent.battleArea.filter(
    (cookie) => !cookie.rested && !cookie.card.nonAttackable && cookie.card.attack > 0,
  ).length

const payableHandTrapCount = (view: PlayerView): number =>
  view.hand.filter((card) => {
    if (card.type !== 'trap' || !card.trap) return false
    return [card.trap.cost, ...(card.trap.alternativeCosts ?? [])].some((cost) =>
      canPayEnergy(cost, view),
    )
  }).length

const readyBlockerCount = (view: PlayerView): number =>
  view.self.battleArea.filter((cookie) =>
    cookie.card.skill?.trigger === 'block' &&
    canPayEnergy(cookie.card.skill.cost, view),
  ).length

/**
 * 估算 Break 6–9 的公開防守餘裕。這不是勝負判定，也不猜測對手手牌；
 * 它只比較本次 command 前後仍可辨識的手牌陷阱、活躍支援陷阱與 Blocker。
 * 支援區的陷阱不能直接在回應窗打出，但被橫置前仍是可保留的防守能量，
 * 因此會納入資源數；「手牌唯一陷阱移入支援」則由 defensive-reserve
 * 的 trap-retention 評估專門處理。
 */
export const assessLv5EndgameSurvival = (
  beforeView: PlayerView,
  afterView: PlayerView,
  actionKind: string,
): EndgameSurvivalAssessment => {
  const currentBreakLevel = breakLevel(beforeView)
  const currentBreakDistance = Math.max(0, 10 - currentBreakLevel)
  const threatCount = opponentThreatCount(beforeView)
  const defenseOptionsBefore =
    payableHandTrapCount(beforeView) +
    beforeView.self.supportArea.filter(
      (support) => !support.rested && support.card.type === 'trap',
    ).length +
    readyBlockerCount(beforeView)
  const defenseOptionsAfter =
    payableHandTrapCount(afterView) +
    afterView.self.supportArea.filter(
      (support) => !support.rested && support.card.type === 'trap',
    ).length +
    readyBlockerCount(afterView)
  const defenseOptionsLost = Math.max(0, defenseOptionsBefore - defenseOptionsAfter)

  if (
    currentBreakLevel < 6 ||
    currentBreakLevel > 9 ||
    threatCount === 0 ||
    (afterView.status === 'finished' && afterView.result?.winnerId === afterView.viewerId)
  ) {
    return {
      breakLevel: currentBreakLevel,
      breakDistance: currentBreakDistance,
      opponentThreatCount: threatCount,
      defenseOptionsBefore,
      defenseOptionsAfter,
      defenseOptionsLost: 0,
      adjustment: 0,
      detail: 'Break 尚未進入 6–9 的公開終局生存區，或沒有可攻擊威脅。',
    }
  }

  const severity = 18 + (currentBreakLevel - 6) * 7
  const adjustment = defenseOptionsLost === 0
    ? 0
    : -defenseOptionsLost * severity -
      (defenseOptionsAfter === 0 ? severity : 0)

  return {
    breakLevel: currentBreakLevel,
    breakDistance: currentBreakDistance,
    opponentThreatCount: threatCount,
    defenseOptionsBefore,
    defenseOptionsAfter,
    defenseOptionsLost,
    adjustment,
    detail: defenseOptionsLost > 0
      ? `Break ${currentBreakLevel} 距離敗北還有 ${currentBreakDistance}；${actionKind} 會失去 ${defenseOptionsLost} 個公開防守資源，保留生存餘裕。`
      : `Break ${currentBreakLevel} 距離敗北還有 ${currentBreakDistance}；公開防守資源未減少。`,
  }
}

/** 供測試與 benchmark 直接核對目前公開防守資源數。 */
export const countLv5DefenseOptions = (view: PlayerView): number =>
  payableHandTrapCount(view) +
  view.self.supportArea.filter(
    (support) => !support.rested && support.card.type === 'trap',
  ).length +
  readyBlockerCount(view)
