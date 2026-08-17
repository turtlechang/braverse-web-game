import type { PlayerView } from '../../player-view'
import type { DeckStrategyProfile } from './deck-profile'
import type { CapabilityEvidence } from './capability-model'
import type { TacticalPlan } from './tactical-plans'

/**
 * 只可在同一局面候選集合內排序的數值。它不是勝負、合法性或跨局面門檻。
 */
export type RelativeActionScore = number

export type TerminalOutcome = 'win' | 'loss' | 'none'

export interface ActionIdentity {
  kind: string
  sourceInstanceId?: string
  targetInstanceId?: string
  paymentIds?: readonly string[]
}

export interface CalibratedActionSignals {
  terminalOutcome: TerminalOutcome
  legalAttackCountBefore: number
  legalAttackCountAfter: number
  activeSupportBefore: number
  activeSupportAfter: number
  knownDeckFactCount: number
  /** 由公開戰鬥區攻擊力與 HP 計算，不讀未翻 HP。 */
  publicLethal: boolean
}

export interface ActionScoreContribution {
  id:
    | 'post-action-board'
    | 'public-attack'
    | 'tactical-payoff'
    | 'tactical-setup'
    | 'resource-reservation'
    | 'attack-tempo'
    | 'unsupported-effect'
    | 'unknown-information'
    | 'strategy-profile'
  amount: number
  detail: string
}

export interface ActionScoreBreakdown {
  scoreType: 'relative-action-score'
  total: RelativeActionScore
  calibrated: CalibratedActionSignals
  contributions: readonly ActionScoreContribution[]
  unsupportedEffectKinds: readonly string[]
  unknownInformationPenalty: number
  tieBreakKey: string
}

export interface ScoreActionInput {
  identity: ActionIdentity
  beforeView: PlayerView
  afterView: PlayerView
  /** 由既有 public-view evaluator 產生的候選內基準分。 */
  postActionBoardScore: RelativeActionScore
  deckProfile: DeckStrategyProfile
  tacticalPlan: TacticalPlan
  sourceCapabilities: readonly CapabilityEvidence[]
  knownDeckFactCount: number
  legalAttackCountBefore: number
  legalAttackCountAfter: number
}

const activeSupportCount = (view: PlayerView): number =>
  view.self.supportArea.filter((support) => !support.rested).length

const publicAttackSignal = (
  view: PlayerView,
  identity: ActionIdentity,
): { damage: number; targetHp: number; targetLevel: number } | null => {
  if (identity.kind !== 'attack' || !identity.sourceInstanceId || !identity.targetInstanceId) {
    return null
  }
  const attacker = view.self.battleArea.find(
    (cookie) => cookie.card.instanceId === identity.sourceInstanceId,
  )
  const target = view.opponent.battleArea.find(
    (cookie) => cookie.card.instanceId === identity.targetInstanceId,
  )
  if (!attacker || !target) return null
  return {
    damage: attacker.card.attack,
    targetHp: target.hpCount,
    targetLevel: target.card.level,
  }
}

export const actionTieBreakKey = (identity: ActionIdentity): string => [
  identity.kind,
  identity.sourceInstanceId ?? '',
  identity.targetInstanceId ?? '',
  [...(identity.paymentIds ?? [])].sort().join(','),
].join('|')

/**
 * 終局訊號先於相對分數比較；其餘候選只能比較同一局面內的 relative score。
 */
export const compareActionScoreBreakdowns = (
  left: ActionScoreBreakdown,
  right: ActionScoreBreakdown,
): number => {
  const terminalRank: Record<TerminalOutcome, number> = {
    win: 2,
    none: 1,
    loss: 0,
  }
  const outcomeDelta =
    terminalRank[left.calibrated.terminalOutcome] -
    terminalRank[right.calibrated.terminalOutcome]
  if (outcomeDelta !== 0) return outcomeDelta
  if (left.total !== right.total) return left.total - right.total
  return right.tieBreakKey.localeCompare(left.tieBreakKey)
}

