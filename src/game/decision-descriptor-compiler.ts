import { getPendingDecision } from './commands'
import type { PendingDecision } from './commands'
import {
  getEffectSelectionCandidates,
  getEffectSelectionLimits,
  getSupportEffectCandidates,
  requiresEffectCardSelection,
} from './effects/targeting'
import {
  getBattleCookieToHandCostCandidates,
  getDiscardAllHandCostCandidates,
  getDiscardHandCostCandidates,
  getHpToTrashCostCandidates,
  getTrashBattleCookieCostCandidates,
  getTrashCookieToBreakAreaCostCandidates,
  getTrashToDeckBottomCostCandidates,
  getTrashToDeckCostCandidates,
} from './skills'
import type {
  AbilityCost,
  CardEffect,
  EffectContext,
  EffectTargetSelector,
  EnergyCost,
  GameCard,
  GameState,
  PlayerId,
} from './types'
import type {
  DecisionDescriptor,
  DecisionDescriptorCandidateSource,
  DecisionDescriptorStep,
} from './decision-descriptor'
import { describePendingDecision } from './decision-descriptor'

export interface DecisionDescriptorCompileOptions {
  /**
   * UI／線上同步若已從自己的 PlayerView 得到候選，可明確傳入這裡。
   * 未傳入時只會使用規則層能從合法公開視角安全推導的候選。
   */
  candidateIds?: readonly string[]
  /** 遮罩狀態下必須指定 viewer，避免把另一位玩家的手牌編進 descriptor。 */
  viewerPlayerId?: PlayerId
}

export interface CompiledDecisionDescriptor extends DecisionDescriptor {
  status: 'ready' | 'needs-review'
  blockers: string[]
}

export interface EffectDecisionDescriptorInput {
  state: GameState
  playerId: PlayerId
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  sourceCardName?: string
  context: EffectContext
  effect: CardEffect
  /** 啟動／攻擊後續的支援區能量支付。 */
  payment?: EnergyCost
  /** 尚未由 begin-* 指令支付的卡牌代價。 */
  cost?: AbilityCost
  commandKind?: string
  viewerPlayerId?: PlayerId
}

interface CandidateResult {
  ids: string[]
  source: DecisionDescriptorCandidateSource
  blocker?: string
}

const energyTotal = (cost: EnergyCost): number =>
  Object.values(cost).reduce((sum, value) => sum + (value ?? 0), 0)

const ENERGY_KEYS = new Set([
  'red',
  'yellow',
  'green',
  'blue',
  'purple',
  'black',
  'pure',
  'neutral',
])

const supportIds = (state: GameState, playerId: PlayerId): string[] =>
  state.players[playerId].supportArea
    .filter((support) => !support.rested)
    .map((support) => support.card.instanceId)

const cardIds = (cards: readonly GameCard[]): string[] =>
  cards.map((card) => card.instanceId)

const privateHandEffect = (effect: CardEffect): boolean =>
  effect.kind === 'hand-to-battle' ||
  effect.kind === 'hand-to-break' ||
  effect.kind === 'hand-to-break-by-level-sum' ||
  effect.kind === 'hand-to-hp' ||
  effect.kind === 'hand-to-support' ||
  effect.kind === 'discard-hand'

const effectCandidateSource = (
  effect: CardEffect,
): DecisionDescriptorCandidateSource => {
  if (privateHandEffect(effect)) return 'private-hand'
  switch (effect.kind) {
    case 'break-to-battle':
    case 'break-to-hand':
    case 'break-to-hand-by-level-sum':
    case 'opponent-break-to-trash-then-battle-to-break':
      return 'public-break'
    case 'support-to-battle':
    case 'support-to-hand':
    case 'support-to-hp':
    case 'support-to-trash':
    case 'rest-support':
    case 'rest-support-and-damage':
    case 'set-active':
      return 'public-support'
    case 'trash-to-battle':
    case 'trash-to-break':
    case 'trash-to-deck':
    case 'trash-to-hand':
    case 'trash-to-support':
    case 'opponent-trash-to-break':
      return 'public-trash'
    default:
      return 'public-battle'
  }
}

const getEffectSelector = (
  effect: CardEffect,
): Partial<EffectTargetSelector> | undefined => {
  if (effect.kind === 'damage-all' && effect.sequential) {
    return effect.target
  }
  if (effect.kind === 'opponent-battle-to-trash') {
    return {
      side: 'opponent',
      min: effect.min ?? 1,
      max: 1,
      ...(effect.minLevel !== undefined ? { minLevel: effect.minLevel } : {}),
      ...(effect.maxLevel !== undefined ? { maxLevel: effect.maxLevel } : {}),
      ...(effect.remainingHp !== undefined
        ? { remainingHp: effect.remainingHp }
        : {}),
    }
  }
  if ('target' in effect && effect.target) return effect.target
  return undefined
}

