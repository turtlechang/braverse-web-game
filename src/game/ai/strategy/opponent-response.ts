import type { PlayerView } from '../../player-view'
import type { ActionIdentity } from './action-score'
import { extractDeckCapabilities } from './capability-extractor'

export interface OpponentResponseEstimate {
  /** 0..1；只代表公開資訊下的保守風險估計，不是讀取對手手牌。 */
  responseLikelihood: number
  publicResponseEvidence: number
  expectedPenalty: number
  /** 公開回應 Min 節點選出的最壞分支；只使用 PlayerView 可證明的資料。 */
  worstCasePenalty: number
  worstCaseKind: PublicResponseBranchKind
  responseBranches: readonly PublicResponseBranch[]
  /** 對手公開支援區中仍可支付未知回應的活躍能量張數。 */
  activeSupportCount: number
  /** 以公開手牌張數與活躍能量估算的未知出牌容量，不代表已知卡面。 */
  hiddenHandEnergyCapacity: number
  detail: string
}

export type PublicResponseBranchKind =
  | 'no-response'
  | 'unknown-hand-envelope'
  | 'reserved-energy-threat'
  | 'visible-block'
  | 'visible-trap'
  | 'visible-attack-response'

export interface PublicResponseBranch {
  kind: PublicResponseBranchKind
  penalty: number
  evidence: number
  detail: string
}

type VisibleResponseBranchKind = Exclude<
  PublicResponseBranchKind,
  'no-response' | 'unknown-hand-envelope' | 'reserved-energy-threat'
>

