import type { PlayerView } from '../../player-view'
import type {
  CardEffect,
  ChooseOneEffect,
  GameCard,
  PendingEffectOrderItem,
} from '../../types'
import type { AiLevel } from '../types'
import { extractCardCapabilities } from './capability-extractor'
import type { CapabilityEvidence } from './capability-model'
import type { KnowledgeState } from './knowledge-state'
import {
  createLv3StrategyContext,
  deriveTacticalPlan,
  type Lv3StrategyContext,
  type TacticalPlan,
} from './tactical-plans'

/**
 * G5 的選擇種類。這些字串只描述規則層已開啟的決策窗口，不能作為卡牌／牌組
 * 策略 key；telemetry 可據此檢視是否仍有 fallback。
 */
export type PendingSelectionKind =
  | 'replacement'
  | 'refresh'
  | 'payment'
  | 'effect-target'
  | 'effect-order'
  | 'choose-one'
  | 'discard'
  | 'flip'
  | 'trap'
  | 'blocker'
  | 'multi-stage'

export interface PendingStrategyTelemetry {
  kind: PendingSelectionKind
  sourceCardId?: string
  planKind: TacticalPlan['kind']
  planStatus: TacticalPlan['status']
  usedUniversalSelection: boolean
  unsupportedEffectCount: number
  /** 策略只從 PlayerView／KnowledgeState 建立，供稽核 assert。 */
  publicViewOnly: true
}

export interface PendingStrategyTelemetryAggregate {
  decisions: number
  universalSelections: number
  fallbackSelections: number
  unsupportedEffectCount: number
  byKind: Partial<Record<PendingSelectionKind, number>>
}

export const aggregatePendingStrategyTelemetry = (
  entries: readonly PendingStrategyTelemetry[],
): PendingStrategyTelemetryAggregate => entries.reduce<PendingStrategyTelemetryAggregate>(
  (aggregate, entry) => ({
    decisions: aggregate.decisions + 1,
    universalSelections: aggregate.universalSelections + Number(entry.usedUniversalSelection),
    fallbackSelections: aggregate.fallbackSelections + Number(!entry.usedUniversalSelection),
    unsupportedEffectCount:
      aggregate.unsupportedEffectCount + entry.unsupportedEffectCount,
    byKind: {
      ...aggregate.byKind,
      [entry.kind]: (aggregate.byKind[entry.kind] ?? 0) + 1,
    },
  }),
  {
    decisions: 0,
    universalSelections: 0,
    fallbackSelections: 0,
    unsupportedEffectCount: 0,
    byKind: {},
  },
)

const EFFECT_VALUE: Partial<Record<CardEffect['kind'], number>> = {
  damage: 30,
  'split-damage': 24,
  'damage-all': 26,
  'make-faint': 34,
  'opponent-battle-to-trash': 32,
  'field-to-trash': 28,
  'return-to-hand': 22,
  'return-to-deck-bottom': 24,
  'field-to-deck-bottom': 24,
  draw: 16,
  'draw-up-to': 16,
  'gain-hp': 14,
  'hand-to-hp': 14,
  'support-to-hp': 14,
  'modify-attack': 16,
  'modify-all-attack': 18,
  'set-active': 15,
  'rest-cookie': 14,
  'rest-support': 12,
  'opponent-rests-support': 12,
  'hand-to-battle': 18,
  'support-to-battle': 18,
  'trash-to-battle': 19,
  'deck-to-support': 14,
  'inspect-deck': 12,
  'trash-to-hand': 14,
  'trash-to-support': 14,
  'redirect-attack': 20,
  'prevent-knockout': 22,
  'disable-block': 14,
  'disable-flip': 14,
}

const isUniversalLevel = (level: AiLevel | undefined): boolean =>
  level === 3 || level === 4

const visibleCards = (view: PlayerView): readonly GameCard[] => [
  ...view.hand,
  ...view.self.battleArea.map((cookie) => cookie.card),
  ...view.self.supportArea.map((support) => support.card),
  ...view.self.breakArea,
  ...view.self.discardPile,
  ...(view.self.stage ? [view.self.stage.card] : []),
  ...view.opponent.battleArea.map((cookie) => cookie.card),
  ...view.opponent.supportArea.map((support) => support.card),
  ...view.opponent.breakArea,
  ...view.opponent.discardPile,
  ...(view.opponent.stage ? [view.opponent.stage.card] : []),
]

const sourceCardFor = (
  cardsByInstanceId: ReadonlyMap<string, GameCard>,
  sourceInstanceId: string | undefined,
): GameCard | undefined =>
  sourceInstanceId ? cardsByInstanceId.get(sourceInstanceId) : undefined

