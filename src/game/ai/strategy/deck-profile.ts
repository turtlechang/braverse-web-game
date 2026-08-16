import type { GameCard } from '../../types'
import type {
  CardCapabilityModel,
  CapabilityEvidence,
  StrategyShadowReport,
  StrategyShadowTelemetry,
} from './capability-model'
import { extractDeckCapabilities } from './capability-extractor'

export type DeckStrategyAxis =
  | 'aggression'
  | 'control'
  | 'effect-damage'
  | 'support-engine'
  | 'deck-order-engine'
  | 'trash-cycle'
  | 'active-rest-chain'
  | 'hand-threshold'
  | 'durability'
  | 'setup-payoff'

export interface StrategyWeight {
  /** 0..1 normalized support for this strategy, not an action score. */
  value: number
  evidenceCount: number
  confidence: number
}

export interface DeckStrategyProfile {
  cardCount: number
  axes: Record<DeckStrategyAxis, StrategyWeight>
  unsupportedEffectCount: number
}

const axes: DeckStrategyAxis[] = [
  'aggression',
  'control',
  'effect-damage',
  'support-engine',
  'deck-order-engine',
  'trash-cycle',
  'active-rest-chain',
  'hand-threshold',
  'durability',
  'setup-payoff',
]

const evidenceMatchesAxis = (
  evidence: CapabilityEvidence,
  axis: DeckStrategyAxis,
): boolean => {
  switch (axis) {
    case 'aggression':
      return evidence.kind === 'damage' || evidence.kind === 'attack-modification'
    case 'control':
      return evidence.kind === 'control' || evidence.kind === 'discard' || evidence.kind === 'rest' || evidence.kind === 'trap' || evidence.kind === 'block'
    case 'effect-damage':
      return evidence.kind === 'damage' && evidence.source !== 'attack'
    case 'support-engine':
      return evidence.strategyTags.includes('support')
    case 'deck-order-engine':
      return evidence.kind === 'inspect-deck' || evidence.strategyTags.includes('deck-order')
    case 'trash-cycle':
      return evidence.strategyTags.includes('trash')
    case 'active-rest-chain':
      return evidence.kind === 'rest' || evidence.kind === 'set-active'
    case 'hand-threshold':
      return evidence.conditionKinds.some((kind) => kind.includes('hand'))
    case 'durability':
      return evidence.kind === 'gain-hp' || evidence.kind === 'block' || evidence.strategyTags.includes('hp')
    case 'setup-payoff':
      return evidence.kind === 'conditional-setup' || evidence.kind === 'conditional-payoff'
  }
}

const toWeight = (evidenceCount: number, cardCount: number): StrategyWeight => {
  if (cardCount === 0) return { value: 0, evidenceCount: 0, confidence: 0 }
  return {
    value: Math.min(1, evidenceCount / cardCount),
    evidenceCount,
    confidence: Math.min(1, evidenceCount / Math.max(1, Math.ceil(cardCount / 4))),
  }
}

export const deriveDeckStrategyProfile = (
  cards: readonly CardCapabilityModel[],
): DeckStrategyProfile => {
  const evidence = cards.flatMap((card) => card.capabilities)
  const axesProfile = Object.fromEntries(axes.map((axis) => [
    axis,
    toWeight(evidence.filter((entry) => evidenceMatchesAxis(entry, axis)).length, cards.length),
  ])) as Record<DeckStrategyAxis, StrategyWeight>
  return {
    cardCount: cards.length,
    axes: axesProfile,
    unsupportedEffectCount: evidence.filter((entry) => entry.kind === 'unsupported').length,
  }
}

export const createStrategyShadowReport = (
  cards: readonly GameCard[],
): StrategyShadowReport & { deckProfile: DeckStrategyProfile } => {
  const models = extractDeckCapabilities(cards)
  const unsupportedEffectKinds: Record<string, number> = {}
  const unsupportedCardIds = new Set<string>()
  for (const model of models) {
    for (const kind of model.unsupportedEffectKinds) {
      unsupportedEffectKinds[kind] = (unsupportedEffectKinds[kind] ?? 0) + 1
      unsupportedCardIds.add(model.cardId)
    }
  }
  const telemetry: StrategyShadowTelemetry = {
    unsupportedEffectKinds,
    unsupportedCardIds: [...unsupportedCardIds],
  }
  return {
    cards: models,
    deckProfile: deriveDeckStrategyProfile(models),
    telemetry,
  }
}
