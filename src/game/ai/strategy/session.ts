import type { PlayerView } from '../../player-view'
import type { PlayerId } from '../../types'
import type { ActionScoreBreakdown } from './action-score'
import type { TacticalPlan, TacticalPlanKind } from './tactical-plans'
import {
  createKnowledgeState,
  synchronizeKnowledgeWithPlayerView,
  type KnowledgeState,
} from './knowledge-state'

export type AiTacticalIntent = 'setup' | 'payoff' | 'tempo'

export interface ActiveComboIntent {
  planId: string
  setupCardId?: string
  payoffCardId?: string
  startedAtDecision: number
  lastProgressDecision: number
  validity: 'same-turn' | 'persistent'
}

export interface ComboLifecycleTelemetry {
  started: number
  completed: number
  abandoned: number
}

/**
 * 一場對局內的策略記憶。內容只能由 PlayerView、合法 KnowledgeState 與
 * AI 自己已選擇的行動產生，不能接收完整 GameState 的隱藏區資料。
 */
export interface AiStrategyMemory {
  observerId: PlayerId
  knowledgeState: KnowledgeState
  decisionCount: number
  lastChosenCommandKind?: string
  activeIntent?: AiTacticalIntent
  intentStreak: number
  activeCombo?: ActiveComboIntent
  comboTelemetry: ComboLifecycleTelemetry
}

export interface AdvanceAiStrategyMemoryInput {
  chosenCommandKind?: string
  actionScore?: ActionScoreBreakdown
  tacticalPlan?: TacticalPlan
}

export const createAiStrategyMemory = (
  observerId: PlayerId,
  knowledgeState: KnowledgeState = createKnowledgeState(observerId),
): AiStrategyMemory => {
  if (knowledgeState.observerId !== observerId) {
    throw new Error('AI strategy memory 與 KnowledgeState 的 observer 必須一致。')
  }
  return {
    observerId,
    knowledgeState,
    decisionCount: 0,
    intentStreak: 0,
    comboTelemetry: { started: 0, completed: 0, abandoned: 0 },
  }
}

const contributionAmount = (
  breakdown: ActionScoreBreakdown | undefined,
  id: 'tactical-setup' | 'tactical-payoff' | 'attack-tempo',
): number => breakdown?.contributions
  .filter((contribution) => contribution.id === id)
  .reduce((total, contribution) => total + contribution.amount, 0) ?? 0

const deriveIntent = (
  input: AdvanceAiStrategyMemoryInput,
): AiTacticalIntent | undefined => {
  if (!input.actionScore) return undefined
  const setup = contributionAmount(input.actionScore, 'tactical-setup')
  const payoff = contributionAmount(input.actionScore, 'tactical-payoff')
  if (payoff > 0 && payoff >= setup) return 'payoff'
  if (setup > 0) return 'setup'
  return 'tempo'
}

export const advanceAiStrategyMemory = (
  memory: AiStrategyMemory,
  afterView: PlayerView,
  input: AdvanceAiStrategyMemoryInput,
): AiStrategyMemory => {
  if (afterView.viewerId !== memory.observerId) {
    throw new Error('AI strategy memory 只能由相同 observer 的 PlayerView 更新。')
  }
  const activeIntent = deriveIntent(input)
  const plan = input.tacticalPlan
  let activeCombo = memory.activeCombo
  let comboTelemetry = memory.comboTelemetry
  if (
    plan?.kind === 'setup' &&
    plan.status === 'confirmed' &&
    plan.comboPlanId
  ) {
    const replacesExisting = activeCombo && activeCombo.planId !== plan.comboPlanId
    comboTelemetry = {
      ...comboTelemetry,
      started: comboTelemetry.started + Number(!activeCombo || replacesExisting),
      abandoned: comboTelemetry.abandoned + Number(Boolean(replacesExisting)),
    }
    activeCombo = {
      planId: plan.comboPlanId,
      setupCardId: plan.setupCardId,
      payoffCardId: plan.payoffCardId,
      startedAtDecision: replacesExisting || !activeCombo
        ? memory.decisionCount
        : activeCombo.startedAtDecision,
      lastProgressDecision: memory.decisionCount,
      validity: plan.validity ?? 'same-turn',
    }
  } else if (
    plan?.kind === 'payoff' &&
    plan.status === 'confirmed' &&
    plan.comboPlanId &&
    activeCombo?.planId === plan.comboPlanId
  ) {
    comboTelemetry = {
      ...comboTelemetry,
      completed: comboTelemetry.completed + 1,
    }
    activeCombo = undefined
  } else if (
    input.chosenCommandKind === 'advance-phase' &&
    activeCombo?.validity === 'same-turn'
  ) {
    comboTelemetry = {
      ...comboTelemetry,
      abandoned: comboTelemetry.abandoned + 1,
    }
    activeCombo = undefined
  }
  return {
    ...memory,
    knowledgeState: synchronizeKnowledgeWithPlayerView(
      memory.knowledgeState,
      afterView,
    ),
    decisionCount: memory.decisionCount + 1,
    lastChosenCommandKind: input.chosenCommandKind,
    activeIntent: activeIntent ?? memory.activeIntent,
    intentStreak: activeIntent === undefined
      ? memory.intentStreak
      : memory.activeIntent === activeIntent
        ? memory.intentStreak + 1
        : 1,
    activeCombo,
    comboTelemetry,
  }
}

/**
 * 只作用於下一個 free-choice 根行動：setup 後優先兌現 payoff，避免跨
 * pending 步驟忘記原計畫。這是候選內相對分數，不是合法性判斷。
 */
export const scoreIntentContinuity = (
  memory: AiStrategyMemory | undefined,
  planOrKind: TacticalPlan | TacticalPlanKind,
): number => {
  const planKind = typeof planOrKind === 'string' ? planOrKind : planOrKind.kind
  if (!memory?.activeIntent || memory.activeIntent === 'tempo') return 0
  if (memory.activeCombo && typeof planOrKind !== 'string') {
    if (
      planOrKind.kind === 'payoff' &&
      planOrKind.status === 'confirmed' &&
      planOrKind.comboPlanId === memory.activeCombo.planId
    ) return 36
    if (
      planOrKind.kind === 'setup' &&
      planOrKind.comboPlanId === memory.activeCombo.planId
    ) return -4
    if (planOrKind.kind === 'payoff') return -6
    if (planOrKind.kind === 'tempo') return -3
  }
  if (memory.activeIntent === 'setup') {
    if (planKind === 'payoff') return 24
    if (planKind === 'setup') return memory.intentStreak >= 2 ? 4 : 8
    return memory.intentStreak >= 2 ? -4 : -2
  }
  if (planKind === 'payoff') return 10
  if (planKind === 'setup') return 4
  return 0
}
