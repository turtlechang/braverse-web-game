import type { PlayerView } from '../../player-view'
import type { GameCard } from '../../types'
import { extractDeckCapabilities } from './capability-extractor'
import type { CapabilityEvidence, CardCapabilityModel } from './capability-model'
import { deriveDeckStrategyProfile, type DeckStrategyProfile } from './deck-profile'
import { getKnownDeckFacts, type KnowledgeState } from './knowledge-state'
import { buildSynergyGraph, type SynergyGraph } from './synergy-graph'

export type TacticalPlanKind = 'payoff' | 'setup' | 'tempo'
export type TacticalPlanStatus = 'confirmed' | 'potential' | 'none'

export interface TacticalPlan {
  kind: TacticalPlanKind
  status: TacticalPlanStatus
  sourceCardId?: string
  sharedTags: readonly string[]
  relativeValue: number
  requiresKnownDeckFact: boolean
  detail: string
}

export interface Lv3StrategyContext {
  cards: readonly GameCard[]
  capabilityModels: readonly CardCapabilityModel[]
  deckProfile: DeckStrategyProfile
  synergyGraph: SynergyGraph
  knowledgeState: KnowledgeState
}

export const visibleSelfCards = (view: PlayerView): GameCard[] => [
  ...view.hand,
  ...view.self.battleArea.map((cookie) => cookie.card),
  ...view.self.supportArea.map((support) => support.card),
  ...view.self.breakArea,
  ...view.self.discardPile,
  ...(view.self.stage ? [view.self.stage.card] : []),
].sort((left, right) => left.instanceId.localeCompare(right.instanceId))

export const findVisibleSelfCard = (
  view: PlayerView,
  instanceId: string | undefined,
): GameCard | undefined =>
  instanceId
    ? visibleSelfCards(view).find((card) => card.instanceId === instanceId)
    : undefined

const hasPublicTag = (
  view: PlayerView,
  tag: string,
  knownDeckFactCount: number,
): boolean => {
  switch (tag) {
    case 'support':
      return view.self.supportArea.length > 0
    case 'trash':
      return view.self.discardPile.length > 0
    case 'active-rest':
      return view.self.supportArea.some((support) => support.rested)
    case 'hand':
      return view.hand.length > 0
    case 'hp':
      return view.self.battleArea.some((cookie) => cookie.hpCount > 0)
    case 'battle':
      return view.self.battleArea.length > 0
    case 'break':
      return view.self.breakArea.length > 0
    case 'deck-order':
      return knownDeckFactCount > 0
    default:
      return false
  }
}

export const createLv3StrategyContext = (
  view: PlayerView,
  knowledgeState: KnowledgeState,
): Lv3StrategyContext => {
  const cards = visibleSelfCards(view)
  const capabilityModels = extractDeckCapabilities(cards)
  return {
    cards,
    capabilityModels,
    deckProfile: deriveDeckStrategyProfile(capabilityModels),
    synergyGraph: buildSynergyGraph(capabilityModels),
    knowledgeState,
  }
}

const capabilitiesForCard = (
  context: Lv3StrategyContext,
  cardId: string | undefined,
): CapabilityEvidence[] => context.capabilityModels
  .filter((model) => model.cardId === cardId)
  .flatMap((model) => model.capabilities)

export const capabilitiesForVisibleCard = (
  context: Lv3StrategyContext,
  cardId: string | undefined,
): CapabilityEvidence[] => capabilitiesForCard(context, cardId)

export const deriveTacticalPlan = (
  context: Lv3StrategyContext,
  view: PlayerView,
  sourceCardId: string | undefined,
): TacticalPlan => {
  if (!sourceCardId) {
    return {
      kind: 'tempo',
      status: 'none',
      sharedTags: [],
      relativeValue: 0,
      requiresKnownDeckFact: false,
      detail: '此行動沒有可識別的結構化能力來源。',
    }
  }
  const knownDeckFactCount = getKnownDeckFacts(
    context.knowledgeState,
    view.viewerId,
  ).length
  const payoffEdges = context.synergyGraph.edges.filter(
    (edge) => edge.payoff.cardId === sourceCardId,
  )
  const setupEdges = context.synergyGraph.edges.filter(
    (edge) => edge.setup.cardId === sourceCardId,
  )
  const edge = payoffEdges[0] ?? setupEdges[0]
  if (!edge) {
    return {
      kind: 'tempo',
      status: 'none',
      sourceCardId,
      sharedTags: [],
      relativeValue: 0,
      requiresKnownDeckFact: false,
      detail: '來源沒有可連結的 setup／payoff 結構化證據。',
    }
  }

  const requiresKnownDeckFact = edge.sharedTags.includes('deck-order')
  const allPublicSignalsAvailable = edge.sharedTags.every((tag) =>
    hasPublicTag(view, tag, knownDeckFactCount),
  )
  const isPayoff = payoffEdges.length > 0
  const status: TacticalPlanStatus = allPublicSignalsAvailable
    ? 'confirmed'
    : 'potential'
  return {
    kind: isPayoff ? 'payoff' : 'setup',
    status,
    sourceCardId,
    sharedTags: edge.sharedTags,
    relativeValue: isPayoff
      ? status === 'confirmed' ? 42 : 14
      : status === 'confirmed' ? 12 : 4,
    requiresKnownDeckFact,
    detail: isPayoff
      ? status === 'confirmed'
        ? '已知資訊與公開區支持此 payoff 的結構化前提。'
        : '此 payoff 仍有未證實前提，僅給保守分數。'
      : status === 'confirmed'
        ? '此 setup 有可見 payoff 連結，但不會高過明確擊倒。'
        : '此 setup 尚無完整可驗證前提，僅給低分。',
  }
}
