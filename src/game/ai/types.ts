import type { CardEffect, GameCard, GameState } from '../types'

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
  | 'resolve-damage'
  | 'resolve-attack-effect'
  | 'resolve-flip'
  | 'resolve-faint'
  | 'resolve-inspect-deck'
  | 'resolve-optional-cost-attack'
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
  effectSelections?: AiEffectSelection[]
  error?: string
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
