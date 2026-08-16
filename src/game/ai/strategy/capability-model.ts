import type {
  AbilityCost,
  EffectCondition,
  EffectTargetSelector,
  GameCard,
} from '../../types'

/**
 * 策略層只使用這份結構化能力語彙，不重新解析卡面文字。
 * `unsupported` 是安全 fallback：它不會被視為任一可完成的策略能力。
 */
export type CapabilityKind =
  | 'damage'
  | 'draw'
  | 'discard'
  | 'gain-hp'
  | 'attack-modification'
  | 'deploy'
  | 'move'
  | 'inspect-deck'
  | 'rest'
  | 'set-active'
  | 'block'
  | 'trap'
  | 'flip'
  | 'control'
  | 'conditional-setup'
  | 'conditional-payoff'
  | 'unsupported'

export type CapabilitySource =
  | 'card-effect'
  | 'skill'
  | 'attack'
  | 'flip'
  | 'trap'
  | 'item'
  | 'stage'

export type CapabilityTiming =
  | 'activate'
  | 'on-play'
  | 'passive'
  | 'attack'
  | 'block'
  | 'opponent-attack'
  | 'faint'
  | 'after-damage'
  | 'end-phase'
  | 'flip'
  | 'other'

export type StrategyZone =
  | 'hand'
  | 'support'
  | 'trash'
  | 'break'
  | 'battle'
  | 'deck'
  | 'deck-top'
  | 'deck-bottom'
  | 'hp'

export type StrategyTag =
  | 'support'
  | 'trash'
  | 'deck-order'
  | 'active-rest'
  | 'hand'
  | 'hp'
  | 'battle'
  | 'break'
  | 'opponent-board'
  | 'opponent-hand'
  | 'break-race'

export type CapabilityCertainty =
  | 'confirmed'
  | 'conditional'
  | 'unsupported'

export interface CapabilityTarget {
  side: 'self' | 'opponent' | 'either' | 'none'
  min?: number
  max?: number
}

export interface CapabilityEvidence {
  cardId: string
  cardIndex: number
  kind: CapabilityKind
  source: CapabilitySource
  timing: CapabilityTiming
  /** Runtime `CardEffect.kind`; `null` is used by card-level FLIP／Trap markers. */
  effectKind: string | null
  sourceZone?: StrategyZone
  destinationZone?: StrategyZone
  target: CapabilityTarget
  cost: AbilityCost | null
  conditionKinds: string[]
  strategyTags: StrategyTag[]
  certainty: CapabilityCertainty
  /** Path in the structured effect tree, including choose-one／Then children. */
  effectPath: number[]
}

export interface CardCapabilityModel {
  cardId: string
  cardIndex: number
  capabilities: CapabilityEvidence[]
  unsupportedEffectKinds: string[]
}

export interface StrategyShadowTelemetry {
  unsupportedEffectKinds: Record<string, number>
  unsupportedCardIds: string[]
}

export interface StrategyShadowReport {
  cards: CardCapabilityModel[]
  telemetry: StrategyShadowTelemetry
}

export interface EffectSource {
  source: CapabilitySource
  timing: CapabilityTiming
  cost: AbilityCost | null
}

export const noTarget: CapabilityTarget = { side: 'none' }

export const toCapabilityTarget = (
  target?: EffectTargetSelector,
): CapabilityTarget =>
  target
    ? {
        side: target.side,
        min: target.min,
        max: target.max,
      }
    : noTarget

export const conditionKinds = (
  condition?: EffectCondition,
): string[] => {
  if (!condition) return []
  if (condition.kind === 'all-of' || condition.kind === 'any-of') {
    return [
      condition.kind,
      ...condition.conditions.flatMap((child) => conditionKinds(child)),
    ]
  }
  return [condition.kind]
}

export const conditionTags = (kinds: readonly string[]): StrategyTag[] => {
  const tags = new Set<StrategyTag>()
  for (const kind of kinds) {
    if (kind.includes('support')) tags.add('support')
    if (kind.includes('trash')) tags.add('trash')
    if (kind.includes('hand')) tags.add('hand')
    if (kind.includes('hp')) tags.add('hp')
    if (kind.includes('break')) tags.add('break')
    if (kind.includes('battle') || kind.includes('attacker')) tags.add('battle')
  }
  return [...tags]
}

export const makeEvidence = (
  card: GameCard,
  cardIndex: number,
  effectSource: EffectSource,
  effectPath: number[],
  details: Omit<CapabilityEvidence, 'cardId' | 'cardIndex' | 'source' | 'timing' | 'cost' | 'effectPath'>,
): CapabilityEvidence => ({
  cardId: card.id,
  cardIndex,
  source: effectSource.source,
  timing: effectSource.timing,
  cost: effectSource.cost,
  effectPath,
  ...details,
})
