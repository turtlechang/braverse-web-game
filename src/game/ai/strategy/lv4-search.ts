import type { PlayerActionCommand } from '../../commands'
import type { PlayerView } from '../../player-view'
import type { GameState, PlayerId } from '../../types'
import type { ActionScoreBreakdown } from './action-score'
import {
  actionIdentityFromCommand,
  createLv3ContextForView,
  scoreLv3ActionCandidate,
} from './lv3-strategy'
import type { KnowledgeState } from './knowledge-state'
import {
  assessResourceReservation,
  deriveResourceReservation,
  type ResourceReservationAssessment,
} from './resource-reservation'
import {
  createLv4SearchTelemetry,
  type Lv4PlanTelemetry,
  type Lv4SearchTelemetry,
} from './search-telemetry'
import { deriveTacticalPlan, type TacticalPlan } from './tactical-plans'

export interface Lv4SearchOptions {
  beamWidth: number
  maxDepth: number
  maxNodes: number
  timeBudgetMs: number
  /** 測試可注入時鐘；正式執行使用 Date.now。 */
  now?: () => number
  /** 多個 root candidate 共用同一預算時使用。 */
  deadlineMs?: number
}

export const DEFAULT_LV4_SEARCH_OPTIONS: Readonly<Lv4SearchOptions> = {
  beamWidth: 5,
  maxDepth: 5,
  maxNodes: 240,
  timeBudgetMs: 150,
}

export interface Lv4SearchHooks {
  getLegalCommands: (
    state: GameState,
    playerId: PlayerId,
  ) => readonly PlayerActionCommand[]
  applyCommand: (
    state: GameState,
    command: PlayerActionCommand,
  ) => GameState
  createPlayerView: (state: GameState, playerId: PlayerId) => PlayerView
  /** 僅以 PlayerView 給出公開盤面值。 */
  scorePublicView: (view: PlayerView) => number
  /** 保留 R8～R11／既有風險修正；不得讀取隱藏卡面。 */
  legacyStepBonus: (
    beforeState: GameState,
    afterState: GameState,
    playerId: PlayerId,
    command: PlayerActionCommand,
  ) => number
  /** pending、換人、結束階段等不應在本回合搜尋繼續展開的狀態。 */
  isTerminal: (state: GameState, playerId: PlayerId) => boolean
}

export interface Lv4PlanProgress extends Lv4PlanTelemetry {
  sharedTags: readonly string[]
}

export interface Lv4SearchStep {
  command: PlayerActionCommand
  tacticalPlan: TacticalPlan
  actionScore: ActionScoreBreakdown
  actionScoreTotal: number
  unsupportedEffectCount: number
  unknownInformationPenalty: number
  strategicScore: number
  reservation: ResourceReservationAssessment
  relativeScore: number
}

interface SearchNode {
  state: GameState
  view: PlayerView
  score: number
  depth: number
  firstCommand: PlayerActionCommand | null
  firstStep: Lv4SearchStep | null
  plan: Lv4PlanProgress
  pathTieBreakKey: string
  isTerminal: boolean
  canExpand: boolean
}

export interface Lv4SearchResult {
  firstCommand: PlayerActionCommand | null
  firstStep: Lv4SearchStep | null
  relativeScore: number
  plan: Lv4PlanProgress
  telemetry: Lv4SearchTelemetry
}

const initialPlan = (): Lv4PlanProgress => ({
  setupSteps: 0,
  payoffSteps: 0,
  completedPayoffs: 0,
  sharedTags: [],
})

const compareNodes = (left: SearchNode, right: SearchNode): number => {
  if (left.score !== right.score) return right.score - left.score
  return left.pathTieBreakKey.localeCompare(right.pathTieBreakKey)
}

const sourceCardId = (
  view: PlayerView,
  sourceInstanceId: string | undefined,
): string | undefined => {
  if (!sourceInstanceId) return undefined
  return [
    ...view.hand,
    ...view.self.battleArea.map((cookie) => cookie.card),
    ...view.self.supportArea.map((support) => support.card),
    ...view.self.breakArea,
    ...view.self.discardPile,
    ...(view.self.stage ? [view.self.stage.card] : []),
  ].find((card) => card.instanceId === sourceInstanceId)?.id
}

/**
 * 策略不能因搜尋套用抽牌而得知原本未知的手牌身分。新增手牌一律停止
 * 後續 command 列舉；這是保守終端，不改變已套用行動本身的規則結果。
 */
const canSafelyExpand = (
  beforeView: PlayerView,
  afterView: PlayerView,
): boolean => {
  const knownBefore = new Set(beforeView.hand.map((card) => card.instanceId))
  return afterView.hand.every((card) => knownBefore.has(card.instanceId))
}

