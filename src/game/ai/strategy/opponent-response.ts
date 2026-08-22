import type { PlayerView } from '../../player-view'
import type { ActionIdentity } from './action-score'
import { extractDeckCapabilities } from './capability-extractor'

export interface OpponentResponseEstimate {
  /** 0..1；只代表公開資訊下的保守風險估計，不是讀取對手手牌。 */
  responseLikelihood: number
  publicResponseEvidence: number
  expectedPenalty: number
  detail: string
}

const neutralEstimate = (detail: string): OpponentResponseEstimate => ({
  responseLikelihood: 0,
  publicResponseEvidence: 0,
  expectedPenalty: 0,
  detail,
})

const visibleOpponentCards = (view: PlayerView) => [
  ...view.opponent.battleArea.map((cookie) => cookie.card),
  ...view.opponent.supportArea.map((support) => support.card),
  ...view.opponent.breakArea,
  ...view.opponent.discardPile,
  ...(view.opponent.stage ? [view.opponent.stage.card] : []),
]

const isResponseCapability = (
  capability: ReturnType<typeof extractDeckCapabilities>[number]['capabilities'][number],
): boolean =>
  capability.kind === 'block' ||
  capability.kind === 'trap' ||
  capability.timing === 'opponent-attack' ||
  capability.timing === 'block'

/**
 * 以 PlayerView 可見的卡與公開張數估計攻擊被回應的風險。這不是 opponent
 * tree，也不讀取實際對手手牌；相同 PlayerView 必定得到相同結果。
 */
export const estimateOpponentResponse = (
  view: PlayerView,
  identity: ActionIdentity,
): OpponentResponseEstimate => {
  if (identity.kind !== 'attack') {
    return neutralEstimate('非攻擊行動，不套用對手攻擊回應風險。')
  }
  if (view.opponent.handCount <= 0) {
    return neutralEstimate('對手公開手牌張數為 0。')
  }

  const models = extractDeckCapabilities(visibleOpponentCards(view))
  const publicResponseEvidence = models.reduce(
    (count, model) => count + Number(model.capabilities.some(isResponseCapability)),
    0,
  )
  const visibleCardCount = Math.max(1, models.length)
  const evidenceDensity = publicResponseEvidence / visibleCardCount
  const handSignal = Math.min(0.42, view.opponent.handCount * 0.055)
  const evidenceSignal = Math.min(0.38, evidenceDensity * 0.7)
  const responseLikelihood = Math.min(
    0.82,
    0.04 + handSignal + evidenceSignal,
  )

  const attacker = view.self.battleArea.find(
    (cookie) => cookie.card.instanceId === identity.sourceInstanceId,
  )
  const exposedValue = attacker
    ? 18 + attacker.card.level * 16 +
      (attacker.hpCount <= 1 ? 30 : attacker.hpCount === 2 ? 18 : 8) +
      Math.min(24, (attacker.card.attack ?? 0) * 4)
    : 40
  const expectedPenalty = -Math.round(responseLikelihood * exposedValue)

  return {
    responseLikelihood,
    publicResponseEvidence,
    expectedPenalty,
    detail:
      `公開手牌 ${view.opponent.handCount} 張、回應能力證據 ${publicResponseEvidence} 張；` +
      `攻擊曝險期望扣分 ${expectedPenalty}。`,
  }
}
