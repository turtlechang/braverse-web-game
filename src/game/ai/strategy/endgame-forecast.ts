import type { PlayerView } from '../../player-view'
import type { ActionIdentity } from './action-score'

const BREAK_LIMIT = 10
const COOKIE_RATE_PRIOR = 0.34
const PRIOR_WEIGHT = 6

export interface OpponentEndgameForecast {
  publicLethal: boolean
  targetsLastBattleCookie: boolean
  noReplacementProbability: number
  expectedReplacementHp: number
  /** 只由 PlayerView 已公開餅乾的 HP 與平滑先驗推導的補位 HP 分布。 */
  replacementHpDistribution: readonly ReplacementHpEstimate[]
  refreshProbability: number
  refreshDefeatProbability: number
  expectedRefreshBreakLevel: number
  score: number
  detail: string
}

export interface ReplacementHpEstimate {
  hp: number
  probability: number
}

const breakLevel = (view: PlayerView): number =>
  view.opponent.breakArea.reduce((total, card) => total + card.level, 0)

const publicOpponentCards = (view: PlayerView) => [
  ...view.opponent.battleArea.map((cookie) => cookie.card),
  ...view.opponent.supportArea.map((support) => support.card),
  ...view.opponent.breakArea,
  ...view.opponent.discardPile,
  ...(view.opponent.stage ? [view.opponent.stage.card] : []),
]

const estimatedCookieRate = (view: PlayerView): number => {
  const cards = publicOpponentCards(view)
  const cookieCount = cards.filter((card) => card.type === 'cookie').length
  const estimate = (
    cookieCount + COOKIE_RATE_PRIOR * PRIOR_WEIGHT
  ) / (cards.length + PRIOR_WEIGHT)
  return Math.min(0.7, Math.max(0.15, estimate))
}

const estimatedCookieHpDistribution = (
  view: PlayerView,
): ReplacementHpEstimate[] => {
  const cookies = publicOpponentCards(view).filter(
    (card) => card.type === 'cookie',
  )
  const counts = new Map<number, number>([[3, PRIOR_WEIGHT]])
  for (const cookie of cookies) {
    const hp = Math.max(1, cookie.hp)
    counts.set(hp, (counts.get(hp) ?? 0) + 1)
  }
  const total = cookies.length + PRIOR_WEIGHT
  return [...counts.entries()]
    .sort(([left], [right]) => left - right)
    .map(([hp, count]) => ({ hp, probability: count / total }))
}

const expectedHp = (distribution: readonly ReplacementHpEstimate[]): number =>
  Math.max(
    1,
    Math.round(distribution.reduce(
      (total, estimate) => total + estimate.hp * estimate.probability,
      0,
    )),
  )

const emptyForecast = (): OpponentEndgameForecast => ({
  publicLethal: false,
  targetsLastBattleCookie: false,
  noReplacementProbability: 0,
  expectedReplacementHp: 0,
  replacementHpDistribution: [],
  refreshProbability: 0,
  refreshDefeatProbability: 0,
  expectedRefreshBreakLevel: 0,
  score: 0,
  detail: '目前行動不會以公開資訊擊倒對手最後一隻餅乾。',
})

/**
 * 預判最後一隻餅乾被擊倒後的兩條終局路徑：手牌沒有可登場餅乾，或
 * 補位設置 HP 時耗盡牌庫並承受 Refresh 洗傷。只讀 PlayerView；手牌
 * 類型與未翻 HP 以公開樣本的平滑機率估計，絕不讀實際隱藏卡面。
 */