export const selectLv4StrategicContribution = (
  breakdown: ReturnType<typeof scoreLv3ActionCandidate>['breakdown'],
): number => breakdown.contributions
  .filter((contribution) =>
    contribution.id === 'tactical-payoff' ||
    contribution.id === 'tactical-setup' ||
    contribution.id === 'strategy-profile' ||
    contribution.id === 'unsupported-effect' ||
    contribution.id === 'unknown-information',
  )
  .reduce((total, contribution) => total + contribution.amount, 0)

export const advanceLv4Plan = (
  previous: Lv4PlanProgress,
  tacticalPlan: TacticalPlan,
): { plan: Lv4PlanProgress; completionBonus: number } => {
  if (tacticalPlan.kind === 'setup') {
    return {
      plan: {
        ...previous,
        setupSteps: previous.setupSteps + 1,
        sharedTags: tacticalPlan.sharedTags,
      },
      completionBonus: 0,
    }
  }
  if (tacticalPlan.kind === 'payoff') {
    const completesKnownSetup = previous.setupSteps > previous.payoffSteps
    return {
      plan: {
        ...previous,
        payoffSteps: previous.payoffSteps + 1,
        completedPayoffs: previous.completedPayoffs + Number(completesKnownSetup),
        sharedTags: tacticalPlan.sharedTags,
      },
      completionBonus: completesKnownSetup ? 18 : 0,
    }
  }
  return { plan: previous, completionBonus: 0 }
}

const updateTelemetryForStep = (
  telemetry: Lv4SearchTelemetry,
  step: Lv4SearchStep,
  plan: Lv4PlanProgress,
) => {
  telemetry.unsupportedEffectCount += step.unsupportedEffectCount
  telemetry.unknownInformationPenalty += step.unknownInformationPenalty
  if (!step.reservation.reserved) telemetry.resourceReservationMisses += 1
  telemetry.plan = {
    setupSteps: Math.max(telemetry.plan.setupSteps, plan.setupSteps),
    payoffSteps: Math.max(telemetry.plan.payoffSteps, plan.payoffSteps),
    completedPayoffs: Math.max(telemetry.plan.completedPayoffs, plan.completedPayoffs),
  }
}

/**
 * 有限的 Lv.4 command 搜尋。搜尋本身只透過 hooks 請規則層列舉／套用
 * command；策略值只由 PlayerView、G2 KnowledgeState、結構化 capability
 * 與公開支援資源產生。任何時間預算中斷均回傳 time-budget，caller 必須
 * 使用 G3，而不是挑選半截 frontier。
 */