const getEffectCandidates = (
  input: Pick<EffectDecisionDescriptorInput, 'state' | 'context' | 'effect' | 'viewerPlayerId'>,
): CandidateResult => {
  const { state, context, effect, viewerPlayerId } = input
  const source = effectCandidateSource(effect)
  if (source === 'private-hand' && viewerPlayerId !== context.sourcePlayerId) {
    return {
      ids: [],
      source,
      blocker: 'private hand candidates are withheld from a non-owner view',
    }
  }

  if (!requiresEffectCardSelection(effect)) {
    return { ids: [], source: 'none' }
  }

  const candidates = getEffectSelectionCandidates(state, context, effect)
  // Keep the candidate list inside the exact rules-layer result. The descriptor
  // is not allowed to enumerate deck contents or infer a hidden card.
  return { ids: cardIds(candidates), source }
}

const costStep = (
  id: string,
  cost: AbilityCost,
  required: boolean,
  min: number,
  max: number,
  candidateIds: string[],
  candidateSource: DecisionDescriptorCandidateSource,
  label: string,
): DecisionDescriptorStep => ({
  id,
  kind: 'cost',
  required,
  min,
  max,
  candidateIds,
  candidateSource,
  cost,
  commandKinds: ['begin-activate-skill', 'begin-play-item', 'begin-activate-stage'],
  label,
})