export const forecastOpponentEndgame = (
  view: PlayerView,
  identity: ActionIdentity,
  effectiveDamage: number,
): OpponentEndgameForecast => {
  if (identity.kind !== 'attack' || !identity.targetInstanceId) {
    return emptyForecast()
  }
  const target = view.opponent.battleArea.find(
    (cookie) => cookie.card.instanceId === identity.targetInstanceId,
  )
  if (!target || target.hpCount > effectiveDamage) return emptyForecast()

  const targetsLastBattleCookie = view.opponent.battleArea.length === 1
  if (!targetsLastBattleCookie) {
    return { ...emptyForecast(), publicLethal: true }
  }

  const cookieRate = estimatedCookieRate(view)
  const handCount = view.opponent.handCount
  const noReplacementProbability = handCount === 0
    ? 1
    : Math.pow(1 - cookieRate, handCount)
  const replacementProbability = 1 - noReplacementProbability
  const replacementHpDistribution = estimatedCookieHpDistribution(view)
  const expectedReplacementHp = expectedHp(replacementHpDistribution)
  // 不再把平均 HP 四捨五入成單一門檻：高／低 HP 混合的公開牌池可能同時
  // 包含會觸發 Refresh 與不會觸發 Refresh 的補位路徑，需保留各自機率。
  const refreshTriggerProbability = replacementHpDistribution.reduce(
    (total, estimate) => total + estimate.probability * Number(
      view.opponent.deckCount <= estimate.hp,
    ),
    0,
  )
  const refreshTriggered = refreshTriggerProbability > 0
  const refreshProbability = replacementProbability * refreshTriggerProbability

  const discardCookies = view.opponent.discardPile.filter(
    (card) => card.type === 'cookie',
  )
  const minimumPublicRefreshLevel = discardCookies.length > 0
    ? Math.min(...discardCookies.map((card) => card.level))
    : null
  // 這次擊倒會把目標剩餘 HP 翻入棄牌區；其卡面目前未知。若公開棄牌區
  // 沒有餅乾，只能以公開樣本估計這些新翻卡仍沒有餅乾的機率。
  const noRefreshCandidateProbability = minimumPublicRefreshLevel === null
    ? Math.pow(1 - cookieRate, Math.max(0, target.hpCount))
    : 0
  const projectedBreak = minimumPublicRefreshLevel === null
    ? breakLevel(view)
    : breakLevel(view) + minimumPublicRefreshLevel
  const refreshBreakDefeatProbability = projectedBreak >= BREAK_LIMIT ? 1 : 0
  const refreshDefeatProbability = refreshProbability * Math.max(
    noRefreshCandidateProbability,
    refreshBreakDefeatProbability,
  )
  const expectedRefreshBreakLevel = refreshProbability * (
    minimumPublicRefreshLevel ?? Math.max(1, Math.round(cookieRate * 3))
  )
  const expectedDeckShortfall = replacementHpDistribution.reduce(
    (total, estimate) => total + estimate.probability * Math.max(
      0,
      estimate.hp + 1 - view.opponent.deckCount,
    ),
    0,
  )
  const deckPressure = refreshTriggered
    ? expectedDeckShortfall * replacementProbability * 5
    : 0
  const score = Math.round(
    noReplacementProbability * 180 +
    refreshDefeatProbability * 180 +
    expectedRefreshBreakLevel * 18 +
    deckPressure,
  )

  return {
    publicLethal: true,
    targetsLastBattleCookie,
    noReplacementProbability,
    expectedReplacementHp,
    replacementHpDistribution,
    refreshProbability,
    refreshDefeatProbability,
    expectedRefreshBreakLevel,
    score,
    detail: [
      `打空戰鬥區後無可登場餅乾機率 ${Math.round(noReplacementProbability * 100)}%。`,
      refreshTriggered
        ? `公開補位 HP 分布 ${replacementHpDistribution.map((estimate) => `${estimate.hp} HP ${Math.round(estimate.probability * 100)}%`).join('、')}；對手牌庫 ${view.opponent.deckCount} 張，會進入 Refresh 風險。`
        : `預估補位需 ${expectedReplacementHp} HP，對手牌庫尚有 ${view.opponent.deckCount} 張。`,
      refreshProbability > 0
        ? `Refresh 敗北機率 ${Math.round(refreshDefeatProbability * 100)}%。`
        : '本次未形成 Refresh 敗北路徑。',
    ].join(' '),
  }
}
