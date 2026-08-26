import type { PlayerView } from '../../player-view'
import type { EnergyCost, GameCard } from '../../types'
import { getEnergyCostTotal, selectEnergyPayment } from '../../energy'
import { extractDeckCapabilities } from './capability-extractor'
import type { CapabilityEvidence, CardCapabilityModel } from './capability-model'
import { buildComboPlans, type ComboPlan, type ComboPlanValidity } from './combo-plan'
import { deriveDeckStrategyProfile, type DeckStrategyProfile } from './deck-profile'
import { getKnownDeckFacts, type KnowledgeState } from './knowledge-state'
import { buildSynergyGraph, type SynergyGraph } from './synergy-graph'
import { assessPublicCondition } from './public-condition'

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

/**
 * 由規則層已列出的下一步指令所形成的收益來源。這只描述 AI 此刻確實可採取
 * 的行動，不把手牌、棄牌或牌庫中的同名卡當成可直接兌現的 payoff。
 */
export interface ActionablePayoffSource {
  cardId: string
  actionKind: string
}

export interface TacticalPlanDerivationOptions {
  /**
   * 省略時保留 G3/Lv.4 的既有公開區域推估；只有 Lv.5 搜尋傳入規則層
   * 列舉的合法指令，才能建立嚴格的同回合 Combo intent。
   */
  actionablePayoffSources?: readonly ActionablePayoffSource[]
  /**
   * 只由本局已記錄的公開 setup 產生。當同一張 payoff 卡可對應多條泛化
   * ComboPlan 時，若這一條也已 confirmed，優先回填同一 plan，避免把完成
   * 動作錯記到另一條共用收益卡的邊。
   */
  preferredComboPlanId?: string
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

/**
 * 同回合 Combo 只在 payoff 本體已位於 AI 能合法發動／登場的公開區域時才
 * 建立意圖。棄牌、Break 或只有牌庫中的同名卡不能當作下一步可兌現，否則會
 * 造成虛假的 started/abandoned telemetry。
 */
const matchesPayoffTiming = (
  plan: ComboPlan,
  actionKind: string | undefined,
): boolean => {
  switch (plan.payoff.timing) {
    case 'attack':
      return actionKind === 'attack'
    case 'on-play':
      return actionKind === 'deploy-cookie'
    case 'activate':
      return actionKind === 'activate-skill' ||
        actionKind === 'activate-item' ||
        actionKind === 'activate-stage'
    default:
      // 反應／被動時機不是 AI 在本回合可主動兌現的同回合 payoff。
      return false
  }
}

const hasActionablePayoffSource = (
  plan: ComboPlan,
  view: PlayerView,
  options: TacticalPlanDerivationOptions,
): boolean => {
  if (plan.validity !== 'same-turn') return true
  if (options.actionablePayoffSources) {
    return options.actionablePayoffSources.some((source) =>
      source.cardId === plan.payoff.cardId && matchesPayoffTiming(plan, source.actionKind),
    )
  }
  const visibleActionSources = [
    ...view.hand,
    ...view.self.battleArea.map((cookie) => cookie.card),
    ...(view.self.stage ? [view.self.stage.card] : []),
  ]
  if (!visibleActionSources.some((card) => card.id === plan.payoff.cardId)) {
    return false
  }
  return getEnergyCostTotal(plan.payoffEnergyCost) === 0 ||
    selectEnergyPayment(plan.payoffEnergyCost, view.self.supportArea) !== null
}

export const deriveTacticalPlan = (
  context: Lv3StrategyContext,
  view: PlayerView,
  sourceCardId: string | undefined,
  afterView: PlayerView = view,
  actionKind?: string,
  options: TacticalPlanDerivationOptions = {},
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
    const strictPublicContract = options.actionablePayoffSources !== undefined
    const conditionBefore = strictPublicContract
      ? assessPublicCondition(view, plan.payoffCondition)
      : undefined
    const conditionAfter = strictPublicContract
      ? assessPublicCondition(afterView, plan.payoffCondition)
      : undefined
    const payoffActionable = strictPublicContract &&
      hasActionablePayoffSource(plan, afterView, options)
    // G3/Lv.4 的單步保留／排序呼叫不會提供未來合法 command；保留原本的
    // 公開證據評估。只有 Lv.5 傳入選項，才要求當前動作與卡面時機相符。
    const payoffTriggered = strictPublicContract
      ? matchesPayoffTiming(plan, actionKind)
      : true
    const allPublicSignalsAvailable = beforeSignals.every((signal) => signal > 0)
    const advancesPublicPrerequisite = afterSignals.some(
      (signal, index) => signal > (beforeSignals[index] ?? 0),
    )
    // 嚴格條件契約只由 Lv.5 搜尋開啟；Lv.3/Lv.4 必須維持既有的 tag-based
    // 基線，才能作為 challenger 的穩定對照組。Lv.5 以數值門檻取代「只要
    // 有 1 張 support」的粗略判斷，未能由 PlayerView 證明時只給 potential。
    const status: TacticalPlanStatus = strictPublicContract && plan.payoffCondition
      ? isPayoff
        ? conditionBefore?.state === 'met' && payoffTriggered ? 'confirmed' : 'potential'
        : conditionBefore?.state !== 'met' && conditionAfter?.state === 'met'
          && payoffActionable
          ? 'confirmed'
          : 'potential'
      : isPayoff
        ? allPublicSignalsAvailable && payoffTriggered ? 'confirmed' : 'potential'
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
    Number(
      right.status === 'confirmed' &&
      right.plan.id === options.preferredComboPlanId,
    ) - Number(
      left.status === 'confirmed' &&
      left.plan.id === options.preferredComboPlanId,
    ) ||
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