const publicBattleCookie = (
  view: PlayerView,
  instanceId: string,
) =>
  [...view.self.battleArea, ...view.opponent.battleArea].find(
    (cookie) => cookie.card.instanceId === instanceId,
  )

const isOpponentBattleCookie = (
  view: PlayerView,
  instanceId: string,
): boolean => view.opponent.battleArea.some(
  (cookie) => cookie.card.instanceId === instanceId,
)

const effectScore = (effect: CardEffect): number => {
  if (effect.kind === 'choose-one') {
    return Math.max(...effect.modes.map((mode) =>
      mode.effects.reduce((score, child) => score + effectScore(child), 0),
    ), 0)
  }
  if (effect.kind === 'optional-cost-attack' || effect.kind === 'deferred-end-of-turn') {
    return effect.effects.reduce((score, child) => score + effectScore(child), 0)
  }
  if (effect.kind === 'reveal-top-deck') {
    return effect.effects.reduce((score, child) => score + effectScore(child), 0)
  }
  if (effect.kind === 'trash-to-deck-all') {
    return (effect.thenEffects ?? []).reduce(
      (score, child) => score + effectScore(child),
      EFFECT_VALUE[effect.kind] ?? 8,
    )
  }
  return EFFECT_VALUE[effect.kind] ?? 4
}

const capabilityValue = (capabilities: readonly CapabilityEvidence[]): number =>
  capabilities.reduce((total, capability) => {
    if (capability.kind === 'unsupported') return total
    return total + (capability.certainty === 'conditional' ? 2 : 4)
  }, 0)

/**
 * 由公開卡面數值、結構化能力與 TacticalPlan 評估一張公開卡的保留價值。
 * 未出現在 PlayerView 的 instance 一律回傳中性值；不會藉此讀對手手牌／HP。
 */
const cardRetentionValue = (
  card: GameCard | undefined,
  context: Lv3StrategyContext,
  view: PlayerView,
): number => {
  if (!card) return 0
  const capabilities = extractCardCapabilities(card).capabilities
  const plan = deriveTacticalPlan(context, view, card.id)
  const faceValue = card.type === 'cookie'
    ? card.level * 12 + card.hp * 4 + card.attack * 6
    : 6
  return faceValue + capabilityValue(capabilities) + plan.relativeValue
}

const modePreference = (
  effect: ChooseOneEffect,
  plan: TacticalPlan,
): number[] => effect.modes
  .map((mode, index) => ({
    index,
    score: mode.effects.reduce((score, child) => score + effectScore(child), 0) +
      (plan.kind === 'payoff' ? plan.relativeValue : 0),
  }))
  .sort((left, right) => right.score - left.score || left.index - right.index)
  .map(({ index }) => index)

export interface PendingSelectionStrategy {
  readonly enabled: boolean
  orderCostIds: (candidateIds: readonly string[], count: number) => string[]
  orderPaymentIds: (candidateIds: readonly string[]) => string[]
  selectEffectTargetIds: (
    effect: CardEffect,
    candidateIds: readonly string[],
    max: number,
  ) => string[]
  preferredModeIndices: (
    effect: ChooseOneEffect,
    sourceInstanceId?: string,
  ) => number[]
  orderEffectIds: (
    items: readonly PendingEffectOrderItem[],
  ) => string[]
  chooseReplacementId: (candidateIds: readonly string[]) => string | undefined
  chooseRefreshId: (candidateIds: readonly string[]) => string | undefined
  telemetry: (
    kind: PendingSelectionKind,
    sourceInstanceId?: string,
  ) => PendingStrategyTelemetry
}

/**
 * 建立一次 pending／防守決策可重用的選擇器。輸入只有 PlayerView 與 G2
 * KnowledgeState；呼叫端負責從規則層取回合法 candidate id，再交回
 * applyGameCommand 驗證。
 */