const neutralEstimate = (detail: string): OpponentResponseEstimate => ({
  responseLikelihood: 0,
  publicResponseEvidence: 0,
  expectedPenalty: 0,
  worstCasePenalty: 0,
  worstCaseKind: 'no-response',
  responseBranches: [{
    kind: 'no-response',
    penalty: 0,
    evidence: 0,
    detail: '公開資訊沒有可評估的對手回應分支。',
  }],
  activeSupportCount: 0,
  hiddenHandEnergyCapacity: 0,
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

const branchKindForCapability = (
  capability: ReturnType<typeof extractDeckCapabilities>[number]['capabilities'][number],
): VisibleResponseBranchKind | null => {
  if (capability.kind === 'block' || capability.timing === 'block') {
    return 'visible-block'
  }
  if (capability.kind === 'trap') return 'visible-trap'
  if (capability.timing === 'opponent-attack') return 'visible-attack-response'
  return null
}

const exposedValueForAttack = (
  view: PlayerView,
  identity: ActionIdentity,
): number => {
  const attacker = view.self.battleArea.find(
    (cookie) => cookie.card.instanceId === identity.sourceInstanceId,
  )
  return attacker
    ? 18 + attacker.card.level * 16 +
      (attacker.hpCount <= 1 ? 30 : attacker.hpCount === 2 ? 18 : 8) +
      Math.min(24, (attacker.card.attack ?? 0) * 4)
    : 40
}

/**
 * 建立公開資訊下的有限 Min 節點：
 * - no-response 永遠存在；
 * - unknown-hand-envelope 只使用對手公開手牌張數，不猜測卡面；
 * - visible-* 只由對手戰鬥區／支援區／棄牌區／Break／Stage 的能力證據建立。
 */
export const evaluatePublicResponseMinimax = (
  view: PlayerView,
  identity: ActionIdentity,
): OpponentResponseEstimate => {
  if (identity.kind !== 'attack') {
    return neutralEstimate('非攻擊行動，不套用公開回應 Min 節點。')
  }
  if (view.opponent.handCount <= 0) {
    return neutralEstimate('對手公開手牌張數為 0，不臆測隱藏回應。')
  }

  const models = extractDeckCapabilities(visibleOpponentCards(view))
  const responseModels = models.flatMap((model) =>
    model.capabilities.filter(isResponseCapability),
  )
  const publicResponseEvidence = models.reduce(
    (count, model) => count + Number(model.capabilities.some(isResponseCapability)),
    0,
  )
  const visibleCardCount = Math.max(1, models.length)
  const evidenceDensity = publicResponseEvidence / visibleCardCount
  const activeSupportCount = view.opponent.supportArea.filter(
    (support) => !support.rested,
  ).length
  const hiddenHandEnergyCapacity = Math.min(
    view.opponent.handCount,
    activeSupportCount,
  )
  // 沒有活躍支援時，對手無法支付未知回應卡的代價；未知手牌 envelope
  // 不成立，只保留公開區能力證據的 visible branch。
  const handSignal = hiddenHandEnergyCapacity > 0
    ? Math.min(0.42, view.opponent.handCount * 0.055)
    : 0
  const evidenceSignal = Math.min(0.38, evidenceDensity * 0.7)
  const responseLikelihood = Math.min(
    0.82,
    0.04 + handSignal + evidenceSignal,
  )
  const exposedValue = exposedValueForAttack(view, identity)
  const expectedPenalty = hiddenHandEnergyCapacity > 0
    ? -Math.round(responseLikelihood * exposedValue)
    : 0

  const branches: PublicResponseBranch[] = [{
    kind: 'no-response',
    penalty: 0,
    evidence: 0,
    detail: '對手不使用公開可證明的回應。',
  }]

  // 這是公開手牌張數的保守 envelope，不代表 AI 看到了任何隱藏卡面；
  // 只有對手仍有活躍支援可支付未知回應代價時才成立。
  if (hiddenHandEnergyCapacity > 0) {
    branches.push({
      kind: 'unknown-hand-envelope',
      penalty: expectedPenalty,
      evidence: 0,
      detail: `對手仍有 ${view.opponent.handCount} 張公開未知手牌，採 bounded response envelope。`,
    })
  }

  if (hiddenHandEnergyCapacity > 0) {
    const reservedEnergyLikelihood = Math.min(
      0.92,
      responseLikelihood + Math.min(0.22, activeSupportCount * 0.055),
    )
    branches.push({
      kind: 'reserved-energy-threat',
      penalty: -Math.round(reservedEnergyLikelihood * exposedValue),
      evidence: activeSupportCount,
      detail:
        `對手保留 ${activeSupportCount} 張活躍支援、` +
        `${view.opponent.handCount} 張未知手牌，具備約 ${hiddenHandEnergyCapacity} 張未知支付容量；` +
        '不猜測具體陷阱或餅乾，只提高公開回應風險。',
    })
  }

  const evidenceByKind = new Map<VisibleResponseBranchKind, number>()
  for (const capability of responseModels) {
    const kind = branchKindForCapability(capability)
    if (!kind) continue
    evidenceByKind.set(kind, (evidenceByKind.get(kind) ?? 0) + 1)
  }
  const kindBoost: Record<VisibleResponseBranchKind, number> = {
    'visible-block': 0.12,
    'visible-trap': 0.1,
    'visible-attack-response': 0.08,
  }
  for (const [kind, evidence] of evidenceByKind) {
    const likelihood = Math.min(
      0.92,
      responseLikelihood + kindBoost[kind] + Math.min(0.12, evidence * 0.03),
    )
    branches.push({
      kind,
      penalty: -Math.round(likelihood * exposedValue),
      evidence,
      detail: `公開區有 ${evidence} 筆 ${kind} 能力證據，作為最壞回應分支。`,
    })
  }

  const worst = branches.reduce((best, branch) =>
    branch.penalty < best.penalty ? branch : best,
  )
  return {
    responseLikelihood,
    publicResponseEvidence,
    expectedPenalty,
    worstCasePenalty: worst.penalty,
    worstCaseKind: worst.kind,
    responseBranches: branches,
    activeSupportCount,
    hiddenHandEnergyCapacity,
    detail:
      `公開手牌 ${view.opponent.handCount} 張、回應能力證據 ${publicResponseEvidence} 張；` +
      `Min 節點選擇 ${worst.kind}，最壞扣分 ${worst.penalty}。`,
  }
}

/**
 * 以 PlayerView 可見的卡與公開張數估計攻擊被回應的風險。這不是 opponent
 * tree，也不讀取實際對手手牌；相同 PlayerView 必定得到相同結果。
 */
export const estimateOpponentResponse = (
  view: PlayerView,
  identity: ActionIdentity,
): OpponentResponseEstimate => evaluatePublicResponseMinimax(view, identity)
