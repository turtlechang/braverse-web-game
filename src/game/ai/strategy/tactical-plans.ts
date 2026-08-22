import type { PlayerView } from '../../player-view'
import type { EnergyCost, GameCard } from '../../types'
import { extractDeckCapabilities } from './capability-extractor'
import type { CapabilityEvidence, CardCapabilityModel } from './capability-model'
import { buildComboPlans, type ComboPlan, type ComboPlanValidity } from './combo-plan'
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
  comboPlanId?: string
  setupCardId?: string
  payoffCardId?: string
  requiredEnergyCost?: Readonly<EnergyCost>
  requiredActiveSupport?: number
  validity?: ComboPlanValidity
}

export interface Lv3StrategyContext {
  cards: readonly GameCard[]
  capabilityModels: readonly CardCapabilityModel[]
  deckProfile: DeckStrategyProfile
  synergyGraph: SynergyGraph
  comboPlans: readonly ComboPlan[]
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

const publicTagSignal = (
  view: PlayerView,
  tag: string,
  knownDeckFactCount: number,
): number => {
  switch (tag) {
    case 'support':
      return view.self.supportArea.length
    case 'trash':
      return view.self.discardPile.length
    case 'active-rest':
      return view.self.supportArea.filter((support) => support.rested).length
    case 'hand':
      return view.hand.length
    case 'hp':
      return view.self.battleArea.reduce((total, cookie) => total + cookie.hpCount, 0)
    case 'battle':
      return view.self.battleArea.length
    case 'break':
      return view.self.breakArea.length
    case 'deck-order':
      return knownDeckFactCount
    case 'opponent-board':
      return view.opponent.battleArea.length
    case 'opponent-hand':
      return view.opponent.handCount
    case 'break-race':
      return view.opponent.breakArea.reduce((total, card) => total + card.level, 0)
    default:
      return 0
  }
}

export const createLv3StrategyContext = (
  view: PlayerView,
  knowledgeState: KnowledgeState,
): Lv3StrategyContext => {
  const cards = visibleSelfCards(view)
  const capabilityModels = extractDeckCapabilities(cards)
  const synergyGraph = buildSynergyGraph(capabilityModels)
  return {
    cards,
    capabilityModels,
    deckProfile: deriveDeckStrategyProfile(capabilityModels),
    synergyGraph,
    comboPlans: buildComboPlans(synergyGraph),
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
  afterView: PlayerView = view,
  actionKind?: string,
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
  // 把卡放到支援區只是一般資源動作，不等同於發動該卡印刷的效果。
  // 結束階段也沒有來源效果，不能因卡片本身具有 Combo 能力而誤加分。
  if (actionKind === 'place-support' || actionKind === 'advance-phase') {
    return {
      kind: 'tempo',
      status: 'none',
      sourceCardId,
      sharedTags: [],
      relativeValue: 0,
      requiresKnownDeckFact: false,
      detail: '此動作沒有發動來源卡的 Combo 能力。',
    }
  }
  const knownDeckFactCount = getKnownDeckFacts(
    context.knowledgeState,
    view.viewerId,
  ).length
  const payoffPlans = context.comboPlans.filter(
    (plan) => plan.payoff.cardId === sourceCardId,
  )
  const setupPlans = context.comboPlans.filter(
    (plan) => plan.setup.cardId === sourceCardId,
  )
  if (payoffPlans.length === 0 && setupPlans.length === 0) {
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

  const scorePlan = (plan: ComboPlan, isPayoff: boolean) => {
    const beforeSignals = plan.sharedTags.map((tag) =>
      publicTagSignal(view, tag, knownDeckFactCount),
    )
    const afterSignals = plan.sharedTags.map((tag) =>
      publicTagSignal(afterView, tag, knownDeckFactCount),
    )
    const allPublicSignalsAvailable = beforeSignals.every((signal) => signal > 0)
    const advancesPublicPrerequisite = afterSignals.some(
      (signal, index) => signal > (beforeSignals[index] ?? 0),
    )
    const status: TacticalPlanStatus = isPayoff
      ? allPublicSignalsAvailable ? 'confirmed' : 'potential'
      : advancesPublicPrerequisite ? 'confirmed' : 'potential'
    const relativeValue = isPayoff
      ? status === 'confirmed'
        ? 24 + Math.min(24, plan.expectedValue)
        : 6 + Math.min(8, Math.floor(plan.expectedValue / 3))
      : status === 'confirmed'
        ? 8 + Math.min(10, Math.floor(plan.expectedValue / 4))
        : 2
    return { plan, status, relativeValue }
  }
  const candidates = [
    ...payoffPlans.map((plan) => scorePlan(plan, true)),
    ...setupPlans.map((plan) => scorePlan(plan, false)),
  ].sort((left, right) =>
    Number(right.status === 'confirmed') - Number(left.status === 'confirmed') ||
    right.relativeValue - left.relativeValue ||
    left.plan.id.localeCompare(right.plan.id),
  )
  const selected = candidates[0]
  if (!selected) throw new Error('Combo plan candidates 不可為空。')
  const { plan, status, relativeValue } = selected
  const isPayoff = payoffPlans.includes(plan)
  const requiresKnownDeckFact = plan.sharedTags.includes('deck-order')
  return {
    kind: isPayoff ? 'payoff' : 'setup',
    status,
    sourceCardId,
    sharedTags: plan.sharedTags,
    relativeValue,
    requiresKnownDeckFact,
    comboPlanId: plan.id,
    setupCardId: plan.setup.cardId,
    payoffCardId: plan.payoff.cardId,
    requiredEnergyCost: plan.payoffEnergyCost,
    requiredActiveSupport: plan.requiredActiveSupport,
    validity: plan.validity,
    detail: isPayoff
      ? status === 'confirmed'
        ? `Combo ${plan.id} 的公開前置已成立，可兌現 payoff。`
        : `Combo ${plan.id} 仍有未證實前置，僅給保守分數。`
      : status === 'confirmed'
        ? `此動作確實推進 Combo ${plan.id} 的公開前置。`
        : `此 setup 尚未改變 Combo ${plan.id} 的公開前置，僅給低分。`,
  }
}
