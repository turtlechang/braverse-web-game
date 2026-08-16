import type { CardEffect, GameCard, GameState, PlayerId } from '../types'
import type { ActionScoreBreakdown } from './strategy/action-score'
import type { KnowledgeState } from './strategy/knowledge-state'
import type {
  Lv4SearchTelemetry,
  Lv4SearchTelemetryAggregate,
} from './strategy/search-telemetry'

export type AiLevel = 1 | 2 | 3 | 4

export interface AiStepOptions {
  /** AI 等級；預設 2（現行啟發式）。1 為隨機合法操作，3 為評估式打分。 */
  level?: AiLevel
  /** Lv.1 隨機性的種子；相同種子與局面必產生相同決策。 */
  seed?: number
  /**
   * 只可由 G2 的合法 observation events 建立；未提供時 Lv.3 只使用
   * 當前 PlayerView 的公開資訊，不會從完整 GameState 補看牌庫。
   */
  knowledgeState?: KnowledgeState
}

export interface AiDecisionReason {
  level: AiLevel
  consideredCommands?: number
  chosenCommandKind?: string
  actionScore?: ActionScoreBreakdown
  lv4Search?: Lv4SearchTelemetry
}

export interface SimulateAiMatchOptions {
  levels?: Partial<Record<PlayerId, AiLevel>>
  seed?: number
}

export type AiActionType =
  | 'idle'
  | 'refresh'
  | 'replace-cookie'
  | 'skip-replacement'
  | 'advance-phase'
  | 'place-support'
  | 'deploy-cookie'
  | 'activate-skill'
  | 'play-item'
  | 'play-stage'
  | 'activate-stage'
  | 'attack'
  | 'play-trap'
  | 'play-blocker'
  | 'play-attack-response'
  | 'resolve-damage'
  | 'resolve-attack-effect'
  | 'resolve-flip'
  | 'resolve-faint'
  | 'resolve-after-damage'
  | 'resolve-effect-order'
  | 'resolve-inspect-deck'
  | 'resolve-reveal-top-deck'
  | 'resolve-optional-cost-attack'
  | 'resolve-stage-trigger'
  | 'error'

export interface AiEffectSelection {
  sourceInstanceId: string
  paymentIds: string[]
  targetIds: string[]
  effect: CardEffect
}

export interface AiDecision {
  state: GameState
  action: AiActionType
  description: string
  revealedCard?: GameCard
  revealedCards?: GameCard[]
  effectSelections?: AiEffectSelection[]
  error?: string
  reason?: AiDecisionReason
  r7TrapSkip?: boolean
}

export interface AiMatchMetrics {
  skillActivations: number
  refreshes: number
  replacements: number
}

export interface AiMatchResult {
  state: GameState
  actions: number
  logs: string[]
  metrics: AiMatchMetrics
  stuck: boolean
  error: string | null
}

// ============================================================================
// 詳細事件追蹤（Phase 3a-1.5）
// ============================================================================

export interface ReplacementEvent {
  turn: number
  player: PlayerId
  cardId: string
  cardName: string
  level: number
  hp: number
  score: number
  candidateCount: number
  rank: number
}

export interface AttackEvent {
  turn: number
  attackerPlayerId: PlayerId
  defenderPlayerId: PlayerId
  attackerId: string
  attackerName: string
  declaredTargetId: string
  finalTargetId: string
  targetName: string
  targetLevel: number
  damage: number
  targetHpBefore: number
  targetHpAfter: number | null
  isKill: boolean
  isOverkill: boolean
  overkillAmount: number
  wasRedirected: boolean
  breakAreaBefore: number
  breakAreaAfter: number
  breakAreaDelta: number
}

export interface TurnProgression {
  totalTurns: number
  noDamageTurns: number
  noBoardChangeTurns: number
  consecutiveNoProgressMax: number
  turnCapReached: boolean
}

export interface EndInfo {
  winner: PlayerId | null
  loser: PlayerId | null
  reason: string | null
  playerOneBreakLevel: number
  playerTwoBreakLevel: number
  turnCapReached: boolean
}

export interface BehaviorMetrics {
  lowQualityReplacementCount: number
  playerOneLowQualityReplacements: number
  playerTwoLowQualityReplacements: number
  replacementAvgScore: number
  replacementAvgRank: number
  playerOneReplacementAvgScore: number
  playerTwoReplacementAvgScore: number
  playerOneTotalReplacements: number
  playerTwoTotalReplacements: number
  attackKillRate: number
  overkillRatio: number
  avgOverkillAmount: number
  skillUsageCount: number
  invalidActionCount: number
  deadlockCount: number
  noDamageTurns: number
  noBoardChangeTurns: number
  consecutiveNoProgressMax: number
  r7TrapSkippedCount: number
  lethalOpportunityCount: number
  lethalConversionCount: number
  directWinCount: number
  r10PenaltyAppliedCount: number
  r10BreakRaceRiskCount: number
  r10ExposureRiskCount: number
  r6cReplacementCount: number
  r6cLowQualityCount: number
  r6cForcedCount: number
  r6cBreakWorsenedCount: number
  legalAttackSkippedCount: number
  lv4Search: Lv4SearchTelemetryAggregate
}

export interface AiDetailedResult {
  state: GameState
  actions: number
  logs: string[]
  metrics: AiMatchMetrics
  stuck: boolean
  error: string | null
  replacementEvents: ReplacementEvent[]
  attackEvents: AttackEvent[]
  turnProgression: TurnProgression
  endInfo: EndInfo
  behavior: BehaviorMetrics
  /** 原始決策 telemetry，供 benchmark 正確計算跨對局 p95。 */
  lv4SearchTelemetry: readonly Lv4SearchTelemetry[]
}