const compileCostSteps = (
  state: GameState,
  playerId: PlayerId,
  context: EffectContext,
  cost: AbilityCost,
  viewerPlayerId: PlayerId | undefined,
): { steps: DecisionDescriptorStep[]; blockers: string[] } => {
  const player = state.players[playerId]
  const steps: DecisionDescriptorStep[] = []
  const blockers: string[] = []
  const viewerOwnsPrivateZones = viewerPlayerId === undefined || viewerPlayerId === playerId

  const energy = cost.energy ?? Object.fromEntries(
    Object.entries(cost).filter(([key, value]) =>
      ENERGY_KEYS.has(key) && typeof value === 'number' && (value ?? 0) > 0,
    ),
  ) as EnergyCost
  const energyCount = energyTotal(energy)
  if (energyCount > 0) {
    steps.push({
      id: `payment-${steps.length + 1}`,
      kind: 'payment',
      required: true,
      min: energyCount,
      max: energyCount,
      candidateIds: supportIds(state, playerId),
      candidateSource: 'public-support',
      payment: energy,
      cost,
      commandKinds: ['begin-activate-skill', 'begin-play-item', 'begin-activate-stage'],
      label: `支付 ${energyCount} 張支援卡能量`,
    })
  }

  if ((cost.discardAllHand || (cost.discardHand ?? 0) > 0) && !viewerOwnsPrivateZones) {
    blockers.push('private hand candidates are withheld from a non-owner view')
  }
  if (cost.discardAllHand || (cost.discardHand ?? 0) > 0) {
    const candidates = viewerOwnsPrivateZones
      ? cost.discardAllHand
        ? getDiscardAllHandCostCandidates(cost, player.hand, context.sourceInstanceId)
        : getDiscardHandCostCandidates(cost, player.hand, context.sourceInstanceId)
      : []
    const max = cost.discardAllHand || cost.discardHandAtLeast
      ? candidates.length
      : cost.discardHand ?? 0
    steps.push(costStep(
      `cost-${steps.length + 1}`,
      cost,
      max > 0,
      cost.discardAllHand || cost.discardHandAtLeast ? 0 : max,
      max,
      cardIds(candidates),
      'private-hand',
      cost.discardAllHand ? '選擇要棄置的全部手牌' : `選擇 ${max} 張手牌作為代價`,
    ))
  }

  const supportCost = (cost.supportToTrash ?? 0) + (cost.supportToHand ?? 0)
  if (supportCost > 0) {
    const candidates = getSupportEffectCandidates(state, context).filter(
      (support) =>
        cost.supportToHandType === undefined ||
        support.card.type === cost.supportToHandType,
    )
    steps.push(costStep(
      `cost-${steps.length + 1}`,
      cost,
      true,
      supportCost,
      supportCost,
      cardIds(candidates.map((support) => support.card)),
      'public-support',
      `選擇 ${supportCost} 張支援區卡支付代價`,
    ))
  }

  if (cost.hpToTrash) {
    const candidates = getHpToTrashCostCandidates(
      cost,
      player.battleArea,
      context.sourceInstanceId,
    )
    steps.push(costStep(
      `cost-${steps.length + 1}`,
      cost,
      true,
      1,
      1,
      cardIds(candidates.map((cookie) => cookie.card)),
      'public-battle',
      '選擇支付 HP 代價的餅乾',
    ))
  }

  if (cost.trashBattleCookie) {
    const candidates = getTrashBattleCookieCostCandidates(
      cost,
      player.battleArea,
      context.sourceInstanceId,
    )
    const count = cost.trashBattleCookie.count
    steps.push(costStep(
      `cost-${steps.length + 1}`,
      cost,
      true,
      count,
      count,
      cardIds(candidates.map((cookie) => cookie.card)),
      'public-battle',
      `選擇 ${count} 張戰鬥區餅乾支付代價`,
    ))
  }

  if (cost.battleCookieToHand) {
    const candidates = getBattleCookieToHandCostCandidates(
      cost,
      player.battleArea,
      context.sourceInstanceId,
    )
    const count = cost.battleCookieToHand.count
    steps.push(costStep(
      `cost-${steps.length + 1}`,
      cost,
      true,
      count,
      count,
      cardIds(candidates.map((cookie) => cookie.card)),
      'public-battle',
      `選擇 ${count} 張餅乾回手支付代價`,
    ))
  }

  if (cost.trashToDeckBottom) {
    const candidates = viewerOwnsPrivateZones
      ? getTrashToDeckBottomCostCandidates(cost, player.discardPile)
      : []
    if (!viewerOwnsPrivateZones) blockers.push('private discard selection is withheld from a non-owner view')
    const count = cost.trashToDeckBottom.count
    steps.push(costStep(
      `cost-${steps.length + 1}`,
      cost,
      true,
      count,
      count,
      cardIds(candidates),
      'public-trash',
      `選擇 ${count} 張棄牌區卡放到牌庫底`,
    ))
  }

  if (cost.trashToDeck) {
    const candidates = viewerOwnsPrivateZones
      ? getTrashToDeckCostCandidates(cost, player.discardPile)
      : []
    if (!viewerOwnsPrivateZones) blockers.push('private discard selection is withheld from a non-owner view')
    const count = cost.trashToDeck.count
    steps.push(costStep(
      `cost-${steps.length + 1}`,
      cost,
      true,
      count,
      count,
      cardIds(candidates),
      'public-trash',
      `選擇 ${count} 張棄牌區卡洗回牌庫`,
    ))
  }

  if (cost.trashCookieToBreakArea) {
    const candidates = viewerOwnsPrivateZones
      ? getTrashCookieToBreakAreaCostCandidates(cost, player.discardPile)
      : []
    if (!viewerOwnsPrivateZones) blockers.push('private discard selection is withheld from a non-owner view')
    const count = cost.trashCookieToBreakArea.count
    steps.push(costStep(
      `cost-${steps.length + 1}`,
      cost,
      true,
      count,
      count,
      cardIds(candidates),
      'public-trash',
      `選擇 ${count} 張棄牌區餅乾放入休息區`,
    ))
  }

  if (cost.handToBreakArea) {
    if (!viewerOwnsPrivateZones) blockers.push('private hand candidates are withheld from a non-owner view')
    const candidates = viewerOwnsPrivateZones
      ? player.hand.filter(
          (card) =>
            card.type === 'cookie' &&
            (cost.handToBreakArea?.energyColor === undefined ||
              card.energyColor === cost.handToBreakArea.energyColor),
        )
      : []
    const count = cost.handToBreakArea.count
    steps.push(costStep(
      `cost-${steps.length + 1}`,
      cost,
      true,
      count,
      count,
      cardIds(candidates),
      'private-hand',
      `選擇 ${count} 張手牌餅乾放入休息區`,
    ))
  }

  return { steps, blockers: [...new Set(blockers)] }
}

const baseDescriptor = (
  input: Pick<EffectDecisionDescriptorInput, 'playerId' | 'sourcePlayerId' | 'sourceInstanceId' | 'sourceCardName'>,
): DecisionDescriptor => ({
  schemaVersion: 1,
  decisionKind: 'effect',
  playerId: input.playerId,
  sourcePlayerId: input.sourcePlayerId,
  sourceInstanceId: input.sourceInstanceId,
  sourceCardName: input.sourceCardName ?? '',
  steps: [],
  actionKinds: [],
})

