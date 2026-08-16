import type { PlayerActionCommand } from '../../commands'
import type { PlayerView } from '../../player-view'
import { getKnownDeckFacts, type KnowledgeState } from './knowledge-state'
import {
  compareActionScoreBreakdowns,
  scoreAction,
  type ActionIdentity,
  type ActionScoreBreakdown,
} from './action-score'
import {
  capabilitiesForVisibleCard,
  createLv3StrategyContext,
  deriveTacticalPlan,
  findVisibleSelfCard,
  type Lv3StrategyContext,
} from './tactical-plans'

export interface Lv3ActionCandidate<T> {
  value: T
  identity: ActionIdentity
  afterView: PlayerView
  postActionBoardScore: number
  legalAttackCountBefore: number
  legalAttackCountAfter: number
}

export interface ScoredLv3ActionCandidate<T> {
  candidate: Lv3ActionCandidate<T>
  breakdown: ActionScoreBreakdown
}

export const actionIdentityFromCommand = (
  command: PlayerActionCommand,
): ActionIdentity => {
  const sourceInstanceId =
    'instanceId' in command
      ? command.instanceId
      : 'attackerInstanceId' in command
        ? command.attackerInstanceId
        : 'cookieInstanceId' in command
          ? command.cookieInstanceId
          : 'sourceInstanceId' in command
            ? command.sourceInstanceId
            : undefined
  return {
    kind: command.kind,
    sourceInstanceId,
    targetInstanceId: 'targetInstanceId' in command
      ? command.targetInstanceId
      : undefined,
    paymentIds: 'supportPaymentIds' in command
      ? command.supportPaymentIds
      : 'paymentIds' in command
        ? command.paymentIds
        : undefined,
  }
}

export const scoreLv3ActionCandidate = <T>(
  context: Lv3StrategyContext,
  beforeView: PlayerView,
  candidate: Lv3ActionCandidate<T>,
): ScoredLv3ActionCandidate<T> => {
  const sourceCard = findVisibleSelfCard(
    beforeView,
    candidate.identity.sourceInstanceId,
  )
  const tacticalPlan = deriveTacticalPlan(
    context,
    beforeView,
    sourceCard?.id,
  )
  const breakdown = scoreAction({
    identity: candidate.identity,
    beforeView,
    afterView: candidate.afterView,
    postActionBoardScore: candidate.postActionBoardScore,
    deckProfile: context.deckProfile,
    tacticalPlan,
    sourceCapabilities: capabilitiesForVisibleCard(context, sourceCard?.id),
    knownDeckFactCount: getKnownDeckFacts(
      context.knowledgeState,
      beforeView.viewerId,
    ).length,
    legalAttackCountBefore: candidate.legalAttackCountBefore,
    legalAttackCountAfter: candidate.legalAttackCountAfter,
  })
  return { candidate, breakdown }
}

export const selectBestLv3Action = <T>(
  candidates: readonly ScoredLv3ActionCandidate<T>[],
): ScoredLv3ActionCandidate<T> | null => {
  if (candidates.length === 0) return null
  return candidates.reduce((best, candidate) =>
    compareActionScoreBreakdowns(candidate.breakdown, best.breakdown) > 0
      ? candidate
      : best,
  )
}

export const createLv3ContextForView = (
  view: PlayerView,
  knowledgeState: KnowledgeState,
): Lv3StrategyContext => createLv3StrategyContext(view, knowledgeState)