export const scoreAction = (input: ScoreActionInput): ActionScoreBreakdown => {
  const contributions: ActionScoreContribution[] = [{
    id: 'post-action-board',
    amount: input.postActionBoardScore,
    detail: '既有 public-view 場面評估。',
  }]
  const terminalOutcome: TerminalOutcome = input.afterView.status === 'finished'
    ? input.afterView.result?.winnerId === input.beforeView.viewerId
      ? 'win'
      : 'loss'
    : 'none'
  const attack = publicAttackSignal(input.beforeView, input.identity)
  const publicLethal = Boolean(attack && attack.damage >= attack.targetHp)

  if (attack) {
    const amount = publicLethal
      ? 160 + attack.targetLevel * 20
      : Math.min(attack.damage, attack.targetHp) * 22
    contributions.push({
      id: 'public-attack',
      amount,
      detail: publicLethal
        ? '公開 HP 與攻擊力顯示本次攻擊可擊倒目標。'
        : '公開攻擊力可對目標造成的預期傷害。',
    })
  }

  if (input.tacticalPlan.kind === 'payoff') {
    contributions.push({
      id: 'tactical-payoff',
      amount: input.tacticalPlan.relativeValue,
      detail: input.tacticalPlan.detail,
    })
  } else if (input.tacticalPlan.kind === 'setup') {
    contributions.push({
      id: 'tactical-setup',
      amount: input.tacticalPlan.relativeValue,
      detail: input.tacticalPlan.detail,
    })
  }

  if (
    input.identity.kind === 'advance-phase' &&
    input.legalAttackCountBefore > 0
  ) {
    contributions.push({
      id: 'attack-tempo',
      amount: -70,
      detail: '主要階段仍有規則層列出的合法攻擊，不應無故結束階段。',
    })
  }

  const supportSpent = Math.max(
    0,
    activeSupportCount(input.beforeView) - activeSupportCount(input.afterView),
  )
  if (
    input.identity.kind !== 'attack' &&
    input.legalAttackCountBefore > 0 &&
    input.legalAttackCountAfter === 0 &&
    supportSpent > 0
  ) {
    contributions.push({
      id: 'resource-reservation',
      amount: -supportSpent * 16,
      detail: '此行動耗盡活躍支援，會失去本回合原本可支付的攻擊。',
    })
  }

  const profileValue = input.identity.kind === 'place-support'
    ? Math.round(input.deckProfile.axes['support-engine'].value * 8)
    : input.identity.kind === 'deploy-cookie'
      ? Math.round(input.deckProfile.axes.aggression.value * 6)
      : 0
  if (profileValue !== 0) {
    contributions.push({
      id: 'strategy-profile',
      amount: profileValue,
      detail: '由目前可合法得知的己方卡牌能力分布推導的連續策略權重。',
    })
  }

  const unsupportedEffectKinds = input.sourceCapabilities
    .filter((capability) => capability.kind === 'unsupported')
    .map((capability) => capability.effectKind ?? 'unknown')
  if (unsupportedEffectKinds.length > 0) {
    contributions.push({
      id: 'unsupported-effect',
      amount: -unsupportedEffectKinds.length * 8,
      detail: '來源含未支援的結構化效果，採中性偏保守估值。',
    })
  }

  const unknownInformationPenalty =
    input.tacticalPlan.requiresKnownDeckFact && input.knownDeckFactCount === 0
      ? -12
      : 0
  if (unknownInformationPenalty !== 0) {
    contributions.push({
      id: 'unknown-information',
      amount: unknownInformationPenalty,
      detail: '計畫涉及牌庫順序，但沒有可用的合法已知頂／底資訊。',
    })
  }

  return {
    scoreType: 'relative-action-score',
    total: contributions.reduce((sum, contribution) => sum + contribution.amount, 0),
    calibrated: {
      terminalOutcome,
      legalAttackCountBefore: input.legalAttackCountBefore,
      legalAttackCountAfter: input.legalAttackCountAfter,
      activeSupportBefore: activeSupportCount(input.beforeView),
      activeSupportAfter: activeSupportCount(input.afterView),
      knownDeckFactCount: input.knownDeckFactCount,
      publicLethal,
    },
    contributions,
    unsupportedEffectKinds,
    unknownInformationPenalty,
    tieBreakKey: actionTieBreakKey(input.identity),
  }
}