/**
 * 將一個 CardEffect 編譯成付款→代價→目標→結算的 descriptor。
 * 這是 shadow compiler：它只產生候選與提示，不執行效果，也不取代
 * `applyGameCommand` 的最終規則驗證。
 */
export const compileEffectDecisionDescriptor = (
  input: EffectDecisionDescriptorInput,
): CompiledDecisionDescriptor => {
  const descriptor = baseDescriptor(input)
  const blockers: string[] = []
  const viewerPlayerId = input.viewerPlayerId ?? input.playerId

  if (input.payment && energyTotal(input.payment) > 0) {
    descriptor.steps.push({
      id: `payment-${descriptor.steps.length + 1}`,
      kind: 'payment',
      required: true,
      min: energyTotal(input.payment),
      max: energyTotal(input.payment),
      candidateIds: supportIds(input.state, input.playerId),
      candidateSource: 'public-support',
      payment: input.payment,
      commandKinds: [input.commandKind ?? 'resolve-ability-effect'],
      label: `支付 ${energyTotal(input.payment)} 張支援卡能量`,
    })
  }

  if (input.cost) {
    const compiledCost = compileCostSteps(
      input.state,
      input.playerId,
      input.context,
      input.cost,
      viewerPlayerId,
    )
    descriptor.steps.push(...compiledCost.steps)
    blockers.push(...compiledCost.blockers)
  }

  const candidates = getEffectCandidates({
    state: input.state,
    context: input.context,
    effect: input.effect,
    viewerPlayerId,
  })
  const limits = getEffectSelectionLimits(input.effect)
  if (limits && requiresEffectCardSelection(input.effect)) {
    descriptor.steps.push({
      id: `target-${descriptor.steps.length + 1}`,
      kind: 'target',
      required: limits.min > 0,
      min: limits.min,
      max: limits.max,
      candidateIds: candidates.ids,
      candidateSource: candidates.source,
      selector: getEffectSelector(input.effect),
      commandKinds: [input.commandKind ?? 'resolve-ability-effect'],
      label: '選擇效果目標或卡牌',
    })
  }
  if (candidates.blocker) blockers.push(candidates.blocker)

  descriptor.steps.push({
    id: `resolve-${descriptor.steps.length + 1}`,
    kind: 'resolve',
    required: true,
    candidateIds: [],
    candidateSource: 'none',
    commandKinds: [input.commandKind ?? 'resolve-ability-effect'],
    label: '由規則層結算效果',
  })
  descriptor.actionKinds = [input.commandKind ?? 'resolve-ability-effect']
  return {
    ...descriptor,
    blockers: [...new Set(blockers)],
    status: blockers.length > 0 ? 'needs-review' : 'ready',
  }
}

const pendingEffectForDecision = (
  state: GameState,
  decision: PendingDecision,
): { effect: CardEffect; context: EffectContext; cost?: AbilityCost } | null => {
  if (decision.kind === 'faint-effect') {
    const pending = state.pendingFaintEffects?.find(
      (entry) => entry.sourceInstanceId === decision.sourceInstanceId,
    )
    return pending
      ? { effect: pending.effect, context: pending.context, cost: pending.cost }
      : null
  }
  if (decision.kind === 'after-damage-effect') {
    const pending = state.pendingAfterDamageEffects?.find(
      (entry) => entry.sourceInstanceId === decision.sourceInstanceId,
    )
    return pending ? { effect: pending.effect, context: pending.context } : null
  }
  return null
}

/**
 * 從目前 GameState 建立所有 pending consumer 共用的 descriptor。
 * `viewerPlayerId` 是隱藏資訊邊界：沒有合法視角時，手牌與尚未公開的牌序
 * 一律不會被放入 candidateIds。
 */