export const searchLv4Commands = (
  state: GameState,
  playerId: PlayerId,
  knowledgeState: KnowledgeState,
  hooks: Lv4SearchHooks,
  options: Partial<Lv4SearchOptions> = {},
): Lv4SearchResult => {
  const config = { ...DEFAULT_LV4_SEARCH_OPTIONS, ...options }
  const now = config.now ?? Date.now
  const startedAt = now()
  const deadline = config.deadlineMs ?? startedAt + config.timeBudgetMs
  const telemetry = createLv4SearchTelemetry()
  const rootView = hooks.createPlayerView(state, playerId)
  let frontier: SearchNode[] = [{
    state,
    view: rootView,
    score: 0,
    depth: 0,
    firstCommand: null,
    firstStep: null,
    plan: initialPlan(),
    pathTieBreakKey: '',
    isTerminal: hooks.isTerminal(state, playerId),
    canExpand: true,
  }]
  let best: SearchNode | null = null
  let nodeLimitReached = false

  const timedOut = (): boolean => now() >= deadline

  for (let depth = 0; depth < config.maxDepth; depth += 1) {
    if (timedOut()) {
      telemetry.stopReason = 'time-budget'
      telemetry.fallbackUsed = true
      telemetry.elapsedMs = now() - startedAt
      return {
        firstCommand: null,
        firstStep: null,
        relativeScore: 0,
        plan: initialPlan(),
        telemetry,
      }
    }

    const next: SearchNode[] = []
    for (const node of frontier) {
      if (node.isTerminal || !node.canExpand) {
        next.push(node)
        continue
      }
      if (timedOut()) {
        telemetry.stopReason = 'time-budget'
        telemetry.fallbackUsed = true
        telemetry.elapsedMs = now() - startedAt
        return {
          firstCommand: null,
          firstStep: null,
          relativeScore: 0,
          plan: initialPlan(),
          telemetry,
        }
      }

      const commands = hooks.getLegalCommands(node.state, playerId)
      const reservation = deriveResourceReservation(node.view, commands)
      telemetry.nodesExpanded += 1

      if (commands.length === 0) {
        next.push({ ...node, isTerminal: true })
        continue
      }

      for (const command of commands) {
        if (timedOut()) {
          telemetry.stopReason = 'time-budget'
          telemetry.fallbackUsed = true
          telemetry.elapsedMs = now() - startedAt
          return {
            firstCommand: null,
            firstStep: null,
            relativeScore: 0,
            plan: initialPlan(),
            telemetry,
          }
        }
        if (telemetry.nodesGenerated >= config.maxNodes) {
          nodeLimitReached = true
          break
        }

        try {
          const afterState = hooks.applyCommand(node.state, command)
          const afterView = hooks.createPlayerView(afterState, playerId)
          const afterIsSafeToExpand = canSafelyExpand(node.view, afterView)
          const identity = actionIdentityFromCommand(command)
          const context = createLv3ContextForView(node.view, knowledgeState)
          const scored = scoreLv3ActionCandidate(context, node.view, {
            value: command,
            identity,
            afterView,
            postActionBoardScore: hooks.scorePublicView(afterView),
            legalAttackCountBefore: reservation.legalAttackCount,
            legalAttackCountAfter: afterIsSafeToExpand
              ? hooks.getLegalCommands(afterState, playerId)
                .filter((candidate) => candidate.kind === 'attack').length
              : 0,
          })
          const sourceId = sourceCardId(node.view, identity.sourceInstanceId)
          const tacticalPlan = deriveTacticalPlan(context, node.view, sourceId)
          const reservationAssessment = assessResourceReservation(
            reservation,
            afterView,
            identity.kind,
          )
          const progressed = advanceLv4Plan(node.plan, tacticalPlan)
          const strategicScore = selectLv4StrategicContribution(scored.breakdown)
          const relativeScore =
            hooks.scorePublicView(afterView) - hooks.scorePublicView(node.view) +
            hooks.legacyStepBonus(node.state, afterState, playerId, command) +
            strategicScore +
            reservationAssessment.amount +
            progressed.completionBonus
          const step: Lv4SearchStep = {
            command,
            tacticalPlan,
            actionScore: scored.breakdown,
            actionScoreTotal: scored.breakdown.total,
            unsupportedEffectCount: scored.breakdown.unsupportedEffectKinds.length,
            unknownInformationPenalty: scored.breakdown.unknownInformationPenalty,
            strategicScore,
            reservation: reservationAssessment,
            relativeScore,
          }
          const canExpand = afterIsSafeToExpand
          if (!canExpand) telemetry.hiddenInformationStops += 1
          const pathTieBreakKey = node.pathTieBreakKey
            ? `${node.pathTieBreakKey}>${scored.breakdown.tieBreakKey}`
            : scored.breakdown.tieBreakKey
          const child: SearchNode = {
            state: afterState,
            view: afterView,
            score: node.score + relativeScore,
            depth: node.depth + 1,
            firstCommand: node.firstCommand ?? command,
            firstStep: node.firstStep ?? step,
            plan: progressed.plan,
            pathTieBreakKey,
            isTerminal: hooks.isTerminal(afterState, playerId),
            canExpand,
          }
          updateTelemetryForStep(telemetry, step, progressed.plan)
          telemetry.nodesGenerated += 1
          telemetry.maxDepthReached = Math.max(telemetry.maxDepthReached, child.depth)
          next.push(child)
          if (!best || compareNodes(child, best) < 0) best = child
        } catch {
          // 只接受規則層能套用的 command；失敗候選不進入搜尋。
        }
      }
      if (nodeLimitReached) break
    }

    if (next.length === 0) break
    next.sort(compareNodes)
    telemetry.nodesPruned += Math.max(0, next.length - config.beamWidth)
    frontier = next.slice(0, config.beamWidth)
    if (nodeLimitReached || frontier.every((node) => node.isTerminal || !node.canExpand)) {
      break
    }
  }

  telemetry.stopReason = nodeLimitReached ? 'node-limit' : best ? 'completed' : 'no-candidate'
  telemetry.fallbackUsed = telemetry.stopReason === 'no-candidate'
  telemetry.elapsedMs = now() - startedAt
  telemetry.plan = best?.plan ?? telemetry.plan
  return {
    firstCommand: best?.firstCommand ?? null,
    firstStep: best?.firstStep ?? null,
    relativeScore: best?.score ?? 0,
    plan: best?.plan ?? initialPlan(),
    telemetry,
  }
}
