import type { CardEffect, GameCard, GameState, PlayerId } from '../types'

export type AiLevel = 1 | 2 | 3

export interface AiStepOptions {
  /** AI 等級；預設 2（現行啟發式）。1 為隨機合法操作，3 為評估式打分。 */
  level?: AiLevel
  /** Lv.1 隨機性的種子；相同種子與局面必產生相同決策。 */
  seed?: number
}

export interface AiDecisionReason {
  level: AiLevel
  consideredCommands?: number
  chosenCommandKind?: string
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
  | 'resolve-damage'
  | 'resolve-attack-effect'
  | 'resolve-flip'
  | 'resolve-faint'
  | 'resolve-after-damage'
  | 'resolve-effect-order'
  | 'resolve-inspect-deck'
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