export const compilePendingDecisionDescriptor = (
  state: GameState,
  decision: PendingDecision | null = getPendingDecision(state),
  options: DecisionDescriptorCompileOptions = {},
): CompiledDecisionDescriptor | null => {
  const descriptor = describePendingDecision(decision, options.candidateIds ?? [])
  if (!descriptor || !decision) return null

  const viewerPlayerId = options.viewerPlayerId ?? decision.playerId
  const blockers: string[] = []

  if (decision.kind === 'optional-cost-attack') {
    const paymentStep = descriptor.steps[0]
    paymentStep.candidateIds = supportIds(state, decision.playerId)
    paymentStep.candidateSource = 'public-support'
    const payment = decision.cost.energy ?? (Object.fromEntries(
      Object.entries(decision.cost).filter(([key, value]) =>
        ENERGY_KEYS.has(key) && typeof value === 'number' && value > 0,
      ),
    ) as EnergyCost)
    paymentStep.payment = payment
    const paymentCount = energyTotal(payment)
    paymentStep.min = paymentCount
    paymentStep.max = paymentCount

    const nested = decision.effects.find((effect) => requiresEffectCardSelection(effect))
    if (nested) {
      const nestedCandidates = getEffectCandidates({
        state,
        context: {
          sourcePlayerId: decision.sourcePlayerId,
          sourceInstanceId: decision.sourceInstanceId,
        },
        effect: nested,
        viewerPlayerId,
      })
      const limits = getEffectSelectionLimits(nested)
      if (limits) {
        descriptor.steps.push({
          id: 'target-1',
          kind: 'target',
          required: limits.min > 0,
          min: limits.min,
          max: limits.max,
          candidateIds: nestedCandidates.ids,
          candidateSource: nestedCandidates.source,
          selector: getEffectSelector(nested),
          commandKinds: ['resolve-optional-cost-attack'],
          label: '選擇攻擊後效果目標',
        })
      }
      if (nestedCandidates.blocker) blockers.push(nestedCandidates.blocker)
    }
  }

  const pendingEffect = pendingEffectForDecision(state, decision)
  if (pendingEffect) {
    const compiled = compileEffectDecisionDescriptor({
      state,
      playerId: decision.playerId,
      sourcePlayerId: decision.sourcePlayerId,
      sourceInstanceId: decision.sourceInstanceId,
      sourceCardName: 'sourceCardName' in decision ? decision.sourceCardName : undefined,
      context: pendingEffect.context,
      effect: pendingEffect.effect,
      cost: pendingEffect.cost,
      commandKind:
        decision.kind === 'faint-effect'
          ? 'resolve-faint-effect'
          : 'resolve-after-damage-effect',
      viewerPlayerId,
    })
    const targetStep = compiled.steps.find((step) => step.kind === 'target')
    const baseTargetStep = descriptor.steps.find((step) => step.kind === 'target')
    if (targetStep && baseTargetStep) {
      Object.assign(baseTargetStep, targetStep, { id: baseTargetStep.id })
    }
    const costSteps = compiled.steps.filter((step) => step.kind === 'cost' || step.kind === 'payment')
    descriptor.steps = [
      ...costSteps,
      ...descriptor.steps.filter((step) => step.kind !== 'target'),
      ...(baseTargetStep ? [baseTargetStep] : []),
    ]
    blockers.push(...compiled.blockers)
  }

  if (decision.kind === 'opponent-hand-discard') {
    if (viewerPlayerId === decision.playerId) {
      const step = descriptor.steps[0]
      step.candidateIds = cardIds(state.players[decision.playerId].hand)
      step.candidateSource = 'private-hand'
    } else {
      blockers.push('private hand candidates are withheld from a non-owner view')
    }
  }
  if (decision.kind === 'opponent-rest-support') {
    const step = descriptor.steps[0]
    step.candidateIds = state.players[decision.playerId].supportArea.map(
      (support) => support.card.instanceId,
    )
    step.candidateSource = 'public-support'
  }
  if (decision.kind === 'place-hand-hp') {
    const step = descriptor.steps[0]
    if (viewerPlayerId === decision.playerId) {
      step.candidateIds = cardIds(state.players[decision.playerId].hand)
      step.candidateSource = 'private-hand'
    } else {
      blockers.push('private hand candidates are withheld from a non-owner view')
    }
  }
  if (decision.kind === 'reorder-hp') {
    const target = state.players[decision.targetPlayerId].battleArea.find(
      (cookie) => cookie.card.instanceId === decision.targetInstanceId,
    )
    if (target && viewerPlayerId === decision.playerId) {
      descriptor.steps[0].candidateIds = cardIds(target.hpCards)
      descriptor.steps[0].candidateSource = 'provided'
    }
  }
  if (decision.kind === 'inspect-deck') {
    descriptor.steps[0].candidateIds = [...decision.revealedCardIds]
    descriptor.steps[0].candidateSource = 'public-reveal'
  }
  if (decision.kind === 'reveal-top-deck') {
    descriptor.steps[0].candidateIds = [decision.revealedCardId]
    descriptor.steps[0].candidateSource = 'public-reveal'
  }
  if (decision.kind === 'effect-order') {
    descriptor.steps[0].candidateSource = 'provided'
  }

  return {
    ...descriptor,
    blockers: [...new Set(blockers)],
    status: blockers.length > 0 ? 'needs-review' : 'ready',
  }
}
