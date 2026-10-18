import { selectEnergyPayment } from '../energy'
import type { PlayerSideView, CookieInBattleView } from '../player-view'
import type { SupportCard } from '../types'

// Compare ordinary attacks that the printed Cookies can pay for with public
// support after the next Active Phase. Shared support pays for each attack at
// most once; no future card, hidden hand identity, or effect attack is assumed.
const maximumDamage = (
  cookies: CookieInBattleView[],
  supports: SupportCard[],
): number => {
  let best = 0
  for (const cookie of cookies) {
    if (cookie.card.nonAttackable || cookie.card.attack <= 0) continue
    const cost = cookie.card.attackEnergyCost ?? { neutral: cookie.card.attackCost }
    const payment = selectEnergyPayment(cost, supports)
    if (!payment) continue
    const paid = new Set(payment)
    const remaining = supports.map((support) =>
      paid.has(support.card.instanceId) ? { ...support, rested: true } : support,
    )
    best = Math.max(
      best,
      cookie.card.attack + maximumDamage(cookies.filter((candidate) => candidate !== cookie), remaining),
    )
  }
  return best
}

const readySupports = (side: PlayerSideView): SupportCard[] => {
  const supportLocks = new Set(side.nextActivePhasePreventedSupportIds ?? [])
  return side.supportArea.map((support) => ({
    ...support,
    rested: support.rested && supportLocks.has(support.card.instanceId),
  }))
}

const normallyReadyCookies = (side: PlayerSideView): CookieInBattleView[] =>
  side.battleArea.filter((cookie) =>
    !cookie.rested || !cookie.activePhasePreventedBySkill,
  )

interface ConditionalPrevention {
  cookieInstanceId: string
  discardCount: number
}

const pressureForLockedCookies = (
  normallyReady: CookieInBattleView[],
  supports: SupportCard[],
  lockedIds: ReadonlySet<string>,
  baselineDamage: number,
): number => {
  const damage = maximumDamage(
    normallyReady.filter((cookie) => !lockedIds.has(cookie.card.instanceId)),
    supports,
  )
  return Math.max(0, baselineDamage - damage) * 15
}

/**
 * Values a next-Active restriction from the public view. A conditional
 * restriction offers the controller a choice: keep the Cookie rested, or spend
 * the required number of otherwise-hidden hand cards. The AI models that as
 * the lower-loss option for either side, using only public hand count and the
 * same per-card weights as state evaluation.
 */
export const nextActivePressureLost = (
  side: PlayerSideView,
  handCardValue = 3,
): number => {
  const unconditionalIds = new Set(side.battleArea
    .filter((cookie) => cookie.rested && cookie.nextActivePhasePrevented)
    .map((cookie) => cookie.card.instanceId))
  const conditionals: ConditionalPrevention[] = side.battleArea.flatMap((cookie) =>
    cookie.nextActivePhaseDiscardToActivate !== undefined &&
    cookie.rested &&
    !cookie.nextActivePhasePrevented &&
    !cookie.activePhasePreventedBySkill
      ? [{
          cookieInstanceId: cookie.card.instanceId,
          discardCount: cookie.nextActivePhaseDiscardToActivate,
        }]
      : [],
  )
  if (unconditionalIds.size === 0 && conditionals.length === 0) return 0

  const normallyReady = normallyReadyCookies(side)
  const supports = readySupports(side)
  const baselineDamage = maximumDamage(normallyReady, supports)
  const forcedLockedIds = new Set(unconditionalIds)
  const payable: ConditionalPrevention[] = []
  for (const conditional of conditionals) {
    if (conditional.discardCount > side.handCount) {
      forcedLockedIds.add(conditional.cookieInstanceId)
    } else {
      payable.push(conditional)
    }
  }

  let best = Number.POSITIVE_INFINITY
  const paidIds = new Set<string>()
  const consider = (paidCards: number): void => {
    const lockedIds = new Set(forcedLockedIds)
    for (const conditional of payable) {
      if (!paidIds.has(conditional.cookieInstanceId)) {
        lockedIds.add(conditional.cookieInstanceId)
      }
    }
    const value = pressureForLockedCookies(
      normallyReady,
      supports,
      lockedIds,
      baselineDamage,
    ) + paidCards * handCardValue
    best = Math.min(best, value)
  }
  const chooseResponse = (index: number, paidCards: number): void => {
    if (index === payable.length) {
      consider(paidCards)
      return
    }
    const conditional = payable[index]
    chooseResponse(index + 1, paidCards)
    if (paidCards + conditional.discardCount <= side.handCount) {
      paidIds.add(conditional.cookieInstanceId)
      chooseResponse(index + 1, paidCards + conditional.discardCount)
      paidIds.delete(conditional.cookieInstanceId)
    }
  }
  chooseResponse(0, 0)
  return Number.isFinite(best) ? best : 0
}

export interface NextActivePressureTargetValue {
  /** Best-response value, including any public hand-count discard cost. */
  value: number
  /** Attack pressure if the target declines every conditional discard. */
  threat: number
}

/** Score a hypothetical prevention effect on one visible Cookie. */
export const nextActivePressureTargetValue = (
  side: PlayerSideView,
  cookieInstanceId: string,
  discardToSetActive: number | undefined,
  handCardValue = 3,
): NextActivePressureTargetValue => {
  const before = nextActivePressureLost(side, handCardValue)
  const mark = (patch: Partial<CookieInBattleView>): PlayerSideView => ({
    ...side,
    battleArea: side.battleArea.map((cookie) =>
      cookie.card.instanceId === cookieInstanceId
        ? { ...cookie, ...patch }
        : cookie,
    ),
  })
  const unconditional = nextActivePressureLost(mark({ nextActivePhasePrevented: true }), handCardValue)
  const effect = discardToSetActive === undefined
    ? unconditional
    : nextActivePressureLost(mark({ nextActivePhaseDiscardToActivate: discardToSetActive }), handCardValue)
  return {
    value: Math.max(0, effect - before),
    threat: Math.max(0, unconditional - before),
  }
}