export const createPendingSelectionStrategy = (
  view: PlayerView,
  knowledgeState: KnowledgeState,
  level: AiLevel | undefined,
): PendingSelectionStrategy => {
  const enabled = isUniversalLevel(level)
  const context = createLv3StrategyContext(view, knowledgeState)
  const cardsByInstanceId = new Map(
    visibleCards(view).map((card) => [card.instanceId, card]),
  )
  const planFor = (sourceInstanceId?: string): TacticalPlan => {
    const source = sourceCardFor(cardsByInstanceId, sourceInstanceId)
    return deriveTacticalPlan(context, view, source?.id)
  }
  const retention = (instanceId: string): number =>
    cardRetentionValue(cardsByInstanceId.get(instanceId), context, view)
  const stableByRetention = (
    candidateIds: readonly string[],
    direction: 1 | -1,
  ): string[] => [...candidateIds].sort((left, right) => {
    const delta = (retention(left) - retention(right)) * direction
    return delta || left.localeCompare(right)
  })

  const targetScore = (effect: CardEffect, instanceId: string): number => {
    const cookie = publicBattleCookie(view, instanceId)
    const opponentCookie = isOpponentBattleCookie(view, instanceId)
    const effectTargetSide = 'target' in effect ? effect.target?.side : undefined

    if (effect.kind === 'damage' && cookie && opponentCookie) {
      const lethal = cookie.hpCount <= effect.amount
      return (lethal ? 10_000 : 0) - cookie.hpCount * 20 + retention(instanceId)
    }
    if (
      (effect.kind === 'gain-hp' ||
        effect.kind === 'hand-to-hp' ||
        effect.kind === 'support-to-hp') &&
      cookie &&
      !opponentCookie
    ) {
      return (cookie.card.hp - cookie.hpCount) * 40 + retention(instanceId)
    }
    if (effectTargetSide === 'opponent') {
      return retention(instanceId) + (cookie ? 20 - cookie.hpCount : 0)
    }
    if (
      effect.kind === 'support-to-trash' ||
      effect.kind === 'support-to-hand' ||
      effect.kind === 'trash-to-deck' ||
      effect.kind === 'trash-to-deck-all' ||
      effect.kind === 'hand-to-break' ||
      effect.kind === 'break-to-trash'
    ) {
      return -retention(instanceId)
    }
    if (
      effect.kind === 'hand-to-support' ||
      effect.kind === 'hand-to-battle' ||
      effect.kind === 'support-to-battle' ||
      effect.kind === 'trash-to-battle' ||
      effect.kind === 'trash-to-support'
    ) {
      return retention(instanceId)
    }
    return effectTargetSide === 'self' ? retention(instanceId) : 0
  }

  return {
    enabled,
    orderCostIds: (candidateIds, count) =>
      stableByRetention(candidateIds, 1).slice(0, count),
    orderPaymentIds: (candidateIds) => [...candidateIds].sort((left, right) => {
      const leftSupport = view.self.supportArea.find(
        (support) => support.card.instanceId === left,
      )
      const rightSupport = view.self.supportArea.find(
        (support) => support.card.instanceId === right,
      )
      const restedDelta = Number(Boolean(rightSupport?.rested)) -
        Number(Boolean(leftSupport?.rested))
      return restedDelta || retention(left) - retention(right) || left.localeCompare(right)
    }),
    selectEffectTargetIds: (effect, candidateIds, max) =>
      [...candidateIds]
        .sort((left, right) =>
          targetScore(effect, right) - targetScore(effect, left) ||
          left.localeCompare(right),
        )
        .slice(0, max),
    preferredModeIndices: (effect, sourceInstanceId) =>
      modePreference(effect, planFor(sourceInstanceId)),
    orderEffectIds: (items) => [...items]
      .sort((left, right) => {
        const leftPlan = planFor(left.sourceInstanceId)
        const rightPlan = planFor(right.sourceInstanceId)
        const planRank = (plan: TacticalPlan): number =>
          plan.kind === 'payoff' && plan.status === 'confirmed' ? 3 :
            plan.kind === 'payoff' ? 2 :
              plan.kind === 'setup' ? 1 : 0
        const planDelta = planRank(rightPlan) - planRank(leftPlan)
        if (planDelta !== 0) return planDelta
        const typeDelta = effectOrderPriority(right.kind) - effectOrderPriority(left.kind)
        return typeDelta || left.id.localeCompare(right.id)
      })
      .map((item) => item.id),
    chooseReplacementId: (candidateIds) =>
      stableByRetention(candidateIds, -1)[0],
    chooseRefreshId: (candidateIds) =>
      // Refresh 的選擇會進入 break area，故犧牲保留價值最低的合法餅乾。
      stableByRetention(candidateIds, 1)[0],
    telemetry: (kind, sourceInstanceId) => {
      const source = sourceCardFor(cardsByInstanceId, sourceInstanceId)
      const plan = planFor(sourceInstanceId)
      const capabilities = source
        ? extractCardCapabilities(source).capabilities
        : []
      return {
        kind,
        sourceCardId: source?.id,
        planKind: plan.kind,
        planStatus: plan.status,
        usedUniversalSelection: enabled,
        unsupportedEffectCount: capabilities.filter(
          (capability) => capability.kind === 'unsupported',
        ).length,
        publicViewOnly: true,
      }
    },
  }
}

const effectOrderPriority = (kind: PendingEffectOrderItem['kind']): number => {
  switch (kind) {
    case 'faint-effect':
      return 50
    case 'after-damage-effect':
      return 40
    case 'stage-trigger':
      return 30
    case 'draw-up-to':
      return 20
    case 'inspect-deck':
      return 10
    case 'reveal-top-deck':
      return 0
  }
}
